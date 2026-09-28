"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronLeft, Lock, RotateCw } from "lucide-react";
import { Button, Card, EmptyState, Skeleton, cn } from "@kalks/ui";
import { useAccounts, openTerminal } from "@/components/trading/api";
import { TERMINAL_URL } from "@/lib/live";
import type { AcademyError } from "./api";

export function AcademyUnavailable({ error, onRetry, notFound: nf }: { error: AcademyError | null; onRetry: () => void; notFound?: boolean }) {
  const notFound = nf || error?.status === 404;
  return (
    <Card>
      <EmptyState
        illustration={notFound ? "magnifying_glass_tilted_left" : "satellite_antenna"}
        title={notFound ? "Not found" : "The Academy is unavailable"}
        text={notFound ? "This lesson isn't available. It may have been moved or unpublished." : (error?.message ?? "We couldn't load the Academy. Please try again in a moment.")}
        action={
          notFound ? (
            <Link href="/academy">
              <Button variant="surface">
                <ChevronLeft /> Back to the Academy
              </Button>
            </Link>
          ) : (
            <Button variant="surface" onClick={onRetry}>
              <RotateCw /> Try again
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
      <ChevronLeft className="size-4" /> {children}
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
export function PracticeButton({ size = "md", label = "Practise on demo" }: { size?: "sm" | "md"; label?: string }) {
  const { data } = useAccounts(0);
  const demo = data?.accounts.find((a) => a.type === "demo" && a.status === "active");
  if (!data) {
    return (
      <a href={TERMINAL_URL} target="_blank" rel="noopener">
        <Button variant="surface" size={size}>
          {label} <ArrowUpRight />
        </Button>
      </a>
    );
  }
  if (!demo) {
    return (
      <Link href="/accounts/new?type=demo">
        <Button variant="surface" size={size}>
          Open a free demo account <ArrowUpRight />
        </Button>
      </Link>
    );
  }
  return (
    <Button variant="surface" size={size} onClick={() => openTerminal(demo.login)}>
      {label} <span className="k-num text-fg-3">#{demo.login}</span> <ArrowUpRight />
    </Button>
  );
}

export const RISK_NOTE =
  "Educational content only, not investment advice. CFDs are complex, leveraged instruments and carry a high risk of losing money rapidly. Practise on a demo account before trading live.";
