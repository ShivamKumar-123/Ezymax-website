// Server errors in the reader's language (same mapping as the Client Area's lib/auth-client.ts): known gateway
// codes and validation texts map to catalog keys; anything unknown keeps the server's wording.
import { i18n } from "@/i18n";

export type ApiError = { code: string; message: string; field?: string; retry_after?: number; attempts_left?: number; status?: number };

const MESSAGE_KEYS: Record<string, string> = {
  "Enter your email address.": "auth.apiError.emailRequired",
  "Email address is too long.": "auth.apiError.emailTooLong",
  "Enter a valid email address.": "auth.apiError.emailInvalid",
  "Use at least 8 characters.": "auth.apiError.pwMin",
  "Use at most 128 characters.": "auth.apiError.pwMax",
  "Add an uppercase letter.": "auth.apiError.pwUpper",
  "Add a lowercase letter.": "auth.apiError.pwLower",
  "Add a number.": "auth.apiError.pwNumber",
  "Add a symbol such as ! # @ or %.": "auth.apiError.pwSymbol",
  "Choose a country dial code.": "auth.apiError.dialCode",
  "Choose your country of residence.": "auth.apiError.country",
  "Enter a valid date of birth.": "auth.apiError.dob",
  "You must be at least 18 years old to open an account.": "auth.apiError.age",
  "Enter a valid phone number.": "auth.apiError.phoneInvalid",
  "Enter your phone number.": "auth.apiError.phoneRequired",
  "Name is too long.": "auth.apiError.nameTooLong",
  "Use letters only.": "auth.apiError.nameLetters",
  "Referral code looks wrong. Leave it empty if you don't have one.": "auth.apiError.referral",
  "Enter your password.": "auth.apiError.passwordRequired",
  "Please confirm you are over 18 and accept the terms.": "auth.apiError.terms",
  "This code was sent for a different change. Request a new code.": "auth.apiError.codeOtherChange",
  "Use the reset form for this code.": "auth.apiError.codeUseReset",
};

export function localizeError(e: ApiError): ApiError {
  const t = i18n.t;
  const n = e.attempts_left ?? 0;
  const secs = Math.max(1, Math.round(e.retry_after ?? 0));
  let message: string | undefined;
  switch (e.code) {
    case "invalid_credentials":
    case "account_disabled":
    case "account_suspended":
    case "email_taken":
    case "code_expired":
    case "unauthorized":
    case "internal":
    case "network":
    case "unknown":
      message = t.dyn(`auth.apiError.${e.code}`, e.message);
      break;
    case "invalid_code":
      message = n > 0 ? t.dyn("auth.apiError.invalidCode", e.message, { count: n }) : t.dyn("auth.apiError.tooManyCodes", e.message);
      break;
    case "locked": {
      const minutes = Math.max(1, Math.ceil(secs / 60));
      message = t.dyn("auth.apiError.locked", e.message, { count: minutes, minutes });
      break;
    }
    case "rate_limited":
      message = t.dyn("auth.apiError.rateLimited", e.message, { seconds: secs });
      break;
    case "unavailable":
      message = t.dyn("common.unavailable", e.message);
      break;
    default: {
      const key = MESSAGE_KEYS[e.message];
      if (key) message = t.dyn(key, e.message);
    }
  }
  return message ? { ...e, message } : e;
}
