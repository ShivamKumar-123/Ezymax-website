// Wallet feature pure logic: hashes (against node:crypto and published vectors), EIP-55 / TRON address checks,
// EIP-681 links and amount helpers.
//   node --import ./apps/mobile/scripts/test-hooks.mjs --test apps/mobile/scripts/wallet-lib.test.mts
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import test from "node:test";
import { ascii, keccak256, sha256, sha3_256, toHex } from "../src/features/wallet/lib/hash.ts";
import { checkAddress, eip55Valid, shortAddress, toChecksumAddress, tronValid, TX_HASH_RE } from "../src/features/wallet/lib/address.ts";
import { eip681TokenTransfer, toUnits } from "../src/features/wallet/lib/eip681.ts";
import { addAmounts, cents, cleanAmount, fmtAmount, fromCents, isAmount } from "../src/features/wallet/lib/money.ts";

test("sha256 matches node:crypto for every length 0..300 and published vectors", () => {
  for (let n = 0; n <= 300; n++) {
    const data = randomBytes(n);
    assert.equal(toHex(sha256(new Uint8Array(data))), createHash("sha256").update(data).digest("hex"), `length ${n}`);
  }
  assert.equal(toHex(sha256(ascii("abc"))), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(toHex(sha256(ascii(""))), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("the Keccak sponge matches node:crypto SHA3-256 for every length 0..400 (multi-block, padding edges)", () => {
  for (let n = 0; n <= 400; n++) {
    const data = randomBytes(n);
    assert.equal(toHex(sha3_256(new Uint8Array(data))), createHash("sha3-256").update(data).digest("hex"), `length ${n}`);
  }
});

test("keccak256 published vectors (Ethereum padding)", () => {
  assert.equal(toHex(keccak256(ascii(""))), "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
  assert.equal(toHex(keccak256(ascii("Transfer(address,address,uint256)"))), "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef");
  assert.equal(toHex(keccak256(ascii("transfer(address,uint256)"))).slice(0, 8), "a9059cbb");
  assert.equal(toHex(keccak256(ascii("The quick brown fox jumps over the lazy dog"))), "4d741b6f1eb29cb2a9b9911c82f56fa8d73b04959d3d9d222895df6c0b28aa15");
});

test("EIP-55 checksums (vectors from the EIP)", () => {
  const mixed = ["0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359", "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB", "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb", "0x55d398326f99059fF775485246999027B3197955"];
  for (const a of mixed) {
    assert.equal(toChecksumAddress(a.toLowerCase()), a);
    assert.ok(eip55Valid(a), a);
  }
  assert.ok(eip55Valid("0x52908400098527886E0F7030069857D2E4169EE7"), "all caps carries no checksum");
  assert.ok(eip55Valid("0xde709f2102306220921060314715629080e2fb77"), "all lower carries no checksum");
  assert.ok(!eip55Valid("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD"), "one letter in the wrong case");
});

test("TRON base58check", () => {
  for (const a of ["TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", "TU7PHUS22Hw632YsnAyjxNh4gu3u8PzcHZ", "TDVSPgBZDmNjkYpSH9GdLLbV6LCLhrrYnx"]) assert.ok(tronValid(a), a);
  assert.ok(!tronValid("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u"), "bad checksum");
  assert.ok(!tronValid("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6"), "too short");
  assert.ok(!tronValid("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj0t"), "0 is not base58");
});

test("checkAddress: format, checksum, other network, token contract", () => {
  const usdtBsc = "0x55d398326f99059fF775485246999027B3197955";
  const usdtTron = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
  assert.deepEqual(checkAddress("bsc", "  0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed "), { ok: true, address: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed" });
  assert.deepEqual(checkAddress("bsc", ""), { ok: false, problem: "empty" });
  assert.deepEqual(checkAddress("bsc", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAe"), { ok: false, problem: "format" });
  assert.deepEqual(checkAddress("bsc", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD"), { ok: false, problem: "checksum" });
  assert.deepEqual(checkAddress("bsc", "TU7PHUS22Hw632YsnAyjxNh4gu3u8PzcHZ"), { ok: false, problem: "otherNetwork" });
  assert.deepEqual(checkAddress("bsc", usdtBsc.toLowerCase(), usdtBsc), { ok: false, problem: "contract" });
  assert.deepEqual(checkAddress("tron", "TU7PHUS22Hw632YsnAyjxNh4gu3u8PzcHZ"), { ok: true, address: "TU7PHUS22Hw632YsnAyjxNh4gu3u8PzcHZ" });
  assert.deepEqual(checkAddress("tron", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"), { ok: false, problem: "otherNetwork" });
  assert.deepEqual(checkAddress("tron", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u"), { ok: false, problem: "checksum" });
  assert.deepEqual(checkAddress("tron", "T123"), { ok: false, problem: "format" });
  assert.deepEqual(checkAddress("tron", usdtTron, usdtTron), { ok: false, problem: "contract" });
  assert.equal(shortAddress(usdtBsc), "0x55d3…7955");
  assert.ok(TX_HASH_RE.test(`0x${"a".repeat(64)}`) && TX_HASH_RE.test("B".repeat(64)) && !TX_HASH_RE.test("0x1234"));
});

test("EIP-681 token transfer links", () => {
  assert.equal(toUnits("100", 18), "100000000000000000000");
  assert.equal(toUnits("12.5", 18), "12500000000000000000");
  assert.equal(toUnits("0.000001", 6), "1");
  assert.equal(toUnits("1.1234567", 6), null);
  assert.equal(toUnits("1e3", 6), null);
  assert.equal(
    eip681TokenTransfer({ token: "0x55d398326f99059fF775485246999027B3197955", chainId: 56, to: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", amount: "250.5", decimals: 18 }),
    "ethereum:0x55d398326f99059fF775485246999027B3197955@56/transfer?address=0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed&uint256=250500000000000000000",
  );
  assert.equal(eip681TokenTransfer({ token: "0x55d398326f99059fF775485246999027B3197955", chainId: 56, to: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", amount: "0", decimals: 18 }), null);
  assert.equal(eip681TokenTransfer({ token: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", chainId: null, to: "TU7PHUS22Hw632YsnAyjxNh4gu3u8PzcHZ", amount: "10", decimals: 6 }), null);
});

test("amount helpers", () => {
  assert.equal(fmtAmount("1234.5"), "1,234.50");
  assert.equal(fmtAmount("125.500000"), "125.50");
  assert.equal(fmtAmount("0.000125"), "0.000125");
  assert.equal(fmtAmount(null), "—");
  assert.equal(cleanAmount("1,5"), "1.5");
  assert.equal(cleanAmount("12.345"), "12.34");
  assert.equal(cleanAmount("007"), "7");
  assert.equal(cleanAmount(".5"), "0.5");
  assert.equal(cleanAmount("1.2.3"), "1.23");
  assert.equal(cleanAmount("12.3456", 6), "12.3456");
  assert.ok(isAmount("10") && isAmount("10.25") && !isAmount("10.255") && !isAmount("0") && !isAmount(""));
  assert.equal(cents("12.34"), 1234);
  assert.equal(cents("12"), 1200);
  assert.equal(cents("12.3"), 1230);
  assert.equal(cents(12.345), 1234);
  assert.equal(cents("2525.123456"), 252512);
  assert.equal(fromCents(123456), "1234.56");
  assert.equal(fromCents(100), "1");
  assert.equal(fromCents(150), "1.5");
});

test("computed amounts never show float noise; wallet sums are exact decimals", () => {
  // 10.7 + 0.1 = 10.799999999999999 and 0.1 + 0.2 = 0.30000000000000004 in floating point
  assert.equal(fmtAmount(10.7 + 0.1), "10.80");
  assert.equal(fmtAmount(0.1 + 0.2), "0.30");
  assert.equal(fmtAmount(123457.13 / 100), "1,234.5713");
  assert.equal(fmtAmount(120001.57 / 100), "1,200.0157");
  assert.equal(fmtAmount(0.000125), "0.000125");
  // the balance block's total: available + locked as the service's decimal strings
  assert.equal(addAmounts("10.7", "0.1"), "10.8");
  assert.equal(addAmounts("0.1", "0.2"), "0.3");
  assert.equal(addAmounts("1250.100000", "100.200000"), "1350.3");
  assert.equal(addAmounts("0.000001", "0.000002"), "0.000003");
  assert.equal(addAmounts("99999999.999999", "0.000001"), "100000000");
  assert.equal(addAmounts("5", null, undefined, ""), "5");
  assert.equal(addAmounts("-2.5", "1"), "-1.5");
  assert.equal(fmtAmount(addAmounts("10.7", "0.1")), "10.80");
});
