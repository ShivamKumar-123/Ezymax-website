"use client";

// Shared building blocks of the staking pages: formatting in the reader's language, status chips, errors and the
// risk disclosure.

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, RotateCw, ShieldAlert } from "lucide-react";
import { Button, Card, Chip, EmptyState, cn } from "@/components/kit";
import { useFormat, useT } from "@ezymex/i18n/react";
import { ERROR_LINK, STATUS_TONE, StakingError, periodDate, type PositionStatus } from "./api";

/** Money, month, rate and date formatting for the staking pages. */
export function useStakingFormat() {
  const f = useFormat();
  return React.useMemo(
    () => ({
      amount: (v: number | null | undefined, currency = "USDT") => (v === null || v === undefined || !Number.isFinite(v) ? "—" : f.money(v, currency)),
      month: (p: string | null | undefined) => (p ? f.date(periodDate(p), { month: "short", year: "numeric", timeZone: "UTC" }) : "—"),
      rate: (v: number | null | undefined) => (v === null || v === undefined ? "—" : f.percent(v, 2)),
      date: (iso: string | Date | null | undefined) => (iso ? f.date(iso) : "—"),
      dateTime: (iso: string | null | undefined) => (iso ? f.dateTime(iso) : "—"),
    }),
    [f],
  );
}

export function PositionStatusChip({ status }: { status: PositionStatus }) {
  const t = useT();
  return (
    <Chip size="sm" dot tone={STATUS_TONE[status] ?? "neutral"}>
      {t.dyn(`staking.status.${status}`, status)}
    </Chip>
  );
}

/** Inline error with its next step (verify identity, deposit) when there is one. */
export function ErrorNote({ error, className }: { error: unknown; className?: string }) {
  const t = useT();
  if (!error) return null;
  const code = error instanceof StakingError ? error.code : "error";
  const msg = error instanceof Error ? error.message : t("staking.error.generic");
  const link = ERROR_LINK[code];
  const soft = code === "payment_pending";
  return (
    <div className={cn("flex flex-col gap-3 rounded-[14px] border px-4 py-3 sm:flex-row sm:items-center", soft ? "border-info/25 bg-info-soft" : "border-down/25 bg-down-soft", className)} role="alert">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", soft ? "text-info" : "text-down")} />
        <p className="text-[13px] text-fg">{msg}</p>
      </div>
      {link && (
        <Link href={link.href} className="shrink-0">
          <Button size="sm" variant="surface">
            {t(link.labelKey)} <ArrowRight className="rtl:-scale-x-100" />
          </Button>
        </Link>
      )}
    </div>
  );
}

export function LoadError({ error, onRetry, title }: { error: StakingError; onRetry: () => void; title?: string }) {
  const t = useT();
  return (
    <Card>
      <EmptyState
        art="connectionLost"
        title={title ?? t("staking.error.unavailable")}
        text={error.status === 0 || error.status >= 500 ? undefined : error.message}
        action={
          <Button variant="surface" onClick={onRetry}>
            <RotateCw /> {t("common.retry")}
          </Button>
        }
      />
    </Card>
  );
}

/** The general risk disclosure, with the plan's own text when given. */
export function RiskNote({ planText, className }: { planText?: string; className?: string }) {
  const t = useT();
  return (
    <div className={cn("rounded-[14px] border border-warn/30 bg-warn-soft px-4 py-3", className)}>
      <div className="flex items-center gap-2 text-[13px] font-medium text-fg">
        <ShieldAlert className="size-4 shrink-0 text-warn" /> {t("staking.risk.title")}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-2">{t("staking.risk.text")}</p>
      {planText && (
        <>
          <div className="mt-3 text-[12px] font-medium text-fg-2">{t("staking.risk.planTitle")}</div>
          <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-fg-2">{planText}</p>
        </>
      )}
    </div>
  );
}

/** Label / value rows. */
export function Rows({ rows, className }: { rows: [React.ReactNode, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line rounded-[14px] border border-line px-4", className)}>
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-2.5 text-[12.5px]">
          <dt className="shrink-0 text-fg-3">{k}</dt>
          <dd className="k-num text-end font-medium text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
