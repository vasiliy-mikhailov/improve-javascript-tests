// @ts-nocheck
// A node's identity is its NAME. Deriving the id from the name instead of calling
// randomUUID() makes regeneration idempotent: an unchanged workflow regenerates
// byte-for-byte, so `npm run workflow` followed by `git status` is a real drift
// detector, and re-importing hands n8n the same identity for the same node.
//
// FNV-1a over four salted passes gives 128 bits without a crypto import, which the
// generator does not need and n8n never sees — the id only has to be stable, unique
// per name and uuid-shaped.
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
function fnv1a(str) {
  if (stryMutAct_9fa48("0")) {
    {}
  } else {
    stryCov_9fa48("0");
    let h = 0x811c9dc5;
    for (let i = 0; stryMutAct_9fa48("3") ? i >= str.length : stryMutAct_9fa48("2") ? i <= str.length : stryMutAct_9fa48("1") ? false : (stryCov_9fa48("1", "2", "3"), i < str.length); stryMutAct_9fa48("4") ? i-- : (stryCov_9fa48("4"), i++)) {
      if (stryMutAct_9fa48("5")) {
        {}
      } else {
        stryCov_9fa48("5");
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
    }
    return h >>> 0;
  }
}
export function nodeId(name) {
  if (stryMutAct_9fa48("6")) {
    {}
  } else {
    stryCov_9fa48("6");
    const hex = (stryMutAct_9fa48("7") ? [] : (stryCov_9fa48("7"), [0, 1, 2, 3])).map(stryMutAct_9fa48("8") ? () => undefined : (stryCov_9fa48("8"), salt => fnv1a(stryMutAct_9fa48("9") ? `` : (stryCov_9fa48("9"), `ijst:${salt}:${name}`)).toString(16).padStart(8, stryMutAct_9fa48("10") ? "" : (stryCov_9fa48("10"), '0')))).join(stryMutAct_9fa48("11") ? "Stryker was here!" : (stryCov_9fa48("11"), ''));
    return (stryMutAct_9fa48("12") ? [] : (stryCov_9fa48("12"), [stryMutAct_9fa48("13") ? hex : (stryCov_9fa48("13"), hex.slice(0, 8)), stryMutAct_9fa48("14") ? hex : (stryCov_9fa48("14"), hex.slice(8, 12)), stryMutAct_9fa48("15") ? hex : (stryCov_9fa48("15"), hex.slice(12, 16)), stryMutAct_9fa48("16") ? hex : (stryCov_9fa48("16"), hex.slice(16, 20)), stryMutAct_9fa48("17") ? hex : (stryCov_9fa48("17"), hex.slice(20, 32))])).join(stryMutAct_9fa48("18") ? "" : (stryCov_9fa48("18"), '-'));
  }
}