"use client";

// The deposit request a client sends after paying a manual method: amount in the method currency (with the ≈ USDT
// preview), the UTR / transaction hash, an optional screenshot and note; one request id per submit, kept while the
// same request is retried. Crypto methods on EVM networks can be paid with MetaMask: the hash is filled in and the
// request is sent at once.

import * as React from "react";
import { CircleCheck, ImagePlus, Loader2, Send, Smartphone, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Field, Input, cn, shortHash } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";
import { WalletError, fmt, requestId } from "../api";
import { PayError, hasMetaMask, isMobile } from "../pay";
import { InlineError, cleanAmount } from "../ui";
import { cmpDec, createRequest, expectedCredit, money, rateText, requestError, uploadProof, usdt2, type ManualDeposit, type PaymentMethod } from "./api";
import { METAMASK_DOWNLOAD, metamaskDappLink, payEvm } from "./metamask";

/** Amount field: like the wallet's cleanAmount but up to 6 decimals (crypto). */
function cleanDecimal(raw: string, dp: number) {
  if (dp <= 2) return cleanAmount(raw);
  const v = raw.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const dot = v.indexOf(".");
  return dot < 0 ? v : v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "").slice(0, dp);
}

function MetaMaskBlock({ m, amount, valid, busy, onPay }: { m: PaymentMethod; amount: string; valid: boolean; busy: boolean; onPay: () => void }) {
  const t = useT();
  const [env, setEnv] = React.useState({ mm: false, mobile: false });
  React.useEffect(() => {
    // MetaMask injects window.ethereum after load
    const check = () => setEnv({ mm: hasMetaMask(), mobile: isMobile() });
    check();
    const id = setTimeout(check, 800);
    return () => clearTimeout(id);
  }, []);
  const token = m.details.token ?? m.currency;
  const network = m.details.network ?? "";
  return (
    <div className="rounded-[16px] border border-line bg-surface-2 p-4" data-testid="metamask-block">
      <div className="text-[13.5px] font-medium">{t("payments.mm.title")}</div>
      <p className="mt-1 text-[12.5px] text-fg-3">{t("payments.mm.text", { amount: valid ? fmt(amount, 2) : "…", token, network })}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {env.mm ? (
          <Button type="button" variant="ember" onClick={onPay} disabled={busy || !valid} data-testid="pay-metamask">
            {busy ? <Loader2 className="animate-spin" /> : <Wallet />} {busy ? t("payments.mm.confirm") : t("payments.mm.button")}
          </Button>
        ) : env.mobile ? (
          <a href={metamaskDappLink(`/wallet/deposit?via=crypto&method=${m.id}`)}>
            <Button type="button" variant="ember">
              <Smartphone /> {t("payments.mm.openApp")}
            </Button>
          </a>
        ) : (
          <a href={METAMASK_DOWNLOAD} target="_blank" rel="noreferrer">
            <Button type="button" variant="surface">
              <Wallet /> {t("payments.mm.install")}
            </Button>
          </a>
        )}
        {env.mm && !valid && <span className="text-[12px] text-fg-3">{t("payments.mm.enterAmount")}</span>}
      </div>
      {!env.mm && <p className="mt-2 text-[12px] text-fg-3">{env.mobile ? t("payments.mm.mobileHint") : t("payments.mm.notInstalled")}</p>}
    </div>
  );
}

export function RequestForm({ m, maxPending, onSent }: { m: PaymentMethod; maxPending: number; onSent: (d: ManualDeposit) => void }) {
  const t = useT();
  const crypto = m.kind === "crypto";
  const dp = crypto ? 6 : 2;
  const [amount, setAmount] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [note, setNote] = React.useState("");
  const [proof, setProof] = React.useState<{ id: string; url: string; name: string } | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [busy, setBusy] = React.useState<"send" | "metamask" | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState(false);
  // one request id per distinct submission: retrying the same request reuses it (the service answers with the first)
  const attempt = React.useRef<{ sig: string; key: string } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setAmount("");
    setReference("");
    setNote("");
    setProof(null);
    setErr(null);
    setTouched(false);
    attempt.current = null;
  }, [m.id]);

  const amt = amount.trim();
  const shaped = /^\d{1,12}(\.\d{1,6})?$/.test(amt) && Number(amt) > 0;
  const belowMin = shaped && cmpDec(amt, m.min_amount) < 0;
  const aboveMax = shaped && !!m.max_amount && cmpDec(amt, m.max_amount) > 0;
  const amountOk = shaped && !belowMin && !aboveMax;
  const credit = shaped ? expectedCredit(amt, m.rate) : null;
  const amountError = !touched || !amt ? undefined : !shaped ? t("payments.form.invalidAmount") : belowMin ? t("payments.form.min", { amount: money(m.min_amount, m.currency) }) : aboveMax ? t("payments.form.max", { amount: money(m.max_amount, m.currency) }) : undefined;
  const evm = crypto ? m.evm : null;

  const send = async (ref: string) => {
    const body = { method_id: m.id, amount: amt, reference: ref.trim(), proof_media_id: proof?.id ?? null, note: note.trim() || null };
    const sig = JSON.stringify(body);
    if (attempt.current?.sig !== sig) attempt.current = { sig, key: requestId() };
    const d = await createRequest({ ...body, idempotency_key: attempt.current.key });
    attempt.current = null;
    onSent(d);
    return d;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!amountOk) return setErr(amountError ?? t("payments.form.invalidAmount"));
    if (reference.trim().length < 4) return setErr(t("payments.form.invalidReference"));
    setBusy("send");
    setErr(null);
    try {
      await send(reference);
    } catch (e2) {
      setErr(requestError(e2, t, { method: m, maxPending }));
    } finally {
      setBusy(null);
    }
  };

  const payMetaMask = async () => {
    if (!evm || !amountOk) return setTouched(true);
    setBusy("metamask");
    setErr(null);
    let hash: string;
    try {
      const r = await payEvm({ chainId: evm.chain_id, tokenContract: evm.token_contract, decimals: evm.token_decimals, to: m.details.address ?? "", amount: amt, network: m.details.network ?? "" });
      hash = r.hash;
    } catch (e2) {
      setBusy(null);
      return setErr(e2 instanceof PayError ? e2.message : t("payments.mm.failed", { error: e2 instanceof Error ? e2.message : "—" }));
    }
    setReference(hash);
    try {
      await send(hash);
      toast.success(t("payments.mm.sent"), { description: t("payments.mm.sentText", { hash: shortHash(hash, 8, 6) }) });
    } catch (e2) {
      // the payment went out: keep the hash in the form so the request can be sent again
      setErr(t("payments.mm.submitFailed", { hash: shortHash(hash, 8, 6), error: requestError(e2, t, { method: m, maxPending }) }));
    } finally {
      setBusy(null);
    }
  };

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    setUploading(true);
    try {
      const r = await uploadProof(f);
      setProof({ ...r, name: f.name });
    } catch (e2) {
      setErr(e2 instanceof WalletError ? requestError(e2, t) : t("payments.error.uploadFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader title={t("payments.form.title")} subtitle={t("payments.form.subtitle")} />
      <form onSubmit={submit} className="space-y-4 px-4 pb-6 pt-4 sm:px-6" noValidate>
        <Field label={t("payments.form.amount")} hint={t("payments.form.amountHint", { currency: m.currency })} error={amountError}>
          <Input
            inputMode="decimal"
            placeholder={crypto ? "100" : "10000.00"}
            value={amount}
            onChange={(e) => setAmount(cleanDecimal(e.target.value, dp))}
            onBlur={() => setTouched(true)}
            trailing={<span className="text-[12.5px] font-medium text-fg-2">{m.currency}</span>}
            aria-label={t("payments.form.amount")}
            data-testid="manual-amount"
          />
        </Field>
        <div className="rounded-[14px] border border-line bg-surface-2 px-4 py-3" data-testid="manual-receive">
          <div dir="ltr" className="k-num text-[18px] font-semibold">
            {t("payments.form.receive", { amount: credit ? usdt2(credit) : "0.00" })}
          </div>
          <div className="mt-0.5 text-[12px] text-fg-3">{t("payments.form.receiveNote", { rate: rateText(m.rate), currency: m.currency })}</div>
        </div>
        {evm && <MetaMaskBlock m={m} amount={amt} valid={amountOk} busy={busy === "metamask"} onPay={payMetaMask} />}
        <Field label={crypto ? t("payments.form.referenceCrypto") : t("payments.form.referenceBank")} hint={crypto ? t("payments.form.referenceCryptoHint") : t("payments.form.referenceBankHint")}>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value.slice(0, 128))}
            placeholder={crypto ? t("payments.form.referenceCryptoPlaceholder") : t("payments.form.referenceBankPlaceholder")}
            inputClassName={cn(crypto && "font-mono text-[12.5px]")}
            dir="ltr"
            aria-label={crypto ? t("payments.form.referenceCrypto") : t("payments.form.referenceBank")}
            data-testid="manual-reference"
          />
        </Field>
        <Field label={t("payments.form.proof")} hint={t("payments.form.proofHint")}>
          <div className="flex flex-wrap items-center gap-3">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} data-testid="manual-proof-input" />
            {proof ? (
              <div className="k-row flex items-center gap-3 px-2.5 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={proof.url} alt="" className="size-12 rounded-[8px] object-cover" />
                <span className="max-w-[180px] truncate text-[12.5px] text-fg-2">{proof.name}</span>
                <button type="button" onClick={() => setProof(null)} className="grid size-7 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label={t("payments.form.proofRemove")}>
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <Button type="button" variant="surface" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} {uploading ? t("payments.form.proofUploading") : t("payments.form.proofChoose")}
              </Button>
            )}
          </div>
        </Field>
        <Field label={t("payments.form.note")}>
          <Input value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} placeholder={t("payments.form.notePlaceholder")} aria-label={t("payments.form.note")} />
        </Field>
        <InlineError>{err}</InlineError>
        <Button type="submit" variant="ember" size="lg" className="w-full sm:w-auto" disabled={busy !== null || uploading} data-testid="manual-submit">
          {busy === "send" ? <Loader2 className="animate-spin" /> : <Send />} {busy === "send" ? t("payments.form.sending") : t("payments.form.submit")}
        </Button>
      </form>
    </Card>
  );
}

export function RequestSent({ d, onAnother, onList }: { d: ManualDeposit; onAnother: () => void; onList: () => void }) {
  const t = useT();
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center" data-testid="manual-sent">
        <span className="grid size-14 place-items-center rounded-full border border-up/30 bg-up-soft text-up">
          <CircleCheck className="size-7" />
        </span>
        <div className="text-[18px] font-semibold">{t("payments.success.title")}</div>
        <p className="max-w-md text-[13px] text-fg-2">{t("payments.success.text")}</p>
        <div dir="ltr" className="k-num text-[14px] text-fg-2">
          {money(d.amount, d.currency)} · {t("payments.list.expected", { amount: usdt2(d.expected_credit) })}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button variant="ember" onClick={onAnother}>
            {t("payments.success.another")}
          </Button>
          <Button variant="surface" onClick={onList}>
            {t("payments.success.viewRequests")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
