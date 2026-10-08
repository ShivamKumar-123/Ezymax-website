"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  Flag,
  Gift,
  KeyRound,
  Layers,
  PencilLine,
  Plus,
  Search,
  Trash2,
  User,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { Avatar, Button, Card, Chip, CopyButton, EmptyState, Menu, cn, shortHash } from "@ezymex/ui";
import { PEOPLE } from "@ezymex/mock";
import { SEC_AUDIT, SEC_REASON_LABELS, orgEmployee, type SecActionType, type SecAuditEntry, type SecModule } from "@ezymex/mock/admin-platform-security";
import { JsonDiff, changedKeys } from "./json-diff";
import { Mono, ReasonChip, TenantDot, dayGmt3, timeGmt3 } from "./shared";

export const ACTION_META: Record<SecActionType, { label: string; icon: React.ComponentType<{ className?: string }>; tone: "up" | "down" | "warn" | "info" | "gold" | "ember" }> = {
  approve: { label: "Approve", icon: CheckCircle2, tone: "up" },
  reject: { label: "Reject", icon: XCircle, tone: "down" },
  edit: { label: "Edit", icon: PencilLine, tone: "warn" },
  create: { label: "Create", icon: Plus, tone: "info" },
  delete: { label: "Delete", icon: Trash2, tone: "down" },
  credit: { label: "Credit", icon: Gift, tone: "gold" },
  export: { label: "Export", icon: Download, tone: "info" },
  access: { label: "Access", icon: KeyRound, tone: "ember" },
};

const TONE_CLS = {
  up: "text-up bg-up-soft border-up/25",
  down: "text-down bg-down-soft border-down/25",
  warn: "text-warn bg-warn-soft border-warn/25",
  info: "text-info bg-info-soft border-info/25",
  gold: "text-gold bg-gold-soft border-gold/30",
  ember: "text-ember bg-ember-soft border-ember/30",
} as const;

const TEXT_CLS = { up: "text-up", down: "text-down", warn: "text-warn", info: "text-info", gold: "text-gold", ember: "text-ember" } as const;

const MODULES = [...new Set(SEC_AUDIT.map((e) => e.module))].sort() as SecModule[];
const STAFF = [...new Set(SEC_AUDIT.map((e) => e.staff))];
type DateRange = "today" | "24h" | "7d" | "all";
const DATE_LABEL: Record<DateRange, string> = { today: "Today", "24h": "Last 24 hours", "7d": "Last 7 days", all: "All time" };

function FilterPill({ icon, label, value, active, items }: { icon: React.ReactNode; label: string; value: string; active: boolean; items: Parameters<typeof Menu>[0]["items"] }) {
  return (
    <Menu
      align="start"
      width={240}
      items={items}
      trigger={
        <button
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[12.5px] transition-colors [&_svg]:size-3.5",
            active ? "border-ember/35 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg",
          )}
        >
          <span className={active ? "text-ember" : "text-fg-3"}>{icon}</span>
          <span className="text-fg-3">{label}</span>
          <span className="max-w-[140px] truncate font-medium">{value}</span>
          <ChevronDown className="text-fg-3" />
        </button>
      }
    />
  );
}

function exportCsv(rows: SecAuditEntry[]) {
  const head = ["seq", "time_gmt3", "staff", "module", "action", "target", "target_id", "reason", "ip", "tenant", "hash", "prev_hash"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const body = rows.map((r) => [r.seq, `${dayGmt3(r.time)} ${timeGmt3(r.time)}`, PEOPLE[r.staff]!.name, r.module, r.action, r.target, r.targetId, r.reason, r.ip, r.tenant, r.hash, r.prevHash].map(esc).join(","));
  const blob = new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ezymex-admin-audit-2026-09-24.csv";
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Audit log exported", { description: `${rows.length} entries · signed with chain head ${shortHash(rows[0]?.hash ?? "", 8, 6)}` });
}

export function AuditLog({ onExportRef }: { onExportRef?: React.MutableRefObject<(() => void) | null> }) {
  const [staff, setStaff] = React.useState<number | null>(null);
  const [mod, setMod] = React.useState<SecModule | null>(null);
  const [type, setType] = React.useState<SecActionType | null>(null);
  const [range, setRange] = React.useState<DateRange>("7d");
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState<string | null>(SEC_AUDIT[0]!.id);

  const rows = React.useMemo(() => {
    return SEC_AUDIT.filter((e) => {
      if (staff !== null && e.staff !== staff) return false;
      if (mod && e.module !== mod) return false;
      if (type && e.type !== type) return false;
      if (range === "today" && !e.time.startsWith("2026-09-24")) return false;
      if (range === "24h" && e.time < "2026-09-23T14:32") return false;
      if (q) {
        const hay = `${e.action} ${e.targetId} ${e.ip} ${e.reason} ${PEOPLE[e.staff]!.name} ${e.hash}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [staff, mod, type, range, q]);

  React.useEffect(() => {
    if (onExportRef) onExportRef.current = () => exportCsv(rows);
  }, [rows, onExportRef]);

  const groups = React.useMemo(() => {
    const g: { day: string; items: SecAuditEntry[] }[] = [];
    for (const r of rows) {
      const d = r.time.slice(0, 10);
      const last = g[g.length - 1];
      if (last && last.day === d) last.items.push(r);
      else g.push({ day: d, items: [r] });
    }
    return g;
  }, [rows]);

  const activeCount = [staff !== null, !!mod, !!type, range !== "7d", !!q].filter(Boolean).length;

  return (
    <Card>
      <div className="flex flex-col gap-3 px-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[17px] font-medium tracking-tight">Staff actions</h3>
            <p className="mt-0.5 text-[13px] text-fg-3">
              <span className="k-num text-fg-2">{rows.length}</span> entries · click a row to inspect the before/after snapshot
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5">
              <Search className="size-3.5 text-fg-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Target, IP, hash…" className="w-36 bg-transparent text-[13px] outline-none placeholder:text-fg-3 sm:w-48" />
            </div>
            <Button size="sm" variant="surface" onClick={() => exportCsv(rows)}>
              <Download /> CSV
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill
            icon={<User />}
            label="Staff"
            value={staff === null ? "Everyone" : PEOPLE[staff]!.name}
            active={staff !== null}
            items={[
              { label: "Everyone", onSelect: () => setStaff(null), icon: staff === null ? <Check /> : <span className="size-4" /> },
              "sep",
              ...STAFF.map((s) => ({
                label: PEOPLE[s]!.name,
                hint: orgEmployee(s).title.split(" ·")[0],
                icon: <Avatar src={PEOPLE[s]!.photo} name={PEOPLE[s]!.name} size={18} />,
                onSelect: () => setStaff(s),
              })),
            ]}
          />
          <FilterPill
            icon={<Layers />}
            label="Module"
            value={mod ?? "All"}
            active={!!mod}
            items={[{ label: "All modules", onSelect: () => setMod(null), icon: !mod ? <Check /> : <span className="size-4" /> }, "sep", ...MODULES.map((m) => ({ label: m, onSelect: () => setMod(m), icon: mod === m ? <Check /> : <span className="size-4" /> }))]}
          />
          <FilterPill
            icon={<Zap />}
            label="Action"
            value={type ? ACTION_META[type].label : "All"}
            active={!!type}
            items={[
              { label: "All actions", onSelect: () => setType(null), icon: !type ? <Check /> : <span className="size-4" /> },
              "sep",
              ...(Object.keys(ACTION_META) as SecActionType[]).map((t) => {
                const M = ACTION_META[t];
                return { label: M.label, onSelect: () => setType(t), icon: <M.icon className={TEXT_CLS[M.tone]} />, hint: String(SEC_AUDIT.filter((e) => e.type === t).length) };
              }),
            ]}
          />
          <FilterPill
            icon={<CalendarDays />}
            label="Date"
            value={DATE_LABEL[range]}
            active={range !== "7d"}
            items={(Object.keys(DATE_LABEL) as DateRange[]).map((r) => ({ label: DATE_LABEL[r], onSelect: () => setRange(r), icon: range === r ? <Check /> : <span className="size-4" /> }))}
          />
          {activeCount > 0 && (
            <button
              onClick={() => {
                setStaff(null);
                setMod(null);
                setType(null);
                setRange("7d");
                setQ("");
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] text-fg-3 hover:text-fg"
            >
              <X className="size-3.5" /> Clear {activeCount}
            </button>
          )}
        </div>
      </div>

      {/* column header */}
      <div className="mx-4 mt-4 hidden grid-cols-[92px_minmax(0,1.25fr)_minmax(0,1.5fr)_minmax(0,1fr)_120px_130px_28px] items-center gap-3 rounded-[14px] border border-line bg-surface-2 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.05em] text-fg-3 sm:mx-6 lg:grid">
        <span>Time</span>
        <span>Staff</span>
        <span>Action</span>
        <span>Target</span>
        <span>Reason</span>
        <span>IP · tenant</span>
        <span />
      </div>

      <div className="px-4 pb-5 pt-1 sm:px-6">
        {groups.length === 0 && <EmptyState illustration="magnifying_glass_tilted_left" title="No matching entries" text="Adjust staff, module, action or date filters." />}
        {groups.map((g) => (
          <div key={g.day}>
            <div className="flex items-center gap-3 pb-1 pt-4">
              <span className="k-label">{g.day === "2026-09-24" ? "Today · Thu 24 Sep" : g.day === "2026-09-23" ? "Yesterday · Wed 23 Sep" : g.day}</span>
              <span className="h-px flex-1 bg-line" />
              <span className="k-num text-[11px] text-fg-3">{g.items.length} entries</span>
            </div>
            <div className="relative">
              <span className="absolute bottom-3 left-[7px] top-3 w-px bg-gradient-to-b from-line via-line to-transparent lg:hidden" />
              {g.items.map((e) => (
                <AuditRow key={e.id} e={e} open={open === e.id} onToggle={() => setOpen((o) => (o === e.id ? null : e.id))} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AuditRow({ e, open, onToggle }: { e: SecAuditEntry; open: boolean; onToggle: () => void }) {
  const M = ACTION_META[e.type];
  const p = PEOPLE[e.staff]!;
  const emp = orgEmployee(e.staff);
  const keys = changedKeys(e.before, e.after);
  return (
    <div className={cn("relative border-b border-line transition-colors last:border-b-0", open && "border-transparent")}>
      <button
        onClick={onToggle}
        className={cn(
          "group grid w-full grid-cols-[18px_minmax(0,1fr)] items-start gap-3 rounded-[14px] px-0 py-3 text-left transition-colors lg:grid-cols-[92px_minmax(0,1.25fr)_minmax(0,1.5fr)_minmax(0,1fr)_120px_130px_28px] lg:items-center lg:px-4 lg:hover:bg-surface-2/60",
          open && "lg:bg-surface-2/70",
        )}
      >
        {/* time (desktop) / dot (mobile) */}
        <span className="hidden font-mono text-[12px] text-fg-2 lg:block">
          {timeGmt3(e.time)}
          <span className="block text-[10.5px] text-fg-3">GMT+3</span>
        </span>
        <span className={cn("relative z-[1] mt-1.5 grid size-[15px] place-items-center rounded-full border lg:hidden", TONE_CLS[M.tone])}>
          <span className="size-1.5 rounded-full bg-current" />
        </span>

        <span className="flex min-w-0 flex-col gap-2 lg:contents">
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar src={p.photo} name={p.name} size={30} />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-fg">{p.name}</span>
              <span className="block truncate text-[11px] text-fg-3">{emp.title}</span>
            </span>
            <span className="ml-auto font-mono text-[11px] text-fg-3 lg:hidden">{timeGmt3(e.time, false)}</span>
          </span>

          <span className="flex min-w-0 items-center gap-2.5">
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border [&_svg]:size-3.5", TONE_CLS[M.tone])}>
              <M.icon />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-medium text-fg">{e.action}</span>
              <span className="block truncate text-[11px] text-fg-3">
                {e.module}
                {keys.length > 0 && e.before && e.after ? ` · ${keys.length} field${keys.length > 1 ? "s" : ""} changed` : e.before ? " · removed" : " · created"}
              </span>
            </span>
          </span>

          <span className="min-w-0">
            <span className="block text-[11px] text-fg-3">{e.target}</span>
            <span className="block truncate font-mono text-[12.5px] text-fg">{e.targetId}</span>
          </span>

          <span className="flex flex-wrap items-center gap-2 lg:block">
            <ReasonChip code={e.reason} />
            <span className="block truncate text-[10.5px] text-fg-3 lg:mt-1">{SEC_REASON_LABELS[e.reason]}</span>
          </span>

          <span className="flex items-center gap-2 lg:block">
            <Mono className="block">{e.ip}</Mono>
            <span className="lg:mt-1 lg:block">
              <TenantDot tenant={e.tenant} withName className="text-[11px] text-fg-3" />
            </span>
          </span>
        </span>

        <span className="hidden justify-end lg:flex">
          <span className={cn("grid size-7 place-items-center rounded-full border border-line text-fg-3 transition-all group-hover:text-fg", open && "rotate-180 border-ember/30 bg-ember-soft text-ember")}>
            <ChevronDown className="size-3.5" />
          </span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-4 pb-5 pl-7 pt-2 lg:grid-cols-[minmax(0,1fr)_300px] lg:pl-4 lg:pr-4">
              <JsonDiff before={e.before} after={e.after} />
              <div className="flex flex-col gap-3">
                {e.note && (
                  <div className="rounded-[14px] border border-warn/25 bg-warn-soft px-3.5 py-2.5 text-[12.5px] text-fg-2">
                    <span className="k-label mb-1 block text-warn">Staff note</span>
                    {e.note}
                  </div>
                )}
                <div className="k-row space-y-2.5 px-3.5 py-3 text-[12px]">
                  <Meta k="Entry" v={<span className="font-mono text-fg">#{e.seq.toLocaleString("en-US")}</span>} />
                  <Meta k="Recorded" v={<span className="font-mono">{dayGmt3(e.time)} {timeGmt3(e.time)} GMT+3</span>} />
                  <Meta
                    k="Hash"
                    v={
                      <span className="flex items-center gap-1 font-mono text-ember">
                        {shortHash(e.hash, 10, 6)}
                        <CopyButton value={e.hash} label="Entry hash" className="size-5" />
                      </span>
                    }
                  />
                  <Meta k="Prev hash" v={<span className="font-mono text-fg-3">{shortHash(e.prevHash, 10, 6)}</span>} />
                  <Meta k="Signed by" v={<span>HSM · key ezymex-audit-03</span>} />
                </div>
                {keys.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {keys.map((k) => (
                      <Chip key={k} size="sm" tone="ember" className="font-mono">
                        {k}
                      </Chip>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button size="xs" variant="surface" onClick={() => toast.info(`Opening ${e.target.toLowerCase()} ${e.targetId}`)}>
                    <ExternalLink /> Open target
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => toast.success("Flagged for compliance review", { description: `Entry #${e.seq} assigned to Sofia Rossi (MLRO)` })}>
                    <Flag /> Flag for review
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-fg-3">{k}</span>
      <span className="min-w-0 truncate text-right text-fg-2">{v}</span>
    </div>
  );
}

export { exportCsv as exportAuditCsv };
