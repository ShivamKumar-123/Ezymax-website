"use client";

import { Card, EmptyState, PageHeader } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveFollowersPage } from "@/components/social-live/followers";

/** Copy subscriptions and the copy dashboard run on the trading engine only; the demo showcase has no mock for them. */
export default function FollowersPage() {
  if (!IS_DEMO) return <LiveFollowersPage />;
  return (
    <div className="pb-16">
      <PageHeader title="Followers" subtitle="All copy subscriptions across masters, with copy-trading health: assets copied, skipped copies, fees and follower P&L" />
      <Card>
        <EmptyState illustration="busts_in_silhouette" title="Available in live workspaces" text="Followers and the copy dashboard are read from the trading engine." />
      </Card>
    </div>
  );
}
