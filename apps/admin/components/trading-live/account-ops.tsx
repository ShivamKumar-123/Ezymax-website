"use client";

/**
 * Trading › Accounts lifecycle operations:
 * - Close permanently (C1/C2/C3): a staff closure request with the live checks shown up front; it goes to the
 *   closure queue (Trading › Closures), where a second person approves when four-eyes applies.
 * - Reopen (C12): Super Admin request; another Super Admin approves it in the queue.
 * - Bulk actions (C4): archive expired demos, archive empty dormant accounts (dry run first), CSV export of the
 *   filtered list, and a message to the owners of the filtered accounts (support broadcast, segment = those clients).
 */
import * as React from "react";
import Link from "next/link";
import { Archive, Check, Download, Mail, MoreHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, Field, Input, Menu, Toggle, cn } from "@ezymex/ui";
import { qs, sendJson, useApi } from "@/components/live/kit";
import { useCan } from "@/components/staff-session";
import { DeskDialog, MetaTile } from "@/components/trading-desk/kit";
import type { LiveAccount } from "@/lib/trading-desk";
import { STATUS_LABEL, money2, tradingWrite } from "./kit";

export const CLOSE_REASONS = ["CLS-01 · Client request (phone / email)", "CLS-02 · Duplicate account", "CLS-03 · Compliance / AML", "CLS-04 · Deceased / legal", "CLS-05 · Broker decision", "CLS-99 · Other"] as const;
export const REOPEN_REASONS = ["ROP-01 · Closed in error", "ROP-02 · Client returns", "ROP-03 · Compliance cleared", "ROP-99 · Other"] as const;

type Check = { key: string; ok: boolean; label: string; detail: string };
type CloseCheck = { login: number; kind: string; status: string; checks: Check[]; checksPassed: boolean; balanceUsd: number; fourEyes: boolean; fourEyesUsd: number; pending: { id: number; status: string } | null };

export function CloseAccountDialog({ a, open, onOpenChange }: { a: LiveAccount; open: boolean; onOpenChange: (o: boolean) => void }) {
  const chk = useApi<{ data: CloseCheck }>(open ? `/api/trading/admin/accounts/${a.login}/closure-check` : null);
  const [empty, setEmpty] = React.useState(false);
  React.useEffect(() => {
    if (open) setEmpty(false);
  }, [open]);
  const c = chk.data?.data;
  const open_ = a.positions + a.orders;
  return (
    <DeskDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Close permanently · ${a.login}`}
      description={`${a.groupName} · ${a.type}. Opens a closure request in Trading › Closures. Approval needs every check to pass${c?.fourEyes ? " and two approvers (balance above the four-eyes threshold)" : ""}. The client is told with a client-facing reason; your note stays internal.`}
      codes={CLOSE_REASONS}
      requireNote
      confirmLabel="Open closure request"
      confirmVariant="sell"
      disabled={c?.pending ? `Request #${c.pending.id} is already waiting in the queue` : a.status === "closed" ? "Already closed" : false}
      onConfirm={async (r) => tradingWrite<{ id: number }>(`admin/accounts/${a.login}/closure`, { empty }, r)}
      success={(d) => `Closure request #${d.id} opened for ${a.login}`}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <MetaTile label="Balance" value={money2(a.balance, a.currency)} tone={a.balance ? "warn" : undefined} />
          <MetaTile label="Credit · bonus" value={`${money2(a.credit, a.currency)} · ${money2(a.bonus, a.currency)}`} />
          <MetaTile label="Open" value={`${a.positions} pos · ${a.orders} ord`} tone={open_ ? "warn" : undefined} />
        </div>
        {c && (
          <ul className="space-y-1">
            {c.checks.map((k) => (
              <li key={k.key} className="flex items-start gap-2 text-[12px]">
                <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full", k.ok ? "bg-up/15 text-up" : "bg-down/15 text-down")}>{k.ok ? <Check className="size-2.5" /> : <X className="size-2.5" />}</span>
                <span>
                  <span className="font-medium">{k.label}</span> <span className="text-fg-3">· {k.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {c?.pending && (
          <Link href="/trading/closures" className="block text-[12px] text-ember hover:underline">
            Open the closure queue
          </Link>
        )}
        {open_ > 0 && (
          <label className="flex items-start justify-between gap-3 rounded-[12px] border border-line bg-surface-2/60 px-3 py-2.5 text-[12.5px]">
            <span>
              <span className="block font-medium">Close open trades now (dealer close)</span>
              <span className="block text-[11.5px] text-fg-3">The balance is never moved by this action: pay it out or adjust it with Balance & credit before approval.</span>
            </span>
            <Toggle checked={empty} onChange={setEmpty} label="Close open trades now" />
          </label>
        )}
      </div>
    </DeskDialog>
  );
}

export function ReopenAccountDialog({ a, open, onOpenChange }: { a: LiveAccount; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <DeskDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Reopen account · ${a.login}`}
      description="Super Admin only. Opens a reopen request; a different Super Admin approves it in Trading › Closures (always four-eyes). The account returns to the status it had before it was closed."
      codes={REOPEN_REASONS}
      requireNote
      confirmLabel="Request reopen"
      confirmVariant="gold"
      disabled={a.status !== "closed" ? "Only closed accounts can be reopened" : false}
      onConfirm={async (r) => tradingWrite<{ id: number }>(`admin/accounts/${a.login}/reopen`, {}, r)}
      success={(d) => `Reopen request #${d.id} waits for a second Super Admin`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Bulk actions (C4)                                                   */
/* ------------------------------------------------------------------ */

export type BulkKind = "expired_demos" | "empty_dormant" | "export" | "message";

export function BulkMenu({ onPick }: { onPick: (k: BulkKind) => void }) {
  const canAcc = useCan("accounts.write");
  const canMsg = useCan("notifications.write");
  const items = [
    ...(canAcc
      ? [
          { label: "Archive expired demos…", icon: <Archive />, onSelect: () => onPick("expired_demos") },
          { label: "Archive empty dormant accounts…", icon: <Archive />, onSelect: () => onPick("empty_dormant") },
          "sep" as const,
        ]
      : []),
    { label: "Export filtered list (CSV)", icon: <Download />, onSelect: () => onPick("export") },
    ...(canMsg ? [{ label: "Message owners of filtered accounts…", icon: <Mail />, onSelect: () => onPick("message") }] : []),
  ];
  return (
    <Menu
      width={280}
      items={items}
      trigger={
        <Button variant="surface" size="lg">
          <MoreHorizontal /> Bulk actions
        </Button>
      }
    />
  );
}

type Row = { login: number; userId: number; type: string; group: string; groupName: string; status: string; currency: string; balance: number; credit: number; bonus: number; equity: number; leverage: number; positions: number; orders: number; createdAt: string; dormantSince?: string | null; lastActivityAt?: string | null; name?: string };
type Filters = Record<string, string | number | boolean | undefined>;

/** Every account matching the filters (engine pages of 500, at most 10 000). */
async function fetchAll(filters: Filters): Promise<Row[]> {
  const out: Row[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await fetch(`/api/trading/admin/accounts${qs({ ...filters, page, limit: 500 })}`, { credentials: "same-origin", cache: "no-store" });
    if (!r.ok) throw new Error((await r.json().catch(() => null))?.error?.message ?? "The accounts could not be loaded.");
    const d = (await r.json()) as { items: Row[]; total: number };
    out.push(...d.items);
    if (d.items.length < 500 || out.length >= d.total) break;
  }
  return out;
}

const cell = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function BulkDialog({ kind, filters, onClose, onDone }: { kind: BulkKind | null; filters: Filters; onClose: () => void; onDone: () => void }) {
  const [count, setCount] = React.useState<number | null>(null);
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [email, setEmail] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const archive = kind === "expired_demos" || kind === "empty_dormant";

  React.useEffect(() => {
    setCount(null);
    setRows(null);
    setErr(null);
    setTitle("");
    setBody("");
    setEmail(false);
    if (!kind) return;
    let stop = false;
    if (archive) {
      sendJson<{ data: { count: number } }>("/api/trading/admin/accounts/bulk", { action: "archive", target: kind, dryRun: true }).then((r) => !stop && (r.ok ? setCount(r.data.data.count) : setErr(r.error.message)));
    } else {
      fetchAll(filters)
        .then((x) => !stop && setRows(x))
        .catch((e: Error) => !stop && setErr(e.message));
    }
    return () => {
      stop = true;
    };
    // filters are read once per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  React.useEffect(() => {
    if (kind !== "export" || !rows) return;
    const head = ["Login", "Client ID", "Type", "Group", "Status", "Currency", "Balance", "Credit", "Bonus", "Equity", "Leverage", "Positions", "Orders", "Opened (UTC)", "Last activity (UTC)", "Dormant since (UTC)"];
    const csv = [head.join(","), ...rows.map((r) => [r.login, r.userId, r.type, r.groupName || r.group, STATUS_LABEL[r.status] ?? r.status, r.currency, r.balance, r.credit, r.bonus, r.equity, r.leverage, r.positions, r.orders, r.createdAt, r.lastActivityAt ?? "", r.dormantSince ?? ""].map(cell).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv + "\r\n"], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `trading-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Export ready", { description: `${rows.length} account(s)` });
    onClose();
  }, [kind, rows, onClose]);

  if (!kind || kind === "export") {
    return kind === "export" && err ? (
      <Dialog open onOpenChange={(o) => !o && onClose()} title="Export failed" width={420}>
        <p className="text-[13px] text-down">{err}</p>
      </Dialog>
    ) : null;
  }

  if (archive) {
    return (
      <DeskDialog
        open
        onOpenChange={(o) => !o && onClose()}
        title={kind === "expired_demos" ? "Archive expired demo accounts" : "Archive empty dormant accounts"}
        description={
          kind === "expired_demos"
            ? "Every demo account that expired longer ago than the broker's demo archive period (Trading › Closures › Account policy). Open demo trades are closed. Clients can restore them."
            : "Every live account flagged dormant that is flat with no balance, credit or bonus. Copy, PAMM, MAM and prop accounts are skipped. Clients can restore them."
        }
        codes={["ARC-02 · Dormant / inactive", "ARC-05 · Expired demo cleanup", "ARC-99 · Other"]}
        defaultCode={kind === "expired_demos" ? "ARC-05 · Expired demo cleanup" : "ARC-02 · Dormant / inactive"}
        confirmLabel={count === null ? "Counting…" : `Archive ${count} account(s)`}
        confirmVariant="sell"
        disabled={err ?? (count === null ? "Counting the accounts…" : count === 0 ? "Nothing to archive" : false)}
        onConfirm={async (r) => {
          const res = await sendJson<{ data: { count: number; failed: unknown[] } }>("/api/trading/admin/accounts/bulk", { action: "archive", target: kind, dryRun: false, reasonCode: r.code, note: r.note ?? "" });
          if (!res.ok) return { ok: false as const, error: res.error.message };
          onDone();
          return { ok: true as const, data: res.data.data, audit: [] };
        }}
        success={(d) => `${d.count} account(s) archived${d.failed.length ? ` · ${d.failed.length} skipped` : ""}`}
      >
        <MetaTile label="Accounts" value={count === null ? "…" : count} />
      </DeskDialog>
    );
  }

  // message owners
  const users = rows ? Array.from(new Set(rows.map((r) => r.userId))) : [];
  const send = async () => {
    setBusy(true);
    const r = await sendJson<{ id: number }>("/api/support/broadcasts", { title: title.trim(), body: body.trim(), category: "system", inApp: true, email, segment: { kind: "users", userIds: users.slice(0, 5000) } });
    setBusy(false);
    if (!r.ok) return void toast.error("Not sent", { description: r.error.message });
    toast.success("Message queued", { description: `${users.length} client(s) · track it in Marketing › Notifications` });
    onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Message the owners"
      description={rows ? `${rows.length} account(s) match the filters · ${users.length} client(s) will get it` : "Loading the filtered accounts…"}
      width={520}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ember" size="sm" disabled={busy || !rows || users.length === 0 || !title.trim() || !body.trim()} onClick={() => void send()}>
            <Mail /> {busy ? "Sending…" : `Send to ${users.length} client(s)`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {err && <p className="text-[12.5px] text-down">{err}</p>}
        <Field label="Title">
          <Input value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder="Your inactive trading account" />
        </Field>
        <Field label="Message">
          <textarea value={body} maxLength={2000} rows={5} onChange={(e) => setBody(e.target.value)} className="w-full resize-none rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-ember/50" />
        </Field>
        <label className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-surface-2/60 px-3 py-2.5 text-[12.5px]">
          <span>
            <span className="block font-medium">Also by email</span>
            <span className="block text-[11.5px] text-fg-3">Follows each client's notification preferences. In-app (bell) is always on.</span>
          </span>
          <Toggle checked={email} onChange={setEmail} label="Also by email" />
        </label>
        {users.length > 5000 && <p className="text-[12px] text-warn">Only the first 5,000 clients get it; narrow the filters.</p>}
      </div>
    </Dialog>
  );
}
