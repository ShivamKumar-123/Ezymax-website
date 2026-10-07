"use client";

/*
 * Kalks Trader design-system pieces (docs/TERMINAL-DESIGN.md §2.4). Desktop and phone layouts share them: sizes are
 * props, never breakpoints. Older dense primitives (TButton, TIcon, Stepper…) stay in primitives.tsx.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { CircleHelp, Minus, Plus } from "lucide-react";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

type TipSide = "top" | "bottom" | "left" | "right";

/**
 * Lightweight tooltip: hover (after a short delay) or keyboard focus shows `content` next to the child. Portaled
 * above dialogs and menus; flips to stay inside the viewport. The child keeps its own handlers.
 */
export function Tip({ content, children, side = "top", shortcut, delay = 350, maxWidth = 280 }: { content: React.ReactNode; children: React.ReactElement; side?: TipSide; shortcut?: string; delay?: number; maxWidth?: number }) {
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = React.useId();
  const show = (el: Element, now = false) => {
    if (timer.current) clearTimeout(timer.current);
    const go = () => setRect(el.getBoundingClientRect());
    if (now) go();
    else timer.current = setTimeout(go, delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setRect(null);
  };
  React.useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  React.useEffect(() => {
    if (!rect) return;
    const off = () => setRect(null);
    window.addEventListener("scroll", off, true);
    window.addEventListener("pointerdown", off, true);
    window.addEventListener("keydown", off, true);
    return () => {
      window.removeEventListener("scroll", off, true);
      window.removeEventListener("pointerdown", off, true);
      window.removeEventListener("keydown", off, true);
    };
  }, [rect]);
  if (content === null || content === undefined || content === "") return children;
  const child = children as React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  const p = child.props;
  const trigger = React.cloneElement(child, {
    "aria-describedby": rect ? id : p["aria-describedby"],
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => (p.onMouseEnter?.(e), show(e.currentTarget)),
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => (p.onMouseLeave?.(e), hide()),
    onFocus: (e: React.FocusEvent<HTMLElement>) => (p.onFocus?.(e), e.currentTarget.matches(":focus-visible") && show(e.currentTarget, true)),
    onBlur: (e: React.FocusEvent<HTMLElement>) => (p.onBlur?.(e), hide()),
  } as React.HTMLAttributes<HTMLElement>);
  return (
    <>
      {trigger}
      {rect && <TipLayer id={id} rect={rect} side={side} maxWidth={maxWidth} shortcut={shortcut}>{content}</TipLayer>}
    </>
  );
}

function TipLayer({ id, rect, side, maxWidth, shortcut, children }: { id: string; rect: DOMRect; side: TipSide; maxWidth: number; shortcut?: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { dir } = useLocale();
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const G = 8;
    let s = side;
    if (s === "top" && rect.top - h - G < 8) s = "bottom";
    else if (s === "bottom" && rect.bottom + h + G > vh - 8) s = "top";
    else if (s === "left" && rect.left - w - G < 8) s = "right";
    else if (s === "right" && rect.right + w + G > vw - 8) s = "left";
    let x = s === "left" ? rect.left - w - G : s === "right" ? rect.right + G : rect.left + rect.width / 2 - w / 2;
    let y = s === "top" ? rect.top - h - G : s === "bottom" ? rect.bottom + G : rect.top + rect.height / 2 - h / 2;
    x = Math.max(8, Math.min(x, vw - w - 8));
    y = Math.max(8, Math.min(y, vh - h - 8));
    setPos({ x, y });
  }, [rect, side]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      id={id}
      role="tooltip"
      dir={dir}
      className="t-tip t-glass-strong pointer-events-none fixed z-[95] rounded-[9px] border border-line-top px-2.5 py-1.5 text-[12.5px] leading-[17px] text-fg shadow-[var(--t-shadow-pop)]"
      style={{ left: pos?.x ?? -9999, top: pos?.y ?? 0, maxWidth, visibility: pos ? "visible" : "hidden" }}
    >
      {children}
      {shortcut && (
        <span dir="ltr" className="ms-2 inline-flex h-[18px] items-center rounded-[4px] border border-line bg-surface-3 px-1 align-middle font-mono text-[10.5px] text-fg-2">
          {shortcut}
        </span>
      )}
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "buy" | "sell" | "danger" | "soft";
/** Compact desktop scale (docs/TERMINAL-DESIGN.md §2.4): sm 24 · md 28 (default) · lg 32 · xl 40 (the one primary action of a panel). */
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "h-6 gap-1 rounded-[6px] px-2 text-[12px] [&_svg]:size-3.5",
  md: "h-7 gap-1.5 rounded-[7px] px-2.5 text-[13px] [&_svg]:size-3.5",
  lg: "h-8 gap-1.5 rounded-[8px] px-3 text-[13px] [&_svg]:size-4",
  xl: "h-10 gap-2 rounded-[10px] px-4 text-[14px] [&_svg]:size-4",
};
const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent-strong font-semibold text-white hover:brightness-110 active:brightness-95",
  secondary: "border border-line bg-panel-2 font-medium text-fg hover:border-line-top hover:bg-surface-3 active:brightness-95",
  ghost: "font-medium text-fg-2 hover:bg-surface-3 hover:text-fg",
  outline: "border border-line font-medium text-fg-2 hover:border-fg-3/60 hover:text-fg",
  soft: "bg-ember-soft font-semibold text-accent-text hover:bg-ember/20",
  buy: "bg-buy-fill font-semibold text-white hover:brightness-110 active:brightness-95",
  sell: "bg-sell-fill font-semibold text-white hover:brightness-110 active:brightness-95",
  danger: "border border-line font-medium text-down hover:border-down/40 hover:bg-down-soft",
};

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; tip?: React.ReactNode; shortcut?: string }>(function Button({ className, variant = "secondary", size = "md", tip, shortcut, type = "button", ...p }, ref) {
  const b = (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-[background-color,color,border-color,filter] disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0",
        BTN_SIZE[size],
        BTN_VARIANT[variant],
        className,
      )}
      {...p}
    />
  );
  return tip || shortcut ? (
    <Tip content={tip} shortcut={shortcut}>
      {b}
    </Tip>
  ) : (
    b
  );
});

/** Square icon-only button: `label` is required (aria-label + tooltip); `shortcut` is added to the tooltip. */
export const IconButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; shortcut?: string; active?: boolean; size?: "sm" | "md" | "lg"; tipSide?: TipSide; badge?: React.ReactNode }>(function IconButton({ label, shortcut, active, size = "md", className, tipSide = "bottom", badge, children, type = "button", ...p }, ref) {
  return (
    <Tip content={label} shortcut={shortcut} side={tipSide}>
      <button
        ref={ref}
        type={type}
        aria-label={label}
        aria-pressed={active === undefined ? undefined : active}
        className={cn(
          "relative inline-grid shrink-0 place-items-center rounded-[8px] transition-colors disabled:pointer-events-none disabled:opacity-45",
          size === "sm" ? "size-6 rounded-[6px] [&_svg]:size-3.5" : size === "lg" ? "size-8 [&_svg]:size-4" : "size-7 rounded-[7px] [&_svg]:size-4",
          active ? "bg-ember-soft text-accent-text" : "text-fg-2 hover:bg-surface-3 hover:text-fg",
          className,
        )}
        {...p}
      >
        {children}
        {badge}
      </button>
    </Tip>
  );
});

/* ------------------------------------------------------------------ */
/* Plain-language help                                                 */
/* ------------------------------------------------------------------ */

/** A small (?) that explains a term in plain words (hover, focus or click). */
export function HelpTip({ title, text, className, side = "top" }: { title?: React.ReactNode; text: React.ReactNode; className?: string; side?: TipSide }) {
  const t = useT();
  return (
    <Tip
      side={side}
      delay={120}
      maxWidth={300}
      content={
        <span className="block">
          {title && <span className="mb-0.5 block font-semibold">{title}</span>}
          <span className="block text-fg-2">{text}</span>
        </span>
      }
    >
      <button type="button" aria-label={typeof title === "string" ? t("desk.help.whatIs", { term: title }) : t("desk.help.explain")} className={cn("inline-grid size-4 shrink-0 cursor-help place-items-center rounded-full text-fg-3 hover:text-fg", className)} onClick={(e) => e.preventDefault()}>
        <CircleHelp className="size-3.5" />
      </button>
    </Tip>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control, switch, chips                                    */
/* ------------------------------------------------------------------ */

export function Segmented<V extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
  label,
  stretch = true,
}: {
  value: V;
  onChange: (v: V) => void;
  options: readonly { value: V; label: React.ReactNode; icon?: React.ReactNode; tip?: React.ReactNode; disabled?: boolean }[];
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
  stretch?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex shrink-0 items-stretch gap-0.5 rounded-[8px] border border-line bg-panel-2 p-0.5", stretch && "grid", className)} style={stretch ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}>
      {options.map((o) => {
        const on = o.value === value;
        const b = (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] px-2 font-medium transition-colors disabled:opacity-45 [&_svg]:size-3.5 [&_svg]:shrink-0",
              size === "sm" ? "h-5 text-[12px]" : size === "lg" ? "h-8 text-[13px]" : "h-6 text-[12.5px]",
              on ? "bg-surface-3 text-fg shadow-[inset_0_1px_0_var(--k-border-top)]" : "text-fg-2 hover:bg-surface-3/50 hover:text-fg",
            )}
          >
            {o.icon}
            <span className="truncate">{o.label}</span>
          </button>
        );
        return o.tip ? (
          <Tip key={o.value} content={o.tip}>
            {b}
          </Tip>
        ) : (
          b
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled, size = "md", className }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; size?: "sm" | "md"; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative shrink-0 rounded-full transition-colors disabled:opacity-45", size === "sm" ? "h-4 w-7" : "h-5 w-9", checked ? "bg-accent-strong" : "bg-surface-3 ring-1 ring-inset ring-line-top", className)}
    >
      <span className={cn("absolute top-0.5 rounded-full bg-white shadow transition-all", size === "sm" ? "size-3" : "size-4", checked ? (size === "sm" ? "left-[14px]" : "left-[18px]") : "left-0.5")} />
    </button>
  );
}

export function Chip({ active, onClick, children, count, className, icon, title }: { active?: boolean; onClick?: () => void; children?: React.ReactNode; count?: number; className?: string; icon?: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-[7px] border px-2 text-[12px] font-medium transition-colors [&_svg]:size-3.5",
        active ? "border-ember/45 bg-ember-soft text-accent-text" : "border-line text-fg-2 hover:border-line-top hover:bg-surface-3 hover:text-fg",
        className,
      )}
    >
      {icon}
      {children}
      {count !== undefined && <span className={cn("k-num font-mono text-[11px]", active ? "text-accent-text/80" : "text-fg-3")}>{count}</span>}
    </button>
  );
}

/** Count pill used on tabs and buttons. */
export function CountBadge({ n, tone = "neutral", className }: { n: number; tone?: "neutral" | "accent" | "up" | "down" | "warn"; className?: string }) {
  return (
    <span
      className={cn(
        "k-num inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10.5px] font-medium leading-none",
        tone === "accent" ? "bg-ember-soft text-accent-text" : tone === "up" ? "bg-up-soft text-up" : tone === "down" ? "bg-down-soft text-down" : tone === "warn" ? "bg-warn-soft text-warn" : "bg-surface-3 text-fg-2",
        className,
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Form layout                                                         */
/* ------------------------------------------------------------------ */

export function FieldLabel({ children, help, right, htmlFor, className }: { children: React.ReactNode; help?: React.ReactNode; right?: React.ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={cn("mb-1 flex min-h-5 items-center gap-1.5 text-[12px] font-medium text-fg-2", className)}>
      <label htmlFor={htmlFor} className="truncate">
        {children}
      </label>
      {help}
      {right && <span className="ms-auto flex shrink-0 items-center gap-1">{right}</span>}
    </div>
  );
}

/** Small uppercase-free section heading inside panels and dialogs. */
export function SectionTitle({ children, right, className }: { children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 text-[12px] font-semibold text-fg-2", className)}>
      <span>{children}</span>
      {right && <span className="ms-auto flex items-center gap-1">{right}</span>}
    </div>
  );
}

/** Empty state: icon, one sentence, one action. */
export function EmptyState({ icon, title, text, action, className }: { icon?: React.ReactNode; title: React.ReactNode; text?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid h-full min-h-28 place-items-center p-5 text-center", className)}>
      <div className="max-w-[360px]">
        {icon && <div className="mx-auto mb-2.5 grid size-10 place-items-center rounded-full border border-line bg-panel-2 text-fg-3 [&>svg]:size-[18px]">{icon}</div>}
        <div className="text-[13.5px] font-medium text-fg">{title}</div>
        {text && <p className="mt-1 text-[12.5px] leading-[18px] text-fg-3">{text}</p>}
        {action && <div className="mt-3 flex justify-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Order-form pieces: label-value rows, quick-adjust strip, summaries   */
/* ------------------------------------------------------------------ */

/** Full-width rounded row: grey label on the left, the value or a control on the right (order forms). */
export function FieldRow({ label, help, children, className, htmlFor, tone }: { label: React.ReactNode; help?: React.ReactNode; children?: React.ReactNode; className?: string; htmlFor?: string; tone?: "up" | "down" }) {
  return (
    <div className={cn("flex min-h-9 items-center gap-2 rounded-[10px] border bg-panel-2 ps-3 pe-1", tone === "down" ? "border-down/25" : tone === "up" ? "border-up/25" : "border-line", "focus-within:border-ember/50", className)}>
      <label htmlFor={htmlFor} className="flex min-w-0 shrink-0 items-center gap-1 text-[12.5px] text-fg-2">
        {label}
        {help}
      </label>
      <div className="ms-auto flex min-w-0 items-center justify-end gap-1">{children}</div>
    </div>
  );
}

/** A number edited inside a FieldRow: − value + (arrow keys and wheel step too). */
export function InlineNumber({ value, onChange, step, decimals, min = 0, id, ariaLabel, placeholder, suffix, className, tone }: { value: string; onChange: (v: string) => void; step: number; decimals: number; min?: number; id?: string; ariaLabel: string; placeholder?: string; suffix?: React.ReactNode; className?: string; tone?: "up" | "down" }) {
  const t = useT();
  const bump = (d: number) => {
    const n = parseFloat(value || placeholder || "0") || 0;
    onChange(Math.max(min, n + d * step).toFixed(decimals));
  };
  return (
    <span className={cn("flex items-center", className)}>
      <button type="button" tabIndex={-1} onClick={() => bump(-1)} aria-label={t("trader.stepper.decrease")} className="grid size-6 shrink-0 place-items-center rounded-[6px] text-fg-3 hover:bg-surface-3 hover:text-fg">
        <Minus className="size-3.5" />
      </button>
      <input
        id={id}
        aria-label={ariaLabel}
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            bump(e.key === "ArrowUp" ? 1 : -1);
          }
        }}
        onWheel={(e) => document.activeElement === e.currentTarget && bump(e.deltaY < 0 ? 1 : -1)}
        className={cn("k-num h-7 w-[84px] min-w-0 bg-transparent text-end font-mono text-[13.5px] font-medium outline-none placeholder:text-fg-3", tone === "down" ? "text-down" : tone === "up" ? "text-up" : "text-fg")}
      />
      {suffix && <span className="ps-1 text-[12px] text-fg-3">{suffix}</span>}
      <button type="button" tabIndex={-1} onClick={() => bump(1)} aria-label={t("trader.stepper.increase")} className="grid size-6 shrink-0 place-items-center rounded-[6px] text-fg-3 hover:bg-surface-3 hover:text-fg">
        <Plus className="size-3.5" />
      </button>
    </span>
  );
}

/** One rounded strip of equal cells for quick values (volume presets, contracts, strike range). */
export function QuickStrip<V extends string | number>({ options, value, onPick, label, className, format }: { options: readonly V[]; value?: V | null; onPick: (v: V) => void; label: string; className?: string; format?: (v: V) => React.ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid h-7 overflow-hidden rounded-[8px] border border-line bg-panel-2", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o, i) => {
        const on = value !== undefined && value !== null && o === value;
        return (
          <button
            key={String(o)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(o)}
            className={cn("k-num min-w-0 truncate font-mono text-[12.5px] transition-colors", i > 0 && "border-s border-line", on ? "bg-surface-3 font-semibold text-fg" : "text-fg-2 hover:bg-surface-3/60 hover:text-fg")}
          >
            {format ? format(o) : String(o)}
          </button>
        );
      })}
    </div>
  );
}

/** Summary line under a form: grey label, value on the right. */
export function SummaryRow({ label, help, children, className }: { label: React.ReactNode; help?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-6 items-center gap-1.5 text-[12.5px]", className)}>
      <span className="flex items-center gap-1 text-fg-2">
        {label}
        {help}
      </span>
      <span className="k-num ms-auto truncate font-mono text-fg">{children}</span>
    </div>
  );
}

/** Tiny uppercase stat: grey label over a value (instrument stats, account health). */
export function Stat({ label, children, help, className, title }: { label: React.ReactNode; children: React.ReactNode; help?: React.ReactNode; className?: string; title?: string }) {
  return (
    <div className={cn("flex min-w-0 shrink-0 flex-col justify-center", className)} title={title}>
      <span className="flex items-center gap-1 text-[10.5px] font-medium uppercase leading-[14px] tracking-[0.06em] text-fg-3">
        {label}
        {help}
      </span>
      <span className="k-num truncate font-mono text-[13px] leading-[18px] text-fg" dir="ltr">
        {children}
      </span>
    </div>
  );
}
