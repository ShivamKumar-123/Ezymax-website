"use client";

// Account extras (B9, B10): default account star, self-service account type change, money between own live
// accounts, demo balance of your choice, and the account health card.
//
//   POST /api/trading/prefs                          {defaultLogin}
//   GET  /api/trading/accounts/{login}/group-options -> {groups: [{code, name, minDeposit, allowed, blocker}]}
//   POST /api/trading/accounts/{login}/group         {group}
//   POST /api/trading/accounts/{login}/demo-balance  {amount}
//   GET  /api/trading/accounts/{login}/health        -> {score, items: [{key, status, value}]}
//   POST /api/trading/transfers/between              {fromLogin, toLogin, amount, idempotency_key, stepup_token}
//                                                     (emailed code, step-up action internal_transfer, target = fromLogin)

import * as React from "react";
import { ArrowRight, Check, HeartPulse, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Dialog, Field, Input, Skeleton, cn } from "@/components/kit";
import { useT } from "@kalks/i18n/react";
import { StepUpDialog } from "@/components/stepup";
import { curOf, errorToast, isArchived, toUsd, tradingApi, usePoll, useAccounts, type EngineAccount } from "./api";
import { isPropAccount } from "./ui";

/* ------------------------------------------------------------------ */
/* Default account (star)                                              */
/* ------------------------------------------------------------------ */

export async function setDefaultAccount(login: number | null) {
  return tradingApi<{ ok: boolean; defaultLogin: number | null }>("prefs", { body: { defaultLogin: login } });
}

export function DefaultStar({ a, className }: { a: Pick<EngineAccount, "isDefault">; className?: string }) {
  const t = useT();
  if (!a.isDefault) return null;
  return (
    <Chip size="sm" tone="gold" className={cn("gap-1", className)}>
      <Star className="size-3 fill-current" /> {t("accounts.default.badge")}
    </Chip>
  );
}

/* ------------------------------------------------------------------ */
/* Change account type (group)                                         */
/* ------------------------------------------------------------------ */

type GroupOption = { code: string; name: string; mode: string; cent: boolean; minDeposit: number; leverages: number[]; commissionPerLot: number; swapFree: boolean; allowed: boolean; blocker: { code: string; message: string } | null };

export function ChangeTypeDialog({ a, open, onOpenChange, onDone }: { a: EngineAccount; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const t = useT();
  const [opts, setOpts] = React.useState<GroupOption[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [pick, setPick] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    let stop = false;
    setOpts(null);
    setErr(null);
    setPick("");
    tradingApi<{ groups: GroupOption[] }>(`accounts/${a.login}/group-options`)
      .then((r) => !stop && setOpts(r.groups))
      .catch((e) => !stop && setErr(e instanceof Error && e.message ? e.message : ""));
    return () => {
      stop = true;
    };
  }, [open, a.login]);
  const chosen = opts?.find((g) => g.code === pick);
  const save = async () => {
    setBusy(true);
    try {
      await tradingApi(`accounts/${a.login}/group`, { body: { group: pick } });
      toast.success(t("accounts.type.changed"), { description: t("accounts.type.changedDesc", { login: a.login, name: chosen?.name ?? pick }) });
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      errorToast(t("accounts.type.failed"), e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("accounts.type.title", { login: a.login })}
      description={t("accounts.type.subtitle")}
      width={520}
      footer={
        <>
          <Button variant="surface" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="ember" disabled={!chosen?.allowed || busy} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} {t("accounts.type.confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {!opts && err === null && <Skeleton className="h-[120px] w-full rounded-[14px]" />}
        {err !== null && <p className="text-[13px] text-down">{err || t("common.errorRetry")}</p>}
        {opts && opts.length === 0 && <p className="text-[13px] text-fg-3">{t("accounts.type.none")}</p>}
        {opts?.map((g) => (
          <button
            key={g.code}
            type="button"
            disabled={!g.allowed}
            onClick={() => setPick(g.code)}
            className={cn(
              "flex w-full items-start justify-between gap-3 rounded-[14px] border px-4 py-3 text-start transition-colors",
              pick === g.code ? "border-ember/50 bg-ember-soft" : "border-line hover:border-[var(--k-border-top)]",
              !g.allowed && "cursor-not-allowed opacity-60",
            )}
          >
            <div className="min-w-0">
              <div className="text-[14px] font-medium text-fg">
                {g.name} <span className="text-fg-3">· {t.dyn(`accounts.mode.${g.mode}`, g.mode)}</span>
              </div>
              <div className="mt-0.5 text-[12px] text-fg-3">
                {t("accounts.type.facts", { min: g.minDeposit.toLocaleString("en-US"), commission: g.commissionPerLot.toLocaleString("en-US") })}
              </div>
              {g.blocker && <div className="mt-1 text-[12px] text-warn">{t.dyn(`accounts.type.blocker.${g.blocker.code}`, g.blocker.message)}</div>}
            </div>
            {pick === g.code && <Check className="mt-0.5 size-4 shrink-0 text-ember" />}
          </button>
        ))}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Demo balance of your choice                                          */
/* ------------------------------------------------------------------ */

const DEMO_PRESETS = [1000, 5000, 10000, 50000, 100000];

export function DemoBalanceDialog({ a, open, onOpenChange, onDone }: { a: EngineAccount; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const t = useT();
  const [amount, setAmount] = React.useState("10000");
  const [busy, setBusy] = React.useState(false);
  const n = Number(amount);
  const ok = Number.isFinite(n) && n >= 100 && n <= 1_000_000;
  const flat = a.positions === 0 && a.orders === 0;
  const save = async () => {
    setBusy(true);
    try {
      await tradingApi(`accounts/${a.login}/demo-balance`, { body: { amount: n } });
      toast.success(t("accounts.demoBalance.done"), { description: `#${a.login} · $${n.toLocaleString("en-US")}` });
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      errorToast(t("accounts.demoBalance.failed"), e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("accounts.demoBalance.title", { login: a.login })}
      description={t("accounts.demoBalance.subtitle")}
      width={440}
      footer={
        <>
          <Button variant="surface" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="ember" disabled={!ok || !flat || busy} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} {t("accounts.demoBalance.confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {DEMO_PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => setAmount(String(p))}>
              <Chip size="sm" tone={n === p ? "ember" : "neutral"}>
                ${p.toLocaleString("en-US")}
              </Chip>
            </button>
          ))}
        </div>
        <Field label={t("accounts.demoBalance.label")} hint={t("accounts.demoBalance.range")}>
          <Input inputMode="decimal" value={amount} leading="$" onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
        </Field>
        {!flat && <p className="text-[12.5px] text-warn">{t("accounts.demoBalance.closeFirst")}</p>}
        <p className="text-[12px] text-fg-3">{t("accounts.demoBalance.note")}</p>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Move money between own live accounts                                 */
/* ------------------------------------------------------------------ */

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : `${Date.now()}${Math.random().toString(36).slice(2)}`).slice(0, 32);

export function TransferBetweenDialog({ from, open, onOpenChange, onDone }: { from?: EngineAccount | null; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const t = useT();
  const { data } = useAccounts(0);
  const live = (data?.accounts ?? []).filter((x) => x.type === "live" && !isPropAccount(x) && !isArchived(x));
  const [src, setSrc] = React.useState<number | null>(from?.login ?? null);
  const [dst, setDst] = React.useState<number | null>(null);
  const [amount, setAmount] = React.useState("");
  const [stepUp, setStepUp] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const key = React.useRef(newKey());
  React.useEffect(() => {
    if (open) {
      setSrc(from?.login ?? null);
      setDst(null);
      setAmount("");
      key.current = newKey();
    }
  }, [open, from?.login]);
  const s = live.find((x) => x.login === src);
  const avail = s ? toUsd(s, s.withdrawable) : 0;
  const n = Number(amount);
  const ok = !!s && !!dst && dst !== src && Number.isFinite(n) && n > 0 && n <= avail + 1e-9 && /^\d+(\.\d{1,2})?$/.test(amount);
  const run = async (token: string) => {
    setBusy(true);
    try {
      const r = await tradingApi<{ status: string; error?: { message: string } }>("transfers/between", { body: { fromLogin: src, toLogin: dst, amount, idempotency_key: key.current, stepup_token: token } });
      if (r.status === "completed") toast.success(t("accounts.between.done"), { description: t("accounts.between.doneDesc", { amount: `$${n.toFixed(2)}`, from: src ?? "", to: dst ?? "" }) });
      else if (r.status === "in_wallet") toast.warning(t("accounts.between.inWallet"), { description: r.error?.message });
      else toast.message(t("accounts.between.processing"));
      key.current = newKey();
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      errorToast(t("accounts.between.failed"), e);
    } finally {
      setBusy(false);
    }
  };
  const select = "h-11 w-full rounded-[14px] border border-line bg-surface-2 px-3 text-[14px] text-fg outline-none focus:border-ember/50";
  return (
    <>
      <Dialog
        open={open && !stepUp}
        onOpenChange={onOpenChange}
        title={t("accounts.between.title")}
        description={t("accounts.between.subtitle")}
        width={480}
        footer={
          <>
            <Button variant="surface" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="ember" disabled={!ok || busy} onClick={() => setStepUp(true)}>
              {busy && <Loader2 className="animate-spin" />} {t("accounts.between.confirm")}
            </Button>
          </>
        }
      >
        {live.length < 2 ? (
          <p className="text-[13px] text-fg-3">{t("accounts.between.needTwo")}</p>
        ) : (
          <div className="space-y-3">
            <Field label={t("accounts.between.from")}>
              <select className={select} value={src ?? ""} onChange={(e) => setSrc(Number(e.target.value) || null)}>
                <option value="">{t("accounts.between.choose")}</option>
                {live.map((x) => (
                  <option key={x.login} value={x.login}>
                    #{x.login} · {x.groupName} · {curOf(x)}
                    {x.withdrawable.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex justify-center text-fg-3">
              <ArrowRight className="size-4 rotate-90" />
            </div>
            <Field label={t("accounts.between.to")}>
              <select className={select} value={dst ?? ""} onChange={(e) => setDst(Number(e.target.value) || null)}>
                <option value="">{t("accounts.between.choose")}</option>
                {live
                  .filter((x) => x.login !== src)
                  .map((x) => (
                    <option key={x.login} value={x.login}>
                      #{x.login} · {x.groupName}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={t("accounts.between.amount")} hint={s ? t("accounts.between.available", { amount: `$${avail.toFixed(2)}` }) : undefined}>
              <Input inputMode="decimal" value={amount} leading="$" onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} trailing={s ? <button type="button" className="text-[12px] font-medium text-ember" onClick={() => setAmount((Math.floor(avail * 100) / 100).toFixed(2))}>{t("accounts.between.max")}</button> : undefined} />
            </Field>
            <p className="text-[12px] text-fg-3">{t("accounts.between.note")}</p>
          </div>
        )}
      </Dialog>
      {stepUp && src && (
        <StepUpDialog
          open={stepUp}
          onOpenChange={setStepUp}
          action="internal_transfer"
          target={String(src)}
          title={t("accounts.between.stepUpTitle")}
          description={`#${src} → #${dst}`}
          what={t("accounts.between.stepUpWhat", { from: src, to: dst ?? "" })}
          confirmLabel={t("accounts.between.confirm")}
          onConfirmed={(token) => run(token)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Health card                                                          */
/* ------------------------------------------------------------------ */

type HealthItem = { key: "margin_level" | "stop_loss" | "margin_use" | "floating" | "results_30d"; status: "good" | "warn" | "bad"; value: Record<string, number | null> };
type Health = { login: number; score: number; items: HealthItem[]; lastTradeAt: string | null };

const TONE = { good: "up", warn: "warn", bad: "down" } as const;

export function HealthCard({ a }: { a: EngineAccount }) {
  const t = useT();
  const h = usePoll<Health>(`accounts/${a.login}/health`, 30000);
  const d = h.data;
  const scoreTone = !d ? "neutral" : d.score >= 75 ? "up" : d.score >= 45 ? "warn" : "down";
  const detail = (i: HealthItem) => {
    const v = i.value;
    switch (i.key) {
      case "margin_level":
        return v.level == null ? t("accounts.health.noMargin") : t("accounts.health.marginLevelValue", { level: Math.round(v.level), call: v.marginCall ?? 0 });
      case "stop_loss":
        return (v.positions ?? 0) === 0 ? t("accounts.health.noPositions") : t("accounts.health.stopLossValue", { with: v.withSl ?? 0, total: v.positions ?? 0 });
      case "margin_use":
        return t("accounts.health.pct", { pct: (v.pct ?? 0).toFixed(1) });
      case "floating":
        return t("accounts.health.floatingValue", { pct: (v.pctOfBalance ?? 0).toFixed(1) });
      case "results_30d":
        return (v.trades ?? 0) === 0 ? t("accounts.health.noTrades") : t("accounts.health.resultsValue", { trades: v.trades ?? 0, rate: v.winRate ?? 0 });
    }
  };
  return (
    <Card>
      <CardHeader
        title={t("accounts.health.title")}
        subtitle={t("accounts.health.subtitle")}
        action={
          d ? (
            <Chip tone={scoreTone} className="k-num gap-1">
              <HeartPulse className="size-3.5" /> {d.score}/100
            </Chip>
          ) : undefined
        }
      />
      <div className="space-y-2 px-4 pb-5 pt-3 sm:px-6">
        {!d && <Skeleton className="h-[150px] w-full rounded-[14px]" />}
        {d?.items.map((i) => (
          <div key={i.key} className="flex items-center justify-between gap-3 rounded-[12px] border border-line px-3.5 py-2.5">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-fg">{t(`accounts.health.${i.key}`)}</div>
              <div className="mt-0.5 text-[12px] text-fg-3">{detail(i)}</div>
            </div>
            <Chip size="sm" tone={TONE[i.status]}>
              {t(`accounts.health.status.${i.status}`)}
            </Chip>
          </div>
        ))}
      </div>
    </Card>
  );
}
