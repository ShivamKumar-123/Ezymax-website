/**
 * Loads the SwissCresta logo for embedding into generated PDFs (jsPDF
 * addImage needs a data-URL + the natural size to keep the aspect ratio).
 * Returns null on any failure — statements must still generate without the
 * logo (offline tab, missing asset) rather than fail.
 */
export type PdfLogo = { dataUrl: string; w: number; h: number };

export async function loadPdfLogo(): Promise<PdfLogo | null> {
  try {
    const res = await fetch('/marketing/swisscresta-logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('read failed'));
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
      img.onerror = () => reject(new Error('decode failed'));
      img.src = dataUrl;
    });
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

/** Stamp the logo at the top-right of the current page, `hMm` tall. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stampPdfLogo(doc: any, logo: PdfLogo | null, margin: number, hMm = 9): void {
  if (!logo) return;
  try {
    const pageW = doc.internal.pageSize.getWidth();
    const w = (logo.w / logo.h) * hMm;
    doc.addImage(logo.dataUrl, 'PNG', pageW - margin - w, 12, w, hMm);
  } catch {
    /* never block statement generation on the logo */
  }
}
