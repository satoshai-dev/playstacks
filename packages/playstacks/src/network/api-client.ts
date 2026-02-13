import type { ResolvedNetwork } from './network-config.js';

export interface AccountInfo {
  balance: string;
  nonce: number;
}

export interface TransactionStatus {
  tx_id: string;
  tx_status: 'success' | 'abort_by_response' | 'abort_by_post_condition' | 'pending';
  tx_type: string;
  block_height?: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Stacks API error ${response.status}: ${url}\n${body}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchAccountInfo(
  network: ResolvedNetwork,
  address: string
): Promise<AccountInfo> {
  return fetchJson<AccountInfo>(`${network.apiUrl}/v2/accounts/${address}?proof=0`);
}

export async function fetchBalance(
  network: ResolvedNetwork,
  address: string
): Promise<bigint> {
  const info = await fetchAccountInfo(network, address);
  return BigInt(info.balance);
}

export async function fetchNonce(
  network: ResolvedNetwork,
  address: string
): Promise<bigint> {
  const info = await fetchAccountInfo(network, address);
  return BigInt(info.nonce);
}

export async function fetchTransactionStatus(
  network: ResolvedNetwork,
  txid: string
): Promise<TransactionStatus> {
  return fetchJson<TransactionStatus>(
    `${network.apiUrl}/extended/v1/tx/${txid}`
  );
}

export async function fetchTransferFeeRate(
  network: ResolvedNetwork
): Promise<bigint> {
  const result = await fetchJson<{ fee_rate: number }>(
    `${network.apiUrl}/v2/fees/transfer`
  );
  return BigInt(result.fee_rate);
}

export interface FeeEstimation {
  estimations: Array<{
    fee_rate: number;
    fee: number;
  }>;
}

export async function fetchTransactionFeeEstimate(
  network: ResolvedNetwork,
  transactionPayloadHex: string,
  estimatedLen: number
): Promise<FeeEstimation> {
  const response = await fetch(`${network.apiUrl}/v2/fees/transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transaction_payload: transactionPayloadHex,
      estimated_len: estimatedLen,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Fee estimation failed ${response.status}: ${body}`);
  }

  return response.json() as Promise<FeeEstimation>;
}
