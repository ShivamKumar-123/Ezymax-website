"use client";

/**
 * Manual payments (bank / UPI / crypto paid outside the platform): the wallet service's admin shapes
 * (services/wallet/src/ops/manual.rs), formatting, the generated QR preview and the client cell.
 */
import * as React from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Bitcoin, Landmark, Smartphone } from "lucide-react";
import { Chip, cn, type ChipTone } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { useClientName, usd, type AuditItem } from "./kit";

export type ManualKind = "bank" | "crypto";
export type ManualStatus = "pending" | "approved" | "rejected" | "cancelled";

export type BankDetails = { account_name?: string; bank_name?: string; account_number?: string; ifsc?: string; swift?: string; iban?: string; branch?: string; upi_id?: string };
export type CryptoDetails = { network: string; token: string; address: string; memo?: string };
export type EvmConfig = { chain_id: number; token_contract: string | null; token_decimals: number };

export type PaymentMethod = {
  id: number;
  kind: ManualKind;
  name: string;
  status: "active" | "hidden";
  sort_order: number;
  currency: string;
  rate: string;
  min_amount: string;
  max_amount: string | null;
  details: BankDetails & Partial<CryptoDetails>;
  evm: EvmConfig | null;
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

export type ManualCounts = { pending: number; pending_bank: number; pending_crypto: number; pending_usdt: string; approved: number; rejected: number; cancelled: number; all: number };
export type MethodsResp = { methods: PaymentMethod[]; networks: string[]; counts: ManualCounts };

export type MethodSnapshot = {
  kind: ManualKind;
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

export type ManualDeposit = {
  id: number;
  method_id: number;
  kind: ManualKind;
  method: MethodSnapshot;
  currency: string;
  amount: string;
  rate: string;
  expected_credit: string;
  credit_amount: string | null;
  reference: string;
  proof_url: string | null;
  client_note: string | null;
  status: ManualStatus;
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

export type ManualDepositDetail = ManualDeposit & {
  client_history: { approved: number; credited: string; rejected: number; pending: number };
  same_reference: { id: number; user_id: number; status: ManualStatus; created_at: string }[];
  history: AuditItem[];
};

export type DepositsResp = { items: ManualDeposit[]; total: number; counts: ManualCounts; page: number; limit: number };

/** A method as the editor sends it (create, or a full update with the loaded `version`). */
export type MethodInput = {
  kind: ManualKind;
  name: string;
  status: "active" | "hidden";
  sort_order: number;
  currency: string;
  rate: string;
  min_amount: string;
  max_amount: string | null;
  details: Record<string, string>;
  evm: { chain_id: number | string; token_contract: string | null; token_decimals: number | string } | null;
  qr_media_id: string | null;
  instructions: string;
  version?: number;
};

export const NETWORK_PRESETS = ["TRC20", "BEP20", "ERC20", "Polygon", "Solana", "BTC"] as const;

/** The preset a network label stands for (the service's `preset()`: "tron" → TRC20, "bsc" → BEP20 …). */
export function networkPreset(network: string | null | undefined): (typeof NETWORK_PRESETS)[number] | null {
  const n = (network ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["trc20", "tron", "trx", "trontrc20"].includes(n)) return "TRC20";
  if (["bep20", "bsc", "bnb", "bnbchain", "bnbsmartchain", "bscbep20", "bnbsmartchainbep20"].includes(n)) return "BEP20";
  if (["erc20", "eth", "ethereum", "ethereumerc20"].includes(n)) return "ERC20";
  if (["polygon", "matic", "pol", "polygonpos"].includes(n)) return "Polygon";
  if (["solana", "sol", "spl"].includes(n)) return "Solana";
  if (["btc", "bitcoin"].includes(n)) return "BTC";
  return null;
}

/** MetaMask can pay on the EVM presets, and on any custom network the broker names. */
export function metamaskPossible(network: string | null | undefined) {
  const p = networkPreset(network);
  return p === null ? !!network?.trim() : p === "BEP20" || p === "ERC20" || p === "Polygon";
}

export const EVM_PRESETS = [
  { key: "bnb", label: "BNB Chain · USDT", chain_id: 56, token_contract: "0x55d398326f99059fF775485246999027B3197955", token_decimals: 18, network: "BEP20" },
  { key: "eth", label: "Ethereum · USDT", chain_id: 1, token_contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7", token_decimals: 6, network: "ERC20" },
  { key: "polygon", label: "Polygon · USDT", chain_id: 137, token_contract: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", token_decimals: 6, network: "Polygon" },
  { key: "native", label: "Native coin", chain_id: null, token_contract: "", token_decimals: 18, network: null },
] as const;

export const CHAIN_NAMES: Record<number, string> = { 1: "Ethereum", 56: "BNB Chain", 137: "Polygon" };

/* ---------- formatting ---------- */

/** Amount in a method currency: fiat with 2 decimals, crypto up to 8 ("0.025 BTC"). */
export function money(v: string | number | null | undefined, ccy?: string) {
  const crypto = ccy && !["INR", "AED", "USD", "EUR", "GBP", "SAR", "QAR", "KWD", "OMR", "BHD", "PKR", "BDT", "LKR", "NPR"].includes(ccy.toUpperCase()) && ccy.toUpperCase() !== "USDT";
  const s = crypto ? usd(v, 0, 8) : usd(v, 2);
  return ccy ? `${s} ${ccy}` : s;
}

/** A rate or its inverse for display: 88 → "88.00", 0.01136 → "0.0114", 0.000016129 → "0.00001613". */
export function fmtRate(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (n >= 0.001) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumSignificantDigits: 4 });
}

/** "1 USDT = 88.00 INR" and "1 INR = 0.0114 USDT"; null when the rate isn't a positive number. */
export function rateLines(rate: string | number, ccy: string): { fwd: string; rev: string } | null {
  const r = Number(rate);
  const c = (ccy || "").trim().toUpperCase() || "…";
  if (!Number.isFinite(r) || r <= 0) return null;
  return { fwd: `1 USDT = ${fmtRate(r)} ${c}`, rev: `1 ${c} = ${fmtRate(1 / r)} USDT` };
}

/** What the client pays to, in one line (bank · ••4567, a UPI id, or a short address). */
export function destinationLine(m: Pick<PaymentMethod, "kind" | "details">) {
  const d = m.details;
  if (m.kind === "crypto") return d.address ? `${d.network ?? ""} · ${short(d.address)}` : d.network ?? "—";
  const parts = [d.bank_name, d.account_number ? `••${d.account_number.replace(/\s/g, "").slice(-4)}` : d.iban ? `IBAN ••${d.iban.slice(-4)}` : null, d.upi_id].filter(Boolean);
  return parts.join(" · ") || d.account_name || "—";
}

export function short(s: string, head = 6, tail = 5) {
  return s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;
}

/** The QR value the Client Area generates when no image was uploaded: a UPI payment link, else the crypto address. */
export function generatedQr(kind: ManualKind, d: BankDetails & Partial<CryptoDetails>): string | null {
  if (kind === "bank") {
    const upi = d.upi_id?.trim();
    if (!upi) return null;
    const name = d.account_name?.trim();
    return `upi://pay?pa=${upi}${name ? `&pn=${encodeURIComponent(name)}` : ""}&cu=INR`;
  }
  return d.address?.trim() || null;
}

/* ---------- small UI ---------- */

export const MANUAL_STATUS: Record<ManualStatus, { tone: ChipTone; label: string }> = {
  pending: { tone: "warn", label: "Pending" },
  approved: { tone: "up", label: "Approved" },
  rejected: { tone: "down", label: "Rejected" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

export function KindChip({ kind, upi }: { kind: ManualKind; upi?: boolean }) {
  return kind === "crypto" ? (
    <Chip size="sm" tone="gold">
      <Bitcoin className="size-3" /> Crypto
    </Chip>
  ) : upi ? (
    <Chip size="sm" tone="info">
      <Smartphone className="size-3" /> UPI
    </Chip>
  ) : (
    <Chip size="sm" tone="info">
      <Landmark className="size-3" /> Bank
    </Chip>
  );
}

/** A client: the request's name / email snapshot, else the gateway's (live), linking to the client page. */
export function ManualClient({ id, name, email }: { id: number; name?: string | null; email?: string | null }) {
  const n = useClientName(IS_DEMO || (name && email) ? null : id);
  return (
    <Link href={`/clients/${id}`} onClick={(e) => e.stopPropagation()} className="block min-w-0 max-w-[220px] hover:text-ember">
      <span className="block truncate text-[13px] font-medium">{name || n?.name || `Client #${id}`}</span>
      <span className="block truncate text-[11px] text-fg-3">
        {email || n?.email || ""} <span className="text-fg-3/70">#{id}</span>
      </span>
    </Link>
  );
}

/** A QR on a white tile: an uploaded image, else the code the Client Area generates (labelled), else a hint. */
export function QrPreview({ src, value, size = 132, className, caption = true }: { src?: string | null; value?: string | null; size?: number; className?: string; caption?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="grid place-items-center rounded-[16px] bg-white p-3" style={{ width: size + 24, height: size + 24 }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="QR code" className="max-h-full max-w-full object-contain" />
        ) : value ? (
          <QRCodeSVG value={value} size={size} level="M" bgColor="#ffffff" fgColor="#0e0e12" />
        ) : (
          <span className="px-3 text-center text-[11.5px] leading-snug text-[#6b6b76]">No QR — clients see the details only</span>
        )}
      </div>
      {caption && (src ? <Chip size="sm">Uploaded image</Chip> : value ? <Chip size="sm" tone="info">Generated automatically</Chip> : null)}
    </div>
  );
}

/** An admin audit action of a manual request / method as words. */
export function manualAction(a: string) {
  const map: Record<string, string> = {
    "wallet.manual.deposit.approved": "Approved",
    "wallet.manual.deposit.rejected": "Rejected",
    "wallet.manual.deposit.cancelled": "Cancelled by the client",
    "wallet.manual.method.created": "Method created",
    "wallet.manual.method.updated": "Method updated",
    "wallet.manual.method.hidden": "Method hidden",
    "wallet.manual.method.shown": "Method shown",
    "wallet.manual.method.deleted": "Method deleted",
    "wallet.manual.qr.uploaded": "QR uploaded",
    "wallet.manual.export": "Exported",
  };
  return map[a] ?? a.replace(/^wallet\.manual\./, "").replace(/[._]/g, " ");
}

/** The wallet's actor tag as words: "staff:7" → "staff #7". */
export function actorName(tag: string | null | undefined) {
  if (!tag) return "—";
  const m = /^staff:([^:]+)(?::(.+))?$/.exec(tag);
  return m ? (m[2] ?? `staff #${m[1]}`) : tag;
}
