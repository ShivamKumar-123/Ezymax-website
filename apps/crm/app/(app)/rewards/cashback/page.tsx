"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownToLine, CalendarClock, Coins, Percent, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  CapsuleBars,
  Card,
  CardHeader,
  Chip,
  CoinIcon,
  DataTable,
  Dialog,
  DialogClose,
  Donut,
  Field,
  Input,
  KeyValue,
  KpiCard,
  Money,
  PageHeader,
  Reveal,
  StatusChip,
  SymbolCell,
  cn,
  formatDateTime,
  formatMoney,
  type Column,
} from "@/components/kit";
import { CASHBACK, CASHBACK_BY_ACCOUNT, CASHBACK_HISTORY, CASHBACK_RATES, CASHBACK_WEEKLY, type CashbackTx } from "@ezymex/mock/rewards";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveCashbackPage } from "@/components/growth/cashback";

function WithdrawDialog({ available, onDone, trigger }: { available: number; onDone: (amt: number) => void; trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [amt, setAmt] = React.useState(available.toFixed(2));
  React.useEffect(() => setAmt(available.toFixed(2)), [available]);
  const v = parseFloat(amt) || 0;
  const bad = v <= 0 || v > available;
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title="Withdraw cashback to wallet"
      description="Instant internal transfer · no fees"
      width={460}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant="ember"
            disabled={bad}
            onClick={() => {
              onDone(v);
              setOpen(false);
              toast.success(`${formatMoney(v)} moved to your wallet`, { description: "USDT · TRC20 wallet balance updated" });
            }}
          >
            Withdraw {formatMoney(v)}
          </Button>
        </>
      }
    >
      <Field label="Amount" hint={<button className="text-ember" onClick={() => setAmt(available.toFixed(2))}>Max {formatMoney(available)}</button>}>
        <Input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} leading={<span className="text-[13px]">$</span>} trailing={<span className="text-[12px]">USDT</span>} inputMode="decimal" />
      </Field>
      <div className="mt-3 flex gap-1.5">
        {[25, 50, 100].map((p) => (
          <button key={p} onClick={() => setAmt(((available * p) / 100).toFixed(2))} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-[12px] text-fg-2 hover:bg-surface-3 hover:text-fg">
            {p}%
          </button>
        ))}
      </div>
      <div className="k-row mt-4 flex items-center gap-3 px-4 py-3">
        <CoinIcon coin="usdt" size={30} />
        <div className="flex-1">
          <div className="text-[13px] font-medium">Ezymex Wallet · USDT</div>
          <div className="font-mono text-[11.5px] text-fg-3">TRC20 · TQ7x…9KfE</div>
        </div>
        <Chip size="sm" tone="up">
          Instant
        </Chip>
      </div>
      <KeyValue className="mt-2" rows={[["Fee", "$0.00"], ["You receive", <span key="r" className="text-up">{formatMoney(v)}</span>]]} />
    </Dialog>
  );
}

function DemoCashbackPage() {
  const [available, setAvailable] = React.useState(CASHBACK.available);
  const [week, setWeek] = React.useState<number | undefined>(undefined);
  const totalLots = CASHBACK_BY_ACCOUNT.reduce((s, a) => s + a.lots, 0);
  const columns: Column<CashbackTx>[] = [
    { key: "date", header: "Date", cell: (r) => <span className="k-num text-fg-2">{formatDateTime(r.date)}</span>, sort: (r) => r.date, width: "150px" },
    { key: "id", header: "Ref", cell: (r) => <span className="font-mono text-[12.5px] text-fg-3">{r.id}</span>, hideOn: "lg" },
    { key: "sym", header: "Symbol", cell: (r) => <SymbolCell symbol={r.symbol} size={22} sub={<span className="font-mono">#{r.login}</span>} /> },
    { key: "lots", header: "Lots", align: "right", cell: (r) => <span className="k-num">{r.lots.toFixed(2)}</span>, sort: (r) => r.lots },
    { key: "rate", header: "Rate", align: "right", cell: (r) => <span className="k-num text-fg-2">${r.rate.toFixed(2)}/lot</span>, hideOn: "md" },
    { key: "amt", header: "Cashback", align: "right", cell: (r) => <span className="k-num font-semibold text-up">+{formatMoney(r.amount)}</span>, sort: (r) => r.amount },
    { key: "st", header: "Status", align: "right", cell: (r) => <StatusChip status={r.status} /> },
  ];
  const sel = week ?? CASHBACK_WEEKLY.length - 1;
  return (
    <div className="pb-16">
      <PageHeader
        title="Cashback"
        subtitle="Get paid back on every lot you trade — credited daily, withdraw any time."
        actions={
          <WithdrawDialog
            available={available}
            onDone={(v) => setAvailable((a) => +(a - v).toFixed(2))}
            trigger={
              <Button variant="ember" size="lg" shimmer disabled={available <= 0}>
                <ArrowDownToLine /> Withdraw to wallet
              </Button>
            }
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Available to withdraw" value={<Money value={available} />} hot illustration="money_with_wings" chip="USDT · instant" chipTone="ember" />
        <KpiCard label="Earned this month" icon={<TrendingUp />} value={<Money value={CASHBACK.thisMonth} />} chip={`+${(((CASHBACK.thisMonth - CASHBACK.lastMonth) / CASHBACK.lastMonth) * 100).toFixed(1)}% vs Aug`} chipTone="up" delay={0.05} />
        <KpiCard label="Pending" icon={<CalendarClock />} value={<Money value={CASHBACK.pending} />} chip="Credits 01 Oct, 00:00 GMT+3" chipTone="warn" delay={0.1} />
        <KpiCard label="Lifetime cashback" icon={<Coins />} value={<Money value={CASHBACK.lifetime} />} chip="Since Feb 2024" delay={0.15} href="/wallet" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader
              title="Weekly cashback"
              subtitle="Last 9 weeks · hover a bar for the amount"
              action={
                <Chip tone="ember" dot>
                  {CASHBACK_WEEKLY[sel]!.label} · {formatMoney(CASHBACK_WEEKLY[sel]!.value)}
                </Chip>
              }
            />
            <div className="px-4 pb-6 pt-8 sm:px-6" onMouseLeave={() => setWeek(undefined)}>
              <CapsuleBars data={CASHBACK_WEEKLY} active={week} height={240} format={(v) => formatMoney(v)} />
            </div>
            <div className="grid grid-cols-3 border-t border-line">
              {[
                ["Avg / week", formatMoney(CASHBACK_WEEKLY.reduce((s, w) => s + w.value, 0) / CASHBACK_WEEKLY.length)],
                ["Best week · W38", "$47.90"],
                ["Lots this month", totalLots.toFixed(1)],
              ].map(([k, v], i) => (
                <div key={k} className={cn("px-4 py-4 sm:px-6", i > 0 && "border-l border-line")}>
                  <div className="text-[12px] text-fg-3">{k}</div>
                  <div className="k-num mt-1 text-[15px] font-medium">{v}</div>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <Card className="flex h-full flex-col">
            <CardHeader title="Rate per account type" subtitle="$ back per standard lot" icon={<Percent />} />
            <div className="mt-4 flex-1 space-y-2 px-4 pb-4 sm:px-6">
              {CASHBACK_RATES.map((r) => (
                <div key={r.type} className={cn("k-row flex items-center gap-3 px-4 py-3", r.type === "Pro" && "border-gold/30 bg-gold-soft")}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[14px] font-medium">
                      {r.type}
                      {r.type === "Pro" && (
                        <Chip size="sm" tone="gold">
                          Best rate
                        </Chip>
                      )}
                    </div>
                    <div className="text-[11.5px] text-fg-3">
                      {r.note} · {r.accounts ? `${r.accounts} account` : "no account"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="k-num text-[18px] font-semibold">${r.perLot.toFixed(2)}</div>
                    <div className="text-[10.5px] text-fg-3">per lot</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 pb-5 sm:px-6">
              <Link href="/accounts/new">
                <Button variant="surface" className="w-full" size="sm">
                  Open a Pro account for $3.50/lot
                </Button>
              </Link>
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title="Breakdown by account" subtitle="September 2026 · server time GMT+3" />
          <div className="grid grid-cols-1 items-center gap-6 px-4 pb-6 pt-4 sm:px-6 lg:grid-cols-[220px_1fr]">
            <div className="flex justify-center">
              <Donut
                data={CASHBACK_BY_ACCOUNT.map((a, i) => ({ label: a.login, value: a.earned, color: ["var(--k-ember)", "#e9b949", "#a1a1aa"][i] }))}
                size={190}
                thickness={20}
                center={
                  <div>
                    <div className="k-num text-[22px] font-semibold">{formatMoney(CASHBACK.thisMonth)}</div>
                    <div className="text-[11px] text-fg-3">this month</div>
                  </div>
                }
              />
            </div>
            <div className="space-y-2">
              {CASHBACK_BY_ACCOUNT.map((a, i) => (
                <div key={a.login} className="k-row grid grid-cols-2 items-center gap-3 px-4 py-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]">
                  <div className="flex items-center gap-3">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: ["var(--k-ember)", "#e9b949", "#a1a1aa"][i] }} />
                    <div>
                      <div className="font-mono text-[13px] font-medium">#{a.login}</div>
                      <div className="text-[11.5px] text-fg-3">{a.group}</div>
                    </div>
                  </div>
                  <div className="text-right sm:text-left">
                    <div className="text-[11.5px] text-fg-3">Lots</div>
                    <div className="k-num text-[13.5px]">{a.lots.toFixed(1)}</div>
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-[11.5px] text-fg-3">Rate</div>
                    <div className="k-num text-[13.5px]">${a.rate.toFixed(2)}</div>
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-[11.5px] text-fg-3">Share</div>
                    <div className="k-num text-[13.5px]">{((a.earned / CASHBACK.thisMonth) * 100).toFixed(1)}%</div>
                  </div>
                  <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:justify-end">
                    <span className="k-num text-[15px] font-semibold text-up">+{formatMoney(a.earned)}</span>
                    <Link href={`/accounts/${a.login}`}>
                      <Button size="xs" variant="ghost">
                        Trades
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title="Cashback history" subtitle="Credited per closed trade" />
          <div className="px-4 pb-6 pt-4 sm:px-6">
            <DataTable columns={columns} rows={CASHBACK_HISTORY} pageSize={10} rowKey={(r) => r.id} search={(r) => `${r.symbol} ${r.login} ${r.id}`} searchPlaceholder="Symbol, account, ref…" exportName="ezymex-cashback" dense />
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

export default function Page() {
  return IS_DEMO ? <DemoCashbackPage /> : <LiveCashbackPage />;
}
