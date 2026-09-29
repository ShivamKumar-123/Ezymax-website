"use client";

import { IS_DEMO } from "@kalks/mock/mode";
import { ComingSoon } from "@kalks/ui";
import { LiveOwnerDashboard } from "@/components/owner/overview";

export default function Page() {
  return IS_DEMO ? <ComingSoon title="Cross-tenant dashboard" text="Shown on live builds for the Platform Owner." /> : <LiveOwnerDashboard />;
}
