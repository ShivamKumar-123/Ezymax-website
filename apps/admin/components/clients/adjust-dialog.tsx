"use client";

/**
 * Balance & credit: add / deduct funds on a client's wallet or trading account, give / take credit on a trading
 * account. Two steps: the form, then a confirmation with the server's before → after (a dry run: nothing is
 * booked until "Confirm"). Every confirm carries one idempotency key, so a double click books once. Above the
 * tenant's four-eyes threshold the request waits for a second staff member (Finance → Adjustments).
 * Wallet service: POST /api/wallet/adjustments/preview, POST /api/wallet/adjustments.
 */
import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import { Button, Chip, Dialog, Input, Segmented, Skeleton, Toggle, cn } from "@ezymex/ui";
import { MiniField, Select, TextArea } from "@/components/config/kit";
import { sendJson, useApi, type ApiErr } from "@/components/live/kit";

export type AdjOp = "add" | "deduct" | "credit_in" | "credit_out";
export type AdjCategory = "deposit" | "withdrawal" | "correction" | "compensation" | "bonus" | "fee" | "chargeback" | "other";

export type TargetAccount = {
  login: number;
  type: "live" | "demo";
  group?: string;
  groupName?: string;
  currency: string;
  cent?: boolean;
  status?: string;
  balance: number | string;
  credit: number | string;
  equity?: number | string;
  freeMargin?: number | string;
  withdrawable?: number | string;
  marginLevel?: number | string | null;
};

export type Adjustment = {
  id: number;
  user_id: number;
  target: "wallet" | "trading";
  login: number | null;
  account_type: "live" | "demo" | null;
  currency: string;
  op: AdjOp;
  category: AdjCategory;
  category_label: string;
  amount: string;
  amount_usd: string;
  comment: string;
  client_note: string | null;
  notify: boolean;
  force: boolean;
  status: "pending" | "processing" | "applied" | "rejected" | "failed" | "cancelled";
  requested_by: { id: string; name: string; role: string };
  decided_by: { id: string; name: string | null } | null;
  decided_at: string | null;
  decision_note: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  txn_id: number | null;
  ledger_kind: string | null;
  error: { code: string; message: string | null } | null;
  created_at: string;
  applied_at: string | null;
  replayed?: boolean;
};

export type Targets = {
  user_id: number;
  wallet: { currency: string; available: string; locked: string }[];
  accounts: TargetAccount[];
  engine_available: boolean;
  open: Adjustment[];
  recent: Adjustment[];
  threshold_usd: string | null;
  can: { adjust: boolean; credit: boolean; approve: boolean; force: boolean };
};

type Preview = {
  ok: boolean;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  limits?: { max: number | string | null; maxForced: number | string | null };
  error?: ApiErr;
  needs_approval: boolean;
  threshold_usd: string | null;
  amount: string;
  amount_usd: string;
  currency: string;
  marginCall?: boolean;
  stopOut?: boolean;
};

export const OP_LABEL: Record<AdjOp, string> = { add: "Add funds", deduct: "Deduct funds", credit_in: "Give credit", credit_out: "Take credit" };
export const CATEGORY_LABEL: Record<AdjCategory, string> = {
  deposit: "Deposit (external payment received)",
  withdrawal: "Withdrawal (paid externally)",
  correction: "Correction",
  compensation: "Compensation",
  bonus: "Bonus",
  fee: "Fee",
  chargeback: "Chargeback",
  other: "Other",
};
const CATEGORIES: AdjCategory[] = ["deposit", "withdrawal", "correction", "compensation", "bonus", "fee", "chargeback", "other"];

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
/** 2-decimal money with thousands separators; "—" for missing values. */
export function fmt(v: unknown, ccy?: string) {
  const n = num(v);
  if (n === null || !Number.isFinite(n)) return "—";
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  return `${n < 0 ? "−" : ""}${s}${ccy ? ` ${ccy}` : ""}`;
}
export const signedOf = (op: AdjOp) => (op === "add" || op === "credit_in" ? 1 : -1);

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `adj-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export type AdjustPreset = { target: "wallet" } | { target: "trading"; login: number };

export function AdjustDialog({
  open,
  onOpenChange,
  userId,
  clientName,
  preset,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: number | null;
  clientName?: string;
  preset?: AdjustPreset;
  onDone?: (a: Adjustment) => void;
}) {
  const { data, error, loading } = useApi<Targets>(open && userId ? `/api/wallet/adjustments/targets/${userId}` : null);
  const [target, setTarget] = React.useState<string>("wallet");
  const [op, setOp] = React.useState<AdjOp>("add");
  const [amount, setAmount] = React.useState("");
  const [category, setCategory] = React.useState<AdjCategory>("correction");
  const [comment, setComment] = React.useState("");
  const [note, setNote] = React.useState("");
  const [notify, setNotify] = React.useState(true);
  const [force, setForce] = React.useState(false);
  const [step, setStep] = React.useState<"form" | "confirm">("form");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiErr | null>(null);
  const key = React.useRef<string>("");
  const presetKey = preset?.target === "trading" ? String(preset.login) : "wallet";

  React.useEffect(() => {
    if (!open) return;
    setTarget(presetKey);
    setOp("add");
    setAmount("");
    setCategory("correction");
    setComment("");
    setNote("");
    setNotify(true);
    setForce(false);
    setStep("form");
    setPreview(null);
    setErr(null);
    key.current = "";
  }, [open, presetKey]);

  const acc = target === "wallet" ? null : (data?.accounts.find((a) => String(a.login) === target) ?? null);
  const wallet = data?.wallet.find((w) => w.currency === "USDT") ?? data?.wallet[0];
  const ccy = acc ? acc.currency : (wallet?.currency ?? "USDT");
  const isCredit = op === "credit_in" || op === "credit_out";
  const can = data?.can ?? { adjust: false, credit: false, approve: false, force: false };
  const forceable = !!acc && can.force && (op === "deduct" || op === "credit_out");
  const dp = acc ? 2 : 6;

  // keep the reason valid for the operation, and credit only on trading accounts
  React.useEffect(() => {
    if (category === "deposit" && op !== "add") setCategory("correction");
    if (category === "withdrawal" && op !== "deduct") setCategory("correction");
  }, [op, category]);
  React.useEffect(() => {
    if (!acc && isCredit) setOp("add");
  }, [acc, isCredit]);
  React.useEffect(() => {
    if (!forceable) setForce(false);
  }, [forceable]);
  React.useEffect(() => {
    if (!data) return;
    if (!can.adjust && can.credit && !isCredit) setOp("credit_in");
  }, [data, can.adjust, can.credit, isCredit]);

  const n = Number(amount);
  const amountOk = amount !== "" && Number.isFinite(n) && n > 0 && (amount.split(".")[1]?.length ?? 0) <= dp;
  const limit = op === "deduct" ? (acc ? num(acc.withdrawable) : num(wallet?.available)) : op === "credit_out" ? (acc ? Math.min(num(acc.credit) ?? 0, Math.max(0, num(acc.freeMargin) ?? 0)) : null) : null;
  const creditHeld = acc ? (num(acc.credit) ?? 0) : 0;
  // taking back more credit than the account holds is refused even with force
  const overCredit = op === "credit_out" && amountOk && n > creditHeld + 1e-9;
  const overLimit = amountOk && limit !== null && ((n > limit + 1e-9 && !force) || overCredit);
  const formErr = !amountOk ? "Enter an amount" : comment.trim().length < 3 ? "Add a comment for the audit" : overLimit ? `More than ${fmt(limit, ccy)} can't be ${op === "deduct" ? "deducted" : "taken back"}` : null;

  const body = () => ({
    user_id: userId,
    target: acc ? "trading" : "wallet",
    login: acc ? acc.login : undefined,
    currency: acc ? undefined : ccy,
    op,
    category,
    amount,
    comment: comment.trim(),
    client_note: note.trim() || undefined,
    notify,
    force: forceable && force,
  });

  async function review() {
    setBusy(true);
    setErr(null);
    const r = await sendJson<{ preview: Preview }>("/api/wallet/adjustments/preview", body());
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setPreview(r.data.preview);
    key.current = newKey();
    setStep("confirm");
  }

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const r = await sendJson<{ adjustment: Adjustment }>("/api/wallet/adjustments", { ...body(), idempotency_key: key.current });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    const a = r.data.adjustment;
    if (a.status === "pending") toast.message(`Adjustment #${a.id} is waiting for approval`, { description: `${OP_LABEL[a.op]} ${fmt(a.amount, a.currency)}: above the four-eyes threshold. Another staff member approves it in Finance → Adjustments.` });
    else if (a.status === "applied") toast.success(`${OP_LABEL[a.op]}: ${fmt(a.amount, a.currency)} booked`, { description: `${a.target === "wallet" ? "Wallet" : `Account ${a.login}`} · ledger txn ${a.txn_id ?? "—"}${a.notify ? " · client notified" : ""}` });
    else toast.message(`Adjustment #${a.id}: ${a.status}`);
    onDone?.(a);
    onOpenChange(false);
  }

  const accLabel = (a: TargetAccount) => `${a.login} · ${a.type === "demo" ? "Demo" : "Live"} · ${a.groupName ?? a.group ?? ""} · ${a.currency} · balance ${fmt(a.balance)}${num(a.credit) ? ` · credit ${fmt(a.credit)}` : ""}`;
  const targetOptions = [
    ...(data?.wallet ?? []).filter((w) => w.currency === "USDT").map((w) => ({ value: "wallet", label: `Wallet · ${w.currency} · available ${fmt(w.available)}${Number(w.locked) ? ` (locked ${fmt(w.locked)})` : ""}` })),
    ...(data?.accounts ?? []).map((a) => ({ value: String(a.login), label: accLabel(a) })),
  ];
  const opOptions = (["add", "deduct", "credit_in", "credit_out"] as AdjOp[])
    .filter((o) => (o.startsWith("credit") ? can.credit && !!acc : can.adjust))
    .map((o) => ({ value: o, label: OP_LABEL[o] }));
  const catOptions = CATEGORIES.filter((c) => (c === "deposit" ? op === "add" : c === "withdrawal" ? op === "deduct" : true)).map((c) => ({ value: c, label: CATEGORY_LABEL[c] }));

  const who = clientName ? `${clientName} (#${userId})` : `client #${userId}`;
  const title = step === "form" ? "Balance & credit" : preview?.needs_approval ? "Confirm request for approval" : "Confirm adjustment";

  const footer =
    step === "form" ? (
      <>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="ember" disabled={!!formErr || busy || !data} onClick={review} title={formErr ?? undefined}>
          {busy ? "Checking…" : "Review"}
          <ArrowRight />
        </Button>
      </>
    ) : (
      <>
        <Button variant="ghost" disabled={busy} onClick={() => (setStep("form"), setErr(null))}>
          Back
        </Button>
        <Button variant={signedOf(op) > 0 ? "up-outline" : "down-outline"} disabled={busy || !preview?.ok} onClick={confirm} data-testid="adjust-confirm">
          {busy ? "Booking…" : preview?.needs_approval ? "Submit for approval" : `Confirm ${signedOf(op) > 0 ? "+" : "−"}${fmt(amount, ccy)}`}
        </Button>
      </>
    );

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)} width={600} title={title} description={step === "form" ? `Manual adjustment for ${who}. Booked on the double-entry ledger and audited.` : `For ${who}. Nothing is booked until you confirm.`} footer={footer}>
      {error ? (
        <ErrorBox e={error} />
      ) : loading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !data ? null : step === "form" ? (
        <div className="space-y-4">
          <MiniField label="Target" hint={data.engine_available ? undefined : "Trading engine unavailable: wallet only"}>
            <Select value={target} onChange={setTarget} options={targetOptions} />
          </MiniField>
          <MiniField label="Operation">
            <Segmented size="sm" value={op} onChange={(v) => setOp(v as AdjOp)} options={opOptions} className="self-start" />
          </MiniField>
          {!acc && can.credit && <p className="-mt-2 text-[11.5px] text-fg-3">Credit exists on trading accounts only: pick an account to give or take credit.</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MiniField label={`Amount (${ccy})`} hint={limit !== null ? `max ${fmt(limit)}` : undefined}>
              <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/,/g, ".").replace(/[^0-9.]/g, ""))} placeholder="0.00" inputMode="decimal" aria-label="Amount" className="h-10 font-mono" />
            </MiniField>
            <MiniField label="Reason">
              <Select value={category} onChange={(v) => setCategory(v as AdjCategory)} options={catOptions} />
            </MiniField>
          </div>
          {overLimit && (
            <p role="alert" className="-mt-1 text-[12px] text-down">
              {op === "deduct"
                ? `Refused: more than ${fmt(limit, ccy)} can't be deducted (${acc ? "free funds: balance not used as margin, excluding credit" : "available wallet balance"}).`
                : overCredit
                  ? creditHeld > 0
                    ? `Refused: the account holds ${fmt(creditHeld, ccy)} credit; more can't be taken back.`
                    : "Refused: the account holds no credit."
                  : `Refused: ${fmt(limit, ccy)} credit can be taken back while positions are open (free margin).`}
              {acc && can.force && !overCredit ? " You can force it past the free margin below." : ""}
            </p>
          )}
          {category === "deposit" || category === "withdrawal" ? (
            <p className="-mt-1 text-[11.5px] text-fg-3">Counted as real money in the deposit, withdrawal and FTD reports.</p>
          ) : (
            <p className="-mt-1 text-[11.5px] text-fg-3">An adjustment: never counted as a client deposit or withdrawal.</p>
          )}
          <MiniField label="Comment" hint="internal · audit only">
            <TextArea value={comment} onChange={setComment} rows={2} placeholder="Why, with the ticket or reference" />
          </MiniField>
          <MiniField label="Statement note" hint="optional · shown to the client">
            <Input value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder={isCredit ? "e.g. Welcome credit" : "e.g. Compensation for the 29 Sep outage"} aria-label="Statement note" className="h-10" />
          </MiniField>
          <div className="k-row flex items-center justify-between gap-3 px-3.5 py-2.5">
            <div>
              <div className="text-[13px] font-medium">Notify the client</div>
              <div className="text-[11.5px] text-fg-3">Bell in the Client Area and Ezymex Trader, and email per their preference</div>
            </div>
            <Toggle checked={notify} onChange={setNotify} label="Notify the client" />
          </div>
          {forceable && (
            <div className={cn("k-row flex items-center justify-between gap-3 px-3.5 py-2.5", force && "border-warn/40 bg-warn-soft")}>
              <div>
                <div className="flex items-center gap-1.5 text-[13px] font-medium">
                  <ShieldCheck className="size-3.5 text-warn" /> Force past the free margin
                </div>
                <div className="text-[11.5px] text-fg-3">Super Admin. May trigger margin call or stop-out. Never below a zero balance or beyond the credit held (negative balance protection).</div>
              </div>
              <Toggle checked={force} onChange={setForce} label="Force" />
            </div>
          )}
          {data.threshold_usd !== null && <p className="text-[11.5px] text-fg-3">Four-eyes: above ${fmt(data.threshold_usd)} a second staff member must approve.</p>}
          {err && <ErrorBox e={err} />}
        </div>
      ) : preview ? (
        <ConfirmView preview={preview} op={op} amount={amount} ccy={ccy} acc={acc} category={category} comment={comment} note={note} notify={notify} force={forceable && force} err={err} />
      ) : null}
    </Dialog>
  );
}

function ErrorBox({ e }: { e: ApiErr }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-[12px] border border-down/35 bg-down-soft px-3.5 py-2.5 text-[12.5px] text-fg">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-down" />
      <span>{e.code === "forbidden" ? "Your role doesn't allow this operation." : e.message}</span>
    </div>
  );
}

const ROWS_TRADING: [string, string][] = [
  ["balance", "Balance"],
  ["credit", "Credit"],
  ["equity", "Equity"],
  ["freeMargin", "Free margin"],
  ["marginLevel", "Margin level"],
];
const ROWS_WALLET: [string, string][] = [
  ["available", "Available"],
  ["locked", "Locked"],
];

function ConfirmView({ preview, op, amount, ccy, acc, category, comment, note, notify, force, err }: { preview: Preview; op: AdjOp; amount: string; ccy: string; acc: TargetAccount | null; category: AdjCategory; comment: string; note: string; notify: boolean; force: boolean; err: ApiErr | null }) {
  const rows = acc ? ROWS_TRADING : ROWS_WALLET;
  const b = preview.before ?? {};
  const a = preview.after ?? {};
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        <span className={cn("k-num font-mono text-[18px] font-medium", signedOf(op) > 0 ? "text-up" : "text-down")}>
          {signedOf(op) > 0 ? "+" : "−"}
          {fmt(amount, ccy)}
        </span>
        <Chip size="sm" tone={op.startsWith("credit") ? "gold" : "neutral"}>
          {OP_LABEL[op]}
        </Chip>
        <span className="text-fg-3">{acc ? `account ${acc.login} (${acc.type})` : "wallet"}</span>
        {ccy === "USC" && <span className="text-[11.5px] text-fg-3">= ${fmt(preview.amount_usd)}</span>}
      </div>
      <div className="overflow-hidden rounded-[14px] border border-line">
        <table className="w-full text-[13px]">
          <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-fg-3">
            <tr>
              <th className="px-3.5 py-2 text-left font-medium" />
              <th className="px-3.5 py-2 text-right font-medium">Before</th>
              <th className="px-3.5 py-2 text-right font-medium">After</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, label]) => {
              const before = num(b[k]);
              const after = preview.ok ? num(a[k]) : null;
              const changed = before !== null && after !== null && Math.abs(after - before) > 1e-9;
              const pct = k === "marginLevel";
              return (
                <tr key={k} className="border-t border-line">
                  <td className="px-3.5 py-2 text-fg-2">{label}</td>
                  <td className="k-num px-3.5 py-2 text-right font-mono">{pct ? (before === null ? "—" : `${fmt(before)}%`) : fmt(before)}</td>
                  <td className={cn("k-num px-3.5 py-2 text-right font-mono", changed && (after! > before! ? "text-up" : "text-down"))}>{pct ? (after === null ? "—" : `${fmt(after)}%`) : preview.ok ? fmt(after) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
        <dt className="text-fg-3">Reason</dt>
        <dd>{CATEGORY_LABEL[category]}</dd>
        <dt className="text-fg-3">Comment</dt>
        <dd className="break-words">{comment}</dd>
        <dt className="text-fg-3">Statement note</dt>
        <dd className="break-words">{note.trim() || <span className="text-fg-3">None (neutral label)</span>}</dd>
        <dt className="text-fg-3">Client notice</dt>
        <dd>{notify ? "Bell + email" : "None"}</dd>
        {force && (
          <>
            <dt className="text-fg-3">Force</dt>
            <dd className="text-warn">Past the free margin</dd>
          </>
        )}
      </dl>
      {!preview.ok && preview.error && <ErrorBox e={preview.error} />}
      {preview.ok && (preview.stopOut || preview.marginCall) && (
        <div className="flex items-start gap-2 rounded-[12px] border border-warn/40 bg-warn-soft px-3.5 py-2.5 text-[12.5px]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
          {preview.stopOut ? "The margin level falls below stop-out: the engine closes positions right after booking." : "The account enters margin call after booking."}
        </div>
      )}
      {preview.needs_approval && (
        <div className="flex items-start gap-2 rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 text-[12.5px]">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-fg-2" />
          <span>
            ${fmt(preview.amount_usd)} is above the four-eyes threshold of ${fmt(preview.threshold_usd)}. This becomes a request: another staff member with approval rights books it in Finance → Adjustments. The after values are
            what it would be now.
          </span>
        </div>
      )}
      {err && <ErrorBox e={err} />}
    </div>
  );
}
