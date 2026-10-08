"use client";

import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveStaff } from "@/components/rbac/staff";

import * as React from "react";
import { toast } from "sonner";
import {
  Ban,
  Download,
  KeyRound,
  LogOut,
  Mail,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserCheck,
  UserRound,
  Users,
  Wifi,
} from "lucide-react";
import { Avatar, Button, Card, CardHeader, Chip, DataTable, Donut, IconButton, KpiCard, Menu, PageHeader, Reveal, Segmented, Tooltip, cn, type Column } from "@ezymex/ui";
import { PEOPLE } from "@ezymex/mock";
import { ORG_DESKS, ORG_EMPLOYEES, ORG_ROLE_META, type OrgEmployee, type OrgRoleKey } from "@ezymex/mock/admin-platform-security";
import { InviteDialog, type InviteDraft } from "@/components/org/invite-dialog";
import { AvatarStack, RoleChip, TWOFA_LABEL, deskName } from "@/components/org/shared";
import { TenantStack, ago } from "@/components/security/shared";

type StatusFilter = "all" | "active" | "invited" | "suspended";
const STATUS_TONE = { active: "up", invited: "warn", suspended: "down" } as const;
const ROLE_COLORS: Record<OrgRoleKey, string> = {
  super: "var(--k-ember)",
  dealer: "var(--k-gold)",
  risk: "var(--k-down)",
  finance: "var(--k-up)",
  compliance: "var(--k-info)",
  support: "var(--k-fg-2)",
  sales: "var(--k-warn)",
  ib: "var(--k-ember-2)",
  custom: "var(--k-fg-3)",
};

function DemoEmployeesPage() {
  const [list, setList] = React.useState<OrgEmployee[]>(ORG_EMPLOYEES);
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [role, setRole] = React.useState<OrgRoleKey | null>(null);

  const rows = list.filter((e) => (status === "all" || e.status === status) && (!role || e.role === role));
  const update = (id: string, patch: Partial<OrgEmployee>) => setList((l) => l.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const invite = (d: InviteDraft) => {
    const pi = 22;
    setList((l) => [
      {
        id: `stf_${2200 + l.length}`,
        person: { ...PEOPLE[pi]!, name: d.name, photo: "" },
        name: d.name,
        email: d.email,
        title: `${ORG_ROLE_META[d.role].name} · pending`,
        role: d.role,
        desk: d.desk,
        status: "invited",
        twoFa: "none",
        lastActive: "2026-09-24T14:32:00+03:00",
        online: false,
        tenants: d.tenants,
        joined: "2026-09-24",
        location: "—",
      },
      ...l,
    ]);
    setStatus("all");
  };

  const columns: Column<OrgEmployee>[] = [
    {
      key: "name",
      header: "Employee",
      sort: (r) => r.name,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar src={r.person.photo || undefined} name={r.name} size={36} online={r.online} />
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-medium">{r.name}</div>
            <div className="truncate font-mono text-[11.5px] text-fg-3">{r.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sort: (r) => ORG_ROLE_META[r.role].name,
      cell: (r) => (
        <div>
          <RoleChip role={r.role} />
          <div className="mt-1 max-w-[170px] truncate text-[11px] text-fg-3">{r.title}</div>
        </div>
      ),
    },
    { key: "desk", header: "Desk", sort: (r) => deskName(r.desk), cell: (r) => <span className="text-[13px] text-fg-2">{deskName(r.desk)}</span> },
    { key: "tenants", header: "Brokers", hideOn: "lg", cell: (r) => <TenantStack tenants={r.tenants} /> },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <Chip size="sm" tone={STATUS_TONE[r.status]} dot>
          {r.status === "active" ? "Active" : r.status === "invited" ? "Invited" : "Suspended"}
        </Chip>
      ),
    },
    {
      key: "2fa",
      header: "2FA",
      cell: (r) => (
        <span className={cn("inline-flex items-center gap-1.5 text-[12.5px]", r.twoFa === "hardware" ? "text-up" : r.twoFa === "none" ? "text-down" : r.twoFa === "sms" ? "text-warn" : "text-fg-2")}>
          {r.twoFa === "hardware" ? <KeyRound className="size-3.5" /> : r.twoFa === "none" ? <ShieldAlert className="size-3.5" /> : r.twoFa === "sms" ? <Smartphone className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
          {TWOFA_LABEL[r.twoFa]}
        </span>
      ),
    },
    {
      key: "last",
      header: "Last active",
      align: "right",
      sort: (r) => r.lastActive,
      cell: (r) => (
        <div className="text-right">
          <div className={cn("text-[12.5px]", r.online ? "text-up" : "text-fg-2")}>{r.status === "invited" ? "Never signed in" : r.online ? "Online" : ago(r.lastActive)}</div>
          <div className="text-[11px] text-fg-3">{r.location}</div>
        </div>
      ),
    },
    {
      key: "act",
      header: "",
      width: "48px",
      align: "right",
      cell: (r) => (
        <Menu
          trigger={
            <IconButton size="sm" aria-label={`Actions for ${r.name}`}>
              <MoreHorizontal />
            </IconButton>
          }
          items={[
            { label: "View profile", icon: <UserRound />, onSelect: () => toast.info(`Opening ${r.name}`, { description: `${r.title} · joined ${r.joined}` }) },
            { label: "Change role", icon: <Pencil />, href: "/org/roles" },
            r.status === "invited"
              ? { label: "Resend invite", icon: <Mail />, onSelect: () => toast.success("Invite re-sent", { description: `${r.email} · new link valid 72 h` }) }
              : { label: "Reset 2FA", icon: <RotateCcw />, onSelect: () => toast.success(`2FA reset for ${r.name}`, { description: "They must enrol a new factor on next sign-in" }) },
            { label: "Force logout", icon: <LogOut />, onSelect: () => toast.success(`${r.name} signed out of all sessions`) },
            "sep",
            r.status === "suspended"
              ? {
                  label: "Reactivate",
                  icon: <UserCheck />,
                  onSelect: () => {
                    update(r.id, { status: "active" });
                    toast.success(`${r.name} reactivated`);
                  },
                }
              : {
                  label: r.status === "invited" ? "Revoke invite" : "Suspend",
                  icon: <Ban />,
                  danger: true,
                  onSelect: () => {
                    if (r.status === "invited") {
                      setList((l) => l.filter((x) => x.id !== r.id));
                      toast.success("Invite revoked", { description: r.email });
                    } else {
                      update(r.id, { status: "suspended", online: false });
                      toast.error(`${r.name} suspended`, { description: "All sessions revoked · access frozen · logged to audit" });
                    }
                  },
                },
          ]}
        />
      ),
    },
  ];

  const active = list.filter((e) => e.status === "active");
  const online = list.filter((e) => e.online);
  const strong = list.filter((e) => e.twoFa === "hardware" || e.twoFa === "totp").length;
  const invited = list.filter((e) => e.status === "invited");
  const roleCounts = (Object.keys(ORG_ROLE_META) as OrgRoleKey[]).map((k) => ({ k, n: list.filter((e) => e.role === k).length })).filter((x) => x.n > 0);

  return (
    <div className="pb-16">
      <PageHeader
        title="Employees"
        subtitle="Back Office staff across all brokers · roles, desks, access and 2FA"
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("staff-directory.csv exported", { description: `${list.length} employees · emails masked` })}>
              <Download /> Export
            </Button>
            <InviteDialog onInvite={invite} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Headcount" icon={<Users />} value={<span className="k-num">{list.length}</span>} chip={`${active.length} active · ${ORG_DESKS.length} desks`} />
        <KpiCard
          label="Online now"
          icon={<Wifi />}
          value={<span className="k-num">{online.length}</span>}
          footer={<AvatarStack photos={online.map((e) => ({ src: e.person.photo, name: e.name }))} max={7} size={22} />}
          delay={0.05}
        />
        <KpiCard label="Strong 2FA" icon={<ShieldCheck />} value={<span className="k-num">{Math.round((strong / list.length) * 100)}%</span>} chip={`${list.filter((e) => e.twoFa === "sms").length} on SMS · ${list.filter((e) => e.twoFa === "none").length} not enrolled`} chipTone="warn" delay={0.1} />
        <KpiCard label="Pending invites" icon={<Mail />} value={<span className="k-num">{invited.length}</span>} chip="Links expire after 72 h" chipTone="gold" illustration="busts_in_silhouette" hot delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="min-w-0 xl:col-span-9">
          <Card>
            <CardHeader title="Staff directory" subtitle={`${rows.length} of ${list.length} employees`} />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <DataTable
                columns={columns}
                rows={rows}
                pageSize={12}
                dense
                rowKey={(r) => r.id}
                search={(r) => `${r.name} ${r.email} ${r.title} ${deskName(r.desk)}`}
                searchPlaceholder="Name, email, desk…"
                toolbar={
                  <>
                    <Segmented
                      size="xs"
                      value={status}
                      onChange={setStatus}
                      options={[
                        { value: "all", label: "All" },
                        { value: "active", label: <>Active <span className="text-fg-3">{list.filter((e) => e.status === "active").length}</span></> },
                        { value: "invited", label: <>Invited <span className="text-fg-3">{invited.length}</span></> },
                        { value: "suspended", label: <>Suspended <span className="text-fg-3">{list.filter((e) => e.status === "suspended").length}</span></> },
                      ]}
                    />
                    <Menu
                      align="start"
                      trigger={
                        <button className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px]", role ? "border-ember/35 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-2 hover:bg-surface-3")}>
                          Role: <span className="font-medium">{role ? ORG_ROLE_META[role].name : "Any"}</span>
                        </button>
                      }
                      items={[{ label: "Any role", onSelect: () => setRole(null) }, "sep", ...roleCounts.map(({ k, n }) => ({ label: ORG_ROLE_META[k].name, hint: String(n), onSelect: () => setRole(k) }))]}
                    />
                  </>
                }
              />
            </div>
          </Card>
        </Reveal>

        <div className="flex flex-col gap-4 xl:col-span-3">
          <Reveal delay={0.15}>
            <Card>
              <CardHeader title="By role" subtitle="Headcount per permission set" />
              <div className="flex flex-col items-center gap-4 px-5 pb-5 pt-4">
                <Donut
                  size={150}
                  thickness={16}
                  data={roleCounts.map(({ k, n }) => ({ label: ORG_ROLE_META[k].name, value: n, color: ROLE_COLORS[k] }))}
                  center={
                    <div className="text-center">
                      <div className="k-num text-[22px] font-semibold">{list.length}</div>
                      <div className="text-[11px] text-fg-3">staff</div>
                    </div>
                  }
                />
                <div className="w-full space-y-1.5">
                  {roleCounts.map(({ k, n }) => (
                    <button key={k} onClick={() => setRole(role === k ? null : k)} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1 text-[12.5px] transition-colors hover:bg-surface-2", role === k && "bg-surface-2")}>
                      <span className="size-2 rounded-full" style={{ background: ROLE_COLORS[k] }} />
                      <span className="flex-1 text-left text-fg-2">{ORG_ROLE_META[k].name}</span>
                      <span className="k-num font-medium">{n}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.2}>
            <Card>
              <CardHeader title="Needs attention" subtitle="Access hygiene" />
              <div className="mt-3 space-y-2 px-4 pb-5 sm:px-5">
                {list
                  .filter((e) => e.twoFa === "sms" || e.twoFa === "none" || e.status === "suspended")
                  .slice(0, 5)
                  .map((e) => (
                    <div key={e.id} className="k-row flex items-center gap-2.5 px-3 py-2.5">
                      <Avatar src={e.person.photo || undefined} name={e.name} size={26} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-medium">{e.name}</div>
                        <div className="truncate text-[11px] text-fg-3">{e.status === "suspended" ? "Suspended · holds 1 tenant" : e.twoFa === "none" ? "Invite pending · no 2FA" : "Weak 2FA (SMS)"}</div>
                      </div>
                      <Tooltip content="Send reminder">
                        <IconButton size="sm" onClick={() => toast.success(`Reminder sent to ${e.name}`)} aria-label="Remind">
                          <Mail />
                        </IconButton>
                      </Tooltip>
                    </div>
                  ))}
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

/** Live builds: real data from the gateway / market-data. Demo builds: the mock showcase above. */
export default function Page() {
  return IS_DEMO ? <DemoEmployeesPage /> : <LiveStaff />;
}
