// Runnable smoke check: `node src/features/auth/password-strength.selfcheck.mjs`
// No test framework — the project has none for unit-level frontend logic
// (only Playwright e2e), so this stays a plain assert script.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';

// TS source, so compile it to a temp JS file with the TS compiler already in
// devDependencies rather than pulling in a runtime loader.
execSync('npx tsc src/features/auth/password-strength.ts --outDir .selfcheck-tmp --module esnext --target es2020 --moduleResolution bundler', {
  stdio: 'inherit',
});
const { evaluatePasswordStrength } = await import('../../../.selfcheck-tmp/password-strength.js');

assert.equal(evaluatePasswordStrength('').strength, 'weak');
assert.equal(evaluatePasswordStrength('password').label, 'Trop commun, facile à deviner');
assert.equal(evaluatePasswordStrength('abc').strength, 'weak');
assert.equal(evaluatePasswordStrength('correcthorsebatterystaple').strength, 'strong');
assert.equal(evaluatePasswordStrength('aaaaaaaaaaaaaaaa').strength, 'weak');
assert.ok(
  evaluatePasswordStrength('Tr3s!Long&Secure').score >
    evaluatePasswordStrength('short1A').score,
  'a longer varied password should score higher than a short one',
);

unlinkSync('.selfcheck-tmp/password-strength.js');
console.log('password-strength: all checks passed');
