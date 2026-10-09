"use client";

import { LiveManualDepositsPage } from "@/components/finance-live/manual-deposits";

/** Manual deposits: bank / UPI / crypto payments clients made outside the platform, waiting for approval.
 *  Live builds read the wallet service; demo builds run the same page on mock data (components/finance-live/manual-data.ts). */
export default function ManualDepositsPage() {
  return <LiveManualDepositsPage />;
}
