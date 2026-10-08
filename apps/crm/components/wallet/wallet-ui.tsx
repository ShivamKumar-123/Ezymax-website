"use client";

import * as React from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Award, Copy, ExternalLink, Gift, IdCard, Repeat, Share2, ShieldAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, CopyButton, Dialog, KeyValue, Progress, StatusChip, cn, formatDateTime, formatNumber, shortHash } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";
import type { T } from "@ezymex/i18n";
import { WALLET, type WalletTx } from "@ezymex/mock";
import { TX_TYPE_LABEL, WALLET_LIMITS, fullHash, txDirection } from "@ezymex/mock/wallet-extra";

export const tronscan = (hash: string) => `https://tronscan.org/#/transaction/${hash}`;

/** Translated transaction type (the English labels live in the mock). */
export const txTypeLabel = (t: T, type: WalletTx["type"]) => t.dyn(`wallet.txType.${type}`, TX_TYPE_LABEL[type]);
/** Translated label for a StatusChip status (undefined: the chip's own label). */
export const txStatusLabel = (t: T, status: string) => (t.has(`common.${status}`) ? t.dyn(`common.${status}`) : undefined);

const TX_ICON: Record<WalletTx["type"], React.ReactNode> = {
  deposit: <ArrowDownLeft />,
  withdrawal: <ArrowUpRight />,
  transfer: <ArrowLeftRight />,
  "ib-payout": <Award />,
  "copy-fee": <Users />,
  bonus: <Gift />,
  conversion: <Repeat />,
};

export function TxIcon({ tx, size = 36 }: { tx: WalletTx; size?: number }) {
  const dir = txDirection(tx);
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full border [&_svg]:size-4", tx.status === "rejected" ? "border-line bg-surface-3 text-fg-3" : dir === "in" ? "border-up/25 bg-up-soft text-up" : "border-line bg-surface-3 text-fg-2")}
      style={{ width: size, height: size }}
    >
      {TX_ICON[tx.type]}
    </span>
  );
}

export function TxAmount({ tx, className }: { tx: WalletTx; className?: string }) {
  const dir = txDirection(tx);
  return (
    <span dir="ltr" className={cn("k-num whitespace-nowrap font-semibold", tx.status === "rejected" ? "text-fg-3 line-through" : dir === "in" ? "text-up" : "text-fg", className)}>
      {dir === "in" ? "+" : "-"}
      {formatNumber(tx.amount)}
      <span className="ms-1 text-[0.8em] font-medium text-fg-3">{tx.asset}</span>
    </span>
  );
}

export function HashLink({ hash, className }: { hash?: string; className?: string }) {
  if (!hash) return <span className="text-fg-3">—</span>;
  const h = fullHash(hash);
  return (
    <a href={tronscan(h)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={cn("inline-flex items-center gap-1 font-mono text-[12px] text-fg-2 hover:text-ember", className)}>
      {shortHash(h, 6, 6)}
      <ExternalLink className="size-3" />
    </a>
  );
}

export function txCounterparty(tx: WalletTx, t: T) {
  switch (tx.type) {
    case "deposit":
      return t("wallet.demo.fromExternal");
    case "withdrawal":
      return t("wallet.demo.toParty", { party: tx.to.replace("TRC20 · ", "") });
    case "transfer":
      return tx.to === "Wallet" ? t("wallet.demo.fromParty", { party: tx.from }) : t("wallet.demo.toParty", { party: tx.to });
    case "ib-payout":
      return t("wallet.demo.partnerCommission");
    case "copy-fee":
      return t("wallet.demo.performanceFee");
    case "bonus":
      return t("wallet.demo.contestReward");
    case "conversion":
      return t("wallet.demo.conversionAtMarket");
  }
}

export function TxRow({ tx, onClick }: { tx: WalletTx; onClick?: () => void }) {
  const t = useT();
  return (
    <button type="button" onClick={onClick} className="k-row flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:border-[var(--k-border-top)] hover:bg-surface-3/60">
      <TxIcon tx={tx} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[13.5px] font-medium">
          {txTypeLabel(t, tx.type)}
          {tx.status !== "completed" && <StatusChip status={tx.status} label={txStatusLabel(t, tx.status)} />}
        </div>
        <div className="truncate text-[11.5px] text-fg-3">
          {txCounterparty(tx, t)} · {formatDateTime(tx.createdAt)}
        </div>
      </div>
      <TxAmount tx={tx} className="text-[14px]" />
    </button>
  );
}

/* ------------------------------------------------------------------ */

export function TxDetailDrawer({ tx, onOpenChange }: { tx: WalletTx | null; onOpenChange: (o: boolean) => void }) {
  const t = useT();
  const steps = tx
    ? tx.type === "withdrawal"
      ? [t("wallet.demo.stepRequested"), t("wallet.demo.stepEmailVerified"), t("wallet.demo.stepAdminApproval"), t("wallet.demo.stepBroadcast"), t("wallet.demo.stepCompleted")]
      : tx.type === "deposit"
        ? [t("wallet.demo.stepDetected"), t("wallet.demo.stepConfirming"), t("wallet.demo.stepCredited")]
        : [t("wallet.demo.stepRequested"), t("wallet.demo.stepProcessing"), t("wallet.demo.stepCompleted")]
    : [];
  const reached = !tx ? 0 : tx.status === "completed" ? steps.length : tx.status === "rejected" ? -1 : tx.type === "withdrawal" ? (tx.status === "pending" ? 2 : 3) : tx.type === "deposit" ? 1 : 1;
  return (
    <Dialog
      side="right"
      open={!!tx}
      onOpenChange={onOpenChange}
      title={tx ? `${txTypeLabel(t, tx.type)} · ${tx.id}` : ""}
      description={tx ? `${formatDateTime(tx.createdAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })} · GMT+3` : undefined}
      footer={
        tx && (
          <>
            <Button variant="ghost" onClick={() => toast.success(t("wallet.demo.receiptDownloaded"), { description: `${tx.id}.pdf` })}>
              {t("wallet.demo.downloadReceipt")}
            </Button>
            <Link href="/support">
              <Button variant="surface">{t("wallet.demo.getHelp")}</Button>
            </Link>
          </>
        )
      }
    >
      {tx && (
        <div>
          <div className="k-row flex flex-col items-center px-4 py-6 text-center">
            <TxIcon tx={tx} size={48} />
            <TxAmount tx={tx} className="mt-3 text-[30px] tracking-tight" />
            <div className="mt-2">
              <StatusChip status={tx.status} label={txStatusLabel(t, tx.status)} />
            </div>
          </div>
          <div className="mt-5">
            <div className="k-label mb-3">{t("wallet.demo.progress")}</div>
            <ol className="space-y-0">
              {steps.map((s, i) => {
                const done = reached === -1 ? i === 0 : i < reached;
                const on = reached !== -1 && i === reached;
                const failed = reached === -1 && i === 1;
                return (
                  <li key={s} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < steps.length - 1 && <span className={cn("absolute start-[9px] top-5 h-[calc(100%-12px)] w-px", done ? "bg-up/50" : "bg-line")} />}
                    <span className={cn("relative mt-0.5 grid size-[19px] shrink-0 place-items-center rounded-full border", done && "border-up/40 bg-up-soft", on && "border-ember/50 bg-ember-soft", failed && "border-down/40 bg-down-soft", !done && !on && !failed && "border-line")}>
                      <span className={cn("size-1.5 rounded-full", done ? "bg-up" : on ? "animate-pulse-dot bg-ember text-ember" : failed ? "bg-down" : "bg-fg-3/40")} />
                    </span>
                    <div className={cn("text-[13px]", done ? "text-fg" : on ? "text-ember" : failed ? "text-down" : "text-fg-3")}>
                      {failed ? t("wallet.demo.rejectedByCompliance") : s}
                      {on && tx.type === "deposit" && tx.confirmations !== undefined && <span className="k-num ms-2 text-fg-3">{tx.confirmations}/20</span>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          <KeyValue
            className="mt-5"
            rows={[
              [t("wallet.demo.transactionId"), <span key="i" className="inline-flex items-center gap-1 font-mono">{tx.id}<CopyButton value={tx.id} label={t("wallet.demo.transactionId")} /></span>],
              [t("common.type"), txTypeLabel(t, tx.type)],
              [t("wallet.from"), tx.from],
              [t("wallet.to"), tx.to],
              [t("wallet.demo.asset"), `${tx.asset} · TRC20`],
              [t("wallet.demo.networkFee"), tx.fee ? <span key="f" dir="ltr">{formatNumber(tx.fee)} USDT</span> : t("wallet.free")],
              ...(tx.type === "withdrawal" ? ([[t("wallet.demo.youReceived"), <span key="r" dir="ltr">{formatNumber(tx.amount - tx.fee)} USDT</span>]] as [React.ReactNode, React.ReactNode][]) : []),
              ...(tx.confirmations !== undefined ? ([[t("wallet.demo.confirmations"), <span key="c" dir="ltr">{tx.confirmations} / 20</span>]] as [React.ReactNode, React.ReactNode][]) : []),
              ...(tx.hash ? ([[t("wallet.demo.txHash"), <HashLink key="h" hash={tx.hash} />]] as [React.ReactNode, React.ReactNode][]) : []),
            ]}
          />
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

export function AddressQr({ size = 168 }: { size?: number }) {
  return (
    <div className="relative rounded-[20px] bg-white p-3 shadow-[0_20px_60px_-20px_color-mix(in_oklab,var(--k-ember)_45%,transparent)]">
      <QRCodeSVG
        value={WALLET.address}
        size={size}
        level="H"
        bgColor="#ffffff"
        fgColor="#0e0e12"
        imageSettings={{ src: "/assets/coins/usdt.svg", height: size * 0.2, width: size * 0.2, excavate: true }}
      />
    </div>
  );
}

export function AddressBox({ className }: { className?: string }) {
  const t = useT();
  return (
    <div className={cn("k-row flex items-center gap-2 px-4 py-3", className)}>
      <span dir="ltr" className="min-w-0 flex-1 break-all font-mono text-[13px] leading-snug text-fg">{WALLET.address}</span>
      <CopyButton value={WALLET.address} label={t("wallet.demo.depositAddress")} className="size-8" />
    </div>
  );
}

export function DepositAddressCard() {
  const t = useT();
  return (
    <Card className="h-full">
      <CardHeader
        title={t("wallet.demo.depositAddress")}
        subtitle="USDT · TRON (TRC20)"
        action={
          <Chip tone="up" dot>
            {t("wallet.demo.autoCredit")}
          </Chip>
        }
      />
      <div className="flex flex-col items-center gap-5 px-4 pb-6 pt-5 sm:flex-row sm:items-start sm:px-6">
        <AddressQr size={140} />
        <div className="w-full min-w-0 flex-1">
          <AddressBox />
          <div className="mt-3 flex items-start gap-2 rounded-[14px] border border-warn/25 bg-warn-soft px-3 py-2.5 text-[12px] text-fg-2">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warn" />
            {t("wallet.demo.sendOnlyTrc20")}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="surface"
              onClick={() => {
                navigator.clipboard?.writeText(WALLET.address).catch(() => {});
                toast.success(t("wallet.demo.addressCopied"));
              }}
            >
              <Copy /> {t("common.copy")}
            </Button>
            <Button size="sm" variant="surface" onClick={() => toast.success(t("wallet.demo.shareCreated"), { description: t("wallet.demo.shareValid") })}>
              <Share2 /> {t("wallet.demo.share")}
            </Button>
            <Link href="/wallet/deposit">
              <Button size="sm" variant="ghost">
                {t("common.details")} <ArrowUpRight className="rtl:-scale-x-100" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
      <div className="mx-4 mb-5 grid grid-cols-2 gap-2 sm:mx-6 sm:grid-cols-4">
        {[
          [t("wallet.network"), <span key="n" className="inline-flex items-center gap-1.5"><span className="size-1.5 animate-pulse-dot rounded-full bg-up text-up" />{t("wallet.demo.operational")}</span>],
          [t("wallet.demo.latestBlock"), <span key="b" className="font-mono">66,412,908</span>],
          [t("wallet.demo.blockTime"), t("wallet.demo.blockTimeValue")],
          [t("wallet.demo.creditAfter"), t("wallet.demo.confirmationsCount", { count: 20 })],
        ].map(([k, v], i) => (
          <div key={i} className="k-row px-3 py-2.5">
            <div className="text-[11.5px] text-fg-3">{k}</div>
            <div className="k-num mt-0.5 text-[12.5px] font-medium">{v}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function LimitsCard() {
  const t = useT();
  const L = WALLET_LIMITS;
  const rows = [
    { label: t("wallet.demo.dailyWithdrawal"), used: L.withdraw.usedToday, max: L.withdraw.daily },
    { label: t("wallet.demo.monthlyWithdrawal"), used: L.withdraw.usedMonth, max: L.withdraw.monthly },
    { label: t("wallet.demo.dailyTransfers"), used: L.transfer.usedToday, max: L.transfer.daily },
  ];
  return (
    <Card className="h-full">
      <CardHeader title={t("wallet.demo.limitsTitle")} subtitle={t("wallet.demo.limitsSubtitle")} action={<Link href="/profile/verification"><Button size="xs" variant="surface">{t("wallet.demo.raiseLimits")}</Button></Link>} />
      <div className="space-y-4 px-6 pb-4 pt-5">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1.5 flex justify-between text-[12.5px]">
              <span className="text-fg-2">{r.label}</span>
              <span dir="ltr" className="k-num text-fg-3">
                <span className="text-fg">${formatNumber(r.used, 0)}</span> / ${formatNumber(r.max, 0)}
              </span>
            </div>
            <Progress value={(r.used / r.max) * 100} tone={r.used / r.max > 0.8 ? "warn" : "gold"} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-5 sm:px-6">
        {[
          [t("wallet.demo.minDeposit"), `${L.deposit.min} USDT`],
          [t("wallet.demo.minWithdrawal"), `${L.withdraw.min} USDT`],
          [t("wallet.demo.maxPerWithdrawal"), `${formatNumber(L.withdraw.maxPerTx, 0)} USDT`],
          [t("wallet.demo.withdrawalFee"), t("wallet.demo.usdtFlat", { amount: L.withdraw.fee })],
        ].map(([k, v]) => (
          <div key={k} className="k-row px-3 py-2.5">
            <div className="text-[11.5px] text-fg-3">{k}</div>
            <div className="k-num mt-0.5 text-[13px] font-semibold">{v}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function KycBanner({ compact }: { compact?: boolean }) {
  const t = useT();
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-warn/30 bg-warn-soft">
      <div className="pointer-events-none absolute -end-10 -top-16 size-48 rounded-full bg-warn/20 blur-3xl" />
      <div className={cn("relative flex flex-col gap-4 sm:flex-row sm:items-center", compact ? "px-4 py-3" : "px-5 py-4")}>
        <span className="grid size-11 shrink-0 place-items-center rounded-full border border-warn/40 bg-warn/15 text-warn">
          <IdCard className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[14.5px] font-medium">
            {t("wallet.demo.kycTitle")} <Chip size="sm" tone="warn" dot>{t("wallet.demo.kycChip")}</Chip>
          </div>
          <p className="mt-0.5 text-[13px] text-fg-2">{t("wallet.demo.kycText")}</p>
        </div>
        <Link href="/profile/verification" className="shrink-0">
          <Button variant="ember">{t("wallet.demo.checkVerification")}</Button>
        </Link>
      </div>
    </div>
  );
}
