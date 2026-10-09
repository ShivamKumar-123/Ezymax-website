"use client";

// Manual payments in the Client Area: the broker's bank / UPI accounts and crypto addresses, and the client's deposit
// requests (services/wallet README "Manual payments"; BFF app/api/wallet/[...path]/route.ts, routes manual/*).
// Live builds read the wallet BFF; demo builds (NEXT_PUBLIC_EZYMEX_MODE=demo) the mock in @ezymex/mock/manual-payments,
// kept in memory so requests can be sent and cancelled on the showcase.

import * as React from "react";
import { tr } from "@ezymex/i18n/react";
import type { T } from "@ezymex/i18n";
import { IS_DEMO } from "@ezymex/mock/mode";
import { MANUAL_DEPOSITS, MANUAL_METHODS, creditOf, type ManualDepositMock, type ManualMethodMock } from "@ezymex/mock/manual-payments";
import { WalletError, fmt, useWallet, walletApi } from "../api";

export type ManualKind = "bank" | "crypto";
export type ManualStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface EvmConfig {
  chain_id: number;
  /** null = the network's native coin */
  token_contract: string | null;
  token_decimals: number;
}

/** bank: account_name, bank_name, account_number, ifsc, swift, iban, branch, upi_id · crypto: network, token, address, memo */
export type MethodDetails = Partial<Record<"account_name" | "bank_name" | "account_number" | "ifsc" | "swift" | "iban" | "branch" | "upi_id" | "network" | "token" | "address" | "memo", string>>;

export interface PaymentMethod {
  id: number;
  kind: ManualKind;
  name: string;
  status: "active" | "hidden";
  sort_order: number;
  currency: string;
  /** units of `currency` per 1 USDT */
  rate: string;
  min_amount: string;
  max_amount: string | null;
  details: MethodDetails;
  evm: EvmConfig | null;
  qr_media_id: string | null;
  qr_url: string | null;
  instructions: string;
  updated_at: string;
}

export interface ManualDeposit {
  id: number;
  method_id: number;
  kind: ManualKind;
  /** the method as it was when the request was sent */
  method: { kind: ManualKind; name: string; currency: string; rate: string; network?: string; token?: string; destination?: string; memo?: string };
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
}

export interface MethodsResp {
  methods: PaymentMethod[];
  max_pending: number;
}

export interface RequestsResp {
  items: ManualDeposit[];
  page: number;
  limit: number;
  total: number;
  pending: number;
  max_pending: number;
}

export interface NewRequest {
  method_id: number;
  amount: string;
  reference: string;
  proof_media_id?: string | null;
  note?: string | null;
  idempotency_key: string;
}

/* ------------------------------------------------------------------ */
/* Money (decimal strings; never floats)                                */
/* ------------------------------------------------------------------ */

/** USDT for `amount` of the method currency at `rate` per USDT, floored to 6 decimals (the service's rule). */
export function expectedCredit(amount: string, rate: string): string | null {
  if (!/^\d{1,12}(\.\d{1,6})?$/.test(amount.trim()) || !/^\d+(\.\d+)?$/.test(rate.trim())) return null;
  return creditOf(amount.trim(), rate.trim());
}

/** Decimal comparison of two non-negative decimal strings: -1, 0, 1. */
export function cmpDec(a: string, b: string): number {
  const [ai = "0", af = ""] = a.split(".");
  const [bi = "0", bf = ""] = b.split(".");
  const d = Math.max(af.length, bf.length);
  const x = BigInt(ai + af.padEnd(d, "0"));
  const y = BigInt(bi + bf.padEnd(d, "0"));
  return x === y ? 0 : x < y ? -1 : 1;
}

/** "200000" INR → "200,000.00 INR" (display only). Crypto amounts keep their decimals. */
export function money(v: string | null | undefined, currency: string) {
  const fiat = /^[A-Z]{3}$/.test(currency) && currency !== "BTC" && currency !== "ETH" && currency !== "BNB";
  return `${fmt(v, fiat || currency === "USDT" ? 2 : 0)} ${currency}`;
}

/** A USDT estimate for display: cut (never rounded up) to 2 decimals, "284.090909" → "284.09". */
export function usdt2(v: string | null | undefined) {
  const [i = "0", f = ""] = String(v ?? "0").split(".");
  return fmt(`${i}.${(f + "00").slice(0, 2)}`, 2);
}

/** The rate as shown: "88.00", "3.67", "0.0000158". */
export function rateText(rate: string) {
  return Number(rate) >= 1 ? fmt(rate, 2) : rate;
}

/** Error code → readable text for a deposit request (codes from the wallet service). */
export function requestError(e: unknown, t: T, ctx?: { method?: PaymentMethod | null; maxPending?: number }): string {
  if (!(e instanceof WalletError)) return e instanceof Error && e.message ? e.message : t("payments.error.submitFailed");
  const m = ctx?.method;
  switch (e.code) {
    case "reference_used":
      return t("payments.error.referenceUsed");
    case "too_many_pending":
      return t("payments.error.tooManyPending", { max: ctx?.maxPending ?? 5 });
    case "method_unavailable":
      return t("payments.error.methodUnavailable");
    case "restricted":
      return t("payments.error.restricted");
    case "below_minimum":
      return m ? t("payments.error.belowMin", { amount: money(m.min_amount, m.currency) }) : e.message;
    case "above_maximum":
      return m?.max_amount ? t("payments.error.aboveMax", { amount: money(m.max_amount, m.currency) }) : e.message;
    case "too_large":
      return t("payments.error.uploadTooLarge");
    case "unsupported_type":
      return t("payments.error.uploadType");
    default:
      return e.message || t("payments.error.submitFailed");
  }
}

/* ------------------------------------------------------------------ */
/* Demo store                                                           */
/* ------------------------------------------------------------------ */

type DemoState = { methods: ManualMethodMock[]; deposits: ManualDepositMock[]; next: number };
let demo: DemoState = { methods: MANUAL_METHODS, deposits: MANUAL_DEPOSITS, next: 2000 };
const listeners = new Set<() => void>();
const setDemo = (f: (s: DemoState) => DemoState) => {
  demo = f(demo);
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const useDemo = () => React.useSyncExternalStore(subscribe, () => demo, () => demo);

function demoCreate(b: NewRequest): ManualDeposit {
  const m = demo.methods.find((x) => x.id === b.method_id);
  if (!m) throw new WalletError(422, "method_unavailable", tr("payments.error.methodUnavailable"));
  if (demo.deposits.some((d) => d.reference.toLowerCase() === b.reference.trim().toLowerCase() && (d.status === "pending" || d.status === "approved"))) throw new WalletError(409, "reference_used", tr("payments.error.referenceUsed"));
  if (demo.deposits.filter((d) => d.status === "pending").length >= 5) throw new WalletError(429, "too_many_pending", tr("payments.error.tooManyPending", { max: 5 }));
  const now = new Date().toISOString();
  const d: ManualDepositMock = {
    id: demo.next,
    method_id: m.id,
    kind: m.kind,
    method: m.kind === "crypto" ? { kind: m.kind, name: m.name, currency: m.currency, rate: m.rate, network: m.details.network!, token: m.details.token!, destination: m.details.address! } : { kind: m.kind, name: m.name, currency: m.currency, rate: m.rate, destination: m.details.account_number ?? m.details.upi_id ?? "" },
    currency: m.currency,
    amount: b.amount,
    rate: m.rate,
    expected_credit: creditOf(b.amount, m.rate),
    credit_amount: null,
    reference: b.reference.trim(),
    proof_url: null,
    client_note: b.note ?? null,
    status: "pending",
    reason: null,
    decided_at: null,
    created_at: now,
    updated_at: now,
  };
  setDemo((s) => ({ ...s, deposits: [d, ...s.deposits], next: s.next + 1 }));
  return d as ManualDeposit;
}

/* ------------------------------------------------------------------ */
/* Hooks and actions                                                    */
/* ------------------------------------------------------------------ */

type Loaded<T> = { data: T | null; error: WalletError | null; loading: boolean; reload: () => void };

export function useManualMethods(): Loaded<MethodsResp> {
  const live = useWallet<MethodsResp>(IS_DEMO ? null : "manual/methods", 60_000);
  const s = useDemo();
  const data = React.useMemo<MethodsResp>(() => ({ methods: s.methods.filter((m) => m.status === "active") as PaymentMethod[], max_pending: 5 }), [s]);
  return IS_DEMO ? { data, error: null, loading: false, reload: () => {} } : live;
}

export function useManualRequests(limit: number): Loaded<RequestsResp> {
  const live = useWallet<RequestsResp>(IS_DEMO ? null : `manual/deposits?limit=${limit}`, 20_000);
  const s = useDemo();
  const data = React.useMemo<RequestsResp>(
    () => ({ items: s.deposits.slice(0, limit) as ManualDeposit[], page: 1, limit, total: s.deposits.length, pending: s.deposits.filter((d) => d.status === "pending").length, max_pending: 5 }),
    [s, limit],
  );
  return IS_DEMO ? { data, error: null, loading: false, reload: () => {} } : live;
}

export async function createRequest(b: NewRequest): Promise<ManualDeposit> {
  if (IS_DEMO) return demoCreate(b);
  const r = await walletApi<{ deposit: ManualDeposit }>("manual/deposits", { body: b });
  return r.deposit;
}

export async function cancelRequest(id: number): Promise<ManualDeposit> {
  if (IS_DEMO) {
    setDemo((s) => ({ ...s, deposits: s.deposits.map((d) => (d.id === id && d.status === "pending" ? { ...d, status: "cancelled", decided_at: new Date().toISOString() } : d)) }));
    return demo.deposits.find((d) => d.id === id) as ManualDeposit;
  }
  const r = await walletApi<{ deposit: ManualDeposit }>(`manual/deposits/${id}/cancel`, { body: {} });
  return r.deposit;
}

export const MAX_PROOF = 5 * 1024 * 1024;

/** Uploads a payment screenshot; returns its id (for the request) and a URL to preview it. */
export async function uploadProof(file: File): Promise<{ id: string; url: string }> {
  if (file.size > MAX_PROOF) throw new WalletError(413, "too_large", tr("payments.error.uploadTooLarge"));
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new WalletError(415, "unsupported_type", tr("payments.error.uploadType"));
  if (IS_DEMO) return { id: "0".repeat(24), url: URL.createObjectURL(file) };
  const form = new FormData();
  form.set("file", file);
  let res: Response;
  try {
    res = await fetch("/api/wallet/manual/proofs", { method: "POST", body: form, cache: "no-store" });
  } catch {
    throw new WalletError(0, "network", tr("payments.error.uploadFailed"));
  }
  const data = (await res.json().catch(() => ({}))) as { media?: { id: string; url: string }; error?: { code?: string; message?: string } };
  if (!res.ok || !data.media) throw new WalletError(res.status, data.error?.code ?? "error", data.error?.message ?? tr("payments.error.uploadFailed"));
  return { id: data.media.id, url: data.media.url };
}

/* ------------------------------------------------------------------ */
/* QR payloads                                                          */
/* ------------------------------------------------------------------ */

/** What the generated QR encodes when the broker uploaded none: a UPI intent for UPI ids (bank methods), the address for
 *  crypto methods; null when there is nothing to scan (a plain bank account). */
export function qrPayload(m: PaymentMethod): string | null {
  if (m.kind === "bank") {
    const upi = m.details.upi_id;
    if (!upi) return null;
    const pn = m.details.account_name ? `&pn=${encodeURIComponent(m.details.account_name)}` : "";
    return `upi://pay?pa=${encodeURIComponent(upi).replace(/%40/g, "@")}${pn}&cu=INR`;
  }
  return m.details.address ?? null;
}
