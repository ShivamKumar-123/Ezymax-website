"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Copy,
  Crown,
  Download,
  Eye,
  FileCheck2,
  FilePlus2,
  Lock,
  MoreHorizontal,
  PencilLine,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button, Card, Chip, IconButton, Input, Menu, Toggle, cn } from "@kalks/ui";
import {
  ORG_ACTIONS,
  ORG_EMPLOYEES,
  ORG_MODULES,
  ORG_PRESET_TEMPLATES,
  ORG_ROLES,
  orgMatrix,
  type OrgAction,
  type OrgModuleKey,
  type OrgPermMatrix,
  type OrgRole,
} from "@kalks/mock/admin-platform-security";
import { PEOPLE } from "@kalks/mock";
import { PermCheckbox } from "./perm-checkbox";
import { AvatarStack } from "./shared";

const ACTION_META: Record<OrgAction, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  view: { label: "View", icon: Eye },
  create: { label: "Create", icon: FilePlus2 },
  edit: { label: "Edit", icon: PencilLine },
  approve: { label: "Approve", icon: FileCheck2 },
  export: { label: "Export", icon: Download },
};

const TONE_DOT: Record<OrgRole["tone"], string> = {
  ember: "bg-ember",
  gold: "bg-gold",
  up: "bg-up",
  down: "bg-down",
  info: "bg-info",
  warn: "bg-warn",
  neutral: "bg-fg-3",
};

/** Sensitive combinations that raise a warning. */
const SENSITIVE: [OrgModuleKey, OrgAction][] = [
  ["withdrawals", "approve"],
  ["finance", "edit"],
  ["config", "edit"],
  ["trading", "edit"],
  ["clients", "export"],
  ["security", "edit"],
  ["org", "edit"],
];

type Settings = Pick<OrgRole, "fourEyes" | "fourEyesAbove" | "maskPii" | "exportReason">;
const clone = (m: OrgPermMatrix): OrgPermMatrix => JSON.parse(JSON.stringify(m));
const countOn = (m: OrgPermMatrix) => ORG_MODULES.reduce((s, mod) => s + ORG_ACTIONS.filter((a) => m[mod.key][a]).length, 0);
const TOTAL = ORG_MODULES.length * ORG_ACTIONS.length;

function membersOf(r: OrgRole) {
  const byRole = ORG_EMPLOYEES.filter((e) => e.role === r.key).map((e) => ({ src: e.person.photo, name: e.name }));
  if (byRole.length) return byRole;
  return [PEOPLE[14]!, PEOPLE[15]!, PEOPLE[12]!].slice(0, r.members).map((p) => ({ src: p.photo, name: p.name }));
}

export function PermissionBuilder() {
  const [roles, setRoles] = React.useState<OrgRole[]>(ORG_ROLES);
  const [sel, setSel] = React.useState<string>("risk");
  const role = roles.find((r) => r.key === sel)!;
  const [perms, setPerms] = React.useState<OrgPermMatrix>(() => clone(role.perms));
  const [settings, setSettings] = React.useState<Settings>(() => ({ fourEyes: role.fourEyes, fourEyesAbove: role.fourEyesAbove, maskPii: role.maskPii, exportReason: role.exportReason }));
  const [name, setName] = React.useState(role.name);

  const locked = role.key === "super";

  const load = (r: OrgRole) => {
    setSel(r.key);
    setPerms(clone(r.perms));
    setSettings({ fourEyes: r.fourEyes, fourEyesAbove: r.fourEyesAbove, maskPii: r.maskPii, exportReason: r.exportReason });
    setName(r.name);
  };

  const dirtyPerms = JSON.stringify(perms) !== JSON.stringify(role.perms);
  const dirtySettings = settings.fourEyes !== role.fourEyes || settings.fourEyesAbove !== role.fourEyesAbove || settings.maskPii !== role.maskPii || settings.exportReason !== role.exportReason;
  const dirty = dirtyPerms || dirtySettings || name !== role.name;
  const changes = ORG_MODULES.reduce((s, m) => s + ORG_ACTIONS.filter((a) => perms[m.key][a] !== role.perms[m.key][a]).length, 0) + (dirtySettings ? 1 : 0) + (name !== role.name ? 1 : 0);

  const select = (r: OrgRole) => {
    if (r.key === sel) return;
    if (dirty) toast.warning(`Unsaved changes to ${role.name} discarded`);
    load(r);
  };

  const set = (m: OrgModuleKey, a: OrgAction, v: boolean) => {
    if (locked) return;
    setPerms((p) => {
      const n = clone(p);
      n[m][a] = v;
      if (a === "view" && !v) for (const x of ORG_ACTIONS) n[m][x] = false;
      if (a !== "view" && v) n[m].view = true;
      return n;
    });
  };
  const setRow = (m: OrgModuleKey, v: boolean) => {
    if (locked) return;
    setPerms((p) => {
      const n = clone(p);
      for (const a of ORG_ACTIONS) n[m][a] = v;
      return n;
    });
  };
  const setCol = (a: OrgAction, v: boolean) => {
    if (locked) return;
    setPerms((p) => {
      const n = clone(p);
      for (const m of ORG_MODULES) {
        n[m.key][a] = v;
        if (v && a !== "view") n[m.key].view = true;
        if (!v && a === "view") for (const x of ORG_ACTIONS) n[m.key][x] = false;
      }
      return n;
    });
  };

  const save = () => {
    setRoles((rs) => rs.map((r) => (r.key === sel ? { ...r, perms: clone(perms), ...settings, name, updated: "2026-09-24", updatedBy: 4 } : r)));
    toast.success(`${name} saved`, { description: `${changes} change${changes === 1 ? "" : "s"} · applies to ${role.members} member${role.members === 1 ? "" : "s"} on next request · logged to audit` });
  };
  const discard = () => {
    load(role);
    toast.info("Changes discarded");
  };

  const applyPreset = (key: string) => {
    const t = ORG_PRESET_TEMPLATES.find((x) => x.key === key)!;
    setPerms(clone(t.perms));
    toast.success(`${t.name} template applied`, { description: "Review the grid and save to apply" });
  };

  const newRole = () => {
    const key = `custom-${roles.length + 1}`;
    const r: OrgRole = {
      key,
      name: "New custom role",
      description: "Start from scratch or apply a preset template.",
      preset: false,
      tone: "neutral",
      members: 0,
      perms: orgMatrix({}),
      fourEyes: true,
      fourEyesAbove: 10000,
      maskPii: true,
      exportReason: true,
      updated: "2026-09-24",
      updatedBy: 4,
    };
    setRoles((rs) => [...rs, r]);
    load(r);
    toast.success("Custom role created", { description: "Tick the permissions it needs, then save" });
  };

  const duplicate = (src: OrgRole) => {
    const key = `custom-${roles.length + 1}`;
    const r: OrgRole = { ...src, key, name: `${src.name} (copy)`, preset: false, members: 0, perms: clone(src.perms), tone: "neutral" };
    setRoles((rs) => [...rs, r]);
    load(r);
    toast.success(`Duplicated ${src.name}`);
  };

  const on = countOn(perms);
  const sensitive = SENSITIVE.filter(([m, a]) => perms[m][a]);
  const presets = roles.filter((r) => r.preset);
  const customs = roles.filter((r) => !r.preset);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      {/* Roles list */}
      <Card className="self-start xl:col-span-3">
        <div className="flex items-center justify-between px-5 pt-5">
          <div>
            <h3 className="text-[17px] font-medium tracking-tight">Roles</h3>
            <p className="mt-0.5 text-[12.5px] text-fg-3">{roles.length} roles · {ORG_EMPLOYEES.length} staff</p>
          </div>
          <IconButton size="sm" onClick={newRole} aria-label="New role">
            <Plus />
          </IconButton>
        </div>
        <div className="px-3 pb-4 pt-3">
          <div className="k-label px-2 pb-1.5 pt-1">Presets</div>
          {presets.map((r) => (
            <RoleItem key={r.key} r={r} active={r.key === sel} onClick={() => select(r)} onDuplicate={() => duplicate(r)} />
          ))}
          <div className="k-label px-2 pb-1.5 pt-4">Custom</div>
          {customs.map((r) => (
            <RoleItem
              key={r.key}
              r={r}
              active={r.key === sel}
              onClick={() => select(r)}
              onDuplicate={() => duplicate(r)}
              onDelete={() => {
                if (r.members > 0) {
                  toast.error(`Can't delete ${r.name}`, { description: `Reassign its ${r.members} member${r.members > 1 ? "s" : ""} first` });
                  return;
                }
                setRoles((rs) => rs.filter((x) => x.key !== r.key));
                if (r.key === sel) load(roles.find((x) => x.key === "risk")!);
                toast.success(`${r.name} deleted`);
              }}
            />
          ))}
          <button onClick={newRole} className="mt-2 flex w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-line py-2.5 text-[12.5px] text-fg-3 transition-colors hover:border-ember/40 hover:text-ember">
            <Plus className="size-3.5" /> Build custom role
          </button>
        </div>
      </Card>

      {/* Matrix */}
      <div className="flex min-w-0 flex-col gap-4 xl:col-span-9">
        <Card>
          <div className="flex flex-col gap-4 px-5 pt-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("size-2.5 rounded-full", TONE_DOT[role.tone])} />
                {role.preset ? (
                  <h3 className="text-[20px] font-medium tracking-tight">{role.name}</h3>
                ) : (
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-64 rounded-full" inputClassName="text-[15px] font-medium" aria-label="Role name" />
                )}
                {role.preset ? <Chip size="sm">Preset</Chip> : <Chip size="sm" tone="gold">Custom</Chip>}
                {locked && (
                  <Chip size="sm" tone="ember">
                    <Lock className="size-3" /> System role · read-only
                  </Chip>
                )}
              </div>
              <p className="mt-1.5 text-[13px] text-fg-3">{role.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-fg-3">
                <AvatarStack photos={membersOf(role)} max={6} size={24} />
                <span>
                  <span className="k-num text-fg-2">{role.members}</span> member{role.members === 1 ? "" : "s"}
                </span>
                <span>·</span>
                <span>
                  Updated <span className="font-mono">{role.updated}</span> by {PEOPLE[role.updatedBy]!.name}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Menu
                width={260}
                header={<div className="text-[12px] text-fg-3">Replaces the current grid. You can still tweak before saving.</div>}
                trigger={
                  <Button size="sm" variant="surface" disabled={locked}>
                    <Wand2 /> Apply preset template
                  </Button>
                }
                items={ORG_PRESET_TEMPLATES.map((t) => ({ label: t.name, hint: `${countOn(t.perms)}/${TOTAL}`, icon: t.key === "super" ? <Crown /> : <Sparkles />, onSelect: () => applyPreset(t.key) }))}
              />
              <Menu
                trigger={
                  <IconButton size="sm" aria-label="Role options">
                    <MoreHorizontal />
                  </IconButton>
                }
                items={[
                  { label: "Duplicate role", icon: <Copy />, onSelect: () => duplicate(role) },
                  { label: "Export as JSON", icon: <Download />, onSelect: () => toast.success(`${role.key}.permissions.json exported`, { description: `${on} permissions` }) },
                  { label: "View members", icon: <ShieldCheck />, href: "/org" },
                ]}
              />
            </div>
          </div>

          {/* coverage bar */}
          <div className="mx-5 mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[14px] border border-line bg-surface-2/60 px-4 py-3 sm:mx-6">
            <div className="flex items-baseline gap-1.5">
              <span className="k-num text-[18px] font-semibold">{on}</span>
              <span className="k-num text-[12px] text-fg-3">/ {TOTAL} permissions</span>
            </div>
            <div className="h-1.5 min-w-[120px] flex-1 overflow-hidden rounded-full bg-surface-3">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-ember to-gold" animate={{ width: `${(on / TOTAL) * 100}%` }} transition={{ type: "spring", bounce: 0.1, duration: 0.5 }} />
            </div>
            {ORG_ACTIONS.map((a) => (
              <span key={a} className="hidden items-center gap-1 text-[11.5px] text-fg-3 md:inline-flex">
                {ACTION_META[a].label} <span className="k-num text-fg-2">{ORG_MODULES.filter((m) => perms[m.key][a]).length}</span>
              </span>
            ))}
          </div>

          {/* grid */}
          <div className="overflow-x-auto px-3 pb-5 pt-3 sm:px-4">
            <table className="w-full min-w-[640px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-[0.05em] text-fg-3">Module</th>
                  {ORG_ACTIONS.map((a) => {
                    const n = ORG_MODULES.filter((m) => perms[m.key][a]).length;
                    const A = ACTION_META[a];
                    return (
                      <th key={a} className="w-[92px] px-1 py-2">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.05em] text-fg-3">
                            <A.icon className="size-3" />
                            {A.label}
                          </span>
                          <PermCheckbox
                            size={18}
                            tone="gold"
                            label={`Toggle ${A.label} for all modules`}
                            checked={n === ORG_MODULES.length}
                            partial={n > 0 && n < ORG_MODULES.length}
                            disabled={locked}
                            onChange={() => setCol(a, n !== ORG_MODULES.length)}
                          />
                        </div>
                      </th>
                    );
                  })}
                  <th className="w-[72px] px-1 py-2 text-center text-[11px] font-medium uppercase tracking-[0.05em] text-fg-3">All</th>
                </tr>
              </thead>
              <tbody>
                {ORG_MODULES.map((m, i) => {
                  const n = ORG_ACTIONS.filter((a) => perms[m.key][a]).length;
                  const changedRow = ORG_ACTIONS.some((a) => perms[m.key][a] !== role.perms[m.key][a]);
                  return (
                    <tr key={m.key} className="group">
                      <td className={cn("rounded-l-[12px] border-y border-l border-transparent px-3 py-2 transition-colors group-hover:bg-surface-2/70", i % 2 === 0 && "bg-surface-2/30")}>
                        <div className="flex items-center gap-2.5">
                          <span className={cn("h-6 w-[3px] rounded-full transition-colors", changedRow ? "bg-ember" : n ? "bg-fg-3/40" : "bg-surface-3")} />
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-medium">{m.label}</div>
                            <div className="truncate text-[11px] text-fg-3">{m.hint}</div>
                          </div>
                        </div>
                      </td>
                      {ORG_ACTIONS.map((a) => {
                        const changed = perms[m.key][a] !== role.perms[m.key][a];
                        const sens = SENSITIVE.some(([sm, sa]) => sm === m.key && sa === a);
                        return (
                          <td key={a} className={cn("px-1 py-2 text-center transition-colors group-hover:bg-surface-2/70", i % 2 === 0 && "bg-surface-2/30")}>
                            <div className="relative inline-grid place-items-center">
                              <PermCheckbox checked={perms[m.key][a]} disabled={locked} label={`${m.label} ${a}`} onChange={(v) => set(m.key, a, v)} />
                              {changed && <span className="absolute -right-1.5 -top-1.5 size-2 rounded-full bg-gold ring-2 ring-surface" />}
                              {sens && perms[m.key][a] && !changed && <span className="absolute -right-1.5 -top-1.5 size-1.5 rounded-full bg-warn" />}
                            </div>
                          </td>
                        );
                      })}
                      <td className={cn("rounded-r-[12px] px-1 py-2 text-center transition-colors group-hover:bg-surface-2/70", i % 2 === 0 && "bg-surface-2/30")}>
                        <button
                          disabled={locked}
                          onClick={() => setRow(m.key, n < ORG_ACTIONS.length)}
                          className={cn(
                            "k-num inline-flex h-6 min-w-[44px] items-center justify-center rounded-full border px-2 text-[11px] transition-colors disabled:opacity-50",
                            n === ORG_ACTIONS.length ? "border-ember/40 bg-ember-soft text-ember" : n ? "border-line bg-surface-3 text-fg-2" : "border-line text-fg-3 hover:text-fg",
                          )}
                        >
                          {n === ORG_ACTIONS.length ? "All" : n ? `${n}/5` : "None"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 px-3 text-[11.5px] text-fg-3">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-gold" /> Unsaved change
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-warn" /> Sensitive permission
              </span>
              <span>Granting any action auto-grants View · removing View clears the row.</span>
            </div>
          </div>
        </Card>

        {/* Guardrails */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Guard
            title="4-eyes approval"
            text="A second approver is required for money-moving actions above the threshold."
            checked={settings.fourEyes}
            disabled={locked}
            onChange={(v) => setSettings((s) => ({ ...s, fourEyes: v }))}
          >
            <div className={cn("mt-3 transition-opacity", !settings.fourEyes && "pointer-events-none opacity-40")}>
              <Input
                value={settings.fourEyesAbove.toLocaleString("en-US")}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/[^\d]/g, ""));
                  if (!Number.isNaN(n)) setSettings((s) => ({ ...s, fourEyesAbove: n }));
                }}
                leading={<span className="text-[13px]">$</span>}
                trailing={<span className="text-[11px]">USD</span>}
                inputClassName="k-num"
                className="h-9"
                aria-label="4-eyes threshold"
              />
              <div className="mt-2 flex gap-1.5">
                {[5000, 10000, 25000].map((v) => (
                  <button key={v} onClick={() => setSettings((s) => ({ ...s, fourEyesAbove: v }))} className={cn("k-num rounded-full border px-2.5 py-0.5 text-[11px]", settings.fourEyesAbove === v ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-3 hover:text-fg")}>
                    ${v / 1000}k
                  </button>
                ))}
              </div>
            </div>
          </Guard>
          <Guard title="Mask PII" text="Emails, phones, addresses and document numbers are masked (a••••@mail.com). Reveal is logged." checked={settings.maskPii} disabled={locked} onChange={(v) => setSettings((s) => ({ ...s, maskPii: v }))}>
            <div className="mt-3 rounded-[12px] border border-line bg-surface-2 px-3 py-2 font-mono text-[11.5px] text-fg-2">{settings.maskPii ? "fa••••@mail.com · +971 •• ••• 4412" : "fatima.al.sayed@mail.com · +971 50 318 4412"}</div>
          </Guard>
          <Guard title="Export requires reason" text="Every CSV/XLSX export asks for a reason code and is watermarked with the staff ID." checked={settings.exportReason} disabled={locked} onChange={(v) => setSettings((s) => ({ ...s, exportReason: v }))}>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["EXP-REGULATOR", "EXP-CAMPAIGN", "EXP-AUDIT"].map((c) => (
                <Chip key={c} size="sm" className={cn("font-mono", !settings.exportReason && "opacity-40")}>
                  {c}
                </Chip>
              ))}
            </div>
          </Guard>
        </div>

        {sensitive.length > 0 && (
          <div className="flex items-start gap-3 rounded-[16px] border border-warn/25 bg-warn-soft px-4 py-3 text-[12.5px] text-fg-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
            <div>
              <span className="font-medium text-warn">{sensitive.length} sensitive permission{sensitive.length > 1 ? "s" : ""} granted: </span>
              {sensitive.map(([m, a]) => `${ORG_MODULES.find((x) => x.key === m)!.label} · ${ACTION_META[a].label}`).join(", ")}.{" "}
              {settings.fourEyes ? "4-eyes approval is on." : "Consider enabling 4-eyes approval."}
            </div>
          </div>
        )}
      </div>

      {/* Save bar */}
      <AnimatePresence>
        {dirty && !locked && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
            className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-[720px] items-center gap-3 rounded-full border border-[var(--k-border-top)] bg-surface-2/95 py-2 pl-5 pr-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,90,31,0.15)] backdrop-blur md:bottom-6"
          >
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-gold" />
            <span className="min-w-0 flex-1 truncate text-[13px]">
              <span className="font-medium">{changes} unsaved change{changes === 1 ? "" : "s"}</span>
              <span className="hidden text-fg-3 sm:inline"> to {name} · affects {role.members} member{role.members === 1 ? "" : "s"}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={discard}>
              Discard
            </Button>
            <Button size="sm" variant="ember" onClick={save}>
              Save changes
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RoleItem({ r, active, onClick, onDuplicate, onDelete }: { r: OrgRole; active: boolean; onClick: () => void; onDuplicate: () => void; onDelete?: () => void }) {
  const n = countOn(r.perms);
  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-[14px] border px-3 py-2.5 transition-colors",
        active ? "border-ember/30 bg-ember-soft" : "border-transparent hover:bg-surface-2",
      )}
    >
      {active && <motion.span layoutId="role-active" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-ember" />}
      <span className={cn("size-2 shrink-0 rounded-full", TONE_DOT[r.tone])} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium">{r.name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-3">
          <span className="k-num">{n}</span> perms
          <span className="h-1 w-10 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full rounded-full bg-fg-3" style={{ width: `${(n / TOTAL) * 100}%` }} />
          </span>
        </div>
      </div>
      <span className={cn("k-num rounded-full px-2 py-0.5 text-[11px]", active ? "bg-ember/20 text-ember" : "bg-surface-3 text-fg-2")}>{r.members}</span>
      <div onClick={(e) => e.stopPropagation()} className="opacity-0 transition-opacity group-hover:opacity-100">
        <Menu
          width={180}
          trigger={
            <button className="grid size-6 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label={`${r.name} options`}>
              <MoreHorizontal className="size-3.5" />
            </button>
          }
          items={[{ label: "Duplicate", icon: <Copy />, onSelect: onDuplicate }, ...(onDelete ? ["sep" as const, { label: "Delete role", icon: <Trash2 />, danger: true, onSelect: onDelete }] : [])]}
        />
      </div>
    </div>
  );
}

function Guard({ title, text, checked, onChange, disabled, children }: { title: string; text: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; children?: React.ReactNode }) {
  return (
    <Card className={cn("px-5 py-4 transition-colors", checked && "border-ember/20")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[14px] font-medium">{title}</div>
          <p className="mt-1 text-[12px] leading-snug text-fg-3">{text}</p>
        </div>
        <div className={cn(disabled && "pointer-events-none opacity-50")}>
          <Toggle checked={checked} onChange={onChange} label={title} />
        </div>
      </div>
      {children}
    </Card>
  );
}
