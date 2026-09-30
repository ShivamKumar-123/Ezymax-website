"use client";

/**
 * Account notices at the top of every Client Area page (gateway client_controls.rs):
 * - the staff banner of a staff session opened as the client from the Back Office ("Staff session as <client> —
 *   started by <staff> · End"), with the time left of its 30 minutes;
 * - the restrictions the broker set on the account (trading, close-only, deposits, withdrawals, transfers, IB,
 *   copy / PAMM / MAM, freeze), each named in the reader's language.
 * It also sends the presence heartbeat of an open, visible tab (every 45 s), whose answer refreshes the
 * restrictions without a reload.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ShieldAlert, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button, cn } from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock";
import { useT } from "@kalks/i18n/react";
import { useSession } from "@/components/session";

export type ClientRestriction = { kind: string; label?: string; expires_at: string | null };
export type StaffImpersonation = { mode: "read_only" | "full"; staff: { id: number; name: string }; reason?: string | null; started_at: string; expires_at: string };
/** Fields the gateway adds to the session record (`/v1/auth/me`). */
export type AccountControls = { restrictions?: ClientRestriction[]; restricted?: string[]; impersonation?: StaffImpersonation | null };

const HEARTBEAT_MS = 45_000;
const KIND_ORDER = ["trading", "close_only", "deposits", "withdrawals", "transfers", "ib", "social"];

function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function AccountNotices() {
  const me = useSession() as ReturnType<typeof useSession> & AccountControls;
  const t = useT();
  const [restricted, setRestricted] = React.useState<string[]>(me.restricted ?? []);
  const [restrictions, setRestrictions] = React.useState<ClientRestriction[]>(me.restrictions ?? []);
  const imp = me.impersonation ?? null;

  // presence heartbeat while the tab is open and visible; its answer keeps the banner current
  React.useEffect(() => {
    if (IS_DEMO) return;
    let alive = true;
    const beat = async () => {
      if (document.visibilityState !== "visible") return;
      const r = await fetch("/api/auth/heartbeat", { method: "POST", headers: { "content-type": "application/json" }, body: "{}", credentials: "same-origin" }).catch(() => null);
      if (!alive || !r || r.status !== 200) return;
      const d = (await r.json().catch(() => null)) as AccountControls | null;
      if (d?.restricted) setRestricted(d.restricted);
      if (d?.restrictions) setRestrictions(d.restrictions);
    };
    void beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    const onVisible = () => document.visibilityState === "visible" && void beat();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <>
      {imp && <StaffBanner imp={imp} client={me.name} />}
      {restricted.length > 0 && <RestrictionBanner restricted={restricted} restrictions={restrictions} t={t} />}
    </>
  );
}

function StaffBanner({ imp, client }: { imp: StaffImpersonation; client: string }) {
  const t = useT();
  const tRef = React.useRef(t);
  tRef.current = t;
  const end = Date.parse(imp.expires_at);
  const [now, setNow] = React.useState(() => Date.now());
  const [ending, setEnding] = React.useState(false);
  const left = end - now;

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  React.useEffect(() => {
    if (left <= 0) window.location.assign("/staff-session?state=ended");
  }, [left]);

  // in-app navigations are audited too (the first page was a full load, which the proxy already reported)
  const pathname = usePathname();
  const firstPath = React.useRef(pathname);
  React.useEffect(() => {
    if (!pathname || pathname === firstPath.current) return;
    firstPath.current = "";
    void fetch("/api/auth/impersonation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "page_view", path: pathname }), credentials: "same-origin" }).catch(() => null);
  }, [pathname]);

  // a change refused because the staff session is read-only gets one clear message
  React.useEffect(() => {
    if (imp.mode !== "read_only") return;
    const original = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await original(...args);
      if (res.status === 403) {
        res
          .clone()
          .json()
          .then((d: { error?: { code?: string } }) => {
            if (d?.error?.code === "staff_read_only") toast.info(tRef.current("security.staff.readOnly"), { id: "staff-read-only", description: tRef.current("security.staff.refused") });
          })
          .catch(() => {});
      }
      return res;
    };
    return () => {
      window.fetch = original;
    };
  }, [imp.mode]);

  async function stop() {
    setEnding(true);
    await fetch("/api/auth/impersonation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "end" }), credentials: "same-origin" }).catch(() => null);
    window.location.assign("/staff-session?state=ended");
  }

  return (
    <div
      className="sticky top-0 z-40 mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[14px] border border-ember/40 bg-surface px-4 py-2.5 text-[13px] shadow-[0_1px_0_0_var(--color-line)]"
      data-testid="staff-banner"
      data-mode={imp.mode}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full border border-ember/40 bg-ember-soft text-ember">
          <UserRound className="size-3.5" />
        </span>
        <span className="min-w-0">
          <span className="font-medium text-fg">{t("security.staff.banner", { client })}</span>
          <span className="text-fg-2"> — {t("security.staff.startedBy", { staff: imp.staff.name })}</span>
          <span className={cn("ms-2 inline-flex h-5 items-center rounded-full border px-2 text-[10.5px] font-medium", imp.mode === "full" ? "border-down/30 bg-down-soft text-down" : "border-info/30 bg-info-soft text-info")}>
            {imp.mode === "full" ? t("security.staff.full") : t("security.staff.readOnly")}
          </span>
          {/* the countdown differs by a second between the server render and the browser */}
          <span className="k-num ms-2 text-[12px] text-fg-3" data-testid="staff-time-left" suppressHydrationWarning>
            {t("security.staff.left", { time: mmss(left) })}
          </span>
        </span>
      </div>
      <Button size="xs" variant="surface" onClick={stop} disabled={ending} data-testid="staff-end">
        <LogOut /> {ending ? t("security.staff.ending") : t("security.staff.end")}
      </Button>
    </div>
  );
}

function RestrictionBanner({ restricted, restrictions, t }: { restricted: string[]; restrictions: ClientRestriction[]; t: ReturnType<typeof useT> }) {
  const frozen = restrictions.some((r) => r.kind === "freeze");
  const kinds = KIND_ORDER.filter((k) => restricted.includes(k));
  const expiry = (k: string) => {
    const direct = restrictions.find((r) => r.kind === k)?.expires_at;
    const viaFreeze = frozen ? restrictions.find((r) => r.kind === "freeze")?.expires_at : undefined;
    const e = direct ?? viaFreeze ?? null;
    return e ? new Intl.DateTimeFormat(t.locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(e)) : null;
  };
  if (!kinds.length) return null;
  return (
    <div role="status" className="mb-4 rounded-[14px] border border-warn/30 bg-warn-soft px-4 py-3 text-[13px]" data-testid="restriction-banner" data-kinds={kinds.join(",")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" />
          <div className="min-w-0">
            <div className="font-medium text-fg">{frozen ? t("security.restricted.frozen") : t("security.restricted.title")}</div>
            <ul className="mt-1 space-y-0.5 text-fg-2">
              {kinds.map((k) => {
                const until = expiry(k);
                return (
                  <li key={k}>
                    {t.dyn(`security.restricted.kind.${k}`, k)}
                    {until && <span className="text-fg-3"> · {t("security.restricted.until", { date: until })}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <Link href="/support" className="shrink-0 text-[12.5px] font-medium text-ember hover:underline">
          {t("security.restricted.contact")}
        </Link>
      </div>
    </div>
  );
}
