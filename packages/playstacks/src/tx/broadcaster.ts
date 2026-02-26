import {
  broadcastTransaction as stacksBroadcast,
  type StacksTransactionWire,
} from '@stacks/transactions';
import type { ResolvedNetwork } from '../network/network-config.js';
import { BroadcastError } from '../errors.js';

export interface BroadcastResult {
  txid: string;
}

/**
 * Broadcast a signed transaction to the Stacks network.
 * Returns the txid on success, throws on failure with a descriptive error.
 */
export async function broadcast(
  transaction: StacksTransactionWire,
  network: ResolvedNetwork
): Promise<BroadcastResult> {
  // v7 API: broadcastTransaction({ transaction, network, client })
  const result = await stacksBroadcast({
    transaction,
    network: network.stacksNetwork,
  });

  if (typeof result === 'string') {
    return { txid: result };
  }

  if (typeof result === 'object' && result && 'txid' in result) {
    return { txid: (result as { txid: string }).txid };
  }

  const errorStr = JSON.stringify(result);
  throw new BroadcastError(`Transaction broadcast failed: ${errorStr}`, errorStr);
}
