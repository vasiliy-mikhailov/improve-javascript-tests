// @ts-nocheck
'use strict';

// Run the repo's test suite (optionally scoped to one test file). Fast, no coverage.
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
const {
  run
} = require('./exec');
const {
  state,
  event
} = require('./state');
const {
  repoDir
} = require('./repo');

/**
 * @param {string|string[]|null} scopePath  run only these test files (null = whole suite).
 *   Scoping matters: on a real repo the whole suite is ~55s and one file is ~1s, and
 *   the mutant loop asks "does this new test pass?" on every attempt.
 */
async function runTests(scopePath) {
  if (stryMutAct_9fa48("5945")) {
    {}
  } else {
    stryCov_9fa48("5945");
    const dir = repoDir();
    const runner = stryMutAct_9fa48("5946") ? state.runner.testRunner : (stryCov_9fa48("5946"), state.runner?.testRunner);
    if (stryMutAct_9fa48("5949") ? false : stryMutAct_9fa48("5948") ? true : stryMutAct_9fa48("5947") ? runner : (stryCov_9fa48("5947", "5948", "5949"), !runner)) throw new Error(stryMutAct_9fa48("5950") ? "" : (stryCov_9fa48("5950"), 'runner not detected'));
    const scope = stryMutAct_9fa48("5951") ? Array.isArray(scopePath) ? scopePath : [scopePath] : (stryCov_9fa48("5951"), (Array.isArray(scopePath) ? scopePath : stryMutAct_9fa48("5952") ? [] : (stryCov_9fa48("5952"), [scopePath])).filter(Boolean));
    let argv;
    if (stryMutAct_9fa48("5955") ? runner !== 'vitest' : stryMutAct_9fa48("5954") ? false : stryMutAct_9fa48("5953") ? true : (stryCov_9fa48("5953", "5954", "5955"), runner === (stryMutAct_9fa48("5956") ? "" : (stryCov_9fa48("5956"), 'vitest')))) {
      if (stryMutAct_9fa48("5957")) {
        {}
      } else {
        stryCov_9fa48("5957");
        argv = stryMutAct_9fa48("5958") ? [] : (stryCov_9fa48("5958"), [stryMutAct_9fa48("5959") ? "" : (stryCov_9fa48("5959"), 'npx'), stryMutAct_9fa48("5960") ? "" : (stryCov_9fa48("5960"), '--no-install'), stryMutAct_9fa48("5961") ? "" : (stryCov_9fa48("5961"), 'vitest'), stryMutAct_9fa48("5962") ? "" : (stryCov_9fa48("5962"), 'run'), stryMutAct_9fa48("5963") ? "" : (stryCov_9fa48("5963"), '--passWithNoTests'), ...scope]);
      }
    } else {
      if (stryMutAct_9fa48("5964")) {
        {}
      } else {
        stryCov_9fa48("5964");
        argv = stryMutAct_9fa48("5965") ? [] : (stryCov_9fa48("5965"), [stryMutAct_9fa48("5966") ? "" : (stryCov_9fa48("5966"), 'npx'), stryMutAct_9fa48("5967") ? "" : (stryCov_9fa48("5967"), '--no-install'), stryMutAct_9fa48("5968") ? "" : (stryCov_9fa48("5968"), 'jest'), stryMutAct_9fa48("5969") ? "" : (stryCov_9fa48("5969"), '--silent'), stryMutAct_9fa48("5970") ? "" : (stryCov_9fa48("5970"), '--ci'), stryMutAct_9fa48("5971") ? "" : (stryCov_9fa48("5971"), '--passWithNoTests')]);
        for (const p of scope) argv.push(stryMutAct_9fa48("5972") ? "" : (stryCov_9fa48("5972"), '--runTestsByPath'), p);
      }
    }
    const r = await run(argv, stryMutAct_9fa48("5973") ? {} : (stryCov_9fa48("5973"), {
      cwd: dir,
      timeoutMs: 900000,
      label: stryMutAct_9fa48("5974") ? "" : (stryCov_9fa48("5974"), 'tests')
    }));
    const out = r.stdout + (stryMutAct_9fa48("5975") ? "" : (stryCov_9fa48("5975"), '\n')) + r.stderr;
    const tail = stryMutAct_9fa48("5978") ? out.split('\n').slice(-25).join('\n').slice(-2500) : stryMutAct_9fa48("5977") ? out.split('\n').filter(l => l.trim()).join('\n').slice(-2500) : stryMutAct_9fa48("5976") ? out.split('\n').filter(l => l.trim()).slice(-25).join('\n') : (stryCov_9fa48("5976", "5977", "5978"), out.split(stryMutAct_9fa48("5979") ? "" : (stryCov_9fa48("5979"), '\n')).filter(stryMutAct_9fa48("5980") ? () => undefined : (stryCov_9fa48("5980"), l => stryMutAct_9fa48("5981") ? l : (stryCov_9fa48("5981"), l.trim()))).slice(stryMutAct_9fa48("5982") ? +25 : (stryCov_9fa48("5982"), -25)).join(stryMutAct_9fa48("5983") ? "" : (stryCov_9fa48("5983"), '\n')).slice(stryMutAct_9fa48("5984") ? +2500 : (stryCov_9fa48("5984"), -2500)));
    const passed = stryMutAct_9fa48("5987") ? r.code !== 0 : stryMutAct_9fa48("5986") ? false : stryMutAct_9fa48("5985") ? true : (stryCov_9fa48("5985", "5986", "5987"), r.code === 0);
    event(stryMutAct_9fa48("5988") ? "" : (stryCov_9fa48("5988"), 'tests'), stryMutAct_9fa48("5989") ? `` : (stryCov_9fa48("5989"), `${scope.length ? scope.join(stryMutAct_9fa48("5990") ? "" : (stryCov_9fa48("5990"), ' ')) : stryMutAct_9fa48("5991") ? "" : (stryCov_9fa48("5991"), 'full suite')}: ${passed ? stryMutAct_9fa48("5992") ? "" : (stryCov_9fa48("5992"), 'green') : (stryMutAct_9fa48("5993") ? "" : (stryCov_9fa48("5993"), 'RED (exit ')) + r.code + (stryMutAct_9fa48("5994") ? "" : (stryCov_9fa48("5994"), ')'))}`));
    return stryMutAct_9fa48("5995") ? {} : (stryCov_9fa48("5995"), {
      passed,
      exitCode: r.code,
      summary: tail
    });
  }
}
module.exports = stryMutAct_9fa48("5996") ? {} : (stryCov_9fa48("5996"), {
  runTests
});