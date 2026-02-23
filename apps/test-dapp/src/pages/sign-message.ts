export function renderSignMessage(el: HTMLElement) {
  el.innerHTML = `
    <h2>Sign Message</h2>
    <div class="field">
      <label for="message">Message</label>
      <textarea id="message" data-testid="message" rows="3" placeholder="Hello Stacks"></textarea>
    </div>
    <button data-testid="sign-btn">Sign Message</button>
    <pre data-testid="result"></pre>
  `;

  const btn = el.querySelector<HTMLButtonElement>('[data-testid="sign-btn"]')!;
  const result = el.querySelector<HTMLPreElement>('[data-testid="result"]')!;

  btn.addEventListener('click', async () => {
    const message = (el.querySelector<HTMLTextAreaElement>('[data-testid="message"]')!).value;

    btn.disabled = true;
    try {
      const response = await window.StacksProvider!.request('stx_signMessage', {
        message,
      });
      result.textContent = JSON.stringify(response, null, 2);
    } catch (err) {
      result.textContent = `Error: ${(err as Error).message}`;
    } finally {
      btn.disabled = false;
    }
  });
}
