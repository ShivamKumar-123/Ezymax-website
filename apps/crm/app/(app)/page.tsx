"use client";

import dynamic from "next/dynamic";
import { IS_DEMO } from "@kalks/mock";
import { LiveDashboard } from "@/components/dashboard/live-dashboard";
import { MoversCard } from "@/components/dashboard/movers";

// The demo showcase (sample equity chart, positions, world map, …) is its own chunk: live builds never download it
// (it pulled lightweight-charts and the sample data into every client's first load of the dashboard).
const DemoDashboard = dynamic(() => import("@/components/dashboard/demo-dashboard"));

/** Demo builds: the full showcase on sample data. Live builds: only what is real for this client. */
export default function DashboardPage() {
  return IS_DEMO ? <DemoDashboard /> : <LiveDashboard movers={<MoversCard />} />;
}
