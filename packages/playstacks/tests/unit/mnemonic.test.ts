import { describe, it, expect } from 'vitest';
import { derivePrivateKeyFromMnemonic, deriveWalletIdentity } from '../../src/wallet/key-manager.js';

describe('derivePrivateKeyFromMnemonic', () => {
  // Standard BIP-39 test mnemonic — DO NOT use for real funds
  const TEST_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  it('derives a private key from a mnemonic (account 0)', async () => {
    const privateKey = await derivePrivateKeyFromMnemonic(TEST_MNEMONIC, 0);

    expect(privateKey).toBeTruthy();
    expect(typeof privateKey).toBe('string');
    // Private keys are 66 hex chars (32 bytes + 01 compression suffix)
    expect(privateKey).toHaveLength(66);
    expect(privateKey).toMatch(/^[0-9a-f]+$/);
  });

  it('derives different keys for different account indices', async () => {
    const key0 = await derivePrivateKeyFromMnemonic(TEST_MNEMONIC, 0);
    const key1 = await derivePrivateKeyFromMnemonic(TEST_MNEMONIC, 1);

    expect(key0).not.toBe(key1);
  });

  it('derives the same key for the same mnemonic + index', async () => {
    const key1 = await derivePrivateKeyFromMnemonic(TEST_MNEMONIC, 0);
    const key2 = await derivePrivateKeyFromMnemonic(TEST_MNEMONIC, 0);

    expect(key1).toBe(key2);
  });

  it('produces a valid wallet identity from the derived key', async () => {
    const privateKey = await derivePrivateKeyFromMnemonic(TEST_MNEMONIC, 0);
    const identity = deriveWalletIdentity(privateKey, true);

    expect(identity.address).toMatch(/^SP/);
    expect(identity.publicKey).toBeTruthy();
  });
});
