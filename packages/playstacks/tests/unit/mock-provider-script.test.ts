import { describe, it, expect } from 'vitest';
import { getMockProviderScript } from '../../src/wallet/mock-provider-script.js';

describe('getMockProviderScript', () => {
  it('returns a non-empty string', () => {
    const script = getMockProviderScript('SP123ABC', '0xpubkey');
    expect(typeof script).toBe('string');
    expect(script.length).toBeGreaterThan(100);
  });

  it('embeds the wallet address', () => {
    const script = getMockProviderScript('SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR', '0xabc');
    expect(script).toContain('SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR');
  });

  it('embeds the public key', () => {
    const script = getMockProviderScript('SP123', 'deadbeef');
    expect(script).toContain('deadbeef');
  });

  it('installs StacksProvider and XverseProviders', () => {
    const script = getMockProviderScript('SP123', '0x00');
    expect(script).toContain('StacksProvider');
    expect(script).toContain('XverseProviders');
    expect(script).not.toContain('LeatherProvider');
    expect(script).not.toContain('HiroWalletProvider');
  });

  it('is a self-contained IIFE', () => {
    const script = getMockProviderScript('SP123', '0x00');
    expect(script.trim()).toMatch(/^\(function\(\)/);
    expect(script.trim()).toMatch(/\)\(\);$/);
  });
});
