"use client";

import * as React from "react";
import { IS_DEMO as DEMO_BUILD } from "@ezymex/mock/mode";
import { LiveSecurity } from "@/components/security/live-security";
import { KeyRound, Laptop, LogOut, Mail, MonitorSmartphone, ShieldCheck, Smartphone, Globe2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, Field, Flag, Icon3D, Input, PageHeader, Reveal, Toggle, type Column } from "@/components/kit";
import { OtpInput, PasswordStrength } from "@/components/auth";
import { useT } from "@ezymex/i18n/react";

const SESSIONS = [
  { id: "s1", device: "MacBook Pro · Chrome 131", icon: Laptop, ip: "103.21.58.14", location: "Mumbai, IN", country: "in", lastMin: 0, current: true },
  { id: "s2", device: "iPhone 16 Pro · Ezymex PWA", icon: Smartphone, ip: "103.21.58.90", location: "Mumbai, IN", country: "in", lastMin: 12 },
  { id: "s3", device: "Windows 11 · Edge", icon: MonitorSmartphone, ip: "94.200.12.7", location: "Dubai, AE", country: "ae", lastMin: 3 * 1440 },
];

type LoginRow = { time: string; ip: string; location: string; country: string; device: string; result: "success" | "otp" | "failed" };
const LOGINS: LoginRow[] = [
  { time: "24 Sep, 21:40", ip: "103.21.58.14", location: "Mumbai", country: "in", device: "Chrome · macOS", result: "success" },
  { time: "24 Sep, 09:12", ip: "103.21.58.90", location: "Mumbai", country: "in", device: "Ezymex PWA · iOS", result: "success" },
  { time: "21 Sep, 18:03", ip: "94.200.12.7", location: "Dubai", country: "ae", device: "Edge · Windows", result: "otp" },
  { time: "21 Sep, 18:01", ip: "94.200.12.7", location: "Dubai", country: "ae", device: "Edge · Windows", result: "failed" },
  { time: "18 Sep, 11:47", ip: "103.21.58.14", location: "Mumbai", country: "in", device: "Chrome · macOS", result: "success" },
  { time: "15 Sep, 08:30", ip: "49.36.112.5", location: "Pune", country: "in", device: "Safari · iOS", result: "success" },
];

function DemoSecurityPage() {
  const t = useT();
  const ago = (m: number) => (m === 0 ? t("profile.security.activeNow") : m < 1440 ? t("profile.security.minAgo", { count: m }) : t("profile.security.daysAgo", { count: Math.floor(m / 1440) }));
  const [pw, setPw] = React.useState("");
  const [alerts, setAlerts] = React.useState({ login: true, withdraw: true, device: true });
  const cols: Column<LoginRow>[] = [
    { key: "time", header: t("profile.security.col.time"), cell: (r) => <span className="k-num text-fg-2">{r.time}</span> },
    { key: "ip", header: t("profile.security.col.ip"), cell: (r) => <span dir="ltr" className="font-mono text-[12.5px]">{r.ip}</span> },
    { key: "loc", header: t("profile.security.col.location"), cell: (r) => <span className="flex items-center gap-2"><Flag country={r.country} className="size-4" />{r.location}</span> },
    { key: "dev", header: t("profile.security.col.device"), cell: (r) => <span className="text-fg-2">{r.device}</span>, hideOn: "md" },
    { key: "res", header: t("profile.security.col.result"), align: "right", cell: (r) => (r.result === "success" ? <Chip tone="up" dot>{t("profile.security.result.success")}</Chip> : r.result === "otp" ? <Chip tone="info" dot>{t("profile.security.result.otp")}</Chip> : <Chip tone="down" dot>{t("profile.security.result.failed")}</Chip>) },
  ];
  return (
    <div>
      <PageHeader title={t("profile.security.title")} subtitle={t("profile.security.subtitle")} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Reveal className="xl:col-span-1">
          <Card hot className="h-full overflow-hidden">
            <div className="relative p-6">
              <Icon3D name="shield" size={72} />
              <div className="mt-4 k-label">{t("profile.security.score")}</div>
              <div className="k-num mt-1 text-[40px] font-semibold leading-none">82<span className="text-fg-3 text-xl">/100</span></div>
              <p className="mt-2 text-sm text-fg-2">{t("profile.security.scoreHint")}</p>
              <div className="mt-5 space-y-2 text-[13px]">
                {([
                  ["profile.security.check.password", true],
                  ["profile.security.check.otp", true],
                  ["profile.security.check.phone", true],
                  ["profile.security.check.kyc", false],
                ] as const).map(([k, ok]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-fg-2">{t(k)}</span>
                    {ok ? <Chip size="sm" tone="up">{t("common.done")}</Chip> : <Chip size="sm" tone="warn">{t("common.pending")}</Chip>}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.05} className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader title={t("profile.security.passwordVerification")} icon={<KeyRound />} />
            <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
              <div className="k-row p-5">
                <div className="text-sm font-medium">{t("profile.security.clientPassword")}</div>
                <p className="mt-1 text-[13px] text-fg-3">{t("profile.security.lastChanged", { count: 41 })}</p>
                <Dialog
                  title={t("profile.password.title")}
                  description={t("profile.security.changeDescription")}
                  trigger={
                    <Button size="sm" variant="surface" className="mt-4">
                      {t("profile.password.title")}
                    </Button>
                  }
                  footer={<Button variant="ember" onClick={() => toast.success(t("profile.security.passwordUpdated"), { description: t("profile.security.passwordUpdatedHint") })}>{t("profile.security.updatePassword")}</Button>}
                >
                  <div className="space-y-4">
                    <Field label={t("profile.password.current")}>
                      <Input type="password" />
                    </Field>
                    <Field label={t("profile.password.new")}>
                      <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
                      <PasswordStrength value={pw} />
                    </Field>
                    <Field label={t("profile.security.emailCode")}>
                      <div dir="ltr"><OtpInput /></div>
                    </Field>
                  </div>
                </Dialog>
              </div>
              <div className="k-row p-5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{t("profile.security.otpTitle")}</div>
                  <Chip tone="up" dot>
                    {t("common.on")}
                  </Chip>
                </div>
                <p className="mt-1 text-[13px] text-fg-3">{t("profile.security.otpHint")}</p>
                <div className="mt-4 flex items-center gap-2 text-[13px] text-fg-2">
                  <Mail className="size-4" /> a•••••@mail.com
                </div>
              </div>
              <div className="k-row p-5 md:col-span-2">
                <div className="text-sm font-medium">{t("profile.security.alerts")}</div>
                <div className="mt-3 divide-y divide-line">
                  {(
                    [
                      ["login", "profile.security.alert.login"],
                      ["withdraw", "profile.security.alert.withdraw"],
                      ["device", "profile.security.alert.device"],
                    ] as const
                  ).map(([k, labelKey]) => (
                    <div key={k} className="flex items-center justify-between py-3 text-[13.5px]">
                      <span className="text-fg-2">{t(labelKey)}</span>
                      <Toggle checked={alerts[k]} onChange={(v) => { setAlerts((a) => ({ ...a, [k]: v })); toast.success(t("profile.security.preferenceSaved")); }} label={t(labelKey)} />
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
            title={t("profile.security.sessions")}
            subtitle={t("profile.security.sessionsHint")}
            icon={<Globe2 />}
            action={
              <Button size="sm" variant="down-outline" onClick={() => toast.success(t("profile.security.signedOutOthers", { count: 2 }))}>
                <LogOut /> {t("profile.security.signOutOthers")}
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
                  {s.current ? <Chip tone="up" dot>{t("profile.security.thisDevice")}</Chip> : <Button size="xs" variant="ghost" onClick={() => toast.success(t("profile.security.signedOutDevice", { device: s.device }))}>{t("profile.security.signOut")}</Button>}
                </div>
                <div className="mt-3 text-sm font-medium">{s.device}</div>
                <div className="mt-1 flex items-center gap-2 text-[12.5px] text-fg-3">
                  <Flag country={s.country} className="size-3.5" />
                  {s.location} · <span dir="ltr" className="font-mono">{s.ip}</span>
                </div>
                <div className="mt-1 text-[12px] text-fg-3">{ago(s.lastMin)}</div>
              </div>
            ))}
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.15}>
        <Card className="mt-4">
          <CardHeader title={t("profile.security.history")} subtitle={t("profile.security.historyHint")} icon={<ShieldCheck />} />
          <div className="p-4 sm:p-6">
            <DataTable columns={cols} rows={LOGINS} exportName="login-history" />
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

export default function SecurityPage() {
  return DEMO_BUILD ? <DemoSecurityPage /> : <LiveSecurity />;
}
