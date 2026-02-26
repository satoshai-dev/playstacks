import type { ResolvedNetwork } from '../network/network-config.js';
import { fetchNonce } from '../network/api-client.js';

/**
 * Tracks nonces locally to allow sending multiple transactions
 * without waiting for each to confirm.
 *
 * On first use, fetches the current nonce from the chain.
 * After each broadcast, increments the local counter so the
 * next transaction uses nonce + 1.
 */
export class NonceTracker {
  private readonly network: ResolvedNetwork;
  private readonly address: string;
  private nextNonce: bigint | null = null;

  constructor(network: ResolvedNetwork, address: string) {
    this.network = network;
    this.address = address;
  }

  /**
   * Get the next nonce to use for a transaction.
   * Fetches from the chain on first call, then increments locally.
   */
  async getNextNonce(): Promise<bigint> {
    if (this.nextNonce === null) {
      this.nextNonce = await fetchNonce(this.network, this.address);
    }
    return this.nextNonce;
  }

  /**
   * Mark the current nonce as used (call after successful broadcast).
   * Increments the local counter for the next transaction.
   */
  increment(): void {
    if (this.nextNonce !== null) {
      this.nextNonce += 1n;
    }
  }

  /** Reset to fetch from chain again on next call. */
  reset(): void {
    this.nextNonce = null;
  }
}
