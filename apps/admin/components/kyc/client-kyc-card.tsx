"use client";

import Link from "next/link";
import { ArrowUpRight, IdCard } from "lucide-react";
import { Card, CardHeader, Skeleton } from "@ezymex/ui";
import { useCan } from "@/components/staff-session";
import { KycChip, Mono, ago, useApi, useNow, when } from "@/components/live/kit";
import type { QueuePage } from "./types";
import { CaseStatusChip } from "./ui";

/** Client profile: KYC status and every verification case of this client (needs kyc.read for the history). */
export function ClientKycCard({ userId, kycStatus }: { userId: number; kycStatus: string }) {
  const can = useCan("kyc.read");
  const now = useNow();
  const { data, error } = useApi<QueuePage>(can ? `/api/admin/kyc/cases?user=${userId}&per_page=20` : null);
  return (
    <Card>
      <CardHeader title="Identity verification" icon={<IdCard />} action={<KycChip status={kycStatus} />} />
      <div className="px-4 pb-5 pt-3 sm:px-6">
        {!can ? (
          <p className="text-[12.5px] text-fg-3">KYC documents are visible to compliance roles.</p>
        ) : error ? (
          <p className="text-[12.5px] text-fg-3">{error.message}</p>
        ) : !data ? (
          <Skeleton className="h-16 w-full" />
        ) : data.items.length === 0 ? (
          <p className="text-[12.5px] text-fg-3">This client hasn&apos;t started verification yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-[14px] border border-line">
            {data.items.map((c) => (
              <li key={c.id}>
                <Link href={`/clients/kyc/${c.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-surface-2">
                  <span className="min-w-0">
                    <Mono className="text-fg-2">{c.reference}</Mono>
                    <span className="block text-[11.5px] text-fg-3" title={when(c.decided_at ?? c.submitted_at ?? c.created_at)}>
                      {c.kind === "corporate" ? "Corporate" : "Individual"} · {c.decided_at ? `decided ${ago(c.decided_at, now)}` : c.submitted_at ? `submitted ${ago(c.submitted_at, now)}` : `started ${ago(c.created_at, now)}`}
                      {c.decision?.label ? ` · ${c.decision.label}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <CaseStatusChip status={c.status} />
                    <ArrowUpRight className="size-3.5 text-fg-3" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
