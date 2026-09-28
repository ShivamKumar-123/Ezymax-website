"use client";

import * as React from "react";
import { LiveDeploymentsPage } from "@/components/algo/deployments-page";

export default function DeploymentsPage() {
  return (
    <React.Suspense fallback={null}>
      <LiveDeploymentsPage />
    </React.Suspense>
  );
}
