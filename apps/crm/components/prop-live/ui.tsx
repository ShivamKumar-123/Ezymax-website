"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CandlestickChart, Eye, EyeOff, Loader2, RotateCw } from "lucide-react";
import { Button, Card, Chip, CopyButton, EmptyState, Progress, cn, type ButtonProps } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { openTerminal } from "@/components/trading/api";
import { ERROR_LINK, PropError, usd } from "./api";

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/** Inline error with the next step (deposit, verify) when there is one. */
export function ErrorNote({ error, className }: { error: unknown; className?: string }) {
  const t = useT();
  if (!error) return null;
  const code = error instanceof PropError ? error.code : "error";
  const msg = error instanceof Error ? error.message : t("prop.error.generic");
  const link = ERROR_LINK[code];
  const soft = code === "provisioning" || code === "payment_pending" || code === "wallet_pending";
  return (
    <div className={cn("flex flex-col gap-3 rounded-[14px] border px-4 py-3 sm:flex-row sm:items-center", soft ? "border-info/25 bg-info-soft" : "border-down/25 bg-down-soft", className)}>
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", soft ? "text-info" : "text-down")} />
        <p className="text-[13px] text-fg">{msg}</p>
      </div>
      {link && (
        <Link href={link.href} className="shrink-0">
          <Button size="sm" variant="surface">
            {t(link.labelKey)} <ArrowRight className="rtl:-scale-x-100" />
          </Button>
        </Link>
      )}
    </div>
  );
}

export function LoadError({ error, onRetry, title }: { error: PropError; onRetry: () => void; title?: string }) {
  const t = useT();
  return (
    <Card>
      <EmptyState
        illustration="satellite_antenna"
        title={title ?? t("prop.loadError.title")}
        text={error.status === 0 || error.status >= 500 ? t("prop.loadError.text") : error.message}
        action={
          <Button variant="surface" onClick={onRetry}>
            <RotateCw /> {t("prop.tryAgain")}
          </Button>
        }
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Rule tile (static: no looping motion)                               */
/* ------------------------------------------------------------------ */

export type RuleState = "ok" | "passed" | "failed" | "waiting" | "off";

export function RuleStateChip({ state }: { state: RuleState }) {
  const t = useT();
  const m = {
    ok: { t: t("prop.ruleState.ok"), tone: "ember" as const },
    passed: { t: t("prop.ruleState.passed"), tone: "up" as const },
    failed: { t: t("prop.ruleState.failed"), tone: "down" as const },
    waiting: { t: t("prop.ruleState.waiting"), tone: "neutral" as const },
    off: { t: t("prop.ruleState.off"), tone: "neutral" as const },
  }[state];
  return (
    <Chip size="sm" tone={m.tone}>
      {m.t}
    </Chip>
  );
}

export function RuleTile({
  icon,
  title,
  state,
  progress,
  tone = "ember",
  left,
  right,
  rows,
  footer,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  state: RuleState;
  progress?: number;
  tone?: "ember" | "up" | "down" | "gold" | "warn";
  left?: React.ReactNode;
  right?: React.ReactNode;
  rows: [React.ReactNode, React.ReactNode, ("up" | "down" | "warn")?][];
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("k-card flex h-full flex-col p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 [&_svg]:size-[15px]">{icon}</span>
          <span className="truncate text-[14.5px] font-medium">{title}</span>
        </div>
        <RuleStateChip state={state} />
      </div>
      {progress !== undefined && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[11.5px] text-fg-3">
            <span className="min-w-0 truncate">{left}</span>
            <span className="k-num shrink-0">{right}</span>
          </div>
          <Progress value={progress} tone={tone} className="h-2" />
        </div>
      )}
      <dl className="mt-4 flex-1 divide-y divide-line rounded-[12px] border border-line bg-surface-2/50 px-3">
        {rows.map(([k, v, t], i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-2 text-[12.5px]">
            <dt className="text-fg-3">{k}</dt>
            <dd className={cn("k-num text-end font-medium", t === "up" && "text-up", t === "down" && "text-down", t === "warn" && "text-warn")}>{v}</dd>
          </div>
        ))}
      </dl>
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Countdown (text, ticks once a second)                               */
/* ------------------------------------------------------------------ */

/** Next 17:00 New York (21:00 UTC during US DST, 22:00 UTC otherwise). */
export function nextNyClose(now = new Date()): Date {
  const y = now.getUTCFullYear();
  const nthSunday = (month: number, n: number) => {
    const first = new Date(Date.UTC(y, month, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + (n - 1) * 7;
  };
  const dstStart = Date.UTC(y, 2, nthSunday(2, 2), 7);
  const dstEnd = Date.UTC(y, 10, nthSunday(10, 1), 6);
  const hour = now.getTime() >= dstStart && now.getTime() < dstEnd ? 21 : 22;
  let t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour);
  if (t <= now.getTime()) t += 86_400_000;
  return new Date(t);
}

export function useCountdown(target: string | null | undefined) {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return null;
  let to = target ? new Date(target).getTime() : NaN;
  if (!Number.isFinite(to) || to <= now) to = nextNyClose(new Date(now)).getTime();
  return Math.max(0, to - now);
}

export function hms(ms: number | null) {
  if (ms === null) return "--:--:--";
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
}

export function daysLeft(deadline: string | null | undefined, now = Date.now()) {
  if (!deadline) return null;
  const t = new Date(deadline).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, t - now);
}

/* ------------------------------------------------------------------ */
/* Credentials                                                         */
/* ------------------------------------------------------------------ */

export function CredentialField({ label, value, secret, mono = true }: { label: string; value: string; secret?: boolean; mono?: boolean }) {
  const t = useT();
  const [show, setShow] = React.useState(!secret);
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-[11px] text-fg-3">{label}</div>
      <div className="flex h-10 items-center gap-1 rounded-[12px] border border-line bg-surface-2 ps-3 pe-1.5">
        <span className={cn("min-w-0 flex-1 truncate text-[13px]", mono && "font-mono", !show && "tracking-[0.2em]")}>{show ? value : "••••••••"}</span>
        {secret && (
          <button type="button" onClick={() => setShow((s) => !s)} className="grid size-6 place-items-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label={show ? t("prop.hide") : t("prop.show")}>
            {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        )}
        <CopyButton value={value} label={label} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trade button (one-time SSO into Kalks Trader)                       */
/* ------------------------------------------------------------------ */

export function PropTradeButton({ login, disabled, reason, size = "sm", label, ...rest }: { login: number | null; disabled?: boolean; reason?: string; label?: string } & Omit<ButtonProps, "onClick" | "disabled">) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const blocked = disabled || !login;
  return (
    <Button
      size={size}
      variant="ember"
      disabled={busy || blocked}
      title={blocked ? reason ?? t("prop.trade.blocked") : undefined}
      onClick={async () => {
        if (!login) return;
        setBusy(true);
        await openTerminal(login);
        setBusy(false);
      }}
      {...rest}
    >
      {busy ? <Loader2 className="animate-spin" /> : <CandlestickChart />} {label ?? t("prop.trade.button")}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Small bits                                                          */
/* ------------------------------------------------------------------ */

export function Tile({ label, value, sub, tone }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="k-row min-w-0 px-3.5 py-3">
      <div className="truncate text-[10.5px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className={cn("k-num mt-1 truncate text-[16px] font-semibold tracking-tight", tone === "up" && "text-up", tone === "down" && "text-down")}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-fg-3">{sub}</div>}
    </div>
  );
}

export const signedUsd = (v: number) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${usd(Math.abs(v))}`;
