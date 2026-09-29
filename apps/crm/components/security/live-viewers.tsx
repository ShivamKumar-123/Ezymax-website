"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Eye, KeyRound, Pencil, Plus, ShieldOff, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, CopyButton, DataTable, Dialog, EmptyState, Field, Input, PageHeader, Skeleton, type ChipTone, type Column } from "@kalks/ui";
import { FormError } from "@/components/auth";
import { StepUpDialog } from "@/components/stepup";
import { useAccounts } from "@/components/trading/api";
import { VIEWER_SECTIONS, VIEWER_SECTION_KEYS, type ViewerScope, type ViewerSection } from "@/lib/viewer";
import { ago, day, parseDevice, secApi, useSec, when, type SecError } from "./common";

type Activity = { id: number; viewer_id: number | null; label: string | null; action: string; path: string | null; ip: string | null; user_agent: string | null; at: string };
type ViewersPage = { items: ViewerScope[]; activity: Activity[]; max: number };

const STATUS: Record<ViewerScope["status"], { tone: ChipTone; label: string }> = {
  active: { tone: "up", label: "Active" },
  expired: { tone: "neutral", label: "Expired" },
  revoked: { tone: "down", label: "Revoked" },
};

const ACTIVITY: Record<string, string> = {
  "viewer.login": "Signed in",
  "viewer.logout": "Signed out",
  "viewer.login_failed": "Wrong password",
  "viewer.locked": "Locked after failed attempts",
  "viewer.login_blocked": "Sign-in blocked (inactive login)",
  "viewer.page_view": "Viewed",
  "viewer.created": "Login created",
  "viewer.updated": "Access changed",
  "viewer.password_reset": "New password set",
  "viewer.revoked": "Access revoked",
};

const PAGE_NAMES: [string, string][] = [
  ["/portfolio/history", "Trade history"],
  ["/portfolio/ledger", "Ledger"],
  ["/portfolio/statements", "Statements"],
  ["/portfolio/analytics", "Analytics"],
  ["/portfolio", "Portfolio"],
  ["/accounts/", "Account #"],
  ["/accounts", "Accounts"],
  ["/wallet/history", "Wallet history"],
  ["/wallet", "Wallet"],
  ["/partner", "Partner dashboard"],
  ["/markets", "Markets"],
  ["/news", "News"],
  ["/calendar", "Calendar"],
];

function pageName(path: string | null): string {
  if (!path) return "";
  if (path === "/") return "Dashboard";
  const hit = PAGE_NAMES.find(([p]) => path.startsWith(p));
  if (!hit) return path;
  return hit[1] === "Account #" ? `Account #${path.split("/")[2] ?? ""}` : hit[1];
}

/** yyyy-mm-dd (local) for the date input; the login then ends at the end of that day (local time). */
const toDateInput = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA") : "");
const fromDateInput = (v: string) => (v ? new Date(`${v}T23:59:59`).toISOString() : null);

type Draft = { label: string; username: string; accounts: string[]; sections: ViewerSection[]; expires: string };

function ViewerForm({ draft, set, editing, errors }: { draft: Draft; set: (d: Partial<Draft>) => void; editing: boolean; errors: Record<string, string> }) {
  const accounts = useAccounts(0);
  const list = accounts.data?.accounts ?? [];
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const today = new Date().toLocaleDateString("en-CA");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name" error={errors.label}>
          <Input leading={<UserRound />} value={draft.label} onChange={(e) => set({ label: e.target.value.slice(0, 60) })} placeholder="e.g. My accountant" />
        </Field>
        <Field label="Expires on (optional)" error={errors.expires_at}>
          <Input type="date" leading={<CalendarDays />} min={today} value={draft.expires} onChange={(e) => set({ expires: e.target.value })} />
        </Field>
      </div>
      {!editing && (
        <Field label="Viewer ID (optional)" error={errors.username} hint={<span className="text-fg-3">Leave empty to generate one</span>}>
          <Input className="font-mono" value={draft.username} onChange={(e) => set({ username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 32) })} placeholder="e.g. priya-accountant" autoComplete="off" />
        </Field>
      )}
      <Field label="Trading accounts they can see" error={errors.accounts}>
        {accounts.loading ? (
          <Skeleton className="h-10 w-full" />
        ) : list.length === 0 ? (
          <p className="text-[12.5px] text-fg-3">You don't have trading accounts yet. You can add them to this login later.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {list.map((a) => {
              const login = String(a.login);
              return (
                <label key={login} className="flex cursor-pointer items-center gap-2.5 rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[13px] hover:border-fg-3">
                  <input type="checkbox" className="accent-[var(--k-ember)]" checked={draft.accounts.includes(login)} onChange={() => set({ accounts: toggle(draft.accounts, login) })} />
                  <span className="font-mono">#{login}</span>
                  <span className="truncate text-fg-3">
                    {a.type === "demo" ? "Demo" : "Live"} · {a.groupName}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </Field>
      <Field label="Sections they can open" error={errors.sections}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {VIEWER_SECTION_KEYS.map((k) => (
            <label key={k} className="flex cursor-pointer items-start gap-2.5 rounded-[12px] border border-line bg-surface-2 px-3 py-2 hover:border-fg-3">
              <input type="checkbox" className="mt-0.5 accent-[var(--k-ember)]" checked={draft.sections.includes(k)} onChange={() => set({ sections: toggle(draft.sections, k) })} />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{VIEWER_SECTIONS[k].label}</span>
                <span className="block text-[11.5px] text-fg-3">{VIEWER_SECTIONS[k].hint}</span>
              </span>
            </label>
          ))}
        </div>
      </Field>
      <p className="flex items-start gap-2 rounded-[12px] border border-line bg-surface-2 px-3 py-2.5 text-[12px] text-fg-3">
        <Eye className="mt-0.5 size-3.5 shrink-0" />
        Viewers sign in on the normal sign-in page with their viewer ID. They can never trade, move money or change settings, and never see your contact details.
      </p>
    </div>
  );
}

function Credentials({ creds, onClose }: { creds: { username: string; password: string; label: string } | null; onClose: () => void }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";
  return (
    <Dialog
      open={!!creds}
      onOpenChange={(o) => !o && onClose()}
      title="Viewer sign-in details"
      description={creds ? `For “${creds.label}”. Share them privately.` : undefined}
      width={460}
      footer={
        <Button variant="ember" onClick={onClose}>
          I've saved them
        </Button>
      }
    >
      {creds && (
        <div className="space-y-3 text-[13px]">
          {[
            ["Sign-in page", url],
            ["Viewer ID", creds.username],
            ["Password", creds.password],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-surface-2 px-3 py-2.5">
              <span className="shrink-0 text-fg-3">{k}</span>
              <span className="flex min-w-0 items-center gap-1 font-mono">
                <span className="truncate" data-testid={`viewer-cred-${k.toLowerCase().replace(/\s+/g, "-")}`}>
                  {v}
                </span>
                <CopyButton value={v!} label={k} />
              </span>
            </div>
          ))}
          <p className="flex items-start gap-2 text-[12px] text-warn">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> The password is shown only now. You can set a new one at any time.
          </p>
        </div>
      )}
    </Dialog>
  );
}

const EMPTY: Draft = { label: "", username: "", accounts: [], sections: ["accounts", "history"], expires: "" };

export function LiveViewers() {
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
    if (!draft.label.trim()) e.label = "Give this login a name.";
    if (draft.sections.length === 0) e.sections = "Choose at least one section.";
    if (draft.username && !/^[a-z0-9][a-z0-9._-]{3,31}$/.test(draft.username)) e.username = "Use 4–32 lowercase letters, digits, dots, dashes or underscores.";
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
    toast.success("Access updated", { description: "Changes apply to the viewer's next page." });
    setOpen(null);
    reload();
  };

  const newPassword = async (v: ViewerScope, token: string) => {
    const r = await secApi<{ password: string; username: string }>(`viewers/${v.id}/password`, { body: { stepup_token: token } });
    if (!r.ok) return void toast.error("Couldn't set a new password", { description: r.error.message });
    setCreds({ username: r.data.username, password: r.data.password, label: v.label });
    reload();
  };

  const revoke = async (v: ViewerScope) => {
    setBusy(true);
    const r = await secApi(`viewers/${v.id}/revoke`, { body: {} });
    setBusy(false);
    setRevoking(null);
    if (!r.ok) return void toast.error("Couldn't revoke access", { description: r.error.message });
    toast.success(`Access for “${v.label}” revoked`, { description: "Any open viewer session ended at once." });
    reload();
  };

  const cols: Column<ViewerScope>[] = [
    {
      key: "who",
      header: "Viewer",
      cell: (v) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <span className="truncate">{v.label}</span>
            <Chip size="sm" tone={STATUS[v.status].tone} dot>
              {STATUS[v.status].label}
            </Chip>
          </div>
          <div className="mt-0.5 flex items-center gap-1 font-mono text-[12px] text-fg-3">
            {v.username}
            <CopyButton value={v.username} label="Viewer ID" />
          </div>
        </div>
      ),
    },
    {
      key: "scope",
      header: "Can see",
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
              {VIEWER_SECTIONS[s]?.label ?? s}
            </Chip>
          ))}
        </div>
      ),
    },
    { key: "exp", header: "Expires", hideOn: "lg", cell: (v) => <span className="k-num text-fg-2">{v.expires_at ? day(v.expires_at) : "Never"}</span> },
    { key: "seen", header: "Last sign-in", hideOn: "sm", cell: (v) => <span className="k-num text-fg-2" title={v.last_login_at ? when(v.last_login_at, true) : undefined}>{v.last_login_at ? ago(v.last_login_at, now) : "Never"}</span> },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (v) =>
        v.status === "revoked" ? (
          <span className="text-[11.5px] text-fg-3">Revoked {day(v.revoked_at)}</span>
        ) : (
          <div className="flex justify-end gap-1">
            <Button size="xs" variant="ghost" onClick={() => startEdit(v)} aria-label={`Edit ${v.label}`}>
              <Pencil /> <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setConfirm({ kind: "password", v })} aria-label={`New password for ${v.label}`}>
              <KeyRound /> <span className="hidden sm:inline">Password</span>
            </Button>
            <Button size="xs" variant="ghost" className="text-down hover:text-down" onClick={() => setRevoking(v)} aria-label={`Revoke ${v.label}`}>
              <ShieldOff /> <span className="hidden sm:inline">Revoke</span>
            </Button>
          </div>
        ),
    },
  ];

  const editing = open && open !== "new" ? open : null;
  return (
    <div className="space-y-4 pb-16">
      <PageHeader
        title="View-only access"
        subtitle="Read-only logins for an accountant, investor or mentor. You choose the accounts and sections; viewers can never trade, move money or change settings."
        actions={
          <Button variant="ember" onClick={startNew} disabled={!data || active >= (data?.max ?? 10)}>
            <Plus /> New viewer
          </Button>
        }
      />
      <Card>
        <CardHeader title="Viewer logins" subtitle={data ? `${active} active of ${data.max} allowed` : undefined} icon={<Eye />} />
        <div className="px-4 pb-5 pt-3 sm:px-6">
          {error ? (
            <FormError>{error.message}</FormError>
          ) : !data ? (
            <Skeleton className="h-28 w-full" />
          ) : data.items.length === 0 ? (
            <EmptyState title="No view-only logins yet" text="Create one to share read-only access to chosen accounts." illustration="locked" className="py-8" action={<Button variant="surface" onClick={startNew}><Plus /> New viewer</Button>} />
          ) : (
            <DataTable rows={data.items} rowKey={(v) => String(v.id)} columns={cols} dense pageSize={10} />
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Viewer activity" subtitle="Sign-ins and pages opened with your view-only logins" />
          <div className="px-4 pb-5 pt-3 sm:px-6">
            {!data ? (
              <Skeleton className="h-24 w-full" />
            ) : data.activity.length === 0 ? (
              <p className="py-4 text-[13px] text-fg-3">Nothing yet. Activity appears here as soon as a viewer signs in.</p>
            ) : (
              <div className="divide-y divide-line rounded-[14px] border border-line">
                {data.activity.slice(0, 30).map((a) => {
                  const d = parseDevice(a.user_agent);
                  return (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-[13px]">
                      <div className="min-w-0">
                        <span className="font-medium">{a.label ?? "Viewer"}</span>
                        <span className="text-fg-2">
                          {" · "}
                          {ACTIVITY[a.action] ?? a.action}
                          {a.action === "viewer.page_view" && a.path ? ` ${pageName(a.path)}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11.5px] text-fg-3">
                        <span className="hidden sm:inline">
                          {d.browser} · <span className="font-mono">{a.ip ?? "—"}</span>
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
          <CardHeader title="Investor passwords" icon={<KeyRound />} />
          <div className="space-y-3 px-6 pb-6 pt-2 text-[13px] text-fg-2">
            <p>Each trading account also has an investor password for read-only access in Kalks Trader, MT5 style: positions and history, no trading.</p>
            <p className="text-fg-3">Set or change it on the account page.</p>
            <Link href="/accounts">
              <Button size="sm" variant="surface">
                Go to accounts
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      <Dialog
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        title={editing ? `Edit “${editing.label}”` : "New view-only login"}
        description={editing ? `Viewer ID ${editing.username}` : "We email you a code to confirm, then show the password once."}
        width={600}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            {editing ? (
              <Button variant="ember" disabled={busy} onClick={() => void save(editing)}>
                {busy ? "Saving…" : "Save changes"}
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
                Continue
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
          title={confirm.kind === "create" ? "Confirm new view-only login" : `New password for “${confirm.v.label}”`}
          description={confirm.kind === "create" ? draft.label : "Their open sessions end and the old password stops working."}
          what={confirm.kind === "create" ? "create a view-only login" : "set a new password for a view-only login"}
          confirmLabel={confirm.kind === "create" ? "Confirm & create" : "Confirm & set password"}
          onConfirmed={(token) => (confirm.kind === "create" ? create(token) : newPassword(confirm.v, token))}
        />
      )}

      <Dialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`Revoke “${revoking?.label ?? ""}”?`}
        description="The viewer is signed out at once and can't sign in again. This can't be undone."
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevoking(null)}>
              Cancel
            </Button>
            <Button variant="sell" disabled={busy} onClick={() => revoking && void revoke(revoking)}>
              {busy ? "Revoking…" : "Revoke access"}
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-fg-2">Viewer ID <span className="font-mono text-fg">{revoking?.username}</span></p>
      </Dialog>

      <Credentials creds={creds} onClose={() => setCreds(null)} />
    </div>
  );
}
