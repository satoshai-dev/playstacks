import { testWithStacks, expect } from '@satoshai/playstacks';

const TEST_KEY =
  'b244296d5907de9864c0b0d51f98a13c52890be0404e83f273144cd5b9960eed01';

const test = testWithStacks({
  privateKey: TEST_KEY,
  network: 'testnet',
});

test('connect wallet and display address', async ({ page, stacks }) => {
  await page.goto('/#connect');
  await page.getByTestId('connect-btn').click();

  const result = page.getByTestId('result');
  await expect(result).toContainText(stacks.wallet.address, { timeout: 5_000 });
  await expect(result).toContainText(stacks.wallet.publicKey);
});
