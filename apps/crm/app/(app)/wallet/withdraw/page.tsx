"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowLeftRight, ArrowRight, BookUser, Check, CircleAlert, CircleCheck, Eye, Info, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, CoinIcon, Dialog, Field, Input, KeyValue, Money, PageHeader, Reveal, StatusChip, Stepper, cn, formatDateTime, formatNumber, shortHash } from "@kalks/ui";
import { ACCOUNTS, ME, WALLET } from "@kalks/mock";
import { ADDRESS_BOOK, PENDING_WITHDRAWALS, WALLET_LIMITS, walletAvailableUsdt, type PendingWithdrawal } from "@kalks/mock/wallet-extra";
import { KycBanner } from "@/components/wallet/wallet-ui";
import { EmailOtp } from "@/components/accounts/security";
import { AccountBadge, accountTitle } from "@/components/account-row";

const L = WALLET_LIMITS.withdraw;
const TIMELINE = ["Requested", "Email verified", "Admin approval", "Broadcast on TRON", "Completed"];
const BASE58 = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

function validateAddress(a: string): string | null {
  if (!a) return null;
  if (!a.startsWith("T")) return "TRC20 addresses start with “T”";
  if (a.length !== 34) return `Must be 34 characters (${a.length}/34)`;
  if (!BASE58.test(a)) return "Contains invalid characters (0, O, I, l are not allowed)";
  if (a === WALLET.address) return "This is your own Kalks deposit address";
  return null;
}

function Timeline({ step, compact }: { step: number; compact?: boolean }) {
  return (
    <ol className={cn(compact ? "flex items-center gap-1" : "space-y-0")}>
      {TIMELINE.map((s, i) => {
        const done = i < step;
        const on = i === step;
        if (compact)
          return (
            <li key={s} className="flex flex-1 items-center gap-1" title={s}>
              <span className={cn("h-1.5 flex-1 rounded-full", done ? "bg-up" : on ? "bg-ember" : "bg-surface-3")} />
            </li>
          );
        return (
          <li key={s} className="relative flex gap-3 pb-5 last:pb-0">
            {i < TIMELINE.length - 1 && <span className={cn("absolute left-[11px] top-6 h-[calc(100%-16px)] w-px", done ? "bg-up/50" : "bg-line")} />}
            <span className={cn("relative grid size-6 shrink-0 place-items-center rounded-full border", done ? "border-up/40 bg-up-soft text-up" : on ? "border-ember/50 bg-ember-soft" : "border-line")}>
              {done ? <Check className="size-3.5" /> : on ? <span className="size-2 animate-pulse-dot rounded-full bg-ember text-ember" /> : <span className="size-1.5 rounded-full bg-fg-3/40" />}
            </span>
            <div>
              <div className={cn("text-[13.5px] font-medium", done ? "text-fg" : on ? "text-ember" : "text-fg-3")}>{s}</div>
              <div className="text-[12px] text-fg-3">
                {i === 0 && done && "Just now"}
                {i === 1 && done && `Code confirmed via ${ME.email.replace(/(.{2}).+(@.+)/, "$1•••$2")}`}
                {i === 2 && on && "Finance team reviews every withdrawal · usually under 2 hours"}
                {i === 3 && !done && "Sent from Kalks hot wallet once approved"}
                {i === 4 && !done && "Funds arrive at your address after 20 confirmations"}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PendingList() {
  const [items, setItems] = React.useState<PendingWithdrawal[]>(PENDING_WITHDRAWALS);
  const [cancel, setCancel] = React.useState<PendingWithdrawal | null>(null);
  return (
    <Card>
      <CardHeader title="Pending withdrawals" subtitle={`${items.length} awaiting completion`} />
      <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
        {items.length === 0 && <div className="py-6 text-center text-[13px] text-fg-3">No pending withdrawals.</div>}
        <AnimatePresence initial={false}>
          {items.map((w) => (
            <motion.div key={w.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }} className="k-row px-4 py-3.5">
              <div className="flex items-start gap-3">
                <CoinIcon coin="usdt" size={30} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="k-num text-[15px] font-semibold">-{formatNumber(w.amount)} USDT</span>
                    <StatusChip status={w.status} label={w.status === "review" ? "Admin review" : "Broadcasting"} />
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-fg-3">
                    To {w.label} · <span className="font-mono">{shortHash(w.address, 5, 4)}</span> · {formatDateTime(w.createdAt)}
                  </div>
                </div>
                {w.status === "review" && (
                  <Button size="xs" variant="ghost" onClick={() => setCancel(w)}>
                    Cancel
                  </Button>
                )}
              </div>
              <div className="mt-3">
                <Timeline step={w.step} compact />
                <div className="mt-1.5 flex justify-between text-[10.5px] text-fg-3">
                  <span className="font-mono">{w.id}</span>
                  <span>{TIMELINE[w.step]}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <Dialog
        open={!!cancel}
        onOpenChange={(o) => !o && setCancel(null)}
        title="Cancel this withdrawal?"
        description={cancel ? `${formatNumber(cancel.amount)} USDT to ${cancel.label} · ${cancel.id}` : undefined}
        width={420}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancel(null)}>
              Keep it
            </Button>
            <Button
              variant="sell"
              onClick={() => {
                setItems((l) => l.filter((x) => x.id !== cancel!.id));
                toast.success("Withdrawal cancelled", { description: `${formatNumber(cancel!.amount)} USDT returned to your wallet` });
                setCancel(null);
              }}
            >
              Cancel withdrawal
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-fg-2">The amount and the 1 USDT fee will be returned to your wallet balance immediately.</p>
      </Dialog>
    </Card>
  );
}

function Withdraw() {
  const sp = useSearchParams();
  const fromAcc = ACCOUNTS.find((a) => a.login === sp.get("from"));
  const available = walletAvailableUsdt();
  const dailyLeft = L.daily - L.usedToday;
  const [step, setStep] = React.useState(0);
  const [amount, setAmount] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const amt = parseFloat(amount) || 0;
  const maxAmt = Math.min(available, L.maxPerTx, dailyLeft);
  const receive = Math.max(0, amt - L.fee);
  const amtErr = !amount ? null : amt < L.min ? `Minimum withdrawal is ${L.min} USDT` : amt > available ? "Exceeds available balance" : amt > L.maxPerTx ? `Max ${formatNumber(L.maxPerTx, 0)} USDT per withdrawal` : amt > dailyLeft ? "Exceeds today's remaining limit" : null;
  const addrErr = validateAddress(address);
  const addrOk = address.length > 0 && !addrErr;
  const book = ADDRESS_BOOK.find((b) => b.address === address);
  const canContinue = amt > 0 && !amtErr && addrOk;

  const submit = () => {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setStep(2);
      toast("Preview only — withdrawal not sent", { description: "Complete identity verification to submit real withdrawals." });
    }, 800);
  };

  return (
    <div className="pb-16">
      <PageHeader
        title="Withdraw USDT"
        subtitle="Send funds from your wallet to an external TRON (TRC20) address. Every withdrawal is reviewed by our finance team."
        actions={
          <Link href="/wallet">
            <Button variant="surface">
              <ArrowLeft /> Wallet
            </Button>
          </Link>
        }
      />

      <Reveal>
        <KycBanner />
      </Reveal>

      {fromAcc && (
        <Reveal delay={0.05} className="mt-4 block">
          <div className="k-card flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-info/30 bg-info-soft text-info">
              <Info className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
                Move funds from your account first <AccountBadge a={fromAcc} />
                <span className="text-fg-2">{accountTitle(fromAcc)}</span>
                <span className="font-mono text-[12.5px] text-fg-3">#{fromAcc.login}</span>
              </div>
              <p className="mt-0.5 text-[13px] text-fg-2">
                Withdrawals are paid from your wallet. Account #{fromAcc.login} holds{" "}
                <Money value={fromAcc.balance} currency={fromAcc.cent ? "USC " : "$"} countUp={false} className="font-medium text-fg" /> — transfer what you need to the wallet, then come back here.
              </p>
            </div>
            <Link href={`/wallet/transfer?from=${fromAcc.login}`}>
              <Button variant="surface">
                <ArrowLeftRight /> Transfer to wallet
              </Button>
            </Link>
          </div>
        </Reveal>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-7">
          <Card>
            <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
              <Stepper steps={["Details", "Verify", "Submitted"]} current={step} className="flex-1" />
              <Chip tone="warn" className="hidden sm:inline-flex">
                <Eye className="size-3" /> Preview
              </Chip>
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                {step === 0 && (
                  <div className="space-y-5 px-4 py-6 sm:px-6">
                    <div className="k-row flex items-center gap-3 px-4 py-3">
                      <CoinIcon coin="usdt" size={34} />
                      <div className="flex-1">
                        <div className="text-[13.5px] font-medium">USDT · TRC20</div>
                        <div className="text-[12px] text-fg-3">Available to withdraw</div>
                      </div>
                      <div className="text-right">
                        <Money value={available} currency="" className="text-[18px] font-semibold" />
                        <span className="ml-1 text-[12px] text-fg-3">USDT</span>
                      </div>
                    </div>

                    <Field label="Amount" hint={`Min ${L.min} · daily left ${formatNumber(dailyLeft, 0)}`} error={amtErr ?? undefined}>
                      <Input
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                        placeholder="0.00"
                        inputClassName="k-num text-[18px] font-semibold"
                        className="h-14"
                        leading={<CoinIcon coin="usdt" size={20} />}
                        trailing={
                          <>
                            <span className="text-[13px]">USDT</span>
                            <button type="button" className="rounded-full border border-ember/30 bg-ember-soft px-2.5 py-1 text-[11.5px] font-semibold text-ember hover:bg-ember/20" onClick={() => setAmount(maxAmt.toFixed(2))}>
                              Max
                            </button>
                          </>
                        }
                      />
                    </Field>
                    <div className="-mt-2 flex flex-wrap gap-2">
                      {[25, 50, 75].map((p) => (
                        <button key={p} type="button" onClick={() => setAmount(((maxAmt * p) / 100).toFixed(2))} className="k-num rounded-full border border-line bg-surface-2 px-3 py-1 text-[12px] text-fg-2 hover:text-fg">
                          {p}%
                        </button>
                      ))}
                    </div>

                    <Field label="Destination address" hint="TRON · TRC20 only" error={touched && addrErr ? addrErr : undefined}>
                      <Input
                        value={address}
                        onChange={(e) => setAddress(e.target.value.trim())}
                        onBlur={() => setTouched(true)}
                        placeholder="T… (34 characters)"
                        inputClassName="font-mono text-[13px]"
                        spellCheck={false}
                        className={cn(touched && addrErr && "border-down/50", addrOk && "border-up/40")}
                        trailing={
                          <>
                            <span className="k-num text-[11px]">{address.length}/34</span>
                            {addrOk ? <CircleCheck className="size-4 text-up" /> : touched && addrErr ? <CircleAlert className="size-4 text-down" /> : null}
                          </>
                        }
                      />
                    </Field>
                    <div className="-mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[12px] text-fg-3">
                        <BookUser className="size-3.5" /> Saved:
                      </span>
                      {ADDRESS_BOOK.map((b) => (
                        <button
                          key={b.address}
                          type="button"
                          onClick={() => {
                            setAddress(b.address);
                            setTouched(true);
                          }}
                          className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors", address === b.address ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2 hover:text-fg")}
                        >
                          {b.label}
                          <span className="font-mono text-[10.5px] text-fg-3">{shortHash(b.address, 3, 3)}</span>
                          {b.whitelisted && <Lock className="size-3 text-up" />}
                        </button>
                      ))}
                    </div>

                    <div className="rounded-[16px] border border-line bg-surface-2">
                      <KeyValue
                        className="px-4"
                        rows={[
                          ["Network", "TRON (TRC20)"],
                          ["Withdrawal fee", `${formatNumber(L.fee)} USDT`],
                          ["Processing", "Admin review · usually < 2h"],
                          ...(book ? ([["Address book", <span key="b" className="inline-flex items-center gap-1.5">{book.label} {book.whitelisted ? <Chip size="sm" tone="up">Whitelisted</Chip> : <Chip size="sm" tone="warn">New · 24h hold</Chip>}</span>]] as [React.ReactNode, React.ReactNode][]) : []),
                        ]}
                      />
                      <div className="flex items-center justify-between border-t border-line px-4 py-4">
                        <span className="text-[13px] text-fg-2">You will receive</span>
                        <span className="k-num text-[22px] font-semibold">
                          {formatNumber(receive)} <span className="text-[13px] text-fg-3">USDT</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-[12px] text-fg-3">Real withdrawals unlock after KYC approval.</span>
                      <Button variant="ember" size="lg" disabled={!canContinue} onClick={() => setStep(1)}>
                        Continue (preview) <ArrowRight />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-5 px-4 py-6 sm:px-6">
                    <div className="k-row px-5 py-5 text-center">
                      <div className="text-[12px] uppercase tracking-wider text-fg-3">You are withdrawing</div>
                      <div className="k-num mt-1 text-[32px] font-semibold tracking-tight">
                        {formatNumber(amt)} <span className="text-[16px] text-fg-3">USDT</span>
                      </div>
                      <div className="mt-1 text-[13px] text-fg-2">
                        Receive <span className="k-num font-medium text-fg">{formatNumber(receive)} USDT</span> after {L.fee} USDT fee
                      </div>
                      <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface-3 px-3 py-1.5 font-mono text-[12px] text-fg-2">
                        <span className="truncate">{address}</span>
                      </div>
                    </div>
                    <EmailOtp code={code} onCode={setCode} purpose="authorise this withdrawal" />
                    <div className="flex items-center justify-between gap-3">
                      <Button variant="ghost" onClick={() => setStep(0)}>
                        <ArrowLeft /> Edit
                      </Button>
                      <Button variant="ember" size="lg" disabled={code.length !== 6 || busy} onClick={submit}>
                        {busy ? "Submitting…" : "Confirm withdrawal"}
                      </Button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="px-4 py-6 sm:px-6">
                    <div className="flex flex-col items-center text-center">
                      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.4 }} className="grid size-16 place-items-center rounded-full border border-ember/40 bg-ember-soft text-ember shadow-[0_0_40px_-8px_rgba(255,90,31,0.7)]">
                        <Lock className="size-7" />
                      </motion.div>
                      <h3 className="mt-4 text-[22px] font-semibold tracking-tight">Pending admin approval</h3>
                      <p className="mt-1 max-w-md text-[13.5px] text-fg-2">
                        {formatNumber(amt)} USDT to <span className="font-mono">{shortHash(address, 6, 6)}</span>. We&apos;ll email you at each step.
                      </p>
                      <Chip tone="warn" className="mt-3">
                        Preview — submit for real once KYC is approved
                      </Chip>
                    </div>
                    <div className="mx-auto mt-6 max-w-md">
                      <Timeline step={2} />
                    </div>
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      <Button
                        variant="surface"
                        onClick={() => {
                          setStep(0);
                          setAmount("");
                          setAddress("");
                          setCode("");
                          setTouched(false);
                        }}
                      >
                        New withdrawal
                      </Button>
                      <Link href="/wallet/history">
                        <Button variant="ghost">View history</Button>
                      </Link>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </Card>
        </Reveal>

        <div className="space-y-4 xl:col-span-5">
          <Reveal delay={0.15}>
            <PendingList />
          </Reveal>
          <Reveal delay={0.2}>
            <Card>
              <CardHeader title="Withdrawal rules" />
              <div className="px-6 pb-4 pt-1">
                <KeyValue
                  rows={[
                    ["Minimum", `${L.min} USDT`],
                    ["Maximum per request", `${formatNumber(L.maxPerTx, 0)} USDT`],
                    ["Daily limit", `${formatNumber(L.daily, 0)} USDT`],
                    ["Used today", `${formatNumber(L.usedToday, 0)} USDT`],
                    ["Fee", `${L.fee} USDT flat`],
                    ["Approval", "Always reviewed by finance"],
                  ]}
                />
              </div>
              <div className="flex items-start gap-2 border-t border-line px-6 py-4 text-[12px] text-fg-3">
                <X className="mt-0.5 size-3.5 shrink-0 text-down" /> Withdrawals to exchanges that don&apos;t support TRC20 USDT, or to smart-contract addresses, can&apos;t be recovered.
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

export default function WithdrawPage() {
  return (
    <React.Suspense fallback={null}>
      <Withdraw />
    </React.Suspense>
  );
}
