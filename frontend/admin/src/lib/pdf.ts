/**
 * Shared client-side PDF report builder for the admin panel.
 * Ezymex-branded header + jspdf-autotable body + page footer.
 * jspdf is dynamically imported so it isn't in the initial bundle.
 */

export type PdfColumn = {
  header: string;
  /** Fixed column width in mm (optional — autotable auto-sizes otherwise). */
  width?: number;
  align?: 'left' | 'right' | 'center';
  /** Use a monospace font for numeric/code columns. */
  mono?: boolean;
};

export type ReportPdfOptions = {
  title: string;
  /** Extra context lines shown under the title (e.g. filters, account). */
  subtitleLines?: string[];
  columns: PdfColumn[];
  rows: (string | number)[][];
  /** Optional totals row rendered in the table foot. */
  totalsRow?: (string | number)[];
  filename: string;
  orientation?: 'portrait' | 'landscape';
};

export function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch {
    return String(iso);
  }
}

export async function downloadReportPdf(opts: ReportPdfOptions): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const orientation = opts.orientation ?? 'landscape';
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 16;

  // Brand bar
  doc.setFillColor(11, 47, 82);
  doc.rect(0, 0, pageW, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Ezymex', margin, 7);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Admin report', pageW - margin, 7, { align: 'right' });

  // Title
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(opts.title, margin, y);
  y += 7;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  doc.text(`Generated: ${fmtWhen(new Date().toISOString())} (local time)`, margin, y);
  y += 4;
  doc.text(`Rows: ${opts.rows.length}`, margin, y);
  y += 4;
  for (const line of opts.subtitleLines ?? []) {
    doc.text(line, margin, y);
    y += 4;
  }
  y += 2;

  const columnStyles: Record<number, any> = {};
  opts.columns.forEach((c, i) => {
    const s: any = {};
    if (c.width) s.cellWidth = c.width;
    if (c.align) s.halign = c.align;
    if (c.mono) s.font = 'courier';
    if (Object.keys(s).length) columnStyles[i] = s;
  });

  autoTable(doc, {
    startY: y,
    head: [opts.columns.map((c) => c.header)],
    body: opts.rows.map((r) => r.map((v) => (v == null ? '' : String(v)))),
    foot: opts.totalsRow ? [opts.totalsRow.map((v) => (v == null ? '' : String(v)))] : undefined,
    showFoot: opts.totalsRow ? 'lastPage' : 'never',
    theme: 'striped',
    headStyles: { fillColor: [11, 47, 82], textColor: 255, fontStyle: 'bold', fontSize: 8, cellPadding: 2 },
    bodyStyles: { fontSize: 7, cellPadding: 1.5, textColor: [40, 40, 40] },
    footStyles: { fillColor: [245, 245, 245], fontSize: 8, fontStyle: 'bold', textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [252, 252, 252] },
    columnStyles,
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 140);
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageW - margin - 24, pageH - 6);
      doc.text('Ezymex — internal report. Confidential.', margin, pageH - 6);
    },
  });

  doc.save(opts.filename);
}
