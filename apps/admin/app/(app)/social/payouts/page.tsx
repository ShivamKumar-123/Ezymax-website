"use client";

import { Card, EmptyState, PageHeader } from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { LivePayoutsPage } from "@/components/social-live/payouts";

/** Performance-fee payouts run on the trading engine only; the demo showcase has no mock for them. */
export default function PayoutsPage() {
  if (!IS_DEMO) return <LivePayoutsPage />;
  return (
    <div className="pb-16">
      <PageHeader title="Fee payouts" subtitle="Performance fees charged to followers and PAMM investors, approved and paid to master wallets" />
      <Card>
        <EmptyState illustration="calendar" title="Available in live workspaces" text="Fee payouts are read from the trading engine." />
      </Card>
    </div>
  );
}
