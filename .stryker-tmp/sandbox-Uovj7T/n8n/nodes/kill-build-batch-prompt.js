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

// Code node "Kill: Build Batch Prompt".
//
// ONE test file aimed at MANY surviving mutants at once.
//
// The single-target prompt exists because an early batch attempt ("here are 5
// survivors, write tests") produced tests that passed and killed nothing — nothing in
// it forced the model to discriminate any particular mutation. This prompt is built
// the other way round: every target is listed with its exact replacement, the model is
// told a test only counts if it FAILS on that replacement, and it is asked to say
// which target each test case is for. Verification is unchanged and unforgiving — a
// mutation run decides what actually died, so a batch that overreaches simply scores
// what it earned.
//
// The economics are the point. One target per attempt costs a model call, a scoped
// test run and a mutation check for a single mutant; the same cycle spent on eight is
// the difference between a file taking hours and taking minutes.
//
// Written per SITE, not per mutant. Stryker gives location.start.{line,column} for
// every mutation, so `>` becoming `>=`, `<` and `==` are three mutants of ONE condition
// and a single boundary test kills all three. Each site carries the name the test must
// have — `kills <line>:<column>` — because that name is what lets the next run ask "is
// there already a test for this?" and skip the site without spending a token. On a file
// with a thousand mutants that filter is the difference between minutes and hours.
//
// @param t     response of "Next Mutant": `groups` (sites) or `targets` (flat mutants)
// @param opts  { thinking } — the sweep runs cold like the single attempt
export function killBuildBatchPrompt(t, opts) {
  if (stryMutAct_9fa48("365")) {
    {}
  } else {
    stryCov_9fa48("365");
    const o = stryMutAct_9fa48("368") ? opts && {} : stryMutAct_9fa48("367") ? false : stryMutAct_9fa48("366") ? true : (stryCov_9fa48("366", "367", "368"), opts || {});
    // groups are the shape the sweep uses; a flat list still works for the batch path
    const groups = (stryMutAct_9fa48("371") ? t.groups || t.groups.length : stryMutAct_9fa48("370") ? false : stryMutAct_9fa48("369") ? true : (stryCov_9fa48("369", "370", "371"), t.groups && t.groups.length)) ? stryMutAct_9fa48("372") ? t.groups : (stryCov_9fa48("372"), t.groups.slice(0, 12)) : stryMutAct_9fa48("373") ? (t.targets || []).map(m => ({
      name: `kills ${m.line}:${m.column ?? 0}`,
      line: m.line,
      column: m.column ?? 0,
      mutants: [m]
    })) : (stryCov_9fa48("373"), (stryMutAct_9fa48("376") ? t.targets && [] : stryMutAct_9fa48("375") ? false : stryMutAct_9fa48("374") ? true : (stryCov_9fa48("374", "375", "376"), t.targets || (stryMutAct_9fa48("377") ? ["Stryker was here"] : (stryCov_9fa48("377"), [])))).slice(0, 8).map(stryMutAct_9fa48("378") ? () => undefined : (stryCov_9fa48("378"), m => stryMutAct_9fa48("379") ? {} : (stryCov_9fa48("379"), {
      name: stryMutAct_9fa48("380") ? `` : (stryCov_9fa48("380"), `kills ${m.line}:${stryMutAct_9fa48("381") ? m.column && 0 : (stryCov_9fa48("381"), m.column ?? 0)}`),
      line: m.line,
      column: stryMutAct_9fa48("382") ? m.column && 0 : (stryCov_9fa48("382"), m.column ?? 0),
      mutants: stryMutAct_9fa48("383") ? [] : (stryCov_9fa48("383"), [m])
    }))));
    const targets = groups.flatMap(stryMutAct_9fa48("384") ? () => undefined : (stryCov_9fa48("384"), g => g.mutants));
    const file = t.path;
    const ext = (stryMutAct_9fa48("387") ? file.match(/\.[cm]?[jt]sx?$/) && ['.ts'] : stryMutAct_9fa48("386") ? false : stryMutAct_9fa48("385") ? true : (stryCov_9fa48("385", "386", "387"), file.match(stryMutAct_9fa48("392") ? /\.[cm]?[jt]sx$/ : stryMutAct_9fa48("391") ? /\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("390") ? /\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("389") ? /\.[cm][jt]sx?$/ : stryMutAct_9fa48("388") ? /\.[cm]?[jt]sx?/ : (stryCov_9fa48("388", "389", "390", "391", "392"), /\.[cm]?[jt]sx?$/)) || (stryMutAct_9fa48("393") ? [] : (stryCov_9fa48("393"), [stryMutAct_9fa48("394") ? "" : (stryCov_9fa48("394"), '.ts')]))))[0];
    const base = t.testPath.replace(stryMutAct_9fa48("399") ? /\.(test|spec)\.[cm]?[jt]sx$/ : stryMutAct_9fa48("398") ? /\.(test|spec)\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("397") ? /\.(test|spec)\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("396") ? /\.(test|spec)\.[cm][jt]sx?$/ : stryMutAct_9fa48("395") ? /\.(test|spec)\.[cm]?[jt]sx?/ : (stryCov_9fa48("395", "396", "397", "398", "399"), /\.(test|spec)\.[cm]?[jt]sx?$/), stryMutAct_9fa48("400") ? "Stryker was here!" : (stryCov_9fa48("400"), '')).replace(stryMutAct_9fa48("405") ? /\.[cm]?[jt]sx$/ : stryMutAct_9fa48("404") ? /\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("403") ? /\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("402") ? /\.[cm][jt]sx?$/ : stryMutAct_9fa48("401") ? /\.[cm]?[jt]sx?/ : (stryCov_9fa48("401", "402", "403", "404", "405"), /\.[cm]?[jt]sx?$/), stryMutAct_9fa48("406") ? "Stryker was here!" : (stryCov_9fa48("406"), ''));
    const hash = str => {
      if (stryMutAct_9fa48("407")) {
        {}
      } else {
        stryCov_9fa48("407");
        let x = 5381;
        for (let i = 0; stryMutAct_9fa48("410") ? i >= str.length : stryMutAct_9fa48("409") ? i <= str.length : stryMutAct_9fa48("408") ? false : (stryCov_9fa48("408", "409", "410"), i < str.length); stryMutAct_9fa48("411") ? i-- : (stryCov_9fa48("411"), i++)) x = ((stryMutAct_9fa48("412") ? x / 33 : (stryCov_9fa48("412"), x * 33)) ^ str.charCodeAt(i)) >>> 0;
        return x.toString(36);
      }
    };
    // named for the batch, not for one victim: a batch file is dropped or kept whole
    const tag = hash(groups.map(stryMutAct_9fa48("413") ? () => undefined : (stryCov_9fa48("413"), g => g.name)).join(stryMutAct_9fa48("414") ? "" : (stryCov_9fa48("414"), ';')));
    const targetPath = base + (stryMutAct_9fa48("415") ? "" : (stryCov_9fa48("415"), '.kill-batch-')) + tag + (stryMutAct_9fa48("416") ? "" : (stryCov_9fa48("416"), '.test')) + ext;
    const gaps = stryMutAct_9fa48("417") ? {} : (stryCov_9fa48("417"), {
      ui: t.ui,
      source: t.source,
      runner: t.runner,
      constraints: t.constraints
    });
    const ui = uiGuidance(file, gaps);
    const constraints = (stryMutAct_9fa48("420") ? t.constraints && [] : stryMutAct_9fa48("419") ? false : stryMutAct_9fa48("418") ? true : (stryCov_9fa48("418", "419", "420"), t.constraints || (stryMutAct_9fa48("421") ? ["Stryker was here"] : (stryCov_9fa48("421"), [])))).map(stryMutAct_9fa48("422") ? () => undefined : (stryCov_9fa48("422"), c => (stryMutAct_9fa48("423") ? "" : (stryCov_9fa48("423"), '- ')) + c)).join(stryMutAct_9fa48("424") ? "" : (stryCov_9fa48("424"), '\n'));
    const list = groups.map(g => {
      if (stryMutAct_9fa48("425")) {
        {}
      } else {
        stryCov_9fa48("425");
        const status = (stryMutAct_9fa48("426") ? g.mutants.some(m => String(m.status ?? '').toLowerCase() === 'nocoverage') : (stryCov_9fa48("426"), g.mutants.every(stryMutAct_9fa48("427") ? () => undefined : (stryCov_9fa48("427"), m => stryMutAct_9fa48("430") ? String(m.status ?? '').toLowerCase() !== 'nocoverage' : stryMutAct_9fa48("429") ? false : stryMutAct_9fa48("428") ? true : (stryCov_9fa48("428", "429", "430"), (stryMutAct_9fa48("431") ? String(m.status ?? '').toUpperCase() : (stryCov_9fa48("431"), String(stryMutAct_9fa48("432") ? m.status && '' : (stryCov_9fa48("432"), m.status ?? (stryMutAct_9fa48("433") ? "Stryker was here!" : (stryCov_9fa48("433"), '')))).toLowerCase())) === (stryMutAct_9fa48("434") ? "" : (stryCov_9fa48("434"), 'nocoverage'))))))) ? stryMutAct_9fa48("435") ? "" : (stryCov_9fa48("435"), 'not covered at all — this test must reach the code first') : stryMutAct_9fa48("436") ? "" : (stryCov_9fa48("436"), 'covered by existing tests, but nothing asserts the difference');
        const variants = g.mutants.map(stryMutAct_9fa48("437") ? () => undefined : (stryCov_9fa48("437"), m => (stryMutAct_9fa48("438") ? `` : (stryCov_9fa48("438"), `      - ${m.mutator}: the code becomes `)) + (stryMutAct_9fa48("439") ? `` : (stryCov_9fa48("439"), `${stryMutAct_9fa48("440") ? JSON.stringify(String(m.replacement ?? '')) : (stryCov_9fa48("440"), JSON.stringify(String(stryMutAct_9fa48("441") ? m.replacement && '' : (stryCov_9fa48("441"), m.replacement ?? (stryMutAct_9fa48("442") ? "Stryker was here!" : (stryCov_9fa48("442"), ''))))).slice(0, 200))}`)))).join(stryMutAct_9fa48("443") ? "" : (stryCov_9fa48("443"), '\n'));
        return (stryMutAct_9fa48("444") ? `` : (stryCov_9fa48("444"), `  "${g.name}"  (line ${g.line}, column ${g.column}) — ${g.mutants.length} mutation(s), `)) + (stryMutAct_9fa48("445") ? `` : (stryCov_9fa48("445"), `${status}\n${variants}`));
      }
    }).join(stryMutAct_9fa48("446") ? "" : (stryCov_9fa48("446"), '\n\n'));
    const system = stryMutAct_9fa48("447") ? 'You are an expert test engineer. Write EXACTLY ONE ' + t.runner + ' test file containing one test ' + 'case per SITE listed below. Each site is one place in the source that several mutations attack, and one sharp ' + 'test case can kill all of them at once — a boundary test kills >, < and == on the same condition. A mutation is ' + 'killed when the test FAILS on the mutated code while PASSING on the real code, so assert the precise value or ' + 'behaviour every listed mutation would change. Name each test case with EXACTLY THE NAME GIVEN for its site, ' + 'optionally followed by a short description — for example it("kills 8:7 — returns \'small\' at the boundary"). ' + 'That name is how the site is recognised later, so it must appear verbatim. Do not write tests for anything not ' + 'listed. Reply ONLY with JSON: {"tests":[{"path":"' + targetPath + '","content":"full test file content"}]}. Rules:' + commonTestRules(1) + ui - (constraints ? '\nTeam constraints:\n' + constraints : '') : (stryCov_9fa48("447"), (stryMutAct_9fa48("448") ? 'You are an expert test engineer. Write EXACTLY ONE ' + t.runner + ' test file containing one test ' + 'case per SITE listed below. Each site is one place in the source that several mutations attack, and one sharp ' + 'test case can kill all of them at once — a boundary test kills >, < and == on the same condition. A mutation is ' + 'killed when the test FAILS on the mutated code while PASSING on the real code, so assert the precise value or ' + 'behaviour every listed mutation would change. Name each test case with EXACTLY THE NAME GIVEN for its site, ' + 'optionally followed by a short description — for example it("kills 8:7 — returns \'small\' at the boundary"). ' + 'That name is how the site is recognised later, so it must appear verbatim. Do not write tests for anything not ' + 'listed. Reply ONLY with JSON: {"tests":[{"path":"' + targetPath + '","content":"full test file content"}]}. Rules:' + commonTestRules(1) - ui : (stryCov_9fa48("448"), (stryMutAct_9fa48("449") ? "" : (stryCov_9fa48("449"), 'You are an expert test engineer. Write EXACTLY ONE ')) + t.runner + (stryMutAct_9fa48("450") ? "" : (stryCov_9fa48("450"), ' test file containing one test ')) + (stryMutAct_9fa48("451") ? "" : (stryCov_9fa48("451"), 'case per SITE listed below. Each site is one place in the source that several mutations attack, and one sharp ')) + (stryMutAct_9fa48("452") ? "" : (stryCov_9fa48("452"), 'test case can kill all of them at once — a boundary test kills >, < and == on the same condition. A mutation is ')) + (stryMutAct_9fa48("453") ? "" : (stryCov_9fa48("453"), 'killed when the test FAILS on the mutated code while PASSING on the real code, so assert the precise value or ')) + (stryMutAct_9fa48("454") ? "" : (stryCov_9fa48("454"), 'behaviour every listed mutation would change. Name each test case with EXACTLY THE NAME GIVEN for its site, ')) + (stryMutAct_9fa48("455") ? "" : (stryCov_9fa48("455"), 'optionally followed by a short description — for example it("kills 8:7 — returns \'small\' at the boundary"). ')) + (stryMutAct_9fa48("456") ? "" : (stryCov_9fa48("456"), 'That name is how the site is recognised later, so it must appear verbatim. Do not write tests for anything not ')) + (stryMutAct_9fa48("457") ? "" : (stryCov_9fa48("457"), 'listed. Reply ONLY with JSON: {"tests":[{"path":"')) + targetPath + (stryMutAct_9fa48("458") ? "" : (stryCov_9fa48("458"), '","content":"full test file content"}]}. Rules:')) + commonTestRules(1) + ui)) + (constraints ? (stryMutAct_9fa48("459") ? "" : (stryCov_9fa48("459"), '\nTeam constraints:\n')) + constraints : stryMutAct_9fa48("460") ? "Stryker was here!" : (stryCov_9fa48("460"), '')));
    const prompt = (stryMutAct_9fa48("461") ? "" : (stryCov_9fa48("461"), 'SOURCE FILE: ')) + file + (stryMutAct_9fa48("462") ? "" : (stryCov_9fa48("462"), ' (package: ')) + t.packageJson + (stryMutAct_9fa48("463") ? "" : (stryCov_9fa48("463"), ')\n')) + (stryMutAct_9fa48("464") ? String(t.source || '') : (stryCov_9fa48("464"), String(stryMutAct_9fa48("467") ? t.source && '' : stryMutAct_9fa48("466") ? false : stryMutAct_9fa48("465") ? true : (stryCov_9fa48("465", "466", "467"), t.source || (stryMutAct_9fa48("468") ? "Stryker was here!" : (stryCov_9fa48("468"), '')))).slice(0, 12000))) + (stryMutAct_9fa48("469") ? "" : (stryCov_9fa48("469"), '\n\nSITES — one test case each, named exactly as shown:\n')) + list + (stryMutAct_9fa48("470") ? "" : (stryCov_9fa48("470"), '\n')) + (stryMutAct_9fa48("471") ? "" : (stryCov_9fa48("471"), '\nEXISTING TEST FILE (')) + t.testPath + (stryMutAct_9fa48("472") ? "" : (stryCov_9fa48("472"), ', style reference — do not rewrite it):\n')) + (stryMutAct_9fa48("473") ? String(t.existingTest || '(none)') : (stryCov_9fa48("473"), String(stryMutAct_9fa48("476") ? t.existingTest && '(none)' : stryMutAct_9fa48("475") ? false : stryMutAct_9fa48("474") ? true : (stryCov_9fa48("474", "475", "476"), t.existingTest || (stryMutAct_9fa48("477") ? "" : (stryCov_9fa48("477"), '(none)')))).slice(0, 4000))) + (stryMutAct_9fa48("478") ? "" : (stryCov_9fa48("478"), '\n\nWrite the single test file. JSON only.'));
    return stryMutAct_9fa48("479") ? {} : (stryCov_9fa48("479"), {
      system,
      prompt,
      json: stryMutAct_9fa48("480") ? false : (stryCov_9fa48("480"), true),
      maxTokens: 9000,
      temperature: 0.2,
      thinking: o.thinking,
      stage: stryMutAct_9fa48("481") ? "" : (stryCov_9fa48("481"), 'improving_mutation'),
      stageDetail: (stryMutAct_9fa48("482") ? `` : (stryCov_9fa48("482"), `writing ${groups.length} test(s) for ${targets.length} mutants`)) + ((stryMutAct_9fa48("485") ? o.thinking !== false : stryMutAct_9fa48("484") ? false : stryMutAct_9fa48("483") ? true : (stryCov_9fa48("483", "484", "485"), o.thinking === (stryMutAct_9fa48("486") ? true : (stryCov_9fa48("486"), false)))) ? stryMutAct_9fa48("487") ? "" : (stryCov_9fa48("487"), ' (fast attempt, without reasoning)') : stryMutAct_9fa48("488") ? "Stryker was here!" : (stryCov_9fa48("488"), '')),
      targetPath,
      existingTestPath: t.testPath,
      existingTestExists: stryMutAct_9fa48("489") ? !t.testExists : (stryCov_9fa48("489"), !(stryMutAct_9fa48("490") ? t.testExists : (stryCov_9fa48("490"), !t.testExists))),
      targetCount: targets.length,
      siteCount: groups.length,
      siteNames: groups.map(stryMutAct_9fa48("491") ? () => undefined : (stryCov_9fa48("491"), g => g.name)),
      // What this prompt ACTUALLY attacked. /api/mutant/next offers two work lists —
      // `groups` (sites from the durable queue, what we write tests for) and `targets`
      // (the picker's ranked shortlist) — and verification used to be handed the second
      // one. Charging a failed attempt to a mutant no test was written for spends the
      // single shot it gets, so those mutants left the shortlist unattacked and the
      // file's mutation loop ended early with sites still pending.
      aimed: targets.map(stryMutAct_9fa48("492") ? () => undefined : (stryCov_9fa48("492"), m => stryMutAct_9fa48("493") ? {} : (stryCov_9fa48("493"), {
        mutator: m.mutator,
        line: m.line,
        column: stryMutAct_9fa48("494") ? m.column && 0 : (stryCov_9fa48("494"), m.column ?? 0),
        endLine: m.endLine,
        replacement: m.replacement,
        id: m.id,
        status: m.status
      })))
    });
  }
}