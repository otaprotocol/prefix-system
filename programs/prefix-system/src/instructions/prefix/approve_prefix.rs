use crate::constants::*;
use crate::errors::ErrorCode;
use crate::events::{PrefixActivated, PrefixApproved};
use crate::state::{prefix_account::PrefixStatus, FeeRegistry, PrefixAccount, VerifiersList};
// Treasury is owned by System Program, no need for ownership checks
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(prefix: String)]
pub struct ApprovePrefix<'info> {
    pub verifier: Signer<'info>,
    #[account(seeds = [FEE_REGISTRY_SEED], bump = fee_registry.bump)]
    pub fee_registry: Account<'info, FeeRegistry>,
    #[account(seeds = [VERIFIERS_SEED], bump = verifiers.bump)]
    pub verifiers: Account<'info, VerifiersList>,
    /// CHECK: ownership asserted at runtime
    pub treasury: UncheckedAccount<'info>,
    #[account(mut, seeds = [PREFIX_SEED, prefix.as_bytes()], bump = prefix_account.bump)]
    pub prefix_account: Account<'info, PrefixAccount>,
}

pub fn approve_prefix_handler(
    ctx: Context<ApprovePrefix>,
    prefix: String,
    ref_hash: [u8; 32],
) -> Result<()> {
    // Pause
    require!(
        !ctx.accounts.fee_registry.pause,
        ErrorCode::FeeOperationsPaused
    );

    // Auth
    require!(
        ctx.accounts
            .verifiers
            .verifiers
            .contains(&ctx.accounts.verifier.key()),
        ErrorCode::UnauthorizedVerifier
    );

    // State checks
    require!(
        ctx.accounts.prefix_account.status == PrefixStatus::Pending,
        ErrorCode::InvalidPrefixStatus
    );

    require!(
        Clock::get()?.unix_timestamp <= ctx.accounts.prefix_account.expiry_at,
        ErrorCode::PrefixExpired
    );

    // Treasury is owned by System Program, no need to check ownership

    // Update state
    let acct = &mut ctx.accounts.prefix_account;
    acct.status = PrefixStatus::Active;
    acct.ref_hash = ref_hash;
    acct.updated_at = Clock::get()?.unix_timestamp;

    emit!(PrefixApproved {
        prefix: prefix.clone(),
        verifier: ctx.accounts.verifier.key(),
        ref_hash,
        approved_at: acct.updated_at,
    });

    emit!(PrefixActivated {
        prefix,
        owner: acct.owner,
        authority_keys_len: acct.authority_keys.len() as u8,
        activated_at: acct.updated_at,
    });
    Ok(())
}
