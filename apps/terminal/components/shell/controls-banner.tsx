"use client";

/**
 * Top banner of Kalks Trader for the active account (gateway client_controls.rs, engine controls.rs):
 * - a staff session opened from the Back Office: "Staff session as <client> — started by <staff> · End";
 * - restrictions the broker set on the account's owner (trading disabled, close-only, …).
 * Polled every 30 s and whenever the active account changes. Nothing shows for normal, unrestricted sessions.
 */
import * as React from "react";
import { LogOut, ShieldAlert, UserRound } from "lucide-react";
import { useT } from "@kalks/i18n/react";
import { useTerminal } from "@/lib/store";

type Controls = { login: number; accountName?: string | null; clientName?: string; readOnly: boolean; restrictions: string[]; staff: { id: number; name: string } | null; expiresAt: string };

const POLL_MS = 30_000;
const SHOWN = ["trading", "close_only", "social"];

function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ControlsBanner() {
  const T = useTerminal();
  const t = useT();
  const login = T.live && !T.guest ? T.session.login : null;
  const [c, setC] = React.useState<Controls | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const [ending, setEnding] = React.useState(false);

  React.useEffect(() => {
    setC(null);
    if (!login) return;
    let alive = true;
    const load = async () => {
      const r = await fetch("/api/engine/controls", { headers: { "x-kalks-login": login, "x-kalks-errors": "body" }, cache: "no-store" }).catch(() => null);
      if (!alive || !r) return;
      const d = (await r.json().catch(() => null)) as (Controls & { error?: unknown }) | null;
      if (d && !d.error) setC(d);
    };
    void load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [login]);

  const staff = c?.staff ?? null;
  React.useEffect(() => {
    if (!staff) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [staff]);

  if (!c) return null;
  const kinds = SHOWN.filter((k) => c.restrictions.includes(k));
  const left = Date.parse(c.expiresAt) - now;

  async function end() {
    if (!login) return;
    setEnding(true);
    await fetch("/api/engine/staff-end", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ login }) }).catch(() => null);
    window.location.replace("/login?logout=1");
  }

  if (!staff && !kinds.length) return null;
  return (
    <div className="shrink-0 border-b border-line bg-panel text-[12px]" data-testid="trader-controls-banner">
      {staff && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-ember/30 bg-ember-soft/60 px-3 py-1.5" data-testid="trader-staff-banner">
          <span className="flex min-w-0 items-center gap-2">
            <UserRound className="size-3.5 shrink-0 text-ember" />
            <span className="truncate">
              <span className="font-semibold text-fg">{t("security.staff.banner", { client: c.clientName || c.accountName || `#${c.login}` })}</span>
              <span className="text-fg-2"> — {t("security.staff.startedBy", { staff: staff.name })}</span>
              <span className="ms-2 rounded border border-line px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide text-fg-2">{c.readOnly ? t("security.staff.readOnly") : t("security.staff.full")}</span>
              <span className="ms-2 font-mono text-fg-3">{t("security.staff.left", { time: mmss(left) })}</span>
            </span>
          </span>
          <button onClick={end} disabled={ending} className="inline-flex h-6 items-center gap-1.5 rounded-[6px] border border-line bg-surface-3 px-2 text-[11.5px] font-semibold text-fg hover:border-ember/40" data-testid="trader-staff-end">
            <LogOut className="size-3" /> {ending ? t("security.staff.ending") : t("security.staff.end")}
          </button>
        </div>
      )}
      {kinds.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-warn" role="status" data-testid="trader-restriction-banner">
          <ShieldAlert className="size-3.5 shrink-0" />
          <span className="truncate text-fg-2">{kinds.map((k) => t.dyn(`security.restricted.kind.${k}`, k)).join(" · ")}</span>
        </div>
      )}
    </div>
  );
}
