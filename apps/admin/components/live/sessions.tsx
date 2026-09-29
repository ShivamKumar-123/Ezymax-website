"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut, Monitor, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, DataTable, Dialog, EmptyState, Flag, PageHeader, Reveal, Segmented, Tabs, type Column } from "@kalks/ui";
import { TextArea } from "@/components/config/kit";
import { useCan } from "@/components/staff-session";
import { ErrorState, Mono, Pager, TableSkeleton, ago, device, qs, sendJson, useApi, useNow, when } from "./kit";
import type { Session, SessionsPage } from "./types";

export function RevokeDialog({ session, onClose, onDone }: { session: Session | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setReason(""), [session?.id]);
  if (!session) return null;
  const who = session.subject.name ?? session.subject.email ?? `#${session.subject.id}`;
  async function revoke() {
    if (!session) return;
    setBusy(true);
    const r = await sendJson(`/api/admin/sessions/${session.id}/revoke`, { reason: reason.trim() || undefined });
    setBusy(false);
    if (!r.ok) return toast.error("Couldn't revoke the session", { description: r.error.message });
    toast.success(`Session revoked · ${who}`, { description: "They are signed out on that device. Logged to the audit trail." });
    onDone();
    onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Revoke session"
      description={`${who} will be signed out on ${device(session.user_agent)}. Other devices stay signed in.`}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="down-outline" onClick={revoke} disabled={busy}>
            <LogOut /> {busy ? "Revoking…" : "Revoke session"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="k-row grid grid-cols-2 gap-3 px-4 py-3 text-[12.5px]">
          <div>
            <div className="text-fg-3">Session</div>
            <Mono>{session.fingerprint}</Mono>
          </div>
          <div>
            <div className="text-fg-3">IP address</div>
            <Mono>{session.ip ?? "—"}</Mono>
          </div>
          <div>
            <div className="text-fg-3">Started</div>
            {when(session.created_at)}
          </div>
          <div>
            <div className="text-fg-3">Last active</div>
            {when(session.last_seen_at)}
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-fg-2">Reason (optional, saved in the audit log)</span>
          <TextArea value={reason} onChange={setReason} placeholder="e.g. Lost device, suspicious sign-in" rows={2} />
        </label>
      </div>
    </Dialog>
  );
}

export function sessionColumns({ now, canRevoke, onRevoke, showSubject }: { now: number; canRevoke: boolean; onRevoke: (s: Session) => void; showSubject: boolean }): Column<Session>[] {
  const cols: Column<Session>[] = [];
  if (showSubject)
    cols.push({
      key: "who",
      header: "Signed in as",
      cell: (s) => {
        const name = s.subject.name ?? s.subject.email ?? `#${s.subject.id}`;
        const inner = (
          <span className="flex min-w-0 items-center gap-3">
            <Avatar name={name} size={32} online />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 truncate font-medium">
                {name}
                {s.current && (
                  <Chip size="sm" tone="ember">
                    This session
                  </Chip>
                )}
              </span>
              <span className="block truncate text-[12px] text-fg-3">{s.subject.role_label ?? s.subject.email}</span>
            </span>
          </span>
        );
        return s.subject.kind === "user" ? (
          <Link href={`/clients/${s.subject.id}`} onClick={(e) => e.stopPropagation()} className="hover:opacity-90">
            {inner}
          </Link>
        ) : (
          inner
        );
      },
    });
  cols.push(
    {
      key: "device",
      header: "Device",
      cell: (s) => (
        <span className="flex items-center gap-2 whitespace-nowrap text-fg-2">
          <Monitor className="size-3.5 text-fg-3" />
          {device(s.user_agent)}
          {s.viewer && (
            <Chip size="sm" tone="info">
              View-only · {s.viewer.label ?? "viewer"}
            </Chip>
          )}
        </span>
      ),
    },
    {
      key: "ip",
      header: "IP",
      cell: (s) => (
        <span className="inline-flex items-center gap-1.5">
          {s.country && <Flag country={s.country} className="size-3.5" />}
          <Mono>{s.ip ?? "—"}</Mono>
        </span>
      ),
    },
    { key: "fp", header: "Session", cell: (s) => <Mono className="text-fg-3">{s.fingerprint}</Mono>, hideOn: "lg" },
    { key: "started", header: "Started", cell: (s) => <span className="whitespace-nowrap" title={when(s.created_at)}>{ago(s.created_at, now)}</span>, hideOn: "md" },
    { key: "seen", header: "Last active", cell: (s) => <span className="whitespace-nowrap" title={when(s.last_seen_at)}>{ago(s.last_seen_at, now)}</span> },
    { key: "exp", header: "Expires", cell: (s) => <span className="whitespace-nowrap text-fg-3" title={when(s.expires_at)}>{ago(s.expires_at, now)}</span>, hideOn: "xl" },
  );
  if (canRevoke)
    cols.push({
      key: "act",
      header: "",
      align: "right",
      cell: (s) =>
        s.current ? (
          <span className="text-[12px] text-fg-3">Current</span>
        ) : (
          <Button
            size="xs"
            variant="down-outline"
            onClick={(e) => {
              e.stopPropagation();
              onRevoke(s);
            }}
          >
            <LogOut /> Revoke
          </Button>
        ),
    });
  return cols;
}

const IDLE_OPTIONS = [
  { value: "15", label: "15m" },
  { value: "30", label: "30m" },
  { value: "60", label: "1h" },
  { value: "240", label: "4h" },
  { value: "720", label: "12h" },
  { value: "1440", label: "24h" },
];

function idleText(min: number) {
  return min % 60 === 0 ? `${min / 60}h` : `${min}m`;
}

/** Client Area idle sign-out (tenant setting, D32): shown with the client count, editable with settings.write. */
function ClientIdle() {
  const cfg = useApi<{ client_idle_minutes: number; client_max_days: number; can_edit: boolean }>("/api/admin/settings/sessions");
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("1440");
  const [busy, setBusy] = React.useState(false);
  const d = cfg.data;
  const save = async () => {
    setBusy(true);
    const r = await sendJson(`/api/admin/settings/sessions`, { client_idle_minutes: Number(value) }, "PUT");
    setBusy(false);
    if (!r.ok) return toast.error("Couldn't save", { description: r.error.message });
    toast.success(`Clients are signed out after ${idleText(Number(value))} idle`, { description: "Applies to every Client Area session now. Logged to the audit trail." });
    setOpen(false);
    cfg.reload();
  };
  return (
    <div className="flex items-center gap-2 text-[11.5px] text-fg-3">
      <span>{d ? `${idleText(d.client_idle_minutes)} idle timeout · ${d.client_max_days} days max` : "Idle timeout · 7 days max"}</span>
      {d?.can_edit && (
        <button
          className="text-ember hover:underline"
          onClick={() => {
            setValue(IDLE_OPTIONS.some((o) => o.value === String(d.client_idle_minutes)) ? String(d.client_idle_minutes) : "1440");
            setOpen(true);
          }}
        >
          Change
        </button>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Client idle sign-out"
        description="Client Area sessions end after this long without activity. Clients see a one-minute warning first."
        width={460}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="ember" disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <Segmented size="sm" value={value} onChange={setValue} options={IDLE_OPTIONS} />
      </Dialog>
    </div>
  );
}

export function LiveSessions() {
  const now = useNow();
  const canRevoke = useCan("sessions.revoke");
  const [kind, setKind] = React.useState<"staff" | "user">("staff");
  const [page, setPage] = React.useState(1);
  const [revoking, setRevoking] = React.useState<Session | null>(null);
  const per = 50;
  const staff = useApi<SessionsPage>(`/api/admin/sessions${qs({ kind: "staff", per_page: kind === "staff" ? per : 1, page: kind === "staff" ? page : 1 })}`, { refreshMs: 30_000 });
  const users = useApi<SessionsPage>(`/api/admin/sessions${qs({ kind: "user", per_page: kind === "user" ? per : 1, page: kind === "user" ? page : 1 })}`, { refreshMs: 30_000 });
  const cur = kind === "staff" ? staff : users;
  const reload = () => (staff.reload(), users.reload());

  return (
    <div className="pb-10">
      <PageHeader
        title="Sessions"
        subtitle="Everyone signed in right now: staff in the Back Office and clients in the Client Area"
        actions={
          <Button variant="surface" onClick={reload}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      <Reveal>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="k-row px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Staff signed in</div>
            <div className="k-num mt-1 text-[20px] font-medium">{staff.data?.total ?? "—"}</div>
            <div className="text-[11.5px] text-fg-3">2h idle timeout · 12h max</div>
          </div>
          <div className="k-row px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Clients signed in</div>
            <div className="k-num mt-1 text-[20px] font-medium">{users.data?.total ?? "—"}</div>
            <ClientIdle />
          </div>
          <div className="k-row px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Revoking</div>
            <div className="mt-1 text-[14px] font-medium">{canRevoke ? "Allowed for your role" : "Not allowed for your role"}</div>
            <div className="text-[11.5px] text-fg-3">Every revoke is written to the audit log</div>
          </div>
        </div>
      </Reveal>
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title="Active sessions"
            subtitle="Session ids are short fingerprints of the stored token hash; tokens are never stored or shown"
            icon={kind === "staff" ? <ShieldCheck /> : <Users />}
          />
          <div className="px-4 pb-5 pt-4 sm:px-6">
            <Tabs
              className="mb-4"
              value={kind}
              onChange={(v) => {
                setKind(v);
                setPage(1);
              }}
              tabs={[
                { value: "staff", label: "Staff", count: staff.data?.total },
                { value: "user", label: "Clients", count: users.data?.total },
              ]}
            />
            {cur.error ? (
              <ErrorState error={cur.error} onRetry={cur.reload} />
            ) : !cur.data || cur.data.per_page !== per ? (
              <TableSkeleton rows={4} />
            ) : (
              <>
                <DataTable
                  rows={cur.data.items}
                  pageSize={per}
                  rowKey={(s) => String(s.id)}
                  columns={sessionColumns({ now, canRevoke, onRevoke: setRevoking, showSubject: true })}
                  empty={<EmptyState title={kind === "staff" ? "No staff signed in" : "No clients signed in"} text="Active sessions appear here as soon as someone signs in." illustration="locked" />}
                />
                <Pager page={cur.data.page} perPage={cur.data.per_page} total={cur.data.total} onPage={setPage} />
              </>
            )}
          </div>
        </Card>
      </Reveal>
      <RevokeDialog session={revoking} onClose={() => setRevoking(null)} onDone={reload} />
    </div>
  );
}
