"use client";

import { Card, EmptyState, PageHeader } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveStakingOverview } from "@/components/staking-live/overview";

/** Read from the staking service; the demo showcase has no mock for this page. */
export default function StakingOverviewPage() {
  if (!IS_DEMO) return <LiveStakingOverview />;
  return (
    <div className="pb-16">
      <PageHeader title="Staking" subtitle="Client positions, monthly returns and settlements. Rates are set month by month and never promised in advance." />
      <Card>
        <EmptyState illustration="coin" title="Available in live workspaces" text="This page reads the staking service." />
      </Card>
    </div>
  );
}
