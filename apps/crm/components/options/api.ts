"use client";

// Browser client for the suitability BFF (/api/suitability/*, see app/api/suitability/[...path]/route.ts) and the
// shapes of gateway suitability.rs. Product: Kalks FX Options: accepting the options terms is the only step.

import * as React from "react";
import { tr } from "@kalks/i18n/react";

export type KycStatus = "unverified" | "pending" | "verified" | "rejected";
/** What is still needed before the first options trade: only the options terms (gateway suitability.rs). */
export type Step = "disclosure";

export type Disclosure = { version: number; title: string; bodyMd: string; publishedAt: string };

export type Suitability = {
  product: "options";
  /** The current options terms (key points, then the full terms). */
  disclosure: Disclosure | null;
  /** Any published version accepted: that alone makes the client eligible. */
  disclosureAccepted: boolean;
  acceptedVersion: number | null;
  acceptedAt: string | null;
  eligible: boolean;
  missing: Step[];
  /** For information only: neither is needed to trade options. */
  kycVerified: boolean;
  kycStatus: KycStatus;
  quizPassed: boolean;
};

export class SuitabilityError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function suitabilityApi<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/suitability/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new SuitabilityError(0, "network", tr("common.networkError"));
  }
  const data = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.assign(`/api/auth/expired?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    throw new SuitabilityError(res.status, data.error?.code ?? "error", data.error?.message ?? tr("common.errorRetry"));
  }
  return data as T;
}

/** The client's options suitability; `reload()` refetches, `set()` takes a fresh state from a write. */
export function useSuitability() {
  const [data, setData] = React.useState<Suitability | null>(null);
  const [error, setError] = React.useState<SuitabilityError | null>(null);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    let stop = false;
    suitabilityApi<Suitability>("options")
      .then((d) => {
        if (stop) return;
        setData(d);
        setError(null);
      })
      .catch((e: SuitabilityError) => {
        if (!stop) setError(e);
      });
    return () => {
      stop = true;
    };
  }, [tick]);
  // the terms may have been accepted in another tab: refresh when this one comes back
  React.useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && setTick((t) => t + 1);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return { data, error, reload: React.useCallback(() => setTick((t) => t + 1), []), set: setData };
}
