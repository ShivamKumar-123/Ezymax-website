"use client";

/**
 * Client presence (gateway client_controls.rs): Online (active in the last 2 minutes in the Client Area or
 * Ezymex Trader), Away (idle 2–15 minutes), Offline with "last seen". Lists poll every 15 s.
 */
import * as React from "react";
import Link from "next/link";
import { CandlestickChart, LayoutDashboard, LogOut, Monitor, Radio, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, Dialog, EmptyState, Flag, Skeleton, Tooltip, cn } from "@ezymex/ui";
import { ErrorState, Mono, ago, countryName, device, sendJson, useApi, useNow, when } from "@/components/live/kit";
import { RestrictionChips } from "./restrictions-card";

export type PresenceState = "online" | "away" | "offline";
export type AppKey = "client_area" | "trader";

export const PRESENCE_POLL_MS = 15_000;

export const APP_LABEL: Record<AppKey, string> = { client_area: "Client Area", trader: "Ezymex Trader" };

export function PresenceDot({ state, className }: { state: PresenceState; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        state === "online" ? "bg-up" : state === "away" ? "bg-warn" : "border border-fg-3/60 bg-transparent",
        className,
      )}
    />
  );
}

/** "Online", "Away · 6m", "3h ago", "Never". */
export function presenceText(state: PresenceState, last: string | null | undefined, now: number) {
  if (state === "online") return "Online";
  if (state === "away") return `Away · ${ago(last, now).replace(" ago", "")}`;
  return last ? ago(last, now) : "Never";
}

export function AppChips({ apps, size = "sm" }: { apps: string[]; size?: "sm" | "md" }) {
  if (!apps.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {apps.map((a) => (
        <Chip key={a} size={size} tone="neutral">
          {a === "trader" ? <CandlestickChart className="size-3" /> : <LayoutDashboard className="size-3" />}
          {APP_LABEL[a as AppKey] ?? a}
        </Chip>
      ))}
    </span>
  );
}

/** Presence cell for tables: dot + state / last seen, with the apps in a tooltip. */
export function PresenceCell({ state, last, apps, now }: { state: PresenceState; last: string | null | undefined; apps?: string[]; now: number }) {
  const label = presenceText(state, last, now);
  const tip = state === "offline" ? (last ? `Last seen ${when(last)}` : "Hasn't been active since presence tracking started") : `${apps?.length ? apps.map((a) => APP_LABEL[a as AppKey] ?? a).join(" and ") : "Client Area"} · last active ${when(last)}`;
  return (
    <Tooltip content={tip}>
      <span className="inline-flex items-center gap-2 whitespace-nowrap" data-presence={state}>
        <PresenceDot state={state} />
        <span className={cn("text-[12.5px]", state === "online" ? "text-up" : state === "away" ? "text-warn" : "text-fg-3")}>{label}</span>
        {state !== "offline" && apps?.includes("trader") && <CandlestickChart className="size-3 text-fg-3" aria-label="In Ezymex Trader" />}
      </span>
    </Tooltip>
  );
}

/* ---------- Online now (clients header) ---------- */

type PresenceItem = {
  id: number;
  name: string;
  email: string;
  country: string;
  presence: PresenceState;
  last_active_at: string | null;
  apps: string[];
  since: string | null;
  ip: string | null;
  location: string | null;
  user_agent: string | null;
  trader_login: number | null;
  restrictions: string[];
};
type PresenceList = { online: number; away: number; items: PresenceItem[]; generated_at: string };

export function OnlineNow() {
  const [open, setOpen] = React.useState(false);
  const now = useNow(15_000);
  const { data, error, reload } = useApi<PresenceList>("/api/admin/client-controls/presence", { refreshMs: PRESENCE_POLL_MS });
  const [tab, setTab] = React.useState<"online" | "away">("online");
  const rows = (data?.items ?? []).filter((x) => x.presence === tab);
  return (
    <>
      <Button variant="surface" onClick={() => setOpen(true)} data-testid="online-now">
        <PresenceDot state={data && data.online > 0 ? "online" : "offline"} />
        Online now <span className="k-num font-medium" data-testid="online-count">{data ? data.online : "—"}</span>
        {data && data.away > 0 && <span className="k-num text-fg-3">· {data.away} away</span>}
      </Button>
      <Dialog
        side="right"
        open={open}
        onOpenChange={setOpen}
        title="Clients online"
        description="Active in the Client Area or Ezymex Trader. Online = last 2 minutes, Away = 2–15 minutes. Updates every 15 seconds."
      >
        <div className="mb-3 flex items-center gap-2">
          {(["online", "away"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn("inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[12.5px]", tab === k ? "border-ember/50 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-2 hover:text-fg")}
            >
              <PresenceDot state={k} />
              {k === "online" ? "Online" : "Away"}
              <span className="k-num text-fg-3">{data ? (k === "online" ? data.online : data.away) : "—"}</span>
            </button>
          ))}
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} className="py-8" />
        ) : !data ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={tab === "online" ? "Nobody online right now" : "Nobody away"} text="Clients appear here while the Client Area or Ezymex Trader is open." illustration="busts_in_silhouette" className="py-8" />
        ) : (
          <ul className="divide-y divide-line rounded-[14px] border border-line" data-testid="online-list">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/clients/${c.id}`} onClick={() => setOpen(false)} className="flex items-start gap-3 px-3 py-2.5 hover:bg-surface-2">
                  <Avatar name={c.name} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium">{c.name}</span>
                      <RestrictionChips kinds={c.restrictions} max={1} />
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-fg-3">
                      <AppChips apps={c.apps} />
                      {c.location && (
                        <span className="inline-flex items-center gap-1">
                          <Flag country={c.location} className="size-3" />
                          {c.location.toUpperCase()}
                        </span>
                      )}
                      {c.ip && <Mono className="text-[11px]">{c.ip}</Mono>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[11.5px] text-fg-3">
                    <span className="block">{c.presence === "online" ? (c.since ? `since ${ago(c.since, now).replace(" ago", "")}` : "now") : ago(c.last_active_at, now)}</span>
                    {c.trader_login && <Mono className="text-[11px]">#{c.trader_login}</Mono>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </>
  );
}

/* ---------- Client 360: presence and devices ---------- */

export type Device = {
  id: number | string;
  app: AppKey;
  kind: "client" | "viewer" | "staff";
  login?: number | null;
  ip: string | null;
  country: string | null;
  user_agent: string | null;
  since: string;
  last_active_at: string;
  presence: PresenceState;
  viewer?: { id: number; label: string | null } | null;
  staff?: { id: number; name: string | null } | null;
};

export type StaffSession = { session_id: number; staff: { id: number; name: string | null }; mode: "read_only" | "full"; reason: string | null; started_at: string; expires_at: string; mine: boolean };

export type Controls = {
  status: "active" | "blocked" | "closed";
  presence: { state: PresenceState; last_active_at: string | null; last_trader_at: string | null; apps: string[]; devices: Device[] };
  restrictions: Restriction[];
  effective: string[];
  history: Restriction[];
  staff_sessions: StaffSession[];
  kinds: { kind: string; label: string; permission: string }[];
  freeze_covers: string[];
  can: { restrict: boolean; block: boolean; impersonate: boolean; impersonate_full: boolean };
  staff_session_minutes: number;
  generated_at: string;
};

export type Restriction = {
  id: number;
  kind: string;
  label: string;
  reason: string;
  expires_at: string | null;
  created_at: string;
  created_by: { id: number; name: string | null } | null;
  lifted_at: string | null;
  lifted_by: { id: number; name: string | null } | null;
  lift_reason: string | null;
  state: "active" | "lifted" | "expired";
};

/** One fetch for the client 360 controls (presence, restrictions, staff sessions), polled every 15 s. */
export function useControls(id: number) {
  return useApi<Controls>(`/api/admin/client-controls/users/${id}`, { refreshMs: PRESENCE_POLL_MS });
}

export function PresenceCard({ controls, onChanged }: { controls: ReturnType<typeof useControls>; onChanged: () => void }) {
  const now = useNow(15_000);
  const { data: c, error, reload } = controls;
  const [ending, setEnding] = React.useState<StaffSession | null>(null);
  const p = c?.presence;
  const lastLabel = p ? (p.state === "offline" ? (p.last_active_at ? `Last seen ${ago(p.last_active_at, now)}` : "No activity recorded yet") : p.state === "online" ? "Active now" : `Idle for ${ago(p.last_active_at, now).replace(" ago", "")}`) : "";
  return (
    <Card data-testid="presence-card">
      <CardHeader
        title="Presence and devices"
        subtitle="Client Area sessions and Ezymex Trader connections. Updates every 15 seconds."
        icon={<Radio />}
        action={
          p && (
            <span className="inline-flex items-center gap-2" data-testid="client-presence" data-state={p.state}>
              <PresenceDot state={p.state} />
              <span className={cn("text-[13px] font-medium", p.state === "online" ? "text-up" : p.state === "away" ? "text-warn" : "text-fg-2")}>
                {p.state === "online" ? "Online" : p.state === "away" ? "Away" : "Offline"}
              </span>
              <span className="text-[12px] text-fg-3" title={when(p.last_active_at, true)}>
                · {lastLabel}
              </span>
            </span>
          )
        }
      />
      <div className="px-4 pb-5 pt-3 sm:px-6">
        {error ? (
          <ErrorState error={error} onRetry={reload} className="py-6" />
        ) : !c ? (
          <Skeleton className="h-20 w-full" />
        ) : c.presence.devices.length === 0 ? (
          <div className="k-row flex items-center gap-3 px-4 py-3 text-[12.5px] text-fg-3">
            <Monitor className="size-4 shrink-0" />
            Not signed in anywhere right now.
            {c.presence.last_trader_at && <span>Last in Ezymex Trader {ago(c.presence.last_trader_at, now)}.</span>}
          </div>
        ) : (
          <ul className="divide-y divide-line rounded-[14px] border border-line" data-testid="device-list">
            {c.presence.devices.map((d) => (
              <li key={String(d.id)} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2.5 sm:flex-nowrap">
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 [&_svg]:size-4">
                    {d.app === "trader" ? <CandlestickChart /> : d.kind === "staff" ? <UserRound /> : <LayoutDashboard />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
                      {APP_LABEL[d.app]}
                      {d.login && <Mono className="text-[11.5px] text-fg-3">#{d.login}</Mono>}
                      {d.kind === "viewer" && <Chip size="sm" tone="info">View-only · {d.viewer?.label ?? "viewer"}</Chip>}
                      {d.kind === "staff" && <Chip size="sm" tone="ember">Staff · {d.staff?.name ?? "staff"}</Chip>}
                    </span>
                    <span className="block truncate text-[11.5px] text-fg-3">{device(d.user_agent)}</span>
                  </span>
                </span>
                <span className="flex items-center gap-2 text-[12px] text-fg-2">
                  {d.country ? (
                    <span className="inline-flex items-center gap-1" title={countryName(d.country)}>
                      <Flag country={d.country} className="size-3.5" />
                      {d.country.toUpperCase()}
                    </span>
                  ) : (
                    <span className="text-fg-3">—</span>
                  )}
                  <Mono className="text-[11.5px]">{d.ip ?? "—"}</Mono>
                </span>
                <span className="flex w-full items-center justify-between gap-3 text-[11.5px] text-fg-3 sm:w-40 sm:flex-col sm:items-end sm:gap-0">
                  <span className="inline-flex items-center gap-1.5">
                    <PresenceDot state={d.presence} />
                    {d.presence === "online" ? "active now" : `active ${ago(d.last_active_at, now)}`}
                  </span>
                  <span title={when(d.since, true)}>since {when(d.since)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {c && c.staff_sessions.length > 0 && (
          <div className="mt-3 space-y-2" data-testid="staff-sessions">
            {c.staff_sessions.map((s) => (
              <div key={s.session_id} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-ember/30 bg-ember-soft px-3 py-2 text-[12.5px]">
                <span className="min-w-0">
                  <span className="font-medium">{s.staff.name ?? "Staff"}</span> is in the Client Area as this client · {s.mode === "full" ? "full access" : "read-only"} · until {when(s.expires_at)}
                  {s.reason && <span className="block truncate text-[11.5px] text-fg-3">Reason: {s.reason}</span>}
                </span>
                {(s.mine || c.can.impersonate) && (
                  <Button size="xs" variant="surface" onClick={() => setEnding(s)}>
                    <LogOut /> End
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <Dialog
        open={!!ending}
        onOpenChange={(o) => !o && setEnding(null)}
        width={440}
        title="End staff session"
        description="The Client Area tab opened as this client is signed out at once."
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setEnding(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="down-outline"
              onClick={async () => {
                if (!ending) return;
                const r = await sendJson(`/api/admin/client-controls/impersonations/${ending.session_id}/end`, {});
                setEnding(null);
                if (!r.ok) return toast.error("Couldn't end the session", { description: r.error.message });
                toast.success("Staff session ended", { description: "Recorded in the audit trail." });
                onChanged();
              }}
            >
              <LogOut /> End session
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-fg-2">Started by {ending?.staff.name ?? "staff"} {ending ? when(ending.started_at) : ""}.</p>
      </Dialog>
    </Card>
  );
}
