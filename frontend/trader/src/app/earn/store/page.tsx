'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ShoppingBag, Coins, Lock, Sparkles } from 'lucide-react';
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
    <div className="space-y-5 pb-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight flex items-center gap-2">
            Rewards Store <ShoppingBag size={22} className="text-primary-accent" />
          </h1>
          <p className="text-sm text-text-secondary mt-1">Spend FXArtha Coins on cashback, perks, tools, and lifestyle rewards.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary-accent/30 bg-primary-accent/5">
            <Coins size={14} className="text-primary-accent" />
            <span className="text-sm font-semibold text-text-primary tabular-nums">
              {state ? formatInteger(acBalance) : '—'} FXA
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-info/30 bg-info/5">
            <Sparkles size={14} className="text-info" />
            <span className="text-sm font-semibold text-text-primary tabular-nums">
              {state ? formatInteger(psBalance) : '—'} PS
            </span>
          </div>
        </div>
      </header>

      <div className="rounded-xl border border-border-primary bg-bg-secondary">
        <div className="flex items-center gap-1 p-1 border-b border-border-primary overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ' +
                (tab === t.key
                  ? 'bg-primary-accent/15 text-text-primary border border-primary-accent/40'
                  : 'text-text-secondary hover:text-text-primary border border-transparent')
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-text-secondary text-sm gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading store…
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-text-tertiary text-sm">No items in this category.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                return (
                  <div
                    key={it.id}
                    className="rounded-lg border border-border-primary bg-bg-base p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] uppercase tracking-wider text-primary-accent/85 font-semibold">
                        {it.category}
                      </span>
                      <span className="text-[12px] font-semibold text-text-primary tabular-nums">
                        {formatInteger(it.ac_price)} FXA
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-text-primary">{it.label}</h3>
                    {it.description && (
                      <p className="text-xs text-text-secondary leading-relaxed flex-1">{it.description}</p>
                    )}
                    {psGate > 0 && (
                      <div
                        className={
                          'inline-flex items-center gap-1 self-start text-[10px] px-1.5 py-0.5 rounded-sm ' +
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
                        'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ' +
                        (canRedeem
                          ? 'bg-primary-accent text-bg-base hover:brightness-110 disabled:opacity-60'
                          : 'border border-border-primary text-text-tertiary cursor-not-allowed')
                      }
                    >
                      {isBusy ? <Loader2 size={12} className="animate-spin" /> : !canRedeem && <Lock size={12} />}
                      {isBusy ? 'Redeeming…' : cta}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
