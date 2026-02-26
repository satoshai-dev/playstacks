import { describe, it, expect } from 'vitest';
import {
  PlaystacksError,
  NetworkError,
  FeeEstimationError,
  BroadcastError,
  ConfirmationError,
  UserRejectionError,
  ConfigurationError,
} from '../../src/errors.js';

describe('custom error types', () => {
  it('PlaystacksError is instanceof Error', () => {
    const err = new PlaystacksError('base error');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PlaystacksError);
    expect(err.name).toBe('PlaystacksError');
    expect(err.message).toBe('base error');
  });

  it('NetworkError includes status, url, and body', () => {
    const err = new NetworkError('API error 500', 500, 'https://api.hiro.so/v2/info', 'Internal Server Error');
    expect(err).toBeInstanceOf(PlaystacksError);
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.name).toBe('NetworkError');
    expect(err.statusCode).toBe(500);
    expect(err.url).toBe('https://api.hiro.so/v2/info');
    expect(err.responseBody).toBe('Internal Server Error');
  });

  it('FeeEstimationError includes status and body', () => {
    const err = new FeeEstimationError('Fee estimation failed 400', 400, 'bad request');
    expect(err).toBeInstanceOf(PlaystacksError);
    expect(err.name).toBe('FeeEstimationError');
    expect(err.statusCode).toBe(400);
    expect(err.responseBody).toBe('bad request');
  });

  it('BroadcastError includes reason', () => {
    const err = new BroadcastError('Transaction broadcast failed', '{"error":"ConflictingNonceInMempool"}');
    expect(err).toBeInstanceOf(PlaystacksError);
    expect(err.name).toBe('BroadcastError');
    expect(err.reason).toBe('{"error":"ConflictingNonceInMempool"}');
  });

  it('ConfirmationError includes txid and timeout', () => {
    const err = new ConfirmationError('did not confirm', '0xabc', 120_000);
    expect(err).toBeInstanceOf(PlaystacksError);
    expect(err.name).toBe('ConfirmationError');
    expect(err.txid).toBe('0xabc');
    expect(err.timeoutMs).toBe(120_000);
  });

  it('UserRejectionError has defaults', () => {
    const err = new UserRejectionError();
    expect(err).toBeInstanceOf(PlaystacksError);
    expect(err.name).toBe('UserRejectionError');
    expect(err.message).toBe('User rejected the request');
    expect(err.code).toBe(4001);
  });

  it('ConfigurationError for invalid config', () => {
    const err = new ConfigurationError('Unknown network "foo"');
    expect(err).toBeInstanceOf(PlaystacksError);
    expect(err.name).toBe('ConfigurationError');
    expect(err.message).toBe('Unknown network "foo"');
  });

  it('errors can be caught by base class', () => {
    const errors = [
      new NetworkError('net', 500, '/'),
      new FeeEstimationError('fee'),
      new BroadcastError('broadcast'),
      new ConfirmationError('confirm', '0x1', 1000),
      new UserRejectionError(),
      new ConfigurationError('config'),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(PlaystacksError);
      expect(err).toBeInstanceOf(Error);
    }
  });
});
