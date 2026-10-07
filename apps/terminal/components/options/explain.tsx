"use client";

// "What is this?" help for the options workspace: a small (?) next to a word opens a short explanation in plain
// language (a popover on desktop, a bottom sheet on phones), and "Options in 30 seconds", the four facts a CFD
// trader needs before a first option trade. Every explanation avoids Greeks unless the topic is the Greeks.
import * as React from "react";
import { CircleHelp, GraduationCap, X } from "lucide-react";
import { cn } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { DropMenu } from "@/components/ui/menu";

export type HelpTopic = "call" | "put" | "strike" | "premium" | "expiry" | "breakeven" | "contracts" | "itm" | "atm" | "selling" | "margin" | "greeks" | "chance" | "mark";

const TITLE = {
  call: "trader.opt.help.call.title",
  put: "trader.opt.help.put.title",
  strike: "trader.opt.help.strike.title",
  premium: "trader.opt.help.premium.title",
  expiry: "trader.opt.help.expiry.title",
  breakeven: "trader.opt.help.breakeven.title",
  contracts: "trader.opt.help.contracts.title",
  itm: "trader.opt.help.itm.title",
  atm: "trader.opt.help.atm.title",
  selling: "trader.opt.help.selling.title",
  margin: "trader.opt.help.margin.title",
  greeks: "trader.opt.help.greeks.title",
  chance: "trader.opt.help.chance.title",
  mark: "trader.opt.help.mark.title",
} as const;
const TEXT = {
  call: "trader.opt.help.call.text",
  put: "trader.opt.help.put.text",
  strike: "trader.opt.help.strike.text",
  premium: "trader.opt.help.premium.text",
  expiry: "trader.opt.help.expiry.text",
  breakeven: "trader.opt.help.breakeven.text",
  contracts: "trader.opt.help.contracts.text",
  itm: "trader.opt.help.itm.text",
  atm: "trader.opt.help.atm.text",
  selling: "trader.opt.help.selling.text",
  margin: "trader.opt.help.margin.text",
  greeks: "trader.opt.help.greeks.text",
  chance: "trader.opt.help.chance.text",
  mark: "trader.opt.help.mark.text",
} as const;

/** A (?) that explains `topic`; `label` renders the word itself as the trigger (dotted underline). */
export function Explain({ topic, label, className, size = 13 }: { topic: HelpTopic; label?: React.ReactNode; className?: string; size?: number }) {
  const t = useT();
  return (
    <DropMenu
      width={288}
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggle(e);
          }}
          aria-label={`${t("trader.opt.help.what")} ${t(TITLE[topic])}`}
          aria-expanded={open}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 align-middle text-fg-3 transition-colors hover:text-fg-2",
            label && "underline decoration-fg-3/50 decoration-dotted underline-offset-[3px] hover:decoration-fg-2",
            open && "text-fg-2",
            className,
          )}
        >
          {label}
          <CircleHelp style={{ width: size, height: size }} className="shrink-0 opacity-80" />
        </button>
      )}
    >
      {(close) => (
        <div className="p-3" dir="auto">
          <div className="flex items-start gap-2">
            <span className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-ember-soft text-ember">
              <CircleHelp className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-fg">{t(TITLE[topic])}</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-fg-2">{t(TEXT[topic])}</p>
            </div>
            <button onClick={close} aria-label={t("common.close")} className="grid size-6 shrink-0 place-items-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-fg">
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </DropMenu>
  );
}

const INTRO_KEY = "kalks.options.intro.hidden";

function readHidden() {
  try {
    return localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

/** The intro is hidden once the trader tapped "Got it" (per browser); "How options work" brings it back. */
export function useIntroHidden(): [boolean, (v: boolean) => void] {
  const [hidden, setHidden] = React.useState(true);
  React.useEffect(() => {
    setHidden(readHidden());
  }, []);
  const set = React.useCallback((v: boolean) => {
    setHidden(v);
    try {
      if (v) localStorage.setItem(INTRO_KEY, "1");
      else localStorage.removeItem(INTRO_KEY);
    } catch {
      /* storage blocked */
    }
  }, []);
  return [hidden, set];
}

const FACTS = ["trader.opt.intro.f1", "trader.opt.intro.f2", "trader.opt.intro.f3", "trader.opt.intro.f4"] as const;

/** "Options in 30 seconds": four facts, numbered. */
export function IntroFacts({ className }: { className?: string }) {
  const t = useT();
  return (
    <ol className={cn("grid gap-2", className)} dir="auto">
      {FACTS.map((k, i) => (
        <li key={k} className="flex items-start gap-2.5 text-[12.5px] leading-snug text-fg-2">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-3 font-mono text-[10.5px] font-semibold text-fg">{i + 1}</span>
          <span>{t(k)}</span>
        </li>
      ))}
    </ol>
  );
}

/** The intro as a dismissible card (guided flow, empty ticket). */
export function IntroCard({ className, onHide }: { className?: string; onHide?: () => void }) {
  const t = useT();
  // a one-line banner first, so the Up / Down steps stay in view; the four facts open on a click
  const [open, setOpen] = React.useState(false);
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className={cn("flex h-9 w-full items-center gap-2 rounded-[10px] border border-ember/25 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--k-ember)_10%,transparent),transparent_60%)] px-2.5 text-start text-[12.5px] font-medium text-fg-2 transition-colors hover:border-ember/45 hover:text-fg", className)}>
        <GraduationCap className="size-4 shrink-0 text-ember" />
        <span className="min-w-0 flex-1 truncate">{t("desk.opt.learn30")}</span>
        <span aria-hidden className="text-accent-text">→</span>
      </button>
    );
  return (
    <div className={cn("relative overflow-hidden rounded-[12px] border border-ember/25 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--k-ember)_10%,transparent),transparent_60%)] p-3", className)}>
      <div className="mb-2 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-full bg-ember-soft text-ember">
          <GraduationCap className="size-4" />
        </span>
        <span className="min-w-0 flex-1 text-[13px] font-semibold text-fg">{t("trader.opt.intro.title")}</span>
        {onHide && (
          <button onClick={onHide} className="h-6 shrink-0 rounded-[6px] px-2 text-[11.5px] font-medium text-fg-2 hover:bg-surface-3 hover:text-fg">
            {t("trader.opt.intro.gotIt")}
          </button>
        )}
      </div>
      <IntroFacts />
    </div>
  );
}

/** "How options work" button: the intro in a popover (header of the workspace). */
export function HowItWorks({ className, compact }: { className?: string; compact?: boolean }) {
  const t = useT();
  return (
    <DropMenu
      width={340}
      align="end"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-expanded={open} title={t("trader.opt.intro.how")} className={cn("flex h-6 shrink-0 items-center gap-1.5 rounded-[6px] border border-line px-2 text-[11px] font-medium text-fg-2 transition-colors hover:border-fg-3/40 hover:text-fg", open && "bg-surface-3 text-fg", className)}>
          <GraduationCap className="size-3.5 text-ember" />
          {!compact && <span className="whitespace-nowrap">{t("trader.opt.intro.how")}</span>}
        </button>
      )}
    >
      {() => (
        <div className="p-3.5">
          <div className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-fg">
            <GraduationCap className="size-4 text-ember" /> {t("trader.opt.intro.title")}
          </div>
          <IntroFacts />
        </div>
      )}
    </DropMenu>
  );
}
