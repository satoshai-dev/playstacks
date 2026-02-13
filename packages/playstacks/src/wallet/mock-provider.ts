import {
  makeSTXTokenTransfer,
  makeContractCall,
  hexToCV,
  serializePayloadBytes,
  PostConditionMode,
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
import type {
  WalletIdentity,
  WalletRpcRequest,
  TransferStxParams,
  CallContractParams,
  GetAddressesResult,
  BroadcastResult,
} from './types.js';

export class MockProviderHandler {
  readonly identity: WalletIdentity;
  readonly network: ResolvedNetwork;
  private readonly config: ResolvedConfig;
  private shouldRejectNext = false;
  /** Last broadcast transaction ID, set after successful broadcast */
  lastTxId: string | null = null;

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.network = resolveNetwork(config.network);

    const isMainnet = this.network.stacksNetwork === 'mainnet';
    this.identity = deriveWalletIdentity(config.privateKey, isMainnet);
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

      // Check for rejection flag
      if (this.shouldRejectNext) {
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
        {
          address: this.identity.address,
          publicKey: this.identity.publicKey,
          // Fields needed by different consumers:
          // - @stacks/connect: uses address string (startsWith 'S')
          // - Zest extractAndValidateStacksAddress: checks purpose/addressType === 'stacks'
          // - Zest extractStacksAddress: checks symbol === 'STX' or address.startsWith('S')
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

    const transaction = await makeSTXTokenTransfer({
      recipient: params.recipient,
      amount: BigInt(params.amount),
      senderKey: this.identity.privateKey,
      network: this.network.stacksNetwork,
      fee: estimatedFee,
      memo: params.memo,
    });

    const result = await broadcast(transaction, this.network);
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

    // First pass: build unsigned tx to estimate fee
    const unsignedTx = await makeContractCall({
      ...commonOpts,
      fee: 0n,
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
    });

    const result = await broadcast(transaction, this.network);
    this.lastTxId = result.txid;
    return result;
  }
}
