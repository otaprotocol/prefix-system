#!/usr/bin/env ts-node

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("9VoBu2F7g4HcQKS4uSpHFbTs1158bgwNDzVxBDDM2ztQ");

async function queryProgramAccounts() {
  // Setup connection
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Setup provider and program
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.PrefixSystem;

  console.log("🔍 Querying program accounts...");
  console.log(`📦 Program ID: ${PROGRAM_ID.toString()}`);

  try {
    // Get all program-owned accounts
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      commitment: "confirmed",
    });

    console.log(`\n📊 Found ${accounts.length} program-owned accounts\n`);

    for (let i = 0; i < accounts.length; i++) {
      const { pubkey, account } = accounts[i];
      console.log(`--- Account ${i + 1} ---`);
      console.log(`📍 Address: ${pubkey.toString()}`);
      console.log(`💰 Lamports: ${account.lamports}`);
      console.log(`🔑 Owner: ${account.owner.toString()}`);
      console.log(`📏 Data Length: ${account.data.length} bytes`);

      // Try to decode as different account types
      try {
        // Try FeeRegistry
        const feeRegistry = await program.account.feeRegistry.fetch(pubkey);
        console.log(`📋 Type: FeeRegistry`);
        console.log(`   Admin: ${feeRegistry.admin.toString()}`);
        console.log(`   Current Fee: ${feeRegistry.currentFee.toString()}`);
        console.log(`   Pause: ${feeRegistry.pause}`);
        console.log(`   Created: ${new Date(feeRegistry.createdAt * 1000).toISOString()}`);
        console.log(`   Updated: ${new Date(feeRegistry.updatedAt * 1000).toISOString()}`);
      } catch (e) {
        try {
          // Try VerifiersList
          const verifiers = await program.account.verifiersList.fetch(pubkey);
          console.log(`📋 Type: VerifiersList`);
          console.log(`   Admin: ${verifiers.admin.toString()}`);
          console.log(`   Verifiers: ${verifiers.verifiers.length} verifiers`);
          verifiers.verifiers.forEach((v, idx) => {
            console.log(`     ${idx + 1}. ${v.toString()}`);
          });
          console.log(`   Created: ${new Date(verifiers.createdAt * 1000).toISOString()}`);
          console.log(`   Updated: ${new Date(verifiers.updatedAt * 1000).toISOString()}`);
        } catch (e) {
          try {
            // Try PrefixAccount
            const prefix = await program.account.prefixAccount.fetch(pubkey);
            console.log(`📋 Type: PrefixAccount`);
            console.log(`   Prefix: "${prefix.prefix}"`);
            console.log(`   Owner: ${prefix.owner.toString()}`);
            console.log(`   Status: ${prefix.status}`);
            console.log(`   Metadata URI: ${prefix.metadataUri}`);
            console.log(`   Metadata Hash: ${Array.from(prefix.metadataHash).map(b => b.toString().padStart(2, '0')).join('')}`);
            console.log(`   Authority Keys: ${prefix.authorityKeys.length} keys`);
            prefix.authorityKeys.forEach((key, idx) => {
              console.log(`     ${idx + 1}. ${key.toString()}`);
            });
            console.log(`   Expiry: ${prefix.expiryAt ? new Date(prefix.expiryAt * 1000).toISOString() : 'None'}`);
            console.log(`   Created: ${new Date(prefix.createdAt * 1000).toISOString()}`);
            console.log(`   Updated: ${new Date(prefix.updatedAt * 1000).toISOString()}`);
          } catch (e) {
            // Unknown account type
            console.log(`📋 Type: Unknown`);
            console.log(`   Raw Data: ${account.data.toString('base64').substring(0, 100)}...`);
          }
        }
      }
      console.log();
    }

    // Summary
    console.log("📈 Summary:");
    console.log(`   Total Accounts: ${accounts.length}`);
    
    // Count by type
    let feeRegistryCount = 0;
    let verifiersCount = 0;
    let prefixCount = 0;
    let unknownCount = 0;

    for (const { pubkey } of accounts) {
      try {
        await program.account.feeRegistry.fetch(pubkey);
        feeRegistryCount++;
      } catch (e) {
        try {
          await program.account.verifiersList.fetch(pubkey);
          verifiersCount++;
        } catch (e) {
          try {
            await program.account.prefixAccount.fetch(pubkey);
            prefixCount++;
          } catch (e) {
            unknownCount++;
          }
        }
      }
    }

    console.log(`   Fee Registries: ${feeRegistryCount}`);
    console.log(`   Verifiers Lists: ${verifiersCount}`);
    console.log(`   Prefix Accounts: ${prefixCount}`);
    console.log(`   Unknown: ${unknownCount}`);

  } catch (error) {
    console.error("❌ Error querying accounts:", error.message);
  }
}

// Run the query
queryProgramAccounts().catch(console.error);
