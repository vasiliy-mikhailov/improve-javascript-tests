// @ts-nocheck
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { globsToMatcher, slugify, fileSlug, mac, round2, extractJson, extractLastJsonObject, redact } = require('../util');

test('glob matcher: ** spans directories, * does not', () => {
  const m = globsToMatcher('lib/**/*.ts');
  assert.ok(m('lib/a.ts'));
  assert.ok(m('lib/deep/nested/a.ts'));
  assert.ok(!m('src/a.ts'));
  assert.ok(!m('lib/a.tsx'));

  const single = globsToMatcher('src/*.js');
  assert.ok(single('src/a.js'));
  assert.ok(!single('src/deep/a.js'));
});

test('glob matcher: brace alternatives and comma-separated globs', () => {
  const m = globsToMatcher('src/**/*.{js,ts,jsx,tsx}');
  for (const p of ['src/a.js', 'src/a.ts', 'src/d/b.jsx', 'src/d/b.tsx']) assert.ok(m(p), p);
  assert.ok(!m('src/a.css'));

  const multi = globsToMatcher('lib/**/*.ts,components/ui/**/*.tsx');
  assert.ok(multi('lib/x/y.ts'));
  assert.ok(multi('components/ui/Button.tsx'));
  assert.ok(!multi('components/other/Button.tsx'));
});

test('glob matcher: regex metacharacters in the glob are literal', () => {
  const m = globsToMatcher('src/a+b/*.ts');
  assert.ok(m('src/a+b/x.ts'));
  assert.ok(!m('src/aab/x.ts'));
});

test('slugify / fileSlug produce stable, filesystem-safe ids', () => {
  assert.equal(slugify('https://github.com/org/Repo-Name.git'), 'github-com-org-repo-name');
  assert.equal(fileSlug('lib/api-schemas/models/config.ts'), 'lib-api-schemas-models-config');
  assert.ok(!/[^a-z0-9-]/.test(fileSlug('components/ui/ChartCard.tsx')));
});

test('MAC is the product of the two percentages', () => {
  assert.equal(mac(100, 50), 50);
  assert.equal(mac(80, 90), 72);
  assert.equal(mac(0, 100), 0);
  assert.equal(mac(null, 50), null);
  assert.equal(mac(50, null), null);
  assert.equal(round2(33.333333), 33.33);
});

test('extractJson survives thinking blocks, fences and trailing prose', () => {
  assert.deepEqual(extractJson('<think>hmm</think>{"file":"a.ts"}'), { file: 'a.ts' });
  assert.deepEqual(extractJson('```json\n{"tests":[]}\n```'), { tests: [] });
  assert.deepEqual(extractJson('prose {"a":{"b":1}} more prose'), { a: { b: 1 } });
  assert.deepEqual(extractJson('[{"path":"x"}]'), [{ path: 'x' }]);
  assert.equal(extractJson('no json here'), null);
});

test('extractJson does not truncate at braces inside strings', () => {
  assert.deepEqual(extractJson('{"content":"if (x) { y }","n":1}'), { content: 'if (x) { y }', n: 1 });
});

// extractLastJsonObject exists to salvage an answer the model finished inside its
// reasoning channel and was cut off before repeating as content. llm.test.js drives it
// through llm.chat(); these pin the three rules that make it safe to do so at all.

test('extractLastJsonObject takes the LAST complete object, because reasoning quotes the prompt first', () => {
  // Reasoning restates its input before it answers, so the FIRST object in it is
  // routinely the model echoing the task back. Returning that reports a successful
  // parse of something the caller cannot use — resp.json.tests is undefined, nothing
  // is written — AND skips the retry that would have produced a real answer.
  const reasoning = 'The call was configured {"maxTokens":9000,"json":true}.\n'
    + 'Uncovered lines: [9,11,12].\n'
    + 'Let me write it.\n{"tests":[{"path":"test/a.test.ts","content":"it(\'x\', () => {});"}]}\n'
    + 'That covers the branch.';
  assert.deepEqual(extractLastJsonObject(reasoning), {
    tests: [{ path: 'test/a.test.ts', content: "it('x', () => {});" }],
  });
  // braces inside a string do not close the object — a test file's content is full of them
  assert.deepEqual(extractLastJsonObject('{"content":"if (x) { y }","n":1}'), { content: 'if (x) { y }', n: 1 });
});

test('extractLastJsonObject refuses anything that is not an answer', () => {
  // An empty object parses, and taking it would return `{}` as a successful salvage:
  // the caller then writes no files and never retries.
  assert.equal(extractLastJsonObject('I will start now: {}'), null);
  assert.equal(extractLastJsonObject('{ }'), null);
  // an array is never an answer — the captured reply's reasoning quotes the prompt's
  // uncovered-lines array, and `{`-scanning must not be widened to reach it
  assert.equal(extractLastJsonObject('Uncovered lines: [9,11,12,104,105].'), null);
  assert.equal(extractLastJsonObject('no json at all'), null);
  assert.equal(extractLastJsonObject(''), null);
  assert.equal(extractLastJsonObject(null), null);
});

test('extractLastJsonObject ignores a truncated tail and keeps the last COMPLETE object', () => {
  // The whole point of "complete": half a test file would be written to disk and then
  // fail to parse as JavaScript, which is worse than asking the model again.
  const cut = 'First draft:\n{"tests":[{"path":"test/a.test.ts","content":"ok"}]}\n'
    + 'Actually, better:\n{"tests":[{"path":"test/b.test.ts","content":"half a fi';
  assert.deepEqual(extractLastJsonObject(cut), { tests: [{ path: 'test/a.test.ts', content: 'ok' }] });
  assert.equal(extractLastJsonObject('{"tests":[{"path":"a"'), null);
});

test('redact removes tokens, api keys and URL credentials', () => {
  // assembled at runtime so the literal never trips secret scanners
  const fakeToken = 'gh' + 'p_' + 'abcdefghijklmnopqrstuvwxyz012345';
  const fakeKey = 'sk' + '-' + '0123456789abcdef0123';
  const out = redact(`fatal: repository 'https://x-access-token:${fakeToken}@github.com/o/r' not found`);
  assert.ok(!out.includes(fakeToken));
  assert.ok(!out.includes('x-access-token:'));
  assert.ok(out.includes('github.com/o/r'));
  assert.ok(!redact('key ' + fakeKey).includes(fakeKey));
  assert.equal(redact(null), '');
});
