import type { PublicKey, AccountInfo } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export interface FeeRegistry {
  admin: PublicKey;
  currentFee: BN;
  pause: boolean;
  bump: number;
  createdAt: BN;
  updatedAt: BN;
}

export interface VerifiersList {
  admin: PublicKey;
  verifiers: PublicKey[];
  bump: number;
  createdAt: BN;
  updatedAt: BN;
}

export type Treasury = AccountInfo<Buffer>;

export class PrefixStatus {
  static readonly Pending = { pending: {} };
  static readonly Active = { active: {} };
  static readonly Rejected = { rejected: {} };
  static readonly Inactive = { inactive: {} };
}

export interface PrefixAccount {
  owner: PublicKey;
  prefix: String; // normalized uppercase key used in PDA
  metadataUri: String;
  metadataHash: Buffer;
  refHash: Buffer; // approval or rejection reference hash
  status: PrefixStatus;
  authorityKeys: PublicKey[];
  feePaid: BN;
  expiryAt?: BN;
  createdAt: BN;
  updatedAt: BN;
  bump: number;
}
