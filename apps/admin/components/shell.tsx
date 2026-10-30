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

/** What the wallet's one summary call already counts, and nothing it does not. */
interface WalletSummary {
  deposits?: { unmatched?: number; review?: number };
  withdrawals?: { requested?: number; approved?: number };
  manual_deposits?: { pending?: number };
}

/**
 * How many things are waiting for a person on each page.
 *
 * Only work a human has to pick up counts. An on-chain deposit still gathering confirmations is not waiting for
 * anybody, so it is left out; an unmatched one, a manual request, a withdrawal to review or to pay all are. A
 * badge that counts things nobody can act on trains people to ignore the badge.
 */
function queueCounts(s: WalletSummary | null): Record<string, number> {
  const n = (v: number | undefined) => v ?? 0;
  return {
    "/finance": n(s?.deposits?.unmatched) + n(s?.deposits?.review),
    [MANUAL_HREF]: n(s?.manual_deposits?.pending),
    "/finance/withdrawals": n(s?.withdrawals?.requested) + n(s?.withdrawals?.approved),
  };
}

/** Live builds: the wallet summary, polled every 30 s, on focus and after a decision. Empty for a demo build,
 *  a role that can't read finance, or a wallet that can't be reached. */
function useQueueCounts(enabled: boolean) {
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  React.useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () =>
      fetch("/api/wallet/summary", { cache: "no-store", credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: WalletSummary | null) => {
          if (alive && d) setCounts(queueCounts(d));
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
  return counts;
}

/**
 * Puts each count on its page, and their total on the module.
 *
 * A zero is left off rather than shown: an empty queue is the normal state, and a nav full of noughts is harder to
 * read than one where a number means something is waiting. LIVE_NAV arrives with the demo's mock badges already
 * stripped, so whatever shows here was counted.
 */
function withQueueBadges(modules: NavModule[], counts: Record<string, number>): NavModule[] {
  return modules.map((m) => {
    if (!m.sub?.length) return m;
    const total = m.sub.reduce((a, x) => a + (counts[x.href] ?? 0), 0);
    if (!total) return m;
    return { ...m, badge: total, sub: m.sub.map((x) => (counts[x.href] ? { ...x, badge: counts[x.href] } : x)) };
  });
}

/** Back Office chrome for the signed-in staff member. */
export function BackOfficeShell({ children }: { children: React.ReactNode }) {
  const staff = useStaff();
  const canFinance = useCan("finance.read");
  const counts = useQueueCounts(!IS_DEMO && canFinance);
  // live builds hide every page the staff member's role can't open (permissions come from the gateway)
  const modules = React.useMemo(() => (IS_DEMO ? NAV : withQueueBadges(navFor(NAV, staff), counts)), [staff, counts]);
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
