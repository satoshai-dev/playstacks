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
import { testWithStacks, expect, Cl } from '@satoshai/playstacks';

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
| `stx_signMessage` | Sign plaintext message | ✅ v0.2 |
| `stx_signStructuredMessage` | Sign typed/structured message (SIP-018) | ✅ v0.2 |
| `stx_signTransaction` | Sign raw transaction hex | ✅ v0.2 |
| `stx_deployContract` | Sign + broadcast contract deployment | [planned](https://github.com/satoshai-dev/playstacks/issues/2) |
| `signPsbt` | Bitcoin PSBT signing | [planned](https://github.com/satoshai-dev/playstacks/issues/7) |

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
import { testWithStacks } from '@satoshai/playstacks';

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

Playstacks handles fee estimation so tests don't overpay or get stuck:

| Strategy | How it works |
|---|---|
| **STX transfers** | `GET /v2/fees/transfer` fee rate × estimated tx size (~180 bytes) |
| **Contract calls** | Two-pass: build unsigned tx → `POST /v2/fees/transaction` → use middle tier estimate |
| **Max cap** | Hard cap at `maxFee` (default 500,000 microstacks / 0.5 STX) |
| **Multiplier** | Scales the estimate by `multiplier` (default 1.0x) |
| **Fixed override** | Set `fee.fixed` to skip estimation entirely |

Contract call flow:

```
Build unsigned tx (fee=0) → Estimate fee → Apply multiplier → Cap at maxFee → Sign → Broadcast
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
│   │   │   ├── message-hash.ts       # Stacks plaintext message hashing (sha256 + varint)
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
│   └── tests/unit/                   # Vitest unit tests
├── apps/test-dapp/                   # Satoshai test dApp — exercises every wallet method
│   ├── src/
│   │   ├── pages/
│   │   │   ├── connect.ts            # Wallet connect + address display
│   │   │   ├── transfer.ts           # STX transfer
│   │   │   ├── call-contract.ts      # Contract call
│   │   │   ├── sign-message.ts       # stx_signMessage → show signature
│   │   │   ├── sign-structured.ts    # stx_signStructuredMessage (SIP-018)
│   │   │   └── sign-transaction.ts   # stx_signTransaction → show signed hex
│   │   ├── global.d.ts              # Window.StacksProvider type augmentation
│   │   ├── main.ts                   # Router / page navigation
│   │   └── style.css                 # Satoshai-branded styles
│   ├── index.html
│   ├── package.json                  # Vite, @stacks/transactions
│   └── vite.config.ts
├── apps/test-dapp/tests/             # E2E specs that run against the test dApp
│   ├── connect.spec.ts
│   ├── sign-message.spec.ts
│   ├── sign-structured.spec.ts
│   ├── sign-transaction.spec.ts
│   └── playwright.config.ts         # webServer → vite dev
├── examples/
│   ├── zest/                         # Real-world: Zest Protocol lending (mainnet)
│   │   ├── tests/
│   │   │   ├── supply.spec.ts
│   │   │   └── withdraw.spec.ts
│   │   └── playwright.config.ts
│   └── satoshai/                     # Real-world: SatoshAI login flow (mainnet)
│       ├── tests/
│       │   └── login.spec.ts         # Connect → sign auth → terminal
│       └── playwright.config.ts
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
    "@stacks/network": "^7.2.0",
    "@stacks/wallet-sdk": "^7.2.0"
  },
  "peerDependencies": {
    "@playwright/test": ">=1.40.0"
  }
}
```

No dependency on `@stacks/connect` — the mock re-implements the provider interface directly, avoiding version coupling.

---

## Testing Strategy

Two layers of testing, combining a self-contained test dApp with real-world examples against production dApps.

### Test dApp (`apps/test-dapp/`)

A Satoshai-branded Vite app that lives inside the repo and exercises every wallet method Playstacks supports. Each page has a single purpose: a button that triggers a wallet method and displays the result. Playwright E2E specs run against this app.

- **Self-contained** — no dependency on external dApps being up or changing their UI
- **Grows with the library** — each version adds pages + specs for its new features
- **Devnet-first** — transaction tests run against Clarinet devnet (free, fast blocks, pre-funded accounts)
- **Looks good** — Satoshai-branded, clean UI. This is our showcase, not a throwaway test page

| Test type | Tool | What it covers | Chain needed? |
|---|---|---|---|
| Unit | Vitest | Handler logic, signature correctness, nonce tracking, key derivation | No |
| E2E (signing) | Playwright + test dApp | Full flow: dApp calls `@stacks/connect` → mock signs → result on page | No |
| E2E (transactions) | Playwright + test dApp | Broadcast + on-chain confirmation via devnet | Clarinet devnet |
| E2E (real-world) | Playwright + external dApp | Full flow against production dApps | Mainnet / testnet |

### Real-world examples (`examples/`)

Showcases against real production dApps. These prove Playstacks works in the wild, but aren't the primary test suite.

- **`examples/zest/`** — Zest Protocol lending flow on mainnet (supply + withdraw STX, on-chain confirmation)
- **`examples/satoshai/`** — SatoshAI login flow on mainnet (connect → sign auth message → terminal access)
