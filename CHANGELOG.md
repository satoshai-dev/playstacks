# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-02-13

### Changed

- **Xverse-only**: Removed Leather, Hiro, and WBIP provider shims — mock now installs only `StacksProvider` and `XverseProviders`
- Moved examples from `apps/` to `examples/`
- Slimmed down README

### Added

- ESLint flat config (`eslint.config.js`)
- Commitlint with conventional commits (`commitlint.config.js`)
- Changesets for version management
- Husky git hooks: pre-commit (lint + typecheck), pre-push (test), commit-msg (commitlint)
- `docs/understanding-playstacks.md` — high-level architecture explainer
- Docs site added to v1.0 roadmap

### Fixed

- Typecheck error in `key-manager.ts` — use `publicKeyToHex()` instead of manual `Array.from()` for branded `PublicKey` type

## [0.1.0] - 2026-02-13

### Added

- `testWithStacks()` — Playwright fixture factory with Stacks wallet support
- Mock wallet provider injected via `page.addInitScript()` — installs `window.StacksProvider` and `window.XverseProviders`
- Wallet methods: `getAddresses`, `stx_getAddresses`, `wallet_connect`, `stx_callContract`, `stx_transferStx`
- `@stacks/connect` v8 compatibility — JSON-RPC envelope format, provider resolution via `XverseProviders.BitcoinProvider`
- Fee estimation with configurable multiplier and max cap — two-pass flow for contract calls
- Mnemonic / seed phrase support via `@stacks/wallet-sdk` with account index derivation
- Private key support (hex, with or without compression suffix)
- Network configuration: `mainnet`, `testnet`, `devnet`, or custom URL
- `network` is required in config — no silent default
- `stacks.waitForTx(txid)` — poll for on-chain confirmation with configurable timeout
- `stacks.callReadOnly(options)` — read-only Clarity function calls, accepts `contract: 'SPaddr.name'` or split `contractAddress`/`contractName`
- `stacks.getBalance(address?)` — STX balance in microstacks
- `stacks.getNonce(address?)` — account nonce
- `stacks.wallet.rejectNext()` — flag next wallet request to throw user rejection error
- `stacks.wallet.lastTxId()` — access last broadcast transaction ID
- Post-conditions passthrough for contract calls
- `@stacks/transactions` v7 broadcast API (`StacksTransactionWire`)
- Re-exports: `Cl`, `ClarityValue`, `cvToJSON`, `cvToString`, `cvToValue`, `expect`
- Exported types: `PlaystacksConfig`, `StacksFixture`, `FeeConfig`, `ConfirmationConfig`, `NetworkOption`, `NetworkName`, `TxStatus`, `WalletInfo`, `ReadOnlyCallOptions`, `ConfirmationResult`
- 29 unit tests (vitest)
- E2E reference: Zest Protocol supply flow on mainnet (`examples/zest-e2e/`)
- ESM + CJS dual build via tsup with `.d.ts` declarations
