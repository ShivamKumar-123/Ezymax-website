"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Eye, KeyRound, Pencil, Plus, ShieldOff, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, CopyButton, DataTable, Dialog, EmptyState, Field, Input, PageHeader, Skeleton, useBrand, type ChipTone, type Column } from "@kalks/ui";
import type { T } from "@kalks/i18n";
import { useT } from "@kalks/i18n/react";
import { FormError } from "@/components/auth";
import { StepUpDialog } from "@/components/stepup";
import { useAccounts } from "@/components/trading/api";
import { VIEWER_SECTIONS, VIEWER_SECTION_KEYS, type ViewerScope, type ViewerSection } from "@/lib/viewer";
import { ago, day, deviceName, parseDevice, secApi, useSec, when, type SecError } from "./common";

type Activity = { id: number; viewer_id: number | null; label: string | null; action: string; path: string | null; ip: string | null; user_agent: string | null; at: string };
type ViewersPage = { items: ViewerScope[]; activity: Activity[]; max: number };

const STATUS = {
  active: { tone: "up", labelKey: "security.viewerStatus.active" },
  expired: { tone: "neutral", labelKey: "security.viewerStatus.expired" },
  revoked: { tone: "down", labelKey: "security.viewerStatus.revoked" },
} as const satisfies Record<ViewerScope["status"], { tone: ChipTone; labelKey: string }>;

// Activity labels: security.activity.<action without "viewer.">
const ACTIVITY = new Set(["viewer.login", "viewer.logout", "viewer.login_failed", "viewer.locked", "viewer.login_blocked", "viewer.page_view", "viewer.created", "viewer.updated", "viewer.password_reset", "viewer.revoked"]);
const activityLabel = (t: T, action: string) => (ACTIVITY.has(action) ? t.dyn(`security.activity.${action.slice(7)}`, action) : action);

const PAGE_NAMES = [
  ["/portfolio/history", "security.page.tradeHistory"],
  ["/portfolio/ledger", "security.page.ledger"],
  ["/portfolio/statements", "security.page.statements"],
  ["/portfolio/analytics", "security.page.analytics"],
  ["/portfolio", "security.page.portfolio"],
  ["/accounts/", "security.page.account"],
  ["/accounts", "security.page.accounts"],
  ["/wallet/history", "security.page.walletHistory"],
  ["/wallet", "security.page.wallet"],
  ["/partner", "security.page.partner"],
  ["/markets", "security.page.markets"],
  ["/news", "security.page.news"],
  ["/calendar", "security.page.calendar"],
] as const;

function pageName(t: T, path: string | null): string {
  if (!path) return "";
  if (path === "/") return t("security.page.dashboard");
  const hit = PAGE_NAMES.find(([p]) => path.startsWith(p));
  if (!hit) return path;
  return hit[1] === "security.page.account" ? t("security.page.account", { n: path.split("/")[2] ?? "" }) : t(hit[1]);
}

/** Viewer section name and hint (definitions in lib/viewer stay English for the server). */
const sectionLabel = (t: T, k: ViewerSection) => t.dyn(`security.section.${k}.label`, VIEWER_SECTIONS[k]?.label ?? k);
const sectionHint = (t: T, k: ViewerSection) => t.dyn(`security.section.${k}.hint`, VIEWER_SECTIONS[k]?.hint ?? "");

/** yyyy-mm-dd (local) for the date input; the login then ends at the end of that day (local time). */
const toDateInput = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA") : "");
const fromDateInput = (v: string) => (v ? new Date(`${v}T23:59:59`).toISOString() : null);

type Draft = { label: string; username: string; accounts: string[]; sections: ViewerSection[]; expires: string };

function ViewerForm({ draft, set, editing, errors }: { draft: Draft; set: (d: Partial<Draft>) => void; editing: boolean; errors: Record<string, string> }) {
  const t = useT();
  const accounts = useAccounts(0);
  const list = accounts.data?.accounts ?? [];
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const today = new Date().toLocaleDateString("en-CA");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("security.form.name")} error={errors.label}>
          <Input leading={<UserRound />} value={draft.label} onChange={(e) => set({ label: e.target.value.slice(0, 60) })} placeholder={t("security.form.namePlaceholder")} />
        </Field>
        <Field label={t("security.form.expires")} error={errors.expires_at}>
          <Input type="date" leading={<CalendarDays />} min={today} value={draft.expires} onChange={(e) => set({ expires: e.target.value })} />
        </Field>
      </div>
      {!editing && (
        <Field label={t("security.form.viewerId")} error={errors.username} hint={<span className="text-fg-3">{t("security.form.viewerIdHint")}</span>}>
          <Input dir="ltr" className="font-mono" value={draft.username} onChange={(e) => set({ username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 32) })} placeholder={t("security.form.viewerIdPlaceholder")} autoComplete="off" />
        </Field>
      )}
      <Field label={t("security.form.accounts")} error={errors.accounts}>
        {accounts.loading ? (
          <Skeleton className="h-10 w-full" />
        ) : list.length === 0 ? (
          <p className="text-[12.5px] text-fg-3">{t("security.form.noAccounts")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {list.map((a) => {
              const login = String(a.login);
              return (
                <label key={login} className="flex cursor-pointer items-center gap-2.5 rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[13px] hover:border-fg-3">
                  <input type="checkbox" className="accent-[var(--k-ember)]" checked={draft.accounts.includes(login)} onChange={() => set({ accounts: toggle(draft.accounts, login) })} />
                  <span className="font-mono">#{login}</span>
                  <span className="truncate text-fg-3">
                    {a.type === "demo" ? t("security.form.demo") : t("security.form.live")} · {a.groupName}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </Field>
      <Field label={t("security.form.sections")} error={errors.sections}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {VIEWER_SECTION_KEYS.map((k) => (
            <label key={k} className="flex cursor-pointer items-start gap-2.5 rounded-[12px] border border-line bg-surface-2 px-3 py-2 hover:border-fg-3">
              <input type="checkbox" className="mt-0.5 accent-[var(--k-ember)]" checked={draft.sections.includes(k)} onChange={() => set({ sections: toggle(draft.sections, k) })} />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{sectionLabel(t, k)}</span>
                <span className="block text-[11.5px] text-fg-3">{sectionHint(t, k)}</span>
              </span>
            </label>
          ))}
        </div>
      </Field>
      <p className="flex items-start gap-2 rounded-[12px] border border-line bg-surface-2 px-3 py-2.5 text-[12px] text-fg-3">
        <Eye className="mt-0.5 size-3.5 shrink-0" />
        {t("security.form.note")}
      </p>
    </div>
  );
}

function Credentials({ creds, onClose }: { creds: { username: string; password: string; label: string } | null; onClose: () => void }) {
  const t = useT();
  const url = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";
  return (
    <Dialog
      open={!!creds}
      onOpenChange={(o) => !o && onClose()}
      title={t("security.creds.title")}
      description={creds ? t("security.creds.description", { label: creds.label }) : undefined}
      width={460}
      footer={
        <Button variant="ember" onClick={onClose}>
          {t("security.creds.saved")}
        </Button>
      }
    >
      {creds && (
        <div className="space-y-3 text-[13px]">
          {[
            ["sign-in-page", t("security.creds.page"), url],
            ["viewer-id", t("security.creds.viewerId"), creds.username],
            ["password", t("security.creds.password"), creds.password],
          ].map(([id, k, v]) => (
            <div key={id} className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-surface-2 px-3 py-2.5">
              <span className="shrink-0 text-fg-3">{k}</span>
              <span dir="ltr" className="flex min-w-0 items-center gap-1 font-mono">
                <span className="truncate" data-testid={`viewer-cred-${id}`}>
                  {v}
                </span>
                <CopyButton value={v!} label={k} />
              </span>
            </div>
          ))}
          <p className="flex items-start gap-2 text-[12px] text-warn">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {t("security.creds.warning")}
          </p>
        </div>
      )}
    </Dialog>
  );
}

const EMPTY: Draft = { label: "", username: "", accounts: [], sections: ["accounts", "history"], expires: "" };

export function LiveViewers() {
  const t = useT();
  const brand = useBrand()?.name ?? "Kalks";
  const { data, error, reload } = useSec<ViewersPage>("viewers");
  const [open, setOpen] = React.useState<"new" | ViewerScope | null>(null);
  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formErr, setFormErr] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<{ kind: "create" } | { kind: "password"; v: ViewerScope } | null>(null);
  const [revoking, setRevoking] = React.useState<ViewerScope | null>(null);
  const [creds, setCreds] = React.useState<{ username: string; password: string; label: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const now = Date.now();
  const active = data?.items.filter((v) => v.status === "active").length ?? 0;

  const set = (d: Partial<Draft>) => {
    setDraft((x) => ({ ...x, ...d }));
    setErrors({});
    setFormErr(null);
  };
  const startNew = () => {
    setDraft(EMPTY);
    setErrors({});
    setFormErr(null);
    setOpen("new");
  };
  const startEdit = (v: ViewerScope) => {
    setDraft({ label: v.label, username: v.username, accounts: v.accounts, sections: v.sections, expires: toDateInput(v.expires_at) });
    setErrors({});
    setFormErr(null);
    setOpen(v);
  };
  const localCheck = (): boolean => {
    const e: Record<string, string> = {};
    if (!draft.label.trim()) e.label = t("security.form.errName");
    if (draft.sections.length === 0) e.sections = t("security.form.errSections");
    if (draft.username && !/^[a-z0-9][a-z0-9._-]{3,31}$/.test(draft.username)) e.username = t("security.form.errUsername");
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const failed = (err: SecError) => {
    if (err.field) setErrors({ [err.field]: err.message });
    else setFormErr(err.message);
  };

  const create = async (token: string) => {
    const r = await secApi<{ viewer: ViewerScope; password: string }>("viewers", {
      body: { label: draft.label.trim(), username: draft.username || undefined, accounts: draft.accounts, sections: draft.sections, expires_at: fromDateInput(draft.expires), stepup_token: token },
    });
    if (!r.ok) {
      failed(r.error);
      setOpen("new");
      return;
    }
    setOpen(null);
    setCreds({ username: r.data.viewer.username, password: r.data.password, label: r.data.viewer.label });
    reload();
  };

  const save = async (v: ViewerScope) => {
    if (!localCheck()) return;
    setBusy(true);
    const r = await secApi<{ viewer: ViewerScope }>(`viewers/${v.id}`, {
      method: "PATCH",
      body: { label: draft.label.trim(), accounts: draft.accounts, sections: draft.sections, expires_at: fromDateInput(draft.expires) },
    });
    setBusy(false);
    if (!r.ok) return failed(r.error);
    toast.success(t("security.viewers.updated"), { description: t("security.viewers.updatedText") });
    setOpen(null);
    reload();
  };

  const newPassword = async (v: ViewerScope, token: string) => {
    const r = await secApi<{ password: string; username: string }>(`viewers/${v.id}/password`, { body: { stepup_token: token } });
    if (!r.ok) return void toast.error(t("security.viewers.passwordFailed"), { description: r.error.message });
    setCreds({ username: r.data.username, password: r.data.password, label: v.label });
    reload();
  };

  const revoke = async (v: ViewerScope) => {
    setBusy(true);
    const r = await secApi(`viewers/${v.id}/revoke`, { body: {} });
    setBusy(false);
    setRevoking(null);
    if (!r.ok) return void toast.error(t("security.viewers.revokeFailed"), { description: r.error.message });
    toast.success(t("security.viewers.revoked", { label: v.label }), { description: t("security.viewers.revokedText") });
    reload();
  };

  const cols: Column<ViewerScope>[] = [
    {
      key: "who",
      header: t("security.viewers.colViewer"),
      cell: (v) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <span className="truncate">{v.label}</span>
            <Chip size="sm" tone={STATUS[v.status]?.tone ?? "neutral"} dot>
              {STATUS[v.status] ? t(STATUS[v.status].labelKey) : v.status}
            </Chip>
          </div>
          <div className="mt-0.5 flex items-center gap-1 font-mono text-[12px] text-fg-3">
            {v.username}
            <CopyButton value={v.username} label={t("security.creds.viewerId")} />
          </div>
        </div>
      ),
    },
    {
      key: "scope",
      header: t("security.viewers.colScope"),
      hideOn: "md",
      cell: (v) => (
        <div className="flex max-w-[360px] flex-wrap gap-1">
          {v.accounts.map((a) => (
            <Chip key={a} size="sm" className="font-mono">
              #{a}
            </Chip>
          ))}
          {v.sections.map((s) => (
            <Chip key={s} size="sm" tone="info">
              {sectionLabel(t, s)}
            </Chip>
          ))}
        </div>
      ),
    },
    { key: "exp", header: t("security.viewers.colExpires"), hideOn: "lg", cell: (v) => <span className="k-num text-fg-2">{v.expires_at ? day(v.expires_at) : t("security.viewers.never")}</span> },
    { key: "seen", header: t("security.viewers.colLastSignIn"), hideOn: "sm", cell: (v) => <span className="k-num text-fg-2" title={v.last_login_at ? when(v.last_login_at, true) : undefined}>{v.last_login_at ? ago(v.last_login_at, now) : t("security.viewers.never")}</span> },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (v) =>
        v.status === "revoked" ? (
          <span className="text-[11.5px] text-fg-3">{t("security.viewers.revokedOn", { date: day(v.revoked_at) })}</span>
        ) : (
          <div className="flex justify-end gap-1">
            <Button size="xs" variant="ghost" onClick={() => startEdit(v)} aria-label={t("security.viewers.editAria", { label: v.label })}>
              <Pencil /> <span className="hidden sm:inline">{t("security.viewers.edit")}</span>
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setConfirm({ kind: "password", v })} aria-label={t("security.viewers.passwordAria", { label: v.label })}>
              <KeyRound /> <span className="hidden sm:inline">{t("security.creds.password")}</span>
            </Button>
            <Button size="xs" variant="ghost" className="text-down hover:text-down" onClick={() => setRevoking(v)} aria-label={t("security.viewers.revokeAria", { label: v.label })}>
              <ShieldOff /> <span className="hidden sm:inline">{t("security.viewers.revoke")}</span>
            </Button>
          </div>
        ),
    },
  ];

  const editing = open && open !== "new" ? open : null;
  return (
    <div className="space-y-4 pb-16">
      <PageHeader
        title={t("security.viewerBar.title")}
        subtitle={t("security.viewers.subtitle")}
        actions={
          <Button variant="ember" onClick={startNew} disabled={!data || active >= (data?.max ?? 10)}>
            <Plus /> {t("security.viewers.new")}
          </Button>
        }
      />
      <Card>
        <CardHeader title={t("security.viewers.title")} subtitle={data ? t("security.viewers.count", { active, max: data.max }) : undefined} icon={<Eye />} />
        <div className="px-4 pb-5 pt-3 sm:px-6">
          {error ? (
            <FormError>{error.message}</FormError>
          ) : !data ? (
            <Skeleton className="h-28 w-full" />
          ) : data.items.length === 0 ? (
            <EmptyState title={t("security.viewers.emptyTitle")} text={t("security.viewers.emptyText")} illustration="locked" className="py-8" action={<Button variant="surface" onClick={startNew}><Plus /> {t("security.viewers.new")}</Button>} />
          ) : (
            <DataTable rows={data.items} rowKey={(v) => String(v.id)} columns={cols} dense pageSize={10} />
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={t("security.activity.title")} subtitle={t("security.activity.subtitle")} />
          <div className="px-4 pb-5 pt-3 sm:px-6">
            {!data ? (
              <Skeleton className="h-24 w-full" />
            ) : data.activity.length === 0 ? (
              <p className="py-4 text-[13px] text-fg-3">{t("security.activity.empty")}</p>
            ) : (
              <div className="divide-y divide-line rounded-[14px] border border-line">
                {data.activity.slice(0, 30).map((a) => {
                  const d = parseDevice(a.user_agent);
                  return (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-[13px]">
                      <div className="min-w-0">
                        <span className="font-medium">{a.label ?? t("security.viewers.colViewer")}</span>
                        <span className="text-fg-2">
                          {" · "}
                          {activityLabel(t, a.action)}
                          {a.action === "viewer.page_view" && a.path ? ` ${pageName(t, a.path)}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11.5px] text-fg-3">
                        <span className="hidden sm:inline">
                          {d.kind === "app" ? deviceName(d, brand) : d.browser} · <span dir="ltr" className="font-mono">{a.ip ?? "—"}</span>
                        </span>
                        <span className="k-num" title={when(a.at, true)}>
                          {ago(a.at, now)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title={t("security.investor.title")} icon={<KeyRound />} />
          <div className="space-y-3 px-6 pb-6 pt-2 text-[13px] text-fg-2">
            <p>{t("security.investor.text")}</p>
            <p className="text-fg-3">{t("security.investor.hint")}</p>
            <Link href="/accounts">
              <Button size="sm" variant="surface">
                {t("security.investor.goToAccounts")}
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      <Dialog
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        title={editing ? t("security.dialog.editTitle", { label: editing.label }) : t("security.dialog.newTitle")}
        description={editing ? t("security.dialog.viewerId", { id: editing.username }) : t("security.dialog.newText")}
        width={600}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              {t("common.cancel")}
            </Button>
            {editing ? (
              <Button variant="ember" disabled={busy} onClick={() => void save(editing)}>
                {busy ? t("security.dialog.saving") : t("security.dialog.save")}
              </Button>
            ) : (
              <Button
                variant="ember"
                onClick={() => {
                  if (!localCheck()) return;
                  setOpen(null);
                  setConfirm({ kind: "create" });
                }}
              >
                {t("common.continue")}
              </Button>
            )}
          </>
        }
      >
        {formErr && (
          <div className="mb-4">
            <FormError>{formErr}</FormError>
          </div>
        )}
        <ViewerForm draft={draft} set={set} editing={!!editing} errors={errors} />
      </Dialog>

      {confirm && (
        <StepUpDialog
          open={!!confirm}
          onOpenChange={(o) => !o && setConfirm(null)}
          action="viewer_access"
          title={confirm.kind === "create" ? t("security.stepup.createTitle") : t("security.stepup.passwordTitle", { label: confirm.v.label })}
          description={confirm.kind === "create" ? draft.label : t("security.stepup.passwordText")}
          what={confirm.kind === "create" ? t("security.stepup.createWhat") : t("security.stepup.passwordWhat")}
          confirmLabel={confirm.kind === "create" ? t("security.stepup.createConfirm") : t("security.stepup.passwordConfirm")}
          onConfirmed={(token) => (confirm.kind === "create" ? create(token) : newPassword(confirm.v, token))}
        />
      )}

      <Dialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={t("security.revoke.title", { label: revoking?.label ?? "" })}
        description={t("security.revoke.text")}
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevoking(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="sell" disabled={busy} onClick={() => revoking && void revoke(revoking)}>
              {busy ? t("security.revoke.busy") : t("security.revoke.confirm")}
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-fg-2">{t("security.creds.viewerId")} <span className="font-mono text-fg">{revoking?.username}</span></p>
      </Dialog>

      <Credentials creds={creds} onClose={() => setCreds(null)} />
    </div>
  );
}
