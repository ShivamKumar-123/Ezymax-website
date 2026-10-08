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
} from "@/components/kit";
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
import { Trans, useFormat, useT } from "@ezymex/i18n/react";
import { CardEmpty, PageFallback, SkeletonGrid } from "./ui";
import { QrDialog, useQrCode, type QrTheme } from "./qr";

const keyOf = (c: Campaign) => (c.id === null ? "default" : String(c.id));

function copy(text: string, title: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
  toast.success(title, { description: shortUrl(text) });
}

function Funnel({ c }: { c: Campaign }) {
  const t = useT();
  const steps = [
    { label: "clicks", v: c.uniqueClicks, cls: "bg-fg-3" },
    { label: "signups", v: c.signups, cls: "bg-gold" },
    { label: "ftds", v: c.ftds, cls: "bg-ember" },
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
            <span className="k-num w-10 text-end text-[11px] text-fg-2">
              {formatCompact(s.v)}
            </span>
          </div>
        ))}
      </div>
      <div className="k-num mt-1 flex gap-2 text-[10.5px] text-fg-3">
        {c.uniqueClicks > 0 && (
          <span>
            {t("partner.links.signupRate")}{" "}
            <span className="text-gold">
              {((c.signups / c.uniqueClicks) * 100).toFixed(1)}%
            </span>
          </span>
        )}
        {c.signups > 0 && (
          <span>
            {t("partner.links.ftdRate")}{" "}
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
  const t = useT();
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
      toast.success(t("partner.links.createdToast"), {
        description: shortUrl(link),
      });
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
      else errorToast(t("partner.links.createFailed"), e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={560}
      title={t("partner.links.createTitle")}
      description={t("partner.links.createDescription")}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="ember"
            size="sm"
            disabled={!name.trim() || !effSlug || !slugOk || busy}
            onClick={submit}
          >
            <Plus />{" "}
            {busy ? t("partner.links.creating") : t("partner.links.create")}
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
        <Field label={t("common.name")} error={fieldErr("name")}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("partner.links.namePlaceholder")}
            maxLength={60}
            autoFocus
          />
        </Field>
        <Field
          label={t("partner.links.slugLabel")}
          hint={t("partner.optional")}
          error={
            fieldErr("slug") ??
            (slugOk ? undefined : t("partner.links.slugInvalid"))
          }
        >
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder={slugPreview(name) || t("partner.links.slugPlaceholder")}
            maxLength={40}
            inputClassName="font-mono"
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field
            label="utm_source"
            hint={t("partner.optional")}
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
            hint={t("partner.optional")}
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
            hint={t("partner.optional")}
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
          <div className="text-[12px] text-fg-3">
            {t("partner.links.yourLink")}
          </div>
          <div
            dir={url ? "ltr" : undefined}
            className="mt-1 break-all text-start font-mono text-[12.5px] text-fg"
          >
            {url ? shortUrl(url) : t("partner.links.enterName")}
          </div>
          <div className="mt-1 text-[11.5px] text-fg-3">
            {t("partner.links.yourLinkHint")}
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
  const t = useT();
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
    fileBase: `ezymex-${code}${c.slug ? `-${c.slug}` : ""}-qr`,
  });
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={t("partner.links.qrCode")}
        subtitle={t("partner.links.qrSubtitle")}
        icon={<QrCode />}
      />
      <div className="flex flex-1 flex-col gap-4 px-4 pb-5 pt-4 sm:px-6">
        <Menu
          align="start"
          width={300}
          trigger={
            <button className="flex h-11 w-full items-center gap-2 rounded-[14px] border border-line bg-surface-2 px-3.5 text-start text-[13px] hover:bg-surface-3/60">
              <Link2 className="size-4 shrink-0 text-fg-3" />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <ChevronDown className="size-4 shrink-0 text-fg-3" />
            </button>
          }
          items={campaigns.map((x) => ({
            label: x.name,
            onSelect: () => onSelect(keyOf(x)),
            hint: keyOf(x) === keyOf(c) ? t("partner.links.selected") : undefined,
          }))}
        />
        <div className="grid place-items-center rounded-[18px] border border-line bg-surface-2/50 py-6">
          <div className="grid min-h-[248px] place-items-center">{qr.view}</div>
          <div
            dir="ltr"
            className="mt-3 max-w-full truncate px-4 font-mono text-[11.5px] text-fg-2"
          >
            {shortUrl(link)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Segmented
            size="xs"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "light", label: t("partner.links.light") },
              { value: "dark", label: t("partner.links.dark") },
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
          {t("partner.links.markInCentre")}
          <Toggle
            checked={logo}
            onChange={setLogo}
            label={t("partner.links.logo")}
          />
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
  const t = useT();
  const [text, setText] = React.useState(() =>
    t("partner.links.snippetDefault"),
  );
  const [style, setStyle] = React.useState<"link" | "button">("button");
  const c = campaigns.find((x) => keyOf(x) === selected) ?? campaigns[0]!;
  const link = campaignLink(base, code, c.slug);
  const label = text.trim() || t("partner.links.snippetFallback");
  const html =
    style === "link"
      ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(label)}</a>`
      : `<a href="${esc(link)}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#ff5a1f;color:#ffffff;font:600 15px/1.2 system-ui,sans-serif;text-decoration:none">${esc(label)}</a>`;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={t("partner.links.snippetTitle")}
        subtitle={t("partner.links.snippetSubtitle")}
        icon={<Code2 />}
      />
      <div className="flex flex-1 flex-col gap-4 px-4 pb-5 pt-4 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("partner.links.link")}>
            <Menu
              align="start"
              width={300}
              trigger={
                <button className="flex h-11 w-full items-center gap-2 rounded-[14px] border border-line bg-surface-2 px-3.5 text-start text-[13px] hover:bg-surface-3/60">
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <ChevronDown className="size-4 shrink-0 text-fg-3" />
                </button>
              }
              items={campaigns.map((x) => ({
                label: x.name,
                onSelect: () => onSelect(keyOf(x)),
                hint: keyOf(x) === keyOf(c) ? t("partner.links.selected") : undefined,
              }))}
            />
          </Field>
          <Field label={t("partner.links.text")}>
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
              { value: "button", label: t("partner.links.button") },
              { value: "link", label: t("partner.links.textLink") },
            ]}
          />
          <span className="text-[11.5px] text-fg-3">
            {t("partner.links.preview")}
          </span>
        </div>
        <div className="grid min-h-[84px] place-items-center rounded-[16px] border border-line bg-white px-4 py-5">
          {/* static preview of the snippet (not a live link, so previews don't count as clicks) */}
          {style === "button" ? (
            <span className="inline-block max-w-full truncate rounded-full bg-[var(--k-ember)] px-[22px] py-3 text-[15px] font-semibold leading-tight text-white">
              {label}
            </span>
          ) : (
            <span className="max-w-full truncate text-[15px] text-[#1a0dab] underline">
              {label}
            </span>
          )}
        </div>
        <div className="relative rounded-[14px] border border-line bg-surface-2">
          <pre
            dir="ltr"
            className="max-h-40 overflow-auto whitespace-pre-wrap break-all px-4 py-3 pe-12 text-start font-mono text-[11.5px] leading-relaxed text-fg-2"
          >
            {html}
          </pre>
          <CopyButton
            value={html}
            label={t("partner.links.htmlSnippet")}
            className="absolute end-2 top-2 size-8"
          />
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function LivePartnerLinks() {
  const t = useT();
  const f = useFormat();
  const TITLE = t("partner.links.title");
  const SUBTITLE = t("partner.links.subtitle");
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
      toast.success(
        c.active ? t("partner.links.pausedToast") : t("partner.links.resumedToast"),
        {
          description: c.active
            ? t("partner.links.pausedToastText")
            : t("partner.links.resumedToastText"),
        },
      );
    } catch (e) {
      errorToast(
        c.active
          ? t("partner.links.pauseFailed")
          : t("partner.links.resumeFailed"),
        e,
      );
    } finally {
      setBusy((b) => ({ ...b, [k]: false }));
    }
  };

  const columns: Column<Campaign>[] = [
    {
      key: "name",
      header: t("partner.links.link"),
      cell: (c) => {
        const link = campaignLink(base, code, c.slug);
        return (
          <span className="block min-w-0">
            <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
              {c.name}
              {c.id === null && (
                <Chip size="sm">{t("partner.links.default")}</Chip>
              )}
              {!c.active && (
                <Chip size="sm" tone="warn">
                  {t("partner.links.paused")}
                </Chip>
              )}
            </span>
            <span className="mt-0.5 flex items-center gap-1 font-mono text-[11.5px] text-fg-3">
              <span dir="ltr" className="min-w-0 max-w-[260px] truncate">
                {shortUrl(link)}
              </span>
              <CopyButton
                value={link}
                label={t("partner.links.link")}
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
      header: t("partner.links.colUtm"),
      cell: (c) => (
        <span className="block">
          <span className="block max-w-[160px] truncate font-mono text-[11.5px] text-fg-2">
            {[c.utmSource, c.utmMedium, c.utmCampaign]
              .filter(Boolean)
              .join(" / ") || "—"}
          </span>
          <span className="block text-[11px] text-fg-3">
            {c.createdAt ? fmtDate(c.createdAt) : t("partner.links.alwaysOn")}
          </span>
        </span>
      ),
      hideOn: "lg",
    },
    {
      key: "funnel",
      header: t("partner.links.colFunnel"),
      cell: (c) =>
        c.uniqueClicks || c.signups ? (
          <Funnel c={c} />
        ) : (
          <span className="text-[12px] text-fg-3">
            {t("partner.links.noClicks")}
          </span>
        ),
      sort: (c) => c.signups,
      csv: (c) => `${c.uniqueClicks}/${c.signups}/${c.ftds}`,
    },
    {
      key: "dep",
      header: t("partner.firstDeposits"),
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
      header: t("partner.lots"),
      align: "right",
      cell: (c) => (
        <span className="k-num">{c.lots ? fmtLots(c.lots, 1) : "—"}</span>
      ),
      sort: (c) => c.lots,
      hideOn: "md",
    },
    {
      key: "trend",
      header: t("partner.links.col30d"),
      align: "right",
      cell: (c) =>
        c.trend.some((v) => v > 0) ? (
          <Sparkline
            data={c.trend}
            width={72}
            height={24}
            className="ms-auto"
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
                aria-label={t("partner.links.actions")}
                disabled={busy[keyOf(c)]}
              >
                <MoreHorizontal />
              </IconButton>
            }
            items={[
              {
                label: t("partner.links.copyLink"),
                icon: <Copy />,
                onSelect: () => copy(link, t("partner.links.copied")),
              },
              {
                label: t("partner.links.qrCode"),
                icon: <QrCode />,
                onSelect: () => setQrFor(c),
              },
              ...(c.id !== null
                ? [
                    "sep" as const,
                    {
                      label: c.active
                        ? t("partner.links.pause")
                        : t("partner.links.resume"),
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
            <Plus /> {t("partner.links.create")}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("partner.clicks")}
          icon={<MousePointerClick />}
          value={<span className="k-num">{f.number(clicks, 0)}</span>}
          chip={t("partner.links.uniqueVisitors", {
            n: f.number(rawClicks, 0),
          })}
        />
        <KpiCard
          label={t("partner.signups")}
          icon={<UserPlus />}
          value={<span className="k-num">{f.number(signups, 0)}</span>}
          chip={
            clicks
              ? t("partner.links.pctOfClicks", {
                  pct: ((signups / clicks) * 100).toFixed(1),
                })
              : t("partner.links.fromLinks")
          }
          chipTone="gold"
          delay={0.04}
        />
        <KpiCard
          label={t("partner.firstDeposits")}
          icon={<Wallet />}
          value={<span className="k-num">{f.number(ftds, 0)}</span>}
          chip={
            signups
              ? t("partner.links.pctOfSignups", {
                  pct: ((ftds / signups) * 100).toFixed(1),
                })
              : t("partner.links.clientsFunded")
          }
          chipTone="ember"
          delay={0.08}
        />
        <KpiCard
          label={t("partner.links.ftdVolume")}
          icon={<Banknote />}
          value={
            <span className="k-num">{formatMoney(deposits, "USD", 0)}</span>
          }
          chip={
            ftds
              ? t("partner.links.average", {
                  amount: formatMoney(deposits / ftds, "USD", 0),
                })
              : t("partner.links.sumFtd")
          }
          chipTone="up"
          delay={0.12}
        />
      </div>

      <Reveal delay={0.08} className="mt-4 block">
        <Card>
          <CardHeader
            title={t("partner.links.yourLinks")}
            subtitle={
              <Trans
                k="partner.links.yourLinksSubtitle"
                vars={{ code }}
                tags={{
                  code: (ch) => (
                    <span className="font-mono text-fg-2">{ch}</span>
                  ),
                }}
              />
            }
            icon={<Link2 />}
            action={
              <Chip>{t("partner.links.ofLimit", { n: own, max: 100 })}</Chip>
            }
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
              searchPlaceholder={t("partner.links.search")}
              exportName={own ? "ezymex-campaign-links" : undefined}
            />
            {own === 0 && (
              <CardEmpty
                className="mt-4"
                title={t("partner.links.emptyTitle")}
                text={t("partner.links.emptyText")}
              >
                <Button
                  size="sm"
                  variant="surface"
                  onClick={() => setCreate(true)}
                >
                  <Plus /> {t("partner.links.create")}
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
        title={
          qrFor
            ? `${t("partner.links.qrCode")} · ${qrFor.name}`
            : t("partner.links.qrCode")
        }
        fileBase={
          qrFor
            ? `ezymex-${code}${qrFor.slug ? `-${qrFor.slug}` : ""}-qr`
            : "ezymex-qr"
        }
      />
    </div>
  );
}
