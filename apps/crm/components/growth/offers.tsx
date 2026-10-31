"use client";

// The Offers page: every promotion the broker is running that this client qualifies for, newest first. Each one
// is the artwork the Back Office uploaded, with whatever the broker wrote under it and a button if there is
// somewhere to go. An offer the client has not been shown before is marked "New" and is what the rail badges;
// opening the page records that they have seen it, which is what clears the badge.

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, BadgePercent, CalendarClock, X } from "lucide-react";
import { useT } from "@ezymex/i18n/react";
import { Button, Card, Chip, PageHeader, cn } from "@/components/kit";
import type { OfferView } from "./api";
import { fmtDate } from "./api";
import { PostBody, isExternal, trackPromo, useOffers } from "./promo";
import { CardEmpty } from "./ui";

/** Offers change rarely; this is slow enough to stay out of the way and quick enough that a client who is sent
 *  a link does not sit looking at an empty page. */
const POLL_MS = 120_000;

/** Days left, or null when the offer has no end or ends further out than is worth hurrying anyone about. */
function daysLeft(endsAt: string | null): number | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const days = Math.ceil(ms / 86_400_000);
  return days <= 14 ? days : null;
}

function OfferCard({ o, onDismiss }: { o: OfferView; onDismiss: () => void }) {
  const t = useT();
  const href = o.ctaUrl;
  const left = daysLeft(o.endsAt);
  const terms = o.content.trim();

  const art = o.imageUrl ? (
    // The artwork is the offer. It is shown whole at its own shape, the same rule the dashboard carousel
    // follows, because a promotion poster is drawn to be read in one piece.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={o.imageUrl} alt={o.title} className="block h-auto w-full object-contain" loading="lazy" />
  ) : null;

  return (
    <Card className="relative overflow-hidden">
      {o.dismissible && (
        <button
          type="button"
          aria-label={t("offers.dismiss")}
          onClick={onDismiss}
          className="absolute end-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-black/40 text-white/85 backdrop-blur transition-colors hover:bg-black/60 hover:text-white"
        >
          <X className="size-4" />
        </button>
      )}
      {art}
      <div className="space-y-3 px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="k-display min-w-0 flex-1 text-[17px] font-semibold leading-tight tracking-[-0.01em] sm:text-[19px]">{o.title}</h2>
          {o.isNew && (
            <Chip size="sm" tone="ember">
              {t("offers.new")}
            </Chip>
          )}
          {left !== null && (
            <Chip size="sm" tone="warn">
              <CalendarClock className="size-3" /> {t("offers.endsIn", { count: left })}
            </Chip>
          )}
        </div>
        {o.body.trim() && <p className="text-[13.5px] leading-relaxed text-fg-2">{o.body}</p>}
        {terms && (
          <div className="border-t border-line pt-3 text-[12.5px] text-fg-3">
            <PostBody src={terms} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          {href &&
            (isExternal(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => trackPromo(o.id, "click")}>
                <Button variant="ember" size="sm">
                  {o.ctaLabel || t("offers.claim")} <ArrowUpRight className="rtl:-scale-x-100" />
                </Button>
              </a>
            ) : (
              <Link href={href} onClick={() => trackPromo(o.id, "click")}>
                <Button variant="ember" size="sm">
                  {o.ctaLabel || t("offers.claim")} <ArrowUpRight className="rtl:-scale-x-100" />
                </Button>
              </Link>
            ))}
          {o.endsAt && left === null && <span className="text-[12px] text-fg-3">{t("offers.runsUntil", { date: fmtDate(o.endsAt) })}</span>}
        </div>
      </div>
    </Card>
  );
}

export function LiveOffersPage() {
  const t = useT();
  const { offers, loading } = useOffers(POLL_MS);
  const [hidden, setHidden] = React.useState<Set<OfferView["id"]>>(() => new Set());
  const shown = offers.filter((o) => !hidden.has(o.id));

  // Seeing the page is what marks an offer seen, so the rail stops badging it. One impression per offer per
  // client per day is all the service records, so re-opening the page costs nothing.
  const marked = React.useRef<Set<OfferView["id"]>>(new Set());
  React.useEffect(() => {
    for (const o of shown) {
      if (o.isNew && !marked.current.has(o.id)) {
        marked.current.add(o.id);
        trackPromo(o.id, "impression");
      }
    }
  }, [shown]);

  const dismiss = (o: OfferView) => {
    trackPromo(o.id, "dismiss");
    setHidden((s) => new Set(s).add(o.id));
  };

  return (
    <div className="pb-16">
      <PageHeader title={t("offers.title")} subtitle={t("offers.subtitle")} />
      {loading && !shown.length ? (
        <div className="grid gap-4 lg:grid-cols-2" aria-busy="true">
          {[0, 1].map((k) => (
            <Card key={k} className="overflow-hidden">
              <div className="aspect-[16/9] w-full animate-pulse bg-surface-3" />
              <div className="space-y-2.5 px-6 py-5">
                <div className="h-4 w-1/2 animate-pulse rounded bg-surface-3" />
                <div className="h-3 w-full animate-pulse rounded bg-surface-3" />
              </div>
            </Card>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <Card>
          <CardEmpty title={t("offers.emptyTitle")} text={t("offers.emptyText")}>
            <BadgePercent className="size-8 text-fg-3" />
          </CardEmpty>
        </Card>
      ) : (
        <div className={cn("grid gap-4", shown.length > 1 && "lg:grid-cols-2")}>
          {shown.map((o) => (
            <OfferCard key={o.id} o={o} onDismiss={() => dismiss(o)} />
          ))}
        </div>
      )}
    </div>
  );
}
