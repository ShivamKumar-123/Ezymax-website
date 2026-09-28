"use client";

import * as React from "react";
import { IS_DEMO, ME } from "@kalks/mock";
import type { GatewayUser } from "@/lib/gateway";

export type SessionUser = GatewayUser;

/** The sample client that demo builds browse as (built from the mock ME), no sign-in needed. */
export const DEMO_USER: SessionUser = {
  id: 80412,
  email: ME.email,
  first_name: ME.firstName,
  last_name: ME.name.split(" ").slice(1).join(" "),
  name: ME.name,
  phone_dial: ME.phone.split(" ")[0]!,
  phone: ME.phone.split(" ").slice(1).join(" "),
  country: ME.country,
  date_of_birth: ME.dob,
  kyc_status: ME.kycStatus,
  email_verified: true,
  referral_code: ME.referralCode,
  created_at: `${ME.memberSince}T09:00:00Z`,
  tenant: { slug: "kalks", name: "Kalks" },
};

const SessionContext = React.createContext<SessionUser | null>(null);

/** `user` is the gateway client; demo builds pass nothing and get DEMO_USER. */
export function SessionProvider({ user, children }: { user?: SessionUser; children: React.ReactNode }) {
  return <SessionContext.Provider value={user ?? (IS_DEMO ? DEMO_USER : null)}>{children}</SessionContext.Provider>;
}

/** The signed-in client. Only usable inside the (app) layout. */
export function useSession(): SessionUser {
  const u = React.useContext(SessionContext);
  if (!u) throw new Error("useSession must be used inside SessionProvider");
  return u;
}

export async function logout() {
  if (!IS_DEMO) await fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {});
  window.location.assign("/login");
}

export const KYC_CHIP: Record<SessionUser["kyc_status"], { tone: "warn" | "up" | "down"; label: string }> = {
  unverified: { tone: "warn", label: "Verify your identity" },
  pending: { tone: "warn", label: "KYC in review" },
  verified: { tone: "up", label: "Verified" },
  rejected: { tone: "down", label: "KYC rejected" },
};
