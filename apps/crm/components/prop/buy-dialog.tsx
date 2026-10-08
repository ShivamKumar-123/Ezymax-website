"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, CoinIcon, Dialog, Icon3D, Money, cn, formatMoney } from "@/components/kit";
import { WALLET } from "@ezymex/mock";
import type { PropModel, PropSize } from "@ezymex/mock/prop";
import { CheckBox, CredentialField } from "./prop-ui";

export function BuyChallengeDialog({ model, size, trigger }: { model: PropModel; size: PropSize; trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<"review" | "paying" | "done">("review");
  const [terms, setTerms] = React.useState(false);
  const [rules, setRules] = React.useState(false);
  const balance = WALLET.assets[0]!.balance;
  const fee = model.fees[size];
  const after = balance - fee;
  const ok = terms && rules && after >= 0;

  React.useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep("review");
        setTerms(false);
        setRules(false);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  const pay = () => {
    setStep("paying");
    setTimeout(() => {
      setStep("done");
      toast.success("Challenge purchased", { description: `${formatMoney(fee)} USDT debited from your wallet` });
    }, 1400);
  };

  const sizeLabel = `$${(size / 1000).toFixed(0)}k`;

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      width={540}
      title={step === "done" ? "You're in. Good luck!" : `Buy ${sizeLabel} ${model.name}`}
      description={step === "done" ? "Your challenge account is live on Ezymex-Prop01. Credentials were also emailed to you." : "Paid instantly from your Ezymex wallet. No card required."}
      footer={
        step === "done" ? (
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Link href="/prop/mine" onClick={() => setOpen(false)}>
              <Button variant="ember">
                Open dashboard <ArrowRight />
              </Button>
            </Link>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="ember" disabled={!ok || step === "paying"} onClick={pay} className="min-w-[180px]">
              {step === "paying" ? (
                <>
                  <Loader2 className="animate-spin" /> Processing…
                </>
              ) : (
                <>Pay {formatMoney(fee)} USDT</>
              )}
            </Button>
          </>
        )
      }
    >
      {step === "done" ? (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
          <div className="k-hot-card relative flex items-center gap-4 overflow-hidden rounded-[18px] p-5">
            <Icon3D name="party_popper" size={72} />
            <div>
              <Chip tone="ember" size="sm">
                {model.phases[0]!.name} · {sizeLabel}
              </Chip>
              <div className="mt-2 text-[17px] font-medium">Challenge #CH-{size / 1000}-{model.id === "1-step" ? "1S" : model.id === "2-step" ? "2S" : "IF"}-4471 created</div>
              <div className="mt-0.5 text-[12.5px] text-fg-2">{model.phases[0]!.target ? `Target ${model.phases[0]!.target}% · ` : ""}Daily loss {model.dailyLoss}% · Max DD {model.maxDD}%</div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CredentialField label="Login" value="80520391" />
            <CredentialField label="Server" value="Ezymex-Prop01" mono={false} />
            <CredentialField label="Master password" value="Rv8!kQ2mTz" secret />
            <CredentialField label="Investor password" value="Hn4$wP7cX" secret />
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-[12px] bg-surface-2 px-3.5 py-2.5 text-[12px] text-fg-3">
            <ShieldCheck className="size-4 text-up" /> Wallet balance now <span className="k-num font-medium text-fg">{formatMoney(after)} USDT</span>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-4">
          <div className="k-row flex items-center gap-4 p-4">
            <Icon3D name="trophy" size={52} />
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-medium">
                {model.name} · {sizeLabel}
              </div>
              <div className="mt-0.5 text-[12px] text-fg-3">
                {model.phases.map((p) => (p.target ? `${p.name} ${p.target}%` : p.name)).join(" → ")} · {model.leverage} · {model.split} split
              </div>
            </div>
            <Money value={fee} decimals={0} countUp={false} className="text-[22px] font-semibold" />
          </div>

          <div className="rounded-[16px] border border-line">
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <CoinIcon coin="usdt" size={28} />
              <div className="flex-1">
                <div className="text-[13.5px] font-medium">Ezymex wallet</div>
                <div className="text-[11.5px] text-fg-3">USDT · TRC20</div>
              </div>
              <Chip tone="up" size="sm" dot>
                Selected
              </Chip>
            </div>
            <dl className="divide-y divide-line px-4 text-[13px]">
              {[
                ["Available balance", <Money key="b" value={balance} countUp={false} />],
                ["Challenge fee", <span key="f" className="k-num text-down">-{formatMoney(fee)}</span>],
                ["Platform fee", <span key="p" className="text-up">Free</span>],
                [
                  "Balance after",
                  <span key="a" className={cn("k-num font-semibold", after < 0 ? "text-down" : "text-fg")}>
                    {formatMoney(after)}
                  </span>,
                ],
              ].map(([k, v], i) => (
                <div key={i} className="flex items-center justify-between py-2.5">
                  <dt className="text-fg-3">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {model.refundable ? (
            <div className="flex items-start gap-2.5 rounded-[12px] border border-gold/25 bg-gold-soft px-3.5 py-3 text-[12.5px] text-fg-2">
              <Wallet className="mt-0.5 size-4 shrink-0 text-gold" />
              <span>
                Your <span className="font-medium text-gold">{formatMoney(fee)}</span> fee is refunded in full with your first payout from the funded account.
              </span>
            </div>
          ) : (
            <div className="rounded-[12px] border border-line bg-surface-2 px-3.5 py-3 text-[12.5px] text-fg-3">Instant Funding fees are non-refundable. Payouts start after {model.firstPayout}.</div>
          )}

          <div className="space-y-2.5 pt-1">
            <CheckBox checked={rules} onChange={setRules}>
              I understand breaching the daily loss ({model.dailyLoss}%) or max drawdown ({model.maxDD}% {model.ddType.toLowerCase()}) fails the account automatically and closes all positions.
            </CheckBox>
            <CheckBox checked={terms} onChange={setTerms}>
              I agree to the{" "}
              <button type="button" className="text-ember underline-offset-2 hover:underline" onClick={(e) => { e.stopPropagation(); toast("Prop terms opened in a new tab"); }}>
                Prop Challenge Terms
              </button>{" "}
              and acknowledge funded accounts are simulated.
            </CheckBox>
          </div>
        </div>
      )}
    </Dialog>
  );
}
