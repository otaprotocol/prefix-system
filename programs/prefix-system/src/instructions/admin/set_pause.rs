use crate::errors::ErrorCode;
use crate::state::FeeRegistry;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SetPause<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [crate::constants::FEE_REGISTRY_SEED], bump = fee_registry.bump)]
    pub fee_registry: Account<'info, FeeRegistry>,
}

pub fn set_pause_handler(ctx: Context<SetPause>, pause: bool) -> Result<()> {
    let fee_registry = &mut ctx.accounts.fee_registry;
    require_keys_eq!(
        ctx.accounts.admin.key(),
        fee_registry.admin,
        ErrorCode::UnauthorizedAdmin
    );
    fee_registry.pause = pause;
    fee_registry.updated_at = Clock::get()?.unix_timestamp;
    Ok(())
}
