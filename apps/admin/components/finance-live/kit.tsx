"use client";

/** Live finance pages (wallet service): shared types, formatting, client names, status chips. */
import * as React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Chip, cn, shortHash, type ChipTone } from "@ezymex/ui";
import { sendJson, type ApiErr } from "@/components/live/kit";

export type Chain = "bsc" | "tron";

export type Deposit = {
  id: number;
  user_id: number | null;
  intent_id: string | null;
  chain: Chain;
  network: string;
  tx_hash: string;
  explorer_url: string;
  from_address: string | null;
  to_address: string | null;
  amount: string | null;
  expected_amount: string | null;
  block_number: number | null;
  block_time: string | null;
  confirmations: number;
  required_confirmations: number;
  status: "pending" | "confirming" | "credited" | "failed" | "review" | "unmatched" | "rejected";
  review_reason: string | null;
  failure_reason: string | null;
  source: "client" | "scanner";
  suggested_user_id: number | null;
  assigned_by: string | null;
  ledger_txn_id: number | null;
  credited_at: string | null;
  created_at: string;
  updated_at: string;
  sender_history?: { user_id: number; deposits: number; last: string }[];
  intent?: { id: string; amount: string; created_at: string; expires_at: string; status: string } | null;
};

export type Withdrawal = {
  id: number;
  user_id: number;
  chain: Chain;
  network: string;
  to_address: string;
  amount: string;
  fee: string;
  net_amount: string;
  status: "requested" | "approved" | "rejected" | "cancelled" | "paid" | "completed";
  kyc_status: string | null;
  reason: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  payout_tx_hash: string | null;
  explorer_url: string | null;
  payout_error: string | null;
  payout_confirmations: number;
  paid_by: string | null;
  paid_at: string | null;
  completed_at: string | null;
  ip: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditItem = {
  id: number;
  actor_kind: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  target_kind: string | null;
  target_id: string | null;
  reason: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  at: string;
};

export type Paged<T> = { items: T[]; page: number; limit: number; total: number };

export type Summary = {
  deposits: { open: number; unmatched: number; review: number; credited_today: string; credited_today_count: number };
  withdrawals: { requested: number; approved: number; paid: number; open_amount: string; completed_today: string };
  wallets: { liabilities: string; funded: number };
  trading_transfers_pending: number;
};

export const CHAIN_SHORT: Record<Chain, string> = { bsc: "BEP20", tron: "TRC20" };
export const CHAIN_NAME: Record<Chain, string> = { bsc: "BNB Chain", tron: "TRON" };

export const DEP_STATUS: Record<Deposit["status"], { tone: ChipTone; label: string }> = {
  pending: { tone: "warn", label: "Not on chain yet" },
  confirming: { tone: "info", label: "Confirming" },
  credited: { tone: "up", label: "Credited" },
  failed: { tone: "down", label: "Failed" },
  review: { tone: "warn", label: "Review" },
  unmatched: { tone: "ember", label: "Unmatched" },
  rejected: { tone: "neutral", label: "Rejected" },
};

export const WD_STATUS: Record<Withdrawal["status"], { tone: ChipTone; label: string }> = {
  requested: { tone: "warn", label: "Requested" },
  approved: { tone: "info", label: "Approved" },
  paid: { tone: "ember", label: "Paid · verifying" },
  completed: { tone: "up", label: "Completed" },
  rejected: { tone: "down", label: "Rejected" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

export function Status({ map, s }: { map: Record<string, { tone: ChipTone; label: string }>; s: string }) {
  const x = map[s] ?? { tone: "neutral" as ChipTone, label: s };
  return (
    <Chip size="sm" tone={x.tone} dot>
      {x.label}
    </Chip>
  );
}

/** "1234.5" → "1,234.50" (display only). Exact to the ledger's 6 decimals unless `maxDp` caps it. */
export function usd(v: string | number | null | undefined, dp = 2, maxDp?: number) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const frac = (String(v).split(".")[1] ?? "").replace(/0+$/, "").length;
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: maxDp ?? Math.max(dp, Math.min(6, frac)) });
}

/** Headline figures (KPI cards): always two decimals, "56,082.48" rather than "56,082.476344". */
export const usd2 = (v: string | number | null | undefined) => usd(v, 2, 2);

export function ChainTag({ chain }: { chain: Chain }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/assets/coins/${chain === "bsc" ? "bnb" : "trx"}.svg`} alt="" width={14} height={14} className="rounded-full" />
      {CHAIN_SHORT[chain]}
    </span>
  );
}

export function TxLink({ hash, url, head = 8, tail = 6 }: { hash: string | null | undefined; url?: string | null; head?: number; tail?: number }) {
  if (!hash) return <span className="text-fg-3">—</span>;
  return (
    <a href={url ?? "#"} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 font-mono text-[12px] text-fg-2 hover:text-ember">
      {shortHash(hash, head, tail)}
      <ExternalLink className="size-3" />
    </a>
  );
}

export function Addr({ a, full }: { a: string | null | undefined; full?: boolean }) {
  if (!a) return <span className="text-fg-3">—</span>;
  return <span className={cn("font-mono text-[12px]", full && "break-all")}>{full ? a : shortHash(a, 6, 5)}</span>;
}

/* ---------- client names (gateway, cached per page) ---------- */

type Name = { name: string; email: string; kyc_status: string };
const known = new Map<number, Name>();
const listeners = new Set<() => void>();
let pending = new Set<number>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  const ids = [...pending];
  pending = new Set();
  timer = null;
  if (!ids.length) return;
  fetch(`/api/wallet/names?ids=${ids.join(",")}`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { names: {} }))
    .then((d: { names?: Record<string, Name> }) => {
      for (const [k, v] of Object.entries(d.names ?? {})) known.set(Number(k), v);
      listeners.forEach((l) => l());
    })
    .catch(() => {});
}

export function useClientName(id: number | null | undefined): Name | null {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);
  React.useEffect(() => {
    if (!id || known.has(id)) return;
    pending.add(id);
    timer ??= setTimeout(flush, 30);
  }, [id]);
  return id ? (known.get(id) ?? null) : null;
}

export function ClientCell({ id }: { id: number | null | undefined }) {
  const n = useClientName(id);
  if (!id) return <span className="text-fg-3">Unassigned</span>;
  return (
    <Link href={`/clients/${id}`} onClick={(e) => e.stopPropagation()} className="block min-w-0 hover:text-ember">
      <span className="block truncate text-[13px] font-medium">{n?.name ?? `Client #${id}`}</span>
      <span className="block truncate text-[11px] text-fg-3">{n?.email ?? `#${id}`}</span>
    </Link>
  );
}

export async function walletWrite<T>(path: string, body: unknown, method: "POST" | "PUT" = "POST"): Promise<{ ok: true; data: T } | { ok: false; error: ApiErr }> {
  return sendJson<T>(`/api/wallet/${path}`, body, method);
}

export function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2 text-[13px] last:border-0">
      <span className="shrink-0 text-fg-3">{k}</span>
      <span className="min-w-0 text-right">{v}</span>
    </div>
  );
}

export function Check({ ok, title, children }: { ok: boolean | null; title: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-[14px] border px-3.5 py-2.5", ok === null ? "border-line" : ok ? "border-up/25 bg-up-soft/40" : "border-warn/35 bg-warn-soft")}>
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <span className={cn("size-2 rounded-full", ok === null ? "bg-fg-3" : ok ? "bg-up" : "bg-warn")} />
        {title}
      </div>
      <div className="mt-1 text-[12px] text-fg-2">{children}</div>
    </div>
  );
}
