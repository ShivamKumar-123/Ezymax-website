"use client";

import * as React from "react";
import { Link2, RefreshCw, Target, TrendingUp, UserPlus, Wallet } from "lucide-react";
import { Button, Card, CardHeader, CopyButton, DataTable, KpiCard, PageHeader, Reveal, Segmented, type Column } from "@kalks/ui";
import { TableSkeleton, qs, useApi } from "@/components/live/kit";
import { M } from "./api";
import { EmptyNote, MkError, SelectF, TextF, int, pct, usd, usdK } from "./kit";

type Row = { source: string; medium: string; campaign: string; signups: number; emailVerified: number; kycVerified: number; ftds: number; ftdAmount: number; deposits: number; withdrawals: number; net: number; conversion: number };
type Totals = Omit<Row, "source" | "medium" | "campaign">;
type Data = { from: string; to: string; totals: Totals; items: Row[]; bySource: (Totals & { source: string })[] };

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
};
const tomorrow = () => daysAgo(-1);

type Preset = "7" | "30" | "90" | "365";

/** UTM campaign attribution: sign-ups by first-touch utm source / medium / campaign and what they deposited. */
export function LiveCampaigns() {
  const [preset, setPreset] = React.useState<Preset>("30");
  const from = daysAgo(Number(preset) - 1);
  const { data, error, loading, reload } = useApi<Data>(`${M("campaigns")}${qs({ from, to: tomorrow() })}`);
  const t = data?.totals;
  const maxSrc = Math.max(1, ...(data?.bySource ?? []).map((s) => s.signups));

  const cols: Column<Row>[] = [
    { key: "s", header: "Source", cell: (r) => <span className="font-medium">{r.source}</span>, sort: (r) => r.source, csv: (r) => r.source },
    { key: "m", header: "Medium", cell: (r) => <span className="text-fg-2">{r.medium || "—"}</span>, sort: (r) => r.medium, csv: (r) => r.medium },
    { key: "c", header: "Campaign", cell: (r) => <span className="font-mono text-[12.5px]">{r.campaign || "—"}</span>, sort: (r) => r.campaign, csv: (r) => r.campaign },
    { key: "su", header: "Sign-ups", align: "right", cell: (r) => <span className="k-num">{int(r.signups)}</span>, sort: (r) => r.signups, csv: (r) => r.signups },
    { key: "ev", header: "Verified", align: "right", hideOn: "lg", cell: (r) => <span className="k-num text-fg-2">{int(r.emailVerified)}</span>, sort: (r) => r.emailVerified, csv: (r) => r.emailVerified },
    { key: "kyc", header: "KYC", align: "right", hideOn: "lg", cell: (r) => <span className="k-num text-fg-2">{int(r.kycVerified)}</span>, sort: (r) => r.kycVerified, csv: (r) => r.kycVerified },
    { key: "f", header: "FTDs", align: "right", cell: (r) => <span className="k-num">{int(r.ftds)}</span>, sort: (r) => r.ftds, csv: (r) => r.ftds },
    { key: "cv", header: "Conv.", align: "right", cell: (r) => <span className="k-num text-fg-2">{pct(r.conversion)}</span>, sort: (r) => r.conversion, csv: (r) => r.conversion },
    { key: "fa", header: "FTD amount", align: "right", hideOn: "md", cell: (r) => <span className="k-num">{usd(r.ftdAmount)}</span>, sort: (r) => r.ftdAmount, csv: (r) => r.ftdAmount },
    { key: "d", header: "Deposits", align: "right", cell: (r) => <span className="k-num font-medium">{usd(r.deposits)}</span>, sort: (r) => r.deposits, csv: (r) => r.deposits },
    { key: "n", header: "Net", align: "right", hideOn: "md", cell: (r) => <span className={r.net < 0 ? "k-num text-down" : "k-num text-up"}>{usd(r.net)}</span>, sort: (r) => r.net, csv: (r) => r.net },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Campaigns"
        subtitle="First-touch UTM attribution: sign-ups, first deposits and money in by source, medium and campaign."
        actions={
          <>
            <Segmented
              size="sm"
              value={preset}
              onChange={setPreset}
              options={[
                { value: "7", label: "7d" },
                { value: "30", label: "30d" },
                { value: "90", label: "90d" },
                { value: "365", label: "1y" },
              ]}
            />
            <Button variant="surface" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Sign-ups" icon={<UserPlus />} value={<span className="k-num">{t ? int(t.signups) : "—"}</span>} chip={t ? `${int(t.emailVerified)} verified · ${int(t.kycVerified)} KYC` : "Loading"} />
        <KpiCard label="First deposits" icon={<Target />} value={<span className="k-num">{t ? int(t.ftds) : "—"}</span>} chip={t ? `${pct(t.conversion)} of sign-ups` : ""} chipTone="up" delay={0.05} />
        <KpiCard label="FTD amount" icon={<TrendingUp />} value={<span className="k-num">{t ? usdK(t.ftdAmount) : "—"}</span>} chip={t && t.ftds ? `${usd(t.ftdAmount / t.ftds)} average` : "No FTDs yet"} chipTone="gold" delay={0.1} />
        <KpiCard label="Deposits from these sign-ups" icon={<Wallet />} value={<span className="k-num">{t ? usdK(t.deposits) : "—"}</span>} chip={t ? `Net ${usd(t.net)}` : ""} delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Reveal delay={0.05} className="min-w-0">
          <Card>
            <CardHeader title="By campaign" subtitle="Clients who signed up in the period, grouped by the UTM tags they arrived with" />
            <div className="mt-4 px-4 pb-5 sm:px-6">
              {error && !data ? (
                <MkError error={error} onRetry={reload} />
              ) : !data ? (
                <TableSkeleton />
              ) : (
                <div className={loading ? "opacity-60 transition-opacity" : undefined} data-testid="utm-campaigns">
                  <DataTable
                    columns={cols}
                    rows={data.items}
                    pageSize={20}
                    dense
                    rowKey={(r) => `${r.source}|${r.medium}|${r.campaign}`}
                    search={(r) => `${r.source} ${r.medium} ${r.campaign}`}
                    searchPlaceholder="Search source or campaign…"
                    exportName="utm-campaigns"
                    empty={<EmptyNote className="mt-3" title="No sign-ups in this period" text="Share tracked links (right) so new clients are attributed to their channel." />}
                  />
                </div>
              )}
            </div>
          </Card>
        </Reveal>

        <div className="min-w-0 space-y-4">
          <Reveal delay={0.08}>
            <Card>
              <CardHeader title="By source" subtitle="Sign-ups and first deposits" />
              <div className="space-y-2.5 px-6 pb-5 pt-4">
                {!data ? (
                  <TableSkeleton rows={4} />
                ) : data.bySource.length === 0 ? (
                  <div className="text-[12.5px] text-fg-3">No sign-ups in this period.</div>
                ) : (
                  [...data.bySource]
                    .sort((a, b) => b.signups - a.signups)
                    .map((s) => (
                      <div key={s.source}>
                        <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                          <span className="truncate font-medium">{s.source}</span>
                          <span className="k-num shrink-0 text-fg-2">
                            {int(s.signups)} · {int(s.ftds)} FTD
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                          <div className="h-full rounded-full bg-ember" style={{ width: `${(s.signups / maxSrc) * 100}%` }} />
                        </div>
                      </div>
                    ))
                )}
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.1}>
            <LinkBuilder />
          </Reveal>
        </div>
      </div>
    </div>
  );
}

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://kalkstrade.com").replace(/\/$/, "");
const APP = (process.env.NEXT_PUBLIC_CRM_URL ?? "https://app.kalkstrade.com").replace(/\/$/, "");

function LinkBuilder() {
  const [target, setTarget] = React.useState<"site" | "register">("site");
  const [source, setSource] = React.useState("google");
  const [medium, setMedium] = React.useState("cpc");
  const [campaign, setCampaign] = React.useState("");
  const [content, setContent] = React.useState("");
  const clean = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_").slice(0, 60);
  const base = target === "site" ? `${SITE}/` : `${APP}/register`;
  const params = new URLSearchParams();
  if (clean(source)) params.set("utm_source", clean(source));
  if (clean(medium)) params.set("utm_medium", clean(medium));
  if (clean(campaign)) params.set("utm_campaign", clean(campaign));
  if (content.trim()) params.set("utm_content", content.trim().slice(0, 60));
  const url = `${base}?${params}`;
  const ok = !!clean(source) && !!clean(campaign);
  return (
    <Card>
      <CardHeader title="Tracked link" subtitle="Clients keep the first UTM tags they arrive with until they sign up" />
      <div className="space-y-3 px-6 pb-5 pt-4">
        <SelectF label="Lands on" value={target} onChange={setTarget} options={[{ value: "site", label: "Website" }, { value: "register", label: "Client Area sign-up" }]} />
        <div className="grid grid-cols-2 gap-3">
          <TextF label="Source" value={source} onChange={setSource} mono placeholder="google" />
          <TextF label="Medium" value={medium} onChange={setMedium} mono placeholder="cpc" />
        </div>
        <TextF label="Campaign" value={campaign} onChange={setCampaign} mono placeholder="q4_gold_search" />
        <TextF label="Content" value={content} onChange={setContent} mono placeholder="optional, e.g. banner_a" />
        <div className="k-row flex items-center gap-2 px-3 py-2">
          <Link2 className="size-3.5 shrink-0 text-fg-3" />
          <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-fg-2" title={url} data-testid="utm-link">
            {ok ? url : "Enter a source and a campaign"}
          </span>
          {ok && <CopyButton value={url} label="link" />}
        </div>
      </div>
    </Card>
  );
}
