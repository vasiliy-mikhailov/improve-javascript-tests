// @ts-nocheck
// Code node "Kill: Parse Test".
//
// Exactly one file survives parsing — the mutant loop verifies a single kill per
// round, so a second file could never be attributed to anything.
//
// The path check asks two questions, not one. "Does it look like a test file?" is not
// enough: the repo's OWN test file looks exactly like one, and the prompt shows it to
// the model as a style reference, so a model that echoes it back would have its content
// written over real tests — and drop() would delete them when the attempt failed.
//
// @param resp  response of the "Kill: LLM" node
// @param plan  output of "Kill: Build Prompt" (targetPath)
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
export function killParseTest(resp, plan) {
  if (stryMutAct_9fa48("627")) {
    {}
  } else {
    stryCov_9fa48("627");
    let tests = (stryMutAct_9fa48("630") ? resp.ok && resp.json || Array.isArray(resp.json.tests) : stryMutAct_9fa48("629") ? false : stryMutAct_9fa48("628") ? true : (stryCov_9fa48("628", "629", "630"), (stryMutAct_9fa48("632") ? resp.ok || resp.json : stryMutAct_9fa48("631") ? true : (stryCov_9fa48("631", "632"), resp.ok && resp.json)) && Array.isArray(resp.json.tests))) ? resp.json.tests : stryMutAct_9fa48("633") ? ["Stryker was here"] : (stryCov_9fa48("633"), []);
    tests = stryMutAct_9fa48("635") ? tests.slice(0, 1) // one target, one test file
    // The path is OURS, always. It is derived from the repo's own convention and the
    // mutant's full identity (mutator, line, column, a hash of the replacement), and
    // the model knows nothing about placement that we do not. Honouring a proposed
    // path let a live run write `…kill-L82-booleanliteral.test.ts` among nine siblings
    // that all carried the identity hash — walking straight back into the collision
    // the naming exists to prevent, where two mutants on one line overwrite each
    // other's verified kill. The repo-owned guard does not cover this: it protects
    // tests that existed before the run, not the ones this run just wrote.
    .map(t => ({
      path: plan.targetPath,
      content: t.content
    })) : stryMutAct_9fa48("634") ? tests.filter(t => t && typeof t.content === 'string' && t.content.trim().length > 10)
    // one target, one test file
    // The path is OURS, always. It is derived from the repo's own convention and the
    // mutant's full identity (mutator, line, column, a hash of the replacement), and
    // the model knows nothing about placement that we do not. Honouring a proposed
    // path let a live run write `…kill-L82-booleanliteral.test.ts` among nine siblings
    // that all carried the identity hash — walking straight back into the collision
    // the naming exists to prevent, where two mutants on one line overwrite each
    // other's verified kill. The repo-owned guard does not cover this: it protects
    // tests that existed before the run, not the ones this run just wrote.
    .map(t => ({
      path: plan.targetPath,
      content: t.content
    })) : (stryCov_9fa48("634", "635"), tests.filter(stryMutAct_9fa48("636") ? () => undefined : (stryCov_9fa48("636"), t => stryMutAct_9fa48("639") ? t && typeof t.content === 'string' || t.content.trim().length > 10 : stryMutAct_9fa48("638") ? false : stryMutAct_9fa48("637") ? true : (stryCov_9fa48("637", "638", "639"), (stryMutAct_9fa48("641") ? t || typeof t.content === 'string' : stryMutAct_9fa48("640") ? true : (stryCov_9fa48("640", "641"), t && (stryMutAct_9fa48("643") ? typeof t.content !== 'string' : stryMutAct_9fa48("642") ? true : (stryCov_9fa48("642", "643"), typeof t.content === (stryMutAct_9fa48("644") ? "" : (stryCov_9fa48("644"), 'string')))))) && (stryMutAct_9fa48("647") ? t.content.trim().length <= 10 : stryMutAct_9fa48("646") ? t.content.trim().length >= 10 : stryMutAct_9fa48("645") ? true : (stryCov_9fa48("645", "646", "647"), (stryMutAct_9fa48("648") ? t.content.length : (stryCov_9fa48("648"), t.content.trim().length)) > 10))))).slice(0, 1) // one target, one test file
    // The path is OURS, always. It is derived from the repo's own convention and the
    // mutant's full identity (mutator, line, column, a hash of the replacement), and
    // the model knows nothing about placement that we do not. Honouring a proposed
    // path let a live run write `…kill-L82-booleanliteral.test.ts` among nine siblings
    // that all carried the identity hash — walking straight back into the collision
    // the naming exists to prevent, where two mutants on one line overwrite each
    // other's verified kill. The repo-owned guard does not cover this: it protects
    // tests that existed before the run, not the ones this run just wrote.
    .map(stryMutAct_9fa48("649") ? () => undefined : (stryCov_9fa48("649"), t => stryMutAct_9fa48("650") ? {} : (stryCov_9fa48("650"), {
      path: plan.targetPath,
      content: t.content
    }))));
    return stryMutAct_9fa48("651") ? {} : (stryCov_9fa48("651"), {
      tests,
      paths: tests.map(stryMutAct_9fa48("652") ? () => undefined : (stryCov_9fa48("652"), t => t.path)),
      count: tests.length
    });
  }
}