"use client";

/**
 * Client restrictions (gateway client_controls.rs). Each one has a reason, an optional expiry and an audit entry,
 * and is enforced by the service that owns it: sign-in by the gateway, trading / close-only / copy-PAMM-MAM by the
 * trading engine, deposits / withdrawals / transfers / IB payouts by the wallet.
 */
import * as React from "react";
import { ArrowLeftRight, Ban, Banknote, CandlestickChart, ChevronDown, Handshake, History, Lock, LogIn, ShieldAlert, Snowflake, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Dialog, Field, Input, Segmented, Skeleton, Toggle, Tooltip, cn, type ChipTone } from "@ezymex/ui";
import { TextArea } from "@/components/config/kit";
import { ErrorState, ago, sendJson, useNow, when } from "@/components/live/kit";
import type { Controls, Restriction, useControls } from "./presence";

type Meta = { label: string; short: string; help: string; tone: ChipTone; icon: React.ReactNode };

export const RESTRICTION_META: Record<string, Meta> = {
  login: { label: "Block sign-in", short: "Blocked", help: "Suspends the account: every session ends (view-only logins, staff sessions and Ezymex Trader too) and sign-in shows “This account is suspended. Contact support.”", tone: "down", icon: <LogIn /> },
  freeze: { label: "Freeze account", short: "Frozen", help: "Everything below at once: trading, deposits, withdrawals, transfers, IB payouts and copy / PAMM / MAM. The client can still sign in and sees the notice.", tone: "down", icon: <Snowflake /> },
  trading: { label: "Disable trading", short: "No trading", help: "The trading engine refuses every new order, modification and close from the client. Stop-out, SL and TP still run; the dealing desk can still act.", tone: "down", icon: <CandlestickChart /> },
  close_only: { label: "Close-only", short: "Close-only", help: "Positions can be closed or reduced; new exposure is refused with a clear reason.", tone: "warn", icon: <Lock /> },
  deposits: { label: "Disable deposits", short: "No deposits", help: "The wallet refuses new deposit requests.", tone: "warn", icon: <Banknote /> },
  withdrawals: { label: "Disable withdrawals", short: "No withdrawals", help: "The wallet refuses withdrawal requests (already approved payouts are not recalled).", tone: "warn", icon: <Wallet /> },
  transfers: { label: "Disable transfers", short: "No transfers", help: "No transfers between the wallet and trading accounts, in either direction.", tone: "warn", icon: <ArrowLeftRight /> },
  ib: { label: "Hold IB commissions", short: "IB on hold", help: "The wallet refuses IB commission credits and payouts to this partner.", tone: "warn", icon: <Handshake /> },
  social: { label: "Disable copy / PAMM / MAM", short: "No copy / PAMM", help: "No new copy subscription, PAMM investment or fund, master application, MAM link or programme. Running ones continue until stopped.", tone: "warn", icon: <Users /> },
};

export const RESTRICTION_ORDER = ["login", "freeze", "trading", "close_only", "deposits", "withdrawals", "transfers", "ib", "social"];

/** Compact chips for lists: the most severe first. */
export function RestrictionChips({ kinds, max = 2 }: { kinds: string[] | undefined; max?: number }) {
  if (!kinds?.length) return null;
  const sorted = [...kinds].sort((a, b) => RESTRICTION_ORDER.indexOf(a) - RESTRICTION_ORDER.indexOf(b));
  const shown = sorted.slice(0, max);
  const rest = sorted.slice(max);
  return (
    <span className="inline-flex shrink-0 items-center gap-1" data-testid="restriction-chips">
      {shown.map((k) => (
        <Chip key={k} size="sm" tone={RESTRICTION_META[k]?.tone ?? "warn"}>
          {RESTRICTION_META[k]?.short ?? k}
        </Chip>
      ))}
      {rest.length > 0 && (
        <Tooltip content={rest.map((k) => RESTRICTION_META[k]?.short ?? k).join(", ")}>
          <span>
            <Chip size="sm">+{rest.length}</Chip>
          </span>
        </Tooltip>
      )}
    </span>
  );
}

const EXPIRY = [
  { value: "never", label: "Until lifted" },
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "date", label: "Date" },
] as const;
type ExpiryChoice = (typeof EXPIRY)[number]["value"];

function expiryIso(choice: ExpiryChoice, date: string): string | null | "invalid" {
  const h = { "1h": 1, "24h": 24, "7d": 168, "30d": 720 } as Record<string, number>;
  if (choice === "never") return null;
  if (choice === "date") {
    const t = Date.parse(date);
    return Number.isFinite(t) && t > Date.now() + 60_000 ? new Date(t).toISOString() : "invalid";
  }
  return new Date(Date.now() + h[choice]! * 3_600_000).toISOString();
}

type Pending = { kind: string; on: boolean };

export function RestrictionsCard({ id, name, controls, onChanged }: { id: number; name: string; controls: ReturnType<typeof useControls>; onChanged?: () => void }) {
  const now = useNow();
  const { data: c, error, reload } = controls;
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);
  const active = new Map((c?.restrictions ?? []).map((r) => [r.kind, r]));
  const frozen = active.has("freeze");
  const canFor = (k: string) => (k === "login" ? !!c?.can.block : !!c?.can.restrict);

  return (
    <Card data-testid="restrictions-card">
      <CardHeader
        title="Restrictions"
        subtitle="Each needs a reason and can expire. Enforced by the gateway, trading engine and wallet, and shown to the client."
        icon={<ShieldAlert />}
        action={c && c.restrictions.length > 0 ? <Chip tone="down" dot>{c.restrictions.length} active</Chip> : c ? <Chip tone="up" dot>None</Chip> : null}
      />
      <div className="px-4 pb-5 pt-3 sm:px-6">
        {error ? (
          <ErrorState error={error} onRetry={reload} className="py-6" />
        ) : !c ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-3">
              {RESTRICTION_ORDER.map((k) => {
                const m = RESTRICTION_META[k]!;
                const r = active.get(k);
                const covered = !r && frozen && c.freeze_covers.includes(k);
                const allowed = canFor(k);
                return (
                  <li key={k} className={cn("flex items-start gap-3 rounded-[14px] border px-3 py-3", r ? "border-down/30 bg-down-soft/40" : "border-line")} data-kind={k} data-active={r ? "true" : "false"}>
                    <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border [&_svg]:size-4", r ? "border-down/30 bg-down-soft text-down" : "border-line bg-surface-2 text-fg-2")}>{m.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-medium">{m.label}</span>
                        {covered && <Chip size="sm" tone="down">By freeze</Chip>}
                      </span>
                      {r ? (
                        <span className="mt-0.5 block text-[12px] leading-relaxed text-fg-2">
                          <span className="text-fg">{r.reason}</span>
                          <span className="block text-[11.5px] text-fg-3">
                            {r.created_by?.name ?? "Staff"} · {ago(r.created_at, now)} · {r.expires_at ? `until ${when(r.expires_at)}` : "until lifted"}
                          </span>
                        </span>
                      ) : (
                        <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-fg-3" title={m.help}>{m.help}</span>
                      )}
                    </span>
                    <span className="mt-1 shrink-0">
                      {allowed ? (
                        <Toggle checked={!!r} onChange={(on) => setPending({ kind: k, on })} label={m.label} />
                      ) : (
                        <Tooltip content={k === "login" ? "Needs the clients.block permission" : "Needs the clients.restrict permission"}>
                          <span className="pointer-events-auto opacity-50">
                            <Toggle checked={!!r} onChange={() => undefined} label={m.label} />
                          </span>
                        </Tooltip>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <button onClick={() => setShowHistory((v) => !v)} className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-fg-3 hover:text-fg" data-testid="restriction-history-toggle">
              <History className="size-3.5" /> History · {c.history.length}
              <ChevronDown className={cn("size-3.5 transition-transform", showHistory && "rotate-180")} />
            </button>
            {showHistory && <HistoryList items={c.history} now={now} />}
          </>
        )}
      </div>
      {pending && c && (
        <ChangeDialog
          id={id}
          name={name}
          pending={pending}
          current={active.get(pending.kind) ?? null}
          onClose={() => setPending(null)}
          onDone={() => {
            setPending(null);
            reload();
            onChanged?.();
          }}
        />
      )}
    </Card>
  );
}

function HistoryList({ items, now }: { items: Restriction[]; now: number }) {
  if (!items.length) return <p className="mt-2 text-[12.5px] text-fg-3">No restrictions have been set on this client.</p>;
  return (
    <ol className="mt-2 space-y-2" data-testid="restriction-history">
      {items.map((h) => (
        <li key={h.id} className="rounded-[12px] border border-line px-3 py-2 text-[12px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="font-medium">{RESTRICTION_META[h.kind]?.label ?? h.label}</span>
              <Chip size="sm" tone={h.state === "active" ? "down" : "neutral"}>
                {h.state === "active" ? "Active" : h.state === "expired" ? "Expired" : "Lifted"}
              </Chip>
            </span>
            <span className="text-[11.5px] text-fg-3" title={when(h.created_at, true)}>
              {ago(h.created_at, now)}
            </span>
          </div>
          <div className="mt-1 text-fg-2">
            Set by {h.created_by?.name ?? "staff"}: {h.reason}
            {h.expires_at && <span className="text-fg-3"> · expiry {when(h.expires_at)}</span>}
          </div>
          {h.lifted_at && (
            <div className="mt-0.5 text-fg-3">
              {h.state === "expired" ? `Expired ${when(h.lifted_at)}` : `Lifted by ${h.lifted_by?.name ?? "staff"} ${when(h.lifted_at)}${h.lift_reason ? `: ${h.lift_reason}` : ""}`}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function ChangeDialog({ id, name, pending, current, onClose, onDone }: { id: number; name: string; pending: Pending; current: Restriction | null; onClose: () => void; onDone: () => void }) {
  const m = RESTRICTION_META[pending.kind]!;
  const [reason, setReason] = React.useState("");
  const [expiry, setExpiry] = React.useState<ExpiryChoice>("never");
  const [date, setDate] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const setting = pending.on;
  const title = setting ? (current ? `Change: ${m.label}` : m.label) : `Lift: ${m.label}`;

  async function submit() {
    if (reason.trim().length < 3) return toast.error("Give a reason", { description: "At least 3 characters, e.g. the ticket or case number." });
    setBusy(true);
    let r;
    if (setting) {
      const exp = expiryIso(expiry, date);
      if (exp === "invalid") {
        setBusy(false);
        return toast.error("Choose a future date for the expiry");
      }
      r = await sendJson<Controls>(`/api/admin/client-controls/users/${id}/restrictions/${pending.kind}`, { reason: reason.trim(), expires_at: exp }, "PUT");
    } else {
      r = await sendJson<Controls>(`/api/admin/client-controls/users/${id}/restrictions/${pending.kind}/lift`, { reason: reason.trim() });
    }
    setBusy(false);
    if (!r.ok) return toast.error(setting ? "Couldn't set the restriction" : "Couldn't lift the restriction", { description: r.error.message });
    const ended = (r.data as Controls & { result?: { sessions_ended?: number } }).result?.sessions_ended ?? 0;
    toast.success(setting ? `${m.label}: on for ${name}` : `${m.label}: lifted for ${name}`, {
      description: setting && pending.kind === "login" ? `${ended} session${ended === 1 ? "" : "s"} ended. Recorded in the audit trail.` : "Recorded in the audit trail.",
    });
    onDone();
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      width={500}
      title={title}
      description={setting ? m.help : "The client gets this back at once. The history keeps the original restriction."}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant={setting ? "down-outline" : "ember"} onClick={submit} disabled={busy} data-testid="restriction-confirm">
            {setting ? <Ban /> : null}
            {busy ? "Saving…" : setting ? (pending.kind === "login" ? "Block sign-in" : "Apply restriction") : "Lift restriction"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Reason" hint="Required · audited">
          <TextArea value={reason} onChange={setReason} rows={3} placeholder={setting ? "e.g. AML review, case #4412" : "e.g. Documents received, case closed"} />
        </Field>
        {setting && (
          <Field label="Expiry">
            <div className="space-y-2">
              <Segmented size="xs" value={expiry} onChange={setExpiry} options={EXPIRY.map((e) => ({ value: e.value, label: e.label }))} />
              {expiry === "date" && <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Expiry date" />}
            </div>
          </Field>
        )}
      </div>
    </Dialog>
  );
}
