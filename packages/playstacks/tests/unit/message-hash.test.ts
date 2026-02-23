import { describe, it, expect } from 'vitest';
import { hashMessage } from '../../src/wallet/message-hash.js';

describe('hashMessage', () => {
  it('returns a 64-char hex string (sha256)', () => {
    const hash = hashMessage('hello');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    const a = hashMessage('test message');
    const b = hashMessage('test message');
    expect(a).toBe(b);
  });

  it('produces different hashes for different messages', () => {
    const a = hashMessage('message A');
    const b = hashMessage('message B');
    expect(a).not.toBe(b);
  });

  it('handles empty string', () => {
    const hash = hashMessage('');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles unicode characters', () => {
    const hash = hashMessage('🚀 Stacks');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles long messages', () => {
    const longMsg = 'x'.repeat(10_000);
    const hash = hashMessage(longMsg);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
