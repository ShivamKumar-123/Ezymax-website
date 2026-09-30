// Wallet data: the same Client Area wallet BFF as the web (apps/crm/app/api/wallet/[...path]/route.ts), reached as
// /api/mobile/wallet/* with the bearer session (a rewrite of the cookie route: identical validation, step-up
// codes, KYC gate, restrictions, viewer and staff policies). Shapes follow services/wallet (client JSON).
// Money actions (intents, submissions, withdrawals, cancels, transfers) call the API directly and show the server's
// answer: nothing is optimistic. Reads go through the screen cache (useQuery, persisted per user).
import { apiGet, apiPost, type ApiError, type ApiResult } from "@/lib/api";
import { randomId } from "@/lib/device";
import { getQueryData, invalidate, prefetch, useQuery } from "@/lib/query";
import { i18n } from "@/i18n";
import { ACCOUNTS_KEY, fetchAccounts } from "@/features/trading/accounts";
import type { EngAccount } from "@/features/trading/types";
import type { Chain } from "./lib/address";
import { cents, fromCents } from "./lib/money";

export type { Chain };

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

export type IntentStatus = "open" | "submitted" | "completed" | "expired";

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
  status: IntentStatus;
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

export type ActivityType = "deposit" | "withdrawal" | "transfer" | "other";

export interface ActivityItem {
  type: ActivityType;
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

export interface Quote {
  amount: string;
  fee: string;
  net_amount: string;
  used_today: string;
  daily_max: string;
  available: string;
}

/** Trading accounts come from the app's shared "trading/accounts" cache (features/trading), so a transfer refreshes
 *  the balances Home and Portfolio show too. */
export type TradingAccount = EngAccount;

/** Network names as wallets and exchanges show them. */
export const CHAIN_LABEL: Record<Chain, { name: string; short: string }> = {
  bsc: { name: "BNB Smart Chain", short: "BEP20" },
  tron: { name: "TRON", short: "TRC20" },
};

/** USD value of an amount in the account currency (cent accounts hold USC = USD / 100). */
export const toUsd = (a: Pick<TradingAccount, "cent" | "currency">, v: number) => (a.cent || a.currency === "USC" ? v / 100 : v);
/** The same in whole cents as a decimal string (never rounded up: it is what can actually move). */
export const usdOf = (a: Pick<TradingAccount, "cent" | "currency">, v: number | null | undefined) => fromCents(cents(toUsd(a, v ?? 0)));
export const accountCurrencyPrefix = (a: Pick<TradingAccount, "cent" | "currency">) => (a.cent || a.currency === "USC" ? "USC " : a.currency === "USD" ? "$" : `${a.currency} `);

export const usdtBalance = (o: Pick<Overview, "balances"> | null | undefined): Balance => o?.balances.find((b) => b.currency === "USDT") ?? { currency: "USDT", available: "0", locked: "0" };

/** A fresh request id per submitted form: the service makes the request idempotent on it (a double tap or a
 *  retry after a timeout books once). */
export const requestId = () => randomId(16);

/* ---- friendly errors (the web's mapping, plus the codes the app handles itself) ---- */

const FRIENDLY: Record<string, string> = {
  unavailable: "wallet.error.unavailable",
  insufficient_funds: "wallet.error.insufficientFunds",
  stepup_required: "wallet.withdraw.confirmationExpired",
  stepup_invalid: "wallet.withdraw.confirmationExpired",
  viewer_read_only: "mobile.viewOnlyBody",
  staff_read_only: "mobileWallet.error.staffReadOnly",
  maintenance: "mobile.state.maintenance.body",
};

/** The message to show for a failed wallet call (the server's wording unless a translated one exists). */
export function walletError(e: ApiError | undefined | null, fallbackKey = "wallet.error.generic"): string {
  if (!e) return i18n.t.dyn(fallbackKey);
  const key = FRIENDLY[e.code];
  if (key && (e.code !== "unavailable" || (e.status ?? 0) >= 500 || !e.message)) return i18n.t.dyn(key, e.message);
  return e.message || i18n.t.dyn(fallbackKey);
}

/* ---- queries ---- */

export const QK = {
  config: "wallet:config",
  overview: "wallet:overview",
  recent: "wallet:activity:recent",
  history: (type: string) => `wallet:activity:${type}`,
  withdrawals: "wallet:withdrawals",
  transfers: "wallet:transfers",
  intent: (id: string) => `wallet:intent:${id}`,
} as const;

/**
 * A poll that brings back exactly what is cached keeps the cached object, so memoised sections (and FlashList rows)
 * see the same props and skip rendering: a background refresh only re-renders what actually changed.
 */
async function shared<T>(key: string, request: Promise<ApiResult<T>>): Promise<ApiResult<T>> {
  const r = await request;
  if (!r.ok) return r;
  const prev = getQueryData<T>(key);
  return prev !== undefined && JSON.stringify(prev) === JSON.stringify(r.data) ? { ...r, data: prev } : r;
}
const get = <T>(key: string, path: string) => () => shared(key, apiGet<T>(path));

export const HISTORY_PAGE = 25;

export const fetchConfig = get<WalletConfig>(QK.config, "wallet/config");
export const fetchOverview = get<Overview>(QK.overview, "wallet/overview");
export const fetchRecent = get<Page<ActivityItem>>(QK.recent, "wallet/activity?limit=8");
export const fetchWithdrawals = get<Page<Withdrawal>>(QK.withdrawals, "wallet/withdrawals?limit=20");
export const fetchTransfers = get<Page<TradingTransfer>>(QK.transfers, "wallet/transfers?limit=15");
const fetchTradingAccounts = () => shared(ACCOUNTS_KEY, fetchAccounts());
export const fetchActivity = (type: string, page: number, limit = HISTORY_PAGE) => apiGet<Page<ActivityItem>>(`wallet/activity?type=${type}&page=${page}&limit=${limit}`);
/** The first history page of a filter (the cached one). */
export const fetchHistory = (type: string) => shared(QK.history(type), fetchActivity(type, 1));
export const fetchIntent = (id: string) => shared(QK.intent(id), apiGet<{ intent: Intent; deposit: Deposit | null }>(`wallet/deposits/intents/${id}`));

export const useWalletConfig = () => useQuery(QK.config, fetchConfig, { persist: true, staleMs: 5 * 60_000 });
export const useOverview = (poll = false) => useQuery(QK.overview, fetchOverview, { persist: true, staleMs: 10_000, intervalMs: poll ? 15_000 : undefined });
export const useRecentActivity = (poll = false) => useQuery(QK.recent, fetchRecent, { persist: true, staleMs: 15_000, intervalMs: poll ? 30_000 : undefined });
export const useWithdrawals = (poll = false) => useQuery(QK.withdrawals, fetchWithdrawals, { persist: true, staleMs: 15_000, intervalMs: poll ? 20_000 : undefined });
export const useTransfers = () => useQuery(QK.transfers, fetchTransfers, { persist: true, staleMs: 15_000 });
export const useTradingAccounts = (poll = false, enabled = true) => useQuery(ACCOUNTS_KEY, fetchTradingAccounts, { persist: true, staleMs: 15_000, intervalMs: poll ? 15_000 : undefined, enabled });

/** Warm the screens' data on press-in (the tap that opens them). */
export const prefetchWallet = {
  overview: () => {
    prefetch(QK.overview, fetchOverview, { persist: true, staleMs: 10_000 });
    prefetch(QK.recent, fetchRecent, { persist: true, staleMs: 15_000 });
  },
  deposit: () => prefetch(QK.config, fetchConfig, { persist: true, staleMs: 5 * 60_000 }),
  withdraw: () => {
    prefetch(QK.config, fetchConfig, { persist: true, staleMs: 5 * 60_000 });
    prefetch(QK.withdrawals, fetchWithdrawals, { persist: true, staleMs: 15_000 });
  },
  transfer: () => {
    prefetch(ACCOUNTS_KEY, fetchTradingAccounts, { persist: true, staleMs: 15_000 });
    prefetch(QK.transfers, fetchTransfers, { persist: true, staleMs: 15_000 });
  },
  history: () => prefetch(QK.history("all"), () => fetchHistory("all"), { persist: true, staleMs: 15_000 }),
  intent: (id: string) => prefetch(QK.intent(id), () => fetchIntent(id), { staleMs: 4_000 }),
};

/** Pull to refresh: every wallet query on screen refetches (and the trading accounts when asked); resolves when the
 *  given query (the screen's main one) has its answer. */
export function refreshOnScreen(main: () => Promise<void>, accounts = false) {
  invalidate("wallet:");
  if (accounts) invalidate(ACCOUNTS_KEY);
  return main();
}

/** After a confirmed money change: every wallet screen refetches what it shows (and, for transfers, the trading
 *  accounts' balances everywhere in the app). */
export function refreshWallet(accounts = false) {
  invalidate("wallet:");
  if (accounts) invalidate(ACCOUNTS_KEY);
}

/* ---- money actions (never optimistic) ---- */

export const createIntent = (chain: Chain, amount: string) => apiPost<{ intent: Intent }>("wallet/deposits/intents", { chain, amount });
export const submitDepositHash = (intentId: string, txHash: string) => apiPost<{ deposit: Deposit }>("wallet/deposits/submit", { intent_id: intentId, tx_hash: txHash.trim() });
export const quoteWithdrawal = (chain: Chain, amount: string, to: string, signal?: AbortSignal) => apiPost<{ quote: Quote }>("wallet/withdrawals/quote", { chain, amount, to_address: to.trim() }, { signal });
export const requestWithdrawal = (p: { chain: Chain; amount: string; to: string; key: string; stepupToken: string }) =>
  apiPost<{ withdrawal: Withdrawal }>("wallet/withdrawals", { chain: p.chain, amount: p.amount, to_address: p.to.trim(), idempotency_key: p.key, stepup_token: p.stepupToken }, { timeoutMs: 30_000 });
export const cancelWithdrawal = (id: number) => apiPost<{ withdrawal: Withdrawal }>(`wallet/withdrawals/${id}/cancel`, {});
export const transfer = (dir: "to" | "from", login: number, amount: string, key: string) =>
  apiPost<{ transfer: TradingTransfer }>(dir === "to" ? "wallet/transfers/to-trading" : "wallet/transfers/from-trading", { login, amount, idempotency_key: key }, { timeoutMs: 30_000 });

export type { ApiError, ApiResult };
