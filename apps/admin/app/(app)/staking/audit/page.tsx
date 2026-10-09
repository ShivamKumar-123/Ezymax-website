"use client";

import { Card, EmptyState, PageHeader } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveStakingAudit } from "@/components/staking-live/audit";

/** Read from the staking service; the demo showcase has no mock for this page. */
export default function StakingAuditPage() {
  if (!IS_DEMO) return <LiveStakingAudit />;
  return (
    <div className="pb-16">
      <PageHeader title="Staking audit" subtitle="Append-only log of plans, rates, settlements, exports and the money flows, with who did it and why." />
      <Card>
        <EmptyState illustration="shield" title="Available in live workspaces" text="This page reads the staking service." />
      </Card>
    </div>
  );
}
