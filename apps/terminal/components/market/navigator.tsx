"use client";

import * as React from "react";
import { toast } from "@/lib/notify";
import { Bot, ChevronDown, ChevronRight, Compass, FileCode2, Spline, UserRound } from "lucide-react";
import { MY_STRATEGIES } from "@kalks/mock/algo";
import { cn } from "@kalks/ui";
import { useTerminal } from "@/lib/store";
import { INDICATOR_CATEGORIES, INDICATOR_LIST } from "@/lib/indicators";
import { addIndicator } from "@/components/chart/indicators/state";
import { PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/primitives";
import { GUEST_TITLE, openRegister, openSignIn } from "@/lib/guest";

function Group({ icon, title, count, children, defaultOpen = true }: { icon: React.ReactNode; title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex h-6 w-full items-center gap-1 px-1.5 text-left text-[11.5px] font-medium text-fg-2 hover:text-fg">
        {open ? <ChevronDown className="size-3 text-fg-3" /> : <ChevronRight className="size-3 text-fg-3" />}
        <span className="text-fg-3 [&>svg]:size-3.5">{icon}</span>
        {title}
        {count !== undefined && <span className="ml-auto font-mono text-[10px] text-fg-3">{count}</span>}
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
      className={cn("flex h-[24px] cursor-default items-center gap-1.5 pl-7 pr-2 text-[11.5px]", active ? "bg-ember-soft/60 text-fg" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}
    >
      {children}
    </div>
  );
}

export function Navigator() {
  const T = useTerminal();
  const tab = T.activeTab;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader icon={<Compass />} title="Navigator" />
      <div className="t-scroll min-h-0 flex-1 overflow-y-auto py-1">
        <Group icon={<UserRound />} title="Accounts" count={T.accounts.length}>
          {T.guest && (
            <>
              <Leaf title={GUEST_TITLE}>
                <Badge className="h-[15px] px-1 text-[8.5px]">guest</Badge>
                <span className="truncate text-fg-3">No trading account yet</span>
              </Leaf>
              <Leaf onClick={openRegister} title="Create your Kalks account (opens the Client Area)">
                <span className="text-ember">Open account</span>
              </Leaf>
              <Leaf onClick={openSignIn} title="Sign in to the Client Area">
                <span>Sign in</span>
              </Leaf>
            </>
          )}
          {T.accounts.map((a) => (
            <Leaf key={a.login} active={a.login === T.account.login} onDoubleClick={() => T.switchAccount(a.login)} onClick={() => a.login !== T.account.login && T.switchAccount(a.login)} title={`${a.server} · ${a.group} · ${a.mode}`}>
              <Badge tone={a.type === "live" ? "ember" : "gold"} className="h-[15px] px-1 text-[8.5px]">
                {a.type}
              </Badge>
              <span className="font-mono">{a.login}</span>
              <span className="truncate text-fg-3">
                {a.group}
                {a.cent ? " · USC" : ""}
              </span>
            </Leaf>
          ))}
        </Group>
        <Group icon={<Spline />} title="Indicators" count={INDICATOR_LIST.length}>
          {INDICATOR_CATEGORIES.map((cat) => (
            <div key={cat}>
              <div className="pb-0.5 pl-7 pt-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">{cat}</div>
              {INDICATOR_LIST.filter((d) => d.category === cat).map((d) => {
                const n = tab.indicators.filter((x) => x.type === d.type).length;
                return (
                  <Leaf key={d.type} active={n > 0} title={`${d.description} · Double-click or Enter to attach to ${tab.symbol}, ${tab.tf}`} onDoubleClick={() => addIndicator(T, tab.id, d.type)} onEnter={() => addIndicator(T, tab.id, d.type)}>
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
        <Group icon={<Bot />} title="Strategies" count={MY_STRATEGIES.length}>
          {MY_STRATEGIES.map((s) => (
            <Leaf
              key={s.id}
              title={`${s.server} · ${s.login} · ${s.trades} trades`}
              onDoubleClick={() => {
                T.log("Experts", `${s.name} (${s.rules.symbol ?? tab.symbol},${tab.tf}) ${s.status === "running" ? "is running" : "loaded successfully"} on '${s.login}'`);
                toast(`${s.name} ${s.status === "running" ? "is already running" : "attached"}`, { description: `${s.login} · ${s.server} · P&L today ${s.pnlToday >= 0 ? "+" : ""}${s.pnlToday.toFixed(2)}` });
              }}
            >
              <span className={cn("size-1.5 shrink-0 rounded-full", s.status === "running" ? "t-live-dot bg-up" : "bg-fg-3/50")} />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className={cn("k-num font-mono text-[10px]", s.pnlToday > 0 ? "text-up" : s.pnlToday < 0 ? "text-down" : "text-fg-3")}>{s.pnlToday === 0 ? "—" : `${s.pnlToday > 0 ? "+" : ""}${s.pnlToday.toFixed(0)}`}</span>
            </Leaf>
          ))}
        </Group>
        <Group icon={<FileCode2 />} title="Scripts" count={5} defaultOpen={false}>
          {[
            { n: "Close all positions", f: () => T.bulkClose("all") },
            { n: "Close profitable", f: () => T.bulkClose("profit") },
            { n: "Close losing", f: () => T.bulkClose("loss") },
            { n: "Delete all pendings", f: () => T.cancelAllPendings() },
            { n: "Breakeven all (SL → entry)", f: () => T.positions.forEach((p) => T.modifyPosition(p.ticket, { sl: p.openPrice })) },
          ].map((s) => (
            <Leaf
              key={s.n}
              title="Double-click to run on the current account"
              onDoubleClick={() => {
                if (T.readOnly) return void toast.error("Scripts are disabled in read-only mode");
                T.log("Experts", `script ${s.n} (${tab.symbol},${tab.tf}) loaded successfully`);
                s.f();
              }}
            >
              <FileCode2 className="size-3 text-fg-3" />
              <span className="truncate">{s.n}</span>
            </Leaf>
          ))}
        </Group>
        </>
        )}
      </div>
    </div>
  );
}
