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
import { testWithStacks, expect, Cl } from 'playstacks';

const test = testWithStacks({
  privateKey: process.env.TEST_STX_KEY!,
  network: 'mainnet',
  fee: { maxFee: 500_000 },
});

test('supply STX to lending pool', async ({ page, stacks }) => {
  await page.goto('https://app.zestprotocol.com');

  // Connect wallet — mock auto-responds to getAddresses
  await page.getByRole('button', { name: /connect/i }).click();
  await expect(page.getByText(stacks.wallet.address.slice(0, 8))).toBeVisible();

  // Supply STX — mock signs real tx, broadcasts to mainnet
  await page.getByTestId('supply-amount').fill('10');
  await page.getByRole('button', { name: /supply/i }).click();
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

## Key features

- **Real keys, real transactions** — use your own private keys, sign and broadcast to mainnet/testnet/devnet
- **Fee management** — Stacks fee estimation is notoriously broken (overestimates by 10-100x). Playstacks caps and controls fees so you don't overpay.
- **All wallets** — one mock covers `@stacks/connect`, Leather, Xverse, and WBIP provider registry
- **On-chain assertions** — `waitForTx()`, `callReadOnly()`, `getBalance()` for verifying contract state
- **Configurable** — network, fee strategy, confirmation timeouts, rejection testing

## Roadmap

| Version | What | Timeline |
|---------|------|----------|
| **v0.1** | MVP — mock provider, `getAddresses`/`stx_callContract`/`stx_transferStx`, fee estimation, Playwright fixtures | Week 1-2 |
| **v0.2** | Full signing (`signMessage`, `signTransaction`, `deployContract`), `waitForTx`, `callReadOnly`, rejection testing | Week 3 |
| **v0.3** | Mnemonic/seed phrase support, multi-account, post-conditions, nonce management | Week 4 |
| **v0.4** | Bitcoin/sBTC — `signPsbt`, sBTC bridge flows, Bitcoin address derivation | Week 5-6 |
| **v1.0** | Stable release — API review, docs, npm publish, CI/CD, Zest reference implementation | Week 7-8 |

## Tech stack

- **TypeScript** — strict mode
- **@stacks/transactions** ^7.3.0 — transaction building, signing, broadcasting
- **@stacks/network** ^7.2.0 — network configuration
- **@playwright/test** — peer dependency, users bring their own version
- **tsup** — build (ESM + CJS + .d.ts)
- **vitest** — unit tests

## Documentation

- [`docs/playstacks.md`](docs/playstacks.md) — full implementation plan, architecture, configuration API, fee management, roadmap
- [`docs/stacks-tooling.md`](docs/stacks-tooling.md) — Stacks developer tooling landscape: what exists today, what's strong, and where the gaps are vs Ethereum, Solana, and Bitcoin L2s

## Status

Under active development. First production user: [Zest Protocol](https://zestprotocol.com).

## License

MIT
