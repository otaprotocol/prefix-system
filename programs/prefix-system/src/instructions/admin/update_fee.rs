use crate::errors::ErrorCode;
use crate::state::FeeRegistry;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateFee<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [crate::constants::FEE_REGISTRY_SEED], bump = fee_registry.bump)]
    pub fee_registry: Account<'info, FeeRegistry>,
}

pub fn update_fee_handler(ctx: Context<UpdateFee>, new_fee: u64) -> Result<()> {
    let fee_registry = &mut ctx.accounts.fee_registry;
    require_keys_eq!(
        ctx.accounts.admin.key(),
        fee_registry.admin,
        ErrorCode::UnauthorizedAdmin
    );
    // Fee updates should work even when paused (admin can adjust fees during emergency)

    let now = Clock::get()?.unix_timestamp;
    let old_fee = fee_registry.current_fee;
    fee_registry.current_fee = new_fee;
    fee_registry.updated_at = now;

    emit!(crate::events::FeeUpdated {
        admin: ctx.accounts.admin.key(),
        old_fee,
        new_fee,
        updated_at: now,
    });
    Ok(())
}
