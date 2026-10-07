"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { ArrowDownUp, ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert, Info, ShieldCheck, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, CoinIcon, Dialog, Input, KeyValue, Menu, PageHeader, Reveal, Segmented, cn, formatNumber, useQuote } from "@/components/kit";
import { Trans, useT } from "@kalks/i18n/react";
import { WALLET, WALLET_TXS, freeMargin, type TradingAccount, type WalletTx } from "@kalks/mock";
import { CONVERSION, WALLET_LIMITS, liveAccounts, walletAvailableUsdt } from "@kalks/mock/wallet-extra";
import { AccountBadge, accountTitle } from "@/components/account-row";
import { TxDetailDrawer, TxRow } from "@/components/wallet/wallet-ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveTransferPage } from "@/components/wallet-live/transfer-page";

type Asset = "USDT" | "TRX" | "BTC";
const ACCS = liveAccounts();
const WALLET_ID = "wallet";

function accCur(a: TradingAccount) {
  return a.cent ? "USC" : "USD";
}

function EndpointCard({ label, value, onPick, lockedWallet, asset, onAsset }: { label: string; value: string; onPick: (v: string) => void; lockedWallet?: boolean; asset: Asset; onAsset?: (a: Asset) => void }) {
  const t = useT();
  const acc = ACCS.find((a) => a.login === value);
  const walletAsset = WALLET.assets.find((x) => x.asset === asset)!;
  const trigger = (
    <button type="button" className="k-row flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors hover:border-[var(--k-border-top)] hover:bg-surface-3/60">
      {acc ? (
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-ember/30 bg-ember-soft font-mono text-[11px] font-semibold text-ember">{acc.group.slice(0, 3).toUpperCase()}</span>
      ) : (
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg">
          <Wallet className="size-[18px]" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[14.5px] font-medium">
          {acc ? (
            <>
              {accountTitle(acc)} <span className="font-mono text-[12px] text-fg-3">#{acc.login}</span>
            </>
          ) : (
            t("wallet.demo.kalksWallet")
          )}
        </div>
        <div className="k-num truncate text-[12px] text-fg-3">
          {acc ? (
            <>
              {t("common.balance")} {acc.cent ? "USC " : "$"}
              {formatNumber(acc.balance)} · {t("wallet.demo.freeMargin")} {acc.cent ? "USC " : "$"}
              {formatNumber(freeMargin(acc))}
            </>
          ) : (
            <>
              {t("wallet.demo.assetAvailable", { amount: formatNumber(asset === "USDT" ? walletAvailableUsdt() : walletAsset.balance, asset === "BTC" ? 4 : 2), asset, network: walletAsset.network })}
            </>
          )}
        </div>
      </div>
      <ChevronDown className="size-4 text-fg-3" />
    </button>
  );
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="k-label">{label}</span>
        {!acc && onAsset && (
          <Segmented
            size="xs"
            value={asset}
            onChange={onAsset}
            options={WALLET.assets.map((x) => ({ value: x.asset as Asset, label: <><CoinIcon coin={x.icon} size={14} />{x.asset}</> }))}
          />
        )}
      </div>
      <Menu
        width={340}
        align="start"
        trigger={trigger}
        items={[
          { label: <span className="flex items-center justify-between gap-2">{t("wallet.demo.kalksWallet")} <span className="k-num text-[12px] text-fg-3">${formatNumber(walletAvailableUsdt())}</span></span>, icon: <Wallet />, onSelect: () => onPick(WALLET_ID), hint: value === WALLET_ID ? <Check className="size-3.5 text-ember" /> : undefined },
          "sep",
          ...ACCS.map((a) => ({
            label: (
              <span className="flex min-w-0 flex-col">
                <span className="truncate">
                  {accountTitle(a)} <span className="font-mono text-[11.5px] text-fg-3">#{a.login}</span>
                </span>
                <span className="k-num text-[11.5px] text-fg-3">
                  {a.cent ? "USC " : "$"}
                  {formatNumber(a.balance)}
                </span>
              </span>
            ),
            icon: <span className="grid size-4 place-items-center rounded-full bg-ember-soft text-[8px] font-bold text-ember">{a.group[0]}</span>,
            onSelect: () => onPick(a.login),
            hint: value === a.login ? <Check className="size-3.5 text-ember" /> : undefined,
          })),
        ]}
      />
      {lockedWallet && <div className="mt-1.5 text-[11.5px] text-fg-3">{t("wallet.demo.throughWallet")}</div>}
    </div>
  );
}

function Transfer() {
  const t = useT();
  const sp = useSearchParams();
  const qTo = ACCS.find((a) => a.login === sp.get("to"))?.login;
  const qFrom = ACCS.find((a) => a.login === sp.get("from"))?.login;
  const [from, setFrom] = React.useState<string>(qFrom ?? WALLET_ID);
  const [to, setTo] = React.useState<string>(qFrom ? WALLET_ID : (qTo ?? ACCS[0]!.login));
  const [asset, setAsset] = React.useState<Asset>("USDT");
  const [amount, setAmount] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const [spin, setSpin] = React.useState(0);
  const [recent, setRecent] = React.useState<WalletTx[]>(() => WALLET_TXS.filter((t) => t.type === "transfer").slice(0, 5));
  const [tx, setTx] = React.useState<WalletTx | null>(null);
  const btc = useQuote("BTCUSD");

  const fromAcc = ACCS.find((a) => a.login === from);
  const toAcc = ACCS.find((a) => a.login === to);
  const srcAsset: Asset = fromAcc ? "USDT" : asset;
  const amt = parseFloat(amount) || 0;

  const pickFrom = (v: string) => {
    setFrom(v);
    if (v === WALLET_ID) {
      if (to === WALLET_ID) setTo(ACCS[0]!.login);
    } else {
      setTo(WALLET_ID);
    }
    setAmount("");
  };
  const pickTo = (v: string) => {
    setTo(v);
    if (v === WALLET_ID) {
      if (from === WALLET_ID) setFrom(ACCS[0]!.login);
    } else {
      setFrom(WALLET_ID);
    }
    setAmount("");
  };
  const swap = () => {
    setSpin((s) => s + 180);
    setFrom(to);
    setTo(from);
    setAmount("");
  };

  // Conversion
  const rate = srcAsset === "USDT" ? 1 : srcAsset === "BTC" ? btc.bid : CONVERSION.rates.TRX!;
  const markup = srcAsset === "USDT" ? 0 : CONVERSION.markupPct;
  let usd = 0;
  let receive = 0;
  let receiveCur = "USD";
  let available = 0;
  let srcCur = "USDT";
  if (fromAcc) {
    srcCur = accCur(fromAcc);
    available = Math.max(0, Math.min(fromAcc.balance, freeMargin(fromAcc)));
    usd = fromAcc.cent ? amt / 100 : amt;
    receive = usd;
    receiveCur = "USDT";
  } else {
    srcCur = srcAsset;
    available = srcAsset === "USDT" ? walletAvailableUsdt() : WALLET.assets.find((x) => x.asset === srcAsset)!.balance;
    usd = amt * rate * (1 - markup / 100);
    receive = toAcc?.cent ? usd * 100 : usd;
    receiveCur = toAcc ? accCur(toAcc) : "USD";
  }
  const dec = srcAsset === "BTC" && !fromAcc ? 6 : 2;
  const newLevel = fromAcc && fromAcc.margin > 0 ? ((fromAcc.equity - amt) / fromAcc.margin) * 100 : Infinity;
  const err = !amount
    ? null
    : amt <= 0
      ? t("wallet.demo.enterAmount")
      : usd < WALLET_LIMITS.transfer.min
        ? t("wallet.demo.minTransfer", { min: WALLET_LIMITS.transfer.min })
        : fromAcc && amt > freeMargin(fromAcc)
          ? t("wallet.demo.exceedsFreeMargin", { amount: `${fromAcc.cent ? "USC " : "$"}${formatNumber(freeMargin(fromAcc))}` })
          : fromAcc && amt > fromAcc.balance
            ? t("wallet.demo.exceedsBalance")
            : amt > available
              ? t("wallet.demo.insufficientWallet")
              : usd > WALLET_LIMITS.transfer.maxPerTx
                ? t("wallet.demo.exceedsMaxTransfer")
                : null;
  const warn = !err && fromAcc && Number.isFinite(newLevel) && newLevel < 300;

  const doTransfer = () => {
    const row: WalletTx = {
      id: `TX${904500 + Math.floor(Math.random() * 99)}`,
      type: "transfer",
      status: "completed",
      amount: +usd.toFixed(2),
      asset: "USDT",
      from: fromAcc ? `Account ${fromAcc.login}` : "Wallet",
      to: toAcc ? `Account ${toAcc.login}` : "Wallet",
      fee: 0,
      createdAt: new Date().toISOString(),
    };
    setRecent((r) => [row, ...r].slice(0, 6));
    setConfirm(false);
    setAmount("");
    toast.success(t("wallet.transferCompleted"), {
      description: `${formatNumber(amt, dec)} ${srcCur} → ${formatNumber(receive)} ${receiveCur} ${toAcc ? t("wallet.demo.intoAccount", { login: toAcc.login }) : t("wallet.demo.intoWallet")}`,
    });
  };

  const summaryRows: [React.ReactNode, React.ReactNode][] = [
    [t("wallet.demo.exchangeRate"), srcAsset === "USDT" && !toAcc?.cent && !fromAcc?.cent ? "1 USDT = 1 USD" : fromAcc?.cent ? "100 USC = 1 USDT" : srcAsset === "USDT" ? "1 USDT = 100 USC" : `1 ${srcAsset} = $${formatNumber(rate, srcAsset === "BTC" ? 2 : 4)}`],
    [t("wallet.demo.conversionMarkup"), markup ? `${markup}%` : <Chip key="m" size="sm" tone="up">{t("wallet.demo.noneOneToOne")}</Chip>],
    ...(toAcc?.cent && !fromAcc ? ([[t("wallet.demo.centConversion"), `$${formatNumber(usd)} × 100 → USC`]] as [React.ReactNode, React.ReactNode][]) : []),
    [t("wallet.fee"), t("wallet.free")],
    [t("wallet.demo.arrives"), <span key="a" className="inline-flex items-center gap-1"><Zap className="size-3.5 text-gold" /> {t("wallet.demo.instantly")}</span>],
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title={t("wallet.demo.transferTitle")}
        subtitle={t("wallet.demo.transferSubtitle")}
        actions={
          <Link href="/wallet">
            <Button variant="surface">
              <ArrowLeft className="rtl:-scale-x-100" /> {t("wallet.wallet")}
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-7">
          <Card>
            <CardHeader title={t("wallet.newTransfer")} subtitle={t("wallet.demo.ownOnly")} />
            <div className="px-4 pb-6 pt-5 sm:px-6">
              <EndpointCard label={t("wallet.from")} value={from} onPick={pickFrom} asset={asset} onAsset={(a) => { setAsset(a); setAmount(""); }} />
              <div className="relative my-3 flex items-center justify-center">
                <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
                <motion.button type="button" onClick={swap} animate={{ rotate: spin }} transition={{ type: "spring", bounce: 0.3 }} className="relative grid size-10 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 shadow-[inset_0_1px_0_var(--k-border-top)] hover:border-ember/40 hover:text-ember" aria-label={t("wallet.demo.swap")}>
                  <ArrowDownUp className="size-4" />
                </motion.button>
              </div>
              <EndpointCard label={t("wallet.to")} value={to} onPick={pickTo} asset="USDT" />

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="k-label">{t("common.amount")}</span>
                  <span className="k-num text-[12px] text-fg-3">
                    {fromAcc ? t("wallet.demo.transferable") : t("wallet.available")} {formatNumber(available, dec)} {srcCur}
                  </span>
                </div>
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="0.00"
                  className={cn("h-16", err && "border-down/50")}
                  inputClassName="k-num text-[24px] font-semibold"
                  leading={fromAcc ? <span className="text-[13px] font-semibold text-fg-2">{srcCur}</span> : <CoinIcon coin={WALLET.assets.find((x) => x.asset === srcAsset)!.icon} size={24} />}
                  trailing={
                    <>
                      <span className="text-[13px]">{srcCur}</span>
                      <button type="button" className="rounded-full border border-ember/30 bg-ember-soft px-2.5 py-1 text-[11.5px] font-semibold text-ember hover:bg-ember/20" onClick={() => setAmount(available.toFixed(dec))}>
                        {t("wallet.max")}
                      </button>
                    </>
                  }
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {[25, 50, 75].map((p) => (
                    <button key={p} type="button" onClick={() => setAmount(((available * p) / 100).toFixed(dec))} className="k-num rounded-full border border-line bg-surface-2 px-3 py-1 text-[12px] text-fg-2 hover:text-fg">
                      {p}%
                    </button>
                  ))}
                  {!fromAcc && srcAsset === "USDT" && [100, 500, 1000].map((v) => (
                    <button key={v} type="button" onClick={() => setAmount(String(v))} className="k-num rounded-full border border-line bg-surface-2 px-3 py-1 text-[12px] text-fg-2 hover:text-fg">
                      ${v}
                    </button>
                  ))}
                </div>
                {err && (
                  <div className="mt-3 flex items-start gap-2 text-[12.5px] text-down">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" /> {err}
                  </div>
                )}
                {warn && (
                  <div className="mt-3 flex items-start gap-2 rounded-[14px] border border-warn/25 bg-warn-soft px-3 py-2.5 text-[12.5px] text-fg-2">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" /> <Trans k="wallet.demo.marginWarning" vars={{ login: fromAcc!.login, level: Math.round(newLevel) }} tags={{ num: (c) => <span className="k-num font-semibold text-warn">{c}</span> }} />
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <Button variant="ember" size="lg" disabled={!amt || !!err} onClick={() => setConfirm(true)}>
                  {t("wallet.demo.reviewTransfer")} <ArrowRight className="rtl:-scale-x-100" />
                </Button>
              </div>
            </div>
          </Card>
          <Card className="mt-4">
            <CardHeader title={t("wallet.demo.howTransfers")} />
            <div className="grid grid-cols-1 gap-2 px-4 pb-5 pt-4 sm:grid-cols-2 sm:px-6">
              {[
                [t("wallet.demo.rule1Title"), t("wallet.demo.rule1Text")],
                [t("wallet.demo.rule2Title"), t("wallet.demo.rule2Text")],
                [t("wallet.demo.rule3Title"), t("wallet.demo.rule3Text")],
                [t("wallet.demo.rule4Title"), t("wallet.demo.rule4Text")],
              ].map(([title, d], i) => (
                <div key={i} className="k-row px-4 py-3">
                  <div className="flex items-center gap-2 text-[13.5px] font-medium">
                    <Check className="size-3.5 text-up" /> {title}
                  </div>
                  <div className="mt-1 text-[12px] leading-snug text-fg-3">{d}</div>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>

        <div className="space-y-4 xl:col-span-5">
          <Reveal delay={0.05}>
            <Card hot className="overflow-hidden">
              <div className="relative p-6">
                <div className="k-label">{t("wallet.youReceive")}</div>
                <div dir="ltr" className="mt-2 flex items-baseline gap-2">
                  <motion.span key={receiveCur + Math.round(receive * 100)} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} className={cn("k-num text-[36px] font-semibold leading-none tracking-tight", err && "text-fg-3 line-through decoration-down/60")}>
                    {formatNumber(receive)}
                  </motion.span>
                  <span className="text-[15px] font-medium text-fg-2">{receiveCur}</span>
                </div>
                <div className="mt-1 text-[12.5px] text-fg-3">
                  {toAcc ? (
                    <span className="inline-flex items-center gap-1.5">
                      {t("wallet.demo.into")} <AccountBadge a={toAcc} /> #{toAcc.login}
                    </span>
                  ) : (
                    t("wallet.demo.intoKalksWallet")
                  )}
                </div>
                <div className="mt-5 rounded-[14px] border border-white/10 bg-black/20 light:border-black/5 light:bg-white/70 px-4">
                  <KeyValue rows={summaryRows} />
                </div>
                {fromAcc && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-[14px] border border-white/10 bg-black/20 light:border-black/5 light:bg-white/70 px-3 py-2.5">
                      <div className="text-[11.5px] text-fg-3">{t("wallet.demo.freeMarginAfter")}</div>
                      <div className={cn("k-num mt-0.5 text-[14px] font-semibold", err ? "text-down" : "text-fg")}>
                        {fromAcc.cent ? "USC " : "$"}
                        {formatNumber(Math.max(0, freeMargin(fromAcc) - amt))}
                      </div>
                    </div>
                    <div className="rounded-[14px] border border-white/10 bg-black/20 light:border-black/5 light:bg-white/70 px-3 py-2.5">
                      <div className="text-[11.5px] text-fg-3">{t("wallet.demo.marginLevelAfter")}</div>
                      <div className={cn("k-num mt-0.5 text-[14px] font-semibold", newLevel < 300 ? "text-warn" : "text-up")}>{Number.isFinite(newLevel) ? `${Math.round(Math.max(0, newLevel)).toLocaleString()}%` : "—"}</div>
                    </div>
                  </div>
                )}
                {!fromAcc && srcAsset !== "USDT" && (
                  <div className="mt-4 flex items-start gap-2 text-[12px] text-fg-3">
                    <Info className="mt-0.5 size-3.5 shrink-0" /> {t("wallet.demo.convertedNote", { asset: srcAsset, markup: CONVERSION.markupPct })}
                  </div>
                )}
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.1}>
            <Card>
              <CardHeader title={t("wallet.recentTransfers")} action={<Link href="/wallet/history"><Button size="xs" variant="surface">{t("wallet.history")}</Button></Link>} />
              <div className="k-fade-bottom mt-4 space-y-2 px-4 pb-5 sm:px-6">
                {recent.map((x) => (
                  <TxRow key={x.id} tx={x} onClick={() => setTx(x)} />
                ))}
              </div>
            </Card>
          </Reveal>
        </div>
      </div>

      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("wallet.demo.confirmTransfer")}
        description={t("wallet.demo.confirmTransferText")}
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="ember" onClick={doTransfer}>
              <ShieldCheck /> {t("wallet.demo.confirmTransfer")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="k-row flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] text-fg-3">{t("wallet.from")}</div>
              <div className="truncate text-[13.5px] font-medium">{fromAcc ? `#${fromAcc.login}` : t("wallet.demo.kalksWallet")}</div>
              <div dir="ltr" className="k-num text-[15px] font-semibold">
                {formatNumber(amt, dec)} {srcCur}
              </div>
            </div>
            <ArrowRight className="size-4 text-ember rtl:-scale-x-100" />
            <div className="min-w-0 flex-1 text-end">
              <div className="text-[12px] text-fg-3">{t("wallet.to")}</div>
              <div className="truncate text-[13.5px] font-medium">{toAcc ? `#${toAcc.login}` : t("wallet.demo.kalksWallet")}</div>
              <div dir="ltr" className="k-num text-[15px] font-semibold text-up">
                {formatNumber(receive)} {receiveCur}
              </div>
            </div>
          </div>
          <KeyValue rows={summaryRows} />
        </div>
      </Dialog>
      <TxDetailDrawer tx={tx} onOpenChange={(o) => !o && setTx(null)} />
    </div>
  );
}

function DemoTransferPage() {
  return (
    <React.Suspense fallback={null}>
      <Transfer />
    </React.Suspense>
  );
}

/** Live builds: the real wallet (services/wallet). Demo builds: the mock showcase above. */
export default function TransferPage() {
  return IS_DEMO ? <DemoTransferPage /> : <LiveTransferPage />;
}
