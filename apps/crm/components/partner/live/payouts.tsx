"use client";

import * as React from "react";
import Link from "next/link";
import {
  Banknote,
  CalendarClock,
  CircleDollarSign,
  Clock,
  Gavel,
  Hourglass,
  Layers,
  Wallet,
} from "lucide-react";
import {
  Button,
  CapsuleBars,
  Card,
  CardHeader,
  Chip,
  DataTable,
  KpiCard,
  Money,
  PageHeader,
  Reveal,
  cn,
  formatMoney,
  type Column,
} from "@kalks/ui";
import {
  fmtDateTime,
  fmtDay,
  scheduleLabel,
  usePartner,
  type Payout,
  type PayoutsResp,
} from "./api";
import { CardEmpty, PageFallback, PayoutStatusChip, SkeletonGrid } from "./ui";

const MON = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DAY_MS = 86400_000;

/** Period boundaries are UTC midnights; the end is exclusive. */
function utcDay(ms: number, withYear = false) {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ""}`;
}

function periodOf(schedule: string, endIso: string, startIso?: string | null) {
  const end = Date.parse(endIso);
  const start = startIso
    ? Date.parse(startIso)
    : end -
      (schedule === "daily" ? 1 : schedule === "monthly" ? 30 : 7) * DAY_MS;
  const last = end - DAY_MS;
  return last <= start
    ? utcDay(start, true)
    : `${utcDay(start)} – ${utcDay(last, true)}`;
}

const PERIOD_WORD: Record<string, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
};

function useCountdown(target: string) {
  const [left, setLeft] = React.useState<number | null>(null);
  React.useEffect(() => {
    const t = Date.parse(target);
    const tick = () => setLeft(Math.max(0, t - Date.now()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [target]);
  return left;
}

function Countdown({ target }: { target: string }) {
  const left = useCountdown(target);
  const parts =
    left === null
      ? ["--", "--", "--"]
      : [
          Math.floor(left / DAY_MS),
          Math.floor(left / 3600_000) % 24,
          Math.floor(left / 60_000) % 60,
        ].map((v) => String(v).padStart(2, "0"));
  return (
    <div className="flex items-center gap-1.5">
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center">
            <span className="k-num min-w-[46px] rounded-[12px] border border-line bg-surface-2/70 px-2 py-2 text-center font-mono text-[22px] font-semibold leading-none">
              {p}
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-wider text-fg-3">
              {["days", "hrs", "min"][i]}
            </span>
          </div>
          {i < 2 && <span className="-mt-4 font-mono text-fg-3">:</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function Hero({ d }: { d: PayoutsResp }) {
  const current = periodOf(d.schedule, d.nextClose);
  const below = d.unbatched > 0 && d.unbatched < d.minAmount;
  return (
    <Card hot className="h-full overflow-hidden">
      <div className="relative flex h-full flex-col gap-6 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="k-label text-ember">Accruing now · {current}</div>
            <Money
              value={d.unbatched}
              countUp={false}
              className="mt-2 block text-[40px] font-semibold leading-none tracking-tight"
            />
            <div className="mt-2 text-[13px] text-fg-2">
              Pending commission not yet in a payout batch
            </div>
          </div>
          <Chip tone="gold">{scheduleLabel(d.schedule)} payouts</Chip>
        </div>

        <div className="mt-auto flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[12.5px] text-fg-2">
              <CalendarClock className="size-4 text-ember" /> Batch closes{" "}
              {fmtDay(d.nextClose)}, {fmtDateTime(d.nextClose).split(", ")[1]}
            </div>
            <Countdown target={d.nextClose} />
          </div>
          <div className="max-w-sm text-[12px] leading-snug text-fg-3">
            {below
              ? `Below the ${formatMoney(d.minAmount, "USD", 0)} minimum for now. It rolls into the next batch until it reaches the minimum.`
              : `Minimum payout ${formatMoney(d.minAmount, "USD", 0)}. Smaller balances roll into the next batch.`}
          </div>
        </div>
      </div>
    </Card>
  );
}

function WalletNote() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Where payouts go"
        subtitle="Your Kalks wallet, in USDT"
        icon={<Wallet />}
      />
      <div className="flex flex-1 flex-col gap-4 px-4 pb-5 pt-4 sm:px-6">
        <ol className="space-y-3">
          {[
            {
              icon: <Layers />,
              t: "Commission accrues",
              s: "Every qualifying trade adds a pending line",
            },
            {
              icon: <Gavel />,
              t: "Batch closes and is reviewed",
              s: "The broker approves each batch",
            },
            {
              icon: <Banknote />,
              t: "Credited to your wallet",
              s: "Paid in USDT to your Kalks wallet",
            },
          ].map((x, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 [&_svg]:size-3.5">
                {x.icon}
              </span>
              <div>
                <div className="text-[13px] font-medium">{x.t}</div>
                <div className="text-[12px] text-fg-3">{x.s}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-auto">
          <Link href="/wallet">
            <Button variant="surface" size="sm" className="w-full">
              <Wallet /> Open wallet
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function HistoryChart({
  items,
  schedule,
}: {
  items: Payout[];
  schedule: string;
}) {
  const data = items
    .filter((p) => p.status !== "rejected")
    .slice(0, 12)
    .reverse()
    .map((p) => ({
      label: utcDay(Date.parse(p.periodEnd) - DAY_MS),
      value: p.amount,
      id: p.id,
    }));
  const avg = data.length
    ? data.reduce((s, b) => s + b.value, 0) / data.length
    : 0;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Recent payouts"
        subtitle={
          data.length
            ? `Average ${formatMoney(avg)} per ${PERIOD_WORD[schedule] ?? "batch"}`
            : "Last 12 batches"
        }
      />
      <div className="flex-1 px-4 pb-5 pt-8 sm:px-6">
        {data.length >= 2 ? (
          <CapsuleBars
            data={data.map((b) => ({
              label: `${b.label} #${b.id}`,
              value: b.value,
            }))}
            height={200}
            format={(v) => formatMoney(v, "USD", 0)}
            className="gap-1.5 sm:gap-3 [&>div>span]:whitespace-nowrap [&>div>span]:text-[10px]"
          />
        ) : (
          <CardEmpty
            className="h-[200px]"
            title={data.length ? "One payout so far" : "No payouts yet"}
            text="Your payout history builds up here, one bar per batch."
          />
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

const TITLE = "Payouts";

export function LivePartnerPayouts() {
  const { data, error, reload } = usePartner<PayoutsResp>("payouts", 60_000);
  const subtitle = data
    ? `Commission is paid ${data.schedule === "daily" ? "daily" : data.schedule === "monthly" ? "monthly" : "weekly"} in batches, after approval, into your wallet.`
    : "Commission is paid in batches, after approval, into your wallet.";

  if (!data)
    return (
      <PageFallback
        title={TITLE}
        subtitle={subtitle}
        error={error}
        onRetry={reload}
        skeleton={
          <SkeletonGrid
            rows={[
              { cols: "xl:grid-cols-[2fr_1fr]", h: "h-[300px]", n: 2 },
              { cols: "sm:grid-cols-2 xl:grid-cols-4", h: "h-[150px]", n: 4 },
            ]}
          />
        }
      />
    );

  const paid = data.items.filter((p) => p.status === "paid");
  const paidTotal = paid.reduce((s, p) => s + p.amount, 0);
  const inFlight = data.items
    .filter(
      (p) => p.status === "awaiting_approval" || p.status === "processing",
    )
    .reduce((s, p) => s + p.amount, 0);
  const lastPaid = paid[0];

  const columns: Column<Payout>[] = [
    {
      key: "batch",
      header: "Batch",
      cell: (p) => (
        <span className="block">
          <span className="font-mono text-[12.5px]">#{p.batchId}</span>
          <span className="block whitespace-nowrap text-[11.5px] text-fg-3">
            {periodOf(p.schedule, p.periodEnd, p.periodStart)}
          </span>
        </span>
      ),
      sort: (p) => p.periodEnd,
      csv: (p) => p.batchId,
    },
    {
      key: "lines",
      header: "Lines",
      align: "right",
      cell: (p) => <span className="k-num text-fg-2">{p.lines}</span>,
      sort: (p) => p.lines,
      hideOn: "md",
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (p) => (
        <Money value={p.amount} countUp={false} className="font-semibold" />
      ),
      sort: (p) => p.amount,
    },
    {
      key: "status",
      header: "Status",
      cell: (p) => <PayoutStatusChip status={p.status} />,
      csv: (p) => p.status,
    },
    {
      key: "paid",
      header: "Paid",
      cell: (p) => (
        <span className="k-num whitespace-nowrap text-fg-2">
          {p.paidAt ? fmtDateTime(p.paidAt) : "—"}
        </span>
      ),
      sort: (p) => p.paidAt ?? "",
      hideOn: "md",
    },
    {
      key: "dest",
      header: "Destination",
      align: "right",
      cell: (p) => (
        <span className="whitespace-nowrap text-fg-2">{p.destination}</span>
      ),
      hideOn: "sm",
      csv: (p) => p.destination,
    },
  ];

  return (
    <div className="pb-24">
      <PageHeader title={TITLE} subtitle={subtitle} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="min-w-0 xl:col-span-8">
          <Hero d={data} />
        </Reveal>
        <Reveal delay={0.05} className="min-w-0 xl:col-span-4">
          <WalletNote />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Paid all-time"
          icon={<CircleDollarSign />}
          value={<Money value={paidTotal} countUp={false} />}
          chip={
            lastPaid?.paidAt
              ? `Last ${fmtDay(lastPaid.paidAt)}`
              : "No payouts yet"
          }
          chipTone={lastPaid ? "up" : "neutral"}
        />
        <KpiCard
          label="Next batch closes"
          icon={<CalendarClock />}
          value={
            <span className="text-[26px] sm:text-[28px]">
              {fmtDay(data.nextClose)}
            </span>
          }
          chip={`${scheduleLabel(data.schedule)} schedule`}
          chipTone="ember"
          delay={0.04}
        />
        <KpiCard
          label="Not yet batched"
          icon={<Hourglass />}
          value={<Money value={data.unbatched} countUp={false} />}
          chip="Pending commission"
          chipTone="warn"
          delay={0.08}
        />
        <KpiCard
          label="In review"
          icon={<Clock />}
          value={<Money value={inFlight} countUp={false} />}
          chip={`Minimum payout ${formatMoney(data.minAmount, "USD", 0)}`}
          delay={0.12}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="min-w-0 xl:col-span-4">
          <ScheduleCard d={data} />
        </Reveal>
        <Reveal delay={0.1} className="min-w-0 xl:col-span-8">
          <HistoryChart items={data.items} schedule={data.schedule} />
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4 block">
        <Card>
          <CardHeader
            title="Payout history"
            subtitle="Every batch and where it was credited"
          />
          <div className="px-4 pb-5 pt-4 sm:px-6">
            <DataTable
              columns={columns}
              rows={data.items}
              rowKey={(p) => String(p.id)}
              pageSize={10}
              exportName={data.items.length ? "kalks-ib-payouts" : undefined}
              empty={
                <div className="py-6">
                  <CardEmpty
                    title="No payouts yet"
                    text={`Once a batch closes with at least ${formatMoney(data.minAmount, "USD", 0)} of approved commission, it shows here with its status.`}
                  />
                </div>
              }
            />
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

function ScheduleCard({ d }: { d: PayoutsResp }) {
  const word = PERIOD_WORD[d.schedule] ?? "period";
  const steps = [
    {
      icon: <Layers />,
      t: "Commission accrues",
      s: `Through the ${word}: ${periodOf(d.schedule, d.nextClose)}`,
      state: "current" as const,
    },
    {
      icon: <Clock />,
      t: "Batch closes",
      s: `${fmtDay(d.nextClose)}, ${fmtDateTime(d.nextClose).split(", ")[1]}`,
      state: "next" as const,
    },
    {
      icon: <Gavel />,
      t: "Broker approval",
      s: "Each batch is reviewed before payment",
      state: "next" as const,
    },
    {
      icon: <Wallet />,
      t: "Credited to wallet",
      s: "USDT, to your Kalks wallet",
      state: "next" as const,
    },
  ];
  return (
    <Card className="h-full">
      <CardHeader
        title="Payout schedule"
        subtitle={`${scheduleLabel(d.schedule)} · after approval`}
        icon={<CalendarClock />}
      />
      <ol className="relative px-6 pb-6 pt-5">
        {steps.map((st, i) => (
          <li key={st.t} className="relative flex gap-4 pb-5 last:pb-0">
            {i < steps.length - 1 && (
              <span className="absolute left-[17px] top-9 h-[calc(100%-28px)] w-px bg-line" />
            )}
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full border [&_svg]:size-4",
                st.state === "current"
                  ? "border-ember/50 bg-ember-soft text-ember"
                  : "border-line bg-surface-2 text-fg-3",
              )}
            >
              {st.icon}
            </span>
            <div className="min-w-0 pt-1">
              <div className="flex items-center gap-2 text-[13.5px] font-medium">
                {st.t}
                {st.state === "current" && (
                  <Chip size="sm" tone="ember">
                    Now
                  </Chip>
                )}
              </div>
              <div className="text-[12px] text-fg-3">{st.s}</div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
