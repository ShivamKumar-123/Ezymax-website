"use client";

// The deposit entry gate: opening Deposit shows a popup with the two payment brands (OxaPay crypto checkout and
// PhonePe UPI / bank), each with the provider's own logo. Choosing one shows a Terms & Conditions step; agreeing
// runs a short secure-handoff animation and then opens that method's deposit panel.
//
// Only the brands the broker has enabled are offered.

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, ChevronLeft, Lock, ShieldCheck } from "lucide-react";
import { Button, Dialog, cn } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";
import { OXAPAY_BRAND, PHONEPE_BRAND, type PayBrand } from "./brand-logos";

export type DepositVia = "checkout" | "bank";

/** A brand plus the deposit route it stands for. */
type Brand = PayBrand & { via: DepositVia };

const OXAPAY: Brand = { ...OXAPAY_BRAND, via: "checkout" };
const PHONEPE: Brand = { ...PHONEPE_BRAND, via: "bank" };

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

function BrandTile({ brand, sub, onClick }: { brand: Brand; sub: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className="group relative flex w-full items-center gap-4 overflow-hidden rounded-[16px] border border-line bg-surface-2/50 px-4 py-4 text-start transition-colors hover:border-[var(--brand)]/45"
      style={{ ["--brand" as string]: brand.colour }}
    >
      {/* the brand's colour washes in from the left on hover */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, ${brand.colour}1f, transparent 60%)` }}
      />
      <span className="relative grid size-12 shrink-0 place-items-center rounded-[14px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] ring-1 ring-black/5">
        {brand.mark(30)}
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="flex h-[18px] items-center">{brand.wordmark ? brand.wordmark() : <span className="text-[15.5px] font-semibold text-fg">{brand.name}</span>}</span>
        <span className="mt-1 block truncate text-[12.5px] text-fg-3">{sub}</span>
      </span>
      <ArrowRight className="relative size-4 shrink-0 text-fg-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-fg" />
    </motion.button>
  );
}

/* -------------------------------- handoff --------------------------------- */

const STEP_MS = 850;

/**
 * The secure handoff: the provider's logo inside a rotating gradient halo, one status line crossfading through
 * the steps, and a three-segment progress bar. Each line names something the app is really doing, so the pause
 * is an honest handoff rather than a decorative loader.
 */
function Handoff({ brand, steps, secure, done }: { brand: Brand; steps: string[]; secure: string; done: () => void }) {
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
        {/* brand-coloured glow, breathing */}
        <motion.span
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: brand.colour }}
          animate={{ opacity: [0.18, 0.34, 0.18], scale: [0.9, 1.08, 0.9] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* the halo: a conic arc sweeping around the mark */}
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: `conic-gradient(from 0deg, transparent 0deg, ${brand.colour} 110deg, transparent 220deg)` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
        <span className="absolute inset-[3px] rounded-full bg-surface" />
        <span className="absolute inset-[3px] rounded-full border border-line" />
        {/* the provider's logo, on white so it always reads as its own brand */}
        <motion.span
          className="relative grid size-[74px] place-items-center rounded-full bg-white shadow-[0_4px_18px_-6px_rgba(0,0,0,0.35)] ring-1 ring-black/5"
          initial={{ scale: 0.86, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
        >
          {brand.mark(42)}
        </motion.span>
      </div>

      {/* one status line at a time */}
      <div className="relative mt-6 h-6 w-full">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={at}
            className="absolute inset-0 text-center text-[14px] font-medium text-fg"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            {steps[at]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* one segment per step */}
      <div className="mt-4 flex w-full max-w-[220px] gap-1.5">
        {steps.map((s, i) => (
          <span key={s} className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-3">
            <motion.span
              className="block h-full rounded-full"
              style={{ background: brand.colour }}
              initial={{ width: "0%" }}
              animate={{ width: i <= at ? "100%" : "0%" }}
              transition={{ duration: i === at ? STEP_MS / 1000 : 0.2, ease: "linear" }}
            />
          </span>
        ))}
      </div>

      <motion.div
        className="mt-5 flex items-center gap-1.5 text-[11.5px] text-fg-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Lock className="size-3" />
        <span>{secure}</span>
      </motion.div>
    </div>
  );
}

/* --------------------------------- gate ----------------------------------- */

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
  const [sel, setSel] = React.useState<Brand | null>(null);
  const [agreed, setAgreed] = React.useState(false);

  // start fresh every time the gate opens
  React.useEffect(() => {
    if (open) {
      setStep("pick");
      setSel(null);
      setAgreed(false);
    }
  }, [open]);

  const pick = (b: Brand) => {
    setSel(b);
    setAgreed(false);
    setStep("terms");
  };

  const brandName = sel?.name ?? "";

  return (
    <Dialog
      open={open}
      // closing without a choice goes back to the wallet
      onOpenChange={(o) => !o && onClose()}
      width={460}
      title={step === "pick" ? t("payments.gate.title") : step === "terms" ? t("payments.gate.termsTitle") : t("payments.gate.connecting", { brand: brandName })}
      description={
        step === "pick" ? t("payments.gate.subtitle") : step === "terms" ? t("payments.gate.termsFor", { brand: brandName }) : t("payments.gate.connectingSub")
      }
    >
      {step === "handoff" && sel ? (
        <Handoff
          brand={sel}
          secure={t("payments.gate.secure")}
          steps={[t("payments.gate.step1"), t("payments.gate.step2", { brand: sel.name }), t("payments.gate.step3")]}
          done={() => onChoose(sel.via)}
        />
      ) : step === "pick" ? (
        <div className="space-y-3">
          {hasCheckout && <BrandTile brand={OXAPAY} sub={t("payments.gate.oxapaySub")} onClick={() => pick(OXAPAY)} />}
          {hasBank && <BrandTile brand={PHONEPE} sub={t("payments.gate.phonepeSub")} onClick={() => pick(PHONEPE)} />}
          {!hasCheckout && !hasBank && <div className="py-6 text-center text-[13px] text-fg-3">{t("payments.gate.none")}</div>}
        </div>
      ) : (
        <div className="space-y-4">
          {sel && (
            <div className="flex items-center gap-3 rounded-[14px] border border-line bg-surface-2/60 px-4 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-white ring-1 ring-black/5">{sel.mark(26)}</span>
              <span className="flex h-[18px] items-center">{sel.wordmark ? sel.wordmark() : <span className="text-[15px] font-semibold text-fg">{sel.name}</span>}</span>
            </div>
          )}
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
            <Button variant="ember" onClick={() => agreed && setStep("handoff")} disabled={!agreed}>
              {t("payments.gate.continueTo", { brand: brandName })} <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
