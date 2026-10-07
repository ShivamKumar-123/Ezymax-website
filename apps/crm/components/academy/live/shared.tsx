"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, BarChart3, BookOpen, ChartSpline, Check, ChevronLeft, Landmark, Lock, RotateCw, type LucideIcon } from "lucide-react";
import { Button, Card, EmptyState, Skeleton, cn } from "@/components/kit";
import { useAccounts, openTerminal } from "@/components/trading/api";
import { TERMINAL_URL } from "@/lib/live";
import { useT } from "@kalks/i18n/react";
import { isTrack, type AcademyError, type Track, type TrackKey } from "./api";

const TRACK_ICON: Record<Track, LucideIcon> = { fundamental: Landmark, technical: BarChart3, options: ChartSpline };
/** Round badge colours per track (same hues as TRACK_TONE). */
const TRACK_BADGE: Record<Track, string> = {
  fundamental: "border-info/25 bg-info-soft text-info",
  technical: "border-ember/30 bg-ember-soft text-ember",
  options: "border-gold/30 bg-gold-soft text-gold",
};

/** Icon of a track; an unknown track gets a book. */
export function TrackIcon({ track, className }: { track: TrackKey; className?: string }) {
  const Icon = isTrack(track) ? TRACK_ICON[track] : BookOpen;
  return <Icon className={className} />;
}

/** Border / fill / text classes for a track's round badge; neutral for an unknown track. */
export const trackBadge = (track: TrackKey) => (isTrack(track) ? TRACK_BADGE[track] : "border-line bg-surface-2 text-fg-2");

export function AcademyUnavailable({ error, onRetry, notFound: nf }: { error: AcademyError | null; onRetry: () => void; notFound?: boolean }) {
  const t = useT();
  const notFound = nf || error?.status === 404;
  return (
    <Card>
      <EmptyState
        art={notFound ? "market" : "connectionLost"}
        title={notFound ? t("academy.unavailable.notFoundTitle") : t("academy.unavailable.title")}
        text={notFound ? t("academy.unavailable.notFoundText") : (error?.message ?? t("academy.unavailable.text"))}
        action={
          notFound ? (
            <Link href="/academy">
              <Button variant="surface">
                <ChevronLeft className="rtl:-scale-x-100" /> {t("academy.backToAcademy")}
              </Button>
            </Link>
          ) : (
            <Button variant="surface" onClick={onRetry}>
              <RotateCw /> {t("common.retry")}
            </Button>
          )
        }
      />
    </Card>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 pb-16">
      <Skeleton className="h-10 w-64 rounded-[12px]" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Skeleton className="h-[300px] rounded-[20px] xl:col-span-8" />
        <Skeleton className="h-[300px] rounded-[20px] xl:col-span-4" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[280px] rounded-[20px]" />
        ))}
      </div>
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-4 inline-flex items-center gap-1 text-[13px] text-fg-3 transition-colors hover:text-fg">
      <ChevronLeft className="size-4 rtl:-scale-x-100" /> {children}
    </Link>
  );
}

/** Segmented progress bar (one segment per chapter). */
export function Segments({ done, total, className }: { done: number; total: number; className?: string }) {
  return (
    <div className={cn("flex gap-1", className)}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < done ? "bg-ember" : "bg-surface-3")} />
      ))}
    </div>
  );
}

export function StatusDot({ state, n }: { state: "done" | "open" | "locked"; n?: number }) {
  return (
    <span
      className={cn(
        "k-num grid size-7 shrink-0 place-items-center rounded-full border text-[11.5px] font-medium",
        state === "done" ? "border-up/30 bg-up-soft text-up" : state === "locked" ? "border-line bg-surface-2 text-fg-3" : "border-line bg-surface-2 text-fg-2",
      )}
    >
      {state === "done" ? <Check className="size-3.5" /> : state === "locked" ? <Lock className="size-3.5" /> : n}
    </span>
  );
}

/**
 * "Practise in Kalks Trader": opens the learner's demo account in the terminal (one-time SSO), or sends them to
 * open a free demo account first.
 */
export function PracticeButton({ size = "md", label: labelProp }: { size?: "sm" | "md"; label?: string }) {
  const t = useT();
  const label = labelProp ?? t("academy.practice.demo");
  const { data } = useAccounts(0);
  const demo = data?.accounts.find((a) => a.type === "demo" && a.status === "active");
  if (!data) {
    return (
      <a href={TERMINAL_URL} target="_blank" rel="noopener">
        <Button variant="surface" size={size}>
          {label} <ArrowUpRight className="rtl:-scale-x-100" />
        </Button>
      </a>
    );
  }
  if (!demo) {
    return (
      <Link href="/accounts/new?type=demo">
        <Button variant="surface" size={size}>
          {t("academy.practice.openFreeDemo")} <ArrowUpRight className="rtl:-scale-x-100" />
        </Button>
      </Link>
    );
  }
  return (
    <Button variant="surface" size={size} onClick={() => openTerminal(demo.login)}>
      {label} <span className="k-num text-fg-3">#{demo.login}</span> <ArrowUpRight className="rtl:-scale-x-100" />
    </Button>
  );
}

/** Translation key of the risk note shown under Academy pages: render with t(RISK_NOTE). */
export const RISK_NOTE = "academy.riskNote" as const;
