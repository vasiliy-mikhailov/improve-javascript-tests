// @ts-nocheck
// The rules every generated test must obey, regardless of which phase asked for it.
// A function rather than a constant because `emit` inlines deps by SOURCE, and a
// function declaration is the only form that survives Function.prototype.toString().
//
// The leading newline is deliberate: callers concatenate this straight after the
// word "Rules:" in their system prompt.
//
// maxFiles is a parameter because the phases genuinely differ: the coverage bootstrap
// may write two files, the mutant loop keeps exactly one (killParseTest slices to 1).
// A shared constant saying "at most 2" contradicted the kill prompt's "EXACTLY ONE",
// so the model paid for a second file that was then thrown away.
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
export function commonTestRules(maxFiles = 2) {
  if (stryMutAct_9fa48("19")) {
    {}
  } else {
    stryCov_9fa48("19");
    return (stryMutAct_9fa48("20") ? "" : (stryCov_9fa48("20"), '\n- Tests must be deterministic (no timing races, no network, no randomness without seeding).')) + (stryMutAct_9fa48("21") ? "" : (stryCov_9fa48("21"), '\n- Code must satisfy strict linters: no `any` types, no unused imports or variables, no non-null assertions.')) + (stryMutAct_9fa48("22") ? "" : (stryCov_9fa48("22"), '\n- Import the module under test via its public path exactly as existing tests do.')) + (stryMutAct_9fa48("23") ? "" : (stryCov_9fa48("23"), '\n- Never inspect function source code (no fn.toString() introspection).')) + (stryMutAct_9fa48("24") ? "" : (stryCov_9fa48("24"), '\n- No snapshot tests. Prefer precise value assertions.'))
    // Measured on what this pipeline shipped: in the one Prisma-backed file among five
    // PRs, 11 of 28 tests asserted ONLY on toHaveBeenCalledWith/mock.calls and never
    // looked at what the function returned — and every table was mocked to [], which is
    // what made the output meaningless in the first place. On a clean fixture the model
    // does the right thing unprompted (3/3), so this ranks a preference rather than
    // fixing a defect: assert on the code, fall back to the collaborator only when the
    // mutation is genuinely invisible in the output.
    + (stryMutAct_9fa48("25") ? "" : (stryCov_9fa48("25"), '\n- Assert on what the module DOES: its return value, what it throws, what it renders.')) + (stryMutAct_9fa48("26") ? "" : (stryCov_9fa48("26"), '\n- Assert on how a collaborator was CALLED (toHaveBeenCalledWith, mock.calls) only when the')) + (stryMutAct_9fa48("27") ? "" : (stryCov_9fa48("27"), ' mutation cannot be observed in the output at all. A test that only checks a mock was called')) + (stryMutAct_9fa48("28") ? "" : (stryCov_9fa48("28"), ' passes mutation testing while proving nothing about behaviour.')) + (stryMutAct_9fa48("29") ? "" : (stryCov_9fa48("29"), '\n- When you must mock, return REALISTIC data. Mocking a source to [] or {} switches off the')) + (stryMutAct_9fa48("30") ? "" : (stryCov_9fa48("30"), ' logic under test, and then the query is the only thing left to assert on.')) + (stryMutAct_9fa48("31") ? "" : (stryCov_9fa48("31"), '\n- The tests MUST pass against the CURRENT implementation of the source file.')) + ((stryMutAct_9fa48("34") ? maxFiles !== 1 : stryMutAct_9fa48("33") ? false : stryMutAct_9fa48("32") ? true : (stryCov_9fa48("32", "33", "34"), maxFiles === 1)) ? stryMutAct_9fa48("35") ? "" : (stryCov_9fa48("35"), '\n- Output EXACTLY ONE test file.') : (stryMutAct_9fa48("36") ? "" : (stryCov_9fa48("36"), '\n- Output at most ')) + maxFiles + (stryMutAct_9fa48("37") ? "" : (stryCov_9fa48("37"), ' test files.')));
  }
}