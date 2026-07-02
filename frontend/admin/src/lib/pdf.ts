// Lightweight table-to-PDF export used by the per-user ledger tabs.
// Renders a branded header, a centered FXArtha logo watermark (from
// /public/logo.png), and the section's rows as a table.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Cache the pre-faded logo (canvas-composited to the target opacity) so we
// don't re-load + re-composite on every export. Keyed by opacity.
const fadedLogoCache = new Map<number, { dataUrl: string; ratio: number } | null>();

async function loadFadedLogo(alpha: number): Promise<{ dataUrl: string; ratio: number } | null> {
  if (fadedLogoCache.has(alpha)) return fadedLogoCache.get(alpha)!;
  let result: { dataUrl: string; ratio: number } | null = null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = '/logo.png';
    });
    const w = img.naturalWidth || 512;
    const h = img.naturalHeight || 512;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Pre-bake the transparency into the PNG so we don't depend on
      // jsPDF's GState (which some viewers/versions render inconsistently).
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, 0, 0, w, h);
      result = { dataUrl: canvas.toDataURL('image/png'), ratio: w / h };
    }
  } catch {
    result = null;
  }
  fadedLogoCache.set(alpha, result);
  return result;
}

export interface PdfExport {
  title: string;
  userName: string;
  userEmail?: string;
  columns: string[];
  rows: (string | number | null | undefined)[][];
  filename: string;
}

export async function exportTablePdf(meta: PdfExport): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ── Centered logo watermark (drawn first, behind everything) ──
  const logo = await loadFadedLogo(0.12);
  if (logo) {
    const w = 300;
    const h = w / (logo.ratio || 1);
    const cx = pageW / 2;
    const cy = pageH / 2 + 24;
    doc.addImage(logo.dataUrl, 'PNG', cx - w / 2, cy - h / 2, w, h, undefined, 'FAST');
  }

  // ── Header ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text('FXArtha', 40, 46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(70, 70, 70);
  doc.text(meta.title, 40, 68);
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`${meta.userName}${meta.userEmail ? '  ·  ' + meta.userEmail : ''}`, 40, 84);
  doc.text(`Generated ${new Date().toLocaleString()}`, pageW - 40, 46, { align: 'right' });
  doc.setDrawColor(214, 169, 61);
  doc.setLineWidth(1);
  doc.line(40, 92, pageW - 40, 92);

  // ── Table (grid theme → transparent body cells so the watermark shows
  //     through; gold header keeps the brand accent) ──
  autoTable(doc, {
    startY: 104,
    head: [meta.columns],
    body: meta.rows.map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c)))),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 4, textColor: [30, 30, 30], lineColor: [225, 220, 210], lineWidth: 0.5 },
    headStyles: { fillColor: [214, 169, 61], textColor: [20, 20, 20], fontStyle: 'bold' },
    margin: { left: 40, right: 40 },
  });

  doc.save(meta.filename);
}
