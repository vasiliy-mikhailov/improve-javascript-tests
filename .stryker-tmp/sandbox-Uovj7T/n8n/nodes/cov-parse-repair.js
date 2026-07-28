// @ts-nocheck
// Code node "Cov: Parse Repair".
//
// A repair may only rewrite files we already wrote — it may not introduce new paths,
// so an unrecognised path is snapped back to one we have not repaired yet. Snapping
// to the same INDEX was wrong: a model that answers in a different order, or renames
// one file, lands two entries on one path — the second overwrites the first, and the
// file that was actually broken is reported as repaired without being touched.
//
// @param resp  response of the "Cov: LLM Repair" node
// @param prev  output of "Cov: Parse Tests" (the paths that are allowed)
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
export function covParseRepair(resp, prev) {
  if (stryMutAct_9fa48("247")) {
    {}
  } else {
    stryCov_9fa48("247");
    let tests = (stryMutAct_9fa48("250") ? resp.ok && resp.json || Array.isArray(resp.json.tests) : stryMutAct_9fa48("249") ? false : stryMutAct_9fa48("248") ? true : (stryCov_9fa48("248", "249", "250"), (stryMutAct_9fa48("252") ? resp.ok || resp.json : stryMutAct_9fa48("251") ? true : (stryCov_9fa48("251", "252"), resp.ok && resp.json)) && Array.isArray(resp.json.tests))) ? resp.json.tests : stryMutAct_9fa48("253") ? ["Stryker was here"] : (stryCov_9fa48("253"), []);
    tests = stryMutAct_9fa48("255") ? tests.slice(0, prev.paths.length).map(t => ({
      path: prev.paths.includes(t.path) ? t.path : null,
      content: t.content
    })) : stryMutAct_9fa48("254") ? tests.filter(t => t && typeof t.content === 'string' && t.content.trim().length > 10).map(t => ({
      path: prev.paths.includes(t.path) ? t.path : null,
      content: t.content
    })) : (stryCov_9fa48("254", "255"), tests.filter(stryMutAct_9fa48("256") ? () => undefined : (stryCov_9fa48("256"), t => stryMutAct_9fa48("259") ? t && typeof t.content === 'string' || t.content.trim().length > 10 : stryMutAct_9fa48("258") ? false : stryMutAct_9fa48("257") ? true : (stryCov_9fa48("257", "258", "259"), (stryMutAct_9fa48("261") ? t || typeof t.content === 'string' : stryMutAct_9fa48("260") ? true : (stryCov_9fa48("260", "261"), t && (stryMutAct_9fa48("263") ? typeof t.content !== 'string' : stryMutAct_9fa48("262") ? true : (stryCov_9fa48("262", "263"), typeof t.content === (stryMutAct_9fa48("264") ? "" : (stryCov_9fa48("264"), 'string')))))) && (stryMutAct_9fa48("267") ? t.content.trim().length <= 10 : stryMutAct_9fa48("266") ? t.content.trim().length >= 10 : stryMutAct_9fa48("265") ? true : (stryCov_9fa48("265", "266", "267"), (stryMutAct_9fa48("268") ? t.content.length : (stryCov_9fa48("268"), t.content.trim().length)) > 10))))).slice(0, prev.paths.length).map(stryMutAct_9fa48("269") ? () => undefined : (stryCov_9fa48("269"), t => stryMutAct_9fa48("270") ? {} : (stryCov_9fa48("270"), {
      path: prev.paths.includes(t.path) ? t.path : null,
      content: t.content
    }))));
    // fill the unrecognised paths from whatever is still unclaimed, in order
    const free = stryMutAct_9fa48("271") ? prev.paths : (stryCov_9fa48("271"), prev.paths.filter(stryMutAct_9fa48("272") ? () => undefined : (stryCov_9fa48("272"), p => stryMutAct_9fa48("273") ? tests.some(t => t.path === p) : (stryCov_9fa48("273"), !(stryMutAct_9fa48("274") ? tests.every(t => t.path === p) : (stryCov_9fa48("274"), tests.some(stryMutAct_9fa48("275") ? () => undefined : (stryCov_9fa48("275"), t => stryMutAct_9fa48("278") ? t.path !== p : stryMutAct_9fa48("277") ? false : stryMutAct_9fa48("276") ? true : (stryCov_9fa48("276", "277", "278"), t.path === p)))))))));
    tests = stryMutAct_9fa48("279") ? tests.map(t => t.path ? t : {
      ...t,
      path: free.shift() || null
    }) : (stryCov_9fa48("279"), tests.map(stryMutAct_9fa48("280") ? () => undefined : (stryCov_9fa48("280"), t => t.path ? t : stryMutAct_9fa48("281") ? {} : (stryCov_9fa48("281"), {
      ...t,
      path: stryMutAct_9fa48("284") ? free.shift() && null : stryMutAct_9fa48("283") ? false : stryMutAct_9fa48("282") ? true : (stryCov_9fa48("282", "283", "284"), free.shift() || null)
    }))).filter(stryMutAct_9fa48("285") ? () => undefined : (stryCov_9fa48("285"), t => t.path)));
    return stryMutAct_9fa48("286") ? {} : (stryCov_9fa48("286"), {
      tests,
      paths: tests.map(stryMutAct_9fa48("287") ? () => undefined : (stryCov_9fa48("287"), t => t.path)),
      count: tests.length
    });
  }
}