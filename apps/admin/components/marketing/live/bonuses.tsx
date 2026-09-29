"use client";

import * as React from "react";
import { CalendarClock, Gift, HandCoins, Pause, Pencil, Play, Plus, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, KpiCard, PageHeader, Progress, Reveal, Segmented, cn, type Column } from "@kalks/ui";
import { FilterSelect, Pager, TableSkeleton, day, qs, useApi, when } from "@/components/live/kit";
import { M, mkSend, type Campaign, type CampaignInput, type Grant, type Overview, type Paged } from "./api";
import {
  AreaF,
  CAMPAIGN_STATUS,
  ClientCell,
  DateTimeF,
  EmptyNote,
  FormDialog,
  FormSection,
  GRANT_STATUS,
  MkError,
  NumF,
  ReadOnlyNote,
  SelectF,
  StatusPill,
  TextF,
  ToggleRow,
  fromLocalInput,
  int,
  num,
  numOrNull,
  numStr,
  splitList,
  toLocalInput,
  usd,
  usdK,
  useAction,
  usePerms,
} from "./kit";

type Filter = "all" | "active" | "paused" | "draft" | "ended";
const PER = 25;

export function LiveBonuses() {
  const perms = usePerms();
  const act = useAction();
  const ov = useApi<Overview>(M("overview"));
  const camps = useApi<{ items: Campaign[] }>(M("bonuses/campaigns"));
  const [filter, setFilter] = React.useState<Filter>("all");
  const [editing, setEditing] = React.useState<Campaign | null>(null);
  const [open, setOpen] = React.useState(false);
  const [grantOpen, setGrantOpen] = React.useState(false);
  const [grantsTick, setGrantsTick] = React.useState(0);
  const items = camps.data?.items ?? [];
  const list = items.filter((c) => filter === "all" || c.status === filter);
  const b = ov.data?.bonus;
  const count = (s: Filter) => items.filter((c) => c.status === s).length;

  const edit = (c: Campaign | null) => {
    setEditing(c);
    setOpen(true);
  };
  const toggle = (c: Campaign) => {
    const next = c.status === "active" ? "paused" : "active";
    act.ask({
      title: next === "paused" ? `Pause ${c.name}` : `Activate ${c.name}`,
      description: next === "paused" ? "No new claims. Grants already open keep releasing per lot until they complete or expire." : "Eligible clients can claim the campaign from now (inside its window).",
      confirmLabel: next === "paused" ? "Pause campaign" : "Activate campaign",
      confirmVariant: next === "paused" ? "surface" : "ember",
      note: "none",
      run: () => mkSend(`bonuses/campaigns/${c.id}`, { status: next }, "PATCH"),
      success: next === "paused" ? `${c.name} paused` : `${c.name} is active`,
      onDone: () => {
        camps.reload();
        ov.reload();
      },
    });
  };

  return (
    <div className="pb-16">
      <PageHeader
        title="Bonuses"
        subtitle="Deposit and fixed credit campaigns: non-withdrawable bonus that releases to balance per lot traded."
        actions={
          <>
            {perms.loaded && !perms.write && <ReadOnlyNote what="edit campaigns" />}
            <Button
              variant="surface"
              onClick={() => {
                camps.reload();
                ov.reload();
                setGrantsTick((n) => n + 1);
              }}
            >
              <RefreshCw /> Refresh
            </Button>
            {perms.approve && (
              <Button variant="surface" onClick={() => setGrantOpen(true)} disabled={items.length === 0}>
                <HandCoins /> Manual grant
              </Button>
            )}
            {perms.write && (
              <Button variant="ember" onClick={() => edit(null)} data-testid="new-campaign">
                <Plus /> New campaign
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active campaigns" icon={<Gift />} value={<span className="k-num">{b ? int(b.activeCampaigns) : "—"}</span>} chip={b ? `${int(b.activeGrants)} grants releasing` : "Loading"} />
        <KpiCard label="Bonus issued · 30d" icon={<HandCoins />} value={<span className="k-num">{b ? usdK(b.issued30d) : "—"}</span>} chip="Credit, not cash until released" delay={0.05} />
        <KpiCard label="Released · 30d" icon={<TrendingUp />} value={<span className="k-num">{b ? usdK(b.released30d) : "—"}</span>} chip={b && b.issued30d > 0 ? `${((b.released30d / b.issued30d) * 100).toFixed(1)}% of issued` : "Moved to balance"} chipTone="gold" delay={0.1} />
        <KpiCard label="Outstanding credit" icon={<Wallet />} value={<span className="k-num">{b ? usdK(b.outstanding) : "—"}</span>} chip={b ? `Forfeited 30d ${usdK(b.forfeited30d)}` : "Unreleased"} chipTone="warn" delay={0.15} />
      </div>
      {ov.error && !ov.data && <MkError className="mt-4" error={ov.error} onRetry={ov.reload} />}

      <Reveal delay={0.05} className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-medium tracking-tight">Campaigns</h2>
            <p className="text-[13px] text-fg-3">One active grant per trading account · credit is posted to the engine's bonus sub-ledger</p>
          </div>
          <Segmented
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: <>All <span className="text-fg-3">{items.length}</span></> },
              { value: "active", label: <>Active <span className="text-fg-3">{count("active")}</span></> },
              { value: "paused", label: "Paused" },
              { value: "draft", label: "Draft" },
              { value: "ended", label: "Ended" },
            ]}
          />
        </div>
        {camps.error && !camps.data ? (
          <MkError error={camps.error} onRetry={camps.reload} />
        ) : !camps.data ? (
          <TableSkeleton rows={3} />
        ) : list.length === 0 ? (
          <EmptyNote
            title={items.length === 0 ? "No bonus campaigns yet" : "No campaigns match this filter"}
            text={items.length === 0 ? "Create a deposit % or fixed credit campaign. Clients claim it in the Client Area under Promotions, or through a promo code." : undefined}
            action={
              items.length === 0 && perms.write ? (
                <Button variant="ember" size="sm" onClick={() => edit(null)}>
                  <Plus /> New campaign
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((c) => (
              <CampaignCard key={c.id} c={c} canWrite={perms.write} onEdit={() => edit(c)} onToggle={() => toggle(c)} />
            ))}
          </div>
        )}
      </Reveal>

      <Reveal delay={0.1} className="mt-6">
        <GrantsCard campaigns={items} canApprove={perms.approve} tick={grantsTick} ask={act.ask} onChanged={() => ov.reload()} />
      </Reveal>

      <CampaignDialog open={open} onOpenChange={setOpen} campaign={editing} onSaved={() => (camps.reload(), ov.reload())} />
      <ManualGrantDialog open={grantOpen} onOpenChange={setGrantOpen} campaigns={items} onSaved={() => (setGrantsTick((n) => n + 1), camps.reload(), ov.reload())} />
      {act.node}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CampaignCard({ c, canWrite, onEdit, onToggle }: { c: Campaign; canWrite: boolean; onEdit: () => void; onToggle: () => void }) {
  const releasedPct = c.issued > 0 ? (c.released / c.issued) * 100 : 0;
  return (
    <Card className="flex h-full flex-col" data-testid={`campaign-card-${c.id}`}>
      <div className="px-5 pt-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15.5px] font-medium tracking-tight">{c.name}</h3>
            <p className="mt-0.5 line-clamp-2 min-h-[1.25rem] text-[12.5px] text-fg-3">{c.description || "No description"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusPill map={CAMPAIGN_STATUS} status={c.status} />
              <Chip size="sm">{c.kind === "deposit" ? "Deposit %" : "Fixed credit"}</Chip>
              {c.visibility === "code_only" && <Chip size="sm" tone="info">Promo code only</Chip>}
              {c.kycRequired && <Chip size="sm">KYC</Chip>}
            </div>
          </div>
          {canWrite && (c.status === "active" || c.status === "paused" || c.status === "draft") && (
            <Button size="xs" variant="surface" onClick={onToggle} aria-label={c.status === "active" ? `Pause ${c.name}` : `Activate ${c.name}`}>
              {c.status === "active" ? <Pause /> : <Play />}
              {c.status === "active" ? "Pause" : "Activate"}
            </Button>
          )}
        </div>

        <div className="mt-5">
          <div className="k-label text-fg-3">Offer</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="k-num text-[34px] font-semibold leading-none tracking-tight text-ember">{c.kind === "deposit" ? `${num(c.pct)}%` : usd(c.fixedAmount, 0)}</span>
            <span className="text-[12.5px] text-fg-2">
              {c.kind === "deposit" ? (
                <>
                  of deposit, up to <span className="k-num text-fg">{usd(c.cap, 0)}</span>
                </>
              ) : (
                "credit on a chosen live account"
              )}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Rule label="Min deposit" value={c.kind === "deposit" ? (c.minDeposit ? usd(c.minDeposit, 0) : "None") : "—"} />
          <Rule label="Release" value={`${usd(c.releasePerLot)} / lot`} accent />
          <Rule label="Expiry" value={`${int(c.expiryDays)} days`} />
        </div>
      </div>

      <div className="mt-4 flex-1 border-t border-line px-5 pb-4 pt-4">
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Claims" value={int(c.claims)} sub={c.maxClaims ? `of ${int(c.maxClaims)}` : undefined} />
          <Stat label="Issued" value={usdK(c.issued)} />
          <Stat label="Released" value={usdK(c.released)} tone="gold" />
          <Stat label="Outstanding" value={usdK(c.outstanding)} right />
        </div>
        <Progress value={releasedPct} tone="gold" className="mt-3" />
        <div className="mt-1 flex justify-between text-[11px] text-fg-3">
          <span className="k-num">{releasedPct.toFixed(1)}% released</span>
          <span className="k-num">{int(c.active)} releasing · forfeited {usdK(c.forfeited)}</span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 truncate text-[12px] text-fg-3">
            <CalendarClock className="size-3.5 shrink-0" />
            {day(c.startsAt)} – {c.endsAt ? day(c.endsAt) : "no end"}
          </span>
          {canWrite && (
            <Button size="xs" variant="surface" onClick={onEdit}>
              <Pencil /> Edit
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function Rule({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("k-row px-3 py-2", accent && "border-ember/25 bg-ember-soft")}>
      <div className="truncate text-[10.5px] uppercase tracking-[0.06em] text-fg-3">{label}</div>
      <div className={cn("k-num mt-0.5 truncate text-[13px] font-medium", accent && "text-ember")}>{value}</div>
    </div>
  );
}

function Stat({ label, value, sub, tone, right }: { label: string; value: string; sub?: string; tone?: "gold"; right?: boolean }) {
  return (
    <div className={cn("min-w-0", right && "text-right")}>
      <div className="truncate text-[11px] text-fg-3">{label}</div>
      <div className={cn("k-num mt-0.5 truncate text-[13.5px] font-medium", tone === "gold" && "text-gold")}>{value}</div>
      {sub && <div className="k-num truncate text-[10.5px] text-fg-3">{sub}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Campaign dialog                                                      */
/* ------------------------------------------------------------------ */

type Draft = {
  name: string;
  description: string;
  terms: string;
  kind: "deposit" | "fixed";
  pct: string;
  cap: string;
  fixedAmount: string;
  minDeposit: string;
  releasePerLot: string;
  expiryDays: string;
  forfeitOnWithdrawal: boolean;
  claimWindowDays: string;
  accountGroups: string;
  maxClaims: string;
  perUserLimit: string;
  newUsersDays: string;
  kycRequired: boolean;
  visibility: "public" | "code_only";
  status: "draft" | "active" | "paused" | "ended";
  startsAt: string;
  endsAt: string;
};

const EMPTY: Draft = {
  name: "",
  description: "",
  terms: "",
  kind: "deposit",
  pct: "30",
  cap: "500",
  fixedAmount: "30",
  minDeposit: "100",
  releasePerLot: "3",
  expiryDays: "60",
  forfeitOnWithdrawal: true,
  claimWindowDays: "30",
  accountGroups: "",
  maxClaims: "",
  perUserLimit: "1",
  newUsersDays: "",
  kycRequired: true,
  visibility: "public",
  status: "draft",
  startsAt: "",
  endsAt: "",
};

function fromCampaign(c: Campaign): Draft {
  return {
    name: c.name,
    description: c.description ?? "",
    terms: c.terms ?? "",
    kind: c.kind,
    pct: numStr(c.pct),
    cap: numStr(c.cap),
    fixedAmount: numStr(c.fixedAmount),
    minDeposit: numStr(c.minDeposit),
    releasePerLot: numStr(c.releasePerLot),
    expiryDays: numStr(c.expiryDays),
    forfeitOnWithdrawal: c.forfeitOnWithdrawal,
    claimWindowDays: numStr(c.claimWindowDays),
    accountGroups: (c.accountGroups ?? []).join(", "),
    maxClaims: numStr(c.maxClaims),
    perUserLimit: numStr(c.perUserLimit),
    newUsersDays: numStr(c.newUsersDays),
    kycRequired: c.kycRequired,
    visibility: c.visibility,
    status: c.status,
    startsAt: toLocalInput(c.startsAt),
    endsAt: toLocalInput(c.endsAt),
  };
}

function CampaignDialog({ open, onOpenChange, campaign, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; campaign: Campaign | null; onSaved: () => void }) {
  const [d, setD] = React.useState<Draft>(EMPTY);
  React.useEffect(() => {
    if (open) setD(campaign ? fromCampaign(campaign) : { ...EMPTY, startsAt: toLocalInput(new Date().toISOString()) });
  }, [open, campaign]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const n = (s: string) => Number(s) || 0;
  const exampleDeposit = Math.max(n(d.minDeposit), 1000);
  const credit = d.kind === "fixed" ? n(d.fixedAmount) : Math.min(n(d.cap) || Infinity, (exampleDeposit * n(d.pct)) / 100);
  const lotsReq = n(d.releasePerLot) > 0 ? credit / n(d.releasePerLot) : 0;
  const perDay = n(d.expiryDays) > 0 ? lotsReq / n(d.expiryDays) : 0;

  const submit = () => {
    if (!d.name.trim()) return "Give the campaign a name.";
    if (n(d.releasePerLot) <= 0) return "Release per lot must be above 0.";
    if (n(d.expiryDays) <= 0) return "Expiry days must be above 0.";
    if (d.kind === "deposit" && (n(d.pct) <= 0 || n(d.cap) <= 0)) return "Set the percent and the cap.";
    if (d.kind === "fixed" && n(d.fixedAmount) <= 0) return "Set the fixed amount.";
    const endsAt = fromLocalInput(d.endsAt);
    const startsAt = fromLocalInput(d.startsAt);
    if (startsAt && endsAt && endsAt <= startsAt) return "Ends must be after Starts.";
    const body: CampaignInput = {
      name: d.name.trim(),
      description: d.description.trim(),
      terms: d.terms.trim(),
      kind: d.kind,
      pct: d.kind === "deposit" ? n(d.pct) : 0,
      cap: d.kind === "deposit" ? n(d.cap) : 0,
      fixedAmount: d.kind === "fixed" ? n(d.fixedAmount) : 0,
      minDeposit: d.kind === "deposit" ? n(d.minDeposit) : 0,
      releasePerLot: n(d.releasePerLot),
      expiryDays: Math.round(n(d.expiryDays)),
      forfeitOnWithdrawal: d.forfeitOnWithdrawal,
      claimWindowDays: Math.round(n(d.claimWindowDays)),
      accountGroups: splitList(d.accountGroups),
      maxClaims: numOrNull(d.maxClaims),
      perUserLimit: Math.max(1, Math.round(n(d.perUserLimit) || 1)),
      newUsersDays: numOrNull(d.newUsersDays),
      kycRequired: d.kycRequired,
      visibility: d.visibility,
      status: d.status,
      ...(startsAt ? { startsAt } : {}),
      endsAt,
    };
    return campaign ? mkSend<{ campaign: Campaign }>(`bonuses/campaigns/${campaign.id}`, body, "PATCH") : mkSend<{ campaign: Campaign }>("bonuses/campaigns", body);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title={campaign ? `Edit · ${campaign.name}` : "New bonus campaign"}
      description="Bonus credit counts toward equity and margin, is never withdrawable and releases to balance as the client trades."
      submitLabel={campaign ? "Save changes" : "Create campaign"}
      submitTestId="campaign-form-submit"
      submit={submit}
      success={campaign ? `${d.name} updated` : `${d.name} created`}
      onDone={onSaved}
    >
      <FormSection title="Campaign">
        <TextF label="Name" value={d.name} onChange={(v) => set("name", v)} placeholder="e.g. 30% welcome bonus" maxLength={120} />
        <AreaF label="Description" value={d.description} onChange={(v) => set("description", v)} rows={2} placeholder="One or two lines shown on the offer card" />
        <AreaF label="Terms" value={d.terms} onChange={(v) => set("terms", v)} rows={5} placeholder="Full terms and conditions shown to the client before claiming" />
        <div className="grid grid-cols-2 gap-3">
          <SelectF label="Type" value={d.kind} onChange={(v) => set("kind", v)} options={[{ value: "deposit", label: "Deposit %" }, { value: "fixed", label: "Fixed credit" }]} />
          <SelectF
            label="Status"
            value={d.status}
            onChange={(v) => set("status", v)}
            options={[
              { value: "draft", label: "Draft" },
              { value: "active", label: "Active" },
              { value: "paused", label: "Paused" },
              { value: "ended", label: "Ended" },
            ]}
          />
          <SelectF label="Visibility" value={d.visibility} onChange={(v) => set("visibility", v)} options={[{ value: "public", label: "Public (Promotions page)" }, { value: "code_only", label: "Promo code only" }]} className="col-span-2" />
        </div>
      </FormSection>

      <FormSection title="Credit rules">
        <div className="grid grid-cols-2 gap-3">
          {d.kind === "deposit" ? (
            <>
              <NumF label="Percent" value={d.pct} onChange={(v) => set("pct", v)} suffix="% of deposit" />
              <NumF label="Cap" value={d.cap} onChange={(v) => set("cap", v)} prefix="$" hint="max bonus" />
              <NumF label="Minimum deposit" value={d.minDeposit} onChange={(v) => set("minDeposit", v)} prefix="$" />
              <NumF label="Claim window" value={d.claimWindowDays} onChange={(v) => set("claimWindowDays", v)} suffix="days" hint="to deposit" />
            </>
          ) : (
            <NumF label="Fixed amount" value={d.fixedAmount} onChange={(v) => set("fixedAmount", v)} prefix="$" className="col-span-2" />
          )}
          <NumF label="Release per lot" value={d.releasePerLot} onChange={(v) => set("releasePerLot", v)} prefix="$" suffix="/ lot" />
          <NumF label="Expiry days" value={d.expiryDays} onChange={(v) => set("expiryDays", v)} suffix="days" step={1} />
        </div>
      </FormSection>

      <FormSection title="Eligibility and limits">
        <div className="grid grid-cols-2 gap-3">
          <NumF label="Max claims" value={d.maxClaims} onChange={(v) => set("maxClaims", v)} placeholder="Unlimited" step={1} />
          <NumF label="Per-user limit" value={d.perUserLimit} onChange={(v) => set("perUserLimit", v)} step={1} />
          <NumF label="New users within" value={d.newUsersDays} onChange={(v) => set("newUsersDays", v)} suffix="days" placeholder="Anyone" step={1} />
          <TextF label="Account groups" value={d.accountGroups} onChange={(v) => set("accountGroups", v)} placeholder="All groups" hint="comma separated" />
          <DateTimeF label="Starts" value={d.startsAt} onChange={(v) => set("startsAt", v)} />
          <DateTimeF label="Ends" value={d.endsAt} onChange={(v) => set("endsAt", v)} hint="optional" />
        </div>
        <div className="k-row divide-y divide-line px-4">
          <ToggleRow label="Require verified KYC" hint="Claim is refused until KYC is approved" checked={d.kycRequired} onChange={(v) => set("kycRequired", v)} />
          <ToggleRow label="Forfeit on withdrawal" hint="A withdrawal or transfer out removes the unreleased remainder" checked={d.forfeitOnWithdrawal} onChange={(v) => set("forfeitOnWithdrawal", v)} />
        </div>
      </FormSection>

      <div className="k-row px-4 py-4">
        <div className="k-label">Example</div>
        <div className="mt-1.5 text-[14px] leading-snug">
          {d.kind === "fixed" ? (
            <>
              The client receives <span className="k-num text-gold">{usd(credit, 0)}</span> bonus on a chosen live account.
            </>
          ) : (
            <>
              A <span className="k-num">{usd(exampleDeposit, 0)}</span> deposit gives <span className="k-num text-gold">{usd(Number.isFinite(credit) ? credit : 0, 0)}</span> bonus.
            </>
          )}
        </div>
        <ul className="mt-2 space-y-1 text-[12.5px] text-fg-2">
          <li>
            Fully released after <span className="k-num text-fg">{num(lotsReq)}</span> lots at {usd(n(d.releasePerLot))} per lot.
          </li>
          <li>
            Unreleased credit is removed after <span className="k-num text-fg">{int(n(d.expiryDays))}</span> days ({num(perDay)} lots per day to release in full).
          </li>
        </ul>
      </div>
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Grants                                                               */
/* ------------------------------------------------------------------ */

function GrantsCard({ campaigns, canApprove, tick, ask, onChanged }: { campaigns: Campaign[]; canApprove: boolean; tick: number; ask: ReturnType<typeof useAction>["ask"]; onChanged: () => void }) {
  const [status, setStatus] = React.useState("all");
  const [campaign, setCampaign] = React.useState("all");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [status, campaign]);
  const { data, error, loading, reload } = useApi<Paged<Grant>>(`${M("bonuses/grants")}${qs({ status, campaign, page, limit: PER })}`);
  React.useEffect(() => {
    if (tick) reload();
  }, [tick, reload]);

  const cancel = (g: Grant) =>
    ask({
      title: `Cancel grant #${g.id}`,
      description: `${g.name || `Client #${g.userId}`} · ${g.campaign}${g.login ? ` · account ${g.login}` : ""}`,
      body: (
        <div className="rounded-[12px] border border-down/30 bg-down-soft px-3.5 py-2.5 text-[12.5px] text-fg">
          Removes the unreleased remainder of <span className="k-num font-medium">{usd(g.remaining)}</span> from the account's bonus. Amounts already released to balance stay with the client.
        </div>
      ),
      confirmLabel: "Cancel grant",
      confirmVariant: "sell",
      note: "required",
      noteLabel: "Note",
      run: (note) => mkSend(`bonuses/grants/${g.id}/cancel`, { note }),
      success: `Grant #${g.id} cancelled`,
      onDone: () => {
        reload();
        onChanged();
      },
    });

  const cols: Column<Grant>[] = [
    { key: "c", header: "Client", cell: (g) => <ClientCell id={g.userId} name={g.name} sub={g.login ? <span>acc {g.login}</span> : undefined} />, sort: (g) => g.name, csv: (g) => g.userId },
    { key: "cp", header: "Campaign", hideOn: "lg", cell: (g) => <span className="block max-w-44"><span className="block truncate text-[12.5px] text-fg-2">{g.campaign}</span><span className="block text-[11px] text-fg-3">{g.source} · {when(g.claimedAt)}</span></span>, csv: (g) => g.campaign },
    { key: "dep", header: "Deposit", align: "right", cell: (g) => (g.depositAmount ? <span className="k-num">{usd(g.depositAmount)}</span> : <span className="text-fg-3">—</span>), sort: (g) => g.depositAmount ?? 0, csv: (g) => g.depositAmount ?? "" },
    { key: "amt", header: "Bonus", align: "right", cell: (g) => <span className="k-num text-gold">{usd(g.amount)}</span>, sort: (g) => g.amount, csv: (g) => g.amount },
    {
      key: "rel",
      header: "Release",
      width: "190px",
      cell: (g) => (
        <div className="min-w-[150px]">
          <div className="mb-1 flex justify-between text-[11px]">
            <span className="k-num text-fg-3">
              {num(g.lotsTraded)} / {num(g.lotsRequired)} lots
            </span>
            <span className={cn("k-num font-medium", g.progressPct >= 100 ? "text-up" : "text-fg-2")}>{num(g.progressPct, 0)}%</span>
          </div>
          <Progress value={g.progressPct} tone={g.progressPct >= 100 ? "up" : g.status === "forfeited" || g.status === "cancelled" ? "down" : "gold"} />
          <div className="k-num mt-1 text-[10.5px] text-fg-3">
            {usd(g.released)} released · {usd(g.remaining)} left
          </div>
        </div>
      ),
      sort: (g) => g.progressPct,
      csv: (g) => g.released,
    },
    { key: "exp", header: "Expires", align: "right", hideOn: "md", cell: (g) => <span className="k-num text-[12.5px] text-fg-2">{g.status === "awaiting_deposit" ? (g.claimDeadline ? `deposit by ${day(g.claimDeadline)}` : "—") : day(g.expiresAt)}</span>, csv: (g) => g.expiresAt ?? "" },
    { key: "st", header: "Status", cell: (g) => <span className="flex flex-col items-start gap-0.5"><StatusPill map={GRANT_STATUS} status={g.status} />{g.endReason && <span className="max-w-32 truncate text-[10.5px] text-fg-3">{g.endReason}</span>}</span>, csv: (g) => g.status },
    ...(canApprove
      ? [
          {
            key: "x",
            header: "",
            align: "right" as const,
            cell: (g: Grant) =>
              g.status === "active" || g.status === "pending" || g.status === "awaiting_deposit" ? (
                <Button size="xs" variant="down-outline" onClick={() => cancel(g)}>
                  Cancel
                </Button>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <Card data-testid="grants-table">
      <CardHeader title="Bonus grants" subtitle="Every claim, promo, redemption and manual grant with its per-lot release progress" />
      <div className="mt-4 px-4 pb-5 sm:px-6">
        {error && !data ? (
          <MkError error={error} onRetry={reload} />
        ) : !data ? (
          <TableSkeleton />
        ) : (
          <div className={loading ? "opacity-60 transition-opacity" : undefined}>
            <DataTable
              columns={cols}
              rows={data.items}
              pageSize={PER}
              dense
              rowKey={(g) => String(g.id)}
              exportName="bonus-grants"
              search={(g) => `${g.name} ${g.userId} ${g.login ?? ""} ${g.campaign}`}
              searchPlaceholder="Client, account, campaign…"
              toolbar={
                <>
                  <FilterSelect
                    label="State"
                    value={status}
                    onChange={setStatus}
                    options={[{ value: "all", label: "All" }, ...Object.entries(GRANT_STATUS).map(([value, s]) => ({ value, label: s.label }))]}
                  />
                  <FilterSelect label="Campaign" value={campaign} onChange={setCampaign} options={[{ value: "all", label: "All" }, ...campaigns.map((c) => ({ value: String(c.id), label: c.name }))]} />
                </>
              }
              empty={<EmptyNote className="mt-3" title="No grants" text="Grants appear when clients claim a campaign, redeem a code or when staff grant one manually." />}
            />
            <Pager page={page} perPage={PER} total={data.total} onPage={setPage} />
          </div>
        )}
      </div>
    </Card>
  );
}

function ManualGrantDialog({ open, onOpenChange, campaigns, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; campaigns: Campaign[]; onSaved: () => void }) {
  const [campaignId, setCampaignId] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [login, setLogin] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setCampaignId(String(campaigns.find((c) => c.status === "active")?.id ?? campaigns[0]?.id ?? ""));
      setUserId("");
      setLogin("");
      setAmount("");
      setNote("");
    }
  }, [open, campaigns]);
  const c = campaigns.find((x) => String(x.id) === campaignId);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Manual bonus grant"
      description="Posts bonus credit to a client's live account now, with the campaign's release rate and expiry."
      submitLabel="Grant bonus"
      submitTestId="grant-form-submit"
      width={560}
      submit={() => {
        if (!c) return "Pick a campaign.";
        if (!/^\d+$/.test(userId.trim())) return "Enter the client ID.";
        if (!/^\d+$/.test(login.trim())) return "Enter the live account number.";
        if (note.trim().length < 3) return "Add a note (at least 3 characters).";
        const a = numOrNull(amount);
        if (c.kind !== "fixed" && (a === null || a <= 0)) return "Enter the bonus amount.";
        return mkSend<{ grant: Grant }>("bonuses/grants", { campaignId: c.id, userId: Number(userId), login: Number(login), ...(a !== null ? { amount: a } : {}), note: note.trim() });
      }}
      success={(r: { grant: Grant }) => `Grant #${r.grant?.id ?? ""} created`}
      onDone={onSaved}
    >
      <SelectF label="Campaign" value={campaignId} onChange={setCampaignId} options={campaigns.map((x) => ({ value: String(x.id), label: `${x.name} · ${x.status}` }))} />
      <div className="grid grid-cols-2 gap-3">
        <TextF label="Client ID" value={userId} onChange={setUserId} mono placeholder="e.g. 1042" />
        <TextF label="Account" value={login} onChange={setLogin} mono placeholder="Live login" />
        <NumF label="Amount" value={amount} onChange={setAmount} prefix="$" placeholder={c && c.kind === "fixed" ? String(c.fixedAmount) : ""} hint={c?.kind === "fixed" ? "optional" : "required"} className="col-span-2" />
      </div>
      <AreaF label="Note" value={note} onChange={setNote} rows={2} placeholder="Why is this granted? Kept in the audit log." />
      {c && (
        <div className="k-row px-3.5 py-2.5 text-[12.5px] text-fg-2">
          Releases {usd(c.releasePerLot)} per lot · expires after {int(c.expiryDays)} days. {c.kind === "fixed" ? "Leave the amount empty to use the campaign's fixed amount." : "Deposit campaigns need an amount."}
        </div>
      )}
    </FormDialog>
  );
}
