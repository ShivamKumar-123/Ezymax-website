"use client";

import { Card, EmptyState, PageHeader } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveStakingRates } from "@/components/staking-live/rates";

/** Read from the staking service; the demo showcase has no mock for this page. */
export default function StakingRatesPage() {
  if (!IS_DEMO) return <LiveStakingRates />;
  return (
    <div className="pb-16">
      <PageHeader title="Monthly rates" subtitle="Each plan's return for a month, set once the month has started and never promised in advance." />
      <Card>
        <EmptyState illustration="calendar" title="Available in live workspaces" text="This page reads the staking service." />
      </Card>
    </div>
  );
}
