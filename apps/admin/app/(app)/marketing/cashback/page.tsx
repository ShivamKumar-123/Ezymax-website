"use client";

import { Card, EmptyState, PageHeader } from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveCashback } from "@/components/marketing/live/cashback";

/** Cashback programmes, accruals and payouts from the growth service; the demo showcase has no mock for this page. */
export default function CashbackPage() {
  if (!IS_DEMO) return <LiveCashback />;
  return (
    <div className="pb-16">
      <PageHeader title="Cashback" subtitle="USD per lot on matching symbols and groups, paid to the wallet after the hold." />
      <Card>
        <EmptyState illustration="money_bag" title="Available in live workspaces" text="This page reads the growth service." />
      </Card>
    </div>
  );
}
