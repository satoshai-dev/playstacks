import { testWithStacks, expect } from '@satoshai/playstacks';

/**
 * Satoshai Login E2E — connect wallet on app.satoshai.io
 *
 * Prerequisites:
 *   1. Copy .env.example → .env and fill in your test mnemonic
 *   2. Ensure the wallet address is whitelisted on app.satoshai.io
 */
const test = testWithStacks({
  mnemonic: process.env.TEST_MNEMONIC!,
  accountIndex: Number(process.env.TEST_ACCOUNT_INDEX ?? 0),
  network: 'mainnet',
});

test('connect wallet on SatoshAI Terminal', async ({ page, stacks }) => {
  console.log(`[satoshai-login] Wallet address: ${stacks.wallet.address}`);

  // 1. Navigate to app
  await page.goto('https://app.satoshai.io', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  // 2. Click "Connect Wallet" — opens the wallet dialog
  await page.getByRole('link', { name: 'Connect Wallet' }).click();

  // 3. Wait for the wallet connect dialog
  const walletDialog = page.getByRole('dialog');
  await expect(walletDialog).toBeVisible({ timeout: 5_000 });
  console.log('[satoshai-login] Wallet dialog visible');

  // 4. Xverse shows as "Detected" — click the Connect button next to it
  await walletDialog.getByRole('button', { name: 'Connect' }).click();
  console.log('[satoshai-login] Clicked Xverse Connect');

  // 5. Wait for the dialog to close (wallet connected)
  await expect(walletDialog).toBeHidden({ timeout: 15_000 });
  console.log('[satoshai-login] Wallet dialog closed — connected');

  // 6. Verify wallet connected — app shows truncated address (e.g. "SP3QE…QF15")
  const addr = stacks.wallet.address;
  const truncated = `${addr.slice(0, 5)}…${addr.slice(-4)}`;
  await expect(page.getByText(truncated)).toBeVisible({ timeout: 15_000 });
  console.log(`[satoshai-login] Wallet address visible: ${truncated}`);

  // 7. Verify we landed on the terminal page
  await expect(page).toHaveURL(/\/terminal/, { timeout: 5_000 });
  console.log('[satoshai-login] Redirected to /terminal');

  // 8. Sign the authentication message to access the terminal
  await page.getByRole('button', { name: 'Sign' }).click();
  console.log('[satoshai-login] Clicked Sign button');

  // 9. Verify terminal loaded — the greeting prompt appears
  await expect(page.getByText('How can I help you today?')).toBeVisible({ timeout: 15_000 });
  console.log('[satoshai-login] Terminal loaded — full login complete');
});
