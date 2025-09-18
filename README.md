# Action Codes Protocol Prefix Registry

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Anchor](https://img.shields.io/badge/Anchor-0.31.1-blue.svg)](https://github.com/coral-xyz/anchor)

> Solana program implementing [AIP-4](https://docs.ota.codes/aips/aip-4) - Prefix System with verification, fee-on-submit, authority keys, and metadata anchoring.

## Overview

On-chain prefix registry for Solana implementing [AIP-4](https://docs.ota.codes/aips/aip-4). Manages prefix submissions with immediate fee payment, verifier approvals, and canonical prefix records with authority keys for code signature verification.

## Core Concepts

- **Prefix Registration**: Submit prefix requests (3-12 uppercase alphanumeric) with off-chain metadata anchored by on-chain hash
- **Fee-on-Submit**: Immediate fee payment prevents spam and ensures commitment
- **Verifier Workflow**: Manual approval process with configurable verifier list
- **Authority Keys**: On-chain storage of keys authorized to sign codes for each prefix
- **Governance**: Admin-controlled via multisig (Squads) with possibility to add new verifiers and decentralize the process

## Program Structure

- **FeeRegistry**: Dynamic fee management
- **VerifiersList**: Verifier management
- **PendingPrefixAccount**: Escrow for prefix submissions with fee collection
- **PrefixAccount**: Final canonical prefix records with authority keys

## Workflow

1. **Submit**: User submits prefix with metadata URI, hash, and pays fee immediately
2. **Approve**: Verifiers validate metadata against schema and approve/reject submissions
3. **Finalize**: Admin creates final PrefixAccount with authority keys and metadata hash
4. **Verify**: Relayers verify code signatures using authority_keys from PrefixAccount

## License

Apache License 2.0 - see [LICENSE](./LICENSE) file for details.

## Contact

- **Project lead**: [Efe Behar](mailto:efe@trana.network)
- **Initial verifier**: [Trana Inc.](mailto:ops@trana.network)
