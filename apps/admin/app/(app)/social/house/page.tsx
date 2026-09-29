"use client";

import { LiveHousePage } from "@/components/social-live/house";

// House accounts run only on real services (algo + trading engine + gateway); there is no demo variant.
export default function HouseAccountsPage() {
  return <LiveHousePage />;
}
