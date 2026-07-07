/**
 * Client-side PDF statement export for the IB portal. Generic table exporter
 * built on jspdf + jspdf-autotable (dynamically imported so they never enter
 * the initial bundle). Mirrors the trader app's statement style with FXArtha
 * gold branding.
 */

export type PdfColumn = {
  header: string;
  /** cell value for a row */
  value: (row: any) => string;
  align?: 'left' | 'right' | 'center';
  width?: number;
};

export type StatementMeta = {
  title: string;
  subtitle?: string;
  /** optional footer totals row: array of {colSpanLabel, value} rendered right-aligned */
  totalsLabel?: string;
  totalsValue?: string;
  filename?: string;
};

const GOLD: [number, number, number] = [214, 169, 61];

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch {
    return iso;
  }
}

export async function downloadStatementPdf(
  rows: any[],
  columns: PdfColumn[],
  meta: StatementMeta,
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 16;

  // Brand bar
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, pageW, 10, 'F');
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('FXArtha — IB Partner Portal', margin, 7);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(16);
  doc.text(meta.title, margin, y);
  y += 8;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`Generated: ${formatWhen(new Date().toISOString())} (local time)`, margin, y);
  y += 5;
  doc.text(`Rows: ${rows.length}`, margin, y);
  y += 4;
  if (meta.subtitle) {
    doc.text(meta.subtitle, margin, y);
    y += 5;
  }
  y += 2;

  const columnStyles: Record<number, any> = {};
  columns.forEach((c, i) => {
    columnStyles[i] = {};
    if (c.align) columnStyles[i].halign = c.align;
    if (c.width) columnStyles[i].cellWidth = c.width;
  });

  const foot =
    meta.totalsValue != null
      ? [[
          { content: meta.totalsLabel || 'Total', colSpan: columns.length - 1, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: meta.totalsValue, styles: { fontStyle: 'bold', halign: 'right' } },
        ]]
      : undefined;

  autoTable(doc, {
    startY: y,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => c.value(r))),
    foot: foot as any,
    showFoot: foot ? 'lastPage' : 'never',
    theme: 'striped',
    headStyles: { fillColor: GOLD, textColor: 20, fontStyle: 'bold', fontSize: 8, cellPadding: 2 },
    bodyStyles: { fontSize: 7.5, cellPadding: 1.6, textColor: [40, 40, 40] },
    footStyles: { fillColor: [245, 245, 245], fontSize: 8, textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [252, 250, 244] },
    columnStyles,
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 140);
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageW - margin - 28, doc.internal.pageSize.getHeight() - 6);
      doc.text('FXArtha — for information only.', margin, doc.internal.pageSize.getHeight() - 6);
    },
  });

  const safeDate = new Date().toISOString().slice(0, 10);
  doc.save(meta.filename || `fxartha-ib-statement-${safeDate}.pdf`);
}
