'use client';

import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Activity, Square } from 'lucide-react';
import { aiApi, type AiInstance } from '@/lib/ai-strategies';
import { formatDateTime } from '@/lib/formatters';
import Pagination, { usePagination } from '@/components/ui/Pagination';

function StatusPill({ status }: { status: AiInstance['status'] }) {
  const map: Record<AiInstance['status'], { label: string; cls: string; dot: string }> = {
    running: { label: 'Running', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25', dot: 'bg-emerald-500' },
    stopped: { label: 'Stopped', cls: 'bg-bg-secondary text-text-tertiary border-border-primary', dot: 'bg-text-tertiary' },
    error: { label: 'Error', cls: 'bg-red-500/10 text-red-600 border-red-500/25', dot: 'bg-red-500' },
  };
  const m = map[status] ?? map.stopped;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide', m.cls)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

/** Live Instances — deployed strategy runners. Polls every 10s while visible. */
export default function InstancesTab() {
  const [instances, setInstances] = useState<AiInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [stoppingId, setStoppingId] = useState<string | null>(null);

  const fetchInstances = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true);
    try {
      const res = await aiApi.instances();
      setInstances(Array.isArray(res) ? res : []);
    } catch (e: unknown) {
      if (!opts.silent) toast.error(e instanceof Error ? e.message : 'Failed to load instances');
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInstances();
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void fetchInstances({ silent: true });
    }, 10_000);
    return () => clearInterval(t);
  }, [fetchInstances]);

  const stopInstance = async (id: string) => {
    setStoppingId(id);
    try {
      await aiApi.stopInstance(id);
      toast.success('Instance stopped');
      void fetchInstances({ silent: true });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to stop instance');
    } finally {
      setStoppingId(null);
    }
  };

  const pager = usePagination(instances, 10);
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E94E1B] border-t-transparent" />
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-bg-secondary border border-border-primary flex items-center justify-center mb-4">
          <Activity size={24} className="text-text-tertiary" />
        </div>
        <p className="text-text-primary font-medium">No live instances</p>
        <p className="text-sm text-text-tertiary mt-1">Deploy a strategy from the My Strategies tab to run it live</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border-primary rounded-xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="border-b border-border-primary text-text-tertiary text-left">
              <th className="px-4 py-2.5 font-medium">Strategy</th>
              <th className="px-4 py-2.5 font-medium">Account</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">Trades</th>
              <th className="px-4 py-2.5 font-medium">Started</th>
              <th className="px-4 py-2.5 font-medium text-right pr-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {pager.items.map((inst) => (
              <tr key={inst.id} className="border-b border-border-primary last:border-0 hover:bg-bg-hover align-top">
                <td className="px-4 py-3">
                  <p className="text-text-primary font-semibold">{inst.strategy_name}</p>
                  {inst.last_error && (
                    <p className="text-[10px] text-red-600 mt-1 max-w-[280px] break-words">{inst.last_error}</p>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-text-secondary">{inst.account_number}</td>
                <td className="px-4 py-3"><StatusPill status={inst.status} /></td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-text-primary">{inst.trades_count}</td>
                <td className="px-4 py-3 text-text-tertiary whitespace-nowrap">
                  {inst.started_at ? formatDateTime(inst.started_at) : '—'}
                  {inst.stopped_at && (
                    <span className="block text-[10px]">stopped {formatDateTime(inst.stopped_at)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right pr-4">
                  {inst.status === 'running' ? (
                    <button
                      type="button"
                      onClick={() => void stopInstance(inst.id)}
                      disabled={stoppingId === inst.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-500/30 text-red-600 text-[11px] font-bold hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      <Square size={11} /> {stoppingId === inst.id ? 'Stopping…' : 'Stop'}
                    </button>
                  ) : (
                    <span className="text-[10px] text-text-tertiary">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination {...pager.props} itemLabel="instances" />
      </div>
    </div>
  );
}
