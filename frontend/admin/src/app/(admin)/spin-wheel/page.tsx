'use client';

/**
 * Admin · Spin & Win.
 *
 * Edits the wheel (spin_wheel_prizes) traders see under Earn → Play Zone →
 * Spin: label, win weight (probability), payout kind/amount, ordering, active
 * state — plus the AC cost per spin. Backed by
 *   GET/PUT/POST /api/v1/admin/spin-wheel/prizes
 *   DELETE       /api/v1/admin/spin-wheel/prizes/{id}
 *   PUT          /api/v1/admin/spin-wheel/config   (spin cost)
 * (backend/services/admin/routes/spin_wheel.py).
 */
import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, Save, RefreshCw, Plus, Trash2, Sparkles } from 'lucide-react';

const LIME = '#1E88FF';
const KINDS = ['ac', 'cashback', 'xp', 'nothing'] as const;
type Kind = (typeof KINDS)[number];

interface Prize {
  id: string;
  slug: string;
  label: string;
  weight: number;
  payout_kind: Kind;
  payout_amount: number;
  display_order: number;
  is_active: boolean;
  win_pct: number;
}

const KIND_COLOR: Record<Kind, string> = {
  ac: '#22c55e',
  cashback: '#3b82f6',
  xp: '#a855f7',
  nothing: '#6b7280',
};

const BLANK = {
  slug: '',
  label: '',
  weight: 1,
  payout_kind: 'ac' as Kind,
  payout_amount: 0,
  display_order: 0,
  is_active: true,
};

export default function AdminSpinWheelPage() {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [spinCost, setSpinCost] = useState(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ ...BLANK });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<{ prizes: Prize[]; spin_cost_ac: number }>('/spin-wheel/prizes');
      setPrizes(res.prizes);
      setSpinCost(res.spin_cost_ac);
    } catch (e) {
      toast.error(errMsg(e, 'Failed to load spin wheel'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const edit = <K extends keyof Prize>(id: string, field: K, value: Prize[K]) =>
    setPrizes((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

  const totalWeight = prizes.filter((p) => p.is_active).reduce((s, p) => s + (Number(p.weight) || 0), 0);
  const liveWinPct = (p: Prize) => (p.is_active && totalWeight > 0 ? (100 * p.weight) / totalWeight : 0);

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        adminApi.put('/spin-wheel/prizes', {
          prizes: prizes.map((p) => ({
            id: p.id, label: p.label, weight: p.weight,
            payout_kind: p.payout_kind, payout_amount: p.payout_amount,
            display_order: p.display_order, is_active: p.is_active,
          })),
        }),
        adminApi.put('/spin-wheel/config', { spin_cost_ac: spinCost }),
      ]);
      toast.success('Spin wheel updated');
      await load();
    } catch (e) {
      toast.error(errMsg(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    if (!draft.label.trim() || !draft.slug.trim()) {
      toast.error('Slug and label are required');
      return;
    }
    setSaving(true);
    try {
      await adminApi.post('/spin-wheel/prizes', draft);
      toast.success('Slot added');
      setAdding(false);
      setDraft({ ...BLANK });
      await load();
    } catch (e) {
      toast.error(errMsg(e, 'Create failed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Prize) => {
    if (!window.confirm(`Delete "${p.label}"? If it has past spins it will be deactivated instead.`)) return;
    try {
      const res = await adminApi.delete<{ deleted: boolean; deactivated?: boolean }>(`/spin-wheel/prizes/${p.id}`);
      toast.success(res.deactivated ? 'Slot in use — deactivated instead' : 'Slot deleted');
      await load();
    } catch (e) {
      toast.error(errMsg(e, 'Delete failed'));
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
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${LIME}1a` }}>
            <Sparkles className="w-5 h-5" style={{ color: LIME }} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-text-primary">Spin &amp; Win</h1>
            <p className="text-xs text-text-secondary mt-0.5">
              Click any field to edit a wheel slot (label, payout, weight/win-chance) or the cost per spin, then Save changes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void load()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-primary bg-bg-secondary text-xs text-text-secondary hover:text-text-primary">
            <RefreshCw className="w-3.5 h-3.5" /> Reload
          </button>
          <button type="button" onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-primary bg-bg-secondary text-xs text-text-primary hover:border-[#1E88FF]/40">
            <Plus className="w-3.5 h-3.5" /> Add slot
          </button>
          <button type="button" onClick={() => void save()} disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-60"
            style={{ color: '#0a0a0a', background: LIME }}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save changes
          </button>
        </div>
      </div>

      {/* Cost + weight summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
          <label className="text-[10px] uppercase tracking-wider text-text-tertiary font-bold block mb-1.5">Cost per spin (AC)</label>
          <input type="number" className="inp text-lg font-bold" value={spinCost} onChange={(e) => setSpinCost(Number(e.target.value))} />
        </div>
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary font-bold">Active slots</p>
          <p className="text-lg font-bold text-text-primary font-mono tabular-nums">{prizes.filter((p) => p.is_active).length}</p>
        </div>
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary font-bold">Total weight</p>
          <p className="text-lg font-bold text-text-primary font-mono tabular-nums">{totalWeight}</p>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: `${LIME}44` }}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-tertiary">New slot</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Slug (unique)"><input className="inp" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="e.g. ac-150" /></Field>
            <Field label="Label"><input className="inp" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="+150 AC" /></Field>
            <Field label="Payout kind">
              <select className="inp" value={draft.payout_kind} onChange={(e) => setDraft({ ...draft, payout_kind: e.target.value as Kind })}>
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </Field>
            <Field label="Payout amount"><input type="number" className="inp" value={draft.payout_amount} onChange={(e) => setDraft({ ...draft, payout_amount: Number(e.target.value) })} /></Field>
            <Field label="Weight (win chance)"><input type="number" className="inp" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: Number(e.target.value) })} /></Field>
            <Field label="Display order"><input type="number" className="inp" value={draft.display_order} onChange={(e) => setDraft({ ...draft, display_order: Number(e.target.value) })} /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setAdding(false); setDraft({ ...BLANK }); }} className="px-3 py-1.5 rounded-lg border border-border-primary bg-bg-secondary text-xs text-text-secondary">Cancel</button>
            <button type="button" onClick={() => void create()} disabled={saving} className="px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60" style={{ color: '#0a0a0a', background: LIME }}>Create</button>
          </div>
        </div>
      )}

      {/* Prizes table */}
      <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-x-auto">
        <table className="w-full text-xs min-w-[820px]">
          <thead className="text-[10px] uppercase tracking-wider text-text-tertiary">
            <tr className="border-b border-border-primary">
              <th className="text-left py-3 px-3 font-bold">Label</th>
              <th className="text-left py-3 px-2 font-bold">Payout kind</th>
              <th className="text-right py-3 px-2 font-bold">Amount</th>
              <th className="text-right py-3 px-2 font-bold">Weight</th>
              <th className="text-right py-3 px-2 font-bold">Win %</th>
              <th className="text-right py-3 px-2 font-bold">Order</th>
              <th className="text-center py-3 px-2 font-bold">Active</th>
              <th className="py-3 px-2" />
            </tr>
          </thead>
          <tbody>
            {prizes.map((p) => (
              <tr key={p.id} className="border-b border-border-primary">
                <td className="py-2.5 px-3 min-w-[160px]">
                  <input className="inp font-semibold" value={p.label} onChange={(e) => edit(p.id, 'label', e.target.value)} />
                  <span className="text-[10px] text-text-tertiary font-mono">{p.slug}</span>
                </td>
                <td className="py-2.5 px-2 w-32">
                  <select className="inp" value={p.payout_kind} onChange={(e) => edit(p.id, 'payout_kind', e.target.value as Kind)} style={{ color: KIND_COLOR[p.payout_kind] }}>
                    {KINDS.map((k) => <option key={k} value={k} style={{ color: '#fff' }}>{k}</option>)}
                  </select>
                </td>
                <td className="py-2.5 px-2 w-24">
                  <input type="number" className="inp text-right tabular-nums font-mono disabled:opacity-40" value={p.payout_amount} disabled={p.payout_kind === 'nothing'} onChange={(e) => edit(p.id, 'payout_amount', Number(e.target.value))} />
                </td>
                <td className="py-2.5 px-2 w-20">
                  <input type="number" className="inp text-right tabular-nums font-mono" value={p.weight} onChange={(e) => edit(p.id, 'weight', Number(e.target.value))} />
                </td>
                <td className="py-2.5 px-2 w-16 text-right font-mono tabular-nums" style={{ color: p.is_active ? LIME : 'rgb(var(--c-text-tertiary) / 1)' }}>
                  {liveWinPct(p).toFixed(1)}%
                </td>
                <td className="py-2.5 px-2 w-16">
                  <input type="number" className="inp text-right tabular-nums font-mono" value={p.display_order} onChange={(e) => edit(p.id, 'display_order', Number(e.target.value))} />
                </td>
                <td className="py-2.5 px-2 text-center">
                  <button type="button" role="switch" aria-checked={p.is_active} onClick={() => edit(p.id, 'is_active', !p.is_active)}
                    className="inline-block w-10 h-5 rounded-full relative transition-colors border align-middle"
                    style={p.is_active ? { background: LIME, borderColor: LIME } : { background: 'rgb(var(--c-bg-tertiary) / 1)', borderColor: 'rgb(var(--c-border-secondary) / 1)' }}>
                    <span className="absolute top-[1px] w-[16px] h-[16px] rounded-full bg-white transition-all" style={{ left: p.is_active ? '19px' : '2px' }} />
                  </button>
                </td>
                <td className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => void remove(p)} title="Delete" className="text-text-tertiary hover:text-rose-400 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {prizes.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-text-secondary">No wheel slots yet. Use “Add slot”.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-text-tertiary">
        <span className="font-bold text-text-secondary">Weight</span> sets each slot&apos;s draw chance —
        <span className="font-bold"> Win %</span> = weight ÷ total active weight (recomputes live as you edit).
        <span style={{ color: KIND_COLOR.ac }}> ac</span>/<span style={{ color: KIND_COLOR.cashback }}>cashback</span> credit
        Ezymax Coins, <span style={{ color: KIND_COLOR.xp }}>xp</span> credits XP, <span style={{ color: KIND_COLOR.nothing }}>nothing</span> = no reward.
        Turn <b>Active</b> off to remove a slot from the wheel. Edits are live after <b>Save changes</b>.
      </p>

      <style jsx>{`
        .inp {
          width: 100%;
          padding: 7px 10px;
          border-radius: 8px;
          background: rgb(var(--c-bg-input) / 1);
          border: 1px solid rgb(var(--c-border-secondary) / 1);
          color: rgb(var(--c-text-primary) / 1);
          font-size: 12px;
          outline: none;
          transition: border-color 120ms ease, box-shadow 120ms ease;
        }
        .inp::placeholder { color: rgb(var(--c-text-tertiary) / 1); }
        .inp:hover { border-color: ${LIME}66; }
        .inp:focus { border-color: ${LIME}; box-shadow: 0 0 0 2px ${LIME}22; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-bold">{label}</span>
      {children}
    </label>
  );
}

function errMsg(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
    || (e as { message?: string })?.message || fallback;
}
