"use client";

import { IS_DEMO } from "@ezymex/mock/mode";
import { DemoRisk, LiveRisk } from "@/components/broker-analytics/risk";

/** Analytics → Broker risk. Live builds: the reports service (/api/reports/risk, scenarios, settings/capital), which
 *  reads the open positions from the trading engine. Demo builds: the mock book. */
export default function BrokerRiskPage() {
  return IS_DEMO ? <DemoRisk /> : <LiveRisk />;
}
