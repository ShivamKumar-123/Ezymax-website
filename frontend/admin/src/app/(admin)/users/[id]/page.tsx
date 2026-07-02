'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatNumber, formatDateTime } from '@/lib/formatters';
import { exportTablePdf } from '@/lib/pdf';
import {
  ArrowLeft, ArrowDownCircle, ArrowUpCircle, CreditCard, DollarSign,
  Loader2, Mail, MapPin, Phone, Shield, UserRound, Wallet, Activity,
  TrendingUp, TrendingDown, History as HistoryIcon, Receipt,
  ChevronDown, ArrowLeftRight, Hash, Download, Percent,
} from 'lucide-react';

// Per-user comprehensive ledger view. The page is tabbed so the load
// stays cheap (each tab fetches its own data lazily) and the admin can
// jump between Overview, Open Positions, Trade History, Transactions,
// Deposits, and Withdrawals without leaving the user context. Backend
// endpoints honour `?user_id=` for everything we render here.

type TabId = 'overview' | 'positions' | 'trades' | 'transactions' | 'deposits' | 'withdrawals' | 'commission' | 'copy-fees';

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

// `fmt` + `formatDate` re-exported from the shared formatters module
// so this page stays consistent with the rest of the admin app.
const fmt = formatNumber;
const formatDate = formatDateTime;

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

// Shared filter helpers reused by the Open Positions / Deposits /
// Withdrawals tabs (account, status, date-range filtering client-side).
function statusMatches(raw: string, f: string): boolean {
  if (f === 'all') return true;
  const s = (raw || '').toLowerCase();
  if (f === 'completed') return ['approved', 'auto_approved', 'completed', 'paid'].includes(s);
  if (f === 'pending') return ['pending', 'submitted'].includes(s);
  if (f === 'failed') return ['rejected', 'failed', 'cancelled', 'canceled'].includes(s);
  return true;
}

function dateInRange(created_at: string | null, from: string, to: string): boolean {
  if (from && created_at) { const f = new Date(from); f.setHours(0, 0, 0, 0); if (new Date(created_at) < f) return false; }
  if (to && created_at) { const t = new Date(to); t.setHours(23, 59, 59, 999); if (new Date(created_at) > t) return false; }
  return true;
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all',
        active ? 'bg-accent/15 text-accent border-accent/30' : 'text-text-tertiary border-border-primary hover:text-text-primary')}>
      {label}
    </button>
  );
}

function DateRangeInputs({ from, to, setFrom, setTo }: { from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  return (
    <>
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date"
        className="text-xs py-1.5 px-2 rounded-lg bg-bg-input border border-border-primary text-text-secondary focus:outline-none focus:border-accent/50" />
      <span className="text-text-tertiary text-xs">–</span>
      <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date"
        className="text-xs py-1.5 px-2 rounded-lg bg-bg-input border border-border-primary text-text-secondary focus:outline-none focus:border-accent/50" />
    </>
  );
}

const FIN_STATUS_FILTERS = [
  { id: 'all', label: 'All status' },
  { id: 'completed', label: 'Completed' },
  { id: 'pending', label: 'Pending' },
  { id: 'failed', label: 'Failed' },
];

// Per-section header with a PDF download icon (used on every ledger tab).
function SectionToolbar({ title, onDownload }: { title: string; onDownload: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-bold text-text-primary">{title}</h3>
      <button type="button" onClick={onDownload} title="Download PDF"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border-primary text-text-secondary hover:text-accent hover:border-accent/40 transition-all">
        <Download className="w-3.5 h-3.5" /> PDF
      </button>
    </div>
  );
}

const TABS: { id: TabId; label: string; icon: typeof UserRound }[] = [
  { id: 'overview', label: 'Overview', icon: UserRound },
  { id: 'positions', label: 'Open Positions', icon: Activity },
  { id: 'trades', label: 'Trade History', icon: HistoryIcon },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'deposits', label: 'Deposits', icon: ArrowDownCircle },
  { id: 'withdrawals', label: 'Withdrawals', icon: ArrowUpCircle },
  { id: 'commission', label: 'Commission', icon: Percent },
  { id: 'copy-fees', label: 'Copy Fees', icon: Receipt },
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
  // Trade-History account filter: 'all' or a specific account_number.
  const [tradeAcctFilter, setTradeAcctFilter] = useState<string>('all');
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [depLoading, setDepLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [wdLoading, setWdLoading] = useState(false);
  // Open Positions filters
  const [posAcctFilter, setPosAcctFilter] = useState('all');
  const [posSideFilter, setPosSideFilter] = useState('all'); // all | buy | sell
  // Deposits filters
  const [depStatus, setDepStatus] = useState('all');
  const [depFrom, setDepFrom] = useState('');
  const [depTo, setDepTo] = useState('');
  // Withdrawals filters
  const [wdStatus, setWdStatus] = useState('all');
  const [wdFrom, setWdFrom] = useState('');
  const [wdTo, setWdTo] = useState('');

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
    else if (activeTab === 'trades' || activeTab === 'commission') void fetchTrades();
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

  // P&L now comes from the backend (computed server-side over closed trades)
  // so the Overview shows real numbers immediately. Falls back to the
  // lazy-loaded trade rows if the backend fields are absent (older API).
  const d = data as typeof data & { gross_profit?: number; gross_loss?: number; net_pnl?: number };
  const netPnl = d.net_pnl != null
    ? d.net_pnl
    : (trades.length > 0 ? trades.reduce((s, t) => s + (Number(t.profit) || 0), 0) : null);
  const grossProfit = d.gross_profit != null
    ? d.gross_profit
    : (trades.length > 0 ? trades.filter(t => t.profit > 0).reduce((s, t) => s + t.profit, 0) : null);
  const grossLoss = d.gross_loss != null
    ? d.gross_loss
    : (trades.length > 0 ? trades.filter(t => t.profit < 0).reduce((s, t) => s + t.profit, 0) : null);

  // Trade-History tab: per-account breakdown so admin sees "this account X,
  // that account Y" (net = profit − commission − swap).
  const tradesByAccount = (() => {
    const m = new Map<string, { account: string; count: number; gross: number; net: number }>();
    for (const t of trades) {
      const key = t.account_number || '—';
      const e = m.get(key) || { account: key, count: 0, gross: 0, net: 0 };
      e.count += 1;
      e.gross += Number(t.profit) || 0;
      e.net += (Number(t.profit) || 0) - (Number(t.commission) || 0) - (Number(t.swap) || 0);
      m.set(key, e);
    }
    return Array.from(m.values()).sort((a, b) => b.net - a.net);
  })();

  // Trade rows scoped to the selected account (+ its net after charges).
  const filteredTrades = tradeAcctFilter === 'all'
    ? trades
    : trades.filter((t) => (t.account_number || '—') === tradeAcctFilter);
  const filteredNet = filteredTrades.reduce(
    (s, t) => s + (Number(t.profit) || 0) - (Number(t.commission) || 0) - (Number(t.swap) || 0), 0,
  );

  // Open Positions — account + side filters. Populate the account dropdown
  // from the user's FULL account list (data.accounts), not just accounts
  // that currently hold an open position, so every account is selectable.
  const posAccounts = accounts.map((a) => a.account_number).filter(Boolean);
  const filteredPositions = positions.filter((p) =>
    (posAcctFilter === 'all' || (p.account_number || '') === posAcctFilter) &&
    (posSideFilter === 'all' || (p.side || '').toLowerCase() === posSideFilter));
  // Deposits / Withdrawals — status + date filters (these are user-level,
  // no per-account attribution, so no account filter here).
  const filteredDeposits = deposits.filter((d) => statusMatches(d.status, depStatus) && dateInRange(d.created_at, depFrom, depTo));
  const filteredWithdrawals = withdrawals.filter((w) => statusMatches(w.status, wdStatus) && dateInRange(w.created_at, wdFrom, wdTo));

  // Commission tab — broker-fee totals over the user's closed trades.
  // (Spread is baked into the fill price and not stored per-trade, so only
  // commission + swap are separable here.)
  const totalCommission = trades.reduce((s, t) => s + (Number(t.commission) || 0), 0);
  const totalSwap = trades.reduce((s, t) => s + (Number(t.swap) || 0), 0);
  const totalFees = totalCommission + totalSwap;

  // ── PDF export per section (branded, centered logo watermark) ──
  const pdfName = (section: string) =>
    `${(data?.user?.email || 'user').split('@')[0]}-${section}.pdf`;

  async function downloadPdf(tab: TabId) {
    if (!data) return;
    const base = { userName: name, userEmail: data.user.email };
    try {
      if (tab === 'positions') {
        await exportTablePdf({ ...base, title: 'Open Positions',
          columns: ['Symbol', 'Side', 'Lots', 'Open', 'Current', 'SL', 'TP', 'P&L', 'Account', 'Opened'],
          rows: filteredPositions.map((p) => [p.instrument_symbol || '—', p.side?.toUpperCase() || '', p.lots, p.open_price, p.close_price ?? '—', p.stop_loss ?? '—', p.take_profit ?? '—', `${p.profit >= 0 ? '+' : ''}$${fmt(p.profit)}`, p.account_number || '—', formatDate(p.created_at)]),
          filename: pdfName('open-positions') });
      } else if (tab === 'trades') {
        await exportTablePdf({ ...base, title: 'Trade History',
          columns: ['Closed', 'Account', 'Symbol', 'Side', 'Lots', 'Open', 'Close', 'Commission', 'Swap', 'P&L', 'Reason'],
          rows: filteredTrades.map((t) => [formatDate(t.closed_at), t.account_number || '—', t.instrument_symbol || '—', t.side?.toUpperCase() || '', t.lots, t.open_price, t.close_price, `$${fmt(t.commission)}`, `$${fmt(t.swap)}`, `${t.profit >= 0 ? '+' : ''}$${fmt(t.profit)}`, t.close_reason || 'manual']),
          filename: pdfName('trade-history') });
      } else if (tab === 'commission') {
        await exportTablePdf({ ...base, title: 'Commission & Fees',
          columns: ['Closed', 'Account', 'Symbol', 'Lots', 'Commission', 'Swap', 'Total Fee'],
          rows: trades.map((t) => [formatDate(t.closed_at), t.account_number || '—', t.instrument_symbol || '—', t.lots, `$${fmt(t.commission)}`, `$${fmt(t.swap)}`, `$${fmt((Number(t.commission) || 0) + (Number(t.swap) || 0))}`]),
          filename: pdfName('commission') });
      } else if (tab === 'deposits') {
        await exportTablePdf({ ...base, title: 'Deposits',
          columns: ['Method', 'Amount', 'Status', 'Reference', 'Date'],
          rows: filteredDeposits.map((d) => [(d.method || '—').replace(/_/g, ' '), `$${fmt(d.amount)}`, d.status, d.transaction_id || '—', formatDate(d.created_at)]),
          filename: pdfName('deposits') });
      } else if (tab === 'withdrawals') {
        await exportTablePdf({ ...base, title: 'Withdrawals',
          columns: ['Method', 'Amount', 'Status', 'Wallet', 'Network', 'TX Hash', 'Date'],
          rows: filteredWithdrawals.map((w) => [(w.method || '—').replace(/_/g, ' '), `$${fmt(w.amount)}`, w.status, w.crypto_address || '—', w.wallet_chain_snapshot || '—', w.crypto_tx_hash || '—', formatDate(w.created_at)]),
          filename: pdfName('withdrawals') });
      }
    } catch {
      toast.error('PDF export failed');
    }
  }

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
        <>
          <SectionToolbar title="Open Positions" onDownload={() => downloadPdf('positions')} />
          {positions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChip active={posSideFilter === 'all'} onClick={() => setPosSideFilter('all')} label="All sides" />
              <FilterChip active={posSideFilter === 'buy'} onClick={() => setPosSideFilter('buy')} label="Buy" />
              <FilterChip active={posSideFilter === 'sell'} onClick={() => setPosSideFilter('sell')} label="Sell" />
              {posAccounts.length > 0 && (
                <select value={posAcctFilter} onChange={(e) => setPosAcctFilter(e.target.value)} aria-label="Filter by account"
                  className="text-xs py-1.5 pl-2.5 pr-7 rounded-lg bg-bg-input border border-border-primary text-text-primary focus:outline-none focus:border-accent/50 cursor-pointer">
                  <option value="all">All accounts</option>
                  {posAccounts.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
              {(posSideFilter !== 'all' || posAcctFilter !== 'all') && (
                <button type="button" onClick={() => { setPosSideFilter('all'); setPosAcctFilter('all'); }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-danger/30 text-danger hover:bg-danger/10">Clear</button>
              )}
              <span className="text-xxs text-text-tertiary ml-auto">{filteredPositions.length} of {positions.length}</span>
            </div>
          )}
          <TableSection
            loading={posLoading}
            empty={filteredPositions.length === 0}
            emptyText={positions.length === 0 ? 'No open positions' : 'No positions match your filters'}
            headers={['Symbol', 'Side', 'Lots', 'Open', 'Current', 'SL', 'TP', 'P&L', 'Account', 'Opened']}
            rightAlign={[2, 3, 4, 5, 6, 7]}
            rows={filteredPositions.map((p) => [
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
        </>
      )}

      {/* ─── TRADE HISTORY TAB ─── */}
      {activeTab === 'trades' && (
        <>
          <SectionToolbar title="Trade History" onDownload={() => downloadPdf('trades')} />
          {/* Account filter — scope the trade history to a single account */}
          {trades.length > 0 && tradesByAccount.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-tertiary">Account</span>
              <select
                value={tradeAcctFilter}
                onChange={(e) => setTradeAcctFilter(e.target.value)}
                aria-label="Filter trade history by account"
                className="text-xs py-1.5 pl-2.5 pr-7 rounded-md bg-bg-input border border-border-primary text-text-primary focus:outline-none focus:border-accent/50 cursor-pointer"
              >
                <option value="all">All accounts</option>
                {tradesByAccount.map((a) => (
                  <option key={a.account} value={a.account}>{a.account} ({a.count})</option>
                ))}
              </select>
            </div>
          )}

          {/* P&L summary (scoped to the selected account) */}
          {filteredTrades.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Closed Trades" value={filteredTrades.length.toString()} icon={HistoryIcon} color="text-text-primary" />
              <StatCard label="Gross Profit" value={`$${fmt(filteredTrades.filter(t => t.profit > 0).reduce((s, t) => s + t.profit, 0))}`} icon={TrendingUp} color="text-emerald-400" />
              <StatCard label="Gross Loss" value={`$${fmt(filteredTrades.filter(t => t.profit < 0).reduce((s, t) => s + t.profit, 0))}`} icon={TrendingDown} color="text-rose-400" />
              <StatCard label="Net P&L" value={`${filteredNet >= 0 ? '+' : ''}$${fmt(filteredNet)}`} icon={filteredNet >= 0 ? TrendingUp : TrendingDown} color={filteredNet >= 0 ? 'text-success' : 'text-danger'} />
            </div>
          )}

          {/* Per-account breakdown — each trading account's closed-trade
              count, gross P&L and net P&L (after commission + swap). */}
          {tradesByAccount.length > 1 && tradeAcctFilter === 'all' && (
            <div className="bg-bg-secondary border border-border-primary rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-border-primary text-xs font-semibold text-text-primary">By account</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-primary text-left text-text-tertiary uppercase tracking-wider">
                    <th className="px-3 py-2 font-semibold">Account</th>
                    <th className="px-3 py-2 font-semibold text-right">Trades</th>
                    <th className="px-3 py-2 font-semibold text-right">Gross P&L</th>
                    <th className="px-3 py-2 font-semibold text-right">Net P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {tradesByAccount.map((a) => (
                    <tr key={a.account} className="border-b border-border-primary/50">
                      <td className="px-3 py-2 font-mono text-text-primary">{a.account}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{a.count}</td>
                      <td className={cn('px-3 py-2 text-right font-mono tabular-nums', a.gross >= 0 ? 'text-success' : 'text-danger')}>{a.gross >= 0 ? '+' : ''}${fmt(a.gross)}</td>
                      <td className={cn('px-3 py-2 text-right font-mono tabular-nums font-semibold', a.net >= 0 ? 'text-success' : 'text-danger')}>{a.net >= 0 ? '+' : ''}${fmt(a.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <TableSection
            loading={tradesLoading}
            empty={filteredTrades.length === 0}
            emptyText="No closed trades"
            headers={['Closed', 'Account', 'Symbol', 'Side', 'Lots', 'Open', 'Close', 'SL', 'TP', 'P&L', 'Reason']}
            rightAlign={[4, 5, 6, 7, 8, 9]}
            rows={filteredTrades.map((t) => [
              <span className="text-text-tertiary text-xxs font-mono">{formatDate(t.closed_at)}</span>,
              <span className="font-mono text-xxs text-text-secondary">{t.account_number || '—'}</span>,
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
        <UserTransactionsTab
          transactions={transactions}
          loading={txLoading}
          accounts={accounts.map((a) => a.account_number).filter(Boolean)}
          userName={name}
          userEmail={data.user.email}
        />
      )}

      {/* ─── DEPOSITS TAB ─── */}
      {activeTab === 'deposits' && (
        <>
          <SectionToolbar title="Deposits" onDownload={() => downloadPdf('deposits')} />
          {deposits.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {FIN_STATUS_FILTERS.map((s) => (
                <FilterChip key={s.id} active={depStatus === s.id} onClick={() => setDepStatus(s.id)} label={s.label} />
              ))}
              <DateRangeInputs from={depFrom} to={depTo} setFrom={setDepFrom} setTo={setDepTo} />
              {(depStatus !== 'all' || depFrom || depTo) && (
                <button type="button" onClick={() => { setDepStatus('all'); setDepFrom(''); setDepTo(''); }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-danger/30 text-danger hover:bg-danger/10">Clear</button>
              )}
              <span className="text-xxs text-text-tertiary ml-auto">{filteredDeposits.length} of {deposits.length}</span>
            </div>
          )}
          <TableSection
            loading={depLoading}
            empty={filteredDeposits.length === 0}
            emptyText={deposits.length === 0 ? 'No deposits' : 'No deposits match your filters'}
            headers={['Method', 'Amount', 'Status', 'Reference', 'Crypto Address', 'Date']}
            rightAlign={[1]}
            rows={filteredDeposits.map((d) => [
              <span className="text-text-primary capitalize">{(d.method || '—').replace(/_/g, ' ')}</span>,
              <span className="font-mono tabular-nums text-success font-semibold">+${fmt(d.amount)}</span>,
              <span className={cn('inline-flex px-2 py-0.5 rounded text-xxs font-semibold capitalize', statusColor(d.status))}>{d.status?.replace(/_/g, ' ')}</span>,
              <span className="text-text-tertiary text-xxs font-mono break-all">{d.transaction_id || '—'}</span>,
              <span className="text-text-tertiary text-xxs font-mono break-all">{d.crypto_address || '—'}</span>,
              <span className="text-text-tertiary text-xxs font-mono">{formatDate(d.created_at)}</span>,
            ])}
          />
        </>
      )}

      {/* ─── WITHDRAWALS TAB ─── */}
      {activeTab === 'withdrawals' && (
        <>
          <SectionToolbar title="Withdrawals" onDownload={() => downloadPdf('withdrawals')} />
          {withdrawals.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {FIN_STATUS_FILTERS.map((s) => (
                <FilterChip key={s.id} active={wdStatus === s.id} onClick={() => setWdStatus(s.id)} label={s.label} />
              ))}
              <DateRangeInputs from={wdFrom} to={wdTo} setFrom={setWdFrom} setTo={setWdTo} />
              {(wdStatus !== 'all' || wdFrom || wdTo) && (
                <button type="button" onClick={() => { setWdStatus('all'); setWdFrom(''); setWdTo(''); }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-danger/30 text-danger hover:bg-danger/10">Clear</button>
              )}
              <span className="text-xxs text-text-tertiary ml-auto">{filteredWithdrawals.length} of {withdrawals.length}</span>
            </div>
          )}
          <TableSection
            loading={wdLoading}
            empty={filteredWithdrawals.length === 0}
            emptyText={withdrawals.length === 0 ? 'No withdrawals' : 'No withdrawals match your filters'}
            headers={['Method', 'Amount', 'Status', 'Wallet Address', 'Network', 'TX Hash', 'Date']}
            rightAlign={[1]}
            rows={filteredWithdrawals.map((w) => [
              <span className="text-text-primary capitalize">{(w.method || '—').replace(/_/g, ' ')}</span>,
              <span className="font-mono tabular-nums text-danger font-semibold">-${fmt(w.amount)}</span>,
              <span className={cn('inline-flex px-2 py-0.5 rounded text-xxs font-semibold capitalize', statusColor(w.status))}>{w.status}</span>,
              <span className="text-text-tertiary text-xxs font-mono break-all">{w.crypto_address || '—'}</span>,
              <span className="text-text-tertiary text-xxs uppercase">{w.wallet_chain_snapshot || '—'}</span>,
              <span className="text-text-tertiary text-xxs font-mono break-all">{w.crypto_tx_hash || '—'}</span>,
              <span className="text-text-tertiary text-xxs font-mono">{formatDate(w.created_at)}</span>,
            ])}
          />
        </>
      )}

      {/* ─── COMMISSION TAB ─── */}
      {activeTab === 'commission' && (
        <>
          <SectionToolbar title="Commission & Fees" onDownload={() => downloadPdf('commission')} />
          {trades.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Closed Trades" value={trades.length.toString()} icon={HistoryIcon} color="text-text-primary" />
              <StatCard label="Total Commission" value={`$${fmt(totalCommission)}`} icon={Percent} color="text-warning" />
              <StatCard label="Total Swap" value={`$${fmt(totalSwap)}`} icon={DollarSign} color="text-accent" />
              <StatCard label="Total Fees" value={`$${fmt(totalFees)}`} icon={DollarSign} color="text-text-primary" hint="commission + swap" />
            </div>
          )}
          <p className="text-xxs text-text-tertiary">
            Spread is embedded in the fill price and not booked as a separate line, so only commission + swap are itemised per trade.
          </p>
          <TableSection
            loading={tradesLoading}
            empty={trades.length === 0}
            emptyText="No closed trades"
            headers={['Closed', 'Account', 'Symbol', 'Lots', 'Commission', 'Swap', 'Total Fee']}
            rightAlign={[3, 4, 5, 6]}
            rows={trades.map((t) => [
              <span className="text-text-tertiary text-xxs font-mono">{formatDate(t.closed_at)}</span>,
              <span className="font-mono text-xxs text-text-secondary">{t.account_number || '—'}</span>,
              <span className="font-medium text-text-primary">{t.instrument_symbol || '—'}</span>,
              <span className="font-mono tabular-nums">{t.lots}</span>,
              <span className="font-mono tabular-nums text-warning">${fmt(t.commission)}</span>,
              <span className="font-mono tabular-nums text-text-secondary">${fmt(t.swap)}</span>,
              <span className="font-mono tabular-nums font-semibold text-text-primary">${fmt((Number(t.commission) || 0) + (Number(t.swap) || 0))}</span>,
            ])}
          />
        </>
      )}

      {activeTab === 'copy-fees' && <CopyFeesPaidSection userId={userId} />}
    </div>
  );
}

// ─── Per-user Transactions tab — full ledger with filters + drill-down ──
//
// Mirrors the trader-side Transaction History UX: type filters (incl. a
// P&L filter for realized profit/loss), per-account + date filters, a
// summary strip, and expandable rows that reveal the account/main-wallet
// balance BEFORE → AFTER the entry, parsed trade detail, and the ledger id.
const TX_TYPE_FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'deposit', label: 'Deposits' },
  { id: 'withdrawal', label: 'Withdrawals' },
  { id: 'transfer', label: 'Transfers' },
  { id: 'trading', label: 'P&L' },
  { id: 'commission', label: 'IB Commissions' },
  { id: 'adjustment', label: 'Adjustments' },
];

function txTitle(type: string): string {
  const x = (type || '').toLowerCase();
  if (x === 'deposit') return 'Deposit';
  if (x === 'withdrawal') return 'Withdrawal';
  if (x === 'transfer') return 'Transfer';
  if (x === 'profit') return 'Realized profit';
  if (x === 'loss') return 'Realized loss';
  if (x === 'bonus' || x === 'bonus_release') return 'Bonus';
  if (x === 'credit') return 'Credit';
  if (x === 'correction') return 'Correction';
  if (x === 'adjustment') return 'Adjustment';
  if (x.includes('commission')) return 'IB commission';
  return type ? type.replace(/_/g, ' ') : 'Transaction';
}

function txMatchesType(type: string, f: string): boolean {
  const x = (type || '').toLowerCase();
  if (f === 'all') return true;
  if (f === 'deposit') return x === 'deposit';
  if (f === 'withdrawal') return x === 'withdrawal';
  if (f === 'transfer') return x === 'transfer';
  if (f === 'trading') return x === 'profit' || x === 'loss';
  if (f === 'commission') return x.includes('commission') || x === 'credit';
  if (f === 'adjustment') return ['adjustment', 'correction', 'bonus', 'bonus_release', 'admin_commission'].includes(x);
  return true;
}

function TxIcon({ type }: { type: string }) {
  const x = (type || '').toLowerCase();
  if (x === 'deposit') return <ArrowDownCircle className="w-4 h-4" />;
  if (x === 'withdrawal') return <ArrowUpCircle className="w-4 h-4" />;
  if (x === 'transfer') return <ArrowLeftRight className="w-4 h-4" />;
  if (x === 'profit') return <TrendingUp className="w-4 h-4" />;
  if (x === 'loss') return <TrendingDown className="w-4 h-4" />;
  return <DollarSign className="w-4 h-4" />;
}

function TxDetailField({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xxs font-bold uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className={cn('text-xs font-semibold text-text-primary mt-0.5 truncate', valueClass)}>{value}</p>
    </div>
  );
}

function UserTransactionsTab({ transactions, loading, accounts, userName, userEmail }: { transactions: TxRow[]; loading: boolean; accounts: string[]; userName: string; userEmail?: string }) {
  const MAIN = '__main__';
  const [typeFilter, setTypeFilter] = useState('all');
  const [acctFilter, setAcctFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // The dropdown lists the user's FULL account set (passed from the parent),
  // plus a Main-wallet bucket for wallet-level entries (account_id = null).

  const filtered = transactions.filter((t) => {
    if (!txMatchesType(t.type, typeFilter)) return false;
    if (acctFilter === MAIN && t.account_number) return false;
    if (acctFilter !== 'all' && acctFilter !== MAIN && (t.account_number || '') !== acctFilter) return false;
    if (dateFrom && t.created_at) { const f = new Date(dateFrom); f.setHours(0, 0, 0, 0); if (new Date(t.created_at) < f) return false; }
    if (dateTo && t.created_at) { const to = new Date(dateTo); to.setHours(23, 59, 59, 999); if (new Date(t.created_at) > to) return false; }
    return true;
  });

  const totalIn = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = filtered.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const net = totalIn - totalOut;
  const hasFilters = typeFilter !== 'all' || acctFilter !== 'all' || !!dateFrom || !!dateTo;

  async function handleDownload() {
    try {
      await exportTablePdf({
        title: 'Transactions',
        userName,
        userEmail,
        columns: ['Type', 'Amount', 'Balance After', 'Account', 'Description', 'Date'],
        rows: filtered.map((t) => [
          txTitle(t.type),
          `${t.amount >= 0 ? '+' : '-'}$${fmt(Math.abs(t.amount))}`,
          t.balance_after != null ? `$${fmt(t.balance_after)}` : '—',
          t.account_number || 'Main wallet',
          t.description || '',
          formatDate(t.created_at),
        ]),
        filename: `${(userEmail || 'user').split('@')[0]}-transactions.pdf`,
      });
    } catch {
      toast.error('PDF export failed');
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>;
  }

  return (
    <div className="space-y-3">
      <SectionToolbar title="Transactions" onDownload={handleDownload} />
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        {TX_TYPE_FILTERS.map((f) => (
          <button key={f.id} type="button" onClick={() => setTypeFilter(f.id)}
            className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all',
              typeFilter === f.id ? 'bg-accent/15 text-accent border-accent/30' : 'text-text-tertiary border-border-primary hover:text-text-primary')}>
            {f.label}
          </button>
        ))}
        <select value={acctFilter} onChange={(e) => setAcctFilter(e.target.value)} aria-label="Filter by account"
          className="text-xs py-1.5 pl-2.5 pr-7 rounded-lg bg-bg-input border border-border-primary text-text-primary focus:outline-none focus:border-accent/50 cursor-pointer">
          <option value="all">All accounts</option>
          <option value={MAIN}>Main wallet</option>
          {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          className="text-xs py-1.5 px-2 rounded-lg bg-bg-input border border-border-primary text-text-secondary focus:outline-none focus:border-accent/50" />
        <span className="text-text-tertiary text-xs">–</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          className="text-xs py-1.5 px-2 rounded-lg bg-bg-input border border-border-primary text-text-secondary focus:outline-none focus:border-accent/50" />
        {hasFilters && (
          <button type="button" onClick={() => { setTypeFilter('all'); setAcctFilter('all'); setDateFrom(''); setDateTo(''); }}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-danger/30 text-danger hover:bg-danger/10">Clear</button>
        )}
      </div>

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Transactions" value={filtered.length.toString()} icon={Receipt} color="text-text-primary" />
          <StatCard label="Total In" value={`+$${fmt(totalIn)}`} icon={TrendingUp} color="text-success" />
          <StatCard label="Total Out" value={`-$${fmt(totalOut)}`} icon={TrendingDown} color="text-danger" />
          <StatCard label="Net" value={`${net >= 0 ? '+' : '-'}$${fmt(Math.abs(net))}`} icon={net >= 0 ? TrendingUp : TrendingDown} color={net >= 0 ? 'text-success' : 'text-danger'} />
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-text-tertiary text-sm">
          {transactions.length === 0 ? 'No transactions' : 'No transactions match your filters'}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((t) => {
            const after = t.balance_after;
            const before = after != null ? after - t.amount : null;
            const isExpanded = expandedId === t.id;
            const isIn = t.amount >= 0;
            const tm = (t.description || '').match(/([A-Z0-9]{3,})\s+(buy|sell)\s+([\d.]+)\s+lots?\s*@\s*([\d.]+)/i);
            const trade = tm ? { symbol: tm[1], side: tm[2].toLowerCase(), lots: tm[3], price: tm[4] } : null;
            return (
              <div key={t.id} className={cn('rounded-lg border overflow-hidden transition-all', isExpanded ? 'border-accent/40 bg-bg-hover/40' : 'border-border-primary')}>
                <button type="button" onClick={() => setExpandedId((cur) => (cur === t.id ? null : t.id))}
                  className="w-full text-left p-3 flex items-center gap-3 hover:bg-bg-hover/40 transition-all">
                  <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0', typeColor(t.type))}>
                    <TxIcon type={t.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary capitalize truncate">{txTitle(t.type)}</p>
                        {t.description && <p className="text-xxs text-text-tertiary mt-0.5 truncate">{t.description}</p>}
                      </div>
                      <div className="flex items-start gap-2 shrink-0">
                        <span className={cn('text-sm font-bold font-mono tabular-nums', isIn ? 'text-success' : 'text-danger')}>{isIn ? '+' : '-'}${fmt(Math.abs(t.amount))}</span>
                        <ChevronDown className={cn('w-4 h-4 text-text-tertiary mt-0.5 transition-transform', isExpanded && 'rotate-180 text-accent')} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1 text-xxs text-text-tertiary">
                      <span className="font-mono">{formatDate(t.created_at)}</span>
                      <span className="px-1.5 py-0.5 rounded bg-bg-secondary border border-border-primary font-mono">{t.account_number || 'Main wallet'}</span>
                      {after != null && <span className="px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent font-mono">Bal: ${fmt(after)}</span>}
                    </div>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-border-primary bg-bg-secondary/30">
                    {after != null && before != null && (
                      <div className="mt-3 rounded-lg border border-border-primary bg-bg-input/40 p-3">
                        <p className="text-xxs font-bold uppercase tracking-wider text-text-tertiary mb-2 flex items-center gap-1.5">
                          <Wallet className="w-3.5 h-3.5" />{t.account_number ? 'Account balance' : 'Main wallet balance'}
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="text-center"><p className="text-xxs uppercase text-text-tertiary">Before</p><p className="text-sm font-bold font-mono tabular-nums text-text-secondary">${fmt(before)}</p></div>
                          <div className="flex-1 flex items-center gap-1.5 min-w-0">
                            <div className="h-px flex-1 bg-border-primary" />
                            <span className={cn('text-xs font-bold font-mono tabular-nums px-1.5 py-0.5 rounded shrink-0', isIn ? 'text-success bg-success/10' : 'text-danger bg-danger/10')}>{isIn ? '+' : '-'}${fmt(Math.abs(t.amount))}</span>
                            <div className="h-px flex-1 bg-border-primary" />
                          </div>
                          <div className="text-center"><p className="text-xxs uppercase text-text-tertiary">After</p><p className="text-sm font-bold font-mono tabular-nums text-text-primary">${fmt(after)}</p></div>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                      <TxDetailField label="Type" value={txTitle(t.type)} />
                      <TxDetailField label="Account" value={t.account_number || 'Main wallet'} />
                      <TxDetailField label={t.amount < 0 ? 'Debit' : 'Credit'} value={`${isIn ? '+' : '-'}$${fmt(Math.abs(t.amount))}`} valueClass={isIn ? 'text-success' : 'text-danger'} />
                      {trade && <>
                        <TxDetailField label="Instrument" value={trade.symbol} />
                        <TxDetailField label="Side" value={trade.side.toUpperCase()} valueClass={trade.side === 'buy' ? 'text-buy' : 'text-sell'} />
                        <TxDetailField label="Lots" value={trade.lots} />
                        <TxDetailField label="Price" value={trade.price} />
                      </>}
                      <TxDetailField label="Date & time" value={formatDate(t.created_at)} />
                      <TxDetailField label="By" value={t.admin_email || 'System'} />
                    </div>
                    <p className="mt-3 text-xxs text-text-tertiary flex items-center gap-1 font-mono break-all"><Hash className="w-3 h-3 shrink-0" />{t.id}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Copy-trade fees paid by this user as a follower ────────────────
//
// Tab for support — answers "why was this user charged a fee?"
// Backed by GET /admin/social/users/{user_id}/copy-fees-paid. Same
// data shape as the master drill-down on /admin/social, just from
// the follower side. Includes which master collected each share
// (email + name) so support can trace the fee to a specific
// allocation in one step.
interface CopyFeeRow {
  transaction_id: string;
  timestamp: string | null;
  symbol: string;
  side: string;
  investor_lots: number;
  investor_profit: number;
  fee_paid: number;
  master_email: string;
  master_name: string;
}

function CopyFeesPaidSection({ userId }: { userId: string }) {
  const [rows, setRows] = useState<CopyFeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '50' });
      if (range !== 'all') {
        const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - days);
        params.set('from_date', d.toISOString());
      }
      const res = await adminApi.get<{
        items: CopyFeeRow[];
        total_paid: number;
        total_rows: number;
        pages: number;
      }>(`/social/users/${userId}/copy-fees-paid?${params.toString()}`);
      setRows(res.items || []);
      setTotalPaid(res.total_paid || 0);
      setTotalRows(res.total_rows || 0);
      setPages(res.pages || 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load copy fees');
    } finally {
      setLoading(false);
    }
  }, [userId, range, page]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="bg-bg-secondary border border-border-primary rounded-lg overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border-primary flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Copy-Trade Fees Paid</h3>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Performance fees deducted from this user&rsquo;s positions when they followed a master trader
          </p>
        </div>
        <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-bg-primary border border-border-primary">
          {(['7d', '30d', '90d', 'all'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setRange(p); setPage(1); }}
              className={cn('px-2.5 py-1 rounded text-[11px] font-medium transition',
                range === p ? 'bg-buy text-white' : 'text-text-secondary hover:text-text-primary')}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 px-3 py-2.5 border-b border-border-primary bg-bg-primary/40">
        <div>
          <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Trades in Range</p>
          <p className="text-base font-bold font-mono tabular-nums text-text-primary mt-0.5">{totalRows}</p>
        </div>
        <div>
          <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Total Fees Paid</p>
          <p className="text-base font-bold font-mono tabular-nums text-danger mt-0.5">-${fmt(totalPaid)}</p>
        </div>
        <div>
          <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Avg / Trade</p>
          <p className="text-base font-bold font-mono tabular-nums text-text-primary mt-0.5">
            ${fmt(totalRows > 0 ? totalPaid / totalRows : 0)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-text-tertiary" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 text-xs text-text-tertiary">
            No copy-trade fees in this range. This user hasn&rsquo;t followed a profitable trader yet.
          </div>
        ) : (
          <table className="w-full min-w-[800px] text-xs">
            <thead className="bg-bg-tertiary/40">
              <tr>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-text-tertiary font-medium">When</th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-text-tertiary font-medium">Symbol</th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-text-tertiary font-medium">Side</th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-text-tertiary font-medium">Paid To Master</th>
                <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider text-text-tertiary font-medium">Lots</th>
                <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider text-text-tertiary font-medium">Their Profit</th>
                <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider text-text-tertiary font-medium">Fee Paid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.transaction_id} className="border-t border-border-primary/40 hover:bg-bg-hover/30">
                  <td className="px-3 py-2 text-text-secondary">
                    {r.timestamp ? new Date(r.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </td>
                  <td className="px-3 py-2 text-text-primary font-medium">{r.symbol}</td>
                  <td className={cn('px-3 py-2 font-medium uppercase', r.side === 'buy' ? 'text-buy' : 'text-sell')}>{r.side}</td>
                  <td className="px-3 py-2">
                    <p className="text-text-primary">{r.master_name}</p>
                    <p className="text-xxs text-text-tertiary">{r.master_email}</p>
                  </td>
                  <td className="px-3 py-2 text-right text-text-primary font-mono tabular-nums">{r.investor_lots.toFixed(2)}</td>
                  <td className={cn('px-3 py-2 text-right font-mono tabular-nums', r.investor_profit >= 0 ? 'text-success' : 'text-danger')}>
                    {r.investor_profit >= 0 ? '+' : ''}${fmt(r.investor_profit)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-danger font-medium">-${fmt(r.fee_paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="px-3 py-2 flex items-center justify-between border-t border-border-primary text-xxs text-text-tertiary">
          <span>Page {page} of {pages}</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-2 py-1 rounded border border-border-primary disabled:opacity-40 hover:bg-bg-hover">Prev</button>
            <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}
              className="px-2 py-1 rounded border border-border-primary disabled:opacity-40 hover:bg-bg-hover">Next</button>
          </div>
        </div>
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
