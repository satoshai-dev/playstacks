import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NonceTracker } from '../../src/wallet/nonce-tracker.js';
import type { ResolvedNetwork } from '../../src/network/network-config.js';

vi.mock('../../src/network/api-client.js', () => ({
  fetchNonce: vi.fn(),
}));

import { fetchNonce } from '../../src/network/api-client.js';

const mockFetchNonce = vi.mocked(fetchNonce);

const MOCK_NETWORK: ResolvedNetwork = {
  stacksNetwork: 'testnet',
  apiUrl: 'https://api.testnet.hiro.so',
};

describe('NonceTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches nonce from chain on first call', async () => {
    mockFetchNonce.mockResolvedValueOnce(5n);
    const tracker = new NonceTracker(MOCK_NETWORK, 'ST123');

    const nonce = await tracker.getNextNonce();

    expect(nonce).toBe(5n);
    expect(mockFetchNonce).toHaveBeenCalledWith(MOCK_NETWORK, 'ST123');
  });

  it('returns same nonce on repeated calls without increment', async () => {
    mockFetchNonce.mockResolvedValueOnce(5n);
    const tracker = new NonceTracker(MOCK_NETWORK, 'ST123');

    const first = await tracker.getNextNonce();
    const second = await tracker.getNextNonce();

    expect(first).toBe(5n);
    expect(second).toBe(5n);
    expect(mockFetchNonce).toHaveBeenCalledTimes(1);
  });

  it('increments nonce after broadcast', async () => {
    mockFetchNonce.mockResolvedValueOnce(5n);
    const tracker = new NonceTracker(MOCK_NETWORK, 'ST123');

    const first = await tracker.getNextNonce();
    tracker.increment();
    const second = await tracker.getNextNonce();

    expect(first).toBe(5n);
    expect(second).toBe(6n);
    expect(mockFetchNonce).toHaveBeenCalledTimes(1);
  });

  it('tracks multiple sequential increments', async () => {
    mockFetchNonce.mockResolvedValueOnce(10n);
    const tracker = new NonceTracker(MOCK_NETWORK, 'ST123');

    const n0 = await tracker.getNextNonce();
    tracker.increment();
    const n1 = await tracker.getNextNonce();
    tracker.increment();
    const n2 = await tracker.getNextNonce();

    expect(n0).toBe(10n);
    expect(n1).toBe(11n);
    expect(n2).toBe(12n);
    expect(mockFetchNonce).toHaveBeenCalledTimes(1);
  });

  it('refetches from chain after reset', async () => {
    mockFetchNonce.mockResolvedValueOnce(5n);
    const tracker = new NonceTracker(MOCK_NETWORK, 'ST123');

    await tracker.getNextNonce();
    tracker.increment();
    tracker.reset();

    mockFetchNonce.mockResolvedValueOnce(6n);
    const nonce = await tracker.getNextNonce();

    expect(nonce).toBe(6n);
    expect(mockFetchNonce).toHaveBeenCalledTimes(2);
  });

  it('increment is a no-op before first fetch', () => {
    const tracker = new NonceTracker(MOCK_NETWORK, 'ST123');
    // Should not throw
    tracker.increment();
  });
});
