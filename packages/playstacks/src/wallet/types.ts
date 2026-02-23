/** JSON-RPC request shape used by Xverse/StacksProvider */
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
  /** Purpose for Xverse compatibility */
  purpose: string;
  /** Address type for Zest's extractAndValidateStacksAddress */
  addressType: string;
  /** Symbol for address validation (STX) */
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

/** Params for stx_signMessage */
export interface SignMessageParams {
  message: string;
}

/** Result for stx_signMessage */
export interface SignMessageResult {
  signature: string;
  publicKey: string;
}

/** Params for stx_signStructuredMessage (SIP-018) */
export interface SignStructuredMessageParams {
  message: string; // hex-encoded ClarityValue
  domain: string; // hex-encoded ClarityValue
}

/** Result for stx_signStructuredMessage */
export interface SignStructuredMessageResult {
  signature: string;
  publicKey: string;
}

/** Params for stx_signTransaction */
export interface SignTransactionParams {
  transaction: string; // hex-encoded serialized tx
}

/** Result for stx_signTransaction */
export interface SignTransactionResult {
  transaction: string; // hex-encoded signed tx
}

/** Public wallet info exposed to tests */
export interface WalletInfo {
  address: string;
  publicKey: string;
}
