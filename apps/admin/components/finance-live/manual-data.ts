"use client";

/**
 * Data layer of the manual payments pages: live builds read and write the wallet service through the admin BFF
 * (/api/wallet/manual/*); demo builds (NEXT_PUBLIC_EZYMEX_MODE=demo) run the same pages on an in-memory store seeded
 * from @ezymex/mock/admin-manual-payments, with the service's rules for the actions (no network). The pages only
 * talk to the hooks and actions below, so the UI is the same in both builds.
 */
import * as React from "react";
import { IS_DEMO } from "@ezymex/mock/mode";
import { MANUAL_NETWORKS, manualDemoSeed, manualExpectedCredit, manualSum } from "@ezymex/mock/admin-manual-payments";
import { downloadCsv, qs, sendJson, useApi, type ApiErr } from "@/components/live/kit";
import type { AuditItem } from "./kit";
import { networkPreset, type DepositsResp, type ManualCounts, type ManualDeposit, type ManualDepositDetail, type MethodInput, type MethodsResp, type PaymentMethod } from "./manual-kit";

export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiErr };
type Loaded<T> = { data: T | null; error: ApiErr | null; loading: boolean; reload: () => void };

/** Fired after a decision or a method change, so the nav badge and other lists refresh at once. */
export const MANUAL_CHANGED = "ezymex:manual-payments-changed";
export function announceManualChange() {
  window.dispatchEvent(new Event(MANUAL_CHANGED));
}

/* ------------------------------------------------------------------ */
/* Demo store                                                          */
/* ------------------------------------------------------------------ */

type DemoState = { methods: PaymentMethod[]; deposits: ManualDeposit[]; history: Record<number, AuditItem[]>; seq: number };

let demo: DemoState | null = null;
const subs = new Set<() => void>();
const noop = () => {};

function seedHistory(deposits: ManualDeposit[]): Record<number, AuditItem[]> {
  const out: Record<number, AuditItem[]> = {};
  let n = 9000;
  for (const d of deposits) {
    if (d.status === "pending" || !d.decided_at) continue;
    const staff = d.status !== "cancelled";
    out[d.id] = [
      {
        id: ++n,
        actor_kind: staff ? "staff" : "user",
        actor_id: staff ? (d.decided_by?.id ?? null) : String(d.user_id),
        actor_name: staff ? (d.decided_by?.name ?? null) : d.user_name,
        actor_role: staff ? "finance" : null,
        action: `wallet.manual.deposit.${d.status}`,
        target_kind: "manual_deposit",
        target_id: String(d.id),
        reason: d.status === "approved" ? d.decision_note : d.reason,
        before: { status: "pending" },
        after: { status: d.status, ...(d.credit_amount ? { credit_amount: d.credit_amount } : {}) },
        ip: null,
        at: d.decided_at,
      },
    ];
  }
  return out;
}

function getDemo(): DemoState {
  if (!demo) {
    const s = manualDemoSeed(Date.now());
    demo = { methods: s.methods as PaymentMethod[], deposits: s.deposits as ManualDeposit[], history: seedHistory(s.deposits as ManualDeposit[]), seq: 1 };
  }
  return demo;
}

function setDemo(fn: (s: DemoState) => DemoState) {
  demo = fn(getDemo());
  subs.forEach((l) => l());
}

function subscribe(l: () => void) {
  subs.add(l);
  return () => {
    subs.delete(l);
  };
}

/** The demo store on the client (null on the server and in live builds: the first paint shows the skeleton). */
function useDemo(): DemoState | null {
  return React.useSyncExternalStore(
    subscribe,
    () => (IS_DEMO ? getDemo() : null),
    () => null,
  );
}

function demoCounts(ds: ManualDeposit[]): ManualCounts {
  const pending = ds.filter((d) => d.status === "pending");
  return {
    pending: pending.length,
    pending_bank: pending.filter((d) => d.kind === "bank").length,
    pending_crypto: pending.filter((d) => d.kind === "crypto").length,
    pending_usdt: manualSum(pending.map((d) => d.expected_credit)),
    approved: ds.filter((d) => d.status === "approved").length,
    rejected: ds.filter((d) => d.status === "rejected").length,
    cancelled: ds.filter((d) => d.status === "cancelled").length,
    all: ds.length,
  };
}

const later = <T,>(v: T, ms = 350) => new Promise<T>((r) => setTimeout(() => r(v), ms));
const fail = (field: string | undefined, message: string, code = "validation"): Result<never> => ({ ok: false, error: { code, message, ...(field ? { field } : {}) } });
const norm = (v: string) => manualSum([v]);
const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export function useManualMethods(): Loaded<MethodsResp> {
  const live = useApi<MethodsResp>(IS_DEMO ? null : "/api/wallet/manual/methods", { refreshMs: 30_000 });
  const d = useDemo();
  const data = React.useMemo<MethodsResp | null>(() => {
    if (!d) return null;
    const methods = d.methods
      .map((m) => ({ ...m, pending: d.deposits.filter((x) => x.method_id === m.id && x.status === "pending").length }))
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    return { methods, networks: MANUAL_NETWORKS, counts: demoCounts(d.deposits) };
  }, [d]);
  if (!IS_DEMO) return live;
  return { data, error: null, loading: false, reload: noop };
}

export type DepositQuery = { status: string; kind: string; method_id: string; q: string; page: number; limit: number };

const filterQs = (f: Omit<DepositQuery, "page" | "limit">) => ({ status: f.status, kind: f.kind, method_id: f.method_id, q: f.q });

function demoFilter(ds: ManualDeposit[], f: Omit<DepositQuery, "page" | "limit">) {
  const t = f.q.trim().toLowerCase().replace(/^0x/, "");
  return ds
    .filter((d) => (f.status === "all" || d.status === f.status) && (f.kind === "all" || d.kind === f.kind) && (f.method_id === "all" || String(d.method_id) === f.method_id))
    .filter((d) => !t || d.reference.toLowerCase().replace(/^0x/, "").includes(t) || (d.user_email ?? "").toLowerCase().includes(t) || (d.user_name ?? "").toLowerCase().includes(t) || String(d.id) === t || String(d.user_id) === t)
    .sort((a, b) => {
      const pa = a.status === "pending" ? 0 : 1;
      const pb = b.status === "pending" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return pa === 0 ? a.id - b.id : b.id - a.id;
    });
}

export function useManualDeposits(f: DepositQuery): Loaded<DepositsResp> {
  const url = `/api/wallet/manual/deposits${qs({ ...filterQs(f), page: f.page, limit: f.limit })}`;
  const live = useApi<DepositsResp>(IS_DEMO ? null : url, { refreshMs: 15_000 });
  const d = useDemo();
  const { status, kind, method_id, q, page, limit } = f;
  const data = React.useMemo<DepositsResp | null>(() => {
    if (!d) return null;
    const all = demoFilter(d.deposits, { status, kind, method_id, q });
    return { items: all.slice((page - 1) * limit, page * limit), total: all.length, counts: demoCounts(d.deposits), page, limit };
  }, [d, status, kind, method_id, q, page, limit]);
  if (!IS_DEMO) return live;
  return { data, error: null, loading: false, reload: noop };
}

export function useManualDeposit(id: number | null): Loaded<{ deposit: ManualDepositDetail }> {
  const live = useApi<{ deposit: ManualDepositDetail }>(IS_DEMO || !id ? null : `/api/wallet/manual/deposits/${id}`, { refreshMs: 15_000 });
  const d = useDemo();
  const data = React.useMemo<{ deposit: ManualDepositDetail } | null>(() => {
    if (!d || !id) return null;
    const x = d.deposits.find((y) => y.id === id);
    if (!x) return null;
    const others = d.deposits.filter((y) => y.user_id === x.user_id && y.id !== x.id);
    const key = (r: ManualDeposit) => `${r.kind}:${r.reference.toLowerCase().replace(/^0x/, "")}`;
    return {
      deposit: {
        ...x,
        client_history: {
          approved: others.filter((y) => y.status === "approved").length,
          credited: manualSum(others.filter((y) => y.status === "approved").map((y) => y.credit_amount ?? "0")),
          rejected: others.filter((y) => y.status === "rejected").length,
          pending: others.filter((y) => y.status === "pending").length,
        },
        same_reference: d.deposits
          .filter((y) => y.id !== x.id && key(y) === key(x))
          .sort((a, b) => b.id - a.id)
          .map((y) => ({ id: y.id, user_id: y.user_id, status: y.status, created_at: y.created_at })),
        history: d.history[x.id] ?? [],
      },
    };
  }, [d, id]);
  if (!IS_DEMO) return live;
  return { data, error: null, loading: false, reload: noop };
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

function demoValidate(m: MethodInput): Result<never> | null {
  if (m.name.trim().length < 2) return fail("name", "Enter a name clients will recognise (2–60 characters)");
  const ccy = m.currency.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(ccy)) return fail("currency", "Enter the currency code clients pay in (e.g. INR, USD, USDT)");
  if (!(Number(m.rate) > 0)) return fail("rate", "Enter how many units of the currency make 1 USDT (above 0, at most 10 decimals)");
  if (ccy === "USDT" && Number(m.rate) !== 1) return fail("rate", "A USDT method has a rate of 1");
  if (!(Number(m.min_amount || "0") >= 0)) return fail("min_amount", "Enter a minimum of 0 or more (at most 6 decimals)");
  if (m.max_amount !== null && !(Number(m.max_amount) > 0 && Number(m.max_amount) >= Number(m.min_amount || "0"))) return fail("max_amount", "The maximum must be above 0 and at least the minimum");
  const d = m.details;
  if (m.kind === "bank") {
    if (!d.account_name && !d.upi_id) return fail("account_name", "Enter the account holder's name or a UPI ID");
    if (d.upi_id && !/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9.-]{2,64}$/.test(d.upi_id)) return fail("upi_id", "Enter a UPI ID like name@bank");
    if (d.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(d.ifsc.toUpperCase())) return fail("ifsc", "An IFSC code has 11 characters, like HDFC0001234");
    if (d.swift && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(d.swift.toUpperCase())) return fail("swift", "A SWIFT / BIC code has 8 or 11 characters");
    if (d.iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(d.iban.replace(/\s/g, "").toUpperCase())) return fail("iban", "Enter a valid IBAN");
  } else {
    if (!d.network) return fail("network", "Choose the network");
    if (!d.address || d.address.length < 10 || /\s/.test(d.address)) return fail("address", "Enter the receiving address without spaces");
    const p = networkPreset(d.network);
    if ((p === "BEP20" || p === "ERC20" || p === "Polygon") && !/^0x[0-9a-fA-F]{40}$/.test(d.address)) return fail("address", `This isn't a valid ${p} address`);
    if (m.evm) {
      if (!/^0x[0-9a-fA-F]{40}$/.test(d.address)) return fail("evm", "MetaMask payments need an EVM address (0x…)");
      if (!(Number(m.evm.chain_id) >= 1)) return fail("evm", "Enter the chain id (e.g. 56 for BNB Chain)");
      if (m.evm.token_contract && !/^0x[0-9a-fA-F]{40}$/.test(m.evm.token_contract)) return fail("evm", "The token contract must be a 0x… address (empty = the native coin)");
    }
  }
  return null;
}

function demoMethod(m: MethodInput, base: Partial<PaymentMethod>): PaymentMethod {
  const details = Object.fromEntries(Object.entries(m.details).filter(([, v]) => v)) as PaymentMethod["details"];
  if (m.kind === "crypto") {
    details.network = networkPreset(details.network) ?? details.network;
    details.token = (details.token || "USDT").toUpperCase();
  }
  const evm = m.evm ? { chain_id: Number(m.evm.chain_id), token_contract: m.evm.token_contract || null, token_decimals: m.evm.token_decimals === "" ? 18 : Number(m.evm.token_decimals) } : null;
  return {
    id: 0,
    pending: 0,
    created_at: nowIso(),
    created_by: "staff:0",
    ...base,
    kind: m.kind,
    name: m.name.trim(),
    status: m.status,
    sort_order: m.sort_order,
    currency: m.currency.trim().toUpperCase(),
    rate: norm(m.rate),
    min_amount: norm(m.min_amount || "0"),
    max_amount: m.max_amount ? norm(m.max_amount) : null,
    details,
    evm,
    qr_media_id: m.qr_media_id,
    qr_url: m.qr_media_id ? (demoMedia.get(m.qr_media_id) ?? null) : null,
    instructions: m.instructions.trim(),
    updated_at: nowIso(),
    updated_by: "staff:0",
    version: (base.version ?? 0) + 1,
  };
}

/** Creates a method, or saves one with the version the editor loaded (409 `stale` when someone saved in between). */
export async function saveMethod(m: MethodInput, id?: number): Promise<Result<{ method: PaymentMethod }>> {
  if (!IS_DEMO) return sendJson(`/api/wallet/manual/methods${id ? `/${id}` : ""}`, m, id ? "PUT" : "POST");
  const bad = demoValidate(m);
  if (bad) return later(bad);
  const s = getDemo();
  if (id) {
    const cur = s.methods.find((x) => x.id === id);
    if (!cur) return later(fail(undefined, "Payment method not found", "not_found"));
    if (m.version !== undefined && m.version !== cur.version) return later(fail(undefined, "Someone else changed this payment method. Reload it and try again.", "stale"));
    const next = demoMethod({ ...m, kind: cur.kind }, cur);
    setDemo((st) => ({ ...st, methods: st.methods.map((x) => (x.id === id ? next : x)) }));
    return later({ ok: true, data: { method: next } });
  }
  const nid = Math.max(0, ...s.methods.map((x) => x.id)) + 1;
  const next = demoMethod(m, { id: nid });
  setDemo((st) => ({ ...st, methods: [...st.methods, next] }));
  return later({ ok: true, data: { method: next } });
}

export async function deleteMethod(id: number, reason: string): Promise<Result<{ deleted: true }>> {
  if (!IS_DEMO) return sendJson(`/api/wallet/manual/methods/${id}/delete`, { reason });
  setDemo((st) => ({ ...st, methods: st.methods.filter((x) => x.id !== id) }));
  return later({ ok: true, data: { deleted: true } });
}

export type Media = { id: string; url: string; mime: string; size: number };
const demoMedia = new Map<string, string>();

/** Uploads a QR image (the raw bytes): PNG, JPG or WEBP up to 5 MB, the type is checked by the service. */
export async function uploadQr(file: File): Promise<Result<{ media: Media }>> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return fail(undefined, "Use a PNG, JPG or WEBP image.", "unsupported_type");
  if (file.size > 5 * 1024 * 1024) return fail(undefined, "Images can be up to 5 MB.", "too_large");
  if (IS_DEMO) {
    const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
    const url = URL.createObjectURL(file);
    demoMedia.set(id, url);
    return later({ ok: true, data: { media: { id, url, mime: file.type, size: file.size } } }, 500);
  }
  try {
    const r = await fetch("/api/wallet/manual/media", { method: "POST", headers: { "content-type": file.type || "application/octet-stream" }, body: file, credentials: "same-origin" });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) {
      window.location.assign(`/api/auth/expired?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return fail(undefined, "Your session has ended.", "unauthorized");
    }
    if (r.ok) return { ok: true, data: data as { media: Media } };
    const e = (data as { error?: ApiErr })?.error;
    return { ok: false, error: e?.message ? e : { code: String(r.status), message: r.status === 413 ? "Images can be up to 5 MB." : "The upload failed." } };
  } catch {
    return fail(undefined, "Can't reach the Back Office server.", "network");
  }
}

function demoDecide(id: number, patch: (d: ManualDeposit) => ManualDeposit, entry: Omit<AuditItem, "id" | "at" | "target_kind" | "target_id" | "ip">) {
  let out: ManualDeposit | null = null;
  setDemo((st) => {
    const deposits = st.deposits.map((d) => (d.id === id ? (out = patch(d)) : d));
    const item: AuditItem = { ...entry, id: 20000 + st.seq, at: nowIso(), target_kind: "manual_deposit", target_id: String(id), ip: null };
    return { ...st, deposits, seq: st.seq + 1, history: { ...st.history, [id]: [...(st.history[id] ?? []), item] } };
  });
  return out as ManualDeposit | null;
}

/** Approves a pending request: credits `expected_credit` USDT, or `credit_amount` with a note (required when it differs). */
export async function approveDeposit(id: number, body: { credit_amount?: string; note?: string }): Promise<Result<{ deposit: ManualDeposit }>> {
  if (!IS_DEMO) return sendJson(`/api/wallet/manual/deposits/${id}/approve`, body);
  const cur = getDemo().deposits.find((d) => d.id === id);
  if (!cur) return later(fail(undefined, "Deposit request not found", "not_found"));
  if (cur.status !== "pending") return later(fail(undefined, `This request is ${cur.status} and can't be approved`, "invalid_state"));
  const credit = body.credit_amount?.trim() || cur.expected_credit;
  if (!/^\d+(\.\d{1,6})?$/.test(credit) || !(Number(credit) > 0)) return later(fail("credit_amount", "Enter an amount above 0 with at most 6 decimals"));
  if (norm(credit) !== norm(cur.expected_credit) && (body.note ?? "").trim().length < 3) return later(fail("note", "You changed the amount to credit: add a note explaining why"));
  const at = nowIso();
  const d = demoDecide(
    id,
    (x) => ({ ...x, status: "approved", credit_amount: norm(credit), decided_at: at, updated_at: at, decided_by: { id: "0", name: "Demo Admin" }, decision_note: body.note?.trim() || null, ledger_txn_id: 58500 + id - 1000 }),
    { actor_kind: "staff", actor_id: "0", actor_name: "Demo Admin", actor_role: "platform_owner", action: "wallet.manual.deposit.approved", reason: body.note?.trim() || null, before: { status: "pending" }, after: { status: "approved", credit_amount: norm(credit) } },
  );
  return later({ ok: true, data: { deposit: d! } });
}

/** Rejects a pending request with a reason the client sees. */
export async function rejectDeposit(id: number, reason: string): Promise<Result<{ deposit: ManualDeposit }>> {
  if (!IS_DEMO) return sendJson(`/api/wallet/manual/deposits/${id}/reject`, { reason });
  const cur = getDemo().deposits.find((d) => d.id === id);
  if (!cur) return later(fail(undefined, "Deposit request not found", "not_found"));
  if (cur.status !== "pending") return later(fail(undefined, `This request is ${cur.status} and can't be rejected`, "invalid_state"));
  if (reason.trim().length < 3) return later(fail("reason", "Give a reason (the client sees it)"));
  const at = nowIso();
  const d = demoDecide(
    id,
    (x) => ({ ...x, status: "rejected", reason: reason.trim(), decided_at: at, updated_at: at, decided_by: { id: "0", name: "Demo Admin" } }),
    { actor_kind: "staff", actor_id: "0", actor_name: "Demo Admin", actor_role: "platform_owner", action: "wallet.manual.deposit.rejected", reason: reason.trim(), before: { status: "pending" }, after: { status: "rejected" } },
  );
  return later({ ok: true, data: { deposit: d! } });
}

/** Downloads the requests matching the filters as CSV (the service's export in live builds; finance.export). */
export async function exportDeposits(f: Omit<DepositQuery, "page" | "limit">): Promise<Result<{ rows: number | null }>> {
  const stamp = new Date().toISOString().slice(0, 10);
  if (IS_DEMO) {
    const rows = demoFilter(getDemo().deposits, f);
    downloadCsv(
      `manual-deposits-${stamp}`,
      ["id", "created_at", "status", "kind", "method", "network", "client_id", "client_name", "client_email", "amount", "currency", "rate", "expected_credit_usdt", "credited_usdt", "reference", "decided_by", "decided_at", "reason", "note"],
      rows.map((d) => [d.id, d.created_at, d.status, d.kind, d.method.name, d.method.network ?? "", d.user_id, d.user_name, d.user_email, d.amount, d.currency, d.rate, d.expected_credit, d.credit_amount, d.reference, d.decided_by?.name ?? "", d.decided_at, d.reason, d.decision_note]),
    );
    return { ok: true, data: { rows: rows.length } };
  }
  try {
    const r = await fetch(`/api/wallet/manual/deposits/export${qs(filterQs(f))}`, { credentials: "same-origin", cache: "no-store" });
    if (r.status === 401) {
      window.location.assign(`/api/auth/expired?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return fail(undefined, "Your session has ended.", "unauthorized");
    }
    if (!r.ok) {
      const e = ((await r.json().catch(() => ({}))) as { error?: ApiErr }).error;
      return { ok: false, error: e?.message ? e : { code: String(r.status), message: "The export failed." } };
    }
    const blob = await r.blob();
    const name = /filename="?([^";]+)"?/.exec(r.headers.get("content-disposition") ?? "")?.[1] ?? `manual-deposits-${stamp}.csv`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true, data: { rows: null } };
  } catch {
    return fail(undefined, "Can't reach the Back Office server.", "network");
  }
}

/** The expected credit of an amount at a rate (the service's rule: amount / rate floored to 6 decimals). */
export const expectedCredit = manualExpectedCredit;

/** Whether two decimal strings are the same amount at the ledger's 6 decimals ("998.50" = "998.5"). */
export const sameAmount = (a: string, b: string) => norm(a) === norm(b);
