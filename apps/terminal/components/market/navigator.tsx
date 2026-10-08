"use client";

import * as React from "react";
import { toast } from "@/lib/notify";
import { Bot, ChevronDown, ChevronRight, Compass, FileCode2, Spline, UserRound } from "lucide-react";
import { MY_STRATEGIES } from "@ezymex/mock/algo";
import { cn } from "@ezymex/ui";
import { useTerminal } from "@/lib/store";
import { INDICATOR_CATEGORIES, INDICATOR_LIST } from "@/lib/indicators";
import { addIndicator } from "@/components/chart/indicators/state";
import { PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/primitives";
import { ProductBadge } from "@/components/shell/title-bar";
import { openRegister, openSignIn } from "@/lib/guest";
import { useT } from "@ezymex/i18n/react";

function Group({ icon, title, count, children, defaultOpen = true }: { icon: React.ReactNode; title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex h-6 w-full items-center gap-1 px-1.5 text-start text-[11.5px] font-medium text-fg-2 hover:text-fg">
        {open ? <ChevronDown className="size-3 text-fg-3" /> : <ChevronRight className="size-3 text-fg-3 rtl:-scale-x-100" />}
        <span className="text-fg-3 [&>svg]:size-3.5">{icon}</span>
        {title}
        {count !== undefined && <span className="ms-auto font-mono text-[10px] text-fg-3">{count}</span>}
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

function Leaf({ children, onClick, onDoubleClick, onEnter, active, title }: { children: React.ReactNode; onClick?: () => void; onDoubleClick?: () => void; onEnter?: () => void; active?: boolean; title?: string }) {
  return (
    <div
      role="button"
      tabIndex={0}
      title={title}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => e.key === "Enter" && (onEnter ?? onClick)?.()}
      className={cn("flex h-[24px] cursor-default items-center gap-1.5 ps-7 pe-2 text-[11.5px]", active ? "bg-ember-soft/60 text-fg" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}
    >
      {children}
    </div>
  );
}

export function Navigator() {
  const T = useTerminal();
  const t = useT();
  const tab = T.activeTab;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader icon={<Compass />} title={t("market.nav.title")} />
      <div className="t-scroll min-h-0 flex-1 overflow-y-auto py-1">
        <Group icon={<UserRound />} title={t("common.accounts")} count={T.accounts.length}>
          {T.guest && (
            <>
              <Leaf title={t("trader.guest.title")}>
                <Badge className="h-[15px] px-1 text-[8.5px]">{t("market.nav.guest")}</Badge>
                <span className="truncate text-fg-3">{t("market.nav.noAccount")}</span>
              </Leaf>
              <Leaf onClick={openRegister} title={t("market.nav.openAccountTitle")}>
                <span className="text-ember">{t("market.nav.openAccount")}</span>
              </Leaf>
              <Leaf onClick={openSignIn} title={t("market.nav.signInTitle")}>
                <span>{t("market.nav.signIn")}</span>
              </Leaf>
            </>
          )}
          {T.accounts.map((a) => (
            <Leaf key={a.login} active={a.login === T.account.login} onDoubleClick={() => T.switchAccount(a.login)} onClick={() => a.login !== T.account.login && T.switchAccount(a.login)} title={`${a.server} · ${a.group} · ${a.mode}`}>
              <Badge tone={a.type === "live" ? "ember" : "gold"} className="h-[15px] px-1 text-[8.5px]">
                {t.dyn(`market.nav.accountType.${a.type}`, a.type)}
              </Badge>
              <span className="font-mono">{a.login}</span>
              <ProductBadge account={a} className="h-[15px] px-1 text-[8.5px]" />
              <span className="truncate text-fg-3">
                {a.group}
                {a.cent ? " · USC" : ""}
              </span>
            </Leaf>
          ))}
        </Group>
        <Group icon={<Spline />} title={t("market.nav.indicators")} count={INDICATOR_LIST.length}>
          {INDICATOR_CATEGORIES.map((cat) => (
            <div key={cat}>
              <div className="pb-0.5 ps-7 pt-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">{t.dyn(`market.nav.category.${cat.replace(/\s+/g, "").replace(/^./, (c) => c.toLowerCase())}`, cat)}</div>
              {INDICATOR_LIST.filter((d) => d.category === cat).map((d) => {
                const n = tab.indicators.filter((x) => x.type === d.type).length;
                return (
                  <Leaf key={d.type} active={n > 0} title={t("market.nav.indicatorTitle", { description: d.description, symbol: tab.symbol, tf: tab.tf })} onDoubleClick={() => addIndicator(T, tab.id, d.type)} onEnter={() => addIndicator(T, tab.id, d.type)}>
                    <span className={cn("size-1.5 shrink-0 rounded-full", n ? "bg-ember" : "bg-fg-3/50")} />
                    <span className="min-w-0 flex-1 truncate">{d.name}</span>
                    {n > 0 && <span className="k-num font-mono text-[10px] text-ember">{n}</span>}
                  </Leaf>
                );
              })}
            </div>
          ))}
        </Group>
        {!T.guest && (
        <>
        <Group icon={<Bot />} title={t("market.nav.strategies")} count={MY_STRATEGIES.length}>
          {MY_STRATEGIES.map((s) => (
            <Leaf
              key={s.id}
              title={t("market.nav.strategyTitle", { server: s.server, login: s.login, count: s.trades })}
              onDoubleClick={() => {
                T.log("Experts", `${s.name} (${s.rules.symbol ?? tab.symbol},${tab.tf}) ${s.status === "running" ? "is running" : "loaded successfully"} on '${s.login}'`);
                toast(s.status === "running" ? t("market.nav.strategyRunning", { name: s.name }) : t("market.nav.strategyAttached", { name: s.name }), { description: t("market.nav.strategyDesc", { login: s.login, server: s.server, pnl: `${s.pnlToday >= 0 ? "+" : ""}${s.pnlToday.toFixed(2)}` }) });
              }}
            >
              <span className={cn("size-1.5 shrink-0 rounded-full", s.status === "running" ? "bg-up" : "bg-fg-3/50")} />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span dir="ltr" className={cn("k-num font-mono text-[10px]", s.pnlToday > 0 ? "text-up" : s.pnlToday < 0 ? "text-down" : "text-fg-3")}>{s.pnlToday === 0 ? "—" : `${s.pnlToday > 0 ? "+" : ""}${s.pnlToday.toFixed(0)}`}</span>
            </Leaf>
          ))}
        </Group>
        <Group icon={<FileCode2 />} title={t("market.nav.scripts")} count={5} defaultOpen={false}>
          {[
            { n: "Close all positions", k: "market.nav.script.closeAll" as const, f: () => T.bulkClose("all") },
            { n: "Close profitable", k: "market.nav.script.closeProfitable" as const, f: () => T.bulkClose("profit") },
            { n: "Close losing", k: "market.nav.script.closeLosing" as const, f: () => T.bulkClose("loss") },
            { n: "Delete all pendings", k: "market.nav.script.deletePendings" as const, f: () => T.cancelAllPendings() },
            { n: "Breakeven all (SL → entry)", k: "market.nav.script.breakevenAll" as const, f: () => T.positions.forEach((p) => T.modifyPosition(p.ticket, { sl: p.openPrice })) },
          ].map((s) => (
            <Leaf
              key={s.n}
              title={t("market.nav.scriptTitle")}
              onDoubleClick={() => {
                if (T.readOnly) return void toast.error(t("market.nav.scriptsReadOnly"));
                T.log("Experts", `script ${s.n} (${tab.symbol},${tab.tf}) loaded successfully`);
                s.f();
              }}
            >
              <FileCode2 className="size-3 text-fg-3" />
              <span className="truncate">{t(s.k)}</span>
            </Leaf>
          ))}
        </Group>
        </>
        )}
      </div>
    </div>
  );
}
