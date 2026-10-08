"use client";

// The dashboard's overview layout, after the reference: a wide left column (title, KPI cards, Statistics, checklist),
// a middle column (account cards, account details, activity tabs) and a right column (total balance with the money
// actions, quick actions, notifications), the two narrow columns set off by hairline dividers. Tablets: the left
// column on top, the other two side by side. Phones: one column, the most used blocks first.

import * as React from "react";
import { cn } from "@ezymex/ui";

export function OverviewLayout({
  header,
  ai,
  kpis,
  statistic,
  checklist,
  accounts,
  activity,
  balance,
  quick,
  notifications,
}: {
  header: React.ReactNode;
  /** Ask Ezymex AI: a card under the title (a compact pill on phones). */
  ai?: React.ReactNode;
  kpis: React.ReactNode;
  statistic: React.ReactNode;
  checklist?: React.ReactNode;
  accounts: React.ReactNode;
  activity: React.ReactNode;
  balance: React.ReactNode;
  quick: React.ReactNode;
  notifications: React.ReactNode;
}) {
  // phones: every block is a flex item of the outer column (`max-md:contents` columns) ordered by importance
  const slot = (order: string, node: React.ReactNode) => (node ? <div className={cn("min-w-0", order)}>{node}</div> : null);
  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-x-8 xl:items-stretch xl:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)_minmax(0,0.94fr)] xl:gap-x-0">
      <div className="flex min-w-0 flex-col gap-6 max-md:contents md:col-span-2 xl:col-span-1 xl:pe-8">
        {slot("max-md:order-1", header)}
        {slot("max-md:order-1", ai)}
        {slot("max-md:order-3", kpis)}
        {slot("max-md:order-6", statistic)}
        {slot("max-md:order-9", checklist)}
      </div>
      <div className="flex min-w-0 flex-col gap-6 max-md:contents xl:border-s xl:border-line xl:px-8">
        {slot("max-md:order-4", accounts)}
        {slot("max-md:order-8", activity)}
      </div>
      <div className="flex min-w-0 flex-col gap-8 max-md:contents xl:border-s xl:border-line xl:ps-8">
        {slot("max-md:order-2", balance)}
        {slot("max-md:order-5", quick)}
        {slot("max-md:order-7", notifications)}
      </div>
    </div>
  );
}

/** Section title for the cards below the overview. */
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 mt-10 flex items-center justify-between gap-3">
      <h2 className="k-display text-[20px] font-semibold tracking-[-0.015em] sm:text-[22px]">{children}</h2>
      {action}
    </div>
  );
}
