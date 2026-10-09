"use client";

// Subscribe to a plan: amount (within the plan's limits and the client's room), wallet balance, what happens when,
// the lock warning, the plan's risk disclosure and the two acknowledgements the service requires (terms, risk).
// One idempotency key per opened dialog, so a retry after a network error or a pending payment never subscribes twice.

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2, Lock, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, Field, Input, cn } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";
import { IS_DEMO } from "@ezymex/mock/mode";
import { useWallet, type Overview } from "@/components/wallet-live/api";
import { StakingError, maturityFrom, newKey, stakingApi, type Plan, type PositionDetail } from "./api";
import { ErrorNote, RiskNote, Rows, useStakingFormat } from "./ui";

const DEMO_BALANCE = 18_240.55;

/** Amount field text: digits and one decimal point, 2 decimals. */
function clean(raw: string) {
  const v = raw.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const dot = v.indexOf(".");
  return dot < 0 ? v : v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "").slice(0, 2);
}

export function SubscribeDialog({ plan, open, onOpenChange, onDone }: { plan: Plan; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const t = useT();
  const fx = useStakingFormat();
  const [amount, setAmount] = React.useState("");
  const [terms, setTerms] = React.useState(false);
  const [risk, setRisk] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<unknown>(null);
  const [done, setDone] = React.useState<PositionDetail | null>(null);
  const key = React.useRef("");
  const wallet = useWallet<Overview>(open && !IS_DEMO ? "overview" : null);
  const balance = IS_DEMO ? DEMO_BALANCE : wallet.data ? Number(wallet.data.balances.find((b) => b.currency === plan.currency)?.available ?? 0) : null;

  React.useEffect(() => {
    if (open) {
      key.current = newKey();
      setAmount("");
      setTerms(false);
      setRisk(false);
      setErr(null);
      setDone(null);
      setBusy(false);
    }
  }, [open, plan.id]);

  const value = Number(amount);
  const max = plan.maxNow;
  const matures = maturityFrom(plan.termMonths);
  const maturesText = fx.date(matures);
  const money = (v: number) => fx.amount(v, plan.currency);
  const fieldError = !amount ? null : !Number.isFinite(value) || value <= 0 ? t("staking.subscribe.enterAmount") : value < plan.minAmount ? t("staking.subscribe.belowMin", { min: money(plan.minAmount) }) : max !== null && value > max ? t("staking.subscribe.aboveMax", { max: money(max) }) : null;
  const short = balance !== null && value > 0 && value > balance;
  // an unconfirmed attempt is retried with the same key and amount, so the amount is held until it settles
  const held = err instanceof StakingError && (err.code === "payment_pending" || err.code === "network" || err.status >= 500);
  const ready = !!amount && !fieldError && terms && risk && !busy && !short;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (IS_DEMO) {
        await new Promise((r) => setTimeout(r, 900));
        toast.success(t("staking.subscribe.success"), { description: `${plan.name} · ${money(value)}` });
        onOpenChange(false);
        return;
      }
      const r = await stakingApi<PositionDetail>("positions", { body: { planId: plan.id, amount: amount, idempotencyKey: key.current, acceptTerms: true, acceptRisk: true } });
      setDone(r);
      toast.success(t("staking.subscribe.success"), { description: `${plan.name} · ${money(r.position.principal)}` });
      onDone?.();
    } catch (e) {
      // a refused payment closes that attempt (nothing charged): the next try is a new subscription
      if (e instanceof StakingError && ["insufficient_funds", "payment_failed", "idempotency_conflict"].includes(e.code)) key.current = newKey();
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const p = done.position;
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={t("staking.subscribe.doneTitle")}
        description={plan.name}
        width={520}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.close")}
            </Button>
            <Link href="/staking/portfolio" onClick={() => onOpenChange(false)}>
              <Button variant="ember">
                {t("staking.subscribe.viewStaking")} <ArrowRight className="rtl:-scale-x-100" />
              </Button>
            </Link>
          </>
        }
      >
        <div className="flex items-start gap-3 rounded-[14px] border border-up/25 bg-up-soft px-4 py-3">
          <Check className="mt-0.5 size-4 shrink-0 text-up" />
          <p className="text-[13px] text-fg">{t("staking.subscribe.doneText", { amount: money(p.principal), plan: p.planName, date: fx.date(p.maturesAt) })}</p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={t("staking.subscribe.title", { plan: plan.name })}
      description={t("staking.subscribe.description", { term: t("staking.plan.term", { count: plan.termMonths }), currency: plan.currency })}
      width={600}
      footer={
        <>
          <Button variant="surface" disabled={busy} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="ember" disabled={!ready} onClick={submit} data-testid="staking-subscribe">
            {busy ? <Loader2 className="animate-spin" /> : <Wallet />} {err ? t("staking.subscribe.retry") : value > 0 ? t("staking.subscribe.confirm", { amount: money(value) }) : t("staking.plan.subscribe")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label={t("staking.subscribe.amount")}
          hint={max !== null ? t("staking.subscribe.limits", { min: money(plan.minAmount), max: money(max) }) : t("staking.subscribe.limitsMin", { min: money(plan.minAmount) })}
          error={fieldError ?? undefined}
        >
          <Input
            inputMode="decimal"
            autoFocus
            value={amount}
            disabled={busy || held}
            onChange={(e) => setAmount(clean(e.target.value))}
            placeholder={String(plan.minAmount)}
            inputClassName="k-num"
            trailing={
              <span className="flex items-center gap-2">
                <span className="text-[12px] text-fg-3">{plan.currency}</span>
                {balance !== null && balance > 0 && !held && (
                  <button
                    type="button"
                    className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-fg-2 hover:text-fg"
                    onClick={() => setAmount(String(Math.floor(Math.min(balance, max ?? Infinity) * 100) / 100))}
                  >
                    {t("staking.subscribe.max")}
                  </button>
                )}
              </span>
            }
          />
        </Field>

        {balance !== null &&
          (short ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-warn/30 bg-warn-soft px-4 py-3 text-[12.5px] text-fg">
              <span>{t("staking.subscribe.short", { balance: money(balance) })}</span>
              <Link href="/wallet/deposit">
                <Button size="sm" variant="surface">
                  {t("staking.subscribe.deposit")} <ArrowRight className="rtl:-scale-x-100" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="-mt-2 px-1 text-[12px] text-fg-3">{t("staking.subscribe.walletBalance", { balance: money(balance) })}</div>
          ))}

        <div>
          <div className="k-label mb-2">{t("staking.subscribe.summary")}</div>
          <Rows
            rows={[
              [t("staking.subscribe.amount"), value > 0 ? money(value) : "—"],
              [t("staking.col.term"), t("staking.plan.term", { count: plan.termMonths })],
              [t("staking.subscribe.starts"), t("staking.subscribe.startsValue")],
              [t("staking.subscribe.matures"), maturesText],
              [t("staking.subscribe.returns"), t("staking.subscribe.returnsValue")],
              [t("staking.subscribe.earlyWithdrawal"), <span key="e" className="text-down">{t("staking.subscribe.notAvailable")}</span>],
            ]}
          />
        </div>

        <div className="flex items-start gap-2.5 rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[12.5px] text-fg">
          <Lock className="mt-0.5 size-4 shrink-0 text-gold" />
          <span>{t("staking.subscribe.lockWarning", { amount: value > 0 ? money(value) : plan.currency, date: maturesText })}</span>
        </div>

        <RiskNote planText={plan.riskText} />

        <div className="space-y-2.5">
          {[
            [terms, setTerms, t("staking.subscribe.acceptTerms"), "terms"] as const,
            [risk, setRisk, t("staking.subscribe.acceptRisk", { date: maturesText }), "risk"] as const,
          ].map(([checked, set, label, id]) => (
            <label key={id} className={cn("flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-snug text-fg-2", busy && "pointer-events-none opacity-60")}>
              <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--k-ember)]" data-testid={`staking-accept-${id}`} />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <ErrorNote error={err} />
      </div>
    </Dialog>
  );
}
