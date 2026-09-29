"use client";

// Renders the Academy's markdown subset (see services/academy/src/content.rs) to React elements — no HTML
// injection: headings, paragraphs, bold / italic / code / internal links, lists, tables, callouts, ```text
// blocks and ```svg diagrams (shown as <img> data URIs, so a diagram can never run script).

import * as React from "react";
import { cn } from "@kalks/ui";
import type { MessageKey } from "@kalks/i18n";
import { useT } from "@kalks/i18n/react";

export type Heading = { id: string; text: string; level: 2 | 3 };

type Block =
  | { t: "h"; level: 2 | 3; text: string; id: string }
  | { t: "p"; text: string }
  | { t: "ul" | "ol"; items: string[]; start: number }
  | { t: "quote"; text: string }
  | { t: "code"; lang: string; text: string }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "hr" };

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

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  const ids = new Map<string, number>();
  let i = 0;
  const isSpecial = (l: string) => /^(#{2,3}) /.test(l) || /^```/.test(l.trim()) || /^>/.test(l) || /^\s*[-*] /.test(l) || /^\s*\d+[.)] /.test(l) || /^\|/.test(l.trim()) || /^-{3,}\s*$/.test(l.trim());
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

export function headingsOf(src: string): Heading[] {
  return parseBlocks(src).flatMap((b) => (b.t === "h" ? [{ id: b.id, text: b.text.replace(/[*`]/g, ""), level: b.level }] : []));
}

/** Inline markdown: `code`, **bold**, *italic*, [text](/internal). */
export function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const s = m[0];
    if (m[1]) parts.push(<code key={k++} className="rounded-[6px] border border-line bg-surface-2 px-1.5 py-px font-mono text-[0.88em] text-fg">{s.slice(1, -1)}</code>);
    else if (m[2]) parts.push(<strong key={k++} className="font-semibold text-fg"><Inline text={s.slice(2, -2)} /></strong>);
    else if (m[3]) parts.push(<em key={k++}>{s.slice(1, -1)}</em>);
    else {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(s)!;
      const href = lm[2]!;
      parts.push(
        href.startsWith("/") && !href.startsWith("//") ? (
          <a key={k++} href={href} className="text-ember underline decoration-ember/40 underline-offset-2 hover:decoration-ember">
            {lm[1]}
          </a>
        ) : (
          <span key={k++}>{lm[1]}</span>
        ),
      );
    }
    last = m.index + s.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// label = translation key of the chrome label shown above the callout
const CALLOUT: Record<string, { cls: string; label: MessageKey }> = {
  "risk warning": { cls: "border-down/30 bg-down-soft [&_.lbl]:text-down", label: "academy.callout.riskWarning" },
  warning: { cls: "border-down/30 bg-down-soft [&_.lbl]:text-down", label: "academy.callout.warning" },
  example: { cls: "border-info/25 bg-info-soft [&_.lbl]:text-info", label: "academy.callout.example" },
  tip: { cls: "border-up/25 bg-up-soft [&_.lbl]:text-up", label: "academy.callout.tip" },
  note: { cls: "border-line bg-surface-2 [&_.lbl]:text-fg-2", label: "academy.callout.note" },
  "in kalks trader": { cls: "border-ember/30 bg-ember-soft [&_.lbl]:text-ember", label: "academy.callout.inKalksTrader" },
};

function Callout({ text }: { text: string }) {
  const t = useT();
  const m = /^\*\*([^*:]+):?\*\*:?\s*(.*)$/.exec(text);
  const key = m?.[1]?.trim().toLowerCase() ?? "";
  const known = CALLOUT[key];
  const kind = known ? { cls: known.cls, label: t(known.label) } : m ? { cls: "border-line bg-surface-2 [&_.lbl]:text-fg-2", label: m[1]!.trim() } : null;
  if (!kind || !m) {
    return (
      <blockquote className="my-5 border-s-2 border-line ps-4 text-fg-2">
        <Inline text={text} />
      </blockquote>
    );
  }
  return (
    <aside className={cn("my-5 rounded-[14px] border px-4 py-3.5 text-[14.5px] leading-relaxed text-fg-2", kind.cls)} role="note">
      <div className="lbl mb-1 text-[11px] font-semibold uppercase tracking-[0.08em]">{kind.label}</div>
      <Inline text={m[2]!} />
    </aside>
  );
}

function Diagram({ svg }: { svg: string }) {
  const t = useT();
  const src = React.useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`, [svg]);
  const title = /<text[^>]*>([^<]{4,80})<\/text>/.exec(svg)?.[1] ?? t("academy.diagram");
  return (
    <figure className="my-6 overflow-hidden rounded-[16px] border border-line bg-[#121216]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={title} className="block h-auto w-full" loading="lazy" />
    </figure>
  );
}

export function Markdown({ src, className }: { src: string; className?: string }) {
  const blocks = React.useMemo(() => parseBlocks(src), [src]);
  return (
    <div className={cn("k-md text-[15.5px] leading-[1.75] text-fg-2", className)}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h":
            return b.level === 2 ? (
              <h2 key={i} id={b.id} className="mb-3 mt-10 scroll-mt-24 text-[21px] font-medium leading-snug tracking-tight text-fg first:mt-0">
                <Inline text={b.text} />
              </h2>
            ) : (
              <h3 key={i} id={b.id} className="mb-2 mt-7 scroll-mt-24 text-[17px] font-medium tracking-tight text-fg">
                <Inline text={b.text} />
              </h3>
            );
          case "p":
            return (
              <p key={i} className="my-4">
                <Inline text={b.text} />
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="my-4 space-y-2 ps-1">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="mt-[11px] size-1.5 shrink-0 rounded-full bg-ember/80" />
                    <span className="min-w-0">
                      <Inline text={it} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="my-4 space-y-2 ps-1">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="k-num mt-[3px] grid size-6 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-[11.5px] font-medium text-fg-2">{b.start + j}</span>
                    <span className="min-w-0">
                      <Inline text={it} />
                    </span>
                  </li>
                ))}
              </ol>
            );
          case "quote":
            return <Callout key={i} text={b.text} />;
          case "code":
            if (b.lang === "svg") return <Diagram key={i} svg={b.text} />;
            return (
              <pre key={i} className="my-5 overflow-x-auto rounded-[14px] border border-line bg-surface-2 px-4 py-3.5 font-mono text-[13px] leading-relaxed text-fg">
                {b.text}
              </pre>
            );
          case "table":
            return (
              <div key={i} className="my-5 overflow-x-auto rounded-[14px] border border-line">
                <table className="w-full min-w-[420px] border-collapse text-[13.5px]">
                  <thead>
                    <tr className="bg-surface-2">
                      {b.head.map((c, j) => (
                        <th key={j} className="border-b border-line px-3.5 py-2.5 text-start text-[12px] font-medium uppercase tracking-wider text-fg-3">
                          <Inline text={c} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-b border-line last:border-0">
                        {r.map((c, x) => (
                          <td key={x} className={cn("k-num px-3.5 py-2.5 align-top", x === 0 ? "text-fg" : "text-fg-2")}>
                            <Inline text={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "hr":
            return <hr key={i} className="my-8 border-line" />;
        }
      })}
    </div>
  );
}
