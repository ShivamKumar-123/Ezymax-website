"use client";

import * as React from "react";
import { ArrowRight, Ban, ChevronDown, ChevronRight, GitBranch, Lock, LockOpen, Percent, PlayCircle, Search, TrendingUp } from "lucide-react";
import { Avatar, Button, Chip, CopyButton, Dialog, Flag, Menu, Progress, Skeleton, cn } from "@kalks/ui";
import { MiniField, MiniStat, NumInput, Section } from "@/components/config/kit";
import { KycChip, ago, day, useApi, useDebounced, useNow, when } from "@/components/live/kit";
import { P, ibSend, type Level, type Paged, type PartnerDetail, type PartnerRow, type SettingsDoc, type TreeNode } from "./api";
import {
  COMM_STATUS,
  EmptyNote,
  FLAG_KIND,
  FLAG_STATUS,
  LevelChip,
  PAYOUT_STATUS,
  PartnersError,
  SEV_TONE,
  StatusPill,
  int,
  kindLabelOf,
  lots,
  unitsText,
  usd,
  useReasonAction,
} from "./kit";

/* ------------------------------------------------------------------ */
/* Network tree                                                         */
/* ------------------------------------------------------------------ */

function NetworkTree({ rootId, nodes, levels, tiers, onOpen }: { rootId: number; nodes: TreeNode[]; levels: Level[]; tiers: number; onOpen: (id: number) => void }) {
  const kids = React.useMemo(() => {
    const m = new Map<number, TreeNode[]>();
    for (const n of nodes) {
      const p = n.parentId ?? rootId;
      m.set(p, [...(m.get(p) ?? []), n]);
    }
    return m;
  }, [nodes, rootId]);
  const [open, setOpen] = React.useState<Set<number>>(() => new Set());
  const perTier = Array.from({ length: tiers }, (_, i) => nodes.filter((n) => n.tier === i + 1).length);
  const toggle = (id: number) => setOpen((s) => {
    const x = new Set(s);
    if (x.has(id)) x.delete(id);
    else x.add(id);
    return x;
  });
  const withKids = nodes.filter((n) => kids.has(n.id)).map((n) => n.id);
  const allOpen = withKids.length > 0 && withKids.every((id) => open.has(id));

  const row = (n: TreeNode, depth: number): React.ReactNode => {
    const children = kids.get(n.id) ?? [];
    const isOpen = open.has(n.id);
    return (
      <React.Fragment key={n.id}>
        <div className="flex items-center gap-2 border-b border-line py-2 pr-3 text-[12.5px] last:border-b-0" style={{ paddingLeft: 10 + depth * 18 }}>
          {children.length ? (
            <button type="button" onClick={() => toggle(n.id)} className="grid size-5 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label={isOpen ? "Collapse" : "Expand"}>
              {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          ) : (
            <span className="size-5 shrink-0" />
          )}
          <span className="grid h-5 shrink-0 place-items-center rounded-full border border-line bg-surface-3 px-1.5 font-mono text-[10px] text-fg-2">T{n.tier}</span>
          <button type="button" onClick={() => onOpen(n.id)} className="min-w-0 flex-1 truncate text-left font-medium text-fg hover:text-ember">
            {n.name.trim() || `#${n.id}`}
            <span className="ml-1.5 font-mono text-[10.5px] font-normal text-fg-3">#{n.id}</span>
          </button>
          {n.country && <Flag country={n.country.toLowerCase()} className="hidden size-3.5 sm:inline-block" />}
          {n.selfReferral && <Chip size="sm" tone="down">Self-ref</Chip>}
          <span className="hidden sm:inline">
            <LevelChip level={n.level} levels={levels} />
          </span>
          <span className={cn("hidden w-14 text-right text-[11px] sm:inline", n.funded ? "text-up" : "text-fg-3")}>{n.funded ? "Funded" : "Not funded"}</span>
          <span className="k-num w-16 shrink-0 text-right text-fg-2" title="Qualified lots this month">{lots(n.lotsMonth)}</span>
          {children.length > 0 && !isOpen && <span className="k-num hidden w-8 text-right text-[11px] text-fg-3 sm:inline">+{children.length}</span>}
        </div>
        {isOpen && children.map((c) => row(c, depth + 1))}
      </React.Fragment>
    );
  };

  const top = kids.get(rootId) ?? [];
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {perTier.map((c, i) => (
          <Chip key={i} size="sm">
            Tier {i + 1} · <span className="k-num">{int(c)}</span>
          </Chip>
        ))}
        {withKids.length > 0 && (
          <button type="button" className="ml-auto text-[12px] text-fg-3 hover:text-fg" onClick={() => setOpen(allOpen ? new Set() : new Set(withKids))}>
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>
      {top.length === 0 ? (
        <EmptyNote className="py-6" title="No referred clients yet" text="Clients who sign up with this member's link or code appear here." />
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-line">
          <div className="flex items-center justify-between border-b border-line bg-surface-2 px-3 py-1.5 text-[10.5px] uppercase tracking-wider text-fg-3">
            <span>Client</span>
            <span>Lots this month</span>
          </div>
          <div className="max-h-[360px] overflow-y-auto">{top.map((n) => row(n, 0))}</div>
          {nodes.length >= 1000 && <div className="border-t border-line px-3 py-2 text-[11.5px] text-fg-3">Showing the first 1,000 members of this network.</div>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Action bodies (own state, written into a holder read by run())       */
/* ------------------------------------------------------------------ */

function RatesFields({ init, maxRebate, maxSplit, onChange }: { init: { rebate: number; split: number }; maxRebate: number; maxSplit: number; onChange: (v: { rebate: number; split: number }) => void }) {
  const [v, setV] = React.useState(init);
  const set = (p: Partial<typeof v>) => {
    const next = { ...v, ...p };
    setV(next);
    onChange(next);
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MiniField label="Client rebate" hint={`max ${maxRebate}%`}>
          <NumInput value={v.rebate} onChange={(x) => set({ rebate: x })} min={0} max={maxRebate} step={1} suffix="%" />
        </MiniField>
        <MiniField label="Sub-IB split" hint={`max ${maxSplit}%`}>
          <NumInput value={v.split} onChange={(x) => set({ split: x })} min={0} max={maxSplit} step={1} suffix="%" />
        </MiniField>
      </div>
      <div className="rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 text-[12px] text-fg-3">
        <b className="font-medium text-fg-2">Client rebate</b>: share of this member's tier-1 amount returned to the trading client. <b className="font-medium text-fg-2">Sub-IB split</b>: share of this member's
        tier 2+ amount passed to the IB directly below it in the chain. Both only move money between lines and apply to new deals.
      </div>
    </div>
  );
}

function UplinePicker({ selfId, current, onChange }: { selfId: number; current: number | null; onChange: (id: number | null | undefined) => void }) {
  const [q, setQ] = React.useState("");
  const dq = useDebounced(q, 300);
  const [pick, setPick] = React.useState<number | null | undefined>(undefined);
  const { data, loading } = useApi<Paged<PartnerRow>>(`${P("partners")}?scope=all&limit=8${dq.trim() ? `&q=${encodeURIComponent(dq.trim())}` : ""}`);
  const choose = (id: number | null) => {
    setPick(id);
    onChange(id);
  };
  const rows = (data?.items ?? []).filter((r) => r.id !== selfId);
  return (
    <div className="space-y-2.5">
      <div className="flex h-10 items-center gap-2 rounded-[12px] border border-line bg-surface-2 px-3">
        <Search className="size-3.5 text-fg-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, code or #id" className="h-full w-full bg-transparent text-[13px] outline-none placeholder:text-fg-3" aria-label="Search new upline" />
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        <button
          type="button"
          onClick={() => choose(null)}
          disabled={current === null}
          className={cn("flex w-full items-center gap-3 rounded-[12px] border px-3 py-2 text-left text-[13px] disabled:opacity-50", pick === null ? "border-ember/50 bg-ember-soft" : "border-line hover:bg-surface-2")}
        >
          <span className="flex-1">
            <span className="block font-medium">No upline</span>
            <span className="block text-[11.5px] text-fg-3">Detach from the current IB{current === null ? " (already has none)" : ""}</span>
          </span>
        </button>
        {loading && !data ? (
          <Skeleton className="h-12 w-full" />
        ) : rows.length === 0 ? (
          <div className="px-3 py-3 text-[12.5px] text-fg-3">No members match.</div>
        ) : (
          rows.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={r.id === current}
              onClick={() => choose(r.id)}
              className={cn("flex w-full items-center gap-3 rounded-[12px] border px-3 py-2 text-left text-[13px] disabled:opacity-50", pick === r.id ? "border-ember/50 bg-ember-soft" : "border-line hover:bg-surface-2")}
            >
              <Avatar name={r.name} size={26} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.name}</span>
                <span className="block truncate font-mono text-[11px] text-fg-3">
                  #{r.id} · {r.code} · {r.email}
                </span>
              </span>
              {r.id === current && <Chip size="sm">Current</Chip>}
            </button>
          ))
        )}
      </div>
      <div className="rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 text-[12px] text-fg-3">
        Future deals follow the new tree. Commission already accrued stays with the old upline. A member can't be moved under someone in its own network.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drawer                                                               */
/* ------------------------------------------------------------------ */

function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]">
      <span className="shrink-0 text-fg-3">{k}</span>
      <span className="min-w-0 truncate text-right text-fg-2">{v}</span>
    </div>
  );
}

function Target({ label, value, target, fmt }: { label: string; value: number; target: number; fmt: (v: number) => string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 100;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[12px]">
        <span className="text-fg-3">{label}</span>
        <span className="k-num text-fg-2">
          <span className={cn("font-medium", pct >= 100 ? "text-up" : "text-fg")}>{fmt(value)}</span> / {fmt(target)}
        </span>
      </div>
      <Progress value={pct} tone={pct >= 100 ? "up" : "gold"} />
    </div>
  );
}

export function PartnerDrawer({
  id,
  levels,
  canWrite,
  onClose,
  onOpen,
  onChanged,
}: {
  id: number | null;
  levels: Level[];
  canWrite: boolean;
  onClose: () => void;
  onOpen: (id: number) => void;
  onChanged: () => void;
}) {
  const now = useNow();
  const { data, error, reload } = useApi<PartnerDetail>(id !== null ? P(`partners/${id}`) : null);
  const { data: sdoc } = useApi<SettingsDoc>(id !== null ? P("settings") : null);
  const act = useReasonAction();
  const d = data && data.partner.id === id ? data : null;
  const p = d?.partner;
  const tiers = sdoc?.settings.tiers.length ?? 3;
  const maxRebate = Number(sdoc?.settings.maxRebatePct ?? 0);
  const maxSplit = Number(sdoc?.settings.maxSplitPct ?? 0);
  const lvl = p ? levels.find((l) => l.key === p.level) : undefined;
  const next = lvl ? levels.filter((l) => l.rank > lvl.rank).sort((a, b) => a.rank - b.rank)[0] : undefined;
  const done = () => {
    reload();
    onChanged();
  };

  const patch = (body: Record<string, unknown>) => (reason: string) => ibSend<PartnerDetail>(`partners/${id}`, { ...body, reason }, "PATCH");

  const changeLevel = (l: Level) =>
    p &&
    act.ask({
      title: `Move ${p.name} to ${l.name}`,
      description: `Currently ${lvl?.name ?? p.level}. The new level's rates apply to new deals.${p.levelLocked ? "" : " Monthly evaluation can still move this member unless the level is locked."}`,
      confirmLabel: `Set ${l.name}`,
      run: patch({ level: l.key }),
      success: `${p.name} moved to ${l.name}`,
      onDone: done,
    });

  const lockLevel = () =>
    p &&
    act.ask({
      title: p.levelLocked ? `Unlock ${p.name}'s level` : `Lock ${p.name} at ${lvl?.name ?? p.level}`,
      description: p.levelLocked ? "Monthly evaluation will be able to move this member again." : "Monthly evaluation will skip this member until the lock is removed.",
      confirmLabel: p.levelLocked ? "Unlock level" : "Lock level",
      run: patch({ levelLocked: !p.levelLocked }),
      success: p.levelLocked ? "Level unlocked" : "Level locked",
      onDone: done,
    });

  const setStatus = () =>
    p &&
    act.ask({
      title: p.status === "active" ? `Suspend ${p.name}` : `Reactivate ${p.name}`,
      description:
        p.status === "active"
          ? "A suspended IB earns nothing and gives nothing on new deals; its clients keep trading. Existing lines are not changed."
          : "The member earns commission again on new deals.",
      confirmLabel: p.status === "active" ? "Suspend" : "Reactivate",
      confirmVariant: p.status === "active" ? "sell" : "buy",
      run: patch({ status: p.status === "active" ? "suspended" : "active" }),
      success: p.status === "active" ? `${p.name} suspended` : `${p.name} reactivated`,
      onDone: done,
    });

  const setRates = () => {
    if (!p) return;
    const holder = { rebate: p.rebatePct, split: p.splitPct };
    act.ask({
      title: `Rebate and split for ${p.name}`,
      confirmLabel: "Save",
      body: <RatesFields init={holder} maxRebate={maxRebate} maxSplit={maxSplit} onChange={(v) => Object.assign(holder, v)} />,
      run: (reason) => ibSend<PartnerDetail>(`partners/${id}`, { rebatePct: holder.rebate, splitPct: holder.split, reason }, "PATCH"),
      success: "Rebate and split saved",
      onDone: done,
    });
  };

  const reassign = () => {
    if (!p) return;
    const holder: { to: number | null | undefined } = { to: undefined };
    act.ask({
      title: `Move ${p.name} to another upline`,
      description: p.parentId ? `Current upline: ${p.parentName ?? `#${p.parentId}`} (#${p.parentId}).` : "This member has no upline today.",
      confirmLabel: "Move member",
      body: <UplinePicker selfId={p.id} current={p.parentId} onChange={(v) => (holder.to = v)} />,
      run: async (reason) => {
        if (holder.to === undefined) return { ok: false, error: { code: "validation", field: "parentId", message: "Pick the new upline, or “No upline”." } };
        return ibSend<PartnerDetail>(`partners/${id}/reassign`, { parentId: holder.to, reason }, "POST");
      },
      success: "Member moved",
      successDetail: "Future deals follow the new tree · recorded in the audit log",
      onDone: done,
    });
  };

  const upline = d ? [...d.upline].reverse() : [];

  return (
    <>
      <Dialog
        open={id !== null}
        onOpenChange={(o) => !o && onClose()}
        side="right"
        title={
          p ? (
            <span className="flex items-center gap-3">
              <Avatar name={p.name} size={42} />
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate">{p.name}</span>
                  {p.country && <Flag country={p.country.toLowerCase()} className="size-4" />}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] font-normal text-fg-3">
                  <span className="font-mono">#{p.id}</span>
                  <span>· code</span>
                  <span className="font-mono text-fg-2">{p.code}</span>
                  <CopyButton value={p.code} label="Referral code" />
                </span>
              </span>
            </span>
          ) : (
            <span>{id !== null ? `Member #${id}` : ""}</span>
          )
        }
        footer={
          p && canWrite ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <Menu
                align="start"
                trigger={
                  <Button variant="surface" size="sm">
                    <TrendingUp /> Level <ChevronDown />
                  </Button>
                }
                items={[
                  ...levels.map((l) => ({ label: l.name, hint: l.key === p.level ? "Current" : `Rank ${l.rank}`, onSelect: () => l.key !== p.level && changeLevel(l) })),
                  "sep" as const,
                  { label: p.levelLocked ? "Unlock level" : "Lock level", icon: p.levelLocked ? <LockOpen /> : <Lock />, onSelect: lockLevel },
                ]}
              />
              <Button variant="surface" size="sm" onClick={setRates} disabled={!sdoc}>
                <Percent /> Rebate / split
              </Button>
              <Button variant="surface" size="sm" onClick={reassign}>
                <GitBranch /> Move
              </Button>
              <span className="flex-1" />
              {p.status === "active" ? (
                <Button variant="down-outline" size="sm" onClick={setStatus}>
                  <Ban /> Suspend
                </Button>
              ) : (
                <Button variant="up-outline" size="sm" onClick={setStatus}>
                  <PlayCircle /> Reactivate
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        {error && !d ? (
          <PartnersError error={error} onRetry={reload} />
        ) : !d || !p ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <div className="grid grid-cols-2 gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div>
            <Section title="Profile">
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <Chip size="sm" dot tone={p.status === "active" ? "up" : "down"}>
                  {p.status === "active" ? "Active" : "Suspended"}
                </Chip>
                <LevelChip level={p.level} levels={levels} />
                {p.levelLocked && (
                  <Chip size="sm" tone="info">
                    <Lock className="size-3" /> Level locked
                  </Chip>
                )}
                <KycChip status={p.kycStatus} />
                {p.selfReferral && <Chip size="sm" tone="down">Self-referral: {p.selfReferral}</Chip>}
                {p.openFlags > 0 && <Chip size="sm" tone="warn">{p.openFlags} open flag{p.openFlags > 1 ? "s" : ""}</Chip>}
              </div>
              <div className="rounded-[14px] border border-line bg-surface-2/60 px-3.5 py-2.5">
                <div className="mb-1 text-[11px] uppercase tracking-wider text-fg-3">Upline</div>
                {upline.length === 0 ? (
                  <div className="text-[12.5px] text-fg-2">No upline · top of its own network</div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                    {upline.map((u) => (
                      <React.Fragment key={u.id}>
                        <button type="button" onClick={() => onOpen(u.id)} className="rounded-full border border-line bg-surface px-2 py-0.5 text-fg-2 hover:border-fg-3 hover:text-fg">
                          {u.name.trim() || `#${u.id}`} <span className="font-mono text-[10.5px] text-fg-3">#{u.id}</span>
                        </button>
                        <ArrowRight className="size-3 text-fg-3" />
                      </React.Fragment>
                    ))}
                    <span className="rounded-full border border-ember/40 bg-ember-soft px-2 py-0.5 font-medium text-fg">{p.name}</span>
                  </div>
                )}
                {p.parentSource === "admin" && <div className="mt-1.5 text-[11.5px] text-fg-3">Upline set by an admin (see moves below).</div>}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                <Row k="Email" v={p.email} />
                <Row k="Joined" v={day(p.joinedAt)} />
                <Row k="First deposit" v={p.firstDepositAt ? `${usd(p.firstDepositAmount)} · ${day(p.firstDepositAt)}` : "None yet"} />
                <Row k="Campaign" v={p.campaign ? <span className="font-mono">{p.campaign}</span> : "—"} />
                <Row k="Client rebate" v={`${p.rebatePct}%`} />
                <Row k="Sub-IB split" v={`${p.splitPct}%`} />
              </div>
            </Section>

            <Section title="Performance">
              <div className="grid grid-cols-2 gap-2.5">
                <MiniStat label="Direct clients" value={int(p.clients)} sub={`${int(p.activeClients)} traded this month`} />
                <MiniStat
                  label="Network lots"
                  value={lots(p.lotsMonth ?? 0)}
                  sub={`Last month ${lots(p.lotsPrevMonth ?? 0)}`}
                />
                <MiniStat label="Commission, month" value={usd(p.commissionMonth)} sub={`Pending ${usd(p.pending)}`} tone="gold" />
                <MiniStat label="Paid to wallet" value={usd(p.paid)} sub="All time" />
              </div>
            </Section>

            <Section title="Level progress" hint={next ? `Targets for ${next.name}, measured on this calendar month` : "Top level"} action={next ? <LevelChip level={next.key} levels={levels} /> : undefined}>
              {next ? (
                <div className="space-y-3.5">
                  <Target label="Active clients" value={p.activeClients} target={next.minActiveClients} fmt={int} />
                  <Target label="Network lots" value={p.lotsMonth ?? 0} target={next.minMonthlyLots} fmt={(v) => lots(v, 0)} />
                </div>
              ) : (
                <div className="text-[12.5px] text-fg-3">This member is on the highest level.</div>
              )}
            </Section>

            <Section title="Network" hint={`Down to tier ${tiers} · click a member to open it`}>
              <NetworkTree rootId={p.id} nodes={d.tree} levels={levels} tiers={tiers} onOpen={onOpen} />
            </Section>

            <Section title="Recent commissions" hint="Last 25 lines where this member is the beneficiary">
              {d.commissions.length === 0 ? (
                <EmptyNote className="py-6" title="No commission lines" />
              ) : (
                <div className="overflow-hidden rounded-[14px] border border-line">
                  {d.commissions.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 border-b border-line px-3.5 py-2.5 text-[12.5px] last:border-b-0">
                      <span className="hidden w-20 shrink-0 text-[11px] text-fg-3 sm:block" title={when(c.createdAt)}>{ago(c.createdAt, now)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-fg">{c.clientName || `#${c.clientId}`}</div>
                        <div className="truncate text-[11px] text-fg-3">
                          {kindLabelOf(c)}
                          {c.symbol ? ` · ${c.symbol}` : ""}
                          {unitsText(c) ? ` · ${unitsText(c)}` : ""}
                        </div>
                      </div>
                      <span className="hidden sm:inline">
                        <Chip size="sm">T{c.tier}</Chip>
                      </span>
                      <StatusPill map={COMM_STATUS} status={c.status} />
                      <span className={cn("k-num w-20 text-right font-medium", c.amount < 0 ? "text-down" : "text-fg")}>{usd(c.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Payouts" hint="Batch lines credited to this member's wallet">
              {d.payouts.length === 0 ? (
                <EmptyNote className="py-6" title="No payouts yet" />
              ) : (
                <div className="overflow-hidden rounded-[14px] border border-line">
                  {d.payouts.map((x) => (
                    <div key={x.id} className="flex items-center gap-3 border-b border-line px-3.5 py-2.5 text-[12.5px] last:border-b-0">
                      <a href={`/partners/payouts?batch=${x.batchId}`} className="w-20 shrink-0 font-mono text-[11.5px] text-fg-2 hover:text-ember">
                        Batch #{x.batchId}
                      </a>
                      <div className="hidden min-w-0 flex-1 truncate text-[11.5px] text-fg-3 sm:block">{x.paidAt ? `Credited ${day(x.paidAt)}` : x.lastError ? x.lastError : `Created ${day(x.createdAt)}`}</div>
                      <span className="flex-1 sm:hidden" />
                      <StatusPill map={PAYOUT_STATUS} status={x.status} />
                      <span className="k-num w-20 text-right font-medium">{usd(x.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Fraud flags">
              {d.flags.length === 0 ? (
                <EmptyNote className="py-6" title="No flags" />
              ) : (
                <div className="space-y-2">
                  {d.flags.map((f) => (
                    <a key={f.id} href={`/partners/fraud?flag=${f.id}`} className="k-row flex items-center gap-3 px-3.5 py-2.5 text-[12.5px] hover:bg-surface-3/60">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{FLAG_KIND[f.kind]?.label ?? f.kind}</div>
                        <div className="truncate text-[11px] text-fg-3">
                          {f.clientId === p.id ? "As client" : "As IB"} · {day(f.createdAt)}
                        </div>
                      </div>
                      <Chip size="sm" tone={SEV_TONE[f.severity]}>{f.severity}</Chip>
                      <StatusPill map={FLAG_STATUS} status={f.status} />
                    </a>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Level history">
              {d.levelHistory.length === 0 ? (
                <div className="text-[12.5px] text-fg-3">No level changes since joining.</div>
              ) : (
                <div className="space-y-1.5">
                  {d.levelHistory.map((h, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                      <span className="w-24 shrink-0 text-[11.5px] text-fg-3">{day(h.at)}</span>
                      {h.from ? <LevelChip level={h.from} levels={levels} /> : <span className="text-fg-3">Start</span>}
                      <ArrowRight className="size-3 text-fg-3" />
                      <LevelChip level={h.to} levels={levels} />
                      <span className="text-[11.5px] text-fg-3">
                        {h.reason === "admin" ? "Set by admin" : h.reason === "monthly" ? "Monthly evaluation" : h.reason === "joined" ? "Joined" : h.reason}
                        {h.month ? ` · ${h.month}` : ""}
                        {h.activeClients !== null ? ` · ${int(h.activeClients)} active` : ""}
                        {h.lots !== null ? ` · ${lots(h.lots, 0)} lots` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Moves between uplines">
              {d.reassignments.length === 0 ? (
                <div className="text-[12.5px] text-fg-3">Never moved. Attribution is from sign-up.</div>
              ) : (
                <div className="space-y-2">
                  {d.reassignments.map((m, i) => (
                    <div key={i} className="k-row px-3.5 py-2.5 text-[12.5px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-fg-2">{m.fromParent ? `${m.fromName ?? ""} #${m.fromParent}`.trim() : "none"}</span>
                        <ArrowRight className="size-3 text-fg-3" />
                        <span className="font-mono text-fg-2">{m.toParent ? `${m.toName ?? ""} #${m.toParent}`.trim() : "none"}</span>
                        <span className="ml-auto text-[11px] text-fg-3">{when(m.at)}</span>
                      </div>
                      <div className="mt-1 text-fg-2">{m.reason}</div>
                      <div className="mt-0.5 text-[11px] text-fg-3">by {m.staff}</div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}
      </Dialog>
      {act.node}
    </>
  );
}
