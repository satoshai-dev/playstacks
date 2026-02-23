/**
 * Withdraw STX from Zest Protocol.
 *
 * Withdraws 0.01 STX to keep the wallet funded for future supply tests.
 *
 * Setup: same as supply.spec.ts — needs TEST_MNEMONIC in .env
 */
import { testWithStacks, expect } from '@satoshai/playstacks';

const test = testWithStacks({
  mnemonic: process.env.TEST_MNEMONIC!,
  accountIndex: Number(process.env.TEST_ACCOUNT_INDEX ?? 0),
  network: 'mainnet',
  fee: {
    multiplier: 1.0,
    maxFee: 30_000,
  },
});

test('withdraw STX from Zest dashboard', async ({ page, stacks }) => {
  console.log(`[withdraw] Wallet address: ${stacks.wallet.address}`);

  // 1. Navigate to Zest dashboard
  await page.goto('https://app.zestprotocol.com', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  // 2. Connect wallet via xverse
  await page.getByRole('button', { name: 'Connect Wallet' }).first().click();
  const walletManagerDialog = page.getByRole('dialog', { name: 'Wallet Manager' });
  await expect(walletManagerDialog).toBeVisible({ timeout: 5_000 });
  await walletManagerDialog.getByRole('button', { name: /xverse/i }).click();

  const shortAddress = stacks.wallet.address.slice(0, 8);
  await expect(page.getByText(shortAddress)).toBeVisible({ timeout: 15_000 });
  console.log('[withdraw] Wallet connected');

  // 3. Navigate to dashboard
  await page.goto('https://app.zestprotocol.com', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  // 4. Dismiss "Dual Stacking Rewards" dialog if it appears
  const dualStackingDialog = page.getByRole('dialog', { name: 'Dual Stacking Rewards' });
  try {
    await dualStackingDialog.waitFor({ state: 'visible', timeout: 3_000 });
    await dualStackingDialog.getByRole('button').first().click();
    console.log('[withdraw] Dismissed Dual Stacking dialog');
  } catch {
    // Dialog didn't appear — that's fine
  }

  // 5. Click "Withdraw" next to STX in "Your Supplies"
  await expect(page.getByText('Your Supplies')).toBeVisible({ timeout: 10_000 });
  const withdrawLink = page.locator('a[href*="withdraw=stx"]');
  await expect(withdrawLink).toBeVisible({ timeout: 10_000 });
  await withdrawLink.click();
  console.log('[withdraw] Clicked Withdraw on STX');

  // 6. Wait for Withdraw dialog and enter amount
  const withdrawDialog = page.getByRole('dialog', { name: 'Withdraw' });
  await expect(withdrawDialog).toBeVisible({ timeout: 10_000 });
  console.log('[withdraw] Withdraw dialog visible');

  const withdrawInput = withdrawDialog.getByRole('textbox');
  await withdrawInput.clear();
  await withdrawInput.fill('0.01');
  console.log('[withdraw] Filled withdraw amount: 0.01 STX');

  // 7. Click the Withdraw button
  const withdrawConfirmButton = withdrawDialog.getByRole('button', { name: 'Withdraw' });
  await expect(withdrawConfirmButton).toBeEnabled({ timeout: 5_000 });
  await withdrawConfirmButton.click();
  console.log('[withdraw] Clicked Withdraw button — waiting for tx...');

  // 8. Wait for transaction broadcast
  await expect(
    page.getByRole('heading', { name: 'Transaction Broadcast' })
  ).toBeVisible({ timeout: 60_000 });
  const txid = stacks.wallet.lastTxId();
  console.log(`[withdraw] Withdraw transaction broadcast! txid: ${txid}`);

  // 9. Wait for on-chain confirmation
  await expect(
    page.getByRole('heading', { name: 'Transaction Successful' })
  ).toBeVisible({ timeout: 120_000 });
  console.log('[withdraw] Withdraw transaction confirmed on-chain!');
});
