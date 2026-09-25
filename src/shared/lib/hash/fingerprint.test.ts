import { describe, expect, it } from 'vitest';
import { FINGERPRINT_HEAD_BYTES, blobFingerprint, fingerprintMessage, sha256Hex } from './fingerprint';

const bytes = (n: number, seed = 1) => {
  const out = new Uint8Array(n);
  let x = seed;
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    out[i] = x >>> 24;
  }
  return out;
};

describe('fingerprint', () => {
  it('hashes with SHA-256', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('is deterministic and 20 hex digits long', async () => {
    const data = bytes(5000);
    const a = await blobFingerprint(new Blob([data]));
    const b = await blobFingerprint(new Blob([data.slice()]));
    expect(a).toMatch(/^[0-9a-f]{20}$/);
    expect(a).toBe(b);
  });

  it('depends on the content of the head', async () => {
    const data = bytes(5000);
    const other = data.slice();
    other[100] ^= 1;
    expect(await blobFingerprint(new Blob([data]))).not.toBe(await blobFingerprint(new Blob([other])));
  });

  it('depends on the size: the same first 2 MB with a different tail length differ', async () => {
    const head = bytes(FINGERPRINT_HEAD_BYTES);
    const a = await blobFingerprint(new Blob([head, new Uint8Array(10)]));
    const b = await blobFingerprint(new Blob([head, new Uint8Array(11)]));
    expect(a).not.toBe(b);
  });

  it('ignores bytes past the head when the size is the same', async () => {
    const head = bytes(FINGERPRINT_HEAD_BYTES);
    const a = await blobFingerprint(new Blob([head, new Uint8Array([1, 2, 3])]));
    const b = await blobFingerprint(new Blob([head, new Uint8Array([9, 9, 9])]));
    expect(a).toBe(b);
  });

  it('appends the size as 8 big-endian bytes', () => {
    const msg = fingerprintMessage(new Uint8Array([7]), 2 ** 32 + 258);
    expect(Array.from(msg)).toEqual([7, 0, 0, 0, 1, 0, 0, 1, 2]);
  });
});
