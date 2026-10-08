"use client";

import * as React from "react";
import { Ban, Dices, Plus, RefreshCw, ShieldAlert, Ticket, Users } from "lucide-react";
import { Button, Card, CardHeader, Chip, CopyButton, DataTable, KpiCard, PageHeader, Progress, Reveal, Segmented, type ChipTone, type Column } from "@ezymex/ui";
import { FilterSelect, Pager, TableSkeleton, countryName, day, qs, useApi, when } from "@/components/live/kit";
import { M, mkSend, type AppliesTo, type Campaign, type Overview, type Paged, type Promo, type PromoInput, type PromoKind, type PromoUse } from "./api";
import {
  ClientCell,
  DateTimeF,
  EmptyNote,
  FormDialog,
  FormSection,
  MkError,
  NumF,
  PAY_STATUS,
  ReadOnlyNote,
  SelectF,
  StatusPill,
  TextF,
  ToggleRow,
  fromLocalInput,
  int,
  num,
  numOrNull,
  splitList,
  toLocalInput,
  useAction,
  usePerms,
  windowState,
} from "./kit";

const KIND: Record<PromoKind, { label: string; tone: ChipTone }> = { bonus: { label: "Bonus", tone: "ember" }, points: { label: "Points", tone: "gold" }, discount: { label: "Fee discount", tone: "info" } };
const APPLIES: Record<AppliesTo, string> = { any: "any fee", prop: "prop challenges", commission: "commission" };
type Filter = "all" | "active" | "scheduled" | "paused" | "ended";
const PER = 25;

function valueText(p: Promo, campaigns: Campaign[]) {
  if (p.kind === "bonus") return campaigns.find((c) => c.id === p.campaignId)?.name ?? (p.campaignId ? `Campaign #${p.campaignId}` : "—");
  if (p.kind === "points") return `${int(p.points)} points`;
  return `${num(p.discountPct)}% off ${APPLIES[p.discountAppliesTo] ?? p.discountAppliesTo}`;
}

function segmentText(p: { newUsersDays: number | null; countries: string[]; kycRequired: boolean }) {
  const parts: string[] = [];
  if (p.newUsersDays) parts.push(`New ≤ ${p.newUsersDays}d`);
  if (p.countries?.length) parts.push(p.countries.length <= 3 ? p.countries.join(", ") : `${p.countries.length} countries`);
  if (p.kycRequired) parts.push("KYC");
  return parts.length ? parts.join(" · ") : "Everyone";
}

export function LivePromoCodes() {
  const perms = usePerms();
  const act = useAction();
  const ov = useApi<Overview>(M("overview"));
  const promos = useApi<{ items: Promo[] }>(M("promos"));
  const camps = useApi<{ items: Campaign[] }>(M("bonuses/campaigns"));
  const [filter, setFilter] = React.useState<Filter>("all");
  const [open, setOpen] = React.useState(false);
  const [logTick, setLogTick] = React.useState(0);
  const items = promos.data?.items ?? [];
  const campaigns = camps.data?.items ?? [];
  const now = Date.now();
  const rows = items.filter((p) => filter === "all" || windowState(p.active, p.startsAt, p.endsAt, now).key === filter);
  const k = ov.data?.promos;
  const totalUses = items.reduce((s, p) => s + (p.uses || 0), 0);

  const toggle = (p: Promo) =>
    act.ask({
      title: p.active ? `Deactivate ${p.code}` : `Activate ${p.code}`,
      description: p.active ? "New redemptions are refused. Benefits already applied stay." : "Clients can redeem the code again inside its window and limits.",
      confirmLabel: p.active ? "Deactivate" : "Activate",
      confirmVariant: p.active ? "surface" : "ember",
      note: "none",
      run: () => mkSend(`promos/${p.id}`, { active: !p.active }, "PATCH"),
      success: p.active ? `${p.code} deactivated` : `${p.code} is active`,
      onDone: () => (promos.reload(), ov.reload()),
    });

  const cols: Column<Promo>[] = [
    {
      key: "code",
      header: "Code",
      cell: (p) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-mono text-[13px] font-semibold tracking-wide">{p.code}</span>
            <CopyButton value={p.code} label={p.code} />
          </div>
          {p.description && <div className="max-w-52 truncate text-[11.5px] text-fg-3">{p.description}</div>}
        </div>
      ),
      sort: (p) => p.code,
      csv: (p) => p.code,
    },
    { key: "kind", header: "Kind", cell: (p) => <Chip size="sm" tone={KIND[p.kind]?.tone ?? "neutral"}>{KIND[p.kind]?.label ?? p.kind}</Chip>, sort: (p) => p.kind, csv: (p) => p.kind },
    { key: "val", header: "Value", cell: (p) => <span className="block max-w-48 truncate text-[13px]">{valueText(p, campaigns)}</span>, csv: (p) => valueText(p, campaigns) },
    {
      key: "uses",
      header: "Uses / limit",
      width: "160px",
      cell: (p) => {
        const pc = p.maxUses ? (p.uses / p.maxUses) * 100 : 0;
        return (
          <div className="min-w-[120px]">
            <div className="mb-1 flex justify-between text-[11.5px]">
              <span className="k-num text-fg">{int(p.uses)}</span>
              <span className="k-num text-fg-3">/ {p.maxUses ? int(p.maxUses) : "∞"}</span>
            </div>
            {p.maxUses ? <Progress value={pc} tone={pc >= 100 ? "warn" : pc > 85 ? "gold" : "ember"} /> : <div className="h-1.5 rounded-full bg-surface-3" />}
            {p.blocked > 0 && <div className="k-num mt-1 text-[10.5px] text-down">{int(p.blocked)} blocked</div>}
          </div>
        );
      },
      sort: (p) => p.uses,
      csv: (p) => p.uses,
    },
    { key: "pu", header: "Per user", align: "right", hideOn: "md", cell: (p) => <span className="k-num">{int(p.perUserLimit)}</span>, csv: (p) => p.perUserLimit },
    { key: "win", header: "Window", hideOn: "md", cell: (p) => <span className="k-num whitespace-nowrap text-[12.5px] text-fg-2">{day(p.startsAt)} – {p.endsAt ? day(p.endsAt) : "open"}</span>, sort: (p) => p.startsAt, csv: (p) => `${p.startsAt} ${p.endsAt ?? ""}` },
    { key: "seg", header: "Segment", hideOn: "lg", cell: (p) => <span className="whitespace-nowrap text-[12.5px] text-fg-2">{segmentText(p)}</span>, csv: (p) => segmentText(p) },
    {
      key: "st",
      header: "Status",
      cell: (p) => {
        const w = windowState(p.active, p.startsAt, p.endsAt, now);
        const exhausted = p.maxUses !== null && p.uses >= p.maxUses;
        return (
          <Chip size="sm" dot tone={exhausted ? "warn" : w.tone}>
            {exhausted ? "Limit reached" : w.label}
          </Chip>
        );
      },
      csv: (p) => (p.active ? "active" : "inactive"),
    },
    ...(perms.write
      ? [
          {
            key: "x",
            header: "",
            align: "right" as const,
            cell: (p: Promo) => (
              <Button size="xs" variant="surface" onClick={() => toggle(p)}>
                {p.active ? "Deactivate" : "Activate"}
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Promo codes"
        subtitle="Bonus, points and fee-discount codes with usage limits, validity windows and segment rules."
        actions={
          <>
            {perms.loaded && !perms.write && <ReadOnlyNote what="create codes" />}
            <Button variant="surface" onClick={() => (promos.reload(), ov.reload(), setLogTick((n) => n + 1))}>
              <RefreshCw /> Refresh
            </Button>
            {perms.write && (
              <Button variant="ember" onClick={() => setOpen(true)} data-testid="new-promo">
                <Plus /> New code
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active codes" icon={<Ticket />} value={<span className="k-num">{k ? int(k.active) : "—"}</span>} chip={promos.data ? `${items.length} total` : "Loading"} />
        <KpiCard label="Redemptions · 30d" icon={<Users />} value={<span className="k-num">{k ? int(k.redemptions30d) : "—"}</span>} chip="Applied codes" chipTone="up" delay={0.05} />
        <KpiCard label="Blocked · 30d" icon={<ShieldAlert />} value={<span className="k-num">{k ? int(k.blocked30d) : "—"}</span>} chip="Limits, window or segment" chipTone="down" delay={0.1} />
        <KpiCard label="Uses · all codes" icon={<Ticket />} value={<span className="k-num">{promos.data ? int(totalUses) : "—"}</span>} chip={`${items.filter((p) => p.kind === "bonus").length} bonus · ${items.filter((p) => p.kind === "points").length} points · ${items.filter((p) => p.kind === "discount").length} discount`} delay={0.15} />
      </div>

      <Reveal delay={0.05} className="mt-4">
        <Card>
          <CardHeader title="All codes" subtitle="Checked and counted under a row lock, so limits hold under concurrency" />
          <div className="mt-4 px-4 pb-5 sm:px-6">
            {promos.error && !promos.data ? (
              <MkError error={promos.error} onRetry={promos.reload} />
            ) : !promos.data ? (
              <TableSkeleton />
            ) : (
              <DataTable
                columns={cols}
                rows={rows}
                pageSize={15}
                dense
                rowKey={(p) => String(p.id)}
                search={(p) => `${p.code} ${p.description} ${p.kind}`}
                searchPlaceholder="Search code…"
                exportName="promo-codes"
                toolbar={
                  <Segmented
                    size="xs"
                    value={filter}
                    onChange={setFilter}
                    options={[
                      { value: "all", label: <>All <span className="text-fg-3">{items.length}</span></> },
                      { value: "active", label: "Active" },
                      { value: "scheduled", label: "Scheduled" },
                      { value: "paused", label: "Inactive" },
                      { value: "ended", label: "Ended" },
                    ]}
                  />
                }
                empty={<EmptyNote className="mt-3" title={items.length ? "No codes match this filter" : "No promo codes yet"} text={items.length ? undefined : "Create a code that claims a bonus campaign, credits loyalty points or issues a fee-discount voucher."} />}
              />
            )}
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.1} className="mt-4">
        <RedemptionLog promos={items} tick={logTick} />
      </Reveal>

      <PromoDialog open={open} onOpenChange={setOpen} campaigns={campaigns} onSaved={() => (promos.reload(), ov.reload())} />
      {act.node}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RedemptionLog({ promos, tick }: { promos: Promo[]; tick: number }) {
  const [promo, setPromo] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [promo, status]);
  const { data, error, loading, reload } = useApi<Paged<PromoUse>>(`${M("promos/redemptions")}${qs({ promo, status, page, limit: PER })}`);
  React.useEffect(() => {
    if (tick) reload();
  }, [tick, reload]);
  const cols: Column<PromoUse>[] = [
    { key: "at", header: "Time", cell: (r) => <span className="k-num whitespace-nowrap text-[12.5px] text-fg-2">{when(r.createdAt)}</span>, sort: (r) => r.createdAt, csv: (r) => r.createdAt },
    { key: "c", header: "Client", cell: (r) => <ClientCell id={r.userId} name={r.name} />, csv: (r) => r.userId },
    { key: "code", header: "Code", cell: (r) => <span className="font-mono text-[12.5px] font-medium">{r.code}</span>, csv: (r) => r.code },
    { key: "k", header: "Kind", hideOn: "md", cell: (r) => <span className="text-[12.5px] text-fg-2">{KIND[r.kind as PromoKind]?.label ?? r.kind}</span>, csv: (r) => r.kind },
    { key: "st", header: "Result", cell: (r) => <StatusPill map={PAY_STATUS} status={r.status} />, csv: (r) => r.status },
    {
      key: "why",
      header: "Reason",
      cell: (r) =>
        r.status === "blocked" ? (
          <span className="flex max-w-72 items-start gap-1.5 text-[12.5px] text-down">
            <Ban className="mt-0.5 size-3 shrink-0" />
            <span className="truncate" title={r.reason ?? undefined}>{r.reason ?? "Blocked"}</span>
          </span>
        ) : (
          <span className="text-fg-3">—</span>
        ),
      csv: (r) => r.reason ?? "",
    },
  ];
  return (
    <Card>
      <CardHeader title="Redemptions" subtitle="Every attempt, most recent first · blocked attempts keep the reason" />
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
              rowKey={(r) => String(r.id)}
              exportName="promo-redemptions"
              toolbar={
                <>
                  <FilterSelect label="Promo" value={promo} onChange={setPromo} options={[{ value: "all", label: "All" }, ...promos.map((p) => ({ value: String(p.id), label: p.code }))]} />
                  <FilterSelect label="Result" value={status} onChange={setStatus} options={[{ value: "all", label: "All" }, { value: "applied", label: "Applied" }, { value: "blocked", label: "Blocked" }]} />
                </>
              }
              empty={<EmptyNote className="mt-3" title="No redemptions" text="Attempts appear here when clients enter a code in the Client Area." />}
            />
            <Pager page={page} perPage={PER} total={data.total} onPage={setPage} />
          </div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function randomCode() {
  const words = ["GOLD", "PIPS", "BOOST", "EDGE", "ALPHA", "FLOW", "PRIME", "SURGE"];
  return `${words[Math.floor(Math.random() * words.length)]}${Math.floor(10 + Math.random() * 89)}`;
}

function PromoDialog({ open, onOpenChange, campaigns, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; campaigns: Campaign[]; onSaved: () => void }) {
  const [code, setCode] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [kind, setKind] = React.useState<PromoKind>("bonus");
  const [campaignId, setCampaignId] = React.useState("");
  const [points, setPoints] = React.useState("500");
  const [discountPct, setDiscountPct] = React.useState("20");
  const [appliesTo, setAppliesTo] = React.useState<AppliesTo>("any");
  const [maxUses, setMaxUses] = React.useState("");
  const [perUser, setPerUser] = React.useState("1");
  const [newUsersDays, setNewUsersDays] = React.useState("");
  const [countries, setCountries] = React.useState("");
  const [kyc, setKyc] = React.useState(false);
  const [active, setActive] = React.useState(true);
  const [startsAt, setStartsAt] = React.useState("");
  const [endsAt, setEndsAt] = React.useState("");
  React.useEffect(() => {
    if (!open) return;
    setCode("");
    setDescription("");
    setKind("bonus");
    setCampaignId(String(campaigns.find((c) => c.status === "active")?.id ?? campaigns[0]?.id ?? ""));
    setPoints("500");
    setDiscountPct("20");
    setAppliesTo("any");
    setMaxUses("");
    setPerUser("1");
    setNewUsersDays("");
    setCountries("");
    setKyc(false);
    setActive(true);
    setStartsAt(toLocalInput(new Date().toISOString()));
    setEndsAt("");
  }, [open, campaigns]);

  const countryList = splitList(countries, true);
  const badCountry = countryList.find((c) => !/^[A-Z]{2}$/.test(c));
  const campaign = campaigns.find((c) => String(c.id) === campaignId);
  const benefit = kind === "bonus" ? (campaign ? campaign.name : "Pick a campaign") : kind === "points" ? `${int(Number(points) || 0)} loyalty points` : `${num(Number(discountPct) || 0)}% off ${APPLIES[appliesTo]}`;

  const submit = () => {
    if (!/^[A-Z0-9-]{3,32}$/.test(code)) return "Code must be 3–32 characters: A–Z, 0–9 and dashes.";
    if (kind === "bonus" && !campaign) return "Pick the bonus campaign the code claims.";
    if (kind === "points" && !(Number(points) > 0)) return "Points must be above 0.";
    if (kind === "discount" && !(Number(discountPct) > 0 && Number(discountPct) <= 100)) return "Discount must be between 0 and 100%.";
    if (badCountry) return `Countries: "${badCountry}" isn't an ISO-2 code.`;
    const s = fromLocalInput(startsAt);
    const e = fromLocalInput(endsAt);
    if (s && e && e <= s) return "Ends must be after Starts.";
    const body: PromoInput = {
      code,
      description: description.trim(),
      kind,
      campaignId: kind === "bonus" ? campaign!.id : null,
      points: kind === "points" ? Math.round(Number(points)) : null,
      discountPct: kind === "discount" ? Number(discountPct) : null,
      discountAppliesTo: appliesTo,
      maxUses: numOrNull(maxUses),
      perUserLimit: Math.max(1, Math.round(Number(perUser) || 1)),
      newUsersDays: numOrNull(newUsersDays),
      countries: countryList,
      kycRequired: kyc,
      active,
      ...(s ? { startsAt: s } : {}),
      endsAt: e,
    };
    return mkSend<{ promo: Promo }>("promos", body);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New promo code"
      description="Clients enter the code in the Client Area. Every attempt is logged, including blocked ones."
      width={820}
      submitLabel="Create code"
      submitTestId="promo-form-submit"
      submit={submit}
      success={`${code} created`}
      onDone={onSaved}
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_240px]">
        <div className="space-y-5">
          <FormSection title="Code">
            <TextF
              label="Code"
              value={code}
              onChange={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32))}
              mono
              placeholder="e.g. AUTUMN30"
              hint={
                <button type="button" onClick={() => setCode(randomCode())} className="inline-flex items-center gap-1 text-fg-2 hover:text-fg">
                  <Dices className="size-3.5" /> Generate
                </button>
              }
            />
            <TextF label="Description" value={description} onChange={setDescription} placeholder="Internal note or campaign reference" />
          </FormSection>

          <FormSection title="Benefit">
            <SelectF
              label="Kind"
              value={kind}
              onChange={setKind}
              options={[
                { value: "bonus", label: "Bonus campaign" },
                { value: "points", label: "Loyalty points" },
                { value: "discount", label: "Fee discount voucher" },
              ]}
            />
            {kind === "bonus" &&
              (campaigns.length ? (
                <SelectF label="Campaign" value={campaignId} onChange={setCampaignId} options={campaigns.map((c) => ({ value: String(c.id), label: `${c.name} · ${c.status}${c.visibility === "code_only" ? " · code only" : ""}` }))} />
              ) : (
                <div className="k-row px-3.5 py-2.5 text-[12.5px] text-fg-3">No bonus campaigns yet. Create one under Bonuses first.</div>
              ))}
            {kind === "points" && <NumF label="Points" value={points} onChange={setPoints} suffix="pts" step={1} />}
            {kind === "discount" && (
              <div className="grid grid-cols-2 gap-3">
                <NumF label="Discount" value={discountPct} onChange={setDiscountPct} suffix="%" />
                <SelectF label="Applies to" value={appliesTo} onChange={setAppliesTo} options={[{ value: "any", label: "Any fee" }, { value: "prop", label: "Prop challenges" }, { value: "commission", label: "Commission" }]} />
              </div>
            )}
          </FormSection>

          <FormSection title="Limits and segment">
            <div className="grid grid-cols-2 gap-3">
              <NumF label="Max uses" value={maxUses} onChange={setMaxUses} placeholder="Unlimited" step={1} />
              <NumF label="Per-user limit" value={perUser} onChange={setPerUser} step={1} />
              <NumF label="New users within" value={newUsersDays} onChange={setNewUsersDays} suffix="days" placeholder="Anyone" step={1} />
              <TextF label="Countries" value={countries} onChange={setCountries} mono placeholder="All countries" hint="ISO-2, comma separated" error={badCountry ? `"${badCountry}" isn't ISO-2` : null} />
              <DateTimeF label="Starts" value={startsAt} onChange={setStartsAt} />
              <DateTimeF label="Ends" value={endsAt} onChange={setEndsAt} hint="optional" />
            </div>
            <div className="k-row divide-y divide-line px-4">
              <ToggleRow label="Verified clients only" hint="Refused until KYC is approved" checked={kyc} onChange={setKyc} />
              <ToggleRow label="Active" hint="Off: saved but not redeemable" checked={active} onChange={setActive} />
            </div>
          </FormSection>
        </div>

        <div className="md:sticky md:top-0 md:self-start">
          <div className="k-label mb-2.5">Client preview</div>
          <div className="rounded-[18px] border border-line bg-surface-2 p-4">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-fg-3">Promo code</div>
            <div className="mt-2 font-mono text-[21px] font-semibold tracking-[0.08em] text-fg">{code || "CODE"}</div>
            <div className="mt-1 text-[13px] font-medium text-ember">{benefit}</div>
            <div className="my-3 border-t border-dashed border-line" />
            <div className="space-y-1 text-[11.5px] text-fg-3">
              <div className="flex justify-between gap-2">
                <span>Valid</span>
                <span className="k-num text-right text-fg-2">
                  {startsAt ? day(fromLocalInput(startsAt)) : "now"} – {endsAt ? day(fromLocalInput(endsAt)) : "open"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Limit</span>
                <span className="k-num text-fg-2">
                  {Number(perUser) || 1}/client · {maxUses ? int(Number(maxUses)) : "∞"} total
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Who</span>
                <span className="truncate text-right text-fg-2">{segmentText({ newUsersDays: numOrNull(newUsersDays), countries: countryList, kycRequired: kyc })}</span>
              </div>
            </div>
          </div>
          {countryList.length > 0 && !badCountry && <p className="mt-3 text-[11.5px] text-fg-3">{countryList.map(countryName).join(", ")}</p>}
        </div>
      </div>
    </FormDialog>
  );
}
