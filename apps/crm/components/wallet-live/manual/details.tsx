"use client";

// The broker's payment details for one manual method: every field with a copy button, the QR code (uploaded by the
// broker, or generated from the UPI id / the address), rate, limits, warnings and the broker's instructions.

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, CircleAlert, Landmark, Lock, Wallet } from "lucide-react";
import { Card, CardHeader, CoinIcon, CopyButton, cn } from "@/components/kit";
import { GatewayBanner, brandForMethod } from "../brand-logos";
import { useT } from "@ezymex/i18n/react";
import type { MessageKey } from "@ezymex/i18n";
import { Tile } from "../ui";
import { money, qrPayload, type PaymentMethod } from "./api";

const COIN: Record<string, string> = { TRC20: "trx", BEP20: "bnb", ERC20: "eth", Polygon: "matic", BTC: "btc", Solana: "sol" };

function MethodIcon({ m, size = 32 }: { m: PaymentMethod; size?: number }) {
  // a method the broker named after a brand we know shows that brand's own mark
  const brand = brandForMethod(m.name);
  if (brand) {
    return (
      <span className="grid shrink-0 place-items-center rounded-full bg-white ring-1 ring-black/5" style={{ width: size, height: size }}>
        {brand.mark(Math.round(size * 0.7))}
      </span>
    );
  }
  if (m.kind === "bank") {
    return (
      <span className="grid shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg-2" style={{ width: size, height: size }}>
        <Landmark className="size-4" />
      </span>
    );
  }
  const token = (m.details.token ?? "").toLowerCase();
  const chain = COIN[m.details.network ?? ""];
  return (
    <span className="relative shrink-0">
      <CoinIcon coin={token === "usdt" || token === "btc" || token === "eth" ? token : "usdt"} size={size} />
      {chain && chain !== token && <CoinIcon coin={chain} size={Math.round(size / 2)} className="absolute -bottom-0.5 -end-1 ring-2 ring-surface-2" />}
    </span>
  );
}

/** Choose between several methods of the same kind. */
export function MethodPicker({ methods, value, onChange }: { methods: PaymentMethod[]; value: number | null; onChange: (id: number) => void }) {
  const t = useT();
  if (methods.length < 2) return null;
  return (
    <div>
      <div className="k-label mb-2">{methods[0]!.kind === "bank" ? t("payments.picker.bank") : t("payments.picker.crypto")}</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {methods.map((m) => {
          const on = m.id === value;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              className={cn("k-row flex items-center gap-3 px-4 py-3 text-start transition-colors", on ? "border-ember/60 bg-ember-soft" : "hover:border-[var(--k-border-top)]")}
              data-testid={`manual-method-${m.id}`}
            >
              <MethodIcon m={m} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">{m.name}</div>
                <div className="truncate text-[12px] text-fg-3">{m.kind === "crypto" ? `${m.details.token ?? ""} · ${m.details.network ?? ""}` : m.currency}</div>
              </div>
              {on && (
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ember text-white">
                  <Check className="size-3.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * One field of the broker's account. `locked` is for the fields you would pay to: the figure stays on the page so the
 * row keeps its height, but it is blurred and uncopyable until the client has told us the amount.
 */
function DetailRow({ label, value, mono, locked }: { label: string; value: string | undefined; mono?: boolean; locked?: boolean }) {
  if (!value) return null;
  return (
    <div className="k-row flex items-center gap-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] uppercase tracking-wider text-fg-3">{label}</div>
        <div
          dir="ltr"
          aria-hidden={locked || undefined}
          className={cn(
            "break-all text-[13.5px] font-medium transition-[filter]",
            mono && "font-mono text-[12.5px]",
            locked && "select-none blur-[5px]",
          )}
        >
          {value}
        </div>
      </div>
      <CopyButton value={value} label={label} className="size-8 shrink-0" disabled={locked} />
    </div>
  );
}

/**
 * The QR to scan: the broker's uploaded image, else one generated from the UPI id or the address. While `locked` it is
 * blurred behind a badge naming the minimum, so a client cannot scan and pay before saying what they are paying.
 */
export function MethodQr({ m, size = 168, locked }: { m: PaymentMethod; size?: number; locked?: boolean }) {
  const t = useT();
  const payload = qrPayload(m);
  if (!m.qr_url && !payload) return null;
  const caption: MessageKey = m.kind === "crypto" ? "payments.card.qrCrypto" : m.details.upi_id && !m.qr_url ? "payments.card.qrUpi" : "payments.card.qrBank";
  return (
    <div className="flex flex-col items-center">
      <div className="relative" data-locked={locked ? "" : undefined} data-testid="manual-qr-wrap">
        <div className={cn("rounded-[16px] bg-white p-3 transition-[filter]", locked && "select-none blur-[7px]")} aria-hidden={locked || undefined} data-testid="manual-qr">
          {m.qr_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.qr_url} alt="" width={size} height={size} className="block object-contain" style={{ width: size, height: size }} />
          ) : (
            <QRCodeSVG value={payload!} size={size} level="M" bgColor="#ffffff" fgColor="#0e0e12" />
          )}
        </div>
        {locked && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="flex items-center gap-1.5 rounded-full bg-surface-1/95 px-3 py-1.5 text-[11.5px] font-medium text-fg-2 shadow-sm ring-1 ring-line">
              <Lock className="size-3.5 shrink-0 text-fg-3" />
              {t("payments.card.locked", { min: money(m.min_amount, m.currency) })}
            </span>
          </div>
        )}
      </div>
      <div className="mt-2 max-w-[200px] text-center text-[11.5px] text-fg-3">{locked ? t("payments.card.lockedCaption") : t(caption)}</div>
    </div>
  );
}

/** `locked` hides what you would pay to - the QR and every payable identifier - until the amount is known. */
export function MethodDetails({ m, locked }: { m: PaymentMethod; locked?: boolean }) {
  const t = useT();
  const d = m.details;
  const crypto = m.kind === "crypto";
  const brand = brandForMethod(m.name);
  return (
    <Card className="overflow-hidden">
      {brand && <GatewayBanner brand={brand} note={t("payments.card.secure")} />}
      <CardHeader
        title={crypto ? t("payments.card.payToAddress") : t("payments.card.payTo")}
        subtitle={m.name}
        icon={brand ? brand.mark(20) : crypto ? <Wallet /> : <Landmark />}
      />
      <div className="grid grid-cols-1 gap-5 px-4 pb-6 pt-4 sm:px-6 md:grid-cols-[auto_1fr]">
        <div className="md:pt-1">
          <MethodQr m={m} locked={locked} />
        </div>
        <div className="min-w-0 space-y-2">
          {/* Who you would be paying stays readable while locked - the bank, the branch, the network. Only the
              identifiers you would actually send money to are held back. */}
          {crypto ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Tile label={t("payments.card.network")} value={d.network ?? "—"} />
                <Tile label={t("payments.card.token")} value={d.token ?? "—"} />
              </div>
              <DetailRow label={t("payments.card.address")} value={d.address} mono locked={locked} />
              <DetailRow label={t("payments.card.memo")} value={d.memo} mono locked={locked} />
            </>
          ) : (
            <>
              <DetailRow label={t("payments.card.accountName")} value={d.account_name} />
              <DetailRow label={t("payments.card.bankName")} value={d.bank_name} />
              <DetailRow label={t("payments.card.accountNumber")} value={d.account_number} mono locked={locked} />
              <DetailRow label={t("payments.card.ifsc")} value={d.ifsc} mono locked={locked} />
              <DetailRow label={t("payments.card.swift")} value={d.swift} mono locked={locked} />
              <DetailRow label={t("payments.card.iban")} value={d.iban} mono locked={locked} />
              <DetailRow label={t("payments.card.branch")} value={d.branch} />
              <DetailRow label={t("payments.card.upiId")} value={d.upi_id} mono locked={locked} />
            </>
          )}
          <div className={cn("grid gap-2", m.currency === "USDT" ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
            {/* a USDT method has nothing to convert */}
          </div>
          {crypto && (
            <div className="flex items-start gap-2 rounded-[12px] border border-warn/30 bg-warn-soft px-3 py-2 text-[12px] text-fg-2">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" />
              <span>
                {t("payments.card.networkWarning", { token: d.token ?? "", network: d.network ?? "" })}
                {d.memo ? ` ${t("payments.card.memoWarning")}` : ""}
              </span>
            </div>
          )}
          {m.instructions && (
            <div className="rounded-[12px] border border-line bg-surface-2 px-3 py-2.5">
              <div className="text-[11.5px] uppercase tracking-wider text-fg-3">{t("payments.card.instructions")}</div>
              <p className="mt-1 whitespace-pre-line text-[12.5px] text-fg-2">{m.instructions}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export { MethodIcon };
