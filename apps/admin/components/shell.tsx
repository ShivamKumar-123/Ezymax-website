"use client";

import * as React from "react";
import Link from "next/link";
import { AppShell, Avatar, Tooltip, type NavModule } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { NAV } from "@/lib/live";
import { navFor } from "@/lib/access";
import { AdminTopRight } from "@/components/topbar";
import { signOut, useCan, useStaff } from "@/components/staff-session";
import { MANUAL_CHANGED } from "@/components/finance-live/manual-data";

/** The shared rail's sign-out icon is a plain link to /login; turn it into a real sign-out. */
function onRailSignOut(e: React.MouseEvent) {
  const a = (e.target as HTMLElement).closest("a");
  if (a?.getAttribute("href") === "/login") {
    e.preventDefault();
    e.stopPropagation();
    void signOut();
  }
}

const MANUAL_HREF = "/finance/manual-deposits";

/** Live builds: pending manual deposit requests (wallet summary), polled every 30 s, on focus and after a decision.
 *  0 when there are none, the build is a demo, the role can't read finance, or the wallet can't be reached. */
function useManualPending(enabled: boolean) {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () =>
      fetch("/api/wallet/summary", { cache: "no-store", credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { manual_deposits?: { pending?: number } } | null) => {
          const p = d?.manual_deposits?.pending;
          if (alive && typeof p === "number") setN(p);
        })
        .catch(() => {});
    void load();
    const t = setInterval(load, 30_000);
    const onFocus = () => document.visibilityState !== "hidden" && void load();
    window.addEventListener("focus", onFocus);
    window.addEventListener(MANUAL_CHANGED, load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(MANUAL_CHANGED, load);
    };
  }, [enabled]);
  return n;
}

function withManualBadge(modules: NavModule[], pending: number): NavModule[] {
  if (pending <= 0) return modules;
  return modules.map((m) => {
    if (!m.sub?.some((s) => s.href === MANUAL_HREF)) return m;
    return { ...m, badge: pending, sub: m.sub.map((s) => (s.href === MANUAL_HREF ? { ...s, badge: pending } : s)) };
  });
}

/** Back Office chrome for the signed-in staff member. */
export function BackOfficeShell({ children }: { children: React.ReactNode }) {
  const staff = useStaff();
  const canFinance = useCan("finance.read");
  const pending = useManualPending(!IS_DEMO && canFinance);
  // live builds hide every page the staff member's role can't open (permissions come from the gateway)
  const modules = React.useMemo(() => (IS_DEMO ? NAV : withManualBadge(navFor(NAV, staff), pending)), [staff, pending]);
  return (
    <div className="contents" onClickCapture={onRailSignOut}>
      <AppShell
        modules={modules}
        pillVariant="text"
        brandSuffix={<span className="hidden whitespace-nowrap rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-fg-2 sm:inline">BACK OFFICE</span>}
        railFooter={
          <Tooltip content={`${staff.name} · ${staff.role_label}`} side="right">
            <Link href="/org" className="mb-1">
              <Avatar name={staff.name} size={38} online />
            </Link>
          </Tooltip>
        }
        topRight={<AdminTopRight />}
      >
        {children}
      </AppShell>
    </div>
  );
}
