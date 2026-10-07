"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, CalendarClock, Check, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, CoinIcon, Dialog, Field, Icon3D, Input, Money, cn, formatMoney } from "@/components/kit";
import { WALLET } from "@kalks/mock";
import { FUNDED, PROP_PAYOUTS } from "@kalks/mock/prop";
import { CheckBox } from "./prop-ui";

export function RequestPayoutDialog({ available, onRequested, trigger }: { available: number; onRequested: (amount: number) => void; trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<"form" | "sending" | "done">("form");
  const [amount, setAmount] = React.useState(available.toFixed(2));
  const [confirm, setConfirm] = React.useState(false);
  const n = Number(amount) || 0;
  const valid = n >= 50 && n <= available + 1e-6 && confirm;
  const firstRefund = PROP_PAYOUTS.find((p) => p.account === FUNDED.login && p.refund > 0);

  React.useEffect(() => {
    if (open) {
      setAmount(available.toFixed(2));
    } else {
      const t = setTimeout(() => {
        setStep("form");
        setConfirm(false);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open, available]);

  const submit = () => {
    setStep("sending");
    setTimeout(() => {
      setStep("done");
      onRequested(n);
      toast.success("Payout requested", { description: `${formatMoney(n)} → Kalks wallet · pending risk review` });
    }, 1300);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      width={520}
      title={step === "done" ? "Payout requested" : "Request payout"}
      description={step === "done" ? "We'll notify you as soon as it's approved." : `Funded account #${FUNDED.login} · $100k 1-Step`}
      footer={
        step === "done" ? (
          <>
            <Link href="/wallet" onClick={() => setOpen(false)}>
              <Button variant="surface">Open wallet</Button>
            </Link>
            <Button variant="ember" onClick={() => setOpen(false)}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="ember" disabled={!valid || step === "sending"} onClick={submit} className="min-w-[170px]">
              {step === "sending" ? (
                <>
                  <Loader2 className="animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  Request {formatMoney(n)} <ArrowRight />
                </>
              )}
            </Button>
          </>
        )
      }
    >
      {step === "done" ? (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="flex flex-col items-center text-center">
            <Icon3D name="money_with_wings" size={84} />
            <Money value={n} className="mt-2 text-[34px] font-semibold tracking-tight text-up" />
            <div className="text-[12.5px] text-fg-3">Request PO-24512 · to Kalks wallet (USDT)</div>
          </div>
          <ol className="mt-6 space-y-0">
            {[
              { t: "Requested", d: "Just now", s: "done" },
              { t: "Risk desk review", d: "Usually within 8 hours", s: "now" },
              { t: "Credited to wallet", d: "USDT · TRC20 wallet", s: "todo" },
            ].map((x, i) => (
              <li key={x.t} className="relative flex gap-3 pb-4 last:pb-0">
                {i < 2 && <span className={cn("absolute left-[13px] top-7 h-[calc(100%-24px)] w-px", x.s === "done" ? "bg-up/40" : "bg-line")} />}
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
                    x.s === "done" && "border-up/40 bg-up-soft text-up",
                    x.s === "now" && "border-ember/50 bg-ember-soft text-ember shadow-[0_0_18px_-4px_color-mix(in_oklab,var(--k-ember)_70%,transparent)]",
                    x.s === "todo" && "border-line text-fg-3",
                  )}
                >
                  {x.s === "done" ? <Check className="size-3.5" /> : i + 1}
                </span>
                <div>
                  <div className="text-[13.5px] font-medium">{x.t}</div>
                  <div className="text-[12px] text-fg-3">{x.d}</div>
                </div>
              </li>
            ))}
          </ol>
        </motion.div>
      ) : (
        <div className="space-y-4">
          <Field label="Amount" hint={<span className="k-num">Available {formatMoney(available)}</span>}>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              leading={<span className="text-[15px] text-fg-2">$</span>}
              trailing={
                <button type="button" onClick={() => setAmount(available.toFixed(2))} className="rounded-full bg-ember-soft px-2.5 py-1 text-[11px] font-semibold text-ember">
                  MAX
                </button>
              }
              inputClassName="k-num text-[18px] font-semibold"
              className="h-14"
            />
          </Field>
          <div className="flex gap-2">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(((available * p) / 100).toFixed(2))}
                className={cn("h-8 flex-1 rounded-full border text-[12px] font-medium transition-colors", Math.abs(n - (available * p) / 100) < 0.01 ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2 hover:bg-surface-3")}
              >
                {p}%
              </button>
            ))}
          </div>
          {n > available + 1e-6 && <div className="text-xs text-down">Amount exceeds your available share.</div>}
          {n > 0 && n < 50 && <div className="text-xs text-down">Minimum payout is $50.</div>}

          <div>
            <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Destination</div>
            <div className="flex items-center gap-3 rounded-[14px] border border-ember/40 bg-ember-soft px-3.5 py-3">
              <CoinIcon coin="usdt" size={30} />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium">Kalks wallet · USDT</div>
                <div className="truncate font-mono text-[11px] text-fg-3">{WALLET.address.slice(0, 6)}…{WALLET.address.slice(-4)} · TRC20</div>
              </div>
              <Chip size="sm" tone="ember">
                <Wallet className="size-3" /> Default
              </Chip>
            </div>
          </div>

          <dl className="divide-y divide-line rounded-[14px] border border-line px-4 text-[13px]">
            {[
              ["Cycle profit (10–24 Sep)", formatMoney(FUNDED.profit)],
              [`Your share (${FUNDED.splitPct}%)`, formatMoney(available)],
              ["Processing fee", <span key="f" className="text-up">Free</span>],
              ["You receive", <span key="r" className="k-num font-semibold text-up">{formatMoney(Math.min(n, available))}</span>],
            ].map(([key, v], i) => (
              <div key={i} className="flex items-center justify-between py-2.5">
                <dt className="text-fg-3">{key}</dt>
                <dd className="k-num">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex items-start gap-2.5 rounded-[12px] bg-surface-2 px-3.5 py-3 text-[12px] text-fg-2">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-fg-3" />
              <span>
                Next eligible date after this request: <span className="font-medium text-fg">08 Oct 2026</span>
              </span>
            </div>
            <div className="flex items-start gap-2.5 rounded-[12px] border border-gold/25 bg-gold-soft px-3.5 py-3 text-[12px] text-fg-2">
              <Check className="mt-0.5 size-4 shrink-0 text-gold" />
              <span>
                Fee refund of <span className="font-medium text-gold">{formatMoney(FUNDED.feePaid)}</span> already paid with your first payout {firstRefund ? `(${firstRefund.id})` : ""}.
              </span>
            </div>
          </div>

          <CheckBox checked={confirm} onChange={setConfirm}>
            I confirm no banned strategies were used this cycle. Open positions stay open and the remaining 20% of profit is reset at approval.
          </CheckBox>
        </div>
      )}
    </Dialog>
  );
}
