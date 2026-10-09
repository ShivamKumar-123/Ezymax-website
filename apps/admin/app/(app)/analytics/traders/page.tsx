"use client";

import { IS_DEMO } from "@ezymex/mock/mode";
import { DemoTraders, LiveTraders } from "@/components/broker-analytics/traders";

/** Analytics → Traders. Live builds: the reports service (/api/reports/traders). Demo builds: the mock book. */
export default function TradersPage() {
  return IS_DEMO ? <DemoTraders /> : <LiveTraders />;
}
