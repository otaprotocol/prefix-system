use crate::constants::*;
use crate::errors::ErrorCode;
use crate::events::PrefixRefunded;
use crate::state::{prefix_account::PrefixStatus, FeeRegistry, PrefixAccount};
// Treasury is a PDA owned by this program
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(prefix: String)]
pub struct RefundPrefixFee<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [FEE_REGISTRY_SEED], bump = fee_registry.bump)]
    pub fee_registry: Account<'info, FeeRegistry>,
    /// CHECK: Treasury PDA
    #[account(mut, seeds = [TREASURY_SEED, fee_registry.key().as_ref()], bump)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut, close = owner, seeds = [PREFIX_SEED, prefix.as_bytes()], bump = prefix_account.bump)]
    pub prefix_account: Account<'info, PrefixAccount>,
    pub system_program: Program<'info, System>,
}

pub fn refund_prefix_fee_handler(ctx: Context<RefundPrefixFee>, _prefix: String) -> Result<()> {
    // Check if program is paused (refund is fee-related)
    require!(
        !ctx.accounts.fee_registry.pause,
        ErrorCode::FeeOperationsPaused
    );

    let acct = &mut ctx.accounts.prefix_account;
    // Allow refund for rejected prefixes or expired pending prefixes
    let is_rejected = acct.status == PrefixStatus::Rejected;
    let is_expired =
        acct.status == PrefixStatus::Pending && Clock::get()?.unix_timestamp > acct.expiry_at;

    require!(is_rejected || is_expired, ErrorCode::RefundNotAllowed);
    require_keys_eq!(
        ctx.accounts.owner.key(),
        acct.owner,
        ErrorCode::UnauthorizedOwnerAction
    );
    // Treasury is a PDA owned by this program
    require!(
        ctx.accounts.treasury.to_account_info().owner == ctx.program_id,
        ErrorCode::InvalidTreasuryAccount
    );

    let amount = acct.fee_paid;
    require!(amount > 0, ErrorCode::RefundNotAllowed);
    require!(
        ctx.accounts.treasury.to_account_info().lamports() >= amount,
        ErrorCode::InsufficientTreasuryBalance
    );

    // Transfer lamports from treasury to owner
    let treasury_info = ctx.accounts.treasury.to_account_info();
    let owner_info = ctx.accounts.owner.to_account_info();

    **treasury_info.lamports.borrow_mut() -= amount;
    **owner_info.lamports.borrow_mut() += amount;

    // Emit event with all data before closing account
    emit!(PrefixRefunded {
        prefix: acct.prefix.clone(),
        owner: acct.owner,
        amount,
        refunded_at: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
