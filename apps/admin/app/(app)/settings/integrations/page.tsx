"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ArrowUpRight, Check, CircleDashed, FileDown, Lock, Rocket, Search, ShieldCheck, Zap } from "lucide-react";
import { Button, Card, CardHeader, Chip, PageHeader, Progress, Reveal, Segmented, Starfield, cn } from "@ezymex/ui";
import {
  SET_CATEGORIES,
  SET_GO_LIVE,
  SET_INTEGRATIONS,
  type SetCategoryKey,
  type SetIntegrationStatus,
} from "@ezymex/mock/admin-platform-settings";
import { IntegrationCard, NEED_META, STATUS_META, StatusDot } from "@/components/settings/integration-card";
import { LogoTile, SectionLabel } from "@/components/settings/kit";

type StatusFilter = "all" | "attention" | "connected";

/* Ring showing configured / total */
function ProgressRing({ done, total, size = 176 }: { done: number; total: number; size?: number }) {
  const stroke = 12;
  const r = (size - stroke) / 2 - 4;
  const c = 2 * Math.PI * r;
  const pct = done / total;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <defs>
          <linearGradient id="int-ring" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#ff8a3d" />
            <stop offset="1" stopColor="#e8431a" />
          </linearGradient>
          <filter id="int-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#int-ring)" strokeWidth={stroke} strokeLinecap="round" filter="url(#int-glow)" opacity={0.6} initial={{ strokeDasharray: `0 ${c}` }} animate={{ strokeDasharray: `${c * pct} ${c}` }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#int-ring)" strokeWidth={stroke} strokeLinecap="round" initial={{ strokeDasharray: `0 ${c}` }} animate={{ strokeDasharray: `${c * pct} ${c}` }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} />
      </svg>
      <div className="text-center">
        <div className="k-num text-[42px] font-semibold leading-none tracking-tight">
          {done}
          <span className="text-fg-3">/{total}</span>
        </div>
        <div className="mt-1.5 text-[12px] text-fg-2">configured</div>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const [statuses, setStatuses] = React.useState<Record<string, SetIntegrationStatus>>(() => Object.fromEntries(SET_INTEGRATIONS.map((i) => [i.id, i.status])));
  const [cat, setCat] = React.useState<"all" | SetCategoryKey>("all");
  const [filter, setFilter] = React.useState<StatusFilter>("all");
  const [q, setQ] = React.useState("");
  const [testingAll, setTestingAll] = React.useState(false);

  const onStatus = React.useCallback((id: string, s: SetIntegrationStatus) => setStatuses((m) => ({ ...m, [id]: s })), []);

  const total = SET_INTEGRATIONS.length;
  const connected = SET_INTEGRATIONS.filter((i) => statuses[i.id] === "connected").length;
  const errors = SET_INTEGRATIONS.filter((i) => statuses[i.id] === "error").length;
  const notConfigured = SET_INTEGRATIONS.filter((i) => statuses[i.id] === "not_configured").length;
  const disabledN = SET_INTEGRATIONS.filter((i) => statuses[i.id] === "disabled").length;
  const required = SET_INTEGRATIONS.filter((i) => i.need === "required");
  const requiredOk = required.filter((i) => statuses[i.id] === "connected").length;
  const checklistDone = SET_GO_LIVE.filter((c) => c.done).length;

  const visible = SET_INTEGRATIONS.filter((i) => {
    if (cat !== "all" && i.category !== cat) return false;
    const st = statuses[i.id];
    if (filter === "attention" && (st === "connected" || st === "disabled")) return false;
    if (filter === "connected" && st !== "connected") return false;
    if (q && !`${i.name} ${i.provider} ${i.fields.map((f) => f.label).join(" ")}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const testAll = () => {
    setTestingAll(true);
    const toTest = SET_INTEGRATIONS.filter((i) => statuses[i.id] !== "disabled");
    toast.loading(`Testing ${toTest.length} integrations…`, { id: "test-all" });
    setTimeout(() => {
      setTestingAll(false);
      toast.success(`${connected} healthy · ${errors} failing · ${notConfigured} not configured`, {
        id: "test-all",
        description: errors ? "Economic calendar: 1 RSS feed returned HTTP 403" : "All configured integrations responded",
      });
    }, 1600);
  };

  return (
    <div className="pb-16">
      <PageHeader
        title="Integrations"
        subtitle="Every credential and input the Super Admin must fill before Ezymex goes live. Secrets are encrypted at rest and every change is audited."
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("Go-live checklist exported", { description: "ezymex-go-live-checklist-2026-09-24.pdf" })}>
              <FileDown /> Export checklist
            </Button>
            <Button variant="ember" shimmer onClick={testAll} disabled={testingAll}>
              <Zap /> {testingAll ? "Testing…" : "Test all connections"}
            </Button>
          </>
        }
      />

      {/* ---------------- Summary + go-live checklist ---------------- */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-7">
          <Card hot className="h-full overflow-hidden">
            <Starfield density={50} />
            <div className="relative flex h-full flex-col gap-6 p-6 md:flex-row md:items-center">
              <ProgressRing done={connected} total={total} />
              <div className="min-w-0 flex-1">
                <Chip tone="ember" className="mb-3">
                  <Rocket className="size-3.5" /> Go-live readiness
                </Chip>
                <h2 className="text-[24px] font-medium leading-tight tracking-tight">
                  {connected} of {total} integrations configured
                </h2>
                <p className="mt-1.5 text-[13.5px] text-fg-2">
                  {requiredOk === required.length ? "All launch-critical services are connected." : `${required.length - requiredOk} launch-critical service${required.length - requiredOk > 1 ? "s" : ""} still need attention.`}{" "}
                  {errors > 0 && <span className="text-down">{errors} integration reporting an error.</span>}
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      ["Connected", connected, "bg-up"],
                      ["Error", errors, "bg-down"],
                      ["Not configured", notConfigured, "bg-warn"],
                      ["Disabled", disabledN, "bg-fg-3"],
                    ] as const
                  ).map(([l, n, dot]) => (
                    <div key={l} className="rounded-[14px] border border-white/10 bg-black/25 px-3.5 py-2.5 backdrop-blur-sm">
                      <div className="flex items-center gap-1.5 text-[11px] text-fg-2">
                        <span className={cn("size-1.5 rounded-full", dot)} />
                        {l}
                      </div>
                      <div className="k-num mt-1 text-[20px] font-semibold">{n}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-[12px] text-fg-2">
                    <span>Required at launch</span>
                    <span className="k-num text-fg">
                      {requiredOk}/{required.length} ready
                    </span>
                  </div>
                  <Progress value={(requiredOk / required.length) * 100} tone={requiredOk === required.length ? "up" : "ember"} />
                </div>
              </div>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.05} className="xl:col-span-5">
          <Card className="flex h-full flex-col">
            <CardHeader
              title="Go-live checklist"
              subtitle={`${checklistDone} of ${SET_GO_LIVE.length} complete`}
              action={
                <Chip tone={checklistDone === SET_GO_LIVE.length ? "up" : "warn"} dot>
                  {Math.round((checklistDone / SET_GO_LIVE.length) * 100)}%
                </Chip>
              }
            />
            <div className="px-6 pt-3">
              <Progress value={(checklistDone / SET_GO_LIVE.length) * 100} tone="up" />
            </div>
            <div className="mt-3 grid flex-1 grid-cols-1 gap-1.5 px-4 pb-5 sm:grid-cols-2 sm:px-6">
              {SET_GO_LIVE.map((c) => (
                <Link key={c.id} href={c.href} className="group flex items-start gap-2.5 rounded-[12px] px-2.5 py-2 transition-colors hover:bg-surface-2">
                  {c.done ? (
                    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-up text-bg">
                      <Check className="size-2.5" strokeWidth={3.5} />
                    </span>
                  ) : (
                    <CircleDashed className="mt-0.5 size-4 shrink-0 text-warn" />
                  )}
                  <span className="min-w-0">
                    <span className={cn("block truncate text-[13px] font-medium", c.done ? "text-fg-2" : "text-fg")}>{c.label}</span>
                    <span className="block truncate text-[11.5px] text-fg-3">{c.detail}</span>
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>

      {/* ---------------- At-a-glance strip ---------------- */}
      <Reveal delay={0.08}>
        <Card className="mt-4 overflow-hidden">
          <div className="flex gap-2 overflow-x-auto px-4 py-4 sm:px-5">
            {SET_INTEGRATIONS.map((i) => (
              <a key={i.id} href={`#int-${i.id}`} className="group flex shrink-0 items-center gap-2.5 rounded-full border border-line bg-surface-2 py-1.5 pl-1.5 pr-3.5 transition-colors hover:border-[var(--k-border-top)] hover:bg-surface-3">
                <LogoTile icon={i.icon} size={28} className="rounded-full" />
                <span className="text-[12.5px] font-medium text-fg-2 group-hover:text-fg">{i.name}</span>
                <StatusDot status={statuses[i.id]!} />
              </a>
            ))}
          </div>
        </Card>
      </Reveal>

      {/* ---------------- Toolbar ---------------- */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="-mx-1 overflow-x-auto px-1">
          <Segmented
            size="sm"
            value={cat}
            onChange={setCat}
            options={[{ value: "all" as const, label: "All" }, ...SET_CATEGORIES.map((c) => ({ value: c.key, label: c.label.split(" ")[0]! === "Market" ? "Market data" : c.label.split(" & ")[0]! }))]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <Segmented
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Any status" },
              { value: "attention", label: <>Needs attention <span className="k-num text-warn">{errors + notConfigured}</span></> },
              { value: "connected", label: "Connected" },
            ]}
          />
          <div className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5">
            <Search className="size-3.5 text-fg-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search integrations or fields…" className="w-44 bg-transparent text-[13px] outline-none placeholder:text-fg-3 sm:w-56" />
          </div>
        </div>
      </div>

      {/* ---------------- Grouped cards ---------------- */}
      <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-8 xl:grid-cols-2">
        {SET_CATEGORIES.map((c, ci) => {
          const items = visible.filter((i) => i.category === c.key);
          if (!items.length) return null;
          // single-card categories share a row with a neighbouring single-card category
          const count = (k: SetCategoryKey | undefined) => (k ? visible.filter((i) => i.category === k).length : 0);
          const half = items.length === 1 && (count(SET_CATEGORIES[ci + 1]?.key) === 1 || count(SET_CATEGORIES[ci - 1]?.key) === 1);
          return (
            <section key={c.key} className={cn("flex flex-col", !half && "xl:col-span-2")}>
              <SectionLabel
                action={
                  <span className="k-num shrink-0 text-[12px] text-fg-3">
                    {items.filter((i) => statuses[i.id] === "connected").length}/{items.length} connected
                  </span>
                }
              >
                {c.label}
              </SectionLabel>
              <p className="mt-1 text-[12.5px] text-fg-3">{c.blurb}</p>
              <div className={cn("mt-4 grid flex-1 grid-cols-1 gap-4", !half && "xl:grid-cols-2")}>
                {items.map((i, idx) => (
                  <Reveal key={i.id} delay={Math.min(idx * 0.04, 0.16)} className="h-full">
                    <div id={`int-${i.id}`} className="h-full scroll-mt-24">
                      <IntegrationCard it={i} onStatus={onStatus} />
                    </div>
                  </Reveal>
                ))}
              </div>
            </section>
          );
        })}
        {visible.length === 0 && (
          <Card className="py-14 text-center text-sm text-fg-3 xl:col-span-2">No integrations match these filters.</Card>
        )}
      </div>

      {/* ---------------- Security footer ---------------- */}
      <Reveal>
        <Card className="mt-8">
          <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
            {[
              { icon: <Lock />, t: "Encrypted at rest", d: "Secrets are sealed with AES-256 (KMS envelope keys) and only decrypted by the service that needs them." },
              { icon: <ShieldCheck />, t: "Audited & four-eyes", d: "Every change is written to the immutable admin audit log with before/after values; wallet keys require a second approver." },
              { icon: <ArrowUpRight />, t: "Per-tenant overrides", d: "White-label tenants inherit these defaults. Tenants on Enterprise can bring their own email, SMS and KYC credentials." },
            ].map((x) => (
              <div key={x.t} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 [&_svg]:size-4">{x.icon}</span>
                <div>
                  <div className="text-[14px] font-medium">{x.t}</div>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-3">{x.d}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-6 py-3.5 text-[12px] text-fg-3">
            Legend:
            {(Object.keys(NEED_META) as (keyof typeof NEED_META)[]).map((k) => (
              <Chip key={k} size="sm" tone={NEED_META[k].tone}>
                {NEED_META[k].label}
              </Chip>
            ))}
            <span className="mx-1 h-3 w-px bg-line" />
            {(Object.keys(STATUS_META) as SetIntegrationStatus[]).map((k) => (
              <Chip key={k} size="sm" tone={STATUS_META[k].tone} dot>
                {STATUS_META[k].label}
              </Chip>
            ))}
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
