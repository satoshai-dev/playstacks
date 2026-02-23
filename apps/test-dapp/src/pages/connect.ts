export function renderConnect(el: HTMLElement) {
  el.innerHTML = `
    <h2>Connect Wallet</h2>
    <button data-testid="connect-btn">Connect</button>
    <pre data-testid="result"></pre>
  `;

  const btn = el.querySelector<HTMLButtonElement>('[data-testid="connect-btn"]')!;
  const result = el.querySelector<HTMLPreElement>('[data-testid="result"]')!;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const response = await window.StacksProvider!.request('getAddresses');
      result.textContent = JSON.stringify(response, null, 2);
    } catch (err) {
      result.textContent = `Error: ${(err as Error).message}`;
    } finally {
      btn.disabled = false;
    }
  });
}
