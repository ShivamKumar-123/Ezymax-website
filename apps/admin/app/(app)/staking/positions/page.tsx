"use client";

import { Card, EmptyState, PageHeader } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveStakingPositions } from "@/components/staking-live/positions";

/** Read from the staking service; the demo showcase has no mock for this page. */
export default function StakingPositionsPage() {
  if (!IS_DEMO) return <LiveStakingPositions />;
  return (
    <div className="pb-16">
      <PageHeader title="Staking positions" subtitle="Every client subscription: principal, term, returns paid and the terms the client accepted. There is no early withdrawal." />
      <Card>
        <EmptyState illustration="bank" title="Available in live workspaces" text="This page reads the staking service." />
      </Card>
    </div>
  );
}
