"use client";

// The withdrawal entry gate, the mirror of deposit-gate.tsx: opening Withdraw shows a popup with the ways out
// the broker has open - USDT to the client's own wallet, UPI to their own ID - each with what it means in one
// line. Choosing one shows what the client is agreeing to; agreeing runs a short handoff animation and then
// opens that rail's request form.
//
// The consent step is not decoration. A payout is irreversible and goes to an address or an ID the client types
// themselves, so the line they tick is the one thing standing between a typo and lost money.

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, ChevronLeft, Lock, ShieldCheck, Smartphone } from "lucide-react";
import { Button, CoinIcon, Dialog, cn } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";

export type WithdrawVia = "usdt" | "upi";

type Rail = {
  via: WithdrawVia;
  name: string;
  colour: string;
  mark: (size: number) => React.ReactNode;
};

const USDT: Rail = {
  via: "usdt",
  name: "USDT",
  colour: "#26A17B",
  mark: (size) => <CoinIcon coin="usdt" size={size} />,
};

const UPI: Rail = {
  via: "upi",
  name: "UPI",
  colour: "#5F259F",
  mark: (size) => <Smartphone style={{ width: size * 0.66, height: size * 0.66 }} className="text-[#5F259F]" strokeWidth={1.75} />,
};

/** Honours the OS "reduce motion" setting: the handoff then passes straight through. */
function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

/* ---------------------------------- pick ---------------------------------- */

function RailTile({ rail, sub, onClick }: { rail: Rail; sub: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className="group relative flex w-full items-center gap-4 overflow-hidden rounded-[16px] border border-line bg-surface-2/50 px-4 py-4 text-start transition-colors hover:border-[var(--rail)]/45"
      style={{ ["--rail" as string]: rail.colour }}
      data-testid={`withdraw-gate-${rail.via}`}
    >
      {/* the rail's colour washes in from the left on hover */}
      <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: `linear-gradient(90deg, ${rail.colour}1f, transparent 60%)` }} />
      <span className="relative grid size-12 shrink-0 place-items-center rounded-[14px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] ring-1 ring-black/5">{rail.mark(30)}</span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-[15.5px] font-semibold text-fg">{rail.name}</span>
        <span className="mt-1 block truncate text-[12.5px] text-fg-3">{sub}</span>
      </span>
      <ArrowRight className="relative size-4 shrink-0 text-fg-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-fg" />
    </motion.button>
  );
}

/* -------------------------------- handoff --------------------------------- */

const STEP_MS = 850;

/**
 * The same shape as the deposit handoff: the rail's mark inside a rotating halo, one status line crossfading
 * through the steps, and a segment per step. Each line names something the page is really about to do, so the
 * pause is an honest handoff and not a decorative loader.
 */
function Handoff({ rail, steps, secure, done }: { rail: Rail; steps: string[]; secure: string; done: () => void }) {
  const reduced = useReducedMotion();
  const [at, setAt] = React.useState(0);

  React.useEffect(() => {
    if (reduced) {
      done();
      return;
    }
    const timers = steps.map((_, i) => setTimeout(() => setAt(i), STEP_MS * i));
    const end = setTimeout(done, STEP_MS * steps.length);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(end);
    };
    // the handoff runs once, when the client agrees
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  if (reduced) return null;

  return (
    <div className="flex flex-col items-center py-4">
      <div className="relative grid size-[112px] place-items-center">
        <motion.span
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: rail.colour }}
          animate={{ opacity: [0.18, 0.34, 0.18], scale: [0.9, 1.08, 0.9] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: `conic-gradient(from 0deg, transparent 0deg, ${rail.colour} 110deg, transparent 220deg)` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
        <span className="absolute inset-[3px] rounded-full bg-surface" />
        <span className="absolute inset-[3px] rounded-full border border-line" />
        <motion.span
          className="relative grid size-[74px] place-items-center rounded-full bg-white shadow-[0_4px_18px_-6px_rgba(0,0,0,0.35)] ring-1 ring-black/5"
          initial={{ scale: 0.86, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
        >
          {rail.mark(42)}
        </motion.span>
      </div>

      <div className="relative mt-6 h-6 w-full">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={at} className="absolute inset-0 text-center text-[14px] font-medium text-fg" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: "easeOut" }}>
            {steps[at]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex w-full max-w-[220px] gap-1.5">
        {steps.map((s, i) => (
          <span key={s} className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-3">
            <motion.span className="block h-full rounded-full" style={{ background: rail.colour }} initial={{ width: "0%" }} animate={{ width: i <= at ? "100%" : "0%" }} transition={{ duration: i === at ? STEP_MS / 1000 : 0.2, ease: "linear" }} />
          </span>
        ))}
      </div>

      <motion.div className="mt-5 flex items-center gap-1.5 text-[11.5px] text-fg-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <Lock className="size-3" />
        <span>{secure}</span>
      </motion.div>
    </div>
  );
}

/* --------------------------------- gate ----------------------------------- */

export function WithdrawGate({ open, hasUsdt, hasUpi, currency, onChoose, onClose }: { open: boolean; hasUsdt: boolean; hasUpi: boolean; currency: string | null; onChoose: (via: WithdrawVia) => void; onClose: () => void }) {
  const t = useT();
  const [step, setStep] = React.useState<"pick" | "terms" | "handoff">("pick");
  const [sel, setSel] = React.useState<Rail | null>(null);
  const [agreed, setAgreed] = React.useState(false);

  // start fresh every time the gate opens
  React.useEffect(() => {
    if (open) {
      setStep("pick");
      setSel(null);
      setAgreed(false);
    }
  }, [open]);

  const pick = (r: Rail) => {
    setSel(r);
    setAgreed(false);
    setStep("terms");
  };

  const name = sel?.name ?? "";

  return (
    <Dialog
      open={open}
      // closing without a choice goes back to the wallet
      onOpenChange={(o) => !o && onClose()}
      width={460}
      title={step === "pick" ? t("wallet.withdrawGate.title") : step === "terms" ? t("wallet.withdrawGate.termsTitle") : t("wallet.withdrawGate.opening", { rail: name })}
      description={step === "pick" ? t("wallet.withdrawGate.subtitle") : step === "terms" ? t("wallet.withdrawGate.termsFor", { rail: name }) : t("wallet.withdrawGate.openingSub")}
    >
      {step === "handoff" && sel ? (
        <Handoff
          rail={sel}
          secure={t("wallet.withdrawGate.secure")}
          steps={[t("wallet.withdrawGate.step1"), t("wallet.withdrawGate.step2", { rail: sel.name }), t("wallet.withdrawGate.step3")]}
          done={() => onChoose(sel.via)}
        />
      ) : step === "pick" ? (
        <div className="space-y-3">
          {hasUsdt && <RailTile rail={USDT} sub={t("wallet.withdrawGate.usdtSub")} onClick={() => pick(USDT)} />}
          {hasUpi && <RailTile rail={UPI} sub={t("wallet.withdrawGate.upiSub", { currency: currency ?? "INR" })} onClick={() => pick(UPI)} />}
          {!hasUsdt && !hasUpi && <div className="py-6 text-center text-[13px] text-fg-3">{t("wallet.withdraw.noneAvailable")}</div>}
        </div>
      ) : (
        <div className="space-y-4">
          {sel && (
            <div className="flex items-center gap-3 rounded-[14px] border border-line bg-surface-2/60 px-4 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-white ring-1 ring-black/5">{sel.mark(26)}</span>
              <span className="text-[15px] font-semibold text-fg">{sel.name}</span>
            </div>
          )}
          <div className="flex items-start gap-3 rounded-[14px] border border-line bg-surface-2/60 px-4 py-3 text-[12.5px] leading-relaxed text-fg-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ember" />
            <p>{sel?.via === "upi" ? t("wallet.withdrawGate.termsUpi") : t("wallet.withdrawGate.termsUsdt")}</p>
          </div>
          <button type="button" onClick={() => setAgreed((a) => !a)} className="flex w-full items-start gap-3 text-start" aria-pressed={agreed} data-testid="withdraw-gate-agree">
            <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-[6px] border transition-colors", agreed ? "border-ember bg-ember text-white" : "border-line bg-surface-2")}>
              <AnimatePresence initial={false}>
                {agreed && (
                  <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ type: "spring", stiffness: 500, damping: 26 }}>
                    <Check className="size-3.5" strokeWidth={3} />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <span className="text-[13px] text-fg-2">{sel?.via === "upi" ? t("wallet.withdrawGate.agreeUpi") : t("wallet.withdrawGate.agreeUsdt")}</span>
          </button>
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setStep("pick")}>
              <ChevronLeft className="size-4" /> {t("common.back")}
            </Button>
            <Button variant="ember" onClick={() => agreed && setStep("handoff")} disabled={!agreed}>
              {t("wallet.withdrawGate.continueTo", { rail: name })} <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
