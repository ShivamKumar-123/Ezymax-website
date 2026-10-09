/**
 * Demo data for manual payments in the Client Area (Wallet → Deposit → Bank / UPI and Crypto): the broker's payment
 * methods and the demo client's deposit requests, in the wallet service's JSON shapes (services/wallet README,
 * "Manual payments"). expected_credit = amount / rate, floored to 6 decimals, as the service computes it.
 */

export interface ManualMethodMock {
  id: number;
  kind: "bank" | "crypto";
  name: string;
  status: "active" | "hidden";
  sort_order: number;
  currency: string;
  rate: string;
  min_amount: string;
  max_amount: string | null;
  details: Record<string, string>;
  evm: { chain_id: number; token_contract: string | null; token_decimals: number } | null;
  qr_media_id: string | null;
  qr_url: string | null;
  instructions: string;
  updated_at: string;
}

export interface ManualDepositMock {
  id: number;
  method_id: number;
  kind: "bank" | "crypto";
  method: Record<string, string>;
  currency: string;
  amount: string;
  rate: string;
  expected_credit: string;
  credit_amount: string | null;
  reference: string;
  proof_url: string | null;
  client_note: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

export const MANUAL_METHODS: ManualMethodMock[] = [
  {
    id: 1,
    kind: "bank",
    name: "HDFC Bank · UPI",
    status: "active",
    sort_order: 0,
    currency: "INR",
    rate: "88",
    min_amount: "500",
    max_amount: "200000",
    details: { account_name: "Ezymex Markets Pvt Ltd", bank_name: "HDFC Bank", account_number: "50200071234567", ifsc: "HDFC0001234", branch: "Bandra Kurla Complex, Mumbai", upi_id: "ezymex@hdfcbank" },
    evm: null,
    qr_media_id: null,
    qr_url: null,
    instructions: "Pay from a bank account or UPI app in your own name. Third-party payments are returned.",
    updated_at: ago(72),
  },
  {
    id: 2,
    kind: "bank",
    name: "Emirates NBD · AED transfer",
    status: "active",
    sort_order: 1,
    currency: "AED",
    rate: "3.67",
    min_amount: "100",
    max_amount: null,
    details: { account_name: "Ezymex Markets FZE", bank_name: "Emirates NBD", account_number: "1015 4987 6543 01", iban: "AE070260001015498765401", swift: "EBILAEAD", branch: "Business Bay, Dubai" },
    evm: null,
    qr_media_id: null,
    qr_url: null,
    instructions: "Use your client number as the payment reference.",
    updated_at: ago(120),
  },
  {
    id: 3,
    kind: "crypto",
    name: "USDT · TRC20",
    status: "active",
    sort_order: 2,
    currency: "USDT",
    rate: "1",
    min_amount: "20",
    max_amount: null,
    details: { network: "TRC20", token: "USDT", address: "TXYZ7r8Lw3q2pHn9KbT1cV4mZs6UeJfRgA" },
    evm: null,
    qr_media_id: null,
    qr_url: null,
    instructions: "",
    updated_at: ago(96),
  },
  {
    id: 4,
    kind: "crypto",
    name: "USDT · BEP20",
    status: "active",
    sort_order: 3,
    currency: "USDT",
    rate: "1",
    min_amount: "10",
    max_amount: "100000",
    details: { network: "BEP20", token: "USDT", address: "0x8F3a6c2B1d9E4f7A0b5C3e6D2a1F9c8B7e4D3a21" },
    evm: { chain_id: 56, token_contract: "0x55d398326f99059fF775485246999027B3197955", token_decimals: 18 },
    qr_media_id: null,
    qr_url: null,
    instructions: "MetaMask users can pay in one click; other wallets send to the address above.",
    updated_at: ago(30),
  },
  {
    id: 5,
    kind: "crypto",
    name: "Bitcoin",
    status: "active",
    sort_order: 4,
    currency: "BTC",
    rate: "0.0000158",
    min_amount: "0.0005",
    max_amount: null,
    details: { network: "BTC", token: "BTC", address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh" },
    evm: null,
    qr_media_id: null,
    qr_url: null,
    instructions: "Credited after 2 network confirmations and the broker's check.",
    updated_at: ago(200),
  },
];

const snap = (m: ManualMethodMock): Record<string, string> => {
  const base: Record<string, string> = { kind: m.kind, name: m.name, currency: m.currency, rate: m.rate };
  if (m.kind === "crypto") return { ...base, network: m.details.network!, token: m.details.token!, destination: m.details.address! };
  return { ...base, bank_name: m.details.bank_name ?? "", account_name: m.details.account_name ?? "", destination: m.details.account_number ?? m.details.upi_id ?? "" };
};

/** amount / rate floored to 6 decimals (decimal strings, no floating point). */
export function creditOf(amount: string, rate: string): string {
  const parts = (v: string) => {
    const [i = "0", f = ""] = v.split(".");
    return { n: BigInt(i + f), d: f.length };
  };
  const a = parts(amount);
  const r = parts(rate);
  if (r.n === 0n) return "0";
  const units = (a.n * 10n ** BigInt(r.d) * 1_000_000n) / (r.n * 10n ** BigInt(a.d));
  const s = units.toString().padStart(7, "0");
  const out = `${s.slice(0, -6)}.${s.slice(-6)}`.replace(/\.?0+$/, "");
  return out || "0";
}

const req = (id: number, methodId: number, amount: string, reference: string, status: ManualDepositMock["status"], hours: number, extra: Partial<ManualDepositMock> = {}): ManualDepositMock => {
  const m = MANUAL_METHODS.find((x) => x.id === methodId)!;
  const expected = creditOf(amount, m.rate);
  return {
    id,
    method_id: m.id,
    kind: m.kind,
    method: snap(m),
    currency: m.currency,
    amount,
    rate: m.rate,
    expected_credit: expected,
    credit_amount: status === "approved" ? expected : null,
    reference,
    proof_url: null,
    client_note: null,
    status,
    reason: null,
    decided_at: status === "pending" ? null : ago(hours - 2),
    created_at: ago(hours),
    updated_at: ago(status === "pending" ? hours : hours - 2),
    ...extra,
  };
};

/** The demo client's requests, newest first. */
export const MANUAL_DEPOSITS: ManualDepositMock[] = [
  req(1042, 1, "25000", "412398765012", "pending", 1.5),
  req(1039, 4, "750", "0x6c1f0b2e9d4a7c3b8e5f1a2d4c6b8e0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b", "pending", 5),
  req(1031, 1, "44000", "412377712345", "approved", 52),
  req(1027, 3, "1200", "9f4e2c7a1b3d5f7e9a0c2e4b6d8f0a1c3e5b7d9f1a3c5e7b9d0f2a4c6e8b0d1f", "approved", 140),
  req(1019, 1, "8800", "412300012399", "rejected", 210, { reason: "No payment with this UTR reached our account. Check the UTR and send a new request." }),
  req(1012, 2, "3670", "FT26261XK0QZ", "cancelled", 300),
];
