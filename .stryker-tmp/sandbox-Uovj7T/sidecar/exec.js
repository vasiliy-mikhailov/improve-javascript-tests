// @ts-nocheck
'use strict';

// Child-process runner with live progress fed into state (for the dashboard).
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
const {
  spawn
} = require('node:child_process');
const {
  setProgress
} = require('./state');
const {
  nowSec
} = require('./util');
const ANSI = stryMutAct_9fa48("1025") ? /\x1b\[[0-9;]*[^a-zA-Z]/g : stryMutAct_9fa48("1024") ? /\x1b\[[^0-9;]*[a-zA-Z]/g : stryMutAct_9fa48("1023") ? /\x1b\[[0-9;][a-zA-Z]/g : (stryCov_9fa48("1023", "1024", "1025"), /\x1b\[[0-9;]*[a-zA-Z]/g);

/**
 * Run a command (argv array, no shell). Streams last output line into stage progress.
 * @returns {Promise<{code:number, stdout:string, stderr:string, timedOut:boolean}>}
 */
function run(argv, {
  cwd,
  env,
  timeoutMs = 600000,
  label
} = {}) {
  if (stryMutAct_9fa48("1026")) {
    {}
  } else {
    stryCov_9fa48("1026");
    return new Promise(resolve => {
      if (stryMutAct_9fa48("1027")) {
        {}
      } else {
        stryCov_9fa48("1027");
        const start = nowSec();
        let stdout = stryMutAct_9fa48("1028") ? "Stryker was here!" : (stryCov_9fa48("1028"), ''),
          stderr = stryMutAct_9fa48("1029") ? "Stryker was here!" : (stryCov_9fa48("1029"), ''),
          lastLine = stryMutAct_9fa48("1030") ? "" : (stryCov_9fa48("1030"), '(starting)'),
          timedOut = stryMutAct_9fa48("1031") ? true : (stryCov_9fa48("1031"), false);
        const child = spawn(argv[0], stryMutAct_9fa48("1032") ? argv : (stryCov_9fa48("1032"), argv.slice(1)), stryMutAct_9fa48("1033") ? {} : (stryCov_9fa48("1033"), {
          cwd,
          // LLM_API_KEY has no business in a child process: the repo's own install
          // scripts and test code inherit this environment. GH_TOKEN stays — `gh`
          // and the git credential helper need it.
          env: stryMutAct_9fa48("1034") ? {} : (stryCov_9fa48("1034"), {
            ...process.env,
            LLM_API_KEY: undefined,
            CI: stryMutAct_9fa48("1035") ? "" : (stryCov_9fa48("1035"), 'true'),
            FORCE_COLOR: stryMutAct_9fa48("1036") ? "" : (stryCov_9fa48("1036"), '0'),
            ...env
          }),
          // own process group, so a timeout can kill the whole tree (stryker spawns
          // test-runner children that would otherwise be orphaned and keep burning CPU)
          detached: stryMutAct_9fa48("1037") ? false : (stryCov_9fa48("1037"), true),
          stdio: stryMutAct_9fa48("1038") ? [] : (stryCov_9fa48("1038"), [stryMutAct_9fa48("1039") ? "" : (stryCov_9fa48("1039"), 'ignore'), stryMutAct_9fa48("1040") ? "" : (stryCov_9fa48("1040"), 'pipe'), stryMutAct_9fa48("1041") ? "" : (stryCov_9fa48("1041"), 'pipe')])
        }));
        const onData = (buf, isErr) => {
          if (stryMutAct_9fa48("1042")) {
            {}
          } else {
            stryCov_9fa48("1042");
            const text = buf.toString();
            if (stryMutAct_9fa48("1044") ? false : stryMutAct_9fa48("1043") ? true : (stryCov_9fa48("1043", "1044"), isErr)) stryMutAct_9fa48("1045") ? stderr -= text : (stryCov_9fa48("1045"), stderr += text);else stryMutAct_9fa48("1046") ? stdout -= text : (stryCov_9fa48("1046"), stdout += text);
            if (stryMutAct_9fa48("1050") ? stdout.length <= 4e6 : stryMutAct_9fa48("1049") ? stdout.length >= 4e6 : stryMutAct_9fa48("1048") ? false : stryMutAct_9fa48("1047") ? true : (stryCov_9fa48("1047", "1048", "1049", "1050"), stdout.length > 4e6)) stdout = stryMutAct_9fa48("1051") ? stdout : (stryCov_9fa48("1051"), stdout.slice(stryMutAct_9fa48("1052") ? +2e6 : (stryCov_9fa48("1052"), -2e6)));
            if (stryMutAct_9fa48("1056") ? stderr.length <= 4e6 : stryMutAct_9fa48("1055") ? stderr.length >= 4e6 : stryMutAct_9fa48("1054") ? false : stryMutAct_9fa48("1053") ? true : (stryCov_9fa48("1053", "1054", "1055", "1056"), stderr.length > 4e6)) stderr = stryMutAct_9fa48("1057") ? stderr : (stryCov_9fa48("1057"), stderr.slice(stryMutAct_9fa48("1058") ? +2e6 : (stryCov_9fa48("1058"), -2e6)));
            for (const l of text.split(stryMutAct_9fa48("1059") ? /\r\n/ : (stryCov_9fa48("1059"), /\r?\n/))) {
              if (stryMutAct_9fa48("1060")) {
                {}
              } else {
                stryCov_9fa48("1060");
                const c = stryMutAct_9fa48("1061") ? l.replace(ANSI, '') : (stryCov_9fa48("1061"), l.replace(ANSI, stryMutAct_9fa48("1062") ? "Stryker was here!" : (stryCov_9fa48("1062"), '')).trim());
                if (stryMutAct_9fa48("1064") ? false : stryMutAct_9fa48("1063") ? true : (stryCov_9fa48("1063", "1064"), c)) lastLine = stryMutAct_9fa48("1065") ? c : (stryCov_9fa48("1065"), c.slice(0, 180));
              }
            }
          }
        };
        child.stdout.on(stryMutAct_9fa48("1066") ? "" : (stryCov_9fa48("1066"), 'data'), stryMutAct_9fa48("1067") ? () => undefined : (stryCov_9fa48("1067"), d => onData(d, stryMutAct_9fa48("1068") ? true : (stryCov_9fa48("1068"), false))));
        child.stderr.on(stryMutAct_9fa48("1069") ? "" : (stryCov_9fa48("1069"), 'data'), stryMutAct_9fa48("1070") ? () => undefined : (stryCov_9fa48("1070"), d => onData(d, stryMutAct_9fa48("1071") ? false : (stryCov_9fa48("1071"), true))));
        const hb = setInterval(() => {
          if (stryMutAct_9fa48("1072")) {
            {}
          } else {
            stryCov_9fa48("1072");
            setProgress(stryMutAct_9fa48("1073") ? (label ? label + ': ' : '') - lastLine : (stryCov_9fa48("1073"), (label ? label + (stryMutAct_9fa48("1074") ? "" : (stryCov_9fa48("1074"), ': ')) : stryMutAct_9fa48("1075") ? "Stryker was here!" : (stryCov_9fa48("1075"), '')) + lastLine), stryMutAct_9fa48("1076") ? nowSec() + start : (stryCov_9fa48("1076"), nowSec() - start));
          }
        }, 3000);
        const killer = setTimeout(() => {
          if (stryMutAct_9fa48("1077")) {
            {}
          } else {
            stryCov_9fa48("1077");
            timedOut = stryMutAct_9fa48("1078") ? false : (stryCov_9fa48("1078"), true);
            try {
              if (stryMutAct_9fa48("1079")) {
                {}
              } else {
                stryCov_9fa48("1079");
                process.kill(stryMutAct_9fa48("1080") ? +child.pid : (stryCov_9fa48("1080"), -child.pid), stryMutAct_9fa48("1081") ? "" : (stryCov_9fa48("1081"), 'SIGKILL'));
              }
            } // whole process group
            catch {
              if (stryMutAct_9fa48("1082")) {
                {}
              } else {
                stryCov_9fa48("1082");
                try {
                  if (stryMutAct_9fa48("1083")) {
                    {}
                  } else {
                    stryCov_9fa48("1083");
                    child.kill(stryMutAct_9fa48("1084") ? "" : (stryCov_9fa48("1084"), 'SIGKILL'));
                  }
                } catch {}
              }
            }
          }
        }, timeoutMs);
        child.on(stryMutAct_9fa48("1085") ? "" : (stryCov_9fa48("1085"), 'error'), e => {
          if (stryMutAct_9fa48("1086")) {
            {}
          } else {
            stryCov_9fa48("1086");
            clearInterval(hb);
            clearTimeout(killer);
            resolve(stryMutAct_9fa48("1087") ? {} : (stryCov_9fa48("1087"), {
              code: 127,
              stdout,
              stderr: stderr + (stryMutAct_9fa48("1088") ? "" : (stryCov_9fa48("1088"), '\nspawn error: ')) + e.message,
              timedOut
            }));
          }
        });
        child.on(stryMutAct_9fa48("1089") ? "" : (stryCov_9fa48("1089"), 'close'), code => {
          if (stryMutAct_9fa48("1090")) {
            {}
          } else {
            stryCov_9fa48("1090");
            clearInterval(hb);
            clearTimeout(killer);
            setProgress((label ? label + (stryMutAct_9fa48("1091") ? "" : (stryCov_9fa48("1091"), ': ')) : stryMutAct_9fa48("1092") ? "Stryker was here!" : (stryCov_9fa48("1092"), '')) + (stryMutAct_9fa48("1093") ? "" : (stryCov_9fa48("1093"), 'done (exit ')) + code + (stryMutAct_9fa48("1094") ? "" : (stryCov_9fa48("1094"), ')')), stryMutAct_9fa48("1095") ? nowSec() + start : (stryCov_9fa48("1095"), nowSec() - start));
            resolve(stryMutAct_9fa48("1096") ? {} : (stryCov_9fa48("1096"), {
              code: (stryMutAct_9fa48("1099") ? code != null : stryMutAct_9fa48("1098") ? false : stryMutAct_9fa48("1097") ? true : (stryCov_9fa48("1097", "1098", "1099"), code == null)) ? 1 : code,
              stdout,
              stderr,
              timedOut
            }));
          }
        });
      }
    });
  }
}
module.exports = stryMutAct_9fa48("1100") ? {} : (stryCov_9fa48("1100"), {
  run
});