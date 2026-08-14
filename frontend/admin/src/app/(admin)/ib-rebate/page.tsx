'use client';

/**
 * Admin · IB Rebate (Milele-style tiered per-lot accrual).
 *
 * Edit the tier ladder / overrides / active-client rules, switch the payout
 * model (instant ↔ accrual), run a settlement pass, and view the current
 * period. Backed by /api/v1/admin/ib-rebate/{config,run,periods,settlements}
 * (backend/services/admin/routes/ib_rebate.py).
 */
import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, Save, RefreshCw, Play, Plus, Trash2, Network, AlertTriangle } from 'lucide-react';

const LIME = '#ccff00';

interface Tier { tier: string; min_lots: number; min_clients: number; rate: number }
interface Config {
  model: 'instant' | 'accrual';
  tiers: Tier[];
  override_pcts: number[];
  override_cap_pct: number;
  override_max_levels: number;
  active_min_lots: number;
  active_require_kyc: boolean;
  active_require_deposit: boolean;
  all_instruments: boolean;
}
interface PeriodRow {
  ib_id: string; referral_code: string; name: string; tier: string;
  eligible_lots: number; active_clients: number; rate_per_lot: number;
  own_target: number; own_settled: number; override_settled: number;
}

export default function AdminIbRebatePage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [period, setPeriod] = useState<{ period: string; rows: PeriodRow[]; totals: { own_settled: number; override_settled: number; ibs: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        adminApi.get<Config>('/ib-rebate/config'),
        adminApi.get<typeof period>('/ib-rebate/periods'),
      ]);
      setCfg(c);
      setPeriod(p);
    } catch (e) {
      toast.error(errMsg(e, 'Failed to load IB rebate config'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      await adminApi.put('/ib-rebate/config', cfg);
      toast.success('IB rebate config saved');
      await load();
    } catch (e) {
      toast.error(errMsg(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    setRunning(true);
    try {
      const res = await adminApi.post<{ ibs_paid?: number; own_paid?: number; override_paid?: number; skipped?: string }>('/ib-rebate/run', {});
      if (res.skipped) toast(`Settlement dry-run (${res.skipped})`);
      else toast.success(`Settled: ${res.ibs_paid} IBs · $${(res.own_paid ?? 0).toFixed(2)} own · $${(res.override_paid ?? 0).toFixed(2)} override`);
      await load();
    } catch (e) {
      toast.error(errMsg(e, 'Settlement failed'));
    } finally {
      setRunning(false);
    }
  };

  if (loading || !cfg) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-text-tertiary" /></div>;
  }

  const editTier = (i: number, field: keyof Tier, value: number | string) =>
    setCfg({ ...cfg, tiers: cfg.tiers.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)) });

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${LIME}1a` }}>
            <Network className="w-5 h-5" style={{ color: LIME }} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-text-primary">IB Rebate</h1>
            <p className="text-xs text-text-secondary mt-0.5">Tiered per-closed-lot rebate + multi-level overrides (Milele model).</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-primary bg-bg-secondary text-xs text-text-secondary hover:text-text-primary">
            <RefreshCw className="w-3.5 h-3.5" /> Reload
          </button>
          <button type="button" onClick={() => void run()} disabled={running} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold disabled:opacity-60" style={{ borderColor: `${LIME}55`, color: LIME }}>
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Run settlement
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-60" style={{ color: '#0a0a0a', background: LIME }}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save config
          </button>
        </div>
      </div>

      {/* Model switch */}
      <div className="rounded-xl border p-4" style={{ borderColor: cfg.model === 'accrual' ? `${LIME}55` : 'var(--border-primary)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-text-primary">Payout model</h2>
            <p className="text-[11px] text-text-tertiary mt-0.5">
              <b>instant</b> = legacy flat per-lot credited at trade fill. <b>accrual</b> = this tiered model, settled by the run job.
            </p>
          </div>
          <div className="inline-flex rounded-lg p-1 gap-1" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-primary)' }}>
            {(['instant', 'accrual'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setCfg({ ...cfg, model: m })}
                className="text-xs font-bold px-4 py-1.5 rounded-md"
                style={cfg.model === m ? { color: '#0a0a0a', background: LIME } : { color: 'var(--text-secondary)', background: 'transparent' }}>
                {m}
              </button>
            ))}
          </div>
        </div>
        {cfg.model === 'accrual' && (
          <div className="mt-3 flex items-start gap-2 text-[11px] rounded-lg p-2.5" style={{ background: '#f59e0b14', border: '1px solid #f59e0b40', color: '#fbbf24' }}>
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Accrual mode: the instant per-fill payout is OFF. Rebates only pay when the settlement job runs (daily scheduler or the “Run settlement” button). Make sure the scheduler is live before relying on this.</span>
          </div>
        )}
      </div>

      {/* Tier ladder */}
      <Section title="Tier ladder (per closed lot)">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[520px]">
            <thead className="text-[10px] uppercase tracking-wider text-text-tertiary">
              <tr><th className="text-left py-2 pr-2">Tier</th><th className="text-right py-2 px-2">Min lots</th><th className="text-right py-2 px-2">Min active clients</th><th className="text-right py-2 px-2">Rate ($/lot)</th><th /></tr>
            </thead>
            <tbody>
              {cfg.tiers.map((t, i) => (
                <tr key={i} className="border-t border-border-primary">
                  <td className="py-2 pr-2"><input className="inp font-semibold" value={t.tier} onChange={(e) => editTier(i, 'tier', e.target.value)} /></td>
                  <td className="py-2 px-2 w-28"><input type="number" className="inp text-right font-mono" value={t.min_lots} onChange={(e) => editTier(i, 'min_lots', Number(e.target.value))} /></td>
                  <td className="py-2 px-2 w-28"><input type="number" className="inp text-right font-mono" value={t.min_clients} onChange={(e) => editTier(i, 'min_clients', Number(e.target.value))} /></td>
                  <td className="py-2 px-2 w-24"><input type="number" className="inp text-right font-mono" value={t.rate} onChange={(e) => editTier(i, 'rate', Number(e.target.value))} /></td>
                  <td className="py-2 pl-2 text-center"><button type="button" onClick={() => setCfg({ ...cfg, tiers: cfg.tiers.filter((_, idx) => idx !== i) })} className="text-text-tertiary hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => setCfg({ ...cfg, tiers: [...cfg.tiers, { tier: 'new', min_lots: 0, min_clients: 0, rate: 0 }] })} className="mt-2 inline-flex items-center gap-1 text-[11px] text-text-secondary hover:text-text-primary"><Plus className="w-3 h-3" /> Add tier</button>
        <p className="text-[11px] text-text-tertiary mt-1">Highest tier whose <b>both</b> thresholds (lots + active clients) are met wins. A per-IB custom rate (on the agent) overrides the ladder.</p>
      </Section>

      {/* Overrides + thresholds */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Upline overrides">
          <Row label="Override % by level (comma list)">
            <input className="inp" value={cfg.override_pcts.join(', ')} onChange={(e) => setCfg({ ...cfg, override_pcts: e.target.value.split(',').map((x) => Number(x.trim())).filter((n) => !Number.isNaN(n)) })} />
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Total cap (%)"><input type="number" className="inp" value={cfg.override_cap_pct} onChange={(e) => setCfg({ ...cfg, override_cap_pct: Number(e.target.value) })} /></Row>
            <Row label="Max levels"><input type="number" className="inp" value={cfg.override_max_levels} onChange={(e) => setCfg({ ...cfg, override_max_levels: Number(e.target.value) })} /></Row>
          </div>
          <p className="text-[11px] text-text-tertiary">Beyond the list, % halves each level; total is capped. L1 needs ≥1 active client; L2+ needs Builder+.</p>
        </Section>

        <Section title="Active-client rule">
          <Row label="Min closed lots / month"><input type="number" step="0.1" className="inp" value={cfg.active_min_lots} onChange={(e) => setCfg({ ...cfg, active_min_lots: Number(e.target.value) })} /></Row>
          <Toggle label="Must be KYC-verified" value={cfg.active_require_kyc} onChange={(v) => setCfg({ ...cfg, active_require_kyc: v })} />
          <Toggle label="Must have deposited" value={cfg.active_require_deposit} onChange={(v) => setCfg({ ...cfg, active_require_deposit: v })} />
          <Toggle label="Count all instruments" value={cfg.all_instruments} onChange={(v) => setCfg({ ...cfg, all_instruments: v })} />
        </Section>
      </div>

      {/* Period report */}
      {period && (
        <Section title={`This period — ${period.period}`}>
          <div className="grid grid-cols-3 gap-3 mb-3 text-xs">
            <Stat label="IBs" value={String(period.totals.ibs)} />
            <Stat label="Own settled" value={`$${period.totals.own_settled.toFixed(2)}`} accent="#22c55e" />
            <Stat label="Override settled" value={`$${period.totals.override_settled.toFixed(2)}`} accent={LIME} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[720px]">
              <thead className="text-[10px] uppercase tracking-wider text-text-tertiary">
                <tr><th className="text-left py-2 pr-2">IB</th><th className="text-left py-2 px-2">Tier</th><th className="text-right py-2 px-2">Lots</th><th className="text-right py-2 px-2">Active</th><th className="text-right py-2 px-2">Rate</th><th className="text-right py-2 px-2">Own settled</th><th className="text-right py-2 px-2">Override</th></tr>
              </thead>
              <tbody>
                {period.rows.map((r) => (
                  <tr key={r.ib_id} className="border-t border-border-primary">
                    <td className="py-2 pr-2"><span className="font-semibold text-text-primary">{r.name}</span><span className="block text-[10px] text-text-tertiary font-mono">{r.referral_code}</span></td>
                    <td className="py-2 px-2"><span className="text-[10px] uppercase font-bold" style={{ color: LIME }}>{r.tier}</span></td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">{r.eligible_lots.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">{r.active_clients}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">${r.rate_per_lot.toFixed(0)}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-emerald-400">${r.own_settled.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums" style={{ color: LIME }}>${r.override_settled.toFixed(2)}</td>
                  </tr>
                ))}
                {period.rows.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-text-secondary">No IB activity this period yet. Run settlement to populate.</td></tr>}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <style jsx>{`
        .inp { width: 100%; padding: 6px 8px; border-radius: 8px; background: var(--bg-base, #0a0a0a); border: 1px solid var(--border-primary); color: var(--text-primary); font-size: 12px; outline: none; }
        .inp:focus { border-color: ${LIME}; }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border-primary bg-bg-secondary p-4 md:p-5 space-y-3"><h2 className="text-sm font-bold uppercase tracking-wider text-text-tertiary">{title}</h2>{children}</section>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-[10px] uppercase tracking-wider text-text-tertiary font-bold">{label}</span>{children}</label>;
}
function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return <div className="rounded-lg border border-border-primary bg-bg-base p-3"><p className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</p><p className="text-base font-bold font-mono tabular-nums" style={{ color: accent || 'var(--text-primary)' }}>{value}</p></div>;
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-text-secondary">{label}</span>
      <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className="w-10 h-5 rounded-full relative transition-colors border shrink-0" style={value ? { background: LIME, borderColor: LIME } : { background: 'var(--bg-base)', borderColor: 'var(--border-primary)' }}>
        <span className="absolute top-[1px] w-[16px] h-[16px] rounded-full bg-white transition-all" style={{ left: value ? '19px' : '2px' }} />
      </button>
    </div>
  );
}
function errMsg(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail || (e as { message?: string })?.message || fallback;
}
