"use client";

import * as React from "react";
import { CopyButton, cn } from "@/components/kit";

export type CodeLang = "json" | "bash" | "python" | "js" | "fix" | "text";

type Tok = { t: string; c?: "key" | "str" | "num" | "com" | "kw" | "pun" | "fn" | "flag" };

const KW: Record<CodeLang, Set<string>> = {
  js: new Set(["import", "from", "const", "let", "await", "async", "new", "return", "function", "if", "else", "for", "of", "true", "false", "null", "export", "default", "try", "catch"]),
  python: new Set(["import", "from", "as", "def", "return", "async", "await", "with", "for", "in", "if", "else", "True", "False", "None", "print", "while", "try", "except"]),
  bash: new Set(["curl", "export", "wscat", "pip", "npm", "openssl"]),
  json: new Set(["true", "false", "null"]),
  fix: new Set(),
  text: new Set(),
};

const RE = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(-?\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|(--?[A-Za-z][\w-]*)|([^\sA-Za-z0-9_$"'`])/g;

function tokenizeLine(line: string, lang: CodeLang): Tok[] {
  if (lang === "text") return [{ t: line }];
  if (lang === "fix") {
    const out: Tok[] = [];
    const parts = line.split(/(\|)/);
    for (const p of parts) {
      if (p === "|") out.push({ t: "|", c: "pun" });
      else if (/^\d+=/.test(p)) {
        const i = p.indexOf("=");
        out.push({ t: p.slice(0, i), c: "key" }, { t: "=", c: "pun" }, { t: p.slice(i + 1), c: /^[\d.]+$/.test(p.slice(i + 1)) ? "num" : "str" });
      } else out.push({ t: p, c: p.trim().startsWith("#") ? "com" : undefined });
    }
    return out;
  }
  // Split off trailing comment (outside strings; good enough for samples)
  let code = line;
  let comment = "";
  const cm = lang === "js" ? "//" : lang === "python" || lang === "bash" ? "#" : null;
  if (cm) {
    let inS: string | null = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (inS) {
        if (ch === "\\") i++;
        else if (ch === inS) inS = null;
      } else if (ch === '"' || ch === "'" || ch === "`") inS = ch;
      else if (line.startsWith(cm, i) && !(cm === "//" && line[i - 1] === ":")) {
        code = line.slice(0, i);
        comment = line.slice(i);
        break;
      }
    }
  }
  const toks: Tok[] = [];
  let m: RegExpExecArray | null;
  RE.lastIndex = 0;
  while ((m = RE.exec(code))) {
    const [all, str, num, word, ws, flag] = m;
    if (str) {
      const rest = code.slice(RE.lastIndex);
      toks.push({ t: all, c: /^\s*:/.test(rest) && lang !== "bash" ? "key" : "str" });
    } else if (num) toks.push({ t: all, c: "num" });
    else if (word) {
      const rest = code.slice(RE.lastIndex);
      if (KW[lang].has(word)) toks.push({ t: all, c: "kw" });
      else if (lang === "js" && /^\s*:(?!:)/.test(rest)) toks.push({ t: all, c: "key" });
      else if (/^\(/.test(rest)) toks.push({ t: all, c: "fn" });
      else toks.push({ t: all });
    } else if (ws) toks.push({ t: all });
    else if (flag && lang === "bash") toks.push({ t: all, c: "flag" });
    else toks.push({ t: all, c: "pun" });
  }
  if (comment) toks.push({ t: comment, c: "com" });
  return toks;
}

const CLS: Record<NonNullable<Tok["c"]>, string> = {
  key: "text-gold",
  str: "text-up",
  num: "text-fg-2",
  com: "text-fg-3 italic",
  kw: "text-gold/80 font-medium",
  pun: "text-fg-3",
  fn: "text-fg",
  flag: "text-fg-2",
};

export const LANG_LABEL: Record<CodeLang, string> = { json: "JSON", bash: "cURL", python: "Python", js: "JavaScript", fix: "FIX 4.4", text: "Text" };

export function CodeBlock({
  code,
  lang = "json",
  title,
  tabs,
  highlight,
  maxHeight,
  className,
  showLang = true,
  wrap = false,
}: {
  code: string;
  lang?: CodeLang;
  title?: React.ReactNode;
  tabs?: React.ReactNode;
  highlight?: number[];
  maxHeight?: number;
  className?: string;
  showLang?: boolean;
  wrap?: boolean;
}) {
  const lines = React.useMemo(() => code.replace(/\n$/, "").split("\n"), [code]);
  const tokens = React.useMemo(() => lines.map((l) => tokenizeLine(l, lang)), [lines, lang]);
  const gutter = String(lines.length).length;
  return (
    <div className={cn("dark min-w-0 overflow-hidden rounded-[16px] border border-line bg-bg text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]", className)}>
      <div className="flex min-h-11 items-center gap-3 border-b border-white/[0.06] bg-white/[0.02] px-3.5 py-1.5">
        <div className="flex shrink-0 gap-1.5">
          <span className="size-2.5 rounded-full bg-down/70" />
          <span className="size-2.5 rounded-full bg-warn/70" />
          <span className="size-2.5 rounded-full bg-up/70" />
        </div>
        <div className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-fg-3">{title}</div>
        {tabs}
        {showLang && !tabs && <span className="hidden rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-fg-3 sm:inline">{LANG_LABEL[lang]}</span>}
        <CopyButton value={code} label={`${LANG_LABEL[lang]} snippet`} className="size-7 rounded-lg" />
      </div>
      <div className="overflow-auto py-3 font-mono text-[12.5px] leading-[1.7]" style={{ maxHeight }}>
        <table className="w-full border-collapse">
          <tbody>
            {tokens.map((line, i) => (
              <tr key={i} className={cn(highlight?.includes(i + 1) && "bg-ember/[0.08]")}>
                <td
                  className={cn(
                    "sticky left-0 select-none border-r border-white/[0.05] bg-bg pl-3.5 pr-3 text-right align-top text-fg-3/70",
                    highlight?.includes(i + 1) && "text-ember",
                  )}
                  style={{ minWidth: `${gutter + 2.4}ch` }}
                >
                  {i + 1}
                </td>
                <td className={cn("pl-4 pr-6", wrap ? "whitespace-pre-wrap break-all" : "whitespace-pre")}>
                  {line.length === 0 ? " " : line.map((t, j) => (t.c ? <span key={j} className={CLS[t.c]}>{t.t}</span> : <React.Fragment key={j}>{t.t}</React.Fragment>))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Pretty-print a JS value as JSON for use in a CodeBlock. */
export function toJson(v: unknown) {
  return JSON.stringify(v, null, 2);
}
