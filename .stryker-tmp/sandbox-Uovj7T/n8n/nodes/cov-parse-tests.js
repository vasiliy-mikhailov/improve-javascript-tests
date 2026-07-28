// @ts-nocheck
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
export function covParseTests(resp, plan) {
  if (stryMutAct_9fa48("288")) {
    {}
  } else {
    stryCov_9fa48("288");
    let tests = (stryMutAct_9fa48("291") ? resp.ok && resp.json || Array.isArray(resp.json.tests) : stryMutAct_9fa48("290") ? false : stryMutAct_9fa48("289") ? true : (stryCov_9fa48("289", "290", "291"), (stryMutAct_9fa48("293") ? resp.ok || resp.json : stryMutAct_9fa48("292") ? true : (stryCov_9fa48("292", "293"), resp.ok && resp.json)) && Array.isArray(resp.json.tests))) ? resp.json.tests : stryMutAct_9fa48("294") ? ["Stryker was here"] : (stryCov_9fa48("294"), []);
    tests = stryMutAct_9fa48("297") ? tests.slice(0, 2).map((t, i) => {
      let p = (typeof t.path === 'string' ? t.path : '').replace(/^\.?\//, '');
      const safe = /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/.test(p) && /\.[cm]?[jt]sx?$/.test(p) && !p.includes('..');
      const collides = p === plan.existingTestPath && plan.existingTestExists;
      if (!safe || collides) p = i === 0 ? plan.targetPath : plan.targetPath.replace('.test.', '-' + i + '.test.');
      return {
        path: p,
        content: t.content
      };
    }).filter((t, i, all) => all.findIndex(o => o.path === t.path) === i) : stryMutAct_9fa48("296") ? tests.filter(t => t && typeof t.content === 'string' && t.content.trim().length > 10).map((t, i) => {
      let p = (typeof t.path === 'string' ? t.path : '').replace(/^\.?\//, '');
      const safe = /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/.test(p) && /\.[cm]?[jt]sx?$/.test(p) && !p.includes('..');
      const collides = p === plan.existingTestPath && plan.existingTestExists;
      if (!safe || collides) p = i === 0 ? plan.targetPath : plan.targetPath.replace('.test.', '-' + i + '.test.');
      return {
        path: p,
        content: t.content
      };
    }).filter((t, i, all) => all.findIndex(o => o.path === t.path) === i) : stryMutAct_9fa48("295") ? tests.filter(t => t && typeof t.content === 'string' && t.content.trim().length > 10).slice(0, 2).map((t, i) => {
      let p = (typeof t.path === 'string' ? t.path : '').replace(/^\.?\//, '');
      const safe = /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/.test(p) && /\.[cm]?[jt]sx?$/.test(p) && !p.includes('..');
      const collides = p === plan.existingTestPath && plan.existingTestExists;
      if (!safe || collides) p = i === 0 ? plan.targetPath : plan.targetPath.replace('.test.', '-' + i + '.test.');
      return {
        path: p,
        content: t.content
      };
    }) : (stryCov_9fa48("295", "296", "297"), tests.filter(stryMutAct_9fa48("298") ? () => undefined : (stryCov_9fa48("298"), t => stryMutAct_9fa48("301") ? t && typeof t.content === 'string' || t.content.trim().length > 10 : stryMutAct_9fa48("300") ? false : stryMutAct_9fa48("299") ? true : (stryCov_9fa48("299", "300", "301"), (stryMutAct_9fa48("303") ? t || typeof t.content === 'string' : stryMutAct_9fa48("302") ? true : (stryCov_9fa48("302", "303"), t && (stryMutAct_9fa48("305") ? typeof t.content !== 'string' : stryMutAct_9fa48("304") ? true : (stryCov_9fa48("304", "305"), typeof t.content === (stryMutAct_9fa48("306") ? "" : (stryCov_9fa48("306"), 'string')))))) && (stryMutAct_9fa48("309") ? t.content.trim().length <= 10 : stryMutAct_9fa48("308") ? t.content.trim().length >= 10 : stryMutAct_9fa48("307") ? true : (stryCov_9fa48("307", "308", "309"), (stryMutAct_9fa48("310") ? t.content.length : (stryCov_9fa48("310"), t.content.trim().length)) > 10))))).slice(0, 2).map((t, i) => {
      if (stryMutAct_9fa48("311")) {
        {}
      } else {
        stryCov_9fa48("311");
        let p = ((stryMutAct_9fa48("314") ? typeof t.path !== 'string' : stryMutAct_9fa48("313") ? false : stryMutAct_9fa48("312") ? true : (stryCov_9fa48("312", "313", "314"), typeof t.path === (stryMutAct_9fa48("315") ? "" : (stryCov_9fa48("315"), 'string')))) ? t.path : stryMutAct_9fa48("316") ? "Stryker was here!" : (stryCov_9fa48("316"), '')).replace(stryMutAct_9fa48("318") ? /^\.\// : stryMutAct_9fa48("317") ? /\.?\// : (stryCov_9fa48("317", "318"), /^\.?\//), stryMutAct_9fa48("319") ? "Stryker was here!" : (stryCov_9fa48("319"), ''));
        const safe = stryMutAct_9fa48("322") ? /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/.test(p) && /\.[cm]?[jt]sx?$/.test(p) || !p.includes('..') : stryMutAct_9fa48("321") ? false : stryMutAct_9fa48("320") ? true : (stryCov_9fa48("320", "321", "322"), (stryMutAct_9fa48("324") ? /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/.test(p) || /\.[cm]?[jt]sx?$/.test(p) : stryMutAct_9fa48("323") ? true : (stryCov_9fa48("323", "324"), (stryMutAct_9fa48("331") ? /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx$)/ : stryMutAct_9fa48("330") ? /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[^jt]sx?$)/ : stryMutAct_9fa48("329") ? /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[^cm]?[jt]sx?$)/ : stryMutAct_9fa48("328") ? /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm][jt]sx?$)/ : stryMutAct_9fa48("327") ? /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?)/ : stryMutAct_9fa48("326") ? /((^|\/)(tests|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/ : stryMutAct_9fa48("325") ? /((\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/ : (stryCov_9fa48("325", "326", "327", "328", "329", "330", "331"), /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/)).test(p) && (stryMutAct_9fa48("336") ? /\.[cm]?[jt]sx$/ : stryMutAct_9fa48("335") ? /\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("334") ? /\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("333") ? /\.[cm][jt]sx?$/ : stryMutAct_9fa48("332") ? /\.[cm]?[jt]sx?/ : (stryCov_9fa48("332", "333", "334", "335", "336"), /\.[cm]?[jt]sx?$/)).test(p))) && (stryMutAct_9fa48("337") ? p.includes('..') : (stryCov_9fa48("337"), !p.includes(stryMutAct_9fa48("338") ? "" : (stryCov_9fa48("338"), '..')))));
        const collides = stryMutAct_9fa48("341") ? p === plan.existingTestPath || plan.existingTestExists : stryMutAct_9fa48("340") ? false : stryMutAct_9fa48("339") ? true : (stryCov_9fa48("339", "340", "341"), (stryMutAct_9fa48("343") ? p !== plan.existingTestPath : stryMutAct_9fa48("342") ? true : (stryCov_9fa48("342", "343"), p === plan.existingTestPath)) && plan.existingTestExists);
        if (stryMutAct_9fa48("346") ? !safe && collides : stryMutAct_9fa48("345") ? false : stryMutAct_9fa48("344") ? true : (stryCov_9fa48("344", "345", "346"), (stryMutAct_9fa48("347") ? safe : (stryCov_9fa48("347"), !safe)) || collides)) p = (stryMutAct_9fa48("350") ? i !== 0 : stryMutAct_9fa48("349") ? false : stryMutAct_9fa48("348") ? true : (stryCov_9fa48("348", "349", "350"), i === 0)) ? plan.targetPath : plan.targetPath.replace(stryMutAct_9fa48("351") ? "" : (stryCov_9fa48("351"), '.test.'), (stryMutAct_9fa48("352") ? "" : (stryCov_9fa48("352"), '-')) + i + (stryMutAct_9fa48("353") ? "" : (stryCov_9fa48("353"), '.test.')));
        return stryMutAct_9fa48("354") ? {} : (stryCov_9fa48("354"), {
          path: p,
          content: t.content
        });
      }
    }).filter(stryMutAct_9fa48("355") ? () => undefined : (stryCov_9fa48("355"), (t, i, all) => stryMutAct_9fa48("358") ? all.findIndex(o => o.path === t.path) !== i : stryMutAct_9fa48("357") ? false : stryMutAct_9fa48("356") ? true : (stryCov_9fa48("356", "357", "358"), all.findIndex(stryMutAct_9fa48("359") ? () => undefined : (stryCov_9fa48("359"), o => stryMutAct_9fa48("362") ? o.path !== t.path : stryMutAct_9fa48("361") ? false : stryMutAct_9fa48("360") ? true : (stryCov_9fa48("360", "361", "362"), o.path === t.path))) === i))));
    return stryMutAct_9fa48("363") ? {} : (stryCov_9fa48("363"), {
      tests,
      paths: tests.map(stryMutAct_9fa48("364") ? () => undefined : (stryCov_9fa48("364"), t => t.path)),
      count: tests.length
    });
  }
}