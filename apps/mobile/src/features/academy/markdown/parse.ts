// The Academy's markdown subset (services/academy/src/content.rs lints every chapter against it), parsed to
// plain data the native renderer draws. Block rules are the Client Area's (apps/crm/components/academy/live/
// markdown.tsx) so a chapter reads the same on the web and on the phone:
//   ## / ### headings · paragraphs · - / * and 1. lists (indented continuation lines) · > callouts
//   | tables | · ```text blocks · ```svg diagrams · --- rules
// Inline: `code`, **bold**, *italic*, [text](/internal). External links never become links (the lint forbids them).
// No HTML is ever interpreted: text stays text and svg is drawn by react-native-svg (never a WebView).

export type Block =
  | { t: "h"; level: 2 | 3; text: string; id: string }
  | { t: "p"; text: string }
  | { t: "ul" | "ol"; items: string[]; start: number }
  | { t: "quote"; text: string }
  | { t: "code"; lang: string; text: string }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "hr" };

export type Heading = { id: string; text: string; level: 2 | 3; index: number };

export const slugId = (s: string) =>
  "h-" +
  s
    .toLowerCase()
    .replace(/[*`_]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

const isSpecial = (l: string) =>
  /^(#{2,3}) /.test(l) || /^```/.test(l.trim()) || /^>/.test(l) || /^\s*[-*] /.test(l) || /^\s*\d+[.)] /.test(l) || /^\|/.test(l.trim()) || /^-{3,}\s*$/.test(l.trim());

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  const ids = new Map<string, number>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const tr = line.trim();
    if (!tr) {
      i++;
      continue;
    }
    if (tr.startsWith("```")) {
      const lang = tr.slice(3).trim().toLowerCase();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) buf.push(lines[i++]!);
      i++;
      out.push({ t: "code", lang, text: buf.join("\n") });
      continue;
    }
    const h = /^(#{2,3}) (.*)$/.exec(line);
    if (h) {
      const text = h[2]!.trim();
      let id = slugId(text);
      const n = ids.get(id) ?? 0;
      ids.set(id, n + 1);
      if (n) id = `${id}-${n + 1}`;
      out.push({ t: "h", level: h[1]!.length as 2 | 3, text, id });
      i++;
      continue;
    }
    if (/^-{3,}\s*$/.test(tr)) {
      out.push({ t: "hr" });
      i++;
      continue;
    }
    if (tr.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith(">")) buf.push(lines[i++]!.trim().replace(/^>\s?/, ""));
      out.push({ t: "quote", text: buf.join(" ").trim() });
      continue;
    }
    if (tr.startsWith("|") && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1]!.trim())) {
      const head = cells(tr);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) rows.push(cells(lines[i++]!));
      out.push({ t: "table", head, rows });
      continue;
    }
    const ul = /^\s*[-*] (.*)$/.exec(line);
    const ol = /^\s*(\d+)[.)] (.*)$/.exec(line);
    if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      const re = ul ? /^\s*[-*] (.*)$/ : /^\s*\d+[.)] (.*)$/;
      const items: string[] = [];
      while (i < lines.length) {
        const m = re.exec(lines[i]!);
        if (m) {
          items.push(m[1]!);
          i++;
        } else if (lines[i]!.trim() && /^\s{2,}\S/.test(lines[i]!) && items.length) {
          items[items.length - 1] += " " + lines[i]!.trim(); // continuation line
          i++;
        } else break;
      }
      out.push({ t: kind, items, start: ol ? Number(ol[1]) : 1 });
      continue;
    }
    const buf: string[] = [tr];
    i++;
    while (i < lines.length && lines[i]!.trim() && !isSpecial(lines[i]!)) buf.push(lines[i++]!.trim());
    out.push({ t: "p", text: buf.join(" ") });
  }
  return out;
}

/** The chapter's headings with the index of their block (for "On this page" and scrolling to a section). */
export function headingsOf(blocks: Block[]): Heading[] {
  const out: Heading[] = [];
  blocks.forEach((b, index) => {
    if (b.t === "h") out.push({ id: b.id, text: b.text.replace(/[*`]/g, ""), level: b.level, index });
  });
  return out;
}

export type InlineNode =
  | { t: "text"; text: string }
  | { t: "code"; text: string }
  | { t: "bold"; children: InlineNode[] }
  | { t: "italic"; text: string }
  | { t: "link"; text: string; href: string | null };

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))/g;

/** Inline markdown: `code`, **bold** (may hold inline code / links), *italic*, [text](/internal). */
export function parseInline(text: string): InlineNode[] {
  const out: InlineNode[] = [];
  const re = new RegExp(INLINE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: "text", text: text.slice(last, m.index) });
    const s = m[0];
    if (m[1]) out.push({ t: "code", text: s.slice(1, -1) });
    else if (m[2]) out.push({ t: "bold", children: parseInline(s.slice(2, -2)) });
    else if (m[3]) out.push({ t: "italic", text: s.slice(1, -1) });
    else {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(s)!;
      const href = lm[2]!;
      out.push({ t: "link", text: lm[1]!, href: href.startsWith("/") && !href.startsWith("//") ? href : null });
    }
    last = m.index + s.length;
  }
  if (last < text.length) out.push({ t: "text", text: text.slice(last) });
  return out;
}

/** The text a reader sees (markers removed): accessibility labels and tests. */
export function plainText(nodes: InlineNode[]): string {
  return nodes.map((n) => (n.t === "bold" ? plainText(n.children) : n.text)).join("");
}

/** Callout kinds the content uses: `> **Risk warning:** …`. Unknown labels keep their own text. */
export type CalloutKind = "riskWarning" | "warning" | "example" | "tip" | "note" | "inKalksTrader";
const CALLOUTS: Record<string, CalloutKind> = {
  "risk warning": "riskWarning",
  warning: "warning",
  example: "example",
  tip: "tip",
  note: "note",
  "in kalks trader": "inKalksTrader",
};

export function parseCallout(text: string): { kind: CalloutKind | null; label: string; body: string } | null {
  const m = /^\*\*([^*:]+):?\*\*:?\s*(.*)$/.exec(text);
  if (!m) return null;
  const label = m[1]!.trim();
  return { kind: CALLOUTS[label.toLowerCase()] ?? null, label, body: m[2]! };
}

/** Width / height of an svg diagram from its viewBox (else width / height), for a box that never shifts. */
export function svgAspect(svg: string): number {
  const vb = /viewBox\s*=\s*"([^"]+)"/i.exec(svg)?.[1]?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb[2]! > 0 && vb[3]! > 0) return vb[2]! / vb[3]!;
  const w = Number(/\swidth\s*=\s*"([\d.]+)"/i.exec(svg)?.[1]);
  const h = Number(/\sheight\s*=\s*"([\d.]+)"/i.exec(svg)?.[1]);
  return w > 0 && h > 0 ? w / h : 16 / 9;
}

/** A diagram's name for screen readers: its first text label (like the web's alt text). */
export function svgTitle(svg: string): string | null {
  return /<text[^>]*>([^<]{4,80})<\/text>/.exec(svg)?.[1]?.trim() ?? null;
}

/**
 * Table column widths for a phone. Each column's ideal width follows its longest cell; when the ideals fit the
 * available width the table fills it (cells wrap), otherwise it keeps the ideals and scrolls sideways.
 */
export function tableLayout(head: string[], rows: string[][], available: number, charW = 7.1): { widths: number[]; scroll: boolean } {
  const n = Math.max(head.length, ...rows.map((r) => r.length));
  const longest = Array.from({ length: n }, (_, c) => Math.max(head[c]?.length ?? 0, ...rows.map((r) => plainText(parseInline(r[c] ?? "")).length)));
  // ideal: one line up to ~28 characters, then wrap onto a column no wider than ~34 characters
  const ideal = longest.map((len) => Math.round(Math.min(Math.max(len, 6), 34) * charW + 24));
  const sum = ideal.reduce((a, b) => a + b, 0);
  if (sum <= available) return { widths: ideal.map((w) => (w / sum) * available), scroll: false };
  // too wide: squeeze long columns towards ~20 characters before scrolling
  const squeezed = longest.map((len) => Math.round(Math.min(Math.max(len, 6), 20) * charW + 24));
  const s2 = squeezed.reduce((a, b) => a + b, 0);
  if (s2 <= available) {
    const extra = available - s2;
    const room = ideal.map((w, i) => w - squeezed[i]!);
    const roomSum = room.reduce((a, b) => a + b, 0) || 1;
    return { widths: squeezed.map((w, i) => w + (extra * room[i]!) / roomSum), scroll: false };
  }
  return { widths: squeezed.map((w, i) => Math.max(w, i === 0 ? 112 : 128)), scroll: true };
}
