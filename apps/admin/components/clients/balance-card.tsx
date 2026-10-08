"use client";

/**
 * Client 360 "Balance & credit" card: the client's USDT wallet and trading accounts (balance, credit, equity,
 * free margin), open adjustment requests and the latest manual adjustments, with the Balance & credit action.
 * Hidden for staff without any finance permission (the wallet service answers 403).
 */
import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Coins, Plus } from "lucide-react";
import { Button, Card, CardHeader, Chip, Skeleton, cn, type ChipTone } from "@ezymex/ui";
import { ErrorState, ago, useApi, useNow, when } from "@/components/live/kit";
import { useCan } from "@/components/staff-session";
import { AdjustDialog, OP_LABEL, fmt, signedOf, type Adjustment, type AdjustPreset, type Targets } from "./adjust-dialog";

export const ADJ_STATUS: Record<Adjustment["status"], { tone: ChipTone; label: string }> = {
  pending: { tone: "warn", label: "Awaiting approval" },
  processing: { tone: "info", label: "Processing" },
  applied: { tone: "up", label: "Applied" },
  rejected: { tone: "down", label: "Rejected" },
  failed: { tone: "down", label: "Failed" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

export function AdjStatus({ s }: { s: Adjustment["status"] }) {
  const x = ADJ_STATUS[s] ?? { tone: "neutral" as ChipTone, label: s };
  return (
    <Chip size="sm" tone={x.tone} dot>
      {x.label}
    </Chip>
  );
}

export function SignedAmount({ a, className }: { a: Pick<Adjustment, "op" | "amount" | "currency">; className?: string }) {
  const up = signedOf(a.op) > 0;
  return (
    <span className={cn("k-num whitespace-nowrap font-mono", up ? "text-up" : "text-down", className)}>
      {up ? "+" : "−"}
      {fmt(a.amount)} <span className="text-fg-3">{a.currency}</span>
    </span>
  );
}

function Metric({ k, v, testid }: { k: string; v: unknown; testid?: string }) {
  return (
    <span className="flex items-baseline justify-between gap-2 whitespace-nowrap">
      <span className="text-fg-3">{k}</span>
      <span className="k-num font-mono text-fg" data-testid={testid}>
        {fmt(v)}
      </span>
    </span>
  );
}

export function ClientBalanceCard({ userId, clientName }: { userId: number; clientName?: string }) {
  const read = useCan("finance.read");
  const adjust = useCan("finance.adjust");
  const credit = useCan("finance.credit");
  const approve = useCan("finance.adjust_approve");
  // staff without any finance permission never see (or request) the card
  return read || adjust || credit || approve ? <BalanceCard userId={userId} clientName={clientName} /> : null;
}

function BalanceCard({ userId, clientName }: { userId: number; clientName?: string }) {
  const now = useNow();
  const { data, error, reload } = useApi<Targets>(`/api/wallet/adjustments/targets/${userId}`);
  const [preset, setPreset] = React.useState<AdjustPreset | null>(null);
  if (error?.code === "forbidden" || error?.code === "not_configured") return null;
  const usdt = data?.wallet.find((w) => w.currency === "USDT");
  const canAct = !!data && (data.can.adjust || data.can.credit);

  return (
    <Card>
      <CardHeader
        title="Balance & credit"
        subtitle="Wallet and trading accounts · manual adjustments"
        icon={<Coins />}
        action={
          canAct ? (
            <Button size="sm" variant="surface" onClick={() => setPreset({ target: "wallet" })} data-testid="balance-credit-open">
              <Plus /> Balance & credit
            </Button>
          ) : undefined
        }
      />
      <div className="space-y-4 px-4 pb-5 pt-4 sm:px-6">
        {error ? (
          <ErrorState error={error} onRetry={reload} className="py-6" />
        ) : !data ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="k-row px-3.5 py-2.5">
                <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Wallet · USDT</div>
                <div className="k-num mt-0.5 font-mono text-[15px] font-medium" data-testid="wallet-available">
                  {fmt(usdt?.available ?? 0)}
                </div>
                {Number(usdt?.locked ?? 0) > 0 && <div className="text-[11px] text-fg-3">locked {fmt(usdt?.locked)}</div>}
              </div>
              <div className="k-row px-3.5 py-2.5">
                <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Trading accounts</div>
                <div className="k-num mt-0.5 font-mono text-[15px] font-medium">{data.accounts.length}</div>
                {!data.engine_available && <div className="text-[11px] text-warn">engine unavailable</div>}
              </div>
            </div>

            {data.accounts.length > 0 && (
              <ul className="divide-y divide-line rounded-[14px] border border-line">
                {data.accounts.map((a) => (
                  <li key={a.login} className="flex items-center gap-3 px-3.5 py-2.5" data-testid={`acct-${a.login}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
                        <span className="font-mono font-medium">{a.login}</span>
                        <span className="text-[11px] text-fg-3">
                          {a.type === "demo" ? "Demo" : "Live"} · {a.groupName ?? a.group} · {a.currency}
                        </span>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-x-5 gap-y-0.5 text-[11.5px]">
                        <Metric k="Balance" v={a.balance} testid="acct-balance" />
                        <Metric k="Credit" v={a.credit} testid="acct-credit" />
                        <Metric k="Equity" v={a.equity} />
                        <Metric k="Free margin" v={a.freeMargin} />
                      </div>
                    </div>
                    {canAct && (
                      <Button size="xs" variant="surface" onClick={() => setPreset({ target: "trading", login: a.login })} aria-label={`Adjust ${a.login}`}>
                        Adjust
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {data.recent.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[12px] text-fg-3">
                  <span>Manual adjustments{data.open.length ? ` · ${data.open.length} open` : ""}</span>
                  <Link href={`/finance/adjustments?user_id=${userId}`} className="inline-flex items-center gap-1 hover:text-fg">
                    All <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
                <ul className="divide-y divide-line rounded-[14px] border border-line">
                  {data.recent.slice(0, 6).map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-[12.5px]">
                      <span className="flex min-w-0 items-center gap-2">
                        <SignedAmount a={a} />
                        <span className="truncate text-fg-2">
                          {OP_LABEL[a.op]} · {a.target === "wallet" ? "wallet" : a.login} · {a.category_label}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-[11.5px] text-fg-3">
                        <span title={when(a.created_at, true)}>
                          {a.requested_by.name} · {ago(a.created_at, now)}
                        </span>
                        <AdjStatus s={a.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
      <AdjustDialog open={!!preset} onOpenChange={(o) => !o && setPreset(null)} userId={userId} clientName={clientName} preset={preset ?? undefined} onDone={reload} />
    </Card>
  );
}
