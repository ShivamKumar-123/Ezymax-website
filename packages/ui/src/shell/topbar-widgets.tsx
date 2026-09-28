"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Bell, Check, Moon, Search, Sun, CornerDownLeft } from "lucide-react";
import { IconButton, Kbd } from "../components/primitives";
import { Popover } from "../components/overlays";
import { Flag } from "../components/avatars";
import { cn } from "../lib/cn";

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const dark = !mounted || resolvedTheme !== "light";
  return (
    <IconButton aria-label="Toggle theme" onClick={() => setTheme(dark ? "light" : "dark")}>
      {dark ? <Moon /> : <Sun />}
    </IconButton>
  );
}

/* ------------------------------------------------------------------ */
/* Language (all major languages; RTL switches document direction)    */
/* ------------------------------------------------------------------ */

export const LANGUAGES = [
  { code: "en", name: "English", flag: "gb" },
  { code: "hi", name: "हिन्दी", flag: "in" },
  { code: "ar", name: "العربية", flag: "ae", rtl: true },
  { code: "ur", name: "اردو", flag: "pk", rtl: true },
  { code: "fa", name: "فارسی", flag: "ir", rtl: true },
  { code: "es", name: "Español", flag: "es" },
  { code: "pt", name: "Português", flag: "br" },
  { code: "fr", name: "Français", flag: "fr" },
  { code: "de", name: "Deutsch", flag: "de" },
  { code: "it", name: "Italiano", flag: "it" },
  { code: "ru", name: "Русский", flag: "ru" },
  { code: "tr", name: "Türkçe", flag: "tr" },
  { code: "id", name: "Bahasa Indonesia", flag: "id" },
  { code: "ms", name: "Bahasa Melayu", flag: "my" },
  { code: "vi", name: "Tiếng Việt", flag: "vn" },
  { code: "th", name: "ไทย", flag: "th" },
  { code: "zh", name: "中文", flag: "cn" },
  { code: "ja", name: "日本語", flag: "jp" },
  { code: "ko", name: "한국어", flag: "kr" },
  { code: "bn", name: "বাংলা", flag: "bd" },
  { code: "ta", name: "தமிழ்", flag: "in" },
  { code: "sw", name: "Kiswahili", flag: "ke" },
] as const;

export function LanguageMenu() {
  const [lang, setLang] = React.useState("en");
  const [q, setQ] = React.useState("");
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("kalks.lang");
      if (saved) apply(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function apply(code: string) {
    const l = LANGUAGES.find((x) => x.code === code) ?? LANGUAGES[0];
    setLang(l.code);
    document.documentElement.lang = l.code;
    document.documentElement.dir = "rtl" in l && l.rtl ? "rtl" : "ltr";
    try {
      localStorage.setItem("kalks.lang", l.code);
    } catch {}
  }
  const current = LANGUAGES.find((l) => l.code === lang)!;
  const list = LANGUAGES.filter((l) => l.name.toLowerCase().includes(q.toLowerCase()) || l.code.includes(q.toLowerCase()));
  return (
    <Popover
      width={280}
      trigger={
        <IconButton aria-label="Language">
          <Flag country={current.flag} className="size-[18px]" />
        </IconButton>
      }
    >
      <div className="p-2">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3">
          <Search className="size-4 text-fg-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search language" className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-3" />
        </div>
        <div className="mt-2 max-h-72 overflow-y-auto">
          {list.map((l) => (
            <button key={l.code} onClick={() => apply(l.code)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-3", l.code === lang ? "text-fg" : "text-fg-2")}>
              <Flag country={l.flag} className="size-[18px]" />
              <span className="flex-1">{l.name}</span>
              {"rtl" in l && l.rtl && <span className="rounded bg-surface-3 px-1.5 text-[10px] text-fg-3">RTL</span>}
              {l.code === lang && <Check className="size-4 text-ember" />}
            </button>
          ))}
        </div>
      </div>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export function NotificationsPopover({ items }: { items: { id: string; title: string; time: string; unread: boolean; icon?: React.ReactNode }[] }) {
  const [list, setList] = React.useState(items);
  const unread = list.filter((i) => i.unread).length;
  return (
    <Popover
      width={380}
      trigger={
        <IconButton aria-label="Notifications" dot={unread > 0}>
          <Bell />
        </IconButton>
      }
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="text-sm font-medium">
          Notifications {unread > 0 && <span className="ml-1 rounded-full bg-ember-soft px-1.5 text-[11px] text-ember">{unread}</span>}
        </div>
        <button onClick={() => setList((l) => l.map((i) => ({ ...i, unread: false })))} className="text-xs text-fg-3 hover:text-fg">
          Mark all read
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto p-1.5">
        {list.map((n) => (
          <div key={n.id} className="flex gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-fg-2 [&_svg]:size-4">{n.icon}</span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-[13px] leading-snug", n.unread ? "text-fg" : "text-fg-2")}>{n.title}</p>
              <p className="mt-0.5 text-[11.5px] text-fg-3">{n.time} ago</p>
            </div>
            {n.unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-ember" />}
          </div>
        ))}
      </div>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* ⌘K command palette                                                  */
/* ------------------------------------------------------------------ */

export interface CommandItem {
  group: string;
  label: string;
  href: string;
  icon?: React.ReactNode;
  keywords?: string;
}

export function CommandPalette({ items, placeholder = "Search pages, accounts, symbols…" }: { items: CommandItem[]; placeholder?: string }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const groups = Array.from(new Set(items.map((i) => i.group)));
  return (
    <>
      <button onClick={() => setOpen(true)} className="hidden h-10 items-center gap-2 rounded-full border border-line bg-surface/70 pl-3.5 pr-2 text-sm text-fg-3 shadow-[inset_0_1px_0_var(--k-border-top)] hover:text-fg-2 md:flex">
        <Search className="size-4" />
        <span className="w-28 text-left">Search</span>
        <Kbd>⌘K</Kbd>
      </button>
      <IconButton className="md:hidden" aria-label="Search" onClick={() => setOpen(true)}>
        <Search />
      </IconButton>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <DialogPrimitive.Content className="k-card fixed left-1/2 top-[14vh] z-50 w-[calc(100vw-24px)] max-w-[620px] -translate-x-1/2 overflow-hidden rounded-[22px] bg-surface outline-none">
            <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
            <Command loop>
              <div className="flex items-center gap-3 border-b border-line px-5">
                <Search className="size-4 text-fg-3" />
                <Command.Input autoFocus placeholder={placeholder} className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-3" />
                <Kbd>ESC</Kbd>
              </div>
              <Command.List className="max-h-[420px] overflow-y-auto p-2">
                <Command.Empty className="px-4 py-10 text-center text-sm text-fg-3">No results found.</Command.Empty>
                {groups.map((g) => (
                  <Command.Group key={g} heading={g} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-3">
                    {items
                      .filter((i) => i.group === g)
                      .map((i) => (
                        <Command.Item
                          key={i.href + i.label}
                          value={`${i.label} ${i.keywords ?? ""}`}
                          onSelect={() => {
                            setOpen(false);
                            router.push(i.href);
                          }}
                          className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg-2 data-[selected=true]:bg-surface-3 data-[selected=true]:text-fg"
                        >
                          <span className="grid size-8 place-items-center rounded-lg border border-line bg-surface-2 [&_svg]:size-4">{i.icon}</span>
                          <span className="flex-1">{i.label}</span>
                          <CornerDownLeft className="size-3.5 opacity-0 group-data-[selected=true]:opacity-100" />
                        </Command.Item>
                      ))}
                  </Command.Group>
                ))}
              </Command.List>
            </Command>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
