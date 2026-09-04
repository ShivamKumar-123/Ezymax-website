'use client';

/**
 * Admin · Coin Tasks.
 *
 * Edits `rewards_missions` — the catalogue behind the trader's Rewards → Tasks
 * screen. Wording, target count, the daily earning (FXA + XP), scheduling and
 * the active flag are all editable here; the slug is not, because the seeder
 * and any hard-coded hooks match on it.
 *
 * Backed by (backend/services/admin/routes/rewards_tasks.py):
 *   GET    /api/v1/admin/rewards-tasks?period=&search=&active=
 *   PUT    /api/v1/admin/rewards-tasks/{id}
 *   POST   /api/v1/admin/rewards-tasks
 *   DELETE /api/v1/admin/rewards-tasks/{id}?force=
 *
 * Editing a task changes what FUTURE completions pay — coins already credited
 * live in rewards_transactions and are untouched.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Loader2, Save, RefreshCw, Search, CheckSquare, Trash2, Plus, X,
} from 'lucide-react';

const LIME = '#ccff00';

interface Task {
  id: string;
  slug: string;
  period: string;
  title: string;
  description: string;
  action_kind: string;
  target_count: number;
  xp_reward: number;
  fxa_reward: number;
  ps_reward: number;
  is_active: boolean;
  display_order: number;
  streak_day: number | null;
  starts_at: string | null;
  expires_at: string | null;
}

interface ListResp {
  items: Task[];
  total: number;
  periods: string[];
}

/** The editable subset, held as strings so inputs stay controlled. */
type Draft = {
  title: string;
  description: string;
  target_count: string;
  xp_reward: string;
  fxa_reward: string;
  ps_reward: string;
  display_order: string;
  streak_day: string;
  is_active: boolean;
};

const toDraft = (t: Task): Draft => ({
  title: t.title,
  description: t.description,
  target_count: String(t.target_count),
  xp_reward: String(t.xp_reward),
  fxa_reward: String(t.fxa_reward),
  ps_reward: String(t.ps_reward),
  display_order: String(t.display_order),
  streak_day: t.streak_day == null ? '' : String(t.streak_day),
  is_active: t.is_active,
});

const isDirty = (t: Task, d: Draft) =>
  d.title !== t.title ||
  d.description !== t.description ||
  Number(d.target_count) !== t.target_count ||
  Number(d.xp_reward) !== t.xp_reward ||
  Number(d.fxa_reward) !== t.fxa_reward ||
  Number(d.ps_reward) !== t.ps_reward ||
  Number(d.display_order) !== t.display_order ||
  (d.streak_day === '' ? null : Number(d.streak_day)) !== t.streak_day ||
  d.is_active !== t.is_active;

export default function AdminRewardTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [periods, setPeriods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (query.trim()) params.search = query.trim();
      if (period) params.period = period;
      const res = await adminApi.get<ListResp>('/rewards-tasks', params);
      const items = res.items || [];
      setTasks(items);
      setPeriods(res.periods || []);
      const d: Record<string, Draft> = {};
      for (const t of items) d[t.id] = toDraft(t);
      setDrafts(d);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [query, period]);

  useEffect(() => { load(); }, [load]);

  const setField = <K extends keyof Draft>(id: string, field: K, value: Draft[K]) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const save = async (t: Task) => {
    const d = drafts[t.id];
    if (!d) return;
    const target = Number(d.target_count);
    const xp = Number(d.xp_reward);
    const fxa = Number(d.fxa_reward);
    const ps = Number(d.ps_reward);
    const order = Number(d.display_order);
    if (!d.title.trim()) return toast.error('Title cannot be empty');
    if (!Number.isFinite(target) || target < 1) return toast.error('Target must be at least 1');
    if (![xp, fxa, ps, order].every((n) => Number.isFinite(n)) || xp < 0 || fxa < 0 || ps < 0) {
      return toast.error('Coins cannot be negative');
    }
    const streak = d.streak_day === '' ? 0 : Number(d.streak_day);
    if (streak && (streak < 1 || streak > 7)) return toast.error('Streak day must be 1-7 (or blank)');

    setSavingId(t.id);
    try {
      const res = await adminApi.put<{ task: Task }>(`/rewards-tasks/${t.id}`, {
        title: d.title.trim(),
        description: d.description.trim(),
        target_count: target,
        xp_reward: xp,
        fxa_reward: fxa,
        ps_reward: ps,
        display_order: order,
        streak_day: streak,
        is_active: d.is_active,
      });
      const updated = res.task;
      setTasks((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
      setDrafts((prev) => ({ ...prev, [t.id]: toDraft(updated) }));
      toast.success(`Saved · ${updated.title}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (t: Task) => {
    if (!confirm(`Delete "${t.title}"?\n\nIf users already have progress on it, deactivate it instead — that hides it from the app without destroying their history.`)) return;
    try {
      await adminApi.delete(`/rewards-tasks/${t.id}`);
      setTasks((prev) => prev.filter((x) => x.id !== t.id));
      toast.success('Task deleted');
    } catch (e) {
      // The API refuses (409) when progress exists; surface its message so the
      // admin can choose to deactivate instead.
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const grouped = useMemo(() => {
    const by: Record<string, Task[]> = {};
    for (const t of tasks) (by[t.period] ||= []).push(t);
    return by;
  }, [tasks]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(search);
  };

  const inputCls =
    'w-full px-2 py-1.5 rounded-md bg-bg-base border border-border-primary text-xs text-text-primary focus:outline-none focus:border-[#ccff00]/50';

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <CheckSquare size={22} style={{ color: LIME }} />
          <h1 className="text-xl font-bold text-text-primary">Coin Tasks</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ccff00]/40 bg-[#ccff00]/10 text-xs font-semibold text-text-primary hover:bg-[#ccff00]/20"
          >
            <Plus size={13} /> New task
          </button>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-primary bg-bg-secondary text-xs text-text-primary hover:border-[#ccff00]/40"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>
      <p className="text-xs text-text-tertiary mb-4">
        Edit the tasks users see under Rewards → Tasks, including the FXA-AC, XP and PS coins each one pays out.
        Changes apply to future completions; coins already credited are not affected.
      </p>

      <form onSubmit={submitSearch} className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, slug or description…"
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-bg-secondary border border-border-primary text-xs text-text-primary focus:outline-none focus:border-[#ccff00]/50"
          />
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2 rounded-lg bg-bg-secondary border border-border-primary text-xs text-text-primary focus:outline-none"
        >
          <option value="">All periods</option>
          {periods.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button
          type="submit"
          className="px-3 py-2 rounded-lg border border-border-primary bg-bg-secondary text-xs text-text-primary hover:border-[#ccff00]/40"
        >
          Search
        </button>
      </form>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-text-tertiary py-10 justify-center">
          <Loader2 size={16} className="animate-spin" /> Loading tasks…
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-10 text-center text-xs text-text-tertiary">No tasks match this filter.</div>
      ) : (
        Object.entries(grouped).map(([p, list]) => (
          <section key={p} className="mb-6">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
              {p} · {list.length}
            </h2>
            <div className="space-y-2">
              {list.map((t) => {
                const d = drafts[t.id];
                if (!d) return null;
                const dirty = isDirty(t, d);
                return (
                  <div
                    key={t.id}
                    className={`rounded-xl border p-3 ${
                      d.is_active ? 'border-border-primary bg-bg-secondary' : 'border-border-primary bg-bg-secondary opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <input
                          value={d.title}
                          onChange={(e) => setField(t.id, 'title', e.target.value)}
                          className={`${inputCls} font-semibold`}
                          placeholder="Title"
                        />
                        <textarea
                          value={d.description}
                          onChange={(e) => setField(t.id, 'description', e.target.value)}
                          rows={2}
                          className={`${inputCls} resize-y`}
                          placeholder="Description shown under the title"
                        />
                        <p className="font-mono text-[10px] text-text-tertiary">
                          slug: {t.slug} · action: {t.action_kind}
                        </p>
                      </div>

                      <div className="grid w-[390px] shrink-0 grid-cols-3 gap-2">
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
                            FXA-AC Coins
                          </span>
                          <input
                            type="number" step="0.01" min="0"
                            value={d.fxa_reward}
                            onChange={(e) => setField(t.id, 'fxa_reward', e.target.value)}
                            className={`${inputCls} font-mono`}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
                            XP Coins
                          </span>
                          <input
                            type="number" step="1" min="0"
                            value={d.xp_reward}
                            onChange={(e) => setField(t.id, 'xp_reward', e.target.value)}
                            className={`${inputCls} font-mono`}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
                            PS Coins
                          </span>
                          <input
                            type="number" step="1" min="0"
                            value={d.ps_reward}
                            onChange={(e) => setField(t.id, 'ps_reward', e.target.value)}
                            className={`${inputCls} font-mono`}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
                            Target count
                          </span>
                          <input
                            type="number" step="1" min="1"
                            value={d.target_count}
                            onChange={(e) => setField(t.id, 'target_count', e.target.value)}
                            className={`${inputCls} font-mono`}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
                            Order
                          </span>
                          <input
                            type="number" step="1"
                            value={d.display_order}
                            onChange={(e) => setField(t.id, 'display_order', e.target.value)}
                            className={`${inputCls} font-mono`}
                          />
                        </label>
                        {p === 'daily' && (
                          <label className="col-span-3 block">
                            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
                              Streak day (1-7, blank = every day)
                            </span>
                            <input
                              type="number" step="1" min="1" max="7"
                              value={d.streak_day}
                              onChange={(e) => setField(t.id, 'streak_day', e.target.value)}
                              className={`${inputCls} font-mono`}
                            />
                          </label>
                        )}
                      </div>

                      <div className="flex w-[110px] shrink-0 flex-col items-end gap-2">
                        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-text-secondary">
                          <input
                            type="checkbox"
                            checked={d.is_active}
                            onChange={(e) => setField(t.id, 'is_active', e.target.checked)}
                            className="h-3.5 w-3.5 accent-[#ccff00]"
                          />
                          Active
                        </label>
                        <button
                          type="button"
                          onClick={() => save(t)}
                          disabled={!dirty || savingId === t.id}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0a0a0a] transition-opacity disabled:opacity-40"
                          style={{ background: LIME }}
                        >
                          {savingId === t.id ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(t)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {creating && <CreateTaskModal periods={periods} onClose={() => setCreating(false)} onCreated={load} />}
    </div>
  );
}

/** Minimal create form — slug/period/action_kind are required and immutable
 *  afterwards, so they only appear here. */
function CreateTaskModal({
  periods, onClose, onCreated,
}: { periods: string[]; onClose: () => void; onCreated: () => void }) {
  const [slug, setSlug] = useState('');
  const [period, setPeriod] = useState(periods[0] || 'daily');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [actionKind, setActionKind] = useState('');
  const [fxa, setFxa] = useState('0');
  const [xp, setXp] = useState('0');
  const [ps, setPs] = useState('100');
  const [target, setTarget] = useState('1');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim() || !title.trim() || !actionKind.trim()) {
      return toast.error('Slug, title and action kind are required');
    }
    setBusy(true);
    try {
      await adminApi.post('/rewards-tasks', {
        slug: slug.trim(),
        period,
        title: title.trim(),
        description: description.trim(),
        action_kind: actionKind.trim(),
        target_count: Number(target) || 1,
        xp_reward: Number(xp) || 0,
        fxa_reward: Number(fxa) || 0,
        ps_reward: Number(ps) || 0,
      });
      toast.success('Task created');
      onCreated();
      onClose();
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const cls =
    'w-full px-2.5 py-2 rounded-lg bg-bg-base border border-border-primary text-xs text-text-primary focus:outline-none focus:border-[#ccff00]/50';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-2xl border border-border-primary bg-bg-secondary p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-text-primary">New task</h2>
          <button type="button" onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Slug (permanent)</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className={cls} placeholder="daily_place_trade" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Period</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className={cls}>
            {(periods.length ? periods : ['daily']).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={cls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${cls} resize-y`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
            Action kind — must match what the gateway reports for this task
          </span>
          <input value={actionKind} onChange={(e) => setActionKind(e.target.value)} className={cls} placeholder="place_trade" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">FXA-AC Coins</span>
            <input type="number" step="0.01" min="0" value={fxa} onChange={(e) => setFxa(e.target.value)} className={`${cls} font-mono`} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">XP Coins</span>
            <input type="number" step="1" min="0" value={xp} onChange={(e) => setXp(e.target.value)} className={`${cls} font-mono`} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">PS Coins</span>
            <input type="number" step="1" min="0" value={ps} onChange={(e) => setPs(e.target.value)} className={`${cls} font-mono`} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Target count</span>
            <input type="number" step="1" min="1" value={target} onChange={(e) => setTarget(e.target.value)} className={`${cls} font-mono`} />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-[#0a0a0a] disabled:opacity-50"
          style={{ background: LIME }}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create
        </button>
      </form>
    </div>
  );
}
