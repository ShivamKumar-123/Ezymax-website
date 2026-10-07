"use client";

// A10: side-by-side comparison of 2–3 masters from the leaderboard (each column from GET masters/{id}).

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, X as XIcon } from "lucide-react";
import { Chip, Dialog, Skeleton, cn } from "@/components/kit";
import { useFormat, useT } from "@kalks/i18n/react";
import { PERIOD_LABEL, compactUsd, formatAge, pct, socialApi, usd, type MasterProfile, type MasterView } from "./api";
import { MasterIdentity, RiskBadge } from "./bits";

export const COMPARE_MAX = 3;

type Col = { m: MasterView; minAllocation: number; loading: boolean; failed: boolean };
type Row = { key: string; label: string; value: (c: Col) => number | null; render: (c: Col) => React.ReactNode; better?: "high" | "low" };

export function CompareDialog({ masters, open, onOpenChange, onRemove }: { masters: MasterView[]; open: boolean; onOpenChange: (o: boolean) => void; onRemove: (id: number) => void }) {
  const t = useT();
  const f = useFormat();
  const [profiles, setProfiles] = React.useState<Record<number, MasterProfile | "error">>({});
  const ids = masters.map((m) => m.id).join(",");

  React.useEffect(() => {
    if (!open) return;
    let stop = false;
    for (const m of masters) {
      socialApi<MasterProfile>(`masters/${m.id}`).then(
        (p) => !stop && setProfiles((x) => ({ ...x, [m.id]: p })),
        () => !stop && setProfiles((x) => ({ ...x, [m.id]: "error" })),
      );
    }
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ids]);

  const cols: Col[] = masters.map((m) => {
    const p = profiles[m.id];
    const pm = p && p !== "error" ? p.master : m;
    return { m: pm, minAllocation: p && p !== "error" ? p.terms.minAllocation : m.minAllocationEffective ?? m.minAllocation, loading: p === undefined, failed: p === "error" };
  });

  const ret = (v: number) => <span className={cn("k-num font-semibold", v > 0 ? "text-up" : v < 0 ? "text-down" : "text-fg-2")}>{pct(v, 1)}</span>;
  const rows: Row[] = [
    { key: "r1m", label: t("social.lb.col.return", { period: t("social.lb.period.1m") }), value: (c) => c.m.stats.return1m, render: (c) => ret(c.m.stats.return1m), better: "high" },
    { key: "r3m", label: t("social.lb.col.return", { period: t("social.lb.period.3m") }), value: (c) => c.m.stats.return3m, render: (c) => ret(c.m.stats.return3m), better: "high" },
    { key: "r1y", label: t("social.lb.col.return", { period: t("social.lb.period.1y") }), value: (c) => c.m.stats.return1y, render: (c) => ret(c.m.stats.return1y), better: "high" },
    { key: "rall", label: t("social.returnAll"), value: (c) => c.m.stats.returnAll, render: (c) => ret(c.m.stats.returnAll), better: "high" },
    { key: "dd", label: t("social.maxDd"), value: (c) => c.m.stats.maxDd, render: (c) => <span className={cn("k-num", c.m.stats.maxDd > 0 ? "text-down" : "text-fg-2")}>{c.m.stats.maxDd > 0 ? `-${c.m.stats.maxDd.toFixed(1)}%` : "0.0%"}</span>, better: "low" },
    { key: "risk", label: t("social.risk"), value: (c) => c.m.stats.riskScore, render: (c) => <RiskBadge risk={c.m.stats.riskScore} showLabel />, better: "low" },
    { key: "fol", label: t("social.followers"), value: (c) => c.m.stats.followers, render: (c) => <span className="k-num">{f.number(c.m.stats.followers, 0)}</span>, better: "high" },
    { key: "aum", label: t("social.aum"), value: (c) => c.m.stats.aum, render: (c) => <span className="k-num">{compactUsd(c.m.stats.aum)}</span>, better: "high" },
    { key: "fee", label: t("social.performanceFee"), value: (c) => c.m.perfFeePct, render: (c) => <span className="k-num">{c.m.perfFeePct}% · {(PERIOD_LABEL[c.m.feePeriod] ?? c.m.feePeriod).toLowerCase()}</span>, better: "low" },
    { key: "min", label: t("social.profile.minAllocation"), value: (c) => c.minAllocation, render: (c) => <span className="k-num">{usd(c.minAllocation, 0)}</span>, better: "low" },
    { key: "tr", label: t("social.profile.closedTrades"), value: (c) => c.m.stats.trades, render: (c) => <span className="k-num">{f.number(c.m.stats.trades, 0)}</span> },
    { key: "wr", label: t("social.profile.winRate"), value: (c) => (c.m.stats.trades ? c.m.stats.winRate : null), render: (c) => <span className="k-num">{c.m.stats.trades ? `${c.m.stats.winRate.toFixed(1)}%` : "—"}</span>, better: "high" },
    { key: "age", label: t("social.lb.col.age"), value: (c) => c.m.ageDays, render: (c) => <span className="k-num">{formatAge(c.m.ageDays)}</span>, better: "high" },
    {
      key: "open",
      label: t("social.compare.accepting"),
      value: () => null,
      render: (c) => (c.m.acceptingNew === false ? <Chip size="sm" tone="warn">{t("common.no")}</Chip> : <Chip size="sm" tone="up">{t("common.yes")}</Chip>),
    },
  ];

  const best = (r: Row): number | null => {
    if (!r.better || cols.length < 2) return null;
    const vals = cols.map((c) => r.value(c));
    const nums = vals.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (nums.length < 2) return null;
    const target = r.better === "high" ? Math.max(...nums) : Math.min(...nums);
    // no highlight when every column is equal
    if (nums.every((v) => v === target)) return null;
    return vals.findIndex((v) => v === target);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} width={880} title={t("social.compare.title")} description={t("social.compare.description")}>
      {cols.length < 2 ? (
        <p className="py-6 text-center text-[13px] text-fg-3">{t("social.compare.pickTwo")}</p>
      ) : (
        <div className="overflow-x-auto" data-testid="copy-compare-table">
          <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th className="w-[170px]" />
                {cols.map((c) => (
                  <th key={c.m.id} className="px-3 pb-3 text-start align-top font-normal">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/social/masters/${c.m.id}`} className="min-w-0 hover:opacity-90" onClick={() => onOpenChange(false)}>
                        <MasterIdentity nickname={c.m.nickname} size={34} sub={c.m.strategy} />
                      </Link>
                      <button type="button" aria-label={t("social.compare.remove", { name: c.m.nickname })} onClick={() => onRemove(c.m.id)} className="grid size-6 shrink-0 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg">
                        <XIcon className="size-3.5" />
                      </button>
                    </div>
                    <Link href={`/social/masters/${c.m.id}`} className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-ember hover:underline" onClick={() => onOpenChange(false)}>
                      {t("social.compare.profile")} <ArrowUpRight className="size-3 rtl:-scale-x-100" />
                    </Link>
                    {c.failed && <div className="mt-1 text-[11px] text-fg-3">{t("social.compare.partial")}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const b = best(r);
                return (
                  <tr key={r.key}>
                    <td className="border-t border-line py-2.5 pe-3 text-[12px] text-fg-3">{r.label}</td>
                    {cols.map((c, i) => (
                      <td key={c.m.id} className="border-t border-line px-3 py-2">
                        {c.loading && r.key === "min" && c.m.minAllocationEffective === undefined ? (
                          <Skeleton className="h-4 w-16" />
                        ) : (
                          <span className={cn("inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5", b === i && "bg-gold-soft ring-1 ring-gold/30")}>{r.render(c)}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-[11.5px] text-fg-3">{t("social.compare.note")}</p>
        </div>
      )}
    </Dialog>
  );
}
