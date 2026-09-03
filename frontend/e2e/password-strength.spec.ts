import { test, expect } from '@playwright/test';
import { evaluatePasswordStrength } from '../src/features/auth/password-strength';

// Pure logic, no page needed — Playwright is the only runner the frontend has,
// and it executes TS directly, so this replaces the old .selfcheck.mjs script
// that shelled out to tsc just to import one function.
test.describe('evaluatePasswordStrength', () => {
  test('an empty password is weak with no label', () => {
    expect(evaluatePasswordStrength('').strength).toBe('weak');
    expect(evaluatePasswordStrength('').label).toBe('');
  });

  test('a known common password is called out as guessable', () => {
    expect(evaluatePasswordStrength('password').label).toBe(
      'Trop commun, facile à deviner',
    );
  });

  test('a short password is weak', () => {
    expect(evaluatePasswordStrength('abc').strength).toBe('weak');
  });

  test('a long passphrase is strong even without symbols', () => {
    expect(evaluatePasswordStrength('correcthorsebatterystaple').strength).toBe(
      'strong',
    );
  });

  test('a single repeated character does not earn its length', () => {
    expect(evaluatePasswordStrength('aaaaaaaaaaaaaaaa').strength).toBe('weak');
  });

  test('length and variety outscore a short password', () => {
    expect(evaluatePasswordStrength('Tr3s!Long&Secure').score).toBeGreaterThan(
      evaluatePasswordStrength('short1A').score,
    );
  });
});
