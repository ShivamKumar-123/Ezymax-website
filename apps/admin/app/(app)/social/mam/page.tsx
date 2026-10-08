"use client";

import { Card, EmptyState, PageHeader } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveMamPage } from "@/components/social-live/mam";

/** MAM runs on the trading engine only; the demo showcase has no mock for it. */
export default function MamPage() {
  if (!IS_DEMO) return <LiveMamPage />;
  return (
    <div className="pb-16">
      <PageHeader title="MAM" subtitle="Multi-account managers, linked client accounts and the allocation audit" />
      <Card>
        <EmptyState illustration="briefcase" title="Available in live workspaces" text="MAM runs on the trading engine." />
      </Card>
    </div>
  );
}
