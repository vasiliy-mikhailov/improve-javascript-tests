// @ts-nocheck
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseUsage, addUsage, fmtTokens } = require('../tokens');

test('parseUsage reads the OpenAI-compatible shape', () => {
  assert.deepEqual(parseUsage({ prompt_tokens: 1200, completion_tokens: 340, total_tokens: 1540 }),
    { in: 1200, out: 340 });
});

test('parseUsage accepts the alternative field names', () => {
  assert.deepEqual(parseUsage({ input_tokens: 10, output_tokens: 5 }), { in: 10, out: 5 });
});

test('parseUsage is safe on missing, partial or junk payloads', () => {
  assert.deepEqual(parseUsage(undefined), { in: 0, out: 0 });
  assert.deepEqual(parseUsage(null), { in: 0, out: 0 });
  assert.deepEqual(parseUsage({}), { in: 0, out: 0 });
  assert.deepEqual(parseUsage({ prompt_tokens: 'x', completion_tokens: -4 }), { in: 0, out: 0 });
  assert.deepEqual(parseUsage({ prompt_tokens: 7.6 }), { in: 8, out: 0 });
});

test('addUsage accumulates across calls', () => {
  let acc;
  acc = addUsage(acc, { prompt_tokens: 100, completion_tokens: 20 });
  acc = addUsage(acc, { prompt_tokens: 50, completion_tokens: 10 });
  assert.deepEqual(acc, { in: 150, out: 30, calls: 2 });
});

test('addUsage counts a call even when the provider omits usage', () => {
  const acc = addUsage({ in: 5, out: 5, calls: 1 }, undefined);
  assert.deepEqual(acc, { in: 5, out: 5, calls: 2 });
});

test('fmtTokens abbreviates thousands and millions', () => {
  assert.equal(fmtTokens(0), '0');
  assert.equal(fmtTokens(999), '999');
  assert.equal(fmtTokens(1234), '1.2k');
  assert.equal(fmtTokens(2_500_000), '2.5M');
});
