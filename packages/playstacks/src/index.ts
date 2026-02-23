// Public API
export { testWithStacks, type StacksFixture, type StacksFixtures } from './fixtures.js';
export {
  type PlaystacksConfig,
  type PrivateKeyConfig,
  type MnemonicConfig,
  type FeeConfig,
  type ConfirmationConfig,
  type NetworkOption,
  type NetworkName,
} from './config.js';
export { type ReadOnlyCallOptions } from './helpers/read-only.js';
export { type ConfirmationResult, type TxStatus } from './tx/confirmation.js';
export {
  type WalletInfo,
  type SignMessageResult,
  type SignStructuredMessageResult,
  type SignTransactionResult,
} from './wallet/types.js';

// Re-export Clarity value helpers from @stacks/transactions for convenience
export {
  Cl,
  type ClarityValue,
  cvToJSON,
  cvToString,
  cvToValue,
  cvToHex,
} from '@stacks/transactions';

// Re-export expect from Playwright for convenience
export { expect } from '@playwright/test';
