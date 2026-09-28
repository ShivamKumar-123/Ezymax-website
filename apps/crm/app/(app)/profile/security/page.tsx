"use client";

import * as React from "react";
import { KeyRound, Laptop, LogOut, Mail, MonitorSmartphone, ShieldCheck, Smartphone, Globe2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, Field, Flag, Icon3D, Input, PageHeader, Reveal, Toggle, type Column } from "@kalks/ui";
import { OtpInput, PasswordStrength } from "@/components/auth";

const SESSIONS = [
  { id: "s1", device: "MacBook Pro · Chrome 131", icon: Laptop, ip: "103.21.58.14", location: "Mumbai, IN", country: "in", last: "Active now", current: true },
  { id: "s2", device: "iPhone 16 Pro · Kalks PWA", icon: Smartphone, ip: "103.21.58.90", location: "Mumbai, IN", country: "in", last: "12 min ago" },
  { id: "s3", device: "Windows 11 · Edge", icon: MonitorSmartphone, ip: "94.200.12.7", location: "Dubai, AE", country: "ae", last: "3 days ago" },
];

type LoginRow = { time: string; ip: string; location: string; country: string; device: string; result: "success" | "otp" | "failed" };
const LOGINS: LoginRow[] = [
  { time: "24 Sep, 21:40", ip: "103.21.58.14", location: "Mumbai", country: "in", device: "Chrome · macOS", result: "success" },
  { time: "24 Sep, 09:12", ip: "103.21.58.90", location: "Mumbai", country: "in", device: "Kalks PWA · iOS", result: "success" },
  { time: "21 Sep, 18:03", ip: "94.200.12.7", location: "Dubai", country: "ae", device: "Edge · Windows", result: "otp" },
  { time: "21 Sep, 18:01", ip: "94.200.12.7", location: "Dubai", country: "ae", device: "Edge · Windows", result: "failed" },
  { time: "18 Sep, 11:47", ip: "103.21.58.14", location: "Mumbai", country: "in", device: "Chrome · macOS", result: "success" },
  { time: "15 Sep, 08:30", ip: "49.36.112.5", location: "Pune", country: "in", device: "Safari · iOS", result: "success" },
];

export default function SecurityPage() {
  const [pw, setPw] = React.useState("");
  const [alerts, setAlerts] = React.useState({ login: true, withdraw: true, device: true });
  const cols: Column<LoginRow>[] = [
    { key: "time", header: "Time (GMT+3)", cell: (r) => <span className="k-num text-fg-2">{r.time}</span> },
    { key: "ip", header: "IP address", cell: (r) => <span className="font-mono text-[12.5px]">{r.ip}</span> },
    { key: "loc", header: "Location", cell: (r) => <span className="flex items-center gap-2"><Flag country={r.country} className="size-4" />{r.location}</span> },
    { key: "dev", header: "Device", cell: (r) => <span className="text-fg-2">{r.device}</span>, hideOn: "md" },
    { key: "res", header: "Result", align: "right", cell: (r) => (r.result === "success" ? <Chip tone="up" dot>Success</Chip> : r.result === "otp" ? <Chip tone="info" dot>New device · OTP</Chip> : <Chip tone="down" dot>Wrong password</Chip>) },
  ];
  return (
    <div>
      <PageHeader title="Security" subtitle="Password, verification codes, active sessions and login history." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Reveal className="xl:col-span-1">
          <Card hot className="h-full overflow-hidden">
            <div className="relative p-6">
              <Icon3D name="shield" size={72} />
              <div className="mt-4 k-label">Security score</div>
              <div className="k-num mt-1 text-[40px] font-semibold leading-none">82<span className="text-fg-3 text-xl">/100</span></div>
              <p className="mt-2 text-sm text-fg-2">Complete KYC and review unknown devices to reach 100.</p>
              <div className="mt-5 space-y-2 text-[13px]">
                {[
                  ["Strong password", true],
                  ["Email OTP on sensitive actions", true],
                  ["Phone verified", true],
                  ["Identity verified (KYC)", false],
                ].map(([k, ok]) => (
                  <div key={k as string} className="flex items-center justify-between">
                    <span className="text-fg-2">{k}</span>
                    {ok ? <Chip size="sm" tone="up">Done</Chip> : <Chip size="sm" tone="warn">Pending</Chip>}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.05} className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader title="Password & verification" icon={<KeyRound />} />
            <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
              <div className="k-row p-5">
                <div className="text-sm font-medium">Client area password</div>
                <p className="mt-1 text-[13px] text-fg-3">Last changed 41 days ago</p>
                <Dialog
                  title="Change password"
                  description="We'll send a code to your email to confirm."
                  trigger={
                    <Button size="sm" variant="surface" className="mt-4">
                      Change password
                    </Button>
                  }
                  footer={<Button variant="ember" onClick={() => toast.success("Password updated", { description: "Other sessions were signed out." })}>Update password</Button>}
                >
                  <div className="space-y-4">
                    <Field label="Current password">
                      <Input type="password" />
                    </Field>
                    <Field label="New password">
                      <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
                      <PasswordStrength value={pw} />
                    </Field>
                    <Field label="Email code">
                      <OtpInput />
                    </Field>
                  </div>
                </Dialog>
              </div>
              <div className="k-row p-5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Email one-time codes</div>
                  <Chip tone="up" dot>
                    On
                  </Chip>
                </div>
                <p className="mt-1 text-[13px] text-fg-3">Required for new devices, withdrawals and password or credential changes.</p>
                <div className="mt-4 flex items-center gap-2 text-[13px] text-fg-2">
                  <Mail className="size-4" /> a•••••@mail.com
                </div>
              </div>
              <div className="k-row p-5 md:col-span-2">
                <div className="text-sm font-medium">Security alerts</div>
                <div className="mt-3 divide-y divide-line">
                  {(
                    [
                      ["login", "Email me on every new login"],
                      ["withdraw", "Email me when a withdrawal is requested"],
                      ["device", "Block logins from new countries until I confirm"],
                    ] as const
                  ).map(([k, label]) => (
                    <div key={k} className="flex items-center justify-between py-3 text-[13.5px]">
                      <span className="text-fg-2">{label}</span>
                      <Toggle checked={alerts[k]} onChange={(v) => { setAlerts((a) => ({ ...a, [k]: v })); toast.success("Preference saved"); }} label={label} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.1}>
        <Card className="mt-4">
          <CardHeader
            title="Active sessions"
            subtitle="Devices currently signed in to your account"
            icon={<Globe2 />}
            action={
              <Button size="sm" variant="down-outline" onClick={() => toast.success("Signed out of 2 other sessions")}>
                <LogOut /> Sign out others
              </Button>
            }
          />
          <div className="grid grid-cols-1 gap-3 p-6 md:grid-cols-3">
            {SESSIONS.map((s) => (
              <div key={s.id} className="k-row p-5">
                <div className="flex items-start justify-between">
                  <span className="grid size-10 place-items-center rounded-full border border-line bg-surface-3 text-fg-2">
                    <s.icon className="size-5" />
                  </span>
                  {s.current ? <Chip tone="up" dot>This device</Chip> : <Button size="xs" variant="ghost" onClick={() => toast.success(`Signed out ${s.device}`)}>Sign out</Button>}
                </div>
                <div className="mt-3 text-sm font-medium">{s.device}</div>
                <div className="mt-1 flex items-center gap-2 text-[12.5px] text-fg-3">
                  <Flag country={s.country} className="size-3.5" />
                  {s.location} · <span className="font-mono">{s.ip}</span>
                </div>
                <div className="mt-1 text-[12px] text-fg-3">{s.last}</div>
              </div>
            ))}
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.15}>
        <Card className="mt-4">
          <CardHeader title="Login history" subtitle="Last 30 days" icon={<ShieldCheck />} />
          <div className="p-4 sm:p-6">
            <DataTable columns={cols} rows={LOGINS} exportName="login-history" />
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
