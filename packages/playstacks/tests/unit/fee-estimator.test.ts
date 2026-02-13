import { describe, it, expect, vi, beforeEach } from 'vitest';
import { estimateTransferFee, estimateContractCallFee } from '../../src/fees/fee-estimator.js';
import type { ResolvedNetwork } from '../../src/network/network-config.js';
import type { ResolvedConfig } from '../../src/config.js';

// Mock the api-client module
vi.mock('../../src/network/api-client.js', () => ({
  fetchTransferFeeRate: vi.fn(),
  fetchTransactionFeeEstimate: vi.fn(),
}));

import {
  fetchTransferFeeRate,
  fetchTransactionFeeEstimate,
} from '../../src/network/api-client.js';

const mockNetwork: ResolvedNetwork = {
  name: 'testnet',
  apiUrl: 'https://api.testnet.hiro.so',
  stacksNetwork: 'testnet',
};

describe('estimateTransferFee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns fixed fee when configured', async () => {
    const feeConfig: ResolvedConfig['fee'] = {
      multiplier: 1.0,
      maxFee: 500_000,
      fixed: 10_000,
    };

    const result = await estimateTransferFee(mockNetwork, feeConfig);
    expect(result.fee).toBe(10_000n);
    expect(result.source).toBe('fixed');
    expect(fetchTransferFeeRate).not.toHaveBeenCalled();
  });

  it('estimates and applies multiplier', async () => {
    vi.mocked(fetchTransferFeeRate).mockResolvedValue(1000n);

    const feeConfig: ResolvedConfig['fee'] = {
      multiplier: 1.5,
      maxFee: 500_000,
    };

    const result = await estimateTransferFee(mockNetwork, feeConfig);
    expect(result.fee).toBe(1500n); // 1000 * 1.5
    expect(result.source).toBe('estimated');
  });

  it('caps at maxFee', async () => {
    vi.mocked(fetchTransferFeeRate).mockResolvedValue(1_000_000n);

    const feeConfig: ResolvedConfig['fee'] = {
      multiplier: 1.0,
      maxFee: 500_000,
    };

    const result = await estimateTransferFee(mockNetwork, feeConfig);
    expect(result.fee).toBe(500_000n);
    expect(result.source).toBe('capped');
  });
});

describe('estimateContractCallFee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns fixed fee when configured', async () => {
    const feeConfig: ResolvedConfig['fee'] = {
      multiplier: 1.0,
      maxFee: 500_000,
      fixed: 25_000,
    };

    const result = await estimateContractCallFee(
      mockNetwork,
      feeConfig,
      new Uint8Array([1, 2, 3]),
      200
    );

    expect(result.fee).toBe(25_000n);
    expect(result.source).toBe('fixed');
  });

  it('uses middle tier estimation', async () => {
    vi.mocked(fetchTransactionFeeEstimate).mockResolvedValue({
      estimations: [
        { fee_rate: 100, fee: 5_000 },
        { fee_rate: 200, fee: 10_000 }, // middle tier — should use this
        { fee_rate: 500, fee: 25_000 },
      ],
    });

    const feeConfig: ResolvedConfig['fee'] = {
      multiplier: 1.0,
      maxFee: 500_000,
    };

    const result = await estimateContractCallFee(
      mockNetwork,
      feeConfig,
      new Uint8Array([1, 2, 3]),
      200
    );

    expect(result.fee).toBe(10_000n);
    expect(result.source).toBe('estimated');
  });

  it('caps overestimated fees', async () => {
    vi.mocked(fetchTransactionFeeEstimate).mockResolvedValue({
      estimations: [
        { fee_rate: 100, fee: 50_000_000 },
        { fee_rate: 200, fee: 100_000_000 }, // 100 STX — absurdly high
        { fee_rate: 500, fee: 250_000_000 },
      ],
    });

    const feeConfig: ResolvedConfig['fee'] = {
      multiplier: 1.0,
      maxFee: 500_000,
    };

    const result = await estimateContractCallFee(
      mockNetwork,
      feeConfig,
      new Uint8Array([1, 2, 3]),
      200
    );

    // Should be capped at maxFee, not the absurd estimate
    expect(result.fee).toBe(500_000n);
    expect(result.source).toBe('capped');
  });
});
