"use client";

import * as React from "react";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Clock,
  Hourglass,
  Infinity as InfinityIcon,
  Info,
  RotateCcw,
  Save,
  ShieldAlert,
  Target,
  Timer,
  UserX,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  DataTable,
  IconButton,
  IconGlyph,
  Money,
  PageHeader,
  Reveal,
  Segmented,
  Skeleton,
  SymbolAvatar,
  cn,
  formatMoney,
  type Column,
} from "@kalks/ui";
import { Trans, tr, useT } from "@kalks/i18n/react";
import type { MessageKey } from "@kalks/i18n";
import { RangeSlider } from "@/components/social/controls";
import {
  errorToast,
  fmtDateTime,
  fmtLots,
  fmtPct,
  fmtRate,
  kindLabel,
  partnerApi,
  usePartner,
  type CommissionRow,
  type CommissionsResp,
  type Dashboard,
  type Level,
  type Programme,
  type SymbolGroup,
} from "./api";
import {
  CardEmpty,
  CommissionStatusChip,
  LoadProblem,
  PageFallback,
  PersonCell,
  SkeletonGrid,
  TierChip,
} from "./ui";

const byRank = (a: Level, b: Level) => a.rank - b.rank;

function groupHint(g: SymbolGroup) {
  if (g.symbols.length)
    return (
      g.symbols.slice(0, 3).join(", ") +
      (g.symbols.length > 3 ? ` +${g.symbols.length - 3}` : "")
    );
  if (g.assetClass === "forex") return tr("partner.com.otherForex");
  return g.assetClass
    ? tr("partner.com.allClassSymbols", { cls: g.assetClass })
    : "";
}

/* ------------------------------------------------------------------ */

function RateCard({ p, levelKey }: { p: Programme; levelKey: string | null }) {
  const t = useT();
  const levels = [...p.levels].sort(byRank);
  const curIdx = levels.findIndex((l) => l.key === levelKey);
  const nextKey = curIdx >= 0 ? levels[curIdx + 1]?.key : undefined;
  const cur = curIdx >= 0 ? levels[curIdx] : undefined;
  return (
    <Card className="h-full">
      <CardHeader
        title={t("partner.com.rateCard")}
        subtitle={t("partner.com.rateCardSubtitle")}
        action={
          cur ? (
            <Chip tone="ember">{t("partner.com.you", { name: cur.name })}</Chip>
          ) : undefined
        }
      />
      <div className="overflow-x-auto px-4 pb-5 pt-4 sm:px-6">
        <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className="rounded-s-[14px] border-y border-s border-line bg-surface-2 px-4 py-3 text-start text-[11.5px] font-medium uppercase tracking-[0.05em] text-fg-3">
                {t("partner.com.symbolGroup")}
              </th>
              {levels.map((l, i) => (
                <th
                  key={l.key}
                  className={cn(
                    "whitespace-nowrap border-y border-line px-2.5 py-2.5 text-end text-[11px] font-medium uppercase tracking-[0.04em]",
                    i === levels.length - 1 && "rounded-e-[14px] border-e",
                    l.key === levelKey
                      ? "bg-ember-soft text-ember"
                      : l.key === nextKey
                        ? "bg-gold-soft text-gold"
                        : "bg-surface-2 text-fg-3",
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <IconGlyph name={l.icon} className="size-3.5" />
                    {l.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.symbolGroups.map((g) => (
              <tr key={g.key} className="group">
                <td className="border-b border-line px-4 py-3 group-hover:bg-surface-2/60">
                  <div className="flex items-center gap-3">
                    {g.symbols.length > 0 && (
                      <div className="hidden -space-x-1.5 sm:flex">
                        {g.symbols.slice(0, 3).map((s) => (
                          <span
                            key={s}
                            className="rounded-full ring-2 ring-surface"
                          >
                            <SymbolAvatar symbol={s} size={20} />
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium">{g.name}</div>
                      <div className="max-w-[170px] truncate text-[11px] text-fg-3">
                        {groupHint(g)}
                      </div>
                    </div>
                  </div>
                </td>
                {levels.map((l) => {
                  const v = l.rates[g.key];
                  return (
                    <td
                      key={l.key}
                      className={cn(
                        "k-num border-b border-line px-2.5 py-3 text-end tabular-nums group-hover:bg-surface-2/60",
                        l.key === levelKey
                          ? "bg-ember/[0.06] font-semibold text-fg"
                          : l.key === nextKey
                            ? "bg-gold/[0.05] text-gold"
                            : "text-fg-2",
                      )}
                    >
                      {v === undefined ? "—" : fmtRate(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex items-start gap-2 text-[12px] text-fg-3">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          {t("partner.com.rateNote")}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function ticks(max: number) {
  const step = max <= 20 ? 5 : max <= 50 ? 10 : 25;
  const out: number[] = [];
  for (let v = 0; v <= max; v += step) out.push(v);
  if (out[out.length - 1] !== max) out.push(max);
  return out;
}

const SHORT: Record<string, MessageKey> = {
  "fx-major": "partner.com.short.fxMajor",
  "fx-minor": "partner.com.short.fxMinor",
  metals: "partner.com.short.metals",
  indices: "partner.com.short.indices",
  energies: "partner.com.short.energies",
  crypto: "partner.com.short.crypto",
  stocks: "partner.com.short.stocks",
};

function RebatesCard({
  p,
  d,
  onSaved,
}: {
  p: Programme;
  d: Dashboard;
  onSaved: (rebate: number, split: number) => void;
}) {
  const t = useT();
  const [base, setBase] = React.useState({
    rebate: d.member.rebatePct,
    split: d.member.splitPct,
  });
  const [rebate, setRebate] = React.useState(base.rebate);
  const [split, setSplit] = React.useState(base.split);
  const [saving, setSaving] = React.useState(false);
  const level = d.member.level;
  const groups = p.symbolGroups.filter(
    (g) => level && level.rates[g.key] !== undefined,
  );
  const pref = ["metals", "fx-major", "indices", "crypto"];
  const exOptions = [
    ...pref
      .map((k) => groups.find((g) => g.key === k))
      .filter((g): g is SymbolGroup => !!g),
    ...groups.filter((g) => !pref.includes(g.key)),
  ].slice(0, 4);
  const [gk, setGk] = React.useState(
    exOptions.find((g) => g.key === "metals")?.key ?? exOptions[0]?.key ?? "",
  );
  const lots = 10;
  const rate = level?.rates[gk] ?? 0;
  const t1 = p.tiers.find((x) => x.tier === 1)?.pct ?? 100;
  const t2 = p.tiers.find((x) => x.tier === 2)?.pct ?? null;
  const gross1 = (lots * rate * t1) / 100;
  const toClient = (gross1 * rebate) / 100;
  const gross2 = t2 !== null ? (lots * rate * t2) / 100 : 0;
  const toSub = (gross2 * split) / 100;
  const dirty = rebate !== base.rebate || split !== base.split;

  const save = async () => {
    setSaving(true);
    try {
      const r = await partnerApi<{ rebatePct: number; splitPct: number }>(
        "settings",
        { method: "PUT", body: { rebatePct: rebate, splitPct: split } },
      );
      setBase({ rebate: r.rebatePct, split: r.splitPct });
      setRebate(r.rebatePct);
      setSplit(r.splitPct);
      onSaved(r.rebatePct, r.splitPct);
      toast.success(t("partner.com.savedToast"), {
        description: t("partner.com.savedToastText", {
          rebate: fmtPct(r.rebatePct),
          split: fmtPct(r.splitPct),
        }),
      });
    } catch (e) {
      errorToast(t("partner.com.saveFailed"), e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex h-full flex-col" id="rebates">
      <CardHeader
        title={t("partner.com.rebatesTitle")}
        subtitle={t("partner.com.rebatesSubtitle")}
        action={
          dirty ? (
            <Chip tone="warn" dot>
              {t("partner.com.unsaved")}
            </Chip>
          ) : (
            <Chip tone="up" dot>
              {t("partner.com.saved")}
            </Chip>
          )
        }
      />
      <div className="flex-1 space-y-6 px-4 pb-2 pt-5 sm:px-6">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-fg-2">
              {t("partner.com.rebateToClients")}
            </span>
            <span className="k-num text-[18px] font-semibold text-ember">
              {fmtPct(rebate)}
            </span>
          </div>
          <RangeSlider
            value={rebate}
            onChange={setRebate}
            min={0}
            max={p.maxRebatePct}
            ticks={ticks(p.maxRebatePct)}
            format={(v) => `${v}%`}
            label={t("partner.kind.rebate")}
          />
          <p className="mt-1.5 text-[11.5px] text-fg-3">
            {t("partner.com.rebateHint", { max: fmtPct(p.maxRebatePct) })}
          </p>
        </div>
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-fg-2">
              {t("partner.com.splitWithSubs")}
            </span>
            <span className="k-num text-[18px] font-semibold text-gold">
              {fmtPct(split)}
            </span>
          </div>
          <RangeSlider
            value={split}
            onChange={setSplit}
            min={0}
            max={p.maxSplitPct}
            tone="gold"
            ticks={ticks(p.maxSplitPct)}
            format={(v) => `${v}%`}
            label={t("partner.kind.split")}
          />
          <p className="mt-1.5 text-[11.5px] text-fg-3">
            {t("partner.com.splitHint", { max: fmtPct(p.maxSplitPct) })}
          </p>
        </div>

        {level && exOptions.length > 0 && (
          <div className="rounded-[16px] border border-line bg-surface-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12.5px] text-fg-2">
                <Trans
                  k="partner.com.example"
                  vars={{ lots, rate: fmtRate(rate) }}
                  tags={{
                    num: (ch) => <span className="k-num text-fg">{ch}</span>,
                  }}
                />
              </span>
              <Segmented
                size="xs"
                value={gk}
                onChange={setGk}
                options={exOptions.map((g) => ({
                  value: g.key,
                  label: SHORT[g.key]
                    ? t(SHORT[g.key]!)
                    : g.name.split(" ")[0]!,
                }))}
              />
            </div>
            <SplitRow
              title={t("partner.com.directTrades")}
              gross={gross1}
              parts={[
                {
                  label: t("partner.com.clientRebate"),
                  v: toClient,
                  cls: "bg-ember/70",
                },
                {
                  label: t("partner.com.youKeep"),
                  v: gross1 - toClient,
                  cls: "bg-up",
                },
              ]}
            />
            {t2 !== null && (
              <SplitRow
                title={t("partner.com.subTrades", { pct: fmtPct(t2) })}
                gross={gross2}
                parts={[
                  {
                    label: t("partner.network.subIb"),
                    v: toSub,
                    cls: "bg-gold",
                  },
                  {
                    label: t("partner.com.youKeep"),
                    v: gross2 - toSub,
                    cls: "bg-up",
                  },
                ]}
              />
            )}
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 px-4 pb-5 pt-3 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          disabled={!dirty || saving}
          onClick={() => {
            setRebate(base.rebate);
            setSplit(base.split);
          }}
        >
          <RotateCcw /> {t("common.reset")}
        </Button>
        <Button
          variant="ember"
          size="sm"
          disabled={!dirty || saving}
          onClick={save}
        >
          <Save /> {saving ? t("partner.com.saving") : t("common.save")}
        </Button>
      </div>
    </Card>
  );
}

function SplitRow({
  title,
  gross,
  parts,
}: {
  title: string;
  gross: number;
  parts: { label: string; v: number; cls: string }[];
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2 text-[12.5px]">
        <span className="min-w-0 truncate text-fg-3">{title}</span>
        <span className="k-num shrink-0 font-medium">{formatMoney(gross)}</span>
      </div>
      <div className="mt-2 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-3">
        {gross > 0 &&
          parts.map((p) => (
            <div
              key={p.label}
              className={cn(
                "h-full transition-[width] duration-300 first:rounded-s-full last:rounded-e-full",
                p.cls,
              )}
              style={{ width: `${(p.v / gross) * 100}%` }}
            />
          ))}
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[12px]">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", p.cls)} />
            <span className="text-fg-3">{p.label}</span>
            <span className="k-num font-medium">{formatMoney(p.v)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */


function TiersCard({ p, level }: { p: Programme; level: Level | null }) {
  const tt = useT();
  const exKey = level
    ? level.rates.metals !== undefined
      ? "metals"
      : Object.keys(level.rates)[0]
    : undefined;
  const exRate = exKey && level ? level.rates[exKey]! : null;
  const exName = p.symbolGroups.find((g) => g.key === exKey)?.name ?? exKey;
  return (
    <Card className="h-full">
      <CardHeader
        title={tt("partner.com.tiersTitle")}
        subtitle={tt("partner.com.tiersSubtitle")}
        icon={<Layers />}
      />
      <div className="space-y-2.5 px-4 pb-5 pt-4 sm:px-6">
        {p.tiers.map((t) => (
          <div key={t.tier} className="k-row px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] font-medium">
                <TierChip tier={t.tier} />
                {tt("partner.tierN", { n: t.tier })}
              </span>
              <span className="k-num text-[16px] font-semibold">
                {fmtPct(t.pct)}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div
                className={cn(
                  "h-full rounded-full",
                  t.tier === 1
                    ? "bg-ember"
                    : t.tier === 2
                      ? "bg-gold"
                      : "bg-up",
                )}
                style={{ width: `${Math.min(100, t.pct)}%` }}
              />
            </div>
            <div className="mt-1.5 text-[11.5px] text-fg-3">
              {t.tier >= 1 && t.tier <= 3
                ? tt.dyn(`partner.com.tierNote${t.tier}`)
                : tt("partner.levelsBelow", { n: t.tier - 1 })}
              {exRate !== null && (
                <>
                  {" "}
                  ·{" "}
                  <Trans
                    k="partner.com.pays"
                    vars={{
                      name: exName ?? "",
                      rate: fmtRate(+((exRate * t.pct) / 100).toFixed(2)),
                    }}
                    tags={{
                      num: (ch) => <span className="k-num text-fg-2">{ch}</span>,
                    }}
                  />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CpaCard({ p, level }: { p: Programme; level: Level | null }) {
  const t = useT();
  const levels = [...p.levels].sort(byRank);
  const mins = p.minTradeSeconds / 60;
  const amounts = Array.from(new Set(levels.map((l) => l.cpaAmount)));
  return (
    <Card className="h-full">
      <CardHeader
        title={t("partner.cpa.title")}
        subtitle={t("partner.cpa.subtitle")}
        action={
          p.cpa.enabled ? undefined : <Chip>{t("partner.cpa.notOffered")}</Chip>
        }
      />
      <div className="px-5 pt-4 sm:px-6">
        <div className="flex flex-wrap items-baseline gap-2">
          <Money
            value={level?.cpaAmount ?? 0}
            decimals={0}
            countUp={false}
            className="text-[32px] font-semibold"
          />
          <span className="text-[13px] text-fg-3">
            {t("partner.cpa.atLevel", {
              name: level?.name ?? t("partner.yourLevel"),
            })}
          </span>
        </div>
        {amounts.length > 1 && (
          <div className="mt-1 text-[12px] text-fg-3">
            {levels
              .filter(
                (l, i) => i === 0 || l.cpaAmount !== levels[i - 1]!.cpaAmount,
              )
              .map(
                (l) =>
                  t("partner.cpa.amountFrom", {
                    amount: formatMoney(l.cpaAmount, "USD", 0),
                    name: l.name,
                  }),
              )
              .join(" · ")}
          </div>
        )}
      </div>
      <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
        {[
          {
            icon: <Target />,
            t: t("partner.cpa.firstDeposit"),
            v: t("partner.cpa.orMore", {
              amount: formatMoney(p.cpa.minFirstDeposit, "USD", 0),
            }),
          },
          ...(p.cpa.requireFirstTrade
            ? [
                {
                  icon: <Timer />,
                  t: t("partner.cpa.firstTrade"),
                  v: t("partner.cpa.heldOrMore", {
                    duration:
                      mins >= 1
                        ? t("partner.unit.min", { n: +mins.toFixed(1) })
                        : t("partner.unit.sec", { n: p.minTradeSeconds }),
                  }),
                },
              ]
            : []),
          {
            icon: <Hourglass />,
            t: t("partner.cpa.holdPeriod"),
            v: t("partner.cpa.days", { count: p.cpa.holdDays }),
          },
        ].map((r) => (
          <div
            key={r.t}
            className={cn(
              "k-row flex items-center gap-3 px-3.5 py-2.5 text-[12.5px]",
              !p.cpa.enabled && "opacity-60",
            )}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gold-soft text-gold [&_svg]:size-3.5">
              {r.icon}
            </span>
            <span className="flex-1 text-fg-2">{r.t}</span>
            <span className="k-num text-end font-medium">{r.v}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RulesCard({ p }: { p: Programme }) {
  const t = useT();
  const mins = p.minTradeSeconds / 60;
  const rules = [
    {
      icon: <Timer />,
      title: t("partner.rules.minDuration"),
      text: t("partner.rules.minDurationText", {
        duration:
          mins >= 1
            ? t("partner.unit.minutes", { count: +mins.toFixed(1) })
            : t("partner.unit.seconds", { count: p.minTradeSeconds }),
      }),
    },
    {
      icon: <Ban />,
      title: t("partner.rules.liveOnly"),
      text: t("partner.rules.liveOnlyText"),
    },
    ...(p.excludedGroups.length
      ? [
          {
            icon: <Clock />,
            title: t("partner.rules.excluded"),
            text: t("partner.rules.excludedText", {
              groups: p.excludedGroups.join(", "),
            }),
          },
        ]
      : []),
    {
      icon: <UserX />,
      title: t("partner.rules.selfReferral"),
      text: t("partner.rules.selfReferralText"),
    },
    {
      icon: <InfinityIcon />,
      title: t("partner.rules.permanent"),
      text: t("partner.rules.permanentText"),
    },
  ];
  return (
    <Card className="h-full">
      <CardHeader
        title={t("partner.rules.title")}
        subtitle={t("partner.rules.subtitle")}
        icon={<ShieldAlert />}
      />
      <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
        {rules.map((r) => (
          <div
            key={r.title}
            className="k-row flex items-start gap-3 px-3.5 py-3"
          >
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 text-fg-2 [&_svg]:size-3.5">
              {r.icon}
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-medium">{r.title}</div>
              <div className="mt-0.5 text-[12px] leading-snug text-fg-3">
                {r.text}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

type StatusF = "all" | "pending" | "approved" | "paid" | "rejected" | "void";
type KindF =
  "all" | "lot" | "split" | "rebate" | "cpa" | "clawback" | "adjustment";
const LIMIT = 25;

function rateText(e: CommissionRow) {
  if (e.kind === "cpa") return tr("partner.com.rateFixed");
  if (e.kind === "split")
    return tr("partner.com.rateSplit", { pct: fmtPct(e.sharePct) });
  if (e.kind === "rebate")
    return tr("partner.com.rateRebate", { pct: fmtPct(e.sharePct) });
  if (e.kind === "lot")
    return `${fmtRate(e.rate)}${e.sharePct !== 100 ? ` × ${fmtPct(e.sharePct)}` : ""}`;
  return "—";
}

function LedgerCard() {
  const t = useT();
  const [status, setStatus] = React.useState<StatusF>("all");
  const [kind, setKind] = React.useState<KindF>("all");
  const [page, setPage] = React.useState(1);
  const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (status !== "all") q.set("status", status);
  if (kind !== "all") q.set("kind", kind);
  const path = `commissions?${q}`;
  const { data, error, reload } = usePartner<CommissionsResp>(path);
  const [shownPath, setShownPath] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (data) setShownPath(path);
  }, [data]);
  const stale = shownPath !== path;
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;
  const filtered = status !== "all" || kind !== "all";

  const columns: Column<CommissionRow>[] = [
    {
      key: "date",
      header: t("common.date"),
      cell: (e) => (
        <span className="block whitespace-nowrap">
          <span className="k-num text-[12.5px]">
            {fmtDateTime(e.createdAt)}
          </span>
          <span className="block font-mono text-[11px] text-fg-3">
            {e.dealId ? `#${e.dealId}` : `C-${e.id}`}
          </span>
        </span>
      ),
    },
    {
      key: "client",
      header: t("partner.client"),
      cell: (e) => (
        <PersonCell
          name={e.client.name}
          country={e.client.country}
          size={28}
          sub={
            e.source === "pamm"
              ? t("partner.com.viaPamm")
              : e.source === "copy"
                ? t("partner.com.viaCopy")
                : undefined
          }
        />
      ),
    },
    {
      key: "type",
      header: t("common.type"),
      cell: (e) =>
        e.symbol ? (
          <span className="flex items-center gap-2">
            <SymbolAvatar symbol={e.symbol} size={22} />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">{e.symbol}</span>
              <span className="block text-[11px] text-fg-3">
                {kindLabel(e.kind)}
              </span>
            </span>
          </span>
        ) : (
          <span className="block min-w-0">
            <span className="block text-[13px] font-medium">
              {kindLabel(e.kind)}
            </span>
            {e.note && (
              <span className="block max-w-[180px] truncate text-[11px] text-fg-3">
                {e.note}
              </span>
            )}
          </span>
        ),
    },
    {
      key: "lots",
      header: t("partner.lots"),
      align: "right",
      cell: (e) => (
        <span className="k-num">{e.lots ? fmtLots(e.lots) : "—"}</span>
      ),
    },
    {
      key: "tier",
      header: t("partner.tier"),
      align: "center",
      cell: (e) =>
        e.tier ? (
          <TierChip tier={e.tier} />
        ) : (
          <span className="text-fg-3">—</span>
        ),
      hideOn: "sm",
    },
    {
      key: "rate",
      header: t("partner.com.rate"),
      align: "right",
      cell: (e) => (
        <span className="k-num whitespace-nowrap text-fg-2">{rateText(e)}</span>
      ),
      hideOn: "md",
    },
    {
      key: "amount",
      header: t("common.amount"),
      align: "right",
      cell: (e) => (
        <span
          className={cn(
            "k-num whitespace-nowrap font-semibold",
            e.status === "rejected" || e.status === "void"
              ? "text-fg-3 line-through"
              : e.amount >= 0
                ? "text-up"
                : "text-down",
          )}
        >
          {e.amount >= 0 ? "+" : "-"}
          {formatMoney(Math.abs(e.amount))}
        </span>
      ),
    },
    {
      key: "status",
      header: t("common.status"),
      align: "right",
      cell: (e) => <CommissionStatusChip status={e.status} />,
    },
  ];

  return (
    <Card>
      <CardHeader
        title={t("partner.com.ledger")}
        subtitle={t("partner.com.ledgerSubtitle")}
        action={
          data ? (
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="warn">
                {t("partner.commissionStatus.pending")}{" "}
                {formatMoney(data.totals.pending ?? 0)}
              </Chip>
              <Chip tone="info">
                {t("partner.commissionStatus.approved")}{" "}
                {formatMoney(data.totals.approved ?? 0)}
              </Chip>
              <Chip tone="up">
                {t("partner.commissionStatus.paid")}{" "}
                {formatMoney(data.totals.paid ?? 0)}
              </Chip>
            </div>
          ) : undefined
        }
      />
      <div className="px-4 pb-5 pt-4 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="-mx-1 max-w-full overflow-x-auto px-1">
            <Segmented
              className="whitespace-nowrap"
              size="xs"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: t("common.all") },
                { value: "pending", label: t("partner.commissionStatus.pending") },
                {
                  value: "approved",
                  label: t("partner.commissionStatus.approved"),
                },
                { value: "paid", label: t("partner.commissionStatus.paid") },
                {
                  value: "rejected",
                  label: t("partner.commissionStatus.rejected"),
                },
                { value: "void", label: t("partner.commissionStatus.void") },
              ]}
            />
          </div>
          <div className="-mx-1 max-w-full overflow-x-auto px-1">
            <Segmented
              className="whitespace-nowrap"
              size="xs"
              value={kind}
              onChange={(v) => {
                setKind(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: t("partner.com.allTypes") },
                { value: "lot", label: t("partner.lots") },
                { value: "split", label: t("partner.com.splits") },
                { value: "rebate", label: t("partner.com.rebates") },
                { value: "cpa", label: "CPA" },
                { value: "clawback", label: t("partner.com.clawbacks") },
                { value: "adjustment", label: t("partner.com.adjustments") },
              ]}
            />
          </div>
        </div>
        {error && !data ? (
          <LoadProblem error={error} onRetry={reload} />
        ) : !data ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-[14px]" />
            ))}
          </div>
        ) : (
          <div className={cn("transition-opacity", stale && "opacity-60")}>
            <DataTable
              columns={columns}
              rows={data.items}
              pageSize={LIMIT}
              rowKey={(e) => String(e.id)}
              dense
              empty={
                <div className="py-6">
                  {filtered ? (
                    <CardEmpty
                      title={t("partner.com.noMatch")}
                      text={t("partner.com.noMatchText")}
                    />
                  ) : (
                    <CardEmpty
                      title={t("partner.noCommission")}
                      text={t("partner.com.ledgerEmptyText")}
                    />
                  )}
                </div>
              }
            />
            {data.total > 0 && (
              <div className="mt-4 flex items-center justify-between text-[12.5px] text-fg-3">
                <span className="k-num">
                  {t("partner.com.range", {
                    from: (data.page - 1) * LIMIT + 1,
                    to: Math.min(data.total, data.page * LIMIT),
                    total: data.total,
                  })}
                </span>
                {pages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <IconButton
                      size="sm"
                      disabled={page <= 1 || stale}
                      onClick={() => setPage((p) => p - 1)}
                      aria-label={t("partner.com.prevPage")}
                    >
                      <ChevronLeft className="rtl:-scale-x-100" />
                    </IconButton>
                    <span className="k-num px-2">
                      {page} / {pages}
                    </span>
                    <IconButton
                      size="sm"
                      disabled={page >= pages || stale}
                      onClick={() => setPage((p) => p + 1)}
                      aria-label={t("partner.com.nextPage")}
                    >
                      <ChevronRight className="rtl:-scale-x-100" />
                    </IconButton>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function LivePartnerCommissions() {
  const t = useT();
  const TITLE = t("partner.com.title");
  const SUBTITLE = t("partner.com.subtitle");
  const { data: d, error, reload, setData } = usePartner<Dashboard>("");

  if (!d)
    return (
      <PageFallback
        title={TITLE}
        subtitle={SUBTITLE}
        error={error}
        onRetry={reload}
        skeleton={
          <SkeletonGrid
            rows={[
              { cols: "xl:grid-cols-[7fr_5fr]", h: "h-[440px]", n: 2 },
              { cols: "lg:grid-cols-3", h: "h-[320px]", n: 3 },
            ]}
          />
        }
      />
    );

  const p = d.programme;
  const level = d.member.level;

  return (
    <div className="pb-24">
      <PageHeader title={TITLE} subtitle={SUBTITLE} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="min-w-0 xl:col-span-7">
          <RateCard p={p} levelKey={level?.key ?? null} />
        </Reveal>
        <Reveal delay={0.05} className="min-w-0 xl:col-span-5">
          <RebatesCard
            p={p}
            d={d}
            onSaved={(rebatePct, splitPct) =>
              setData({ ...d, member: { ...d.member, rebatePct, splitPct } })
            }
          />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Reveal delay={0.05} className="min-w-0">
          <TiersCard p={p} level={level} />
        </Reveal>
        <Reveal delay={0.1} className="min-w-0">
          <CpaCard p={p} level={level} />
        </Reveal>
        <Reveal delay={0.15} className="min-w-0">
          <RulesCard p={p} />
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4 block">
        <LedgerCard />
      </Reveal>
    </div>
  );
}
