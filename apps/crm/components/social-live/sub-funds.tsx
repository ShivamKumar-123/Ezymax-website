"use client";

// A6: add funds from the wallet to a copy account, or withdraw its free margin to the wallet, while following.

import * as React from "react";
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, Loader2, Repeat, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, Field, Input, Segmented, cn } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";
import { ToggleChip } from "@/components/social/controls";
import { fmt as fmtUsdt, usdtAvailable, useWallet, type Overview } from "@/components/wallet-live/api";
import { socialApi, usd, validAmount, type SubFundsResult, type SubscriptionView } from "./api";
import { InfoBox, useNumber } from "./bits";

export type FundsDirection = "add" | "withdraw";

/** Free margin that can go back to the wallet now (the engine's `withdrawable`; the balance when it isn't known). */
export const withdrawableOf = (s: SubscriptionView) => Math.max(0, s.withdrawable ?? s.balance ?? 0);

function End({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: React.ReactNode }) {
  return (
    <div className="k-row flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-fg-2 [&_svg]:size-4">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-medium text-fg">{title}</span>
        <span className="block truncate text-[11.5px] text-fg-3">{sub}</span>
      </span>
    </div>
  );
}

export function SubFundsDialog({ sub, direction, onClose, onDone }: { sub: SubscriptionView | null; direction: FundsDirection; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [dir, setDir] = React.useState<FundsDirection>(direction);
  const amount = useNumber(null);
  const [busy, setBusy] = React.useState(false);
  const stopped = sub?.status === "stopped";
  const wallet = useWallet<Overview>(sub && dir === "add" ? "overview" : null);

  React.useEffect(() => {
    if (!sub) return;
    setDir(stopped ? "withdraw" : direction);
    amount.set(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub?.id, direction]);

  if (!sub) return null;
  const add = dir === "add";
  const v = amount.value;
  const walletAvail = wallet.data ? Number(usdtAvailable(wallet.data).available) : null;
  const canWithdraw = withdrawableOf(sub);
  const err = !amount.raw
    ? undefined
    : !validAmount(v)
      ? t("social.subs.funds.err.amount")
      : add && walletAvail !== null && v! > walletAvail
        ? t("social.follow.err.overBalance", { balance: fmtUsdt(walletAvail) })
        : !add && v! > canWithdraw + 1e-9
          ? t("social.subs.funds.err.overWithdrawable", { amount: usd(canWithdraw) })
          : undefined;
  const ready = !!amount.raw && !err && validAmount(v);

  const submit = async () => {
    if (!ready) return toast.error(err ?? t("social.subs.funds.err.amount"));
    setBusy(true);
    try {
      const r = await socialApi<SubFundsResult>(`subscriptions/${sub.id}/funds`, { body: { direction: dir, amount: Math.round(v! * 100) / 100 } });
      const moved = usd(r.amount ?? v!);
      const bal = r.balance !== null && r.balance !== undefined ? t("social.subs.funds.toast.balance", { amount: usd(r.balance) }) : "";
      toast.success(add ? t("social.subs.funds.toast.added") : t("social.subs.funds.toast.withdrawn"), {
        description: `${add ? t("social.subs.funds.toast.addedDesc", { amount: moved, login: sub.login }) : t("social.subs.funds.toast.withdrawnDesc", { amount: moved, login: sub.login })}${bal ? ` ${bal}` : ""}`,
      });
      onDone();
      onClose();
    } catch (e) {
      toast.error(add ? t("social.subs.funds.toast.addFailed") : t("social.subs.funds.toast.withdrawFailed"), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const walletEnd = <End icon={<Wallet />} title={t("social.subs.funds.wallet")} sub={walletAvail !== null && add ? t("social.follow.walletAvailable", { balance: fmtUsdt(walletAvail) }) : "USDT"} />;
  const accountEnd = <End icon={<Repeat />} title={t("social.subs.funds.copyAccount", { login: sub.login })} sub={t("social.subs.funds.balanceLine", { amount: usd(sub.balance ?? sub.equity) })} />;

  return (
    <Dialog
      open={!!sub}
      onOpenChange={(o) => !o && onClose()}
      width={520}
      title={add ? t("social.subs.funds.addTitle") : t("social.subs.funds.withdrawTitle")}
      description={t("social.subs.nameAccount", { name: sub.master.nickname, login: sub.login })}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="ember" onClick={submit} disabled={busy || !ready} data-testid="copy-funds-confirm">
            {busy ? <Loader2 className="animate-spin" /> : add ? <ArrowDownToLine /> : <ArrowUpFromLine />} {add ? t("social.subs.funds.add") : t("social.subs.funds.withdraw")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!stopped && (
          <Segmented
            size="sm"
            value={dir}
            onChange={(d) => {
              setDir(d);
              amount.set(null);
            }}
            options={[
              { value: "add", label: t("social.subs.funds.add") },
              { value: "withdraw", label: t("social.subs.funds.withdraw") },
            ]}
          />
        )}
        <div className="flex items-center gap-2" aria-label={add ? t("social.subs.funds.flowAdd") : t("social.subs.funds.flowWithdraw")}>
          {add ? walletEnd : accountEnd}
          <ArrowRight className="size-4 shrink-0 text-ember rtl:-scale-x-100" />
          {add ? accountEnd : walletEnd}
        </div>
        <Field
          label={t("social.subs.funds.amount")}
          hint={
            add ? undefined : (
              <span className="inline-flex items-center gap-1.5">
                {t("social.subs.funds.available", { amount: usd(canWithdraw) })}
                <button type="button" className="font-medium text-ember hover:underline disabled:opacity-40" disabled={canWithdraw <= 0} onClick={() => amount.set(Math.floor(canWithdraw * 100) / 100)}>
                  {t("social.subs.funds.max")}
                </button>
              </span>
            )
          }
          error={err}
        >
          <Input type="number" inputMode="decimal" min={0.01} step={0.01} value={amount.raw} onChange={(e) => amount.setRaw(e.target.value)} leading="$" trailing="USD" inputClassName="k-num text-[16px] font-medium" autoFocus />
        </Field>
        {add && walletAvail !== null && walletAvail > 0 && (
          <div className="flex flex-wrap gap-2">
            {[100, 500, 1000, 2500].filter((x) => x <= walletAvail).map((x) => (
              <ToggleChip key={x} on={v === x} onClick={() => amount.set(x)}>
                {usd(x, 0)}
              </ToggleChip>
            ))}
          </div>
        )}
        {add ? (
          <InfoBox tone="gold">
            {t("social.subs.funds.addNote")}
            {sub.sizing.mode === "equity" ? ` ${t("social.subs.funds.addEquityNote")}` : ""}
          </InfoBox>
        ) : (
          <>
            {canWithdraw <= 0 && <InfoBox tone="warn">{t("social.subs.funds.nothing")}</InfoBox>}
            <InfoBox>
              {t("social.subs.funds.withdrawNote")}
              {sub.positions + sub.orders > 0 ? ` ${t("social.subs.funds.openNote")}` : ""}
              {sub.equityStop !== null && !stopped ? ` ${t("social.subs.funds.equityStopNote", { amount: usd(sub.equityStop, 0) })}` : ""}
            </InfoBox>
          </>
        )}
        <p className={cn("text-[12px] text-fg-3")}>{t("social.subs.funds.hwmNote")}</p>
      </div>
    </Dialog>
  );
}
