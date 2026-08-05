"use client";

import { animated, useSpring } from "@react-spring/web";
import { useEffect, useState, type FormEvent } from "react";

import { Close } from "@/components/ui/icons";
import { PillButton } from "@/components/ui/pill-button";
import { useScroll } from "@/hooks/smooth-scroll/use-scroll";
import { tradeConfig } from "@/lib/site";
import { useUi } from "@/lib/ui-store";
import { useWaitlist } from "@/lib/waitlist-store";

const fieldClass =
  "w-full rounded-control border border-line bg-surface-raised/60 px-4 py-3 text-sm outline-none transition-colors duration-[var(--duration-fast)] ease-entrance focus:border-accent/60 focus:bg-surface-raised";
const labelClass =
  "text-xs font-medium font-mono tracking-label text-foreground/50 uppercase";

/**
 * Join-the-waitlist form. Collects full name, email and phone and submits to
 * the same-origin /api/waitlist proxy. On success the visitor's status flips
 * to pending (or approved, if they already had access).
 */
export const WaitlistModal = () => {
  const open = useUi((state) => state.waitlistOpen);
  const setWaitlistOpen = useUi((state) => state.setWaitlistOpen);
  const startScroll = useScroll((state) => state.start);
  const stopScroll = useScroll((state) => state.stop);
  const submit = useWaitlist((state) => state.submit);

  const [status, setStatus] = useState<"form" | "sending" | "pending" | "approved">("form");
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => {
        setStatus("form");
        setError(null);
      }, 300);
      return () => clearTimeout(id);
    }
    stopScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWaitlistOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      startScroll();
    };
  }, [open, setWaitlistOpen, startScroll, stopScroll]);

  const style = useSpring({
    opacity: open ? 1 : 0,
    y: open ? 0 : 18,
    config: { tension: 260, friction: 30 },
  });

  if (!open) return null;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus("sending");
    try {
      const result = await submit({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
      });
      setStatus(result === "approved" ? "approved" : "pending");
    } catch (e) {
      setStatus("form");
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  };

  const done = status === "pending" || status === "approved";

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Join the waitlist"
      onClick={() => setWaitlistOpen(false)}
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
          onClick={() => setWaitlistOpen(false)}
          className="absolute top-4 right-4 grid size-9 place-items-center rounded-pill bg-surface-raised text-foreground/60 transition-colors duration-[var(--duration-fast)] ease-entrance hover:bg-line hover:text-foreground"
        >
          <Close />
        </button>

        {done ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <span className="grid size-14 place-items-center rounded-pill bg-ink text-2xl text-accent">
              ✓
            </span>
            {status === "approved" ? (
              <>
                <h2 className="text-2xl font-bold tracking-display">You already have access</h2>
                <p className="max-w-[34ch] text-sm text-foreground/60">
                  An account exists for this email. Log in to start trading.
                </p>
                <PillButton variant="dark" arrow="right" href={tradeConfig.login}>
                  Log in
                </PillButton>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold tracking-display">You&apos;re on the list</h2>
                <p className="max-w-[34ch] text-sm text-foreground/60">
                  Thanks for requesting access. Once our team approves you, we&apos;ll email
                  your login details.
                </p>
                <PillButton variant="dark" onClick={() => setWaitlistOpen(false)}>
                  Got it
                </PillButton>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-1.5">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground/60">
                <span className="size-1.5 rounded-pill bg-accent" />
                Request access
              </span>
              <h2 className="text-2xl font-bold tracking-display sm:text-3xl">
                Join the FX Artha waitlist
              </h2>
              <p className="mt-1 text-sm text-foreground/55">
                We&apos;re invite-only. Tell us who you are and we&apos;ll email your login
                details once you&apos;re approved.
              </p>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className={labelClass}>Full name</span>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className={labelClass}>Email</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className={labelClass}>Phone number</span>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 90000 00000"
                  className={fieldClass}
                />
              </label>

              {error ? (
                <p className="text-sm text-red-400" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-xs text-foreground/45">
                  We&apos;ll never share your details.
                </span>
                <PillButton variant="dark" arrow="up-right" type="submit">
                  {status === "sending" ? "Submitting…" : "Join waitlist"}
                </PillButton>
              </div>
            </form>

            <p className="mt-5 border-t border-line pt-4 text-center text-sm text-foreground/55">
              Already have an account?{" "}
              <a href={tradeConfig.login} className="font-medium text-accent hover:underline">
                Log in
              </a>
            </p>
          </>
        )}
      </animated.div>
    </div>
  );
};
