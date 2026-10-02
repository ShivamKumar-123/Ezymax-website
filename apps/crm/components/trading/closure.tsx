"use client";

// Close permanently (B12) with the exit survey (C11), and the closure request banner (pending / rejected / approved).
//
//   GET  /api/trading/accounts/{login}/closure          -> {canRequest, needsEmpty, blockers[], surveyReasons[], request}
//   POST /api/trading/accounts/{login}/closure          {reasonCode, survey: {reasons[], comment}, empty, ackForfeit,
//                                                        stepup_token}: emailed code, step-up action account_close
//   POST /api/trading/accounts/{login}/closure/cancel   withdraw the pending request
//
// Closing is final for the client (only the broker can reopen), so the dialog explains the difference with
// "Delete (archive)" and the request goes to the broker's compliance team, who confirm by email and in the bell.

import * as React from "react";
import { AlertTriangle, Check, CircleSlash, Clock, Loader2, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, Dialog, cn } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { StepUpDialog } from "@/components/stepup";
import { curOf, errorToast, fmtDate, tradingApi, type EngineAccount } from "./api";

type ClosureRequest = { id: number; status: "pending" | "approved" | "rejected" | "cancelled"; reasonCode: string; createdAt: string; decidedAt: string | null; message: string | null; source: string };
type ClosureStatus = {
  login: number;
  kind: "live" | "demo";
  status: string;
  positions: number;
  orders: number;
  balance: number;
  credit: number;
  bonus: number;
  needsEmpty: boolean;
  canRequest: boolean;
  blockers: { code: string; message: string }[];
  surveyReasons: string[];
  request: ClosureRequest | null;
};
type Step = { step: string; ok: boolean; detail?: string };
type ClosureResult = { ok: boolean; steps?: Step[]; request?: ClosureRequest | null };

const REASONS = ["costs", "platform", "performance", "other_broker", "stop_trading", "too_many_accounts", "service", "other"] as const;

export function CloseAccountDialog({ a, open, onOpenChange, onDone }: { a: EngineAccount; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const t = useT();
  const cur = curOf(a);
  const [st, setSt] = React.useState<ClosureStatus | null>(null);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState<string>("");
  const [more, setMore] = React.useState<string[]>([]);
  const [comment, setComment] = React.useState("");
  const [ack, setAck] = React.useState(false);
  const [understood, setUnderstood] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [stepUp, setStepUp] = React.useState(false);
  const [result, setResult] = React.useState<ClosureResult | null>(null);
  const changed = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    let stop = false;
    setSt(null);
    setLoadErr(null);
    setReason("");
    setMore([]);
    setComment("");
    setAck(false);
    setUnderstood(false);
    setResult(null);
    changed.current = false;
    tradingApi<ClosureStatus>(`accounts/${a.login}/closure`)
      .then((s) => !stop && setSt(s))
      .catch((e) => !stop && setLoadErr(e instanceof Error && e.message ? e.message : ""));
    return () => {
      stop = true;
    };
  }, [open, a.login]);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o && changed.current) onDone?.();
  };

  const forfeit = (st?.credit ?? 0) + (st?.bonus ?? 0);
  const trades = (st?.positions ?? 0) + (st?.orders ?? 0);
  const blocked = !!st && st.blockers.length > 0;
  const pending = st?.request?.status === "pending";
  const money = (v: number) => `${cur}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const canSend = !!st && !blocked && !pending && st.canRequest && !!reason && understood && (forfeit <= 0 || ack) && !busy && !result;

  const run = async (token: string) => {
    setBusy(true);
    try {
      const r = await tradingApi<ClosureResult>(`accounts/${a.login}/closure`, {
        body: { reasonCode: reason, survey: { reasons: [reason, ...more.filter((x) => x !== reason)], comment: comment.trim() }, empty: !!st?.needsEmpty, ackForfeit: forfeit > 0 && ack, stepup_token: token },
      });
      setResult(r);
      changed.current = true;
      if (r.ok) toast.success(t("accounts.close.sent"), { description: t("accounts.close.sentDesc", { login: a.login }) });
      else toast.error(t("accounts.delete.partial"));
    } catch (e) {
      errorToast(t("accounts.close.failed"), e);
    } finally {
      setBusy(false);
    }
  };

  const toggleMore = (r: string) => setMore((m) => (m.includes(r) ? m.filter((x) => x !== r) : [...m, r]));

  return (
    <>
      <Dialog
        open={open && !stepUp}
        onOpenChange={close}
        title={t("accounts.close.title", { login: a.login })}
        description={t("accounts.close.subtitle")}
        width={540}
        footer={
          result || pending || blocked ? (
            <Button variant="surface" onClick={() => close(false)}>
              {t("common.close")}
            </Button>
          ) : (
            <>
              <Button variant="surface" onClick={() => close(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="sell" disabled={!canSend} onClick={() => setStepUp(true)}>
                {busy && <Loader2 className="animate-spin" />} {st?.needsEmpty ? t("accounts.close.confirmAll") : t("accounts.close.confirm")}
              </Button>
            </>
          )
        }
      >
        <div className="space-y-4 text-[13.5px]">
          {!st && loadErr === null && (
            <div className="flex items-center gap-2 text-fg-3">
              <Loader2 className="size-4 animate-spin" /> {t("accounts.delete.checking")}
            </div>
          )}
          {loadErr !== null && (
            <div className="rounded-[14px] border border-down/25 bg-down-soft px-4 py-3 text-down">
              <div className="font-medium">{t("accounts.delete.checkFailed")}</div>
              <div className="mt-0.5 text-[12.5px] text-fg-2">{loadErr || t("common.errorRetry")}</div>
            </div>
          )}

          {st && blocked && (
            <div className="rounded-[14px] border border-warn/25 bg-warn-soft px-4 py-3">
              <div className="flex items-center gap-2 font-medium text-warn">
                <CircleSlash className="size-4" /> {t("accounts.close.blocked")}
              </div>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-[12.5px] text-fg-2">
                {st.blockers.map((b) => (
                  <li key={b.code}>{t.dyn(`accounts.blocker.${b.code}`, b.message)}</li>
                ))}
              </ul>
            </div>
          )}

          {st && pending && !result && <ClosureNotice r={st.request!} login={a.login} onChanged={() => (changed.current = true)} />}

          {st && !blocked && !pending && !result && (
            <>
              <div className="rounded-[14px] border border-line bg-surface-2 px-4 py-3">
                <div className="flex items-center gap-2 font-medium text-fg">
                  <Lock className="size-4 text-fg-3" /> {t("accounts.close.finalTitle")}
                </div>
                <ul className="mt-2 list-disc space-y-1 ps-5 text-[12.5px] text-fg-2">
                  <li>{t("accounts.close.final1")}</li>
                  <li>{t("accounts.close.final2")}</li>
                  <li>{t("accounts.close.final3")}</li>
                </ul>
              </div>

              <div>
                <div className="text-[12px] font-medium uppercase tracking-wider text-fg-3">{t("accounts.close.whyTitle")}</div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={cn(
                        "rounded-[12px] border px-3 py-2 text-start text-[13px] transition-colors",
                        reason === r ? "border-ember/50 bg-ember-soft text-fg" : "border-line text-fg-2 hover:border-[var(--k-border-top)] hover:text-fg",
                      )}
                    >
                      {t(`accounts.close.reason.${r}`)}
                    </button>
                  ))}
                </div>
                {reason && (
                  <div className="mt-3">
                    <div className="text-[12px] text-fg-3">{t("accounts.close.alsoTitle")}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {REASONS.filter((r) => r !== reason && r !== "other").map((r) => (
                        <button key={r} type="button" onClick={() => toggleMore(r)}>
                          <Chip size="sm" tone={more.includes(r) ? "ember" : "neutral"}>
                            {t(`accounts.close.reason.${r}`)}
                          </Chip>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <label className="mt-3 block">
                  <span className="text-[12px] text-fg-3">{t("accounts.close.commentLabel")}</span>
                  <textarea
                    value={comment}
                    maxLength={1000}
                    rows={3}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t("accounts.close.commentPlaceholder")}
                    className="mt-1.5 w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 text-[13.5px] text-fg outline-none placeholder:text-fg-3 focus:border-ember/50"
                  />
                </label>
              </div>

              {st.needsEmpty && (
                <div className="k-row p-4">
                  <div className="text-[12px] font-medium uppercase tracking-wider text-fg-3">{t("accounts.delete.stepsTitle")}</div>
                  <ol className="mt-3 space-y-2">
                    {trades > 0 && <StepLine n={1}>{t("accounts.delete.stepClose", { count: trades })}</StepLine>}
                    {st.balance > 0 && <StepLine n={trades > 0 ? 2 : 1}>{t("accounts.delete.stepMove", { amount: money(st.balance) })}</StepLine>}
                    <StepLine n={(trades > 0 ? 1 : 0) + (st.balance > 0 ? 1 : 0) + 1}>{t("accounts.close.stepRequest")}</StepLine>
                  </ol>
                </div>
              )}

              {forfeit > 0 && (
                <div className="rounded-[14px] border border-warn/25 bg-warn-soft px-4 py-3">
                  <div className="flex items-center gap-2 font-medium text-warn">
                    <AlertTriangle className="size-4" /> {t("accounts.delete.forfeitTitle")}
                  </div>
                  <p className="mt-1 text-[12.5px] text-fg-2">{t("accounts.close.forfeitText", { amount: money(forfeit) })}</p>
                  <label className="mt-2.5 flex cursor-pointer items-start gap-2.5 text-[12.5px] text-fg">
                    <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-ember,currentColor)]" />
                    {t("accounts.delete.forfeitAck")}
                  </label>
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] text-fg">
                <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-ember,currentColor)]" />
                {t("accounts.close.understand")}
              </label>
            </>
          )}

          {result && (
            <div className="k-row p-4">
              <div className={cn("font-medium", result.ok ? "text-up" : "text-warn")}>{result.ok ? t("accounts.close.sent") : t("accounts.delete.partial")}</div>
              {result.ok && <p className="mt-1 text-[12.5px] text-fg-2">{t("accounts.close.sentDesc", { login: a.login })}</p>}
              {(result.steps ?? []).length > 0 && (
                <ul className="mt-3 space-y-2">
                  {(result.steps ?? []).map((s) => (
                    <li key={s.step} className="flex items-start gap-2.5 text-[13px]">
                      <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border", s.ok ? "border-up/40 bg-up-soft text-up" : "border-down/40 bg-down-soft text-down")}>
                        {s.ok ? <Check className="size-3" /> : <X className="size-3" />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-fg">{t.dyn(`accounts.delete.step.${s.step}`, s.step)}</div>
                        {s.detail && <div className="mt-0.5 text-[12px] text-fg-3">{s.detail}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Dialog>
      {stepUp && (
        <StepUpDialog
          open={stepUp}
          onOpenChange={setStepUp}
          action="account_close"
          target={String(a.login)}
          title={t("accounts.close.stepUpTitle")}
          description={`#${a.login}`}
          what={t("accounts.close.stepUpWhat", { login: a.login })}
          confirmLabel={t("accounts.close.confirm")}
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

/** The latest closure request of an account: pending (with Cancel), rejected (with the broker's reason) or closed. */
export function ClosureNotice({ r, login, onChanged }: { r: ClosureRequest; login: number; onChanged?: () => void }) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const [gone, setGone] = React.useState(false);
  if (gone || r.status === "cancelled") return null;
  const tone = r.status === "pending" ? "border-info/25 bg-info-soft" : r.status === "rejected" ? "border-warn/25 bg-warn-soft" : "border-line bg-surface-2";
  const cancel = async () => {
    setBusy(true);
    try {
      await tradingApi(`accounts/${login}/closure/cancel`, { body: {} });
      toast.success(t("accounts.close.cancelled"));
      setGone(true);
      onChanged?.();
    } catch (e) {
      errorToast(t("accounts.close.cancelFailed"), e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={cn("rounded-[14px] border px-4 py-3", tone)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium text-fg">
          <Clock className="size-4 text-fg-3" />
          {r.status === "pending" ? t("accounts.close.pendingTitle") : r.status === "rejected" ? t("accounts.close.rejectedTitle") : t("accounts.close.approvedTitle")}
        </div>
        <span className="text-[12px] text-fg-3">{fmtDate(r.decidedAt ?? r.createdAt)}</span>
      </div>
      <p className="mt-1 text-[12.5px] text-fg-2">{r.status === "pending" ? t("accounts.close.pendingText") : (r.message ?? "")}</p>
      {r.status === "pending" && r.source === "client" && (
        <Button size="sm" variant="surface" className="mt-2.5" disabled={busy} onClick={() => void cancel()}>
          {busy && <Loader2 className="animate-spin" />} {t("accounts.close.cancelRequest")}
        </Button>
      )}
    </div>
  );
}

/** Account detail: the closure request banner, loaded on demand (only when the list says there is one). */
export function ClosureBanner({ a, onChanged }: { a: EngineAccount; onChanged?: () => void }) {
  const [st, setSt] = React.useState<ClosureStatus | null>(null);
  const status = a.closureRequest?.status;
  React.useEffect(() => {
    if (!status || status === "cancelled") return;
    let stop = false;
    tradingApi<ClosureStatus>(`accounts/${a.login}/closure`)
      .then((s) => !stop && setSt(s))
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [a.login, status]);
  const stale = st?.request?.status === "rejected" && Date.now() - new Date(st.request.decidedAt ?? st.request.createdAt).getTime() > 30 * 86_400_000;
  if (!st?.request || stale || st.request.status === "cancelled" || (st.request.status === "approved" && a.status !== "closed")) return null;
  return (
    <div className="mt-4">
      <ClosureNotice r={st.request} login={a.login} onChanged={onChanged} />
    </div>
  );
}
