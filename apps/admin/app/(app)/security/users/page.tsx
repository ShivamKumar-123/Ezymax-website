"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Laptop,
  LogIn,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet,
  UserRound,
  Users,
} from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  DataTable,
  Donut,
  Flag,
  IconButton,
  KpiCard,
  Menu,
  PageHeader,
  Reveal,
  Segmented,
  Tooltip,
  WorldMap,
  cn,
  type Column,
} from "@ezymex/ui";
import { SEC_ACTIVITY_HOURLY, SEC_USER_EVENTS, SEC_USER_STATS, type SecRiskFlag, type SecUserEvent, type SecUserEventType } from "@ezymex/mock/admin-platform-security";
import { ActivityChart } from "@/components/security/activity-chart";
import { Mono, TenantDot, ago, timeGmt3 } from "@/components/security/shared";

const FLAG_META: Record<SecRiskFlag, { label: string; tone: "warn" | "down" | "info" | "ember"; desc: string }> = {
  new_device: { label: "New device", tone: "info", desc: "First login from this device fingerprint" },
  vpn: { label: "VPN / proxy", tone: "warn", desc: "IP belongs to a hosting or VPN range" },
  impossible_travel: { label: "Impossible travel", tone: "down", desc: "Distance vs. time since last login is not feasible" },
  tor: { label: "Tor exit", tone: "down", desc: "IP is a known Tor exit node" },
  failed_burst: { label: "Failed burst", tone: "ember", desc: "5+ failed attempts within 10 minutes" },
  geo_mismatch: { label: "Geo mismatch", tone: "warn", desc: "Country differs from KYC residence" },
};

const EVENT_META: Record<SecUserEventType, { label: string; tone: "neutral" | "up" | "down" | "info" | "gold" | "warn" }> = {
  login: { label: "Login", tone: "neutral" },
  login_failed: { label: "Failed login", tone: "down" },
  password_reset: { label: "Password reset", tone: "warn" },
  "2fa_enabled": { label: "2FA enabled", tone: "up" },
  withdrawal_request: { label: "Withdrawal request", tone: "gold" },
  api_key_created: { label: "API key created", tone: "info" },
  device_added: { label: "Device added", tone: "info" },
};

const DeviceIcon = ({ d }: { d: SecUserEvent["device"] }) => (d === "mobile" ? <Smartphone className="size-4" /> : d === "tablet" ? <Tablet className="size-4" /> : <Laptop className="size-4" />);

function RiskMeter({ v }: { v: number }) {
  const tone = v >= 60 ? "bg-down" : v >= 30 ? "bg-warn" : "bg-up";
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="flex gap-[2px]">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={cn("h-3 w-1 rounded-full", i < Math.ceil(v / 20) ? tone : "bg-surface-3")} />
        ))}
      </div>
      <span className="k-num w-6 text-right text-[12px] text-fg-2">{v}</span>
    </div>
  );
}

type View = "all" | "flagged" | "failed" | "money";

export default function UserActivityPage() {
  const [view, setView] = React.useState<View>("all");
  const rows = React.useMemo(
    () =>
      SEC_USER_EVENTS.filter((e) =>
        view === "flagged" ? e.flags.length > 0 : view === "failed" ? e.type === "login_failed" : view === "money" ? e.type === "withdrawal_request" || e.type === "api_key_created" : true,
      ),
    [view],
  );

  const columns: Column<SecUserEvent>[] = [
    {
      key: "time",
      header: "Time",
      width: "92px",
      sort: (r) => r.time,
      cell: (r) => (
        <div>
          <div className="font-mono text-[12px] text-fg-2">{timeGmt3(r.time, false)}</div>
          <div className="text-[10.5px] text-fg-3">{ago(r.time)}</div>
        </div>
      ),
    },
    {
      key: "client",
      header: "Client",
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={r.person.photo} name={r.person.name} size={30} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium">{r.person.name}</div>
            <div className="flex items-center gap-1.5">
              <Mono className="text-[11px] text-fg-3">{r.login}</Mono>
              <TenantDot tenant={r.tenant} />
            </div>
          </div>
        </div>
      ),
    },
    { key: "event", header: "Event", cell: (r) => <Chip size="sm" tone={EVENT_META[r.type].tone} dot={r.type === "login_failed"}>{EVENT_META[r.type].label}</Chip> },
    {
      key: "device",
      header: "Device / browser",
      hideOn: "md",
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full border border-line bg-surface-2 text-fg-2">
            <DeviceIcon d={r.device} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] text-fg">{r.deviceName}</div>
            <div className="truncate text-[11px] text-fg-3">{r.browser}</div>
          </div>
        </div>
      ),
    },
    {
      key: "geo",
      header: "Location · IP",
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <Flag country={r.country} className="size-4" />
          <div>
            <div className="text-[12.5px]">{r.city}</div>
            <Mono className="text-[11px] text-fg-3">{r.ip}</Mono>
          </div>
        </div>
      ),
    },
    {
      key: "flags",
      header: "Risk flags",
      cell: (r) =>
        r.flags.length ? (
          <div className="flex max-w-[220px] flex-wrap gap-1">
            {r.flags.map((f) => (
              <Tooltip key={f} content={FLAG_META[f].desc}>
                <span>
                  <Chip size="sm" tone={FLAG_META[f].tone}>
                    {FLAG_META[f].label}
                  </Chip>
                </span>
              </Tooltip>
            ))}
          </div>
        ) : (
          <span className="text-[12px] text-fg-3">None</span>
        ),
    },
    {
      key: "2fa",
      header: "2FA",
      align: "center",
      cell: (r) =>
        r.twoFa ? (
          <Tooltip content="Passed TOTP challenge">
            <ShieldCheck className="mx-auto size-4 text-up" />
          </Tooltip>
        ) : (
          <Tooltip content="No second factor">
            <ShieldAlert className="mx-auto size-4 text-fg-3" />
          </Tooltip>
        ),
    },
    { key: "risk", header: "Risk", align: "right", sort: (r) => r.risk, cell: (r) => <RiskMeter v={r.risk} /> },
    {
      key: "act",
      header: "",
      width: "48px",
      align: "right",
      cell: (r) => (
        <Menu
          trigger={
            <IconButton size="sm" aria-label="Actions">
              <MoreHorizontal />
            </IconButton>
          }
          items={[
            { label: "Open client profile", icon: <UserRound />, onSelect: () => toast.info(`Opening ${r.person.name}`, { description: `Login ${r.login}` }) },
            { label: "Mark device as trusted", icon: <CheckCircle2 />, onSelect: () => toast.success("Device trusted", { description: `${r.deviceName} · ${r.browser}` }) },
            { label: "Force password reset", icon: <KeyRound />, onSelect: () => toast.success("Password reset enforced", { description: `${r.person.name} will be asked on next login` }) },
            { label: "Revoke all client sessions", icon: <LogIn />, onSelect: () => toast.success("Client sessions revoked", { description: "3 devices signed out" }) },
            "sep",
            { label: "Lock account", icon: <Ban />, danger: true, onSelect: () => toast.error(`Account ${r.login} locked`, { description: "Trading and withdrawals disabled · logged to audit" }) },
          ]}
        />
      ),
    },
  ];

  const flaggedCount = SEC_USER_EVENTS.filter((e) => e.flags.length).length;
  const failedCount = SEC_USER_EVENTS.filter((e) => e.type === "login_failed").length;
  const flagTotal = SEC_USER_STATS.flagMix.reduce((s, f) => s + f.count, 0);
  const deviceMix = [
    { label: "Mobile app", value: 54, color: "var(--k-ember)" },
    { label: "Web desktop", value: 31, color: "var(--k-gold)" },
    { label: "MT5 terminal", value: 11, color: "var(--k-info)" },
    { label: "Tablet", value: 4, color: "var(--k-fg-3)" },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="User activity"
        subtitle="Client logins, devices and risk signals across all tenants · last 24 hours · GMT+3"
        actions={
          <>
            <Button variant="surface" onClick={() => toast.info("Risk rules", { description: "Impossible travel: > 900 km/h · Failed burst: 5 in 10 min · VPN list updated 06:00" })}>
              <Fingerprint /> Risk rules
            </Button>
            <Button variant="ember" onClick={() => toast.success("Watchlist review started", { description: `${flaggedCount} flagged events assigned to the Risk desk` })}>
              <ShieldAlert /> Review flagged
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Logins · 24h" icon={<LogIn />} value={<span className="k-num">{SEC_USER_STATS.logins24h.toLocaleString("en-US")}</span>} chip="+6.2% vs yesterday" chipTone="up" />
        <KpiCard label="Failed logins" icon={<AlertTriangle />} value={<span className="k-num">{SEC_USER_STATS.failed24h.toLocaleString("en-US")}</span>} chip={`${((SEC_USER_STATS.failed24h / SEC_USER_STATS.logins24h) * 100).toFixed(1)}% failure rate`} chipTone="warn" delay={0.05} />
        <KpiCard label="Flagged sessions" icon={<ShieldAlert />} value={<span className="k-num">{SEC_USER_STATS.flagged24h}</span>} chip="14 impossible travel" chipTone="down" delay={0.1} />
        <KpiCard label="2FA adoption" icon={<ShieldCheck />} value={<span className="k-num">{SEC_USER_STATS.twoFaAdoption}%</span>} chip="+1.8 pts this month" chipTone="up" illustration="shield" hot delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="Login activity" subtitle="Hourly, all tenants · hover a bar for detail" action={<Chip tone="up" dot>Live</Chip>} />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <ActivityChart data={SEC_ACTIVITY_HOURLY} height={292} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <Card className="flex h-full flex-col">
            <CardHeader title="Risk signals" subtitle={`${flagTotal} flags raised in 24h`} />
            <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
              {SEC_USER_STATS.flagMix.map((f) => {
                const m = FLAG_META[f.flag];
                const bar = { warn: "bg-warn", down: "bg-down", info: "bg-info", ember: "bg-ember" }[m.tone];
                return (
                  <div key={f.flag} className="k-row px-3.5 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-[13px] font-medium">
                        <span className={cn("size-2 rounded-full", bar)} />
                        {m.label}
                      </span>
                      <span className="k-num text-[13px] font-semibold">{f.count}</span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
                      <div className={cn("h-full rounded-full", bar)} style={{ width: `${(f.count / SEC_USER_STATS.flagMix[0]!.count) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4 block">
        <Card>
          <CardHeader title="Event stream" subtitle="Most recent client security events" icon={<Users />} />
          <div className="px-4 pb-5 pt-4 sm:px-6">
            <DataTable
              columns={columns}
              rows={rows}
              pageSize={10}
              dense
              rowKey={(r) => r.id}
              search={(r) => `${r.person.name} ${r.login} ${r.ip} ${r.city} ${r.deviceName}`}
              searchPlaceholder="Client, login, IP…"
              exportName="client-activity"
              toolbar={
                <Segmented
                  size="xs"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "all", label: <>All <span className="text-fg-3">{SEC_USER_EVENTS.length}</span></> },
                    { value: "flagged", label: <>Flagged <span className="text-fg-3">{flaggedCount}</span></> },
                    { value: "failed", label: <>Failed <span className="text-fg-3">{failedCount}</span></> },
                    { value: "money", label: "Money & API" },
                  ]}
                />
              }
            />
          </div>
        </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="Login geography" subtitle="Unique client logins by country · 24h" action={<Chip tone="warn">3 countries outside KYC residence</Chip>} />
            <div className="grid grid-cols-1 gap-4 px-4 pb-5 pt-2 sm:px-6 lg:grid-cols-[minmax(0,1fr)_220px]">
              <WorldMap pins={SEC_USER_STATS.geo.map((g, i) => ({ ...g, tone: i < 3 ? "ember" : "gold" }))} />
              <div className="space-y-1.5 self-center">
                {SEC_USER_STATS.geo.slice(0, 7).map((g) => (
                  <div key={g.country} className="flex items-center gap-2.5 text-[12.5px]">
                    <Flag country={g.country} className="size-4" />
                    <span className="flex-1 truncate text-fg-2">{g.label}</span>
                    <span className="k-num font-medium">{g.count.toLocaleString("en-US")}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <Card className="flex h-full flex-col">
            <CardHeader title="Devices & platforms" subtitle={`${SEC_USER_STATS.uniqueDevices.toLocaleString("en-US")} unique devices`} />
            <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 pb-6 pt-4">
              <Donut
                data={deviceMix}
                size={170}
                thickness={18}
                center={
                  <div className="text-center">
                    <div className="k-num text-[22px] font-semibold">54%</div>
                    <div className="text-[11px] text-fg-3">mobile app</div>
                  </div>
                }
              />
              <div className="grid w-full grid-cols-2 gap-2">
                {deviceMix.map((d) => (
                  <div key={d.label} className="k-row flex items-center gap-2 px-3 py-2 text-[12px]">
                    <span className="size-2 rounded-full" style={{ background: d.color }} />
                    <span className="flex-1 truncate text-fg-2">{d.label}</span>
                    <span className="k-num font-medium">{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
