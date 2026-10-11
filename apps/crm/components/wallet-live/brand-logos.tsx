// The payment providers' own logos and the branded strip that tops a payment panel, so a deposit page looks
// like the gateway it hands off to rather than a generic form.
//
// OxaPay: the official mark and wordmark from oxapay.com (brand blue #1C39BB).
// PhonePe: the official mark (brand purple #5F259F), from the CC0 Simple Icons set.
//
// They are the providers' trade marks, shown only to name the payment method the client is using.

import * as React from "react";
import { Lock } from "lucide-react";
import { cn } from "@/components/kit";

export const OXAPAY_COLOR = "#1C39BB";
export const PHONEPE_COLOR = "#5F259F";

/** OxaPay's square mark: the blue squircle with its white monogram. */
export function OxaPayMark({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="31 17 609 609" className={className} role="img" aria-label="OxaPay">
      <path
        fill={OXAPAY_COLOR}
        d="M31.08,322c0-236.43,68.1-304.54,304.54-304.54S640.16,85.52,640.16,322,572.05,626.5,335.62,626.5,31.08,558.39,31.08,322Z"
      />
      <path
        fill="#fff"
        d="M408.93,235.6h76.21a48.58,48.58,0,0,1,48.57,48.57v94.56a29.58,29.58,0,0,1-29.58,29.58h0V283.74a19,19,0,0,0-19-19H409.72a19,19,0,0,0-14.7,7L373.5,298.32l-19.1-23.38,17.78-21.88A47.38,47.38,0,0,1,408.93,235.6Z"
      />
      <path
        fill="#fff"
        d="M298,390.85a47.41,47.41,0,0,1-36.75,17.46H186.1a48.58,48.58,0,0,1-48.58-48.57V284.17A48.58,48.58,0,0,1,186.1,235.6h75.42a47.4,47.4,0,0,1,36.75,17.46l97,119.11a19,19,0,0,0,14.7,7H474.5v29.16H409.21a47.4,47.4,0,0,1-36.75-17.46l-97-119.09a19,19,0,0,0-14.7-7H186.07a19,19,0,0,0-19,19v76.45a19,19,0,0,0,19,19h74.37a18.94,18.94,0,0,0,14.69-7L297,345.39l19,23.37Z"
      />
    </svg>
  );
}

/** OxaPay's wordmark, in the current text colour so it reads in both themes. */
export function OxaPayWordmark({ height = 15, className }: { height?: number; className?: string }) {
  return (
    <svg height={height} viewBox="714 259 621 126" fill="currentColor" className={className} role="img" aria-label="OxaPay">
      <path d="M714.64,260.27a1,1,0,0,1,.32-.69,1,1,0,0,1,.69-.32H858A35.75,35.75,0,0,1,893.69,295v12.54A35.75,35.75,0,0,1,858,343.4H739.72v40.12a1.09,1.09,0,0,1-.31.81,1.12,1.12,0,0,1-.82.32H715.65a1,1,0,0,1-.69-.32,1.1,1.1,0,0,1-.32-.81ZM858,322a10.17,10.17,0,0,0,7.53-3.19,10.46,10.46,0,0,0,3.13-7.59V291.49a10.4,10.4,0,0,0-3.13-7.65A10.27,10.27,0,0,0,858,280.7H739.72V322Z" />
      <path d="M931.3,295a35.75,35.75,0,0,1,35.86-35.74h107.45A35.85,35.85,0,0,1,1110.47,295v88.52a1.08,1.08,0,0,1-1.13,1.13H1086.4a1,1,0,0,1-.69-.32,1.1,1.1,0,0,1-.32-.81V343.4h-129v40.12a1.1,1.1,0,0,1-.32.81,1,1,0,0,1-.69.32H932.43a1.07,1.07,0,0,1-.81-.32,1.1,1.1,0,0,1-.32-.81ZM1085.39,322V291.49a10.31,10.31,0,0,0-3.19-7.65,10.47,10.47,0,0,0-7.59-3.14H967.16a10.7,10.7,0,0,0-10.78,10.79V322Z" />
      <path d="M1309.33,260.27a1,1,0,0,1,.31-.69,1.1,1.1,0,0,1,.81-.32h22.82a1.11,1.11,0,0,1,.82.32,1,1,0,0,1,.31.69v35.1a24.44,24.44,0,0,1-4.14,13.86,24.81,24.81,0,0,1-11.15,9.21l-65.33,27.71v37.37a1.09,1.09,0,0,1-.31.81,1,1,0,0,1-.69.32h-23a1.09,1.09,0,0,1-1.13-1.13V346.15l-65.32-27.71a25,25,0,0,1-15.29-23.07v-35.1a1,1,0,0,1,.31-.69,1.1,1.1,0,0,1,.81-.32h23a1,1,0,0,1,.69.32,1,1,0,0,1,.31.69v30.21q0,6.52,6.65,9.91l61.43,25.83,61.57-25.83q6.51-3.39,6.52-9.91Z" />
    </svg>
  );
}

/** PhonePe's round mark. */
export function PhonePeMark({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={PHONEPE_COLOR} className={className} role="img" aria-label="PhonePe">
      <path d="M10.206 9.941h2.949v4.692c-.402.201-.938.268-1.34.268-1.072 0-1.609-.536-1.609-1.743V9.941zm13.47 4.816c-1.523 6.449-7.985 10.442-14.433 8.919C2.794 22.154-1.199 15.691.324 9.243 1.847 2.794 8.309-1.199 14.757.324c6.449 1.523 10.442 7.985 8.919 14.433zm-6.231-5.888a.887.887 0 0 0-.871-.871h-1.609l-3.686-4.222c-.335-.402-.871-.536-1.407-.402l-1.274.401c-.201.067-.268.335-.134.469l4.021 3.82H6.386c-.201 0-.335.134-.335.335v.67c0 .469.402.871.871.871h.938v3.217c0 2.413 1.273 3.82 3.418 3.82.67 0 1.206-.067 1.877-.335v2.145c0 .603.469 1.072 1.072 1.072h.938a.432.432 0 0 0 .402-.402V9.874h1.542c.201 0 .335-.134.335-.335v-.67z" />
    </svg>
  );
}

/* ------------------------------- the brands ------------------------------- */

export type PayBrand = {
  key: "oxapay" | "phonepe";
  name: string;
  colour: string;
  mark: (size: number) => React.ReactNode;
  /** The provider's own wordmark, where it has one; otherwise the name is set in type. */
  wordmark?: (className?: string) => React.ReactNode;
};

export const OXAPAY_BRAND: PayBrand = {
  key: "oxapay",
  name: "OxaPay",
  colour: OXAPAY_COLOR,
  mark: (s) => <OxaPayMark size={s} />,
  wordmark: (c) => <OxaPayWordmark height={14} className={cn("text-fg", c)} />,
};

export const PHONEPE_BRAND: PayBrand = {
  key: "phonepe",
  name: "PhonePe",
  colour: PHONEPE_COLOR,
  mark: (s) => <PhonePeMark size={s} />,
};

/**
 * The brand behind a manual payment method, matched on the name the broker gave it ("Phone Pe", "PhonePe UPI",
 * …). Unknown names get no brand and keep the generic icon, which is the right default for a plain bank account.
 */
export function brandForMethod(name: string | undefined | null): PayBrand | null {
  const n = (name ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (n.includes("phonepe")) return PHONEPE_BRAND;
  return null;
}

/* ------------------------------- the banner ------------------------------- */

/**
 * The strip that tops a payment panel: the provider's logo on a white chip over a wash of its own colour, with
 * a secure note on the right. It is what makes the page read as that gateway rather than a form.
 */
export function GatewayBanner({ brand, note, className }: { brand: PayBrand; note: string; className?: string }) {
  return (
    <div
      className={cn("relative flex items-center gap-3 overflow-hidden border-b border-line px-5 py-3.5 sm:px-6", className)}
      style={{ background: `linear-gradient(100deg, ${brand.colour}1a, ${brand.colour}08 45%, transparent 85%)` }}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] ring-1 ring-black/5">
        {brand.mark(26)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex h-[17px] items-center">{brand.wordmark ? brand.wordmark() : <span className="text-[15px] font-semibold text-fg">{brand.name}</span>}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] font-medium text-fg-3">
        <Lock className="size-3" />
        <span className="hidden sm:inline">{note}</span>
      </span>
      {/* a hairline of the brand's colour along the bottom */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg, ${brand.colour}, transparent 70%)` }} />
    </div>
  );
}
