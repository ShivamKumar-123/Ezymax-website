"use client";

import * as React from "react";
import { RotateCcw, Save } from "lucide-react";
import { Button, Card, CardHeader, Chip, Icon3D, PageHeader, Reveal, Toggle, cn } from "@kalks/ui";
import { MASTERS, SOCIAL_SETTINGS } from "@kalks/mock/admin-partners";
import { ChipList, MiniField, NumInput, Select, SettingRow, Slider, auditToast, useReason } from "@/components/config/kit";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveSocialSettingsPage } from "@/components/social-live/settings";

type S = typeof SOCIAL_SETTINGS;
const PERIODS = ["Daily", "Weekly", "Bi-weekly", "Monthly", "Quarterly"];

function DemoSocialSettingsPage() {
  const [s, setS] = React.useState<S>(SOCIAL_SETTINGS);
  const [saved, setSaved] = React.useState<S>(SOCIAL_SETTINGS);
  const [defPeriod, setDefPeriod] = React.useState("Monthly");
  const [lockup, setLockup] = React.useState(7);
  const reason = useReason();
  const [savedExtra, setSavedExtra] = React.useState({ defPeriod: "Monthly", lockup: 7 });
  const dirty = JSON.stringify(s) !== JSON.stringify(saved) || defPeriod !== savedExtra.defPeriod || lockup !== savedExtra.lockup;
  const up = (p: Partial<S>) => setS((x) => ({ ...x, ...p }));
  const lb = (p: Partial<S["leaderboard"]>) => setS((x) => ({ ...x, leaderboard: { ...x.leaderboard, ...p } }));
  const cp = (p: Partial<S["copy"]>) => setS((x) => ({ ...x, copy: { ...x.copy, ...p } }));

  const overPerf = MASTERS.filter((m) => m.perfFee > s.perfFeeMax || m.perfFee < s.perfFeeMin).length;
  const overMgmt = MASTERS.filter((m) => m.mgmtFee > s.mgmtFeeMax).length;
  const ineligible = MASTERS.filter((m) => m.maxDD >= s.leaderboard.maxDD || m.trades < s.leaderboard.minTrades).length;
  const profit = 10_000;
  const fee = (profit * 25) / 100;

  return (
    <div className="pb-16">
      <PageHeader
        title="Fee caps & rules"
        subtitle="Global limits for copy trading, PAMM and signal fees, and leaderboard eligibility"
        actions={
          <>
            {dirty && <Chip tone="warn" dot>Unsaved changes</Chip>}
            <Button variant="ghost" disabled={!dirty} onClick={() => { setS(saved); setDefPeriod(savedExtra.defPeriod); setLockup(savedExtra.lockup); }}>
              <RotateCcw /> Discard
            </Button>
            <Button
              variant="ember"
              disabled={!dirty}
              onClick={() =>
                reason.ask({
                  title: "Publish social trading rules",
                  description: `${overPerf + overMgmt} masters currently exceed the new caps and will be auto-clamped after a 7-day notice to their followers.`,
                  reasons: ["Quarterly policy review", "Regulatory requirement", "Competitive pricing", "Risk committee decision"],
                  confirmLabel: "Publish",
                  onConfirm: (r) => {
                    setSaved(s);
                    setSavedExtra({ defPeriod, lockup });
                    auditToast("Social trading rules published", r);
                  },
                })
              }
            >
              <Save /> Save changes
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-7">
          <Card className="h-full">
            <CardHeader title="Fee caps" subtitle="Limits masters can set on their followers and investors" action={overPerf + overMgmt > 0 ? <Chip tone="warn">{overPerf + overMgmt} masters outside caps</Chip> : <Chip tone="up">All masters compliant</Chip>} />
            <div className="space-y-6 px-4 pb-6 pt-5 sm:px-6">
              <div>
                <div className="mb-2 flex items-center justify-between text-[13px]">
                  <span className="font-medium">Performance fee range</span>
                  <span className="k-num text-fg-2">{s.perfFeeMin}% – {s.perfFeeMax}%</span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <MiniField label="Minimum"><Slider value={s.perfFeeMin} onChange={(v) => up({ perfFeeMin: Math.min(v, s.perfFeeMax - 5) })} max={30} marks={[0, 5, 10, 20, 30]} /></MiniField>
                  <MiniField label="Maximum"><Slider value={s.perfFeeMax} onChange={(v) => up({ perfFeeMax: Math.max(v, s.perfFeeMin + 5) })} min={10} max={60} step={5} marks={[10, 20, 30, 40, 50, 60]} /></MiniField>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <MiniField label="Max management fee" hint="per year"><NumInput value={s.mgmtFeeMax} onChange={(v) => up({ mgmtFeeMax: v })} step={0.5} min={0} max={10} suffix="%" /></MiniField>
                <MiniField label="Max subscription fee" hint="per month"><NumInput value={s.subscriptionFeeMax} onChange={(v) => up({ subscriptionFeeMax: v })} step={10} min={0} prefix="$" /></MiniField>
                <MiniField label="Max entry fee" hint="on deposit"><NumInput value={s.entryFeeMax} onChange={(v) => up({ entryFeeMax: v })} step={0.5} min={0} max={5} suffix="%" /></MiniField>
              </div>
              <div className="divide-y divide-line border-t border-line">
                <SettingRow label="High-water mark" hint="Performance fees only on new equity highs per investor">
                  <Toggle checked={s.highWaterMark} onChange={(v) => up({ highWaterMark: v })} label="High-water mark" />
                </SettingRow>
                <SettingRow label="Allowed rollover periods" hint="Masters and PAMM managers choose from these">
                  <div className="max-w-[340px]"><ChipList values={s.rolloverPeriods} onChange={(v) => up({ rolloverPeriods: v })} options={PERIODS} /></div>
                </SettingRow>
                <SettingRow label="Default rollover period">
                  <Select size="sm" className="w-32" value={defPeriod} onChange={setDefPeriod} options={s.rolloverPeriods.length ? s.rolloverPeriods : ["Monthly"]} />
                </SettingRow>
                <SettingRow label="Max PAMM lock-up" hint="Longest lock-up a fund may impose">
                  <NumInput size="sm" className="w-28" value={lockup} onChange={setLockup} min={0} max={180} suffix="days" />
                </SettingRow>
              </div>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.05} className="xl:col-span-5">
          <Card hot className="h-full overflow-hidden">
            <CardHeader title="Platform cut" subtitle="Broker share of every fee charged by masters" action={<Icon3D name="money_bag" size={44} />} />
            <div className="px-4 pb-6 pt-4 sm:px-6">
              <div className="k-num text-[44px] font-semibold leading-none tracking-tight">{s.platformCut}%</div>
              <Slider className="mt-4" value={s.platformCut} onChange={(v) => up({ platformCut: v })} max={50} marks={[0, 10, 20, 30, 40, 50]} />
              <div className="mt-6 text-[11.5px] uppercase tracking-wider text-fg-3">Worked example · 25% performance fee</div>
              <div className="mt-2 space-y-1.5">
                {[
                  ["Follower profit (above HWM)", profit],
                  ["Performance fee charged", fee],
                  ["Master receives", fee * (1 - s.platformCut / 100)],
                  ["Platform receives", fee * (s.platformCut / 100)],
                ].map(([k, v], i) => (
                  <div key={k as string} className={cn("flex items-center justify-between rounded-[12px] px-3.5 py-2.5 text-[13px]", i === 3 ? "border border-ember/40 bg-ember-soft" : "k-row")}>
                    <span className="text-fg-2">{k}</span>
                    <span className={cn("k-num font-medium", i === 3 && "text-ember")}>${(v as number).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex h-2 overflow-hidden rounded-full">
                <span className="bg-gold" style={{ width: `${100 - s.platformCut}%` }} />
                <span className="bg-ember" style={{ width: `${s.platformCut}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[11.5px] text-fg-3">
                <span>Master {100 - s.platformCut}%</span>
                <span>Platform {s.platformCut}%</span>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Reveal delay={0.1}>
          <Card className="h-full">
            <CardHeader title="Leaderboard eligibility" subtitle="Masters must meet all rules to be ranked and searchable" action={<Chip tone={ineligible ? "warn" : "up"}>{ineligible} of {MASTERS.length} sample masters ineligible</Chip>} />
            <div className="grid grid-cols-1 gap-3 px-4 pt-4 sm:grid-cols-3 sm:px-6">
              <MiniField label="Track record"><NumInput value={s.leaderboard.minDays} onChange={(v) => lb({ minDays: v })} step={15} min={0} suffix="days" /></MiniField>
              <MiniField label="Min equity"><NumInput value={s.leaderboard.minEquity} onChange={(v) => lb({ minEquity: v })} step={250} min={0} prefix="$" /></MiniField>
              <MiniField label="Max drawdown"><NumInput value={s.leaderboard.maxDD} onChange={(v) => lb({ maxDD: v })} step={5} min={5} max={100} suffix="%" /></MiniField>
              <MiniField label="Min trades"><NumInput value={s.leaderboard.minTrades} onChange={(v) => lb({ minTrades: v })} step={10} min={0} /></MiniField>
              <MiniField label="Min followers"><NumInput value={s.leaderboard.minFollowers} onChange={(v) => lb({ minFollowers: v })} step={1} min={0} /></MiniField>
            </div>
            <div className="divide-y divide-line px-4 pb-4 pt-2 sm:px-6">
              <SettingRow label="Require verified KYC"><Toggle checked={s.leaderboard.requireKyc} onChange={(v) => lb({ requireKyc: v })} label="Require KYC" /></SettingRow>
              <SettingRow label="Exclude martingale / grid strategies" hint="Detected by position-sizing analysis"><Toggle checked={s.leaderboard.excludeMartingale} onChange={(v) => lb({ excludeMartingale: v })} label="Exclude martingale" /></SettingRow>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15}>
          <Card className="h-full">
            <CardHeader title="Copy trading limits" subtitle="Protects followers and execution quality" />
            <div className="grid grid-cols-1 gap-3 px-4 pt-4 sm:grid-cols-3 sm:px-6">
              <MiniField label="Max followers / master"><NumInput value={s.copy.maxFollowersPerMaster} onChange={(v) => cp({ maxFollowersPerMaster: v })} step={500} min={0} /></MiniField>
              <MiniField label="Min copy amount"><NumInput value={s.copy.minCopyAmount} onChange={(v) => cp({ minCopyAmount: v })} step={10} min={0} prefix="$" /></MiniField>
              <MiniField label="Max slippage"><NumInput value={s.copy.maxSlippagePips} onChange={(v) => cp({ maxSlippagePips: v })} step={0.5} min={0} suffix="pips" /></MiniField>
            </div>
            <div className="divide-y divide-line px-4 pb-4 pt-2 sm:px-6">
              <SettingRow label="Allow reverse copy" hint="Followers may copy a master in the opposite direction"><Toggle checked={s.copy.allowReverseCopy} onChange={(v) => cp({ allowReverseCopy: v })} label="Reverse copy" /></SettingRow>
              <SettingRow label="Master fee cap breaches" hint="What happens to masters above new caps">
                <Chip tone="info">Clamp after 7-day notice</Chip>
              </SettingRow>
            </div>
          </Card>
        </Reveal>
      </div>
      {reason.node}
    </div>
  );
}

export default function SocialSettingsPage() {
  return IS_DEMO ? <DemoSocialSettingsPage /> : <LiveSocialSettingsPage />;
}
