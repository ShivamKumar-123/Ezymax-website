"use client";

import * as React from "react";
import { CalendarDays, CalendarRange, Eye, Image as ImageIcon, LayoutPanelTop, MapPin, Megaphone, MousePointerClick, Newspaper, Pencil, Plus, RefreshCw, Trash2, Users, Video, X } from "lucide-react";
import { Button, Card, CardHeader, Chip, KpiCard, PageHeader, Reveal, Segmented, cn } from "@ezymex/ui";
import { TableSkeleton, day, qs, useApi, useDebounced } from "@/components/live/kit";
import { M, imageSrc, mkSend, type AccountType, type Banner, type BannerInput, type BannerKind, type BannerLayout, type BannerView, type Kyc, type Overview, type Placement, type Tone } from "./api";
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
import { HeroPreview, IMAGE_SIZE, ImageField, PostBody, UpdateCardPreview, eventRange, isLink } from "./promo-preview";

const PLACEMENTS: { value: Placement; label: string }[] = [
  { value: "dashboard", label: "Dashboard" },
  { value: "wallet", label: "Wallet" },
  { value: "rewards", label: "Rewards" },
  { value: "terminal", label: "Terminal" },
];
const KINDS: { value: BannerKind; label: string; hint: string; icon: React.ReactNode }[] = [
  { value: "banner", label: "Banner", hint: "A targeted banner in a slot (dashboard, wallet, rewards, terminal)", icon: <Megaphone className="size-3.5" /> },
  { value: "event", label: "Event", hint: "A webinar, meetup or launch with a date and a place or link", icon: <CalendarDays className="size-3.5" /> },
  { value: "post", label: "Post", hint: "A brand announcement with a full page", icon: <Newspaper className="size-3.5" /> },
];
const KIND_LABEL: Record<BannerKind, string> = { banner: "Banner", event: "Event", post: "Post" };
const LAYOUTS: { value: BannerLayout; label: string }[] = [
  { value: "card", label: "Card" },
  { value: "hero", label: "Hero" },
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

export function ClientBanner({ b, image, className }: { b: Pick<BannerView, "title" | "body" | "ctaLabel" | "tone" | "dismissible">; image: string | null; className?: string }) {
  const t = TONE_CLS[b.tone] ?? TONE_CLS.ember;
  return (
    <div className={cn("relative flex min-h-[112px] overflow-hidden rounded-[16px] border", t.box, className)}>
      <span className={cn("w-1 shrink-0", t.accent)} />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3.5 pr-8">
        <div className="line-clamp-2 text-[15px] font-medium leading-snug tracking-tight text-fg">{b.title || "Banner title"}</div>
        {b.body && <div className="line-clamp-2 text-[12.5px] leading-snug text-fg-2">{b.body}</div>}
        {b.ctaLabel && <span className={cn("mt-2 inline-flex h-7 w-fit items-center rounded-full px-3.5 text-[12px] font-medium", t.cta)}>{b.ctaLabel}</span>}
      </div>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="hidden w-[34%] shrink-0 object-cover sm:block" />
      )}
      {b.dismissible && (
        <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-bg/60 text-fg-3" aria-hidden>
          <X className="size-3.5" />
        </span>
      )}
    </div>
  );
}

/** Any item as the client sees it: the hero slide, the Events & updates card or the slot banner. */
function ItemPreview({ b, className }: { b: Pick<BannerView, "kind" | "layout" | "title" | "body" | "ctaLabel" | "tone" | "dismissible" | "eventStartsAt" | "eventEndsAt" | "location" | "imageUrl" | "imageMediaId">; className?: string }) {
  const image = imageSrc(b);
  if (b.layout === "hero") return <HeroPreview b={b} image={image} className={className} />;
  if (b.kind !== "banner") return <UpdateCardPreview b={b} image={image} className={className} />;
  return <ClientBanner b={b} image={image} className={className} />;
}

/* ------------------------------------------------------------------ */

type KindFilter = "all" | BannerKind;

export function LiveBanners() {
  const perms = usePerms();
  const act = useAction();
  const ov = useApi<Overview>(M("overview"));
  const list = useApi<{ items: Banner[] }>(M("banners"));
  const [kind, setKind] = React.useState<KindFilter>("all");
  const [placement, setPlacement] = React.useState<"all" | Placement>("all");
  const [editing, setEditing] = React.useState<Banner | null>(null);
  const [newKind, setNewKind] = React.useState<BannerKind>("banner");
  const [open, setOpen] = React.useState(false);
  const [previewTick, setPreviewTick] = React.useState(0);
  const items = list.data?.items ?? [];
  const ofKind = items.filter((b) => kind === "all" || b.kind === kind);
  const shown = ofKind
    .filter((b) => placement === "all" || b.placement === placement)
    .sort((a, b) => Number(b.layout === "hero") - Number(a.layout === "hero") || a.placement.localeCompare(b.placement) || b.priority - a.priority);
  const k = ov.data?.banners;
  const count = (p: Placement) => ofKind.filter((b) => b.placement === p).length;
  const kindCount = (x: BannerKind) => items.filter((b) => b.kind === x).length;

  const edit = (b: Banner | null, as: BannerKind = "banner") => {
    setEditing(b);
    setNewKind(as);
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
      success: b.active ? "Turned off" : "It's on",
      onDone: reloadAll,
    });
  const remove = (b: Banner) =>
    act.ask({
      title: `Remove "${b.title}"`,
      description: "Clients stop seeing it at once, on the web and in the app. Its stats stay in the audit log.",
      confirmLabel: "Remove",
      confirmVariant: "sell",
      confirmTestId: "banner-remove-confirm",
      note: "none",
      run: () => mkSend(`banners/${b.id}`, {}, "DELETE"),
      success: `${KIND_LABEL[b.kind] ?? "Banner"} removed`,
      onDone: reloadAll,
    });

  return (
    <div className="pb-16">
      <PageHeader
        title="Banners, events & posts"
        subtitle="Hero banners, targeted banners, events and brand posts for the Client Area, the app and the terminal, by country, KYC, account type and sign-up date."
        actions={
          <>
            {perms.loaded && !perms.write && <ReadOnlyNote what="edit banners" />}
            <Button variant="surface" onClick={reloadAll}>
              <RefreshCw /> Refresh
            </Button>
            {perms.write && (
              <>
                <Button variant="surface" onClick={() => edit(null, "event")} data-testid="new-event">
                  <CalendarDays /> New event
                </Button>
                <Button variant="surface" onClick={() => edit(null, "post")} data-testid="new-post">
                  <Newspaper /> New post
                </Button>
                <Button variant="ember" onClick={() => edit(null, "banner")} data-testid="new-banner">
                  <Plus /> New banner
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Live items" icon={<ImageIcon />} value={<span className="k-num">{k ? int(k.active) : "—"}</span>} chip={list.data ? `${kindCount("banner")} banners · ${kindCount("event")} events · ${kindCount("post")} posts` : "Loading"} />
        <KpiCard label="Impressions · 30d" icon={<Users />} value={<span className="k-num">{k ? int(k.impressions30d) : "—"}</span>} chip="One per client per day" delay={0.05} />
        <KpiCard label="Clicks · 30d" icon={<MousePointerClick />} value={<span className="k-num">{k ? int(k.clicks30d) : "—"}</span>} chip="CTA and card clicks" delay={0.1} />
        <KpiCard label="CTR · 30d" icon={<Eye />} value={<span className="k-num">{k ? pct(k.impressions30d ? (k.clicks30d / k.impressions30d) * 100 : 0, 2) : "—"}</span>} chip="Clicks ÷ impressions" chipTone="gold" delay={0.15} />
      </div>

      <Reveal delay={0.05} className="mt-4">
        <Card>
          <CardHeader
            title="Library"
            subtitle="Rendered as clients see them · hero items first, then by placement and priority"
            action={
              <Segmented
                size="sm"
                value={kind}
                onChange={(v) => {
                  setKind(v);
                  setPlacement("all");
                }}
                options={[
                  { value: "all", label: <>All <span className="text-fg-3">{items.length}</span></> },
                  ...KINDS.map((x) => ({ value: x.value, label: <>{x.label}s <span className="text-fg-3">{kindCount(x.value)}</span></> })),
                ]}
              />
            }
          />
          <div className="mt-4 px-4 pb-6 sm:px-6">
            {kind !== "event" && kind !== "post" && items.length > 0 && (
              <Segmented
                size="xs"
                className="mb-4"
                value={placement}
                onChange={setPlacement}
                options={[{ value: "all", label: <>Every placement <span className="text-fg-3">{ofKind.length}</span></> }, ...PLACEMENTS.map((p) => ({ value: p.value, label: <>{p.label} <span className="text-fg-3">{count(p.value)}</span></> }))]}
              />
            )}
            {list.error && !list.data ? (
              <MkError error={list.error} onRetry={list.reload} />
            ) : !list.data ? (
              <TableSkeleton rows={3} />
            ) : shown.length === 0 ? (
              <EmptyNote
                title={items.length ? "Nothing here" : "No banners, events or posts yet"}
                text={items.length ? undefined : "Create a hero banner for the top of the dashboard, a targeted banner, an event or a brand post. Each one can be targeted by country, KYC status, account type and sign-up date."}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {shown.map((b) => (
                  <BannerTile key={b.id} b={b} canWrite={perms.write} onEdit={() => edit(b)} onToggle={() => toggle(b)} onRemove={() => remove(b)} />
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

      <BannerDialog open={open} onOpenChange={setOpen} banner={editing} kind={newKind} onSaved={reloadAll} />
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

function BannerTile({ b, canWrite, onEdit, onToggle, onRemove }: { b: Banner; canWrite: boolean; onEdit: () => void; onToggle: () => void; onRemove: () => void }) {
  const w = windowState(b.active, b.startsAt, b.endsAt);
  const ctr = ctrOf(b);
  const tags = targeting(b);
  return (
    <div className="k-row flex h-full flex-col p-2.5" data-testid={`banner-tile-${b.id}`}>
      <ItemPreview b={b} />
      <div className="flex flex-1 flex-col px-1.5 pb-1 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip size="sm" dot tone={w.tone}>
            {w.label}
          </Chip>
          <Chip size="sm" tone={b.kind === "banner" ? "neutral" : "info"}>
            {KIND_LABEL[b.kind] ?? b.kind}
          </Chip>
          {b.layout === "hero" ? (
            <Chip size="sm" tone="ember">
              <LayoutPanelTop className="size-3" /> Hero
            </Chip>
          ) : (
            b.kind === "banner" && <Chip size="sm">{PLACEMENTS.find((p) => p.value === b.placement)?.label ?? b.placement}</Chip>
          )}
          <span className="font-mono text-[11px] text-fg-3">P{b.priority}</span>
          {canWrite && (
            <span className="ml-auto flex gap-1.5">
              <Button size="xs" variant="surface" onClick={onToggle}>
                {b.active ? "Turn off" : "Turn on"}
              </Button>
              <Button size="xs" variant="surface" onClick={onEdit} aria-label={`Edit ${b.title}`}>
                <Pencil />
              </Button>
              <Button size="xs" variant="surface" onClick={onRemove} aria-label={`Remove ${b.title}`} data-testid={`banner-remove-${b.id}`}>
                <Trash2 />
              </Button>
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-1 truncate text-[11.5px] text-fg-3">
          <CalendarRange className="size-3.5 shrink-0" />
          {b.kind === "event" && b.eventStartsAt ? <span className="truncate">Event {eventRange(b.eventStartsAt, b.eventEndsAt)}</span> : <>Shown {day(b.startsAt)} – {b.endsAt ? day(b.endsAt) : "no end"}</>}
        </div>
        {b.kind === "event" && b.location && (
          <div className="mt-1 flex items-center gap-1 truncate text-[11.5px] text-fg-3">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{b.location}</span>
          </div>
        )}
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
      <CardHeader title="Preview as a client" subtitle="The banner slot of a placement for this segment, in order (the dashboard also shows its hero items)" action={data ? <Chip tone="info">{int(data.audience)} matching clients</Chip> : undefined} />
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
              <ItemPreview b={b} className="flex-1" />
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
      <CardHeader title="CTR by item" subtitle="Clicks ÷ impressions · lifetime" />
      <div className="mt-4 space-y-2 px-4 pb-6 sm:px-6">
        {rows.length === 0 ? (
          <EmptyNote title="No impressions yet" text="Stats appear once clients load a page with a banner slot or the updates." />
        ) : (
          rows.map((b, i) => {
            const c = ctrOf(b);
            const img = imageSrc(b);
            return (
              <div key={b.id} className="k-row flex items-center gap-3 px-3 py-2">
                <span className="k-num w-4 text-[12px] text-fg-3">{i + 1}</span>
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" className="h-9 w-14 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-9 w-14 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-3">
                    <ImageIcon className="size-3.5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{b.title}</div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-ember" style={{ width: `${best ? (c / best) * 100 : 0}%` }} />
                  </div>
                  <div className="k-num mt-1 text-[10.5px] text-fg-3">
                    {int(b.clicks)} clicks · {int(b.impressions)} impressions · {KIND_LABEL[b.kind]?.toLowerCase() ?? b.kind}
                    {b.layout === "hero" ? " · hero" : ""}
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
  kind: BannerKind;
  layout: BannerLayout;
  title: string;
  body: string;
  content: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl: string;
  imageMediaId: string;
  tone: Tone;
  placement: Placement;
  eventStartsAt: string;
  eventEndsAt: string;
  location: string;
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

const EMPTY: Draft = {
  kind: "banner",
  layout: "card",
  title: "",
  body: "",
  content: "",
  ctaLabel: "",
  ctaUrl: "",
  imageUrl: "",
  imageMediaId: "",
  tone: "ember",
  placement: "dashboard",
  eventStartsAt: "",
  eventEndsAt: "",
  location: "",
  countries: "",
  kyc: [],
  accountTypes: [],
  newUsersDays: "",
  priority: "100",
  dismissible: true,
  active: true,
  startsAt: "",
  endsAt: "",
};

const MD_HINT = "## Heading · **bold** · *italic* · - list · 1. steps · [link](https://…) · > note";

function BannerDialog({ open, onOpenChange, banner, kind, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; banner: Banner | null; kind: BannerKind; onSaved: () => void }) {
  const [d, setD] = React.useState<Draft>(EMPTY);
  React.useEffect(() => {
    if (!open) return;
    setD(
      banner
        ? {
            kind: banner.kind ?? "banner",
            layout: banner.layout ?? "card",
            title: banner.title,
            body: banner.body ?? "",
            content: banner.content ?? "",
            ctaLabel: banner.ctaLabel ?? "",
            ctaUrl: banner.ctaUrl ?? "",
            imageUrl: banner.imageUrl ?? "",
            imageMediaId: banner.imageMediaId ?? "",
            tone: banner.tone,
            placement: banner.placement,
            eventStartsAt: toLocalInput(banner.eventStartsAt),
            eventEndsAt: toLocalInput(banner.eventEndsAt),
            location: banner.location ?? "",
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
        : { ...EMPTY, kind, startsAt: toLocalInput(new Date().toISOString()) },
    );
  }, [open, banner, kind]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const countries = splitList(d.countries, true);
  const bad = countries.find((c) => !/^[A-Z]{2}$/.test(c));
  const isBanner = d.kind === "banner";
  const isEvent = d.kind === "event";
  const image = imageSrc({ imageMediaId: d.imageMediaId || null, imageUrl: d.imageUrl.trim() || null });
  const what = KIND_LABEL[d.kind].toLowerCase();
  const loc = d.location.trim();
  const locBad = loc && /:\/\/|^www\./i.test(loc) && !isLink(loc) ? "Online links must start with https://" : null;

  const submit = () => {
    if (!d.title.trim()) return `Give the ${what} a title.`;
    if (bad) return `Countries: "${bad}" isn't an ISO-2 code.`;
    if (d.ctaLabel.trim() && !d.ctaUrl.trim()) return "Add the link the button opens.";
    if (d.layout === "hero" && !image) return `A hero needs an image (${IMAGE_SIZE.hero.label}).`;
    if (d.layout === "hero" && isBanner && d.placement !== "dashboard") return "Hero banners show at the top of the dashboard: pick the Dashboard placement.";
    const evStart = fromLocalInput(d.eventStartsAt);
    const evEnd = fromLocalInput(d.eventEndsAt);
    if (isEvent && !evStart) return "When does the event start?";
    if (isEvent && evStart && evEnd && evEnd < evStart) return "The event must end after it starts.";
    if (isEvent && locBad) return locBad;
    const s = fromLocalInput(d.startsAt);
    const e = fromLocalInput(d.endsAt);
    if (s && e && e <= s) return "Show until must be after Show from.";
    const body: BannerInput = {
      kind: d.kind,
      layout: d.layout,
      title: d.title.trim(),
      body: d.body.trim(),
      content: isBanner ? "" : d.content,
      ctaLabel: d.ctaLabel.trim() || null,
      ctaUrl: d.ctaUrl.trim() || null,
      imageUrl: d.imageMediaId ? null : d.imageUrl.trim() || null,
      imageMediaId: d.imageMediaId || null,
      tone: d.tone,
      placement: isBanner ? d.placement : "dashboard",
      eventStartsAt: isEvent ? evStart : null,
      eventEndsAt: isEvent ? evEnd : null,
      location: isEvent ? loc || null : null,
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

  const preview = {
    kind: d.kind,
    layout: d.layout,
    title: d.title,
    body: d.body,
    ctaLabel: d.ctaLabel || null,
    tone: d.tone,
    dismissible: d.dismissible,
    eventStartsAt: fromLocalInput(d.eventStartsAt),
    eventEndsAt: fromLocalInput(d.eventEndsAt),
    location: loc || null,
  };
  const where = d.layout === "hero" ? "Dashboard · hero carousel" : isBanner ? `${PLACEMENTS.find((p) => p.value === d.placement)?.label} · banner slot` : "Dashboard · Events & updates";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      width={1100}
      title={banner ? `Edit ${what}` : `New ${what}`}
      description="The preview on the right is how targeted clients see it, on the web and in the app."
      submitLabel={banner ? "Save changes" : `Create ${what}`}
      submitTestId="banner-form-submit"
      submit={submit}
      success={banner ? "Saved" : `${KIND_LABEL[d.kind]} created`}
      onDone={onSaved}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-5">
          <FormSection title="Type" hint={KINDS.find((x) => x.value === d.kind)?.hint}>
            <div role="radiogroup" aria-label="Type" className="grid grid-cols-3 gap-2">
              {KINDS.map((x) => (
                <button
                  key={x.value}
                  type="button"
                  role="radio"
                  aria-checked={d.kind === x.value}
                  data-testid={`banner-kind-${x.value}`}
                  onClick={() => set("kind", x.value)}
                  className={cn(
                    "flex h-10 items-center justify-center gap-1.5 rounded-[12px] border text-[13px] font-medium transition-colors",
                    d.kind === x.value ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2 hover:text-fg",
                  )}
                >
                  {x.icon} {x.label}
                </button>
              ))}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
                <span>Layout</span>
                <span className="text-[11.5px] font-normal text-fg-3">{d.layout === "hero" ? `Full width at the top of the dashboard · ${IMAGE_SIZE.hero.label}` : isBanner ? "In the banner slot" : `A card in Events & updates · ${IMAGE_SIZE.card.label}`}</span>
              </div>
              <Segmented size="sm" value={d.layout} onChange={(v) => set("layout", v)} options={LAYOUTS} />
            </div>
          </FormSection>

          <FormSection title="Content">
            <TextF label="Title" value={d.title} onChange={(v) => set("title", v)} maxLength={100} hint={`${d.title.length}/100`} />
            <AreaF label={isBanner ? "Body" : "Summary"} value={d.body} onChange={(v) => set("body", v.slice(0, 400))} rows={2} hint={`${d.body.length}/400 · on the card and the hero`} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextF label="Button label" value={d.ctaLabel} onChange={(v) => set("ctaLabel", v)} placeholder={isBanner ? "Optional" : "Read more"} maxLength={40} />
              <TextF label="Button link" value={d.ctaUrl} onChange={(v) => set("ctaUrl", v)} mono placeholder={isBanner ? "/wallet/deposit" : "Optional · the page by default"} />
              <SelectF label="Tone" value={d.tone} onChange={(v) => set("tone", v)} options={TONES} />
              {isBanner && <SelectF label="Placement" value={d.placement} onChange={(v) => set("placement", v)} options={PLACEMENTS} />}
            </div>
            <ImageField layout={d.layout} image={image} mediaId={d.imageMediaId} url={d.imageUrl} onMedia={(id) => set("imageMediaId", id)} onUrl={(u) => set("imageUrl", u)} />
          </FormSection>

          {isEvent && (
            <FormSection title="Event" hint="Shown in the client's time zone">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DateTimeF label="Starts" value={d.eventStartsAt} onChange={(v) => set("eventStartsAt", v)} />
                <DateTimeF label="Ends" value={d.eventEndsAt} onChange={(v) => set("eventEndsAt", v)} hint="optional" />
              </div>
              <TextF label="Location" value={d.location} onChange={(v) => set("location", v)} placeholder="Dubai, DIFC · or https://meet.example.com/…" hint="A place, or an https:// link for online events" error={locBad} prefix={isLink(loc) ? <Video /> : <MapPin />} />
            </FormSection>
          )}

          {!isBanner && (
            <FormSection title={isEvent ? "Event page" : "Post"} hint={MD_HINT}>
              <AreaF label="Body (Markdown)" value={d.content} onChange={(v) => set("content", v)} rows={8} hint={`${d.content.length.toLocaleString("en-US")}/20,000`} placeholder={"## What's new\n\nWrite the announcement here. Clients see it on the page that opens from the card."} />
              <div>
                <div className="k-label mb-2">Live preview</div>
                <div className="max-h-[320px] overflow-y-auto rounded-[14px] border border-line bg-bg px-4 py-3.5">
                  {d.content.trim() ? <PostBody src={d.content} /> : <div className="text-[12.5px] text-fg-3">The page body appears here as clients will read it.</div>}
                </div>
              </div>
            </FormSection>
          )}

          <FormSection title="Targeting" hint="Empty = everyone">
            <TextF label="Countries" value={d.countries} onChange={(v) => set("countries", v)} mono placeholder="All countries" hint="ISO-2, comma separated" error={bad ? `"${bad}" isn't ISO-2` : null} />
            <PillPicker label="KYC statuses" options={KYC_OPTS} value={d.kyc} onChange={(v) => set("kyc", v)} />
            <PillPicker label="Account types" options={ACC_OPTS} value={d.accountTypes} onChange={(v) => set("accountTypes", v)} />
            <div className="grid grid-cols-2 gap-3">
              <NumF label="New users within" value={d.newUsersDays} onChange={(v) => set("newUsersDays", v)} suffix="days" placeholder="Anyone" step={1} />
              <NumF label="Priority" value={d.priority} onChange={(v) => set("priority", v)} hint="higher first" step={1} />
              <DateTimeF label="Show from" value={d.startsAt} onChange={(v) => set("startsAt", v)} />
              <DateTimeF label="Show until" value={d.endsAt} onChange={(v) => set("endsAt", v)} hint="optional" />
            </div>
            <div className="k-row divide-y divide-line px-4">
              <ToggleRow label="Dismissible" hint={d.layout === "hero" || isBanner ? "Clients can close it; hidden for them afterwards" : "Applies when it's featured in the hero"} checked={d.dismissible} onChange={(v) => set("dismissible", v)} />
              <ToggleRow label="Active" hint="Off: saved but not shown" checked={d.active} onChange={(v) => set("active", v)} />
            </div>
          </FormSection>
        </div>

        <div className="lg:sticky lg:top-0 lg:self-start">
          <div className="k-label mb-2.5">Preview · {where}</div>
          <div className="rounded-[20px] border border-line bg-bg p-4">
            {d.layout === "hero" ? (
              <>
                <HeroPreview b={preview} image={image} />
                <div className="mt-3 flex items-center justify-between">
                  <div className="h-2.5 w-24 rounded-full bg-surface-3" />
                  <div className="h-5 w-14 rounded-full bg-surface-3" />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-12 rounded-xl border border-line bg-surface" />
                  ))}
                </div>
              </>
            ) : isBanner ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div className="h-2.5 w-24 rounded-full bg-surface-3" />
                  <div className="h-5 w-14 rounded-full bg-surface-3" />
                </div>
                <ClientBanner b={{ title: d.title, body: d.body, ctaLabel: d.ctaLabel || null, tone: d.tone, dismissible: d.dismissible }} image={image} />
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-12 rounded-xl border border-line bg-surface" />
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="mb-3 text-[13px] font-semibold tracking-tight">Events &amp; updates</div>
                <div className="grid grid-cols-[1fr_0.42fr] gap-3">
                  <UpdateCardPreview b={preview} image={image} />
                  <div className="space-y-3 opacity-60">
                    <div className="aspect-video rounded-[12px] border border-line bg-surface-2" />
                    <div className="h-2.5 w-4/5 rounded-full bg-surface-3" />
                    <div className="h-2.5 w-3/5 rounded-full bg-surface-3" />
                  </div>
                </div>
              </>
            )}
          </div>
          <p className="mt-3 text-[12px] text-fg-3">
            Shown to {targeting({ countries, kyc: d.kyc, accountTypes: d.accountTypes, newUsersDays: numOrNull(d.newUsersDays) }).join(" · ") || "all clients"}.
          </p>
        </div>
      </div>
    </FormDialog>
  );
}
