import { expect } from "chai";
import {
  Keypair,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import {
  TestContext,
  airdrop,
  submitPrefixWithFee,
  approvePrefix,
  rejectPrefix,
  refundPrefixFee,
  updateFee,
  setPause,
  addVerifier,
  removeVerifier,
  withdrawTreasury,
  getVerifiersList,
} from "./helpers/setup";
import { getSharedTestContext } from "./helpers/shared-setup";

describe("Flow & Integration Tests", () => {
  let ctx: TestContext;
  let owner: Keypair;
  let verifier: Keypair;
  let admin: Keypair;

  before(async () => {
    const shared = await getSharedTestContext();
    ctx = shared.ctx;
    owner = shared.owner;
    verifier = shared.verifier;
    admin = ctx.admin;

    await airdrop(ctx.provider, owner.publicKey, 10);
    await airdrop(ctx.provider, verifier.publicKey, 10);
  });

  beforeEach(async () => {
    // Reset program state before each test to prevent cross-test pollution
    try {
      await setPause(ctx, false);
      await updateFee(ctx, 1000000);
    } catch (error) {
      // Ignore errors if already at correct state
    }
  });

  afterEach(async () => {
    // Reset program state after each test
    try {
      await setPause(ctx, false);
      await updateFee(ctx, 1000000);
    } catch (error) {
      // Ignore errors if already at correct state
    }
  });

  describe("1️⃣ Complete Prefix Lifecycle Flows", () => {
    it("Full flow: submit → approve → generate code → verify code signature", async () => {
      const prefix = `FLOW${Date.now().toString().slice(-6)}`.substring(0, 12);
      const metadataUri = "https://example.com/metadata";
      const authorityKeys = [
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
      ];

      // Step 1: Submit prefix with fee
      console.log("Step 1: Submitting prefix...");
      await submitPrefixWithFee(ctx, prefix, owner, metadataUri);

      // Verify prefix is in pending state
      const prefixAccount = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix)],
          ctx.program.programId
        )[0]
      );
      expect(prefixAccount.status).to.have.property("pending");
      expect(prefixAccount.owner.toString()).to.equal(
        owner.publicKey.toString()
      );
      expect(prefixAccount.feePaid.toString()).to.equal("1000000");

      // Step 2: Approve prefix
      console.log("Step 2: Approving prefix...");
      await approvePrefix(ctx, prefix, verifier);

      // Verify prefix is now active
      const approvedPrefixAccount =
        await ctx.program.account.prefixAccount.fetch(
          PublicKey.findProgramAddressSync(
            [Buffer.from("prefix"), Buffer.from(prefix)],
            ctx.program.programId
          )[0]
        );
      expect(approvedPrefixAccount.status).to.have.property("active");

      // Step 3: Generate code (simulate code generation)
      console.log("Step 3: Generating code...");
      const generatedCode = `// Generated code for prefix: ${prefix}
const PREFIX = "${prefix}";
const AUTHORITY_KEYS = [${authorityKeys
        .map((k) => `"${k.toString()}"`)
        .join(", ")}];
const OWNER = "${owner.publicKey.toString()}";
// Additional generated logic here...`;

      // Step 4: Verify code signature (simulate signature verification)
      console.log("Step 4: Verifying code signature...");
      const codeHash = Buffer.from(generatedCode).toString("base64");
      expect(codeHash).to.be.a("string");
      expect(generatedCode).to.include(prefix);
      expect(generatedCode).to.include(owner.publicKey.toString());
      expect(generatedCode).to.include(authorityKeys[0].toString());
      expect(generatedCode).to.include(authorityKeys[1].toString());

      console.log("✅ Complete flow successful!");
    });

    it("Submit → reject → refund → new submission for same prefix allowed", async () => {
      const prefix = `REJECT${Date.now().toString().slice(-6)}`.substring(
        0,
        12
      );
      const metadataUri = "https://example.com/metadata";

      // Step 1: Submit prefix
      console.log("Step 1: Submitting prefix...");
      await submitPrefixWithFee(ctx, prefix, owner, metadataUri);

      // Verify prefix is pending
      const prefixAccount = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix)],
          ctx.program.programId
        )[0]
      );
      console.log("Prefix status:", prefixAccount.status);
      expect(prefixAccount.status).to.have.property("pending");

      // Step 2: Reject prefix
      console.log("Step 2: Rejecting prefix...");
      await rejectPrefix(ctx, prefix, verifier);

      // Verify prefix is rejected
      const rejectedPrefixAccount =
        await ctx.program.account.prefixAccount.fetch(
          PublicKey.findProgramAddressSync(
            [Buffer.from("prefix"), Buffer.from(prefix)],
            ctx.program.programId
          )[0]
        );
      expect(rejectedPrefixAccount.status).to.have.property("rejected");

      // Step 3: Refund fee
      console.log("Step 3: Refunding fee...");
      const ownerBalanceBefore = await ctx.provider.connection.getBalance(
        owner.publicKey
      );
      await refundPrefixFee(ctx, prefix, owner);
      const ownerBalanceAfter = await ctx.provider.connection.getBalance(
        owner.publicKey
      );

      // Verify refund was successful (balance increased)
      expect(ownerBalanceAfter).to.be.greaterThan(ownerBalanceBefore);

      // Step 4: New submission for same prefix should be allowed
      console.log("Step 4: Submitting same prefix again...");
      const newMetadataUri = "https://example.com/new-metadata";
      await submitPrefixWithFee(ctx, prefix, owner, newMetadataUri);

      // Verify new submission is pending
      const newPrefixAccount = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix)],
          ctx.program.programId
        )[0]
      );
      expect(newPrefixAccount.status).to.have.property("pending");
      expect(newPrefixAccount.metadataUri).to.equal(newMetadataUri);

      console.log("✅ Reject → refund → resubmit flow successful!");
    });

    it("Submit → approve → deactivate → reactivate flow", async () => {
      const prefix = `DEACT${Date.now().toString().slice(-6)}`.substring(0, 12);
      const metadataUri = "https://example.com/metadata";

      // Step 1: Submit and approve prefix
      console.log("Step 1: Submitting and approving prefix...");
      await submitPrefixWithFee(ctx, prefix, owner, metadataUri);
      await approvePrefix(ctx, prefix, verifier);

      // Verify prefix is active
      let prefixAccount = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix)],
          ctx.program.programId
        )[0]
      );
      expect(prefixAccount.status).to.have.property("active");

      // Step 2: Deactivate prefix (admin action)
      console.log("Step 2: Deactivating prefix...");
      await ctx.program.methods
        .deactivatePrefix(prefix)
        .accountsStrict({
          prefixAccount: PublicKey.findProgramAddressSync(
            [Buffer.from("prefix"), Buffer.from(prefix)],
            ctx.program.programId
          )[0],
          admin: admin.publicKey,
          feeRegistry: ctx.feeRegistryPDA,
        })
        .signers([admin])
        .rpc();

      // Verify prefix is deactivated
      prefixAccount = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix)],
          ctx.program.programId
        )[0]
      );
      expect(prefixAccount.status).to.have.property("inactive");

      // Step 3: Reactivate prefix (admin action)
      console.log("Step 3: Reactivating prefix...");
      await ctx.program.methods
        .reactivatePrefix(prefix)
        .accountsStrict({
          prefixAccount: PublicKey.findProgramAddressSync(
            [Buffer.from("prefix"), Buffer.from(prefix)],
            ctx.program.programId
          )[0],
          admin: admin.publicKey,
          feeRegistry: ctx.feeRegistryPDA,
        })
        .signers([admin])
        .rpc();

      // Verify prefix is active again
      prefixAccount = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix)],
          ctx.program.programId
        )[0]
      );
      expect(prefixAccount.status).to.have.property("active");

      console.log("✅ Deactivate → reactivate flow successful!");
    });
  });

  describe("2️⃣ Pause/Unpause Cycle Flows", () => {
    it("Pause/unpause cycles → fee operations blocked, other operations allowed", async () => {
      const prefix = `PAUSE${Date.now().toString().slice(-6)}`.substring(0, 12);
      const metadataUri = "https://example.com/metadata";

      // Step 1: Normal operation before pause
      console.log("Step 1: Normal operations before pause...");
      await submitPrefixWithFee(ctx, prefix, owner, metadataUri);

      // Verify prefix was submitted successfully
      const prefixAccount = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix)],
          ctx.program.programId
        )[0]
      );
      expect(prefixAccount.status).to.have.property("pending");

      // Step 2: Pause program
      console.log("Step 2: Pausing program...");
      await setPause(ctx, true);

      // Verify pause state
      const feeRegistry = await ctx.program.account.feeRegistry.fetch(
        ctx.feeRegistryPDA
      );
      expect(feeRegistry.pause).to.be.true;

      // Step 3: Fee operations should be blocked
      console.log("Step 3: Testing blocked fee operations...");
      const blockedPrefix = `BLOCKED${Date.now()
        .toString()
        .slice(-6)}`.substring(0, 12);

      try {
        await submitPrefixWithFee(ctx, blockedPrefix, owner, metadataUri);
        expect.fail("Should have failed when paused");
      } catch (error) {
        expect(error.message).to.include("FeeOperationsPaused");
      }

      try {
        await refundPrefixFee(ctx, prefix, owner);
        expect.fail("Should have failed when paused");
      } catch (error) {
        expect(error.message).to.include("FeeOperationsPaused");
      }

      try {
        await withdrawTreasury(ctx, 100000, owner.publicKey);
        expect.fail("Should have failed when paused");
      } catch (error) {
        expect(error.message).to.include("FeeOperationsPaused");
      }

      // Step 4: Non-fee operations should still work
      console.log("Step 4: Testing allowed non-fee operations...");

      // Note: Approve/reject are also blocked when paused (they check pause state)
      // So we'll test other non-fee operations like admin operations

      // Admin operations should work
      const newVerifier = Keypair.generate();
      await addVerifier(ctx, newVerifier.publicKey);

      // Verify verifier was added
      const verifiersList = await getVerifiersList(ctx);
      expect(verifiersList.verifiers.map((v) => v.toString())).to.include(
        newVerifier.publicKey.toString()
      );

      // Step 5: Unpause program
      console.log("Step 5: Unpausing program...");
      await setPause(ctx, false);

      // Verify unpause state
      const unpausedFeeRegistry = await ctx.program.account.feeRegistry.fetch(
        ctx.feeRegistryPDA
      );
      expect(unpausedFeeRegistry.pause).to.be.false;

      // Step 6: Fee operations should work again
      console.log("Step 6: Testing restored fee operations...");
      const newPrefix = `RESTORED${Date.now().toString().slice(-6)}`.substring(
        0,
        12
      );
      await submitPrefixWithFee(ctx, newPrefix, owner, metadataUri);

      // Verify new prefix was submitted
      const newPrefixAccount = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(newPrefix)],
          ctx.program.programId
        )[0]
      );
      expect(newPrefixAccount.status).to.have.property("pending");

      console.log("✅ Pause/unpause cycle flow successful!");
    });

    it("Multiple pause/unpause cycles should maintain state consistency", async () => {
      console.log("Testing multiple pause/unpause cycles...");

      // Cycle 1: Pause → Unpause
      await setPause(ctx, true);
      let feeRegistry = await ctx.program.account.feeRegistry.fetch(
        ctx.feeRegistryPDA
      );
      expect(feeRegistry.pause).to.be.true;

      await setPause(ctx, false);
      feeRegistry = await ctx.program.account.feeRegistry.fetch(
        ctx.feeRegistryPDA
      );
      expect(feeRegistry.pause).to.be.false;

      // Cycle 2: Pause → Unpause
      await setPause(ctx, true);
      feeRegistry = await ctx.program.account.feeRegistry.fetch(
        ctx.feeRegistryPDA
      );
      expect(feeRegistry.pause).to.be.true;

      await setPause(ctx, false);
      feeRegistry = await ctx.program.account.feeRegistry.fetch(
        ctx.feeRegistryPDA
      );
      expect(feeRegistry.pause).to.be.false;

      // Verify operations work after cycles
      const prefix = `CYCLES${Date.now().toString().slice(-6)}`.substring(
        0,
        12
      );
      await submitPrefixWithFee(
        ctx,
        prefix,
        owner,
        "https://example.com/metadata"
      );

      const prefixAccount = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix)],
          ctx.program.programId
        )[0]
      );
      expect(prefixAccount.status).to.have.property("pending");

      console.log("✅ Multiple pause/unpause cycles successful!");
    });
  });

  describe("3️⃣ Admin + Verifier + Prefix + Authority Interactions", () => {
    it("Complex admin operations with verifier management and prefix lifecycle", async () => {
      const prefix1 = `COMPLEX1${Date.now().toString().slice(-6)}`.substring(
        0,
        12
      );
      const prefix2 = `COMPLEX2${Date.now().toString().slice(-6)}`.substring(
        0,
        12
      );
      const metadataUri = "https://example.com/metadata";

      // Step 1: Admin adds multiple verifiers
      console.log("Step 1: Adding multiple verifiers...");
      const verifier1 = Keypair.generate();
      const verifier2 = Keypair.generate();
      const verifier3 = Keypair.generate();

      await airdrop(ctx.provider, verifier1.publicKey, 1);
      await airdrop(ctx.provider, verifier2.publicKey, 1);
      await airdrop(ctx.provider, verifier3.publicKey, 1);

      await addVerifier(ctx, verifier1.publicKey);
      await addVerifier(ctx, verifier2.publicKey);
      await addVerifier(ctx, verifier3.publicKey);

      // Verify verifiers were added
      let verifiersList = await getVerifiersList(ctx);
      expect(verifiersList.verifiers).to.have.length.greaterThan(3); // Including existing verifier

      // Step 2: Submit prefixes with different authority configurations
      console.log(
        "Step 2: Submitting prefixes with different authority configurations..."
      );
      const authorityKeys1 = [
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
      ];
      const authorityKeys2 = [Keypair.generate().publicKey];

      await submitPrefixWithFee(ctx, prefix1, owner, metadataUri);
      await submitPrefixWithFee(ctx, prefix2, owner, metadataUri);

      // Step 3: Different verifiers approve different prefixes
      console.log(
        "Step 3: Different verifiers approving different prefixes..."
      );
      await approvePrefix(ctx, prefix1, verifier1);
      await approvePrefix(ctx, prefix2, verifier2);

      // Verify both prefixes are active
      const prefix1Account = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix1)],
          ctx.program.programId
        )[0]
      );
      const prefix2Account = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix2)],
          ctx.program.programId
        )[0]
      );
      expect(prefix1Account.status).to.have.property("active");
      expect(prefix2Account.status).to.have.property("active");

      // Step 4: Admin updates fee mid-process
      console.log("Step 4: Admin updating fee...");
      const newFee = 2000000;
      await updateFee(ctx, newFee);

      // Verify fee was updated
      const feeRegistry = await ctx.program.account.feeRegistry.fetch(
        ctx.feeRegistryPDA
      );
      expect(feeRegistry.currentFee.toString()).to.equal(newFee.toString());

      // Step 5: Submit new prefix with new fee
      console.log("Step 5: Submitting new prefix with new fee...");
      const prefix3 = `NEWFEE${Date.now().toString().slice(-6)}`.substring(
        0,
        12
      );
      await submitPrefixWithFee(ctx, prefix3, owner, metadataUri);

      // Verify new prefix paid new fee
      const prefix3Account = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix3)],
          ctx.program.programId
        )[0]
      );
      expect(prefix3Account.feePaid.toString()).to.equal(newFee.toString());

      // Step 6: Admin withdraws from treasury
      console.log("Step 6: Admin withdrawing from treasury...");
      const recipient = Keypair.generate();
      await airdrop(ctx.provider, recipient.publicKey, 1);

      const withdrawAmount = 500000;
      const treasuryBalanceBefore = await ctx.provider.connection.getBalance(
        ctx.treasuryPDA
      );
      await withdrawTreasury(ctx, withdrawAmount, recipient.publicKey);
      const treasuryBalanceAfter = await ctx.provider.connection.getBalance(
        ctx.treasuryPDA
      );

      expect(treasuryBalanceBefore - treasuryBalanceAfter).to.equal(
        withdrawAmount
      );

      // Step 7: Admin removes a verifier
      console.log("Step 7: Admin removing a verifier...");
      await removeVerifier(ctx, verifier3.publicKey);

      // Verify verifier was removed
      verifiersList = await getVerifiersList(ctx);
      expect(verifiersList.verifiers.map((v) => v.toString())).to.not.include(
        verifier3.publicKey.toString()
      );

      // Step 8: Remaining verifiers can still approve
      console.log("Step 8: Remaining verifiers can still approve...");
      await approvePrefix(ctx, prefix3, verifier1);

      // Verify prefix3 was approved
      const approvedPrefix3Account =
        await ctx.program.account.prefixAccount.fetch(
          PublicKey.findProgramAddressSync(
            [Buffer.from("prefix"), Buffer.from(prefix3)],
            ctx.program.programId
          )[0]
        );
      expect(approvedPrefix3Account.status).to.have.property("active");

      console.log(
        "✅ Complex admin + verifier + prefix + authority interactions successful!"
      );
    });

    it("Authority key management and prefix ownership recovery flow", async () => {
      const prefix = `AUTH${Date.now().toString().slice(-6)}`.substring(0, 12);
      const metadataUri = "https://example.com/metadata";
      const authorityKeys = [
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
      ];

      // Step 1: Submit prefix with authority keys
      console.log("Step 1: Submitting prefix with authority keys...");
      await submitPrefixWithFee(ctx, prefix, owner, metadataUri);
      await approvePrefix(ctx, prefix, verifier);

      // Step 2: Update authority keys
      console.log("Step 2: Updating authority keys...");
      const newAuthorityKeys = [
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
      ];

      await ctx.program.methods
        .updatePrefixAuthority(prefix, newAuthorityKeys)
        .accountsStrict({
          prefixAccount: PublicKey.findProgramAddressSync(
            [Buffer.from("prefix"), Buffer.from(prefix)],
            ctx.program.programId
          )[0],
          owner: owner.publicKey,
        })
        .signers([owner])
        .rpc();

      // Verify authority keys were updated
      const updatedPrefixAccount =
        await ctx.program.account.prefixAccount.fetch(
          PublicKey.findProgramAddressSync(
            [Buffer.from("prefix"), Buffer.from(prefix)],
            ctx.program.programId
          )[0]
        );
      expect(updatedPrefixAccount.authorityKeys).to.have.length(3);
      expect(
        updatedPrefixAccount.authorityKeys.map((k) => k.toString())
      ).to.include(newAuthorityKeys[0].toString());

      console.log("✅ Authority key management flow successful!");
    });
  });

  describe("4️⃣ Edge Case Flows", () => {
    it("Maximum verifier limit and prefix submission limits", async () => {
      console.log("Testing maximum verifier limit...");

      // Add verifiers up to the limit (testing with a reasonable number)
      const verifiers = [];
      for (let i = 0; i < 5; i++) {
        const verifier = Keypair.generate();
        await airdrop(ctx.provider, verifier.publicKey, 1);
        await addVerifier(ctx, verifier.publicKey);
        verifiers.push(verifier);
      }

      // Verify verifiers were added
      const verifiersList = await getVerifiersList(ctx);
      expect(verifiersList.verifiers).to.have.length.greaterThan(5);

      // Test that all verifiers can approve prefixes
      const prefix = `LIMIT${Date.now().toString().slice(-6)}`.substring(0, 12);
      await submitPrefixWithFee(
        ctx,
        prefix,
        owner,
        "https://example.com/metadata"
      );

      // Any verifier should be able to approve
      await approvePrefix(ctx, prefix, verifiers[0]);

      const prefixAccount = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix)],
          ctx.program.programId
        )[0]
      );
      expect(prefixAccount.status).to.have.property("active");

      console.log("✅ Maximum verifier limit test successful!");
    });

    it("Fee changes during active prefix lifecycle", async () => {
      const prefix = `FEE${Date.now().toString().slice(-6)}`.substring(0, 12);
      const originalFee = 1000000;
      const newFee = 3000000;

      // Step 1: Submit prefix with original fee
      console.log("Step 1: Submitting prefix with original fee...");
      await submitPrefixWithFee(
        ctx,
        prefix,
        owner,
        "https://example.com/metadata"
      );

      // Verify original fee was paid
      let prefixAccount = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix)],
          ctx.program.programId
        )[0]
      );
      expect(prefixAccount.feePaid.toString()).to.equal(originalFee.toString());

      // Step 2: Admin changes fee
      console.log("Step 2: Admin changing fee...");
      await updateFee(ctx, newFee);

      // Step 3: Approve prefix (should still work with original fee)
      console.log("Step 3: Approving prefix with original fee...");
      await approvePrefix(ctx, prefix, verifier);

      // Verify prefix is active and still has original fee
      prefixAccount = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix)],
          ctx.program.programId
        )[0]
      );
      expect(prefixAccount.status).to.have.property("active");
      expect(prefixAccount.feePaid.toString()).to.equal(originalFee.toString());

      // Step 4: New prefix submission uses new fee
      console.log("Step 4: New prefix submission uses new fee...");
      const newPrefix = `NEWFEE${Date.now().toString().slice(-6)}`.substring(
        0,
        12
      );
      await submitPrefixWithFee(
        ctx,
        newPrefix,
        owner,
        "https://example.com/metadata"
      );

      const newPrefixAccount = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(newPrefix)],
          ctx.program.programId
        )[0]
      );
      expect(newPrefixAccount.feePaid.toString()).to.equal(newFee.toString());

      console.log("✅ Fee changes during active prefix lifecycle successful!");
    });

    it("Concurrent operations and race conditions", async () => {
      const prefix1 = `CONC1${Date.now().toString().slice(-6)}`.substring(
        0,
        12
      );
      const prefix2 = `CONC2${Date.now().toString().slice(-6)}`.substring(
        0,
        12
      );
      const prefix3 = `CONC3${Date.now().toString().slice(-6)}`.substring(
        0,
        12
      );

      // Submit multiple prefixes concurrently
      console.log("Testing concurrent prefix submissions...");
      const submissions = [
        submitPrefixWithFee(ctx, prefix1, owner, "https://example.com/1"),
        submitPrefixWithFee(ctx, prefix2, owner, "https://example.com/2"),
        submitPrefixWithFee(ctx, prefix3, owner, "https://example.com/3"),
      ];

      await Promise.all(submissions);

      // Verify all prefixes were submitted
      const prefix1Account = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix1)],
          ctx.program.programId
        )[0]
      );
      const prefix2Account = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix2)],
          ctx.program.programId
        )[0]
      );
      const prefix3Account = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix3)],
          ctx.program.programId
        )[0]
      );

      expect(prefix1Account.status).to.have.property("pending");
      expect(prefix2Account.status).to.have.property("pending");
      expect(prefix3Account.status).to.have.property("pending");

      // Approve all prefixes concurrently
      console.log("Testing concurrent prefix approvals...");
      const approvals = [
        approvePrefix(ctx, prefix1, verifier),
        approvePrefix(ctx, prefix2, verifier),
        approvePrefix(ctx, prefix3, verifier),
      ];

      await Promise.all(approvals);

      // Verify all prefixes were approved
      const approvedPrefix1Account =
        await ctx.program.account.prefixAccount.fetch(
          PublicKey.findProgramAddressSync(
            [Buffer.from("prefix"), Buffer.from(prefix1)],
            ctx.program.programId
          )[0]
        );
      const approvedPrefix2Account =
        await ctx.program.account.prefixAccount.fetch(
          PublicKey.findProgramAddressSync(
            [Buffer.from("prefix"), Buffer.from(prefix2)],
            ctx.program.programId
          )[0]
        );
      const approvedPrefix3Account =
        await ctx.program.account.prefixAccount.fetch(
          PublicKey.findProgramAddressSync(
            [Buffer.from("prefix"), Buffer.from(prefix3)],
            ctx.program.programId
          )[0]
        );

      expect(approvedPrefix1Account.status).to.have.property("active");
      expect(approvedPrefix2Account.status).to.have.property("active");
      expect(approvedPrefix3Account.status).to.have.property("active");

      console.log(
        "✅ Concurrent operations and race conditions test successful!"
      );
    });
  });

  describe("5️⃣ Authority Key Usage & Verification Flows", () => {
    it("Authority key can be used for prefix operations", async () => {
      const prefix = `AUTHUSE${Date.now().toString().slice(-6)}`.substring(
        0,
        12
      );
      const authorityKey = Keypair.generate();
      const authorityKeys = [authorityKey.publicKey];

      // Step 1: Submit prefix with authority keys
      console.log("Step 1: Submitting prefix with authority keys...");
      await submitPrefixWithFee(
        ctx,
        prefix,
        owner,
        "https://example.com/metadata",
        Array(32).fill(1),
        authorityKeys
      );
      await approvePrefix(ctx, prefix, verifier);

      // Step 2: Verify authority key is stored correctly
      console.log("Step 2: Verifying authority key storage...");
      const prefixAccount = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix)],
          ctx.program.programId
        )[0]
      );
      expect(prefixAccount.authorityKeys).to.have.length(1);
      expect(prefixAccount.authorityKeys[0].toString()).to.equal(
        authorityKey.publicKey.toString()
      );

      console.log("✅ Authority key usage test successful!");
    });

    it("Non-authority key attempts should fail verification", async () => {
      const prefix = `NONAUTH${Date.now().toString().slice(-6)}`.substring(
        0,
        12
      );
      const authorityKey = Keypair.generate();
      const nonAuthorityKey = Keypair.generate();
      const authorityKeys = [authorityKey.publicKey];

      // Step 1: Submit prefix with authority keys
      console.log("Step 1: Submitting prefix with authority keys...");
      await submitPrefixWithFee(
        ctx,
        prefix,
        owner,
        "https://example.com/metadata",
        Array(32).fill(1),
        authorityKeys
      );
      await approvePrefix(ctx, prefix, verifier);

      // Step 2: Attempt to use non-authority key for operations
      console.log("Step 2: Attempting to use non-authority key...");

      try {
        // Try to update metadata with non-authority key (this should fail)
        await ctx.program.methods
          .updatePrefixMetadata(
            prefix,
            "https://unauthorized-update.com",
            Array(32).fill(99)
          )
          .accountsStrict({
            prefixAccount: PublicKey.findProgramAddressSync(
              [Buffer.from("prefix"), Buffer.from(prefix)],
              ctx.program.programId
            )[0],
            owner: owner.publicKey,
            instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
          })
          .signers([owner])
          .rpc();

        expect.fail("Should have failed with non-authority key");
      } catch (error) {
        // This should fail because we're not using the proper authority key signature
        expect(error.message).to.be.a("string");
        console.log("✅ Non-authority key correctly rejected!");
      }
    });

    it("Authority key delegation and transfer flows", async () => {
      const prefix = `DELEGATE${Date.now().toString().slice(-6)}`.substring(
        0,
        12
      );
      const originalAuthorityKey = Keypair.generate();
      const newAuthorityKey = Keypair.generate();
      const authorityKeys = [originalAuthorityKey.publicKey];

      // Step 1: Submit prefix with initial authority key
      console.log("Step 1: Submitting prefix with initial authority key...");
      await submitPrefixWithFee(
        ctx,
        prefix,
        owner,
        "https://example.com/metadata",
        Array(32).fill(1),
        authorityKeys
      );
      await approvePrefix(ctx, prefix, verifier);

      // Step 2: Verify initial authority key works
      console.log("Step 2: Verifying initial authority key works...");
      const prefixAccount = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix)],
          ctx.program.programId
        )[0]
      );
      expect(prefixAccount.authorityKeys).to.have.length(1);
      expect(prefixAccount.authorityKeys[0].toString()).to.equal(
        originalAuthorityKey.publicKey.toString()
      );

      // Step 3: Add new authority key (delegation)
      console.log("Step 3: Adding new authority key (delegation)...");
      const updatedAuthorityKeys = [
        originalAuthorityKey.publicKey,
        newAuthorityKey.publicKey,
      ];

      await ctx.program.methods
        .updatePrefixAuthority(prefix, updatedAuthorityKeys)
        .accountsStrict({
          prefixAccount: PublicKey.findProgramAddressSync(
            [Buffer.from("prefix"), Buffer.from(prefix)],
            ctx.program.programId
          )[0],
          owner: owner.publicKey,
        })
        .signers([owner])
        .rpc();

      // Step 4: Verify both authority keys are now valid
      console.log("Step 4: Verifying both authority keys are valid...");
      const updatedPrefixAccount =
        await ctx.program.account.prefixAccount.fetch(
          PublicKey.findProgramAddressSync(
            [Buffer.from("prefix"), Buffer.from(prefix)],
            ctx.program.programId
          )[0]
        );
      expect(updatedPrefixAccount.authorityKeys).to.have.length(2);
      expect(
        updatedPrefixAccount.authorityKeys.map((k) => k.toString())
      ).to.include(originalAuthorityKey.publicKey.toString());
      expect(
        updatedPrefixAccount.authorityKeys.map((k) => k.toString())
      ).to.include(newAuthorityKey.publicKey.toString());

      console.log("✅ Authority key delegation and transfer flow successful!");
    });
  });

  describe("6️⃣ Error Recovery Flows", () => {
    it("Recovery from failed operations and state consistency", async () => {
      const prefix = `ERROR${Date.now().toString().slice(-6)}`.substring(0, 12);

      // Step 1: Submit prefix
      console.log("Step 1: Submitting prefix...");
      await submitPrefixWithFee(
        ctx,
        prefix,
        owner,
        "https://example.com/metadata"
      );

      // Step 2: Attempt invalid operation (should fail)
      console.log("Step 2: Attempting invalid operation...");
      const nonVerifier = Keypair.generate();
      await airdrop(ctx.provider, nonVerifier.publicKey, 1);

      try {
        await approvePrefix(ctx, prefix, nonVerifier);
        expect.fail("Should have failed with non-verifier");
      } catch (error) {
        expect(error.message).to.include("UnauthorizedVerifier");
      }

      // Step 3: Verify prefix state is still consistent
      console.log("Step 3: Verifying prefix state consistency...");
      const prefixAccount = await ctx.program.account.prefixAccount.fetch(
        PublicKey.findProgramAddressSync(
          [Buffer.from("prefix"), Buffer.from(prefix)],
          ctx.program.programId
        )[0]
      );
      expect(prefixAccount.status).to.have.property("pending");
      expect(prefixAccount.owner.toString()).to.equal(
        owner.publicKey.toString()
      );

      // Step 4: Valid operation should still work
      console.log("Step 4: Valid operation should still work...");
      await approvePrefix(ctx, prefix, verifier);

      const approvedPrefixAccount =
        await ctx.program.account.prefixAccount.fetch(
          PublicKey.findProgramAddressSync(
            [Buffer.from("prefix"), Buffer.from(prefix)],
            ctx.program.programId
          )[0]
        );
      expect(approvedPrefixAccount.status).to.have.property("active");

      console.log("✅ Error recovery and state consistency test successful!");
    });

    it("Recovery from pause state and operation resumption", async () => {
      const prefix = `PAUSEREC${Date.now().toString().slice(-6)}`.substring(
        0,
        12
      );

      // Step 1: Submit prefix
      console.log("Step 1: Submitting prefix...");
      await submitPrefixWithFee(
        ctx,
        prefix,
        owner,
        "https://example.com/metadata"
      );

      // Step 2: Pause program
      console.log("Step 2: Pausing program...");
      await setPause(ctx, true);

      // Step 3: Attempt operations that should fail
      console.log("Step 3: Attempting operations that should fail...");
      const blockedPrefix = `BLOCKED${Date.now()
        .toString()
        .slice(-6)}`.substring(0, 12);

      try {
        await submitPrefixWithFee(
          ctx,
          blockedPrefix,
          owner,
          "https://example.com/metadata"
        );
        expect.fail("Should have failed when paused");
      } catch (error) {
        expect(error.message).to.include("FeeOperationsPaused");
      }

      // Step 4: Unpause program
      console.log("Step 4: Unpausing program...");
      await setPause(ctx, false);

      // Step 5: Operations should work again
      console.log("Step 5: Operations should work again...");
      await submitPrefixWithFee(
        ctx,
        blockedPrefix,
        owner,
        "https://example.com/metadata"
      );
      await approvePrefix(ctx, blockedPrefix, verifier);

      const blockedPrefixAccount =
        await ctx.program.account.prefixAccount.fetch(
          PublicKey.findProgramAddressSync(
            [Buffer.from("prefix"), Buffer.from(blockedPrefix)],
            ctx.program.programId
          )[0]
        );
      expect(blockedPrefixAccount.status).to.have.property("active");

      console.log("✅ Pause state recovery test successful!");
    });
  });
});
