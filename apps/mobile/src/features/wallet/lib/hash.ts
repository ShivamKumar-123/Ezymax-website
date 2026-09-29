// SHA-256 and Keccak-256 for address checksums only (TRON base58check, EIP-55 on BNB Chain). Nothing here signs,
// derives keys or protects secrets: it only catches a mistyped destination address before the wallet service
// (which validates again) sees it. Verified against the standard test vectors in scripts/wallet-lib.test.mts.

const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** SHA-256 of `data`. */
export function sha256(data: Uint8Array): Uint8Array {
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const len = data.length;
  const total = Math.ceil((len + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(data);
  buf[len] = 0x80;
  const view = new DataView(buf.buffer);
  const bits = len * 8;
  view.setUint32(total - 8, Math.floor(bits / 0x100000000));
  view.setUint32(total - 4, bits >>> 0);
  const w = new Array<number>(64).fill(0);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15]!;
      const b = w[i - 2]!;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h as [number, number, number, number, number, number, number, number];
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K256[i]! + w[i]!) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] = (h[0]! + a) | 0;
    h[1] = (h[1]! + b) | 0;
    h[2] = (h[2]! + c) | 0;
    h[3] = (h[3]! + d) | 0;
    h[4] = (h[4]! + e) | 0;
    h[5] = (h[5]! + f) | 0;
    h[6] = (h[6]! + g) | 0;
    h[7] = (h[7]! + hh) | 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  h.forEach((v, i) => ov.setUint32(i * 4, v >>> 0));
  return out;
}

/* Keccak-256 (the original Keccak padding used by Ethereum, not NIST SHA3-256). 64-bit lanes as (low, high) 32-bit
   pairs in a Uint32Array: no BigInt, so it stays fast on Hermes (it runs on every keystroke of an address). */

const RC_HEX = [
  "0000000000000001", "0000000000008082", "800000000000808a", "8000000080008000", "000000000000808b", "0000000080000001", "8000000080008081", "8000000000008009",
  "000000000000008a", "0000000000000088", "0000000080008009", "000000008000000a", "000000008000808b", "800000000000008b", "8000000000008089", "8000000000008003",
  "8000000000008002", "8000000000000080", "000000000000800a", "800000008000000a", "8000000080008081", "8000000000008080", "0000000080000001", "8000000080008008",
];
/** Round constants as [low, high, low, high, …]. */
const RC = Uint32Array.from(RC_HEX.flatMap((h) => [parseInt(h.slice(8), 16), parseInt(h.slice(0, 8), 16)]));
/** Rotation offsets r[x][y], indexed x + 5y. */
const ROT = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];

function keccakF(s: Uint32Array) {
  const c = new Uint32Array(10);
  const b = new Uint32Array(50);
  for (let round = 0; round < 24; round++) {
    // theta
    for (let x = 0; x < 5; x++) {
      c[2 * x] = s[2 * x]! ^ s[2 * x + 10]! ^ s[2 * x + 20]! ^ s[2 * x + 30]! ^ s[2 * x + 40]!;
      c[2 * x + 1] = s[2 * x + 1]! ^ s[2 * x + 11]! ^ s[2 * x + 21]! ^ s[2 * x + 31]! ^ s[2 * x + 41]!;
    }
    for (let x = 0; x < 5; x++) {
      const n1 = 2 * ((x + 1) % 5);
      const n4 = 2 * ((x + 4) % 5);
      const lo1 = c[n1]!;
      const hi1 = c[n1 + 1]!;
      const dLo = c[n4]! ^ ((lo1 << 1) | (hi1 >>> 31));
      const dHi = c[n4 + 1]! ^ ((hi1 << 1) | (lo1 >>> 31));
      for (let y = 0; y < 25; y += 5) {
        const i = 2 * (x + y);
        s[i] = s[i]! ^ dLo;
        s[i + 1] = s[i + 1]! ^ dHi;
      }
    }
    // rho + pi
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const i = x + 5 * y;
        const j = 2 * (y + 5 * ((2 * x + 3 * y) % 5));
        const lo = s[2 * i]!;
        const hi = s[2 * i + 1]!;
        const n = ROT[i]!;
        if (n === 0) {
          b[j] = lo;
          b[j + 1] = hi;
        } else if (n < 32) {
          b[j] = (lo << n) | (hi >>> (32 - n));
          b[j + 1] = (hi << n) | (lo >>> (32 - n));
        } else if (n === 32) {
          b[j] = hi;
          b[j + 1] = lo;
        } else {
          const m = n - 32;
          b[j] = (hi << m) | (lo >>> (32 - m));
          b[j + 1] = (lo << m) | (hi >>> (32 - m));
        }
      }
    }
    // chi
    for (let y = 0; y < 25; y += 5) {
      for (let x = 0; x < 5; x++) {
        const i = 2 * (x + y);
        const i1 = 2 * (((x + 1) % 5) + y);
        const i2 = 2 * (((x + 2) % 5) + y);
        s[i] = b[i]! ^ (~b[i1]! & b[i2]!);
        s[i + 1] = b[i + 1]! ^ (~b[i1 + 1]! & b[i2 + 1]!);
      }
    }
    // iota
    s[0] = s[0]! ^ RC[2 * round]!;
    s[1] = s[1]! ^ RC[2 * round + 1]!;
  }
}

/** Keccak-256 of `data` (Ethereum's hash: domain padding 0x01). */
export const keccak256 = (data: Uint8Array) => sponge256(data, 0x01);
/** NIST SHA3-256 (domain padding 0x06): the same sponge, used by the tests to check it against node:crypto. */
export const sha3_256 = (data: Uint8Array) => sponge256(data, 0x06);

function sponge256(data: Uint8Array, pad: number): Uint8Array {
  const rate = 136;
  const msg = new Uint8Array(data.length + (rate - (data.length % rate)));
  msg.set(data);
  msg[data.length] = pad;
  msg[msg.length - 1] = msg[msg.length - 1]! | 0x80;
  const state = new Uint32Array(50);
  const word = (o: number) => (msg[o]! | (msg[o + 1]! << 8) | (msg[o + 2]! << 16) | (msg[o + 3]! << 24)) >>> 0;
  for (let off = 0; off < msg.length; off += rate) {
    for (let i = 0; i < rate / 4; i++) state[i] = state[i]! ^ word(off + i * 4);
    keccakF(state);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    const w = state[i]!;
    out[i * 4] = w & 0xff;
    out[i * 4 + 1] = (w >>> 8) & 0xff;
    out[i * 4 + 2] = (w >>> 16) & 0xff;
    out[i * 4 + 3] = (w >>> 24) & 0xff;
  }
  return out;
}

/** Bytes of an ASCII string (addresses and hex only; no TextEncoder needed). */
export const ascii = (s: string) => Uint8Array.from(s, (ch) => ch.charCodeAt(0) & 0xff);
export const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
