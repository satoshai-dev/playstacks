import { testWithStacks, expect } from '@satoshai/playstacks';

const TEST_KEY =
  'b244296d5907de9864c0b0d51f98a13c52890be0404e83f273144cd5b9960eed01';

const test = testWithStacks({
  privateKey: TEST_KEY,
  network: 'testnet',
});

test('sign an unsigned transaction', async ({ page, stacks: _stacks }) => {
  await page.goto('/#sign-transaction');

  await page.getByTestId('sign-btn').click();

  const result = page.getByTestId('result');
  // Result should contain the signed transaction hex (long hex string)
  await expect(result).toContainText('"transaction"', { timeout: 10_000 });
});
