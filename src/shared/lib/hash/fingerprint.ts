/**
 * A file's fingerprint without reading all of it: SHA-256 over the first 2 MB followed by the file
 * size (8 bytes, big-endian). The same file — renamed or not — gives the same fingerprint; two files
 * that share a beginning but differ in length do not. `crypto.subtle` does the hashing (browsers
 * on https / localhost, node 20+).
 */

/** Bytes from the start of the file that go into the hash. */
export const FINGERPRINT_HEAD_BYTES = 2 * 1024 * 1024;

/** Hex digits of the digest kept by default (80 bits: no collision among a player's songs). */
export const FINGERPRINT_HEX = 20;

const HEX = '0123456789abcdef';

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += HEX[bytes[i] >> 4] + HEX[bytes[i] & 15];
  return out;
}

/** Lower-case hex SHA-256 of the bytes. */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

/** The hashed message: head ‖ size as a 64-bit big-endian integer. */
export function fingerprintMessage(head: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(head.length + 8);
  out.set(head, 0);
  const view = new DataView(out.buffer, head.length, 8);
  view.setUint32(0, Math.floor(size / 2 ** 32));
  view.setUint32(4, size >>> 0);
  return out;
}

/** `hexLength` hex digits of SHA-256(first 2 MB ‖ size). Reads only the head of the blob. */
export async function blobFingerprint(blob: Blob, hexLength: number = FINGERPRINT_HEX): Promise<string> {
  const head = new Uint8Array(await blob.slice(0, FINGERPRINT_HEAD_BYTES).arrayBuffer());
  const hex = await sha256Hex(fingerprintMessage(head, blob.size));
  return hex.slice(0, hexLength);
}
