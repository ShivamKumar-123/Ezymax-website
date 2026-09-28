"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Award, CircleAlert, ExternalLink, IdCard, RotateCw, ShieldCheck } from "lucide-react";
import { Button, Card, Chip, CoinIcon, EmptyState, Progress, cn, formatDateTime, shortHash, type ChipTone } from "@kalks/ui";
import { CHAIN_LABEL, fmt, type ActivityItem, type Chain, type Deposit, type DepositStatus, type WithdrawalStatus } from "./api";

export const DEPOSIT_STATUS: Record<DepositStatus, { tone: ChipTone; label: string }> = {
  pending: { tone: "warn", label: "Waiting for the network" },
  confirming: { tone: "info", label: "Confirming" },
  credited: { tone: "up", label: "Credited" },
  failed: { tone: "down", label: "Failed" },
  review: { tone: "warn", label: "Under review" },
  unmatched: { tone: "warn", label: "Under review" },
  rejected: { tone: "down", label: "Not credited" },
};

export const WITHDRAWAL_STATUS: Record<WithdrawalStatus, { tone: ChipTone; label: string }> = {
  requested: { tone: "warn", label: "Waiting for review" },
  approved: { tone: "info", label: "Approved" },
  paid: { tone: "info", label: "Sending" },
  completed: { tone: "up", label: "Completed" },
  rejected: { tone: "down", label: "Rejected" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

const TRANSFER_STATUS: Record<string, { tone: ChipTone; label: string }> = {
  pending: { tone: "warn", label: "Processing" },
  completed: { tone: "up", label: "Completed" },
  failed: { tone: "down", label: "Failed" },
};

export const KIND_LABEL: Record<string, string> = {
  commission: "Commission",
  ib_payout: "Partner payout",
  prop_purchase: "Prop challenge",
  prop_payout: "Prop payout",
  pamm_invest: "PAMM investment",
  pamm_redeem: "PAMM redemption",
  copy_fee: "Copy trading fee",
  adjustment: "Balance adjustment",
  refund: "Refund",
};

export function StatusTag({ tone, label }: { tone: ChipTone; label: string }) {
  return (
    <Chip size="sm" tone={tone} dot>
      {label}
    </Chip>
  );
}

export function ChainBadge({ chain }: { chain: Chain }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative">
        <CoinIcon coin="usdt" size={20} />
        <CoinIcon coin={chain === "bsc" ? "bnb" : "trx"} size={11} className="absolute -bottom-0.5 -right-1 ring-2 ring-surface" />
      </span>
      <span className="text-[12.5px] text-fg-2">
        USDT <span className="text-fg-3">· {CHAIN_LABEL[chain].short}</span>
      </span>
    </span>
  );
}

export function HashLink({ hash, url, className }: { hash: string | null | undefined; url?: string | null; className?: string }) {
  if (!hash) return <span className="text-fg-3">—</span>;
  return (
    <a href={url ?? "#"} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={cn("inline-flex items-center gap-1 font-mono text-[12px] text-fg-2 hover:text-ember", className)}>
      {shortHash(hash, 8, 6)}
      <ExternalLink className="size-3" />
    </a>
  );
}

/** Confirmations x / y as a bar. */
export function Confirmations({ d }: { d: Pick<Deposit, "confirmations" | "required_confirmations" | "status"> }) {
  const done = d.status === "credited";
  const pct = done ? 100 : d.required_confirmations ? (Math.min(d.confirmations, d.required_confirmations) / d.required_confirmations) * 100 : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[12px]">
        <span className="text-fg-2">
          <span className="k-num font-semibold text-fg">{done ? d.required_confirmations : Math.min(d.confirmations, d.required_confirmations)}</span> / {d.required_confirmations} confirmations
        </span>
        <span className="text-fg-3">{done ? "Complete" : d.status === "pending" ? "Waiting for the first block" : "Confirming"}</span>
      </div>
      <Progress value={pct} tone={done ? "up" : "ember"} />
    </div>
  );
}

export function KycNotice({ status }: { status: string }) {
  if (status === "verified") return null;
  const pending = status === "pending";
  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-warn/30 bg-warn-soft px-5 py-4 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-warn/40 bg-warn/15 text-warn">
        <IdCard className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium">{pending ? "Your identity check is in review" : status === "rejected" ? "Your identity check needs attention" : "Verify your identity to withdraw"}</div>
        <p className="mt-0.5 text-[12.5px] text-fg-2">
          {pending
            ? "Withdrawals open as soon as your documents are approved. Deposits, transfers and trading are available now."
            : "Withdrawals need a verified identity. Deposits, transfers and trading are available without it."}
        </p>
      </div>
      <Link href="/profile/verification" className="shrink-0">
        <Button variant="surface" size="sm">
          <ShieldCheck /> {pending ? "View verification" : "Verify now"}
        </Button>
      </Link>
    </div>
  );
}

export function WalletUnavailable({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <Card>
      <EmptyState
        illustration="satellite_antenna"
        title="The wallet is unavailable"
        text={message ?? "We couldn't reach the wallet service. Your balance is safe; please try again in a moment."}
        action={
          <Button variant="surface" onClick={onRetry}>
            <RotateCw /> Try again
          </Button>
        }
      />
    </Card>
  );
}

export function activityTitle(a: ActivityItem): string {
  switch (a.type) {
    case "deposit":
      return `Deposit · USDT ${a.chain ? CHAIN_LABEL[a.chain].short : ""}`.trim();
    case "withdrawal":
      return `Withdrawal · USDT ${a.chain ? CHAIN_LABEL[a.chain].short : ""}`.trim();
    case "transfer":
      return a.direction === "out" ? `To trading account #${a.login}` : `From trading account #${a.login}`;
    default:
      return KIND_LABEL[a.kind ?? ""] ?? "Wallet transaction";
  }
}

export function activityStatus(a: ActivityItem): { tone: ChipTone; label: string } | null {
  if (a.type === "deposit") return DEPOSIT_STATUS[a.status as DepositStatus] ?? null;
  if (a.type === "withdrawal") return WITHDRAWAL_STATUS[a.status as WithdrawalStatus] ?? null;
  if (a.type === "transfer") return TRANSFER_STATUS[a.status] ?? null;
  return null;
}

function ActivityIcon({ a }: { a: ActivityItem }) {
  const inbound = a.direction === "in";
  const dim = ["failed", "rejected", "cancelled"].includes(a.status);
  const icon = a.type === "transfer" ? <ArrowLeftRight /> : a.type === "other" ? <Award /> : inbound ? <ArrowDownLeft /> : <ArrowUpRight />;
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full border [&_svg]:size-4", dim ? "border-line bg-surface-3 text-fg-3" : inbound ? "border-up/25 bg-up-soft text-up" : "border-line bg-surface-3 text-fg-2")}>
      {icon}
    </span>
  );
}

export function ActivityRow({ a }: { a: ActivityItem }) {
  const st = activityStatus(a);
  const dim = ["failed", "rejected", "cancelled"].includes(a.status);
  const sub =
    a.type === "deposit" && a.status === "confirming" && a.required_confirmations
      ? `${Math.min(a.confirmations ?? 0, a.required_confirmations)} / ${a.required_confirmations} confirmations`
      : a.type === "withdrawal" && a.address
        ? `To ${shortHash(a.address, 6, 4)}`
        : a.note ?? "";
  return (
    <div className="k-row flex items-center gap-3 px-4 py-3">
      <ActivityIcon a={a} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
          {activityTitle(a)}
          {st && a.status !== "completed" && a.status !== "credited" && <StatusTag {...st} />}
        </div>
        <div className="truncate text-[11.5px] text-fg-3">
          {formatDateTime(a.created_at)}
          {sub ? ` · ${sub}` : ""}
          {a.tx_hash && (
            <>
              {" · "}
              <HashLink hash={a.tx_hash} url={a.explorer_url} className="text-[11.5px]" />
            </>
          )}
        </div>
      </div>
      <span className={cn("k-num whitespace-nowrap text-[14px] font-semibold", dim ? "text-fg-3 line-through" : a.direction === "in" ? "text-up" : "text-fg")}>
        {a.direction === "in" ? "+" : "−"}
        {fmt(a.amount)}
        <span className="ml-1 text-[0.8em] font-medium text-fg-3">{a.type === "transfer" && a.direction === "in" ? "USD" : "USDT"}</span>
      </span>
    </div>
  );
}

export function InlineError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2 rounded-[12px] border border-down/30 bg-down-soft px-3 py-2 text-[12.5px] text-fg">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-down" />
      <span>{children}</span>
    </div>
  );
}

export function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="k-row px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className="k-num mt-0.5 text-[13px] font-semibold">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-fg-3">{hint}</div>}
    </div>
  );
}
