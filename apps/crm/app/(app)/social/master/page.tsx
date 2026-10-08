"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck, Bot, Check, ChevronDown, ChevronRight, Clock, Copy as CopyIcon, Crown, FileText, Landmark, Layers, Percent, Save, Send, ShieldCheck, TrendingUp, Users, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  Field,
  Flag,
  Input,
  Menu,
  PageHeader,
  Progress,
  Reveal,
  Segmented,
  Sparkline,
  Toggle,
  cn,
  formatMoney,
} from "@/components/kit";
import { ACCOUNTS, ME, equitySeries } from "@ezymex/mock";
import { MASTER_APPLICATION, SOCIAL_POLICY, type MasterProgram, type Rollover } from "@ezymex/mock/social";
import { RadioCard, RangeSlider, ToggleChip } from "@/components/social/controls";
import { ProgramTags, RiskBadge } from "@/components/social/master-bits";
import { IS_DEMO as DEMO_BUILD } from "@ezymex/mock/mode";
import { LiveMasterPage } from "@/components/social-live/master-dashboard";

const TAGS = ["Gold", "Forex", "Indices", "Crypto", "Swing", "Intraday", "Scalping", "Algo", "Low risk", "News", "Swap-free"];
const LOCKS = [0, 7, 14, 30, 60, 90] as const;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDT = (iso: string) => {
  const d = new Date(Date.parse(iso) + 3 * 3600000);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MON[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

type ReqState = "ok" | "fail" | "wait";
function StateIcon({ s }: { s: ReqState }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full border [&_svg]:size-4",
        s === "ok" && "border-up/30 bg-up-soft text-up",
        s === "fail" && "border-down/30 bg-down-soft text-down",
        s === "wait" && "border-line bg-surface-3 text-fg-3",
      )}
    >
      {s === "ok" ? <Check /> : s === "fail" ? <XIcon /> : <Clock />}
    </span>
  );
}

function DemoBecomeMasterPage() {
  const live = ACCOUNTS.filter((a) => a.type === "live" && !a.cent);
  const [login, setLogin] = React.useState(MASTER_APPLICATION.account);
  const [program, setProgram] = React.useState<MasterProgram>("both");
  const [fee, setFee] = React.useState(25);
  const [rollover, setRollover] = React.useState<Rollover>("weekly");
  const [minInv, setMinInv] = React.useState(500);
  const [lock, setLock] = React.useState<(typeof LOCKS)[number]>(30);
  const [api, setApi] = React.useState(false);
  const [name, setName] = React.useState("Mumbai Gold Momentum");
  const [desc, setDesc] = React.useState("Swing trading gold and USD majors around London and New York sessions. Risk capped at 1.5% per idea with a hard stop on every position; no martingale, no grid.");
  const [tags, setTags] = React.useState<string[]>(["Gold", "Swing", "Forex"]);
  const acct = live.find((a) => a.login === login) ?? live[0]!;
  const spark = React.useMemo(() => equitySeries(94, acct.equity, 21).map((p) => p.value), [acct.equity]);
  const ret = (spark[spark.length - 1]! / spark[0]! - 1) * 100;
  const kycOk = ME.kycStatus === "verified";
  const pamm = program !== "copy";

  const reqs: { key: string; title: string; detail: React.ReactNode; state: ReqState; progress?: number; action?: React.ReactNode }[] = [
    {
      key: "kyc",
      title: "Identity verified (KYC)",
      detail: "Proof of address is under review — usually within 24 hours",
      state: kycOk ? "ok" : "fail",
      action: (
        <Link href="/profile/verification">
          <Button size="xs" variant="ember">
            Complete KYC <ChevronRight />
          </Button>
        </Link>
      ),
    },
    {
      key: "track",
      title: "Track record",
      detail: (
        <>
          <span className="k-num text-fg">{MASTER_APPLICATION.trackRecordDays}</span> / {SOCIAL_POLICY.minTrackRecordDays} days of live trading on #{acct.login}
        </>
      ),
      state: "ok",
      progress: 100,
    },
    {
      key: "capital",
      title: "Own capital in the fund",
      detail: (
        <>
          <span className="k-num text-fg">{MASTER_APPLICATION.ownCapitalPct}%</span> / minimum {SOCIAL_POLICY.minOwnCapitalPct}% · {formatMoney((acct.equity * MASTER_APPLICATION.ownCapitalPct) / 100, "USD", 0)} committed
        </>
      ),
      state: "ok",
      progress: (MASTER_APPLICATION.ownCapitalPct / 20) * 100,
    },
    {
      key: "account",
      title: "Strategy account selected",
      detail: `#${acct.login} · ${acct.group} · ${acct.mode === "hedging" ? "Hedging" : "Netting"} · 1:${acct.leverage}`,
      state: "ok",
      action: (
        <Menu
          width={260}
          trigger={
            <Button size="xs" variant="surface">
              Change <ChevronDown />
            </Button>
          }
          items={live.map((a) => ({
            label: (
              <span>
                <span className="font-mono">#{a.login}</span> · {a.group}
              </span>
            ),
            hint: formatMoney(a.equity, "USD", 0),
            onSelect: () => {
              setLogin(a.login);
              toast.success(`Account #${a.login} selected`, { description: "Its track record will be shown on your public profile." });
            },
          }))}
        />
      ),
    },
    { key: "admin", title: "Admin approval", detail: "Compliance and risk review after you submit · 1–3 business days", state: "wait" },
  ];
  const met = reqs.filter((r) => r.state === "ok").length;

  const submit = () => {
    if (!kycOk)
      return toast.error("Complete KYC before submitting", {
        description: "Your application is saved. We'll remind you once verification is approved.",
        action: { label: "Verify", onClick: () => (window.location.href = "/profile/verification") },
      });
    toast.success("Application submitted for approval");
  };

  return (
    <div className="pb-24">
      <PageHeader
        title="Become a master"
        subtitle="Share your strategy through copy trading, a PAMM fund, or both — and earn performance fees."
        actions={
          <>
            <Button variant="surface" size="lg" onClick={() => toast.success("Draft saved", { description: "You can come back and finish anytime." })}>
              <Save /> Save draft
            </Button>
            <Button variant="ember" size="lg" onClick={submit}>
              <Send /> Submit for approval
            </Button>
          </>
        }
      />

      <Reveal>
        <Card className="relative overflow-hidden">
          <img src="/assets/photos/trading-screen.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-[#2a130b]/40" />
          <div className="absolute -right-24 -top-28 size-80 rounded-full bg-ember/25 blur-3xl" />
          <div className="relative grid grid-cols-1 gap-6 p-6 sm:p-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div>
              <Chip tone="gold" className="mb-3">
                <Crown className="size-3.5" /> Ezymex Masters programme
              </Chip>
              <h2 className="max-w-xl text-[26px] font-medium leading-tight tracking-tight sm:text-[32px]">Turn your track record into a second income.</h2>
              <p className="mt-2 max-w-xl text-[14px] text-fg-2">
                Charge {SOCIAL_POLICY.perfFeeMin}–{SOCIAL_POLICY.perfFeeMax}% on new profits above the high-water mark. Ezymex handles allocation, reporting and payouts.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-1">
              {[
                { icon: <Percent />, t: "Performance fees", s: "Paid to your wallet after admin approval" },
                { icon: <Users />, t: "Grow AUM", s: "Featured on Discover once approved" },
                { icon: <Bot />, t: "API & algo welcome", s: "Run EAs or the Ezymex API on your account" },
              ].map((b) => (
                <div key={b.t} className="flex items-center gap-3 rounded-[16px] border border-white/10 light:border-line bg-black/35 light:bg-white/70 px-4 py-3 backdrop-blur">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ember/20 text-ember [&_svg]:size-4">{b.icon}</span>
                  <div>
                    <div className="text-[13.5px] font-medium">{b.t}</div>
                    <div className="text-[12px] text-fg-3">{b.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-8">
          <Reveal delay={0.05}>
            <Card>
              <CardHeader title="Requirements" subtitle="Checked live against your account" icon={<ShieldCheck />} action={<Chip tone={met === 4 ? "up" : "warn"}>{met} of 4 met</Chip>} />
              <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
                {reqs.map((r) => (
                  <div key={r.key} className={cn("k-row flex flex-wrap items-center gap-3 px-4 py-3", r.state === "fail" && "border-down/25")}>
                    <StateIcon s={r.state} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[13.5px] font-medium">
                        {r.title}
                        {r.state === "fail" && (
                          <Chip size="sm" tone="warn" dot>
                            Pending
                          </Chip>
                        )}
                      </div>
                      <div className="text-[12px] text-fg-3">{r.detail}</div>
                      {r.progress !== undefined && <Progress value={r.progress} tone="up" className="mt-2 max-w-sm" />}
                    </div>
                    {r.action}
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.08}>
            <Card>
              <CardHeader title="Programme" subtitle="How followers can access your strategy" icon={<Layers />} />
              <div role="radiogroup" className="grid grid-cols-1 gap-3 px-4 pb-5 pt-4 sm:grid-cols-3 sm:px-6">
                <RadioCard selected={program === "copy"} onSelect={() => setProgram("copy")} icon={<CopyIcon />} title="Copy signal" text="Followers mirror your trades in their own copy accounts. No pooled money." />
                <RadioCard selected={program === "pamm"} onSelect={() => setProgram("pamm")} icon={<Landmark />} title="PAMM fund" text="Investors buy NAV units of a pooled account you trade, with rollovers." />
                <RadioCard selected={program === "both"} onSelect={() => setProgram("both")} icon={<Crown />} title="Both" badge={<Chip size="sm" tone="gold">Popular</Chip>} text="Reach copiers and investors with one strategy and one track record." />
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.1}>
            <Card>
              <CardHeader title="Fees & terms" subtitle={`Within admin caps · performance fee ${SOCIAL_POLICY.perfFeeMin}–${SOCIAL_POLICY.perfFeeMax}%`} icon={<Percent />} />
              <div className="grid grid-cols-1 gap-6 px-4 pb-6 pt-5 sm:px-6 lg:grid-cols-2">
                <div className="lg:col-span-2">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[13px] font-medium text-fg-2">Performance fee · above high-water mark</span>
                    <span className="k-num text-[22px] font-semibold text-gold">{fee}%</span>
                  </div>
                  <RangeSlider value={fee} onChange={setFee} min={SOCIAL_POLICY.perfFeeMin} max={SOCIAL_POLICY.perfFeeMax} tone="gold" ticks={[10, 20, 30, 40, 50]} format={(v) => `${v}%`} label="Performance fee" />
                  <p className="mt-2 text-[12px] text-fg-3">
                    Example: a follower&apos;s $10,000 grows to $11,200 → you earn <span className="k-num text-fg">{formatMoney(1200 * (fee / 100))}</span>. If it later dips and recovers, no fee is charged until it passes $11,200 again.
                  </p>
                </div>
                <div className={cn(!pamm && "pointer-events-none opacity-40")}>
                  <div className="mb-2 text-[12.5px] font-medium text-fg-2">PAMM rollover {!pamm && <span className="font-normal text-fg-3">· PAMM only</span>}</div>
                  <Segmented
                    size="sm"
                    value={rollover}
                    onChange={setRollover}
                    options={[
                      { value: "daily", label: "Daily" },
                      { value: "weekly", label: "Weekly" },
                      { value: "monthly", label: "Monthly" },
                    ]}
                  />
                  <p className="mt-2 text-[11.5px] text-fg-3">Invest/redeem requests and fee settlement run at 00:00 GMT+3.</p>
                </div>
                <Field label="Minimum investment" hint="USD">
                  <Input type="number" min={50} value={minInv} onChange={(e) => setMinInv(Math.max(0, +e.target.value))} leading="$" />
                </Field>
                <div className={cn(!pamm && "pointer-events-none opacity-40")}>
                  <div className="mb-2 text-[12.5px] font-medium text-fg-2">Lock-in period</div>
                  <Segmented size="xs" value={String(lock) as `${(typeof LOCKS)[number]}`} onChange={(v) => setLock(+v as (typeof LOCKS)[number])} options={LOCKS.map((l) => ({ value: String(l) as `${(typeof LOCKS)[number]}`, label: l ? `${l}d` : "None" }))} />
                </div>
                <div className="flex items-center justify-between rounded-[14px] border border-line bg-surface-2 px-4 py-3">
                  <div>
                    <div className="text-[13px] font-medium">Trades via API / EA</div>
                    <div className="text-[11.5px] text-fg-3">Shown as an &quot;Algo&quot; badge on your profile</div>
                  </div>
                  <Toggle checked={api} onChange={setApi} label="API trading" />
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.12}>
            <Card>
              <CardHeader title="Strategy description" subtitle="Shown on your public profile" icon={<FileText />} />
              <div className="space-y-4 px-4 pb-6 pt-5 sm:px-6">
                <Field label="Strategy name" hint={`${name.length}/40`}>
                  <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Description" hint={`${desc.length}/400`}>
                  <textarea
                    value={desc}
                    maxLength={400}
                    onChange={(e) => setDesc(e.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-3 text-sm leading-relaxed text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10"
                  />
                </Field>
                <div>
                  <div className="mb-2 text-[12.5px] font-medium text-fg-2">Tags · up to 4</div>
                  <div className="flex flex-wrap gap-2">
                    {TAGS.map((t) => {
                      const on = tags.includes(t);
                      return (
                        <ToggleChip
                          key={t}
                          on={on}
                          onClick={() => {
                            if (!on && tags.length >= 4) return toast.error("Choose up to 4 tags");
                            setTags((x) => (on ? x.filter((y) => y !== t) : [...x, t]));
                          }}
                        >
                          {t}
                        </ToggleChip>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          </Reveal>
        </div>

        <div className="flex flex-col gap-4 xl:sticky xl:top-24 xl:col-span-4 xl:self-start">
          <Reveal delay={0.1}>
            <Card className="overflow-hidden">
              <CardHeader title="Public profile preview" subtitle="Updates as you type" />
              <div className="px-4 pb-5 pt-4 sm:px-6">
                <div className="k-row overflow-hidden p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar src={ME.photo} name={ME.name} size={48} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[15px] font-medium">
                          {ME.name} <Flag country={ME.country} className="size-3.5" />
                        </div>
                        <div className="truncate text-[12.5px] text-fg-3">{name || "Your strategy name"}</div>
                      </div>
                    </div>
                    <RiskBadge risk={4} />
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <div className="text-[12px] text-fg-3">Return · 3M</div>
                      <div className={cn("k-num text-[24px] font-semibold", ret >= 0 ? "text-up" : "text-down")}>
                        {ret >= 0 ? "+" : ""}
                        {ret.toFixed(1)}%
                      </div>
                    </div>
                    <Sparkline data={spark} width={120} height={42} />
                  </div>
                  <p className="mt-3 line-clamp-3 text-[12.5px] leading-relaxed text-fg-2">{desc || "Describe how you trade, your risk rules and markets."}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span key={t} className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10.5px] text-fg-2">
                        {t}
                      </span>
                    ))}
                    {api && <span className="rounded-md bg-ember-soft px-1.5 py-0.5 text-[10.5px] text-ember">API</span>}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-[12px]">
                    {[
                      ["Perf. fee", `${fee}%`],
                      ["Min", `$${minInv.toLocaleString()}`],
                      ["Lock-in", pamm ? (lock ? `${lock}d` : "None") : "—"],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-[10px] bg-surface-3/60 px-2.5 py-2">
                        <div className="text-fg-3">{k}</div>
                        <div className="k-num font-medium">{v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <ProgramTags program={program} />
                    <span className="flex items-center gap-1 text-[11.5px] text-fg-3">
                      <TrendingUp className="size-3" /> {MASTER_APPLICATION.trackRecordDays}d record
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.14}>
            <Card>
              <CardHeader title="Application status" subtitle="Draft · not yet submitted" icon={<BadgeCheck />} />
              <ol className="px-6 pb-6 pt-5">
                {MASTER_APPLICATION.timeline.map((t, i, arr) => {
                  const current = !t.done && (i === 0 || arr[i - 1]!.done);
                  return (
                    <li key={t.key} className="relative flex gap-3.5 pb-4 last:pb-0">
                      {i < arr.length - 1 && <span className={cn("absolute left-[13px] top-8 h-[calc(100%-26px)] w-px", t.done ? "bg-up/50" : "bg-line")} />}
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
                          t.done && "border-up/40 bg-up-soft text-up",
                          current && "border-ember/50 bg-ember-soft text-ember shadow-[0_0_18px_-4px_color-mix(in_oklab,var(--k-ember)_70%,transparent)]",
                          !t.done && !current && "border-line text-fg-3",
                        )}
                      >
                        {t.done ? <Check className="size-3.5" /> : i + 1}
                      </span>
                      <div className="pt-0.5">
                        <div className={cn("text-[13px] font-medium", !t.done && !current && "text-fg-3")}>{t.label}</div>
                        <div className="text-[11.5px] text-fg-3">{t.date ? fmtDT(t.date) + " GMT+3" : current ? "Action needed — waiting on proof of address" : "Pending"}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="px-6 pb-6">
                <Button variant="ember" className="w-full" onClick={submit}>
                  <Send /> Submit for approval
                </Button>
                {!kycOk && <p className="mt-2 text-center text-[11.5px] text-fg-3">Available once your KYC is verified</p>}
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

export default function BecomeMasterPage() {
  return DEMO_BUILD ? <DemoBecomeMasterPage /> : <LiveMasterPage />;
}
