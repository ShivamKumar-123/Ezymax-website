'use client';

/**
 * Admin · Ezymex Shield — aggregate period-plan insurance.
 *
 * Separate product from the per-trade insurance config above it. Two blocks:
 *   1. Reserve dashboard — premium collected vs claims paid, reserve balance,
 *      loss ratio (24h / 7d / all-time), active-plan count, top claimants.
 *   2. Plan editor — edit coverage % / cap / premium / active per plan.
 *
 * Backed by /api/v1/admin/shield-insurance/{plans,stats}
 * (backend/services/admin/routes/shield_insurance.py).
 */
import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, Save, RefreshCw, ShieldCheck } from 'lucide-react';

const LIME = '#1E88FF';

type Period = 'daily' | 'weekly' | 'monthly';
type Tier = 'basic' | 'plus' | 'pro' | 'elite';

interface Plan {
  id: string;
  code: string;
  period: Period;
  tier: Tier;
  coverage_pct: number;
  max_payout: number;
  premium: number;
  is_active: boolean;
}

interface WindowStat {
  plans_sold: number;
  claims_paid: number;
  premium_collected: number;
  payouts: number;
  reserve_balance: number;
  loss_ratio: number;
}
interface Stats {
  '24h': WindowStat;
  '7d': WindowStat;
  all: WindowStat;
  active_plans: number;
  top_claimants: Array<{ user_id: string; total_payout: number }>;
}

const PERIOD_LABEL: Record<Period, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const TIER_LABEL: Record<Tier, string> = { basic: 'Basic', plus: 'Plus', pro: 'Pro', elite: 'Elite' };
const PERIOD_ORDER: Period[] = ['daily', 'weekly', 'monthly'];

export default function ShieldAdminSection() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        adminApi.get<{ plans: Plan[] }>('/shield-insurance/plans'),
        adminApi.get<Stats>('/shield-insurance/stats'),
      ]);
      setPlans(p.plans);
      setStats(s);
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
        || (e as { message?: string })?.message || 'Failed to load Shield data';
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const edit = (id: string, field: 'coverage_pct' | 'max_payout' | 'premium', value: number) =>
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  const toggle = (id: string) =>
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: !p.is_active } : p)));

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.put('/shield-insurance/plans', {
        plans: plans.map((p) => ({
          id: p.id,
          coverage_pct: p.coverage_pct,
          max_payout: p.max_payout,
          premium: p.premium,
          is_active: p.is_active,
        })),
      });
      toast.success('Shield plans updated');
      await load();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
        || (e as { message?: string })?.message || 'Save failed';
      toast.error(detail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border p-4 md:p-5 space-y-5" style={{ borderColor: `${LIME}44` }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${LIME}1a` }}>
            <ShieldCheck className="w-5 h-5" style={{ color: LIME }} />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-text-primary">Ezymex Shield — Period Plans</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              A <strong>separate product</strong> from the per-trade cover above: users buy a plan that
              covers a share of their cumulative loss over a Daily / Weekly / Monthly window.
              These plans do <strong>not</strong> affect what the order ticket charges — that is priced
              by the Trade Insurance settings at the top of this page.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-primary bg-bg-secondary text-xs text-text-secondary hover:text-text-primary"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reload
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-60"
            style={{ color: '#0a0a0a', background: LIME }}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save plans
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
        </div>
      ) : (
        <>
          {/* Reserve dashboard */}
          {stats && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(['24h', '7d', 'all'] as const).map((k) => (
                  <div key={k} className="rounded-xl border border-border-primary bg-bg-secondary p-4">
                    <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-bold mb-2">
                      {k === '24h' ? 'Last 24h' : k === '7d' ? 'Last 7 days' : 'All time'}
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <span className="text-text-tertiary">Plans sold</span>
                      <span className="text-text-primary font-mono font-bold tabular-nums text-right">{stats[k].plans_sold.toLocaleString()}</span>
                      <span className="text-text-tertiary">Claims paid</span>
                      <span className="text-text-primary font-mono font-bold tabular-nums text-right">{stats[k].claims_paid.toLocaleString()}</span>
                      <span className="text-text-tertiary">Premium</span>
                      <span className="text-emerald-400 font-mono font-bold tabular-nums text-right">${stats[k].premium_collected.toFixed(2)}</span>
                      <span className="text-text-tertiary">Payouts</span>
                      <span className="text-rose-400 font-mono font-bold tabular-nums text-right">${stats[k].payouts.toFixed(2)}</span>
                      <span className="text-text-tertiary">Loss ratio</span>
                      <span className={`font-mono font-bold tabular-nums text-right ${stats[k].loss_ratio > 1 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {(stats[k].loss_ratio * 100).toFixed(0)}%
                      </span>
                      <span className="text-text-tertiary border-t border-border-primary pt-1.5 mt-0.5">Reserve</span>
                      <span className={`font-mono font-bold tabular-nums text-right border-t border-border-primary pt-1.5 mt-0.5 ${stats[k].reserve_balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${stats[k].reserve_balance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-text-tertiary -mt-2">
                <span className="font-bold text-text-secondary">{stats.active_plans}</span> active plans right now.
                Loss ratio = payouts ÷ premium; keep it under 100% for the reserve pool to stay positive.
              </p>
            </>
          )}

          {/* Plan editor */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-text-tertiary">
                <tr>
                  <th className="text-left py-2 pr-2 font-bold">Plan</th>
                  <th className="text-right py-2 px-2 font-bold">Coverage %</th>
                  <th className="text-right py-2 px-2 font-bold">Max payout (cap)</th>
                  <th className="text-right py-2 px-2 font-bold">Premium</th>
                  <th className="text-center py-2 pl-2 font-bold">Active</th>
                </tr>
              </thead>
              <tbody>
                {PERIOD_ORDER.flatMap((period) =>
                  plans
                    .filter((p) => p.period === period)
                    .sort((a, b) => a.premium - b.premium)
                    .map((p, i) => (
                      <tr key={p.id} className="border-t border-border-primary">
                        <td className="py-2 pr-2">
                          {i === 0 && (
                            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: LIME }}>
                              {PERIOD_LABEL[period]}
                            </span>
                          )}
                          <span className="block font-bold text-text-primary">{TIER_LABEL[p.tier]}</span>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <Inline value={p.coverage_pct} step={5} suffix="%" onChange={(v) => edit(p.id, 'coverage_pct', v)} />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <Inline value={p.max_payout} step={50} prefix="$" onChange={(v) => edit(p.id, 'max_payout', v)} />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <Inline value={p.premium} step={5} prefix="$" onChange={(v) => edit(p.id, 'premium', v)} />
                        </td>
                        <td className="py-2 pl-2 text-center">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={p.is_active}
                            onClick={() => toggle(p.id)}
                            className="inline-block w-10 h-5 rounded-full relative transition-colors border align-middle"
                            style={p.is_active
                              ? { background: LIME, borderColor: LIME }
                              : { background: 'var(--bg-base)', borderColor: 'var(--border-primary)' }}
                          >
                            <span
                              className="absolute top-[1px] w-[16px] h-[16px] rounded-full bg-white transition-all"
                              style={{ left: p.is_active ? '19px' : '2px' }}
                            />
                          </button>
                        </td>
                      </tr>
                    )),
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-text-tertiary leading-relaxed">
            Payout after each losing trade = <span className="font-mono">min(cumulative_loss × coverage%, cap) − already_paid</span>.
            Period/tier are fixed; edit coverage, cap and premium here. Inactive plans disappear from the trader catalog.
          </p>

          {/* Top claimants */}
          {stats?.top_claimants && stats.top_claimants.length > 0 && (
            <div className="overflow-x-auto">
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-tertiary mb-2">Top claimants (lifetime)</h3>
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-text-tertiary">
                  <tr>
                    <th className="text-left py-2 pr-2">User ID</th>
                    <th className="text-right py-2 px-2">Total payout</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top_claimants.map((c) => (
                    <tr key={c.user_id} className="border-t border-border-primary">
                      <td className="py-2 pr-2 font-mono text-text-secondary">{c.user_id.slice(0, 8)}…{c.user_id.slice(-4)}</td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-rose-400 tabular-nums">${c.total_payout.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Inline({
  value, onChange, step = 1, prefix, suffix,
}: { value: number; onChange: (n: number) => void; step?: number; prefix?: string; suffix?: string }) {
  return (
    <div className="relative inline-block w-24">
      {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary text-[10px] pointer-events-none">{prefix}</span>}
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full ${prefix ? 'pl-5' : 'pl-2'} ${suffix ? 'pr-6' : 'pr-2'} py-1 rounded bg-bg-base border border-border-primary text-xs text-text-primary text-right tabular-nums font-mono focus:outline-none`}
        style={{ borderColor: 'var(--border-primary)' }}
      />
      {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary text-[10px] pointer-events-none">{suffix}</span>}
    </div>
  );
}
