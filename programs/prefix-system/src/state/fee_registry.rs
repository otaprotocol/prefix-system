use anchor_lang::prelude::*;
use crate::constants::*;

#[account]
pub struct FeeRegistry {
    pub admin: Pubkey,
    pub current_fee: u64,
    pub pause: bool,
    pub bump: u8,
    pub created_at: i64,
    pub updated_at: i64,
}

impl FeeRegistry {
    pub fn space() -> usize {
        DISCRIMINATOR_SIZE +
        PUBKEY_SIZE + // admin
        U64_SIZE +    // current_fee
        BOOL_SIZE +   // pause
        U8_SIZE +     // bump
        I64_SIZE +    // created_at
        I64_SIZE      // updated_at
    }
}

