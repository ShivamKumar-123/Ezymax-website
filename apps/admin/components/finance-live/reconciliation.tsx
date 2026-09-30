"use client";

import * as React from "react";
import { CheckCircle2, RefreshCw, Scale, TriangleAlert, Wallet } from "lucide-react";
import { Button, Card, CardHeader, KpiCard, PageHeader, cn } from "@kalks/ui";
import { ErrorState, TableSkeleton, useApi, when } from "@/components/live/kit";
import { Addr, CHAIN_NAME, CHAIN_SHORT, Row, usd, usd2, type Chain } from "./kit";

type ChainRecon = {
  chain: Chain;
  network: string;
  ledger_received: string;
  deposits_credited: string;
  deposits_credited_count: number;
  deposits_held: string;
  deposits_held_count: number;
  deposits_confirming: string;
  deposits_rejected: string;
  ledger_paid_out: string;
  withdrawals_paid: string;
  withdrawals_paid_count: number;
  withdrawals_in_flight: string;
  fees: string;
  ledger_matches_deposits: boolean;
  ledger_matches_withdrawals: boolean;
  expected_onchain: string;
  onchain_balance: string | null;
  onchain_difference: string | null;
  addresses: { address: string; role: string; active: boolean; usdt: string | null }[];
};

type Recon = {
  liabilities: { available: string; locked: string; total: string };
  system_accounts: { account: string; balance: string }[];
  trading_net_in: string;
  fees_earned: string;
  chains: ChainRecon[];
  invariants: { ok: boolean; problems: string[] };
  generated_at: string;
};

function Match({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[12px]", ok ? "text-up" : "text-down")}>
      {ok ? <CheckCircle2 className="size-3.5" /> : <TriangleAlert className="size-3.5" />} {label}
    </span>
  );
}

function ChainCard({ c }: { c: ChainRecon }) {
  const diff = c.onchain_difference === null ? null : Number(c.onchain_difference);
  return (
    <Card>
      <CardHeader title={`${CHAIN_NAME[c.chain]} · USDT ${CHAIN_SHORT[c.chain]}`} subtitle="Wallet ledger against on-chain movements and the company address balances" />
      <div className="grid grid-cols-1 gap-6 px-6 pb-6 pt-4 lg:grid-cols-2">
        <div>
          <div className="k-label mb-1">Received</div>
          <Row k="Credited deposits (on chain)" v={<span className="k-num font-mono">{usd(c.deposits_credited)} · {c.deposits_credited_count}</span>} />
          <Row k="Ledger: deposits booked" v={<span className="k-num font-mono">{usd(c.ledger_received)}</span>} />
          <Row k="Check" v={<Match ok={c.ledger_matches_deposits} label={c.ledger_matches_deposits ? "Ledger matches deposits" : "Mismatch"} />} />
          <Row k="Held (unmatched / review)" v={<span className="k-num font-mono">{usd(c.deposits_held)} · {c.deposits_held_count}</span>} />
          <Row k="Confirming" v={<span className="k-num font-mono">{usd(c.deposits_confirming)}</span>} />
          <Row k="Rejected (to refund)" v={<span className="k-num font-mono">{usd(c.deposits_rejected)}</span>} />
        </div>
        <div>
          <div className="k-label mb-1">Paid out</div>
          <Row k="Completed withdrawals (on chain)" v={<span className="k-num font-mono">{usd(c.withdrawals_paid)} · {c.withdrawals_paid_count}</span>} />
          <Row k="Ledger: withdrawals booked" v={<span className="k-num font-mono">{usd(c.ledger_paid_out)}</span>} />
          <Row k="Check" v={<Match ok={c.ledger_matches_withdrawals} label={c.ledger_matches_withdrawals ? "Ledger matches payouts" : "Mismatch"} />} />
          <Row k="Paid, verifying" v={<span className="k-num font-mono">{usd(c.withdrawals_in_flight)}</span>} />
          <Row k="Fees earned" v={<span className="k-num font-mono">{usd(c.fees)}</span>} />
        </div>
        <div className="lg:col-span-2">
          <div className="k-label mb-1">Company addresses</div>
          {c.addresses.map((a) => (
            <Row
              key={`${a.address}-${a.role}`}
              k={
                <span>
                  {a.role}
                  {a.active ? "" : " (old)"} · <Addr a={a.address} />
                </span>
              }
              v={<span className="k-num font-mono">{a.usdt === null ? "unavailable" : `${usd(a.usdt)} USDT`}</span>}
            />
          ))}
          <Row k="Expected on the addresses (received − paid out)" v={<span className="k-num font-mono">{usd(c.expected_onchain)}</span>} />
          <Row k="On-chain balance" v={<span className="k-num font-mono">{c.onchain_balance === null ? "unavailable" : usd(c.onchain_balance)}</span>} />
          <Row
            k="Difference"
            v={
              diff === null ? (
                "—"
              ) : (
                <span className={cn("k-num font-mono", diff === 0 ? "text-up" : "text-warn")} title="Non-zero when funds moved to or from the company addresses outside the wallet (sweeps, gas, manual transfers)">
                  {diff > 0 ? "+" : ""}
                  {usd(c.onchain_difference)}
                </span>
              )
            }
          />
        </div>
      </div>
    </Card>
  );
}

export function LiveReconciliationPage() {
  const { data, error, reload, loading } = useApi<Recon>("/api/wallet/reconciliation");
  return (
    <div className="pb-10">
      <PageHeader
        title="Reconciliation"
        subtitle="The wallet ledger against on-chain deposits and payouts, per network, with the ledger invariants."
        actions={
          <Button variant="surface" size="lg" disabled={loading} onClick={reload}>
            <RefreshCw /> Run again
          </Button>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <TableSkeleton />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <KpiCard label="Client money" icon={<Wallet />} value={<span className="k-num">${usd2(data.liabilities.total)}</span>} chip={`${usd2(data.liabilities.locked)} locked`} />
            <KpiCard label="Net into trading" icon={<Scale />} value={<span className="k-num">${usd2(data.trading_net_in)}</span>} chip="Wallet → accounts, net" delay={0.04} />
            <KpiCard label="Fees earned" icon={<Scale />} value={<span className="k-num">${usd2(data.fees_earned)}</span>} chip="Withdrawal fees" delay={0.08} />
            <KpiCard
              label="Ledger invariants"
              icon={data.invariants.ok ? <CheckCircle2 /> : <TriangleAlert />}
              value={<span className={cn("k-num", data.invariants.ok ? "text-up" : "text-down")}>{data.invariants.ok ? "OK" : data.invariants.problems.length}</span>}
              chip={data.invariants.ok ? "Balanced, balances = postings" : "Problems found"}
              chipTone={data.invariants.ok ? "up" : "down"}
              delay={0.12}
            />
          </div>
          {!data.invariants.ok && (
            <Card className="border-down/30 p-5">
              <div className="mb-2 text-[13.5px] font-medium text-down">Ledger problems</div>
              <ul className="list-disc space-y-1 pl-5 text-[12.5px]">
                {data.invariants.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Card>
          )}
          {data.chains.map((c) => (
            <ChainCard key={c.chain} c={c} />
          ))}
          <Card>
            <CardHeader title="System accounts" subtitle={`Double-entry counter-accounts · generated ${when(data.generated_at, true)}`} />
            <div className="px-6 pb-5 pt-2">
              {data.system_accounts.map((s) => (
                <Row key={s.account} k={<span className="font-mono text-[12px]">{s.account}</span>} v={<span className="k-num font-mono">{usd(s.balance)}</span>} />
              ))}
              <Row k="Client wallets (available + locked)" v={<span className="k-num font-mono">{usd(data.liabilities.total)}</span>} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
