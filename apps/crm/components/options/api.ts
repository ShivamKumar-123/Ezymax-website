"use client";

// Browser client for the suitability BFF (/api/suitability/*, see app/api/suitability/[...path]/route.ts) and the
// shapes of gateway suitability.rs. Product: Kalks FX Options.

import * as React from "react";
import { tr } from "@kalks/i18n/react";

export type KycStatus = "unverified" | "pending" | "verified" | "rejected";
export type Step = "kyc" | "disclosure" | "quiz";

export type Disclosure = { version: number; title: string; bodyMd: string; publishedAt: string };
export type QuizQuestion = { id: string; text: string; options: string[] };

export type Suitability = {
  product: "options";
  kycVerified: boolean;
  kycStatus: KycStatus;
  disclosure: Disclosure | null;
  disclosureAccepted: boolean;
  acceptedVersion: number | null;
  acceptedAt: string | null;
  quizPassed: boolean;
  quizPassedAt: string | null;
  quizScore: number | null;
  quizAttempts: number;
  eligible: boolean;
  missing: Step[];
  quiz: { total: number; passMark: number; questions: QuizQuestion[] };
};

export type QuizOutcome = {
  passed: boolean;
  score: number;
  total: number;
  passMark: number;
  wrong: { id: string; explanation: string }[];
  quizPassed: boolean;
  eligible: boolean;
  missing: Step[];
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
  // identity checks finish elsewhere (Verification, staff review): refresh when the tab comes back
  React.useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && setTick((t) => t + 1);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return { data, error, reload: React.useCallback(() => setTick((t) => t + 1), []), set: setData };
}
