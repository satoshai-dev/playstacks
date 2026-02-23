# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-02-23

### Changed

- Renamed package from `playstacks` to `@satoshai/playstacks`
- First publish to npm

### Added

- Package README
- GitHub Actions CI and release workflows
- Changeset convenience scripts

## [0.1.0] - 2026-02-13

### Added

- `testWithStacks()` — Playwright fixture factory with Stacks wallet support
- Mock Xverse wallet provider via `page.addInitScript()`
- Wallet methods: `getAddresses`, `stx_getAddresses`, `wallet_connect`, `stx_callContract`, `stx_transferStx`
- `@stacks/connect` v8 compatibility
- Fee estimation with configurable multiplier and max cap
- Mnemonic and private key support
- Network configuration: `mainnet`, `testnet`, `devnet`, or custom URL
- `stacks.waitForTx(txid)` — poll for on-chain confirmation
- `stacks.callReadOnly(options)` — read-only Clarity function calls
- `stacks.getBalance()`, `stacks.getNonce()`
- `stacks.wallet.rejectNext()`, `stacks.wallet.lastTxId()`
- Post-conditions passthrough for contract calls
- ESM + CJS dual build via tsup
- 29 unit tests
- E2E reference: Zest Protocol supply flow
- ESLint, commitlint, husky git hooks, changesets
