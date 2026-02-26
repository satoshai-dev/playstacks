import { test as base } from '@playwright/test';
import type { ClarityValue } from '@stacks/transactions';

import {
  type PlaystacksConfig,
  resolveConfig,
  isMnemonicConfig,
} from './config.js';
import { MockProviderHandler } from './wallet/mock-provider.js';
import { derivePrivateKeyFromMnemonic } from './wallet/key-manager.js';
import { fetchBalance, fetchNonce } from './network/api-client.js';
import { waitForConfirmation, type ConfirmationResult } from './tx/confirmation.js';
import { callReadOnly, type ReadOnlyCallOptions } from './helpers/read-only.js';

/** The stacks fixture exposed to tests */
export interface StacksFixture {
  wallet: {
    /** STX address derived from the private key */
    address: string;
    /** Public key hex */
    publicKey: string;
    /** Flag the next wallet request to throw a user rejection error */
    rejectNext: () => void;
    /** Last broadcast transaction ID (set after successful tx) */
    lastTxId: () => string | null;
  };

  /** Wait for a transaction to reach a terminal status */
  waitForTx: (txid: string) => Promise<ConfirmationResult>;

  /** Call a read-only Clarity function */
  callReadOnly: (options: ReadOnlyCallOptions) => Promise<ClarityValue>;

  /** Get STX balance in microstacks */
  getBalance: (address?: string) => Promise<bigint>;

  /** Get account nonce */
  getNonce: (address?: string) => Promise<bigint>;
}

export interface StacksFixtures {
  stacks: StacksFixture;
}

/**
 * Create a Playwright test function with Stacks wallet fixtures.
 *
 * @example
 * ```ts
 * // With mnemonic (same seed phrase as your Xverse wallet)
 * const test = testWithStacks({
 *   mnemonic: process.env.TEST_MNEMONIC!,
 *   accountIndex: 0,
 *   network: 'mainnet',
 * });
 *
 * // With private key
 * const test = testWithStacks({
 *   privateKey: process.env.TEST_STX_KEY!,
 *   network: 'testnet',
 * });
 * ```
 */
export function testWithStacks(config: PlaystacksConfig) {
  // Mnemonic derivation is async, so we resolve it lazily in the fixture
  let resolvedConfigPromise: Promise<ReturnType<typeof resolveConfig>> | null = null;

  async function getResolvedConfig() {
    if (isMnemonicConfig(config)) {
      const privateKey = await derivePrivateKeyFromMnemonic(
        config.mnemonic,
        config.accountIndex ?? 0
      );
      return resolveConfig(config, privateKey);
    }
    return resolveConfig(config);
  }

  return base.extend<StacksFixtures>({
    stacks: async ({ page }, use) => {
      if (!resolvedConfigPromise) {
        resolvedConfigPromise = getResolvedConfig();
      }
      const resolved = await resolvedConfigPromise;
      const handler = new MockProviderHandler(resolved);

      // Install the mock provider before any navigation
      await handler.install(page);

      const network = handler.network;

      const fixture: StacksFixture = {
        wallet: {
          address: handler.identity.address,
          publicKey: handler.identity.publicKey,
          rejectNext: () => handler.rejectNext(),
          lastTxId: () => handler.lastTxId,
        },

        waitForTx: (txid: string) =>
          waitForConfirmation(network, txid, resolved.confirmation, resolved.requestTimeout),

        callReadOnly: (options: ReadOnlyCallOptions) =>
          callReadOnly(network, options, handler.identity.address),

        getBalance: (address?: string) =>
          fetchBalance(network, address ?? handler.identity.address, resolved.requestTimeout),

        getNonce: (address?: string) =>
          fetchNonce(network, address ?? handler.identity.address, resolved.requestTimeout),
      };

      await use(fixture);
    },
  });
}
