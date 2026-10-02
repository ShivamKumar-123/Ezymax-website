"use client";

// Options mode on phones and small tablets (< 1024 px): underlying + expiry on top, then the chain (calls or puts,
// compact columns), positions as cards, simple mode or settlements, with a bottom bar of its own. Picking a price
// opens the ticket as a bottom sheet. Loaded on demand like the desktop workspace.
import * as React from "react";
import { CalendarCheck2, Layers, Lightbulb, Table2, Wand2, X } from "lucide-react";
import { OPTION_SPEC } from "@kalks/mock/options";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { useTerminal } from "@/lib/store";
import { Pnl } from "@/components/ui/primitives";
import { GuestNotice } from "@/components/shell/guest";
import { useOptionBook } from "@/lib/options/book";
import { opt, useOpt, useOptionsAttach } from "@/lib/options-store";
import type { OptPosition } from "@/lib/options/types";
import { OptAvatar, OptionsUnavailable, RightTag, Seg, SideTag } from "./bits";
import { StrategyBuilder } from "./builder";
import { OptionChainTable } from "./chain";
import { useOptionEvents, StreamDot } from "./desktop";
import { expiryLabel, strikeText, usd, usdSigned } from "./format";
import { ExpiryStrip, SpotPrice, UnderlyingPicker } from "./header";
import { closeOptionPosition, useOptionPositionLive } from "./positions-tab";
import { SettlementsTab } from "./settlements-tab";
import { SimpleMode } from "./simple";
import { OptionTicket } from "./ticket";

type MTab = "chain" | "positions" | "simple" | "settlements";

export function OptionsMobile() {
  const T = useTerminal();
  const t = useT();
  useOptionsAttach({ login: T.account.login, guest: T.guest, engine: T.engine, readOnly: T.readOnly });
  useOptionEvents(T.guest ? null : T.account.login);
  const avail = useOpt((s) => s.avail);
  const u = useOpt((s) => s.u);
  const view = useOpt((s) => s.prefs.view);
  const legs = useOpt((s) => s.ticket.legs);
  const chainSpot = useOpt((s) => s.chain?.spot?.mid);
  const book = useOptionBook(T.guest ? null : T.account.login);
  const [tab, setTab] = React.useState<MTab>("chain");
  const [sheet, setSheet] = React.useState(false);
  const prevLegs = React.useRef(legs.length);
  React.useEffect(() => {
    if (legs.length > prevLegs.current) setSheet(true);
    if (!legs.length) setSheet(false);
    prevLegs.current = legs.length;
  }, [legs.length]);

  const tabs: { id: MTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "chain", label: t("trader.opt.chainTitle"), icon: <Table2 /> },
    { id: "positions", label: t("trader.opt.pos.tab"), icon: <Layers />, count: book.positions.length },
    { id: "simple", label: t("trader.opt.simple.tab"), icon: <Lightbulb /> },
    { id: "settlements", label: t("trader.opt.set.tab"), icon: <CalendarCheck2 /> },
  ];

  if (avail === "soon" || avail === "error") return <OptionsUnavailable kind={avail} onRetry={() => opt.retry()} />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {(tab === "chain" || tab === "simple") && (
        <div className="shrink-0 space-y-1.5 border-b border-line bg-panel p-2">
          <div className="flex items-center gap-2">
            <UnderlyingPicker compact />
            <SpotPrice symbol={u} className="text-[14px]" fallback={chainSpot} />
            <span className="ms-auto flex items-center gap-1">
              <StreamDot />
              <button onClick={() => opt.openBuilder(true)} aria-label={t("trader.opt.builder.open")} className="grid size-8 place-items-center rounded-[7px] bg-ember text-white">
                <Wand2 className="size-4" />
              </button>
            </span>
          </div>
          <ExpiryStrip className="h-9 border-0 bg-transparent px-0" />
          {tab === "chain" && (
            <Seg
              value={view === "puts" ? "puts" : "calls"}
              onChange={(v) => opt.setPrefs({ view: v })}
              options={[
                { value: "calls", label: t("trader.opt.calls"), tone: "up" },
                { value: "puts", label: t("trader.opt.puts"), tone: "down" },
              ]}
            />
          )}
        </div>
      )}
      <main className="min-h-0 flex-1 overflow-hidden">
        {tab === "chain" && <OptionChainTable compact />}
        {tab === "simple" && (
          <div className="t-scroll h-full overflow-y-auto">
            <SimpleMode />
          </div>
        )}
        {tab === "positions" && (T.guest ? <GuestNotice icon={<Layers />} text={t("trader.opt.guest.text")} /> : <MPositions positions={book.positions} />)}
        {tab === "settlements" && (T.guest ? <GuestNotice icon={<CalendarCheck2 />} text={t("trader.opt.guest.text")} /> : <SettlementsTab />)}
      </main>
      {legs.length > 0 && !sheet && (
        <button onClick={() => setSheet(true)} className="mx-2 mb-2 flex h-10 shrink-0 items-center justify-between rounded-[9px] bg-ember px-3 text-[12.5px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(255,90,31,0.9)]">
          <span>{legs.length === 1 ? t("trader.opt.ticket.single") : t("trader.opt.ticket.strategy", { count: legs.length })}</span>
          <span>{t("trader.opt.ticket.review")}</span>
        </button>
      )}
      <nav className="grid h-[58px] shrink-0 grid-cols-4 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)]">
        {tabs.map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)} className={cn("relative flex flex-col items-center justify-center gap-0.5 text-[10.5px] [&_svg]:size-[17px]", tab === x.id ? "text-ember" : "text-fg-3")}>
            {tab === x.id && <span className="absolute inset-x-5 top-0 h-[2px] rounded-full bg-ember" />}
            {x.icon}
            {x.label}
            {!!x.count && <span className="absolute right-[22%] top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-ember px-1 font-mono text-[9px] text-white">{x.count}</span>}
          </button>
        ))}
      </nav>
      {sheet && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal dir="ltr">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSheet(false)} />
          <div className="t-sheet relative max-h-[88dvh] overflow-y-auto rounded-t-[14px] border-t border-line-top bg-panel pb-[env(safe-area-inset-bottom)]">
            <div className="sticky top-0 z-[1] flex items-center justify-between border-b border-line bg-panel px-3 py-2">
              <span className="text-[12.5px] font-semibold">{t("trader.opt.ticket.title")}</span>
              <button onClick={() => setSheet(false)} aria-label={t("common.close")} className="grid size-7 place-items-center rounded-md text-fg-3 hover:bg-surface-3">
                <X className="size-4" />
              </button>
            </div>
            <OptionTicket onDone={() => setSheet(false)} />
          </div>
        </div>
      )}
      <StrategyBuilder />
    </div>
  );
}

function MPositions({ positions }: { positions: OptPosition[] }) {
  const t = useT();
  if (!positions.length) return <div className="p-8 text-center text-[12.5px] text-fg-3">{t("trader.opt.pos.empty")}</div>;
  return (
    <div className="t-scroll h-full space-y-1.5 overflow-y-auto p-2">
      {positions.map((p) => (
        <MPositionCard key={p.ticket} p={p} />
      ))}
    </div>
  );
}

function MPositionCard({ p }: { p: OptPosition }) {
  const T = useTerminal();
  const t = useT();
  const { locale } = useLocale();
  const v = useOptionPositionLive(p);
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="rounded-[9px] border border-line bg-panel p-2.5">
      <div className="flex items-center gap-2">
        <OptAvatar symbol={p.option.underlying} size={16} />
        <span className="text-[13px] font-semibold">{p.option.underlying}</span>
        <span className="font-mono text-[12.5px]">{strikeText(p.option.strike, OPTION_SPEC[p.option.underlying]?.digits ?? 5)}</span>
        <RightTag right={p.option.right} />
        <span className="text-[11px] text-fg-3">{expiryLabel(p.option.expiry, locale, false)}</span>
        <span className="ms-auto text-[14px] font-semibold">
          <Pnl value={v.profit} text={usdSigned(v.profit)} format={(x) => usdSigned(x)} />
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 font-mono text-[11px] text-fg-3">
        <SideTag side={p.side} />
        <span>× {p.contracts}</span>
        <span>
          {t("trader.opt.col.openPremium")} <span className="text-fg-2">{usd(v.openUsd)}</span>
        </span>
        <span>
          {t("trader.opt.col.mark")} <span className="text-fg-2">{v.markUsd !== undefined ? usd(v.markUsd) : "—"}</span>
        </span>
        {!T.readOnly && (
          <button disabled={busy} onClick={() => (setBusy(true), void closeOptionPosition(T, t, p).finally(() => setBusy(false)))} className="ms-auto h-7 rounded-[6px] border border-line px-2.5 font-sans text-[11.5px] font-medium text-fg-2 hover:border-down/50 hover:text-down disabled:opacity-50">
            {t("trader.opt.pos.close")}
          </button>
        )}
      </div>
    </div>
  );
}
