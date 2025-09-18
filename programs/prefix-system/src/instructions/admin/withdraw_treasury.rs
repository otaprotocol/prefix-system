use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::ErrorCode;
use crate::state::FeeRegistry;
// Treasury is a PDA owned by this program

#[derive(Accounts)]
pub struct WithdrawTreasury<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [FEE_REGISTRY_SEED], bump = fee_registry.bump)]
    pub fee_registry: Account<'info, FeeRegistry>,
    /// CHECK: Treasury PDA
    #[account(mut, seeds = [TREASURY_SEED, fee_registry.key().as_ref()], bump)]
    pub treasury: UncheckedAccount<'info>,
    /// CHECK: arbitrary destination account
    #[account(mut)]
    pub to: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn withdraw_treasury_handler(ctx: Context<WithdrawTreasury>, amount: u64, to: Pubkey) -> Result<()> {
    let admin = &ctx.accounts.admin;
    let fee_registry = &ctx.accounts.fee_registry;
    let treasury = &ctx.accounts.treasury;
    let to_acc = &ctx.accounts.to;

    require_keys_eq!(admin.key(), fee_registry.admin, ErrorCode::UnauthorizedAdmin);
    // Check if program is paused (treasury withdrawal is fee-related)
    require!(!fee_registry.pause, ErrorCode::FeeOperationsPaused);
    // Treasury is a PDA owned by this program
    require!(ctx.accounts.treasury.to_account_info().owner == ctx.program_id, ErrorCode::InvalidTreasuryAccount);
    require!(treasury.to_account_info().lamports() >= amount, ErrorCode::InsufficientTreasuryBalance);
    require_keys_eq!(to_acc.key(), to, ErrorCode::InvalidTreasuryAccount);

    // Transfer lamports from treasury to recipient
    let treasury_info = ctx.accounts.treasury.to_account_info();
    let to_info = ctx.accounts.to.to_account_info();
    
    **treasury_info.lamports.borrow_mut() -= amount;
    **to_info.lamports.borrow_mut() += amount;

    emit!(crate::events::TreasuryWithdraw {
        admin: admin.key(),
        to,
        amount,
        withdrawn_at: Clock::get()?.unix_timestamp,
    });
    Ok(())
}

