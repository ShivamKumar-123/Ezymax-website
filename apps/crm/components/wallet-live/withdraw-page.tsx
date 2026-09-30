"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpFromLine, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, CoinIcon, EmptyState, Field, Illustration, Input, PageHeader, Progress, Skeleton, cn, formatDateTime, shortHash } from "@kalks/ui";
import { Trans, tr, useT } from "@kalks/i18n/react";
import { useSession } from "@/components/session";
import { STEPUP_CODES, StepUpDialog } from "@/components/stepup";
import { CHAIN_LABEL, WalletError, addressLooksValid, fmt, requestId, usdtAvailable, useWallet, walletApi, type Chain, type Overview, type Page, type WalletConfig, type Withdrawal } from "./api";
import { HashLink, InlineError, KycNotice, StatusTag, Tile, WITHDRAWAL_STATUS, WalletUnavailable, cleanAmount } from "./ui";

type Quote = { amount: string; fee: string; net_amount: string; used_today: string; daily_max: string; available: string };

function useQuote(chain: Chain, amount: string, to: string, enabled: boolean) {
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [err, setErr] = React.useState<WalletError | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    setQuote(null);
    setErr(null);
    if (!enabled) return;
    const ctl = new AbortController();
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await walletApi<{ quote: Quote }>("withdrawals/quote", { body: { chain, amount, to_address: to.trim() }, signal: ctl.signal });
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
  }, [chain, amount, to, enabled]);
  return { quote, err, busy };
}

function WithdrawForm({ cfg, o, kyc, onDone }: { cfg: WalletConfig; o: Overview; kyc: string; onDone: () => void }) {
  const t = useT();
  const enabled = cfg.chains.filter((c) => c.withdrawals_enabled);
  const [chain, setChain] = React.useState<Chain>(enabled[0]?.chain ?? "tron");
  const [to, setTo] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [key, setKey] = React.useState(requestId);
  const [requested, setRequested] = React.useState<Withdrawal | null>(null);
  const available = usdtAvailable(o).available;
  const amt = amount.trim();
  const amountOk = /^\d{1,12}(\.\d{1,2})?$/.test(amt) && Number(amt) > 0;
  const addrOk = addressLooksValid(chain, to);
  const verified = kyc === "verified";
  const { quote, err: qErr, busy } = useQuote(chain, amt, to, verified && amountOk && addrOk);
  const L = cfg.limits;

  const send = async (token: string) => {
    try {
      const r = await walletApi<{ withdrawal: Withdrawal }>("withdrawals", { body: { chain, amount: amt, to_address: to.trim(), idempotency_key: key, stepup_token: token } });
      setAmount("");
      setKey(requestId());
      setRequested(r.withdrawal);
      onDone();
    } catch (e) {
      const we = e instanceof WalletError ? e : null;
      setErr(we && STEPUP_CODES.has(we.code) ? t("wallet.withdraw.confirmationExpired") : e instanceof Error ? e.message : t("wallet.withdraw.failed"));
    }
  };

  // the request is in: the team reviews it, then it is sent (the form comes back with Done)
  if (requested)
    return (
      <Card>
        <div role="status" className="flex flex-col items-center px-6 py-12 text-center" data-testid="withdrawal-requested">
          <Illustration name="withdrawalProcessing" width={224} maxHeight={152} />
          <h3 className="mt-6 text-[19px] font-medium tracking-tight">{t("wallet.withdraw.toastRequested")}</h3>
          <p className="mt-1.5 max-w-sm text-[13.5px] text-fg-2">{t("wallet.withdraw.toastRequestedText", { amount: fmt(requested.amount), net: fmt(requested.net_amount) })}</p>
          <p className="mt-1 max-w-sm text-[12.5px] text-fg-3">{t("wallet.withdraw.formSubtitle")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="surface" onClick={() => setRequested(null)}>
              {t("common.done")}
            </Button>
            <Link href="/wallet">
              <Button variant="ghost">{t("wallet.backToWallet")}</Button>
            </Link>
          </div>
        </div>
      </Card>
    );

  return (
    <Card>
      <CardHeader title={t("wallet.withdrawUsdt")} subtitle={t("wallet.withdraw.formSubtitle")} />
      <div className="space-y-5 px-4 pb-6 pt-4 sm:px-6">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {cfg.chains.map((c) => (
            <button
              key={c.chain}
              type="button"
              disabled={!c.withdrawals_enabled || !verified}
              onClick={() => setChain(c.chain)}
              className={cn("k-row flex items-center gap-3 px-4 py-3 text-start disabled:opacity-50", c.chain === chain ? "border-ember/60 bg-ember-soft" : "hover:border-[var(--k-border-top)]")}
            >
              <span className="relative">
                <CoinIcon coin="usdt" size={28} />
                <CoinIcon coin={c.chain === "bsc" ? "bnb" : "trx"} size={13} className="absolute -bottom-0.5 -end-1 ring-2 ring-surface-2" />
              </span>
              <div>
                <div className="text-[13.5px] font-medium">USDT · {CHAIN_LABEL[c.chain].short}</div>
                <div className="text-[12px] text-fg-3">{CHAIN_LABEL[c.chain].name}</div>
              </div>
            </button>
          ))}
        </div>
        <Field label={t("wallet.withdraw.destination")} error={to && !addrOk ? (chain === "bsc" ? t("wallet.withdraw.bscAddressError") : t("wallet.withdraw.tronAddressError")) : undefined}>
          <Input value={to} onChange={(e) => setTo(e.target.value)} disabled={!verified} placeholder={chain === "bsc" ? "0x…" : "T…"} inputClassName="font-mono text-[12.5px]" aria-label={t("wallet.withdraw.destination")} dir="ltr" />
        </Field>
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
        {quote && (
          <div className="grid grid-cols-3 gap-2">
            <Tile label={t("wallet.withdraw.youSend")} value={<span dir="ltr">{fmt(quote.amount)} USDT</span>} />
            <Tile label={t("wallet.fee")} value={<span dir="ltr">{fmt(quote.fee)} USDT</span>} />
            <Tile label={t("wallet.youReceive")} value={<span dir="ltr" className="text-up">{fmt(quote.net_amount)} USDT</span>} />
          </div>
        )}
        {busy && !quote && <div className="text-[12px] text-fg-3">{t("wallet.withdraw.checkingLimits")}</div>}
        <InlineError>{qErr?.message ?? err}</InlineError>
        <Button variant="ember" size="lg" disabled={!verified || !quote} onClick={() => { setErr(null); setConfirm(true); }}>
          <ArrowUpFromLine /> {t("common.withdraw")}
        </Button>
        <p className="text-[12px] text-fg-3">{t("wallet.withdraw.emailNote", { network: CHAIN_LABEL[chain].name })}</p>
      </div>
      <StepUpDialog
        open={confirm}
        onOpenChange={setConfirm}
        action="withdrawal"
        target={`${chain}-${amt}`}
        title={t("wallet.withdraw.confirmTitle")}
        description={quote ? t("wallet.withdraw.confirmDescription", { amount: fmt(quote.amount), address: shortHash(to.trim(), 8, 6), network: CHAIN_LABEL[chain].name }) : undefined}
        what={t("wallet.withdraw.stepUpWhat")}
        confirmLabel={t("wallet.confirmWithdrawal")}
        onConfirmed={send}
      />
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

function MyWithdrawals({ list, onChange }: { list: Page<Withdrawal> | null; onChange: () => void }) {
  const t = useT();
  const [busy, setBusy] = React.useState<number | null>(null);
  if (!list) return <Skeleton className="h-40 w-full rounded-[20px]" />;
  return (
    <Card>
      <CardHeader title={t("wallet.withdraw.yours")} subtitle={t("wallet.withdraw.inTotal", { count: list.total })} />
      <div className="mt-3 space-y-2 px-4 pb-5 sm:px-6">
        {list.items.length === 0 && <EmptyState illustration="money_with_wings" title={t("wallet.withdraw.none")} />}
        {list.items.map((w) => (
          <div key={w.id} className="k-row px-4 py-3" data-testid={`withdrawal-${w.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span dir="ltr" className="text-[13.5px] font-medium">
                {fmt(w.amount)} USDT · {CHAIN_LABEL[w.chain].short}
              </span>
              <StatusTag {...WITHDRAWAL_STATUS[w.status]} />
              {w.status === "requested" && (
                <Button
                  size="xs"
                  variant="ghost"
                  className="ms-auto"
                  disabled={busy === w.id}
                  onClick={async () => {
                    setBusy(w.id);
                    try {
                      await walletApi(`withdrawals/${w.id}/cancel`, { body: {} });
                      toast.success(t("wallet.withdrawalCancelled"), { description: t("wallet.withdraw.cancelledText") });
                      onChange();
                    } catch (e) {
                      toast.error(t("wallet.withdraw.cancelFailed"), { description: e instanceof Error ? e.message : undefined });
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {busy === w.id ? <Loader2 className="animate-spin" /> : null} {t("common.cancel")}
                </Button>
              )}
            </div>
            <div className="mt-1 text-[11.5px] text-fg-3">
              {formatDateTime(w.created_at)} · <Trans k="wallet.withdraw.rowDetail" vars={{ address: shortHash(w.to_address, 8, 6), net: fmt(w.net_amount) }} tags={{ addr: (c) => <span dir="ltr" className="font-mono">{c}</span> }} />
              {w.payout_tx_hash && (
                <>
                  {" · "}
                  <HashLink hash={w.payout_tx_hash} url={w.explorer_url} className="text-[11.5px]" />
                </>
              )}
            </div>
            {w.status === "rejected" && w.reason && <div className="mt-1 text-[12px] text-down">{w.reason}</div>}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function LiveWithdrawPage() {
  const t = useT();
  const me = useSession();
  const cfg = useWallet<WalletConfig>("config");
  const o = useWallet<Overview>("overview", 15000);
  const list = useWallet<Page<Withdrawal>>("withdrawals?limit=20", 15000);
  const reload = () => {
    o.reload();
    list.reload();
  };
  return (
    <div className="pb-16">
      <PageHeader
        title={t("common.withdraw")}
        subtitle={t("wallet.withdraw.subtitle")}
        actions={
          <Link href="/wallet">
            <Button variant="surface">
              <ArrowLeft className="rtl:-scale-x-100" /> {t("wallet.wallet")}
            </Button>
          </Link>
        }
      />
      {(cfg.error && !cfg.data) || (o.error && !o.data) ? (
        <WalletUnavailable onRetry={() => { cfg.reload(); o.reload(); }} />
      ) : (
        <div className="space-y-4">
          <KycNotice status={me.kyc_status} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-7">{cfg.data && o.data ? <WithdrawForm cfg={cfg.data} o={o.data} kyc={me.kyc_status} onDone={reload} /> : <Skeleton className="h-[420px] w-full rounded-[20px]" />}</div>
            <div className="space-y-4 xl:col-span-5">
              {cfg.data && o.data && <LimitsCard cfg={cfg.data} o={o.data} />}
              <MyWithdrawals list={list.data} onChange={reload} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
