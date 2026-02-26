import { test as base } from '@playwright/test';
import type { ClarityValue } from '@stacks/transactions';

import {
  type PlaystacksConfig,
  type NetworkOption,
  type FeeConfig,
  type ConfirmationConfig,
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

/**
 * Playwright config-level options for Stacks.
 * Set these in `playwright.config.ts` `use` block.
 *
 * @example
 * ```ts
 * // playwright.config.ts
 * export default defineConfig({
 *   use: {
 *     stacksPrivateKey: process.env.TEST_STX_KEY!,
 *     stacksNetwork: 'testnet',
 *     stacksFeeMultiplier: 2,
 *   },
 * });
 * ```
 */
export interface PlaystacksOptions {
  /** Hex-encoded private key */
  stacksPrivateKey: string | undefined;
  /** BIP-39 mnemonic phrase */
  stacksMnemonic: string | undefined;
  /** Account index for mnemonic derivation. Default: 0 */
  stacksAccountIndex: number;
  /** Network to connect to */
  stacksNetwork: NetworkOption | undefined;
  /** Fee multiplier. Default: 1.0 */
  stacksFeeMultiplier: number;
  /** Max fee in microstacks. Default: 500_000 */
  stacksFeeMax: number;
  /** Fixed fee in microstacks. Skips estimation when set. */
  stacksFeeFixed: number | undefined;
  /** Tx confirmation timeout in ms. Default: 120_000 */
  stacksConfirmationTimeout: number;
  /** Tx confirmation poll interval in ms. Default: 2_000 */
  stacksConfirmationPollInterval: number;
  /** Request timeout in ms for API calls. Default: 30_000 */
  stacksRequestTimeout: number;
}

export interface StacksFixtures {
  stacks: StacksFixture;
}

/** Build a PlaystacksConfig from Playwright options, with file-level overrides merged on top */
function buildConfigFromOptions(
  options: PlaystacksOptions,
  overrides?: Partial<PlaystacksConfig>,
): PlaystacksConfig {
  const network = overrides?.network ?? options.stacksNetwork;
  if (!network) {
    throw new Error(
      'Stacks network is required. Set stacksNetwork in playwright.config.ts use block or pass network to testWithStacks().'
    );
  }

  const fee: FeeConfig = {
    multiplier: options.stacksFeeMultiplier,
    maxFee: options.stacksFeeMax,
    fixed: options.stacksFeeFixed,
    ...overrides?.fee,
  };

  const confirmation: ConfirmationConfig = {
    timeout: options.stacksConfirmationTimeout,
    pollInterval: options.stacksConfirmationPollInterval,
    ...overrides?.confirmation,
  };

  const requestTimeout = overrides?.requestTimeout ?? options.stacksRequestTimeout;

  // Determine key source: file-level overrides take precedence over config-level
  const privateKey = (overrides && 'privateKey' in overrides && overrides.privateKey)
    ? overrides.privateKey as string
    : options.stacksPrivateKey;
  const mnemonic = (overrides && 'mnemonic' in overrides && overrides.mnemonic)
    ? overrides.mnemonic as string
    : options.stacksMnemonic;
  const accountIndex = (overrides && 'accountIndex' in overrides && overrides.accountIndex !== undefined)
    ? overrides.accountIndex as number
    : options.stacksAccountIndex;

  if (mnemonic) {
    return { mnemonic, accountIndex, network, fee, confirmation, requestTimeout };
  }
  if (privateKey) {
    return { privateKey, network, fee, confirmation, requestTimeout };
  }

  throw new Error(
    'Stacks private key or mnemonic is required. Set stacksPrivateKey/stacksMnemonic in playwright.config.ts use block or pass privateKey/mnemonic to testWithStacks().'
  );
}

/** Resolve config (handling async mnemonic derivation) */
async function resolvePlaystacksConfig(config: PlaystacksConfig) {
  if (isMnemonicConfig(config)) {
    const privateKey = await derivePrivateKeyFromMnemonic(
      config.mnemonic,
      config.accountIndex ?? 0
    );
    return resolveConfig(config, privateKey);
  }
  return resolveConfig(config);
}

/** Create the stacks fixture from a resolved config */
function createFixture(
  handler: MockProviderHandler,
  resolved: ReturnType<typeof resolveConfig>,
): StacksFixture {
  const network = handler.network;
  return {
    wallet: {
      address: handler.identity.address,
      publicKey: handler.identity.publicKey,
      rejectNext: () => handler.rejectNext(),
      lastTxId: () => handler.lastTxId,
    },
    waitForTx: (txid: string) =>
      waitForConfirmation(network, txid, resolved.confirmation, resolved.requestTimeout),
    callReadOnly: (options: ReadOnlyCallOptions) =>
      callReadOnly(network, options, handler.identity.address, resolved.requestTimeout),
    getBalance: (address?: string) =>
      fetchBalance(network, address ?? handler.identity.address, resolved.requestTimeout),
    getNonce: (address?: string) =>
      fetchNonce(network, address ?? handler.identity.address, resolved.requestTimeout),
  };
}

/**
 * Base test with Stacks config options and fixture.
 * Use with `playwright.config.ts` `use` block for shared config.
 *
 * @example
 * ```ts
 * // playwright.config.ts
 * export default defineConfig({
 *   use: {
 *     stacksPrivateKey: process.env.TEST_STX_KEY!,
 *     stacksNetwork: 'testnet',
 *   },
 * });
 *
 * // test file
 * import { test, expect } from '@satoshai/playstacks';
 * test('my test', async ({ stacks }) => { ... });
 * ```
 */
// Cache resolved configs keyed by options to avoid re-deriving mnemonic keys,
// while supporting multiple Playwright projects with different Stacks settings.
const configCache = new Map<string, Promise<ReturnType<typeof resolveConfig>>>();

export const test = base.extend<StacksFixtures & PlaystacksOptions>({
  // Options with defaults (set via playwright.config.ts `use` block)
  stacksPrivateKey: [undefined, { option: true }],
  stacksMnemonic: [undefined, { option: true }],
  stacksAccountIndex: [0, { option: true }],
  stacksNetwork: [undefined, { option: true }],
  stacksFeeMultiplier: [1.0, { option: true }],
  stacksFeeMax: [500_000, { option: true }],
  stacksFeeFixed: [undefined, { option: true }],
  stacksConfirmationTimeout: [120_000, { option: true }],
  stacksConfirmationPollInterval: [2_000, { option: true }],
  stacksRequestTimeout: [30_000, { option: true }],

  stacks: async ({ page, stacksPrivateKey, stacksMnemonic, stacksAccountIndex, stacksNetwork, stacksFeeMultiplier, stacksFeeMax, stacksFeeFixed, stacksConfirmationTimeout, stacksConfirmationPollInterval, stacksRequestTimeout }, use) => {
    const options: PlaystacksOptions = {
      stacksPrivateKey, stacksMnemonic, stacksAccountIndex, stacksNetwork,
      stacksFeeMultiplier, stacksFeeMax, stacksFeeFixed,
      stacksConfirmationTimeout, stacksConfirmationPollInterval,
      stacksRequestTimeout,
    };
    const cacheKey = JSON.stringify(options);
    if (!configCache.has(cacheKey)) {
      const config = buildConfigFromOptions(options);
      configCache.set(cacheKey, resolvePlaystacksConfig(config));
    }
    const resolved = await configCache.get(cacheKey)!;
    const handler = new MockProviderHandler(resolved);
    handler.resetNonce();
    await handler.install(page);
    await use(createFixture(handler, resolved));
  },
});

/**
 * Create a Playwright test function with Stacks wallet fixtures.
 * File-level config overrides any config-level settings from `playwright.config.ts`.
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
    return resolvePlaystacksConfig(config);
  }

  return base.extend<StacksFixtures>({
    stacks: async ({ page }, use) => {
      if (!resolvedConfigPromise) {
        resolvedConfigPromise = getResolvedConfig();
      }
      const resolved = await resolvedConfigPromise;
      const handler = new MockProviderHandler(resolved);
      handler.resetNonce();
      await handler.install(page);
      await use(createFixture(handler, resolved));
    },
  });
}
