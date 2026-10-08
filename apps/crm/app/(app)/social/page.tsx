"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Crown, LineChart, ShieldCheck, Sparkles, Trophy, Users, Wallet } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  DataTable,
  IconButton,
  Menu,
  PageHeader,
  Reveal,
  Segmented,
  Sparkline,
  cn,
  formatCompact,
  type Column,
} from "@/components/kit";
import { MASTERS, PAMM_FUNDS, masterSpark, type Master } from "@ezymex/mock/social";
import { MasterCard, MasterIdentity, RiskBadge, formatAge } from "@/components/social/master-bits";
import { CopyDialog } from "@/components/social/copy-dialog";
import { InvestDialog } from "@/components/social/invest-dialog";
import { IS_DEMO as DEMO_BUILD } from "@ezymex/mock/mode";
import { LiveDiscoverPage } from "@/components/social-live/leaderboard";

type Period = "1M" | "3M" | "1Y" | "All";
type SortKey = "return" | "dd" | "aum" | "age";
type TypeF = "all" | "copy" | "pamm";
type RiskF = "all" | "low" | "med" | "high";

const retOf = (m: Master, p: Period) => (p === "1M" ? m.return1m : p === "3M" ? m.return3m : p === "1Y" ? m.return1y : m.returnAll);
const TRACK = [
  { v: 0, label: "Any track record" },
  { v: 90, label: "90 days+" },
  { v: 180, label: "180 days+" },
  { v: 365, label: "1 year+" },
  { v: 730, label: "2 years+" },
];

function useDialogs() {
  const [copyM, setCopyM] = React.useState<Master | null>(null);
  const [investM, setInvestM] = React.useState<Master | null>(null);
  const fund = investM ? PAMM_FUNDS.find((f) => f.masterId === investM.id) ?? null : null;
  const el = (
    <>
      <CopyDialog master={copyM} open={!!copyM} onOpenChange={(o) => !o && setCopyM(null)} />
      <InvestDialog fund={fund} open={!!fund} onOpenChange={(o) => !o && setInvestM(null)} />
    </>
  );
  return { setCopyM, setInvestM, el };
}

function Featured({ onCopy, onInvest }: { onCopy: (m: Master) => void; onInvest: (m: Master) => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const list = MASTERS.filter((m) => m.featured);
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * 340, behavior: "smooth" });
  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[18px] font-medium tracking-tight">
            <Sparkles className="size-4 text-gold" /> Featured masters
          </h2>
          <p className="text-[13px] text-fg-3">Hand-picked by the Ezymex risk desk for consistency and transparency</p>
        </div>
        <div className="flex gap-2">
          <IconButton aria-label="Previous" onClick={() => scroll(-1)}>
            <ChevronLeft />
          </IconButton>
          <IconButton aria-label="Next" onClick={() => scroll(1)}>
            <ChevronRight />
          </IconButton>
        </div>
      </div>
      <div ref={ref} className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {list.map((m) => (
          <div key={m.id} className="w-[min(320px,calc(100vw-48px))] shrink-0 snap-start">
            <MasterCard m={m} onCopy={() => onCopy(m)} onInvest={() => onInvest(m)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Hero() {
  const aum = MASTERS.reduce((s, m) => s + m.aum, 0);
  const followers = MASTERS.reduce((s, m) => s + m.followers, 0);
  return (
    <Card className="relative overflow-hidden">
      <img src="/assets/photos/trader.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-35" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/30" />
      <div className="absolute -right-20 -top-24 size-72 rounded-full bg-ember/20 blur-3xl" />
      <div className="relative grid grid-cols-1 gap-6 p-6 sm:p-7 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <Chip tone="ember" className="mb-3">
            <ShieldCheck className="size-3.5" /> Every master is KYC-verified and admin-approved
          </Chip>
          <h2 className="text-[24px] font-medium leading-tight tracking-tight sm:text-[28px]">Copy proven traders, or invest in their PAMM funds.</h2>
          <p className="mt-2 max-w-xl text-[14px] text-fg-2">
            Transparent track records, a system risk score from 1 to 10, and fees charged only above the high-water mark.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2">
          {[
            { icon: <Crown />, k: "Masters", v: MASTERS.length.toString() },
            { icon: <Wallet />, k: "Assets under mgmt.", v: `$${formatCompact(aum)}` },
            { icon: <Users />, k: "Followers & investors", v: followers.toLocaleString() },
            { icon: <LineChart />, k: "Median 1Y return", v: `+${[...MASTERS].sort((a, b) => a.return1y - b.return1y)[7]!.return1y.toFixed(1)}%` },
          ].map((x) => (
            <div key={x.k} className="rounded-[16px] border border-white/10 light:border-line bg-black/35 light:bg-white/70 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-1.5 text-[11.5px] text-fg-3 [&_svg]:size-3.5">
                {x.icon}
                {x.k}
              </div>
              <div className="k-num mt-1 text-[20px] font-semibold">{x.v}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function DemoDiscoverPage() {
  const router = useRouter();
  const { setCopyM, setInvestM, el } = useDialogs();
  const [period, setPeriod] = React.useState<Period>("1Y");
  const [sort, setSort] = React.useState<SortKey>("return");
  const [type, setType] = React.useState<TypeF>("all");
  const [risk, setRisk] = React.useState<RiskF>("all");
  const [track, setTrack] = React.useState(0);

  const rows = React.useMemo(() => {
    const f = MASTERS.filter(
      (m) =>
        (type === "all" || m.program === type || m.program === "both") &&
        (risk === "all" || (risk === "low" ? m.risk <= 3 : risk === "med" ? m.risk >= 4 && m.risk <= 6 : m.risk >= 7)) &&
        m.ageDays >= track,
    );
    const key = (m: Master) => (sort === "return" ? -retOf(m, period) : sort === "dd" ? m.maxDD : sort === "aum" ? -m.aum : -m.ageDays);
    return [...f].sort((a, b) => key(a) - key(b));
  }, [period, sort, type, risk, track]);

  const columns: Column<Master>[] = [
    { key: "rank", header: "#", cell: (_, i) => <span className={cn("font-mono text-[12px]", i < 3 ? "text-gold" : "text-fg-3")}>{i < 3 ? <Trophy className="inline size-3.5" /> : null} {i + 1}</span>, width: "56px" },
    { key: "m", header: "Master", cell: (m) => <MasterIdentity m={m} size={36} sub={<span className="flex items-center gap-1.5">{m.strategy}{m.program === "both" && <Chip size="sm" tone="gold">PAMM</Chip>}{m.program === "pamm" && <Chip size="sm" tone="gold">PAMM only</Chip>}</span>} />, width: "260px" },
    {
      key: "ret",
      header: <span className="whitespace-nowrap">Return {period}</span>,
      align: "right",
      cell: (m) => {
        const r = retOf(m, period);
        return <span className={cn("k-num text-[14px] font-semibold", r >= 0 ? "text-up" : "text-down")}>{r >= 0 ? "+" : ""}{r.toFixed(1)}%</span>;
      },
      sort: (m) => retOf(m, period),
    },
    { key: "spark", header: "6M", align: "right", cell: (m) => <Sparkline data={masterSpark(m, 36)} width={72} height={26} className="ml-auto" />, hideOn: "lg" },
    { key: "dd", header: <span className="whitespace-nowrap">Max DD</span>, align: "right", cell: (m) => <span className="k-num text-down">-{m.maxDD.toFixed(1)}%</span>, sort: (m) => -m.maxDD },
    { key: "aum", header: "AUM", align: "right", cell: (m) => <span className="k-num">${formatCompact(m.aum)}</span>, sort: (m) => m.aum },
    { key: "fol", header: "Followers", align: "right", cell: (m) => <span className="k-num text-fg-2">{m.followers.toLocaleString()}</span>, sort: (m) => m.followers, hideOn: "md" },
    { key: "age", header: "Age", align: "right", cell: (m) => <span className="k-num whitespace-nowrap text-fg-2">{formatAge(m.ageDays)}</span>, sort: (m) => m.ageDays, hideOn: "sm" },
    { key: "risk", header: "Risk", align: "center", cell: (m) => <RiskBadge risk={m.risk} />, sort: (m) => m.risk },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (m) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {m.program !== "copy" && (
            <Button size="xs" variant="surface" onClick={() => setInvestM(m)}>
              Invest
            </Button>
          )}
          {m.program !== "pamm" && (
            <Button size="xs" variant="ember" onClick={() => setCopyM(m)}>
              Copy
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="pb-24">
      <PageHeader
        title="Discover masters"
        subtitle="Leaderboard of verified strategy providers for copy trading and PAMM."
        actions={
          <>
            <Link href="/social/investments">
              <Button variant="surface" size="lg">
                <LineChart /> My investments
              </Button>
            </Link>
            <Link href="/social/master">
              <Button variant="ember" size="lg" shimmer>
                <Crown /> Become a master
              </Button>
            </Link>
          </>
        }
      />

      <Reveal>
        <Hero />
      </Reveal>

      <Reveal delay={0.06} className="mt-6 block">
        <Featured onCopy={setCopyM} onInvest={setInvestM} />
      </Reveal>

      <Reveal delay={0.1} className="mt-4 block">
        <Card>
          <CardHeader
            title="Leaderboard"
            subtitle={`${rows.length} masters · returns are net of the master's own costs, before your performance fee`}
            icon={<Trophy />}
            action={<Segmented size="xs" value={period} onChange={setPeriod} options={["1M", "3M", "1Y", "All"] as const} />}
          />
          <div className="px-4 pb-5 pt-4 sm:px-6">
            <DataTable
              columns={columns}
              rows={rows}
              pageSize={10}
              rowKey={(m) => m.id}
              onRowClick={(m) => router.push(`/social/masters/${m.id}`)}
              search={(m) => `${m.person.name} ${m.strategy} ${m.tags.join(" ")}`}
              searchPlaceholder="Name, strategy, market…"
              toolbar={
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented
                    size="xs"
                    value={sort}
                    onChange={setSort}
                    options={[
                      { value: "return", label: "Top return" },
                      { value: "dd", label: "Lowest DD" },
                      { value: "aum", label: "AUM" },
                      { value: "age", label: "Oldest" },
                    ]}
                  />
                  <Segmented
                    size="xs"
                    value={type}
                    onChange={setType}
                    options={[
                      { value: "all", label: "All" },
                      { value: "copy", label: "Copy" },
                      { value: "pamm", label: "PAMM" },
                    ]}
                  />
                  <Segmented
                    size="xs"
                    value={risk}
                    onChange={setRisk}
                    options={[
                      { value: "all", label: "Any risk" },
                      { value: "low", label: "1–3" },
                      { value: "med", label: "4–6" },
                      { value: "high", label: "7–10" },
                    ]}
                  />
                  <Menu
                    align="start"
                    width={200}
                    trigger={
                      <Button size="sm" variant="surface">
                        {TRACK.find((t) => t.v === track)!.label} <ChevronDown className="opacity-60" />
                      </Button>
                    }
                    items={TRACK.map((t) => ({ label: t.label, onSelect: () => setTrack(t.v), hint: t.v === track ? "Selected" : undefined }))}
                  />
                </div>
              }
            />
          </div>
        </Card>
      </Reveal>
      {el}
    </div>
  );
}

export default function DiscoverPage() {
  return DEMO_BUILD ? <DemoDiscoverPage /> : <LiveDiscoverPage />;
}
