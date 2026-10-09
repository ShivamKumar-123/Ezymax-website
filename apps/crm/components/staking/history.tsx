"use client";

// /staking/history: subscriptions, monthly returns and principal returned, newest first, paged by the service.

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, CircleX, Undo2 } from "lucide-react";
import { Button, Card, EmptyState, PageHeader, Reveal, Skeleton, cn } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";
import { useStaking, type HistoryDoc, type HistoryItem, type HistoryKind } from "./api";
import { LoadError, useStakingFormat } from "./ui";

const PER = 25;

const KIND: Record<HistoryKind, { icon: React.ReactNode; tone: string; sign: "+" | "-" | "" }> = {
  subscribe: { icon: <ArrowUpRight />, tone: "text-fg-2", sign: "-" },
  reward: { icon: <ArrowDownLeft />, tone: "text-up", sign: "+" },
  principal: { icon: <Undo2 />, tone: "text-up", sign: "+" },
  payment_failed: { icon: <CircleX />, tone: "text-down", sign: "" },
};

function Row({ item }: { item: HistoryItem }) {
  const t = useT();
  const fx = useStakingFormat();
  const k = KIND[item.kind] ?? KIND.subscribe;
  const detail =
    item.kind === "reward" && item.period
      ? t("staking.history.rewardDetail", { month: fx.month(item.period), rate: fx.rate(item.ratePct), days: t("staking.history.days", { count: item.days ?? 0 }) })
      : `#${item.positionId}`;
  return (
    <div className="k-row flex items-center gap-3 px-3.5 py-3">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 [&_svg]:size-4", k.tone)}>{k.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium">
          {t.dyn(`staking.history.kind.${item.kind}`, item.kind)} <span className="hidden text-fg-2 sm:inline">· {item.planName}</span>
        </div>
        <div className="truncate text-[11.5px] text-fg-3">
          <span className="sm:hidden">{item.planName} · </span>
          {fx.dateTime(item.at)} · {detail}
        </div>
      </div>
      <span className={cn("k-num shrink-0 text-[14px] font-semibold", item.kind === "payment_failed" ? "text-fg-3 line-through" : k.tone)}>
        {k.sign}
        {fx.amount(item.amount, item.currency)}
      </span>
    </div>
  );
}

export function StakingHistory() {
  const t = useT();
  const [page, setPage] = React.useState(1);
  const { data, error, loading, reload } = useStaking<HistoryDoc>(`history?page=${page}&limit=${PER}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / PER)) : 1;

  return (
    <div className="pb-16">
      <PageHeader title={t("staking.history.title")} subtitle={t("staking.history.subtitle")} />
      {error && !data ? (
        <LoadError error={error} onRetry={reload} />
      ) : (
        <Reveal>
          <Card className="p-4 sm:p-6">
            {!data ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : data.items.length === 0 ? (
              <EmptyState art="emptyHistory" title={t("staking.history.empty")} />
            ) : (
              <div className={cn("space-y-2", loading && "opacity-60")}>
                {data.items.map((it, i) => (
                  <Row key={`${it.kind}-${it.positionId}-${it.period ?? ""}-${i}`} item={it} />
                ))}
              </div>
            )}
            {data && pages > 1 && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <Button size="sm" variant="surface" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  {t("staking.history.prev")}
                </Button>
                <span className="text-[12px] text-fg-3">{t("staking.history.page", { page, pages })}</span>
                <Button size="sm" variant="surface" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  {t("staking.history.next")}
                </Button>
              </div>
            )}
          </Card>
        </Reveal>
      )}
    </div>
  );
}
