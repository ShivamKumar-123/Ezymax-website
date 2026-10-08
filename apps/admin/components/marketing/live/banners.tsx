"use client";

import * as React from "react";
import { CalendarRange, Eye, Image as ImageIcon, MousePointerClick, Pencil, Plus, RefreshCw, Users, X } from "lucide-react";
import { Button, Card, CardHeader, Chip, KpiCard, PageHeader, Reveal, Segmented, cn } from "@ezymex/ui";
import { TableSkeleton, day, qs, useApi, useDebounced } from "@/components/live/kit";
import { M, mkSend, type AccountType, type Banner, type BannerInput, type BannerView, type Kyc, type Overview, type Placement, type Tone } from "./api";
import {
  AreaF,
  DateTimeF,
  EmptyNote,
  FormDialog,
  FormSection,
  MkError,
  NumF,
  PillPicker,
  ReadOnlyNote,
  SelectF,
  TextF,
  ToggleRow,
  fromLocalInput,
  int,
  numOrNull,
  numStr,
  pct,
  splitList,
  toLocalInput,
  useAction,
  usePerms,
  windowState,
} from "./kit";

const PLACEMENTS: { value: Placement; label: string }[] = [
  { value: "dashboard", label: "Dashboard" },
  { value: "wallet", label: "Wallet" },
  { value: "rewards", label: "Rewards" },
  { value: "terminal", label: "Terminal" },
];
const KYC_OPTS: { value: Kyc; label: string }[] = [
  { value: "unverified", label: "Unverified" },
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];
const ACC_OPTS: { value: AccountType; label: string }[] = [
  { value: "live", label: "Live account" },
  { value: "demo", label: "Demo account" },
  { value: "none", label: "No account" },
];
const TONES: { value: Tone; label: string }[] = [
  { value: "ember", label: "Ember" },
  { value: "gold", label: "Gold" },
  { value: "neutral", label: "Neutral" },
  { value: "up", label: "Green" },
];

const ctrOf = (b: { impressions: number; clicks: number }) => (b.impressions > 0 ? (b.clicks / b.impressions) * 100 : 0);

/* ------------------------------------------------------------------ */
/* The banner as the client sees it (Client Area banner slot)           */
/* ------------------------------------------------------------------ */

const TONE_CLS: Record<Tone, { box: string; cta: string; accent: string }> = {
  ember: { box: "border-ember/30 bg-ember-soft", cta: "bg-ember text-white", accent: "bg-ember" },
  gold: { box: "border-gold/30 bg-gold-soft", cta: "bg-gold text-[#1a1204]", accent: "bg-gold" },
  neutral: { box: "border-line bg-surface-2", cta: "bg-fg text-bg", accent: "bg-fg-3" },
  up: { box: "border-up/30 bg-up-soft", cta: "bg-up text-white", accent: "bg-up" },
};

export function ClientBanner({ b, className }: { b: Pick<BannerView, "title" | "body" | "ctaLabel" | "imageUrl" | "tone" | "dismissible">; className?: string }) {
  const t = TONE_CLS[b.tone] ?? TONE_CLS.ember;
  return (
    <div className={cn("relative flex min-h-[112px] overflow-hidden rounded-[16px] border", t.box, className)}>
      <span className={cn("w-1 shrink-0", t.accent)} />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3.5 pr-8">
        <div className="line-clamp-2 text-[15px] font-medium leading-snug tracking-tight text-fg">{b.title || "Banner title"}</div>
        {b.body && <div className="line-clamp-2 text-[12.5px] leading-snug text-fg-2">{b.body}</div>}
        {b.ctaLabel && <span className={cn("mt-2 inline-flex h-7 w-fit items-center rounded-full px-3.5 text-[12px] font-medium", t.cta)}>{b.ctaLabel}</span>}
      </div>
      {b.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.imageUrl} alt="" className="hidden w-[34%] shrink-0 object-cover sm:block" />
      )}
      {b.dismissible && (
        <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-bg/60 text-fg-3" aria-hidden>
          <X className="size-3.5" />
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function LiveBanners() {
  const perms = usePerms();
  const act = useAction();
  const ov = useApi<Overview>(M("overview"));
  const list = useApi<{ items: Banner[] }>(M("banners"));
  const [placement, setPlacement] = React.useState<"all" | Placement>("all");
  const [editing, setEditing] = React.useState<Banner | null>(null);
  const [open, setOpen] = React.useState(false);
  const [previewTick, setPreviewTick] = React.useState(0);
  const items = list.data?.items ?? [];
  const shown = items.filter((b) => placement === "all" || b.placement === placement).sort((a, b) => a.placement.localeCompare(b.placement) || b.priority - a.priority);
  const k = ov.data?.banners;
  const count = (p: Placement) => items.filter((b) => b.placement === p).length;

  const edit = (b: Banner | null) => {
    setEditing(b);
    setOpen(true);
  };
  const reloadAll = () => {
    list.reload();
    ov.reload();
    setPreviewTick((n) => n + 1);
  };
  const toggle = (b: Banner) =>
    act.ask({
      title: b.active ? `Turn off "${b.title}"` : `Turn on "${b.title}"`,
      description: b.active ? "Clients stop seeing it on their next page load." : "Shown to matching clients inside its window.",
      confirmLabel: b.active ? "Turn off" : "Turn on",
      confirmVariant: b.active ? "surface" : "ember",
      note: "none",
      run: () => mkSend(`banners/${b.id}`, { active: !b.active }, "PATCH"),
      success: b.active ? "Banner turned off" : "Banner is on",
      onDone: reloadAll,
    });

  return (
    <div className="pb-16">
      <PageHeader
        title="Banners"
        subtitle="Targeted announcements in the Client Area and the terminal, by country, KYC, account type and sign-up date."
        actions={
          <>
            {perms.loaded && !perms.write && <ReadOnlyNote what="edit banners" />}
            <Button variant="surface" onClick={reloadAll}>
              <RefreshCw /> Refresh
            </Button>
            {perms.write && (
              <Button variant="ember" onClick={() => edit(null)} data-testid="new-banner">
                <Plus /> New banner
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Live banners" icon={<ImageIcon />} value={<span className="k-num">{k ? int(k.active) : "—"}</span>} chip={list.data ? `${items.length} in library` : "Loading"} />
        <KpiCard label="Impressions · 30d" icon={<Users />} value={<span className="k-num">{k ? int(k.impressions30d) : "—"}</span>} chip="One per client per day" delay={0.05} />
        <KpiCard label="Clicks · 30d" icon={<MousePointerClick />} value={<span className="k-num">{k ? int(k.clicks30d) : "—"}</span>} chip="CTA clicks" delay={0.1} />
        <KpiCard label="CTR · 30d" icon={<Eye />} value={<span className="k-num">{k ? pct(k.impressions30d ? (k.clicks30d / k.impressions30d) * 100 : 0, 2) : "—"}</span>} chip="Clicks ÷ impressions" chipTone="gold" delay={0.15} />
      </div>

      <Reveal delay={0.05} className="mt-4">
        <Card>
          <CardHeader
            title="Banner library"
            subtitle="Rendered as clients see them · highest priority first in each placement"
            action={
              <Segmented
                size="sm"
                value={placement}
                onChange={setPlacement}
                options={[{ value: "all", label: <>All <span className="text-fg-3">{items.length}</span></> }, ...PLACEMENTS.map((p) => ({ value: p.value, label: <>{p.label} <span className="text-fg-3">{count(p.value)}</span></> }))]}
              />
            }
          />
          <div className="mt-5 px-4 pb-6 sm:px-6">
            {list.error && !list.data ? (
              <MkError error={list.error} onRetry={list.reload} />
            ) : !list.data ? (
              <TableSkeleton rows={3} />
            ) : shown.length === 0 ? (
              <EmptyNote title={items.length ? "No banners in this placement" : "No banners yet"} text={items.length ? undefined : "Create a banner and target it by placement, country, KYC status, account type and sign-up date."} />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {shown.map((b) => (
                  <BannerTile key={b.id} b={b} canWrite={perms.write} onEdit={() => edit(b)} onToggle={() => toggle(b)} />
                ))}
              </div>
            )}
          </div>
        </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-7">
          <PreviewCard tick={previewTick} />
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-5">
          <CtrCard items={items} />
        </Reveal>
      </div>

      <BannerDialog open={open} onOpenChange={setOpen} banner={editing} onSaved={reloadAll} />
      {act.node}
    </div>
  );
}

function targeting(b: Pick<BannerInput, "countries" | "kyc" | "accountTypes" | "newUsersDays">) {
  const out: string[] = [];
  if (b.countries?.length) out.push(b.countries.length <= 4 ? b.countries.join(" ") : `${b.countries.length} countries`);
  if (b.kyc?.length) out.push(`KYC ${b.kyc.join("/")}`);
  if (b.accountTypes?.length) out.push(b.accountTypes.map((a) => (a === "none" ? "no account" : a)).join("/"));
  if (b.newUsersDays) out.push(`new ≤ ${b.newUsersDays}d`);
  return out;
}

function BannerTile({ b, canWrite, onEdit, onToggle }: { b: Banner; canWrite: boolean; onEdit: () => void; onToggle: () => void }) {
  const w = windowState(b.active, b.startsAt, b.endsAt);
  const ctr = ctrOf(b);
  const tags = targeting(b);
  return (
    <div className="k-row flex h-full flex-col p-2.5" data-testid={`banner-tile-${b.id}`}>
      <ClientBanner b={b} />
      <div className="flex flex-1 flex-col px-1.5 pb-1 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip size="sm" dot tone={w.tone}>
            {w.label}
          </Chip>
          <Chip size="sm">{PLACEMENTS.find((p) => p.value === b.placement)?.label ?? b.placement}</Chip>
          <span className="font-mono text-[11px] text-fg-3">P{b.priority}</span>
          {canWrite && (
            <span className="ml-auto flex gap-1.5">
              <Button size="xs" variant="surface" onClick={onToggle}>
                {b.active ? "Turn off" : "Turn on"}
              </Button>
              <Button size="xs" variant="surface" onClick={onEdit} aria-label={`Edit ${b.title}`}>
                <Pencil />
              </Button>
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-1 truncate text-[11.5px] text-fg-3">
          <CalendarRange className="size-3.5 shrink-0" />
          {day(b.startsAt)} – {b.endsAt ? day(b.endsAt) : "no end"}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.length ? (
            tags.map((t) => (
              <Chip key={t} size="sm" tone="ember">
                {t}
              </Chip>
            ))
          ) : (
            <Chip size="sm">All clients</Chip>
          )}
        </div>
        <div className="mt-auto grid grid-cols-4 gap-2 border-t border-line pt-3">
          <MiniNum label="Impr." value={int(b.impressions)} />
          <MiniNum label="Clicks" value={int(b.clicks)} />
          <MiniNum label="Dismiss" value={int(b.dismissals)} />
          <div className="text-right">
            <div className="text-[10.5px] uppercase tracking-[0.06em] text-fg-3">CTR</div>
            <div className={cn("k-num text-[14px] font-semibold", ctr >= 5 ? "text-up" : ctr >= 2 ? "text-gold" : ctr > 0 ? "text-fg-2" : "text-fg-3")}>{b.impressions ? pct(ctr, 2) : "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniNum({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-[0.06em] text-fg-3">{label}</div>
      <div className="k-num truncate text-[14px] font-medium">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Preview as a segment                                                 */
/* ------------------------------------------------------------------ */

function PreviewCard({ tick }: { tick: number }) {
  const [placement, setPlacement] = React.useState<Placement>("dashboard");
  const [country, setCountry] = React.useState("");
  const [kyc, setKyc] = React.useState<"all" | Kyc>("verified");
  const [accountType, setAccountType] = React.useState<"all" | AccountType>("live");
  const [signupDays, setSignupDays] = React.useState("");
  const c = useDebounced(country.trim().toUpperCase(), 400);
  const s = useDebounced(signupDays.trim(), 400);
  const url = `${M("banners/preview")}${qs({ placement, country: /^[A-Z]{2}$/.test(c) ? c : null, kyc, accountType, signupDays: /^\d+$/.test(s) ? s : null })}`;
  const { data, error, loading, reload } = useApi<{ items: BannerView[]; audience: number }>(url);
  React.useEffect(() => {
    if (tick) reload();
  }, [tick, reload]);
  return (
    <Card className="h-full">
      <CardHeader title="Preview as a client" subtitle="What a client in this segment sees, in order" action={data ? <Chip tone="info">{int(data.audience)} matching clients</Chip> : undefined} />
      <div className="mt-4 grid grid-cols-2 gap-3 px-4 sm:grid-cols-5 sm:px-6">
        <SelectF label="Slot" value={placement} onChange={setPlacement} options={PLACEMENTS} />
        <TextF label="Country" value={country} onChange={(v) => setCountry(v.toUpperCase().slice(0, 2))} mono placeholder="Any" />
        <SelectF label="KYC" value={kyc} onChange={setKyc} options={[{ value: "all", label: "Any" }, ...KYC_OPTS]} />
        <SelectF label="Account" value={accountType} onChange={setAccountType} options={[{ value: "all", label: "Any" }, ...ACC_OPTS]} />
        <NumF label="Days since sign-up" value={signupDays} onChange={setSignupDays} placeholder="Any" step={1} />
      </div>
      <div className={cn("mt-4 space-y-2.5 px-4 pb-6 sm:px-6", loading && "opacity-60 transition-opacity")}>
        {error && !data ? (
          <MkError error={error} onRetry={reload} />
        ) : !data ? (
          <TableSkeleton rows={2} />
        ) : data.items.length === 0 ? (
          <EmptyNote title="Nothing shown" text="No active banner targets this segment on this placement right now." />
        ) : (
          data.items.map((b, i) => (
            <div key={b.id} className="flex items-start gap-3">
              <span className="k-num mt-2 w-4 shrink-0 text-[12px] text-fg-3">{i + 1}</span>
              <ClientBanner b={b} className="flex-1" />
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function CtrCard({ items }: { items: Banner[] }) {
  const rows = items
    .filter((b) => b.impressions > 0)
    .sort((a, b) => ctrOf(b) - ctrOf(a))
    .slice(0, 8);
  const best = rows[0] ? ctrOf(rows[0]) : 0;
  return (
    <Card className="h-full">
      <CardHeader title="CTR by banner" subtitle="Clicks ÷ impressions · lifetime" />
      <div className="mt-4 space-y-2 px-4 pb-6 sm:px-6">
        {rows.length === 0 ? (
          <EmptyNote title="No impressions yet" text="Stats appear once clients load a page with a banner slot." />
        ) : (
          rows.map((b, i) => {
            const c = ctrOf(b);
            return (
              <div key={b.id} className="k-row flex items-center gap-3 px-3 py-2">
                <span className="k-num w-4 text-[12px] text-fg-3">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{b.title}</div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-ember" style={{ width: `${best ? (c / best) * 100 : 0}%` }} />
                  </div>
                  <div className="k-num mt-1 text-[10.5px] text-fg-3">
                    {int(b.clicks)} clicks · {int(b.impressions)} impressions · {b.placement}
                  </div>
                </div>
                <span className="k-num w-14 text-right text-[13px] font-semibold">{pct(c, 2)}</span>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Create / edit                                                        */
/* ------------------------------------------------------------------ */

type Draft = {
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl: string;
  tone: Tone;
  placement: Placement;
  countries: string;
  kyc: Kyc[];
  accountTypes: AccountType[];
  newUsersDays: string;
  priority: string;
  dismissible: boolean;
  active: boolean;
  startsAt: string;
  endsAt: string;
};

const EMPTY: Draft = { title: "", body: "", ctaLabel: "", ctaUrl: "", imageUrl: "", tone: "ember", placement: "dashboard", countries: "", kyc: [], accountTypes: [], newUsersDays: "", priority: "100", dismissible: true, active: true, startsAt: "", endsAt: "" };

function BannerDialog({ open, onOpenChange, banner, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; banner: Banner | null; onSaved: () => void }) {
  const [d, setD] = React.useState<Draft>(EMPTY);
  React.useEffect(() => {
    if (!open) return;
    setD(
      banner
        ? {
            title: banner.title,
            body: banner.body ?? "",
            ctaLabel: banner.ctaLabel ?? "",
            ctaUrl: banner.ctaUrl ?? "",
            imageUrl: banner.imageUrl ?? "",
            tone: banner.tone,
            placement: banner.placement,
            countries: (banner.countries ?? []).join(", "),
            kyc: banner.kyc ?? [],
            accountTypes: banner.accountTypes ?? [],
            newUsersDays: numStr(banner.newUsersDays),
            priority: numStr(banner.priority),
            dismissible: banner.dismissible,
            active: banner.active,
            startsAt: toLocalInput(banner.startsAt),
            endsAt: toLocalInput(banner.endsAt),
          }
        : { ...EMPTY, startsAt: toLocalInput(new Date().toISOString()) },
    );
  }, [open, banner]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const countries = splitList(d.countries, true);
  const bad = countries.find((c) => !/^[A-Z]{2}$/.test(c));

  const submit = () => {
    if (!d.title.trim()) return "Give the banner a title.";
    if (bad) return `Countries: "${bad}" isn't an ISO-2 code.`;
    if (d.ctaLabel.trim() && !d.ctaUrl.trim()) return "Add the link the CTA opens.";
    const s = fromLocalInput(d.startsAt);
    const e = fromLocalInput(d.endsAt);
    if (s && e && e <= s) return "Ends must be after Starts.";
    const body: BannerInput = {
      title: d.title.trim(),
      body: d.body.trim(),
      ctaLabel: d.ctaLabel.trim() || null,
      ctaUrl: d.ctaUrl.trim() || null,
      imageUrl: d.imageUrl.trim() || null,
      tone: d.tone,
      placement: d.placement,
      countries,
      kyc: d.kyc,
      accountTypes: d.accountTypes,
      newUsersDays: numOrNull(d.newUsersDays),
      priority: Math.round(Number(d.priority) || 0),
      dismissible: d.dismissible,
      active: d.active,
      ...(s ? { startsAt: s } : {}),
      endsAt: e,
    };
    return banner ? mkSend(`banners/${banner.id}`, body, "PATCH") : mkSend("banners", body);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      width={1040}
      title={banner ? "Edit banner" : "New banner"}
      description="The preview on the right is how targeted clients see it."
      submitLabel={banner ? "Save changes" : "Create banner"}
      submitTestId="banner-form-submit"
      submit={submit}
      success={banner ? "Banner updated" : "Banner created"}
      onDone={onSaved}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <FormSection title="Content">
            <TextF label="Title" value={d.title} onChange={(v) => set("title", v)} maxLength={90} hint={`${d.title.length}/90`} />
            <AreaF label="Body" value={d.body} onChange={(v) => set("body", v)} rows={2} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextF label="CTA label" value={d.ctaLabel} onChange={(v) => set("ctaLabel", v)} placeholder="Optional" />
              <TextF label="CTA link" value={d.ctaUrl} onChange={(v) => set("ctaUrl", v)} mono placeholder="/wallet/deposit" />
              <TextF label="Image URL" value={d.imageUrl} onChange={(v) => set("imageUrl", v)} mono placeholder="https://… (optional)" className="sm:col-span-2" />
              <SelectF label="Tone" value={d.tone} onChange={(v) => set("tone", v)} options={TONES} />
              <SelectF label="Placement" value={d.placement} onChange={(v) => set("placement", v)} options={PLACEMENTS} />
            </div>
          </FormSection>

          <FormSection title="Targeting" hint="Empty = everyone">
            <TextF label="Countries" value={d.countries} onChange={(v) => set("countries", v)} mono placeholder="All countries" hint="ISO-2, comma separated" error={bad ? `"${bad}" isn't ISO-2` : null} />
            <PillPicker label="KYC statuses" options={KYC_OPTS} value={d.kyc} onChange={(v) => set("kyc", v)} />
            <PillPicker label="Account types" options={ACC_OPTS} value={d.accountTypes} onChange={(v) => set("accountTypes", v)} />
            <div className="grid grid-cols-2 gap-3">
              <NumF label="New users within" value={d.newUsersDays} onChange={(v) => set("newUsersDays", v)} suffix="days" placeholder="Anyone" step={1} />
              <NumF label="Priority" value={d.priority} onChange={(v) => set("priority", v)} hint="higher first" step={1} />
              <DateTimeF label="Starts" value={d.startsAt} onChange={(v) => set("startsAt", v)} />
              <DateTimeF label="Ends" value={d.endsAt} onChange={(v) => set("endsAt", v)} hint="optional" />
            </div>
            <div className="k-row divide-y divide-line px-4">
              <ToggleRow label="Dismissible" hint="Clients can close it; hidden for them afterwards" checked={d.dismissible} onChange={(v) => set("dismissible", v)} />
              <ToggleRow label="Active" hint="Off: saved but not shown" checked={d.active} onChange={(v) => set("active", v)} />
            </div>
          </FormSection>
        </div>

        <div className="lg:sticky lg:top-0 lg:self-start">
          <div className="k-label mb-2.5">Preview · {PLACEMENTS.find((p) => p.value === d.placement)?.label}</div>
          <div className="rounded-[20px] border border-line bg-bg p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="h-2.5 w-24 rounded-full bg-surface-3" />
              <div className="h-5 w-14 rounded-full bg-surface-3" />
            </div>
            <ClientBanner b={{ title: d.title, body: d.body, ctaLabel: d.ctaLabel || null, imageUrl: d.imageUrl || null, tone: d.tone, dismissible: d.dismissible }} />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 rounded-xl border border-line bg-surface" />
              ))}
            </div>
          </div>
          <p className="mt-3 text-[12px] text-fg-3">
            Shown to {targeting({ countries, kyc: d.kyc, accountTypes: d.accountTypes, newUsersDays: numOrNull(d.newUsersDays) }).join(" · ") || "all clients"}.
          </p>
        </div>
      </div>
    </FormDialog>
  );
}
