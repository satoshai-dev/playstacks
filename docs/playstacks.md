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

The mock implements the same `.request(method, params)` JSON-RPC interface that Xverse uses, so it works with any dApp built on `@stacks/connect` or Xverse's Sats Connect.

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
│  │  window.XverseProviders   ─┘─→ Mock proxy    │   │
│  │                                that forwards │   │
│  │                                .request()    │   │
│  │                                calls to Node │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

1. **`page.exposeFunction('__playstacksRequest', handler)`** creates a bridge between browser and Node.js
2. **`page.addInitScript()`** injects a script that installs `window.StacksProvider` and `window.XverseProviders` — both pointing to a thin proxy
3. When the dApp calls `.request(method, params)`, the proxy serializes it and sends it to the Node-side handler
4. The handler uses `@stacks/transactions` to **build, sign, and broadcast** a real transaction
5. The txid is returned to the dApp, which updates its UI normally

**Private keys never enter the browser.** The browser mock is just a JSON-RPC proxy.

### Supported wallet methods

| Method | Description | Status |
|---|---|---|
| `getAddresses` / `stx_getAddresses` | Returns STX address + public key | ✅ v0.1 |
| `wallet_connect` | Xverse-compatible connect flow | ✅ v0.1 |
| `stx_callContract` | Sign + broadcast contract call | ✅ v0.1 |
| `stx_transferStx` | Sign + broadcast STX transfer | ✅ v0.1 |
| `stx_signTransaction` | Sign raw transaction hex | v0.2 |
| `stx_signMessage` | Sign plaintext message | v0.2 |
| `stx_signStructuredMessage` | Sign typed/structured message (SIP-018) | v0.2 |
| `stx_deployContract` | Sign + broadcast contract deployment | v0.2 |
| `signPsbt` | Bitcoin PSBT signing | v0.3 |

### Wallet compatibility

The mock installs the provider globals needed for Xverse:

- `window.StacksProvider` — used by `@stacks/connect`
- `window.XverseProviders.StacksProvider` — used by Xverse/Sats Connect
- `window.XverseProviders.BitcoinProvider` — used by `@stacks/connect-ui` provider resolution

Any dApp that works with Xverse works with Playstacks.

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
├── packages/playstacks/              # Core library
│   ├── src/
│   │   ├── index.ts                  # Public API exports
│   │   ├── config.ts                 # PlaystacksConfig type, defaults, resolver
│   │   ├── fixtures.ts               # testWithStacks = test.extend<StacksFixtures>()
│   │   ├── wallet/
│   │   │   ├── mock-provider.ts      # Node-side handler: signs, estimates fees, broadcasts
│   │   │   ├── mock-provider-script.ts # Browser-side injection script (self-contained JS)
│   │   │   ├── key-manager.ts        # Private key / mnemonic → address + publicKey
│   │   │   └── types.ts              # Wallet-related types
│   │   ├── network/
│   │   │   ├── network-config.ts     # Resolves network name → StacksNetwork object
│   │   │   └── api-client.ts         # fetchBalance, fetchNonce, fetchAccountInfo
│   │   ├── fees/
│   │   │   └── fee-estimator.ts      # Two-pass estimation with multiplier + cap
│   │   ├── tx/
│   │   │   ├── broadcaster.ts        # broadcastTransaction wrapper with error handling
│   │   │   └── confirmation.ts       # Polls /extended/v1/tx/{txid} until confirmed
│   │   └── helpers/
│   │       └── read-only.ts          # callReadOnly for on-chain state verification
│   └── tests/unit/                   # Vitest unit tests (29 tests)
├── examples/zest-e2e/           # E2E reference implementation
│   ├── tests/
│   │   ├── supply.spec.ts            # Full supply flow: connect → supply → confirm
│   │   └── rejection.spec.ts         # Wallet rejection testing
│   └── playwright.config.ts
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

### v0.1 — MVP ✅

Core library with full E2E flow working on mainnet against Zest Protocol.

- [x] Project scaffolding (pnpm, TypeScript, tsup, vitest)
- [x] Config + network resolution (mainnet / testnet / devnet / custom URL)
- [x] Key manager: private key hex → STX address + public key
- [x] Mnemonic / seed phrase support via `@stacks/wallet-sdk`
- [x] Multiple account derivation from a single mnemonic (`accountIndex`)
- [x] Fee estimator with multiplier + max cap
- [x] Mock provider: Node-side handler + browser-side injection script
- [x] Wallet compatibility: `@stacks/connect` v8, Xverse (StacksProvider + XverseProviders)
- [x] Playwright fixtures: `testWithStacks()`
- [x] Supported methods: `getAddresses`, `wallet_connect`, `stx_callContract`, `stx_transferStx`
- [x] Post-conditions support in contract calls
- [x] `waitForTx()` — poll for tx confirmation with configurable timeout
- [x] `callReadOnly()` — read contract state for on-chain assertions
- [x] `getBalance()`, `getNonce()` — account state helpers
- [x] `wallet.rejectNext()` — test wallet rejection flows
- [x] `wallet.lastTxId()` — access last broadcast transaction ID
- [x] Unit test suite (29 tests)
- [x] E2E reference: Zest Protocol supply flow on mainnet

**Deliverable**: Working package. Full E2E tests for Zest Protocol — connect wallet, supply STX, confirm on-chain.

### v0.2 — Complete Signing (Next)

Full method coverage.

- `stx_signTransaction` — sign arbitrary transaction hex
- `stx_signMessage` — sign plaintext messages
- `stx_signStructuredMessage` — sign SIP-018 structured messages
- `stx_deployContract` — sign + broadcast contract deployments
- Automatic nonce management for sequential transactions in a single test
- Account switching mid-test (test multi-user scenarios)

**Deliverable**: Full Stacks signing coverage.

### v0.3 — Bitcoin / sBTC Support

Complete Bitcoin L1 + Stacks L2 coverage.

- `signPsbt` — Bitcoin PSBT signing via `bitcoinjs-lib`
- sBTC deposit / withdraw flow support
- Bitcoin address derivation (segwit, taproot) from the same key
- Integration with Bitcoin regtest / testnet4
- Helpers for sBTC bridge interactions

**Deliverable**: Test flows that span both Bitcoin and Stacks (sBTC deposits, taproot vaults).

### v1.0 — Stable Release

Ship it.

- API stabilization and breaking change review
- Docs site (`apps/docs`) — API reference, getting started guide, examples
- CI/CD: GitHub Actions for lint, typecheck, unit tests, publish
- npm publish as `playstacks`
- Performance: connection pooling, parallel test support
- Community: announce on Stacks Discord, forum post, Twitter thread

**Deliverable**: Published package on npm. Docs site live. Zest Protocol using it in production.

---

