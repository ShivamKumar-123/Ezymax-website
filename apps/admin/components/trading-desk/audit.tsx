"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, History, RotateCcw } from "lucide-react";
import { Button, Chip, DataTable, EmptyState, Input, Menu, cn, type Column } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { serverStamp, useDesk, useRestDesk, type AuditAction, type AuditEntry } from "@/lib/trading-desk";
import { ChangeLine } from "./position-drawer";
import { DeskDialog } from "./kit";
import { actionText } from "./labels";

const tone = (a: AuditEntry) =>
  a.action === "trade.rejected" || a.action === "account.rejected" ? "down" : a.action.startsWith("account.") || a.action.startsWith("group.") ? "gold" : a.flags?.includes("price correction") ? "gold" : a.action.startsWith("book") || a.action === "routing.rule" ? "info" : a.action.startsWith("control") ? "warn" : a.action.includes("close") || a.action === "position.stop_out" || a.action === "position.void" ? "ember" : "neutral";

export function AuditTrail() {
  const { state, api } = useDesk();
  const [staff, setStaff] = React.useState<string>("all");
  const [action, setAction] = React.useState<AuditAction | "all">("all");
  const [ticket, setTicket] = React.useState("");
  const [reset, setReset] = React.useState(false);
  const rest = useRestDesk();
  const [older, setOlder] = React.useState<"idle" | "busy" | "done">("idle");
  const staffList = Array.from(new Set(state.audit.map((a) => a.staff.name)));
  const actions = Array.from(new Set(state.audit.map((a) => a.action)));
  const rows = state.audit.filter((a) => (staff === "all" || a.staff.name === staff) && (action === "all" || a.action === action) && (!ticket.trim() || a.tickets.some((t) => t.includes(ticket.trim()))));

  const cols: Column<AuditEntry>[] = [
    { key: "at", header: "Time (GMT+3)", cell: (r) => <span className="whitespace-nowrap font-mono text-[11.5px] text-fg-2">{serverStamp(r.at)}</span>, sort: (r) => r.at, csv: (r) => r.at },
    { key: "id", header: "Entry", hideOn: "xl", cell: (r) => <span className="whitespace-nowrap font-mono text-[11px] text-fg-3">{r.id}</span>, csv: (r) => r.id },
    { key: "st", header: "Staff", cell: (r) => <span className="whitespace-nowrap text-[12.5px]">{r.staff.name}<span className="block text-[10.5px] text-fg-3">{r.staff.role}</span></span>, sort: (r) => r.staff.name },
    {
      key: "ac",
      header: "Action",
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-1">
          <Chip size="sm" tone={tone(r)}>{actionText(r.action)}</Chip>
          {r.flags?.filter((f) => f !== "rejected").map((f) => (
            <Chip key={f} size="sm" tone={f === "price correction" ? "gold" : "neutral"}>{f}</Chip>
          ))}
        </span>
      ),
      csv: (r) => `${r.action}${r.flags?.length ? ` [${r.flags.join("; ")}]` : ""}`,
    },
    {
      key: "t",
      header: "Ticket(s)",
      cell: (r) =>
        r.tickets.length ? (
          <span className="flex flex-col gap-0.5">
            {r.tickets.map((t) => (
              <Link key={t} href={`/trading?ticket=${t}`} className="font-mono text-[11.5px] text-fg-2 hover:text-ember">#{t}</Link>
            ))}
          </span>
        ) : (
          <span className="text-fg-3">—</span>
        ),
      csv: (r) => r.tickets.join(" "),
    },
    { key: "acc", header: "Account · symbol", cell: (r) => <span className="whitespace-nowrap font-mono text-[11.5px] text-fg-2">{[r.login, r.symbol].filter(Boolean).join(" · ") || "—"}</span>, csv: (r) => [r.login, r.symbol].filter(Boolean).join(" ") },
    { key: "ch", header: "Before → after", cell: (r) => <div className="max-w-[340px]"><ChangeLine before={r.before} after={r.after} /></div>, csv: (r) => `${JSON.stringify(r.before ?? {})} -> ${JSON.stringify(r.after ?? {})}` },
    { key: "re", header: "Reason", cell: (r) => <span className="text-[12px]"><span className="font-mono text-[10.5px] text-ember">{r.reasonCode.split(" · ")[0]}</span> {r.reasonCode.split(" · ")[1]}{r.note && <span className="block max-w-[220px] truncate text-[11px] text-fg-3" title={r.note}>“{r.note}”</span>}</span>, csv: (r) => `${r.reasonCode}${r.note ? ` — ${r.note}` : ""}` },
  ];

  const menu = <T extends string>(label: string, value: T | "all", set: (v: T | "all") => void, opts: { value: T; label: string }[]) => (
    <Menu
      align="start"
      width={240}
      items={[{ label: `All ${label}`, onSelect: () => set("all") }, "sep", ...opts.map((o) => ({ label: o.label, onSelect: () => set(o.value) }))]}
      trigger={
        <Button size="sm" variant="surface" className={cn(value !== "all" && "border-ember/40")}>
          {value === "all" ? `All ${label}` : opts.find((o) => o.value === value)?.label} <ChevronDown />
        </Button>
      }
    />
  );

  return (
    <>
      <DataTable
        columns={cols}
        rows={rows}
        dense
        pageSize={15}
        rowKey={(r) => r.id}
        exportName="dealing-audit-trail"
        search={(r) => `${r.id} ${r.tickets.join(" ")} ${r.login ?? ""} ${r.symbol ?? ""} ${r.staff.name} ${r.reasonCode} ${r.note}`}
        searchPlaceholder="Search entries…"
        empty={<EmptyState title="No dealing actions yet" text="Every dealer action — trades, modifications, book transfers, controls — lands here with the staff member and reason." illustration="receipt" />}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            {menu("staff", staff, setStaff, staffList.map((s) => ({ value: s, label: s })))}
            {menu("actions", action, setAction, actions.map((a) => ({ value: a, label: actionText(a) })))}
            <Input value={ticket} onChange={(e) => setTicket(e.target.value.replace(/\D/g, ""))} placeholder="Ticket" aria-label="Filter by ticket" className="h-8 w-28 rounded-full font-mono text-[12.5px]" />
            {IS_DEMO ? (
              <Button size="sm" variant="ghost" onClick={() => setReset(true)}>
                <RotateCcw /> Reset demo data
              </Button>
            ) : (
              rest && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={older !== "idle" || !state.audit.length}
                  onClick={async () => {
                    setOlder("busy");
                    const n = await rest.loadOlderAudit();
                    setOlder(n < 500 ? "done" : "idle");
                  }}
                >
                  <History /> {older === "busy" ? "Loading…" : older === "done" ? "All entries loaded" : "Load older entries"}
                </Button>
              )
            )}
          </div>
        }
      />
      <DeskDialog
        open={reset}
        onOpenChange={setReset}
        title="Reset dealing demo data"
        description="Restores the seeded positions, orders, controls and routing rules. The audit trail is kept (append-only) and records the reset."
        confirmLabel="Reset desk data"
        confirmVariant="sell"
        onConfirm={(r) => api.reset(r)}
        success="Desk data reset"
      />
    </>
  );
}
