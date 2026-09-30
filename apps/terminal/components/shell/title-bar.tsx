"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "@/lib/notify";
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
  Languages,
  Lock,
  LogIn,
  LogOut,
  Moon,
  RefreshCw,
  Rows2,
  Search,
  Settings2,
  ShoppingCart,
  Square,
  Sun,
  UserPlus,
  UserRound,
  Wallet,
  Zap,
} from "lucide-react";
import { ME, INSTRUMENTS } from "@kalks/mock";
import { Avatar, Flag, LogoMark, cn } from "@kalks/ui";
import { tr, useLocale, useT } from "@kalks/i18n/react";
import { LOCALES } from "@kalks/i18n/locales";
import type { MessageKey } from "@kalks/i18n";
import { useMetrics, useTerminal, type Layout, type Workspace } from "@/lib/store";
import { CHART_TYPES, TIMEFRAMES, accCcy, accMoney } from "@/lib/trading";
import { INDICATOR_CATEGORIES, INDICATOR_LIST } from "@/lib/indicators";
import { DropMenu, Floating, MenuList, type Anchor, type MenuItem } from "@/components/ui/menu";
import { Badge, LiveMoney } from "@/components/ui/primitives";
import { chartRegistry } from "@/components/chart/engine";
import { BUILTIN_TEMPLATES, addIndicator, applyTemplate, openIndicatorList, openSaveTemplate, useUserTemplates } from "@/components/chart/indicators/state";
import { Kbd } from "@/components/dialogs/kbd";
import { CLIENT_AREA, openRegister, openSignIn } from "@/lib/guest";
import { GuestAccountChip, GuestUserMenu } from "./guest";
import { NotificationBell } from "./notifications";
import { LanguageMenu } from "./language-menu";

export { CLIENT_AREA };

export function toggleFullscreen() {
  try {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  } catch {
    toast.error(tr("trader.toast.fullscreenUnavailable"));
  }
}

// name/hint are the English copies; the UI renders nameKey/hintKey.
export const PRESETS: { name: string; hint: string; nameKey: MessageKey; hintKey: MessageKey; patch: (w: Workspace) => Partial<Workspace> }[] = [
  { name: "Trading", hint: "Default", nameKey: "trader.preset.trading", hintKey: "trader.preset.tradingHint", patch: (w) => ({ layout: "1", panels: { ...w.panels, watch: true, right: true, toolbox: true, navigator: true }, rightTab: "order" }) },
  { name: "Chart focus", hint: "Charts only", nameKey: "trader.preset.chartFocus", hintKey: "trader.preset.chartFocusHint", patch: (w) => ({ layout: "1", panels: { ...w.panels, watch: false, right: false, toolbox: false } }) },
  { name: "Analysis", hint: "4 charts", nameKey: "trader.preset.analysis", hintKey: "trader.preset.analysisHint", patch: (w) => ({ layout: "4", panels: { ...w.panels, watch: true, right: false, toolbox: true, navigator: false } }) },
  { name: "Scalper", hint: "DOM + 2 charts", nameKey: "trader.preset.scalper", hintKey: "trader.preset.scalperHint", patch: (w) => ({ layout: "2v", panels: { ...w.panels, watch: true, right: true, toolbox: true, navigator: false }, rightTab: "depth" }) },
];

function useMenus(): { label: string; items: MenuItem[] }[] {
  const T = useTerminal();
  const t = useT();
  const lang = useLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const tab = T.activeTab;
  const userTpl = useUserTemplates();
  const applyPreset = (p: (typeof PRESETS)[number]) => {
    T.setWs((w) => p.patch(w));
    const next = p.patch(T.ws);
    if (next.layout) T.setLayout(next.layout);
    toast(t("trader.toast.layoutApplied", { name: t(p.nameKey) }));
  };
  return [
    {
      label: t("trader.menu.file"),
      items: [
        { label: t("trader.menu.newChart"), icon: <BarChart2 />, items: INSTRUMENTS.slice(0, 16).map((i) => ({ label: i.symbol, onSelect: () => T.addTab(i.symbol) })) },
        { label: t("trader.menu.closeChart"), disabled: T.ws.tabs.length <= 1, onSelect: () => T.closeTab(tab.id) },
        "sep",
        { label: t("trader.menu.profiles"), items: [{ label: t("trader.profile.default"), checked: T.ws.profile === "Default", onSelect: () => T.setWs({ profile: "Default" }) }, { label: t("trader.profile.scalping"), checked: T.ws.profile === "Scalping", onSelect: () => (T.setWs({ profile: "Scalping" }), applyPreset(PRESETS[3]!)) }, { label: t("trader.profile.analysis"), checked: T.ws.profile === "Analysis", onSelect: () => (T.setWs({ profile: "Analysis" }), applyPreset(PRESETS[2]!)) }] },
        { label: t("trader.menu.saveAsPicture"), icon: <Camera />, onSelect: () => chartRegistry.get(tab.id)?.screenshot() },
        "sep",
        ...(T.guest
          ? ([
              { label: t("trader.menu.loginToTrade"), icon: <LogIn />, onSelect: () => T.openLogin() },
              { label: t("trader.guest.openAccount"), icon: <UserPlus />, onSelect: openRegister },
              { label: t("trader.menu.signInClientArea"), icon: <UserRound />, onSelect: openSignIn },
              "sep",
              { label: t("trader.clientArea"), icon: <ArrowUpRight />, onSelect: () => window.open(CLIENT_AREA, "_blank") },
            ] as MenuItem[])
          : ([
              { label: t("trader.menu.loginToTrade"), icon: <UserRound />, onSelect: () => (T.engine ? T.openLogin() : T.logout()) },
              { label: t("trader.menu.openAnAccount"), icon: <ArrowUpRight />, onSelect: () => window.open(`${CLIENT_AREA}/accounts`, "_blank") },
              ...(T.account.type === "demo" ? [{ label: t("trader.menu.refillDemo", { count: T.refillsLeft }), icon: <RefreshCw />, onSelect: () => T.refillDemo() } as MenuItem] : []),
              "sep",
              { label: t("trader.clientArea"), icon: <ArrowUpRight />, onSelect: () => window.open(CLIENT_AREA, "_blank") },
              { label: t("trader.menu.logOut"), icon: <LogOut />, danger: true, onSelect: () => T.logout() },
            ] as MenuItem[])),
      ],
    },
    {
      label: t("trader.menu.view"),
      items: [
        { label: t("trader.panel.marketWatch"), checked: T.ws.panels.watch, hint: "Ctrl+M", onSelect: () => T.togglePanel("watch") },
        { label: t("trader.panel.navigator"), checked: T.ws.panels.navigator, hint: "Ctrl+N", onSelect: () => (T.togglePanel("navigator"), !T.ws.panels.watch && T.togglePanel("watch", true)) },
        { label: T.guest ? t("trader.menu.orderInfo") : t("trader.menu.orderDom"), checked: T.ws.panels.right, hint: "Ctrl+D", onSelect: () => T.togglePanel("right") },
        { label: t("trader.panel.toolbox"), checked: T.ws.panels.toolbox, hint: "Ctrl+T", onSelect: () => T.togglePanel("toolbox") },
        "sep",
        { label: t("trader.menu.layoutPresets"), items: PRESETS.map((p) => ({ label: t(p.nameKey), hint: t(p.hintKey), onSelect: () => applyPreset(p) })) },
        { label: t("trader.menu.theme"), icon: resolvedTheme === "light" ? <Sun /> : <Moon />, items: [{ label: t("trader.menu.themeDark"), checked: resolvedTheme !== "light", onSelect: () => setTheme("dark") }, { label: t("trader.menu.themeLight"), checked: resolvedTheme === "light", onSelect: () => setTheme("light") }] },
        { label: t("common.language"), icon: <Languages />, items: LOCALES.map((l) => ({ label: l.name, icon: <Flag country={l.flag} className="size-3.5" />, hint: l.code === "en" ? undefined : l.english, checked: lang.locale === l.code, onSelect: () => void lang.setLocale(l.code) })) },
        "sep",
        { label: t("trader.menu.fullScreen"), icon: <Expand />, hint: "F11", onSelect: toggleFullscreen },
        { label: t("trader.menu.resetWorkspace"), onSelect: () => T.resetWorkspace() },
      ],
    },
    {
      label: t("trader.menu.insert"),
      items: [
        { header: t("trader.menu.indicatorsHeader", { symbol: tab.symbol, tf: tab.tf }) },
        { label: t("trader.menu.indicatorsList"), hint: "Ctrl+I", onSelect: () => openIndicatorList(tab.id) },
        ...INDICATOR_CATEGORIES.map((cat) => ({ label: cat, items: INDICATOR_LIST.filter((d) => d.category === cat).map((d) => ({ label: d.name, onSelect: () => addIndicator(T, tab.id, d.type) })) })),
        "sep",
        {
          label: t("trader.menu.objects"),
          items: [
            { label: t("trader.menu.horizontalLine"), onSelect: () => T.setDrawTool("hline") },
            { label: t("trader.menu.trendLine"), onSelect: () => T.setDrawTool("trend") },
            { label: t("trader.menu.fibonacci"), onSelect: () => T.setDrawTool("fib") },
            { label: t("trader.menu.rectangle"), onSelect: () => T.setDrawTool("rect") },
          ],
        },
        { label: t("trader.menu.priceAlert"), icon: <Bell />, onSelect: () => (T.setWs({ toolboxTab: "alerts" }), T.togglePanel("toolbox", true)) },
      ],
    },
    {
      label: t("trader.menu.charts"),
      items: [
        ...CHART_TYPES.map((ct) => ({ label: ct === "candles" ? t("trader.chartType.candles") : ct === "bars" ? t("trader.chartType.bars") : ct === "line" ? t("trader.chartType.line") : t("trader.chartType.area"), checked: tab.type === ct, onSelect: () => T.updateTab(tab.id, { type: ct }) })),
        { label: t("trader.menu.timeframes"), items: TIMEFRAMES.map((tf) => ({ label: tf, checked: tab.tf === tf, onSelect: () => T.updateTab(tab.id, { tf }) })) },
        {
          label: t("trader.menu.templates"),
          items: [
            ...[...BUILTIN_TEMPLATES, ...userTpl].map((tp) => ({ label: tp.name, onSelect: () => applyTemplate(T, [tab.id], tp) })),
            "sep",
            { label: t("trader.menu.saveTemplate"), onSelect: () => openSaveTemplate(tab.id) },
          ],
        },
        "sep",
        {
          label: t("trader.menu.layout"),
          items: [
            { label: t("trader.layout.one"), hint: "Alt+1", checked: T.ws.layout === "1", onSelect: () => T.setLayout("1") },
            { label: t("trader.layout.twoH"), hint: "Alt+2", checked: T.ws.layout === "2h", onSelect: () => T.setLayout("2h") },
            { label: t("trader.layout.twoV"), hint: "Alt+3", checked: T.ws.layout === "2v", onSelect: () => T.setLayout("2v") },
            { label: t("trader.layout.four"), hint: "Alt+4", checked: T.ws.layout === "4", onSelect: () => T.setLayout("4") },
          ],
        },
        { label: t("trader.menu.newChartTab"), onSelect: () => T.addTab() },
        "sep",
        { label: t("trader.menu.zoomIn"), hint: "+", onSelect: () => chartRegistry.get(tab.id)?.zoom(1) },
        { label: t("trader.menu.zoomOut"), hint: "−", onSelect: () => chartRegistry.get(tab.id)?.zoom(-1) },
        { label: t("trader.menu.deleteAllObjects"), danger: true, disabled: !tab.drawings.length, onSelect: () => T.updateTab(tab.id, { drawings: [] }) },
      ],
    },
    {
      label: t("trader.menu.tools"),
      items: [
        { label: t("trader.newOrder"), icon: <ShoppingCart />, hint: "F9", disabled: T.readOnly, onSelect: () => T.openNewOrder() },
        ...(T.guest
          ? []
          : ([
              { label: t("trader.menu.oneClickTrading"), icon: <Zap />, hint: "F10", checked: T.ws.oneClick, disabled: T.readOnly, onSelect: () => T.setWs({ oneClick: !T.ws.oneClick }) },
              { label: t("trader.menu.soundOnFills"), checked: T.ws.sound, onSelect: () => (T.setWs({ sound: !T.ws.sound }), toast(T.ws.sound ? t("trader.toast.soundsOff") : t("trader.toast.soundsOn"))) },
              {
                label: T.ws.maxDeviation === null ? t("trader.menu.maxDeviationAny") : t("trader.menu.maxDeviation", { count: T.ws.maxDeviation }),
                items: [null, 0, 3, 5, 10, 20, 50, 100].map((d) => ({ label: d === null ? t("trader.menu.anyPrice") : t("trader.menu.points", { count: d }), checked: T.ws.maxDeviation === d, onSelect: () => (T.setWs({ maxDeviation: d }), T.log("Terminal", d === null ? "max deviation: any price (market execution)" : `max deviation set to ${d} points`)) })),
              },
            ] as MenuItem[])),
        "sep",
        { label: t("trader.menu.priceAlerts"), icon: <Bell />, onSelect: () => (T.setWs({ toolboxTab: "alerts" }), T.togglePanel("toolbox", true)) },
        { label: t("trader.menu.history"), onSelect: () => (T.setWs({ toolboxTab: "history" }), T.togglePanel("toolbox", true)) },
        { label: t("trader.menu.journal"), onSelect: () => (T.setWs({ toolboxTab: "journal" }), T.togglePanel("toolbox", true)) },
        ...(T.guest ? [] : (["sep", { label: t("trader.menu.options"), icon: <Settings2 />, onSelect: () => T.setUi({ options: true }) }] as MenuItem[])),
      ],
    },
    {
      label: t("trader.menu.help"),
      items: [
        { label: t("trader.menu.keyboardShortcuts"), icon: <Keyboard />, hint: "F1", onSelect: () => T.setUi({ shortcuts: true }) },
        { label: t("trader.menu.helpTopics"), onSelect: () => window.open(`${CLIENT_AREA}/academy`, "_blank") },
        { label: t("trader.menu.contactSupport"), onSelect: () => window.open(`${CLIENT_AREA}/support`, "_blank") },
        "sep",
        { label: t("trader.menu.about"), onSelect: () => T.setUi({ about: true }) },
      ],
    },
  ];
}

function MenuBar() {
  const menus = useMenus();
  const t = useT();
  const [open, setOpen] = React.useState<number | null>(null);
  const [at, setAt] = React.useState<{ x: number; y: number; anchor?: Anchor }>({ x: 0, y: 0 });
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const show = (i: number) => {
    const r = refs.current[i]?.getBoundingClientRect();
    if (r) setAt({ x: r.left, y: r.bottom + 3, anchor: { left: r.left, top: r.top, right: r.left + 244, bottom: r.bottom } });
    setOpen(i);
  };
  const close = React.useCallback(() => setOpen(null), []);
  return (
    <nav className="flex items-center" aria-label={t("trader.mainMenu")}>
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
        <Floating x={at.x} y={at.y} anchor={at.anchor} onClose={close}>
          <MenuList items={menus[open]!.items} onClose={close} width={244} />
        </Floating>
      )}
    </nav>
  );
}

function AccountRow({ login, active, onPick }: { login: string; active: boolean; onPick: () => void }) {
  const m = useMetrics(login);
  const t = useT();
  const a = m.account;
  return (
    <button onClick={onPick} className={cn("flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-start transition-colors", active ? "bg-ember-soft/60" : "hover:bg-surface-3")}>
      <Badge tone={a.type === "live" ? "ember" : "gold"} className="w-11 justify-center">
        {t.dyn(`trader.accountType.${a.type}`, a.type)}
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
      <div className="text-end">
        <div className="font-mono text-[12px] text-fg"><LiveMoney value={m.equity} format={(v) => accMoney(a, v)} className="px-0.5" /></div>
        <div className="font-mono text-[10px] text-fg-3">{t("trader.account.equity", { ccy: accCcy(a) })}</div>
      </div>
    </button>
  );
}

function AccountSwitcher() {
  const T = useTerminal();
  const t = useT();
  const m = useMetrics();
  const a = T.account;
  return (
    <DropMenu
      width={380}
      align="end"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} className={cn("flex h-8 items-center gap-2 rounded-[7px] border border-line bg-surface-2 ps-1.5 pe-2 text-start transition-colors hover:bg-surface-3", open && "bg-surface-3")} aria-label={t("trader.account.switch")}>
          <Badge tone={a.type === "live" ? "ember" : "gold"}>{t.dyn(`trader.accountType.${a.type}`, a.type)}</Badge>
          <span className="leading-none">
            <span className="block font-mono text-[12px] text-fg">{a.login}</span>
            <span className="block text-[10px] text-fg-3">
              {a.group} · {a.mode}
            </span>
          </span>
          <span className="hidden border-s border-line ps-2 text-end leading-none 2xl:block">
            <span className="block font-mono text-[12px] text-fg"><LiveMoney value={m.equity} format={(v) => accMoney(a, v)} /></span>
            <span className="block text-[10px] text-fg-3">{accCcy(a)}</span>
          </span>
          <ChevronDown className="size-3.5 text-fg-3" />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="border-b border-line px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">{T.engine ? t("trader.account.listDevice") : t("trader.account.listUser", { name: ME.name })}</div>
          <div className="space-y-0.5 p-1">
            {T.accounts.map((x) => (
              <AccountRow key={x.login} login={x.login} active={x.login === a.login} onPick={() => (T.switchAccount(x.login), close())} />
            ))}
          </div>
          {T.engine && (
            <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[11.5px]">
              <button onClick={() => (T.openLogin(), close())} className="flex items-center gap-1.5 text-fg-2 hover:text-fg">
                <LogIn className="size-3" /> {t("trader.account.logInAnother")}
              </button>
              <button onClick={() => (T.logout(), close())} className="flex items-center gap-1.5 text-fg-3 hover:text-down">
                <LogOut className="size-3" /> {t("trader.account.logOutOf", { login: a.login })}
              </button>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[11.5px]">
            {a.type === "demo" ? (
              <button onClick={() => (T.refillDemo(), close())} className="flex items-center gap-1.5 text-gold hover:underline">
                <RefreshCw className="size-3" /> {t("trader.account.refillDemo", { count: T.refillsLeft })}
              </button>
            ) : (
              <a href={`${CLIENT_AREA}/wallet`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-fg-2 hover:text-fg">
                <Wallet className="size-3" /> {t("common.deposit")}
              </a>
            )}
            <a href={`${CLIENT_AREA}/accounts`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-fg-2 hover:text-fg">
              {t("trader.account.manage")} <ArrowUpRight className="size-3" />
            </a>
          </div>
        </div>
      )}
    </DropMenu>
  );
}

const LAYOUTS: { id: Layout; label: MessageKey; hint: string; icon: React.ReactNode }[] = [
  { id: "1", label: "trader.layout.one", hint: "Alt+1", icon: <Square /> },
  { id: "2h", label: "trader.layout.twoH", hint: "Alt+2", icon: <Columns2 /> },
  { id: "2v", label: "trader.layout.twoV", hint: "Alt+3", icon: <Rows2 /> },
  { id: "4", label: "trader.layout.four", hint: "Alt+4", icon: <Grid2x2 /> },
];

export function TitleBar() {
  const T = useTerminal();
  const t = useT();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const dark = !mounted || resolvedTheme !== "light";
  const a = T.account;
  return (
    <header className="relative z-20 flex h-11 shrink-0 items-center gap-2 border-b border-line bg-panel px-2.5">
      <div className="flex shrink-0 items-center gap-2 pe-1.5">
        <span className="grid size-7 place-items-center rounded-[7px] border border-line-top bg-surface-3">
          <LogoMark size={13} className="text-fg" />
        </span>
        <span className="hidden text-[13.5px] font-semibold tracking-tight lg:inline">
          Kalks <span className="font-normal text-fg-2">Trader</span>
        </span>
      </div>
      <MenuBar />

      <div className="ms-auto flex min-w-0 items-center gap-1.5">
        {a.cent && <Badge tone="info">{t("trader.badge.cent")}</Badge>}
        {T.readOnly && <Badge tone="warn">{t("trader.badge.readOnly")}</Badge>}
        {T.guest ? <GuestAccountChip /> : <AccountSwitcher />}
        <button onClick={() => T.setUi({ search: true })} className="hidden h-8 w-[180px] items-center gap-2 rounded-[7px] border border-line bg-surface-2 px-2.5 text-[12px] text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg-2 xl:flex" aria-label={t("trader.searchSymbols")}>
          <Search className="size-3.5" />
          {t("trader.searchSymbol")}
          <span className="ms-auto">
            <Kbd>⌘K</Kbd>
          </span>
        </button>
        <button onClick={() => T.setUi({ search: true })} className="grid size-8 place-items-center rounded-[7px] text-fg-2 hover:bg-surface-3 xl:hidden" aria-label={t("trader.searchSymbols")}>
          <Search className="size-4" />
        </button>
        {T.guest && (
          <button onClick={() => T.openNewOrder()} title={t("trader.guest.text")} className="flex h-8 items-center gap-1.5 rounded-[7px] border border-line bg-surface-2 px-3 text-[12px] font-semibold text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg-2">
            <Lock className="size-3.5" />
            {t("trader.newOrder")}
          </button>
        )}
        {!T.readOnly && !T.guest && (
          <>
            <button onClick={() => T.openNewOrder()} className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[7px] bg-ember px-3 text-[12px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(255,90,31,0.8)] transition hover:brightness-110">
              <ShoppingCart className="size-3.5" />
              {t("trader.newOrder")}
              <span className="rounded-[3px] bg-white/20 px-1 font-mono text-[9.5px]">F9</span>
            </button>
            <button
              onClick={() => T.setWs({ oneClick: !T.ws.oneClick })}
              title={t("trader.oneClick.title")}
              className={cn("flex h-8 items-center gap-1.5 rounded-[7px] border px-2.5 text-[11.5px] font-medium transition-colors", T.ws.oneClick ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-3 hover:text-fg-2")}
            >
              <Zap className={cn("size-3.5", T.ws.oneClick && "fill-ember")} />
              <span className="hidden 2xl:inline">{t("trader.oneClick.short")}</span>
              <span className="font-mono text-[10px]">{T.ws.oneClick ? t("trader.oneClick.on") : t("trader.oneClick.off")}</span>
            </button>
          </>
        )}
        <div className="flex items-center rounded-[7px] border border-line bg-surface-2 p-0.5">
          {LAYOUTS.map((l) => (
            <button key={l.id} title={`${t(l.label)} (${l.hint})`} aria-label={`${t(l.label)} (${l.hint})`} onClick={() => T.setLayout(l.id)} className={cn("grid size-6 place-items-center rounded-[5px] [&_svg]:size-3.5", T.ws.layout === l.id ? "bg-surface-3 text-ember" : "text-fg-3 hover:text-fg")}>
              {l.icon}
            </button>
          ))}
        </div>
        <NotificationBell />
        <LanguageMenu />
        <button onClick={() => setTheme(dark ? "light" : "dark")} className="grid size-8 place-items-center rounded-[7px] text-fg-2 hover:bg-surface-3 hover:text-fg" aria-label={t("trader.toggleTheme")} title={t("trader.menu.theme")}>
          {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </button>
        <button onClick={toggleFullscreen} className="grid size-8 place-items-center rounded-[7px] text-fg-2 hover:bg-surface-3 hover:text-fg" aria-label={t("trader.fullscreen")} title={t("trader.fullscreenHint")}>
          <Expand className="size-4" />
        </button>
        <a href={CLIENT_AREA} target="_blank" rel="noreferrer" className="hidden h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-[7px] px-2 text-[12px] text-fg-2 hover:bg-surface-3 hover:text-fg 2xl:flex">
          {t("trader.clientArea")} <ArrowUpRight className="size-3.5" />
        </a>
        {T.guest ? (
          <GuestUserMenu />
        ) : (
        <DropMenu
          align="end"
          width={240}
          items={[
            { header: T.engine ? `${a.nickname ? `${a.nickname} · ` : ""}${a.login} · ${t.dyn(`trader.accountType.${a.type}`, a.type)}` : `${ME.name} · ${ME.email}` },
            { label: t("trader.account.connectedTo", { server: a.server }), icon: <UserRound />, disabled: true },
            { label: t("trader.clientArea"), icon: <ArrowUpRight />, onSelect: () => window.open(CLIENT_AREA, "_blank") },
            { label: t("trader.account.profileSecurity"), onSelect: () => window.open(`${CLIENT_AREA}/profile`, "_blank") },
            { label: t("trader.account.keyboardShortcuts"), icon: <Keyboard />, hint: "F1", onSelect: () => T.setUi({ shortcuts: true }) },
            "sep",
            { label: t("trader.menu.logOut"), icon: <LogOut />, danger: true, onSelect: () => T.logout() },
          ]}
          trigger={({ toggle }) => (
            <button onClick={toggle} className="ms-0.5 rounded-full ring-1 ring-line transition hover:ring-ember/50" aria-label={t("trader.accountMenu")}>
              {T.engine ? (
                <span className="grid size-7 place-items-center rounded-full bg-surface-3 text-fg-2">
                  <UserRound className="size-4" />
                </span>
              ) : (
                <Avatar src={ME.photo} name={ME.name} size={28} />
              )}
            </button>
          )}
        />
        )}
      </div>
    </header>
  );
}
