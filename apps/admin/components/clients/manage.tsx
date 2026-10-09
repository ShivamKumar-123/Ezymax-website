"use client";

/**
 * Client management (gateway client_lifecycle.rs): hide a test or spam client from the Back Office lists, and
 * delete a client.
 *
 * - Hide / Unhide needs clients.write and a reason. Only the Back Office view changes: the client can still sign in,
 *   trade and move money.
 * - Delete needs clients.delete. The check asks the wallet and the trading engine first and answers in plain words:
 *   deleted permanently (never funded or traded), personal data erased with the financial records kept (history),
 *   or "Can't delete yet" with what to clear. Then a reason and the client's email typed again.
 *
 * Demo builds answer from @ezymex/mock/admin-client-lifecycle and change nothing.
 */
import * as React from "react";
import { Archive, Ban, Eye, EyeOff, Info, MoreHorizontal, RefreshCw, Settings2, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, Dialog, Field, Input, Menu, Skeleton, cn } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { demoDeleteCheck } from "@ezymex/mock/admin-client-lifecycle";
import { useCan } from "@/components/staff-session";
import { TextArea } from "@/components/config/kit";
import { ErrorState, Mono, sendJson, useApi } from "@/components/live/kit";

export type ManagedClient = { id: number | string; name: string; email: string; hidden?: boolean; deleted?: boolean };
/** What changed: the list / profile refreshes, a purged client's profile is gone. */
export type ManageResult = "hidden" | "unhidden" | "deleted" | "purged";

/** GET /api/admin/users/{id}/delete-check */
export type DeleteCheck = {
  client: { id: number; email: string; name: string; status: string; hidden: boolean };
  mode: "purge" | "anonymize" | "blocked";
  blockers: { code: string; message: string }[];
  /** Why the client can't be purged (wallet transactions, live deals, referrals). */
  history: string[];
  /** Trading accounts archived before the delete. */
  archive: number[];
  /** Flat prop accounts left to the prop service. */
  skipped: number[];
  checked_at: string;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** "Hidden" / "Deleted" badge for list rows and the profile header. */
export function ClientStateChips({ hidden, deleted }: { hidden?: boolean; deleted?: boolean }) {
  if (deleted)
    return (
      <Chip size="sm" tone="down" dot>
        Deleted
      </Chip>
    );
  if (hidden)
    return (
      <Chip size="sm" tone="neutral">
        <EyeOff className="size-3" /> Hidden
      </Chip>
    );
  return null;
}

function Note({ tone = "neutral", icon, children }: { tone?: "neutral" | "down" | "warn" | "up"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-[12px] border px-3 py-2.5 text-[12.5px] leading-relaxed",
        tone === "down" ? "border-down/30 bg-down-soft text-fg" : tone === "warn" ? "border-warn/30 bg-warn-soft text-fg" : tone === "up" ? "border-up/30 bg-up-soft text-fg" : "border-line bg-surface-2 text-fg-2",
      )}
    >
      <span className={cn("mt-0.5 shrink-0 [&_svg]:size-4", tone === "down" ? "text-down" : tone === "warn" ? "text-warn" : tone === "up" ? "text-up" : "text-fg-3")}>{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * Row / header menu: Hide or Unhide, Delete. Shows nothing for a deleted client or without clients.write /
 * clients.delete. Clicks never reach a clickable table row behind it.
 */
export function ClientManageMenu({ client, onChanged, variant = "icon" }: { client: ManagedClient; onChanged: (r: ManageResult) => void; variant?: "icon" | "button" }) {
  const canHide = useCan("clients.write");
  const canDelete = useCan("clients.delete");
  const [open, setOpen] = React.useState<"hide" | "delete" | null>(null);
  if (client.deleted || (!canHide && !canDelete)) return null;
  const items: React.ComponentProps<typeof Menu>["items"] = [
    ...(canHide ? [{ label: client.hidden ? "Unhide client" : "Hide client", icon: client.hidden ? <Eye /> : <EyeOff />, onSelect: () => setOpen("hide") }] : []),
    ...(canHide && canDelete ? (["sep"] as const) : []),
    ...(canDelete ? [{ label: "Delete client…", icon: <Trash2 />, danger: true, onSelect: () => setOpen("delete") }] : []),
  ];
  const done = (r: ManageResult) => {
    setOpen(null);
    onChanged(r);
  };
  return (
    <span className="inline-flex" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Menu
        items={items}
        width={210}
        trigger={
          variant === "icon" ? (
            <button className="grid size-8 place-items-center rounded-full border border-line text-fg-2 hover:bg-surface-3 hover:text-fg" aria-label={`Manage ${client.name}`} data-testid="client-manage">
              <MoreHorizontal className="size-4" />
            </button>
          ) : (
            <Button variant="surface" data-testid="client-manage">
              <Settings2 /> Manage
            </Button>
          )
        }
      />
      {open === "hide" && <HideDialog client={client} onClose={() => setOpen(null)} onDone={done} />}
      {open === "delete" && <DeleteDialog client={client} onClose={() => setOpen(null)} onDone={done} />}
    </span>
  );
}

/** Hide (or unhide) a client: a reason, audited. The client is not affected. */
export function HideDialog({ client, onClose, onDone }: { client: ManagedClient; onClose: () => void; onDone: (r: ManageResult) => void }) {
  const unhide = !!client.hidden;
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    const r = reason.trim();
    if (r.length < 3) return toast.error("Give a reason", { description: "At least 3 characters." });
    setBusy(true);
    if (IS_DEMO) await wait(400);
    const res = IS_DEMO ? ({ ok: true } as const) : await sendJson(`/api/admin/users/${client.id}/${unhide ? "unhide" : "hide"}`, { reason: r });
    setBusy(false);
    if (!res.ok) return toast.error(unhide ? "Couldn't unhide the client" : "Couldn't hide the client", { description: res.error.message });
    toast.success(unhide ? `${client.name} is back in the client lists` : `${client.name} is hidden`, {
      description: `${unhide ? "" : "Turn on “Show hidden” to see them. "}Recorded in the audit trail.${IS_DEMO ? " (Demo: nothing was changed.)" : ""}`,
    });
    onDone(unhide ? "unhidden" : "hidden");
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      width={480}
      title={unhide ? `Unhide ${client.name}` : `Hide ${client.name}`}
      description={unhide ? "The client shows in the client lists and counts again." : "For test and spam accounts: the client leaves the client lists, Online now and the client counts until you turn on “Show hidden”."}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="ember" onClick={submit} disabled={busy} data-testid="hide-confirm">
            {unhide ? <Eye /> : <EyeOff />} {busy ? "Saving…" : unhide ? "Unhide" : "Hide client"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!unhide && (
          <Note icon={<Info />}>
            Hiding only changes what the Back Office shows. The client can still sign in, trade, deposit and withdraw. To stop that, block sign-in or restrict
            the client instead.
          </Note>
        )}
        <Field label="Reason" hint="Required · audited">
          <TextArea value={reason} onChange={setReason} rows={2} placeholder={unhide ? "e.g. Real client, hidden by mistake" : "e.g. QA test account, ticket #4410"} />
        </Field>
      </div>
    </Dialog>
  );
}

/** Delete a client: the check, then a reason and the client's email typed again. */
export function DeleteDialog({ client, onClose, onDone }: { client: ManagedClient; onClose: () => void; onDone: (r: ManageResult) => void }) {
  const api = useApi<DeleteCheck>(IS_DEMO ? null : `/api/admin/users/${client.id}/delete-check`);
  const demo = React.useMemo(() => (IS_DEMO ? (demoDeleteCheck(client.id) as DeleteCheck) : null), [client.id]);
  const check = demo ?? api.data;
  const [reason, setReason] = React.useState("");
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const email = check?.client.email ?? client.email;
  const matches = typed.trim().toLowerCase() === email.toLowerCase();
  const ready = !!check && check.mode !== "blocked" && reason.trim().length >= 3 && matches;
  const accounts = check?.archive.length ?? 0;

  async function submit() {
    if (!check || check.mode === "blocked") return;
    if (reason.trim().length < 3) return toast.error("Give a reason", { description: "At least 3 characters." });
    if (!matches) return toast.error("The email doesn't match", { description: `Type ${email} to confirm.` });
    setBusy(true);
    if (IS_DEMO) await wait(700);
    const res = IS_DEMO
      ? ({ ok: true, data: { mode: check.mode } } as const)
      : await sendJson<{ mode: "purge" | "anonymize"; summary: { accounts_archived: number[] } }>(`/api/admin/users/${client.id}/delete`, { reason: reason.trim(), confirm_email: typed.trim(), mode: check.mode });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error.code === "delete_blocked" ? "Can't delete yet" : res.error.code === "mode_changed" ? "The client's activity changed" : "Couldn't delete the client", { description: res.error.message });
      // a new verdict: show it before anything else is confirmed
      if (res.error.code === "delete_blocked" || res.error.code === "mode_changed") api.reload();
      return;
    }
    const purged = res.data.mode === "purge";
    toast.success(purged ? `${client.name} was deleted permanently` : `${client.name}'s personal data was erased`, {
      description: `${accounts ? `${accounts} trading account${accounts === 1 ? "" : "s"} archived. ` : ""}${purged ? "" : "The account is closed; financial records are kept. "}Recorded in the audit trail.${IS_DEMO ? " (Demo: nothing was changed.)" : ""}`,
    });
    onDone(purged ? "purged" : "deleted");
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      width={560}
      title={`Delete ${client.name}`}
      description="The wallet and the trading accounts are checked first; what happens depends on the client's history."
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {check?.mode === "blocked" ? (
            <Button size="sm" variant="surface" onClick={IS_DEMO ? () => toast("Checked again", { description: "Nothing changed since the last check." }) : api.reload} disabled={api.loading}>
              <RefreshCw /> Check again
            </Button>
          ) : (
            <Button size="sm" variant="sell" onClick={submit} disabled={!ready || busy} data-testid="delete-confirm">
              <Trash2 /> {busy ? "Deleting…" : check?.mode === "anonymize" ? "Erase personal data" : "Delete permanently"}
            </Button>
          )}
        </>
      }
    >
      {api.error && !demo ? (
        <ErrorState error={api.error} onRetry={api.reload} className="py-6" />
      ) : !check ? (
        <div className="space-y-3" aria-busy="true">
          <p className="text-[12.5px] text-fg-3">Checking the wallet and the trading accounts…</p>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : (
        <div className={cn("space-y-4", api.loading && !demo && "opacity-60 transition-opacity")}>
          <Verdict check={check} />
          {check.mode !== "blocked" && (
            <>
              <Field label="Reason" hint="Required · audited · no personal data">
                <TextArea value={reason} onChange={setReason} rows={2} placeholder="e.g. Duplicate sign-up, ticket #5521" />
              </Field>
              <Field label="Type the client's email to confirm" hint={<Mono className="text-[11.5px]">{email}</Mono>}>
                <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={email} autoComplete="off" spellCheck={false} aria-label="Client email" data-testid="delete-email" />
              </Field>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}

function Verdict({ check }: { check: DeleteCheck }) {
  const n = check.archive.length;
  const archived = n ? `${n} trading account${n === 1 ? " is" : "s are"} archived first (${check.archive.map((l) => `#${l}`).join(", ")}).` : "The client has no trading account to archive.";
  if (check.mode === "blocked")
    return (
      <div className="space-y-3">
        <Note tone="down" icon={<Ban />}>
          <div className="font-medium">Can&apos;t delete yet</div>
          <div className="text-fg-2">The client still holds money or open risk. Clear these, then check again:</div>
        </Note>
        <ul className="space-y-1.5" data-testid="delete-blockers">
          {check.blockers.map((b, i) => (
            <li key={i} className="flex gap-2 rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[12.5px]">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" />
              <span>{b.message}</span>
            </li>
          ))}
        </ul>
        <p className="text-[11.5px] text-fg-3">
          {check.history.length
            ? "Afterwards the client's personal data can be erased and the account closed; their financial records stay."
            : "Afterwards the client can be deleted permanently."}
        </p>
      </div>
    );
  if (check.mode === "purge")
    return (
      <div className="space-y-3">
        <Note tone="down" icon={<Trash2 />}>
          <div className="font-medium">This client never funded or traded: the client will be deleted permanently.</div>
          <div className="text-fg-2">
            Profile and sign-in, sessions and devices, KYC documents, view-only logins, requests and restrictions are removed. This can&apos;t be undone; the email
            address can register again.
          </div>
        </Note>
        <Note icon={<Archive />}>{archived}</Note>
      </div>
    );
  return (
    <div className="space-y-3">
      <Note tone="warn" icon={<ShieldCheck />}>
        <div className="font-medium">This client has trading history: personal data will be erased and the account closed; financial records are kept for compliance.</div>
        {check.history.length > 0 && <div className="text-fg-2">History: {check.history.join(" · ")}.</div>}
      </Note>
      <div className="grid gap-2 text-[12px] sm:grid-cols-2">
        <div className="rounded-[12px] border border-line bg-surface-2 px-3 py-2.5">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-fg-3">Erased</div>
          <p className="text-fg-2">Name, email, phone, date of birth, Google link, KYC documents. Sign-in is blocked, sessions and view-only logins end.</p>
        </div>
        <div className="rounded-[12px] border border-line bg-surface-2 px-3 py-2.5">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-fg-3">Kept</div>
          <p className="text-fg-2">Trades, deposits and withdrawals, wallet ledger, IB records, reports and the audit trail, as AML record-keeping rules require.</p>
        </div>
      </div>
      <Note icon={<Archive />}>{archived}</Note>
    </div>
  );
}
