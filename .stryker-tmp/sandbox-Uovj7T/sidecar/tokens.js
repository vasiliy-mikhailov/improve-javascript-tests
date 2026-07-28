// @ts-nocheck
'use strict';

// LLM token accounting. OpenAI-compatible endpoints report usage per response;
// vLLM does too. Kept pure and separate so it can be unit-tested and so the
// accumulator shape is defined in exactly one place.
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
const EMPTY = stryMutAct_9fa48("6031") ? {} : (stryCov_9fa48("6031"), {
  in: 0,
  out: 0,
  calls: 0
});

/** Normalize a provider `usage` object; tolerant of missing/renamed fields. */
function parseUsage(u) {
  if (stryMutAct_9fa48("6032")) {
    {}
  } else {
    stryCov_9fa48("6032");
    if (stryMutAct_9fa48("6035") ? !u && typeof u !== 'object' : stryMutAct_9fa48("6034") ? false : stryMutAct_9fa48("6033") ? true : (stryCov_9fa48("6033", "6034", "6035"), (stryMutAct_9fa48("6036") ? u : (stryCov_9fa48("6036"), !u)) || (stryMutAct_9fa48("6038") ? typeof u === 'object' : stryMutAct_9fa48("6037") ? false : (stryCov_9fa48("6037", "6038"), typeof u !== (stryMutAct_9fa48("6039") ? "" : (stryCov_9fa48("6039"), 'object')))))) return stryMutAct_9fa48("6040") ? {} : (stryCov_9fa48("6040"), {
      in: 0,
      out: 0
    });
    const input = stryMutAct_9fa48("6041") ? (u.prompt_tokens ?? u.input_tokens) && 0 : (stryCov_9fa48("6041"), (stryMutAct_9fa48("6042") ? u.prompt_tokens && u.input_tokens : (stryCov_9fa48("6042"), u.prompt_tokens ?? u.input_tokens)) ?? 0);
    const output = stryMutAct_9fa48("6043") ? (u.completion_tokens ?? u.output_tokens) && 0 : (stryCov_9fa48("6043"), (stryMutAct_9fa48("6044") ? u.completion_tokens && u.output_tokens : (stryCov_9fa48("6044"), u.completion_tokens ?? u.output_tokens)) ?? 0);
    const num = stryMutAct_9fa48("6045") ? () => undefined : (stryCov_9fa48("6045"), (() => {
      const num = x => (stryMutAct_9fa48("6048") ? typeof x === 'number' && Number.isFinite(x) || x > 0 : stryMutAct_9fa48("6047") ? false : stryMutAct_9fa48("6046") ? true : (stryCov_9fa48("6046", "6047", "6048"), (stryMutAct_9fa48("6050") ? typeof x === 'number' || Number.isFinite(x) : stryMutAct_9fa48("6049") ? true : (stryCov_9fa48("6049", "6050"), (stryMutAct_9fa48("6052") ? typeof x !== 'number' : stryMutAct_9fa48("6051") ? true : (stryCov_9fa48("6051", "6052"), typeof x === (stryMutAct_9fa48("6053") ? "" : (stryCov_9fa48("6053"), 'number')))) && Number.isFinite(x))) && (stryMutAct_9fa48("6056") ? x <= 0 : stryMutAct_9fa48("6055") ? x >= 0 : stryMutAct_9fa48("6054") ? true : (stryCov_9fa48("6054", "6055", "6056"), x > 0)))) ? Math.round(x) : 0;
      return num;
    })());
    return stryMutAct_9fa48("6057") ? {} : (stryCov_9fa48("6057"), {
      in: num(input),
      out: num(output)
    });
  }
}

/** Fold one response's usage into an accumulator (returns a new object). */
function addUsage(acc, usage) {
  if (stryMutAct_9fa48("6058")) {
    {}
  } else {
    stryCov_9fa48("6058");
    const base = (stryMutAct_9fa48("6061") ? acc || typeof acc === 'object' : stryMutAct_9fa48("6060") ? false : stryMutAct_9fa48("6059") ? true : (stryCov_9fa48("6059", "6060", "6061"), acc && (stryMutAct_9fa48("6063") ? typeof acc !== 'object' : stryMutAct_9fa48("6062") ? true : (stryCov_9fa48("6062", "6063"), typeof acc === (stryMutAct_9fa48("6064") ? "" : (stryCov_9fa48("6064"), 'object')))))) ? acc : EMPTY;
    const {
      in: i,
      out: o
    } = parseUsage(usage);
    return stryMutAct_9fa48("6065") ? {} : (stryCov_9fa48("6065"), {
      in: stryMutAct_9fa48("6066") ? (base.in || 0) - i : (stryCov_9fa48("6066"), (stryMutAct_9fa48("6069") ? base.in && 0 : stryMutAct_9fa48("6068") ? false : stryMutAct_9fa48("6067") ? true : (stryCov_9fa48("6067", "6068", "6069"), base.in || 0)) + i),
      out: stryMutAct_9fa48("6070") ? (base.out || 0) - o : (stryCov_9fa48("6070"), (stryMutAct_9fa48("6073") ? base.out && 0 : stryMutAct_9fa48("6072") ? false : stryMutAct_9fa48("6071") ? true : (stryCov_9fa48("6071", "6072", "6073"), base.out || 0)) + o),
      // a call with no usage payload still happened, and still cost latency
      calls: stryMutAct_9fa48("6074") ? (base.calls || 0) - 1 : (stryCov_9fa48("6074"), (stryMutAct_9fa48("6077") ? base.calls && 0 : stryMutAct_9fa48("6076") ? false : stryMutAct_9fa48("6075") ? true : (stryCov_9fa48("6075", "6076", "6077"), base.calls || 0)) + 1)
    });
  }
}

/** Compact human formatting: 1234 → "1.2k", 2_500_000 → "2.5M". */
function fmtTokens(n) {
  if (stryMutAct_9fa48("6078")) {
    {}
  } else {
    stryCov_9fa48("6078");
    const v = stryMutAct_9fa48("6081") ? Number(n) && 0 : stryMutAct_9fa48("6080") ? false : stryMutAct_9fa48("6079") ? true : (stryCov_9fa48("6079", "6080", "6081"), Number(n) || 0);
    if (stryMutAct_9fa48("6085") ? v < 1e6 : stryMutAct_9fa48("6084") ? v > 1e6 : stryMutAct_9fa48("6083") ? false : stryMutAct_9fa48("6082") ? true : (stryCov_9fa48("6082", "6083", "6084", "6085"), v >= 1e6)) return (stryMutAct_9fa48("6086") ? Math.round(v / 1e5) * 10 : (stryCov_9fa48("6086"), Math.round(stryMutAct_9fa48("6087") ? v * 1e5 : (stryCov_9fa48("6087"), v / 1e5)) / 10)) + (stryMutAct_9fa48("6088") ? "" : (stryCov_9fa48("6088"), 'M'));
    if (stryMutAct_9fa48("6092") ? v < 1e3 : stryMutAct_9fa48("6091") ? v > 1e3 : stryMutAct_9fa48("6090") ? false : stryMutAct_9fa48("6089") ? true : (stryCov_9fa48("6089", "6090", "6091", "6092"), v >= 1e3)) return (stryMutAct_9fa48("6093") ? Math.round(v / 1e2) * 10 : (stryCov_9fa48("6093"), Math.round(stryMutAct_9fa48("6094") ? v * 1e2 : (stryCov_9fa48("6094"), v / 1e2)) / 10)) + (stryMutAct_9fa48("6095") ? "" : (stryCov_9fa48("6095"), 'k'));
    return String(v);
  }
}
module.exports = stryMutAct_9fa48("6096") ? {} : (stryCov_9fa48("6096"), {
  parseUsage,
  addUsage,
  fmtTokens,
  EMPTY
});