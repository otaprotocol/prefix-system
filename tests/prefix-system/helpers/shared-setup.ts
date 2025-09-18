import { Keypair } from "@solana/web3.js";
import { TestContext, initProviderAndProgram, initializeProgram, addVerifier } from "./setup";

// Shared test setup that both fee and prefix tests can use
let sharedContext: TestContext | null = null;
let sharedVerifier: Keypair | null = null;
let sharedOwner: Keypair | null = null;

export async function getSharedTestContext(): Promise<{
  ctx: TestContext;
  verifier: Keypair;
  owner: Keypair;
}> {
  if (sharedContext) {
    return {
      ctx: sharedContext,
      verifier: sharedVerifier!,
      owner: sharedOwner!,
    };
  }

  // Create shared context
  sharedContext = await initProviderAndProgram();
  sharedVerifier = Keypair.generate();
  sharedOwner = Keypair.generate();

  // Airdrop SOL
  const { airdrop } = await import("./setup");
  await airdrop(sharedContext.provider, sharedVerifier.publicKey, 5);
  await airdrop(sharedContext.provider, sharedOwner.publicKey, 5);

  // Initialize program
  await initializeProgram(sharedContext, 1000000);
  await addVerifier(sharedContext, sharedVerifier.publicKey);

  return {
    ctx: sharedContext,
    verifier: sharedVerifier,
    owner: sharedOwner,
  };
}
