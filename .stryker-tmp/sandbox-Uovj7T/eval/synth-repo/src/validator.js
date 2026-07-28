// @ts-nocheck
// Partially tested: the existing test only checks truthiness, so most mutants survive.
export function isValidUsername(name) {
  if (typeof name !== 'string') return false;
  if (name.length < 3 || name.length > 20) return false;
  return /^[a-z][a-z0-9_]*$/.test(name);
}

export function clampPercent(x) {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 100) return 100;
  return x;
}
