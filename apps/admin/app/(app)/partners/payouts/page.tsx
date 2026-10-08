"use client";

import { Card, EmptyState, PageHeader } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LivePayoutBatches } from "@/components/partners-live/payouts";

/** Read from the IB service; the demo showcase has no mock for this page. */
export default function PayoutsPage() {
  if (!IS_DEMO) return <LivePayoutBatches />;
  return (
    <div className="pb-16">
      <PageHeader title="Payout batches" subtitle="Commission is paid in batches. Approved payouts are credited to each IB's client wallet." />
      <Card>
        <EmptyState illustration="calendar" title="Available in live workspaces" text="This page reads the IB service." />
      </Card>
    </div>
  );
}
