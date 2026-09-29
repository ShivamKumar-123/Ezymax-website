"use client";

// Client Area → Social → MAM manager: an approved master opens a MAM programme (a dedicated MAM master account),
// sees the linked accounts, sets per-account multipliers / percents, previews how a block is allocated and
// reviews every allocation and fee.

import * as React from "react";
import Link from "next/link";
import { Briefcase, Calculator, Clock, FileText, Layers, Loader2, Pencil, Percent, Plus, ShieldAlert, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, Field, Input, KpiCard, Money, PageHeader, Segmented, StatusChip, cn, type Column } from "@kalks/ui";
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
      ? "Enter a programme name (3–60 characters)"
      : perf.value === null || perf.value < s.feeMinPct || perf.value > s.feeMaxPct
        ? `The performance fee must be between ${s.feeMinPct}% and ${s.feeMaxPct}%`
        : mgmt.value !== null && (mgmt.value < 0 || mgmt.value > s.mgmtMaxPct)
          ? `The management fee must be between 0% and ${s.mgmtMaxPct}% a year`
          : seed.raw && !(seed.value! > 0)
            ? "Enter a funding amount above zero"
            : undefined;

  const submit = async () => {
    if (err) return toast.error(err);
    setBusy(true);
    try {
      const body = { name: name.trim(), description: description.trim(), method, perfFeePct: perf.value, mgmtFeePct: mgmt.value ?? 0, feePeriod: period, minEquity: minEquity.value ?? 0 };
      if (m) {
        const { method: _m, ...rest } = body;
        await socialApi("mam/manager", { method: "PATCH", body: locked ? rest : body });
        toast.success("Programme updated", { description: "Fee changes apply to accounts linked from now on; existing links keep the terms they accepted." });
        onDone();
      } else {
        const r = await socialApi<{ credentials: Record<string, unknown> }>("mam/manager", { body: seed.value ? { ...body, seed: seed.value } : body });
        toast.success("MAM programme opened");
        onDone(r.credentials);
      }
    } catch (e) {
      toast.error(m ? "Couldn't update the programme" : "Couldn't open the programme", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Programme name">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Gold Momentum MAM" />
        </Field>
        <Field label="Minimum account equity" hint="To link an account">
          <Input type="number" inputMode="decimal" min={0} value={minEquity.raw} onChange={(e) => minEquity.setRaw(e.target.value)} leading="$" inputClassName="k-num" />
        </Field>
      </div>
      <Field label="Description" hint="Shown to clients">
        <textarea className={textareaCls} rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Strategy, markets, typical holding time, risk approach" />
      </Field>
      <div>
        <div className="mb-2 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
          Allocation method {locked && <span className="font-normal text-fg-3">Fixed while accounts are linked</span>}
        </div>
        <div role="radiogroup" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {METHODS.map((k) => (
            <RadioCard key={k} selected={method === k} onSelect={() => !locked && setMethod(k)} title={METHOD_LABEL[k]} text={METHOD_HINT[k]} className={cn("p-3", locked && method !== k && "opacity-50")} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Performance fee" hint={`${s.feeMinPct}–${s.feeMaxPct}%`}>
          <Input type="number" inputMode="decimal" min={s.feeMinPct} max={s.feeMaxPct} value={perf.raw} onChange={(e) => perf.setRaw(e.target.value)} trailing="%" inputClassName="k-num" />
        </Field>
        <Field label="Management fee" hint={`0–${s.mgmtMaxPct}% a year`}>
          <Input type="number" inputMode="decimal" min={0} max={s.mgmtMaxPct} step={0.1} value={mgmt.raw} onChange={(e) => mgmt.setRaw(e.target.value)} trailing="%/y" inputClassName="k-num" />
        </Field>
        <Field label="Fee period">
          <Segmented size="sm" value={period} onChange={(v) => setPeriod(v as FeePeriod)} options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
        </Field>
      </div>
      {!m && (
        <Field label="Fund the MAM master account from your wallet" hint="Optional">
          <Input type="number" inputMode="decimal" min={0} placeholder="0.00" value={seed.raw} onChange={(e) => seed.setRaw(e.target.value)} leading="$" inputClassName="k-num" />
        </Field>
      )}
      <InfoBox>
        The performance fee is charged on new gains of the MAM trades on each linked account above its high-water mark; the management fee pro rata on the account&apos;s equity. Both are settled {PERIOD_LABEL[period].toLowerCase()}, debited from the client account and paid to your wallet after approval. The platform keeps {s.platformCutPct}%.
      </InfoBox>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
        <Button variant="ember" onClick={submit} disabled={busy || !!err} title={err}>
          {busy && <Loader2 className="animate-spin" />} {m ? "Save programme" : "Open MAM programme"}
        </Button>
      </div>
    </div>
  );
}

function CredentialsDialog({ creds, onClose }: { creds: Record<string, unknown> | null; onClose: () => void }) {
  if (!creds) return null;
  const funding = creds.funding as { status?: string; message?: string } | null;
  return (
    <Dialog open={!!creds} onOpenChange={(o) => !o && onClose()} title="Your MAM master account" description="Save the password now: it is shown only once." footer={<Button variant="ember" onClick={onClose}>Done</Button>}>
      <div className="space-y-3">
        <SecretField label="Login" value={String(creds.login ?? "")} />
        <SecretField label="Trading password" value={String(creds.password ?? "")} secret />
        <SecretField label="Investor (read-only) password" value={String(creds.investorPassword ?? "")} secret />
        {funding?.status === "failed" && (
          <InfoBox tone="warn" icon={<ShieldAlert />}>
            {funding.message}
          </InfoBox>
        )}
        <p className="text-[12.5px] text-fg-3">Every trade you open on this account is allocated to the linked client accounts. You can also open it from here with one click.</p>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

function PreviewCard({ m }: { m: ManagerView }) {
  const [symbol, setSymbol] = React.useState("EURUSD");
  const volume = useNumber(1);
  const [q, setQ] = React.useState("symbol=EURUSD&volume=1");
  const { data, error } = useSocial<Preview>(`mam/manager/preview?${q}`);
  const apply = () => {
    const s = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9._]{2,20}$/.test(s) || !(volume.value! > 0)) return toast.error("Enter a symbol and a volume above zero");
    setQ(`symbol=${s}&volume=${volume.value}`);
  };
  const cols: Column<Preview["rows"][number]>[] = [
    { key: "a", header: "Account", cell: (r) => <span className="font-mono text-[12.5px]">{r.account}</span> },
    { key: "e", header: m.method === "balance" ? "Balance" : "Equity", align: "right", cell: (r) => <span className="k-num text-fg-2">{usd(m.method === "balance" ? r.balance : r.equity)}</span> },
    { key: "b", header: m.method === "equity" || m.method === "balance" ? "Share" : "Value", align: "right", cell: (r) => <span className="k-num text-fg-2">{m.method === "equity" || m.method === "balance" ? `${(r.basis * 100).toFixed(2)}%` : valueText(m.method, r.value)}</span> },
    { key: "r", header: "Exact", align: "right", cell: (r) => <span className="k-num text-fg-3">{r.raw.toFixed(4)}</span>, hideOn: "sm" },
    { key: "v", header: "Lots", align: "right", cell: (r) => <span className="k-num font-medium">{lots(r.volume)}</span> },
    { key: "n", header: "Note", align: "right", cell: (r) => <span className="text-[12px] text-fg-3">{reasonText(r.reason)}</span>, hideOn: "md" },
  ];
  return (
    <Card>
      <CardHeader title="Allocation preview" subtitle={`${METHOD_LABEL[m.method]} · rounded down to the lot step, below-minimum skipped`} icon={<Calculator />} />
      <div className="px-4 pb-5 pt-4 sm:px-6">
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <Field label="Symbol" className="w-[140px]">
            <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} maxLength={20} inputClassName="font-mono" />
          </Field>
          <Field label="Block" className="w-[130px]">
            <Input type="number" inputMode="decimal" min={0.01} step={0.01} value={volume.raw} onChange={(e) => volume.setRaw(e.target.value)} trailing="lots" inputClassName="k-num" />
          </Field>
          <Button variant="surface" onClick={apply}>
            Preview
          </Button>
        </div>
        {error && !data ? (
          <div className="k-row px-4 py-5 text-center text-[13px] text-fg-3">{error.message}</div>
        ) : !data ? (
          <BlockSkeleton n={1} h={80} />
        ) : data.rows.length === 0 ? (
          <div className="k-row px-4 py-6 text-center text-[13px] text-fg-3">No linked accounts yet: a block would not be allocated anywhere.</div>
        ) : (
          <>
            <DataTable columns={cols} rows={data.rows} dense pageSize={10} rowKey={(r) => String(r.linkId)} />
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-fg-3">
              <span>
                Block <span className="k-num text-fg-2">{lots(data.block)}</span> {data.symbol}
              </span>
              <span>
                Allocated <span className="k-num text-fg">{lots(data.allocated)}</span>
              </span>
              {(m.method === "equity" || m.method === "balance") && (
                <span>
                  Left by rounding <span className="k-num text-fg-2">{lots(data.unallocated)}</span>
                </span>
              )}
              <span>
                Lot step {data.lotStep} · min {data.lotMin}
              </span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function ValueDialog({ m, link, onClose, onSaved }: { m: ManagerView; link: LinkView | null; onClose: () => void; onSaved: () => void }) {
  const v = useNumber(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (link) v.set(link.allocValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link?.id]);
  if (!link) return null;
  const pctMode = m.method === "percent";
  const err = v.value === null || v.value < 0.01 || v.value > (pctMode ? 1000 : 100) ? (pctMode ? "Percent must be between 0.01 and 1000" : "Multiplier must be between 0.01 and 100") : undefined;
  const save = async () => {
    setBusy(true);
    try {
      await socialApi(`mam/manager/links/${link.id}`, { method: "PATCH", body: { value: v.value } });
      toast.success("Allocation updated", { description: `Account ${link.login} now trades ${pctMode ? `${v.value}% of` : `${v.value}× `} each block.` });
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Couldn't update", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={!!link}
      onOpenChange={(o) => !o && onClose()}
      title={pctMode ? "Percent of each block" : "Multiplier"}
      description={`Account ${link.login}`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="ember" onClick={save} disabled={busy || !!err}>
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </>
      }
    >
      <Field label={pctMode ? "Percent" : "Multiplier"} error={v.raw ? err : undefined}>
        <Input type="number" inputMode="decimal" min={0.01} step={pctMode ? 1 : 0.1} value={v.raw} onChange={(e) => v.setRaw(e.target.value)} trailing={pctMode ? "%" : "×"} inputClassName="k-num" />
      </Field>
      <p className="mt-3 text-[12.5px] text-fg-3">Applies to the next blocks. The client&apos;s own max lot still caps every trade.</p>
    </Dialog>
  );
}

function AllocationDialog({ a, onClose }: { a: Allocation | null; onClose: () => void }) {
  if (!a) return null;
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()} width={640} title={`${a.action === "order" ? "Pending order" : a.action === "add" ? "Volume added" : "Open"} #${a.masterTicket ?? ""} · ${a.symbol} ${a.side}`} description={`${serverTime(a.at)} · block ${lots(a.block)} · ${METHOD_LABEL[a.method]}`}>
      <div className="space-y-1.5">
        {a.details.map((d) => (
          <div key={d.linkId} className="k-row flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-[12.5px]">
            <span className="w-[70px] font-mono">{String(d.login ?? "")}</span>
            <span className="k-num text-fg-3">{a.method === "equity" || a.method === "balance" ? `${(d.basis * 100).toFixed(2)}%` : valueText(a.method, d.value)}</span>
            <span className="k-num text-fg-3">exact {d.raw.toFixed(4)}</span>
            <span className="k-num font-medium">{lots(d.volume)} lots</span>
            <span className="min-w-0 flex-1 truncate text-fg-3">{d.message || reasonText(d.reason)}</span>
            <Chip size="sm" tone={d.status === "done" ? "up" : d.status === "failed" ? "down" : "neutral"}>
              {d.status}
            </Chip>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

function Dashboard({ me, reload }: { me: ManagerMe; reload: () => void }) {
  const m = me.manager!;
  const [edit, setEdit] = React.useState(false);
  const [value, setValue] = React.useState<LinkView | null>(null);
  const [alloc, setAlloc] = React.useState<Allocation | null>(null);
  const [showTerms, setShowTerms] = React.useState(false);
  const t = me.totals!;
  const perAccount = m.method === "multiplier" || m.method === "percent";

  const linkCols: Column<LinkView>[] = [
    { key: "a", header: "Account", cell: (l) => <span className="font-mono text-[12.5px]">{String(l.login)}</span> },
    { key: "s", header: "Status", cell: (l) => <StatusChip status={l.status} /> },
    { key: "since", header: "Since", cell: (l) => <span className="text-fg-2">{fmtDate(l.createdAt)}</span>, sort: (l) => l.createdAt, hideOn: "md" },
    { key: "e", header: "Equity", align: "right", cell: (l) => <span className="k-num">{usd(l.equity)}</span>, sort: (l) => l.equity },
    ...(perAccount ? [{ key: "v", header: m.method === "percent" ? "Percent" : "Multiplier", align: "right" as const, cell: (l: LinkView) => <span className="k-num">{valueText(m.method, l.allocValue)}</span> }] : []),
    { key: "ml", header: "Max lot", align: "right", cell: (l) => <span className="k-num text-fg-2">{l.maxLot ?? "—"}</span>, hideOn: "sm" },
    { key: "r", header: "MAM result", align: "right", cell: (l) => <span className={cn("k-num", tone(l.mamResult))}>{usd(l.mamResult, 2, true)}</span>, sort: (l) => l.mamResult },
    { key: "o", header: "Open", align: "right", cell: (l) => <span className="k-num">{l.mamPositions}</span>, hideOn: "sm" },
    { key: "f", header: "Fees paid", align: "right", cell: (l) => <span className="k-num text-fg-2">{usd(l.feesPaid)}</span>, hideOn: "lg" },
    ...(perAccount
      ? [
          {
            key: "x",
            header: "",
            align: "right" as const,
            cell: (l: LinkView) =>
              l.status === "active" ? (
                <Button size="xs" variant="surface" onClick={() => setValue(l)}>
                  <Pencil /> Set
                </Button>
              ) : null,
          },
        ]
      : []),
  ];
  const allocCols: Column<Allocation>[] = [
    { key: "at", header: "Time", cell: (a) => <span className="whitespace-nowrap text-fg-2">{serverTime(a.at, false)}</span>, sort: (a) => a.at },
    { key: "t", header: "Trade", cell: (a) => <span>#{a.masterTicket} <span className="font-medium">{a.symbol}</span> <span className={a.side === "buy" ? "text-up" : "text-down"}>{a.side}</span>{a.action !== "open" && <span className="text-fg-3"> · {a.action}</span>}</span> },
    { key: "b", header: "Block", align: "right", cell: (a) => <span className="k-num">{lots(a.block)}</span> },
    { key: "al", header: "Allocated", align: "right", cell: (a) => <span className="k-num font-medium">{lots(a.allocated)}</span> },
    { key: "n", header: "Accounts", align: "right", cell: (a) => <span className="k-num text-fg-2">{a.accounts}/{a.details.length}</span>, hideOn: "sm" },
  ];
  const feeCols: Column<MamFee>[] = [
    { key: "at", header: "Period end", cell: (f) => <span className="whitespace-nowrap text-fg-2">{fmtDate(f.periodEnd)}</span>, sort: (f) => f.periodEnd },
    { key: "a", header: "Account", cell: (f) => <span className="font-mono text-[12.5px]">{String(f.login)}</span> },
    { key: "p", header: "Performance", align: "right", cell: (f) => <span className="k-num text-fg-2">{usd(f.perfAmount ?? f.amount)}</span>, hideOn: "md" },
    { key: "m", header: "Management", align: "right", cell: (f) => <span className="k-num text-fg-2">{usd(f.mgmtAmount ?? 0)}</span>, hideOn: "md" },
    { key: "y", header: "You receive", align: "right", cell: (f) => <span className="k-num font-medium">{usd(f.masterAmount)}</span>, sort: (f) => f.masterAmount },
    { key: "s", header: "Status", align: "right", cell: (f) => <Chip size="sm" tone={FEE_STATUS_TONE[f.status] ?? "neutral"}>{f.status}</Chip> },
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
              <StatusChip status={m.status === "active" ? "active" : m.status === "frozen" ? "suspended" : "stopped"} label={m.status === "frozen" ? "Frozen by the risk team" : undefined} />
              <Chip size="sm">{METHOD_LABEL[m.method]}</Chip>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fg-3">
              {m.login && (
                <span>
                  MAM master account <span className="font-mono text-fg-2">#{m.login}</span>
                </span>
              )}
              <span>
                Fees {m.perfFeePct}%{m.mgmtFeePct ? ` + ${m.mgmtFeePct}%/y` : ""} · {PERIOD_LABEL[m.feePeriod].toLowerCase()}
              </span>
              <span>Min equity {usd(m.minEquity, 0)}</span>
              <span>Since {fmtDate(m.createdAt)}</span>
            </div>
            {m.freezeReason && <div className="mt-1 text-[12.5px] text-down">{m.freezeReason}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="surface" onClick={() => setShowTerms(true)}>
              <FileText /> Terms
            </Button>
            <Button variant="surface" onClick={() => setEdit(true)}>
              <Pencil /> Edit
            </Button>
            {m.login && <TradeButton a={{ login: m.login, status: "active" }} size="md" label="Trade the master account" />}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Linked accounts" icon={<Users />} value={<span className="k-num" data-testid="mam-accounts">{t.accounts}</span>} chip={METHOD_LABEL[m.method]} />
        <KpiCard label="Equity under management" icon={<Wallet />} value={<span className="k-num">{compactUsd(t.equity)}</span>} chip="Across linked accounts" />
        <KpiCard label="MAM result" icon={<Layers />} value={<span className={cn("k-num", tone(t.mamResult))}>{usd(t.mamResult, 2, true)}</span>} chip="Closed + floating" />
        <KpiCard label="Fees" icon={<Percent />} value={<Money value={t.feesPaid} countUp={false} />} chip={`${usd(t.feesPending)} pending approval`} chipTone={t.feesPending > 0 ? "warn" : "neutral"} />
      </div>

      <div className="mt-4">
        <PreviewCard m={m} />
      </div>

      <Card className="mt-4">
        <CardHeader title="Linked accounts" subtitle="Client accounts that follow your master account" icon={<Users />} />
        <div className="px-4 pb-5 pt-4 sm:px-6">
          {me.links?.length ? (
            <DataTable columns={linkCols} rows={me.links} dense pageSize={10} rowKey={(l) => String(l.id)} />
          ) : (
            <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">No accounts linked yet. Clients find your programme under Social → Managed accounts.</div>
          )}
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Allocation audit" subtitle="Every block on the master account and how it was split" icon={<Clock />} />
        <div className="px-4 pb-5 pt-4 sm:px-6">
          {me.allocations?.length ? (
            <DataTable columns={allocCols} rows={me.allocations} dense pageSize={10} rowKey={(a) => String(a.id)} onRowClick={(a) => setAlloc(a)} />
          ) : (
            <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">No blocks yet. Trade the master account in Kalks Trader; each opening trade is allocated to the linked accounts.</div>
          )}
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Fees" subtitle="Paid to your wallet after approval, minus the platform share" icon={<Percent />} />
        <div className="px-4 pb-5 pt-4 sm:px-6">
          {me.fees?.length ? (
            <DataTable columns={feeCols} rows={me.fees} dense pageSize={10} rowKey={(f) => String(f.id)} />
          ) : (
            <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">No fees yet. They are settled at the end of each fee period.</div>
          )}
        </div>
      </Card>

      <Dialog open={edit} onOpenChange={setEdit} width={680} title="Edit programme" description="Fee changes apply to accounts linked from now on.">
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
      <Dialog open={showTerms} onOpenChange={setShowTerms} width={640} title="Terms clients accept" description="Generated from your programme; any change creates a new version.">
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
  const { data, error, loading, reload } = useSocial<ManagerMe>("mam/manager", 10000);
  const [creds, setCreds] = React.useState<Record<string, unknown> | null>(null);
  const approved = data?.master?.status === "approved";
  return (
    <div className="pb-24">
      <PageHeader title="MAM manager" subtitle="Trade one master account; every opening trade is allocated across the client accounts linked to your programme." />
      {error && !data ? (
        <SocialError onRetry={reload} message={error.message} title="MAM is unavailable" />
      ) : loading || !data ? (
        <BlockSkeleton n={3} h={140} />
      ) : data.manager ? (
        <Dashboard me={data} reload={reload} />
      ) : !approved ? (
        <Card>
          <div className="flex flex-col items-start gap-3 p-6">
            <div className="text-[15px] font-medium">Approved masters only</div>
            <p className="max-w-[640px] text-[13px] text-fg-3">
              A MAM programme is run by an approved master: identity verified, a live track record and the broker&apos;s review. {data.master ? `Your master profile is ${data.master.status}.` : "Apply first; once approved you can open a programme here."}
            </p>
            <Link href="/social/master">
              <Button variant="ember">{data.master ? "Master dashboard" : "Become a master"}</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Open a MAM programme" subtitle={`As ${data.master?.nickname}. A dedicated MAM master account is opened for you.`} icon={<Plus />} />
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
