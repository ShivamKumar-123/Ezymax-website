"use client";

// Client 360: account closure / data-export requests (D94) and the client's view-only logins (D90), with the
// staff actions on them. Every action goes through the gateway, which checks the permission and audits it.

import * as React from "react";
import { Eye, FileArchive, LogOut, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Dialog, Skeleton, type ChipTone } from "@kalks/ui";
import { TextArea } from "@/components/config/kit";
import { ErrorState, sendJson, useApi, when } from "./kit";

type ClientRequest = {
  id: number;
  kind: "closure" | "data_export";
  status: "open" | "in_progress" | "completed" | "rejected" | "cancelled";
  reason: string | null;
  staff_note: string | null;
  handled_by: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};
type Viewer = { id: number; label: string; username: string; accounts: string[]; sections: string[]; expires_at: string | null; status: "active" | "expired" | "revoked"; last_login_at: string | null; created_at: string };
type Security = { requests: ClientRequest[]; viewers: Viewer[]; can_process: boolean; can_revoke: boolean };

const REQ: Record<ClientRequest["status"], { tone: ChipTone; label: string }> = {
  open: { tone: "warn", label: "Open" },
  in_progress: { tone: "info", label: "In progress" },
  completed: { tone: "up", label: "Completed" },
  rejected: { tone: "down", label: "Rejected" },
  cancelled: { tone: "neutral", label: "Cancelled by client" },
};

const VSTATUS: Record<Viewer["status"], ChipTone> = { active: "up", expired: "neutral", revoked: "down" };

type Act = { r: ClientRequest; to: "in_progress" | "completed" | "rejected" };

export function ClientSecurityCard({ userId, onChanged }: { userId: number; onChanged: () => void }) {
  const sec = useApi<Security>(`/api/admin/users/${userId}/security`);
  const [act, setAct] = React.useState<Act | null>(null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [signOut, setSignOut] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const d = sec.data;

  const process = async () => {
    if (!act) return;
    setBusy(true);
    const r = await sendJson(`/api/admin/requests/${act.r.id}`, { status: act.to, note: note.trim() || undefined });
    setBusy(false);
    if (!r.ok) return toast.error("Couldn't update the request", { description: r.error.message });
    toast.success(act.to === "completed" && act.r.kind === "closure" ? "Account closed" : "Request updated", { description: "Logged to the audit trail." });
    setAct(null);
    setNote("");
    sec.reload();
    onChanged();
  };
  const revokeViewer = async (v: Viewer) => {
    const r = await sendJson(`/api/admin/users/${userId}/viewers/${v.id}/revoke`, {});
    if (!r.ok) return toast.error("Couldn't revoke", { description: r.error.message });
    toast.success(`View-only login “${v.label}” revoked`);
    sec.reload();
    onChanged();
  };
  const signOutAll = async () => {
    setBusy(true);
    const r = await sendJson<{ revoked: number }>(`/api/admin/users/${userId}/sessions/revoke-all`, { reason: reason.trim() || undefined });
    setBusy(false);
    setSignOut(false);
    setReason("");
    if (!r.ok) return toast.error("Couldn't sign the client out", { description: r.error.message });
    toast.success(`Signed out of ${r.data.revoked} session${r.data.revoked === 1 ? "" : "s"}`, { description: "Logged to the audit trail." });
    onChanged();
  };

  return (
    <Card>
      <CardHeader
        title="Requests & access"
        icon={<FileArchive />}
        action={
          d?.can_revoke && (
            <Button size="xs" variant="down-outline" onClick={() => setSignOut(true)}>
              <LogOut /> Sign out everywhere
            </Button>
          )
        }
      />
      <div className="space-y-5 px-4 pb-5 pt-3 sm:px-6">
        {sec.error ? (
          <ErrorState error={sec.error} onRetry={sec.reload} className="py-6" />
        ) : !d ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fg-3">Closure and data export</div>
              {d.requests.length === 0 ? (
                <p className="text-[12.5px] text-fg-3">No requests.</p>
              ) : (
                <div className="divide-y divide-line rounded-[14px] border border-line">
                  {d.requests.map((r) => (
                    <div key={r.id} className="space-y-1.5 px-3 py-2.5 text-[12.5px]" data-testid={`client-request-${r.id}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2 font-medium">
                          {r.kind === "closure" ? "Account closure" : "Data export"}
                          <Chip size="sm" tone={REQ[r.status].tone} dot>
                            {REQ[r.status].label}
                          </Chip>
                        </span>
                        <span className="text-[11.5px] text-fg-3">{when(r.created_at)}</span>
                      </div>
                      {r.reason && <p className="text-fg-2">“{r.reason}”</p>}
                      {(r.staff_note || r.handled_by) && (
                        <p className="text-[11.5px] text-fg-3">
                          {r.handled_by && r.staff_note ? `${r.handled_by}: ${r.staff_note}` : r.staff_note ?? `Handled by ${r.handled_by}`}
                        </p>
                      )}
                      {d.can_process && (r.status === "open" || r.status === "in_progress") && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {r.status === "open" && (
                            <Button size="xs" variant="surface" onClick={() => setAct({ r, to: "in_progress" })}>
                              Start
                            </Button>
                          )}
                          <Button size="xs" variant="up-outline" onClick={() => setAct({ r, to: "completed" })}>
                            {r.kind === "closure" ? "Close account" : "Mark export ready"}
                          </Button>
                          <Button size="xs" variant="ghost" onClick={() => setAct({ r, to: "rejected" })}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-3">
                <Eye className="size-3.5" /> View-only logins
              </div>
              {d.viewers.length === 0 ? (
                <p className="text-[12.5px] text-fg-3">None.</p>
              ) : (
                <div className="divide-y divide-line rounded-[14px] border border-line">
                  {d.viewers.map((v) => (
                    <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[12.5px]">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium">
                          {v.label}
                          <Chip size="sm" tone={VSTATUS[v.status]} dot>
                            {v.status}
                          </Chip>
                        </div>
                        <div className="mt-0.5 text-[11.5px] text-fg-3">
                          <span className="font-mono">{v.username}</span> · {v.accounts.length ? v.accounts.map((a) => `#${a}`).join(", ") : "no accounts"} · {v.sections.join(", ")}
                          {v.expires_at ? ` · expires ${when(v.expires_at)}` : ""}
                        </div>
                      </div>
                      {d.can_process && v.status !== "revoked" && (
                        <Button size="xs" variant="ghost" className="text-down hover:text-down" onClick={() => void revokeViewer(v)}>
                          <ShieldOff /> Revoke
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <Dialog
        open={!!act}
        onOpenChange={(o) => !o && setAct(null)}
        title={act ? (act.to === "in_progress" ? "Start processing" : act.to === "rejected" ? "Reject request" : act.r.kind === "closure" ? "Close this account" : "Mark the export ready") : ""}
        description={
          act?.to === "completed" && act.r.kind === "closure"
            ? "The client can no longer sign in; their sessions and view-only logins end now. Records are retained. Close or archive trading accounts and settle the wallet first."
            : act?.to === "completed"
              ? "The client can download their personal-data file from the Security page."
              : act?.to === "rejected"
                ? "The client sees your note."
                : "The client sees the request as in progress and can no longer cancel it."
        }
        width={480}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setAct(null)}>
              Cancel
            </Button>
            <Button size="sm" variant={act?.to === "rejected" || (act?.to === "completed" && act.r.kind === "closure") ? "down-outline" : "ember"} disabled={busy || (act?.to === "rejected" && !note.trim())} onClick={() => void process()}>
              {busy ? "Saving…" : "Confirm"}
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-fg-2">{act?.to === "rejected" ? "Reason (shown to the client)" : "Note (optional, shown to the client)"}</span>
          <TextArea value={note} onChange={setNote} rows={3} placeholder={act?.to === "rejected" ? "e.g. Open positions must be closed first" : ""} />
        </label>
      </Dialog>

      <Dialog
        open={signOut}
        onOpenChange={setSignOut}
        title="Sign the client out everywhere?"
        description="Every Client Area session of this client ends now, view-only logins included."
        width={460}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setSignOut(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="down-outline" disabled={busy} onClick={() => void signOutAll()}>
              <LogOut /> {busy ? "Signing out…" : "Sign out everywhere"}
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-fg-2">Reason (optional, saved in the audit log)</span>
          <TextArea value={reason} onChange={setReason} rows={2} placeholder="e.g. Suspected account takeover" />
        </label>
      </Dialog>
    </Card>
  );
}
