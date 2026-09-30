// QR codes for referral and campaign links: the module matrix (qrcode-generator), one SVG path for the screen, and a
// crisp 1-bit PNG for the share sheet (flyers, chats). The PNG is encoded here with stored (uncompressed) deflate
// blocks, so it needs no native module and works the same on iOS, Android and the web preview.

import qrcode from "qrcode-generator";

/** Modules of quiet zone around the code (the standard asks for 4). */
export const QUIET = 4;

type Matrix = { n: number; dark: (r: number, c: number) => boolean };

function matrix(value: string): Matrix | null {
  try {
    // level Q: survives a smudged print or a cracked screen protector better than M
    const qr = qrcode(0, "Q");
    qr.addData(value, "Byte");
    qr.make();
    const n = qr.getModuleCount();
    return { n, dark: (r, c) => qr.isDark(r, c) };
  } catch {
    return null;
  }
}

/** One path of all dark modules (horizontal runs merged), in module units including the quiet zone. */
export function qrPath(value: string): { d: string; size: number } | null {
  const m = matrix(value);
  if (!m) return null;
  let d = "";
  for (let r = 0; r < m.n; r++) {
    let c = 0;
    while (c < m.n) {
      if (!m.dark(r, c)) {
        c++;
        continue;
      }
      let end = c;
      while (end < m.n && m.dark(r, end)) end++;
      d += `M${c + QUIET} ${r + QUIET}h${end - c}v1h-${end - c}z`;
      c = end;
    }
  }
  return { d, size: m.n + QUIET * 2 };
}

/* ------------------------------------------------------------------ */
/* PNG                                                                 */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]!) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** zlib stream of `raw` in stored deflate blocks (no compression; PNG readers accept it everywhere). */
function zlibStored(raw: Uint8Array): Uint8Array {
  const MAX = 65535;
  const blocks = Math.max(1, Math.ceil(raw.length / MAX));
  const out = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  let o = 0;
  out[o++] = 0x78;
  out[o++] = 0x01;
  for (let i = 0; i < blocks; i++) {
    const start = i * MAX;
    const len = Math.min(MAX, raw.length - start);
    out[o++] = i === blocks - 1 ? 1 : 0;
    out[o++] = len & 0xff;
    out[o++] = (len >>> 8) & 0xff;
    out[o++] = ~len & 0xff;
    out[o++] = (~len >>> 8) & 0xff;
    out.set(raw.subarray(start, start + len), o);
    o += len;
  }
  const ad = adler32(raw);
  out[o++] = (ad >>> 24) & 0xff;
  out[o++] = (ad >>> 16) & 0xff;
  out[o++] = (ad >>> 8) & 0xff;
  out[o++] = ad & 0xff;
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}

/**
 * The QR code as a black-on-white 1-bit PNG: every module is `scale` pixels (default 24, about 1,000 px for a
 * referral link), with the standard 4-module quiet zone.
 */
export function qrPng(value: string, scale = 24): Uint8Array | null {
  const m = matrix(value);
  if (!m) return null;
  const modules = m.n + QUIET * 2;
  const px = modules * scale;
  const rowBytes = Math.ceil(px / 8);
  const raw = new Uint8Array((rowBytes + 1) * px);
  for (let y = 0; y < px; y++) {
    const r = Math.floor(y / scale) - QUIET;
    const base = y * (rowBytes + 1);
    raw[base] = 0; // filter: none
    for (let x = 0; x < px; x++) {
      const c = Math.floor(x / scale) - QUIET;
      const dark = r >= 0 && c >= 0 && r < m.n && c < m.n && m.dark(r, c);
      // 1-bit grayscale: 1 = white
      if (!dark) {
        const i = base + 1 + (x >>> 3);
        raw[i] = (raw[i] ?? 0) | (0x80 >>> (x & 7));
      }
    }
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, px);
  dv.setUint32(4, px);
  ihdr[8] = 1; // bit depth
  ihdr[9] = 0; // grayscale
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlibStored(raw)), chunk("IEND", new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
