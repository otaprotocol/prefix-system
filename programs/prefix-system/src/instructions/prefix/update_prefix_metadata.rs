use crate::constants::*;
use crate::errors::ErrorCode;
use crate::events::PrefixMetadataUpdated;
use crate::state::{prefix_account::PrefixStatus, PrefixAccount};
use crate::utils::{validate_metadata, verify_ed25519_signature};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(prefix: String)]
pub struct UpdatePrefixMetadata<'info> {
    pub owner: Signer<'info>,
    #[account(mut, seeds = [PREFIX_SEED, prefix.as_bytes()], bump = prefix_account.bump)]
    pub prefix_account: Account<'info, PrefixAccount>,
    
    /// CHECK: Instructions sysvar for Ed25519 signature verification
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
}

pub fn update_prefix_metadata_handler(
    ctx: Context<UpdatePrefixMetadata>,
    _prefix: String,
    new_uri: String,
    new_hash: [u8; 32],
) -> Result<()> {
    let acct = &mut ctx.accounts.prefix_account;
    require_keys_eq!(
        ctx.accounts.owner.key(),
        acct.owner,
        ErrorCode::UnauthorizedOwnerAction
    );
    // Rejected prefixes cannot be updated
    require!(
        acct.status != PrefixStatus::Rejected,
        ErrorCode::InvalidPrefixStatus
    );
    validate_metadata(&new_uri, &new_hash)?;

    // Verify Ed25519 signature to ensure owner signed the new metadata hash
    // This is required for all metadata updates to ensure cryptographic proof of ownership
    verify_ed25519_signature(
        &ctx.accounts.instructions_sysvar.to_account_info(),
        &ctx.accounts.owner.key(),
        &new_hash,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let old_hash = acct.metadata_hash;
    acct.metadata_uri = new_uri;
    acct.metadata_hash = new_hash;
    // If Active, flip back to Pending for re-approval (metadata affects trust context)
    // If Pending, Rejected, or Inactive, status remains unchanged
    if acct.status == PrefixStatus::Active {
        acct.status = PrefixStatus::Pending;
        acct.ref_hash = [0u8; 32];
    }
    acct.updated_at = now;

    emit!(PrefixMetadataUpdated {
        prefix: acct.prefix.clone(),
        owner: acct.owner,
        old_metadata_hash: old_hash,
        new_metadata_hash: acct.metadata_hash,
        updated_at: now,
    });
    Ok(())
}

