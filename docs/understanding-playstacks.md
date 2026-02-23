# Understanding Playstacks

## What is it?

Playstacks is an E2E testing SDK for Stacks dApps. It lets you write Playwright tests that interact with real wallets and sign real transactions — without automating a browser extension.

## The Problem

There's no E2E testing tool for Stacks. Every other chain has one (Ethereum has Synpress, Solana has Phantom support). Stacks dApp teams are stuck with either Clarinet (contract-only, no UI) or manual QA for the full flow.

Nobody can test: **User clicks button → wallet signs → contract executes on-chain → UI updates**.

## How It Works

Playstacks injects a mock wallet provider into the browser via Playwright's built-in APIs. No extension needed.

```
Node.js (Playwright test)              Browser (dApp under test)
┌────────────────────────┐             ┌──────────────────────────┐
│ MockProviderHandler    │             │ window.StacksProvider    │
│  - holds private key   │◄──bridge──►│ window.XverseProviders   │
│  - signs transactions  │  (JSON)    │                          │
│  - estimates fees      │            │ dApp calls .request()    │
│  - broadcasts to chain │            │ → forwards to Node       │
└────────────────────────┘             └──────────────────────────┘
```

Two Playwright primitives make this work:

1. **`page.exposeFunction()`** — creates a `__playstacksRequest` bridge so browser calls reach Node.js
2. **`page.addInitScript()`** — injects mock providers (`StacksProvider`, `XverseProviders`) before any dApp code runs

When the dApp calls `window.StacksProvider.request('stx_callContract', ...)`, the mock serializes the request, sends it to Node.js, where it gets signed with `@stacks/transactions` and broadcast to the network. The txid comes back to the dApp, which updates its UI normally.

**Private keys never enter the browser.** The browser mock is just a JSON-RPC proxy.

## Why It's Easy

### 1. One function sets up everything

```typescript
import { testWithStacks, expect } from '@satoshai/playstacks';

const test = testWithStacks({
  mnemonic: process.env.TEST_MNEMONIC!,
  network: 'mainnet',
  fee: { maxFee: 30_000 },
});
```

### 2. Tests are just normal Playwright

```typescript
test('supply STX on Zest', async ({ page, stacks }) => {
  await page.goto('https://app.zestprotocol.com');

  // Connect wallet — mock auto-responds, no popup
  await page.getByRole('button', { name: 'Connect Wallet' }).click();
  await page.getByRole('button', { name: /xverse/i }).click();

  // Standard Playwright selectors — nothing special
  await page.getByRole('textbox').fill('0.01');
  await page.getByRole('button', { name: 'Supply' }).click();

  // Wait for on-chain confirmation
  const txid = stacks.wallet.lastTxId();
  const result = await stacks.waitForTx(txid!);
  expect(result.status).toBe('success');
});
```

### 3. No browser extension automation

Traditional tools must launch wallet extensions, automate popups, handle multiple windows. Playstacks skips all that — one mock covers all wallet code paths.

### 4. Fee management built-in

Fees on Stacks are configurable per test suite. You can set a fixed fee, cap with `maxFee`, or use a multiplier on the estimated fee. No test failures from overpaying.

```typescript
fee: {
  maxFee: 30_000,     // cap in microstacks (0.03 STX)
  multiplier: 1.0,    // multiplier on estimated fee
  // fixed: 10_000,   // or skip estimation entirely
}
```

### 5. Built-in helpers for on-chain assertions

```typescript
// Wait for tx confirmation
const result = await stacks.waitForTx(txid);

// Read contract state (no tx needed)
const value = await stacks.callReadOnly({
  contract: 'SPaddr.pool-0-reserve',
  functionName: 'get-balance',
  functionArgs: [Cl.principal(stacks.wallet.address)],
});

// Account state
const balance = await stacks.getBalance();
const nonce = await stacks.getNonce();
```

### 6. Rejection testing without wasting gas

```typescript
stacks.wallet.rejectNext(); // Next request throws error code 4001
await page.getByRole('button', { name: 'Supply' }).click();
await expect(page.getByText(/error/i)).toBeVisible();
```

## Architecture

```
packages/playstacks/src/
├── index.ts              # Public API (testWithStacks + re-exports)
├── fixtures.ts           # Playwright fixture factory
├── config.ts             # Config types & resolution
├── wallet/
│   ├── mock-provider.ts       # Node-side handler (signs, broadcasts)
│   ├── mock-provider-script.ts # Browser-side injection (JSON-RPC proxy)
│   ├── key-manager.ts         # Private key → address + publicKey
│   ├── message-hash.ts        # Stacks plaintext message hashing
│   └── types.ts
├── network/
│   ├── network-config.ts      # Network name → API URL
│   └── api-client.ts          # HTTP calls to Stacks API
├── fees/
│   └── fee-estimator.ts       # Estimation with multiplier + cap
├── tx/
│   ├── broadcaster.ts         # Transaction broadcast
│   └── confirmation.ts        # Poll until confirmed
└── helpers/
    └── read-only.ts           # Read-only contract calls
```

Each layer has a single responsibility. The mock provider handler orchestrates wallet → fees → broadcast → confirmation. Tests interact only through the `stacks` fixture.
