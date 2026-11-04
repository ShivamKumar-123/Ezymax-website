// A table as an Excel workbook (.xlsx), built here without a library: the format is a zip of a few XML parts,
// and a zip with no compression is a handful of headers and a CRC. Numbers stay numbers (sums and sorts work in
// Excel), everything else is text; the header row is bold on a tinted fill and frozen, columns are sized to their
// content, and an optional title and caption sit above the table the way they do on the PDF (table-pdf.ts).
//
// Unlike the PDF there is no font to run out of glyphs: any script goes in as it is.

type Cell = string | number | null | undefined;

export interface TableXlsxOptions {
  /** the sheet's name (31 characters at most, no []:*?/\) and the bold line above the table */
  title: string;
  /** one line under the title: what the table covers and when it was taken */
  subtitle?: string;
}

/* ---------- zip, stored ---------- */

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d: Date): [number, number] {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return [time, date];
}

/** The parts, in order, as one zip with every entry stored (method 0). */
function zip(parts: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const [time, date] = dosTime(new Date());
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const u16 = (v: number) => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
  for (const p of parts) {
    const name = enc.encode(p.name);
    const crc = crc32(p.data);
    const head = Uint8Array.from([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(time), ...u16(date),
      ...u32(crc), ...u32(p.data.length), ...u32(p.data.length), ...u16(name.length), ...u16(0),
    ]);
    const local = new Uint8Array(head.length + name.length + p.data.length);
    local.set(head, 0);
    local.set(name, head.length);
    local.set(p.data, head.length + name.length);
    locals.push(local);
    const central = Uint8Array.from([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(time), ...u16(date),
      ...u32(crc), ...u32(p.data.length), ...u32(p.data.length), ...u16(name.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name,
    ]);
    centrals.push(central);
    offset += local.length;
  }
  const cdSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(parts.length), ...u16(parts.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
  const out = new Uint8Array(offset + cdSize + end.length);
  let at = 0;
  for (const b of [...locals, ...centrals, end]) {
    out.set(b, at);
    at += b.length;
  }
  return out;
}

/* ---------- the workbook ---------- */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// characters XML 1.0 cannot carry at all (control characters other than tab, newline, return)
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

function col(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function cell(r: number, c: number, v: Cell, style: number): string {
  const ref = `${col(c)}${r}`;
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(clean(String(v)))}</t></is></c>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF6B6B74"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF1E8"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFF26A1B"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** The workbook's bytes. The table starts under the title and caption; the header row is frozen. */
export function buildTableXlsx(headers: string[], rows: Cell[][], opts: TableXlsxOptions): Uint8Array {
  const enc = new TextEncoder();
  const sheetName = opts.title.replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet1";
  const widths = headers.map((h, c) => Math.min(60, Math.max(h.length, ...rows.map((r) => String(r[c] ?? "").length)) + 2));
  const lines: string[] = [];
  let r = 1;
  lines.push(`<row r="${r}">${cell(r, 0, opts.title, 1)}</row>`);
  r++;
  if (opts.subtitle) {
    lines.push(`<row r="${r}">${cell(r, 0, opts.subtitle, 3)}</row>`);
    r++;
  }
  r++; // one empty row between the caption and the table
  const headRow = r;
  lines.push(`<row r="${r}">${headers.map((h, c) => cell(r, c, h, 2)).join("")}</row>`);
  for (const row of rows) {
    r++;
    lines.push(`<row r="${r}">${row.map((v, c) => cell(r, c, v, 0)).join("")}</row>`);
  }
  const last = `${col(Math.max(0, headers.length - 1))}${r}`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${last}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headRow}" topLeftCell="A${headRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>
<sheetData>${lines.join("")}</sheetData>
<autoFilter ref="A${headRow}:${last}"/>
</worksheet>`;
  const parts = [
    { name: "[Content_Types].xml", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`) },
    { name: "_rels/.rels", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: "xl/workbook.xml", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name: "xl/styles.xml", data: enc.encode(STYLES) },
    { name: "xl/worksheets/sheet1.xml", data: enc.encode(sheet) },
  ];
  return zip(parts);
}

/** Builds the workbook and hands it to the browser as `${name}.xlsx`. */
export function downloadTableXlsx(name: string, headers: string[], rows: Cell[][], opts: TableXlsxOptions): void {
  const bytes = buildTableXlsx(headers, rows, opts);
  const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
