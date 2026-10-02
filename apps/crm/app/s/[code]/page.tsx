import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowUpRight, ImageOff } from "lucide-react";
import { Logo } from "@kalks/ui/logo";
import { optionStrikeLabel, publicShare, type PublicShare, type ShareOption } from "@/lib/growth";
import type { T } from "@kalks/i18n";
import { intlTag } from "@kalks/i18n/locales";
import { getT } from "@kalks/i18n/server";

// Public share card (D136): /s/<code>. No sign-in (proxy.ts lets /s/** through) and outside the (app) group, so
// no Client Area shell or LiveGate. The card is read server-side with the internal token; the page render counts
// a view, metadata and the image don't. The call to action is the sharer's referral link (/r/CODE, see proxy.ts).

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

/** "28 Sep 2026" (UTC) in the reader's language. */
function day(iso: string | null | undefined, locale: string) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat(intlTag(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

function pct(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

/** "EURUSD 1.165 Call" in the reader's language. */
function contractLabel(o: ShareOption, t: T) {
  return `${o.underlying} ${optionStrikeLabel(o)} ${o.right === "put" ? t("rewards.public.optPut") : t("rewards.public.optCall")}`.replace(/\s+/g, " ").trim();
}

function usd(v: number | null | undefined, locale: string) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `$${v.toLocaleString(intlTag(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The option of an options share card (O36), when it is one. */
const optionOf = (s: PublicShare) => (s.kind === "trade" && s.data.option ? s.data.option : null);

const OPT_REASONS = ["closed", "expired", "knocked_out", "stop_out", "sl", "tp"] as const;
function reasonText(o: ShareOption, t: T) {
  const r = (OPT_REASONS as readonly string[]).includes(o.reason) ? (o.reason as (typeof OPT_REASONS)[number]) : "closed";
  return t(`rewards.public.optReason.${r}`);
}

function headline(s: PublicShare, t: T) {
  const d = s.data;
  const o = optionOf(s);
  if (o) return `${d.name} · ${contractLabel(o, t)} ${pct(o.pnlPct ?? d.movePct)}`;
  if (s.kind === "trade") return `${d.name} · ${d.symbol ?? t("rewards.public.trade")} ${d.side ? d.side.toUpperCase() : ""} ${pct(d.movePct)}`.replace(/\s+/g, " ").trim();
  return t("rewards.public.headlinePeriod", { name: d.name, pct: pct(d.returnPct) });
}

/** One-line summary without the closing call to action. */
function summaryText(s: PublicShare, t: T) {
  const d = s.data;
  const o = optionOf(s);
  if (o)
    return t("rewards.public.summaryOption", {
      side: (o.side ?? "buy").toLowerCase() === "sell" ? t("rewards.public.optSold") : t("rewards.public.optBought"),
      contract: contractLabel(o, t),
      expiry: day(o.expiry, t.locale) || "—",
      entry: usd(o.entryPremium, t.locale),
      exit: usd(o.exitPremium, t.locale),
      pct: pct(o.pnlPct ?? d.movePct),
    });
  if (s.kind === "trade") return t("rewards.public.summaryTrade", { symbol: d.symbol ?? t("rewards.public.trade"), date: day(d.closeTime, t.locale), pct: pct(d.movePct) });
  const parts = [d.trades !== null ? t("rewards.public.trades", { count: d.trades }) : "", d.winRate !== null ? t("rewards.public.winRate", { pct: d.winRate.toFixed(1) }) : ""].filter(Boolean).join(" · ");
  const from = day(d.from, t.locale);
  return `${t("rewards.public.summaryPeriod", { pct: pct(d.returnPct) })}${from ? t("rewards.public.summaryRange", { from, to: day(d.to, t.locale) }) : ""}${parts ? ` · ${parts}` : ""}.`;
}

function summary(s: PublicShare, t: T) {
  return `${summaryText(s, t)} ${t("rewards.public.tradeWithKalks")}`;
}

async function origin() {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const s = await publicShare(code);
  if (!s || s === "unavailable") return { title: "Kalks", robots: { index: false } };
  const t = await getT();
  const base = await origin();
  const image = `${base}/s/${s.code}/image`;
  const title = headline(s, t);
  const description = summary(s, t);
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, url: `${base}/s/${s.code}`, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SharePage({ params }: Props) {
  const { code } = await params;
  const [s, t] = await Promise.all([publicShare(code, true), getT()]);
  const share = s && s !== "unavailable" ? s : null;
  const d = share?.data;
  const o = share ? optionOf(share) : null;
  const cta = d?.referralCode ? `/r/${encodeURIComponent(d.referralCode)}` : "/register";

  return (
    <main className="min-h-dvh bg-bg px-4 py-10 text-fg sm:py-16">
      <div className="mx-auto max-w-[880px]">
        <div className="mb-8 flex items-center justify-between">
          <Logo height={22} />
          <Link href={cta} className="text-[12.5px] text-fg-2 underline-offset-2 hover:text-fg hover:underline">
            {t("rewards.public.openAccount")}
          </Link>
        </div>

        {share && d ? (
          <>
            <div className="k-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between" data-testid="share-page">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ember">{o ? t("rewards.public.sharedOption") : share.kind === "trade" ? t("rewards.public.sharedTrade") : t("rewards.public.sharedResults")}</div>
                <h1 className="mt-1 text-[24px] font-medium leading-tight tracking-tight">
                  {o
                    ? t("rewards.public.closedOption", { name: d.name, contract: contractLabel(o, t) })
                    : share.kind === "trade"
                      ? t("rewards.public.closedSymbol", { name: d.name, symbol: d.symbol ?? t("rewards.public.aTrade") })
                      : t("rewards.public.results", { name: d.name })}
                </h1>
                <p className="mt-1 text-[14px] text-fg-2">{summaryText(share, t)}</p>
              </div>
              <Link href={cta} className="shrink-0" data-testid="share-cta">
                <span className="k-ember-btn inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-medium">
                  {t("rewards.public.openAccount")} <ArrowUpRight className="size-4" />
                </span>
              </Link>
            </div>
            {o && (
              <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" data-testid="share-option">
                {(
                  [
                    [t("rewards.public.optContract"), contractLabel(o, t)],
                    [t("rewards.public.optSide"), (o.side ?? "buy").toLowerCase() === "sell" ? t("rewards.public.optSold") : t("rewards.public.optBought")],
                    [t("rewards.public.optExpiry"), day(o.expiry, t.locale) || "—"],
                    [t("rewards.public.optPremium"), `${usd(o.entryPremium, t.locale)} → ${usd(o.exitPremium, t.locale)}`],
                    [t("rewards.public.optReturn"), pct(o.pnlPct ?? d.movePct)],
                    [t("rewards.public.optClosedBy"), reasonText(o, t)],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="k-row min-w-0 px-3.5 py-2.5">
                    <dt className="truncate text-[10.5px] uppercase tracking-wider text-fg-3">{k}</dt>
                    <dd dir="ltr" className="k-num mt-1 truncate text-start text-[14px] font-medium">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/s/${share.code}/image`} alt={headline(share, t)} width={1200} height={630} className="mt-6 block h-auto w-full rounded-[16px] border border-line" data-testid="share-image" />
          </>
        ) : (
          <div className="k-card p-8 text-center" data-testid="share-page">
            <ImageOff className="mx-auto size-8 text-fg-3" />
            <h1 className="mt-3 text-[20px] font-medium">{s === "unavailable" ? t("rewards.public.unavailableTitle") : t("rewards.public.notFoundTitle")}</h1>
            <p className="mx-auto mt-1 max-w-md text-[13.5px] text-fg-3">{s === "unavailable" ? t("rewards.public.unavailableText") : t("rewards.public.notFoundText")}</p>
            <Link href="/register" className="mt-5 inline-block">
              <span className="k-ember-btn inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium">
                {t("rewards.public.openAccount")} <ArrowUpRight className="size-4" />
              </span>
            </Link>
          </div>
        )}

        <p className="mx-auto mt-8 max-w-2xl text-center text-[11.5px] leading-relaxed text-fg-3">
          {o ? t("rewards.public.disclaimerOptions") : t("rewards.public.disclaimer")}
        </p>
      </div>
    </main>
  );
}
