"use client";

import * as React from "react";
import { Archive, Clock, FlaskConical, RefreshCw, RotateCcw, Save, TrendingUp, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, KpiCard, PageHeader, Progress, Reveal, Segmented, Toggle, cn } from "@ezymex/ui";
import { PEOPLE } from "@ezymex/mock";
import { ADMIN_GROUPS, ALL_LEVERAGES, DEMO_DAILY, DEMO_RULES, DEMO_STATS } from "@ezymex/mock/admin-config";
import { PersonCell, ChipList, ColumnChart, MiniField, NumInput, Section, Select, SettingRow, Slider, auditToast, useReason } from "@/components/config/kit";

type Rules = typeof DEMO_RULES;

function money(v: number) {
  return v >= 1000 ? `$${v / 1000}K` : `$${v}`;
}

export default function DemoRulesPage() {
  const [r, setR] = React.useState<Rules>(DEMO_RULES);
  const [saved, setSaved] = React.useState<Rules>(DEMO_RULES);
  const [customBal, setCustomBal] = React.useState(250000);
  const reason = useReason();
  const dirty = JSON.stringify(r) !== JSON.stringify(saved);
  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => setR((p) => ({ ...p, [k]: v }));
  const balanceOptions = Array.from(new Set([...DEMO_RULES.balances, 500, 2500, 250000, ...r.balances])).sort((a, b) => a - b);
  const maxGroup = Math.max(...DEMO_STATS.byBalance.map((b) => b.value));

  return (
    <div className="pb-16">
      <PageHeader
        title="Demo rules"
        subtitle="Starting balances, refills, expiry and archiving for demo accounts on Ezymex-Demo."
        actions={
          <>
            <Button
              variant="surface"
              onClick={() =>
                reason.ask({
                  title: "Archive all expired demos now?",
                  description: "2,906 demos expire in the next 24h. This runs the archive job immediately instead of at 03:00 GMT+3.",
                  reasons: ["Server housekeeping", "Database size alert", "Before maintenance window"],
                  confirmLabel: "Run archive job",
                  onConfirm: (why) => auditToast("Archive job started", `${why} · ETA 4 min`),
                })
              }
            >
              <Archive /> Run archive job
            </Button>
            <Button variant="ghost" disabled={!dirty} onClick={() => setR(saved)}>
              <RotateCcw /> Discard
            </Button>
            <Button
              variant="ember"
              disabled={!dirty}
              onClick={() => {
                setSaved(r);
                auditToast("Demo rules saved", "Applies to demos opened from now; existing expiries unchanged");
              }}
            >
              <Save /> Save rules
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active demos" icon={<FlaskConical />} value={<span className="k-num">{DEMO_STATS.active.toLocaleString()}</span>} chip={`Avg lifetime ${DEMO_STATS.avgLifetimeDays} days`} />
        <KpiCard label="Created today" icon={<UserPlus />} value={<span className="k-num">{DEMO_STATS.createdToday.toLocaleString()}</span>} chip={`${DEMO_STATS.refillsToday.toLocaleString()} refills today`} chipTone="info" delay={0.05} />
        <KpiCard label="Expiring in 24h" icon={<Clock />} value={<span className="k-num">{DEMO_STATS.expiring24h.toLocaleString()}</span>} chip="Email + push nudge sent at T-24h" chipTone="warn" delay={0.1} />
        <KpiCard label="Demo → live" icon={<TrendingUp />} value={<span className="k-num">{DEMO_STATS.conversionPct}%</span>} chip="+0.6 pts vs last month" chipTone="up" hot illustration="rocket" href="/analytics/funnel" delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-5">
          <Card className="h-full">
            <CardHeader title="Rules" subtitle={dirty ? <span className="text-ember">Unsaved changes</span> : `Server ${r.server}`} />
            <div className="px-6 pb-6 pt-4">
              <Section title="Starting balance" hint="Options clients can pick when opening a demo">
                <ChipList values={r.balances} onChange={(v) => set("balances", v as number[])} options={balanceOptions} format={money} />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <MiniField label="Default">
                    <Select value={String(r.defaultBalance)} onChange={(v) => set("defaultBalance", +v)} options={r.balances.map((b) => ({ value: String(b), label: money(b) }))} />
                  </MiniField>
                  <MiniField label="Add custom option">
                    <div className="flex gap-2">
                      <NumInput value={customBal} onChange={setCustomBal} prefix="$" step={1000} min={100} />
                      <Button size="sm" variant="surface" className="h-10" onClick={() => !r.balances.includes(customBal) && set("balances", [...r.balances, customBal].sort((a, b) => a - b))}>
                        Add
                      </Button>
                    </div>
                  </MiniField>
                </div>
              </Section>

              <Section title="Refills">
                <div className="grid grid-cols-2 gap-3">
                  <MiniField label="Refills per day">
                    <NumInput value={r.refillsPerDay} onChange={(v) => set("refillsPerDay", Math.round(v))} min={0} max={20} stepper />
                  </MiniField>
                  <MiniField label="Refill mode">
                    <Segmented value={r.refillMode} onChange={(v) => set("refillMode", v)} options={[{ value: "reset", label: "Reset" }, { value: "top-up", label: "Top-up" }]} />
                  </MiniField>
                </div>
                <p className="mt-2 text-[11.5px] text-fg-3">{r.refillMode === "reset" ? "Closes positions and resets balance to the starting amount." : "Adds the starting amount on top of the current balance (open positions kept)."}</p>
              </Section>

              <Section title="Expiry & archiving">
                <div className="mb-2 flex items-center justify-between text-[12px]">
                  <span className="font-medium text-fg-2">Expires after inactivity</span>
                  <span className="k-num font-semibold text-ember">{r.expiryDays} days</span>
                </div>
                <Slider value={r.expiryDays} onChange={(v) => set("expiryDays", v)} min={1} max={90} suffix="d" marks={[5, 10, 30, 60, 90]} />
                <SettingRow label="Extend on activity" hint="Each trade resets the expiry clock">
                  <Toggle checked={r.extendOnActivity} onChange={(v) => set("extendOnActivity", v)} />
                </SettingRow>
                <SettingRow label="Auto-archive expired demos" hint="Hidden from the client, kept for analytics">
                  <Toggle checked={r.autoArchive} onChange={(v) => set("autoArchive", v)} />
                </SettingRow>
                <div className={cn("grid grid-cols-2 gap-3 transition-opacity", !r.autoArchive && "pointer-events-none opacity-40")}>
                  <MiniField label="Archive after">
                    <NumInput value={r.archiveAfterDays} onChange={(v) => set("archiveAfterDays", v)} suffix="days" min={1} />
                  </MiniField>
                  <MiniField label="Hard delete after">
                    <NumInput value={r.deleteAfterDays} onChange={(v) => set("deleteAfterDays", v)} suffix="days" min={r.archiveAfterDays} />
                  </MiniField>
                </div>
              </Section>

              <Section title="Limits & groups">
                <div className="grid grid-cols-2 gap-3">
                  <MiniField label="Max demos per client">
                    <NumInput value={r.maxPerClient} onChange={(v) => set("maxPerClient", Math.round(v))} min={1} max={20} stepper />
                  </MiniField>
                  <MiniField label="Demo server">
                    <Select value={r.server} onChange={(v) => set("server", v)} options={["Ezymex-Demo", "Ezymex-Demo02"]} />
                  </MiniField>
                </div>
                <div className="mt-3 space-y-3">
                  <MiniField label="Leverage options">
                    <ChipList values={r.leverages} onChange={(v) => set("leverages", v as number[])} options={ALL_LEVERAGES} format={(v) => `1:${v}`} />
                  </MiniField>
                  <MiniField label="Groups available as demo">
                    <ChipList values={r.groups} onChange={(v) => set("groups", v)} options={ADMIN_GROUPS.map((g) => g.id)} format={(id) => ADMIN_GROUPS.find((g) => g.id === id)!.name} />
                  </MiniField>
                </div>
                <SettingRow label="Nudge to live" hint="Show “Open live account” after 5 profitable demo days">
                  <Toggle checked={r.nudgeToLive} onChange={(v) => set("nudgeToLive", v)} />
                </SettingRow>
              </Section>
            </div>
          </Card>
        </Reveal>

        <div className="flex flex-col gap-4 xl:col-span-7">
          <Reveal delay={0.05}>
            <Card>
              <CardHeader
                title="Demo activity"
                subtitle="Last 30 days · created vs converted to live"
                action={
                  <Button size="sm" variant="surface" onClick={() => toast.success("demo-activity.csv exported", { description: "30 rows" })}>
                    Export
                  </Button>
                }
              />
              <div className="px-4 pb-5 pt-3 sm:px-6">
                <ColumnChart
                  data={DEMO_DAILY.map((d) => ({ label: d.label, values: [d.created - d.converted, d.converted] }))}
                  series={[
                    { label: "Created", tone: "fg3" },
                    { label: "Converted to live", tone: "ember" },
                  ]}
                  height={250}
                  labelEvery={3}
                />
              </div>
            </Card>
          </Reveal>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Reveal delay={0.1}>
              <Card className="h-full">
                <CardHeader title="By starting balance" subtitle="Active demos" />
                <div className="space-y-3 px-6 pb-6 pt-4">
                  {DEMO_STATS.byBalance.map((b) => (
                    <div key={b.label}>
                      <div className="mb-1 flex justify-between text-[12.5px]">
                        <span className="text-fg-2">{b.label}</span>
                        <span className="k-num">{b.value.toLocaleString()}</span>
                      </div>
                      <Progress value={(b.value / maxGroup) * 100} tone={b.label === "$10K" ? "ember" : "gold"} />
                    </div>
                  ))}
                </div>
              </Card>
            </Reveal>
            <Reveal delay={0.15}>
              <Card className="h-full">
                <CardHeader title="By group" subtitle="Where demo traders practise" />
                <div className="space-y-2 px-6 pb-6 pt-4">
                  {DEMO_STATS.byGroup.map((g) => (
                    <div key={g.label} className="k-row flex items-center justify-between px-4 py-2.5 text-[13px]">
                      <span className="font-medium">{g.label}</span>
                      <span className="flex items-center gap-2">
                        <span className="k-num">{g.value.toLocaleString()}</span>
                        <Chip size="sm">{((g.value / DEMO_STATS.active) * 100).toFixed(0)}%</Chip>
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 text-[11.5px] text-fg-3">
                    <span>Archived last 30d: {DEMO_STATS.archived30d.toLocaleString()}</span>
                    <button className="inline-flex items-center gap-1 hover:text-fg" onClick={() => toast.success("Stats refreshed", { description: "Ezymex-Demo · 38,214 active" })}>
                      <RefreshCw className="size-3" /> Refresh
                    </button>
                  </div>
                </div>
              </Card>
            </Reveal>
          </div>
          <Reveal delay={0.2}>
            <Card>
              <CardHeader title="Expiring soon" subtitle="Demos inside the last 24h of their lifetime" action={<Chip tone="warn">{DEMO_STATS.expiring24h.toLocaleString()} total</Chip>} />
              <div className="k-fade-bottom mt-4 space-y-2 px-4 pb-5 sm:px-6">
                {PEOPLE.slice(3, 9).map((p, i) => {
                  const hrs = [2, 5, 7, 11, 16, 22][i]!;
                  return (
                    <div key={p.id} className="k-row flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <PersonCell name={p.name} photo={p.photo} country={p.country} sub={<span className="font-mono">{9002_2871 + i * 317} · {["Pro", "Standard", "ECN", "Pro", "Cent", "Standard"][i]} · ${[100, 10, 10, 50, 1, 25][i]}K</span>} size={28} />
                      </div>
                      <div className="hidden w-32 sm:block">
                        <div className="mb-1 flex justify-between text-[11px] text-fg-3">
                          <span>Expires</span>
                          <span className="k-num text-warn">{hrs}h</span>
                        </div>
                        <Progress value={100 - (hrs / 24) * 100} tone="warn" />
                      </div>
                      <Button size="xs" variant="surface" onClick={() => auditToast(`Demo ${9002_2871 + i * 317} extended by ${r.expiryDays} days`, p.name)}>
                        Extend
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
      {reason.node}
    </div>
  );
}
