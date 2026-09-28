"use client";

import * as React from "react";
import { Download, Settings2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, Chip, DataTable, Icon3D, KpiCard, Money, PageHeader, Reveal, Segmented, SpotlightCard, cn, type Column } from "@kalks/ui";
import { FRAUD_FLAGS, FRAUD_LABEL, type FraudFlag, type FraudType } from "@kalks/mock/admin-partners";
import { RiskScore } from "@/components/config/kit";
import { ago, fmtUsdK } from "@/components/partners/common";
import { FRAUD_STATUS, FraudDrawer, SEV_TONE } from "@/components/partners/fraud-drawer";

const TYPES: { type: FraudType; icon: string; desc: string }[] = [
  { type: "wash", icon: "chart_decreasing", desc: "Opposing trades, same symbol & size, < 1s apart" },
  { type: "hedge", icon: "link", desc: "Mirrored exposure across linked referred accounts" },
  { type: "selfref", icon: "identification_card", desc: "Partner and client share device, IP or wallet" },
];

export default function FraudPage() {
  const [rows, setRows] = React.useState(FRAUD_FLAGS);
  const [sel, setSel] = React.useState<string | null>(null);
  const [type, setType] = React.useState<"all" | FraudType>("all");
  const [status, setStatus] = React.useState<"active" | "closed" | "all">("active");

  React.useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("flag");
    if (id) setSel(id);
  }, []);

  const isActive = (f: FraudFlag) => f.status === "open" || f.status === "investigating";
  const view = rows.filter((f) => (type === "all" || f.type === type) && (status === "all" || (status === "active") === isActive(f)));
  const flag = rows.find((f) => f.id === sel) ?? null;
  const active = rows.filter(isActive);
  const atRisk = active.reduce((s, f) => s + f.affectedCommission, 0);

  const cols: Column<FraudFlag>[] = [
    { key: "id", header: "Case", cell: (f) => <span><span className="block font-mono text-[12.5px]">{f.id}</span><span className="text-[11.5px] text-fg-3">{ago(f.detected)}</span></span> },
    { key: "t", header: "Type", sort: (f) => f.type, cell: (f) => <span className="text-[13px] font-medium">{FRAUD_LABEL[f.type]}</span> },
    { key: "p", header: "Partner", sort: (f) => f.partnerName, cell: (f) => <span className="flex items-center gap-2"><Avatar src={f.partnerPhoto} name={f.partnerName} size={26} /><span className="min-w-0"><span className="block truncate text-[13px]">{f.partnerName}</span><span className="font-mono text-[11px] text-fg-3">{f.partnerId}</span></span></span> },
    { key: "a", header: "Accounts", align: "right", hideOn: "lg", cell: (f) => <span className="k-num text-fg-2">{f.accounts.length}</span> },
    { key: "sv", header: "Severity", sort: (f) => f.score, cell: (f) => <Chip size="sm" tone={SEV_TONE[f.severity]} dot>{f.severity}</Chip> },
    { key: "sc", header: "Score", hideOn: "md", sort: (f) => f.score, cell: (f) => <RiskScore score={f.score} /> },
    { key: "c", header: "Affected commission", align: "right", sort: (f) => f.affectedCommission, cell: (f) => <span><Money value={f.affectedCommission} countUp={false} className="font-medium text-down" /><span className="block text-[11px] text-fg-3">{f.affectedLots.toLocaleString()} lots</span></span> },
    { key: "s", header: "Status", cell: (f) => <Chip size="sm" tone={FRAUD_STATUS[f.status].tone} dot>{FRAUD_STATUS[f.status].label}</Chip> },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Fraud flags"
        subtitle="Partner abuse detection: wash trading, cross-client hedging and self-referral"
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("Detection rules", { description: "R-WASH-02, R-HEDGE-05, R-SELF-01 active · last tuned 12 Sep" })}>
              <Settings2 /> Rules
            </Button>
            <Button variant="surface" onClick={() => toast.success("fraud-cases.csv exported", { description: `${view.length} cases with evidence links` })}>
              <Download /> Export
            </Button>
            <Button variant="ember" onClick={() => setSel([...active].sort((a, b) => b.score - a.score)[0]?.id ?? null)}>
              <ShieldAlert /> Review top case
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open cases" value={<span className="k-num">{active.length}</span>} chip={`${active.filter((f) => f.severity === "critical").length} critical`} chipTone="down" hot illustration="warning" />
        <KpiCard label="Commission at risk" value={<Money value={atRisk} />} chip="Auto-held from payouts" chipTone="warn" delay={0.05} />
        <KpiCard label="Clawed back · MTD" value={<Money value={18_442.6} />} chip="7 cases actioned" chipTone="up" delay={0.1} />
        <KpiCard label="Partners frozen" value={<span className="k-num">4</span>} chip={`${fmtUsdK(31_220)} payouts held`} chipTone="neutral" delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {TYPES.map((t, i) => {
          const list = rows.filter((f) => f.type === t.type);
          const on = type === t.type;
          return (
            <Reveal key={t.type} delay={0.05 * i}>
              <button type="button" className="block h-full w-full text-left" onClick={() => setType(on ? "all" : t.type)}>
                <SpotlightCard className={cn("flex h-full items-center gap-4 px-5 py-4", on && "border-ember/50")}>
                  <Icon3D name={t.icon} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[15px] font-medium">{FRAUD_LABEL[t.type]} {on && <Chip size="sm" tone="ember">Filtered</Chip>}</div>
                    <div className="truncate text-[12px] text-fg-3">{t.desc}</div>
                  </div>
                  <div className="text-right">
                    <div className="k-num text-[22px] font-semibold">{list.filter(isActive).length}</div>
                    <div className="k-num text-[11px] text-fg-3">{fmtUsdK(list.filter(isActive).reduce((s, f) => s + f.affectedCommission, 0))}</div>
                  </div>
                </SpotlightCard>
              </button>
            </Reveal>
          );
        })}
      </div>

      <Reveal delay={0.1}>
        <Card className="mt-4 p-4 sm:p-6">
          <DataTable
            columns={cols}
            rows={view}
            dense
            pageSize={10}
            rowKey={(f) => f.id}
            onRowClick={(f) => setSel(f.id)}
            search={(f) => `${f.id} ${f.partnerName} ${f.partnerId} ${f.accounts.join(" ")}`}
            searchPlaceholder="Case, partner, login…"
            toolbar={
              <div className="flex flex-wrap gap-2">
                <Segmented size="xs" value={status} onChange={setStatus} options={[{ value: "active", label: `Active ${active.length}` }, { value: "closed", label: "Closed" }, { value: "all", label: "All" }]} />
                <Segmented size="xs" value={type} onChange={setType} options={[{ value: "all", label: "All types" }, { value: "wash", label: "Wash" }, { value: "hedge", label: "Hedging" }, { value: "selfref", label: "Self-ref" }]} />
              </div>
            }
          />
        </Card>
      </Reveal>

      <FraudDrawer flag={flag} open={!!flag} onOpenChange={(o) => !o && setSel(null)} onChange={(n) => setRows((rs) => rs.map((r) => (r.id === n.id ? n : r)))} />
    </div>
  );
}
