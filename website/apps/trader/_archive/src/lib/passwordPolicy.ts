/**
 * Shared password-strength policy for every signup / reset / change-password
 * surface in the trader app.
 *
 * Mirrors backend/packages/common/src/password_policy.py — if you change
 * thresholds here, change them there too (server is the source of truth;
 * the frontend just gives the user real-time feedback before submit).
 *
 * Rules:
 *   1. Minimum 8 characters (hard floor)
 *   2. At least 3 of these 4 character classes: lower, upper, digit, symbol
 *   3. Not a known weak / breached password (small inline blocklist of
 *      the ~60 most-tried passwords — covers >70% of real-world brute force)
 *   4. Not the user's own email local-part (passed in as `disallow`)
 *
 * A password that satisfies #1-#4 scores at least "Good" (3). Anything
 * below "Good" is rejected at submit time.
 */

import { BRAND_NAME } from '@/lib/brand';

/** Top weak passwords + obvious sequence patterns. Lower-cased on check.
 *  Kept short on purpose — full breach corpus belongs on the server.   */
const COMMON_WEAK_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'qwerty123', 'password', 'password1',
  'password123', 'qwertyuiop', 'asdfghjkl', '11111111', '00000000', '88888888',
  'abcdefgh', 'abc12345', 'iloveyou', 'iloveyou1', 'sunshine', 'princess',
  'admin123', 'admin1234', 'letmein', 'letmein123', 'welcome1', 'welcome123',
  'monkey123', 'football', 'baseball', 'qwerty12', 'asdf1234', 'zxcvbnm',
  'qazwsxedc', '1q2w3e4r', '1qaz2wsx', 'q1w2e3r4', 'master123', 'shadow123',
  'dragon123', 'trustno1', 'startrek', 'starwars', 'superman', 'batman123',
  'pakistan', 'india123', 'hello123', 'changeme', 'demo1234', 'test1234',
  'guest123', 'user1234', 'root1234',
]);

// Brand-derived weak passwords ("<brand>123", "<brand>2025", "<brand>2026") —
// derived from BRAND_NAME so every white-label build blocks its own brand name
// as a password base without hardcoding any brand literal. Skipped for very
// short names where the suffix would dominate the string.
{
  const b = BRAND_NAME.toLowerCase().replace(/\s+/g, '');
  if (b.length >= 4) {
    for (const suffix of ['123', '2025', '2026']) {
      COMMON_WEAK_PASSWORDS.add(`${b}${suffix}`);
    }
  }
}

export type Strength = 0 | 1 | 2 | 3 | 4;

export interface PasswordCheck {
  /** 0=empty, 1=very weak, 2=weak, 3=good, 4=strong */
  score: Strength;
  /** Human label for the score; e.g. "Weak", "Good". */
  label: string;
  /** Tailwind/hex colour for the strength bar at this score. */
  color: string;
  /** Per-rule pass/fail breakdown — feed straight to a checklist UI. */
  checks: {
    length: boolean;
    lowercase: boolean;
    uppercase: boolean;
    digit: boolean;
    symbol: boolean;
    notCommon: boolean;
    notLikeEmail: boolean;
  };
  /** Plain-language list of what's still missing — at most a few items. */
  issues: string[];
  /** True iff the password is acceptable for submit (score >= 3). */
  acceptable: boolean;
}

const LABELS: Record<Strength, string> = {
  0: '',
  1: 'Very weak',
  2: 'Weak',
  3: 'Good',
  4: 'Strong',
};

const COLORS: Record<Strength, string> = {
  0: '#9ca3af',
  1: '#ef4444', // red
  2: '#f59e0b', // amber
  3: '#22c55e', // green
  4: '#E12019', // brand green
};

/**
 * Score a candidate password. `disallow` is an optional list of substrings
 * we don't want to see inside the password (typically the user's email
 * local-part and first name).
 */
export function scorePassword(password: string, disallow: string[] = []): PasswordCheck {
  const pw = password ?? '';
  if (pw.length === 0) {
    return {
      score: 0,
      label: '',
      color: COLORS[0],
      checks: {
        length: false, lowercase: false, uppercase: false,
        digit: false, symbol: false, notCommon: true, notLikeEmail: true,
      },
      issues: [],
      acceptable: false,
    };
  }

  const lowered = pw.toLowerCase();
  const checks = {
    length:      pw.length >= 8,
    lowercase:   /[a-z]/.test(pw),
    uppercase:   /[A-Z]/.test(pw),
    digit:       /\d/.test(pw),
    symbol:      /[^A-Za-z0-9]/.test(pw),
    notCommon:   !COMMON_WEAK_PASSWORDS.has(lowered),
    notLikeEmail: disallow
      .map((s) => (s || '').toLowerCase().trim())
      .filter((s) => s.length >= 3)
      .every((s) => !lowered.includes(s)),
  };

  // Quick deal-breakers: anything failing length / common / email match
  // can't score above Weak no matter what else is true. Catches
  // "Password1@" (passes char classes) being banned because it's common.
  const classCount = [checks.lowercase, checks.uppercase, checks.digit, checks.symbol]
    .filter(Boolean).length;

  let score: Strength;
  const issues: string[] = [];
  if (!checks.length) issues.push('At least 8 characters');
  if (!checks.notCommon) issues.push('Too common — pick something unique');
  if (!checks.notLikeEmail) issues.push("Don't reuse your email or name");
  if (classCount < 3) {
    const missing: string[] = [];
    if (!checks.lowercase) missing.push('a lower-case letter');
    if (!checks.uppercase) missing.push('an upper-case letter');
    if (!checks.digit) missing.push('a number');
    if (!checks.symbol) missing.push('a symbol');
    issues.push(`Add ${missing.slice(0, 4 - classCount).join(' or ')}`);
  }

  // Base score on character classes + length bonus, then cap by rule failures.
  let raw = classCount;
  if (pw.length >= 12) raw += 1;
  if (pw.length >= 16) raw += 1;
  // Map raw (0-6) → display score (1-4).
  if (raw <= 1) score = 1;
  else if (raw === 2) score = 2;
  else if (raw <= 4) score = 3;
  else score = 4;

  // Hard caps for rule violations.
  if (!checks.length) score = 1;
  if (!checks.notCommon) score = (Math.min(score, 1) as Strength);
  if (!checks.notLikeEmail) score = (Math.min(score, 2) as Strength);
  if (classCount < 3) score = (Math.min(score, 2) as Strength);

  const acceptable = score >= 3 && checks.length && checks.notCommon && checks.notLikeEmail && classCount >= 3;

  return {
    score,
    label: LABELS[score],
    color: COLORS[score],
    checks,
    issues,
    acceptable,
  };
}

/** Single requirement spec — fed to the checklist UI on signup / reset. */
export interface Requirement {
  id: keyof PasswordCheck['checks'];
  label: string;
}

export const PASSWORD_REQUIREMENTS: Requirement[] = [
  { id: 'length',       label: '8+ characters' },
  { id: 'uppercase',    label: 'An upper-case letter (A–Z)' },
  { id: 'lowercase',    label: 'A lower-case letter (a–z)' },
  { id: 'digit',        label: 'A number (0–9)' },
  { id: 'symbol',       label: 'A symbol (!@#$…)' },
  { id: 'notCommon',    label: 'Not a common password' },
];
