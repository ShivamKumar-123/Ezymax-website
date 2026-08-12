'use client';

/**
 * FXArtha Shield — aggregate period-plan insurance panel.
 *
 * Separate product from the per-trade micro-insurance. The user buys ONE plan
 * (Daily / Weekly / Monthly) at a tier; it covers a share of their *cumulative*
 * realized loss over that window, up to a cap. This panel shows the active plan
 * + usage, the buyable catalog, and the Shield claim history.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldCheck, Clock, TrendingDown, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  shieldApi,
  type ShieldPlan,
  type ShieldState,
  type ShieldClaim,
  type ShieldPeriod,
  type ShieldTier,
} from '@/lib/api/insurance';

const LIME = '#ccff00';

const PERIOD_LABEL: Record<ShieldPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};
const PERIOD_SUB: Record<ShieldPeriod, string> = {
  daily: '24-hour cover',
  weekly: '7-day cover',
  monthly: '30-day cover',
};
const TIER_LABEL: Record<ShieldTier, string> = {
  basic: 'Basic',
  plus: 'Plus',
  pro: 'Pro',
  elite: 'Elite',
};
const PERIOD_ORDER: ShieldPeriod[] = ['daily', 'weekly', 'monthly'];

function timeLeft(iso: string | null): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m left`;
}

export default function ShieldPanel() {
  const [plans, setPlans] = useState<ShieldPlan[] | null>(null);
  const [active, setActive] = useState<ShieldState | null>(null);
  const [claims, setClaims] = useState<ShieldClaim[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, s, c] = await Promise.all([
        shieldApi.plans(),
        shieldApi.status(),
        shieldApi.claims(100),
      ]);
      setPlans(p.plans);
      setActive(s.active);
      setClaims(c.claims);
    } catch {
      /* ignore — surfaced by empty states */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const buy = useCallback(
    async (plan: ShieldPlan) => {
      const replacing = active !== null;
      if (replacing) {
        const ok = window.confirm(
          `You already hold an active ${TIER_LABEL[active!.tier]} ${PERIOD_LABEL[active!.period]} plan. ` +
          `Buying ${TIER_LABEL[plan.tier]} ${PERIOD_LABEL[plan.period]} will REPLACE it — the old plan ends ` +
          `and coverage used so far is forfeited. A fresh $${plan.premium.toFixed(0)} premium is charged. Continue?`,
        );
        if (!ok) return;
      }
      setBuying(plan.id);
      try {
        await shieldApi.purchase(plan.id, replacing);
        toast.success(`${TIER_LABEL[plan.tier]} ${PERIOD_LABEL[plan.period]} Shield activated`);
        await load();
      } catch (e) {
        const detail = (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
          || (e as { message?: string })?.message || 'Purchase failed';
        const friendly =
          detail === 'insufficient_balance' ? 'Not enough wallet balance for the premium.'
          : detail === 'plan_already_active' ? 'You already have an active plan.'
          : detail;
        toast.error(friendly);
      } finally {
        setBuying(null);
      }
    },
    [active, load],
  );

  const grouped = useMemo(() => {
    const g: Record<ShieldPeriod, ShieldPlan[]> = { daily: [], weekly: [], monthly: [] };
    for (const p of plans ?? []) g[p.period]?.push(p);
    return g;
  }, [plans]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-secondary py-10 justify-center">
        <Loader2 size={14} className="animate-spin" /> Loading Shield…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Active plan */}
      {active ? (
        <ActivePlanCard plan={active} />
      ) : (
        <div
          className="rounded-2xl p-4 md:p-5 flex items-center gap-3"
          style={{ background: 'var(--bg-card)', border: `1px solid ${LIME}33` }}
        >
          <ShieldCheck size={20} style={{ color: LIME }} />
          <p className="text-sm text-text-secondary">
            No active Shield plan. Pick one below to cover a share of your losses over a full period.
          </p>
        </div>
      )}

      {/* Catalog */}
      {PERIOD_ORDER.map((period) => {
        const list = [...grouped[period]].sort((a, b) => a.premium - b.premium);
        if (list.length === 0) return null;
        return (
          <div key={period}>
            <div className="flex items-baseline gap-2 mb-2.5">
              <h3 className="text-sm font-bold text-text-primary">{PERIOD_LABEL[period]}</h3>
              <span className="text-[11px] text-text-tertiary">{PERIOD_SUB[period]}</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {list.map((plan) => {
                const isCurrent =
                  active?.status === 'active' && active.period === plan.period && active.tier === plan.tier;
                return (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    isCurrent={isCurrent}
                    busy={buying === plan.id}
                    onBuy={() => buy(plan)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Shield claim history */}
      <div
        className="rounded-2xl p-4 md:p-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
      >
        <h2 className="text-base font-bold text-text-primary mb-3">Shield claim history</h2>
        {!claims || claims.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-6">
            No Shield settlements yet. When an eligible trade closes in loss while a plan is active,
            the incremental payout shows here.
          </p>
        ) : (
          <ul className="divide-y divide-border-primary">
            {claims.map((c) => {
              const paid = c.payout_amount > 0;
              return (
                <li key={c.id} className="py-3 flex items-center gap-3">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: paid ? '#22c55e' : '#888' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary">
                      Loss ${c.trade_loss.toFixed(2)} →{' '}
                      {paid ? (
                        <span className="font-bold text-green-500">+${c.payout_amount.toFixed(2)}</span>
                      ) : (
                        <span className="text-text-tertiary">no payout ({c.status})</span>
                      )}
                    </p>
                    <p className="text-[10px] text-text-tertiary">
                      cumulative loss ${c.cumulative_eligible_loss.toFixed(2)}
                      {c.created_at ? ` · ${new Date(c.created_at).toLocaleString()}` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ActivePlanCard({ plan }: { plan: ShieldState }) {
  const pct = plan.max_payout > 0 ? Math.min(100, (plan.coverage_used / plan.max_payout) * 100) : 0;
  return (
    <div
      className="rounded-2xl p-4 md:p-5"
      style={{ background: 'var(--bg-card)', border: `1px solid ${LIME}55` }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${LIME}1f` }}
          >
            <ShieldCheck size={20} style={{ color: LIME }} />
          </div>
          <div>
            <p className="text-sm font-bold text-text-primary">
              {TIER_LABEL[plan.tier]} <span className="text-text-tertiary">·</span>{' '}
              {PERIOD_LABEL[plan.period]} Shield
            </p>
            <p className="text-[11px] text-text-tertiary">
              {plan.coverage_pct.toFixed(0)}% of losses covered · cap ${plan.max_payout.toFixed(0)}
            </p>
          </div>
        </div>
        <span className="text-[11px] text-text-secondary inline-flex items-center gap-1">
          <Clock size={12} /> {timeLeft(plan.expires_at)}
        </span>
      </div>

      {/* Coverage usage bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-text-tertiary">Coverage used</span>
          <span className="font-mono tabular-nums text-text-primary">
            ${plan.coverage_used.toFixed(2)} / ${plan.max_payout.toFixed(0)}
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-primary)' }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: LIME }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <Stat label="Remaining cover" value={`$${plan.coverage_remaining.toFixed(2)}`} accent={LIME} />
        <Stat
          label="Cumulative loss"
          value={`$${plan.cumulative_eligible_loss.toFixed(2)}`}
          icon={<TrendingDown size={12} className="text-rose-400" />}
        />
        <Stat label="Premium paid" value={`$${plan.premium_paid.toFixed(2)}`} />
      </div>
    </div>
  );
}

function Stat({
  label, value, accent, icon,
}: { label: string; value: string; accent?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl p-2.5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
      <p className="text-[10px] uppercase tracking-wider text-text-tertiary mb-0.5 flex items-center gap-1">
        {icon}{label}
      </p>
      <p className="text-sm font-bold font-mono tabular-nums" style={{ color: accent || 'var(--text-primary)' }}>
        {value}
      </p>
    </div>
  );
}

function PlanCard({
  plan, isCurrent, busy, onBuy,
}: { plan: ShieldPlan; isCurrent: boolean; busy: boolean; onBuy: () => void }) {
  return (
    <div
      className="rounded-xl p-3 flex flex-col"
      style={{
        background: 'var(--bg-card)',
        border: isCurrent ? `1px solid ${LIME}` : '1px solid var(--border-primary)',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-text-primary">{TIER_LABEL[plan.tier]}</span>
        {isCurrent && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
            style={{ color: '#0a0a0a', background: LIME }}>
            Active
          </span>
        )}
      </div>
      <p className="text-lg font-bold text-text-primary mt-1 leading-none">
        {plan.coverage_pct.toFixed(0)}<span className="text-xs text-text-tertiary">% cover</span>
      </p>
      <p className="text-[11px] text-text-tertiary mt-1">up to ${plan.max_payout.toFixed(0)}</p>

      <div className="mt-3 pt-2.5 border-t border-border-primary flex items-end justify-between gap-2">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-text-tertiary">Premium</p>
          <p className="text-sm font-bold font-mono tabular-nums text-text-primary">${plan.premium.toFixed(0)}</p>
        </div>
        <button
          type="button"
          onClick={onBuy}
          disabled={busy || isCurrent}
          className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg disabled:opacity-50 inline-flex items-center gap-1"
          style={{ color: '#0a0a0a', background: isCurrent ? 'var(--border-primary)' : LIME }}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : isCurrent ? <Check size={12} /> : null}
          {isCurrent ? 'Active' : 'Buy'}
        </button>
      </div>
    </div>
  );
}
