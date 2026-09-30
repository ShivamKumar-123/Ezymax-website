"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, FileText, Gift, Loader2, Ticket, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { T } from "@kalks/i18n";
import { useT } from "@kalks/i18n/react";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, DialogClose, Illustration, Input, KeyValue, KpiCard, Money, PageHeader, Progress, Reveal, cn, type Column } from "@kalks/ui";
import { useAccounts } from "@/components/trading/api";
import { BannerSlot } from "./banner-slot";
import { GrowthApiError, errorToast, fmtCount, fmtDate, fmtDateTime, fmtLots, fmtUsd, growthApi, titleCase, useGrowth, type CampaignPublic, type Grant, type PromoResult, type PromoUse, type Promotions } from "./api";
import { CardEmpty, GrowthStatus, LiveAccountPicker, PageFallback, SectionTitle } from "./ui";

const money0 = (v: number) => fmtUsd(v, v % 1 ? 2 : 0);

function headline(c: CampaignPublic, t: T) {
  return c.kind === "deposit" ? t("rewards.promo.headlineDeposit", { pct: c.pct }) : t("rewards.promo.headlineFixed", { amount: money0(c.fixedAmount) });
}

function termsRows(c: CampaignPublic, t: T): [string, React.ReactNode][] {
  const lotsFor = (amount: number) => (c.releasePerLot > 0 ? Math.ceil(amount / c.releasePerLot) : 0);
  const rows: [string, React.ReactNode][] = [];
  if (c.kind === "deposit") {
    rows.push([t("rewards.terms.bonus"), t("rewards.terms.bonusDeposit", { pct: c.pct, cap: money0(c.cap) })]);
    rows.push([t("rewards.terms.minDeposit"), money0(c.minDeposit)]);
    rows.push([t("rewards.terms.depositWithin"), t("rewards.terms.daysOfClaiming", { count: c.claimWindowDays })]);
  } else {
    rows.push([t("rewards.terms.bonus"), money0(c.fixedAmount)]);
  }
  rows.push([t("rewards.terms.release"), c.releasePerLot > 0 ? t("rewards.terms.releaseText", { amount: fmtUsd(c.releasePerLot), lots: fmtCount(lotsFor(c.kind === "deposit" ? c.cap : c.fixedAmount)), total: money0(c.kind === "deposit" ? c.cap : c.fixedAmount) }) : t("rewards.terms.notReleased")]);
  rows.push([t("rewards.terms.expires"), t("rewards.terms.expiresText", { count: c.expiryDays })]);
  rows.push([t("rewards.terms.withdrawals"), c.forfeitOnWithdrawal ? t("rewards.terms.forfeit") : t("rewards.terms.kept")]);
  if (c.endsAt) rows.push([t("rewards.terms.offerEnds"), fmtDate(c.endsAt)]);
  return rows;
}

/* ------------------------------------------------------------------ */
/* Campaigns                                                           */
/* ------------------------------------------------------------------ */

function ClaimDialog({ c, onClaimed }: { c: CampaignPublic; onClaimed: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [login, setLogin] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const fixed = c.kind === "fixed";
  const t = useT();
  const claim = async () => {
    setBusy(true);
    try {
      const r = await growthApi<{ grant: Grant }>(`bonuses/${c.id}/claim`, { body: fixed ? { login } : {} });
      setOpen(false);
      onClaimed();
      toast.success(t("rewards.claim.toastClaimed", { name: c.name }), {
        description:
          r.grant.status === "awaiting_deposit"
            ? r.grant.claimDeadline
              ? t("rewards.claim.toastDepositBy", { amount: money0(c.minDeposit), date: fmtDate(r.grant.claimDeadline) })
              : t("rewards.claim.toastDeposit", { amount: money0(c.minDeposit) })
            : r.grant.login
              ? t("rewards.claim.toastBonusOn", { amount: money0(r.grant.amount), login: r.grant.login })
              : t("rewards.claim.toastBonus", { amount: money0(r.grant.amount) }),
      });
    } catch (e) {
      errorToast(t("rewards.claim.error"), e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setLogin(null);
      }}
      width={520}
      trigger={
        <Button size="sm" variant="ember" className="flex-1" data-testid={`bonus-claim-${c.id}`}>
          {t("rewards.claim.button")}
        </Button>
      }
      title={t("rewards.claim.title", { name: c.name })}
      description={fixed ? t("rewards.claim.descFixed") : t("rewards.claim.descDeposit")}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost">{t("common.cancel")}</Button>
          </DialogClose>
          <Button variant="ember" disabled={busy || (fixed && !login)} onClick={claim} data-testid="bonus-claim-confirm">
            {busy && <Loader2 className="animate-spin" />} {t("rewards.claim.confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <KeyValue rows={termsRows(c, t)} />
        {c.terms && <p className="whitespace-pre-line rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[12px] leading-relaxed text-fg-3">{c.terms}</p>}
        {fixed && (
          <div>
            <div className="k-label mb-2">{t("rewards.picker.label")}</div>
            <LiveAccountPicker value={login} onChange={setLogin} hint={t("rewards.claim.accountHint")} />
          </div>
        )}
        <p className="text-[12px] text-fg-3">{t("rewards.claim.note")}</p>
      </div>
    </Dialog>
  );
}

function TermsDialog({ c }: { c: CampaignPublic }) {
  const t = useT();
  return (
    <Dialog
      width={520}
      trigger={
        <Button size="sm" variant="surface">
          <FileText /> {t("rewards.claim.terms")}
        </Button>
      }
      title={t("rewards.claim.termsTitle", { name: c.name })}
      description={headline(c, t)}
      footer={
        <DialogClose asChild>
          <Button variant="surface">{t("common.close")}</Button>
        </DialogClose>
      }
    >
      <KeyValue rows={termsRows(c, t)} />
      {c.terms && <p className="mt-4 whitespace-pre-line text-[12.5px] leading-relaxed text-fg-2">{c.terms}</p>}
    </Dialog>
  );
}

function CampaignCard({ c, onClaimed }: { c: CampaignPublic; onClaimed: () => void }) {
  const t = useT();
  const lots = c.releasePerLot > 0 ? Math.ceil((c.kind === "deposit" ? c.cap : c.fixedAmount) / c.releasePerLot) : 0;
  return (
    <Card className="flex flex-col overflow-hidden" data-testid={`bonus-campaign-${c.id}`}>
      <div className="border-b border-line bg-surface-2/60 px-5 pb-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <Chip tone={c.kind === "deposit" ? "ember" : "gold"} size="sm" className="font-semibold tracking-wider">
            {c.kind === "deposit" ? t("rewards.card.badgeDeposit") : t("rewards.card.badgeBonus")}
          </Chip>
          {c.endsAt && (
            <span className="flex items-center gap-1 text-[11.5px] text-fg-3">
              <Clock className="size-3" /> {t("rewards.card.until", { date: fmtDate(c.endsAt, false) })}
            </span>
          )}
        </div>
        <div className="mt-3 text-[26px] font-semibold leading-tight tracking-tight text-gold">{c.kind === "deposit" ? `${c.pct}%` : money0(c.fixedAmount)}</div>
        <div className="text-[12.5px] text-fg-2">{c.kind === "deposit" ? t("rewards.card.upTo", { cap: money0(c.cap), min: money0(c.minDeposit) }) : t("rewards.card.credited")}</div>
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-3">
        <div className="text-[16px] font-medium tracking-tight">{c.name}</div>
        {c.description && <div className="mt-0.5 text-[12.5px] text-fg-3">{c.description}</div>}
        <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
          <div className="k-row px-3 py-2">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{t("rewards.card.release")}</div>
            <div className="k-num mt-0.5 font-medium">{c.releasePerLot > 0 ? t("rewards.card.perLot", { amount: fmtUsd(c.releasePerLot) }) : "—"}</div>
          </div>
          <div className="k-row px-3 py-2">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{t("rewards.card.fullRelease")}</div>
            <div className="k-num mt-0.5 font-medium">{lots ? t("rewards.value.lots", { lots: fmtCount(lots) }) : "—"}</div>
          </div>
          <div className="k-row px-3 py-2">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{t("rewards.card.expires")}</div>
            <div className="k-num mt-0.5 font-medium">{t("rewards.value.days", { count: c.expiryDays })}</div>
          </div>
          <div className="k-row px-3 py-2">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{t("rewards.card.onWithdrawal")}</div>
            <div className="mt-0.5 font-medium">{c.forfeitOnWithdrawal ? t("rewards.card.forfeited") : t("rewards.card.kept")}</div>
          </div>
        </div>
        {!c.eligible && !c.claimed && c.reason && (
          <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[12px] text-fg-3">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {c.reason}
          </div>
        )}
        <div className="mt-auto flex items-center gap-2 pt-4">
          {c.claimed ? (
            <Button size="sm" variant="up-outline" disabled className="flex-1 disabled:opacity-100">
              <CheckCircle2 /> {t("rewards.card.claimed")}
            </Button>
          ) : c.eligible ? (
            <ClaimDialog c={c} onClaimed={onClaimed} />
          ) : (
            <Button size="sm" variant="surface" disabled className="flex-1">
              {t("rewards.card.notEligible")}
            </Button>
          )}
          <TermsDialog c={c} />
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* My bonuses                                                          */
/* ------------------------------------------------------------------ */

function GrantRow({ g }: { g: Grant }) {
  const pct = g.lotsRequired > 0 ? Math.min(100, (g.lotsTraded / g.lotsRequired) * 100) : g.progressPct;
  const ended = ["completed", "forfeited", "expired", "cancelled", "failed"].includes(g.status);
  const t = useT();
  return (
    <div className={cn("k-row px-4 py-3.5", ended && "opacity-70")} data-testid="bonus-grant" data-grant-status={g.status}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
            {g.campaign}
            <GrowthStatus status={g.status} />
          </div>
          <div className="text-[11.5px] text-fg-3">
            {g.login ? <span className="font-mono">#{g.login}</span> : t("rewards.grant.noAccount")}
            {g.depositAmount ? t("rewards.grant.onDeposit", { amount: fmtUsd(g.depositAmount) }) : ""}
            {t("rewards.grant.claimed", { date: fmtDate(g.claimedAt) })}
            {g.source && g.source !== "claim" ? ` · ${titleCase(g.source)}` : ""}
          </div>
        </div>
        <div className="text-end">
          <div className="k-num text-[18px] font-semibold">{g.status === "awaiting_deposit" ? "—" : fmtUsd(g.amount)}</div>
          <div className="text-[10.5px] text-fg-3">{t("rewards.unit.bonus")}</div>
        </div>
      </div>
      {g.status === "awaiting_deposit" ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[12px] border border-warn/25 bg-warn-soft px-3 py-2 text-[12px] text-warn">
          <span>{g.claimDeadline ? t("rewards.grant.depositPromptBy", { date: fmtDate(g.claimDeadline) }) : t("rewards.grant.depositPrompt")}</span>
          <Link href="/wallet/deposit" className="shrink-0 underline underline-offset-2">
            {t("rewards.grant.deposit")}
          </Link>
        </div>
      ) : (
        <div className="mt-3">
          <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-[11.5px] text-fg-3">
            <span className="k-num">
              {t("rewards.grant.lotsProgress", { traded: fmtLots(g.lotsTraded), required: fmtLots(g.lotsRequired), amount: fmtUsd(g.releasePerLot) })}
            </span>
            <span className="k-num">
              <span className="text-up">{t("rewards.grant.released", { amount: fmtUsd(g.released) })}</span>
              {t("rewards.grant.remaining", { amount: fmtUsd(g.remaining) })}
            </span>
          </div>
          <Progress value={pct} tone={g.status === "completed" ? "up" : "gold"} className="h-2" />
          <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-[11.5px] text-fg-3">
            <span className="k-num">{t("rewards.grant.pctReleased", { pct: Math.round(pct) })}</span>
            <span>{ended ? `${g.endReason ? titleCase(g.endReason) : t.dyn(`rewards.status.${g.status}`, titleCase(g.status))} ${fmtDate(g.endedAt)}` : g.expiresAt ? t("rewards.grant.expires", { date: fmtDateTime(g.expiresAt) }) : ""}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Promo code                                                          */
/* ------------------------------------------------------------------ */

function PromoCard({ onApplied }: { onApplied: () => void }) {
  const t = useT();
  const [code, setCode] = React.useState("");
  const [login, setLogin] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; message: string } | null>(null);
  const accounts = useAccounts(0);
  const live = (accounts.data?.accounts ?? []).filter((a) => a.type === "live");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await growthApi<PromoResult>("promo", { body: login ? { code: c, login: Number(login) } : { code: c } });
      setResult({ ok: true, message: r.result.message || t("rewards.code.applied") });
      setCode("");
      onApplied();
    } catch (err) {
      setResult({ ok: false, message: err instanceof GrowthApiError ? err.message : t("common.errorRetry") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader title={t("rewards.code.title")} subtitle={t("rewards.code.subtitle")} icon={<Ticket />} />
      <form onSubmit={submit} className="space-y-3 px-4 pb-6 pt-4 sm:px-6">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
          placeholder={t("rewards.code.placeholder")}
          maxLength={40}
          aria-label={t("rewards.code.title")}
          data-testid="promo-input"
          inputClassName="font-mono tracking-wider"
        />
        {live.length > 0 && (
          <label className="flex items-center gap-2 text-[12.5px] text-fg-3">
            <span className="shrink-0">{t("rewards.code.account")}</span>
            <select
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-[12px] border border-line bg-surface-2 px-3 text-[13px] text-fg outline-none focus:border-ember/50"
              data-testid="promo-account"
            >
              <option value="">{t("rewards.code.anyAccount")}</option>
              {live.map((a) => (
                <option key={a.login} value={a.login}>
                  #{a.login} · {a.groupName}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button type="submit" variant="ember" className="w-full" disabled={busy || !code.trim()} data-testid="promo-submit">
          {busy && <Loader2 className="animate-spin" />} {t("rewards.code.apply")}
        </Button>
        {result && (
          <div
            role="status"
            data-testid="promo-result"
            data-ok={result.ok ? "true" : "false"}
            className={cn("flex items-start gap-2 rounded-[12px] border px-3 py-2.5 text-[12.5px]", result.ok ? "border-up/25 bg-up-soft text-up" : "border-down/25 bg-down-soft text-down")}
          >
            {result.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
            <span>{result.message}</span>
          </div>
        )}
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LivePromotionsPage() {
  const t = useT();
  const { data, error, reload } = useGrowth<Promotions>("promotions", 60_000);
  const title = t("rewards.promo.title");
  const subtitle = t("rewards.promo.subtitle");
  if (!data) return <PageFallback title={title} subtitle={subtitle} error={error} onRetry={reload} top={<BannerSlot placement="rewards" />} rows={[{ cols: "sm:grid-cols-3", h: "h-[150px]", n: 3 }, { cols: "md:grid-cols-3", h: "h-[320px]", n: 3 }]} />;

  const { campaigns, grants, promoHistory } = data;
  const running = grants.filter((g) => g.status === "active" || g.status === "pending");
  const outstanding = running.reduce((s, g) => s + g.remaining, 0);
  const released = grants.reduce((s, g) => s + g.released, 0);

  const promoCols: Column<PromoUse>[] = [
    { key: "date", header: t("common.date"), cell: (p) => <span className="k-num text-fg-2">{fmtDateTime(p.createdAt)}</span>, sort: (p) => p.createdAt, width: "150px" },
    { key: "code", header: t("rewards.promo.colCode"), cell: (p) => <span className="font-mono text-[13px] font-medium tracking-wider">{p.code}</span> },
    { key: "kind", header: t("common.type"), hideOn: "sm", cell: (p) => <span className="text-fg-2">{titleCase(p.kind)}</span> },
    { key: "reason", header: t("rewards.promo.colDetails"), hideOn: "md", cell: (p) => <span className="text-[12.5px] text-fg-3">{p.reason ?? "—"}</span> },
    { key: "st", header: t("rewards.promo.colResult"), align: "right", cell: (p) => <GrowthStatus status={p.status} /> },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Link href="/wallet/deposit">
            <Button variant="surface" size="lg">
              <Wallet /> {t("common.deposit")}
            </Button>
          </Link>
        }
      />
      <BannerSlot placement="rewards" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label={t("rewards.promo.kpiToRelease")} value={<Money value={outstanding} countUp={false} />} hot illustration="wrapped_gift" chip={t("rewards.promo.kpiActive", { count: running.length })} chipTone="ember" />
        <KpiCard label={t("rewards.promo.kpiReleased")} icon={<CheckCircle2 />} value={<Money value={released} countUp={false} />} chip={t("rewards.promo.kpiReleasedChip")} chipTone="up" delay={0.05} />
        <KpiCard label={t("rewards.promo.kpiOffers")} icon={<Gift />} value={<span className="k-num">{campaigns.filter((c) => c.eligible && !c.claimed).length}</span>} chip={t("rewards.promo.kpiRunning", { count: campaigns.length })} delay={0.1} />
      </div>

      <Reveal delay={0.05} className="mt-8">
        <SectionTitle title={t("rewards.promo.offersTitle")} text={t("rewards.promo.offersText")} />
        {campaigns.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <Illustration name="rewards" width={208} maxHeight={156} />
              <h3 className="mt-6 text-[17px] font-medium">{t("rewards.promo.noOffersTitle")}</h3>
              <p className="mt-1 max-w-md text-[13.5px] text-fg-3">{t("rewards.promo.noOffersText")}</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((c) => (
              <CampaignCard key={String(c.id)} c={c} onClaimed={reload} />
            ))}
          </div>
        )}
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader title={t("rewards.promo.myBonuses")} subtitle={t("rewards.promo.myBonusesSubtitle")} icon={<Gift />} />
            <div className="space-y-2 px-4 pb-6 pt-4 sm:px-6">
              {grants.length === 0 ? <CardEmpty title={t("rewards.promo.noBonusesTitle")} text={t("rewards.promo.noBonusesText")} /> : grants.map((g) => <GrantRow key={String(g.id)} g={g} />)}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <PromoCard onApplied={reload} />
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title={t("rewards.promo.historyTitle")} subtitle={t("rewards.promo.historySubtitle")} />
          <div className="px-4 pb-6 pt-4 sm:px-6">
            <DataTable columns={promoCols} rows={promoHistory} pageSize={8} rowKey={(p) => String(p.id)} dense empty={<CardEmpty title={t("rewards.promo.historyEmptyTitle")} text={t("rewards.promo.historyEmptyText")} />} />
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
