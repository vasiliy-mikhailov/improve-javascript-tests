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

// Code node "Kill: Build Prompt".
//
// ONE target, ONE test file. The old batch approach ("here are 5 survivors, write
// tests") produced tests that passed but killed nothing, so the prompt now names a
// single victim and the file it goes in is named after that victim — a failed
// attempt is then trivial to drop.
//
// Asked ONCE. The attempt runs without reasoning: measured on a prompt from the
// pipeline's own dialog log, the model answers in 21-28s that way against 112-186s
// with reasoning, and on everything that could be checked mechanically the fast answer
// was no worse. A reasoning retry used to follow a failure; attribution put it at
// 25.3% of a five-hour run for about 8% of the kills, so it was removed.
//
// @param t     response of the "Next Mutant" node: { mutant, path, testPath, source, ... }
// @param opts  { thinking } — the one attempt this mutant gets, without reasoning
export function killBuildPrompt(t, opts) {
  if (stryMutAct_9fa48("495")) {
    {}
  } else {
    stryCov_9fa48("495");
    const o = stryMutAct_9fa48("498") ? opts && {} : stryMutAct_9fa48("497") ? false : stryMutAct_9fa48("496") ? true : (stryCov_9fa48("496", "497", "498"), opts || {});
    const m = t.mutant;
    const file = t.path;
    const ext = (stryMutAct_9fa48("501") ? file.match(/\.[cm]?[jt]sx?$/) && ['.ts'] : stryMutAct_9fa48("500") ? false : stryMutAct_9fa48("499") ? true : (stryCov_9fa48("499", "500", "501"), file.match(stryMutAct_9fa48("506") ? /\.[cm]?[jt]sx$/ : stryMutAct_9fa48("505") ? /\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("504") ? /\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("503") ? /\.[cm][jt]sx?$/ : stryMutAct_9fa48("502") ? /\.[cm]?[jt]sx?/ : (stryCov_9fa48("502", "503", "504", "505", "506"), /\.[cm]?[jt]sx?$/)) || (stryMutAct_9fa48("507") ? [] : (stryCov_9fa48("507"), [stryMutAct_9fa48("508") ? "" : (stryCov_9fa48("508"), '.ts')]))))[0];
    const base = t.testPath.replace(stryMutAct_9fa48("513") ? /\.(test|spec)\.[cm]?[jt]sx$/ : stryMutAct_9fa48("512") ? /\.(test|spec)\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("511") ? /\.(test|spec)\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("510") ? /\.(test|spec)\.[cm][jt]sx?$/ : stryMutAct_9fa48("509") ? /\.(test|spec)\.[cm]?[jt]sx?/ : (stryCov_9fa48("509", "510", "511", "512", "513"), /\.(test|spec)\.[cm]?[jt]sx?$/), stryMutAct_9fa48("514") ? "Stryker was here!" : (stryCov_9fa48("514"), '')).replace(stryMutAct_9fa48("519") ? /\.[cm]?[jt]sx$/ : stryMutAct_9fa48("518") ? /\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("517") ? /\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("516") ? /\.[cm][jt]sx?$/ : stryMutAct_9fa48("515") ? /\.[cm]?[jt]sx?/ : (stryCov_9fa48("515", "516", "517", "518", "519"), /\.[cm]?[jt]sx?$/), stryMutAct_9fa48("520") ? "Stryker was here!" : (stryCov_9fa48("520"), ''));
    // One file per target — but the NAME has to carry the whole mutant identity, not
    // just line + mutator. Stryker emits several distinct mutants in one place
    // (ConditionalExpression gives a `true` and a `false` variant; `a === 1 && b === 2`
    // gives two EqualityOperator mutants), and sidecar/mutants.js separates them by
    // column AND replacement, so the loop attacks each of them in its own round. A name
    // that ignores column and replacement makes round two overwrite the test that killed
    // round one's mutant — and delete it outright when round two fails.
    // djb2, inlined: an n8n Code node has no require().
    const hash = str => {
      if (stryMutAct_9fa48("521")) {
        {}
      } else {
        stryCov_9fa48("521");
        let x = 5381;
        for (let i = 0; stryMutAct_9fa48("524") ? i >= str.length : stryMutAct_9fa48("523") ? i <= str.length : stryMutAct_9fa48("522") ? false : (stryCov_9fa48("522", "523", "524"), i < str.length); stryMutAct_9fa48("525") ? i-- : (stryCov_9fa48("525"), i++)) x = ((stryMutAct_9fa48("526") ? x / 33 : (stryCov_9fa48("526"), x * 33)) ^ str.charCodeAt(i)) >>> 0;
        return x.toString(36);
      }
    };
    const tag = hash(String(m.mutator) + (stryMutAct_9fa48("527") ? "" : (stryCov_9fa48("527"), '|')) + m.line + (stryMutAct_9fa48("528") ? "" : (stryCov_9fa48("528"), '|')) + (stryMutAct_9fa48("529") ? m.column && '' : (stryCov_9fa48("529"), m.column ?? (stryMutAct_9fa48("530") ? "Stryker was here!" : (stryCov_9fa48("530"), '')))) + (stryMutAct_9fa48("531") ? "" : (stryCov_9fa48("531"), '|')) + (stryMutAct_9fa48("532") ? String(m.replacement ?? '') : (stryCov_9fa48("532"), String(stryMutAct_9fa48("533") ? m.replacement && '' : (stryCov_9fa48("533"), m.replacement ?? (stryMutAct_9fa48("534") ? "Stryker was here!" : (stryCov_9fa48("534"), '')))).slice(0, 60))));
    const targetPath = base + (stryMutAct_9fa48("535") ? "" : (stryCov_9fa48("535"), '.kill-L')) + m.line + (stryMutAct_9fa48("536") ? "" : (stryCov_9fa48("536"), '-')) + (stryMutAct_9fa48("537") ? String(m.mutator).toUpperCase() : (stryCov_9fa48("537"), String(m.mutator).toLowerCase())) + (stryMutAct_9fa48("538") ? "" : (stryCov_9fa48("538"), '-')) + tag + (stryMutAct_9fa48("539") ? "" : (stryCov_9fa48("539"), '.test')) + ext;
    // A column of 0 is a position, not "no column" — so ask whether it is ABSENT.
    const col = (stryMutAct_9fa48("542") ? m.column == null && m.column === '' : stryMutAct_9fa48("541") ? false : stryMutAct_9fa48("540") ? true : (stryCov_9fa48("540", "541", "542"), (stryMutAct_9fa48("544") ? m.column != null : stryMutAct_9fa48("543") ? false : (stryCov_9fa48("543", "544"), m.column == null)) || (stryMutAct_9fa48("546") ? m.column !== '' : stryMutAct_9fa48("545") ? false : (stryCov_9fa48("545", "546"), m.column === (stryMutAct_9fa48("547") ? "Stryker was here!" : (stryCov_9fa48("547"), '')))))) ? stryMutAct_9fa48("548") ? "Stryker was here!" : (stryCov_9fa48("548"), '') : (stryMutAct_9fa48("549") ? "" : (stryCov_9fa48("549"), ':')) + m.column;
    // What the status actually tells the test writer. This is a lookup and not a
    // two-way ternary because 'survived' and 'nocoverage' are two members of an open
    // set: sidecar/stryker.js filters survivors to exactly those two today, but the
    // moment that filter widens, an "everything else is nocoverage" branch would tell
    // the model its target is unreached — and it would then write a test that merely
    // executes the code instead of one that discriminates the mutation.
    // Stryker's own enum is PascalCase and the sidecar lower-cases it; do not depend on
    // that having happened.
    // null prototype: the status comes from a JSON report, and a plain object would
    // answer 'constructor' or '__proto__' with a prototype member that then gets
    // concatenated into the prompt as text.
    const statusBrief = stryMutAct_9fa48("550") ? {} : (stryCov_9fa48("550"), {
      __proto__: null,
      survived: stryMutAct_9fa48("551") ? "" : (stryCov_9fa48("551"), 'covered by existing tests, but nothing asserts the difference'),
      nocoverage: stryMutAct_9fa48("552") ? "" : (stryCov_9fa48("552"), 'not covered at all — your test must reach this code')
    });
    const rawStatus = stryMutAct_9fa48("554") ? String(m.status ?? '').toLowerCase() : stryMutAct_9fa48("553") ? String(m.status ?? '').trim().toUpperCase() : (stryCov_9fa48("553", "554"), String(stryMutAct_9fa48("555") ? m.status && '' : (stryCov_9fa48("555"), m.status ?? (stryMutAct_9fa48("556") ? "Stryker was here!" : (stryCov_9fa48("556"), '')))).trim().toLowerCase());
    // The fallback claims only what is known: the label, and that coverage is unknown.
    const status = stryMutAct_9fa48("559") ? statusBrief[rawStatus] && (rawStatus ? 'Stryker reports this mutant as "' + rawStatus + '"' : 'unreported by Stryker') + ' — whether any existing test reaches this code is unknown, so your test must both execute it and assert the difference' : stryMutAct_9fa48("558") ? false : stryMutAct_9fa48("557") ? true : (stryCov_9fa48("557", "558", "559"), statusBrief[rawStatus] || (rawStatus ? (stryMutAct_9fa48("560") ? "" : (stryCov_9fa48("560"), 'Stryker reports this mutant as "')) + rawStatus + (stryMutAct_9fa48("561") ? "" : (stryCov_9fa48("561"), '"')) : stryMutAct_9fa48("562") ? "" : (stryCov_9fa48("562"), 'unreported by Stryker')) + (stryMutAct_9fa48("563") ? "" : (stryCov_9fa48("563"), ' — whether any existing test reaches this code is unknown, so your test must both execute it and assert the difference')));
    const gaps = stryMutAct_9fa48("564") ? {} : (stryCov_9fa48("564"), {
      ui: t.ui,
      source: t.source,
      runner: t.runner,
      constraints: t.constraints
    });
    const ui = uiGuidance(file, gaps);
    const constraints = (stryMutAct_9fa48("567") ? t.constraints && [] : stryMutAct_9fa48("566") ? false : stryMutAct_9fa48("565") ? true : (stryCov_9fa48("565", "566", "567"), t.constraints || (stryMutAct_9fa48("568") ? ["Stryker was here"] : (stryCov_9fa48("568"), [])))).map(stryMutAct_9fa48("569") ? () => undefined : (stryCov_9fa48("569"), c => (stryMutAct_9fa48("570") ? "" : (stryCov_9fa48("570"), '- ')) + c)).join(stryMutAct_9fa48("571") ? "" : (stryCov_9fa48("571"), '\n'));
    const system = stryMutAct_9fa48("572") ? 'You are an expert test engineer. Write EXACTLY ONE ' + t.runner + ' test file containing the FEWEST tests needed to kill ONE specific Stryker mutant. ' + 'A mutant is killed when a test FAILS on the mutated code while PASSING on the real code — so assert the precise value/behaviour the mutation would change. ' + 'Reply ONLY with JSON: {"tests":[{"path":"' + targetPath + '","content":"full test file content"}]}. Rules:' + commonTestRules(1) + ui - (constraints ? '\nTeam constraints:\n' + constraints : '') : (stryCov_9fa48("572"), (stryMutAct_9fa48("573") ? 'You are an expert test engineer. Write EXACTLY ONE ' + t.runner + ' test file containing the FEWEST tests needed to kill ONE specific Stryker mutant. ' + 'A mutant is killed when a test FAILS on the mutated code while PASSING on the real code — so assert the precise value/behaviour the mutation would change. ' + 'Reply ONLY with JSON: {"tests":[{"path":"' + targetPath + '","content":"full test file content"}]}. Rules:' + commonTestRules(1) - ui : (stryCov_9fa48("573"), (stryMutAct_9fa48("574") ? "" : (stryCov_9fa48("574"), 'You are an expert test engineer. Write EXACTLY ONE ')) + t.runner + (stryMutAct_9fa48("575") ? "" : (stryCov_9fa48("575"), ' test file containing the FEWEST tests needed to kill ONE specific Stryker mutant. ')) + (stryMutAct_9fa48("576") ? "" : (stryCov_9fa48("576"), 'A mutant is killed when a test FAILS on the mutated code while PASSING on the real code — so assert the precise value/behaviour the mutation would change. ')) + (stryMutAct_9fa48("577") ? "" : (stryCov_9fa48("577"), 'Reply ONLY with JSON: {"tests":[{"path":"')) + targetPath + (stryMutAct_9fa48("578") ? "" : (stryCov_9fa48("578"), '","content":"full test file content"}]}. Rules:')) + commonTestRules(1) + ui)) + (constraints ? (stryMutAct_9fa48("579") ? "" : (stryCov_9fa48("579"), '\nTeam constraints:\n')) + constraints : stryMutAct_9fa48("580") ? "Stryker was here!" : (stryCov_9fa48("580"), '')));
    const prompt = (stryMutAct_9fa48("581") ? 'SOURCE FILE: ' + file + ' (package: ' + t.packageJson + ')\n' + String(t.source || '').slice(0, 12000) + '\n\nTARGET MUTANT — kill this one:\n' + '  mutator: ' + m.mutator + '\n  line: ' + m.line + col + '\n' + '  the mutation replaces that code with: ' + JSON.stringify(m.replacement) + '\n' + '  status: ' + status + '\n' + (m.context ? '\nSOURCE AROUND THE TARGET:\n' + m.context + '\n' : '') - (t.killIdea ? '\nHOW TO KILL IT (from the analysis that selected this mutant):\n  ' + t.killIdea + '\n' : '') : (stryCov_9fa48("581"), (stryMutAct_9fa48("582") ? 'SOURCE FILE: ' + file + ' (package: ' + t.packageJson + ')\n' + String(t.source || '').slice(0, 12000) + '\n\nTARGET MUTANT — kill this one:\n' + '  mutator: ' + m.mutator + '\n  line: ' + m.line - col : (stryCov_9fa48("582"), (stryMutAct_9fa48("583") ? "" : (stryCov_9fa48("583"), 'SOURCE FILE: ')) + file + (stryMutAct_9fa48("584") ? "" : (stryCov_9fa48("584"), ' (package: ')) + t.packageJson + (stryMutAct_9fa48("585") ? "" : (stryCov_9fa48("585"), ')\n')) + (stryMutAct_9fa48("586") ? String(t.source || '') : (stryCov_9fa48("586"), String(stryMutAct_9fa48("589") ? t.source && '' : stryMutAct_9fa48("588") ? false : stryMutAct_9fa48("587") ? true : (stryCov_9fa48("587", "588", "589"), t.source || (stryMutAct_9fa48("590") ? "Stryker was here!" : (stryCov_9fa48("590"), '')))).slice(0, 12000))) + (stryMutAct_9fa48("591") ? "" : (stryCov_9fa48("591"), '\n\nTARGET MUTANT — kill this one:\n')) + (stryMutAct_9fa48("592") ? "" : (stryCov_9fa48("592"), '  mutator: ')) + m.mutator + (stryMutAct_9fa48("593") ? "" : (stryCov_9fa48("593"), '\n  line: ')) + m.line + col)) + (stryMutAct_9fa48("594") ? "" : (stryCov_9fa48("594"), '\n')) + (stryMutAct_9fa48("595") ? "" : (stryCov_9fa48("595"), '  the mutation replaces that code with: ')) + JSON.stringify(m.replacement) + (stryMutAct_9fa48("596") ? "" : (stryCov_9fa48("596"), '\n')) + (stryMutAct_9fa48("597") ? "" : (stryCov_9fa48("597"), '  status: ')) + status + (stryMutAct_9fa48("598") ? "" : (stryCov_9fa48("598"), '\n')) + (m.context ? (stryMutAct_9fa48("599") ? "" : (stryCov_9fa48("599"), '\nSOURCE AROUND THE TARGET:\n')) + m.context + (stryMutAct_9fa48("600") ? "" : (stryCov_9fa48("600"), '\n')) : stryMutAct_9fa48("601") ? "Stryker was here!" : (stryCov_9fa48("601"), '')) + (t.killIdea ? (stryMutAct_9fa48("602") ? "" : (stryCov_9fa48("602"), '\nHOW TO KILL IT (from the analysis that selected this mutant):\n  ')) + t.killIdea + (stryMutAct_9fa48("603") ? "" : (stryCov_9fa48("603"), '\n')) : stryMutAct_9fa48("604") ? "Stryker was here!" : (stryCov_9fa48("604"), '')))) + (stryMutAct_9fa48("605") ? "" : (stryCov_9fa48("605"), '\nEXISTING TEST FILE (')) + t.testPath + (stryMutAct_9fa48("606") ? "" : (stryCov_9fa48("606"), ', style reference — do not rewrite it):\n')) + (stryMutAct_9fa48("607") ? String(t.existingTest || '(none)') : (stryCov_9fa48("607"), String(stryMutAct_9fa48("610") ? t.existingTest && '(none)' : stryMutAct_9fa48("609") ? false : stryMutAct_9fa48("608") ? true : (stryCov_9fa48("608", "609", "610"), t.existingTest || (stryMutAct_9fa48("611") ? "" : (stryCov_9fa48("611"), '(none)')))).slice(0, 4000))) + (stryMutAct_9fa48("612") ? "" : (stryCov_9fa48("612"), '\n\nWrite the single test file that kills this mutant. JSON only.'));
    return stryMutAct_9fa48("613") ? {} : (stryCov_9fa48("613"), {
      system,
      prompt,
      json: stryMutAct_9fa48("614") ? false : (stryCov_9fa48("614"), true),
      maxTokens: 9000,
      temperature: 0.2,
      thinking: o.thinking,
      stage: stryMutAct_9fa48("615") ? "" : (stryCov_9fa48("615"), 'improving_mutation'),
      stageDetail: stryMutAct_9fa48("616") ? 'writing a test to kill ' + m.mutator + ' at line ' + m.line - (o.thinking === false ? ' (fast attempt, without reasoning)' : '') : (stryCov_9fa48("616"), (stryMutAct_9fa48("617") ? "" : (stryCov_9fa48("617"), 'writing a test to kill ')) + m.mutator + (stryMutAct_9fa48("618") ? "" : (stryCov_9fa48("618"), ' at line ')) + m.line + ((stryMutAct_9fa48("621") ? o.thinking !== false : stryMutAct_9fa48("620") ? false : stryMutAct_9fa48("619") ? true : (stryCov_9fa48("619", "620", "621"), o.thinking === (stryMutAct_9fa48("622") ? true : (stryCov_9fa48("622"), false)))) ? stryMutAct_9fa48("623") ? "" : (stryCov_9fa48("623"), ' (fast attempt, without reasoning)') : stryMutAct_9fa48("624") ? "Stryker was here!" : (stryCov_9fa48("624"), ''))),
      // the parser needs to know which path belongs to the repo, or it cannot refuse it
      targetPath,
      existingTestPath: t.testPath,
      existingTestExists: stryMutAct_9fa48("625") ? !t.testExists : (stryCov_9fa48("625"), !(stryMutAct_9fa48("626") ? t.testExists : (stryCov_9fa48("626"), !t.testExists)))
    });
  }
}