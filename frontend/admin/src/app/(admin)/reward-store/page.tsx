'use client';

/**
 * Admin · Reward Store.
 *
 * Edits every item the trader sees under /earn/store (reward_store_items):
 * label, description, category, AC (FXA) price, PS requirement, ordering and
 * active state — plus add / remove. Backed by
 *   GET/PUT/POST /api/v1/admin/reward-store/items
 *   DELETE       /api/v1/admin/reward-store/items/{id}
 * (backend/services/admin/routes/reward_store.py).
 */
import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, Save, RefreshCw, Plus, Trash2, Store } from 'lucide-react';

const LIME = '#ccff00';
const CATEGORIES = ['cashback', 'bonus', 'perk', 'tool', 'lifestyle'] as const;
type Category = (typeof CATEGORIES)[number];

interface Item {
  id: string;
  slug: string;
  category: Category;
  label: string;
  description: string;
  ac_price: number;
  is_active: boolean;
  display_order: number;
  min_ps: number;
  fulfillment: string;
}

const CAT_COLOR: Record<Category, string> = {
  cashback: '#22c55e',
  bonus: '#f59e0b',
  perk: '#3b82f6',
  tool: '#a855f7',
  lifestyle: '#ec4899',
};

const BLANK = {
  slug: '',
  category: 'perk' as Category,
  label: '',
  description: '',
  ac_price: 100,
  is_active: true,
  display_order: 0,
  min_ps: 0,
  fulfillment: '',
};

export default function AdminRewardStorePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ ...BLANK });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<{ items: Item[] }>('/reward-store/items');
      setItems(res.items);
    } catch (e) {
      toast.error(errMsg(e, 'Failed to load reward store'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const edit = <K extends keyof Item>(id: string, field: K, value: Item[K]) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.put('/reward-store/items', {
        items: items.map((it) => ({
          id: it.id,
          label: it.label,
          description: it.description,
          category: it.category,
          ac_price: it.ac_price,
          is_active: it.is_active,
          display_order: it.display_order,
          min_ps: it.min_ps,
        })),
      });
      toast.success('Reward store updated');
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
      await adminApi.post('/reward-store/items', draft);
      toast.success('Item added');
      setAdding(false);
      setDraft({ ...BLANK });
      await load();
    } catch (e) {
      toast.error(errMsg(e, 'Create failed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (it: Item) => {
    if (!window.confirm(`Delete "${it.label}"? If it has redemptions it will be deactivated instead.`)) return;
    try {
      const res = await adminApi.delete<{ deleted: boolean; deactivated?: boolean }>(`/reward-store/items/${it.id}`);
      toast.success(res.deactivated ? 'Item in use — deactivated instead' : 'Item deleted');
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
            <Store className="w-5 h-5" style={{ color: LIME }} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-text-primary">Reward Store</h1>
            <p className="text-xs text-text-secondary mt-0.5">
              Edit every item traders see under Earn → Store: label, category, FXA price, PS requirement and more.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void load()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-primary bg-bg-secondary text-xs text-text-secondary hover:text-text-primary">
            <RefreshCw className="w-3.5 h-3.5" /> Reload
          </button>
          <button type="button" onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-primary bg-bg-secondary text-xs text-text-primary hover:border-[#ccff00]/40">
            <Plus className="w-3.5 h-3.5" /> Add item
          </button>
          <button type="button" onClick={() => void save()} disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-60"
            style={{ color: '#0a0a0a', background: LIME }}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save changes
          </button>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: `${LIME}44` }}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-tertiary">New item</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Slug (unique)"><input className="inp" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="e.g. cashback-250" /></Field>
            <Field label="Label"><input className="inp" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Cashback 250" /></Field>
            <Field label="Category">
              <select className="inp" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="FXA price"><input type="number" className="inp" value={draft.ac_price} onChange={(e) => setDraft({ ...draft, ac_price: Number(e.target.value) })} /></Field>
            <Field label="Min PS (lifestyle)"><input type="number" className="inp" value={draft.min_ps} onChange={(e) => setDraft({ ...draft, min_ps: Number(e.target.value) })} /></Field>
            <Field label="Display order"><input type="number" className="inp" value={draft.display_order} onChange={(e) => setDraft({ ...draft, display_order: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Description"><input className="inp" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Shown on the store card" /></Field>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setAdding(false); setDraft({ ...BLANK }); }} className="px-3 py-1.5 rounded-lg border border-border-primary bg-bg-secondary text-xs text-text-secondary">Cancel</button>
            <button type="button" onClick={() => void create()} disabled={saving} className="px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60" style={{ color: '#0a0a0a', background: LIME }}>Create</button>
          </div>
        </div>
      )}

      {/* Items table */}
      <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-x-auto">
        <table className="w-full text-xs min-w-[880px]">
          <thead className="text-[10px] uppercase tracking-wider text-text-tertiary">
            <tr className="border-b border-border-primary">
              <th className="text-left py-3 px-3 font-bold">Item</th>
              <th className="text-left py-3 px-2 font-bold">Category</th>
              <th className="text-right py-3 px-2 font-bold">FXA price</th>
              <th className="text-right py-3 px-2 font-bold">Min PS</th>
              <th className="text-right py-3 px-2 font-bold">Order</th>
              <th className="text-center py-3 px-2 font-bold">Active</th>
              <th className="py-3 px-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-border-primary align-top">
                <td className="py-2.5 px-3 min-w-[240px]">
                  <input className="inp font-semibold" value={it.label} onChange={(e) => edit(it.id, 'label', e.target.value)} />
                  <input className="inp mt-1 text-[11px] text-text-secondary" value={it.description} onChange={(e) => edit(it.id, 'description', e.target.value)} placeholder="Description" />
                  <span className="text-[10px] text-text-tertiary font-mono">{it.slug}</span>
                </td>
                <td className="py-2.5 px-2">
                  <select className="inp" value={it.category} onChange={(e) => edit(it.id, 'category', e.target.value as Category)}
                    style={{ color: CAT_COLOR[it.category] }}>
                    {CATEGORIES.map((c) => <option key={c} value={c} style={{ color: '#fff' }}>{c}</option>)}
                  </select>
                </td>
                <td className="py-2.5 px-2 w-28">
                  <input type="number" className="inp text-right tabular-nums font-mono" value={it.ac_price} onChange={(e) => edit(it.id, 'ac_price', Number(e.target.value))} />
                </td>
                <td className="py-2.5 px-2 w-28">
                  <input type="number" className="inp text-right tabular-nums font-mono disabled:opacity-40" value={it.min_ps}
                    disabled={it.category !== 'lifestyle'} onChange={(e) => edit(it.id, 'min_ps', Number(e.target.value))} />
                </td>
                <td className="py-2.5 px-2 w-20">
                  <input type="number" className="inp text-right tabular-nums font-mono" value={it.display_order} onChange={(e) => edit(it.id, 'display_order', Number(e.target.value))} />
                </td>
                <td className="py-2.5 px-2 text-center">
                  <button type="button" role="switch" aria-checked={it.is_active} onClick={() => edit(it.id, 'is_active', !it.is_active)}
                    className="inline-block w-10 h-5 rounded-full relative transition-colors border align-middle"
                    style={it.is_active ? { background: LIME, borderColor: LIME } : { background: 'var(--bg-base)', borderColor: 'var(--border-primary)' }}>
                    <span className="absolute top-[1px] w-[16px] h-[16px] rounded-full bg-white transition-all" style={{ left: it.is_active ? '19px' : '2px' }} />
                  </button>
                </td>
                <td className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => void remove(it)} title="Delete" className="text-text-tertiary hover:text-rose-400 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-text-secondary">No store items yet. Use “Add item”.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-text-tertiary">
        FXA price = Artha Coins a trader spends. <span className="font-bold text-text-secondary">Min PS</span> only
        applies to <span style={{ color: CAT_COLOR.lifestyle }}>lifestyle</span> items (Power-Score gate). Turn
        <b> Active</b> off to hide an item from the store. Edits are live after <b>Save changes</b>.
      </p>

      <style jsx>{`
        .inp {
          width: 100%;
          padding: 6px 8px;
          border-radius: 8px;
          background: var(--bg-base, #0a0a0a);
          border: 1px solid var(--border-primary);
          color: var(--text-primary);
          font-size: 12px;
          outline: none;
        }
        .inp:focus { border-color: ${LIME}; }
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
