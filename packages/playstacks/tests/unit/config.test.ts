import { describe, it, expect } from 'vitest';
import { resolveConfig } from '../../src/config.js';

describe('resolveConfig', () => {
  const VALID_KEY = 'a'.repeat(64);

  it('applies default values when only privateKey and network are provided', () => {
    const config = resolveConfig({ privateKey: VALID_KEY, network: 'mainnet' });

    expect(config.network).toBe('mainnet');
    expect(config.fee.multiplier).toBe(1.0);
    expect(config.fee.maxFee).toBe(500_000);
    expect(config.fee.fixed).toBeUndefined();
    expect(config.confirmation.timeout).toBe(120_000);
    expect(config.confirmation.pollInterval).toBe(2_000);
  });

  it('preserves explicit values', () => {
    const config = resolveConfig({
      privateKey: VALID_KEY,
      network: 'testnet',
      fee: { multiplier: 2.0, maxFee: 1_000_000, fixed: 5_000 },
      confirmation: { timeout: 60_000, pollInterval: 1_000 },
    });

    expect(config.network).toBe('testnet');
    expect(config.fee.multiplier).toBe(2.0);
    expect(config.fee.maxFee).toBe(1_000_000);
    expect(config.fee.fixed).toBe(5_000);
    expect(config.confirmation.timeout).toBe(60_000);
    expect(config.confirmation.pollInterval).toBe(1_000);
  });

  it('supports custom network URL', () => {
    const config = resolveConfig({
      privateKey: VALID_KEY,
      network: { url: 'http://localhost:3999' },
    });

    expect(config.network).toEqual({ url: 'http://localhost:3999' });
  });

  it('merges partial fee config with defaults', () => {
    const config = resolveConfig({
      privateKey: VALID_KEY,
      network: 'mainnet',
      fee: { maxFee: 100_000 },
    });

    expect(config.fee.maxFee).toBe(100_000);
    expect(config.fee.multiplier).toBe(1.0); // default preserved
  });
});
