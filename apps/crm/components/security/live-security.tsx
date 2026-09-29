"use client";

import * as React from "react";
import Link from "next/link";
import { Clock, Download, Eye, FileArchive, History, KeyRound, LogOut, MailCheck, MonitorSmartphone, ShieldCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, EmptyState, Field, Flag, PageHeader, Skeleton, type ChipTone, type Column } from "@kalks/ui";
import { ChangePasswordCard } from "@/components/profile/change-password";
import { useSession } from "@/components/session";
import { DeviceIcon, ago, countryName, day, idleLabel, parseDevice, secApi, useSec, when, type SecError } from "./common";

type SessionRow = {
  id: number;
  current: boolean;
  ip: string | null;
  user_agent: string | null;
  country: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  viewer: { id: number; label: string | null } | null;
};
type SessionsPage = { items: SessionRow[]; idle_minutes: number; max_days: number };

type LoginRow = { id: number; at: string; result: string; ip: string | null; user_agent: string | null; country: string | null };

type ClientRequest = {
  id: number;
  kind: "closure" | "data_export";
  status: "open" | "in_progress" | "completed" | "rejected" | "cancelled";
  reason: string | null;
  staff_note: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

const RESULT: Record<string, { tone: ChipTone; label: string }> = {
  success: { tone: "up", label: "Signed in" },
  new_device: { tone: "up", label: "New device · code" },
  verified: { tone: "up", label: "Email verified" },
  google: { tone: "up", label: "Google" },
  code_sent: { tone: "info", label: "Code sent" },
  failed: { tone: "down", label: "Wrong password" },
  locked: { tone: "down", label: "Locked" },
  logout: { tone: "neutral", label: "Signed out" },
  password_reset: { tone: "warn", label: "Password reset" },
  signed_out_device: { tone: "neutral", label: "Device signed out" },
  signed_out_by_staff: { tone: "warn", label: "Signed out by support" },
};

function ErrorLine({ error, onRetry }: { error: SecError; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-surface-2 px-4 py-3 text-[13px]">
      <span className="text-fg-2">{error.message}</span>
      <Button size="sm" variant="surface" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function Place({ ip, country }: { ip: string | null; country: string | null }) {
  const name = countryName(country);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {country && <Flag country={country} className="size-3.5 shrink-0" />}
      {name && <span className="truncate">{name}</span>}
      {name && <span className="text-fg-3">·</span>}
      <span className="truncate font-mono text-[12px] text-fg-2">{ip ?? "—"}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Active sessions                                                     */
/* ------------------------------------------------------------------ */

function SessionsCard({ page, error, reload }: { page: SessionsPage | null; error: SecError | null; reload: () => void }) {
  const [confirmAll, setConfirmAll] = React.useState(false);
  const [busy, setBusy] = React.useState<number | "all" | null>(null);
  const now = Date.now();
  const others = page?.items.filter((s) => !s.current).length ?? 0;

  const revoke = async (s: SessionRow) => {
    setBusy(s.id);
    const r = await secApi(`sessions/${s.id}/revoke`, { body: {} });
    setBusy(null);
    if (!r.ok) return toast.error("Couldn't sign that device out", { description: r.error.message });
    const d = parseDevice(s.user_agent);
    toast.success("Device signed out", { description: s.viewer ? `View-only login “${s.viewer.label ?? "viewer"}”` : `${d.browser} on ${d.os}` });
    reload();
  };
  const revokeAll = async () => {
    setBusy("all");
    const r = await secApi<{ revoked: number }>("sessions/revoke-others", { body: {} });
    setBusy(null);
    setConfirmAll(false);
    if (!r.ok) return toast.error("Couldn't sign the other devices out", { description: r.error.message });
    toast.success(r.data.revoked ? `Signed out of ${r.data.revoked} other session${r.data.revoked === 1 ? "" : "s"}` : "No other sessions were active");
    reload();
  };

  const cols: Column<SessionRow>[] = [
    {
      key: "device",
      header: "Device",
      cell: (s) => {
        const d = parseDevice(s.user_agent);
        return (
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2">
              <DeviceIcon kind={d.kind} className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
                <span className="truncate">
                  {d.browser} on {d.os}
                </span>
                {s.current && (
                  <Chip size="sm" tone="up" dot>
                    This device
                  </Chip>
                )}
                {s.viewer && (
                  <Chip size="sm" tone="info">
                    <Eye className="size-3" /> {s.viewer.label ?? "View-only"}
                  </Chip>
                )}
              </div>
              <div className="mt-0.5 text-[11.5px] text-fg-3 md:hidden">
                <Place ip={s.ip} country={s.country} />
              </div>
            </div>
          </div>
        );
      },
    },
    { key: "place", header: "Location · IP", hideOn: "md", cell: (s) => <Place ip={s.ip} country={s.country} /> },
    { key: "since", header: "Signed in", hideOn: "lg", cell: (s) => <span className="k-num text-fg-2">{when(s.created_at)}</span> },
    { key: "last", header: "Last active", cell: (s) => <span className="k-num text-fg-2" title={when(s.last_seen_at, true)}>{s.current ? "Now" : ago(s.last_seen_at, now)}</span> },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (s) =>
        s.current ? (
          <span className="text-[11.5px] text-fg-3">Current</span>
        ) : (
          <Button size="xs" variant="ghost" disabled={busy !== null} onClick={() => void revoke(s)} aria-label={`Sign out session ${s.id}`}>
            {busy === s.id ? "Signing out…" : "Sign out"}
          </Button>
        ),
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Active sessions"
        subtitle={page ? `Signed out after ${idleLabel(page.idle_minutes)} without activity, and after ${page.max_days} days at most.` : "Devices signed in to your account"}
        icon={<MonitorSmartphone />}
        action={
          <Button size="sm" variant="down-outline" disabled={!others || busy !== null} onClick={() => setConfirmAll(true)}>
            <LogOut /> Sign out other devices
          </Button>
        }
      />
      <div className="px-4 pb-5 pt-3 sm:px-6">
        {error ? (
          <ErrorLine error={error} onRetry={reload} />
        ) : !page ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <DataTable rows={page.items} rowKey={(s) => String(s.id)} columns={cols} dense pageSize={10} />
        )}
      </div>
      <Dialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Sign out other devices?"
        description={`${others} other session${others === 1 ? "" : "s"} will end at once, including view-only logins that are signed in. This device stays signed in.`}
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmAll(false)}>
              Cancel
            </Button>
            <Button variant="sell" disabled={busy === "all"} onClick={() => void revokeAll()}>
              {busy === "all" ? "Signing out…" : "Sign out others"}
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-fg-2">If you don't recognise a device, change your password too.</p>
      </Dialog>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Login history                                                        */
/* ------------------------------------------------------------------ */

function LoginHistory() {
  const { data, error, reload } = useSec<{ items: LoginRow[] }>("logins");
  const cols: Column<LoginRow>[] = [
    { key: "at", header: "Time", sort: (r) => r.at, csv: (r) => r.at, cell: (r) => <span className="k-num whitespace-nowrap text-fg-2">{when(r.at, true)}</span> },
    {
      key: "result",
      header: "Event",
      csv: (r) => RESULT[r.result]?.label ?? r.result,
      cell: (r) => {
        const x = RESULT[r.result] ?? { tone: "neutral" as ChipTone, label: r.result };
        return (
          <Chip size="sm" tone={x.tone} dot>
            {x.label}
          </Chip>
        );
      },
    },
    {
      key: "device",
      header: "Device",
      hideOn: "md",
      csv: (r) => {
        const d = parseDevice(r.user_agent);
        return `${d.browser} on ${d.os}`;
      },
      cell: (r) => {
        const d = parseDevice(r.user_agent);
        return (
          <span className="text-fg-2">
            {d.browser} · {d.os}
          </span>
        );
      },
    },
    { key: "place", header: "Location · IP", csv: (r) => `${r.country ?? ""} ${r.ip ?? ""}`.trim(), cell: (r) => <Place ip={r.ip} country={r.country} /> },
  ];
  return (
    <Card>
      <CardHeader title="Sign-in history" subtitle="Last 90 days: sign-ins, failed attempts and signed-out devices" icon={<History />} />
      <div className="px-4 pb-5 pt-3 sm:px-6">
        {error ? (
          <ErrorLine error={error} onRetry={reload} />
        ) : !data ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <DataTable
            rows={data.items}
            rowKey={(r) => String(r.id)}
            columns={cols}
            dense
            pageSize={12}
            exportName="sign-in-history"
            empty={<EmptyState title="No sign-ins yet" illustration="calendar" className="py-6" />}
          />
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Closure and data export (D94)                                        */
/* ------------------------------------------------------------------ */

const REQ_STATUS: Record<ClientRequest["status"], { tone: ChipTone; label: string }> = {
  open: { tone: "warn", label: "Received" },
  in_progress: { tone: "info", label: "In progress" },
  completed: { tone: "up", label: "Completed" },
  rejected: { tone: "down", label: "Declined" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

function DataRequests() {
  const { data, error, reload } = useSec<{ items: ClientRequest[] }>("requests");
  const [ask, setAsk] = React.useState<ClientRequest["kind"] | null>(null);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const pending = (k: ClientRequest["kind"]) => data?.items.some((r) => r.kind === k && (r.status === "open" || r.status === "in_progress"));

  const submit = async () => {
    if (!ask) return;
    setBusy(true);
    const r = await secApi("requests", { body: { kind: ask, reason: reason.trim() || undefined } });
    setBusy(false);
    if (!r.ok) return toast.error("Couldn't send the request", { description: r.error.message });
    toast.success(ask === "closure" ? "Closure request sent" : "Data export requested", { description: "Our team will email you when it's processed." });
    setAsk(null);
    setReason("");
    reload();
  };
  const cancel = async (id: number) => {
    const r = await secApi(`requests/${id}/cancel`, { body: {} });
    if (!r.ok) return toast.error("Couldn't cancel", { description: r.error.message });
    toast.success("Request cancelled");
    reload();
  };

  return (
    <Card>
      <CardHeader title="Your data and account" subtitle="Request a copy of your personal data or the closure of your account" icon={<FileArchive />} />
      <div className="space-y-4 px-4 pb-6 pt-3 sm:px-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-[14px] border border-line bg-surface-2 p-4">
            <div className="flex items-center gap-2 text-[13.5px] font-medium">
              <Download className="size-4 text-fg-3" /> Export my data
            </div>
            <p className="mt-1 text-[12.5px] text-fg-3">Your profile, sign-in activity, verification status and settings as a JSON file, once our team has prepared it.</p>
            <Button size="sm" variant="surface" className="mt-3" disabled={!!pending("data_export") || !data} onClick={() => setAsk("data_export")}>
              {pending("data_export") ? "Export requested" : "Request export"}
            </Button>
          </div>
          <div className="rounded-[14px] border border-line bg-surface-2 p-4">
            <div className="flex items-center gap-2 text-[13.5px] font-medium">
              <UserX className="size-4 text-fg-3" /> Close my account
            </div>
            <p className="mt-1 text-[12.5px] text-fg-3">Our team closes your account after open positions are closed and funds are withdrawn. Records are kept as regulation requires.</p>
            <Button size="sm" variant="down-outline" className="mt-3" disabled={!!pending("closure") || !data} onClick={() => setAsk("closure")}>
              {pending("closure") ? "Closure requested" : "Request closure"}
            </Button>
          </div>
        </div>
        {error ? (
          <ErrorLine error={error} onRetry={reload} />
        ) : data && data.items.length > 0 ? (
          <div className="divide-y divide-line rounded-[14px] border border-line">
            {data.items.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {r.kind === "closure" ? "Account closure" : "Data export"}
                    <Chip size="sm" tone={REQ_STATUS[r.status].tone} dot>
                      {REQ_STATUS[r.status].label}
                    </Chip>
                  </div>
                  <div className="mt-0.5 text-[12px] text-fg-3">
                    Requested {day(r.created_at)}
                    {r.closed_at ? ` · closed ${day(r.closed_at)}` : ""}
                    {r.staff_note ? ` · ${r.staff_note}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.kind === "data_export" && r.status === "completed" && (
                    <a href={`/api/security/requests/${r.id}/export`} download>
                      <Button size="xs" variant="surface">
                        <Download /> Download
                      </Button>
                    </a>
                  )}
                  {r.status === "open" && (
                    <Button size="xs" variant="ghost" onClick={() => void cancel(r.id)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <Dialog
        open={!!ask}
        onOpenChange={(o) => !o && setAsk(null)}
        title={ask === "closure" ? "Request account closure" : "Request a data export"}
        description={ask === "closure" ? "Our team reviews the request and contacts you before anything is closed. You can cancel until they start." : "We prepare a file with the personal data we hold about you and let you know when it's ready to download here."}
        width={480}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsk(null)}>
              Cancel
            </Button>
            <Button variant={ask === "closure" ? "sell" : "ember"} disabled={busy} onClick={() => void submit()}>
              {busy ? "Sending…" : "Send request"}
            </Button>
          </>
        }
      >
        <Field label={ask === "closure" ? "Why are you leaving? (optional)" : "Anything we should know? (optional)"}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 1000))}
            rows={3}
            className="w-full resize-none rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[13.5px] outline-none focus:border-ember/60"
          />
        </Field>
      </Dialog>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

async function resetPassword() {
  await fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {});
  window.location.assign("/forgot");
}

export function LiveSecurity() {
  const me = useSession();
  const sessions = useSec<SessionsPage>("sessions", 30_000);
  const idle = sessions.data?.idle_minutes ?? me.session?.idle_minutes;
  const active = sessions.data?.items.length ?? 0;
  const facts: [React.ReactNode, React.ReactNode, React.ReactNode][] = [
    [<KeyRound key="i" />, "Password sign-in", <Chip key="c" size="sm" tone="up">On</Chip>],
    [<MailCheck key="i" />, "Email code for new devices", <Chip key="c" size="sm" tone="up">On</Chip>],
    [<ShieldCheck key="i" />, "Email code for sensitive changes", <Chip key="c" size="sm" tone="up">On</Chip>],
    [<Clock key="i" />, "Auto sign-out when idle", <span key="c" className="k-num text-fg">{idle ? idleLabel(idle) : "—"}</span>],
    [<MonitorSmartphone key="i" />, "Active sessions", <span key="c" className="k-num text-fg">{sessions.data ? active : "—"}</span>],
  ];
  return (
    <div className="space-y-4 pb-16">
      <PageHeader title="Security" subtitle="Your password, the devices signed in to your account and your sign-in history." actions={<Link href="/profile/viewers"><Button variant="surface"><Eye /> View-only access</Button></Link>} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="h-full">
          <CardHeader title="Sign-in protection" subtitle={me.email} icon={<ShieldCheck />} />
          <div className="px-6 pb-5 pt-2">
            {facts.map(([icon, label, value], i) => (
              <div key={i} className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-[13px] last:border-0">
                <span className="flex items-center gap-2.5 text-fg-2 [&_svg]:size-4 [&_svg]:text-fg-3">
                  {icon}
                  {label}
                </span>
                {value}
              </div>
            ))}
          </div>
        </Card>
        <div className="xl:col-span-2">
          <ChangePasswordCard
            onForgot={() => {
              toast("Signing you out to reset your password…");
              void resetPassword();
            }}
          />
        </div>
      </div>
      <SessionsCard page={sessions.data} error={sessions.error} reload={sessions.reload} />
      <LoginHistory />
      <DataRequests />
    </div>
  );
}
