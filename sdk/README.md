# Prefix System SDK

A TypeScript SDK for interacting with the Prefix System Solana program. This SDK provides a clean, type-safe interface for managing prefix registrations, verifications, and administrative functions.

## 🚀 Quick Start

### Installation

```bash
npm install @actioncodes/prefix-system
# or
yarn add @actioncodes/prefix-system
# or
pnpm add @actioncodes/prefix-system
```

### Basic Usage

```typescript
import { PrefixSystemClient } from "@actioncodes/prefix-system";
import { Connection, Keypair } from "@solana/web3.js";

// Initialize client
const connection = new Connection("https://api.mainnet-beta.solana.com");
const wallet = new Wallet(keypair);
const client = new PrefixSystemClient({
  cluster: "mainnet-beta",
  connection,
  wallet,
});

// Submit a prefix
const signature = createEd25519Signature(owner, metadataHash);
const tx = await client.submitPrefixWithFee(
  keypair.publicKey,
  "MYAPP",
  "https://example.com/metadata.json",
  metadataHash,
  signature,
  authorityKeys
);
await connection.sendAndConfirmTransaction(tx, [keypair]);
```

## 📚 Documentation

- **[Client API](./docs/client.md)** - Complete client reference
- **[Types](./docs/types.md)** - TypeScript type definitions
- **[Validation](./docs/validation.md)** - Input validation utilities
- **[Errors](./docs/errors.md)** - Error handling guide

## 🏗️ Architecture

The Prefix System SDK is built on top of the Anchor framework and provides:

- **Type Safety**: Full TypeScript support with generated types
- **Error Handling**: Comprehensive error types and utilities
- **Validation**: Client-side input validation
- **Testing Support**: Built-in testing utilities

## 🔧 Development

### Building

```bash
# Build the program and copy IDL files
npm run build

# Copy IDL files only
npm run copy-idl
```

### Testing

```bash
# Run SDK tests
npm run test:sdk
```

## 📦 Program IDs

| Environment | Program ID |
|-------------|------------|
| Mainnet | `otac5xyDhtoUWRXi36R9QN8Q9rW89QNJfUQDrZyiidh` |
| Devnet | `otac5xyDhtoUWRXi36R9QN8Q9rW89QNJfUQDrZyiidh` |
| Localnet | `otac5xyDhtoUWRXi36R9QN8Q9rW89QNJfUQDrZyiidh` |

## 🔗 Links

- **Program**: [GitHub Repository](https://github.com/otaprotocol/prefix-system)
- **Documentation**: [Action Codes Protocol](https://docs.ota.codes)
- **Support**: [Trana Inc.](mailto:ops@trana.network)

## 📄 License

Apache-2.0
