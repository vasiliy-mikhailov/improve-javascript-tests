import { uiGuidance } from './ui-guidance.js';
import { commonTestRules } from './common-test-rules.js';

// Code node "Cov: Build Prompt".
//
// Turns the /api/files/gaps response into an /api/llm/chat request, or into a
// { skip: true } marker that the "Cov: Has Work?" IF routes past the LLM.
//
// The coverage phase is a BOOTSTRAP only: it exists so a file is executed at all,
// because mutation testing has nothing to work with otherwise. Once any coverage
// exists, killing mutants raises coverage as a side effect, so we skip straight to
// the mutant loop instead of writing bulk coverage tests.
//
// @param gaps  response of the "Coverage Gaps" node
// @param file  the source file this iteration is improving
export function covBuildPrompt(gaps, file) {
  const ext = (file.match(/\.[cm]?[jt]sx?$/) || ['.ts'])[0];
  const u = gaps.uncovered || {};
  const fullyUncovered = u.lines === 'all';
  const nothingToCover = !gaps.needsBootstrap
    || (!fullyUncovered && (!u.lines || !u.lines.length) && (!u.functions || !u.functions.length) && (!u.branches || !u.branches.length));
  const base = gaps.testPath.replace(/\.(test|spec)\.[cm]?[jt]sx?$/, '').replace(/\.[cm]?[jt]sx?$/, '');
  const roundSuffix = (gaps.rounds || 0) > 0 ? '-r' + ((gaps.rounds || 0) + 1) : '';
  const targetPath = base + '.mac-cov' + roundSuffix + '.test' + ext;
  if (nothingToCover) return { skip: true, reason: gaps.needsBootstrap ? 'file fully covered' : 'already executed by tests — mutant loop takes it from here', targetPath, existingTestPath: gaps.testPath, existingTestExists: gaps.testExists };
  const constraints = (gaps.constraints || []).map(c => '- ' + c).join('\n');
  const ui = uiGuidance(file, gaps);
  const system = 'You are an expert JavaScript/TypeScript test engineer writing ' + gaps.runner + ' tests to INCREASE LINE COVERAGE of one source file. Reply ONLY with JSON: {"tests":[{"path":"...","content":"full test file content"}]}. Create NEW test files only — never modify existing files. Preferred new file path: ' + targetPath + '. Rules:' + commonTestRules()
    + ui
    + (constraints ? '\nTeam constraints:\n' + constraints : '');
  const prompt = 'SOURCE FILE: ' + gaps.path + ' (package: ' + gaps.packageJson + ')\n'
    + String(gaps.source || '').slice(0, 14000)
    + '\n\nUNCOVERED: ' + (fullyUncovered ? 'ENTIRE FILE (never imported by any test)' :
        'lines ' + JSON.stringify((u.lines || []).slice(0, 120))
        + '; functions ' + JSON.stringify((u.functions || []).slice(0, 30))
        + '; branches ' + JSON.stringify((u.branches || []).slice(0, 40)))
    + '\n\nEXISTING TEST FILE (' + gaps.testPath + ', style reference — do not rewrite it):\n'
    + String(gaps.existingTest || '(none)').slice(0, 6000)
    + '\n\nWrite tests that execute the uncovered lines/functions/branches. JSON only.';
  return { system, prompt, json: true, maxTokens: 6000, temperature: 0.3, stage: 'improving_coverage', stageDetail: 'writing tests for uncovered code', targetPath, existingTestPath: gaps.testPath, existingTestExists: gaps.testExists };
}
