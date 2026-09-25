import { describe, expect, it } from 'vitest';
import { readId3, readTags, id3TagSize, decodeTextFrame } from './id3';
import { decodeCp1251, looksCp1251 } from './text';

// --- byte fixtures -------------------------------------------------------------------------

const syncsafe4 = (n: number) => [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
const be4 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const latin1 = (s: string) => Array.from(s, (c) => c.charCodeAt(0) & 255);
const utf8 = (s: string) => Array.from(new TextEncoder().encode(s));
const utf16 = (s: string, little: boolean) => {
  const out: number[] = little ? [0xff, 0xfe] : [0xfe, 0xff];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out.push(...(little ? [c & 255, c >> 8] : [c >> 8, c & 255]));
  }
  return out;
};
/** windows-1251 for Russian letters and ASCII (enough for the fixtures). */
const cp1251 = (s: string) =>
  Array.from(s, (ch) => {
    const c = ch.charCodeAt(0);
    if (c < 0x80) return c;
    if (c === 0x401) return 0xa8;
    if (c === 0x451) return 0xb8;
    if (c >= 0x410 && c <= 0x44f) return 0xc0 + (c - 0x410);
    throw new Error(`no cp1251 byte for ${ch}`);
  });

function frame(major: 2 | 3 | 4, id: string, data: number[], formatFlags = 0): number[] {
  if (major === 2) return [...ascii(id), (data.length >> 16) & 255, (data.length >> 8) & 255, data.length & 255, ...data];
  return [...ascii(id), ...(major === 4 ? syncsafe4(data.length) : be4(data.length)), 0, formatFlags, ...data];
}

function tag(major: 2 | 3 | 4, frames: number[][], opts: { flags?: number; padding?: number; ext?: number[] } = {}): Uint8Array {
  const body = [...(opts.ext ?? []), ...frames.flat(), ...new Array<number>(opts.padding ?? 0).fill(0)];
  return new Uint8Array([0x49, 0x44, 0x33, major, 0, opts.flags ?? 0, ...syncsafe4(body.length), ...body]);
}

/** Apply unsynchronisation: a 0x00 after every 0xFF. */
const unsync = (bytes: number[]) => bytes.flatMap((b) => (b === 0xff ? [0xff, 0x00] : [b]));

// --- tests ---------------------------------------------------------------------------------

describe('readId3', () => {
  it('reads a v2.3 tag in latin1', () => {
    const t = tag(3, [frame(3, 'TIT2', [0, ...latin1('Café Racer')]), frame(3, 'TPE1', [0, ...latin1('Mötley Crüe')])], { padding: 64 });
    expect(readId3(t)).toEqual({ title: 'Café Racer', artist: 'Mötley Crüe' });
  });

  it('reads encoding 0 with Cyrillic bytes as windows-1251', () => {
    const t = tag(3, [frame(3, 'TPE1', [0, ...cp1251('Кино')]), frame(3, 'TIT2', [0, ...cp1251('Группа крови. Ёлка'), 0])]);
    expect(readId3(t)).toEqual({ title: 'Группа крови. Ёлка', artist: 'Кино' });
  });

  it('reads a v2.4 tag in UTF-8', () => {
    const t = tag(4, [frame(4, 'TIT2', [3, ...utf8('Звезда по имени Солнце')]), frame(4, 'TPE1', [3, ...utf8('Кино'), 0])]);
    expect(readId3(t)).toEqual({ title: 'Звезда по имени Солнце', artist: 'Кино' });
  });

  it('reads UTF-16 with either byte-order mark, and v2.4 UTF-16BE without one', () => {
    const le = tag(3, [frame(3, 'TIT2', [1, ...utf16('Кукушка', true), 0, 0]), frame(3, 'TPE1', [1, ...utf16('Виктор Цой', false)])]);
    expect(readId3(le)).toEqual({ title: 'Кукушка', artist: 'Виктор Цой' });
    const be = tag(4, [frame(4, 'TIT2', [2, ...utf16('Hello', false).slice(2)])]);
    expect(readId3(be)).toEqual({ title: 'Hello' });
  });

  it('reads a v2.2 tag (three-letter frames)', () => {
    const t = tag(2, [frame(2, 'TT2', [0, ...ascii('Old Song')]), frame(2, 'TP1', [0, ...ascii('Band')])]);
    expect(readId3(t)).toEqual({ title: 'Old Song', artist: 'Band' });
  });

  it('skips other frames, the extended header and undoes unsynchronisation', () => {
    const ext = [...be4(6), 0, 0, 0, 0, 0, 0]; // v2.3: the size excludes its own 4 bytes
    const apic = frame(3, 'APIC', new Array<number>(300).fill(0xff));
    const t = tag(3, [unsync(apic), unsync(frame(3, 'TIT2', [0, ...latin1('ÿes sir')]))], { flags: 0x80 | 0x40, ext });
    expect(readId3(t)).toEqual({ title: 'ÿes sir' });
  });

  it('handles the v2.4 data-length indicator and per-frame unsynchronisation', () => {
    const text = [3, ...utf8('Трек')];
    const data = [...syncsafe4(text.length), ...unsync(text)];
    const t = tag(4, [frame(4, 'TIT2', data, 0x02 | 0x01)]);
    expect(readId3(t)).toEqual({ title: 'Трек' });
  });

  it('skips compressed frames', () => {
    const t = tag(3, [frame(3, 'TIT2', [0, 1, 2, 3], 0x80), frame(3, 'TPE1', [0, ...ascii('Band')])]);
    expect(readId3(t)).toEqual({ artist: 'Band' });
  });

  it('returns nothing without a tag', () => {
    expect(readId3(new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0, 0, 0, 0, 0, 0, 0, 0]))).toEqual({});
    expect(readId3(new Uint8Array(ascii('RIFF....WAVEfmt ')))).toEqual({});
    expect(readId3(new Uint8Array(0))).toEqual({});
  });

  it('survives a cut-off tag: keeps the frames that fit, never throws', () => {
    const full = tag(3, [frame(3, 'TIT2', [0, ...ascii('Complete')]), frame(3, 'TPE1', [0, ...ascii('Somebody Long Name')])]);
    expect(readId3(full.subarray(0, full.length - 5))).toEqual({ title: 'Complete' });
    expect(readId3(full.subarray(0, 15))).toEqual({});
    expect(readId3(full.subarray(0, 4))).toEqual({});
  });

  it('ignores blank values and trims', () => {
    const t = tag(3, [frame(3, 'TIT2', [0, ...ascii('   ')]), frame(3, 'TPE1', [0, ...ascii('  Band \t')])]);
    expect(readId3(t)).toEqual({ artist: 'Band' });
  });
});

describe('id3 helpers', () => {
  it('measures the tag from its header', () => {
    const t = tag(3, [frame(3, 'TIT2', [0, 65])], { padding: 10 });
    expect(id3TagSize(t)).toBe(t.length);
    expect(id3TagSize(new Uint8Array(ascii('ID4abcdefgh')))).toBe(0);
  });

  it('decodes a text frame with no encoding byte gracefully', () => {
    expect(decodeTextFrame(new Uint8Array(0))).toBe('');
  });

  it('tells windows-1251 from latin1', () => {
    expect(looksCp1251(new Uint8Array(cp1251('Кино feat. Цой')))).toBe(true);
    expect(looksCp1251(new Uint8Array(latin1('Beyoncé')))).toBe(false);
    expect(looksCp1251(new Uint8Array(ascii('Plain')))).toBe(false);
    expect(decodeCp1251(new Uint8Array([0xa8, 0xb8, 0xb9, 0xc0, 0xff]))).toBe('Ёё№Ая');
  });

  it('reads only the tag from a file blob', async () => {
    const t = tag(4, [frame(4, 'TIT2', [3, ...utf8('Песня')])], { padding: 32 });
    const file = new Blob([t, new Uint8Array(4096).fill(0x55)]);
    expect(await readTags(file)).toEqual({ title: 'Песня' });
    expect(await readTags(new Blob([new Uint8Array(100)]))).toEqual({});
  });
});
