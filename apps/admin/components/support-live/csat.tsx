"use client";

import * as React from "react";
import { toast } from "sonner";
import { Save, Star } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, KpiCard, PageHeader, Segmented, Toggle, cn } from "@kalks/ui";
import { dur, errMsg, sapi, usePerms } from "./common";

type Stats = {
  days: number;
  slaFirstSecs: number;
  now: { bot: number; waiting: number; assigned: number; breached: number; longestWaitSecs: number; agentsOnline: number };
  period: { conversations: number; botOnly: number; handedOver: number; botContainmentPct: number | null; avgFirstResponseSecs: number | null; medianFirstResponseSecs: number | null; slaMetPct: number | null; breached: number; avgResolutionSecs: number | null; csatAvg: number | null; csatCount: number; csatPct: number | null; csatDistribution: number[] };
  series: { day: string; created: number; handedOver: number; resolved: number; csat: number | null }[];
  agents: { id: string; name: string | null; conversations: number; resolved: number; csat: number | null; ratings: number; avgFirstResponseSecs: number | null }[];
  recentRatings: { conversationId: number; client: string; rating: number; comment: string | null; at: string; agent: string | null; botOnly: boolean }[];
};
type Settings = { autopilot: boolean; botName: string; greeting: string; slaFirstSecs: number; slaReplySecs: number; botPerHour: number; emailReplies: boolean };

const pct = (v: number | null) => (v === null ? "–" : `${v}%`);

/** SLA + CSAT: live queue, first response vs SLA, AI containment, ratings, per-agent table and desk settings. */
export function LiveCsat() {
  const { can } = usePerms();
  const [days, setDays] = React.useState<"7" | "30" | "90">("30");
  const [s, setS] = React.useState<Stats | null>(null);
  const [cfg, setCfg] = React.useState<Settings | null>(null);
  const [ai, setAi] = React.useState<{ ai: boolean; model: string } | null>(null);
  React.useEffect(() => {
    void sapi<Stats>(`stats?days=${days}`).then((r) => r.ok && setS(r.data));
  }, [days]);
  React.useEffect(() => {
    void sapi<{ settings: Settings; ai: boolean; model: string }>("settings").then((r) => {
      if (r.ok) {
        setCfg(r.data.settings);
        setAi({ ai: r.data.ai, model: r.data.model });
      }
    });
  }, []);
  const save = async () => {
    if (!cfg) return;
    const r = await sapi<{ settings: Settings }>("settings", { method: "PUT", body: cfg });
    if (!r.ok) return toast.error("Not saved", { description: errMsg(r.data) });
    setCfg(r.data.settings);
    toast.success("Support settings saved");
  };
  const max = Math.max(1, ...(s?.series.map((x) => x.created) ?? [1]));
  const distMax = Math.max(1, ...(s?.period.csatDistribution ?? [1]));
  return (
    <div>
      <PageHeader title="SLA and CSAT" subtitle="Response times against the SLA, how much the AI resolves on its own, and client ratings." actions={<Segmented size="sm" value={days} onChange={setDays} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} />} />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="CSAT (avg of 5)" value={s?.period.csatAvg?.toFixed(2) ?? "–"} footer={<span className="text-[12px] text-fg-3">{s?.period.csatCount ?? 0} ratings · {pct(s?.period.csatPct ?? null)} 4-5 stars</span>} />
        <KpiCard label="First response" value={dur(s?.period.avgFirstResponseSecs)} footer={<span className="text-[12px] text-fg-3">SLA {dur(s?.slaFirstSecs)} · met {pct(s?.period.slaMetPct ?? null)}</span>} />
        <KpiCard label="Resolved by AI alone" value={pct(s?.period.botContainmentPct ?? null)} footer={<span className="text-[12px] text-fg-3">{s?.period.handedOver ?? 0} of {s?.period.conversations ?? 0} handed over</span>} />
        <KpiCard label="Queue now" value={`${s?.now.waiting ?? 0} waiting`} chip={s && s.now.breached > 0 ? `${s.now.breached} breached` : undefined} chipTone="down" footer={<span className="text-[12px] text-fg-3">{s?.now.bot ?? 0} with AI · {s?.now.assigned ?? 0} with agents · {s?.now.agentsOnline ?? 0} online</span>} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader title="Conversations per day" subtitle="Bar = new chats · darker part = handed over to agents" />
          <div className="flex h-44 items-end gap-1 px-6 pb-5 pt-4">
            {s?.series.map((d) => (
              <div key={d.day} className="group relative flex max-w-[36px] flex-1 flex-col justify-end" title={`${d.day}: ${d.created} chats, ${d.handedOver} handed over, CSAT ${d.csat?.toFixed(1) ?? "–"}`}>
                <div className="rounded-t bg-ember/25" style={{ height: `${((d.created - d.handedOver) / max) * 140}px` }} />
                <div className="bg-ember" style={{ height: `${(d.handedOver / max) * 140}px` }} />
              </div>
            ))}
            {s && s.series.length === 0 && <div className="w-full self-center text-center text-[13px] text-fg-3">No conversations in this period.</div>}
          </div>
        </Card>
        <Card className="xl:col-span-4">
          <CardHeader title="Rating distribution" />
          <div className="space-y-2 px-6 pb-6 pt-4">
            {[5, 4, 3, 2, 1].map((n) => {
              const v = s?.period.csatDistribution[n - 1] ?? 0;
              return (
                <div key={n} className="flex items-center gap-2 text-[12.5px]">
                  <span className="flex w-8 items-center gap-0.5 text-fg-2">{n}<Star className="size-3 fill-current text-gold" /></span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3"><div className={cn("h-full rounded-full", n >= 4 ? "bg-up" : n === 3 ? "bg-gold" : "bg-down")} style={{ width: `${(v / distMax) * 100}%` }} /></div>
                  <span className="k-num w-8 text-right text-fg-3">{v}</span>
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="xl:col-span-7">
          <CardHeader title="Agents" />
          <div className="overflow-x-auto px-3 pb-4 pt-3">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] uppercase tracking-wider text-fg-3">
                <tr><th className="px-3 py-2">Agent</th><th className="px-3 py-2 text-right">Chats</th><th className="px-3 py-2 text-right">Resolved</th><th className="px-3 py-2 text-right">First response</th><th className="px-3 py-2 text-right">CSAT</th></tr>
              </thead>
              <tbody>
                {s?.agents.map((a) => (
                  <tr key={a.id} className="border-t border-line">
                    <td className="px-3 py-2">{a.name ?? a.id}</td>
                    <td className="k-num px-3 py-2 text-right">{a.conversations}</td>
                    <td className="k-num px-3 py-2 text-right">{a.resolved}</td>
                    <td className="k-num px-3 py-2 text-right">{dur(a.avgFirstResponseSecs)}</td>
                    <td className="k-num px-3 py-2 text-right">{a.csat ? `${a.csat.toFixed(1)} (${a.ratings})` : "–"}</td>
                  </tr>
                ))}
                {s && s.agents.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-fg-3">No agent conversations yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader title="Latest ratings" />
          <div className="space-y-2 px-6 pb-6 pt-4">
            {s?.recentRatings.map((r) => (
              <div key={r.conversationId} className="rounded-xl border border-line px-3 py-2.5">
                <div className="flex items-center gap-2 text-[12.5px]">
                  <span className="flex">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cn("size-3", n <= r.rating ? "fill-current text-gold" : "text-fg-3")} />)}</span>
                  <span className="truncate">{r.client}</span>
                  <span className="ml-auto text-[11px] text-fg-3">{r.botOnly ? "AI only" : (r.agent ?? "")}</span>
                </div>
                {r.comment && <p className="mt-1 text-[12.5px] text-fg-2">“{r.comment}”</p>}
              </div>
            ))}
            {s && s.recentRatings.length === 0 && <div className="py-6 text-center text-[13px] text-fg-3">No ratings yet.</div>}
          </div>
        </Card>
        {cfg && (
          <Card className="xl:col-span-12">
            <CardHeader title="Desk settings" subtitle={ai ? (ai.ai ? `AI: Claude (${ai.model})` : "AI key not configured: the assistant answers from the help centre and hands over when unsure") : undefined} />
            <div className="grid grid-cols-1 gap-4 px-6 pb-6 pt-4 md:grid-cols-3">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-[13px]">
                <span>AI autopilot (assistant answers first)</span>
                <Toggle checked={cfg.autopilot} onChange={(v) => setCfg({ ...cfg, autopilot: v })} label="AI autopilot" />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-[13px]">
                <span>Email replies to clients who are away</span>
                <Toggle checked={cfg.emailReplies} onChange={(v) => setCfg({ ...cfg, emailReplies: v })} label="Email replies" />
              </label>
              <Field label="Assistant name"><Input value={cfg.botName} onChange={(e) => setCfg({ ...cfg, botName: e.target.value })} /></Field>
              <Field label="First response SLA (minutes)"><Input type="number" min={1} value={Math.round(cfg.slaFirstSecs / 60)} onChange={(e) => setCfg({ ...cfg, slaFirstSecs: Math.max(1, Number(e.target.value)) * 60 })} /></Field>
              <Field label="Reply SLA (minutes)"><Input type="number" min={1} value={Math.round(cfg.slaReplySecs / 60)} onChange={(e) => setCfg({ ...cfg, slaReplySecs: Math.max(1, Number(e.target.value)) * 60 })} /></Field>
              <Field label="AI answers per client per hour"><Input type="number" min={1} value={cfg.botPerHour} onChange={(e) => setCfg({ ...cfg, botPerHour: Number(e.target.value) })} /></Field>
              <Field label="Greeting" className="md:col-span-3"><Input value={cfg.greeting} onChange={(e) => setCfg({ ...cfg, greeting: e.target.value })} /></Field>
              {can("support.write") && <div className="md:col-span-3 flex justify-end"><Button variant="ember" onClick={() => void save()}><Save /> Save settings</Button></div>}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
