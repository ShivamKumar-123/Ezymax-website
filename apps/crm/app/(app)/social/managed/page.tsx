"use client";

import { Card, EmptyState, PageHeader } from "@/components/kit";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveManagedPage } from "@/components/social-live/mam";

/** MAM runs on the trading engine only; the demo showcase has no mock for it. */
export default function ManagedAccountsPage() {
  if (!IS_DEMO) return <LiveManagedPage />;
  return (
    <div className="pb-16">
      <PageHeader title="Managed accounts" subtitle="Give an approved MAM manager trading authority over one of your live accounts" />
      <Card>
        <EmptyState illustration="briefcase" title="Available in live workspaces" text="Managed accounts run on the trading engine." />
      </Card>
    </div>
  );
}
