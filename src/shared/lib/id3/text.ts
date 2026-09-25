/**
 * Text decoding for ID3 frames without relying on the platform's legacy encodings: windows-1251
 * and latin1 by table, UTF-16 by hand (node without full ICU knows neither cp1251 nor UTF-16BE),
 * UTF-8 through TextDecoder.
 */

/** windows-1251 code points for bytes 0x80–0xBF; 0xC0–0xFF map to А–я (U+0410–U+044F). */
const CP1251_HIGH = [
  0x0402, 0x0403, 0x201a, 0x0453, 0x201e, 0x2026, 0x2020, 0x2021, 0x20ac, 0x2030, 0x0409, 0x2039, 0x040a, 0x040c, 0x040b, 0x040f, 0x0452, 0x2018, 0x2019,
  0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0xfffd, 0x2122, 0x0459, 0x203a, 0x045a, 0x045c, 0x045b, 0x045f, 0x00a0, 0x040e, 0x045e, 0x0408, 0x00a4, 0x0490,
  0x00a6, 0x00a7, 0x0401, 0x00a9, 0x0404, 0x00ab, 0x00ac, 0x00ad, 0x00ae, 0x0407, 0x00b0, 0x00b1, 0x0406, 0x0456, 0x0491, 0x00b5, 0x00b6, 0x00b7, 0x0451,
  0x2116, 0x0454, 0x00bb, 0x0458, 0x0405, 0x0455, 0x0457,
];

function fromCodes(codes: ArrayLike<number>): string {
  let out = '';
  for (let i = 0; i < codes.length; i += 4096) out += String.fromCharCode(...Array.prototype.slice.call(codes, i, i + 4096));
  return out;
}

export function decodeCp1251(bytes: Uint8Array): string {
  const codes = new Array<number>(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    codes[i] = b < 0x80 ? b : b >= 0xc0 ? 0x0410 + (b - 0xc0) : CP1251_HIGH[b - 0x80];
  }
  return fromCodes(codes);
}

export function decodeLatin1(bytes: Uint8Array): string {
  return fromCodes(bytes);
}

/**
 * Encoding 0 is ISO-8859-1 by the standard, but Russian taggers wrote windows-1251 there for
 * decades. Cyrillic words are all high bytes; Latin names carry an accent or two among plain
 * letters — so the text is read as windows-1251 when its high letters are at least as many as its
 * ASCII letters («Кино», «Кино feat. Цой»), and as latin1 otherwise («Mötley Crüe», «Beyoncé»).
 */
export function looksCp1251(bytes: Uint8Array): boolean {
  let high = 0;
  let ascii = 0;
  for (const b of bytes) {
    if (b >= 0xc0 || b === 0xa8 || b === 0xb8) high++;
    else if ((b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a)) ascii++;
  }
  return high > 0 && high >= ascii;
}

/** UTF-16 code units, little- or big-endian; an odd trailing byte is dropped. */
export function decodeUtf16(bytes: Uint8Array, littleEndian: boolean): string {
  const n = bytes.length >> 1;
  const codes = new Array<number>(n);
  for (let i = 0; i < n; i++) codes[i] = littleEndian ? bytes[2 * i] | (bytes[2 * i + 1] << 8) : (bytes[2 * i] << 8) | bytes[2 * i + 1];
  return fromCodes(codes);
}

export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}
