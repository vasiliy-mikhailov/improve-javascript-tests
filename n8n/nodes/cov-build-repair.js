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
  const system = 'You are an expert test engineer. Tests you previously wrote FAIL against the current implementation. Fix them. Keep the SAME file paths. Reply ONLY with JSON: {"tests":[{"path":"...","content":"full corrected file content"}]}. If a test asserts wrong expected values, correct the expectations to match the real behavior of the source. If a test cannot be fixed, drop it from the output.';
  const prompt = 'TEST RUNNER OUTPUT (failures):\n' + String(fail.summary || '').slice(0, 3500)
    + '\n\nYOUR TEST FILES:\n' + filesTxt
    + '\n\nSOURCE FILE ' + gaps.path + ' (for reference):\n' + String(gaps.source || '').slice(0, 10000)
    + '\n\nReply with corrected JSON now.';
  return { system, prompt, json: true, maxTokens: 6000, temperature: 0.2, stage, stageDetail: 'repairing failing generated tests' };
}
