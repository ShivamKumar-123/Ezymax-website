"use client";

import * as React from "react";
import { Bot, Download, Gauge as GaugeIcon, MessageCircleHeart, Smile, Star, Timer, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  Delta,
  Donut,
  Gauge,
  KpiCard,
  PageHeader,
  Reveal,
  Segmented,
  cn,
  formatNumber,
} from "@ezymex/ui";
import { SUP_AGENT_SCORES, SUP_CSAT_BY_CHANNEL, SUP_CSAT_DISTRIBUTION, SUP_CSAT_KPIS, SUP_CSAT_TREND, SUP_FEEDBACK } from "@ezymex/mock/admin-growth-support";
import { ShareBar } from "@/components/command/kit";
import { CsatTrend } from "@/components/support/csat-trend";
import { AiSpark, ChannelBadge } from "@/components/support/shared";
import { IS_DEMO as IS_DEMO_MODE } from "@ezymex/mock/mode";
import { LiveCsat } from "@/components/support-live/csat";

const CH_COLORS = ["var(--k-ember)", "var(--k-gold)", "var(--k-up)", "var(--k-info)"];

function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i <= n ? "fill-gold text-gold" : "text-fg-3/50"} />
      ))}
    </span>
  );
}

function DemoCsatPage() {
  const k = SUP_CSAT_KPIS;
  const [range, setRange] = React.useState<"7D" | "30D" | "90D">("30D");
  const [fb, setFb] = React.useState<"all" | "low" | "ai">("all");
  const data = range === "7D" ? SUP_CSAT_TREND.slice(-7) : SUP_CSAT_TREND;
  const totalRatings = SUP_CSAT_DISTRIBUTION.reduce((s, d) => s + d.count, 0);
  const maxAgent = Math.max(...SUP_AGENT_SCORES.map((a) => a.conversations));
  const feedback = SUP_FEEDBACK.filter((f) => (fb === "all" ? true : fb === "low" ? f.rating <= 3 : f.agent === "Claude"));

  return (
    <div className="pb-16">
      <PageHeader
        title="Customer satisfaction"
        subtitle="Post-chat ratings across AI and human agents · all tenants · server time GMT+3"
        actions={
          <>
            <Segmented value={range} onChange={setRange} options={["7D", "30D", "90D"] as const} />
            <Button variant="surface" onClick={() => toast.success("csat-report-sep-2026.pdf exported", { description: `${formatNumber(k.responses, 0)} ratings · 7 agents` })}>
              <Download /> Export
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="CSAT" value={<span className="k-num">{k.csat}<span className="text-fg-3">%</span></span>} icon={<Smile />} chip={`+${k.csatDelta} pts vs Aug`} chipTone="up" hot illustration="trophy" />
        <KpiCard label="NPS" value={<span className="k-num">+{k.nps}</span>} icon={<MessageCircleHeart />} chip={`+${k.npsDelta} vs Q2`} chipTone="up" delay={0.05} />
        <KpiCard label="First response time" value={<span className="k-num">{k.frt}<span className="text-fg-3">s</span></span>} icon={<Timer />} chip={`${k.frtDelta}s faster · AI replies in 2s`} chipTone="up" delay={0.1} />
        <KpiCard
          label="AI resolution rate"
          value={<span className="k-num">{k.aiResolution}<span className="text-fg-3">%</span></span>}
          icon={<Bot />}
          footer={
            <div className="flex items-center gap-2 text-[11.5px]">
              <Chip size="sm" tone="gold">+{k.aiResolutionDelta} pts</Chip>
              <span className="text-fg-3">{formatNumber(k.conversations30d * (k.aiResolution / 100), 0)} chats without a human</span>
            </div>
          }
          delay={0.15}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader
              title="Satisfaction trend"
              subtitle={`Daily CSAT and AI resolution · ${range}`}
              icon={<GaugeIcon />}
              action={
                <div className="hidden items-center gap-3 text-[11.5px] text-fg-3 sm:flex">
                  <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-gold" /> CSAT</span>
                  <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-ember" /> AI resolved</span>
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-fg-3/40" /> Rated chats</span>
                </div>
              }
            />
            <div className="px-3 pb-4 pt-3 sm:px-5">
              <CsatTrend data={data} height={300} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <Card className="flex h-full flex-col">
            <CardHeader title="Ratings distribution" subtitle={`${formatNumber(totalRatings, 0)} ratings · ${range}`} icon={<Star />} />
            <div className="flex items-center gap-5 px-6 pt-4">
              <Gauge value={k.csat} max={100} display={`${k.csat}%`} label="4–5 stars" size={150} />
              <div>
                <div className="k-num text-[34px] font-semibold leading-none">4.62</div>
                <div className="mt-1.5"><Stars n={5} size={14} /></div>
                <div className="mt-1.5 text-[12px] text-fg-3">average rating</div>
                <Delta value={0.08} suffix="" className="mt-1 text-[12px]" />
              </div>
            </div>
            <div className="mt-4 flex-1 space-y-2 px-6 pb-6">
              {SUP_CSAT_DISTRIBUTION.map((d) => {
                const pct = (d.count / totalRatings) * 100;
                return (
                  <div key={d.stars} className="flex items-center gap-3 text-[12px]">
                    <span className="flex w-8 items-center gap-1 text-fg-2">
                      <span className="k-num">{d.stars}</span>
                      <Star className="size-3 fill-gold text-gold" />
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <div className={cn("h-full rounded-full", d.stars >= 4 ? "bg-gradient-to-r from-gold/70 to-gold" : d.stars === 3 ? "bg-warn" : "bg-down")} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="k-num w-16 text-right text-fg-3">
                      {formatNumber(d.count, 0)} <span className="text-fg-3/70">· {pct.toFixed(0)}%</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-7">
          <Card className="h-full">
            <CardHeader title="Scores per agent" subtitle="30 days · sorted by CSAT" icon={<Users />} action={<Button size="sm" variant="surface" onClick={() => toast.info("Opening agent coaching view")}>Coaching</Button>} />
            <div className="mt-4 overflow-x-auto px-4 pb-5 sm:px-6">
              <div className="min-w-[560px]">
                <div className="grid grid-cols-[minmax(0,1.6fr)_1.4fr_90px_70px] gap-4 rounded-[14px] border border-line bg-surface-2 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.05em] text-fg-3">
                  <span>Agent</span>
                  <span>CSAT</span>
                  <span className="text-right">Chats</span>
                  <span className="text-right">FRT</span>
                </div>
                {[...SUP_AGENT_SCORES].sort((a, b) => b.csat - a.csat).map((a, i) => (
                  <div key={a.name} className={cn("grid grid-cols-[minmax(0,1.6fr)_1.4fr_90px_70px] items-center gap-4 border-b border-line px-4 py-2.5", a.ai && "bg-gradient-to-r from-ember/[0.07] to-transparent")}>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="k-num w-4 text-[11px] text-fg-3">{i + 1}</span>
                      {a.ai ? <AiSpark size={30} /> : <Avatar src={a.photo} name={a.name} size={30} />}
                      <span className="min-w-0">
                        <span className={cn("block truncate text-[13px] font-medium", a.ai && "text-gold")}>{a.name}</span>
                        <span className="block text-[11px] text-fg-3">{a.ai ? `resolves ${a.resolution}% alone` : "Human agent"}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <div className={cn("h-full rounded-full", a.ai ? "bg-gradient-to-r from-ember to-gold" : a.csat >= 95 ? "bg-up" : a.csat >= 93 ? "bg-gold" : "bg-warn")} style={{ width: `${((a.csat - 85) / 15) * 100}%` }} />
                      </div>
                      <span className="k-num w-12 text-right text-[12.5px] font-medium">{a.csat}%</span>
                    </div>
                    <div className="text-right">
                      <div className="k-num text-[12.5px]">{formatNumber(a.conversations, 0)}</div>
                      <div className="ml-auto mt-1 h-1 w-full max-w-[70px] overflow-hidden rounded-full bg-surface-3">
                        <div className="h-full rounded-full bg-fg-3/60" style={{ width: `${Math.max(3, (a.conversations / maxAgent) * 100)}%` }} />
                      </div>
                    </div>
                    <div className={cn("k-num text-right font-mono text-[12px]", a.frt <= 45 ? "text-up" : a.frt <= 60 ? "text-fg-2" : "text-warn")}>{a.frt}s</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-5">
          <Card className="flex h-full flex-col">
            <CardHeader title="By channel" subtitle="CSAT and share of rated chats" icon={<MessageCircleHeart />} />
            <div className="flex flex-col items-center gap-6 px-6 pt-5 sm:flex-row">
              <Donut
                data={SUP_CSAT_BY_CHANNEL.map((c, i) => ({ label: c.channel, value: c.share, color: CH_COLORS[i] }))}
                size={180}
                thickness={18}
                center={
                  <div>
                    <div className="k-num text-[22px] font-semibold">{formatNumber(k.responses, 0)}</div>
                    <div className="text-[11px] text-fg-3">rated chats</div>
                  </div>
                }
              />
              <div className="w-full flex-1 space-y-2">
                {SUP_CSAT_BY_CHANNEL.map((c, i) => (
                  <div key={c.channel} className="k-row flex items-center gap-3 px-3.5 py-2.5">
                    <span className="size-2.5 rounded-full" style={{ background: CH_COLORS[i] }} />
                    <span className="flex-1 text-[13px]">{c.channel}</span>
                    <span className="k-num text-[12px] text-fg-3">{c.share}%</span>
                    <span className={cn("k-num w-14 text-right text-[13px] font-medium", c.csat >= 94 ? "text-up" : c.csat >= 92 ? "text-fg" : "text-warn")}>{c.csat}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 flex-1 border-t border-line px-6 pb-6 pt-4">
              <div className="k-label mb-3 !text-fg-3">AI vs human</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[14px] border border-gold/25 bg-[linear-gradient(135deg,rgba(255,90,31,0.10),rgba(233,185,73,0.05))] px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[11.5px] text-gold"><AiSpark size={14} /> Claude only</div>
                  <div className="k-num mt-1 text-[22px] font-semibold">93.8%</div>
                  <div className="text-[11px] text-fg-3">12,604 chats · 2s first reply</div>
                </div>
                <div className="k-row px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[11.5px] text-fg-2"><Users className="size-3.5" /> After handoff</div>
                  <div className="k-num mt-1 text-[22px] font-semibold">95.1%</div>
                  <div className="text-[11px] text-fg-3">5,816 chats · 48s first reply</div>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-[11.5px] text-fg-3"><span>Share resolved by AI</span><span className="k-num text-fg-2">68.4%</span></div>
                <ShareBar parts={[{ value: 68.4, className: "bg-gradient-to-r from-ember to-gold" }, { value: 31.6, className: "bg-surface-3" }]} />
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.05} className="mt-4 block">
        <Card>
          <CardHeader
            title="Recent feedback"
            subtitle="Comments left after the conversation"
            icon={<MessageCircleHeart />}
            action={<Segmented size="xs" value={fb} onChange={setFb} options={[{ value: "all", label: "All" }, { value: "low", label: "1–3 stars" }, { value: "ai", label: "AI only" }]} />}
          />
          <div className="mt-4 grid grid-cols-1 gap-3 px-4 pb-6 sm:px-6 md:grid-cols-2 xl:grid-cols-4">
            {feedback.map((f) => (
              <div key={f.id} className={cn("k-row flex flex-col px-4 py-3.5", f.rating <= 2 && "border-down/25")}>
                <div className="flex items-center gap-2.5">
                  <Avatar src={f.client.photo} name={f.client.name} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{f.client.name}</div>
                    <div className="text-[11px] text-fg-3">{f.tenant}</div>
                  </div>
                  <Stars n={f.rating} />
                </div>
                <p className="mt-2.5 flex-1 text-[12.5px] leading-relaxed text-fg-2">“{f.comment}”</p>
                <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5 text-[11px] text-fg-3">
                  {f.agent === "Claude" ? <AiSpark size={16} /> : null}
                  <span className={f.agent === "Claude" ? "text-gold" : "text-fg-2"}>{f.agent}</span>
                  <ChannelBadge channel={f.channel} />
                  <button onClick={() => toast.info(`Opening ${f.conv}`)} className="ml-auto font-mono hover:text-ember">
                    {f.conv}
                  </button>
                  <span className="font-mono">{f.at}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

/** Demo builds: the mock showcase. Live builds: services/support. */
export default function CsatPage() {
  return IS_DEMO_MODE ? <DemoCsatPage /> : <LiveCsat />;
}
