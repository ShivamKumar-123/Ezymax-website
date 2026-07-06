'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { ibGet, fmt, fmtDate, UnauthorizedError } from '@/lib/api';
import type { Paginated, Commission, CommissionSummary } from '@/lib/types';
import SectionCard from '@/components/SectionCard';
import DataTable from '@/components/DataTable';
import Filters, { FilterState } from '@/components/Filters';
import Pagination from '@/components/Pagination';
import { downloadStatementPdf } from '@/lib/pdf/statementPdf';

export default function CommissionsPage() {
  const router = useRouter();
  const [data, setData] = useState<Paginated<Commission> | null>(null);
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        status: filters.status || undefined,
        date_from: filters.date_from,
        date_to: filters.date_to,
      };
      const [list, sum] = await Promise.all([
        ibGet<Paginated<Commission>>('/business/ib/commissions', { page, per_page: 25, ...params }),
        ibGet<CommissionSummary>('/business/ib/commissions/by-source', params),
      ]);
      setData(list);
      setSummary(sum);
    } catch (e: any) {
      if (e instanceof UnauthorizedError) return router.replace('/login');
      toast.error(e?.message || 'Could not load commissions.');
    } finally {
      setLoading(false);
    }
  }, [page, filters, router]);

  useEffect(() => { load(); }, [load]);

  const exportPdf = () => {
    const rows = data?.items || [];
    if (!rows.length) return toast.error('Nothing to export.');
    const total = rows.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    downloadStatementPdf(
      rows,
      [
        { header: 'From', value: (c: Commission) => c.source_user?.name || c.source_user?.email || '—', width: 55 },
        { header: 'Type', value: (c: Commission) => (c.commission_type || '').replace(/_/g, ' '), width: 40 },
        { header: 'Level', value: (c: Commission) => `L${c.mlm_level}`, align: 'center' },
        { header: 'Date', value: (c: Commission) => fmtDate(c.created_at) },
        { header: 'Status', value: (c: Commission) => c.status },
        { header: 'Amount', value: (c: Commission) => `$${fmt(c.amount)}`, align: 'right' },
      ],
      {
        title: 'Commission statement',
        subtitle: `Page ${data?.page} · ${data?.total} total`,
        totalsLabel: 'Page total',
        totalsValue: `$${fmt(total)}`,
        filename: 'fxartha-ib-commissions.pdf',
      },
    ).catch(() => toast.error('PDF export failed.'));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-text-primary">Commissions</h1>
        <button onClick={exportPdf} className="inline-flex items-center gap-1.5 rounded-lg border border-border-primary px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-bg-hover hover:text-text-primary">
          <Download size={14} /> Download statement
        </button>
      </div>

      <Filters value={filters} onChange={(f) => { setPage(1); setFilters(f); }} showSearch={false} showDates showStatus />

      {/* Where the money comes from */}
      <SectionCard title="Where it comes from" subtitle={`Grand total: $${fmt(summary?.grand_total || 0)} across ${summary?.sources.length || 0} users`}>
        {!summary || summary.sources.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-text-tertiary">No commission data for these filters.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-primary text-[10px] uppercase tracking-wide text-text-tertiary">
                <th className="px-4 py-2.5 text-left">Source user</th>
                <th className="px-4 py-2.5 text-left">Breakdown</th>
                <th className="px-4 py-2.5 text-right">Count</th>
                <th className="px-4 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {summary.sources.map((s) => (
                <tr
                  key={s.source_user.id}
                  className="cursor-pointer border-b border-border-primary/50 hover:bg-bg-hover/40"
                  onClick={() => router.push(`/users/${s.source_user.id}`)}
                >
                  <td className="px-4 py-2.5">
                    <p className="text-text-primary">{s.source_user.name || s.source_user.email}</p>
                    <p className="text-[11px] text-text-tertiary">{s.source_user.email}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {s.by_type.map((t) => (
                        <span key={t.commission_type} className="rounded bg-bg-hover px-1.5 py-0.5 text-[10px] text-text-secondary">
                          {t.commission_type.replace(/_/g, ' ')}: ${fmt(t.amount)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-text-secondary">{s.total_count}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-success">${fmt(s.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Full history */}
      <SectionCard title="Commission history" subtitle="Every commission row">
        <DataTable<Commission>
          loading={loading}
          rows={data?.items || []}
          empty="No commissions match these filters."
          onRowClick={(c) => c.source_user?.id && router.push(`/users/${c.source_user.id}`)}
          columns={[
            { key: 'from', label: 'From', render: (c) => c.source_user?.name || c.source_user?.email },
            { key: 'type', label: 'Type', render: (c) => <span className="capitalize">{c.commission_type?.replace(/_/g, ' ')}</span> },
            { key: 'level', label: 'Level', align: 'center', render: (c) => `L${c.mlm_level}` },
            { key: 'date', label: 'Date', render: (c) => fmtDate(c.created_at) },
            { key: 'amount', label: 'Amount', align: 'right', render: (c) => <span className="font-mono text-success">${fmt(c.amount)}</span> },
            {
              key: 'status',
              label: 'Status',
              align: 'right',
              render: (c) => <span className={c.status === 'paid' ? 'text-success' : 'text-warning'}>{c.status}</span>,
            },
          ]}
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />}
      </SectionCard>
    </div>
  );
}
