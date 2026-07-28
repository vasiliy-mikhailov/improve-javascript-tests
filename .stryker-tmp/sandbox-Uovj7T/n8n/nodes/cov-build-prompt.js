// @ts-nocheck
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
  if (stryMutAct_9fa48("84")) {
    {}
  } else {
    stryCov_9fa48("84");
    const ext = (stryMutAct_9fa48("87") ? file.match(/\.[cm]?[jt]sx?$/) && ['.ts'] : stryMutAct_9fa48("86") ? false : stryMutAct_9fa48("85") ? true : (stryCov_9fa48("85", "86", "87"), file.match(stryMutAct_9fa48("92") ? /\.[cm]?[jt]sx$/ : stryMutAct_9fa48("91") ? /\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("90") ? /\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("89") ? /\.[cm][jt]sx?$/ : stryMutAct_9fa48("88") ? /\.[cm]?[jt]sx?/ : (stryCov_9fa48("88", "89", "90", "91", "92"), /\.[cm]?[jt]sx?$/)) || (stryMutAct_9fa48("93") ? [] : (stryCov_9fa48("93"), [stryMutAct_9fa48("94") ? "" : (stryCov_9fa48("94"), '.ts')]))))[0];
    const u = stryMutAct_9fa48("97") ? gaps.uncovered && {} : stryMutAct_9fa48("96") ? false : stryMutAct_9fa48("95") ? true : (stryCov_9fa48("95", "96", "97"), gaps.uncovered || {});
    const fullyUncovered = stryMutAct_9fa48("100") ? u.lines !== 'all' : stryMutAct_9fa48("99") ? false : stryMutAct_9fa48("98") ? true : (stryCov_9fa48("98", "99", "100"), u.lines === (stryMutAct_9fa48("101") ? "" : (stryCov_9fa48("101"), 'all')));
    const nothingToCover = stryMutAct_9fa48("104") ? !gaps.needsBootstrap && !fullyUncovered && (!u.lines || !u.lines.length) && (!u.functions || !u.functions.length) && (!u.branches || !u.branches.length) : stryMutAct_9fa48("103") ? false : stryMutAct_9fa48("102") ? true : (stryCov_9fa48("102", "103", "104"), (stryMutAct_9fa48("105") ? gaps.needsBootstrap : (stryCov_9fa48("105"), !gaps.needsBootstrap)) || (stryMutAct_9fa48("107") ? !fullyUncovered && (!u.lines || !u.lines.length) && (!u.functions || !u.functions.length) || !u.branches || !u.branches.length : stryMutAct_9fa48("106") ? false : (stryCov_9fa48("106", "107"), (stryMutAct_9fa48("109") ? !fullyUncovered && (!u.lines || !u.lines.length) || !u.functions || !u.functions.length : stryMutAct_9fa48("108") ? true : (stryCov_9fa48("108", "109"), (stryMutAct_9fa48("111") ? !fullyUncovered || !u.lines || !u.lines.length : stryMutAct_9fa48("110") ? true : (stryCov_9fa48("110", "111"), (stryMutAct_9fa48("112") ? fullyUncovered : (stryCov_9fa48("112"), !fullyUncovered)) && (stryMutAct_9fa48("114") ? !u.lines && !u.lines.length : stryMutAct_9fa48("113") ? true : (stryCov_9fa48("113", "114"), (stryMutAct_9fa48("115") ? u.lines : (stryCov_9fa48("115"), !u.lines)) || (stryMutAct_9fa48("116") ? u.lines.length : (stryCov_9fa48("116"), !u.lines.length)))))) && (stryMutAct_9fa48("118") ? !u.functions && !u.functions.length : stryMutAct_9fa48("117") ? true : (stryCov_9fa48("117", "118"), (stryMutAct_9fa48("119") ? u.functions : (stryCov_9fa48("119"), !u.functions)) || (stryMutAct_9fa48("120") ? u.functions.length : (stryCov_9fa48("120"), !u.functions.length)))))) && (stryMutAct_9fa48("122") ? !u.branches && !u.branches.length : stryMutAct_9fa48("121") ? true : (stryCov_9fa48("121", "122"), (stryMutAct_9fa48("123") ? u.branches : (stryCov_9fa48("123"), !u.branches)) || (stryMutAct_9fa48("124") ? u.branches.length : (stryCov_9fa48("124"), !u.branches.length)))))));
    const base = gaps.testPath.replace(stryMutAct_9fa48("129") ? /\.(test|spec)\.[cm]?[jt]sx$/ : stryMutAct_9fa48("128") ? /\.(test|spec)\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("127") ? /\.(test|spec)\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("126") ? /\.(test|spec)\.[cm][jt]sx?$/ : stryMutAct_9fa48("125") ? /\.(test|spec)\.[cm]?[jt]sx?/ : (stryCov_9fa48("125", "126", "127", "128", "129"), /\.(test|spec)\.[cm]?[jt]sx?$/), stryMutAct_9fa48("130") ? "Stryker was here!" : (stryCov_9fa48("130"), '')).replace(stryMutAct_9fa48("135") ? /\.[cm]?[jt]sx$/ : stryMutAct_9fa48("134") ? /\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("133") ? /\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("132") ? /\.[cm][jt]sx?$/ : stryMutAct_9fa48("131") ? /\.[cm]?[jt]sx?/ : (stryCov_9fa48("131", "132", "133", "134", "135"), /\.[cm]?[jt]sx?$/), stryMutAct_9fa48("136") ? "Stryker was here!" : (stryCov_9fa48("136"), ''));
    const roundSuffix = (stryMutAct_9fa48("140") ? (gaps.rounds || 0) <= 0 : stryMutAct_9fa48("139") ? (gaps.rounds || 0) >= 0 : stryMutAct_9fa48("138") ? false : stryMutAct_9fa48("137") ? true : (stryCov_9fa48("137", "138", "139", "140"), (stryMutAct_9fa48("143") ? gaps.rounds && 0 : stryMutAct_9fa48("142") ? false : stryMutAct_9fa48("141") ? true : (stryCov_9fa48("141", "142", "143"), gaps.rounds || 0)) > 0)) ? (stryMutAct_9fa48("144") ? "" : (stryCov_9fa48("144"), '-r')) + (stryMutAct_9fa48("145") ? (gaps.rounds || 0) - 1 : (stryCov_9fa48("145"), (stryMutAct_9fa48("148") ? gaps.rounds && 0 : stryMutAct_9fa48("147") ? false : stryMutAct_9fa48("146") ? true : (stryCov_9fa48("146", "147", "148"), gaps.rounds || 0)) + 1)) : stryMutAct_9fa48("149") ? "Stryker was here!" : (stryCov_9fa48("149"), '');
    const targetPath = base + (stryMutAct_9fa48("150") ? "" : (stryCov_9fa48("150"), '.mac-cov')) + roundSuffix + (stryMutAct_9fa48("151") ? "" : (stryCov_9fa48("151"), '.test')) + ext;
    if (stryMutAct_9fa48("153") ? false : stryMutAct_9fa48("152") ? true : (stryCov_9fa48("152", "153"), nothingToCover)) return stryMutAct_9fa48("154") ? {} : (stryCov_9fa48("154"), {
      skip: stryMutAct_9fa48("155") ? false : (stryCov_9fa48("155"), true),
      reason: gaps.needsBootstrap ? stryMutAct_9fa48("156") ? "" : (stryCov_9fa48("156"), 'file fully covered') : stryMutAct_9fa48("157") ? "" : (stryCov_9fa48("157"), 'already executed by tests — mutant loop takes it from here'),
      targetPath,
      existingTestPath: gaps.testPath,
      existingTestExists: gaps.testExists
    });
    const constraints = (stryMutAct_9fa48("160") ? gaps.constraints && [] : stryMutAct_9fa48("159") ? false : stryMutAct_9fa48("158") ? true : (stryCov_9fa48("158", "159", "160"), gaps.constraints || (stryMutAct_9fa48("161") ? ["Stryker was here"] : (stryCov_9fa48("161"), [])))).map(stryMutAct_9fa48("162") ? () => undefined : (stryCov_9fa48("162"), c => (stryMutAct_9fa48("163") ? "" : (stryCov_9fa48("163"), '- ')) + c)).join(stryMutAct_9fa48("164") ? "" : (stryCov_9fa48("164"), '\n'));
    const ui = uiGuidance(file, gaps);
    const system = stryMutAct_9fa48("165") ? 'You are an expert JavaScript/TypeScript test engineer writing ' + gaps.runner + ' tests to INCREASE LINE COVERAGE of one source file. Reply ONLY with JSON: {"tests":[{"path":"...","content":"full test file content"}]}. Create NEW test files only — never modify existing files. Preferred new file path: ' + targetPath + '. Rules:' + commonTestRules() + ui - (constraints ? '\nTeam constraints:\n' + constraints : '') : (stryCov_9fa48("165"), (stryMutAct_9fa48("166") ? 'You are an expert JavaScript/TypeScript test engineer writing ' + gaps.runner + ' tests to INCREASE LINE COVERAGE of one source file. Reply ONLY with JSON: {"tests":[{"path":"...","content":"full test file content"}]}. Create NEW test files only — never modify existing files. Preferred new file path: ' + targetPath + '. Rules:' + commonTestRules() - ui : (stryCov_9fa48("166"), (stryMutAct_9fa48("167") ? "" : (stryCov_9fa48("167"), 'You are an expert JavaScript/TypeScript test engineer writing ')) + gaps.runner + (stryMutAct_9fa48("168") ? "" : (stryCov_9fa48("168"), ' tests to INCREASE LINE COVERAGE of one source file. Reply ONLY with JSON: {"tests":[{"path":"...","content":"full test file content"}]}. Create NEW test files only — never modify existing files. Preferred new file path: ')) + targetPath + (stryMutAct_9fa48("169") ? "" : (stryCov_9fa48("169"), '. Rules:')) + commonTestRules() + ui)) + (constraints ? (stryMutAct_9fa48("170") ? "" : (stryCov_9fa48("170"), '\nTeam constraints:\n')) + constraints : stryMutAct_9fa48("171") ? "Stryker was here!" : (stryCov_9fa48("171"), '')));
    const prompt = (stryMutAct_9fa48("172") ? "" : (stryCov_9fa48("172"), 'SOURCE FILE: ')) + gaps.path + (stryMutAct_9fa48("173") ? "" : (stryCov_9fa48("173"), ' (package: ')) + gaps.packageJson + (stryMutAct_9fa48("174") ? "" : (stryCov_9fa48("174"), ')\n')) + (stryMutAct_9fa48("175") ? String(gaps.source || '') : (stryCov_9fa48("175"), String(stryMutAct_9fa48("178") ? gaps.source && '' : stryMutAct_9fa48("177") ? false : stryMutAct_9fa48("176") ? true : (stryCov_9fa48("176", "177", "178"), gaps.source || (stryMutAct_9fa48("179") ? "Stryker was here!" : (stryCov_9fa48("179"), '')))).slice(0, 14000))) + (stryMutAct_9fa48("180") ? "" : (stryCov_9fa48("180"), '\n\nUNCOVERED: ')) + (fullyUncovered ? stryMutAct_9fa48("181") ? "" : (stryCov_9fa48("181"), 'ENTIRE FILE (never imported by any test)') : (stryMutAct_9fa48("182") ? "" : (stryCov_9fa48("182"), 'lines ')) + JSON.stringify(stryMutAct_9fa48("183") ? u.lines || [] : (stryCov_9fa48("183"), (stryMutAct_9fa48("186") ? u.lines && [] : stryMutAct_9fa48("185") ? false : stryMutAct_9fa48("184") ? true : (stryCov_9fa48("184", "185", "186"), u.lines || (stryMutAct_9fa48("187") ? ["Stryker was here"] : (stryCov_9fa48("187"), [])))).slice(0, 120))) + (stryMutAct_9fa48("188") ? "" : (stryCov_9fa48("188"), '; functions ')) + JSON.stringify(stryMutAct_9fa48("189") ? u.functions || [] : (stryCov_9fa48("189"), (stryMutAct_9fa48("192") ? u.functions && [] : stryMutAct_9fa48("191") ? false : stryMutAct_9fa48("190") ? true : (stryCov_9fa48("190", "191", "192"), u.functions || (stryMutAct_9fa48("193") ? ["Stryker was here"] : (stryCov_9fa48("193"), [])))).slice(0, 30))) + (stryMutAct_9fa48("194") ? "" : (stryCov_9fa48("194"), '; branches ')) + JSON.stringify(stryMutAct_9fa48("195") ? u.branches || [] : (stryCov_9fa48("195"), (stryMutAct_9fa48("198") ? u.branches && [] : stryMutAct_9fa48("197") ? false : stryMutAct_9fa48("196") ? true : (stryCov_9fa48("196", "197", "198"), u.branches || (stryMutAct_9fa48("199") ? ["Stryker was here"] : (stryCov_9fa48("199"), [])))).slice(0, 40)))) + (stryMutAct_9fa48("200") ? "" : (stryCov_9fa48("200"), '\n\nEXISTING TEST FILE (')) + gaps.testPath + (stryMutAct_9fa48("201") ? "" : (stryCov_9fa48("201"), ', style reference — do not rewrite it):\n')) + (stryMutAct_9fa48("202") ? String(gaps.existingTest || '(none)') : (stryCov_9fa48("202"), String(stryMutAct_9fa48("205") ? gaps.existingTest && '(none)' : stryMutAct_9fa48("204") ? false : stryMutAct_9fa48("203") ? true : (stryCov_9fa48("203", "204", "205"), gaps.existingTest || (stryMutAct_9fa48("206") ? "" : (stryCov_9fa48("206"), '(none)')))).slice(0, 6000))) + (stryMutAct_9fa48("207") ? "" : (stryCov_9fa48("207"), '\n\nWrite tests that execute the uncovered lines/functions/branches. JSON only.'));
    // Cold, like the first kill attempt. Measured on three real prompts from the
    // pipeline's own dialog log, three samples each: parsing, syntactic validity and
    // "imports and exercises the module" were 9/9 in BOTH arms, the cold arm ran 2.5-3.7x
    // faster and wrote more tests on the hardest file, and on the case that could be
    // executed both arms were green with identical coverage. With reasoning on, that
    // hardest file used 85-98% of its budget — the same wall that returned two empty
    // completions in a live run, ~400s each to recover. The one measured loss is a
    // chain-of-thought comment in 1 of 9 files, which the cleanup stage strips.
    // The repair turn keeps reasoning: by then the cheap attempt has already failed.
    return stryMutAct_9fa48("208") ? {} : (stryCov_9fa48("208"), {
      system,
      prompt,
      json: stryMutAct_9fa48("209") ? false : (stryCov_9fa48("209"), true),
      maxTokens: 6000,
      temperature: 0.3,
      thinking: stryMutAct_9fa48("210") ? true : (stryCov_9fa48("210"), false),
      stage: stryMutAct_9fa48("211") ? "" : (stryCov_9fa48("211"), 'improving_coverage'),
      stageDetail: stryMutAct_9fa48("212") ? "" : (stryCov_9fa48("212"), 'writing tests for uncovered code (fast attempt, without reasoning)'),
      targetPath,
      existingTestPath: gaps.testPath,
      existingTestExists: gaps.testExists
    });
  }
}