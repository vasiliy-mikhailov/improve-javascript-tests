// @ts-nocheck
'use strict';

// The mutant queue: every survivor of every file, on disk, with the name of the test
// that would kill it and what has happened to it.
//
// It exists because the survivor list used to live inside state.json capped at 100
// entries. On a file with a thousand mutants that discarded nine hundred of them at
// every measurement, and nothing durable remembered which sites had already been tried
// — so a restart re-derived the same work and a large file could never be finished.
//
// Work is taken from here a group at a time. That is not only a memory concern: it is
// what keeps a thousand mutants from ever reaching a prompt at once, and what makes the
// "is there already a test with this name?" filter answerable before any tokens are
// spent.
//
// One JSON Lines file per source file. No database, because the sidecar ships with no
// dependencies and this is a queue with two writers and one reader.
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
  state,
  DATA_DIR
} = require('./state');
const {
  slugify,
  fileSlug
} = require('./util');
const {
  mutantKey,
  testNameFor,
  groupByTestName
} = require('./mutants');
const cache = new Map();
function queuePath(file) {
  if (stryMutAct_9fa48("1359")) {
    {}
  } else {
    stryCov_9fa48("1359");
    const repo = slugify(stryMutAct_9fa48("1362") ? state.run?.config?.repoUrl && 'no-repo' : stryMutAct_9fa48("1361") ? false : stryMutAct_9fa48("1360") ? true : (stryCov_9fa48("1360", "1361", "1362"), (stryMutAct_9fa48("1364") ? state.run.config?.repoUrl : stryMutAct_9fa48("1363") ? state.run?.config.repoUrl : (stryCov_9fa48("1363", "1364"), state.run?.config?.repoUrl)) || (stryMutAct_9fa48("1365") ? "" : (stryCov_9fa48("1365"), 'no-repo'))));
    return path.join(DATA_DIR, stryMutAct_9fa48("1366") ? "" : (stryCov_9fa48("1366"), 'mutants'), repo, fileSlug(file) + (stryMutAct_9fa48("1367") ? "" : (stryCov_9fa48("1367"), '.jsonl')));
  }
}
function load(file) {
  if (stryMutAct_9fa48("1368")) {
    {}
  } else {
    stryCov_9fa48("1368");
    const p = queuePath(file);
    if (stryMutAct_9fa48("1370") ? false : stryMutAct_9fa48("1369") ? true : (stryCov_9fa48("1369", "1370"), cache.has(p))) return cache.get(p);
    const rows = stryMutAct_9fa48("1371") ? ["Stryker was here"] : (stryCov_9fa48("1371"), []);
    try {
      if (stryMutAct_9fa48("1372")) {
        {}
      } else {
        stryCov_9fa48("1372");
        for (const line of fs.readFileSync(p, stryMutAct_9fa48("1373") ? "" : (stryCov_9fa48("1373"), 'utf8')).split(stryMutAct_9fa48("1374") ? "" : (stryCov_9fa48("1374"), '\n'))) {
          if (stryMutAct_9fa48("1375")) {
            {}
          } else {
            stryCov_9fa48("1375");
            if (stryMutAct_9fa48("1378") ? line : stryMutAct_9fa48("1377") ? false : stryMutAct_9fa48("1376") ? true : (stryCov_9fa48("1376", "1377", "1378"), line.trim())) rows.push(JSON.parse(line));
          }
        }
      }
    } catch {/* no queue yet */}
    cache.set(p, rows);
    return rows;
  }
}
function flush(file) {
  if (stryMutAct_9fa48("1379")) {
    {}
  } else {
    stryCov_9fa48("1379");
    const p = queuePath(file);
    fs.mkdirSync(path.dirname(p), stryMutAct_9fa48("1380") ? {} : (stryCov_9fa48("1380"), {
      recursive: stryMutAct_9fa48("1381") ? false : (stryCov_9fa48("1381"), true)
    }));
    fs.writeFileSync(p, (stryMutAct_9fa48("1384") ? cache.get(p) && [] : stryMutAct_9fa48("1383") ? false : stryMutAct_9fa48("1382") ? true : (stryCov_9fa48("1382", "1383", "1384"), cache.get(p) || (stryMutAct_9fa48("1385") ? ["Stryker was here"] : (stryCov_9fa48("1385"), [])))).map(stryMutAct_9fa48("1386") ? () => undefined : (stryCov_9fa48("1386"), r => JSON.stringify(r))).join(stryMutAct_9fa48("1387") ? "" : (stryCov_9fa48("1387"), '\n')) + (stryMutAct_9fa48("1388") ? "" : (stryCov_9fa48("1388"), '\n')));
  }
}

/**
 * Take a fresh survivor list from a mutation run. What is gone has been killed; what
 * remains keeps whatever we already know about it — above all whether a test has been
 * written for its site, because that is what stops the loop retrying it for ever.
 */
function replace(file, survivors) {
  if (stryMutAct_9fa48("1389")) {
    {}
  } else {
    stryCov_9fa48("1389");
    const known = new Map(load(file).map(stryMutAct_9fa48("1390") ? () => undefined : (stryCov_9fa48("1390"), r => stryMutAct_9fa48("1391") ? [] : (stryCov_9fa48("1391"), [r.key, r]))));
    const rows = survivors.map(m => {
      if (stryMutAct_9fa48("1392")) {
        {}
      } else {
        stryCov_9fa48("1392");
        const key = mutantKey(m);
        const prev = known.get(key);
        return stryMutAct_9fa48("1393") ? {} : (stryCov_9fa48("1393"), {
          key,
          name: testNameFor(m),
          mutator: m.mutator,
          line: m.line,
          column: stryMutAct_9fa48("1394") ? m.column && 0 : (stryCov_9fa48("1394"), m.column ?? 0),
          replacement: m.replacement,
          status: m.status,
          written: stryMutAct_9fa48("1397") ? prev?.written && false : stryMutAct_9fa48("1396") ? false : stryMutAct_9fa48("1395") ? true : (stryCov_9fa48("1395", "1396", "1397"), (stryMutAct_9fa48("1398") ? prev.written : (stryCov_9fa48("1398"), prev?.written)) || (stryMutAct_9fa48("1399") ? true : (stryCov_9fa48("1399"), false)))
        });
      }
    });
    cache.set(queuePath(file), rows);
    flush(file);
    return rows.length;
  }
}
const all = stryMutAct_9fa48("1400") ? () => undefined : (stryCov_9fa48("1400"), (() => {
  const all = file => load(file);
  return all;
})());
const alive = stryMutAct_9fa48("1401") ? () => undefined : (stryCov_9fa48("1401"), (() => {
  const alive = file => load(file);
  return alive;
})());
const pending = stryMutAct_9fa48("1402") ? () => undefined : (stryCov_9fa48("1402"), (() => {
  const pending = file => stryMutAct_9fa48("1403") ? load(file) : (stryCov_9fa48("1403"), load(file).filter(stryMutAct_9fa48("1404") ? () => undefined : (stryCov_9fa48("1404"), r => stryMutAct_9fa48("1405") ? r.written : (stryCov_9fa48("1405"), !r.written))));
  return pending;
})());

/** The next N sites worth writing a test for, busiest first, never one already written. */
function nextGroups(file, n = 12) {
  if (stryMutAct_9fa48("1406")) {
    {}
  } else {
    stryCov_9fa48("1406");
    return stryMutAct_9fa48("1407") ? groupByTestName(pending(file)) : (stryCov_9fa48("1407"), groupByTestName(pending(file)).slice(0, n));
  }
}

/** These sites now have a test, whatever it turns out to be worth. */
function markWritten(file, names) {
  if (stryMutAct_9fa48("1408")) {
    {}
  } else {
    stryCov_9fa48("1408");
    const set = new Set(names);
    const rows = load(file);
    for (const r of rows) if (stryMutAct_9fa48("1410") ? false : stryMutAct_9fa48("1409") ? true : (stryCov_9fa48("1409", "1410"), set.has(r.name))) r.written = stryMutAct_9fa48("1411") ? false : (stryCov_9fa48("1411"), true);
    flush(file);
  }
}

/** What the single mutation run proved dead leaves the queue entirely. */
function recordOutcome(file, {
  killed = stryMutAct_9fa48("1412") ? ["Stryker was here"] : (stryCov_9fa48("1412"), [])
} = {}) {
  if (stryMutAct_9fa48("1413")) {
    {}
  } else {
    stryCov_9fa48("1413");
    const dead = new Set(killed.map(stryMutAct_9fa48("1414") ? () => undefined : (stryCov_9fa48("1414"), m => mutantKey(m))));
    const p = queuePath(file);
    cache.set(p, stryMutAct_9fa48("1415") ? load(file) : (stryCov_9fa48("1415"), load(file).filter(stryMutAct_9fa48("1416") ? () => undefined : (stryCov_9fa48("1416"), r => stryMutAct_9fa48("1417") ? dead.has(r.key) : (stryCov_9fa48("1417"), !dead.has(r.key))))));
    flush(file);
  }
}

/** Drop the in-memory copy — the next read comes from disk. */
function forget() {
  if (stryMutAct_9fa48("1418")) {
    {}
  } else {
    stryCov_9fa48("1418");
    cache.clear();
  }
}
module.exports = stryMutAct_9fa48("1419") ? {} : (stryCov_9fa48("1419"), {
  replace,
  all,
  alive,
  pending,
  nextGroups,
  markWritten,
  recordOutcome,
  forget,
  queuePath
});