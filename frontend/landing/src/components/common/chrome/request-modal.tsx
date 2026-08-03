"use client";

import { animated, useSpring } from "@react-spring/web";
import { useEffect, useState, type FormEvent } from "react";

import { Close } from "@/components/ui/icons";
import { PillButton } from "@/components/ui/pill-button";
import { useScroll } from "@/hooks/smooth-scroll/use-scroll";
import { useUi } from "@/lib/ui-store";
import type { modalContent } from "@/data/mocks/site";

export interface RequestModalProps {
  content: typeof modalContent;
}

const fieldClass =
  "w-full rounded-control border border-line bg-surface-raised/60 px-4 py-3 text-sm outline-none transition-colors duration-[var(--duration-fast)] ease-entrance focus:border-accent/60 focus:bg-surface-raised";
const labelClass =
  "text-xs font-medium font-mono tracking-label text-foreground/50 uppercase";

export const RequestModal = ({ content }: RequestModalProps) => {
  const open = useUi((state) => state.modalOpen);
  const setModalOpen = useUi((state) => state.setModalOpen);
  const startScroll = useScroll((state) => state.start);
  const stopScroll = useScroll((state) => state.stop);
  const [status, setStatus] = useState<"form" | "sending" | "sent">("form");

  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => setStatus("form"), 300);
      return () => clearTimeout(id);
    }
    stopScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      startScroll();
    };
  }, [open, setModalOpen, startScroll, stopScroll]);

  const style = useSpring({
    opacity: open ? 1 : 0,
    y: open ? 0 : 18,
    config: { tension: 260, friction: 30 },
  });

  if (!open) return null;

  // Stubbed on purpose — there is no backend for this form yet.
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setStatus("sending");
    setTimeout(() => setStatus("sent"), 600);
  };

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={content.heading}
      onClick={() => setModalOpen(false)}
      className="fixed inset-0 z-[125] flex items-end justify-center bg-foreground/30 p-4 backdrop-blur-lg sm:items-center"
    >
      <animated.div
        style={{
          opacity: style.opacity,
          transform: style.y.to((y) => `translateY(${y}px)`),
        }}
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden rounded-card bg-surface p-6 shadow-2xl ring-1 ring-line sm:p-8"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => setModalOpen(false)}
          className="absolute top-4 right-4 grid size-9 place-items-center rounded-pill bg-surface-raised text-foreground/60 transition-colors duration-[var(--duration-fast)] ease-entrance hover:bg-line hover:text-foreground"
        >
          <Close />
        </button>

        {status === "sent" ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <span className="grid size-14 place-items-center rounded-pill bg-ink text-2xl text-accent-from">
              ✓
            </span>
            <h2 className="text-2xl font-bold tracking-display">{content.successHeading}</h2>
            <p className="max-w-[32ch] text-sm text-foreground/60">
              {content.successBody}
            </p>
            <PillButton variant="dark" onClick={() => setModalOpen(false)}>
              {content.successCta}
            </PillButton>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-1.5">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground/60">
                <span className="size-1.5 rounded-pill bg-accent" />
                {content.eyebrow}
              </span>
              <h2 className="text-2xl font-bold tracking-display sm:text-3xl">
                {content.heading}
              </h2>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className={labelClass}>{content.fields.name.label}</span>
                <input
                  type="text"
                  required
                  placeholder={content.fields.name.placeholder}
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className={labelClass}>{content.fields.email.label}</span>
                <input
                  type="email"
                  required
                  placeholder={content.fields.email.placeholder}
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className={labelClass}>
                  {content.fields.project.label}
                </span>
                <textarea
                  rows={4}
                  required
                  placeholder={content.fields.project.placeholder}
                  className={`${fieldClass} resize-none`}
                />
              </label>

              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-xs text-foreground/45">
                  {content.note}
                </span>
                <PillButton variant="dark" arrow="up-right" type="submit">
                  {status === "sending" ? content.submitting : content.submit}
                </PillButton>
              </div>
            </form>
          </>
        )}
      </animated.div>
    </div>
  );
};
