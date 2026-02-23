# Playstacks

**E2E testing SDK for Stacks dApps.**

Playwright-based. Injects a mock Xverse wallet provider into the browser, signs real transactions with `@stacks/transactions`, broadcasts to any network. No browser extension needed.

### Demo: Supply STX on Zest Protocol (mainnet)

<!-- To display on GitHub: drag docs/assets/zest-supply-demo.mp4 into a GitHub issue, then paste the URL below -->
<video src="docs/assets/zest-supply-demo.mp4" autoplay loop muted playsinline></video>

## Quick Start

```bash
pnpm add -D @satoshai/playstacks @playwright/test
```

```typescript
import { testWithStacks, expect } from '@satoshai/playstacks';

const test = testWithStacks({
  mnemonic: process.env.TEST_MNEMONIC!,
  network: 'mainnet',
  fee: { maxFee: 30_000 },
});

test('supply STX on Zest', async ({ page, stacks }) => {
  await page.goto('https://app.zestprotocol.com');

  // Connect wallet — mock auto-responds
  await page.getByRole('button', { name: 'Connect Wallet' }).first().click();
  await page.getByRole('button', { name: /xverse/i }).click();
  await expect(page.getByText(stacks.wallet.address.slice(0, 8))).toBeVisible();

  // Supply STX
  await page.locator('a[href*="supply=stx"]').click();
  const dialog = page.getByRole('dialog', { name: 'Supply' });
  await dialog.getByRole('textbox').fill('0.01');
  await dialog.getByRole('button', { name: 'Supply' }).click();

  // Wait for on-chain confirmation
  await expect(
    page.getByRole('heading', { name: 'Transaction Successful' })
  ).toBeVisible({ timeout: 120_000 });
});
```

## Fixture API

```typescript
test('example', async ({ page, stacks }) => {
  stacks.wallet.address;         // STX address
  stacks.wallet.publicKey;       // public key hex
  stacks.wallet.lastTxId();      // last broadcast txid
  stacks.wallet.rejectNext();    // next request throws UserRejected

  await stacks.waitForTx(txid);  // poll until confirmed
  await stacks.callReadOnly({    // read contract state
    contract: 'SPaddr.contract-name',
    functionName: 'get-balance',
    functionArgs: [Cl.principal(stacks.wallet.address)],
  });
  await stacks.getBalance();     // bigint (microstacks)
  await stacks.getNonce();       // bigint
});
```

## Configuration

```typescript
const test = testWithStacks({
  // Auth — pick one (required)
  mnemonic: 'your seed phrase',
  accountIndex: 0,                // default: 0
  // — OR —
  // privateKey: '0xdeadbeef...',

  // Network (required)
  network: 'mainnet',  // 'mainnet' | 'testnet' | 'devnet' | { url: '...' }

  // Fee management (optional)
  fee: {
    maxFee: 500_000,   // cap in microstacks (default: 0.5 STX)
    multiplier: 1.0,   // multiplier on estimated fee (default: 1.0)
    // fixed: 10_000,  // skip estimation, use exact fee
  },

  // Confirmation polling (optional)
  confirmation: {
    timeout: 120_000,    // default: 2 min
    pollInterval: 2_000, // default: 2s
  },
});
```

## Documentation

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — dev workflow, changesets, commit conventions, releasing
- [`docs/understanding-playstacks.md`](docs/understanding-playstacks.md) — how it works, architecture, why it's easy
- [`docs/playstacks.md`](docs/playstacks.md) — full technical spec and roadmap
- [`examples/zest/`](examples/zest/) — Zest Protocol supply + withdraw (mainnet)
- [`examples/satoshai/`](examples/satoshai/) — SatoshAI login flow (mainnet)
- [`apps/test-dapp/`](apps/test-dapp/) — self-contained test dApp exercising all wallet methods

## Status

Under active development. Production users: [Zest Protocol](https://zestprotocol.com), [SatoshAI](https://app.satoshai.io).

## License

MIT
