"use client";

import * as React from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Award, Copy, ExternalLink, Gift, IdCard, Repeat, Share2, ShieldAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, CopyButton, Dialog, KeyValue, Progress, StatusChip, cn, formatDateTime, formatNumber, shortHash } from "@kalks/ui";
import { WALLET, type WalletTx } from "@kalks/mock";
import { TX_TYPE_LABEL, WALLET_LIMITS, fullHash, txDirection } from "@kalks/mock/wallet-extra";

export const tronscan = (hash: string) => `https://tronscan.org/#/transaction/${hash}`;

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
    <span className={cn("k-num whitespace-nowrap font-semibold", tx.status === "rejected" ? "text-fg-3 line-through" : dir === "in" ? "text-up" : "text-fg", className)}>
      {dir === "in" ? "+" : "-"}
      {formatNumber(tx.amount)}
      <span className="ml-1 text-[0.8em] font-medium text-fg-3">{tx.asset}</span>
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

export function txCounterparty(tx: WalletTx) {
  switch (tx.type) {
    case "deposit":
      return "From external TRC20 address";
    case "withdrawal":
      return `To ${tx.to.replace("TRC20 · ", "")}`;
    case "transfer":
      return tx.to === "Wallet" ? `From ${tx.from}` : `To ${tx.to}`;
    case "ib-payout":
      return "Partner programme commission";
    case "copy-fee":
      return `Performance fee from followers`;
    case "bonus":
      return "Contest reward";
    case "conversion":
      return "TRX → USDT at market";
  }
}

export function TxRow({ tx, onClick }: { tx: WalletTx; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="k-row flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:border-[var(--k-border-top)] hover:bg-surface-3/60">
      <TxIcon tx={tx} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[13.5px] font-medium">
          {TX_TYPE_LABEL[tx.type]}
          {tx.status !== "completed" && <StatusChip status={tx.status} />}
        </div>
        <div className="truncate text-[11.5px] text-fg-3">
          {txCounterparty(tx)} · {formatDateTime(tx.createdAt)}
        </div>
      </div>
      <TxAmount tx={tx} className="text-[14px]" />
    </button>
  );
}

/* ------------------------------------------------------------------ */

export function TxDetailDrawer({ tx, onOpenChange }: { tx: WalletTx | null; onOpenChange: (o: boolean) => void }) {
  const steps = tx
    ? tx.type === "withdrawal"
      ? ["Requested", "Email verified", "Admin approval", "Broadcast on TRON", "Completed"]
      : tx.type === "deposit"
        ? ["Detected on-chain", "Confirming (20 blocks)", "Credited to wallet"]
        : ["Requested", "Processing", "Completed"]
    : [];
  const reached = !tx ? 0 : tx.status === "completed" ? steps.length : tx.status === "rejected" ? -1 : tx.type === "withdrawal" ? (tx.status === "pending" ? 2 : 3) : tx.type === "deposit" ? 1 : 1;
  return (
    <Dialog
      side="right"
      open={!!tx}
      onOpenChange={onOpenChange}
      title={tx ? `${TX_TYPE_LABEL[tx.type]} · ${tx.id}` : ""}
      description={tx ? `${formatDateTime(tx.createdAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })} · GMT+3` : undefined}
      footer={
        tx && (
          <>
            <Button variant="ghost" onClick={() => toast.success("Receipt downloaded", { description: `${tx.id}.pdf` })}>
              Download receipt
            </Button>
            <Link href="/support">
              <Button variant="surface">Get help</Button>
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
              <StatusChip status={tx.status} />
            </div>
          </div>
          <div className="mt-5">
            <div className="k-label mb-3">Progress</div>
            <ol className="space-y-0">
              {steps.map((s, i) => {
                const done = reached === -1 ? i === 0 : i < reached;
                const on = reached !== -1 && i === reached;
                const failed = reached === -1 && i === 1;
                return (
                  <li key={s} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < steps.length - 1 && <span className={cn("absolute left-[9px] top-5 h-[calc(100%-12px)] w-px", done ? "bg-up/50" : "bg-line")} />}
                    <span className={cn("relative mt-0.5 grid size-[19px] shrink-0 place-items-center rounded-full border", done && "border-up/40 bg-up-soft", on && "border-ember/50 bg-ember-soft", failed && "border-down/40 bg-down-soft", !done && !on && !failed && "border-line")}>
                      <span className={cn("size-1.5 rounded-full", done ? "bg-up" : on ? "animate-pulse-dot bg-ember text-ember" : failed ? "bg-down" : "bg-fg-3/40")} />
                    </span>
                    <div className={cn("text-[13px]", done ? "text-fg" : on ? "text-ember" : failed ? "text-down" : "text-fg-3")}>
                      {failed ? "Rejected by compliance — funds returned to wallet" : s}
                      {on && tx.type === "deposit" && tx.confirmations !== undefined && <span className="k-num ml-2 text-fg-3">{tx.confirmations}/20</span>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          <KeyValue
            className="mt-5"
            rows={[
              ["Transaction ID", <span key="i" className="inline-flex items-center gap-1 font-mono">{tx.id}<CopyButton value={tx.id} label="Transaction ID" /></span>],
              ["Type", TX_TYPE_LABEL[tx.type]],
              ["From", tx.from],
              ["To", tx.to],
              ["Asset", `${tx.asset} · TRC20`],
              ["Network fee", tx.fee ? `${formatNumber(tx.fee)} USDT` : "Free"],
              ...(tx.type === "withdrawal" ? ([["You received", `${formatNumber(tx.amount - tx.fee)} USDT`]] as [React.ReactNode, React.ReactNode][]) : []),
              ...(tx.confirmations !== undefined ? ([["Confirmations", `${tx.confirmations} / 20`]] as [React.ReactNode, React.ReactNode][]) : []),
              ...(tx.hash ? ([["Tx hash", <HashLink key="h" hash={tx.hash} />]] as [React.ReactNode, React.ReactNode][]) : []),
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
    <div className="relative rounded-[20px] bg-white p-3 shadow-[0_20px_60px_-20px_rgba(255,90,31,0.45)]">
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
  return (
    <div className={cn("k-row flex items-center gap-2 px-4 py-3", className)}>
      <span className="min-w-0 flex-1 break-all font-mono text-[13px] leading-snug text-fg">{WALLET.address}</span>
      <CopyButton value={WALLET.address} label="Deposit address" className="size-8" />
    </div>
  );
}

export function DepositAddressCard() {
  return (
    <Card className="h-full">
      <CardHeader
        title="Deposit address"
        subtitle="USDT · TRON (TRC20)"
        action={
          <Chip tone="up" dot>
            Auto-credit
          </Chip>
        }
      />
      <div className="flex flex-col items-center gap-5 px-4 pb-6 pt-5 sm:flex-row sm:items-start sm:px-6">
        <AddressQr size={140} />
        <div className="w-full min-w-0 flex-1">
          <AddressBox />
          <div className="mt-3 flex items-start gap-2 rounded-[14px] border border-warn/25 bg-warn-soft px-3 py-2.5 text-[12px] text-fg-2">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warn" />
            Send only USDT on TRON (TRC20). Other tokens or networks will be lost.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="surface"
              onClick={() => {
                navigator.clipboard?.writeText(WALLET.address).catch(() => {});
                toast.success("Deposit address copied");
              }}
            >
              <Copy /> Copy
            </Button>
            <Button size="sm" variant="surface" onClick={() => toast.success("Share link created", { description: "Valid for 24 hours" })}>
              <Share2 /> Share
            </Button>
            <Link href="/wallet/deposit">
              <Button size="sm" variant="ghost">
                Details <ArrowUpRight />
              </Button>
            </Link>
          </div>
        </div>
      </div>
      <div className="mx-4 mb-5 grid grid-cols-2 gap-2 sm:mx-6 sm:grid-cols-4">
        {[
          ["Network", <span key="n" className="inline-flex items-center gap-1.5"><span className="size-1.5 animate-pulse-dot rounded-full bg-up text-up" />Operational</span>],
          ["Latest block", <span key="b" className="font-mono">66,412,908</span>],
          ["Block time", "≈ 3 sec"],
          ["Credit after", "20 confirmations"],
        ].map(([k, v], i) => (
          <div key={i} className="k-row px-3 py-2.5">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{k}</div>
            <div className="k-num mt-0.5 text-[12.5px] font-medium">{v}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function LimitsCard() {
  const L = WALLET_LIMITS;
  const rows = [
    { label: "Daily withdrawal", used: L.withdraw.usedToday, max: L.withdraw.daily },
    { label: "Monthly withdrawal", used: L.withdraw.usedMonth, max: L.withdraw.monthly },
    { label: "Daily transfers", used: L.transfer.usedToday, max: L.transfer.daily },
  ];
  return (
    <Card className="h-full">
      <CardHeader title="Limits & fees" subtitle="Level 1 · resets 00:00 GMT+3" action={<Link href="/profile/verification"><Button size="xs" variant="surface">Raise limits</Button></Link>} />
      <div className="space-y-4 px-6 pb-4 pt-5">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1.5 flex justify-between text-[12.5px]">
              <span className="text-fg-2">{r.label}</span>
              <span className="k-num text-fg-3">
                <span className="text-fg">${formatNumber(r.used, 0)}</span> / ${formatNumber(r.max, 0)}
              </span>
            </div>
            <Progress value={(r.used / r.max) * 100} tone={r.used / r.max > 0.8 ? "warn" : "gold"} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-5 sm:px-6">
        {[
          ["Min deposit", `${L.deposit.min} USDT`],
          ["Min withdrawal", `${L.withdraw.min} USDT`],
          ["Max per withdrawal", `${formatNumber(L.withdraw.maxPerTx, 0)} USDT`],
          ["Withdrawal fee", `${L.withdraw.fee} USDT flat`],
        ].map(([k, v]) => (
          <div key={k} className="k-row px-3 py-2.5">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{k}</div>
            <div className="k-num mt-0.5 text-[13px] font-semibold">{v}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function KycBanner({ compact }: { compact?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-warn/30 bg-warn-soft">
      <div className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-warn/20 blur-3xl" />
      <div className={cn("relative flex flex-col gap-4 sm:flex-row sm:items-center", compact ? "px-4 py-3" : "px-5 py-4")}>
        <span className="grid size-11 shrink-0 place-items-center rounded-full border border-warn/40 bg-warn/15 text-warn">
          <IdCard className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[14.5px] font-medium">
            Verify your identity to withdraw <Chip size="sm" tone="warn" dot>KYC in review</Chip>
          </div>
          <p className="mt-0.5 text-[13px] text-fg-2">Your documents are being reviewed (usually under 24h). Deposits, transfers and trading remain fully available. The withdrawal flow below is shown in preview.</p>
        </div>
        <Link href="/profile/verification" className="shrink-0">
          <Button variant="ember">Check verification</Button>
        </Link>
      </div>
    </div>
  );
}
