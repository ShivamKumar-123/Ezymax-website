"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { tradeConfig } from "@/content/site";
import { useWaitlist } from "@/lib/waitlist-store";

/**
 * The access form. This is the site's primary conversion and the only one
 * that reaches the gateway — it posts to /api/waitlist, which proxies to the
 * backend's invite gate.
 *
 * It replaced a "Book a Free Demo" modal that asked what kind of brokerage
 * you were building and posted to an endpoint that only wrote to the server
 * log. That was the right form for a company selling software to brokers, and
 * the wrong one for a platform deciding who it lets in to trade.
 *
 * Four states, all of which a visitor can legitimately arrive in:
 *   form      — not applied yet
 *   sending   — request in flight
 *   pending   — applied, awaiting review
 *   approved  — let in; show the way to log in
 */
export function WaitlistModal() {
  const open = useWaitlist((s) => s.open);
  const setOpen = useWaitlist((s) => s.setOpen);
  const status = useWaitlist((s) => s.status);
  const hydrate = useWaitlist((s) => s.hydrate);
  const submit = useWaitlist((s) => s.submit);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const close = () => setOpen(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    // Honeypot: hidden from people, irresistible to bots. Pretend success.
    if (data.get("_hp")) return close();

    setSending(true);
    setError(null);
    try {
      await submit({
        full_name: String(data.get("full_name") ?? ""),
        email: String(data.get("email") ?? ""),
        phone: String(data.get("phone") ?? "") || undefined,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }

  if (status === "approved") {
    return (
      <Modal
        open={open}
        onClose={close}
        title="You already have access"
        description="Your request was approved. Log in to start trading."
      >
        <div className="flex flex-wrap gap-3">
          <Button href={tradeConfig.login} variant="primary" icon>
            Log in
          </Button>
          <Button href={tradeConfig.register} variant="outline">
            Open account
          </Button>
        </div>
      </Modal>
    );
  }

  if (status === "pending") {
    return (
      <Modal
        open={open}
        onClose={close}
        title="You are on the list"
        description="Your request is with us. We will email you as soon as a place opens — there is nothing else to do."
      >
        <Button onClick={close} variant="outline">
          Close
        </Button>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Request access"
      description="Ezymax is invite-only. Tell us who you are and we will email you when a place opens."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="wl-name">Full name</Label>
          <Input
            id="wl-name"
            name="full_name"
            required
            autoComplete="name"
            placeholder="Your name"
          />
        </div>
        <div>
          <Label htmlFor="wl-email">Email</Label>
          <Input
            id="wl-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <Label htmlFor="wl-phone">Phone (optional)</Label>
          <Input
            id="wl-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+91 90000 00000"
          />
        </div>

        <input
          type="text"
          name="_hp"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="hidden"
        />

        {error ? (
          <p role="alert" className="text-sm text-orange-400">
            {error}
          </p>
        ) : null}

        <div className="mt-2 flex items-center justify-between gap-4">
          <p className="text-xs text-dim">We never share your details.</p>
          <Button type="submit" variant="primary" icon disabled={sending}>
            {sending ? "Sending…" : "Join waitlist"}
          </Button>
        </div>

        <p className="border-t border-line pt-4 text-center text-xs text-dim">
          Already have an account?{" "}
          <a href={tradeConfig.login} className="text-orange-400 hover:underline">
            Log in
          </a>
        </p>
      </form>
    </Modal>
  );
}
