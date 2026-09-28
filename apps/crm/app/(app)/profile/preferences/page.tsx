"use client";

import * as React from "react";
import { Bell, Clock, Languages, MonitorSmartphone, Moon, Sun, Mail } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Card, CardHeader, Flag, LANGUAGES, PageHeader, Reveal, Segmented, Toggle, cn } from "@kalks/ui";

const NOTIFS = [
  ["Order fills & SL/TP hits", true, true],
  ["Margin call & stop-out warnings", true, true],
  ["Deposits & withdrawals", true, true],
  ["Partner commissions & payouts", true, false],
  ["Copy / PAMM activity", true, false],
  ["Price alerts", true, false],
  ["Market news & daily AI brief", false, true],
  ["Promotions & contests", false, false],
] as const;

export default function PreferencesPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const [lang, setLang] = React.useState("en");
  const [tz, setTz] = React.useState<"server" | "local">("server");
  const [prefs, setPrefs] = React.useState(() => NOTIFS.map(([, e, i]) => ({ email: e, app: i })));
  return (
    <div>
      <PageHeader title="Preferences" subtitle="Language, appearance, time display and notifications." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Reveal>
          <Card className="h-full">
            <CardHeader title="Appearance" icon={<MonitorSmartphone />} />
            <div className="grid grid-cols-2 gap-3 p-6">
              {(["dark", "light"] as const).map((t) => (
                <button key={t} onClick={() => setTheme(t)} className={cn("overflow-hidden rounded-[16px] border text-left transition-colors", mounted && resolvedTheme === t ? "border-ember/60 ring-4 ring-ember/10" : "border-line hover:border-fg-3")}>
                  <div className={cn("h-24 p-3", t === "dark" ? "bg-[#07070a]" : "bg-[#f6f4f1]")}>
                    <div className={cn("h-3 w-16 rounded-full", t === "dark" ? "bg-white/15" : "bg-black/10")} />
                    <div className="mt-2 flex gap-1.5">
                      <div className={cn("h-10 flex-1 rounded-lg", t === "dark" ? "bg-[#111114]" : "bg-white")} />
                      <div className="h-10 w-8 rounded-lg bg-[#ff5a1f]" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium">
                    {t === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
                    {t === "dark" ? "Dark" : "Light"}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.05}>
          <Card className="h-full">
            <CardHeader title="Time display" icon={<Clock />} />
            <div className="p-6">
              <Segmented value={tz} onChange={(v) => { setTz(v); toast.success("Time display updated"); }} options={[{ value: "server", label: "Server time (GMT+3)" }, { value: "local", label: "My local time" }]} />
              <p className="mt-4 text-[13px] leading-relaxed text-fg-3">Statements, swaps and daily P&amp;L always use server time (New York close). This setting changes how times are displayed in the client area.</p>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.1}>
          <Card className="h-full">
            <CardHeader title="Language" subtitle={`${LANGUAGES.length} languages · RTL supported`} icon={<Languages />} />
            <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto p-6 pt-4">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLang(l.code);
                    document.documentElement.dir = "rtl" in l && l.rtl ? "rtl" : "ltr";
                    try { localStorage.setItem("kalks.lang", l.code); } catch {}
                    toast.success(`Language: ${l.name}`);
                  }}
                  className={cn("flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px]", lang === l.code ? "bg-ember-soft text-ember" : "text-fg-2 hover:bg-surface-3")}
                >
                  <Flag country={l.flag} className="size-4" />
                  <span className="truncate">{l.name}</span>
                </button>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.15}>
        <Card className="mt-4">
          <CardHeader title="Notifications" subtitle="Choose how we reach you" icon={<Bell />} />
          <div className="p-6 pt-4">
            <div className="grid grid-cols-[1fr_80px_80px] items-center gap-y-1 text-[13.5px]">
              <span className="text-xs uppercase tracking-wider text-fg-3">Event</span>
              <span className="flex items-center justify-center gap-1 text-xs uppercase tracking-wider text-fg-3"><Mail className="size-3" /> Email</span>
              <span className="flex items-center justify-center gap-1 text-xs uppercase tracking-wider text-fg-3"><Bell className="size-3" /> In-app</span>
              {NOTIFS.map(([label], i) => (
                <React.Fragment key={label}>
                  <span className="border-t border-line py-3 text-fg-2">{label}</span>
                  <span className="flex justify-center border-t border-line py-3">
                    <Toggle checked={prefs[i]!.email} onChange={(v) => setPrefs((p) => p.map((x, k) => (k === i ? { ...x, email: v } : x)))} label={`${label} email`} />
                  </span>
                  <span className="flex justify-center border-t border-line py-3">
                    <Toggle checked={prefs[i]!.app} onChange={(v) => setPrefs((p) => p.map((x, k) => (k === i ? { ...x, app: v } : x)))} label={`${label} in-app`} />
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
