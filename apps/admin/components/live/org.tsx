"use client";

import * as React from "react";
import Link from "next/link";
import { KeyRound, RefreshCw, ShieldCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, DataTable, EmptyState, KeyValue, PageHeader, Reveal, type ChipTone, type Column } from "@kalks/ui";
import { useCan, useStaff } from "@/components/staff-session";
import { ErrorState, TableSkeleton, ago, day, useApi, useNow, when } from "./kit";
import type { StaffMember } from "./types";

const ROLE_TONE: Record<string, ChipTone> = { platform_owner: "ember", super_admin: "gold", admin: "info" };

const PERM_LABEL: Record<string, string> = {
  "stats.read": "Command Center",
  "clients.read": "Clients",
  "audit.read": "Audit log",
  "sessions.read": "Sessions",
  "sessions.revoke": "Revoke sessions",
  "staff.read": "Staff list",
  "spreads.read": "View spreads",
  "spreads.write": "Edit spreads",
};

function MyAccess() {
  const me = useStaff();
  return (
    <Card className="h-full">
      <CardHeader title="Your access" subtitle={`${me.role_label} · ${me.tenant.name}`} icon={<KeyRound />} />
      <div className="px-4 pb-5 pt-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Avatar name={me.name} size={44} online />
          <div className="min-w-0">
            <div className="truncate font-medium">{me.name}</div>
            <div className="truncate text-[12.5px] text-fg-3">{me.email}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(me.permissions ?? []).map((p) => (
            <Chip key={p} size="sm" tone="up" dot>
              {PERM_LABEL[p] ?? p}
            </Chip>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-fg-3">Sign-in needs your password and a one-time code sent to your work email. Sessions end after 2 hours idle or 12 hours.</p>
      </div>
    </Card>
  );
}

export function LiveOrg() {
  const now = useNow();
  const canList = useCan("staff.read");
  const { data, error, reload } = useApi<{ items: StaffMember[]; total: number }>(canList ? "/api/admin/staff" : null);
  const items = data?.items ?? [];
  const online = items.filter((s) => s.active_sessions > 0).length;

  const columns: Column<StaffMember>[] = [
    {
      key: "who",
      header: "Staff member",
      cell: (s) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={s.name} size={34} online={s.active_sessions > 0} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 truncate font-medium">
              {s.name}
              {s.is_me && (
                <Chip size="sm" tone="ember">
                  You
                </Chip>
              )}
            </span>
            <span className="block truncate text-[12px] text-fg-3">{s.email}</span>
          </span>
        </span>
      ),
    },
    { key: "role", header: "Role", cell: (s) => <Chip size="sm" tone={ROLE_TONE[s.role] ?? "neutral"}>{s.role_label}</Chip> },
    {
      key: "status",
      header: "Status",
      cell: (s) =>
        s.status !== "active" ? (
          <Chip size="sm" tone="down" dot>
            Disabled
          </Chip>
        ) : s.locked ? (
          <Chip size="sm" tone="warn" dot>
            Locked
          </Chip>
        ) : (
          <Chip size="sm" tone="up" dot>
            Active
          </Chip>
        ),
    },
    { key: "sessions", header: "Online", cell: (s) => (s.active_sessions > 0 ? <span className="whitespace-nowrap text-up">{s.active_sessions} session{s.active_sessions > 1 ? "s" : ""}</span> : <span className="text-fg-3">No</span>), hideOn: "sm" },
    { key: "login", header: "Last sign-in", cell: (s) => <span className="whitespace-nowrap text-fg-2" title={when(s.last_login_at)}>{ago(s.last_login_at, now)}</span>, hideOn: "md" },
    {
      key: "activity",
      header: "Last activity",
      cell: (s) => (
        <Link href={`/security?actor=staff:${s.id}`} onClick={(e) => e.stopPropagation()} className="text-fg-2 hover:text-ember" title="Open this staff member's audit trail">
          {ago(s.last_activity_at, now)}
        </Link>
      ),
      hideOn: "lg",
    },
    { key: "added", header: "Added", align: "right", cell: (s) => <span className="whitespace-nowrap text-fg-3" title={when(s.created_at)}>{day(s.created_at)}</span>, hideOn: "xl" },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Staff"
        subtitle="Back Office accounts for your brokerage"
        actions={
          <>
            {canList && (
              <Button variant="surface" onClick={reload}>
                <RefreshCw /> Refresh
              </Button>
            )}
            <Button variant="ember" onClick={() => toast("Staff invitations aren't enabled yet", { description: "New staff accounts are created by the Platform Owner." })}>
              <UserPlus /> Invite staff
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <Card>
            <CardHeader
              title="Team"
              subtitle={data ? `${data.total} account${data.total === 1 ? "" : "s"} · ${online} signed in now` : "Everyone with Back Office access"}
              icon={<Users />}
            />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              {!canList ? (
                <EmptyState title="Not available for your role" text="Only Super Admins and Administrators can see the staff list." illustration="locked" />
              ) : error ? (
                <ErrorState error={error} onRetry={reload} />
              ) : !data ? (
                <TableSkeleton rows={3} />
              ) : (
                <DataTable rows={items} columns={columns} rowKey={(s) => String(s.id)} pageSize={50} empty={<EmptyState title="No staff yet" illustration="busts_in_silhouette" />} />
              )}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.05} className="xl:col-span-4">
          <div className="grid h-full gap-4">
            <MyAccess />
            <Card>
              <CardHeader title="Roles" subtitle="Hierarchy used by the Back Office" icon={<ShieldCheck />} />
              <div className="px-4 pb-4 sm:px-6">
                <KeyValue
                  rows={[
                    ["Platform Owner", "Everything, all brokers"],
                    ["Super Admin", "Everything in this broker"],
                    ["Administrator", "Everything in this broker"],
                    ["Compliance", "Clients, audit, sessions"],
                    ["Dealer / Risk", "Clients, spreads"],
                    ["Finance / Support", "Clients"],
                  ]}
                />
              </div>
            </Card>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
