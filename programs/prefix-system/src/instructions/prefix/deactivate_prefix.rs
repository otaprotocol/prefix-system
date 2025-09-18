use crate::constants::*;
use crate::errors::ErrorCode;
use crate::events::PrefixDeactivated;
use crate::state::{prefix_account::PrefixStatus, FeeRegistry, PrefixAccount};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(prefix: String)]
pub struct DeactivatePrefix<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [FEE_REGISTRY_SEED], bump = fee_registry.bump)]
    pub fee_registry: Account<'info, FeeRegistry>,
    #[account(mut, seeds = [PREFIX_SEED, prefix.as_bytes()], bump = prefix_account.bump)]
    pub prefix_account: Account<'info, PrefixAccount>,
}

pub fn deactivate_prefix_handler(ctx: Context<DeactivatePrefix>, prefix: String) -> Result<()> {
    let admin = ctx.accounts.admin.key();
    require_keys_eq!(
        admin,
        ctx.accounts.fee_registry.admin,
        ErrorCode::UnauthorizedAdmin
    );
    require!(
        ctx.accounts.prefix_account.status == PrefixStatus::Active,
        ErrorCode::InvalidPrefixStatus
    );
    ctx.accounts.prefix_account.status = PrefixStatus::Inactive;
    ctx.accounts.prefix_account.updated_at = Clock::get()?.unix_timestamp;
    emit!(PrefixDeactivated {
        prefix,
        admin,
        at: ctx.accounts.prefix_account.updated_at
    });
    Ok(())
}
