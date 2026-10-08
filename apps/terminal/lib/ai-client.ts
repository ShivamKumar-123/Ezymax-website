// Browser side of the AI gate (lib/ai-guard.ts): the headers a paid AI call sends and the plain-language text for a
// refusal (not signed in, over the per-user budget), in the reader's language.
import type { T as Translate } from "@ezymex/i18n";

export type AiDeniedCode = "signin" | "forbidden" | "rate_minute" | "rate_day" | "unavailable";

/** JSON headers plus the acting login, so the server checks that account's session. */
export const aiHeaders = (login?: string): Record<string, string> => ({ "content-type": "application/json", ...(login && /^\d{8}$/.test(login) ? { "x-ezymex-login": login } : {}) });

/** The refusal text for a gate code, or null when the response is not a refusal. */
export function aiDeniedText(t: Translate, code: unknown): string | null {
  switch (code) {
    case "signin":
      return t("desk.ai.signin");
    case "rate_minute":
      return t("desk.ai.rateMinute", { n: 10 });
    case "rate_day":
      return t("desk.ai.rateDay", { n: 200 });
    case "unavailable":
      return t("desk.ai.unavailable");
    case "forbidden":
      return t("desk.ai.forbidden");
    default:
      return null;
  }
}
