"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Check, Clock, Copy as CopyIcon, Crown, FileText, KeyRound, Landmark, Layers, Loader2, Pencil, Percent, Plus, Send, ShieldCheck, TriangleAlert, Users, Wallet, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, DataTable, Dialog, EmptyState, Field, Input, KpiCard, Money, PageHeader, Segmented, StatusChip, cn, type Column } from "@kalks/ui";
import { RadioCard, RangeSlider } from "@/components/social/controls";
import { SecretField, TradeButton } from "@/components/trading/ui";
import { fmtDate, serverTime } from "@/components/trading/api";
import {
  ApiError,
  PERIOD_LABEL,
  compactUsd,
  nav4,
  pct,
  sizingText,
  socialApi,
  units4,
  usd,
  useSocial,
  type Candidate,
  type Check as ReqCheck,
  type DashboardFund,
  type FeePeriod,
  type FeeView,
  type FundView,
  type MasterDashboard,
  type MasterMe,
  type MasterView,
  type Program,
  type RequestView,
  type SocialSettings,
} from "./api";
import { BlockSkeleton, InfoBox, ProgramTags, RiskBadge, SocialError, Tile, useNumber } from "./bits";
import { FundDetailDrawer, FundStatusChip } from "./funds";
import { FEE_STATUS_TONE } from "./subscriptions";

const PERIODS: FeePeriod[] = ["daily", "weekly", "monthly"];
const LOCKS = [0, 7, 14, 30, 60, 90];

const textareaCls =
  "w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-3 text-sm leading-relaxed text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10";

function StateIcon({ ok }: { ok: boolean | null }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full border [&_svg]:size-4",
        ok === true && "border-up/30 bg-up-soft text-up",
        ok === false && "border-down/30 bg-down-soft text-down",
        ok === null && "border-line bg-surface-3 text-fg-3",
      )}
    >
      {ok === true ? <Check /> : ok === false ? <XIcon /> : <Clock />}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Application                                                         */
/* ------------------------------------------------------------------ */

function ApplyView({ me, onApplied, rejected }: { me: MasterMe; onApplied: () => void; rejected?: MasterView }) {
  const s = me.settings;
  const cands = me.candidates;
  const [login, setLogin] = React.useState<number | null>(rejected?.login ?? cands.find((c) => c.eligible)?.login ?? cands[0]?.login ?? null);
  const [program, setProgram] = React.useState<Program>(rejected?.program ?? "copy");
  const [fee, setFee] = React.useState(Math.min(s.feeMaxPct, Math.max(s.feeMinPct, rejected?.perfFeePct ?? 20)));
  const [period, setPeriod] = React.useState<FeePeriod>(rejected?.feePeriod ?? "monthly");
  const minAlloc = useNumber(rejected?.minAllocation ?? s.minAllocation);
  const [nickname, setNickname] = React.useState(rejected?.nickname ?? "");
  const [strategy, setStrategy] = React.useState(rejected?.strategy ?? "");
  const [desc, setDesc] = React.useState(rejected?.description ?? "");
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState<ReqCheck[] | null>(null);

  const cand: Candidate | undefined = cands.find((c) => c.login === login);
  const checks = failed && cand ? failed : cand?.checks ?? [];
  const met = checks.filter((c) => c.ok).length;
  const nickErr = nickname && (nickname.trim().length < 3 || nickname.trim().length > 32) ? "3 to 32 characters" : undefined;
  const minErr = minAlloc.raw && !(minAlloc.value! >= s.minAllocation) ? `At least ${usd(s.minAllocation, 0)}` : undefined;
  const ready = !!cand && nickname.trim().length >= 3 && !nickErr && strategy.trim().length > 0 && desc.trim().length > 0 && !minErr;

  const submit = async () => {
    if (!cand) return toast.error("Choose a live account first");
    if (!ready) return toast.error("Complete the nickname, strategy and description");
    setBusy(true);
    setFailed(null);
    try {
      const body: Record<string, unknown> = { login: cand.login, nickname: nickname.trim(), strategy: strategy.trim(), description: desc.trim(), program, perfFeePct: fee, feePeriod: period };
      if (minAlloc.value !== null) body.minAllocation = minAlloc.value;
      await socialApi("master/apply", { body });
      toast.success("Application submitted", { description: "Our team reviews it, usually within 1–3 business days." });
      onApplied();
    } catch (e) {
      const checksErr = (e as ApiError & { checks?: ReqCheck[] }).checks;
      if (checksErr?.length) setFailed(checksErr);
      toast.error("Couldn't submit the application", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="flex flex-col gap-4 xl:col-span-8">
        <Card>
          <CardHeader
            title="Requirements"
            subtitle="Checked live against your account"
            icon={<ShieldCheck />}
            action={cand ? <Chip tone={met === checks.length ? "up" : "warn"}>{met} of {checks.length} met</Chip> : undefined}
          />
          <div className="space-y-3 px-4 pb-5 pt-4 sm:px-6">
            {cands.length === 0 ? (
              <EmptyState
                illustration="identification_card"
                title="You need a live account"
                text={`Masters trade a live account with at least ${s.minTrackDays} days of history and ${usd(s.minMasterEquity, 0)} in equity.`}
                action={
                  <Link href="/accounts/new">
                    <Button variant="ember">
                      <Plus /> Open a live account
                    </Button>
                  </Link>
                }
              />
            ) : (
              <>
                <div>
                  <div className="mb-2 text-[12.5px] font-medium text-fg-2">Strategy account</div>
                  <div className="flex flex-wrap gap-2">
                    {cands.map((c) => (
                      <button
                        key={c.login}
                        type="button"
                        onClick={() => {
                          setLogin(c.login);
                          setFailed(null);
                        }}
                        className={cn(
                          "rounded-[14px] border px-3.5 py-2 text-left transition-colors",
                          c.login === login ? "border-ember/50 bg-ember-soft" : "border-line bg-surface-2 hover:bg-surface-3",
                        )}
                      >
                        <div className="flex items-center gap-2 font-mono text-[13px]">
                          #{c.login} {c.eligible ? <Check className="size-3.5 text-up" /> : <XIcon className="size-3.5 text-down" />}
                        </div>
                        <div className="text-[11.5px] text-fg-3">
                          {c.group} · {usd(c.equity, 0)} · {c.ageDays}d
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                {checks.map((r) => (
                  <div key={r.key} className={cn("k-row flex flex-wrap items-center gap-3 px-4 py-3", !r.ok && "border-down/25")}>
                    <StateIcon ok={r.ok} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium">{r.label}</div>
                      <div className="text-[12px] text-fg-3">{r.detail}</div>
                    </div>
                    {!r.ok && r.key === "kyc" && (
                      <Link href="/profile/verification">
                        <Button size="xs" variant="ember">
                          Verify identity
                        </Button>
                      </Link>
                    )}
                  </div>
                ))}
                <div className="k-row flex items-center gap-3 px-4 py-3">
                  <StateIcon ok={null} />
                  <div>
                    <div className="text-[13.5px] font-medium">Approval by our team</div>
                    <div className="text-[12px] text-fg-3">Compliance and risk review after you submit · usually 1–3 business days</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Programme" subtitle="How clients can access your strategy" icon={<Layers />} />
          <div role="radiogroup" className="grid grid-cols-1 gap-3 px-4 pb-5 pt-4 sm:grid-cols-3 sm:px-6">
            <RadioCard selected={program === "copy"} onSelect={() => setProgram("copy")} icon={<CopyIcon />} title="Copy trading" text="Followers mirror your trades in their own copy accounts. No pooled money." />
            <RadioCard selected={program === "pamm"} onSelect={() => setProgram("pamm")} icon={<Landmark />} title="PAMM fund" text="Investors buy NAV units of a pooled account you trade, with rollovers." />
            <RadioCard selected={program === "both"} onSelect={() => setProgram("both")} icon={<Crown />} title="Both" text="Reach copiers and investors with one strategy and one track record." />
          </div>
          {program !== "copy" && (
            <div className="px-4 pb-5 sm:px-6">
              <InfoBox>After approval you open the fund from this page with seed capital from your wallet. You keep at least {s.minOwnCapitalPct}% of the fund&apos;s units at all times.</InfoBox>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Fees & terms" subtitle={`Performance fee ${s.feeMinPct}–${s.feeMaxPct}% above the high-water mark`} icon={<Percent />} />
          <div className="grid grid-cols-1 gap-6 px-4 pb-6 pt-5 sm:px-6 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[13px] font-medium text-fg-2">Performance fee</span>
                <span className="k-num text-[22px] font-semibold text-gold">{fee}%</span>
              </div>
              <RangeSlider value={fee} onChange={setFee} min={s.feeMinPct} max={s.feeMaxPct} tone="gold" format={(v) => `${v}%`} label="Performance fee" />
              <p className="mt-2 text-[12px] text-fg-3">
                Example: a follower&apos;s {usd(10000, 0)} grows to {usd(11200, 0)} → the fee is {usd(1200 * (fee / 100))}; you receive it minus the platform share of {s.platformCutPct}% after approval. If the account dips and recovers, no fee is due until it passes {usd(11200, 0)} again.
              </p>
            </div>
            <div>
              <div className="mb-2 text-[12.5px] font-medium text-fg-2">Copy fee settlement</div>
              <Segmented size="sm" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
              <p className="mt-2 text-[11.5px] text-fg-3">Fees are settled at the server-day rollover at the end of each period.</p>
            </div>
            <Field label="Minimum allocation" hint={`USD · at least ${usd(s.minAllocation, 0)}`} error={minErr}>
              <Input type="number" inputMode="decimal" min={s.minAllocation} value={minAlloc.raw} onChange={(e) => minAlloc.setRaw(e.target.value)} leading="$" inputClassName="k-num" />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Public profile" subtitle="Shown on the leaderboard. Use a nickname, not your personal name." icon={<FileText />} />
          <div className="space-y-4 px-4 pb-6 pt-5 sm:px-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nickname" hint={`${nickname.length}/32`} error={nickErr}>
                <Input value={nickname} maxLength={32} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Gold Swing" />
              </Field>
              <Field label="Strategy" hint={`${strategy.length}/60`}>
                <Input value={strategy} maxLength={60} onChange={(e) => setStrategy(e.target.value)} placeholder="e.g. Gold swing, London and New York" />
              </Field>
            </div>
            <Field label="Description" hint={`${desc.length}/1000`}>
              <textarea value={desc} maxLength={1000} onChange={(e) => setDesc(e.target.value)} rows={5} placeholder="How you trade, your risk rules and markets." className={textareaCls} />
            </Field>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-4 xl:sticky xl:top-24 xl:col-span-4 xl:self-start">
        <Card>
          <CardHeader title="Profile preview" subtitle="As clients will see it" />
          <div className="px-4 pb-5 pt-4 sm:px-6">
            <div className="k-row p-4">
              <div className="flex items-center gap-3">
                <Avatar name={nickname || "Master"} size={48} />
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-medium">{nickname || "Your nickname"}</div>
                  <div className="truncate text-[12.5px] text-fg-3">{strategy || "Your strategy"}</div>
                </div>
              </div>
              <p className="mt-3 line-clamp-4 whitespace-pre-line text-[12.5px] leading-relaxed text-fg-2">{desc || "Describe how you trade, your risk rules and markets."}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[12px]">
                {[
                  ["Fee", `${fee}%`],
                  ["Min", usd(minAlloc.value ?? 0, 0)],
                  ["Settles", PERIOD_LABEL[period]],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-[10px] bg-surface-3/60 px-2.5 py-2">
                    <div className="text-fg-3">{k}</div>
                    <div className="k-num font-medium">{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <ProgramTags program={program} />
                {cand && <span className="text-[11.5px] text-fg-3">{cand.ageDays}d track record</span>}
              </div>
            </div>
            <p className="mt-3 text-[11.5px] text-fg-3">Returns, drawdown and the risk score are calculated by the platform from your account after approval.</p>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <Button variant="ember" className="w-full" onClick={submit} disabled={busy || !ready || !cand}>
              {busy ? <Loader2 className="animate-spin" /> : <Send />} Submit for approval
            </Button>
            {cand && !cand.eligible && <p className="mt-2 text-center text-[11.5px] text-fg-3">This account doesn&apos;t meet every requirement yet; the application may be refused.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatusCard({ m }: { m: MasterView }) {
  const tone = m.status === "pending" ? "warn" : "down";
  return (
    <Card className="mb-4">
      <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
        <span className={cn("grid size-12 shrink-0 place-items-center rounded-full border", tone === "warn" ? "border-warn/30 bg-warn-soft text-warn" : "border-down/30 bg-down-soft text-down")}>
          {m.status === "pending" ? <Clock className="size-6" /> : <TriangleAlert className="size-6" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[18px] font-medium tracking-tight">
              {m.status === "pending" ? "Application under review" : m.status === "rejected" ? "Application not approved" : "Master profile suspended"}
            </h2>
            <StatusChip status={m.status} />
          </div>
          <p className="mt-1 text-[13.5px] text-fg-2">
            {m.status === "pending"
              ? "Our compliance and risk team reviews your account and profile, usually within 1–3 business days. We'll email you with the decision."
              : m.status === "rejected"
                ? "You can update your details and apply again below."
                : "Your profile is hidden and followers can't start new subscriptions. Contact support for details."}
          </p>
          {m.reviewNote && (
            <div className="mt-3 rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[13px]">
              <div className="text-[11px] uppercase tracking-wider text-fg-3">Note from our team</div>
              <div className="mt-1 whitespace-pre-line text-fg">{m.reviewNote}</div>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Nickname">{m.nickname}</Tile>
            <Tile label="Account">{m.login ? `#${m.login}` : "—"}</Tile>
            <Tile label="Programme">{m.program === "both" ? "Copy + PAMM" : m.program === "pamm" ? "PAMM" : "Copy"}</Tile>
            <Tile label="Fee">{m.perfFeePct}% · {PERIOD_LABEL[m.feePeriod].toLowerCase()}</Tile>
          </div>
          {m.createdAt && <div className="mt-3 text-[12px] text-fg-3">Submitted {serverTime(m.createdAt)} (server time)</div>}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Approved: dialogs                                                   */
/* ------------------------------------------------------------------ */

function EditProfileDialog({ m, settings, open, onOpenChange, onSaved }: { m: MasterView; settings: SocialSettings; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [nickname, setNickname] = React.useState(m.nickname);
  const [strategy, setStrategy] = React.useState(m.strategy);
  const [desc, setDesc] = React.useState(m.description);
  const [fee, setFee] = React.useState(m.perfFeePct);
  const [period, setPeriod] = React.useState<FeePeriod>(m.feePeriod);
  const minAlloc = useNumber(m.minAllocation);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    setNickname(m.nickname);
    setStrategy(m.strategy);
    setDesc(m.description);
    setFee(m.perfFeePct);
    setPeriod(m.feePeriod);
    minAlloc.set(m.minAllocation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    const body: Record<string, unknown> = {};
    if (nickname.trim() !== m.nickname) body.nickname = nickname.trim();
    if (strategy.trim() !== m.strategy) body.strategy = strategy.trim();
    if (desc.trim() !== m.description) body.description = desc.trim();
    if (fee !== m.perfFeePct) body.perfFeePct = fee;
    if (period !== m.feePeriod) body.feePeriod = period;
    if (minAlloc.value !== null && minAlloc.value !== m.minAllocation) body.minAllocation = minAlloc.value;
    if (!Object.keys(body).length) return onOpenChange(false);
    setBusy(true);
    try {
      await socialApi("master/me", { method: "PATCH", body });
      toast.success("Profile updated", { description: body.perfFeePct !== undefined || body.feePeriod !== undefined ? "New fee terms apply to new subscriptions only." : undefined });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error("Couldn't update the profile", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={620}
      title="Edit profile and terms"
      description="Fee changes apply to new subscriptions only; existing followers keep their rate."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="ember" onClick={save} disabled={busy || nickname.trim().length < 3 || !strategy.trim()}>
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nickname" hint={`${nickname.length}/32`}>
            <Input value={nickname} maxLength={32} onChange={(e) => setNickname(e.target.value)} />
          </Field>
          <Field label="Strategy" hint={`${strategy.length}/60`}>
            <Input value={strategy} maxLength={60} onChange={(e) => setStrategy(e.target.value)} />
          </Field>
        </div>
        <Field label="Description" hint={`${desc.length}/1000`}>
          <textarea value={desc} maxLength={1000} onChange={(e) => setDesc(e.target.value)} rows={4} className={textareaCls} />
        </Field>
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[12.5px] font-medium text-fg-2">Performance fee</span>
            <span className="k-num text-[18px] font-semibold text-gold">{fee}%</span>
          </div>
          <RangeSlider value={fee} onChange={setFee} min={settings.feeMinPct} max={settings.feeMaxPct} tone="gold" format={(v) => `${v}%`} label="Performance fee" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">Fee settlement</div>
            <Segmented size="sm" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
          </div>
          <Field label="Minimum allocation" hint="USD">
            <Input type="number" inputMode="decimal" min={settings.minAllocation} value={minAlloc.raw} onChange={(e) => minAlloc.setRaw(e.target.value)} leading="$" inputClassName="k-num" />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

type Creds = { login: number; password?: string; investorPassword?: string };

function FundFormDialog({ fund, settings, open, onOpenChange, onSaved }: { fund: DashboardFund | null; settings: SocialSettings; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const create = !fund;
  const [name, setName] = React.useState("");
  const [period, setPeriod] = React.useState<FeePeriod>("weekly");
  const [fee, setFee] = React.useState(20);
  const [lock, setLock] = React.useState(30);
  const minInv = useNumber(100);
  const maxDd = useNumber(35);
  const seed = useNumber(null);
  const [busy, setBusy] = React.useState(false);
  const [creds, setCreds] = React.useState<{ fund: FundView; credentials: Creds } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setCreds(null);
    setName(fund?.name ?? "");
    setPeriod(fund?.period ?? "weekly");
    setFee(Math.min(settings.feeMaxPct, Math.max(settings.feeMinPct, fund?.perfFeePct ?? 20)));
    setLock(fund?.lockInDays ?? 30);
    minInv.set(fund?.minInvestment ?? 100);
    maxDd.set(fund?.maxDdPct ?? 35);
    seed.set(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fund?.id]);

  const err =
    name.trim().length < 3 ? "Enter a fund name (3–40 characters)" : !(minInv.value! >= 0) ? "Enter a minimum investment" : !(maxDd.value! >= 1 && maxDd.value! <= 99) ? "Max drawdown must be 1–99%" : create && !(seed.value! > 0) ? "Enter the seed capital" : undefined;

  const save = async () => {
    if (err) return toast.error(err);
    setBusy(true);
    try {
      const body: Record<string, unknown> = { name: name.trim(), period, perfFeePct: fee, lockInDays: lock, minInvestment: minInv.value, maxDdPct: maxDd.value };
      if (create) {
        body.seed = seed.value;
        const r = await socialApi<{ fund: FundView; credentials: Creds }>("funds", { body });
        setCreds(r);
        toast.success(`${r.fund.name} is open`, { description: `Fund account #${r.credentials.login} · seeded with ${usd(seed.value ?? 0)} at NAV 1.0000` });
      } else {
        await socialApi(`funds/${fund!.id}`, { method: "PATCH", body });
        toast.success("Fund terms updated");
        onOpenChange(false);
      }
      onSaved();
    } catch (e) {
      toast.error(create ? "Couldn't open the fund" : "Couldn't update the fund", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  if (creds) {
    const c = creds.credentials;
    const copyAll = () => {
      const text = [`Login: ${c.login}`, "Server: Kalks-Live", c.password ? `Trading password: ${c.password}` : null, c.investorPassword ? `Investor password: ${c.investorPassword}` : null].filter(Boolean).join("\n");
      navigator.clipboard?.writeText(text).then(
        () => toast.success("Credentials copied", { description: "Store them in a password manager." }),
        () => toast.error("Couldn't copy, please copy each field instead"),
      );
    };
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        width={560}
        title={`${creds.fund.name} is open`}
        description="Trade the fund account in Kalks Trader with these credentials."
        footer={
          <>
            <Button variant="surface" onClick={() => onOpenChange(false)}>
              Done
            </Button>
            <TradeButton a={{ login: c.login, status: "active" }} size="md" label="Trade the fund" />
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[15px] font-medium">
              <KeyRound className="size-4 text-fg-3" /> Fund account credentials
            </div>
            <Button size="xs" variant="surface" onClick={copyAll}>
              <CopyIcon /> Copy all
            </Button>
          </div>
          <SecretField label="Login" value={String(c.login)} />
          <SecretField label="Server" value="Kalks-Live" />
          {c.password && <SecretField label="Trading password" value={c.password} secret hint="Full access" />}
          {c.investorPassword && <SecretField label="Investor password" value={c.investorPassword} secret hint="Read-only" />}
          <InfoBox tone="warn" icon={<TriangleAlert />}>
            These passwords are shown <b className="text-fg">only once</b> and are not stored by the Client Area. Save them now; you can set new ones under the account&apos;s Credentials tab.
          </InfoBox>
          <InfoBox>Money moves in and out of the fund only through investor requests at rollover; wallet transfers on this account are refused.</InfoBox>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={620}
      title={create ? "Create a PAMM fund" : `Edit ${fund!.name}`}
      description={create ? "A pooled live account you trade. Your seed capital buys the first units at NAV 1.0000." : "Changes apply from the next rollover."}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="ember" onClick={save} disabled={busy || !!err}>
            {busy && <Loader2 className="animate-spin" />} {create ? "Create fund" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Fund name" hint={`${name.length}/40`}>
          <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gold Swing Fund" />
        </Field>
        <div>
          <div className="mb-2 text-[12.5px] font-medium text-fg-2">Rollover</div>
          <Segmented size="sm" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
          <p className="mt-2 text-[11.5px] text-fg-3">Invest and redeem requests and fees run at 00:00 server time; weekly rolls into Monday, monthly into the 1st.</p>
        </div>
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[12.5px] font-medium text-fg-2">Performance fee</span>
            <span className="k-num text-[18px] font-semibold text-gold">{fee}%</span>
          </div>
          <RangeSlider value={fee} onChange={setFee} min={settings.feeMinPct} max={settings.feeMaxPct} tone="gold" format={(v) => `${v}%`} label="Performance fee" />
        </div>
        <div>
          <div className="mb-2 text-[12.5px] font-medium text-fg-2">Lock-in period</div>
          <Segmented size="xs" value={String(lock)} onChange={(v) => setLock(+v)} options={LOCKS.map((l) => ({ value: String(l), label: l ? `${l}d` : "None" }))} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Minimum investment" hint="USD">
            <Input type="number" inputMode="decimal" min={0} value={minInv.raw} onChange={(e) => minInv.setRaw(e.target.value)} leading="$" inputClassName="k-num" />
          </Field>
          <Field label="Max drawdown" hint="Freeze at">
            <Input type="number" inputMode="decimal" min={1} max={99} value={maxDd.raw} onChange={(e) => maxDd.setRaw(e.target.value)} trailing="%" inputClassName="k-num" />
          </Field>
          {create && (
            <Field label="Seed capital" hint="From your wallet">
              <Input type="number" inputMode="decimal" min={0} value={seed.raw} onChange={(e) => seed.setRaw(e.target.value)} leading="$" inputClassName="k-num" />
            </Field>
          )}
        </div>
        {create && (
          <InfoBox>
            The seed is debited from your wallet now. You must keep at least {settings.minOwnCapitalPct}% of the fund&apos;s units; investments that would push your share lower are refused. If NAV falls {maxDd.value ?? "—"}% below its peak, the fund is frozen and every position closes.
          </InfoBox>
        )}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Approved: dashboard                                                 */
/* ------------------------------------------------------------------ */

function FundBlock({ f, onEdit, onOpen }: { f: DashboardFund; onEdit: () => void; onOpen: () => void }) {
  const investors = Array.isArray(f.investors) ? f.investors : [];
  const investorCount = Array.isArray(f.investors) ? f.investors.length : f.investors;
  const pending = Array.isArray(f.pending) ? (f.pending as RequestView[]).filter((r) => r.status === "pending").length : f.pending;
  type Inv = (typeof investors)[number];
  const cols: Column<Inv>[] = [
    { key: "id", header: "Investor", cell: (i) => <span className="font-mono text-[12px] text-fg-2">#{i.investorId}</span> },
    { key: "u", header: "Units", align: "right", cell: (i) => <span className="k-num">{units4(i.units)}</span> },
    { key: "v", header: "Value", align: "right", cell: (i) => <span className="k-num">{usd(i.value)}</span>, sort: (i) => i.value },
    { key: "s", header: "Since", align: "right", cell: (i) => <span className="text-fg-2">{fmtDate(i.since)}</span>, hideOn: "sm" },
  ];
  return (
    <div className="k-row px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-medium hover:text-ember">{f.name}</span>
            <FundStatusChip status={f.status} />
          </div>
          <div className="text-[12px] text-fg-3">
            {f.login ? <span className="font-mono">#{f.login}</span> : null} · {PERIOD_LABEL[f.period].toLowerCase()} rollover · next {serverTime(f.nextRolloverAt, false)}
          </div>
        </button>
        <div className="flex flex-wrap gap-2">
          <Button size="xs" variant="surface" onClick={onEdit}>
            <Pencil /> Edit terms
          </Button>
          {f.login ? <TradeButton a={{ login: f.login, status: f.status === "closed" ? "disabled" : "active" }} size="xs" /> : null}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="NAV">{nav4(f.nav)}</Tile>
        <Tile label="Equity">{compactUsd(f.equity)}</Tile>
        <Tile label="Investor AUM">{compactUsd(f.aum)}</Tile>
        <Tile label="Investors">{investorCount}</Tile>
        <Tile label="Your share">{f.masterSharePct.toFixed(1)}%</Tile>
        <Tile label="Pending">{pending}</Tile>
      </div>
      {investors.length > 0 && (
        <div className="mt-3">
          <DataTable columns={cols} rows={investors} dense pageSize={8} rowKey={(i) => String(i.investorId)} />
        </div>
      )}
    </div>
  );
}

function Dashboard({ me, reloadMe }: { me: MasterMe; reloadMe: () => void }) {
  const { data, error, reload } = useSocial<MasterDashboard>("master/dashboard", 15000);
  const [edit, setEdit] = React.useState(false);
  const [fundForm, setFundForm] = React.useState<{ fund: DashboardFund | null } | null>(null);
  const [openFund, setOpenFund] = React.useState<number | null>(null);
  const m = data?.master ?? me.master!;
  const s = m.stats;

  const followCols: Column<MasterDashboard["followers"][number]>[] = [
    { key: "id", header: "Subscription", cell: (f) => <span className="font-mono text-[12px] text-fg-2">#{f.subscriptionId}</span> },
    { key: "since", header: "Since", cell: (f) => <span className="text-fg-2">{fmtDate(f.since)}</span>, sort: (f) => f.since, hideOn: "sm" },
    { key: "st", header: "Status", cell: (f) => <StatusChip status={f.status} /> },
    { key: "sz", header: "Sizing", cell: (f) => <span className="text-fg-2">{sizingText(f.sizing)}</span>, hideOn: "md" },
    { key: "eq", header: "Equity", align: "right", cell: (f) => <span className="k-num">{usd(f.equity)}</span>, sort: (f) => f.equity },
    { key: "pl", header: "Profit", align: "right", cell: (f) => <span className={cn("k-num", f.profit > 0 ? "text-up" : f.profit < 0 ? "text-down" : "")}>{usd(f.profit, 2, true)}</span>, sort: (f) => f.profit },
  ];
  const feeCols: Column<FeeView>[] = [
    { key: "at", header: "Period end", cell: (f) => <span className="whitespace-nowrap text-fg-2">{fmtDate(f.periodEnd)}</span>, sort: (f) => f.periodEnd },
    { key: "src", header: "Source", cell: (f) => <span>{f.source === "copy" ? `Copy #${f.subscriptionId ?? ""}` : `PAMM fund #${f.fundId ?? ""}`}</span> },
    { key: "a", header: "Fee", align: "right", cell: (f) => <span className="k-num">{usd(f.amount)}</span>, hideOn: "sm" },
    { key: "c", header: "Platform", align: "right", cell: (f) => <span className="k-num text-fg-3">{usd(f.platformCut)}</span>, hideOn: "md" },
    { key: "m", header: "You receive", align: "right", cell: (f) => <span className="k-num font-medium">{usd(f.masterAmount)}</span>, sort: (f) => f.masterAmount },
    { key: "s", header: "Status", align: "right", cell: (f) => <Chip size="sm" tone={FEE_STATUS_TONE[f.status] ?? "neutral"}>{f.status}</Chip> },
  ];

  return (
    <>
      <Card className="mb-4">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center">
          <Avatar name={m.nickname} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[20px] font-medium tracking-tight">{m.nickname}</h2>
              <Chip tone="up" size="sm">
                <BadgeCheck className="size-3" /> Approved
              </Chip>
              {m.hidden && <Chip size="sm">Hidden from leaderboard</Chip>}
              {m.frozen && <Chip tone="down" size="sm">Copying frozen by risk team</Chip>}
              <ProgramTags program={m.program} />
            </div>
            <div className="mt-0.5 text-[13.5px] text-fg-2">{m.strategy}</div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fg-3">
              {m.login && <span>Strategy account <span className="font-mono text-fg-2">#{m.login}</span></span>}
              <span>Fee {m.perfFeePct}% · {PERIOD_LABEL[m.feePeriod].toLowerCase()}</span>
              <span>Min allocation {usd(m.minAllocation, 0)}</span>
              <span>Master since {fmtDate(m.since)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/social/masters/${m.id}`}>
              <Button variant="surface">
                Public profile <ArrowUpRight />
              </Button>
            </Link>
            <Button variant="surface" onClick={() => setEdit(true)}>
              <Pencil /> Edit
            </Button>
            {m.login && <TradeButton a={{ login: m.login, status: "active" }} size="md" />}
          </div>
        </div>
      </Card>

      {error && !data ? (
        <SocialError onRetry={reload} message={error.message} title="Dashboard unavailable" />
      ) : !data ? (
        <BlockSkeleton n={3} h={120} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Followers" icon={<Users />} value={<span className="k-num">{data.totals.followers}</span>} chip={`${s.investors} PAMM investor${s.investors === 1 ? "" : "s"}`} />
            <KpiCard label="Assets under mgmt." icon={<Wallet />} value={<span className="k-num">{compactUsd(data.totals.aum)}</span>} chip="Copy equity + fund capital" delay={0.04} />
            <KpiCard label="Fees pending" icon={<Clock />} value={<Money value={data.totals.feesPending} countUp={false} />} chip="Awaiting approval" chipTone="warn" delay={0.08} />
            <KpiCard label="Fees paid" icon={<Percent />} value={<Money value={data.totals.feesPaid} countUp={false} />} chip="Paid to your wallet" chipTone="up" delay={0.12} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className="xl:col-span-8">
              <CardHeader title="Performance" subtitle="Calculated by the platform from your strategy account" action={<RiskBadge risk={s.riskScore} showLabel />} />
              <div className="grid grid-cols-2 gap-2 px-4 pb-5 pt-4 sm:grid-cols-4 sm:px-6">
                <Tile label="Return 1M">{pct(s.return1m)}</Tile>
                <Tile label="Return 3M">{pct(s.return3m)}</Tile>
                <Tile label="Return 1Y">{pct(s.return1y)}</Tile>
                <Tile label="Return all">{pct(s.returnAll)}</Tile>
                <Tile label="Max DD">{s.maxDd > 0 ? `-${s.maxDd.toFixed(1)}%` : "0.0%"}</Tile>
                <Tile label="Volatility">{s.volatility.toFixed(1)}%</Tile>
                <Tile label="Win rate">{s.trades ? `${s.winRate.toFixed(1)}%` : "—"}</Tile>
                <Tile label="Equity">{usd(s.equity, 0)}</Tile>
              </div>
            </Card>
            <Card className="xl:col-span-4">
              <CardHeader title="PAMM" subtitle={m.program === "copy" ? "Not part of your programme" : `${data.funds.length} fund${data.funds.length === 1 ? "" : "s"}`} icon={<Landmark />} />
              <div className="px-4 pb-5 pt-4 sm:px-6">
                {m.program === "copy" ? (
                  <p className="text-[13px] text-fg-3">Your programme is copy trading only. Switching to PAMM needs a new review; contact support.</p>
                ) : (
                  <>
                    <p className="text-[13px] text-fg-3">Open a pooled fund that investors buy into at rollover. You trade it in Kalks Trader.</p>
                    <Button variant="ember" className="mt-4 w-full" onClick={() => setFundForm({ fund: null })}>
                      <Plus /> Create PAMM fund
                    </Button>
                  </>
                )}
              </div>
            </Card>
          </div>

          {data.funds.length > 0 && (
            <Card className="mt-4">
              <CardHeader title="Your funds" subtitle="Investors, pending requests and the fund account" icon={<Landmark />} />
              <div className="space-y-2.5 px-4 pb-5 pt-4 sm:px-6">
                {data.funds.map((f) => (
                  <FundBlock key={f.id} f={f} onEdit={() => setFundForm({ fund: f })} onOpen={() => setOpenFund(f.id)} />
                ))}
              </div>
            </Card>
          )}

          <Card className="mt-4">
            <CardHeader title="Followers" subtitle="Copy subscriptions of your strategy" icon={<Users />} />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              {data.followers.length ? (
                <DataTable columns={followCols} rows={data.followers} dense pageSize={10} rowKey={(f) => String(f.subscriptionId)} />
              ) : (
                <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">No followers yet. Your profile is on the leaderboard for clients to find.</div>
              )}
            </div>
          </Card>

          <Card className="mt-4">
            <CardHeader title="Performance fees" subtitle="Paid to your wallet after approval, minus the platform share" icon={<Percent />} />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              {data.fees.length ? (
                <DataTable columns={feeCols} rows={data.fees} dense pageSize={10} rowKey={(f) => String(f.id)} />
              ) : (
                <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">No fees yet. They are settled at the end of each fee period on profit above each follower&apos;s high-water mark.</div>
              )}
            </div>
          </Card>
        </>
      )}

      <EditProfileDialog
        m={m}
        settings={me.settings}
        open={edit}
        onOpenChange={setEdit}
        onSaved={() => {
          reload();
          reloadMe();
        }}
      />
      <FundFormDialog fund={fundForm?.fund ?? null} settings={me.settings} open={!!fundForm} onOpenChange={(o) => !o && setFundForm(null)} onSaved={reload} />
      <FundDetailDrawer fundId={openFund} onClose={() => setOpenFund(null)} />
    </>
  );
}

/* ------------------------------------------------------------------ */

export function LiveMasterPage() {
  const { data, error, loading, reload } = useSocial<MasterMe>("master/me");
  const m = data?.master ?? null;
  const approved = m?.status === "approved";
  return (
    <div className="pb-24">
      <PageHeader
        title={approved ? "Master dashboard" : "Become a master"}
        subtitle={approved ? "Your followers, PAMM funds and performance fees." : "Share your strategy through copy trading, a PAMM fund or both, and earn performance fees above the high-water mark."}
      />
      {error && !data ? (
        <SocialError onRetry={reload} message={error.message} />
      ) : loading || !data ? (
        <BlockSkeleton n={3} h={160} />
      ) : !m ? (
        <ApplyView me={data} onApplied={reload} />
      ) : approved ? (
        <Dashboard me={data} reloadMe={reload} />
      ) : (
        <>
          <StatusCard m={m} />
          {m.status === "rejected" && <ApplyView me={data} onApplied={reload} rejected={m} />}
        </>
      )}
    </div>
  );
}
