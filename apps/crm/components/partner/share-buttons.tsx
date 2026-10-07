"use client";

import * as React from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, cn } from "@/components/kit";
import { useT } from "@kalks/i18n/react";

const WA = (
  <svg viewBox="0 0 24 24" className="size-4 fill-current">
    <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.98L2 22l5.16-1.5A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.06.89.9-2.98-.2-.31a8.2 8.2 0 1 1 6.84 3.72Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.55.12-.16.25-.63.8-.78.96-.14.16-.29.18-.53.06a6.7 6.7 0 0 1-3.34-2.92c-.25-.43.25-.4.72-1.33.08-.16.04-.3-.02-.43-.06-.12-.55-1.32-.75-1.8-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.3 2.74 2.74 0 0 0-.86 2.04 4.76 4.76 0 0 0 1 2.53 10.9 10.9 0 0 0 4.18 3.69c1.55.67 2.16.73 2.94.61.47-.07 1.46-.6 1.66-1.18.2-.58.2-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
  </svg>
);
const TG = (
  <svg viewBox="0 0 24 24" className="size-4 fill-current">
    <path d="M21.94 4.3 18.9 19.1c-.23 1.03-.83 1.28-1.69.8l-4.66-3.44-2.25 2.17c-.25.25-.46.46-.94.46l.34-4.74 8.62-7.79c.37-.33-.08-.52-.58-.19L7.1 13.08 2.5 11.64c-1-.31-1.02-1 .21-1.48l17.95-6.92c.83-.31 1.56.19 1.28 1.06Z" />
  </svg>
);
const XL = (
  <svg viewBox="0 0 24 24" className="size-3.5 fill-current">
    <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.2h1.7L7.4 4.73H5.58L16.67 19.2Z" />
  </svg>
);

export function ShareButtons({ url, text: textProp, className }: { url: string; text?: string; className?: string }) {
  const t = useT();
  const text = textProp ?? t("partner.share.defaultText");
  const enc = encodeURIComponent;
  const items = [
    { key: "wa", label: "WhatsApp", icon: WA, href: `https://wa.me/?text=${enc(`${text} ${url}`)}` },
    { key: "tg", label: "Telegram", icon: TG, href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}` },
    { key: "x", label: "X", icon: XL, href: `https://x.com/intent/tweet?text=${enc(text)}&url=${enc(url)}` },
    { key: "mail", label: t("common.email"), icon: <Mail className="size-4" />, href: `mailto:?subject=${enc(t("partner.share.emailSubject"))}&body=${enc(`${text} ${url}`)}` },
  ];
  return (
    <div className={cn("grid grid-cols-4 gap-2", className)}>
      {items.map((it) => (
        <Tooltip key={it.key} content={t("partner.share.shareOn", { name: it.label })}>
          <a
            href={it.href}
            target="_blank"
            rel="noreferrer"
            onClick={() => toast.success(t("partner.share.opening", { name: it.label }), { description: t("partner.share.prefilled") })}
            className="flex h-10 items-center justify-center gap-2 rounded-full border border-line bg-surface-2 text-[12.5px] font-medium text-fg-2 shadow-[inset_0_1px_0_var(--k-border-top)] transition-colors hover:bg-surface-3 hover:text-fg"
          >
            {it.icon}
            <span className="hidden sm:inline xl:hidden 2xl:inline">{it.label}</span>
          </a>
        </Tooltip>
      ))}
    </div>
  );
}
