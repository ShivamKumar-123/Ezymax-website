"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowLeftRight, CandlestickChart, Check, Coins, KeyRound, Layers, Loader2, Lock, MoreHorizontal, MoreVertical, PencilLine, RefreshCcw, Gauge as GaugeIcon, Star, StarOff, Trash2, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, CopyButton, Dialog, IconButton, Menu, Money, cn, type ButtonProps } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";
import { useReadOnly } from "@/components/session";
import { useModule, usePageOn } from "@/components/tenant-config";
import { STATUS_LABEL, curOf, errorToast, fmtLevel, levelTone, openTerminal, productOf, serverOf, tradingApi, type AccountProduct, type EngineAccount } from "./api";
import { DeleteAccountDialog, FlavorChip, RenameDialog, accountFlavor, copyingName } from "./archive";
import { CloseAccountDialog } from "./closure";
import { ChangeTypeDialog, DefaultStar, DemoBalanceDialog, TransferBetweenDialog, setDefaultAccount } from "./extras";
import { HideBalancesButton, MASK, useBalancesHidden } from "@/components/dashboard/home/hide-balances";
import { Ribbon } from "@/components/dashboard/home/accounts-panel";

/** Prop-challenge accounts live in engine groups named prop*: simulated capital that is never funded from the
 * wallet (the wallet refuses transfers to them) and never counted in the client's own live equity. */
export function isPropAccount(a: Pick<EngineAccount, "group">) {
  return a.group.toLowerCase().startsWith("prop");
}

/** `solid` is for a badge standing on the account card: the card's own ground is ember, so an ember chip on it
 *  disappears. A solid white pill is the one thing that reads against every one of those gradients. */
export function KindBadge({ type, prop, solid }: { type: "live" | "demo"; prop?: boolean; solid?: boolean }) {
  const t = useT();
  const label = prop ? t("accounts.badge.prop") : type === "live" ? t("accounts.badge.live") : t("accounts.badge.demo");
  if (solid)
    return (
      <span className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold uppercase leading-none tracking-wider text-[#17101f]">
        {label}
      </span>
    );
  return (
    <Chip tone={prop ? "neutral" : type === "live" ? "ember" : "gold"} size="sm" className="font-semibold tracking-wider">
      {label}
    </Chip>
  );
}

/** CFD or Options: what the account trades (its account type decides), shown next to the LIVE / DEMO badge. */
export function ProductBadge({ a }: { a: { product?: AccountProduct | null } }) {
  const t = useT();
  const options = productOf(a) === "options";
  return (
    <Chip tone={options ? "info" : "neutral"} size="sm" className="font-semibold tracking-wider">
      {options ? t("accounts.product.options") : t("accounts.product.cfd")}
    </Chip>
  );
}

export function StatusBadge({ a }: { a: Pick<EngineAccount, "status"> }) {
  const t = useT();
  if (a.status === "active") return null;
  const s = STATUS_LABEL[a.status];
  return (
    <Chip size="sm" tone={s.tone}>
      {t.dyn(`accounts.status.${a.status}`, s.label)}
    </Chip>
  );
}

/** Opens Ezymex Trader signed in to this account (one-time SSO token); an Options account opens in options mode. */
export function TradeButton({ a, size = "sm", label, ...rest }: { a: Pick<EngineAccount, "login" | "status" | "product"> } & Omit<ButtonProps, "onClick"> & { label?: string }) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const blocked = a.status === "disabled" || a.status === "expired" || a.status === "archived" || a.status === "closed";
  return (
    <Button
      size={size}
      variant="ember"
      disabled={busy || blocked}
      title={blocked ? t("accounts.row.cantOpenTrader") : undefined}
      onClick={async () => {
        setBusy(true);
        await openTerminal(a.login, productOf(a));
        setBusy(false);
      }}
      {...rest}
    >
      {busy ? <Loader2 className="animate-spin" /> : <CandlestickChart />} {label ?? t("accounts.row.trade")}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Funding (live accounts start at 0; deposits open with the wallet)    */
/* ------------------------------------------------------------------ */

export function FundDialog({ a, open, onOpenChange }: { a: Pick<EngineAccount, "login" | "cent" | "groupName">; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("accounts.fund.title", { login: a.login })}
      description={`${a.groupName}${a.cent ? ` · ${t("accounts.fund.centAccount")}` : ""}`}
      width={480}
      footer={
        <>
          <Link href="/wallet/deposit">
            <Button variant="surface">{t("accounts.fund.depositUsdt")}</Button>
          </Link>
          <Link href={`/wallet/transfer?to=${a.login}`}>
            <Button variant="ember">{t("accounts.fund.transferFromWallet")}</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-3 text-[13.5px] text-fg-2">
        <div className="flex items-start gap-3 rounded-[14px] border border-line bg-surface-2 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
            <Wallet className="size-4" />
          </span>
          <div>
            <div className="font-medium text-fg">{t("accounts.fund.fromWallet")}</div>
            <p className="mt-0.5 text-[12.5px] text-fg-3">
              {t(a.cent ? "accounts.fund.textCent" : "accounts.fund.text")}
            </p>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

export function FundButton({ a, size = "sm", variant = "surface" }: { a: Pick<EngineAccount, "login" | "cent" | "groupName">; size?: ButtonProps["size"]; variant?: ButtonProps["variant"] }) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  // accounts are funded from the wallet: nothing to offer while the broker has it switched off
  const wallet = useModule("wallet");
  if (!wallet) return null;
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <ArrowDownToLine /> {t("accounts.fund.button")}
      </Button>
      <FundDialog a={a} open={open} onOpenChange={setOpen} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Demo refill (D8)                                                    */
/* ------------------------------------------------------------------ */

export function refillsLeft(a: Pick<EngineAccount, "demo">) {
  return a.demo ? Math.max(0, a.demo.refillsPerDay - a.demo.refillsUsedToday) : 0;
}

/** Demo starting balance in the account currency (the engine already reports it in cents for cent accounts). */
export function demoTarget(a: Pick<EngineAccount, "demo" | "cent">) {
  return a.demo ? a.demo.initialBalance : null;
}

export function useRefill(a: Pick<EngineAccount, "login" | "cent" | "currency" | "demo">, onDone?: () => void) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const run = React.useCallback(async () => {
    setBusy(true);
    try {
      const r = await tradingApi<{ amount: number; balance: number }>(`accounts/${a.login}/demo-refill`, { body: {} });
      const cur = curOf(a);
      toast.success(t("accounts.refill.done"), { description: t("accounts.refill.desc", { login: a.login, amount: `${cur}${r.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, count: Math.max(0, refillsLeft(a) - 1) }) });
      onDone?.();
    } catch (e) {
      errorToast(t("accounts.refill.error"), e);
    } finally {
      setBusy(false);
    }
  }, [a, onDone, t]);
  return { busy, run };
}

export function RefillButton({ a, onDone, size = "sm" }: { a: EngineAccount; onDone?: () => void; size?: ButtonProps["size"] }) {
  const t = useT();
  const { busy, run } = useRefill(a, onDone);
  const left = refillsLeft(a);
  const full = demoTarget(a) !== null && a.balance >= demoTarget(a)!;
  return (
    <Button size={size} variant="surface" disabled={busy || left === 0 || full || a.status === "expired"} onClick={run} title={left === 0 ? t("accounts.refill.noneLeft") : full ? t("accounts.refill.full") : undefined}>
      {busy ? <Loader2 className="animate-spin" /> : <RefreshCcw />} {t("accounts.row.refill")}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Account row (accounts list, dashboard)                              */
/* ------------------------------------------------------------------ */

/** `vertical` draws the trigger as vertical dots, which is what the dashboard's "Account details" heading wants. */
export function AccountActions({ a, onChanged, vertical }: { a: EngineAccount; onChanged?: () => void; vertical?: boolean }) {
  const t = useT();
  const [renaming, setRenaming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const [typing, setTyping] = React.useState(false);
  const [moving, setMoving] = React.useState(false);
  const [demoBal, setDemoBal] = React.useState(false);
  // prop-challenge accounts are opened and closed by the prop service, not by the client
  const prop = isPropAccount(a);
  const live = a.type === "live";
  const special = prop || accountFlavor(a) !== null;
  // Options accounts don't use leverage (option margin ignores it)
  const options = productOf(a) === "options";
  const star = async () => {
    try {
      await setDefaultAccount(a.isDefault ? null : a.login);
      toast.success(a.isDefault ? t("accounts.default.removed") : t("accounts.default.set"), { description: `#${a.login}` });
      onChanged?.();
    } catch (e) {
      errorToast(t("accounts.default.failed"), e);
    }
  };
  return (
    <>
      <Menu
        trigger={
          <IconButton size="sm" aria-label={t("accounts.menu.actions")}>
            {vertical ? <MoreVertical /> : <MoreHorizontal />}
          </IconButton>
        }
        items={[
          { label: t("accounts.menu.details"), icon: <GaugeIcon />, href: `/accounts/${a.login}` },
          { label: a.isDefault ? t("accounts.default.unset") : t("accounts.default.makeDefault"), icon: a.isDefault ? <StarOff /> : <Star />, onSelect: () => void star() },
          ...(options ? [] : [{ label: t("accounts.menu.changeLeverage"), icon: <GaugeIcon />, href: `/accounts/${a.login}?tab=settings` }]),
          ...(special ? [] : [{ label: t("accounts.type.menu"), icon: <Layers />, onSelect: () => setTyping(true) }]),
          ...(live && !prop ? [{ label: t("accounts.between.menu"), icon: <ArrowLeftRight />, onSelect: () => setMoving(true) }] : []),
          ...(!live ? [{ label: t("accounts.demoBalance.menu"), icon: <Coins />, onSelect: () => setDemoBal(true) }] : []),
          { label: t("accounts.menu.passwords"), icon: <KeyRound />, href: `/accounts/${a.login}?tab=credentials` },
          { label: t("accounts.menu.statements"), icon: <ArrowDownToLine />, href: `/accounts/${a.login}?tab=history` },
          { label: t("accounts.history.zip"), icon: <ArrowDownToLine />, onSelect: () => window.location.assign(`/api/trading/accounts/${a.login}/history-zip`) },
          { label: t("accounts.menu.rename"), icon: <PencilLine />, onSelect: () => setRenaming(true) },
          ...(prop
            ? []
            : ([
                "sep",
                { label: t("accounts.menu.delete"), icon: <Trash2 />, danger: true, onSelect: () => setDeleting(true) },
                ...(live ? [{ label: t("accounts.close.menu"), icon: <Lock />, danger: true, onSelect: () => setClosing(true) }] : []),
              ] as const)),
        ]}
      />
      {renaming && <RenameDialog a={a} open={renaming} onOpenChange={setRenaming} onDone={onChanged} />}
      {deleting && <DeleteAccountDialog a={a} open={deleting} onOpenChange={setDeleting} onDone={onChanged} />}
      {closing && <CloseAccountDialog a={a} open={closing} onOpenChange={setClosing} onDone={onChanged} />}
      {typing && <ChangeTypeDialog a={a} open={typing} onOpenChange={setTyping} onDone={onChanged} />}
      {moving && <TransferBetweenDialog from={a} open={moving} onOpenChange={setMoving} onDone={onChanged} />}
      {demoBal && <DemoBalanceDialog a={a} open={demoBal} onOpenChange={setDemoBal} onDone={onChanged} />}
    </>
  );
}

/** Ezymex Trader for a copy-trading account: the copy service trades it, the client watches P&L and manages the copy. */
function CopyActions({ a }: { a: EngineAccount }) {
  const t = useT();
  const copyOn = usePageOn()("/social/copy");
  return (
    <>
      {copyOn && (
        <Link href="/social/copy">
          <Button size="sm" variant="surface">
            <Users /> {t("accounts.copy.manage")}
          </Button>
        </Link>
      )}
      <TradeButton a={a} variant="surface" label={t("accounts.copy.watchPnl")} />
    </>
  );
}

/** One trading account, as a card.
 *
 *  The card is dark in both themes, warm for real money and grey for practice, which is the same finish the
 *  dashboard's account cards carry - a client should recognise their account by its face wherever they meet it.
 *  `k-on-dark` pins the dark token set on the subtree so the buttons, chips and muted text inside read against
 *  it without each one being given a colour of its own.
 *
 *  The face carries what the client checks at a glance - whose account it is, what it holds, whether it can
 *  take a trade - and the line above the buttons carries everything that is true only sometimes: open
 *  positions and floating P&L, an unfunded live account, who is being copied, how many demo refills are left.
 *  None of that is decoration, so none of it was dropped to make the card tidy. */
export function LiveAccountCard({ a, onChanged }: { a: EngineAccount; onChanged?: () => void }) {
  const t = useT();
  const cur = curOf(a);
  const tone = levelTone(a.marginLevel);
  const readOnly = useReadOnly();
  const flavor = accountFlavor(a);
  const copying = flavor === "copy" ? copyingName(a) : null;
  const prop = isPropAccount(a);
  const hidden = useBalancesHidden();
  const live = a.type === "live" && !prop;
  const unfunded = a.type === "live" && a.balance === 0 && a.equity === 0;

  const amount = (value: number, className: string) =>
    hidden ? <span className={cn("k-num block", className)}>{MASK}</span> : <Money value={value} currency={cur} countUp={false} className={cn("block truncate", className)} />;

  return (
    <div className={cn("k-on-dark relative isolate flex flex-col overflow-hidden rounded-[22px] p-5", live ? "k-acct-live" : "k-acct-demo")}>
      <Ribbon />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <KindBadge type={a.type} prop={prop} solid />
          <StatusBadge a={a} />
          <DefaultStar a={a} />
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <div className="text-end">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-fg-3">{t("accounts.label.login")}</div>
            <div dir="ltr" className="k-num font-mono text-[13.5px] font-semibold">#{a.login}</div>
          </div>
          <CopyButton value={String(a.login)} label={t("accounts.label.login")} />
        </div>
      </div>

      <Link href={`/accounts/${a.login}`} className="mt-3 block min-w-0 text-[19px] font-semibold leading-tight tracking-[-0.01em] hover:text-ember-2">
        {a.groupName} · {t.dyn(`accounts.mode.${a.mode}`, a.mode)}
      </Link>
      {a.name && <div className="mt-0.5 truncate text-[12.5px] text-fg-2">“{a.name}”</div>}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <ProductBadge a={a} />
        <FlavorChip a={a} />
        <Chip size="sm" className="font-semibold tracking-wider">
          {t.dyn(`accounts.mode.${a.mode}`, a.mode)}
        </Chip>
        {a.cent && (
          <Chip size="sm" tone="gold">
            USC
          </Chip>
        )}
        {productOf(a) !== "options" && <Chip size="sm">1:{a.leverage.toLocaleString("en-US")}</Chip>}
      </div>

      <div className="mt-4 flex items-end gap-2">
        {amount(a.balance, "text-[27px] font-bold leading-none tracking-[-0.02em]")}
        <span className="pb-0.5 text-[12.5px] font-medium text-fg-2">{a.cent ? "USC" : "USD"}</span>
        <HideBalancesButton className="-mb-1.5 ms-auto size-8" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3.5">
        <div className="min-w-0">
          <div className="text-[11px] text-fg-3">{t("common.equity")}</div>
          {amount(a.equity, "mt-0.5 text-[14.5px] font-semibold")}
        </div>
        <div className="min-w-0 border-s border-line ps-3">
          <div className="text-[11px] text-fg-3">{t("accounts.label.freeMargin")}</div>
          {amount(a.freeMargin, "mt-0.5 text-[14.5px] font-semibold")}
        </div>
        <div className="min-w-0 border-s border-line ps-3">
          <div className="whitespace-nowrap text-[11px] text-fg-3">{t("accounts.label.marginLevel")}</div>
          <div className={cn("k-num mt-0.5 text-[14.5px] font-semibold", tone === "up" && "text-up", tone === "warn" && "text-warn", tone === "down" && "text-down")}>{fmtLevel(a.marginLevel)}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-fg-3">
        {copying && <span className="font-medium text-fg-2">{t("accounts.copy.copying", { name: copying })}</span>}
        {a.positions > 0 || a.orders > 0 ? (
          <span>
            {t("accounts.row.openPositions", { count: a.positions })} · {t("accounts.row.pendingOrders", { count: a.orders })} · {t("accounts.row.floating")}{" "}
            {hidden ? MASK : <Money value={a.profit} currency={cur} signed tone="auto" countUp={false} />}
          </span>
        ) : (
          <span>{t("accounts.row.noPositions")}</span>
        )}
        {unfunded && <span className="text-warn">{t("accounts.row.notFunded")}</span>}
        {a.type === "demo" && a.demo && <span>{t("accounts.row.demoRefills", { left: refillsLeft(a), total: a.demo.refillsPerDay, days: a.demo.expiryDays })}</span>}
        {a.closureRequest?.status === "pending" && <span className="text-info">{t("accounts.close.pendingChip")}</span>}
        {a.dormantSince && <span className="text-warn">{t("accounts.dormant.chip")}</span>}
        <span className="ms-auto font-mono">{serverOf(a)}</span>
      </div>

      {!readOnly && (
        <div className="mt-4 flex items-center gap-2">
          {a.type === "live" ? !prop && <FundButton a={a} /> : <RefillButton a={a} onDone={onChanged} />}
          {flavor === "copy" ? <CopyActions a={a} /> : <TradeButton a={a} className="flex-1" />}
          <AccountActions a={a} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Credentials (shown once after opening / changing)                   */
/* ------------------------------------------------------------------ */

export function SecretField({ label, value, hint, secret }: { label: string; value: string; hint?: React.ReactNode; secret?: boolean }) {
  const t = useT();
  const [show, setShow] = React.useState(!secret);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[12px] font-medium text-fg-2">
        {label}
        {hint && <span className="font-normal text-fg-3">{hint}</span>}
      </div>
      <div className="flex h-11 items-center gap-2 rounded-[14px] border border-line bg-surface-2 px-3.5">
        <span dir="ltr" className="min-w-0 flex-1 truncate font-mono text-[14px] text-fg" data-secret={secret ? label : undefined}>
          {show ? value : "•".repeat(Math.min(12, value.length))}
        </span>
        {secret && (
          <button type="button" onClick={() => setShow((s) => !s)} className="text-[11.5px] font-medium text-fg-3 hover:text-fg">
            {show ? t("accounts.secret.hide") : t("accounts.secret.show")}
          </button>
        )}
        <CopyButton value={value} label={label} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Password rules (engine: 8–64 characters, letters and digits)        */
/* ------------------------------------------------------------------ */

export const LIVE_PASSWORD_RULES = [
  { key: "len", labelKey: "accounts.password.len" as const, label: "8–64 characters", test: (p: string) => p.length >= 8 && p.length <= 64 },
  { key: "letter", labelKey: "accounts.password.letter" as const, label: "At least one letter", test: (p: string) => /\p{L}/u.test(p) },
  { key: "digit", labelKey: "accounts.password.digit" as const, label: "At least one digit", test: (p: string) => /\d/.test(p) },
];

export const livePasswordOk = (p: string) => LIVE_PASSWORD_RULES.every((r) => r.test(p));

export function PasswordRules({ password }: { password: string }) {
  const t = useT();
  return (
    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
      {LIVE_PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <li key={r.key} className={cn("flex items-center gap-2 text-[12.5px] transition-colors", ok ? "text-up" : "text-fg-3")}>
            <span className={cn("grid size-4 place-items-center rounded-full border", ok ? "border-up/40 bg-up-soft" : "border-line")}>{ok && <Check className="size-2.5" />}</span>
            {t(r.labelKey)}
          </li>
        );
      })}
    </ul>
  );
}
