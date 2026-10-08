"use client";

/**
 * "Log in as client": opens the Client Area (or Ezymex Trader on one of the client's accounts) as the client in a
 * new tab, for 30 minutes, bound to this staff session. Read-only by default (every change is refused on the
 * server); full access is for the Super Admin only, with an extra confirmation. A reason is required and every
 * start, end and action is audited; the client's sign-in history shows "Staff access by <broker> support".
 */
import * as React from "react";
import { CandlestickChart, Eye, LayoutDashboard, LogIn, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, Field, Segmented, cn } from "@ezymex/ui";
import { TextArea } from "@/components/config/kit";
import { Mono, sendJson, useApi } from "@/components/live/kit";
import type { Controls } from "./presence";

type Account = { login: number; type: string; group: string; groupName?: string; currency: string; status: string; equity?: number };

export function ImpersonateButton({ id, name, controls }: { id: number; name: string; controls: Controls | null }) {
  const [open, setOpen] = React.useState(false);
  if (!controls?.can.impersonate) return null;
  const disabled = controls.status !== "active";
  return (
    <>
      <Button variant="surface" onClick={() => setOpen(true)} disabled={disabled} title={disabled ? "The client's sign-in is blocked or the account is closed" : undefined} data-testid="impersonate-open">
        <LogIn /> Log in as client
      </Button>
      {open && <ImpersonateDialog id={id} name={name} controls={controls} onClose={() => setOpen(false)} />}
    </>
  );
}

function ImpersonateDialog({ id, name, controls, onClose }: { id: number; name: string; controls: Controls; onClose: () => void }) {
  const [app, setApp] = React.useState<"client_area" | "trader">("client_area");
  const [mode, setMode] = React.useState<"read_only" | "full">("read_only");
  const [reason, setReason] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const [login, setLogin] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const accounts = useApi<{ items: Account[] }>(app === "trader" ? `/api/admin/client-controls/users/${id}/accounts` : null);
  const list = (accounts.data?.items ?? []).filter((a) => a.status !== "expired");
  React.useEffect(() => {
    if (app === "trader" && login === null && list.length) setLogin(list[0]!.login);
  }, [app, login, list]);

  async function open() {
    if (reason.trim().length < 3) return toast.error("Give a reason", { description: "At least 3 characters, e.g. the support ticket." });
    if (mode === "full" && !confirm) return toast.error("Confirm full access first");
    if (app === "trader" && !login) return toast.error("Choose a trading account");
    // a tab opened in the click itself is never blocked; it is pointed at the one-time link once it exists
    const tab = window.open("about:blank", "_blank");
    setBusy(true);
    const path = app === "trader" ? `/api/admin/client-controls/users/${id}/impersonate/trader` : `/api/admin/client-controls/users/${id}/impersonate`;
    const r = await sendJson<{ url: string; minutes?: number }>(path, { reason: reason.trim(), mode, confirm: mode === "full" ? confirm : false, login: app === "trader" ? login : undefined });
    setBusy(false);
    if (!r.ok) {
      tab?.close();
      return toast.error("Couldn't open a staff session", { description: r.error.message });
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = r.data.url;
    } else {
      window.open(r.data.url, "_blank", "noopener");
    }
    toast.success(`Staff session opened as ${name}`, { description: `${mode === "full" ? "Full access" : "Read-only"} · ${r.data.minutes ?? controls.staff_session_minutes} minutes · audited` });
    onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      width={540}
      title={`Log in as ${name}`}
      description={`Opens a new tab as this client for ${controls.staff_session_minutes} minutes. Your own session is not affected, the client's password is never used, and the client's sign-in history shows a staff access.`}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="ember" onClick={open} disabled={busy} data-testid="impersonate-start">
            <LogIn /> {busy ? "Opening…" : app === "trader" ? "Open Ezymex Trader" : "Open Client Area"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Open">
          <Segmented
            size="sm"
            value={app}
            onChange={(v) => setApp(v)}
            options={[
              { value: "client_area", label: <span className="inline-flex items-center gap-1.5"><LayoutDashboard className="size-3.5" />Client Area</span> },
              { value: "trader", label: <span className="inline-flex items-center gap-1.5"><CandlestickChart className="size-3.5" />Ezymex Trader</span> },
            ]}
          />
        </Field>
        {app === "trader" && (
          <Field label="Trading account">
            {accounts.error ? (
              <p className="text-[12.5px] text-down">{accounts.error.message}</p>
            ) : !accounts.data ? (
              <p className="text-[12.5px] text-fg-3">Loading accounts…</p>
            ) : list.length === 0 ? (
              <p className="text-[12.5px] text-fg-3">This client has no trading account.</p>
            ) : (
              <div className="max-h-44 space-y-1.5 overflow-y-auto">
                {list.map((a) => (
                  <button
                    key={a.login}
                    type="button"
                    onClick={() => setLogin(a.login)}
                    className={cn("flex w-full items-center justify-between rounded-[12px] border px-3 py-2 text-left text-[12.5px]", login === a.login ? "border-ember/50 bg-ember-soft" : "border-line bg-surface-2 hover:bg-surface-3")}
                  >
                    <span className="flex items-center gap-2">
                      <Mono>{a.login}</Mono>
                      <span className="text-fg-3">
                        {a.type === "demo" ? "Demo" : "Live"} · {a.groupName ?? a.group}
                      </span>
                    </span>
                    <span className="k-num text-fg-2">
                      {typeof a.equity === "number" ? a.equity.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"} {a.currency}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Field>
        )}
        <Field label="Access">
          <div className="grid gap-2 sm:grid-cols-2">
            <ModeOption active={mode === "read_only"} onClick={() => setMode("read_only")} icon={<Eye />} title="Read-only" text="Sees everything the client sees. Every change is refused by the server." />
            <ModeOption
              active={mode === "full"}
              onClick={() => controls.can.impersonate_full && setMode("full")}
              disabled={!controls.can.impersonate_full}
              icon={<ShieldAlert />}
              title="Full access"
              text={controls.can.impersonate_full ? "Acts as the client: changes and trades are recorded under your name." : "Super Admin only."}
            />
          </div>
        </Field>
        {mode === "full" && (
          <label className="flex items-start gap-2.5 rounded-[12px] border border-down/30 bg-down-soft px-3 py-2.5 text-[12.5px] text-fg">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 accent-ember" data-testid="impersonate-confirm" />
            <span>I will act as {name} with full access. Everything I do is recorded under my name and shown to compliance.</span>
          </label>
        )}
        <Field label="Reason" hint="Required · audited">
          <TextArea value={reason} onChange={setReason} rows={2} placeholder="e.g. Ticket #5521: client can't find their statement" />
        </Field>
      </div>
    </Dialog>
  );
}

function ModeOption({ active, onClick, icon, title, text, disabled }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; text: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "flex items-start gap-2.5 rounded-[14px] border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active ? "border-ember/50 bg-ember-soft" : "border-line bg-surface-2 hover:bg-surface-3",
      )}
    >
      <span className="mt-0.5 text-fg-2 [&_svg]:size-4">{icon}</span>
      <span>
        <span className="block text-[13px] font-medium">{title}</span>
        <span className="block text-[11.5px] leading-snug text-fg-3">{text}</span>
      </span>
    </button>
  );
}
