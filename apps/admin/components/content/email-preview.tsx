"use client";

import * as React from "react";
import { cn } from "@ezymex/ui";

/** Replace {{var}} with sample values; unknown variables render as a red token. */
function renderInline(text: string, samples: Record<string, string>, raw: boolean) {
  const parts = text.split(/(\{\{\s*[a-z0-9_]+\s*\}\})/gi);
  return parts.map((p, i) => {
    const m = p.match(/^\{\{\s*([a-z0-9_]+)\s*\}\}$/i);
    if (!m) return <React.Fragment key={i}>{p}</React.Fragment>;
    const key = m[1]!;
    const known = key in samples;
    if (raw || !known)
      return (
        <span key={i} className={cn("rounded px-1 font-mono text-[0.86em]", known ? "bg-[#ff5a1f]/15 text-[#ff8a3d]" : "bg-[#f04438]/20 text-[#f04438]")}>
          {`{{${key}}}`}
        </span>
      );
    return (
      <span key={i} className="rounded-[3px] bg-[#e9b949]/10 text-[#f3d27a]">
        {samples[key]}
      </span>
    );
  });
}

export function substitute(text: string, samples: Record<string, string>) {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k: string) => samples[k] ?? `{{${k}}}`);
}

/**
 * The email as the client receives it: dark Ezymex shell, masked logo,
 * ember CTA pill and a regulatory footer. `rtl` flips direction for Arabic/Urdu.
 */
export function EmailPreview({
  subject,
  preheader,
  body,
  cta,
  samples,
  rtl,
  raw,
  width = "desktop",
  brand = "Ezymex Markets",
}: {
  subject: string;
  preheader: string;
  body: string;
  cta?: string;
  samples: Record<string, string>;
  rtl?: boolean;
  raw?: boolean;
  width?: "desktop" | "mobile";
  brand?: string;
}) {
  const paras = body.split(/\n{2,}/);
  return (
    <div className="overflow-hidden rounded-[18px] border border-line bg-surface-2">
      {/* inbox chrome */}
      <div className="border-b border-line px-4 py-3" dir={rtl ? "rtl" : "ltr"}>
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#111114] ring-1 ring-white/10">
            <span
              aria-hidden
              className="block h-3 w-3.5 bg-white"
              style={{ WebkitMask: "url(/assets/brand/ezymex-mark.svg) center / contain no-repeat", mask: "url(/assets/brand/ezymex-mark.svg) center / contain no-repeat" }}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="truncate font-medium text-fg">{brand}</span>
              <span className="shrink-0 text-fg-3">14:32</span>
            </div>
            <div className="truncate text-[12.5px] font-medium text-fg">{renderInline(subject || "No subject", samples, !!raw)}</div>
            <div className="truncate text-[11.5px] text-fg-3">{substitute(preheader, samples)}</div>
          </div>
        </div>
      </div>

      {/* canvas */}
      <div className="bg-[#050507] px-3 py-5 sm:px-5">
        <div
          dir={rtl ? "rtl" : "ltr"}
          className={cn("mx-auto overflow-hidden rounded-[16px] border border-white/10 bg-[#0c0c10] text-[#e8e8ec] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)] transition-[max-width] duration-300", width === "mobile" ? "max-w-[340px]" : "max-w-[560px]")}
        >
          {/* header band with ember glow */}
          <div className="relative overflow-hidden px-7 pb-6 pt-7">
            <div className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,92,31,0.55),rgba(196,52,20,0.18)_45%,transparent_75%)]" />
            <span
              role="img"
              aria-label="Ezymex"
              className="relative block h-[22px] w-[80px] bg-white"
              style={{ WebkitMask: "url(/assets/brand/ezymex-logo.svg) left center / contain no-repeat", mask: "url(/assets/brand/ezymex-logo.svg) left center / contain no-repeat", ...(rtl ? { WebkitMaskPosition: "right center", maskPosition: "right center", marginInlineStart: 0 } : {}) }}
            />
          </div>

          <div className="space-y-3.5 px-7 pb-2 text-[13.5px] leading-[1.65] text-[#c9c9d1]">
            {paras.map((p, i) => {
              const only = p.trim().match(/^\{\{\s*otp_code\s*\}\}$/i);
              if (only)
                return (
                  <div key={i} className="my-2 rounded-[14px] border border-white/10 bg-white/[0.04] py-4 text-center font-mono text-[28px] font-semibold tracking-[0.35em] text-white" dir="ltr">
                    {raw ? "{{otp_code}}" : samples.otp_code}
                  </div>
                );
              return (
                <p key={i} className={cn("whitespace-pre-line", i === 0 && "text-[15px] font-medium text-white")}>
                  {renderInline(p, samples, !!raw)}
                </p>
              );
            })}
          </div>

          {cta && (
            <div className="px-7 pb-2 pt-4">
              <span className="inline-flex h-11 items-center rounded-full bg-[linear-gradient(135deg,#ff7a2f,#e8431a)] px-6 text-[13.5px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(255,90,31,0.7)]">{renderInline(cta, samples, !!raw)}</span>
            </div>
          )}

          <div className="px-7 pb-6 pt-5 text-[12.5px] text-[#8a8a94]">
            {rtl ? "مع أطيب التحيات،" : "Best regards,"}
            <br />
            <span className="text-[#c9c9d1]">{rtl ? `فريق ${brand}` : `The ${brand} team`}</span>
          </div>

          {/* footer */}
          <div className="border-t border-white/[0.07] bg-black/40 px-7 py-5 text-[10.5px] leading-relaxed text-[#6b6b76]">
            <p>
              <span className="font-semibold text-[#8a8a94]">{rtl ? "تحذير من المخاطر: " : "Risk warning: "}</span>
              {rtl
                ? "عقود الفروقات أدوات معقدة وتنطوي على مخاطر عالية لفقدان الأموال بسرعة بسبب الرافعة المالية. يجب أن تفكر فيما إذا كنت تستطيع تحمل مخاطر خسارة أموالك."
                : "CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage. 74% of retail investor accounts lose money when trading CFDs. You should consider whether you can afford to take the high risk of losing your money."}
            </p>
            <p className="mt-2">Ezymex Markets Ltd · FSA Seychelles SD142 · CT House, Providence, Mahé, Seychelles</p>
            <p className="mt-2 flex flex-wrap gap-x-3 text-[#8a8a94]">
              <span className="underline decoration-white/20">{rtl ? "إعدادات البريد" : "Email preferences"}</span>
              <span className="underline decoration-white/20">{rtl ? "سياسة الخصوصية" : "Privacy policy"}</span>
              <span className="underline decoration-white/20">{rtl ? "إلغاء الاشتراك" : "Unsubscribe"}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
