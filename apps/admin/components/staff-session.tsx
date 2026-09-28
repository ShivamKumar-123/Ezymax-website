"use client";

import * as React from "react";
import type { GatewayStaff } from "@/lib/gateway";

export type StaffUser = GatewayStaff;

const StaffContext = React.createContext<StaffUser | null>(null);

export function StaffProvider({ staff, children }: { staff: StaffUser; children: React.ReactNode }) {
  return <StaffContext.Provider value={staff}>{children}</StaffContext.Provider>;
}

/** The signed-in staff member. Only usable inside the (app) layout. */
export function useStaff(): StaffUser {
  const s = React.useContext(StaffContext);
  if (!s) throw new Error("useStaff must be used inside StaffProvider");
  return s;
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {});
  window.location.assign("/login");
}
