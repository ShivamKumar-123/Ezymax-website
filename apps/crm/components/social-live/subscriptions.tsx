"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Archive, ArrowDownToLine, ArrowUpFromLine, Ban, Check, Compass, FileText, HelpCircle, Layers, ListChecks, Loader2, OctagonAlert, Pause, Play, Repeat, Settings2, ShieldAlert, ShieldCheck, Sliders, Square, Target, Wallet, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  CopyButton,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  Input,
  KpiCard,
  Money,
  PageHeader,
  Segmented,
  StatusChip,
  
  
  Toggle,
  cn,
  type Column,
} from "@/components/kit";
// engine symbols include Kalks FX Options series codes, which @kalks/ui SymbolAvatar / SymbolCell (static list) throw on
import { TradeSymbolAvatar as SymbolAvatar, TradeSymbolCell as SymbolCell } from "@/components/trading/instrument";
import { Trans, useT } from "@kalks/i18n/react";
import { Checkbox, RadioCard, RangeSlider, ToggleChip } from "@/components/social/controls";
import { STEPUP_CODES, StepUpDialog } from "@/components/stepup";
import { ApiError as TradingApiError, tradingApi } from "@/components/trading/api";
import { TradeButton } from "@/components/trading/ui";
import { fmtDate, fmtPrice, serverTime, type EngineOrder, type EnginePosition } from "@/components/trading/api";
import {
  PERIOD_LABEL,
  SIZING_LABEL,
  pct,
  pips1,
  sizingText,
  socialApi,
  usd,
  useSocial,
  type FeeView,
  type SizingMode,
  type StopResult,
  type SubscriptionDetail,
  type SubscriptionView,
} from "./api";
import { BlockSkeleton, HouseBadge, InfoBox, MasterIdentity, RiskBadge, SocialError, Tile, useNumber } from "./bits";
import { AnnouncementList, ExecutionPanel } from "./execution";
import { SubFundsDialog, withdrawableOf, type FundsDirection } from "./sub-funds";

type Log = SubscriptionDetail["log"][number];

// Stop reasons are translated at render: social.subs.stopReason.<reason>
const stopReason = (r: string | null, t: ReturnType<typeof useT>) => (r ? t.dyn(`social.subs.stopReason.${r}`, r.replace(/_/g, " ")) : null);

export const FEE_STATUS_TONE: Record<FeeView["status"], "warn" | "info" | "up" | "down" | "neutral"> = { pending: "warn", approved: "info", paid: "up", rejected: "neutral", failed: "down" };

export function FeesTable({ fees, empty }: { fees: FeeView[]; empty?: string }) {
  const t = useT();
  const cols: Column<FeeView>[] = [
    { key: "p", header: t("social.fees.col.period"), cell: (f) => <span className="whitespace-nowrap text-fg-2">{fmtDate(f.periodStart)} – {fmtDate(f.periodEnd)}</span>, sort: (f) => f.periodEnd },
    { key: "hwm", header: "HWM", align: "right", cell: (f) => <span className="k-num text-fg-2">{usd(f.hwmBefore)} → {usd(f.hwmAfter)}</span>, hideOn: "md" },
    { key: "a", header: t("social.fee"), align: "right", cell: (f) => <span className="k-num font-medium">{usd(f.amount)}</span>, sort: (f) => f.amount },
    { key: "s", header: t("common.status"), align: "right", cell: (f) => <Chip size="sm" tone={FEE_STATUS_TONE[f.status] ?? "neutral"}>{t.dyn(`social.feeStatus.${f.status}`, f.status)}</Chip> },
  ];
  if (!fees.length) return <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">{empty ?? t("social.fees.empty")}</div>;
  return <DataTable columns={cols} rows={fees} dense pageSize={10} rowKey={(f) => String(f.id)} />;
}

/* ------------------------------------------------------------------ */
/* Settings (PATCH)                                                    */
/* ------------------------------------------------------------------ */

function SettingsDialog({ sub, onClose, onSaved }: { sub: SubscriptionView | null; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const [mode, setMode] = React.useState<SizingMode>("equity");
  const value = useNumber(1);
  const maxLot = useNumber(null);
  const equityStop = useNumber(null);
  const autoSl = useNumber(null);
  const [ddOn, setDdOn] = React.useState(false);
  const [dd, setDd] = React.useState(30);
  const [ex, setEx] = React.useState<string[]>([]);
  const [add, setAdd] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const symbolsQ = useSocial<{ symbols: { symbol: string }[] }>(sub ? "symbols" : null);

  React.useEffect(() => {
    if (!sub) return;
    setMode(sub.sizing.mode);
    value.set(sub.sizing.value);
    maxLot.set(sub.maxLot);
    equityStop.set(sub.equityStop);
    autoSl.set(sub.autoSlPips ?? null);
    setDdOn(sub.maxDdPct !== null);
    setDd(sub.maxDdPct ?? 30);
    setEx(sub.excludedSymbols ?? []);
    setAdd("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub?.id]);

  if (!sub) return null;
  const val = mode === "equity" ? 1 : value.value;
  const autoSlErr = autoSl.raw && !(autoSl.value! >= 1 && autoSl.value! <= 5000) ? t("social.autoSl.err") : undefined;
  const err = mode !== "equity" && !(val! > 0) ? t("social.subs.err.sizing") : maxLot.raw && !(maxLot.value! >= 0.01) ? t("social.subs.err.maxLot") : equityStop.raw && !(equityStop.value! >= 0) ? t("social.subs.err.equityStop") : autoSlErr;
  const all = symbolsQ.data?.symbols.map((s) => s.symbol) ?? [];
  const matches = add ? all.filter((s) => s.toLowerCase().includes(add.toLowerCase()) && !ex.includes(s)).slice(0, 12) : [];

  const save = async () => {
    if (err) return toast.error(err);
    setBusy(true);
    try {
      await socialApi(`subscriptions/${sub.id}`, {
        method: "PATCH",
        body: { sizing: { mode, value: val }, maxLot: maxLot.value, equityStop: equityStop.value, maxDdPct: ddOn ? dd : null, excludedSymbols: ex, autoSlPips: autoSl.value },
      });
      toast.success(t("social.subs.toast.saved"), { description: t("social.subs.toast.savedDesc") });
      onSaved();
      onClose();
    } catch (e) {
      toast.error(t("social.subs.toast.saveFailed"), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!sub}
      onOpenChange={(o) => !o && onClose()}
      width={620}
      title={t("social.subs.settings.title")}
      description={t("social.subs.nameAccount", { name: sub.master.nickname, login: sub.login })}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="ember" onClick={save} disabled={busy || !!err}>
            {busy && <Loader2 className="animate-spin" />} {t("common.saveChanges")}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <div className="mb-2 text-[12.5px] font-medium text-fg-2">{t("social.follow.step.sizing")}</div>
          <div role="radiogroup" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(Object.keys(SIZING_LABEL) as SizingMode[]).map((k) => (
              <RadioCard
                key={k}
                selected={mode === k}
                onSelect={() => {
                  setMode(k);
                  if (k !== sub.sizing.mode) value.set(k === "fixed_lot" ? 0.1 : k === "multiplier" ? 1 : k === "allocation" ? sub.allocation : 1);
                  else value.set(sub.sizing.value);
                }}
                title={SIZING_LABEL[k]}
                className="p-3"
              />
            ))}
          </div>
          {mode !== "equity" && (
            <Field label={mode === "fixed_lot" ? t("social.follow.lotPerTrade") : mode === "multiplier" ? t("social.sizing.multiplier") : t("social.follow.allocForSizing")} className="mt-3">
              <Input type="number" inputMode="decimal" min={0} step={mode === "fixed_lot" ? 0.01 : 0.1} value={value.raw} onChange={(e) => value.setRaw(e.target.value)} trailing={mode === "fixed_lot" ? t("social.lotsUnit") : mode === "multiplier" ? "×" : "USD"} inputClassName="k-num" />
            </Field>
          )}
        </div>
        <div className="rounded-[16px] border border-line bg-surface-2 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13.5px] font-medium">{t("social.follow.ddStop")}</div>
              <div className="text-[12px] text-fg-3">{t("social.subs.settings.fromPeak", { amount: usd(sub.peakEquity) })}</div>
            </div>
            <Toggle checked={ddOn} onChange={setDdOn} label={t("social.follow.ddStop")} />
          </div>
          <div className={cn("mt-4", !ddOn && "pointer-events-none opacity-40")}>
            <div className="mb-1 flex justify-between text-[12.5px]">
              <span className="text-fg-3">{t("social.follow.trigger")}</span>
              <span className="k-num font-medium text-down">-{dd}%</span>
            </div>
            <RangeSlider value={dd} onChange={setDd} min={5} max={90} tone="down" ticks={[5, 20, 30, 50, 90]} format={(v) => `${v}%`} label={t("social.follow.maxDrawdown")} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("social.equityStop")} hint={t("social.subs.settings.emptyOff")}>
            <Input type="number" inputMode="decimal" min={0} placeholder={t("social.follow.noEquityStop")} value={equityStop.raw} onChange={(e) => equityStop.setRaw(e.target.value)} leading="$" inputClassName="k-num" />
          </Field>
          <Field label={t("social.follow.maxLotPerTrade")} hint={t("social.subs.settings.emptyNoCap")}>
            <Input type="number" inputMode="decimal" min={0.01} step={0.01} placeholder={t("social.noCap")} value={maxLot.raw} onChange={(e) => maxLot.setRaw(e.target.value)} trailing={t("social.lotsUnit")} inputClassName="k-num" />
          </Field>
        </div>
        <div data-testid="copy-auto-sl">
          <Field label={t("social.autoSl.label")} hint={t("social.subs.settings.emptyOff")} error={autoSlErr}>
            <Input type="number" inputMode="decimal" min={1} max={5000} step={1} placeholder={t("social.autoSl.off")} value={autoSl.raw} onChange={(e) => autoSl.setRaw(e.target.value)} leading={<Target />} trailing={t("social.autoSl.pips")} inputClassName="k-num" />
          </Field>
          <p className="mt-1.5 text-[12px] leading-snug text-fg-3">{t("social.autoSl.hint")}</p>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
            {t("social.follow.excludedSymbols")} <span className="font-normal text-fg-3">{ex.length ? t("social.follow.excludedCount", { count: ex.length }) : t("social.follow.copyEverything")}</span>
          </div>
          {ex.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {ex.map((s) => (
                <ToggleChip key={s} tone="down" on onClick={() => setEx((x) => x.filter((y) => y !== s))}>
                  <SymbolAvatar symbol={s} size={16} />
                  {s}
                  <XIcon className="size-3" />
                </ToggleChip>
              ))}
            </div>
          )}
          <Input value={add} onChange={(e) => setAdd(e.target.value)} placeholder={t("social.subs.settings.searchExclude")} className="h-9" />
          {matches.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {matches.map((s) => (
                <ToggleChip
                  key={s}
                  tone="down"
                  on={false}
                  onClick={() => {
                    setEx((x) => [...x, s]);
                    setAdd("");
                  }}
                >
                  <SymbolAvatar symbol={s} size={16} />
                  {s}
                </ToggleChip>
              ))}
            </div>
          )}
        </div>
        <p className="text-[12px] text-fg-3">{t("social.subs.settings.note")}</p>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Stop                                                                */
/* ------------------------------------------------------------------ */

function StopDialog({ sub, onClose, onStopped }: { sub: SubscriptionView | null; onClose: () => void; onStopped: () => void }) {
  const t = useT();
  // close every copied position and order at market (default), or keep them open as the client's own trades
  const [close, setClose] = React.useState(true);
  const [returnFunds, setReturnFunds] = React.useState(true);
  // last choice (only when everything closes and the balance goes back to the wallet): archive the copy account or keep it
  const [delAcc, setDelAcc] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState<{ r: StopResult; kept: boolean } | null>(null);
  // archive after the stop: running, done, failed (account kept), or waiting for the e-mailed step-up code (live accounts)
  const [archive, setArchive] = React.useState<"running" | "done" | "failed" | "stepup" | null>(null);
  React.useEffect(() => {
    setClose(true);
    setReturnFunds(true);
    setDelAcc(false);
    setRes(null);
    setArchive(null);
  }, [sub?.id]);
  if (!sub) return null;
  const open = sub.positions + sub.orders > 0;
  const keep = open && !close;
  const canDelete = !keep && returnFunds;
  const login = sub.login;

  /** Client Area trading BFF: empty (if anything is left) and archive the copy account; history and statements are kept. */
  const archiveAccount = async (token?: string) => {
    await tradingApi(`accounts/${login}/archive`, { body: { empty: true, ackForfeit: true, ...(token ? { stepup_token: token } : {}) } });
    setArchive("done");
  };
  const runArchive = async () => {
    setArchive("running");
    try {
      await archiveAccount();
    } catch (e) {
      // live accounts need an e-mailed code first (the same step-up as a leverage change)
      if (e instanceof TradingApiError && STEPUP_CODES.has(e.code)) setArchive("stepup");
      else setArchive("failed");
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      const r = await socialApi<StopResult>(`subscriptions/${sub.id}/stop`, { body: { ...(returnFunds ? { returnFunds: true } : {}), ...(keep ? { closePositions: false } : {}) } });
      setRes({ r, kept: keep });
      if (canDelete && delAcc) void runArchive();
      const back = r.returned ? t("social.subs.stop.backToWallet", { amount: usd(r.returned) }) : "";
      toast.success(t("social.subs.stop.stopped"), { description: keep ? back || undefined : `${t("social.subs.stop.closedCount", { count: r.closed?.length ?? 0 })}${back ? ` · ${back}` : ""}` });
      onStopped();
    } catch (e) {
      toast.error(t("social.subs.stop.failed"), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  if (res) {
    const { r, kept } = res;
    return (
      <Dialog
        open={!!sub}
        onOpenChange={(o) => !o && onClose()}
        width={480}
        title={t("social.subs.stop.stopped")}
        description={t("social.subs.nameAccount", { name: sub.master.nickname, login: sub.login })}
        footer={
          <Button variant="ember" onClick={onClose}>
            {t("common.done")}
          </Button>
        }
      >
        <div className="space-y-3 text-[13.5px]">
          <div className="grid grid-cols-2 gap-2">
            <Tile label={t("social.subs.stop.positionsClosed")}>{(r.closed?.length ?? 0).toString()}</Tile>
            <Tile label={t("social.subs.stop.returned")}>{r.returned !== null && r.returned !== undefined ? usd(r.returned) : "—"}</Tile>
          </div>
          {kept && <InfoBox icon={<Layers />}>{t("social.subs.stop.kept", { login: sub.login })}</InfoBox>}
          {r.failed?.length > 0 && (
            <InfoBox tone="down" icon={<AlertTriangle />}>
              {t("social.subs.stop.failedCount", { count: r.failed.length })}
              <ul className="mt-1 list-disc ps-4">
                {r.failed.map((f) => (
                  <li key={f.ticket}>
                    #{f.ticket}: {f.error}
                  </li>
                ))}
              </ul>
              {t("social.subs.stop.contactSupport")}
            </InfoBox>
          )}
          {returnFunds && r.returned === null && <InfoBox tone="warn">{t("social.subs.stop.notMoved", { login: sub.login })}</InfoBox>}
          {!returnFunds && <InfoBox>{t("social.subs.stop.stays", { login: sub.login })}</InfoBox>}
          {(archive === "running" || archive === "stepup") && (
            <InfoBox icon={<Loader2 className="animate-spin" />}>{t("social.subs.stop.archiving")}</InfoBox>
          )}
          {archive === "done" && (
            <InfoBox tone="up" icon={<Archive />}>
              <span data-testid="copy-archive-done">{t("social.subs.stop.archived", { login })}</span>
            </InfoBox>
          )}
          {archive === "failed" && (
            <InfoBox tone="warn" icon={<AlertTriangle />}>
              <span data-testid="copy-archive-failed">{t("social.subs.stop.archiveFailed", { login })}</span>{" "}
              <Link href="/accounts" className="font-medium text-ember hover:underline">
                {t("common.accounts")}
              </Link>
            </InfoBox>
          )}
        </div>
        <StepUpDialog
          open={archive === "stepup"}
          onOpenChange={(o) => {
            // closing the code dialog without confirming keeps the account
            if (!o) setArchive((a) => (a === "stepup" ? "failed" : a));
          }}
          action="account_archive"
          target={String(login)}
          title={t("social.subs.stop.archiveTitle", { login })}
          what={t("social.subs.stop.archiveWhat", { login })}
          confirmLabel={t("social.subs.stop.archiveConfirm")}
          onConfirmed={async (token) => {
            try {
              await archiveAccount(token);
            } catch {
              setArchive("failed");
            }
          }}
        />
      </Dialog>
    );
  }

  return (
    <Dialog
      open={!!sub}
      onOpenChange={(o) => !o && onClose()}
      width={480}
      title={t("social.subs.stop.title")}
      description={t("social.subs.nameAccount", { name: sub.master.nickname, login: sub.login })}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            {t("social.subs.stop.keep")}
          </Button>
          <Button variant="sell" onClick={stop} disabled={busy} data-testid="copy-stop-confirm">
            {busy ? <Loader2 className="animate-spin" /> : <Square />} {keep ? t("social.subs.stop.confirmKeep") : t("social.subs.stop.confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-[13.5px] text-fg-2">
        {open && (
          <div role="radiogroup" aria-label={t("social.subs.stop.title")} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <RadioCard selected={close} onSelect={() => setClose(true)} title={t("social.subs.stop.closeAll")} icon={<XIcon />} className="p-3" />
            <RadioCard selected={!close} onSelect={() => setClose(false)} title={t("social.subs.stop.keepOpen")} icon={<Layers />} className="p-3" />
          </div>
        )}
        <InfoBox tone={keep ? "neutral" : "down"} icon={keep ? <Layers /> : <AlertTriangle />}>
          {!open ? (
            <>{t("social.subs.stop.noPositions")}</>
          ) : keep ? (
            <>{t("social.subs.stop.keepText", { login: sub.login })}</>
          ) : (
            <>
              <Trans k="social.subs.stop.allPositions" vars={{ count: sub.positions }} tags={{ b: (c) => <b className="text-fg">{c}</b> }} />
              {sub.orders ? <> {t("social.subs.stop.andOrders", { count: sub.orders })}</> : null} {t("social.subs.stop.atMarket")}
            </>
          )}{" "}
          {t("social.subs.stop.undone", { name: sub.master.nickname })}
        </InfoBox>
        <div className="grid grid-cols-2 gap-2">
          <Tile label={t("social.subs.equityNow")}>{usd(sub.equity)}</Tile>
          <Tile label={t("social.feesPending")}>{usd(sub.feesPending)}</Tile>
        </div>
        <div className="space-y-1.5">
          <Checkbox checked={returnFunds} onChange={setReturnFunds}>
            {t("social.subs.stop.moveBack")}
          </Checkbox>
          {keep && returnFunds && <p className="ps-[30px] text-[12px] leading-snug text-fg-3">{t("social.subs.stop.keepFunds")}</p>}
        </div>
        {canDelete && (
          <div className="space-y-2" data-testid="copy-stop-account">
            <div className="text-[12.5px] font-medium text-fg">{t("social.subs.stop.accountQ")}</div>
            <div role="radiogroup" aria-label={t("social.subs.stop.accountQ")} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <RadioCard selected={delAcc} onSelect={() => setDelAcc(true)} title={t("social.subs.stop.deleteAcc")} text={t("social.subs.stop.deleteAccS")} icon={<Archive />} className="p-3" />
              <RadioCard selected={!delAcc} onSelect={() => setDelAcc(false)} title={t("social.subs.stop.keepAcc")} text={t("social.subs.stop.keepAccS")} icon={<Wallet />} className="p-3" />
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Detail drawer                                                       */
/* ------------------------------------------------------------------ */

type DetailTab = "positions" | "orders" | "log" | "execution" | "fees" | "news";

function DetailDrawer({ id, initialTab = "positions", onClose }: { id: number | null; initialTab?: DetailTab; onClose: () => void }) {
  const t = useT();
  const { data, error } = useSocial<SubscriptionDetail>(id ? `subscriptions/${id}` : null, 5000);
  const [tab, setTab] = React.useState<DetailTab>(initialTab);
  React.useEffect(() => setTab(initialTab), [id, initialTab]);
  const d = data && data.subscription.id === id ? data : null;

  const posCols: Column<EnginePosition>[] = [
    { key: "s", header: t("social.col.symbol"), cell: (p) => <SymbolCell symbol={p.symbol} size={22} sub={<span className="font-mono">#{p.ticket}</span>} /> },
    { key: "side", header: t("social.col.side"), cell: (p) => <Chip size="sm" tone={p.side === "buy" ? "up" : "down"}>{t.dyn(`common.${p.side}`, p.side).toUpperCase()}</Chip> },
    { key: "v", header: t("social.col.lots"), align: "right", cell: (p) => <span className="k-num">{p.volume.toFixed(2)}</span> },
    { key: "px", header: t("social.col.open"), align: "right", cell: (p) => <span className="k-num text-[12px] text-fg-2" title={t("social.col.nowPrice", { price: fmtPrice(p.currentPrice) })}>{fmtPrice(p.openPrice)}</span>, hideOn: "sm" },
    { key: "pl", header: t("social.pnl"), align: "right", cell: (p) => <span className={cn("k-num font-medium", p.profit > 0 ? "text-up" : p.profit < 0 ? "text-down" : "")}>{usd(p.profit, 2, true)}</span> },
  ];
  const ordCols: Column<EngineOrder>[] = [
    { key: "s", header: t("social.col.symbol"), cell: (o) => <SymbolCell symbol={o.symbol} size={22} sub={<span className="font-mono">#{o.ticket}</span>} /> },
    { key: "t", header: t("common.type"), cell: (o) => <span className="capitalize">{t.dyn(`common.${o.side}`, o.side)} {t.dyn(`social.orderType.${o.type}`, o.type.replace("_", " "))}</span> },
    { key: "v", header: t("social.col.lots"), align: "right", cell: (o) => <span className="k-num">{o.volume.toFixed(2)}</span> },
    { key: "p", header: t("social.col.price"), align: "right", cell: (o) => <span className="k-num">{fmtPrice(o.price)}</span> },
  ];
  const logCols: Column<Log>[] = [
    { key: "at", header: t("common.time"), cell: (l) => <span className="k-num whitespace-nowrap text-fg-2">{serverTime(l.at, false)}</span> },
    {
      key: "a",
      header: t("social.col.action"),
      cell: (l) => (
        <span className="block">
          <span className="capitalize">{t.dyn(`social.logAction.${l.action}`, l.action.replace(/_/g, " "))}</span>
          {l.message && <span className="block text-[11px] text-fg-3">{l.message}</span>}
        </span>
      ),
    },
    { key: "v", header: t("social.col.lots"), align: "right", cell: (l) => <span className="k-num">{l.volume !== null && l.volume !== undefined ? l.volume.toFixed(2) : "—"}</span>, hideOn: "sm" },
    { key: "st", header: t("social.inv.col.result"), align: "right", cell: (l) => <Chip size="sm" tone={l.status === "ok" || l.status === "done" ? "up" : l.status === "skipped" ? "neutral" : "down"}>{t.dyn(`social.logStatus.${l.status}`, l.status)}</Chip> },
  ];

  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()} side="right" title={d ? `${d.subscription.master.nickname} · #${d.subscription.login}` : t("social.subs.detail.title")} description={t("social.subs.detail.description")}>
      {!d ? (
        error ? <InfoBox tone="down">{error.message}</InfoBox> : <BlockSkeleton n={3} h={90} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Tile label={t("common.equity")}>{usd(d.subscription.equity)}</Tile>
            <Tile label={t("social.profit")}>
              <span className={d.subscription.profit >= 0 ? "text-up" : "text-down"}>{usd(d.subscription.profit, 2, true)}</span>
            </Tile>
            <Tile label={t("social.return")}>{pct(d.subscription.returnPct)}</Tile>
            <Tile label={t("social.funds.explain.hwmT")}>{usd(d.subscription.hwm)}</Tile>
            <Tile label={t("social.feesPending")}>{usd(d.subscription.feesPending)}</Tile>
            <Tile label={t("social.subs.detail.nextFee")}>{d.subscription.nextFeeAt ? serverTime(d.subscription.nextFeeAt, false) : "—"}</Tile>
          </div>
          <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
            <Segmented
              size="xs"
              value={tab}
              onChange={setTab}
              options={[
                { value: "positions", label: t("social.subs.detail.tabPositions", { n: d.positions.length }) },
                { value: "orders", label: t("social.subs.detail.tabOrders", { n: d.orders.length }) },
                { value: "log", label: t("social.subs.detail.tabLog") },
                { value: "execution", label: t("social.subs.detail.tabExecution") },
                { value: "fees", label: t("social.subs.detail.tabFees", { n: d.fees.length }) },
                { value: "news", label: t("social.subs.detail.tabNews", { n: d.announcements?.length ?? 0 }) },
              ]}
            />
          </div>
          {tab === "positions" &&
            (d.positions.length ? <DataTable columns={posCols} rows={d.positions} dense pageSize={20} rowKey={(p) => String(p.ticket)} /> : <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">{t("social.subs.detail.noPositions")}</div>)}
          {tab === "orders" && (d.orders.length ? <DataTable columns={ordCols} rows={d.orders} dense pageSize={20} rowKey={(o) => String(o.ticket)} /> : <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">{t("social.subs.detail.noOrders")}</div>)}
          {tab === "log" && <p className="text-[12px] leading-snug text-fg-3">{t("social.subs.detail.logHint")}</p>}
          {tab === "log" && (d.log.length ? <DataTable columns={logCols} rows={d.log} dense pageSize={20} rowKey={(l, i) => `${l.at}-${i}`} /> : <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">{t("social.subs.detail.noLog")}</div>)}
          {tab === "execution" && <ExecutionPanel id={d.subscription.id} fallback={d.execution} />}
          {tab === "fees" && <FeesTable fees={d.fees} />}
          {tab === "news" && (
            <>
              <p className="text-[12px] leading-snug text-fg-3">{t("social.subs.detail.newsHint", { name: d.subscription.master.nickname })}</p>
              <AnnouncementList items={d.announcements ?? []} empty={t("social.subs.detail.noNews")} />
            </>
          )}
          <InfoBox>{t("social.subs.detail.note")}</InfoBox>
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

/** A8: the master changed the fee terms; this follower accepts them or stops copying. */
function TermsBanner({ s, onAccepted, onStop }: { s: SubscriptionView; onAccepted: () => void; onStop: () => void }) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const p = s.pendingTerms!;
  const paused = s.status === "paused" && s.pauseReason === "terms";
  const vars = {
    name: s.master.nickname,
    fee: p.perfFeePct,
    period: (PERIOD_LABEL[p.feePeriod] ?? p.feePeriod).toLowerCase(),
    current: s.perfFeePct,
    currentPeriod: (PERIOD_LABEL[s.feePeriod] ?? s.feePeriod).toLowerCase(),
    date: serverTime(p.deadline, false),
  };
  const accept = async () => {
    setBusy(true);
    try {
      await socialApi(`subscriptions/${s.id}/accept-terms`, { body: {} });
      toast.success(t("social.subs.terms.accepted"), { description: t(paused ? "social.subs.terms.acceptedResumed" : "social.subs.terms.acceptedDesc", { fee: vars.fee, period: vars.period }) });
      onAccepted();
    } catch (e) {
      toast.error(t("social.subs.terms.acceptFailed"), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-5 mt-2 rounded-[12px] border border-warn/30 bg-warn-soft px-3 py-2.5 text-[12px] leading-snug text-fg-2" data-testid="copy-terms-banner">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 size-3.5 shrink-0 text-warn" />
        <span>{t(paused ? "social.subs.terms.bannerPaused" : "social.subs.terms.banner", vars)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 ps-5.5">
        <Button size="xs" variant="ember" onClick={accept} disabled={busy} data-testid="copy-accept-terms">
          {busy ? <Loader2 className="animate-spin" /> : <Check />} {t("social.subs.terms.accept")}
        </Button>
        <Button size="xs" variant="down-outline" onClick={onStop}>
          <Square /> {t("social.subs.stopCopying")}
        </Button>
      </div>
    </div>
  );
}

function SubCard({ s, onChanged, onEdit, onStop, onDetail, onFunds }: { s: SubscriptionView; onChanged: () => void; onEdit: () => void; onStop: () => void; onDetail: (tab?: DetailTab) => void; onFunds: (dir: FundsDirection) => void }) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const stopped = s.status === "stopped";
  const masterStopped = !stopped && s.attention === "master_stopped";
  const pausedForTerms = s.status === "paused" && s.pauseReason === "terms";
  const canWithdraw = withdrawableOf(s) > 0;
  const togglePause = async () => {
    setBusy(true);
    const pause = s.status !== "paused";
    try {
      await socialApi(`subscriptions/${s.id}`, { method: "PATCH", body: { paused: pause } });
      toast.success(pause ? t("social.subs.toast.paused") : t("social.subs.toast.resumed"), {
        description: pause ? t("social.subs.toast.pausedDesc") : t("social.subs.toast.resumedDesc", { name: s.master.nickname }),
      });
      onChanged();
    } catch (e) {
      toast.error(pause ? t("social.subs.toast.pauseFailed") : t("social.subs.toast.resumeFailed"), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={cn("k-card flex h-full flex-col", stopped && "opacity-70")}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <Link href={`/social/masters/${s.masterId}`} className="min-w-0">
          <MasterIdentity nickname={s.master.nickname} size={42} sub={s.master.strategy} />
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          <RiskBadge risk={s.master.riskScore} />
          <StatusChip status={s.status} label={t.dyn(`social.subStatus.${s.status}`, s.status)} />
        </div>
      </div>
      {s.master.house && (
        <div className="mt-2.5 px-5">
          <HouseBadge />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 px-5 text-[12px] text-fg-3">
        {t("social.subs.copyAccount")} <span className="font-mono text-fg-2">#{s.login}</span>
        <CopyButton value={String(s.login)} label={t("social.subs.copyAccount")} className="size-5" />
        <span>{t("social.subs.since", { date: fmtDate(s.createdAt) })}</span>
      </div>
      {stopped && s.stopReason && <div className="mt-1 px-5 text-[12px] text-down">{stopReason(s.stopReason, t)}{s.stoppedAt ? ` · ${fmtDate(s.stoppedAt)}` : ""}</div>}
      {!stopped && s.master.frozen && !masterStopped && <div className="mt-1 px-5 text-[12px] text-warn">{t("social.subs.frozen")}</div>}
      {masterStopped && (
        <div className="mx-5 mt-2 rounded-[12px] border border-down/30 bg-down-soft px-3 py-2.5 text-[12px] leading-snug text-fg-2" data-testid="copy-master-stopped">
          <div className="flex items-start gap-2">
            <OctagonAlert className="mt-0.5 size-3.5 shrink-0 text-down" />
            <span>{t("social.subs.masterStopped", { name: s.master.nickname })}</span>
          </div>
          <div className="mt-2 ps-5.5">
            <Button size="xs" variant="down-outline" onClick={onStop}>
              <Square /> {t("social.subs.stopCopying")}
            </Button>
          </div>
        </div>
      )}
      {s.status === "paused" && (
        <div className="mx-5 mt-2 flex items-start gap-2 rounded-[10px] border border-warn/30 bg-warn-soft px-3 py-2 text-[12px] leading-snug text-fg-2" data-testid="copy-paused-note">
          <Pause className="mt-0.5 size-3.5 shrink-0 text-warn" />
          {pausedForTerms ? t("social.subs.pausedTermsNote", { name: s.master.nickname }) : t("social.subs.pausedNote")}
        </div>
      )}
      {!stopped && s.pendingTerms && <TermsBanner s={s} onAccepted={onChanged} onStop={onStop} />}
      <div className="mt-4 px-5">
        <div className="text-[12px] text-fg-3">{t("common.equity")}</div>
        <Money value={s.equity} countUp={false} className="text-[26px] font-semibold" />
        <div className={cn("k-num text-[12.5px] font-medium", s.profit > 0 ? "text-up" : s.profit < 0 ? "text-down" : "text-fg-2")}>
          {usd(s.profit, 2, true)} ({pct(s.returnPct)})
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 px-5 text-[12px] sm:grid-cols-3">
        <Tile label={t("social.subs.netDeposits")}>{usd(s.netDeposits, 0)}</Tile>
        <Tile label={t("social.subs.highWater")}>{usd(s.hwm, 0)}</Tile>
        <Tile label={t("social.feesPending")}>
          <span className={s.feesPending ? "text-warn" : ""}>{usd(s.feesPending)}</span>
        </Tile>
        <Tile label={t("social.follow.step.sizing")}>{sizingText(s.sizing)}</Tile>
        <Tile label={t("social.col.open")}>
          {t("social.subs.openCounts", { pos: s.positions, ord: s.orders })}
        </Tile>
        <Tile label={t("social.inv.kpi.feesPaid")}>{usd(s.feesPaid)}</Tile>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 px-5">
        <Chip size="sm">
          {t("social.subs.feeChip", { fee: s.perfFeePct, period: PERIOD_LABEL[s.feePeriod].toLowerCase() })}
        </Chip>
        {s.maxDdPct !== null && (
          <Chip size="sm" tone="down">
            <ShieldAlert className="size-3" /> {t("social.subs.ddStopChip", { dd: s.maxDdPct })}
          </Chip>
        )}
        {s.equityStop !== null && (
          <Chip size="sm" tone="down">
            {t("social.subs.equityStopChip", { amount: usd(s.equityStop, 0) })}
          </Chip>
        )}
        {s.maxLot !== null && <Chip size="sm">{t("social.subs.maxLotChip", { lot: s.maxLot.toFixed(2) })}</Chip>}
        {s.autoSlPips !== null && s.autoSlPips !== undefined && (
          <Chip size="sm" tone="down">
            <Target className="size-3" /> {t("social.subs.autoSlChip", { pips: pips1(s.autoSlPips) })}
          </Chip>
        )}
        {s.excludedSymbols.length > 0 ? <Chip size="sm">{t("social.subs.exclChip", { list: s.excludedSymbols.slice(0, 3).join(", ") })}{s.excludedSymbols.length > 3 ? ` +${s.excludedSymbols.length - 3}` : ""}</Chip> : <Chip size="sm">{t("social.subs.allSymbols")}</Chip>}
      </div>
      <div className="mt-2.5 px-5">
        <button type="button" onClick={() => onDetail("log")} className="inline-flex items-center gap-1 text-[12px] font-medium text-ember hover:underline" data-testid="copy-why-not-copied">
          <HelpCircle className="size-3.5" /> {t("social.subs.whyNotCopied")}
        </button>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 px-5 pb-5 pt-4 sm:grid-cols-3">
        {!stopped && (
          <>
            <Button size="sm" variant="surface" disabled={busy} onClick={togglePause}>
              {busy ? <Loader2 className="animate-spin" /> : s.status === "paused" ? <Play /> : <Pause />} {s.status === "paused" ? t("social.subs.resume") : t("social.subs.pause")}
            </Button>
            <Button size="sm" variant="surface" onClick={onEdit}>
              <Settings2 /> {t("social.subs.settings")}
            </Button>
            <Button size="sm" variant="down-outline" onClick={onStop}>
              <Square /> {t("social.subs.stop")}
            </Button>
            <Button size="sm" variant="surface" onClick={() => onFunds("add")} data-testid="copy-add-funds">
              <ArrowDownToLine /> {t("social.subs.funds.add")}
            </Button>
            <Button size="sm" variant="surface" onClick={() => onFunds("withdraw")} data-testid="copy-withdraw">
              <ArrowUpFromLine /> {t("social.subs.funds.withdraw")}
            </Button>
          </>
        )}
        {stopped && canWithdraw && (
          <Button size="sm" variant="surface" onClick={() => onFunds("withdraw")} data-testid="copy-withdraw">
            <ArrowUpFromLine /> {t("social.subs.funds.withdraw")}
          </Button>
        )}
        <Button size="sm" variant="surface" onClick={() => onDetail()} className={cn(stopped && "col-span-1")}>
          <ListChecks /> {t("common.details")}
        </Button>
        <TradeButton a={{ login: s.login, status: "active" }} size="sm" label="Kalks Trader" className={stopped ? (canWithdraw ? "col-span-2 sm:col-span-1" : "sm:col-span-2") : "col-span-2 sm:col-span-3"} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function LiveCopyPage() {
  const t = useT();
  const { data, error, loading, reload } = useSocial<{ items: SubscriptionView[] }>("subscriptions", 5000);
  const [view, setView] = React.useState<"current" | "stopped">("current");
  const [edit, setEdit] = React.useState<SubscriptionView | null>(null);
  const [stop, setStop] = React.useState<SubscriptionView | null>(null);
  const [detail, setDetail] = React.useState<number | null>(null);
  const [detailTab, setDetailTab] = React.useState<DetailTab>("positions");
  const [funds, setFunds] = React.useState<{ id: number; dir: FundsDirection } | null>(null);

  const items = data?.items ?? [];
  const current = items.filter((s) => s.status !== "stopped");
  const stopped = items.filter((s) => s.status === "stopped");
  const list = view === "current" ? current : stopped;
  const equity = current.reduce((a, s) => a + s.equity, 0);
  const profit = current.reduce((a, s) => a + s.profit, 0);
  const deposits = current.reduce((a, s) => a + s.netDeposits, 0);
  const feesPending = items.reduce((a, s) => a + s.feesPending, 0);
  const feesPaid = items.reduce((a, s) => a + s.feesPaid, 0);

  return (
    <div className="pb-24">
      <PageHeader
        title={t("social.subs.title")}
        subtitle={t("social.subs.subtitle")}
        actions={
          <Link href="/social">
            <Button variant="ember" size="lg">
              <Compass /> {t("social.subs.findMaster")}
            </Button>
          </Link>
        }
      />

      {error && !data ? (
        <SocialError onRetry={reload} message={error.message} />
      ) : loading ? (
        <BlockSkeleton n={3} h={140} />
      ) : items.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-8">
            <EmptyState
              art="copyTrading"
              title={t("social.subs.empty.title")}
              text={t("social.subs.empty.text")}
              action={
                <Link href="/social">
                  <Button variant="ember">
                    <Compass /> {t("social.lb.title")}
                  </Button>
                </Link>
              }
            />
          </Card>
          <HowItWorks className="xl:col-span-4" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label={t("social.subs.kpi.copyEquity")} icon={<Wallet />} value={<Money value={equity} countUp={false} />} chip={t("social.subs.kpi.activeOrPaused", { count: current.length })} />
            <KpiCard label={t("social.profit")} icon={<Repeat />} value={<Money value={profit} signed tone="auto" countUp={false} />} chip={deposits > 0 ? t("social.subs.kpi.onNetDeposits", { pct: pct((profit / deposits) * 100) }) : "—"} chipTone={profit >= 0 ? "up" : "down"} delay={0.04} />
            <KpiCard label={t("social.feesPending")} icon={<ShieldCheck />} value={<Money value={feesPending} countUp={false} />} chip={t("social.subs.kpi.awaitingApproval")} chipTone="warn" delay={0.08} />
            <KpiCard label={t("social.inv.kpi.feesPaid")} icon={<Layers />} value={<Money value={feesPaid} countUp={false} />} chip={t("social.subs.kpi.allSubs")} delay={0.12} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-[18px] font-medium tracking-tight">{t("social.mySubscriptions")}</h2>
                  <p className="text-[13px] text-fg-3">{t("social.subs.listHint")}</p>
                </div>
                <Segmented
                  size="xs"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "current", label: t("social.subs.tabCurrent", { n: current.length }) },
                    { value: "stopped", label: t("social.subs.tabStopped", { n: stopped.length }) },
                  ]}
                />
              </div>
              {list.length === 0 ? (
                <Card>
                  <div className="px-6 py-12 text-center text-[13px] text-fg-3">{view === "current" ? t("social.subs.noActive") : t("social.subs.noStopped")}</div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {list.map((s) => (
                    <SubCard
                      key={s.id}
                      s={s}
                      onChanged={reload}
                      onEdit={() => setEdit(s)}
                      onStop={() => setStop(s)}
                      onFunds={(dir) => setFunds({ id: s.id, dir })}
                      onDetail={(tab) => {
                        setDetailTab(tab ?? "positions");
                        setDetail(s.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            <HowItWorks className="xl:col-span-4 xl:self-start" />
          </div>
        </>
      )}

      <SettingsDialog sub={edit} onClose={() => setEdit(null)} onSaved={reload} />
      <StopDialog sub={stop} onClose={() => setStop(null)} onStopped={reload} />
      <DetailDrawer id={detail} initialTab={detailTab} onClose={() => setDetail(null)} />
      <SubFundsDialog sub={funds ? (items.find((x) => x.id === funds.id) ?? null) : null} direction={funds?.dir ?? "add"} onClose={() => setFunds(null)} onDone={reload} />
    </div>
  );
}

function HowItWorks({ className }: { className?: string }) {
  const t = useT();
  return (
    <Card className={className}>
      <CardHeader title={t("social.subs.how.title")} subtitle={t("social.subs.how.subtitle")} icon={<ShieldCheck />} />
      <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
        {([
          { icon: <Layers />, t: "social.subs.how.mirroredT", s: "social.subs.how.mirroredS" },
          { icon: <Ban />, t: "social.subs.how.noSingleT", s: "social.subs.how.noSingleS" },
          { icon: <Sliders />, t: "social.subs.how.limitsT", s: "social.subs.how.limitsS" },
          { icon: <Check />, t: "social.subs.how.feesT", s: "social.subs.how.feesS" },
        ] as const).map((r) => (
          <div key={r.t} className="k-row flex items-start gap-3 px-3.5 py-3">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 text-fg-2 [&_svg]:size-3.5">{r.icon}</span>
            <div>
              <div className="text-[13px] font-medium">{t(r.t)}</div>
              <div className="text-[12px] leading-snug text-fg-3">{t(r.s)}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
