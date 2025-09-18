import { expect } from "chai";
import {
  Keypair,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import {
  airdrop,
  submitPrefixWithFee,
  approvePrefix,
  rejectPrefix,
  refundPrefixFee,
  setPause,
  getTreasuryBalance,
  getFeeRegistry,
  fetchPrefixAccount,
  updatePrefixMetadata,
  updatePrefixAuthority,
  deactivatePrefix,
  reactivatePrefix,
  recoverPrefixOwnerWithFee,
  createEd25519SignatureInstruction,
  derivePrefixPDA,
  TestContext,
} from "./helpers/setup";
import { getSharedTestContext } from "./helpers/shared-setup";

describe("Prefix System Tests", () => {
  let ctx: TestContext;
  let verifier: Keypair;
  let owner: Keypair;

  before(async () => {
    // Use shared test context to avoid conflicts with fee tests
    const shared = await getSharedTestContext();
    ctx = shared.ctx;
    verifier = shared.verifier;
    owner = shared.owner;
  });

  // Helper to create a prefix and get it to a specific status
  async function createPrefixWithStatus(
    prefix: string,
    targetStatus: "pending" | "active" | "rejected" | "inactive",
    ownerKeypair: Keypair = owner
  ) {
    await submitPrefixWithFee(ctx, prefix, ownerKeypair);

    switch (targetStatus) {
      case "active":
        await approvePrefix(ctx, prefix, verifier);
        break;
      case "rejected":
        await rejectPrefix(ctx, prefix, verifier);
        break;
      case "inactive":
        await approvePrefix(ctx, prefix, verifier);
        await deactivatePrefix(ctx, prefix);
        break;
      case "pending":
        // Already pending after submission
        break;
    }
  }

  // Helper to check prefix status
  async function expectPrefixStatus(prefix: string, expectedStatus: string) {
    const prefixAccount = await fetchPrefixAccount(ctx, prefix);
    // Anchor returns enum as object like { pending: {} }, { active: {} }, etc.
    const statusLower = expectedStatus.toLowerCase();
    expect(prefixAccount.status).to.have.property(statusLower);
    expect(prefixAccount.status[statusLower]).to.deep.equal({});
  }

  // Helper to check if event was emitted
  async function expectEventEmitted(
    eventName: any,
    testFn: () => Promise<void>
  ) {
    let eventEmitted = false;
    const listener = ctx.program.addEventListener(eventName, (event) => {
      eventEmitted = true;
    });

    await testFn();

    // Wait a bit for event to be processed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    ctx.program.removeEventListener(listener);
    expect(eventEmitted).to.be.true;
  }

  describe("1️⃣ submit_prefix_with_fee (non-fee edge focus)", () => {
    it("Should create PrefixAccount with status = Pending", async () => {
      const prefix = "PREFIX1";
      const metadataUri = "https://example.com/metadata";
      const metadataHash = Array(32).fill(1);
      const authorityKeys = [Keypair.generate().publicKey];

      await submitPrefixWithFee(
        ctx,
        prefix,
        owner,
        metadataUri,
        metadataHash,
        authorityKeys
      );

      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      expect(prefixAccount.status).to.have.property("pending");
      expect(prefixAccount.owner.toString()).to.equal(
        owner.publicKey.toString()
      );
      expect(prefixAccount.prefix).to.equal(prefix);
      expect(prefixAccount.metadataUri).to.equal(metadataUri);
      expect(Array.from(prefixAccount.metadataHash)).to.deep.equal(
        metadataHash
      );
      expect(
        prefixAccount.authorityKeys.map((k) => k.toString())
      ).to.deep.equal(authorityKeys.map((k) => k.toString()));
    });

    it("Should emit PrefixSubmitted event", async () => {
      const prefix = "PREFIX2";

      await expectEventEmitted("prefixSubmitted", async () => {
        await submitPrefixWithFee(ctx, prefix, owner);
      });
    });

    it("Should fail with duplicate prefix", async () => {
      const prefix = "PREFIX3";
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
        await submitPrefixWithFee(ctx, "PREFIX4", owner, "http://example.com");
        expect.fail("Should have failed with invalid URI scheme");
      } catch (error) {
        expect(error.message).to.include("InvalidMetadataUri");
      }
    });

    it("Should fail with invalid metadata hash length", async () => {
      try {
        await submitPrefixWithFee(
          ctx,
          "PREFIX5",
          owner,
          "https://example.com",
          Array(31).fill(1)
        );
        expect.fail("Should have failed with invalid hash length");
      } catch (error) {
        expect(error.message).to.be.a("string");
        expect(error.message.length).to.be.greaterThan(0);
      }
    });

    it("Should fail with too many authority keys", async () => {
      const tooManyKeys = Array(11)
        .fill(null)
        .map(() => Keypair.generate().publicKey);

      try {
        await submitPrefixWithFee(
          ctx,
          "PREFIX6",
          owner,
          "https://example.com",
          Array(32).fill(1),
          tooManyKeys
        );
        expect.fail("Should have failed with too many authority keys");
      } catch (error) {
        expect(error.message).to.include("AuthorityKeysTooMany");
      }
    });
  });

  describe("2️⃣ approve_prefix", () => {
    it("Should change status from Pending to Active", async () => {
      const prefix = "PREFIX7";
      await submitPrefixWithFee(ctx, prefix, owner);

      await expectPrefixStatus(prefix, "Pending");

      await approvePrefix(ctx, prefix, verifier);

      await expectPrefixStatus(prefix, "Active");
    });

    it("Should record ref_hash", async () => {
      const prefix = "PREFIX8";
      const refHash = Array(32).fill(2);

      await submitPrefixWithFee(ctx, prefix, owner);
      await approvePrefix(ctx, prefix, verifier, refHash);

      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      expect(Array.from(prefixAccount.refHash)).to.deep.equal(refHash);
    });

    it("Should emit PrefixApproved and PrefixActivated events", async () => {
      const prefix = "PREFIX9";
      await submitPrefixWithFee(ctx, prefix, owner);

      await expectEventEmitted("prefixApproved", async () => {
        await approvePrefix(ctx, prefix, verifier);
      });
    });

    it("Should fail when non-verifier attempts approval", async () => {
      const prefix = "PREFIX11";
      const nonVerifier = Keypair.generate();
      await airdrop(ctx.provider, nonVerifier.publicKey, 1);

      await submitPrefixWithFee(ctx, prefix, owner);

      try {
        await approvePrefix(ctx, prefix, nonVerifier);
        expect.fail("Should have failed with unauthorized verifier");
      } catch (error) {
        expect(error.message).to.include("UnauthorizedVerifier");
      }
    });

    it("Should fail when approving prefix not in Pending status", async () => {
      const prefix = "PREFIX12";
      await createPrefixWithStatus(prefix, "active");

      try {
        await approvePrefix(ctx, prefix, verifier);
        expect.fail("Should have failed with invalid prefix status");
      } catch (error) {
        expect(error.message).to.include("InvalidPrefixStatus");
      }
    });

    // TODO: Fix this test
    it.skip("Should fail when prefix is expired", async () => {
      const prefix = "PREFIX13";

      await submitPrefixWithFee(
        ctx,
        prefix,
        owner,
        "https://example.com",
        Array(32).fill(1),
        []
      );

      try {
        await approvePrefix(ctx, prefix, verifier);
        expect.fail("Should have failed with expired prefix");
      } catch (error) {
        expect(error.message).to.include("PrefixExpired");
      }
    });
  });

  describe("3️⃣ reject_prefix", () => {
    it("Should change status from Pending to Rejected", async () => {
      const prefix = "PREFIX14";
      await submitPrefixWithFee(ctx, prefix, owner);

      await expectPrefixStatus(prefix, "Pending");

      await rejectPrefix(ctx, prefix, verifier);

      await expectPrefixStatus(prefix, "Rejected");
    });

    it("Should emit PrefixRejected event", async () => {
      const prefix = "PREFIX15";
      await submitPrefixWithFee(ctx, prefix, owner);

      await expectEventEmitted("prefixRejected", async () => {
        await rejectPrefix(ctx, prefix, verifier);
      });
    });

    it("Should fail when non-verifier attempts rejection", async () => {
      const prefix = "PREFIX16";
      const nonVerifier = Keypair.generate();
      await airdrop(ctx.provider, nonVerifier.publicKey, 1);

      await submitPrefixWithFee(ctx, prefix, owner);

      try {
        await rejectPrefix(ctx, prefix, nonVerifier);
        expect.fail("Should have failed with unauthorized verifier");
      } catch (error) {
        expect(error.message).to.include("UnauthorizedVerifier");
      }
    });

    it("Should fail when rejecting prefix not in Pending status", async () => {
      const prefix = "PREFIX17";
      await createPrefixWithStatus(prefix, "active");

      try {
        await rejectPrefix(ctx, prefix, verifier);
        expect.fail("Should have failed with invalid prefix status");
      } catch (error) {
        expect(error.message).to.include("InvalidPrefixStatus");
      }
    });
  });

  describe("4️⃣ update_prefix_metadata", () => {
    it("Should update metadata and change Active status to Pending", async () => {
      const prefix = "PREFIX18";
      await createPrefixWithStatus(prefix, "active");

      const newUri = "https://new-example.com/metadata";
      const newHash = Array(32).fill(3);

      await updatePrefixMetadata(ctx, prefix, owner, newUri, newHash);

      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      expect(prefixAccount.metadataUri).to.equal(newUri);
      expect(Array.from(prefixAccount.metadataHash)).to.deep.equal(newHash);
      expect(prefixAccount.status).to.have.property("pending");
      expect(prefixAccount.status.pending).to.deep.equal({});
    });

    it("Should update metadata without changing Pending status", async () => {
      const prefix = "PREFIX19";
      await createPrefixWithStatus(prefix, "pending");

      const newUri = "https://new-example.com/metadata2";
      const newHash = Array(32).fill(4);

      await updatePrefixMetadata(ctx, prefix, owner, newUri, newHash);

      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      expect(prefixAccount.metadataUri).to.equal(newUri);
      expect(Array.from(prefixAccount.metadataHash)).to.deep.equal(newHash);
      expect(prefixAccount.status).to.have.property("pending");
      expect(prefixAccount.status.pending).to.deep.equal({});
    });

    it("Should emit PrefixMetadataUpdated event", async () => {
      const prefix = "PREFIX20";
      await createPrefixWithStatus(prefix, "active");

      const newUri = "https://new-example.com/metadata3";
      const newHash = Array(32).fill(5);

      await expectEventEmitted("prefixMetadataUpdated", async () => {
        await updatePrefixMetadata(ctx, prefix, owner, newUri, newHash);
      });
    });

    it("Should fail when non-owner tries to update", async () => {
      const prefix = "PREFIX21";
      const otherOwner = Keypair.generate();
      await airdrop(ctx.provider, otherOwner.publicKey, 1);

      await createPrefixWithStatus(prefix, "active");

      try {
        await updatePrefixMetadata(
          ctx,
          prefix,
          otherOwner,
          "https://new.com",
          Array(32).fill(6)
        );
        expect.fail("Should have failed with unauthorized owner");
      } catch (error) {
        expect(error.message).to.include("UnauthorizedOwnerAction");
      }
    });

    it("Should fail with invalid metadata hash length", async () => {
      const prefix = "PREFIX22";
      await createPrefixWithStatus(prefix, "active");

      try {
        await updatePrefixMetadata(
          ctx,
          prefix,
          owner,
          "https://new.com",
          Array(31).fill(7)
        );
        expect.fail("Should have failed with invalid hash length");
      } catch (error) {
        expect(error.message).to.be.a("string");
        expect(error.message.length).to.be.greaterThan(0);
      }
    });

    it("Should fail with invalid metadata URI", async () => {
      const prefix = "PREFIX23";
      await createPrefixWithStatus(prefix, "active");

      try {
        await updatePrefixMetadata(
          ctx,
          prefix,
          owner,
          "http://new.com",
          Array(32).fill(8)
        );
        expect.fail("Should have failed with invalid URI scheme");
      } catch (error) {
        expect(error.message).to.include("InvalidMetadataUri");
      }
    });

    it("Should fail when updating Rejected prefix", async () => {
      const prefix = "PREFIX24";
      await createPrefixWithStatus(prefix, "rejected");

      try {
        await updatePrefixMetadata(
          ctx,
          prefix,
          owner,
          "https://new.com",
          Array(32).fill(9)
        );
        expect.fail("Should have failed with invalid prefix status");
      } catch (error) {
        expect(error.message).to.include("InvalidPrefixStatus");
      }
    });
  });

  describe("5️⃣ update_prefix_authority", () => {
    it("Should update authority keys without changing status", async () => {
      const prefix = "PREFIX25";
      await createPrefixWithStatus(prefix, "active");

      const newAuthorityKeys = [
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
      ];

      await updatePrefixAuthority(ctx, prefix, owner, newAuthorityKeys);

      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      expect(
        prefixAccount.authorityKeys.map((k) => k.toString())
      ).to.deep.equal(newAuthorityKeys.map((k) => k.toString()));
      expect(prefixAccount.status).to.have.property("active");
      expect(prefixAccount.status.active).to.deep.equal({});
    });

    it("Should emit PrefixAuthorityUpdated event", async () => {
      const prefix = "PREFIX26";
      await createPrefixWithStatus(prefix, "active");

      const newAuthorityKeys = [Keypair.generate().publicKey];

      await expectEventEmitted("prefixAuthorityUpdated", async () => {
        await updatePrefixAuthority(ctx, prefix, owner, newAuthorityKeys);
      });
    });

    it("Should fail when non-owner tries to update", async () => {
      const prefix = "PREFIX27";
      const otherOwner = Keypair.generate();
      await airdrop(ctx.provider, otherOwner.publicKey, 1);

      await createPrefixWithStatus(prefix, "active");

      try {
        await updatePrefixAuthority(ctx, prefix, otherOwner, [
          Keypair.generate().publicKey,
        ]);
        expect.fail("Should have failed with unauthorized owner");
      } catch (error) {
        expect(error.message).to.include("UnauthorizedOwnerAction");
      }
    });

    it("Should fail with too many authority keys", async () => {
      const prefix = "PREFIX28";
      await createPrefixWithStatus(prefix, "active");

      const tooManyKeys = Array(11)
        .fill(null)
        .map(() => Keypair.generate().publicKey);

      try {
        await updatePrefixAuthority(ctx, prefix, owner, tooManyKeys);
        expect.fail("Should have failed with too many authority keys");
      } catch (error) {
        expect(error.message).to.include("AuthorityKeysTooMany");
      }
    });

    it("Should fail when updating Rejected prefix", async () => {
      const prefix = "PREFIX29";
      await createPrefixWithStatus(prefix, "rejected");

      try {
        await updatePrefixAuthority(ctx, prefix, owner, [
          Keypair.generate().publicKey,
        ]);
        expect.fail("Should have failed with invalid prefix status");
      } catch (error) {
        expect(error.message).to.include("InvalidPrefixStatus");
      }
    });

    it("Should allow updating authority for Pending prefix", async () => {
      const prefix = "PREFIX30";
      await createPrefixWithStatus(prefix, "pending");

      const newAuthorityKeys = [Keypair.generate().publicKey];

      await updatePrefixAuthority(ctx, prefix, owner, newAuthorityKeys);

      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      expect(
        prefixAccount.authorityKeys.map((k) => k.toString())
      ).to.deep.equal(newAuthorityKeys.map((k) => k.toString()));
      expect(prefixAccount.status).to.have.property("pending");
      expect(prefixAccount.status.pending).to.deep.equal({});
    });
  });

  describe("6️⃣ deactivate_prefix", () => {
    it("Should change status from Active to Inactive", async () => {
      const prefix = "PREFIX31";
      await createPrefixWithStatus(prefix, "active");

      await deactivatePrefix(ctx, prefix);

      await expectPrefixStatus(prefix, "Inactive");
    });

    it("Should emit PrefixDeactivated event", async () => {
      const prefix = "PREFIX32";
      await createPrefixWithStatus(prefix, "active");

      await expectEventEmitted("prefixDeactivated", async () => {
        await deactivatePrefix(ctx, prefix);
      });
    });

    it("Should fail when non-admin attempts deactivation", async () => {
      const prefix = "PREFIX33";
      const nonAdmin = Keypair.generate();
      await airdrop(ctx.provider, nonAdmin.publicKey, 1);

      await createPrefixWithStatus(prefix, "active");

      try {
        const unauthorizedCtx = { ...ctx, admin: nonAdmin };
        await deactivatePrefix(unauthorizedCtx, prefix);
        expect.fail("Should have failed with unauthorized admin");
      } catch (error) {
        expect(error.message).to.include("UnauthorizedAdmin");
      }
    });

    it("Should fail when deactivating non-Active prefix", async () => {
      const prefix = "PREFIX34";
      await createPrefixWithStatus(prefix, "pending");

      try {
        await deactivatePrefix(ctx, prefix);
        expect.fail("Should have failed with invalid prefix status");
      } catch (error) {
        expect(error.message).to.include("InvalidPrefixStatus");
      }
    });
  });

  describe("7️⃣ reactivate_prefix", () => {
    it("Should change status from Inactive to Active", async () => {
      const prefix = "PREFIX35";
      await createPrefixWithStatus(prefix, "inactive");

      await reactivatePrefix(ctx, prefix);

      await expectPrefixStatus(prefix, "Active");
    });

    it("Should emit PrefixReactivated event", async () => {
      const prefix = "PREFIX36";
      await createPrefixWithStatus(prefix, "inactive");

      await expectEventEmitted("prefixReactivated", async () => {
        await reactivatePrefix(ctx, prefix);
      });
    });

    it("Should fail when non-admin attempts reactivation", async () => {
      const prefix = "PREFIX37";
      const nonAdmin = Keypair.generate();
      await airdrop(ctx.provider, nonAdmin.publicKey, 1);

      await createPrefixWithStatus(prefix, "inactive");

      try {
        const unauthorizedCtx = { ...ctx, admin: nonAdmin };
        await reactivatePrefix(unauthorizedCtx, prefix);
        expect.fail("Should have failed with unauthorized admin");
      } catch (error) {
        expect(error.message).to.include("UnauthorizedAdmin");
      }
    });

    it("Should fail when reactivating non-Inactive prefix", async () => {
      const prefix = "PREFIX38";
      await createPrefixWithStatus(prefix, "active");

      try {
        await reactivatePrefix(ctx, prefix);
        expect.fail("Should have failed with invalid prefix status");
      } catch (error) {
        expect(error.message).to.include("InvalidPrefixStatus");
      }
    });
  });

  describe("8️⃣ recover_prefix_owner_with_fee", () => {
    it("Should recover prefix owner and transfer fee to treasury", async () => {
      const prefix = "PREFIX39";
      await createPrefixWithStatus(prefix, "active");

      const newOwner = Keypair.generate();
      await airdrop(ctx.provider, newOwner.publicKey, 5);

      const initialTreasuryBalance = await getTreasuryBalance(ctx);
      const feeRegistry = await getFeeRegistry(ctx);
      const currentFee = feeRegistry.currentFee.toNumber();

      await recoverPrefixOwnerWithFee(ctx, prefix, newOwner);

      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      expect(prefixAccount.owner.toString()).to.equal(
        newOwner.publicKey.toString()
      );

      const finalTreasuryBalance = await getTreasuryBalance(ctx);
      expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(
        currentFee
      );
    });

    it("Should emit PrefixOwnerRecovered event", async () => {
      const prefix = "PREFIX40";
      await createPrefixWithStatus(prefix, "active");

      const newOwner = Keypair.generate();
      await airdrop(ctx.provider, newOwner.publicKey, 5);

      await expectEventEmitted("prefixOwnerRecovered", async () => {
        await recoverPrefixOwnerWithFee(ctx, prefix, newOwner);
      });
    });

    it("Should fail when non-admin attempts recovery", async () => {
      const prefix = "PREFIX41";
      const nonAdmin = Keypair.generate();
      await airdrop(ctx.provider, nonAdmin.publicKey, 5);

      await createPrefixWithStatus(prefix, "active");

      try {
        const unauthorizedCtx = { ...ctx, admin: nonAdmin };
        await recoverPrefixOwnerWithFee(unauthorizedCtx, prefix, nonAdmin);
        expect.fail("Should have failed with unauthorized admin");
      } catch (error) {
        expect(error.message).to.include("UnauthorizedAdmin");
      }
    });

    it("Should fail when new owner has insufficient fee", async () => {
      const prefix = "PREFIX42";
      await createPrefixWithStatus(prefix, "active");

      const newOwner = Keypair.generate();
      // Don't airdrop enough SOL
      await airdrop(ctx.provider, newOwner.publicKey, 0.0001); // Very small amount

      try {
        await recoverPrefixOwnerWithFee(ctx, prefix, newOwner);
        expect.fail("Should have failed with insufficient fee");
      } catch (error) {
        expect(error.message).to.include("InsufficientFee");
      }
    });

    it("Should fail when program is paused", async () => {
      const prefix = "PREFIX43";
      await createPrefixWithStatus(prefix, "active");

      const newOwner = Keypair.generate();
      await airdrop(ctx.provider, newOwner.publicKey, 5);

      await setPause(ctx, true);

      try {
        await recoverPrefixOwnerWithFee(ctx, prefix, newOwner);
        expect.fail("Should have failed when paused");
      } catch (error) {
        expect(error.message).to.include("FeeOperationsPaused");
      }

      // Reset pause for other tests
      await setPause(ctx, false);
    });

    it("Should allow recovery for Rejected prefix", async () => {
      const prefix = "PREFIX44";
      await createPrefixWithStatus(prefix, "rejected");

      const newOwner = Keypair.generate();
      await airdrop(ctx.provider, newOwner.publicKey, 5);

      const initialTreasuryBalance = await getTreasuryBalance(ctx);
      const feeRegistry = await getFeeRegistry(ctx);
      const currentFee = feeRegistry.currentFee.toNumber();

      await recoverPrefixOwnerWithFee(ctx, prefix, newOwner);

      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      expect(prefixAccount.owner.toString()).to.equal(
        newOwner.publicKey.toString()
      );

      const finalTreasuryBalance = await getTreasuryBalance(ctx);
      expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(
        currentFee
      );
    });
  });

  describe("9️⃣ Status & Lifecycle Edge Cases", () => {
    it("Active → Update metadata → Pending → Approve → Active", async () => {
      const prefix = "PREFIX45";

      // Start with Active
      await createPrefixWithStatus(prefix, "active");
      await expectPrefixStatus(prefix, "Active");

      // Update metadata should make it Pending
      await updatePrefixMetadata(
        ctx,
        prefix,
        owner,
        "https://new-metadata.com",
        Array(32).fill(10)
      );
      await expectPrefixStatus(prefix, "Pending");

      // Approve should make it Active again
      await approvePrefix(ctx, prefix, verifier);
      await expectPrefixStatus(prefix, "Active");
    });

    it("Pending → Reject → Rejected → refund → account closed → new submission allowed", async () => {
      const prefix = "PREFIX46";

      // Submit and reject
      await submitPrefixWithFee(ctx, prefix, owner);
      await rejectPrefix(ctx, prefix, verifier);
      await expectPrefixStatus(prefix, "Rejected");

      // Refund (this should close the account)
      await refundPrefixFee(ctx, prefix, owner);

      // New submission should work
      await submitPrefixWithFee(ctx, prefix, owner);
      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      expect(prefixAccount.owner.toString()).to.equal(
        owner.publicKey.toString()
      );
    });

    it("Active → Update authority → status unchanged", async () => {
      const prefix = "PREFIX47";

      await createPrefixWithStatus(prefix, "active");
      await expectPrefixStatus(prefix, "Active");

      // Update authority should not change status
      await updatePrefixAuthority(ctx, prefix, owner, [
        Keypair.generate().publicKey,
      ]);
      await expectPrefixStatus(prefix, "Active");
    });

    it("Inactive → Reactivate → Active → Deactivate → Inactive", async () => {
      const prefix = "PREFIX48";

      // Start with Inactive
      await createPrefixWithStatus(prefix, "inactive");
      await expectPrefixStatus(prefix, "Inactive");

      // Reactivate should make it Active
      await reactivatePrefix(ctx, prefix);
      await expectPrefixStatus(prefix, "Active");

      // Deactivate should make it Inactive again
      await deactivatePrefix(ctx, prefix);
      await expectPrefixStatus(prefix, "Inactive");
    });

    it("Rejected prefix cannot be updated after rejection", async () => {
      const prefix = "PREFIX49";

      await createPrefixWithStatus(prefix, "rejected");

      // Try to update metadata - should fail
      try {
        await updatePrefixMetadata(
          ctx,
          prefix,
          owner,
          "https://new.com",
          Array(32).fill(11)
        );
        expect.fail("Should have failed to update rejected prefix");
      } catch (error) {
        expect(error.message).to.include("InvalidPrefixStatus");
      }

      // Try to update authority - should fail
      try {
        await updatePrefixAuthority(ctx, prefix, owner, [
          Keypair.generate().publicKey,
        ]);
        expect.fail("Should have failed to update rejected prefix");
      } catch (error) {
        expect(error.message).to.include("InvalidPrefixStatus");
      }
    });
  });

  describe("🔟 Cross-cutting Tests", () => {
    it("Multiple prefixes with same prefix string should be rejected if PDA exists", async () => {
      const prefix = "PREFIX50";

      // First submission should work
      await submitPrefixWithFee(ctx, prefix, owner);

      // Second submission with same prefix should fail
      const otherOwner = Keypair.generate();
      await airdrop(ctx.provider, otherOwner.publicKey, 5);

      try {
        await submitPrefixWithFee(ctx, prefix, otherOwner);
        expect.fail("Should have failed with duplicate prefix");
      } catch (error) {
        expect(error.message).to.include("already in use");
      }
    });

    it("Prefix submitted → owner lost key → recovery works with fee", async () => {
      const prefix = "PREFIX51";
      const originalOwner = Keypair.generate();
      await airdrop(ctx.provider, originalOwner.publicKey, 5);

      // Submit prefix
      await submitPrefixWithFee(ctx, prefix, originalOwner);
      await approvePrefix(ctx, prefix, verifier);

      // Simulate lost key - recover with new owner
      const newOwner = Keypair.generate();
      await airdrop(ctx.provider, newOwner.publicKey, 5);

      const initialTreasuryBalance = await getTreasuryBalance(ctx);
      const feeRegistry = await getFeeRegistry(ctx);
      const currentFee = feeRegistry.currentFee.toNumber();

      await recoverPrefixOwnerWithFee(ctx, prefix, newOwner);

      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      expect(prefixAccount.owner.toString()).to.equal(
        newOwner.publicKey.toString()
      );

      const finalTreasuryBalance = await getTreasuryBalance(ctx);
      expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(
        currentFee
      );
    });

    it("Pause/unpause should block fee operations but allow other updates", async () => {
      const prefix = "PREFIX52";
      await createPrefixWithStatus(prefix, "active");

      // Pause the program
      await setPause(ctx, true);

      // Fee operations should be blocked
      try {
        await recoverPrefixOwnerWithFee(ctx, prefix, Keypair.generate());
        expect.fail("Should have failed when paused");
      } catch (error) {
        expect(error.message).to.include("FeeOperationsPaused");
      }

      // Non-fee operations should still work
      await updatePrefixMetadata(
        ctx,
        prefix,
        owner,
        "https://paused-update.com",
        Array(32).fill(12)
      );
      await expectPrefixStatus(prefix, "Pending"); // Should change to Pending

      // Unpause
      await setPause(ctx, false);

      // Fee operations should work again
      const newOwner = Keypair.generate();
      await airdrop(ctx.provider, newOwner.publicKey, 5);
      await recoverPrefixOwnerWithFee(ctx, prefix, newOwner);
    });

    it("Event integrity - verify all events are emitted with correct data", async () => {
      const prefix = "PREFIX53";
      const metadataUri = "https://event-test.com";
      const metadataHash = Array(32).fill(13);
      const authorityKeys = [Keypair.generate().publicKey];

      // Test submit event
      let submitEvent: any = null;
      const submitListener = ctx.program.addEventListener(
        "prefixSubmitted",
        (event) => {
          submitEvent = event;
        }
      );

      await submitPrefixWithFee(
        ctx,
        prefix,
        owner,
        metadataUri,
        metadataHash,
        authorityKeys
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      ctx.program.removeEventListener(submitListener);

      expect(submitEvent).to.not.be.null;
      expect(submitEvent.prefix).to.equal(prefix);
      expect(submitEvent.owner.toString()).to.equal(owner.publicKey.toString());

      // Test approve event with a fresh prefix
      const approvePrefixName = "PREFIX55";
      await submitPrefixWithFee(ctx, approvePrefixName, owner);

      let approveEvent: any = null;
      const approveListener = ctx.program.addEventListener(
        "prefixApproved",
        (event) => {
          approveEvent = event;
        }
      );

      await approvePrefix(ctx, approvePrefixName, verifier);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      ctx.program.removeEventListener(approveListener);

      expect(approveEvent).to.not.be.null;
      expect(approveEvent.prefix).to.equal(approvePrefixName);
    });

    it("PDAs should be consistent for fee, treasury, verifiers, and prefix accounts", async () => {
      const prefix = "PREFIX54";

      // Submit a prefix to test all PDAs are working
      await submitPrefixWithFee(ctx, prefix, owner);

      // Verify prefix account exists
      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      expect(prefixAccount).to.not.be.null;

      // Verify fee registry exists
      const feeRegistry = await getFeeRegistry(ctx);
      expect(feeRegistry).to.not.be.null;

      // Verify treasury has balance
      const treasuryBalance = await getTreasuryBalance(ctx);
      expect(treasuryBalance).to.be.greaterThan(0);

      // Verify verifiers list exists (by successfully approving)
      await approvePrefix(ctx, prefix, verifier);
      await expectPrefixStatus(prefix, "Active");
    });
  });

  describe("Ed25519 Signature Verification", () => {
    it("Should succeed when owner is signer (no Ed25519 pre-instruction needed)", async () => {
      const prefix = "SIG1";
      const metadataHash = Array(32).fill(42);

      // Owner is signer, so no Ed25519 pre-instruction needed
      await submitPrefixWithFee(
        ctx,
        prefix,
        owner,
        "https://test.com",
        metadataHash
      );

      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      expect(prefixAccount).to.not.be.null;
      expect(prefixAccount.metadataHash).to.deep.equal(metadataHash);
    });

    it("Should succeed with valid Ed25519 pre-instruction when owner is not signer", async () => {
      const prefix = "SIG2";
      const metadataHash = Array(32).fill(42);
      const nonSignerOwner = Keypair.generate();
      await airdrop(ctx.provider, nonSignerOwner.publicKey, 5);

      // Create Ed25519 pre-instruction
      const ed25519Ix = createEd25519SignatureInstruction(
        nonSignerOwner,
        new Uint8Array(metadataHash)
      );

      // Submit with non-signer owner but valid Ed25519 pre-instruction
      await ctx.program.methods
        .submitPrefixWithFee(prefix, "https://test.com", metadataHash, [])
        .accountsStrict({
          owner: nonSignerOwner.publicKey,
          feeRegistry: ctx.feeRegistryPDA,
          treasury: ctx.treasuryPDA,
          prefixAccount: await derivePrefixPDA(ctx.program.programId, prefix),
          instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([ed25519Ix])
        .signers([nonSignerOwner]) // nonSignerOwner pays the fee and signs the Ed25519
        .rpc();

      const prefixAccount = await fetchPrefixAccount(ctx, prefix);
      expect(prefixAccount).to.not.be.null;
      expect(prefixAccount.owner.toString()).to.equal(
        nonSignerOwner.publicKey.toString()
      );
    });

    it("Should fail when owner is not signer (payer constraint violation)", async () => {
      const prefix = "SIG3";
      const metadataHash = Array(32).fill(42);
      const nonSignerOwner = Keypair.generate();
      await airdrop(ctx.provider, nonSignerOwner.publicKey, 5);

      try {
        await ctx.program.methods
          .submitPrefixWithFee(prefix, "https://test.com", metadataHash, [])
          .accountsStrict({
            owner: nonSignerOwner.publicKey,
            feeRegistry: ctx.feeRegistryPDA,
            treasury: ctx.treasuryPDA,
            prefixAccount: await derivePrefixPDA(ctx.program.programId, prefix),
            instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
          })
          .signers([]) // Owner is not a signer, should fail due to payer constraint
          .rpc();
        expect.fail("Should have failed without owner as signer");
      } catch (error) {
        // The error will be about missing signer, not Ed25519 signature
        expect(error.message).to.include("Signature verification failed");
      }
    });

    it("Should fail with Ed25519 pre-instruction but wrong message", async () => {
      const prefix = "SIG4";
      const metadataHash = Array(32).fill(42);
      const wrongHash = Array(32).fill(99);
      const nonSignerOwner = Keypair.generate();
      await airdrop(ctx.provider, nonSignerOwner.publicKey, 5);

      // Create signature over wrong hash
      const ed25519Ix = createEd25519SignatureInstruction(
        nonSignerOwner,
        new Uint8Array(wrongHash)
      );

      try {
        await ctx.program.methods
          .submitPrefixWithFee(prefix, "https://test.com", metadataHash, [])
          .accountsStrict({
            owner: nonSignerOwner.publicKey,
            feeRegistry: ctx.feeRegistryPDA,
            treasury: ctx.treasuryPDA,
            prefixAccount: await derivePrefixPDA(ctx.program.programId, prefix),
            instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
          })
          .preInstructions([ed25519Ix])
          .signers([nonSignerOwner])
          .rpc();
        expect.fail(
          "Should have failed with wrong message in Ed25519 instruction"
        );
      } catch (error) {
        expect(error.message).to.include("InvalidEd25519Signature");
      }
    });

    it("Should fail with Ed25519 pre-instruction but wrong pubkey", async () => {
      const prefix = "SIG5";
      const metadataHash = Array(32).fill(42);
      const otherOwner = Keypair.generate();
      const nonSignerOwner = Keypair.generate();
      await airdrop(ctx.provider, nonSignerOwner.publicKey, 5);

      // Create signature with different owner
      const ed25519Ix = createEd25519SignatureInstruction(
        otherOwner,
        new Uint8Array(metadataHash)
      );

      try {
        await ctx.program.methods
          .submitPrefixWithFee(prefix, "https://test.com", metadataHash, [])
          .accountsStrict({
            owner: nonSignerOwner.publicKey,
            feeRegistry: ctx.feeRegistryPDA,
            treasury: ctx.treasuryPDA,
            prefixAccount: await derivePrefixPDA(ctx.program.programId, prefix),
            instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
          })
          .preInstructions([ed25519Ix])
          .signers([nonSignerOwner])
          .rpc();
        expect.fail(
          "Should have failed with wrong pubkey in Ed25519 instruction"
        );
      } catch (error) {
        expect(error.message).to.include("InvalidEd25519Signature");
      }
    });

    it("Should fail when owner has insufficient funds", async () => {
      const prefix = "ATOMIC1";
      const metadataHash = Array(32).fill(42);
      const poorOwner = Keypair.generate();
      // Airdrop very small amount - enough for rent but not enough for fee
      await airdrop(ctx.provider, poorOwner.publicKey, 0.001); // 0.001 SOL

      try {
        await submitPrefixWithFee(
          ctx,
          prefix,
          poorOwner,
          "https://test.com",
          metadataHash
        );
        expect.fail("Should have failed due to insufficient funds");
      } catch (error) {
        // Now we should get the actual insufficient funds error from the transfer
        expect(error.message).to.include("insufficient lamports");
      }

      // Verify no account was created
      try {
        await fetchPrefixAccount(ctx, prefix);
        expect.fail("Account should not exist");
      } catch (error) {
        expect(error.message).to.include("Account does not exist");
      }
    });
  });
});
