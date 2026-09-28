"use client";

// Browser side of the wallet BFF (app/api/wallet/[...path]/route.ts). Live builds only.

import * as React from "react";
import { toast } from "sonner";

export type Chain = "bsc" | "tron";

export interface Balance {
  currency: string;
  available: string;
  locked: string;
}

export interface ChainConfig {
  chain: Chain;
  network: string;
  token: string;
  token_contract: string;
  decimals: number;
  evm_chain_id: number | null;
  confirmations: number;
  deposits_enabled: boolean;
  withdrawals_enabled: boolean;
  min_deposit: string;
  withdraw_fee: string;
}

export interface WalletConfig {
  chains: ChainConfig[];
  limits: {
    withdraw_min: string;
    withdraw_max: string;
    withdraw_daily_max: string;
    withdraw_fee_flat: string;
    withdraw_fee_pct: string;
    deposit_cooldown_hours: number;
    intent_ttl_minutes: number;
  };
}

export interface Intent {
  id: string;
  chain: Chain;
  network: string;
  currency: string;
  amount: string;
  address: string;
  token_contract: string;
  decimals: number;
  evm_chain_id: number | null;
  status: "open" | "submitted" | "completed" | "expired";
  expires_at: string;
  created_at: string;
  confirmations?: number;
}

export type DepositStatus = "pending" | "confirming" | "credited" | "failed" | "review" | "unmatched" | "rejected";

export interface Deposit {
  id: number;
  intent_id: string | null;
  chain: Chain;
  network: string;
  tx_hash: string;
  explorer_url: string;
  from_address: string | null;
  amount: string | null;
  expected_amount: string | null;
  confirmations: number;
  required_confirmations: number;
  status: DepositStatus;
  review_reason: string | null;
  failure_reason: string | null;
  credited_at: string | null;
  created_at: string;
}

export type WithdrawalStatus = "requested" | "approved" | "rejected" | "cancelled" | "paid" | "completed";

export interface Withdrawal {
  id: number;
  chain: Chain;
  network: string;
  to_address: string;
  amount: string;
  fee: string;
  net_amount: string;
  status: WithdrawalStatus;
  reason: string | null;
  payout_tx_hash: string | null;
  explorer_url: string | null;
  payout_confirmations: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Overview {
  balances: Balance[];
  pending_deposits: Deposit[];
  open_withdrawals: Withdrawal[];
  limits: { used_today: string; remaining_today: string; daily_max: string; cooldown_until: string | null };
  notifications_unread: number;
}

export interface ActivityItem {
  type: "deposit" | "withdrawal" | "transfer" | "other";
  id: string;
  status: string;
  amount: string | null;
  currency: string;
  chain: Chain | null;
  network: string | null;
  tx_hash: string | null;
  explorer_url: string | null;
  login: number | null;
  direction: "in" | "out";
  kind: string | null;
  fee: string | null;
  net_amount: string | null;
  note: string | null;
  address: string | null;
  confirmations: number | null;
  required_confirmations: number | null;
  created_at: string;
  updated_at: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface TradingTransfer {
  id: number;
  login: number;
  direction: "to_trading" | "from_trading";
  amount: string;
  status: "pending" | "completed" | "failed";
  error_message: string | null;
  engine_amount: string | null;
  engine_currency: string | null;
  created_at: string;
}

export interface Notification {
  id: number;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export class WalletError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

const FRIENDLY: Record<string, string> = {
  unavailable: "The wallet is unavailable. Please try again shortly.",
  insufficient_funds: "Not enough available balance.",
};

export async function walletApi<T>(path: string, init?: { body?: unknown; signal?: AbortSignal; headers?: Record<string, string> }): Promise<T> {
  const post = init?.body !== undefined;
  let res: Response;
  try {
    res = await fetch(`/api/wallet/${path}`, {
      method: post ? "POST" : "GET",
      headers: post ? { "content-type": "application/json", ...(init?.headers ?? {}) } : undefined,
      body: post ? JSON.stringify(init?.body) : undefined,
      cache: "no-store",
      signal: init?.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new WalletError(0, "network", "Network error. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string; field?: string } };
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.assign(`/api/auth/expired?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    const code = data.error?.code ?? "error";
    throw new WalletError(res.status, code, (res.status >= 500 && FRIENDLY[code]) || data.error?.message || FRIENDLY[code] || "Something went wrong. Please try again.", data.error?.field);
  }
  return data as T;
}

export function walletToast(title: string, e: unknown) {
  toast.error(title, { description: e instanceof Error ? e.message : "Something went wrong. Please try again." });
}

/** Polls a wallet BFF path every `ms` while the tab is visible (ms = 0: once). */
export function useWallet<T>(path: string | null, ms = 0) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<WalletError | null>(null);
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);
  React.useEffect(() => {
    if (!path) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ctl = new AbortController();
    const run = async () => {
      if (stop) return;
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        try {
          const d = await walletApi<T>(path, { signal: ctl.signal });
          if (stop) return;
          setData(d);
          setError(null);
        } catch (e) {
          if (stop || (e as Error).name === "AbortError") return;
          setError(e instanceof WalletError ? e : new WalletError(0, "error", "Something went wrong."));
        }
      }
      if (!stop && ms > 0) timer = setTimeout(run, ms);
    };
    run();
    return () => {
      stop = true;
      ctl.abort();
      if (timer) clearTimeout(timer);
    };
  }, [path, ms, tick]);
  return { data, error, loading: data === null && error === null, reload };
}

/** A fresh request id per submitted form (the service makes the request idempotent on it). */
export function requestId() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** "1234.5" → "1,234.50" (display only; amounts stay strings end to end). */
export function fmt(v: string | number | null | undefined, dp = 2) {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  if (!Number.isFinite(n)) return "—";
  const decimals = Math.max(dp, Math.min(6, (String(v ?? "").split(".")[1] ?? "").replace(/0+$/, "").length));
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: decimals });
}

export function usdtAvailable(o: Pick<Overview, "balances"> | null | undefined) {
  return o?.balances.find((b) => b.currency === "USDT") ?? { currency: "USDT", available: "0", locked: "0" };
}

export const CHAIN_LABEL: Record<Chain, { name: string; short: string; wallet: string }> = {
  bsc: { name: "BNB Smart Chain", short: "BEP20", wallet: "MetaMask" },
  tron: { name: "TRON", short: "TRC20", wallet: "TronLink" },
};

/** Address format check (the service validates checksums too). */
export function addressLooksValid(chain: Chain, a: string) {
  const v = a.trim();
  return chain === "bsc" ? /^0x[0-9a-fA-F]{40}$/.test(v) : /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v);
}
