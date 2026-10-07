"use client";

import * as React from "react";
import { motion } from "motion/react";
import { ArrowUpRight, Calculator, Clock, Info, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  DataTable,
  Icon3D,
  Input,
  MiniBars,
  PageHeader,
  Reveal,
  Segmented,
  Starfield,
  cn,
  formatDateTime,
  type Column,
} from "@/components/kit";
import { EARN_RULES, LOYALTY, LOYALTY_TIERS, POINTS_HISTORY, type PointsTx } from "@kalks/mock/rewards";
import { RedeemCatalogue, TierOrb, TierTrack } from "@/components/rewards/loyalty";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveLoyaltyPage } from "@/components/growth/loyalty";

function useCountUp(target: number, ms = 900) {
  const [v, setV] = React.useState(target);
  const prev = React.useRef(target);
  React.useEffect(() => {
    const from = prev.current === target ? target * 0.8 : prev.current;
    prev.current = target;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(from + (target - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function BalanceHero({ balance }: { balance: number }) {
  const shown = useCountUp(balance);
  const tier = LOYALTY_TIERS.find((t) => t.key === LOYALTY.tier)!;
  return (
    <Card hot className="relative h-full overflow-hidden">
      <Starfield density={60} />
      <div className="relative flex h-full flex-col p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <span className="k-label">Points balance</span>
          <Chip tone="gold">
            <TierOrb tier={tier.key} size={14} /> {tier.name} · 1.25×
          </Chip>
        </div>
        <div className="mt-5 flex items-baseline gap-2">
          <span className="k-num text-[48px] font-semibold leading-none tracking-[-0.03em] sm:text-[56px]">{Math.round(shown).toLocaleString()}</span>
          <span className="text-[16px] text-fg-2">pts</span>
        </div>
        <div className="mt-2 text-[14px] text-fg-2">
          ≈ <span className="k-num font-medium text-fg">${(balance * LOYALTY.pointValue).toFixed(2)}</span> redeemable value
        </div>
        <div className="mt-6 grid max-w-[340px] grid-cols-2 gap-2">
          <div className="rounded-[14px] border border-white/10 light:border-line bg-black/30 light:bg-white/70 px-3.5 py-3 backdrop-blur-sm">
            <div className="text-[11.5px] text-fg-3">This month</div>
            <div className="k-num mt-1 text-[16px] font-semibold text-up">+{LOYALTY.earnedThisMonth.toLocaleString()}</div>
            <MiniBars data={[210, 340, 180, 420, 390, 260, 346]} className="mt-2 h-6" />
          </div>
          <div className="rounded-[14px] border border-white/10 light:border-line bg-black/30 light:bg-white/70 px-3.5 py-3 backdrop-blur-sm">
            <div className="text-[11.5px] text-fg-3">Lifetime</div>
            <div className="k-num mt-1 text-[16px] font-semibold">{LOYALTY.lifetime.toLocaleString()}</div>
            <div className="k-num mt-2 text-[11px] text-fg-3">{LOYALTY.lotsThisMonth} lots this month</div>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
          <a href="#catalogue">
            <Button variant="ember" shimmer>
              Redeem points <ArrowUpRight />
            </Button>
          </a>
          <div className="flex items-center gap-1.5 rounded-full border border-warn/25 bg-warn-soft px-3 py-1.5 text-[11.5px] text-warn">
            <Clock className="size-3.5" /> {LOYALTY.expiringSoon.points} pts expire 31 Oct
          </div>
        </div>
      </div>
    </Card>
  );
}

function EarnRules() {
  const [cls, setCls] = React.useState<string>("metals");
  const [lots, setLots] = React.useState("10");
  const rule = EARN_RULES.find((r) => r.assetClass === cls)!;
  const pts = Math.round((parseFloat(lots) || 0) * rule.pointsPerLot * 1.25);
  const max = Math.max(...EARN_RULES.map((r) => r.pointsPerLot));
  return (
    <Card className="h-full">
      <CardHeader title="How you earn" subtitle="Points per standard lot, closed trades on live accounts" icon={<Sparkles />} />
      <div className="mt-4 grid grid-cols-2 gap-2 px-4 sm:px-6 xl:grid-cols-3">
        {EARN_RULES.map((r, i) => (
          <button
            key={r.assetClass}
            onClick={() => setCls(r.assetClass)}
            className={cn("k-row flex items-center gap-2.5 px-3 py-3 text-left sm:gap-3 sm:px-3.5 transition-colors hover:bg-surface-3/60", cls === r.assetClass && "border-ember/40 bg-ember-soft")}
          >
            <Icon3D name={r.icon} size={32} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-medium">{r.label}</span>
                <span className="k-num text-[14px] font-semibold text-gold">{r.pointsPerLot}</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
                <motion.div className="h-full rounded-full bg-gold" initial={{ width: 0 }} animate={{ width: `${(r.pointsPerLot / max) * 100}%` }} transition={{ delay: i * 0.05, duration: 0.7 }} />
              </div>
              <div className="mt-1 truncate text-[11px] text-fg-3">{r.example}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="mx-4 mb-6 mt-3 flex flex-col gap-3 rounded-[16px] border border-dashed border-line px-4 py-3.5 sm:mx-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-[13px] text-fg-2">
          <Calculator className="size-4 text-fg-3" /> Estimate
        </div>
        <Input value={lots} onChange={(e) => setLots(e.target.value.replace(/[^0-9.]/g, ""))} className="h-9 sm:w-32" trailing={<span className="text-[12px]">lots</span>} inputMode="decimal" />
        <span className="text-[13px] text-fg-3">of {rule.label.toLowerCase()} at Gold 1.25× =</span>
        <span className="k-num text-[18px] font-semibold text-gold">{pts.toLocaleString()} pts</span>
        <span className="k-num text-[12px] text-fg-3 sm:ml-auto">≈ ${(pts * LOYALTY.pointValue).toFixed(2)}</span>
      </div>
    </Card>
  );
}

const TYPE_TONE = { earned: "up", redeemed: "ember", bonus: "gold", expired: "neutral" } as const;

function DemoLoyaltyPage() {
  const [balance, setBalance] = React.useState(LOYALTY.balance);
  const [extra, setExtra] = React.useState<PointsTx[]>([]);
  const [filter, setFilter] = React.useState<"all" | "earned" | "redeemed" | "bonus">("all");
  const rows = React.useMemo(() => [...extra, ...POINTS_HISTORY].filter((r) => filter === "all" || r.type === filter), [extra, filter]);
  const columns: Column<PointsTx>[] = [
    { key: "date", header: "Date", cell: (r) => <span className="k-num text-fg-2">{formatDateTime(r.date)}</span>, sort: (r) => r.date, width: "160px" },
    { key: "desc", header: "Activity", cell: (r) => <span className="font-medium">{r.description}</span> },
    { key: "type", header: "Type", cell: (r) => <Chip size="sm" tone={TYPE_TONE[r.type]}>{r.type[0]!.toUpperCase() + r.type.slice(1)}</Chip> },
    { key: "acc", header: "Account", cell: (r) => (r.account ? <span className="font-mono text-[12.5px] text-fg-2">#{r.account}</span> : <span className="text-fg-3">—</span>), hideOn: "md" },
    {
      key: "pts",
      header: "Points",
      align: "right",
      sort: (r) => r.points,
      cell: (r) => <span className={cn("k-num font-semibold", r.points > 0 ? "text-up" : r.type === "expired" ? "text-fg-3" : "text-fg")}>{r.points > 0 ? "+" : ""}{r.points.toLocaleString()}</span>,
    },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Loyalty"
        subtitle="Earn points on every lot you trade and swap them for cashback, better spreads and funded challenges."
        actions={
          <Button variant="surface" onClick={() => toast("Programme terms", { description: "Points are credited on closed trades within 1 hour and expire after 12 months of inactivity." })}>
            <Info /> How it works
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-5">
          <BalanceHero balance={balance} />
        </Reveal>
        <Reveal delay={0.08} className="xl:col-span-7">
          <TierTrack />
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <EarnRules />
      </Reveal>

      <Reveal delay={0.1} className="mt-4">
        <Card id="catalogue" className="scroll-mt-24">
          <CardHeader
            title="Rewards catalogue"
            subtitle={
              <span>
                You have <span className="k-num font-medium text-gold">{balance.toLocaleString()} pts</span> to spend
              </span>
            }
            action={<Chip tone="ember" dot className="hidden sm:inline-flex">New · Free prop challenge</Chip>}
          />
          <div className="mt-5">
            <RedeemCatalogue
              balance={balance}
              onRedeem={(cost, title) => {
                setBalance((b) => b - cost);
                setExtra((x) => [{ id: `n${Date.now()}`, date: new Date().toISOString(), type: "redeemed", description: `Redeemed · ${title}`, points: -cost }, ...x]);
              }}
            />
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title="Points history" subtitle="Last 90 days" />
          <div className="px-4 pb-6 pt-4 sm:px-6">
            <DataTable
              columns={columns}
              rows={rows}
              pageSize={8}
              rowKey={(r) => r.id}
              search={(r) => `${r.description} ${r.account ?? ""}`}
              searchPlaceholder="Search activity…"
              exportName="kalks-points-history"
              toolbar={<Segmented size="xs" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "earned", label: "Earned" }, { value: "redeemed", label: "Redeemed" }, { value: "bonus", label: "Bonus" }]} />}
            />
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

export default function Page() {
  return IS_DEMO ? <DemoLoyaltyPage /> : <LiveLoyaltyPage />;
}
