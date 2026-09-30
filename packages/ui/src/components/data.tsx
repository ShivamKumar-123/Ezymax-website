"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, Check, Copy, ChevronLeft, ChevronRight, ArrowUpDown, Search, Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/cn";
import { Chip, type ChipTone, IconButton, Button } from "./primitives";
import { Icon3D } from "./avatars";
import { Illustration, type IllustrationName } from "./illustration";
import { SpotlightCard } from "../effects/effects";

/* ------------------------------------------------------------------ */
/* KPI card — Signal-AI reference                                      */
/* ------------------------------------------------------------------ */

export function KpiCard({
  label,
  value,
  icon,
  chip,
  chipTone = "neutral",
  href,
  illustration,
  hot,
  footer,
  className,
  delay = 0,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  chip?: React.ReactNode;
  chipTone?: ChipTone;
  href?: string;
  illustration?: string;
  hot?: boolean;
  footer?: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }} className={cn("min-w-0", className)}>
      <SpotlightCard hot={hot} className="flex h-full flex-col">
        <div className="relative flex flex-1 flex-col px-6 pb-5 pt-6">
          <div className="flex items-start justify-between">
            <span className="k-label">{label}</span>
            {icon && <span className="grid size-10 place-items-center rounded-full border border-line bg-surface-2/80 text-fg-2 shadow-[inset_0_1px_0_var(--k-border-top)] [&_svg]:size-[17px]">{icon}</span>}
          </div>
          <div className="mt-5 text-[30px] font-semibold leading-none tracking-[-0.02em] text-fg sm:text-[32px]">{value}</div>
        </div>
        {(chip || href || footer) && (
          <div className="flex items-center justify-between gap-2 rounded-b-[20px] border-t border-line bg-surface-2/80 px-6 py-3.5 dark:bg-black/20">
            {footer ?? (chip ? <Chip tone={chipTone}>{chip}</Chip> : <span />)}
            {href && (
              <Link href={href} className="text-fg-3 transition-colors hover:text-fg" aria-label={`Open ${label}`}>
                <ArrowUpRight className="size-4" />
              </Link>
            )}
          </div>
        )}
      </SpotlightCard>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

export function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {});
        setDone(true);
        toast.success(label ? `${label} copied` : "Copied to clipboard");
        setTimeout(() => setDone(false), 1400);
      }}
      className={cn("inline-grid size-6 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg", className)}
      aria-label="Copy"
    >
      {done ? <Check className="size-3.5 text-up" /> : <Copy className="size-3.5" />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

/** `art` shows one of the founder's illustrations instead of the icon: only for a state with nothing to show (the
 *  whole page or panel is empty) or a result worth marking, never for a quiet line inside a data screen. */
export function EmptyState({ illustration = "package", art, title, text, action, className }: { illustration?: string; art?: IllustrationName; title: string; text?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {art ? <Illustration name={art} width={208} maxHeight={156} className="mb-2" /> : <Icon3D name={illustration} size={72} />}
      <h4 className="mt-4 text-base font-medium">{title}</h4>
      {text && <p className="mt-1 max-w-sm text-sm text-fg-3">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Label / value stack                                                 */
/* ------------------------------------------------------------------ */

export function Stat({ label, value, sub, className, align = "left" }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; className?: string; align?: "left" | "right" }) {
  return (
    <div className={cn("min-w-0", align === "right" && "text-right", className)}>
      <div className="text-[11.5px] uppercase tracking-[0.05em] text-fg-3">{label}</div>
      <div className="k-num mt-1 truncate text-[15px] font-medium text-fg">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-fg-3">{sub}</div>}
    </div>
  );
}

export function KeyValue({ rows, className }: { rows: [React.ReactNode, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-3 text-sm">
          <dt className="text-fg-3">{k}</dt>
          <dd className="k-num text-right font-medium text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* Data table                                                          */
/* ------------------------------------------------------------------ */

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T, i: number) => React.ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
  sort?: (row: T) => number | string;
  /** Plain value used for CSV export (falls back to `sort`). */
  csv?: (row: T) => number | string;
  hideOn?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  pageSize = 10,
  search,
  searchPlaceholder = "Search…",
  toolbar,
  onRowClick,
  empty,
  dense,
  exportName,
  rowKey,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  pageSize?: number;
  search?: (row: T) => string;
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  dense?: boolean;
  exportName?: string;
  rowKey?: (row: T, i: number) => string;
  className?: string;
}) {
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [sort, setSort] = React.useState<{ key: string; dir: 1 | -1 } | null>(null);

  const filtered = React.useMemo(() => {
    let r = rows;
    if (search && q) r = r.filter((x) => search(x).toLowerCase().includes(q.toLowerCase()));
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sort) r = [...r].sort((a, b) => (col.sort!(a) > col.sort!(b) ? sort.dir : -sort.dir));
    }
    return r;
  }, [rows, q, sort, columns, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const view = filtered.slice(page * pageSize, page * pageSize + pageSize);
  React.useEffect(() => setPage(0), [q, rows.length]);

  const hide = (h?: Column<T>["hideOn"]) => (h === "sm" ? "hidden sm:table-cell" : h === "md" ? "hidden md:table-cell" : h === "lg" ? "hidden lg:table-cell" : h === "xl" ? "hidden xl:table-cell" : "");

  return (
    <div className={cn("min-w-0", className)}>
      {(search || toolbar || exportName) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {toolbar}
          <div className="ml-auto flex items-center gap-2">
            {search && (
              <div className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5">
                <Search className="size-3.5 text-fg-3" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="w-40 bg-transparent text-[13px] outline-none placeholder:text-fg-3 sm:w-52" />
              </div>
            )}
            {exportName && (
              <Button size="sm" variant="surface" onClick={() => downloadCsv(exportName, columns, filtered)}>
                <Download /> CSV
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[13.5px]" style={{ minWidth: Math.min(640, columns.length * 110) }}>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th
                  key={c.key}
                  style={{ width: c.width }}
                  className={cn(
                    "whitespace-nowrap bg-surface-2 px-4 py-3 text-[11.5px] font-medium uppercase tracking-[0.05em] text-fg-3 first:rounded-l-[14px] last:rounded-r-[14px] border-y border-line first:border-l last:border-r",
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                    hide(c.hideOn),
                    i === 0 && "pl-5",
                  )}
                >
                  {c.sort ? (
                    <button className={cn("inline-flex items-center gap-1 uppercase tracking-[0.05em] hover:text-fg", c.align === "right" && "flex-row-reverse")} onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: -1 }))}>
                      {c.header}
                      <ArrowUpDown className={cn("size-3", sort?.key === c.key ? "text-ember" : "opacity-50")} />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r, ri) => (
              <motion.tr
                key={rowKey ? rowKey(r, ri) : ri}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: Math.min(ri * 0.02, 0.2) }}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn("group", onRowClick && "cursor-pointer")}
              >
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={cn(
                      "border-b border-line px-4 transition-colors group-hover:bg-surface-2/60",
                      dense ? "py-2.5" : "py-3.5",
                      c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                      hide(c.hideOn),
                      i === 0 && "pl-5",
                      c.className,
                    )}
                  >
                    {c.cell(r, page * pageSize + ri)}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
        {view.length === 0 && (empty ?? <EmptyState title="Nothing here yet" text="Try changing filters or the date range." illustration="magnifying_glass_tilted_left" />)}
      </div>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-[12.5px] text-fg-3">
          <span className="k-num">
            {page * pageSize + 1}–{Math.min(filtered.length, (page + 1) * pageSize)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1.5">
            <IconButton size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
              <ChevronLeft />
            </IconButton>
            <span className="k-num px-2">
              {page + 1} / {pages}
            </span>
            <IconButton size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
              <ChevronRight />
            </IconButton>
          </div>
        </div>
      )}
    </div>
  );
}

function downloadCsv<T>(name: string, columns: Column<T>[], rows: T[]) {
  const cols = columns.filter((c) => c.csv || c.sort);
  if (cols.length === 0) {
    toast.error("Nothing to export", { description: "No exportable columns." });
    return;
  }
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = cols.map((c) => esc(typeof c.header === "string" ? c.header : c.key)).join(",");
  const body = rows.map((r) => cols.map((c) => esc((c.csv ?? c.sort)!(r))).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([head + "\n" + body], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${name}.csv downloaded`, { description: `${rows.length} rows · ${cols.length} columns` });
}

/* ------------------------------------------------------------------ */
/* List row (signals / trades / watchlist style)                       */
/* ------------------------------------------------------------------ */

export function ListRow({ children, className, onClick, href, target, rel }: { children: React.ReactNode; className?: string; onClick?: () => void; href?: string; target?: string; rel?: string }) {
  const cls = cn("k-row flex items-center gap-3 px-4 py-3 transition-colors hover:border-[var(--k-border-top)] hover:bg-surface-3/60", (onClick || href) && "cursor-pointer", className);
  if (href)
    return (
      <Link href={href} target={target} rel={rel} className={cls}>
        {children}
      </Link>
    );
  return (
    <div className={cls} onClick={onClick}>
      {children}
    </div>
  );
}
