use crate::constants::*;
use anchor_lang::prelude::*;

#[account]
pub struct VerifiersList {
    pub admin: Pubkey,
    pub verifiers: Vec<Pubkey>,
    pub bump: u8,
    pub created_at: i64,
    pub updated_at: i64,
}

impl VerifiersList {
    pub fn space(max_verifiers: usize) -> usize {
        DISCRIMINATOR_SIZE +
        PUBKEY_SIZE +                // admin
        VEC_PREFIX_SIZE + max_verifiers * PUBKEY_SIZE + // verifiers vec
        U8_SIZE +                    // bump
        I64_SIZE +                   // created_at
        I64_SIZE // updated_at
    }
}
