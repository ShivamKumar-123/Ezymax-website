"use client";

import { Card, EmptyState, PageHeader } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveStakingPlans } from "@/components/staking-live/plans";

/** Read from the staking service; the demo showcase has no mock for this page. */
export default function StakingPlansPage() {
  if (!IS_DEMO) return <LiveStakingPlans />;
  return (
    <div className="pb-16">
      <PageHeader title="Staking plans" subtitle="What clients can subscribe to: term, limits, capacity, the monthly rate ceiling and the risk disclosure." />
      <Card>
        <EmptyState illustration="package" title="Available in live workspaces" text="This page reads the staking service." />
      </Card>
    </div>
  );
}
