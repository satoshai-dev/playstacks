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

function createTimeoutSignal(timeoutMs?: number): AbortSignal | undefined {
  if (timeoutMs === undefined || timeoutMs <= 0) return undefined;
  return AbortSignal.timeout(timeoutMs);
}

async function fetchJson<T>(url: string, timeoutMs?: number): Promise<T> {
  const response = await fetch(url, {
    signal: createTimeoutSignal(timeoutMs),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Stacks API error ${response.status}: ${url}\n${body}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchAccountInfo(
  network: ResolvedNetwork,
  address: string,
  timeoutMs?: number,
): Promise<AccountInfo> {
  return fetchJson<AccountInfo>(`${network.apiUrl}/v2/accounts/${address}?proof=0`, timeoutMs);
}

export async function fetchBalance(
  network: ResolvedNetwork,
  address: string,
  timeoutMs?: number,
): Promise<bigint> {
  const info = await fetchAccountInfo(network, address, timeoutMs);
  return BigInt(info.balance);
}

export async function fetchNonce(
  network: ResolvedNetwork,
  address: string,
  timeoutMs?: number,
): Promise<bigint> {
  const info = await fetchAccountInfo(network, address, timeoutMs);
  return BigInt(info.nonce);
}

export async function fetchTransactionStatus(
  network: ResolvedNetwork,
  txid: string,
  timeoutMs?: number,
): Promise<TransactionStatus> {
  return fetchJson<TransactionStatus>(
    `${network.apiUrl}/extended/v1/tx/${txid}`,
    timeoutMs,
  );
}

export async function fetchTransferFeeRate(
  network: ResolvedNetwork,
  timeoutMs?: number,
): Promise<bigint> {
  const result = await fetchJson<{ fee_rate: number }>(
    `${network.apiUrl}/v2/fees/transfer`,
    timeoutMs,
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
  estimatedLen: number,
  timeoutMs?: number,
): Promise<FeeEstimation> {
  const response = await fetch(`${network.apiUrl}/v2/fees/transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transaction_payload: transactionPayloadHex,
      estimated_len: estimatedLen,
    }),
    signal: createTimeoutSignal(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Fee estimation failed ${response.status}: ${body}`);
  }

  return response.json() as Promise<FeeEstimation>;
}
