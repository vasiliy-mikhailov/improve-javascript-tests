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
    .map(t => {
      let p = String(t.path || '').replace(/^\.?\//, '');
      // both halves of what sidecar/repo.js:writeTestFile requires — a test-shaped
      // path AND a js/ts extension. Checking only the first reported files the disk
      // never received.
      const safe = /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/.test(p)
        && /\.[cm]?[jt]sx?$/.test(p) && !p.includes('..');
      const collides = p === plan.existingTestPath && plan.existingTestExists;
      return { path: (safe && !collides) ? p : plan.targetPath, content: t.content };
    });
  return { tests, paths: tests.map(t => t.path), count: tests.length };
}
