// @ts-nocheck
'use strict';

// Choosing WHICH surviving mutant to attack next, and how to verify the kill cheaply.
//
// The loop is: pick one mutant → ask for one test → re-run mutation → keep the test only if
// that mutant actually died. So "promising" means: most likely to die from one well-aimed
// test, and most likely to take neighbours with it.
//
// Ranking signals, in order of weight:
//   covered vs no-coverage  a 'survived' mutant is already executed by some test, so it only
//                           needs a sharper assertion. A 'nocoverage' mutant needs a test that
//                           reaches it at all — strictly more work, and the coverage bootstrap
//                           is the better tool for that.
//   neighbour density       survivors clustered in the same few lines tend to fall together:
//                           one test that exercises the region can kill several at once.
//   mutator tractability    flipping `>=` to `>` is easy to pin down with a boundary case;
//                           emptying a string literal deep in an error path is not.
//   attempt history         a mutant we already failed to kill twice is a tar pit; deprioritise.
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
const TRACTABLE = stryMutAct_9fa48("1420") ? {} : (stryCov_9fa48("1420"), {
  EqualityOperator: 10,
  ConditionalExpression: 9,
  RelationalOperator: 9,
  LogicalOperator: 8,
  ArithmeticOperator: 8,
  BooleanLiteral: 7,
  UpdateOperator: 7,
  AssignmentOperator: 6,
  ArrayDeclaration: 5,
  OptionalChaining: 5,
  MethodExpression: 4,
  ObjectLiteral: 3,
  StringLiteral: 2,
  Regex: 2,
  BlockStatement: 1
});
const NEIGHBOUR_WINDOW = 8; // lines either side counted as "the same region"
const DEFAULT_PAD = 12; // lines either side re-mutated when verifying a kill

/** Stable identity across Stryker runs — mutant ids are NOT stable, positions are. */
/**
 * A quoted, length-bounded rendering. Slicing the output of JSON.stringify cuts inside
 * the quotes, so a long replacement rendered as an unterminated string and the model
 * read a broken code fragment.
 */
function quoted(text, max) {
  if (stryMutAct_9fa48("1421")) {
    {}
  } else {
    stryCov_9fa48("1421");
    const raw = String(stryMutAct_9fa48("1422") ? text && '' : (stryCov_9fa48("1422"), text ?? (stryMutAct_9fa48("1423") ? "Stryker was here!" : (stryCov_9fa48("1423"), ''))));
    const body = (stryMutAct_9fa48("1427") ? raw.length <= max : stryMutAct_9fa48("1426") ? raw.length >= max : stryMutAct_9fa48("1425") ? false : stryMutAct_9fa48("1424") ? true : (stryCov_9fa48("1424", "1425", "1426", "1427"), raw.length > max)) ? (stryMutAct_9fa48("1428") ? raw : (stryCov_9fa48("1428"), raw.slice(0, max))) + (stryMutAct_9fa48("1429") ? "" : (stryCov_9fa48("1429"), '…')) : raw;
    return JSON.stringify(body);
  }
}
function mutantKey(m) {
  if (stryMutAct_9fa48("1430")) {
    {}
  } else {
    stryCov_9fa48("1430");
    return (stryMutAct_9fa48("1431") ? [] : (stryCov_9fa48("1431"), [m.mutator, m.line, stryMutAct_9fa48("1432") ? m.column && '' : (stryCov_9fa48("1432"), m.column ?? (stryMutAct_9fa48("1433") ? "Stryker was here!" : (stryCov_9fa48("1433"), ''))), stryMutAct_9fa48("1434") ? String(m.replacement ?? '') : (stryCov_9fa48("1434"), String(stryMutAct_9fa48("1435") ? m.replacement && '' : (stryCov_9fa48("1435"), m.replacement ?? (stryMutAct_9fa48("1436") ? "Stryker was here!" : (stryCov_9fa48("1436"), '')))).slice(0, 60))])).join(stryMutAct_9fa48("1437") ? "" : (stryCov_9fa48("1437"), '|'));
  }
}
function sameMutant(a, b) {
  if (stryMutAct_9fa48("1438")) {
    {}
  } else {
    stryCov_9fa48("1438");
    if (stryMutAct_9fa48("1441") ? !a && !b : stryMutAct_9fa48("1440") ? false : stryMutAct_9fa48("1439") ? true : (stryCov_9fa48("1439", "1440", "1441"), (stryMutAct_9fa48("1442") ? a : (stryCov_9fa48("1442"), !a)) || (stryMutAct_9fa48("1443") ? b : (stryCov_9fa48("1443"), !b)))) return stryMutAct_9fa48("1444") ? true : (stryCov_9fa48("1444"), false);
    return stryMutAct_9fa48("1447") ? a.mutator === b.mutator && a.line === b.line && (a.column == null || b.column == null || a.column === b.column) || String(a.replacement ?? '').slice(0, 60) === String(b.replacement ?? '').slice(0, 60) : stryMutAct_9fa48("1446") ? false : stryMutAct_9fa48("1445") ? true : (stryCov_9fa48("1445", "1446", "1447"), (stryMutAct_9fa48("1449") ? a.mutator === b.mutator && a.line === b.line || a.column == null || b.column == null || a.column === b.column : stryMutAct_9fa48("1448") ? true : (stryCov_9fa48("1448", "1449"), (stryMutAct_9fa48("1451") ? a.mutator === b.mutator || a.line === b.line : stryMutAct_9fa48("1450") ? true : (stryCov_9fa48("1450", "1451"), (stryMutAct_9fa48("1453") ? a.mutator !== b.mutator : stryMutAct_9fa48("1452") ? true : (stryCov_9fa48("1452", "1453"), a.mutator === b.mutator)) && (stryMutAct_9fa48("1455") ? a.line !== b.line : stryMutAct_9fa48("1454") ? true : (stryCov_9fa48("1454", "1455"), a.line === b.line)))) && (stryMutAct_9fa48("1457") ? (a.column == null || b.column == null) && a.column === b.column : stryMutAct_9fa48("1456") ? true : (stryCov_9fa48("1456", "1457"), (stryMutAct_9fa48("1459") ? a.column == null && b.column == null : stryMutAct_9fa48("1458") ? false : (stryCov_9fa48("1458", "1459"), (stryMutAct_9fa48("1461") ? a.column != null : stryMutAct_9fa48("1460") ? false : (stryCov_9fa48("1460", "1461"), a.column == null)) || (stryMutAct_9fa48("1463") ? b.column != null : stryMutAct_9fa48("1462") ? false : (stryCov_9fa48("1462", "1463"), b.column == null)))) || (stryMutAct_9fa48("1465") ? a.column !== b.column : stryMutAct_9fa48("1464") ? false : (stryCov_9fa48("1464", "1465"), a.column === b.column)))))) && (stryMutAct_9fa48("1467") ? String(a.replacement ?? '').slice(0, 60) !== String(b.replacement ?? '').slice(0, 60) : stryMutAct_9fa48("1466") ? true : (stryCov_9fa48("1466", "1467"), (stryMutAct_9fa48("1468") ? String(a.replacement ?? '') : (stryCov_9fa48("1468"), String(stryMutAct_9fa48("1469") ? a.replacement && '' : (stryCov_9fa48("1469"), a.replacement ?? (stryMutAct_9fa48("1470") ? "Stryker was here!" : (stryCov_9fa48("1470"), '')))).slice(0, 60))) === (stryMutAct_9fa48("1471") ? String(b.replacement ?? '') : (stryCov_9fa48("1471"), String(stryMutAct_9fa48("1472") ? b.replacement && '' : (stryCov_9fa48("1472"), b.replacement ?? (stryMutAct_9fa48("1473") ? "Stryker was here!" : (stryCov_9fa48("1473"), '')))).slice(0, 60))))));
  }
}

/**
 * Score and sort surviving mutants, most promising first.
 * @param {Array} survivors  mutants with {mutator, line, column, status, replacement}
 * @param {object} opts
 * @param {object} opts.attempts  { [mutantKey]: numberOfFailedAttempts }
 */
function rank(survivors, {
  attempts = {}
} = {}) {
  if (stryMutAct_9fa48("1474")) {
    {}
  } else {
    stryCov_9fa48("1474");
    const list = Array.isArray(survivors) ? stryMutAct_9fa48("1475") ? survivors : (stryCov_9fa48("1475"), survivors.filter(stryMutAct_9fa48("1476") ? () => undefined : (stryCov_9fa48("1476"), m => stryMutAct_9fa48("1479") ? m || m.line != null : stryMutAct_9fa48("1478") ? false : stryMutAct_9fa48("1477") ? true : (stryCov_9fa48("1477", "1478", "1479"), m && (stryMutAct_9fa48("1481") ? m.line == null : stryMutAct_9fa48("1480") ? true : (stryCov_9fa48("1480", "1481"), m.line != null)))))) : stryMutAct_9fa48("1482") ? ["Stryker was here"] : (stryCov_9fa48("1482"), []);
    const scored = list.map(m => {
      if (stryMutAct_9fa48("1483")) {
        {}
      } else {
        stryCov_9fa48("1483");
        const covered = stryMutAct_9fa48("1486") ? m.status !== 'survived' : stryMutAct_9fa48("1485") ? false : stryMutAct_9fa48("1484") ? true : (stryCov_9fa48("1484", "1485", "1486"), m.status === (stryMutAct_9fa48("1487") ? "" : (stryCov_9fa48("1487"), 'survived'))); // vs 'nocoverage'
        const neighbours = stryMutAct_9fa48("1488") ? list.length : (stryCov_9fa48("1488"), list.filter(stryMutAct_9fa48("1489") ? () => undefined : (stryCov_9fa48("1489"), o => stryMutAct_9fa48("1492") ? o !== m || Math.abs((o.line || 0) - m.line) <= NEIGHBOUR_WINDOW : stryMutAct_9fa48("1491") ? false : stryMutAct_9fa48("1490") ? true : (stryCov_9fa48("1490", "1491", "1492"), (stryMutAct_9fa48("1494") ? o === m : stryMutAct_9fa48("1493") ? true : (stryCov_9fa48("1493", "1494"), o !== m)) && (stryMutAct_9fa48("1497") ? Math.abs((o.line || 0) - m.line) > NEIGHBOUR_WINDOW : stryMutAct_9fa48("1496") ? Math.abs((o.line || 0) - m.line) < NEIGHBOUR_WINDOW : stryMutAct_9fa48("1495") ? true : (stryCov_9fa48("1495", "1496", "1497"), Math.abs(stryMutAct_9fa48("1498") ? (o.line || 0) + m.line : (stryCov_9fa48("1498"), (stryMutAct_9fa48("1501") ? o.line && 0 : stryMutAct_9fa48("1500") ? false : stryMutAct_9fa48("1499") ? true : (stryCov_9fa48("1499", "1500", "1501"), o.line || 0)) - m.line)) <= NEIGHBOUR_WINDOW))))).length);
        const tract = stryMutAct_9fa48("1502") ? TRACTABLE[m.mutator] && 4 : (stryCov_9fa48("1502"), TRACTABLE[m.mutator] ?? 4);
        const failed = stryMutAct_9fa48("1505") ? attempts[mutantKey(m)] && 0 : stryMutAct_9fa48("1504") ? false : stryMutAct_9fa48("1503") ? true : (stryCov_9fa48("1503", "1504", "1505"), attempts[mutantKey(m)] || 0);
        const score = stryMutAct_9fa48("1506") ? (covered ? 100 : 0) + Math.min(neighbours, 10) * 4 + tract + failed * 60 : (stryCov_9fa48("1506"), (stryMutAct_9fa48("1507") ? (covered ? 100 : 0) + Math.min(neighbours, 10) * 4 - tract : (stryCov_9fa48("1507"), (stryMutAct_9fa48("1508") ? (covered ? 100 : 0) - Math.min(neighbours, 10) * 4 : (stryCov_9fa48("1508"), (covered ? 100 : 0) + (stryMutAct_9fa48("1509") ? Math.min(neighbours, 10) / 4 : (stryCov_9fa48("1509"), (stryMutAct_9fa48("1510") ? Math.max(neighbours, 10) : (stryCov_9fa48("1510"), Math.min(neighbours, 10))) * 4)))) + tract)) - (stryMutAct_9fa48("1511") ? failed / 60 : (stryCov_9fa48("1511"), failed * 60))); // two failures ≈ off the table
        return stryMutAct_9fa48("1512") ? {} : (stryCov_9fa48("1512"), {
          ...m,
          score,
          neighbours,
          failedAttempts: failed,
          why: (stryMutAct_9fa48("1513") ? `` : (stryCov_9fa48("1513"), `${covered ? stryMutAct_9fa48("1514") ? "" : (stryCov_9fa48("1514"), 'covered by tests (needs a sharper assertion)') : stryMutAct_9fa48("1515") ? "" : (stryCov_9fa48("1515"), 'not covered (needs a new test path)')}`)) + (stryMutAct_9fa48("1516") ? `` : (stryCov_9fa48("1516"), `, ${neighbours} survivor(s) within ${NEIGHBOUR_WINDOW} lines, ${m.mutator} tractability ${tract}`)) + (failed ? stryMutAct_9fa48("1517") ? `` : (stryCov_9fa48("1517"), `, ${failed} failed attempt(s)`) : stryMutAct_9fa48("1518") ? "Stryker was here!" : (stryCov_9fa48("1518"), ''))
        });
      }
    });
    return stryMutAct_9fa48("1519") ? scored : (stryCov_9fa48("1519"), scored.sort(stryMutAct_9fa48("1520") ? () => undefined : (stryCov_9fa48("1520"), (a, b) => stryMutAct_9fa48("1523") ? b.score - a.score && (a.line || 0) - (b.line || 0) : stryMutAct_9fa48("1522") ? false : stryMutAct_9fa48("1521") ? true : (stryCov_9fa48("1521", "1522", "1523"), (stryMutAct_9fa48("1524") ? b.score + a.score : (stryCov_9fa48("1524"), b.score - a.score)) || (stryMutAct_9fa48("1525") ? (a.line || 0) + (b.line || 0) : (stryCov_9fa48("1525"), (stryMutAct_9fa48("1528") ? a.line && 0 : stryMutAct_9fa48("1527") ? false : stryMutAct_9fa48("1526") ? true : (stryCov_9fa48("1526", "1527", "1528"), a.line || 0)) - (stryMutAct_9fa48("1531") ? b.line && 0 : stryMutAct_9fa48("1530") ? false : stryMutAct_9fa48("1529") ? true : (stryCov_9fa48("1529", "1530", "1531"), b.line || 0))))))));
  }
}

/**
 * The most promising mutant still worth attempting, or null.
 * A mutant is attempted AT MOST ONCE: if a test written specifically to kill it
 * did not, a second attempt on the same target is throwing good money after bad
 * (usually it is an equivalent mutant).
 */
function pickNext(survivors, opts = {}) {
  if (stryMutAct_9fa48("1532")) {
    {}
  } else {
    stryCov_9fa48("1532");
    const ranked = rank(survivors, opts);
    const viable = stryMutAct_9fa48("1533") ? ranked : (stryCov_9fa48("1533"), ranked.filter(stryMutAct_9fa48("1534") ? () => undefined : (stryCov_9fa48("1534"), m => stryMutAct_9fa48("1538") ? m.failedAttempts >= (opts.maxAttemptsPerMutant ?? 1) : stryMutAct_9fa48("1537") ? m.failedAttempts <= (opts.maxAttemptsPerMutant ?? 1) : stryMutAct_9fa48("1536") ? false : stryMutAct_9fa48("1535") ? true : (stryCov_9fa48("1535", "1536", "1537", "1538"), m.failedAttempts < (stryMutAct_9fa48("1539") ? opts.maxAttemptsPerMutant && 1 : (stryCov_9fa48("1539"), opts.maxAttemptsPerMutant ?? 1))))));
    return stryMutAct_9fa48("1542") ? viable[0] && null : stryMutAct_9fa48("1541") ? false : stryMutAct_9fa48("1540") ? true : (stryCov_9fa48("1540", "1541", "1542"), viable[0] || null);
  }
}

/**
 * Ask the model to choose. The heuristic above only shortlists — it is good at
 * cheap signals (covered? clustered? tractable mutator?) and blind to the thing
 * that actually decides killability: whether the surrounding code has an
 * observable effect a test can assert. Prompt/parse live here so they are pure
 * and unit-testable; the HTTP call happens in the caller.
 */
function buildPickRequest(shortlist, {
  file,
  source = stryMutAct_9fa48("1543") ? "Stryker was here!" : (stryCov_9fa48("1543"), ''),
  constraints = stryMutAct_9fa48("1544") ? ["Stryker was here"] : (stryCov_9fa48("1544"), []),
  failed = stryMutAct_9fa48("1545") ? ["Stryker was here"] : (stryCov_9fa48("1545"), [])
} = {}) {
  if (stryMutAct_9fa48("1546")) {
    {}
  } else {
    stryCov_9fa48("1546");
    const rows = shortlist.map(stryMutAct_9fa48("1547") ? () => undefined : (stryCov_9fa48("1547"), (m, i) => stryMutAct_9fa48("1548") ? [`#${i + 1} line ${m.line}${m.column ? ':' + m.column : ''} — ${m.mutator}`, `   code becomes: ${quoted(m.replacement, 118)}`, `   ${m.status === 'survived' ? 'ALREADY EXECUTED by tests (needs a sharper assertion)' : 'NOT COVERED (a test must reach it first)'}`, m.context ? '   context:\n' + m.context.split('\n').map(l => '     ' + l).join('\n') : ''].join('\n') : (stryCov_9fa48("1548"), (stryMutAct_9fa48("1549") ? [] : (stryCov_9fa48("1549"), [stryMutAct_9fa48("1550") ? `` : (stryCov_9fa48("1550"), `#${stryMutAct_9fa48("1551") ? i - 1 : (stryCov_9fa48("1551"), i + 1)} line ${m.line}${m.column ? (stryMutAct_9fa48("1552") ? "" : (stryCov_9fa48("1552"), ':')) + m.column : stryMutAct_9fa48("1553") ? "Stryker was here!" : (stryCov_9fa48("1553"), '')} — ${m.mutator}`), stryMutAct_9fa48("1554") ? `` : (stryCov_9fa48("1554"), `   code becomes: ${quoted(m.replacement, 118)}`), stryMutAct_9fa48("1555") ? `` : (stryCov_9fa48("1555"), `   ${(stryMutAct_9fa48("1558") ? m.status !== 'survived' : stryMutAct_9fa48("1557") ? false : stryMutAct_9fa48("1556") ? true : (stryCov_9fa48("1556", "1557", "1558"), m.status === (stryMutAct_9fa48("1559") ? "" : (stryCov_9fa48("1559"), 'survived')))) ? stryMutAct_9fa48("1560") ? "" : (stryCov_9fa48("1560"), 'ALREADY EXECUTED by tests (needs a sharper assertion)') : stryMutAct_9fa48("1561") ? "" : (stryCov_9fa48("1561"), 'NOT COVERED (a test must reach it first)')}`), m.context ? (stryMutAct_9fa48("1562") ? "" : (stryCov_9fa48("1562"), '   context:\n')) + m.context.split(stryMutAct_9fa48("1563") ? "" : (stryCov_9fa48("1563"), '\n')).map(stryMutAct_9fa48("1564") ? () => undefined : (stryCov_9fa48("1564"), l => (stryMutAct_9fa48("1565") ? "" : (stryCov_9fa48("1565"), '     ')) + l)).join(stryMutAct_9fa48("1566") ? "" : (stryCov_9fa48("1566"), '\n')) : stryMutAct_9fa48("1567") ? "Stryker was here!" : (stryCov_9fa48("1567"), '')])).filter(Boolean).join(stryMutAct_9fa48("1568") ? "" : (stryCov_9fa48("1568"), '\n'))))).join(stryMutAct_9fa48("1569") ? "" : (stryCov_9fa48("1569"), '\n\n'));
    const system = (stryMutAct_9fa48("1570") ? "" : (stryCov_9fa48("1570"), 'You choose which surviving Stryker mutant an automated pipeline should attack next. ')) + (stryMutAct_9fa48("1571") ? "" : (stryCov_9fa48("1571"), 'It will write ONE test for your choice, then re-run mutation to check the mutant died. ')) + (stryMutAct_9fa48("1572") ? "" : (stryCov_9fa48("1572"), 'Choose the mutant most likely to be KILLED by a single, honest test — i.e. the mutation changes ')) + (stryMutAct_9fa48("1573") ? "" : (stryCov_9fa48("1573"), 'behaviour a test can observe through the public API (a returned value, a thrown error, a rendered ')) + (stryMutAct_9fa48("1574") ? "" : (stryCov_9fa48("1574"), 'output, a callback argument). Avoid mutants whose effect is unobservable (logging, defensive ')) + (stryMutAct_9fa48("1575") ? "" : (stryCov_9fa48("1575"), 'branches that cannot be triggered, equivalent mutants that do not change behaviour at all). ')) + (stryMutAct_9fa48("1576") ? "" : (stryCov_9fa48("1576"), 'Prefer one that also puts neighbouring survivors under test. ')) + (stryMutAct_9fa48("1577") ? "" : (stryCov_9fa48("1577"), 'You are ORDERING work, not deciding what survives: the candidate list comes from Stryker, and only a real ')) + (stryMutAct_9fa48("1578") ? "" : (stryCov_9fa48("1578"), 'mutation run can retire a mutant. Always pick one — if you believe several are equivalent, pick the least ')) + (stryMutAct_9fa48("1579") ? "" : (stryCov_9fa48("1579"), 'equivalent-looking of them and say so in your reason. ')) + (stryMutAct_9fa48("1580") ? "" : (stryCov_9fa48("1580"), 'Reply ONLY with JSON: {"pick": <number from the list>, "reason": "one line", "killIdea": "one line on how to kill it"}. ')) + (stryMutAct_9fa48("1581") ? "" : (stryCov_9fa48("1581"), 'Keep reason and killIdea to one short line each.'));

    // Feed failures back: a mutant that survived a test written specifically to kill
    // it is usually EQUIVALENT (the mutation cannot change observable behaviour), and
    // re-picking it burns a full generation for nothing.
    const history = failed.length ? (stryMutAct_9fa48("1582") ? "" : (stryCov_9fa48("1582"), 'ALREADY ATTEMPTED AND FAILED — a test written specifically to kill these did NOT kill them, ')) + (stryMutAct_9fa48("1583") ? "" : (stryCov_9fa48("1583"), 'so they are probably equivalent mutants (no observable behaviour change). Do not pick them again; ')) + (stryMutAct_9fa48("1584") ? "" : (stryCov_9fa48("1584"), 'if a remaining candidate looks equivalent for the same reason, say so in your reason and pick the best of the rest:\n')) + failed.map(stryMutAct_9fa48("1585") ? () => undefined : (stryCov_9fa48("1585"), f => (stryMutAct_9fa48("1586") ? `` : (stryCov_9fa48("1586"), `  - ${f.mutator} at line ${f.line}${f.column ? (stryMutAct_9fa48("1587") ? "" : (stryCov_9fa48("1587"), ':')) + f.column : stryMutAct_9fa48("1588") ? "Stryker was here!" : (stryCov_9fa48("1588"), '')}`)) + (stryMutAct_9fa48("1589") ? `` : (stryCov_9fa48("1589"), `${f.replacement ? (stryMutAct_9fa48("1590") ? "" : (stryCov_9fa48("1590"), ' where the code becomes ')) + quoted(f.replacement, 60) : stryMutAct_9fa48("1591") ? "Stryker was here!" : (stryCov_9fa48("1591"), '')}`)) + (stryMutAct_9fa48("1592") ? `` : (stryCov_9fa48("1592"), ` (${f.attempts} failed attempt(s))`)))).join(stryMutAct_9fa48("1593") ? "" : (stryCov_9fa48("1593"), '\n')) + (stryMutAct_9fa48("1594") ? "" : (stryCov_9fa48("1594"), '\n  A mutant at the SAME line and mutator but a DIFFERENT replacement is a different mutant ')) + (stryMutAct_9fa48("1595") ? "" : (stryCov_9fa48("1595"), 'and is fair game — Stryker emits several per position.\n\n')) : stryMutAct_9fa48("1596") ? "Stryker was here!" : (stryCov_9fa48("1596"), '');
    const prompt = (stryMutAct_9fa48("1597") ? `FILE: ${file}\n\nSOURCE:\n${String(source).slice(0, 10000)}\n\n` + `SURVIVING MUTANT CANDIDATES:\n\n${rows}\n\n` + history - (constraints.length ? `Team constraints on tests:\n${constraints.map(c => '- ' + c).join('\n')}\n\n` : '') : (stryCov_9fa48("1597"), (stryMutAct_9fa48("1598") ? `` : (stryCov_9fa48("1598"), `FILE: ${file}\n\nSOURCE:\n${stryMutAct_9fa48("1599") ? String(source) : (stryCov_9fa48("1599"), String(source).slice(0, 10000))}\n\n`)) + (stryMutAct_9fa48("1600") ? `` : (stryCov_9fa48("1600"), `SURVIVING MUTANT CANDIDATES:\n\n${rows}\n\n`)) + history + (constraints.length ? stryMutAct_9fa48("1601") ? `` : (stryCov_9fa48("1601"), `Team constraints on tests:\n${constraints.map(stryMutAct_9fa48("1602") ? () => undefined : (stryCov_9fa48("1602"), c => (stryMutAct_9fa48("1603") ? "" : (stryCov_9fa48("1603"), '- ')) + c)).join(stryMutAct_9fa48("1604") ? "" : (stryCov_9fa48("1604"), '\n'))}\n\n`) : stryMutAct_9fa48("1605") ? "Stryker was here!" : (stryCov_9fa48("1605"), '')))) + (stryMutAct_9fa48("1606") ? "" : (stryCov_9fa48("1606"), 'Pick the one single test can most reliably kill. JSON only.'));

    // 2000, not 1200: with thinking disabled for decision calls the model reasons
    // inside `reason`, and a budget that truncates mid-string produces invalid JSON
    // even under constrained decoding.
    return stryMutAct_9fa48("1607") ? {} : (stryCov_9fa48("1607"), {
      system,
      prompt,
      json: stryMutAct_9fa48("1608") ? false : (stryCov_9fa48("1608"), true),
      decision: stryMutAct_9fa48("1609") ? false : (stryCov_9fa48("1609"), true),
      maxTokens: 2000,
      temperature: 0.2
    });
  }
}

/** Validate the model's answer against the shortlist it was actually offered. */
function resolvePick(answer, shortlist) {
  if (stryMutAct_9fa48("1610")) {
    {}
  } else {
    stryCov_9fa48("1610");
    if (stryMutAct_9fa48("1613") ? !answer && !shortlist?.length : stryMutAct_9fa48("1612") ? false : stryMutAct_9fa48("1611") ? true : (stryCov_9fa48("1611", "1612", "1613"), (stryMutAct_9fa48("1614") ? answer : (stryCov_9fa48("1614"), !answer)) || (stryMutAct_9fa48("1615") ? shortlist?.length : (stryCov_9fa48("1615"), !(stryMutAct_9fa48("1616") ? shortlist.length : (stryCov_9fa48("1616"), shortlist?.length)))))) return null;
    // A refusal to pick is NOT a verdict on the mutants. Stryker found them; only
    // Stryker can retire them. Treat it as an unusable answer so the caller falls
    // back to the ranked candidate and the loop keeps working from measurement.
    const take = stryMutAct_9fa48("1617") ? () => undefined : (stryCov_9fa48("1617"), (() => {
      const take = m => stryMutAct_9fa48("1618") ? {} : (stryCov_9fa48("1618"), {
        mutant: m,
        reason: stryMutAct_9fa48("1619") ? String(answer.reason || '') : (stryCov_9fa48("1619"), String(stryMutAct_9fa48("1622") ? answer.reason && '' : stryMutAct_9fa48("1621") ? false : stryMutAct_9fa48("1620") ? true : (stryCov_9fa48("1620", "1621", "1622"), answer.reason || (stryMutAct_9fa48("1623") ? "Stryker was here!" : (stryCov_9fa48("1623"), '')))).slice(0, 300)),
        killIdea: stryMutAct_9fa48("1624") ? String(answer.killIdea || '') : (stryCov_9fa48("1624"), String(stryMutAct_9fa48("1627") ? answer.killIdea && '' : stryMutAct_9fa48("1626") ? false : stryMutAct_9fa48("1625") ? true : (stryCov_9fa48("1625", "1626", "1627"), answer.killIdea || (stryMutAct_9fa48("1628") ? "Stryker was here!" : (stryCov_9fa48("1628"), '')))).slice(0, 300))
      });
      return take;
    })());
    const n = Number(answer.pick);
    // An index and a line number are the same kind of small integer, so "pick 8" out of
    // twelve candidates is ambiguous — and read as an index it silently returns the
    // mutant at line 47. When the answer says which line it means, believe that.
    const said = Number(answer.line);
    if (stryMutAct_9fa48("1630") ? false : stryMutAct_9fa48("1629") ? true : (stryCov_9fa48("1629", "1630"), Number.isInteger(said))) {
      if (stryMutAct_9fa48("1631")) {
        {}
      } else {
        stryCov_9fa48("1631");
        const byStatedLine = shortlist.find(stryMutAct_9fa48("1632") ? () => undefined : (stryCov_9fa48("1632"), m => stryMutAct_9fa48("1635") ? m.line !== said : stryMutAct_9fa48("1634") ? false : stryMutAct_9fa48("1633") ? true : (stryCov_9fa48("1633", "1634", "1635"), m.line === said)));
        if (stryMutAct_9fa48("1637") ? false : stryMutAct_9fa48("1636") ? true : (stryCov_9fa48("1636", "1637"), byStatedLine)) return take(byStatedLine);
      }
    }
    if (stryMutAct_9fa48("1640") ? Number.isInteger(n) && n >= 1 || n <= shortlist.length : stryMutAct_9fa48("1639") ? false : stryMutAct_9fa48("1638") ? true : (stryCov_9fa48("1638", "1639", "1640"), (stryMutAct_9fa48("1642") ? Number.isInteger(n) || n >= 1 : stryMutAct_9fa48("1641") ? true : (stryCov_9fa48("1641", "1642"), Number.isInteger(n) && (stryMutAct_9fa48("1645") ? n < 1 : stryMutAct_9fa48("1644") ? n > 1 : stryMutAct_9fa48("1643") ? true : (stryCov_9fa48("1643", "1644", "1645"), n >= 1)))) && (stryMutAct_9fa48("1648") ? n > shortlist.length : stryMutAct_9fa48("1647") ? n < shortlist.length : stryMutAct_9fa48("1646") ? true : (stryCov_9fa48("1646", "1647", "1648"), n <= shortlist.length)))) return take(shortlist[stryMutAct_9fa48("1649") ? n + 1 : (stryCov_9fa48("1649"), n - 1)]);
    // tolerate a line number in the pick field itself
    const byLine = shortlist.find(stryMutAct_9fa48("1650") ? () => undefined : (stryCov_9fa48("1650"), m => stryMutAct_9fa48("1653") ? m.line !== n : stryMutAct_9fa48("1652") ? false : stryMutAct_9fa48("1651") ? true : (stryCov_9fa48("1651", "1652", "1653"), m.line === n)));
    if (stryMutAct_9fa48("1655") ? false : stryMutAct_9fa48("1654") ? true : (stryCov_9fa48("1654", "1655"), byLine)) return take(byLine);
    return null;
  }
}

/**
 * Line range to re-mutate when verifying a kill. Narrow ranges make verification seconds
 * instead of minutes — Stryker accepts "file.ts:120-190" (mutation range, 9.x).
 */
function verifyRange(mutant, {
  pad = DEFAULT_PAD,
  fileLines = null
} = {}) {
  if (stryMutAct_9fa48("1656")) {
    {}
  } else {
    stryCov_9fa48("1656");
    const start = stryMutAct_9fa48("1657") ? Math.min(1, (mutant.line || 1) - pad) : (stryCov_9fa48("1657"), Math.max(1, stryMutAct_9fa48("1658") ? (mutant.line || 1) + pad : (stryCov_9fa48("1658"), (stryMutAct_9fa48("1661") ? mutant.line && 1 : stryMutAct_9fa48("1660") ? false : stryMutAct_9fa48("1659") ? true : (stryCov_9fa48("1659", "1660", "1661"), mutant.line || 1)) - pad)));
    const endBase = stryMutAct_9fa48("1664") ? (mutant.endLine || mutant.line) && 1 : stryMutAct_9fa48("1663") ? false : stryMutAct_9fa48("1662") ? true : (stryCov_9fa48("1662", "1663", "1664"), (stryMutAct_9fa48("1666") ? mutant.endLine && mutant.line : stryMutAct_9fa48("1665") ? false : (stryCov_9fa48("1665", "1666"), mutant.endLine || mutant.line)) || 1);
    const end = fileLines ? stryMutAct_9fa48("1667") ? Math.max(fileLines, endBase + pad) : (stryCov_9fa48("1667"), Math.min(fileLines, stryMutAct_9fa48("1668") ? endBase - pad : (stryCov_9fa48("1668"), endBase + pad))) : stryMutAct_9fa48("1669") ? endBase - pad : (stryCov_9fa48("1669"), endBase + pad);
    return stryMutAct_9fa48("1670") ? {} : (stryCov_9fa48("1670"), {
      from: start,
      to: stryMutAct_9fa48("1671") ? Math.min(start, end) : (stryCov_9fa48("1671"), Math.max(start, end))
    });
  }
}

/** Stryker mutate-spec for a range: "src/foo.ts:120-190". Ranges cannot contain globs. */
function rangeSpec(file, range) {
  if (stryMutAct_9fa48("1672")) {
    {}
  } else {
    stryCov_9fa48("1672");
    return stryMutAct_9fa48("1673") ? `` : (stryCov_9fa48("1673"), `${file}:${range.from}-${range.to}`);
  }
}

/**
 * Which test FILE killed how many mutants, from one report.
 *
 * Stryker records killedBy (test ids) per mutant and a testFiles map, so a single
 * mutation run answers both "what died" and "what killed it". That is what lets a sweep
 * write many tests, verify once, and drop the ones that earned nothing — instead of
 * paying a mutation run per test to find out.
 *
 * A file Stryker ran that killed nothing reports 0 rather than being absent, because
 * "no entry" and "earned nothing" are different facts and only the second is a reason
 * to delete a file.
 */
function killsByTestFile(report) {
  if (stryMutAct_9fa48("1674")) {
    {}
  } else {
    stryCov_9fa48("1674");
    const testToFile = {};
    for (const [file, entry] of Object.entries(stryMutAct_9fa48("1677") ? report?.testFiles && {} : stryMutAct_9fa48("1676") ? false : stryMutAct_9fa48("1675") ? true : (stryCov_9fa48("1675", "1676", "1677"), (stryMutAct_9fa48("1678") ? report.testFiles : (stryCov_9fa48("1678"), report?.testFiles)) || {}))) {
      if (stryMutAct_9fa48("1679")) {
        {}
      } else {
        stryCov_9fa48("1679");
        for (const t of stryMutAct_9fa48("1682") ? entry?.tests && [] : stryMutAct_9fa48("1681") ? false : stryMutAct_9fa48("1680") ? true : (stryCov_9fa48("1680", "1681", "1682"), (stryMutAct_9fa48("1683") ? entry.tests : (stryCov_9fa48("1683"), entry?.tests)) || (stryMutAct_9fa48("1684") ? ["Stryker was here"] : (stryCov_9fa48("1684"), [])))) testToFile[String(t.id)] = file;
      }
    }
    const out = {};
    for (const file of Object.keys(stryMutAct_9fa48("1687") ? report?.testFiles && {} : stryMutAct_9fa48("1686") ? false : stryMutAct_9fa48("1685") ? true : (stryCov_9fa48("1685", "1686", "1687"), (stryMutAct_9fa48("1688") ? report.testFiles : (stryCov_9fa48("1688"), report?.testFiles)) || {}))) out[file] = 0;
    for (const d of Object.values(stryMutAct_9fa48("1691") ? report?.files && {} : stryMutAct_9fa48("1690") ? false : stryMutAct_9fa48("1689") ? true : (stryCov_9fa48("1689", "1690", "1691"), (stryMutAct_9fa48("1692") ? report.files : (stryCov_9fa48("1692"), report?.files)) || {}))) {
      if (stryMutAct_9fa48("1693")) {
        {}
      } else {
        stryCov_9fa48("1693");
        for (const m of stryMutAct_9fa48("1696") ? d?.mutants && [] : stryMutAct_9fa48("1695") ? false : stryMutAct_9fa48("1694") ? true : (stryCov_9fa48("1694", "1695", "1696"), (stryMutAct_9fa48("1697") ? d.mutants : (stryCov_9fa48("1697"), d?.mutants)) || (stryMutAct_9fa48("1698") ? ["Stryker was here"] : (stryCov_9fa48("1698"), [])))) {
          if (stryMutAct_9fa48("1699")) {
            {}
          } else {
            stryCov_9fa48("1699");
            // a timeout is a kill for the score, so it is a kill for attribution too
            if (stryMutAct_9fa48("1702") ? false : stryMutAct_9fa48("1701") ? true : stryMutAct_9fa48("1700") ? ['killed', 'timeout'].includes(String(m.status || '').toLowerCase()) : (stryCov_9fa48("1700", "1701", "1702"), !(stryMutAct_9fa48("1703") ? [] : (stryCov_9fa48("1703"), [stryMutAct_9fa48("1704") ? "" : (stryCov_9fa48("1704"), 'killed'), stryMutAct_9fa48("1705") ? "" : (stryCov_9fa48("1705"), 'timeout')])).includes(stryMutAct_9fa48("1706") ? String(m.status || '').toUpperCase() : (stryCov_9fa48("1706"), String(stryMutAct_9fa48("1709") ? m.status && '' : stryMutAct_9fa48("1708") ? false : stryMutAct_9fa48("1707") ? true : (stryCov_9fa48("1707", "1708", "1709"), m.status || (stryMutAct_9fa48("1710") ? "Stryker was here!" : (stryCov_9fa48("1710"), '')))).toLowerCase())))) continue;
            for (const id of stryMutAct_9fa48("1713") ? m.killedBy && [] : stryMutAct_9fa48("1712") ? false : stryMutAct_9fa48("1711") ? true : (stryCov_9fa48("1711", "1712", "1713"), m.killedBy || (stryMutAct_9fa48("1714") ? ["Stryker was here"] : (stryCov_9fa48("1714"), [])))) {
              if (stryMutAct_9fa48("1715")) {
                {}
              } else {
                stryCov_9fa48("1715");
                const f = testToFile[String(id)];
                if (stryMutAct_9fa48("1718") ? f === undefined : stryMutAct_9fa48("1717") ? false : stryMutAct_9fa48("1716") ? true : (stryCov_9fa48("1716", "1717", "1718"), f !== undefined)) out[f] = stryMutAct_9fa48("1719") ? (out[f] || 0) - 1 : (stryCov_9fa48("1719"), (stryMutAct_9fa48("1722") ? out[f] && 0 : stryMutAct_9fa48("1721") ? false : stryMutAct_9fa48("1720") ? true : (stryCov_9fa48("1720", "1721", "1722"), out[f] || 0)) + 1);
              }
            }
          }
        }
      }
    }
    return out;
  }
}

/**
 * The canonical name of the test that would kill this mutant.
 *
 * Keyed on the SITE, not the mutation: `>` becoming `>=`, `<` and `==` are three
 * mutants of one condition, and one boundary test kills all three. Naming by site makes
 * that collapse explicit and — because the name is derived mechanically — lets us ask
 * "is there already a test called this?" before spending a single token.
 *
 * That question is the whole economy of a sweep. A thousand mutants at ~100 tokens each
 * is hours of generation; grouped by site and filtered against tests that already exist,
 * most of them cost nothing at all.
 */
function testNameFor(m) {
  if (stryMutAct_9fa48("1723")) {
    {}
  } else {
    stryCov_9fa48("1723");
    return stryMutAct_9fa48("1724") ? `` : (stryCov_9fa48("1724"), `kills ${m.line}:${stryMutAct_9fa48("1725") ? m.column && 0 : (stryCov_9fa48("1725"), m.column ?? 0)}`);
  }
}

/** Survivors grouped into the tests that would kill them: one entry per site. */
function groupByTestName(survivors) {
  if (stryMutAct_9fa48("1726")) {
    {}
  } else {
    stryCov_9fa48("1726");
    const groups = new Map();
    for (const m of survivors) {
      if (stryMutAct_9fa48("1727")) {
        {}
      } else {
        stryCov_9fa48("1727");
        const name = testNameFor(m);
        if (stryMutAct_9fa48("1730") ? false : stryMutAct_9fa48("1729") ? true : stryMutAct_9fa48("1728") ? groups.has(name) : (stryCov_9fa48("1728", "1729", "1730"), !groups.has(name))) groups.set(name, stryMutAct_9fa48("1731") ? {} : (stryCov_9fa48("1731"), {
          name,
          line: m.line,
          column: stryMutAct_9fa48("1732") ? m.column && 0 : (stryCov_9fa48("1732"), m.column ?? 0),
          mutants: stryMutAct_9fa48("1733") ? ["Stryker was here"] : (stryCov_9fa48("1733"), [])
        }));
        groups.get(name).mutants.push(m);
      }
    }
    // biggest sites first: one test there retires the most mutants
    return stryMutAct_9fa48("1734") ? [...groups.values()] : (stryCov_9fa48("1734"), (stryMutAct_9fa48("1735") ? [] : (stryCov_9fa48("1735"), [...groups.values()])).sort(stryMutAct_9fa48("1736") ? () => undefined : (stryCov_9fa48("1736"), (a, b) => stryMutAct_9fa48("1739") ? b.mutants.length - a.mutants.length && a.line - b.line : stryMutAct_9fa48("1738") ? false : stryMutAct_9fa48("1737") ? true : (stryCov_9fa48("1737", "1738", "1739"), (stryMutAct_9fa48("1740") ? b.mutants.length + a.mutants.length : (stryCov_9fa48("1740"), b.mutants.length - a.mutants.length)) || (stryMutAct_9fa48("1741") ? a.line + b.line : (stryCov_9fa48("1741"), a.line - b.line))))));
  }
}

/**
 * Drop the groups a test already exists for. Purely textual and deliberately so — it
 * runs before any model call, over every test we can see, and a name that is present is
 * a test that has already had its chance at that site.
 */
function unwrittenGroups(groups, existingTestSources = stryMutAct_9fa48("1742") ? ["Stryker was here"] : (stryCov_9fa48("1742"), [])) {
  if (stryMutAct_9fa48("1743")) {
    {}
  } else {
    stryCov_9fa48("1743");
    const haystack = existingTestSources.join(stryMutAct_9fa48("1744") ? "" : (stryCov_9fa48("1744"), '\n'));
    return stryMutAct_9fa48("1745") ? groups : (stryCov_9fa48("1745"), groups.filter(stryMutAct_9fa48("1746") ? () => undefined : (stryCov_9fa48("1746"), g => stryMutAct_9fa48("1747") ? haystack.includes(g.name) : (stryCov_9fa48("1747"), !haystack.includes(g.name)))));
  }
}

/** Shortlist for the model: viable candidates, best-first, small enough to reason about. */
function shortlist(survivors, {
  attempts = {},
  maxAttemptsPerMutant = 1,
  size = 12
} = {}) {
  if (stryMutAct_9fa48("1748")) {
    {}
  } else {
    stryCov_9fa48("1748");
    return stryMutAct_9fa48("1750") ? rank(survivors, {
      attempts
    }).slice(0, size) : stryMutAct_9fa48("1749") ? rank(survivors, {
      attempts
    }).filter(m => m.failedAttempts < maxAttemptsPerMutant) : (stryCov_9fa48("1749", "1750"), rank(survivors, stryMutAct_9fa48("1751") ? {} : (stryCov_9fa48("1751"), {
      attempts
    })).filter(stryMutAct_9fa48("1752") ? () => undefined : (stryCov_9fa48("1752"), m => stryMutAct_9fa48("1756") ? m.failedAttempts >= maxAttemptsPerMutant : stryMutAct_9fa48("1755") ? m.failedAttempts <= maxAttemptsPerMutant : stryMutAct_9fa48("1754") ? false : stryMutAct_9fa48("1753") ? true : (stryCov_9fa48("1753", "1754", "1755", "1756"), m.failedAttempts < maxAttemptsPerMutant))).slice(0, size));
  }
}
module.exports = stryMutAct_9fa48("1757") ? {} : (stryCov_9fa48("1757"), {
  killsByTestFile,
  testNameFor,
  groupByTestName,
  unwrittenGroups,
  rank,
  pickNext,
  shortlist,
  buildPickRequest,
  resolvePick,
  mutantKey,
  sameMutant,
  verifyRange,
  rangeSpec,
  TRACTABLE,
  NEIGHBOUR_WINDOW
});