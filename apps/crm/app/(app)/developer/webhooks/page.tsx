"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { BookOpen, CheckCircle2, Loader2, Plus, Radio, Send, Timer, Webhook } from "lucide-react";
import { Button, Card, CardHeader, Chip, KpiCard, PageHeader, Reveal, SymbolAvatar, cn } from "@/components/kit";
import { WEBHOOKS, WEBHOOK_DELIVERIES, type SignalWebhook } from "@kalks/mock/developer";
import {
  CreateWebhookDialog,
  DeliveryLog,
  EndpointRows,
  FanoutEditor,
  PayloadCard,
  WebhookListItem,
  WebhookMenu,
  type Delivery,
} from "@/components/developer/webhooks";
import { ago } from "@/components/developer/api-keys";
import { IS_DEMO as DEMO_BUILD } from "@kalks/mock/mode";
import { LiveWebhooksPage } from "@/components/algo/webhooks-page";

function SignalActivity({ log }: { log: Delivery[] }) {
  const end = Date.parse("2026-09-24T15:00:00Z");
  const buckets = Array.from({ length: 24 }, (_, i) => {
    const from = end - (24 - i) * 3600000;
    const rows = log.filter((l) => {
      const t = Date.parse(l.time);
      return t >= from && t < from + 3600000;
    });
    return { ok: rows.filter((r) => r.status === 200).length, bad: rows.filter((r) => r.status !== 200).length };
  });
  const max = Math.max(2, ...buckets.map((b) => b.ok + b.bad));
  return (
    <div className="k-row px-4 py-3.5">
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="font-medium">Signals by hour</span>
        <span className="flex items-center gap-3 text-[11px] text-fg-3">
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-up" />200</span>
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-down" />4xx</span>
        </span>
      </div>
      <div className="mt-3 flex h-14 items-end gap-[3px]">
        {buckets.map((b, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end gap-[2px]">
            {b.bad > 0 && <motion.span initial={{ height: 0 }} animate={{ height: `${(b.bad / max) * 100}%` }} transition={{ delay: i * 0.015 }} className="rounded-[2px] bg-down/80" />}
            <motion.span initial={{ height: 0 }} animate={{ height: `${Math.max(0.06, b.ok / max) * 100}%` }} transition={{ delay: i * 0.015 }} className={cn("rounded-[2px]", b.ok ? "bg-up/80" : "bg-surface-3")} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-fg-3">
        <span>18:00 yday</span>
        <span>06:00</span>
        <span>now</span>
      </div>
    </div>
  );
}

function DemoWebhooksPage() {
  const [hooks, setHooks] = React.useState<SignalWebhook[]>(WEBHOOKS);
  const [sel, setSel] = React.useState(WEBHOOKS[0]!.id);
  const [log, setLog] = React.useState<Delivery[]>(WEBHOOK_DELIVERIES);
  const [creating, setCreating] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const w = hooks.find((h) => h.id === sel) ?? hooks[0];

  const patch = (id: string, p: Partial<SignalWebhook>) => setHooks((hs) => hs.map((h) => (h.id === id ? { ...h, ...p } : h)));

  const sendTest = () => {
    if (!w) return;
    setSending(true);
    setTimeout(() => {
      const enabled = w.targets.filter((t) => t.enabled).length;
      const ok = w.enabled;
      const latency = Math.round(28 + Math.random() * 30);
      const row: Delivery = {
        id: `dlv_${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`,
        webhookId: w.id,
        time: new Date().toISOString(),
        action: Math.random() > 0.5 ? "buy" : "sell",
        symbol: w.symbols[0]!,
        status: ok ? 200 : 423,
        latency: ok ? latency : 9,
        filled: ok ? enabled : 0,
        total: Math.max(1, enabled),
        message: ok ? "Test signal · orders routed (demo fill)" : "Webhook disabled — enable it to accept signals",
      };
      setLog((l) => [row, ...l]);
      if (ok) {
        patch(w.id, { signals24h: w.signals24h + 1, lastSignal: row.time });
        toast.success(`Test delivered · ${row.latency} ms`, { description: `${row.action.toUpperCase()} ${row.symbol} → ${enabled}/${enabled} accounts filled` });
      } else toast.error("Test rejected · 423", { description: "This webhook is disabled." });
      setSending(false);
    }, 650);
  };

  const signals = hooks.reduce((s, h) => s + h.signals24h, 0);
  const okRate = (log.filter((l) => l.status === 200).length / log.length) * 100;
  const avgLat = Math.round(log.slice(0, 20).reduce((s, l) => s + l.latency, 0) / Math.min(20, log.length));
  const accounts = new Set(hooks.flatMap((h) => h.targets.filter((t) => t.enabled).map((t) => t.login))).size;

  return (
    <div className="pb-24">
      <PageHeader
        title="Signal webhooks"
        subtitle="Turn TradingView alerts into orders, fanned out to your accounts with per-account sizing."
        actions={
          <>
            <Link href="/developer/docs#webhooks">
              <Button variant="surface" size="lg">
                <BookOpen /> Payload docs
              </Button>
            </Link>
            <Button variant="ember" size="lg" shimmer onClick={() => setCreating(true)}>
              <Plus /> Create webhook
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Signals · 24h" icon={<Radio />} value={<span className="k-num">{signals}</span>} chip={`${hooks.filter((h) => h.enabled).length} of ${hooks.length} webhooks enabled`} chipTone="neutral" />
        <KpiCard
          label="Delivery success"
          icon={<CheckCircle2 />}
          value={
            <span className="k-num">
              {okRate.toFixed(1)}
              <span className="text-fg-3">%</span>
            </span>
          }
          chip={`${log.filter((l) => l.status !== 200).length} rejected · last 7d`}
          chipTone={okRate > 95 ? "up" : "warn"}
          delay={0.05}
        />
        <KpiCard
          label="Signal → fill"
          icon={<Timer />}
          value={
            <span className="k-num">
              {avgLat}
              <span className="text-[20px] text-fg-3"> ms</span>
            </span>
          }
          chip="Median, incl. fan-out"
          chipTone="up"
          delay={0.1}
        />
        <KpiCard
          label="Accounts receiving"
          icon={<Webhook />}
          hot
          illustration="satellite_antenna"
          value={<span className="k-num">{accounts}</span>}
          footer={
            <div className="flex items-center gap-1.5">
              <Chip size="sm" tone="gold">
                source=webhook
              </Chip>
              <Chip size="sm">638 orders · 30d</Chip>
            </div>
          }
          delay={0.15}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-4">
          <Card className="flex h-full flex-col">
            <CardHeader
              title="Your webhooks"
              subtitle={`${hooks.length} endpoints · signed with HMAC-SHA256`}
              action={
                <Button size="sm" variant="surface" onClick={() => setCreating(true)}>
                  <Plus /> New
                </Button>
              }
            />
            <div className="flex-1 space-y-2.5 px-4 pb-5 pt-4 sm:px-6">
              {hooks.map((h) => (
                <WebhookListItem
                  key={h.id}
                  w={h}
                  active={h.id === w?.id}
                  onSelect={() => setSel(h.id)}
                  onToggle={(v) => {
                    patch(h.id, { enabled: v });
                    if (v) toast.success(`${h.name} enabled`, { description: "Signals will be routed to your accounts." });
                    else toast.warning(`${h.name} disabled`, { description: "New signals are rejected with 423." });
                  }}
                />
              ))}
              <div className="rounded-[14px] border border-dashed border-line p-4">
                <div className="text-[12.5px] font-medium">How it works</div>
                <ol className="mt-2 space-y-1.5 text-[12px] text-fg-3">
                  {["Paste the URL into a TradingView alert", "Use the JSON message template", "Kalks verifies the secret and routes to each account with its sizing rule"].map((s, i) => (
                    <li key={s} className="flex gap-2">
                      <span className="grid size-4 shrink-0 place-items-center rounded-full bg-surface-3 font-mono text-[10px] text-fg-2">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
              <SignalActivity log={log} />
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.1} className="xl:col-span-8">
          <AnimatePresence mode="wait">
            {w && (
              <motion.div key={w.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="h-full">
                <Card className="h-full">
                  <div className="flex flex-col gap-4 px-6 pt-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex -space-x-2">
                        {w.symbols.map((s) => (
                          <span key={s} className="rounded-full ring-2 ring-surface">
                            <SymbolAvatar symbol={s} size={36} />
                          </span>
                        ))}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-[18px] font-medium tracking-tight">{w.name}</h3>
                          <Chip tone={w.enabled ? "up" : "neutral"} dot>
                            {w.enabled ? "Listening" : "Disabled"}
                          </Chip>
                        </div>
                        <div className="mt-0.5 text-[12.5px] text-fg-3">
                          <span className="font-mono">{w.id}</span> · last signal {ago(w.lastSignal)} · avg {w.avgLatency || "—"} ms
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ember" onClick={sendTest} disabled={sending}>
                        {sending ? <Loader2 className="animate-spin" /> : <Send />} Send test
                      </Button>
                      <WebhookMenu
                        w={w}
                        onRename={() => toast.info("Rename", { description: "Inline rename is coming — the name is only visible to you." })}
                        onDelete={() => {
                          const rest = hooks.filter((h) => h.id !== w.id);
                          setHooks(rest);
                          if (rest[0]) setSel(rest[0].id);
                          toast.error(`${w.name} deleted`, { description: "The URL now returns 404." });
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-5 px-4 pb-6 pt-5 sm:px-6 2xl:grid-cols-2">
                    <div className="min-w-0 space-y-5">
                      <EndpointRows
                        w={w}
                        onRotate={() => {
                          const s = `whsec_${Math.random().toString(36).slice(2, 14)}${Math.random().toString(36).slice(2, 14)}`;
                          patch(w.id, { secret: s });
                          toast.success("Secret rotated", { description: "Update your TradingView alert message — the old secret is invalid now." });
                        }}
                      />
                      <FanoutEditor w={w} onChange={(t) => patch(w.id, { targets: t })} />
                    </div>
                    <div className="min-w-0">
                      <div className="mb-2.5 flex items-center justify-between">
                        <div className="k-label">Alert message</div>
                        <span className="text-[11.5px] text-fg-3">Highlighted fields are required</span>
                      </div>
                      <PayloadCard w={w} />
                      <div className="mt-3 grid grid-cols-3 gap-2 text-[11.5px]">
                        {[
                          ["Header", "X-Kalks-Signature"],
                          ["Dedup window", "10s · by comment"],
                          ["Max rate", "5 / 10s"],
                        ].map(([k, v]) => (
                          <div key={k} className="k-row px-3 py-2">
                            <div className="text-fg-3">{k}</div>
                            <div className={cn("mt-0.5 truncate text-[12px] font-medium", k === "Header" && "font-mono")}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <DeliveryLog rows={log} webhooks={hooks} selectedId={w?.id ?? ""} />
      </Reveal>

      <CreateWebhookDialog
        open={creating}
        onOpenChange={setCreating}
        onCreate={(nw) => {
          setHooks((hs) => [...hs, nw]);
          setSel(nw.id);
        }}
      />
    </div>
  );
}

export default function WebhooksPage() {
  return DEMO_BUILD ? <DemoWebhooksPage /> : <React.Suspense fallback={null}><LiveWebhooksPage /></React.Suspense>;
}
