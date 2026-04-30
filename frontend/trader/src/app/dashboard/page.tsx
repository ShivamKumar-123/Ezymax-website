'use client';

/**
 * Broker home — replaces the old open-positions / quick-actions dashboard.
 * Layout follows the Elev8-style brief: account balance card with action
 * buttons, popular deposit methods, top daily movers, status program /
 * rewards, invite-friends banner, deposit bonus, and the existing admin-
 * configurable banner carousel.
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  ChevronDown, ArrowDownToLine, ArrowUpFromLine,
  TrendingUp, TrendingDown, ArrowRight, Gift,
  ShieldCheck, BadgeCheck, ExternalLink, Loader2,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import api from '@/lib/api/client';

interface AccountRow {
  id: string;
  account_number: string;
  balance: number;
  equity: number;
  free_margin: number;
  margin_used?: number;
  leverage: number;
  is_demo: boolean;
  swap_free?: boolean;
  account_group_name?: string | null;
}

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  position: string;
}

interface PriceTick { symbol?: string; bid?: number; ask?: number; }
interface BarRow { time: number; open: number; close: number; }

const TOP_MOVER_SYMBOLS = ['XAUUSD', 'NAS100', 'BTCUSD', 'EURUSD'];

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
    .format(Number.isFinite(n) ? n : 0);

const fmtNum = (n: number, dp = 2) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
    .format(Number.isFinite(n) ? n : 0);

const tradeUrl = (accountId: string) => {
  const host = process.env.NEXT_PUBLIC_TRADE_HOST;
  const path = `/trading/terminal?account=${encodeURIComponent(accountId)}&view=chart`;
  return host ? `https://${host}${path}` : path;
};

export default function DashboardPage() {
  return (
    <DashboardShell>
      <BrokerHome />
    </DashboardShell>
  );
}

function BrokerHome() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [movers, setMovers] = useState<{ symbol: string; pct: number; price: number }[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [accs, b] = await Promise.all([
          api.get<{ items: AccountRow[] } | AccountRow[]>('/accounts'),
          api.get<{ banners: Banner[] }>('/banners', { page: 'dashboard' }).catch(() => ({ banners: [] as Banner[] })),
        ]);
        if (cancelled) return;
        const list: AccountRow[] = Array.isArray(accs) ? accs : (accs as { items: AccountRow[] }).items || [];
        setAccounts(list);
        if (list.length > 0) setActiveId((cur) => cur ?? list[0].id);
        setBanners(b.banners || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ticksRaw, ...barsRaw] = await Promise.all([
          api.get<PriceTick[]>('/instruments/prices/all').catch(() => [] as PriceTick[]),
          ...TOP_MOVER_SYMBOLS.map((s) =>
            api.get<BarRow[]>(`/instruments/${s}/bars`, { resolution: '1D' }).catch(() => [] as BarRow[]),
          ),
        ]);
        if (cancelled) return;
        const tickMap = new Map<string, number>();
        for (const t of ticksRaw || []) {
          if (t?.symbol && t.bid && t.ask) tickMap.set(t.symbol.toUpperCase(), (t.bid + t.ask) / 2);
        }
        const out = TOP_MOVER_SYMBOLS.map((sym, i) => {
          const bars = barsRaw[i] || [];
          const dayOpen = bars.length > 0 ? Number(bars[bars.length - 1].open) : NaN;
          const price = tickMap.get(sym) ?? (bars.length > 0 ? Number(bars[bars.length - 1].close) : NaN);
          const pct = (Number.isFinite(dayOpen) && dayOpen > 0 && Number.isFinite(price))
            ? ((price - dayOpen) / dayOpen) * 100
            : 0;
          return { symbol: sym, pct, price };
        });
        setMovers(out);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeId) || accounts[0] || null,
    [accounts, activeId],
  );

  return (
    <div className="space-y-5 pb-8 max-w-[1200px] mx-auto w-full">
      <AccountBalanceCard
        accounts={accounts}
        active={activeAccount}
        onChangeAccount={setActiveId}
        loading={loading}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DepositMethodsCard />
        <TopMoversCard movers={movers} />
      </div>
      <StatusProgramCard />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <InviteFriendsCard />
        <BonusCard />
      </div>
      {banners.length > 0 && <BannerStrip banners={banners} />}
    </div>
  );
}

function AccountBalanceCard({
  accounts, active, onChangeAccount, loading,
}: {
  accounts: AccountRow[];
  active: AccountRow | null;
  onChangeAccount: (id: string) => void;
  loading: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const a = active;

  return (
    <div
      className="rounded-2xl p-5 md:p-6"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-colors hover:bg-bg-hover"
            style={{ background: 'var(--bg-card-nested)', border: '1px solid var(--border-primary)' }}
          >
            <span
              className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
              style={a?.is_demo
                ? { color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }
                : { color: '#d6a93d', background: 'rgba(214,169,61,0.12)', border: '1px solid rgba(214,169,61,0.3)' }}
            >
              {a?.is_demo ? 'Demo' : 'Real'}
            </span>
            <span className="text-sm font-semibold tabular-nums text-text-primary">
              {a?.account_number || (loading ? '…' : 'No accounts')}
            </span>
            <ChevronDown size={14} className="text-text-tertiary" />
          </button>
          {pickerOpen && accounts.length > 0 && (
            <div
              className="absolute top-full left-0 mt-2 z-30 rounded-xl p-1.5 min-w-[260px]"
              style={{
                background: 'rgba(16,17,20,0.97)',
                border: '1px solid var(--border-primary)',
                boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
              }}
            >
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => { onChangeAccount(acc.id); setPickerOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm hover:bg-bg-hover"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <span
                    className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
                    style={acc.is_demo
                      ? { color: '#f59e0b', background: 'rgba(245,158,11,0.12)' }
                      : { color: '#d6a93d', background: 'rgba(214,169,61,0.12)' }}
                  >
                    {acc.is_demo ? 'Demo' : 'Real'}
                  </span>
                  <span className="font-semibold tabular-nums">#{acc.account_number}</span>
                  <span className="ml-auto text-xs text-text-tertiary tabular-nums">{fmtUsd(acc.balance)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/wallet"
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-colors"
            style={{ background: '#d6a93d', color: '#1a1408' }}
          >
            <ArrowDownToLine size={14} /> Deposit
          </Link>
          <a
            href={a ? tradeUrl(a.id) : '#'}
            target={a ? '_blank' : undefined}
            rel="noopener noreferrer"
            aria-disabled={!a}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              !a && 'pointer-events-none opacity-50',
            )}
            style={{ border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          >
            Trade <ExternalLink size={13} />
          </a>
          <Link
            href="/wallet"
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:bg-bg-hover"
            style={{ border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          >
            <ArrowUpFromLine size={14} /> Withdraw
          </Link>
          <Link
            href="/accounts"
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:bg-bg-hover"
            style={{ border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          >
            Details
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
        <Stat label="Balance" value={fmtUsd(a?.balance ?? 0)} highlight />
        <Stat label="Free margin" value={fmtUsd(a?.free_margin ?? 0)} />
        <Stat label="Equity" value={fmtUsd(a?.equity ?? 0)} />
        <Stat label="Leverage" value={a ? `1:${a.leverage}` : '—'} />
        <Stat label="Server" value="—" />
        <Stat label="No swap" value={a?.swap_free ? 'Yes' : 'No'} />
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] font-medium text-text-tertiary">{label}</p>
      <p
        className={clsx('mt-1 font-bold tabular-nums', highlight ? 'text-xl md:text-2xl' : 'text-base md:text-lg')}
        style={{ color: highlight ? '#d6a93d' : 'var(--text-primary)' }}
      >
        {value}
      </p>
    </div>
  );
}

function DepositMethodsCard() {
  const methods = [
    { name: 'Skrill', sub: 'Card / wallet', color: '#7c3aed', glyph: 'S' },
    { name: 'Tether (TRC20)', sub: 'USDT on Tron', color: '#22c55e', glyph: '₮' },
    { name: 'Tether (ERC20)', sub: 'USDT on Ethereum', color: '#22c55e', glyph: '₮' },
  ];
  return (
    <Card title="Popular deposit methods">
      <ul className="space-y-2">
        {methods.map((m) => (
          <li key={m.name}>
            <Link
              href="/wallet"
              className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-bg-hover"
              style={{ background: 'var(--bg-card-nested)', border: '1px solid var(--border-primary)' }}
            >
              <span
                className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm"
                style={{ background: `${m.color}1f`, color: m.color, border: `1px solid ${m.color}55` }}
              >
                {m.glyph}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary leading-tight">{m.name}</p>
                <p className="text-xs text-text-tertiary leading-tight">{m.sub}</p>
              </div>
              <ArrowRight size={14} className="text-text-tertiary shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TopMoversCard({ movers }: { movers: { symbol: string; pct: number; price: number }[] }) {
  return (
    <Card title="Top daily movers">
      <ul className="divide-y divide-border-primary">
        {movers.length === 0 && (
          <li className="py-8 text-center text-sm text-text-tertiary flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </li>
        )}
        {movers.map((m) => {
          const up = m.pct >= 0;
          const Icon = up ? TrendingUp : TrendingDown;
          return (
            <li key={m.symbol} className="py-3 flex items-center gap-3">
              <span className="text-sm font-semibold text-text-primary flex-1">{m.symbol}</span>
              <span className="text-sm font-mono tabular-nums text-text-secondary">
                {Number.isFinite(m.price) && m.price > 0 ? fmtNum(m.price, m.symbol === 'BTCUSD' ? 0 : 4) : '—'}
              </span>
              <span
                className="inline-flex items-center gap-1 text-xs font-bold tabular-nums"
                style={{ color: up ? '#22c55e' : '#ef4444' }}
              >
                <Icon size={12} />
                {Number.isFinite(m.pct) ? `${up ? '+' : ''}${m.pct.toFixed(2)}%` : '—'}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function StatusProgramCard() {
  return (
    <Card>
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-text-primary mb-2 flex items-center gap-2">
            <BadgeCheck size={18} className="text-[#d6a93d]" /> Status program
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/rewards"
              className="px-3 py-1.5 text-xs font-semibold rounded-full transition-colors"
              style={{ background: 'rgba(214,169,61,0.14)', color: '#d6a93d', border: '1px solid rgba(214,169,61,0.35)' }}
            >
              Challenges
            </Link>
            <Link
              href="/rewards"
              className="px-3 py-1.5 text-xs font-semibold rounded-full transition-colors hover:bg-bg-hover"
              style={{ border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}
            >
              My rewards
            </Link>
          </div>
        </div>
        <div
          className="md:w-[420px] rounded-xl p-4 flex items-center gap-4"
          style={{
            background: 'linear-gradient(135deg, rgba(214,169,61,0.12) 0%, rgba(155,125,58,0.06) 100%)',
            border: '1px solid rgba(214,169,61,0.32)',
          }}
        >
          <Gift size={28} className="text-[#d6a93d] shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-text-primary leading-tight">Welcome cashback</p>
            <p className="text-xs text-text-secondary leading-tight mt-0.5">
              Activate the welcome program to earn cashback on your first 10 closed trades.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/rewards"
              className="px-3 py-1.5 text-xs font-bold rounded-md"
              style={{ background: '#d6a93d', color: '#1a1408' }}
            >
              Activate
            </Link>
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-semibold rounded-md transition-colors hover:bg-bg-hover"
              style={{ border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function InviteFriendsCard() {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div
          className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}
        >
          <ShieldCheck size={26} className="text-green-500" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-text-primary">Invite friends, earn together</h3>
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
            Get a share of every trade your invitees make. Lifetime payouts straight to your main wallet.
          </p>
          <Link
            href="/business"
            className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-[#d6a93d] hover:underline"
          >
            Learn details <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </Card>
  );
}

function BonusCard() {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div
          className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(214,169,61,0.14)', border: '1px solid rgba(214,169,61,0.32)' }}
        >
          <Gift size={26} className="text-[#d6a93d]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-text-primary">50% deposit bonus</h3>
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
            Top up your account and we&apos;ll add 50% extra trading credit. No expiry, fully tradeable.
          </p>
          <Link
            href="/wallet"
            className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 text-xs font-bold rounded-md"
            style={{ background: '#d6a93d', color: '#1a1408' }}
          >
            Get bonus <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </Card>
  );
}

function BannerStrip({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % banners.length), 3000);
    return () => clearInterval(t);
  }, [banners.length]);
  if (banners.length === 0) return null;
  const b = banners[index];
  return (
    <div className="relative w-full rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-primary)' }}>
      <div className="relative w-full h-44 sm:h-52 md:h-60 bg-bg-secondary">
        {b.link_url ? (
          <a href={b.link_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 block">
            <img src={b.image_url} alt={b.title || 'Banner'} className="w-full h-full object-cover" />
          </a>
        ) : (
          <img src={b.image_url} alt={b.title || 'Banner'} className="w-full h-full object-cover" />
        )}
      </div>
      {banners.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {banners.map((_, i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-colors"
              style={{ background: i === index ? '#d6a93d' : 'rgba(255,255,255,0.4)' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4 md:p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
    >
      {title && <h2 className="text-base font-bold text-text-primary mb-3">{title}</h2>}
      {children}
    </div>
  );
}
