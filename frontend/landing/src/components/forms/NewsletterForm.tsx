"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

export function NewsletterForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, type: "newsletter" }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-orange-300" role="status">
        <Check className="size-4" /> You are subscribed. Watch your inbox.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-lg items-center gap-2 rounded-full border border-line bg-white/[0.03] p-1.5 pl-5 focus-within:border-orange-500/60">
      <input type="text" name="_hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <input
        id="newsletter-email"
        name="email"
        type="email"
        required
        placeholder="Your email"
        className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-dim focus:outline-none"
      />
      <button
        type="submit"
        disabled={status === "submitting"}
        aria-label="Subscribe"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-black transition-colors hover:bg-orange-400"
      >
        {status === "submitting" ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
      </button>
      {status === "error" ? <span className="sr-only">Subscription failed</span> : null}
    </form>
  );
}
