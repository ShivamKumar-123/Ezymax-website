'use client';

/**
 * Ezymex Shield — aggregate period-plan insurance panel.
 *
 * Separate product from the per-trade micro-insurance. The user buys ONE plan
 * (Daily / Weekly / Monthly) at a tier; it covers a share of their *cumulative*
 * realized loss over that window, up to a cap. This panel shows the active plan
 * + usage, the buyable catalog, and the Shield claim history.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldCheck, Clock, TrendingDown, Check, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  shieldApi,
  type ShieldPlan,
  type ShieldState,
  type ShieldClaim,
  type ShieldEvent,
  type ShieldRules,
  type ShieldPeriod,
  type ShieldTier,
} from '@/lib/api/insurance';

const LIME = '#1E88FF';

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
  const [rules, setRules] = useState<ShieldRules | null>(null);
  const [active, setActive] = useState<ShieldState | null>(null);
  const [claims, setClaims] = useState<ShieldClaim[] | null>(null);
  const [events, setEvents] = useState<ShieldEvent[] | null>(null);
  const [summary, setSummary] = useState<{ total_paid: number; paid_count: number; denied_count: number } | null>(null);
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
      setRules(p.rules ?? null);
      setActive(s.active);
      setClaims(c.claims);
      setEvents(c.events ?? []);
      setSummary(c.summary ?? null);
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
          <ShieldCheck size={20} style={{ color: 'var(--accent-ink)' }} />
          <p className="text-sm text-text-secondary">
            No active Shield plan. Pick one below to cover a share of your losses over a full period.
          </p>
        </div>
      )}

      <RulesCard rules={rules} />

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

      <ShieldActivity claims={claims} events={events} summary={summary} />
    </div>
  );
}

/**
 * Cover activity — payouts AND refusals in one list.
 *
 * A denial was only ever written to the audit-event table, never as a claim
 * row, so a trader whose losing trade missed a gate (held under five minutes,
 * opened before the plan, hedged) saw an empty history and no explanation.
 * They lost money, got nothing, and the screen said nothing happened. Both
 * streams are merged here and every refusal carries its reason.
 */
function ShieldActivity({
  claims, events, summary,
}: {
  claims: ShieldClaim[] | null;
  events: ShieldEvent[] | null;
  summary: { total_paid: number; paid_count: number; denied_count: number } | null;
}) {
  type Row = {
    key: string;
    at: number;
    paid: boolean;
    title: string;
    sub: string;
    amount?: number;
  };

  const rows: Row[] = [];
  for (const c of claims ?? []) {
    if (c.payout_amount <= 0) continue; // the refusal side comes from events
    rows.push({
      key: `c-${c.id}`,
      at: c.created_at ? new Date(c.created_at).getTime() : 0,
      paid: true,
      title: `Loss $${c.trade_loss.toFixed(2)} covered`,
      sub: `Cumulative loss $${c.cumulative_eligible_loss.toFixed(2)}`,
      amount: c.payout_amount,
    });
  }
  for (const e of events ?? []) {
    if (e.type !== 'claim_denied') continue;
    rows.push({
      key: `e-${e.id}`,
      at: e.created_at ? new Date(e.created_at).getTime() : 0,
      paid: false,
      title: 'Trade not covered',
      sub: e.reason || e.detail || 'Did not meet the cover conditions.',
    });
  }
  rows.sort((a, b) => b.at - a.at);

  return (
    <div
      className="rounded-2xl p-4 md:p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
    >
      <h2 className="text-base font-bold text-text-primary">Cover activity</h2>
      <p className="text-[11px] text-text-tertiary mt-0.5">
        Every losing trade Shield looked at — what it paid, and what it did not.
      </p>

      {summary && (summary.paid_count > 0 || summary.denied_count > 0) && (
        <div className="grid grid-cols-3 gap-3 mt-4">
          <Stat label="Paid to you" value={`$${summary.total_paid.toFixed(2)}`} accent="var(--accent-ink)" />
          <Stat label="Trades covered" value={String(summary.paid_count)} />
          <Stat label="Not covered" value={String(summary.denied_count)} />
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary text-center py-6">
          Nothing yet. When a losing trade closes while a plan is active, the payout — or the
          reason there wasn&apos;t one — appears here.
        </p>
      ) : (
        <ul className="divide-y divide-border-primary mt-2">
          {rows.map((r) => (
            <li key={r.key} className="py-3 flex items-start gap-3">
              <span
                className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                style={{ background: r.paid ? '#22c55e' : 'var(--text-tertiary)' }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm text-text-primary">{r.title}</p>
                  {r.paid && r.amount !== undefined && (
                    <span className="text-sm font-bold text-green-500 font-mono tabular-nums shrink-0">
                      +${r.amount.toFixed(2)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-text-tertiary mt-0.5">{r.sub}</p>
                {r.at > 0 && (
                  <p className="text-[10px] text-text-tertiary mt-0.5">
                    {new Date(r.at).toLocaleString()}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * What Shield actually covers, shown before the Buy buttons.
 *
 * Every denial in production so far has been the same rule — a trade closed
 * inside five minutes — by traders who had already paid the premium. The
 * conditions existed only in the engine, so the first time anyone learned them
 * was after being refused.
 *
 * The copy comes from the API rather than being written here, so it cannot
 * drift from the engine that enforces it.
 */
function RulesCard({ rules }: { rules: ShieldRules | null }) {
  if (!rules?.items?.length) return null;
  return (
    <div
      className="rounded-2xl p-4 md:p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
    >
      <div className="flex items-center gap-2">
        <Info size={16} className="text-text-tertiary shrink-0" />
        <h2 className="text-base font-bold text-text-primary">What Shield covers</h2>
      </div>
      <p className="text-[11px] text-text-tertiary mt-0.5">
        A losing trade has to meet all four to be covered. Worth reading before you buy.
      </p>
      <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {rules.items.map((r, i) => (
          <li
            key={r.title}
            className="rounded-xl p-3"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
          >
            <p className="text-sm font-semibold text-text-primary">
              <span className="text-text-tertiary font-mono mr-1.5">{i + 1}.</span>
              {r.title}
            </p>
            <p className="text-[11.5px] text-text-secondary mt-1 leading-relaxed">{r.body}</p>
          </li>
        ))}
      </ul>

      {/* Rule 4 in practice. The sentence above is true but the outcome turns
          on which position you close first, which no wording of the rule
          alone conveys — so it is shown, with numbers. */}
      {rules.example && (
        <div
          className="mt-4 rounded-xl p-3.5"
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
        >
          <p className="text-sm font-bold text-text-primary">{rules.example.title}</p>
          <p className="text-[11.5px] text-text-secondary mt-1 leading-relaxed">
            {rules.example.intro}
          </p>
          <ul className="mt-3 space-y-1.5">
            {rules.example.rows.map((r) => (
              <li key={r.action} className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 tabular-nums"
                  style={
                    r.covered
                      ? { background: 'rgba(34,197,94,0.12)', color: '#16a34a' }
                      : { background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }
                  }
                >
                  {r.covered ? 'COVERED' : 'NO'}
                </span>
                <p className="text-[11.5px] leading-relaxed text-text-secondary">
                  <span className="font-semibold text-text-primary">{r.action} — </span>
                  {r.result}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-[11.5px] text-text-secondary mt-3 leading-relaxed">
            {rules.example.footer}
          </p>
        </div>
      )}

      {!!rules.notes?.length && (
        <>
          <h3 className="text-sm font-bold text-text-primary mt-5">How the payout works</h3>
          <ul className="mt-2 space-y-2">
            {rules.notes.map((n) => (
              <li key={n.title} className="flex gap-2.5">
                <span
                  className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: 'var(--accent-ink)' }}
                />
                <p className="text-[11.5px] leading-relaxed text-text-secondary">
                  <span className="font-semibold text-text-primary">{n.title}. </span>
                  {n.body}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
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
            <ShieldCheck size={20} style={{ color: 'var(--accent-ink)' }} />
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
        <Stat label="Remaining cover" value={`$${plan.coverage_remaining.toFixed(2)}`} accent="var(--accent-ink)" />
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
