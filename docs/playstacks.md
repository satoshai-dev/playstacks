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
| `stx_signMessage` | Sign plaintext message | v0.2 |
| `stx_signStructuredMessage` | Sign typed/structured message (SIP-018) | v0.2 |
| `stx_signTransaction` | Sign raw transaction hex | v0.2 |
| `stx_deployContract` | Sign + broadcast contract deployment | v0.3 |
| `signPsbt` | Bitcoin PSBT signing | v0.5 |

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
│   │   │   ├── sign-transaction.ts   # stx_signTransaction → show signed hex
│   │   │   ├── deploy.ts            # stx_deployContract → show txid
│   │   │   └── multi-account.ts      # Account switching
│   │   ├── main.ts                   # Router / page navigation
│   │   └── style.css                 # Satoshai-branded styles
│   ├── index.html
│   ├── package.json                  # Vite, @stacks/connect
│   └── vite.config.ts
├── apps/test-dapp/tests/             # E2E specs that run against the test dApp
│   ├── connect.spec.ts
│   ├── transfer.spec.ts
│   ├── call-contract.spec.ts
│   ├── sign-message.spec.ts
│   ├── sign-structured.spec.ts
│   ├── sign-transaction.spec.ts
│   ├── deploy.spec.ts
│   ├── nonce-management.spec.ts
│   ├── multi-account.spec.ts
│   └── playwright.config.ts         # webServer → vite dev, network → devnet
├── examples/
│   ├── zest-e2e/                     # Real-world: Zest Protocol lending (mainnet)
│   │   ├── tests/
│   │   │   ├── supply.spec.ts
│   │   │   └── rejection.spec.ts
│   │   └── playwright.config.ts
│   └── satoshai-login/               # Real-world: Satoshai message signing auth
│       ├── tests/
│       │   └── login.spec.ts         # Connect → sign message → authenticated
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
    "@stacks/network": "^7.2.0"
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

- **`examples/zest-e2e/`** — Zest Protocol lending flow on mainnet (connect → supply STX → confirm on-chain)
- **`examples/satoshai-login/`** — Satoshai message signing auth (connect → sign message → authenticated)

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

### v0.2 — Message & Transaction Signing

Pure signing methods — no broadcasting, no devnet needed. Also ships the test dApp scaffold.

- `stx_signMessage` — sign plaintext messages
- `stx_signStructuredMessage` — sign SIP-018 structured messages
- `stx_signTransaction` — sign arbitrary transaction hex
- Test dApp scaffold (`apps/test-dapp/`) — Satoshai-branded Vite app with pages for connect, transfer, contract call, and all three signing methods
- E2E specs for each signing method against the test dApp
- Unit tests for signature correctness and format validation
- Real-world example: `examples/satoshai-login/` — message signing auth against app.satoshai.io

**Deliverable**: Full Stacks signing coverage. Test dApp running. Satoshai login example working.

### v0.3 — Deploy & Nonce Management

Contract deployment support and automatic nonce tracking for sequential transactions.

- `stx_deployContract` — sign + broadcast Clarity contract deployments
- Automatic nonce management — sequential transactions in a single test get incrementing nonces without waiting for confirmation
- Test dApp deploy page + E2E spec against Clarinet devnet
- E2E spec: send 3 sequential txs in one test, all confirm on devnet
- Devnet CI setup — Clarinet devnet in GitHub Actions for automated E2E runs

**Deliverable**: Deploy + multi-tx flows work. Devnet E2E pipeline running in CI.

### v0.4 — Multi-Account

Test multi-user scenarios within a single test.

- Account switching mid-test — change the active wallet identity without reconnecting
- Multi-account fixtures — configure multiple wallets from a single mnemonic
- Test dApp multi-account page + E2E spec showing two users interacting with the same contract
- Example scenario: user A supplies STX, user B borrows against it

**Deliverable**: Multi-user E2E testing. Two-sided dApp flows covered.

### v0.5 — Bitcoin / sBTC Support

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

**Deliverable**: Published package on npm. Docs site live. Production users.
