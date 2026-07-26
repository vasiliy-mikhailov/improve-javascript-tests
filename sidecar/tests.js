'use strict';
// Run the repo's test suite (optionally scoped to one test file). Fast, no coverage.
const { run } = require('./exec');
const { state, event } = require('./state');
const { repoDir } = require('./repo');

/**
 * @param {string|string[]|null} scopePath  run only these test files (null = whole suite).
 *   Scoping matters: on a real repo the whole suite is ~55s and one file is ~1s, and
 *   the mutant loop asks "does this new test pass?" on every attempt.
 */
async function runTests(scopePath) {
  const dir = repoDir();
  const runner = state.runner?.testRunner;
  if (!runner) throw new Error('runner not detected');
  const scope = (Array.isArray(scopePath) ? scopePath : [scopePath]).filter(Boolean);
  let argv;
  if (runner === 'vitest') {
    argv = ['npx', '--no-install', 'vitest', 'run', '--passWithNoTests', ...scope];
  } else {
    argv = ['npx', '--no-install', 'jest', '--silent', '--ci', '--passWithNoTests'];
    for (const p of scope) argv.push('--runTestsByPath', p);
  }
  const r = await run(argv, { cwd: dir, timeoutMs: 900000, label: 'tests' });
  const out = (r.stdout + '\n' + r.stderr);
  const tail = out.split('\n').filter((l) => l.trim()).slice(-25).join('\n').slice(-2500);
  const passed = r.code === 0;
  event('tests', `${scope.length ? scope.join(' ') : 'full suite'}: ${passed ? 'green' : 'RED (exit ' + r.code + ')'}`);
  return { passed, exitCode: r.code, summary: tail };
}

module.exports = { runTests };
