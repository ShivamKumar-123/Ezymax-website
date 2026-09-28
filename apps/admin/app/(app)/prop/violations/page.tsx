"use client";

import * as React from "react";
import { AlertTriangle, Ban, Bot, ShieldAlert, Sliders } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, KpiCard, PageHeader, Reveal, Segmented, StatusChip, Tabs, type Column } from "@kalks/ui";
import { PersonCell, auditToast, useReason } from "@/components/config/kit";
import { BANNED_TYPES, VIOLATIONS, VIOLATION_LABEL, fmtAgo, type Violation, type ViolationType } from "@/components/prop/data";
import { SEVERITY_TONE, ViolationDrawer } from "@/components/prop/violation-drawer";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveViolationsPage } from "@/components/prop-live/violations";

export default function ViolationsPage() {
  return IS_DEMO ? <DemoViolationsPage /> : <LiveViolationsPage />;
}

const CONFIRM_REASONS = ["Rule breach verified", "Banned strategy evidence conclusive", "Repeat offender", "Linked-account abuse"];
const OVERTURN_REASONS = ["Platform / feed issue at time of breach", "Slippage caused by LP gap", "False positive — normal trading", "Goodwill exception"];

function DemoViolationsPage() {
  const [rows, setRows] = React.useState<Violation[]>(VIOLATIONS);
  const [tab, setTab] = React.useState<"open" | "confirmed" | "overturned">("open");
  const [kind, setKind] = React.useState<"all" | "rules" | "banned">("all");
  const [selId, setSelId] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const reason = useReason();

  const setStatus = (id: string, status: Violation["status"]) => {
    setRows((p) => p.map((v) => (v.id === id ? { ...v, status } : v)));
    setOpen(false);
  };
  const confirm = (v: Violation) =>
    reason.ask({
      title: `Confirm ${VIOLATION_LABEL[v.type].toLowerCase()} · ${v.login}`,
      description: v.accountKind === "Funded" ? "The funded account is closed and any pending payout is cancelled." : "The challenge is failed. The trader may buy a reset at the discounted price.",
      reasons: CONFIRM_REASONS,
      confirmLabel: "Confirm breach",
      tone: "sell",
      onConfirm: (r) => {
        setStatus(v.id, "confirmed");
        auditToast(`${v.id} confirmed`, r);
      },
    });
  const overturn = (v: Violation) =>
    reason.ask({
      title: `Overturn ${v.id}?`,
      description: "The account is reinstated with the pre-breach balance and the trader is notified.",
      reasons: OVERTURN_REASONS,
      confirmLabel: "Overturn & reinstate",
      tone: "buy",
      onConfirm: (r) => {
        setStatus(v.id, "overturned");
        auditToast(`${v.id} overturned · account ${v.login} reinstated`, r);
      },
    });
  const ban = (v: Violation) =>
    reason.ask({
      title: `Ban ${v.trader.name} from prop programmes?`,
      description: "All challenges and funded accounts are closed, linked accounts (IP / device / wallet) are flagged, and future purchases are blocked.",
      reasons: ["Banned strategy — HFT / latency arbitrage", "Copy / hedge across accounts", "Account sharing", "Chargeback fraud"],
      confirmLabel: "Ban trader",
      tone: "sell",
      onConfirm: (r) => {
        setStatus(v.id, "confirmed");
        auditToast(`${v.trader.name} banned from prop`, r);
      },
    });

  const inKind = (v: Violation) => kind === "all" || (kind === "banned" ? BANNED_TYPES.includes(v.type) : !BANNED_TYPES.includes(v.type));
  const view = rows.filter((v) => v.status === tab && inKind(v));
  const sel = rows.find((v) => v.id === selId) ?? null;
  const openRows = rows.filter((v) => v.status === "open");

  const byType = (Object.keys(VIOLATION_LABEL) as ViolationType[]).map((t) => ({ t, n: rows.filter((v) => v.type === t).length })).sort((a, b) => b.n - a.n);
  const maxN = Math.max(...byType.map((x) => x.n));

  const columns: Column<Violation>[] = [
    { key: "id", header: "ID", cell: (v) => <span className="whitespace-nowrap font-mono text-[12px] text-fg-2">{v.id}</span> },
    { key: "trader", header: "Trader", cell: (v) => <PersonCell name={v.trader.name} photo={v.trader.photo} sub={<span className="font-mono">{v.login} · {v.accountKind}</span>} size={28} />, sort: (v) => v.trader.name },
    {
      key: "type",
      header: "Violation",
      cell: (v) => (
        <div>
          <div className="flex items-center gap-1.5 text-[13px] font-medium">
            {BANNED_TYPES.includes(v.type) && <Bot className="size-3.5 text-down" />}
            {VIOLATION_LABEL[v.type]}
          </div>
          <div className="max-w-[250px] truncate text-[11.5px] text-fg-3">{v.detail}</div>
        </div>
      ),
    },
    { key: "sev", header: "Severity", cell: (v) => <span className="inline-flex flex-col items-start gap-0.5"><Chip size="sm" tone={SEVERITY_TONE[v.severity]} dot>{v.severity}</Chip><span className="k-num text-[10.5px] text-fg-3">{v.confidence}% conf.</span></span>, sort: (v) => ["low", "medium", "high", "critical"].indexOf(v.severity) },
    { key: "metric", header: "Measured", cell: (v) => <span className="k-num whitespace-nowrap text-[12.5px]">{v.metric}</span>, hideOn: "lg" },
    { key: "action", header: "Auto-action", cell: (v) => <span className="whitespace-nowrap text-[12.5px] text-fg-2">{v.autoAction}</span>, hideOn: "lg" },
    { key: "when", header: "Detected", align: "right", cell: (v) => <span className="whitespace-nowrap text-[12px] text-fg-3">{fmtAgo(v.detected)}</span>, sort: (v) => v.detected },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (v) =>
        v.status === "open" ? (
          <span className="inline-flex gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button size="xs" variant="ghost" onClick={() => overturn(v)}>
              Overturn
            </Button>
            <Button size="xs" variant="down-outline" onClick={() => confirm(v)}>
              Confirm
            </Button>
          </span>
        ) : (
          <StatusChip status={v.status === "confirmed" ? "rejected" : "approved"} label={v.status === "confirmed" ? "Confirmed" : "Overturned"} />
        ),
    },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Violations"
        subtitle="Rule breaches and banned-strategy detections across challenges and funded accounts. Every decision is audited."
        actions={
          <Button variant="surface" onClick={() => toast.message("Detection thresholds live in Plan builder → Rules", { description: "HFT < 30s · latency > 160 ms · copy Δ < 500 ms · consistency 40%" })}>
            <Sliders /> Detection settings
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open for review" icon={<ShieldAlert />} value={<span className="k-num">{openRows.length}</span>} chip={`${openRows.filter((v) => v.severity === "critical").length} critical`} chipTone="down" hot illustration="warning" />
        <KpiCard label="Rule breaches · 14d" icon={<AlertTriangle />} value={<span className="k-num">{rows.filter((v) => !BANNED_TYPES.includes(v.type)).length}</span>} chip="Daily loss & max DD lead" delay={0.05} />
        <KpiCard label="Banned strategies · 14d" icon={<Bot />} value={<span className="k-num">{rows.filter((v) => BANNED_TYPES.includes(v.type)).length}</span>} chip="HFT · latency · copy" chipTone="warn" delay={0.1} />
        <KpiCard label="Overturn rate" icon={<Ban />} value={<span className="k-num">{((rows.filter((v) => v.status === "overturned").length / Math.max(1, rows.filter((v) => v.status !== "open").length)) * 100).toFixed(1)}%</span>} chip="Target < 10%" chipTone="up" delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-12">
          <Card className="px-4 pb-5 pt-5 sm:px-6">
            <Tabs
              className="mb-4"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "open", label: "Open", count: rows.filter((v) => v.status === "open").length },
                { value: "confirmed", label: "Confirmed", count: rows.filter((v) => v.status === "confirmed").length },
                { value: "overturned", label: "Overturned", count: rows.filter((v) => v.status === "overturned").length },
              ]}
            />
            <DataTable
              columns={columns}
              rows={view}
              pageSize={10}
              dense
              rowKey={(v) => v.id}
              onRowClick={(v) => {
                setSelId(v.id);
                setOpen(true);
              }}
              search={(v) => `${v.id} ${v.trader.name} ${v.login} ${VIOLATION_LABEL[v.type]}`}
              searchPlaceholder="Search trader, login, ID…"
              exportName="prop-violations"
              toolbar={<Segmented size="xs" value={kind} onChange={setKind} options={[{ value: "all", label: "All" }, { value: "rules", label: "Rule breaches" }, { value: "banned", label: "Banned strategies" }]} />}
            />
          </Card>
        </Reveal>
        <Reveal delay={0.05} className="xl:col-span-12">
          <Card className="h-full">
            <CardHeader title="Detections by type" subtitle="Last 14 days · click to filter the table" />
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 px-6 pb-6 pt-4 sm:grid-cols-2 xl:grid-cols-5">
              {byType.map(({ t, n }) => (
                <button key={t} onClick={() => setKind(BANNED_TYPES.includes(t) ? "banned" : "rules")} className="block w-full text-left">
                  <div className="mb-1 flex items-center justify-between text-[12.5px]">
                    <span className="flex items-center gap-1.5 text-fg-2">
                      {BANNED_TYPES.includes(t) && <Bot className="size-3 text-down" />}
                      {VIOLATION_LABEL[t]}
                    </span>
                    <span className="k-num">{n}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className={BANNED_TYPES.includes(t) ? "h-full rounded-full bg-down" : "h-full rounded-full bg-ember"} style={{ width: `${(n / maxN) * 100}%` }} />
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>

      <ViolationDrawer v={sel} open={open} onOpenChange={setOpen} onConfirm={confirm} onOverturn={overturn} onBan={ban} />
      {reason.node}
    </div>
  );
}
