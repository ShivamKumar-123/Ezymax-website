"use client";

import * as React from "react";
import { ArrowUpRight, Calculator, Check, Clock, Info, Loader2, Lock, Sparkles, Ticket } from "lucide-react";
import { toast } from "sonner";
import type { MessageKey } from "@kalks/i18n";
import { Trans, useT } from "@kalks/i18n/react";
import { Button, Card, CardHeader, Chip, CopyButton, DataTable, Dialog, DialogClose, Icon3D, Input, KeyValue, MiniBars, PageHeader, Reveal, Segmented, cn, type Column } from "@kalks/ui";
import { BannerSlot } from "./banner-slot";
import {
  errorToast,
  fmtDate,
  fmtCount,
  fmtDateTime,
  fmtPoints,
  fmtUsd,
  growthApi,
  titleCase,
  useGrowth,
  type CatalogueItem,
  type PointsPage,
  type PointsTx,
  type Redemption,
  type Rewards,
  type Tier,
  type Voucher,
} from "./api";
import { CardEmpty, GrowthStatus, LiveAccountPicker, PageFallback, TierOrb } from "./ui";

const tierRank = (tiers: Tier[], key: string | null) => (key ? (tiers.find((t) => t.key === key)?.rank ?? 0) : 0);
const tierName = (tiers: Tier[], key: string | null) => (key ? (tiers.find((t) => t.key === key)?.name ?? titleCase(key)) : "");
const fmtMult = (m: number) => `${Number.isInteger(m) ? m : +m.toFixed(2)}×`;

/* ------------------------------------------------------------------ */
/* Balance                                                             */
/* ------------------------------------------------------------------ */

function BalanceHero({ r }: { r: Rewards }) {
  const t = useT();
  const last7 = r.series.slice(-7).map((d) => d.points);
  return (
    <Card hot className="relative h-full overflow-hidden">
      <div className="relative flex h-full flex-col p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <span className="k-label">{t("rewards.loyalty.balance")}</span>
          <Chip tone="gold">
            <TierOrb tier={r.tier.key} name={r.tier.name} size={14} /> {r.tier.name} · {fmtMult(r.tier.multiplier)}
          </Chip>
        </div>
        <div className="mt-5 flex items-baseline gap-2">
          <span className="k-num text-[48px] font-semibold leading-none tracking-[-0.03em] sm:text-[56px]" data-testid="points-balance">
            {fmtPoints(r.points.balance)}
          </span>
          <span className="text-[16px] text-fg-2">{t("rewards.unit.pts")}</span>
        </div>
        <div className="mt-2 text-[14px] text-fg-2">
          ≈ <span className="k-num font-medium text-fg">{fmtUsd(r.points.balance * r.pointValue)}</span> {t("rewards.loyalty.redeemable")}
        </div>
        <div className="mt-6 grid max-w-[340px] grid-cols-2 gap-2">
          <div className="rounded-[14px] border border-line bg-surface-2/70 px-3.5 py-3">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{t("rewards.loyalty.thisMonth")}</div>
            <div className="k-num mt-1 text-[16px] font-semibold text-up">+{fmtPoints(r.points.earnedThisMonth)}</div>
            {last7.some((v) => v > 0) ? <MiniBars data={last7} className="mt-2 h-6" /> : <div className="mt-2 h-6 text-[11px] leading-6 text-fg-3">{t("rewards.loyalty.noTradesWeek")}</div>}
          </div>
          <div className="rounded-[14px] border border-line bg-surface-2/70 px-3.5 py-3">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{t("rewards.loyalty.lifetime")}</div>
            <div className="k-num mt-1 text-[16px] font-semibold">{fmtPoints(r.points.lifetime)}</div>
            <div className="k-num mt-2 text-[11px] text-fg-3">{t("rewards.loyalty.lotsThisMonth", { lots: r.points.lotsThisMonth.toFixed(2) })}</div>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
          <a href="#catalogue">
            <Button variant="ember">
              {t("rewards.loyalty.redeemPoints")} <ArrowUpRight />
            </Button>
          </a>
          {r.points.expiringSoon && r.points.expiringSoon.points > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-warn/25 bg-warn-soft px-3 py-1.5 text-[11.5px] text-warn">
              <Clock className="size-3.5" /> {t("rewards.loyalty.expire", { points: fmtPoints(r.points.expiringSoon.points), date: fmtDate(r.points.expiringSoon.at, false) })}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Tiers                                                               */
/* ------------------------------------------------------------------ */

function TierTrack({ r }: { r: Rewards }) {
  const t = useT();
  const tiers = [...r.tiers].sort((a, b) => a.rank - b.rank);
  const idx = Math.max(0, tiers.findIndex((t) => t.key === r.tier.key));
  const cur = tiers[idx] ?? { ...r.tier };
  const next = r.nextTier;
  const q = r.points.earned12m;
  const segPct = next ? Math.min(1, Math.max(0, (q - cur.minPoints) / Math.max(1, next.minPoints - cur.minPoints))) : 1;
  const overall = tiers.length > 1 ? ((idx + (next ? segPct : 0)) / (tiers.length - 1)) * 100 : 100;
  const [sel, setSel] = React.useState(idx);
  React.useEffect(() => setSel(idx), [idx]);
  const selTier = tiers[sel] ?? cur;
  const kfmt = (v: number) => (v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v));
  return (
    <Card className="h-full">
      <CardHeader
        title={t("rewards.tiers.title")}
        subtitle={t("rewards.tiers.subtitle")}
        action={
          <Chip tone="gold" dot>
            {t("rewards.tiers.member", { tier: r.tier.name })}
          </Chip>
        }
      />
      <div className="px-4 pb-6 pt-8 sm:px-8">
        <div className="relative">
          <div className="absolute start-5 end-5 top-5 h-1.5 -translate-y-1/2 rounded-full bg-surface-3" />
          <div className="absolute start-5 end-5 top-5 h-1.5 -translate-y-1/2">
            <div className="h-full rounded-full bg-gradient-to-r from-[#d98b4a] via-[#e9b949] to-[#ff8a3d] transition-[width] duration-500" style={{ width: `${overall}%` }} />
          </div>
          <div className="relative flex justify-between">
            {tiers.map((tier, i) => {
              const reached = i <= idx;
              return (
                <button key={tier.key} type="button" onClick={() => setSel(i)} className="group flex w-12 flex-col items-center" aria-pressed={i === sel}>
                  <span className={cn("relative rounded-full", i === idx && "ring-4 ring-gold/25", i === sel && i !== idx && "ring-2 ring-line")}>
                    {reached ? (
                      <TierOrb tier={tier.key} name={tier.name} size={40} />
                    ) : (
                      <span className="grid size-10 place-items-center rounded-full border border-line bg-surface-2 text-fg-3">
                        <Lock className="size-3.5" />
                      </span>
                    )}
                  </span>
                  <span className={cn("mt-2.5 whitespace-nowrap text-[12px] font-medium", i === idx ? "text-gold" : reached ? "text-fg" : "text-fg-3")}>{tier.name}</span>
                  <span className="k-num text-[10.5px] text-fg-3">{kfmt(tier.minPoints)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="k-row px-4 py-4">
            {next ? (
              <>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-fg-3">{t("rewards.tiers.progressTo", { tier: next.name })}</span>
                  <span className="k-num text-fg-2">
                    {fmtPoints(q)} / {fmtPoints(next.minPoints)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${segPct * 100}%` }} />
                </div>
                <div className="mt-2.5 text-[13px]">
                  <span className="k-num font-semibold text-gold">{t("rewards.value.pts", { points: fmtPoints(next.pointsToGo) })}</span>
                  <span className="text-fg-2">{t("rewards.tiers.toTier", { tier: next.name })}</span>
                </div>
              </>
            ) : (
              <>
                <div className="text-[12px] text-fg-3">{t("rewards.tiers.top")}</div>
                <div className="mt-2 text-[13px] text-fg-2">
                  <Trans k="rewards.tiers.topText" vars={{ mult: fmtMult(r.tier.multiplier) }} tags={{ b: (c) => <span className="k-num font-semibold text-gold">{c}</span> }} />
                </div>
              </>
            )}
          </div>
          <div className="k-row px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px] font-medium">
                <TierOrb tier={selTier.key} name={selTier.name} size={22} /> {selTier.name} · {fmtMult(selTier.multiplier)}
              </div>
              {sel <= idx ? (
                <Chip size="sm" tone="up">
                  {t("rewards.tiers.unlocked")}
                </Chip>
              ) : (
                <Chip size="sm">{t("rewards.tiers.locked")}</Chip>
              )}
            </div>
            {selTier.perks.length > 0 ? (
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {selTier.perks.map((p) => (
                  <li key={p} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-3 px-2.5 py-1 text-[11.5px] text-fg-2">
                    <Check className={cn("size-3", sel <= idx ? "text-up" : "text-fg-3")} />
                    {p}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2.5 text-[12px] text-fg-3">{t("rewards.tiers.noPerks")}</div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Earn rules + estimator                                              */
/* ------------------------------------------------------------------ */

const CLASS_ICON: Record<string, string> = {
  forex: "globe_with_meridians",
  metals: "coin",
  metal: "coin",
  crypto: "coin",
  indices: "chart_increasing",
  index: "chart_increasing",
  energy: "fire",
  commodities: "fire",
  stocks: "bar_chart",
  shares: "bar_chart",
};

function ruleLabel(rule: Rewards["rules"][number], allLabel: string) {
  if (rule.name) return rule.name;
  if (rule.symbols.length) return rule.symbols.join(", ");
  return rule.assetClass ? titleCase(rule.assetClass) : allLabel;
}

function EarnRules({ r }: { r: Rewards }) {
  const t = useT();
  const rules = r.rules;
  const [sel, setSel] = React.useState(0);
  const [lots, setLots] = React.useState("10");
  const rule = rules[Math.min(sel, rules.length - 1)];
  const pts = rule ? Math.floor((parseFloat(lots) || 0) * rule.pointsPerLot * r.tier.multiplier) : 0;
  const max = Math.max(1, ...rules.map((x) => x.pointsPerLot));
  return (
    <Card className="h-full">
      <CardHeader
        title={t("rewards.earn.title")}
        subtitle={t("rewards.earn.subtitle", { seconds: r.minHoldSeconds, months: r.pointsExpiryMonths })}
        icon={<Sparkles />}
      />
      {rules.length === 0 ? (
        <div className="px-4 pb-6 pt-4 sm:px-6">
          <CardEmpty title={t("rewards.earn.emptyTitle")} text={t("rewards.earn.emptyText")} />
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 px-4 sm:px-6 xl:grid-cols-3">
            {rules.map((x, i) => (
              <button
                key={String(x.id)}
                type="button"
                onClick={() => setSel(i)}
                className={cn("k-row flex items-center gap-2.5 px-3 py-3 text-start transition-colors hover:bg-surface-3/60 sm:gap-3 sm:px-3.5", sel === i && "border-ember/40 bg-ember-soft")}
              >
                <Icon3D name={CLASS_ICON[(x.assetClass ?? "").toLowerCase()] ?? "sparkles"} size={32} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13.5px] font-medium">{ruleLabel(x, t("rewards.earn.allInstruments"))}</span>
                    <span className="k-num text-[14px] font-semibold text-gold">{x.pointsPerLot}</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${(x.pointsPerLot / max) * 100}%` }} />
                  </div>
                  <div className="mt-1 truncate text-[11px] text-fg-3">
                    {x.symbols.length ? x.symbols.slice(0, 4).join(", ") : x.assetClass ? t("rewards.earn.allClass", { assetClass: x.assetClass }) : t("rewards.earn.anyInstrument")}
                    {x.accountType === "any" ? t("rewards.earn.demoToo") : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="mx-4 mb-6 mt-3 flex flex-col gap-3 rounded-[16px] border border-dashed border-line px-4 py-3.5 sm:mx-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-[13px] text-fg-2">
              <Calculator className="size-4 text-fg-3" /> {t("rewards.earn.estimate")}
            </div>
            <Input value={lots} onChange={(e) => setLots(e.target.value.replace(/[^0-9.]/g, ""))} className="h-9 sm:w-32" trailing={<span className="text-[12px]">{t("rewards.unit.lots")}</span>} inputMode="decimal" aria-label={t("rewards.earn.lotsLabel")} />
            <span className="text-[13px] text-fg-3">
              {t("rewards.earn.estimateOf", { rule: rule ? ruleLabel(rule, t("rewards.earn.allInstruments")).toLowerCase() : "", tier: r.tier.name, mult: fmtMult(r.tier.multiplier) })}
            </span>
            <span className="k-num text-[18px] font-semibold text-gold" data-testid="points-estimate">
              {t("rewards.value.pts", { points: fmtPoints(pts) })}
            </span>
            <span className="k-num text-[12px] text-fg-3 sm:ms-auto">≈ {fmtUsd(pts * r.pointValue)}</span>
          </div>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

const KIND_ICON: Record<string, string> = { cashback: "money_with_wings", bonus_credit: "wrapped_gift", fee_discount: "receipt" };

function itemValue(it: CatalogueItem, t: ReturnType<typeof useT>) {
  if (it.kind === "fee_discount") return t("rewards.item.feeDiscount", { pct: it.value });
  if (it.kind === "bonus_credit") return t("rewards.item.tradingBonus", { amount: fmtUsd(it.value, it.value % 1 ? 2 : 0) });
  return t("rewards.item.toWallet", { amount: fmtUsd(it.value, it.value % 1 ? 2 : 0) });
}

function RedeemDialog({ item, r, onClose, onDone }: { item: CatalogueItem | null; r: Rewards; onClose: () => void; onDone: () => void }) {
  const [login, setLogin] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<Redemption | null>(null);
  const t = useT();
  React.useEffect(() => {
    if (!item) {
      setLogin(null);
      setDone(null);
    }
  }, [item]);
  const needsAccount = item?.kind === "bonus_credit";

  const redeem = async () => {
    if (!item) return;
    setBusy(true);
    try {
      const res = await growthApi<{ redemption: Redemption; balance: number }>("redeem", { body: needsAccount ? { itemId: item.id, login } : { itemId: item.id } });
      onDone();
      if (res.redemption.voucherCode) setDone(res.redemption);
      else {
        toast.success(t("rewards.redeem.toastRedeemed", { name: item.name }), {
          description: t(res.redemption.status === "pending" ? "rewards.redeem.toastDeductedPending" : "rewards.redeem.toastDeducted", { points: fmtPoints(item.costPoints), balance: fmtPoints(res.balance) }),
        });
        onClose();
      }
    } catch (e) {
      errorToast(t("rewards.redeem.error"), e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!item}
      onOpenChange={(o) => !o && onClose()}
      title={done ? t("rewards.redeem.voucherTitle") : item ? t("rewards.redeem.title", { name: item.name }) : ""}
      description={done ? t("rewards.redeem.voucherDesc") : t("rewards.redeem.desc")}
      width={480}
      footer={
        done ? (
          <DialogClose asChild>
            <Button variant="ember">{t("common.done")}</Button>
          </DialogClose>
        ) : (
          <>
            <DialogClose asChild>
              <Button variant="ghost">{t("common.cancel")}</Button>
            </DialogClose>
            <Button variant="ember" disabled={busy || (needsAccount && !login)} onClick={redeem} data-testid="redeem-confirm">
              {busy && <Loader2 className="animate-spin" />} {t("rewards.redeem.confirm")}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="flex items-center gap-3 rounded-[16px] border border-ember/30 bg-ember-soft px-4 py-4" data-testid="voucher-code">
          <Ticket className="size-5 text-ember" />
          <span className="flex-1 font-mono text-[18px] font-semibold tracking-wider">{done.voucherCode}</span>
          <CopyButton value={done.voucherCode ?? ""} label={t("rewards.redeem.voucherCode")} className="size-8 rounded-full" />
        </div>
      ) : item ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-[18px] border border-line bg-surface-2 p-4">
            <Icon3D name={KIND_ICON[item.kind] ?? "wrapped_gift"} size={52} />
            <div className="min-w-0">
              <div className="text-[15px] font-medium">{item.name}</div>
              <div className="text-[12.5px] text-fg-3">{item.description || itemValue(item, t)}</div>
            </div>
          </div>
          <KeyValue
            rows={[
              [t("rewards.redeem.reward"), itemValue(item, t)],
              [t("rewards.redeem.cost"), <span key="c" className="text-gold">{t("rewards.value.pts", { points: fmtPoints(item.costPoints) })}</span>],
              [t("rewards.redeem.currentBalance"), t("rewards.value.pts", { points: fmtPoints(r.points.balance) })],
              [t("rewards.redeem.balanceAfter"), t("rewards.value.pts", { points: fmtPoints(r.points.balance - item.costPoints) })],
              [t("rewards.redeem.deliveredTo"), item.kind === "cashback" ? t("rewards.redeem.toWallet") : item.kind === "bonus_credit" ? t("rewards.redeem.toAccount") : t("rewards.redeem.toVoucher")],
            ]}
          />
          {needsAccount && (
            <div>
              <div className="k-label mb-2">{t("rewards.picker.label")}</div>
              <LiveAccountPicker value={login} onChange={setLogin} hint={t("rewards.redeem.accountHint")} />
            </div>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}

function Catalogue({ r, onChanged }: { r: Rewards; onChanged: () => void }) {
  const t = useT();
  const [open, setOpen] = React.useState<CatalogueItem | null>(null);
  const items = r.catalogue.filter((i) => i.active);
  const myRank = tierRank(r.tiers, r.tier.key);
  return (
    <Card id="catalogue" className="scroll-mt-24">
      <CardHeader
        title={t("rewards.catalogue.title")}
        subtitle={
          <span>
            <Trans k="rewards.catalogue.youHave" vars={{ points: fmtPoints(r.points.balance) }} tags={{ b: (c) => <span className="k-num font-medium text-gold">{c}</span> }} />
          </span>
        }
      />
      <div className="mt-5">
        {items.length === 0 ? (
          <div className="px-4 pb-6 sm:px-6">
            <CardEmpty title={t("rewards.catalogue.emptyTitle")} text={t("rewards.catalogue.emptyText")} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 px-4 pb-6 sm:gap-3 sm:px-6 xl:grid-cols-4">
            {items.map((it) => {
              const lockedTier = it.minTier && tierRank(r.tiers, it.minTier) > myRank;
              const out = it.stock !== null && it.stock <= 0;
              const afford = r.points.balance >= it.costPoints;
              const ok = !lockedTier && !out && afford;
              return (
                <div key={String(it.id)} className="flex flex-col rounded-[18px] border border-line bg-surface-2 p-3.5 transition-colors hover:border-[var(--k-border-top)] sm:p-4" data-testid={`catalogue-item-${it.id}`}>
                  <div className="flex items-start justify-between">
                    <Icon3D name={KIND_ICON[it.kind] ?? "wrapped_gift"} size={44} />
                    {it.minTier ? (
                      <Chip size="sm" tone={lockedTier ? "neutral" : "gold"}>
                        {lockedTier && <Lock className="size-3" />} {tierName(r.tiers, it.minTier)}+
                      </Chip>
                    ) : it.stock !== null ? (
                      <Chip size="sm" tone={out ? "down" : "neutral"}>
                        {out ? t("rewards.catalogue.outOfStock") : t("rewards.catalogue.left", { count: it.stock })}
                      </Chip>
                    ) : null}
                  </div>
                  <div className="mt-3 text-[13.5px] font-medium sm:text-[14.5px]">{it.name}</div>
                  <div className="mt-0.5 line-clamp-2 min-h-[34px] text-[12px] text-fg-3">{it.description || itemValue(it, t)}</div>
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-4">
                    <div>
                      <div className="k-num text-[15px] font-semibold text-gold">{t("rewards.value.pts", { points: fmtPoints(it.costPoints) })}</div>
                      <div className="k-num text-[10.5px] text-fg-3">{itemValue(it, t)}</div>
                    </div>
                    <Button
                      size="xs"
                      variant={ok ? "ember" : "surface"}
                      data-testid={`redeem-${it.id}`}
                      onClick={() => {
                        if (lockedTier) toast.error(t("rewards.catalogue.tierRequired", { tier: tierName(r.tiers, it.minTier) }), { description: t("rewards.catalogue.tierRequiredText") });
                        else if (out) toast.error(t("rewards.catalogue.outOfStock"), { description: t("rewards.catalogue.outOfStockText") });
                        else if (!afford) toast.error(t("rewards.catalogue.notEnough"), { description: t("rewards.catalogue.needMore", { points: fmtPoints(it.costPoints - r.points.balance) }) });
                        else setOpen(it);
                      }}
                    >
                      {t("rewards.catalogue.redeem")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <RedeemDialog item={open} r={r} onClose={() => setOpen(null)} onDone={onChanged} />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* History, vouchers, redemptions                                      */
/* ------------------------------------------------------------------ */

const KIND_TONE: Record<string, "up" | "ember" | "gold" | "neutral" | "info" | "down"> = { earn: "up", redeem: "ember", bonus: "gold", promo: "gold", expire: "neutral", adjust: "info", reversal: "down" };
const KIND_LABEL: Record<string, MessageKey> = { earn: "rewards.kind.earn", redeem: "rewards.kind.redeem", bonus: "rewards.kind.bonus", promo: "rewards.kind.promo", expire: "rewards.kind.expire", adjust: "rewards.kind.adjust", reversal: "rewards.kind.reversal" };
type KindFilter = "all" | "earn" | "redeem" | "bonus" | "promo" | "expire";

function PointsHistory({ version }: { version: number }) {
  const t = useT();
  const [kind, setKind] = React.useState<KindFilter>("all");
  const { data, error, loading, reload } = useGrowth<PointsPage>(`points?page=1&limit=100${kind === "all" ? "" : `&kind=${kind}`}`);
  React.useEffect(() => {
    if (version) reload();
  }, [version, reload]);
  const columns: Column<PointsTx>[] = [
    { key: "date", header: t("common.date"), cell: (x) => <span className="k-num text-fg-2">{fmtDateTime(x.createdAt)}</span>, sort: (x) => x.createdAt, csv: (x) => x.createdAt, width: "160px" },
    { key: "desc", header: t("rewards.history.colActivity"), cell: (x) => <span className="font-medium">{x.description}</span>, csv: (x) => x.description },
    {
      key: "kind",
      header: t("common.type"),
      cell: (x) => (
        <Chip size="sm" tone={KIND_TONE[x.kind] ?? "neutral"}>
          {KIND_LABEL[x.kind] ? t(KIND_LABEL[x.kind]!) : titleCase(x.kind)}
        </Chip>
      ),
      csv: (x) => x.kind,
    },
    { key: "acc", header: t("common.account"), hideOn: "md", cell: (x) => (x.login ? <span className="font-mono text-[12.5px] text-fg-2">#{x.login}</span> : <span className="text-fg-3">—</span>), csv: (x) => x.login ?? "" },
    {
      key: "pts",
      header: t("rewards.history.colPoints"),
      align: "right",
      sort: (x) => x.points,
      csv: (x) => x.points,
      cell: (x) => (
        <span className={cn("k-num font-semibold", x.points > 0 ? "text-up" : x.kind === "expire" ? "text-fg-3" : "text-fg")}>
          {x.points > 0 ? "+" : ""}
          {fmtPoints(x.points)}
        </span>
      ),
    },
  ];
  return (
    <Card>
      <CardHeader title={t("rewards.history.title")} subtitle={data ? `${t("rewards.history.entries", { count: data.total, n: fmtCount(data.total) })}${data.total > data.items.length ? t("rewards.history.latestShown", { count: data.items.length }) : ""}` : t("rewards.history.subtitle")} />
      <div className="px-4 pb-6 pt-4 sm:px-6">
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          pageSize={10}
          rowKey={(x) => String(x.id)}
          search={(x) => `${x.description} ${x.login ?? ""}`}
          searchPlaceholder={t("rewards.history.search")}
          exportName="kalks-points-history"
          toolbar={
            <Segmented<KindFilter>
              size="xs"
              value={kind}
              onChange={setKind}
              options={[
                { value: "all", label: t("common.all") },
                { value: "earn", label: t("rewards.kind.earn") },
                { value: "redeem", label: t("rewards.kind.redeem") },
                { value: "bonus", label: t("rewards.kind.bonus") },
                { value: "promo", label: t("rewards.kind.promo") },
                { value: "expire", label: t("rewards.kind.expire") },
              ]}
            />
          }
          empty={<CardEmpty title={loading ? t("common.loading") : error ? t("rewards.history.unavailable") : t("rewards.history.emptyTitle")} text={error ? error.message : loading ? undefined : t("rewards.history.emptyText")} />}
        />
      </div>
    </Card>
  );
}

function Vouchers({ version }: { version: number }) {
  const t = useT();
  const { data, reload } = useGrowth<{ items: Voucher[] }>("vouchers");
  React.useEffect(() => {
    if (version) reload();
  }, [version, reload]);
  const items = data?.items ?? [];
  return (
    <Card className="h-full">
      <CardHeader title={t("rewards.vouchers.title")} subtitle={t("rewards.vouchers.subtitle")} icon={<Ticket />} />
      <div className="space-y-2 px-4 pb-6 pt-4 sm:px-6">
        {items.length === 0 ? (
          <CardEmpty title={t("rewards.vouchers.emptyTitle")} text={t("rewards.vouchers.emptyText")} />
        ) : (
          items.map((v) => (
            <div key={String(v.id)} className={cn("k-row flex items-center gap-3 px-3.5 py-3", v.status !== "active" && "opacity-60")}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13.5px] font-semibold tracking-wider">{v.code}</span>
                  {v.status === "active" && <CopyButton value={v.code} label={t("rewards.redeem.voucherCode")} />}
                </div>
                <div className="text-[11.5px] text-fg-3">
                  {t(v.appliesTo === "any" ? "rewards.vouchers.offFees" : v.appliesTo === "prop" ? "rewards.vouchers.offProp" : "rewards.vouchers.offCommission", { pct: v.pct })} · {v.status === "used" ? t("rewards.vouchers.used", { date: fmtDate(v.usedAt) }) : t("rewards.vouchers.expires", { date: fmtDate(v.expiresAt) })}
                </div>
              </div>
              <GrowthStatus status={v.status} />
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function Redemptions({ version }: { version: number }) {
  const t = useT();
  const { data, reload } = useGrowth<{ items: Redemption[] }>("redemptions");
  React.useEffect(() => {
    if (version) reload();
  }, [version, reload]);
  const columns: Column<Redemption>[] = [
    { key: "date", header: t("common.date"), cell: (x) => <span className="k-num text-fg-2">{fmtDateTime(x.createdAt)}</span>, sort: (x) => x.createdAt, width: "150px" },
    {
      key: "item",
      header: t("rewards.redemptions.colReward"),
      cell: (x) => (
        <span className="min-w-0">
          <span className="block font-medium">{x.itemName}</span>
          {x.voucherCode ? <span className="block font-mono text-[11.5px] text-fg-3">{x.voucherCode}</span> : x.login ? <span className="block font-mono text-[11.5px] text-fg-3">#{x.login}</span> : null}
        </span>
      ),
    },
    { key: "pts", header: t("rewards.redemptions.colPoints"), align: "right", cell: (x) => <span className="k-num font-medium">-{fmtPoints(x.points)}</span>, sort: (x) => x.points },
    { key: "st", header: t("common.status"), align: "right", cell: (x) => <GrowthStatus status={x.status} /> },
  ];
  return (
    <Card className="h-full">
      <CardHeader title={t("rewards.redemptions.title")} subtitle={t("rewards.redemptions.subtitle")} />
      <div className="px-4 pb-6 pt-4 sm:px-6">
        {(data?.items ?? []).length === 0 ? <CardEmpty title={t("rewards.redemptions.emptyTitle")} text={t("rewards.redemptions.emptyText")} /> : <DataTable columns={columns} rows={data!.items} pageSize={6} rowKey={(x) => String(x.id)} dense />}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LiveLoyaltyPage() {
  const t = useT();
  const { data: r, error, reload } = useGrowth<Rewards>("rewards");
  const [version, setVersion] = React.useState(0);
  const changed = React.useCallback(() => {
    reload();
    setVersion((v) => v + 1);
  }, [reload]);
  const title = t("rewards.loyalty.title");
  const subtitle = t("rewards.loyalty.subtitle");
  if (!r) return <PageFallback title={title} subtitle={subtitle} error={error} onRetry={reload} top={<BannerSlot placement="rewards" />} rows={[{ cols: "xl:grid-cols-2", h: "h-[340px]", n: 2 }, { cols: "", h: "h-[220px]", n: 1 }]} />;
  return (
    <div className="pb-16">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Button
            variant="surface"
            onClick={() =>
              toast(t("rewards.loyalty.howTitle"), {
                description: t("rewards.loyalty.howText", { seconds: r.minHoldSeconds, value: fmtUsd(r.pointValue, 2), months: r.pointsExpiryMonths }),
              })
            }
          >
            <Info /> {t("rewards.loyalty.howItWorks")}
          </Button>
        }
      />
      <BannerSlot placement="rewards" />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-5">
          <BalanceHero r={r} />
        </Reveal>
        <Reveal delay={0.08} className="xl:col-span-7">
          <TierTrack r={r} />
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <EarnRules r={r} />
      </Reveal>

      <Reveal delay={0.1} className="mt-4">
        <Catalogue r={r} onChanged={changed} />
      </Reveal>

      <Reveal delay={0.1} className="mt-4">
        <PointsHistory version={version} />
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-5">
          <Vouchers version={version} />
        </Reveal>
        <Reveal delay={0.12} className="xl:col-span-7">
          <Redemptions version={version} />
        </Reveal>
      </div>
    </div>
  );
}
