import { describe, it, expect } from 'vitest';
import { resolveNetwork } from '../../src/network/network-config.js';

describe('resolveNetwork', () => {
  it('resolves mainnet', () => {
    const net = resolveNetwork('mainnet');
    expect(net.name).toBe('mainnet');
    expect(net.apiUrl).toBe('https://api.hiro.so');
    expect(net.stacksNetwork).toBe('mainnet');
  });

  it('resolves testnet', () => {
    const net = resolveNetwork('testnet');
    expect(net.name).toBe('testnet');
    expect(net.apiUrl).toBe('https://api.testnet.hiro.so');
    expect(net.stacksNetwork).toBe('testnet');
  });

  it('resolves devnet', () => {
    const net = resolveNetwork('devnet');
    expect(net.name).toBe('devnet');
    expect(net.apiUrl).toBe('http://localhost:3999');
    expect(net.stacksNetwork).toBe('devnet');
  });

  it('resolves custom URL', () => {
    const net = resolveNetwork({ url: 'https://my-node.example.com/' });
    expect(net.name).toBe('custom');
    expect(net.apiUrl).toBe('https://my-node.example.com'); // trailing slash stripped
    expect(net.stacksNetwork).toBe('mainnet');
  });

  it('throws on unknown network name', () => {
    expect(() => resolveNetwork('invalid' as any)).toThrow(
      'Unknown network "invalid"'
    );
  });
});
