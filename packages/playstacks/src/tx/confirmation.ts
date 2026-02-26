import type { ResolvedConfig } from '../config.js';
import type { ResolvedNetwork } from '../network/network-config.js';
import { fetchTransactionStatus } from '../network/api-client.js';

/** Terminal transaction status on the Stacks network */
export type TxStatus = 'success' | 'abort_by_response' | 'abort_by_post_condition';

export interface ConfirmationResult {
  txid: string;
  status: TxStatus;
  blockHeight?: number;
}

/**
 * Poll for a transaction to reach a terminal status (success or abort).
 * Throws if the timeout is reached before the tx is confirmed.
 */
export async function waitForConfirmation(
  network: ResolvedNetwork,
  txid: string,
  config: ResolvedConfig['confirmation'],
  requestTimeout?: number,
): Promise<ConfirmationResult> {
  const start = Date.now();
  const normalizedTxid = txid.startsWith('0x') ? txid : `0x${txid}`;

  while (Date.now() - start < config.timeout) {
    try {
      const status = await fetchTransactionStatus(network, normalizedTxid, requestTimeout);

      if (status.tx_status !== 'pending') {
        return {
          txid: normalizedTxid,
          status: status.tx_status,
          blockHeight: status.block_height,
        };
      }
    } catch {
      // Transaction may not be indexed yet, keep polling
    }

    await sleep(config.pollInterval);
  }

  throw new Error(
    `Transaction ${normalizedTxid} did not confirm within ${config.timeout}ms`
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
