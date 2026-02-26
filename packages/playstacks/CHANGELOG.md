# @satoshai/playstacks

## 0.3.0

### Minor Changes

- aac68c0: Add automatic nonce management for sequential transactions

  Introduces a `NonceTracker` that fetches the initial nonce from the chain and increments it locally after each broadcast, allowing multiple transactions to be sent in a single test without waiting for each to confirm. Nonce tracking resets automatically between tests.

- e96d035: Support Playwright config-level Stacks settings

  Adds `PlaystacksOptions` that can be set in `playwright.config.ts`'s `use` block (`stacksPrivateKey`, `stacksNetwork`, `stacksFeeMultiplier`, etc.), eliminating the need to repeat config in every test file. File-level `testWithStacks()` overrides still take precedence.

- e3277ee: Add custom error types for programmatic error handling

  Introduces a typed error hierarchy (`PlaystacksError`, `NetworkError`, `BroadcastError`, `ConfirmationError`, `UserRejectionError`, `ConfigurationError`, `FeeEstimationError`) so consumers can catch specific errors with `instanceof` checks instead of parsing error message strings.

- af774cd: Add configurable request timeouts for all Stacks API calls

  All HTTP requests now use `AbortSignal.timeout()` with a configurable `requestTimeout` option (default 30s). This prevents tests from hanging indefinitely when the Stacks API is slow or unresponsive.

## 0.2.0

### Minor Changes

- Add `stx_signMessage` — sign plaintext messages
- Add `stx_signStructuredMessage` — sign SIP-018 typed/structured messages
- Add `stx_signTransaction` — sign arbitrary unsigned transaction hex
- Add Xverse 3-address format in `getAddresses` (BTC payment, BTC ordinals, STX)
- Fix `rejectNext()` to skip read-only methods so rejection flag isn't consumed by background polling
- Re-export `cvToHex` from `@stacks/transactions`

## 0.1.1

### Patch Changes

- Add package README with setup guide, configuration reference, and fixture API docs
