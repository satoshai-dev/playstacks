# @satoshai/playstacks

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
