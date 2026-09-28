"use client";

import { IS_DEMO } from "@kalks/mock/mode";
import { LiveSessions } from "@/components/live/sessions";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Clock3, KeyRound, Laptop, LogOut, MonitorSmartphone, ShieldAlert, ShieldCheck, Smartphone, Tablet, Timer, Usb } from "lucide-react";
import { Avatar, Button, Card, CardHeader, Chip, Dialog, DialogClose, Flag, KpiCard, PageHeader, Reveal, Segmented, Toggle, Tooltip, cn } from "@kalks/ui";
import { PEOPLE } from "@kalks/mock";
import { ORG_ROLE_META, SEC_SESSIONS, orgEmployee, type SecSession } from "@kalks/mock/admin-platform-security";
import { Mono, TenantDot, ago, timeGmt3, dayGmt3 } from "@/components/security/shared";

const MFA_LABEL = { hardware: "Security key", totp: "Authenticator", sms: "SMS", none: "None" } as const;

function DeviceGlyph({ d }: { d: SecSession["device"] }) {
  const I = d === "mobile" ? Smartphone : d === "tablet" ? Tablet : Laptop;
  return <I className="size-4" />;
}

function ConfirmLogout({ s, onConfirm }: { s: SecSession; onConfirm: () => void }) {
  const p = PEOPLE[s.staff]!;
  const [revoke, setRevoke] = React.useState(true);
  return (
    <Dialog
      title="Force logout"
      description="The session token is revoked immediately. Unsaved work in the Back Office is lost."
      width={460}
      trigger={
        <Button size="xs" variant="down-outline">
          <LogOut /> Force logout
        </Button>
      }
      footer={
        <>
          <DialogClose asChild>
            <Button size="sm" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              size="sm"
              variant="sell"
              onClick={() => {
                onConfirm();
                toast.success(`${p.name} logged out`, { description: `${s.deviceName} · ${s.ip}${revoke ? " · refresh tokens revoked" : ""} · recorded in audit log` });
              }}
            >
              <LogOut /> Log out now
            </Button>
          </DialogClose>
        </>
      }
    >
      <div className="k-row flex items-center gap-3 px-4 py-3">
        <Avatar src={p.photo} name={p.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium">{p.name}</div>
          <div className="text-[12px] text-fg-3">
            {s.deviceName} · {s.browser}
          </div>
        </div>
        <div className="text-right">
          <Mono className="block">{s.ip}</Mono>
          <span className="text-[11px] text-fg-3">{s.city}</span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-4 rounded-[14px] border border-line px-4 py-3">
        <div>
          <div className="text-[13px] font-medium">Also revoke refresh tokens</div>
          <div className="text-[12px] text-fg-3">Forces a full sign-in with 2FA on every device</div>
        </div>
        <Toggle checked={revoke} onChange={setRevoke} label="Revoke refresh tokens" />
      </div>
      {s.risk === "high" && (
        <div className="mt-3 flex items-start gap-2.5 rounded-[14px] border border-down/25 bg-down-soft px-4 py-3 text-[12.5px] text-fg-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-down" />
          <span>
            <span className="font-medium text-down">High-risk session.</span> {s.riskNote}. Consider suspending the account pending review.
          </span>
        </div>
      )}
    </Dialog>
  );
}

function SessionRow({ s, onKill }: { s: SecSession; onKill: () => void }) {
  const p = PEOPLE[s.staff]!;
  const emp = orgEmployee(s.staff);
  const role = ORG_ROLE_META[emp.role];
  const idleMin = Math.round((Date.parse("2026-09-24T14:32:00+03:00") - Date.parse(s.lastSeen)) / 60000);
  const live = idleMin < 5;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "k-row grid grid-cols-1 items-center gap-3 overflow-hidden px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_150px]",
        s.current && "border-ember/35 bg-ember-soft/40",
        s.risk === "high" && "border-down/30",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar src={p.photo} name={p.name} size={38} online={live} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-medium">{p.name}</span>
            {s.current && (
              <Chip size="sm" tone="ember" dot>
                This session
              </Chip>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <Chip size="sm" tone={role.tone}>
              {role.name}
            </Chip>
            <TenantDot tenant={s.tenant} />
          </div>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2">
          <DeviceGlyph d={s.device} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[12.5px]">{s.deviceName}</div>
          <div className="flex items-center gap-1.5 truncate text-[11px] text-fg-3">
            {s.browser}
            <span>·</span>
            <span className={cn(s.mfa === "sms" && "text-warn", s.mfa === "hardware" && "text-up")}>{MFA_LABEL[s.mfa]}</span>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2.5">
        <Flag country={s.country} className="size-4" />
        <div className="min-w-0">
          <Mono className="block text-fg">{s.ip}</Mono>
          <div className="truncate text-[11px] text-fg-3">{s.city}</div>
        </div>
      </div>

      <div className="text-[12px]">
        <div className="flex items-center gap-1.5 text-fg-2">
          <span className={cn("size-1.5 rounded-full", live ? "animate-pulse-dot bg-up" : "bg-fg-3")} />
          {live ? "Active now" : `Idle ${ago(s.lastSeen).replace(" ago", "")}`}
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-fg-3">
          since {s.started.startsWith("2026-09-24") ? "" : `${dayGmt3(s.started)} `}
          {timeGmt3(s.started, false)}
        </div>
      </div>

      <div className="flex items-center justify-start gap-2 md:justify-end">
        {s.risk !== "ok" && (
          <Tooltip content={s.riskNote}>
            <span className={cn("grid size-7 place-items-center rounded-full border", s.risk === "high" ? "border-down/30 bg-down-soft text-down" : "border-warn/30 bg-warn-soft text-warn")}>
              <ShieldAlert className="size-3.5" />
            </span>
          </Tooltip>
        )}
        {s.current ? (
          <Tooltip content="You can't force-logout your own current session">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line px-3 text-xs text-fg-3">
              <ShieldCheck className="size-3.5 text-up" /> Current
            </span>
          </Tooltip>
        ) : (
          <ConfirmLogout s={s} onConfirm={onKill} />
        )}
      </div>
    </motion.div>
  );
}

function DemoSessionsPage() {
  const [list, setList] = React.useState(SEC_SESSIONS);
  const [filter, setFilter] = React.useState<"all" | "mine" | "risk">("all");
  const [idle, setIdle] = React.useState<"15" | "30" | "60">("30");
  const [bind, setBind] = React.useState(true);
  const [single, setSingle] = React.useState(false);

  const view = list.filter((s) => (filter === "mine" ? s.staff === 4 : filter === "risk" ? s.risk !== "ok" : true));
  const mineOthers = list.filter((s) => s.staff === 4 && !s.current);
  const risky = list.filter((s) => s.risk !== "ok");
  const liveCount = list.filter((s) => Date.parse("2026-09-24T14:32:00+03:00") - Date.parse(s.lastSeen) < 5 * 60000).length;

  const logoutOthers = () => {
    const n = list.filter((s) => !s.current).length;
    setList((l) => l.filter((s) => s.current));
    toast.success(`${n} sessions terminated`, { description: "Every staff member except you must sign in again with 2FA" });
  };

  return (
    <div className="pb-16">
      <PageHeader
        title="Staff sessions"
        subtitle="Everyone signed in to the Back Office right now · server time GMT+3"
        actions={
          <>
            <Button
              variant="surface"
              disabled={mineOthers.length === 0}
              onClick={() => {
                setList((l) => l.filter((s) => !(s.staff === 4 && !s.current)));
                toast.success("Your other sessions were logged out", { description: `${mineOthers.length} device${mineOthers.length === 1 ? "" : "s"} signed out` });
              }}
            >
              <MonitorSmartphone /> Log out my other devices
            </Button>
            <Dialog
              title="Log out all other sessions?"
              description="Every staff member except you will be signed out immediately."
              width={440}
              trigger={
                <Button variant="ember">
                  <LogOut /> Log out all others
                </Button>
              }
              footer={
                <>
                  <DialogClose asChild>
                    <Button size="sm" variant="ghost">
                      Cancel
                    </Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button size="sm" variant="sell" onClick={logoutOthers}>
                      Log out {list.filter((s) => !s.current).length} sessions
                    </Button>
                  </DialogClose>
                </>
              }
            >
              <p className="text-[13px] text-fg-2">Use this during a security incident. Dealers with open manual orders will lose their pending quotes. The action is recorded in the immutable audit log with reason code <span className="font-mono text-fg">SEC-INCIDENT</span>.</p>
              <div className="mt-4 flex -space-x-2">
                {list
                  .filter((s) => !s.current)
                  .slice(0, 10)
                  .map((s) => (
                    <Avatar key={s.id} src={PEOPLE[s.staff]!.photo} name={PEOPLE[s.staff]!.name} size={30} className="rounded-full ring-2 ring-surface" />
                  ))}
              </div>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active sessions" icon={<MonitorSmartphone />} value={<span className="k-num">{list.length}</span>} chip={`${liveCount} active in last 5 min`} chipTone="up" />
        <KpiCard label="Staff online" icon={<Clock3 />} value={<span className="k-num">{new Set(list.map((s) => s.staff)).size}</span>} chip="of 23 employees" delay={0.05} />
        <KpiCard label="Needs attention" icon={<ShieldAlert />} value={<span className="k-num">{risky.length}</span>} chip={risky.length ? "VPN · weak 2FA · off-whitelist" : "All clear"} chipTone={risky.length ? "down" : "up"} delay={0.1} />
        <KpiCard label="Hardware-key sessions" icon={<Usb />} value={<span className="k-num">{Math.round((list.filter((s) => s.mfa === "hardware").length / Math.max(1, list.length)) * 100)}%</span>} chip="Target 80% by Q4" chipTone="gold" illustration="key" delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="min-w-0 xl:col-span-9">
          <Card>
            <CardHeader
              title="Live sessions"
              subtitle={`${view.length} shown · sorted by last activity`}
              action={
                <Segmented
                  size="xs"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "all", label: "All" },
                    { value: "mine", label: "Mine" },
                    { value: "risk", label: <>At risk <span className="text-down">{risky.length}</span></> },
                  ]}
                />
              }
            />
            <div className="mx-4 mt-4 hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_150px] gap-3 rounded-[14px] border border-line bg-surface-2 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.05em] text-fg-3 sm:mx-6 md:grid">
              <span>Staff · role</span>
              <span>Device · 2FA</span>
              <span>IP · location</span>
              <span>Last seen</span>
              <span className="text-right">Action</span>
            </div>
            <div className="mt-2 space-y-2 px-4 pb-5 sm:px-6">
              <AnimatePresence initial={false}>
                {[...view]
                  .sort((a, b) => (a.current ? -1 : b.current ? 1 : b.lastSeen.localeCompare(a.lastSeen)))
                  .map((s) => (
                    <SessionRow key={s.id} s={s} onKill={() => setList((l) => l.filter((x) => x.id !== s.id))} />
                  ))}
              </AnimatePresence>
              {view.length === 0 && <div className="py-10 text-center text-[13px] text-fg-3">No sessions match this filter.</div>}
            </div>
          </Card>
        </Reveal>

        <div className="flex flex-col gap-4 xl:col-span-3">
          <Reveal delay={0.15}>
            <Card>
              <CardHeader title="Session policy" subtitle="Applies to all staff" icon={<Timer />} />
              <div className="space-y-4 px-5 pb-5 pt-4">
                <div>
                  <div className="mb-2 text-[12.5px] font-medium text-fg-2">Idle timeout</div>
                  <Segmented size="xs" value={idle} onChange={(v) => { setIdle(v); toast.success(`Idle timeout set to ${v} minutes`); }} options={[{ value: "15", label: "15m" }, { value: "30", label: "30m" }, { value: "60", label: "60m" }]} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-medium">Bind session to IP</div>
                    <div className="text-[11.5px] text-fg-3">Re-auth if the IP changes</div>
                  </div>
                  <Toggle checked={bind} onChange={(v) => { setBind(v); toast.success(v ? "IP binding enabled" : "IP binding disabled"); }} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-medium">Single session per user</div>
                    <div className="text-[11.5px] text-fg-3">New login ends the previous one</div>
                  </div>
                  <Toggle checked={single} onChange={(v) => { setSingle(v); toast.success(v ? "Single-session mode on" : "Single-session mode off"); }} />
                </div>
                <div className="k-row flex items-center justify-between px-3.5 py-2.5 text-[12px]">
                  <span className="text-fg-3">Max session length</span>
                  <span className="k-num font-medium">12 h</span>
                </div>
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.2}>
            <Card>
              <CardHeader title="Recent sign-ins" subtitle="Last 24 hours" icon={<KeyRound />} />
              <div className="mt-3 space-y-1 px-5 pb-5">
                {[...SEC_SESSIONS]
                  .sort((a, b) => b.started.localeCompare(a.started))
                  .slice(0, 6)
                  .map((s) => (
                    <div key={s.id} className="flex items-center gap-2.5 border-b border-line py-2 text-[12px] last:border-0">
                      <Avatar src={PEOPLE[s.staff]!.photo} name={PEOPLE[s.staff]!.name} size={24} />
                      <span className="min-w-0 flex-1 truncate text-fg-2">{PEOPLE[s.staff]!.name.split(" ")[0]}</span>
                      <Flag country={s.country} className="size-3.5" />
                      <span className="w-12 text-right font-mono text-[11px] text-fg-3">{timeGmt3(s.started, false)}</span>
                    </div>
                  ))}
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.25}>
            <Card>
              <CardHeader title="Second factor in use" subtitle="Across live sessions" />
              <div className="space-y-3 px-5 pb-5 pt-4">
                {(["hardware", "totp", "sms"] as const).map((m) => {
                  const n = list.filter((s) => s.mfa === m).length;
                  return (
                    <div key={m}>
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="text-fg-2">{MFA_LABEL[m]}</span>
                        <span className="k-num font-medium">{n}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <div className={cn("h-full rounded-full transition-all", m === "hardware" ? "bg-up" : m === "totp" ? "bg-gold" : "bg-warn")} style={{ width: `${(n / Math.max(1, list.length)) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
                <Button size="xs" variant="surface" className="w-full" onClick={() => toast.success("Reminder sent", { description: "2 staff on SMS 2FA asked to enrol a security key" })}>
                  <Usb /> Nudge SMS users to security keys
                </Button>
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

/** Live builds: real data from the gateway / market-data. Demo builds: the mock showcase above. */
export default function Page() {
  return IS_DEMO ? <DemoSessionsPage /> : <LiveSessions />;
}
