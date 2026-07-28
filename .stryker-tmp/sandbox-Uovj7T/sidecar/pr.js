// @ts-nocheck
'use strict';

// Commit, push and PR creation. Two modes:
//   github — push branch + `gh pr create` (repos the team owns)
//   local  — record branch + patch + PR payload under /data/prs (third-party repos)
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
  DATA_DIR
} = require('./state');
const {
  repoDir
} = require('./repo');
async function changedFiles() {
  if (stryMutAct_9fa48("1758")) {
    {}
  } else {
    stryCov_9fa48("1758");
    const dir = repoDir();
    // -z + --porcelain: NUL-separated, unquoted paths (survives spaces); renames
    // emit "R  new\0old\0" — we keep the new path and skip the old one.
    const r = await run(stryMutAct_9fa48("1759") ? [] : (stryCov_9fa48("1759"), [stryMutAct_9fa48("1760") ? "" : (stryCov_9fa48("1760"), 'git'), stryMutAct_9fa48("1761") ? "" : (stryCov_9fa48("1761"), 'status'), stryMutAct_9fa48("1762") ? "" : (stryCov_9fa48("1762"), '--porcelain'), stryMutAct_9fa48("1763") ? "" : (stryCov_9fa48("1763"), '-z')]), stryMutAct_9fa48("1764") ? {} : (stryCov_9fa48("1764"), {
      cwd: dir,
      timeoutMs: 30000
    }));
    const parts = r.stdout.split(stryMutAct_9fa48("1765") ? "" : (stryCov_9fa48("1765"), '\0'));
    const out = stryMutAct_9fa48("1766") ? ["Stryker was here"] : (stryCov_9fa48("1766"), []);
    for (let i = 0; stryMutAct_9fa48("1769") ? i >= parts.length : stryMutAct_9fa48("1768") ? i <= parts.length : stryMutAct_9fa48("1767") ? false : (stryCov_9fa48("1767", "1768", "1769"), i < parts.length); stryMutAct_9fa48("1770") ? i-- : (stryCov_9fa48("1770"), i++)) {
      if (stryMutAct_9fa48("1771")) {
        {}
      } else {
        stryCov_9fa48("1771");
        const rec = parts[i];
        if (stryMutAct_9fa48("1774") ? false : stryMutAct_9fa48("1773") ? true : stryMutAct_9fa48("1772") ? rec : (stryCov_9fa48("1772", "1773", "1774"), !rec)) continue;
        const xy = stryMutAct_9fa48("1775") ? rec : (stryCov_9fa48("1775"), rec.slice(0, 2));
        out.push(stryMutAct_9fa48("1776") ? rec : (stryCov_9fa48("1776"), rec.slice(3)));
        if (stryMutAct_9fa48("1779") ? xy[0] === 'R' && xy[0] === 'C' : stryMutAct_9fa48("1778") ? false : stryMutAct_9fa48("1777") ? true : (stryCov_9fa48("1777", "1778", "1779"), (stryMutAct_9fa48("1781") ? xy[0] !== 'R' : stryMutAct_9fa48("1780") ? false : (stryCov_9fa48("1780", "1781"), xy[0] === (stryMutAct_9fa48("1782") ? "" : (stryCov_9fa48("1782"), 'R')))) || (stryMutAct_9fa48("1784") ? xy[0] !== 'C' : stryMutAct_9fa48("1783") ? false : (stryCov_9fa48("1783", "1784"), xy[0] === (stryMutAct_9fa48("1785") ? "" : (stryCov_9fa48("1785"), 'C')))))) stryMutAct_9fa48("1786") ? i -= 1 : (stryCov_9fa48("1786"), i += 1); // consume the source path
      }
    }
    return stryMutAct_9fa48("1787") ? out : (stryCov_9fa48("1787"), out.filter(Boolean));
  }
}

/** Test files this branch touched — committed rounds AND uncommitted edits. */
async function changedTestFiles() {
  if (stryMutAct_9fa48("1788")) {
    {}
  } else {
    stryCov_9fa48("1788");
    const dir = repoDir();
    const base = state.run.config.prBase;
    const committed = await run(stryMutAct_9fa48("1789") ? [] : (stryCov_9fa48("1789"), [stryMutAct_9fa48("1790") ? "" : (stryCov_9fa48("1790"), 'git'), stryMutAct_9fa48("1791") ? "" : (stryCov_9fa48("1791"), 'diff'), stryMutAct_9fa48("1792") ? "" : (stryCov_9fa48("1792"), '--name-only'), stryMutAct_9fa48("1793") ? `` : (stryCov_9fa48("1793"), `${base}...HEAD`)]), stryMutAct_9fa48("1794") ? {} : (stryCov_9fa48("1794"), {
      cwd: dir,
      timeoutMs: 30000
    }));
    const all = new Set(stryMutAct_9fa48("1795") ? [...committed.stdout.split('\n').map(s => s.trim()), ...(await changedFiles())] : (stryCov_9fa48("1795"), (stryMutAct_9fa48("1796") ? [] : (stryCov_9fa48("1796"), [...committed.stdout.split(stryMutAct_9fa48("1797") ? "" : (stryCov_9fa48("1797"), '\n')).map(stryMutAct_9fa48("1798") ? () => undefined : (stryCov_9fa48("1798"), s => stryMutAct_9fa48("1799") ? s : (stryCov_9fa48("1799"), s.trim()))), ...(await changedFiles())])).filter(Boolean)));
    return stryMutAct_9fa48("1800") ? [...all] : (stryCov_9fa48("1800"), (stryMutAct_9fa48("1801") ? [] : (stryCov_9fa48("1801"), [...all])).filter(isCommittableTest));
  }
}
async function diffAgainstBase() {
  if (stryMutAct_9fa48("1802")) {
    {}
  } else {
    stryCov_9fa48("1802");
    const dir = repoDir();
    const base = state.run.config.prBase;
    // intent-to-add new test files so they show up in the diff
    const newTests = stryMutAct_9fa48("1803") ? await changedFiles() : (stryCov_9fa48("1803"), (await changedFiles()).filter(isCommittableTest));
    if (stryMutAct_9fa48("1805") ? false : stryMutAct_9fa48("1804") ? true : (stryCov_9fa48("1804", "1805"), newTests.length)) await run(stryMutAct_9fa48("1806") ? [] : (stryCov_9fa48("1806"), [stryMutAct_9fa48("1807") ? "" : (stryCov_9fa48("1807"), 'git'), stryMutAct_9fa48("1808") ? "" : (stryCov_9fa48("1808"), 'add'), stryMutAct_9fa48("1809") ? "" : (stryCov_9fa48("1809"), '-N'), stryMutAct_9fa48("1810") ? "" : (stryCov_9fa48("1810"), '--'), ...newTests]), stryMutAct_9fa48("1811") ? {} : (stryCov_9fa48("1811"), {
      cwd: dir,
      timeoutMs: 30000
    }));
    const r = await run(stryMutAct_9fa48("1812") ? [] : (stryCov_9fa48("1812"), [stryMutAct_9fa48("1813") ? "" : (stryCov_9fa48("1813"), 'git'), stryMutAct_9fa48("1814") ? "" : (stryCov_9fa48("1814"), 'diff'), base, stryMutAct_9fa48("1815") ? "" : (stryCov_9fa48("1815"), '--'), stryMutAct_9fa48("1816") ? "" : (stryCov_9fa48("1816"), ':!node_modules'), stryMutAct_9fa48("1817") ? "" : (stryCov_9fa48("1817"), ':!coverage'), stryMutAct_9fa48("1818") ? "" : (stryCov_9fa48("1818"), ':!reports'), stryMutAct_9fa48("1819") ? "" : (stryCov_9fa48("1819"), ':!.stryker-tmp'), stryMutAct_9fa48("1820") ? "" : (stryCov_9fa48("1820"), ':!.ijst-stryker.config.json')]), stryMutAct_9fa48("1821") ? {} : (stryCov_9fa48("1821"), {
      cwd: dir,
      timeoutMs: 60000
    }));
    return r.stdout;
  }
}
const TEST_PATH_RE = stryMutAct_9fa48("1828") ? /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx$)/ : stryMutAct_9fa48("1827") ? /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[^jt]sx?$)/ : stryMutAct_9fa48("1826") ? /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[^cm]?[jt]sx?$)/ : stryMutAct_9fa48("1825") ? /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm][jt]sx?$)/ : stryMutAct_9fa48("1824") ? /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?)/ : stryMutAct_9fa48("1823") ? /((^|\/)(tests|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/ : stryMutAct_9fa48("1822") ? /((\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/ : (stryCov_9fa48("1822", "1823", "1824", "1825", "1826", "1827", "1828"), /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/);
const ARTIFACT_RE = stryMutAct_9fa48("1829") ? /(\/)(node_modules|coverage|reports|\.stryker-tmp)\// : (stryCov_9fa48("1829"), /(^|\/)(node_modules|coverage|reports|\.stryker-tmp)\//);
const isCommittableTest = stryMutAct_9fa48("1830") ? () => undefined : (stryCov_9fa48("1830"), (() => {
  const isCommittableTest = p => stryMutAct_9fa48("1833") ? TEST_PATH_RE.test(p) || !ARTIFACT_RE.test(p) : stryMutAct_9fa48("1832") ? false : stryMutAct_9fa48("1831") ? true : (stryCov_9fa48("1831", "1832", "1833"), TEST_PATH_RE.test(p) && (stryMutAct_9fa48("1834") ? ARTIFACT_RE.test(p) : (stryCov_9fa48("1834"), !ARTIFACT_RE.test(p))));
  return isCommittableTest;
})());
async function commit(message) {
  if (stryMutAct_9fa48("1835")) {
    {}
  } else {
    stryCov_9fa48("1835");
    const dir = repoDir();
    // Commit ONLY test files — never pipeline artifacts (.ijst-*, reports/, coverage/,
    // .stryker-tmp) and never node_modules; committing those poisons the base branch.
    const changed = await changedFiles();
    const testish = stryMutAct_9fa48("1836") ? changed : (stryCov_9fa48("1836"), changed.filter(isCommittableTest));
    if (stryMutAct_9fa48("1839") ? false : stryMutAct_9fa48("1838") ? true : stryMutAct_9fa48("1837") ? testish.length : (stryCov_9fa48("1837", "1838", "1839"), !testish.length)) {
      if (stryMutAct_9fa48("1840")) {
        {}
      } else {
        stryCov_9fa48("1840");
        // rounds may already be committed on this branch — that's fine for PR creation
        const ahead = await run(stryMutAct_9fa48("1841") ? [] : (stryCov_9fa48("1841"), [stryMutAct_9fa48("1842") ? "" : (stryCov_9fa48("1842"), 'git'), stryMutAct_9fa48("1843") ? "" : (stryCov_9fa48("1843"), 'rev-list'), stryMutAct_9fa48("1844") ? "" : (stryCov_9fa48("1844"), '--count'), stryMutAct_9fa48("1845") ? `` : (stryCov_9fa48("1845"), `${state.run.config.prBase}..HEAD`)]), stryMutAct_9fa48("1846") ? {} : (stryCov_9fa48("1846"), {
          cwd: dir,
          timeoutMs: 30000
        }));
        if (stryMutAct_9fa48("1850") ? parseInt(ahead.stdout.trim(), 10) <= 0 : stryMutAct_9fa48("1849") ? parseInt(ahead.stdout.trim(), 10) >= 0 : stryMutAct_9fa48("1848") ? false : stryMutAct_9fa48("1847") ? true : (stryCov_9fa48("1847", "1848", "1849", "1850"), parseInt(stryMutAct_9fa48("1851") ? ahead.stdout : (stryCov_9fa48("1851"), ahead.stdout.trim()), 10) > 0)) {
          if (stryMutAct_9fa48("1852")) {
            {}
          } else {
            stryCov_9fa48("1852");
            const sha = stryMutAct_9fa48("1853") ? (await run(['git', 'rev-parse', 'HEAD'], {
              cwd: dir,
              timeoutMs: 10000
            })).stdout : (stryCov_9fa48("1853"), (await run(stryMutAct_9fa48("1854") ? [] : (stryCov_9fa48("1854"), [stryMutAct_9fa48("1855") ? "" : (stryCov_9fa48("1855"), 'git'), stryMutAct_9fa48("1856") ? "" : (stryCov_9fa48("1856"), 'rev-parse'), stryMutAct_9fa48("1857") ? "" : (stryCov_9fa48("1857"), 'HEAD')]), stryMutAct_9fa48("1858") ? {} : (stryCov_9fa48("1858"), {
              cwd: dir,
              timeoutMs: 10000
            }))).stdout.trim());
            return stryMutAct_9fa48("1859") ? {} : (stryCov_9fa48("1859"), {
              sha
            });
          }
        }
        throw new Error(stryMutAct_9fa48("1860") ? "" : (stryCov_9fa48("1860"), 'no changed test files to commit'));
      }
    }
    await run(stryMutAct_9fa48("1861") ? [] : (stryCov_9fa48("1861"), [stryMutAct_9fa48("1862") ? "" : (stryCov_9fa48("1862"), 'git'), stryMutAct_9fa48("1863") ? "" : (stryCov_9fa48("1863"), 'add'), stryMutAct_9fa48("1864") ? "" : (stryCov_9fa48("1864"), '--'), ...testish]), stryMutAct_9fa48("1865") ? {} : (stryCov_9fa48("1865"), {
      cwd: dir,
      timeoutMs: 30000
    }));
    // --no-verify: repo pre-commit hooks (husky lint etc.) must not abort the
    // pipeline mid-run — the PR's own CI still judges the final result
    const r = await run(stryMutAct_9fa48("1866") ? [] : (stryCov_9fa48("1866"), [stryMutAct_9fa48("1867") ? "" : (stryCov_9fa48("1867"), 'git'), stryMutAct_9fa48("1868") ? "" : (stryCov_9fa48("1868"), 'commit'), stryMutAct_9fa48("1869") ? "" : (stryCov_9fa48("1869"), '--no-verify'), stryMutAct_9fa48("1870") ? "" : (stryCov_9fa48("1870"), '-m'), message]), stryMutAct_9fa48("1871") ? {} : (stryCov_9fa48("1871"), {
      cwd: dir,
      timeoutMs: 60000
    }));
    if (stryMutAct_9fa48("1874") ? r.code !== 0 || !/nothing to commit/.test(r.stdout + r.stderr) : stryMutAct_9fa48("1873") ? false : stryMutAct_9fa48("1872") ? true : (stryCov_9fa48("1872", "1873", "1874"), (stryMutAct_9fa48("1876") ? r.code === 0 : stryMutAct_9fa48("1875") ? true : (stryCov_9fa48("1875", "1876"), r.code !== 0)) && (stryMutAct_9fa48("1877") ? /nothing to commit/.test(r.stdout + r.stderr) : (stryCov_9fa48("1877"), !/nothing to commit/.test(stryMutAct_9fa48("1878") ? r.stdout - r.stderr : (stryCov_9fa48("1878"), r.stdout + r.stderr)))))) {
      if (stryMutAct_9fa48("1879")) {
        {}
      } else {
        stryCov_9fa48("1879");
        throw new Error((stryMutAct_9fa48("1880") ? "" : (stryCov_9fa48("1880"), 'git commit failed: ')) + (stryMutAct_9fa48("1881") ? r.stderr || r.stdout : (stryCov_9fa48("1881"), (stryMutAct_9fa48("1884") ? r.stderr && r.stdout : stryMutAct_9fa48("1883") ? false : stryMutAct_9fa48("1882") ? true : (stryCov_9fa48("1882", "1883", "1884"), r.stderr || r.stdout)).slice(stryMutAct_9fa48("1885") ? +300 : (stryCov_9fa48("1885"), -300)))));
      }
    }
    const sha = stryMutAct_9fa48("1886") ? (await run(['git', 'rev-parse', 'HEAD'], {
      cwd: dir,
      timeoutMs: 10000
    })).stdout : (stryCov_9fa48("1886"), (await run(stryMutAct_9fa48("1887") ? [] : (stryCov_9fa48("1887"), [stryMutAct_9fa48("1888") ? "" : (stryCov_9fa48("1888"), 'git'), stryMutAct_9fa48("1889") ? "" : (stryCov_9fa48("1889"), 'rev-parse'), stryMutAct_9fa48("1890") ? "" : (stryCov_9fa48("1890"), 'HEAD')]), stryMutAct_9fa48("1891") ? {} : (stryCov_9fa48("1891"), {
      cwd: dir,
      timeoutMs: 10000
    }))).stdout.trim());
    return stryMutAct_9fa48("1892") ? {} : (stryCov_9fa48("1892"), {
      sha
    });
  }
}
async function createPr({
  file,
  branch,
  title,
  body,
  labels = stryMutAct_9fa48("1893") ? ["Stryker was here"] : (stryCov_9fa48("1893"), [])
}) {
  if (stryMutAct_9fa48("1894")) {
    {}
  } else {
    stryCov_9fa48("1894");
    const dir = repoDir();
    const cfg = state.run.config;
    const record = stryMutAct_9fa48("1895") ? {} : (stryCov_9fa48("1895"), {
      file,
      branch,
      title,
      body,
      labels,
      mode: cfg.prMode,
      createdAt: Date.now(),
      url: null,
      patchPath: null
    });
    if (stryMutAct_9fa48("1898") ? cfg.prMode === 'github' || !cfg.dryRun : stryMutAct_9fa48("1897") ? false : stryMutAct_9fa48("1896") ? true : (stryCov_9fa48("1896", "1897", "1898"), (stryMutAct_9fa48("1900") ? cfg.prMode !== 'github' : stryMutAct_9fa48("1899") ? true : (stryCov_9fa48("1899", "1900"), cfg.prMode === (stryMutAct_9fa48("1901") ? "" : (stryCov_9fa48("1901"), 'github')))) && (stryMutAct_9fa48("1902") ? cfg.dryRun : (stryCov_9fa48("1902"), !cfg.dryRun)))) {
      if (stryMutAct_9fa48("1903")) {
        {}
      } else {
        stryCov_9fa48("1903");
        let r = await run(stryMutAct_9fa48("1904") ? [] : (stryCov_9fa48("1904"), [stryMutAct_9fa48("1905") ? "" : (stryCov_9fa48("1905"), 'git'), stryMutAct_9fa48("1906") ? "" : (stryCov_9fa48("1906"), 'push'), stryMutAct_9fa48("1907") ? "" : (stryCov_9fa48("1907"), '--force'), stryMutAct_9fa48("1908") ? "" : (stryCov_9fa48("1908"), '--set-upstream'), stryMutAct_9fa48("1909") ? "" : (stryCov_9fa48("1909"), 'origin'), branch, stryMutAct_9fa48("1910") ? "" : (stryCov_9fa48("1910"), '--no-verify')]), stryMutAct_9fa48("1911") ? {} : (stryCov_9fa48("1911"), {
          cwd: dir,
          timeoutMs: 120000,
          label: stryMutAct_9fa48("1912") ? "" : (stryCov_9fa48("1912"), 'git push')
        }));
        if (stryMutAct_9fa48("1915") ? r.code === 0 : stryMutAct_9fa48("1914") ? false : stryMutAct_9fa48("1913") ? true : (stryCov_9fa48("1913", "1914", "1915"), r.code !== 0)) throw new Error((stryMutAct_9fa48("1916") ? "" : (stryCov_9fa48("1916"), 'git push failed: ')) + (stryMutAct_9fa48("1917") ? r.stderr || r.stdout : (stryCov_9fa48("1917"), (stryMutAct_9fa48("1920") ? r.stderr && r.stdout : stryMutAct_9fa48("1919") ? false : stryMutAct_9fa48("1918") ? true : (stryCov_9fa48("1918", "1919", "1920"), r.stderr || r.stdout)).slice(stryMutAct_9fa48("1921") ? +400 : (stryCov_9fa48("1921"), -400)))));
        const args = stryMutAct_9fa48("1922") ? [] : (stryCov_9fa48("1922"), [stryMutAct_9fa48("1923") ? "" : (stryCov_9fa48("1923"), 'gh'), stryMutAct_9fa48("1924") ? "" : (stryCov_9fa48("1924"), 'pr'), stryMutAct_9fa48("1925") ? "" : (stryCov_9fa48("1925"), 'create'), stryMutAct_9fa48("1926") ? "" : (stryCov_9fa48("1926"), '--base'), cfg.prBase, stryMutAct_9fa48("1927") ? "" : (stryCov_9fa48("1927"), '--head'), branch, stryMutAct_9fa48("1928") ? "" : (stryCov_9fa48("1928"), '--title'), title, stryMutAct_9fa48("1929") ? "" : (stryCov_9fa48("1929"), '--body'), body]);
        r = await run(args, stryMutAct_9fa48("1930") ? {} : (stryCov_9fa48("1930"), {
          cwd: dir,
          timeoutMs: 60000,
          label: stryMutAct_9fa48("1931") ? "" : (stryCov_9fa48("1931"), 'gh pr create')
        }));
        let url = stryMutAct_9fa48("1934") ? (r.stdout + r.stderr).match(/https:\/\/github\.com\/[^\s"]+\/pull\/\d+/)?.[0] && null : stryMutAct_9fa48("1933") ? false : stryMutAct_9fa48("1932") ? true : (stryCov_9fa48("1932", "1933", "1934"), (stryMutAct_9fa48("1935") ? (r.stdout + r.stderr).match(/https:\/\/github\.com\/[^\s"]+\/pull\/\d+/)[0] : (stryCov_9fa48("1935"), (stryMutAct_9fa48("1936") ? r.stdout - r.stderr : (stryCov_9fa48("1936"), r.stdout + r.stderr)).match(stryMutAct_9fa48("1941") ? /https:\/\/github\.com\/[^\s"]+\/pull\/\D+/ : stryMutAct_9fa48("1940") ? /https:\/\/github\.com\/[^\s"]+\/pull\/\d/ : stryMutAct_9fa48("1939") ? /https:\/\/github\.com\/[^\S"]+\/pull\/\d+/ : stryMutAct_9fa48("1938") ? /https:\/\/github\.com\/[\s"]+\/pull\/\d+/ : stryMutAct_9fa48("1937") ? /https:\/\/github\.com\/[^\s"]\/pull\/\d+/ : (stryCov_9fa48("1937", "1938", "1939", "1940", "1941"), /https:\/\/github\.com\/[^\s"]+\/pull\/\d+/))?.[0])) || null);
        if (stryMutAct_9fa48("1944") ? !url || /already exists/i.test(r.stdout + r.stderr) : stryMutAct_9fa48("1943") ? false : stryMutAct_9fa48("1942") ? true : (stryCov_9fa48("1942", "1943", "1944"), (stryMutAct_9fa48("1945") ? url : (stryCov_9fa48("1945"), !url)) && /already exists/i.test(stryMutAct_9fa48("1946") ? r.stdout - r.stderr : (stryCov_9fa48("1946"), r.stdout + r.stderr)))) {
          if (stryMutAct_9fa48("1947")) {
            {}
          } else {
            stryCov_9fa48("1947");
            const v = await run(stryMutAct_9fa48("1948") ? [] : (stryCov_9fa48("1948"), [stryMutAct_9fa48("1949") ? "" : (stryCov_9fa48("1949"), 'gh'), stryMutAct_9fa48("1950") ? "" : (stryCov_9fa48("1950"), 'pr'), stryMutAct_9fa48("1951") ? "" : (stryCov_9fa48("1951"), 'view'), branch, stryMutAct_9fa48("1952") ? "" : (stryCov_9fa48("1952"), '--json'), stryMutAct_9fa48("1953") ? "" : (stryCov_9fa48("1953"), 'url'), stryMutAct_9fa48("1954") ? "" : (stryCov_9fa48("1954"), '-q'), stryMutAct_9fa48("1955") ? "" : (stryCov_9fa48("1955"), '.url')]), stryMutAct_9fa48("1956") ? {} : (stryCov_9fa48("1956"), {
              cwd: dir,
              timeoutMs: 30000
            }));
            url = stryMutAct_9fa48("1959") ? v.stdout.trim() && null : stryMutAct_9fa48("1958") ? false : stryMutAct_9fa48("1957") ? true : (stryCov_9fa48("1957", "1958", "1959"), (stryMutAct_9fa48("1960") ? v.stdout : (stryCov_9fa48("1960"), v.stdout.trim())) || null);
            // keep PR fresh
            await run(stryMutAct_9fa48("1961") ? [] : (stryCov_9fa48("1961"), [stryMutAct_9fa48("1962") ? "" : (stryCov_9fa48("1962"), 'gh'), stryMutAct_9fa48("1963") ? "" : (stryCov_9fa48("1963"), 'pr'), stryMutAct_9fa48("1964") ? "" : (stryCov_9fa48("1964"), 'edit'), branch, stryMutAct_9fa48("1965") ? "" : (stryCov_9fa48("1965"), '--title'), title, stryMutAct_9fa48("1966") ? "" : (stryCov_9fa48("1966"), '--body'), body]), stryMutAct_9fa48("1967") ? {} : (stryCov_9fa48("1967"), {
              cwd: dir,
              timeoutMs: 30000
            }));
          }
        }
        if (stryMutAct_9fa48("1970") ? false : stryMutAct_9fa48("1969") ? true : stryMutAct_9fa48("1968") ? url : (stryCov_9fa48("1968", "1969", "1970"), !url)) throw new Error((stryMutAct_9fa48("1971") ? "" : (stryCov_9fa48("1971"), 'gh pr create failed: ')) + (stryMutAct_9fa48("1972") ? r.stderr || r.stdout : (stryCov_9fa48("1972"), (stryMutAct_9fa48("1975") ? r.stderr && r.stdout : stryMutAct_9fa48("1974") ? false : stryMutAct_9fa48("1973") ? true : (stryCov_9fa48("1973", "1974", "1975"), r.stderr || r.stdout)).slice(stryMutAct_9fa48("1976") ? +400 : (stryCov_9fa48("1976"), -400)))));
        for (const label of labels) {
          if (stryMutAct_9fa48("1977")) {
            {}
          } else {
            stryCov_9fa48("1977");
            await run(stryMutAct_9fa48("1978") ? [] : (stryCov_9fa48("1978"), [stryMutAct_9fa48("1979") ? "" : (stryCov_9fa48("1979"), 'gh'), stryMutAct_9fa48("1980") ? "" : (stryCov_9fa48("1980"), 'pr'), stryMutAct_9fa48("1981") ? "" : (stryCov_9fa48("1981"), 'edit'), branch, stryMutAct_9fa48("1982") ? "" : (stryCov_9fa48("1982"), '--add-label'), label]), stryMutAct_9fa48("1983") ? {} : (stryCov_9fa48("1983"), {
              cwd: dir,
              timeoutMs: 30000
            }));
          }
        }
        record.url = url;
      }
    } else {
      if (stryMutAct_9fa48("1984")) {
        {}
      } else {
        stryCov_9fa48("1984");
        // local mode: keep the branch, save patch + PR payload as the deliverable
        const prDir = path.join(DATA_DIR, stryMutAct_9fa48("1985") ? "" : (stryCov_9fa48("1985"), 'prs'));
        fs.mkdirSync(prDir, stryMutAct_9fa48("1986") ? {} : (stryCov_9fa48("1986"), {
          recursive: stryMutAct_9fa48("1987") ? false : (stryCov_9fa48("1987"), true)
        }));
        const slug = branch.replace(stryMutAct_9fa48("1989") ? /[a-zA-Z0-9._-]+/g : stryMutAct_9fa48("1988") ? /[^a-zA-Z0-9._-]/g : (stryCov_9fa48("1988", "1989"), /[^a-zA-Z0-9._-]+/g), stryMutAct_9fa48("1990") ? "" : (stryCov_9fa48("1990"), '-'));
        const patch = await diffAgainstBase();
        const patchPath = path.join(prDir, slug + (stryMutAct_9fa48("1991") ? "" : (stryCov_9fa48("1991"), '.patch')));
        fs.writeFileSync(patchPath, patch);
        fs.writeFileSync(path.join(prDir, slug + (stryMutAct_9fa48("1992") ? "" : (stryCov_9fa48("1992"), '.json'))), JSON.stringify(record, null, 2));
        record.patchPath = patchPath;
      }
    }
    state.prs.push(record);
    event(stryMutAct_9fa48("1993") ? "" : (stryCov_9fa48("1993"), 'preparing_pr'), record.url ? (stryMutAct_9fa48("1994") ? "" : (stryCov_9fa48("1994"), 'PR created: ')) + record.url : (stryMutAct_9fa48("1995") ? "" : (stryCov_9fa48("1995"), 'PR prepared locally: ')) + record.patchPath);
    return record;
  }
}
module.exports = stryMutAct_9fa48("1996") ? {} : (stryCov_9fa48("1996"), {
  commit,
  createPr,
  changedFiles,
  changedTestFiles,
  diffAgainstBase
});