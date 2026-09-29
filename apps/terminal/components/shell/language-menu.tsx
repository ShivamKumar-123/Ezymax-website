"use client";

import { Flag, cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { LOCALES } from "@kalks/i18n/locales";
import { DropMenu } from "@/components/ui/menu";

/** Interface language (same cookie as the Client Area). Native names; the current one is checked. */
export function LanguageMenu({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  const t = useT();
  const { locale, info, setLocale } = useLocale();
  return (
    <DropMenu
      align="end"
      width={232}
      items={[
        { header: t("common.language") },
        ...LOCALES.map((l) => ({ label: l.name, icon: <Flag country={l.flag} className="size-3.5" />, hint: l.code === "en" ? undefined : l.english, checked: locale === l.code, onSelect: () => void setLocale(l.code) })),
      ]}
      trigger={({ toggle, open }) => (
        <button
          onClick={toggle}
          className={cn("grid place-items-center rounded-[7px] text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg", size === "md" ? "size-8" : "size-9", open && "bg-surface-3 text-fg", className)}
          aria-label={`${t("common.language")}: ${info.name}`}
          title={t("common.language")}
        >
          <Flag country={info.flag} className="size-4" />
        </button>
      )}
    />
  );
}
