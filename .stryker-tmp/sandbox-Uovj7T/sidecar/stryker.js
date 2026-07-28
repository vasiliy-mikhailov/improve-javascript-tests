// @ts-nocheck
'use strict';

// Stryker: generate a per-run config, run mutation testing on one file, parse mutation.json.
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
const fs = require('node:fs');
const path = require('node:path');
const {
  run
} = require('./exec');
const {
  state,
  event
} = require('./state');
const {
  repoDir,
  readFileSafe
} = require('./repo');
const {
  round2
} = require('./util');
const CFG_NAME = stryMutAct_9fa48("5729") ? "" : (stryCov_9fa48("5729"), '.ijst-stryker.config.json');
const REPORT = path.join(stryMutAct_9fa48("5730") ? "" : (stryCov_9fa48("5730"), 'reports'), stryMutAct_9fa48("5731") ? "" : (stryCov_9fa48("5731"), 'mutation'), stryMutAct_9fa48("5732") ? "" : (stryCov_9fa48("5732"), 'mutation.json'));
function writeConfig(mutateSpec) {
  if (stryMutAct_9fa48("5733")) {
    {}
  } else {
    stryCov_9fa48("5733");
    const dir = repoDir();
    const runner = stryMutAct_9fa48("5734") ? state.runner.testRunner : (stryCov_9fa48("5734"), state.runner?.testRunner);
    const cfg = stryMutAct_9fa48("5735") ? {} : (stryCov_9fa48("5735"), {
      $schema: stryMutAct_9fa48("5736") ? "" : (stryCov_9fa48("5736"), 'https://raw.githubusercontent.com/stryker-mutator/stryker/master/packages/api/schema/stryker-core.json'),
      testRunner: runner,
      // explicit plugin list — auto-discovery fails under pnpm's symlinked node_modules
      plugins: stryMutAct_9fa48("5737") ? [] : (stryCov_9fa48("5737"), [(stryMutAct_9fa48("5740") ? runner !== 'vitest' : stryMutAct_9fa48("5739") ? false : stryMutAct_9fa48("5738") ? true : (stryCov_9fa48("5738", "5739", "5740"), runner === (stryMutAct_9fa48("5741") ? "" : (stryCov_9fa48("5741"), 'vitest')))) ? stryMutAct_9fa48("5742") ? "" : (stryCov_9fa48("5742"), '@stryker-mutator/vitest-runner') : stryMutAct_9fa48("5743") ? "" : (stryCov_9fa48("5743"), '@stryker-mutator/jest-runner')]),
      // may be a plain path or a mutation range "src/foo.ts:120-190" (Stryker 9.x).
      // A range instruments only those lines, which turns kill-verification from
      // minutes into seconds. Ranges cannot contain glob magic.
      mutate: stryMutAct_9fa48("5744") ? [] : (stryCov_9fa48("5744"), [mutateSpec]),
      reporters: stryMutAct_9fa48("5745") ? [] : (stryCov_9fa48("5745"), [stryMutAct_9fa48("5746") ? "" : (stryCov_9fa48("5746"), 'json'), stryMutAct_9fa48("5747") ? "" : (stryCov_9fa48("5747"), 'progress')]),
      coverageAnalysis: stryMutAct_9fa48("5748") ? "" : (stryCov_9fa48("5748"), 'perTest'),
      thresholds: stryMutAct_9fa48("5749") ? {} : (stryCov_9fa48("5749"), {
        high: 80,
        low: 60,
        break: null
      }),
      tempDirName: stryMutAct_9fa48("5750") ? "" : (stryCov_9fa48("5750"), '.stryker-tmp'),
      cleanTempDir: stryMutAct_9fa48("5751") ? false : (stryCov_9fa48("5751"), true),
      // CPU is cheap relative to model time, so run mutants wide. But raising
      // concurrency ALONE corrupts the metric: Stryker counts a timed-out mutant as
      // KILLED, so a loaded box silently inflates the mutation score. The timeout is
      // therefore scaled with the parallelism, and timeouts are reported (below) so
      // inflation is visible instead of silent.
      timeoutMS: parseInt(stryMutAct_9fa48("5754") ? process.env.STRYKER_TIMEOUT_MS && '60000' : stryMutAct_9fa48("5753") ? false : stryMutAct_9fa48("5752") ? true : (stryCov_9fa48("5752", "5753", "5754"), process.env.STRYKER_TIMEOUT_MS || (stryMutAct_9fa48("5755") ? "" : (stryCov_9fa48("5755"), '60000'))), 10),
      timeoutFactor: parseFloat(stryMutAct_9fa48("5758") ? process.env.STRYKER_TIMEOUT_FACTOR && '2.5' : stryMutAct_9fa48("5757") ? false : stryMutAct_9fa48("5756") ? true : (stryCov_9fa48("5756", "5757", "5758"), process.env.STRYKER_TIMEOUT_FACTOR || (stryMutAct_9fa48("5759") ? "" : (stryCov_9fa48("5759"), '2.5')))),
      concurrency: parseInt(stryMutAct_9fa48("5762") ? process.env.STRYKER_CONCURRENCY && '6' : stryMutAct_9fa48("5761") ? false : stryMutAct_9fa48("5760") ? true : (stryCov_9fa48("5760", "5761", "5762"), process.env.STRYKER_CONCURRENCY || (stryMutAct_9fa48("5763") ? "" : (stryCov_9fa48("5763"), '6'))), 10),
      jsonReporter: stryMutAct_9fa48("5764") ? {} : (stryCov_9fa48("5764"), {
        fileName: REPORT
      })
    });
    if (stryMutAct_9fa48("5767") ? runner !== 'vitest' : stryMutAct_9fa48("5766") ? false : stryMutAct_9fa48("5765") ? true : (stryCov_9fa48("5765", "5766", "5767"), runner === (stryMutAct_9fa48("5768") ? "" : (stryCov_9fa48("5768"), 'vitest')))) {
      if (stryMutAct_9fa48("5769")) {
        {}
      } else {
        stryCov_9fa48("5769");
        // related:false (stryker>=9 only) → run whole suite; otherwise files without
        // any test crash stryker. Stryker 8 has no such option (runs whole suite anyway).
        let major = 9;
        try {
          if (stryMutAct_9fa48("5770")) {
            {}
          } else {
            stryCov_9fa48("5770");
            major = parseInt(JSON.parse(fs.readFileSync(path.join(dir, stryMutAct_9fa48("5771") ? "" : (stryCov_9fa48("5771"), 'node_modules'), stryMutAct_9fa48("5772") ? "" : (stryCov_9fa48("5772"), '@stryker-mutator'), stryMutAct_9fa48("5773") ? "" : (stryCov_9fa48("5773"), 'core'), stryMutAct_9fa48("5774") ? "" : (stryCov_9fa48("5774"), 'package.json')), stryMutAct_9fa48("5775") ? "" : (stryCov_9fa48("5775"), 'utf8'))).version.split(stryMutAct_9fa48("5776") ? "" : (stryCov_9fa48("5776"), '.'))[0], 10);
          }
        } catch {}
        // related:true → only tests importing the mutated file run; unrelated broken
        // suite parts (git-dependent tests, strict fixtures) can't sink the mutation run.
        // Files with no related tests are handled upstream (score 0, noTests flag).
        cfg.vitest = (stryMutAct_9fa48("5780") ? major < 9 : stryMutAct_9fa48("5779") ? major > 9 : stryMutAct_9fa48("5778") ? false : stryMutAct_9fa48("5777") ? true : (stryCov_9fa48("5777", "5778", "5779", "5780"), major >= 9)) ? stryMutAct_9fa48("5781") ? {} : (stryCov_9fa48("5781"), {
          related: stryMutAct_9fa48("5782") ? false : (stryCov_9fa48("5782"), true)
        }) : {};
      }
    } else if (stryMutAct_9fa48("5785") ? runner !== 'jest' : stryMutAct_9fa48("5784") ? false : stryMutAct_9fa48("5783") ? true : (stryCov_9fa48("5783", "5784", "5785"), runner === (stryMutAct_9fa48("5786") ? "" : (stryCov_9fa48("5786"), 'jest')))) {
      if (stryMutAct_9fa48("5787")) {
        {}
      } else {
        stryCov_9fa48("5787");
        cfg.jest = stryMutAct_9fa48("5788") ? {} : (stryCov_9fa48("5788"), {
          enableFindRelatedTests: stryMutAct_9fa48("5789") ? false : (stryCov_9fa48("5789"), true)
        });
      }
    }
    // TS repos: stryker may fail on type errors introduced by mutants unless checkers off (default off).
    fs.writeFileSync(path.join(dir, CFG_NAME), JSON.stringify(cfg, null, 2));
  }
}

/**
 * @param {string} file  repo-relative source path
 * @param {object} [opts]
 * @param {{from:number,to:number}} [opts.range]  mutate only these lines (kill verification)
 */
async function runStryker(file, opts = {}) {
  if (stryMutAct_9fa48("5790")) {
    {}
  } else {
    stryCov_9fa48("5790");
    const dir = repoDir();
    if (stryMutAct_9fa48("5793") ? false : stryMutAct_9fa48("5792") ? true : stryMutAct_9fa48("5791") ? state.runner?.testRunner : (stryCov_9fa48("5791", "5792", "5793"), !(stryMutAct_9fa48("5794") ? state.runner.testRunner : (stryCov_9fa48("5794"), state.runner?.testRunner)))) throw new Error(stryMutAct_9fa48("5795") ? "" : (stryCov_9fa48("5795"), 'runner not detected — call /api/repo/prepare first'));
    const spec = opts.range ? stryMutAct_9fa48("5796") ? `` : (stryCov_9fa48("5796"), `${file}:${opts.range.from}-${opts.range.to}`) : file;
    writeConfig(spec);
    const reportAbs = path.join(dir, REPORT);
    try {
      if (stryMutAct_9fa48("5797")) {
        {}
      } else {
        stryCov_9fa48("5797");
        fs.unlinkSync(reportAbs);
      }
    } catch {}
    const r = await run(stryMutAct_9fa48("5798") ? [] : (stryCov_9fa48("5798"), [stryMutAct_9fa48("5799") ? "" : (stryCov_9fa48("5799"), 'npx'), stryMutAct_9fa48("5800") ? "" : (stryCov_9fa48("5800"), '--no-install'), stryMutAct_9fa48("5801") ? "" : (stryCov_9fa48("5801"), 'stryker'), stryMutAct_9fa48("5802") ? "" : (stryCov_9fa48("5802"), 'run'), CFG_NAME]), stryMutAct_9fa48("5803") ? {} : (stryCov_9fa48("5803"), {
      cwd: dir,
      timeoutMs: 2400000,
      label: stryMutAct_9fa48("5804") ? "" : (stryCov_9fa48("5804"), 'stryker')
    }));
    if (stryMutAct_9fa48("5807") ? false : stryMutAct_9fa48("5806") ? true : stryMutAct_9fa48("5805") ? fs.existsSync(reportAbs) : (stryCov_9fa48("5805", "5806", "5807"), !fs.existsSync(reportAbs))) {
      if (stryMutAct_9fa48("5808")) {
        {}
      } else {
        stryCov_9fa48("5808");
        const out = stryMutAct_9fa48("5809") ? r.stderr - r.stdout : (stryCov_9fa48("5809"), r.stderr + r.stdout);
        if (stryMutAct_9fa48("5811") ? false : stryMutAct_9fa48("5810") ? true : (stryCov_9fa48("5810", "5811"), /No tests were executed/i.test(out))) {
          if (stryMutAct_9fa48("5812")) {
            {}
          } else {
            stryCov_9fa48("5812");
            // file (or repo) has no tests at all → mutation score is by definition 0
            event(stryMutAct_9fa48("5813") ? "" : (stryCov_9fa48("5813"), 'stryker'), stryMutAct_9fa48("5814") ? `` : (stryCov_9fa48("5814"), `${file}: no tests executed — mutation score 0 (nothing kills mutants yet)`));
            return stryMutAct_9fa48("5815") ? {} : (stryCov_9fa48("5815"), {
              file,
              totalMutants: null,
              killed: 0,
              score: 0,
              survived: stryMutAct_9fa48("5816") ? ["Stryker was here"] : (stryCov_9fa48("5816"), []),
              noTests: stryMutAct_9fa48("5817") ? false : (stryCov_9fa48("5817"), true)
            });
          }
        }
        throw new Error((stryMutAct_9fa48("5818") ? `` : (stryCov_9fa48("5818"), `stryker produced no report (exit ${r.code}): `)) + (stryMutAct_9fa48("5819") ? out : (stryCov_9fa48("5819"), out.slice(stryMutAct_9fa48("5820") ? +800 : (stryCov_9fa48("5820"), -800)))));
      }
    }
    const parsed = parseReport(reportAbs, file);
    // the caller needs killedBy/testFiles to say which test earned its place, and the
    // report is already on disk and parsed — handing it over costs nothing
    try {
      if (stryMutAct_9fa48("5821")) {
        {}
      } else {
        stryCov_9fa48("5821");
        parsed.report = JSON.parse(fs.readFileSync(reportAbs, stryMutAct_9fa48("5822") ? "" : (stryCov_9fa48("5822"), 'utf8')));
      }
    } catch {}
    if (stryMutAct_9fa48("5824") ? false : stryMutAct_9fa48("5823") ? true : (stryCov_9fa48("5823", "5824"), opts.range)) {
      if (stryMutAct_9fa48("5825")) {
        {}
      } else {
        stryCov_9fa48("5825");
        // A range run scores ONLY those lines. It answers "did this mutant die?", never
        // "what is this file's mutation score" — callers must not write it into metrics.
        parsed.partial = stryMutAct_9fa48("5826") ? false : (stryCov_9fa48("5826"), true);
        parsed.range = opts.range;
        event(stryMutAct_9fa48("5827") ? "" : (stryCov_9fa48("5827"), 'stryker'), (stryMutAct_9fa48("5828") ? `` : (stryCov_9fa48("5828"), `${file}:${opts.range.from}-${opts.range.to} (kill check): `)) + (stryMutAct_9fa48("5829") ? `` : (stryCov_9fa48("5829"), `${parsed.totalMutants} mutant(s) in range, ${parsed.killed} killed, ${parsed.survived.length} still alive`)));
      }
    } else {
      if (stryMutAct_9fa48("5830")) {
        {}
      } else {
        stryCov_9fa48("5830");
        // the survivor COUNT must come from the untruncated total, not the capped array
        event(stryMutAct_9fa48("5831") ? "" : (stryCov_9fa48("5831"), 'stryker'), stryMutAct_9fa48("5832") ? `` : (stryCov_9fa48("5832"), `${file}: ${parsed.totalMutants} mutants, ${parsed.killed} killed, ${parsed.survivedTotal} survived+nocov, score ${parsed.score}%`));
      }
    }
    return parsed;
  }
}
function parseReport(reportAbs, file) {
  if (stryMutAct_9fa48("5833")) {
    {}
  } else {
    stryCov_9fa48("5833");
    const report = JSON.parse(fs.readFileSync(reportAbs, stryMutAct_9fa48("5834") ? "" : (stryCov_9fa48("5834"), 'utf8')));
    const mutants = stryMutAct_9fa48("5835") ? ["Stryker was here"] : (stryCov_9fa48("5835"), []);
    for (const [f, d] of Object.entries(stryMutAct_9fa48("5838") ? report.files && {} : stryMutAct_9fa48("5837") ? false : stryMutAct_9fa48("5836") ? true : (stryCov_9fa48("5836", "5837", "5838"), report.files || {}))) {
      if (stryMutAct_9fa48("5839")) {
        {}
      } else {
        stryCov_9fa48("5839");
        for (const m of stryMutAct_9fa48("5842") ? d.mutants && [] : stryMutAct_9fa48("5841") ? false : stryMutAct_9fa48("5840") ? true : (stryCov_9fa48("5840", "5841", "5842"), d.mutants || (stryMutAct_9fa48("5843") ? ["Stryker was here"] : (stryCov_9fa48("5843"), [])))) {
          if (stryMutAct_9fa48("5844")) {
            {}
          } else {
            stryCov_9fa48("5844");
            mutants.push(stryMutAct_9fa48("5845") ? {} : (stryCov_9fa48("5845"), {
              id: m.id,
              mutator: m.mutatorName,
              line: stryMutAct_9fa48("5847") ? m.location.start?.line : stryMutAct_9fa48("5846") ? m.location?.start.line : (stryCov_9fa48("5846", "5847"), m.location?.start?.line),
              column: stryMutAct_9fa48("5849") ? m.location.start?.column : stryMutAct_9fa48("5848") ? m.location?.start.column : (stryCov_9fa48("5848", "5849"), m.location?.start?.column),
              endLine: stryMutAct_9fa48("5851") ? m.location.end?.line : stryMutAct_9fa48("5850") ? m.location?.end.line : (stryCov_9fa48("5850", "5851"), m.location?.end?.line),
              replacement: stryMutAct_9fa48("5852") ? m.replacement || '' : (stryCov_9fa48("5852"), (stryMutAct_9fa48("5855") ? m.replacement && '' : stryMutAct_9fa48("5854") ? false : stryMutAct_9fa48("5853") ? true : (stryCov_9fa48("5853", "5854", "5855"), m.replacement || (stryMutAct_9fa48("5856") ? "Stryker was here!" : (stryCov_9fa48("5856"), '')))).slice(0, 200)),
              status: stryMutAct_9fa48("5857") ? String(m.status || '').toUpperCase() : (stryCov_9fa48("5857"), String(stryMutAct_9fa48("5860") ? m.status && '' : stryMutAct_9fa48("5859") ? false : stryMutAct_9fa48("5858") ? true : (stryCov_9fa48("5858", "5859", "5860"), m.status || (stryMutAct_9fa48("5861") ? "Stryker was here!" : (stryCov_9fa48("5861"), '')))).toLowerCase()),
              file: f
            }));
          }
        }
      }
    }
    // Mutation score (stryker definition): killed+timeout / (all - ignored - compileError)
    const valid = stryMutAct_9fa48("5862") ? mutants : (stryCov_9fa48("5862"), mutants.filter(stryMutAct_9fa48("5863") ? () => undefined : (stryCov_9fa48("5863"), m => stryMutAct_9fa48("5864") ? ['ignored', 'compileerror'].includes(m.status) : (stryCov_9fa48("5864"), !(stryMutAct_9fa48("5865") ? [] : (stryCov_9fa48("5865"), [stryMutAct_9fa48("5866") ? "" : (stryCov_9fa48("5866"), 'ignored'), stryMutAct_9fa48("5867") ? "" : (stryCov_9fa48("5867"), 'compileerror')])).includes(m.status)))));
    const killed = stryMutAct_9fa48("5868") ? valid.length : (stryCov_9fa48("5868"), valid.filter(stryMutAct_9fa48("5869") ? () => undefined : (stryCov_9fa48("5869"), m => (stryMutAct_9fa48("5870") ? [] : (stryCov_9fa48("5870"), [stryMutAct_9fa48("5871") ? "" : (stryCov_9fa48("5871"), 'killed'), stryMutAct_9fa48("5872") ? "" : (stryCov_9fa48("5872"), 'timeout')])).includes(m.status))).length);
    const timedOut = stryMutAct_9fa48("5873") ? valid.length : (stryCov_9fa48("5873"), valid.filter(stryMutAct_9fa48("5874") ? () => undefined : (stryCov_9fa48("5874"), m => stryMutAct_9fa48("5877") ? m.status !== 'timeout' : stryMutAct_9fa48("5876") ? false : stryMutAct_9fa48("5875") ? true : (stryCov_9fa48("5875", "5876", "5877"), m.status === (stryMutAct_9fa48("5878") ? "" : (stryCov_9fa48("5878"), 'timeout'))))).length);
    const score = valid.length ? round2(stryMutAct_9fa48("5879") ? killed / valid.length / 100 : (stryCov_9fa48("5879"), (stryMutAct_9fa48("5880") ? killed * valid.length : (stryCov_9fa48("5880"), killed / valid.length)) * 100)) : 100;
    // A timeout counts as a kill in Stryker's score. On a loaded box that turns
    // machine contention into free "improvement", so make it loud when it is a
    // material share of the result rather than letting it flatter the metric.
    const timeoutShare = valid.length ? stryMutAct_9fa48("5881") ? timedOut * valid.length : (stryCov_9fa48("5881"), timedOut / valid.length) : 0;
    if (stryMutAct_9fa48("5885") ? timeoutShare <= 0.1 : stryMutAct_9fa48("5884") ? timeoutShare >= 0.1 : stryMutAct_9fa48("5883") ? false : stryMutAct_9fa48("5882") ? true : (stryCov_9fa48("5882", "5883", "5884", "5885"), timeoutShare > 0.1)) {
      if (stryMutAct_9fa48("5886")) {
        {}
      } else {
        stryCov_9fa48("5886");
        event(stryMutAct_9fa48("5887") ? "" : (stryCov_9fa48("5887"), 'stryker'), (stryMutAct_9fa48("5888") ? `` : (stryCov_9fa48("5888"), `WARNING: ${timedOut}/${valid.length} mutants (${round2(stryMutAct_9fa48("5889") ? timeoutShare / 100 : (stryCov_9fa48("5889"), timeoutShare * 100))}%) counted as killed by TIMEOUT `)) + (stryMutAct_9fa48("5890") ? `` : (stryCov_9fa48("5890"), `on ${file} — the score may be inflated by machine load; consider raising STRYKER_TIMEOUT_MS or lowering STRYKER_CONCURRENCY`)));
      }
    }
    const survivedList = stryMutAct_9fa48("5892") ? valid
    // covered-but-surviving mutants first: they only need sharper assertions,
    // while no-coverage mutants need brand-new tests (coverage phase's job)
    .sort((a, b) => (a.status === 'survived' ? 0 : 1) - (b.status === 'survived' ? 0 : 1) || (a.line || 0) - (b.line || 0)) : stryMutAct_9fa48("5891") ? valid.filter(m => ['survived', 'nocoverage'].includes(m.status))
    // covered-but-surviving mutants first: they only need sharper assertions,
    // while no-coverage mutants need brand-new tests (coverage phase's job)
    : (stryCov_9fa48("5891", "5892"), valid.filter(stryMutAct_9fa48("5893") ? () => undefined : (stryCov_9fa48("5893"), m => (stryMutAct_9fa48("5894") ? [] : (stryCov_9fa48("5894"), [stryMutAct_9fa48("5895") ? "" : (stryCov_9fa48("5895"), 'survived'), stryMutAct_9fa48("5896") ? "" : (stryCov_9fa48("5896"), 'nocoverage')])).includes(m.status)))
    // covered-but-surviving mutants first: they only need sharper assertions,
    // while no-coverage mutants need brand-new tests (coverage phase's job)
    .sort(stryMutAct_9fa48("5897") ? () => undefined : (stryCov_9fa48("5897"), (a, b) => stryMutAct_9fa48("5900") ? (a.status === 'survived' ? 0 : 1) - (b.status === 'survived' ? 0 : 1) && (a.line || 0) - (b.line || 0) : stryMutAct_9fa48("5899") ? false : stryMutAct_9fa48("5898") ? true : (stryCov_9fa48("5898", "5899", "5900"), (stryMutAct_9fa48("5901") ? (a.status === 'survived' ? 0 : 1) + (b.status === 'survived' ? 0 : 1) : (stryCov_9fa48("5901"), ((stryMutAct_9fa48("5904") ? a.status !== 'survived' : stryMutAct_9fa48("5903") ? false : stryMutAct_9fa48("5902") ? true : (stryCov_9fa48("5902", "5903", "5904"), a.status === (stryMutAct_9fa48("5905") ? "" : (stryCov_9fa48("5905"), 'survived')))) ? 0 : 1) - ((stryMutAct_9fa48("5908") ? b.status !== 'survived' : stryMutAct_9fa48("5907") ? false : stryMutAct_9fa48("5906") ? true : (stryCov_9fa48("5906", "5907", "5908"), b.status === (stryMutAct_9fa48("5909") ? "" : (stryCov_9fa48("5909"), 'survived')))) ? 0 : 1))) || (stryMutAct_9fa48("5910") ? (a.line || 0) + (b.line || 0) : (stryCov_9fa48("5910"), (stryMutAct_9fa48("5913") ? a.line && 0 : stryMutAct_9fa48("5912") ? false : stryMutAct_9fa48("5911") ? true : (stryCov_9fa48("5911", "5912", "5913"), a.line || 0)) - (stryMutAct_9fa48("5916") ? b.line && 0 : stryMutAct_9fa48("5915") ? false : stryMutAct_9fa48("5914") ? true : (stryCov_9fa48("5914", "5915", "5916"), b.line || 0))))))));
    // attach short source context for each survived mutant (for LLM prompts)
    const src = readFileSafe(file, 500000);
    const lines = src ? src.split(stryMutAct_9fa48("5917") ? "" : (stryCov_9fa48("5917"), '\n')) : stryMutAct_9fa48("5918") ? ["Stryker was here"] : (stryCov_9fa48("5918"), []);
    for (const m of survivedList) {
      if (stryMutAct_9fa48("5919")) {
        {}
      } else {
        stryCov_9fa48("5919");
        if (stryMutAct_9fa48("5922") ? m.line || lines.length : stryMutAct_9fa48("5921") ? false : stryMutAct_9fa48("5920") ? true : (stryCov_9fa48("5920", "5921", "5922"), m.line && lines.length)) {
          if (stryMutAct_9fa48("5923")) {
            {}
          } else {
            stryCov_9fa48("5923");
            const from = stryMutAct_9fa48("5924") ? Math.min(0, m.line - 6) : (stryCov_9fa48("5924"), Math.max(0, stryMutAct_9fa48("5925") ? m.line + 6 : (stryCov_9fa48("5925"), m.line - 6)));
            const to = stryMutAct_9fa48("5926") ? Math.max(lines.length, (m.endLine || m.line) + 5) : (stryCov_9fa48("5926"), Math.min(lines.length, stryMutAct_9fa48("5927") ? (m.endLine || m.line) - 5 : (stryCov_9fa48("5927"), (stryMutAct_9fa48("5930") ? m.endLine && m.line : stryMutAct_9fa48("5929") ? false : stryMutAct_9fa48("5928") ? true : (stryCov_9fa48("5928", "5929", "5930"), m.endLine || m.line)) + 5)));
            m.context = stryMutAct_9fa48("5931") ? lines.map((l, i) => `${from + i + 1}: ${l}`).join('\n') : (stryCov_9fa48("5931"), lines.slice(from, to).map(stryMutAct_9fa48("5932") ? () => undefined : (stryCov_9fa48("5932"), (l, i) => stryMutAct_9fa48("5933") ? `` : (stryCov_9fa48("5933"), `${stryMutAct_9fa48("5934") ? from + i - 1 : (stryCov_9fa48("5934"), (stryMutAct_9fa48("5935") ? from - i : (stryCov_9fa48("5935"), from + i)) + 1)}: ${l}`))).join(stryMutAct_9fa48("5936") ? "" : (stryCov_9fa48("5936"), '\n')));
          }
        }
      }
    }
    return stryMutAct_9fa48("5937") ? {} : (stryCov_9fa48("5937"), {
      file,
      totalMutants: valid.length,
      killed,
      timedOut,
      score,
      // the array is capped for prompt/state size; the COUNT must not be, or
      // "how many died" is meaningless on files with many survivors
      survivedTotal: survivedList.length,
      // identity-only view of EVERY survivor. "Did the target die?" is answered by
      // absence from the survivor list, so answering it from the capped array below
      // reports a false kill for any mutant past the cap — exactly the weakly-tested
      // files where the cap bites.
      survivedAll: survivedList.map(stryMutAct_9fa48("5938") ? () => undefined : (stryCov_9fa48("5938"), m => stryMutAct_9fa48("5939") ? {} : (stryCov_9fa48("5939"), {
        mutator: m.mutator,
        line: m.line,
        column: m.column,
        replacement: stryMutAct_9fa48("5940") ? String(m.replacement ?? '') : (stryCov_9fa48("5940"), String(stryMutAct_9fa48("5941") ? m.replacement && '' : (stryCov_9fa48("5941"), m.replacement ?? (stryMutAct_9fa48("5942") ? "Stryker was here!" : (stryCov_9fa48("5942"), '')))).slice(0, 60)),
        // status travels with the mutant: this list is what fills the durable queue, and
        // the sweep prompt tells the model "not covered at all — this test must reach the
        // code first" for a nocoverage site. Dropping it here made that branch dead, so
        // every uncovered site was described as already covered but under-asserted.
        status: m.status
      }))),
      survived: stryMutAct_9fa48("5943") ? survivedList : (stryCov_9fa48("5943"), survivedList.slice(0, 100))
    });
  }
}
module.exports = stryMutAct_9fa48("5944") ? {} : (stryCov_9fa48("5944"), {
  runStryker,
  parseReport
});