"use client";

import * as React from "react";
import { IS_DEMO } from "@kalks/mock/mode";
import type { GatewayStaff } from "@/lib/gateway";
import { isTradingPerm, tradingAllows } from "@/lib/trading-perms";

export type StaffUser = GatewayStaff;

const StaffContext = React.createContext<StaffUser | null>(null);

export function StaffProvider({ staff, children }: { staff: StaffUser; children: React.ReactNode }) {
  return <StaffContext.Provider value={staff}>{children}</StaffContext.Provider>;
}

/** Whether the signed-in staff member's role holds a Back Office permission (demo builds: everything).
 *  Trading permissions (dealing.*, accounts.*, finance.adjust, groups.write) come from lib/trading-perms.ts. */
export function useCan(perm: string): boolean {
  const s = useStaff();
  if (IS_DEMO) return true;
  if (isTradingPerm(perm)) return tradingAllows(s, perm);
  return s.permissions?.includes(perm) ?? false;
}

/** The signed-in staff member. Only usable inside the (app) layout. */
export function useStaff(): StaffUser {
  const s = React.useContext(StaffContext);
  if (!s) throw new Error("useStaff must be used inside StaffProvider");
  return s;
}

export async function signOut() {
  if (IS_DEMO) return window.location.assign("/login");
  await fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {});
  window.location.assign("/login");
}
