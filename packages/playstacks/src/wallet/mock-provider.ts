import {
  makeSTXTokenTransfer,
  makeContractCall,
  hexToCV,
  serializePayloadBytes,
  PostConditionMode,
  signMessageHashRsv,
  signStructuredData,
  deserializeTransaction,
  TransactionSigner,
  serializeTransaction,
} from '@stacks/transactions';
import type { Page } from '@playwright/test';

import type { ResolvedConfig } from '../config.js';
import { resolveNetwork, type ResolvedNetwork } from '../network/network-config.js';
import { deriveWalletIdentity } from './key-manager.js';
import {
  estimateTransferFee,
  estimateContractCallFee,
} from '../fees/fee-estimator.js';
import { broadcast } from '../tx/broadcaster.js';
import { getMockProviderScript } from './mock-provider-script.js';
import { hashMessage } from './message-hash.js';
import { NonceTracker } from './nonce-tracker.js';
import type {
  WalletIdentity,
  WalletRpcRequest,
  TransferStxParams,
  CallContractParams,
  GetAddressesResult,
  BroadcastResult,
  SignMessageParams,
  SignMessageResult,
  SignStructuredMessageParams,
  SignStructuredMessageResult,
  SignTransactionParams,
  SignTransactionResult,
} from './types.js';

export class MockProviderHandler {
  readonly identity: WalletIdentity;
  readonly network: ResolvedNetwork;
  private readonly config: ResolvedConfig;
  private readonly nonceTracker: NonceTracker;
  private shouldRejectNext = false;
  /** Last broadcast transaction ID, set after successful broadcast */
  lastTxId: string | null = null;

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.network = resolveNetwork(config.network);

    const isMainnet = this.network.stacksNetwork === 'mainnet';
    this.identity = deriveWalletIdentity(config.privateKey, isMainnet);
    this.nonceTracker = new NonceTracker(this.network, this.identity.address);
  }

  /** Reset nonce tracking. Call between tests to avoid stale nonces. */
  resetNonce(): void {
    this.nonceTracker.reset();
  }

  /**
   * Flag the next .request() call to throw a user rejection error.
   * Used for testing wallet rejection flows.
   */
  rejectNext(): void {
    this.shouldRejectNext = true;
  }

  /**
   * Install the mock provider on a Playwright page.
   * 1. Expose the Node-side handler as a browser function
   * 2. Inject the browser-side provider script
   */
  async install(page: Page): Promise<void> {
    // Expose the bridge function that the browser script calls
    await page.exposeFunction(
      '__playstacksRequest',
      (requestJson: string) => this.handleRequest(requestJson)
    );

    // Inject the mock provider script that runs before any dApp code
    const script = getMockProviderScript(
      this.identity.address,
      this.identity.publicKey
    );
    await page.addInitScript({ content: script });
  }

  /**
   * Handle a JSON-RPC request from the browser.
   * Returns a JSON string with { result } or { error }.
   */
  private async handleRequest(requestJson: string): Promise<string> {
    try {
      const request: WalletRpcRequest = JSON.parse(requestJson);

      // Check for rejection flag — only applies to action methods (sign/send),
      // not read-only methods like getAddresses which dApps call in the background.
      const isReadOnly = ['getAddresses', 'stx_getAddresses', 'wallet_connect']
        .includes(request.method);
      if (this.shouldRejectNext && !isReadOnly) {
        this.shouldRejectNext = false;
        return JSON.stringify({
          error: { code: 4001, message: 'User rejected the request' },
        });
      }

      const result = await this.dispatch(request.method, request.params ?? {});
      return JSON.stringify({ result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';
      console.error(`[Playstacks] Handler error: ${message}\n${stack}`);
      return JSON.stringify({
        error: { code: -32603, message },
      });
    }
  }

  /**
   * Route a wallet method to its handler.
   */
  private async dispatch(
    method: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    switch (method) {
      case 'getAddresses':
      case 'stx_getAddresses':
      case 'wallet_connect':
        return this.handleGetAddresses();
      case 'stx_transferStx':
        return this.handleTransferStx(params as unknown as TransferStxParams);
      case 'stx_callContract':
        return this.handleCallContract(this.normalizeCallContractParams(params));
      case 'stx_signMessage':
        return this.handleSignMessage(params as unknown as SignMessageParams);
      case 'stx_signStructuredMessage':
        return this.handleSignStructuredMessage(
          params as unknown as SignStructuredMessageParams
        );
      case 'stx_signTransaction':
        return this.handleSignTransaction(
          params as unknown as SignTransactionParams
        );
      default:
        throw new Error(`Unsupported wallet method: ${method}`);
    }
  }

  /**
   * Normalize contract call params from @stacks/connect format.
   * @stacks/connect sends { contract: "SPaddr.name", functionArgs, ... }
   * but we need { contractAddress, contractName, functionArgs, ... }
   */
  private normalizeCallContractParams(
    params: Record<string, unknown>
  ): CallContractParams {
    // @stacks/connect format: contract = "SPaddr.name"
    if (typeof params.contract === 'string' && !params.contractAddress) {
      const [contractAddress, ...rest] = params.contract.split('.');
      const contractName = rest.join('.');
      return {
        contractAddress,
        contractName,
        functionName: params.functionName as string,
        functionArgs: (params.functionArgs ?? []) as string[],
        postConditions: params.postConditions as string[] | undefined,
        postConditionMode: params.postConditionMode as 'allow' | 'deny' | undefined,
      };
    }
    // Already in our format
    return params as unknown as CallContractParams;
  }

  private handleGetAddresses(): GetAddressesResult {
    return {
      addresses: [
        // Index 0: BTC payment (p2wpkh) — placeholder for Xverse compatibility
        {
          address: 'bc1q-placeholder-btc-payment',
          publicKey: this.identity.publicKey,
          purpose: 'payment',
          addressType: 'p2wpkh',
          symbol: 'BTC',
        },
        // Index 1: BTC ordinals (p2tr) — placeholder for Xverse compatibility
        {
          address: 'bc1p-placeholder-btc-ordinals',
          publicKey: this.identity.publicKey,
          purpose: 'ordinals',
          addressType: 'p2tr',
          symbol: 'BTC',
        },
        // Index 2: STX address — the real one
        // Apps find this by: index [2], symbol === 'STX', purpose/addressType === 'stacks',
        // or address.startsWith('S')
        {
          address: this.identity.address,
          publicKey: this.identity.publicKey,
          purpose: 'stacks',
          addressType: 'stacks',
          symbol: 'STX',
        },
      ],
    };
  }

  private async handleTransferStx(
    params: TransferStxParams
  ): Promise<BroadcastResult> {
    const { fee: estimatedFee } = await estimateTransferFee(
      this.network,
      this.config.fee
    );

    const nonce = await this.nonceTracker.getNextNonce();

    const transaction = await makeSTXTokenTransfer({
      recipient: params.recipient,
      amount: BigInt(params.amount),
      senderKey: this.identity.privateKey,
      network: this.network.stacksNetwork,
      fee: estimatedFee,
      nonce,
      memo: params.memo,
    });

    const result = await broadcast(transaction, this.network);
    this.nonceTracker.increment();
    this.lastTxId = result.txid;
    return result;
  }

  private async handleCallContract(
    params: CallContractParams
  ): Promise<BroadcastResult> {
    // Deserialize Clarity value args from hex strings
    const functionArgs = params.functionArgs.map((hexArg) => hexToCV(hexArg));

    const commonOpts = {
      contractAddress: params.contractAddress,
      contractName: params.contractName,
      functionName: params.functionName,
      functionArgs,
      senderKey: this.identity.privateKey,
      network: this.network.stacksNetwork,
      postConditionMode:
        params.postConditionMode === 'allow'
          ? PostConditionMode.Allow
          : PostConditionMode.Deny,
      // Post conditions can be hex strings — makeContractCall v7 handles deserialization
      postConditions: params.postConditions,
    };

    const nonce = await this.nonceTracker.getNextNonce();

    // First pass: build unsigned tx to estimate fee
    const unsignedTx = await makeContractCall({
      ...commonOpts,
      fee: 0n,
      nonce,
    });

    // Estimate fee using the serialized payload
    const payloadBytes = serializePayloadBytes(unsignedTx.payload);
    const serializedUnsigned = unsignedTx.serialize();
    const { fee: estimatedFee } = await estimateContractCallFee(
      this.network,
      this.config.fee,
      payloadBytes,
      serializedUnsigned.length
    );

    // Second pass: build with correct fee and sign
    const transaction = await makeContractCall({
      ...commonOpts,
      fee: estimatedFee,
      nonce,
    });

    const result = await broadcast(transaction, this.network);
    this.nonceTracker.increment();
    this.lastTxId = result.txid;
    return result;
  }

  private handleSignMessage(params: SignMessageParams): SignMessageResult {
    const messageHash = hashMessage(params.message);
    const signature = signMessageHashRsv({
      messageHash,
      privateKey: this.identity.privateKey,
    });
    return { signature, publicKey: this.identity.publicKey };
  }

  private handleSignStructuredMessage(
    params: SignStructuredMessageParams
  ): SignStructuredMessageResult {
    // Wallet sends hex without 0x prefix; hexToCV needs it
    const domainHex = params.domain.startsWith('0x')
      ? params.domain
      : `0x${params.domain}`;
    const messageHex = params.message.startsWith('0x')
      ? params.message
      : `0x${params.message}`;

    const domain = hexToCV(domainHex);
    const message = hexToCV(messageHex);

    const signature = signStructuredData({
      message,
      domain,
      privateKey: this.identity.privateKey,
    });
    return { signature, publicKey: this.identity.publicKey };
  }

  private handleSignTransaction(
    params: SignTransactionParams
  ): SignTransactionResult {
    const txHex = params.transaction.startsWith('0x')
      ? params.transaction
      : `0x${params.transaction}`;

    const tx = deserializeTransaction(txHex);
    const signer = new TransactionSigner(tx);
    signer.signOrigin(this.identity.privateKey);

    const signedHex = serializeTransaction(signer.getTxInComplete());
    return { transaction: signedHex };
  }
}
