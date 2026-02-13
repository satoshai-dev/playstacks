# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Playstacks is an E2E testing SDK for Stacks blockchain dApps. It injects a mock Xverse wallet into Playwright browsers that signs real transactions with real keys. No browser extension needed.

Repository: `github.com/satoshai-dev/playstacks` (satoshai-dev org)

## Commands

```bash
pnpm install              # install deps + set up husky hooks
pnpm build                # tsup → ESM + CJS + .d.ts in packages/playstacks/dist/
pnpm test                 # vitest unit tests (29 tests)
pnpm test:e2e             # playwright E2E tests (examples/zest-e2e/)
pnpm lint                 # eslint across all packages + examples
pnpm typecheck            # tsc --noEmit across all packages

# Run a single test file
pnpm --filter playstacks vitest run tests/unit/fee-estimator.test.ts

# Run tests matching a pattern
pnpm --filter playstacks vitest run -t "fee estimator"

# Changesets
pnpm changeset            # create a changeset (patch/minor/major + summary)
pnpm changeset version    # consume changesets → bump version + update changelog
pnpm changeset publish    # publish to npm
```

## Git Workflow

- **Never commit without being asked.** Wait for explicit instructions.
- **Always work on a feature branch.** Never commit directly to `main`.
- **Open real PRs** — this repo will be open source. PRs create a review trail.
- **Conventional commits** enforced by commitlint: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- **Every PR that changes the library must include a changeset** (`.changeset/*.md`).

### Git hooks (husky)

| Hook | Runs |
|---|---|
| pre-commit | `pnpm lint && pnpm typecheck` |
| pre-push | `pnpm test` |
| commit-msg | commitlint (conventional commits) |

No CI/CD exists yet — hooks are the only automated gate. Do not skip them.

## Architecture

### Monorepo layout

```
packages/playstacks/        # The npm package (v0.1.1)
  src/
    index.ts                # Public API — all exports go through here
    config.ts               # PlaystacksConfig discriminated union + resolver
    fixtures.ts             # testWithStacks() — the Playwright fixture factory
    wallet/
      mock-provider.ts      # Node-side: signs txs, estimates fees, broadcasts
      mock-provider-script.ts  # Browser-side: injected IIFE, MUST be self-contained
      key-manager.ts        # Private key / mnemonic → address + publicKey
      types.ts              # JSON-RPC types (WalletRpcRequest, params, results)
    network/
      network-config.ts     # Resolves 'mainnet'|'testnet'|'devnet'|{url} → StacksNetwork
      api-client.ts         # HTTP calls to Stacks API (balance, nonce, fees)
    fees/
      fee-estimator.ts      # Two-pass estimation with multiplier + cap
    tx/
      broadcaster.ts        # broadcastTransaction wrapper
      confirmation.ts       # Polls /extended/v1/tx/{txid} until terminal
    helpers/
      read-only.ts          # callReadOnly for on-chain assertions
  tests/unit/               # vitest — one test file per module

examples/zest-e2e/          # Reference E2E tests (Zest Protocol) — FIRST-CLASS, must lint+typecheck
docs/                       # Architecture docs, roadmap, tooling landscape
```

### Core data flow

```
testWithStacks(config) → Playwright fixture
  ↓
MockProviderHandler.install(page)
  ├── page.exposeFunction('__playstacksRequest', handler)    ← Node↔Browser bridge
  └── page.addInitScript(mockProviderScript)                 ← Installs window.StacksProvider
  ↓
dApp calls window.StacksProvider.request(method, params)
  → Browser mock serializes to JSON, calls __playstacksRequest
  → Node-side handler: dispatch(method) → sign tx → estimate fee → broadcast
  → Returns txid to browser → dApp updates UI
```

### Key architectural constraints

1. **Private keys never enter the browser.** The browser mock is a JSON-RPC proxy. All signing happens in Node.js via `@stacks/transactions`.
2. **`mock-provider-script.ts` must be self-contained.** It's injected via `addInitScript()` — no imports, no external deps. It produces a raw IIFE string.
3. **Two-pass fee estimation for contract calls.** Build unsigned tx (fee=0) → estimate fee from serialized payload → rebuild with correct fee → sign → broadcast. This is in `MockProviderHandler.handleCallContract()`.
4. **Config uses a discriminated union** (`PrivateKeyConfig | MnemonicConfig`) with `never` fields to enforce mutual exclusivity at the type level.
5. **Xverse-only.** The mock installs `window.StacksProvider` and `window.XverseProviders`. No Leather/Hiro/WBIP shims.

## Testing Rules

- Every new exported function or method gets a unit test. No exceptions.
- Tests live in `packages/playstacks/tests/unit/`, one file per source module.
- Test runner is vitest. Tests run with `pnpm test`.
- Examples in `examples/` are first-class — they must pass lint and typecheck. Keep them in sync with the library API.

## Code Conventions

- ESM-first (`"type": "module"`). Use `.js` extensions in import paths (e.g., `'./config.js'`).
- Strict TypeScript (`tsconfig.base.json` → `"strict": true`).
- ESLint flat config with `typescript-eslint/recommended`. Unused vars prefixed with `_` are allowed.
- Dual build output: ESM (`.js`) + CJS (`.cjs`) + declarations (`.d.ts`) via tsup.
- All public types are exported from `src/index.ts`. Don't export internal implementation types.
- Re-exports `Cl`, `ClarityValue`, `cvToJSON`, `cvToString`, `cvToValue` from `@stacks/transactions` and `expect` from `@playwright/test` for convenience.
