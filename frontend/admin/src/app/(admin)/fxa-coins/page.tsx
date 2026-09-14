'use client';

/**
 * Admin · AC Coins.
 *
 * View EVERY user's reward-coin balance — AC (ac_balance), plus XP and PS —
 * and edit any of them. Each save writes a rewards_transactions 'adjust' entry
 * so the manual change is auditable. Backed by
 *   GET /api/v1/admin/rewards-coins?search=&page=&per_page=
 *   PUT /api/v1/admin/rewards-coins/{user_id}   { fxa, xp, ps }
 * (backend/services/admin/routes/rewards_coins.py).
 */
import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, Save, RefreshCw, Search, Coins, ChevronLeft, ChevronRight } from 'lucide-react';

const LIME = '#ccff00';
const PER_PAGE = 25;

interface Row {
  user_id: string;
  name: string;
  email: string;
  fxa: number;
  xp: number;
  ps: number;
}

interface ListResp {
  items: Row[];
  total: number;
  page: number;
  per_page: number;
}

export default function AdminFxaCoinsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [draft, setDraft] = useState<Record<string, { fxa: string; xp: string; ps: string }>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), per_page: String(PER_PAGE) };
      if (query.trim()) params.search = query.trim();
      const res = await adminApi.get<ListResp>('/rewards-coins', params);
      const items = res.items || [];
      setRows(items);
      setTotal(res.total || 0);
      const d: Record<string, { fxa: string; xp: string; ps: string }> = {};
      for (const r of items) d[r.user_id] = { fxa: String(r.fxa), xp: String(r.xp), ps: String(r.ps) };
      setDraft(d);
    } catch (e) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => { load(); }, [load]);

  const setField = (id: string, field: 'fxa' | 'xp' | 'ps', value: string) =>
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const dirty = (r: Row) => {
    const d = draft[r.user_id];
    if (!d) return false;
    return Number(d.fxa) !== r.fxa || Number(d.xp) !== r.xp || Number(d.ps) !== r.ps;
  };

  const save = async (r: Row) => {
    const d = draft[r.user_id];
    if (!d) return;
    const fxa = Number(d.fxa), xp = Number(d.xp), ps = Number(d.ps);
    if ([fxa, xp, ps].some((n) => !Number.isFinite(n) || n < 0)) {
      toast.error('Values must be 0 or more');
      return;
    }
    setSavingId(r.user_id);
    try {
      const updated = await adminApi.put<Row>(`/rewards-coins/${r.user_id}`, { fxa, xp, ps });
      setRows((prev) => prev.map((x) => (x.user_id === r.user_id ? updated : x)));
      setDraft((prev) => ({
        ...prev,
        [r.user_id]: { fxa: String(updated.fxa), xp: String(updated.xp), ps: String(updated.ps) },
      }));
      toast.success(`Saved · ${updated.name || updated.email}`);
    } catch (e) {
      toast.error('Save failed');
    } finally {
      setSavingId(null);
    }
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(search);
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="p-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <Coins size={22} style={{ color: LIME }} />
          <h1 className="text-xl font-bold text-text-primary">AC Coins</h1>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-primary bg-bg-secondary text-xs text-text-primary hover:border-[#ccff00]/40"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      <p className="text-xs text-text-tertiary mb-4">
        Edit any user&apos;s AC (Artha Coin) balance, XP and PS. Every change is logged to the rewards ledger.
      </p>

      <form onSubmit={submitSearch} className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            className="inp pl-8"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-bold text-black" style={{ background: LIME }}>
          Search
        </button>
        {query && (
          <button
            type="button"
            onClick={() => { setSearch(''); setQuery(''); setPage(1); }}
            className="px-3 py-1.5 rounded-lg text-xs border border-border-primary bg-bg-secondary text-text-secondary"
          >
            Clear
          </button>
        )}
      </form>

      <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-x-auto">
        <table className="w-full text-xs min-w-[760px]">
          <thead className="text-[10px] uppercase tracking-wider text-text-tertiary">
            <tr className="border-b border-border-primary">
              <th className="text-left py-3 px-3 font-bold">User</th>
              <th className="text-right py-3 px-2 font-bold" style={{ color: LIME }}>AC</th>
              <th className="text-right py-3 px-2 font-bold">XP</th>
              <th className="text-right py-3 px-2 font-bold">PS</th>
              <th className="py-3 px-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-10 text-center text-text-tertiary"><Loader2 className="inline animate-spin" size={18} /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="py-10 text-center text-text-tertiary">No users found</td></tr>
            ) : (
              rows.map((r) => {
                const d = draft[r.user_id] || { fxa: '0', xp: '0', ps: '0' };
                const isDirty = dirty(r);
                return (
                  <tr key={r.user_id} className="border-b border-border-primary/50 last:border-0">
                    <td className="py-2.5 px-3 min-w-[220px]">
                      <div className="font-semibold text-text-primary truncate">{r.name || '—'}</div>
                      <div className="text-[11px] text-text-tertiary truncate">{r.email}</div>
                    </td>
                    <td className="py-2.5 px-2 w-28">
                      <input
                        type="number" step="0.01" min="0"
                        className="inp text-right font-semibold"
                        value={d.fxa}
                        onChange={(e) => setField(r.user_id, 'fxa', e.target.value)}
                      />
                    </td>
                    <td className="py-2.5 px-2 w-24">
                      <input
                        type="number" step="1" min="0"
                        className="inp text-right"
                        value={d.xp}
                        onChange={(e) => setField(r.user_id, 'xp', e.target.value)}
                      />
                    </td>
                    <td className="py-2.5 px-2 w-24">
                      <input
                        type="number" step="1" min="0"
                        className="inp text-right"
                        value={d.ps}
                        onChange={(e) => setField(r.user_id, 'ps', e.target.value)}
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        disabled={!isDirty || savingId === r.user_id}
                        onClick={() => save(r)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
                        style={{ background: isDirty ? LIME : 'transparent', color: isDirty ? '#000' : 'var(--text-tertiary)', border: isDirty ? 'none' : '1px solid var(--border-primary)' }}
                      >
                        {savingId === r.user_id ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 text-xs text-text-tertiary">
        <span>{total} user{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <button
            type="button" disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border-primary bg-bg-secondary text-text-primary disabled:opacity-40"
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span>Page {page} / {totalPages}</span>
          <button
            type="button" disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border-primary bg-bg-secondary text-text-primary disabled:opacity-40"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
