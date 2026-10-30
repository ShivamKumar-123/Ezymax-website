"use client";

import * as React from "react";
import Link from "next/link";
import { AppShell, Avatar, Tooltip, type NavModule } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { NAV } from "@/lib/live";
import { navFor } from "@/lib/access";
import { AdminTopRight } from "@/components/topbar";
import { signOut, useStaff } from "@/components/staff-session";
import { isWalletPerm, walletAllows } from "@/lib/wallet-perms";
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

const n = (v: number | undefined) => v ?? 0;

/**
 * The queues, and where each one's count comes from.
 *
 * Only work a person has to pick up counts. An on-chain deposit still gathering confirmations is not waiting for
 * anybody, and a KYC case someone has already claimed is not waiting either; an unmatched deposit, a manual
 * request, a withdrawal to review or to pay, an unclaimed KYC case and a chat with no agent all are. A badge that
 * counts things nobody can act on teaches people to ignore the badge.
 *
 * Each source is asked for the smallest page it will give, because only the counts beside the list are wanted.
 * A source the role cannot read is never called, so a limited login does not spend its shift collecting 403s.
 */
const SOURCES: { href: string; perm: string; url: string; count: (d: never) => number }[] = [
  { href: "/finance", perm: "finance.read", url: "/api/wallet/summary", count: (d: WalletSummary) => n(d.deposits?.unmatched) + n(d.deposits?.review) },
  { href: MANUAL_HREF, perm: "finance.read", url: "/api/wallet/summary", count: (d: WalletSummary) => n(d.manual_deposits?.pending) },
  { href: "/finance/withdrawals", perm: "finance.read", url: "/api/wallet/summary", count: (d: WalletSummary) => n(d.withdrawals?.requested) + n(d.withdrawals?.approved) },
  { href: "/clients/kyc", perm: "kyc.read", url: "/api/admin/kyc/cases?per_page=1", count: (d: { counts?: { submitted?: number } }) => n(d.counts?.submitted) },
  { href: "/support", perm: "support.read", url: "/api/support/conversations?queue=waiting&limit=1", count: (d: { counts?: { waiting?: number } }) => n(d.counts?.waiting) },
] as never;

/** Live builds: every queue the role can read, polled every 30 s, on focus and after a manual-deposit decision. */
function useQueueCounts(enabled: boolean, can: (perm: string) => boolean) {
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  // the permissions in hand, as a string, so the effect restarts when they change but not on every render
  const perms = SOURCES.map((x) => (can(x.perm) ? "1" : "0")).join("");
  React.useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = async () => {
      const mine = SOURCES.filter((_, i) => perms[i] === "1");
      // one request per distinct URL, however many badges read from it
      const urls = [...new Set(mine.map((x) => x.url))];
      const bodies = new Map<string, unknown>();
      await Promise.all(
        urls.map((u) =>
          fetch(u, { cache: "no-store", credentials: "same-origin" })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => d && bodies.set(u, d))
            .catch(() => {}),
        ),
      );
      if (!alive) return;
      const next: Record<string, number> = {};
      for (const x of mine) {
        const d = bodies.get(x.url);
        if (d) next[x.href] = (x.count as (v: unknown) => number)(d);
      }
      setCounts(next);
    };
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
  }, [enabled, perms]);
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
  // the same rule useCan applies, read once here because the queues are checked in a loop
  const can = React.useCallback((perm: string) => (isWalletPerm(perm) ? walletAllows(staff, perm) : (staff.permissions?.includes(perm) ?? false)), [staff]);
  const counts = useQueueCounts(!IS_DEMO, can);
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
