// Destination address checks for withdrawals, before anything is sent to the server (the wallet service validates
// again). BNB Chain: 0x + 40 hex, and the EIP-55 checksum when the address is mixed-case. TRON: base58check with
// the 0x41 prefix (same rule as services/wallet chain/mod.rs). Pasting the other network's address, or the USDT
// token contract itself, is caught with a specific message.
import { ascii, keccak256, sha256, toHex } from "./hash";

export type Chain = "bsc" | "tron";

export type AddressProblem = "empty" | "format" | "checksum" | "otherNetwork" | "contract";
export type AddressCheck = { ok: true; address: string } | { ok: false; problem: AddressProblem };

const BSC_RE = /^0x[0-9a-fA-F]{40}$/;
const TRON_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** EIP-55 checksummed form of a 0x address (any case in). */
export function toChecksumAddress(address: string): string {
  const lower = address.slice(2).toLowerCase();
  const hash = toHex(keccak256(ascii(lower)));
  let out = "0x";
  for (let i = 0; i < 40; i++) {
    const ch = lower[i]!;
    out += parseInt(hash[i]!, 16) >= 8 ? ch.toUpperCase() : ch;
  }
  return out;
}

/** An all-lower / all-upper hex address carries no checksum; a mixed-case one must match EIP-55 exactly. */
export function eip55Valid(address: string): boolean {
  if (!BSC_RE.test(address)) return false;
  const body = address.slice(2);
  if (body === body.toLowerCase() || body === body.toUpperCase()) return true;
  return toChecksumAddress(address) === address;
}

export function base58Decode(s: string): Uint8Array | null {
  const bytes: number[] = [];
  for (const ch of s) {
    let carry = B58.indexOf(ch);
    if (carry < 0) return null;
    for (let i = bytes.length - 1; i >= 0; i--) {
      carry += bytes[i]! * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.unshift(carry & 0xff);
      carry >>= 8;
    }
  }
  let zeros = 0;
  while (s[zeros] === "1") zeros++;
  return Uint8Array.from([...new Array<number>(zeros).fill(0), ...bytes]);
}

/** TRON base58check: 25 bytes = 0x41 + 20-byte account + first 4 bytes of sha256(sha256(first 21 bytes)). */
export function tronValid(address: string): boolean {
  if (!TRON_RE.test(address)) return false;
  const raw = base58Decode(address);
  if (!raw || raw.length !== 25 || raw[0] !== 0x41) return false;
  const payload = raw.slice(0, 21);
  const check = sha256(sha256(payload));
  for (let i = 0; i < 4; i++) if (check[i] !== raw[21 + i]) return false;
  return true;
}

/** Checks a pasted / typed destination for `chain`. `tokenContract`: the USDT contract of that chain (config). */
export function checkAddress(chain: Chain, raw: string, tokenContract?: string): AddressCheck {
  const a = raw.trim();
  if (!a) return { ok: false, problem: "empty" };
  if (chain === "bsc") {
    if (TRON_RE.test(a)) return { ok: false, problem: "otherNetwork" };
    if (!BSC_RE.test(a)) return { ok: false, problem: "format" };
    if (!eip55Valid(a)) return { ok: false, problem: "checksum" };
    if (tokenContract && a.toLowerCase() === tokenContract.toLowerCase()) return { ok: false, problem: "contract" };
    return { ok: true, address: a };
  }
  if (BSC_RE.test(a)) return { ok: false, problem: "otherNetwork" };
  if (!TRON_RE.test(a)) return { ok: false, problem: "format" };
  if (!tronValid(a)) return { ok: false, problem: "checksum" };
  if (tokenContract && a === tokenContract) return { ok: false, problem: "contract" };
  return { ok: true, address: a };
}

/** "0x55d3…7955" for rows; the full value is always one tap away (copy / detail). */
export function shortAddress(a: string | null | undefined, head = 6, tail = 4): string {
  if (!a) return "—";
  return a.length <= head + tail + 1 ? a : `${a.slice(0, head)}…${a.slice(-tail)}`;
}

/** A transaction hash as the service accepts it: 64 hex characters, optionally 0x-prefixed. */
export const TX_HASH_RE = /^(0x)?[0-9a-fA-F]{64}$/;
