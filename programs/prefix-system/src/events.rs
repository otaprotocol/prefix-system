use anchor_lang::prelude::*;

#[event]
pub struct PrefixSubmitted {
    pub prefix: String,
    pub owner: Pubkey,
    pub metadata_hash: [u8; 32],
    pub metadata_uri: String,
    pub fee_paid: u64,
    pub created_at: i64,
    pub pending_pda: Pubkey,
}

#[event]
pub struct PrefixApproved {
    pub prefix: String,
    pub verifier: Pubkey,
    pub ref_hash: [u8; 32],
    pub approved_at: i64,
}

#[event]
pub struct PrefixRejected {
    pub prefix: String,
    pub verifier: Pubkey,
    pub reason: String,
    pub rejected_at: i64,
}

#[event]
pub struct PrefixActivated {
    pub prefix: String,
    pub owner: Pubkey,
    pub authority_keys_len: u8,
    pub activated_at: i64,
}

#[event]
pub struct PrefixMetadataUpdated {
    pub prefix: String,
    pub owner: Pubkey,
    pub old_metadata_hash: [u8; 32],
    pub new_metadata_hash: [u8; 32],
    pub updated_at: i64,
}

#[event]
pub struct PrefixAuthorityUpdated {
    pub prefix: String,
    pub owner: Pubkey,
    pub old_authority_keys: Vec<Pubkey>,
    pub new_authority_keys: Vec<Pubkey>,
    pub updated_at: i64,
}

#[event]
pub struct PrefixRefunded {
    pub prefix: String,
    pub owner: Pubkey,
    pub amount: u64,
    pub refunded_at: i64,
}

#[event]
pub struct TreasuryWithdraw {
    pub admin: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
    pub withdrawn_at: i64,
}

#[event]
pub struct VerifierAdded {
    pub admin: Pubkey,
    pub verifier: Pubkey,
    pub added_at: i64,
}

#[event]
pub struct VerifierRemoved {
    pub admin: Pubkey,
    pub verifier: Pubkey,
    pub removed_at: i64,
}

#[event]
pub struct FeeUpdated {
    pub admin: Pubkey,
    pub old_fee: u64,
    pub new_fee: u64,
    pub updated_at: i64,
}

#[event]
pub struct PrefixDeactivated {
    pub prefix: String,
    pub admin: Pubkey,
    pub at: i64,
}

#[event]
pub struct PrefixReactivated {
    pub prefix: String,
    pub admin: Pubkey,
    pub at: i64,
}

#[event]
pub struct PrefixOwnerRecovered {
    pub prefix: String,
    pub old_owner: Pubkey,
    pub new_owner: Pubkey,
    pub fee_paid: u64,
    pub updated_at: i64,
}
