'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { ibGet, fmt, fmtDate, UnauthorizedError } from '@/lib/api';
import type { Paginated, Referral } from '@/lib/types';
import SectionCard from '@/components/SectionCard';
import DataTable from '@/components/DataTable';
import Filters, { FilterState } from '@/components/Filters';
import Pagination from '@/components/Pagination';
import { downloadStatementPdf } from '@/lib/pdf/statementPdf';

export default function UntradedPage() {
  const router = useRouter();
  const [data, setData] = useState<Paginated<Referral> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ibGet<Paginated<Referral>>('/business/ib/registered-no-trade', {
        page, per_page: 25, search: filters.search, date_from: filters.date_from, date_to: filters.date_to,
      });
      setData(res);
    } catch (e: any) {
      if (e instanceof UnauthorizedError) return router.replace('/login');
      toast.error(e?.message || 'Could not load list.');
    } finally {
      setLoading(false);
    }
  }, [page, filters, router]);

  useEffect(() => { load(); }, [load]);

  const exportPdf = () => {
    const rows = data?.items || [];
    if (!rows.length) return toast.error('Nothing to export.');
    downloadStatementPdf(
      rows,
      [
        { header: 'User', value: (r: Referral) => r.referred_user?.name || '—', width: 50 },
        { header: 'Email', value: (r: Referral) => r.referred_user?.email || '—', width: 60 },
        { header: 'Joined', value: (r: Referral) => fmtDate(r.referred_user?.joined_at) },
        { header: 'Accounts', value: (r: Referral) => String(r.accounts_count), align: 'right' },
        { header: 'Balance', value: (r: Referral) => `$${fmt(r.total_deposit)}`, align: 'right' },
      ],
      { title: 'Registered — never traded', subtitle: `${data?.total} users`, filename: 'fxartha-ib-untraded.pdf' },
    ).catch(() => toast.error('PDF export failed.'));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Registered — not traded yet</h1>
          <p className="text-xs text-text-tertiary">Referred users who signed up but never placed a trade — chase these up.</p>
        </div>
        <button onClick={exportPdf} className="inline-flex items-center gap-1.5 rounded-lg border border-border-primary px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-bg-hover hover:text-text-primary">
          <Download size={14} /> Download statement
        </button>
      </div>

      <Filters value={filters} onChange={(f) => { setPage(1); setFilters(f); }} showSearch showDates />

      <SectionCard title="No-trade users" subtitle="Click a user to view their account">
        <DataTable<Referral>
          loading={loading}
          rows={data?.items || []}
          empty="Everyone you referred has traded. 🎉"
          onRowClick={(r) => router.push(`/users/${r.user_id}`)}
          columns={[
            {
              key: 'user', label: 'User',
              render: (r) => (
                <div>
                  <p className="text-text-primary">{r.referred_user?.name || '—'}</p>
                  <p className="text-[11px] text-text-tertiary">{r.referred_user?.email}</p>
                </div>
              ),
            },
            { key: 'joined', label: 'Joined', render: (r) => fmtDate(r.referred_user?.joined_at) },
            { key: 'accounts_count', label: 'Accounts', align: 'right' },
            { key: 'balance', label: 'Balance', align: 'right', render: (r) => <span className="font-mono">${fmt(r.total_deposit)}</span> },
          ]}
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />}
      </SectionCard>
    </div>
  );
}
