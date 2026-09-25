import { decodeCp1251, decodeLatin1, decodeUtf16, decodeUtf8, looksCp1251 } from './text';

/**
 * A minimal ID3v2 reader: the song title (TIT2 / TT2) and the artist (TPE1 / TP1) of an MP3, no
 * other frames. Handles v2.2, v2.3 and v2.4 headers, the extended header, unsynchronisation (whole
 * tag in v2.3, per frame in v2.4) and the data-length indicator; compressed or encrypted frames are
 * skipped. A missing, foreign or cut-off tag gives what could be read — never an exception.
 */

export interface Id3Tags {
  title?: string;
  artist?: string;
}

/** Tags bigger than this are read only this far (a tag with cover art can be megabytes). */
export const ID3_MAX_READ = 4 * 1024 * 1024;

const HEADER = 10;

/** 4 bytes × 7 bits (header size, v2.4 frame sizes). */
function syncsafe(b: Uint8Array, at: number): number {
  return ((b[at] & 0x7f) << 21) | ((b[at + 1] & 0x7f) << 14) | ((b[at + 2] & 0x7f) << 7) | (b[at + 3] & 0x7f);
}

function uint32(b: Uint8Array, at: number): number {
  return ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
}

/** Undo unsynchronisation: every 0xFF 0x00 pair loses its 0x00. */
export function deunsync(b: Uint8Array): Uint8Array {
  const out = new Uint8Array(b.length);
  let n = 0;
  for (let i = 0; i < b.length; i++) {
    out[n++] = b[i];
    if (b[i] === 0xff && b[i + 1] === 0x00) i++;
  }
  return out.subarray(0, n);
}

/** Bytes up to the first terminator (0x00, or 0x00 0x00 on a code-unit boundary for UTF-16). */
function firstString(b: Uint8Array, wide: boolean): Uint8Array {
  if (!wide) {
    const end = b.indexOf(0);
    return end < 0 ? b : b.subarray(0, end);
  }
  for (let i = 0; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return b.subarray(0, i);
  return b;
}

/** A text frame's value: the encoding byte, then the (first) string. */
export function decodeTextFrame(data: Uint8Array): string {
  if (data.length === 0) return '';
  const enc = data[0];
  const body = data.subarray(1);
  let text: string;
  if (enc === 1 || enc === 2) {
    let s = firstString(body, true);
    // Encoding 1 starts with a byte-order mark; 2 is big-endian without one (a stray BOM is honoured too).
    let little = false;
    if (s.length >= 2 && s[0] === 0xff && s[1] === 0xfe) {
      little = true;
      s = s.subarray(2);
    } else if (s.length >= 2 && s[0] === 0xfe && s[1] === 0xff) {
      s = s.subarray(2);
    }
    text = decodeUtf16(s, little);
  } else if (enc === 3) {
    text = decodeUtf8(firstString(body, false));
  } else {
    const s = firstString(body, false);
    text = looksCp1251(s) ? decodeCp1251(s) : decodeLatin1(s);
  }
  return stripControls(text).trim();
}

/** Drop control characters and the BOM that some taggers repeat inside the text. */
function stripControls(text: string): string {
  let out = '';
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c >= 0x20 && c !== 0x7f && c !== 0xfeff) out += ch;
  }
  return out;
}

/** Size of the whole tag from its 10-byte header (header and footer included), 0 when there is no tag. */
export function id3TagSize(head: Uint8Array): number {
  if (head.length < HEADER || head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return 0; // "ID3"
  const major = head[3];
  if (major < 2 || major > 4 || head[4] === 0xff) return 0;
  const footer = major === 4 && (head[5] & 0x10) !== 0 ? HEADER : 0;
  return HEADER + syncsafe(head, 6) + footer;
}

const WANTED: Record<string, keyof Id3Tags> = { TIT2: 'title', TPE1: 'artist', TT2: 'title', TP1: 'artist' };

/** Read the title and the artist from the bytes at the start of a file (as many as are available). */
export function readId3(bytes: Uint8Array): Id3Tags {
  const tags: Id3Tags = {};
  if (id3TagSize(bytes) === 0) return tags;
  const major = bytes[3];
  const flags = bytes[5];
  const size = syncsafe(bytes, 6);
  let tag = bytes.subarray(HEADER, Math.min(bytes.length, HEADER + size));
  if (major < 4 && flags & 0x80) tag = deunsync(tag);

  let pos = 0;
  if (major >= 3 && flags & 0x40 && tag.length >= 4) {
    // Extended header: its size excludes itself in v2.3, includes itself (syncsafe) in v2.4.
    pos = major === 3 ? 4 + uint32(tag, 0) : syncsafe(tag, 0);
  }

  const idLen = major === 2 ? 3 : 4;
  const headLen = major === 2 ? 6 : 10;
  while (pos + headLen <= tag.length) {
    if (tag[pos] === 0) break; // padding
    const id = String.fromCharCode(...tag.subarray(pos, pos + idLen));
    if (!/^[A-Z0-9]+$/.test(id)) break;
    const frameSize = major === 2 ? (tag[pos + 3] << 16) | (tag[pos + 4] << 8) | tag[pos + 5] : major === 4 ? syncsafe(tag, pos + 4) : uint32(tag, pos + 4);
    const formatFlags = major === 2 ? 0 : tag[pos + 9];
    const start = pos + headLen;
    const end = start + frameSize;
    // An empty or cut-off frame ends the walk: what follows cannot be trusted.
    if (frameSize <= 0 || end > tag.length) break;
    const key = WANTED[id];
    if (key && tags[key] === undefined) {
      let data = tag.subarray(start, end);
      // v2.3 compression 0x80 / encryption 0x40; v2.4 compression 0x08 / encryption 0x04.
      const packed = major === 3 ? formatFlags & 0xc0 : major === 4 ? formatFlags & 0x0c : 0;
      if (!packed) {
        if (major === 4 && formatFlags & 0x01) data = data.subarray(4); // data-length indicator
        if (major === 4 && (formatFlags & 0x02 || flags & 0x80)) data = deunsync(data);
        const text = decodeTextFrame(data);
        if (text) tags[key] = text;
      }
    }
    if (tags.title !== undefined && tags.artist !== undefined) break;
    pos = end;
  }
  return tags;
}

/** Read the tags of a file: the header first, then only as much of the tag as needed (capped). */
export async function readTags(blob: Blob): Promise<Id3Tags> {
  try {
    const head = new Uint8Array(await blob.slice(0, HEADER).arrayBuffer());
    const size = id3TagSize(head);
    if (size === 0) return {};
    const bytes = new Uint8Array(await blob.slice(0, Math.min(size, ID3_MAX_READ)).arrayBuffer());
    return readId3(bytes);
  } catch {
    return {};
  }
}
