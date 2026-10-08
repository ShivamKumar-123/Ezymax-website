"use client";

import { ComingSoon } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveWalletSettingsPage } from "@/components/finance-live/settings";

/** Wallet settings: company addresses, confirmations, limits and fees (live builds; the demo has no mock for it). */
export default function WalletSettingsPage() {
  return IS_DEMO ? <ComingSoon title="Wallet settings" text="Company addresses, confirmations, limits and fees are managed here in live builds." /> : <LiveWalletSettingsPage />;
}
