#!/usr/bin/env ts-node

import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { PrefixSystemClient } from "../sdk/src/client";

const FEE_REGISTRY_SEED = "fee_registry";
const VERIFIERS_SEED = "verifiers";
const TREASURY_SEED = "treasury";

async function main() {
  // Get arguments
  const args = process.argv.slice(2);
  const adminPublicKey = args[0];
  const initialFee = parseInt(args[1]) || 1000000;

  if (!adminPublicKey) {
    console.log("Usage: ts-node init.ts <admin-public-key> [initial-fee]");
    process.exit(1);
  }

  try {
    // Setup provider
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const client = new PrefixSystemClient({
      cluster: "devnet",
      connection: provider.connection,
      wallet: anchor.Wallet.local(),
    });
    const adminPubkey = new PublicKey(adminPublicKey);

    // Check if already initialized
    try {
      const existingFeeRegistry = await client.getFeeRegistry();
      console.log("⚠️  Program is already initialized!");
      console.log(
        `📦 Fee Registry: ${JSON.stringify(existingFeeRegistry, null, 2)}`
      );
      console.log(`📦 Treasury: ${JSON.stringify(await client.getTreasury(), null, 2)}`);
      console.log(`👥 Verifiers List: ${JSON.stringify(await client.getVerifiersList(), null, 2)}`);
      console.log(`🏦 Treasury: ${JSON.stringify(await client.getTreasury(), null, 2)}`);
      return;
    } catch (error) {
      // Account doesn't exist, which is expected for initialization
      console.log("🔧 Initializing prefix-system program...");
    }

    console.log(`📋 Admin: ${adminPubkey.toString()}`);
    console.log(`💰 Initial Fee: ${initialFee} lamports`);

    const tx = await client.initialize(adminPubkey, initialFee);

    console.log(`✅ Program initialized successfully!`);
    console.log(`📝 Transaction signature: ${tx}`);
    console.log(
      `🔗 Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet`
    );
  } catch (error) {
    console.error("❌ Error initializing program:");
    console.error("Full error:", error);
    console.error("Error message:", error.message);
    if (error.logs) {
      console.error("Program logs:", error.logs);
    }
    process.exit(1);
  }
}

main().catch(console.error);
