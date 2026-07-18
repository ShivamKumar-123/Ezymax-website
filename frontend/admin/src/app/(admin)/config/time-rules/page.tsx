'use client';

/**
 * Config → Time Rules
 *
 * Admin sets spread & leverage per time window (preset market session or
 * custom UTC day/hour range). The market-data feed then lets spread
 * fluctuate with live market volatility on top of the configured base
 * (controlled by the Dynamic Spread panel here).
 *
 * Scope in this UI: "All instruments" (default) or a specific instrument.
 * (Segment scope is API-supported and can be added later.)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Clock, Loader2, Plus, Trash2, Pencil, Activity, Save, X, Power,
} from 'lucide-react';

interface Rule {
  id: string;
  name: string;
  scope: string;
  instrument_id: string | null;
  instrument_symbol: string | null;
  segment_id: string | null;
  segment_name: string | null;
  kind: string;
  session: string | null;
  days_of_week: number[] | null;
  start_min: number | null;
  end_min: number | null;
  spread_mode: string;
  spread_multiplier: number | null;
  spread_value: number | null;
  spread_type: string | null;
  leverage_cap: number | null;
  priority: number;
  is_enabled: boolean;
}
interface SessionPreset { slug: string; label: string; days: number[]; start_min: number; end_min: number }
interface Dyn {
  dynamic_spread_enabled: boolean;
  dynamic_spread_max_mult: number;
  dynamic_spread_sensitivity: number;
  dynamic_spread_window_sec: number;
  floating_spread_enabled: boolean;
  floating_spread_markup_pct: number;
  floating_spread_max_mult: number;
  floating_spread_ema_sec: number;
}
interface Instr { id: string; symbol: string }

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function minToHHMM(m: number | null) {
  if (m == null) return '';
  const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function hhmmToMin(s: string) {
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

function emptyForm(): Partial<Rule> {
  return {
    name: '', scope: 'default', instrument_id: null, kind: 'session',
    session: 'london', days_of_week: [0, 1, 2, 3, 4], start_min: 420, end_min: 960,
    spread_mode: 'multiplier', spread_multiplier: 2, spread_value: 2, spread_type: 'pips',
    leverage_cap: null, priority: 0, is_enabled: true,
  };
}

function windowText(r: Rule, sessions: SessionPreset[]) {
  if (r.kind === 'session') {
    const s = sessions.find((x) => x.slug === r.session);
    return s ? `${s.label} (UTC)` : r.session || '—';
  }
  const days = (r.days_of_week || []).map((d) => DOW[d]).join(',');
  return `${days} ${minToHHMM(r.start_min)}–${minToHHMM(r.end_min)} UTC`;
}

export default function TimeRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [sessions, setSessions] = useState<SessionPreset[]>([]);
  const [instruments, setInstruments] = useState<Instr[]>([]);
  const [dyn, setDyn] = useState<Dyn | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Partial<Rule> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s, d] = await Promise.all([
        adminApi.get<Rule[]>('/pricing-rules'),
        adminApi.get<SessionPreset[]>('/pricing-rules/sessions'),
        adminApi.get<Dyn>('/pricing-rules/dynamic-spread'),
      ]);
      setRules(r || []); setSessions(s || []); setDyn(d);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load rules');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.get<{ items?: Instr[] } | Instr[]>('/instruments', { include_inactive: 'false' });
        const items = Array.isArray(res) ? res : (res.items || []);
        setInstruments(items.map((i) => ({ id: i.id, symbol: i.symbol })));
      } catch { /* picker just stays empty */ }
    })();
  }, []);

  const openCreate = () => { setForm(emptyForm()); setEditingId(null); };
  const openEdit = (r: Rule) => { setForm({ ...r }); setEditingId(r.id); };
  const close = () => { setForm(null); setEditingId(null); };

  const saveDyn = async (patch: Partial<Dyn>) => {
    if (!dyn) return;
    const next = { ...dyn, ...patch };
    setDyn(next);
    try {
      const res = await adminApi.put<Dyn>('/pricing-rules/dynamic-spread', patch);
      setDyn(res);
      toast.success('Dynamic spread updated');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
      void load();
    }
  };

  const submit = async () => {
    if (!form) return;
    if (!form.name?.trim()) { toast.error('Name required'); return; }
    if (form.scope === 'instrument' && !form.instrument_id) { toast.error('Pick an instrument'); return; }
    setSaving(true);
    const body: Record<string, unknown> = {
      name: form.name, scope: form.scope,
      instrument_id: form.scope === 'instrument' ? form.instrument_id : null,
      kind: form.kind,
      session: form.kind === 'session' ? form.session : null,
      days_of_week: form.kind === 'custom' ? form.days_of_week : null,
      start_min: form.kind === 'custom' ? form.start_min : null,
      end_min: form.kind === 'custom' ? form.end_min : null,
      spread_mode: form.spread_mode,
      spread_multiplier: form.spread_mode === 'multiplier' ? Number(form.spread_multiplier) : null,
      spread_value: form.spread_mode === 'absolute' ? Number(form.spread_value) : null,
      spread_type: form.spread_type || 'pips',
      leverage_cap: form.leverage_cap ? Number(form.leverage_cap) : null,
      priority: Number(form.priority) || 0,
      is_enabled: form.is_enabled ?? true,
    };
    try {
      if (editingId) await adminApi.put(`/pricing-rules/${editingId}`, body);
      else await adminApi.post('/pricing-rules', body);
      toast.success(editingId ? 'Rule updated' : 'Rule created');
      close(); void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const toggleEnabled = async (r: Rule) => {
    try { await adminApi.put(`/pricing-rules/${r.id}`, { is_enabled: !r.is_enabled }); void load(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };
  const remove = async (r: Rule) => {
    if (!confirm(`Delete rule "${r.name}"?`)) return;
    try { await adminApi.delete(`/pricing-rules/${r.id}`); toast.success('Deleted'); void load(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };

  const spreadText = (r: Rule) =>
    r.spread_mode === 'absolute'
      ? `= ${r.spread_value} ${r.spread_type}`
      : `× ${r.spread_multiplier}`;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Clock size={18} className="text-buy" /> Time-based Spread &amp; Leverage
        </h1>
        <p className="text-xxs text-text-tertiary mt-0.5">
          Set spread/leverage per time window (UTC); spread auto-fluctuates with live market volatility
        </p>
      </div>

      {/* Dynamic spread settings */}
      <div className="bg-bg-secondary border border-border-primary rounded-md p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
            <Activity size={15} className="text-accent" /> Dynamic Spread (market volatility)
          </span>
          {dyn && (
            <button
              onClick={() => void saveDyn({ dynamic_spread_enabled: !dyn.dynamic_spread_enabled })}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-fast',
                dyn.dynamic_spread_enabled ? 'bg-buy/15 text-buy' : 'bg-bg-hover text-text-tertiary')}
            >
              <Power size={13} /> {dyn.dynamic_spread_enabled ? 'Enabled' : 'Disabled'}
            </button>
          )}
        </div>
        {dyn ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <NumField label="Max multiplier (cap)" value={dyn.dynamic_spread_max_mult} step={0.1} min={1} max={10}
              onCommit={(v) => void saveDyn({ dynamic_spread_max_mult: v })} hint="e.g. 3 = up to 3× base spread" />
            <NumField label="Sensitivity" value={dyn.dynamic_spread_sensitivity} step={0.1} min={0} max={20}
              onCommit={(v) => void saveDyn({ dynamic_spread_sensitivity: v })} hint="higher = widens faster" />
            <NumField label="Window (sec)" value={dyn.dynamic_spread_window_sec} step={5} min={5} max={3600}
              onCommit={(v) => void saveDyn({ dynamic_spread_window_sec: Math.round(v) })} hint="volatility lookback" />
          </div>
        ) : <div className="text-xs text-text-tertiary"><Loader2 className="inline animate-spin mr-1" size={13} />Loading…</div>}
        <p className="text-[11px] text-text-tertiary mt-3">
          When enabled, the base spread (below / from Spreads config) widens as the market moves — capped at the multiplier above.
          Acts as the fallback when Floating Spread is off or the feed has no live market width.
        </p>
      </div>

      {/* Floating spread settings */}
      <div className="bg-bg-secondary border border-border-primary rounded-md p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
            <Activity size={15} className="text-accent" /> Floating Spread (live market width)
          </span>
          {dyn && (
            <button
              onClick={() => void saveDyn({ floating_spread_enabled: !dyn.floating_spread_enabled })}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-fast',
                dyn.floating_spread_enabled ? 'bg-buy/15 text-buy' : 'bg-bg-hover text-text-tertiary')}
            >
              <Power size={13} /> {dyn.floating_spread_enabled ? 'Enabled' : 'Disabled'}
            </button>
          )}
        </div>
        {dyn ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <NumField label="Markup (%)" value={dyn.floating_spread_markup_pct} step={1} min={0} max={100}
              onCommit={(v) => void saveDyn({ floating_spread_markup_pct: v })} hint="added on top of live market spread" />
            <NumField label="Max multiplier (cap)" value={dyn.floating_spread_max_mult} step={0.1} min={1} max={10}
              onCommit={(v) => void saveDyn({ floating_spread_max_mult: v })} hint="ceiling = base spread × this" />
            <NumField label="Smoothing (sec)" value={dyn.floating_spread_ema_sec} step={1} min={1} max={60}
              onCommit={(v) => void saveDyn({ floating_spread_ema_sec: Math.round(v) })} hint="EMA — higher = calmer quotes" />
          </div>
        ) : <div className="text-xs text-text-tertiary"><Loader2 className="inline animate-spin mr-1" size={13} />Loading…</div>}
        <p className="text-[11px] text-text-tertiary mt-3">
          Vantage-style variable spread: the published spread follows the real market spread from the price feed
          (smoothed), plus your markup. The base spread from Spreads config is the <b>floor</b>; base × cap is the ceiling.
          Only applies to instruments that have a base spread configured and a feed that delivers live bid/ask depth.
        </p>
      </div>

      {/* Rules list */}
      <div className="bg-bg-secondary border border-border-primary rounded-md">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary">
          <span className="text-sm font-semibold text-text-primary">Time Rules</span>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-accent/15 text-accent rounded-md hover:bg-accent/25 transition-fast">
            <Plus size={14} /> New rule
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-primary text-left text-text-tertiary uppercase tracking-wider">
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Applies to</th>
                <th className="px-3 py-2 font-semibold">Window (UTC)</th>
                <th className="px-3 py-2 font-semibold">Spread</th>
                <th className="px-3 py-2 font-semibold">Lev cap</th>
                <th className="px-3 py-2 font-semibold">Prio</th>
                <th className="px-3 py-2 font-semibold">On</th>
                <th className="px-3 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-text-tertiary"><Loader2 className="inline animate-spin mr-2" size={16} />Loading…</td></tr>
              ) : rules.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-text-tertiary">No time rules yet. Create one to vary spread/leverage by time.</td></tr>
              ) : rules.map((r) => (
                <tr key={r.id} className={cn('border-b border-border-primary/60 hover:bg-bg-hover/40', !r.is_enabled && 'opacity-50')}>
                  <td className="px-3 py-2 text-text-primary font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-text-secondary">{r.scope === 'instrument' ? (r.instrument_symbol || 'instrument') : r.scope === 'segment' ? (r.segment_name || 'segment') : 'All instruments'}</td>
                  <td className="px-3 py-2 text-text-secondary whitespace-nowrap">{windowText(r, sessions)}</td>
                  <td className="px-3 py-2 text-text-secondary">{spreadText(r)}</td>
                  <td className="px-3 py-2 text-text-secondary">{r.leverage_cap ? `1:${r.leverage_cap}` : '—'}</td>
                  <td className="px-3 py-2 text-text-tertiary tabular-nums">{r.priority}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => void toggleEnabled(r)} className={cn('w-9 h-5 rounded-full relative transition-fast', r.is_enabled ? 'bg-buy' : 'bg-bg-hover')}>
                      <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', r.is_enabled ? 'left-[18px]' : 'left-0.5')} />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openEdit(r)} className="p-1 text-text-tertiary hover:text-accent" title="Edit"><Pencil size={13} /></button>
                      <button onClick={() => void remove(r)} className="p-1 text-text-tertiary hover:text-sell" title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / edit form */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
          <div className="bg-bg-secondary border border-border-primary rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
              <span className="text-sm font-semibold text-text-primary">{editingId ? 'Edit rule' : 'New time rule'}</span>
              <button onClick={close} className="text-text-tertiary hover:text-text-primary"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <Field label="Name">
                <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. London session widen" className="inp" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Applies to">
                  <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} className="inp">
                    <option value="default">All instruments</option>
                    <option value="instrument">Specific instrument</option>
                  </select>
                </Field>
                {form.scope === 'instrument' && (
                  <Field label="Instrument">
                    <select value={form.instrument_id || ''} onChange={(e) => setForm({ ...form, instrument_id: e.target.value })} className="inp">
                      <option value="">Select…</option>
                      {instruments.map((i) => <option key={i.id} value={i.id}>{i.symbol}</option>)}
                    </select>
                  </Field>
                )}
              </div>

              <Field label="Window type">
                <div className="flex gap-2">
                  {['session', 'custom'].map((k) => (
                    <button key={k} onClick={() => setForm({ ...form, kind: k })}
                      className={cn('px-3 py-1.5 text-xs rounded-md border', form.kind === k ? 'border-accent text-accent bg-accent/10' : 'border-border-primary text-text-tertiary')}>
                      {k === 'session' ? 'Market session' : 'Custom day/time'}
                    </button>
                  ))}
                </div>
              </Field>

              {form.kind === 'session' ? (
                <Field label="Session (UTC)">
                  <select value={form.session || ''} onChange={(e) => setForm({ ...form, session: e.target.value })} className="inp">
                    {sessions.map((s) => <option key={s.slug} value={s.slug}>{s.label} ({minToHHMM(s.start_min)}–{minToHHMM(s.end_min)})</option>)}
                  </select>
                </Field>
              ) : (
                <>
                  <Field label="Days (UTC)">
                    <div className="flex flex-wrap gap-1.5">
                      {DOW.map((d, idx) => {
                        const on = (form.days_of_week || []).includes(idx);
                        return (
                          <button key={d} onClick={() => {
                            const cur = new Set(form.days_of_week || []);
                            on ? cur.delete(idx) : cur.add(idx);
                            setForm({ ...form, days_of_week: Array.from(cur).sort((a, b) => a - b) });
                          }} className={cn('px-2 py-1 text-xs rounded border', on ? 'border-accent text-accent bg-accent/10' : 'border-border-primary text-text-tertiary')}>{d}</button>
                        );
                      })}
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Start (UTC)">
                      <input type="time" value={minToHHMM(form.start_min ?? 0)} onChange={(e) => setForm({ ...form, start_min: hhmmToMin(e.target.value) })} className="inp" />
                    </Field>
                    <Field label="End (UTC)">
                      <input type="time" value={minToHHMM(form.end_min ?? 0)} onChange={(e) => setForm({ ...form, end_min: hhmmToMin(e.target.value) })} className="inp" />
                    </Field>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Spread mode">
                  <select value={form.spread_mode} onChange={(e) => setForm({ ...form, spread_mode: e.target.value })} className="inp">
                    <option value="multiplier">Multiplier × base</option>
                    <option value="absolute">Absolute value</option>
                  </select>
                </Field>
                {form.spread_mode === 'multiplier' ? (
                  <Field label="Multiplier">
                    <input type="number" step="0.1" min="0" value={form.spread_multiplier ?? 1} onChange={(e) => setForm({ ...form, spread_multiplier: parseFloat(e.target.value) })} className="inp" />
                  </Field>
                ) : (
                  <Field label="Spread value">
                    <div className="flex gap-1.5">
                      <input type="number" step="0.1" min="0" value={form.spread_value ?? 0} onChange={(e) => setForm({ ...form, spread_value: parseFloat(e.target.value) })} className="inp" />
                      <select value={form.spread_type || 'pips'} onChange={(e) => setForm({ ...form, spread_type: e.target.value })} className="inp w-28">
                        <option value="pips">pips</option>
                        <option value="percentage">%</option>
                      </select>
                    </div>
                  </Field>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Leverage cap (optional)">
                  <input type="number" min="1" placeholder="no cap" value={form.leverage_cap ?? ''} onChange={(e) => setForm({ ...form, leverage_cap: e.target.value ? parseInt(e.target.value, 10) : null })} className="inp" />
                </Field>
                <Field label="Priority (higher wins)">
                  <input type="number" value={form.priority ?? 0} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value, 10) || 0 })} className="inp" />
                </Field>
              </div>

              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input type="checkbox" checked={form.is_enabled ?? true} onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })} className="accent-accent" />
                Enabled
              </label>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-primary">
              <button onClick={close} className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary">Cancel</button>
              <button onClick={() => void submit()} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-accent text-white rounded-md disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {editingId ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .inp { width: 100%; font-size: 0.75rem; padding: 0.45rem 0.5rem; background: var(--bg-input, #0f131a); border: 1px solid var(--border-primary, #2a2f3a); border-radius: 0.375rem; color: var(--text-primary, #e6e8ec); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-xxs text-text-tertiary block mb-1">{label}</span>
      {children}
    </div>
  );
}

function NumField({ label, value, step, min, max, hint, onCommit }: {
  label: string; value: number; step: number; min: number; max: number; hint?: string; onCommit: (v: number) => void;
}) {
  const [v, setV] = useState(String(value));
  useEffect(() => { setV(String(value)); }, [value]);
  return (
    <div>
      <span className="text-xxs text-text-tertiary block mb-1">{label}</span>
      <input
        type="number" step={step} min={min} max={max} value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { const n = parseFloat(v); if (!Number.isNaN(n)) onCommit(Math.min(max, Math.max(min, n))); }}
        className="w-full text-xs py-2 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary"
      />
      {hint && <span className="text-[10px] text-text-tertiary mt-0.5 block">{hint}</span>}
    </div>
  );
}
