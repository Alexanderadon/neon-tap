import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { crc32, encodePng, PNG_SIGNATURE, pngChunk } from './png';

const be32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

interface Chunk {
  type: string;
  data: Uint8Array;
  crc: number;
}

function parseChunks(png: Uint8Array): Chunk[] {
  const out: Chunk[] = [];
  let off = 8;
  while (off < png.length) {
    const len = be32(png, off);
    const type = String.fromCharCode(...png.subarray(off + 4, off + 8));
    const data = png.subarray(off + 8, off + 8 + len);
    const crc = be32(png, off + 8 + len);
    out.push({ type, data, crc });
    off += 12 + len;
  }
  return out;
}

describe('crc32', () => {
  it('matches the reference values', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
    expect(crc32(Uint8Array.from('123456789', (c) => c.charCodeAt(0)))).toBe(0xcbf43926);
    // IEND chunk CRC from the PNG spec: type bytes only, no data.
    expect(crc32(Uint8Array.from('IEND', (c) => c.charCodeAt(0)))).toBe(0xae426082);
  });

  it('chains through the seed like one continuous stream', () => {
    const a = Uint8Array.from('1234', (c) => c.charCodeAt(0));
    const b = Uint8Array.from('56789', (c) => c.charCodeAt(0));
    expect(crc32(b, crc32(a))).toBe(0xcbf43926);
  });
});

describe('encodePng', () => {
  const W = 4;
  const H = 4;
  const rgba = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      rgba[i] = x * 60;
      rgba[i + 1] = y * 60;
      rgba[i + 2] = 200;
      rgba[i + 3] = x === y ? 255 : 128;
    }
  }
  const png = encodePng(W, H, rgba);

  it('starts with the PNG signature', () => {
    expect([...png.subarray(0, 8)]).toEqual([...PNG_SIGNATURE]);
  });

  it('has IHDR first with the right geometry, IEND last, valid CRCs', () => {
    const chunks = parseChunks(png);
    expect(chunks.map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
    const ihdr = chunks[0];
    expect(ihdr.data.length).toBe(13);
    expect(be32(ihdr.data, 0)).toBe(W);
    expect(be32(ihdr.data, 4)).toBe(H);
    expect([...ihdr.data.subarray(8)]).toEqual([8, 6, 0, 0, 0]); // 8-bit RGBA, no interlace
    expect(chunks[2].data.length).toBe(0);
    expect(chunks[2].crc).toBe(0xae426082);
    for (const c of chunks) {
      const typeBytes = Uint8Array.from(c.type, (ch) => ch.charCodeAt(0));
      expect(c.crc).toBe(crc32(c.data, crc32(typeBytes)));
    }
    // The file ends exactly after IEND.
    expect(png.length).toBe(8 + chunks.reduce((n, c) => n + 12 + c.data.length, 0));
  });

  it('IDAT inflates to filter-0 scanlines carrying the original pixels', () => {
    const idat = parseChunks(png)[1].data;
    const raw = new Uint8Array(inflateSync(idat));
    expect(raw.length).toBe((W * 4 + 1) * H);
    for (let y = 0; y < H; y++) {
      expect(raw[y * (W * 4 + 1)]).toBe(0);
      expect([...raw.subarray(y * (W * 4 + 1) + 1, (y + 1) * (W * 4 + 1))]).toEqual([...rgba.subarray(y * W * 4, (y + 1) * W * 4)]);
    }
  });

  it('rejects mismatched buffers and bad chunk types', () => {
    expect(() => encodePng(4, 4, new Uint8Array(10))).toThrow(/RGBA/);
    expect(() => encodePng(0, 4, new Uint8Array(0))).toThrow(/size/);
    expect(() => pngChunk('BAD', new Uint8Array(0))).toThrow(/4 chars/);
  });
});
