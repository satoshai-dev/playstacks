# @satoshai/playstacks

E2E testing SDK for Stacks blockchain dApps. Uses Playwright to drive a real browser with a mock Xverse wallet — your tests sign and broadcast real transactions without manual wallet interaction.

## Install

```bash
npm install @satoshai/playstacks @playwright/test
```

## Quick start

```ts
import { testWithStacks, expect } from '@satoshai/playstacks';

const test = testWithStacks({
  mnemonic: process.env.TEST_MNEMONIC!,
  network: 'mainnet',
});

test('supply STX on a DeFi protocol', async ({ page, stacks }) => {
  await page.goto('https://app.example.com');

  // Connect wallet — the mock auto-approves
  await page.getByRole('button', { name: 'Connect Wallet' }).click();
  await page.getByRole('button', { name: /xverse/i }).click();

  // Verify wallet is connected
  const shortAddr = stacks.wallet.address.slice(0, 8);
  await expect(page.getByText(shortAddr)).toBeVisible();

  // Trigger a contract call — signed and broadcast automatically
  await page.getByRole('button', { name: 'Supply' }).click();

  // Wait for on-chain confirmation
  const txid = stacks.wallet.lastTxId()!;
  const result = await stacks.waitForTx(txid);
  expect(result.status).toBe('success');
});
```

## Configuration

`testWithStacks()` accepts a config object and returns a Playwright `test` function with a `stacks` fixture.

### With mnemonic (same seed phrase as your Xverse wallet)

```ts
const test = testWithStacks({
  mnemonic: process.env.TEST_MNEMONIC!,
  accountIndex: 0, // default: 0
  network: 'mainnet',
});
```

### With private key

```ts
const test = testWithStacks({
  privateKey: process.env.TEST_STX_KEY!,
  network: 'testnet',
});
```

### Fee management

```ts
const test = testWithStacks({
  mnemonic: process.env.TEST_MNEMONIC!,
  network: 'mainnet',
  fee: {
    multiplier: 1.0, // multiplier on estimated fee (default: 1.0)
    maxFee: 30_000,   // cap in microstacks (default: 500_000 = 0.5 STX)
    // fixed: 5_000,  // skip estimation, use exact fee
  },
});
```

### Confirmation polling

```ts
const test = testWithStacks({
  mnemonic: process.env.TEST_MNEMONIC!,
  network: 'mainnet',
  confirmation: {
    timeout: 120_000,    // max wait time in ms (default: 120_000)
    pollInterval: 2_000, // polling interval in ms (default: 2_000)
  },
});
```

### Custom network

```ts
const test = testWithStacks({
  mnemonic: process.env.TEST_MNEMONIC!,
  network: { url: 'http://localhost:3999' },
});
```

## Fixture API

Every test gets a `stacks` fixture with:

### `stacks.wallet`

| Property | Type | Description |
|---|---|---|
| `address` | `string` | STX address derived from your key |
| `publicKey` | `string` | Public key hex |
| `rejectNext()` | `() => void` | Flag the next wallet request to throw a user rejection error |
| `lastTxId()` | `() => string \| null` | Last broadcast transaction ID |

### `stacks.waitForTx(txid)`

Poll until a transaction reaches a terminal status (`success`, `abort_by_response`, or `abort_by_post_condition`). Returns `{ txid, status, blockHeight }`.

### `stacks.callReadOnly(options)`

Call a read-only Clarity function (no transaction created).

```ts
import { Cl, cvToValue } from '@satoshai/playstacks';

const result = await stacks.callReadOnly({
  contract: 'SP2C2YFP12AJZB1MANAT0P5GKW46QDR1G06.zest-reward-dist',
  functionName: 'get-balance',
  functionArgs: [Cl.principal(stacks.wallet.address)],
});

console.log(cvToValue(result));
```

Or with split address:

```ts
await stacks.callReadOnly({
  contractAddress: 'SP2C2YFP12AJZB1MANAT0P5GKW46QDR1G06',
  contractName: 'zest-reward-dist',
  functionName: 'get-balance',
  functionArgs: [Cl.principal(stacks.wallet.address)],
});
```

### `stacks.getBalance(address?)`

Get STX balance in microstacks. Defaults to the wallet address.

### `stacks.getNonce(address?)`

Get account nonce. Defaults to the wallet address.

## Supported wallet methods

| Method | Description | Since |
|---|---|---|
| `getAddresses` / `stx_getAddresses` | Returns STX address + public key | v0.1 |
| `wallet_connect` | Xverse-compatible connect flow | v0.1 |
| `stx_callContract` | Sign + broadcast contract call | v0.1 |
| `stx_transferStx` | Sign + broadcast STX transfer | v0.1 |
| `stx_signMessage` | Sign plaintext message | v0.2 |
| `stx_signStructuredMessage` | Sign SIP-018 structured message | v0.2 |
| `stx_signTransaction` | Sign raw transaction hex | v0.2 |

## Testing wallet rejections

```ts
test('handles user rejection', async ({ page, stacks }) => {
  // ... connect wallet ...

  // Flag the next request to be rejected
  stacks.wallet.rejectNext();

  // Trigger a transaction — the mock will reject it
  await page.getByRole('button', { name: 'Supply' }).click();

  // Assert the dApp handles the rejection gracefully
  // (behaviour depends on the dApp — dialog may stay open, show error, etc.)
});
```

Note: `rejectNext()` only applies to action methods (sign/send). Read-only methods like `getAddresses` are not affected, so the flag won't be consumed by background polling.

## Re-exports

For convenience, `@satoshai/playstacks` re-exports:

- **From `@stacks/transactions`**: `Cl`, `ClarityValue`, `cvToJSON`, `cvToString`, `cvToValue`, `cvToHex`
- **From `@playwright/test`**: `expect`

## How it works

1. `testWithStacks()` creates a Playwright fixture that injects a mock `window.StacksProvider` and `window.XverseProviders` via `page.addInitScript()` before any page navigation
2. When the dApp calls wallet methods (`getAddresses`, `stx_callContract`, `stx_transferStx`, `stx_signMessage`, etc.), the mock signs real transactions using your key
3. For transaction methods (`stx_callContract`, `stx_transferStx`), the signed transaction is broadcast to the network
4. For signing-only methods (`stx_signMessage`, `stx_signStructuredMessage`, `stx_signTransaction`), the signature or signed tx is returned without broadcasting
5. Compatible with `@stacks/connect` v8 JSON-RPC format and Xverse 3-address format

## Requirements

- Node.js >= 18
- `@playwright/test` >= 1.40.0

## License

MIT
