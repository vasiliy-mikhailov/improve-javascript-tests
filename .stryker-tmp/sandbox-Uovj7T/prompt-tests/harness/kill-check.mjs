// @ts-nocheck
// Decide mechanically whether a generated test KILLS a mutant: it must PASS against
// the original module and FAIL against the mutated one. No judgement, no "looks
// reasonable" — the same definition Stryker uses, run in-process on a tiny fixture.
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} testSource   the test file the model produced
 * @param {string} originalSrc  module source
 * @param {string} mutatedSrc   the same module with the mutation applied
 * @param {string} moduleName   the file the test imports, e.g. 'pricing.js'
 */
export function kills(testSource, originalSrc, mutatedSrc, moduleName = 'pricing.js') {
  const dir = mkdtempSync(join(tmpdir(), 'ijst-prompt-'));
  try {
    writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
    writeFileSync(join(dir, 'vitest.js'), readFileSync(join(HERE, 'vitest-stub.js')));
    const body = testSource
      .replace(new RegExp(`from\\s+['"][^'"]*${moduleName.replace('.', '\\.')}['"]`, 'g'), "from './mod.js'")
      .replace(/from\s+['"][^'"]*\/[\w.-]+\.js['"]/g, "from './mod.js'")
      .replace(/from\s+['"]vitest['"]/g, "from './vitest.js'");
    writeFileSync(join(dir, 't.mjs'), body + "\nimport { report } from './vitest.js';\nconsole.log('R' + JSON.stringify(report()));\n");
    const run = (src) => {
      writeFileSync(join(dir, 'mod.js'), src);
      try {
        // stderr is captured, not inherited: a generated test that does not even run
        // is a legitimate outcome here (it cannot kill anything), not console noise
        const out = execFileSync('node', [join(dir, 't.mjs')],
          { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] });
        return JSON.parse(out.split('\n').find((l) => l.startsWith('R')).slice(1));
      } catch (e) { return { ran: 0, failures: ['HARNESS: ' + String(e.message).slice(0, 160)] }; }
    };
    const real = run(originalSrc);
    const mutant = run(mutatedSrc);
    return {
      kills: real.ran > 0 && real.failures.length === 0 && mutant.failures.length > 0,
      real, mutant,
    };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/** Reasoning narrated inside the committed test — what D11 forbids. */
export function leakedReasoning(testSource) {
  const patterns = [
    /\/\/[^\n]*\b(mutant|original)\b[^\n]*->/i,
    /\/\/\s*(wait|let me|let's|hmm|actually|first,? I)/i,
    /\/\/[^\n]*\bwe (need|want|should) to\b/i,
  ];
  return (testSource.match(/\/\/[^\n]*/g) || []).filter((c) => patterns.some((p) => p.test(c)));
}
