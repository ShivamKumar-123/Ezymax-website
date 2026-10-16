"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowLeftRight, ArrowUpFromLine, Check, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, CoinIcon, EmptyState, Field, Illustration, Input, PageHeader, Progress, Skeleton, cn, formatDateTime, shortHash } from "@/components/kit";
import { Trans, tr, useT } from "@ezymex/i18n/react";
import { useSession } from "@/components/session";
import { STEPUP_CODES, StepUpDialog } from "@/components/stepup";
import {
  CHAIN_LABEL,
  WalletError,
  addressLooksValid,
  fmt,
  payoutLabel,
  railLabel,
  requestId,
  upiLooksValid,
  usdtAvailable,
  useWallet,
  walletApi,
  type Chain,
  type Overview,
  type Page,
  type WalletConfig,
  type Withdrawal,
} from "./api";
import { HashLink, InlineError, KycNotice, StatusTag, Tile, WITHDRAWAL_STATUS, WalletUnavailable, cleanAmount } from "./ui";
import { WithdrawGate } from "./withdraw-gate";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Which rail the client is being paid on. Mirrors the deposit page's `via`. */
type Via = "usdt" | "upi";

/** A payout destination: a chain, or an off-chain method the broker has switched on. */
type Dest = { kind: "crypto"; chain: Chain } | { kind: "upi" };

const destKey = (d: Dest) => (d.kind === "crypto" ? d.chain : d.kind);

type Quote = {
  method: "crypto" | "upi";
  amount: string;
  fee: string;
  net_amount: string;
  used_today: string;
  daily_max: string;
  available: string;
  payout_currency: string | null;
  payout_amount: string | null;
  payout_rate: string | null;
};

function useQuote(dest: Dest, amount: string, to: string, enabled: boolean) {
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [err, setErr] = React.useState<WalletError | null>(null);
  const [busy, setBusy] = React.useState(false);
  const key = destKey(dest);
  React.useEffect(() => {
    setQuote(null);
    setErr(null);
    if (!enabled) return;
    const ctl = new AbortController();
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const body = key === "upi" ? { method: "upi" } : { method: "crypto", chain: key };
        const r = await walletApi<{ quote: Quote }>("withdrawals/quote", { body: { ...body, amount, to_address: to.trim() }, signal: ctl.signal });
        setQuote(r.quote);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setErr(e instanceof WalletError ? e : new WalletError(0, "error", tr("wallet.withdraw.checkFailed")));
      } finally {
        if (!ctl.signal.aborted) setBusy(false);
      }
    }, 400);
    return () => {
      ctl.abort();
      clearTimeout(t);
    };
  }, [key, amount, to, enabled]);
  return { quote, err, busy };
}

/* ---------------- step 0: which rail ---------------- */

/** The same chooser the deposit page opens with, for the ways out instead of the ways in. */
function WithdrawChooser({ value, onChange, usdt, upi }: { value: Via; onChange: (v: Via) => void; usdt: boolean; upi: string | null }) {
  const t = useT();
  const options = [
    usdt && {
      v: "usdt" as const,
      title: t("wallet.withdraw.chooser.usdt"),
      text: t("wallet.withdraw.chooser.usdtText"),
      icon: <CoinIcon coin="usdt" size={30} />,
    },
    upi && {
      v: "upi" as const,
      title: t("wallet.withdraw.chooser.upi"),
      text: t("wallet.withdraw.chooser.upiText", { currency: upi }),
      icon: (
        <span className="grid size-[30px] place-items-center rounded-full border border-line bg-surface-3 text-fg-2">
          <Smartphone className="size-4" />
        </span>
      ),
    },
  ].filter(Boolean) as { v: Via; title: string; text: string; icon: React.ReactNode }[];
  if (options.length < 2) return null;
  return (
    <div className="mb-4">
      <div className="k-label mb-2">{t("wallet.withdraw.chooser.title")}</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("wallet.withdraw.chooser.title")}>
        {options.map((o) => {
          const on = o.v === value;
          return (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.v)}
              className={cn("k-row flex items-center gap-3 px-4 py-3 text-start transition-colors", on ? "border-ember/60 bg-ember-soft" : "hover:border-[var(--k-border-top)]")}
              data-testid={`withdraw-via-${o.v}`}
            >
              {o.icon}
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium">{o.title}</div>
                <div className="line-clamp-2 text-[12px] leading-snug text-fg-3">{o.text}</div>
              </div>
              {on && (
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ember text-white">
                  <Check className="size-3.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** One network to pay out on. The selected fill is a shared layout element, so it slides between the cards. */
function NetworkCard({ on, disabled, onSelect, chain }: { on: boolean; disabled: boolean; onSelect: () => void; chain: Chain }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={on}
      className={cn("k-row relative flex items-center gap-3 px-4 py-3 text-start transition-colors disabled:opacity-50", on ? "border-ember/60" : "hover:border-[var(--k-border-top)]")}
    >
      {on && <motion.span layoutId="withdraw-network" transition={{ type: "spring", stiffness: 420, damping: 36 }} className="absolute inset-0 rounded-[inherit] bg-ember-soft" />}
      <span className="relative">
        <CoinIcon coin="usdt" size={30} />
        <CoinIcon coin={chain === "bsc" ? "bnb" : "trx"} size={14} className="absolute -bottom-0.5 -end-1 ring-2 ring-surface-2" />
      </span>
      <div className="relative min-w-0 flex-1">
        <div className="text-[14px] font-medium">
          USDT <span className="rounded-md bg-surface-3 px-1.5 py-px text-[10.5px] font-medium text-fg-2">{CHAIN_LABEL[chain].short}</span>
        </div>
        <div className="text-[12px] leading-snug text-fg-3">{CHAIN_LABEL[chain].name}</div>
      </div>
    </button>
  );
}

/* ---------------- step 1: the request ---------------- */

function RequestForm({ cfg, o, kyc, via, onCreated }: { cfg: WalletConfig; o: Overview; kyc: string; via: Via; onCreated: (w: Withdrawal) => void }) {
  const t = useT();
  const chains = cfg.chains.filter((c) => c.withdrawals_enabled);
  const upi = (cfg.withdraw_methods ?? []).find((m) => m.method === "upi" && m.enabled && m.rate);
  const [chain, setChain] = React.useState<Chain>(chains[0]?.chain ?? "tron");
  const dest: Dest = via === "upi" ? { kind: "upi" } : { kind: "crypto", chain };
  const isUpi = via === "upi";
  const [to, setTo] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [key, setKey] = React.useState(requestId);
  const available = usdtAvailable(o).available;
  const amt = amount.trim();
  const amountOk = /^\d{1,12}(\.\d{1,2})?$/.test(amt) && Number(amt) > 0;
  const toOk = isUpi ? upiLooksValid(to) : addressLooksValid(chain, to);
  const verified = kyc === "verified";
  const offered = isUpi ? !!upi : chains.length > 0;
  const { quote, err: qErr, busy } = useQuote(dest, amt, to, verified && offered && amountOk && toOk);
  const L = cfg.limits;

  // a destination for one rail is never valid for another
  React.useEffect(() => {
    setTo("");
    setErr(null);
  }, [via, chain]);

  const send = async (token: string) => {
    try {
      const body = isUpi ? { method: "upi" } : { method: "crypto", chain };
      const r = await walletApi<{ withdrawal: Withdrawal }>("withdrawals", { body: { ...body, amount: amt, to_address: to.trim(), idempotency_key: key, stepup_token: token } });
      setAmount("");
      setKey(requestId());
      onCreated(r.withdrawal);
    } catch (e) {
      const we = e instanceof WalletError ? e : null;
      setErr(we && STEPUP_CODES.has(we.code) ? t("wallet.withdraw.confirmationExpired") : e instanceof Error ? e.message : t("wallet.withdraw.failed"));
    }
  };

  if (!offered)
    return (
      <Card>
        <div className="p-6 text-[13.5px] text-fg-2">{t("wallet.withdraw.noneAvailable")}</div>
      </Card>
    );

  return (
    <Card>
      <CardHeader title={isUpi ? t("wallet.withdraw.titleUpi") : t("wallet.withdrawUsdt")} subtitle={t("wallet.withdraw.formSubtitle")} />
      <div className="space-y-5 px-4 pb-6 pt-4 sm:px-6">
        {!isUpi && chains.length > 1 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {chains.map((c) => (
              <NetworkCard key={c.chain} on={c.chain === chain} disabled={!verified} onSelect={() => setChain(c.chain)} chain={c.chain} />
            ))}
          </div>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={destKey(dest)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: EASE }}>
            <Field
              label={isUpi ? t("wallet.withdraw.upiDestination") : t("wallet.withdraw.destination")}
              error={to && !toOk ? (isUpi ? t("wallet.withdraw.upiError") : chain === "bsc" ? t("wallet.withdraw.bscAddressError") : t("wallet.withdraw.tronAddressError")) : undefined}
            >
              <Input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                disabled={!verified}
                placeholder={isUpi ? "name@bank" : chain === "bsc" ? "0x\u2026" : "T\u2026"}
                inputClassName="font-mono text-[12.5px]"
                aria-label={isUpi ? t("wallet.withdraw.upiDestination") : t("wallet.withdraw.destination")}
                dir="ltr"
              />
            </Field>
          </motion.div>
        </AnimatePresence>
        <Field label={t("common.amount")} hint={t("wallet.withdraw.amountHint", { available: fmt(available), min: fmt(L.withdraw_min), max: fmt(L.withdraw_max) })}>
          <Input
            inputMode="decimal"
            value={amount}
            disabled={!verified}
            onChange={(e) => setAmount(cleanAmount(e.target.value))}
            placeholder="0.00"
            aria-label={t("wallet.withdraw.amountAria")}
            trailing={
              <button type="button" className="text-[12px] font-medium text-ember disabled:opacity-50" disabled={!verified} onClick={() => setAmount(String(Math.floor(Number(available) * 100) / 100))}>
                {t("wallet.max")}
              </button>
            }
          />
        </Field>
        <AnimatePresence initial={false}>
          {quote && (
            <motion.div key="quote" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease: EASE }} className="overflow-hidden">
              <div className="grid grid-cols-3 gap-2">
                <Tile label={t("wallet.withdraw.youSend")} value={<span dir="ltr">{fmt(quote.amount)} USDT</span>} />
                <Tile label={t("wallet.fee")} value={<span dir="ltr">{fmt(quote.fee)} USDT</span>} />
                <Tile
                  label={t("wallet.youReceive")}
                  value={
                    <span dir="ltr" className="text-up">
                      {quote.payout_amount && quote.payout_currency ? payoutLabel(quote.payout_currency, quote.payout_amount) : fmt(quote.net_amount) + " USDT"}
                    </span>
                  }
                />
              </div>
              {quote.payout_rate && quote.payout_currency && (
                <p className="mt-2 text-[12px] text-fg-3">{t("wallet.withdraw.rateNote", { net: fmt(quote.net_amount) })}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {busy && !quote && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[12px] text-fg-3">
            {t("wallet.withdraw.checkingLimits")}
          </motion.div>
        )}
        <InlineError>{qErr?.message ?? err}</InlineError>
        <Button
          variant="ember"
          size="lg"
          className="w-full sm:w-auto"
          disabled={!verified || !quote}
          onClick={() => {
            setErr(null);
            setConfirm(true);
          }}
        >
          <ArrowUpFromLine /> {t("common.continue")}
        </Button>
        <p className="text-[12px] text-fg-3">{isUpi ? (upi?.instructions ?? t("wallet.withdraw.upiNote")) : t("wallet.withdraw.emailNote", { network: CHAIN_LABEL[chain].name })}</p>
      </div>
      <StepUpDialog
        open={confirm}
        onOpenChange={setConfirm}
        action="withdrawal"
        target={destKey(dest) + "-" + amt}
        title={t("wallet.withdraw.confirmTitle")}
        description={
          !quote
            ? undefined
            : isUpi
              ? t("wallet.withdraw.confirmUpi", { payout: quote.payout_amount && quote.payout_currency ? payoutLabel(quote.payout_currency, quote.payout_amount) : "", upi: to.trim() })
              : t("wallet.withdraw.confirmDescription", { amount: fmt(quote.amount), address: shortHash(to.trim(), 8, 6), network: CHAIN_LABEL[chain].name })
        }
        what={t("wallet.withdraw.stepUpWhat")}
        confirmLabel={t("wallet.confirmWithdrawal")}
        onConfirmed={send}
      />
    </Card>
  );
}

/* ---------------- step 2: the tracker ---------------- */

/** Where the withdrawal has got to. `paid` only means something on chain, where it is still being confirmed. */
function Tracker({ w, onNew, onChanged }: { w: Withdrawal; onNew: () => void; onChanged: () => void }) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const done = w.status === "completed";
  const bad = w.status === "rejected" || w.status === "cancelled";
  const reviewed = w.status !== "requested";
  const sent = w.status === "paid" || done;
  const received = w.payout_amount && w.payout_currency ? payoutLabel(w.payout_currency, w.payout_amount) : fmt(w.net_amount) + " USDT";
  return (
    <Card>
      <CardHeader
        title={done ? t("wallet.withdraw.trackDone") : bad ? t("wallet.withdraw.trackStopped") : t("wallet.withdraw.trackOnItsWay")}
        subtitle={w.method === "upi" ? t("wallet.withdraw.toUpi", { upi: w.to_address }) : `${CHAIN_LABEL[w.chain ?? "tron"].name} \u00b7 USDT ${railLabel(w)}`}
        action={<StatusTag {...WITHDRAWAL_STATUS[w.status]} />}
      />
      <div className="space-y-5 px-4 pb-6 pt-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div dir="ltr" className="k-num text-[30px] font-semibold leading-none" data-testid="withdrawal-amount">
              {"\u2212"}
              {fmt(w.amount)} <span className="text-[15px] text-fg-3">USDT</span>
            </div>
            <div className="mt-2 text-[12.5px] text-fg-3">
              {t("wallet.youReceive")} <span className="font-medium text-fg">{received}</span>
              {w.payout_tx_hash && (
                <>
                  {" \u00b7 "}
                  <HashLink hash={w.payout_tx_hash} url={w.explorer_url} />
                </>
              )}
              {w.payout_reference && (
                <>
                  {" \u00b7 "}
                  <span className="font-mono">{w.payout_reference}</span>
                </>
              )}
            </div>
          </div>
          {done && <Illustration name="withdrawalProcessing" width={140} maxHeight={140} className="shrink-0" />}
        </div>
        {!bad && (
          <motion.ol initial="hide" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(
              [
                [t("wallet.withdraw.stepRequested"), true],
                [t("wallet.withdraw.stepApproved"), reviewed],
                [w.method === "upi" ? t("wallet.withdraw.stepPaidUpi") : t("wallet.withdraw.stepPaidChain"), sent],
              ] as [string, boolean][]
            ).map(([label, ok], i) => (
              <motion.li
                key={i}
                variants={{ hide: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.3, ease: EASE }}
                className={cn("k-row flex items-center gap-2 px-3 py-2.5 text-[12.5px]", ok ? "text-fg" : "text-fg-3")}
              >
                <span className={cn("grid size-5 place-items-center rounded-full border", ok ? "border-up/40 bg-up-soft text-up" : "border-line")}>
                  {ok ? <Check className="size-3" /> : <span className="text-[10px]">{i + 1}</span>}
                </span>
                {label}
              </motion.li>
            ))}
          </motion.ol>
        )}
        {w.status === "requested" && <div className="rounded-[12px] border border-warn/30 bg-warn-soft px-3 py-2.5 text-[12.5px] text-fg-2">{t("wallet.withdraw.trackReview")}</div>}
        {w.status === "paid" && w.method !== "upi" && <div className="rounded-[12px] border border-info/30 bg-info-soft px-3 py-2.5 text-[12.5px] text-fg-2">{t("wallet.withdraw.trackConfirming", { n: w.payout_confirmations })}</div>}
        {bad && <InlineError>{w.reason ?? t("wallet.withdraw.cancelledText")}</InlineError>}
        <div className="flex flex-wrap gap-2">
          {w.status === "requested" && (
            <Button
              variant="surface"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await walletApi(`withdrawals/${w.id}/cancel`, { body: {} });
                  toast.success(t("wallet.withdrawalCancelled"), { description: t("wallet.withdraw.cancelledText") });
                  onChanged();
                } catch (e) {
                  toast.error(t("wallet.withdraw.cancelFailed"), { description: e instanceof Error ? e.message : undefined });
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <Loader2 className="animate-spin" /> : null} {t("common.cancel")}
            </Button>
          )}
          {done && (
            <Link href="/wallet/transfer">
              <Button variant="ember">
                <ArrowLeftRight /> {t("wallet.fundTradingAccount")}
              </Button>
            </Link>
          )}
          <Button variant={done ? "surface" : "ghost"} onClick={onNew}>
            {t("wallet.withdraw.newOne")}
          </Button>
          <Link href="/wallet">
            <Button variant="ghost">{t("wallet.backToWallet")}</Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- side column ---------------- */

function HowItWorks({ via, currency }: { via: Via; currency: string | null }) {
  const t = useT();
  const steps: [string, string][] =
    via === "upi"
      ? [
          [t("wallet.withdraw.howUpi1Title"), t("wallet.withdraw.howUpi1Text")],
          [t("wallet.withdraw.howUpi2Title"), t("wallet.withdraw.howUpi2Text")],
          [t("wallet.withdraw.howUpi3Title"), t("wallet.withdraw.howUpi3Text")],
          [t("wallet.withdraw.howUpi4Title"), t("wallet.withdraw.howUpi4Text", { currency: currency ?? "INR" })],
        ]
      : [
          [t("wallet.withdraw.how1Title"), t("wallet.withdraw.how1Text")],
          [t("wallet.withdraw.how2Title"), t("wallet.withdraw.how2Text")],
          [t("wallet.withdraw.how3Title"), t("wallet.withdraw.how3Text")],
          [t("wallet.withdraw.how4Title"), t("wallet.withdraw.how4Text")],
        ];
  return (
    <Card>
      <CardHeader title={t("wallet.withdraw.howTitle")} />
      <ol className="space-y-4 px-6 pb-6 pt-4 text-[13px]">
        {steps.map(([title, d], i) => (
          <li key={i} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line text-[11px] text-fg-2">{i + 1}</span>
            <div>
              <div className="font-medium">{title}</div>
              <div className="text-[12.5px] text-fg-3">{d}</div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function LimitsCard({ cfg, o }: { cfg: WalletConfig; o: Overview }) {
  const t = useT();
  const used = Number(o.limits.used_today);
  const max = Number(o.limits.daily_max);
  const L = cfg.limits;
  return (
    <Card>
      <CardHeader title={t("wallet.withdraw.limitsTitle")} subtitle={t("wallet.withdraw.limitsSubtitle")} />
      <div className="space-y-4 px-6 pb-5 pt-4">
        <div>
          <div className="mb-1.5 flex justify-between text-[12.5px]">
            <span className="text-fg-2">{t("wallet.withdraw.withdrawnToday")}</span>
            <span dir="ltr" className="k-num text-fg-3">
              <span className="text-fg">{fmt(used)}</span> / {fmt(max)} USDT
            </span>
          </div>
          <Progress value={max ? (used / max) * 100 : 0} tone={max && used / max > 0.8 ? "warn" : "gold"} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Tile label={t("wallet.minimum")} value={<span dir="ltr">{fmt(L.withdraw_min)} USDT</span>} />
          <Tile label={t("wallet.maximum")} value={<span dir="ltr">{fmt(L.withdraw_max)} USDT</span>} />
          <Tile label={t("wallet.fee")} value={<span dir="ltr">{`${fmt(L.withdraw_fee_flat)} USDT${Number(L.withdraw_fee_pct) > 0 ? ` + ${L.withdraw_fee_pct}%` : ""}`}</span>} />
          <Tile label={t("wallet.withdraw.afterDeposit")} value={L.deposit_cooldown_hours ? t("wallet.withdraw.hoursWait", { hours: L.deposit_cooldown_hours }) : t("wallet.withdraw.noWait")} />
        </div>
        {o.limits.cooldown_until && <div className="text-[12px] text-warn">{t("wallet.withdraw.cooldown", { date: formatDateTime(o.limits.cooldown_until) })}</div>}
      </div>
    </Card>
  );
}

function MyWithdrawals({ list, onOpen }: { list: Page<Withdrawal> | null; onOpen: (id: number) => void }) {
  const t = useT();
  if (!list) return <Skeleton className="h-40 w-full rounded-[20px]" />;
  return (
    <Card>
      <CardHeader title={t("wallet.withdraw.yours")} subtitle={t("wallet.withdraw.inTotal", { count: list.total })} />
      <div className="mt-3 space-y-2 px-4 pb-5 sm:px-6">
        {list.items.length === 0 && <EmptyState illustration="money_with_wings" title={t("wallet.withdraw.none")} />}
        {list.items.map((w) => (
          <button key={w.id} type="button" onClick={() => onOpen(w.id)} className="k-row w-full px-4 py-3 text-start transition-colors hover:border-[var(--k-border-top)]" data-testid={`withdrawal-${w.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span dir="ltr" className="text-[13.5px] font-medium">
                {fmt(w.amount)} USDT · {railLabel(w)}
              </span>
              <StatusTag {...WITHDRAWAL_STATUS[w.status]} />
            </div>
            <div className="mt-1 text-[11.5px] text-fg-3">
              {formatDateTime(w.created_at)} ·{" "}
              <Trans
                k="wallet.withdraw.rowDetail"
                vars={{ address: w.method === "upi" ? w.to_address : shortHash(w.to_address, 8, 6), net: fmt(w.net_amount) }}
                tags={{ addr: (c) => <span dir="ltr" className="font-mono">{c}</span> }}
              />
            </div>
            {w.status === "rejected" && w.reason && <div className="mt-1 text-[12px] text-down">{w.reason}</div>}
          </button>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- the page ---------------- */

function Inner() {
  const t = useT();
  const sp = useSearchParams();
  const router = useRouter();
  const me = useSession();
  const cfg = useWallet<WalletConfig>("config");
  const o = useWallet<Overview>("overview", 15000);
  const list = useWallet<Page<Withdrawal>>("withdrawals?limit=20", 15000);

  // the open withdrawal lives in the URL (?w=), so a reload or a shared link comes back to the same tracker
  const [openId, setOpenId] = React.useState<number | null>(() => Number(sp.get("w")) || null);
  const tracked = useWallet<{ withdrawal: Withdrawal }>(openId ? `withdrawals/${openId}` : null, 10000);

  const chains = cfg.data?.chains.filter((c) => c.withdrawals_enabled) ?? [];
  const upi = (cfg.data?.withdraw_methods ?? []).find((m) => m.method === "upi" && m.enabled && m.rate);
  const [picked, setPicked] = React.useState<Via | null>(() => (sp.get("via") === "upi" ? "upi" : sp.get("via") === "usdt" ? "usdt" : null));
  const via: Via = picked && (picked === "usdt" ? chains.length > 0 : !!upi) ? picked : chains.length ? "usdt" : upi ? "upi" : "usdt";
  // The gate opens on a fresh visit, once the rails are known and there is really a choice to make. Reopening
  // an existing withdrawal (?w=) or arriving with ?via= skips it.
  const loaded = !!cfg.data;
  const gateOpen = !openId && picked === null && loaded && chains.length > 0 && !!upi;

  const open = (id: number | null) => {
    setOpenId(id);
    window.history.replaceState(window.history.state, "", id ? `/wallet/withdraw?w=${id}` : "/wallet/withdraw");
  };
  const choose = (v: Via) => {
    setPicked(v);
    setOpenId(null);
    window.history.replaceState(window.history.state, "", v === "usdt" ? "/wallet/withdraw" : `/wallet/withdraw?via=${v}`);
  };
  const reload = () => {
    o.reload();
    list.reload();
    tracked.reload();
  };

  let main: React.ReactNode;
  if ((cfg.error && !cfg.data) || (o.error && !o.data))
    main = (
      <WalletUnavailable
        onRetry={() => {
          cfg.reload();
          o.reload();
        }}
      />
    );
  else if (!cfg.data || !o.data || (openId && !tracked.data && !tracked.error)) main = <Skeleton className="h-[420px] w-full rounded-[20px]" />;
  else if (openId && tracked.error) main = <WalletUnavailable onRetry={tracked.reload} message={tracked.error.status === 404 ? t("wallet.withdraw.notFound") : undefined} />;
  else if (openId && tracked.data)
    main = (
      <Tracker
        w={tracked.data.withdrawal}
        onNew={() => open(null)}
        onChanged={() => {
          reload();
          tracked.reload();
        }}
      />
    );
  else
    main = (
      <RequestForm
        cfg={cfg.data}
        o={o.data}
        kyc={me.kyc_status}
        via={via}
        onCreated={(w) => {
          open(w.id);
          reload();
        }}
      />
    );

  return (
    <div className="pb-16">
      <PageHeader
        title={t("common.withdraw")}
        subtitle={upi && chains.length ? t("wallet.withdraw.subtitleBoth") : upi ? t("wallet.withdraw.subtitleUpi") : t("wallet.withdraw.subtitle")}
        actions={
          <Link href="/wallet">
            <Button variant="surface">
              <ArrowLeft className="rtl:-scale-x-100" /> {t("wallet.wallet")}
            </Button>
          </Link>
        }
      />
      <KycNotice status={me.kyc_status} />
      <WithdrawGate open={gateOpen} hasUsdt={chains.length > 0} hasUpi={!!upi} currency={upi?.currency ?? null} onChoose={choose} onClose={() => router.push("/wallet")} />
      {!openId && !gateOpen && <WithdrawChooser value={via} onChange={choose} usdt={chains.length > 0} upi={upi?.currency ?? null} />}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-7">{gateOpen ? <Skeleton className="h-[420px] w-full rounded-[20px]" /> : main}</div>
        <div className="space-y-4 xl:col-span-5">
          <HowItWorks via={via} currency={upi?.currency ?? null} />
          {cfg.data && o.data && <LimitsCard cfg={cfg.data} o={o.data} />}
          <MyWithdrawals list={list.data} onOpen={open} />
        </div>
      </div>
    </div>
  );
}

export function LiveWithdrawPage() {
  return (
    <React.Suspense fallback={null}>
      <Inner />
    </React.Suspense>
  );
}
