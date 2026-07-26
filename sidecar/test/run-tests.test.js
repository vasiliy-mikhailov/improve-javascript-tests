'use strict';
// env.js MUST come before any other sidecar require — it captures DATA_DIR.
const { withSandbox, sidecar, setExecImpl } = require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');

// The ARGV runTests builds is invisible to every other test file: helpers/fakes.js
// swaps tests.runTests wholesale, so the route tests assert on the scope they passed
// IN and never on the command that would actually be spawned.
//
// That matters now that the mutant loop scopes its check to the test file it just
// wrote (server.js: `tests.runTests(testPaths)` — an ARRAY). The pre-scope version
// took a single string and did `argv.push(scopePath)`; handed an array it pushes the
// array itself as one argv element, and the runner is asked for a file literally
// named "test/a.test.ts,test/b.test.ts". It exits non-zero, the loop reads that as
// "the new test failed against real code", and every kill attempt is discarded.

/** Run the REAL tests.runTests and return the argv it tried to spawn. */
async function argvFor(scope, runner) {
  return withSandbox(async (sb) => {
    await sb.start({ runner });
    let seen = null;
    const restore = setExecImpl((argv) => {
      seen = argv;
      return { code: 0, stdout: 'ok 1 passed', stderr: '', timedOut: false };
    });
    try {
      await sidecar.tests.runTests(scope);
    } finally { restore(); }
    return seen;
  });
}

test('runTests scopes vitest to EVERY path it is given, as separate arguments', async () => {
  const argv = await argvFor(['test/a.test.ts', 'test/b.test.ts'], 'vitest');
  // the assertion that actually catches a pushed array: argv is a string vector
  assert.ok(argv.every((a) => typeof a === 'string'),
    'every argv element must be a string, got ' + JSON.stringify(argv));
  assert.deepEqual(argv.slice(-2), ['test/a.test.ts', 'test/b.test.ts']);
});

test('runTests repeats --runTestsByPath for jest, once per path', async () => {
  const argv = await argvFor(['test/a.test.ts', 'test/b.test.ts'], 'jest');
  assert.ok(argv.every((a) => typeof a === 'string'),
    'every argv element must be a string, got ' + JSON.stringify(argv));
  assert.deepEqual(argv.slice(-4),
    ['--runTestsByPath', 'test/a.test.ts', '--runTestsByPath', 'test/b.test.ts']);
});

test('a bare string path still scopes the run — the old single-file callers are unbroken', async () => {
  assert.deepEqual((await argvFor('test/a.test.ts', 'vitest')).slice(-1), ['test/a.test.ts']);
  assert.deepEqual((await argvFor('test/a.test.ts', 'jest')).slice(-2),
    ['--runTestsByPath', 'test/a.test.ts']);
});

test('nothing to scope to means the WHOLE suite, never a bogus empty argument', async () => {
  // null (verify's full-suite check), and [] (a round that wrote no test) must both
  // come out as "run everything" rather than as an empty string the runner would
  // treat as a path — hence the filter(Boolean).
  for (const empty of [null, [], [''], [null]]) {
    const argv = await argvFor(empty, 'vitest');
    assert.equal(argv.at(-1), '--passWithNoTests', 'vitest, scope=' + JSON.stringify(empty));
    const jestArgv = await argvFor(empty, 'jest');
    assert.ok(!jestArgv.includes('--runTestsByPath'), 'jest, scope=' + JSON.stringify(empty));
  }
});
