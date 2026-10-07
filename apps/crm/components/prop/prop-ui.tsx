"use client";

import * as React from "react";
import { AnimatePresence, motion, animate, useInView } from "motion/react";
import { ArrowUpRight, ChevronDown, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Chip, CopyButton, cn } from "@/components/kit";
import type { RuleState } from "@kalks/mock/prop";

/* ------------------------------------------------------------------ */
/* Rule state chip                                                     */
/* ------------------------------------------------------------------ */

export function RuleChip({ state }: { state: RuleState }) {
  if (state === "passed")
    return (
      <Chip size="sm" tone="up" dot>
        Passed
      </Chip>
    );
  if (state === "failed")
    return (
      <Chip size="sm" tone="down" dot>
        Failed
      </Chip>
    );
  return (
    <Chip size="sm" tone="ember" className="gap-1.5">
      <span className="size-1.5 animate-pulse rounded-full bg-ember" />
      Ongoing
    </Chip>
  );
}

/* ------------------------------------------------------------------ */
/* Rule card (ref 2: title + status chip, inner sub-rows with ↗)       */
/* ------------------------------------------------------------------ */

export function RuleCard({
  icon,
  title,
  state,
  progress,
  progressTone = "ember",
  progressLabel,
  children,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  state: RuleState;
  progress?: number;
  progressTone?: "ember" | "up" | "down" | "gold" | "warn";
  progressLabel?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const bar = { ember: "from-[var(--k-ember-2)] to-[color-mix(in_oklab,var(--k-ember)_78%,#000)]", up: "from-up/70 to-up", down: "from-down/70 to-down", gold: "from-[#f3cf6b] to-[#c9971f]", warn: "from-warn/70 to-warn" }[progressTone];
  return (
    <div className={cn("k-card flex h-full flex-col p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 [&_svg]:size-[15px]">{icon}</span>
          <span className="truncate text-[14.5px] font-medium">{title}</span>
        </div>
        <RuleChip state={state} />
      </div>
      {progress !== undefined && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11.5px] text-fg-3">{progressLabel}</div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
            <motion.div
              className={cn("h-full rounded-full bg-gradient-to-r", bar)}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            />
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}

export function RuleRow({ icon, label, value, tone, onClick }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: "up" | "down" | "warn"; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick ?? (() => toast(label, { description: typeof value === "string" ? value : undefined }))}
      className="k-row group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-3/70"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-fg-2 [&_svg]:size-3.5">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10.5px] text-fg-3">{label}</span>
        <span className={cn("k-num block truncate text-[14px] font-medium", tone === "up" && "text-up", tone === "down" && "text-down", tone === "warn" && "text-warn")}>{value}</span>
      </span>
      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-fg-3 transition-colors group-hover:border-ember/40 group-hover:text-ember">
        <ArrowUpRight className="size-3.5" />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Countdown to daily loss reset (00:00 GMT+3)                         */
/* ------------------------------------------------------------------ */

function msToReset(now: number) {
  const shifted = now + 3 * 3600_000; // GMT+3 wall clock
  const d = new Date(shifted);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return next - shifted;
}

export function ResetCountdown({ className }: { className?: string }) {
  const [ms, setMs] = React.useState<number | null>(null);
  React.useEffect(() => {
    const tick = () => setMs(msToReset(Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  const parts = ms === null ? ["--", "--", "--"] : [Math.floor(ms / 3600_000), Math.floor((ms % 3600_000) / 60_000), Math.floor((ms % 60_000) / 1000)].map((n) => String(n).padStart(2, "0"));
  return (
    <div className={cn("flex items-center justify-center gap-1.5", className)}>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1">
            <div className="k-row relative grid h-14 w-14 place-items-center overflow-hidden shadow-[inset_0_1px_0_var(--k-border-top)] sm:h-16 sm:w-16">
              <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-line" />
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={p}
                  initial={{ y: -14, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 14, opacity: 0 }}
                  transition={{ duration: 0.28 }}
                  className="k-num font-mono text-[24px] font-semibold tracking-tight sm:text-[28px]"
                >
                  {p}
                </motion.span>
              </AnimatePresence>
            </div>
            <span className="text-[9.5px] uppercase tracking-[0.12em] text-fg-3">{["Hours", "Min", "Sec"][i]}</span>
          </div>
          {i < 2 && <span className="-mt-5 font-mono text-xl text-fg-3">:</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Credential field with eye toggle + copy                             */
/* ------------------------------------------------------------------ */

export function CredentialField({ label, value, secret, mono = true }: { label: string; value: string; secret?: boolean; mono?: boolean }) {
  const [show, setShow] = React.useState(!secret);
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-[11px] text-fg-3">{label}</div>
      <div className="flex h-10 items-center gap-1 rounded-[12px] border border-line bg-surface-2 pl-3 pr-1.5">
        <span className={cn("min-w-0 flex-1 truncate text-[13px]", mono && "font-mono", !show && "tracking-[0.2em]")}>{show ? value : "••••••••"}</span>
        {secret && (
          <button type="button" onClick={() => setShow((s) => !s)} className="grid size-6 place-items-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label={show ? "Hide" : "Show"}>
            {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        )}
        <CopyButton value={value} label={label} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Count-up number (plain, for non-money stats)                        */
/* ------------------------------------------------------------------ */

export function CountUp({ value, decimals = 0, prefix = "", suffix = "", className }: { value: number; decimals?: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = React.useState(value * 0.7);
  React.useEffect(() => {
    if (!inView) return;
    const c = animate(value * 0.7, value, { duration: 1, ease: [0.16, 1, 0.3, 1], onUpdate: setV });
    return () => c.stop();
  }, [inView, value]);
  return (
    <span ref={ref} className={cn("k-num", className)}>
      {prefix}
      {v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Accordion                                                           */
/* ------------------------------------------------------------------ */

export function Accordion({ items, defaultOpen = 0 }: { items: { q: string; a: string }[]; defaultOpen?: number }) {
  const [open, setOpen] = React.useState<number | null>(defaultOpen);
  return (
    <div className="space-y-2">
      {items.map((it, i) => {
        const on = open === i;
        return (
          <div key={it.q} className={cn("k-row overflow-hidden transition-colors", on && "border-[var(--k-border-top)] bg-surface-3/40")}>
            <button type="button" onClick={() => setOpen(on ? null : i)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5" aria-expanded={on}>
              <span className={cn("k-num w-6 shrink-0 font-mono text-[12px]", on ? "text-ember" : "text-fg-3")}>{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1 text-[14px] font-medium">{it.q}</span>
              <ChevronDown className={cn("size-4 shrink-0 text-fg-3 transition-transform duration-300", on && "rotate-180 text-ember")} />
            </button>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
                  <p className="px-4 pb-4 pl-13 text-[13.5px] leading-relaxed text-fg-2 sm:px-5 sm:pl-14">{it.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Check box                                                           */
/* ------------------------------------------------------------------ */

export function CheckBox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-snug text-fg-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[6px] border transition-colors", checked ? "border-ember bg-ember text-white" : "border-line bg-surface-2")}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="size-3 fill-none stroke-current stroke-2">
            <path d="M2.5 6.2l2.2 2.2 4.8-4.8" />
          </svg>
        )}
      </button>
      <span onClick={() => onChange(!checked)}>{children}</span>
    </div>
  );
}
