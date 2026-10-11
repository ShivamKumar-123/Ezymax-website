"use client";

// The deposit entry gate: opening Deposit shows a popup with the two payment brands (OxaPay crypto checkout and
// PhonePe UPI / bank). Choosing one shows a Terms & Conditions step; agreeing takes the client straight to that
// method's deposit panel. Only the brands the broker has enabled are offered.

import * as React from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronLeft, ShieldCheck } from "lucide-react";
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
  const [step, setStep] = React.useState<"pick" | "terms">("pick");
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

  const proceed = () => {
    if (sel && agreed) onChoose(sel);
  };

  const brandName = sel === "checkout" ? "OxaPay" : "PhonePe";

  return (
    <Dialog
      open={open}
      // closing the dialog without a choice goes back to the wallet
      onOpenChange={(o) => !o && onClose()}
      width={460}
      title={step === "pick" ? t("payments.gate.title") : t("payments.gate.termsTitle")}
      description={step === "pick" ? t("payments.gate.subtitle") : t("payments.gate.termsFor", { brand: brandName })}
    >
      {step === "pick" ? (
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
