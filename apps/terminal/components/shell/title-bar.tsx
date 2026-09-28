"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  ArrowUpRight,
  BarChart2,
  Bell,
  Camera,
  ChevronDown,
  Columns2,
  Expand,
  Grid2x2,
  Keyboard,
  LogOut,
  Moon,
  RefreshCw,
  Rows2,
  Search,
  ShoppingCart,
  Square,
  Sun,
  UserRound,
  Wallet,
  Zap,
} from "lucide-react";
import { ME, INSTRUMENTS } from "@kalks/mock";
import { Avatar, LogoMark, cn } from "@kalks/ui";
import { useMetrics, useTerminal, type Layout, type Workspace } from "@/lib/store";
import { CHART_TYPES, TIMEFRAMES, accCcy, accMoney } from "@/lib/trading";
import { INDICATOR_CATEGORIES, INDICATOR_LIST } from "@/lib/indicators";
import { DropMenu, Floating, MenuList, type MenuItem } from "@/components/ui/menu";
import { Badge, LiveMoney } from "@/components/ui/primitives";
import { chartRegistry } from "@/components/chart/engine";
import { BUILTIN_TEMPLATES, addIndicator, applyTemplate, openIndicatorList, openSaveTemplate, useUserTemplates } from "@/components/chart/indicators/state";
import { Kbd } from "@/components/dialogs/kbd";

export const CLIENT_AREA = process.env.NEXT_PUBLIC_CLIENT_AREA_URL ?? "http://localhost:3000";

export function toggleFullscreen() {
  try {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  } catch {
    toast.error("Fullscreen is not available");
  }
}

export const PRESETS: { name: string; hint: string; patch: (w: Workspace) => Partial<Workspace> }[] = [
  { name: "Trading", hint: "Default", patch: (w) => ({ layout: "1", panels: { ...w.panels, watch: true, right: true, toolbox: true, navigator: true }, rightTab: "order" }) },
  { name: "Chart focus", hint: "Charts only", patch: (w) => ({ layout: "1", panels: { ...w.panels, watch: false, right: false, toolbox: false } }) },
  { name: "Analysis", hint: "4 charts", patch: (w) => ({ layout: "4", panels: { ...w.panels, watch: true, right: false, toolbox: true, navigator: false } }) },
  { name: "Scalper", hint: "DOM + 2 charts", patch: (w) => ({ layout: "2v", panels: { ...w.panels, watch: true, right: true, toolbox: true, navigator: false }, rightTab: "depth" }) },
];

function useMenus(): { label: string; items: MenuItem[] }[] {
  const T = useTerminal();
  const { resolvedTheme, setTheme } = useTheme();
  const tab = T.activeTab;
  const userTpl = useUserTemplates();
  const applyPreset = (p: (typeof PRESETS)[number]) => {
    T.setWs((w) => p.patch(w));
    const next = p.patch(T.ws);
    if (next.layout) T.setLayout(next.layout);
    toast(`Layout “${p.name}” applied`);
  };
  return [
    {
      label: "File",
      items: [
        { label: "New Chart", icon: <BarChart2 />, items: INSTRUMENTS.slice(0, 16).map((i) => ({ label: i.symbol, onSelect: () => T.addTab(i.symbol) })) },
        { label: "Close Chart", disabled: T.ws.tabs.length <= 1, onSelect: () => T.closeTab(tab.id) },
        "sep",
        { label: "Profiles", items: [{ label: "Default", checked: T.ws.profile === "Default", onSelect: () => T.setWs({ profile: "Default" }) }, { label: "Scalping", checked: T.ws.profile === "Scalping", onSelect: () => (T.setWs({ profile: "Scalping" }), applyPreset(PRESETS[3]!)) }, { label: "Analysis", checked: T.ws.profile === "Analysis", onSelect: () => (T.setWs({ profile: "Analysis" }), applyPreset(PRESETS[2]!)) }] },
        { label: "Save as Picture", icon: <Camera />, onSelect: () => chartRegistry.get(tab.id)?.screenshot() },
        "sep",
        { label: "Login to Trade Account…", icon: <UserRound />, onSelect: () => T.logout() },
        { label: "Open an Account", icon: <ArrowUpRight />, onSelect: () => window.open(`${CLIENT_AREA}/accounts`, "_blank") },
        ...(T.account.type === "demo" ? [{ label: `Refill demo balance (${T.refillsLeft} left)`, icon: <RefreshCw />, onSelect: () => T.refillDemo() } as MenuItem] : []),
        "sep",
        { label: "Client Area", icon: <ArrowUpRight />, onSelect: () => window.open(CLIENT_AREA, "_blank") },
        { label: "Log out", icon: <LogOut />, danger: true, onSelect: () => T.logout() },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Market Watch", checked: T.ws.panels.watch, hint: "Ctrl+M", onSelect: () => T.togglePanel("watch") },
        { label: "Navigator", checked: T.ws.panels.navigator, hint: "Ctrl+N", onSelect: () => (T.togglePanel("navigator"), !T.ws.panels.watch && T.togglePanel("watch", true)) },
        { label: "Order / DOM", checked: T.ws.panels.right, hint: "Ctrl+D", onSelect: () => T.togglePanel("right") },
        { label: "Toolbox", checked: T.ws.panels.toolbox, hint: "Ctrl+T", onSelect: () => T.togglePanel("toolbox") },
        "sep",
        { label: "Layout presets", items: PRESETS.map((p) => ({ label: p.name, hint: p.hint, onSelect: () => applyPreset(p) })) },
        { label: "Theme", icon: resolvedTheme === "light" ? <Sun /> : <Moon />, items: [{ label: "Dark", checked: resolvedTheme !== "light", onSelect: () => setTheme("dark") }, { label: "Light", checked: resolvedTheme === "light", onSelect: () => setTheme("light") }] },
        "sep",
        { label: "Full Screen", icon: <Expand />, hint: "F11", onSelect: toggleFullscreen },
        { label: "Reset workspace", onSelect: () => T.resetWorkspace() },
      ],
    },
    {
      label: "Insert",
      items: [
        { header: `Indicators · ${tab.symbol}, ${tab.tf}` },
        { label: "Indicators list…", hint: "Ctrl+I", onSelect: () => openIndicatorList(tab.id) },
        ...INDICATOR_CATEGORIES.map((cat) => ({ label: cat, items: INDICATOR_LIST.filter((d) => d.category === cat).map((d) => ({ label: d.name, onSelect: () => addIndicator(T, tab.id, d.type) })) })),
        "sep",
        {
          label: "Objects",
          items: [
            { label: "Horizontal Line", onSelect: () => T.setDrawTool("hline") },
            { label: "Trend Line", onSelect: () => T.setDrawTool("trend") },
            { label: "Fibonacci Retracement", onSelect: () => T.setDrawTool("fib") },
            { label: "Rectangle", onSelect: () => T.setDrawTool("rect") },
          ],
        },
        { label: "Price alert…", icon: <Bell />, onSelect: () => (T.setWs({ toolboxTab: "alerts" }), T.togglePanel("toolbox", true)) },
      ],
    },
    {
      label: "Charts",
      items: [
        ...CHART_TYPES.map((ct) => ({ label: ct === "candles" ? "Candlesticks" : ct === "bars" ? "Bar Chart" : ct === "line" ? "Line Chart" : "Area Chart", checked: tab.type === ct, onSelect: () => T.updateTab(tab.id, { type: ct }) })),
        { label: "Timeframes", items: TIMEFRAMES.map((tf) => ({ label: tf, checked: tab.tf === tf, onSelect: () => T.updateTab(tab.id, { tf }) })) },
        {
          label: "Templates",
          items: [
            ...[...BUILTIN_TEMPLATES, ...userTpl].map((tp) => ({ label: tp.name, onSelect: () => applyTemplate(T, [tab.id], tp) })),
            "sep",
            { label: "Save template…", onSelect: () => openSaveTemplate(tab.id) },
          ],
        },
        "sep",
        {
          label: "Layout",
          items: [
            { label: "1 chart", hint: "Alt+1", checked: T.ws.layout === "1", onSelect: () => T.setLayout("1") },
            { label: "2 side by side", hint: "Alt+2", checked: T.ws.layout === "2h", onSelect: () => T.setLayout("2h") },
            { label: "2 stacked", hint: "Alt+3", checked: T.ws.layout === "2v", onSelect: () => T.setLayout("2v") },
            { label: "4 grid", hint: "Alt+4", checked: T.ws.layout === "4", onSelect: () => T.setLayout("4") },
          ],
        },
        { label: "New Chart Tab", onSelect: () => T.addTab() },
        "sep",
        { label: "Zoom In", hint: "+", onSelect: () => chartRegistry.get(tab.id)?.zoom(1) },
        { label: "Zoom Out", hint: "−", onSelect: () => chartRegistry.get(tab.id)?.zoom(-1) },
        { label: "Delete all objects", danger: true, disabled: !tab.drawings.length, onSelect: () => T.updateTab(tab.id, { drawings: [] }) },
      ],
    },
    {
      label: "Tools",
      items: [
        { label: "New Order", icon: <ShoppingCart />, hint: "F9", disabled: T.readOnly, onSelect: () => T.openNewOrder() },
        { label: "One-Click Trading", icon: <Zap />, hint: "F10", checked: T.ws.oneClick, disabled: T.readOnly, onSelect: () => T.setWs({ oneClick: !T.ws.oneClick }) },
        { label: "Sound on fills", checked: T.ws.sound, onSelect: () => (T.setWs({ sound: !T.ws.sound }), toast(`Sounds ${T.ws.sound ? "off" : "on"}`)) },
        { label: `Max deviation · ${T.ws.deviation} pts`, items: [0, 3, 5, 10, 20, 50, 100].map((d) => ({ label: `${d} points`, checked: T.ws.deviation === d, onSelect: () => (T.setWs({ deviation: d }), T.log("Terminal", `max deviation set to ${d} points`)) })) },
        "sep",
        { label: "Price Alerts", icon: <Bell />, onSelect: () => (T.setWs({ toolboxTab: "alerts" }), T.togglePanel("toolbox", true)) },
        { label: "History", onSelect: () => (T.setWs({ toolboxTab: "history" }), T.togglePanel("toolbox", true)) },
        { label: "Journal", onSelect: () => (T.setWs({ toolboxTab: "journal" }), T.togglePanel("toolbox", true)) },
        "sep",
        { label: "Options…", onSelect: () => toast("Options", { description: "Server Kalks-Live01 · proxy off · news on · sounds " + (T.ws.sound ? "on" : "off") }) },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Keyboard Shortcuts", icon: <Keyboard />, hint: "F1", onSelect: () => T.setUi({ shortcuts: true }) },
        { label: "Help Topics", onSelect: () => window.open(`${CLIENT_AREA}/academy`, "_blank") },
        { label: "Contact Support", onSelect: () => window.open(`${CLIENT_AREA}/support`, "_blank") },
        "sep",
        { label: "About Kalks Trader", onSelect: () => T.setUi({ about: true }) },
      ],
    },
  ];
}

function MenuBar() {
  const menus = useMenus();
  const [open, setOpen] = React.useState<number | null>(null);
  const [at, setAt] = React.useState({ x: 0, y: 0 });
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const show = (i: number) => {
    const r = refs.current[i]?.getBoundingClientRect();
    if (r) setAt({ x: r.left, y: r.bottom + 3 });
    setOpen(i);
  };
  const close = React.useCallback(() => setOpen(null), []);
  return (
    <nav className="flex items-center" aria-label="Main menu">
      {menus.map((m, i) => (
        <button
          key={m.label}
          ref={(el) => {
            refs.current[i] = el;
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (open === i) close();
            else show(i);
          }}
          onMouseEnter={() => open !== null && open !== i && show(i)}
          className={cn("h-7 rounded-[5px] px-2 text-[12.5px] transition-colors", open === i ? "bg-surface-3 text-fg" : "text-fg-2 hover:bg-surface-3/70 hover:text-fg")}
        >
          {m.label}
        </button>
      ))}
      {open !== null && (
        <Floating x={at.x} y={at.y} onClose={close}>
          <MenuList items={menus[open]!.items} onClose={close} width={244} />
        </Floating>
      )}
    </nav>
  );
}

function AccountRow({ login, active, onPick }: { login: string; active: boolean; onPick: () => void }) {
  const m = useMetrics(login);
  const a = m.account;
  return (
    <button onClick={onPick} className={cn("flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left transition-colors", active ? "bg-ember-soft/60" : "hover:bg-surface-3")}>
      <Badge tone={a.type === "live" ? "ember" : "gold"} className="w-11 justify-center">
        {a.type}
      </Badge>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-mono text-[12.5px] text-fg">
          {a.login}
          {a.nickname && <span className="truncate font-sans text-[11px] text-fg-3">· {a.nickname}</span>}
        </div>
        <div className="text-[11px] text-fg-3">
          {a.group} · {a.mode} · 1:{a.leverage} · {a.server}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-[12px] text-fg"><LiveMoney value={m.equity} format={(v) => accMoney(a, v)} className="px-0.5" /></div>
        <div className="font-mono text-[10px] text-fg-3">{accCcy(a)} equity</div>
      </div>
    </button>
  );
}

function AccountSwitcher() {
  const T = useTerminal();
  const m = useMetrics();
  const a = T.account;
  return (
    <DropMenu
      width={380}
      align="end"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} className={cn("flex h-8 items-center gap-2 rounded-[7px] border border-line bg-surface-2 pl-1.5 pr-2 text-left transition-colors hover:bg-surface-3", open && "bg-surface-3")} aria-label="Switch account">
          <Badge tone={a.type === "live" ? "ember" : "gold"}>{a.type}</Badge>
          <span className="leading-none">
            <span className="block font-mono text-[12px] text-fg">{a.login}</span>
            <span className="block text-[10px] text-fg-3">
              {a.group} · {a.mode}
            </span>
          </span>
          <span className="hidden border-l border-line pl-2 text-right leading-none 2xl:block">
            <span className="block font-mono text-[12px] text-fg"><LiveMoney value={m.equity} format={(v) => accMoney(a, v)} /></span>
            <span className="block text-[10px] text-fg-3">{accCcy(a)}</span>
          </span>
          <ChevronDown className="size-3.5 text-fg-3" />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="border-b border-line px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">Trading accounts · {ME.name}</div>
          <div className="space-y-0.5 p-1">
            {T.accounts.map((x) => (
              <AccountRow key={x.login} login={x.login} active={x.login === a.login} onPick={() => (T.switchAccount(x.login), close())} />
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[11.5px]">
            {a.type === "demo" ? (
              <button onClick={() => (T.refillDemo(), close())} className="flex items-center gap-1.5 text-gold hover:underline">
                <RefreshCw className="size-3" /> Refill demo ({T.refillsLeft} left)
              </button>
            ) : (
              <a href={`${CLIENT_AREA}/wallet`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-fg-2 hover:text-fg">
                <Wallet className="size-3" /> Deposit
              </a>
            )}
            <a href={`${CLIENT_AREA}/accounts`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-fg-2 hover:text-fg">
              Manage accounts <ArrowUpRight className="size-3" />
            </a>
          </div>
        </div>
      )}
    </DropMenu>
  );
}

const LAYOUTS: { id: Layout; label: string; icon: React.ReactNode }[] = [
  { id: "1", label: "1 chart (Alt+1)", icon: <Square /> },
  { id: "2h", label: "2 side by side (Alt+2)", icon: <Columns2 /> },
  { id: "2v", label: "2 stacked (Alt+3)", icon: <Rows2 /> },
  { id: "4", label: "4 grid (Alt+4)", icon: <Grid2x2 /> },
];

export function TitleBar() {
  const T = useTerminal();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const dark = !mounted || resolvedTheme !== "light";
  const a = T.account;
  return (
    <header className="t-titlebar-glow relative z-20 flex h-11 shrink-0 items-center gap-2 border-b border-line bg-panel px-2.5">
      <div className="flex shrink-0 items-center gap-2 pr-1.5">
        <span className="grid size-7 place-items-center rounded-[7px] border border-line-top bg-surface-3 shadow-[0_0_16px_-6px_rgba(255,90,31,0.7)]">
          <LogoMark size={13} className="text-fg" />
        </span>
        <span className="hidden text-[13.5px] font-semibold tracking-tight lg:inline">
          Kalks <span className="font-normal text-fg-2">Trader</span>
        </span>
      </div>
      <MenuBar />

      <div className="ml-auto flex min-w-0 items-center gap-1.5">
        {a.cent && <Badge tone="info">Cent · USC</Badge>}
        {T.readOnly && <Badge tone="warn">Read-only</Badge>}
        <AccountSwitcher />
        <button onClick={() => T.setUi({ search: true })} className="hidden h-8 w-[180px] items-center gap-2 rounded-[7px] border border-line bg-surface-2 px-2.5 text-[12px] text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg-2 xl:flex" aria-label="Search symbols">
          <Search className="size-3.5" />
          Search symbol
          <span className="ml-auto">
            <Kbd>⌘K</Kbd>
          </span>
        </button>
        <button onClick={() => T.setUi({ search: true })} className="grid size-8 place-items-center rounded-[7px] text-fg-2 hover:bg-surface-3 xl:hidden" aria-label="Search symbols">
          <Search className="size-4" />
        </button>
        {!T.readOnly && (
          <>
            <button onClick={() => T.openNewOrder()} className="flex h-8 items-center gap-1.5 rounded-[7px] bg-ember px-3 text-[12px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(255,90,31,0.8)] transition hover:brightness-110">
              <ShoppingCart className="size-3.5" />
              New Order
              <span className="rounded-[3px] bg-white/20 px-1 font-mono text-[9.5px]">F9</span>
            </button>
            <button
              onClick={() => T.setWs({ oneClick: !T.ws.oneClick })}
              title="One-click trading (F10)"
              className={cn("flex h-8 items-center gap-1.5 rounded-[7px] border px-2.5 text-[11.5px] font-medium transition-colors", T.ws.oneClick ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-3 hover:text-fg-2")}
            >
              <Zap className={cn("size-3.5", T.ws.oneClick && "fill-ember")} />
              <span className="hidden 2xl:inline">One-click</span>
              <span className="font-mono text-[10px]">{T.ws.oneClick ? "ON" : "OFF"}</span>
            </button>
          </>
        )}
        <div className="flex items-center rounded-[7px] border border-line bg-surface-2 p-0.5">
          {LAYOUTS.map((l) => (
            <button key={l.id} title={l.label} aria-label={l.label} onClick={() => T.setLayout(l.id)} className={cn("grid size-6 place-items-center rounded-[5px] [&_svg]:size-3.5", T.ws.layout === l.id ? "bg-surface-3 text-ember" : "text-fg-3 hover:text-fg")}>
              {l.icon}
            </button>
          ))}
        </div>
        <button onClick={() => setTheme(dark ? "light" : "dark")} className="grid size-8 place-items-center rounded-[7px] text-fg-2 hover:bg-surface-3 hover:text-fg" aria-label="Toggle theme" title="Theme">
          {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </button>
        <button onClick={toggleFullscreen} className="grid size-8 place-items-center rounded-[7px] text-fg-2 hover:bg-surface-3 hover:text-fg" aria-label="Fullscreen" title="Fullscreen (F11)">
          <Expand className="size-4" />
        </button>
        <a href={CLIENT_AREA} target="_blank" rel="noreferrer" className="hidden h-8 items-center gap-1 rounded-[7px] px-2 text-[12px] text-fg-2 hover:bg-surface-3 hover:text-fg xl:flex">
          Client Area <ArrowUpRight className="size-3.5" />
        </a>
        <DropMenu
          align="end"
          width={240}
          items={[
            { header: `${ME.name} · ${ME.email}` },
            { label: `Connected to ${a.server}`, icon: <UserRound />, disabled: true },
            { label: "Client Area", icon: <ArrowUpRight />, onSelect: () => window.open(CLIENT_AREA, "_blank") },
            { label: "Profile & security", onSelect: () => window.open(`${CLIENT_AREA}/profile`, "_blank") },
            { label: "Keyboard shortcuts", icon: <Keyboard />, hint: "F1", onSelect: () => T.setUi({ shortcuts: true }) },
            "sep",
            { label: "Log out", icon: <LogOut />, danger: true, onSelect: () => T.logout() },
          ]}
          trigger={({ toggle }) => (
            <button onClick={toggle} className="ml-0.5 rounded-full ring-1 ring-line transition hover:ring-ember/50" aria-label="Account menu">
              <Avatar src={ME.photo} name={ME.name} size={28} />
            </button>
          )}
        />
      </div>
    </header>
  );
}
