import { PrefixSystemClientError } from "./errors";
import { MAX_URI_LEN, MAX_PREFIX_LEN, MIN_PREFIX_LEN } from "./constants";

/**
 * Validate metadata URI
 * Must start with https:// or ipfs://
 * Max length MAX_URI_LEN (protocol constraint)
 */
export function validateMetadataUri(uri: string): void {
  if (!uri.startsWith("https://") && !uri.startsWith("ipfs://")) {
    throw new PrefixSystemClientError(
      `Invalid metadata URI: must start with https:// or ipfs:// (${uri})`
    );
  }
  if (uri.length > MAX_URI_LEN) {
    throw new PrefixSystemClientError(
      `Invalid metadata URI: exceeds MAX_URI_LEN characters (${MAX_URI_LEN})`
    );
  }
}

/**
 * Validate metadata hash
 * Must be exactly 32 bytes
 */
export function validateMetadataHash(hash: number[] | Uint8Array): void {
  if (hash.length !== 32) {
    throw new PrefixSystemClientError(
      `Invalid metadata hash: must be exactly 32 bytes`
    );
  }
}

/**
 * Validate prefix
 * Must be between MIN_PREFIX_LEN and MAX_PREFIX_LEN characters
 * Must be alphanumeric
 */
export function validatePrefix(prefix: string): void {
  if (prefix.length < MIN_PREFIX_LEN || prefix.length > MAX_PREFIX_LEN) {
    throw new PrefixSystemClientError(
      `Invalid prefix: must be between ${MIN_PREFIX_LEN} and ${MAX_PREFIX_LEN} characters`
    );
  }

  if (!/^[A-Z0-9]+$/.test(prefix)) {
    throw new PrefixSystemClientError(
      `Invalid prefix: must be alphanumeric and between ${MIN_PREFIX_LEN} and ${MAX_PREFIX_LEN} characters`
    );
  }
}
