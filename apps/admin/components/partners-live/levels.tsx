"use client";

import * as React from "react";
import Link from "next/link";
import { Pencil, Plus, RefreshCw, RotateCcw, Save, Trash2 } from "lucide-react";
import { ANIM_ICONS, Button, Card, CardHeader, Chip, Dialog, DialogClose, Icon3D, IconGlyph, PageHeader, Reveal, Skeleton, cn } from "@kalks/ui";
import { ChipList, MiniField, NumInput, SettingRow, TextInput } from "@/components/config/kit";
import { useApi, when } from "@/components/live/kit";
import { P, ibSend, levelBody, type Level, type LevelsDoc, type SettingsDoc } from "./api";
import { PartnersError, ReadOnlyNote, int, levelStyle, lots, usd, usePerms, useReasonAction } from "./kit";

const ICONS = ["coin", "crown", "1st_place_medal", "trophy", "gem_stone", "rocket", "sparkles", "handshake", "money_bag", "shield", "key", "bank"].filter((k) => k in ANIM_ICONS);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function LevelCard({ l, levels, total, edited, canEdit, onEdit }: { l: Level; levels: Level[]; total: number; edited: boolean; canEdit: boolean; onEdit: () => void }) {
  const st = levelStyle(l.key, levels);
  const entry = l.rank === Math.min(...levels.map((x) => x.rank));
  const members = l.members ?? 0;
  const rows: [string, string][] = [
    ["Active clients", entry ? "Entry level" : `≥ ${int(l.minActiveClients)}`],
    ["Network lots / month", entry ? "—" : `≥ ${lots(l.minMonthlyLots, 0)}`],
    ["CPA per client", usd(l.cpaAmount, 0)],
  ];
  return (
    <Card className="relative flex h-full flex-col">
      <div className="absolute inset-x-6 top-0 h-px" style={{ background: st.color }} />
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="k-label">Rank {l.rank}</span>
            {edited && (
              <Chip size="sm" tone="warn" dot>
                Edited
              </Chip>
            )}
          </div>
          <div className="mt-1 truncate text-[21px] font-medium tracking-tight">{l.name || <span className="text-fg-3">Unnamed</span>}</div>
          <div className="mt-1 text-[12.5px] text-fg-3">
            {l.members === undefined ? (
              "New level"
            ) : (
              <>
                <span className="k-num font-medium text-fg">{int(members)}</span> members{total ? ` · ${((members / total) * 100).toFixed(1)}%` : ""}
              </>
            )}
          </div>
        </div>
        <Icon3D name={l.icon} size={44} />
      </div>
      <div className="mx-5 mt-4 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full" style={{ width: `${total ? Math.max(members ? 3 : 0, (members / total) * 100) : 0}%`, background: st.color }} />
      </div>
      <div className="px-5 pt-4">
        <div className="mb-1 text-[11px] uppercase tracking-wider text-fg-3">Targets</div>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between py-1 text-[12.5px]">
            <span className="text-fg-3">{k}</span>
            <span className="k-num text-fg">{v}</span>
          </div>
        ))}
      </div>
      <div className="mx-5 my-3 h-px bg-line" />
      <div className="flex-1 px-5">
        <div className="mb-1 text-[11px] uppercase tracking-wider text-fg-3">Perks</div>
        {l.perks.length === 0 ? (
          <div className="py-1 text-[12.5px] text-fg-3">None listed</div>
        ) : (
          <ul className="space-y-1 text-[12.5px] text-fg-2">
            {l.perks.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-[7px] size-1 shrink-0 rounded-full bg-fg-3" />
                {p}
              </li>
            ))}
          </ul>
        )}
      </div>
      {canEdit && (
        <div className="px-5 pb-5 pt-4">
          <Button size="sm" variant="surface" className="w-full" onClick={onEdit}>
            <Pencil /> Edit level
          </Button>
        </div>
      )}
      {!canEdit && <div className="pb-5" />}
    </Card>
  );
}

function LevelDialog({
  level,
  isNew,
  levels,
  open,
  onOpenChange,
  onSave,
  onRemove,
}: {
  level: Level | null;
  isNew: boolean;
  levels: Level[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (l: Level) => void;
  onRemove: () => void;
}) {
  const [d, setD] = React.useState<Level | null>(level);
  React.useEffect(() => setD(level), [level]);
  if (!d) return null;
  const set = (p: Partial<Level>) => setD({ ...d, ...p });
  const others = levels.filter((l) => l.key !== level?.key);
  const rankTaken = others.some((l) => l.rank === d.rank);
  const keyBad = !/^[a-z0-9_-]{1,32}$/.test(d.key) || (isNew && others.some((l) => l.key === d.key));
  const problem = !d.name.trim() ? "Give the level a name." : d.name.length > 40 ? "Name is too long (40 max)." : keyBad ? "Key must be 1–32 lowercase letters, digits, - or _, and unique." : rankTaken ? `Rank ${d.rank} is already used.` : d.rank < 1 ? "Rank starts at 1." : null;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={620}
      title={isNew ? "New level" : `Edit ${level?.name}`}
      description="Changes are staged on this page. Nothing is saved until you press Save changes."
      footer={
        <>
          {!isNew && (
            <Button variant="ghost" size="sm" className="mr-auto text-down" disabled={levels.length <= 1} onClick={onRemove}>
              <Trash2 /> Remove level
            </Button>
          )}
          {problem && <span className="mr-auto text-[11.5px] text-down">{problem}</span>}
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="ember"
            size="sm"
            disabled={!!problem}
            onClick={() => {
              onSave({ ...d, name: d.name.trim(), perks: d.perks.map((p) => p.trim()).filter(Boolean) });
              onOpenChange(false);
            }}
          >
            {isNew ? "Add level" : "Apply"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniField label="Name" className="sm:col-span-2">
            <TextInput value={d.name} onChange={(v) => set(isNew ? { name: v, key: v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) } : { name: v })} placeholder="e.g. Elite" />
          </MiniField>
          <MiniField label="Rank" hint="1 = entry">
            <NumInput value={d.rank} onChange={(v) => set({ rank: Math.max(1, Math.round(v)) })} min={1} max={50} stepper />
          </MiniField>
        </div>
        <div className="font-mono text-[11px] text-fg-3">key {d.key || "—"}{isNew ? "" : " (fixed)"}</div>
        <div>
          <div className="mb-1.5 text-[12px] font-medium text-fg-2">Icon</div>
          <div className="flex flex-wrap gap-1.5">
            {ICONS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => set({ icon: k })}
                aria-label={k}
                className={cn("grid size-9 place-items-center rounded-[10px] border", d.icon === k ? "border-ember/60 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2 hover:text-fg")}
              >
                <IconGlyph name={k} className="size-4" />
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniField label="Active clients" hint="this month">
            <NumInput value={d.minActiveClients} onChange={(v) => set({ minActiveClients: Math.max(0, Math.round(v)) })} min={0} step={5} />
          </MiniField>
          <MiniField label="Network lots" hint="per month">
            <NumInput value={d.minMonthlyLots} onChange={(v) => set({ minMonthlyLots: v })} min={0} step={50} />
          </MiniField>
          <MiniField label="CPA per client">
            <NumInput value={d.cpaAmount} onChange={(v) => set({ cpaAmount: v })} min={0} step={25} prefix="$" />
          </MiniField>
        </div>
        <MiniField label="Perks" hint="shown to IBs">
          <ChipList values={d.perks} onChange={(v) => set({ perks: v })} placeholder="Add a perk, Enter" tone="neutral" />
        </MiniField>
        {isNew && <div className="rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 text-[12px] text-fg-3">Per-lot rates start as a copy of the level below. Adjust them in Commission plans after saving.</div>}
      </div>
    </Dialog>
  );
}

export function LiveLevels() {
  const perms = usePerms();
  const ld = useApi<LevelsDoc>(P("levels"));
  const sd = useApi<SettingsDoc>(P("settings"));
  const act = useReasonAction();
  const base = React.useMemo(() => [...(ld.data?.levels ?? [])].sort((a, b) => a.rank - b.rank), [ld.data]);
  const [draft, setDraft] = React.useState<Level[]>([]);
  React.useEffect(() => setDraft(base), [base]);
  const [edit, setEdit] = React.useState<{ level: Level; isNew: boolean } | null>(null);
  const sorted = [...draft].sort((a, b) => a.rank - b.rank);
  const total = base.reduce((s, l) => s + (l.members ?? 0), 0);
  const dirty = !same(draft.map(levelBody).sort((a, b) => a.rank - b.rank), base.map(levelBody));
  const removed = base.filter((b) => !draft.some((d) => d.key === b.key));
  const moving = removed.reduce((s, l) => s + (l.members ?? 0), 0);
  const allowDemotion = sd.data ? !!sd.data.settings.allowDemotion : null;

  const addLevel = () => {
    const top = sorted[sorted.length - 1];
    const rank = (top?.rank ?? 0) + 1;
    setEdit({ level: { key: "", name: "", rank, icon: "trophy", perks: [], minActiveClients: top?.minActiveClients ?? 0, minMonthlyLots: top?.minMonthlyLots ?? 0, cpaAmount: top?.cpaAmount ?? 0, rates: { ...(top?.rates ?? {}) } }, isNew: true });
  };

  const save = () =>
    act.ask({
      title: "Save levels",
      description: `${sorted.length} levels. The lowest rank becomes the entry level for new members.`,
      body:
        removed.length > 0 ? (
          <div className="rounded-[12px] border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-[12.5px] text-fg">
            Removing {removed.map((l) => l.name).join(", ")} moves {int(moving)} member{moving === 1 ? "" : "s"} to the entry level.
          </div>
        ) : undefined,
      confirmLabel: "Save levels",
      run: (reason) => ibSend<LevelsDoc>("levels", { levels: sorted.map(levelBody), reason }, "PUT"),
      success: "Levels saved",
      onDone: () => ld.reload(),
    });

  const error = ld.error;
  return (
    <div className="pb-16">
      <PageHeader
        title="Partner levels"
        subtitle="Every client starts on the entry level. Levels set the rate card, CPA and upgrade targets."
        actions={
          <>
            {perms.loaded && !perms.write && <ReadOnlyNote what="edit levels" />}
            <Button variant="surface" onClick={() => ld.reload()}>
              <RefreshCw /> Refresh
            </Button>
            {perms.write && (
              <>
                <Button variant="surface" onClick={addLevel} disabled={!ld.data || draft.length >= 20}>
                  <Plus /> Add level
                </Button>
                <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(base)}>
                  <RotateCcw /> Discard
                </Button>
                <Button variant="ember" disabled={!dirty} onClick={save}>
                  <Save /> Save changes
                </Button>
              </>
            )}
          </>
        }
      />
      {error && !ld.data ? (
        <PartnersError error={error} onRetry={ld.reload} />
      ) : !ld.data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-80 w-full rounded-[20px]" />
          ))}
        </div>
      ) : (
        <>
          {dirty && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[14px] border border-warn/30 bg-warn-soft px-4 py-2.5 text-[12.5px] text-fg">
              Unsaved level changes{removed.length ? ` · ${removed.length} removed (${int(moving)} members move to the entry level)` : ""}.
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {sorted.map((l, i) => {
              const b = base.find((x) => x.key === l.key);
              return (
                <Reveal key={l.key} delay={i * 0.04} className="min-w-0">
                  <LevelCard l={l} levels={sorted} total={total} edited={!b || !same(levelBody(b), levelBody(l))} canEdit={perms.write} onEdit={() => setEdit({ level: l, isNew: false })} />
                </Reveal>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Reveal className="min-w-0">
              <Card className="h-full">
                <CardHeader title="How upgrades work" subtitle="Monthly evaluation, on calendar months" />
                <div className="divide-y divide-line px-4 pb-4 pt-2 sm:px-6">
                  <SettingRow label="Evaluation" hint="At the start of each month, on last month's active clients and network lots">
                    <Chip size="sm">Monthly</Chip>
                  </SettingRow>
                  <SettingRow label="Demotion" hint="Set in Commission plans">
                    <Chip size="sm" tone={allowDemotion ? "warn" : "neutral"}>{allowDemotion === null ? "—" : allowDemotion ? "Allowed" : "Promotions only"}</Chip>
                  </SettingRow>
                  <SettingRow label="Manual changes" hint="Set a member's level or lock it from its detail in Partners">
                    <Link href="/partners/list">
                      <Button size="xs" variant="surface">Partners</Button>
                    </Link>
                  </SettingRow>
                  <SettingRow label="Per-lot rates" hint="Rates per symbol group for each level">
                    <Link href="/partners/plans">
                      <Button size="xs" variant="surface">Rate card</Button>
                    </Link>
                  </SettingRow>
                </div>
              </Card>
            </Reveal>
            <Reveal delay={0.05} className="min-w-0">
              <Card className="h-full">
                <CardHeader title="Members per level" subtitle={`${int(total)} members`} />
                <div className="space-y-2.5 px-4 pb-5 pt-4 sm:px-6">
                  {base.map((l) => (
                    <div key={l.key} className="flex items-center gap-3 text-[13px]">
                      <span className="w-24 shrink-0 truncate text-fg-2">{l.name}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <div className="h-full rounded-full" style={{ width: `${total ? ((l.members ?? 0) / total) * 100 : 0}%`, background: levelStyle(l.key, base).color }} />
                      </div>
                      <span className="k-num w-12 text-right font-medium">{int(l.members ?? 0)}</span>
                    </div>
                  ))}
                  {sd.data && <div className="pt-1 text-[11.5px] text-fg-3">Programme settings version {sd.data.version} · saved {when(sd.data.updatedAt)}</div>}
                </div>
              </Card>
            </Reveal>
          </div>
        </>
      )}
      <LevelDialog
        level={edit?.level ?? null}
        isNew={!!edit?.isNew}
        levels={draft}
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        onSave={(l) => {
          if (edit?.isNew) setDraft((ds) => [...ds, l]);
          else setDraft((ds) => ds.map((x) => (x.key === edit?.level.key ? { ...l, members: x.members } : x)));
        }}
        onRemove={() => {
          setDraft((ds) => ds.filter((x) => x.key !== edit?.level.key));
          setEdit(null);
        }}
      />
      {act.node}
    </div>
  );
}
