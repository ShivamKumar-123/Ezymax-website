"use client";

import { Card, EmptyState, PageHeader } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveStakingSettlements } from "@/components/staking-live/settlements";

/** Read from the staking service; the demo showcase has no mock for this page. */
export default function StakingSettlementsPage() {
  if (!IS_DEMO) return <LiveStakingSettlements />;
  return (
    <div className="pb-16">
      <PageHeader title="Monthly settlements" subtitle="One settlement per closed month pays every position's return. A second staff member approves it before anything is credited." />
      <Card>
        <EmptyState illustration="money_bag" title="Available in live workspaces" text="This page reads the staking service." />
      </Card>
    </div>
  );
}
