use crate::constants::*;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum PrefixStatus {
    Pending,
    Active,
    Rejected,
    Inactive,
}

#[account]
pub struct PrefixAccount {
    pub owner: Pubkey,
    pub prefix: String, // normalized uppercase key used in PDA
    pub metadata_uri: String,
    pub metadata_hash: [u8; 32],
    pub ref_hash: [u8; 32], // approval or rejection reference hash
    pub status: PrefixStatus,
    pub authority_keys: Vec<Pubkey>,
    pub fee_paid: u64,
    pub expiry_at: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl PrefixAccount {
    pub fn space(max_prefix_len: usize, max_uri_len: usize, max_auth_keys: usize) -> usize {
        DISCRIMINATOR_SIZE +
        PUBKEY_SIZE +
        STRING_PREFIX_SIZE + max_prefix_len +
        STRING_PREFIX_SIZE + max_uri_len +
        32 + // metadata_hash
        32 + // ref_hash
        1 +  // enum PrefixStatus (repr by Anchor as 1 byte variant idx)
        VEC_PREFIX_SIZE + max_auth_keys * PUBKEY_SIZE +
        U64_SIZE +
        1 + I64_SIZE + // Option<i64> -> 1 tag + i64
        I64_SIZE +
        I64_SIZE +
        U8_SIZE
    }
}
