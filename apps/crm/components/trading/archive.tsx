"use client";

// Archive (shown to clients as "Delete account"), restore and rename for trading accounts, plus the
// Archived tab row and the COPY / PAMM / MAM chips.
//
//   GET   /api/trading/accounts/{login}/archive-check  -> what deleting would take (trades, money, blockers)
//   POST  /api/trading/accounts/{login}/archive        {empty, ackForfeit, stepup_token?}: live needs the emailed
//                                                       code (step-up action account_archive, target = login)
//   POST  /api/trading/accounts/{login}/restore
//   PATCH /api/trading/accounts/{login}                {name}

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDownToLine, Check, CircleSlash, Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, CopyButton, Dialog, Field, Input, Money, cn } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";
import { useReadOnly } from "@/components/session";
import { StepUpDialog } from "@/components/stepup";
import { curOf, errorToast, fmtDate, tradingApi, type EngineAccount } from "./api";
import { KindBadge, ProductBadge, StatusBadge, isPropAccount } from "./ui";

/* ------------------------------------------------------------------ */
/* COPY / PAMM / MAM (by engine group code)                             */
/* ------------------------------------------------------------------ */

export type AccountFlavor = "copy" | "pamm" | "mam";

export function accountFlavor(a: Pick<EngineAccount, "group">): AccountFlavor | null {
  const g = a.group.toLowerCase();
  const is = (code: string) => g === code || g.startsWith(`${code}-`);
  if (is("copy")) return "copy";
  if (is("pamm")) return "pamm";
  if (is("mam")) return "mam";
  return null;
}

/** "Copy · Atlas FX" -> "Atlas FX" (the copy service names the follower account after the strategy). */
export function copyingName(a: Pick<EngineAccount, "name">): string | null {
  const m = /^\s*copy\s*[·:\-–]\s*(.+)$/i.exec(a.name ?? "");
  return m ? m[1]!.trim() : null;
}

export function FlavorChip({ a }: { a: Pick<EngineAccount, "group"> }) {
  const t = useT();
  const f = accountFlavor(a);
  if (!f) return null;
  return (
    <Chip tone={f === "copy" ? "info" : "neutral"} size="sm" className="font-semibold tracking-wider">
      {t(`accounts.badge.${f}`)}
    </Chip>
  );
}

/* ------------------------------------------------------------------ */
/* Rename                                                               */
/* ------------------------------------------------------------------ */

export function RenameDialog({ a, open, onOpenChange, onDone }: { a: Pick<EngineAccount, "login" | "name">; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const t = useT();
  const [name, setName] = React.useState(a.name ?? "");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) setName(a.name ?? "");
  }, [open, a.name]);
  const tooLong = [...name.trim()].length > 32;
  const save = async () => {
    setBusy(true);
    try {
      await tradingApi(`accounts/${a.login}`, { method: "PATCH", body: { name: name.trim() } });
      toast.success(t("accounts.rename.saved"), { description: `#${a.login}${name.trim() ? ` · ${name.trim()}` : ""}` });
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      errorToast(t("accounts.rename.failed"), e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("accounts.rename.title", { login: a.login })}
      width={440}
      footer={
        <>
          <Button variant="surface" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="ember" disabled={busy || tooLong || name.trim() === (a.name ?? "").trim()} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} {t("accounts.rename.save")}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && !tooLong) void save();
        }}
      >
        <Field label={t("accounts.rename.label")} hint={<span className={cn("k-num", tooLong && "text-down")}>{[...name.trim()].length}/32</span>}>
          <Input value={name} maxLength={64} autoFocus onChange={(e) => setName(e.target.value)} />
        </Field>
        <p className="mt-2 text-[12.5px] text-fg-3">{t("accounts.rename.hint")}</p>
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Delete (archive)                                                     */
/* ------------------------------------------------------------------ */

type ArchiveCheck = {
  login: number;
  kind: "live" | "demo";
  status: string;
  positions: number;
  orders: number;
  balance: number;
  credit: number;
  bonus: number;
  canArchive: boolean;
  needsEmpty: boolean;
  blockers: { code: string; message: string }[];
};
type ArchiveStep = { step: "close_positions" | "return_balance" | "archive" | string; ok: boolean; detail?: string };
type ArchiveResult = { ok: boolean; status?: string; steps?: ArchiveStep[] };

export function DeleteAccountDialog({ a, open, onOpenChange, onDone }: { a: EngineAccount; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const t = useT();
  const cur = curOf(a);
  const [check, setCheck] = React.useState<ArchiveCheck | null>(null);
  const [checkErr, setCheckErr] = React.useState<string | null>(null);
  const [ack, setAck] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [stepUp, setStepUp] = React.useState(false);
  const [result, setResult] = React.useState<ArchiveResult | null>(null);
  const changed = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    let stop = false;
    setCheck(null);
    setCheckErr(null);
    setAck(false);
    setResult(null);
    changed.current = false;
    tradingApi<ArchiveCheck>(`accounts/${a.login}/archive-check`)
      .then((c) => !stop && setCheck(c))
      .catch((e) => !stop && setCheckErr(e instanceof Error && e.message ? e.message : ""));
    return () => {
      stop = true;
    };
  }, [open, a.login]);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o && changed.current) onDone?.();
  };

  const demo = (check?.kind ?? a.type) === "demo";
  const trades = (check?.positions ?? 0) + (check?.orders ?? 0);
  const forfeit = (check?.credit ?? 0) + (check?.bonus ?? 0);
  const blocked = !!check && (check.blockers.length > 0 || !check.canArchive);
  const needsEmpty = !!check?.needsEmpty;
  const money = (v: number) => `${cur}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const run = async (token?: string) => {
    setBusy(true);
    try {
      const r = await tradingApi<ArchiveResult>(`accounts/${a.login}/archive`, { body: { empty: needsEmpty, ackForfeit: forfeit > 0 && ack, ...(token ? { stepup_token: token } : {}) } });
      setResult(r);
      changed.current = true;
      if (r.ok) toast.success(t("accounts.delete.done"), { description: t("accounts.delete.doneDesc", { login: a.login }) });
      else toast.error(t("accounts.delete.partial"));
    } catch (e) {
      errorToast(t("accounts.delete.failed"), e);
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => (demo ? void run() : setStepUp(true));
  const canConfirm = !!check && !blocked && !busy && !result && (forfeit <= 0 || ack);

  return (
    <>
      <Dialog
        open={open && !stepUp}
        onOpenChange={close}
        title={t("accounts.delete.title", { login: a.login })}
        description={t("accounts.delete.subtitle")}
        width={500}
        footer={
          result ? (
            <Button variant="surface" onClick={() => close(false)}>
              {t("common.close")}
            </Button>
          ) : (
            <>
              <Button variant="surface" onClick={() => close(false)}>
                {t("common.cancel")}
              </Button>
              {!blocked && (
                <Button variant="sell" disabled={!canConfirm} onClick={confirm}>
                  {busy && <Loader2 className="animate-spin" />} {needsEmpty ? t("accounts.delete.confirmAll") : t("accounts.delete.confirm")}
                </Button>
              )}
            </>
          )
        }
      >
        <div className="space-y-3 text-[13.5px]">
          {!check && checkErr === null && (
            <div className="flex items-center gap-2 text-fg-3">
              <Loader2 className="size-4 animate-spin" /> {t("accounts.delete.checking")}
            </div>
          )}
          {checkErr !== null && (
            <div className="rounded-[14px] border border-down/25 bg-down-soft px-4 py-3 text-down">
              <div className="font-medium">{t("accounts.delete.checkFailed")}</div>
              <div className="mt-0.5 text-[12.5px] text-fg-2">{checkErr || t("common.errorRetry")}</div>
            </div>
          )}

          {check && blocked && (
            <div className="rounded-[14px] border border-warn/25 bg-warn-soft px-4 py-3">
              <div className="flex items-center gap-2 font-medium text-warn">
                <CircleSlash className="size-4" /> {t("accounts.delete.blocked")}
              </div>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-[12.5px] text-fg-2">
                {check.blockers.map((b) => (
                  <li key={b.code}>{t.dyn(`accounts.blocker.${b.code}`, b.message)}</li>
                ))}
              </ul>
            </div>
          )}

          {check && !blocked && !result && (
            <>
              {needsEmpty ? (
                <div className="k-row p-4">
                  <div className="text-[12px] font-medium uppercase tracking-wider text-fg-3">{t("accounts.delete.stepsTitle")}</div>
                  <ol className="mt-3 space-y-2">
                    {trades > 0 && <StepLine n={1}>{t("accounts.delete.stepClose", { count: trades })}</StepLine>}
                    {!demo && check.balance > 0 && <StepLine n={trades > 0 ? 2 : 1}>{t("accounts.delete.stepMove", { amount: money(check.balance) })}</StepLine>}
                    <StepLine n={(trades > 0 ? 1 : 0) + (!demo && check.balance > 0 ? 1 : 0) + 1}>{t("accounts.delete.stepArchive")}</StepLine>
                  </ol>
                </div>
              ) : (
                <p className="text-fg-2">{t("accounts.delete.ready")}</p>
              )}
              {demo && <p className="text-[12.5px] text-fg-3">{t("accounts.delete.demoNote")}</p>}
              {forfeit > 0 && (
                <div className="rounded-[14px] border border-warn/25 bg-warn-soft px-4 py-3">
                  <div className="flex items-center gap-2 font-medium text-warn">
                    <AlertTriangle className="size-4" /> {t("accounts.delete.forfeitTitle")}
                  </div>
                  <p className="mt-1 text-[12.5px] text-fg-2">{t("accounts.delete.forfeitText", { amount: money(forfeit) })}</p>
                  <label className="mt-2.5 flex cursor-pointer items-start gap-2.5 text-[12.5px] text-fg">
                    <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-ember,currentColor)]" />
                    {t("accounts.delete.forfeitAck")}
                  </label>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="k-row p-4">
              <div className={cn("font-medium", result.ok ? "text-up" : "text-warn")}>{result.ok ? t("accounts.delete.done") : t("accounts.delete.partial")}</div>
              <ul className="mt-3 space-y-2">
                {(result.steps ?? []).map((s) => (
                  <li key={s.step} className="flex items-start gap-2.5 text-[13px]">
                    <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border", s.ok ? "border-up/40 bg-up-soft text-up" : "border-down/40 bg-down-soft text-down")}>
                      {s.ok ? <Check className="size-3" /> : <X className="size-3" />}
                    </span>
                    <div className="min-w-0">
                      <div className="text-fg">
                        {t.dyn(`accounts.delete.step.${s.step}`, s.step)} <span className="text-fg-3">· {s.ok ? t("accounts.delete.stepOk") : t("accounts.delete.stepFailed")}</span>
                      </div>
                      {s.detail && <div className="mt-0.5 text-[12px] text-fg-3">{s.detail}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Dialog>
      {stepUp && (
        <StepUpDialog
          open={stepUp}
          onOpenChange={setStepUp}
          action="account_archive"
          target={String(a.login)}
          title={t("accounts.delete.stepUpTitle")}
          description={`#${a.login}`}
          what={t("accounts.delete.stepUpWhat", { login: a.login })}
          confirmLabel={needsEmpty ? t("accounts.delete.confirmAll") : t("accounts.delete.confirm")}
          onConfirmed={(token) => run(token)}
        />
      )}
    </>
  );
}

function StepLine({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 text-[13px] text-fg">
      <span className="k-num grid size-5 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-[11px] text-fg-2">{n}</span>
      {children}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Archived tab                                                         */
/* ------------------------------------------------------------------ */

export function RestoreButton({ a, onDone }: { a: Pick<EngineAccount, "login">; onDone?: () => void }) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="surface"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await tradingApi(`accounts/${a.login}/restore`, { body: {} });
          toast.success(t("accounts.archived.restored"), { description: t("accounts.archived.restoredDesc", { login: a.login }) });
          onDone?.();
        } catch (e) {
          errorToast(t("accounts.archived.restoreFailed"), e);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />} {t("accounts.archived.restore")}
    </Button>
  );
}

export function ArchivedAccountRow({ a, onChanged }: { a: EngineAccount; onChanged?: () => void }) {
  const t = useT();
  const readOnly = useReadOnly();
  const cur = curOf(a);
  const when = a.archivedAt ?? a.closedAt ?? a.updatedAt ?? null;
  return (
    <div className="k-row p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <KindBadge type={a.type} prop={isPropAccount(a)} />
        <ProductBadge a={a} />
        <FlavorChip a={a} />
        <Link href={`/accounts/${a.login}`} className="text-[15px] font-medium text-fg-2 hover:text-ember">
          {a.groupName}
        </Link>
        <span className="inline-flex items-center gap-1 font-mono text-[13px] text-fg-3">
          #{a.login}
          <CopyButton value={String(a.login)} label={t("accounts.label.login")} />
        </span>
        {a.name && <span className="truncate text-[13px] text-fg-3">“{a.name}”</span>}
        <StatusBadge a={a} />
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <div className="text-[12px] text-fg-3">{t("accounts.archived.finalBalance")}</div>
            <Money value={a.balance} currency={cur} countUp={false} className="mt-1 block text-[17px] font-semibold text-fg-2" />
          </div>
          {when && <div className="text-[12.5px] text-fg-3">{t(a.status === "closed" ? "accounts.archived.closedOn" : "accounts.archived.on", { date: fmtDate(when) })}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/accounts/${a.login}?tab=history`}>
            <Button size="sm" variant="ghost">
              <ArrowDownToLine /> {t("accounts.archived.statements")}
            </Button>
          </Link>
          <a href={`/api/trading/accounts/${a.login}/history-zip`} download>
            <Button size="sm" variant="ghost">
              <ArrowDownToLine /> {t("accounts.history.zip")}
            </Button>
          </a>
          {!readOnly && a.status === "archived" && <RestoreButton a={a} onDone={onChanged} />}
        </div>
      </div>
    </div>
  );
}
