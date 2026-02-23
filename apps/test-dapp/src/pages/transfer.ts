export function renderTransfer(el: HTMLElement) {
  el.innerHTML = `
    <h2>Transfer STX</h2>
    <div class="field">
      <label for="recipient">Recipient Address</label>
      <input id="recipient" data-testid="recipient" placeholder="ST..." />
    </div>
    <div class="field">
      <label for="amount">Amount (microstacks)</label>
      <input id="amount" data-testid="amount" type="number" placeholder="1000000" />
    </div>
    <div class="field">
      <label for="memo">Memo (optional)</label>
      <input id="memo" data-testid="memo" placeholder="optional memo" />
    </div>
    <button data-testid="transfer-btn">Transfer</button>
    <pre data-testid="result"></pre>
  `;

  const btn = el.querySelector<HTMLButtonElement>('[data-testid="transfer-btn"]')!;
  const result = el.querySelector<HTMLPreElement>('[data-testid="result"]')!;

  btn.addEventListener('click', async () => {
    const recipient = (el.querySelector<HTMLInputElement>('[data-testid="recipient"]')!).value;
    const amount = (el.querySelector<HTMLInputElement>('[data-testid="amount"]')!).value;
    const memo = (el.querySelector<HTMLInputElement>('[data-testid="memo"]')!).value;

    btn.disabled = true;
    try {
      const response = await window.StacksProvider!.request('stx_transferStx', {
        recipient,
        amount,
        ...(memo ? { memo } : {}),
      });
      result.textContent = JSON.stringify(response, null, 2);
    } catch (err) {
      result.textContent = `Error: ${(err as Error).message}`;
    } finally {
      btn.disabled = false;
    }
  });
}
