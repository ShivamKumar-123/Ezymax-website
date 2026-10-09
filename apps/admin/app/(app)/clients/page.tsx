"use client";

import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveClients } from "@/components/live/clients";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, EyeOff, Layers, Mail, Tag, UserPlus, Users, UserCheck, Wallet, Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Card,
  Chip,
  DataTable,
  Dialog,
  DialogClose,
  Field,
  Input,
  KpiCard,
  Menu,
  Money,
  PageHeader,
  Reveal,
  Segmented,
  Tooltip,
  cn,
  formatMoney,
  type Column,
} from "@ezymex/ui";
import { ADMIN_NOW, CLIENTS, CLIENT_GROUPS, CLIENT_TAGS, REASON_CODES, SALES_AGENTS, staff, timeAgo, type AdminClient } from "@ezymex/mock/admin-clients";
import { Check, ClientCell, KycChip, ReasonDialog, RiskScore } from "@/components/command/kit";
import { ClientManageMenu, ClientStateChips, type ManageResult } from "@/components/clients/manage";

type Filter = "all" | "verified" | "pending" | "funded" | "inactive";

const FILTERS: Record<Filter, (c: AdminClient) => boolean> = {
  all: () => true,
  verified: (c) => c.kyc === "verified",
  pending: (c) => c.kyc === "pending" || c.kyc === "review",
  funded: (c) => c.funded,
  inactive: (c) => c.status === "inactive",
};

type Bulk = "group" | "agent" | "email" | "tag" | null;

function BulkDialogs({ bulk, setBulk, count, onDone }: { bulk: Bulk; setBulk: (b: Bulk) => void; count: number; onDone: () => void }) {
  const [group, setGroup] = React.useState<string>("Pro");
  const [agent, setAgent] = React.useState(SALES_AGENTS[0]!.id);
  const [tag, setTag] = React.useState<string>("VIP");
  const [tpl, setTpl] = React.useState<"promo" | "kyc" | "custom">("kyc");
  const close = (o: boolean) => !o && setBulk(null);
  return (
    <>
      <ReasonDialog
        open={bulk === "group"}
        onOpenChange={close}
        title={`Change group for ${count} clients`}
        description="Applies to the primary live account. Spreads, commission and leverage caps change immediately."
        codes={REASON_CODES.group}
        confirmLabel={`Move to ${group}`}
        successMessage={`${count} clients moved to ${group}`}
        onConfirm={onDone}
      >
        <Segmented size="sm" value={group} onChange={setGroup} options={CLIENT_GROUPS} />
      </ReasonDialog>
      <Dialog
        open={bulk === "agent"}
        onOpenChange={close}
        title={`Assign ${count} clients`}
        description="The agent is notified and the clients appear in their book."
        footer={
          <>
            <DialogClose asChild>
              <Button size="sm" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button size="sm" variant="ember" onClick={() => { toast.success(`${count} clients assigned to ${staff(agent).name}`); setBulk(null); onDone(); }}>
              Assign
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          {SALES_AGENTS.map((a) => (
            <button key={a.id} onClick={() => setAgent(a.id)} className={cn("flex w-full items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left", agent === a.id ? "border-ember/50 bg-ember-soft" : "border-line bg-surface-2 hover:bg-surface-3")}>
              <Avatar src={a.photo} name={a.name} size={32} />
              <span className="flex-1">
                <span className="block text-[13.5px] font-medium">{a.name}</span>
                <span className="block text-[11.5px] text-fg-3">{a.role} · {a.desk}</span>
              </span>
              <span className="k-num text-[12px] text-fg-3">{CLIENTS.filter((c) => c.agentId === a.id).length} clients</span>
            </button>
          ))}
        </div>
      </Dialog>
      <Dialog
        open={bulk === "email"}
        onOpenChange={close}
        title={`Email ${count} clients`}
        width={600}
        footer={
          <>
            <DialogClose asChild>
              <Button size="sm" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button size="sm" variant="ember" onClick={() => { toast.success(`Email queued to ${count} clients`, { description: "Sent via notify service · tracked in Marketing → Campaigns" }); setBulk(null); onDone(); }}>
              <Mail /> Send
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Segmented size="xs" value={tpl} onChange={setTpl} options={[{ value: "kyc", label: "KYC reminder" }, { value: "promo", label: "Gold swap-free promo" }, { value: "custom", label: "Custom" }]} />
          <Field label="Subject">
            <Input key={tpl} defaultValue={tpl === "kyc" ? "Finish verifying your Ezymex account" : tpl === "promo" ? "Trade gold swap-free this month" : ""} placeholder="Subject" />
          </Field>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-fg-2">Body</span>
            <textarea
              key={tpl}
              rows={6}
              defaultValue={tpl === "kyc" ? "Hi {{first_name}},\n\nYou're one step away from withdrawals and higher limits. Upload your ID and a selfie — it takes about 2 minutes.\n\nThe Ezymex team" : tpl === "promo" ? "Hi {{first_name}},\n\nFrom 1 Oct, XAUUSD is swap-free on Standard and Pro accounts.\n\nThe Ezymex team" : ""}
              className="w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 font-mono text-[12.5px] outline-none focus:border-ember/50"
            />
          </label>
        </div>
      </Dialog>
      <Dialog
        open={bulk === "tag"}
        onOpenChange={close}
        title={`Tag ${count} clients`}
        footer={
          <>
            <DialogClose asChild>
              <Button size="sm" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button size="sm" variant="ember" onClick={() => { toast.success(`Tag “${tag}” added to ${count} clients`); setBulk(null); onDone(); }}>
              Add tag
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {CLIENT_TAGS.map((t) => (
            <button key={t} onClick={() => setTag(t)} className={cn("rounded-full border px-3 py-1.5 text-[12.5px]", tag === t ? "border-ember/50 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-2")}>
              {t}
            </button>
          ))}
        </div>
      </Dialog>
    </>
  );
}

function DemoUsersPage() {
  const router = useRouter();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [bulk, setBulk] = React.useState<Bulk>(null);
  // client management (components/clients/manage.tsx), demo: hidden / deleted only in this tab
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const [deleted, setDeleted] = React.useState<Map<string, "deleted" | "purged">>(new Map());
  const [showHidden, setShowHidden] = React.useState(false);
  const managed = (id: string, r: ManageResult) => {
    if (r === "hidden" || r === "unhidden")
      setHidden((s) => {
        const n = new Set(s);
        if (r === "hidden") n.add(id);
        else n.delete(id);
        return n;
      });
    else setDeleted((m) => new Map(m).set(id, r));
  };
  const rows = React.useMemo(
    () => CLIENTS.filter(FILTERS[filter]).filter((c) => deleted.get(c.id) !== "purged" && (showHidden || (!hidden.has(c.id) && !deleted.has(c.id)))),
    [filter, hidden, deleted, showHidden],
  );
  const hiddenCount = hidden.size + [...deleted.values()].filter((v) => v === "deleted").length;
  const allSel = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const someSel = !allSel && rows.some((r) => sel.has(r.id));
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const count = (f: Filter) => CLIENTS.filter(FILTERS[f]).length;
  const verified = count("verified");
  const funded = count("funded");
  const net = CLIENTS.reduce((s, c) => s + c.net, 0);
  const newToday = CLIENTS.filter((c) => ADMIN_NOW - Date.parse(c.registered) < 2 * 86_400_000).length + 14;

  const columns: Column<AdminClient>[] = [
    {
      key: "sel",
      header: <Check checked={allSel} indeterminate={someSel} onChange={(v) => setSel((s) => { const n = new Set(s); rows.forEach((r) => (v ? n.add(r.id) : n.delete(r.id))); return n; })} label="Select all" />,
      width: "44px",
      cell: (r) => <Check checked={sel.has(r.id)} onChange={() => toggle(r.id)} />,
    },
    {
      key: "name",
      header: "Client",
      cell: (r) => (
        <span className="flex items-center gap-2">
          <ClientCell client={r} sub={<span className="font-mono">#{r.id}</span>} />
          <ClientStateChips hidden={hidden.has(r.id)} deleted={deleted.has(r.id)} />
        </span>
      ),
      sort: (r) => r.name,
    },
    { key: "email", header: "Email", hideOn: "lg", cell: (r) => <span className="text-[12.5px] text-fg-2">{r.email}</span> },
    { key: "kyc", header: "KYC", cell: (r) => <KycChip status={r.kyc} size="sm" />, sort: (r) => r.kyc },
    { key: "acc", header: "Accts", align: "right", cell: (r) => <span className="k-num">{r.accounts}</span>, sort: (r) => r.accounts },
    { key: "eq", header: "Equity", align: "right", cell: (r) => <span className="k-num font-mono text-[12.5px]">{formatMoney(r.equity)}</span>, sort: (r) => r.equity },
    { key: "dep", header: "Deposits", align: "right", hideOn: "md", cell: (r) => <span className="k-num font-mono text-[12.5px] text-fg-2">{formatMoney(r.deposits, "USD", 0)}</span>, sort: (r) => r.deposits },
    { key: "net", header: "Net dep.", align: "right", cell: (r) => <span className={cn("k-num font-mono text-[12.5px]", r.net > 0 ? "text-up" : "text-fg-3")}>{formatMoney(r.net, "USD", 0)}</span>, sort: (r) => r.net },
    { key: "ib", header: "IB", hideOn: "lg", cell: (r) => (r.ib ? <Tooltip content={r.ib.name}><span className="whitespace-nowrap font-mono text-[11.5px] text-gold">{r.ib.id}</span></Tooltip> : <span className="text-fg-3">—</span>) },
    {
      key: "agent",
      header: "Desk / agent",
      hideOn: "md",
      cell: (r) => {
        const a = staff(r.agentId);
        return (
          <span className="flex items-center gap-2">
            <Avatar src={a.photo} name={a.name} size={22} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[12px]">{a.name.split(" ")[0]}</span>
              <span className="block truncate text-[10.5px] text-fg-3">{r.desk}</span>
            </span>
          </span>
        );
      },
    },
    { key: "risk", header: "Risk", align: "center", cell: (r) => <RiskScore score={r.risk} />, sort: (r) => r.risk },
    {
      key: "tags",
      header: "Tags",
      hideOn: "lg",
      cell: (r) => (
        <span className="flex gap-1 whitespace-nowrap">
          {r.tags.slice(0, 1).map((t) => (
            <Chip key={t} size="sm" tone={t === "VIP" ? "gold" : t === "Scalper" || t.includes("?") ? "down" : "neutral"}>
              {t}
            </Chip>
          ))}
          {r.tags.length > 1 && <Chip size="sm">+{r.tags.length - 1}</Chip>}
          {r.tags.length === 0 && <span className="text-fg-3">—</span>}
        </span>
      ),
    },
    { key: "login", header: "Last login", align: "right", cell: (r) => <span className={cn("text-[12px]", ADMIN_NOW - Date.parse(r.lastLogin) < 3_600_000 ? "text-up" : "text-fg-3")}>{timeAgo(r.lastLogin)}</span>, sort: (r) => -Date.parse(r.lastLogin) },
    {
      key: "manage",
      header: <span className="sr-only">Manage</span>,
      align: "right",
      width: "52px",
      cell: (r) => <ClientManageMenu client={{ id: r.id, name: r.name, email: r.email, hidden: hidden.has(r.id), deleted: deleted.has(r.id) }} onChanged={(res) => managed(r.id, res)} />,
    },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Users"
        subtitle="Every client across Ezymex Markets — KYC, funding, desk ownership and risk at a glance."
        actions={
          <Button variant="ember" size="lg" onClick={() => toast("Create client", { description: "Manual onboarding is disabled for this tenant — invite via link instead." })}>
            <Plus /> Invite client
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total users" icon={<Users />} value={<span className="k-num">{(18_412).toLocaleString()}</span>} chip={`+${newToday} today`} chipTone="up" />
        <KpiCard label="Verified" icon={<UserCheck />} value={<span className="k-num">{Math.round((verified / CLIENTS.length) * 100)}%</span>} chip={`${count("pending")} pending review`} chipTone="warn" href="/clients/kyc" delay={0.05} />
        <KpiCard label="Funded" icon={<Wallet />} value={<span className="k-num">{Math.round((funded / CLIENTS.length) * 100)}%</span>} chip="FTD conv. 31.4% (30d)" chipTone="up" delay={0.1} />
        <KpiCard label="Net deposits (shown)" icon={<Sparkles />} value={<Money value={net} decimals={0} />} chip={`${CLIENTS.length} in view`} chipTone="neutral" delay={0.15} />
      </div>
      <Reveal delay={0.1} className="mt-4">
        <Card className="px-4 pb-5 pt-5 sm:px-6">
          <DataTable
            columns={columns}
            rows={rows}
            dense
            pageSize={12}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/clients/${r.id}`)}
            exportName="clients"
            search={(r) => `${r.name} ${r.email} ${r.id} ${r.logins.join(" ")} ${r.countryName} ${r.tags.join(" ")}`}
            searchPlaceholder="Name, email, ID, login…"
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  size="sm"
                  value={filter}
                  onChange={(f) => setFilter(f)}
                  options={(["all", "verified", "pending", "funded", "inactive"] as Filter[]).map((f) => ({
                    value: f,
                    label: (
                      <>
                        {{ all: "All", verified: "Verified", pending: "Pending KYC", funded: "Funded", inactive: "Inactive" }[f]}
                        <span className="k-num text-fg-3">{count(f)}</span>
                      </>
                    ),
                  }))}
                />
                <Button size="sm" variant={showHidden ? "ember" : "surface"} onClick={() => setShowHidden((v) => !v)} aria-pressed={showHidden}>
                  <EyeOff /> Show hidden{hiddenCount ? ` · ${hiddenCount}` : ""}
                </Button>
                <AnimatePresence>
                  {sel.size > 0 && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex items-center gap-2">
                      <Menu
                        align="start"
                        width={220}
                        header={<div className="text-[12px] text-fg-3">{sel.size} clients selected</div>}
                        items={[
                          { label: "Change group", icon: <Layers />, onSelect: () => setBulk("group") },
                          { label: "Assign agent", icon: <UserPlus />, onSelect: () => setBulk("agent") },
                          { label: "Send email", icon: <Mail />, onSelect: () => setBulk("email") },
                          { label: "Add tag", icon: <Tag />, onSelect: () => setBulk("tag") },
                        ]}
                        trigger={
                          <Button size="sm" variant="ember">
                            Bulk actions · {sel.size} <ChevronDown />
                          </Button>
                        }
                      />
                      <button onClick={() => setSel(new Set())} className="text-[12px] text-fg-3 hover:text-fg">
                        Clear
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            }
          />
        </Card>
      </Reveal>
      <BulkDialogs bulk={bulk} setBulk={setBulk} count={sel.size} onDone={() => setSel(new Set())} />
    </div>
  );
}

/** Live builds: real data from the gateway / market-data. Demo builds: the mock showcase above. */
export default function Page() {
  return IS_DEMO ? (
    <DemoUsersPage />
  ) : (
    <React.Suspense>
      <LiveClients />
    </React.Suspense>
  );
}
