'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { Loader2, Plus, Pencil, Trash2, RefreshCw, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

interface AccountType {
  id: string;
  name: string;
  description?: string | null;
  leverage_default: number;
  max_leverage?: number | null;
  spread_markup_default: string | number;
  commission_default: string | number;
  commission_pct?: string | number | null;
  minimum_deposit: string | number;
  swap_free: boolean;
  swap_free_available?: boolean;
  margin_call_level?: string | number | null;
  stop_out_level?: string | number | null;
  is_demo: boolean;
  is_active: boolean;
}

const EMPTY = {
  name: '',
  description: '',
  leverage_default: '100',
  max_leverage: '',
  spread_markup_default: '0',
  commission_default: '0',
  commission_pct: '',
  minimum_deposit: '0',
  swap_free: false,
  swap_free_available: false,
  // Blank is not zero: it means this tier follows the platform-wide level.
  margin_call_level: '',
  stop_out_level: '',
  is_demo: false,
  is_active: true,
};

/** An empty box means "unset", which the API reads as null — not as 0. */
const num = (v: string): number | null => {
  const t = String(v ?? '').trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export default function AccountTypesPage() {
  const [items, setItems] = useState<AccountType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<{ items: AccountType[] }>('/account-types');
      setItems(res.items || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY });
    setModal(true);
  };

  const openEdit = (r: AccountType) => {
    setEditId(r.id);
    setForm({
      name: r.name,
      description: r.description ?? '',
      leverage_default: String(r.leverage_default),
      max_leverage: r.max_leverage == null ? '' : String(r.max_leverage),
      spread_markup_default: String(r.spread_markup_default),
      commission_default: String(r.commission_default),
      commission_pct: r.commission_pct == null ? '' : String(r.commission_pct),
      minimum_deposit: String(r.minimum_deposit ?? 0),
      swap_free: r.swap_free,
      swap_free_available: !!r.swap_free_available,
      margin_call_level: r.margin_call_level == null ? '' : String(r.margin_call_level),
      stop_out_level: r.stop_out_level == null ? '' : String(r.stop_out_level),
      is_demo: r.is_demo,
      is_active: r.is_active,
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        leverage_default: parseInt(form.leverage_default, 10) || 100,
        max_leverage: num(form.max_leverage),
        spread_markup_default: parseFloat(String(form.spread_markup_default)) || 0,
        commission_default: parseFloat(String(form.commission_default)) || 0,
        commission_pct: num(form.commission_pct),
        minimum_deposit: parseFloat(String(form.minimum_deposit)) || 0,
        swap_free: form.swap_free,
        swap_free_available: form.swap_free_available,
        margin_call_level: num(form.margin_call_level),
        stop_out_level: num(form.stop_out_level),
        is_demo: form.is_demo,
        is_active: form.is_active,
      };
      if (editId) {
        await adminApi.put(`/account-types/${editId}`, body);
        toast.success('Account type updated');
      } else {
        await adminApi.post('/account-types', body);
        toast.success('Account type created');
      }
      setModal(false);
      void fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const del = async (id: string) => {
    try {
      await adminApi.delete(`/account-types/${id}`);
      toast.success('Removed');
      setDeleteId(null);
      void fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const u = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Layers size={18} className="text-buy" />
            Account types
          </h1>
          <p className="text-xxs text-text-tertiary mt-0.5 max-w-xl">
            Define spreads (markup), commission per lot, minimum deposit, and leverage defaults. New user accounts are
            linked to a type; traders pick an account before opening the terminal.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 transition-fast"
          >
            <Plus size={14} /> New type
          </button>
          <button
            type="button"
            onClick={() => void fetchData()}
            className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-text-tertiary" size={22} />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-xs text-text-tertiary py-16 border border-border-primary rounded-md bg-bg-secondary">
          No account types yet. Create one (e.g. Standard, VIP, Swap-free).
        </div>
      ) : (
        <div className="overflow-x-auto border border-border-primary rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-bg-tertiary text-text-tertiary text-left">
              <tr>
                <th className="p-2 font-medium">Name</th>
                <th className="p-2 font-medium">Leverage</th>
                <th className="p-2 font-medium">Spread +</th>
                <th className="p-2 font-medium">Comm / lot</th>
                <th className="p-2 font-medium">Min dep.</th>
                <th className="p-2 font-medium">MC / SO</th>
                <th className="p-2 font-medium">Flags</th>
                <th className="p-2 font-medium w-24" />
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-border-primary hover:bg-bg-hover/40">
                  <td className="p-2 font-medium text-text-primary">
                    {r.name}
                    {!r.is_active && (
                      <span className="ml-2 text-xxs text-warning">inactive</span>
                    )}
                  </td>
                  <td className="p-2 font-mono tabular-nums">1:{r.leverage_default}</td>
                  <td className="p-2 font-mono tabular-nums">{r.spread_markup_default}</td>
                  <td className="p-2 font-mono tabular-nums">{r.commission_default}</td>
                  <td className="p-2 font-mono tabular-nums">{r.minimum_deposit}</td>
                  <td className="p-2 font-mono tabular-nums text-text-secondary">
                    {r.margin_call_level == null ? '-' : r.margin_call_level + '%'} /{' '}
                    {r.stop_out_level == null ? '-' : r.stop_out_level + '%'}
                  </td>
                  <td className="p-2 text-xxs text-text-secondary">
                    {r.is_demo ? 'demo ' : ''}
                    {r.swap_free ? 'swap-free ' : ''}
                    {r.swap_free_available && !r.swap_free ? 'swap-free on request ' : ''}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1 justify-end">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="p-1 rounded border border-border-primary text-text-secondary hover:bg-bg-hover"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(r.id)}
                        className="p-1 rounded border border-danger/30 text-danger hover:bg-danger/10"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 bg-bg-base/70 flex items-center justify-center p-4" onClick={() => setModal(false)}>
          <div
            className="bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-border-primary">
              <h3 className="text-sm font-semibold text-text-primary">{editId ? 'Edit account type' : 'New account type'}</h3>
            </div>
            <div className="px-5 py-4 space-y-2.5">
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => u('name', e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                  placeholder="e.g. Standard, VIP"
                />
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Description</label>
                <input
                  value={form.description}
                  onChange={(e) => u('description', e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Default leverage (1:N)</label>
                  <input
                    type="number"
                    value={form.leverage_default}
                    onChange={(e) => u('leverage_default', e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Min. deposit (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.minimum_deposit}
                    onChange={(e) => u('minimum_deposit', e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Spread markup</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={form.spread_markup_default}
                    onChange={(e) => u('spread_markup_default', e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Commission / lot / side (USD)</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={form.commission_default}
                    onChange={(e) => u('commission_default', e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Max leverage (1:N)</label>
                  <input
                    type="number"
                    value={form.max_leverage}
                    onChange={(e) => u('max_leverage', e.target.value)}
                    placeholder="same as default"
                    className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Commission % of notional</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={form.commission_pct}
                    onChange={(e) => u('commission_pct', e.target.value)}
                    placeholder="blank = none"
                    className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Margin call %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.margin_call_level}
                    onChange={(e) => u('margin_call_level', e.target.value)}
                    placeholder="blank = platform level"
                    className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Stop out %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.stop_out_level}
                    onChange={(e) => u('stop_out_level', e.target.value)}
                    placeholder="blank = platform level"
                    className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input type="checkbox" checked={form.swap_free} onChange={(e) => u('swap_free', e.target.checked)} />
                Swap-free (whole tier)
              </label>
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={form.swap_free_available}
                  onChange={(e) => u('swap_free_available', e.target.checked)}
                />
                Swap-free available on request
              </label>
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input type="checkbox" checked={form.is_demo} onChange={(e) => u('is_demo', e.target.checked)} />
                Demo type
              </label>
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input type="checkbox" checked={form.is_active} onChange={(e) => u('is_active', e.target.checked)} />
                Active
              </label>
            </div>
            <div className="px-5 py-3 border-t border-border-primary flex justify-end gap-2">
              <button type="button" onClick={() => setModal(false)} className="px-3 py-1.5 rounded-md text-xs border border-border-primary text-text-secondary hover:bg-bg-hover">
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void save()}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 bg-bg-base/70 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-bg-secondary border border-border-primary rounded-md max-w-sm w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-text-primary font-semibold">Delete account type?</p>
            <p className="text-xs text-text-secondary">Only allowed if no trading accounts use this type.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDeleteId(null)} className="px-3 py-1.5 text-xs border border-border-primary rounded-md">
                Cancel
              </button>
              <button type="button" onClick={() => void del(deleteId)} className="px-3 py-1.5 text-xs rounded-md bg-danger/15 text-danger border border-danger/30">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
