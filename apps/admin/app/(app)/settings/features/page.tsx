"use client";

import { IS_DEMO } from "@ezymex/mock/mode";
import { ComingSoon } from "@ezymex/ui";
import { LiveFeatures } from "@/components/rbac/settings";

export default function Page() {
  return IS_DEMO ? <ComingSoon title="Features & modules" text="Per-tenant modules and feature flags are shown on live builds." /> : <LiveFeatures />;
}
