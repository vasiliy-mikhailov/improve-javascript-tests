// @ts-nocheck
'use strict';

// Human-equivalent timesheet: how long would a mid-level developer have taken
// to deliver the same test work? Deterministic, itemized, auditable rates.
//
//   analysis   30 min base to open & understand the module, +1 min per 20 source
//              lines (capped at 90 min)
//   writing    12 min per test case that ended up committed
//   mutation   10 min per mutant killed (finding the weakness + crafting the
//              distinguishing assertion — the human equivalent of mutation analysis)
//   verify     15 min base (run suite/coverage, self-review) + 5 min per
//              improvement round (each round = one measure-adjust cycle)
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
  round2
} = require('./util');
const RATES = stryMutAct_9fa48("5997") ? {} : (stryCov_9fa48("5997"), {
  analysisBaseMin: 30,
  analysisLinesPerMin: 20,
  analysisCapMin: 90,
  perTestCaseMin: 12,
  perMutantKilledMin: 10,
  verifyBaseMin: 15,
  perRoundMin: 5
});
function estimate({
  sourceLines = 0,
  testCases = 0,
  addedTestLines = 0,
  mutantsKilled = 0,
  rounds = 1
}) {
  if (stryMutAct_9fa48("5998")) {
    {}
  } else {
    stryCov_9fa48("5998");
    const analysisMin = stryMutAct_9fa48("5999") ? Math.max(RATES.analysisCapMin, RATES.analysisBaseMin + sourceLines / RATES.analysisLinesPerMin) : (stryCov_9fa48("5999"), Math.min(RATES.analysisCapMin, stryMutAct_9fa48("6000") ? RATES.analysisBaseMin - sourceLines / RATES.analysisLinesPerMin : (stryCov_9fa48("6000"), RATES.analysisBaseMin + (stryMutAct_9fa48("6001") ? sourceLines * RATES.analysisLinesPerMin : (stryCov_9fa48("6001"), sourceLines / RATES.analysisLinesPerMin)))));
    const testsMin = stryMutAct_9fa48("6002") ? testCases / RATES.perTestCaseMin : (stryCov_9fa48("6002"), testCases * RATES.perTestCaseMin);
    const mutationMin = stryMutAct_9fa48("6003") ? mutantsKilled / RATES.perMutantKilledMin : (stryCov_9fa48("6003"), mutantsKilled * RATES.perMutantKilledMin);
    const verifyMin = stryMutAct_9fa48("6004") ? RATES.verifyBaseMin - Math.max(1, rounds) * RATES.perRoundMin : (stryCov_9fa48("6004"), RATES.verifyBaseMin + (stryMutAct_9fa48("6005") ? Math.max(1, rounds) / RATES.perRoundMin : (stryCov_9fa48("6005"), (stryMutAct_9fa48("6006") ? Math.min(1, rounds) : (stryCov_9fa48("6006"), Math.max(1, rounds))) * RATES.perRoundMin)));
    const totalMin = Math.round(stryMutAct_9fa48("6007") ? analysisMin + testsMin + mutationMin - verifyMin : (stryCov_9fa48("6007"), (stryMutAct_9fa48("6008") ? analysisMin + testsMin - mutationMin : (stryCov_9fa48("6008"), (stryMutAct_9fa48("6009") ? analysisMin - testsMin : (stryCov_9fa48("6009"), analysisMin + testsMin)) + mutationMin)) + verifyMin));
    return stryMutAct_9fa48("6010") ? {} : (stryCov_9fa48("6010"), {
      analysisMin: Math.round(analysisMin),
      testsMin,
      mutationMin,
      verifyMin,
      totalMin,
      hours: round2(stryMutAct_9fa48("6011") ? totalMin * 60 : (stryCov_9fa48("6011"), totalMin / 60)),
      inputs: stryMutAct_9fa48("6012") ? {} : (stryCov_9fa48("6012"), {
        sourceLines,
        testCases,
        addedTestLines,
        mutantsKilled,
        rounds
      })
    });
  }
}

/** Count committed test cases / added lines from a unified diff. */
function diffStats(diff) {
  if (stryMutAct_9fa48("6013")) {
    {}
  } else {
    stryCov_9fa48("6013");
    const testCases = (stryMutAct_9fa48("6016") ? diff.match(/^\+[^+].*\b(?:it|test)\s*\(/gm) && [] : stryMutAct_9fa48("6015") ? false : stryMutAct_9fa48("6014") ? true : (stryCov_9fa48("6014", "6015", "6016"), diff.match(stryMutAct_9fa48("6021") ? /^\+[^+].*\b(?:it|test)\S*\(/gm : stryMutAct_9fa48("6020") ? /^\+[^+].*\b(?:it|test)\s\(/gm : stryMutAct_9fa48("6019") ? /^\+[^+].\b(?:it|test)\s*\(/gm : stryMutAct_9fa48("6018") ? /^\+[+].*\b(?:it|test)\s*\(/gm : stryMutAct_9fa48("6017") ? /\+[^+].*\b(?:it|test)\s*\(/gm : (stryCov_9fa48("6017", "6018", "6019", "6020", "6021"), /^\+[^+].*\b(?:it|test)\s*\(/gm)) || (stryMutAct_9fa48("6022") ? ["Stryker was here"] : (stryCov_9fa48("6022"), [])))).length;
    const addedTestLines = (stryMutAct_9fa48("6025") ? diff.match(/^\+[^+]/gm) && [] : stryMutAct_9fa48("6024") ? false : stryMutAct_9fa48("6023") ? true : (stryCov_9fa48("6023", "6024", "6025"), diff.match(stryMutAct_9fa48("6027") ? /^\+[+]/gm : stryMutAct_9fa48("6026") ? /\+[^+]/gm : (stryCov_9fa48("6026", "6027"), /^\+[^+]/gm)) || (stryMutAct_9fa48("6028") ? ["Stryker was here"] : (stryCov_9fa48("6028"), [])))).length;
    return stryMutAct_9fa48("6029") ? {} : (stryCov_9fa48("6029"), {
      testCases,
      addedTestLines
    });
  }
}
module.exports = stryMutAct_9fa48("6030") ? {} : (stryCov_9fa48("6030"), {
  estimate,
  diffStats,
  RATES
});