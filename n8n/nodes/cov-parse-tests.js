// Code node "Cov: Parse Tests".
//
// The LLM is asked for JSON but is not trusted with file paths: anything that does
// not look like a test file, or that would overwrite the repo's existing test file,
// is rewritten to the path we planned. Two files max — more than that is the model
// padding the answer.
//
// The CONTENT is the expensive half of the reply, so a missing or unusable path is
// not a reason to throw it away: the phase planned a target path, and the twin node
// (killParseTest) has always fallen back to it. Only content decides survival.
//
// "Looks like a test path" must mean what the SIDECAR means by it. repo.writeTestFile
// checks the location regex AND /\.[cm]?[jt]sx?$/, so a looser test here produces a
// path this node reports, "Cov: Write Tests" is refused, and the suite is then run
// against a file that does not exist. Both halves live here, in the sidecar's order.
//
// Paths must also come out DISTINCT. Two entries sharing one path are written in
// order by /api/test/write-many, so the second silently overwrites the first while
// the pipeline reports two files — and the repair turn then inherits the duplicate
// as its allowlist and repairs the same path twice.
//
// @param resp  response of the "Cov: LLM Write Tests" node
// @param plan  output of "Cov: Build Prompt" (targetPath / existingTestPath)
export function covParseTests(resp, plan) {
  let tests = (resp.ok && resp.json && Array.isArray(resp.json.tests)) ? resp.json.tests : [];
  tests = tests
    .filter(t => t && typeof t.content === 'string' && t.content.trim().length > 10)
    .slice(0, 2)
    .map((t, i) => {
      let p = (typeof t.path === 'string' ? t.path : '').replace(/^\.?\//, '');
      const safe = /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/.test(p)
        && /\.[cm]?[jt]sx?$/.test(p) && !p.includes('..');
      const collides = p === plan.existingTestPath && plan.existingTestExists;
      if (!safe || collides) p = i === 0 ? plan.targetPath : plan.targetPath.replace('.test.', '-' + i + '.test.');
      return { path: p, content: t.content };
    })
    .filter((t, i, all) => all.findIndex(o => o.path === t.path) === i);
  return { tests, paths: tests.map(t => t.path), count: tests.length };
}
