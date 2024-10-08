const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

// util functions
// converts a given amount to 18 decimal places for our contract to recognize it
const toEther = (amount) => {
  return ethers.parseEther(amount);
};

// converts a given amount to 18 decimal places for our contract to recognize it
const fromEther = (amount) => {
  return ethers.formatEther(amount);
};

// Get balance util function
const getBalance = async (account) => {
  const balance = await ethers.provider.getBalance(account);
  return balance;
};

const toDecimal = (amount) => {
  return parseFloat(fromEther(amount));
};

describe("StudentRegistryV2 Test Suite", () => {
  // deploy util function
  const deployUtil = async () => {
    const StudentRegistryV2 = await ethers.getContractFactory("StudentRegistryV2"); // instance of StudentRegistryV2 contract in Contracts folder
    const deployedStudentRegistryV2 = await StudentRegistryV2.deploy(); // the deployed version of the StudentRegistryV2 contract in the network
    const [owner, addr1, addr2] = await ethers.getSigners();
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    return {
      deployedStudentRegistryV2,
      owner,
      addr1,
      addr2,
      ZERO_ADDRESS,
      deployedStudentRegistryV2Address: deployedStudentRegistryV2.target,
    };
  };

  describe("Deployment", () => {
    it("should deploy succesfuly and return default values of count", async () => {
      const { deployedStudentRegistryV2, owner, ZERO_ADDRESS, addr1 } = await loadFixture(deployUtil);
      // check the owner of the StudentRegistry contract which auto inherits from Ownable
      let studentRegistryV2Owner = await deployedStudentRegistryV2.getOwner();
      expect(studentRegistryV2Owner).to.eq(owner);

      // check that students array of Student struct is empty
      let allStudents = await deployedStudentRegistryV2.getAllStudents();
      expect(allStudents.length).to.eq(0);

      // check that studentsMapping has default values
      // meaning no values pushed to studentsMapping upon successful deployment
      let studentsMapping = await deployedStudentRegistryV2.studentsMapping(ZERO_ADDRESS);
      let addr1Mapping = await deployedStudentRegistryV2.studentsMapping(addr1);
      const emptyStudentStruct = ["0x0000000000000000000000000000000000000000", "", "0", "0", false, false];
      expect(...addr1Mapping).to.eq(...emptyStudentStruct);
      expect(...studentsMapping).to.eq(...emptyStudentStruct);
    });
  });

  describe("Transactions", () => {
    describe("PayFee Transaction", () => {
      describe("Validations", () => {
        it("should revert owner attempt to paying 1ETH as fee", async () => {
          const { deployedStudentRegistryV2, owner } = await loadFixture(deployUtil);
          await expect(deployedStudentRegistryV2.connect(owner).payFee({ value: toEther("1") })).to.be.revertedWith(
            "Owner is excluded"
          );
        });

        it("should revert attempt to proceed without paying 1ETH as fee", async () => {
          const { deployedStudentRegistryV2, addr1 } = await loadFixture(deployUtil);
          await expect(deployedStudentRegistryV2.connect(addr1).payFee({ value: toEther("0") })).to.be.revertedWith(
            "You must pay fee"
          );
        });

        it.only("should revert attempt to payFee multiple times", async () => {
          const { deployedStudentRegistryV2, addr1, deployedStudentRegistryV2Address } = await loadFixture(deployUtil);
          // BEFORE PAYFEE TXN
          const initialContractBalance = await getBalance(deployedStudentRegistryV2Address);
          const initialPayerBalance = await getBalance(addr1.address);

          await deployedStudentRegistryV2.connect(addr1).payFee({ value: toEther("1") });

          // AFTER PAYFEE TXN
          const finalPayerBalance = await getBalance(addr1.address);
          const finalContractBalance = await getBalance(deployedStudentRegistryV2Address);

          // Assert the balance changes
          const initialPayerBalanceNum = parseFloat(ethers.formatEther(initialPayerBalance));
          const finalPayerBalanceNum = parseFloat(ethers.formatEther(finalPayerBalance));
          const initialContractBalanceNum = parseFloat(ethers.formatEther(initialContractBalance));
          const finalContractBalanceNum = parseFloat(ethers.formatEther(finalContractBalance));

          // Check that the payer's balance decreased by 1 ETH
          expect(finalPayerBalanceNum).to.be.closeTo(initialPayerBalanceNum - 1, 0.01); // Use a tolerance for floating point comparison

          // Check that the contract's balance increased by 1 ETH
          expect(finalContractBalanceNum).to.be.closeTo(initialContractBalanceNum + 1, 0.01); // Use a tolerance for floating point comparison

          const studentsMapping = await deployedStudentRegistryV2.studentsMapping(addr1.address);
          console.log("student mapping___", studentsMapping);

          const expectStudentStruct = [addr1.address, "", "0", "0", true, false];
          expect(...studentsMapping).to.eq(...expectStudentStruct);

          // revert attempt to pay fee after initial payFee txn
          await expect(deployedStudentRegistryV2.connect(addr1).payFee({ value: toEther("1") })).to.be.revertedWith(
            "You have paid already"
          );
        });
      });

      describe("Success", () => {
        it("should successfully process payment of 1 ETH fee", async () => {
          const { deployedStudentRegistryV2, addr1, deployedStudentRegistryV2Address, owner } = await loadFixture(
            deployUtil
          );

          // Fetch contract balance before payFee txn
          const initialContractBalance = await getBalance(deployedStudentRegistryV2Address);

          // Fetch addr1  balance of  before payFee txn
          const initialPayerBalance = await getBalance(addr1.address);

          // Perform the payment
          const tx = await deployedStudentRegistryV2.connect(addr1).payFee({ value: ethers.parseEther("1") });
          await tx.wait(); // Wait for the transaction to be mined

          // Fetch updated balances
          const finalPayerBalance = await getBalance(addr1.address);
          const finalContractBalance = await getBalance(deployedStudentRegistryV2Address);

          // Assert the balance changes
          const initialPayerBalanceNum = toDecimal(initialPayerBalance);
          const finalPayerBalanceNum = toDecimal(finalPayerBalance);
          const initialContractBalanceNum = toDecimal(initialContractBalance);
          const finalContractBalanceNum = toDecimal(finalContractBalance);

          // Check that the payer's balance decreased by 1 ETH
          expect(finalPayerBalanceNum).to.be.closeTo(initialPayerBalanceNum - 1, 0.01); // Use a tolerance for floating point comparison

          // Check that the contract's balance increased by 1 ETH
          expect(finalContractBalanceNum).to.be.closeTo(initialContractBalanceNum + 1, 0.01); // Use a tolerance for floating point comparison
        });
      });
      describe("Event", () => {
        it("should emit PaidFee", async () => {
          const { deployedStudentRegistryV2, addr1 } = await loadFixture(deployUtil);

          await expect(deployedStudentRegistryV2.connect(addr1).payFee({ value: ethers.parseEther("1") }))
            .to.emit(deployedStudentRegistryV2, "PaidFee")
            .withArgs(addr1.address, ethers.parseEther("1"));
        });
      });
    });
  });
});
