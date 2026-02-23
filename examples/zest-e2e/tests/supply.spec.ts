import { testWithStacks, expect } from '@satoshai/playstacks';

const test = testWithStacks({
  mnemonic: process.env.TEST_MNEMONIC!,
  accountIndex: Number(process.env.TEST_ACCOUNT_INDEX ?? 0),
  network: 'mainnet',
  fee: {
    multiplier: 1.0,
    maxFee: 30_000, // 0.03 STX cap
  },
});

test('connect wallet and supply STX on Zest dashboard', async ({ page, stacks }) => {
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning' || msg.text().includes('Playstacks')) {
      console.log(`[browser:${type}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));

  console.log(`[playstacks] Wallet address: ${stacks.wallet.address}`);

  // 1. Navigate to Zest dashboard
  await page.goto('https://app.zestprotocol.com');
  await page.waitForLoadState('networkidle');

  // 2. Click "Connect Wallet" in the navbar
  await page.getByRole('button', { name: 'Connect Wallet' }).first().click();

  // 3. Wait for the Wallet Manager drawer
  const walletManagerDialog = page.getByRole('dialog', { name: 'Wallet Manager' });
  await expect(walletManagerDialog).toBeVisible({ timeout: 5_000 });
  console.log('[playstacks] Wallet Manager drawer visible');

  // 4. Click the xverse wallet option
  await walletManagerDialog.getByRole('button', { name: /xverse/i }).click();
  console.log('[playstacks] Clicked xverse in Wallet Manager');

  // 5. Wait for wallet to connect — address should appear in page
  const shortAddress = stacks.wallet.address.slice(0, 8);
  await expect(page.getByText(shortAddress)).toBeVisible({ timeout: 15_000 });
  console.log('[playstacks] Wallet connected — address visible on page');

  // 6. Navigate to the dashboard — with wallet connected, shows personalized view
  await page.goto('https://app.zestprotocol.com');
  await page.waitForLoadState('networkidle');
  console.log('[playstacks] Navigated to dashboard');

  // 7. Dismiss "Dual Stacking Rewards" dialog if it appears
  const dualStackingDialog = page.getByRole('dialog', { name: 'Dual Stacking Rewards' });
  try {
    await dualStackingDialog.waitFor({ state: 'visible', timeout: 3_000 });
    await dualStackingDialog.getByRole('button').first().click();
    console.log('[playstacks] Dismissed Dual Stacking dialog');
  } catch {
    // Dialog didn't appear — that's fine
  }

  // 8. Wait for "Assets to Supply" section to load
  await expect(page.getByText('Assets to Supply')).toBeVisible({ timeout: 10_000 });
  console.log('[playstacks] "Assets to Supply" section visible');

  // 9. Click "Supply" button next to STX in the "Assets to Supply" table
  const supplyButton = page.locator('a[href*="supply=stx"]');
  await expect(supplyButton).toBeVisible({ timeout: 10_000 });
  await supplyButton.click();
  console.log('[playstacks] Clicked Supply on STX');

  // 10. Wait for Supply dialog and enter amount
  const supplyDialog = page.getByRole('dialog', { name: 'Supply' });
  await expect(supplyDialog).toBeVisible({ timeout: 10_000 });
  console.log('[playstacks] Supply dialog visible');

  const supplyInput = supplyDialog.getByRole('textbox');
  await supplyInput.clear();
  await supplyInput.fill('0.01');
  console.log('[playstacks] Filled supply amount: 0.01 STX');

  // 11. Click the Supply button (enabled after entering amount)
  const supplyConfirmButton = supplyDialog.getByRole('button', { name: 'Supply' });
  await expect(supplyConfirmButton).toBeEnabled({ timeout: 5_000 });
  await supplyConfirmButton.click();
  console.log('[playstacks] Clicked Supply button — waiting for tx...');

  // 12. Wait for transaction broadcast confirmation
  await expect(
    page.getByRole('heading', { name: 'Transaction Broadcast' })
  ).toBeVisible({ timeout: 60_000 });
  const txid = stacks.wallet.lastTxId();
  console.log(`[playstacks] Supply transaction broadcast! txid: ${txid}`);

  // 13. Wait for on-chain confirmation — Zest UI polls and updates the dialog
  await expect(
    page.getByRole('heading', { name: 'Transaction Successful' })
  ).toBeVisible({ timeout: 120_000 });
  console.log('[playstacks] Supply transaction confirmed on-chain!');
});
