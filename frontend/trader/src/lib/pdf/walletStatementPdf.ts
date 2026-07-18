/**
 * Client-side wallet statement PDF (portrait A4).
 * Lists the trader's funding history — deposits, withdrawals and other
 * wallet transactions. Uses dynamic import so jspdf isn't in the main bundle.
 */

export type WalletStatementRow = {
  type?: string | null;
  method?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export type WalletStatementMeta = {
  accountName?: string;
  accountEmail?: string;
  currency?: string;
  totalDeposited?: number;
  totalWithdrawn?: number;
  currentBalance?: number;
};

function fmtAmount(n: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(Number.isFinite(n) ? n : 0);
  } catch {
    return (Number.isFinite(n) ? n : 0).toFixed(2);
  }
}

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch {
    return String(iso);
  }
}

function titleCase(s: string | null | undefined): string {
  if (!s) return '—';
  return String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function downloadWalletStatementPdf(
  rows: WalletStatementRow[],
  meta?: WalletStatementMeta,
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 16;

  doc.setFillColor(41, 98, 255);
  doc.rect(0, 0, pageW, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('SwissCresta', margin, 7);

  // Brand logo, top-right under the band (best-effort — never blocks export).
  const { loadPdfLogo, stampPdfLogo } = await import('./pdfLogo');
  stampPdfLogo(doc, await loadPdfLogo(), margin);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(16);
  doc.text('Wallet statement', margin, y);
  y += 8;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`Generated: ${fmtWhen(new Date().toISOString())} (local time)`, margin, y);
  y += 4;
  doc.text(`Transactions listed: ${rows.length}`, margin, y);
  y += 4;
  if (meta?.accountName || meta?.accountEmail) {
    doc.text(`Account: ${[meta?.accountName, meta?.accountEmail].filter(Boolean).join('  ·  ')}`, margin, y);
    y += 4;
  }

  const cur = meta?.currency || 'USD';
  doc.setTextColor(30, 30, 30);
  if (meta?.totalDeposited != null || meta?.totalWithdrawn != null || meta?.currentBalance != null) {
    const parts: string[] = [];
    if (meta?.currentBalance != null) parts.push(`Balance: ${fmtAmount(meta.currentBalance, cur)}`);
    if (meta?.totalDeposited != null) parts.push(`Total deposited: ${fmtAmount(meta.totalDeposited, cur)}`);
    if (meta?.totalWithdrawn != null) parts.push(`Total withdrawn: ${fmtAmount(meta.totalWithdrawn, cur)}`);
    doc.text(parts.join('  ·  '), margin, y);
    y += 5;
  }
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Type', 'Method', 'Amount', 'Status']],
    body: rows.map((r) => [
      fmtWhen(r.created_at),
      titleCase(r.type),
      titleCase(r.method),
      fmtAmount(Number(r.amount) || 0, r.currency || cur),
      titleCase(r.status),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [41, 98, 255], textColor: 255, fontStyle: 'bold', fontSize: 9, cellPadding: 2 },
    bodyStyles: { fontSize: 8, cellPadding: 1.8, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [252, 252, 252] },
    columnStyles: {
      0: { cellWidth: 42, font: 'courier' },
      1: { cellWidth: 30 },
      2: { cellWidth: 40 },
      3: { cellWidth: 36, halign: 'right', font: 'courier' },
      4: { cellWidth: 28 },
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 140);
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageW - margin - 24, pageH - 6);
      doc.text('SwissCresta — for information only. Not tax or legal advice.', margin, pageH - 6);
    },
  });

  doc.save(`swisscresta-wallet-statement-${new Date().toISOString().slice(0, 10)}.pdf`);
}
