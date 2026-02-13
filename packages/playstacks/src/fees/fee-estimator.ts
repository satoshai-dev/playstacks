import type { ResolvedConfig } from '../config.js';
import type { ResolvedNetwork } from '../network/network-config.js';
import {
  fetchTransferFeeRate,
  fetchTransactionFeeEstimate,
} from '../network/api-client.js';

export interface EstimatedFee {
  /** Final fee in microstacks */
  fee: bigint;
  /** How the fee was determined */
  source: 'fixed' | 'estimated' | 'capped';
}

/**
 * Estimate fee for an STX transfer.
 * Uses /v2/fees/transfer endpoint.
 */
export async function estimateTransferFee(
  network: ResolvedNetwork,
  feeConfig: ResolvedConfig['fee']
): Promise<EstimatedFee> {
  if (feeConfig.fixed !== undefined) {
    return { fee: BigInt(feeConfig.fixed), source: 'fixed' };
  }

  const feeRate = await fetchTransferFeeRate(network);
  const rawFee = feeRate; // fee_rate is already in microstacks for transfers
  const adjusted = BigInt(Math.ceil(Number(rawFee) * feeConfig.multiplier));
  const maxFee = BigInt(feeConfig.maxFee);

  if (adjusted > maxFee) {
    return { fee: maxFee, source: 'capped' };
  }
  return { fee: adjusted, source: 'estimated' };
}

/** Convert a Uint8Array to hex string */
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Estimate fee for a contract call or other transaction type.
 * Two-pass: build unsigned tx first, then estimate using serialized payload.
 */
export async function estimateContractCallFee(
  network: ResolvedNetwork,
  feeConfig: ResolvedConfig['fee'],
  serializedPayload: Uint8Array,
  estimatedLen: number
): Promise<EstimatedFee> {
  if (feeConfig.fixed !== undefined) {
    return { fee: BigInt(feeConfig.fixed), source: 'fixed' };
  }

  const payloadHex = uint8ArrayToHex(serializedPayload);
  const estimation = await fetchTransactionFeeEstimate(
    network,
    payloadHex,
    estimatedLen
  );

  // Use the middle tier estimation (index 1) if available, else first
  const estimates = estimation.estimations;
  const chosen =
    estimates.length >= 2 ? estimates[1] : estimates[0];

  if (!chosen) {
    // Fallback: use a reasonable default fee
    return { fee: BigInt(feeConfig.maxFee), source: 'capped' };
  }

  const rawFee = BigInt(chosen.fee);
  const adjusted = BigInt(Math.ceil(Number(rawFee) * feeConfig.multiplier));
  const maxFee = BigInt(feeConfig.maxFee);

  if (adjusted > maxFee) {
    return { fee: maxFee, source: 'capped' };
  }
  return { fee: adjusted, source: 'estimated' };
}
