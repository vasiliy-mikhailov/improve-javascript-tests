// Does ONE generated test file kill MANY mutants? Judged exactly as Stryker judges,
// once per mutant: the test must PASS against the original module, and FAIL against
// each mutated variant. A mutant the test does not discriminate is simply not counted.
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} testSource  the file the model produced
 * @param {string} original    module source
 * @param {Array<{id:string, apply:(s:string)=>string}>} mutants
 * @returns {{greenOnReal:boolean, killed:string[], survived:string[], detail:object}}
 */
export function killsMany(testSource, original, mutants) {
  const dir = mkdtempSync(join(tmpdir(), 'ijst-multi-'));
  try {
    writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
    writeFileSync(join(dir, 'vitest.js'), readFileSync(join(HERE, 'vitest-stub.js')));
    const body = testSource
      .replace(/from\s+['"][^'"]*\/?[\w.-]*(quote|mod|pricing)[\w.-]*(\.js)?['"]/g, "from './mod.js'")
      .replace(/from\s+['"]vitest['"]/g, "from './vitest.js'");
    writeFileSync(join(dir, 't.mjs'), body + "\nimport { report } from './vitest.js';\nconsole.log('R' + JSON.stringify(report()));\n");
    const run = (src) => {
      writeFileSync(join(dir, 'mod.js'), src);
      try {
        const out = execFileSync('node', [join(dir, 't.mjs')], {
          encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'],
        });
        const line = out.split('\n').find((l) => l.startsWith('R'));
        return line ? JSON.parse(line.slice(1)) : { ran: 0, failures: ['no report'] };
      } catch (e) { return { ran: 0, failures: ['HARNESS: ' + String(e.message).slice(0, 120)] }; }
    };
    const real = run(original);
    const greenOnReal = real.ran > 0 && real.failures.length === 0;
    const killed = [], survived = [], detail = { real };
    for (const m of mutants) {
      const r = run(m.apply(original));
      detail[m.id] = r.failures.length;
      // a mutant is killed when the SAME green test now fails
      (greenOnReal && r.failures.length > 0 ? killed : survived).push(m.id);
    }
    return { greenOnReal, killed, survived, detail };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
