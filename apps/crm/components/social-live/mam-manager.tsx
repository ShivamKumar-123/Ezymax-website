"use client";

// Client Area → Social → MAM manager: an approved master opens a MAM programme (a dedicated MAM master account),
// sees the linked accounts, sets per-account multipliers / percents, previews how a block is allocated and
// reviews every allocation and fee.

import * as React from "react";
import Link from "next/link";
import { Briefcase, Calculator, Clock, FileText, Layers, Loader2, Pencil, Percent, Plus, ShieldAlert, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, Field, Input, KpiCard, Money, PageHeader, Segmented, StatusChip, cn, type Column } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { RadioCard } from "@/components/social/controls";
import { SecretField, TradeButton } from "@/components/trading/ui";
import { fmtDate, serverTime } from "@/components/trading/api";
import { PERIOD_LABEL, compactUsd, socialApi, usd, useSocial, type FeePeriod } from "./api";
import { BlockSkeleton, InfoBox, SocialError, useNumber } from "./bits";
import { FEE_STATUS_TONE } from "./subscriptions";
import { METHOD_HINT, METHOD_LABEL, lots, reasonText, valueText, type Allocation, type LinkView, type ManagerMe, type ManagerView, type MamFee, type MamMethod, type Preview } from "./mam-api";

const METHODS: MamMethod[] = ["equity", "balance", "multiplier", "percent"];
const PERIODS: FeePeriod[] = ["daily", "weekly", "monthly"];
const tone = (v: number) => (v > 0 ? "text-up" : v < 0 ? "text-down" : "text-fg-2");
const textareaCls =
  "w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-3 text-sm leading-relaxed text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10";

/* ------------------------------------------------------------------ */
/* Programme form (create / edit)                                      */
/* ------------------------------------------------------------------ */

function ProgrammeForm({ me, m, onDone, onCancel }: { me: ManagerMe; m: ManagerView | null; onDone: (creds?: Record<string, unknown>) => void; onCancel?: () => void }) {
  const t = useT();
  const [name, setName] = React.useState(m?.name ?? "");
  const [description, setDescription] = React.useState(m?.description ?? "");
  const [method, setMethod] = React.useState<MamMethod>(m?.method ?? "equity");
  const perf = useNumber(m?.perfFeePct ?? 20);
  const mgmt = useNumber(m?.mgmtFeePct ?? 0);
  const [period, setPeriod] = React.useState<FeePeriod>(m?.feePeriod ?? "monthly");
  const minEquity = useNumber(m?.minEquity ?? 100);
  const seed = useNumber(null);
  const [busy, setBusy] = React.useState(false);
  const s = me.settings;
  const locked = !!m && m.accounts > 0;
  const err =
    name.trim().length < 3
      ? t("social.mm.err.name")
      : perf.value === null || perf.value < s.feeMinPct || perf.value > s.feeMaxPct
        ? t("social.mm.err.perf", { min: s.feeMinPct, max: s.feeMaxPct })
        : mgmt.value !== null && (mgmt.value < 0 || mgmt.value > s.mgmtMaxPct)
          ? t("social.mm.err.mgmt", { max: s.mgmtMaxPct })
          : seed.raw && !(seed.value! > 0)
            ? t("social.mm.err.seed")
            : undefined;

  const submit = async () => {
    if (err) return toast.error(err);
    setBusy(true);
    try {
      const body = { name: name.trim(), description: description.trim(), method, perfFeePct: perf.value, mgmtFeePct: mgmt.value ?? 0, feePeriod: period, minEquity: minEquity.value ?? 0 };
      if (m) {
        const { method: _m, ...rest } = body;
        await socialApi("mam/manager", { method: "PATCH", body: locked ? rest : body });
        toast.success(t("social.mm.toast.updated"), { description: t("social.mm.toast.updatedDesc") });
        onDone();
      } else {
        const r = await socialApi<{ credentials: Record<string, unknown> }>("mam/manager", { body: seed.value ? { ...body, seed: seed.value } : body });
        toast.success(t("social.mm.toast.opened"));
        onDone(r.credentials);
      }
    } catch (e) {
      toast.error(m ? t("social.mm.toast.updateFailed") : t("social.mm.toast.openFailed"), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("social.mm.name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t("social.mm.namePh")} />
        </Field>
        <Field label={t("social.mm.minEquity")} hint={t("social.mm.minEquityHint")}>
          <Input type="number" inputMode="decimal" min={0} value={minEquity.raw} onChange={(e) => minEquity.setRaw(e.target.value)} leading="$" inputClassName="k-num" />
        </Field>
      </div>
      <Field label={t("social.md.description")} hint={t("social.mm.shownToClients")}>
        <textarea className={textareaCls} rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("social.mm.descriptionPh")} />
      </Field>
      <div>
        <div className="mb-2 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
          {t("social.mm.method")} {locked && <span className="font-normal text-fg-3">{t("social.mm.methodLocked")}</span>}
        </div>
        <div role="radiogroup" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {METHODS.map((k) => (
            <RadioCard key={k} selected={method === k} onSelect={() => !locked && setMethod(k)} title={METHOD_LABEL[k]} text={METHOD_HINT[k]} className={cn("p-3", locked && method !== k && "opacity-50")} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t("social.performanceFee")} hint={`${s.feeMinPct}–${s.feeMaxPct}%`}>
          <Input type="number" inputMode="decimal" min={s.feeMinPct} max={s.feeMaxPct} value={perf.raw} onChange={(e) => perf.setRaw(e.target.value)} trailing="%" inputClassName="k-num" />
        </Field>
        <Field label={t("social.mm.mgmtFee")} hint={t("social.mm.mgmtHint", { max: s.mgmtMaxPct })}>
          <Input type="number" inputMode="decimal" min={0} max={s.mgmtMaxPct} step={0.1} value={mgmt.raw} onChange={(e) => mgmt.setRaw(e.target.value)} trailing="%/y" inputClassName="k-num" />
        </Field>
        <Field label={t("social.mm.feePeriod")}>
          <Segmented size="sm" value={period} onChange={(v) => setPeriod(v as FeePeriod)} options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
        </Field>
      </div>
      {!m && (
        <Field label={t("social.mm.fund")} hint={t("common.optional")}>
          <Input type="number" inputMode="decimal" min={0} placeholder="0.00" value={seed.raw} onChange={(e) => seed.setRaw(e.target.value)} leading="$" inputClassName="k-num" />
        </Field>
      )}
      <InfoBox>
        {t("social.mm.feeNote", { period: PERIOD_LABEL[period].toLowerCase(), cut: s.platformCutPct })}
      </InfoBox>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {t("common.cancel")}
          </Button>
        )}
        <Button variant="ember" onClick={submit} disabled={busy || !!err} title={err}>
          {busy && <Loader2 className="animate-spin" />} {m ? t("social.mm.save") : t("social.mm.open")}
        </Button>
      </div>
    </div>
  );
}

function CredentialsDialog({ creds, onClose }: { creds: Record<string, unknown> | null; onClose: () => void }) {
  const t = useT();
  if (!creds) return null;
  const funding = creds.funding as { status?: string; message?: string } | null;
  return (
    <Dialog open={!!creds} onOpenChange={(o) => !o && onClose()} title={t("social.mm.creds.title")} description={t("social.mm.creds.description")} footer={<Button variant="ember" onClick={onClose}>{t("common.done")}</Button>}>
      <div className="space-y-3">
        <SecretField label={t("social.md.fund.login")} value={String(creds.login ?? "")} />
        <SecretField label={t("social.md.fund.tradingPassword")} value={String(creds.password ?? "")} secret />
        <SecretField label={t("social.mm.creds.investorPassword")} value={String(creds.investorPassword ?? "")} secret />
        {funding?.status === "failed" && (
          <InfoBox tone="warn" icon={<ShieldAlert />}>
            {funding.message}
          </InfoBox>
        )}
        <p className="text-[12.5px] text-fg-3">{t("social.mm.creds.note")}</p>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

function PreviewCard({ m }: { m: ManagerView }) {
  const t = useT();
  const [symbol, setSymbol] = React.useState("EURUSD");
  const volume = useNumber(1);
  const [q, setQ] = React.useState("symbol=EURUSD&volume=1");
  const { data, error } = useSocial<Preview>(`mam/manager/preview?${q}`);
  const apply = () => {
    const s = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9._]{2,20}$/.test(s) || !(volume.value! > 0)) return toast.error(t("social.mm.preview.err"));
    setQ(`symbol=${s}&volume=${volume.value}`);
  };
  const cols: Column<Preview["rows"][number]>[] = [
    { key: "a", header: t("common.account"), cell: (r) => <span className="font-mono text-[12.5px]">{r.account}</span> },
    { key: "e", header: m.method === "balance" ? t("common.balance") : t("common.equity"), align: "right", cell: (r) => <span className="k-num text-fg-2">{usd(m.method === "balance" ? r.balance : r.equity)}</span> },
    { key: "b", header: m.method === "equity" || m.method === "balance" ? t("social.mm.share") : t("social.value"), align: "right", cell: (r) => <span className="k-num text-fg-2">{m.method === "equity" || m.method === "balance" ? `${(r.basis * 100).toFixed(2)}%` : valueText(m.method, r.value)}</span> },
    { key: "r", header: t("social.mm.exact"), align: "right", cell: (r) => <span className="k-num text-fg-3">{r.raw.toFixed(4)}</span>, hideOn: "sm" },
    { key: "v", header: t("social.col.lots"), align: "right", cell: (r) => <span className="k-num font-medium">{lots(r.volume)}</span> },
    { key: "n", header: t("social.mm.note"), align: "right", cell: (r) => <span className="text-[12px] text-fg-3">{reasonText(r.reason)}</span>, hideOn: "md" },
  ];
  return (
    <Card>
      <CardHeader title={t("social.mm.preview.title")} subtitle={t("social.mm.preview.subtitle", { method: METHOD_LABEL[m.method] })} icon={<Calculator />} />
      <div className="px-4 pb-5 pt-4 sm:px-6">
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <Field label={t("social.col.symbol")} className="w-[140px]">
            <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} maxLength={20} inputClassName="font-mono" />
          </Field>
          <Field label={t("social.mm.block")} className="w-[130px]">
            <Input type="number" inputMode="decimal" min={0.01} step={0.01} value={volume.raw} onChange={(e) => volume.setRaw(e.target.value)} trailing={t("social.lotsUnit")} inputClassName="k-num" />
          </Field>
          <Button variant="surface" onClick={apply}>
            {t("social.mm.preview.button")}
          </Button>
        </div>
        {error && !data ? (
          <div className="k-row px-4 py-5 text-center text-[13px] text-fg-3">{error.message}</div>
        ) : !data ? (
          <BlockSkeleton n={1} h={80} />
        ) : data.rows.length === 0 ? (
          <div className="k-row px-4 py-6 text-center text-[13px] text-fg-3">{t("social.mm.preview.empty")}</div>
        ) : (
          <>
            <DataTable columns={cols} rows={data.rows} dense pageSize={10} rowKey={(r) => String(r.linkId)} />
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-fg-3">
              <span>
                {t("social.mm.block")} <span className="k-num text-fg-2">{lots(data.block)}</span> {data.symbol}
              </span>
              <span>
                {t("social.mm.allocated")} <span className="k-num text-fg">{lots(data.allocated)}</span>
              </span>
              {(m.method === "equity" || m.method === "balance") && (
                <span>
                  {t("social.mm.leftByRounding")} <span className="k-num text-fg-2">{lots(data.unallocated)}</span>
                </span>
              )}
              <span>
                {t("social.mm.lotStep", { step: data.lotStep, min: data.lotMin })}
              </span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function ValueDialog({ m, link, onClose, onSaved }: { m: ManagerView; link: LinkView | null; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const v = useNumber(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (link) v.set(link.allocValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link?.id]);
  if (!link) return null;
  const pctMode = m.method === "percent";
  const err = v.value === null || v.value < 0.01 || v.value > (pctMode ? 1000 : 100) ? (pctMode ? t("social.mm.err.percent") : t("social.mm.err.multiplier")) : undefined;
  const save = async () => {
    setBusy(true);
    try {
      await socialApi(`mam/manager/links/${link.id}`, { method: "PATCH", body: { value: v.value } });
      toast.success(t("social.mm.toast.allocUpdated"), { description: pctMode ? t("social.mm.toast.allocPercent", { login: link.login, value: v.value ?? 0 }) : t("social.mm.toast.allocMultiplier", { login: link.login, value: v.value ?? 0 }) });
      onSaved();
      onClose();
    } catch (e) {
      toast.error(t("social.mm.toast.couldntUpdate"), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={!!link}
      onOpenChange={(o) => !o && onClose()}
      title={pctMode ? t("social.mm.percentOfBlock") : t("social.sizing.multiplier")}
      description={t("social.mm.accountNo", { login: link.login })}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="ember" onClick={save} disabled={busy || !!err}>
            {busy && <Loader2 className="animate-spin" />} {t("common.save")}
          </Button>
        </>
      }
    >
      <Field label={pctMode ? t("social.mm.percent") : t("social.sizing.multiplier")} error={v.raw ? err : undefined}>
        <Input type="number" inputMode="decimal" min={0.01} step={pctMode ? 1 : 0.1} value={v.raw} onChange={(e) => v.setRaw(e.target.value)} trailing={pctMode ? "%" : "×"} inputClassName="k-num" />
      </Field>
      <p className="mt-3 text-[12.5px] text-fg-3">{t("social.mm.valueNote")}</p>
    </Dialog>
  );
}

function AllocationDialog({ a, onClose }: { a: Allocation | null; onClose: () => void }) {
  const t = useT();
  if (!a) return null;
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()} width={640} title={`${a.action === "order" ? t("social.mm.alloc.order") : a.action === "add" ? t("social.mm.alloc.add") : t("social.logAction.open")} #${a.masterTicket ?? ""} · ${a.symbol} ${t.dyn(`common.${a.side}`, a.side).toLowerCase()}`} description={`${serverTime(a.at)} · ${t("social.mm.alloc.block", { lots: lots(a.block) })} · ${METHOD_LABEL[a.method]}`}>
      <div className="space-y-1.5">
        {a.details.map((d) => (
          <div key={d.linkId} className="k-row flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-[12.5px]">
            <span className="w-[70px] font-mono">{String(d.login ?? "")}</span>
            <span className="k-num text-fg-3">{a.method === "equity" || a.method === "balance" ? `${(d.basis * 100).toFixed(2)}%` : valueText(a.method, d.value)}</span>
            <span className="k-num text-fg-3">{t("social.mm.alloc.exact", { value: d.raw.toFixed(4) })}</span>
            <span className="k-num font-medium">{t("social.lotsValue", { lots: lots(d.volume) })}</span>
            <span className="min-w-0 flex-1 truncate text-fg-3">{d.message || reasonText(d.reason)}</span>
            <Chip size="sm" tone={d.status === "done" ? "up" : d.status === "failed" ? "down" : "neutral"}>
              {t.dyn(`social.logStatus.${d.status}`, d.status)}
            </Chip>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

function Dashboard({ me, reload }: { me: ManagerMe; reload: () => void }) {
  const tt = useT();
  const m = me.manager!;
  const [edit, setEdit] = React.useState(false);
  const [value, setValue] = React.useState<LinkView | null>(null);
  const [alloc, setAlloc] = React.useState<Allocation | null>(null);
  const [showTerms, setShowTerms] = React.useState(false);
  const t = me.totals!;
  const perAccount = m.method === "multiplier" || m.method === "percent";

  const linkCols: Column<LinkView>[] = [
    { key: "a", header: tt("common.account"), cell: (l) => <span className="font-mono text-[12.5px]">{String(l.login)}</span> },
    { key: "s", header: tt("common.status"), cell: (l) => <StatusChip status={l.status} label={tt.dyn(`social.linkStatus.${l.status}`, l.status)} /> },
    { key: "since", header: tt("social.md.col.since"), cell: (l) => <span className="text-fg-2">{fmtDate(l.createdAt)}</span>, sort: (l) => l.createdAt, hideOn: "md" },
    { key: "e", header: tt("common.equity"), align: "right", cell: (l) => <span className="k-num">{usd(l.equity)}</span>, sort: (l) => l.equity },
    ...(perAccount ? [{ key: "v", header: m.method === "percent" ? tt("social.mm.percent") : tt("social.sizing.multiplier"), align: "right" as const, cell: (l: LinkView) => <span className="k-num">{valueText(m.method, l.allocValue)}</span> }] : []),
    { key: "ml", header: tt("social.maxLot"), align: "right", cell: (l) => <span className="k-num text-fg-2">{l.maxLot ?? "—"}</span>, hideOn: "sm" },
    { key: "r", header: tt("social.mam.result"), align: "right", cell: (l) => <span className={cn("k-num", tone(l.mamResult))}>{usd(l.mamResult, 2, true)}</span>, sort: (l) => l.mamResult },
    { key: "o", header: tt("social.col.open"), align: "right", cell: (l) => <span className="k-num">{l.mamPositions}</span>, hideOn: "sm" },
    { key: "f", header: tt("social.inv.kpi.feesPaid"), align: "right", cell: (l) => <span className="k-num text-fg-2">{usd(l.feesPaid)}</span>, hideOn: "lg" },
    ...(perAccount
      ? [
          {
            key: "x",
            header: "",
            align: "right" as const,
            cell: (l: LinkView) =>
              l.status === "active" ? (
                <Button size="xs" variant="surface" onClick={() => setValue(l)}>
                  <Pencil /> {tt("social.mm.set")}
                </Button>
              ) : null,
          },
        ]
      : []),
  ];
  const allocCols: Column<Allocation>[] = [
    { key: "at", header: tt("common.time"), cell: (a) => <span className="whitespace-nowrap text-fg-2">{serverTime(a.at, false)}</span>, sort: (a) => a.at },
    { key: "t", header: tt("social.mm.trade"), cell: (a) => <span>#{a.masterTicket} <span className="font-medium">{a.symbol}</span> <span className={a.side === "buy" ? "text-up" : "text-down"}>{tt.dyn(`common.${a.side}`, a.side).toLowerCase()}</span>{a.action !== "open" && <span className="text-fg-3"> · {tt.dyn(`social.logAction.${a.action}`, a.action).toLowerCase()}</span>}</span> },
    { key: "b", header: tt("social.mm.block"), align: "right", cell: (a) => <span className="k-num">{lots(a.block)}</span> },
    { key: "al", header: tt("social.mm.allocated"), align: "right", cell: (a) => <span className="k-num font-medium">{lots(a.allocated)}</span> },
    { key: "n", header: tt("common.accounts"), align: "right", cell: (a) => <span className="k-num text-fg-2">{a.accounts}/{a.details.length}</span>, hideOn: "sm" },
  ];
  const feeCols: Column<MamFee>[] = [
    { key: "at", header: tt("social.md.col.periodEnd"), cell: (f) => <span className="whitespace-nowrap text-fg-2">{fmtDate(f.periodEnd)}</span>, sort: (f) => f.periodEnd },
    { key: "a", header: tt("common.account"), cell: (f) => <span className="font-mono text-[12.5px]">{String(f.login)}</span> },
    { key: "p", header: tt("social.md.performance"), align: "right", cell: (f) => <span className="k-num text-fg-2">{usd(f.perfAmount ?? f.amount)}</span>, hideOn: "md" },
    { key: "m", header: tt("social.mm.management"), align: "right", cell: (f) => <span className="k-num text-fg-2">{usd(f.mgmtAmount ?? 0)}</span>, hideOn: "md" },
    { key: "y", header: tt("social.md.col.youReceive"), align: "right", cell: (f) => <span className="k-num font-medium">{usd(f.masterAmount)}</span>, sort: (f) => f.masterAmount },
    { key: "s", header: tt("common.status"), align: "right", cell: (f) => <Chip size="sm" tone={FEE_STATUS_TONE[f.status] ?? "neutral"}>{tt.dyn(`social.feeStatus.${f.status}`, f.status)}</Chip> },
  ];

  return (
    <>
      <Card className="mb-4">
        <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center">
          <span className="grid size-14 shrink-0 place-items-center rounded-[16px] border border-line bg-surface-2 text-fg-2 [&_svg]:size-6">
            <Briefcase />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[20px] font-medium tracking-tight">{m.name}</h2>
              <StatusChip status={m.status === "active" ? "active" : m.status === "frozen" ? "suspended" : "stopped"} label={m.status === "frozen" ? tt("social.mm.frozen") : tt.dyn(`social.managerStatus.${m.status}`, m.status)} />
              <Chip size="sm">{METHOD_LABEL[m.method]}</Chip>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fg-3">
              {m.login && (
                <span>
                  {tt("social.mm.masterAccount")} <span className="font-mono text-fg-2">#{m.login}</span>
                </span>
              )}
              <span>
                {tt("social.fees")} {m.perfFeePct}%{m.mgmtFeePct ? ` + ${m.mgmtFeePct}%/y` : ""} · {PERIOD_LABEL[m.feePeriod].toLowerCase()}
              </span>
              <span>{tt("social.mm.minEquityLine", { amount: usd(m.minEquity, 0) })}</span>
              <span>{tt("social.mm.sinceLine", { date: fmtDate(m.createdAt) })}</span>
            </div>
            {m.freezeReason && <div className="mt-1 text-[12.5px] text-down">{m.freezeReason}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="surface" onClick={() => setShowTerms(true)}>
              <FileText /> {tt("social.mm.terms")}
            </Button>
            <Button variant="surface" onClick={() => setEdit(true)}>
              <Pencil /> {tt("common.edit")}
            </Button>
            {m.login && <TradeButton a={{ login: m.login, status: "active" }} size="md" label={tt("social.mm.tradeMaster")} />}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={tt("social.mm.linkedAccounts")} icon={<Users />} value={<span className="k-num" data-testid="mam-accounts">{t.accounts}</span>} chip={METHOD_LABEL[m.method]} />
        <KpiCard label={tt("social.mm.kpi.equity")} icon={<Wallet />} value={<span className="k-num">{compactUsd(t.equity)}</span>} chip={tt("social.mm.kpi.equityChip")} />
        <KpiCard label={tt("social.mam.result")} icon={<Layers />} value={<span className={cn("k-num", tone(t.mamResult))}>{usd(t.mamResult, 2, true)}</span>} chip={tt("social.mm.kpi.resultChip")} />
        <KpiCard label={tt("social.fees")} icon={<Percent />} value={<Money value={t.feesPaid} countUp={false} />} chip={tt("social.mm.kpi.feesChip", { amount: usd(t.feesPending) })} chipTone={t.feesPending > 0 ? "warn" : "neutral"} />
      </div>

      <div className="mt-4">
        <PreviewCard m={m} />
      </div>

      <Card className="mt-4">
        <CardHeader title={tt("social.mm.linkedAccounts")} subtitle={tt("social.mm.linkedSub")} icon={<Users />} />
        <div className="px-4 pb-5 pt-4 sm:px-6">
          {me.links?.length ? (
            <DataTable columns={linkCols} rows={me.links} dense pageSize={10} rowKey={(l) => String(l.id)} />
          ) : (
            <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">{tt("social.mm.noLinks")}</div>
          )}
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title={tt("social.mm.audit")} subtitle={tt("social.mm.auditSub")} icon={<Clock />} />
        <div className="px-4 pb-5 pt-4 sm:px-6">
          {me.allocations?.length ? (
            <DataTable columns={allocCols} rows={me.allocations} dense pageSize={10} rowKey={(a) => String(a.id)} onRowClick={(a) => setAlloc(a)} />
          ) : (
            <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">{tt("social.mm.noBlocks")}</div>
          )}
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title={tt("social.fees")} subtitle={tt("social.md.perfFeesSub")} icon={<Percent />} />
        <div className="px-4 pb-5 pt-4 sm:px-6">
          {me.fees?.length ? (
            <DataTable columns={feeCols} rows={me.fees} dense pageSize={10} rowKey={(f) => String(f.id)} />
          ) : (
            <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">{tt("social.mam.noFees")}</div>
          )}
        </div>
      </Card>

      <Dialog open={edit} onOpenChange={setEdit} width={680} title={tt("social.mm.edit.title")} description={tt("social.mm.edit.description")}>
        <ProgrammeForm
          me={me}
          m={m}
          onCancel={() => setEdit(false)}
          onDone={() => {
            setEdit(false);
            reload();
          }}
        />
      </Dialog>
      <Dialog open={showTerms} onOpenChange={setShowTerms} width={640} title={tt("social.mm.termsTitle")} description={tt("social.mm.termsDesc")}>
        <div className="space-y-2 text-[12.5px] leading-relaxed text-fg-2">
          {(me.terms?.text ?? "").split(/(?=\d\. )/).map((p, i) => (
            <p key={i}>{p.trim()}</p>
          ))}
        </div>
      </Dialog>
      <ValueDialog m={m} link={value} onClose={() => setValue(null)} onSaved={reload} />
      <AllocationDialog a={alloc} onClose={() => setAlloc(null)} />
    </>
  );
}

export function LiveMamManagerPage() {
  const t = useT();
  const { data, error, loading, reload } = useSocial<ManagerMe>("mam/manager", 10000);
  const [creds, setCreds] = React.useState<Record<string, unknown> | null>(null);
  const approved = data?.master?.status === "approved";
  return (
    <div className="pb-24">
      <PageHeader title={t("social.mm.page.title")} subtitle={t("social.mm.page.subtitle")} />
      {error && !data ? (
        <SocialError onRetry={reload} message={error.message} title={t("social.mm.page.unavailable")} />
      ) : loading || !data ? (
        <BlockSkeleton n={3} h={140} />
      ) : data.manager ? (
        <Dashboard me={data} reload={reload} />
      ) : !approved ? (
        <Card>
          <div className="flex flex-col items-start gap-3 p-6">
            <div className="text-[15px] font-medium">{t("social.mm.page.approvedOnly")}</div>
            <p className="max-w-[640px] text-[13px] text-fg-3">
              {t("social.mm.page.approvedOnlyText")} {data.master ? t("social.mm.page.profileStatus", { status: t.dyn(`social.masterStatus.${data.master.status}`, data.master.status).toLowerCase() }) : t("social.mm.page.applyFirst")}
            </p>
            <Link href="/social/master">
              <Button variant="ember">{data.master ? t("social.md.title") : t("social.becomeMaster")}</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader title={t("social.mm.page.openTitle")} subtitle={t("social.mm.page.openSub", { name: data.master?.nickname ?? "" })} icon={<Plus />} />
          <div className="px-4 pb-6 pt-4 sm:px-6">
            <ProgrammeForm
              me={data}
              m={null}
              onDone={(c) => {
                if (c) setCreds(c);
                reload();
              }}
            />
          </div>
        </Card>
      )}
      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />
    </div>
  );
}
