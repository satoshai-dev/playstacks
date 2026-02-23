import {
  makeUnsignedSTXTokenTransfer,
  serializeTransaction,
} from '@stacks/transactions';

export function renderSignTransaction(el: HTMLElement) {
  el.innerHTML = `
    <h2>Sign Transaction</h2>
    <p style="color: #8b949e; margin-bottom: 16px; font-size: 13px;">
      Builds an unsigned STX transfer and sends it for signing (no broadcast).
    </p>
    <button data-testid="sign-btn">Build &amp; Sign Transaction</button>
    <pre data-testid="result"></pre>
  `;

  const btn = el.querySelector<HTMLButtonElement>('[data-testid="sign-btn"]')!;
  const result = el.querySelector<HTMLPreElement>('[data-testid="result"]')!;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      // First get the wallet's public key
      // .request() returns full JSON-RPC envelope { result: { addresses: [...] } }
      const addrEnvelope = (await window.StacksProvider!.request('getAddresses')) as {
        result: { addresses: Array<{ address: string; publicKey: string; symbol?: string }> };
      };
      // STX address is at index 2 (Xverse format: BTC payment, BTC ordinals, STX)
      const stxAddr = addrEnvelope.result.addresses.find(
        (a) => a.symbol === 'STX' || a.address?.startsWith('S')
      ) ?? addrEnvelope.result.addresses[2];
      const { publicKey } = stxAddr;

      // Build an unsigned STX transfer
      const unsignedTx = await makeUnsignedSTXTokenTransfer({
        recipient: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
        amount: 1000n,
        fee: 200n,
        nonce: 0n,
        network: 'testnet',
        publicKey,
      });

      const unsignedHex = serializeTransaction(unsignedTx);

      // Sign via wallet provider
      const response = await window.StacksProvider!.request('stx_signTransaction', {
        transaction: unsignedHex,
      });
      result.textContent = JSON.stringify(response, null, 2);
    } catch (err) {
      result.textContent = `Error: ${(err as Error).message}`;
    } finally {
      btn.disabled = false;
    }
  });
}
