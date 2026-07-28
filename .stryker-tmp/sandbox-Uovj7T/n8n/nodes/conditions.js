// @ts-nocheck
// The 11 IF conditions, keyed by node name.
//
// An n8n IF node evaluates its own expression — it cannot call our code — so unlike
// the Code nodes these stay as expression STRINGS. They live here anyway so that the
// generator and the unit tests read the same characters: a test can evaluate the
// expression against a synthetic $json without anyone re-typing it, and a condition
// can never drift between the two.
//
// The expression alone is not the whole decision, so the comparison that turns the
// number into a branch lives here too — see COMPARISONS.
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
export const CONDITIONS = stryMutAct_9fa48("38") ? {} : (stryCov_9fa48("38"), {
  // the sidecar decides when the run is out of files or out of budget
  'More Work?': stryMutAct_9fa48("39") ? "" : (stryCov_9fa48("39"), '={{ $json.done ? 0 : 1 }}'),
  'File Picked?': stryMutAct_9fa48("40") ? "" : (stryCov_9fa48("40"), '={{ $json.result && $json.result.file ? 1 : 0 }}'),
  // pick failed: transient (bad LLM output) → try again; terminal (rule excludes
  // every candidate) → finish. The sidecar caps consecutive transient retries.
  'Pick Retryable?': stryMutAct_9fa48("41") ? "" : (stryCov_9fa48("41"), '={{ ($json.result && $json.result.retry) ? 1 : 0 }}'),
  // A crashed baseline measurement means there is nothing to improve AGAINST: with no
  // survivor list and no score, every later phase would spend model time producing
  // work that cannot be evaluated — and the sidecar has already un-picked the file,
  // so the tokens would be attributed to nobody.
  'Baseline OK?': stryMutAct_9fa48("42") ? "" : (stryCov_9fa48("42"), '={{ $json.failed ? 0 : 1 }}'),
  'Cov: Has Work?': stryMutAct_9fa48("43") ? "" : (stryCov_9fa48("43"), '={{ $json.skip ? 0 : 1 }}'),
  'Cov: Green?': stryMutAct_9fa48("44") ? "" : (stryCov_9fa48("44"), '={{ $json.passed ? 1 : 0 }}'),
  // nothing was written, so there is nothing to repair — skip straight to Done
  'Cov: Wrote Any?': stryMutAct_9fa48("45") ? "" : (stryCov_9fa48("45"), "={{ $('Cov: Parse Tests').first().json.count }}"),
  'Cov: Green After Repair?': stryMutAct_9fa48("46") ? "" : (stryCov_9fa48("46"), '={{ $json.passed ? 1 : 0 }}'),
  'Mutant To Kill?': stryMutAct_9fa48("47") ? "" : (stryCov_9fa48("47"), '={{ $json.mutant ? 1 : 0 }}'),
  // multi-round: keep going iff ≥1 of coverage/mutation/MAC improved AND none degraded.
  // The cap uses `??`, not `||`: a team configuring MAX_ROUNDS_PER_FILE=0 ("one pass per
  // file, no extra rounds") means it, and `|| 5` would hand them five rounds instead.
  // `($json.rounds || 0)` keeps its `||` — 0 is that field's intended default anyway.
  // Keep going only if another round can DO something. improvedAny/degradedAny say the
  // last round went well; anotherRoundWorthIt says a site is still untried, which is
  // what makes the rest reachable — one shot per mutant means a second round otherwise
  // finds nothing to attempt and merely re-measures a settled file. Measured: round 1
  // gained +70 MAC on average, round 2 gained +0.00 five times out of five, at up to 25
  // minutes each.
  // Two questions, not one. "Did this round earn its place?" decides commit-or-discard;
  // "is another round worth paying for?" decides loop-or-settle. They coincided while
  // the only reason to stop was a stale round, and the day the second one started
  // saying "improved, but nothing left to do", a single gate read it as stale and
  // discarded a file taken to MAC 100.
  'Round Kept?': stryMutAct_9fa48("48") ? "" : (stryCov_9fa48("48"), "={{ ($('Verify').first().json.improvedAny && !$('Verify').first().json.degradedAny) ? 1 : 0 }}"),
  // the rules engine approving is not enough — the round must also have improved something
  'Approved?': stryMutAct_9fa48("49") ? "" : (stryCov_9fa48("49"), "={{ ($json.result && $json.result.approved && $('Drop Last Round').first().json.improved) ? 1 : 0 }}")
});

// How each expression's value is compared to decide the true branch. Every condition
// is a 0/1 flag compared against 1, except "Cov: Wrote Any?" which counts files.
export const COMPARISONS = stryMutAct_9fa48("50") ? {} : (stryCov_9fa48("50"), {
  'More Work?': stryMutAct_9fa48("51") ? {} : (stryCov_9fa48("51"), {
    operation: stryMutAct_9fa48("52") ? "" : (stryCov_9fa48("52"), 'equal'),
    value2: 1
  }),
  'File Picked?': stryMutAct_9fa48("53") ? {} : (stryCov_9fa48("53"), {
    operation: stryMutAct_9fa48("54") ? "" : (stryCov_9fa48("54"), 'equal'),
    value2: 1
  }),
  'Pick Retryable?': stryMutAct_9fa48("55") ? {} : (stryCov_9fa48("55"), {
    operation: stryMutAct_9fa48("56") ? "" : (stryCov_9fa48("56"), 'equal'),
    value2: 1
  }),
  'Baseline OK?': stryMutAct_9fa48("57") ? {} : (stryCov_9fa48("57"), {
    operation: stryMutAct_9fa48("58") ? "" : (stryCov_9fa48("58"), 'equal'),
    value2: 1
  }),
  'Cov: Has Work?': stryMutAct_9fa48("59") ? {} : (stryCov_9fa48("59"), {
    operation: stryMutAct_9fa48("60") ? "" : (stryCov_9fa48("60"), 'equal'),
    value2: 1
  }),
  'Cov: Green?': stryMutAct_9fa48("61") ? {} : (stryCov_9fa48("61"), {
    operation: stryMutAct_9fa48("62") ? "" : (stryCov_9fa48("62"), 'equal'),
    value2: 1
  }),
  'Cov: Wrote Any?': stryMutAct_9fa48("63") ? {} : (stryCov_9fa48("63"), {
    operation: stryMutAct_9fa48("64") ? "" : (stryCov_9fa48("64"), 'larger'),
    value2: 0
  }),
  'Cov: Green After Repair?': stryMutAct_9fa48("65") ? {} : (stryCov_9fa48("65"), {
    operation: stryMutAct_9fa48("66") ? "" : (stryCov_9fa48("66"), 'equal'),
    value2: 1
  }),
  'Mutant To Kill?': stryMutAct_9fa48("67") ? {} : (stryCov_9fa48("67"), {
    operation: stryMutAct_9fa48("68") ? "" : (stryCov_9fa48("68"), 'equal'),
    value2: 1
  }),
  'Round Kept?': stryMutAct_9fa48("69") ? {} : (stryCov_9fa48("69"), {
    operation: stryMutAct_9fa48("70") ? "" : (stryCov_9fa48("70"), 'equal'),
    value2: 1
  }),
  'Approved?': stryMutAct_9fa48("71") ? {} : (stryCov_9fa48("71"), {
    operation: stryMutAct_9fa48("72") ? "" : (stryCov_9fa48("72"), 'equal'),
    value2: 1
  })
});

// Full descriptor for one IF node. Throws rather than emitting an `undefined`
// expression, which n8n would happily accept and then always take the false branch.
export function condition(name) {
  if (stryMutAct_9fa48("73")) {
    {}
  } else {
    stryCov_9fa48("73");
    const value1 = CONDITIONS[name];
    const cmp = COMPARISONS[name];
    if (stryMutAct_9fa48("76") ? typeof value1 === 'string' : stryMutAct_9fa48("75") ? false : stryMutAct_9fa48("74") ? true : (stryCov_9fa48("74", "75", "76"), typeof value1 !== (stryMutAct_9fa48("77") ? "" : (stryCov_9fa48("77"), 'string')))) throw new Error(stryMutAct_9fa48("78") ? `` : (stryCov_9fa48("78"), `no condition registered for IF node "${name}"`));
    if (stryMutAct_9fa48("81") ? false : stryMutAct_9fa48("80") ? true : stryMutAct_9fa48("79") ? cmp : (stryCov_9fa48("79", "80", "81"), !cmp)) throw new Error(stryMutAct_9fa48("82") ? `` : (stryCov_9fa48("82"), `no comparison registered for IF node "${name}"`));
    return stryMutAct_9fa48("83") ? {} : (stryCov_9fa48("83"), {
      value1,
      value2: cmp.value2,
      operation: cmp.operation
    });
  }
}