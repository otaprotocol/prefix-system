import { expect } from "chai";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PrefixSystemClient } from "../../sdk/src/client";
import * as nacl from "tweetnacl";
import { getSharedTestContext } from "./helpers/shared-setup";
import { 
  validatePrefix, 
  validateMetadataUri, 
  validateMetadataHash 
} from "../../sdk/src/validation";
import { PrefixSystemClientError } from "../../sdk/src/errors";

describe("SDK Tests", () => {
  let sdk: PrefixSystemClient;
  let connection: Connection;
  let provider: AnchorProvider;
  let admin: Keypair;
  let owner: Keypair;
  let verifier: Keypair;

  before(async () => {
    // Use the shared test context to get the same admin and verifier as other tests
    const shared = await getSharedTestContext();
    
    // Extract the shared keypairs
    admin = shared.admin;
    verifier = shared.verifier;
    owner = shared.owner;
    
    // Use the shared context's connection and provider
    connection = shared.ctx.connection;
    provider = shared.ctx.provider;

    // Create SDK with the shared admin
    sdk = PrefixSystemClient.initForTesting(connection, admin);

    console.log(`Using shared admin: ${admin.publicKey.toString()}`);
    console.log(`Using shared verifier: ${verifier.publicKey.toString()}`);
    console.log(`Using shared owner: ${owner.publicKey.toString()}`);
  });

  after(async () => {
    // Cleanup: Reset the test environment
    console.log("Test cleanup completed");
  });

  // Helper function to airdrop SOL
  async function airdrop(publicKey: PublicKey, amount: number) {
    const signature = await connection.requestAirdrop(publicKey, amount * 1e9);
    await connection.confirmTransaction(signature);
  }

  // Helper function to create Ed25519 signature
  function createEd25519Signature(
    signer: Keypair,
    message: Uint8Array
  ): number[] {
    return Array.from(nacl.sign.detached(message, signer.secretKey));
  }


  describe("1️⃣ SDK Initialization", () => {
    it("Should initialize SDK with correct program ID", () => {
      expect(sdk.programId).to.be.instanceOf(PublicKey);
      expect(sdk.programId.toString()).to.not.be.empty;
    });

    it("Should have access to program instance", () => {
      expect(sdk.program).to.exist;
      expect(sdk.program.programId).to.equal(sdk.programId);
    });
  });

  describe("2️⃣ Fee Registry Management", () => {
    it("Should initialize fee registry", async () => {
      const initialFee = 1000000; // 0.001 SOL

      const feeRegistry = await sdk.getFeeRegistry();
      expect(feeRegistry.currentFee.toNumber()).to.equal(initialFee);
      expect(feeRegistry.admin.toString()).to.equal(admin.publicKey.toString());
      expect(feeRegistry.pause).to.be.false;
    });

    it("Should update fee", async () => {
      const newFee = 2000000; // 0.002 SOL
      const tx = await sdk.updateFee(admin.publicKey, newFee);
      await provider.sendAndConfirm(tx, [admin]);

      const feeRegistry = await sdk.getFeeRegistry();
      expect(feeRegistry.currentFee.toNumber()).to.equal(newFee);
    });

    it("Should get treasury balance", async () => {
      const treasury = await sdk.getTreasury();
      expect(treasury).to.exist;
      expect(treasury!.lamports).to.be.a("number");
    });
  });

  describe("3️⃣ Verifier Management", () => {
    it("Should add verifier", async () => {
      const newVerifier = Keypair.generate();
      await airdrop(newVerifier.publicKey, 1);
      
      const tx = await sdk.addVerifier(admin.publicKey, newVerifier.publicKey);
      await provider.sendAndConfirm(tx, [admin]);

      const verifiersList = await sdk.getVerifiersList();
      expect(verifiersList.verifiers.map((v) => v.toString())).to.include(
        newVerifier.publicKey.toString()
      );
    });

    it("Should remove verifier", async () => {
      // First add a verifier to remove
      const verifierToRemove = Keypair.generate();
      await airdrop(verifierToRemove.publicKey, 1);
      
      const addTx = await sdk.addVerifier(admin.publicKey, verifierToRemove.publicKey);
      await provider.sendAndConfirm(addTx, [admin]);
      
      // Now remove it
      const tx = await sdk.removeVerifier(admin.publicKey, verifierToRemove.publicKey);
      await provider.sendAndConfirm(tx, [admin]);

      const verifiersList = await sdk.getVerifiersList();
      expect(verifiersList.verifiers.map((v) => v.toString())).to.not.include(
        verifierToRemove.publicKey.toString()
      );
    });
  });

  describe("4️⃣ Prefix Submission with Ed25519 Signature", () => {
    let testPrefix: string;
    let metadataUri: string;
    let metadataHash: number[];

    beforeEach(() => {
      testPrefix = "TEST" + Math.random().toString(36).substring(2, 6).toUpperCase();
      metadataUri = "https://example.com/metadata.json";
      metadataHash = new Array(32).fill(1);
    });

    it("Should submit prefix with proper Ed25519 signature", async () => {
      const authorityKeys = [owner.publicKey];
      const metadataHashBytes = new Uint8Array(metadataHash);
      const signature = createEd25519Signature(owner, metadataHashBytes);

      const tx = await sdk.submitPrefixWithFee(
        owner.publicKey,
        testPrefix,
        metadataUri,
        metadataHash,
        signature,
        authorityKeys
      );

      await provider.sendAndConfirm(tx, [owner]);

      const prefixAccount = await sdk.getPrefixAccount(testPrefix);

      expect(prefixAccount.prefix).to.equal(testPrefix.toUpperCase());
      expect(prefixAccount.owner.toString()).to.equal(
        owner.publicKey.toString()
      );
      expect(prefixAccount.status).to.deep.equal({ pending: {} });
    });

    it("Should fail when submitting duplicate prefix", async () => {
      const authorityKeys = [owner.publicKey];
      const metadataHashBytes = new Uint8Array(metadataHash);
      const signature = createEd25519Signature(owner, metadataHashBytes);
      const prefix1 = "DUPADUPA"

      // First submission
      const tx1 = await sdk.submitPrefixWithFee(
        owner.publicKey,
        prefix1,
        metadataUri,
        metadataHash,
        signature,
        authorityKeys
      );
      await provider.sendAndConfirm(tx1, [owner]);

      // Second submission should fail
      try {
        const tx2 = await sdk.submitPrefixWithFee(
          owner.publicKey,
          prefix1,
          metadataUri,
          metadataHash,
          signature,
          authorityKeys
        );
        await provider.sendAndConfirm(tx2, [owner]);
        expect.fail("Should have failed with duplicate prefix");
      } catch (error) {
        expect(error.message).to.include("already in use");
      }
    });
  });

  describe("5️⃣ Prefix Approval and Rejection", () => {
    let testPrefix: string;
    let metadataUri: string;
    let metadataHash: number[];

    beforeEach(async () => {
      testPrefix = "APP" + Math.random().toString(36).substring(2, 6).toUpperCase();
      metadataUri = "https://example.com/approve.json";
      metadataHash = new Array(32).fill(2);

      // Submit prefix first
      const authorityKeys = [owner.publicKey];
      const metadataHashBytes = new Uint8Array(metadataHash);
      const signature = createEd25519Signature(owner, metadataHashBytes);
      const tx = await sdk.submitPrefixWithFee(
        owner.publicKey,
        testPrefix,
        metadataUri,
        metadataHash,
        signature,
        authorityKeys
      );
      await provider.sendAndConfirm(tx, [owner]);
    });

    it("Should approve prefix", async () => {
      const refHash = new Array(32).fill(3);
      const tx = await sdk.approvePrefix(verifier.publicKey, testPrefix, refHash);
      await provider.sendAndConfirm(tx, [verifier]);

      const prefixAccount = await sdk.getPrefixAccount(testPrefix);
      expect(prefixAccount.status).to.deep.equal({ active: {} });
      expect(Array.from(prefixAccount.refHash)).to.deep.equal(refHash);
    });

    it("Should reject prefix", async () => {
      const reason = "Invalid metadata";
      const tx = await sdk.rejectPrefix(verifier.publicKey, testPrefix, reason);
      await provider.sendAndConfirm(tx, [verifier]);

      const prefixAccount = await sdk.getPrefixAccount(testPrefix);
      expect(prefixAccount.status).to.deep.equal({ rejected: {} });
    });
  });

  describe("6️⃣ Prefix Metadata Update with Ed25519 Signature", () => {
    let testPrefix: string;
    let originalMetadataUri: string;
    let originalMetadataHash: number[];

    beforeEach(async () => {
      testPrefix = "UPD" + Math.random().toString(36).substring(2, 6).toUpperCase();
      originalMetadataUri = "https://example.com/original.json";
      originalMetadataHash = new Array(32).fill(3);

      // Submit prefix first
      const authorityKeys = [owner.publicKey];
      const metadataHashBytes = new Uint8Array(originalMetadataHash);
      const signature = createEd25519Signature(owner, metadataHashBytes);
      const tx = await sdk.submitPrefixWithFee(
        owner.publicKey,
        testPrefix,
        originalMetadataUri,
        originalMetadataHash,
        signature,
        authorityKeys
      );
      await provider.sendAndConfirm(tx, [owner]);
    });

    it("Should update prefix metadata with proper Ed25519 signature", async () => {
      const newMetadataUri = "https://example.com/updated.json";
      const newMetadataHash = new Array(32).fill(4);
      const newMetadataHashBytes = new Uint8Array(newMetadataHash);
      const signature = createEd25519Signature(owner, newMetadataHashBytes);

      const tx = await sdk.updatePrefixMetadata(
        owner.publicKey,
        testPrefix,
        newMetadataUri,
        newMetadataHash,
        signature
      );

      await provider.sendAndConfirm(tx, [owner]);

      const prefixAccount = await sdk.getPrefixAccount(testPrefix);
      expect(prefixAccount.metadataUri).to.equal(newMetadataUri);
      expect(Array.from(prefixAccount.metadataHash)).to.deep.equal(
        newMetadataHash
      );
    });
  });

  describe("7️⃣ Treasury Operations", () => {
    let testPrefix: string;

    beforeEach(async () => {
      testPrefix = "TRE" + Math.random().toString(36).substring(2, 6).toUpperCase();
      const metadataUri = "https://example.com/treasury.json";
      const metadataHash = new Array(32).fill(5);
      const authorityKeys = [owner.publicKey];

      // Submit prefix to add funds to treasury
      const metadataHashBytes = new Uint8Array(metadataHash);
      const signature = createEd25519Signature(owner, metadataHashBytes);
      const tx = await sdk.submitPrefixWithFee(
        owner.publicKey,
        testPrefix,
        metadataUri,
        metadataHash,
        signature,
        authorityKeys
      );
      await provider.sendAndConfirm(tx, [owner]);
    });

    it("Should withdraw from treasury", async () => {
      const recipient = Keypair.generate();
      await airdrop(recipient.publicKey, 1);

      const beforeBalance = await connection.getBalance(recipient.publicKey);
      const withdrawAmount = 500000; // 0.0005 SOL

      const tx = await sdk.withdrawTreasury(
        admin.publicKey,
        withdrawAmount,
        recipient.publicKey
      );
      await provider.sendAndConfirm(tx, [admin]);

      const afterBalance = await connection.getBalance(recipient.publicKey);
      expect(afterBalance).to.be.greaterThan(beforeBalance);
    });
  });

  describe("8️⃣ Prefix Authority Management", () => {
    let testPrefix: string;

    beforeEach(async () => {
      testPrefix = "AUTH" + Math.random().toString(36).substring(2, 6).toUpperCase();
      const metadataUri = "https://example.com/authority.json";
      const metadataHash = new Array(32).fill(6);
      const authorityKeys = [owner.publicKey];
      const metadataHashBytes = new Uint8Array(metadataHash);
      const signature = createEd25519Signature(owner, metadataHashBytes);
      // Submit prefix first
      const tx = await sdk.submitPrefixWithFee(
        owner.publicKey,
        testPrefix,
        metadataUri,
        metadataHash,
        signature,
        authorityKeys
      );
      await provider.sendAndConfirm(tx, [owner]);
    });

    it("Should update prefix authority keys", async () => {
      const newAuthorityKeys = [owner.publicKey, verifier.publicKey];

      const tx = await sdk.updatePrefixAuthorityKeys(
        owner.publicKey,
        testPrefix,
        newAuthorityKeys
      );
      await provider.sendAndConfirm(tx, [owner]);

      const prefixAccount = await sdk.getPrefixAccount(testPrefix);
      expect(prefixAccount.authorityKeys.length).to.equal(2);
      expect(prefixAccount.authorityKeys.map((k) => k.toString())).to.include(
        verifier.publicKey.toString()
      );
    });
  });

  describe("9️⃣ Error Handling", () => {
    it("Should handle invalid prefix format", async () => {
      try {
        await sdk.getPrefixAccount("invalid-prefix-with-special-chars!");
        expect.fail("Should have failed with invalid prefix");
      } catch (error) {
        expect(error.message).to.include("Invalid prefix");
      }
    });

    it("Should handle non-existent prefix", async () => {
      try {
        await sdk.getPrefixAccount("NONEXISTENT");
        expect.fail("Should have failed with non-existent prefix");
      } catch (error) {
        expect(error.message).to.include("Account does not exist");
      }
    });

    it("Should handle unauthorized operations", async () => {
      const nonAdmin = Keypair.generate();
      await airdrop(nonAdmin.publicKey, 1);

      try {
        const tx = await sdk.addVerifier(
          nonAdmin.publicKey,
          verifier.publicKey
        );
        await provider.sendAndConfirm(tx, [nonAdmin]);
        expect.fail("Should have failed with unauthorized admin");
      } catch (error) {
        expect(error.message).to.include("Simulation failed");
      }
    });
  });

  describe("🔟 Integration Test - Complete Workflow", () => {
    it("Should complete full prefix lifecycle", async () => {
      const testPrefix = "LIFE" + Math.random().toString(36).substring(2, 6).toUpperCase();
      const metadataUri = "https://example.com/lifecycle.json";
      const metadataHash = new Array(32).fill(7);
      const authorityKeys = [owner.publicKey];

      // 1. Submit prefix
      const metadataHashBytes = new Uint8Array(metadataHash);
      const signature = createEd25519Signature(owner, metadataHashBytes);
      const submitTx = await sdk.submitPrefixWithFee(
        owner.publicKey,
        testPrefix,
        metadataUri,
        metadataHash,
        signature,
        authorityKeys
      );
      await provider.sendAndConfirm(submitTx, [owner]);

      let prefixAccount = await sdk.getPrefixAccount(testPrefix);
      expect(prefixAccount.status).to.deep.equal({ pending: {} });

      // 2. Approve prefix
      const refHash = new Array(32).fill(8);
      const approveTx = await sdk.approvePrefix(
        verifier.publicKey,
        testPrefix,
        refHash
      );
      await provider.sendAndConfirm(approveTx, [verifier]);

      prefixAccount = await sdk.getPrefixAccount(testPrefix);
      expect(prefixAccount.status).to.deep.equal({ active: {} });

      // 3. Update metadata (should set back to pending)
      const newMetadataUri = "https://example.com/lifecycle-updated.json";
      const newMetadataHash = new Array(32).fill(9);
      const newMetadataHashBytes = new Uint8Array(newMetadataHash);
      const updateSignature = createEd25519Signature(
        owner,
        newMetadataHashBytes
      );
      const updateTx = await sdk.updatePrefixMetadata(
        owner.publicKey,
        testPrefix,
        newMetadataUri,
        newMetadataHash,
        updateSignature
      );
      await provider.sendAndConfirm(updateTx, [owner]);

      prefixAccount = await sdk.getPrefixAccount(testPrefix);
      expect(prefixAccount.status).to.deep.equal({ pending: {} });

      // 4. Approve again
      const newRefHash = new Array(32).fill(10);
      const approveTx2 = await sdk.approvePrefix(
        verifier.publicKey,
        testPrefix,
        newRefHash
      );
      await provider.sendAndConfirm(approveTx2, [verifier]);

      prefixAccount = await sdk.getPrefixAccount(testPrefix);
      expect(prefixAccount.status).to.deep.equal({ active: {} });
    });
  });

  describe("🔧 Validation Functions", () => {
    describe("validatePrefix", () => {
      it("Should accept valid prefixes", () => {
        expect(() => validatePrefix("ABC")).to.not.throw();
        expect(() => validatePrefix("TEST123")).to.not.throw();
        expect(() => validatePrefix("A1B2C3D4E5F6")).to.not.throw();
        expect(() => validatePrefix("XYZ")).to.not.throw();
        expect(() => validatePrefix("123")).to.not.throw();
      });

      it("Should reject prefixes that are too short", () => {
        expect(() => validatePrefix("AB")).to.throw(PrefixSystemClientError);
        expect(() => validatePrefix("A")).to.throw(PrefixSystemClientError);
        expect(() => validatePrefix("")).to.throw(PrefixSystemClientError, "Invalid prefix: must be between 3 and 12 characters");
      });

      it("Should reject prefixes that are too long", () => {
        expect(() => validatePrefix("ABCDEFGHIJKLM")).to.throw(PrefixSystemClientError, "Invalid prefix: must be between 3 and 12 characters");
        expect(() => validatePrefix("A1B2C3D4E5F6G7")).to.throw(PrefixSystemClientError, "Invalid prefix: must be between 3 and 12 characters");
      });

      it("Should reject prefixes with invalid characters", () => {
        expect(() => validatePrefix("abc")).to.throw(PrefixSystemClientError, "Invalid prefix: must be alphanumeric and between 3 and 12 characters");
        expect(() => validatePrefix("TEST-123")).to.throw(PrefixSystemClientError, "Invalid prefix: must be alphanumeric and between 3 and 12 characters");
        expect(() => validatePrefix("TEST_123")).to.throw(PrefixSystemClientError, "Invalid prefix: must be alphanumeric and between 3 and 12 characters");
        expect(() => validatePrefix("TEST.123")).to.throw(PrefixSystemClientError, "Invalid prefix: must be alphanumeric and between 3 and 12 characters");
        expect(() => validatePrefix("TEST 123")).to.throw(PrefixSystemClientError, "Invalid prefix: must be alphanumeric and between 3 and 12 characters");
        expect(() => validatePrefix("TEST@123")).to.throw(PrefixSystemClientError, "Invalid prefix: must be alphanumeric and between 3 and 12 characters");
      });
    });

    describe("validateMetadataUri", () => {
      it("Should accept valid HTTPS URIs", () => {
        expect(() => validateMetadataUri("https://example.com/metadata.json")).to.not.throw();
        expect(() => validateMetadataUri("https://api.example.com/v1/metadata")).to.not.throw();
        expect(() => validateMetadataUri("https://subdomain.example.com/path/to/metadata.json")).to.not.throw();
      });

      it("Should accept valid IPFS URIs", () => {
        expect(() => validateMetadataUri("ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG")).to.not.throw();
        expect(() => validateMetadataUri("ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi")).to.not.throw();
      });

      it("Should reject URIs that don't start with https:// or ipfs://", () => {
        expect(() => validateMetadataUri("http://example.com/metadata.json")).to.throw(PrefixSystemClientError, "Invalid metadata URI: must start with https:// or ipfs://");
        expect(() => validateMetadataUri("ftp://example.com/metadata.json")).to.throw(PrefixSystemClientError, "Invalid metadata URI: must start with https:// or ipfs://");
        expect(() => validateMetadataUri("example.com/metadata.json")).to.throw(PrefixSystemClientError, "Invalid metadata URI: must start with https:// or ipfs://");
        expect(() => validateMetadataUri("/path/to/metadata.json")).to.throw(PrefixSystemClientError, "Invalid metadata URI: must start with https:// or ipfs://");
        expect(() => validateMetadataUri("metadata.json")).to.throw(PrefixSystemClientError, "Invalid metadata URI: must start with https:// or ipfs://");
      });

      it("Should reject URIs that are too long", () => {
        const longUri = "https://" + "a".repeat(249) + ".com";
        expect(() => validateMetadataUri(longUri)).to.throw(PrefixSystemClientError, "Invalid metadata URI: exceeds MAX_URI_LEN characters (255)");
      });

      it("Should accept URIs at the maximum length", () => {
        const maxUri = "https://" + "a".repeat(243) + ".com";
        expect(() => validateMetadataUri(maxUri)).to.not.throw();
      });
    });

    describe("validateMetadataHash", () => {
      it("Should accept valid 32-byte hashes as number arrays", () => {
        const validHash = new Array(32).fill(1);
        expect(() => validateMetadataHash(validHash)).to.not.throw();
        
        const validHash2 = Array.from({ length: 32 }, (_, i) => i);
        expect(() => validateMetadataHash(validHash2)).to.not.throw();
      });

      it("Should accept valid 32-byte hashes as Uint8Array", () => {
        const validHash = new Uint8Array(32);
        expect(() => validateMetadataHash(validHash)).to.not.throw();
        
        const validHash2 = new Uint8Array(32).fill(255);
        expect(() => validateMetadataHash(validHash2)).to.not.throw();
      });

      it("Should reject hashes that are too short", () => {
        const shortHash = new Array(31).fill(1);
        expect(() => validateMetadataHash(shortHash)).to.throw(PrefixSystemClientError, "Invalid metadata hash: must be exactly 32 bytes");
        
        const shortHash2 = new Uint8Array(31);
        expect(() => validateMetadataHash(shortHash2)).to.throw(PrefixSystemClientError, "Invalid metadata hash: must be exactly 32 bytes");
      });

      it("Should reject hashes that are too long", () => {
        const longHash = new Array(33).fill(1);
        expect(() => validateMetadataHash(longHash)).to.throw(PrefixSystemClientError, "Invalid metadata hash: must be exactly 32 bytes");
        
        const longHash2 = new Uint8Array(33);
        expect(() => validateMetadataHash(longHash2)).to.throw(PrefixSystemClientError, "Invalid metadata hash: must be exactly 32 bytes");
      });

      it("Should reject empty hashes", () => {
        expect(() => validateMetadataHash([])).to.throw(PrefixSystemClientError, "Invalid metadata hash: must be exactly 32 bytes");
        expect(() => validateMetadataHash(new Uint8Array(0))).to.throw(PrefixSystemClientError, "Invalid metadata hash: must be exactly 32 bytes");
      });
    });
  });
});
