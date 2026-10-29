// A table as a PDF, written by hand in the browser.
//
// The same tables already download as CSV from the page that is showing them, built from rows the browser is
// holding. A PDF of the same rows should not need a round trip, a new endpoint, or a 400 KB library: PDF's base
// fourteen fonts need no embedding, so a landscape A4 table is a few hundred lines of layout and an xref table.
// Mirrors services/reports/src/pdf.rs, which prints the branded statement server side - same page size, same
// Helvetica, same WinAnsi limits - so a statement and an export look like they came from one platform.
//
// WinAnsi covers Latin-1: English, Spanish, French, German, Portuguese, Italian, Turkish in part. It does not
// cover Cyrillic, Arabic, Indic, Thai or CJK, and a hand-rolled writer cannot embed a font that would. Rather
// than print a page of question marks and let someone mail it to a client, `dropped` counts what could not be
// represented and the footer says so, pointing at the CSV, which has no such limit.

const A4_LONG = 841.89;
const A4_SHORT = 595.28;
const MARGIN = 32;

/** Helvetica / Helvetica-Bold advance widths (1/1000 em) for 0x20..=0x7E, from the Adobe AFM files. */
const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
  260, 334, 584,
];
const HELV_B = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389,
  280, 389, 584,
];

/** The WinAnsi codes that are not simply the code point (the 0x80..0x9F block). */
const WIN_ANSI_HIGH: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

/** Counts characters the font cannot represent, so the page can admit it rather than printing "?" in silence. */
class Encoder {
  dropped = 0;

  /** `s` as WinAnsi bytes, one char per byte, ready to go straight into the file. */
  encode(s: string): string {
    let out = "";
    for (const ch of s) {
      const c = ch.codePointAt(0)!;
      if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff)) {
        out += String.fromCharCode(c);
      } else if (WIN_ANSI_HIGH[c] !== undefined) {
        out += String.fromCharCode(WIN_ANSI_HIGH[c]!);
      } else if (c === 0x09) {
        out += " ";
      } else if (c >= 0x20) {
        // a script this font has no glyphs for; the CSV beside this button still has the real text
        out += "?";
        this.dropped++;
      }
    }
    return out;
  }
}

function widthOf(s: string, bold: boolean, size: number): number {
  const table = bold ? HELV_B : HELV;
  let w = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    // everything outside the measured range is close enough to a lowercase letter for column fitting
    w += c >= 0x20 && c <= 0x7e ? table[c - 0x20]! : 556;
  }
  return (w * size) / 1000;
}

/** `s` cut to `max` points, with an ellipsis when something was cut. */
function fit(s: string, bold: boolean, size: number, max: number): string {
  if (widthOf(s, bold, size) <= max) return s;
  const dots = widthOf("…", bold, size);
  let out = "";
  for (const ch of s) {
    if (widthOf(out + ch, bold, size) + dots > max) break;
    out += ch;
  }
  return `${out.trimEnd()}…`;
}

/** PDF string literal: the three characters that end or escape one. */
function lit(s: string): string {
  return s.replace(/([\\()])/g, "\\$1");
}

function num(x: number): string {
  return (Math.round(x * 100) / 100).toString();
}

export interface TablePdfOptions {
  /** Shown large at the top of the first page. */
  title: string;
  /** A line under the title: the filter, the period, the account. */
  subtitle?: string;
  /** Portrait suits a narrow table; the default is landscape, because most of these are not narrow. */
  portrait?: boolean;
  /** Printed small at the bottom left of every page, before the page number. */
  footer?: string;
}

interface Built {
  bytes: Uint8Array<ArrayBuffer>;
  dropped: number;
}

/**
 * Lays the table out over as many pages as it takes and returns the finished file.
 *
 * Column widths come from the content: each column asks for what its widest cell needs, and when the row is wider
 * than the page every column is scaled down by the same factor and its cells are cut with an ellipsis. A column of
 * timestamps therefore keeps its width while a column of free text gives way, which is the opposite of what equal
 * columns would do.
 */
export function buildTablePdf(headers: string[], rows: (string | number | null | undefined)[][], opts: TablePdfOptions): Built {
  const enc = new Encoder();
  const pageW = opts.portrait ? A4_SHORT : A4_LONG;
  const pageH = opts.portrait ? A4_LONG : A4_SHORT;
  const inner = pageW - MARGIN * 2;

  const HEAD_SIZE = 7.5;
  const CELL_SIZE = 8;
  const ROW_H = 15;

  const head = headers.map((h) => enc.encode(String(h)));
  const body = rows.map((r) => headers.map((_, i) => enc.encode(r[i] === null || r[i] === undefined ? "" : String(r[i]))));

  // what each column would like, then everyone shrinks together if that does not fit
  const want = head.map((h, i) => {
    let w = widthOf(h, true, HEAD_SIZE);
    for (const r of body) w = Math.max(w, widthOf(r[i]!, false, CELL_SIZE));
    return Math.min(w + 10, inner * 0.4);
  });
  const total = want.reduce((a, b) => a + b, 0);
  const cols = total <= inner ? want : want.map((w) => (w * inner) / total);

  const firstTop = MARGIN + 46;
  const laterTop = MARGIN + 18;
  const bottom = pageH - MARGIN - 16;
  const perFirst = Math.max(1, Math.floor((bottom - firstTop - ROW_H) / ROW_H));
  const perLater = Math.max(1, Math.floor((bottom - laterTop - ROW_H) / ROW_H));

  const pages: (typeof body)[] = [];
  let i = 0;
  while (i < body.length || pages.length === 0) {
    const take = pages.length === 0 ? perFirst : perLater;
    pages.push(body.slice(i, i + take));
    i += take;
  }

  const title = enc.encode(opts.title);
  const subtitle = opts.subtitle ? enc.encode(opts.subtitle) : "";
  const footer = opts.footer ? enc.encode(opts.footer) : "";
  const note = enc.dropped > 0 ? enc.encode("Some characters are outside this format's font and show as “?” — the CSV export has the full text.") : "";

  const streams = pages.map((rowsOnPage, p) => {
    const out: string[] = [];
    const text = (s: string, x: number, y: number, size: number, bold: boolean, grey?: number) => {
      if (!s) return;
      out.push(`BT /${bold ? "FB" : "FR"} ${num(size)} Tf ${grey === undefined ? "0 g" : `${num(grey)} g`} 1 0 0 1 ${num(x)} ${num(pageH - y)} Tm (${lit(s)}) Tj ET`);
    };
    const line = (x1: number, y: number, x2: number, grey: number) => {
      out.push(`${num(grey)} G 0.5 w ${num(x1)} ${num(pageH - y)} m ${num(x2)} ${num(pageH - y)} l S`);
    };

    let y = p === 0 ? MARGIN + 14 : MARGIN + 8;
    if (p === 0) {
      text(title, MARGIN, y, 15, true);
      y += subtitle ? 15 : 10;
      if (subtitle) {
        text(subtitle, MARGIN, y, 8.5, false, 0.42);
        y += 12;
      }
    } else {
      text(title, MARGIN, y, 8.5, false, 0.42);
      y += 10;
    }

    // header row
    const headY = y + 9;
    let x = MARGIN;
    head.forEach((h, c) => {
      text(fit(h, true, HEAD_SIZE, cols[c]! - 6), x, headY, HEAD_SIZE, true, 0.3);
      x += cols[c]!;
    });
    line(MARGIN, headY + 4, pageW - MARGIN, 0.55);

    let rowY = headY + ROW_H;
    for (const r of rowsOnPage) {
      x = MARGIN;
      r.forEach((cell, c) => {
        text(fit(cell, false, CELL_SIZE, cols[c]! - 6), x, rowY, CELL_SIZE, false, 0.1);
        x += cols[c]!;
      });
      line(MARGIN, rowY + 4.5, pageW - MARGIN, 0.88);
      rowY += ROW_H;
    }

    const footY = pageH - MARGIN + 2;
    const left = [footer, note].filter(Boolean).join("   ");
    text(fit(left, false, 7, inner - 90), MARGIN, footY, 7, false, 0.5);
    const pn = enc.encode(`Page ${p + 1} of ${pages.length}`);
    text(pn, pageW - MARGIN - widthOf(pn, false, 7), footY, 7, false, 0.5);

    return out.join("\n");
  });

  // ---- file ----
  const objs: string[] = [];
  const add = (body: string) => {
    objs.push(body);
    return objs.length; // 1-based object number
  };

  const catalog = add(""); // 1, filled in once Pages has a number
  const pagesObj = add("");
  const fr = add(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
  const fb = add(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);

  const pageIds: number[] = [];
  for (const s of streams) {
    const content = add(`<< /Length ${s.length} >>\nstream\n${s}\nendstream`);
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${num(pageW)} ${num(pageH)}] ` +
          `/Resources << /Font << /FR ${fr} 0 R /FB ${fb} 0 R >> >> /Contents ${content} 0 R >>`,
      ),
    );
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${pageIds.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let file = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, n) => {
    offsets.push(file.length);
    file += `${n + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = file.length;
  file += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) file += `${String(o).padStart(10, "0")} 00000 n \n`;
  file += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  // every char in `file` is one byte: WinAnsi text, ASCII structure. Built over its own ArrayBuffer so the view is
  // Uint8Array<ArrayBuffer>, which is what Blob and Response take.
  const bytes = new Uint8Array(new ArrayBuffer(file.length));
  for (let n = 0; n < file.length; n++) bytes[n] = file.charCodeAt(n) & 0xff;
  return { bytes, dropped: enc.dropped };
}

/**
 * Builds the PDF and hands it to the browser, the way downloadCsv hands over a CSV. Returns how many characters
 * the font could not represent, so the caller's toast can say so.
 */
export function downloadTablePdf(name: string, headers: string[], rows: (string | number | null | undefined)[][], opts: TablePdfOptions): { dropped: number } {
  const { bytes, dropped } = buildTablePdf(headers, rows, opts);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { dropped };
}
