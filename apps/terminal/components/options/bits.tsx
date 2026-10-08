"use client";

// Small shared pieces of the options workspace: avatars for every underlying (NZDUSD has no CFD instrument), state and
// expiry-kind badges, a call/put tag, the flashing number cell, the "launching soon", error and "switched off" panels.
import * as React from "react";
import { ArrowUpRight, BookOpen, ChevronDown, Clock3, Hourglass, Layers, RefreshCw, TriangleAlert } from "lucide-react";
import { INSTRUMENT_MAP } from "@ezymex/mock";
import { OPTION_SPEC } from "@ezymex/mock/options";
import { SymbolAvatar, cn, useTickGlow } from "@ezymex/ui";
import { useT } from "@ezymex/i18n/react";
import { useTerminal } from "@/lib/store";
import { useModule } from "@/lib/features";
import { DropMenu } from "@/components/ui/menu";
import { ONBOARDING_URL, needsOnboarding, optionErrorText } from "@/lib/options/errors";
import type { ExpiryKind, OptionRight, OptionTradeState, Side } from "@/lib/options/types";

const CCY_FLAG: Record<string, string> = { EUR: "eu", USD: "us", GBP: "gb", JPY: "jp", AUD: "au", CAD: "ca", CHF: "ch", NZD: "nz" };

/** Symbol avatar for any options underlying (falls back to the currency flags). */
export function OptAvatar({ symbol, size = 16 }: { symbol: string; size?: number }) {
  if (INSTRUMENT_MAP[symbol]) return <SymbolAvatar symbol={symbol} size={size} />;
  const spec = OPTION_SPEC[symbol];
  const base = spec ? CCY_FLAG[spec.baseCcy] : undefined;
  const quote = spec ? CCY_FLAG[spec.quoteCcy] : undefined;
  if (!base || !quote) return <span className="inline-block shrink-0 rounded-full bg-surface-3" style={{ width: size, height: size }} />;
  return (
    <span className="relative inline-block shrink-0" style={{ width: size * 1.45, height: size }}>
      <span className={cn("fi fis absolute left-0 top-0 rounded-full ring-2 ring-surface", `fi-${base}`)} style={{ width: size, height: size }} />
      <span className={cn("fi fis absolute right-0 top-0 rounded-full ring-2 ring-surface", `fi-${quote}`)} style={{ width: size, height: size }} />
    </span>
  );
}

export function RightTag({ right, className }: { right: OptionRight; className?: string }) {
  const t = useT();
  return (
    <span className={cn("inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[4px] px-1 font-mono text-[10px] font-semibold", right === "call" ? "bg-up-soft text-up" : "bg-down-soft text-down", className)} title={right === "call" ? t("trader.opt.call") : t("trader.opt.put")}>
      {right === "call" ? "C" : "P"}
    </span>
  );
}

export function SideTag({ side, className }: { side: Side; className?: string }) {
  const t = useT();
  return <span className={cn("text-[10.5px] font-semibold uppercase tracking-[0.06em]", side === "buy" ? "text-up" : "text-down", className)}>{side === "buy" ? t("common.buy") : t("common.sell")}</span>;
}

const KIND: Record<ExpiryKind, { letter: string; cls: string }> = {
  daily: { letter: "D", cls: "bg-surface-3 text-fg-2" },
  weekly: { letter: "W", cls: "bg-info-soft text-info" },
  monthly: { letter: "M", cls: "bg-gold-soft text-gold" },
};

export function KindBadges({ kinds }: { kinds: ExpiryKind[] }) {
  const t = useT();
  return (
    <span className="inline-flex gap-0.5">
      {kinds.map((k) => (
        <span key={k} title={t.dyn(`trader.opt.kind.${k}`, k)} className={cn("grid h-[14px] min-w-[14px] place-items-center rounded-[3px] px-0.5 font-mono text-[9px] font-semibold", KIND[k]?.cls ?? "bg-surface-3 text-fg-3")}>
          {KIND[k]?.letter ?? k[0]?.toUpperCase()}
        </span>
      ))}
    </span>
  );
}

export function StateBadge({ state, className }: { state: OptionTradeState; className?: string }) {
  const t = useT();
  if (state === "open") return null;
  const tone = state === "halted" ? "border-down/30 bg-down-soft text-down" : state === "closed" ? "border-line bg-surface-3 text-fg-3" : "border-warn/30 bg-warn-soft text-warn";
  return <span className={cn("inline-flex h-[17px] shrink-0 items-center rounded-[4px] border px-1.5 text-[9.5px] font-semibold uppercase tracking-[0.05em]", tone, className)}>{t.dyn(`trader.opt.state.${state}`, state)}</span>;
}

/** A number that glows green / red when it changes (chain prices). */
export function Flash({ value, children, className }: { value: number; children: React.ReactNode; className?: string }) {
  const ref = useTickGlow<HTMLSpanElement>(value, { strength: 18, duration: 700 });
  return (
    <span ref={ref} className={cn("k-num rounded-[3px] px-0.5", className)}>
      {children}
    </span>
  );
}

/** Compact segmented control (ticket / builder style). */
export function Seg<T extends string>({ value, onChange, options, className, size = "md" }: { value: T; onChange: (v: T) => void; options: readonly { value: T; label: React.ReactNode; title?: string; tone?: "up" | "down" }[]; className?: string; size?: "sm" | "md" }) {
  return (
    <div className={cn("grid gap-0.5 rounded-[7px] border border-line bg-surface-2 p-0.5", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            title={o.title}
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "whitespace-nowrap rounded-[5px] px-1.5 font-medium tracking-tight transition-colors",
              size === "sm" ? "h-5 text-[10.5px]" : "h-6 text-[11px]",
              on ? (o.tone === "up" ? "bg-up text-white" : o.tone === "down" ? "bg-down text-white" : "bg-surface-3 text-fg shadow-[inset_0_1px_0_var(--k-border-top)]") : "text-fg-3 hover:text-fg-2",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Full-panel state: the module is off here ("launching soon"), or the price server is down. */
export function OptionsUnavailable({ kind, onRetry, compact }: { kind: "soon" | "error"; onRetry?: () => void; compact?: boolean }) {
  const t = useT();
  return (
    <div className={cn("grid h-full place-items-center text-center", compact ? "p-4" : "p-8")}>
      <div className="max-w-[420px]">
        <div className={cn("mx-auto mb-3 grid size-11 place-items-center rounded-full border [&>svg]:size-5", kind === "soon" ? "border-ember/30 bg-ember-soft text-ember" : "border-warn/30 bg-warn-soft text-warn")}>{kind === "soon" ? <Hourglass /> : <TriangleAlert />}</div>
        <div className="text-[14px] font-semibold text-fg">{kind === "soon" ? t("trader.opt.soon.title") : t("trader.opt.error.title")}</div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-3">{kind === "soon" ? t("trader.opt.soon.text") : t("trader.opt.error.text")}</p>
        {kind === "soon" && (
          <ul className="mx-auto mt-3 grid max-w-[340px] gap-1 text-start text-[11.5px] text-fg-2">
            {(["trader.opt.soon.point1", "trader.opt.soon.point2", "trader.opt.soon.point3"] as const).map((k) => (
              <li key={k} className="flex items-start gap-2">
                <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-ember" />
                {t(k)}
              </li>
            ))}
          </ul>
        )}
        {onRetry && (
          <button onClick={onRetry} className="mx-auto mt-4 inline-flex h-7 items-center gap-1.5 rounded-[7px] border border-line px-3 text-[12px] font-medium text-fg-2 transition-colors hover:border-fg-3/50 hover:text-fg">
            <RefreshCw className="size-3.5" /> {t("trader.opt.soon.retry")}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The options UI, or "Options trading isn't available" while the broker has FX Options switched off (module `options`,
 * lib/modules.ts). Wraps every place the options UI mounts (workspace, side column, toolbox tabs, phone layout), so none
 * of them loads options data then. `compact`: a panel inside the toolbox or the side column.
 */
export function OptionsGate({ compact, children }: { compact?: boolean; children: React.ReactNode }) {
  return useModule("options") ? <>{children}</> : <OptionsOff compact={compact} />;
}

function OptionsOff({ compact }: { compact?: boolean }) {
  const t = useT();
  const T = useTerminal();
  // the full panel offers the other trading accounts: an options account has nothing to trade here, a CFD one has
  const others = compact || T.guest ? [] : T.accounts.filter((a) => a.login !== T.account.login);
  return (
    <div className={cn("grid h-full place-items-center text-center", compact ? "p-4" : "p-8")}>
      <div className="max-w-[420px]">
        <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full border border-line bg-panel-2 text-fg-3 [&>svg]:size-5">
          <Layers />
        </div>
        <div className="text-[14px] font-semibold text-fg">{t("features.options.offTitle")}</div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-3">{t("features.options.offText")}</p>
        {others.length > 0 && (
          <DropMenu
            width={280}
            items={others.map((a) => ({ label: `${a.login}${a.nickname ? ` · ${a.nickname}` : ""}`, hint: t.dyn(`trader.accountType.${a.type}`, a.type), onSelect: () => T.switchAccount(a.login) }))}
            trigger={({ toggle, open }) => (
              <button onClick={toggle} aria-expanded={open} aria-haspopup="menu" className="mx-auto mt-4 inline-flex h-7 items-center gap-1.5 rounded-[7px] border border-line px-3 text-[12px] font-medium text-fg-2 transition-colors hover:border-fg-3/50 hover:text-fg">
                {t("trader.account.switch")} <ChevronDown className={cn("size-3.5 text-fg-3 transition-transform", open && "rotate-180")} />
              </button>
            )}
          />
        )}
      </div>
    </div>
  );
}

/**
 * A rejection with what to do about it. `not_eligible` is not an error for the client: one quick step (read the
 * 1-minute options intro in the Client Area and tick "I understand"), so it reads as a friendly info note.
 */
export function ErrorNote({ code, message, className }: { code: string; message?: string; className?: string }) {
  const t = useT();
  if (needsOnboarding(code))
    return (
      <div role="status" className={cn("rounded-[7px] border border-info/30 bg-info-soft/40 px-2.5 py-2 text-[11.5px]", className)}>
        <div className="flex items-center gap-1.5 font-semibold text-fg">
          <BookOpen className="size-3.5 text-info" /> {t("trader.opt.err.not_eligible")}
        </div>
        <p className="mt-0.5 leading-relaxed text-fg-2">{t("trader.opt.onboarding.text")}</p>
        <a href={ONBOARDING_URL} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex h-6 items-center gap-1 rounded-[5px] border border-info/35 bg-surface-2 px-2 text-[11px] font-semibold text-info transition-colors hover:bg-info-soft">
          {t("trader.opt.onboarding.cta")} <ArrowUpRight className="size-3" />
        </a>
      </div>
    );
  return (
    <div role="alert" className={cn("flex items-start gap-1.5 rounded-[7px] border border-down/30 bg-down-soft/60 px-2.5 py-1.5 text-[11.5px] text-down", className)}>
      <TriangleAlert className="mt-px size-3.5 shrink-0" />
      <span className="leading-snug">{optionErrorText(code, message)}</span>
    </div>
  );
}

/* one shared 1-second clock for every countdown on screen */
let nowMs = Date.now();
const nowSubs = new Set<() => void>();
let nowTimer: ReturnType<typeof setInterval> | null = null;
function subscribeNow(l: () => void) {
  nowMs = Date.now();
  nowSubs.add(l);
  if (!nowTimer)
    nowTimer = setInterval(() => {
      nowMs = Date.now();
      nowSubs.forEach((f) => f());
    }, 1000);
  return () => {
    nowSubs.delete(l);
    if (!nowSubs.size && nowTimer) {
      clearInterval(nowTimer);
      nowTimer = null;
    }
  };
}

/** The time now, updated once a second while mounted (countdowns, expiry tabs). */
export function useNow(): number {
  return React.useSyncExternalStore(subscribeNow, () => nowMs, () => nowMs);
}

/** Live countdown to an instant (re-renders once a second while mounted). */
export function Countdown({ to, className, prefix }: { to: number; className?: string; prefix?: React.ReactNode }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = to - now;
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const text = left <= 0 ? "0s" : d ? `${d}d ${h}h` : h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s).padStart(2, "0")}s`;
  return (
    <span className={cn("k-num inline-flex items-center gap-1 font-mono", left < 3_600_000 && left > 0 && "text-warn", className)}>
      <Clock3 className="size-3 shrink-0 opacity-70" />
      {prefix}
      {text}
    </span>
  );
}
