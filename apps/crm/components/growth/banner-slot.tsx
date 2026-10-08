"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { Button, cn } from "@/components/kit";
import { IS_DEMO } from "@ezymex/mock/mode";
import { useT } from "@ezymex/i18n/react";
import { growthApi, useGrowth, type BannerView } from "./api";

// Targeted marketing banners (D121) from the growth service. Renders nothing in demo builds, when the service is
// unavailable or when no banner targets this client. Impressions are counted once per mount per banner.

const TONE: Record<string, { bar: string; chip: string }> = {
  ember: { bar: "bg-ember", chip: "text-ember" },
  gold: { bar: "bg-gold", chip: "text-gold" },
  up: { bar: "bg-up", chip: "text-up" },
  neutral: { bar: "bg-fg-3", chip: "text-fg-2" },
};

function track(id: BannerView["id"], kind: "impression" | "click" | "dismiss") {
  growthApi(`banners/${id}/events`, { body: { kind } }).catch(() => {});
}

function isExternal(url: string) {
  return /^https?:\/\//i.test(url);
}

function BannerCard({ b, onDismiss }: { b: BannerView; onDismiss: () => void }) {
  const t = TONE[b.tone] ?? TONE.neutral!;
  const tt = useT();
  const seen = React.useRef(false);
  React.useEffect(() => {
    if (seen.current) return;
    seen.current = true;
    track(b.id, "impression");
  }, [b.id]);

  const cta =
    b.ctaUrl && b.ctaLabel ? (
      isExternal(b.ctaUrl) ? (
        <a href={b.ctaUrl} target="_blank" rel="noopener noreferrer" onClick={() => track(b.id, "click")} data-testid="banner-cta">
          <Button size="sm" variant={b.tone === "ember" ? "ember" : "surface"}>
            {b.ctaLabel} <ArrowUpRight />
          </Button>
        </a>
      ) : (
        <Link href={b.ctaUrl} onClick={() => track(b.id, "click")} data-testid="banner-cta">
          <Button size="sm" variant={b.tone === "ember" ? "ember" : "surface"}>
            {b.ctaLabel} <ArrowUpRight />
          </Button>
        </Link>
      )
    ) : null;

  return (
    <div className="k-card relative flex overflow-hidden" data-testid="banner-card" data-banner-id={b.id}>
      <span aria-hidden className={cn("w-1 shrink-0", t.bar)} />
      <div className="flex min-w-0 flex-1 flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-6">
        {b.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.imageUrl} alt="" className="hidden h-14 w-24 shrink-0 rounded-[10px] border border-line object-cover sm:block" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium tracking-tight text-fg">{b.title}</div>
          {b.body && <p className="mt-0.5 text-[13px] leading-snug text-fg-2">{b.body}</p>}
        </div>
        {cta && <div className="shrink-0">{cta}</div>}
      </div>
      {b.dismissible && (
        <button
          type="button"
          aria-label={tt("rewards.banner.dismiss")}
          data-testid="banner-dismiss"
          onClick={() => {
            track(b.id, "dismiss");
            onDismiss();
          }}
          className="absolute end-2.5 top-2.5 grid size-7 place-items-center rounded-full text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function LiveBannerSlot({ placement, max, className }: { placement: string; max: number; className?: string }) {
  const { data } = useGrowth<{ items: BannerView[] }>(`banners?placement=${encodeURIComponent(placement)}`);
  const [hidden, setHidden] = React.useState<Set<BannerView["id"]>>(() => new Set());
  const items = (data?.items ?? []).filter((b) => !hidden.has(b.id)).slice(0, max);
  if (items.length === 0) return null;
  return (
    <div className={cn("space-y-3", className)} data-testid="banner-slot" data-placement={placement}>
      {items.map((b) => (
        <BannerCard key={b.id} b={b} onDismiss={() => setHidden((s) => new Set(s).add(b.id))} />
      ))}
    </div>
  );
}

export function BannerSlot({ placement, max = 1, className = "mb-4" }: { placement: "dashboard" | "wallet" | "rewards" | "terminal"; max?: number; className?: string }) {
  if (IS_DEMO) return null;
  return <LiveBannerSlot placement={placement} max={max} className={className} />;
}
