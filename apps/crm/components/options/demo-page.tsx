"use client";

// Demo Options page: the same screens with local state (nothing is saved). The demo client is identity-verified, so
// the whole flow (disclosure, quiz, Trade options) can be walked through.

import * as React from "react";
import { toast } from "sonner";
import { ACCOUNTS } from "@kalks/mock";
import { useT } from "@kalks/i18n/react";
import { TERMINAL_URL } from "@/lib/live";
import type { QuizOutcome, Suitability } from "./api";
import { demoGrade, demoSuitability } from "./demo";
import { OptionsPage, type OptionsController, type TradeAccount } from "./ui";

const missingOf = (s: Suitability): Suitability["missing"] => [...(s.kycVerified ? [] : (["kyc"] as const)), ...(s.disclosureAccepted ? [] : (["disclosure"] as const)), ...(s.quizPassed ? [] : (["quiz"] as const))];

function settle(s: Suitability): Suitability {
  const missing = missingOf(s);
  return { ...s, missing, eligible: missing.length === 0 };
}

export function DemoOptions() {
  const t = useT();
  const [data, setData] = React.useState<Suitability>(() => demoSuitability());

  const accounts = React.useMemo<TradeAccount[]>(
    () => ACCOUNTS.filter((a) => !a.cent).map((a) => ({ login: Number(a.login), type: a.type, name: a.nickname ?? `${a.group} · ${a.mode === "netting" ? "Netting" : "Hedging"}` })),
    [],
  );

  const ctl: OptionsController = {
    data,
    error: null,
    reload: () => {},
    demo: true,
    readOnly: false,
    accounts,
    accept: async (version) => {
      await new Promise((r) => setTimeout(r, 450));
      setData((d) => settle({ ...d, disclosureAccepted: true, acceptedVersion: version, acceptedAt: new Date().toISOString() }));
      toast.success(t("options.disclosure.toastAccepted"));
      return true;
    },
    submitQuiz: async (answers) => {
      await new Promise((r) => setTimeout(r, 600));
      const g = demoGrade(answers);
      const attempts = data.quizAttempts + 1;
      // like the gateway: a pass is kept for good, a later failed attempt (practice) never undoes it
      const next = settle(
        g.passed
          ? { ...data, quizPassed: true, quizPassedAt: data.quizPassedAt ?? new Date().toISOString(), quizScore: Math.max(data.quizScore ?? 0, g.score), quizAttempts: attempts }
          : { ...data, quizScore: data.quizPassed ? data.quizScore : g.score, quizAttempts: attempts },
      );
      setData(next);
      if (g.passed) toast.success(t("options.quiz.toastPassed"), { description: t("options.quiz.passedTitle", { score: g.score, total: g.total }) });
      return { ...g, quizPassed: next.quizPassed, eligible: next.eligible, missing: next.missing } satisfies QuizOutcome;
    },
    openTrader: (a) => {
      window.open(`${TERMINAL_URL}/?account=${a.login}&mode=options`, "_blank", "noopener");
    },
  };
  return <OptionsPage ctl={ctl} />;
}
