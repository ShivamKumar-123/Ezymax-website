"use client";

import { Card, EmptyState, PageHeader } from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveReports } from "@/components/marketing/live/reports";

/** Cost of promotions from the growth service; the demo showcase has no mock for this page. */
export default function MarketingReportsPage() {
  if (!IS_DEMO) return <LiveReports />;
  return (
    <div className="pb-16">
      <PageHeader title="Promotion costs" subtitle="Bonus released, cashback, contest prizes and redeemed points over a period." />
      <Card>
        <EmptyState illustration="calendar" title="Available in live workspaces" text="This page reads the growth service." />
      </Card>
    </div>
  );
}
