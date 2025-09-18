use crate::constants::*;
use crate::errors::ErrorCode;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    ed25519_program, sysvar::instructions::load_instruction_at_checked,
};

pub fn normalize_prefix(input: &str) -> Result<String> {
    let upper = input
        .chars()
        .map(|c| c.to_ascii_uppercase())
        .collect::<String>();
    if upper.len() < MIN_PREFIX_LEN || upper.len() > MAX_PREFIX_LEN {
        return err!(ErrorCode::InvalidPrefixFormat);
    }
    if !upper.chars().all(|c| c.is_ascii_alphanumeric()) {
        return err!(ErrorCode::InvalidPrefixFormat);
    }
    Ok(upper)
}

pub fn validate_metadata(metadata_uri: &str, metadata_hash: &[u8]) -> Result<()> {
    if metadata_hash.len() != 32 {
        return err!(ErrorCode::InvalidMetadataHashLength);
    }
    if metadata_uri.len() > MAX_URI_LEN {
        return err!(ErrorCode::InvalidMetadataUri);
    }
    let allowed = metadata_uri.starts_with("https://") || metadata_uri.starts_with("ipfs://");
    require!(allowed, ErrorCode::InvalidMetadataUri);
    Ok(())
}

pub fn assert_program_owned(account_info: &AccountInfo, program_id: &Pubkey) -> Result<()> {
    require_keys_eq!(
        *account_info.owner,
        *program_id,
        ErrorCode::InvalidTreasuryAccount
    );
    Ok(())
}

/// Verifies that an Ed25519 signature verification instruction exists in the transaction
/// that verifies the owner's signature over the metadata_hash
pub fn verify_ed25519_signature(
    instructions_sysvar: &AccountInfo,
    owner_pubkey: &Pubkey,
    metadata_hash: &[u8; 32],
) -> Result<()> {
    // Scan all instructions in the tx and find an instruction for ed25519_program::ID
    // which contains owner_pubkey bytes and metadata_hash bytes in its data buffer.
    // If found, we accept it. If not, we error out.
    //
    // NOTE: this assumes the client created the ed25519 verify instruction
    // using the standard helper (Ed25519Program.createInstructionWithPublicKey)
    // which encodes the public key and message bytes in the instruction data.
    let mut found = false;
    let mut i: usize = 0;
    loop {
        // load_instruction_at_checked returns Err when index >= instruction_count
        let ix = match load_instruction_at_checked(i as usize, instructions_sysvar) {
            Ok(ix) => ix,
            Err(_) => break, // no more instructions
        };

        if ix.program_id == ed25519_program::ID {
            // search the instruction data for the owner's pubkey and metadata_hash bytes
            // This avoids hard-coded offsets; we check membership.
            let data: &[u8] = ix.data.as_ref();

            // Look for owner's pubkey bytes and message bytes inside instruction data
            if data.windows(32).any(|w| w == owner_pubkey.as_ref())
                && data.windows(32).any(|w| w == metadata_hash)
            {
                found = true;
                break;
            }
        }

        i += 1;
    }

    if !found {
        return Err(ErrorCode::InvalidEd25519Signature.into());
    }

    // If we found such an ed25519 instruction, the runtime will have validated it if the signature was invalid.
    Ok(())
}
