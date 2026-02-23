import { createHash } from 'node:crypto';

const STACKS_MESSAGE_PREFIX = '\x17Stacks Signed Message:\n';

/**
 * Encode an integer as a Bitcoin-style varint (CompactSize).
 */
function encodeVarint(n: number): Uint8Array {
  if (n < 0xfd) return new Uint8Array([n]);
  if (n <= 0xffff) {
    const buf = new Uint8Array(3);
    buf[0] = 0xfd;
    buf[1] = n & 0xff;
    buf[2] = (n >> 8) & 0xff;
    return buf;
  }
  const buf = new Uint8Array(5);
  buf[0] = 0xfe;
  buf[1] = n & 0xff;
  buf[2] = (n >> 8) & 0xff;
  buf[3] = (n >> 16) & 0xff;
  buf[4] = (n >> 24) & 0xff;
  return buf;
}

/**
 * Hash a plaintext message the same way Stacks wallets do:
 * `sha256(prefix + varint(len) + messageBytes)`
 */
export function hashMessage(message: string): string {
  const encoder = new TextEncoder();
  const prefixBytes = encoder.encode(STACKS_MESSAGE_PREFIX);
  const messageBytes = encoder.encode(message);
  const lengthVarint = encodeVarint(messageBytes.length);

  const payload = new Uint8Array(
    prefixBytes.length + lengthVarint.length + messageBytes.length
  );
  payload.set(prefixBytes, 0);
  payload.set(lengthVarint, prefixBytes.length);
  payload.set(messageBytes, prefixBytes.length + lengthVarint.length);

  return createHash('sha256').update(payload).digest('hex');
}
