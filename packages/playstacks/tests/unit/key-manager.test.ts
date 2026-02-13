import { describe, it, expect } from 'vitest';
import { deriveWalletIdentity } from '../../src/wallet/key-manager.js';

describe('deriveWalletIdentity', () => {
  // Well-known test key — DO NOT use for real funds
  const TEST_PRIVATE_KEY =
    'b244296d5907de9864c0b0d51f98a13c52890be0404e83f273144cd5b9960eed01';

  it('derives a mainnet address from a private key', () => {
    const identity = deriveWalletIdentity(TEST_PRIVATE_KEY, true);

    expect(identity.address).toMatch(/^SP/); // mainnet addresses start with SP
    expect(identity.publicKey).toBeTruthy();
    expect(identity.privateKey).toBe(TEST_PRIVATE_KEY);
  });

  it('derives a testnet address from a private key', () => {
    const identity = deriveWalletIdentity(TEST_PRIVATE_KEY, false);

    expect(identity.address).toMatch(/^ST/); // testnet addresses start with ST
    expect(identity.publicKey).toBeTruthy();
  });

  it('handles keys without 01 suffix', () => {
    const keyWithoutSuffix = TEST_PRIVATE_KEY.slice(0, 64);
    const identity = deriveWalletIdentity(keyWithoutSuffix, true);

    expect(identity.address).toMatch(/^SP/);
    expect(identity.publicKey).toBeTruthy();
  });

  it('handles 0x prefix', () => {
    const identity = deriveWalletIdentity(`0x${TEST_PRIVATE_KEY}`, true);

    expect(identity.address).toMatch(/^SP/);
  });

  it('throws on invalid key length', () => {
    expect(() => deriveWalletIdentity('abc', true)).toThrow(
      'Invalid private key length'
    );
  });
});
