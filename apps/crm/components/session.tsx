"use client";

import * as React from "react";
import type { GatewayUser } from "@/lib/gateway";

export type SessionUser = GatewayUser;

const SessionContext = React.createContext<SessionUser | null>(null);

export function SessionProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

/** The signed-in client. Only usable inside the (app) layout. */
export function useSession(): SessionUser {
  const u = React.useContext(SessionContext);
  if (!u) throw new Error("useSession must be used inside SessionProvider");
  return u;
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {});
  window.location.assign("/login");
}

export const KYC_CHIP: Record<SessionUser["kyc_status"], { tone: "warn" | "up" | "down"; label: string }> = {
  unverified: { tone: "warn", label: "Verify your identity" },
  pending: { tone: "warn", label: "KYC in review" },
  verified: { tone: "up", label: "Verified" },
  rejected: { tone: "down", label: "KYC rejected" },
};
