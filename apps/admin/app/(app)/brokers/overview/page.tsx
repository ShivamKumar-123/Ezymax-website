"use client";

import { IS_DEMO } from "@ezymex/mock/mode";
import { ComingSoon } from "@ezymex/ui";
import { LiveOwnerDashboard } from "@/components/owner/overview";

export default function Page() {
  return IS_DEMO ? <ComingSoon title="Cross-tenant dashboard" text="Shown on live builds for the Platform Owner." /> : <LiveOwnerDashboard />;
}
