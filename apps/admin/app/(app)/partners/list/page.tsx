"use client";

import * as React from "react";
import { Download, Flag as FlagIcon, Sparkles, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Chip, DataTable, Dialog, Money, PageHeader, Reveal, Segmented, Sparkline, StatusChip, type Column } from "@kalks/ui";
import { LEVELS, PARTNERS, PLANS, SUB_BROKER_NAMES, type LevelKey, type Partner } from "@kalks/mock/admin-partners";
import { MiniField, MiniStat, PersonCell, Select, TextInput } from "@/components/config/kit";
import { LevelChip, fmtInt, fmtLots } from "@/components/partners/common";
import { PartnerDrawer } from "@/components/partners/partner-drawer";

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [plan, setPlan] = React.useState(PLANS[0]!.name);
  const [level, setLevel] = React.useState<LevelKey>("bronze");
  const [sb, setSb] = React.useState("Direct");
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Invite partner"
      description="Creates a partner portal account and sends an onboarding email with the partner agreement."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="ember"
            size="sm"
            onClick={() => {
              if (!name || !email.includes("@")) return toast.error("Name and a valid email are required");
              onOpenChange(false);
              toast.success(`Invitation sent to ${name}`, { description: `${plan} · ${LEVELS.find((l) => l.key === level)!.name} · ${sb}` });
              setName("");
              setEmail("");
            }}
          >
            <UserPlus /> Send invite
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MiniField label="Partner / company name"><TextInput value={name} onChange={setName} placeholder="e.g. Gulf Markets Hub" /></MiniField>
        <MiniField label="Email"><TextInput value={email} onChange={setEmail} placeholder="partners@company.com" /></MiniField>
        <MiniField label="Commission plan"><Select value={plan} onChange={setPlan} options={PLANS.map((p) => p.name)} /></MiniField>
        <MiniField label="Starting level"><Select value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l.key, label: l.name }))} /></MiniField>
        <MiniField label="Sub-broker" className="sm:col-span-2"><Select value={sb} onChange={setSb} options={["Direct", ...SUB_BROKER_NAMES]} /></MiniField>
      </div>
    </Dialog>
  );
}

export default function PartnersListPage() {
  const [rows, setRows] = React.useState<Partner[]>(PARTNERS);
  const [sel, setSel] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"all" | Partner["status"]>("all");
  const [level, setLevel] = React.useState<"all" | LevelKey>("all");
  const [deals, setDeals] = React.useState(false);
  const [invite, setInvite] = React.useState(false);

  React.useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("partner");
    if (id) setSel(id);
  }, []);

  const view = rows.filter((r) => (status === "all" || r.status === status) && (level === "all" || r.level === level) && (!deals || r.customDeal));
  const partner = rows.find((r) => r.id === sel) ?? null;
  const update = (p: Partner) => setRows((rs) => rs.map((r) => (r.id === p.id ? p : r)));

  const cols: Column<Partner>[] = [
    { key: "p", header: "Partner", sort: (r) => r.name, cell: (r) => <PersonCell name={r.name} photo={r.photo} country={r.country} sub={<span className="font-mono">{r.id}</span>} /> },
    { key: "lvl", header: "Level", sort: (r) => LEVELS.findIndex((l) => l.key === r.level), cell: (r) => <LevelChip level={r.level} /> },
    { key: "cl", header: "Clients", align: "right", sort: (r) => r.clientsActive, cell: (r) => <span className="k-num"><span className="font-medium text-fg">{fmtInt(r.clientsActive)}</span><span className="text-fg-3"> / {fmtInt(r.clientsTotal)}</span></span> },
    { key: "tree", header: "Tree", align: "right", hideOn: "lg", sort: (r) => r.tree.reduce((s, x) => s + x, 0), cell: (r) => <span className="k-num text-fg-2">{fmtInt(r.tree.reduce((s, x) => s + x, 0))}<span className="text-fg-3"> · {r.tree.length}T</span></span> },
    { key: "lots", header: "Lots MTD", align: "right", sort: (r) => r.lotsMtd, cell: (r) => <span className="inline-flex items-center justify-end gap-2.5"><Sparkline data={r.lotsSeries} width={52} height={20} tone="gold" fill={false} className="hidden xl:block" /><span className="k-num">{fmtLots(r.lotsMtd)}</span></span> },
    { key: "com", header: "Commission MTD", align: "right", sort: (r) => r.commissionMtd, cell: (r) => <Money value={r.commissionMtd} countUp={false} className="font-medium" /> },
    { key: "deal", header: "Deal", hideOn: "md", cell: (r) => (r.customDeal ? <Chip size="sm" tone="ember">{r.customDeal.kind === "rate" ? `$${r.customDeal.value.toFixed(2)}/lot` : `+${r.customDeal.value}%`}</Chip> : <span className="text-[12px] text-fg-3">{r.plan}</span>) },
    { key: "st", header: "Status", cell: (r) => <span className="inline-flex items-center gap-1.5"><StatusChip status={r.status} label={r.status === "suspended" ? "Suspended" : undefined} />{r.flags > 0 && <FlagIcon className="size-3.5 text-down" />}</span> },
  ];

  const tot = view.reduce((a, r) => ({ lots: a.lots + r.lotsMtd, com: a.com + r.commissionMtd, cl: a.cl + r.clientsActive }), { lots: 0, com: 0, cl: 0 });

  return (
    <div className="pb-16">
      <PageHeader
        title="Partners"
        subtitle="Introducing brokers, affiliates and their referral trees"
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("Level evaluation dry-run complete", { description: "23 promotions · 9 demotions would apply on 01 Oct" })}>
              <Sparkles /> Dry-run evaluation
            </Button>
            <Button variant="surface" onClick={() => toast.success("partners.csv exported", { description: `${view.length} rows` })}>
              <Download /> Export
            </Button>
            <Button variant="ember" onClick={() => setInvite(true)}>
              <UserPlus /> Invite partner
            </Button>
          </>
        }
      />

      <Reveal>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat label="Partners in view" value={fmtInt(view.length)} sub={`${view.filter((r) => r.status === "active").length} active`} />
          <MiniStat label="Active clients" value={fmtInt(tot.cl)} sub="Trading in last 30 days" />
          <MiniStat label="Lots MTD" value={fmtLots(tot.lots)} sub="Tier 1 volume" />
          <MiniStat label="Commission MTD" value={<Money value={tot.com} countUp={false} />} sub={`${view.filter((r) => r.customDeal).length} on custom deals`} tone="gold" />
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <Card className="p-4 sm:p-6">
          <DataTable
            columns={cols}
            rows={view}
            pageSize={12}
            dense
            rowKey={(r) => r.id}
            onRowClick={(r) => setSel(r.id)}
            search={(r) => `${r.name} ${r.id} ${r.refCode} ${r.email}`}
            searchPlaceholder="Name, ID, ref code…"
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <Segmented size="xs" value={status} onChange={setStatus} options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "review", label: "Review" }, { value: "suspended", label: "Suspended" }]} />
                <Select size="sm" className="w-36" value={level} onChange={setLevel} options={[{ value: "all", label: "All levels" }, ...LEVELS.map((l) => ({ value: l.key, label: l.name }))]} />
                <button type="button" onClick={() => setDeals((d) => !d)} className={deals ? "h-8 rounded-full border border-ember/30 bg-ember-soft px-3 text-[12px] font-medium text-ember" : "h-8 rounded-full border border-line bg-surface-2 px-3 text-[12px] font-medium text-fg-3 hover:text-fg-2"}>
                  Custom deals only
                </button>
              </div>
            }
          />
        </Card>
      </Reveal>

      <PartnerDrawer partner={partner} open={!!partner} onOpenChange={(o) => !o && setSel(null)} onChange={update} />
      <InviteDialog open={invite} onOpenChange={setInvite} />
    </div>
  );
}
