'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronRight as ChevR, Loader2, ShieldAlert } from 'lucide-react';

interface AdminAuditRow {
  id: string;
  admin_id: string | null;
  admin_email: string | null;
  admin_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string | null;
}

const PAGE_SIZE = 25;

function formatTime(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Colour-key common admin actions so a scan of the log is faster.
 *  Unknown actions fall through to the neutral default. */
function actionStyle(action: string): string {
  const a = (action || '').toLowerCase();
  if (a.includes('delete') || a.includes('revoke') || a.includes('reject')) return 'bg-danger/15 text-danger';
  if (a.includes('create') || a.includes('grant') || a.includes('approve')) return 'bg-success/15 text-success';
  if (a.includes('impersonate') || a.includes('login')) return 'bg-warning/15 text-warning';
  if (a.includes('update') || a.includes('edit')) return 'bg-info/15 text-info';
  return 'bg-bg-hover text-text-secondary';
}

export default function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [adminIdFilter, setAdminIdFilter] = useState('');
  const [adminIdApplied, setAdminIdApplied] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actionOptions, setActionOptions] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [items, setItems] = useState<AdminAuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Populate the action-filter dropdown once from the distinct actions
  // the server has seen, so admins don't have to guess strings.
  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.get<string[]>('/admin-audit-logs/actions');
        if (Array.isArray(res)) setActionOptions(res);
      } catch {
        /* leave empty — filter just shows All */
      }
    })();
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        per_page: String(PAGE_SIZE),
      };
      if (action) params.action = action;
      if (entityType) params.entity_type = entityType;
      if (adminIdApplied.trim()) params.admin_id = adminIdApplied.trim();
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await adminApi.get<{ items: AdminAuditRow[]; total: number }>(
        '/admin-audit-logs', params,
      );
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load audit logs');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, action, entityType, adminIdApplied, dateFrom, dateTo]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [action, entityType, adminIdApplied, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const applyAdminFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminIdApplied(adminIdFilter.trim());
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <ShieldAlert size={18} className="text-warning" />
          Admin audit logs
        </h1>
        <p className="text-xxs text-text-tertiary mt-0.5">
          Actions taken by admins (bonus changes, fund grants, impersonations, …). Trader-side activity lives under <span className="font-medium text-text-secondary">Audit logs</span>.
        </p>
      </div>

      <div className="bg-bg-secondary border border-border-primary rounded-md">
        <div className="flex flex-wrap items-end gap-3 p-3 border-b border-border-primary">
          <div>
            <span className="text-xxs text-text-tertiary block mb-1">Action</span>
            <div className="relative">
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="text-xs py-1.5 pl-2 pr-7 min-w-[12rem] appearance-none bg-bg-input border border-border-primary rounded-md text-text-primary"
              >
                <option value="">All actions</option>
                {actionOptions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
            </div>
          </div>
          <div>
            <span className="text-xxs text-text-tertiary block mb-1">Entity type</span>
            <input
              type="text"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              placeholder="e.g. user, bonus_offer"
              className="text-xs py-1.5 px-2 w-44 bg-bg-input border border-border-primary rounded-md text-text-primary placeholder:text-text-tertiary"
            />
          </div>
          <div>
            <span className="text-xxs text-text-tertiary block mb-1">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary"
            />
          </div>
          <div>
            <span className="text-xxs text-text-tertiary block mb-1">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary"
            />
          </div>
          <form onSubmit={applyAdminFilter} className="flex items-end gap-2">
            <div>
              <span className="text-xxs text-text-tertiary block mb-1">Admin ID</span>
              <input
                type="text"
                value={adminIdFilter}
                onChange={(e) => setAdminIdFilter(e.target.value)}
                placeholder="UUID…"
                className="text-xs py-1.5 px-2 w-56 bg-bg-input border border-border-primary rounded-md text-text-primary placeholder:text-text-tertiary font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-2.5 py-1.5 text-xs font-medium bg-bg-hover border border-border-primary rounded-md text-text-secondary hover:text-text-primary transition-fast"
            >
              Apply
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-primary text-left text-text-tertiary uppercase tracking-wider">
                <th className="px-3 py-2 font-semibold w-8"></th>
                <th className="px-3 py-2 font-semibold">Admin</th>
                <th className="px-3 py-2 font-semibold">Action</th>
                <th className="px-3 py-2 font-semibold">Entity</th>
                <th className="px-3 py-2 font-semibold">IP</th>
                <th className="px-3 py-2 font-semibold">Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-text-tertiary">
                    <Loader2 className="inline animate-spin mr-2" size={16} /> Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-text-tertiary">No audit entries</td>
                </tr>
              ) : (
                items.map((row) => {
                  const hasValues = !!(row.old_values || row.new_values);
                  const isOpen = expanded === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={cn(
                          'border-b border-border-primary/60 hover:bg-bg-hover/40 transition-fast',
                          hasValues && 'cursor-pointer',
                        )}
                        onClick={() => hasValues && setExpanded(isOpen ? null : row.id)}
                      >
                        <td className="px-3 py-2 align-top text-text-tertiary">
                          {hasValues ? (
                            <ChevR
                              size={12}
                              className={cn('transition-transform', isOpen && 'rotate-90')}
                            />
                          ) : null}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="text-text-primary font-medium">{row.admin_email || '—'}</div>
                          {row.admin_name ? (
                            <div className="text-xxs text-text-tertiary">{row.admin_name}</div>
                          ) : null}
                          {row.admin_id ? (
                            <div className="text-[10px] text-text-tertiary font-mono mt-0.5">{row.admin_id}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span className={cn('inline-flex px-1.5 py-0.5 rounded-sm font-semibold', actionStyle(row.action))}>
                            {row.action}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="text-text-secondary">{row.entity_type || '—'}</div>
                          {row.entity_id ? (
                            <div className="text-[10px] text-text-tertiary font-mono mt-0.5 break-all">{row.entity_id}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 align-top font-mono text-text-secondary whitespace-nowrap">
                          {row.ip_address || '—'}
                        </td>
                        <td className="px-3 py-2 align-top text-text-tertiary whitespace-nowrap">
                          {formatTime(row.created_at)}
                        </td>
                      </tr>
                      {isOpen && hasValues && (
                        <tr className="bg-bg-base border-b border-border-primary/60">
                          <td colSpan={6} className="px-3 py-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <p className="text-xxs uppercase tracking-wider text-text-tertiary mb-1">Before</p>
                                <pre className="text-[11px] text-text-secondary bg-bg-input border border-border-primary rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-all">
{row.old_values ? JSON.stringify(row.old_values, null, 2) : '—'}
                                </pre>
                              </div>
                              <div>
                                <p className="text-xxs uppercase tracking-wider text-text-tertiary mb-1">After</p>
                                <pre className="text-[11px] text-text-secondary bg-bg-input border border-border-primary rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-all">
{row.new_values ? JSON.stringify(row.new_values, null, 2) : '—'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border-primary text-xxs text-text-tertiary">
            <span>Page {page} of {totalPages} · {total} total</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded border border-border-primary disabled:opacity-40 hover:bg-bg-hover"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded border border-border-primary disabled:opacity-40 hover:bg-bg-hover"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
