use crate::constants::*;
use crate::errors::ErrorCode;
use crate::events::PrefixRejected;
use crate::state::{prefix_account::PrefixStatus, FeeRegistry, PrefixAccount, VerifiersList};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(prefix: String)]
pub struct RejectPrefix<'info> {
    pub verifier: Signer<'info>,
    #[account(seeds = [FEE_REGISTRY_SEED], bump = fee_registry.bump)]
    pub fee_registry: Account<'info, FeeRegistry>,
    #[account(seeds = [VERIFIERS_SEED], bump = verifiers.bump)]
    pub verifiers: Account<'info, VerifiersList>,
    #[account(mut, seeds = [PREFIX_SEED, prefix.as_bytes()], bump = prefix_account.bump)]
    pub prefix_account: Account<'info, PrefixAccount>,
}

pub fn reject_prefix_handler(ctx: Context<RejectPrefix>, prefix: String, reason: String) -> Result<()> {
    require!(!ctx.accounts.fee_registry.pause, ErrorCode::FeeOperationsPaused);
    require!(
        ctx.accounts
            .verifiers
            .verifiers
            .contains(&ctx.accounts.verifier.key()),
        ErrorCode::UnauthorizedVerifier
    );
    require!(
        ctx.accounts.prefix_account.status == PrefixStatus::Pending,
        ErrorCode::InvalidPrefixStatus
    );

    let acct = &mut ctx.accounts.prefix_account;
    acct.status = PrefixStatus::Rejected;
    acct.updated_at = Clock::get()?.unix_timestamp;

    emit!(PrefixRejected {
        prefix,
        verifier: ctx.accounts.verifier.key(),
        reason,
        rejected_at: acct.updated_at,
    });
    Ok(())
}
