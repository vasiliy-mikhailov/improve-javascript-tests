// The 13 IF conditions, keyed by node name.
//
// An n8n IF node evaluates its own expression — it cannot call our code — so unlike
// the Code nodes these stay as expression STRINGS. They live here anyway so that the
// generator and the unit tests read the same characters: a test can evaluate the
// expression against a synthetic $json without anyone re-typing it, and a condition
// can never drift between the two.
//
// The expression alone is not the whole decision, so the comparison that turns the
// number into a branch lives here too — see COMPARISONS.
export const CONDITIONS = {
  // the sidecar decides when the run is out of files or out of budget
  'More Work?': '={{ $json.done ? 0 : 1 }}',
  'File Picked?': '={{ $json.result && $json.result.file ? 1 : 0 }}',
  // pick failed: transient (bad LLM output) → try again; terminal (rule excludes
  // every candidate) → finish. The sidecar caps consecutive transient retries.
  'Pick Retryable?': '={{ ($json.result && $json.result.retry) ? 1 : 0 }}',
  // A crashed baseline measurement means there is nothing to improve AGAINST: with no
  // survivor list and no score, every later phase would spend model time producing
  // work that cannot be evaluated — and the sidecar has already un-picked the file,
  // so the tokens would be attributed to nobody.
  'Baseline OK?': '={{ $json.failed ? 0 : 1 }}',
  'Cov: Has Work?': '={{ $json.skip ? 0 : 1 }}',
  'Cov: Green?': '={{ $json.passed ? 1 : 0 }}',
  // nothing was written, so there is nothing to repair — skip straight to Done
  'Cov: Wrote Any?': "={{ $('Cov: Parse Tests').first().json.count }}",
  'Cov: Green After Repair?': '={{ $json.passed ? 1 : 0 }}',
  'Mutant To Kill?': '={{ $json.mutant ? 1 : 0 }}',
  // the BATCH killed nothing and the sidecar spent nobody's shot — the single-target
  // attempt on the best of them is still worth making
  'Kill: Batch Failed?': '={{ $json.retryable ? 1 : 0 }}',
  // the cheap attempt failed and the sidecar kept the target on the queue for us
  'Kill: Escalate?': '={{ $json.retryable ? 1 : 0 }}',
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
  'Another Round?': '={{ ($json.anotherRoundWorthIt && ($json.rounds || 0) < ($json.maxRounds ?? 5)) ? 1 : 0 }}',
  // the rules engine approving is not enough — the round must also have improved something
  'Approved?': "={{ ($json.result && $json.result.approved && $('Drop Last Round').first().json.improved) ? 1 : 0 }}",
};

// How each expression's value is compared to decide the true branch. Every condition
// is a 0/1 flag compared against 1, except "Cov: Wrote Any?" which counts files.
export const COMPARISONS = {
  'More Work?': { operation: 'equal', value2: 1 },
  'File Picked?': { operation: 'equal', value2: 1 },
  'Pick Retryable?': { operation: 'equal', value2: 1 },
  'Baseline OK?': { operation: 'equal', value2: 1 },
  'Cov: Has Work?': { operation: 'equal', value2: 1 },
  'Cov: Green?': { operation: 'equal', value2: 1 },
  'Cov: Wrote Any?': { operation: 'larger', value2: 0 },
  'Cov: Green After Repair?': { operation: 'equal', value2: 1 },
  'Mutant To Kill?': { operation: 'equal', value2: 1 },
  'Kill: Batch Failed?': { operation: 'equal', value2: 1 },
  'Kill: Escalate?': { operation: 'equal', value2: 1 },
  'Another Round?': { operation: 'equal', value2: 1 },
  'Approved?': { operation: 'equal', value2: 1 },
};

// Full descriptor for one IF node. Throws rather than emitting an `undefined`
// expression, which n8n would happily accept and then always take the false branch.
export function condition(name) {
  const value1 = CONDITIONS[name];
  const cmp = COMPARISONS[name];
  if (typeof value1 !== 'string') throw new Error(`no condition registered for IF node "${name}"`);
  if (!cmp) throw new Error(`no comparison registered for IF node "${name}"`);
  return { value1, value2: cmp.value2, operation: cmp.operation };
}
