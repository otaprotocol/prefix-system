pub mod admin;
pub mod initialize;
pub mod prefix;

// Re-export all instruction contexts and handlers
pub use initialize::*;

// Re-export prefix instruction contexts and handlers
pub use prefix::submit_prefix_with_fee::*;
pub use prefix::approve_prefix::*;
pub use prefix::reject_prefix::*;
pub use prefix::refund_prefix_fee::*;
pub use prefix::update_prefix_metadata::*;
pub use prefix::update_prefix_authority::*;
pub use prefix::deactivate_prefix::*;
pub use prefix::reactivate_prefix::*;
pub use prefix::recover_prefix_owner_with_fee::*;

// Re-export admin instruction contexts and handlers
pub use admin::update_fee::*;
pub use admin::add_verifier::*;
pub use admin::remove_verifier::*;
pub use admin::withdraw_treasury::*;
pub use admin::set_pause::*;
