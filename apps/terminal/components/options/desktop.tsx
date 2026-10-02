"use client";

// The Options workspace on desktop (Kalks Trader in Options mode): underlying bar, expiry strip, then the chain, the
// underlying's chart with option levels and the ticket / simple mode side by side (resizable, sizes remembered);
// the toolbox below (Options + Settlements tabs) stays the terminal's own. Loaded on demand (next/dynamic) the first
// time a trader switches to Options, so CFD-only traders never download it.
import * as React from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ChevronsRight, ShoppingCart, Table2 } from "lucide-react";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { toast } from "@/lib/notify";
import { useTerminal } from "@/lib/store";
import { PanelHeader, PanelTabs, TPanel } from "@/components/ui/panel";
import { TIcon } from "@/components/ui/primitives";
import { optionBook } from "@/lib/options/book";
import { onDemoOrderEvent } from "@/lib/options/mock-engine";
import { opt, useOpt, useOptionsAttach, type SidePanel } from "@/lib/options-store";
import { OptionsUnavailable } from "./bits";
import { StrategyBuilder } from "./builder";
import { OptionChainTable } from "./chain";
import { expiryLabel } from "./format";
import { ExpiryStrip, UnderlyingBar } from "./header";
import { SimpleMode } from "./simple";
import { OptionTicket } from "./ticket";
import { UnderlyingChart } from "./underlying-chart";

function Handle() {
  return <PanelResizeHandle className="t-handle" />;
}

/** Live / polling / reconnecting dot of the chain stream. */
export function StreamDot() {
  const t = useT();
  const s = useOpt((x) => x.stream);
  const tone = s === "open" ? "bg-up" : s === "polling" ? "bg-gold" : s === "unavailable" ? "bg-fg-3" : "bg-warn animate-pulse";
  const label = s === "open" ? t("trader.opt.stream.live") : s === "polling" ? t("trader.opt.stream.polling") : s === "unavailable" ? t("trader.opt.stream.off") : t("trader.opt.stream.connecting");
  return (
    <span className="flex items-center gap-1.5 pe-1.5 text-[10.5px] text-fg-3" title={label}>
      <span className={cn("size-1.5 rounded-full", tone)} />
      <span className="hidden xl:inline">{label}</span>
    </span>
  );
}

/** Toasts for events the options book reports: expiry settlements, knock-outs, demo working-order fills. */
export function useOptionEvents(login: string | null) {
  const t = useT();
  React.useEffect(() => {
    if (!login) return;
    const off1 = optionBook.onClose((l, d) => {
      if (l !== login) return;
      const reason = String((d as { reason?: unknown }).reason ?? "");
      const sym = String((d as { symbol?: unknown }).symbol ?? "");
      const profit = Number((d as { profit?: unknown }).profit ?? 0);
      if (reason === "expiry" || reason === "settlement") toast(t("trader.opt.toast.settled"), { description: `${sym} · ${profit >= 0 ? "+" : ""}${profit.toFixed(2)} USD` });
      else if (reason === "knock_out" || reason === "knockout") toast.warning(t("trader.opt.toast.knockedOut"), { description: sym });
    });
    const off2 = onDemoOrderEvent((l, o, filled) => {
      if (l !== login) return;
      if (filled) toast.success(t("trader.opt.toast.workingFilled"), { description: `#${o.ticket} ${o.option.series}` });
      else toast.warning(t("trader.opt.toast.workingExpired"), { description: `#${o.ticket} ${o.option.series}` });
    });
    return () => {
      off1();
      off2();
    };
  }, [login, t]);
}

/** Toasts sit at the top-right of the chain / chart area, left of the ticket (like the CFD workspace, see providers.tsx). */
function useToastAnchor(ref: React.RefObject<HTMLDivElement | null>) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement.style;
    const place = () => {
      const r = el.getBoundingClientRect();
      root.setProperty("--t-toast-top", `${Math.round(r.top + 40)}px`);
      root.setProperty("--t-toast-right", `${Math.round(window.innerWidth - r.right + 16)}px`);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
      root.removeProperty("--t-toast-top");
      root.removeProperty("--t-toast-right");
    };
  });
}

export function OptionsMain() {
  const T = useTerminal();
  const t = useT();
  const { locale } = useLocale();
  useOptionsAttach({ login: T.account.login, guest: T.guest, engine: T.engine, readOnly: T.readOnly });
  useOptionEvents(T.guest ? null : T.account.login);
  const avail = useOpt((s) => s.avail);
  const chart = useOpt((s) => s.prefs.chart);
  const panel = useOpt((s) => s.prefs.panel);
  const u = useOpt((s) => s.u);
  const expiry = useOpt((s) => s.expiry);
  const legs = useOpt((s) => s.ticket.legs.length);
  const [ticketOpen, setTicketOpen] = React.useState(true);
  const area = React.useRef<HTMLDivElement>(null);
  useToastAnchor(area);

  if (avail === "soon" || avail === "error")
    return (
      <TPanel>
        <OptionsUnavailable kind={avail} onRetry={() => opt.retry()} />
      </TPanel>
    );

  return (
    <div className="flex h-full min-h-0 flex-col gap-1">
      <UnderlyingBar />
      <ExpiryStrip />
      <div className="flex min-h-0 flex-1 gap-1">
        <PanelGroup direction="horizontal" autoSaveId={chart ? "kalks.options.h3" : "kalks.options.h2"} className="min-w-0 flex-1">
          <Panel id="ochain" order={1} minSize={34} defaultSize={chart ? 50 : 72}>
            <div ref={area} className="h-full min-h-0">
            <TPanel>
              <PanelHeader icon={<Table2 />} title={<span className="flex items-center gap-1.5">{t("trader.opt.chainTitle")}<span className="font-normal normal-case tracking-normal text-fg-3">· {u}{expiry ? ` · ${expiryLabel(expiry, locale)}` : ""}</span></span>}>
                <StreamDot />
              </PanelHeader>
              <div className="min-h-0 flex-1">
                <OptionChainTable />
              </div>
            </TPanel>
            </div>
          </Panel>
          {chart && (
            <>
              <Handle />
              <Panel id="ouchart" order={2} minSize={16} defaultSize={24}>
                <TPanel>
                  <UnderlyingChart />
                </TPanel>
              </Panel>
            </>
          )}
          {ticketOpen && (
            <>
              <Handle />
              <Panel id="oticket" order={3} minSize={20} defaultSize={chart ? 26 : 28} maxSize={40}>
                <TPanel>
                  <PanelHeader icon={<ShoppingCart />} title={t("trader.opt.ticket.title")}>
                    <TIcon label={t("order.panel.collapse")} onClick={() => setTicketOpen(false)}>
                      <ChevronsRight />
                    </TIcon>
                  </PanelHeader>
                  <div className="flex h-8 shrink-0 items-stretch border-b border-line px-1">
                    <PanelTabs<SidePanel>
                      value={panel}
                      onChange={(v) => opt.setPrefs({ panel: v })}
                      tabs={[
                        { value: "ticket", label: t("trader.opt.ticket.tab"), count: legs || undefined },
                        { value: "simple", label: t("trader.opt.simple.tab") },
                      ]}
                    />
                  </div>
                  <div className="t-scroll min-h-0 flex-1 overflow-y-auto">{panel === "simple" ? <SimpleMode /> : <OptionTicket />}</div>
                </TPanel>
              </Panel>
            </>
          )}
        </PanelGroup>
        {!ticketOpen && (
          <button onClick={() => setTicketOpen(true)} className="flex w-6 shrink-0 items-center justify-center rounded-[6px] border border-line bg-panel text-fg-3 hover:border-ember/40 hover:text-fg" title={t("trader.opt.ticket.title")}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] [writing-mode:vertical-rl]">{t("trader.opt.ticket.title")}</span>
          </button>
        )}
      </div>
      <StrategyBuilder />
    </div>
  );
}
