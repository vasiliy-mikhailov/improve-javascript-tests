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
export function killParseTest(resp, plan) {
  let tests = (resp.ok && resp.json && Array.isArray(resp.json.tests)) ? resp.json.tests : [];
  tests = tests
    .filter(t => t && typeof t.content === 'string' && t.content.trim().length > 10)
    .slice(0, 1)                                  // one target, one test file
    // The path is OURS, always. It is derived from the repo's own convention and the
    // mutant's full identity (mutator, line, column, a hash of the replacement), and
    // the model knows nothing about placement that we do not. Honouring a proposed
    // path let a live run write `…kill-L82-booleanliteral.test.ts` among nine siblings
    // that all carried the identity hash — walking straight back into the collision
    // the naming exists to prevent, where two mutants on one line overwrite each
    // other's verified kill. The repo-owned guard does not cover this: it protects
    // tests that existed before the run, not the ones this run just wrote.
    .map(t => ({ path: plan.targetPath, content: t.content }));
  return { tests, paths: tests.map(t => t.path), count: tests.length };
}
