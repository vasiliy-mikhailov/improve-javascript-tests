// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { isValidUsername, clampPercent } from '../src/validator.js';

// Deliberately weak assertions: they execute lines but barely constrain behavior,
// so most Stryker mutants survive.
describe('validator', () => {
  it('accepts a normal username', () => {
    expect(typeof isValidUsername('john_doe')).toBe('boolean');
  });
  it('clampPercent returns a number', () => {
    expect(typeof clampPercent(50)).toBe('number');
    expect(typeof clampPercent(-5)).toBe('number');
    expect(typeof clampPercent(200)).toBe('number');
  });
});
