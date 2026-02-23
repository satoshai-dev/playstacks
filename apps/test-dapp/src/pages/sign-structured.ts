import { Cl, cvToHex } from '@stacks/transactions';

export function renderSignStructured(el: HTMLElement) {
  // Hardcoded SIP-018 domain + message for testing
  const domain = Cl.tuple({
    name: Cl.stringAscii('test-app'),
    version: Cl.stringAscii('1.0.0'),
    'chain-id': Cl.uint(2147483648), // testnet
  });

  const message = Cl.tuple({
    action: Cl.stringAscii('login'),
    nonce: Cl.uint(Date.now()),
  });

  const domainHex = cvToHex(domain).replace(/^0x/, '');
  const messageHex = cvToHex(message).replace(/^0x/, '');

  el.innerHTML = `
    <h2>Sign Structured Message (SIP-018)</h2>
    <div class="field">
      <label>Domain (hex)</label>
      <input data-testid="domain" value="${domainHex}" readonly />
    </div>
    <div class="field">
      <label>Message (hex)</label>
      <input data-testid="message" value="${messageHex}" readonly />
    </div>
    <button data-testid="sign-btn">Sign Structured Message</button>
    <pre data-testid="result"></pre>
  `;

  const btn = el.querySelector<HTMLButtonElement>('[data-testid="sign-btn"]')!;
  const result = el.querySelector<HTMLPreElement>('[data-testid="result"]')!;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const response = await window.StacksProvider!.request('stx_signStructuredMessage', {
        domain: domainHex,
        message: messageHex,
      });
      result.textContent = JSON.stringify(response, null, 2);
    } catch (err) {
      result.textContent = `Error: ${(err as Error).message}`;
    } finally {
      btn.disabled = false;
    }
  });
}
