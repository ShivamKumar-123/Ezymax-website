'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, ArrowDownCircle, ArrowUpCircle, CreditCard, DollarSign,
  Loader2, Mail, MapPin, Phone, Shield, UserRound, Wallet, Activity,
  TrendingUp, TrendingDown, History as HistoryIcon, Receipt,
} from 'lucide-react';

// Per-user comprehensive ledger view. The page is tabbed so the load
// stays cheap (each tab fetches its own data lazily) and the admin can
// jump between Overview, Open Positions, Trade History, Transactions,
// Deposits, and Withdrawals without leaving the user context. Backend
// endpoints honour `?user_id=` for everything we render here.

type TabId = 'overview' | 'positions' | 'trades' | 'transactions' | 'deposits' | 'withdrawals';

interface UserDetail {
  user: {
    id: string;
    email: string;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
    country: string | null;
    address: string | null;
    role: string;
    status: string;
    kyc_status: string;
    is_demo: boolean;
    created_at: string | null;
  };
  accounts: {
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
    is_active: boolean;
  }[];
  total_deposit: number;
  total_withdrawal: number;
  total_trades: number;
  open_positions: number;
}

interface Position {
  id: string;
  instrument_symbol: string | null;
  side: string;
  status: string;
  lots: number;
  open_price: number;
  close_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  profit: number;
  account_number?: string | null;
  is_admin_modified?: boolean;
  created_at: string | null;
}

interface TradeHistoryRow {
  id: string;
  instrument_symbol: string | null;
  side: string;
  lots: number;
  open_price: number;
  close_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  swap: number;
  commission: number;
  profit: number;
  close_reason: string | null;
  opened_at: string | null;
  closed_at: string | null;
  account_number?: string | null;
}

interface TxRow {
  id: string;
  type: string;
  amount: number;
  balance_after: number | null;
  description: string | null;
  account_number?: string | null;
  admin_email?: string | null;
  created_at: string | null;
}

interface DepositRow {
  id: string;
  amount: number;
  method: string | null;
  status: string;
  transaction_id?: string | null;
  crypto_address?: string | null;
  created_at: string | null;
}

interface WithdrawalRow {
  id: string;
  amount: number;
  method: string | null;
  status: string;
  crypto_address?: string | null;
  wallet_chain_snapshot?: string | null;
  crypto_tx_hash?: string | null;
  created_at: string | null;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return d; }
}

function statusColor(s: string) {
  switch (s?.toLowerCase()) {
    case 'active': case 'approved': case 'auto_approved': case 'paid': case 'completed':
      return 'bg-success/15 text-success';
    case 'banned': case 'suspended': case 'rejected': case 'failed':
      return 'bg-danger/15 text-danger';
    case 'pending': case 'submitted':
      return 'bg-warning/15 text-warning';
    default:
      return 'bg-text-tertiary/15 text-text-tertiary';
  }
}

function kycColor(k: string) {
  switch (k?.toLowerCase()) {
    case 'verified': case 'approved': return 'bg-success/15 text-success';
    case 'pending': return 'bg-warning/15 text-warning';
    case 'rejected': return 'bg-danger/15 text-danger';
    default: return 'bg-text-tertiary/15 text-text-tertiary';
  }
}

function typeColor(t: string) {
  const x = (t || '').toLowerCase();
  if (x === 'deposit') return 'bg-success/15 text-success';
  if (x === 'withdrawal') return 'bg-danger/15 text-danger';
  if (x === 'profit') return 'bg-emerald-500/15 text-emerald-400';
  if (x === 'loss') return 'bg-rose-500/15 text-rose-400';
  if (x === 'bonus' || x === 'bonus_release' || x === 'credit') return 'bg-buy/15 text-buy';
  if (x === 'adjustment' || x === 'admin_commission') return 'bg-warning/15 text-warning';
  if (x === 'transfer') return 'bg-text-tertiary/15 text-text-secondary';
  return 'bg-text-tertiary/15 text-text-tertiary';
}

const TABS: { id: TabId; label: string; icon: typeof UserRound }[] = [
  { id: 'overview', label: 'Overview', icon: UserRound },
  { id: 'positions', label: 'Open Positions', icon: Activity },
  { id: 'trades', label: 'Trade History', icon: HistoryIcon },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'deposits', label: 'Deposits', icon: ArrowDownCircle },
  { id: 'withdrawals', label: 'Withdrawals', icon: ArrowUpCircle },
];

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Per-tab data + loading flags. Each tab fetches once per visit;
  // tab switch refetches so admin always sees fresh state.
  const [positions, setPositions] = useState<Position[]>([]);
  const [posLoading, setPosLoading] = useState(false);
  const [trades, setTrades] = useState<TradeHistoryRow[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [depLoading, setDepLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [wdLoading, setWdLoading] = useState(false);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.get<UserDetail>(`/users/${userId}`);
      setData(res);
    } catch (e: any) {
      setError(e.message || 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const fetchPositions = useCallback(async () => {
    setPosLoading(true);
    try {
      const res = await adminApi.get<any>('/trades/positions', { user_id: userId, status: 'open', per_page: '100' });
      setPositions(res.items || res.positions || []);
    } catch { setPositions([]); } finally { setPosLoading(false); }
  }, [userId]);

  const fetchTrades = useCallback(async () => {
    setTradesLoading(true);
    try {
      const res = await adminApi.get<any>('/trades/history', { user_id: userId, per_page: '100' });
      setTrades(res.items || res.trades || []);
    } catch { setTrades([]); } finally { setTradesLoading(false); }
  }, [userId]);

  const fetchTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      // include_trade_pnl=true so the per-user ledger truly shows
      // EVERYTHING (deposits + withdrawals + transfers + profits +
      // losses + adjustments). The global Transactions tab still
      // hides profit/loss by default.
      const res = await adminApi.get<any>('/transactions', { user_id: userId, include_trade_pnl: 'true', per_page: '100' });
      setTransactions(res.items || res.transactions || []);
    } catch { setTransactions([]); } finally { setTxLoading(false); }
  }, [userId]);

  const fetchDeposits = useCallback(async () => {
    setDepLoading(true);
    try {
      const res = await adminApi.get<any>('/finance/deposits', { user_id: userId, per_page: '100' });
      setDeposits(res.items || res.deposits || []);
    } catch { setDeposits([]); } finally { setDepLoading(false); }
  }, [userId]);

  const fetchWithdrawals = useCallback(async () => {
    setWdLoading(true);
    try {
      const res = await adminApi.get<any>('/finance/withdrawals', { user_id: userId, per_page: '100' });
      setWithdrawals(res.items || res.withdrawals || []);
    } catch { setWithdrawals([]); } finally { setWdLoading(false); }
  }, [userId]);

  useEffect(() => {
    if (activeTab === 'positions') void fetchPositions();
    else if (activeTab === 'trades') void fetchTrades();
    else if (activeTab === 'transactions') void fetchTransactions();
    else if (activeTab === 'deposits') void fetchDeposits();
    else if (activeTab === 'withdrawals') void fetchWithdrawals();
  }, [activeTab, fetchPositions, fetchTrades, fetchTransactions, fetchDeposits, fetchWithdrawals]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-fast mb-4">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="text-center py-20 text-sm text-danger">{error || 'User not found'}</div>
      </div>
    );
  }

  const { user, accounts, total_deposit, total_withdrawal, total_trades, open_positions } = data;
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email.split('@')[0];

  // Net P&L derived from trade-history sum (loaded on demand). When
  // Trade History tab hasn't been visited yet, show "—" rather than 0
  // so admin doesn't read a stale 0 as "zero P&L".
  const netPnl = trades.length > 0 ? trades.reduce((s, t) => s + (Number(t.profit) || 0), 0) : null;
  const grossProfit = trades.length > 0 ? trades.filter(t => t.profit > 0).reduce((s, t) => s + t.profit, 0) : null;
  const grossLoss = trades.length > 0 ? trades.filter(t => t.profit < 0).reduce((s, t) => s + t.profit, 0) : null;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Back + Header */}
      <div>
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-fast mb-4">
          <ArrowLeft size={16} /> Back to Users
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-full bg-buy/10 border-2 border-buy/20 flex items-center justify-center shrink-0">
              <UserRound size={28} className="text-buy" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-text-primary truncate">{name}</h1>
              <p className="text-sm text-text-tertiary truncate">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize', statusColor(user.status))}>{user.status}</span>
            <span className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold', kycColor(user.kyc_status))}>KYC: {user.kyc_status}</span>
          </div>
        </div>
      </div>

      {/* Tab nav — horizontal scroll on phones, fits on desktop. */}
      <div className="border-b border-border-primary overflow-x-auto -mx-4 sm:mx-0">
        <nav className="flex gap-1 px-4 sm:px-0 min-w-max">
          {TABS.map((t) => {
            const active = activeTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-fast',
                  active
                    ? 'border-buy text-buy'
                    : 'border-transparent text-text-tertiary hover:text-text-primary hover:border-border-primary',
                )}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ─── OVERVIEW TAB ─── */}
      {activeTab === 'overview' && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Total Deposits" value={`$${fmt(total_deposit)}`} icon={DollarSign} color="text-success" />
            <StatCard label="Total Withdrawals" value={`$${fmt(total_withdrawal)}`} icon={Wallet} color="text-warning" />
            <StatCard label="Total Trades" value={total_trades.toLocaleString()} icon={CreditCard} color="text-buy" />
            <StatCard label="Open Positions" value={open_positions.toLocaleString()} icon={Shield} color="text-text-primary" />
            <StatCard label="Gross Profit" value={grossProfit != null ? `$${fmt(grossProfit)}` : '—'} icon={TrendingUp} color="text-emerald-400" hint={trades.length === 0 ? 'Open Trade History' : undefined} />
            <StatCard label="Net P&L" value={netPnl != null ? `${netPnl >= 0 ? '+' : ''}$${fmt(netPnl)}` : '—'} icon={netPnl != null && netPnl < 0 ? TrendingDown : TrendingUp} color={netPnl != null && netPnl < 0 ? 'text-danger' : 'text-success'} hint={grossLoss != null ? `Losses: $${fmt(grossLoss)}` : undefined} />
          </div>

          {/* Personal Info */}
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-5">
            <h2 className="text-base font-bold text-text-primary mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <InfoRow label="Email" value={user.email} icon={Mail} />
              <InfoRow label="Phone" value={user.phone || '—'} icon={Phone} />
              <InfoRow label="Country" value={user.country || '—'} icon={MapPin} />
              <InfoRow label="Address" value={user.address || '—'} icon={MapPin} />
              <InfoRow label="Role" value={user.role} />
              <InfoRow label="Member Since" value={user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'} />
            </div>
          </div>

          {/* Trading Accounts */}
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-5">
            <h2 className="text-base font-bold text-text-primary mb-4">Trading Accounts ({accounts.length})</h2>
            {accounts.length === 0 ? (
              <p className="text-sm text-text-tertiary py-6 text-center">No trading accounts</p>
            ) : (
              <div className="space-y-3">
                {accounts.map(a => (
                  <div key={a.id} className="border border-border-primary rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div>
                        <p className="text-sm font-semibold text-text-primary font-mono">{a.account_number}</p>
                        <p className="text-xs text-text-tertiary">{a.currency} · Leverage {a.leverage}:1 {a.is_demo ? '· Demo' : ''}</p>
                      </div>
                      <span className={cn('px-2 py-1 rounded text-xxs font-semibold', a.is_active ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger')}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <InfoRow label="Balance" value={`$${fmt(a.balance)}`} mono />
                      <InfoRow label="Credit" value={`$${fmt(a.credit)}`} mono />
                      <InfoRow label="Equity" value={`$${fmt(a.equity)}`} mono />
                      <InfoRow label="Margin Used" value={`$${fmt(a.margin_used)}`} mono />
                      <InfoRow label="Free Margin" value={`$${fmt(a.free_margin)}`} mono />
                      <InfoRow label="Margin Level" value={a.margin_level > 0 ? `${fmt(a.margin_level)}%` : '—'} mono />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── OPEN POSITIONS TAB ─── */}
      {activeTab === 'positions' && (
        <TableSection
          loading={posLoading}
          empty={positions.length === 0}
          emptyText="No open positions"
          headers={['Symbol', 'Side', 'Lots', 'Open', 'Current', 'SL', 'TP', 'P&L', 'Account', 'Opened']}
          rightAlign={[2, 3, 4, 5, 6, 7]}
          rows={positions.map((p) => [
            <span className="font-medium text-text-primary">{p.instrument_symbol || '—'}</span>,
            <span className={cn('font-bold', p.side?.toLowerCase() === 'buy' ? 'text-buy' : 'text-sell')}>{p.side?.toUpperCase()}</span>,
            <span className="font-mono tabular-nums">{p.lots}</span>,
            <span className="font-mono tabular-nums text-text-secondary">{p.open_price}</span>,
            <span className="font-mono tabular-nums">{p.close_price ?? '—'}</span>,
            <span className={cn('font-mono tabular-nums', p.stop_loss != null ? 'text-sell' : 'text-text-tertiary')}>{p.stop_loss ?? '—'}</span>,
            <span className={cn('font-mono tabular-nums', p.take_profit != null ? 'text-buy' : 'text-text-tertiary')}>{p.take_profit ?? '—'}</span>,
            <span className={cn('font-mono tabular-nums font-semibold', p.profit >= 0 ? 'text-success' : 'text-danger')}>{p.profit >= 0 ? '+' : ''}${fmt(p.profit)}</span>,
            <span className="text-text-tertiary font-mono text-xxs">{p.account_number || '—'}</span>,
            <span className="text-text-tertiary text-xxs">{formatDate(p.created_at)}</span>,
          ])}
        />
      )}

      {/* ─── TRADE HISTORY TAB ─── */}
      {activeTab === 'trades' && (
        <>
          {/* P&L summary across all closed trades */}
          {trades.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Closed Trades" value={trades.length.toString()} icon={HistoryIcon} color="text-text-primary" />
              <StatCard label="Gross Profit" value={`$${fmt(trades.filter(t => t.profit > 0).reduce((s, t) => s + t.profit, 0))}`} icon={TrendingUp} color="text-emerald-400" />
              <StatCard label="Gross Loss" value={`$${fmt(trades.filter(t => t.profit < 0).reduce((s, t) => s + t.profit, 0))}`} icon={TrendingDown} color="text-rose-400" />
              <StatCard label="Net P&L" value={`${trades.reduce((s, t) => s + t.profit, 0) >= 0 ? '+' : ''}$${fmt(trades.reduce((s, t) => s + t.profit, 0))}`} icon={trades.reduce((s, t) => s + t.profit, 0) >= 0 ? TrendingUp : TrendingDown} color={trades.reduce((s, t) => s + t.profit, 0) >= 0 ? 'text-success' : 'text-danger'} />
            </div>
          )}
          <TableSection
            loading={tradesLoading}
            empty={trades.length === 0}
            emptyText="No closed trades"
            headers={['Closed', 'Symbol', 'Side', 'Lots', 'Open', 'Close', 'SL', 'TP', 'P&L', 'Reason']}
            rightAlign={[3, 4, 5, 6, 7, 8]}
            rows={trades.map((t) => [
              <span className="text-text-tertiary text-xxs font-mono">{formatDate(t.closed_at)}</span>,
              <span className="font-medium text-text-primary">{t.instrument_symbol || '—'}</span>,
              <span className={cn('font-bold', t.side?.toLowerCase() === 'buy' ? 'text-buy' : 'text-sell')}>{t.side?.toUpperCase()}</span>,
              <span className="font-mono tabular-nums">{t.lots}</span>,
              <span className="font-mono tabular-nums text-text-secondary">{t.open_price}</span>,
              <span className="font-mono tabular-nums text-text-secondary">{t.close_price}</span>,
              <span className={cn('font-mono tabular-nums', t.stop_loss != null ? 'text-sell' : 'text-text-tertiary')}>{t.stop_loss ?? '—'}</span>,
              <span className={cn('font-mono tabular-nums', t.take_profit != null ? 'text-buy' : 'text-text-tertiary')}>{t.take_profit ?? '—'}</span>,
              <span className={cn('font-mono tabular-nums font-semibold', t.profit >= 0 ? 'text-success' : 'text-danger')}>{t.profit >= 0 ? '+' : ''}${fmt(t.profit)}</span>,
              <span className={cn('inline-flex px-2 py-0.5 rounded text-xxs font-semibold capitalize', typeColor(t.close_reason || 'manual'))}>{t.close_reason || 'manual'}</span>,
            ])}
          />
        </>
      )}

      {/* ─── TRANSACTIONS TAB ─── */}
      {activeTab === 'transactions' && (
        <TableSection
          loading={txLoading}
          empty={transactions.length === 0}
          emptyText="No transactions"
          headers={['Type', 'Amount', 'Balance After', 'Description', 'Account', 'Admin', 'Date']}
          rightAlign={[1, 2]}
          rows={transactions.map((t) => [
            <span className={cn('inline-flex px-2 py-0.5 rounded text-xxs font-semibold capitalize', typeColor(t.type))}>{t.type?.replace(/_/g, ' ')}</span>,
            <span className={cn('font-mono tabular-nums font-semibold', t.amount >= 0 ? 'text-success' : 'text-danger')}>{t.amount >= 0 ? '+' : ''}${fmt(t.amount)}</span>,
            <span className="font-mono tabular-nums text-text-primary">{t.balance_after != null ? `$${fmt(t.balance_after)}` : '—'}</span>,
            <span className="text-text-secondary text-xxs">{t.description || '—'}</span>,
            <span className="text-text-tertiary font-mono text-xxs">{t.account_number || '—'}</span>,
            <span className="text-text-tertiary text-xxs">{t.admin_email || 'System'}</span>,
            <span className="text-text-tertiary text-xxs font-mono">{formatDate(t.created_at)}</span>,
          ])}
        />
      )}

      {/* ─── DEPOSITS TAB ─── */}
      {activeTab === 'deposits' && (
        <TableSection
          loading={depLoading}
          empty={deposits.length === 0}
          emptyText="No deposits"
          headers={['Method', 'Amount', 'Status', 'Reference', 'Crypto Address', 'Date']}
          rightAlign={[1]}
          rows={deposits.map((d) => [
            <span className="text-text-primary capitalize">{(d.method || '—').replace(/_/g, ' ')}</span>,
            <span className="font-mono tabular-nums text-success font-semibold">+${fmt(d.amount)}</span>,
            <span className={cn('inline-flex px-2 py-0.5 rounded text-xxs font-semibold capitalize', statusColor(d.status))}>{d.status?.replace(/_/g, ' ')}</span>,
            <span className="text-text-tertiary text-xxs font-mono break-all">{d.transaction_id || '—'}</span>,
            <span className="text-text-tertiary text-xxs font-mono break-all">{d.crypto_address || '—'}</span>,
            <span className="text-text-tertiary text-xxs font-mono">{formatDate(d.created_at)}</span>,
          ])}
        />
      )}

      {/* ─── WITHDRAWALS TAB ─── */}
      {activeTab === 'withdrawals' && (
        <TableSection
          loading={wdLoading}
          empty={withdrawals.length === 0}
          emptyText="No withdrawals"
          headers={['Method', 'Amount', 'Status', 'Wallet Address', 'Network', 'TX Hash', 'Date']}
          rightAlign={[1]}
          rows={withdrawals.map((w) => [
            <span className="text-text-primary capitalize">{(w.method || '—').replace(/_/g, ' ')}</span>,
            <span className="font-mono tabular-nums text-danger font-semibold">-${fmt(w.amount)}</span>,
            <span className={cn('inline-flex px-2 py-0.5 rounded text-xxs font-semibold capitalize', statusColor(w.status))}>{w.status}</span>,
            <span className="text-text-tertiary text-xxs font-mono break-all">{w.crypto_address || '—'}</span>,
            <span className="text-text-tertiary text-xxs uppercase">{w.wallet_chain_snapshot || '—'}</span>,
            <span className="text-text-tertiary text-xxs font-mono break-all">{w.crypto_tx_hash || '—'}</span>,
            <span className="text-text-tertiary text-xxs font-mono">{formatDate(w.created_at)}</span>,
          ])}
        />
      )}
    </div>
  );
}

// ─── Small helper components kept inline to avoid extra files ───

function StatCard({ label, value, icon: Icon, color, hint }: {
  label: string; value: string; icon: typeof UserRound; color: string; hint?: string;
}) {
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-lg p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={color} />
        <p className="text-xxs text-text-tertiary uppercase tracking-wide truncate">{label}</p>
      </div>
      <p className="text-base sm:text-lg font-bold text-text-primary font-mono tabular-nums truncate">{value}</p>
      {hint && <p className="text-xxs text-text-tertiary mt-1 truncate">{hint}</p>}
    </div>
  );
}

function InfoRow({ label, value, icon: Icon, mono }: {
  label: string; value: string; icon?: typeof UserRound; mono?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xxs text-text-tertiary mb-1 uppercase tracking-wide">
        {Icon && <Icon size={12} />}
        {label}
      </div>
      <p className={cn('text-sm text-text-primary truncate', mono && 'font-mono tabular-nums')}>{value}</p>
    </div>
  );
}

// Generic table-or-cards section. Renders a horizontal table on
// desktop and a vertical card stack on phones (sm: breakpoint).
function TableSection({
  loading, empty, emptyText, headers, rows, rightAlign = [],
}: {
  loading: boolean;
  empty: boolean;
  emptyText: string;
  headers: string[];
  rows: React.ReactNode[][];
  rightAlign?: number[];
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 bg-bg-secondary border border-border-primary rounded-lg">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    );
  }
  if (empty) {
    return (
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-12 text-center text-sm text-text-tertiary">
        {emptyText}
      </div>
    );
  }
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block bg-bg-secondary border border-border-primary rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-border-primary bg-bg-tertiary/40">
                {headers.map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      'px-3 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide',
                      rightAlign.includes(i) ? 'text-right' : 'text-left',
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border-primary/40 hover:bg-bg-hover transition-fast">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        'px-3 py-2.5 text-xs',
                        rightAlign.includes(ci) ? 'text-right' : 'text-left',
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card stack — each row becomes a self-contained card
          with label/value pairs. Easier to read on a phone than a
          horizontally-scrolled table. */}
      <div className="md:hidden space-y-2">
        {rows.map((row, ri) => (
          <div key={ri} className="bg-bg-secondary border border-border-primary rounded-lg p-3 space-y-1.5">
            {headers.map((h, i) => (
              <div key={h} className="flex items-start justify-between gap-3">
                <span className="text-xxs text-text-tertiary uppercase tracking-wide shrink-0">{h}</span>
                <div className="text-xs text-right min-w-0">{row[i]}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
