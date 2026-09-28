"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownToLine, CandlestickChart, Check, KeyRound, Loader2, MoreHorizontal, RefreshCcw, Gauge as GaugeIcon, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, CopyButton, Dialog, IconButton, Menu, Money, cn, type ButtonProps } from "@kalks/ui";
import { STATUS_LABEL, accountTitle, curOf, errorToast, fmtLevel, levelTone, openTerminal, serverOf, tradingApi, type EngineAccount } from "./api";

export function KindBadge({ type }: { type: "live" | "demo" }) {
  return type === "live" ? (
    <Chip tone="ember" size="sm" className="font-semibold tracking-wider">
      LIVE
    </Chip>
  ) : (
    <Chip tone="gold" size="sm" className="font-semibold tracking-wider">
      DEMO
    </Chip>
  );
}

export function StatusBadge({ a }: { a: Pick<EngineAccount, "status"> }) {
  if (a.status === "active") return null;
  const s = STATUS_LABEL[a.status];
  return (
    <Chip size="sm" tone={s.tone}>
      {s.label}
    </Chip>
  );
}

/** Opens Kalks Trader signed in to this account (one-time SSO token). */
export function TradeButton({ a, size = "sm", label = "Trade", ...rest }: { a: Pick<EngineAccount, "login" | "status"> } & Omit<ButtonProps, "onClick"> & { label?: string }) {
  const [busy, setBusy] = React.useState(false);
  const blocked = a.status === "disabled" || a.status === "expired";
  return (
    <Button
      size={size}
      variant="ember"
      disabled={busy || blocked}
      title={blocked ? "This account can't be opened in Kalks Trader" : undefined}
      onClick={async () => {
        setBusy(true);
        await openTerminal(a.login);
        setBusy(false);
      }}
      {...rest}
    >
      {busy ? <Loader2 className="animate-spin" /> : <CandlestickChart />} {label}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Funding (live accounts start at 0; deposits open with the wallet)    */
/* ------------------------------------------------------------------ */

export function FundDialog({ a, open, onOpenChange }: { a: Pick<EngineAccount, "login" | "cent" | "groupName">; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Fund account #${a.login}`}
      description={`${a.groupName}${a.cent ? " · cent account (USC)" : ""}`}
      width={480}
      footer={
        <Button variant="ember" onClick={() => onOpenChange(false)}>
          Got it
        </Button>
      }
    >
      <div className="space-y-3 text-[13.5px] text-fg-2">
        <div className="flex items-start gap-3 rounded-[14px] border border-line bg-surface-2 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
            <Wallet className="size-4" />
          </span>
          <div>
            <div className="font-medium text-fg">Deposits open with the Kalks wallet</div>
            <p className="mt-0.5 text-[12.5px] text-fg-3">
              Live accounts are funded by a transfer from your wallet (USDT on TRC20, credited 1:1 in USD{a.cent ? ", shown ×100 in USC on a cent account" : ""}). The wallet is being connected; we will email you as soon as deposits are enabled for your profile.
            </p>
          </div>
        </div>
        <p className="text-[12.5px] text-fg-3">Until then this account stays at a zero balance. You can already log in to Kalks Trader with it, and practise on a demo account in the meantime.</p>
      </div>
    </Dialog>
  );
}

export function FundButton({ a, size = "sm", variant = "surface" }: { a: Pick<EngineAccount, "login" | "cent" | "groupName">; size?: ButtonProps["size"]; variant?: ButtonProps["variant"] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <ArrowDownToLine /> Fund account
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

/** Demo starting balance in the account currency (cent accounts: USD × 100). */
export function demoTarget(a: Pick<EngineAccount, "demo" | "cent">) {
  return a.demo ? a.demo.initialBalance * (a.cent ? 100 : 1) : null;
}

export function useRefill(a: Pick<EngineAccount, "login" | "cent" | "currency" | "demo">, onDone?: () => void) {
  const [busy, setBusy] = React.useState(false);
  const run = React.useCallback(async () => {
    setBusy(true);
    try {
      const r = await tradingApi<{ amount: number; balance: number }>(`accounts/${a.login}/demo-refill`, { body: {} });
      const cur = curOf(a);
      toast.success("Demo balance refilled", { description: `#${a.login} back to ${cur}${r.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })} · ${Math.max(0, refillsLeft(a) - 1)} refills left today` });
      onDone?.();
    } catch (e) {
      errorToast("Couldn't refill the demo balance", e);
    } finally {
      setBusy(false);
    }
  }, [a, onDone]);
  return { busy, run };
}

export function RefillButton({ a, onDone, size = "sm" }: { a: EngineAccount; onDone?: () => void; size?: ButtonProps["size"] }) {
  const { busy, run } = useRefill(a, onDone);
  const left = refillsLeft(a);
  const full = demoTarget(a) !== null && a.balance >= demoTarget(a)!;
  return (
    <Button size={size} variant="surface" disabled={busy || left === 0 || full || a.status === "expired"} onClick={run} title={left === 0 ? "No refills left today" : full ? "Balance is already at its starting amount" : undefined}>
      {busy ? <Loader2 className="animate-spin" /> : <RefreshCcw />} Refill
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Account row (accounts list, dashboard)                              */
/* ------------------------------------------------------------------ */

export function AccountActions({ a }: { a: EngineAccount }) {
  return (
    <Menu
      trigger={
        <IconButton size="sm" aria-label="Account actions">
          <MoreHorizontal />
        </IconButton>
      }
      items={[
        { label: "Account details", icon: <GaugeIcon />, href: `/accounts/${a.login}` },
        { label: "Change leverage", icon: <GaugeIcon />, href: `/accounts/${a.login}?tab=settings` },
        { label: "Trading & investor passwords", icon: <KeyRound />, href: `/accounts/${a.login}?tab=credentials` },
        { label: "Statements (CSV)", icon: <ArrowDownToLine />, href: `/accounts/${a.login}?tab=history` },
      ]}
    />
  );
}

export function LiveAccountRow({ a, onChanged, compact }: { a: EngineAccount; onChanged?: () => void; compact?: boolean }) {
  const cur = curOf(a);
  const tone = levelTone(a.marginLevel);
  return (
    <div className="k-row group relative overflow-hidden p-4 transition-colors hover:border-[var(--k-border-top)] sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <KindBadge type={a.type} />
        <Link href={`/accounts/${a.login}`} className="text-[15px] font-medium text-fg hover:text-ember">
          {accountTitle(a)}
        </Link>
        <span className="inline-flex items-center gap-1 font-mono text-[13px] text-fg-2">
          #{a.login}
          <CopyButton value={String(a.login)} label="Login" />
        </span>
        {a.name && <span className="truncate text-[13px] text-fg-3">“{a.name}”</span>}
        {a.cent && (
          <Chip size="sm" tone="gold">
            USC
          </Chip>
        )}
        <StatusBadge a={a} />
        <div className="ml-auto flex items-center gap-2 text-xs text-fg-3">
          <span className="hidden font-mono sm:inline">{serverOf(a)}</span>
          <Chip size="sm">1:{a.leverage.toLocaleString("en-US")}</Chip>
        </div>
      </div>
      <div className={cn("mt-4 grid items-end gap-4", compact ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto]" : "grid-cols-2 sm:grid-cols-4 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]")}>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">Balance</div>
          <Money value={a.balance} currency={cur} countUp={false} className="mt-1 block truncate text-[16px] font-semibold sm:text-[19px]" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">Equity</div>
          <Money value={a.equity} currency={cur} countUp={false} className="mt-1 block truncate text-[16px] font-semibold sm:text-[19px]" />
        </div>
        {!compact && (
          <div className="hidden min-w-0 sm:block">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Free margin</div>
            <Money value={a.freeMargin} currency={cur} countUp={false} className="mt-1 block text-[15px] font-medium text-fg-2" />
          </div>
        )}
        <div>
          <div className="whitespace-nowrap text-[11px] uppercase tracking-wider text-fg-3">Margin level</div>
          <div className={cn("k-num mt-1 text-[17px] font-semibold", tone === "up" && "text-up", tone === "warn" && "text-warn", tone === "down" && "text-down")}>{fmtLevel(a.marginLevel)}</div>
        </div>
        <div className="col-span-full flex flex-wrap items-center justify-end gap-2 xl:col-span-1">
          <AccountActions a={a} />
          {a.type === "live" ? <FundButton a={a} /> : <RefillButton a={a} onDone={onChanged} />}
          <TradeButton a={a} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-fg-3">
        {a.positions > 0 || a.orders > 0 ? (
          <span>
            {a.positions} open position{a.positions === 1 ? "" : "s"} · {a.orders} pending order{a.orders === 1 ? "" : "s"} · floating{" "}
            <Money value={a.profit} currency={cur} signed tone="auto" countUp={false} />
          </span>
        ) : (
          <span>No open positions</span>
        )}
        {a.type === "live" && a.balance === 0 && a.equity === 0 && <span className="text-warn">Not funded yet</span>}
        {a.type === "demo" && a.demo && (
          <span>
            {refillsLeft(a)} of {a.demo.refillsPerDay} refills left today · expires after {a.demo.expiryDays} days without a terminal login
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Credentials (shown once after opening / changing)                   */
/* ------------------------------------------------------------------ */

export function SecretField({ label, value, hint, secret }: { label: string; value: string; hint?: React.ReactNode; secret?: boolean }) {
  const [show, setShow] = React.useState(!secret);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[12px] font-medium text-fg-2">
        {label}
        {hint && <span className="font-normal text-fg-3">{hint}</span>}
      </div>
      <div className="flex h-11 items-center gap-2 rounded-[14px] border border-line bg-surface-2 px-3.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[14px] text-fg" data-secret={secret ? label : undefined}>
          {show ? value : "•".repeat(Math.min(12, value.length))}
        </span>
        {secret && (
          <button type="button" onClick={() => setShow((s) => !s)} className="text-[11.5px] font-medium text-fg-3 hover:text-fg">
            {show ? "Hide" : "Show"}
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
  { key: "len", label: "8–64 characters", test: (p: string) => p.length >= 8 && p.length <= 64 },
  { key: "letter", label: "At least one letter", test: (p: string) => /\p{L}/u.test(p) },
  { key: "digit", label: "At least one digit", test: (p: string) => /\d/.test(p) },
];

export const livePasswordOk = (p: string) => LIVE_PASSWORD_RULES.every((r) => r.test(p));

export function PasswordRules({ password }: { password: string }) {
  return (
    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
      {LIVE_PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <li key={r.key} className={cn("flex items-center gap-2 text-[12.5px] transition-colors", ok ? "text-up" : "text-fg-3")}>
            <span className={cn("grid size-4 place-items-center rounded-full border", ok ? "border-up/40 bg-up-soft" : "border-line")}>{ok && <Check className="size-2.5" />}</span>
            {r.label}
          </li>
        );
      })}
    </ul>
  );
}
