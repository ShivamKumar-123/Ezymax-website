"use client";

// A10 execution report of a copy subscription (master vs follower price, slippage, delay) and A11 master announcements.

import * as React from "react";
import { Megaphone } from "lucide-react";
import { Chip, DataTable, cn, type Column } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { fmtPrice, serverTime } from "@/components/trading/api";
import { delayText, pips1, useSocial, type Announcement, type ExecutionReport, type ExecutionRow, type ExecutionSummary } from "./api";
import { BlockSkeleton, InfoBox, Tile } from "./bits";

/** Slippage in pips, coloured: positive = worse for the follower (down), negative = better (up). */
export function Slippage({ pips }: { pips: number | null | undefined }) {
  if (typeof pips !== "number" || !Number.isFinite(pips)) return <span className="text-fg-3">—</span>;
  return <span className={cn("k-num font-medium", pips > 0.05 ? "text-down" : pips < -0.05 ? "text-up" : "text-fg-2")}>{pips > 0 ? "+" : ""}{pips1(pips)}</span>;
}

export function ExecutionSummaryTiles({ s }: { s: ExecutionSummary | null | undefined }) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="copy-exec-summary">
      <Tile label={t("social.exec.trades")}>{s?.trades ?? 0}</Tile>
      <Tile label={t("social.exec.avgSlippage")}>
        <Slippage pips={s?.avgSlippagePips} />
      </Tile>
      <Tile label={t("social.exec.avgDelay")}>{delayText(s?.avgDelayMs)}</Tile>
      <Tile label={t("social.exec.worst")}>
        <span className="inline-flex items-baseline gap-1">
          <Slippage pips={s?.worstSlippagePips} />
          <span className="text-[11px] font-normal text-fg-3">· {delayText(s?.maxDelayMs)}</span>
        </span>
      </Tile>
    </div>
  );
}

/** The Execution tab of the subscription drawer: summary tiles and every copied trade (GET subscriptions/{id}/execution). */
export function ExecutionPanel({ id, fallback }: { id: number; fallback?: ExecutionSummary }) {
  const t = useT();
  const { data, error } = useSocial<ExecutionReport>(`subscriptions/${id}/execution`, 15000);
  const cols: Column<ExecutionRow>[] = [
    { key: "at", header: t("common.time"), cell: (r) => <span className="k-num whitespace-nowrap text-fg-2">{serverTime(r.at, false)}</span>, sort: (r) => r.at },
    { key: "a", header: t("social.col.action"), cell: (r) => <span className="capitalize">{t.dyn(`social.logAction.${r.action}`, r.action.replace(/_/g, " "))}</span> },
    {
      key: "tk",
      header: t("social.exec.col.tickets"),
      cell: (r) => (
        <span className="whitespace-nowrap font-mono text-[11.5px] text-fg-2">
          {r.masterTicket ? `#${r.masterTicket}` : "—"} → {r.followerTicket ? `#${r.followerTicket}` : "—"}
        </span>
      ),
      hideOn: "md",
    },
    { key: "mp", header: t("social.exec.col.masterPrice"), align: "right", cell: (r) => <span className="k-num text-fg-2">{fmtPrice(r.masterPrice)}</span>, hideOn: "sm" },
    { key: "fp", header: t("social.exec.col.yourPrice"), align: "right", cell: (r) => <span className="k-num">{fmtPrice(r.followerPrice)}</span> },
    { key: "sl", header: t("social.exec.col.slippage"), align: "right", cell: (r) => <Slippage pips={r.slippagePips} />, sort: (r) => r.slippagePips ?? 0 },
    { key: "d", header: t("social.exec.col.delay"), align: "right", cell: (r) => <span className="k-num whitespace-nowrap text-fg-2">{delayText(r.delayMs)}</span>, sort: (r) => r.delayMs ?? 0 },
  ];
  return (
    <div className="space-y-3">
      <ExecutionSummaryTiles s={data?.summary ?? fallback} />
      <p className="text-[12px] leading-snug text-fg-3">{t("social.exec.hint")}</p>
      {!data ? (
        error ? <InfoBox tone="down">{error.message}</InfoBox> : <BlockSkeleton n={2} h={60} />
      ) : data.items.length ? (
        <DataTable columns={cols} rows={data.items} dense pageSize={15} rowKey={(r, i) => `${r.at}-${r.followerTicket ?? i}-${i}`} exportName="copy-execution" />
      ) : (
        <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">{t("social.exec.empty")}</div>
      )}
    </div>
  );
}

/** A master's announcements, newest first. */
export function AnnouncementList({ items, empty, showRecipients = false }: { items: Announcement[]; empty: string; showRecipients?: boolean }) {
  const t = useT();
  if (!items.length) return <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">{empty}</div>;
  return (
    <ul className="space-y-2" data-testid="copy-announcements">
      {items.map((a) => (
        <li key={a.id} className="k-row px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Megaphone className="size-3.5 shrink-0 text-ember" />
              <span className="min-w-0 truncate text-[13.5px] font-medium text-fg">{a.title}</span>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] text-fg-3">
              {a.createdAt ? <span className="k-num">{serverTime(a.createdAt, false)}</span> : null}
              {showRecipients && <Chip size="sm">{t("social.ann.recipients", { count: a.recipients })}</Chip>}
            </span>
          </div>
          {a.body && <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-relaxed text-fg-2">{a.body}</p>}
        </li>
      ))}
    </ul>
  );
}
