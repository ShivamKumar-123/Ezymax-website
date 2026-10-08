"use client";

import * as React from "react";
import { cn } from "@ezymex/ui";

type Line = { kind: "same" | "add" | "del"; text: string; a?: number; b?: number };

function toLines(v: Record<string, unknown> | null): string[] {
  if (v === null) return [];
  return JSON.stringify(v, null, 2).split("\n");
}

/** Line-level LCS diff — small payloads only (audit snapshots). */
export function diffLines(before: string[], after: string[]): Line[] {
  const n = before.length;
  const m = after.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i]![j] = before[i] === after[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: Line[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && before[i] === after[j]) {
      out.push({ kind: "same", text: before[i]!, a: i + 1, b: j + 1 });
      i++;
      j++;
    } else if (j < m && (i >= n || dp[i]![j + 1]! >= dp[i + 1]![j]!)) {
      out.push({ kind: "add", text: after[j]!, b: j + 1 });
      j++;
    } else {
      out.push({ kind: "del", text: before[i]!, a: i + 1 });
      i++;
    }
  }
  // Show removed lines before added lines within each change hunk.
  const sorted: Line[] = [];
  let k = 0;
  while (k < out.length) {
    if (out[k]!.kind === "same") {
      sorted.push(out[k]!);
      k++;
      continue;
    }
    const hunk: Line[] = [];
    while (k < out.length && out[k]!.kind !== "same") hunk.push(out[k++]!);
    sorted.push(...hunk.filter((l) => l.kind === "del"), ...hunk.filter((l) => l.kind === "add"));
  }
  return sorted;
}

/** Colourise a JSON line: keys, strings, numbers, literals. */
function Syntax({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)|\b(true|false|null)\b/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] && m[2]) parts.push(<span key={i++} className="text-fg-2">{m[1]}</span>, m[2]);
    else if (m[1]) parts.push(<span key={i++} className="text-gold">{m[1]}</span>);
    else if (m[3]) parts.push(<span key={i++} className="text-info">{m[3]}</span>);
    else if (m[4]) parts.push(<span key={i++} className="text-ember">{m[4]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export function JsonDiff({ before, after, className }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null; className?: string }) {
  const lines = React.useMemo(() => diffLines(toLines(before), toLines(after)), [before, after]);
  const adds = lines.filter((l) => l.kind === "add").length;
  const dels = lines.filter((l) => l.kind === "del").length;
  return (
    <div className={cn("overflow-hidden rounded-[14px] border border-line bg-bg/60", className)}>
      <div className="flex items-center justify-between border-b border-line bg-surface-2/70 px-4 py-2 font-mono text-[11px] text-fg-3">
        <span>snapshot.json</span>
        <span className="flex items-center gap-3">
          <span className="text-down">−{dels}</span>
          <span className="text-up">+{adds}</span>
        </span>
      </div>
      <div className="overflow-x-auto py-1.5">
        <table className="w-full border-collapse font-mono text-[12px] leading-[20px]">
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className={cn(l.kind === "add" && "bg-up/[0.08]", l.kind === "del" && "bg-down/[0.08]")}>
                <td className="w-9 select-none pr-1 text-right text-fg-3/70">{l.a ?? ""}</td>
                <td className="w-9 select-none border-r border-line pr-2 text-right text-fg-3/70">{l.b ?? ""}</td>
                <td className={cn("w-6 select-none text-center", l.kind === "add" ? "text-up" : l.kind === "del" ? "text-down" : "text-fg-3/40")}>
                  {l.kind === "add" ? "+" : l.kind === "del" ? "−" : ""}
                </td>
                <td className={cn("whitespace-pre pr-4", l.kind === "same" ? "text-fg-3" : l.kind === "add" ? "text-up" : "text-down")}>
                  {l.kind === "same" ? <Syntax text={l.text} /> : l.text}
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-fg-3" colSpan={4}>
                  No snapshot recorded
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Keys whose value changed between snapshots. */
export function changedKeys(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys].filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
}
