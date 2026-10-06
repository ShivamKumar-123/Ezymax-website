'use client';

/**
 * Per-IB detail page — full commission history + summary.
 * Reached by clicking a row on /business/ib (Active IBs tab).
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Loader2, Receipt, RefreshCw, TrendingUp, Clock, Hash, Users,
  ChevronLeft, ChevronRight, Download,
} from 'lucide-react';

const PAGE_SIZE = 20;

interface IBHeader {
  id: string;
  user_email: string;
  user_name: string;
  referral_code: string;
  total_earned: number;
}

interface IBCommissionRow {
  id: string;
  source_user_id: string | null;
  source_user_email: string | null;
  source_user_name: string | null;
  source_trade_id: string | null;
  commission_type: string;
  amount: number;
  mlm_level: number;
  status: string;
  created_at: string | null;
}

interface CommissionsResponse {
  items: IBCommissionRow[];
  total: number;
  page: number;
  per_page: number;
  ib: IBHeader | null;
}

function fmtMoney(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateTime(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString();
}

export default function IBDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const ibId = params?.id;

  const [data, setData] = useState<CommissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [page, setPage] = useState(1);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    if (!ibId) return;
    setLoading(true);
    try {
      const q: Record<string, string> = { per_page: String(PAGE_SIZE), page: String(page) };
      if (statusFilter !== 'all') q.status = statusFilter;
      const res = await adminApi.get<CommissionsResponse>(`/business/ib/agents/${ibId}/commissions`, q);
      setData(res);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load IB detail');
    } finally {
      setLoading(false);
    }
  }, [ibId, statusFilter, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter changes reset us to page 1 so the user doesn't get stuck on
  // page 5 of a 1-page result set.
  useEffect(() => { setPage(1); }, [statusFilter]);

  // PDF export — pulls EVERY commission row (not just the current page) so the
  // downloaded report is a complete ledger, not whatever happened to be on screen.
  const handleDownloadPdf = useCallback(async () => {
    if (!ibId || !data?.ib) return;
    setPdfGenerating(true);
    try {
      // Dynamic imports — keep the ~80KB jspdf bundle out of the initial page load.
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const autoTable = (autoTableMod as any).default || (autoTableMod as any);

      // Pull all rows for this filter (cap at 1000 — enough for any realistic IB)
      const q: Record<string, string> = { per_page: '1000', page: '1' };
      if (statusFilter !== 'all') q.status = statusFilter;
      const full = await adminApi.get<CommissionsResponse>(`/business/ib/agents/${ibId}/commissions`, q);
      const allRows = full.items || [];

      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const ib = data.ib;
      const now = new Date();
      const stamp = now.toLocaleString();
      const pageW = doc.internal.pageSize.getWidth();

      // ── Layout rhythm (all derived from these, easy to tweak) ──
      const TOP_GAP = 40;             // breathing room from page top
      const LOGO_W = 160;             // wider — gets its own dedicated row
      const GAP_AFTER_LOGO = 28;      // vertical clear space below the logo
      let cursorY = TOP_GAP;

      // ── Row 1: Logo only (centered, nothing on its left or right) ──
      try {
        const res = await fetch('/ezymex-logo.png');
        const blob = await res.blob();
        const logoData: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const props = doc.getImageProperties(logoData);
        const logoH = LOGO_W * (props.height / props.width);
        doc.addImage(logoData, 'PNG', (pageW - LOGO_W) / 2, cursorY, LOGO_W, logoH);
        cursorY += logoH + GAP_AFTER_LOGO;
      } catch {
        // Logo failed to load — keep going without it, but still advance the
        // cursor so the title doesn't sit too close to the top edge.
        cursorY += 20;
      }

      // ── Row 2: Title ───────────────────────────────────────
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('IB Commission Report', 40, cursorY);
      cursorY += 22;

      // ── Row 3+: IB info on left, totals on right (parallel columns) ──
      const infoStartY = cursorY;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Name: ${ib.user_name || '-'}`,        40, infoStartY);
      doc.text(`Email: ${ib.user_email}`,             40, infoStartY + 15);
      doc.text(`Referral Code: ${ib.referral_code}`,  40, infoStartY + 30);
      doc.text(`Filter: ${statusFilter === 'all' ? 'All statuses' : statusFilter}`, 40, infoStartY + 45);
      doc.text(`Generated: ${stamp}`,                 40, infoStartY + 60);

      // Totals (right-aligned, parallel column)
      const paidSum = allRows.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);
      const pendingSum = allRows.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Earned:    $${fmtMoney(ib.total_earned)}`, pageW - 40, infoStartY,      { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.text(`Paid (filtered): $${fmtMoney(paidSum)}`,         pageW - 40, infoStartY + 15, { align: 'right' });
      doc.text(`Pending (filt.): $${fmtMoney(pendingSum)}`,      pageW - 40, infoStartY + 30, { align: 'right' });
      doc.text(`Total rows:      ${allRows.length}`,              pageW - 40, infoStartY + 45, { align: 'right' });

      cursorY = infoStartY + 60 + 25;  // bottom of info block + breathing room

      // ── Table ──────────────────────────────────────────────
      autoTable(doc, {
        startY: cursorY,
        head: [['Date', 'Source Trader', 'Email', 'Type', 'MLM Level', 'Amount (USD)', 'Status', 'Trade ID']],
        body: allRows.map(r => [
          fmtDateTime(r.created_at),
          r.source_user_name || '-',
          r.source_user_email || '-',
          r.commission_type,
          `L${r.mlm_level}`,
          `$${fmtMoney(r.amount)}`,
          r.status,
          r.source_trade_id ? r.source_trade_id.slice(0, 12) + '...' : '-',
        ]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [204, 0, 0], textColor: 255 },  // brand red to match the UI accent
        columnStyles: {
          4: { halign: 'right' },
          5: { halign: 'right', fontStyle: 'bold' },
        },
        didDrawPage: (d: any) => {
          // Page-number footer
          const w = doc.internal.pageSize.getWidth();
          const h = doc.internal.pageSize.getHeight();
          doc.setFontSize(8);
          doc.setTextColor(140);
          doc.text(`Page ${d.pageNumber}`, w - 40, h - 20, { align: 'right' });
          doc.text(`Ezymex - confidential`, 40, h - 20);
        },
      });

      const safeCode = (ib.referral_code || 'ib').replace(/[^A-Za-z0-9_-]/g, '');
      const dateStr = now.toISOString().slice(0, 10);
      doc.save(`ib-commissions-${safeCode}-${dateStr}.pdf`);
      toast.success('PDF downloaded');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate PDF');
    } finally {
      setPdfGenerating(false);
    }
  }, [ibId, data?.ib, statusFilter]);

  const rows = data?.items || [];
  // Per-level breakdown for the summary cards. Cheap to compute client-side
  // since the page caps at per_page=200 rows.
  const levelBreakdown = rows.reduce<Record<number, number>>((acc, r) => {
    acc[r.mlm_level] = (acc[r.mlm_level] || 0) + r.amount;
    return acc;
  }, {});
  const paidTotal = rows.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);
  const pendingTotal = rows.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
  const ib = data?.ib;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/business/ib')}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast"
        >
          <ArrowLeft size={14} /> Back to IB list
        </button>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={22} className="animate-spin text-text-tertiary" />
        </div>
      ) : !ib ? (
        <div className="text-center text-xs text-text-tertiary py-20">IB not found.</div>
      ) : (
        <>
          {/* Header card */}
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <Users size={16} className="text-text-tertiary" />
                  {ib.user_name || ib.user_email}
                </h1>
                <p className="text-xs text-text-tertiary mt-0.5">{ib.user_email}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg-tertiary/40 border border-border-primary text-xxs">
                  <Hash size={11} className="text-text-tertiary" />
                  <span className="text-text-tertiary">Referral Code:</span>
                  <span className="text-buy font-mono font-semibold">{ib.referral_code}</span>
                </div>
              </div>
            </div>

            {/* Summary stat cards */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Earned" value={`$${fmtMoney(ib.total_earned)}`} icon={TrendingUp} color="text-success" />
              <StatCard label="Paid Commissions" value={`$${fmtMoney(paidTotal)}`} icon={Receipt} color="text-success" />
              <StatCard label="Pending Commissions" value={`$${fmtMoney(pendingTotal)}`} icon={Clock} color="text-warning" />
              <StatCard label="Commission Rows" value={data?.total.toString() || '0'} icon={Receipt} color="text-text-primary" />
            </div>

            {/* MLM level breakdown — only render levels that actually have payouts */}
            {Object.keys(levelBreakdown).length > 0 && (
              <div className="mt-4">
                <h3 className="text-xxs font-medium text-text-tertiary uppercase tracking-wide mb-2">Earnings by MLM Level (loaded rows)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {Object.entries(levelBreakdown).sort(([a], [b]) => +a - +b).map(([level, amt]) => (
                    <div key={level} className="px-3 py-2 rounded-md bg-bg-tertiary/40 border border-border-primary">
                      <div className="text-xxs text-text-tertiary">Level {level}</div>
                      <div className="text-xs font-mono text-success font-semibold mt-0.5">${fmtMoney(amt)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Commission history */}
          <div className="bg-bg-secondary border border-border-primary rounded-lg">
            <div className="px-5 py-3 border-b border-border-primary flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                <Receipt size={14} /> Commission History
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xxs text-text-tertiary">Status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="text-xs py-1 px-2 bg-accent/10 border border-accent/40 text-accent font-semibold rounded-md hover:bg-accent/15 focus:outline-none focus:border-accent transition-fast cursor-pointer"
                >
                  <option value="all">All</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                </select>
                <button
                  onClick={handleDownloadPdf}
                  disabled={pdfGenerating || rows.length === 0}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25 transition-fast disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Download full commission history as PDF (respects current status filter)"
                >
                  {pdfGenerating ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  {pdfGenerating ? 'Generating…' : 'Download PDF'}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-text-tertiary" />
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center text-xs text-text-tertiary py-12">
                {statusFilter !== 'all'
                  ? `No ${statusFilter} commissions for this IB.`
                  : 'No commissions yet for this IB.'}
                <p className="mt-1 text-xxs text-text-tertiary/70">
                  Earnings appear here as referred traders place trades.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="border-b border-border-primary bg-bg-tertiary/40">
                        {['Date', 'Source Trader', 'Type', 'MLM Level', 'Amount', 'Status', 'Trade ID'].map((col) => (
                          <th key={col} className={cn('text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide',
                            ['MLM Level', 'Amount'].includes(col) && 'text-right')}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c) => (
                        <tr key={c.id} className="border-b border-border-primary/40 hover:bg-bg-hover transition-fast">
                          <td className="px-4 py-2.5 text-xxs text-text-tertiary whitespace-nowrap">{fmtDateTime(c.created_at)}</td>
                          <td className="px-4 py-2.5 text-xs text-text-primary">
                            {c.source_user_name || '—'}
                            {c.source_user_email && (
                              <div className="text-xxs text-text-tertiary">{c.source_user_email}</div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xxs text-text-secondary font-mono">{c.commission_type}</td>
                          <td className="px-4 py-2.5 text-xs text-text-primary text-right font-mono tabular-nums">L{c.mlm_level}</td>
                          <td className="px-4 py-2.5 text-xs text-success text-right font-mono tabular-nums font-semibold">
                            +${fmtMoney(c.amount)}
                          </td>
                          <td className="px-4 py-2.5 text-xxs">
                            <span className={cn('inline-flex px-2 py-0.5 rounded font-semibold capitalize',
                              c.status === 'paid' ? 'bg-success/15 text-success' :
                              c.status === 'pending' ? 'bg-warning/15 text-warning' :
                              'bg-text-tertiary/15 text-text-tertiary')}>
                              {c.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xxs text-text-tertiary font-mono">
                            {c.source_trade_id ? `${c.source_trade_id.slice(0, 8)}…` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer */}
                {data && data.total > PAGE_SIZE && (
                  <Pagination
                    page={page}
                    totalPages={Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
                    totalItems={data.total}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                    loading={loading}
                  />
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Pagination({
  page, totalPages, totalItems, pageSize, onPageChange, loading,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  loading: boolean;
}) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  // Show up to 5 page numbers centered on the current page so a 50-page result
  // doesn't blow out the footer with buttons.
  const windowSize = 5;
  let from = Math.max(1, page - Math.floor(windowSize / 2));
  let to = Math.min(totalPages, from + windowSize - 1);
  from = Math.max(1, to - windowSize + 1);
  const pageNums: number[] = [];
  for (let i = from; i <= to; i++) pageNums.push(i);

  return (
    <div className="px-5 py-3 border-t border-border-primary flex items-center justify-between gap-2 flex-wrap">
      <div className="text-xxs text-text-tertiary">
        Showing <span className="text-text-secondary font-mono">{start}</span>–<span className="text-text-secondary font-mono">{end}</span> of <span className="text-text-secondary font-mono">{totalItems}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={loading || page <= 1}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xxs text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={12} /> Prev
        </button>
        {from > 1 && (
          <>
            <button onClick={() => onPageChange(1)} className="px-2 py-1 rounded-md text-xxs text-text-secondary border border-border-primary hover:bg-bg-hover">1</button>
            {from > 2 && <span className="text-xxs text-text-tertiary px-1">…</span>}
          </>
        )}
        {pageNums.map((n) => (
          <button
            key={n}
            onClick={() => onPageChange(n)}
            className={cn(
              'px-2.5 py-1 rounded-md text-xxs font-medium border transition-fast',
              n === page
                ? 'bg-accent/15 text-accent border-accent/40'
                : 'text-text-secondary border-border-primary hover:bg-bg-hover',
            )}
          >
            {n}
          </button>
        ))}
        {to < totalPages && (
          <>
            {to < totalPages - 1 && <span className="text-xxs text-text-tertiary px-1">…</span>}
            <button onClick={() => onPageChange(totalPages)} className="px-2 py-1 rounded-md text-xxs text-text-secondary border border-border-primary hover:bg-bg-hover">{totalPages}</button>
          </>
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={loading || page >= totalPages}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xxs text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, color,
}: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="bg-bg-tertiary/40 border border-border-primary rounded-md p-3">
      <div className="flex items-center gap-1.5 text-xxs text-text-tertiary">
        <Icon size={11} /> {label}
      </div>
      <div className={cn('mt-1 text-sm font-semibold font-mono tabular-nums', color)}>{value}</div>
    </div>
  );
}
