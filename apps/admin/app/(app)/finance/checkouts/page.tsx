"use client";

import { LiveCheckoutsPage } from "@/components/finance-live/checkouts";

/** Crypto checkouts: deposits clients paid on the payment provider's hosted page (OxaPay). Credited
 *  automatically by the wallet service, so this page records them and can recheck one with the provider. */
export default function CheckoutsPage() {
  return <LiveCheckoutsPage />;
}
