"use client";

import * as React from "react";
import Link from "next/link";
import { Bitcoin, Eye, EyeOff, ImageUp, Inbox, Landmark, ListChecks, Loader2, Plus, RefreshCw, Save, ShieldAlert, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Chip, DataTable, Dialog, EmptyState, Field, Input, KpiCard, PageHeader, Segmented, Toggle, cn, type Column } from "@ezymex/ui";
import { ErrorState, TableSkeleton, ago, useNow, when } from "@/components/live/kit";
import { useCan } from "@/components/staff-session";
import { usd } from "./kit";
import {
  CHAIN_NAMES,
  EVM_PRESETS,
  KindChip,
  NETWORK_PRESETS,
  QrPreview,
  actorName,
  destinationLine,
  generatedQr,
  metamaskPossible,
  money,
  networkPreset,
  rateLines,
  type ManualKind,
  type MethodInput,
  type PaymentMethod,
} from "./manual-kit";
import { announceManualChange, deleteMethod, expectedCredit, saveMethod, uploadQr, useManualMethods } from "./manual-data";

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

const BANK_KEYS = ["account_name", "bank_name", "account_number", "ifsc", "swift", "iban", "branch", "upi_id"] as const;
type BankKey = (typeof BANK_KEYS)[number];

type Form = {
  kind: ManualKind;
  name: string;
  active: boolean;
  sort_order: string;
  currency: string;
  rate: string;
  min_amount: string;
  max_amount: string;
  bank: Record<BankKey, string>;
  network: string; // a preset or "other"
  network_custom: string;
  token: string;
  address: string;
  memo: string;
  mm: boolean;
  chain_id: string;
  token_contract: string;
  token_decimals: string;
  qr_media_id: string | null;
  qr_url: string | null;
  instructions: string;
};

const emptyBank = () => Object.fromEntries(BANK_KEYS.map((k) => [k, ""])) as Record<BankKey, string>;

function emptyForm(kind: ManualKind, sort: number): Form {
  return {
    kind,
    name: "",
    active: true,
    sort_order: String(sort),
    currency: kind === "crypto" ? "USDT" : "INR",
    rate: kind === "crypto" ? "1" : "",
    min_amount: "",
    max_amount: "",
    bank: emptyBank(),
    network: "TRC20",
    network_custom: "",
    token: "USDT",
    address: "",
    memo: "",
    mm: false,
    chain_id: "",
    token_contract: "",
    token_decimals: "",
    qr_media_id: null,
    qr_url: null,
    instructions: "",
  };
}

function fromMethod(m: PaymentMethod): Form {
  const d = m.details;
  const preset = networkPreset(d.network);
  return {
    kind: m.kind,
    name: m.name,
    active: m.status === "active",
    sort_order: String(m.sort_order),
    currency: m.currency,
    rate: m.rate,
    min_amount: Number(m.min_amount) ? m.min_amount : "",
    max_amount: m.max_amount ?? "",
    bank: { ...emptyBank(), ...Object.fromEntries(BANK_KEYS.map((k) => [k, d[k] ?? ""])) },
    network: m.kind === "crypto" ? (preset ?? "other") : "TRC20",
    network_custom: preset ? "" : (d.network ?? ""),
    token: d.token ?? "USDT",
    address: d.address ?? "",
    memo: d.memo ?? "",
    mm: !!m.evm,
    chain_id: m.evm ? String(m.evm.chain_id) : "",
    token_contract: m.evm?.token_contract ?? "",
    token_decimals: m.evm ? String(m.evm.token_decimals) : "",
    qr_media_id: m.qr_media_id,
    qr_url: m.qr_url,
    instructions: m.instructions ?? "",
  };
}

const networkOf = (f: Form) => (f.network === "other" ? f.network_custom.trim() : f.network);

function toInput(f: Form, version?: number): MethodInput {
  const t = (s: string) => s.trim();
  const crypto = f.kind === "crypto";
  const details: Record<string, string> = {};
  if (crypto) {
    details.network = networkOf(f);
    details.token = t(f.token).toUpperCase() || "USDT";
    details.address = t(f.address);
    if (t(f.memo)) details.memo = t(f.memo);
  } else {
    for (const k of BANK_KEYS) if (t(f.bank[k])) details[k] = ["ifsc", "swift", "iban"].includes(k) ? t(f.bank[k]).toUpperCase() : t(f.bank[k]);
  }
  const mm = crypto && f.mm && metamaskPossible(networkOf(f));
  return {
    kind: f.kind,
    name: t(f.name),
    status: f.active ? "active" : "hidden",
    sort_order: Number(f.sort_order) || 0,
    currency: t(f.currency).toUpperCase(),
    rate: t(f.currency).toUpperCase() === "USDT" ? "1" : t(f.rate),
    min_amount: t(f.min_amount) || "0",
    max_amount: t(f.max_amount) || null,
    details,
    evm: mm ? { chain_id: t(f.chain_id), token_contract: t(f.token_contract) || null, token_decimals: t(f.token_decimals) } : null,
    qr_media_id: f.qr_media_id,
    instructions: f.instructions.trim(),
    ...(version !== undefined ? { version } : {}),
  };
}

/** The MetaMask preset of a preset network (BEP20 → BNB Chain USDT, ERC20 → Ethereum, Polygon → Polygon). */
const networkChain = (network: string) => EVM_PRESETS.find((p) => p.network !== null && p.network === networkPreset(network));

/* ------------------------------------------------------------------ */
/* Small inputs                                                        */
/* ------------------------------------------------------------------ */

const control = "h-11 w-full rounded-[14px] border border-line bg-surface-2 px-3.5 text-sm text-fg outline-none transition-colors focus:border-ember/50 focus:ring-4 focus:ring-ember/10 disabled:opacity-60";

function Section({ title, hint, children, className }: { title: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3 border-t border-line pt-5 first:border-0 first:pt-0", className)}>
      <div>
        <div className="text-[13.5px] font-medium">{title}</div>
        {hint && <div className="mt-0.5 text-[12px] text-fg-3">{hint}</div>}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Editor drawer                                                       */
/* ------------------------------------------------------------------ */

type Target = { mode: "new" } | { mode: "edit"; id: number };

function MethodEditor({
  target,
  method,
  nextSort,
  networks,
  canEdit,
  onClose,
  onSaved,
}: {
  target: Target | null;
  method: PaymentMethod | null;
  nextSort: number;
  networks: string[];
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const now = useNow();
  const [orig, setOrig] = React.useState<PaymentMethod | null>(null);
  const [f, setF] = React.useState<Form>(() => emptyForm("bank", nextSort));
  const [errs, setErrs] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"save" | "status" | "delete" | "upload" | null>(null);
  const [mode, setMode] = React.useState<"delete" | null>(null);
  const [reason, setReason] = React.useState("");
  const [resync, setResync] = React.useState(false);
  const file = React.useRef<HTMLInputElement>(null);
  const openKey = target ? (target.mode === "new" ? "new" : `edit:${target.id}`) : null;

  // a fresh form each time the drawer opens on a method (or on "Add method")
  React.useEffect(() => {
    if (!openKey) return;
    setErrs({});
    setBanner(null);
    setMode(null);
    setReason("");
    setResync(false);
    if (openKey === "new") {
      setOrig(null);
      setF(emptyForm("bank", nextSort));
    } else if (method) {
      setOrig(method);
      setF(fromMethod(method));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey, method?.id]);

  // someone else saved in between: load their version once the list has it
  React.useEffect(() => {
    if (resync && method && orig && method.version !== orig.version) {
      setOrig(method);
      setF(fromMethod(method));
      setResync(false);
    }
  }, [resync, method, orig]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrs((e) => (e[k as string] ? { ...e, [k as string]: "" } : e));
  };
  const setBank = (k: BankKey, v: string) => {
    setF((x) => ({ ...x, bank: { ...x.bank, [k]: v } }));
    setErrs((e) => (e[k] ? { ...e, [k]: "" } : e));
  };

  const isNew = target?.mode === "new";
  const ro = !canEdit;
  const crypto = f.kind === "crypto";
  const net = networkOf(f);
  const usdt = f.currency.trim().toUpperCase() === "USDT";
  const lines = rateLines(usdt ? "1" : f.rate, f.currency);
  const qrValue = generatedQr(f.kind, crypto ? { network: net, token: f.token, address: f.address } : f.bank);
  const showMm = crypto && metamaskPossible(net);
  const minNum = Number(f.min_amount);
  const example = lines && minNum > 0 && Number(usdt ? 1 : f.rate) > 0 ? expectedCredit(f.min_amount.trim(), usdt ? "1" : f.rate.trim()) : null;
  const presetKey = EVM_PRESETS.find((p) => (p.chain_id === null ? !f.token_contract.trim() && !!f.chain_id : String(p.chain_id) === f.chain_id.trim() && p.token_contract.toLowerCase() === f.token_contract.trim().toLowerCase()))?.key;
  const chainName = CHAIN_NAMES[Number(f.chain_id)];

  // fills chain id / contract / decimals; everything stays editable ("native coin" keeps the chain id)
  const applyPreset = (key: string) => {
    const p = EVM_PRESETS.find((x) => x.key === key);
    if (!p) return;
    setF((x) => ({ ...x, chain_id: p.chain_id === null ? x.chain_id || networkChain(networkOf(x))?.chain_id?.toString() || "" : String(p.chain_id), token_contract: p.token_contract, token_decimals: String(p.token_decimals) }));
    setErrs((e) => ({ ...e, evm: "" }));
  };

  // switching MetaMask on starts from the preset of the network (BEP20 → BNB Chain USDT …)
  const toggleMm = (on: boolean) => {
    if (ro) return;
    setF((x) => {
      const p = networkChain(networkOf(x));
      if (!on || x.chain_id || !p) return { ...x, mm: on };
      return { ...x, mm: true, chain_id: String(p.chain_id), token_contract: p.token_contract, token_decimals: String(p.token_decimals) };
    });
  };

  const showError = (e: { code: string; message: string; field?: string }) => {
    if (e.code === "stale") {
      setBanner(`${e.message} The latest version is being loaded — check it and make your change again.`);
      setResync(true);
      onSaved();
      return;
    }
    const field = e.field === "details" ? undefined : e.field;
    if (field && FIELD_SHOWN.has(field)) setErrs((x) => ({ ...x, [field]: e.message }));
    else setBanner(e.message);
  };

  const save = async () => {
    setErrs({});
    setBanner(null);
    if (crypto && f.network === "other" && !f.network_custom.trim()) return setErrs({ network: "Enter the network name" });
    setBusy("save");
    const r = await saveMethod(toInput(f, orig?.version), orig?.id);
    setBusy(null);
    if (!r.ok) return showError(r.error);
    toast.success(isNew ? "Payment method added" : "Payment method saved", { description: `${r.data.method.name} · ${r.data.method.status === "active" ? "visible to clients" : "hidden from clients"}` });
    setOrig(r.data.method);
    setF(fromMethod(r.data.method));
    onSaved();
    announceManualChange();
    if (isNew) onClose();
  };

  const flipStatus = async () => {
    if (!orig) return;
    setBanner(null);
    setBusy("status");
    const next = orig.status === "active" ? "hidden" : "active";
    const r = await saveMethod({ ...toInput(fromMethod(orig), orig.version), status: next }, orig.id);
    setBusy(null);
    if (!r.ok) return showError(r.error);
    setOrig(r.data.method);
    setF((x) => ({ ...x, active: r.data.method.status === "active" }));
    toast.success(next === "hidden" ? "Method hidden" : "Method visible again", { description: next === "hidden" ? `Clients no longer see ${orig.name}.` : `${orig.name} is offered in the Client Area.` });
    onSaved();
  };

  const remove = async () => {
    if (!orig) return;
    setBusy("delete");
    const r = await deleteMethod(orig.id, reason.trim());
    setBusy(null);
    if (!r.ok) return setBanner(r.error.message);
    toast.success("Payment method deleted", { description: `${orig.name} · requests keep their copy of the details` });
    onSaved();
    announceManualChange();
    onClose();
  };

  const pick = async (fl: File | undefined) => {
    if (!fl) return;
    setBusy("upload");
    setErrs((e) => ({ ...e, qr_media_id: "" }));
    const r = await uploadQr(fl);
    setBusy(null);
    if (file.current) file.current.value = "";
    if (!r.ok) return setErrs((e) => ({ ...e, qr_media_id: r.error.message }));
    setF((x) => ({ ...x, qr_media_id: r.data.media.id, qr_url: r.data.media.url }));
    toast.success("QR image uploaded", { description: "Save the method to use it." });
  };

  const title = isNew ? "Add payment method" : orig ? orig.name : "Payment method";
  const description = isNew
    ? "A bank account, UPI ID or crypto address clients pay outside the platform."
    : orig
      ? `${orig.kind === "crypto" ? "Crypto" : "Bank / UPI"} · version ${orig.version} · updated ${ago(orig.updated_at, now)} by ${actorName(orig.updated_by)}`
      : undefined;

  return (
    <Dialog
      side="right"
      open={target !== null}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      description={description}
      footer={
        canEdit ? (
          <>
            {!isNew && orig && (
              <Button variant="down-outline" size="sm" disabled={!!busy} onClick={() => (setMode("delete"), setReason(""))} aria-label="Delete method">
                <Trash2 /> <span className="hidden sm:inline">Delete</span>
              </Button>
            )}
            {!isNew && orig && (
              <Button variant="surface" size="sm" disabled={!!busy} onClick={flipStatus}>
                {busy === "status" ? <Loader2 className="animate-spin" /> : orig.status === "active" ? <EyeOff /> : <Eye />} {orig.status === "active" ? "Hide" : "Show"}
              </Button>
            )}
            <Button variant="ember" size="sm" disabled={!!busy} onClick={save}>
              {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} {isNew ? "Add method" : "Save"}
            </Button>
          </>
        ) : undefined
      }
    >
      {!isNew && !orig ? (
        <TableSkeleton rows={5} />
      ) : (
        <div className="space-y-5">
          {ro && <div className="rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 text-[12.5px] text-fg-2">Read only: changing payment methods needs the finance.settings permission.</div>}
          {banner && <div className="rounded-[14px] border border-down/30 bg-down-soft px-3.5 py-2.5 text-[12.5px]">{banner}</div>}

          <Section title="Method">
            {isNew ? (
              <Segmented
                size="md"
                value={f.kind}
                onChange={(k) => setF((x) => ({ ...emptyForm(k, Number(x.sort_order) || nextSort), name: x.name, instructions: x.instructions, active: x.active }))}
                options={[
                  { value: "bank", label: <><Landmark className="size-3.5" /> Bank / UPI</> },
                  { value: "crypto", label: <><Bitcoin className="size-3.5" /> Crypto</> },
                ]}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-fg-3">
                <KindChip kind={f.kind} upi={!crypto && !!f.bank.upi_id && !f.bank.account_number} /> The kind is fixed once the method exists.
              </div>
            )}
            <Field label="Name" hint="Shown to clients" error={errs.name}>
              <Input value={f.name} disabled={ro} maxLength={60} onChange={(e) => set("name", e.target.value)} placeholder={crypto ? "USDT · TRC20" : "HDFC Bank · NEFT / IMPS"} aria-label="Name" />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Visible to clients" error={errs.status}>
                <label className="flex h-11 items-center gap-3 rounded-[14px] border border-line bg-surface-2 px-3.5 text-[13px]">
                  <Toggle checked={f.active} onChange={(v) => !ro && set("active", v)} label="Visible to clients" />
                  {f.active ? "Active" : "Hidden"}
                </label>
              </Field>
              <Field label="Sort order" hint="Lower comes first" error={errs.sort_order}>
                <Input type="number" value={f.sort_order} disabled={ro} onChange={(e) => set("sort_order", e.target.value)} aria-label="Sort order" />
              </Field>
            </div>
          </Section>

          <Section title="Currency & rate" hint="What the client pays in, and how much of it makes 1 USDT in their wallet.">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Currency" error={errs.currency}>
                <Input value={f.currency} disabled={ro} maxLength={10} onChange={(e) => (set("currency", e.target.value.toUpperCase()), e.target.value.toUpperCase() === "USDT" && set("rate", "1"))} placeholder="INR" inputClassName="uppercase" aria-label="Currency" />
              </Field>
              <Field label="Rate (per 1 USDT)" error={errs.rate}>
                <Input value={usdt ? "1" : f.rate} disabled={ro || usdt} inputMode="decimal" onChange={(e) => set("rate", e.target.value.replace(",", "."))} placeholder="88.00" trailing={<span className="text-[12px]">{f.currency || "…"}</span>} aria-label="Rate" />
              </Field>
            </div>
            <div className="k-row flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2.5 text-[12.5px]" data-testid="rate-preview">
              {lines ? (
                <>
                  <span className="k-num font-medium">{lines.fwd}</span>
                  {!usdt && <span className="k-num text-fg-3">{lines.rev}</span>}
                  {usdt && <span className="text-fg-3">USDT methods credit 1:1</span>}
                </>
              ) : (
                <span className="text-fg-3">Enter the rate to see the conversion.</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Minimum" error={errs.min_amount}>
                <Input value={f.min_amount} disabled={ro} inputMode="decimal" onChange={(e) => set("min_amount", e.target.value.replace(",", "."))} placeholder="0" trailing={<span className="text-[12px]">{f.currency}</span>} aria-label="Minimum amount" />
              </Field>
              <Field label="Maximum" hint="Optional" error={errs.max_amount}>
                <Input value={f.max_amount} disabled={ro} inputMode="decimal" onChange={(e) => set("max_amount", e.target.value.replace(",", "."))} placeholder="No limit" trailing={<span className="text-[12px]">{f.currency}</span>} aria-label="Maximum amount" />
              </Field>
            </div>
            {example && (
              <div className="text-[12px] text-fg-3">
                At the minimum, {money(f.min_amount, f.currency.toUpperCase())} credits <span className="k-num text-fg-2">{usd(example)} USDT</span>.
              </div>
            )}
          </Section>

          {crypto ? (
            <Section title="Receiving address" hint="Where clients send the coins.">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Network" error={errs.network}>
                  <select value={f.network} disabled={ro} onChange={(e) => set("network", e.target.value)} className={control} aria-label="Network">
                    {(networks.length ? networks : NETWORK_PRESETS).map((n) => (
                      <option key={n} value={n} className="bg-surface text-fg">
                        {n}
                      </option>
                    ))}
                    <option value="other" className="bg-surface text-fg">
                      Other…
                    </option>
                  </select>
                </Field>
                <Field label="Token" error={errs.token}>
                  <Input value={f.token} disabled={ro} maxLength={12} onChange={(e) => set("token", e.target.value.toUpperCase())} placeholder="USDT" inputClassName="uppercase" aria-label="Token" />
                </Field>
              </div>
              {f.network === "other" && (
                <Field label="Network name" hint="e.g. Arbitrum One, TON" error={errs.network}>
                  <Input value={f.network_custom} disabled={ro} maxLength={30} onChange={(e) => set("network_custom", e.target.value)} placeholder="Arbitrum One" aria-label="Network name" />
                </Field>
              )}
              <Field label="Address" error={errs.address}>
                <Input value={f.address} disabled={ro} maxLength={128} onChange={(e) => set("address", e.target.value.trim())} placeholder={networkPreset(net) === "TRC20" ? "T…" : networkPreset(net) === "BTC" ? "bc1…" : "0x…"} inputClassName="font-mono text-[11px] sm:text-[12.5px]" aria-label="Receiving address" />
              </Field>
              <Field label="Memo / tag" hint="Only if the network needs one" error={errs.memo}>
                <Input value={f.memo} disabled={ro} maxLength={64} onChange={(e) => set("memo", e.target.value)} placeholder="—" aria-label="Memo or tag" />
              </Field>
            </Section>
          ) : (
            <Section title="Bank details" hint="Fill the account, a UPI ID, or both. Clients see every filled field.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Account holder" error={errs.account_name}>
                  <Input value={f.bank.account_name} disabled={ro} maxLength={120} onChange={(e) => setBank("account_name", e.target.value)} placeholder="Legal name on the account" aria-label="Account holder" />
                </Field>
                <Field label="Bank" error={errs.bank_name}>
                  <Input value={f.bank.bank_name} disabled={ro} maxLength={120} onChange={(e) => setBank("bank_name", e.target.value)} placeholder="Optional" aria-label="Bank" />
                </Field>
                <Field label="Account number" error={errs.account_number}>
                  <Input value={f.bank.account_number} disabled={ro} maxLength={40} onChange={(e) => setBank("account_number", e.target.value)} inputClassName="font-mono text-[12.5px]" aria-label="Account number" />
                </Field>
                <Field label="IFSC" error={errs.ifsc}>
                  <Input value={f.bank.ifsc} disabled={ro} maxLength={11} onChange={(e) => setBank("ifsc", e.target.value.toUpperCase())} placeholder="11 characters" inputClassName="font-mono text-[12.5px] uppercase" aria-label="IFSC" />
                </Field>
                <Field label="SWIFT / BIC" error={errs.swift}>
                  <Input value={f.bank.swift} disabled={ro} maxLength={11} onChange={(e) => setBank("swift", e.target.value.toUpperCase())} placeholder="8 or 11 characters" inputClassName="font-mono text-[12.5px] uppercase" aria-label="SWIFT / BIC" />
                </Field>
                <Field label="IBAN" error={errs.iban}>
                  <Input value={f.bank.iban} disabled={ro} maxLength={50} onChange={(e) => setBank("iban", e.target.value.toUpperCase())} placeholder="Optional" inputClassName="font-mono text-[12.5px] uppercase" aria-label="IBAN" />
                </Field>
                <Field label="Branch" error={errs.branch}>
                  <Input value={f.bank.branch} disabled={ro} maxLength={120} onChange={(e) => setBank("branch", e.target.value)} aria-label="Branch" />
                </Field>
                <Field label="UPI ID" error={errs.upi_id}>
                  <Input value={f.bank.upi_id} disabled={ro} maxLength={120} onChange={(e) => setBank("upi_id", e.target.value.trim())} placeholder="name@bank" inputClassName="font-mono text-[12.5px]" aria-label="UPI ID" />
                </Field>
              </div>
            </Section>
          )}

          <Section title="QR code" hint={f.qr_media_id ? "Clients scan the uploaded image." : crypto ? "Without an upload, the Client Area shows a QR of the address." : "Without an upload, the Client Area shows a UPI QR when a UPI ID is set."}>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <QrPreview src={f.qr_url} value={qrValue} size={128} />
              <div className="w-full min-w-0 space-y-2 text-[12.5px] text-fg-3">
                {!f.qr_media_id && qrValue && <div className="break-all font-mono text-[11.5px] text-fg-2">{qrValue}</div>}
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} aria-label="QR image file" />
                    <Button variant="surface" size="sm" disabled={!!busy} onClick={() => file.current?.click()}>
                      {busy === "upload" ? <Loader2 className="animate-spin" /> : <ImageUp />} {f.qr_media_id ? "Replace image" : "Upload image"}
                    </Button>
                    {f.qr_media_id && (
                      <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => setF((x) => ({ ...x, qr_media_id: null, qr_url: null }))}>
                        <X /> Remove
                      </Button>
                    )}
                  </div>
                )}
                <div>PNG, JPG or WEBP up to 5 MB.</div>
                {errs.qr_media_id && <div className="text-down">{errs.qr_media_id}</div>}
              </div>
            </div>
          </Section>

          {showMm && (
            <Section title="MetaMask payment" hint="Clients on an EVM network can pay in one click; the transaction hash becomes the reference and the request still waits for approval.">
              <label className="flex items-center gap-3 text-[13px]">
                <Toggle checked={f.mm} onChange={toggleMm} label="Offer Pay with MetaMask" /> Offer “Pay with MetaMask”
              </label>
              {f.mm && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {EVM_PRESETS.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        disabled={ro}
                        onClick={() => applyPreset(p.key)}
                        className={cn("h-8 rounded-full border px-3 text-[12px] font-medium transition-colors disabled:opacity-60", presetKey === p.key ? "border-ember/50 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2 hover:text-fg")}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Chain ID" hint={chainName} error={undefined}>
                      <Input value={f.chain_id} disabled={ro} inputMode="numeric" onChange={(e) => set("chain_id", e.target.value.replace(/\D/g, ""))} placeholder="56" aria-label="Chain ID" />
                    </Field>
                    <Field label="Token decimals">
                      <Input value={f.token_decimals} disabled={ro} inputMode="numeric" onChange={(e) => set("token_decimals", e.target.value.replace(/\D/g, ""))} placeholder="18" aria-label="Token decimals" />
                    </Field>
                  </div>
                  <Field label="Token contract" hint="Empty = the native coin">
                    <Input value={f.token_contract} disabled={ro} maxLength={42} onChange={(e) => set("token_contract", e.target.value.trim())} placeholder="0x…" inputClassName="font-mono text-[11px] sm:text-[12px]" aria-label="Token contract" />
                  </Field>
                  {errs.evm && <div className="text-xs text-down">{errs.evm}</div>}
                </div>
              )}
            </Section>
          )}

          {crypto && (
            <div className="flex gap-2 rounded-[14px] border border-warn/35 bg-warn-soft px-3.5 py-2.5 text-[12.5px]" data-testid="address-warning">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" />
              Double-check the receiving address and the token contract before saving — payments sent to a wrong address can&apos;t be recovered.
            </div>
          )}

          <Section title="Instructions" hint="Shown to the client next to the details (optional).">
            <textarea
              value={f.instructions}
              disabled={ro}
              maxLength={2000}
              rows={3}
              onChange={(e) => set("instructions", e.target.value)}
              placeholder={crypto ? "Send only on this network. Paste the transaction hash after paying." : "Pay from an account in your own name and enter the UTR / transaction ID."}
              className="w-full resize-y rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-fg outline-none placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10 disabled:opacity-60"
              aria-label="Instructions"
            />
          </Section>

          {mode === "delete" && orig && (
            <div className="space-y-3 rounded-[16px] border border-line bg-surface-2 p-4">
              <div className="text-[13.5px] font-medium">Delete {orig.name}?</div>
              <p className="text-[12.5px] text-fg-3">
                Clients stop seeing it at once and it leaves this list for good. Requests already sent keep a copy of the details{orig.pending ? `; ${orig.pending} pending request${orig.pending === 1 ? "" : "s"} stay in the queue` : ""}.
              </p>
              <Field label="Reason" hint="Kept in the audit log">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Account closed" aria-label="Reason" />
              </Field>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setMode(null)}>
                  Cancel
                </Button>
                <Button variant="down-outline" disabled={busy === "delete" || reason.trim().length < 3} onClick={remove}>
                  {busy === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete method
                </Button>
              </div>
            </div>
          )}

          {orig && (
            <div className="text-[11.5px] text-fg-3">
              Created {when(orig.created_at)} by {actorName(orig.created_by)} · last saved {when(orig.updated_at)} by {actorName(orig.updated_by)}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

/** Service fields with an input in the editor (any other error shows at the top of the form). */
const FIELD_SHOWN = new Set(["name", "status", "sort_order", "currency", "rate", "min_amount", "max_amount", "account_name", "bank_name", "account_number", "ifsc", "swift", "iban", "branch", "upi_id", "network", "token", "address", "memo", "evm", "qr_media_id"]);

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LivePaymentMethodsPage() {
  const now = useNow();
  const canEdit = useCan("finance.settings");
  const { data, error, loading, reload } = useManualMethods();
  const [target, setTarget] = React.useState<Target | null>(null);
  const methods = data?.methods ?? [];
  const editing = target?.mode === "edit" ? (methods.find((m) => m.id === target.id) ?? null) : null;
  const nextSort = (methods.reduce((mx, m) => Math.max(mx, m.sort_order), 0) || 0) + 10;
  const active = methods.filter((m) => m.status === "active");

  const cols: Column<PaymentMethod>[] = [
    { key: "o", header: "#", hideOn: "sm", cell: (r) => <span className="k-num font-mono text-[12px] text-fg-3">{r.sort_order}</span> },
    {
      key: "n",
      header: "Method",
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <KindChip kind={r.kind} upi={r.kind === "bank" && !!r.details.upi_id && !r.details.account_number} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium">{r.name}</div>
            <div className="max-w-[260px] truncate font-mono text-[11px] text-fg-3">{destinationLine(r)}</div>
          </div>
          {r.evm && (
            <Chip size="sm" tone="ember" className="hidden md:inline-flex">
              MetaMask
            </Chip>
          )}
        </div>
      ),
    },
    {
      key: "r",
      header: "Currency & rate",
      cell: (r) => {
        const l = rateLines(r.rate, r.currency);
        return (
          <div className="whitespace-nowrap">
            <div className="text-[13px] font-medium">{r.currency}</div>
            <div className="k-num text-[11.5px] text-fg-3">{r.currency === "USDT" ? "1:1" : l?.fwd}</div>
          </div>
        );
      },
    },
    {
      key: "l",
      header: "Limits",
      hideOn: "md",
      cell: (r) => (
        <span className="k-num whitespace-nowrap text-[12px] text-fg-2">
          {Number(r.min_amount) ? money(r.min_amount) : "0"} – {r.max_amount ? money(r.max_amount) : "no max"} <span className="text-fg-3">{r.currency}</span>
        </span>
      ),
    },
    { key: "s", header: "Status", cell: (r) => (r.status === "active" ? <Chip size="sm" tone="up" dot>Active</Chip> : <Chip size="sm" dot>Hidden</Chip>) },
    {
      key: "p",
      header: "Pending",
      align: "right",
      cell: (r) =>
        r.pending ? (
          <Link href={`/finance/manual-deposits?method_id=${r.id}`} onClick={(e) => e.stopPropagation()} className="k-num inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-medium text-ember hover:underline">
            {r.pending} pending
          </Link>
        ) : (
          <span className="text-[12px] text-fg-3">—</span>
        ),
    },
    {
      key: "u",
      header: "Updated",
      align: "right",
      hideOn: "lg",
      cell: (r) => (
        <span className="whitespace-nowrap text-[11.5px] text-fg-3" title={when(r.updated_at)}>
          {ago(r.updated_at, now)} · {actorName(r.updated_by)}
        </span>
      ),
    },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Payment methods"
        subtitle="Bank accounts, UPI IDs and crypto addresses clients pay outside the platform. Each payment comes back as a request in Manual deposits, credited only after approval."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="surface" size="lg" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
            {canEdit && (
              <Button variant="ember" size="lg" onClick={() => setTarget({ mode: "new" })}>
                <Plus /> Add method
              </Button>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Active methods" icon={<ListChecks />} value={<span className="k-num">{data ? active.length : "—"}</span>} chip={data ? `${methods.length - active.length} hidden` : "—"} />
        <KpiCard label="Bank & UPI" icon={<Landmark />} value={<span className="k-num">{data ? methods.filter((m) => m.kind === "bank").length : "—"}</span>} chip={data ? `${active.filter((m) => m.kind === "bank").length} active` : "—"} delay={0.04} />
        <KpiCard label="Crypto" icon={<Bitcoin />} value={<span className="k-num">{data ? methods.filter((m) => m.kind === "crypto").length : "—"}</span>} chip={data ? `${methods.filter((m) => m.evm).length} with MetaMask` : "—"} delay={0.08} />
        <KpiCard label="Pending requests" icon={<Inbox />} value={<span className="k-num">{data?.counts.pending ?? "—"}</span>} chip="Manual deposits" chipTone={data?.counts.pending ? "warn" : "neutral"} href="/finance/manual-deposits" delay={0.12} />
      </div>
      <Card className="mt-4 px-4 py-5 sm:px-6">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : !data ? (
          <TableSkeleton />
        ) : (
          <div className={loading ? "opacity-90" : undefined}>
            <DataTable
              columns={cols}
              rows={methods}
              dense
              pageSize={100}
              rowKey={(r) => String(r.id)}
              onRowClick={(r) => setTarget({ mode: "edit", id: r.id })}
              empty={
                <EmptyState
                  title="No payment methods yet"
                  text="Add a bank account, a UPI ID or a crypto address. Clients see the active ones under Deposit in the Client Area."
                  illustration="bank"
                  action={
                    canEdit ? (
                      <Button variant="ember" onClick={() => setTarget({ mode: "new" })}>
                        <Plus /> Add method
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
          </div>
        )}
      </Card>
      <MethodEditor target={target} method={editing} nextSort={nextSort} networks={data?.networks ?? []} canEdit={canEdit} onClose={() => setTarget(null)} onSaved={reload} />
    </div>
  );
}
