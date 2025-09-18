use crate::constants::*;
use crate::errors::ErrorCode;
use crate::events::PrefixAuthorityUpdated;
use crate::state::{prefix_account::PrefixStatus, PrefixAccount};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(prefix: String)]
pub struct UpdatePrefixAuthority<'info> {
    pub owner: Signer<'info>,
    #[account(mut, seeds = [PREFIX_SEED, prefix.as_bytes()], bump = prefix_account.bump)]
    pub prefix_account: Account<'info, PrefixAccount>,
}

pub fn update_prefix_authority_handler(
    ctx: Context<UpdatePrefixAuthority>,
    _prefix: String,
    authority_keys: Vec<Pubkey>,
) -> Result<()> {
    require!(
        authority_keys.len() <= MAX_AUTH_KEYS,
        ErrorCode::AuthorityKeysTooMany
    );
    let acct = &mut ctx.accounts.prefix_account;
    require_keys_eq!(
        ctx.accounts.owner.key(),
        acct.owner,
        ErrorCode::UnauthorizedOwnerAction
    );
    // Rejected prefixes cannot be updated
    require!(
        acct.status != PrefixStatus::Rejected,
        ErrorCode::InvalidPrefixStatus
    );
    acct.authority_keys = authority_keys.clone();
    // Authority updates do NOT change status - they are seamless for devs/users
    // Only metadata updates require re-approval (trust context change)
    acct.updated_at = Clock::get()?.unix_timestamp;

    emit!(PrefixAuthorityUpdated {
        prefix: acct.prefix.clone(),
        owner: acct.owner,
        old_authority_keys: acct.authority_keys.clone(),
        new_authority_keys: authority_keys.clone(),
        updated_at: acct.updated_at,
    });
    Ok(())
}
