"use client";

import * as React from "react";
import { toast } from "sonner";
import { Ban, Globe2, MapPin, Plus, Radar, Search, ShieldAlert, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Chip, Dialog, Field, Flag, Input, PageHeader, Reveal, Segmented, Tabs, Toggle, WorldMap, cn, formatNumber } from "@ezymex/ui";
import { SET_ALL_COUNTRIES, SET_COUNTRY_RULES, type SetCountryRule } from "@ezymex/mock/admin-platform-settings";
import { ClientOnly } from "@/components/settings/kit";

const ENFORCE = [
  { id: "ipgeo", label: "IP geolocation blocking", desc: "MaxMind GeoIP2 City · database updated 22 Sep 2026", on: true },
  { id: "vpn", label: "VPN / proxy / Tor detection", desc: "Blocks sign-ups from anonymising networks", on: true },
  { id: "doc", label: "Match KYC document country", desc: "Reject IDs issued by blocked countries", on: true },
  { id: "phone", label: "Match phone number prefix", desc: "OTP not sent to blocked country codes", on: true },
  { id: "exit", label: "Allow existing clients to withdraw", desc: "Closing-only mode when a country is newly blocked", on: true },
] as const;

function Check({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors", on ? "border-down/30 bg-down-soft text-down" : "border-line text-fg-3 hover:text-fg-2")}
    >
      {on ? <Ban className="size-3" /> : <span className="size-1.5 rounded-full bg-up" />}
      {label}
    </button>
  );
}

export default function CountriesPage() {
  const [rules, setRules] = React.useState<SetCountryRule[]>(SET_COUNTRY_RULES);
  const [enforce, setEnforce] = React.useState<Record<string, boolean>>(() => Object.fromEntries(ENFORCE.map((e) => [e.id, e.on])));
  const [tab, setTab] = React.useState<"blocked" | "restricted">("blocked");
  const [open, setOpen] = React.useState(false);
  const [pick, setPick] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [level, setLevel] = React.useState<"blocked" | "restricted">("blocked");
  const [reason, setReason] = React.useState("");
  const [ip, setIp] = React.useState("");

  const blocked = rules.filter((r) => r.level === "blocked");
  const restricted = rules.filter((r) => r.level === "restricted");
  const list = tab === "blocked" ? blocked : restricted;
  const attempts = rules.reduce((s, r) => s + r.attempts30d, 0);
  const available = SET_ALL_COUNTRIES.filter(([c, n]) => !rules.some((r) => r.code === c) && n.toLowerCase().includes(q.toLowerCase()));

  const toggle = (code: string, k: "signup" | "login" | "deposits") => {
    setRules((rs) => rs.map((r) => (r.code === code ? { ...r, [k]: !r[k] } : r)));
    const r = rules.find((x) => x.code === code)!;
    toast.success(`${r.name}: ${k} ${r[k] ? "allowed" : "blocked"}`);
  };

  const testIp = () => {
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
      toast.error("Enter a valid IPv4 address");
      return;
    }
    const last = Number(ip.split(".")[0]);
    const hit = last % 3 === 0 ? { c: "United States", b: true } : last % 3 === 1 ? { c: "United Arab Emirates", b: false } : { c: "India", b: false };
    if (hit.b) toast.error(`${ip} → ${hit.c}`, { description: "Blocked · sign-up, login and deposits" });
    else toast.success(`${ip} → ${hit.c}`, { description: "Allowed · no restrictions" });
  };

  return (
    <div className="pb-16">
      <PageHeader
        title="Countries"
        subtitle="Blocked and restricted jurisdictions, enforced at sign-up, login and deposit by IP geolocation, KYC document and phone prefix."
        actions={
          <Button variant="ember" onClick={() => setOpen(true)}>
            <Plus /> Add country
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader
              icon={<Globe2 />}
              title="Blocked access attempts · 30 days"
              subtitle="Pins sized by attempts from each blocked jurisdiction"
              action={
                <Chip tone="down" dot>
                  {formatNumber(attempts, 0)} blocked
                </Chip>
              }
            />
            <div className="px-4 pt-2 sm:px-6">
              <ClientOnly fallback={<div className="aspect-[2/1] w-full" />}>
                <WorldMap pins={rules.map((r) => ({ country: r.code, count: r.level === "blocked" ? Math.max(1, r.attempts30d) : 1, label: r.name, tone: r.level === "blocked" ? ("down" as const) : ("gold" as const) }))} />
              </ClientOnly>
            </div>
            <div className="grid grid-cols-2 gap-3 px-6 pb-6 pt-2 sm:grid-cols-4">
              {[
                ["Blocked", blocked.length, "text-down"],
                ["Restricted (EDD)", restricted.length, "text-gold"],
                ["VPN blocks 30d", 624, "text-fg"],
                ["Top source", "US · 1,842", "text-fg"],
              ].map(([k, v, c]) => (
                <div key={k as string} className="k-row px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wider text-fg-3">{k}</div>
                  <div className={cn("k-num mt-1 text-[17px] font-semibold", c as string)}>{typeof v === "number" ? formatNumber(v, 0) : v}</div>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.05} className="xl:col-span-4">
          <Card className="flex h-full flex-col">
            <CardHeader icon={<Radar />} title="Enforcement" subtitle="How blocks are detected" />
            <div className="mt-2 flex-1 divide-y divide-line px-6">
              {ENFORCE.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium">{e.label}</div>
                    <div className="text-[12px] text-fg-3">{e.desc}</div>
                  </div>
                  <Toggle
                    checked={!!enforce[e.id]}
                    onChange={(v) => {
                      setEnforce((s) => ({ ...s, [e.id]: v }));
                      if (e.id === "ipgeo" && !v) toast.warning("IP-geo blocking disabled", { description: "Only KYC document and phone checks remain" });
                      else toast.success(`${e.label} ${v ? "enabled" : "disabled"}`);
                    }}
                    label={e.label}
                  />
                </div>
              ))}
            </div>
            <div className="border-t border-line px-6 py-4">
              <div className="mb-2 text-[12.5px] font-medium text-fg-2">Test an IP address</div>
              <div className="flex gap-2">
                <Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="e.g. 104.28.12.9" inputClassName="font-mono text-[13px]" className="h-10 flex-1" leading={<MapPin />} onKeyDown={(e) => e.key === "Enter" && testIp()} />
                <Button size="sm" variant="surface" className="h-10" onClick={testIp}>
                  Check
                </Button>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.05}>
        <Card className="mt-4">
          <div className="px-6 pt-5">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "blocked", label: "Blocked", count: blocked.length },
                { value: "restricted", label: "Restricted · enhanced due diligence", count: restricted.length },
              ]}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 sm:p-6 lg:grid-cols-2">
            {list.map((r) => (
              <div key={r.code} className="k-row flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Flag country={r.code} className="size-9" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium">{r.name}</span>
                      <span className="font-mono text-[11px] uppercase text-fg-3">{r.code}</span>
                    </div>
                    <div className="truncate text-[12px] text-fg-3">{r.reason}</div>
                    <div className="mt-0.5 text-[11px] text-fg-3">
                      Added {r.added} · {r.addedBy}
                    </div>
                  </div>
                </div>
                {r.level === "blocked" ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Check on={r.signup} label="Sign-up" onClick={() => toggle(r.code, "signup")} />
                    <Check on={r.login} label="Login" onClick={() => toggle(r.code, "login")} />
                    <Check on={r.deposits} label="Deposits" onClick={() => toggle(r.code, "deposits")} />
                  </div>
                ) : (
                  <Chip tone="gold">
                    <ShieldAlert className="size-3" /> EDD required
                  </Chip>
                )}
                <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
                  <span className="k-num text-[13px] font-medium">{r.attempts30d ? formatNumber(r.attempts30d, 0) : "—"}</span>
                  <span className="text-[10.5px] text-fg-3">attempts</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRules((rs) => rs.filter((x) => x.code !== r.code));
                    toast.success(`${r.name} removed`, { description: "Change logged · takes effect within 60 seconds" });
                  }}
                  className="grid size-8 shrink-0 place-items-center self-end rounded-full text-fg-3 transition-colors hover:bg-down-soft hover:text-down sm:self-auto"
                  aria-label={`Remove ${r.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      </Reveal>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Add country rule"
        description="Blocks apply within 60 seconds to new sessions."
        width={560}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="ember"
              disabled={!pick}
              onClick={() => {
                const c = SET_ALL_COUNTRIES.find(([k]) => k === pick)!;
                setRules((rs) => [
                  ...rs,
                  { code: c[0], name: c[1], level, reason: reason || (level === "blocked" ? "Compliance decision" : "EDD required"), signup: level === "blocked", login: false, deposits: level === "blocked", attempts30d: 0, addedBy: "Priya Nair", added: "2026-09-24" },
                ]);
                setTab(level);
                setOpen(false);
                setPick(null);
                setReason("");
                toast.success(`${c[1]} ${level === "blocked" ? "blocked" : "restricted"}`, { description: "Logged to the admin audit trail" });
              }}
            >
              {level === "blocked" ? "Block country" : "Restrict country"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Segmented
            value={level}
            onChange={setLevel}
            options={[
              { value: "blocked", label: "Block" },
              { value: "restricted", label: "Restrict (EDD)" },
            ]}
          />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search countries…" leading={<Search />} />
          <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
            {available.map(([c, n]) => (
              <button
                key={c}
                type="button"
                onClick={() => setPick(c)}
                className={cn("flex items-center gap-2.5 rounded-[12px] border px-3 py-2 text-left text-[13px] transition-colors", pick === c ? "border-ember/40 bg-ember-soft text-fg" : "border-transparent text-fg-2 hover:bg-surface-2")}
              >
                <Flag country={c} className="size-5" />
                {n}
              </button>
            ))}
          </div>
          <Field label="Reason (shown in audit log)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. FATF grey list" />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
