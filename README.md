# Playstacks

**E2E testing SDK for Stacks blockchain dApps.**

Playwright-based library that injects mock wallet providers (Leather, Xverse) into the browser, signs real transactions with real private keys via `@stacks/transactions`, and broadcasts to any network — mainnet, testnet, or devnet. The library handles fee estimation so you don't have to.

> There is no E2E testing tool for Stacks dApps. Ethereum has Synpress, Solana has Phantom support in Synpress v4, Cosmos has @agoric/synpress. Stacks has nothing. Playstacks fills that gap.

## How it works

1. Playwright's `page.exposeFunction()` creates a Node-to-browser bridge
2. `page.addInitScript()` injects `window.StacksProvider`, `window.LeatherProvider`, and `window.XverseProviders` — all pointing to a mock that forwards `.request()` calls to the Node-side handler
3. The handler uses `@stacks/transactions` to build, sign, and broadcast real transactions with your private key
4. Private keys never enter the browser

Works with any dApp built on `@stacks/connect`, Leather's direct API, or Xverse's Sats Connect.

## Example

```typescript
import { testWithStacks, expect } from 'playstacks';

const test = testWithStacks({
  mnemonic: process.env.TEST_MNEMONIC!,
  accountIndex: 0,
  network: 'mainnet', // required — no silent default
  fee: { maxFee: 30_000 },
});

test('supply STX on Zest', async ({ page, stacks }) => {
  await page.goto('https://app.zestprotocol.com');

  // Connect wallet — mock auto-responds to getAddresses
  await page.getByRole('button', { name: 'Connect Wallet' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Wallet Manager' });
  await dialog.getByRole('button', { name: /xverse/i }).click();
  await expect(page.getByText(stacks.wallet.address.slice(0, 8))).toBeVisible();

  // Navigate to dashboard and supply STX
  await page.goto('https://app.zestprotocol.com');
  await page.locator('a[href*="supply=stx"]').click();

  const supplyDialog = page.getByRole('dialog', { name: 'Supply' });
  await supplyDialog.getByRole('textbox').fill('0.01');
  await supplyDialog.getByRole('button', { name: 'Supply' }).click();

  // Mock signs real tx, broadcasts to mainnet — wait for on-chain confirmation
  await expect(
    page.getByRole('heading', { name: 'Transaction Successful' })
  ).toBeVisible({ timeout: 120_000 });
});
```

See [`apps/zest-e2e/`](apps/zest-e2e/) for the full working test suite.

## Fixture API

```typescript
test('example', async ({ page, stacks }) => {
  // Wallet info
  stacks.wallet.address;       // STX address derived from your key
  stacks.wallet.publicKey;     // Public key hex
  stacks.wallet.lastTxId();    // Last broadcast txid (or null)
  stacks.wallet.rejectNext();  // Next wallet request throws UserRejected

  // Wait for tx confirmation on-chain
  const result = await stacks.waitForTx('0xabc123...');
  // result.status: 'success' | 'abort_by_response' | 'abort_by_post_condition'

  // Read contract state (no tx needed)
  const value = await stacks.callReadOnly({
    contract: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.pool-0-reserve',
    functionName: 'get-balance',
    functionArgs: [Cl.principal(stacks.wallet.address)],
  });

  // Account state
  const balance = await stacks.getBalance();  // bigint (microstacks)
  const nonce = await stacks.getNonce();      // bigint
});
```

## Configuration

```typescript
import { testWithStacks } from 'playstacks';

const test = testWithStacks({
  // Auth — pick one (required)
  mnemonic: process.env.TEST_MNEMONIC!,   // BIP-39 seed phrase
  accountIndex: 0,                         // wallet account index (default: 0)
  // — OR —
  // privateKey: process.env.TEST_STX_KEY!, // hex private key

  // Network (required — no silent default)
  network: 'mainnet',  // 'mainnet' | 'testnet' | 'devnet' | { url: '...' }

  // Fee management (optional)
  fee: {
    multiplier: 1.0,     // multiplier on estimated fee (default: 1.0)
    maxFee: 500_000,     // cap in microstacks (default: 500_000 = 0.5 STX)
    // fixed: 10_000,    // skip estimation, use exact fee
  },

  // Confirmation polling (optional)
  confirmation: {
    timeout: 120_000,    // max wait time in ms (default: 120_000)
    pollInterval: 2_000, // poll interval in ms (default: 2_000)
  },
});
```

## Key features

- **Real keys, real transactions** — use your own private keys or mnemonic, sign and broadcast to mainnet/testnet/devnet
- **Fee management** — Stacks fee estimation is notoriously broken (overestimates by 10-100x). Playstacks caps and controls fees so you don't overpay.
- **All wallets** — one mock covers `@stacks/connect`, Leather, Xverse, and WBIP provider registry
- **On-chain assertions** — `waitForTx()`, `callReadOnly()`, `getBalance()` for verifying contract state
- **Mnemonic support** — use the same seed phrase as your Leather/Xverse wallet
- **Rejection testing** — `wallet.rejectNext()` to test error flows without sending transactions
- **Contract identifiers** — `callReadOnly` accepts `'SPaddr.name'` or split `contractAddress`/`contractName`

## Roadmap

| Version | What | Status |
|---------|------|--------|
| **v0.1** | Mock provider, `getAddresses`/`stx_callContract`/`stx_transferStx`, fee estimation, Playwright fixtures, mnemonic support, `waitForTx`/`callReadOnly`/`getBalance`/`getNonce`, rejection testing, post-conditions, unit tests, Zest E2E reference | **Done** |
| **v0.2** | Full signing (`signMessage`, `signTransaction`, `signStructuredMessage`, `deployContract`), nonce management, multi-account switching | Planned |
| **v0.3** | Bitcoin/sBTC — `signPsbt`, sBTC bridge flows, Bitcoin address derivation | Planned |
| **v1.0** | Stable npm release (see below) | Planned |

### v1.0 — publish checklist

- [ ] **CI/CD** — GitHub Actions: lint, typecheck, unit tests on PR; npm publish on tag
- [ ] **npm publish** — `playstacks` package on npm with provenance
- [ ] **API stability review** — audit public types for breaking change risk, lock down exports
- [ ] **Docs site** — API reference (typedoc or similar), getting started guide, migration guide
- [ ] **Devnet integration tests** — E2E tests against Clarinet devnet (no mainnet STX needed)
- [ ] **Error messages** — actionable errors for every failure path (bad key, network unreachable, tx rejected, fee estimation failure)
- [ ] **Logging** — opt-in debug logging (`DEBUG=playstacks:*` or config flag) for troubleshooting
- [ ] **Parallel test support** — unique nonce management per worker, no shared state between tests
- [x] **Changelog** — CHANGELOG.md with semver, keep-a-changelog format
- [ ] **Automated changelog** — changesets or conventional-commits for automated release notes
- [ ] **Contributing guide** — CONTRIBUTING.md with dev setup, test instructions, PR process
- [x] **LICENSE** — MIT license file in repo root
- [ ] **Examples** — standalone repo or npx template (`npx create-playstacks`) for quick start
- [ ] **Ecosystem adoption** — announce on Stacks Discord, forum post, reach out to StackingDAO/BitFlow/Alex/Arkadiko teams

## Tech stack

- **TypeScript** — strict mode
- **@stacks/transactions** ^7.3.0 — transaction building, signing, broadcasting
- **@stacks/wallet-sdk** ^7.2.0 — mnemonic derivation
- **@playwright/test** — peer dependency, users bring their own version
- **tsup** — build (ESM + CJS + .d.ts)
- **vitest** — unit tests (29 passing)

## Documentation

- [`docs/playstacks.md`](docs/playstacks.md) — full implementation plan, architecture, configuration API, fee management, roadmap
- [`docs/stacks-tooling.md`](docs/stacks-tooling.md) — Stacks developer tooling landscape: what exists today, what's strong, and where the gaps are vs Ethereum, Solana, and Bitcoin L2s

## Status

Under active development. First production user: [Zest Protocol](https://zestprotocol.com).

## License

MIT
