"use client";

// Top bar of Ezymex Trader on desktop (docs/TERMINAL-DESIGN.md §2.2): ☰ · brand · search (⌘K) · account switcher
// with equity · Deposit / Top up demo · notifications · profile. The ☰ menu (MT5 web style) holds the accounts, chart
// settings and one-click trading (CFD accounts), theme, language, shortcuts and help; every command is also in ⌘K.
// CFD or Options is the account's product (its badge here), not a switch: an Options account opens the options
// workspace.
import * as React from "react";
import { ArrowUpRight, ChevronDown, LogIn, LogOut, Menu, RefreshCw, Search, UserPlus, UserRound, Wallet } from "lucide-react";
import { ME } from "@ezymex/mock";
import { Avatar, LogoMark, cn } from "@ezymex/ui";
import { useT } from "@ezymex/i18n/react";
import { useMetrics, useTerminal } from "@/lib/store";
import { accCcy, accMoney } from "@/lib/trading";
import { productOf } from "@/lib/options/mode";
import { DropMenu } from "@/components/ui/menu";
import { Badge, LiveMoney } from "@/components/ui/primitives";
import { Button, IconButton, Tip } from "@/components/ui/kit";
import { Kbd } from "@/components/dialogs/kbd";
import { CLIENT_AREA, LOGIN_URL, REGISTER_URL } from "@/lib/guest";
import { GuestUserMenu } from "./guest";
import { NotificationBell } from "./notifications";
import { useMainMenuItems } from "./commands";

export { CLIENT_AREA };
export { PRESETS, toggleFullscreen } from "./commands";

/** CFD / OPTIONS: what an account trades (an Options account opens the options workspace). */
export function ProductBadge({ account, className }: { account: { product?: string | null }; className?: string }) {
  const t = useT();
  const options = productOf(account) === "options";
  return (
    <Badge tone={options ? "info" : "neutral"} className={className}>
      {options ? t("accounts.product.options") : t("accounts.product.cfd")}
    </Badge>
  );
}

/** DEMO / LIVE, CFD / OPTIONS (+ cent, read-only) badges of the active account. */
export function AccountBadges({ className }: { className?: string }) {
  const T = useTerminal();
  const t = useT();
  const a = T.account;
  return (
    <span className={cn("flex items-center gap-1", className)}>
      <Badge tone={a.type === "live" ? "ember" : "gold"}>{t.dyn(`trader.accountType.${a.type}`, a.type)}</Badge>
      <ProductBadge account={a} />
      {a.cent && <Badge tone="info">{t("desk.top.badge.cent")}</Badge>}
      {T.readOnly && <Badge tone="warn">{t("desk.top.badge.readOnly")}</Badge>}
    </span>
  );
}

function AccountRow({ login, active, onPick }: { login: string; active: boolean; onPick: () => void }) {
  const m = useMetrics(login);
  const t = useT();
  const a = m.account;
  return (
    <button onClick={onPick} aria-current={active || undefined} className={cn("flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-start transition-colors", active ? "bg-ember-soft/70" : "hover:bg-surface-3")}>
      <Badge tone={a.type === "live" ? "ember" : "gold"} className="w-12 justify-center">
        {t.dyn(`trader.accountType.${a.type}`, a.type)}
      </Badge>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[13px] text-fg">
          <span className="k-num font-mono">{a.login}</span>
          <ProductBadge account={a} />
          {a.nickname && <span className="truncate text-[12px] text-fg-3">· {a.nickname}</span>}
        </span>
        <span className="block truncate text-[12px] text-fg-3" title={`${t.dyn(`desk.g.${a.mode}`)} ${t("desk.g.leverage")}`}>
          {a.group} · {t.dyn(`order.mode.${a.mode}`, a.mode)} · 1:{a.leverage} · {a.server}
        </span>
      </span>
      <span className="text-end">
        <span className="block font-mono text-[13px] text-fg">
          <LiveMoney value={m.equity} format={(v) => accMoney(a, v)} />
        </span>
        <span className="block text-[11px] text-fg-3">{t("trader.account.equity", { ccy: accCcy(a) })}</span>
      </span>
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
      width={420}
      align="end"
      trigger={({ toggle, open }) => (
        <button
          onClick={toggle}
          data-tour="account"
          className={cn("flex h-8 min-w-0 items-center gap-2 rounded-[9px] border border-line bg-panel-2/70 ps-1.5 pe-2 text-start transition-colors hover:bg-surface-3", open && "bg-surface-3")}
          aria-label={t("trader.account.switch")}
          aria-expanded={open}
          title={`${a.group} · ${t.dyn(`order.mode.${a.mode}`, a.mode)} · ${t.dyn(`desk.g.${a.mode}`)}`}
        >
          <AccountBadges />
          <span className="k-num font-mono text-[12.5px] text-fg-2">{a.login}</span>
          <span className="hidden h-4 w-px bg-line min-[1180px]:block" aria-hidden />
          <span className="hidden items-center gap-1.5 min-[1180px]:flex">
            <Wallet className="size-3.5 text-fg-3" />
            <span className="font-mono text-[13px] font-medium text-fg">
              <LiveMoney value={m.equity} format={(v) => `${accMoney(a, v)} ${accCcy(a)}`} />
            </span>
          </span>
          <ChevronDown className={cn("size-3.5 shrink-0 text-fg-3 transition-transform", open && "rotate-180")} />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <div className="text-[14px] font-semibold text-fg">{t("desk.acc.title")}</div>
              <div className="text-[12px] text-fg-3">{T.engine ? t("trader.account.listDevice") : t("trader.account.listUser", { name: ME.name })}</div>
            </div>
            <div className="text-end">
              <div className="text-[11.5px] text-fg-3">{t("desk.top.balance")}</div>
              <div className="font-mono text-[13px] text-fg">
                {accMoney(a, m.balance)} {accCcy(a)}
              </div>
            </div>
          </div>
          <div className="t-scroll max-h-[50vh] space-y-0.5 overflow-y-auto p-1.5">
            {T.accounts.map((x) => (
              <AccountRow key={x.login} login={x.login} active={x.login === a.login} onPick={() => (T.switchAccount(x.login), close())} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5 border-t border-line p-2">
            {a.type === "demo" ? (
              <Button variant="secondary" onClick={() => (T.refillDemo(), close())} className="justify-start">
                <RefreshCw /> {t("trader.account.refillDemo", { count: T.refillsLeft })}
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => (window.open(`${CLIENT_AREA}/wallet`, "_blank"), close())} className="justify-start">
                <Wallet /> {t("desk.top.deposit")}
              </Button>
            )}
            <Button variant="secondary" onClick={() => (window.open(`${CLIENT_AREA}/accounts`, "_blank"), close())} className="justify-start">
              <UserPlus /> {t("desk.acc.openNew")}
            </Button>
            {T.engine && (
              <Button variant="ghost" onClick={() => (T.openLogin(), close())} className="justify-start">
                <LogIn /> {t("desk.acc.logInAnother")}
              </Button>
            )}
            <Button variant="ghost" onClick={() => (window.open(`${CLIENT_AREA}/accounts`, "_blank"), close())} className="justify-start">
              {t("desk.acc.manage")} <ArrowUpRight />
            </Button>
            {T.engine && (
              <Button variant="danger" onClick={() => (T.logout(), close())} className="col-span-2 justify-start border-transparent">
                <LogOut /> {t("desk.acc.logOut", { login: a.login })}
              </Button>
            )}
          </div>
        </div>
      )}
    </DropMenu>
  );
}

/** The one filled button of the bar: Deposit (live) or Top up demo (demo). */
function FundButton() {
  const T = useTerminal();
  const t = useT();
  if (T.account.type === "demo")
    return (
      <Button variant="primary" size="lg" tip={t("desk.top.topUpDemoHint", { count: T.refillsLeft })} onClick={() => T.refillDemo()}>
        <RefreshCw /> <span className="hidden min-[1200px]:inline">{t("desk.top.topUpDemo")}</span>
      </Button>
    );
  return (
    <Tip content={t("desk.top.depositHint")}>
      <a href={`${CLIENT_AREA}/wallet`} target="_blank" rel="noreferrer" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] bg-accent-strong px-3 text-[13px] font-semibold text-white transition hover:brightness-110 [&_svg]:size-4">
        <Wallet /> {t("desk.top.deposit")}
      </a>
    </Tip>
  );
}

function GuestActionsBar() {
  const t = useT();
  return (
    <>
      <span className="hidden h-8 items-center gap-2 rounded-[9px] border border-line bg-panel-2/70 px-2.5 min-[1200px]:flex">
        <Badge>{t("desk.top.guestChip")}</Badge>
        <span className="text-[12.5px] text-fg-2">{t("desk.top.guestLive")}</span>
      </span>
      <a href={REGISTER_URL} target="_blank" rel="noreferrer" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-line px-3 text-[13px] font-medium text-fg-2 hover:bg-surface-3 hover:text-fg [&_svg]:size-4">
        <UserPlus /> {t("desk.top.openAccount")}
      </a>
      <a href={LOGIN_URL} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] bg-accent-strong px-3 text-[13px] font-semibold text-white hover:brightness-110 [&_svg]:size-4">
        <LogIn /> {t("desk.top.logIn")}
      </a>
    </>
  );
}

/** ☰ at the far left (MT5 web): accounts, chart settings, one-click trading, theme, language, shortcuts, help. */
function MainMenu() {
  const t = useT();
  const items = useMainMenuItems();
  return (
    <DropMenu
      width={300}
      items={items}
      trigger={({ toggle, open }) => (
        <IconButton label={t("desk.menu.title")} onClick={toggle} aria-expanded={open} active={open || undefined} data-tour="menu" size="lg">
          <Menu />
        </IconButton>
      )}
    />
  );
}

function ProfileMenu() {
  const T = useTerminal();
  const t = useT();
  const a = T.account;
  return (
    <DropMenu
      align="end"
      width={260}
      items={[
        { header: T.engine ? `${a.nickname ? `${a.nickname} · ` : ""}${a.login} · ${t.dyn(`trader.accountType.${a.type}`, a.type)}` : `${ME.name} · ${ME.email}` },
        { label: t("trader.account.connectedTo", { server: a.server }), icon: <UserRound />, disabled: true },
        { label: t("trader.clientArea"), icon: <ArrowUpRight />, onSelect: () => window.open(CLIENT_AREA, "_blank") },
        { label: t("trader.account.profileSecurity"), icon: <ArrowUpRight />, onSelect: () => window.open(`${CLIENT_AREA}/profile`, "_blank") },
        "sep",
        { label: t("trader.menu.logOut"), icon: <LogOut />, danger: true, onSelect: () => T.logout() },
      ]}
      trigger={({ toggle }) => (
        <Tip content={t("desk.top.profile")} side="bottom">
          <button onClick={toggle} className="ms-0.5 grid size-8 shrink-0 place-items-center rounded-full ring-1 ring-line transition hover:ring-ember/50" aria-label={t("trader.accountMenu")}>
            {T.engine ? (
              <span className="grid size-8 place-items-center rounded-full bg-surface-3 text-fg-2">
                <UserRound className="size-4" />
              </span>
            ) : (
              <Avatar src={ME.photo} name={ME.name} size={32} />
            )}
          </button>
        </Tip>
      )}
    />
  );
}

export function TitleBar() {
  const T = useTerminal();
  const t = useT();
  return (
    <header className="t-glass-strong relative z-20 flex h-12 shrink-0 items-center gap-3 border-b border-line px-2">
      <MainMenu />
      <div className="flex shrink-0 items-center gap-2">
        <span className="grid size-8 place-items-center rounded-[9px] border border-line-top bg-surface-3">
          <LogoMark size={15} className="text-fg" />
        </span>
        <span className="hidden text-[14px] font-semibold tracking-tight min-[1400px]:inline">
          Ezymex <span className="font-normal text-fg-2">Trader</span>
        </span>
      </div>
      <Tip content={t("desk.top.search")} shortcut="⌘K" side="bottom">
        <button
          onClick={() => T.setUi({ search: true })}
          data-tour="search"
          className="flex h-8 w-[clamp(170px,20vw,320px)] min-w-0 items-center gap-2 rounded-[9px] border border-line bg-panel-2/70 px-2.5 text-[13px] text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg-2"
          aria-label={t("desk.top.search")}
        >
          <Search className="size-3.5 shrink-0" />
          <span className="truncate">{t("desk.top.search")}</span>
          <span className="ms-auto shrink-0">
            <Kbd>⌘K</Kbd>
          </span>
        </button>
      </Tip>

      <div className="ms-auto flex min-w-0 items-center gap-1.5">
        {T.guest ? (
          <GuestActionsBar />
        ) : (
          <>
            <AccountSwitcher />
            <FundButton />
          </>
        )}
        <span className="mx-0.5 h-5 w-px bg-line" aria-hidden />
        <NotificationBell anchorToasts />
        {T.guest ? <GuestUserMenu /> : <ProfileMenu />}
      </div>
    </header>
  );
}
