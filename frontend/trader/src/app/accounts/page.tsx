'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  ChevronDown,
  Pencil,
  TrendingDown,
  TrendingUp,
  ArrowLeftRight,
  BookOpen,
  ExternalLink,
  Trash2,
  Wallet,
  Landmark,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';
import { useTradingStore, type TradingAccount, type AccountGroupInfo } from '@/stores/tradingStore';
import {
  getPersistedTradingAccountId,
  setPersistedTradingAccountId,
  tradingTerminalUrl,
} from '@/lib/tradingNav';
import Modal from '@/components/ui/Modal';
import AccountTypePickerModal from '@/components/accounts/AccountTypePickerModal';

const ALIAS_PREFIX = 'ptd-account-alias:';

type TabId = 'accounts' | 'transfer';
type TransferEndKind = 'wallet' | 'trading';

interface AccountRow {
  id: string;
  account_number: string;
  balance: number;
  credit: number;
  equity: number;
  margin_used: number;
  free_margin: number;
  margin_level: number;
  leverage: number;
  currency: string;
  is_demo: boolean;
  account_group?: AccountGroupInfo | null;
  created_at?: string;
}

function fmt(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}

function readAlias(id: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(`${ALIAS_PREFIX}${id}`) || '';
  } catch {
    return '';
  }
}

function writeAlias(id: string, value: string) {
  try {
    const v = value.trim();
    if (v) localStorage.setItem(`${ALIAS_PREFIX}${id}`, v);
    else localStorage.removeItem(`${ALIAS_PREFIX}${id}`);
  } catch {
    /* ignore */
  }
}

function toTradingAccount(row: AccountRow): TradingAccount {
  return {
    id: row.id,
    account_number: row.account_number,
    balance: row.balance,
    credit: row.credit,
    equity: row.equity,
    margin_used: row.margin_used,
    free_margin: row.free_margin,
    margin_level: row.margin_level,
    leverage: row.leverage,
    currency: row.currency,
    is_demo: row.is_demo,
    account_group: row.account_group ?? null,
  };
}

const DEMO_FUNDING_MSG =
  'Demo accounts cannot transfer funds. Open a live account to move balance between accounts.';

export default function AccountsPage() {
  const user = useAuthStore((s) => s.user);
  const setStoreAccounts = useTradingStore((s) => s.setAccounts);
  const setActiveAccount = useTradingStore((s) => s.setActiveAccount);
  const removeAccount = useTradingStore((s) => s.removeAccount);

  const [tab, setTab] = useState<TabId>('accounts');
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadGen = useRef(0);

  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  /** After creating an account, open-account sets sessionStorage; expand that card on Accounts. */
  const [expandAccountId, setExpandAccountId] = useState<string | null>(null);
  const [fromKind, setFromKind] = useState<TransferEndKind>('trading');
  const [toKind, setToKind] = useState<TransferEndKind>('trading');
  const [mainWalletBalance, setMainWalletBalance] = useState(0);
  const [transferKindsInitialized, setTransferKindsInitialized] = useState(false);

  /** Unified transfer source/dest ID: 'wallet' or account UUID. */
  const [uniFrom, setUniFrom] = useState('wallet');
  const [uniTo, setUniTo] = useState('');
  const [uniInitialized, setUniInitialized] = useState(false);

  const fetchWalletSummary = useCallback(async () => {
    try {
      const s = await api.get<{ main_wallet_balance?: number }>('/wallet/summary');
      setMainWalletBalance(Number(s.main_wallet_balance) || 0);
    } catch {
      setMainWalletBalance(0);
    }
  }, []);

  const fetchAccounts = useCallback(async (signal?: AbortSignal) => {
    const id = ++loadGen.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<any>('/accounts', undefined, { signal });
      if (id !== loadGen.current) return;
      const list: AccountRow[] = Array.isArray(res) ? res : (res?.items ?? []);
      setRows(list);
      const tradingList = list.map(toTradingAccount);
      setStoreAccounts(tradingList);
    } catch (e) {
      if (id !== loadGen.current) return;
      const msg = e instanceof Error ? e.message : 'Failed to load accounts';
      setError(msg);
      toast.error(msg);
    } finally {
      if (id === loadGen.current) setLoading(false);
    }
  }, [setStoreAccounts]);

  useEffect(() => {
    const ac = new AbortController();
    void fetchAccounts(ac.signal);
    return () => {
      ac.abort();
      loadGen.current += 1;
    };
  }, [fetchAccounts]);

  useEffect(() => {
    if (loading || rows.length === 0) return;
    let id: string | null = null;
    try {
      id = sessionStorage.getItem('ptd-accounts-expand');
    } catch {
      /* ignore */
    }
    if (!id) return;
    if (!rows.some((r) => r.id === id)) return;
    setExpandAccountId(id);
    try {
      sessionStorage.removeItem('ptd-accounts-expand');
    } catch {
      /* ignore */
    }
  }, [loading, rows]);

  useEffect(() => {
    if (!expandAccountId) return;
    const el = document.getElementById(`account-card-${expandAccountId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [expandAccountId]);

  useEffect(() => {
    if (tab !== 'transfer' || user?.is_demo) return;
    void fetchWalletSummary();
  }, [tab, user?.is_demo, fetchWalletSummary]);

  const demoFundingBlocked = rows.length > 0 && !rows.some((a) => !a.is_demo);
  const liveAccounts = useMemo(() => rows.filter((a) => !a.is_demo), [rows]);

  useEffect(() => {
    if (loading || transferKindsInitialized) return;
    if (liveAccounts.length >= 2) {
      setFromKind('trading');
      setToKind('trading');
    } else if (liveAccounts.length === 1) {
      setFromKind('wallet');
      setToKind('trading');
    }
    setTransferKindsInitialized(true);
  }, [loading, liveAccounts.length, transferKindsInitialized]);

  useEffect(() => {
    if (liveAccounts.length < 2 && fromKind === 'trading' && toKind === 'trading') {
      setFromKind('wallet');
      setToKind('trading');
    }
  }, [liveAccounts.length, fromKind, toKind]);

  const visibleRows = useMemo(() => {
    if (user?.is_demo) return rows.filter((a) => a.is_demo);
    return rows;
  }, [rows, user?.is_demo]);

  /** Sync store + session before opening terminal (navigation via `<Link href>` so clicks always work). */
  const prepareTradeSession = (row: AccountRow) => {
    setActiveAccount(toTradingAccount(row));
    setPersistedTradingAccountId(row.id);
  };

  const handleAccountRemoved = (id: string) => {
    removeAccount(id);
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      setStoreAccounts(next.map(toTradingAccount));
      return next;
    });
    if (getPersistedTradingAccountId() === id) setPersistedTradingAccountId(null);
  };

  const pickFromKind = (k: TransferEndKind) => {
    if (k === 'wallet' && toKind === 'wallet') setToKind('trading');
    setFromKind(k);
  };

  const pickToKind = (k: TransferEndKind) => {
    if (k === 'wallet' && fromKind === 'wallet') setFromKind('trading');
    setToKind(k);
  };

  const fromWalletDisabled = toKind === 'wallet';
  const fromTradingDisabled = toKind === 'trading' && liveAccounts.length < 2;
  const toWalletDisabled = fromKind === 'wallet';
  const toTradingDisabled = fromKind === 'trading' && liveAccounts.length < 2;

  const effectiveFromId = transferFrom || liveAccounts[0]?.id || '';
  const effectiveToId = useMemo(() => {
    if (transferTo && transferTo !== effectiveFromId) return transferTo;
    const other = liveAccounts.find((a) => a.id !== effectiveFromId);
    return other?.id || liveAccounts[0]?.id || '';
  }, [transferTo, effectiveFromId, liveAccounts]);

  const maxTransferAmount = useMemo(() => {
    if (fromKind === 'wallet') return Math.max(0, mainWalletBalance);
    const a = liveAccounts.find((x) => x.id === effectiveFromId);
    if (!a) return 0;
    return Math.max(0, Number(a.free_margin ?? 0));
  }, [fromKind, mainWalletBalance, liveAccounts, effectiveFromId]);

  /* ── Unified transfer helpers ── */
  useEffect(() => {
    if (uniInitialized || loading) return;
    if (liveAccounts.length >= 2) {
      setUniFrom(liveAccounts[0].id);
      setUniTo(liveAccounts[1].id);
    } else if (liveAccounts.length === 1) {
      setUniFrom('wallet');
      setUniTo(liveAccounts[0].id);
    }
    setUniInitialized(true);
  }, [loading, liveAccounts, uniInitialized]);

  /** All selectable options: wallet + each live account */
  const transferOptions = useMemo(() => {
    const opts: Array<{ id: string; label: string; sublabel: string; balance: number }> = [
      { id: 'wallet', label: 'Main Wallet', sublabel: 'Wallet', balance: mainWalletBalance },
    ];
    for (const a of liveAccounts) {
      opts.push({
        id: a.id,
        label: `#${a.account_number}`,
        sublabel: a.account_group?.name ?? 'Live',
        balance: Number(a.free_margin ?? a.balance ?? 0),
      });
    }
    return opts;
  }, [liveAccounts, mainWalletBalance]);

  const uniFromBalance = useMemo(() => {
    if (uniFrom === 'wallet') return mainWalletBalance;
    const a = liveAccounts.find((x) => x.id === uniFrom);
    return a ? Math.max(0, Number(a.free_margin ?? 0)) : 0;
  }, [uniFrom, liveAccounts, mainWalletBalance]);

  const swapFromTo = () => {
    const prev = uniFrom;
    setUniFrom(uniTo);
    setUniTo(prev);
  };

  const submitUnifiedTransfer = async () => {
    if (demoFundingBlocked) { toast.error(DEMO_FUNDING_MSG); return; }
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (uniFrom === uniTo) { toast.error('Select different source and destination'); return; }
    if (uniFrom === 'wallet' && uniTo === 'wallet') { toast.error('Cannot transfer wallet to wallet'); return; }
    if (amt > uniFromBalance + 1e-9) { toast.error('Insufficient balance'); return; }

    setTransferSubmitting(true);
    try {
      if (uniFrom === 'wallet') {
        await api.post('/wallet/transfer-main-to-trading', { to_account_id: uniTo, amount: amt });
        const num = liveAccounts.find((a) => a.id === uniTo)?.account_number ?? '';
        toast.success(`Sent ${fmt(amt)} to account ${num}`);
      } else if (uniTo === 'wallet') {
        await api.post('/wallet/transfer-trading-to-main', { from_account_id: uniFrom, amount: amt });
        toast.success(`Moved ${fmt(amt)} to your wallet`);
      } else {
        await api.post('/wallet/transfer-internal', { from_account_id: uniFrom, to_account_id: uniTo, amount: amt });
        const toNum = liveAccounts.find((a) => a.id === uniTo)?.account_number ?? '';
        toast.success(`Moved ${fmt(amt)} to ${toNum}`);
      }
      setTransferAmount('');
      void fetchAccounts();
      void fetchWalletSummary();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setTransferSubmitting(false);
    }
  };

  const submitTransfer = async () => {
    if (demoFundingBlocked) {
      toast.error(DEMO_FUNDING_MSG);
      return;
    }
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (fromKind === 'wallet' && toKind === 'wallet') {
      toast.error('Select a trading account on one side');
      return;
    }

    const fromId = transferFrom || liveAccounts[0]?.id || '';
    const toId =
      transferTo ||
      liveAccounts.find((a) => a.id !== fromId)?.id ||
      liveAccounts[0]?.id ||
      '';

    setTransferSubmitting(true);
    try {
      if (fromKind === 'wallet' && toKind === 'trading') {
        const tid = toId || liveAccounts[0]?.id;
        if (!tid) {
          toast.error('Select a trading account');
          return;
        }
        if (amt > mainWalletBalance + 1e-9) {
          toast.error('Insufficient wallet balance');
          return;
        }
        await api.post('/wallet/transfer-main-to-trading', { to_account_id: tid, amount: amt });
        const num = liveAccounts.find((a) => a.id === tid)?.account_number ?? '';
        toast.success(`Sent ${fmt(amt)} to account ${num}`);
      } else if (fromKind === 'trading' && toKind === 'wallet') {
        if (!fromId) {
          toast.error('Select a trading account');
          return;
        }
        const acc = liveAccounts.find((a) => a.id === fromId);
        const avail = acc ? Math.max(0, Number(acc.free_margin ?? 0)) : 0;
        if (amt > avail + 1e-9) {
          toast.error('Insufficient available balance on that account');
          return;
        }
        await api.post('/wallet/transfer-trading-to-main', { from_account_id: fromId, amount: amt });
        toast.success(`Moved ${fmt(amt)} to your wallet`);
      } else {
        if (!fromId || !toId) {
          toast.error('You need two live accounts to transfer between them');
          return;
        }
        if (fromId === toId) {
          toast.error('Choose two different accounts');
          return;
        }
        const acc = liveAccounts.find((a) => a.id === fromId);
        const avail = acc ? Math.max(0, Number(acc.free_margin ?? 0)) : 0;
        if (amt > avail + 1e-9) {
          toast.error('Insufficient available balance on the source account');
          return;
        }
        await api.post('/wallet/transfer-internal', {
          from_account_id: fromId,
          to_account_id: toId,
          amount: amt,
        });
        const toNum = liveAccounts.find((a) => a.id === toId)?.account_number ?? '';
        toast.success(`Moved ${fmt(amt)} to ${toNum}`);
      }
      setTransferAmount('');
      void fetchAccounts();
      void fetchWalletSummary();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setTransferSubmitting(false);
    }
  };

  const newAccountCtaClass =
    'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border-2 border-[#00e676] text-[#00e676] text-sm font-bold hover:bg-[#00e676]/10 transition-colors shrink-0';

  return (
    <DashboardShell>
      <AccountTypePickerModal
        open={accountPickerOpen}
        onClose={() => setAccountPickerOpen(false)}
        onCreated={() => void fetchAccounts()}
      />
      <div className="page-main max-w-6xl mx-auto w-full space-y-6">
        {/* Accounts / Internal Transfer — same curved slide + glow as Wallet tabs, slightly taller */}
        <div className="relative mb-8 w-full">
          <div className="overflow-hidden rounded-xl border border-border-primary bg-card">
            <div className="relative flex min-h-[64px] sm:min-h-[100px] bg-card">
              <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
                <div
                  className="absolute top-0 h-full w-1/2 transition-[transform] duration-500 ease-[cubic-bezier(0.34,1.45,0.64,1)] will-change-transform"
                  style={{
                    transform: tab === 'accounts' ? 'translate3d(0,0,0)' : 'translate3d(100%,0,0)',
                  }}
                >
                  <div
                    className={clsx(
                      'absolute inset-x-0 top-0 h-full rounded-t-[2.5rem] border-2 border-b-0 border-accent bg-card-nested',
                      'animate-wallet-main-tab-glow',
                    )}
                  />
                </div>
              </div>
              {(
                [
                  { id: 'accounts' as const, label: 'Accounts' },
                  { id: 'transfer' as const, label: 'Internal Transfer' },
                ] as const
              ).map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.id)}
                    className={clsx(
                      'relative z-10 flex-1 border-0 bg-transparent px-4 py-5 text-center text-sm font-semibold outline-none sm:py-7 sm:text-lg',
                      'transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/50',
                      active ? 'text-accent' : 'text-text-secondary hover:text-text-primary',
                    )}
                  >
                    {active ? (
                      <span
                        key={tab}
                        className="relative inline-block animate-wallet-main-tab-text drop-shadow-[0_0_20px_rgba(0,230,118,0.7)]"
                      >
                        {t.label}
                      </span>
                    ) : (
                      <span className="relative inline-block">{t.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {tab === 'accounts' && (
          <div key="tab-accounts" className="animate-wallet-fund-enter-lg">
            {/* Outer shell — nested cards open inside; soft green light pulse like wallet tabs */}
            <div className="relative overflow-hidden rounded-2xl border border-border-primary bg-card">
              <div
                className="pointer-events-none absolute inset-0 z-0 rounded-2xl opacity-[0.28] animate-wallet-main-tab-glow"
                aria-hidden
              />
              <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-px bg-gradient-to-r from-transparent via-accent/35 to-transparent" aria-hidden />
              <div className="relative z-[1] space-y-6 p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
                      Trading Accounts
                    </h1>
                    <p className="mt-1 text-sm text-text-secondary">Manage your trading accounts</p>
                  </div>
                  {user?.is_demo ? (
                    <Link href="/trading/open-account" className={newAccountCtaClass}>
                      <span className="text-lg leading-none">+</span>
                      New Account
                    </Link>
                  ) : (
                    <button type="button" onClick={() => setAccountPickerOpen(true)} className={newAccountCtaClass}>
                      <span className="text-lg leading-none">+</span>
                      New Account
                    </button>
                  )}
                </div>

                {loading && (
                  <div className="flex flex-col items-center gap-3 py-16">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                    <span className="text-sm text-text-secondary">Loading accounts…</span>
                  </div>
                )}

                {!loading && error && (
                  <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-center">
                    <p className="text-sm text-red-400">{error}</p>
                    <Button variant="outline" size="sm" onClick={() => void fetchAccounts()}>
                      Retry
                    </Button>
                  </div>
                )}

                {!loading && !error && visibleRows.length === 0 && (
                  <div className="space-y-4 rounded-xl border border-border-primary bg-card-nested p-8 text-center">
                    <p className="text-sm text-text-secondary">
                      {user?.is_demo
                        ? 'No demo trading account is linked yet.'
                        : 'You do not have a trading account yet. Open one to start.'}
                    </p>
                    {!user?.is_demo && (
                      <button
                        type="button"
                        onClick={() => setAccountPickerOpen(true)}
                        className="inline-flex items-center justify-center rounded-lg border-2 border-accent px-5 py-2.5 text-sm font-bold text-accent hover:bg-accent/10"
                      >
                        + New Account
                      </button>
                    )}
                  </div>
                )}

                {!loading && !error && visibleRows.length > 0 && (
                  <ul className="space-y-3">
                    {visibleRows.map((row) => (
                      <AccountCard
                        key={row.id}
                        row={row}
                        initialExpanded={row.id === expandAccountId}
                        tradeHref={tradingTerminalUrl(row.id, { view: 'chart' })}
                        onTradePrepare={() => prepareTradeSession(row)}
                        onRemoved={handleAccountRemoved}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'transfer' && (
          <div
            key="tab-transfer"
            className="w-full max-w-full animate-wallet-fund-enter-lg space-y-6"
          >
            <div className="rounded-2xl border border-[#00e676]/20 bg-gradient-to-b from-[#141414] to-[#0c0c0c] p-5 sm:p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_20px_50px_rgba(0,0,0,0.45)]">
              <div className="flex items-start gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-[#00e676]/15 border border-[#00e676]/35 flex items-center justify-center shrink-0 text-[#00e676]">
                  <ArrowLeftRight size={22} strokeWidth={2.25} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Internal Transfer</h1>
                  <p className="text-sm text-white/80 mt-1 leading-relaxed max-w-prose">
                    Move funds between your main wallet and live trading accounts, or between accounts.
                  </p>
                </div>
              </div>

              {demoFundingBlocked && (
                <div className="mb-5 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
                  {DEMO_FUNDING_MSG}
                </div>
              )}

              {liveAccounts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#3a3a3a] bg-[#0a0a0a] px-5 py-10 text-center">
                  <p className="text-sm text-white/80 mb-4">No live trading accounts yet. Open one to deposit and transfer.</p>
                  {!user?.is_demo && (
                    <button
                      type="button"
                      onClick={() => {
                        setTab('accounts');
                        setAccountPickerOpen(true);
                      }}
                      className="text-sm font-bold text-[#00e676] hover:underline"
                    >
                      Open live account
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* ── FROM ── */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-white/50">From</p>
                    <select
                      value={uniFrom}
                      onChange={(e) => {
                        const v = e.target.value;
                        setUniFrom(v);
                        if (uniTo === v) {
                          const alt = transferOptions.find((o) => o.id !== v);
                          if (alt) setUniTo(alt.id);
                        }
                      }}
                      className="accounts-native-select w-full px-4 py-3 rounded-xl text-sm font-semibold"
                    >
                      {transferOptions.map((o) => (
                        <option key={o.id} value={o.id} disabled={o.id === uniTo}>
                          {o.label} — {o.sublabel} — {fmt(o.balance)}
                        </option>
                      ))}
                    </select>
                    {/* From card */}
                    {(() => {
                      const opt = transferOptions.find((o) => o.id === uniFrom);
                      if (!opt) return null;
                      const isWallet = uniFrom === 'wallet';
                      return (
                        <div className="rounded-xl border border-[#00e676]/35 bg-[#0a0a0a] p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#00e676]/12 flex items-center justify-center text-[#00e676] shrink-0">
                            {isWallet ? <Wallet size={20} strokeWidth={2} /> : <Landmark size={20} strokeWidth={2} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-white">{opt.label}</div>
                            <div className="text-[10px] uppercase tracking-wide text-white/50 font-semibold mt-0.5">
                              {isWallet ? 'Balance' : 'Available'}
                            </div>
                          </div>
                          <div className="text-xl font-bold text-[#00e676] tabular-nums font-mono shrink-0">
                            {fmt(opt.balance)}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* ── SWAP BUTTON ── */}
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={swapFromTo}
                      className="group w-10 h-10 rounded-full border border-[#00e676]/30 bg-[#0a0a0a] flex items-center justify-center text-[#00e676]/80 hover:bg-[#00e676]/10 hover:border-[#00e676]/60 transition-all active:scale-95"
                      title="Swap direction"
                    >
                      <ArrowLeftRight size={16} className="rotate-90 group-hover:scale-110 transition-transform" />
                    </button>
                  </div>

                  {/* ── TO ── */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-white/50">To</p>
                    <select
                      value={uniTo}
                      onChange={(e) => {
                        const v = e.target.value;
                        setUniTo(v);
                        if (uniFrom === v) {
                          const alt = transferOptions.find((o) => o.id !== v);
                          if (alt) setUniFrom(alt.id);
                        }
                      }}
                      className="accounts-native-select w-full px-4 py-3 rounded-xl text-sm font-semibold"
                    >
                      {transferOptions
                        .filter((o) => o.id !== uniFrom)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label} — {o.sublabel} — {fmt(o.balance)}
                          </option>
                        ))}
                    </select>
                    {/* To card */}
                    {(() => {
                      const opt = transferOptions.find((o) => o.id === uniTo);
                      if (!opt) return null;
                      const isWallet = uniTo === 'wallet';
                      return (
                        <div className="rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#00e676]/12 flex items-center justify-center text-[#00e676] shrink-0">
                            {isWallet ? <Wallet size={20} strokeWidth={2} /> : <Landmark size={20} strokeWidth={2} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-white">{opt.label}</div>
                            <div className="text-[10px] uppercase tracking-wide text-white/50 font-semibold mt-0.5">
                              {isWallet ? 'Wallet' : 'Balance'}
                            </div>
                          </div>
                          <div className="text-lg font-bold text-white tabular-nums font-mono shrink-0">
                            {fmt(opt.balance)}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* ── AMOUNT ── */}
                  <div className="pt-3 space-y-2 border-t border-[#2a2a2a]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-sm font-medium text-white/95">Amount</label>
                      <button
                        type="button"
                        onClick={() =>
                          setTransferAmount(uniFromBalance > 0 ? uniFromBalance.toFixed(2) : '')
                        }
                        disabled={uniFromBalance <= 0}
                        className="text-sm font-bold text-[#00e676] hover:underline disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Max: {fmt(uniFromBalance)}
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-3.5 rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] font-mono font-semibold text-white text-base placeholder:text-[#555] focus:outline-none focus:ring-2 focus:ring-[#00e676]/40 focus:border-[#00e676]/50"
                    />
                  </div>

                  {/* ── SUBMIT ── */}
                  <button
                    type="button"
                    onClick={() => void submitUnifiedTransfer()}
                    disabled={
                      demoFundingBlocked ||
                      transferSubmitting ||
                      !transferAmount.trim() ||
                      uniFromBalance <= 0 ||
                      uniFrom === uniTo
                    }
                    className="w-full py-3.5 rounded-xl bg-[#00e676] text-black text-base font-bold hover:bg-[#00c853] disabled:opacity-45 disabled:pointer-events-none transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowLeftRight size={20} />
                    {transferSubmitting ? 'Transferring…' : 'Transfer'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

const TREND_TABS = ['24H', '7D', '30D', '90D', '1Y'] as const;

function formatCreated(d?: string) {
  if (!d) return '—';
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(t);
}

function BalanceTrendBlock() {
  const [tab, setTab] = useState<(typeof TREND_TABS)[number]>('7D');
  return (
    <div className="min-w-0">
      <div className="text-[13px] font-medium text-white/70 mb-2">Balance trend</div>
      <div className="flex flex-wrap gap-1 mb-2">
        {TREND_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={clsx(
              'px-2 py-1 rounded-md text-[10px] font-bold transition-colors',
              tab === t ? 'bg-[#00e676]/20 text-[#00e676] border border-[#00e676]/40' : 'text-white/70 border border-transparent hover:bg-white/5',
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="h-28 sm:h-32 rounded-xl bg-[#0a0a0a] border border-[#2a2a2a] relative overflow-hidden">
        <svg className="absolute inset-2 w-[calc(100%-1rem)] h-[calc(100%-1rem)]" preserveAspectRatio="none">
          <defs>
            <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#222" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" opacity={0.6} />
          <line x1="0%" y1="55%" x2="100%" y2="55%" stroke="#f97316" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute bottom-2 right-2 text-[10px] text-[#555]">{tab} · demo</span>
      </div>
    </div>
  );
}

function AccountCard({
  row,
  initialExpanded = false,
  tradeHref,
  onTradePrepare,
  onRemoved,
}: {
  row: AccountRow;
  initialExpanded?: boolean;
  tradeHref: string;
  onTradePrepare: () => void;
  onRemoved: (id: string) => void;
}) {
  const [open, setOpen] = useState(initialExpanded);
  const [aliasDraft, setAliasDraft] = useState('');
  const [editingAlias, setEditingAlias] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setAliasDraft(readAlias(row.id));
  }, [row.id]);

  useEffect(() => {
    if (initialExpanded) setOpen(true);
  }, [initialExpanded]);

  const alias = readAlias(row.id);
  const pnl = row.equity - row.balance;
  const pct =
    row.balance > 0 && Number.isFinite(row.equity) ? (row.equity / row.balance - 1) * 100 : 0;
  const pnlPositive = pnl >= 0;
  const idLabel = row.is_demo ? `#D#${row.account_number}` : `#L#${row.account_number}`;

  const confirmCloseAccount = async () => {
    setDeleting(true);
    try {
      await api.delete(`/accounts/${row.id}`);
      toast.success(row.is_demo ? 'Demo account removed.' : 'Account closed.');
      setCloseModal(false);
      onRemoved(row.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not close account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <li
      id={`account-card-${row.id}`}
      className={clsx(
        'relative overflow-hidden rounded-xl border bg-card-nested transition-[box-shadow,border-color] duration-300',
        open
          ? 'animate-wallet-neon-tab border-accent/40 shadow-[0_0_32px_rgba(0,230,118,0.14)]'
          : 'border-border-primary hover:border-accent/25 hover:shadow-[0_0_24px_rgba(0,230,118,0.08)]',
      )}
    >
      <div className="relative z-[1] flex w-full items-start gap-3 px-5 py-5 transition-colors hover:bg-white/[0.02]">
        <span
          className={clsx(
            'mt-1.5 h-2.5 w-2.5 rounded-full shrink-0',
            row.is_demo ? 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.7)]' : 'bg-[#00e676] shadow-[0_0_6px_rgba(0,230,118,0.7)]',
          )}
          aria-hidden
        />
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpen((o) => !o);
            }
          }}
          role="button"
          tabIndex={0}
          aria-expanded={open}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-4">
            <span className="text-base font-bold text-white">
              {row.is_demo
                ? 'Demo Account'
                : row.account_number.startsWith('PM')
                  ? 'PAMM Pool Account'
                  : row.account_number.startsWith('MM')
                    ? 'MAM Pool Account'
                    : row.account_number.startsWith('CT')
                      ? 'Copy Trade Pool Account'
                      : row.account_number.startsWith('CF')
                        ? 'Copy Trade Account'
                        : row.account_number.startsWith('IF')
                          ? 'Investment Account'
                          : 'Live Account'}
            </span>
            {(() => {
              const n = row.account_number;
              const badge = n.startsWith('PM') ? { label: 'PAMM Pool', color: 'purple' }
                : n.startsWith('MM') ? { label: 'MAM Pool', color: 'blue' }
                : n.startsWith('CT') ? { label: 'Copy Pool', color: 'emerald' }
                : n.startsWith('CF') ? { label: 'Copy Fund', color: 'teal' }
                : n.startsWith('IF') ? { label: 'Investment', color: 'amber' }
                : null;
              if (!badge) return null;
              const colors: Record<string, string> = {
                purple: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
                blue: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
                emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
                teal: 'bg-teal-500/15 text-teal-400 border-teal-500/25',
                amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
              };
              return (
                <span className={clsx('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border', colors[badge.color])}>
                  {badge.label}
                </span>
              );
            })()}
            <span className="text-sm text-white/60 font-mono">{idLabel}</span>
            {!editingAlias ? (
              <span className="inline-flex items-center gap-1 text-sm text-text-secondary" onClick={(e) => e.stopPropagation()}>
                {alias ? (
                  <>
                    <span className="text-white/90">{alias}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAliasDraft(alias);
                        setEditingAlias(true);
                      }}
                      className="rounded p-0.5 text-accent hover:bg-accent/10"
                      aria-label="Edit label"
                    >
                      <Pencil size={14} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAliasDraft('');
                      setEditingAlias(true);
                    }}
                    className="font-semibold text-accent/90 hover:text-accent hover:underline"
                  >
                    + Add label
                  </button>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  value={aliasDraft}
                  onChange={(e) => setAliasDraft(e.target.value)}
                  placeholder="Alias"
                  className="px-2 py-1 rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] text-sm text-white w-36 max-w-[50vw]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      writeAlias(row.id, aliasDraft);
                      setEditingAlias(false);
                    }
                    if (e.key === 'Escape') setEditingAlias(false);
                  }}
                />
                <button
                  type="button"
                  className="text-xs text-[#00e676] font-semibold"
                  onClick={() => {
                    writeAlias(row.id, aliasDraft);
                    setEditingAlias(false);
                  }}
                >
                  Save
                </button>
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
            <div>
              <div className="text-xs text-text-secondary mb-1">Balance</div>
              <div className="text-sm sm:text-lg font-bold text-white tabular-nums">
                {fmt(row.balance, row.currency)}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-secondary mb-1">Equity</div>
              <div className="text-sm sm:text-lg font-bold text-white tabular-nums">
                {fmt(row.equity, row.currency)}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-secondary mb-1">P&amp;L</div>
              <div className="flex items-center gap-1">
                {pnlPositive ? <TrendingUp size={14} className="shrink-0 text-[#00e676]" /> : <TrendingDown size={14} className="shrink-0 text-red-400" />}
                <span className={clsx('text-sm sm:text-lg font-bold tabular-nums', pnlPositive ? 'text-[#00e676]' : 'text-red-400')}>
                  {pnlPositive ? '+' : ''}{fmt(pnl, row.currency)}
                </span>
              </div>
              <div className={clsx('text-xs font-semibold tabular-nums', pnlPositive ? 'text-[#00e676]' : 'text-red-400')}>
                ({pnlPositive ? '+' : ''}{pct.toFixed(2)}%)
              </div>
            </div>
            <div>
              <div className="text-xs text-text-secondary mb-1">Leverage</div>
              <div className="text-sm sm:text-lg font-bold text-white tabular-nums">1:{row.leverage}</div>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-white/65 shrink-0 mt-1 p-1 rounded-md hover:bg-white/5 hover:text-white"
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          <ChevronDown size={20} className={clsx('transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {open && (
        <div className="space-y-5 border-t border-border-primary bg-bg-base/40 px-5 pb-5 pt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
            <BalanceTrendBlock />
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-white/60 text-[13px]">Free margin</span>
                  <div className="font-mono text-base text-white font-semibold">{fmt(row.free_margin, row.currency)}</div>
                </div>
                <div>
                  <span className="text-white/60 text-[13px]">Margin level</span>
                  <div className="font-mono text-base text-white font-semibold">
                    {Number.isFinite(row.margin_level) && row.margin_level > 0
                      ? `${row.margin_level.toFixed(2)}%`
                      : '0.00%'}
                  </div>
                </div>
                <div>
                  <span className="text-white/60 text-[13px]">Margin used</span>
                  <div className="font-mono text-base text-white font-semibold">{fmt(row.margin_used, row.currency)}</div>
                </div>
                <div>
                  <span className="text-white/60 text-[13px]">Currency</span>
                  <div className="font-mono text-base text-white font-semibold">{row.currency}</div>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-white/60 text-[13px]">Created</span>
                  <div className="text-base text-white font-semibold">{formatCreated(row.created_at)}</div>
                </div>
                {row.account_group?.name ? (
                  <div className="sm:col-span-2">
                    <span className="text-white/60 text-[13px]">Account type</span>
                    <div className="text-base text-white font-semibold">{row.account_group.name}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {(() => {
            const isManagedAccount = row.account_number.startsWith('IF') || row.account_number.startsWith('CF');
            const isPoolAccount = row.account_number.startsWith('PM') || row.account_number.startsWith('MM') || row.account_number.startsWith('CT');
            return (
              <div className="relative z-[60] flex flex-col sm:flex-row flex-wrap gap-2 pt-1">
                {isManagedAccount ? (
                  /* Investment / Copy Fund accounts — view-only, no trading */
                  <>
                    <Link
                      href={`/portfolio?account_id=${encodeURIComponent(row.id)}&account_no=${encodeURIComponent(row.account_number)}&tab=history`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#00e676] text-black text-sm font-bold hover:bg-[#00c853] transition-colors"
                    >
                      <BookOpen size={16} />
                      View Trades
                    </Link>
                    <div className="rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] px-4 py-2.5 text-xs text-[#666] flex items-center gap-2 sm:ml-auto">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      {row.account_number.startsWith('IF') ? 'Managed by PAMM master' : 'Managed by Copy master'}
                    </div>
                  </>
                ) : isPoolAccount ? (
                  /* Pool accounts — master can trade */
                  <>
                    <Link
                      href={`/portfolio?account_id=${encodeURIComponent(row.id)}&account_no=${encodeURIComponent(row.account_number)}&tab=history`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#444] text-white text-sm font-semibold hover:border-[#666] hover:bg-white/5 transition-colors"
                    >
                      <BookOpen size={16} />
                      Trade History
                    </Link>
                    <Link
                      href={tradeHref}
                      prefetch
                      onClick={(e) => { e.stopPropagation(); onTradePrepare(); }}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#00e676] text-black text-sm font-bold hover:bg-[#00c853] transition-colors"
                    >
                      <ExternalLink size={16} />
                      Trade (Master)
                    </Link>
                  </>
                ) : (
                  /* Normal live/demo accounts */
                  <>
                    <Link
                      href={`/portfolio?account_id=${encodeURIComponent(row.id)}&account_no=${encodeURIComponent(row.account_number)}&tab=history`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#444] text-white text-sm font-semibold hover:border-[#666] hover:bg-white/5 transition-colors"
                    >
                      <BookOpen size={16} />
                      Trading journal
                    </Link>
                    <Link
                      href={tradeHref}
                      prefetch
                      onClick={(e) => { e.stopPropagation(); onTradePrepare(); }}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#00e676] text-black text-sm font-bold hover:bg-[#00c853] transition-colors"
                    >
                      <ExternalLink size={16} />
                      Trade
                    </Link>
                    <button
                      type="button"
                      onClick={() => setCloseModal(true)}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors sm:ml-auto"
                    >
                      <Trash2 size={16} />
                      Close account
                    </button>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      <Modal open={closeModal} onClose={() => !deleting && setCloseModal(false)} title="Close account">
        <div className="p-4 space-y-4">
          <p className="text-sm text-text-secondary">
            Permanently remove trading account <span className="font-mono font-semibold">{row.account_number}</span>
            ? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={deleting} onClick={() => setCloseModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleting}
              onClick={() => void confirmCloseAccount()}
            >
              {deleting ? 'Closing…' : 'Close account'}
            </Button>
          </div>
        </div>
      </Modal>
    </li>
  );
}
