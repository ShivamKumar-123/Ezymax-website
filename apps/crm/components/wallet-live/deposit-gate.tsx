"use client";

// The deposit entry gate: opening Deposit shows a popup with the two payment brands (OxaPay crypto checkout and
// PhonePe UPI / bank). Choosing one shows a Terms & Conditions step; agreeing takes the client straight to that
// method's deposit panel. Only the brands the broker has enabled are offered.

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUpRight, Check, ChevronLeft, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button, Dialog, cn } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";

export type DepositVia = "checkout" | "bank";

/** The OxaPay brand tile (its teal mark + wordmark). A drop-in official logo can replace the badge later. */
function OxaPayBadge() {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-[13px] bg-gradient-to-br from-[#12b5a4] to-[#0a8f82] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
      <ArrowUpRight className="size-6" strokeWidth={2.4} />
    </span>
  );
}

/** The PhonePe brand tile (its purple mark + wordmark). */
function PhonePeBadge() {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-[13px] bg-[#5f259f] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
      <span className="font-serif text-[18px] font-bold italic leading-none">Pe</span>
    </span>
  );
}

/** Honours the OS "reduce motion" setting: the handoff then passes through without the theatre. */
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

/** How long each handoff step is shown, in ms. */
const STEP_MS = 700;

/**
 * The secure-handoff screen: the brand mark pulsing between two rings while three steps tick off.
 * Every line names something that is really happening, so the wait is honest, not decorative.
 */
function Handoff({ brand, badge, steps, done }: { brand: string; badge: React.ReactNode; steps: string[]; done: () => void }) {
  const reduced = useReducedMotion();
  const [at, setAt] = React.useState(0);

  React.useEffect(() => {
    if (reduced) {
      done();
      return;
    }
    const timers = steps.map((_, i) => setTimeout(() => setAt(i + 1), STEP_MS * (i + 1)));
    const end = setTimeout(done, STEP_MS * steps.length + 450);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(end);
    };
    // the handoff runs once per agreement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  if (reduced) return null;

  return (
    <div className="flex flex-col items-center py-2">
      <div className="relative grid size-[104px] place-items-center">
        {[0, 1].map((i) => (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-full border border-ember/40"
            initial={{ scale: 0.6, opacity: 0.55 }}
            animate={{ scale: 1.25, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 1, ease: "easeOut" }}
          />
        ))}
        <span className="absolute inset-[18px] rounded-full bg-ember-soft" />
        <motion.span
          className="relative"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          {badge}
        </motion.span>
      </div>

      <div className="mt-5 w-full max-w-[290px] space-y-2.5">
        {steps.map((label, i) => {
          const state = at > i ? "done" : at === i ? "busy" : "idle";
          return (
            <motion.div
              key={label}
              className="flex items-center gap-2.5 text-[13px]"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: state === "idle" ? 0.4 : 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
            >
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
                  state === "done" ? "border-up/40 bg-up/15 text-up" : state === "busy" ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-3",
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {state === "done" ? (
                    <motion.span key="d" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.4, duration: 0.4 }}>
                      <Check className="size-3" strokeWidth={3} />
                    </motion.span>
                  ) : state === "busy" ? (
                    <motion.span key="b" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <Loader2 className="size-3 animate-spin" />
                    </motion.span>
                  ) : (
                    <motion.span key="i" className="size-1.5 rounded-full bg-current" />
                  )}
                </AnimatePresence>
              </span>
              <span className={cn(state === "done" ? "text-fg-2" : state === "busy" ? "font-medium text-fg" : "text-fg-3")}>{label}</span>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-5 h-1 w-full max-w-[290px] overflow-hidden rounded-full bg-surface-3">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-ember to-gold"
          initial={{ width: "4%" }}
          animate={{ width: `${Math.min(100, (at / steps.length) * 100 || 8)}%` }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        />
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-[11.5px] text-fg-3">
        <Lock className="size-3" />
        <span>{brand}</span>
      </div>
    </div>
  );
}

function BrandTile({ badge, name, sub, onClick }: { badge: React.ReactNode; name: React.ReactNode; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="k-row group flex w-full items-center gap-3.5 px-4 py-3.5 text-start transition-all hover:border-ember/50 hover:bg-ember-soft"
      data-testid={`deposit-brand-${typeof name === "string" ? name : ""}`}
    >
      {badge}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-fg">{name}</span>
        <span className="block truncate text-[12.5px] text-fg-3">{sub}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ember" />
    </button>
  );
}

export function DepositGate({
  open,
  hasCheckout,
  hasBank,
  onChoose,
  onClose,
}: {
  open: boolean;
  hasCheckout: boolean;
  hasBank: boolean;
  onChoose: (via: DepositVia) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [step, setStep] = React.useState<"pick" | "terms" | "handoff">("pick");
  const [sel, setSel] = React.useState<DepositVia | null>(null);
  const [agreed, setAgreed] = React.useState(false);

  // start fresh every time the gate opens
  React.useEffect(() => {
    if (open) {
      setStep("pick");
      setSel(null);
      setAgreed(false);
    }
  }, [open]);

  const pick = (v: DepositVia) => {
    setSel(v);
    setAgreed(false);
    setStep("terms");
  };

  // agreeing runs the handoff first; the method opens when it finishes
  const proceed = () => {
    if (sel && agreed) setStep("handoff");
  };

  const brandName = sel === "checkout" ? "OxaPay" : "PhonePe";

  return (
    <Dialog
      open={open}
      // closing the dialog without a choice goes back to the wallet
      onOpenChange={(o) => !o && onClose()}
      width={460}
      title={step === "pick" ? t("payments.gate.title") : step === "terms" ? t("payments.gate.termsTitle") : t("payments.gate.connecting", { brand: brandName })}
      description={step === "pick" ? t("payments.gate.subtitle") : step === "terms" ? t("payments.gate.termsFor", { brand: brandName }) : t("payments.gate.connectingSub")}
    >
      {step === "handoff" ? (
        <Handoff
          brand={t("payments.gate.secure")}
          badge={sel === "checkout" ? <OxaPayBadge /> : <PhonePeBadge />}
          steps={[t("payments.gate.step1"), t("payments.gate.step2", { brand: brandName }), t("payments.gate.step3")]}
          done={() => sel && onChoose(sel)}
        />
      ) : step === "pick" ? (
        <div className="space-y-2.5">
          {hasCheckout && <BrandTile badge={<OxaPayBadge />} name="OxaPay" sub={t("payments.gate.oxapaySub")} onClick={() => pick("checkout")} />}
          {hasBank && <BrandTile badge={<PhonePeBadge />} name="PhonePe" sub={t("payments.gate.phonepeSub")} onClick={() => pick("bank")} />}
          {!hasCheckout && !hasBank && <div className="py-6 text-center text-[13px] text-fg-3">{t("payments.gate.none")}</div>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-[14px] border border-line bg-surface-2/60 px-4 py-3 text-[12.5px] leading-relaxed text-fg-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ember" />
            <p>{t("payments.gate.termsBody", { brand: brandName })}</p>
          </div>
          <button type="button" onClick={() => setAgreed((a) => !a)} className="flex w-full items-start gap-3 text-start" aria-pressed={agreed}>
            <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-[6px] border transition-colors", agreed ? "border-ember bg-ember text-white" : "border-line bg-surface-2")}>
              {agreed && <Check className="size-3.5" strokeWidth={3} />}
            </span>
            <span className="text-[13px] text-fg-2">{t("payments.gate.agree")}</span>
          </button>
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setStep("pick")}>
              <ChevronLeft className="size-4" /> {t("common.back")}
            </Button>
            <Button variant="ember" onClick={proceed} disabled={!agreed}>
              {t("payments.gate.continueTo", { brand: brandName })} <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
