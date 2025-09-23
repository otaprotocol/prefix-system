import {
  Cluster,
  Connection,
  PublicKey,
  Commitment,
  Keypair,
  SystemProgram,
  Transaction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Ed25519Program,
} from "@solana/web3.js";
import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";

import type { PrefixSystem } from "./idl/prefix_system";
import IDL from "./idl/prefix_system.json";

import {
  FEE_REGISTRY_SEED,
  VERIFIERS_SEED,
  TREASURY_SEED,
  PREFIX_SEED,
  MAX_AUTH_KEYS,
} from "./constants.js";
import { FeeRegistry, PrefixAccount, Treasury, VerifiersList } from "./types";
import {
  validateMetadataHash,
  validateMetadataUri,
  validatePrefix,
} from "./validation";
import { PrefixSystemClientError } from "./errors";

export interface PrefixSystemClientConfig {
  cluster: Cluster;
  connection: Connection;
  wallet: Wallet;
  programId?: PublicKey; // if provided, this is custom program deployment for testing
  defaultCommitment?: Commitment;
}

export class PrefixSystemClient {
  private _program: Program<PrefixSystem>;
  private anchorProvider: AnchorProvider;
  private staticPdas: {
    feeRegistry: PublicKey;
    verifiers: PublicKey;
    treasury: PublicKey;
  };

  constructor(config: PrefixSystemClientConfig) {
    const { connection, wallet, programId, defaultCommitment } = config;
    this.anchorProvider = new AnchorProvider(connection, wallet, {
      commitment: defaultCommitment || "confirmed",
    });

    // if programId is provided, this is custom program deployment for testing
    const idlWithProgramId = {
      ...IDL,
      address: programId?.toString() || IDL.address,
    };

    this._program = new Program(
      idlWithProgramId as PrefixSystem,
      this.anchorProvider
    );

    // Calculate PDAs in order since treasury depends on feeRegistry
    const feeRegistry = PublicKey.findProgramAddressSync(
      [Buffer.from(FEE_REGISTRY_SEED)],
      this._program.programId
    )[0];

    const verifiers = PublicKey.findProgramAddressSync(
      [Buffer.from(VERIFIERS_SEED)],
      this._program.programId
    )[0];

    const treasury = PublicKey.findProgramAddressSync(
      [Buffer.from(TREASURY_SEED), feeRegistry.toBuffer()],
      this._program.programId
    )[0];

    this.staticPdas = {
      feeRegistry,
      verifiers,
      treasury,
    };
  }

  /**
   * Initialize the client for testing
   * @param connection - The connection to use for the client
   * @param keypair - The keypair to use for the client
   * @param programId - The program id to use for the client
   * @returns The client
   */
  static initForTesting(
    connection?: Connection,
    keypair?: Keypair,
    programId?: PublicKey
  ): PrefixSystemClient {
    const testConnection =
      connection || new Connection("http://127.0.0.1:8899");
    const testKeypair = keypair || Keypair.generate();
    const wallet = new Wallet(testKeypair);

    return new PrefixSystemClient({
      cluster: "localnet" as Cluster,
      connection: testConnection,
      wallet,
      programId,
      defaultCommitment: "confirmed",
    });
  }

  public get program(): Program<PrefixSystem> {
    return this._program;
  }

  public get programId(): PublicKey {
    return this._program.programId;
  }

  /**
   * Get accounts
   */
  public async getFeeRegistry(): Promise<FeeRegistry> {
    return this._program.account.feeRegistry.fetch(this.staticPdas.feeRegistry);
  }

  public async getVerifiersList(): Promise<VerifiersList> {
    return this._program.account.verifiersList.fetch(this.staticPdas.verifiers);
  }

  public async getTreasury(): Promise<Treasury | null> {
    return this._program.provider.connection.getAccountInfo(
      this.staticPdas.treasury
    );
  }

  public async getPrefixAccount(prefix: string): Promise<PrefixAccount | null> {
    validatePrefix(prefix);

    try {
      return this._program.account.prefixAccount.fetch(
        this.getPrefixPda(prefix)
      ) as unknown as PrefixAccount;
    } catch {
      return null;
    }
  }

  // !!!! Admin functions !!!!
  /**
   * Initialize the prefix system
   * @param adminPublicKey public key of the admin who will be the admin of the prefix system
   * @param initialFee lamports
   * @returns unsigned transaction
   */
  public async initialize(
    adminPublicKey: PublicKey,
    initialFee: number
  ): Promise<Transaction> {
    const tx = await this._program.methods
      .initialize(adminPublicKey, new BN(initialFee))
      .accountsStrict({
        payer: this.anchorProvider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
        feeRegistry: this.staticPdas.feeRegistry,
        verifiers: this.staticPdas.verifiers,
        treasury: this.staticPdas.treasury,
      })
      .signers([this.anchorProvider.wallet.payer!])
      .transaction();

    return tx;
  }

  /**
   * Add a verifier to the verifiers list
   * @param adminPublicKey public key of the admin who will be the admin of the prefix system
   * @param verifierPublicKey public key of the verifier to add
   * @returns unsigned transaction
   */
  public async addVerifier(
    adminPublicKey: PublicKey,
    verifierPublicKey: PublicKey
  ): Promise<Transaction> {
    const tx = await this._program.methods
      .addVerifier(verifierPublicKey)
      .accountsStrict({
        admin: adminPublicKey,
        verifiers: this.staticPdas.verifiers,
        feeRegistry: this.staticPdas.feeRegistry,
      })
      .signers([this.anchorProvider.wallet.payer!])
      .transaction();

    return tx;
  }

  /**
   * Remove a verifier from the verifiers list
   * @param adminPublicKey public key of the admin who will be the admin of the prefix system
   * @param verifierPublicKey public key of the verifier to remove
   * @returns unsigned transaction
   */
  public async removeVerifier(
    adminPublicKey: PublicKey,
    verifierPublicKey: PublicKey
  ): Promise<Transaction> {
    const tx = await this._program.methods
      .removeVerifier(verifierPublicKey)
      .accountsStrict({
        admin: adminPublicKey,
        verifiers: this.staticPdas.verifiers,
        feeRegistry: this.staticPdas.feeRegistry,
      })
      .signers([this.anchorProvider.wallet.payer!])
      .transaction();

    return tx;
  }

  /**
   * Update the fee for the prefix system
   * @param adminPublicKey public key of the admin who will be the admin of the prefix system
   * @param newFee the new fee to set
   * @returns unsigned transaction
   */
  public async updateFee(
    adminPublicKey: PublicKey,
    newFee: number
  ): Promise<Transaction> {
    const tx = await this._program.methods
      .updateFee(new BN(newFee))
      .accountsStrict({
        admin: adminPublicKey,
        feeRegistry: this.staticPdas.feeRegistry,
      })
      .signers([this.anchorProvider.wallet.payer!])
      .transaction();

    return tx;
  }

  /**
   * Withdraw from the treasury
   * @param adminPublicKey public key of the admin who will be the admin of the prefix system
   * @param amount the amount to withdraw
   * @param toPublicKey public key of the account to withdraw to
   * @returns unsigned transaction
   */
  public async withdrawTreasury(
    adminPublicKey: PublicKey,
    amount: number,
    toPublicKey: PublicKey
  ): Promise<Transaction> {
    const tx = await this._program.methods
      .withdrawTreasury(new BN(amount), toPublicKey)
      .accountsStrict({
        admin: adminPublicKey,
        treasury: this.staticPdas.treasury,
        to: toPublicKey,
        feeRegistry: this.staticPdas.feeRegistry,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.anchorProvider.wallet.payer!])
      .transaction();

    return tx;
  }

  // !!! Prefix functions for admin authority !!!!
  /**
   * Approve a prefix
   * @param adminPublicKey public key of the admin who will be the admin of the prefix system
   * @param prefix the prefix to approve
   * @param refHash the reference hash to approve the prefix with
   * @returns unsigned transaction
   */
  public async approvePrefix(
    adminPublicKey: PublicKey,
    prefix: string,
    refHash: Array<number>
  ): Promise<Transaction> {
    validatePrefix(prefix);

    const tx = await this._program.methods
      .approvePrefix(prefix, refHash)
      .accountsStrict({
        verifier: adminPublicKey,
        feeRegistry: this.staticPdas.feeRegistry,
        verifiers: this.staticPdas.verifiers,
        prefixAccount: this.getPrefixPda(prefix),
        treasury: this.staticPdas.treasury,
      })
      .signers([this.anchorProvider.wallet.payer!])
      .transaction();

    return tx;
  }

  /**
   * Reject a prefix
   * @param adminPublicKey public key of the admin who will be the admin of the prefix system
   * @param prefix the prefix to reject
   * @param reason the reason for rejecting the prefix
   * @returns unsigned transaction
   */
  public async rejectPrefix(
    adminPublicKey: PublicKey,
    prefix: string,
    reason: string
  ): Promise<Transaction> {
    validatePrefix(prefix);

    const tx = await this._program.methods
      .rejectPrefix(prefix, reason)
      .accountsStrict({
        verifier: adminPublicKey,
        feeRegistry: this.staticPdas.feeRegistry,
        verifiers: this.staticPdas.verifiers,
        prefixAccount: this.getPrefixPda(prefix),
      })
      .signers([this.anchorProvider.wallet.payer!])
      .transaction();

    return tx;
  }

  /**
   * Deactivate a prefix
   * @param adminPublicKey public key of the admin who will be the admin of the prefix system
   * @param prefix the prefix to deactivate
   * @returns unsigned transaction
   */
  public async deactivatePrefix(
    adminPublicKey: PublicKey,
    prefix: string
  ): Promise<Transaction> {
    validatePrefix(prefix);

    const tx = await this._program.methods
      .deactivatePrefix(prefix)
      .accountsStrict({
        admin: adminPublicKey,
        feeRegistry: this.staticPdas.feeRegistry,
        prefixAccount: this.getPrefixPda(prefix),
      })
      .signers([this.anchorProvider.wallet.payer!])
      .transaction();

    return tx;
  }

  /**
   * Reactivate a prefix
   * @param adminPublicKey public key of the admin who will be the admin of the prefix system
   * @param prefix the prefix to reactivate
   * @returns unsigned transaction
   */
  public async reactivatePrefix(
    adminPublicKey: PublicKey,
    prefix: string
  ): Promise<Transaction> {
    validatePrefix(prefix);

    const tx = await this._program.methods
      .reactivatePrefix(prefix)
      .accountsStrict({
        admin: adminPublicKey,
        feeRegistry: this.staticPdas.feeRegistry,
        prefixAccount: this.getPrefixPda(prefix),
      })
      .signers([this.anchorProvider.wallet.payer!])
      .transaction();

    return tx;
  }

  /**
   * Refund the fee for a prefix
   * @param adminPublicKey public key of the admin who will be the admin of the prefix system
   * @param prefix the prefix to refund the fee for
   * @returns unsigned transaction
   */
  public async refundPrefixFee(
    adminPublicKey: PublicKey,
    prefix: string
  ): Promise<Transaction> {
    validatePrefix(prefix);

    const tx = await this._program.methods
      .refundPrefixFee(prefix)
      .accountsStrict({
        owner: adminPublicKey,
        prefixAccount: this.getPrefixPda(prefix),
        treasury: this.staticPdas.treasury,
        feeRegistry: this.staticPdas.feeRegistry,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.anchorProvider.wallet.payer!])
      .transaction();

    return tx;
  }

  /**
   * Recover the owner of a prefix with a fee
   * @param adminPublicKey public key of the admin who will be the admin of the prefix system
   * @param prefix the prefix to recover the owner for
   * @param newOwner the new owner to set
   * @returns unsigned transaction
   */
  public async recoverPrefixOwnerWithFee(
    adminPublicKey: PublicKey,
    prefix: string,
    newOwner: PublicKey
  ): Promise<Transaction> {
    validatePrefix(prefix);

    const tx = await this._program.methods
      .recoverPrefixOwnerWithFee(prefix, newOwner)
      .accountsStrict({
        newOwner: newOwner,
        admin: adminPublicKey,
        feeRegistry: this.staticPdas.feeRegistry,
        treasury: this.staticPdas.treasury,
        prefixAccount: this.getPrefixPda(prefix),
        systemProgram: SystemProgram.programId,
      })
      .signers([this.anchorProvider.wallet.payer!])
      .transaction();

    return tx;
  }

  // !!! Prefix functions for user/owner authority !!!!
  /**
   * Submit a prefix with a fee
   * @param ownerPublicKey public key of the owner who will be the owner of the prefix
   * @param prefix the prefix to submit
   * @param fee the fee to submit
   * @returns unsigned transaction
   */
  public async submitPrefixWithFee(
    ownerPublicKey: PublicKey,
    prefix: string,
    metadataUri: string,
    metadataHash: Array<number>,
    signatureOverMetadataHash: Array<number>,
    authorityKeys: Array<PublicKey>
  ): Promise<Transaction> {
    validateMetadataUri(metadataUri);
    validateMetadataHash(metadataHash);

    // Create Ed25519 signature over metadata_hash
    const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
      publicKey: ownerPublicKey.toBytes(),
      message: new Uint8Array(metadataHash),
      signature: new Uint8Array(signatureOverMetadataHash),
    });

    const tx = await this._program.methods
      .submitPrefixWithFee(prefix, metadataUri, metadataHash, authorityKeys)
      .accountsStrict({
        owner: ownerPublicKey,
        feeRegistry: this.staticPdas.feeRegistry,
        treasury: this.staticPdas.treasury,
        prefixAccount: this.getPrefixPda(prefix),
        instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([ed25519Ix])
      .signers([this.anchorProvider.wallet.payer!])
      .transaction();

    return tx;
  }

  /**
   * Update the metadata for a prefix
   * @param ownerPublicKey public key of the owner who will be the owner of the prefix
   * @param prefix the prefix to update the metadata for
   * @param newMetadataUri the new metadata URI
   * @param newMetadataHash the new metadata hash
   * @returns unsigned transaction
   */
  public async updatePrefixMetadata(
    ownerPublicKey: PublicKey,
    prefix: string,
    newMetadataUri: string,
    newMetadataHash: Array<number>,
    signatureOverMetadataHash: Array<number>
  ): Promise<Transaction> {
    validatePrefix(prefix);
    validateMetadataUri(newMetadataUri);
    validateMetadataHash(newMetadataHash);

    // Create Ed25519 signature over metadata_hash
    const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
      publicKey: ownerPublicKey.toBytes(),
      message: new Uint8Array(newMetadataHash),
      signature: new Uint8Array(signatureOverMetadataHash),
    });

    const tx = await this._program.methods
      .updatePrefixMetadata(prefix, newMetadataUri, newMetadataHash)
      .accountsStrict({
        owner: ownerPublicKey,
        prefixAccount: this.getPrefixPda(prefix),
        instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .preInstructions([ed25519Ix])
      .signers([this.anchorProvider.wallet.payer!])
      .transaction();

    return tx;
  }

  /**
   * Update the authority keys for a prefix
   * @param ownerPublicKey public key of the owner who will be the owner of the prefix
   * @param prefix the prefix to update the authority keys for
   * @param authorityKeys the new authority keys
   * @returns unsigned transaction
   */
  public async updatePrefixAuthorityKeys(
    ownerPublicKey: PublicKey,
    prefix: string,
    authorityKeys: Array<PublicKey>
  ): Promise<Transaction> {
    validatePrefix(prefix);

    if (authorityKeys.length > MAX_AUTH_KEYS) {
      throw new PrefixSystemClientError("Too many authority keys");
    }

    if (
      new Set(authorityKeys.map((k) => k.toBase58())).size !==
      authorityKeys.length
    ) {
      throw new PrefixSystemClientError("Duplicate authority keys");
    }

    const tx = await this._program.methods
      .updatePrefixAuthority(prefix, authorityKeys)
      .accountsStrict({
        owner: ownerPublicKey,
        prefixAccount: this.getPrefixPda(prefix),
      })
      .signers([this.anchorProvider.wallet.payer!])
      .transaction();

    return tx;
  }

  /**
   * Get the PDA for a prefix
   * @param prefix the prefix to get the PDA for
   * @returns the PDA for the prefix
   */
  public getPrefixPda(prefix: string): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(PREFIX_SEED), Buffer.from(prefix.toUpperCase())],
      this._program.programId
    )[0];
  }
}
