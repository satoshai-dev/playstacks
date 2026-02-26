import type { NetworkOption } from '../config.js';
import { ConfigurationError } from '../errors.js';

export interface ResolvedNetwork {
  /** Human-readable name */
  name: string;
  /** Stacks API base URL (no trailing slash) */
  apiUrl: string;
  /** Network identifier for @stacks/transactions */
  stacksNetwork: 'mainnet' | 'testnet' | 'devnet';
}

const NETWORK_MAP: Record<string, ResolvedNetwork> = {
  mainnet: {
    name: 'mainnet',
    apiUrl: 'https://api.hiro.so',
    stacksNetwork: 'mainnet',
  },
  testnet: {
    name: 'testnet',
    apiUrl: 'https://api.testnet.hiro.so',
    stacksNetwork: 'testnet',
  },
  devnet: {
    name: 'devnet',
    apiUrl: 'http://localhost:3999',
    stacksNetwork: 'devnet',
  },
};

export function resolveNetwork(option: NetworkOption): ResolvedNetwork {
  if (typeof option === 'string') {
    const network = NETWORK_MAP[option];
    if (!network) {
      throw new ConfigurationError(
        `Unknown network "${option}". Use "mainnet", "testnet", "devnet", or { url: "..." }.`
      );
    }
    return network;
  }

  // Custom URL
  return {
    name: 'custom',
    apiUrl: option.url.replace(/\/$/, ''),
    stacksNetwork: 'mainnet', // default to mainnet tx version for custom URLs
  };
}
