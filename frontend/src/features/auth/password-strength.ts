// NIST SP 800-63B and OWASP both de-emphasize forced complexity (a mandatory
// symbol produces predictable "Password1!" patterns) in favor of length and
// character variety as a genuine entropy signal.
// https://pages.nist.gov/800-63-4/sp800-63b.html
// https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

export type PasswordStrength = 'weak' | 'fair' | 'strong';

export interface PasswordStrengthResult {
  score: number; // 0-100, drives the gauge width
  strength: PasswordStrength;
  label: string;
}

const COMMON_PASSWORDS = new Set([
  'password',
  '12345678',
  '123456789',
  'azerty123',
  'motdepasse',
  'qwerty123',
  'iloveyou',
  'admin1234',
]);

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  if (password.length === 0) {
    return { score: 0, strength: 'weak', label: '' };
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { score: 5, strength: 'weak', label: 'Trop commun, facile à deviner' };
  }

  // Length carries most of the weight, per NIST 800-63B: each extra
  // character multiplies the search space more than any symbol rule does.
  // Caps at 16 chars (OWASP's upper recommendation) so a genuinely strong
  // password can actually reach 100 — a gauge that never fills, even for a
  // long varied password, reads as broken rather than as "always room to
  // improve".
  const lengthScore = Math.min((password.length / 16) * 65, 65);

  const varietyCount = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) =>
    re.test(password),
  ).length;
  const varietyScore = (varietyCount / 4) * 25;

  // A long run of the same character ("aaaaaaaaaaaaaaaa") inflates the length
  // score without adding real entropy, so it is scored on its distinct
  // character count instead of raw length.
  const distinctChars = new Set(password).size;
  const repeatPenalty = distinctChars <= 2 ? 50 : /(.)\1{2,}/.test(password) ? 15 : 0;

  const score = Math.max(0, Math.min(100, Math.round(lengthScore + varietyScore - repeatPenalty + 10)));

  if (score < 40) return { score, strength: 'weak', label: 'Mot de passe faible' };
  if (score < 70) return { score, strength: 'fair', label: 'Mot de passe correct' };
  return { score, strength: 'strong', label: 'Mot de passe solide' };
}
