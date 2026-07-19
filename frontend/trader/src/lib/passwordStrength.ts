/**
 * Client-side password policy + strength scoring, shared by signup and
 * password-reset. The SERVER enforces the same minimum policy (see gateway
 * auth); this module exists so users get instant, specific feedback instead
 * of a round-trip rejection.
 *
 * Policy (all required):
 *  - at least 8 characters
 *  - at least 3 of 4 character classes (lowercase / uppercase / digit / symbol)
 *  - not a common password ('12345678', 'password', …) or a trivial
 *    sequence/repetition
 */

const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', '87654321', 'password', 'password1',
  'password123', 'passw0rd', 'qwerty123', 'qwertyuiop', '1q2w3e4r', '1qaz2wsx',
  'abc12345', 'abcd1234', 'iloveyou', 'sunshine', 'football', 'monkey123',
  'letmein1', 'admin123', 'welcome1', 'dragon123', '11111111', '00000000',
  'aa123456', 'a1234567', 'qwer1234', 'asdf1234', 'zaq12wsx', 'swisscresta',
]);

function isSequentialOrRepeated(pw: string): boolean {
  const s = pw.toLowerCase();
  // All one character ('aaaaaaaa').
  if (/^(.)\1+$/.test(s)) return true;
  // Strictly ascending or descending single steps ('12345678', 'abcdefgh').
  let asc = true;
  let desc = true;
  for (let i = 1; i < s.length; i++) {
    const d = s.charCodeAt(i) - s.charCodeAt(i - 1);
    if (d !== 1) asc = false;
    if (d !== -1) desc = false;
  }
  return asc || desc;
}

export type PasswordStrength = {
  /** 0 = unusable … 4 = strong. Policy passes from 2 upward. */
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Very weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  /** Human-readable unmet requirements, in display order. */
  issues: string[];
  /** True when the password satisfies the policy (server will accept it). */
  ok: boolean;
};

export function scorePassword(pw: string): PasswordStrength {
  const issues: string[] = [];
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /[0-9]/.test(pw);
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw);
  const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  if (pw.length < 8) issues.push('At least 8 characters');
  if (classes < 3) issues.push('Mix at least 3 of: lowercase, uppercase, number, symbol');
  const tooCommon = COMMON_PASSWORDS.has(pw.toLowerCase()) || isSequentialOrRepeated(pw);
  if (tooCommon && pw.length > 0) issues.push('Too common or predictable — pick something unique');

  const ok = issues.length === 0;

  // Score: gate on the policy, then reward length + full variety.
  let score: PasswordStrength['score'];
  if (pw.length === 0) score = 0;
  else if (!ok) score = pw.length >= 8 && !tooCommon ? 1 : pw.length >= 6 ? 1 : 0;
  else if (pw.length >= 12 && classes === 4) score = 4;
  else if (pw.length >= 10 && classes >= 3) score = 3;
  else score = 2;

  const label = (['Very weak', 'Weak', 'Fair', 'Good', 'Strong'] as const)[score];
  return { score, label, issues, ok };
}
