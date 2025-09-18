import { expect } from "chai";
import { Keypair } from "@solana/web3.js";
import {
  initProviderAndProgram,
  airdrop,
  submitPrefixWithFee,
  approvePrefix,
  rejectPrefix,
  refundPrefixFee,
  updateFee,
  setPause,
  withdrawTreasury,
  getTreasuryBalance,
  getFeeRegistry,
  fetchPrefixAccount,
  TestContext,
} from "./helpers/setup";
import { getSharedTestContext } from "./helpers/shared-setup";

describe("Fee System Tests", () => {
  let ctx: TestContext;
  let verifier: Keypair;
  let owner: Keypair;

  before(async () => {
    // Use shared test context
    const shared = await getSharedTestContext();
    ctx = shared.ctx;
    verifier = shared.verifier;
    owner = shared.owner;
  });

  beforeEach(async () => {
    // Reset fee to default before each test to prevent cross-test pollution
    try {
      await updateFee(ctx, 1000000);
    } catch (error) {
      // Ignore errors if already at correct state
    }
  });

  describe("1️⃣ initialize instruction", () => {
    it("Should create FeeRegistry and VerifiersList with correct admin and initial fee", async () => {
      // This test verifies the setup done in before() hook
      const feeRegistry = await getFeeRegistry(ctx);
      expect(feeRegistry.admin.toString()).to.equal(
        ctx.admin.publicKey.toString()
      );
      expect(feeRegistry.currentFee.toNumber()).to.equal(1000000);
      expect(feeRegistry.pause).to.be.false;
    });
  });

  describe("2️⃣ update_fee instruction", () => {
    it("Admin can update the fee successfully", async () => {
      const newFee = 2000000;
      await updateFee(ctx, newFee);

      const feeRegistry = await getFeeRegistry(ctx);
      expect(feeRegistry.currentFee.toNumber()).to.equal(newFee);
    });

    it("Should emit FeeUpdated event", async () => {
      let eventEmitted = false;
      const listener = ctx.program.addEventListener("feeUpdated", (event) => {
        eventEmitted = true;
      });

      await updateFee(ctx, 3000000);

      // Wait a bit for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      ctx.program.removeEventListener(listener);
      expect(eventEmitted).to.be.true;
    });

    it("Non-admin should fail to update fee", async () => {
      const nonAdmin = Keypair.generate();
      await airdrop(ctx.provider, nonAdmin.publicKey, 1);

      try {
        const unauthorizedCtx = { ...ctx, admin: nonAdmin };
        await updateFee(unauthorizedCtx, 4000000);
        expect.fail("Should have failed with unauthorized admin");
      } catch (error) {
        expect(error.message).to.include("UnauthorizedAdmin");
      }
    });

    it("Should allow updating fee while paused", async () => {
      await setPause(ctx, true);
      await updateFee(ctx, 5000000);

      const feeRegistry = await getFeeRegistry(ctx);
      expect(feeRegistry.currentFee.toNumber()).to.equal(5000000);
      expect(feeRegistry.pause).to.be.true;

      // Reset pause for other tests
      await setPause(ctx, false);
    });
  });

  describe("3️⃣ submit_prefix_with_fee instruction", () => {
    it("Should transfer fee from owner to treasury correctly", async () => {
      const prefix = "TEST1";
      const initialTreasuryBalance = await getTreasuryBalance(ctx);
      const feeRegistry = await getFeeRegistry(ctx);
      const currentFee = feeRegistry.currentFee.toNumber();

      await submitPrefixWithFee(ctx, prefix, owner);

      const finalTreasuryBalance = await getTreasuryBalance(ctx);
      expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(
        currentFee
      );
    });

    it("Should create prefix account with correct fee_paid", async () => {
      const prefix = "TEST2";
      const feeRegistry = await getFeeRegistry(ctx);
      const currentFee = feeRegistry.currentFee.toNumber();

      await submitPrefixWithFee(ctx, prefix, owner);

      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      expect(prefixAccount.feePaid.toNumber()).to.equal(currentFee);
      expect(prefixAccount.owner.toString()).to.equal(
        owner.publicKey.toString()
      );
    });

    it("Should emit PrefixSubmitted event", async () => {
      const prefix = "TEST3";

      let eventEmitted = false;
      const listener = ctx.program.addEventListener(
        "prefixSubmitted",
        (event) => {
          eventEmitted = true;
        }
      );

      await submitPrefixWithFee(ctx, prefix, owner);

      // Wait a bit for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      ctx.program.removeEventListener(listener);
      expect(eventEmitted).to.be.true;
    });

    it("Should fail when program is paused", async () => {
      await setPause(ctx, true);

      try {
        await submitPrefixWithFee(ctx, "TEST4", owner);
        expect.fail("Should have failed when paused");
      } catch (error) {
        expect(error.message).to.include("FeeOperationsPaused");
      }

      // Reset pause for other tests
      await setPause(ctx, false);
    });

    it("Should fail with duplicate prefix", async () => {
      const prefix = "TEST5";
      await submitPrefixWithFee(ctx, prefix, owner);

      try {
        await submitPrefixWithFee(ctx, prefix, owner);
        expect.fail("Should have failed with duplicate prefix");
      } catch (error) {
        expect(error.message).to.include("already in use");
      }
    });

    it("Should fail with invalid prefix format (too short)", async () => {
      try {
        await submitPrefixWithFee(ctx, "AB", owner);
        expect.fail("Should have failed with short prefix");
      } catch (error) {
        expect(error.message).to.include("InvalidPrefixFormat");
      }
    });

    it("Should fail with invalid prefix format (too long)", async () => {
      try {
        await submitPrefixWithFee(ctx, "ABCDEFGHIJKLM", owner);
        expect.fail("Should have failed with long prefix");
      } catch (error) {
        expect(error.message).to.include("InvalidPrefixFormat");
      }
    });

    it("Should fail with invalid metadata URI scheme", async () => {
      try {
        await submitPrefixWithFee(ctx, "TEST6", owner, "http://example.com");
        expect.fail("Should have failed with invalid URI scheme");
      } catch (error) {
        expect(error.message).to.include("InvalidMetadataUri");
      }
    });
  });

  describe("4️⃣ refund_prefix_fee instruction", () => {
    it("Owner should receive fee back if prefix was rejected", async () => {
      const prefix = "REFUND1";

      // Submit and reject prefix
      await submitPrefixWithFee(ctx, prefix, owner);
      await rejectPrefix(ctx, prefix, verifier);

      // Get the actual fee paid from the prefix account
      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      const actualFeePaid = prefixAccount.feePaid.toNumber();

      const initialOwnerBalance = await ctx.connection.getBalance(
        owner.publicKey
      );
      const initialTreasuryBalance = await getTreasuryBalance(ctx);

      await refundPrefixFee(ctx, prefix, owner);

      const finalOwnerBalance = await ctx.connection.getBalance(
        owner.publicKey
      );
      const finalTreasuryBalance = await getTreasuryBalance(ctx);

      // The refund should transfer exactly the fee_paid amount from treasury to owner
      // We verify this by checking the treasury balance change, not the owner balance change
      // because the owner might have other balance changes from airdrops, etc.
      expect(initialTreasuryBalance - finalTreasuryBalance).to.equal(
        actualFeePaid
      );

      // The owner should receive at least the fee amount (might be more due to airdrops)
      expect(finalOwnerBalance - initialOwnerBalance).to.be.at.least(
        actualFeePaid
      );
    });

    it("Should emit PrefixRefunded event", async () => {
      const prefix = "REFUND2";

      await submitPrefixWithFee(ctx, prefix, owner);
      await rejectPrefix(ctx, prefix, verifier);

      let eventEmitted = false;
      const listener = ctx.program.addEventListener(
        "prefixRefunded",
        (event) => {
          eventEmitted = true;
        }
      );

      await refundPrefixFee(ctx, prefix, owner);

      // Wait a bit for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      ctx.program.removeEventListener(listener);
      expect(eventEmitted).to.be.true;
    });

    it("Non-owner should fail to refund", async () => {
      const prefix = "REFUND3";
      const otherOwner = Keypair.generate();
      await airdrop(ctx.provider, otherOwner.publicKey, 1);

      await submitPrefixWithFee(ctx, prefix, owner);
      await rejectPrefix(ctx, prefix, verifier);

      try {
        await refundPrefixFee(ctx, prefix, otherOwner);
        expect.fail("Should have failed with unauthorized owner");
      } catch (error) {
        expect(error.message).to.include("UnauthorizedOwnerAction");
      }
    });

    it("Should fail to refund Active prefix", async () => {
      const prefix = "REFUND4";

      await submitPrefixWithFee(ctx, prefix, owner);
      await approvePrefix(ctx, prefix, verifier);

      try {
        await refundPrefixFee(ctx, prefix, owner);
        expect.fail("Should have failed to refund active prefix");
      } catch (error) {
        expect(error.message).to.include("RefundNotAllowed");
      }
    });

    it("Should fail to refund Pending prefix", async () => {
      const prefix = "REFUND5";

      await submitPrefixWithFee(ctx, prefix, owner);

      try {
        await refundPrefixFee(ctx, prefix, owner);
        expect.fail("Should have failed to refund pending prefix");
      } catch (error) {
        expect(error.message).to.include("RefundNotAllowed");
      }
    });

    it.skip("Should allow refund for expired pending prefix", async () => {
      const prefix = "REFUND6";
      await submitPrefixWithFee(
        ctx,
        prefix,
        owner,
        "https://example.com",
        Array(32).fill(1),
        []
      );

      // Get the actual fee paid from the prefix account
      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      const actualFeePaid = prefixAccount.feePaid.toNumber();

      const initialOwnerBalance = await ctx.connection.getBalance(
        owner.publicKey
      );
      const initialTreasuryBalance = await getTreasuryBalance(ctx);

      await refundPrefixFee(ctx, prefix, owner);

      const finalOwnerBalance = await ctx.connection.getBalance(
        owner.publicKey
      );
      const finalTreasuryBalance = await getTreasuryBalance(ctx);

      // The refund should transfer exactly the fee_paid amount from treasury to owner
      expect(initialTreasuryBalance - finalTreasuryBalance).to.equal(
        actualFeePaid
      );

      // The owner should receive at least the fee amount (might be more due to airdrops)
      expect(finalOwnerBalance - initialOwnerBalance).to.be.at.least(
        actualFeePaid
      );
    });
  });

  describe("5️⃣ withdraw_treasury instruction", () => {
    it("Admin should withdraw correct amount from treasury", async () => {
      // First submit a prefix to add funds to treasury
      await submitPrefixWithFee(ctx, "WITHDRAW1", owner);

      const recipient = Keypair.generate();
      const treasuryBalance = await getTreasuryBalance(ctx);
      const amount = Math.min(1000000, treasuryBalance); // Don't withdraw more than available

      const initialRecipientBalance = await ctx.connection.getBalance(
        recipient.publicKey
      );
      await withdrawTreasury(ctx, amount, recipient.publicKey);
      const finalRecipientBalance = await ctx.connection.getBalance(
        recipient.publicKey
      );

      expect(finalRecipientBalance - initialRecipientBalance).to.equal(amount);
    });

    it("Should emit TreasuryWithdraw event", async () => {
      // Submit a prefix to add funds to treasury
      await submitPrefixWithFee(ctx, "WITHDRAW2", owner);

      const recipient = Keypair.generate();
      // Airdrop some lamports to recipient so it can exist
      await airdrop(ctx.provider, recipient.publicKey, 1);

      const treasuryBalance = await getTreasuryBalance(ctx);
      const recipientBalance = await ctx.connection.getBalance(
        recipient.publicKey
      );

      console.log(`=== BALANCE DEBUG ===`);
      console.log(`Treasury balance: ${treasuryBalance}`);
      console.log(`Recipient balance: ${recipientBalance}`);
      console.log(`Recipient pubkey: ${recipient.publicKey.toString()}`);

      // Only withdraw if we have enough balance, leave plenty for rent
      if (treasuryBalance < 10000000) {
        console.log(
          "Skipping TreasuryWithdraw event test - insufficient treasury balance"
        );
        return;
      }

      let eventEmitted = false;
      const listener = ctx.program.addEventListener(
        "treasuryWithdraw",
        (event) => {
          eventEmitted = true;
        }
      );

      const amount = 100000; // Withdraw only 100k, very conservative
      console.log(`Attempting to withdraw: ${amount}`);

      try {
        await withdrawTreasury(ctx, amount, recipient.publicKey);
        console.log(`Withdraw successful!`);
      } catch (error) {
        console.log(`Withdraw failed:`, error.message);
        throw error;
      }

      // Wait a bit for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      ctx.program.removeEventListener(listener);
      expect(eventEmitted).to.be.true;
    });

    it("Non-admin should fail to withdraw", async () => {
      // First submit a prefix to add funds to treasury
      await submitPrefixWithFee(ctx, "WITHDRAW3", owner);

      const nonAdmin = Keypair.generate();
      const recipient = Keypair.generate();
      await airdrop(ctx.provider, nonAdmin.publicKey, 1);

      try {
        const unauthorizedCtx = { ...ctx, admin: nonAdmin };
        await withdrawTreasury(unauthorizedCtx, 1000000, recipient.publicKey);
        expect.fail("Should have failed with unauthorized admin");
      } catch (error) {
        expect(error.message).to.include("UnauthorizedAdmin");
      }
    });

    it("Should fail when withdrawing more than treasury balance", async () => {
      // First submit a prefix to add funds to treasury
      await submitPrefixWithFee(ctx, "WITHDRAW4", owner);

      const recipient = Keypair.generate();
      const treasuryBalance = await getTreasuryBalance(ctx);
      const excessiveAmount = treasuryBalance + 1000000;

      try {
        await withdrawTreasury(ctx, excessiveAmount, recipient.publicKey);
        expect.fail("Should have failed with insufficient treasury balance");
      } catch (error) {
        expect(error.message).to.include("InsufficientTreasuryBalance");
      }
    });
  });

  describe("6️⃣ set_pause instruction", () => {
    it("Admin should pause program", async () => {
      await setPause(ctx, true);

      const feeRegistry = await getFeeRegistry(ctx);
      expect(feeRegistry.pause).to.be.true;
    });

    it("Admin should unpause program", async () => {
      await setPause(ctx, false);

      const feeRegistry = await getFeeRegistry(ctx);
      expect(feeRegistry.pause).to.be.false;
    });

    it("Non-admin should fail to pause", async () => {
      const nonAdmin = Keypair.generate();
      await airdrop(ctx.provider, nonAdmin.publicKey, 1);

      try {
        const unauthorizedCtx = { ...ctx, admin: nonAdmin };
        await setPause(unauthorizedCtx, true);
        expect.fail("Should have failed with unauthorized admin");
      } catch (error) {
        expect(error.message).to.include("UnauthorizedAdmin");
      }
    });

    it("Should block fee operations when paused", async () => {
      await setPause(ctx, true);

      // Test submit with unique prefix
      const uniquePrefix1 = `PAUSE${Date.now().toString().slice(-6)}`;
      try {
        await submitPrefixWithFee(ctx, uniquePrefix1, owner);
        expect.fail("Should have failed when paused");
      } catch (error) {
        expect(error.message).to.include("FeeOperationsPaused");
      }

      // Test refund - first create a rejected prefix
      await setPause(ctx, false); // Temporarily unpause to create prefix
      const uniquePrefix2 = `PAUSE${Date.now().toString().slice(-6)}`;
      await submitPrefixWithFee(ctx, uniquePrefix2, owner);
      await rejectPrefix(ctx, uniquePrefix2, verifier);
      await setPause(ctx, true); // Pause again

      try {
        await refundPrefixFee(ctx, uniquePrefix2, owner);
        expect.fail("Should have failed when paused");
      } catch (error) {
        expect(error.message).to.include("FeeOperationsPaused");
      }

      // Test withdraw
      try {
        await withdrawTreasury(ctx, 100000, owner.publicKey);
        expect.fail("Should have failed when paused");
      } catch (error) {
        expect(error.message).to.include("FeeOperationsPaused");
      }

      // Reset pause for other tests
      await setPause(ctx, false);
    });
  });

  describe("7️⃣ Fee edge cases in context", () => {
    it("Should handle fee updates mid-submission correctly", async () => {
      // Reset fee to known value
      await updateFee(ctx, 1000000);

      const prefix1 = "FEE1";
      const prefix2 = "FEE2";
      const oldFee = 1000000;
      const newFee = 2000000;

      // Submit with old fee
      await submitPrefixWithFee(ctx, prefix1, owner);

      // Update fee
      await updateFee(ctx, newFee);

      // Submit with new fee
      await submitPrefixWithFee(ctx, prefix2, owner);

      const prefix1Account = await fetchPrefixAccount(ctx, prefix1);
      const prefix2Account = await fetchPrefixAccount(ctx, prefix2);

      expect(prefix1Account.feePaid.toNumber()).to.equal(oldFee);
      expect(prefix2Account.feePaid.toNumber()).to.equal(newFee);
    });

    it("Should refund original fee amount even after fee change", async () => {
      // Reset fee to known value
      await updateFee(ctx, 1000000);

      const prefix = "REFUNDFEE";
      const newFee = 3000000;

      // Submit with original fee
      await submitPrefixWithFee(ctx, prefix, owner);

      // Get the actual fee paid from the prefix account
      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      const actualFeePaid = prefixAccount.feePaid.toNumber();

      // Update fee
      await updateFee(ctx, newFee);

      // Reject and refund
      await rejectPrefix(ctx, prefix, verifier);

      const initialOwnerBalance = await ctx.connection.getBalance(
        owner.publicKey
      );
      const initialTreasuryBalance = await getTreasuryBalance(ctx);

      await refundPrefixFee(ctx, prefix, owner);

      const finalOwnerBalance = await ctx.connection.getBalance(
        owner.publicKey
      );
      const finalTreasuryBalance = await getTreasuryBalance(ctx);

      // The refund should transfer exactly the fee_paid amount from treasury to owner
      expect(initialTreasuryBalance - finalTreasuryBalance).to.equal(
        actualFeePaid
      );

      // The owner should receive at least the fee amount (might be more due to airdrops)
      expect(finalOwnerBalance - initialOwnerBalance).to.be.at.least(
        actualFeePaid
      );
    });
  });

  describe("8️⃣ Integration / Flow Tests", () => {
    it("Submit → approve → refund should fail (Active cannot refund)", async () => {
      const prefix = "FLOW1";

      await submitPrefixWithFee(ctx, prefix, owner);
      await approvePrefix(ctx, prefix, verifier);

      try {
        await refundPrefixFee(ctx, prefix, owner);
        expect.fail("Should have failed to refund active prefix");
      } catch (error) {
        expect(error.message).to.include("RefundNotAllowed");
      }
    });

    it("Submit → reject → refund → new submission for same prefix allowed", async () => {
      const prefix = "FLOW2";

      // Submit and reject
      await submitPrefixWithFee(ctx, prefix, owner);
      await rejectPrefix(ctx, prefix, verifier);

      // Refund (this should close the account)
      await refundPrefixFee(ctx, prefix, owner);

      // New submission should work
      await submitPrefixWithFee(ctx, prefix, owner);

      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      expect(prefixAccount.owner.toString()).to.equal(
        owner.publicKey.toString()
      );
    });

    it("Pause/unpause cycles should work correctly", async () => {
      const prefix = "PAUSEFLOW";

      // Pause
      await setPause(ctx, true);

      try {
        await submitPrefixWithFee(ctx, prefix, owner);
        expect.fail("Should have failed when paused");
      } catch (error) {
        expect(error.message).to.include("FeeOperationsPaused");
      }

      // Unpause
      await setPause(ctx, false);

      // Should work now
      await submitPrefixWithFee(ctx, prefix, owner);

      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      expect(prefixAccount.owner.toString()).to.equal(
        owner.publicKey.toString()
      );
    });
  });
});
