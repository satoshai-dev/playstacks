export function renderCallContract(el: HTMLElement) {
  el.innerHTML = `
    <h2>Call Contract</h2>
    <div class="field">
      <label for="contract">Contract (SP...addr.name)</label>
      <input id="contract" data-testid="contract" placeholder="SPaddr.contract-name" />
    </div>
    <div class="field">
      <label for="function-name">Function Name</label>
      <input id="function-name" data-testid="function-name" placeholder="my-function" />
    </div>
    <button data-testid="call-btn">Call Contract</button>
    <pre data-testid="result"></pre>
  `;

  const btn = el.querySelector<HTMLButtonElement>('[data-testid="call-btn"]')!;
  const result = el.querySelector<HTMLPreElement>('[data-testid="result"]')!;

  btn.addEventListener('click', async () => {
    const contract = (el.querySelector<HTMLInputElement>('[data-testid="contract"]')!).value;
    const functionName = (el.querySelector<HTMLInputElement>('[data-testid="function-name"]')!).value;

    btn.disabled = true;
    try {
      const response = await window.StacksProvider!.request('stx_callContract', {
        contract,
        functionName,
        functionArgs: [],
      });
      result.textContent = JSON.stringify(response, null, 2);
    } catch (err) {
      result.textContent = `Error: ${(err as Error).message}`;
    } finally {
      btn.disabled = false;
    }
  });
}
