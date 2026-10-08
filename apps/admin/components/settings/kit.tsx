"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Eye, EyeOff, RotateCcw, Save } from "lucide-react";
import { Button, CopyButton, Icon3D, CoinIcon, cn } from "@ezymex/ui";

/** Native <select> styled like the Ezymex `Input`. */
export function SelectInput({
  value,
  onChange,
  options,
  className,
  disabled,
  leading,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly (string | { value: string; label: string })[];
  className?: string;
  disabled?: boolean;
  leading?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex h-11 items-center gap-2 rounded-[14px] border border-line bg-surface-2 px-3.5 text-sm transition-colors focus-within:border-ember/50 focus-within:ring-4 focus-within:ring-ember/10",
        disabled && "opacity-50",
        className,
      )}
    >
      {leading && <span className="flex shrink-0 items-center text-fg-3 [&_svg]:size-4">{leading}</span>}
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-full min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-6 text-fg outline-none [&>option]:bg-surface"
      >
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const l = typeof o === "string" ? o : o.label;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 size-4 text-fg-3" />
    </div>
  );
}

/** Masked secret input with reveal (eye) + copy. */
export function SecretInput({
  value,
  reveal,
  placeholder,
  onChange,
  disabled,
}: {
  value: string;
  reveal?: string;
  placeholder?: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
}) {
  const [show, setShow] = React.useState(false);
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? (show ? reveal ?? value : value);
  return (
    <div
      className={cn(
        "flex h-11 items-center gap-2 rounded-[14px] border border-line bg-surface-2 px-3.5 text-sm transition-colors focus-within:border-ember/50 focus-within:ring-4 focus-within:ring-ember/10",
        disabled && "opacity-50",
      )}
    >
      <input
        value={shown}
        disabled={disabled}
        placeholder={placeholder}
        type={draft !== null && !show ? "password" : "text"}
        spellCheck={false}
        autoComplete="off"
        onFocus={() => {
          if (draft === null && !value) setDraft("");
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange?.(e.target.value);
        }}
        className="h-full min-w-0 flex-1 bg-transparent font-mono text-[12.5px] text-fg outline-none placeholder:font-sans placeholder:text-fg-3"
      />
      {(value || draft) && (
        <span className="flex shrink-0 items-center gap-0.5 text-fg-3">
          <button type="button" onClick={() => setShow((s) => !s)} className="grid size-6 place-items-center rounded-md hover:bg-surface-3 hover:text-fg" aria-label={show ? "Hide" : "Reveal"}>
            {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
          <CopyButton value={draft ?? reveal ?? value} label="Secret" />
        </span>
      )}
    </div>
  );
}

/** Glossy tile holding a 3D icon (or a coin logo via "coin:trx"). */
export function LogoTile({ icon, size = 48, className }: { icon: string; size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-[14px] border border-line bg-[radial-gradient(circle_at_30%_20%,var(--k-surface-3),var(--k-surface-2)_70%)] shadow-[inset_0_1px_0_var(--k-border-top)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {icon.startsWith("coin:") ? <CoinIcon coin={icon.slice(5)} size={size * 0.6} /> : <Icon3D name={icon} size={size * 0.72} />}
    </span>
  );
}

/** Small uppercase section label with a hairline. */
export function SectionLabel({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="k-label shrink-0">{children}</span>
      <span className="h-px flex-1 bg-line" />
      {action}
    </div>
  );
}

/** Floating save bar that slides up when a form is dirty. */
export function SaveBar({ dirty, onSave, onReset, label = "You have unsaved changes" }: { dirty: boolean; onSave: () => void; onReset: () => void; label?: string }) {
  return (
    <AnimatePresence>
      {dirty && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
          className="fixed inset-x-0 bottom-20 z-40 mx-auto flex w-[min(560px,calc(100vw-24px))] items-center gap-3 rounded-full border border-line bg-surface-2/95 py-2 pl-5 pr-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8),inset_0_1px_0_var(--k-border-top)] backdrop-blur md:bottom-6"
        >
          <span className="size-2 animate-pulse rounded-full bg-ember" />
          <span className="flex-1 truncate text-[13px] text-fg-2">{label}</span>
          <Button size="sm" variant="ghost" onClick={onReset}>
            <RotateCcw /> Discard
          </Button>
          <Button size="sm" variant="ember" onClick={onSave}>
            <Save /> Save changes
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Compact label/value inner row. */
export function MiniStat({ label, value, className }: { label: React.ReactNode; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("k-row px-4 py-3", className)}>
      <div className="text-[11px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className="k-num mt-1 text-[15px] font-medium text-fg">{value}</div>
    </div>
  );
}

/** Renders children only after mount (avoids SSR/CSR float mismatches in shared SVG widgets such as WorldMap). */
export function ClientOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const [m, setM] = React.useState(false);
  React.useEffect(() => setM(true), []);
  return <>{m ? children : fallback}</>;
}

/** Brand asset renderer: the Ezymex SVGs use currentColor, so render them as a CSS mask; uploaded files render as <img>. */
export function BrandImg({ src, className, color = "#F5F5F7", ratio }: { src: string; className?: string; color?: string; ratio?: number }) {
  if (src.startsWith("/assets/brand/")) {
    const r = ratio ?? (src.includes("mark") ? 652 / 460 : 2801 / 559);
    return (
      <span
        role="img"
        aria-label="Ezymex"
        className={cn("inline-block", className)}
        style={{ aspectRatio: r, backgroundColor: color, WebkitMask: `url(${src}) center / contain no-repeat`, mask: `url(${src}) center / contain no-repeat` }}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Logo" className={cn("object-contain", className)} />;
}
