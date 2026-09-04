'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  ShoppingBag,
  Coins,
  Lock,
  Sparkles,
  BadgePercent,
  Gift,
  Star,
  Wrench,
  Gem,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import api from '@/lib/api/client';
import { formatInteger } from '@/lib/formatters';

type StoreItem = {
  id: string;
  slug: string;
  category: 'cashback' | 'bonus' | 'perk' | 'tool' | 'lifestyle';
  label: string;
  description: string | null;
  ac_price: number;
  /** Only present (and non-zero) for lifestyle items the backend has gated
   *  behind a Power Score threshold. Surfaced via /rewards/store so the UI
   *  can show a "needs X PS" lock up-front rather than 403ing at redeem. */
  min_ps?: number;
};

type RewardsState = { ac_balance: number; ps: number };

const TABS: Array<{ key: 'all' | StoreItem['category']; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'cashback', label: 'Cashback' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'perk', label: 'Perks' },
  { key: 'tool', label: 'Tools' },
  { key: 'lifestyle', label: 'Lifestyle' },
];

const CATEGORY_ICON: Record<StoreItem['category'], typeof Coins> = {
  cashback: BadgePercent,
  bonus: Gift,
  perk: Star,
  tool: Wrench,
  lifestyle: Gem,
};

export default function EarnStorePage() {
  return (
    <DashboardShell>
      <Inner />
    </DashboardShell>
  );
}

function Inner() {
  const [tab, setTab] = useState<'all' | StoreItem['category']>('all');
  const [items, setItems] = useState<StoreItem[]>([]);
  const [state, setState] = useState<RewardsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, items] = await Promise.all([
        api.get<RewardsState>('/rewards/state'),
        api.get<StoreItem[]>(tab === 'all' ? '/rewards/store' : `/rewards/store?category=${tab}`),
      ]);
      setState(s);
      setItems(items);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load store');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { void load(); }, [load]);

  const redeem = async (item: StoreItem) => {
    setBusyId(item.id);
    try {
      const res = await api.post<{ redeemed: string; ac_spent: number }>(`/rewards/store/${item.id}/redeem`, {});
      toast.success(`Redeemed ${res.redeemed} (−${formatInteger(res.ac_spent)} FXA)`);
      await load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'insufficient_ac') toast.error('Not enough FXArtha Coins');
      else if (detail === 'insufficient_ps') toast.error('Not enough Power Score for this lifestyle reward');
      else toast.error(detail || err?.message || 'Could not redeem');
    } finally {
      setBusyId(null);
    }
  };

  const acBalance = state?.ac_balance ?? 0;
  const psBalance = state?.ps ?? 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Premium page header */}
      <header className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(204,255,0,0.12)', border: '1px solid rgba(204,255,0,0.25)' }}
        >
          <ShoppingBag className="w-5 h-5 text-[#ccff00]" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-text-primary">Rewards Store</h1>
          <p className="text-sm text-text-tertiary">Spend FXArtha Coins on cashback, perks, tools, and lifestyle rewards.</p>
        </div>
      </header>

      {/* Balance hero card */}
      <div
        className="rounded-2xl border relative overflow-hidden transition-all duration-300 pl-5"
        style={{
          background: 'radial-gradient(130% 120% at 95% -25%, rgba(204,255,0,0.12), transparent 55%), var(--bg-card)',
          borderColor: 'rgba(204,255,0,0.16)',
          boxShadow: '0 8px 26px rgba(0,0,0,0.28)',
        }}
      >
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-1"
          style={{ background: 'linear-gradient(180deg, #eaff8a, #ccff00 55%, #a6d600)', boxShadow: '0 0 14px rgba(204,255,0,0.5)' }}
        />
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* FXA balance */}
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(204,255,0,0.12)', border: '1px solid rgba(204,255,0,0.25)' }}
            >
              <Coins className="w-5 h-5 text-[#ccff00]" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Coin Balance</p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-text-primary truncate">
                {state ? formatInteger(acBalance) : '—'} <span className="text-sm font-medium text-text-tertiary">FXA</span>
              </p>
            </div>
          </div>
          {/* Power Score */}
          <div className="flex items-center gap-3 sm:justify-end">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(204,255,0,0.12)', border: '1px solid rgba(204,255,0,0.25)' }}
            >
              <Sparkles className="w-5 h-5 text-[#ccff00]" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Power Score</p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-text-primary truncate">
                {state ? formatInteger(psBalance) : '—'} <span className="text-sm font-medium text-text-tertiary">PS</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl border border-border-primary bg-bg-secondary overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              'px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ' +
              (tab === t.key
                ? 'bg-[#ccff00] text-[#0a0a0a]'
                : 'text-text-secondary hover:text-text-primary')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-text-secondary text-sm gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading store…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border-primary bg-card text-center py-16 text-text-tertiary text-sm">
          No items in this category.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => {
            const canAffordAc = acBalance >= it.ac_price;
            const psGate = it.min_ps ?? 0;
            const meetsPs = psGate === 0 || psBalance >= psGate;
            const canRedeem = canAffordAc && meetsPs;
            const isBusy = busyId === it.id;
            const cta = !meetsPs
              ? `Locked · needs ${formatInteger(psGate)} PS`
              : !canAffordAc
                ? 'Not enough FXA'
                : 'Redeem';
            const CatIcon = CATEGORY_ICON[it.category] ?? Star;
            return (
              <div
                key={it.id}
                className="rounded-2xl border relative overflow-hidden transition-all duration-300 hover:-translate-y-1 flex flex-col"
                style={{
                  background: 'radial-gradient(130% 120% at 95% -25%, rgba(204,255,0,0.10), transparent 55%), var(--bg-card)',
                  borderColor: 'rgba(204,255,0,0.16)',
                  boxShadow: '0 8px 26px rgba(0,0,0,0.28)',
                }}
              >
                {/* Icon / image area */}
                <div
                  className="relative h-24 flex items-center justify-center"
                  style={{ background: 'radial-gradient(120% 140% at 50% -20%, rgba(204,255,0,0.14), transparent 60%)' }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(204,255,0,0.12)', border: '1px solid rgba(204,255,0,0.25)' }}
                  >
                    <CatIcon className="w-7 h-7 text-[#ccff00]" />
                  </div>
                  <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider text-text-tertiary bg-bg-secondary/70 border border-border-primary rounded-full px-2 py-0.5">
                    {it.category}
                  </span>
                </div>

                {/* Body */}
                <div className="p-4 flex flex-col gap-2 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-text-primary leading-snug">{it.label}</h3>
                    <span
                      className="shrink-0 inline-flex items-center gap-1 text-xs font-bold tabular-nums px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(204,255,0,0.10)', border: '1px solid rgba(204,255,0,0.22)', color: 'var(--accent-ink)' }}
                    >
                      <Coins className="w-3 h-3" />
                      {formatInteger(it.ac_price)}
                    </span>
                  </div>
                  {it.description && (
                    <p className="text-xs text-text-secondary leading-relaxed flex-1">{it.description}</p>
                  )}
                  {psGate > 0 && (
                    <div
                      className={
                        'inline-flex items-center gap-1 self-start text-[10px] px-2 py-0.5 rounded-full ' +
                        (meetsPs
                          ? 'bg-success/10 text-success border border-success/30'
                          : 'bg-warning/10 text-warning border border-warning/30')
                      }
                    >
                      <Sparkles size={10} /> Requires {formatInteger(psGate)} PS
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => redeem(it)}
                    disabled={isBusy || !canRedeem}
                    className={
                      'mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ' +
                      (canRedeem
                        ? 'bg-[#ccff00] hover:bg-[#a6d600] text-[#0a0a0a] active:scale-[0.98] disabled:opacity-60'
                        : 'border border-border-primary text-text-tertiary cursor-not-allowed')
                    }
                  >
                    {isBusy ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : canRedeem ? (
                      <Check size={14} />
                    ) : (
                      <Lock size={14} />
                    )}
                    {isBusy ? 'Redeeming…' : cta}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
