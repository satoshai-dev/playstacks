/** JSON-RPC request shape used by Leather/Xverse/StacksProvider */
export interface WalletRpcRequest {
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC response returned to the dApp */
export interface WalletRpcResponse {
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

/** Address info returned by getAddresses */
export interface AddressInfo {
  address: string;
  publicKey: string;
  /** Purpose for WBIP/xverse compatibility */
  purpose: string;
  /** Address type for Zest's extractAndValidateStacksAddress */
  addressType: string;
  /** Symbol for Leather compatibility */
  symbol?: string;
}

/** Result shape for getAddresses */
export interface GetAddressesResult {
  addresses: AddressInfo[];
}

/** Params for stx_transferStx */
export interface TransferStxParams {
  recipient: string;
  amount: string; // microstacks as string
  memo?: string;
  network?: string;
}

/** Params for stx_callContract */
export interface CallContractParams {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: string[]; // hex-encoded Clarity values
  network?: string;
  postConditions?: string[]; // hex-encoded post conditions
  postConditionMode?: 'allow' | 'deny';
}

/** Broadcast result returned to dApp */
export interface BroadcastResult {
  txid: string;
}

/** Wallet identity derived from private key (internal — includes private key) */
export interface WalletIdentity {
  address: string;
  publicKey: string;
  privateKey: string;
}

/** Public wallet info exposed to tests */
export interface WalletInfo {
  address: string;
  publicKey: string;
}
