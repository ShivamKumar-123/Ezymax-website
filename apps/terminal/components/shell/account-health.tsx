"use client";

// Account health strip (docs/TERMINAL-DESIGN.md §2.2): balance, equity, floating P&L, margin, free margin and margin
// level. One slim line at the foot of the positions card; it stays on screen when the card is collapsed.
// Label and value, nothing else: the eye that hides the amounts is in the top bar, and the glossary that each (?)
// opened is on the order ticket, where a trader meets those words while deciding something. The margin level carries
// its own state as colour - safe, low, margin call, stop out - in place of the meter and badge that said it twice.
import * as React from "react";
import { cn } from "@ezymex/ui";
import { useT } from "@ezymex/i18n/react";
import { useMetrics, useTerminal } from "@/lib/store";
import { accCcy, accMoney, marginState } from "@/lib/trading";
import { LiveMoney, Pnl } from "@/components/ui/primitives";
import { Tip } from "@/components/ui/kit";
import { AccountMoney } from "@/components/ui/balances";

type Health = "idle" | "ok" | "low" | "call" | "stopout";

const TONE: Record<Health, string> = { idle: "text-up", ok: "text-up", low: "text-warn", call: "text-down", stopout: "text-down" };

function Item({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center gap-1.5 whitespace-nowrap", className)}>
      <span className="text-[12px] text-fg-3">{label}</span>
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
  const money = (v: number) => accMoney(a, v);
  return (
    <div data-tour="health" className={cn("@container flex h-8 shrink-0 items-center gap-x-4 overflow-hidden ps-3 pe-3", className)} role="group" aria-label={t("desk.ah.title")}>
      <Item label={t("desk.ah.balance")}>
        <AccountMoney>{money(m.balance)}</AccountMoney> <span className="text-fg-3">{ccy}</span>
      </Item>
      <Item label={t("desk.ah.equity")}>
        <AccountMoney>
          <LiveMoney value={m.equity} format={money} />
        </AccountMoney>
      </Item>
      <Item label={t("desk.ah.pnl")}>
        <AccountMoney>
          <Pnl value={m.floating} text={accMoney(a, m.floating, { signed: true })} format={(v) => accMoney(a, v, { signed: true })} />
        </AccountMoney>
      </Item>
      <Item label={t("desk.ah.margin")} className="hidden @[760px]:flex">
        <AccountMoney>{money(m.margin)}</AccountMoney>
      </Item>
      <Item label={t("desk.ah.free")} className="hidden @[620px]:flex">
        <AccountMoney>
          <LiveMoney value={m.free} format={money} className={m.free < 0 ? "text-down" : undefined} />
        </AccountMoney>
      </Item>
      {m.credit > 0 && (
        <Item label={t("desk.ah.credit")} className="hidden @[1100px]:flex">
          <AccountMoney>{money(m.credit)}</AccountMoney>
        </Item>
      )}
      <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <span className="text-[12px] text-fg-3">{t("desk.ah.level")}</span>
        {/* the meter and the "Safe" badge said in three ways what the number says once; the colour is what a
            trader needs from them, so the number keeps that and they go */}
        <Tip content={t.dyn(`desk.ah.stateTip.${h}`, undefined, { call, out })}>
          <span className={cn("k-num font-mono text-[12.5px]", h === "idle" ? "text-fg" : TONE[h])} dir="ltr" tabIndex={0}>
            {lvl === null || h === "idle" ? "—" : `${lvl.toLocaleString("en-US", { maximumFractionDigits: 0 })}%`}
          </span>
        </Tip>
      </span>
      {right && <div className="ms-auto flex shrink-0 items-center gap-1 ps-2">{right}</div>}
    </div>
  );
}
