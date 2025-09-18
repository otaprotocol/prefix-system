use crate::errors::ErrorCode;
use crate::state::{FeeRegistry, VerifiersList};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct AddVerifier<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [crate::constants::FEE_REGISTRY_SEED], bump = fee_registry.bump)]
    pub fee_registry: Account<'info, FeeRegistry>,
    #[account(mut, seeds = [crate::constants::VERIFIERS_SEED], bump = verifiers.bump)]
    pub verifiers: Account<'info, VerifiersList>,
}

pub fn add_verifier_handler(ctx: Context<AddVerifier>, verifier: Pubkey) -> Result<()> {
    let fee_registry = &ctx.accounts.fee_registry;
    require_keys_eq!(
        ctx.accounts.admin.key(),
        fee_registry.admin,
        ErrorCode::UnauthorizedAdmin
    );

    let verifiers = &mut ctx.accounts.verifiers;
    require!(
        !verifiers.verifiers.contains(&verifier),
        ErrorCode::InvalidPrefixStatus
    ); // reuse a generic error to keep enum fixed
    verifiers.verifiers.push(verifier);
    verifiers.updated_at = Clock::get()?.unix_timestamp;

    emit!(crate::events::VerifierAdded {
        admin: ctx.accounts.admin.key(),
        verifier,
        added_at: verifiers.updated_at,
    });
    Ok(())
}
