"use client";

import { Card, EmptyState, PageHeader } from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveSocialAuditPage } from "@/components/social-live/audit";

/** The social audit log is read from the trading engine only; the demo showcase has no mock for it. */
export default function SocialAuditPage() {
  if (!IS_DEMO) return <LiveSocialAuditPage />;
  return (
    <div className="pb-16">
      <PageHeader title="Social audit" subtitle="Every Back Office action on masters, subscriptions, PAMM funds, fee payouts and social settings" />
      <Card>
        <EmptyState illustration="shield" title="Available in live workspaces" text="The social audit log is read from the trading engine." />
      </Card>
    </div>
  );
}
