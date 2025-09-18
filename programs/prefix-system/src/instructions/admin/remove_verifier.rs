use crate::errors::ErrorCode;
use crate::state::{FeeRegistry, VerifiersList};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RemoveVerifier<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [crate::constants::FEE_REGISTRY_SEED], bump = fee_registry.bump)]
    pub fee_registry: Account<'info, FeeRegistry>,
    #[account(mut, seeds = [crate::constants::VERIFIERS_SEED], bump = verifiers.bump)]
    pub verifiers: Account<'info, VerifiersList>,
}

pub fn remove_verifier_handler(ctx: Context<RemoveVerifier>, verifier: Pubkey) -> Result<()> {
    let fee_registry = &ctx.accounts.fee_registry;
    require_keys_eq!(
        ctx.accounts.admin.key(),
        fee_registry.admin,
        ErrorCode::UnauthorizedAdmin
    );

    let verifiers = &mut ctx.accounts.verifiers;
    let pos = verifiers
        .verifiers
        .iter()
        .position(|v| *v == verifier)
        .ok_or(error!(ErrorCode::UnauthorizedVerifier))?;
    verifiers.verifiers.remove(pos);
    verifiers.updated_at = Clock::get()?.unix_timestamp;

    emit!(crate::events::VerifierRemoved {
        admin: ctx.accounts.admin.key(),
        verifier,
        removed_at: verifiers.updated_at,
    });
    Ok(())
}
