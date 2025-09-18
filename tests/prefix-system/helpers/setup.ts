import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, Ed25519Program } from "@solana/web3.js";
import { PrefixSystem } from "../../../target/types/prefix_system";
import * as nacl from "tweetnacl";

export interface TestContext {
  provider: AnchorProvider;
  connection: anchor.web3.Connection;
  program: Program<PrefixSystem>;
  payer: Keypair;
  admin: Keypair;
  feeRegistryPDA: PublicKey;
  treasuryPDA: PublicKey;
  verifiersPDA: PublicKey;
}

export const FEE_REGISTRY_SEED = "fee_registry";
export const VERIFIERS_SEED = "verifiers";
export const TREASURY_SEED = "treasury";
export const PREFIX_SEED = "prefix";

export async function initProviderAndProgram(): Promise<TestContext> {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);

  const program = anchor.workspace.PrefixSystem as Program<PrefixSystem>;

  const payer = anchor.web3.Keypair.generate();
  const admin = anchor.web3.Keypair.generate();

  await airdrop(provider, payer.publicKey, 10);
  await airdrop(provider, admin.publicKey, 10);

  // PDAs
  const [feeRegistryPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(FEE_REGISTRY_SEED)],
    program.programId
  );

  const [verifiersPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(VERIFIERS_SEED)],
    program.programId
  );

  const [treasuryPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(TREASURY_SEED), feeRegistryPDA.toBuffer()],
    program.programId
  );

  return {
    provider,
    connection: provider.connection,
    program,
    payer,
    admin,
    feeRegistryPDA,
    treasuryPDA,
    verifiersPDA,
  };
}

// Helper: Airdrop SOL
export async function airdrop(
  provider: AnchorProvider,
  pubkey: PublicKey,
  sol: number
) {
  const sig = await provider.connection.requestAirdrop(pubkey, sol * 1e9);
  await provider.connection.confirmTransaction(sig, "confirmed");
}

// Derive Prefix PDA
export async function derivePrefixPDA(programId: PublicKey, prefix: string) {
  // Normalize prefix the same way as the contract (uppercase only, no trim)
  const normalized = prefix.toUpperCase();
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(PREFIX_SEED), Buffer.from(normalized)],
    programId
  );
  return pda;
}

// Fetch prefix account
export async function fetchPrefixAccount(ctx: TestContext, prefix: string) {
  const pda = await derivePrefixPDA(ctx.program.programId, prefix);
  return ctx.program.account.prefixAccount.fetch(pda);
}

// Helper: Initialize the program
export async function initializeProgram(
  ctx: TestContext,
  initialFee: number = 1000000
) {
  return ctx.program.methods
    .initialize(ctx.admin.publicKey, new anchor.BN(initialFee))
    .accountsStrict({
      feeRegistry: ctx.feeRegistryPDA,
      verifiers: ctx.verifiersPDA,
      treasury: ctx.treasuryPDA,
      payer: ctx.payer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([ctx.payer])
    .rpc();
}

// Helper: Add verifier
export async function addVerifier(ctx: TestContext, verifier: PublicKey) {
  return ctx.program.methods
    .addVerifier(verifier)
    .accountsStrict({
      verifiers: ctx.verifiersPDA,
      feeRegistry: ctx.feeRegistryPDA,
      admin: ctx.admin.publicKey,
    })
    .signers([ctx.admin])
    .rpc();
}

// Helper: Create Ed25519 signature instruction using proper Ed25519Program
export function createEd25519SignatureInstruction(
  signer: Keypair,
  message: Uint8Array
): anchor.web3.TransactionInstruction {
  const signature = nacl.sign.detached(message, signer.secretKey);

  // Use the proper Ed25519Program.createInstructionWithPublicKey method
  return Ed25519Program.createInstructionWithPublicKey({
    publicKey: signer.publicKey.toBytes(),
    message: message,
    signature: signature,
  });
}

// Helper: Submit prefix with fee
export async function submitPrefixWithFee(
  ctx: TestContext,
  prefix: string,
  owner: Keypair,
  metadataUri: string = "https://example.com/metadata",
  metadataHash: number[] = Array(32).fill(1),
  authorityKeys: PublicKey[] = []
) {
  // Create Ed25519 signature over metadata_hash
  const ed25519Ix = createEd25519SignatureInstruction(
    owner,
    new Uint8Array(metadataHash)
  );

  return ctx.program.methods
    .submitPrefixWithFee(prefix, metadataUri, metadataHash, authorityKeys)
    .accountsStrict({
      owner: owner.publicKey,
      feeRegistry: ctx.feeRegistryPDA,
      treasury: ctx.treasuryPDA,
      prefixAccount: await derivePrefixPDA(ctx.program.programId, prefix),
      instructionsSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .preInstructions([ed25519Ix])
    .signers([owner])
    .rpc();
}

// Helper: Approve prefix
export async function approvePrefix(
  ctx: TestContext,
  prefix: string,
  verifier: Keypair,
  refHash: number[] = Array(32).fill(2)
) {
  return ctx.program.methods
    .approvePrefix(prefix, refHash)
    .accountsStrict({
      prefixAccount: await derivePrefixPDA(ctx.program.programId, prefix),
      verifiers: ctx.verifiersPDA,
      feeRegistry: ctx.feeRegistryPDA,
      treasury: ctx.treasuryPDA,
      verifier: verifier.publicKey,
    })
    .signers([verifier])
    .rpc();
}

// Helper: Reject prefix
export async function rejectPrefix(
  ctx: TestContext,
  prefix: string,
  verifier: Keypair,
  reason: string = "Invalid metadata"
) {
  return ctx.program.methods
    .rejectPrefix(prefix, reason)
    .accountsStrict({
      prefixAccount: await derivePrefixPDA(ctx.program.programId, prefix),
      verifiers: ctx.verifiersPDA,
      feeRegistry: ctx.feeRegistryPDA,
      verifier: verifier.publicKey,
    })
    .signers([verifier])
    .rpc();
}

// Helper: Refund prefix fee
export async function refundPrefixFee(
  ctx: TestContext,
  prefix: string,
  owner: Keypair
) {
  return ctx.program.methods
    .refundPrefixFee(prefix)
    .accountsStrict({
      owner: owner.publicKey,
      feeRegistry: ctx.feeRegistryPDA,
      treasury: ctx.treasuryPDA,
      prefixAccount: await derivePrefixPDA(ctx.program.programId, prefix),
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([owner])
    .rpc();
}

// Helper: Update fee
export async function updateFee(ctx: TestContext, newFee: number) {
  return ctx.program.methods
    .updateFee(new anchor.BN(newFee))
    .accountsStrict({
      feeRegistry: ctx.feeRegistryPDA,
      admin: ctx.admin.publicKey,
    })
    .signers([ctx.admin])
    .rpc();
}

// Helper: Set pause
export async function setPause(ctx: TestContext, pause: boolean) {
  return ctx.program.methods
    .setPause(pause)
    .accountsStrict({
      feeRegistry: ctx.feeRegistryPDA,
      admin: ctx.admin.publicKey,
    })
    .signers([ctx.admin])
    .rpc();
}

// Helper: Withdraw treasury
export async function withdrawTreasury(
  ctx: TestContext,
  amount: number,
  to: PublicKey
) {
  return ctx.program.methods
    .withdrawTreasury(new anchor.BN(amount), to)
    .accountsStrict({
      feeRegistry: ctx.feeRegistryPDA,
      treasury: ctx.treasuryPDA,
      to: to,
      systemProgram: anchor.web3.SystemProgram.programId,
      admin: ctx.admin.publicKey,
    })
    .signers([ctx.admin])
    .rpc();
}

// Helper: Get treasury balance
export async function getTreasuryBalance(ctx: TestContext) {
  const account = await ctx.connection.getAccountInfo(ctx.treasuryPDA);
  return account ? account.lamports : 0;
}

// Helper: Get fee registry
export async function getFeeRegistry(ctx: TestContext) {
  return ctx.program.account.feeRegistry.fetch(ctx.feeRegistryPDA);
}

// Helper: Update prefix metadata
export async function updatePrefixMetadata(
  ctx: TestContext,
  prefix: string,
  owner: Keypair,
  newUri: string,
  newHash: number[]
) {
  const ed25519Ix = createEd25519SignatureInstruction(
    owner,
    new Uint8Array(newHash)
  );

  return ctx.program.methods
    .updatePrefixMetadata(prefix, newUri, newHash)
    .accountsStrict({
      owner: owner.publicKey,
      prefixAccount: await derivePrefixPDA(ctx.program.programId, prefix),
      instructionsSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
    })
    .preInstructions([ed25519Ix])
    .signers([owner])
    .rpc();
}

// Helper: Update prefix authority
export async function updatePrefixAuthority(
  ctx: TestContext,
  prefix: string,
  owner: Keypair,
  authorityKeys: PublicKey[]
) {
  return ctx.program.methods
    .updatePrefixAuthority(prefix, authorityKeys)
    .accountsStrict({
      owner: owner.publicKey,
      prefixAccount: await derivePrefixPDA(ctx.program.programId, prefix),
    })
    .signers([owner])
    .rpc();
}

// Helper: Deactivate prefix
export async function deactivatePrefix(ctx: TestContext, prefix: string) {
  return ctx.program.methods
    .deactivatePrefix(prefix)
    .accountsStrict({
      admin: ctx.admin.publicKey,
      feeRegistry: ctx.feeRegistryPDA,
      prefixAccount: await derivePrefixPDA(ctx.program.programId, prefix),
    })
    .signers([ctx.admin])
    .rpc();
}

// Helper: Reactivate prefix
export async function reactivatePrefix(ctx: TestContext, prefix: string) {
  return ctx.program.methods
    .reactivatePrefix(prefix)
    .accountsStrict({
      admin: ctx.admin.publicKey,
      feeRegistry: ctx.feeRegistryPDA,
      prefixAccount: await derivePrefixPDA(ctx.program.programId, prefix),
    })
    .signers([ctx.admin])
    .rpc();
}

// Helper: Recover prefix owner with fee
export async function recoverPrefixOwnerWithFee(
  ctx: TestContext,
  prefix: string,
  newOwner: Keypair
) {
  return ctx.program.methods
    .recoverPrefixOwnerWithFee(prefix, newOwner.publicKey)
    .accountsStrict({
      newOwner: newOwner.publicKey,
      admin: ctx.admin.publicKey,
      feeRegistry: ctx.feeRegistryPDA,
      treasury: ctx.treasuryPDA,
      prefixAccount: await derivePrefixPDA(ctx.program.programId, prefix),
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([newOwner, ctx.admin])
    .rpc();
}

// Helper: Remove verifier
export async function removeVerifier(ctx: TestContext, verifier: PublicKey) {
  return ctx.program.methods
    .removeVerifier(verifier)
    .accountsStrict({
      verifiers: ctx.verifiersPDA,
      feeRegistry: ctx.feeRegistryPDA,
      admin: ctx.admin.publicKey,
    })
    .signers([ctx.admin])
    .rpc();
}

// Helper: Get verifiers list
export async function getVerifiersList(ctx: TestContext) {
  return ctx.program.account.verifiersList.fetch(ctx.verifiersPDA);
}

// Export everything for tests
export default {
  initProviderAndProgram,
  airdrop,
  derivePrefixPDA,
  fetchPrefixAccount,
  initializeProgram,
  addVerifier,
  removeVerifier,
  getVerifiersList,
  submitPrefixWithFee,
  approvePrefix,
  rejectPrefix,
  refundPrefixFee,
  updateFee,
  setPause,
  withdrawTreasury,
  getTreasuryBalance,
  getFeeRegistry,
  updatePrefixMetadata,
  updatePrefixAuthority,
  deactivatePrefix,
  reactivatePrefix,
  recoverPrefixOwnerWithFee,
};
