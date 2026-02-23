# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-23

### Added

- `stx_signMessage` — sign plaintext messages (Stacks message hash prefix + RSV signature)
- `stx_signStructuredMessage` — sign SIP-018 typed/structured messages
- `stx_signTransaction` — sign arbitrary unsigned transaction hex
- Xverse 3-address format in `getAddresses` (BTC payment, BTC ordinals, STX)
- `rejectNext()` now skips read-only methods (`getAddresses`, `wallet_connect`) so the rejection flag isn't consumed by background polling
- Message hash helper (`message-hash.ts`) — Stacks plaintext message hashing with Bitcoin varint encoding
- Test dApp (`apps/test-dapp/`) — Vite + vanilla TypeScript app with 6 pages exercising every wallet method
- E2E specs for connect, sign-message, sign-structured, and sign-transaction against the test dApp
- Real-world example: `examples/satoshai/` — full login flow against app.satoshai.io (connect + sign auth + terminal)
- Real-world example: `examples/zest/` withdraw test (0.01 STX) to complement the supply test
- 13 new unit tests (message hash + all 3 signing methods), bringing total to 42
- Re-export `cvToHex` from `@stacks/transactions`
- Demo video: Zest Protocol supply flow (`docs/assets/zest-supply-demo.mp4`)

### Changed

- Renamed `examples/zest-e2e/` to `examples/zest/`
- Renamed `examples/satoshai-login/` to `examples/satoshai/`
- Zest examples run sequentially (`workers: 1`) to avoid nonce conflicts from shared wallet

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
