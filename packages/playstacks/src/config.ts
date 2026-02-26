import { ConfigurationError } from './errors.js';

export type NetworkName = 'mainnet' | 'testnet' | 'devnet';

export interface CustomNetwork {
  url: string;
}

export type NetworkOption = NetworkName | CustomNetwork;

export interface FeeConfig {
  /** Multiplier applied to the estimated fee. Default: 1.0 */
  multiplier?: number;
  /** Maximum fee in microstacks. Default: 500_000 (0.5 STX) */
  maxFee?: number;
  /** Fixed fee in microstacks. Skips estimation when set. */
  fixed?: number;
}

export interface ConfirmationConfig {
  /** Max time to wait for tx confirmation in ms. Default: 120_000 */
  timeout?: number;
  /** Polling interval in ms. Default: 2_000 */
  pollInterval?: number;
}

interface BaseConfig {
  /** Network to connect to (required — no silent default) */
  network: NetworkOption;
  /** Fee management config */
  fee?: FeeConfig;
  /** Tx confirmation config */
  confirmation?: ConfirmationConfig;
  /** Request timeout in ms for API calls. Default: 30_000 (30s) */
  requestTimeout?: number;
}

export interface PrivateKeyConfig extends BaseConfig {
  /** Hex-encoded private key (with or without 01 compression suffix) */
  privateKey: string;
  mnemonic?: never;
  accountIndex?: never;
}

export interface MnemonicConfig extends BaseConfig {
  /** BIP-39 mnemonic phrase (12 or 24 words) */
  mnemonic: string;
  /** Account index to derive. Default: 0 (first account in your wallet) */
  accountIndex?: number;
  privateKey?: never;
}

export type PlaystacksConfig = PrivateKeyConfig | MnemonicConfig;

export interface ResolvedConfig {
  privateKey: string;
  network: NetworkOption;
  fee: Required<Omit<FeeConfig, 'fixed'>> & Pick<FeeConfig, 'fixed'>;
  confirmation: Required<ConfirmationConfig>;
  requestTimeout: number;
}

const DEFAULT_FEE: ResolvedConfig['fee'] = {
  multiplier: 1.0,
  maxFee: 500_000,
};

const DEFAULT_CONFIRMATION: ResolvedConfig['confirmation'] = {
  timeout: 120_000,
  pollInterval: 2_000,
};

export function resolveConfig(config: PlaystacksConfig, derivedPrivateKey?: string): ResolvedConfig {
  const privateKey = 'privateKey' in config && config.privateKey
    ? config.privateKey
    : derivedPrivateKey;

  if (!privateKey) {
    throw new ConfigurationError('No private key available. Provide privateKey or mnemonic.');
  }

  return {
    privateKey,
    network: config.network,
    fee: {
      ...DEFAULT_FEE,
      ...config.fee,
    },
    confirmation: {
      ...DEFAULT_CONFIRMATION,
      ...config.confirmation,
    },
    requestTimeout: config.requestTimeout ?? 30_000,
  };
}

export function isMnemonicConfig(config: PlaystacksConfig): config is MnemonicConfig {
  return 'mnemonic' in config && typeof config.mnemonic === 'string';
}
