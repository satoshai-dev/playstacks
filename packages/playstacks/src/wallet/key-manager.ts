import {
  privateKeyToPublic,
  publicKeyToAddress,
  publicKeyToHex,
  AddressVersion,
} from '@stacks/transactions';
import { generateWallet, generateNewAccount } from '@stacks/wallet-sdk';
import type { WalletIdentity } from './types.js';

/**
 * Normalize a private key hex string.
 * Stacks private keys may or may not have the 01 compression suffix.
 */
function normalizePrivateKey(key: string): string {
  // Strip 0x prefix if present
  const hex = key.startsWith('0x') ? key.slice(2) : key;
  // Validate length: 64 chars (32 bytes) or 66 chars (32 bytes + 01 suffix)
  if (hex.length !== 64 && hex.length !== 66) {
    throw new Error(
      `Invalid private key length: expected 64 or 66 hex chars, got ${hex.length}`
    );
  }
  return hex;
}

export function deriveWalletIdentity(
  privateKeyHex: string,
  isMainnet: boolean
): WalletIdentity {
  const normalized = normalizePrivateKey(privateKeyHex);
  const publicKeyBytes = privateKeyToPublic(normalized);
  const publicKey = publicKeyToHex(publicKeyBytes);

  const addressVersion = isMainnet
    ? AddressVersion.MainnetSingleSig
    : AddressVersion.TestnetSingleSig;

  const address = publicKeyToAddress(addressVersion, publicKeyBytes);

  return {
    address,
    publicKey,
    privateKey: normalized,
  };
}

/**
 * Derive a private key from a BIP-39 mnemonic phrase and account index.
 * Uses @stacks/wallet-sdk which follows the same derivation path as Leather/Xverse.
 *
 * Account index 0 = the first account you see in your wallet.
 */
export async function derivePrivateKeyFromMnemonic(
  mnemonic: string,
  accountIndex: number
): Promise<string> {
  let wallet = await generateWallet({ secretKey: mnemonic, password: '' });

  // generateWallet creates account 0 by default.
  // For higher indices, we need to call generateNewAccount repeatedly.
  while (wallet.accounts.length <= accountIndex) {
    wallet = generateNewAccount(wallet);
  }

  const account = wallet.accounts[accountIndex];
  return account.stxPrivateKey;
}
