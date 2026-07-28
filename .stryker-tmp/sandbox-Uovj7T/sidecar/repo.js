// @ts-nocheck
'use strict';

// Repo lifecycle: clone, install, detect runner, branches, file access.
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
  upsertFile,
  DATA_DIR
} = require('./state');
const {
  slugify,
  globsToMatcher
} = require('./util');
function repoDir() {
  if (stryMutAct_9fa48("1997")) {
    {}
  } else {
    stryCov_9fa48("1997");
    const cfg = stryMutAct_9fa48("1998") ? state.run.config : (stryCov_9fa48("1998"), state.run?.config);
    if (stryMutAct_9fa48("2001") ? false : stryMutAct_9fa48("2000") ? true : stryMutAct_9fa48("1999") ? cfg?.repoUrl : (stryCov_9fa48("1999", "2000", "2001"), !(stryMutAct_9fa48("2002") ? cfg.repoUrl : (stryCov_9fa48("2002"), cfg?.repoUrl)))) throw new Error(stryMutAct_9fa48("2003") ? "" : (stryCov_9fa48("2003"), 'no run started / REPO_URL missing'));
    return path.join(DATA_DIR, stryMutAct_9fa48("2004") ? "" : (stryCov_9fa48("2004"), 'repos'), slugify(cfg.repoUrl));
  }
}

// NOTE: credentials are deliberately NOT inlined into the remote URL — git echoes
// the full URL in many failure messages, which would put the token in the event
// log and on the dashboard. Auth comes from the gh credential helper that
// entrypoint.sh installs (`gh auth setup-git`), which reads GH_TOKEN from the env.
function authUrl(url) {
  if (stryMutAct_9fa48("2005")) {
    {}
  } else {
    stryCov_9fa48("2005");
    return url;
  }
}
async function clone() {
  if (stryMutAct_9fa48("2006")) {
    {}
  } else {
    stryCov_9fa48("2006");
    const cfg = state.run.config;
    const dir = repoDir();
    fs.mkdirSync(path.dirname(dir), stryMutAct_9fa48("2007") ? {} : (stryCov_9fa48("2007"), {
      recursive: stryMutAct_9fa48("2008") ? false : (stryCov_9fa48("2008"), true)
    }));
    if (stryMutAct_9fa48("2010") ? false : stryMutAct_9fa48("2009") ? true : (stryCov_9fa48("2009", "2010"), fs.existsSync(path.join(dir, stryMutAct_9fa48("2011") ? "" : (stryCov_9fa48("2011"), '.git'))))) {
      if (stryMutAct_9fa48("2012")) {
        {}
      } else {
        stryCov_9fa48("2012");
        event(stryMutAct_9fa48("2013") ? "" : (stryCov_9fa48("2013"), 'cloning'), stryMutAct_9fa48("2014") ? "" : (stryCov_9fa48("2014"), 'repo exists, fetching latest'));
        // scrub any credentials an older clone left in .git/config — the token
        // would otherwise surface in git's error output and in the event log
        const remote = await run(stryMutAct_9fa48("2015") ? [] : (stryCov_9fa48("2015"), [stryMutAct_9fa48("2016") ? "" : (stryCov_9fa48("2016"), 'git'), stryMutAct_9fa48("2017") ? "" : (stryCov_9fa48("2017"), 'remote'), stryMutAct_9fa48("2018") ? "" : (stryCov_9fa48("2018"), 'get-url'), stryMutAct_9fa48("2019") ? "" : (stryCov_9fa48("2019"), 'origin')]), stryMutAct_9fa48("2020") ? {} : (stryCov_9fa48("2020"), {
          cwd: dir,
          timeoutMs: 10000
        }));
        if (stryMutAct_9fa48("2022") ? false : stryMutAct_9fa48("2021") ? true : (stryCov_9fa48("2021", "2022"), (stryMutAct_9fa48("2028") ? /\/\/[^/@\s]+:[^/@\S]+@/ : stryMutAct_9fa48("2027") ? /\/\/[^/@\s]+:[/@\s]+@/ : stryMutAct_9fa48("2026") ? /\/\/[^/@\s]+:[^/@\s]@/ : stryMutAct_9fa48("2025") ? /\/\/[^/@\S]+:[^/@\s]+@/ : stryMutAct_9fa48("2024") ? /\/\/[/@\s]+:[^/@\s]+@/ : stryMutAct_9fa48("2023") ? /\/\/[^/@\s]:[^/@\s]+@/ : (stryCov_9fa48("2023", "2024", "2025", "2026", "2027", "2028"), /\/\/[^/@\s]+:[^/@\s]+@/)).test(remote.stdout))) {
          if (stryMutAct_9fa48("2029")) {
            {}
          } else {
            stryCov_9fa48("2029");
            const clean = stryMutAct_9fa48("2030") ? remote.stdout.replace(/\/\/[^/@\s]+:[^/@\s]+@/, '//') : (stryCov_9fa48("2030"), remote.stdout.trim().replace(stryMutAct_9fa48("2036") ? /\/\/[^/@\s]+:[^/@\S]+@/ : stryMutAct_9fa48("2035") ? /\/\/[^/@\s]+:[/@\s]+@/ : stryMutAct_9fa48("2034") ? /\/\/[^/@\s]+:[^/@\s]@/ : stryMutAct_9fa48("2033") ? /\/\/[^/@\S]+:[^/@\s]+@/ : stryMutAct_9fa48("2032") ? /\/\/[/@\s]+:[^/@\s]+@/ : stryMutAct_9fa48("2031") ? /\/\/[^/@\s]:[^/@\s]+@/ : (stryCov_9fa48("2031", "2032", "2033", "2034", "2035", "2036"), /\/\/[^/@\s]+:[^/@\s]+@/), stryMutAct_9fa48("2037") ? "" : (stryCov_9fa48("2037"), '//')));
            await run(stryMutAct_9fa48("2038") ? [] : (stryCov_9fa48("2038"), [stryMutAct_9fa48("2039") ? "" : (stryCov_9fa48("2039"), 'git'), stryMutAct_9fa48("2040") ? "" : (stryCov_9fa48("2040"), 'remote'), stryMutAct_9fa48("2041") ? "" : (stryCov_9fa48("2041"), 'set-url'), stryMutAct_9fa48("2042") ? "" : (stryCov_9fa48("2042"), 'origin'), clean]), stryMutAct_9fa48("2043") ? {} : (stryCov_9fa48("2043"), {
              cwd: dir,
              timeoutMs: 10000
            }));
            event(stryMutAct_9fa48("2044") ? "" : (stryCov_9fa48("2044"), 'cloning'), stryMutAct_9fa48("2045") ? "" : (stryCov_9fa48("2045"), 'removed inlined credentials from the git remote (now using the gh credential helper)'));
          }
        }
        let r = await run(stryMutAct_9fa48("2046") ? [] : (stryCov_9fa48("2046"), [stryMutAct_9fa48("2047") ? "" : (stryCov_9fa48("2047"), 'git'), stryMutAct_9fa48("2048") ? "" : (stryCov_9fa48("2048"), 'fetch'), stryMutAct_9fa48("2049") ? "" : (stryCov_9fa48("2049"), 'origin'), cfg.repoBranch]), stryMutAct_9fa48("2050") ? {} : (stryCov_9fa48("2050"), {
          cwd: dir,
          timeoutMs: 300000,
          label: stryMutAct_9fa48("2051") ? "" : (stryCov_9fa48("2051"), 'git fetch')
        }));
        if (stryMutAct_9fa48("2054") ? r.code === 0 : stryMutAct_9fa48("2053") ? false : stryMutAct_9fa48("2052") ? true : (stryCov_9fa48("2052", "2053", "2054"), r.code !== 0)) throw new Error((stryMutAct_9fa48("2055") ? "" : (stryCov_9fa48("2055"), 'git fetch failed: ')) + (stryMutAct_9fa48("2056") ? r.stderr : (stryCov_9fa48("2056"), r.stderr.slice(stryMutAct_9fa48("2057") ? +400 : (stryCov_9fa48("2057"), -400)))));
        await run(stryMutAct_9fa48("2058") ? [] : (stryCov_9fa48("2058"), [stryMutAct_9fa48("2059") ? "" : (stryCov_9fa48("2059"), 'git'), stryMutAct_9fa48("2060") ? "" : (stryCov_9fa48("2060"), 'checkout'), stryMutAct_9fa48("2061") ? "" : (stryCov_9fa48("2061"), '-f'), cfg.repoBranch]), stryMutAct_9fa48("2062") ? {} : (stryCov_9fa48("2062"), {
          cwd: dir,
          timeoutMs: 60000
        }));
        await run(stryMutAct_9fa48("2063") ? [] : (stryCov_9fa48("2063"), [stryMutAct_9fa48("2064") ? "" : (stryCov_9fa48("2064"), 'git'), stryMutAct_9fa48("2065") ? "" : (stryCov_9fa48("2065"), 'reset'), stryMutAct_9fa48("2066") ? "" : (stryCov_9fa48("2066"), '--hard'), stryMutAct_9fa48("2067") ? `` : (stryCov_9fa48("2067"), `origin/${cfg.repoBranch}`)]), stryMutAct_9fa48("2068") ? {} : (stryCov_9fa48("2068"), {
          cwd: dir,
          timeoutMs: 60000
        }));
        await run(stryMutAct_9fa48("2069") ? [] : (stryCov_9fa48("2069"), [stryMutAct_9fa48("2070") ? "" : (stryCov_9fa48("2070"), 'git'), stryMutAct_9fa48("2071") ? "" : (stryCov_9fa48("2071"), 'clean'), stryMutAct_9fa48("2072") ? "" : (stryCov_9fa48("2072"), '-fd'), stryMutAct_9fa48("2073") ? "" : (stryCov_9fa48("2073"), '-e'), stryMutAct_9fa48("2074") ? "" : (stryCov_9fa48("2074"), 'node_modules')]), stryMutAct_9fa48("2075") ? {} : (stryCov_9fa48("2075"), {
          cwd: dir,
          timeoutMs: 60000
        }));
      }
    } else {
      if (stryMutAct_9fa48("2076")) {
        {}
      } else {
        stryCov_9fa48("2076");
        event(stryMutAct_9fa48("2077") ? "" : (stryCov_9fa48("2077"), 'cloning'), stryMutAct_9fa48("2078") ? `` : (stryCov_9fa48("2078"), `cloning ${cfg.repoUrl} (branch ${cfg.repoBranch})`));
        const r = await run(stryMutAct_9fa48("2079") ? [] : (stryCov_9fa48("2079"), [stryMutAct_9fa48("2080") ? "" : (stryCov_9fa48("2080"), 'git'), stryMutAct_9fa48("2081") ? "" : (stryCov_9fa48("2081"), 'clone'), stryMutAct_9fa48("2082") ? "" : (stryCov_9fa48("2082"), '--branch'), cfg.repoBranch, stryMutAct_9fa48("2083") ? "" : (stryCov_9fa48("2083"), '--single-branch'), authUrl(cfg.repoUrl), dir]), stryMutAct_9fa48("2084") ? {} : (stryCov_9fa48("2084"), {
          timeoutMs: 600000,
          label: stryMutAct_9fa48("2085") ? "" : (stryCov_9fa48("2085"), 'git clone')
        }));
        if (stryMutAct_9fa48("2088") ? r.code === 0 : stryMutAct_9fa48("2087") ? false : stryMutAct_9fa48("2086") ? true : (stryCov_9fa48("2086", "2087", "2088"), r.code !== 0)) throw new Error((stryMutAct_9fa48("2089") ? "" : (stryCov_9fa48("2089"), 'git clone failed: ')) + (stryMutAct_9fa48("2090") ? r.stderr : (stryCov_9fa48("2090"), r.stderr.slice(stryMutAct_9fa48("2091") ? +400 : (stryCov_9fa48("2091"), -400)))));
      }
    }
    const head = await run(stryMutAct_9fa48("2092") ? [] : (stryCov_9fa48("2092"), [stryMutAct_9fa48("2093") ? "" : (stryCov_9fa48("2093"), 'git'), stryMutAct_9fa48("2094") ? "" : (stryCov_9fa48("2094"), 'rev-parse'), stryMutAct_9fa48("2095") ? "" : (stryCov_9fa48("2095"), 'HEAD')]), stryMutAct_9fa48("2096") ? {} : (stryCov_9fa48("2096"), {
      cwd: dir,
      timeoutMs: 10000
    }));
    event(stryMutAct_9fa48("2097") ? "" : (stryCov_9fa48("2097"), 'cloning'), (stryMutAct_9fa48("2098") ? "" : (stryCov_9fa48("2098"), 'repo ready at ')) + (stryMutAct_9fa48("2100") ? head.stdout.slice(0, 12) : stryMutAct_9fa48("2099") ? head.stdout.trim() : (stryCov_9fa48("2099", "2100"), head.stdout.trim().slice(0, 12))));
    return stryMutAct_9fa48("2101") ? {} : (stryCov_9fa48("2101"), {
      dir,
      head: stryMutAct_9fa48("2102") ? head.stdout : (stryCov_9fa48("2102"), head.stdout.trim())
    });
  }
}
function readPkg() {
  if (stryMutAct_9fa48("2103")) {
    {}
  } else {
    stryCov_9fa48("2103");
    try {
      if (stryMutAct_9fa48("2104")) {
        {}
      } else {
        stryCov_9fa48("2104");
        return JSON.parse(fs.readFileSync(path.join(repoDir(), stryMutAct_9fa48("2105") ? "" : (stryCov_9fa48("2105"), 'package.json')), stryMutAct_9fa48("2106") ? "" : (stryCov_9fa48("2106"), 'utf8')));
      }
    } catch {
      if (stryMutAct_9fa48("2107")) {
        {}
      } else {
        stryCov_9fa48("2107");
        return {};
      }
    }
  }
}
function detectRunner() {
  if (stryMutAct_9fa48("2108")) {
    {}
  } else {
    stryCov_9fa48("2108");
    const pkg = readPkg();
    const deps = stryMutAct_9fa48("2109") ? {} : (stryCov_9fa48("2109"), {
      ...pkg.dependencies,
      ...pkg.devDependencies
    });
    const testScript = stryMutAct_9fa48("2112") ? pkg.scripts?.test && '' : stryMutAct_9fa48("2111") ? false : stryMutAct_9fa48("2110") ? true : (stryCov_9fa48("2110", "2111", "2112"), (stryMutAct_9fa48("2113") ? pkg.scripts.test : (stryCov_9fa48("2113"), pkg.scripts?.test)) || (stryMutAct_9fa48("2114") ? "Stryker was here!" : (stryCov_9fa48("2114"), '')));
    let testRunner = null;
    if (stryMutAct_9fa48("2117") ? deps.vitest && /\bvitest\b/.test(testScript) : stryMutAct_9fa48("2116") ? false : stryMutAct_9fa48("2115") ? true : (stryCov_9fa48("2115", "2116", "2117"), deps.vitest || /\bvitest\b/.test(testScript))) testRunner = stryMutAct_9fa48("2118") ? "" : (stryCov_9fa48("2118"), 'vitest');else if (stryMutAct_9fa48("2121") ? deps.jest && /\bjest\b/.test(testScript) : stryMutAct_9fa48("2120") ? false : stryMutAct_9fa48("2119") ? true : (stryCov_9fa48("2119", "2120", "2121"), deps.jest || /\bjest\b/.test(testScript))) testRunner = stryMutAct_9fa48("2122") ? "" : (stryCov_9fa48("2122"), 'jest');
    const dir = repoDir();
    const pm = fs.existsSync(path.join(dir, stryMutAct_9fa48("2123") ? "" : (stryCov_9fa48("2123"), 'pnpm-lock.yaml'))) ? stryMutAct_9fa48("2124") ? "" : (stryCov_9fa48("2124"), 'pnpm') : fs.existsSync(path.join(dir, stryMutAct_9fa48("2125") ? "" : (stryCov_9fa48("2125"), 'yarn.lock'))) ? stryMutAct_9fa48("2126") ? "" : (stryCov_9fa48("2126"), 'yarn') : stryMutAct_9fa48("2127") ? "" : (stryCov_9fa48("2127"), 'npm');
    const hasStrykerConfig = stryMutAct_9fa48("2128") ? ['stryker.config.mjs', 'stryker.config.js', 'stryker.config.json', 'stryker.conf.js', 'stryker.conf.json'].every(f => fs.existsSync(path.join(dir, f))) : (stryCov_9fa48("2128"), (stryMutAct_9fa48("2129") ? [] : (stryCov_9fa48("2129"), [stryMutAct_9fa48("2130") ? "" : (stryCov_9fa48("2130"), 'stryker.config.mjs'), stryMutAct_9fa48("2131") ? "" : (stryCov_9fa48("2131"), 'stryker.config.js'), stryMutAct_9fa48("2132") ? "" : (stryCov_9fa48("2132"), 'stryker.config.json'), stryMutAct_9fa48("2133") ? "" : (stryCov_9fa48("2133"), 'stryker.conf.js'), stryMutAct_9fa48("2134") ? "" : (stryCov_9fa48("2134"), 'stryker.conf.json')])).some(stryMutAct_9fa48("2135") ? () => undefined : (stryCov_9fa48("2135"), f => fs.existsSync(path.join(dir, f)))));
    return stryMutAct_9fa48("2136") ? {} : (stryCov_9fa48("2136"), {
      pm,
      testRunner,
      hasStrykerConfig,
      testScript
    });
  }
}

/** UI stack detection — components need different tests than pure logic. */
function detectUi() {
  if (stryMutAct_9fa48("2137")) {
    {}
  } else {
    stryCov_9fa48("2137");
    const pkg = readPkg();
    const deps = stryMutAct_9fa48("2138") ? {} : (stryCov_9fa48("2138"), {
      ...pkg.dependencies,
      ...pkg.devDependencies
    });
    const framework = deps.react ? stryMutAct_9fa48("2139") ? "" : (stryCov_9fa48("2139"), 'react') : deps.vue ? stryMutAct_9fa48("2140") ? "" : (stryCov_9fa48("2140"), 'vue') : deps.svelte ? stryMutAct_9fa48("2141") ? "" : (stryCov_9fa48("2141"), 'svelte') : deps.preact ? stryMutAct_9fa48("2142") ? "" : (stryCov_9fa48("2142"), 'preact') : null;
    if (stryMutAct_9fa48("2145") ? false : stryMutAct_9fa48("2144") ? true : stryMutAct_9fa48("2143") ? framework : (stryCov_9fa48("2143", "2144", "2145"), !framework)) return null;
    const testingLibrary = deps[stryMutAct_9fa48("2146") ? "" : (stryCov_9fa48("2146"), '@testing-library/react')] ? stryMutAct_9fa48("2147") ? "" : (stryCov_9fa48("2147"), '@testing-library/react') : deps[stryMutAct_9fa48("2148") ? "" : (stryCov_9fa48("2148"), '@testing-library/vue')] ? stryMutAct_9fa48("2149") ? "" : (stryCov_9fa48("2149"), '@testing-library/vue') : deps[stryMutAct_9fa48("2150") ? "" : (stryCov_9fa48("2150"), '@testing-library/svelte')] ? stryMutAct_9fa48("2151") ? "" : (stryCov_9fa48("2151"), '@testing-library/svelte') : deps[stryMutAct_9fa48("2152") ? "" : (stryCov_9fa48("2152"), '@testing-library/preact')] ? stryMutAct_9fa48("2153") ? "" : (stryCov_9fa48("2153"), '@testing-library/preact') : deps.enzyme ? stryMutAct_9fa48("2154") ? "" : (stryCov_9fa48("2154"), 'enzyme') : null;
    return stryMutAct_9fa48("2155") ? {} : (stryCov_9fa48("2155"), {
      framework,
      testingLibrary,
      userEvent: stryMutAct_9fa48("2156") ? !deps['@testing-library/user-event'] : (stryCov_9fa48("2156"), !(stryMutAct_9fa48("2157") ? deps['@testing-library/user-event'] : (stryCov_9fa48("2157"), !deps[stryMutAct_9fa48("2158") ? "" : (stryCov_9fa48("2158"), '@testing-library/user-event')]))),
      jestDom: stryMutAct_9fa48("2159") ? !deps['@testing-library/jest-dom'] : (stryCov_9fa48("2159"), !(stryMutAct_9fa48("2160") ? deps['@testing-library/jest-dom'] : (stryCov_9fa48("2160"), !deps[stryMutAct_9fa48("2161") ? "" : (stryCov_9fa48("2161"), '@testing-library/jest-dom')]))),
      domEnv: (stryMutAct_9fa48("2164") ? (deps.jsdom || deps['jest-environment-jsdom']) && deps['happy-dom'] : stryMutAct_9fa48("2163") ? false : stryMutAct_9fa48("2162") ? true : (stryCov_9fa48("2162", "2163", "2164"), (stryMutAct_9fa48("2166") ? deps.jsdom && deps['jest-environment-jsdom'] : stryMutAct_9fa48("2165") ? false : (stryCov_9fa48("2165", "2166"), deps.jsdom || deps[stryMutAct_9fa48("2167") ? "" : (stryCov_9fa48("2167"), 'jest-environment-jsdom')])) || deps[stryMutAct_9fa48("2168") ? "" : (stryCov_9fa48("2168"), 'happy-dom')])) ? stryMutAct_9fa48("2169") ? false : (stryCov_9fa48("2169"), true) : stryMutAct_9fa48("2170") ? true : (stryCov_9fa48("2170"), false)
    });
  }
}
async function install() {
  if (stryMutAct_9fa48("2171")) {
    {}
  } else {
    stryCov_9fa48("2171");
    const dir = repoDir();
    const det = detectRunner();
    if (stryMutAct_9fa48("2174") ? false : stryMutAct_9fa48("2173") ? true : stryMutAct_9fa48("2172") ? det.testRunner : (stryCov_9fa48("2172", "2173", "2174"), !det.testRunner)) throw new Error((stryMutAct_9fa48("2175") ? "" : (stryCov_9fa48("2175"), 'unsupported test runner: only vitest and jest are supported (test script: "')) + det.testScript + (stryMutAct_9fa48("2176") ? "" : (stryCov_9fa48("2176"), '")')));
    let r;
    if (stryMutAct_9fa48("2179") ? det.pm !== 'pnpm' : stryMutAct_9fa48("2178") ? false : stryMutAct_9fa48("2177") ? true : (stryCov_9fa48("2177", "2178", "2179"), det.pm === (stryMutAct_9fa48("2180") ? "" : (stryCov_9fa48("2180"), 'pnpm')))) {
      if (stryMutAct_9fa48("2181")) {
        {}
      } else {
        stryCov_9fa48("2181");
        await run(stryMutAct_9fa48("2182") ? [] : (stryCov_9fa48("2182"), [stryMutAct_9fa48("2183") ? "" : (stryCov_9fa48("2183"), 'corepack'), stryMutAct_9fa48("2184") ? "" : (stryCov_9fa48("2184"), 'enable'), stryMutAct_9fa48("2185") ? "" : (stryCov_9fa48("2185"), 'pnpm')]), stryMutAct_9fa48("2186") ? {} : (stryCov_9fa48("2186"), {
          cwd: dir,
          timeoutMs: 60000
        }));
        r = await run(stryMutAct_9fa48("2187") ? [] : (stryCov_9fa48("2187"), [stryMutAct_9fa48("2188") ? "" : (stryCov_9fa48("2188"), 'corepack'), stryMutAct_9fa48("2189") ? "" : (stryCov_9fa48("2189"), 'pnpm'), stryMutAct_9fa48("2190") ? "" : (stryCov_9fa48("2190"), 'install'), stryMutAct_9fa48("2191") ? "" : (stryCov_9fa48("2191"), '--no-frozen-lockfile')]), stryMutAct_9fa48("2192") ? {} : (stryCov_9fa48("2192"), {
          cwd: dir,
          timeoutMs: 1200000,
          label: stryMutAct_9fa48("2193") ? "" : (stryCov_9fa48("2193"), 'pnpm install')
        }));
      }
    } else if (stryMutAct_9fa48("2196") ? det.pm !== 'yarn' : stryMutAct_9fa48("2195") ? false : stryMutAct_9fa48("2194") ? true : (stryCov_9fa48("2194", "2195", "2196"), det.pm === (stryMutAct_9fa48("2197") ? "" : (stryCov_9fa48("2197"), 'yarn')))) {
      if (stryMutAct_9fa48("2198")) {
        {}
      } else {
        stryCov_9fa48("2198");
        await run(stryMutAct_9fa48("2199") ? [] : (stryCov_9fa48("2199"), [stryMutAct_9fa48("2200") ? "" : (stryCov_9fa48("2200"), 'corepack'), stryMutAct_9fa48("2201") ? "" : (stryCov_9fa48("2201"), 'enable'), stryMutAct_9fa48("2202") ? "" : (stryCov_9fa48("2202"), 'yarn')]), stryMutAct_9fa48("2203") ? {} : (stryCov_9fa48("2203"), {
          cwd: dir,
          timeoutMs: 60000
        }));
        r = await run(stryMutAct_9fa48("2204") ? [] : (stryCov_9fa48("2204"), [stryMutAct_9fa48("2205") ? "" : (stryCov_9fa48("2205"), 'corepack'), stryMutAct_9fa48("2206") ? "" : (stryCov_9fa48("2206"), 'yarn'), stryMutAct_9fa48("2207") ? "" : (stryCov_9fa48("2207"), 'install'), stryMutAct_9fa48("2208") ? "" : (stryCov_9fa48("2208"), '--no-immutable')]), stryMutAct_9fa48("2209") ? {} : (stryCov_9fa48("2209"), {
          cwd: dir,
          timeoutMs: 1200000,
          label: stryMutAct_9fa48("2210") ? "" : (stryCov_9fa48("2210"), 'yarn install')
        }));
        if (stryMutAct_9fa48("2213") ? r.code === 0 : stryMutAct_9fa48("2212") ? false : stryMutAct_9fa48("2211") ? true : (stryCov_9fa48("2211", "2212", "2213"), r.code !== 0)) r = await run(stryMutAct_9fa48("2214") ? [] : (stryCov_9fa48("2214"), [stryMutAct_9fa48("2215") ? "" : (stryCov_9fa48("2215"), 'corepack'), stryMutAct_9fa48("2216") ? "" : (stryCov_9fa48("2216"), 'yarn'), stryMutAct_9fa48("2217") ? "" : (stryCov_9fa48("2217"), 'install')]), stryMutAct_9fa48("2218") ? {} : (stryCov_9fa48("2218"), {
          cwd: dir,
          timeoutMs: 1200000,
          label: stryMutAct_9fa48("2219") ? "" : (stryCov_9fa48("2219"), 'yarn install')
        }));
      }
    } else {
      if (stryMutAct_9fa48("2220")) {
        {}
      } else {
        stryCov_9fa48("2220");
        const hasLock = fs.existsSync(path.join(dir, stryMutAct_9fa48("2221") ? "" : (stryCov_9fa48("2221"), 'package-lock.json')));
        r = await run(stryMutAct_9fa48("2222") ? [] : (stryCov_9fa48("2222"), [stryMutAct_9fa48("2223") ? "" : (stryCov_9fa48("2223"), 'npm'), hasLock ? stryMutAct_9fa48("2224") ? "" : (stryCov_9fa48("2224"), 'ci') : stryMutAct_9fa48("2225") ? "" : (stryCov_9fa48("2225"), 'install'), stryMutAct_9fa48("2226") ? "" : (stryCov_9fa48("2226"), '--no-audit'), stryMutAct_9fa48("2227") ? "" : (stryCov_9fa48("2227"), '--no-fund')]), stryMutAct_9fa48("2228") ? {} : (stryCov_9fa48("2228"), {
          cwd: dir,
          timeoutMs: 1200000,
          label: stryMutAct_9fa48("2229") ? "" : (stryCov_9fa48("2229"), 'npm install')
        }));
        if (stryMutAct_9fa48("2232") ? r.code !== 0 || hasLock : stryMutAct_9fa48("2231") ? false : stryMutAct_9fa48("2230") ? true : (stryCov_9fa48("2230", "2231", "2232"), (stryMutAct_9fa48("2234") ? r.code === 0 : stryMutAct_9fa48("2233") ? true : (stryCov_9fa48("2233", "2234"), r.code !== 0)) && hasLock)) r = await run(stryMutAct_9fa48("2235") ? [] : (stryCov_9fa48("2235"), [stryMutAct_9fa48("2236") ? "" : (stryCov_9fa48("2236"), 'npm'), stryMutAct_9fa48("2237") ? "" : (stryCov_9fa48("2237"), 'install'), stryMutAct_9fa48("2238") ? "" : (stryCov_9fa48("2238"), '--no-audit'), stryMutAct_9fa48("2239") ? "" : (stryCov_9fa48("2239"), '--no-fund')]), stryMutAct_9fa48("2240") ? {} : (stryCov_9fa48("2240"), {
          cwd: dir,
          timeoutMs: 1200000,
          label: stryMutAct_9fa48("2241") ? "" : (stryCov_9fa48("2241"), 'npm install')
        }));
      }
    }
    if (stryMutAct_9fa48("2244") ? r.code === 0 : stryMutAct_9fa48("2243") ? false : stryMutAct_9fa48("2242") ? true : (stryCov_9fa48("2242", "2243", "2244"), r.code !== 0)) throw new Error((stryMutAct_9fa48("2245") ? "" : (stryCov_9fa48("2245"), 'dependency install failed: ')) + (stryMutAct_9fa48("2246") ? r.stderr || r.stdout : (stryCov_9fa48("2246"), (stryMutAct_9fa48("2249") ? r.stderr && r.stdout : stryMutAct_9fa48("2248") ? false : stryMutAct_9fa48("2247") ? true : (stryCov_9fa48("2247", "2248", "2249"), r.stderr || r.stdout)).slice(stryMutAct_9fa48("2250") ? +500 : (stryCov_9fa48("2250"), -500)))));

    // Extra tooling: coverage provider for vitest, stryker core + runner plugin.
    const pkg = readPkg();
    const deps = stryMutAct_9fa48("2251") ? {} : (stryCov_9fa48("2251"), {
      ...pkg.dependencies,
      ...pkg.devDependencies
    });
    const extras = stryMutAct_9fa48("2252") ? ["Stryker was here"] : (stryCov_9fa48("2252"), []);
    if (stryMutAct_9fa48("2255") ? det.testRunner === 'vitest' || !deps['@vitest/coverage-v8'] : stryMutAct_9fa48("2254") ? false : stryMutAct_9fa48("2253") ? true : (stryCov_9fa48("2253", "2254", "2255"), (stryMutAct_9fa48("2257") ? det.testRunner !== 'vitest' : stryMutAct_9fa48("2256") ? true : (stryCov_9fa48("2256", "2257"), det.testRunner === (stryMutAct_9fa48("2258") ? "" : (stryCov_9fa48("2258"), 'vitest')))) && (stryMutAct_9fa48("2259") ? deps['@vitest/coverage-v8'] : (stryCov_9fa48("2259"), !deps[stryMutAct_9fa48("2260") ? "" : (stryCov_9fa48("2260"), '@vitest/coverage-v8')])))) {
      if (stryMutAct_9fa48("2261")) {
        {}
      } else {
        stryCov_9fa48("2261");
        // pin coverage provider to installed vitest major/minor to avoid peer clashes
        const v = String(stryMutAct_9fa48("2264") ? deps.vitest && '' : stryMutAct_9fa48("2263") ? false : stryMutAct_9fa48("2262") ? true : (stryCov_9fa48("2262", "2263", "2264"), deps.vitest || (stryMutAct_9fa48("2265") ? "Stryker was here!" : (stryCov_9fa48("2265"), '')))).replace(stryMutAct_9fa48("2268") ? /^[0-9]*/ : stryMutAct_9fa48("2267") ? /^[^0-9]/ : stryMutAct_9fa48("2266") ? /[^0-9]*/ : (stryCov_9fa48("2266", "2267", "2268"), /^[^0-9]*/), stryMutAct_9fa48("2269") ? "Stryker was here!" : (stryCov_9fa48("2269"), ''));
        extras.push((stryMutAct_9fa48("2270") ? "" : (stryCov_9fa48("2270"), '@vitest/coverage-v8@')) + (v ? (stryMutAct_9fa48("2271") ? "" : (stryCov_9fa48("2271"), '~')) + v : stryMutAct_9fa48("2272") ? "" : (stryCov_9fa48("2272"), 'latest')));
      }
    }
    // stryker major must match the installed vitest major: stryker 9 needs vitest>=3,
    // stryker 8 supports vitest 1-2
    let strykerVer = stryMutAct_9fa48("2273") ? "Stryker was here!" : (stryCov_9fa48("2273"), '');
    if (stryMutAct_9fa48("2276") ? det.testRunner !== 'vitest' : stryMutAct_9fa48("2275") ? false : stryMutAct_9fa48("2274") ? true : (stryCov_9fa48("2274", "2275", "2276"), det.testRunner === (stryMutAct_9fa48("2277") ? "" : (stryCov_9fa48("2277"), 'vitest')))) {
      if (stryMutAct_9fa48("2278")) {
        {}
      } else {
        stryCov_9fa48("2278");
        try {
          if (stryMutAct_9fa48("2279")) {
            {}
          } else {
            stryCov_9fa48("2279");
            const v = JSON.parse(fs.readFileSync(path.join(dir, stryMutAct_9fa48("2280") ? "" : (stryCov_9fa48("2280"), 'node_modules'), stryMutAct_9fa48("2281") ? "" : (stryCov_9fa48("2281"), 'vitest'), stryMutAct_9fa48("2282") ? "" : (stryCov_9fa48("2282"), 'package.json')), stryMutAct_9fa48("2283") ? "" : (stryCov_9fa48("2283"), 'utf8'))).version;
            const major = parseInt(v.split(stryMutAct_9fa48("2284") ? "" : (stryCov_9fa48("2284"), '.'))[0], 10);
            if (stryMutAct_9fa48("2288") ? major >= 1 : stryMutAct_9fa48("2287") ? major <= 1 : stryMutAct_9fa48("2286") ? false : stryMutAct_9fa48("2285") ? true : (stryCov_9fa48("2285", "2286", "2287", "2288"), major < 1)) throw new Error(stryMutAct_9fa48("2289") ? `` : (stryCov_9fa48("2289"), `vitest ${v} is too old for mutation testing (need >= 1.0)`));
            strykerVer = (stryMutAct_9fa48("2293") ? major >= 3 : stryMutAct_9fa48("2292") ? major <= 3 : stryMutAct_9fa48("2291") ? false : stryMutAct_9fa48("2290") ? true : (stryCov_9fa48("2290", "2291", "2292", "2293"), major < 3)) ? stryMutAct_9fa48("2294") ? "" : (stryCov_9fa48("2294"), '@8') : stryMutAct_9fa48("2295") ? "Stryker was here!" : (stryCov_9fa48("2295"), '');
            event(stryMutAct_9fa48("2296") ? "" : (stryCov_9fa48("2296"), 'installing'), stryMutAct_9fa48("2297") ? `` : (stryCov_9fa48("2297"), `vitest ${v} detected → stryker${stryMutAct_9fa48("2300") ? strykerVer && ' latest' : stryMutAct_9fa48("2299") ? false : stryMutAct_9fa48("2298") ? true : (stryCov_9fa48("2298", "2299", "2300"), strykerVer || (stryMutAct_9fa48("2301") ? "" : (stryCov_9fa48("2301"), ' latest')))}`));
          }
        } catch (e) {
          if (stryMutAct_9fa48("2302")) {
            {}
          } else {
            stryCov_9fa48("2302");
            if (stryMutAct_9fa48("2304") ? false : stryMutAct_9fa48("2303") ? true : (stryCov_9fa48("2303", "2304"), /too old/.test(e.message))) throw e;
          }
        }
      }
    }
    if (stryMutAct_9fa48("2307") ? false : stryMutAct_9fa48("2306") ? true : stryMutAct_9fa48("2305") ? deps['@stryker-mutator/core'] : (stryCov_9fa48("2305", "2306", "2307"), !deps[stryMutAct_9fa48("2308") ? "" : (stryCov_9fa48("2308"), '@stryker-mutator/core')])) extras.push((stryMutAct_9fa48("2309") ? "" : (stryCov_9fa48("2309"), '@stryker-mutator/core')) + strykerVer);
    const plugin = (stryMutAct_9fa48("2312") ? det.testRunner !== 'vitest' : stryMutAct_9fa48("2311") ? false : stryMutAct_9fa48("2310") ? true : (stryCov_9fa48("2310", "2311", "2312"), det.testRunner === (stryMutAct_9fa48("2313") ? "" : (stryCov_9fa48("2313"), 'vitest')))) ? stryMutAct_9fa48("2314") ? "" : (stryCov_9fa48("2314"), '@stryker-mutator/vitest-runner') : stryMutAct_9fa48("2315") ? "" : (stryCov_9fa48("2315"), '@stryker-mutator/jest-runner');
    if (stryMutAct_9fa48("2318") ? false : stryMutAct_9fa48("2317") ? true : stryMutAct_9fa48("2316") ? deps[plugin] : (stryCov_9fa48("2316", "2317", "2318"), !deps[plugin])) extras.push(stryMutAct_9fa48("2319") ? plugin - strykerVer : (stryCov_9fa48("2319"), plugin + strykerVer));
    if (stryMutAct_9fa48("2321") ? false : stryMutAct_9fa48("2320") ? true : (stryCov_9fa48("2320", "2321"), extras.length)) {
      if (stryMutAct_9fa48("2322")) {
        {}
      } else {
        stryCov_9fa48("2322");
        event(stryMutAct_9fa48("2323") ? "" : (stryCov_9fa48("2323"), 'installing'), (stryMutAct_9fa48("2324") ? "" : (stryCov_9fa48("2324"), 'adding tooling via ')) + det.pm + (stryMutAct_9fa48("2325") ? "" : (stryCov_9fa48("2325"), ': ')) + extras.join(stryMutAct_9fa48("2326") ? "" : (stryCov_9fa48("2326"), ', ')));
        // use the repo's own package manager — npm corrupts pnpm/yarn-managed node_modules
        let argv;
        if (stryMutAct_9fa48("2329") ? det.pm !== 'pnpm' : stryMutAct_9fa48("2328") ? false : stryMutAct_9fa48("2327") ? true : (stryCov_9fa48("2327", "2328", "2329"), det.pm === (stryMutAct_9fa48("2330") ? "" : (stryCov_9fa48("2330"), 'pnpm')))) argv = stryMutAct_9fa48("2331") ? [] : (stryCov_9fa48("2331"), [stryMutAct_9fa48("2332") ? "" : (stryCov_9fa48("2332"), 'corepack'), stryMutAct_9fa48("2333") ? "" : (stryCov_9fa48("2333"), 'pnpm'), stryMutAct_9fa48("2334") ? "" : (stryCov_9fa48("2334"), 'add'), stryMutAct_9fa48("2335") ? "" : (stryCov_9fa48("2335"), '-D'), ...extras]);else if (stryMutAct_9fa48("2338") ? det.pm !== 'yarn' : stryMutAct_9fa48("2337") ? false : stryMutAct_9fa48("2336") ? true : (stryCov_9fa48("2336", "2337", "2338"), det.pm === (stryMutAct_9fa48("2339") ? "" : (stryCov_9fa48("2339"), 'yarn')))) argv = stryMutAct_9fa48("2340") ? [] : (stryCov_9fa48("2340"), [stryMutAct_9fa48("2341") ? "" : (stryCov_9fa48("2341"), 'corepack'), stryMutAct_9fa48("2342") ? "" : (stryCov_9fa48("2342"), 'yarn'), stryMutAct_9fa48("2343") ? "" : (stryCov_9fa48("2343"), 'add'), stryMutAct_9fa48("2344") ? "" : (stryCov_9fa48("2344"), '-D'), ...extras]);else argv = stryMutAct_9fa48("2345") ? [] : (stryCov_9fa48("2345"), [stryMutAct_9fa48("2346") ? "" : (stryCov_9fa48("2346"), 'npm'), stryMutAct_9fa48("2347") ? "" : (stryCov_9fa48("2347"), 'install'), stryMutAct_9fa48("2348") ? "" : (stryCov_9fa48("2348"), '--no-save'), stryMutAct_9fa48("2349") ? "" : (stryCov_9fa48("2349"), '--no-audit'), stryMutAct_9fa48("2350") ? "" : (stryCov_9fa48("2350"), '--no-fund'), ...extras]);
        let r2 = await run(argv, stryMutAct_9fa48("2351") ? {} : (stryCov_9fa48("2351"), {
          cwd: dir,
          timeoutMs: 900000,
          label: stryMutAct_9fa48("2352") ? "" : (stryCov_9fa48("2352"), 'tooling install')
        }));
        if (stryMutAct_9fa48("2355") ? r2.code !== 0 || argv[0] === 'npm' : stryMutAct_9fa48("2354") ? false : stryMutAct_9fa48("2353") ? true : (stryCov_9fa48("2353", "2354", "2355"), (stryMutAct_9fa48("2357") ? r2.code === 0 : stryMutAct_9fa48("2356") ? true : (stryCov_9fa48("2356", "2357"), r2.code !== 0)) && (stryMutAct_9fa48("2359") ? argv[0] !== 'npm' : stryMutAct_9fa48("2358") ? true : (stryCov_9fa48("2358", "2359"), argv[0] === (stryMutAct_9fa48("2360") ? "" : (stryCov_9fa48("2360"), 'npm')))))) {
          if (stryMutAct_9fa48("2361")) {
            {}
          } else {
            stryCov_9fa48("2361");
            // peer conflicts: retry lenient (NOT default — legacy mode prunes auto-installed peers)
            r2 = await run(stryMutAct_9fa48("2362") ? [] : (stryCov_9fa48("2362"), [...argv, stryMutAct_9fa48("2363") ? "" : (stryCov_9fa48("2363"), '--legacy-peer-deps')]), stryMutAct_9fa48("2364") ? {} : (stryCov_9fa48("2364"), {
              cwd: dir,
              timeoutMs: 900000,
              label: stryMutAct_9fa48("2365") ? "" : (stryCov_9fa48("2365"), 'tooling install (legacy peers)')
            }));
          }
        }
        if (stryMutAct_9fa48("2368") ? r2.code === 0 : stryMutAct_9fa48("2367") ? false : stryMutAct_9fa48("2366") ? true : (stryCov_9fa48("2366", "2367", "2368"), r2.code !== 0)) throw new Error((stryMutAct_9fa48("2369") ? "" : (stryCov_9fa48("2369"), 'tooling install failed: ')) + (stryMutAct_9fa48("2370") ? r2.stderr || r2.stdout : (stryCov_9fa48("2370"), (stryMutAct_9fa48("2373") ? r2.stderr && r2.stdout : stryMutAct_9fa48("2372") ? false : stryMutAct_9fa48("2371") ? true : (stryCov_9fa48("2371", "2372", "2373"), r2.stderr || r2.stdout)).slice(stryMutAct_9fa48("2374") ? +500 : (stryCov_9fa48("2374"), -500)))));
      }
    }
    // optional post-install setup (e.g. build step so self-referencing imports resolve)
    const setupScript = stryMutAct_9fa48("2376") ? state.run.config?.setupScript : stryMutAct_9fa48("2375") ? state.run?.config.setupScript : (stryCov_9fa48("2375", "2376"), state.run?.config?.setupScript);
    if (stryMutAct_9fa48("2379") ? setupScript || pkg.scripts?.[setupScript] : stryMutAct_9fa48("2378") ? false : stryMutAct_9fa48("2377") ? true : (stryCov_9fa48("2377", "2378", "2379"), setupScript && (stryMutAct_9fa48("2380") ? pkg.scripts[setupScript] : (stryCov_9fa48("2380"), pkg.scripts?.[setupScript])))) {
      if (stryMutAct_9fa48("2381")) {
        {}
      } else {
        stryCov_9fa48("2381");
        event(stryMutAct_9fa48("2382") ? "" : (stryCov_9fa48("2382"), 'installing'), stryMutAct_9fa48("2383") ? `` : (stryCov_9fa48("2383"), `running setup script: ${det.pm} run ${setupScript}`));
        const pmRun = (stryMutAct_9fa48("2386") ? det.pm !== 'npm' : stryMutAct_9fa48("2385") ? false : stryMutAct_9fa48("2384") ? true : (stryCov_9fa48("2384", "2385", "2386"), det.pm === (stryMutAct_9fa48("2387") ? "" : (stryCov_9fa48("2387"), 'npm')))) ? stryMutAct_9fa48("2388") ? [] : (stryCov_9fa48("2388"), [stryMutAct_9fa48("2389") ? "" : (stryCov_9fa48("2389"), 'npm'), stryMutAct_9fa48("2390") ? "" : (stryCov_9fa48("2390"), 'run')]) : stryMutAct_9fa48("2391") ? [] : (stryCov_9fa48("2391"), [stryMutAct_9fa48("2392") ? "" : (stryCov_9fa48("2392"), 'corepack'), det.pm, stryMutAct_9fa48("2393") ? "" : (stryCov_9fa48("2393"), 'run')]);
        const r3 = await run(stryMutAct_9fa48("2394") ? [] : (stryCov_9fa48("2394"), [...pmRun, setupScript]), stryMutAct_9fa48("2395") ? {} : (stryCov_9fa48("2395"), {
          cwd: dir,
          timeoutMs: 900000,
          label: (stryMutAct_9fa48("2396") ? "" : (stryCov_9fa48("2396"), 'setup ')) + setupScript
        }));
        if (stryMutAct_9fa48("2399") ? r3.code === 0 : stryMutAct_9fa48("2398") ? false : stryMutAct_9fa48("2397") ? true : (stryCov_9fa48("2397", "2398", "2399"), r3.code !== 0)) throw new Error((stryMutAct_9fa48("2400") ? `` : (stryCov_9fa48("2400"), `setup script "${setupScript}" failed: `)) + (stryMutAct_9fa48("2401") ? r3.stderr || r3.stdout : (stryCov_9fa48("2401"), (stryMutAct_9fa48("2404") ? r3.stderr && r3.stdout : stryMutAct_9fa48("2403") ? false : stryMutAct_9fa48("2402") ? true : (stryCov_9fa48("2402", "2403", "2404"), r3.stderr || r3.stdout)).slice(stryMutAct_9fa48("2405") ? +500 : (stryCov_9fa48("2405"), -500)))));
      }
    }
    state.runner = det;
    event(stryMutAct_9fa48("2406") ? "" : (stryCov_9fa48("2406"), 'installing'), stryMutAct_9fa48("2407") ? `` : (stryCov_9fa48("2407"), `deps ready (pm=${det.pm}, runner=${det.testRunner}, strykerConfig=${det.hasStrykerConfig})`));
    return det;
  }
}
async function listScopeFiles() {
  if (stryMutAct_9fa48("2408")) {
    {}
  } else {
    stryCov_9fa48("2408");
    const dir = repoDir();
    const cfg = state.run.config;
    const r = await run(stryMutAct_9fa48("2409") ? [] : (stryCov_9fa48("2409"), [stryMutAct_9fa48("2410") ? "" : (stryCov_9fa48("2410"), 'git'), stryMutAct_9fa48("2411") ? "" : (stryCov_9fa48("2411"), 'ls-files')]), stryMutAct_9fa48("2412") ? {} : (stryCov_9fa48("2412"), {
      cwd: dir,
      timeoutMs: 30000
    }));
    if (stryMutAct_9fa48("2415") ? r.code === 0 : stryMutAct_9fa48("2414") ? false : stryMutAct_9fa48("2413") ? true : (stryCov_9fa48("2413", "2414", "2415"), r.code !== 0)) throw new Error(stryMutAct_9fa48("2416") ? "" : (stryCov_9fa48("2416"), 'git ls-files failed'));
    const match = globsToMatcher(cfg.scopeGlob);
    const isTest = stryMutAct_9fa48("2417") ? () => undefined : (stryCov_9fa48("2417"), (() => {
      const isTest = p => stryMutAct_9fa48("2420") ? /(^|\/)(tests?|__tests__|__mocks__|spec)\//.test(p) && /\.(test|spec)\.[cm]?[jt]sx?$/.test(p) : stryMutAct_9fa48("2419") ? false : stryMutAct_9fa48("2418") ? true : (stryCov_9fa48("2418", "2419", "2420"), (stryMutAct_9fa48("2422") ? /(^|\/)(tests|__tests__|__mocks__|spec)\// : stryMutAct_9fa48("2421") ? /(\/)(tests?|__tests__|__mocks__|spec)\// : (stryCov_9fa48("2421", "2422"), /(^|\/)(tests?|__tests__|__mocks__|spec)\//)).test(p) || (stryMutAct_9fa48("2427") ? /\.(test|spec)\.[cm]?[jt]sx$/ : stryMutAct_9fa48("2426") ? /\.(test|spec)\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("2425") ? /\.(test|spec)\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("2424") ? /\.(test|spec)\.[cm][jt]sx?$/ : stryMutAct_9fa48("2423") ? /\.(test|spec)\.[cm]?[jt]sx?/ : (stryCov_9fa48("2423", "2424", "2425", "2426", "2427"), /\.(test|spec)\.[cm]?[jt]sx?$/)).test(p));
      return isTest;
    })());
    const tracked = stryMutAct_9fa48("2428") ? r.stdout.split('\n').map(s => s.trim()) : (stryCov_9fa48("2428"), r.stdout.split(stryMutAct_9fa48("2429") ? "" : (stryCov_9fa48("2429"), '\n')).map(stryMutAct_9fa48("2430") ? () => undefined : (stryCov_9fa48("2430"), s => stryMutAct_9fa48("2431") ? s : (stryCov_9fa48("2431"), s.trim()))).filter(Boolean));
    // Snapshot the tests the repo already owns. We are only ever allowed to ADD test
    // files — every prompt says so — but nothing enforced it: the write allowlist
    // checks that a path LOOKS like a test, and a repo's own test looks exactly like
    // one. A model echoing the style-reference path would overwrite a real test, and
    // a failed attempt's cleanup would then delete it.
    state.repoOwnedTests = stryMutAct_9fa48("2432") ? tracked : (stryCov_9fa48("2432"), tracked.filter(stryMutAct_9fa48("2433") ? () => undefined : (stryCov_9fa48("2433"), p => TEST_PATH_RE.test(p))));
    const files = stryMutAct_9fa48("2438") ? tracked.filter(p => !/\.d\.[cm]?ts$/.test(p) && !/\.test-d\./.test(p) && !/\.config\.[cm]?[jt]s$/.test(p)).filter(p => !isTest(p)).filter(p => !/(^|\/)(node_modules|dist|build|coverage|\.stryker-tmp)\//.test(p)).filter(match) : stryMutAct_9fa48("2437") ? tracked.filter(p => /\.[cm]?[jt]sx?$/.test(p)).filter(p => !isTest(p)).filter(p => !/(^|\/)(node_modules|dist|build|coverage|\.stryker-tmp)\//.test(p)).filter(match) : stryMutAct_9fa48("2436") ? tracked.filter(p => /\.[cm]?[jt]sx?$/.test(p)).filter(p => !/\.d\.[cm]?ts$/.test(p) && !/\.test-d\./.test(p) && !/\.config\.[cm]?[jt]s$/.test(p)).filter(p => !/(^|\/)(node_modules|dist|build|coverage|\.stryker-tmp)\//.test(p)).filter(match) : stryMutAct_9fa48("2435") ? tracked.filter(p => /\.[cm]?[jt]sx?$/.test(p)).filter(p => !/\.d\.[cm]?ts$/.test(p) && !/\.test-d\./.test(p) && !/\.config\.[cm]?[jt]s$/.test(p)).filter(p => !isTest(p)).filter(match) : stryMutAct_9fa48("2434") ? tracked.filter(p => /\.[cm]?[jt]sx?$/.test(p)).filter(p => !/\.d\.[cm]?ts$/.test(p) && !/\.test-d\./.test(p) && !/\.config\.[cm]?[jt]s$/.test(p)).filter(p => !isTest(p)).filter(p => !/(^|\/)(node_modules|dist|build|coverage|\.stryker-tmp)\//.test(p)) : (stryCov_9fa48("2434", "2435", "2436", "2437", "2438"), tracked.filter(stryMutAct_9fa48("2439") ? () => undefined : (stryCov_9fa48("2439"), p => (stryMutAct_9fa48("2444") ? /\.[cm]?[jt]sx$/ : stryMutAct_9fa48("2443") ? /\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("2442") ? /\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("2441") ? /\.[cm][jt]sx?$/ : stryMutAct_9fa48("2440") ? /\.[cm]?[jt]sx?/ : (stryCov_9fa48("2440", "2441", "2442", "2443", "2444"), /\.[cm]?[jt]sx?$/)).test(p))).filter(stryMutAct_9fa48("2445") ? () => undefined : (stryCov_9fa48("2445"), p => stryMutAct_9fa48("2448") ? !/\.d\.[cm]?ts$/.test(p) && !/\.test-d\./.test(p) || !/\.config\.[cm]?[jt]s$/.test(p) : stryMutAct_9fa48("2447") ? false : stryMutAct_9fa48("2446") ? true : (stryCov_9fa48("2446", "2447", "2448"), (stryMutAct_9fa48("2450") ? !/\.d\.[cm]?ts$/.test(p) || !/\.test-d\./.test(p) : stryMutAct_9fa48("2449") ? true : (stryCov_9fa48("2449", "2450"), (stryMutAct_9fa48("2451") ? /\.d\.[cm]?ts$/.test(p) : (stryCov_9fa48("2451"), !(stryMutAct_9fa48("2454") ? /\.d\.[^cm]?ts$/ : stryMutAct_9fa48("2453") ? /\.d\.[cm]ts$/ : stryMutAct_9fa48("2452") ? /\.d\.[cm]?ts/ : (stryCov_9fa48("2452", "2453", "2454"), /\.d\.[cm]?ts$/)).test(p))) && (stryMutAct_9fa48("2455") ? /\.test-d\./.test(p) : (stryCov_9fa48("2455"), !/\.test-d\./.test(p))))) && (stryMutAct_9fa48("2456") ? /\.config\.[cm]?[jt]s$/.test(p) : (stryCov_9fa48("2456"), !(stryMutAct_9fa48("2460") ? /\.config\.[cm]?[^jt]s$/ : stryMutAct_9fa48("2459") ? /\.config\.[^cm]?[jt]s$/ : stryMutAct_9fa48("2458") ? /\.config\.[cm][jt]s$/ : stryMutAct_9fa48("2457") ? /\.config\.[cm]?[jt]s/ : (stryCov_9fa48("2457", "2458", "2459", "2460"), /\.config\.[cm]?[jt]s$/)).test(p)))))).filter(stryMutAct_9fa48("2461") ? () => undefined : (stryCov_9fa48("2461"), p => stryMutAct_9fa48("2462") ? isTest(p) : (stryCov_9fa48("2462"), !isTest(p)))).filter(stryMutAct_9fa48("2463") ? () => undefined : (stryCov_9fa48("2463"), p => stryMutAct_9fa48("2464") ? /(^|\/)(node_modules|dist|build|coverage|\.stryker-tmp)\//.test(p) : (stryCov_9fa48("2464"), !(stryMutAct_9fa48("2465") ? /(\/)(node_modules|dist|build|coverage|\.stryker-tmp)\// : (stryCov_9fa48("2465"), /(^|\/)(node_modules|dist|build|coverage|\.stryker-tmp)\//)).test(p)))).filter(match));
    for (const p of files) upsertFile(p, {});
    return files;
  }
}
async function createBranch(name) {
  if (stryMutAct_9fa48("2466")) {
    {}
  } else {
    stryCov_9fa48("2466");
    const dir = repoDir();
    const cfg = state.run.config;
    await run(stryMutAct_9fa48("2467") ? [] : (stryCov_9fa48("2467"), [stryMutAct_9fa48("2468") ? "" : (stryCov_9fa48("2468"), 'git'), stryMutAct_9fa48("2469") ? "" : (stryCov_9fa48("2469"), 'checkout'), stryMutAct_9fa48("2470") ? "" : (stryCov_9fa48("2470"), '-f'), cfg.repoBranch]), stryMutAct_9fa48("2471") ? {} : (stryCov_9fa48("2471"), {
      cwd: dir,
      timeoutMs: 60000
    }));
    await run(stryMutAct_9fa48("2472") ? [] : (stryCov_9fa48("2472"), [stryMutAct_9fa48("2473") ? "" : (stryCov_9fa48("2473"), 'git'), stryMutAct_9fa48("2474") ? "" : (stryCov_9fa48("2474"), 'clean'), stryMutAct_9fa48("2475") ? "" : (stryCov_9fa48("2475"), '-fd'), stryMutAct_9fa48("2476") ? "" : (stryCov_9fa48("2476"), '-e'), stryMutAct_9fa48("2477") ? "" : (stryCov_9fa48("2477"), 'node_modules')]), stryMutAct_9fa48("2478") ? {} : (stryCov_9fa48("2478"), {
      cwd: dir,
      timeoutMs: 60000
    }));
    const r = await run(stryMutAct_9fa48("2479") ? [] : (stryCov_9fa48("2479"), [stryMutAct_9fa48("2480") ? "" : (stryCov_9fa48("2480"), 'git'), stryMutAct_9fa48("2481") ? "" : (stryCov_9fa48("2481"), 'checkout'), stryMutAct_9fa48("2482") ? "" : (stryCov_9fa48("2482"), '-B'), name, cfg.repoBranch]), stryMutAct_9fa48("2483") ? {} : (stryCov_9fa48("2483"), {
      cwd: dir,
      timeoutMs: 60000
    }));
    if (stryMutAct_9fa48("2486") ? r.code === 0 : stryMutAct_9fa48("2485") ? false : stryMutAct_9fa48("2484") ? true : (stryCov_9fa48("2484", "2485", "2486"), r.code !== 0)) throw new Error((stryMutAct_9fa48("2487") ? "" : (stryCov_9fa48("2487"), 'branch create failed: ')) + (stryMutAct_9fa48("2488") ? r.stderr : (stryCov_9fa48("2488"), r.stderr.slice(stryMutAct_9fa48("2489") ? +300 : (stryCov_9fa48("2489"), -300)))));
    event(stryMutAct_9fa48("2490") ? "" : (stryCov_9fa48("2490"), 'branching'), (stryMutAct_9fa48("2491") ? "" : (stryCov_9fa48("2491"), 'working on branch ')) + name);
    return name;
  }
}

/** Discard uncommitted changes on the current branch, keeping its commits. */
async function discardUncommitted() {
  if (stryMutAct_9fa48("2492")) {
    {}
  } else {
    stryCov_9fa48("2492");
    const dir = repoDir();
    await run(stryMutAct_9fa48("2493") ? [] : (stryCov_9fa48("2493"), [stryMutAct_9fa48("2494") ? "" : (stryCov_9fa48("2494"), 'git'), stryMutAct_9fa48("2495") ? "" : (stryCov_9fa48("2495"), 'checkout'), stryMutAct_9fa48("2496") ? "" : (stryCov_9fa48("2496"), '--'), stryMutAct_9fa48("2497") ? "" : (stryCov_9fa48("2497"), '.')]), stryMutAct_9fa48("2498") ? {} : (stryCov_9fa48("2498"), {
      cwd: dir,
      timeoutMs: 60000
    }));
    await run(stryMutAct_9fa48("2499") ? [] : (stryCov_9fa48("2499"), [stryMutAct_9fa48("2500") ? "" : (stryCov_9fa48("2500"), 'git'), stryMutAct_9fa48("2501") ? "" : (stryCov_9fa48("2501"), 'clean'), stryMutAct_9fa48("2502") ? "" : (stryCov_9fa48("2502"), '-fd'), stryMutAct_9fa48("2503") ? "" : (stryCov_9fa48("2503"), '-e'), stryMutAct_9fa48("2504") ? "" : (stryCov_9fa48("2504"), 'node_modules')]), stryMutAct_9fa48("2505") ? {} : (stryCov_9fa48("2505"), {
      cwd: dir,
      timeoutMs: 60000
    }));
  }
}
async function resetToBase() {
  if (stryMutAct_9fa48("2506")) {
    {}
  } else {
    stryCov_9fa48("2506");
    const dir = repoDir();
    const cfg = state.run.config;
    await run(stryMutAct_9fa48("2507") ? [] : (stryCov_9fa48("2507"), [stryMutAct_9fa48("2508") ? "" : (stryCov_9fa48("2508"), 'git'), stryMutAct_9fa48("2509") ? "" : (stryCov_9fa48("2509"), 'checkout'), stryMutAct_9fa48("2510") ? "" : (stryCov_9fa48("2510"), '-f'), cfg.repoBranch]), stryMutAct_9fa48("2511") ? {} : (stryCov_9fa48("2511"), {
      cwd: dir,
      timeoutMs: 60000
    }));
    await run(stryMutAct_9fa48("2512") ? [] : (stryCov_9fa48("2512"), [stryMutAct_9fa48("2513") ? "" : (stryCov_9fa48("2513"), 'git'), stryMutAct_9fa48("2514") ? "" : (stryCov_9fa48("2514"), 'clean'), stryMutAct_9fa48("2515") ? "" : (stryCov_9fa48("2515"), '-fd'), stryMutAct_9fa48("2516") ? "" : (stryCov_9fa48("2516"), '-e'), stryMutAct_9fa48("2517") ? "" : (stryCov_9fa48("2517"), 'node_modules')]), stryMutAct_9fa48("2518") ? {} : (stryCov_9fa48("2518"), {
      cwd: dir,
      timeoutMs: 60000
    }));
  }
}
function readFileSafe(rel, maxLen = 200000) {
  if (stryMutAct_9fa48("2519")) {
    {}
  } else {
    stryCov_9fa48("2519");
    const dir = repoDir();
    const abs = path.resolve(dir, rel);
    if (stryMutAct_9fa48("2522") ? false : stryMutAct_9fa48("2521") ? true : stryMutAct_9fa48("2520") ? abs.startsWith(dir + path.sep) : (stryCov_9fa48("2520", "2521", "2522"), !(stryMutAct_9fa48("2523") ? abs.endsWith(dir + path.sep) : (stryCov_9fa48("2523"), abs.startsWith(stryMutAct_9fa48("2524") ? dir - path.sep : (stryCov_9fa48("2524"), dir + path.sep)))))) throw new Error(stryMutAct_9fa48("2525") ? "" : (stryCov_9fa48("2525"), 'path escapes repo'));
    try {
      if (stryMutAct_9fa48("2526")) {
        {}
      } else {
        stryCov_9fa48("2526");
        return stryMutAct_9fa48("2527") ? fs.readFileSync(abs, 'utf8') : (stryCov_9fa48("2527"), fs.readFileSync(abs, stryMutAct_9fa48("2528") ? "" : (stryCov_9fa48("2528"), 'utf8')).slice(0, maxLen));
      }
    } catch {
      if (stryMutAct_9fa48("2529")) {
        {}
      } else {
        stryCov_9fa48("2529");
        return null;
      }
    }
  }
}
const TEST_PATH_RE = stryMutAct_9fa48("2536") ? /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx$)/ : stryMutAct_9fa48("2535") ? /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[^jt]sx?$)/ : stryMutAct_9fa48("2534") ? /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[^cm]?[jt]sx?$)/ : stryMutAct_9fa48("2533") ? /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm][jt]sx?$)/ : stryMutAct_9fa48("2532") ? /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?)/ : stryMutAct_9fa48("2531") ? /((^|\/)(tests|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/ : stryMutAct_9fa48("2530") ? /((\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/ : (stryCov_9fa48("2530", "2531", "2532", "2533", "2534", "2535", "2536"), /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/);

/**
 * A test WE generated for THIS source file in this run, preferring the coverage
 * bootstrap's — which is proven green against this exact module.
 *
 * This is the one place our own output is the best example available: same file, right
 * import path, right helpers, and it demonstrably runs. Live evidence for needing it —
 * on a zod schema model the bootstrap wrote a green safeParse test, guessTestPath went
 * looking for `<name>.test.ts`, found nothing, and the kill prompt was handed a test
 * from an unrelated file; every kill test then invented `._def.openapi` and died before
 * it could kill anything. findStyleReference still refuses generated tests from OTHER
 * files, where feeding our output back compounds whatever it got wrong.
 */
function ourTestFor(srcRel) {
  if (stryMutAct_9fa48("2537")) {
    {}
  } else {
    stryCov_9fa48("2537");
    const dir = repoDir();
    const guess = guessTestPath(srcRel);
    const base = path.basename(guess.path).replace(stryMutAct_9fa48("2542") ? /\.(test|spec)\.[cm]?[jt]sx$/ : stryMutAct_9fa48("2541") ? /\.(test|spec)\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("2540") ? /\.(test|spec)\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("2539") ? /\.(test|spec)\.[cm][jt]sx?$/ : stryMutAct_9fa48("2538") ? /\.(test|spec)\.[cm]?[jt]sx?/ : (stryCov_9fa48("2538", "2539", "2540", "2541", "2542"), /\.(test|spec)\.[cm]?[jt]sx?$/), stryMutAct_9fa48("2543") ? "Stryker was here!" : (stryCov_9fa48("2543"), ''));
    const stem = base.replace(stryMutAct_9fa48("2553") ? /\.(mac-cov(-r\d+)?|mac|kill-L\d+-[a-z0-9-]+|kill-batch-[^a-z0-9]+)$/ : stryMutAct_9fa48("2552") ? /\.(mac-cov(-r\d+)?|mac|kill-L\d+-[a-z0-9-]+|kill-batch-[a-z0-9])$/ : stryMutAct_9fa48("2551") ? /\.(mac-cov(-r\d+)?|mac|kill-L\d+-[^a-z0-9-]+|kill-batch-[a-z0-9]+)$/ : stryMutAct_9fa48("2550") ? /\.(mac-cov(-r\d+)?|mac|kill-L\d+-[a-z0-9-]|kill-batch-[a-z0-9]+)$/ : stryMutAct_9fa48("2549") ? /\.(mac-cov(-r\d+)?|mac|kill-L\D+-[a-z0-9-]+|kill-batch-[a-z0-9]+)$/ : stryMutAct_9fa48("2548") ? /\.(mac-cov(-r\d+)?|mac|kill-L\d-[a-z0-9-]+|kill-batch-[a-z0-9]+)$/ : stryMutAct_9fa48("2547") ? /\.(mac-cov(-r\D+)?|mac|kill-L\d+-[a-z0-9-]+|kill-batch-[a-z0-9]+)$/ : stryMutAct_9fa48("2546") ? /\.(mac-cov(-r\d)?|mac|kill-L\d+-[a-z0-9-]+|kill-batch-[a-z0-9]+)$/ : stryMutAct_9fa48("2545") ? /\.(mac-cov(-r\d+)|mac|kill-L\d+-[a-z0-9-]+|kill-batch-[a-z0-9]+)$/ : stryMutAct_9fa48("2544") ? /\.(mac-cov(-r\d+)?|mac|kill-L\d+-[a-z0-9-]+|kill-batch-[a-z0-9]+)/ : (stryCov_9fa48("2544", "2545", "2546", "2547", "2548", "2549", "2550", "2551", "2552", "2553"), /\.(mac-cov(-r\d+)?|mac|kill-L\d+-[a-z0-9-]+|kill-batch-[a-z0-9]+)$/), stryMutAct_9fa48("2554") ? "Stryker was here!" : (stryCov_9fa48("2554"), ''));
    const folder = path.dirname(path.join(dir, guess.path));
    let names;
    try {
      if (stryMutAct_9fa48("2555")) {
        {}
      } else {
        stryCov_9fa48("2555");
        names = fs.readdirSync(folder);
      }
    } catch {
      if (stryMutAct_9fa48("2556")) {
        {}
      } else {
        stryCov_9fa48("2556");
        return null;
      }
    }
    const mine = stryMutAct_9fa48("2557") ? names : (stryCov_9fa48("2557"), names.filter(stryMutAct_9fa48("2558") ? () => undefined : (stryCov_9fa48("2558"), n => stryMutAct_9fa48("2561") ? n.startsWith(stem + '.') || GENERATED_TEST_RE.test(n) : stryMutAct_9fa48("2560") ? false : stryMutAct_9fa48("2559") ? true : (stryCov_9fa48("2559", "2560", "2561"), (stryMutAct_9fa48("2562") ? n.endsWith(stem + '.') : (stryCov_9fa48("2562"), n.startsWith(stem + (stryMutAct_9fa48("2563") ? "" : (stryCov_9fa48("2563"), '.'))))) && GENERATED_TEST_RE.test(n)))));
    if (stryMutAct_9fa48("2566") ? false : stryMutAct_9fa48("2565") ? true : stryMutAct_9fa48("2564") ? mine.length : (stryCov_9fa48("2564", "2565", "2566"), !mine.length)) return null;
    // the bootstrap first: it is the one written to make the module RUN
    stryMutAct_9fa48("2567") ? mine : (stryCov_9fa48("2567"), mine.sort(stryMutAct_9fa48("2568") ? () => undefined : (stryCov_9fa48("2568"), (a, b) => stryMutAct_9fa48("2569") ? (a.includes('mac-cov') ? 0 : 1) + (b.includes('mac-cov') ? 0 : 1) : (stryCov_9fa48("2569"), (a.includes(stryMutAct_9fa48("2570") ? "" : (stryCov_9fa48("2570"), 'mac-cov')) ? 0 : 1) - (b.includes(stryMutAct_9fa48("2571") ? "" : (stryCov_9fa48("2571"), 'mac-cov')) ? 0 : 1)))));
    const rel = path.relative(dir, path.join(folder, mine[0])).split(path.sep).join(stryMutAct_9fa48("2572") ? "" : (stryCov_9fa48("2572"), '/'));
    return stryMutAct_9fa48("2573") ? {} : (stryCov_9fa48("2573"), {
      path: rel,
      content: readFileSafe(rel, 12000)
    });
  }
}

/** Tests that existed in the repo before we touched it — never ours to change. */
function isRepoOwnedTest(rel) {
  if (stryMutAct_9fa48("2574")) {
    {}
  } else {
    stryCov_9fa48("2574");
    return (stryMutAct_9fa48("2577") ? state.repoOwnedTests && [] : stryMutAct_9fa48("2576") ? false : stryMutAct_9fa48("2575") ? true : (stryCov_9fa48("2575", "2576", "2577"), state.repoOwnedTests || (stryMutAct_9fa48("2578") ? ["Stryker was here"] : (stryCov_9fa48("2578"), [])))).includes(rel);
  }
}
function writeTestFile(rel, content) {
  if (stryMutAct_9fa48("2579")) {
    {}
  } else {
    stryCov_9fa48("2579");
    if (stryMutAct_9fa48("2582") ? false : stryMutAct_9fa48("2581") ? true : stryMutAct_9fa48("2580") ? TEST_PATH_RE.test(rel) : (stryCov_9fa48("2580", "2581", "2582"), !TEST_PATH_RE.test(rel))) throw new Error((stryMutAct_9fa48("2583") ? "" : (stryCov_9fa48("2583"), 'refusing to write outside test locations: ')) + rel);
    if (stryMutAct_9fa48("2585") ? false : stryMutAct_9fa48("2584") ? true : (stryCov_9fa48("2584", "2585"), isRepoOwnedTest(rel))) throw new Error((stryMutAct_9fa48("2586") ? "" : (stryCov_9fa48("2586"), 'refusing to overwrite a repo-owned test file: ')) + rel);
    if (stryMutAct_9fa48("2589") ? false : stryMutAct_9fa48("2588") ? true : stryMutAct_9fa48("2587") ? /\.[cm]?[jt]sx?$/.test(rel) : (stryCov_9fa48("2587", "2588", "2589"), !(stryMutAct_9fa48("2594") ? /\.[cm]?[jt]sx$/ : stryMutAct_9fa48("2593") ? /\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("2592") ? /\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("2591") ? /\.[cm][jt]sx?$/ : stryMutAct_9fa48("2590") ? /\.[cm]?[jt]sx?/ : (stryCov_9fa48("2590", "2591", "2592", "2593", "2594"), /\.[cm]?[jt]sx?$/)).test(rel))) throw new Error(stryMutAct_9fa48("2595") ? "" : (stryCov_9fa48("2595"), 'test file must be a js/ts file'));
    const dir = repoDir();
    const abs = path.resolve(dir, rel);
    if (stryMutAct_9fa48("2598") ? false : stryMutAct_9fa48("2597") ? true : stryMutAct_9fa48("2596") ? abs.startsWith(dir + path.sep) : (stryCov_9fa48("2596", "2597", "2598"), !(stryMutAct_9fa48("2599") ? abs.endsWith(dir + path.sep) : (stryCov_9fa48("2599"), abs.startsWith(stryMutAct_9fa48("2600") ? dir - path.sep : (stryCov_9fa48("2600"), dir + path.sep)))))) throw new Error(stryMutAct_9fa48("2601") ? "" : (stryCov_9fa48("2601"), 'path escapes repo'));
    fs.mkdirSync(path.dirname(abs), stryMutAct_9fa48("2602") ? {} : (stryCov_9fa48("2602"), {
      recursive: stryMutAct_9fa48("2603") ? false : (stryCov_9fa48("2603"), true)
    }));
    fs.writeFileSync(abs, content);
    return stryMutAct_9fa48("2604") ? {} : (stryCov_9fa48("2604"), {
      path: rel,
      bytes: Buffer.byteLength(content)
    });
  }
}
function deleteTestFile(rel) {
  if (stryMutAct_9fa48("2605")) {
    {}
  } else {
    stryCov_9fa48("2605");
    if (stryMutAct_9fa48("2608") ? false : stryMutAct_9fa48("2607") ? true : stryMutAct_9fa48("2606") ? TEST_PATH_RE.test(rel) : (stryCov_9fa48("2606", "2607", "2608"), !TEST_PATH_RE.test(rel))) throw new Error(stryMutAct_9fa48("2609") ? "" : (stryCov_9fa48("2609"), 'refusing to delete outside test locations'));
    if (stryMutAct_9fa48("2611") ? false : stryMutAct_9fa48("2610") ? true : (stryCov_9fa48("2610", "2611"), isRepoOwnedTest(rel))) throw new Error((stryMutAct_9fa48("2612") ? "" : (stryCov_9fa48("2612"), 'refusing to delete a repo-owned test file: ')) + rel);
    const dir = repoDir();
    const abs = path.resolve(dir, rel);
    if (stryMutAct_9fa48("2615") ? false : stryMutAct_9fa48("2614") ? true : stryMutAct_9fa48("2613") ? abs.startsWith(dir + path.sep) : (stryCov_9fa48("2613", "2614", "2615"), !(stryMutAct_9fa48("2616") ? abs.endsWith(dir + path.sep) : (stryCov_9fa48("2616"), abs.startsWith(stryMutAct_9fa48("2617") ? dir - path.sep : (stryCov_9fa48("2617"), dir + path.sep)))))) throw new Error(stryMutAct_9fa48("2618") ? "" : (stryCov_9fa48("2618"), 'path escapes repo'));
    try {
      if (stryMutAct_9fa48("2619")) {
        {}
      } else {
        stryCov_9fa48("2619");
        fs.unlinkSync(abs);
        return stryMutAct_9fa48("2620") ? false : (stryCov_9fa48("2620"), true);
      }
    } catch {
      if (stryMutAct_9fa48("2621")) {
        {}
      } else {
        stryCov_9fa48("2621");
        return stryMutAct_9fa48("2622") ? true : (stryCov_9fa48("2622"), false);
      }
    }
  }
}

/** Count existing test files per directory (repo-relative), skipping node_modules. */
function testDirCounts() {
  if (stryMutAct_9fa48("2623")) {
    {}
  } else {
    stryCov_9fa48("2623");
    const dir = repoDir();
    const counts = {};
    const walk = (d, depth) => {
      if (stryMutAct_9fa48("2624")) {
        {}
      } else {
        stryCov_9fa48("2624");
        if (stryMutAct_9fa48("2628") ? depth <= 5 : stryMutAct_9fa48("2627") ? depth >= 5 : stryMutAct_9fa48("2626") ? false : stryMutAct_9fa48("2625") ? true : (stryCov_9fa48("2625", "2626", "2627", "2628"), depth > 5)) return;
        let entries;
        try {
          if (stryMutAct_9fa48("2629")) {
            {}
          } else {
            stryCov_9fa48("2629");
            entries = fs.readdirSync(d, stryMutAct_9fa48("2630") ? {} : (stryCov_9fa48("2630"), {
              withFileTypes: stryMutAct_9fa48("2631") ? false : (stryCov_9fa48("2631"), true)
            }));
          }
        } catch {
          if (stryMutAct_9fa48("2632")) {
            {}
          } else {
            stryCov_9fa48("2632");
            return;
          }
        }
        for (const ent of entries) {
          if (stryMutAct_9fa48("2633")) {
            {}
          } else {
            stryCov_9fa48("2633");
            if (stryMutAct_9fa48("2636") ? (ent.name === 'node_modules' || ent.name.startsWith('.') || ent.name === 'dist') && ent.name === 'coverage' : stryMutAct_9fa48("2635") ? false : stryMutAct_9fa48("2634") ? true : (stryCov_9fa48("2634", "2635", "2636"), (stryMutAct_9fa48("2638") ? (ent.name === 'node_modules' || ent.name.startsWith('.')) && ent.name === 'dist' : stryMutAct_9fa48("2637") ? false : (stryCov_9fa48("2637", "2638"), (stryMutAct_9fa48("2640") ? ent.name === 'node_modules' && ent.name.startsWith('.') : stryMutAct_9fa48("2639") ? false : (stryCov_9fa48("2639", "2640"), (stryMutAct_9fa48("2642") ? ent.name !== 'node_modules' : stryMutAct_9fa48("2641") ? false : (stryCov_9fa48("2641", "2642"), ent.name === (stryMutAct_9fa48("2643") ? "" : (stryCov_9fa48("2643"), 'node_modules')))) || (stryMutAct_9fa48("2644") ? ent.name.endsWith('.') : (stryCov_9fa48("2644"), ent.name.startsWith(stryMutAct_9fa48("2645") ? "" : (stryCov_9fa48("2645"), '.')))))) || (stryMutAct_9fa48("2647") ? ent.name !== 'dist' : stryMutAct_9fa48("2646") ? false : (stryCov_9fa48("2646", "2647"), ent.name === (stryMutAct_9fa48("2648") ? "" : (stryCov_9fa48("2648"), 'dist')))))) || (stryMutAct_9fa48("2650") ? ent.name !== 'coverage' : stryMutAct_9fa48("2649") ? false : (stryCov_9fa48("2649", "2650"), ent.name === (stryMutAct_9fa48("2651") ? "" : (stryCov_9fa48("2651"), 'coverage')))))) continue;
            const p = path.join(d, ent.name);
            if (stryMutAct_9fa48("2653") ? false : stryMutAct_9fa48("2652") ? true : (stryCov_9fa48("2652", "2653"), ent.isDirectory())) walk(p, stryMutAct_9fa48("2654") ? depth - 1 : (stryCov_9fa48("2654"), depth + 1));else if (stryMutAct_9fa48("2656") ? false : stryMutAct_9fa48("2655") ? true : (stryCov_9fa48("2655", "2656"), (stryMutAct_9fa48("2661") ? /\.(test|spec)\.[cm]?[jt]sx$/ : stryMutAct_9fa48("2660") ? /\.(test|spec)\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("2659") ? /\.(test|spec)\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("2658") ? /\.(test|spec)\.[cm][jt]sx?$/ : stryMutAct_9fa48("2657") ? /\.(test|spec)\.[cm]?[jt]sx?/ : (stryCov_9fa48("2657", "2658", "2659", "2660", "2661"), /\.(test|spec)\.[cm]?[jt]sx?$/)).test(ent.name))) {
              if (stryMutAct_9fa48("2662")) {
                {}
              } else {
                stryCov_9fa48("2662");
                const rel = path.relative(dir, path.dirname(p)).split(path.sep).join(stryMutAct_9fa48("2663") ? "" : (stryCov_9fa48("2663"), '/'));
                counts[rel] = stryMutAct_9fa48("2664") ? (counts[rel] || 0) - 1 : (stryCov_9fa48("2664"), (stryMutAct_9fa48("2667") ? counts[rel] && 0 : stryMutAct_9fa48("2666") ? false : stryMutAct_9fa48("2665") ? true : (stryCov_9fa48("2665", "2666", "2667"), counts[rel] || 0)) + 1);
              }
            }
          }
        }
      }
    };
    walk(dir, 0);
    return counts;
  }
}

/**
 * When the target file has no test yet, find a sibling test to imitate —
 * it shows the LLM the repo's import aliases, setup and naming conventions.
 * Prefers tests of the same kind (component .tsx/.jsx vs plain .ts/.js).
 */
// Our own output must never be the example. The reference is picked by SIZE, and a
// generated kill test — one `it`, a couple of imports — is routinely the smallest test
// in the repo, so it would win and the model would be shown its own previous work as
// "the repo's conventions". Errors compound and the file drifts further from what the
// team actually writes with every round.
// Every filename this pipeline writes. Three things read it — the style reference
// (never show the model its own output), the repo-owned snapshot (never delete a
// test that was here before us), and the fold (gather what we wrote into one file).
// It has to list every generator: when the sweep replaced the single-target loop,
// `kill-batch-` was absent here, so the fold saw none of its files and every PR
// shipped one test file per sweep call.
const GENERATED_TEST_RE = stryMutAct_9fa48("2672") ? /\.(mac-cov|mac)(-r\d+)?\.test\.|\.kill-(L\D+|batch)-/ : stryMutAct_9fa48("2671") ? /\.(mac-cov|mac)(-r\d+)?\.test\.|\.kill-(L\d|batch)-/ : stryMutAct_9fa48("2670") ? /\.(mac-cov|mac)(-r\D+)?\.test\.|\.kill-(L\d+|batch)-/ : stryMutAct_9fa48("2669") ? /\.(mac-cov|mac)(-r\d)?\.test\.|\.kill-(L\d+|batch)-/ : stryMutAct_9fa48("2668") ? /\.(mac-cov|mac)(-r\d+)\.test\.|\.kill-(L\d+|batch)-/ : (stryCov_9fa48("2668", "2669", "2670", "2671", "2672"), /\.(mac-cov|mac)(-r\d+)?\.test\.|\.kill-(L\d+|batch)-/);
function findStyleReference(srcRel) {
  if (stryMutAct_9fa48("2673")) {
    {}
  } else {
    stryCov_9fa48("2673");
    const dir = repoDir();
    const wantComponent = (stryMutAct_9fa48("2675") ? /\.[^jt]sx$/ : stryMutAct_9fa48("2674") ? /\.[jt]sx/ : (stryCov_9fa48("2674", "2675"), /\.[jt]sx$/)).test(srcRel);
    const matches = stryMutAct_9fa48("2676") ? ["Stryker was here"] : (stryCov_9fa48("2676"), []);
    const walk = (d, depth) => {
      if (stryMutAct_9fa48("2677")) {
        {}
      } else {
        stryCov_9fa48("2677");
        if (stryMutAct_9fa48("2680") ? depth > 5 && matches.length > 200 : stryMutAct_9fa48("2679") ? false : stryMutAct_9fa48("2678") ? true : (stryCov_9fa48("2678", "2679", "2680"), (stryMutAct_9fa48("2683") ? depth <= 5 : stryMutAct_9fa48("2682") ? depth >= 5 : stryMutAct_9fa48("2681") ? false : (stryCov_9fa48("2681", "2682", "2683"), depth > 5)) || (stryMutAct_9fa48("2686") ? matches.length <= 200 : stryMutAct_9fa48("2685") ? matches.length >= 200 : stryMutAct_9fa48("2684") ? false : (stryCov_9fa48("2684", "2685", "2686"), matches.length > 200)))) return;
        let entries;
        try {
          if (stryMutAct_9fa48("2687")) {
            {}
          } else {
            stryCov_9fa48("2687");
            entries = fs.readdirSync(d, stryMutAct_9fa48("2688") ? {} : (stryCov_9fa48("2688"), {
              withFileTypes: stryMutAct_9fa48("2689") ? false : (stryCov_9fa48("2689"), true)
            }));
          }
        } catch {
          if (stryMutAct_9fa48("2690")) {
            {}
          } else {
            stryCov_9fa48("2690");
            return;
          }
        }
        for (const ent of entries) {
          if (stryMutAct_9fa48("2691")) {
            {}
          } else {
            stryCov_9fa48("2691");
            if (stryMutAct_9fa48("2694") ? (ent.name === 'node_modules' || ent.name.startsWith('.') || ent.name === 'dist') && ent.name === 'coverage' : stryMutAct_9fa48("2693") ? false : stryMutAct_9fa48("2692") ? true : (stryCov_9fa48("2692", "2693", "2694"), (stryMutAct_9fa48("2696") ? (ent.name === 'node_modules' || ent.name.startsWith('.')) && ent.name === 'dist' : stryMutAct_9fa48("2695") ? false : (stryCov_9fa48("2695", "2696"), (stryMutAct_9fa48("2698") ? ent.name === 'node_modules' && ent.name.startsWith('.') : stryMutAct_9fa48("2697") ? false : (stryCov_9fa48("2697", "2698"), (stryMutAct_9fa48("2700") ? ent.name !== 'node_modules' : stryMutAct_9fa48("2699") ? false : (stryCov_9fa48("2699", "2700"), ent.name === (stryMutAct_9fa48("2701") ? "" : (stryCov_9fa48("2701"), 'node_modules')))) || (stryMutAct_9fa48("2702") ? ent.name.endsWith('.') : (stryCov_9fa48("2702"), ent.name.startsWith(stryMutAct_9fa48("2703") ? "" : (stryCov_9fa48("2703"), '.')))))) || (stryMutAct_9fa48("2705") ? ent.name !== 'dist' : stryMutAct_9fa48("2704") ? false : (stryCov_9fa48("2704", "2705"), ent.name === (stryMutAct_9fa48("2706") ? "" : (stryCov_9fa48("2706"), 'dist')))))) || (stryMutAct_9fa48("2708") ? ent.name !== 'coverage' : stryMutAct_9fa48("2707") ? false : (stryCov_9fa48("2707", "2708"), ent.name === (stryMutAct_9fa48("2709") ? "" : (stryCov_9fa48("2709"), 'coverage')))))) continue;
            const p = path.join(d, ent.name);
            if (stryMutAct_9fa48("2711") ? false : stryMutAct_9fa48("2710") ? true : (stryCov_9fa48("2710", "2711"), ent.isDirectory())) walk(p, stryMutAct_9fa48("2712") ? depth - 1 : (stryCov_9fa48("2712"), depth + 1));else if (stryMutAct_9fa48("2715") ? /\.(test|spec)\.[cm]?[jt]sx?$/.test(ent.name) || !GENERATED_TEST_RE.test(ent.name) : stryMutAct_9fa48("2714") ? false : stryMutAct_9fa48("2713") ? true : (stryCov_9fa48("2713", "2714", "2715"), (stryMutAct_9fa48("2720") ? /\.(test|spec)\.[cm]?[jt]sx$/ : stryMutAct_9fa48("2719") ? /\.(test|spec)\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("2718") ? /\.(test|spec)\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("2717") ? /\.(test|spec)\.[cm][jt]sx?$/ : stryMutAct_9fa48("2716") ? /\.(test|spec)\.[cm]?[jt]sx?/ : (stryCov_9fa48("2716", "2717", "2718", "2719", "2720"), /\.(test|spec)\.[cm]?[jt]sx?$/)).test(ent.name) && (stryMutAct_9fa48("2721") ? GENERATED_TEST_RE.test(ent.name) : (stryCov_9fa48("2721"), !GENERATED_TEST_RE.test(ent.name))))) matches.push(p);
          }
        }
      }
    };
    walk(dir, 0);
    if (stryMutAct_9fa48("2724") ? false : stryMutAct_9fa48("2723") ? true : stryMutAct_9fa48("2722") ? matches.length : (stryCov_9fa48("2722", "2723", "2724"), !matches.length)) return null;
    const sameKind = stryMutAct_9fa48("2725") ? matches : (stryCov_9fa48("2725"), matches.filter(stryMutAct_9fa48("2726") ? () => undefined : (stryCov_9fa48("2726"), p => stryMutAct_9fa48("2729") ? /x$/.test(p) !== wantComponent : stryMutAct_9fa48("2728") ? false : stryMutAct_9fa48("2727") ? true : (stryCov_9fa48("2727", "2728", "2729"), (stryMutAct_9fa48("2730") ? /x/ : (stryCov_9fa48("2730"), /x$/)).test(p) === wantComponent))));
    const pool = sameKind.length ? sameKind : matches;
    // smallest file of the right kind → most digestible reference
    let best = null,
      bestSize = Infinity;
    for (const p of pool) {
      if (stryMutAct_9fa48("2731")) {
        {}
      } else {
        stryCov_9fa48("2731");
        try {
          if (stryMutAct_9fa48("2732")) {
            {}
          } else {
            stryCov_9fa48("2732");
            const size = fs.statSync(p).size;
            if (stryMutAct_9fa48("2735") ? size > 300 || size < bestSize : stryMutAct_9fa48("2734") ? false : stryMutAct_9fa48("2733") ? true : (stryCov_9fa48("2733", "2734", "2735"), (stryMutAct_9fa48("2738") ? size <= 300 : stryMutAct_9fa48("2737") ? size >= 300 : stryMutAct_9fa48("2736") ? true : (stryCov_9fa48("2736", "2737", "2738"), size > 300)) && (stryMutAct_9fa48("2741") ? size >= bestSize : stryMutAct_9fa48("2740") ? size <= bestSize : stryMutAct_9fa48("2739") ? true : (stryCov_9fa48("2739", "2740", "2741"), size < bestSize)))) {
              if (stryMutAct_9fa48("2742")) {
                {}
              } else {
                stryCov_9fa48("2742");
                best = p;
                bestSize = size;
              }
            }
          }
        } catch {}
      }
    }
    if (stryMutAct_9fa48("2745") ? false : stryMutAct_9fa48("2744") ? true : stryMutAct_9fa48("2743") ? best : (stryCov_9fa48("2743", "2744", "2745"), !best)) return null;
    const rel = path.relative(dir, best).split(path.sep).join(stryMutAct_9fa48("2746") ? "" : (stryCov_9fa48("2746"), '/'));
    return stryMutAct_9fa48("2747") ? {} : (stryCov_9fa48("2747"), {
      path: rel,
      content: stryMutAct_9fa48("2748") ? fs.readFileSync(best, 'utf8') : (stryCov_9fa48("2748"), fs.readFileSync(best, stryMutAct_9fa48("2749") ? "" : (stryCov_9fa48("2749"), 'utf8')).slice(0, 8000))
    });
  }
}

/** Guess where a test for `srcRel` should live, following existing repo conventions. */
function guessTestPath(srcRel) {
  if (stryMutAct_9fa48("2750")) {
    {}
  } else {
    stryCov_9fa48("2750");
    const dir = repoDir();
    const ext = stryMutAct_9fa48("2753") ? srcRel.match(/\.[cm]?[jt]sx?$/)?.[0] && '.ts' : stryMutAct_9fa48("2752") ? false : stryMutAct_9fa48("2751") ? true : (stryCov_9fa48("2751", "2752", "2753"), (stryMutAct_9fa48("2754") ? srcRel.match(/\.[cm]?[jt]sx?$/)[0] : (stryCov_9fa48("2754"), srcRel.match(stryMutAct_9fa48("2759") ? /\.[cm]?[jt]sx$/ : stryMutAct_9fa48("2758") ? /\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("2757") ? /\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("2756") ? /\.[cm][jt]sx?$/ : stryMutAct_9fa48("2755") ? /\.[cm]?[jt]sx?/ : (stryCov_9fa48("2755", "2756", "2757", "2758", "2759"), /\.[cm]?[jt]sx?$/))?.[0])) || (stryMutAct_9fa48("2760") ? "" : (stryCov_9fa48("2760"), '.ts')));
    const base = path.basename(srcRel).replace(stryMutAct_9fa48("2765") ? /\.[cm]?[jt]sx$/ : stryMutAct_9fa48("2764") ? /\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("2763") ? /\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("2762") ? /\.[cm][jt]sx?$/ : stryMutAct_9fa48("2761") ? /\.[cm]?[jt]sx?/ : (stryCov_9fa48("2761", "2762", "2763", "2764", "2765"), /\.[cm]?[jt]sx?$/), stryMutAct_9fa48("2766") ? "Stryker was here!" : (stryCov_9fa48("2766"), ''));
    const srcDir = path.dirname(srcRel);
    const srcSansRoot = srcRel.replace(stryMutAct_9fa48("2767") ? /(src|lib|app)\// : (stryCov_9fa48("2767"), /^(src|lib|app)\//), stryMutAct_9fa48("2768") ? "Stryker was here!" : (stryCov_9fa48("2768"), ''));
    const candidates = stryMutAct_9fa48("2769") ? [] : (stryCov_9fa48("2769"), [path.join(srcDir, stryMutAct_9fa48("2770") ? `` : (stryCov_9fa48("2770"), `${base}.test${ext}`)), path.join(srcDir, stryMutAct_9fa48("2771") ? "" : (stryCov_9fa48("2771"), '__tests__'), stryMutAct_9fa48("2772") ? `` : (stryCov_9fa48("2772"), `${base}.test${ext}`)), path.join(stryMutAct_9fa48("2773") ? "" : (stryCov_9fa48("2773"), 'test'), stryMutAct_9fa48("2774") ? `` : (stryCov_9fa48("2774"), `${base}.test${ext}`)), path.join(stryMutAct_9fa48("2775") ? "" : (stryCov_9fa48("2775"), 'tests'), stryMutAct_9fa48("2776") ? `` : (stryCov_9fa48("2776"), `${base}.test${ext}`)), path.join(stryMutAct_9fa48("2777") ? "" : (stryCov_9fa48("2777"), 'tests'), stryMutAct_9fa48("2778") ? "" : (stryCov_9fa48("2778"), 'unit'), srcSansRoot.replace(stryMutAct_9fa48("2783") ? /\.[cm]?[jt]sx$/ : stryMutAct_9fa48("2782") ? /\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("2781") ? /\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("2780") ? /\.[cm][jt]sx?$/ : stryMutAct_9fa48("2779") ? /\.[cm]?[jt]sx?/ : (stryCov_9fa48("2779", "2780", "2781", "2782", "2783"), /\.[cm]?[jt]sx?$/), stryMutAct_9fa48("2784") ? `` : (stryCov_9fa48("2784"), `.test${ext}`)))]);
    for (const c of candidates) if (stryMutAct_9fa48("2786") ? false : stryMutAct_9fa48("2785") ? true : (stryCov_9fa48("2785", "2786"), fs.existsSync(path.join(dir, c)))) return stryMutAct_9fa48("2787") ? {} : (stryCov_9fa48("2787"), {
      path: c,
      exists: stryMutAct_9fa48("2788") ? false : (stryCov_9fa48("2788"), true)
    });
    // No test for this file yet: mirror the DOMINANT existing convention so new
    // tests actually match the runner's include patterns (e.g. tests/unit/**).
    const counts = testDirCounts();
    const dirs = stryMutAct_9fa48("2789") ? Object.entries(counts) : (stryCov_9fa48("2789"), Object.entries(counts).sort(stryMutAct_9fa48("2790") ? () => undefined : (stryCov_9fa48("2790"), (a, b) => stryMutAct_9fa48("2791") ? b[1] + a[1] : (stryCov_9fa48("2791"), b[1] - a[1]))));
    if (stryMutAct_9fa48("2793") ? false : stryMutAct_9fa48("2792") ? true : (stryCov_9fa48("2792", "2793"), dirs.length)) {
      if (stryMutAct_9fa48("2794")) {
        {}
      } else {
        stryCov_9fa48("2794");
        const top = dirs[0][0]; // e.g. "tests/unit/surveys" or "test" or "src/__tests__"
        const segs = top.split(stryMutAct_9fa48("2795") ? "" : (stryCov_9fa48("2795"), '/'));
        let root;
        if (stryMutAct_9fa48("2797") ? false : stryMutAct_9fa48("2796") ? true : (stryCov_9fa48("2796", "2797"), segs.includes(stryMutAct_9fa48("2798") ? "" : (stryCov_9fa48("2798"), '__tests__')))) {
          if (stryMutAct_9fa48("2799")) {
            {}
          } else {
            stryCov_9fa48("2799");
            return stryMutAct_9fa48("2800") ? {} : (stryCov_9fa48("2800"), {
              path: path.join(srcDir, stryMutAct_9fa48("2801") ? "" : (stryCov_9fa48("2801"), '__tests__'), stryMutAct_9fa48("2802") ? `` : (stryCov_9fa48("2802"), `${base}.test${ext}`)),
              exists: stryMutAct_9fa48("2803") ? true : (stryCov_9fa48("2803"), false)
            });
          }
        }
        // root = leading segments that look like test roots ("test", "tests", "tests/unit", "src/test"...)
        const idx = segs.findIndex(stryMutAct_9fa48("2804") ? () => undefined : (stryCov_9fa48("2804"), s => (stryMutAct_9fa48("2807") ? /^(tests|spec|unit|integration)$/ : stryMutAct_9fa48("2806") ? /^(tests?|spec|unit|integration)/ : stryMutAct_9fa48("2805") ? /(tests?|spec|unit|integration)$/ : (stryCov_9fa48("2805", "2806", "2807"), /^(tests?|spec|unit|integration)$/)).test(s)));
        if (stryMutAct_9fa48("2810") ? idx === -1 : stryMutAct_9fa48("2809") ? false : stryMutAct_9fa48("2808") ? true : (stryCov_9fa48("2808", "2809", "2810"), idx !== (stryMutAct_9fa48("2811") ? +1 : (stryCov_9fa48("2811"), -1)))) {
          if (stryMutAct_9fa48("2812")) {
            {}
          } else {
            stryCov_9fa48("2812");
            root = stryMutAct_9fa48("2813") ? segs.join('/') : (stryCov_9fa48("2813"), segs.slice(0, stryMutAct_9fa48("2814") ? idx - 1 : (stryCov_9fa48("2814"), idx + 1)).join(stryMutAct_9fa48("2815") ? "" : (stryCov_9fa48("2815"), '/')));
            if (stryMutAct_9fa48("2817") ? false : stryMutAct_9fa48("2816") ? true : (stryCov_9fa48("2816", "2817"), (stryMutAct_9fa48("2819") ? /^(unit|integration)/ : stryMutAct_9fa48("2818") ? /(unit|integration)$/ : (stryCov_9fa48("2818", "2819"), /^(unit|integration)$/)).test(stryMutAct_9fa48("2822") ? segs[idx + 1] && '' : stryMutAct_9fa48("2821") ? false : stryMutAct_9fa48("2820") ? true : (stryCov_9fa48("2820", "2821", "2822"), segs[stryMutAct_9fa48("2823") ? idx - 1 : (stryCov_9fa48("2823"), idx + 1)] || (stryMutAct_9fa48("2824") ? "Stryker was here!" : (stryCov_9fa48("2824"), '')))))) stryMutAct_9fa48("2825") ? root -= '/' + segs[idx + 1] : (stryCov_9fa48("2825"), root += (stryMutAct_9fa48("2826") ? "" : (stryCov_9fa48("2826"), '/')) + segs[stryMutAct_9fa48("2827") ? idx - 1 : (stryCov_9fa48("2827"), idx + 1)]);
            const mirrored = path.join(root, path.dirname(srcSansRoot), stryMutAct_9fa48("2828") ? `` : (stryCov_9fa48("2828"), `${base}.test${ext}`));
            return stryMutAct_9fa48("2829") ? {} : (stryCov_9fa48("2829"), {
              path: mirrored,
              exists: stryMutAct_9fa48("2830") ? true : (stryCov_9fa48("2830"), false)
            });
          }
        }
        // tests colocated with sources
        return stryMutAct_9fa48("2831") ? {} : (stryCov_9fa48("2831"), {
          path: path.join(srcDir, stryMutAct_9fa48("2832") ? `` : (stryCov_9fa48("2832"), `${base}.test${ext}`)),
          exists: stryMutAct_9fa48("2833") ? true : (stryCov_9fa48("2833"), false)
        });
      }
    }
    return stryMutAct_9fa48("2834") ? {} : (stryCov_9fa48("2834"), {
      path: candidates[0],
      exists: stryMutAct_9fa48("2835") ? true : (stryCov_9fa48("2835"), false)
    });
  }
}
module.exports = stryMutAct_9fa48("2836") ? {} : (stryCov_9fa48("2836"), {
  GENERATED_TEST_RE,
  repoDir,
  clone,
  install,
  detectRunner,
  detectUi,
  findStyleReference,
  ourTestFor,
  listScopeFiles,
  createBranch,
  resetToBase,
  discardUncommitted,
  readFileSafe,
  writeTestFile,
  deleteTestFile,
  guessTestPath,
  readPkg
});