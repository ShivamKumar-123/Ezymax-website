"use client";

import * as React from "react";
import Link from "next/link";
import { Ban, Download, Eye, EyeOff, MoreHorizontal, OctagonAlert, PlayCircle, Settings2, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, DataTable, Delta, IconButton, KpiCard, ListRow, Menu, Money, PageHeader, Reveal, Segmented, Sparkline, StatusChip, type Column } from "@kalks/ui";
import { MASTERS, SOCIAL_KPIS, SOCIAL_SETTINGS, type Master } from "@kalks/mock/admin-partners";
import { ColumnChart, PersonCell, RiskScore, auditToast, useReason } from "@/components/config/kit";
import { EmergencyStopDialog, STATUS_LABEL, TypeChip, type StopTarget } from "@/components/social/common";
import { MasterDrawer } from "@/components/social/master-drawer";
import { fmtInt, fmtUsdK } from "@/components/partners/common";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveMastersPage } from "@/components/social-live/masters";

const FEE_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"].map((label, i) => {
  const total = 212_000 + i * 21_500 + (i % 2 ? 9_000 : -4_000);
  return { label, values: [total * 0.8 * 0.72, total * 0.8 * 0.28, total * 0.2] };
});

function DemoMastersPage() {
  const [rows, setRows] = React.useState(MASTERS);
  const [sel, setSel] = React.useState<string | null>(null);
  const [stop, setStop] = React.useState<StopTarget | null>(null);
  const [type, setType] = React.useState<"all" | Master["type"]>("all");
  const [status, setStatus] = React.useState<"all" | Master["status"] | "hidden">("all");
  const reason = useReason();
  const view = rows.filter((m) => (type === "all" || m.type === type) && (status === "all" || (status === "hidden" ? m.hidden : m.status === status)));
  const master = rows.find((m) => m.id === sel) ?? null;
  const update = (m: Master) => setRows((rs) => rs.map((r) => (r.id === m.id ? m : r)));
  const askStop = (m: Master) => setStop({ kind: "master", id: m.id, name: m.strategy, followers: m.followers, aum: m.aum, openPositions: m.openPositions * Math.max(1, Math.round(Math.sqrt(m.followers))) });

  const suspend = (m: Master) =>
    reason.ask({
      title: m.status === "suspended" ? `Reinstate ${m.strategy}` : `Suspend ${m.strategy}`,
      reasons: m.status === "suspended" ? ["Investigation closed", "Master remediated"] : ["Excessive drawdown", "Terms of service breach", "Suspected manipulation", "KYC expired"],
      confirmLabel: m.status === "suspended" ? "Reinstate" : "Suspend",
      tone: m.status === "suspended" ? "buy" : "sell",
      onConfirm: (r) => {
        update({ ...m, status: m.status === "suspended" ? "active" : "suspended" });
        auditToast(`${m.strategy} ${m.status === "suspended" ? "reinstated" : "suspended"}`, r);
      },
    });
  const hide = (m: Master) =>
    reason.ask({
      title: `${m.hidden ? "Show" : "Hide"} ${m.strategy} ${m.hidden ? "on" : "from"} leaderboard`,
      reasons: m.hidden ? ["Review completed", "Eligibility restored"] : ["Misleading marketing", "Risk profile too high for retail", "Under investigation"],
      confirmLabel: m.hidden ? "Show" : "Hide",
      onConfirm: (r) => {
        update({ ...m, hidden: !m.hidden });
        auditToast(`${m.strategy} ${m.hidden ? "shown on" : "hidden from"} leaderboard`, r);
      },
    });

  const cols: Column<Master>[] = [
    { key: "m", header: "Master", sort: (m) => m.strategy, cell: (m) => <PersonCell name={m.strategy} photo={m.photo} sub={<>{m.name} · <span className="font-mono">{m.id}</span></>} /> },
    { key: "t", header: "Type", cell: (m) => <TypeChip type={m.type} /> },
    { key: "s", header: "Status", cell: (m) => <span className="flex items-center gap-1"><StatusChip status={m.status} label={STATUS_LABEL[m.status]} />{m.hidden && <EyeOff className="size-3.5 text-warn" />}</span> },
    { key: "a", header: "AUM", align: "right", sort: (m) => m.aum, cell: (m) => <span className="k-num font-medium">{fmtUsdK(m.aum)}</span> },
    { key: "f", header: "Followers", align: "right", sort: (m) => m.followers, cell: (m) => <span className="k-num">{fmtInt(m.followers)}</span> },
    { key: "r", header: "Return 12m", align: "right", sort: (m) => m.return12m, cell: (m) => <span className="inline-flex items-center gap-2"><Sparkline data={m.equity} width={56} height={20} fill={false} className="hidden xl:block" /><Delta value={m.return12m} decimals={1} /></span> },
    { key: "dd", header: "Max DD", align: "right", hideOn: "md", sort: (m) => m.maxDD, cell: (m) => <span className={`k-num ${m.maxDD > 30 ? "text-down" : m.maxDD > 20 ? "text-warn" : "text-fg-2"}`}>{m.maxDD}%</span> },
    { key: "rs", header: "Risk", sort: (m) => m.riskScore, hideOn: "lg", cell: (m) => <RiskScore score={m.riskScore} /> },
    { key: "fee", header: "Fee", align: "right", hideOn: "md", sort: (m) => m.perfFee, cell: (m) => <span className="k-num text-fg-2">{m.perfFee}%{m.mgmtFee ? <span className="text-fg-3"> + {m.mgmtFee}%</span> : null}</span> },
    {
      key: "x",
      header: "",
      align: "right",
      width: "52px",
      cell: (m) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Menu
            trigger={<IconButton size="sm" aria-label="Actions"><MoreHorizontal /></IconButton>}
            items={[
              { label: "Open details", icon: <Eye />, onSelect: () => setSel(m.id) },
              { label: m.hidden ? "Show on leaderboard" : "Hide from leaderboard", icon: m.hidden ? <Eye /> : <EyeOff />, onSelect: () => hide(m) },
              { label: m.status === "suspended" ? "Reinstate" : "Suspend", icon: m.status === "suspended" ? <PlayCircle /> : <Ban />, onSelect: () => suspend(m) },
              "sep",
              { label: "Emergency stop", icon: <OctagonAlert />, danger: true, onSelect: () => askStop(m) },
            ]}
          />
        </span>
      ),
    },
  ];

  const watch = [...rows].filter((m) => m.status !== "suspended").sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);

  return (
    <div className="pb-16">
      <PageHeader
        title="Masters"
        subtitle="Copy-trading and PAMM masters, signal providers and their followers"
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("masters.csv exported", { description: `${view.length} masters` })}>
              <Download /> Export
            </Button>
            <Link href="/social/settings">
              <Button variant="surface"><Settings2 /> Fee caps</Button>
            </Link>
            <Link href="/social/applications">
              <Button variant="ember">Review applications <Chip size="sm" tone="solid">8</Chip></Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Masters" icon={<Users />} value={<span className="k-num">{SOCIAL_KPIS.masters}</span>} chip={`${SOCIAL_KPIS.activeMasters} active · ${rows.filter((m) => m.hidden).length} hidden`} chipTone="neutral" />
        <KpiCard label="Followers & investors" icon={<Users />} value={<span className="k-num">{fmtInt(SOCIAL_KPIS.followers)}</span>} chip={`${fmtInt(SOCIAL_KPIS.copiedVolumeLots)} copied lots MTD`} chipTone="up" delay={0.05} />
        <KpiCard label="Assets under copy" icon={<Wallet />} value={<Money value={SOCIAL_KPIS.copiedAum + SOCIAL_KPIS.pammAum} decimals={0} />} footer={<div className="flex gap-1.5"><Chip size="sm">Copy {fmtUsdK(SOCIAL_KPIS.copiedAum)}</Chip><Chip size="sm" tone="gold">PAMM {fmtUsdK(SOCIAL_KPIS.pammAum)}</Chip></div>} href="/social/pamm" delay={0.1} />
        <KpiCard label="Fees · MTD" value={<Money value={SOCIAL_KPIS.feesMtd} />} hot illustration="money_bag" chip={`Platform cut ${fmtUsdK(SOCIAL_KPIS.platformCutMtd)} (${SOCIAL_SETTINGS.platformCut}%)`} chipTone="ember" delay={0.15} />
      </div>

      <Reveal delay={0.1}>
        <Card className="mt-4 p-4 sm:p-6">
          <DataTable
            columns={cols}
            rows={view}
            dense
            pageSize={10}
            rowKey={(m) => m.id}
            onRowClick={(m) => setSel(m.id)}
            search={(m) => `${m.strategy} ${m.name} ${m.id} ${m.login}`}
            searchPlaceholder="Master, strategy, login…"
            toolbar={
              <div className="flex flex-wrap gap-2">
                <Segmented size="xs" value={type} onChange={setType} options={[{ value: "all", label: "All" }, { value: "copy", label: "Copy" }, { value: "pamm", label: "PAMM" }, { value: "signal", label: "Signal" }]} />
                <Segmented size="xs" value={status} onChange={setStatus} options={[{ value: "all", label: "Any status" }, { value: "active", label: "Active" }, { value: "review", label: "Review" }, { value: "suspended", label: "Suspended" }, { value: "hidden", label: "Hidden" }]} />
              </div>
            }
          />
        </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-5">
          <Card className="flex h-full flex-col">
            <CardHeader title="Risk watch" subtitle="Highest risk scores among live masters" action={<Chip tone="down" dot>{rows.filter((m) => m.riskScore >= 70 && m.status !== "suspended").length} above 70</Chip>} />
            <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
              {watch.map((m) => (
                <ListRow key={m.id} onClick={() => setSel(m.id)} className="py-2.5">
                  <Avatar src={m.photo} name={m.name} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{m.strategy}</div>
                    <div className="k-num truncate text-[11.5px] text-fg-3">DD {m.maxDD}% · {fmtInt(m.followers)} followers · {fmtUsdK(m.aum)}</div>
                  </div>
                  <RiskScore score={m.riskScore} />
                  <Button size="xs" variant="down-outline" onClick={(e) => { e.stopPropagation(); askStop(m); }}>
                    <OctagonAlert /> Stop
                  </Button>
                </ListRow>
              ))}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-7">
          <Card className="h-full">
            <CardHeader title="Fee revenue split" subtitle="Performance & management fees charged to followers" />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <ColumnChart data={FEE_MONTHS} series={[{ label: "Master · performance", tone: "gold" }, { label: "Master · management", tone: "fg3" }, { label: "Platform cut", tone: "ember" }]} height={230} format={fmtUsdK} />
            </div>
          </Card>
        </Reveal>
      </div>

      <MasterDrawer m={master} open={!!master} onOpenChange={(o) => !o && setSel(null)} onChange={update} onStop={askStop} />
      <EmergencyStopDialog
        target={stop}
        open={!!stop}
        onOpenChange={(o) => !o && setStop(null)}
        onConfirm={(o) => {
          const m = rows.find((x) => x.id === stop?.id);
          if (m) update({ ...m, status: o.pauseSignal ? "paused" : m.status, openPositions: o.closeAll ? 0 : m.openPositions });
        }}
      />
      {reason.node}
    </div>
  );
}

export default function MastersPage() {
  return IS_DEMO ? <DemoMastersPage /> : <LiveMastersPage />;
}
