"use client";

// Account health strip (docs/TERMINAL-DESIGN.md §2.2): balance, equity, floating P&L, margin, free margin and margin
// level with a safe / low / margin call / stop out meter, each with a plain-language (?) explanation. One slim line at
// the foot of the positions card; it stays on screen when the card is collapsed.
import * as React from "react";
import { cn } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { useMetrics, useTerminal } from "@/lib/store";
import { accCcy, accMoney, marginState } from "@/lib/trading";
import { LiveMoney, Pnl } from "@/components/ui/primitives";
import { HelpTip, Tip } from "@/components/ui/kit";

type Health = "idle" | "ok" | "low" | "call" | "stopout";

const TONE: Record<Health, { text: string; bar: string }> = {
  idle: { text: "text-up", bar: "bg-up" },
  ok: { text: "text-up", bar: "bg-up" },
  low: { text: "text-warn", bar: "bg-warn" },
  call: { text: "text-down", bar: "bg-down" },
  stopout: { text: "text-down", bar: "bg-down" },
};

function Item({ label, help, helpTitle, children, className }: { label: string; help: string; helpTitle: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center gap-1.5 whitespace-nowrap", className)}>
      <span className="flex items-center gap-0.5 text-[12px] text-fg-3">
        {label}
        <HelpTip title={helpTitle} text={help} side="top" className="size-3.5 [&>svg]:size-3" />
      </span>
      <span className="k-num font-mono text-[12.5px] text-fg" dir="ltr">
        {children}
      </span>
    </span>
  );
}

export function AccountHealth({ right, className }: { right?: React.ReactNode; className?: string }) {
  const T = useTerminal();
  const t = useT();
  if (T.guest)
    return (
      <div className={cn("flex h-8 shrink-0 items-center gap-3 px-3", className)}>
        <span className="truncate text-[12.5px] text-fg-2">{t("trader.guest.text")}</span>
        {right && <div className="ms-auto flex items-center gap-1">{right}</div>}
      </div>
    );
  return <Strip right={right} className={className} />;
}

function Strip({ right, className }: { right?: React.ReactNode; className?: string }) {
  const t = useT();
  const m = useMetrics();
  const a = m.account;
  const ccy = accCcy(a);
  const lvl = Number.isFinite(m.level) ? m.level : null;
  const e = (a as typeof a & { engine?: { marginCallLevel?: number; stopOutLevel?: number } }).engine;
  const call = e?.marginCallLevel ?? 100;
  const out = e?.stopOutLevel ?? 50;
  const h: Health = lvl === null || m.margin <= 0 ? "idle" : marginState(lvl, a);
  // meter: empty at the stop-out level, full at four times the margin-call level (or with no margin in use)
  const fill = h === "idle" ? 1 : Math.max(0.04, Math.min(1, ((lvl ?? 0) - out) / (call * 4 - out)));
  const tone = TONE[h];
  const money = (v: number) => accMoney(a, v);
  return (
    <div data-tour="health" className={cn("@container flex h-8 shrink-0 items-center gap-x-4 overflow-hidden px-3", className)} role="group" aria-label={t("desk.ah.title")}>
      <Item label={t("desk.ah.balance")} helpTitle={t("desk.g.balance.t")} help={t("desk.g.balance")}>
        {money(m.balance)} <span className="text-fg-3">{ccy}</span>
      </Item>
      <Item label={t("desk.ah.equity")} helpTitle={t("desk.g.equity.t")} help={t("desk.g.equity")}>
        <LiveMoney value={m.equity} format={money} />
      </Item>
      <Item label={t("desk.ah.pnl")} helpTitle={t("desk.g.pnl.t")} help={t("desk.g.pnl")}>
        <Pnl value={m.floating} text={accMoney(a, m.floating, { signed: true })} format={(v) => accMoney(a, v, { signed: true })} />
      </Item>
      <Item label={t("desk.ah.margin")} helpTitle={t("desk.g.margin.t")} help={t("desk.g.margin")} className="hidden @[760px]:flex">
        {money(m.margin)}
      </Item>
      <Item label={t("desk.ah.free")} helpTitle={t("desk.g.free.t")} help={t("desk.g.free")} className="hidden @[620px]:flex">
        <LiveMoney value={m.free} format={money} className={m.free < 0 ? "text-down" : undefined} />
      </Item>
      {m.credit > 0 && (
        <Item label={t("desk.ah.credit")} helpTitle={t("desk.g.credit.t")} help={t("desk.g.credit")} className="hidden @[1100px]:flex">
          {money(m.credit)}
        </Item>
      )}
      <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <span className="flex items-center gap-0.5 text-[12px] text-fg-3">
          {t("desk.ah.level")}
          <HelpTip title={t("desk.g.level.t")} text={t("desk.g.level")} className="size-3.5 [&>svg]:size-3" />
        </span>
        <Tip content={t.dyn(`desk.ah.stateTip.${h}`, undefined, { call, out })}>
          <span className="flex items-center gap-1.5" tabIndex={0}>
            <span className="k-num font-mono text-[12.5px] text-fg" dir="ltr">
              {lvl === null || h === "idle" ? "—" : `${lvl.toLocaleString("en-US", { maximumFractionDigits: 0 })}%`}
            </span>
            <span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-surface-3" aria-hidden>
              <span className={cn("absolute inset-y-0 start-0 rounded-full transition-[width] duration-500", tone.bar)} style={{ width: `${fill * 100}%` }} />
            </span>
            <span className={cn("text-[12px] font-semibold", tone.text)}>{t.dyn(`desk.ah.state.${h}`)}</span>
          </span>
        </Tip>
      </span>
      {right && <div className="ms-auto flex shrink-0 items-center gap-1 ps-2">{right}</div>}
    </div>
  );
}
