use crate::constants::*;
use crate::events::FeeUpdated;
use crate::state::{FeeRegistry, VerifiersList};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(admin_pubkey: Pubkey, initial_fee: u64)]
pub struct Initialize<'info> {
    /// Payer who funds the initial accounts (must be a signer)
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Fee registry PDA
    #[account(
        init,
        payer = payer,
        space = FeeRegistry::space(),
        seeds = [FEE_REGISTRY_SEED],
        bump,
    )]
    pub fee_registry: Account<'info, FeeRegistry>,

    /// Verifiers list PDA
    #[account(
        init,
        payer = payer,
        space = VerifiersList::space(MAX_VERIFIERS),
        seeds = [VERIFIERS_SEED],
        bump,
    )]
    pub verifiers: Account<'info, VerifiersList>,

    ///CHECK: Treasury PDA owned by the program (created rent-exempt)
    #[account(
        init,
        payer = payer,
        space = 0, // must be 0 so the account carries no data for system transfers
        seeds = [TREASURY_SEED, fee_registry.key().as_ref()],
        bump,
    )]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_handler(
    ctx: Context<Initialize>,
    admin_pubkey: Pubkey,
    initial_fee: u64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    // bumps for created PDAs (available because we used `bump` in the account constraints)
    let bump_fee = ctx.bumps.fee_registry;
    let bump_ver = ctx.bumps.verifiers;
    let _bump_treasury = ctx.bumps.treasury; // stored if needed later

    let fee_registry = &mut ctx.accounts.fee_registry;
    fee_registry.admin = admin_pubkey;
    fee_registry.current_fee = initial_fee;
    fee_registry.pause = false;
    fee_registry.bump = bump_fee;
    fee_registry.created_at = now;
    fee_registry.updated_at = now;

    let verifiers = &mut ctx.accounts.verifiers;
    verifiers.admin = admin_pubkey;
    verifiers.verifiers = Vec::new();
    verifiers.bump = bump_ver;
    verifiers.created_at = now;
    verifiers.updated_at = now;

    emit!(FeeUpdated {
        admin: admin_pubkey,
        old_fee: 0,
        new_fee: initial_fee,
        updated_at: now,
    });

    Ok(())
}
