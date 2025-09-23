## Overview

This AIP defines prefixes in the Action Codes Protocol as a trust layer enabling branded, verifiable, and auditable prefixes while keeping user UX simple (prefixless codes).

**Key goals:**

- Ensure prefix authenticity and authority verification
- Enforce metadata integrity with signatures and hashes
- Support verifier-based approval with admin governance
- Enable dynamic fees and refunds
- Fully cross-chain ready and relayer-agnostic

## Motivation

Prefixes provide namespaces, trust branding, and metadata routing in the Action Codes Protocol:

- Allow apps, wallets, and relayers to verify code authenticity and trust
- Enable branding and metadata routing for organizations
- UX is simple: users enter prefixless codes; prefixes exist only for trust verification
- Cryptographically auditable and ready for governance

## Specification

### Prefix Structure

- **Prefix**: 3–12 uppercase alphanumeric characters
- **PrefixAccount**: On-chain representation of a registered prefix
- **Purpose**: Provide canonical trust for relayers/wallets and link prefix to owner, metadata, and fee reference

#### PrefixAccount Fields

| Field            | Type     | Description                                                   |
| ---------------- | -------- | ------------------------------------------------------------- |
| `prefix`         | string   | Uppercase alphanumeric prefix (3–12 chars)                    |
| `owner_pubkey`   | pubkey   | Main wallet controlling prefix                                |
| `authority_keys` | pubkey[] | Keys authorized to generate / sign codes for this prefix      |
| `metadata_uri`   | string   | URI to JSON metadata following Prefix Metadata Schema v1      |
| `metadata_hash`  | [u8;32]  | SHA-256 hash of metadata JSON                                 |
| `status`         | enum     | pending, active, rejected, inactive                           |
| `created_at`     | u64      | Submission timestamp                                          |
| `updated_at`     | u64      | Last update timestamp                                         |
| `expiry_at`      | u64      | Expiry timestamp for pending submissions (max 14 days)        |
| `bump`           | u8       | PDA bump for on-chain account                                 |

**Notes:**

- `authority_keys` allow multiple servers, relayer programs, or delegated signing keys
- Prefixes are validated against metadata + hash with Ed25519 signatures

### Prefix Registration Flow

#### 1. Submission (On-Chain)

- Anyone can submit a prefix by:
  - Prefix name
  - Owner pubkey
  - Metadata URI (HTTPS/IPFS)
  - Metadata hash (32 bytes)
  - Authority keys (up to 10)
- **Fee is paid immediately** to prevent spam
- **Owner must provide Ed25519 signature** over `metadata_hash`
- Status = `pending`, with `expiry_at` set (max 14 days)

#### 2. Verification

- Only registered **verifiers** can approve / reject
- Verifier checks:
  - Metadata validity (schema v1)
  - Brand / ownership criteria (optional off-chain checks)
- Status updated:
  - `approved` → becomes `active`
  - `rejected` → refund available

#### 3. Updates

- **Metadata updates**: require new URI, hash, and Ed25519 signature  
- **Authority keys updates**: owner may add/remove (max 10, no duplicates)  
- **Status transitions**: admin may deactivate/reactivate prefixes  

#### 4. Refunds & Expiry

- If rejected or expired → owner can claim refund
- Active prefixes never expire (only pending ones have expiry)

### FeeRegistry

| Field          | Type   | Description                         |
| -------------- | ------ | ----------------------------------- |
| `current_fee`  | u64    | Fee in lamports (SOL smallest unit) |
| `updated_at`   | u64    | Timestamp of last update            |
| `admin_pubkey` | pubkey | Admin / DAO wallet pubkey           |
| `paused`       | bool   | If true, submissions are disabled   |

- Fees are paid **on submission**
- Refunds possible for rejected/expired
- Collected into Treasury PDA

### Verifiers List

| Field             | Type   | Description                                  |
| ----------------- | ------ | -------------------------------------------- |
| `verifier_pubkey` | pubkey | Wallet authorized to approve / reject prefix |
| `added_at`        | u64    | Timestamp verifier added                     |
| `removed_at`      | u64    | Optional removal timestamp                   |

- Multiple verifiers supported
- Admin adds/removes verifiers

### Prefix Metadata Schema v1

All prefix metadata must conform to the Prefix Metadata Schema v1:

**Required fields:**

- `title`: Source of the action request (brand, app, or person) - max 50 chars
- `icon`: HTTPS/IPFS URL to icon image (SVG, PNG, or WebP)
- `description`: Info about the action - max 200 chars
- `label`: Text for action button (verb + max 5 words) - max 30 chars
- `intentCategories`: Array of action categories (payment, stake, vote, etc.)
- `contact`: Object with key-value pairs (must include `email`)

**Optional fields:**

- `website`: Official website
- `schemaVersion`: Must be "1"

**Schema validation:**

- On submission, metadata hash must match off-chain JSON
- Verifiers validate JSON matches schema v1
- Invalid metadata → rejection

### Code Usage & Verification

#### User Side

- Users enter prefixless codes (e.g., 12345678)
- Prefix is metadata-only trust anchor

#### Relayer / Wallet Verification

1. Fetch PrefixAccount for `pre=PREFIX`
2. Verify:
   - `status = active`
   - Metadata hash matches JSON at `metadata_uri`
   - Code signature matches any key in `authority_keys`
3. Optional: check metadata fields (categories, brand, etc.)

**Cross-chain ready**: PrefixAccount + authority keys validate codes from any blockchain relayer

### Security & Anti-Spam

- Fee on submission prevents spam
- Ed25519 signature ensures prefix-owner control
- Expiry cleans up abandoned submissions
- Max authority keys (10) prevents abuse
- Admin pause/deactivate/recover mechanisms

### Status Transitions

| From     | To       | Trigger                  | Who      |
| -------- | -------- | ------------------------ | -------- |
| Pending  | Active   | Approve                  | Verifier |
| Pending  | Rejected | Reject                   | Verifier |
| Pending  | Closed   | Refund                   | Owner    |
| Active   | Inactive | Deactivate               | Admin    |
| Inactive | Active   | Reactivate               | Admin    |
| Rejected | Closed   | Refund                   | Owner    |

## Key Principles

1. **Users never see prefixes**: UX = one-time code entry
2. **Prefix = trust anchor only**: verified by authority_keys
3. **Immediate fee on submission**: anti-spam and refundable if rejected/expired
4. **Verifiers validate metadata + hash** for integrity
5. **Auditability via events**: logs for every action (submit, approve, reject, update, refund)
6. **Cross-chain ready**: works across relayers/wallets
7. **Authority keys** enable delegated backend signing

## Notes

- Metadata is off-chain, anchored via hash on-chain
- Admin is managed via multisig (Squads recommended)
- Fully permissionless: anyone can submit, verifiers/admins gate activation
- SDK provides metadata validation helpers, account fetchers, and transaction builders