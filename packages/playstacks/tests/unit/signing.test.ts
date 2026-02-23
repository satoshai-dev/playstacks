import { describe, it, expect } from 'vitest';
import {
  Cl,
  cvToHex,
  makeUnsignedSTXTokenTransfer,
  serializeTransaction,
} from '@stacks/transactions';
import { MockProviderHandler } from '../../src/wallet/mock-provider.js';
import type { ResolvedConfig } from '../../src/config.js';
import type {
  SignMessageResult,
  SignStructuredMessageResult,
  SignTransactionResult,
} from '../../src/wallet/types.js';

// Well-known test key — DO NOT use for real funds
const TEST_PRIVATE_KEY =
  'b244296d5907de9864c0b0d51f98a13c52890be0404e83f273144cd5b9960eed01';

function createHandler(): MockProviderHandler {
  const config: ResolvedConfig = {
    privateKey: TEST_PRIVATE_KEY,
    network: 'testnet',
    fee: { multiplier: 1.0, maxFee: 500_000 },
    confirmation: { timeout: 120_000, pollInterval: 2_000 },
  };
  return new MockProviderHandler(config);
}

/** Send a JSON-RPC request through the handler's public bridge */
async function request(
  handler: MockProviderHandler,
  method: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  const json = JSON.stringify({ method, params });
  const responseJson = await (handler as any).handleRequest(json);
  const response = JSON.parse(responseJson);
  if (response.error) throw new Error(response.error.message);
  return response.result;
}

describe('stx_signMessage', () => {
  it('returns a valid signature and publicKey', async () => {
    const handler = createHandler();
    const result = (await request(handler, 'stx_signMessage', {
      message: 'Hello Stacks',
    })) as SignMessageResult;

    // RSV signature: 65 bytes = 130 hex chars
    expect(result.signature).toMatch(/^[0-9a-f]{130}$/);
    expect(result.publicKey).toBe(handler.identity.publicKey);
  });

  it('produces different signatures for different messages', async () => {
    const handler = createHandler();
    const a = (await request(handler, 'stx_signMessage', {
      message: 'message A',
    })) as SignMessageResult;
    const b = (await request(handler, 'stx_signMessage', {
      message: 'message B',
    })) as SignMessageResult;

    expect(a.signature).not.toBe(b.signature);
  });

  it('is deterministic for the same message', async () => {
    const handler = createHandler();
    const a = (await request(handler, 'stx_signMessage', {
      message: 'deterministic',
    })) as SignMessageResult;
    const b = (await request(handler, 'stx_signMessage', {
      message: 'deterministic',
    })) as SignMessageResult;

    expect(a.signature).toBe(b.signature);
  });
});

describe('stx_signStructuredMessage', () => {
  it('returns a valid signature and publicKey', async () => {
    const handler = createHandler();

    const domain = Cl.tuple({
      name: Cl.stringAscii('test-app'),
      version: Cl.stringAscii('1.0.0'),
      'chain-id': Cl.uint(2147483648), // testnet chain id
    });
    const message = Cl.tuple({
      action: Cl.stringAscii('login'),
      nonce: Cl.uint(1),
    });

    const result = (await request(handler, 'stx_signStructuredMessage', {
      domain: cvToHex(domain).replace('0x', ''),
      message: cvToHex(message).replace('0x', ''),
    })) as SignStructuredMessageResult;

    expect(result.signature).toMatch(/^[0-9a-f]{130}$/);
    expect(result.publicKey).toBe(handler.identity.publicKey);
  });

  it('handles hex with 0x prefix', async () => {
    const handler = createHandler();

    // signStructuredData requires domain with name, version, chain-id
    const domain = Cl.tuple({
      name: Cl.stringAscii('prefix-test'),
      version: Cl.stringAscii('1.0.0'),
      'chain-id': Cl.uint(2147483648),
    });
    const message = Cl.tuple({ data: Cl.uint(42) });

    const result = (await request(handler, 'stx_signStructuredMessage', {
      domain: cvToHex(domain), // includes 0x prefix
      message: cvToHex(message),
    })) as SignStructuredMessageResult;

    expect(result.signature).toMatch(/^[0-9a-f]{130}$/);
  });
});

describe('stx_signTransaction', () => {
  it('returns a signed transaction hex', async () => {
    const handler = createHandler();

    const unsignedTx = await makeUnsignedSTXTokenTransfer({
      recipient: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      amount: 1000n,
      fee: 200n,
      nonce: 0n,
      network: 'testnet',
      publicKey: handler.identity.publicKey,
    });
    const unsignedHex = serializeTransaction(unsignedTx);

    const result = (await request(handler, 'stx_signTransaction', {
      transaction: unsignedHex,
    })) as SignTransactionResult;

    // Signed tx should be a hex string, different from unsigned
    expect(result.transaction).toMatch(/^[0-9a-f]+$/);
    expect(result.transaction).not.toBe(unsignedHex);
  });

  it('handles transaction hex without 0x prefix', async () => {
    const handler = createHandler();

    const unsignedTx = await makeUnsignedSTXTokenTransfer({
      recipient: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      amount: 500n,
      fee: 100n,
      nonce: 1n,
      network: 'testnet',
      publicKey: handler.identity.publicKey,
    });
    const unsignedHex = serializeTransaction(unsignedTx);
    // Strip 0x prefix if present
    const hexWithoutPrefix = unsignedHex.replace(/^0x/, '');

    const result = (await request(handler, 'stx_signTransaction', {
      transaction: hexWithoutPrefix,
    })) as SignTransactionResult;

    expect(result.transaction).toMatch(/^[0-9a-f]+$/);
  });
});
