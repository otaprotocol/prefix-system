use crate::errors::ErrorCode;
use anchor_lang::system_program;
use crate::constants::*;
use anchor_lang::prelude::*;
use crate::events::PrefixSubmitted;
use crate::state::{FeeRegistry, PrefixAccount};
use crate::utils::{normalize_prefix, validate_metadata, verify_ed25519_signature};


#[derive(Accounts)]
#[instruction(prefix: String)]
pub struct SubmitPrefixWithFee<'info> {
    /// Owner must be signer to pay for account creation
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(seeds = [FEE_REGISTRY_SEED], bump = fee_registry.bump)]
    pub fee_registry: Account<'info, FeeRegistry>,

    /// CHECK: PDA escrow; ownership asserted at runtime
    #[account(mut, seeds = [TREASURY_SEED, fee_registry.key().as_ref()], bump)]
    pub treasury: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = PrefixAccount::space(MAX_PREFIX_LEN, MAX_URI_LEN, MAX_AUTH_KEYS),
        seeds = [PREFIX_SEED, prefix.as_bytes()],
        bump,
    )]
    pub prefix_account: Account<'info, PrefixAccount>,

    /// CHECK: Instructions sysvar for Ed25519 signature verification
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn submit_prefix_with_fee_handler(
    ctx: Context<SubmitPrefixWithFee>,
    prefix: String,
    metadata_uri: String,
    metadata_hash: [u8; 32],
    authority_keys: Vec<Pubkey>
) -> Result<()> {
    // Pause check
    require!(!ctx.accounts.fee_registry.pause, ErrorCode::FeeOperationsPaused);

    // Normalize and validate inputs
    let normalized = normalize_prefix(&prefix)?;
    require!(prefix == normalized, ErrorCode::InvalidPrefixFormat);
    validate_metadata(&metadata_uri, &metadata_hash)?;
    require!(authority_keys.len() <= MAX_AUTH_KEYS, ErrorCode::AuthorityKeysTooMany);
    
    // Verify treasury is owned by this program (PDA)
    require!(
        ctx.accounts.treasury.owner == ctx.program_id,
        ErrorCode::InvalidTreasuryAccount
    );

    // Verify Ed25519 signature to ensure owner signed the metadata hash
    // This is required for all submissions to ensure cryptographic proof of ownership
    verify_ed25519_signature(
        &ctx.accounts.instructions_sysvar.to_account_info(),
        &ctx.accounts.owner.key(),
        &metadata_hash,
    )?;
 
    // Enforce exact fee payment: require that owner sent lamports in this tx to treasury
    // This program-level check relies on comparing lamports delta is not directly accessible.
    // As a pragmatic approach, require that fee is transferred via a separate ix before this handler
    // OR attach the transfer here using CPI signed by owner. We do the latter.
    let fee = ctx.accounts.fee_registry.current_fee;
    require!(fee > 0, ErrorCode::InsufficientFee);

    // owner is signer, treasury is destination PDA
    let cpi_accounts = system_program::Transfer {
        from: ctx.accounts.owner.to_account_info(),
        to: ctx.accounts.treasury.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts);
    system_program::transfer(cpi_ctx, fee)?;

    // Populate account
    let now = Clock::get()?.unix_timestamp;
    let bump = ctx.bumps.prefix_account;
    let data = &mut ctx.accounts.prefix_account;
    data.owner = ctx.accounts.owner.key();
    data.prefix = normalized.clone();
    data.metadata_uri = metadata_uri;
    data.metadata_hash = metadata_hash;
    data.ref_hash = [0u8; 32];
    data.status = crate::state::prefix_account::PrefixStatus::Pending;
    data.authority_keys = authority_keys;
    data.fee_paid = fee;
    data.expiry_at = now + MAX_EXPIRY_DURATION as i64;
    data.created_at = now;
    data.updated_at = now;
    data.bump = bump;

    emit!(PrefixSubmitted {
        prefix: normalized,
        owner: ctx.accounts.owner.key(),
        metadata_hash: data.metadata_hash,
        metadata_uri: data.metadata_uri.clone(),
        fee_paid: fee,
        created_at: now,
        pending_pda: ctx.accounts.prefix_account.key(),
    });
    Ok(())
}


