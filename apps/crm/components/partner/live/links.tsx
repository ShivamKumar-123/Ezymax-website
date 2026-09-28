"use client";

import * as React from "react";
import {
  ChevronDown,
  Code2,
  Copy,
  Download,
  Link2,
  MoreHorizontal,
  MousePointerClick,
  Pause,
  Play,
  Plus,
  QrCode,
  UserPlus,
  Wallet,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  CopyButton,
  DataTable,
  Dialog,
  Field,
  IconButton,
  Input,
  KpiCard,
  Menu,
  PageHeader,
  Reveal,
  Segmented,
  Sparkline,
  Toggle,
  cn,
  formatCompact,
  formatMoney,
  type Column,
} from "@kalks/ui";
import {
  PartnerApiError,
  campaignLink,
  errorToast,
  fmtDate,
  fmtLots,
  linkBase,
  partnerApi,
  shortUrl,
  usePartner,
  type Campaign,
  type CampaignsResp,
} from "./api";
import { CardEmpty, PageFallback, SkeletonGrid } from "./ui";
import { QrDialog, useQrCode, type QrTheme } from "./qr";

const keyOf = (c: Campaign) => (c.id === null ? "default" : String(c.id));

function copy(text: string, title: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
  toast.success(title, { description: shortUrl(text) });
}

function Funnel({ c }: { c: Campaign }) {
  const steps = [
    { label: "Clicks", v: c.uniqueClicks, cls: "bg-fg-3" },
    { label: "Sign-ups", v: c.signups, cls: "bg-gold" },
    { label: "FTDs", v: c.ftds, cls: "bg-ember" },
  ];
  const top = Math.max(c.uniqueClicks, c.signups, 1);
  return (
    <div className="w-[170px]">
      <div className="space-y-1">
        {steps.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className={cn("h-full rounded-full", s.cls)}
                style={{
                  width: `${s.v ? Math.max(4, Math.sqrt(s.v / top) * 100) : 0}%`,
                }}
              />
            </div>
            <span className="k-num w-10 text-right text-[11px] text-fg-2">
              {formatCompact(s.v)}
            </span>
          </div>
        ))}
      </div>
      <div className="k-num mt-1 flex gap-2 text-[10.5px] text-fg-3">
        {c.uniqueClicks > 0 && (
          <span>
            Sign-up{" "}
            <span className="text-gold">
              {((c.signups / c.uniqueClicks) * 100).toFixed(1)}%
            </span>
          </span>
        )}
        {c.signups > 0 && (
          <span>
            FTD{" "}
            <span className="text-ember">
              {((c.ftds / c.signups) * 100).toFixed(1)}%
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function slugPreview(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

function CreateLinkDialog({
  open,
  onOpenChange,
  code,
  base,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  code: string;
  base: string;
  onCreated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [src, setSrc] = React.useState("");
  const [medium, setMedium] = React.useState("");
  const [camp, setCamp] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<{
    field?: string;
    message: string;
  } | null>(null);

  React.useEffect(() => {
    if (open) {
      setName("");
      setSlug("");
      setSrc("");
      setMedium("");
      setCamp("");
      setErr(null);
    }
  }, [open]);

  const effSlug = slug.trim() ? slug.trim().toLowerCase() : slugPreview(name);
  const slugOk = !slug.trim() || /^[a-z0-9_-]{1,40}$/i.test(slug.trim());
  const url = effSlug ? campaignLink(base, code, effSlug) : null;
  const fieldErr = (f: string) => (err?.field === f ? err.message : undefined);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await partnerApi<{ id: number; slug: string; name: string }>(
        "campaigns",
        {
          method: "POST",
          body: {
            name: name.trim(),
            slug: slug.trim() || undefined,
            utmSource: src.trim() || undefined,
            utmMedium: medium.trim() || undefined,
            utmCampaign: camp.trim() || undefined,
          },
        },
      );
      const link = campaignLink(base, code, r.slug);
      navigator.clipboard?.writeText(link).catch(() => {});
      toast.success("Link created and copied", { description: shortUrl(link) });
      onCreated();
      onOpenChange(false);
    } catch (e) {
      if (
        e instanceof PartnerApiError &&
        (e.field || e.code === "exists" || e.code === "limit")
      )
        setErr({
          field: e.field ?? (e.code === "exists" ? "slug" : undefined),
          message: e.message,
        });
      else errorToast("Couldn't create the link", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={560}
      title="Create campaign link"
      description="Track clicks, sign-ups and first deposits for each place you share your link."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="ember"
            size="sm"
            disabled={!name.trim() || !effSlug || !slugOk || busy}
            onClick={submit}
          >
            <Plus /> {busy ? "Creating…" : "Create link"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && effSlug && slugOk && !busy) submit();
        }}
      >
        <Field label="Name" error={fieldErr("name")}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. YouTube gold webinar"
            maxLength={60}
            autoFocus
          />
        </Field>
        <Field
          label="Link ending"
          hint="optional"
          error={
            fieldErr("slug") ??
            (slugOk ? undefined : "Use 1–40 letters, digits, - or _.")
          }
        >
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder={slugPreview(name) || "made from the name"}
            maxLength={40}
            inputClassName="font-mono"
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field
            label="utm_source"
            hint="optional"
            error={fieldErr("utmSource")}
          >
            <Input
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              placeholder="youtube"
              maxLength={60}
            />
          </Field>
          <Field
            label="utm_medium"
            hint="optional"
            error={fieldErr("utmMedium")}
          >
            <Input
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
              placeholder="video"
              maxLength={60}
            />
          </Field>
          <Field
            label="utm_campaign"
            hint="optional"
            error={fieldErr("utmCampaign")}
          >
            <Input
              value={camp}
              onChange={(e) => setCamp(e.target.value)}
              placeholder="gold-webinar"
              maxLength={60}
            />
          </Field>
        </div>
        {err && !err.field && (
          <p className="text-xs text-down">{err.message}</p>
        )}
        <div className="rounded-[14px] border border-line bg-surface-2 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">
            Your link
          </div>
          <div className="mt-1 break-all font-mono text-[12.5px] text-fg">
            {url ? shortUrl(url) : "Enter a name"}
          </div>
          <div className="mt-1 text-[11.5px] text-fg-3">
            Opens the sign-up page. UTM tags are saved with the link for your
            reports.
          </div>
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

function QrCard({
  campaigns,
  code,
  base,
  selected,
  onSelect,
}: {
  campaigns: Campaign[];
  code: string;
  base: string;
  selected: string;
  onSelect: (k: string) => void;
}) {
  const [theme, setTheme] = React.useState<QrTheme>("light");
  const [size, setSize] = React.useState<"S" | "M" | "L">("M");
  const [logo, setLogo] = React.useState(true);
  const c = campaigns.find((x) => keyOf(x) === selected) ?? campaigns[0]!;
  const link = campaignLink(base, code, c.slug);
  const px = { S: 140, M: 180, L: 220 }[size];
  const qr = useQrCode({
    value: link,
    size: px,
    theme,
    logo,
    fileBase: `kalks-${code}${c.slug ? `-${c.slug}` : ""}-qr`,
  });
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="QR code"
        subtitle="For flyers, events and screens"
        icon={<QrCode />}
      />
      <div className="flex flex-1 flex-col gap-4 px-4 pb-5 pt-4 sm:px-6">
        <Menu
          align="start"
          width={300}
          trigger={
            <button className="flex h-11 w-full items-center gap-2 rounded-[14px] border border-line bg-surface-2 px-3.5 text-left text-[13px] hover:bg-surface-3/60">
              <Link2 className="size-4 shrink-0 text-fg-3" />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <ChevronDown className="size-4 shrink-0 text-fg-3" />
            </button>
          }
          items={campaigns.map((x) => ({
            label: x.name,
            onSelect: () => onSelect(keyOf(x)),
            hint: keyOf(x) === keyOf(c) ? "Selected" : undefined,
          }))}
        />
        <div className="grid place-items-center rounded-[18px] border border-line bg-surface-2/50 py-6">
          <div className="grid min-h-[248px] place-items-center">{qr.view}</div>
          <div className="mt-3 max-w-full truncate px-4 font-mono text-[11.5px] text-fg-2">
            {shortUrl(link)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Segmented
            size="xs"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            className="w-full justify-between"
          />
          <Segmented
            size="xs"
            value={size}
            onChange={setSize}
            options={["S", "M", "L"] as const}
            className="w-full justify-between"
          />
        </div>
        <div className="flex items-center justify-between text-[13px] text-fg-2">
          Kalks mark in the centre
          <Toggle checked={logo} onChange={setLogo} label="Logo" />
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2">
          <Button variant="surface" size="sm" onClick={qr.downloadSvg}>
            <Download /> SVG
          </Button>
          <Button variant="ember" size="sm" onClick={qr.downloadPng}>
            <Download /> PNG
          </Button>
        </div>
      </div>
    </Card>
  );
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function SnippetCard({
  campaigns,
  code,
  base,
  selected,
  onSelect,
}: {
  campaigns: Campaign[];
  code: string;
  base: string;
  selected: string;
  onSelect: (k: string) => void;
}) {
  const [text, setText] = React.useState("Open a trading account with Kalks");
  const [style, setStyle] = React.useState<"link" | "button">("button");
  const c = campaigns.find((x) => keyOf(x) === selected) ?? campaigns[0]!;
  const link = campaignLink(base, code, c.slug);
  const label = text.trim() || "Open an account";
  const html =
    style === "link"
      ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(label)}</a>`
      : `<a href="${esc(link)}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#ff5a1f;color:#ffffff;font:600 15px/1.2 system-ui,sans-serif;text-decoration:none">${esc(label)}</a>`;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Website snippet"
        subtitle="Paste into your site, blog or newsletter"
        icon={<Code2 />}
      />
      <div className="flex flex-1 flex-col gap-4 px-4 pb-5 pt-4 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Link">
            <Menu
              align="start"
              width={300}
              trigger={
                <button className="flex h-11 w-full items-center gap-2 rounded-[14px] border border-line bg-surface-2 px-3.5 text-left text-[13px] hover:bg-surface-3/60">
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <ChevronDown className="size-4 shrink-0 text-fg-3" />
                </button>
              }
              items={campaigns.map((x) => ({
                label: x.name,
                onSelect: () => onSelect(keyOf(x)),
                hint: keyOf(x) === keyOf(c) ? "Selected" : undefined,
              }))}
            />
          </Field>
          <Field label="Text">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={80}
            />
          </Field>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Segmented
            size="xs"
            value={style}
            onChange={setStyle}
            options={[
              { value: "button", label: "Button" },
              { value: "link", label: "Text link" },
            ]}
          />
          <span className="text-[11.5px] text-fg-3">Preview</span>
        </div>
        <div className="grid min-h-[84px] place-items-center rounded-[16px] border border-line bg-white px-4 py-5">
          {/* static preview of the snippet (not a live link, so previews don't count as clicks) */}
          {style === "button" ? (
            <span className="inline-block max-w-full truncate rounded-full bg-[#ff5a1f] px-[22px] py-3 text-[15px] font-semibold leading-tight text-white">
              {label}
            </span>
          ) : (
            <span className="max-w-full truncate text-[15px] text-[#1a0dab] underline">
              {label}
            </span>
          )}
        </div>
        <div className="relative rounded-[14px] border border-line bg-surface-2">
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all px-4 py-3 pr-12 font-mono text-[11.5px] leading-relaxed text-fg-2">
            {html}
          </pre>
          <CopyButton
            value={html}
            label="HTML snippet"
            className="absolute right-2 top-2 size-8"
          />
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

const TITLE = "Links and materials";
const SUBTITLE =
  "Tracked campaign links, QR codes and a snippet for your website.";

export function LivePartnerLinks() {
  const { data, error, reload, setData } =
    usePartner<CampaignsResp>("campaigns");
  const [create, setCreate] = React.useState(false);
  const [busy, setBusy] = React.useState<Record<string, boolean>>({});
  const [selected, setSelected] = React.useState("default");
  const [qrFor, setQrFor] = React.useState<Campaign | null>(null);
  const [base, setBase] = React.useState("");
  React.useEffect(() => setBase(linkBase()), []);

  if (!data || !base)
    return (
      <PageFallback
        title={TITLE}
        subtitle={SUBTITLE}
        error={error}
        onRetry={reload}
        skeleton={
          <SkeletonGrid
            rows={[
              { cols: "sm:grid-cols-2 xl:grid-cols-4", h: "h-[150px]", n: 4 },
              { cols: "", h: "h-[320px]", n: 1 },
            ]}
          />
        }
      />
    );

  const { code } = data;
  // default link first, then newest campaigns
  const campaigns = [...data.items].sort((a, b) =>
    a.id === null ? -1 : b.id === null ? 1 : 0,
  );
  const clicks = campaigns.reduce((s, c) => s + c.uniqueClicks, 0);
  const rawClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const signups = campaigns.reduce((s, c) => s + c.signups, 0);
  const ftds = campaigns.reduce((s, c) => s + c.ftds, 0);
  const deposits = campaigns.reduce((s, c) => s + c.deposits, 0);
  const own = campaigns.filter((c) => c.id !== null).length;

  const toggleActive = async (c: Campaign) => {
    if (c.id === null) return;
    const k = keyOf(c);
    setBusy((b) => ({ ...b, [k]: true }));
    try {
      await partnerApi(`campaigns/${c.id}`, {
        method: "PATCH",
        body: { active: !c.active },
      });
      setData({
        ...data,
        items: data.items.map((x) =>
          x.id === c.id ? { ...x, active: !c.active } : x,
        ),
      });
      toast.success(c.active ? "Link paused" : "Link resumed", {
        description: c.active
          ? "New clicks on this link are no longer tracked for this campaign. Clients who already signed up stay yours."
          : "Clicks on this link are tracked again.",
      });
    } catch (e) {
      errorToast(
        c.active ? "Couldn't pause the link" : "Couldn't resume the link",
        e,
      );
    } finally {
      setBusy((b) => ({ ...b, [k]: false }));
    }
  };

  const columns: Column<Campaign>[] = [
    {
      key: "name",
      header: "Link",
      cell: (c) => {
        const link = campaignLink(base, code, c.slug);
        return (
          <span className="block min-w-0">
            <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
              {c.name}
              {c.id === null && <Chip size="sm">Default</Chip>}
              {!c.active && (
                <Chip size="sm" tone="warn">
                  Paused
                </Chip>
              )}
            </span>
            <span className="mt-0.5 flex items-center gap-1 font-mono text-[11.5px] text-fg-3">
              <span className="min-w-0 max-w-[260px] truncate">
                {shortUrl(link)}
              </span>
              <CopyButton
                value={link}
                label="Link"
                className="size-5 shrink-0"
              />
            </span>
          </span>
        );
      },
      sort: (c) => c.name,
      csv: (c) => c.name,
      width: "300px",
    },
    {
      key: "utm",
      header: "UTM · created",
      cell: (c) => (
        <span className="block">
          <span className="block max-w-[160px] truncate font-mono text-[11.5px] text-fg-2">
            {[c.utmSource, c.utmMedium, c.utmCampaign]
              .filter(Boolean)
              .join(" / ") || "—"}
          </span>
          <span className="block text-[11px] text-fg-3">
            {c.createdAt ? fmtDate(c.createdAt) : "Always on"}
          </span>
        </span>
      ),
      hideOn: "lg",
    },
    {
      key: "funnel",
      header: "Clicks → sign-ups → FTDs",
      cell: (c) =>
        c.uniqueClicks || c.signups ? (
          <Funnel c={c} />
        ) : (
          <span className="text-[12px] text-fg-3">No clicks yet</span>
        ),
      sort: (c) => c.signups,
      csv: (c) => `${c.uniqueClicks}/${c.signups}/${c.ftds}`,
    },
    {
      key: "dep",
      header: "First deposits",
      align: "right",
      cell: (c) => (
        <span className="k-num">
          {c.deposits ? formatMoney(c.deposits, "USD", 0) : "—"}
        </span>
      ),
      sort: (c) => c.deposits,
      hideOn: "sm",
    },
    {
      key: "lots",
      header: "Lots",
      align: "right",
      cell: (c) => (
        <span className="k-num">{c.lots ? fmtLots(c.lots, 1) : "—"}</span>
      ),
      sort: (c) => c.lots,
      hideOn: "md",
    },
    {
      key: "trend",
      header: "30d clicks",
      align: "right",
      cell: (c) =>
        c.trend.some((v) => v > 0) ? (
          <Sparkline
            data={c.trend}
            width={72}
            height={24}
            className="ml-auto"
          />
        ) : (
          <span className="text-fg-3">—</span>
        ),
      hideOn: "md",
    },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (c) => {
        const link = campaignLink(base, code, c.slug);
        return (
          <Menu
            trigger={
              <IconButton
                size="sm"
                aria-label="Link actions"
                disabled={busy[keyOf(c)]}
              >
                <MoreHorizontal />
              </IconButton>
            }
            items={[
              {
                label: "Copy link",
                icon: <Copy />,
                onSelect: () => copy(link, "Link copied"),
              },
              {
                label: "QR code",
                icon: <QrCode />,
                onSelect: () => setQrFor(c),
              },
              ...(c.id !== null
                ? [
                    "sep" as const,
                    {
                      label: c.active ? "Pause link" : "Resume link",
                      icon: c.active ? <Pause /> : <Play />,
                      onSelect: () => toggleActive(c),
                    },
                  ]
                : []),
            ]}
          />
        );
      },
    },
  ];

  return (
    <div className="pb-24">
      <PageHeader
        title={TITLE}
        subtitle={SUBTITLE}
        actions={
          <Button variant="ember" size="lg" onClick={() => setCreate(true)}>
            <Plus /> Create link
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Clicks"
          icon={<MousePointerClick />}
          value={
            <span className="k-num">{clicks.toLocaleString("en-US")}</span>
          }
          chip={`Unique visitors · ${rawClicks.toLocaleString("en-US")} with repeats`}
        />
        <KpiCard
          label="Sign-ups"
          icon={<UserPlus />}
          value={
            <span className="k-num">{signups.toLocaleString("en-US")}</span>
          }
          chip={
            clicks
              ? `${((signups / clicks) * 100).toFixed(1)}% of clicks`
              : "From your links"
          }
          chipTone="gold"
          delay={0.04}
        />
        <KpiCard
          label="First deposits"
          icon={<Wallet />}
          value={<span className="k-num">{ftds.toLocaleString("en-US")}</span>}
          chip={
            signups
              ? `${((ftds / signups) * 100).toFixed(1)}% of sign-ups`
              : "Clients who funded"
          }
          chipTone="ember"
          delay={0.08}
        />
        <KpiCard
          label="First-deposit volume"
          icon={<Banknote />}
          value={
            <span className="k-num">{formatMoney(deposits, "USD", 0)}</span>
          }
          chip={
            ftds
              ? `${formatMoney(deposits / ftds, "USD", 0)} average`
              : "Sum of first deposits"
          }
          chipTone="up"
          delay={0.12}
        />
      </div>

      <Reveal delay={0.08} className="mt-4 block">
        <Card>
          <CardHeader
            title="Your links"
            subtitle={
              <>
                Every link carries your code{" "}
                <span className="font-mono text-fg-2">{code}</span> plus its own
                tracking
              </>
            }
            icon={<Link2 />}
            action={<Chip>{own} of 100 campaign links</Chip>}
          />
          <div className="px-4 pb-5 pt-4 sm:px-6">
            <DataTable
              columns={columns}
              rows={campaigns}
              rowKey={keyOf}
              pageSize={10}
              search={
                own > 3
                  ? (c) =>
                      `${c.name} ${c.slug} ${c.utmSource ?? ""} ${c.utmCampaign ?? ""}`
                  : undefined
              }
              searchPlaceholder="Search links…"
              exportName={own ? "kalks-campaign-links" : undefined}
            />
            {own === 0 && (
              <CardEmpty
                className="mt-4"
                title="Track where your clients come from"
                text="Create a separate link for each channel, such as YouTube, Telegram or a flyer, and compare clicks, sign-ups and first deposits."
              >
                <Button
                  size="sm"
                  variant="surface"
                  onClick={() => setCreate(true)}
                >
                  <Plus /> Create link
                </Button>
              </CardEmpty>
            )}
          </div>
        </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="min-w-0 xl:col-span-7">
          <SnippetCard
            campaigns={campaigns}
            code={code}
            base={base}
            selected={selected}
            onSelect={setSelected}
          />
        </Reveal>
        <Reveal delay={0.1} className="min-w-0 xl:col-span-5">
          <QrCard
            campaigns={campaigns}
            code={code}
            base={base}
            selected={selected}
            onSelect={setSelected}
          />
        </Reveal>
      </div>

      <CreateLinkDialog
        open={create}
        onOpenChange={setCreate}
        code={code}
        base={base}
        onCreated={reload}
      />
      <QrDialog
        open={!!qrFor}
        onOpenChange={(o) => !o && setQrFor(null)}
        value={qrFor ? campaignLink(base, code, qrFor.slug) : ""}
        title={qrFor ? `QR code · ${qrFor.name}` : "QR code"}
        fileBase={
          qrFor
            ? `kalks-${code}${qrFor.slug ? `-${qrFor.slug}` : ""}-qr`
            : "kalks-qr"
        }
      />
    </div>
  );
}
