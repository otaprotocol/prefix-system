use crate::constants::*;
use crate::errors::ErrorCode;
use crate::events::PrefixOwnerRecovered;
use crate::state::{FeeRegistry, PrefixAccount};
// Treasury is owned by System Program, no need for ownership checks
use anchor_lang::prelude::*;
use anchor_lang::system_program;

#[derive(Accounts)]
#[instruction(prefix: String)]
pub struct RecoverPrefixOwnerWithFee<'info> {
    /// New owner who will pay the recovery fee
    #[account(mut)]
    pub new_owner: Signer<'info>,

    /// Admin/multisig who authorizes the recovery
    pub admin: Signer<'info>,

    #[account(seeds = [FEE_REGISTRY_SEED], bump = fee_registry.bump)]
    pub fee_registry: Account<'info, FeeRegistry>,

    /// CHECK: PDA escrow; ownership asserted at runtime
    #[account(mut, seeds = [TREASURY_SEED, fee_registry.key().as_ref()], bump)]
    pub treasury: UncheckedAccount<'info>,

    #[account(mut, seeds = [PREFIX_SEED, prefix.as_bytes()], bump = prefix_account.bump)]
    pub prefix_account: Account<'info, PrefixAccount>,

    pub system_program: Program<'info, System>,
}

pub fn recover_prefix_owner_with_fee_handler(
    ctx: Context<RecoverPrefixOwnerWithFee>,
    prefix: String,
    new_owner: Pubkey,
) -> Result<()> {
    // 1. Check authorization - only admin can authorize recovery
    require_keys_eq!(
        ctx.accounts.admin.key(),
        ctx.accounts.fee_registry.admin,
        ErrorCode::UnauthorizedAdmin
    );

    // 2. Check if program is paused 
    require!(
        !ctx.accounts.fee_registry.pause,
        ErrorCode::FeeOperationsPaused
    );

    // 3. Verify new_owner matches the signer
    require_keys_eq!(
        ctx.accounts.new_owner.key(),
        new_owner,
        ErrorCode::UnauthorizedOwnerAction
    );

    // Treasury is owned by System Program, no need to check ownership

    // 5. Get current fee and ensure new owner has sufficient lamports
    let fee = ctx.accounts.fee_registry.current_fee;
    require!(fee > 0, ErrorCode::InsufficientFee);
    require!(
        ctx.accounts.new_owner.lamports() >= fee,
        ErrorCode::InsufficientFee
    );

    // 6. Transfer recovery fee from new_owner to treasury
    let ix = system_program::Transfer {
        from: ctx.accounts.new_owner.to_account_info(),
        to: ctx.accounts.treasury.to_account_info(),
    };
    let cpi = CpiContext::new(ctx.accounts.system_program.to_account_info(), ix);
    system_program::transfer(cpi, fee)?;

    // 7. Update owner in prefix_account
    let acct = &mut ctx.accounts.prefix_account;
    let old_owner = acct.owner;
    acct.owner = new_owner;
    acct.updated_at = Clock::get()?.unix_timestamp;

    // 8. Emit event
    emit!(PrefixOwnerRecovered {
        prefix,
        old_owner,
        new_owner,
        fee_paid: fee,
        updated_at: acct.updated_at,
    });

    Ok(())
}
