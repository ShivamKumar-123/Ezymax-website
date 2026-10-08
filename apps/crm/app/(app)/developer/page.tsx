"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, AlertCircle, BookOpen, Gauge as GaugeIcon, KeyRound, Plus } from "lucide-react";
import { Button, Chip, KpiCard, MiniBars, PageHeader, Reveal, formatNumber } from "@/components/kit";
import { API_KEYS, API_STATS, apiUsage, type ApiKey } from "@ezymex/mock/developer";
import { CreateKeyDialog, KeysTable, KillSwitchCard, OrderSourcesCard, SdkQuickstart, SecurityChecklist, UsageCard } from "@/components/developer/api-keys";
import { IS_DEMO as DEMO_BUILD } from "@ezymex/mock/mode";
import { LiveKeysPage } from "@/components/algo/keys-page";

function DemoApiKeysPage() {
  const [keys, setKeys] = React.useState<ApiKey[]>(API_KEYS);
  const [creating, setCreating] = React.useState(false);
  const [halted, setHalted] = React.useState(false);
  const hourly = React.useMemo(() => apiUsage("hour").slice(-24).map((d) => d.value), []);
  const active = keys.filter((k) => k.status === "active").length;

  return (
    <div className="pb-24">
      <PageHeader
        title="API & Algo"
        subtitle="REST, WebSocket and FIX 4.4 access to your trading accounts — scoped, IP-locked and rate-limited."
        actions={
          <>
            <Link href="/developer/docs">
              <Button variant="surface" size="lg">
                <BookOpen /> API docs
              </Button>
            </Link>
            <Button variant="ember" size="lg" shimmer onClick={() => setCreating(true)}>
              <Plus /> Create API key
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Requests · 24h"
          icon={<Activity />}
          value={<span className="k-num">{formatNumber(API_STATS.requests24h, 0)}</span>}
          footer={
            <div className="flex w-full items-center justify-between gap-3">
              <Chip tone="up">+{API_STATS.requestsChangePct}% vs yesterday</Chip>
              <MiniBars data={hourly} className="h-6" />
            </div>
          }
        />
        <KpiCard
          label="Error rate"
          icon={<AlertCircle />}
          value={
            <span className="k-num">
              {API_STATS.errorRate}
              <span className="text-fg-3">%</span>
            </span>
          }
          chip={`${API_STATS.rateLimited24h} rate-limited · 0 auth failures`}
          chipTone="neutral"
          delay={0.05}
        />
        <KpiCard
          label="Latency p50"
          icon={<GaugeIcon />}
          value={
            <span className="k-num">
              {API_STATS.p50}
              <span className="text-[20px] text-fg-3"> ms</span>
            </span>
          }
          footer={
            <div className="flex items-center gap-1.5">
              <Chip tone="up">p99 {API_STATS.p99}ms</Chip>
              <Chip>LD4 · Equinix</Chip>
            </div>
          }
          delay={0.1}
        />
        <KpiCard
          label="Active keys"
          icon={<KeyRound />}
          hot
          illustration="key"
          value={
            <span className="k-num">
              {halted ? 0 : active}
              <span className="text-fg-3">/{keys.length}</span>
            </span>
          }
          footer={
            <div className="flex items-center gap-1.5">
              <Chip size="sm" tone={halted ? "down" : "gold"}>{halted ? "Kill switch on" : `${formatNumber(API_STATS.ordersViaApi24h, 0)} API orders`}</Chip>
              <Chip size="sm">{API_STATS.wsConnections} WS live</Chip>
            </div>
          }
          delay={0.15}
        />
      </div>

      <Reveal delay={0.05} className="mt-4">
        <SecurityChecklist keys={keys} />
      </Reveal>

      <Reveal delay={0.1} className="mt-4">
        <KeysTable keys={keys} setKeys={setKeys} halted={halted} onCreate={() => setCreating(true)} />
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-8">
          <UsageCard />
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <KillSwitchCard halted={halted} setHalted={setHalted} />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-7">
          <SdkQuickstart />
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-5">
          <OrderSourcesCard />
        </Reveal>
      </div>

      <CreateKeyDialog open={creating} onOpenChange={setCreating} onCreated={(k) => setKeys((ks) => [k, ...ks])} />
    </div>
  );
}

export default function ApiKeysPage() {
  return DEMO_BUILD ? <DemoApiKeysPage /> : <React.Suspense fallback={null}><LiveKeysPage /></React.Suspense>;
}
