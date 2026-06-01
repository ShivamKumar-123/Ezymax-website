'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { Loader2, RefreshCw, Package, Send, CheckCircle2, XCircle, Truck } from 'lucide-react';
import toast from 'react-hot-toast';

type Fulfillment = {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  item_label: string;
  item_slug: string;
  ac_paid: number;
  user_ps_at_redeem: number;
  shipping_address: string | null;
  tracking_number: string | null;
  status: 'queued' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  note: string | null;
  requested_at: string | null;
  shipped_at: string | null;
};

const STATUS_FILTERS = ['all', 'queued', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));

export default function LifestylePage() {
  const [filter, setFilter] = useState<StatusFilter>('queued');
  const [items, setItems] = useState<Fulfillment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === 'all' ? '/lifestyle-fulfillments' : `/lifestyle-fulfillments?status=${filter}`;
      const r = await adminApi.get<Fulfillment[]>(url);
      setItems(Array.isArray(r) ? r : []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const update = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    try {
      await adminApi.patch(`/lifestyle-fulfillments/${id}`, body);
      toast.success('Updated');
      await fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const promptTracking = (id: string) => {
    const t = window.prompt('Tracking number:');
    if (!t) return;
    void update(id, { status: 'shipped', tracking_number: t.trim() });
  };

  return (
    <div className="p-6 space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
            Lifestyle Fulfillment <Package size={18} className="text-[#d6a93d]" />
          </h1>
          <p className="text-xs text-text-tertiary mt-0.5">Ship physical rewards / book travel for PS-gated redemptions.</p>
        </div>
        <button
          type="button"
          onClick={() => void fetchData()}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-primary text-xs hover:bg-bg-hover"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </header>

      <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-secondary border border-border-primary w-fit overflow-x-auto">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={
              'px-3 py-1.5 rounded-md text-xs font-medium capitalize whitespace-nowrap transition-colors ' +
              (filter === s ? 'bg-[#d6a93d]/15 text-text-primary border border-[#d6a93d]/40' : 'text-text-secondary hover:text-text-primary border border-transparent')
            }
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-text-secondary text-sm justify-center">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border-primary bg-bg-secondary p-12 text-center text-sm text-text-tertiary">
          No fulfillments in this state.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-primary bg-bg-secondary">
          <table className="w-full text-xs">
            <thead className="text-text-tertiary uppercase tracking-wider text-[10.5px]">
              <tr>
                <th className="text-left px-3 py-2">Requested</th>
                <th className="text-left px-3 py-2">User</th>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-left px-3 py-2">FXA Paid</th>
                <th className="text-left px-3 py-2">PS at Redeem</th>
                <th className="text-left px-3 py-2">Tracking</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id} className="border-t border-border-primary">
                  <td className="px-3 py-2 tabular-nums">
                    {f.requested_at ? new Date(f.requested_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-text-primary">{f.user_name}</div>
                    <div className="text-text-tertiary text-[10.5px]">{f.user_email}</div>
                  </td>
                  <td className="px-3 py-2 text-text-primary">{f.item_label}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(f.ac_paid)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(f.user_ps_at_redeem)}</td>
                  <td className="px-3 py-2">{f.tracking_number || <span className="text-text-tertiary">—</span>}</td>
                  <td className="px-3 py-2">
                    <span className={
                      'inline-block px-2 py-0.5 rounded text-[10.5px] uppercase tracking-wider ' +
                      (f.status === 'queued' ? 'bg-amber-400/10 text-amber-400' :
                       f.status === 'processing' ? 'bg-blue-400/10 text-blue-400' :
                       f.status === 'shipped' ? 'bg-emerald-400/10 text-emerald-400' :
                       f.status === 'delivered' ? 'bg-emerald-400/20 text-emerald-300' :
                       f.status === 'cancelled' ? 'bg-red-400/10 text-red-400' :
                       'bg-bg-base text-text-tertiary')
                    }>
                      {f.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right space-x-1">
                    {f.status === 'queued' && (
                      <button
                        type="button"
                        onClick={() => void update(f.id, { status: 'processing' })}
                        disabled={busyId === f.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border border-blue-400/40 text-blue-400 hover:bg-blue-400/5 disabled:opacity-50"
                      >
                        Process
                      </button>
                    )}
                    {(f.status === 'queued' || f.status === 'processing') && (
                      <button
                        type="button"
                        onClick={() => promptTracking(f.id)}
                        disabled={busyId === f.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/5 disabled:opacity-50"
                      >
                        <Send size={10} /> Ship
                      </button>
                    )}
                    {f.status === 'shipped' && (
                      <button
                        type="button"
                        onClick={() => void update(f.id, { status: 'delivered' })}
                        disabled={busyId === f.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/5 disabled:opacity-50"
                      >
                        <Truck size={10} /> Delivered
                      </button>
                    )}
                    {f.status !== 'cancelled' && f.status !== 'delivered' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm('Cancel this fulfillment? Note: FXA is NOT auto-refunded — handle separately if required.')) return;
                          void update(f.id, { status: 'cancelled' });
                        }}
                        disabled={busyId === f.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border border-red-400/40 text-red-400 hover:bg-red-400/5 disabled:opacity-50"
                      >
                        <XCircle size={10} /> Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
