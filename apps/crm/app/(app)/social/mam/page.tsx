"use client";

import { Card, EmptyState, PageHeader } from "@/components/kit";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveMamManagerPage } from "@/components/social-live/mam-manager";

/** MAM runs on the trading engine only; the demo showcase has no mock for it. */
export default function MamManagerPage() {
  if (!IS_DEMO) return <LiveMamManagerPage />;
  return (
    <div className="pb-16">
      <PageHeader title="MAM manager" subtitle="Trade one master account for many linked client accounts" />
      <Card>
        <EmptyState illustration="briefcase" title="Available in live workspaces" text="MAM runs on the trading engine." />
      </Card>
    </div>
  );
}
