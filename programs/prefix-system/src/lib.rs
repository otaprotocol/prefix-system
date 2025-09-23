use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;

// Re-export all instruction contexts at crate root for Anchor
pub use instructions::*;

declare_id!("otac5xyDhtoUWRXi36R9QN8Q9rW89QNJfUQDrZyiidh");

#[program]
pub mod prefix_system {
    use super::*;

    // Admin/bootstrap
    pub fn initialize(
        ctx: Context<Initialize>,
        admin_pubkey: Pubkey,
        initial_fee: u64,
    ) -> Result<()> {
        initialize_handler(ctx, admin_pubkey, initial_fee)
    }

    // Prefix lifecycle
    pub fn submit_prefix_with_fee(
        ctx: Context<SubmitPrefixWithFee>,
        prefix: String,
        metadata_uri: String,
        metadata_hash: [u8; 32],
        authority_keys: Vec<Pubkey>,
    ) -> Result<()> {
        submit_prefix_with_fee_handler(ctx, prefix, metadata_uri, metadata_hash, authority_keys)
    }

    pub fn approve_prefix(
        ctx: Context<ApprovePrefix>,
        prefix: String,
        ref_hash: [u8; 32],
    ) -> Result<()> {
        approve_prefix_handler(ctx, prefix, ref_hash)
    }

    pub fn reject_prefix(ctx: Context<RejectPrefix>, prefix: String, reason: String) -> Result<()> {
        reject_prefix_handler(ctx, prefix, reason)
    }

    pub fn refund_prefix_fee(ctx: Context<RefundPrefixFee>, prefix: String) -> Result<()> {
        refund_prefix_fee_handler(ctx, prefix)
    }

    pub fn update_prefix_metadata(
        ctx: Context<UpdatePrefixMetadata>,
        prefix: String,
        new_metadata_uri: String,
        new_metadata_hash: [u8; 32],
    ) -> Result<()> {
        update_prefix_metadata_handler(ctx, prefix, new_metadata_uri, new_metadata_hash)
    }

    pub fn update_prefix_authority(
        ctx: Context<UpdatePrefixAuthority>,
        prefix: String,
        authority_keys: Vec<Pubkey>,
    ) -> Result<()> {
        update_prefix_authority_handler(ctx, prefix, authority_keys)
    }

    pub fn deactivate_prefix(ctx: Context<DeactivatePrefix>, prefix: String) -> Result<()> {
        deactivate_prefix_handler(ctx, prefix)
    }

    pub fn reactivate_prefix(ctx: Context<ReactivatePrefix>, prefix: String) -> Result<()> {
        reactivate_prefix_handler(ctx, prefix)
    }

    pub fn recover_prefix_owner_with_fee(
        ctx: Context<RecoverPrefixOwnerWithFee>,
        prefix: String,
        new_owner: Pubkey,
    ) -> Result<()> {
        instructions::prefix::recover_prefix_owner_with_fee::recover_prefix_owner_with_fee_handler(
            ctx, prefix, new_owner,
        )
    }

    // Admin ops
    pub fn update_fee(ctx: Context<UpdateFee>, new_fee: u64) -> Result<()> {
        update_fee_handler(ctx, new_fee)
    }

    pub fn add_verifier(ctx: Context<AddVerifier>, verifier: Pubkey) -> Result<()> {
        add_verifier_handler(ctx, verifier)
    }

    pub fn remove_verifier(ctx: Context<RemoveVerifier>, verifier: Pubkey) -> Result<()> {
        remove_verifier_handler(ctx, verifier)
    }

    pub fn withdraw_treasury(
        ctx: Context<WithdrawTreasury>,
        amount: u64,
        to: Pubkey,
    ) -> Result<()> {
        withdraw_treasury_handler(ctx, amount, to)
    }

    pub fn set_pause(ctx: Context<SetPause>, pause: bool) -> Result<()> {
        set_pause_handler(ctx, pause)
    }
}
