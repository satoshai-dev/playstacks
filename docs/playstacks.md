# Playstacks

**E2E Testing SDK for Stacks Blockchain dApps**

Playwright-based library that lets you write end-to-end tests for any Stacks dApp using real transactions, real keys, and any network — mainnet, testnet, or devnet.

---

## The Problem

There is no E2E testing tool for Stacks dApps. Every other major blockchain ecosystem has one:

| Ecosystem | E2E Tool | Status |
|---|---|---|
| Ethereum/EVM | Synpress, Hardhat + Playwright | Mature, widely adopted |
| Solana | Synpress v4 (Phantom support) | Available |
| Cosmos | @agoric/synpress (Keplr fork) | Available |
| **Stacks/Bitcoin** | **Nothing** | **Zero tooling** |

Every Stacks dApp team — Zest, StackingDAO, BitFlow, Alex, Arkadiko, Granite — faces the same gap:

- **Clarinet** tests contracts in isolation. No UI coverage.
- **Playwright/Cypress** can test the UI, but with mocked API responses. No real contract interactions.
- **Manual QA** for the full flow. Doesn't scale.

Nobody can test the complete path: **User clicks button → wallet signs transaction → contract executes on-chain → UI updates**.

## The Solution

Playstacks injects a mock wallet provider into the browser that **signs real transactions with real private keys** using `@stacks/transactions`. No browser extension needed. No popup automation. No fragile UI selectors.

The mock implements the same `.request(method, params)` JSON-RPC interface that both Leather and Xverse use, so it works with any dApp built on `@stacks/connect`, Leather's `LeatherProvider`, or Xverse's Sats Connect.

The library also handles **fee estimation** with a configurable multiplier, so tests don't fail because of stuck transactions.

### What a test looks like

```typescript
import { testWithStacks, expect, Cl } from 'playstacks';

const test = testWithStacks({
  privateKey: process.env.TEST_STX_KEY!,
  network: 'mainnet',
  fee: { multiplier: 1.5, maxFee: 500_000 },
});

test('supply STX to Zest lending pool', async ({ page, stacks }) => {
  await page.goto('https://app.zestprotocol.com');

  // Connect wallet — mock auto-responds to getAddresses
  await page.getByRole('button', { name: /connect/i }).click();
  await expect(page.getByText(stacks.wallet.address.slice(0, 8))).toBeVisible();

  // Supply 10 STX
  await page.getByTestId('supply-amount').fill('10');
  await page.getByRole('button', { name: /supply/i }).click();

  // Mock signs real tx, broadcasts to mainnet, dApp receives txid
  await expect(page.getByText(/submitted|pending/i)).toBeVisible({ timeout: 10_000 });

  // Verify on-chain state
  const balance = await stacks.callReadOnly({
    contractAddress: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR',
    contractName: 'pool-0-reserve',
    functionName: 'get-user-balance',
    functionArgs: [Cl.principal(stacks.wallet.address)],
  });
  expect(balance).toBeTruthy();
});
```

```typescript
// Test error paths too
test('shows error when user rejects transaction', async ({ page, stacks }) => {
  stacks.wallet.rejectNext(); // Next .request() call throws UserRejected

  await page.getByRole('button', { name: /supply/i }).click();
  await expect(page.getByText(/cancelled|rejected/i)).toBeVisible();
});
```

---

## Architecture

### How it works

```
┌─────────────────────────────────────────────────────┐
│  Playwright Test (Node.js)                          │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  MockProviderHandler                         │   │
│  │  - Signs txs with @stacks/transactions       │   │
│  │  - Estimates fees via Stacks API             │   │
│  │  - Broadcasts to mainnet/testnet/devnet      │   │
│  │  - Private keys stay here, never in browser  │   │
│  └──────────────┬───────────────────────────────┘   │
│                 │ page.exposeFunction()              │
│                 │ (Node ↔ Browser bridge)            │
│  ┌──────────────▼───────────────────────────────┐   │
│  │  Browser (dApp under test)                   │   │
│  │                                              │   │
│  │  window.StacksProvider    ─┐                 │   │
│  │  window.LeatherProvider   ─┤─→ Mock proxy    │   │
│  │  window.XverseProviders   ─┘   that forwards │   │
│  │                                .request()    │   │
│  │                                calls to Node │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

1. **`page.exposeFunction('__playstacksRequest', handler)`** creates a bridge between browser and Node.js
2. **`page.addInitScript()`** injects a script that installs `window.StacksProvider`, `window.LeatherProvider`, and `window.XverseProviders` — all pointing to a thin proxy
3. When the dApp calls `.request(method, params)`, the proxy serializes it and sends it to the Node-side handler
4. The handler uses `@stacks/transactions` to **build, sign, and broadcast** a real transaction
5. The txid is returned to the dApp, which updates its UI normally

**Private keys never enter the browser.** The browser mock is just a JSON-RPC proxy.

### Supported wallet methods

| Method | Description | Status |
|---|---|---|
| `getAddresses` | Returns STX address + public key | MVP |
| `stx_callContract` | Sign + broadcast contract call | MVP |
| `stx_transferStx` | Sign + broadcast STX transfer | MVP |
| `stx_signTransaction` | Sign raw transaction hex | v0.2 |
| `stx_signMessage` | Sign plaintext message | v0.2 |
| `stx_signStructuredMessage` | Sign typed/structured message (SIP-018) | v0.2 |
| `stx_deployContract` | Sign + broadcast contract deployment | v0.2 |
| `signPsbt` | Bitcoin PSBT signing | v0.4 |

### Wallet compatibility

The mock installs all provider globals that Stacks dApps check for:

- `window.StacksProvider` — used by `@stacks/connect`
- `window.LeatherProvider` — used by Leather wallet's direct API
- `window.HiroWalletProvider` — legacy Hiro wallet
- `window.XverseProviders.StacksProvider` — used by Xverse/Sats Connect
- WBIP provider registry — for `@stacks/connect` v8+

One mock covers every code path. Any dApp that works with Leather or Xverse works with Playstacks.

---

## Configuration

### Inline (per test file)

```typescript
import { testWithStacks } from 'playstacks';

const test = testWithStacks({
  privateKey: process.env.TEST_STX_KEY!,    // hex private key
  network: 'mainnet',                       // or 'testnet', 'devnet', { url: '...' }
  fee: {
    multiplier: 1.5,                        // 1.5x estimated fee (default)
    maxFee: 1_000_000,                      // cap at 1 STX (default)
    // fixed: 10_000,                       // or use a fixed fee, skip estimation
  },
  confirmation: {
    timeout: 120_000,                       // 2 min (default)
    pollInterval: 2_000,                    // poll every 2s (default)
  },
});
```

### Via playwright.config.ts (shared across all tests)

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    stacksPrivateKey: process.env.TEST_STX_KEY!,
    stacksNetwork: 'testnet',
    stacksFeeMultiplier: 2,
  },
});
```

### Network options

| Value | Connects to |
|---|---|
| `'mainnet'` | Stacks mainnet (api.hiro.so) |
| `'testnet'` | Stacks testnet (api.testnet.hiro.so) |
| `'devnet'` | Local Clarinet devnet (localhost:3999) |
| `{ url: 'https://...' }` | Custom Stacks node URL |

---

## Fee Management

Fee estimation on Stacks has historically been broken. The core problem is **fees being wildly overestimated** — not too low, too high. The Stacks fee estimator doesn't weight fee rates by transaction size, so small STX transfers with high per-byte rates skew the estimates upward. Outlier blocks with inflated fee rates compound the problem via exponential windowing. The result: the `/v2/fees/transaction` endpoint regularly suggests fees of 50-100+ STX for normal contract calls.

Hiro patched the worst of it in Stacks 2.05 (size-weighted rates, 5-block window, dummy fills for empty block space), but the estimates are still unreliable enough that wallets add their own heuristics on top.

Playstacks takes control of fees so your tests don't overpay or fail:

1. **For STX transfers**: Hits `GET /v2/fees/transfer` for the fee rate, multiplies by estimated tx size (~180 bytes)
2. **For contract calls**: Builds the transaction unsigned first, then hits `/v2/fees/transaction` with the serialized payload. Uses the middle tier estimate.
3. **Caps at maxFee** (default 0.5 STX / 500,000 microstacks) — the main guard against the overestimation problem. Prevents paying 50 STX for a contract call.
4. **Multiplier** (default 1.0x) — unlike other chains where you bump fees up, on Stacks you usually want to leave it at 1x or even reduce. Configurable per test suite.
5. **Fixed fee override**: Set `fee.fixed` to bypass estimation entirely — useful when you know the right fee for your contract calls.

The two-pass flow for contract calls:
```
Build unsigned tx (fee=0) → Estimate fee → Cap at maxFee → Set fee → Sign → Broadcast
```

---

## Fixture API

The `stacks` fixture provides:

```typescript
test('example', async ({ page, stacks }) => {
  // Wallet info
  stacks.wallet.address;     // STX address derived from your key
  stacks.wallet.publicKey;   // Public key hex

  // Wait for tx confirmation on-chain
  const result = await stacks.waitForTx('0xabc123...');
  // result.status: 'success' | 'abort_by_response' | 'abort_by_post_condition'

  // Read contract state (read-only call, no tx needed)
  const value = await stacks.callReadOnly({
    contractAddress: 'SP2C2...',
    contractName: 'my-contract',
    functionName: 'get-balance',
    functionArgs: [Cl.principal(stacks.wallet.address)],
  });

  // Check STX balance
  const balance = await stacks.getBalance(); // bigint in microstacks

  // Check nonce
  const nonce = await stacks.getNonce(); // bigint
});
```

---

## Package Structure

```
playstacks/
├── src/
│   ├── index.ts                       # Public API exports
│   ├── config.ts                      # PlaystacksConfig type, defaults, resolver
│   ├── fixtures.ts                    # testWithStacks = test.extend<StacksFixtures>()
│   ├── wallet/
│   │   ├── mock-provider.ts           # Node-side handler: signs, estimates fees, broadcasts
│   │   ├── mock-provider-script.ts    # Browser-side injection script (self-contained JS)
│   │   ├── key-manager.ts            # Private key / mnemonic → address + publicKey
│   │   └── types.ts                   # Wallet-related types
│   ├── network/
│   │   ├── network-config.ts          # Resolves network name → StacksNetwork object
│   │   └── api-client.ts             # fetchBalance, fetchNonce, fetchAccountInfo
│   ├── fees/
│   │   └── fee-estimator.ts           # Two-pass estimation with multiplier + cap
│   ├── tx/
│   │   ├── broadcaster.ts            # broadcastTransaction wrapper with error handling
│   │   └── confirmation.ts           # Polls /extended/v1/tx/{txid} until confirmed
│   └── helpers/
│       └── read-only.ts              # callReadOnly for on-chain state verification
├── tests/
│   ├── unit/                          # Vitest unit tests for each module
│   └── e2e/                           # Playwright smoke tests against testnet/devnet
├── package.json
├── tsconfig.json
├── tsup.config.ts                     # Build: ESM + CJS + .d.ts
└── vitest.config.ts
```

### Dependencies

```json
{
  "dependencies": {
    "@stacks/transactions": "^7.3.0",
    "@stacks/network": "^7.2.0"
  },
  "peerDependencies": {
    "@playwright/test": ">=1.40.0"
  }
}
```

No dependency on `@stacks/connect` — the mock re-implements the provider interface directly, avoiding version coupling.

---

## Roadmap

### v0.1 — MVP (Week 1-2)

Core functionality: inject mock, sign transactions, broadcast.

- Project scaffolding (pnpm, TypeScript, tsup, vitest)
- Config + network resolution (mainnet / testnet / devnet / custom URL)
- Key manager: private key hex → STX address + public key
- Fee estimator with multiplier + max cap
- Mock provider: Node-side handler + browser-side injection script
- Playwright fixtures: `testWithStacks()`
- Supported methods: `getAddresses`, `stx_callContract`, `stx_transferStx`
- Smoke test against Stacks testnet

**Deliverable**: Working npm package. Can E2E test any Stacks dApp's core flows.

### v0.2 — Complete Signing + On-Chain Assertions (Week 3)

Full method coverage and verification helpers.

- `stx_signTransaction` — sign arbitrary transaction hex
- `stx_signMessage` — sign plaintext messages
- `stx_signStructuredMessage` — sign SIP-018 structured messages
- `stx_deployContract` — sign + broadcast contract deployments
- `waitForTx()` — poll for tx confirmation with configurable timeout
- `callReadOnly()` — read contract state for on-chain assertions
- `getBalance()`, `getNonce()` — account state helpers
- `wallet.rejectNext()` — test wallet rejection flows
- Unit test suite for all modules

**Deliverable**: Full Stacks signing coverage. Tests can assert on-chain state.

### v0.3 — Mnemonic + Multi-Account (Week 4)

Production-grade key management.

- Mnemonic / seed phrase support via `@stacks/wallet-sdk`
- Multiple account derivation from a single mnemonic (`accountIndex`)
- Account switching mid-test (test multi-user scenarios)
- Post-conditions support in contract calls
- Automatic nonce management for sequential transactions in a single test

**Deliverable**: Use any wallet's seed phrase. Test multi-user flows.

### v0.4 — Bitcoin / sBTC Support (Week 5-6)

Complete Bitcoin L1 + Stacks L2 coverage.

- `signPsbt` — Bitcoin PSBT signing via `bitcoinjs-lib`
- sBTC deposit / withdraw flow support
- Bitcoin address derivation (segwit, taproot) from the same key
- Integration with Bitcoin regtest / testnet4
- Helpers for sBTC bridge interactions

**Deliverable**: Test flows that span both Bitcoin and Stacks (sBTC deposits, taproot vaults).

### v1.0 — Stable Release (Week 7-8)

Ship it.

- API stabilization and breaking change review
- Comprehensive documentation: README, API reference, migration guide
- CI/CD: GitHub Actions for lint, typecheck, unit tests, publish
- npm publish as `playstacks`
- Example repository: full E2E test suite for Zest Protocol
- Performance: connection pooling, parallel test support
- Community: announce on Stacks Discord, forum post, Twitter thread

**Deliverable**: Published package on npm. Zest Protocol using it in production. Documentation and examples for ecosystem adoption.

---

