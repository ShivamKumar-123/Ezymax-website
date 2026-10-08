"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Check, Clock, Copy as CopyIcon, Crown, FileText, KeyRound, Landmark, Layers, Link2, Loader2, Pencil, Percent, Plus, Send, ShieldCheck, TrendingDown, TriangleAlert, UserMinus, UserPlus, Users, UserX, Wallet, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, DataTable, Dialog, EmptyState, Field, Input, KpiCard, Money, PageHeader, Segmented, StatusChip, cn, type Column } from "@/components/kit";
import { Trans, useT } from "@ezymex/i18n/react";
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
  type DashboardFollower,
  type FeeView,
  type FundView,
  type MasterDashboard,
  type MasterMe,
  type MasterUpdateResult,
  type MasterView,
  type Program,
  type RequestView,
  type SocialSettings,
} from "./api";
import { BlockSkeleton, InfoBox, ProgramTags, RiskBadge, SocialError, Tile, useNumber } from "./bits";
import { FundDetailDrawer, FundStatusChip } from "./funds";
import { FEE_STATUS_TONE } from "./subscriptions";
import { AnnouncementsCard, FollowerSettingsCard } from "./master-tools";

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
  const t = useT();
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
  const nickErr = nickname && (nickname.trim().length < 3 || nickname.trim().length > 32) ? t("social.md.err.nickLength") : undefined;
  const minErr = minAlloc.raw && !(minAlloc.value! >= s.minAllocation) ? t("social.md.err.atLeast", { amount: usd(s.minAllocation, 0) }) : undefined;
  const ready = !!cand && nickname.trim().length >= 3 && !nickErr && strategy.trim().length > 0 && desc.trim().length > 0 && !minErr;

  const submit = async () => {
    if (!cand) return toast.error(t("social.md.err.chooseAccount"));
    if (!ready) return toast.error(t("social.md.err.complete"));
    setBusy(true);
    setFailed(null);
    try {
      const body: Record<string, unknown> = { login: cand.login, nickname: nickname.trim(), strategy: strategy.trim(), description: desc.trim(), program, perfFeePct: fee, feePeriod: period };
      if (minAlloc.value !== null) body.minAllocation = minAlloc.value;
      await socialApi("master/apply", { body });
      toast.success(t("social.md.toast.applied"), { description: t("social.md.toast.appliedDesc") });
      onApplied();
    } catch (e) {
      const checksErr = (e as ApiError & { checks?: ReqCheck[] }).checks;
      if (checksErr?.length) setFailed(checksErr);
      toast.error(t("social.md.toast.applyFailed"), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="flex flex-col gap-4 xl:col-span-8">
        <Card>
          <CardHeader
            title={t("social.md.req.title")}
            subtitle={t("social.md.req.subtitle")}
            icon={<ShieldCheck />}
            action={cand ? <Chip tone={met === checks.length ? "up" : "warn"}>{t("social.md.req.met", { met, total: checks.length })}</Chip> : undefined}
          />
          <div className="space-y-3 px-4 pb-5 pt-4 sm:px-6">
            {cands.length === 0 ? (
              <EmptyState
                illustration="identification_card"
                title={t("social.md.req.needLive")}
                text={t("social.md.req.needLiveText", { days: s.minTrackDays, equity: usd(s.minMasterEquity, 0) })}
                action={
                  <Link href="/accounts/new">
                    <Button variant="ember">
                      <Plus /> {t("social.md.req.openLive")}
                    </Button>
                  </Link>
                }
              />
            ) : (
              <>
                <div>
                  <div className="mb-2 text-[12.5px] font-medium text-fg-2">{t("social.md.req.strategyAccount")}</div>
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
                          "rounded-[14px] border px-3.5 py-2 text-start transition-colors",
                          c.login === login ? "border-ember/50 bg-ember-soft" : "border-line bg-surface-2 hover:bg-surface-3",
                        )}
                      >
                        <div className="flex items-center gap-2 font-mono text-[13px]">
                          #{c.login} {c.eligible ? <Check className="size-3.5 text-up" /> : <XIcon className="size-3.5 text-down" />}
                        </div>
                        <div className="text-[11.5px] text-fg-3">
                          {c.group} · {usd(c.equity, 0)} · {t("social.age.days", { d: c.ageDays })}
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
                          {t("social.md.req.verify")}
                        </Button>
                      </Link>
                    )}
                  </div>
                ))}
                <div className="k-row flex items-center gap-3 px-4 py-3">
                  <StateIcon ok={null} />
                  <div>
                    <div className="text-[13.5px] font-medium">{t("social.md.req.approval")}</div>
                    <div className="text-[12px] text-fg-3">{t("social.md.req.approvalText")}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={t("social.md.programme")} subtitle={t("social.md.programmeSub")} icon={<Layers />} />
          <div role="radiogroup" className="grid grid-cols-1 gap-3 px-4 pb-5 pt-4 sm:grid-cols-3 sm:px-6">
            <RadioCard selected={program === "copy"} onSelect={() => setProgram("copy")} icon={<CopyIcon />} title={t("social.subs.title")} text={t("social.md.prog.copyText")} />
            <RadioCard selected={program === "pamm"} onSelect={() => setProgram("pamm")} icon={<Landmark />} title={t("social.funds.pammFund")} text={t("social.md.prog.pammText")} />
            <RadioCard selected={program === "both"} onSelect={() => setProgram("both")} icon={<Crown />} title={t("social.md.prog.both")} text={t("social.md.prog.bothText")} />
          </div>
          {program !== "copy" && (
            <div className="px-4 pb-5 sm:px-6">
              <InfoBox>{t("social.md.prog.pammNote", { pct: s.minOwnCapitalPct })}</InfoBox>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title={t("social.md.feesTerms")} subtitle={t("social.md.feesTermsSub", { min: s.feeMinPct, max: s.feeMaxPct })} icon={<Percent />} />
          <div className="grid grid-cols-1 gap-6 px-4 pb-6 pt-5 sm:px-6 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[13px] font-medium text-fg-2">{t("social.performanceFee")}</span>
                <span className="k-num text-[22px] font-semibold text-gold">{fee}%</span>
              </div>
              <RangeSlider value={fee} onChange={setFee} min={s.feeMinPct} max={s.feeMaxPct} tone="gold" format={(v) => `${v}%`} label={t("social.performanceFee")} />
              <p className="mt-2 text-[12px] text-fg-3">
                {t("social.md.feeExample", { start: usd(10000, 0), end: usd(11200, 0), fee: usd(1200 * (fee / 100)), cut: s.platformCutPct })}
              </p>
            </div>
            <div>
              <div className="mb-2 text-[12.5px] font-medium text-fg-2">{t("social.md.copyFeeSettlement")}</div>
              <Segmented size="sm" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
              <p className="mt-2 text-[11.5px] text-fg-3">{t("social.md.settleNote")}</p>
            </div>
            <Field label={t("social.profile.minAllocation")} hint={t("social.md.minAllocHint", { amount: usd(s.minAllocation, 0) })} error={minErr}>
              <Input type="number" inputMode="decimal" min={s.minAllocation} value={minAlloc.raw} onChange={(e) => minAlloc.setRaw(e.target.value)} leading="$" inputClassName="k-num" />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title={t("social.md.publicProfile")} subtitle={t("social.md.publicProfileSub")} icon={<FileText />} />
          <div className="space-y-4 px-4 pb-6 pt-5 sm:px-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("social.md.nickname")} hint={`${nickname.length}/32`} error={nickErr}>
                <Input value={nickname} maxLength={32} onChange={(e) => setNickname(e.target.value)} placeholder={t("social.md.nicknamePh")} />
              </Field>
              <Field label={t("social.md.strategy")} hint={`${strategy.length}/60`}>
                <Input value={strategy} maxLength={60} onChange={(e) => setStrategy(e.target.value)} placeholder={t("social.md.strategyPh")} />
              </Field>
            </div>
            <Field label={t("social.md.description")} hint={`${desc.length}/1000`}>
              <textarea value={desc} maxLength={1000} onChange={(e) => setDesc(e.target.value)} rows={5} placeholder={t("social.md.descriptionPh")} className={textareaCls} />
            </Field>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-4 xl:sticky xl:top-24 xl:col-span-4 xl:self-start">
        <Card>
          <CardHeader title={t("social.md.preview")} subtitle={t("social.md.previewSub")} />
          <div className="px-4 pb-5 pt-4 sm:px-6">
            <div className="k-row p-4">
              <div className="flex items-center gap-3">
                <Avatar name={nickname || t("social.master")} size={48} />
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-medium">{nickname || t("social.md.yourNickname")}</div>
                  <div className="truncate text-[12.5px] text-fg-3">{strategy || t("social.md.yourStrategy")}</div>
                </div>
              </div>
              <p className="mt-3 line-clamp-4 whitespace-pre-line text-[12.5px] leading-relaxed text-fg-2">{desc || t("social.md.descPlaceholder")}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[12px]">
                {[
                  [t("social.fee"), `${fee}%`],
                  [t("social.min"), usd(minAlloc.value ?? 0, 0)],
                  [t("social.md.settles"), PERIOD_LABEL[period]],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-[10px] bg-surface-3/60 px-2.5 py-2">
                    <div className="text-fg-3">{k}</div>
                    <div className="k-num font-medium">{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <ProgramTags program={program} />
                {cand && <span className="text-[11.5px] text-fg-3">{t("social.md.trackRecord", { d: cand.ageDays })}</span>}
              </div>
            </div>
            <p className="mt-3 text-[11.5px] text-fg-3">{t("social.md.previewNote")}</p>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <Button variant="ember" className="w-full" onClick={submit} disabled={busy || !ready || !cand}>
              {busy ? <Loader2 className="animate-spin" /> : <Send />} {t("social.md.submit")}
            </Button>
            {cand && !cand.eligible && <p className="mt-2 text-center text-[11.5px] text-fg-3">{t("social.md.notEligible")}</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatusCard({ m }: { m: MasterView }) {
  const t = useT();
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
              {m.status === "pending" ? t("social.md.status.pendingTitle") : m.status === "rejected" ? t("social.md.status.rejectedTitle") : t("social.md.status.suspendedTitle")}
            </h2>
            <StatusChip status={m.status} label={t.dyn(`social.masterStatus.${m.status}`, m.status)} />
          </div>
          <p className="mt-1 text-[13.5px] text-fg-2">
            {m.status === "pending"
              ? t("social.md.status.pendingText")
              : m.status === "rejected"
                ? t("social.md.status.rejectedText")
                : t("social.md.status.suspendedText")}
          </p>
          {m.reviewNote && (
            <div className="mt-3 rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[13px]">
              <div className="text-[12px] text-fg-3">{t("social.md.status.note")}</div>
              <div className="mt-1 whitespace-pre-line text-fg">{m.reviewNote}</div>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label={t("social.md.nickname")}>{m.nickname}</Tile>
            <Tile label={t("common.account")}>{m.login ? `#${m.login}` : "—"}</Tile>
            <Tile label={t("social.md.programme")}>{m.program === "both" ? t("social.md.copyPlusPamm") : m.program === "pamm" ? "PAMM" : t("social.program.copy")}</Tile>
            <Tile label={t("social.fee")}>{m.perfFeePct}% · {PERIOD_LABEL[m.feePeriod].toLowerCase()}</Tile>
          </div>
          {m.createdAt && <div className="mt-3 text-[12px] text-fg-3">{t("social.md.status.submitted", { time: serverTime(m.createdAt) })}</div>}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Approved: dialogs                                                   */
/* ------------------------------------------------------------------ */

function EditProfileDialog({ m, settings, open, onOpenChange, onSaved }: { m: MasterView; settings: SocialSettings; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const t = useT();
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
      const r = await socialApi<MasterUpdateResult>("master/me", { method: "PATCH", body });
      // A8: a lower fee reaches the followers at once; anything else waits for their acceptance
      const termsChanged = body.perfFeePct !== undefined || body.feePeriod !== undefined;
      const parts: string[] = [];
      if (r.terms?.pending) parts.push(t("social.md.terms.pending", { count: r.terms.pending }));
      if (r.terms?.applied) parts.push(t("social.md.terms.applied", { count: r.terms.applied }));
      toast.success(t("social.md.toast.profileUpdated"), { description: parts.length ? parts.join(" ") : termsChanged ? (r.terms ? t("social.md.terms.newOnly") : t("social.md.toast.newTerms")) : undefined });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(t("social.md.toast.profileFailed"), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={620}
      title={t("social.md.edit.title")}
      description={t("social.md.edit.description")}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="ember" onClick={save} disabled={busy || nickname.trim().length < 3 || !strategy.trim()}>
            {busy && <Loader2 className="animate-spin" />} {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("social.md.nickname")} hint={`${nickname.length}/32`}>
            <Input value={nickname} maxLength={32} onChange={(e) => setNickname(e.target.value)} />
          </Field>
          <Field label={t("social.md.strategy")} hint={`${strategy.length}/60`}>
            <Input value={strategy} maxLength={60} onChange={(e) => setStrategy(e.target.value)} />
          </Field>
        </div>
        <Field label={t("social.md.description")} hint={`${desc.length}/1000`}>
          <textarea value={desc} maxLength={1000} onChange={(e) => setDesc(e.target.value)} rows={4} className={textareaCls} />
        </Field>
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[12.5px] font-medium text-fg-2">{t("social.performanceFee")}</span>
            <span className="k-num text-[18px] font-semibold text-gold">{fee}%</span>
          </div>
          <RangeSlider value={fee} onChange={setFee} min={settings.feeMinPct} max={settings.feeMaxPct} tone="gold" format={(v) => `${v}%`} label={t("social.performanceFee")} />
        </div>
        {(fee !== m.perfFeePct || period !== m.feePeriod) && (
          <InfoBox tone={fee < m.perfFeePct && period === m.feePeriod ? "up" : "warn"} icon={<FileText />}>
            {fee < m.perfFeePct && period === m.feePeriod ? t("social.md.terms.lowerHint") : t("social.md.terms.changeHint")}
          </InfoBox>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">{t("social.md.feeSettlement")}</div>
            <Segmented size="sm" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
          </div>
          <Field label={t("social.profile.minAllocation")} hint="USD">
            <Input type="number" inputMode="decimal" min={settings.minAllocation} value={minAlloc.raw} onChange={(e) => minAlloc.setRaw(e.target.value)} leading="$" inputClassName="k-num" />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

type Creds = { login: number; password?: string; investorPassword?: string };

function FundFormDialog({ fund, settings, open, onOpenChange, onSaved }: { fund: DashboardFund | null; settings: SocialSettings; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const t = useT();
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
    name.trim().length < 3 ? t("social.md.fund.err.name") : !(minInv.value! >= 0) ? t("social.md.fund.err.minInv") : !(maxDd.value! >= 1 && maxDd.value! <= 99) ? t("social.md.fund.err.maxDd") : create && !(seed.value! > 0) ? t("social.md.fund.err.seed") : undefined;

  const save = async () => {
    if (err) return toast.error(err);
    setBusy(true);
    try {
      const body: Record<string, unknown> = { name: name.trim(), period, perfFeePct: fee, lockInDays: lock, minInvestment: minInv.value, maxDdPct: maxDd.value };
      if (create) {
        body.seed = seed.value;
        const r = await socialApi<{ fund: FundView; credentials: Creds }>("funds", { body });
        setCreds(r);
        toast.success(t("social.md.fund.isOpen", { name: r.fund.name }), { description: t("social.md.fund.openedDesc", { login: r.credentials.login, amount: usd(seed.value ?? 0) }) });
      } else {
        await socialApi(`funds/${fund!.id}`, { method: "PATCH", body });
        toast.success(t("social.md.fund.updated"));
        onOpenChange(false);
      }
      onSaved();
    } catch (e) {
      toast.error(create ? t("social.md.fund.openFailed") : t("social.md.fund.updateFailed"), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  if (creds) {
    const c = creds.credentials;
    const copyAll = () => {
      const text = [`${t("social.md.fund.login")}: ${c.login}`, `${t("social.md.fund.server")}: Ezymex-Live`, c.password ? `${t("social.md.fund.tradingPassword")}: ${c.password}` : null, c.investorPassword ? `${t("social.md.fund.investorPassword")}: ${c.investorPassword}` : null].filter(Boolean).join("\n");
      navigator.clipboard?.writeText(text).then(
        () => toast.success(t("social.md.fund.credsCopied"), { description: t("social.md.fund.credsCopiedDesc") }),
        () => toast.error(t("social.md.fund.copyFailed")),
      );
    };
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        width={560}
        title={t("social.md.fund.isOpen", { name: creds.fund.name })}
        description={t("social.md.fund.credsDesc")}
        footer={
          <>
            <Button variant="surface" onClick={() => onOpenChange(false)}>
              {t("common.done")}
            </Button>
            <TradeButton a={{ login: c.login, status: "active" }} size="md" label={t("social.md.fund.trade")} />
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[15px] font-medium">
              <KeyRound className="size-4 text-fg-3" /> {t("social.md.fund.creds")}
            </div>
            <Button size="xs" variant="surface" onClick={copyAll}>
              <CopyIcon /> {t("social.md.fund.copyAll")}
            </Button>
          </div>
          <SecretField label={t("social.md.fund.login")} value={String(c.login)} />
          <SecretField label={t("social.md.fund.server")} value="Ezymex-Live" />
          {c.password && <SecretField label={t("social.md.fund.tradingPassword")} value={c.password} secret hint={t("social.md.fund.fullAccess")} />}
          {c.investorPassword && <SecretField label={t("social.md.fund.investorPassword")} value={c.investorPassword} secret hint={t("social.md.fund.readOnly")} />}
          <InfoBox tone="warn" icon={<TriangleAlert />}>
            <Trans k="social.md.fund.onceWarning" tags={{ b: (c) => <b className="text-fg">{c}</b> }} />
          </InfoBox>
          <InfoBox>{t("social.md.fund.moneyNote")}</InfoBox>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={620}
      title={create ? t("social.md.fund.createTitle") : t("social.md.fund.editTitle", { name: fund!.name })}
      description={create ? t("social.md.fund.createDesc") : t("social.md.fund.editDesc")}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="ember" onClick={save} disabled={busy || !!err}>
            {busy && <Loader2 className="animate-spin" />} {create ? t("social.md.fund.create") : t("common.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label={t("social.md.fund.name")} hint={`${name.length}/40`}>
          <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={t("social.md.fund.namePh")} />
        </Field>
        <div>
          <div className="mb-2 text-[12.5px] font-medium text-fg-2">{t("social.rollover")}</div>
          <Segmented size="sm" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
          <p className="mt-2 text-[11.5px] text-fg-3">{t("social.md.fund.rolloverNote")}</p>
        </div>
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[12.5px] font-medium text-fg-2">{t("social.performanceFee")}</span>
            <span className="k-num text-[18px] font-semibold text-gold">{fee}%</span>
          </div>
          <RangeSlider value={fee} onChange={setFee} min={settings.feeMinPct} max={settings.feeMaxPct} tone="gold" format={(v) => `${v}%`} label={t("social.performanceFee")} />
        </div>
        <div>
          <div className="mb-2 text-[12.5px] font-medium text-fg-2">{t("social.md.fund.lockPeriod")}</div>
          <Segmented size="xs" value={String(lock)} onChange={(v) => setLock(+v)} options={LOCKS.map((l) => ({ value: String(l), label: l ? t("social.age.days", { d: l }) : t("common.none") }))} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t("social.funds.minInvestment")} hint="USD">
            <Input type="number" inputMode="decimal" min={0} value={minInv.raw} onChange={(e) => minInv.setRaw(e.target.value)} leading="$" inputClassName="k-num" />
          </Field>
          <Field label={t("social.follow.maxDrawdown")} hint={t("social.md.fund.freezeAt")}>
            <Input type="number" inputMode="decimal" min={1} max={99} value={maxDd.raw} onChange={(e) => maxDd.setRaw(e.target.value)} trailing="%" inputClassName="k-num" />
          </Field>
          {create && (
            <Field label={t("social.md.fund.seed")} hint={t("social.md.fund.fromWallet")}>
              <Input type="number" inputMode="decimal" min={0} value={seed.raw} onChange={(e) => seed.setRaw(e.target.value)} leading="$" inputClassName="k-num" />
            </Field>
          )}
        </div>
        {create && (
          <InfoBox>
            {t("social.md.fund.seedNote", { pct: settings.minOwnCapitalPct, dd: maxDd.value ?? "—" })}
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
  const t = useT();
  const investors = Array.isArray(f.investors) ? f.investors : [];
  const investorCount = Array.isArray(f.investors) ? f.investors.length : f.investors;
  const pending = Array.isArray(f.pending) ? (f.pending as RequestView[]).filter((r) => r.status === "pending").length : f.pending;
  type Inv = (typeof investors)[number];
  const cols: Column<Inv>[] = [
    { key: "id", header: t("social.md.col.investor"), cell: (i) => <span className="font-mono text-[12px] text-fg-2">#{i.investorId}</span> },
    { key: "u", header: t("social.inv.units"), align: "right", cell: (i) => <span className="k-num">{units4(i.units)}</span> },
    { key: "v", header: t("social.value"), align: "right", cell: (i) => <span className="k-num">{usd(i.value)}</span>, sort: (i) => i.value },
    { key: "s", header: t("social.md.col.since"), align: "right", cell: (i) => <span className="text-fg-2">{fmtDate(i.since)}</span>, hideOn: "sm" },
  ];
  return (
    <div className="k-row px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 text-start">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-medium hover:text-ember">{f.name}</span>
            <FundStatusChip status={f.status} />
          </div>
          <div className="text-[12px] text-fg-3">
            {f.login ? <span className="font-mono">#{f.login}</span> : null} · {t("social.md.fundRollover", { period: PERIOD_LABEL[f.period].toLowerCase(), next: serverTime(f.nextRolloverAt, false) })}
          </div>
        </button>
        <div className="flex flex-wrap gap-2">
          <Button size="xs" variant="surface" onClick={onEdit}>
            <Pencil /> {t("social.md.editTerms")}
          </Button>
          {f.login ? <TradeButton a={{ login: f.login, status: f.status === "closed" ? "disabled" : "active" }} size="xs" /> : null}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="NAV">{nav4(f.nav)}</Tile>
        <Tile label={t("common.equity")}>{compactUsd(f.equity)}</Tile>
        <Tile label={t("social.md.investorAum")}>{compactUsd(f.aum)}</Tile>
        <Tile label={t("social.investors")}>{investorCount}</Tile>
        <Tile label={t("social.md.yourShare")}>{f.masterSharePct.toFixed(1)}%</Tile>
        <Tile label={t("common.pending")}>{pending}</Tile>
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
  const t = useT();
  const { data, error, reload } = useSocial<MasterDashboard>("master/dashboard", 15000);
  const [edit, setEdit] = React.useState(false);
  const [fundForm, setFundForm] = React.useState<{ fund: DashboardFund | null } | null>(null);
  const [openFund, setOpenFund] = React.useState<number | null>(null);
  const m = data?.master ?? me.master!;
  const s = m.stats;

  const followCols: Column<DashboardFollower>[] = [
    { key: "id", header: t("social.subs.detail.title"), cell: (f) => <span className="font-mono text-[12px] text-fg-2">#{f.subscriptionId}</span> },
    { key: "since", header: t("social.md.col.since"), cell: (f) => <span className="text-fg-2">{fmtDate(f.since)}</span>, sort: (f) => f.since, hideOn: "sm" },
    {
      key: "st",
      header: t("common.status"),
      cell: (f) => (
        <span className="flex flex-col items-start gap-1">
          <span className="flex flex-wrap items-center gap-1">
            <StatusChip status={f.status} label={t.dyn(`social.subStatus.${f.status}`, f.status)} />
            {f.termsPending && f.status !== "stopped" && (
              <Chip size="sm" tone="warn">
                {t("social.md.col.termsPending")}
              </Chip>
            )}
          </span>
          {f.status === "stopped" && (f.stoppedAt || f.stopReason) && (
            <span className="text-[11px] text-fg-3">
              {f.stoppedAt ? fmtDate(f.stoppedAt) : ""}
              {f.stopReason ? `${f.stoppedAt ? " · " : ""}${t.dyn(`social.subs.stopReason.${f.stopReason}`, f.stopReason.replace(/_/g, " "))}` : ""}
            </span>
          )}
        </span>
      ),
      sort: (f) => f.status,
    },
    { key: "sz", header: t("social.follow.step.sizing"), cell: (f) => <span className="text-fg-2">{sizingText(f.sizing)}</span>, hideOn: "md" },
    { key: "nd", header: t("social.subs.netDeposits"), align: "right", cell: (f) => <span className="k-num text-fg-2">{typeof f.netDeposits === "number" ? usd(f.netDeposits, 0) : "—"}</span>, sort: (f) => f.netDeposits ?? 0, hideOn: "md" },
    { key: "fee", header: t("social.fee"), align: "right", cell: (f) => <span className="k-num text-fg-2">{typeof f.perfFeePct === "number" ? `${f.perfFeePct}%` : "—"}</span>, hideOn: "lg" },
    { key: "eq", header: t("common.equity"), align: "right", cell: (f) => <span className="k-num">{usd(f.equity)}</span>, sort: (f) => f.equity },
    { key: "pl", header: t("social.profit"), align: "right", cell: (f) => <span className={cn("k-num", f.profit > 0 ? "text-up" : f.profit < 0 ? "text-down" : "")}>{usd(f.profit, 2, true)}</span>, sort: (f) => f.profit },
  ];
  const feeCols: Column<FeeView>[] = [
    { key: "at", header: t("social.md.col.periodEnd"), cell: (f) => <span className="whitespace-nowrap text-fg-2">{fmtDate(f.periodEnd)}</span>, sort: (f) => f.periodEnd },
    { key: "src", header: t("social.md.col.source"), cell: (f) => <span>{f.source === "copy" ? t("social.md.srcCopy", { id: f.subscriptionId ?? "" }) : t("social.md.srcPamm", { id: f.fundId ?? "" })}</span> },
    { key: "a", header: t("social.fee"), align: "right", cell: (f) => <span className="k-num">{usd(f.amount)}</span>, hideOn: "sm" },
    { key: "c", header: t("social.md.col.platform"), align: "right", cell: (f) => <span className="k-num text-fg-3">{usd(f.platformCut)}</span>, hideOn: "md" },
    { key: "m", header: t("social.md.col.youReceive"), align: "right", cell: (f) => <span className="k-num font-medium">{usd(f.masterAmount)}</span>, sort: (f) => f.masterAmount },
    { key: "s", header: t("common.status"), align: "right", cell: (f) => <Chip size="sm" tone={FEE_STATUS_TONE[f.status] ?? "neutral"}>{t.dyn(`social.feeStatus.${f.status}`, f.status)}</Chip> },
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
                <BadgeCheck className="size-3" /> {t("social.md.approved")}
              </Chip>
              {m.hidden && <Chip size="sm">{t("social.md.hidden")}</Chip>}
              {m.frozen && <Chip tone="down" size="sm">{t("social.md.frozen")}</Chip>}
              {m.inviteOnly && (
                <Chip tone="gold" size="sm">
                  <Link2 className="size-3" /> {t("social.inviteOnly")}
                </Chip>
              )}
              {m.acceptingNew === false && (
                <Chip tone="warn" size="sm">
                  <UserX className="size-3" /> {t("social.notAccepting")}
                </Chip>
              )}
              <ProgramTags program={m.program} />
            </div>
            <div className="mt-0.5 text-[13.5px] text-fg-2">{m.strategy}</div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fg-3">
              {m.login && <span>{t("social.md.req.strategyAccount")} <span className="font-mono text-fg-2">#{m.login}</span></span>}
              <span>{t("social.md.feeLine", { fee: m.perfFeePct, period: PERIOD_LABEL[m.feePeriod].toLowerCase() })}</span>
              <span>{t("social.md.minAllocLine", { amount: usd(m.minAllocation, 0) })}</span>
              <span>{t("social.md.masterSince", { date: fmtDate(m.since) })}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/social/masters/${m.id}`}>
              <Button variant="surface">
                {t("social.md.publicProfile")} <ArrowUpRight className="rtl:-scale-x-100" />
              </Button>
            </Link>
            <Button variant="surface" onClick={() => setEdit(true)}>
              <Pencil /> {t("common.edit")}
            </Button>
            {m.login && <TradeButton a={{ login: m.login, status: "active" }} size="md" />}
          </div>
        </div>
      </Card>

      {error && !data ? (
        <SocialError onRetry={reload} message={error.message} title={t("social.md.dashUnavailable")} />
      ) : !data ? (
        <BlockSkeleton n={3} h={120} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label={t("social.followers")} icon={<Users />} value={<span className="k-num">{data.totals.followers}</span>} chip={t("social.md.kpi.investors", { count: s.investors })} />
            <KpiCard label={t("social.lb.stat.aum")} icon={<Wallet />} value={<span className="k-num">{compactUsd(data.totals.aum)}</span>} chip={t("social.md.kpi.aumChip")} delay={0.04} />
            <KpiCard label={t("social.feesPending")} icon={<Clock />} value={<Money value={data.totals.feesPending} countUp={false} />} chip={t("social.subs.kpi.awaitingApproval")} chipTone="warn" delay={0.08} />
            <KpiCard label={t("social.inv.kpi.feesPaid")} icon={<Percent />} value={<Money value={data.totals.feesPaid} countUp={false} />} chip={t("social.md.kpi.paidChip")} chipTone="up" delay={0.12} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="master-follower-kpis">
            <KpiCard label={t("social.md.kpi.new30d")} icon={<UserPlus />} value={<span className="k-num">{data.totals.new30d ?? 0}</span>} chip={t("social.md.kpi.last30d")} chipTone="up" delay={0.04} />
            <KpiCard label={t("social.md.kpi.left30d")} icon={<UserMinus />} value={<span className="k-num">{data.totals.left30d ?? 0}</span>} chip={t("social.md.kpi.last30d")} chipTone={(data.totals.left30d ?? 0) > 0 ? "down" : "neutral"} delay={0.08} />
            <KpiCard label={t("social.md.kpi.churn")} icon={<TrendingDown />} value={<span className="k-num">{(data.totals.churn30dPct ?? 0).toFixed(1)}%</span>} chip={t("social.md.kpi.churnChip")} chipTone={(data.totals.churn30dPct ?? 0) >= 20 ? "down" : (data.totals.churn30dPct ?? 0) >= 10 ? "warn" : "neutral"} delay={0.12} />
            <KpiCard label={t("social.md.kpi.termsPending")} icon={<FileText />} value={<span className="k-num">{data.totals.termsPending ?? 0}</span>} chip={t("social.md.kpi.termsChip")} chipTone={(data.totals.termsPending ?? 0) > 0 ? "warn" : "neutral"} delay={0.16} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className="xl:col-span-8">
              <CardHeader title={t("social.md.performance")} subtitle={t("social.md.performanceSub")} action={<RiskBadge risk={s.riskScore} showLabel />} />
              <div className="grid grid-cols-2 gap-2 px-4 pb-5 pt-4 sm:grid-cols-4 sm:px-6">
                <Tile label={t("social.lb.col.return", { period: t("social.lb.period.1m") })}>{pct(s.return1m)}</Tile>
                <Tile label={t("social.lb.col.return", { period: t("social.lb.period.3m") })}>{pct(s.return3m)}</Tile>
                <Tile label={t("social.lb.col.return", { period: t("social.lb.period.1y") })}>{pct(s.return1y)}</Tile>
                <Tile label={t("social.returnAll")}>{pct(s.returnAll)}</Tile>
                <Tile label={t("social.maxDd")}>{s.maxDd > 0 ? `-${s.maxDd.toFixed(1)}%` : "0.0%"}</Tile>
                <Tile label={t("social.profile.volatility")}>{s.volatility.toFixed(1)}%</Tile>
                <Tile label={t("social.profile.winRate")}>{s.trades ? `${s.winRate.toFixed(1)}%` : "—"}</Tile>
                <Tile label={t("common.equity")}>{usd(s.equity, 0)}</Tile>
              </div>
            </Card>
            <Card className="xl:col-span-4">
              <CardHeader title="PAMM" subtitle={m.program === "copy" ? t("social.md.pamm.notInProgramme") : t("social.funds.count", { count: data.funds.length })} icon={<Landmark />} />
              <div className="px-4 pb-5 pt-4 sm:px-6">
                {m.program === "copy" ? (
                  <p className="text-[13px] text-fg-3">{t("social.md.pamm.copyOnly")}</p>
                ) : (
                  <>
                    <p className="text-[13px] text-fg-3">{t("social.md.pamm.openText")}</p>
                    <Button variant="ember" className="mt-4 w-full" onClick={() => setFundForm({ fund: null })}>
                      <Plus /> {t("social.md.pamm.create")}
                    </Button>
                  </>
                )}
              </div>
            </Card>
          </div>

          {data.funds.length > 0 && (
            <Card className="mt-4">
              <CardHeader title={t("social.md.yourFunds")} subtitle={t("social.md.yourFundsSub")} icon={<Landmark />} />
              <div className="space-y-2.5 px-4 pb-5 pt-4 sm:px-6">
                {data.funds.map((f) => (
                  <FundBlock key={f.id} f={f} onEdit={() => setFundForm({ fund: f })} onOpen={() => setOpenFund(f.id)} />
                ))}
              </div>
            </Card>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className="xl:col-span-8">
              <CardHeader title={t("social.followers")} subtitle={t("social.md.followersSub")} icon={<Users />} />
              <div className="px-4 pb-5 pt-4 sm:px-6">
                {data.followers.length ? (
                  <DataTable columns={followCols} rows={data.followers} dense pageSize={10} rowKey={(f) => String(f.subscriptionId)} />
                ) : (
                  <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">{t("social.md.noFollowers")}</div>
                )}
              </div>
            </Card>
            <FollowerSettingsCard
              m={m}
              followers={data.totals.followers}
              className="xl:col-span-4 xl:self-start"
              onSaved={() => {
                reload();
                reloadMe();
              }}
            />
          </div>

          <AnnouncementsCard className="mt-4" items={data.announcements ?? []} onSent={reload} />

          <Card className="mt-4">
            <CardHeader title={t("social.md.perfFees")} subtitle={t("social.md.perfFeesSub")} icon={<Percent />} />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              {data.fees.length ? (
                <DataTable columns={feeCols} rows={data.fees} dense pageSize={10} rowKey={(f) => String(f.id)} />
              ) : (
                <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">{t("social.md.noFees")}</div>
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
  const t = useT();
  const { data, error, loading, reload } = useSocial<MasterMe>("master/me");
  const m = data?.master ?? null;
  const approved = m?.status === "approved";
  return (
    <div className="pb-24">
      <PageHeader
        title={approved ? t("social.md.title") : t("social.becomeMaster")}
        subtitle={approved ? t("social.md.subtitle") : t("social.md.applySubtitle")}
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
