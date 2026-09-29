"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, FileText, Gift, Loader2, Ticket, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, DialogClose, Icon3D, Input, KeyValue, KpiCard, Money, PageHeader, Progress, Reveal, cn, type Column } from "@kalks/ui";
import { useAccounts } from "@/components/trading/api";
import { BannerSlot } from "./banner-slot";
import { GrowthApiError, errorToast, fmtDate, fmtDateTime, fmtLots, fmtUsd, growthApi, titleCase, useGrowth, type CampaignPublic, type Grant, type PromoResult, type PromoUse, type Promotions } from "./api";
import { CardEmpty, GrowthStatus, LiveAccountPicker, PageFallback, SectionTitle } from "./ui";

const money0 = (v: number) => fmtUsd(v, v % 1 ? 2 : 0);

function headline(c: CampaignPublic) {
  return c.kind === "deposit" ? `${c.pct}% deposit bonus` : `${money0(c.fixedAmount)} trading bonus`;
}

function termsRows(c: CampaignPublic): [string, React.ReactNode][] {
  const lotsFor = (amount: number) => (c.releasePerLot > 0 ? Math.ceil(amount / c.releasePerLot) : 0);
  const rows: [string, React.ReactNode][] = [];
  if (c.kind === "deposit") {
    rows.push(["Bonus", `${c.pct}% of your deposit, up to ${money0(c.cap)}`]);
    rows.push(["Minimum deposit", money0(c.minDeposit)]);
    rows.push(["Deposit within", `${c.claimWindowDays} day${c.claimWindowDays === 1 ? "" : "s"} of claiming`]);
  } else {
    rows.push(["Bonus", money0(c.fixedAmount)]);
  }
  rows.push(["Release", c.releasePerLot > 0 ? `${fmtUsd(c.releasePerLot)} per lot traded (${lotsFor(c.kind === "deposit" ? c.cap : c.fixedAmount).toLocaleString("en-US")} lots for the full ${money0(c.kind === "deposit" ? c.cap : c.fixedAmount)})` : "Not released"]);
  rows.push(["Expires", `${c.expiryDays} days after it is credited`]);
  rows.push(["Withdrawals", c.forfeitOnWithdrawal ? "A withdrawal or transfer out removes the unreleased bonus" : "Unreleased bonus stays on withdrawal"]);
  if (c.endsAt) rows.push(["Offer ends", fmtDate(c.endsAt)]);
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
  const claim = async () => {
    setBusy(true);
    try {
      const r = await growthApi<{ grant: Grant }>(`bonuses/${c.id}/claim`, { body: fixed ? { login } : {} });
      setOpen(false);
      onClaimed();
      toast.success(`${c.name} claimed`, {
        description: r.grant.status === "awaiting_deposit" ? `Deposit at least ${money0(c.minDeposit)} to a live account${r.grant.claimDeadline ? ` by ${fmtDate(r.grant.claimDeadline)}` : ""} to receive the bonus.` : `${money0(r.grant.amount)} bonus${r.grant.login ? ` on #${r.grant.login}` : ""}.`,
      });
    } catch (e) {
      errorToast("Couldn't claim the bonus", e);
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
          Claim bonus
        </Button>
      }
      title={`Claim ${c.name}`}
      description={fixed ? "Pick the live account that receives the bonus." : "The bonus is credited on your next qualifying deposit."}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="ember" disabled={busy || (fixed && !login)} onClick={claim} data-testid="bonus-claim-confirm">
            {busy && <Loader2 className="animate-spin" />} Accept terms and claim
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <KeyValue rows={termsRows(c)} />
        {c.terms && <p className="whitespace-pre-line rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[12px] leading-relaxed text-fg-3">{c.terms}</p>}
        {fixed && (
          <div>
            <div className="k-label mb-2">Live account</div>
            <LiveAccountPicker value={login} onChange={setLogin} hint="The bonus is credited to a live account. Open one first." />
          </div>
        )}
        <p className="text-[12px] text-fg-3">The bonus counts toward equity and margin but can't be withdrawn until it is released by trading. One active bonus per account.</p>
      </div>
    </Dialog>
  );
}

function TermsDialog({ c }: { c: CampaignPublic }) {
  return (
    <Dialog
      width={520}
      trigger={
        <Button size="sm" variant="surface">
          <FileText /> Terms
        </Button>
      }
      title={`${c.name} · terms`}
      description={headline(c)}
      footer={
        <DialogClose asChild>
          <Button variant="surface">Close</Button>
        </DialogClose>
      }
    >
      <KeyValue rows={termsRows(c)} />
      {c.terms && <p className="mt-4 whitespace-pre-line text-[12.5px] leading-relaxed text-fg-2">{c.terms}</p>}
    </Dialog>
  );
}

function CampaignCard({ c, onClaimed }: { c: CampaignPublic; onClaimed: () => void }) {
  const lots = c.releasePerLot > 0 ? Math.ceil((c.kind === "deposit" ? c.cap : c.fixedAmount) / c.releasePerLot) : 0;
  return (
    <Card className="flex flex-col overflow-hidden" data-testid={`bonus-campaign-${c.id}`}>
      <div className="border-b border-line bg-surface-2/60 px-5 pb-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <Chip tone={c.kind === "deposit" ? "ember" : "gold"} size="sm" className="font-semibold tracking-wider">
            {c.kind === "deposit" ? "DEPOSIT BONUS" : "BONUS"}
          </Chip>
          {c.endsAt && (
            <span className="flex items-center gap-1 text-[11.5px] text-fg-3">
              <Clock className="size-3" /> Until {fmtDate(c.endsAt, false)}
            </span>
          )}
        </div>
        <div className="mt-3 text-[26px] font-semibold leading-tight tracking-tight text-gold">{c.kind === "deposit" ? `${c.pct}%` : money0(c.fixedAmount)}</div>
        <div className="text-[12.5px] text-fg-2">{c.kind === "deposit" ? `up to ${money0(c.cap)} on deposits from ${money0(c.minDeposit)}` : "credited to a live account"}</div>
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-3">
        <div className="text-[16px] font-medium tracking-tight">{c.name}</div>
        {c.description && <div className="mt-0.5 text-[12.5px] text-fg-3">{c.description}</div>}
        <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
          <div className="k-row px-3 py-2">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Release</div>
            <div className="k-num mt-0.5 font-medium">{c.releasePerLot > 0 ? `${fmtUsd(c.releasePerLot)} / lot` : "—"}</div>
          </div>
          <div className="k-row px-3 py-2">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Full release</div>
            <div className="k-num mt-0.5 font-medium">{lots ? `${lots.toLocaleString("en-US")} lots` : "—"}</div>
          </div>
          <div className="k-row px-3 py-2">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Expires</div>
            <div className="k-num mt-0.5 font-medium">{c.expiryDays} days</div>
          </div>
          <div className="k-row px-3 py-2">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">On withdrawal</div>
            <div className="mt-0.5 font-medium">{c.forfeitOnWithdrawal ? "Forfeited" : "Kept"}</div>
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
              <CheckCircle2 /> Claimed
            </Button>
          ) : c.eligible ? (
            <ClaimDialog c={c} onClaimed={onClaimed} />
          ) : (
            <Button size="sm" variant="surface" disabled className="flex-1">
              Not eligible
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
  return (
    <div className={cn("k-row px-4 py-3.5", ended && "opacity-70")} data-testid="bonus-grant" data-grant-status={g.status}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
            {g.campaign}
            <GrowthStatus status={g.status} />
          </div>
          <div className="text-[11.5px] text-fg-3">
            {g.login ? <span className="font-mono">#{g.login}</span> : "No account yet"}
            {g.depositAmount ? ` · on ${fmtUsd(g.depositAmount)} deposit` : ""} · claimed {fmtDate(g.claimedAt)}
            {g.source && g.source !== "claim" ? ` · ${titleCase(g.source)}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="k-num text-[18px] font-semibold">{g.status === "awaiting_deposit" ? "—" : fmtUsd(g.amount)}</div>
          <div className="text-[10.5px] text-fg-3">bonus</div>
        </div>
      </div>
      {g.status === "awaiting_deposit" ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[12px] border border-warn/25 bg-warn-soft px-3 py-2 text-[12px] text-warn">
          <span>Make a qualifying deposit to a live account{g.claimDeadline ? ` by ${fmtDate(g.claimDeadline)}` : ""} to receive the bonus.</span>
          <Link href="/wallet/deposit" className="shrink-0 underline underline-offset-2">
            Deposit
          </Link>
        </div>
      ) : (
        <div className="mt-3">
          <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-[11.5px] text-fg-3">
            <span className="k-num">
              {fmtLots(g.lotsTraded)} / {fmtLots(g.lotsRequired)} lots · {fmtUsd(g.releasePerLot)} per lot
            </span>
            <span className="k-num">
              <span className="text-up">{fmtUsd(g.released)} released</span> · {fmtUsd(g.remaining)} remaining
            </span>
          </div>
          <Progress value={pct} tone={g.status === "completed" ? "up" : "gold"} className="h-2" />
          <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-[11.5px] text-fg-3">
            <span className="k-num">{Math.round(pct)}% released</span>
            <span>{ended ? `${titleCase(g.endReason ?? g.status)} ${fmtDate(g.endedAt)}` : g.expiresAt ? `Expires ${fmtDateTime(g.expiresAt)}` : ""}</span>
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
      setResult({ ok: true, message: r.result.message || "Promo code applied." });
      setCode("");
      onApplied();
    } catch (err) {
      setResult({ ok: false, message: err instanceof GrowthApiError ? err.message : "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader title="Promo code" subtitle="Bonus, points or fee-discount codes" icon={<Ticket />} />
      <form onSubmit={submit} className="space-y-3 px-4 pb-6 pt-4 sm:px-6">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
          placeholder="Enter code"
          maxLength={40}
          aria-label="Promo code"
          data-testid="promo-input"
          inputClassName="font-mono tracking-wider"
        />
        {live.length > 0 && (
          <label className="flex items-center gap-2 text-[12.5px] text-fg-3">
            <span className="shrink-0">Account</span>
            <select
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-[12px] border border-line bg-surface-2 px-3 text-[13px] text-fg outline-none focus:border-ember/50"
              data-testid="promo-account"
            >
              <option value="">Any (only needed for account bonuses)</option>
              {live.map((a) => (
                <option key={a.login} value={a.login}>
                  #{a.login} · {a.groupName}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button type="submit" variant="ember" className="w-full" disabled={busy || !code.trim()} data-testid="promo-submit">
          {busy && <Loader2 className="animate-spin" />} Apply code
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
  const { data, error, reload } = useGrowth<Promotions>("promotions", 60_000);
  const title = "Promotions";
  const subtitle = "Deposit bonuses, trading credit and promo codes. Bonus is released to your balance as you trade.";
  if (!data) return <PageFallback title={title} subtitle={subtitle} error={error} onRetry={reload} top={<BannerSlot placement="rewards" />} rows={[{ cols: "sm:grid-cols-3", h: "h-[150px]", n: 3 }, { cols: "md:grid-cols-3", h: "h-[320px]", n: 3 }]} />;

  const { campaigns, grants, promoHistory } = data;
  const running = grants.filter((g) => g.status === "active" || g.status === "pending");
  const outstanding = running.reduce((s, g) => s + g.remaining, 0);
  const released = grants.reduce((s, g) => s + g.released, 0);

  const promoCols: Column<PromoUse>[] = [
    { key: "date", header: "Date", cell: (p) => <span className="k-num text-fg-2">{fmtDateTime(p.createdAt)}</span>, sort: (p) => p.createdAt, width: "150px" },
    { key: "code", header: "Code", cell: (p) => <span className="font-mono text-[13px] font-medium tracking-wider">{p.code}</span> },
    { key: "kind", header: "Type", hideOn: "sm", cell: (p) => <span className="text-fg-2">{titleCase(p.kind)}</span> },
    { key: "reason", header: "Details", hideOn: "md", cell: (p) => <span className="text-[12.5px] text-fg-3">{p.reason ?? "—"}</span> },
    { key: "st", header: "Result", align: "right", cell: (p) => <GrowthStatus status={p.status} /> },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Link href="/wallet/deposit">
            <Button variant="surface" size="lg">
              <Wallet /> Deposit
            </Button>
          </Link>
        }
      />
      <BannerSlot placement="rewards" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Bonus to release" value={<Money value={outstanding} countUp={false} />} hot illustration="wrapped_gift" chip={`${running.length} active bonus${running.length === 1 ? "" : "es"}`} chipTone="ember" />
        <KpiCard label="Released to balance" icon={<CheckCircle2 />} value={<Money value={released} countUp={false} />} chip="Withdrawable once released" chipTone="up" delay={0.05} />
        <KpiCard label="Offers available" icon={<Gift />} value={<span className="k-num">{campaigns.filter((c) => c.eligible && !c.claimed).length}</span>} chip={`${campaigns.length} running`} delay={0.1} />
      </div>

      <Reveal delay={0.05} className="mt-8">
        <SectionTitle title="Offers" text="Claim a bonus, then trade to release it to your balance." />
        {campaigns.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <Icon3D name="wrapped_gift" size={52} />
              <h3 className="mt-4 text-[17px] font-medium">No offers right now</h3>
              <p className="mt-1 max-w-md text-[13.5px] text-fg-3">New bonus campaigns appear here. Have a promo code? Enter it below.</p>
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
            <CardHeader title="My bonuses" subtitle="Release progress per bonus · each closed lot moves bonus to balance" icon={<Gift />} />
            <div className="space-y-2 px-4 pb-6 pt-4 sm:px-6">
              {grants.length === 0 ? <CardEmpty title="No bonuses yet" text="Claim an offer above or apply a promo code." /> : grants.map((g) => <GrantRow key={String(g.id)} g={g} />)}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <PromoCard onApplied={reload} />
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title="Promo code history" subtitle="Codes you applied, including blocked attempts" />
          <div className="px-4 pb-6 pt-4 sm:px-6">
            <DataTable columns={promoCols} rows={promoHistory} pageSize={8} rowKey={(p) => String(p.id)} dense empty={<CardEmpty title="No promo codes used" text="Codes you apply appear here." />} />
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
