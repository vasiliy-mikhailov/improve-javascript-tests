// @ts-nocheck
'use strict';

// Coverage: run vitest/jest with istanbul json reporters, parse per-file line coverage.
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
const fs = require('node:fs');
const path = require('node:path');
const {
  run
} = require('./exec');
const {
  state,
  event,
  upsertFile
} = require('./state');
const {
  repoDir
} = require('./repo');
const {
  round2
} = require('./util');
function npx(dir, args) {
  if (stryMutAct_9fa48("819")) {
    {}
  } else {
    stryCov_9fa48("819");
    return run(stryMutAct_9fa48("820") ? [] : (stryCov_9fa48("820"), [stryMutAct_9fa48("821") ? "" : (stryCov_9fa48("821"), 'npx'), stryMutAct_9fa48("822") ? "" : (stryCov_9fa48("822"), '--no-install'), ...args]), stryMutAct_9fa48("823") ? {} : (stryCov_9fa48("823"), {
      cwd: dir,
      timeoutMs: 1800000,
      label: args[0]
    }));
  }
}
async function runCoverage() {
  if (stryMutAct_9fa48("824")) {
    {}
  } else {
    stryCov_9fa48("824");
    const dir = repoDir();
    const runner = stryMutAct_9fa48("825") ? state.runner.testRunner : (stryCov_9fa48("825"), state.runner?.testRunner);
    if (stryMutAct_9fa48("828") ? false : stryMutAct_9fa48("827") ? true : stryMutAct_9fa48("826") ? runner : (stryCov_9fa48("826", "827", "828"), !runner)) throw new Error(stryMutAct_9fa48("829") ? "" : (stryCov_9fa48("829"), 'runner not detected — call /api/repo/prepare first'));
    let r;
    if (stryMutAct_9fa48("832") ? runner !== 'vitest' : stryMutAct_9fa48("831") ? false : stryMutAct_9fa48("830") ? true : (stryCov_9fa48("830", "831", "832"), runner === (stryMutAct_9fa48("833") ? "" : (stryCov_9fa48("833"), 'vitest')))) {
      if (stryMutAct_9fa48("834")) {
        {}
      } else {
        stryCov_9fa48("834");
        r = await npx(dir, stryMutAct_9fa48("835") ? [] : (stryCov_9fa48("835"), [stryMutAct_9fa48("836") ? "" : (stryCov_9fa48("836"), 'vitest'), stryMutAct_9fa48("837") ? "" : (stryCov_9fa48("837"), 'run'), stryMutAct_9fa48("838") ? "" : (stryCov_9fa48("838"), '--coverage.enabled'), stryMutAct_9fa48("839") ? "" : (stryCov_9fa48("839"), '--coverage.provider=v8'), stryMutAct_9fa48("840") ? "" : (stryCov_9fa48("840"), '--coverage.reporter=json-summary'), stryMutAct_9fa48("841") ? "" : (stryCov_9fa48("841"), '--coverage.reporter=json'), stryMutAct_9fa48("842") ? "" : (stryCov_9fa48("842"), '--coverage.reportsDirectory=coverage'), stryMutAct_9fa48("843") ? "" : (stryCov_9fa48("843"), '--passWithNoTests')]));
      }
    } else {
      if (stryMutAct_9fa48("844")) {
        {}
      } else {
        stryCov_9fa48("844");
        r = await npx(dir, stryMutAct_9fa48("845") ? [] : (stryCov_9fa48("845"), [stryMutAct_9fa48("846") ? "" : (stryCov_9fa48("846"), 'jest'), stryMutAct_9fa48("847") ? "" : (stryCov_9fa48("847"), '--coverage'), stryMutAct_9fa48("848") ? "" : (stryCov_9fa48("848"), '--coverageReporters=json-summary'), stryMutAct_9fa48("849") ? "" : (stryCov_9fa48("849"), '--coverageReporters=json'), stryMutAct_9fa48("850") ? "" : (stryCov_9fa48("850"), '--coverageDirectory=coverage'), stryMutAct_9fa48("851") ? "" : (stryCov_9fa48("851"), '--silent'), stryMutAct_9fa48("852") ? "" : (stryCov_9fa48("852"), '--passWithNoTests'), stryMutAct_9fa48("853") ? "" : (stryCov_9fa48("853"), '--ci')]));
      }
    }
    const summaryPath = path.join(dir, stryMutAct_9fa48("854") ? "" : (stryCov_9fa48("854"), 'coverage'), stryMutAct_9fa48("855") ? "" : (stryCov_9fa48("855"), 'coverage-summary.json'));
    if (stryMutAct_9fa48("858") ? false : stryMutAct_9fa48("857") ? true : stryMutAct_9fa48("856") ? fs.existsSync(summaryPath) : (stryCov_9fa48("856", "857", "858"), !fs.existsSync(summaryPath))) {
      if (stryMutAct_9fa48("859")) {
        {}
      } else {
        stryCov_9fa48("859");
        throw new Error((stryMutAct_9fa48("860") ? `` : (stryCov_9fa48("860"), `coverage run produced no summary (exit ${r.code}): `)) + (stryMutAct_9fa48("861") ? r.stderr || r.stdout : (stryCov_9fa48("861"), (stryMutAct_9fa48("864") ? r.stderr && r.stdout : stryMutAct_9fa48("863") ? false : stryMutAct_9fa48("862") ? true : (stryCov_9fa48("862", "863", "864"), r.stderr || r.stdout)).slice(stryMutAct_9fa48("865") ? +600 : (stryCov_9fa48("865"), -600)))));
      }
    }
    const parsed = parseSummary(summaryPath, dir);
    // merge into files table (only scope files already registered keep their entries;
    // still record coverage for files in summary that are in scope table)
    for (const [rel, pct] of Object.entries(parsed.files)) {
      if (stryMutAct_9fa48("866")) {
        {}
      } else {
        stryCov_9fa48("866");
        if (stryMutAct_9fa48("868") ? false : stryMutAct_9fa48("867") ? true : (stryCov_9fa48("867", "868"), state.files[rel])) upsertFile(rel, stryMutAct_9fa48("869") ? {} : (stryCov_9fa48("869"), {
          coverage: pct
        }));
      }
    }
    // scope files absent from the summary were never loaded → 0 % covered
    for (const rel of Object.keys(state.files)) {
      if (stryMutAct_9fa48("870")) {
        {}
      } else {
        stryCov_9fa48("870");
        if (stryMutAct_9fa48("873") ? parsed.files[rel] === undefined || state.files[rel].coverage == null : stryMutAct_9fa48("872") ? false : stryMutAct_9fa48("871") ? true : (stryCov_9fa48("871", "872", "873"), (stryMutAct_9fa48("875") ? parsed.files[rel] !== undefined : stryMutAct_9fa48("874") ? true : (stryCov_9fa48("874", "875"), parsed.files[rel] === undefined)) && (stryMutAct_9fa48("877") ? state.files[rel].coverage != null : stryMutAct_9fa48("876") ? true : (stryCov_9fa48("876", "877"), state.files[rel].coverage == null)))) {
          if (stryMutAct_9fa48("878")) {
            {}
          } else {
            stryCov_9fa48("878");
            upsertFile(rel, stryMutAct_9fa48("879") ? {} : (stryCov_9fa48("879"), {
              coverage: 0
            }));
          }
        }
      }
    }
    event(stryMutAct_9fa48("880") ? "" : (stryCov_9fa48("880"), 'coverage'), stryMutAct_9fa48("881") ? `` : (stryCov_9fa48("881"), `total line coverage ${parsed.totalPct}% (suite exit ${r.code})`));
    return stryMutAct_9fa48("882") ? {} : (stryCov_9fa48("882"), {
      totalPct: parsed.totalPct,
      files: parsed.files,
      exitCode: r.code
    });
  }
}
function parseSummary(summaryPath, dir) {
  if (stryMutAct_9fa48("883")) {
    {}
  } else {
    stryCov_9fa48("883");
    const summary = JSON.parse(fs.readFileSync(summaryPath, stryMutAct_9fa48("884") ? "" : (stryCov_9fa48("884"), 'utf8')));
    const files = {};
    let totalPct = stryMutAct_9fa48("885") ? summary.total?.lines?.pct && 0 : (stryCov_9fa48("885"), (stryMutAct_9fa48("887") ? summary.total.lines?.pct : stryMutAct_9fa48("886") ? summary.total?.lines.pct : (stryCov_9fa48("886", "887"), summary.total?.lines?.pct)) ?? 0);
    if (stryMutAct_9fa48("890") ? typeof totalPct === 'number' : stryMutAct_9fa48("889") ? false : stryMutAct_9fa48("888") ? true : (stryCov_9fa48("888", "889", "890"), typeof totalPct !== (stryMutAct_9fa48("891") ? "" : (stryCov_9fa48("891"), 'number')))) totalPct = 0;
    for (const [abs, data] of Object.entries(summary)) {
      if (stryMutAct_9fa48("892")) {
        {}
      } else {
        stryCov_9fa48("892");
        if (stryMutAct_9fa48("895") ? abs !== 'total' : stryMutAct_9fa48("894") ? false : stryMutAct_9fa48("893") ? true : (stryCov_9fa48("893", "894", "895"), abs === (stryMutAct_9fa48("896") ? "" : (stryCov_9fa48("896"), 'total')))) continue;
        const pct = stryMutAct_9fa48("897") ? data.lines.pct : (stryCov_9fa48("897"), data.lines?.pct);
        if (stryMutAct_9fa48("900") ? typeof pct === 'number' : stryMutAct_9fa48("899") ? false : stryMutAct_9fa48("898") ? true : (stryCov_9fa48("898", "899", "900"), typeof pct !== (stryMutAct_9fa48("901") ? "" : (stryCov_9fa48("901"), 'number')))) continue;
        const rel = path.isAbsolute(abs) ? path.relative(dir, abs) : abs;
        if (stryMutAct_9fa48("904") ? rel.endsWith('..') : stryMutAct_9fa48("903") ? false : stryMutAct_9fa48("902") ? true : (stryCov_9fa48("902", "903", "904"), rel.startsWith(stryMutAct_9fa48("905") ? "" : (stryCov_9fa48("905"), '..')))) continue;
        files[rel.split(path.sep).join(stryMutAct_9fa48("906") ? "" : (stryCov_9fa48("906"), '/'))] = round2(pct);
      }
    }
    return stryMutAct_9fa48("907") ? {} : (stryCov_9fa48("907"), {
      totalPct: round2(totalPct),
      files
    });
  }
}

/** Uncovered line ranges for one file, from istanbul coverage-final.json. */
function uncoveredLines(rel) {
  if (stryMutAct_9fa48("908")) {
    {}
  } else {
    stryCov_9fa48("908");
    const dir = repoDir();
    const finalPath = path.join(dir, stryMutAct_9fa48("909") ? "" : (stryCov_9fa48("909"), 'coverage'), stryMutAct_9fa48("910") ? "" : (stryCov_9fa48("910"), 'coverage-final.json'));
    let cov = {};
    try {
      if (stryMutAct_9fa48("911")) {
        {}
      } else {
        stryCov_9fa48("911");
        cov = JSON.parse(fs.readFileSync(finalPath, stryMutAct_9fa48("912") ? "" : (stryCov_9fa48("912"), 'utf8')));
      }
    } catch {
      if (stryMutAct_9fa48("913")) {
        {}
      } else {
        stryCov_9fa48("913");
        return stryMutAct_9fa48("914") ? {} : (stryCov_9fa48("914"), {
          lines: stryMutAct_9fa48("915") ? ["Stryker was here"] : (stryCov_9fa48("915"), []),
          note: stryMutAct_9fa48("916") ? "" : (stryCov_9fa48("916"), 'no coverage-final.json')
        });
      }
    }
    const abs = path.join(dir, rel);
    const entry = stryMutAct_9fa48("919") ? (cov[abs] || cov[rel]) && Object.entries(cov).find(([k]) => k.endsWith('/' + rel))?.[1] : stryMutAct_9fa48("918") ? false : stryMutAct_9fa48("917") ? true : (stryCov_9fa48("917", "918", "919"), (stryMutAct_9fa48("921") ? cov[abs] && cov[rel] : stryMutAct_9fa48("920") ? false : (stryCov_9fa48("920", "921"), cov[abs] || cov[rel])) || (stryMutAct_9fa48("922") ? Object.entries(cov).find(([k]) => k.endsWith('/' + rel))[1] : (stryCov_9fa48("922"), Object.entries(cov).find(stryMutAct_9fa48("923") ? () => undefined : (stryCov_9fa48("923"), ([k]) => stryMutAct_9fa48("924") ? k.startsWith('/' + rel) : (stryCov_9fa48("924"), k.endsWith((stryMutAct_9fa48("925") ? "" : (stryCov_9fa48("925"), '/')) + rel))))?.[1])));
    if (stryMutAct_9fa48("928") ? false : stryMutAct_9fa48("927") ? true : stryMutAct_9fa48("926") ? entry : (stryCov_9fa48("926", "927", "928"), !entry)) return stryMutAct_9fa48("929") ? {} : (stryCov_9fa48("929"), {
      lines: stryMutAct_9fa48("930") ? "" : (stryCov_9fa48("930"), 'all'),
      note: stryMutAct_9fa48("931") ? "" : (stryCov_9fa48("931"), 'file never loaded by tests — 0% coverage')
    });
    const data = stryMutAct_9fa48("934") ? entry.data && entry : stryMutAct_9fa48("933") ? false : stryMutAct_9fa48("932") ? true : (stryCov_9fa48("932", "933", "934"), entry.data || entry); // some formats nest under .data
    const uncovered = new Set();
    const stmts = stryMutAct_9fa48("937") ? data.statementMap && {} : stryMutAct_9fa48("936") ? false : stryMutAct_9fa48("935") ? true : (stryCov_9fa48("935", "936", "937"), data.statementMap || {});
    const s = stryMutAct_9fa48("940") ? data.s && {} : stryMutAct_9fa48("939") ? false : stryMutAct_9fa48("938") ? true : (stryCov_9fa48("938", "939", "940"), data.s || {});
    for (const [id, loc] of Object.entries(stmts)) {
      if (stryMutAct_9fa48("941")) {
        {}
      } else {
        stryCov_9fa48("941");
        if (stryMutAct_9fa48("944") ? (s[id] || 0) === 0 || loc?.start?.line : stryMutAct_9fa48("943") ? false : stryMutAct_9fa48("942") ? true : (stryCov_9fa48("942", "943", "944"), (stryMutAct_9fa48("946") ? (s[id] || 0) !== 0 : stryMutAct_9fa48("945") ? true : (stryCov_9fa48("945", "946"), (stryMutAct_9fa48("949") ? s[id] && 0 : stryMutAct_9fa48("948") ? false : stryMutAct_9fa48("947") ? true : (stryCov_9fa48("947", "948", "949"), s[id] || 0)) === 0)) && (stryMutAct_9fa48("951") ? loc.start?.line : stryMutAct_9fa48("950") ? loc?.start.line : (stryCov_9fa48("950", "951"), loc?.start?.line)))) {
          if (stryMutAct_9fa48("952")) {
            {}
          } else {
            stryCov_9fa48("952");
            for (let ln = loc.start.line; stryMutAct_9fa48("955") ? ln > Math.min(loc.end?.line || loc.start.line, loc.start.line + 3) : stryMutAct_9fa48("954") ? ln < Math.min(loc.end?.line || loc.start.line, loc.start.line + 3) : stryMutAct_9fa48("953") ? false : (stryCov_9fa48("953", "954", "955"), ln <= (stryMutAct_9fa48("956") ? Math.max(loc.end?.line || loc.start.line, loc.start.line + 3) : (stryCov_9fa48("956"), Math.min(stryMutAct_9fa48("959") ? loc.end?.line && loc.start.line : stryMutAct_9fa48("958") ? false : stryMutAct_9fa48("957") ? true : (stryCov_9fa48("957", "958", "959"), (stryMutAct_9fa48("960") ? loc.end.line : (stryCov_9fa48("960"), loc.end?.line)) || loc.start.line), stryMutAct_9fa48("961") ? loc.start.line - 3 : (stryCov_9fa48("961"), loc.start.line + 3))))); stryMutAct_9fa48("962") ? ln-- : (stryCov_9fa48("962"), ln++)) uncovered.add(ln);
          }
        }
      }
    }
    const fns = stryMutAct_9fa48("965") ? data.fnMap && {} : stryMutAct_9fa48("964") ? false : stryMutAct_9fa48("963") ? true : (stryCov_9fa48("963", "964", "965"), data.fnMap || {});
    const f = stryMutAct_9fa48("968") ? data.f && {} : stryMutAct_9fa48("967") ? false : stryMutAct_9fa48("966") ? true : (stryCov_9fa48("966", "967", "968"), data.f || {});
    const uncoveredFns = stryMutAct_9fa48("969") ? ["Stryker was here"] : (stryCov_9fa48("969"), []);
    for (const [id, fn] of Object.entries(fns)) {
      if (stryMutAct_9fa48("970")) {
        {}
      } else {
        stryCov_9fa48("970");
        if (stryMutAct_9fa48("973") ? (f[id] || 0) !== 0 : stryMutAct_9fa48("972") ? false : stryMutAct_9fa48("971") ? true : (stryCov_9fa48("971", "972", "973"), (stryMutAct_9fa48("976") ? f[id] && 0 : stryMutAct_9fa48("975") ? false : stryMutAct_9fa48("974") ? true : (stryCov_9fa48("974", "975", "976"), f[id] || 0)) === 0)) uncoveredFns.push(stryMutAct_9fa48("977") ? {} : (stryCov_9fa48("977"), {
          name: stryMutAct_9fa48("980") ? fn.name && '(anonymous)' : stryMutAct_9fa48("979") ? false : stryMutAct_9fa48("978") ? true : (stryCov_9fa48("978", "979", "980"), fn.name || (stryMutAct_9fa48("981") ? "" : (stryCov_9fa48("981"), '(anonymous)'))),
          line: stryMutAct_9fa48("984") ? fn.decl?.start?.line && fn.loc?.start?.line : stryMutAct_9fa48("983") ? false : stryMutAct_9fa48("982") ? true : (stryCov_9fa48("982", "983", "984"), (stryMutAct_9fa48("986") ? fn.decl.start?.line : stryMutAct_9fa48("985") ? fn.decl?.start.line : (stryCov_9fa48("985", "986"), fn.decl?.start?.line)) || (stryMutAct_9fa48("988") ? fn.loc.start?.line : stryMutAct_9fa48("987") ? fn.loc?.start.line : (stryCov_9fa48("987", "988"), fn.loc?.start?.line)))
        }));
      }
    }
    const b = stryMutAct_9fa48("991") ? data.b && {} : stryMutAct_9fa48("990") ? false : stryMutAct_9fa48("989") ? true : (stryCov_9fa48("989", "990", "991"), data.b || {});
    const branches = stryMutAct_9fa48("994") ? data.branchMap && {} : stryMutAct_9fa48("993") ? false : stryMutAct_9fa48("992") ? true : (stryCov_9fa48("992", "993", "994"), data.branchMap || {});
    const uncoveredBranches = stryMutAct_9fa48("995") ? ["Stryker was here"] : (stryCov_9fa48("995"), []);
    for (const [id, br] of Object.entries(branches)) {
      if (stryMutAct_9fa48("996")) {
        {}
      } else {
        stryCov_9fa48("996");
        const counts = stryMutAct_9fa48("999") ? b[id] && [] : stryMutAct_9fa48("998") ? false : stryMutAct_9fa48("997") ? true : (stryCov_9fa48("997", "998", "999"), b[id] || (stryMutAct_9fa48("1000") ? ["Stryker was here"] : (stryCov_9fa48("1000"), [])));
        counts.forEach((c, i) => {
          if (stryMutAct_9fa48("1001")) {
            {}
          } else {
            stryCov_9fa48("1001");
            if (stryMutAct_9fa48("1004") ? c !== 0 : stryMutAct_9fa48("1003") ? false : stryMutAct_9fa48("1002") ? true : (stryCov_9fa48("1002", "1003", "1004"), c === 0)) uncoveredBranches.push(stryMutAct_9fa48("1005") ? {} : (stryCov_9fa48("1005"), {
              line: stryMutAct_9fa48("1008") ? br.locations?.[i]?.start?.line && br.loc?.start?.line : stryMutAct_9fa48("1007") ? false : stryMutAct_9fa48("1006") ? true : (stryCov_9fa48("1006", "1007", "1008"), (stryMutAct_9fa48("1011") ? br.locations[i]?.start?.line : stryMutAct_9fa48("1010") ? br.locations?.[i].start?.line : stryMutAct_9fa48("1009") ? br.locations?.[i]?.start.line : (stryCov_9fa48("1009", "1010", "1011"), br.locations?.[i]?.start?.line)) || (stryMutAct_9fa48("1013") ? br.loc.start?.line : stryMutAct_9fa48("1012") ? br.loc?.start.line : (stryCov_9fa48("1012", "1013"), br.loc?.start?.line))),
              type: br.type
            }));
          }
        });
      }
    }
    return stryMutAct_9fa48("1014") ? {} : (stryCov_9fa48("1014"), {
      lines: stryMutAct_9fa48("1016") ? [...uncovered].slice(0, 200) : stryMutAct_9fa48("1015") ? [...uncovered].sort((a, z) => a - z) : (stryCov_9fa48("1015", "1016"), (stryMutAct_9fa48("1017") ? [] : (stryCov_9fa48("1017"), [...uncovered])).sort(stryMutAct_9fa48("1018") ? () => undefined : (stryCov_9fa48("1018"), (a, z) => stryMutAct_9fa48("1019") ? a + z : (stryCov_9fa48("1019"), a - z))).slice(0, 200)),
      functions: stryMutAct_9fa48("1020") ? uncoveredFns : (stryCov_9fa48("1020"), uncoveredFns.slice(0, 50)),
      branches: stryMutAct_9fa48("1021") ? uncoveredBranches : (stryCov_9fa48("1021"), uncoveredBranches.slice(0, 80))
    });
  }
}
module.exports = stryMutAct_9fa48("1022") ? {} : (stryCov_9fa48("1022"), {
  runCoverage,
  uncoveredLines
});