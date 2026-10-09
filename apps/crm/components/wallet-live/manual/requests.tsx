"use client";

// The client's bank / UPI / crypto deposit requests: status, amount, the credited USDT or the rejection reason, and
// cancel while a request still waits for review.

import * as React from "react";
import { Landmark, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, EmptyState, Skeleton, cn, formatDateTime, shortHash, type ChipTone } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";
import type { MessageKey } from "@ezymex/i18n";
import { fmt } from "../api";
import { InlineError } from "../ui";
import { cancelRequest, money, requestError, useManualRequests, usdt2, type ManualDeposit, type ManualStatus } from "./api";

export const MANUAL_STATUS: Record<ManualStatus, { tone: ChipTone; label: MessageKey }> = {
  pending: { tone: "warn", label: "payments.status.pending" },
  approved: { tone: "up", label: "payments.status.approved" },
  rejected: { tone: "down", label: "payments.status.rejected" },
  cancelled: { tone: "neutral", label: "payments.status.cancelled" },
};

const PER = 10;

function RequestRow({ d, onChanged }: { d: ManualDeposit; onChanged: () => void }) {
  const t = useT();
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const st = MANUAL_STATUS[d.status];
  const dim = d.status === "rejected" || d.status === "cancelled";
  const cancel = async () => {
    setBusy(true);
    setErr(null);
    try {
      await cancelRequest(d.id);
      toast.success(t("payments.list.cancelled"));
      onChanged();
    } catch (e) {
      setErr(requestError(e, t));
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };
  return (
    <div className="k-row px-4 py-3" data-testid={`manual-request-${d.id}`}>
      <div className="flex items-start gap-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-full border [&_svg]:size-4", dim ? "border-line bg-surface-3 text-fg-3" : "border-up/25 bg-up-soft text-up")}>{d.kind === "bank" ? <Landmark /> : <Wallet />}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-medium">
              <span className="truncate">{d.method.name}</span>
              <Chip size="sm" tone={st.tone} dot>
                {t(st.label)}
              </Chip>
            </div>
            <div className="shrink-0 text-end">
              <div dir="ltr" className={cn("k-num whitespace-nowrap text-[14px] font-semibold", dim && "text-fg-3 line-through")}>
                {money(d.amount, d.currency)}
              </div>
              <div dir="ltr" className={cn("k-num whitespace-nowrap text-[11.5px]", d.status === "approved" ? "text-up" : "text-fg-3")}>
                {d.status === "approved" && d.credit_amount ? t("payments.list.credited", { amount: fmt(d.credit_amount, 2) }) : t("payments.list.expected", { amount: usdt2(d.expected_credit) })}
              </div>
            </div>
          </div>
          <div className="mt-0.5 text-[11.5px] text-fg-3">
            {formatDateTime(d.created_at)} · <span dir="ltr" className="break-all">{t("payments.list.ref", { ref: d.reference.length > 24 ? shortHash(d.reference, 10, 8) : d.reference })}</span>
          </div>
          {d.status === "rejected" && d.reason && <div className="mt-1 text-[12px] text-down">{t("payments.list.reason", { reason: d.reason })}</div>}
        </div>
      </div>
      {d.status === "pending" && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          {confirm ? (
            <>
              <span className="text-[12px] text-fg-2">{t("payments.list.cancelConfirm")}</span>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)} disabled={busy}>
                {t("payments.list.cancelNo")}
              </Button>
              <Button size="sm" variant="down-outline" onClick={cancel} disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} {t("payments.list.cancelYes")}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
              {t("payments.list.cancel")}
            </Button>
          )}
        </div>
      )}
      {err && (
        <div className="mt-2">
          <InlineError>{err}</InlineError>
        </div>
      )}
    </div>
  );
}

export function RequestsList({ reloadKey, id }: { reloadKey?: number; id?: string }) {
  const t = useT();
  const [limit, setLimit] = React.useState(PER);
  const { data, error, reload } = useManualRequests(limit);
  React.useEffect(() => {
    if (reloadKey) reload();
  }, [reloadKey, reload]);
  return (
    <Card id={id}>
      <CardHeader
        title={t("payments.list.title")}
        subtitle={t("payments.list.subtitle")}
        action={data && data.pending > 0 ? <span className="text-[12px] text-fg-3">{t("payments.list.pendingCount", { count: data.pending, max: data.max_pending })}</span> : undefined}
      />
      <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6" data-testid="manual-requests">
        {!data && !error && <Skeleton className="h-28 w-full rounded-[14px]" />}
        {error && !data && <InlineError>{error.message}</InlineError>}
        {data && data.items.length === 0 && <EmptyState art="emptyHistory" title={t("payments.list.empty")} text={t("payments.list.emptyText")} />}
        {data?.items.map((d) => <RequestRow key={d.id} d={d} onChanged={reload} />)}
        {data && data.total > data.items.length && (
          <div className="flex justify-center pt-1">
            <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PER)}>
              {t("payments.list.more")}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
