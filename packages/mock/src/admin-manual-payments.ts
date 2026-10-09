/**
 * Back Office — manual payments mock data (Finance → Payment methods, Finance → Manual deposits).
 * Import via `@ezymex/mock/admin-manual-payments`. Same shapes as the wallet service's admin API
 * (services/wallet/src/ops/manual.rs: method_admin_json / admin_json / counts).
 *
 * Bank / UPI accounts in INR, AED and USD and USDT / BTC addresses a broker lists for payments made outside the
 * platform, and the deposit requests clients sent after paying them. Times are minutes before "now" so the demo
 * always reads as fresh; `manualDemoSeed(now)` turns them into ISO timestamps (call it on the client).
 * `expected_credit` = amount / rate floored to 6 decimals, exactly as the service computes it.
 */

export type MockBankDetails = { account_name?: string; bank_name?: string; account_number?: string; ifsc?: string; swift?: string; iban?: string; branch?: string; upi_id?: string };
export type MockCryptoDetails = { network: string; token: string; address: string; memo?: string };
export type MockEvm = { chain_id: number; token_contract: string | null; token_decimals: number };

export type MockPaymentMethod = {
  id: number;
  kind: "bank" | "crypto";
  name: string;
  status: "active" | "hidden";
  sort_order: number;
  currency: string;
  rate: string;
  min_amount: string;
  max_amount: string | null;
  details: MockBankDetails & Partial<MockCryptoDetails>;
  evm: MockEvm | null;
  qr_media_id: string | null;
  qr_url: string | null;
  instructions: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  version: number;
  pending: number;
};

export type MockManualStatus = "pending" | "approved" | "rejected" | "cancelled";

export type MockMethodSnapshot = {
  kind: "bank" | "crypto";
  name: string;
  currency: string;
  rate: string;
  network?: string;
  token?: string;
  destination: string | null;
  memo?: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  ifsc?: string;
  upi_id?: string;
};

export type MockManualDeposit = {
  id: number;
  method_id: number;
  kind: "bank" | "crypto";
  method: MockMethodSnapshot;
  currency: string;
  amount: string;
  rate: string;
  expected_credit: string;
  credit_amount: string | null;
  reference: string;
  proof_url: string | null;
  client_note: string | null;
  status: MockManualStatus;
  reason: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  user_id: number;
  user_name: string | null;
  user_email: string | null;
  proof_media_id: string | null;
  explorer_url: string | null;
  decided_by: { id: string; name: string | null } | null;
  decision_note: string | null;
  ledger_txn_id: number | null;
  ip: string | null;
};

/** Network presets of crypto methods (the service's list; any other label is free text). */
export const MANUAL_NETWORKS = ["TRC20", "BEP20", "ERC20", "Polygon", "Solana", "BTC"];

/* ------------------------------------------------------------------ */
/* Decimal helpers (exact, no floats)                                  */
/* ------------------------------------------------------------------ */

function toScaled(v: string, dp: number): bigint {
  const [i = "0", f = ""] = v.trim().split(".");
  return BigInt(i + (f + "0".repeat(dp)).slice(0, dp));
}

function fromScaled(n: bigint, dp: number): string {
  const s = n.toString().padStart(dp + 1, "0");
  const int = s.slice(0, s.length - dp);
  const frac = s.slice(s.length - dp).replace(/0+$/, "");
  return frac ? `${int}.${frac}` : int;
}

/** amount / rate floored to 6 decimals ("50000" / "88" → "568.181818"). */
export function manualExpectedCredit(amount: string, rate: string): string {
  const DP = 12;
  const a = toScaled(amount, DP);
  const r = toScaled(rate, DP);
  if (r <= 0n) return "0";
  return fromScaled((a * 1_000_000n) / r, 6);
}

/** Sum of decimal strings (6 decimals). */
export function manualSum(values: string[]): string {
  return fromScaled(values.reduce((s, v) => s + toScaled(v, 6), 0n), 6);
}

/* ------------------------------------------------------------------ */
/* Payment methods                                                     */
/* ------------------------------------------------------------------ */

type MethodSeed = Omit<MockPaymentMethod, "updated_at" | "created_at" | "pending" | "qr_media_id" | "qr_url"> & { updatedMin: number; createdMin: number };

const DAY = 1440;

const METHOD_SEEDS: MethodSeed[] = [
  {
    id: 1,
    kind: "bank",
    name: "HDFC Bank · NEFT / IMPS",
    status: "active",
    sort_order: 10,
    currency: "INR",
    rate: "88",
    min_amount: "1000",
    max_amount: "500000",
    details: { account_name: "Ezymex Markets LLP", bank_name: "HDFC Bank", account_number: "50200081234567", ifsc: "HDFC0001234", branch: "Bandra Kurla Complex, Mumbai" },
    evm: null,
    instructions: "Transfer by IMPS or NEFT from a bank account in your own name. Enter the 12-digit UTR from your bank's confirmation as the reference.",
    created_by: "staff:7",
    updated_by: "staff:7",
    version: 3,
    createdMin: 41 * DAY,
    updatedMin: 6 * DAY + 190,
  },
  {
    id: 2,
    kind: "bank",
    name: "UPI · GPay / PhonePe / Paytm",
    status: "active",
    sort_order: 20,
    currency: "INR",
    rate: "88",
    min_amount: "500",
    max_amount: "100000",
    details: { account_name: "Ezymex Markets LLP", upi_id: "ezymexmarkets@hdfcbank" },
    evm: null,
    instructions: "Scan the QR code or pay to the UPI ID from any UPI app. The UTR is the 12-digit number in the payment details of your app.",
    created_by: "staff:7",
    updated_by: "staff:3",
    version: 5,
    createdMin: 41 * DAY,
    updatedMin: 2 * DAY + 75,
  },
  {
    id: 3,
    kind: "bank",
    name: "Emirates NBD · AED transfer",
    status: "active",
    sort_order: 30,
    currency: "AED",
    rate: "3.67",
    min_amount: "500",
    max_amount: "200000",
    details: { account_name: "Ezymex Markets FZE", bank_name: "Emirates NBD", account_number: "1015447123091", iban: "AE070260001015447123091", swift: "EBILAEAD", branch: "Business Bay, Dubai" },
    evm: null,
    instructions: "Local AED transfer or UAEFTS. Put your Ezymex client number in the payment description and enter the bank's transaction reference here.",
    created_by: "staff:3",
    updated_by: "staff:3",
    version: 2,
    createdMin: 33 * DAY,
    updatedMin: 12 * DAY + 400,
  },
  {
    id: 4,
    kind: "bank",
    name: "USD wire · Mashreq",
    status: "hidden",
    sort_order: 40,
    currency: "USD",
    rate: "1",
    min_amount: "100",
    max_amount: null,
    details: { account_name: "Ezymex Markets FZE", bank_name: "Mashreq Bank", account_number: "019100123456", iban: "AE460330000019100123456", swift: "BOMLAEADXXX", branch: "Mashreq Global HQ, Dubai" },
    evm: null,
    instructions: "International SWIFT transfer in USD. Correspondent bank fees are paid by the sender; we credit what arrives.",
    created_by: "staff:3",
    updated_by: "staff:7",
    version: 4,
    createdMin: 33 * DAY,
    updatedMin: 4 * DAY + 30,
  },
  {
    id: 5,
    kind: "crypto",
    name: "USDT · TRC20",
    status: "active",
    sort_order: 50,
    currency: "USDT",
    rate: "1",
    min_amount: "10",
    max_amount: "50000",
    details: { network: "TRC20", token: "USDT", address: "TLs9Xq4wVGm2cRk7HdZ3yPn8bJe5uFa6Tw" },
    evm: null,
    instructions: "Send USDT on the TRON network (TRC20) only. Paste the transaction hash from your wallet or exchange.",
    created_by: "staff:7",
    updated_by: "staff:7",
    version: 1,
    createdMin: 40 * DAY,
    updatedMin: 40 * DAY,
  },
  {
    id: 6,
    kind: "crypto",
    name: "USDT · BEP20",
    status: "active",
    sort_order: 60,
    currency: "USDT",
    rate: "1",
    min_amount: "10",
    max_amount: "50000",
    details: { network: "BEP20", token: "USDT", address: "0x8f3C2a91D6b47E05c1A9e3B27d4F60a5E91cB7d2" },
    evm: { chain_id: 56, token_contract: "0x55d398326f99059fF775485246999027B3197955", token_decimals: 18 },
    instructions: "Pay with MetaMask in one click, or send USDT on BNB Smart Chain (BEP20) and paste the transaction hash.",
    created_by: "staff:7",
    updated_by: "staff:3",
    version: 2,
    createdMin: 40 * DAY,
    updatedMin: 9 * DAY + 610,
  },
  {
    id: 7,
    kind: "crypto",
    name: "USDT · Polygon",
    status: "active",
    sort_order: 70,
    currency: "USDT",
    rate: "1",
    min_amount: "10",
    max_amount: "25000",
    details: { network: "Polygon", token: "USDT", address: "0x3B9e71A0c4D25f86E1b0937aC5d48F2e6A7b10C9" },
    evm: { chain_id: 137, token_contract: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", token_decimals: 6 },
    instructions: "Low fees: send USDT on Polygon PoS, or pay with MetaMask.",
    created_by: "staff:3",
    updated_by: "staff:3",
    version: 1,
    createdMin: 18 * DAY,
    updatedMin: 18 * DAY,
  },
  {
    id: 8,
    kind: "crypto",
    name: "USDT · ERC20",
    status: "hidden",
    sort_order: 80,
    currency: "USDT",
    rate: "1",
    min_amount: "100",
    max_amount: null,
    details: { network: "ERC20", token: "USDT", address: "0x8f3C2a91D6b47E05c1A9e3B27d4F60a5E91cB7d2" },
    evm: null,
    instructions: "Ethereum network fees are high: prefer BEP20 or Polygon for amounts under 1,000 USDT.",
    created_by: "staff:7",
    updated_by: "staff:7",
    version: 2,
    createdMin: 40 * DAY,
    updatedMin: 15 * DAY,
  },
  {
    id: 9,
    kind: "crypto",
    name: "Bitcoin",
    status: "active",
    sort_order: 90,
    currency: "BTC",
    rate: "0.000016129",
    min_amount: "0.0005",
    max_amount: "2",
    details: { network: "BTC", token: "BTC", address: "bc1qm4kz0t7g2n9wq5d8xv3h6ce7rjfa2y0s9lu4pk" },
    evm: null,
    instructions: "Send BTC on the Bitcoin network. Credited at the rate shown when the request is approved; one confirmation is enough.",
    created_by: "staff:3",
    updated_by: "staff:3",
    version: 6,
    createdMin: 30 * DAY,
    updatedMin: 1 * DAY + 80,
  },
];

/* ------------------------------------------------------------------ */
/* Deposit requests                                                    */
/* ------------------------------------------------------------------ */

type Client = { id: number; name: string; email: string; ip: string };

const C = {
  rahul: { id: 4102, name: "Rahul Mehta", email: "rahul.mehta@gmail.com", ip: "49.36.112.18" },
  fatima: { id: 4117, name: "Fatima Al Mansoori", email: "fatima.mansoori@outlook.com", ip: "94.200.31.77" },
  ananya: { id: 4125, name: "Ananya Iyer", email: "ananya.iyer@yahoo.in", ip: "106.51.78.204" },
  vikram: { id: 4131, name: "Vikram Singh", email: "vikram.singh84@gmail.com", ip: "157.48.19.66" },
  mohammed: { id: 4140, name: "Mohammed Al Hashimi", email: "m.alhashimi@icloud.com", ip: "86.98.4.150" },
  aisha: { id: 4152, name: "Aisha Khan", email: "aisha.khan@gmail.com", ip: "5.195.88.12" },
  rohan: { id: 4160, name: "Rohan Desai", email: "rohan.desai@protonmail.com", ip: "103.21.164.9" },
  neha: { id: 4171, name: "Neha Gupta", email: "neha.gupta@rediffmail.com", ip: "117.99.250.41" },
  khalid: { id: 4180, name: "Khalid Al Suwaidi", email: "khalid.suwaidi@gmail.com", ip: "2.50.143.97" },
  sneha: { id: 4188, name: "Sneha Kulkarni", email: "sneha.kulkarni@gmail.com", ip: "183.87.12.230" },
  yusuf: { id: 4193, name: "Yusuf Rahman", email: "yusuf.rahman@hotmail.com", ip: "91.73.66.18" },
  arjun: { id: 4204, name: "Arjun Nair", email: "arjun.nair@gmail.com", ip: "122.172.40.95" },
} satisfies Record<string, Client>;

const PRIYA = { id: "7", name: "Priya Nair" };
const OMAR = { id: "3", name: "Omar Haddad" };

type DepositSeed = {
  id: number;
  method: number;
  client: Client;
  amount: string;
  reference: string;
  status: MockManualStatus;
  createdMin: number;
  decidedMin?: number;
  by?: { id: string; name: string };
  credit?: string;
  note?: string;
  reason?: string;
  clientNote?: string;
  txn?: number;
};

const DEPOSIT_SEEDS: DepositSeed[] = [
  { id: 1028, method: 1, client: C.rahul, amount: "88000", reference: "412876509134", status: "approved", createdMin: 2 * DAY + 260, decidedMin: 2 * DAY + 95, by: PRIYA, txn: 58211 },
  { id: 1029, method: 5, client: C.fatima, amount: "2500", reference: "7c1e9a04b3f25d68e0a7b41c9d2f3e58a6b0c7d14e92f3a5b8c06d1e7f24a9b3", status: "approved", createdMin: 2 * DAY + 130, decidedMin: 2 * DAY + 70, by: OMAR, txn: 58219 },
  { id: 1030, method: 2, client: C.ananya, amount: "15000", reference: "419034567812", status: "cancelled", createdMin: DAY + 610, decidedMin: DAY + 540 },
  {
    id: 1031,
    method: 2,
    client: C.vikram,
    amount: "50000",
    reference: "420187365529",
    status: "rejected",
    createdMin: DAY + 380,
    decidedMin: 20 * 60,
    by: PRIYA,
    reason: "No payment with this UTR reached our account yet. Check the UTR in your UPI app and send a new request.",
  },
  { id: 1032, method: 3, client: C.mohammed, amount: "18350", reference: "FT26267AE4419", status: "approved", createdMin: DAY + 300, decidedMin: DAY + 120, by: OMAR, txn: 58302, clientNote: "Transfer from my ENBD current account." },
  {
    id: 1033,
    method: 6,
    client: C.aisha,
    amount: "1000",
    reference: "0x5d2e8f1a7c3b90e4d6a1f8b2c5e7d3a09b4f6c1e8d2a7b5f3c9e0d4a6b1f8e2c",
    status: "approved",
    createdMin: 20 * 60 + 15,
    decidedMin: 19 * 60 + 40,
    by: PRIYA,
    credit: "998.5",
    note: "998.50 USDT arrived on BscScan (the exchange deducted its withdrawal fee); credited what was received.",
    txn: 58377,
  },
  {
    id: 1034,
    method: 7,
    client: C.rohan,
    amount: "750",
    reference: "0xa93f0c6e2d71b8f45e0a3c9d7b1f62e84c5a0d9e3b7f1c6a2e8d4b0f5c9a7e31",
    status: "rejected",
    createdMin: 16 * 60,
    decidedMin: 15 * 60 + 10,
    by: OMAR,
    reason: "This transaction pays a different address, not our Polygon address. Contact support with your wallet's withdrawal record.",
  },
  { id: 1035, method: 1, client: C.neha, amount: "100000", reference: "421009876534", status: "cancelled", createdMin: 13 * 60, decidedMin: 12 * 60 + 35, clientNote: "Wrong amount entered." },
  { id: 1036, method: 9, client: C.khalid, amount: "0.025", reference: "3f6b9e2c1d8a7f4e0b5c3a9d6e1f8b2c7a4d0e9f5b3c8a1d6e2f7b4c9a0d5e3f", status: "approved", createdMin: 9 * 60 + 20, decidedMin: 8 * 60 + 5, by: OMAR, txn: 58410 },
  // pending (the queue: oldest first)
  { id: 1037, method: 2, client: C.sneha, amount: "25000", reference: "421563908871", status: "pending", createdMin: 5 * 60 + 12, clientNote: "Paid from my SBI account through PhonePe." },
  { id: 1038, method: 5, client: C.fatima, amount: "1200", reference: "b48e2d7f0a9c3e61d5b7f2a84c0e9d3b6a1f7c5e2d8b4a0f9c6e3d1b7a5f2e08", status: "pending", createdMin: 3 * 60 + 5 },
  { id: 1039, method: 3, client: C.yusuf, amount: "3670", reference: "FT26281BX7730", status: "pending", createdMin: 2 * 60 + 18, clientNote: "Mashreq to ENBD, same-day transfer." },
  { id: 1040, method: 6, client: C.rahul, amount: "500", reference: "0x1e7c4a9f2b6d0e83c5a1f7d9b2e4c6a08f3d5b1e9c7a2f4d6b0e8c3a5f1d7b92", status: "pending", createdMin: 55, clientNote: "Paid with MetaMask." },
  { id: 1041, method: 1, client: C.arjun, amount: "176000", reference: "422790135546", status: "pending", createdMin: 25 },
  { id: 1042, method: 2, client: C.vikram, amount: "50000", reference: "420187365529", status: "pending", createdMin: 8, clientNote: "Sent again — the money has left my account, please check." },
];

function snapshot(m: MethodSeed): MockMethodSnapshot {
  const base = { kind: m.kind, name: m.name, currency: m.currency, rate: m.rate };
  const d = m.details;
  if (m.kind === "crypto") return { ...base, network: d.network, token: d.token, destination: d.address ?? null, ...(d.memo ? { memo: d.memo } : {}) };
  const out: MockMethodSnapshot = { ...base, destination: d.account_number ?? d.upi_id ?? d.iban ?? null };
  for (const k of ["bank_name", "account_name", "account_number", "ifsc", "upi_id"] as const) if (d[k]) out[k] = d[k];
  return out;
}

/** Block explorer link of a transaction (the service's explorer_tx for the preset networks). */
export function manualExplorerUrl(network: string | undefined, hash: string): string | null {
  const hex = hash.replace(/^0x/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) return null;
  switch (network) {
    case "TRC20":
      return `https://tronscan.org/#/transaction/${hex}`;
    case "BEP20":
      return `https://bscscan.com/tx/0x${hex}`;
    case "ERC20":
      return `https://etherscan.io/tx/0x${hex}`;
    case "Polygon":
      return `https://polygonscan.com/tx/0x${hex}`;
    case "BTC":
      return `https://mempool.space/tx/${hex}`;
    default:
      return null;
  }
}

/** Pending requests in the demo queue (nav badge). */
export const ADMIN_MANUAL_PENDING = DEPOSIT_SEEDS.filter((d) => d.status === "pending").length;

/** The demo's methods and requests with timestamps relative to `now` (epoch ms). */
export function manualDemoSeed(now: number): { methods: MockPaymentMethod[]; deposits: MockManualDeposit[] } {
  const iso = (min: number) => new Date(now - min * 60_000).toISOString();
  const byId = new Map(METHOD_SEEDS.map((m) => [m.id, m]));
  const deposits: MockManualDeposit[] = DEPOSIT_SEEDS.map((s) => {
    const m = byId.get(s.method)!;
    const expected = manualExpectedCredit(s.amount, m.rate);
    const decided = s.status !== "pending";
    return {
      id: s.id,
      method_id: m.id,
      kind: m.kind,
      method: snapshot(m),
      currency: m.currency,
      amount: s.amount,
      rate: m.rate,
      expected_credit: expected,
      credit_amount: s.status === "approved" ? (s.credit ?? expected) : null,
      reference: s.reference,
      proof_url: null,
      client_note: s.clientNote ?? null,
      status: s.status,
      reason: s.reason ?? null,
      decided_at: decided && s.decidedMin !== undefined ? iso(s.decidedMin) : null,
      created_at: iso(s.createdMin),
      updated_at: iso(s.decidedMin ?? s.createdMin),
      user_id: s.client.id,
      user_name: s.client.name,
      user_email: s.client.email,
      proof_media_id: null,
      explorer_url: m.kind === "crypto" ? manualExplorerUrl(m.details.network, s.reference) : null,
      decided_by: s.by ?? null,
      decision_note: s.note ?? null,
      ledger_txn_id: s.txn ?? null,
      ip: s.client.ip,
    };
  });
  const methods: MockPaymentMethod[] = METHOD_SEEDS.map(({ updatedMin, createdMin, ...m }) => ({
    ...m,
    details: { ...m.details },
    evm: m.evm ? { ...m.evm } : null,
    qr_media_id: null,
    qr_url: null,
    created_at: iso(createdMin),
    updated_at: iso(updatedMin),
    pending: deposits.filter((d) => d.method_id === m.id && d.status === "pending").length,
  }));
  return { methods, deposits };
}
