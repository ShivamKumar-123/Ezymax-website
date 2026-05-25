'use client';

/**
 * Admin · Trade Insurance configuration.
 *
 * Surfaces every `insurance_*` system_settings key in a grouped form
 * so admins don't need to know individual keys. Reads from
 *   GET  /admin/insurance/settings
 * and saves changes via
 *   PUT  /admin/insurance/settings  { updates: { ... } }
 *
 * The backend whitelists keys (see admin/routes/insurance.py
 * INSURANCE_KEYS) so even if a stray field sneaks in, only the
 * documented knobs land in the DB. After a successful save the
 * server invalidates the in-memory settings cache so the gateway
 * picks new values on the next quote without a restart.
 */

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, Save, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react';

type Tier = 'basic' | 'advanced' | 'pro' | 'elite';
const TIERS: Tier[] = ['basic', 'advanced', 'pro', 'elite'];
const TIER_LABEL: Record<Tier, string> = {
  basic: 'Basic',
  advanced: 'Advanced',
  pro: 'Pro',
  elite: 'Elite',
};

interface SettingsResponse {
  insurance_enabled?: boolean | null;
  insurance_base_constant?: number | null;
  insurance_tier_multipliers?: Record<string, number> | null;
  insurance_coverage_pct?: Record<string, number> | null;
  insurance_fee_cap?: number | null;
  insurance_fee_cap_high_volume?: number | null;
  insurance_high_volume_lots?: number | null;
  insurance_max_cap_rules?: Record<string, [number, number]> | null;
  insurance_min_trade_duration_seconds?: number | null;
  insurance_anti_abuse_daily_claims?: number | null;
  insurance_anti_abuse_daily_payout?: number | null;
  insurance_anti_abuse_cooldown_hours?: number | null;
  insurance_dynamic_high_lev_threshold?: number | null;
  insurance_dynamic_high_lev_surcharge?: number | null;
  insurance_dynamic_no_sl_surcharge?: number | null;
  insurance_dynamic_winrate_threshold?: number | null;
  insurance_dynamic_winrate_surcharge?: number | null;
  insurance_disable_atr_floor?: number | null;
  insurance_disable_atr_ceiling?: number | null;
  insurance_frequent_claim_count?: number | null;
  insurance_frequent_claim_window_days?: number | null;
  insurance_frequent_claim_coverage_reduction_pct?: number | null;
  insurance_copy_trade_surcharge?: number | null;
  insurance_news_blackout_until?: string | null;
}

interface StatsResponse {
  '24h': { policies_activated: number; claims_paid: number; fee_revenue: number; payouts: number; gross_margin: number };
  '7d':  { policies_activated: number; claims_paid: number; fee_revenue: number; payouts: number; gross_margin: number };
  'all': { policies_activated: number; claims_paid: number; fee_revenue: number; payouts: number; gross_margin: number };
  top_claimants: Array<{ user_id: string; total_payout: number }>;
}

/** Defaults baked into backend `_DEFAULTS` — used as form fallbacks when
 *  a setting row hasn't been written yet. Keep in sync with
 *  packages/common/src/insurance/config.py:_DEFAULTS. */
const DEFAULTS = {
  enabled: true,
  base_constant: 1.2,
  multipliers: { basic: 1, advanced: 2, pro: 3, elite: 4 } as Record<Tier, number>,
  coverage: { basic: 20, advanced: 30, pro: 40, elite: 50 } as Record<Tier, number>,
  fee_cap: 6.0,
  fee_cap_high_volume: 12.0,
  high_volume_lots: 5.0,
  caps_usd: { basic: 100, advanced: 300, pro: 600, elite: 1000 } as Record<Tier, number>,
  caps_pct: { basic: 0.10, advanced: 0.20, pro: 0.30, elite: 0.50 } as Record<Tier, number>,
  min_trade_duration_seconds: 300,
  daily_claims: 2,
  daily_payout: 2000,
  cooldown_hours: 12,
  high_lev_threshold: 200,
  high_lev_surcharge: 0.20,
  no_sl_surcharge: 0.15,
  winrate_threshold: 0.65,
  winrate_surcharge: 0.15,
  atr_floor: 0.0001,
  atr_ceiling: '' as string | number,
  frequent_claim_count: 4,
  frequent_claim_window_days: 30,
  frequent_claim_coverage_reduction_pct: 0.25,
  copy_trade_surcharge: 0.10,
  news_blackout_until: '' as string,
};

export default function AdminInsurancePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<StatsResponse | null>(null);

  // Single state object keyed by the backend setting key. We load from
  // server, edit in place, then PUT back the keys that changed.
  const [form, setForm] = useState({
    insurance_enabled: DEFAULTS.enabled,
    insurance_base_constant: DEFAULTS.base_constant,
    multipliers: { ...DEFAULTS.multipliers },
    coverage: { ...DEFAULTS.coverage },
    insurance_fee_cap: DEFAULTS.fee_cap,
    insurance_fee_cap_high_volume: DEFAULTS.fee_cap_high_volume,
    insurance_high_volume_lots: DEFAULTS.high_volume_lots,
    caps_usd: { ...DEFAULTS.caps_usd },
    caps_pct: { ...DEFAULTS.caps_pct },
    insurance_min_trade_duration_seconds: DEFAULTS.min_trade_duration_seconds,
    insurance_anti_abuse_daily_claims: DEFAULTS.daily_claims,
    insurance_anti_abuse_daily_payout: DEFAULTS.daily_payout,
    insurance_anti_abuse_cooldown_hours: DEFAULTS.cooldown_hours,
    insurance_dynamic_high_lev_threshold: DEFAULTS.high_lev_threshold,
    insurance_dynamic_high_lev_surcharge: DEFAULTS.high_lev_surcharge,
    insurance_dynamic_no_sl_surcharge: DEFAULTS.no_sl_surcharge,
    insurance_dynamic_winrate_threshold: DEFAULTS.winrate_threshold,
    insurance_dynamic_winrate_surcharge: DEFAULTS.winrate_surcharge,
    insurance_disable_atr_floor: DEFAULTS.atr_floor,
    insurance_disable_atr_ceiling: '' as string,
    insurance_frequent_claim_count: DEFAULTS.frequent_claim_count,
    insurance_frequent_claim_window_days: DEFAULTS.frequent_claim_window_days,
    insurance_frequent_claim_coverage_reduction_pct: DEFAULTS.frequent_claim_coverage_reduction_pct,
    insurance_copy_trade_surcharge: DEFAULTS.copy_trade_surcharge,
    insurance_news_blackout_until: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, st] = await Promise.all([
        adminApi.get<SettingsResponse>('/insurance/settings'),
        adminApi.get<StatsResponse>('/insurance/stats'),
      ]);
      setStats(st);
      setForm((prev) => ({
        ...prev,
        insurance_enabled: s.insurance_enabled ?? DEFAULTS.enabled,
        insurance_base_constant: s.insurance_base_constant ?? DEFAULTS.base_constant,
        multipliers: {
          basic: s.insurance_tier_multipliers?.basic ?? DEFAULTS.multipliers.basic,
          advanced: s.insurance_tier_multipliers?.advanced ?? DEFAULTS.multipliers.advanced,
          pro: s.insurance_tier_multipliers?.pro ?? DEFAULTS.multipliers.pro,
          elite: s.insurance_tier_multipliers?.elite ?? DEFAULTS.multipliers.elite,
        },
        coverage: {
          basic: s.insurance_coverage_pct?.basic ?? DEFAULTS.coverage.basic,
          advanced: s.insurance_coverage_pct?.advanced ?? DEFAULTS.coverage.advanced,
          pro: s.insurance_coverage_pct?.pro ?? DEFAULTS.coverage.pro,
          elite: s.insurance_coverage_pct?.elite ?? DEFAULTS.coverage.elite,
        },
        insurance_fee_cap: s.insurance_fee_cap ?? DEFAULTS.fee_cap,
        insurance_fee_cap_high_volume: s.insurance_fee_cap_high_volume ?? DEFAULTS.fee_cap_high_volume,
        insurance_high_volume_lots: s.insurance_high_volume_lots ?? DEFAULTS.high_volume_lots,
        caps_usd: {
          basic: s.insurance_max_cap_rules?.basic?.[0] ?? DEFAULTS.caps_usd.basic,
          advanced: s.insurance_max_cap_rules?.advanced?.[0] ?? DEFAULTS.caps_usd.advanced,
          pro: s.insurance_max_cap_rules?.pro?.[0] ?? DEFAULTS.caps_usd.pro,
          elite: s.insurance_max_cap_rules?.elite?.[0] ?? DEFAULTS.caps_usd.elite,
        },
        caps_pct: {
          basic: s.insurance_max_cap_rules?.basic?.[1] ?? DEFAULTS.caps_pct.basic,
          advanced: s.insurance_max_cap_rules?.advanced?.[1] ?? DEFAULTS.caps_pct.advanced,
          pro: s.insurance_max_cap_rules?.pro?.[1] ?? DEFAULTS.caps_pct.pro,
          elite: s.insurance_max_cap_rules?.elite?.[1] ?? DEFAULTS.caps_pct.elite,
        },
        insurance_min_trade_duration_seconds: s.insurance_min_trade_duration_seconds ?? DEFAULTS.min_trade_duration_seconds,
        insurance_anti_abuse_daily_claims: s.insurance_anti_abuse_daily_claims ?? DEFAULTS.daily_claims,
        insurance_anti_abuse_daily_payout: s.insurance_anti_abuse_daily_payout ?? DEFAULTS.daily_payout,
        insurance_anti_abuse_cooldown_hours: s.insurance_anti_abuse_cooldown_hours ?? DEFAULTS.cooldown_hours,
        insurance_dynamic_high_lev_threshold: s.insurance_dynamic_high_lev_threshold ?? DEFAULTS.high_lev_threshold,
        insurance_dynamic_high_lev_surcharge: s.insurance_dynamic_high_lev_surcharge ?? DEFAULTS.high_lev_surcharge,
        insurance_dynamic_no_sl_surcharge: s.insurance_dynamic_no_sl_surcharge ?? DEFAULTS.no_sl_surcharge,
        insurance_dynamic_winrate_threshold: s.insurance_dynamic_winrate_threshold ?? DEFAULTS.winrate_threshold,
        insurance_dynamic_winrate_surcharge: s.insurance_dynamic_winrate_surcharge ?? DEFAULTS.winrate_surcharge,
        insurance_disable_atr_floor: s.insurance_disable_atr_floor ?? DEFAULTS.atr_floor,
        insurance_disable_atr_ceiling: s.insurance_disable_atr_ceiling == null ? '' : String(s.insurance_disable_atr_ceiling),
        insurance_frequent_claim_count: s.insurance_frequent_claim_count ?? DEFAULTS.frequent_claim_count,
        insurance_frequent_claim_window_days: s.insurance_frequent_claim_window_days ?? DEFAULTS.frequent_claim_window_days,
        insurance_frequent_claim_coverage_reduction_pct: s.insurance_frequent_claim_coverage_reduction_pct ?? DEFAULTS.frequent_claim_coverage_reduction_pct,
        insurance_copy_trade_surcharge: s.insurance_copy_trade_surcharge ?? DEFAULTS.copy_trade_surcharge,
        insurance_news_blackout_until: s.insurance_news_blackout_until || '',
      }));
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
        || (e as { message?: string })?.message
        || 'Failed to load insurance settings';
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      // Re-shape form state back into the keys the backend expects.
      // `max_cap_rules` is a nested map; multipliers/coverage are flat maps.
      const updates: Record<string, unknown> = {
        insurance_enabled: form.insurance_enabled,
        insurance_base_constant: form.insurance_base_constant,
        insurance_tier_multipliers: form.multipliers,
        insurance_coverage_pct: form.coverage,
        insurance_fee_cap: form.insurance_fee_cap,
        insurance_fee_cap_high_volume: form.insurance_fee_cap_high_volume,
        insurance_high_volume_lots: form.insurance_high_volume_lots,
        insurance_max_cap_rules: {
          basic: [form.caps_usd.basic, form.caps_pct.basic],
          advanced: [form.caps_usd.advanced, form.caps_pct.advanced],
          pro: [form.caps_usd.pro, form.caps_pct.pro],
          elite: [form.caps_usd.elite, form.caps_pct.elite],
        },
        insurance_min_trade_duration_seconds: form.insurance_min_trade_duration_seconds,
        insurance_anti_abuse_daily_claims: form.insurance_anti_abuse_daily_claims,
        insurance_anti_abuse_daily_payout: form.insurance_anti_abuse_daily_payout,
        insurance_anti_abuse_cooldown_hours: form.insurance_anti_abuse_cooldown_hours,
        insurance_dynamic_high_lev_threshold: form.insurance_dynamic_high_lev_threshold,
        insurance_dynamic_high_lev_surcharge: form.insurance_dynamic_high_lev_surcharge,
        insurance_dynamic_no_sl_surcharge: form.insurance_dynamic_no_sl_surcharge,
        insurance_dynamic_winrate_threshold: form.insurance_dynamic_winrate_threshold,
        insurance_dynamic_winrate_surcharge: form.insurance_dynamic_winrate_surcharge,
        insurance_disable_atr_floor: form.insurance_disable_atr_floor,
        insurance_disable_atr_ceiling: form.insurance_disable_atr_ceiling === '' ? null : Number(form.insurance_disable_atr_ceiling),
        insurance_frequent_claim_count: form.insurance_frequent_claim_count,
        insurance_frequent_claim_window_days: form.insurance_frequent_claim_window_days,
        insurance_frequent_claim_coverage_reduction_pct: form.insurance_frequent_claim_coverage_reduction_pct,
        insurance_copy_trade_surcharge: form.insurance_copy_trade_surcharge,
        insurance_news_blackout_until: form.insurance_news_blackout_until || null,
      };
      await adminApi.put('/insurance/settings', { updates });
      toast.success('Insurance settings updated');
      await load();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
        || (e as { message?: string })?.message
        || 'Save failed';
      toast.error(detail);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#d6a93d]/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#d6a93d]" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-text-primary">Trade Insurance</h1>
            <p className="text-xs text-text-secondary mt-0.5">
              Premium rules, coverage caps, anti-abuse, and dynamic adjustments.
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
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#d6a93d] text-bg-base text-xs font-bold hover:brightness-110 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save changes
          </button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(['24h', '7d', 'all'] as const).map((k) => (
            <div key={k} className="rounded-xl border border-border-primary bg-bg-secondary p-4">
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-bold mb-2">
                {k === '24h' ? 'Last 24h' : k === '7d' ? 'Last 7 days' : 'All time'}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <span className="text-text-tertiary">Policies</span>
                <span className="text-text-primary font-mono font-bold tabular-nums text-right">
                  {stats[k].policies_activated.toLocaleString()}
                </span>
                <span className="text-text-tertiary">Claims paid</span>
                <span className="text-text-primary font-mono font-bold tabular-nums text-right">
                  {stats[k].claims_paid.toLocaleString()}
                </span>
                <span className="text-text-tertiary">Fee revenue</span>
                <span className="text-emerald-400 font-mono font-bold tabular-nums text-right">
                  ${stats[k].fee_revenue.toFixed(2)}
                </span>
                <span className="text-text-tertiary">Payouts</span>
                <span className="text-rose-400 font-mono font-bold tabular-nums text-right">
                  ${stats[k].payouts.toFixed(2)}
                </span>
                <span className="text-text-tertiary border-t border-border-primary pt-1.5 mt-0.5">Gross margin</span>
                <span className={`font-mono font-bold tabular-nums text-right border-t border-border-primary pt-1.5 mt-0.5 ${stats[k].gross_margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ${stats[k].gross_margin.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Master enable + pricing */}
      <Section title="Master Switch & Pricing">
        <Row>
          <Toggle
            label="Insurance enabled platform-wide"
            value={form.insurance_enabled}
            onChange={(v) => setForm((f) => ({ ...f, insurance_enabled: v }))}
            help="When OFF, /insurance/quote returns an empty plans list and the order panel hides the tier picker."
          />
        </Row>
        <Row>
          <Num
            label="Base constant (USD per RiskScore unit)"
            value={form.insurance_base_constant}
            step={0.05}
            onChange={(v) => setForm((f) => ({ ...f, insurance_base_constant: v }))}
            help="BaseFee = RiskScore × this. Higher = more expensive premiums across the board."
          />
        </Row>
        <Row>
          <Num
            label="Fee cap — normal trades"
            value={form.insurance_fee_cap}
            step={0.5}
            prefix="$"
            onChange={(v) => setForm((f) => ({ ...f, insurance_fee_cap: v }))}
          />
          <Num
            label="Fee cap — high volume"
            value={form.insurance_fee_cap_high_volume}
            step={0.5}
            prefix="$"
            onChange={(v) => setForm((f) => ({ ...f, insurance_fee_cap_high_volume: v }))}
          />
          <Num
            label="High volume threshold (lots)"
            value={form.insurance_high_volume_lots}
            step={0.5}
            onChange={(v) => setForm((f) => ({ ...f, insurance_high_volume_lots: v }))}
            help="Trades ≥ this lots use the higher cap."
          />
        </Row>
      </Section>

      {/* Per-tier table */}
      <Section title="Tiers (Multiplier × BaseFee = TierFee)">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-text-tertiary">
              <tr>
                <th className="text-left py-2 pr-2 font-bold">Tier</th>
                <th className="text-right py-2 px-2 font-bold">Fee multiplier</th>
                <th className="text-right py-2 px-2 font-bold">Coverage %</th>
                <th className="text-right py-2 px-2 font-bold">Max cap (USD)</th>
                <th className="text-right py-2 px-2 font-bold">Or % of trade</th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map((t) => (
                <tr key={t} className="border-t border-border-primary">
                  <td className="py-2 pr-2 font-bold text-text-primary">{TIER_LABEL[t]}</td>
                  <td className="py-2 px-2">
                    <InlineNum value={form.multipliers[t]} step={0.25} onChange={(v) => setForm((f) => ({ ...f, multipliers: { ...f.multipliers, [t]: v } }))} suffix="×" />
                  </td>
                  <td className="py-2 px-2">
                    <InlineNum value={form.coverage[t]} step={5} onChange={(v) => setForm((f) => ({ ...f, coverage: { ...f.coverage, [t]: v } }))} suffix="%" />
                  </td>
                  <td className="py-2 px-2">
                    <InlineNum value={form.caps_usd[t]} step={50} onChange={(v) => setForm((f) => ({ ...f, caps_usd: { ...f.caps_usd, [t]: v } }))} prefix="$" />
                  </td>
                  <td className="py-2 px-2">
                    <InlineNum value={form.caps_pct[t]} step={0.05} onChange={(v) => setForm((f) => ({ ...f, caps_pct: { ...f.caps_pct, [t]: v } }))} suffix={`× T`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-text-tertiary mt-2 leading-relaxed">
          Effective cap = <span className="font-mono">min(Max cap USD, % of trade × trade size)</span>. Claim payout
          = <span className="font-mono">min(Loss × Coverage%, effective cap)</span>.
        </p>
      </Section>

      {/* Anti-abuse */}
      <Section title="Anti-abuse Limits">
        <Row>
          <Num
            label="Max insured trades per day"
            value={form.insurance_anti_abuse_daily_claims}
            step={1}
            onChange={(v) => setForm((f) => ({ ...f, insurance_anti_abuse_daily_claims: v }))}
          />
          <Num
            label="Max daily payout per user"
            value={form.insurance_anti_abuse_daily_payout}
            step={100}
            prefix="$"
            onChange={(v) => setForm((f) => ({ ...f, insurance_anti_abuse_daily_payout: v }))}
          />
          <Num
            label="Cooldown after claim (hours)"
            value={form.insurance_anti_abuse_cooldown_hours}
            step={1}
            onChange={(v) => setForm((f) => ({ ...f, insurance_anti_abuse_cooldown_hours: v }))}
          />
        </Row>
        <Row>
          <Num
            label="Minimum trade open duration (seconds)"
            value={form.insurance_min_trade_duration_seconds}
            step={30}
            onChange={(v) => setForm((f) => ({ ...f, insurance_min_trade_duration_seconds: v }))}
            help="Trades closed faster than this don't qualify for claim — prevents instant scalps."
          />
        </Row>
        <Row>
          <Num
            label="Frequent claimer threshold (claims)"
            value={form.insurance_frequent_claim_count}
            step={1}
            onChange={(v) => setForm((f) => ({ ...f, insurance_frequent_claim_count: v }))}
          />
          <Num
            label="Window (days)"
            value={form.insurance_frequent_claim_window_days}
            step={1}
            onChange={(v) => setForm((f) => ({ ...f, insurance_frequent_claim_window_days: v }))}
          />
          <Num
            label="Coverage reduction"
            value={form.insurance_frequent_claim_coverage_reduction_pct}
            step={0.05}
            suffix=" (frac)"
            onChange={(v) => setForm((f) => ({ ...f, insurance_frequent_claim_coverage_reduction_pct: v }))}
            help="0.25 = 25% off all tier coverages for frequent claimers."
          />
        </Row>
      </Section>

      {/* Dynamic adjustments */}
      <Section title="Dynamic Fee Adjustments">
        <Row>
          <Num
            label="High leverage threshold"
            value={form.insurance_dynamic_high_lev_threshold}
            step={50}
            onChange={(v) => setForm((f) => ({ ...f, insurance_dynamic_high_lev_threshold: v }))}
            help="Surcharge applied when account leverage exceeds this."
          />
          <Num
            label="High leverage surcharge"
            value={form.insurance_dynamic_high_lev_surcharge}
            step={0.05}
            suffix=" (frac)"
            onChange={(v) => setForm((f) => ({ ...f, insurance_dynamic_high_lev_surcharge: v }))}
            help="0.20 = +20% fee."
          />
          <Num
            label="No stop-loss surcharge"
            value={form.insurance_dynamic_no_sl_surcharge}
            step={0.05}
            suffix=" (frac)"
            onChange={(v) => setForm((f) => ({ ...f, insurance_dynamic_no_sl_surcharge: v }))}
          />
        </Row>
        <Row>
          <Num
            label="Winning trader threshold (win rate)"
            value={form.insurance_dynamic_winrate_threshold}
            step={0.05}
            suffix=" (frac)"
            onChange={(v) => setForm((f) => ({ ...f, insurance_dynamic_winrate_threshold: v }))}
            help="0.65 = 65% win rate triggers the surcharge."
          />
          <Num
            label="Winning trader surcharge"
            value={form.insurance_dynamic_winrate_surcharge}
            step={0.05}
            suffix=" (frac)"
            onChange={(v) => setForm((f) => ({ ...f, insurance_dynamic_winrate_surcharge: v }))}
          />
          <Num
            label="Copy-trade surcharge"
            value={form.insurance_copy_trade_surcharge}
            step={0.05}
            suffix=" (frac)"
            onChange={(v) => setForm((f) => ({ ...f, insurance_copy_trade_surcharge: v }))}
            help="Applied when quote is requested for a copy-trade order."
          />
        </Row>
      </Section>

      {/* Volatility / News */}
      <Section title="Disable Conditions">
        <Row>
          <Num
            label="ATR floor"
            value={form.insurance_disable_atr_floor}
            step={0.0001}
            onChange={(v) => setForm((f) => ({ ...f, insurance_disable_atr_floor: v }))}
            help="Below this ATR(14) the market is 'too quiet' / synthetic — refuse to quote."
          />
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              ATR ceiling (blank = no cap)
            </label>
            <input
              type="number"
              step={0.0001}
              value={form.insurance_disable_atr_ceiling}
              onChange={(e) => setForm((f) => ({ ...f, insurance_disable_atr_ceiling: e.target.value }))}
              placeholder="e.g. 0.005"
              className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border-primary text-sm text-text-primary focus:border-[#d6a93d] focus:outline-none"
            />
            <p className="text-[10px] text-text-tertiary leading-relaxed">
              Above this ATR the market is 'too volatile' — refuse to quote. Blank = no ceiling.
            </p>
          </div>
        </Row>
        <Row>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary inline-flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              News blackout until (UTC)
            </label>
            <input
              type="datetime-local"
              value={form.insurance_news_blackout_until?.slice(0, 16) || ''}
              onChange={(e) => setForm((f) => ({ ...f, insurance_news_blackout_until: e.target.value ? `${e.target.value}:00Z` : '' }))}
              className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border-primary text-sm text-text-primary focus:border-[#d6a93d] focus:outline-none"
            />
            <p className="text-[10px] text-text-tertiary leading-relaxed">
              While set in the future, /insurance/quote returns no plans (used during CPI/NFP release windows).
            </p>
          </div>
        </Row>
      </Section>

      {/* Top claimants (fraud watch) */}
      {stats?.top_claimants && stats.top_claimants.length > 0 && (
        <Section title="Top claimants (lifetime)">
          <div className="overflow-x-auto">
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
          <p className="text-[10px] text-text-tertiary mt-2">
            High-payout users are a fraud-watch signal — investigate before raising daily payout caps.
          </p>
        </Section>
      )}
    </div>
  );
}

// ─── Small UI primitives ──────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border-primary bg-bg-secondary p-4 md:p-5 space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-text-tertiary">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{children}</div>;
}

function Num({
  label, value, onChange, step = 1, prefix, suffix, help,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  prefix?: string;
  suffix?: string;
  help?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary block">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-full ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-12' : 'pr-3'} py-2 rounded-lg bg-bg-base border border-border-primary text-sm text-text-primary focus:border-[#d6a93d] focus:outline-none`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary text-xs pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {help && <p className="text-[10px] text-text-tertiary leading-relaxed">{help}</p>}
    </div>
  );
}

function InlineNum({
  value, onChange, step = 1, prefix, suffix,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="relative inline-block w-28">
      {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary text-[10px] pointer-events-none">{prefix}</span>}
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full ${prefix ? 'pl-5' : 'pl-2'} ${suffix ? 'pr-7' : 'pr-2'} py-1 rounded bg-bg-base border border-border-primary text-xs text-text-primary text-right tabular-nums font-mono focus:border-[#d6a93d] focus:outline-none`}
      />
      {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary text-[10px] pointer-events-none">{suffix}</span>}
    </div>
  );
}

function Toggle({
  label, value, onChange, help,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  help?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 md:col-span-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-text-primary">{label}</div>
        {help && <p className="text-[11px] text-text-tertiary leading-relaxed mt-0.5">{help}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`shrink-0 w-11 h-6 rounded-full relative transition-colors border ${
          value ? 'bg-[#d6a93d] border-[#d6a93d]' : 'bg-bg-base border-border-primary'
        }`}
      >
        <span
          className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-all ${
            value ? 'left-[20px]' : 'left-[2px]'
          }`}
        />
      </button>
    </div>
  );
}
