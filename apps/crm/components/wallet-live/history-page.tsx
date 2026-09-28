"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Card, EmptyState, IconButton, PageHeader, Skeleton, Tabs } from "@kalks/ui";
import { useWallet, type ActivityItem, type Page } from "./api";
import { ActivityRow, WalletUnavailable } from "./ui";

type Kind = "all" | "deposit" | "withdrawal" | "transfer" | "other";
const PER = 25;

function Inner() {
  const sp = useSearchParams();
  const router = useRouter();
  const raw = sp.get("type");
  const kind: Kind = raw === "deposit" || raw === "withdrawal" || raw === "transfer" || raw === "other" ? raw : "all";
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const { data, error, loading, reload } = useWallet<Page<ActivityItem>>(`activity?type=${kind}&page=${page}&limit=${PER}`, 20000);
  const go = (k: Kind, p = 1) => router.replace(`/wallet/history?type=${k}${p > 1 ? `&page=${p}` : ""}`, { scroll: false });
  const pages = data ? Math.max(1, Math.ceil(data.total / PER)) : 1;
  return (
    <div className="pb-16">
      <PageHeader
        title="Wallet history"
        subtitle="Deposits, withdrawals, transfers and other credits, newest first."
        actions={
          <Link href="/wallet">
            <Button variant="surface">
              <ArrowLeft /> Wallet
            </Button>
          </Link>
        }
      />
      {error && !data ? (
        <WalletUnavailable onRetry={reload} />
      ) : (
        <Card>
          <div className="px-4 pt-4 sm:px-6">
            <Tabs
              value={kind}
              onChange={(v) => go(v)}
              tabs={[
                { value: "all", label: "All" },
                { value: "deposit", label: "Deposits" },
                { value: "withdrawal", label: "Withdrawals" },
                { value: "transfer", label: "Transfers" },
                { value: "other", label: "Other" },
              ]}
            />
          </div>
          <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
            {loading && <Skeleton className="h-40 w-full rounded-[14px]" />}
            {data && data.items.length === 0 && <EmptyState illustration="money_bag" title="Nothing here yet" text="Transactions of this type will appear here." />}
            {data?.items.map((a) => <ActivityRow key={`${a.type}${a.id}`} a={a} />)}
            {data && data.total > PER && (
              <div className="flex items-center justify-between pt-2 text-[12.5px] text-fg-3">
                <span className="k-num">
                  {(page - 1) * PER + 1}–{Math.min(data.total, page * PER)} of {data.total}
                </span>
                <div className="flex items-center gap-1.5">
                  <IconButton size="sm" disabled={page <= 1} onClick={() => go(kind, page - 1)} aria-label="Previous page">
                    <ChevronLeft />
                  </IconButton>
                  <span className="k-num px-2">
                    {page} / {pages}
                  </span>
                  <IconButton size="sm" disabled={page >= pages} onClick={() => go(kind, page + 1)} aria-label="Next page">
                    <ChevronRight />
                  </IconButton>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

export function LiveHistoryPage() {
  return (
    <React.Suspense fallback={null}>
      <Inner />
    </React.Suspense>
  );
}
