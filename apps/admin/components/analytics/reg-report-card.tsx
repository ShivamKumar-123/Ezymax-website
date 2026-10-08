"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { CalendarDays, Check, ChevronDown, Download, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, Icon3D, Menu, Segmented, cn, formatDateTime, formatNumber } from "@ezymex/ui";
import type { AnlFormat, AnlRegReport } from "@ezymex/mock/admin-growth-analytics";

const PERIODS: Record<AnlRegReport["period"], string[]> = {
  daily: ["23 Sep 2026", "22 Sep 2026", "21 Sep 2026", "Last 7 days", "September 2026 (MTD)"],
  monthly: ["Aug 2026", "Jul 2026", "Jun 2026", "Q3 2026 (to date)"],
  quarterly: ["Q3 2026 (to date)", "Q2 2026", "Q1 2026", "FY 2025"],
  "on demand": ["Q3 2026 (to date)", "Last 30 days", "Last 90 days", "YTD 2026"],
};

export interface GeneratedExport {
  report: string;
  period: string;
  format: AnlFormat;
  rows: number;
}

/** One regulatory report: period + format pickers, Generate → progress → Download. */
export function RegReportCard({ report, onGenerated }: { report: AnlRegReport; onGenerated: (e: GeneratedExport) => void }) {
  const [period, setPeriod] = React.useState(PERIODS[report.period][0]!);
  const [format, setFormat] = React.useState<AnlFormat>(report.formats[0]!);
  const [state, setState] = React.useState<"idle" | "running" | "ready">("idle");
  const [progress, setProgress] = React.useState(0);
  const [last, setLast] = React.useState(report.lastGenerated);

  React.useEffect(() => {
    if (state !== "running") return;
    const id = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 7 + Math.round(Math.random() * 14));
        return next;
      });
    }, 180);
    return () => clearInterval(id);
  }, [state]);

  React.useEffect(() => {
    if (state === "running" && progress >= 100) {
      setState("ready");
      setLast(new Date().toISOString());
      onGenerated({ report: report.name, period, format, rows: report.rows });
      toast.success(`${report.name} ready`, { description: `${period} · ${format} · ${formatNumber(report.rows, 0)} rows · SHA-256 signed` });
    }
  }, [progress, state, report, period, format, onGenerated]);

  const start = () => {
    setProgress(0);
    setState("running");
    toast(`Generating ${report.name}`, { description: `${period} · ${format} — you can keep working, we'll notify you` });
  };

  const fileName = `${report.id}_${period.replace(/[^A-Za-z0-9]+/g, "-").replace(/-$/, "")}.${format.toLowerCase()}`;

  return (
    <div className={cn("k-card flex h-full flex-col overflow-hidden transition-[border-color] hover:border-[var(--k-border-top)]", report.critical && "border-down/25")}>
      <div className="flex items-start gap-4 px-5 pt-5">
        <Icon3D name={report.icon} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15.5px] font-medium tracking-tight">{report.name}</h3>
            {report.critical && <Chip size="sm" tone="down" dot>Confidential</Chip>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Chip size="sm" tone="gold">{report.regulator}</Chip>
            <Chip size="sm" className="capitalize">{report.period}</Chip>
          </div>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 min-h-[38px] px-5 text-[12.5px] leading-relaxed text-fg-3">{report.description}</p>

      <div className="mt-4 grid grid-cols-1 gap-2 px-5 sm:grid-cols-[1fr_auto]">
        <Menu
          align="start"
          width={240}
          trigger={
            <button type="button" className="flex h-9 min-w-0 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 text-[12.5px] text-fg transition-colors hover:bg-surface-3">
              <CalendarDays className="size-3.5 text-fg-3" />
              <span className="truncate">{period}</span>
              <ChevronDown className="ml-auto size-3.5 text-fg-3" />
            </button>
          }
          items={PERIODS[report.period].map((p) => ({ label: p, icon: p === period ? <Check /> : <span className="size-4" />, onSelect: () => { setPeriod(p); setState("idle"); } }))}
        />
        <Segmented size="xs" value={format} onChange={(f) => { setFormat(f); setState("idle"); }} options={report.formats} />
      </div>

      <div className="mt-4 flex-1 px-5">
        <div className="k-row flex items-center justify-between px-3.5 py-2.5 text-[11.5px]">
          <div>
            <div className="text-fg-3">Last generated</div>
            <div className="k-num mt-0.5 text-fg-2">{formatDateTime(last)} GMT+3</div>
          </div>
          <div className="text-right">
            <div className="text-fg-3">{report.due ? "Next due" : "Rows"}</div>
            <div className={cn("k-num mt-0.5", report.due ? "text-warn" : "text-fg-2")}>{report.due ? formatDateTime(report.due) : formatNumber(report.rows, 0)}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-line bg-black/15 px-5 py-3.5">
        <AnimatePresence mode="wait" initial={false}>
          {state === "running" ? (
            <motion.div key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-8 items-center gap-3">
              <Loader2 className="size-4 animate-spin text-ember" />
              <div className="flex-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-gradient-to-r from-ember to-gold transition-[width] duration-200" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <span className="k-num w-10 text-right text-[12px] text-fg-2">{progress}%</span>
            </motion.div>
          ) : state === "ready" ? (
            <motion.div key="ready" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-up-soft text-up"><Check className="size-3.5" /></span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-fg-2">{fileName}</span>
              <Button size="sm" variant="up-outline" onClick={() => toast.success("Download started", { description: fileName })}>
                <Download /> Download
              </Button>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] text-fg-3">
                ~{formatNumber(report.rows, 0)} rows · {format}
              </span>
              <Button size="sm" variant="ember" onClick={start}>
                <Play className="size-3.5" /> Generate
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
