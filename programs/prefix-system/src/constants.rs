use anchor_lang::prelude::*;

// Seed bytes used for PDA derivations
pub const FEE_REGISTRY_SEED: &[u8] = b"fee_registry";
pub const VERIFIERS_SEED: &[u8] = b"verifiers";
pub const TREASURY_SEED: &[u8] = b"treasury";
pub const PREFIX_SEED: &[u8] = b"prefix";

// Domain limits and sizing constants
pub const MAX_PREFIX_LEN: usize = 12; // A-Z0-9 up to 12
pub const MIN_PREFIX_LEN: usize = 3;
pub const MAX_URI_LEN: usize = 255; // conservative cap
pub const MAX_AUTH_KEYS: usize = 10;
pub const MAX_VERIFIERS: usize = 256;

// Maximum expiry duration in seconds
pub const MAX_EXPIRY_DURATION: u64 = 14 * 24 * 60 * 60; // 14 days

// Account sizing helpers
pub const DISCRIMINATOR_SIZE: usize = 8;
pub const PUBKEY_SIZE: usize = 32;
pub const BOOL_SIZE: usize = 1;
pub const U8_SIZE: usize = 1;
pub const U64_SIZE: usize = 8;
pub const I64_SIZE: usize = 8;

// String and Vec sizing helpers (Anchor serializes with a 4-byte length prefix)
pub const VEC_PREFIX_SIZE: usize = 4;
pub const STRING_PREFIX_SIZE: usize = 4;

// Utility: current cluster's clock (helper wrapper)
pub fn now_ts() -> i64 {
    Clock::get().map(|c| c.unix_timestamp).unwrap_or_default()
}
