"use client";

import { Card, EmptyState, PageHeader } from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveCommissions } from "@/components/partners-live/commissions";

/** Read from the IB service; the demo showcase has no mock for this page. */
export default function CommissionsPage() {
  if (!IS_DEMO) return <LiveCommissions />;
  return (
    <div className="pb-16">
      <PageHeader title="Commissions" subtitle="Every commission line: per-lot tiers, sub-IB splits, client rebates, CPA and clawbacks" />
      <Card>
        <EmptyState illustration="calendar" title="Available in live workspaces" text="This page reads the IB service." />
      </Card>
    </div>
  );
}
