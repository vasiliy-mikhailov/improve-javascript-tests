// Code node "Cov: Build Repair".
//
// Second chance for tests that were written, ran, and failed. We hand the model its
// own files back together with the runner output and the source, because the usual
// cause is a wrong expected value rather than a wrong idea.
//
// @param fail    response of the "Cov: Run Tests" node (failing summary)
// @param parsed  output of "Cov: Parse Tests" (the files we actually wrote)
// @param gaps    response of the "Coverage Gaps" node (source for reference)
// @param stage   the run stage to report while repairing
export function covBuildRepair(fail, parsed, gaps, stage) {
  const filesTxt = parsed.tests.map(t => 'PATH: ' + t.path + '\n' + t.content.slice(0, 6000)).join('\n\n---\n\n');
  // Ask only for what the sub-graph can act on. "Cov: Write Repair" writes what came
  // back and nothing else, so an omitted file is NOT deleted — it keeps its failing
  // content, "Cov: Re-run Tests" stays red, and "Cov: Delete Broken Tests" then throws
  // away the files that WERE repaired along with it. Every path must come back; an
  // assertion that cannot be saved is dropped as a test CASE inside a returned file.
  const system = 'You are an expert test engineer. Tests you previously wrote FAIL against the current implementation. Fix them. Keep the SAME file paths. Reply ONLY with JSON: {"tests":[{"path":"...","content":"full corrected file content"}]}. Return EVERY file you were given, one entry per path, no renames and no new files. Omitting a file does not delete it: the failing version stays on disk, the whole run stays red, and every file you did repair is thrown away with it. If a test asserts wrong expected values, correct the expectations to match the real behavior of the source. If one test case cannot be fixed, delete that case and return the rest of the file; if a whole file is beyond saving, return it holding one small test that really passes against the source — never an empty file and never a skipped or placeholder test, because a file with no runnable test fails the run too.';
  const n = parsed.tests.length;
  const prompt = 'TEST RUNNER OUTPUT (failures):\n' + String(fail.summary || '').slice(0, 3500)
    + '\n\nYOUR TEST FILES:\n' + filesTxt
    + '\n\nSOURCE FILE ' + gaps.path + ' (for reference):\n' + String(gaps.source || '').slice(0, 10000)
    + '\n\nReply with corrected JSON now: all ' + n + (n === 1 ? ' file' : ' files')
    + ', on these exact paths: ' + parsed.tests.map(t => t.path).join(', ');
  return { system, prompt, json: true, maxTokens: 6000, temperature: 0.2, stage, stageDetail: 'repairing failing generated tests' };
}
