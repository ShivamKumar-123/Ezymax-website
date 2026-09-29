"use client";

import * as React from "react";
import Link from "next/link";
import { Clock, Download, Eye, FileArchive, History, KeyRound, LogOut, MailCheck, MonitorSmartphone, ShieldCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, EmptyState, Field, Flag, PageHeader, Skeleton, type ChipTone, type Column } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
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

// Sign-in event labels: security.result.<code>
const RESULT: Record<string, { tone: ChipTone }> = {
  success: { tone: "up" },
  new_device: { tone: "up" },
  verified: { tone: "up" },
  google: { tone: "up" },
  code_sent: { tone: "info" },
  failed: { tone: "down" },
  locked: { tone: "down" },
  logout: { tone: "neutral" },
  password_reset: { tone: "warn" },
  signed_out_device: { tone: "neutral" },
  signed_out_by_staff: { tone: "warn" },
  staff_access: { tone: "info" },
};

function ErrorLine({ error, onRetry }: { error: SecError; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-surface-2 px-4 py-3 text-[13px]">
      <span className="text-fg-2">{error.message}</span>
      <Button size="sm" variant="surface" onClick={onRetry}>
        {t("security.retry")}
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
      <span dir="ltr" className="truncate font-mono text-[12px] text-fg-2">{ip ?? "—"}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Active sessions                                                     */
/* ------------------------------------------------------------------ */

function SessionsCard({ page, error, reload }: { page: SessionsPage | null; error: SecError | null; reload: () => void }) {
  const t = useT();
  const [confirmAll, setConfirmAll] = React.useState(false);
  const [busy, setBusy] = React.useState<number | "all" | null>(null);
  const now = Date.now();
  const others = page?.items.filter((s) => !s.current).length ?? 0;

  const revoke = async (s: SessionRow) => {
    setBusy(s.id);
    const r = await secApi(`sessions/${s.id}/revoke`, { body: {} });
    setBusy(null);
    if (!r.ok) return toast.error(t("security.sessions.revokeFailed"), { description: r.error.message });
    const d = parseDevice(s.user_agent);
    toast.success(t("security.sessions.revoked"), { description: s.viewer ? t("security.sessions.viewerLogin", { label: s.viewer.label ?? t("security.sessions.viewer") }) : t("security.device.on", { browser: d.browser, os: d.os }) });
    reload();
  };
  const revokeAll = async () => {
    setBusy("all");
    const r = await secApi<{ revoked: number }>("sessions/revoke-others", { body: {} });
    setBusy(null);
    setConfirmAll(false);
    if (!r.ok) return toast.error(t("security.sessions.revokeAllFailed"), { description: r.error.message });
    toast.success(r.data.revoked ? t("security.sessions.revokedAll", { count: r.data.revoked }) : t("security.sessions.noneOther"));
    reload();
  };

  const cols: Column<SessionRow>[] = [
    {
      key: "device",
      header: t("security.col.device"),
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
                  {t("security.device.on", { browser: d.browser, os: d.os })}
                </span>
                {s.current && (
                  <Chip size="sm" tone="up" dot>
                    {t("security.sessions.thisDevice")}
                  </Chip>
                )}
                {s.viewer && (
                  <Chip size="sm" tone="info">
                    <Eye className="size-3" /> {s.viewer.label ?? t("security.sessions.viewOnly")}
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
    { key: "place", header: t("security.col.place"), hideOn: "md", cell: (s) => <Place ip={s.ip} country={s.country} /> },
    { key: "since", header: t("security.col.signedIn"), hideOn: "lg", cell: (s) => <span className="k-num text-fg-2">{when(s.created_at)}</span> },
    { key: "last", header: t("security.col.lastActive"), cell: (s) => <span className="k-num text-fg-2" title={when(s.last_seen_at, true)}>{s.current ? t("security.sessions.now") : ago(s.last_seen_at, now)}</span> },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (s) =>
        s.current ? (
          <span className="text-[11.5px] text-fg-3">{t("security.sessions.current")}</span>
        ) : (
          <Button size="xs" variant="ghost" disabled={busy !== null} onClick={() => void revoke(s)} aria-label={t("security.sessions.signOutAria", { id: s.id })}>
            {busy === s.id ? t("security.signingOut") : t("security.signOut")}
          </Button>
        ),
    },
  ];

  return (
    <Card>
      <CardHeader
        title={t("security.sessions.title")}
        subtitle={page ? t("security.sessions.policy", { idle: idleLabel(page.idle_minutes), days: page.max_days }) : t("security.sessions.subtitle")}
        icon={<MonitorSmartphone />}
        action={
          <Button size="sm" variant="down-outline" disabled={!others || busy !== null} onClick={() => setConfirmAll(true)}>
            <LogOut /> {t("security.sessions.signOutOthers")}
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
        title={t("security.sessions.confirmTitle")}
        description={t("security.sessions.confirmText", { count: others })}
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmAll(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="sell" disabled={busy === "all"} onClick={() => void revokeAll()}>
              {busy === "all" ? t("security.signingOut") : t("security.sessions.signOutOthersShort")}
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-fg-2">{t("security.sessions.confirmHint")}</p>
      </Dialog>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Login history                                                        */
/* ------------------------------------------------------------------ */

function LoginHistory() {
  const t = useT();
  const broker = useSession().tenant.name;
  const { data, error, reload } = useSec<{ items: LoginRow[] }>("logins");
  const resultLabel = (r: string) => (RESULT[r] ? t.dyn(`security.result.${r}`, r, { broker }) : r);
  const cols: Column<LoginRow>[] = [
    { key: "at", header: t("security.col.time"), sort: (r) => r.at, csv: (r) => r.at, cell: (r) => <span className="k-num whitespace-nowrap text-fg-2">{when(r.at, true)}</span> },
    {
      key: "result",
      header: t("security.col.event"),
      csv: (r) => resultLabel(r.result),
      cell: (r) => {
        const x = { tone: RESULT[r.result]?.tone ?? ("neutral" as ChipTone), label: resultLabel(r.result) };
        return (
          <Chip size="sm" tone={x.tone} dot>
            {x.label}
          </Chip>
        );
      },
    },
    {
      key: "device",
      header: t("security.col.device"),
      hideOn: "md",
      csv: (r) => {
        const d = parseDevice(r.user_agent);
        return t("security.device.on", { browser: d.browser, os: d.os });
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
    { key: "place", header: t("security.col.place"), csv: (r) => `${r.country ?? ""} ${r.ip ?? ""}`.trim(), cell: (r) => <Place ip={r.ip} country={r.country} /> },
  ];
  return (
    <Card>
      <CardHeader title={t("security.history.title")} subtitle={t("security.history.subtitle")} icon={<History />} />
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
            empty={<EmptyState title={t("security.history.empty")} illustration="calendar" className="py-6" />}
          />
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Closure and data export (D94)                                        */
/* ------------------------------------------------------------------ */

const REQ_STATUS = {
  open: { tone: "warn", labelKey: "security.reqStatus.open" },
  in_progress: { tone: "info", labelKey: "security.reqStatus.inProgress" },
  completed: { tone: "up", labelKey: "security.reqStatus.completed" },
  rejected: { tone: "down", labelKey: "security.reqStatus.rejected" },
  cancelled: { tone: "neutral", labelKey: "security.reqStatus.cancelled" },
} as const satisfies Record<ClientRequest["status"], { tone: ChipTone; labelKey: string }>;

function DataRequests() {
  const t = useT();
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
    if (!r.ok) return toast.error(t("security.requests.sendFailed"), { description: r.error.message });
    toast.success(ask === "closure" ? t("security.requests.closureSent") : t("security.requests.exportSent"), { description: t("security.requests.sentText") });
    setAsk(null);
    setReason("");
    reload();
  };
  const cancel = async (id: number) => {
    const r = await secApi(`requests/${id}/cancel`, { body: {} });
    if (!r.ok) return toast.error(t("security.requests.cancelFailed"), { description: r.error.message });
    toast.success(t("security.requests.cancelled"));
    reload();
  };

  return (
    <Card>
      <CardHeader title={t("security.requests.title")} subtitle={t("security.requests.subtitle")} icon={<FileArchive />} />
      <div className="space-y-4 px-4 pb-6 pt-3 sm:px-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-[14px] border border-line bg-surface-2 p-4">
            <div className="flex items-center gap-2 text-[13.5px] font-medium">
              <Download className="size-4 text-fg-3" /> {t("security.requests.exportTitle")}
            </div>
            <p className="mt-1 text-[12.5px] text-fg-3">{t("security.requests.exportText")}</p>
            <Button size="sm" variant="surface" className="mt-3" disabled={!!pending("data_export") || !data} onClick={() => setAsk("data_export")}>
              {pending("data_export") ? t("security.requests.exportPending") : t("security.requests.exportButton")}
            </Button>
          </div>
          <div className="rounded-[14px] border border-line bg-surface-2 p-4">
            <div className="flex items-center gap-2 text-[13.5px] font-medium">
              <UserX className="size-4 text-fg-3" /> {t("security.requests.closureTitle")}
            </div>
            <p className="mt-1 text-[12.5px] text-fg-3">{t("security.requests.closureText")}</p>
            <Button size="sm" variant="down-outline" className="mt-3" disabled={!!pending("closure") || !data} onClick={() => setAsk("closure")}>
              {pending("closure") ? t("security.requests.closurePending") : t("security.requests.closureButton")}
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
                    {r.kind === "closure" ? t("security.requests.kindClosure") : t("security.requests.kindExport")}
                    <Chip size="sm" tone={REQ_STATUS[r.status]?.tone ?? "neutral"} dot>
                      {REQ_STATUS[r.status] ? t(REQ_STATUS[r.status].labelKey) : r.status}
                    </Chip>
                  </div>
                  <div className="mt-0.5 text-[12px] text-fg-3">
                    {t("security.requests.requested", { date: day(r.created_at) })}
                    {r.closed_at ? ` · ${t("security.requests.closed", { date: day(r.closed_at) })}` : ""}
                    {r.staff_note ? ` · ${r.staff_note}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.kind === "data_export" && r.status === "completed" && (
                    <a href={`/api/security/requests/${r.id}/export`} download>
                      <Button size="xs" variant="surface">
                        <Download /> {t("security.requests.download")}
                      </Button>
                    </a>
                  )}
                  {r.status === "open" && (
                    <Button size="xs" variant="ghost" onClick={() => void cancel(r.id)}>
                      {t("common.cancel")}
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
        title={ask === "closure" ? t("security.requests.closureDialogTitle") : t("security.requests.exportDialogTitle")}
        description={ask === "closure" ? t("security.requests.closureDialogText") : t("security.requests.exportDialogText")}
        width={480}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsk(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant={ask === "closure" ? "sell" : "ember"} disabled={busy} onClick={() => void submit()}>
              {busy ? t("security.requests.sending") : t("security.requests.send")}
            </Button>
          </>
        }
      >
        <Field label={ask === "closure" ? t("security.requests.reasonClosure") : t("security.requests.reasonExport")}>
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
  const t = useT();
  const me = useSession();
  const sessions = useSec<SessionsPage>("sessions", 30_000);
  const idle = sessions.data?.idle_minutes ?? me.session?.idle_minutes;
  const active = sessions.data?.items.length ?? 0;
  const facts: [React.ReactNode, React.ReactNode, React.ReactNode][] = [
    [<KeyRound key="i" />, t("security.protect.password"), <Chip key="c" size="sm" tone="up">{t("security.protect.on")}</Chip>],
    [<MailCheck key="i" />, t("security.protect.newDevice"), <Chip key="c" size="sm" tone="up">{t("security.protect.on")}</Chip>],
    [<ShieldCheck key="i" />, t("security.protect.sensitive"), <Chip key="c" size="sm" tone="up">{t("security.protect.on")}</Chip>],
    [<Clock key="i" />, t("security.protect.idle"), <span key="c" className="k-num text-fg">{idle ? idleLabel(idle) : "—"}</span>],
    [<MonitorSmartphone key="i" />, t("security.sessions.title"), <span key="c" className="k-num text-fg">{sessions.data ? active : "—"}</span>],
  ];
  return (
    <div className="space-y-4 pb-16">
      <PageHeader title={t("security.page.title")} subtitle={t("security.page.subtitle")} actions={<Link href="/profile/viewers"><Button variant="surface"><Eye /> {t("security.viewerBar.title")}</Button></Link>} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="h-full">
          <CardHeader title={t("security.protect.title")} subtitle={me.email} icon={<ShieldCheck />} />
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
              toast(t("security.resetSigningOut"));
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
