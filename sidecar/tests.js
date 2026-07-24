'use strict';
// Run the repo's test suite (optionally scoped to one test file). Fast, no coverage.
const { run } = require('./exec');
const { state, event } = require('./state');
const { repoDir } = require('./repo');

async function runTests(scopePath) {
  const dir = repoDir();
  const runner = state.runner?.testRunner;
  if (!runner) throw new Error('runner not detected');
  let argv;
  if (runner === 'vitest') {
    argv = ['npx', '--no-install', 'vitest', 'run', '--passWithNoTests'];
    if (scopePath) argv.push(scopePath);
  } else {
    argv = ['npx', '--no-install', 'jest', '--silent', '--ci', '--passWithNoTests'];
    if (scopePath) argv.push('--runTestsByPath', scopePath);
  }
  const r = await run(argv, { cwd: dir, timeoutMs: 900000, label: 'tests' });
  const out = (r.stdout + '\n' + r.stderr);
  const tail = out.split('\n').filter((l) => l.trim()).slice(-25).join('\n').slice(-2500);
  const passed = r.code === 0;
  event('tests', `${scopePath || 'full suite'}: ${passed ? 'green' : 'RED (exit ' + r.code + ')'}`);
  return { passed, exitCode: r.code, summary: tail };
}

module.exports = { runTests };
