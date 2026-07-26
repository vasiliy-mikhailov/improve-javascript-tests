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
export function covParseRepair(resp, prev) {
  let tests = (resp.ok && resp.json && Array.isArray(resp.json.tests)) ? resp.json.tests : [];
  tests = tests
    .filter(t => t && typeof t.content === 'string' && t.content.trim().length > 10)
    .slice(0, prev.paths.length)
    .map((t) => ({ path: prev.paths.includes(t.path) ? t.path : null, content: t.content }));
  // fill the unrecognised paths from whatever is still unclaimed, in order
  const free = prev.paths.filter(p => !tests.some(t => t.path === p));
  tests = tests.map(t => (t.path ? t : { ...t, path: free.shift() || null })).filter(t => t.path);
  return { tests, paths: tests.map(t => t.path), count: tests.length };
}
