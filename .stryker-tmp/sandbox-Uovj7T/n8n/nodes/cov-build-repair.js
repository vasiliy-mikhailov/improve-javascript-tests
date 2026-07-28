// @ts-nocheck
// Code node "Cov: Build Repair".
//
// Second chance for tests that were written, ran, and failed. We hand the model its
// own files back together with the runner output and the source, because the usual
// cause is a wrong expected value rather than a wrong idea.
//
// @param fail    response of the "Cov: Run Tests" node (failing summary)
// @param parsed  output of "Cov: Parse Tests" (the files we actually wrote)
// @param gaps    response of the "Coverage Gaps" node (source for reference)
// @param stage   the run stage to report while repairing
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
export function covBuildRepair(fail, parsed, gaps, stage) {
  if (stryMutAct_9fa48("213")) {
    {}
  } else {
    stryCov_9fa48("213");
    const filesTxt = parsed.tests.map(stryMutAct_9fa48("214") ? () => undefined : (stryCov_9fa48("214"), t => (stryMutAct_9fa48("215") ? "" : (stryCov_9fa48("215"), 'PATH: ')) + t.path + (stryMutAct_9fa48("216") ? "" : (stryCov_9fa48("216"), '\n')) + (stryMutAct_9fa48("217") ? t.content : (stryCov_9fa48("217"), t.content.slice(0, 6000))))).join(stryMutAct_9fa48("218") ? "" : (stryCov_9fa48("218"), '\n\n---\n\n'));
    // Ask only for what the sub-graph can act on. "Cov: Write Repair" writes what came
    // back and nothing else, so an omitted file is NOT deleted — it keeps its failing
    // content, "Cov: Re-run Tests" stays red, and "Cov: Delete Broken Tests" then throws
    // away the files that WERE repaired along with it. Every path must come back; an
    // assertion that cannot be saved is dropped as a test CASE inside a returned file.
    const system = stryMutAct_9fa48("219") ? "" : (stryCov_9fa48("219"), 'You are an expert test engineer. Tests you previously wrote FAIL against the current implementation. Fix them. Keep the SAME file paths. Reply ONLY with JSON: {"tests":[{"path":"...","content":"full corrected file content"}]}. Return EVERY file you were given, one entry per path, no renames and no new files. Omitting a file does not delete it: the failing version stays on disk, the whole run stays red, and every file you did repair is thrown away with it. If a test asserts wrong expected values, correct the expectations to match the real behavior of the source. If one test case cannot be fixed, delete that case and return the rest of the file; if a whole file is beyond saving, return it holding one small test that really passes against the source — never an empty file and never a skipped or placeholder test, because a file with no runnable test fails the run too.');
    const n = parsed.tests.length;
    const prompt = (stryMutAct_9fa48("220") ? 'TEST RUNNER OUTPUT (failures):\n' + String(fail.summary || '').slice(0, 3500) + '\n\nYOUR TEST FILES:\n' + filesTxt + '\n\nSOURCE FILE ' + gaps.path + ' (for reference):\n' + String(gaps.source || '').slice(0, 10000) + '\n\nReply with corrected JSON now: all ' + n - (n === 1 ? ' file' : ' files') : (stryCov_9fa48("220"), (stryMutAct_9fa48("221") ? "" : (stryCov_9fa48("221"), 'TEST RUNNER OUTPUT (failures):\n')) + (stryMutAct_9fa48("222") ? String(fail.summary || '') : (stryCov_9fa48("222"), String(stryMutAct_9fa48("225") ? fail.summary && '' : stryMutAct_9fa48("224") ? false : stryMutAct_9fa48("223") ? true : (stryCov_9fa48("223", "224", "225"), fail.summary || (stryMutAct_9fa48("226") ? "Stryker was here!" : (stryCov_9fa48("226"), '')))).slice(0, 3500))) + (stryMutAct_9fa48("227") ? "" : (stryCov_9fa48("227"), '\n\nYOUR TEST FILES:\n')) + filesTxt + (stryMutAct_9fa48("228") ? "" : (stryCov_9fa48("228"), '\n\nSOURCE FILE ')) + gaps.path + (stryMutAct_9fa48("229") ? "" : (stryCov_9fa48("229"), ' (for reference):\n')) + (stryMutAct_9fa48("230") ? String(gaps.source || '') : (stryCov_9fa48("230"), String(stryMutAct_9fa48("233") ? gaps.source && '' : stryMutAct_9fa48("232") ? false : stryMutAct_9fa48("231") ? true : (stryCov_9fa48("231", "232", "233"), gaps.source || (stryMutAct_9fa48("234") ? "Stryker was here!" : (stryCov_9fa48("234"), '')))).slice(0, 10000))) + (stryMutAct_9fa48("235") ? "" : (stryCov_9fa48("235"), '\n\nReply with corrected JSON now: all ')) + n + ((stryMutAct_9fa48("238") ? n !== 1 : stryMutAct_9fa48("237") ? false : stryMutAct_9fa48("236") ? true : (stryCov_9fa48("236", "237", "238"), n === 1)) ? stryMutAct_9fa48("239") ? "" : (stryCov_9fa48("239"), ' file') : stryMutAct_9fa48("240") ? "" : (stryCov_9fa48("240"), ' files')))) + (stryMutAct_9fa48("241") ? "" : (stryCov_9fa48("241"), ', on these exact paths: ')) + parsed.tests.map(stryMutAct_9fa48("242") ? () => undefined : (stryCov_9fa48("242"), t => t.path)).join(stryMutAct_9fa48("243") ? "" : (stryCov_9fa48("243"), ', '));
    return stryMutAct_9fa48("244") ? {} : (stryCov_9fa48("244"), {
      system,
      prompt,
      json: stryMutAct_9fa48("245") ? false : (stryCov_9fa48("245"), true),
      maxTokens: 6000,
      temperature: 0.2,
      stage,
      stageDetail: stryMutAct_9fa48("246") ? "" : (stryCov_9fa48("246"), 'repairing failing generated tests')
    });
  }
}