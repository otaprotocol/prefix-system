use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized admin")]
    UnauthorizedAdmin,

    #[msg("Unauthorized verifier")]
    UnauthorizedVerifier,

    #[msg("Invalid prefix format")]
    InvalidPrefixFormat,

    #[msg("Prefix already exists")]
    PrefixAlreadyExists,

    #[msg("Prefix not in pending state")]
    InvalidPrefixStatus,

    #[msg("Insufficient fee")]
    InsufficientFee,

    #[msg("Invalid metadata hash")]
    InvalidMetadataHashLength,

    #[msg("Invalid metadata uri")]
    InvalidMetadataUri,

    #[msg("Treasury not owned by program")]
    InvalidTreasuryAccount,

    #[msg("Insufficient treasury balance")]
    InsufficientTreasuryBalance,

    #[msg("Refund not allowed in current state")]
    RefundNotAllowed,

    #[msg("Only owner may perform this action")]
    UnauthorizedOwnerAction,

    #[msg("Account bump missing")]
    MissingBump,

    #[msg("Fee operations paused")]
    FeeOperationsPaused,

    #[msg("Prefix expired")]
    PrefixExpired,

    #[msg("Invalid authority keys length")]
    AuthorityKeysTooMany,

    #[msg("Invalid Ed25519 signature")]
    InvalidEd25519Signature,
}
