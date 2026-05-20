'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, Plus, Pencil, RefreshCw, Gift } from 'lucide-react';
import toast from 'react-hot-toast';

interface BonusOffer {
  id: string;
  name: string;
  bonus_type: string | null;
  percentage: number | null;
  fixed_amount: number | null;
  min_deposit: number;
  max_bonus: number | null;
  lots_required: number;
  target_audience: string;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string | null;
}

interface BonusAllocation {
  id: string;
  user_id: string;
  account_id: string | null;
  offer_id: string | null;
  amount: number;
  lots_traded: number;
  lots_required: number;
  status: string;
  released_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  user_email: string | null;
  offer_name: string | null;
}

interface PaginatedAllocations {
  items: BonusAllocation[];
  total: number;
  page: number;
  per_page: number;
}

type Tab = 'offers' | 'allocations';

function formatMoney(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

function isoForDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  name: '',
  bonus_type: 'deposit',
  percentage: '',
  fixed_amount: '',
  min_deposit: '',
  max_bonus: '',
  lots_required: '',
  target_audience: 'all',
  starts_at: '',
  expires_at: '',
  is_active: true,
};

export default function BonusPage() {
  const [tab, setTab] = useState<Tab>('offers');
  const [offers, setOffers] = useState<BonusOffer[]>([]);
  const [allocations, setAllocations] = useState<BonusAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'offers') {
        const res = await adminApi.get<BonusOffer[]>('/bonus/offers');
        setOffers(Array.isArray(res) ? res : []);
      } else {
        const res = await adminApi.get<PaginatedAllocations>('/bonus/allocations');
        setAllocations(res.items || []);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (offer: BonusOffer) => {
    setEditId(offer.id);
    setForm({
      name: offer.name,
      bonus_type: offer.bonus_type || 'deposit',
      percentage: offer.percentage != null ? String(offer.percentage) : '',
      fixed_amount: offer.fixed_amount != null ? String(offer.fixed_amount) : '',
      min_deposit: String(offer.min_deposit ?? ''),
      max_bonus: offer.max_bonus != null ? String(offer.max_bonus) : '',
      lots_required: String(offer.lots_required ?? ''),
      target_audience: offer.target_audience,
      starts_at: isoForDateInput(offer.starts_at),
      expires_at: isoForDateInput(offer.expires_at),
      is_active: offer.is_active,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSubmitting(true);
    try {
      const body = {
        name: form.name,
        bonus_type: form.bonus_type,
        percentage: form.percentage !== '' ? parseFloat(form.percentage) : null,
        fixed_amount: form.fixed_amount !== '' ? parseFloat(form.fixed_amount) : null,
        min_deposit: parseFloat(form.min_deposit) || 0,
        max_bonus: form.max_bonus !== '' ? parseFloat(form.max_bonus) : null,
        lots_required: parseFloat(form.lots_required) || 0,
        target_audience: form.target_audience,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        is_active: form.is_active,
      };
      if (editId) {
        await adminApi.put(`/bonus/offers/${editId}`, body);
        toast.success('Offer updated');
      } else {
        await adminApi.post('/bonus/offers', body);
        toast.success('Offer created');
      }
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const updateForm = (key: string, val: string | boolean) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Bonus Management</h1>
            <p className="text-xxs text-text-tertiary mt-0.5">Create bonus offers and track allocations</p>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'offers' && (
              <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 transition-fast">
                <Plus size={14} /> New Offer
              </button>
            )}
            <button onClick={fetchData} className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="bg-bg-secondary border border-border-primary rounded-md">
          <div className="flex gap-1 p-1 border-b border-border-primary">
            {([['offers', 'Offers'], ['allocations', 'Allocations']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-fast',
                  tab === id
                    ? 'bg-bg-hover text-text-primary border border-border-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-text-tertiary" />
              </div>
            ) : tab === 'offers' ? (
              offers.length === 0 ? (
                <div className="text-center text-xs text-text-tertiary py-12">No bonus offers created yet</div>
              ) : (
                <div className="border border-border-primary rounded-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                      <thead>
                        <tr className="border-b border-border-primary bg-bg-tertiary/40">
                          {['Name', 'Type', 'Value', 'Min Deposit', 'Lots Req.', 'Audience', 'Period', 'Status', 'Actions'].map((col) => (
                            <th key={col} className={cn('text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide', ['Value', 'Min Deposit'].includes(col) && 'text-right', col === 'Actions' && 'text-right')}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {offers.map((offer) => {
                          const valueLabel = offer.percentage != null
                            ? `${offer.percentage}%`
                            : offer.fixed_amount != null
                              ? `$${formatMoney(offer.fixed_amount)}`
                              : '—';
                          return (
                            <tr key={offer.id} className="border-b border-border-primary/50 transition-fast hover:bg-bg-hover">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1.5">
                                  <Gift size={12} className="text-accent" />
                                  <span className="text-xs text-text-primary">{offer.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium bg-buy/15 text-buy">{offer.bonus_type || '—'}</span>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-text-primary text-right font-mono tabular-nums">{valueLabel}</td>
                              <td className="px-4 py-2.5 text-xs text-text-secondary text-right font-mono tabular-nums">${formatMoney(offer.min_deposit)}</td>
                              <td className="px-4 py-2.5 text-xs text-text-secondary font-mono tabular-nums">{offer.lots_required}</td>
                              <td className="px-4 py-2.5 text-xs text-text-secondary">{offer.target_audience}</td>
                              <td className="px-4 py-2.5 text-xxs text-text-tertiary font-mono tabular-nums">
                                {formatDate(offer.starts_at)} → {formatDate(offer.expires_at)}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={cn('inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium', offer.is_active ? 'bg-success/15 text-success' : 'bg-text-tertiary/15 text-text-tertiary')}>
                                  {offer.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button onClick={() => openEdit(offer)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xxs font-medium text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast">
                                  <Pencil size={12} /> Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ) : allocations.length === 0 ? (
              <div className="text-center text-xs text-text-tertiary py-12">No allocations found</div>
            ) : (
              <div className="border border-border-primary rounded-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="border-b border-border-primary bg-bg-tertiary/40">
                        {['User', 'Offer', 'Bonus Amount', 'Lots Progress', 'Status', 'Released', 'Allocated'].map((col) => (
                          <th key={col} className={cn('text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide', col === 'Bonus Amount' && 'text-right')}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map((a) => {
                        const progress = a.lots_required > 0
                          ? Math.min((a.lots_traded / a.lots_required) * 100, 100)
                          : 0;
                        return (
                          <tr key={a.id} className="border-b border-border-primary/50 transition-fast hover:bg-bg-hover">
                            <td className="px-4 py-2.5">
                              <p className="text-xs text-text-primary">{a.user_email || a.user_id}</p>
                              <p className="text-xxs text-text-tertiary font-mono">{a.account_id || '—'}</p>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-text-secondary">{a.offer_name || '—'}</td>
                            <td className="px-4 py-2.5 text-xs text-text-primary text-right font-mono tabular-nums">${formatMoney(a.amount)}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                                  <div className="h-full bg-buy rounded-full" style={{ width: `${progress}%` }} />
                                </div>
                                <span className="text-xxs text-text-tertiary font-mono tabular-nums">{a.lots_traded}/{a.lots_required}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={cn('inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium',
                                a.status === 'released' || a.status === 'completed' ? 'bg-success/15 text-success' :
                                a.status === 'active' ? 'bg-buy/15 text-buy' :
                                a.status === 'cancelled' || a.status === 'expired' ? 'bg-danger/15 text-danger' :
                                'bg-warning/15 text-warning'
                              )}>
                                {a.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-text-tertiary font-mono tabular-nums">{formatDate(a.released_at)}</td>
                            <td className="px-4 py-2.5 text-xs text-text-tertiary font-mono tabular-nums">{formatDate(a.created_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-bg-base/70 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border-primary">
              <h3 className="text-sm font-semibold text-text-primary">{editId ? 'Edit Offer' : 'Create Bonus Offer'}</h3>
            </div>
            <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Name</label>
                <input value={form.name} onChange={(e) => updateForm('name', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" placeholder="e.g. Welcome Bonus 50%" />
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Bonus Type</label>
                <select value={form.bonus_type} onChange={(e) => updateForm('bonus_type', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md">
                  <option value="deposit">Deposit Bonus</option>
                  <option value="no_deposit">No Deposit</option>
                  <option value="cashback">Cashback</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Percentage (%)</label>
                  <input type="number" step="0.01" value={form.percentage} onChange={(e) => updateForm('percentage', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" placeholder="e.g. 50" />
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Fixed Amount ($)</label>
                  <input type="number" step="0.01" value={form.fixed_amount} onChange={(e) => updateForm('fixed_amount', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" placeholder="e.g. 100" />
                </div>
              </div>
              <p className="text-[10px] text-text-tertiary -mt-2">Use one or the other — percentage applies to the deposit, fixed amount is a flat grant.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Min Deposit ($)</label>
                  <input type="number" step="0.01" value={form.min_deposit} onChange={(e) => updateForm('min_deposit', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" placeholder="e.g. 100" />
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Max Bonus ($)</label>
                  <input type="number" step="0.01" value={form.max_bonus} onChange={(e) => updateForm('max_bonus', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" placeholder="(optional cap)" />
                </div>
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Lots Required (release threshold)</label>
                <input type="number" step="0.01" value={form.lots_required} onChange={(e) => updateForm('lots_required', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" placeholder="e.g. 5" />
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Target Audience</label>
                <select value={form.target_audience} onChange={(e) => updateForm('target_audience', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md">
                  <option value="all">All Users</option>
                  <option value="new">New Users Only</option>
                  <option value="vip">VIP Users</option>
                  <option value="ib">IB Users</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Starts At</label>
                  <input type="date" value={form.starts_at} onChange={(e) => updateForm('starts_at', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" />
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Expires At</label>
                  <input type="date" value={form.expires_at} onChange={(e) => updateForm('expires_at', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input type="checkbox" checked={form.is_active} onChange={(e) => updateForm('is_active', e.target.checked)} />
                Active
              </label>
            </div>
            <div className="px-5 py-3 border-t border-border-primary flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-3 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-3 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 transition-fast disabled:opacity-50">
                {submitting ? 'Saving...' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
