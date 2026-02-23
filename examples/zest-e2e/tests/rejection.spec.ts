/**
 * Wallet rejection testing example.
 *
 * Demonstrates testing what happens when a user rejects a transaction.
 * No real transactions are sent — the mock rejects before signing.
 *
 * Setup: same as supply.spec.ts — needs TEST_MNEMONIC in .env
 */
import { testWithStacks, expect } from '@satoshai/playstacks';

const test = testWithStacks({
  mnemonic: process.env.TEST_MNEMONIC!,
  accountIndex: Number(process.env.TEST_ACCOUNT_INDEX ?? 0),
  network: 'mainnet',
  fee: { maxFee: 30_000 },
});

test('shows error when user rejects transaction', async ({ page, stacks }) => {
  await page.goto('https://app.zestprotocol.com');
  await page.waitForLoadState('networkidle');

  // Connect wallet via xverse
  await page.getByRole('button', { name: 'Connect Wallet' }).first().click();
  const walletManagerDialog = page.getByRole('dialog', { name: 'Wallet Manager' });
  await expect(walletManagerDialog).toBeVisible({ timeout: 5_000 });
  await walletManagerDialog.getByRole('button', { name: /xverse/i }).click();

  const shortAddress = stacks.wallet.address.slice(0, 8);
  await expect(page.getByText(shortAddress)).toBeVisible({ timeout: 15_000 });

  // Navigate to the dashboard with wallet connected
  await page.goto('https://app.zestprotocol.com');
  await page.waitForLoadState('networkidle');

  // Dismiss "Dual Stacking Rewards" dialog if it appears
  const dualStackingDialog = page.getByRole('dialog', { name: 'Dual Stacking Rewards' });
  try {
    await dualStackingDialog.waitFor({ state: 'visible', timeout: 3_000 });
    await dualStackingDialog.getByRole('button').first().click();
  } catch {
    // Dialog didn't appear — that's fine
  }

  // Open STX supply dialog
  await expect(page.getByText('Assets to Supply')).toBeVisible({ timeout: 10_000 });
  const supplyLink = page.locator('a[href*="supply=stx"]');
  await expect(supplyLink).toBeVisible({ timeout: 10_000 });
  await supplyLink.click();

  const supplyDialog = page.getByRole('dialog', { name: 'Supply' });
  await expect(supplyDialog).toBeVisible({ timeout: 10_000 });

  // Flag the NEXT wallet request to be rejected
  stacks.wallet.rejectNext();

  // Fill amount and click Supply — the mock will reject this request
  const supplyInput = supplyDialog.getByRole('textbox');
  await supplyInput.clear();
  await supplyInput.fill('0.01');

  const supplyConfirmButton = supplyDialog.getByRole('button', { name: 'Supply' });
  await expect(supplyConfirmButton).toBeEnabled({ timeout: 5_000 });
  await supplyConfirmButton.click();

  // The dApp should handle the rejection gracefully — Zest shows "Transaction Failed"
  await expect(
    page.getByRole('heading', { name: 'Transaction Failed' })
  ).toBeVisible({ timeout: 10_000 });
});
