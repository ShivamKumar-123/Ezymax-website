"use client";

// First-run tours (docs/TERMINAL-DESIGN.md §2.5), five short steps each on the real screen. CFD: find a market (the
// Instruments column) → Sell / Buy on the chart → the order form → positions below → the ☰ menu. Options: the
// underlying → Quick trade → the option chain → positions and settlement → the plain-language glossary. Each runs once
// per browser on desktop (never for read-only sessions); ☰ › Take the tour starts the one for the current mode.
// Esc or "Skip tour" ends it.
import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@ezymex/ui";
import { useLocale, useT } from "@ezymex/i18n/react";
import type { MessageKey } from "@ezymex/i18n";
import { useTerminal } from "@/lib/store";
import { useTradeMode, type TradeMode } from "@/lib/options/mode";
import { Button } from "@/components/ui/kit";
import { showSide } from "./commands";

const DONE_KEY: Record<TradeMode, string> = { cfd: "ezymex.terminal.tour.v1", options: "ezymex.terminal.tour.options.v1" };

type Step = { target: string; title: MessageKey; text: MessageKey; guestText?: MessageKey; open?: (T: ReturnType<typeof useTerminal>) => void; account?: boolean };

const STEPS: Record<TradeMode, Step[]> = {
  cfd: [
    { target: "markets", title: "desk.tour3.1.title", text: "desk.tour3.1.text", open: (T) => showSide(T, "instruments") },
    { target: "oneclick", title: "desk.tour3.2.title", text: "desk.tour3.2.text", guestText: "desk.tour.guest.2.text" },
    { target: "new-order", title: "desk.tour3.3.title", text: "desk.tour3.3.text", account: true },
    { target: "activity", title: "desk.tour3.4.title", text: "desk.tour3.4.text" },
    { target: "menu", title: "desk.tour3.5.title", text: "desk.tour3.5.text" },
  ],
  options: [
    { target: "opt-underlying", title: "desk.tourO.1.title", text: "desk.tourO.1.text" },
    { target: "opt-quick", title: "desk.tourO.2.title", text: "desk.tourO.2.text" },
    { target: "opt-tabs", title: "desk.tourO.3b.title", text: "desk.tourO.3b.text" },
    { target: "activity", title: "desk.tourO.4.title", text: "desk.tourO.4.text" },
    { target: "menu", title: "desk.tourO.5.title", text: "desk.tourO.5.text" },
  ],
};

function seen(mode: TradeMode) {
  try {
    return !!localStorage.getItem(DONE_KEY[mode]);
  } catch {
    return true;
  }
}
function markSeen(mode: TradeMode) {
  try {
    localStorage.setItem(DONE_KEY[mode], String(Date.now()));
  } catch {
    /* storage blocked */
  }
}

export function Tour() {
  const T = useTerminal();
  const mode = useTradeMode();
  // first visit of each mode: start once the workspace has settled
  React.useEffect(() => {
    if (T.readOnly || seen(mode)) return;
    const id = setTimeout(() => T.setUi({ tour: true }), mode === "options" ? 2200 : 1200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  if (!T.ui.tour) return null;
  return <TourLayer key={mode} steps={STEPS[mode]} onEnd={() => (markSeen(mode), T.setUi({ tour: false }))} />;
}

function TourLayer({ onEnd, steps: all }: { onEnd: () => void; steps: Step[] }) {
  const T = useTerminal();
  const t = useT();
  const { dir } = useLocale();
  const steps = React.useMemo(() => all.filter((s) => !(T.guest || T.readOnly) || !s.account), [all, T.guest, T.readOnly]);
  // the steps point at the first screen
  React.useEffect(() => {
    // block body: scrollTo returns a Promise in recent Chrome, and an effect may only return a cleanup function
    window.scrollTo({ top: 0 });
  }, []);
  const [i, setI] = React.useState(0);
  const step = steps[Math.min(i, steps.length - 1)]!;
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const card = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  const next = React.useRef<HTMLButtonElement>(null);

  // open the step's panel, then measure its target (and keep measuring: panels resize, prices re-layout)
  React.useEffect(() => {
    step.open?.(T);
    const measure = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    const id = setTimeout(() => {
      document.querySelector(`[data-tour="${step.target}"]`)?.scrollIntoView({ block: "nearest" });
      measure();
    }, 120);
    const loop = setInterval(measure, 400);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(id);
      clearInterval(loop);
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // place the card beside the target: right, left, below, above, else centred
  React.useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const G = 14;
    if (!rect) return setPos({ x: (vw - w) / 2, y: (vh - h) / 2 });
    const clampY = (y: number) => Math.max(12, Math.min(y, vh - h - 12));
    const clampX = (x: number) => Math.max(12, Math.min(x, vw - w - 12));
    if (rect.right + G + w < vw - 12) return setPos({ x: rect.right + G, y: clampY(rect.top + rect.height / 2 - h / 2) });
    if (rect.left - G - w > 12) return setPos({ x: rect.left - G - w, y: clampY(rect.top + rect.height / 2 - h / 2) });
    if (rect.bottom + G + h < vh - 12) return setPos({ x: clampX(rect.left + rect.width / 2 - w / 2), y: rect.bottom + G });
    if (rect.top - G - h > 12) return setPos({ x: clampX(rect.left + rect.width / 2 - w / 2), y: rect.top - G - h });
    setPos({ x: (vw - w) / 2, y: (vh - h) / 2 });
  }, [rect, i]);

  React.useEffect(() => {
    next.current?.focus();
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onEnd();
      } else if (e.key === "ArrowRight") setI((x) => Math.min(steps.length - 1, x + 1));
      else if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onEnd, steps.length, i]);

  if (typeof document === "undefined") return null;
  const last = i >= steps.length - 1;
  const PAD = 6;
  return createPortal(
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal aria-labelledby="k-tour-title" dir={dir}>
      {/* dim everything except the target */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-[12px] transition-all duration-300"
          style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: "0 0 0 2px var(--k-ember), 0 0 0 9999px rgba(0,0,0,0.58)" }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/55" />
      )}
      <div className="absolute inset-0" onMouseDown={(e) => e.preventDefault()} />
      <div
        ref={card}
        className="t-pop t-glass-strong absolute w-[320px] rounded-[16px] border border-line-top p-3.5 shadow-[var(--t-shadow-pop)]"
        style={{ left: pos?.x ?? -9999, top: pos?.y ?? 0, visibility: pos ? "visible" : "hidden" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-accent-text">{t("desk.tour.step", { n: i + 1, total: steps.length })}</span>
          <button onClick={onEnd} aria-label={t("desk.tour.skip")} className="ms-auto grid size-7 place-items-center rounded-[7px] text-fg-3 hover:bg-surface-3 hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
        <h2 id="k-tour-title" className="mt-1 text-[15px] font-semibold text-fg">
          {t(step.title)}
        </h2>
        <p className="mt-1 text-[13px] leading-[19px] text-fg-2">{T.guest && step.guestText ? t(step.guestText) : t(step.text)}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="flex gap-1" aria-hidden>
            {steps.map((_, n) => (
              <span key={n} className={cn("h-1.5 rounded-full transition-all", n === i ? "w-5 bg-ember" : "w-1.5 bg-surface-3")} />
            ))}
          </span>
          <span className="ms-auto flex gap-1.5">
            {i > 0 ? (
              <Button variant="ghost" onClick={() => setI(i - 1)}>
                {t("desk.tour.back")}
              </Button>
            ) : (
              <Button variant="ghost" onClick={onEnd}>
                {t("desk.tour.skip")}
              </Button>
            )}
            <Button ref={next} variant="primary" onClick={() => (last ? onEnd() : setI(i + 1))}>
              {last ? t("desk.tour.done") : t("desk.tour.next")}
            </Button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
