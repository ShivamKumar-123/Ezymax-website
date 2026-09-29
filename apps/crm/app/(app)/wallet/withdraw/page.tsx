"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowLeftRight, ArrowRight, BookUser, Check, CircleAlert, CircleCheck, Eye, Info, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, CoinIcon, Dialog, Field, Input, KeyValue, Money, PageHeader, Reveal, StatusChip, Stepper, cn, formatDateTime, formatNumber, shortHash } from "@kalks/ui";
import { Trans, tr, useT } from "@kalks/i18n/react";
import type { MessageKey } from "@kalks/i18n";
import { ACCOUNTS, ME, WALLET } from "@kalks/mock";
import { ADDRESS_BOOK, PENDING_WITHDRAWALS, WALLET_LIMITS, walletAvailableUsdt, type PendingWithdrawal } from "@kalks/mock/wallet-extra";
import { KycBanner } from "@/components/wallet/wallet-ui";
import { EmailOtp } from "@/components/accounts/security";
import { AccountBadge, accountTitle } from "@/components/account-row";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveWithdrawPage } from "@/components/wallet-live/withdraw-page";

const L = WALLET_LIMITS.withdraw;
const TIMELINE: MessageKey[] = ["wallet.demo.stepRequested", "wallet.demo.stepEmailVerified", "wallet.demo.stepAdminApproval", "wallet.demo.stepBroadcast", "wallet.demo.stepCompleted"];
const BASE58 = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

function validateAddress(a: string): string | null {
  if (!a) return null;
  if (!a.startsWith("T")) return tr("wallet.demo.addrStartT");
  if (a.length !== 34) return tr("wallet.demo.addrLength", { length: a.length });
  if (!BASE58.test(a)) return tr("wallet.demo.addrChars");
  if (a === WALLET.address) return tr("wallet.demo.addrOwn");
  return null;
}

function Timeline({ step, compact }: { step: number; compact?: boolean }) {
  const t = useT();
  return (
    <ol className={cn(compact ? "flex items-center gap-1" : "space-y-0")}>
      {TIMELINE.map((key, i) => {
        const s = t(key);
        const done = i < step;
        const on = i === step;
        if (compact)
          return (
            <li key={key} className="flex flex-1 items-center gap-1" title={s}>
              <span className={cn("h-1.5 flex-1 rounded-full", done ? "bg-up" : on ? "bg-ember" : "bg-surface-3")} />
            </li>
          );
        return (
          <li key={key} className="relative flex gap-3 pb-5 last:pb-0">
            {i < TIMELINE.length - 1 && <span className={cn("absolute start-[11px] top-6 h-[calc(100%-16px)] w-px", done ? "bg-up/50" : "bg-line")} />}
            <span className={cn("relative grid size-6 shrink-0 place-items-center rounded-full border", done ? "border-up/40 bg-up-soft text-up" : on ? "border-ember/50 bg-ember-soft" : "border-line")}>
              {done ? <Check className="size-3.5" /> : on ? <span className="size-2 animate-pulse-dot rounded-full bg-ember text-ember" /> : <span className="size-1.5 rounded-full bg-fg-3/40" />}
            </span>
            <div>
              <div className={cn("text-[13.5px] font-medium", done ? "text-fg" : on ? "text-ember" : "text-fg-3")}>{s}</div>
              <div className="text-[12px] text-fg-3">
                {i === 0 && done && t("wallet.demo.justNow")}
                {i === 1 && done && t("wallet.demo.codeConfirmed", { email: ME.email.replace(/(.{2}).+(@.+)/, "$1•••$2") })}
                {i === 2 && on && t("wallet.demo.financeReviews")}
                {i === 3 && !done && t("wallet.demo.sentFromHot")}
                {i === 4 && !done && t("wallet.demo.arriveAfter")}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PendingList() {
  const t = useT();
  const [items, setItems] = React.useState<PendingWithdrawal[]>(PENDING_WITHDRAWALS);
  const [cancel, setCancel] = React.useState<PendingWithdrawal | null>(null);
  return (
    <Card>
      <CardHeader title={t("wallet.demo.pendingTitle")} subtitle={t("wallet.demo.awaitingCompletion", { count: items.length })} />
      <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
        {items.length === 0 && <div className="py-6 text-center text-[13px] text-fg-3">{t("wallet.demo.noPending")}</div>}
        <AnimatePresence initial={false}>
          {items.map((w) => (
            <motion.div key={w.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }} className="k-row px-4 py-3.5">
              <div className="flex items-start gap-3">
                <CoinIcon coin="usdt" size={30} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span dir="ltr" className="k-num text-[15px] font-semibold">-{formatNumber(w.amount)} USDT</span>
                    <StatusChip status={w.status} label={w.status === "review" ? t("wallet.demo.adminReview") : t("wallet.demo.broadcasting")} />
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-fg-3">
                    {t("wallet.demo.toLabel", { label: w.label })} · <span dir="ltr" className="font-mono">{shortHash(w.address, 5, 4)}</span> · {formatDateTime(w.createdAt)}
                  </div>
                </div>
                {w.status === "review" && (
                  <Button size="xs" variant="ghost" onClick={() => setCancel(w)}>
                    {t("common.cancel")}
                  </Button>
                )}
              </div>
              <div className="mt-3">
                <Timeline step={w.step} compact />
                <div className="mt-1.5 flex justify-between text-[10.5px] text-fg-3">
                  <span className="font-mono">{w.id}</span>
                  <span>{TIMELINE[w.step] ? t(TIMELINE[w.step]!) : null}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <Dialog
        open={!!cancel}
        onOpenChange={(o) => !o && setCancel(null)}
        title={t("wallet.demo.cancelTitle")}
        description={cancel ? t("wallet.demo.cancelDescription", { amount: formatNumber(cancel.amount), label: cancel.label, id: cancel.id }) : undefined}
        width={420}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancel(null)}>
              {t("wallet.demo.keepIt")}
            </Button>
            <Button
              variant="sell"
              onClick={() => {
                setItems((l) => l.filter((x) => x.id !== cancel!.id));
                toast.success(t("wallet.withdrawalCancelled"), { description: t("wallet.demo.returned", { amount: formatNumber(cancel!.amount) }) });
                setCancel(null);
              }}
            >
              {t("wallet.demo.cancelWithdrawal")}
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-fg-2">{t("wallet.demo.cancelText")}</p>
      </Dialog>
    </Card>
  );
}

function Withdraw() {
  const t = useT();
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
  const amtErr = !amount ? null : amt < L.min ? t("wallet.demo.minWithdrawalError", { min: L.min }) : amt > available ? t("wallet.demo.exceedsAvailable") : amt > L.maxPerTx ? t("wallet.demo.maxPerWithdrawalError", { max: formatNumber(L.maxPerTx, 0) }) : amt > dailyLeft ? t("wallet.demo.exceedsDaily") : null;
  const addrErr = validateAddress(address);
  const addrOk = address.length > 0 && !addrErr;
  const book = ADDRESS_BOOK.find((b) => b.address === address);
  const canContinue = amt > 0 && !amtErr && addrOk;

  const submit = () => {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setStep(2);
      toast(t("wallet.demo.previewToast"), { description: t("wallet.demo.previewToastText") });
    }, 800);
  };

  return (
    <div className="pb-16">
      <PageHeader
        title={t("wallet.withdrawUsdt")}
        subtitle={t("wallet.demo.withdrawSubtitle")}
        actions={
          <Link href="/wallet">
            <Button variant="surface">
              <ArrowLeft className="rtl:-scale-x-100" /> {t("wallet.wallet")}
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
                {t("wallet.demo.moveFirst")} <AccountBadge a={fromAcc} />
                <span className="text-fg-2">{accountTitle(fromAcc)}</span>
                <span className="font-mono text-[12.5px] text-fg-3">#{fromAcc.login}</span>
              </div>
              <p className="mt-0.5 text-[13px] text-fg-2">
                <Trans k="wallet.demo.moveFirstText" vars={{ login: fromAcc.login }} tags={{ amount: () => <Money value={fromAcc.balance} currency={fromAcc.cent ? "USC " : "$"} countUp={false} className="font-medium text-fg" /> }} />
              </p>
            </div>
            <Link href={`/wallet/transfer?from=${fromAcc.login}`}>
              <Button variant="surface">
                <ArrowLeftRight /> {t("wallet.demo.transferToWallet")}
              </Button>
            </Link>
          </div>
        </Reveal>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-7">
          <Card>
            <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
              <Stepper steps={[t("wallet.demo.stepDetails"), t("wallet.demo.stepVerify"), t("wallet.demo.stepSubmitted")]} current={step} className="flex-1" />
              <Chip tone="warn" className="hidden sm:inline-flex">
                <Eye className="size-3" /> {t("wallet.demo.preview")}
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
                        <div className="text-[12px] text-fg-3">{t("wallet.demo.availableToWithdraw")}</div>
                      </div>
                      <div dir="ltr" className="text-end">
                        <Money value={available} currency="" className="text-[18px] font-semibold" />
                        <span className="ms-1 text-[12px] text-fg-3">USDT</span>
                      </div>
                    </div>

                    <Field label={t("common.amount")} hint={t("wallet.demo.amountHint", { min: L.min, left: formatNumber(dailyLeft, 0) })} error={amtErr ?? undefined}>
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
                              {t("wallet.max")}
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

                    <Field label={t("wallet.withdraw.destination")} hint={t("wallet.demo.trc20OnlyHint")} error={touched && addrErr ? addrErr : undefined}>
                      <Input
                        value={address}
                        onChange={(e) => setAddress(e.target.value.trim())}
                        onBlur={() => setTouched(true)}
                        placeholder={t("wallet.demo.addressPlaceholder")}
                        inputClassName="font-mono text-[13px]"
                        spellCheck={false}
                        dir="ltr"
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
                        <BookUser className="size-3.5" /> {t("wallet.demo.saved")}
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
                          [t("wallet.network"), "TRON (TRC20)"],
                          [t("wallet.demo.withdrawalFee"), `${formatNumber(L.fee)} USDT`],
                          [t("wallet.demo.processing"), t("wallet.demo.processingValue")],
                          ...(book ? ([[t("wallet.demo.addressBook"), <span key="b" className="inline-flex items-center gap-1.5">{book.label} {book.whitelisted ? <Chip size="sm" tone="up">{t("wallet.demo.whitelisted")}</Chip> : <Chip size="sm" tone="warn">{t("wallet.demo.newHold")}</Chip>}</span>]] as [React.ReactNode, React.ReactNode][]) : []),
                        ]}
                      />
                      <div className="flex items-center justify-between border-t border-line px-4 py-4">
                        <span className="text-[13px] text-fg-2">{t("wallet.demo.youWillReceive")}</span>
                        <span dir="ltr" className="k-num text-[22px] font-semibold">
                          {formatNumber(receive)} <span className="text-[13px] text-fg-3">USDT</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-[12px] text-fg-3">{t("wallet.demo.unlockAfterKyc")}</span>
                      <Button variant="ember" size="lg" disabled={!canContinue} onClick={() => setStep(1)}>
                        {t("wallet.demo.continuePreview")} <ArrowRight className="rtl:-scale-x-100" />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-5 px-4 py-6 sm:px-6">
                    <div className="k-row px-5 py-5 text-center">
                      <div className="text-[12px] uppercase tracking-wider text-fg-3">{t("wallet.demo.youAreWithdrawing")}</div>
                      <div dir="ltr" className="k-num mt-1 text-[32px] font-semibold tracking-tight">
                        {formatNumber(amt)} <span className="text-[16px] text-fg-3">USDT</span>
                      </div>
                      <div className="mt-1 text-[13px] text-fg-2">
                        <Trans k="wallet.demo.receiveAfterFee" vars={{ amount: formatNumber(receive), fee: L.fee }} tags={{ num: (c) => <span dir="ltr" className="k-num font-medium text-fg">{c}</span> }} />
                      </div>
                      <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface-3 px-3 py-1.5 font-mono text-[12px] text-fg-2">
                        <span dir="ltr" className="truncate">{address}</span>
                      </div>
                    </div>
                    <EmailOtp code={code} onCode={setCode} purpose={t("wallet.demo.otpPurpose")} />
                    <div className="flex items-center justify-between gap-3">
                      <Button variant="ghost" onClick={() => setStep(0)}>
                        <ArrowLeft className="rtl:-scale-x-100" /> {t("common.edit")}
                      </Button>
                      <Button variant="ember" size="lg" disabled={code.length !== 6 || busy} onClick={submit}>
                        {busy ? t("wallet.demo.submitting") : t("wallet.confirmWithdrawal")}
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
                      <h3 className="mt-4 text-[22px] font-semibold tracking-tight">{t("wallet.demo.pendingApproval")}</h3>
                      <p className="mt-1 max-w-md text-[13.5px] text-fg-2">
                        <Trans k="wallet.demo.pendingText" vars={{ amount: formatNumber(amt), address: shortHash(address, 6, 6) }} tags={{ addr: (c) => <span dir="ltr" className="font-mono">{c}</span> }} />
                      </p>
                      <Chip tone="warn" className="mt-3">
                        {t("wallet.demo.previewChip")}
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
                        {t("wallet.demo.newWithdrawal")}
                      </Button>
                      <Link href="/wallet/history">
                        <Button variant="ghost">{t("wallet.demo.viewHistory")}</Button>
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
              <CardHeader title={t("wallet.demo.rulesTitle")} />
              <div className="px-6 pb-4 pt-1">
                <KeyValue
                  rows={[
                    [t("wallet.minimum"), `${L.min} USDT`],
                    [t("wallet.demo.maxPerRequest"), `${formatNumber(L.maxPerTx, 0)} USDT`],
                    [t("wallet.demo.dailyLimit"), `${formatNumber(L.daily, 0)} USDT`],
                    [t("wallet.demo.usedToday"), `${formatNumber(L.usedToday, 0)} USDT`],
                    [t("wallet.fee"), t("wallet.demo.usdtFlat", { amount: L.fee })],
                    [t("wallet.demo.approval"), t("wallet.demo.alwaysReviewed")],
                  ]}
                />
              </div>
              <div className="flex items-start gap-2 border-t border-line px-6 py-4 text-[12px] text-fg-3">
                <X className="mt-0.5 size-3.5 shrink-0 text-down" /> {t("wallet.demo.unrecoverable")}
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function DemoWithdrawPage() {
  return (
    <React.Suspense fallback={null}>
      <Withdraw />
    </React.Suspense>
  );
}

/** Live builds: the real wallet (services/wallet). Demo builds: the mock showcase above. */
export default function WithdrawPage() {
  return IS_DEMO ? <DemoWithdrawPage /> : <LiveWithdrawPage />;
}
