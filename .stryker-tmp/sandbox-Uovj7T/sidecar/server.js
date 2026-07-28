// @ts-nocheck
'use strict';

// Sidecar HTTP API (:3000). Everything the n8n workflow needs, so the workflow
// itself stays 100% native n8n nodes (HTTP Request / Code / IF / SplitInBatches).
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
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const S = require('./state');
const repo = require('./repo');
const coverage = require('./coverage');
const stryker = require('./stryker');
const tests = require('./tests');
const rulesMod = require('./rules');
const pr = require('./pr');
const llm = require('./llm');
const timesheet = require('./timesheet');
const mutantsMod = require('./mutants');
const mutantStore = require('./mutant-store');
const {
  run
} = require('./exec');
const {
  mac,
  fileSlug,
  round2,
  clamp,
  slugify
} = require('./util');
const PORT = parseInt(stryMutAct_9fa48("3116") ? process.env.SIDECAR_PORT && '3000' : stryMutAct_9fa48("3115") ? false : stryMutAct_9fa48("3114") ? true : (stryCov_9fa48("3114", "3115", "3116"), process.env.SIDECAR_PORT || (stryMutAct_9fa48("3117") ? "" : (stryCov_9fa48("3117"), '3000'))), 10);
const state = S.state;

// ── helpers ────────────────────────────────────────────────────────────────
function json(res, code, obj) {
  if (stryMutAct_9fa48("3118")) {
    {}
  } else {
    stryCov_9fa48("3118");
    const body = JSON.stringify(obj);
    res.writeHead(code, stryMutAct_9fa48("3119") ? {} : (stryCov_9fa48("3119"), {
      'Content-Type': stryMutAct_9fa48("3120") ? "" : (stryCov_9fa48("3120"), 'application/json'),
      'Content-Length': Buffer.byteLength(body)
    }));
    res.end(body);
  }
}
function readBody(req) {
  if (stryMutAct_9fa48("3121")) {
    {}
  } else {
    stryCov_9fa48("3121");
    return new Promise((resolve, reject) => {
      if (stryMutAct_9fa48("3122")) {
        {}
      } else {
        stryCov_9fa48("3122");
        let data = stryMutAct_9fa48("3123") ? "Stryker was here!" : (stryCov_9fa48("3123"), '');
        req.on(stryMutAct_9fa48("3124") ? "" : (stryCov_9fa48("3124"), 'data'), c => {
          if (stryMutAct_9fa48("3125")) {
            {}
          } else {
            stryCov_9fa48("3125");
            stryMutAct_9fa48("3126") ? data -= c : (stryCov_9fa48("3126"), data += c);
            if (stryMutAct_9fa48("3130") ? data.length <= 20e6 : stryMutAct_9fa48("3129") ? data.length >= 20e6 : stryMutAct_9fa48("3128") ? false : stryMutAct_9fa48("3127") ? true : (stryCov_9fa48("3127", "3128", "3129", "3130"), data.length > 20e6)) {
              if (stryMutAct_9fa48("3131")) {
                {}
              } else {
                stryCov_9fa48("3131");
                req.destroy();
                reject(new Error(stryMutAct_9fa48("3132") ? "" : (stryCov_9fa48("3132"), 'request body too large')));
              }
            }
          }
        });
        req.on(stryMutAct_9fa48("3133") ? "" : (stryCov_9fa48("3133"), 'end'), () => {
          if (stryMutAct_9fa48("3134")) {
            {}
          } else {
            stryCov_9fa48("3134");
            try {
              if (stryMutAct_9fa48("3135")) {
                {}
              } else {
                stryCov_9fa48("3135");
                resolve(data ? JSON.parse(data) : {});
              }
            } catch (e) {
              if (stryMutAct_9fa48("3136")) {
                {}
              } else {
                stryCov_9fa48("3136");
                reject(new Error(stryMutAct_9fa48("3137") ? "" : (stryCov_9fa48("3137"), 'bad JSON body')));
              }
            }
          }
        });
        req.on(stryMutAct_9fa48("3138") ? "" : (stryCov_9fa48("3138"), 'error'), reject);
      }
    });
  }
}
// How many mutants one generated file is asked to kill. Eight measured best against
// the real model; more crowds the prompt, fewer wastes the cycle.
const BATCH_TARGETS = 8;
function needRun() {
  if (stryMutAct_9fa48("3139")) {
    {}
  } else {
    stryCov_9fa48("3139");
    if (stryMutAct_9fa48("3142") ? false : stryMutAct_9fa48("3141") ? true : stryMutAct_9fa48("3140") ? state.run : (stryCov_9fa48("3140", "3141", "3142"), !state.run)) throw new Error(stryMutAct_9fa48("3143") ? "" : (stryCov_9fa48("3143"), 'no active run — POST /api/run/start first'));
  }
}
function ledger() {
  if (stryMutAct_9fa48("3144")) {
    {}
  } else {
    stryCov_9fa48("3144");
    const slug = slugify(state.run.config.repoUrl);
    return stryMutAct_9fa48("3145") ? state.improvedLedger[slug] &&= {} : (stryCov_9fa48("3145"), state.improvedLedger[slug] ||= {});
  }
}
/** Per-repo record of every measurement taken, regardless of outcome. */
function measured() {
  if (stryMutAct_9fa48("3146")) {
    {}
  } else {
    stryCov_9fa48("3146");
    const slug = slugify(state.run.config.repoUrl);
    return stryMutAct_9fa48("3147") ? state.measureLedger[slug] &&= {} : (stryCov_9fa48("3147"), state.measureLedger[slug] ||= {});
  }
}
function recordMeasurement(file, patch) {
  if (stryMutAct_9fa48("3148")) {
    {}
  } else {
    stryCov_9fa48("3148");
    const m = measured();
    m[file] = stryMutAct_9fa48("3149") ? {} : (stryCov_9fa48("3149"), {
      ...(stryMutAct_9fa48("3152") ? m[file] && {} : stryMutAct_9fa48("3151") ? false : stryMutAct_9fa48("3150") ? true : (stryCov_9fa48("3150", "3151", "3152"), m[file] || {})),
      ...patch,
      ts: Date.now()
    });
    S.save();
  }
}

/** The file the loop is currently working on (there is at most one). */
function pickedFile() {
  if (stryMutAct_9fa48("3153")) {
    {}
  } else {
    stryCov_9fa48("3153");
    const e = Object.entries(state.files).find(stryMutAct_9fa48("3154") ? () => undefined : (stryCov_9fa48("3154"), ([, v]) => stryMutAct_9fa48("3157") ? v.status !== 'picked' : stryMutAct_9fa48("3156") ? false : stryMutAct_9fa48("3155") ? true : (stryCov_9fa48("3155", "3156", "3157"), v.status === (stryMutAct_9fa48("3158") ? "" : (stryCov_9fa48("3158"), 'picked')))));
    return e ? e[0] : null;
  }
}

/** Close the current attempt's stopwatch into the file's cumulative machine time. */
function accrueSpent(file) {
  if (stryMutAct_9fa48("3159")) {
    {}
  } else {
    stryCov_9fa48("3159");
    const f = state.files[file];
    if (stryMutAct_9fa48("3162") ? !f && !f.attemptStartedAt : stryMutAct_9fa48("3161") ? false : stryMutAct_9fa48("3160") ? true : (stryCov_9fa48("3160", "3161", "3162"), (stryMutAct_9fa48("3163") ? f : (stryCov_9fa48("3163"), !f)) || (stryMutAct_9fa48("3164") ? f.attemptStartedAt : (stryCov_9fa48("3164"), !f.attemptStartedAt)))) return stryMutAct_9fa48("3167") ? f?.spentSec && 0 : stryMutAct_9fa48("3166") ? false : stryMutAct_9fa48("3165") ? true : (stryCov_9fa48("3165", "3166", "3167"), (stryMutAct_9fa48("3168") ? f.spentSec : (stryCov_9fa48("3168"), f?.spentSec)) || 0);
    const spent = stryMutAct_9fa48("3169") ? (f.spentSec || 0) - (Math.floor(Date.now() / 1000) - f.attemptStartedAt) : (stryCov_9fa48("3169"), (stryMutAct_9fa48("3172") ? f.spentSec && 0 : stryMutAct_9fa48("3171") ? false : stryMutAct_9fa48("3170") ? true : (stryCov_9fa48("3170", "3171", "3172"), f.spentSec || 0)) + (stryMutAct_9fa48("3173") ? Math.floor(Date.now() / 1000) + f.attemptStartedAt : (stryCov_9fa48("3173"), Math.floor(stryMutAct_9fa48("3174") ? Date.now() * 1000 : (stryCov_9fa48("3174"), Date.now() / 1000)) - f.attemptStartedAt)));
    S.upsertFile(file, stryMutAct_9fa48("3175") ? {} : (stryCov_9fa48("3175"), {
      spentSec: spent,
      attemptStartedAt: null
    }));
    return spent;
  }
}
function metricsPayload() {
  if (stryMutAct_9fa48("3176")) {
    {}
  } else {
    stryCov_9fa48("3176");
    const files = stryMutAct_9fa48("3177") ? Object.values(state.files) : (stryCov_9fa48("3177"), Object.values(state.files).sort(stryMutAct_9fa48("3178") ? () => undefined : (stryCov_9fa48("3178"), (a, b) => stryMutAct_9fa48("3179") ? (a.mac ?? 999) + (b.mac ?? 999) : (stryCov_9fa48("3179"), (stryMutAct_9fa48("3180") ? a.mac && 999 : (stryCov_9fa48("3180"), a.mac ?? 999)) - (stryMutAct_9fa48("3181") ? b.mac && 999 : (stryCov_9fa48("3181"), b.mac ?? 999))))));
    const targeted = stryMutAct_9fa48("3182") ? files : (stryCov_9fa48("3182"), files.filter(stryMutAct_9fa48("3183") ? () => undefined : (stryCov_9fa48("3183"), f => stryMutAct_9fa48("3186") ? f.macBefore == null : stryMutAct_9fa48("3185") ? false : stryMutAct_9fa48("3184") ? true : (stryCov_9fa48("3184", "3185", "3186"), f.macBefore != null))));
    const avg = stryMutAct_9fa48("3187") ? () => undefined : (stryCov_9fa48("3187"), (() => {
      const avg = xs => xs.length ? round2(stryMutAct_9fa48("3188") ? xs.reduce((s, x) => s + x, 0) * xs.length : (stryCov_9fa48("3188"), xs.reduce(stryMutAct_9fa48("3189") ? () => undefined : (stryCov_9fa48("3189"), (s, x) => stryMutAct_9fa48("3190") ? s - x : (stryCov_9fa48("3190"), s + x)), 0) / xs.length)) : null;
      return avg;
    })());
    // work accounting: human-equivalent hours, machine time, ETA, FTE, progress
    const settled = stryMutAct_9fa48("3191") ? files : (stryCov_9fa48("3191"), files.filter(stryMutAct_9fa48("3192") ? () => undefined : (stryCov_9fa48("3192"), f => (stryMutAct_9fa48("3193") ? [] : (stryCov_9fa48("3193"), [stryMutAct_9fa48("3194") ? "" : (stryCov_9fa48("3194"), 'improved'), stryMutAct_9fa48("3195") ? "" : (stryCov_9fa48("3195"), 'no_improvement'), stryMutAct_9fa48("3196") ? "" : (stryCov_9fa48("3196"), 'failed')])).includes(f.status))));
    const now = Math.floor(stryMutAct_9fa48("3197") ? Date.now() * 1000 : (stryCov_9fa48("3197"), Date.now() / 1000));
    const humanMin = files.reduce(stryMutAct_9fa48("3198") ? () => undefined : (stryCov_9fa48("3198"), (s, f) => stryMutAct_9fa48("3199") ? s - (f.timesheet?.totalMin || 0) : (stryCov_9fa48("3199"), s + (stryMutAct_9fa48("3202") ? f.timesheet?.totalMin && 0 : stryMutAct_9fa48("3201") ? false : stryMutAct_9fa48("3200") ? true : (stryCov_9fa48("3200", "3201", "3202"), (stryMutAct_9fa48("3203") ? f.timesheet.totalMin : (stryCov_9fa48("3203"), f.timesheet?.totalMin)) || 0)))), 0);
    let machineSec = files.reduce(stryMutAct_9fa48("3204") ? () => undefined : (stryCov_9fa48("3204"), (s, f) => stryMutAct_9fa48("3205") ? s - (f.spentSec || 0) : (stryCov_9fa48("3205"), s + (stryMutAct_9fa48("3208") ? f.spentSec && 0 : stryMutAct_9fa48("3207") ? false : stryMutAct_9fa48("3206") ? true : (stryCov_9fa48("3206", "3207", "3208"), f.spentSec || 0)))), 0);
    // only the file currently being worked on has a live stopwatch; a crashed
    // attempt must not keep accruing time forever
    for (const f of files) if (stryMutAct_9fa48("3211") ? f.attemptStartedAt || f.status === 'picked' : stryMutAct_9fa48("3210") ? false : stryMutAct_9fa48("3209") ? true : (stryCov_9fa48("3209", "3210", "3211"), f.attemptStartedAt && (stryMutAct_9fa48("3213") ? f.status !== 'picked' : stryMutAct_9fa48("3212") ? true : (stryCov_9fa48("3212", "3213"), f.status === (stryMutAct_9fa48("3214") ? "" : (stryCov_9fa48("3214"), 'picked')))))) stryMutAct_9fa48("3215") ? machineSec -= now - f.attemptStartedAt : (stryCov_9fa48("3215"), machineSec += stryMutAct_9fa48("3216") ? now + f.attemptStartedAt : (stryCov_9fa48("3216"), now - f.attemptStartedAt));
    // clone + install + baseline measurement are real machine time too, and they
    // dominate short batches — without them the FTE ratio flatters the pipeline
    stryMutAct_9fa48("3217") ? machineSec -= state.overheadLedger?.[slugify(state.run?.config?.repoUrl || '')] || 0 : (stryCov_9fa48("3217"), machineSec += stryMutAct_9fa48("3220") ? state.overheadLedger?.[slugify(state.run?.config?.repoUrl || '')] && 0 : stryMutAct_9fa48("3219") ? false : stryMutAct_9fa48("3218") ? true : (stryCov_9fa48("3218", "3219", "3220"), (stryMutAct_9fa48("3221") ? state.overheadLedger[slugify(state.run?.config?.repoUrl || '')] : (stryCov_9fa48("3221"), state.overheadLedger?.[slugify(stryMutAct_9fa48("3224") ? state.run?.config?.repoUrl && '' : stryMutAct_9fa48("3223") ? false : stryMutAct_9fa48("3222") ? true : (stryCov_9fa48("3222", "3223", "3224"), (stryMutAct_9fa48("3226") ? state.run.config?.repoUrl : stryMutAct_9fa48("3225") ? state.run?.config.repoUrl : (stryCov_9fa48("3225", "3226"), state.run?.config?.repoUrl)) || (stryMutAct_9fa48("3227") ? "Stryker was here!" : (stryCov_9fa48("3227"), ''))))])) || 0));
    const timedSettled = stryMutAct_9fa48("3228") ? settled : (stryCov_9fa48("3228"), settled.filter(stryMutAct_9fa48("3229") ? () => undefined : (stryCov_9fa48("3229"), f => stryMutAct_9fa48("3233") ? f.spentSec <= 0 : stryMutAct_9fa48("3232") ? f.spentSec >= 0 : stryMutAct_9fa48("3231") ? false : stryMutAct_9fa48("3230") ? true : (stryCov_9fa48("3230", "3231", "3232", "3233"), f.spentSec > 0))));
    const remaining = stryMutAct_9fa48("3234") ? files.length : (stryCov_9fa48("3234"), files.filter(stryMutAct_9fa48("3235") ? () => undefined : (stryCov_9fa48("3235"), f => stryMutAct_9fa48("3238") ? f.status === 'candidate' && f.status === 'picked' : stryMutAct_9fa48("3237") ? false : stryMutAct_9fa48("3236") ? true : (stryCov_9fa48("3236", "3237", "3238"), (stryMutAct_9fa48("3240") ? f.status !== 'candidate' : stryMutAct_9fa48("3239") ? false : (stryCov_9fa48("3239", "3240"), f.status === (stryMutAct_9fa48("3241") ? "" : (stryCov_9fa48("3241"), 'candidate')))) || (stryMutAct_9fa48("3243") ? f.status !== 'picked' : stryMutAct_9fa48("3242") ? false : (stryCov_9fa48("3242", "3243"), f.status === (stryMutAct_9fa48("3244") ? "" : (stryCov_9fa48("3244"), 'picked'))))))).length);
    const avgSecPerFile = timedSettled.length ? stryMutAct_9fa48("3245") ? timedSettled.reduce((s, f) => s + f.spentSec, 0) * timedSettled.length : (stryCov_9fa48("3245"), timedSettled.reduce(stryMutAct_9fa48("3246") ? () => undefined : (stryCov_9fa48("3246"), (s, f) => stryMutAct_9fa48("3247") ? s - f.spentSec : (stryCov_9fa48("3247"), s + f.spentSec)), 0) / timedSettled.length) : null;
    // FTE must compare like with like: only files whose machine time we actually
    // measured. (Files improved before the stopwatch existed carry human-equivalent
    // hours but no machine time, and would inflate the ratio.)
    const comparable = stryMutAct_9fa48("3248") ? files : (stryCov_9fa48("3248"), files.filter(stryMutAct_9fa48("3249") ? () => undefined : (stryCov_9fa48("3249"), f => stryMutAct_9fa48("3252") ? f.timesheet?.totalMin > 0 || f.spentSec > 0 : stryMutAct_9fa48("3251") ? false : stryMutAct_9fa48("3250") ? true : (stryCov_9fa48("3250", "3251", "3252"), (stryMutAct_9fa48("3255") ? f.timesheet?.totalMin <= 0 : stryMutAct_9fa48("3254") ? f.timesheet?.totalMin >= 0 : stryMutAct_9fa48("3253") ? true : (stryCov_9fa48("3253", "3254", "3255"), (stryMutAct_9fa48("3256") ? f.timesheet.totalMin : (stryCov_9fa48("3256"), f.timesheet?.totalMin)) > 0)) && (stryMutAct_9fa48("3259") ? f.spentSec <= 0 : stryMutAct_9fa48("3258") ? f.spentSec >= 0 : stryMutAct_9fa48("3257") ? true : (stryCov_9fa48("3257", "3258", "3259"), f.spentSec > 0))))));
    const comparableHumanMin = comparable.reduce(stryMutAct_9fa48("3260") ? () => undefined : (stryCov_9fa48("3260"), (s, f) => stryMutAct_9fa48("3261") ? s - f.timesheet.totalMin : (stryCov_9fa48("3261"), s + f.timesheet.totalMin)), 0);
    const comparableMachineSec = comparable.reduce(stryMutAct_9fa48("3262") ? () => undefined : (stryCov_9fa48("3262"), (s, f) => stryMutAct_9fa48("3263") ? s - f.spentSec : (stryCov_9fa48("3263"), s + f.spentSec)), 0);
    const tok = stryMutAct_9fa48("3266") ? state.tokenLedger?.[slugify(state.run?.config?.repoUrl || '')] && {
      in: 0,
      out: 0,
      calls: 0
    } : stryMutAct_9fa48("3265") ? false : stryMutAct_9fa48("3264") ? true : (stryCov_9fa48("3264", "3265", "3266"), (stryMutAct_9fa48("3267") ? state.tokenLedger[slugify(state.run?.config?.repoUrl || '')] : (stryCov_9fa48("3267"), state.tokenLedger?.[slugify(stryMutAct_9fa48("3270") ? state.run?.config?.repoUrl && '' : stryMutAct_9fa48("3269") ? false : stryMutAct_9fa48("3268") ? true : (stryCov_9fa48("3268", "3269", "3270"), (stryMutAct_9fa48("3272") ? state.run.config?.repoUrl : stryMutAct_9fa48("3271") ? state.run?.config.repoUrl : (stryCov_9fa48("3271", "3272"), state.run?.config?.repoUrl)) || (stryMutAct_9fa48("3273") ? "Stryker was here!" : (stryCov_9fa48("3273"), ''))))])) || (stryMutAct_9fa48("3274") ? {} : (stryCov_9fa48("3274"), {
      in: 0,
      out: 0,
      calls: 0
    })));
    const work = stryMutAct_9fa48("3275") ? {} : (stryCov_9fa48("3275"), {
      tokensIn: stryMutAct_9fa48("3278") ? tok.in && 0 : stryMutAct_9fa48("3277") ? false : stryMutAct_9fa48("3276") ? true : (stryCov_9fa48("3276", "3277", "3278"), tok.in || 0),
      tokensOut: stryMutAct_9fa48("3281") ? tok.out && 0 : stryMutAct_9fa48("3280") ? false : stryMutAct_9fa48("3279") ? true : (stryCov_9fa48("3279", "3280", "3281"), tok.out || 0),
      llmCalls: stryMutAct_9fa48("3284") ? tok.calls && 0 : stryMutAct_9fa48("3283") ? false : stryMutAct_9fa48("3282") ? true : (stryCov_9fa48("3282", "3283", "3284"), tok.calls || 0),
      tokensPerImprovedFile: null,
      // filled below once `improved` is known
      humanHours: round2(stryMutAct_9fa48("3285") ? humanMin * 60 : (stryCov_9fa48("3285"), humanMin / 60)),
      machineHours: round2(stryMutAct_9fa48("3286") ? machineSec * 3600 : (stryCov_9fa48("3286"), machineSec / 3600)),
      fte: (stryMutAct_9fa48("3290") ? comparableMachineSec <= 600 : stryMutAct_9fa48("3289") ? comparableMachineSec >= 600 : stryMutAct_9fa48("3288") ? false : stryMutAct_9fa48("3287") ? true : (stryCov_9fa48("3287", "3288", "3289", "3290"), comparableMachineSec > 600)) ? round2(stryMutAct_9fa48("3291") ? comparableHumanMin * 60 * comparableMachineSec : (stryCov_9fa48("3291"), (stryMutAct_9fa48("3292") ? comparableHumanMin / 60 : (stryCov_9fa48("3292"), comparableHumanMin * 60)) / comparableMachineSec)) : null,
      fteBasis: comparable.length,
      etaSec: (stryMutAct_9fa48("3295") ? avgSecPerFile == null : stryMutAct_9fa48("3294") ? false : stryMutAct_9fa48("3293") ? true : (stryCov_9fa48("3293", "3294", "3295"), avgSecPerFile != null)) ? Math.round(stryMutAct_9fa48("3296") ? remaining / avgSecPerFile : (stryCov_9fa48("3296"), remaining * avgSecPerFile)) : null,
      settled: settled.length,
      improved: stryMutAct_9fa48("3297") ? settled.length : (stryCov_9fa48("3297"), settled.filter(stryMutAct_9fa48("3298") ? () => undefined : (stryCov_9fa48("3298"), f => stryMutAct_9fa48("3301") ? f.status !== 'improved' : stryMutAct_9fa48("3300") ? false : stryMutAct_9fa48("3299") ? true : (stryCov_9fa48("3299", "3300", "3301"), f.status === (stryMutAct_9fa48("3302") ? "" : (stryCov_9fa48("3302"), 'improved'))))).length),
      totalFiles: files.length,
      remaining
    });
    // like-for-like again: only files that were improved AND have token data
    const tokenedImproved = stryMutAct_9fa48("3303") ? files : (stryCov_9fa48("3303"), files.filter(stryMutAct_9fa48("3304") ? () => undefined : (stryCov_9fa48("3304"), f => stryMutAct_9fa48("3307") ? f.status === 'improved' || f.tokens?.calls > 0 : stryMutAct_9fa48("3306") ? false : stryMutAct_9fa48("3305") ? true : (stryCov_9fa48("3305", "3306", "3307"), (stryMutAct_9fa48("3309") ? f.status !== 'improved' : stryMutAct_9fa48("3308") ? true : (stryCov_9fa48("3308", "3309"), f.status === (stryMutAct_9fa48("3310") ? "" : (stryCov_9fa48("3310"), 'improved')))) && (stryMutAct_9fa48("3313") ? f.tokens?.calls <= 0 : stryMutAct_9fa48("3312") ? f.tokens?.calls >= 0 : stryMutAct_9fa48("3311") ? true : (stryCov_9fa48("3311", "3312", "3313"), (stryMutAct_9fa48("3314") ? f.tokens.calls : (stryCov_9fa48("3314"), f.tokens?.calls)) > 0))))));
    const tokenedSum = tokenedImproved.reduce(stryMutAct_9fa48("3315") ? () => undefined : (stryCov_9fa48("3315"), (s2, f) => stryMutAct_9fa48("3316") ? s2 + (f.tokens.in || 0) - (f.tokens.out || 0) : (stryCov_9fa48("3316"), (stryMutAct_9fa48("3317") ? s2 - (f.tokens.in || 0) : (stryCov_9fa48("3317"), s2 + (stryMutAct_9fa48("3320") ? f.tokens.in && 0 : stryMutAct_9fa48("3319") ? false : stryMutAct_9fa48("3318") ? true : (stryCov_9fa48("3318", "3319", "3320"), f.tokens.in || 0)))) + (stryMutAct_9fa48("3323") ? f.tokens.out && 0 : stryMutAct_9fa48("3322") ? false : stryMutAct_9fa48("3321") ? true : (stryCov_9fa48("3321", "3322", "3323"), f.tokens.out || 0)))), 0);
    work.tokensPerImprovedFile = tokenedImproved.length ? Math.round(stryMutAct_9fa48("3324") ? tokenedSum * tokenedImproved.length : (stryCov_9fa48("3324"), tokenedSum / tokenedImproved.length)) : null;
    work.tokensBasis = tokenedImproved.length;
    return stryMutAct_9fa48("3325") ? {} : (stryCov_9fa48("3325"), {
      work,
      stage: state.stage,
      run: state.run,
      runner: state.runner,
      totals: stryMutAct_9fa48("3326") ? {} : (stryCov_9fa48("3326"), {
        baseline: stryMutAct_9fa48("3329") ? state.run?.baseline && {} : stryMutAct_9fa48("3328") ? false : stryMutAct_9fa48("3327") ? true : (stryCov_9fa48("3327", "3328", "3329"), (stryMutAct_9fa48("3330") ? state.run.baseline : (stryCov_9fa48("3330"), state.run?.baseline)) || {}),
        current: stryMutAct_9fa48("3333") ? state.run?.result && {} : stryMutAct_9fa48("3332") ? false : stryMutAct_9fa48("3331") ? true : (stryCov_9fa48("3331", "3332", "3333"), (stryMutAct_9fa48("3334") ? state.run.result : (stryCov_9fa48("3334"), state.run?.result)) || {}),
        targetedFiles: targeted.length,
        improvedFiles: stryMutAct_9fa48("3335") ? targeted.length : (stryCov_9fa48("3335"), targeted.filter(stryMutAct_9fa48("3336") ? () => undefined : (stryCov_9fa48("3336"), f => stryMutAct_9fa48("3339") ? f.status !== 'improved' : stryMutAct_9fa48("3338") ? false : stryMutAct_9fa48("3337") ? true : (stryCov_9fa48("3337", "3338", "3339"), f.status === (stryMutAct_9fa48("3340") ? "" : (stryCov_9fa48("3340"), 'improved'))))).length),
        avgMacBefore: avg(stryMutAct_9fa48("3341") ? targeted.map(f => f.macBefore) : (stryCov_9fa48("3341"), targeted.map(stryMutAct_9fa48("3342") ? () => undefined : (stryCov_9fa48("3342"), f => f.macBefore)).filter(stryMutAct_9fa48("3343") ? () => undefined : (stryCov_9fa48("3343"), x => stryMutAct_9fa48("3346") ? x == null : stryMutAct_9fa48("3345") ? false : stryMutAct_9fa48("3344") ? true : (stryCov_9fa48("3344", "3345", "3346"), x != null))))),
        avgMacAfter: avg(stryMutAct_9fa48("3347") ? targeted.map(f => f.macAfter ?? f.macBefore) : (stryCov_9fa48("3347"), targeted.map(stryMutAct_9fa48("3348") ? () => undefined : (stryCov_9fa48("3348"), f => stryMutAct_9fa48("3349") ? f.macAfter && f.macBefore : (stryCov_9fa48("3349"), f.macAfter ?? f.macBefore))).filter(stryMutAct_9fa48("3350") ? () => undefined : (stryCov_9fa48("3350"), x => stryMutAct_9fa48("3353") ? x == null : stryMutAct_9fa48("3352") ? false : stryMutAct_9fa48("3351") ? true : (stryCov_9fa48("3351", "3352", "3353"), x != null)))))
      }),
      // project only what the dashboard renders, and only as many rows as it shows:
      // full records for ~500 files made this a ~130 KB poll every 2 s. Files the
      // pipeline has touched always win a slot; untouched candidates fill the rest.
      files: stryMutAct_9fa48("3354") ? [...files.filter(f => f.status !== 'candidate'), ...files.filter(f => f.status === 'candidate')].map(f => ({
        path: f.path,
        status: f.status,
        attempts: f.attempts,
        rounds: f.rounds || 0,
        coverage: f.coverage,
        mutation: f.mutation,
        mac: f.mac,
        coverageBefore: f.coverageBefore,
        mutationBefore: f.mutationBefore,
        macBefore: f.macBefore,
        coverageAfter: f.coverageAfter,
        mutationAfter: f.mutationAfter,
        macAfter: f.macAfter,
        // what the best attempt reached even when the result was not kept
        attemptCoverage: f.attemptCoverage,
        attemptMutation: f.attemptMutation,
        attemptMac: f.attemptMac,
        failure: f.failure,
        tokens: f.tokens,
        prUrl: f.prUrl,
        prPatch: f.prPatch,
        timesheet: f.timesheet && {
          hours: f.timesheet.hours,
          totalMin: f.timesheet.totalMin,
          analysisMin: f.timesheet.analysisMin,
          testsMin: f.timesheet.testsMin,
          mutationMin: f.timesheet.mutationMin,
          verifyMin: f.timesheet.verifyMin
        }
      })) : (stryCov_9fa48("3354"), (stryMutAct_9fa48("3355") ? [] : (stryCov_9fa48("3355"), [...(stryMutAct_9fa48("3356") ? files : (stryCov_9fa48("3356"), files.filter(stryMutAct_9fa48("3357") ? () => undefined : (stryCov_9fa48("3357"), f => stryMutAct_9fa48("3360") ? f.status === 'candidate' : stryMutAct_9fa48("3359") ? false : stryMutAct_9fa48("3358") ? true : (stryCov_9fa48("3358", "3359", "3360"), f.status !== (stryMutAct_9fa48("3361") ? "" : (stryCov_9fa48("3361"), 'candidate'))))))), ...(stryMutAct_9fa48("3362") ? files : (stryCov_9fa48("3362"), files.filter(stryMutAct_9fa48("3363") ? () => undefined : (stryCov_9fa48("3363"), f => stryMutAct_9fa48("3366") ? f.status !== 'candidate' : stryMutAct_9fa48("3365") ? false : stryMutAct_9fa48("3364") ? true : (stryCov_9fa48("3364", "3365", "3366"), f.status === (stryMutAct_9fa48("3367") ? "" : (stryCov_9fa48("3367"), 'candidate')))))))])).slice(0, 250).map(stryMutAct_9fa48("3368") ? () => undefined : (stryCov_9fa48("3368"), f => stryMutAct_9fa48("3369") ? {} : (stryCov_9fa48("3369"), {
        path: f.path,
        status: f.status,
        attempts: f.attempts,
        rounds: stryMutAct_9fa48("3372") ? f.rounds && 0 : stryMutAct_9fa48("3371") ? false : stryMutAct_9fa48("3370") ? true : (stryCov_9fa48("3370", "3371", "3372"), f.rounds || 0),
        coverage: f.coverage,
        mutation: f.mutation,
        mac: f.mac,
        coverageBefore: f.coverageBefore,
        mutationBefore: f.mutationBefore,
        macBefore: f.macBefore,
        coverageAfter: f.coverageAfter,
        mutationAfter: f.mutationAfter,
        macAfter: f.macAfter,
        // what the best attempt reached even when the result was not kept
        attemptCoverage: f.attemptCoverage,
        attemptMutation: f.attemptMutation,
        attemptMac: f.attemptMac,
        failure: f.failure,
        tokens: f.tokens,
        prUrl: f.prUrl,
        prPatch: f.prPatch,
        timesheet: stryMutAct_9fa48("3375") ? f.timesheet || {
          hours: f.timesheet.hours,
          totalMin: f.timesheet.totalMin,
          analysisMin: f.timesheet.analysisMin,
          testsMin: f.timesheet.testsMin,
          mutationMin: f.timesheet.mutationMin,
          verifyMin: f.timesheet.verifyMin
        } : stryMutAct_9fa48("3374") ? false : stryMutAct_9fa48("3373") ? true : (stryCov_9fa48("3373", "3374", "3375"), f.timesheet && (stryMutAct_9fa48("3376") ? {} : (stryCov_9fa48("3376"), {
          hours: f.timesheet.hours,
          totalMin: f.timesheet.totalMin,
          analysisMin: f.timesheet.analysisMin,
          testsMin: f.timesheet.testsMin,
          mutationMin: f.timesheet.mutationMin,
          verifyMin: f.timesheet.verifyMin
        })))
      })))),
      prs: state.prs,
      decisions: state.decisions,
      events: stryMutAct_9fa48("3377") ? state.events : (stryCov_9fa48("3377"), state.events.slice(stryMutAct_9fa48("3378") ? +60 : (stryCov_9fa48("3378"), -60)))
    });
  }
}
function candidates() {
  if (stryMutAct_9fa48("3379")) {
    {}
  } else {
    stryCov_9fa48("3379");
    const cfg = state.run.config;
    const maxAttempts = stryMutAct_9fa48("3382") ? cfg.maxAttemptsPerFile && 3 : stryMutAct_9fa48("3381") ? false : stryMutAct_9fa48("3380") ? true : (stryCov_9fa48("3380", "3381", "3382"), cfg.maxAttemptsPerFile || 3);
    const all = Object.values(state.files);
    // ledger-replayed files were settled in PREVIOUS batches — they must not
    // consume this batch's scopeLimit quota
    const processed = stryMutAct_9fa48("3383") ? all.length : (stryCov_9fa48("3383"), all.filter(stryMutAct_9fa48("3384") ? () => undefined : (stryCov_9fa48("3384"), f => stryMutAct_9fa48("3387") ? ['improved', 'no_improvement', 'failed'].includes(f.status) && !f.fromLedger || f.failedKind !== 'measurement' : stryMutAct_9fa48("3386") ? false : stryMutAct_9fa48("3385") ? true : (stryCov_9fa48("3385", "3386", "3387"), (stryMutAct_9fa48("3389") ? ['improved', 'no_improvement', 'failed'].includes(f.status) || !f.fromLedger : stryMutAct_9fa48("3388") ? true : (stryCov_9fa48("3388", "3389"), (stryMutAct_9fa48("3390") ? [] : (stryCov_9fa48("3390"), [stryMutAct_9fa48("3391") ? "" : (stryCov_9fa48("3391"), 'improved'), stryMutAct_9fa48("3392") ? "" : (stryCov_9fa48("3392"), 'no_improvement'), stryMutAct_9fa48("3393") ? "" : (stryCov_9fa48("3393"), 'failed')])).includes(f.status) && (stryMutAct_9fa48("3394") ? f.fromLedger : (stryCov_9fa48("3394"), !f.fromLedger)))) && (stryMutAct_9fa48("3396") ? f.failedKind === 'measurement' : stryMutAct_9fa48("3395") ? true : (stryCov_9fa48("3395", "3396"), f.failedKind !== (stryMutAct_9fa48("3397") ? "" : (stryCov_9fa48("3397"), 'measurement'))))))).length);
    const list = stryMutAct_9fa48("3399") ? all.map(f => ({
      path: f.path,
      coverage: f.coverage,
      mutation: f.mutation,
      mac: f.mac,
      attempts: f.attempts
    })).sort((a, b) => (a.mac ?? (a.coverage ?? 0) / 2) - (b.mac ?? (b.coverage ?? 0) / 2)) : stryMutAct_9fa48("3398") ? all.filter(f => f.status === 'candidate' && f.attempts < maxAttempts).map(f => ({
      path: f.path,
      coverage: f.coverage,
      mutation: f.mutation,
      mac: f.mac,
      attempts: f.attempts
    })) : (stryCov_9fa48("3398", "3399"), all.filter(stryMutAct_9fa48("3400") ? () => undefined : (stryCov_9fa48("3400"), f => stryMutAct_9fa48("3403") ? f.status === 'candidate' || f.attempts < maxAttempts : stryMutAct_9fa48("3402") ? false : stryMutAct_9fa48("3401") ? true : (stryCov_9fa48("3401", "3402", "3403"), (stryMutAct_9fa48("3405") ? f.status !== 'candidate' : stryMutAct_9fa48("3404") ? true : (stryCov_9fa48("3404", "3405"), f.status === (stryMutAct_9fa48("3406") ? "" : (stryCov_9fa48("3406"), 'candidate')))) && (stryMutAct_9fa48("3409") ? f.attempts >= maxAttempts : stryMutAct_9fa48("3408") ? f.attempts <= maxAttempts : stryMutAct_9fa48("3407") ? true : (stryCov_9fa48("3407", "3408", "3409"), f.attempts < maxAttempts))))).map(stryMutAct_9fa48("3410") ? () => undefined : (stryCov_9fa48("3410"), f => stryMutAct_9fa48("3411") ? {} : (stryCov_9fa48("3411"), {
      path: f.path,
      coverage: f.coverage,
      mutation: f.mutation,
      mac: f.mac,
      attempts: f.attempts
    }))).sort(stryMutAct_9fa48("3412") ? () => undefined : (stryCov_9fa48("3412"), (a, b) => stryMutAct_9fa48("3413") ? (a.mac ?? (a.coverage ?? 0) / 2) + (b.mac ?? (b.coverage ?? 0) / 2) : (stryCov_9fa48("3413"), (stryMutAct_9fa48("3414") ? a.mac && (a.coverage ?? 0) / 2 : (stryCov_9fa48("3414"), a.mac ?? (stryMutAct_9fa48("3415") ? (a.coverage ?? 0) * 2 : (stryCov_9fa48("3415"), (stryMutAct_9fa48("3416") ? a.coverage && 0 : (stryCov_9fa48("3416"), a.coverage ?? 0)) / 2)))) - (stryMutAct_9fa48("3417") ? b.mac && (b.coverage ?? 0) / 2 : (stryCov_9fa48("3417"), b.mac ?? (stryMutAct_9fa48("3418") ? (b.coverage ?? 0) * 2 : (stryCov_9fa48("3418"), (stryMutAct_9fa48("3419") ? b.coverage && 0 : (stryCov_9fa48("3419"), b.coverage ?? 0)) / 2))))))));
    let done = stryMutAct_9fa48("3420") ? true : (stryCov_9fa48("3420"), false),
      reason = stryMutAct_9fa48("3421") ? "Stryker was here!" : (stryCov_9fa48("3421"), '');
    if (stryMutAct_9fa48("3424") ? cfg.maxIterations > 0 || state.run.iteration >= cfg.maxIterations : stryMutAct_9fa48("3423") ? false : stryMutAct_9fa48("3422") ? true : (stryCov_9fa48("3422", "3423", "3424"), (stryMutAct_9fa48("3427") ? cfg.maxIterations <= 0 : stryMutAct_9fa48("3426") ? cfg.maxIterations >= 0 : stryMutAct_9fa48("3425") ? true : (stryCov_9fa48("3425", "3426", "3427"), cfg.maxIterations > 0)) && (stryMutAct_9fa48("3430") ? state.run.iteration < cfg.maxIterations : stryMutAct_9fa48("3429") ? state.run.iteration > cfg.maxIterations : stryMutAct_9fa48("3428") ? true : (stryCov_9fa48("3428", "3429", "3430"), state.run.iteration >= cfg.maxIterations)))) {
      if (stryMutAct_9fa48("3431")) {
        {}
      } else {
        stryCov_9fa48("3431");
        done = stryMutAct_9fa48("3432") ? false : (stryCov_9fa48("3432"), true);
        reason = stryMutAct_9fa48("3433") ? `` : (stryCov_9fa48("3433"), `max iterations (${cfg.maxIterations}) reached`);
      }
    } else if (stryMutAct_9fa48("3436") ? cfg.scopeLimit > 0 || processed >= cfg.scopeLimit : stryMutAct_9fa48("3435") ? false : stryMutAct_9fa48("3434") ? true : (stryCov_9fa48("3434", "3435", "3436"), (stryMutAct_9fa48("3439") ? cfg.scopeLimit <= 0 : stryMutAct_9fa48("3438") ? cfg.scopeLimit >= 0 : stryMutAct_9fa48("3437") ? true : (stryCov_9fa48("3437", "3438", "3439"), cfg.scopeLimit > 0)) && (stryMutAct_9fa48("3442") ? processed < cfg.scopeLimit : stryMutAct_9fa48("3441") ? processed > cfg.scopeLimit : stryMutAct_9fa48("3440") ? true : (stryCov_9fa48("3440", "3441", "3442"), processed >= cfg.scopeLimit)))) {
      if (stryMutAct_9fa48("3443")) {
        {}
      } else {
        stryCov_9fa48("3443");
        done = stryMutAct_9fa48("3444") ? false : (stryCov_9fa48("3444"), true);
        reason = stryMutAct_9fa48("3445") ? `` : (stryCov_9fa48("3445"), `scope limit (${cfg.scopeLimit} files) reached`);
      }
    } else if (stryMutAct_9fa48("3448") ? false : stryMutAct_9fa48("3447") ? true : stryMutAct_9fa48("3446") ? list.length : (stryCov_9fa48("3446", "3447", "3448"), !list.length)) {
      if (stryMutAct_9fa48("3449")) {
        {}
      } else {
        stryCov_9fa48("3449");
        done = stryMutAct_9fa48("3450") ? false : (stryCov_9fa48("3450"), true);
        reason = stryMutAct_9fa48("3451") ? "" : (stryCov_9fa48("3451"), 'no remaining candidate files');
      }
    }
    return stryMutAct_9fa48("3452") ? {} : (stryCov_9fa48("3452"), {
      done,
      reason,
      iteration: state.run.iteration,
      processed,
      candidates: stryMutAct_9fa48("3453") ? list : (stryCov_9fa48("3453"), list.slice(0, 100))
    });
  }
}

/**
 * One file per SOURCE file, not one per mutant.
 *
 * The loop writes a separate file per target on purpose: a failed attempt is trivially
 * droppable and two mutants cannot overwrite each other. That is right for the loop and
 * wrong for the PR. Measured on a real branch: ten files, 805 lines, for one source
 * file — because every file re-declares the same forty lines of module mocks to assert
 * one thing. A reviewer should get one file with ten tests.
 *
 * Verified exactly like the cleanup that precedes it: suite green, and neither half of
 * MAC may drop. Anything else and the originals come back.
 */
// How many files one merge request may carry. A single request holding every
// generated file is the slowest call the pipeline makes and the likeliest to be
// dropped — live, eleven files ended in "merge skipped: fetch failed" and the PR
// shipped all eleven, and an earlier sixteen-file merge aborted on the 300s timeout.
// Chunks bound both the prompt and the blast radius: a chunk that fails costs its own
// files and nothing else.
const MERGE_CHUNK = 4;
const MERGE_SYSTEM = (stryMutAct_9fa48("3454") ? "" : (stryCov_9fa48("3454"), 'You merge several generated test files for ONE source file into a single file. ')) + (stryMutAct_9fa48("3455") ? "" : (stryCov_9fa48("3455"), 'Keep EVERY test — same names, same assertions, same values. Deduplicate imports and shared mock setup ')) + (stryMutAct_9fa48("3456") ? "" : (stryCov_9fa48("3456"), 'into one block at the top. Do not rename tests, do not weaken or reorder assertions, do not add tests. ')) + (stryMutAct_9fa48("3457") ? "" : (stryCov_9fa48("3457"), 'Reply with ONLY the merged file content: no markdown fences, no explanation.'));

/** Test titles, used to prove a merge lost nothing. */
const testTitles = stryMutAct_9fa48("3458") ? () => undefined : (stryCov_9fa48("3458"), (() => {
  const testTitles = t => (stryMutAct_9fa48("3461") ? t.match(/\b(it|test)\s*\(\s*['"`]([^'"`]+)/g) && [] : stryMutAct_9fa48("3460") ? false : stryMutAct_9fa48("3459") ? true : (stryCov_9fa48("3459", "3460", "3461"), t.match(stryMutAct_9fa48("3468") ? /\b(it|test)\s*\(\s*['"`](['"`]+)/g : stryMutAct_9fa48("3467") ? /\b(it|test)\s*\(\s*['"`]([^'"`])/g : stryMutAct_9fa48("3466") ? /\b(it|test)\s*\(\s*[^'"`]([^'"`]+)/g : stryMutAct_9fa48("3465") ? /\b(it|test)\s*\(\S*['"`]([^'"`]+)/g : stryMutAct_9fa48("3464") ? /\b(it|test)\s*\(\s['"`]([^'"`]+)/g : stryMutAct_9fa48("3463") ? /\b(it|test)\S*\(\s*['"`]([^'"`]+)/g : stryMutAct_9fa48("3462") ? /\b(it|test)\s\(\s*['"`]([^'"`]+)/g : (stryCov_9fa48("3462", "3463", "3464", "3465", "3466", "3467", "3468"), /\b(it|test)\s*\(\s*['"`]([^'"`]+)/g)) || (stryMutAct_9fa48("3469") ? ["Stryker was here"] : (stryCov_9fa48("3469"), [])))).map(stryMutAct_9fa48("3470") ? () => undefined : (stryCov_9fa48("3470"), x => stryMutAct_9fa48("3471") ? x : (stryCov_9fa48("3471"), x.slice(stryMutAct_9fa48("3472") ? x.indexOf('(') - 1 : (stryCov_9fa48("3472"), x.indexOf(stryMutAct_9fa48("3473") ? "" : (stryCov_9fa48("3473"), '(')) + 1)))));
  return testTitles;
})());

/**
 * Merge one chunk. Returns the merged text, or null if the model failed, returned
 * something too small to be a test file, or dropped a test.
 */
async function mergeChunk(group) {
  if (stryMutAct_9fa48("3474")) {
    {}
  } else {
    stryCov_9fa48("3474");
    let text;
    try {
      if (stryMutAct_9fa48("3475")) {
        {}
      } else {
        stryCov_9fa48("3475");
        const r = await llm.chat(stryMutAct_9fa48("3476") ? {} : (stryCov_9fa48("3476"), {
          system: MERGE_SYSTEM,
          prompt: group.map(stryMutAct_9fa48("3477") ? () => undefined : (stryCov_9fa48("3477"), o => stryMutAct_9fa48("3478") ? `` : (stryCov_9fa48("3478"), `=== ${o.path} ===\n${o.content}`))).join(stryMutAct_9fa48("3479") ? "" : (stryCov_9fa48("3479"), '\n\n')),
          maxTokens: 12000,
          temperature: 0.1
        }));
        text = (stryMutAct_9fa48("3480") ? (r.text || '').replace(/^[\s\S]*?<\/think>/, '').replace(/^```[a-z]*\s*\n?/m, '').replace(/```\s*$/m, '') : (stryCov_9fa48("3480"), (stryMutAct_9fa48("3483") ? r.text && '' : stryMutAct_9fa48("3482") ? false : stryMutAct_9fa48("3481") ? true : (stryCov_9fa48("3481", "3482", "3483"), r.text || (stryMutAct_9fa48("3484") ? "Stryker was here!" : (stryCov_9fa48("3484"), '')))).replace(stryMutAct_9fa48("3489") ? /^[\s\s]*?<\/think>/ : stryMutAct_9fa48("3488") ? /^[\S\S]*?<\/think>/ : stryMutAct_9fa48("3487") ? /^[^\s\S]*?<\/think>/ : stryMutAct_9fa48("3486") ? /^[\s\S]<\/think>/ : stryMutAct_9fa48("3485") ? /[\s\S]*?<\/think>/ : (stryCov_9fa48("3485", "3486", "3487", "3488", "3489"), /^[\s\S]*?<\/think>/), stryMutAct_9fa48("3490") ? "Stryker was here!" : (stryCov_9fa48("3490"), '')).replace(stryMutAct_9fa48("3496") ? /^```[a-z]*\s*\n/m : stryMutAct_9fa48("3495") ? /^```[a-z]*\S*\n?/m : stryMutAct_9fa48("3494") ? /^```[a-z]*\s\n?/m : stryMutAct_9fa48("3493") ? /^```[^a-z]*\s*\n?/m : stryMutAct_9fa48("3492") ? /^```[a-z]\s*\n?/m : stryMutAct_9fa48("3491") ? /```[a-z]*\s*\n?/m : (stryCov_9fa48("3491", "3492", "3493", "3494", "3495", "3496"), /^```[a-z]*\s*\n?/m), stryMutAct_9fa48("3497") ? "Stryker was here!" : (stryCov_9fa48("3497"), '')).replace(stryMutAct_9fa48("3500") ? /```\S*$/m : stryMutAct_9fa48("3499") ? /```\s$/m : stryMutAct_9fa48("3498") ? /```\s*/m : (stryCov_9fa48("3498", "3499", "3500"), /```\s*$/m), stryMutAct_9fa48("3501") ? "Stryker was here!" : (stryCov_9fa48("3501"), '')).trim())) + (stryMutAct_9fa48("3502") ? "" : (stryCov_9fa48("3502"), '\n'));
      }
    } catch (e) {
      if (stryMutAct_9fa48("3503")) {
        {}
      } else {
        stryCov_9fa48("3503");
        S.event(stryMutAct_9fa48("3504") ? "" : (stryCov_9fa48("3504"), 'preparing_pr'), (stryMutAct_9fa48("3505") ? `` : (stryCov_9fa48("3505"), `merge chunk skipped (${group.length} file(s)): `)) + (stryMutAct_9fa48("3506") ? e.message : (stryCov_9fa48("3506"), e.message.slice(0, 120))));
        return null;
      }
    }
    // every test must still be there: losing one is a silent regression the metrics
    // might not notice, because a dropped test can leave the score untouched
    const missing = stryMutAct_9fa48("3507") ? group.flatMap(o => testTitles(o.content)) : (stryCov_9fa48("3507"), group.flatMap(stryMutAct_9fa48("3508") ? () => undefined : (stryCov_9fa48("3508"), o => testTitles(o.content))).filter(stryMutAct_9fa48("3509") ? () => undefined : (stryCov_9fa48("3509"), t => stryMutAct_9fa48("3510") ? testTitles(text).includes(t) : (stryCov_9fa48("3510"), !testTitles(text).includes(t)))));
    if (stryMutAct_9fa48("3513") ? text.length < 200 && missing.length : stryMutAct_9fa48("3512") ? false : stryMutAct_9fa48("3511") ? true : (stryCov_9fa48("3511", "3512", "3513"), (stryMutAct_9fa48("3516") ? text.length >= 200 : stryMutAct_9fa48("3515") ? text.length <= 200 : stryMutAct_9fa48("3514") ? false : (stryCov_9fa48("3514", "3515", "3516"), text.length < 200)) || missing.length)) {
      if (stryMutAct_9fa48("3517")) {
        {}
      } else {
        stryCov_9fa48("3517");
        S.event(stryMutAct_9fa48("3518") ? "" : (stryCov_9fa48("3518"), 'preparing_pr'), stryMutAct_9fa48("3519") ? `` : (stryCov_9fa48("3519"), `merge chunk rejected: ${missing.length} test(s) would be lost`));
        return null;
      }
    }
    return text;
  }
}
async function consolidate(file, covBase, mutBase) {
  if (stryMutAct_9fa48("3520")) {
    {}
  } else {
    stryCov_9fa48("3520");
    const changed = stryMutAct_9fa48("3521") ? await pr.changedTestFiles() : (stryCov_9fa48("3521"), (await pr.changedTestFiles()).filter(stryMutAct_9fa48("3522") ? () => undefined : (stryCov_9fa48("3522"), p => repo.GENERATED_TEST_RE.test(p))));
    if (stryMutAct_9fa48("3526") ? changed.length >= 2 : stryMutAct_9fa48("3525") ? changed.length <= 2 : stryMutAct_9fa48("3524") ? false : stryMutAct_9fa48("3523") ? true : (stryCov_9fa48("3523", "3524", "3525", "3526"), changed.length < 2)) return 0;
    const originals = stryMutAct_9fa48("3527") ? changed.map(p => ({
      path: p,
      content: repo.readFileSafe(p, 200000)
    })) : (stryCov_9fa48("3527"), changed.map(stryMutAct_9fa48("3528") ? () => undefined : (stryCov_9fa48("3528"), p => stryMutAct_9fa48("3529") ? {} : (stryCov_9fa48("3529"), {
      path: p,
      content: repo.readFileSafe(p, 200000)
    }))).filter(stryMutAct_9fa48("3530") ? () => undefined : (stryCov_9fa48("3530"), o => o.content)));
    if (stryMutAct_9fa48("3534") ? originals.length >= 2 : stryMutAct_9fa48("3533") ? originals.length <= 2 : stryMutAct_9fa48("3532") ? false : stryMutAct_9fa48("3531") ? true : (stryCov_9fa48("3531", "3532", "3533", "3534"), originals.length < 2)) return 0;
    const ext = (stryMutAct_9fa48("3537") ? file.match(/\.[cm]?[jt]sx?$/) && ['.ts'] : stryMutAct_9fa48("3536") ? false : stryMutAct_9fa48("3535") ? true : (stryCov_9fa48("3535", "3536", "3537"), file.match(stryMutAct_9fa48("3542") ? /\.[cm]?[jt]sx$/ : stryMutAct_9fa48("3541") ? /\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("3540") ? /\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("3539") ? /\.[cm][jt]sx?$/ : stryMutAct_9fa48("3538") ? /\.[cm]?[jt]sx?/ : (stryCov_9fa48("3538", "3539", "3540", "3541", "3542"), /\.[cm]?[jt]sx?$/)) || (stryMutAct_9fa48("3543") ? [] : (stryCov_9fa48("3543"), [stryMutAct_9fa48("3544") ? "" : (stryCov_9fa48("3544"), '.ts')]))))[0];
    const stem = originals[0].path.replace(stryMutAct_9fa48("3556") ? /\.(kill-(L\d+|batch)-[a-z0-9-]+|mac-cov(-r\d+)?)\.test\.[cm]?[jt]sx$/ : stryMutAct_9fa48("3555") ? /\.(kill-(L\d+|batch)-[a-z0-9-]+|mac-cov(-r\d+)?)\.test\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("3554") ? /\.(kill-(L\d+|batch)-[a-z0-9-]+|mac-cov(-r\d+)?)\.test\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("3553") ? /\.(kill-(L\d+|batch)-[a-z0-9-]+|mac-cov(-r\d+)?)\.test\.[cm][jt]sx?$/ : stryMutAct_9fa48("3552") ? /\.(kill-(L\d+|batch)-[a-z0-9-]+|mac-cov(-r\D+)?)\.test\.[cm]?[jt]sx?$/ : stryMutAct_9fa48("3551") ? /\.(kill-(L\d+|batch)-[a-z0-9-]+|mac-cov(-r\d)?)\.test\.[cm]?[jt]sx?$/ : stryMutAct_9fa48("3550") ? /\.(kill-(L\d+|batch)-[a-z0-9-]+|mac-cov(-r\d+))\.test\.[cm]?[jt]sx?$/ : stryMutAct_9fa48("3549") ? /\.(kill-(L\d+|batch)-[^a-z0-9-]+|mac-cov(-r\d+)?)\.test\.[cm]?[jt]sx?$/ : stryMutAct_9fa48("3548") ? /\.(kill-(L\d+|batch)-[a-z0-9-]|mac-cov(-r\d+)?)\.test\.[cm]?[jt]sx?$/ : stryMutAct_9fa48("3547") ? /\.(kill-(L\D+|batch)-[a-z0-9-]+|mac-cov(-r\d+)?)\.test\.[cm]?[jt]sx?$/ : stryMutAct_9fa48("3546") ? /\.(kill-(L\d|batch)-[a-z0-9-]+|mac-cov(-r\d+)?)\.test\.[cm]?[jt]sx?$/ : stryMutAct_9fa48("3545") ? /\.(kill-(L\d+|batch)-[a-z0-9-]+|mac-cov(-r\d+)?)\.test\.[cm]?[jt]sx?/ : (stryCov_9fa48("3545", "3546", "3547", "3548", "3549", "3550", "3551", "3552", "3553", "3554", "3555", "3556"), /\.(kill-(L\d+|batch)-[a-z0-9-]+|mac-cov(-r\d+)?)\.test\.[cm]?[jt]sx?$/), stryMutAct_9fa48("3557") ? "Stryker was here!" : (stryCov_9fa48("3557"), ''));
    if (stryMutAct_9fa48("3560") ? stem !== originals[0].path : stryMutAct_9fa48("3559") ? false : stryMutAct_9fa48("3558") ? true : (stryCov_9fa48("3558", "3559", "3560"), stem === originals[0].path)) return 0;
    const chunks = stryMutAct_9fa48("3561") ? ["Stryker was here"] : (stryCov_9fa48("3561"), []);
    for (let i = 0; stryMutAct_9fa48("3564") ? i >= originals.length : stryMutAct_9fa48("3563") ? i <= originals.length : stryMutAct_9fa48("3562") ? false : (stryCov_9fa48("3562", "3563", "3564"), i < originals.length); stryMutAct_9fa48("3565") ? i -= MERGE_CHUNK : (stryCov_9fa48("3565"), i += MERGE_CHUNK)) chunks.push(stryMutAct_9fa48("3566") ? originals : (stryCov_9fa48("3566"), originals.slice(i, stryMutAct_9fa48("3567") ? i - MERGE_CHUNK : (stryCov_9fa48("3567"), i + MERGE_CHUNK))));
    S.setStage(stryMutAct_9fa48("3568") ? "" : (stryCov_9fa48("3568"), 'preparing_pr'), stryMutAct_9fa48("3569") ? `` : (stryCov_9fa48("3569"), `folding ${originals.length} generated test files for ${file} in ${chunks.length} chunk(s)`));

    // one target per chunk: .mac.test.ts, .mac-r2.test.ts, … — all shapes
    // GENERATED_TEST_RE already recognises, so a later round folds them again
    const written = stryMutAct_9fa48("3570") ? ["Stryker was here"] : (stryCov_9fa48("3570"), []),
      folded = stryMutAct_9fa48("3571") ? ["Stryker was here"] : (stryCov_9fa48("3571"), []);
    for (const [i, group] of chunks.entries()) {
      if (stryMutAct_9fa48("3572")) {
        {}
      } else {
        stryCov_9fa48("3572");
        if (stryMutAct_9fa48("3576") ? group.length >= 2 : stryMutAct_9fa48("3575") ? group.length <= 2 : stryMutAct_9fa48("3574") ? false : stryMutAct_9fa48("3573") ? true : (stryCov_9fa48("3573", "3574", "3575", "3576"), group.length < 2)) continue; // nothing to gain from folding one file
        const text = await mergeChunk(group);
        if (stryMutAct_9fa48("3579") ? false : stryMutAct_9fa48("3578") ? true : stryMutAct_9fa48("3577") ? text : (stryCov_9fa48("3577", "3578", "3579"), !text)) continue; // this chunk keeps its own files
        const target = stryMutAct_9fa48("3580") ? `` : (stryCov_9fa48("3580"), `${stem}${(stryMutAct_9fa48("3583") ? i !== 0 : stryMutAct_9fa48("3582") ? false : stryMutAct_9fa48("3581") ? true : (stryCov_9fa48("3581", "3582", "3583"), i === 0)) ? stryMutAct_9fa48("3584") ? "" : (stryCov_9fa48("3584"), '.mac') : stryMutAct_9fa48("3585") ? `` : (stryCov_9fa48("3585"), `.mac-r${stryMutAct_9fa48("3586") ? i - 1 : (stryCov_9fa48("3586"), i + 1)}`)}.test${ext}`);
        if (stryMutAct_9fa48("3589") ? group.every(o => o.path === target) : stryMutAct_9fa48("3588") ? false : stryMutAct_9fa48("3587") ? true : (stryCov_9fa48("3587", "3588", "3589"), group.some(stryMutAct_9fa48("3590") ? () => undefined : (stryCov_9fa48("3590"), o => stryMutAct_9fa48("3593") ? o.path !== target : stryMutAct_9fa48("3592") ? false : stryMutAct_9fa48("3591") ? true : (stryCov_9fa48("3591", "3592", "3593"), o.path === target))))) continue;
        for (const o of group) repo.deleteTestFile(o.path);
        repo.writeTestFile(target, text);
        written.push(target);
        folded.push(...group);
      }
    }
    if (stryMutAct_9fa48("3596") ? false : stryMutAct_9fa48("3595") ? true : stryMutAct_9fa48("3594") ? written.length : (stryCov_9fa48("3594", "3595", "3596"), !written.length)) return 0;
    const mergedText = written.map(stryMutAct_9fa48("3597") ? () => undefined : (stryCov_9fa48("3597"), p => stryMutAct_9fa48("3600") ? repo.readFileSafe(p, 200000) && '' : stryMutAct_9fa48("3599") ? false : stryMutAct_9fa48("3598") ? true : (stryCov_9fa48("3598", "3599", "3600"), repo.readFileSafe(p, 200000) || (stryMutAct_9fa48("3601") ? "Stryker was here!" : (stryCov_9fa48("3601"), ''))))).join(stryMutAct_9fa48("3602") ? "Stryker was here!" : (stryCov_9fa48("3602"), ''));
    const target = written.join(stryMutAct_9fa48("3603") ? "" : (stryCov_9fa48("3603"), ', '));
    const cr = await coverage.runCoverage();
    let ok = stryMutAct_9fa48("3604") ? true : (stryCov_9fa48("3604"), false),
      newCov = null,
      newScore = null;
    if (stryMutAct_9fa48("3607") ? cr.exitCode !== 0 : stryMutAct_9fa48("3606") ? false : stryMutAct_9fa48("3605") ? true : (stryCov_9fa48("3605", "3606", "3607"), cr.exitCode === 0)) {
      if (stryMutAct_9fa48("3608")) {
        {}
      } else {
        stryCov_9fa48("3608");
        newCov = stryMutAct_9fa48("3609") ? state.files[file]?.coverage && null : (stryCov_9fa48("3609"), (stryMutAct_9fa48("3610") ? state.files[file].coverage : (stryCov_9fa48("3610"), state.files[file]?.coverage)) ?? null);
        try {
          if (stryMutAct_9fa48("3611")) {
            {}
          } else {
            stryCov_9fa48("3611");
            const st = await stryker.runStryker(file);
            newScore = st.score;
            ok = stryMutAct_9fa48("3614") ? !st.noTests && st.totalMutants != null && newScore >= mutBase || (newCov ?? 0) >= covBase : stryMutAct_9fa48("3613") ? false : stryMutAct_9fa48("3612") ? true : (stryCov_9fa48("3612", "3613", "3614"), (stryMutAct_9fa48("3616") ? !st.noTests && st.totalMutants != null || newScore >= mutBase : stryMutAct_9fa48("3615") ? true : (stryCov_9fa48("3615", "3616"), (stryMutAct_9fa48("3618") ? !st.noTests || st.totalMutants != null : stryMutAct_9fa48("3617") ? true : (stryCov_9fa48("3617", "3618"), (stryMutAct_9fa48("3619") ? st.noTests : (stryCov_9fa48("3619"), !st.noTests)) && (stryMutAct_9fa48("3621") ? st.totalMutants == null : stryMutAct_9fa48("3620") ? true : (stryCov_9fa48("3620", "3621"), st.totalMutants != null)))) && (stryMutAct_9fa48("3624") ? newScore < mutBase : stryMutAct_9fa48("3623") ? newScore > mutBase : stryMutAct_9fa48("3622") ? true : (stryCov_9fa48("3622", "3623", "3624"), newScore >= mutBase)))) && (stryMutAct_9fa48("3627") ? (newCov ?? 0) < covBase : stryMutAct_9fa48("3626") ? (newCov ?? 0) > covBase : stryMutAct_9fa48("3625") ? true : (stryCov_9fa48("3625", "3626", "3627"), (stryMutAct_9fa48("3628") ? newCov && 0 : (stryCov_9fa48("3628"), newCov ?? 0)) >= covBase)));
          }
        } catch {
          if (stryMutAct_9fa48("3629")) {
            {}
          } else {
            stryCov_9fa48("3629");
            ok = stryMutAct_9fa48("3630") ? true : (stryCov_9fa48("3630"), false);
          }
        }
      }
    }
    if (stryMutAct_9fa48("3633") ? false : stryMutAct_9fa48("3632") ? true : stryMutAct_9fa48("3631") ? ok : (stryCov_9fa48("3631", "3632", "3633"), !ok)) {
      if (stryMutAct_9fa48("3634")) {
        {}
      } else {
        stryCov_9fa48("3634");
        for (const p of written) repo.deleteTestFile(p);
        for (const o of folded) repo.writeTestFile(o.path, o.content);
        S.upsertFile(file, stryMutAct_9fa48("3635") ? {} : (stryCov_9fa48("3635"), {
          coverage: covBase,
          coverageAfter: covBase
        }));
        S.event(stryMutAct_9fa48("3636") ? "" : (stryCov_9fa48("3636"), 'preparing_pr'), stryMutAct_9fa48("3637") ? `` : (stryCov_9fa48("3637"), `merge reverted: coverage ${covBase}→${newCov}, mutation ${mutBase}→${newScore}`));
        return 0;
      }
    }
    S.upsertFile(file, stryMutAct_9fa48("3638") ? {} : (stryCov_9fa48("3638"), {
      coverage: newCov,
      coverageAfter: newCov,
      mutation: newScore,
      mutationAfter: newScore,
      mac: mac(newCov, newScore),
      macAfter: mac(newCov, newScore)
    }));
    // The fold's own report is not evidence that anything landed: it once merged two
    // files, logged success, and left three others in the PR because the filter above
    // could not see them. State what is on disk and what git has, and check the branch
    // diff afterwards, so a fold that quietly achieves nothing says so.
    const onDisk = stryMutAct_9fa48("3639") ? written.some(p => repo.readFileSafe(p, 200) !== null) : (stryCov_9fa48("3639"), written.every(stryMutAct_9fa48("3640") ? () => undefined : (stryCov_9fa48("3640"), p => stryMutAct_9fa48("3643") ? repo.readFileSafe(p, 200) === null : stryMutAct_9fa48("3642") ? false : stryMutAct_9fa48("3641") ? true : (stryCov_9fa48("3641", "3642", "3643"), repo.readFileSafe(p, 200) !== null))));
    const pending = stryMutAct_9fa48("3644") ? await pr.changedFiles() : (stryCov_9fa48("3644"), (await pr.changedFiles()).filter(stryMutAct_9fa48("3645") ? () => undefined : (stryCov_9fa48("3645"), p => (stryMutAct_9fa48("3650") ? /\.test\.[cm]?[jt]sx$/ : stryMutAct_9fa48("3649") ? /\.test\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("3648") ? /\.test\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("3647") ? /\.test\.[cm][jt]sx?$/ : stryMutAct_9fa48("3646") ? /\.test\.[cm]?[jt]sx?/ : (stryCov_9fa48("3646", "3647", "3648", "3649", "3650"), /\.test\.[cm]?[jt]sx?$/)).test(p))));
    S.event(stryMutAct_9fa48("3651") ? "" : (stryCov_9fa48("3651"), 'preparing_pr'), stryMutAct_9fa48("3652") ? `` : (stryCov_9fa48("3652"), `merge → ${target} on disk: ${onDisk}; git sees ${pending.length} changed test file(s)`));
    try {
      if (stryMutAct_9fa48("3653")) {
        {}
      } else {
        stryCov_9fa48("3653");
        await pr.commit(stryMutAct_9fa48("3654") ? `` : (stryCov_9fa48("3654"), `test: fold generated tests for ${file} into one file`));
      }
    } catch (e) {
      if (stryMutAct_9fa48("3655")) {
        {}
      } else {
        stryCov_9fa48("3655");
        S.event(stryMutAct_9fa48("3656") ? "" : (stryCov_9fa48("3656"), 'preparing_pr'), (stryMutAct_9fa48("3657") ? "" : (stryCov_9fa48("3657"), 'merge commit note: ')) + (stryMutAct_9fa48("3658") ? e.message : (stryCov_9fa48("3658"), e.message.slice(0, 140))));
      }
    }
    const diffNow = await pr.changedTestFiles();
    const committed = stryMutAct_9fa48("3659") ? written.some(p => diffNow.includes(p)) : (stryCov_9fa48("3659"), written.every(stryMutAct_9fa48("3660") ? () => undefined : (stryCov_9fa48("3660"), p => diffNow.includes(p))));
    S.event(stryMutAct_9fa48("3661") ? "" : (stryCov_9fa48("3661"), 'preparing_pr'), (stryMutAct_9fa48("3662") ? `` : (stryCov_9fa48("3662"), `merged ${folded.length} files into ${target} (${mergedText.length}B)`)) + (committed ? stryMutAct_9fa48("3663") ? "Stryker was here!" : (stryCov_9fa48("3663"), '') : stryMutAct_9fa48("3664") ? "" : (stryCov_9fa48("3664"), ' — WARNING: it is not in the branch diff, so the PR will carry the originals')));
    return folded.length;
  }
}

// ── route table ────────────────────────────────────────────────────────────
const routes = stryMutAct_9fa48("3665") ? {} : (stryCov_9fa48("3665"), {
  'GET /api/health': stryMutAct_9fa48("3666") ? () => undefined : (stryCov_9fa48("3666"), async () => stryMutAct_9fa48("3667") ? {} : (stryCov_9fa48("3667"), {
    ok: stryMutAct_9fa48("3668") ? false : (stryCov_9fa48("3668"), true),
    service: stryMutAct_9fa48("3669") ? "" : (stryCov_9fa48("3669"), 'ijst-sidecar'),
    stage: state.stage.name,
    ts: Date.now()
  })),
  'GET /api/state': stryMutAct_9fa48("3670") ? () => undefined : (stryCov_9fa48("3670"), async () => state),
  'GET /api/metrics': stryMutAct_9fa48("3671") ? () => undefined : (stryCov_9fa48("3671"), async () => metricsPayload()),
  'GET /api/rules': stryMutAct_9fa48("3672") ? () => undefined : (stryCov_9fa48("3672"), async () => stryMutAct_9fa48("3673") ? {} : (stryCov_9fa48("3673"), {
    rules: stryMutAct_9fa48("3676") ? state.run?.config?.rules && S.envConfig().rules : stryMutAct_9fa48("3675") ? false : stryMutAct_9fa48("3674") ? true : (stryCov_9fa48("3674", "3675", "3676"), (stryMutAct_9fa48("3678") ? state.run.config?.rules : stryMutAct_9fa48("3677") ? state.run?.config.rules : (stryCov_9fa48("3677", "3678"), state.run?.config?.rules)) || S.envConfig().rules),
    decisions: state.decisions
  })),
  // live model transcript for the dashboard; `after` makes it an incremental feed
  'GET /api/dialog': async q => {
    if (stryMutAct_9fa48("3679")) {
      {}
    } else {
      stryCov_9fa48("3679");
      const after = parseInt(stryMutAct_9fa48("3682") ? q.get('after') && '0' : stryMutAct_9fa48("3681") ? false : stryMutAct_9fa48("3680") ? true : (stryCov_9fa48("3680", "3681", "3682"), q.get(stryMutAct_9fa48("3683") ? "" : (stryCov_9fa48("3683"), 'after')) || (stryMutAct_9fa48("3684") ? "" : (stryCov_9fa48("3684"), '0'))), 10);
      const items = stryMutAct_9fa48("3685") ? state.dialog || [] : (stryCov_9fa48("3685"), (stryMutAct_9fa48("3688") ? state.dialog && [] : stryMutAct_9fa48("3687") ? false : stryMutAct_9fa48("3686") ? true : (stryCov_9fa48("3686", "3687", "3688"), state.dialog || (stryMutAct_9fa48("3689") ? ["Stryker was here"] : (stryCov_9fa48("3689"), [])))).filter(stryMutAct_9fa48("3690") ? () => undefined : (stryCov_9fa48("3690"), d => stryMutAct_9fa48("3694") ? d.seq <= after : stryMutAct_9fa48("3693") ? d.seq >= after : stryMutAct_9fa48("3692") ? false : stryMutAct_9fa48("3691") ? true : (stryCov_9fa48("3691", "3692", "3693", "3694"), d.seq > after))));
      return stryMutAct_9fa48("3695") ? {} : (stryCov_9fa48("3695"), {
        dialog: stryMutAct_9fa48("3696") ? items : (stryCov_9fa48("3696"), items.slice(stryMutAct_9fa48("3697") ? +20 : (stryCov_9fa48("3697"), -20))),
        latestSeq: stryMutAct_9fa48("3700") ? state.dialogSeq && 0 : stryMutAct_9fa48("3699") ? false : stryMutAct_9fa48("3698") ? true : (stryCov_9fa48("3698", "3699", "3700"), state.dialogSeq || 0)
      });
    }
  },
  'GET /api/events': async q => {
    if (stryMutAct_9fa48("3701")) {
      {}
    } else {
      stryCov_9fa48("3701");
      const after = parseInt(stryMutAct_9fa48("3704") ? q.get('after') && '0' : stryMutAct_9fa48("3703") ? false : stryMutAct_9fa48("3702") ? true : (stryCov_9fa48("3702", "3703", "3704"), q.get(stryMutAct_9fa48("3705") ? "" : (stryCov_9fa48("3705"), 'after')) || (stryMutAct_9fa48("3706") ? "" : (stryCov_9fa48("3706"), '0'))), 10);
      return stryMutAct_9fa48("3707") ? {} : (stryCov_9fa48("3707"), {
        events: stryMutAct_9fa48("3708") ? state.events : (stryCov_9fa48("3708"), state.events.filter(stryMutAct_9fa48("3709") ? () => undefined : (stryCov_9fa48("3709"), e => stryMutAct_9fa48("3713") ? e.seq <= after : stryMutAct_9fa48("3712") ? e.seq >= after : stryMutAct_9fa48("3711") ? false : stryMutAct_9fa48("3710") ? true : (stryCov_9fa48("3710", "3711", "3712", "3713"), e.seq > after))))
      });
    }
  },
  'POST /api/stage': async (q, body) => {
    if (stryMutAct_9fa48("3714")) {
      {}
    } else {
      stryCov_9fa48("3714");
      S.setStage(String(stryMutAct_9fa48("3717") ? body.stage && 'idle' : stryMutAct_9fa48("3716") ? false : stryMutAct_9fa48("3715") ? true : (stryCov_9fa48("3715", "3716", "3717"), body.stage || (stryMutAct_9fa48("3718") ? "" : (stryCov_9fa48("3718"), 'idle')))), String(stryMutAct_9fa48("3721") ? body.detail && '' : stryMutAct_9fa48("3720") ? false : stryMutAct_9fa48("3719") ? true : (stryCov_9fa48("3719", "3720", "3721"), body.detail || (stryMutAct_9fa48("3722") ? "Stryker was here!" : (stryCov_9fa48("3722"), '')))));
      return stryMutAct_9fa48("3723") ? {} : (stryCov_9fa48("3723"), {
        ok: stryMutAct_9fa48("3724") ? false : (stryCov_9fa48("3724"), true),
        stage: state.stage
      });
    }
  },
  'POST /api/run/start': async (q, body) => {
    if (stryMutAct_9fa48("3725")) {
      {}
    } else {
      stryCov_9fa48("3725");
      // one git worktree + one run state: overlapping executions would corrupt both.
      // `force` (used by the batch driver, which owns execution lifecycle) and a
      // staleness window let a genuinely dead run be taken over.
      // 'interrupted' means the sidecar restarted: whatever execution owned that
      // run is gone, so it can never be a real concurrency conflict.
      const active = stryMutAct_9fa48("3728") ? state.run && state.run.status === 'running' || state.stage?.name !== 'interrupted' : stryMutAct_9fa48("3727") ? false : stryMutAct_9fa48("3726") ? true : (stryCov_9fa48("3726", "3727", "3728"), (stryMutAct_9fa48("3730") ? state.run || state.run.status === 'running' : stryMutAct_9fa48("3729") ? true : (stryCov_9fa48("3729", "3730"), state.run && (stryMutAct_9fa48("3732") ? state.run.status !== 'running' : stryMutAct_9fa48("3731") ? true : (stryCov_9fa48("3731", "3732"), state.run.status === (stryMutAct_9fa48("3733") ? "" : (stryCov_9fa48("3733"), 'running')))))) && (stryMutAct_9fa48("3735") ? state.stage?.name === 'interrupted' : stryMutAct_9fa48("3734") ? true : (stryCov_9fa48("3734", "3735"), (stryMutAct_9fa48("3736") ? state.stage.name : (stryCov_9fa48("3736"), state.stage?.name)) !== (stryMutAct_9fa48("3737") ? "" : (stryCov_9fa48("3737"), 'interrupted')))));
      const idleSec = stryMutAct_9fa48("3738") ? Math.floor(Date.now() / 1000) + (state.stage?.since || 0) : (stryCov_9fa48("3738"), Math.floor(stryMutAct_9fa48("3739") ? Date.now() * 1000 : (stryCov_9fa48("3739"), Date.now() / 1000)) - (stryMutAct_9fa48("3742") ? state.stage?.since && 0 : stryMutAct_9fa48("3741") ? false : stryMutAct_9fa48("3740") ? true : (stryCov_9fa48("3740", "3741", "3742"), (stryMutAct_9fa48("3743") ? state.stage.since : (stryCov_9fa48("3743"), state.stage?.since)) || 0)));
      if (stryMutAct_9fa48("3746") ? active && !body.force || idleSec < 900 : stryMutAct_9fa48("3745") ? false : stryMutAct_9fa48("3744") ? true : (stryCov_9fa48("3744", "3745", "3746"), (stryMutAct_9fa48("3748") ? active || !body.force : stryMutAct_9fa48("3747") ? true : (stryCov_9fa48("3747", "3748"), active && (stryMutAct_9fa48("3749") ? body.force : (stryCov_9fa48("3749"), !body.force)))) && (stryMutAct_9fa48("3752") ? idleSec >= 900 : stryMutAct_9fa48("3751") ? idleSec <= 900 : stryMutAct_9fa48("3750") ? true : (stryCov_9fa48("3750", "3751", "3752"), idleSec < 900)))) {
        if (stryMutAct_9fa48("3753")) {
          {}
        } else {
          stryCov_9fa48("3753");
          const err = new Error((stryMutAct_9fa48("3754") ? `` : (stryCov_9fa48("3754"), `a run is already active (${state.run.id}, stage ${state.stage.name}, `)) + (stryMutAct_9fa48("3755") ? `` : (stryCov_9fa48("3755"), `${idleSec}s since last stage change) — stop it first or pass force:true`)));
          err.statusCode = 409;
          throw err;
        }
      }
      if (stryMutAct_9fa48("3757") ? false : stryMutAct_9fa48("3756") ? true : (stryCov_9fa48("3756", "3757"), active)) S.event(stryMutAct_9fa48("3758") ? "" : (stryCov_9fa48("3758"), 'starting'), stryMutAct_9fa48("3759") ? `` : (stryCov_9fa48("3759"), `taking over stale/forced run ${state.run.id} (idle ${idleSec}s)`));
      state.run = S.freshRun(body);
      state.files = {};
      state.decisions = {};
      state.prs = stryMutAct_9fa48("3760") ? ["Stryker was here"] : (stryCov_9fa48("3760"), []);
      state.pickFailures = 0;
      if (stryMutAct_9fa48("3762") ? false : stryMutAct_9fa48("3761") ? true : (stryCov_9fa48("3761", "3762"), body.clearLedger)) {
        if (stryMutAct_9fa48("3763")) {
          {}
        } else {
          stryCov_9fa48("3763");
          // all four, or the run is not the independent one it claims to be: measure,
          // overhead and token history survived and were read back as this run's own
          const slug = slugify(state.run.config.repoUrl);
          for (const k of stryMutAct_9fa48("3764") ? [] : (stryCov_9fa48("3764"), [stryMutAct_9fa48("3765") ? "" : (stryCov_9fa48("3765"), 'improvedLedger'), stryMutAct_9fa48("3766") ? "" : (stryCov_9fa48("3766"), 'measureLedger'), stryMutAct_9fa48("3767") ? "" : (stryCov_9fa48("3767"), 'overheadLedger'), stryMutAct_9fa48("3768") ? "" : (stryCov_9fa48("3768"), 'tokenLedger')])) delete state[k][slug];
        }
      }
      S.setStage(stryMutAct_9fa48("3769") ? "" : (stryCov_9fa48("3769"), 'starting'), stryMutAct_9fa48("3770") ? `` : (stryCov_9fa48("3770"), `run ${state.run.id} on ${state.run.config.repoUrl}#${state.run.config.repoBranch}`));
      S.save();
      return stryMutAct_9fa48("3771") ? {} : (stryCov_9fa48("3771"), {
        ok: stryMutAct_9fa48("3772") ? false : (stryCov_9fa48("3772"), true),
        run: state.run
      });
    }
  },
  'POST /api/run/finish': async (q, body) => {
    if (stryMutAct_9fa48("3773")) {
      {}
    } else {
      stryCov_9fa48("3773");
      needRun();
      state.run.status = stryMutAct_9fa48("3776") ? body.status && 'done' : stryMutAct_9fa48("3775") ? false : stryMutAct_9fa48("3774") ? true : (stryCov_9fa48("3774", "3775", "3776"), body.status || (stryMutAct_9fa48("3777") ? "" : (stryCov_9fa48("3777"), 'done')));
      state.run.finishedAt = Math.floor(stryMutAct_9fa48("3778") ? Date.now() * 1000 : (stryCov_9fa48("3778"), Date.now() / 1000));
      S.setStage(stryMutAct_9fa48("3779") ? "" : (stryCov_9fa48("3779"), 'done'), stryMutAct_9fa48("3780") ? `` : (stryCov_9fa48("3780"), `run finished: ${state.run.status}; ${state.prs.length} PR(s)`));
      await repo.resetToBase().catch(() => {});
      return stryMutAct_9fa48("3781") ? {} : (stryCov_9fa48("3781"), {
        ok: stryMutAct_9fa48("3782") ? false : (stryCov_9fa48("3782"), true),
        run: state.run,
        prs: state.prs
      });
    }
  },
  'POST /api/repo/clone': async () => {
    if (stryMutAct_9fa48("3783")) {
      {}
    } else {
      stryCov_9fa48("3783");
      needRun();
      S.setStage(stryMutAct_9fa48("3784") ? "" : (stryCov_9fa48("3784"), 'cloning'), state.run.config.repoUrl);
      return stryMutAct_9fa48("3785") ? {} : (stryCov_9fa48("3785"), {
        ok: stryMutAct_9fa48("3786") ? false : (stryCov_9fa48("3786"), true),
        ...(await repo.clone())
      });
    }
  },
  'POST /api/repo/prepare': async () => {
    if (stryMutAct_9fa48("3787")) {
      {}
    } else {
      stryCov_9fa48("3787");
      needRun();
      S.setStage(stryMutAct_9fa48("3788") ? "" : (stryCov_9fa48("3788"), 'installing'), stryMutAct_9fa48("3789") ? "" : (stryCov_9fa48("3789"), 'installing dependencies + tooling'));
      const det = await repo.install();
      const files = await repo.listScopeFiles();
      // replay measurements first: every file we ever measured keeps its numbers,
      // whether or not it was ever improved (status is untouched here)
      let remeasured = 0;
      for (const [p, m] of Object.entries(measured())) {
        if (stryMutAct_9fa48("3790")) {
          {}
        } else {
          stryCov_9fa48("3790");
          if (stryMutAct_9fa48("3793") ? false : stryMutAct_9fa48("3792") ? true : stryMutAct_9fa48("3791") ? state.files[p] : (stryCov_9fa48("3791", "3792", "3793"), !state.files[p])) continue;
          S.upsertFile(p, stryMutAct_9fa48("3794") ? {} : (stryCov_9fa48("3794"), {
            coverageBefore: m.coverageBefore,
            mutationBefore: m.mutationBefore,
            macBefore: m.macBefore,
            attemptCoverage: m.attemptCoverage,
            attemptMutation: m.attemptMutation,
            attemptMac: m.attemptMac,
            failure: m.failure
          }));
          stryMutAct_9fa48("3795") ? remeasured -= 1 : (stryCov_9fa48("3795"), remeasured += 1);
        }
      }
      // replay the persistent ledger so finished files are not re-picked
      let replayed = 0;
      for (const [p, rec] of Object.entries(ledger())) {
        if (stryMutAct_9fa48("3796")) {
          {}
        } else {
          stryCov_9fa48("3796");
          if (stryMutAct_9fa48("3799") ? false : stryMutAct_9fa48("3798") ? true : stryMutAct_9fa48("3797") ? state.files[p] : (stryCov_9fa48("3797", "3798", "3799"), !state.files[p])) continue;
          S.upsertFile(p, (stryMutAct_9fa48("3802") ? rec.state !== 'improved' : stryMutAct_9fa48("3801") ? false : stryMutAct_9fa48("3800") ? true : (stryCov_9fa48("3800", "3801", "3802"), rec.state === (stryMutAct_9fa48("3803") ? "" : (stryCov_9fa48("3803"), 'improved')))) ? stryMutAct_9fa48("3804") ? {} : (stryCov_9fa48("3804"), {
            status: stryMutAct_9fa48("3805") ? "" : (stryCov_9fa48("3805"), 'improved'),
            fromLedger: stryMutAct_9fa48("3806") ? false : (stryCov_9fa48("3806"), true),
            prUrl: stryMutAct_9fa48("3809") ? rec.prUrl && null : stryMutAct_9fa48("3808") ? false : stryMutAct_9fa48("3807") ? true : (stryCov_9fa48("3807", "3808", "3809"), rec.prUrl || null),
            prPatch: stryMutAct_9fa48("3812") ? rec.patchPath && null : stryMutAct_9fa48("3811") ? false : stryMutAct_9fa48("3810") ? true : (stryCov_9fa48("3810", "3811", "3812"), rec.patchPath || null),
            ...(stryMutAct_9fa48("3815") ? rec.metrics && {} : stryMutAct_9fa48("3814") ? false : stryMutAct_9fa48("3813") ? true : (stryCov_9fa48("3813", "3814", "3815"), rec.metrics || {}))
          }) : stryMutAct_9fa48("3816") ? {} : (stryCov_9fa48("3816"), {
            status: (stryMutAct_9fa48("3819") ? rec.state !== 'failed' : stryMutAct_9fa48("3818") ? false : stryMutAct_9fa48("3817") ? true : (stryCov_9fa48("3817", "3818", "3819"), rec.state === (stryMutAct_9fa48("3820") ? "" : (stryCov_9fa48("3820"), 'failed')))) ? stryMutAct_9fa48("3821") ? "" : (stryCov_9fa48("3821"), 'failed') : stryMutAct_9fa48("3822") ? "" : (stryCov_9fa48("3822"), 'no_improvement'),
            fromLedger: stryMutAct_9fa48("3823") ? false : (stryCov_9fa48("3823"), true),
            attempts: stryMutAct_9fa48("3826") ? state.run.config.maxAttemptsPerFile && 3 : stryMutAct_9fa48("3825") ? false : stryMutAct_9fa48("3824") ? true : (stryCov_9fa48("3824", "3825", "3826"), state.run.config.maxAttemptsPerFile || 3),
            ...(stryMutAct_9fa48("3829") ? rec.metrics && {} : stryMutAct_9fa48("3828") ? false : stryMutAct_9fa48("3827") ? true : (stryCov_9fa48("3827", "3828", "3829"), rec.metrics || {}))
          }));
          stryMutAct_9fa48("3830") ? replayed -= 1 : (stryCov_9fa48("3830"), replayed += 1);
        }
      }
      if (stryMutAct_9fa48("3833") ? replayed && remeasured : stryMutAct_9fa48("3832") ? false : stryMutAct_9fa48("3831") ? true : (stryCov_9fa48("3831", "3832", "3833"), replayed || remeasured)) {
        if (stryMutAct_9fa48("3834")) {
          {}
        } else {
          stryCov_9fa48("3834");
          S.event(stryMutAct_9fa48("3835") ? "" : (stryCov_9fa48("3835"), 'installing'), (stryMutAct_9fa48("3836") ? `` : (stryCov_9fa48("3836"), `ledger: ${replayed} file(s) already settled in previous runs — skipping them; `)) + (stryMutAct_9fa48("3837") ? `` : (stryCov_9fa48("3837"), `${remeasured} file(s) restored earlier measurements`)));
        }
      }
      return stryMutAct_9fa48("3838") ? {} : (stryCov_9fa48("3838"), {
        ok: stryMutAct_9fa48("3839") ? false : (stryCov_9fa48("3839"), true),
        runner: det,
        scopeFiles: files.length,
        settledFromLedger: replayed,
        measurementsRestored: remeasured
      });
    }
  },
  'POST /api/coverage/run': async (q, body) => {
    if (stryMutAct_9fa48("3840")) {
      {}
    } else {
      stryCov_9fa48("3840");
      needRun();
      S.setStage(stryMutAct_9fa48("3843") ? body.stage && 'improving_coverage' : stryMutAct_9fa48("3842") ? false : stryMutAct_9fa48("3841") ? true : (stryCov_9fa48("3841", "3842", "3843"), body.stage || (stryMutAct_9fa48("3844") ? "" : (stryCov_9fa48("3844"), 'improving_coverage'))), stryMutAct_9fa48("3845") ? "" : (stryCov_9fa48("3845"), 'running test suite with coverage'));
      const r = await coverage.runCoverage();
      if (stryMutAct_9fa48("3848") ? body.phase !== 'baseline' : stryMutAct_9fa48("3847") ? false : stryMutAct_9fa48("3846") ? true : (stryCov_9fa48("3846", "3847", "3848"), body.phase === (stryMutAct_9fa48("3849") ? "" : (stryCov_9fa48("3849"), 'baseline')))) {
        if (stryMutAct_9fa48("3850")) {
          {}
        } else {
          stryCov_9fa48("3850");
          state.run.baseline.coveragePct = r.totalPct;
          // per-file mac recompute
          for (const f of Object.values(state.files)) f.mac = mac(f.coverage, f.mutation);
        }
      }
      state.run.result.coveragePct = r.totalPct;
      S.save();
      return stryMutAct_9fa48("3851") ? {} : (stryCov_9fa48("3851"), {
        ok: stryMutAct_9fa48("3852") ? false : (stryCov_9fa48("3852"), true),
        totalPct: r.totalPct,
        exitCode: r.exitCode
      });
    }
  },
  'GET /api/files/candidates': async () => {
    if (stryMutAct_9fa48("3853")) {
      {}
    } else {
      stryCov_9fa48("3853");
      needRun();
      S.setStage(stryMutAct_9fa48("3854") ? "" : (stryCov_9fa48("3854"), 'picking_file'), stryMutAct_9fa48("3855") ? "" : (stryCov_9fa48("3855"), 'evaluating candidate files'));
      return candidates();
    }
  },
  'POST /api/rules/apply': async (q, body) => {
    if (stryMutAct_9fa48("3856")) {
      {}
    } else {
      stryCov_9fa48("3856");
      needRun();
      const stage = body.stage;
      const stageNames = stryMutAct_9fa48("3857") ? {} : (stryCov_9fa48("3857"), {
        post_clone: stryMutAct_9fa48("3858") ? [] : (stryCov_9fa48("3858"), [stryMutAct_9fa48("3859") ? "" : (stryCov_9fa48("3859"), 'applying_rules'), stryMutAct_9fa48("3860") ? "" : (stryCov_9fa48("3860"), 'post-clone rules')]),
        pre_pick: stryMutAct_9fa48("3861") ? [] : (stryCov_9fa48("3861"), [stryMutAct_9fa48("3862") ? "" : (stryCov_9fa48("3862"), 'applying_rules'), stryMutAct_9fa48("3863") ? "" : (stryCov_9fa48("3863"), 'pre-pick rules')]),
        pick_file: stryMutAct_9fa48("3864") ? [] : (stryCov_9fa48("3864"), [stryMutAct_9fa48("3865") ? "" : (stryCov_9fa48("3865"), 'picking_file'), stryMutAct_9fa48("3866") ? "" : (stryCov_9fa48("3866"), 'picking a file to mutate')]),
        write_test: stryMutAct_9fa48("3867") ? [] : (stryCov_9fa48("3867"), [stryMutAct_9fa48("3868") ? "" : (stryCov_9fa48("3868"), 'improving_coverage'), stryMutAct_9fa48("3869") ? "" : (stryCov_9fa48("3869"), 'assembling test-writing constraints')]),
        check_changes: stryMutAct_9fa48("3870") ? [] : (stryCov_9fa48("3870"), [stryMutAct_9fa48("3871") ? "" : (stryCov_9fa48("3871"), 'improving_mac'), stryMutAct_9fa48("3872") ? "" : (stryCov_9fa48("3872"), 'checking whether changes are good')]),
        make_pr: stryMutAct_9fa48("3873") ? [] : (stryCov_9fa48("3873"), [stryMutAct_9fa48("3874") ? "" : (stryCov_9fa48("3874"), 'preparing_pr'), stryMutAct_9fa48("3875") ? "" : (stryCov_9fa48("3875"), 'composing PR per team rules')])
      });
      const [sn, sd] = stryMutAct_9fa48("3878") ? stageNames[stage] && ['applying_rules', stage] : stryMutAct_9fa48("3877") ? false : stryMutAct_9fa48("3876") ? true : (stryCov_9fa48("3876", "3877", "3878"), stageNames[stage] || (stryMutAct_9fa48("3879") ? [] : (stryCov_9fa48("3879"), [stryMutAct_9fa48("3880") ? "" : (stryCov_9fa48("3880"), 'applying_rules'), stage])));
      S.setStage(sn, sd);
      let context = stryMutAct_9fa48("3883") ? body.context && {} : stryMutAct_9fa48("3882") ? false : stryMutAct_9fa48("3881") ? true : (stryCov_9fa48("3881", "3882", "3883"), body.context || {});
      if (stryMutAct_9fa48("3886") ? stage === 'pick_file' || !context.candidates : stryMutAct_9fa48("3885") ? false : stryMutAct_9fa48("3884") ? true : (stryCov_9fa48("3884", "3885", "3886"), (stryMutAct_9fa48("3888") ? stage !== 'pick_file' : stryMutAct_9fa48("3887") ? true : (stryCov_9fa48("3887", "3888"), stage === (stryMutAct_9fa48("3889") ? "" : (stryCov_9fa48("3889"), 'pick_file')))) && (stryMutAct_9fa48("3890") ? context.candidates : (stryCov_9fa48("3890"), !context.candidates)))) context = stryMutAct_9fa48("3891") ? {} : (stryCov_9fa48("3891"), {
        candidates: candidates().candidates
      });
      const result = await rulesMod.apply(stage, context);
      return stryMutAct_9fa48("3892") ? {} : (stryCov_9fa48("3892"), {
        ok: stryMutAct_9fa48("3893") ? false : (stryCov_9fa48("3893"), true),
        stage,
        result
      });
    }
  },
  'POST /api/iteration/start': async (q, body) => {
    if (stryMutAct_9fa48("3894")) {
      {}
    } else {
      stryCov_9fa48("3894");
      needRun();
      const file = body.file;
      if (stryMutAct_9fa48("3897") ? !file && !state.files[file] : stryMutAct_9fa48("3896") ? false : stryMutAct_9fa48("3895") ? true : (stryCov_9fa48("3895", "3896", "3897"), (stryMutAct_9fa48("3898") ? file : (stryCov_9fa48("3898"), !file)) || (stryMutAct_9fa48("3899") ? state.files[file] : (stryCov_9fa48("3899"), !state.files[file])))) throw new Error((stryMutAct_9fa48("3900") ? "" : (stryCov_9fa48("3900"), 'unknown file: ')) + file);
      if (stryMutAct_9fa48("3903") ? state.run.iteration !== 0 : stryMutAct_9fa48("3902") ? false : stryMutAct_9fa48("3901") ? true : (stryCov_9fa48("3901", "3902", "3903"), state.run.iteration === 0)) {
        if (stryMutAct_9fa48("3904")) {
          {}
        } else {
          stryCov_9fa48("3904");
          // first pick of this batch: everything before it was setup overhead
          const slug = slugify(state.run.config.repoUrl);
          state.overheadLedger[slug] = stryMutAct_9fa48("3905") ? (state.overheadLedger[slug] || 0) - Math.max(0, Math.floor(Date.now() / 1000) - state.run.startedAt) : (stryCov_9fa48("3905"), (stryMutAct_9fa48("3908") ? state.overheadLedger[slug] && 0 : stryMutAct_9fa48("3907") ? false : stryMutAct_9fa48("3906") ? true : (stryCov_9fa48("3906", "3907", "3908"), state.overheadLedger[slug] || 0)) + (stryMutAct_9fa48("3909") ? Math.min(0, Math.floor(Date.now() / 1000) - state.run.startedAt) : (stryCov_9fa48("3909"), Math.max(0, stryMutAct_9fa48("3910") ? Math.floor(Date.now() / 1000) + state.run.startedAt : (stryCov_9fa48("3910"), Math.floor(stryMutAct_9fa48("3911") ? Date.now() * 1000 : (stryCov_9fa48("3911"), Date.now() / 1000)) - state.run.startedAt)))));
        }
      }
      // close any stopwatch left running by a previous, abandoned attempt
      for (const other of Object.values(state.files)) {
        if (stryMutAct_9fa48("3912")) {
          {}
        } else {
          stryCov_9fa48("3912");
          if (stryMutAct_9fa48("3915") ? other.attemptStartedAt || other.path !== file : stryMutAct_9fa48("3914") ? false : stryMutAct_9fa48("3913") ? true : (stryCov_9fa48("3913", "3914", "3915"), other.attemptStartedAt && (stryMutAct_9fa48("3917") ? other.path === file : stryMutAct_9fa48("3916") ? true : (stryCov_9fa48("3916", "3917"), other.path !== file)))) accrueSpent(other.path);
        }
      }
      stryMutAct_9fa48("3918") ? state.run.iteration -= 1 : (stryCov_9fa48("3918"), state.run.iteration += 1);
      const template = stryMutAct_9fa48("3921") ? state.decisions.pre_pick?.result?.branchTemplate && 'tests/improve-{file}' : stryMutAct_9fa48("3920") ? false : stryMutAct_9fa48("3919") ? true : (stryCov_9fa48("3919", "3920", "3921"), (stryMutAct_9fa48("3923") ? state.decisions.pre_pick.result?.branchTemplate : stryMutAct_9fa48("3922") ? state.decisions.pre_pick?.result.branchTemplate : (stryCov_9fa48("3922", "3923"), state.decisions.pre_pick?.result?.branchTemplate)) || (stryMutAct_9fa48("3924") ? "" : (stryCov_9fa48("3924"), 'tests/improve-{file}')));
      const branch = template.replace(stryMutAct_9fa48("3925") ? "" : (stryCov_9fa48("3925"), '{file}'), fileSlug(file));
      S.setStage(stryMutAct_9fa48("3926") ? "" : (stryCov_9fa48("3926"), 'picking_file'), stryMutAct_9fa48("3927") ? `` : (stryCov_9fa48("3927"), `iteration ${state.run.iteration}: picked ${file}`));
      await repo.createBranch(branch);
      S.upsertFile(file, stryMutAct_9fa48("3928") ? {} : (stryCov_9fa48("3928"), {
        status: stryMutAct_9fa48("3929") ? "" : (stryCov_9fa48("3929"), 'picked'),
        branch,
        attempts: stryMutAct_9fa48("3930") ? state.files[file].attempts - 1 : (stryCov_9fa48("3930"), state.files[file].attempts + 1),
        rounds: 0,
        roundBase: null,
        lastSurvived: null,
        mutantAttempts: {},
        mutantAttemptCount: 0,
        mutantFailures: 0,
        mutantsKilled: 0,
        mutantNoOutput: {},
        mutantGenFailures: 0,
        attemptStartedAt: Math.floor(stryMutAct_9fa48("3931") ? Date.now() * 1000 : (stryCov_9fa48("3931"), Date.now() / 1000))
      }));
      S.save();
      return stryMutAct_9fa48("3932") ? {} : (stryCov_9fa48("3932"), {
        ok: stryMutAct_9fa48("3933") ? false : (stryCov_9fa48("3933"), true),
        file,
        branch,
        iteration: state.run.iteration
      });
    }
  },
  'POST /api/stryker/run': async (q, body) => {
    if (stryMutAct_9fa48("3934")) {
      {}
    } else {
      stryCov_9fa48("3934");
      needRun();
      const file = body.file;
      if (stryMutAct_9fa48("3937") ? false : stryMutAct_9fa48("3936") ? true : stryMutAct_9fa48("3935") ? file : (stryCov_9fa48("3935", "3936", "3937"), !file)) throw new Error(stryMutAct_9fa48("3938") ? "" : (stryCov_9fa48("3938"), 'file required'));
      S.setStage(stryMutAct_9fa48("3941") ? body.stage && 'improving_mutation' : stryMutAct_9fa48("3940") ? false : stryMutAct_9fa48("3939") ? true : (stryCov_9fa48("3939", "3940", "3941"), body.stage || (stryMutAct_9fa48("3942") ? "" : (stryCov_9fa48("3942"), 'improving_mutation'))), stryMutAct_9fa48("3943") ? `` : (stryCov_9fa48("3943"), `mutation testing ${file}`));
      let r;
      try {
        if (stryMutAct_9fa48("3944")) {
          {}
        } else {
          stryCov_9fa48("3944");
          r = await stryker.runStryker(file);
        }
      } catch (e) {
        if (stryMutAct_9fa48("3945")) {
          {}
        } else {
          stryCov_9fa48("3945");
          if (stryMutAct_9fa48("3948") ? body.phase !== 'baseline' : stryMutAct_9fa48("3947") ? false : stryMutAct_9fa48("3946") ? true : (stryCov_9fa48("3946", "3947", "3948"), body.phase === (stryMutAct_9fa48("3949") ? "" : (stryCov_9fa48("3949"), 'baseline')))) {
            if (stryMutAct_9fa48("3950")) {
              {}
            } else {
              stryCov_9fa48("3950");
              // one broken file must not sink a full-repo run: record and move on
              S.event(stryMutAct_9fa48("3951") ? "" : (stryCov_9fa48("3951"), 'improving_mutation'), stryMutAct_9fa48("3952") ? `` : (stryCov_9fa48("3952"), `stryker failed on ${file} — marking file failed: ${stryMutAct_9fa48("3953") ? e.message : (stryCov_9fa48("3953"), e.message.slice(0, 250))}`));
              const spentSec = accrueSpent(file);
              const cov = stryMutAct_9fa48("3954") ? state.files[file]?.coverage && null : (stryCov_9fa48("3954"), (stryMutAct_9fa48("3955") ? state.files[file].coverage : (stryCov_9fa48("3955"), state.files[file]?.coverage)) ?? null);
              // Settling it in the ledger is PERMANENT — replayed in every later batch — so
              // one timeout or OOM would blacklist a file forever. Let it come back until
              // it has failed as often as any other file is allowed to be attempted.
              const crashes = stryMutAct_9fa48("3956") ? (measured()[file]?.baselineCrashes || 0) - 1 : (stryCov_9fa48("3956"), (stryMutAct_9fa48("3959") ? measured()[file]?.baselineCrashes && 0 : stryMutAct_9fa48("3958") ? false : stryMutAct_9fa48("3957") ? true : (stryCov_9fa48("3957", "3958", "3959"), (stryMutAct_9fa48("3960") ? measured()[file].baselineCrashes : (stryCov_9fa48("3960"), measured()[file]?.baselineCrashes)) || 0)) + 1);
              const settled = stryMutAct_9fa48("3964") ? crashes < (state.run.config.maxAttemptsPerFile || 3) : stryMutAct_9fa48("3963") ? crashes > (state.run.config.maxAttemptsPerFile || 3) : stryMutAct_9fa48("3962") ? false : stryMutAct_9fa48("3961") ? true : (stryCov_9fa48("3961", "3962", "3963", "3964"), crashes >= (stryMutAct_9fa48("3967") ? state.run.config.maxAttemptsPerFile && 3 : stryMutAct_9fa48("3966") ? false : stryMutAct_9fa48("3965") ? true : (stryCov_9fa48("3965", "3966", "3967"), state.run.config.maxAttemptsPerFile || 3)));
              S.upsertFile(file, stryMutAct_9fa48("3968") ? {} : (stryCov_9fa48("3968"), {
                status: stryMutAct_9fa48("3969") ? "" : (stryCov_9fa48("3969"), 'failed'),
                failedKind: stryMutAct_9fa48("3970") ? "" : (stryCov_9fa48("3970"), 'measurement'),
                coverageBefore: cov,
                failure: stryMutAct_9fa48("3971") ? e.message : (stryCov_9fa48("3971"), e.message.slice(0, 200))
              }));
              recordMeasurement(file, stryMutAct_9fa48("3972") ? {} : (stryCov_9fa48("3972"), {
                coverageBefore: cov,
                failure: stryMutAct_9fa48("3973") ? e.message : (stryCov_9fa48("3973"), e.message.slice(0, 200)),
                baselineCrashes: crashes
              }));
              if (stryMutAct_9fa48("3975") ? false : stryMutAct_9fa48("3974") ? true : (stryCov_9fa48("3974", "3975"), settled)) {
                if (stryMutAct_9fa48("3976")) {
                  {}
                } else {
                  stryCov_9fa48("3976");
                  ledger()[file] = stryMutAct_9fa48("3977") ? {} : (stryCov_9fa48("3977"), {
                    state: stryMutAct_9fa48("3978") ? "" : (stryCov_9fa48("3978"), 'failed'),
                    ts: Date.now(),
                    metrics: stryMutAct_9fa48("3979") ? {} : (stryCov_9fa48("3979"), {
                      spentSec,
                      tokens: stryMutAct_9fa48("3980") ? state.files[file].tokens : (stryCov_9fa48("3980"), state.files[file]?.tokens),
                      coverageBefore: cov,
                      failure: stryMutAct_9fa48("3981") ? e.message : (stryCov_9fa48("3981"), e.message.slice(0, 200))
                    })
                  });
                }
              }
              S.save();
              return stryMutAct_9fa48("3982") ? {} : (stryCov_9fa48("3982"), {
                ok: stryMutAct_9fa48("3983") ? true : (stryCov_9fa48("3983"), false),
                failed: stryMutAct_9fa48("3984") ? false : (stryCov_9fa48("3984"), true),
                score: 0,
                survived: stryMutAct_9fa48("3985") ? ["Stryker was here"] : (stryCov_9fa48("3985"), []),
                totalMutants: 0,
                error: stryMutAct_9fa48("3986") ? e.message : (stryCov_9fa48("3986"), e.message.slice(0, 500))
              });
            }
          }
          throw e;
        }
      }
      const f = stryMutAct_9fa48("3989") ? state.files[file] && S.upsertFile(file, {}) : stryMutAct_9fa48("3988") ? false : stryMutAct_9fa48("3987") ? true : (stryCov_9fa48("3987", "3988", "3989"), state.files[file] || S.upsertFile(file, {}));
      const fileMac = mac(f.coverage, r.score);
      S.upsertFile(file, stryMutAct_9fa48("3990") ? {} : (stryCov_9fa48("3990"), {
        mutation: r.score,
        mac: fileMac,
        totalMutants: r.totalMutants,
        survivedTotal: stryMutAct_9fa48("3991") ? r.survivedTotal && (r.survived || []).length : (stryCov_9fa48("3991"), r.survivedTotal ?? (stryMutAct_9fa48("3994") ? r.survived && [] : stryMutAct_9fa48("3993") ? false : stryMutAct_9fa48("3992") ? true : (stryCov_9fa48("3992", "3993", "3994"), r.survived || (stryMutAct_9fa48("3995") ? ["Stryker was here"] : (stryCov_9fa48("3995"), [])))).length),
        lastSurvived: stryMutAct_9fa48("3996") ? r.survived || [] : (stryCov_9fa48("3996"), (stryMutAct_9fa48("3999") ? r.survived && [] : stryMutAct_9fa48("3998") ? false : stryMutAct_9fa48("3997") ? true : (stryCov_9fa48("3997", "3998", "3999"), r.survived || (stryMutAct_9fa48("4000") ? ["Stryker was here"] : (stryCov_9fa48("4000"), [])))).slice(0, 100))
      }));
      // state.json keeps the first hundred for the dashboard; the QUEUE keeps all of
      // them, on disk, with what has already been tried at each site.
      mutantStore.replace(file, stryMutAct_9fa48("4003") ? (r.survivedAll || r.survived) && [] : stryMutAct_9fa48("4002") ? false : stryMutAct_9fa48("4001") ? true : (stryCov_9fa48("4001", "4002", "4003"), (stryMutAct_9fa48("4005") ? r.survivedAll && r.survived : stryMutAct_9fa48("4004") ? false : (stryCov_9fa48("4004", "4005"), r.survivedAll || r.survived)) || (stryMutAct_9fa48("4006") ? ["Stryker was here"] : (stryCov_9fa48("4006"), []))));
      if (stryMutAct_9fa48("4009") ? body.phase !== 'baseline' : stryMutAct_9fa48("4008") ? false : stryMutAct_9fa48("4007") ? true : (stryCov_9fa48("4007", "4008", "4009"), body.phase === (stryMutAct_9fa48("4010") ? "" : (stryCov_9fa48("4010"), 'baseline')))) {
        if (stryMutAct_9fa48("4011")) {
          {}
        } else {
          stryCov_9fa48("4011");
          S.upsertFile(file, stryMutAct_9fa48("4012") ? {} : (stryCov_9fa48("4012"), {
            macBefore: fileMac,
            coverageBefore: f.coverage,
            mutationBefore: r.score
          }));
          // survives batches even if this file is never improved
          recordMeasurement(file, stryMutAct_9fa48("4013") ? {} : (stryCov_9fa48("4013"), {
            coverageBefore: f.coverage,
            mutationBefore: r.score,
            macBefore: fileMac
          }));
          if (stryMutAct_9fa48("4016") ? state.run.baseline.mutationPct != null : stryMutAct_9fa48("4015") ? false : stryMutAct_9fa48("4014") ? true : (stryCov_9fa48("4014", "4015", "4016"), state.run.baseline.mutationPct == null)) state.run.baseline.mutationPct = r.score;
          state.run.baseline.mac = mac(state.run.baseline.coveragePct, state.run.baseline.mutationPct);
          S.save();
        }
      }
      // survivedAll is an internal identity list — keep it out of n8n execution data
      const {
        survivedAll,
        ...payload
      } = r;
      return stryMutAct_9fa48("4017") ? {} : (stryCov_9fa48("4017"), {
        ok: stryMutAct_9fa48("4018") ? false : (stryCov_9fa48("4018"), true),
        ...payload
      });
    }
  },
  'GET /api/files/gaps': async q => {
    if (stryMutAct_9fa48("4019")) {
      {}
    } else {
      stryCov_9fa48("4019");
      needRun();
      const p = q.get(stryMutAct_9fa48("4020") ? "" : (stryCov_9fa48("4020"), 'path'));
      if (stryMutAct_9fa48("4023") ? false : stryMutAct_9fa48("4022") ? true : stryMutAct_9fa48("4021") ? p : (stryCov_9fa48("4021", "4022", "4023"), !p)) throw new Error(stryMutAct_9fa48("4024") ? "" : (stryCov_9fa48("4024"), 'path required'));
      S.setStage(stryMutAct_9fa48("4025") ? "" : (stryCov_9fa48("4025"), 'improving_coverage'), stryMutAct_9fa48("4026") ? `` : (stryCov_9fa48("4026"), `analysing coverage gaps in ${p}`));
      const source = repo.readFileSafe(p, 24000);
      const guess = repo.guessTestPath(p);
      let existingTest = guess.exists ? repo.readFileSafe(guess.path, 12000) : null;
      if (stryMutAct_9fa48("4029") ? false : stryMutAct_9fa48("4028") ? true : stryMutAct_9fa48("4027") ? existingTest : (stryCov_9fa48("4027", "4028", "4029"), !existingTest)) {
        if (stryMutAct_9fa48("4030")) {
          {}
        } else {
          stryCov_9fa48("4030");
          // no test for this file yet → hand the LLM a sibling test to imitate
          // (import aliases, setup files, naming conventions)
          const ref = repo.findStyleReference(p);
          if (stryMutAct_9fa48("4032") ? false : stryMutAct_9fa48("4031") ? true : (stryCov_9fa48("4031", "4032"), ref)) existingTest = stryMutAct_9fa48("4033") ? `` : (stryCov_9fa48("4033"), `// STYLE REFERENCE — an existing test from this repo (${ref.path}).\n// Imitate its imports, aliases and conventions. Do not modify it.\n${ref.content}`);
        }
      }
      return stryMutAct_9fa48("4034") ? {} : (stryCov_9fa48("4034"), {
        ok: stryMutAct_9fa48("4035") ? false : (stryCov_9fa48("4035"), true),
        path: p,
        source,
        sourceLines: source ? source.split(stryMutAct_9fa48("4036") ? "" : (stryCov_9fa48("4036"), '\n')).length : 0,
        uncovered: coverage.uncoveredLines(p),
        rounds: stryMutAct_9fa48("4039") ? state.files[p]?.rounds && 0 : stryMutAct_9fa48("4038") ? false : stryMutAct_9fa48("4037") ? true : (stryCov_9fa48("4037", "4038", "4039"), (stryMutAct_9fa48("4040") ? state.files[p].rounds : (stryCov_9fa48("4040"), state.files[p]?.rounds)) || 0),
        survived: stryMutAct_9fa48("4043") ? state.files[p]?.lastSurvived && [] : stryMutAct_9fa48("4042") ? false : stryMutAct_9fa48("4041") ? true : (stryCov_9fa48("4041", "4042", "4043"), (stryMutAct_9fa48("4044") ? state.files[p].lastSurvived : (stryCov_9fa48("4044"), state.files[p]?.lastSurvived)) || (stryMutAct_9fa48("4045") ? ["Stryker was here"] : (stryCov_9fa48("4045"), []))),
        // the coverage phase is only a BOOTSTRAP: it exists to get a file executed at
        // all, because mutation testing has nothing to work with otherwise. Once any
        // coverage exists, killing mutants raises coverage as a side effect.
        needsBootstrap: stryMutAct_9fa48("4048") ? (state.files[p]?.coverage ?? 0) <= 0 && coverage.uncoveredLines(p).lines === 'all' : stryMutAct_9fa48("4047") ? false : stryMutAct_9fa48("4046") ? true : (stryCov_9fa48("4046", "4047", "4048"), (stryMutAct_9fa48("4051") ? (state.files[p]?.coverage ?? 0) > 0 : stryMutAct_9fa48("4050") ? (state.files[p]?.coverage ?? 0) < 0 : stryMutAct_9fa48("4049") ? false : (stryCov_9fa48("4049", "4050", "4051"), (stryMutAct_9fa48("4052") ? state.files[p]?.coverage && 0 : (stryCov_9fa48("4052"), (stryMutAct_9fa48("4053") ? state.files[p].coverage : (stryCov_9fa48("4053"), state.files[p]?.coverage)) ?? 0)) <= 0)) || (stryMutAct_9fa48("4055") ? coverage.uncoveredLines(p).lines !== 'all' : stryMutAct_9fa48("4054") ? false : (stryCov_9fa48("4054", "4055"), coverage.uncoveredLines(p).lines === (stryMutAct_9fa48("4056") ? "" : (stryCov_9fa48("4056"), 'all'))))),
        ui: repo.detectUi(),
        testPath: guess.path,
        testExists: guess.exists,
        existingTest,
        runner: stryMutAct_9fa48("4057") ? state.runner.testRunner : (stryCov_9fa48("4057"), state.runner?.testRunner),
        constraints: rulesMod.testWritingConstraints(),
        packageJson: (stryMutAct_9fa48("4060") ? repo.readPkg().name && '' : stryMutAct_9fa48("4059") ? false : stryMutAct_9fa48("4058") ? true : (stryCov_9fa48("4058", "4059", "4060"), repo.readPkg().name || (stryMutAct_9fa48("4061") ? "Stryker was here!" : (stryCov_9fa48("4061"), '')))) + (stryMutAct_9fa48("4062") ? "" : (stryCov_9fa48("4062"), ' (type=')) + (stryMutAct_9fa48("4065") ? repo.readPkg().type && 'commonjs' : stryMutAct_9fa48("4064") ? false : stryMutAct_9fa48("4063") ? true : (stryCov_9fa48("4063", "4064", "4065"), repo.readPkg().type || (stryMutAct_9fa48("4066") ? "" : (stryCov_9fa48("4066"), 'commonjs')))) + (stryMutAct_9fa48("4067") ? "" : (stryCov_9fa48("4067"), ')'))
      });
    }
  },
  'POST /api/test/write': async (q, body) => {
    if (stryMutAct_9fa48("4068")) {
      {}
    } else {
      stryCov_9fa48("4068");
      needRun();
      try {
        if (stryMutAct_9fa48("4069")) {
          {}
        } else {
          stryCov_9fa48("4069");
          const r = repo.writeTestFile(body.path, String(stryMutAct_9fa48("4072") ? body.content && '' : stryMutAct_9fa48("4071") ? false : stryMutAct_9fa48("4070") ? true : (stryCov_9fa48("4070", "4071", "4072"), body.content || (stryMutAct_9fa48("4073") ? "Stryker was here!" : (stryCov_9fa48("4073"), '')))));
          S.event(stryMutAct_9fa48("4074") ? "" : (stryCov_9fa48("4074"), 'improving_coverage'), (stryMutAct_9fa48("4075") ? "" : (stryCov_9fa48("4075"), 'wrote ')) + r.path + (stryMutAct_9fa48("4076") ? "" : (stryCov_9fa48("4076"), ' (')) + r.bytes + (stryMutAct_9fa48("4077") ? "" : (stryCov_9fa48("4077"), ' bytes)')));
          return stryMutAct_9fa48("4078") ? {} : (stryCov_9fa48("4078"), {
            ok: stryMutAct_9fa48("4079") ? false : (stryCov_9fa48("4079"), true),
            ...r
          });
        }
      } catch (e) {
        if (stryMutAct_9fa48("4080")) {
          {}
        } else {
          stryCov_9fa48("4080");
          return stryMutAct_9fa48("4081") ? {} : (stryCov_9fa48("4081"), {
            ok: stryMutAct_9fa48("4082") ? true : (stryCov_9fa48("4082"), false),
            error: e.message
          });
        }
      }
    }
  },
  'POST /api/test/delete': async (q, body) => {
    if (stryMutAct_9fa48("4083")) {
      {}
    } else {
      stryCov_9fa48("4083");
      needRun();
      return stryMutAct_9fa48("4084") ? {} : (stryCov_9fa48("4084"), {
        ok: repo.deleteTestFile(body.path)
      });
    }
  },
  'POST /api/test/write-many': async (q, body) => {
    if (stryMutAct_9fa48("4085")) {
      {}
    } else {
      stryCov_9fa48("4085");
      needRun();
      if (stryMutAct_9fa48("4087") ? false : stryMutAct_9fa48("4086") ? true : (stryCov_9fa48("4086", "4087"), body.stage)) S.setStage(body.stage, stryMutAct_9fa48("4088") ? "" : (stryCov_9fa48("4088"), 'writing generated tests'));
      const written = stryMutAct_9fa48("4089") ? ["Stryker was here"] : (stryCov_9fa48("4089"), []),
        errors = stryMutAct_9fa48("4090") ? ["Stryker was here"] : (stryCov_9fa48("4090"), []);
      for (const t of stryMutAct_9fa48("4091") ? body.tests || [] : (stryCov_9fa48("4091"), (stryMutAct_9fa48("4094") ? body.tests && [] : stryMutAct_9fa48("4093") ? false : stryMutAct_9fa48("4092") ? true : (stryCov_9fa48("4092", "4093", "4094"), body.tests || (stryMutAct_9fa48("4095") ? ["Stryker was here"] : (stryCov_9fa48("4095"), [])))).slice(0, 5))) {
        if (stryMutAct_9fa48("4096")) {
          {}
        } else {
          stryCov_9fa48("4096");
          try {
            if (stryMutAct_9fa48("4097")) {
              {}
            } else {
              stryCov_9fa48("4097");
              const r = repo.writeTestFile(t.path, String(stryMutAct_9fa48("4100") ? t.content && '' : stryMutAct_9fa48("4099") ? false : stryMutAct_9fa48("4098") ? true : (stryCov_9fa48("4098", "4099", "4100"), t.content || (stryMutAct_9fa48("4101") ? "Stryker was here!" : (stryCov_9fa48("4101"), '')))));
              written.push(r.path);
              S.event(stryMutAct_9fa48("4104") ? body.stage && 'improving_coverage' : stryMutAct_9fa48("4103") ? false : stryMutAct_9fa48("4102") ? true : (stryCov_9fa48("4102", "4103", "4104"), body.stage || (stryMutAct_9fa48("4105") ? "" : (stryCov_9fa48("4105"), 'improving_coverage'))), (stryMutAct_9fa48("4106") ? "" : (stryCov_9fa48("4106"), 'wrote ')) + r.path + (stryMutAct_9fa48("4107") ? "" : (stryCov_9fa48("4107"), ' (')) + r.bytes + (stryMutAct_9fa48("4108") ? "" : (stryCov_9fa48("4108"), ' bytes)')));
            }
          } catch (e) {
            if (stryMutAct_9fa48("4109")) {
              {}
            } else {
              stryCov_9fa48("4109");
              errors.push(stryMutAct_9fa48("4110") ? {} : (stryCov_9fa48("4110"), {
                path: t.path,
                error: e.message
              }));
            }
          }
        }
      }
      // Bootstrap tests change what mutation testing can see. The survivor list the
      // mutant loop is about to read came from the BASELINE run, when the file had no
      // tests at all — on a 0-coverage file that list is empty, and the loop would
      // conclude "nothing to kill" on a file that just became fully mutable.
      const cur = pickedFile();
      if (stryMutAct_9fa48("4113") ? written.length && cur || body.stage === 'improving_coverage' : stryMutAct_9fa48("4112") ? false : stryMutAct_9fa48("4111") ? true : (stryCov_9fa48("4111", "4112", "4113"), (stryMutAct_9fa48("4115") ? written.length || cur : stryMutAct_9fa48("4114") ? true : (stryCov_9fa48("4114", "4115"), written.length && cur)) && (stryMutAct_9fa48("4117") ? body.stage !== 'improving_coverage' : stryMutAct_9fa48("4116") ? true : (stryCov_9fa48("4116", "4117"), body.stage === (stryMutAct_9fa48("4118") ? "" : (stryCov_9fa48("4118"), 'improving_coverage')))))) {
        if (stryMutAct_9fa48("4119")) {
          {}
        } else {
          stryCov_9fa48("4119");
          S.upsertFile(cur, stryMutAct_9fa48("4120") ? {} : (stryCov_9fa48("4120"), {
            survivorsStale: stryMutAct_9fa48("4121") ? false : (stryCov_9fa48("4121"), true)
          }));
        }
      }
      return stryMutAct_9fa48("4122") ? {} : (stryCov_9fa48("4122"), {
        ok: stryMutAct_9fa48("4123") ? false : (stryCov_9fa48("4123"), true),
        written,
        errors
      });
    }
  },
  'POST /api/test/delete-many': async (q, body) => {
    if (stryMutAct_9fa48("4124")) {
      {}
    } else {
      stryCov_9fa48("4124");
      needRun();
      const deleted = stryMutAct_9fa48("4125") ? ["Stryker was here"] : (stryCov_9fa48("4125"), []);
      for (const p of stryMutAct_9fa48("4126") ? [] : (stryCov_9fa48("4126"), [...new Set(stryMutAct_9fa48("4129") ? body.paths && [] : stryMutAct_9fa48("4128") ? false : stryMutAct_9fa48("4127") ? true : (stryCov_9fa48("4127", "4128", "4129"), body.paths || (stryMutAct_9fa48("4130") ? ["Stryker was here"] : (stryCov_9fa48("4130"), []))))])) {
        if (stryMutAct_9fa48("4131")) {
          {}
        } else {
          stryCov_9fa48("4131");
          if (stryMutAct_9fa48("4133") ? false : stryMutAct_9fa48("4132") ? true : (stryCov_9fa48("4132", "4133"), repo.deleteTestFile(p))) deleted.push(p);
        }
      }
      S.event(stryMutAct_9fa48("4136") ? body.stage && 'improving_coverage' : stryMutAct_9fa48("4135") ? false : stryMutAct_9fa48("4134") ? true : (stryCov_9fa48("4134", "4135", "4136"), body.stage || (stryMutAct_9fa48("4137") ? "" : (stryCov_9fa48("4137"), 'improving_coverage'))), (stryMutAct_9fa48("4138") ? "" : (stryCov_9fa48("4138"), 'deleted generated tests that broke the suite: ')) + deleted.join(stryMutAct_9fa48("4139") ? "" : (stryCov_9fa48("4139"), ', ')));
      return stryMutAct_9fa48("4140") ? {} : (stryCov_9fa48("4140"), {
        ok: stryMutAct_9fa48("4141") ? false : (stryCov_9fa48("4141"), true),
        deleted
      });
    }
  },
  'POST /api/test/run': async (q, body) => {
    if (stryMutAct_9fa48("4142")) {
      {}
    } else {
      stryCov_9fa48("4142");
      needRun();
      if (stryMutAct_9fa48("4144") ? false : stryMutAct_9fa48("4143") ? true : (stryCov_9fa48("4143", "4144"), body.stage)) S.setStage(body.stage, (stryMutAct_9fa48("4145") ? "" : (stryCov_9fa48("4145"), 'running tests ')) + (stryMutAct_9fa48("4148") ? body.path && '(full suite)' : stryMutAct_9fa48("4147") ? false : stryMutAct_9fa48("4146") ? true : (stryCov_9fa48("4146", "4147", "4148"), body.path || (stryMutAct_9fa48("4149") ? "" : (stryCov_9fa48("4149"), '(full suite)')))));
      try {
        if (stryMutAct_9fa48("4150")) {
          {}
        } else {
          stryCov_9fa48("4150");
          const r = await tests.runTests(stryMutAct_9fa48("4153") ? body.path && null : stryMutAct_9fa48("4152") ? false : stryMutAct_9fa48("4151") ? true : (stryCov_9fa48("4151", "4152", "4153"), body.path || null));
          return stryMutAct_9fa48("4154") ? {} : (stryCov_9fa48("4154"), {
            ok: stryMutAct_9fa48("4155") ? false : (stryCov_9fa48("4155"), true),
            ...r
          });
        }
      } catch (e) {
        if (stryMutAct_9fa48("4156")) {
          {}
        } else {
          stryCov_9fa48("4156");
          return stryMutAct_9fa48("4157") ? {} : (stryCov_9fa48("4157"), {
            ok: stryMutAct_9fa48("4158") ? true : (stryCov_9fa48("4158"), false),
            passed: stryMutAct_9fa48("4159") ? true : (stryCov_9fa48("4159"), false),
            error: e.message
          });
        }
      }
    }
  },
  'POST /api/llm/chat': async (q, body) => {
    if (stryMutAct_9fa48("4160")) {
      {}
    } else {
      stryCov_9fa48("4160");
      if (stryMutAct_9fa48("4162") ? false : stryMutAct_9fa48("4161") ? true : (stryCov_9fa48("4161", "4162"), body.stage)) S.setStage(body.stage, stryMutAct_9fa48("4165") ? body.stageDetail && 'consulting LLM' : stryMutAct_9fa48("4164") ? false : stryMutAct_9fa48("4163") ? true : (stryCov_9fa48("4163", "4164", "4165"), body.stageDetail || (stryMutAct_9fa48("4166") ? "" : (stryCov_9fa48("4166"), 'consulting LLM'))));
      try {
        if (stryMutAct_9fa48("4167")) {
          {}
        } else {
          stryCov_9fa48("4167");
          const r = await llm.chat(stryMutAct_9fa48("4168") ? {} : (stryCov_9fa48("4168"), {
            system: body.system,
            prompt: body.prompt,
            messages: body.messages,
            maxTokens: clamp(parseInt(stryMutAct_9fa48("4171") ? body.maxTokens && '4096' : stryMutAct_9fa48("4170") ? false : stryMutAct_9fa48("4169") ? true : (stryCov_9fa48("4169", "4170", "4171"), body.maxTokens || (stryMutAct_9fa48("4172") ? "" : (stryCov_9fa48("4172"), '4096'))), 10), 64, 12000),
            temperature: body.temperature,
            json: stryMutAct_9fa48("4173") ? !body.json : (stryCov_9fa48("4173"), !(stryMutAct_9fa48("4174") ? body.json : (stryCov_9fa48("4174"), !body.json))),
            decision: stryMutAct_9fa48("4175") ? !body.decision : (stryCov_9fa48("4175"), !(stryMutAct_9fa48("4176") ? body.decision : (stryCov_9fa48("4176"), !body.decision))),
            // explicit override from the workflow: kill attempts ask for no reasoning
            thinking: body.thinking
          }));
          return stryMutAct_9fa48("4177") ? {} : (stryCov_9fa48("4177"), {
            ok: stryMutAct_9fa48("4178") ? false : (stryCov_9fa48("4178"), true),
            text: r.text,
            json: stryMutAct_9fa48("4179") ? r.json && null : (stryCov_9fa48("4179"), r.json ?? null)
          });
        }
      } catch (e) {
        if (stryMutAct_9fa48("4180")) {
          {}
        } else {
          stryCov_9fa48("4180");
          S.event(stryMutAct_9fa48("4181") ? "" : (stryCov_9fa48("4181"), 'llm'), (stryMutAct_9fa48("4182") ? "" : (stryCov_9fa48("4182"), 'LLM error: ')) + e.message);
          return stryMutAct_9fa48("4183") ? {} : (stryCov_9fa48("4183"), {
            ok: stryMutAct_9fa48("4184") ? true : (stryCov_9fa48("4184"), false),
            error: e.message
          });
        }
      }
    }
  },
  'POST /api/test/cleanup': async (q, body) => {
    if (stryMutAct_9fa48("4185")) {
      {}
    } else {
      stryCov_9fa48("4185");
      needRun();
      const file = body.file;
      const f = stryMutAct_9fa48("4188") ? state.files[file] && {} : stryMutAct_9fa48("4187") ? false : stryMutAct_9fa48("4186") ? true : (stryCov_9fa48("4186", "4187", "4188"), state.files[file] || {});
      S.setStage(stryMutAct_9fa48("4189") ? "" : (stryCov_9fa48("4189"), 'preparing_pr'), stryMutAct_9fa48("4190") ? `` : (stryCov_9fa48("4190"), `cleaning up generated tests for ${file}`));
      // Accepted rounds are already COMMITTED, so the working tree is usually clean
      // here — select against the base branch, not `git status`.
      const changed = await pr.changedTestFiles();
      if (stryMutAct_9fa48("4193") ? false : stryMutAct_9fa48("4192") ? true : stryMutAct_9fa48("4191") ? changed.length : (stryCov_9fa48("4191", "4192", "4193"), !changed.length)) S.event(stryMutAct_9fa48("4194") ? "" : (stryCov_9fa48("4194"), 'preparing_pr'), stryMutAct_9fa48("4195") ? `` : (stryCov_9fa48("4195"), `cleanup: no generated test files found for ${file}`));
      const results = stryMutAct_9fa48("4196") ? ["Stryker was here"] : (stryCov_9fa48("4196"), []);
      for (const p of stryMutAct_9fa48("4197") ? changed : (stryCov_9fa48("4197"), changed.slice(0, 5))) {
        if (stryMutAct_9fa48("4198")) {
          {}
        } else {
          stryCov_9fa48("4198");
          const original = repo.readFileSafe(p, 100000);
          if (stryMutAct_9fa48("4201") ? false : stryMutAct_9fa48("4200") ? true : stryMutAct_9fa48("4199") ? original : (stryCov_9fa48("4199", "4200", "4201"), !original)) continue;
          try {
            if (stryMutAct_9fa48("4202")) {
              {}
            } else {
              stryCov_9fa48("4202");
              const r = await llm.chat(stryMutAct_9fa48("4203") ? {} : (stryCov_9fa48("4203"), {
                system: stryMutAct_9fa48("4204") ? "" : (stryCov_9fa48("4204"), 'You are a strict test-code editor. Clean this generated test file: (1) REMOVE all scratch/chain-of-thought comments — anything reasoning aloud ("Wait", "Let\'s try", exploratory strategy essays, self-corrections). Keep at most ONE short comment per test stating which mutant/behavior it verifies. (2) REMOVE tests that are vacuous (cannot fail, assert nothing meaningful, or admit in comments they kill nothing). (3) Do NOT change, weaken, or reorder any remaining test logic, imports, or setup. Reply with ONLY the complete cleaned file content — no markdown fences, no explanation.'),
                prompt: original,
                maxTokens: 9000,
                temperature: 0.1
              }));
              const cleaned = (stryMutAct_9fa48("4205") ? (r.text || '').replace(/^[\s\S]*?<\/think>/, '').replace(/^```[a-z]*\s*\n?/m, '').replace(/```\s*$/m, '') : (stryCov_9fa48("4205"), (stryMutAct_9fa48("4208") ? r.text && '' : stryMutAct_9fa48("4207") ? false : stryMutAct_9fa48("4206") ? true : (stryCov_9fa48("4206", "4207", "4208"), r.text || (stryMutAct_9fa48("4209") ? "Stryker was here!" : (stryCov_9fa48("4209"), '')))).replace(stryMutAct_9fa48("4214") ? /^[\s\s]*?<\/think>/ : stryMutAct_9fa48("4213") ? /^[\S\S]*?<\/think>/ : stryMutAct_9fa48("4212") ? /^[^\s\S]*?<\/think>/ : stryMutAct_9fa48("4211") ? /^[\s\S]<\/think>/ : stryMutAct_9fa48("4210") ? /[\s\S]*?<\/think>/ : (stryCov_9fa48("4210", "4211", "4212", "4213", "4214"), /^[\s\S]*?<\/think>/), stryMutAct_9fa48("4215") ? "Stryker was here!" : (stryCov_9fa48("4215"), '')).replace(stryMutAct_9fa48("4221") ? /^```[a-z]*\s*\n/m : stryMutAct_9fa48("4220") ? /^```[a-z]*\S*\n?/m : stryMutAct_9fa48("4219") ? /^```[a-z]*\s\n?/m : stryMutAct_9fa48("4218") ? /^```[^a-z]*\s*\n?/m : stryMutAct_9fa48("4217") ? /^```[a-z]\s*\n?/m : stryMutAct_9fa48("4216") ? /```[a-z]*\s*\n?/m : (stryCov_9fa48("4216", "4217", "4218", "4219", "4220", "4221"), /^```[a-z]*\s*\n?/m), stryMutAct_9fa48("4222") ? "Stryker was here!" : (stryCov_9fa48("4222"), '')).replace(stryMutAct_9fa48("4225") ? /```\S*$/m : stryMutAct_9fa48("4224") ? /```\s$/m : stryMutAct_9fa48("4223") ? /```\s*/m : (stryCov_9fa48("4223", "4224", "4225"), /```\s*$/m), stryMutAct_9fa48("4226") ? "Stryker was here!" : (stryCov_9fa48("4226"), '')).trim())) + (stryMutAct_9fa48("4227") ? "" : (stryCov_9fa48("4227"), '\n'));
              const plausible = stryMutAct_9fa48("4230") ? cleaned.length > 200 && /\b(it|test|describe)\s*\(/.test(cleaned) && cleaned.length >= original.length * 0.2 || cleaned.length <= original.length * 1.2 : stryMutAct_9fa48("4229") ? false : stryMutAct_9fa48("4228") ? true : (stryCov_9fa48("4228", "4229", "4230"), (stryMutAct_9fa48("4232") ? cleaned.length > 200 && /\b(it|test|describe)\s*\(/.test(cleaned) || cleaned.length >= original.length * 0.2 : stryMutAct_9fa48("4231") ? true : (stryCov_9fa48("4231", "4232"), (stryMutAct_9fa48("4234") ? cleaned.length > 200 || /\b(it|test|describe)\s*\(/.test(cleaned) : stryMutAct_9fa48("4233") ? true : (stryCov_9fa48("4233", "4234"), (stryMutAct_9fa48("4237") ? cleaned.length <= 200 : stryMutAct_9fa48("4236") ? cleaned.length >= 200 : stryMutAct_9fa48("4235") ? true : (stryCov_9fa48("4235", "4236", "4237"), cleaned.length > 200)) && (stryMutAct_9fa48("4239") ? /\b(it|test|describe)\S*\(/ : stryMutAct_9fa48("4238") ? /\b(it|test|describe)\s\(/ : (stryCov_9fa48("4238", "4239"), /\b(it|test|describe)\s*\(/)).test(cleaned))) && (stryMutAct_9fa48("4242") ? cleaned.length < original.length * 0.2 : stryMutAct_9fa48("4241") ? cleaned.length > original.length * 0.2 : stryMutAct_9fa48("4240") ? true : (stryCov_9fa48("4240", "4241", "4242"), cleaned.length >= (stryMutAct_9fa48("4243") ? original.length / 0.2 : (stryCov_9fa48("4243"), original.length * 0.2)))))) && (stryMutAct_9fa48("4246") ? cleaned.length > original.length * 1.2 : stryMutAct_9fa48("4245") ? cleaned.length < original.length * 1.2 : stryMutAct_9fa48("4244") ? true : (stryCov_9fa48("4244", "4245", "4246"), cleaned.length <= (stryMutAct_9fa48("4247") ? original.length / 1.2 : (stryCov_9fa48("4247"), original.length * 1.2)))));
              if (stryMutAct_9fa48("4250") ? !plausible && cleaned === original : stryMutAct_9fa48("4249") ? false : stryMutAct_9fa48("4248") ? true : (stryCov_9fa48("4248", "4249", "4250"), (stryMutAct_9fa48("4251") ? plausible : (stryCov_9fa48("4251"), !plausible)) || (stryMutAct_9fa48("4253") ? cleaned !== original : stryMutAct_9fa48("4252") ? false : (stryCov_9fa48("4252", "4253"), cleaned === original)))) {
                if (stryMutAct_9fa48("4254")) {
                  {}
                } else {
                  stryCov_9fa48("4254");
                  results.push(stryMutAct_9fa48("4255") ? {} : (stryCov_9fa48("4255"), {
                    path: p,
                    kept: stryMutAct_9fa48("4256") ? "" : (stryCov_9fa48("4256"), 'original'),
                    reason: (stryMutAct_9fa48("4257") ? plausible : (stryCov_9fa48("4257"), !plausible)) ? stryMutAct_9fa48("4258") ? "" : (stryCov_9fa48("4258"), 'implausible cleanup output') : stryMutAct_9fa48("4259") ? "" : (stryCov_9fa48("4259"), 'no changes')
                  }));
                  continue;
                }
              }
              repo.writeTestFile(p, cleaned);
              results.push(stryMutAct_9fa48("4260") ? {} : (stryCov_9fa48("4260"), {
                path: p,
                kept: stryMutAct_9fa48("4261") ? "" : (stryCov_9fa48("4261"), 'cleaned'),
                bytesBefore: original.length,
                bytesAfter: cleaned.length,
                _original: original
              }));
            }
          } catch (e) {
            if (stryMutAct_9fa48("4262")) {
              {}
            } else {
              stryCov_9fa48("4262");
              results.push(stryMutAct_9fa48("4263") ? {} : (stryCov_9fa48("4263"), {
                path: p,
                kept: stryMutAct_9fa48("4264") ? "" : (stryCov_9fa48("4264"), 'original'),
                reason: stryMutAct_9fa48("4265") ? e.message : (stryCov_9fa48("4265"), e.message.slice(0, 200))
              }));
            }
          }
        }
      }
      const touched = stryMutAct_9fa48("4266") ? results : (stryCov_9fa48("4266"), results.filter(stryMutAct_9fa48("4267") ? () => undefined : (stryCov_9fa48("4267"), r => stryMutAct_9fa48("4270") ? r.kept !== 'cleaned' : stryMutAct_9fa48("4269") ? false : stryMutAct_9fa48("4268") ? true : (stryCov_9fa48("4268", "4269", "4270"), r.kept === (stryMutAct_9fa48("4271") ? "" : (stryCov_9fa48("4271"), 'cleaned'))))));
      const publicResults = results.map(stryMutAct_9fa48("4272") ? () => undefined : (stryCov_9fa48("4272"), ({
        _original,
        ...r
      }) => r));
      if (stryMutAct_9fa48("4275") ? false : stryMutAct_9fa48("4274") ? true : stryMutAct_9fa48("4273") ? touched.length : (stryCov_9fa48("4273", "4274", "4275"), !touched.length)) {
        if (stryMutAct_9fa48("4276")) {
          {}
        } else {
          stryCov_9fa48("4276");
          const mergedOnly = await consolidate(file, stryMutAct_9fa48("4277") ? (f.coverageAfter ?? f.coverage) && 0 : (stryCov_9fa48("4277"), (stryMutAct_9fa48("4278") ? f.coverageAfter && f.coverage : (stryCov_9fa48("4278"), f.coverageAfter ?? f.coverage)) ?? 0), stryMutAct_9fa48("4279") ? (f.mutationAfter ?? f.mutation) && 0 : (stryCov_9fa48("4279"), (stryMutAct_9fa48("4280") ? f.mutationAfter && f.mutation : (stryCov_9fa48("4280"), f.mutationAfter ?? f.mutation)) ?? 0));
          return stryMutAct_9fa48("4281") ? {} : (stryCov_9fa48("4281"), {
            ok: stryMutAct_9fa48("4282") ? false : (stryCov_9fa48("4282"), true),
            cleaned: 0,
            merged: mergedOnly,
            results: publicResults
          });
        }
      }
      // Verified cleanup: the suite stays green and NEITHER HALF of MAC may drop.
      // Checking the mutation score alone let cleanup delete the bootstrap coverage
      // test — which is exactly the "vacuous" shape it is told to remove — for free:
      // deleting a test moves its mutants from `survived` to `nocoverage`, and both
      // sit in the score's denominator, so the score does not move while coverage
      // collapses. The PR body, written before cleanup, would then advertise coverage
      // the branch no longer delivers.
      const covBase = stryMutAct_9fa48("4283") ? (f.coverageAfter ?? f.coverage) && 0 : (stryCov_9fa48("4283"), (stryMutAct_9fa48("4284") ? f.coverageAfter && f.coverage : (stryCov_9fa48("4284"), f.coverageAfter ?? f.coverage)) ?? 0); // snapshot first: runCoverage overwrites it
      const mutBase = stryMutAct_9fa48("4285") ? (f.mutationAfter ?? f.mutation) && 0 : (stryCov_9fa48("4285"), (stryMutAct_9fa48("4286") ? f.mutationAfter && f.mutation : (stryCov_9fa48("4286"), f.mutationAfter ?? f.mutation)) ?? 0);
      let newScore = null,
        newCov = null,
        ok = stryMutAct_9fa48("4287") ? true : (stryCov_9fa48("4287"), false),
        why = stryMutAct_9fa48("4288") ? "Stryker was here!" : (stryCov_9fa48("4288"), '');
      const cr = await coverage.runCoverage(); // this runs the whole suite too
      if (stryMutAct_9fa48("4291") ? cr.exitCode === 0 : stryMutAct_9fa48("4290") ? false : stryMutAct_9fa48("4289") ? true : (stryCov_9fa48("4289", "4290", "4291"), cr.exitCode !== 0)) why = stryMutAct_9fa48("4292") ? "" : (stryCov_9fa48("4292"), 'suite went red');else {
        if (stryMutAct_9fa48("4293")) {
          {}
        } else {
          stryCov_9fa48("4293");
          newCov = stryMutAct_9fa48("4294") ? state.files[file]?.coverage && null : (stryCov_9fa48("4294"), (stryMutAct_9fa48("4295") ? state.files[file].coverage : (stryCov_9fa48("4295"), state.files[file]?.coverage)) ?? null);
          try {
            if (stryMutAct_9fa48("4296")) {
              {}
            } else {
              stryCov_9fa48("4296");
              const st = await stryker.runStryker(file);
              newScore = st.score;
              ok = stryMutAct_9fa48("4299") ? newScore >= mutBase || (newCov ?? 0) >= covBase : stryMutAct_9fa48("4298") ? false : stryMutAct_9fa48("4297") ? true : (stryCov_9fa48("4297", "4298", "4299"), (stryMutAct_9fa48("4302") ? newScore < mutBase : stryMutAct_9fa48("4301") ? newScore > mutBase : stryMutAct_9fa48("4300") ? true : (stryCov_9fa48("4300", "4301", "4302"), newScore >= mutBase)) && (stryMutAct_9fa48("4305") ? (newCov ?? 0) < covBase : stryMutAct_9fa48("4304") ? (newCov ?? 0) > covBase : stryMutAct_9fa48("4303") ? true : (stryCov_9fa48("4303", "4304", "4305"), (stryMutAct_9fa48("4306") ? newCov && 0 : (stryCov_9fa48("4306"), newCov ?? 0)) >= covBase)));
              if (stryMutAct_9fa48("4309") ? false : stryMutAct_9fa48("4308") ? true : stryMutAct_9fa48("4307") ? ok : (stryCov_9fa48("4307", "4308", "4309"), !ok)) why = stryMutAct_9fa48("4310") ? `` : (stryCov_9fa48("4310"), `mutation ${mutBase}→${newScore}, coverage ${covBase}→${newCov}`);
            }
          } catch (e) {
            if (stryMutAct_9fa48("4311")) {
              {}
            } else {
              stryCov_9fa48("4311");
              why = (stryMutAct_9fa48("4312") ? "" : (stryCov_9fa48("4312"), 'could not re-measure: ')) + (stryMutAct_9fa48("4313") ? e.message : (stryCov_9fa48("4313"), e.message.slice(0, 120)));
            }
          }
        }
      }
      if (stryMutAct_9fa48("4316") ? false : stryMutAct_9fa48("4315") ? true : stryMutAct_9fa48("4314") ? ok : (stryCov_9fa48("4314", "4315", "4316"), !ok)) {
        if (stryMutAct_9fa48("4317")) {
          {}
        } else {
          stryCov_9fa48("4317");
          for (const t of touched) repo.writeTestFile(t.path, t._original);
          // runCoverage already wrote the post-cleanup number into state — put it back
          S.upsertFile(file, stryMutAct_9fa48("4318") ? {} : (stryCov_9fa48("4318"), {
            coverage: covBase,
            coverageAfter: covBase
          }));
          S.event(stryMutAct_9fa48("4319") ? "" : (stryCov_9fa48("4319"), 'preparing_pr'), stryMutAct_9fa48("4320") ? `` : (stryCov_9fa48("4320"), `cleanup reverted: ${why}`));
          return stryMutAct_9fa48("4321") ? {} : (stryCov_9fa48("4321"), {
            ok: stryMutAct_9fa48("4322") ? false : (stryCov_9fa48("4322"), true),
            cleaned: 0,
            reverted: stryMutAct_9fa48("4323") ? false : (stryCov_9fa48("4323"), true),
            results: publicResults
          });
        }
      }
      const cov = stryMutAct_9fa48("4324") ? newCov && covBase : (stryCov_9fa48("4324"), newCov ?? covBase);
      S.upsertFile(file, stryMutAct_9fa48("4325") ? {} : (stryCov_9fa48("4325"), {
        coverage: cov,
        coverageAfter: cov,
        mutation: newScore,
        mutationAfter: newScore,
        mac: mac(cov, newScore),
        macAfter: mac(cov, newScore)
      }));
      // cleaned files are edits on top of committed rounds — commit them so the PR carries them
      try {
        if (stryMutAct_9fa48("4326")) {
          {}
        } else {
          stryCov_9fa48("4326");
          await pr.commit(stryMutAct_9fa48("4327") ? `` : (stryCov_9fa48("4327"), `test: tidy generated tests for ${file}`));
        }
      } catch (e) {
        if (stryMutAct_9fa48("4328")) {
          {}
        } else {
          stryCov_9fa48("4328");
          S.event(stryMutAct_9fa48("4329") ? "" : (stryCov_9fa48("4329"), 'preparing_pr'), (stryMutAct_9fa48("4330") ? "" : (stryCov_9fa48("4330"), 'cleanup commit note: ')) + (stryMutAct_9fa48("4331") ? e.message : (stryCov_9fa48("4331"), e.message.slice(0, 160))));
        }
      }
      S.event(stryMutAct_9fa48("4332") ? "" : (stryCov_9fa48("4332"), 'preparing_pr'), (stryMutAct_9fa48("4333") ? "" : (stryCov_9fa48("4333"), 'cleanup kept: ')) + touched.map(stryMutAct_9fa48("4334") ? () => undefined : (stryCov_9fa48("4334"), t => stryMutAct_9fa48("4335") ? `` : (stryCov_9fa48("4335"), `${t.path} ${t.bytesBefore}→${t.bytesAfter}B`))).join(stryMutAct_9fa48("4336") ? "" : (stryCov_9fa48("4336"), ', ')));
      const merged = await consolidate(file, covBase, newScore);
      return stryMutAct_9fa48("4337") ? {} : (stryCov_9fa48("4337"), {
        ok: stryMutAct_9fa48("4338") ? false : (stryCov_9fa48("4338"), true),
        cleaned: touched.length,
        merged,
        mutationAfter: newScore,
        results: publicResults
      });
    }
  },
  // ── mutant-driven loop: one target, one test, verified kill ────────────────
  'GET /api/mutant/next': async q => {
    if (stryMutAct_9fa48("4339")) {
      {}
    } else {
      stryCov_9fa48("4339");
      needRun();
      const p = q.get(stryMutAct_9fa48("4340") ? "" : (stryCov_9fa48("4340"), 'path'));
      const f = stryMutAct_9fa48("4343") ? p || state.files[p] : stryMutAct_9fa48("4342") ? false : stryMutAct_9fa48("4341") ? true : (stryCov_9fa48("4341", "4342", "4343"), p && state.files[p]);
      if (stryMutAct_9fa48("4346") ? false : stryMutAct_9fa48("4345") ? true : stryMutAct_9fa48("4344") ? f : (stryCov_9fa48("4344", "4345", "4346"), !f)) throw new Error((stryMutAct_9fa48("4347") ? "" : (stryCov_9fa48("4347"), 'unknown file: ')) + p);
      // The budget stops WASTE, not progress: a successful kill is the goal, so only
      // failed attempts consume it. (Counting every attempt made the loop quit with
      // 10 killable survivors still on the table.) A generous hard ceiling remains as
      // a runaway guard.
      const budget = stryMutAct_9fa48("4350") ? state.run.config.maxMutantsPerFile && 5 : stryMutAct_9fa48("4349") ? false : stryMutAct_9fa48("4348") ? true : (stryCov_9fa48("4348", "4349", "4350"), state.run.config.maxMutantsPerFile || 5);
      const failures = stryMutAct_9fa48("4353") ? f.mutantFailures && 0 : stryMutAct_9fa48("4352") ? false : stryMutAct_9fa48("4351") ? true : (stryCov_9fa48("4351", "4352", "4353"), f.mutantFailures || 0);
      const spent = stryMutAct_9fa48("4356") ? f.mutantAttemptCount && 0 : stryMutAct_9fa48("4355") ? false : stryMutAct_9fa48("4354") ? true : (stryCov_9fa48("4354", "4355", "4356"), f.mutantAttemptCount || 0);
      const hardCeiling = stryMutAct_9fa48("4357") ? budget / 6 : (stryCov_9fa48("4357"), budget * 6);
      // The budget bounds WASTE, and a test that cannot run is waste whoever is at
      // fault. Counting only judged failures against it removed the brake entirely: on a
      // live file 19 red tests cost 0 of 15, so the round ran for two and a half hours
      // with the 90-attempt ceiling as its only stop. A red test still does not retire
      // its MUTANT — that distinction is about evidence and stands — but it does spend
      // the loop's time.
      const genFailures = stryMutAct_9fa48("4360") ? f.mutantGenFailures && 0 : stryMutAct_9fa48("4359") ? false : stryMutAct_9fa48("4358") ? true : (stryCov_9fa48("4358", "4359", "4360"), f.mutantGenFailures || 0);
      if (stryMutAct_9fa48("4364") ? failures + genFailures < budget : stryMutAct_9fa48("4363") ? failures + genFailures > budget : stryMutAct_9fa48("4362") ? false : stryMutAct_9fa48("4361") ? true : (stryCov_9fa48("4361", "4362", "4363", "4364"), (stryMutAct_9fa48("4365") ? failures - genFailures : (stryCov_9fa48("4365"), failures + genFailures)) >= budget)) {
        if (stryMutAct_9fa48("4366")) {
          {}
        } else {
          stryCov_9fa48("4366");
          return stryMutAct_9fa48("4367") ? {} : (stryCov_9fa48("4367"), {
            ok: stryMutAct_9fa48("4368") ? false : (stryCov_9fa48("4368"), true),
            mutant: null,
            done: stryMutAct_9fa48("4369") ? false : (stryCov_9fa48("4369"), true),
            reason: (stryMutAct_9fa48("4370") ? `` : (stryCov_9fa48("4370"), `attempt budget spent (${failures} test(s) killed nothing, ${genFailures} could not be written or run; `)) + (stryMutAct_9fa48("4371") ? `` : (stryCov_9fa48("4371"), `${stryMutAct_9fa48("4374") ? f.mutantsKilled && 0 : stryMutAct_9fa48("4373") ? false : stryMutAct_9fa48("4372") ? true : (stryCov_9fa48("4372", "4373", "4374"), f.mutantsKilled || 0)} killed)`))
          });
        }
      }
      if (stryMutAct_9fa48("4378") ? spent < hardCeiling : stryMutAct_9fa48("4377") ? spent > hardCeiling : stryMutAct_9fa48("4376") ? false : stryMutAct_9fa48("4375") ? true : (stryCov_9fa48("4375", "4376", "4377", "4378"), spent >= hardCeiling)) {
        if (stryMutAct_9fa48("4379")) {
          {}
        } else {
          stryCov_9fa48("4379");
          return stryMutAct_9fa48("4380") ? {} : (stryCov_9fa48("4380"), {
            ok: stryMutAct_9fa48("4381") ? false : (stryCov_9fa48("4381"), true),
            mutant: null,
            done: stryMutAct_9fa48("4382") ? false : (stryCov_9fa48("4382"), true),
            reason: stryMutAct_9fa48("4383") ? `` : (stryCov_9fa48("4383"), `hard attempt ceiling ${hardCeiling} reached (${stryMutAct_9fa48("4386") ? f.mutantsKilled && 0 : stryMutAct_9fa48("4385") ? false : stryMutAct_9fa48("4384") ? true : (stryCov_9fa48("4384", "4385", "4386"), f.mutantsKilled || 0)} killed)`)
          });
        }
      }

      // A stale list is not evidence of "nothing left to kill". Re-measure before
      // giving up: the coverage bootstrap just made the file executable, so mutants
      // that were unreachable (or invisible, when the baseline run found no tests at
      // all) are now live targets.
      if (stryMutAct_9fa48("4388") ? false : stryMutAct_9fa48("4387") ? true : (stryCov_9fa48("4387", "4388"), f.survivorsStale)) {
        if (stryMutAct_9fa48("4389")) {
          {}
        } else {
          stryCov_9fa48("4389");
          S.setStage(stryMutAct_9fa48("4390") ? "" : (stryCov_9fa48("4390"), 'improving_mutation'), stryMutAct_9fa48("4391") ? `` : (stryCov_9fa48("4391"), `re-measuring mutants in ${p} after new tests`));
          try {
            if (stryMutAct_9fa48("4392")) {
              {}
            } else {
              stryCov_9fa48("4392");
              // Coverage is otherwise measured only at baseline and at verify, so a file that
              // had no tests carries coverage 0 — and therefore MAC 0 — for the whole round,
              // however many mutants die. This is the one moment we KNOW it changed: the
              // bootstrap just made the file executable. One coverage run, once per file.
              try {
                if (stryMutAct_9fa48("4393")) {
                  {}
                } else {
                  stryCov_9fa48("4393");
                  await coverage.runCoverage();
                }
              } catch {}
              const fresh = await stryker.runStryker(p);
              // the queue must be filled by whatever MEASURED the survivors. Filling it only
              // from the baseline left it empty on every file that started with no tests —
              // and then the sweep silently fell back to the flat shortlist and offered the
              // same eight sites for ever.
              mutantStore.replace(p, stryMutAct_9fa48("4396") ? (fresh.survivedAll || fresh.survived) && [] : stryMutAct_9fa48("4395") ? false : stryMutAct_9fa48("4394") ? true : (stryCov_9fa48("4394", "4395", "4396"), (stryMutAct_9fa48("4398") ? fresh.survivedAll && fresh.survived : stryMutAct_9fa48("4397") ? false : (stryCov_9fa48("4397", "4398"), fresh.survivedAll || fresh.survived)) || (stryMutAct_9fa48("4399") ? ["Stryker was here"] : (stryCov_9fa48("4399"), []))));
              const cov = stryMutAct_9fa48("4400") ? state.files[p]?.coverage && f.coverage : (stryCov_9fa48("4400"), (stryMutAct_9fa48("4401") ? state.files[p].coverage : (stryCov_9fa48("4401"), state.files[p]?.coverage)) ?? f.coverage);
              S.upsertFile(p, stryMutAct_9fa48("4402") ? {} : (stryCov_9fa48("4402"), {
                mutation: fresh.score,
                mac: mac(cov, fresh.score),
                totalMutants: fresh.totalMutants,
                survivedTotal: stryMutAct_9fa48("4403") ? fresh.survivedTotal && (fresh.survived || []).length : (stryCov_9fa48("4403"), fresh.survivedTotal ?? (stryMutAct_9fa48("4406") ? fresh.survived && [] : stryMutAct_9fa48("4405") ? false : stryMutAct_9fa48("4404") ? true : (stryCov_9fa48("4404", "4405", "4406"), fresh.survived || (stryMutAct_9fa48("4407") ? ["Stryker was here"] : (stryCov_9fa48("4407"), [])))).length),
                lastSurvived: stryMutAct_9fa48("4408") ? fresh.survived || [] : (stryCov_9fa48("4408"), (stryMutAct_9fa48("4411") ? fresh.survived && [] : stryMutAct_9fa48("4410") ? false : stryMutAct_9fa48("4409") ? true : (stryCov_9fa48("4409", "4410", "4411"), fresh.survived || (stryMutAct_9fa48("4412") ? ["Stryker was here"] : (stryCov_9fa48("4412"), [])))).slice(0, 100)),
                survivorsStale: stryMutAct_9fa48("4413") ? true : (stryCov_9fa48("4413"), false)
              }));
            }
          } catch (e) {
            if (stryMutAct_9fa48("4414")) {
              {}
            } else {
              stryCov_9fa48("4414");
              S.event(stryMutAct_9fa48("4415") ? "" : (stryCov_9fa48("4415"), 'improving_mutation'), stryMutAct_9fa48("4416") ? `` : (stryCov_9fa48("4416"), `mutation re-measure failed on ${p}: ${stryMutAct_9fa48("4417") ? e.message : (stryCov_9fa48("4417"), e.message.slice(0, 200))}`));
              S.upsertFile(p, stryMutAct_9fa48("4418") ? {} : (stryCov_9fa48("4418"), {
                survivorsStale: stryMutAct_9fa48("4419") ? true : (stryCov_9fa48("4419"), false)
              }));
            }
          }
        }
      }
      const cur = state.files[p];
      // a mutant we could not write a test for a few times running is parked, so one
      // pathological target cannot pin the loop to itself
      const misses = stryMutAct_9fa48("4422") ? cur.mutantNoOutput && {} : stryMutAct_9fa48("4421") ? false : stryMutAct_9fa48("4420") ? true : (stryCov_9fa48("4420", "4421", "4422"), cur.mutantNoOutput || {});
      const writable = stryMutAct_9fa48("4423") ? cur.lastSurvived || [] : (stryCov_9fa48("4423"), (stryMutAct_9fa48("4426") ? cur.lastSurvived && [] : stryMutAct_9fa48("4425") ? false : stryMutAct_9fa48("4424") ? true : (stryCov_9fa48("4424", "4425", "4426"), cur.lastSurvived || (stryMutAct_9fa48("4427") ? ["Stryker was here"] : (stryCov_9fa48("4427"), [])))).filter(stryMutAct_9fa48("4428") ? () => undefined : (stryCov_9fa48("4428"), m => stryMutAct_9fa48("4432") ? (misses[mutantsMod.mutantKey(m)] || 0) >= 3 : stryMutAct_9fa48("4431") ? (misses[mutantsMod.mutantKey(m)] || 0) <= 3 : stryMutAct_9fa48("4430") ? false : stryMutAct_9fa48("4429") ? true : (stryCov_9fa48("4429", "4430", "4431", "4432"), (stryMutAct_9fa48("4435") ? misses[mutantsMod.mutantKey(m)] && 0 : stryMutAct_9fa48("4434") ? false : stryMutAct_9fa48("4433") ? true : (stryCov_9fa48("4433", "4434", "4435"), misses[mutantsMod.mutantKey(m)] || 0)) < 3))));
      const candidates = mutantsMod.shortlist(writable, stryMutAct_9fa48("4436") ? {} : (stryCov_9fa48("4436"), {
        attempts: stryMutAct_9fa48("4439") ? cur.mutantAttempts && {} : stryMutAct_9fa48("4438") ? false : stryMutAct_9fa48("4437") ? true : (stryCov_9fa48("4437", "4438", "4439"), cur.mutantAttempts || {})
      }));
      if (stryMutAct_9fa48("4442") ? false : stryMutAct_9fa48("4441") ? true : stryMutAct_9fa48("4440") ? candidates.length : (stryCov_9fa48("4440", "4441", "4442"), !candidates.length)) return stryMutAct_9fa48("4443") ? {} : (stryCov_9fa48("4443"), {
        ok: stryMutAct_9fa48("4444") ? false : (stryCov_9fa48("4444"), true),
        mutant: null,
        done: stryMutAct_9fa48("4445") ? false : (stryCov_9fa48("4445"), true),
        reason: stryMutAct_9fa48("4446") ? "" : (stryCov_9fa48("4446"), 'no viable surviving mutants left')
      });
      const source = repo.readFileSafe(p, 24000);
      const fileLines = source ? source.split(stryMutAct_9fa48("4447") ? "" : (stryCov_9fa48("4447"), '\n')).length : null;

      // The model chooses. The heuristic only shortlisted: it can see "covered" and
      // "clustered", but not whether a mutation has an observable effect a test can
      // assert — which is what actually decides killability.
      let next = candidates[0];
      let pickedBy = stryMutAct_9fa48("4448") ? "" : (stryCov_9fa48("4448"), 'heuristic (only one candidate)');
      let killIdea = stryMutAct_9fa48("4449") ? "Stryker was here!" : (stryCov_9fa48("4449"), '');
      if (stryMutAct_9fa48("4453") ? candidates.length <= 1 : stryMutAct_9fa48("4452") ? candidates.length >= 1 : stryMutAct_9fa48("4451") ? false : stryMutAct_9fa48("4450") ? true : (stryCov_9fa48("4450", "4451", "4452", "4453"), candidates.length > 1)) {
        if (stryMutAct_9fa48("4454")) {
          {}
        } else {
          stryCov_9fa48("4454");
          S.setStage(stryMutAct_9fa48("4455") ? "" : (stryCov_9fa48("4455"), 'improving_mutation'), stryMutAct_9fa48("4456") ? `` : (stryCov_9fa48("4456"), `choosing the next mutant to attack in ${p}`));
          try {
            if (stryMutAct_9fa48("4457")) {
              {}
            } else {
              stryCov_9fa48("4457");
              // what already resisted a targeted test — usually equivalent mutants
              const failed = stryMutAct_9fa48("4458") ? Object.entries(f.mutantAttempts || {}).map(([k, n]) => {
                // the key is mutator|line|column|replacement — keep all of it, or the
                // prompt bans siblings the candidate filter deliberately left in
                const [mutator, line, column, replacement] = k.split('|');
                return {
                  mutator,
                  line: Number(line),
                  column: column || null,
                  replacement: replacement || null,
                  attempts: n
                };
              }) : (stryCov_9fa48("4458"), Object.entries(stryMutAct_9fa48("4461") ? f.mutantAttempts && {} : stryMutAct_9fa48("4460") ? false : stryMutAct_9fa48("4459") ? true : (stryCov_9fa48("4459", "4460", "4461"), f.mutantAttempts || {})).filter(stryMutAct_9fa48("4462") ? () => undefined : (stryCov_9fa48("4462"), ([, n]) => stryMutAct_9fa48("4466") ? n <= 0 : stryMutAct_9fa48("4465") ? n >= 0 : stryMutAct_9fa48("4464") ? false : stryMutAct_9fa48("4463") ? true : (stryCov_9fa48("4463", "4464", "4465", "4466"), n > 0))).map(([k, n]) => {
                if (stryMutAct_9fa48("4467")) {
                  {}
                } else {
                  stryCov_9fa48("4467");
                  // the key is mutator|line|column|replacement — keep all of it, or the
                  // prompt bans siblings the candidate filter deliberately left in
                  const [mutator, line, column, replacement] = k.split(stryMutAct_9fa48("4468") ? "" : (stryCov_9fa48("4468"), '|'));
                  return stryMutAct_9fa48("4469") ? {} : (stryCov_9fa48("4469"), {
                    mutator,
                    line: Number(line),
                    column: stryMutAct_9fa48("4472") ? column && null : stryMutAct_9fa48("4471") ? false : stryMutAct_9fa48("4470") ? true : (stryCov_9fa48("4470", "4471", "4472"), column || null),
                    replacement: stryMutAct_9fa48("4475") ? replacement && null : stryMutAct_9fa48("4474") ? false : stryMutAct_9fa48("4473") ? true : (stryCov_9fa48("4473", "4474", "4475"), replacement || null),
                    attempts: n
                  });
                }
              }));
              const req = mutantsMod.buildPickRequest(candidates, stryMutAct_9fa48("4476") ? {} : (stryCov_9fa48("4476"), {
                file: p,
                source,
                constraints: rulesMod.testWritingConstraints(),
                failed
              }));
              const r = await llm.chat(req);
              const resolved = mutantsMod.resolvePick(r.json, candidates);
              if (stryMutAct_9fa48("4478") ? false : stryMutAct_9fa48("4477") ? true : (stryCov_9fa48("4477", "4478"), resolved)) {
                if (stryMutAct_9fa48("4479")) {
                  {}
                } else {
                  stryCov_9fa48("4479");
                  next = resolved.mutant;
                  killIdea = resolved.killIdea;
                  pickedBy = stryMutAct_9fa48("4480") ? "" : (stryCov_9fa48("4480"), 'llm');
                  state.decisions.pick_mutant = stryMutAct_9fa48("4481") ? {} : (stryCov_9fa48("4481"), {
                    rule: stryMutAct_9fa48("4482") ? "" : (stryCov_9fa48("4482"), '(pipeline decision — which surviving mutant to attack next)'),
                    result: stryMutAct_9fa48("4483") ? {} : (stryCov_9fa48("4483"), {
                      file: p,
                      mutator: next.mutator,
                      line: next.line,
                      reason: resolved.reason,
                      killIdea: resolved.killIdea,
                      consideredCandidates: candidates.length
                    }),
                    ts: Date.now()
                  });
                  S.event(stryMutAct_9fa48("4484") ? "" : (stryCov_9fa48("4484"), 'improving_mutation'), stryMutAct_9fa48("4485") ? `` : (stryCov_9fa48("4485"), `LLM picked ${next.mutator} at line ${next.line} of ${candidates.length} candidates: ${resolved.reason}`));
                }
              } else {
                if (stryMutAct_9fa48("4486")) {
                  {}
                } else {
                  stryCov_9fa48("4486");
                  pickedBy = stryMutAct_9fa48("4487") ? "" : (stryCov_9fa48("4487"), 'heuristic (LLM answer unusable)');
                  S.event(stryMutAct_9fa48("4488") ? "" : (stryCov_9fa48("4488"), 'improving_mutation'), stryMutAct_9fa48("4489") ? "" : (stryCov_9fa48("4489"), 'mutant choice: LLM answer unusable — falling back to the ranked top candidate'));
                }
              }
            }
          } catch (e) {
            if (stryMutAct_9fa48("4490")) {
              {}
            } else {
              stryCov_9fa48("4490");
              pickedBy = stryMutAct_9fa48("4491") ? "" : (stryCov_9fa48("4491"), 'heuristic (LLM error)');
              S.event(stryMutAct_9fa48("4492") ? "" : (stryCov_9fa48("4492"), 'improving_mutation'), (stryMutAct_9fa48("4493") ? "" : (stryCov_9fa48("4493"), 'mutant choice: LLM error — falling back to the ranked top candidate: ')) + (stryMutAct_9fa48("4494") ? e.message : (stryCov_9fa48("4494"), e.message.slice(0, 140))));
            }
          }
        }
      }
      const guess = repo.guessTestPath(p);
      // Prefer a test WE already wrote for THIS file — the bootstrap's is proven green
      // against this exact module, and a working example is worth more than a stylistic
      // one from a stranger.
      const ours = repo.ourTestFor(p);
      let existingTest = (stryMutAct_9fa48("4495") ? ours.content : (stryCov_9fa48("4495"), ours?.content)) ? (stryMutAct_9fa48("4496") ? `` : (stryCov_9fa48("4496"), `// A test already generated for THIS file, and it RUNS. Follow its imports, its\n`)) + (stryMutAct_9fa48("4497") ? `` : (stryCov_9fa48("4497"), `// helpers and its setup exactly; only the assertions need to be new (${ours.path}).\n${ours.content}`)) : guess.exists ? repo.readFileSafe(guess.path, 8000) : null;
      if (stryMutAct_9fa48("4500") ? false : stryMutAct_9fa48("4499") ? true : stryMutAct_9fa48("4498") ? existingTest : (stryCov_9fa48("4498", "4499", "4500"), !existingTest)) {
        if (stryMutAct_9fa48("4501")) {
          {}
        } else {
          stryCov_9fa48("4501");
          const ref = repo.findStyleReference(p);
          if (stryMutAct_9fa48("4503") ? false : stryMutAct_9fa48("4502") ? true : (stryCov_9fa48("4502", "4503"), ref)) existingTest = stryMutAct_9fa48("4504") ? `` : (stryCov_9fa48("4504"), `// STYLE REFERENCE — an existing test from this repo (${ref.path}).\n${ref.content}`);
        }
      }
      S.setStage(stryMutAct_9fa48("4505") ? "" : (stryCov_9fa48("4505"), 'improving_mutation'), stryMutAct_9fa48("4506") ? `` : (stryCov_9fa48("4506"), `targeting ${next.mutator} at ${p}:${next.line} (${stryMutAct_9fa48("4507") ? spent - 1 : (stryCov_9fa48("4507"), spent + 1)}/${budget})`));
      S.event(stryMutAct_9fa48("4508") ? "" : (stryCov_9fa48("4508"), 'improving_mutation'), stryMutAct_9fa48("4509") ? `` : (stryCov_9fa48("4509"), `next target [${pickedBy}]: ${next.mutator} at line ${next.line} — ${next.why}`));
      // The BATCH the loop aims at first. Measured against the real model on eight
      // survivors: one file aimed at all of them kills 6.0 on average, where the
      // single-target prompt kills 3.0 — and a single-target attempt pays a scoped test
      // run and a mutation check for its one mutant, so the real gap is wider. The
      // single pick stays as the head of the list and as the fallback when a batch
      // kills nothing.
      const batch = stryMutAct_9fa48("4510") ? [next, ...candidates.filter(m => !mutantsMod.sameMutant(m, next))] : (stryCov_9fa48("4510"), (stryMutAct_9fa48("4511") ? [] : (stryCov_9fa48("4511"), [next, ...(stryMutAct_9fa48("4512") ? candidates : (stryCov_9fa48("4512"), candidates.filter(stryMutAct_9fa48("4513") ? () => undefined : (stryCov_9fa48("4513"), m => stryMutAct_9fa48("4514") ? mutantsMod.sameMutant(m, next) : (stryCov_9fa48("4514"), !mutantsMod.sameMutant(m, next))))))])).slice(0, BATCH_TARGETS));
      // Sites, not mutants: one test per place in the source, busiest first. The queue
      // holds every survivor and remembers which sites already have a test, so a file with
      // a thousand mutants costs one generation per SITE and nothing at all for the sites
      // already covered.
      const groups = mutantStore.nextGroups(p, 12);
      return stryMutAct_9fa48("4515") ? {} : (stryCov_9fa48("4515"), {
        ok: stryMutAct_9fa48("4516") ? false : (stryCov_9fa48("4516"), true),
        done: stryMutAct_9fa48("4517") ? true : (stryCov_9fa48("4517"), false),
        path: p,
        mutant: next,
        targets: batch,
        groups,
        pickedBy,
        killIdea,
        candidatesConsidered: candidates.length,
        attemptsSpent: spent,
        failures,
        budget,
        verifyRange: mutantsMod.verifyRange(next, stryMutAct_9fa48("4518") ? {} : (stryCov_9fa48("4518"), {
          fileLines
        })),
        source,
        sourceLines: fileLines,
        testPath: guess.path,
        testExists: guess.exists,
        existingTest,
        runner: stryMutAct_9fa48("4519") ? state.runner.testRunner : (stryCov_9fa48("4519"), state.runner?.testRunner),
        ui: repo.detectUi(),
        constraints: rulesMod.testWritingConstraints(),
        packageJson: (stryMutAct_9fa48("4522") ? repo.readPkg().name && '' : stryMutAct_9fa48("4521") ? false : stryMutAct_9fa48("4520") ? true : (stryCov_9fa48("4520", "4521", "4522"), repo.readPkg().name || (stryMutAct_9fa48("4523") ? "Stryker was here!" : (stryCov_9fa48("4523"), '')))) + (stryMutAct_9fa48("4524") ? "" : (stryCov_9fa48("4524"), ' (type=')) + (stryMutAct_9fa48("4527") ? repo.readPkg().type && 'commonjs' : stryMutAct_9fa48("4526") ? false : stryMutAct_9fa48("4525") ? true : (stryCov_9fa48("4525", "4526", "4527"), repo.readPkg().type || (stryMutAct_9fa48("4528") ? "" : (stryCov_9fa48("4528"), 'commonjs')))) + (stryMutAct_9fa48("4529") ? "" : (stryCov_9fa48("4529"), ')'))
      });
    }
  },
  // A site now has a test, whatever that test turns out to be worth. Recorded before
  // any verification, because the guarantee is "one shot per site" and a shot fired is a
  // shot spent — otherwise the next sweep offers the same sites for ever.
  'POST /api/mutant/written': async (q, body) => {
    if (stryMutAct_9fa48("4530")) {
      {}
    } else {
      stryCov_9fa48("4530");
      needRun();
      const {
        file,
        names = stryMutAct_9fa48("4531") ? ["Stryker was here"] : (stryCov_9fa48("4531"), [])
      } = body;
      if (stryMutAct_9fa48("4534") ? !file && !state.files[file] : stryMutAct_9fa48("4533") ? false : stryMutAct_9fa48("4532") ? true : (stryCov_9fa48("4532", "4533", "4534"), (stryMutAct_9fa48("4535") ? file : (stryCov_9fa48("4535"), !file)) || (stryMutAct_9fa48("4536") ? state.files[file] : (stryCov_9fa48("4536"), !state.files[file])))) throw new Error((stryMutAct_9fa48("4537") ? "" : (stryCov_9fa48("4537"), 'unknown file: ')) + file);
      mutantStore.markWritten(file, names);
      return stryMutAct_9fa48("4538") ? {} : (stryCov_9fa48("4538"), {
        ok: stryMutAct_9fa48("4539") ? false : (stryCov_9fa48("4539"), true),
        written: names.length,
        pending: mutantStore.pending(file).length
      });
    }
  },
  'POST /api/mutant/verify': async (q, body) => {
    if (stryMutAct_9fa48("4540")) {
      {}
    } else {
      stryCov_9fa48("4540");
      needRun();
      // 'batch' is the only phase whose failure condemns nobody: a sweep writes one test
      // per SITE, so a batch that kills nothing says nothing about any individual mutant
      // and the single-target attempt is still worth making. Every other phase IS that
      // mutant's verdict — there used to be a reasoning retry after the first attempt,
      // and while it existed a first failure deliberately cost nothing. It is gone, so a
      // failure that costs nothing would simply offer the same mutant for ever.
      const {
        file,
        testPaths = stryMutAct_9fa48("4541") ? ["Stryker was here"] : (stryCov_9fa48("4541"), []),
        phase
      } = body;
      // One entry point, two shapes: `mutants` is a batch aimed at many targets at once,
      // `mutant` is the single-target attempt (and the head of any batch). The verdict
      // machinery below is identical — only the bookkeeping differs, because a batch that
      // kills nothing has a single-target attempt still to come.
      const batch = (stryMutAct_9fa48("4544") ? Array.isArray(body.mutants) || body.mutants.length : stryMutAct_9fa48("4543") ? false : stryMutAct_9fa48("4542") ? true : (stryCov_9fa48("4542", "4543", "4544"), Array.isArray(body.mutants) && body.mutants.length)) ? body.mutants : null;
      const mutant = batch ? batch[0] : body.mutant;
      const sweep = stryMutAct_9fa48("4547") ? phase !== 'batch' : stryMutAct_9fa48("4546") ? false : stryMutAct_9fa48("4545") ? true : (stryCov_9fa48("4545", "4546", "4547"), phase === (stryMutAct_9fa48("4548") ? "" : (stryCov_9fa48("4548"), 'batch')));
      const f = stryMutAct_9fa48("4551") ? file || state.files[file] : stryMutAct_9fa48("4550") ? false : stryMutAct_9fa48("4549") ? true : (stryCov_9fa48("4549", "4550", "4551"), file && state.files[file]);
      if (stryMutAct_9fa48("4554") ? !f && !mutant : stryMutAct_9fa48("4553") ? false : stryMutAct_9fa48("4552") ? true : (stryCov_9fa48("4552", "4553", "4554"), (stryMutAct_9fa48("4555") ? f : (stryCov_9fa48("4555"), !f)) || (stryMutAct_9fa48("4556") ? mutant : (stryCov_9fa48("4556"), !mutant)))) throw new Error(stryMutAct_9fa48("4557") ? "" : (stryCov_9fa48("4557"), 'file and mutant are required'));
      const key = mutantsMod.mutantKey(mutant);
      // Two different questions, so two different flags:
      //   targetDied  → retire THIS mutant (it had its one shot)
      //   worthKeeping→ keep the test, and do not charge the failure budget
      // Conflating them let a test that killed only neighbours leave its target
      // with no recorded attempt, so the target could be picked again.
      // declared before bump() closes over it: a failure can spend a mutant's shot
      // before any mutation run has happened, and then nothing has died yet
      let deadTargets = stryMutAct_9fa48("4558") ? ["Stryker was here"] : (stryCov_9fa48("4558"), []);
      const bump = (targetDied, worthKeeping) => {
        if (stryMutAct_9fa48("4559")) {
          {}
        } else {
          stryCov_9fa48("4559");
          const attempts = stryMutAct_9fa48("4560") ? {} : (stryCov_9fa48("4560"), {
            ...(stryMutAct_9fa48("4563") ? f.mutantAttempts && {} : stryMutAct_9fa48("4562") ? false : stryMutAct_9fa48("4561") ? true : (stryCov_9fa48("4561", "4562", "4563"), f.mutantAttempts || {}))
          });
          // Every mutant this attempt AIMED at has now had its shot: the ones that died
          // leave the survivor list on their own, and the ones that survived a test written
          // for them are retired. Without that, the survivors of a batch come straight back
          // as candidates and the next batch attacks the same set for ever.
          const aimed = stryMutAct_9fa48("4566") ? batch && [mutant] : stryMutAct_9fa48("4565") ? false : stryMutAct_9fa48("4564") ? true : (stryCov_9fa48("4564", "4565", "4566"), batch || (stryMutAct_9fa48("4567") ? [] : (stryCov_9fa48("4567"), [mutant])));
          const dead = new Set(deadTargets.map(stryMutAct_9fa48("4568") ? () => undefined : (stryCov_9fa48("4568"), m => mutantsMod.mutantKey(m))));
          for (const m of aimed) {
            if (stryMutAct_9fa48("4569")) {
              {}
            } else {
              stryCov_9fa48("4569");
              const k = mutantsMod.mutantKey(m);
              if (stryMutAct_9fa48("4572") ? false : stryMutAct_9fa48("4571") ? true : stryMutAct_9fa48("4570") ? dead.has(k) : (stryCov_9fa48("4570", "4571", "4572"), !dead.has(k))) attempts[k] = stryMutAct_9fa48("4573") ? (attempts[k] || 0) - 1 : (stryCov_9fa48("4573"), (stryMutAct_9fa48("4576") ? attempts[k] && 0 : stryMutAct_9fa48("4575") ? false : stryMutAct_9fa48("4574") ? true : (stryCov_9fa48("4574", "4575", "4576"), attempts[k] || 0)) + 1);
            }
          }
          S.upsertFile(file, stryMutAct_9fa48("4577") ? {} : (stryCov_9fa48("4577"), {
            mutantAttempts: attempts,
            mutantAttemptCount: stryMutAct_9fa48("4578") ? (f.mutantAttemptCount || 0) - 1 : (stryCov_9fa48("4578"), (stryMutAct_9fa48("4581") ? f.mutantAttemptCount && 0 : stryMutAct_9fa48("4580") ? false : stryMutAct_9fa48("4579") ? true : (stryCov_9fa48("4579", "4580", "4581"), f.mutantAttemptCount || 0)) + 1),
            mutantFailures: stryMutAct_9fa48("4582") ? (f.mutantFailures || 0) - (worthKeeping ? 0 : 1) : (stryCov_9fa48("4582"), (stryMutAct_9fa48("4585") ? f.mutantFailures && 0 : stryMutAct_9fa48("4584") ? false : stryMutAct_9fa48("4583") ? true : (stryCov_9fa48("4583", "4584", "4585"), f.mutantFailures || 0)) + (worthKeeping ? 0 : 1)),
            mutantsKilled: stryMutAct_9fa48("4586") ? (f.mutantsKilled || 0) - (batch ? deadTargets.length : targetDied ? 1 : 0) : (stryCov_9fa48("4586"), (stryMutAct_9fa48("4589") ? f.mutantsKilled && 0 : stryMutAct_9fa48("4588") ? false : stryMutAct_9fa48("4587") ? true : (stryCov_9fa48("4587", "4588", "4589"), f.mutantsKilled || 0)) + (batch ? deadTargets.length : targetDied ? 1 : 0))
          }));
        }
      };
      const drop = () => {
        if (stryMutAct_9fa48("4590")) {
          {}
        } else {
          stryCov_9fa48("4590");
          for (const p of testPaths) repo.deleteTestFile(p);
        }
      };
      // A mutant's one shot is spent by EVIDENCE — a test was written and the mutant
      // survived it. "The model returned nothing" and "the verification run crashed"
      // are evidence of nothing: retiring the target there discards a killable mutant
      // that was never attacked, and charging the failure budget lets a broken
      // generator or a flaky Stryker end the loop while the file is still improvable.
      const miss = why => {
        if (stryMutAct_9fa48("4591")) {
          {}
        } else {
          stryCov_9fa48("4591");
          const misses = stryMutAct_9fa48("4592") ? {} : (stryCov_9fa48("4592"), {
            ...(stryMutAct_9fa48("4595") ? f.mutantNoOutput && {} : stryMutAct_9fa48("4594") ? false : stryMutAct_9fa48("4593") ? true : (stryCov_9fa48("4593", "4594", "4595"), f.mutantNoOutput || {}))
          });
          misses[key] = stryMutAct_9fa48("4596") ? (misses[key] || 0) - 1 : (stryCov_9fa48("4596"), (stryMutAct_9fa48("4599") ? misses[key] && 0 : stryMutAct_9fa48("4598") ? false : stryMutAct_9fa48("4597") ? true : (stryCov_9fa48("4597", "4598", "4599"), misses[key] || 0)) + 1);
          S.upsertFile(file, stryMutAct_9fa48("4600") ? {} : (stryCov_9fa48("4600"), {
            mutantNoOutput: misses,
            mutantAttemptCount: stryMutAct_9fa48("4601") ? (f.mutantAttemptCount || 0) - 1 : (stryCov_9fa48("4601"), (stryMutAct_9fa48("4604") ? f.mutantAttemptCount && 0 : stryMutAct_9fa48("4603") ? false : stryMutAct_9fa48("4602") ? true : (stryCov_9fa48("4602", "4603", "4604"), f.mutantAttemptCount || 0)) + 1),
            mutantGenFailures: stryMutAct_9fa48("4605") ? (f.mutantGenFailures || 0) - 1 : (stryCov_9fa48("4605"), (stryMutAct_9fa48("4608") ? f.mutantGenFailures && 0 : stryMutAct_9fa48("4607") ? false : stryMutAct_9fa48("4606") ? true : (stryCov_9fa48("4606", "4607", "4608"), f.mutantGenFailures || 0)) + 1)
          }));
          S.event(stryMutAct_9fa48("4609") ? "" : (stryCov_9fa48("4609"), 'improving_mutation'), (stryMutAct_9fa48("4610") ? `` : (stryCov_9fa48("4610"), `${why} for ${mutant.mutator} at line ${mutant.line} `)) + (stryMutAct_9fa48("4611") ? `` : (stryCov_9fa48("4611"), `— the target stays on the queue (miss ${misses[key]})`)));
        }
      };
      if (stryMutAct_9fa48("4614") ? false : stryMutAct_9fa48("4613") ? true : stryMutAct_9fa48("4612") ? testPaths.length : (stryCov_9fa48("4612", "4613", "4614"), !testPaths.length)) {
        if (stryMutAct_9fa48("4615")) {
          {}
        } else {
          stryCov_9fa48("4615");
          miss(stryMutAct_9fa48("4616") ? "" : (stryCov_9fa48("4616"), 'no usable test was generated'));
          return stryMutAct_9fa48("4617") ? {} : (stryCov_9fa48("4617"), {
            ok: stryMutAct_9fa48("4618") ? false : (stryCov_9fa48("4618"), true),
            killed: stryMutAct_9fa48("4619") ? true : (stryCov_9fa48("4619"), false),
            noTest: stryMutAct_9fa48("4620") ? false : (stryCov_9fa48("4620"), true),
            retryable: sweep,
            reason: stryMutAct_9fa48("4621") ? "" : (stryCov_9fa48("4621"), 'no test was written')
          });
        }
      }

      // 1. The new test must pass — one that fails is never worth keeping.
      //    Scoped to the file just written: on a real repo that is ~1s against ~55s for
      //    the whole suite, on every one of up to fifteen attempts per file. The
      //    whole-suite question is still asked once per round by /api/verify, and a
      //    round whose full suite is red is dropped entirely — so a test that passes
      //    alone but breaks a neighbour costs that round, not a PR. Already-committed
      //    rounds were each full-suite verified when they were accepted.
      S.setStage(stryMutAct_9fa48("4622") ? "" : (stryCov_9fa48("4622"), 'improving_mutation'), stryMutAct_9fa48("4623") ? `` : (stryCov_9fa48("4623"), `checking the new test for ${mutant.mutator} at line ${mutant.line}`));
      const suite = await tests.runTests(testPaths);
      if (stryMutAct_9fa48("4626") ? false : stryMutAct_9fa48("4625") ? true : stryMutAct_9fa48("4624") ? suite.passed : (stryCov_9fa48("4624", "4625", "4626"), !suite.passed)) {
        if (stryMutAct_9fa48("4627")) {
          {}
        } else {
          stryCov_9fa48("4627");
          // A test that fails against the REAL code is a broken test, not evidence that
          // this mutant resists testing — the same distinction as an empty answer, and
          // capped the same way.
          drop();
          // The runner already said exactly what was wrong. That text used to go only to
          // the escalated prompt; with the escalation gone it would reach nobody at all,
          // and red tests are the dominant failure on schema-heavy files — so put it where
          // a human reading the event log can see it.
          miss(stryMutAct_9fa48("4628") ? "" : (stryCov_9fa48("4628"), 'the generated test failed against the unmutated code'));
          // ...and the mutant's shot is spent, because nothing about a next attempt would
          // differ. An empty answer or a crashed run can come good on a retry; a test that
          // will not run against the real code is the same prompt producing the same class
          // of answer, and it was only ever forgiven because the escalation followed it
          // with the runner's output in hand.
          if (stryMutAct_9fa48("4631") ? false : stryMutAct_9fa48("4630") ? true : stryMutAct_9fa48("4629") ? sweep : (stryCov_9fa48("4629", "4630", "4631"), !sweep)) {
            if (stryMutAct_9fa48("4632")) {
              {}
            } else {
              stryCov_9fa48("4632");
              const attempts = stryMutAct_9fa48("4633") ? {} : (stryCov_9fa48("4633"), {
                ...(stryMutAct_9fa48("4636") ? f.mutantAttempts && {} : stryMutAct_9fa48("4635") ? false : stryMutAct_9fa48("4634") ? true : (stryCov_9fa48("4634", "4635", "4636"), f.mutantAttempts || {}))
              });
              for (const m of stryMutAct_9fa48("4639") ? batch && [mutant] : stryMutAct_9fa48("4638") ? false : stryMutAct_9fa48("4637") ? true : (stryCov_9fa48("4637", "4638", "4639"), batch || (stryMutAct_9fa48("4640") ? [] : (stryCov_9fa48("4640"), [mutant])))) {
                if (stryMutAct_9fa48("4641")) {
                  {}
                } else {
                  stryCov_9fa48("4641");
                  const k2 = mutantsMod.mutantKey(m);
                  attempts[k2] = stryMutAct_9fa48("4642") ? (attempts[k2] || 0) - 1 : (stryCov_9fa48("4642"), (stryMutAct_9fa48("4645") ? attempts[k2] && 0 : stryMutAct_9fa48("4644") ? false : stryMutAct_9fa48("4643") ? true : (stryCov_9fa48("4643", "4644", "4645"), attempts[k2] || 0)) + 1);
                }
              }
              // retire the target, but charge the budget ONCE: miss() has already counted
              // this as a generation failure, and it is one event, not two
              S.upsertFile(file, stryMutAct_9fa48("4646") ? {} : (stryCov_9fa48("4646"), {
                mutantAttempts: attempts
              }));
            }
          }
          if (stryMutAct_9fa48("4648") ? false : stryMutAct_9fa48("4647") ? true : (stryCov_9fa48("4647", "4648"), suite.summary)) {
            if (stryMutAct_9fa48("4649")) {
              {}
            } else {
              stryCov_9fa48("4649");
              S.event(stryMutAct_9fa48("4650") ? "" : (stryCov_9fa48("4650"), 'improving_mutation'), (stryMutAct_9fa48("4651") ? "" : (stryCov_9fa48("4651"), 'runner said: ')) + (stryMutAct_9fa48("4652") ? String(suite.summary).replace(/\s+/g, ' ') : (stryCov_9fa48("4652"), String(suite.summary).replace(stryMutAct_9fa48("4654") ? /\S+/g : stryMutAct_9fa48("4653") ? /\s/g : (stryCov_9fa48("4653", "4654"), /\s+/g), stryMutAct_9fa48("4655") ? "" : (stryCov_9fa48("4655"), ' ')).slice(0, 240))));
            }
          }
          return stryMutAct_9fa48("4656") ? {} : (stryCov_9fa48("4656"), {
            ok: stryMutAct_9fa48("4657") ? false : (stryCov_9fa48("4657"), true),
            killed: stryMutAct_9fa48("4658") ? true : (stryCov_9fa48("4658"), false),
            retryable: sweep,
            reason: stryMutAct_9fa48("4659") ? "" : (stryCov_9fa48("4659"), 'suite red'),
            summary: suite.summary
          });
        }
      }
      // 2. Verify the kill on a RANGE around the target, and fall back to the whole file
      //    only when the window saw nothing die.
      //
      //    Measured over a 5-hour run: the whole-file re-run after every attempt was 178
      //    of 305 minutes — 58% of the pipeline, 194s median — spent answering one
      //    question about one mutant by re-testing every mutant in the file.
      //
      //    A window answers that question cheaply, but it cannot see collateral outside
      //    itself, and a test whose only kill was distant would be discarded on its
      //    evidence alone. So the window is a FAST PATH, not a replacement: if anything
      //    in it died, that is enough to keep the test and we stop there. If nothing did,
      //    we pay for the whole-file run before drawing any conclusion — which is what
      //    used to happen every single time. About four attempts in five kill something,
      //    so most of the 178 minutes goes away and no test is thrown out that the old
      //    path would have kept.
      const src = repo.readFileSafe(file, 500000);
      const fileLines = src ? src.split(stryMutAct_9fa48("4660") ? "" : (stryCov_9fa48("4660"), '\n')).length : null;
      // A batch spans several targets, so the window has to cover all of them — the
      // union of each one's range, capped so a batch spread across a whole file simply
      // becomes a whole-file run rather than a window that pretends to be one.
      const ranges = (stryMutAct_9fa48("4663") ? batch && [mutant] : stryMutAct_9fa48("4662") ? false : stryMutAct_9fa48("4661") ? true : (stryCov_9fa48("4661", "4662", "4663"), batch || (stryMutAct_9fa48("4664") ? [] : (stryCov_9fa48("4664"), [mutant])))).map(stryMutAct_9fa48("4665") ? () => undefined : (stryCov_9fa48("4665"), m => mutantsMod.verifyRange(m, stryMutAct_9fa48("4666") ? {} : (stryCov_9fa48("4666"), {
        pad: 30,
        fileLines
      }))));
      const union = stryMutAct_9fa48("4667") ? {} : (stryCov_9fa48("4667"), {
        from: stryMutAct_9fa48("4668") ? Math.max(...ranges.map(r => r.from)) : (stryCov_9fa48("4668"), Math.min(...ranges.map(stryMutAct_9fa48("4669") ? () => undefined : (stryCov_9fa48("4669"), r => r.from)))),
        to: stryMutAct_9fa48("4670") ? Math.min(...ranges.map(r => r.to)) : (stryCov_9fa48("4670"), Math.max(...ranges.map(stryMutAct_9fa48("4671") ? () => undefined : (stryCov_9fa48("4671"), r => r.to))))
      });
      // A sweep's targets are spread across the file, so their union is not a window: one
      // live check reported 143 of 190 mutants "in range", took four minutes, found
      // nothing, and the fallback then paid for a whole-file run on top. Past half the
      // file the window has stopped being cheaper than the thing it defers, and the whole
      // run answers more — the score and the complete survivor list, which a range cannot.
      // A single target always gets its window — that is the case it was built for and
      // it is measured at 1s against 194s. For a BATCH the question is not how many LINES
      // the union spans but how many MUTANTS it re-tests: live, a union of 65 lines held
      // 131 of a file's 190 mutants, so eleven "windows" each re-tested most of the file
      // and seven whole-file runs happened on top when they found nothing. Lines are not
      // the cost.
      const known = stryMutAct_9fa48("4674") ? mutantStore.all(file) && [] : stryMutAct_9fa48("4673") ? false : stryMutAct_9fa48("4672") ? true : (stryCov_9fa48("4672", "4673", "4674"), mutantStore.all(file) || (stryMutAct_9fa48("4675") ? ["Stryker was here"] : (stryCov_9fa48("4675"), [])));
      const inUnion = stryMutAct_9fa48("4676") ? known.length : (stryCov_9fa48("4676"), known.filter(stryMutAct_9fa48("4677") ? () => undefined : (stryCov_9fa48("4677"), m => stryMutAct_9fa48("4680") ? m.line >= union.from || m.line <= union.to : stryMutAct_9fa48("4679") ? false : stryMutAct_9fa48("4678") ? true : (stryCov_9fa48("4678", "4679", "4680"), (stryMutAct_9fa48("4683") ? m.line < union.from : stryMutAct_9fa48("4682") ? m.line > union.from : stryMutAct_9fa48("4681") ? true : (stryCov_9fa48("4681", "4682", "4683"), m.line >= union.from)) && (stryMutAct_9fa48("4686") ? m.line > union.to : stryMutAct_9fa48("4685") ? m.line < union.to : stryMutAct_9fa48("4684") ? true : (stryCov_9fa48("4684", "4685", "4686"), m.line <= union.to))))).length);
      const wide = stryMutAct_9fa48("4689") ? !!batch && batch.length > 1 && known.length > 0 || inUnion > known.length * 0.5 : stryMutAct_9fa48("4688") ? false : stryMutAct_9fa48("4687") ? true : (stryCov_9fa48("4687", "4688", "4689"), (stryMutAct_9fa48("4691") ? !!batch && batch.length > 1 || known.length > 0 : stryMutAct_9fa48("4690") ? true : (stryCov_9fa48("4690", "4691"), (stryMutAct_9fa48("4693") ? !!batch || batch.length > 1 : stryMutAct_9fa48("4692") ? true : (stryCov_9fa48("4692", "4693"), (stryMutAct_9fa48("4694") ? !batch : (stryCov_9fa48("4694"), !(stryMutAct_9fa48("4695") ? batch : (stryCov_9fa48("4695"), !batch)))) && (stryMutAct_9fa48("4698") ? batch.length <= 1 : stryMutAct_9fa48("4697") ? batch.length >= 1 : stryMutAct_9fa48("4696") ? true : (stryCov_9fa48("4696", "4697", "4698"), batch.length > 1)))) && (stryMutAct_9fa48("4701") ? known.length <= 0 : stryMutAct_9fa48("4700") ? known.length >= 0 : stryMutAct_9fa48("4699") ? true : (stryCov_9fa48("4699", "4700", "4701"), known.length > 0)))) && (stryMutAct_9fa48("4704") ? inUnion <= known.length * 0.5 : stryMutAct_9fa48("4703") ? inUnion >= known.length * 0.5 : stryMutAct_9fa48("4702") ? true : (stryCov_9fa48("4702", "4703", "4704"), inUnion > (stryMutAct_9fa48("4705") ? known.length / 0.5 : (stryCov_9fa48("4705"), known.length * 0.5)))));
      const range = wide ? null : union;
      const inRange = stryMutAct_9fa48("4706") ? () => undefined : (stryCov_9fa48("4706"), (() => {
        const inRange = m => stryMutAct_9fa48("4709") ? !range && (m.line ?? 0) >= range.from && (m.line ?? 0) <= range.to : stryMutAct_9fa48("4708") ? false : stryMutAct_9fa48("4707") ? true : (stryCov_9fa48("4707", "4708", "4709"), (stryMutAct_9fa48("4710") ? range : (stryCov_9fa48("4710"), !range)) || (stryMutAct_9fa48("4712") ? (m.line ?? 0) >= range.from || (m.line ?? 0) <= range.to : stryMutAct_9fa48("4711") ? false : (stryCov_9fa48("4711", "4712"), (stryMutAct_9fa48("4715") ? (m.line ?? 0) < range.from : stryMutAct_9fa48("4714") ? (m.line ?? 0) > range.from : stryMutAct_9fa48("4713") ? true : (stryCov_9fa48("4713", "4714", "4715"), (stryMutAct_9fa48("4716") ? m.line && 0 : (stryCov_9fa48("4716"), m.line ?? 0)) >= range.from)) && (stryMutAct_9fa48("4719") ? (m.line ?? 0) > range.to : stryMutAct_9fa48("4718") ? (m.line ?? 0) < range.to : stryMutAct_9fa48("4717") ? true : (stryCov_9fa48("4717", "4718", "4719"), (stryMutAct_9fa48("4720") ? m.line && 0 : (stryCov_9fa48("4720"), m.line ?? 0)) <= range.to)))));
        return inRange;
      })());
      const before = stryMutAct_9fa48("4721") ? f.survivedTotal && (f.lastSurvived || []).length : (stryCov_9fa48("4721"), f.survivedTotal ?? (stryMutAct_9fa48("4724") ? f.lastSurvived && [] : stryMutAct_9fa48("4723") ? false : stryMutAct_9fa48("4722") ? true : (stryCov_9fa48("4722", "4723", "4724"), f.lastSurvived || (stryMutAct_9fa48("4725") ? ["Stryker was here"] : (stryCov_9fa48("4725"), [])))).length);
      const beforeScore = stryMutAct_9fa48("4726") ? f.mutation && 0 : (stryCov_9fa48("4726"), f.mutation ?? 0);
      let killedTarget = stryMutAct_9fa48("4727") ? true : (stryCov_9fa48("4727"), false),
        killedCount = 0,
        scoreRose = stryMutAct_9fa48("4728") ? true : (stryCov_9fa48("4728"), false),
        note = stryMutAct_9fa48("4729") ? "Stryker was here!" : (stryCov_9fa48("4729"), ''),
        fullRun = stryMutAct_9fa48("4730") ? true : (stryCov_9fa48("4730"), false);
      if (stryMutAct_9fa48("4732") ? false : stryMutAct_9fa48("4731") ? true : (stryCov_9fa48("4731", "4732"), wide)) fullRun = stryMutAct_9fa48("4733") ? false : (stryCov_9fa48("4733"), true);
      try {
        if (stryMutAct_9fa48("4734")) {
          {}
        } else {
          stryCov_9fa48("4734");
          if (stryMutAct_9fa48("4736") ? false : stryMutAct_9fa48("4735") ? true : (stryCov_9fa48("4735", "4736"), wide)) throw new Error(stryMutAct_9fa48("4737") ? "" : (stryCov_9fa48("4737"), 'window skipped: the union spans most of the file'));
          const r = await stryker.runStryker(file, stryMutAct_9fa48("4738") ? {} : (stryCov_9fa48("4738"), {
            range
          }));
          // A window with no mutants is not a measurement: an empty survivor list would
          // read as "everything in it died" — the trap that once scored one test as 112.
          if (stryMutAct_9fa48("4741") ? r.noTests && !r.totalMutants : stryMutAct_9fa48("4740") ? false : stryMutAct_9fa48("4739") ? true : (stryCov_9fa48("4739", "4740", "4741"), r.noTests || (stryMutAct_9fa48("4742") ? r.totalMutants : (stryCov_9fa48("4742"), !r.totalMutants)))) throw new Error(stryMutAct_9fa48("4743") ? "" : (stryCov_9fa48("4743"), 'window measured nothing'));
          const alive = stryMutAct_9fa48("4746") ? (r.survivedAll || r.survived) && [] : stryMutAct_9fa48("4745") ? false : stryMutAct_9fa48("4744") ? true : (stryCov_9fa48("4744", "4745", "4746"), (stryMutAct_9fa48("4748") ? r.survivedAll && r.survived : stryMutAct_9fa48("4747") ? false : (stryCov_9fa48("4747", "4748"), r.survivedAll || r.survived)) || (stryMutAct_9fa48("4749") ? ["Stryker was here"] : (stryCov_9fa48("4749"), [])));
          killedTarget = stryMutAct_9fa48("4750") ? alive.some(x => mutantsMod.sameMutant(x, mutant)) : (stryCov_9fa48("4750"), !(stryMutAct_9fa48("4751") ? alive.every(x => mutantsMod.sameMutant(x, mutant)) : (stryCov_9fa48("4751"), alive.some(stryMutAct_9fa48("4752") ? () => undefined : (stryCov_9fa48("4752"), x => mutantsMod.sameMutant(x, mutant))))));
          // per-target verdict: which of the ones we AIMED at actually died
          deadTargets = stryMutAct_9fa48("4753") ? batch || [mutant] : (stryCov_9fa48("4753"), (stryMutAct_9fa48("4756") ? batch && [mutant] : stryMutAct_9fa48("4755") ? false : stryMutAct_9fa48("4754") ? true : (stryCov_9fa48("4754", "4755", "4756"), batch || (stryMutAct_9fa48("4757") ? [] : (stryCov_9fa48("4757"), [mutant])))).filter(stryMutAct_9fa48("4758") ? () => undefined : (stryCov_9fa48("4758"), m => stryMutAct_9fa48("4759") ? alive.some(x => mutantsMod.sameMutant(x, m)) : (stryCov_9fa48("4759"), !(stryMutAct_9fa48("4760") ? alive.every(x => mutantsMod.sameMutant(x, m)) : (stryCov_9fa48("4760"), alive.some(stryMutAct_9fa48("4761") ? () => undefined : (stryCov_9fa48("4761"), x => mutantsMod.sameMutant(x, m)))))))));
          const nowDead = stryMutAct_9fa48("4763") ? (f.lastSurvived || []).filter(m => !alive.some(x => mutantsMod.sameMutant(x, m))) : stryMutAct_9fa48("4762") ? (f.lastSurvived || []).filter(inRange) : (stryCov_9fa48("4762", "4763"), (stryMutAct_9fa48("4766") ? f.lastSurvived && [] : stryMutAct_9fa48("4765") ? false : stryMutAct_9fa48("4764") ? true : (stryCov_9fa48("4764", "4765", "4766"), f.lastSurvived || (stryMutAct_9fa48("4767") ? ["Stryker was here"] : (stryCov_9fa48("4767"), [])))).filter(inRange).filter(stryMutAct_9fa48("4768") ? () => undefined : (stryCov_9fa48("4768"), m => stryMutAct_9fa48("4769") ? alive.some(x => mutantsMod.sameMutant(x, m)) : (stryCov_9fa48("4769"), !(stryMutAct_9fa48("4770") ? alive.every(x => mutantsMod.sameMutant(x, m)) : (stryCov_9fa48("4770"), alive.some(stryMutAct_9fa48("4771") ? () => undefined : (stryCov_9fa48("4771"), x => mutantsMod.sameMutant(x, m)))))))));
          if (stryMutAct_9fa48("4774") ? killedTarget && nowDead.length : stryMutAct_9fa48("4773") ? false : stryMutAct_9fa48("4772") ? true : (stryCov_9fa48("4772", "4773", "4774"), killedTarget || nowDead.length)) {
            if (stryMutAct_9fa48("4775")) {
              {}
            } else {
              stryCov_9fa48("4775");
              killedCount = stryMutAct_9fa48("4778") ? nowDead.length && 1 : stryMutAct_9fa48("4777") ? false : stryMutAct_9fa48("4776") ? true : (stryCov_9fa48("4776", "4777", "4778"), nowDead.length || 1);
              // the queue must lose what this run proved dead, or the next pick attacks a
              // corpse; the whole-file run used to refresh it as a side effect
              const pruned = stryMutAct_9fa48("4779") ? f.lastSurvived || [] : (stryCov_9fa48("4779"), (stryMutAct_9fa48("4782") ? f.lastSurvived && [] : stryMutAct_9fa48("4781") ? false : stryMutAct_9fa48("4780") ? true : (stryCov_9fa48("4780", "4781", "4782"), f.lastSurvived || (stryMutAct_9fa48("4783") ? ["Stryker was here"] : (stryCov_9fa48("4783"), [])))).filter(stryMutAct_9fa48("4784") ? () => undefined : (stryCov_9fa48("4784"), m => stryMutAct_9fa48("4785") ? nowDead.some(d => mutantsMod.sameMutant(d, m)) : (stryCov_9fa48("4785"), !(stryMutAct_9fa48("4786") ? nowDead.every(d => mutantsMod.sameMutant(d, m)) : (stryCov_9fa48("4786"), nowDead.some(stryMutAct_9fa48("4787") ? () => undefined : (stryCov_9fa48("4787"), d => mutantsMod.sameMutant(d, m)))))))));
              const remaining = stryMutAct_9fa48("4788") ? Math.min(0, before - nowDead.length) : (stryCov_9fa48("4788"), Math.max(0, stryMutAct_9fa48("4789") ? before + nowDead.length : (stryCov_9fa48("4789"), before - nowDead.length)));
              S.upsertFile(file, stryMutAct_9fa48("4790") ? {} : (stryCov_9fa48("4790"), {
                lastSurvived: pruned,
                survivedTotal: remaining
              }));
              // A window cannot measure the file's score, but the survivor COUNT is now
              // exact for everything it saw, and the total came from the last whole-file
              // run — so the dashboard gets a real per-attempt figure instead of a blank row.
              const total = f.totalMutants;
              if (stryMutAct_9fa48("4792") ? false : stryMutAct_9fa48("4791") ? true : (stryCov_9fa48("4791", "4792"), total)) {
                if (stryMutAct_9fa48("4793")) {
                  {}
                } else {
                  stryCov_9fa48("4793");
                  const est = round2(stryMutAct_9fa48("4794") ? (total - remaining) / total / 100 : (stryCov_9fa48("4794"), (stryMutAct_9fa48("4795") ? (total - remaining) * total : (stryCov_9fa48("4795"), (stryMutAct_9fa48("4796") ? total + remaining : (stryCov_9fa48("4796"), total - remaining)) / total)) * 100));
                  const cov = stryMutAct_9fa48("4797") ? state.files[file]?.coverageAfter && state.files[file]?.coverage : (stryCov_9fa48("4797"), (stryMutAct_9fa48("4798") ? state.files[file].coverageAfter : (stryCov_9fa48("4798"), state.files[file]?.coverageAfter)) ?? (stryMutAct_9fa48("4799") ? state.files[file].coverage : (stryCov_9fa48("4799"), state.files[file]?.coverage)));
                  const estMac = mac(cov, est);
                  recordMeasurement(file, stryMutAct_9fa48("4800") ? {} : (stryCov_9fa48("4800"), {
                    attemptCoverage: cov,
                    attemptMutation: est,
                    attemptMac: estMac
                  }));
                  if (stryMutAct_9fa48("4804") ? (estMac ?? 0) < (state.files[file]?.attemptMac ?? -1) : stryMutAct_9fa48("4803") ? (estMac ?? 0) > (state.files[file]?.attemptMac ?? -1) : stryMutAct_9fa48("4802") ? false : stryMutAct_9fa48("4801") ? true : (stryCov_9fa48("4801", "4802", "4803", "4804"), (stryMutAct_9fa48("4805") ? estMac && 0 : (stryCov_9fa48("4805"), estMac ?? 0)) >= (stryMutAct_9fa48("4806") ? state.files[file]?.attemptMac && -1 : (stryCov_9fa48("4806"), (stryMutAct_9fa48("4807") ? state.files[file].attemptMac : (stryCov_9fa48("4807"), state.files[file]?.attemptMac)) ?? (stryMutAct_9fa48("4808") ? +1 : (stryCov_9fa48("4808"), -1)))))) {
                    if (stryMutAct_9fa48("4809")) {
                      {}
                    } else {
                      stryCov_9fa48("4809");
                      S.upsertFile(file, stryMutAct_9fa48("4810") ? {} : (stryCov_9fa48("4810"), {
                        attemptCoverage: cov,
                        attemptMutation: est,
                        attemptMac: estMac
                      }));
                    }
                  }
                }
              }
            }
          } else {
            if (stryMutAct_9fa48("4811")) {
              {}
            } else {
              stryCov_9fa48("4811");
              // nothing died where we looked — that is not yet a verdict
              fullRun = stryMutAct_9fa48("4812") ? false : (stryCov_9fa48("4812"), true);
            }
          }
        }
      } catch (e) {
        if (stryMutAct_9fa48("4813")) {
          {}
        } else {
          stryCov_9fa48("4813");
          fullRun = stryMutAct_9fa48("4814") ? false : (stryCov_9fa48("4814"), true);
          note = wide ? stryMutAct_9fa48("4815") ? "Stryker was here!" : (stryCov_9fa48("4815"), '') : (stryMutAct_9fa48("4816") ? "" : (stryCov_9fa48("4816"), 'window check failed: ')) + (stryMutAct_9fa48("4817") ? e.message : (stryCov_9fa48("4817"), e.message.slice(0, 120)));
        }
      }
      if (stryMutAct_9fa48("4819") ? false : stryMutAct_9fa48("4818") ? true : (stryCov_9fa48("4818", "4819"), fullRun)) {
        if (stryMutAct_9fa48("4820")) {
          {}
        } else {
          stryCov_9fa48("4820");
          note = stryMutAct_9fa48("4821") ? "Stryker was here!" : (stryCov_9fa48("4821"), '');
          try {
            if (stryMutAct_9fa48("4822")) {
              {}
            } else {
              stryCov_9fa48("4822");
              const r = await stryker.runStryker(file);
              if (stryMutAct_9fa48("4825") ? r.noTests && r.totalMutants == null : stryMutAct_9fa48("4824") ? false : stryMutAct_9fa48("4823") ? true : (stryCov_9fa48("4823", "4824", "4825"), r.noTests || (stryMutAct_9fa48("4827") ? r.totalMutants != null : stryMutAct_9fa48("4826") ? false : (stryCov_9fa48("4826", "4827"), r.totalMutants == null)))) {
                if (stryMutAct_9fa48("4828")) {
                  {}
                } else {
                  stryCov_9fa48("4828");
                  note = stryMutAct_9fa48("4829") ? "" : (stryCov_9fa48("4829"), 'mutation re-run executed no tests — nothing was measured');
                  throw new Error(note);
                }
              }
              const alive = stryMutAct_9fa48("4832") ? r.survived && [] : stryMutAct_9fa48("4831") ? false : stryMutAct_9fa48("4830") ? true : (stryCov_9fa48("4830", "4831", "4832"), r.survived || (stryMutAct_9fa48("4833") ? ["Stryker was here"] : (stryCov_9fa48("4833"), [])));
              const aliveAll = stryMutAct_9fa48("4836") ? r.survivedAll && alive : stryMutAct_9fa48("4835") ? false : stryMutAct_9fa48("4834") ? true : (stryCov_9fa48("4834", "4835", "4836"), r.survivedAll || alive);
              killedTarget = stryMutAct_9fa48("4837") ? aliveAll.some(x => mutantsMod.sameMutant(x, mutant)) : (stryCov_9fa48("4837"), !(stryMutAct_9fa48("4838") ? aliveAll.every(x => mutantsMod.sameMutant(x, mutant)) : (stryCov_9fa48("4838"), aliveAll.some(stryMutAct_9fa48("4839") ? () => undefined : (stryCov_9fa48("4839"), x => mutantsMod.sameMutant(x, mutant))))));
              deadTargets = stryMutAct_9fa48("4840") ? batch || [mutant] : (stryCov_9fa48("4840"), (stryMutAct_9fa48("4843") ? batch && [mutant] : stryMutAct_9fa48("4842") ? false : stryMutAct_9fa48("4841") ? true : (stryCov_9fa48("4841", "4842", "4843"), batch || (stryMutAct_9fa48("4844") ? [] : (stryCov_9fa48("4844"), [mutant])))).filter(stryMutAct_9fa48("4845") ? () => undefined : (stryCov_9fa48("4845"), m => stryMutAct_9fa48("4846") ? aliveAll.some(x => mutantsMod.sameMutant(x, m)) : (stryCov_9fa48("4846"), !(stryMutAct_9fa48("4847") ? aliveAll.every(x => mutantsMod.sameMutant(x, m)) : (stryCov_9fa48("4847"), aliveAll.some(stryMutAct_9fa48("4848") ? () => undefined : (stryCov_9fa48("4848"), x => mutantsMod.sameMutant(x, m)))))))));
              const afterTotal = stryMutAct_9fa48("4849") ? r.survivedTotal && alive.length : (stryCov_9fa48("4849"), r.survivedTotal ?? alive.length);
              killedCount = stryMutAct_9fa48("4850") ? Math.min(0, before - afterTotal) : (stryCov_9fa48("4850"), Math.max(0, stryMutAct_9fa48("4851") ? before + afterTotal : (stryCov_9fa48("4851"), before - afterTotal)));
              scoreRose = stryMutAct_9fa48("4855") ? (r.score ?? 0) <= beforeScore : stryMutAct_9fa48("4854") ? (r.score ?? 0) >= beforeScore : stryMutAct_9fa48("4853") ? false : stryMutAct_9fa48("4852") ? true : (stryCov_9fa48("4852", "4853", "4854", "4855"), (stryMutAct_9fa48("4856") ? r.score && 0 : (stryCov_9fa48("4856"), r.score ?? 0)) > beforeScore);
              S.upsertFile(file, stryMutAct_9fa48("4857") ? {} : (stryCov_9fa48("4857"), {
                lastSurvived: stryMutAct_9fa48("4858") ? alive : (stryCov_9fa48("4858"), alive.slice(0, 100)),
                survivedTotal: afterTotal,
                mutation: r.score,
                totalMutants: r.totalMutants,
                mac: mac(stryMutAct_9fa48("4859") ? f.coverageAfter && f.coverage : (stryCov_9fa48("4859"), f.coverageAfter ?? f.coverage), r.score)
              }));
              const cov = stryMutAct_9fa48("4860") ? state.files[file]?.coverageAfter && state.files[file]?.coverage : (stryCov_9fa48("4860"), (stryMutAct_9fa48("4861") ? state.files[file].coverageAfter : (stryCov_9fa48("4861"), state.files[file]?.coverageAfter)) ?? (stryMutAct_9fa48("4862") ? state.files[file].coverage : (stryCov_9fa48("4862"), state.files[file]?.coverage)));
              const attemptMac = mac(cov, r.score);
              recordMeasurement(file, stryMutAct_9fa48("4863") ? {} : (stryCov_9fa48("4863"), {
                attemptCoverage: cov,
                attemptMutation: r.score,
                attemptMac
              }));
              if (stryMutAct_9fa48("4867") ? (attemptMac ?? 0) < (state.files[file]?.attemptMac ?? -1) : stryMutAct_9fa48("4866") ? (attemptMac ?? 0) > (state.files[file]?.attemptMac ?? -1) : stryMutAct_9fa48("4865") ? false : stryMutAct_9fa48("4864") ? true : (stryCov_9fa48("4864", "4865", "4866", "4867"), (stryMutAct_9fa48("4868") ? attemptMac && 0 : (stryCov_9fa48("4868"), attemptMac ?? 0)) >= (stryMutAct_9fa48("4869") ? state.files[file]?.attemptMac && -1 : (stryCov_9fa48("4869"), (stryMutAct_9fa48("4870") ? state.files[file].attemptMac : (stryCov_9fa48("4870"), state.files[file]?.attemptMac)) ?? (stryMutAct_9fa48("4871") ? +1 : (stryCov_9fa48("4871"), -1)))))) {
                if (stryMutAct_9fa48("4872")) {
                  {}
                } else {
                  stryCov_9fa48("4872");
                  S.upsertFile(file, stryMutAct_9fa48("4873") ? {} : (stryCov_9fa48("4873"), {
                    attemptCoverage: cov,
                    attemptMutation: r.score,
                    attemptMac
                  }));
                }
              }
            }
          } catch (e) {
            if (stryMutAct_9fa48("4874")) {
              {}
            } else {
              stryCov_9fa48("4874");
              note = stryMutAct_9fa48("4877") ? note && 'mutation re-run failed: ' + e.message.slice(0, 160) : stryMutAct_9fa48("4876") ? false : stryMutAct_9fa48("4875") ? true : (stryCov_9fa48("4875", "4876", "4877"), note || (stryMutAct_9fa48("4878") ? "" : (stryCov_9fa48("4878"), 'mutation re-run failed: ')) + (stryMutAct_9fa48("4879") ? e.message : (stryCov_9fa48("4879"), e.message.slice(0, 160))));
            }
          }
        }
      }

      // A test earns its place if it killed ANYTHING — collateral kills are real
      // improvement even when the chosen target turns out to be equivalent.
      // three independent signals, any of which means the test did real work:
      // the target died, the survivor count fell, or the score rose.
      if (stryMutAct_9fa48("4881") ? false : stryMutAct_9fa48("4880") ? true : (stryCov_9fa48("4880", "4881"), note)) {
        if (stryMutAct_9fa48("4882")) {
          {}
        } else {
          stryCov_9fa48("4882");
          drop();
          miss(note);
          return stryMutAct_9fa48("4883") ? {} : (stryCov_9fa48("4883"), {
            ok: stryMutAct_9fa48("4884") ? false : (stryCov_9fa48("4884"), true),
            killed: stryMutAct_9fa48("4885") ? true : (stryCov_9fa48("4885"), false),
            killedCount: 0,
            retryable: sweep,
            reason: note,
            testPaths
          });
        }
      }
      const worthKeeping = stryMutAct_9fa48("4888") ? (killedTarget || killedCount > 0) && scoreRose : stryMutAct_9fa48("4887") ? false : stryMutAct_9fa48("4886") ? true : (stryCov_9fa48("4886", "4887", "4888"), (stryMutAct_9fa48("4890") ? killedTarget && killedCount > 0 : stryMutAct_9fa48("4889") ? false : (stryCov_9fa48("4889", "4890"), killedTarget || (stryMutAct_9fa48("4893") ? killedCount <= 0 : stryMutAct_9fa48("4892") ? killedCount >= 0 : stryMutAct_9fa48("4891") ? false : (stryCov_9fa48("4891", "4892", "4893"), killedCount > 0)))) || scoreRose);
      // A SWEEP that achieved nothing is not any single mutant's verdict: it wrote one
      // test per SITE, so no individual target ever got a test of its own. Charge
      // nothing, keep the targets on the queue, and tell the caller the single-target
      // attempt is still worth making.
      if (stryMutAct_9fa48("4896") ? sweep || !worthKeeping : stryMutAct_9fa48("4895") ? false : stryMutAct_9fa48("4894") ? true : (stryCov_9fa48("4894", "4895", "4896"), sweep && (stryMutAct_9fa48("4897") ? worthKeeping : (stryCov_9fa48("4897"), !worthKeeping)))) {
        if (stryMutAct_9fa48("4898")) {
          {}
        } else {
          stryCov_9fa48("4898");
          drop();
          S.upsertFile(file, stryMutAct_9fa48("4899") ? {} : (stryCov_9fa48("4899"), {
            mutantAttemptCount: stryMutAct_9fa48("4900") ? (f.mutantAttemptCount || 0) - 1 : (stryCov_9fa48("4900"), (stryMutAct_9fa48("4903") ? f.mutantAttemptCount && 0 : stryMutAct_9fa48("4902") ? false : stryMutAct_9fa48("4901") ? true : (stryCov_9fa48("4901", "4902", "4903"), f.mutantAttemptCount || 0)) + 1)
          }));
          S.event(stryMutAct_9fa48("4904") ? "" : (stryCov_9fa48("4904"), 'improving_mutation'), stryMutAct_9fa48("4905") ? `` : (stryCov_9fa48("4905"), `the sweep killed nothing at ${mutant.mutator} line ${mutant.line} — trying it on its own`));
          return stryMutAct_9fa48("4906") ? {} : (stryCov_9fa48("4906"), {
            ok: stryMutAct_9fa48("4907") ? false : (stryCov_9fa48("4907"), true),
            killed: stryMutAct_9fa48("4908") ? true : (stryCov_9fa48("4908"), false),
            killedCount: 0,
            retryable: stryMutAct_9fa48("4909") ? false : (stryCov_9fa48("4909"), true),
            reason: stryMutAct_9fa48("4910") ? "" : (stryCov_9fa48("4910"), 'no mutant died (batch attempt)'),
            testPaths
          });
        }
      }
      // The TARGET is retired unless it actually died — one shot per mutant, whatever
      // else the test achieved. The failure budget, by contrast, is only charged when
      // the test achieved nothing at all.
      bump(killedTarget, worthKeeping);
      if (stryMutAct_9fa48("4913") ? false : stryMutAct_9fa48("4912") ? true : stryMutAct_9fa48("4911") ? worthKeeping : (stryCov_9fa48("4911", "4912", "4913"), !worthKeeping)) {
        if (stryMutAct_9fa48("4914")) {
          {}
        } else {
          stryCov_9fa48("4914");
          drop();
          S.event(stryMutAct_9fa48("4915") ? "" : (stryCov_9fa48("4915"), 'improving_mutation'), stryMutAct_9fa48("4916") ? `` : (stryCov_9fa48("4916"), `discarded: ${mutant.mutator} at line ${mutant.line} — nothing died${note ? (stryMutAct_9fa48("4917") ? "" : (stryCov_9fa48("4917"), ' (')) + note + (stryMutAct_9fa48("4918") ? "" : (stryCov_9fa48("4918"), ')')) : stryMutAct_9fa48("4919") ? "Stryker was here!" : (stryCov_9fa48("4919"), '')}`));
          return stryMutAct_9fa48("4920") ? {} : (stryCov_9fa48("4920"), {
            ok: stryMutAct_9fa48("4921") ? false : (stryCov_9fa48("4921"), true),
            killed: stryMutAct_9fa48("4922") ? true : (stryCov_9fa48("4922"), false),
            killedCount: 0,
            retryable: stryMutAct_9fa48("4923") ? true : (stryCov_9fa48("4923"), false),
            reason: stryMutAct_9fa48("4926") ? note && 'no mutant died' : stryMutAct_9fa48("4925") ? false : stryMutAct_9fa48("4924") ? true : (stryCov_9fa48("4924", "4925", "4926"), note || (stryMutAct_9fa48("4927") ? "" : (stryCov_9fa48("4927"), 'no mutant died'))),
            testPaths
          });
        }
      }
      const collateral = stryMutAct_9fa48("4928") ? Math.min(0, killedCount - (killedTarget ? 1 : 0)) : (stryCov_9fa48("4928"), Math.max(0, stryMutAct_9fa48("4929") ? killedCount + (killedTarget ? 1 : 0) : (stryCov_9fa48("4929"), killedCount - (killedTarget ? 1 : 0))));
      S.event(stryMutAct_9fa48("4930") ? "" : (stryCov_9fa48("4930"), 'improving_mutation'), (stryMutAct_9fa48("4931") ? `` : (stryCov_9fa48("4931"), `KILLED ${killedCount} mutant(s) — target ${mutant.mutator} at line ${mutant.line} `)) + (stryMutAct_9fa48("4932") ? `` : (stryCov_9fa48("4932"), `${killedTarget ? stryMutAct_9fa48("4933") ? "" : (stryCov_9fa48("4933"), 'died') : stryMutAct_9fa48("4934") ? "" : (stryCov_9fa48("4934"), 'SURVIVED but the test killed others')}${collateral ? stryMutAct_9fa48("4935") ? `` : (stryCov_9fa48("4935"), `, ${collateral} collateral`) : stryMutAct_9fa48("4936") ? "Stryker was here!" : (stryCov_9fa48("4936"), '')} `)) + (stryMutAct_9fa48("4937") ? `` : (stryCov_9fa48("4937"), `— keeping ${testPaths.join(stryMutAct_9fa48("4938") ? "" : (stryCov_9fa48("4938"), ', '))} (${stryMutAct_9fa48("4939") ? state.files[file].survivedTotal && (f.lastSurvived || []).length : (stryCov_9fa48("4939"), state.files[file].survivedTotal ?? (stryMutAct_9fa48("4942") ? f.lastSurvived && [] : stryMutAct_9fa48("4941") ? false : stryMutAct_9fa48("4940") ? true : (stryCov_9fa48("4940", "4941", "4942"), f.lastSurvived || (stryMutAct_9fa48("4943") ? ["Stryker was here"] : (stryCov_9fa48("4943"), [])))).length)} survivor(s) left)`)));
      return stryMutAct_9fa48("4944") ? {} : (stryCov_9fa48("4944"), {
        ok: stryMutAct_9fa48("4945") ? false : (stryCov_9fa48("4945"), true),
        killed: stryMutAct_9fa48("4946") ? false : (stryCov_9fa48("4946"), true),
        killedTarget,
        killedCount,
        collateral,
        retryable: stryMutAct_9fa48("4947") ? true : (stryCov_9fa48("4947"), false),
        killedTargets: deadTargets.length,
        aimedAt: (stryMutAct_9fa48("4950") ? batch && [mutant] : stryMutAct_9fa48("4949") ? false : stryMutAct_9fa48("4948") ? true : (stryCov_9fa48("4948", "4949", "4950"), batch || (stryMutAct_9fa48("4951") ? [] : (stryCov_9fa48("4951"), [mutant])))).length,
        testPaths,
        killedSoFar: stryMutAct_9fa48("4954") ? state.files[file].mutantsKilled && 0 : stryMutAct_9fa48("4953") ? false : stryMutAct_9fa48("4952") ? true : (stryCov_9fa48("4952", "4953", "4954"), state.files[file].mutantsKilled || 0)
      });
    }
  },
  'POST /api/verify': async (q, body) => {
    if (stryMutAct_9fa48("4955")) {
      {}
    } else {
      stryCov_9fa48("4955");
      needRun();
      const file = body.file;
      if (stryMutAct_9fa48("4958") ? !file && !state.files[file] : stryMutAct_9fa48("4957") ? false : stryMutAct_9fa48("4956") ? true : (stryCov_9fa48("4956", "4957", "4958"), (stryMutAct_9fa48("4959") ? file : (stryCov_9fa48("4959"), !file)) || (stryMutAct_9fa48("4960") ? state.files[file] : (stryCov_9fa48("4960"), !state.files[file])))) throw new Error((stryMutAct_9fa48("4961") ? "" : (stryCov_9fa48("4961"), 'unknown file: ')) + file);
      const f = state.files[file];
      S.setStage(stryMutAct_9fa48("4962") ? "" : (stryCov_9fa48("4962"), 'improving_mac'), stryMutAct_9fa48("4963") ? `` : (stryCov_9fa48("4963"), `verifying MAC improvement for ${file}`));
      try {
        if (stryMutAct_9fa48("4964")) {
          {}
        } else {
          stryCov_9fa48("4964");
          // A round that wrote nothing has nothing to measure — and measuring it anyway
          // costs a suite run, a coverage run and a mutation run (three minutes on a
          // real repo) to rediscover that. This happens for real: the bootstrap returns
          // no parseable answer, the mutant loop keeps nothing, and the file is verified
          // against itself.
          const changedNow = await pr.changedFiles();
          if (stryMutAct_9fa48("4967") ? false : stryMutAct_9fa48("4966") ? true : stryMutAct_9fa48("4965") ? changedNow.length : (stryCov_9fa48("4965", "4966", "4967"), !changedNow.length)) {
            if (stryMutAct_9fa48("4968")) {
              {}
            } else {
              stryCov_9fa48("4968");
              S.event(stryMutAct_9fa48("4969") ? "" : (stryCov_9fa48("4969"), 'improving_mac'), stryMutAct_9fa48("4970") ? `` : (stryCov_9fa48("4970"), `nothing to verify for ${file} — this round changed no files`));
              return stryMutAct_9fa48("4971") ? {} : (stryCov_9fa48("4971"), {
                ok: stryMutAct_9fa48("4972") ? false : (stryCov_9fa48("4972"), true),
                improved: stryMutAct_9fa48("4973") ? true : (stryCov_9fa48("4973"), false),
                improvedAny: stryMutAct_9fa48("4974") ? true : (stryCov_9fa48("4974"), false),
                degradedAny: stryMutAct_9fa48("4975") ? true : (stryCov_9fa48("4975"), false),
                testsGreen: stryMutAct_9fa48("4976") ? false : (stryCov_9fa48("4976"), true),
                pendingSites: mutantStore.pending(file).length,
                reason: stryMutAct_9fa48("4977") ? "" : (stryCov_9fa48("4977"), 'no changes in this round'),
                rounds: stryMutAct_9fa48("4980") ? f.rounds && 0 : stryMutAct_9fa48("4979") ? false : stryMutAct_9fa48("4978") ? true : (stryCov_9fa48("4978", "4979", "4980"), f.rounds || 0),
                file
              });
            }
          }
          // ONE measurement pass: runCoverage runs the whole suite already, so a separate
          // runTests here was a second full suite run over an unchanged tree.
          const cov = await coverage.runCoverage();
          if (stryMutAct_9fa48("4983") ? cov.exitCode === 0 : stryMutAct_9fa48("4982") ? false : stryMutAct_9fa48("4981") ? true : (stryCov_9fa48("4981", "4982", "4983"), cov.exitCode !== 0)) {
            if (stryMutAct_9fa48("4984")) {
              {}
            } else {
              stryCov_9fa48("4984");
              return stryMutAct_9fa48("4985") ? {} : (stryCov_9fa48("4985"), {
                ok: stryMutAct_9fa48("4986") ? false : (stryCov_9fa48("4986"), true),
                improved: stryMutAct_9fa48("4987") ? true : (stryCov_9fa48("4987"), false),
                testsGreen: stryMutAct_9fa48("4988") ? true : (stryCov_9fa48("4988"), false),
                reason: stryMutAct_9fa48("4989") ? "" : (stryCov_9fa48("4989"), 'full suite red'),
                summary: cov.summary,
                file
              });
            }
          }
          S.setStage(stryMutAct_9fa48("4990") ? "" : (stryCov_9fa48("4990"), 'improving_mac'), stryMutAct_9fa48("4991") ? `` : (stryCov_9fa48("4991"), `re-measuring mutation score for ${file}`));
          const st = await stryker.runStryker(file);
          const coverageAfter = state.files[file].coverage;
          const macAfter = mac(coverageAfter, st.score);
          S.upsertFile(file, stryMutAct_9fa48("4992") ? {} : (stryCov_9fa48("4992"), {
            mutation: st.score,
            mac: macAfter,
            macAfter,
            coverageAfter,
            mutationAfter: st.score,
            // this is the list the NEXT round's mutant loop works from — truncating it
            // to 10 silently caps how much of a big file a run can ever reach
            lastSurvived: stryMutAct_9fa48("4993") ? st.survived || [] : (stryCov_9fa48("4993"), (stryMutAct_9fa48("4996") ? st.survived && [] : stryMutAct_9fa48("4995") ? false : stryMutAct_9fa48("4994") ? true : (stryCov_9fa48("4994", "4995", "4996"), st.survived || (stryMutAct_9fa48("4997") ? ["Stryker was here"] : (stryCov_9fa48("4997"), [])))).slice(0, 100)),
            survivedTotal: stryMutAct_9fa48("4998") ? st.survivedTotal && (st.survived || []).length : (stryCov_9fa48("4998"), st.survivedTotal ?? (stryMutAct_9fa48("5001") ? st.survived && [] : stryMutAct_9fa48("5000") ? false : stryMutAct_9fa48("4999") ? true : (stryCov_9fa48("4999", "5000", "5001"), st.survived || (stryMutAct_9fa48("5002") ? ["Stryker was here"] : (stryCov_9fa48("5002"), [])))).length),
            survivorsStale: stryMutAct_9fa48("5003") ? true : (stryCov_9fa48("5003"), false)
          }));
          state.run.result.coveragePct = cov.totalPct;
          state.run.result.mutationPct = st.score;
          state.run.result.mac = mac(cov.totalPct, st.score);
          S.save();
          // ONE mutation run has just told us which test file killed what. A file that
          // killed nothing is dead weight by D12's definition, and this is the only moment
          // we can say so without paying for another measurement.
          if (stryMutAct_9fa48("5005") ? false : stryMutAct_9fa48("5004") ? true : (stryCov_9fa48("5004", "5005"), st.report)) {
            if (stryMutAct_9fa48("5006")) {
              {}
            } else {
              stryCov_9fa48("5006");
              const byFile = mutantsMod.killsByTestFile(st.report);
              const ours = stryMutAct_9fa48("5020") ? /\.(kill-L\d+-[a-z0-9-]+|kill-batch-[a-z0-9]+|mac-cov(-r\d+)?)\.test\.[cm]?[jt]sx$/ : stryMutAct_9fa48("5019") ? /\.(kill-L\d+-[a-z0-9-]+|kill-batch-[a-z0-9]+|mac-cov(-r\d+)?)\.test\.[cm]?[^jt]sx?$/ : stryMutAct_9fa48("5018") ? /\.(kill-L\d+-[a-z0-9-]+|kill-batch-[a-z0-9]+|mac-cov(-r\d+)?)\.test\.[^cm]?[jt]sx?$/ : stryMutAct_9fa48("5017") ? /\.(kill-L\d+-[a-z0-9-]+|kill-batch-[a-z0-9]+|mac-cov(-r\d+)?)\.test\.[cm][jt]sx?$/ : stryMutAct_9fa48("5016") ? /\.(kill-L\d+-[a-z0-9-]+|kill-batch-[a-z0-9]+|mac-cov(-r\D+)?)\.test\.[cm]?[jt]sx?$/ : stryMutAct_9fa48("5015") ? /\.(kill-L\d+-[a-z0-9-]+|kill-batch-[a-z0-9]+|mac-cov(-r\d)?)\.test\.[cm]?[jt]sx?$/ : stryMutAct_9fa48("5014") ? /\.(kill-L\d+-[a-z0-9-]+|kill-batch-[a-z0-9]+|mac-cov(-r\d+))\.test\.[cm]?[jt]sx?$/ : stryMutAct_9fa48("5013") ? /\.(kill-L\d+-[a-z0-9-]+|kill-batch-[^a-z0-9]+|mac-cov(-r\d+)?)\.test\.[cm]?[jt]sx?$/ : stryMutAct_9fa48("5012") ? /\.(kill-L\d+-[a-z0-9-]+|kill-batch-[a-z0-9]|mac-cov(-r\d+)?)\.test\.[cm]?[jt]sx?$/ : stryMutAct_9fa48("5011") ? /\.(kill-L\d+-[^a-z0-9-]+|kill-batch-[a-z0-9]+|mac-cov(-r\d+)?)\.test\.[cm]?[jt]sx?$/ : stryMutAct_9fa48("5010") ? /\.(kill-L\d+-[a-z0-9-]|kill-batch-[a-z0-9]+|mac-cov(-r\d+)?)\.test\.[cm]?[jt]sx?$/ : stryMutAct_9fa48("5009") ? /\.(kill-L\D+-[a-z0-9-]+|kill-batch-[a-z0-9]+|mac-cov(-r\d+)?)\.test\.[cm]?[jt]sx?$/ : stryMutAct_9fa48("5008") ? /\.(kill-L\d-[a-z0-9-]+|kill-batch-[a-z0-9]+|mac-cov(-r\d+)?)\.test\.[cm]?[jt]sx?$/ : stryMutAct_9fa48("5007") ? /\.(kill-L\d+-[a-z0-9-]+|kill-batch-[a-z0-9]+|mac-cov(-r\d+)?)\.test\.[cm]?[jt]sx?/ : (stryCov_9fa48("5007", "5008", "5009", "5010", "5011", "5012", "5013", "5014", "5015", "5016", "5017", "5018", "5019", "5020"), /\.(kill-L\d+-[a-z0-9-]+|kill-batch-[a-z0-9]+|mac-cov(-r\d+)?)\.test\.[cm]?[jt]sx?$/);
              for (const [testFile, kills] of Object.entries(byFile)) {
                if (stryMutAct_9fa48("5021")) {
                  {}
                } else {
                  stryCov_9fa48("5021");
                  if (stryMutAct_9fa48("5024") ? kills > 0 && !ours.test(testFile) : stryMutAct_9fa48("5023") ? false : stryMutAct_9fa48("5022") ? true : (stryCov_9fa48("5022", "5023", "5024"), (stryMutAct_9fa48("5027") ? kills <= 0 : stryMutAct_9fa48("5026") ? kills >= 0 : stryMutAct_9fa48("5025") ? false : (stryCov_9fa48("5025", "5026", "5027"), kills > 0)) || (stryMutAct_9fa48("5028") ? ours.test(testFile) : (stryCov_9fa48("5028"), !ours.test(testFile))))) continue;
                  // the coverage bootstrap is exempt: its job is to make the file execute at
                  // all, and it is measured by coverage rather than by kills
                  if (stryMutAct_9fa48("5030") ? false : stryMutAct_9fa48("5029") ? true : (stryCov_9fa48("5029", "5030"), /mac-cov/.test(testFile))) continue;
                  if (stryMutAct_9fa48("5032") ? false : stryMutAct_9fa48("5031") ? true : (stryCov_9fa48("5031", "5032"), repo.deleteTestFile(testFile))) {
                    if (stryMutAct_9fa48("5033")) {
                      {}
                    } else {
                      stryCov_9fa48("5033");
                      S.event(stryMutAct_9fa48("5034") ? "" : (stryCov_9fa48("5034"), 'improving_mac'), stryMutAct_9fa48("5035") ? `` : (stryCov_9fa48("5035"), `dropped ${testFile}: the mutation run credits it with no kills`));
                    }
                  }
                }
              }
            }
          }
          // the whole-file run at round end is the most authoritative survivor list there
          // is; the queue takes it, keeping what each site has already been through
          mutantStore.replace(file, stryMutAct_9fa48("5038") ? (st.survivedAll || st.survived) && [] : stryMutAct_9fa48("5037") ? false : stryMutAct_9fa48("5036") ? true : (stryCov_9fa48("5036", "5037", "5038"), (stryMutAct_9fa48("5040") ? st.survivedAll && st.survived : stryMutAct_9fa48("5039") ? false : (stryCov_9fa48("5039", "5040"), st.survivedAll || st.survived)) || (stryMutAct_9fa48("5041") ? ["Stryker was here"] : (stryCov_9fa48("5041"), []))));
          if (stryMutAct_9fa48("5043") ? false : stryMutAct_9fa48("5042") ? true : (stryCov_9fa48("5042", "5043"), st.report)) {}
          const diff = await pr.diffAgainstBase();
          const changed = await pr.changedFiles();
          // round criterion: keep the round iff ≥1 metric improves AND none degrades
          const rb = stryMutAct_9fa48("5046") ? f.roundBase && {
            coverage: f.coverageBefore,
            mutation: f.mutationBefore,
            mac: f.macBefore
          } : stryMutAct_9fa48("5045") ? false : stryMutAct_9fa48("5044") ? true : (stryCov_9fa48("5044", "5045", "5046"), f.roundBase || (stryMutAct_9fa48("5047") ? {} : (stryCov_9fa48("5047"), {
            coverage: f.coverageBefore,
            mutation: f.mutationBefore,
            mac: f.macBefore
          })));
          // Rounds exist to keep improving while improvement is possible. One shot per
          // mutant means that after the first round nothing is untried, so a second round
          // re-measures a settled file: five files, five times, +0.00 MAC — and up to 25
          // minutes each. The gate is therefore a fact about the queue rather than a
          // constant, so retries returning would bring rounds back with them.
          const pendingSites = mutantStore.pending(file).length;
          const improvedAny = stryMutAct_9fa48("5050") ? changed.length > 0 || (coverageAfter ?? 0) > (rb.coverage ?? 0) || (st.score ?? 0) > (rb.mutation ?? 0) || (macAfter ?? 0) > (rb.mac ?? 0) : stryMutAct_9fa48("5049") ? false : stryMutAct_9fa48("5048") ? true : (stryCov_9fa48("5048", "5049", "5050"), (stryMutAct_9fa48("5053") ? changed.length <= 0 : stryMutAct_9fa48("5052") ? changed.length >= 0 : stryMutAct_9fa48("5051") ? true : (stryCov_9fa48("5051", "5052", "5053"), changed.length > 0)) && (stryMutAct_9fa48("5055") ? ((coverageAfter ?? 0) > (rb.coverage ?? 0) || (st.score ?? 0) > (rb.mutation ?? 0)) && (macAfter ?? 0) > (rb.mac ?? 0) : stryMutAct_9fa48("5054") ? true : (stryCov_9fa48("5054", "5055"), (stryMutAct_9fa48("5057") ? (coverageAfter ?? 0) > (rb.coverage ?? 0) && (st.score ?? 0) > (rb.mutation ?? 0) : stryMutAct_9fa48("5056") ? false : (stryCov_9fa48("5056", "5057"), (stryMutAct_9fa48("5060") ? (coverageAfter ?? 0) <= (rb.coverage ?? 0) : stryMutAct_9fa48("5059") ? (coverageAfter ?? 0) >= (rb.coverage ?? 0) : stryMutAct_9fa48("5058") ? false : (stryCov_9fa48("5058", "5059", "5060"), (stryMutAct_9fa48("5061") ? coverageAfter && 0 : (stryCov_9fa48("5061"), coverageAfter ?? 0)) > (stryMutAct_9fa48("5062") ? rb.coverage && 0 : (stryCov_9fa48("5062"), rb.coverage ?? 0)))) || (stryMutAct_9fa48("5065") ? (st.score ?? 0) <= (rb.mutation ?? 0) : stryMutAct_9fa48("5064") ? (st.score ?? 0) >= (rb.mutation ?? 0) : stryMutAct_9fa48("5063") ? false : (stryCov_9fa48("5063", "5064", "5065"), (stryMutAct_9fa48("5066") ? st.score && 0 : (stryCov_9fa48("5066"), st.score ?? 0)) > (stryMutAct_9fa48("5067") ? rb.mutation && 0 : (stryCov_9fa48("5067"), rb.mutation ?? 0)))))) || (stryMutAct_9fa48("5070") ? (macAfter ?? 0) <= (rb.mac ?? 0) : stryMutAct_9fa48("5069") ? (macAfter ?? 0) >= (rb.mac ?? 0) : stryMutAct_9fa48("5068") ? false : (stryCov_9fa48("5068", "5069", "5070"), (stryMutAct_9fa48("5071") ? macAfter && 0 : (stryCov_9fa48("5071"), macAfter ?? 0)) > (stryMutAct_9fa48("5072") ? rb.mac && 0 : (stryCov_9fa48("5072"), rb.mac ?? 0)))))));
          const degradedAny = stryMutAct_9fa48("5075") ? ((coverageAfter ?? 0) < (rb.coverage ?? 0) || (st.score ?? 0) < (rb.mutation ?? 0)) && (macAfter ?? 0) < (rb.mac ?? 0) : stryMutAct_9fa48("5074") ? false : stryMutAct_9fa48("5073") ? true : (stryCov_9fa48("5073", "5074", "5075"), (stryMutAct_9fa48("5077") ? (coverageAfter ?? 0) < (rb.coverage ?? 0) && (st.score ?? 0) < (rb.mutation ?? 0) : stryMutAct_9fa48("5076") ? false : (stryCov_9fa48("5076", "5077"), (stryMutAct_9fa48("5080") ? (coverageAfter ?? 0) >= (rb.coverage ?? 0) : stryMutAct_9fa48("5079") ? (coverageAfter ?? 0) <= (rb.coverage ?? 0) : stryMutAct_9fa48("5078") ? false : (stryCov_9fa48("5078", "5079", "5080"), (stryMutAct_9fa48("5081") ? coverageAfter && 0 : (stryCov_9fa48("5081"), coverageAfter ?? 0)) < (stryMutAct_9fa48("5082") ? rb.coverage && 0 : (stryCov_9fa48("5082"), rb.coverage ?? 0)))) || (stryMutAct_9fa48("5085") ? (st.score ?? 0) >= (rb.mutation ?? 0) : stryMutAct_9fa48("5084") ? (st.score ?? 0) <= (rb.mutation ?? 0) : stryMutAct_9fa48("5083") ? false : (stryCov_9fa48("5083", "5084", "5085"), (stryMutAct_9fa48("5086") ? st.score && 0 : (stryCov_9fa48("5086"), st.score ?? 0)) < (stryMutAct_9fa48("5087") ? rb.mutation && 0 : (stryCov_9fa48("5087"), rb.mutation ?? 0)))))) || (stryMutAct_9fa48("5090") ? (macAfter ?? 0) >= (rb.mac ?? 0) : stryMutAct_9fa48("5089") ? (macAfter ?? 0) <= (rb.mac ?? 0) : stryMutAct_9fa48("5088") ? false : (stryCov_9fa48("5088", "5089", "5090"), (stryMutAct_9fa48("5091") ? macAfter && 0 : (stryCov_9fa48("5091"), macAfter ?? 0)) < (stryMutAct_9fa48("5092") ? rb.mac && 0 : (stryCov_9fa48("5092"), rb.mac ?? 0)))));
          // no changed files → any measured delta is stryker flakiness, not improvement
          const improved = stryMutAct_9fa48("5095") ? (macAfter ?? 0) > (f.macBefore ?? 0) || changed.length > 0 : stryMutAct_9fa48("5094") ? false : stryMutAct_9fa48("5093") ? true : (stryCov_9fa48("5093", "5094", "5095"), (stryMutAct_9fa48("5098") ? (macAfter ?? 0) <= (f.macBefore ?? 0) : stryMutAct_9fa48("5097") ? (macAfter ?? 0) >= (f.macBefore ?? 0) : stryMutAct_9fa48("5096") ? true : (stryCov_9fa48("5096", "5097", "5098"), (stryMutAct_9fa48("5099") ? macAfter && 0 : (stryCov_9fa48("5099"), macAfter ?? 0)) > (stryMutAct_9fa48("5100") ? f.macBefore && 0 : (stryCov_9fa48("5100"), f.macBefore ?? 0)))) && (stryMutAct_9fa48("5103") ? changed.length <= 0 : stryMutAct_9fa48("5102") ? changed.length >= 0 : stryMutAct_9fa48("5101") ? true : (stryCov_9fa48("5101", "5102", "5103"), changed.length > 0)));
          // remember the best result any attempt reached, even if it is not kept —
          // "we tried and got this far" is information worth showing
          const prev = stryMutAct_9fa48("5106") ? measured()[file] && {} : stryMutAct_9fa48("5105") ? false : stryMutAct_9fa48("5104") ? true : (stryCov_9fa48("5104", "5105", "5106"), measured()[file] || {});
          if (stryMutAct_9fa48("5110") ? (macAfter ?? 0) < (prev.attemptMac ?? -1) : stryMutAct_9fa48("5109") ? (macAfter ?? 0) > (prev.attemptMac ?? -1) : stryMutAct_9fa48("5108") ? false : stryMutAct_9fa48("5107") ? true : (stryCov_9fa48("5107", "5108", "5109", "5110"), (stryMutAct_9fa48("5111") ? macAfter && 0 : (stryCov_9fa48("5111"), macAfter ?? 0)) >= (stryMutAct_9fa48("5112") ? prev.attemptMac && -1 : (stryCov_9fa48("5112"), prev.attemptMac ?? (stryMutAct_9fa48("5113") ? +1 : (stryCov_9fa48("5113"), -1)))))) {
            if (stryMutAct_9fa48("5114")) {
              {}
            } else {
              stryCov_9fa48("5114");
              recordMeasurement(file, stryMutAct_9fa48("5115") ? {} : (stryCov_9fa48("5115"), {
                attemptCoverage: coverageAfter,
                attemptMutation: st.score,
                attemptMac: macAfter
              }));
            }
          }
          S.event(stryMutAct_9fa48("5116") ? "" : (stryCov_9fa48("5116"), 'improving_mac'), stryMutAct_9fa48("5117") ? `` : (stryCov_9fa48("5117"), `round ${stryMutAct_9fa48("5118") ? (f.rounds || 0) - 1 : (stryCov_9fa48("5118"), (stryMutAct_9fa48("5121") ? f.rounds && 0 : stryMutAct_9fa48("5120") ? false : stryMutAct_9fa48("5119") ? true : (stryCov_9fa48("5119", "5120", "5121"), f.rounds || 0)) + 1)} of ${file}: cov ${rb.coverage}→${coverageAfter}, mut ${rb.mutation}→${st.score}, mac ${rb.mac}→${macAfter} — ${(stryMutAct_9fa48("5124") ? improvedAny || !degradedAny : stryMutAct_9fa48("5123") ? false : stryMutAct_9fa48("5122") ? true : (stryCov_9fa48("5122", "5123", "5124"), improvedAny && (stryMutAct_9fa48("5125") ? degradedAny : (stryCov_9fa48("5125"), !degradedAny)))) ? stryMutAct_9fa48("5126") ? `` : (stryCov_9fa48("5126"), `PROGRESS (keep, ${pendingSites} site(s) left untried)`) : degradedAny ? stryMutAct_9fa48("5127") ? "" : (stryCov_9fa48("5127"), 'DEGRADED (drop)') : stryMutAct_9fa48("5128") ? "" : (stryCov_9fa48("5128"), 'STALE (drop)')}`));
          return stryMutAct_9fa48("5129") ? {} : (stryCov_9fa48("5129"), {
            ok: stryMutAct_9fa48("5130") ? false : (stryCov_9fa48("5130"), true),
            file,
            testsGreen: stryMutAct_9fa48("5131") ? false : (stryCov_9fa48("5131"), true),
            coverageBefore: f.coverageBefore,
            coverageAfter,
            mutationBefore: f.mutationBefore,
            mutationAfter: st.score,
            macBefore: f.macBefore,
            macAfter,
            improved,
            improvedAny,
            degradedAny,
            pendingSites,
            rounds: stryMutAct_9fa48("5134") ? f.rounds && 0 : stryMutAct_9fa48("5133") ? false : stryMutAct_9fa48("5132") ? true : (stryCov_9fa48("5132", "5133", "5134"), f.rounds || 0),
            totalCoverage: cov.totalPct,
            changedFiles: changed,
            diff: stryMutAct_9fa48("5135") ? diff : (stryCov_9fa48("5135"), diff.slice(0, 30000)),
            branch: f.branch
          });
        }
      } catch (e) {
        if (stryMutAct_9fa48("5136")) {
          {}
        } else {
          stryCov_9fa48("5136");
          S.event(stryMutAct_9fa48("5137") ? "" : (stryCov_9fa48("5137"), 'improving_mac'), (stryMutAct_9fa48("5138") ? "" : (stryCov_9fa48("5138"), 'verification failed: ')) + (stryMutAct_9fa48("5139") ? e.message : (stryCov_9fa48("5139"), e.message.slice(0, 300))));
          return stryMutAct_9fa48("5140") ? {} : (stryCov_9fa48("5140"), {
            ok: stryMutAct_9fa48("5141") ? false : (stryCov_9fa48("5141"), true),
            improved: stryMutAct_9fa48("5142") ? true : (stryCov_9fa48("5142"), false),
            testsGreen: stryMutAct_9fa48("5143") ? true : (stryCov_9fa48("5143"), false),
            error: e.message,
            file
          });
        }
      }
    }
  },
  'POST /api/round/accept': async (q, body) => {
    if (stryMutAct_9fa48("5144")) {
      {}
    } else {
      stryCov_9fa48("5144");
      needRun();
      const file = body.file;
      const f = state.files[file];
      if (stryMutAct_9fa48("5147") ? false : stryMutAct_9fa48("5146") ? true : stryMutAct_9fa48("5145") ? f : (stryCov_9fa48("5145", "5146", "5147"), !f)) throw new Error((stryMutAct_9fa48("5148") ? "" : (stryCov_9fa48("5148"), 'unknown file: ')) + file);
      const rounds = stryMutAct_9fa48("5149") ? (f.rounds || 0) - 1 : (stryCov_9fa48("5149"), (stryMutAct_9fa48("5152") ? f.rounds && 0 : stryMutAct_9fa48("5151") ? false : stryMutAct_9fa48("5150") ? true : (stryCov_9fa48("5150", "5151", "5152"), f.rounds || 0)) + 1);
      // commit this round's tests so a later degrading round can be dropped alone
      try {
        if (stryMutAct_9fa48("5153")) {
          {}
        } else {
          stryCov_9fa48("5153");
          await pr.commit(stryMutAct_9fa48("5154") ? `` : (stryCov_9fa48("5154"), `test: improve MAC of ${file} (round ${rounds})`));
        }
      } catch (e) {
        if (stryMutAct_9fa48("5155")) {
          {}
        } else {
          stryCov_9fa48("5155");
          S.event(stryMutAct_9fa48("5156") ? "" : (stryCov_9fa48("5156"), 'improving_mac'), stryMutAct_9fa48("5157") ? `` : (stryCov_9fa48("5157"), `round ${rounds} commit note: ${e.message}`));
        }
      }
      S.upsertFile(file, stryMutAct_9fa48("5158") ? {} : (stryCov_9fa48("5158"), {
        rounds,
        roundBase: stryMutAct_9fa48("5159") ? {} : (stryCov_9fa48("5159"), {
          coverage: f.coverageAfter,
          mutation: f.mutationAfter,
          mac: f.macAfter
        }),
        // The waste budget is PER ROUND. Carrying it across meant a round that ended on
        // the budget left the next one with nothing to spend: observed live as round 2
        // returning STALE 168 seconds after round 1, having made no attempt at all.
        // Rounds have their own stop rule — they continue only while a metric improves
        // and none degrades — so the budget does not need to bound them as well.
        // mutantAttempts is NOT reset: a mutant that resisted a targeted test has had its
        // one shot, and that verdict holds for the whole file.
        mutantFailures: 0,
        mutantGenFailures: 0,
        mutantAttemptCount: 0,
        mutantNoOutput: {}
      }));
      // whether another round follows is decided AFTER this call, by the graph — this
      // used to promise one unconditionally and now reads as a lie half the time
      S.event(stryMutAct_9fa48("5160") ? "" : (stryCov_9fa48("5160"), 'improving_mac'), stryMutAct_9fa48("5161") ? `` : (stryCov_9fa48("5161"), `round ${rounds} accepted for ${file} (mac now ${f.macAfter})`));
      return stryMutAct_9fa48("5162") ? {} : (stryCov_9fa48("5162"), {
        ok: stryMutAct_9fa48("5163") ? false : (stryCov_9fa48("5163"), true),
        file,
        rounds
      });
    }
  },
  'POST /api/round/drop': async (q, body) => {
    if (stryMutAct_9fa48("5164")) {
      {}
    } else {
      stryCov_9fa48("5164");
      needRun();
      const file = body.file;
      const f = state.files[file];
      if (stryMutAct_9fa48("5167") ? false : stryMutAct_9fa48("5166") ? true : stryMutAct_9fa48("5165") ? f : (stryCov_9fa48("5165", "5166", "5167"), !f)) throw new Error((stryMutAct_9fa48("5168") ? "" : (stryCov_9fa48("5168"), 'unknown file: ')) + file);
      S.setStage(stryMutAct_9fa48("5169") ? "" : (stryCov_9fa48("5169"), 'improving_mac'), stryMutAct_9fa48("5170") ? `` : (stryCov_9fa48("5170"), `finalizing ${file} after ${stryMutAct_9fa48("5173") ? f.rounds && 0 : stryMutAct_9fa48("5172") ? false : stryMutAct_9fa48("5171") ? true : (stryCov_9fa48("5171", "5172", "5173"), f.rounds || 0)} accepted round(s)`));
      // drop the last (stale/degraded) round: uncommitted changes only
      await repo.discardUncommitted();
      const rb = stryMutAct_9fa48("5176") ? f.roundBase && {
        coverage: f.coverageBefore,
        mutation: f.mutationBefore,
        mac: f.macBefore
      } : stryMutAct_9fa48("5175") ? false : stryMutAct_9fa48("5174") ? true : (stryCov_9fa48("5174", "5175", "5176"), f.roundBase || (stryMutAct_9fa48("5177") ? {} : (stryCov_9fa48("5177"), {
        coverage: f.coverageBefore,
        mutation: f.mutationBefore,
        mac: f.macBefore
      })));
      const keptRounds = stryMutAct_9fa48("5181") ? (f.rounds || 0) <= 0 : stryMutAct_9fa48("5180") ? (f.rounds || 0) >= 0 : stryMutAct_9fa48("5179") ? false : stryMutAct_9fa48("5178") ? true : (stryCov_9fa48("5178", "5179", "5180", "5181"), (stryMutAct_9fa48("5184") ? f.rounds && 0 : stryMutAct_9fa48("5183") ? false : stryMutAct_9fa48("5182") ? true : (stryCov_9fa48("5182", "5183", "5184"), f.rounds || 0)) > 0);
      S.upsertFile(file, keptRounds ? stryMutAct_9fa48("5185") ? {} : (stryCov_9fa48("5185"), {
        coverage: rb.coverage,
        mutation: rb.mutation,
        mac: rb.mac,
        coverageAfter: rb.coverage,
        mutationAfter: rb.mutation,
        macAfter: rb.mac
      }) // nothing was kept: leave the "after" columns empty rather than echoing
      // "before" values, which read as a measured (null) improvement
      : stryMutAct_9fa48("5186") ? {} : (stryCov_9fa48("5186"), {
        coverage: rb.coverage,
        mutation: rb.mutation,
        mac: rb.mac,
        coverageAfter: null,
        mutationAfter: null,
        macAfter: null
      }));
      const diff = await pr.diffAgainstBase();
      const changed = stryMutAct_9fa48("5189") ? diff.match(/^\+\+\+ b\/(.+)$/gm)?.map(l => l.slice(6)) && [] : stryMutAct_9fa48("5188") ? false : stryMutAct_9fa48("5187") ? true : (stryCov_9fa48("5187", "5188", "5189"), (stryMutAct_9fa48("5190") ? diff.match(/^\+\+\+ b\/(.+)$/gm).map(l => l.slice(6)) : (stryCov_9fa48("5190"), diff.match(stryMutAct_9fa48("5193") ? /^\+\+\+ b\/(.)$/gm : stryMutAct_9fa48("5192") ? /^\+\+\+ b\/(.+)/gm : stryMutAct_9fa48("5191") ? /\+\+\+ b\/(.+)$/gm : (stryCov_9fa48("5191", "5192", "5193"), /^\+\+\+ b\/(.+)$/gm))?.map(stryMutAct_9fa48("5194") ? () => undefined : (stryCov_9fa48("5194"), l => stryMutAct_9fa48("5195") ? l : (stryCov_9fa48("5195"), l.slice(6)))))) || (stryMutAct_9fa48("5196") ? ["Stryker was here"] : (stryCov_9fa48("5196"), [])));
      const improved = stryMutAct_9fa48("5199") ? (f.rounds || 0) > 0 || (rb.mac ?? 0) > (f.macBefore ?? 0) : stryMutAct_9fa48("5198") ? false : stryMutAct_9fa48("5197") ? true : (stryCov_9fa48("5197", "5198", "5199"), (stryMutAct_9fa48("5202") ? (f.rounds || 0) <= 0 : stryMutAct_9fa48("5201") ? (f.rounds || 0) >= 0 : stryMutAct_9fa48("5200") ? true : (stryCov_9fa48("5200", "5201", "5202"), (stryMutAct_9fa48("5205") ? f.rounds && 0 : stryMutAct_9fa48("5204") ? false : stryMutAct_9fa48("5203") ? true : (stryCov_9fa48("5203", "5204", "5205"), f.rounds || 0)) > 0)) && (stryMutAct_9fa48("5208") ? (rb.mac ?? 0) <= (f.macBefore ?? 0) : stryMutAct_9fa48("5207") ? (rb.mac ?? 0) >= (f.macBefore ?? 0) : stryMutAct_9fa48("5206") ? true : (stryCov_9fa48("5206", "5207", "5208"), (stryMutAct_9fa48("5209") ? rb.mac && 0 : (stryCov_9fa48("5209"), rb.mac ?? 0)) > (stryMutAct_9fa48("5210") ? f.macBefore && 0 : (stryCov_9fa48("5210"), f.macBefore ?? 0)))));
      return stryMutAct_9fa48("5211") ? {} : (stryCov_9fa48("5211"), {
        ok: stryMutAct_9fa48("5212") ? false : (stryCov_9fa48("5212"), true),
        file,
        testsGreen: stryMutAct_9fa48("5213") ? false : (stryCov_9fa48("5213"), true),
        coverageBefore: f.coverageBefore,
        coverageAfter: rb.coverage,
        mutationBefore: f.mutationBefore,
        mutationAfter: rb.mutation,
        macBefore: f.macBefore,
        macAfter: rb.mac,
        improved,
        rounds: stryMutAct_9fa48("5216") ? f.rounds && 0 : stryMutAct_9fa48("5215") ? false : stryMutAct_9fa48("5214") ? true : (stryCov_9fa48("5214", "5215", "5216"), f.rounds || 0),
        tokens: f.tokens,
        changedFiles: changed,
        diff: stryMutAct_9fa48("5217") ? diff : (stryCov_9fa48("5217"), diff.slice(0, 30000)),
        branch: f.branch
      });
    }
  },
  'POST /api/pr/create': async (q, body) => {
    if (stryMutAct_9fa48("5218")) {
      {}
    } else {
      stryCov_9fa48("5218");
      needRun();
      const file = body.file;
      const f = state.files[file];
      if (stryMutAct_9fa48("5221") ? false : stryMutAct_9fa48("5220") ? true : stryMutAct_9fa48("5219") ? f : (stryCov_9fa48("5219", "5220", "5221"), !f)) throw new Error((stryMutAct_9fa48("5222") ? "" : (stryCov_9fa48("5222"), 'unknown file: ')) + file);
      S.setStage(stryMutAct_9fa48("5223") ? "" : (stryCov_9fa48("5223"), 'preparing_pr'), stryMutAct_9fa48("5224") ? `` : (stryCov_9fa48("5224"), `preparing PR for ${file}`));
      // human-equivalent timesheet from the cumulative diff (before commit resets nothing:
      // diff is vs base and includes committed rounds)
      let ts = null;
      try {
        if (stryMutAct_9fa48("5225")) {
          {}
        } else {
          stryCov_9fa48("5225");
          const diffText = await pr.diffAgainstBase();
          const stats = timesheet.diffStats(diffText);
          const src = repo.readFileSafe(file, 500000);
          const mutantsKilled = (stryMutAct_9fa48("5228") ? f.totalMutants && f.mutationAfter != null || f.mutationBefore != null : stryMutAct_9fa48("5227") ? false : stryMutAct_9fa48("5226") ? true : (stryCov_9fa48("5226", "5227", "5228"), (stryMutAct_9fa48("5230") ? f.totalMutants || f.mutationAfter != null : stryMutAct_9fa48("5229") ? true : (stryCov_9fa48("5229", "5230"), f.totalMutants && (stryMutAct_9fa48("5232") ? f.mutationAfter == null : stryMutAct_9fa48("5231") ? true : (stryCov_9fa48("5231", "5232"), f.mutationAfter != null)))) && (stryMutAct_9fa48("5234") ? f.mutationBefore == null : stryMutAct_9fa48("5233") ? true : (stryCov_9fa48("5233", "5234"), f.mutationBefore != null)))) ? stryMutAct_9fa48("5235") ? Math.min(0, Math.round((f.mutationAfter - f.mutationBefore) * f.totalMutants / 100)) : (stryCov_9fa48("5235"), Math.max(0, Math.round(stryMutAct_9fa48("5236") ? (f.mutationAfter - f.mutationBefore) * f.totalMutants * 100 : (stryCov_9fa48("5236"), (stryMutAct_9fa48("5237") ? (f.mutationAfter - f.mutationBefore) / f.totalMutants : (stryCov_9fa48("5237"), (stryMutAct_9fa48("5238") ? f.mutationAfter + f.mutationBefore : (stryCov_9fa48("5238"), f.mutationAfter - f.mutationBefore)) * f.totalMutants)) / 100)))) : Math.ceil(stryMutAct_9fa48("5239") ? stats.testCases * 2 : (stryCov_9fa48("5239"), stats.testCases / 2));
          ts = timesheet.estimate(stryMutAct_9fa48("5240") ? {} : (stryCov_9fa48("5240"), {
            sourceLines: src ? src.split(stryMutAct_9fa48("5241") ? "" : (stryCov_9fa48("5241"), '\n')).length : 0,
            testCases: stats.testCases,
            addedTestLines: stats.addedTestLines,
            mutantsKilled,
            rounds: stryMutAct_9fa48("5244") ? f.rounds && 1 : stryMutAct_9fa48("5243") ? false : stryMutAct_9fa48("5242") ? true : (stryCov_9fa48("5242", "5243", "5244"), f.rounds || 1)
          }));
          S.event(stryMutAct_9fa48("5245") ? "" : (stryCov_9fa48("5245"), 'preparing_pr'), stryMutAct_9fa48("5246") ? `` : (stryCov_9fa48("5246"), `human-equivalent timesheet for ${file}: ${ts.hours} h (analysis ${ts.analysisMin}m + writing ${ts.testsMin}m + mutation ${ts.mutationMin}m + verify ${ts.verifyMin}m)`));
        }
      } catch (e) {
        if (stryMutAct_9fa48("5247")) {
          {}
        } else {
          stryCov_9fa48("5247");
          S.event(stryMutAct_9fa48("5248") ? "" : (stryCov_9fa48("5248"), 'preparing_pr'), (stryMutAct_9fa48("5249") ? "" : (stryCov_9fa48("5249"), 'timesheet estimate skipped: ')) + (stryMutAct_9fa48("5250") ? e.message : (stryCov_9fa48("5250"), e.message.slice(0, 120))));
        }
      }
      try {
        if (stryMutAct_9fa48("5251")) {
          {}
        } else {
          stryCov_9fa48("5251");
          await pr.commit(stryMutAct_9fa48("5254") ? body.title && `test: improve MAC of ${file}` : stryMutAct_9fa48("5253") ? false : stryMutAct_9fa48("5252") ? true : (stryCov_9fa48("5252", "5253", "5254"), body.title || (stryMutAct_9fa48("5255") ? `` : (stryCov_9fa48("5255"), `test: improve MAC of ${file}`))));
        }
      } catch (e) {
        if (stryMutAct_9fa48("5256")) {
          {}
        } else {
          stryCov_9fa48("5256");
          if (stryMutAct_9fa48("5258") ? false : stryMutAct_9fa48("5257") ? true : (stryCov_9fa48("5257", "5258"), /no changed test files/.test(e.message))) {
            if (stryMutAct_9fa48("5259")) {
              {}
            } else {
              stryCov_9fa48("5259");
              await repo.resetToBase();
              S.upsertFile(file, stryMutAct_9fa48("5260") ? {} : (stryCov_9fa48("5260"), {
                status: stryMutAct_9fa48("5261") ? "" : (stryCov_9fa48("5261"), 'no_improvement')
              }));
              S.event(stryMutAct_9fa48("5262") ? "" : (stryCov_9fa48("5262"), 'preparing_pr'), stryMutAct_9fa48("5263") ? `` : (stryCov_9fa48("5263"), `skipping PR for ${file}: ${e.message}`));
              return stryMutAct_9fa48("5264") ? {} : (stryCov_9fa48("5264"), {
                ok: stryMutAct_9fa48("5265") ? false : (stryCov_9fa48("5265"), true),
                pr: null,
                skipped: e.message
              });
            }
          }
          throw e;
        }
      }
      const rec = await pr.createPr(stryMutAct_9fa48("5266") ? {} : (stryCov_9fa48("5266"), {
        file,
        branch: f.branch,
        title: body.title,
        body: stryMutAct_9fa48("5269") ? body.body && '' : stryMutAct_9fa48("5268") ? false : stryMutAct_9fa48("5267") ? true : (stryCov_9fa48("5267", "5268", "5269"), body.body || (stryMutAct_9fa48("5270") ? "Stryker was here!" : (stryCov_9fa48("5270"), ''))),
        labels: stryMutAct_9fa48("5273") ? body.labels && [] : stryMutAct_9fa48("5272") ? false : stryMutAct_9fa48("5271") ? true : (stryCov_9fa48("5271", "5272", "5273"), body.labels || (stryMutAct_9fa48("5274") ? ["Stryker was here"] : (stryCov_9fa48("5274"), [])))
      }));
      const spentSec = accrueSpent(file);
      S.upsertFile(file, stryMutAct_9fa48("5275") ? {} : (stryCov_9fa48("5275"), {
        status: stryMutAct_9fa48("5276") ? "" : (stryCov_9fa48("5276"), 'improved'),
        prUrl: rec.url,
        prPatch: rec.patchPath,
        timesheet: ts
      }));
      ledger()[file] = stryMutAct_9fa48("5277") ? {} : (stryCov_9fa48("5277"), {
        state: stryMutAct_9fa48("5278") ? "" : (stryCov_9fa48("5278"), 'improved'),
        prUrl: rec.url,
        patchPath: rec.patchPath,
        branch: f.branch,
        ts: Date.now(),
        metrics: stryMutAct_9fa48("5279") ? {} : (stryCov_9fa48("5279"), {
          coverageBefore: f.coverageBefore,
          coverageAfter: f.coverageAfter,
          mutationBefore: f.mutationBefore,
          mutationAfter: f.mutationAfter,
          macBefore: f.macBefore,
          macAfter: f.macAfter,
          timesheet: ts,
          spentSec,
          tokens: f.tokens
        })
      });
      S.save();
      await repo.resetToBase();
      return stryMutAct_9fa48("5280") ? {} : (stryCov_9fa48("5280"), {
        ok: stryMutAct_9fa48("5281") ? false : (stryCov_9fa48("5281"), true),
        pr: rec
      });
    }
  },
  'POST /api/iteration/discard': async (q, body) => {
    if (stryMutAct_9fa48("5282")) {
      {}
    } else {
      stryCov_9fa48("5282");
      needRun();
      const file = body.file;
      S.setStage(stryMutAct_9fa48("5283") ? "" : (stryCov_9fa48("5283"), 'improving_mac'), stryMutAct_9fa48("5284") ? `` : (stryCov_9fa48("5284"), `no improvement for ${file} — discarding changes`));
      await repo.resetToBase();
      if (stryMutAct_9fa48("5287") ? file || state.files[file] : stryMutAct_9fa48("5286") ? false : stryMutAct_9fa48("5285") ? true : (stryCov_9fa48("5285", "5286", "5287"), file && state.files[file])) {
        if (stryMutAct_9fa48("5288")) {
          {}
        } else {
          stryCov_9fa48("5288");
          const f = state.files[file];
          const spentSec = accrueSpent(file);
          if (stryMutAct_9fa48("5291") ? f.status === 'failed' : stryMutAct_9fa48("5290") ? false : stryMutAct_9fa48("5289") ? true : (stryCov_9fa48("5289", "5290", "5291"), f.status !== (stryMutAct_9fa48("5292") ? "" : (stryCov_9fa48("5292"), 'failed')))) {
            if (stryMutAct_9fa48("5293")) {
              {}
            } else {
              stryCov_9fa48("5293");
              const maxAttempts = stryMutAct_9fa48("5296") ? state.run.config.maxAttemptsPerFile && 3 : stryMutAct_9fa48("5295") ? false : stryMutAct_9fa48("5294") ? true : (stryCov_9fa48("5294", "5295", "5296"), state.run.config.maxAttemptsPerFile || 3);
              S.upsertFile(file, stryMutAct_9fa48("5297") ? {} : (stryCov_9fa48("5297"), {
                status: (stryMutAct_9fa48("5301") ? f.attempts < maxAttempts : stryMutAct_9fa48("5300") ? f.attempts > maxAttempts : stryMutAct_9fa48("5299") ? false : stryMutAct_9fa48("5298") ? true : (stryCov_9fa48("5298", "5299", "5300", "5301"), f.attempts >= maxAttempts)) ? stryMutAct_9fa48("5302") ? "" : (stryCov_9fa48("5302"), 'no_improvement') : stryMutAct_9fa48("5303") ? "" : (stryCov_9fa48("5303"), 'candidate')
              }));
              if (stryMutAct_9fa48("5307") ? f.attempts < maxAttempts : stryMutAct_9fa48("5306") ? f.attempts > maxAttempts : stryMutAct_9fa48("5305") ? false : stryMutAct_9fa48("5304") ? true : (stryCov_9fa48("5304", "5305", "5306", "5307"), f.attempts >= maxAttempts)) {
                if (stryMutAct_9fa48("5308")) {
                  {}
                } else {
                  stryCov_9fa48("5308");
                  // keep the numbers: a file we could not improve is still a file we measured
                  const m = stryMutAct_9fa48("5311") ? measured()[file] && {} : stryMutAct_9fa48("5310") ? false : stryMutAct_9fa48("5309") ? true : (stryCov_9fa48("5309", "5310", "5311"), measured()[file] || {});
                  ledger()[file] = stryMutAct_9fa48("5312") ? {} : (stryCov_9fa48("5312"), {
                    state: stryMutAct_9fa48("5313") ? "" : (stryCov_9fa48("5313"), 'exhausted'),
                    ts: Date.now(),
                    metrics: stryMutAct_9fa48("5314") ? {} : (stryCov_9fa48("5314"), {
                      spentSec,
                      attempts: f.attempts,
                      tokens: f.tokens,
                      coverageBefore: stryMutAct_9fa48("5315") ? f.coverageBefore && m.coverageBefore : (stryCov_9fa48("5315"), f.coverageBefore ?? m.coverageBefore),
                      mutationBefore: stryMutAct_9fa48("5316") ? f.mutationBefore && m.mutationBefore : (stryCov_9fa48("5316"), f.mutationBefore ?? m.mutationBefore),
                      macBefore: stryMutAct_9fa48("5317") ? f.macBefore && m.macBefore : (stryCov_9fa48("5317"), f.macBefore ?? m.macBefore),
                      attemptCoverage: m.attemptCoverage,
                      attemptMutation: m.attemptMutation,
                      attemptMac: m.attemptMac
                    })
                  });
                  S.save();
                }
              }
            }
          }
        }
      }
      S.event(stryMutAct_9fa48("5318") ? "" : (stryCov_9fa48("5318"), 'improving_mac'), stryMutAct_9fa48("5319") ? `` : (stryCov_9fa48("5319"), `discarded changes for ${file}: ${stryMutAct_9fa48("5322") ? body.reason && 'no MAC improvement' : stryMutAct_9fa48("5321") ? false : stryMutAct_9fa48("5320") ? true : (stryCov_9fa48("5320", "5321", "5322"), body.reason || (stryMutAct_9fa48("5323") ? "" : (stryCov_9fa48("5323"), 'no MAC improvement')))}`));
      return stryMutAct_9fa48("5324") ? {} : (stryCov_9fa48("5324"), {
        ok: stryMutAct_9fa48("5325") ? false : (stryCov_9fa48("5325"), true)
      });
    }
  },
  // Plain reset is what the batch driver does BETWEEN batches, so it deliberately
  // keeps the ledgers — they are the record of what is already settled. Starting a
  // repo over is a different request, and has to say so.
  'POST /api/admin/reset': async (q, body = {}) => {
    if (stryMutAct_9fa48("5326")) {
      {}
    } else {
      stryCov_9fa48("5326");
      // read the target BEFORE the run is dropped — it is where the repo url lives
      const target = stryMutAct_9fa48("5329") ? (body.repoUrl || state.run?.config?.repoUrl || process.env.REPO_URL) && '' : stryMutAct_9fa48("5328") ? false : stryMutAct_9fa48("5327") ? true : (stryCov_9fa48("5327", "5328", "5329"), (stryMutAct_9fa48("5331") ? (body.repoUrl || state.run?.config?.repoUrl) && process.env.REPO_URL : stryMutAct_9fa48("5330") ? false : (stryCov_9fa48("5330", "5331"), (stryMutAct_9fa48("5333") ? body.repoUrl && state.run?.config?.repoUrl : stryMutAct_9fa48("5332") ? false : (stryCov_9fa48("5332", "5333"), body.repoUrl || (stryMutAct_9fa48("5335") ? state.run.config?.repoUrl : stryMutAct_9fa48("5334") ? state.run?.config.repoUrl : (stryCov_9fa48("5334", "5335"), state.run?.config?.repoUrl)))) || process.env.REPO_URL)) || (stryMutAct_9fa48("5336") ? "Stryker was here!" : (stryCov_9fa48("5336"), '')));
      state.run = null;
      state.files = {};
      state.decisions = {};
      state.prs = stryMutAct_9fa48("5337") ? ["Stryker was here"] : (stryCov_9fa48("5337"), []);
      state.events = stryMutAct_9fa48("5338") ? ["Stryker was here"] : (stryCov_9fa48("5338"), []);
      state.seq = 0;
      const LEDGERS = stryMutAct_9fa48("5339") ? [] : (stryCov_9fa48("5339"), [stryMutAct_9fa48("5340") ? "" : (stryCov_9fa48("5340"), 'improvedLedger'), stryMutAct_9fa48("5341") ? "" : (stryCov_9fa48("5341"), 'measureLedger'), stryMutAct_9fa48("5342") ? "" : (stryCov_9fa48("5342"), 'overheadLedger'), stryMutAct_9fa48("5343") ? "" : (stryCov_9fa48("5343"), 'tokenLedger')]);
      let cleared = null;
      if (stryMutAct_9fa48("5345") ? false : stryMutAct_9fa48("5344") ? true : (stryCov_9fa48("5344", "5345"), body.ledgers)) {
        if (stryMutAct_9fa48("5346")) {
          {}
        } else {
          stryCov_9fa48("5346");
          cleared = body.repoUrl ? slugify(body.repoUrl) : stryMutAct_9fa48("5347") ? "" : (stryCov_9fa48("5347"), 'all repos');
          for (const name of LEDGERS) {
            if (stryMutAct_9fa48("5348")) {
              {}
            } else {
              stryCov_9fa48("5348");
              if (stryMutAct_9fa48("5350") ? false : stryMutAct_9fa48("5349") ? true : (stryCov_9fa48("5349", "5350"), body.repoUrl)) delete state[name][slugify(body.repoUrl)];else state[name] = {};
            }
          }
        }
      }
      let repoRemoved = stryMutAct_9fa48("5351") ? true : (stryCov_9fa48("5351"), false);
      if (stryMutAct_9fa48("5354") ? body.repo || target : stryMutAct_9fa48("5353") ? false : stryMutAct_9fa48("5352") ? true : (stryCov_9fa48("5352", "5353", "5354"), body.repo && target)) {
        if (stryMutAct_9fa48("5355")) {
          {}
        } else {
          stryCov_9fa48("5355");
          // a tree earlier runs wrote into is not a clean starting point
          try {
            if (stryMutAct_9fa48("5356")) {
              {}
            } else {
              stryCov_9fa48("5356");
              fs.rmSync(path.join(S.DATA_DIR, stryMutAct_9fa48("5357") ? "" : (stryCov_9fa48("5357"), 'repos'), slugify(target)), stryMutAct_9fa48("5358") ? {} : (stryCov_9fa48("5358"), {
                recursive: stryMutAct_9fa48("5359") ? false : (stryCov_9fa48("5359"), true),
                force: stryMutAct_9fa48("5360") ? false : (stryCov_9fa48("5360"), true)
              }));
              repoRemoved = stryMutAct_9fa48("5361") ? false : (stryCov_9fa48("5361"), true);
            }
          } catch {}
        }
      }
      S.setStage(stryMutAct_9fa48("5362") ? "" : (stryCov_9fa48("5362"), 'idle'), cleared ? stryMutAct_9fa48("5363") ? `` : (stryCov_9fa48("5363"), `state reset — ledgers cleared for ${cleared}`) : stryMutAct_9fa48("5364") ? "" : (stryCov_9fa48("5364"), 'state reset'));
      S.save();
      return stryMutAct_9fa48("5365") ? {} : (stryCov_9fa48("5365"), {
        ok: stryMutAct_9fa48("5366") ? false : (stryCov_9fa48("5366"), true),
        ledgersCleared: cleared,
        repoRemoved
      });
    }
  }
});

// ── static dashboard ───────────────────────────────────────────────────────
const DASH = path.join(__dirname, stryMutAct_9fa48("5367") ? "" : (stryCov_9fa48("5367"), 'dashboard'));
const MIME = stryMutAct_9fa48("5368") ? {} : (stryCov_9fa48("5368"), {
  '.html': stryMutAct_9fa48("5369") ? "" : (stryCov_9fa48("5369"), 'text/html'),
  '.js': stryMutAct_9fa48("5370") ? "" : (stryCov_9fa48("5370"), 'text/javascript'),
  '.css': stryMutAct_9fa48("5371") ? "" : (stryCov_9fa48("5371"), 'text/css'),
  '.svg': stryMutAct_9fa48("5372") ? "" : (stryCov_9fa48("5372"), 'image/svg+xml'),
  '.json': stryMutAct_9fa48("5373") ? "" : (stryCov_9fa48("5373"), 'application/json')
});
function serveStatic(req, res, rel) {
  if (stryMutAct_9fa48("5374")) {
    {}
  } else {
    stryCov_9fa48("5374");
    if (stryMutAct_9fa48("5377") ? !rel && rel === '/' : stryMutAct_9fa48("5376") ? false : stryMutAct_9fa48("5375") ? true : (stryCov_9fa48("5375", "5376", "5377"), (stryMutAct_9fa48("5378") ? rel : (stryCov_9fa48("5378"), !rel)) || (stryMutAct_9fa48("5380") ? rel !== '/' : stryMutAct_9fa48("5379") ? false : (stryCov_9fa48("5379", "5380"), rel === (stryMutAct_9fa48("5381") ? "" : (stryCov_9fa48("5381"), '/')))))) rel = stryMutAct_9fa48("5382") ? "" : (stryCov_9fa48("5382"), '/index.html');
    const abs = path.join(DASH, path.normalize(rel));
    if (stryMutAct_9fa48("5385") ? false : stryMutAct_9fa48("5384") ? true : stryMutAct_9fa48("5383") ? abs.startsWith(DASH) : (stryCov_9fa48("5383", "5384", "5385"), !(stryMutAct_9fa48("5386") ? abs.endsWith(DASH) : (stryCov_9fa48("5386"), abs.startsWith(DASH))))) {
      if (stryMutAct_9fa48("5387")) {
        {}
      } else {
        stryCov_9fa48("5387");
        res.writeHead(403);
        return res.end();
      }
    }
    fs.readFile(abs, (err, buf) => {
      if (stryMutAct_9fa48("5388")) {
        {}
      } else {
        stryCov_9fa48("5388");
        if (stryMutAct_9fa48("5390") ? false : stryMutAct_9fa48("5389") ? true : (stryCov_9fa48("5389", "5390"), err)) {
          if (stryMutAct_9fa48("5391")) {
            {}
          } else {
            stryCov_9fa48("5391");
            res.writeHead(404);
            return res.end(stryMutAct_9fa48("5392") ? "" : (stryCov_9fa48("5392"), 'not found'));
          }
        }
        res.writeHead(200, stryMutAct_9fa48("5393") ? {} : (stryCov_9fa48("5393"), {
          'Content-Type': stryMutAct_9fa48("5396") ? MIME[path.extname(abs)] && 'application/octet-stream' : stryMutAct_9fa48("5395") ? false : stryMutAct_9fa48("5394") ? true : (stryCov_9fa48("5394", "5395", "5396"), MIME[path.extname(abs)] || (stryMutAct_9fa48("5397") ? "" : (stryCov_9fa48("5397"), 'application/octet-stream')))
        }));
        res.end(buf);
      }
    });
  }
}
const server = http.createServer(async (req, res) => {
  if (stryMutAct_9fa48("5398")) {
    {}
  } else {
    stryCov_9fa48("5398");
    const u = new URL(req.url, stryMutAct_9fa48("5399") ? "" : (stryCov_9fa48("5399"), 'http://x'));
    const key = req.method + (stryMutAct_9fa48("5400") ? "" : (stryCov_9fa48("5400"), ' ')) + u.pathname;
    try {
      if (stryMutAct_9fa48("5401")) {
        {}
      } else {
        stryCov_9fa48("5401");
        if (stryMutAct_9fa48("5403") ? false : stryMutAct_9fa48("5402") ? true : (stryCov_9fa48("5402", "5403"), routes[key])) {
          if (stryMutAct_9fa48("5404")) {
            {}
          } else {
            stryCov_9fa48("5404");
            const body = (stryMutAct_9fa48("5407") ? req.method !== 'POST' : stryMutAct_9fa48("5406") ? false : stryMutAct_9fa48("5405") ? true : (stryCov_9fa48("5405", "5406", "5407"), req.method === (stryMutAct_9fa48("5408") ? "" : (stryCov_9fa48("5408"), 'POST')))) ? await readBody(req) : {};
            const out = await routes[key](u.searchParams, body);
            return json(res, 200, out);
          }
        }
        if (stryMutAct_9fa48("5411") ? u.pathname.endsWith('/api/') : stryMutAct_9fa48("5410") ? false : stryMutAct_9fa48("5409") ? true : (stryCov_9fa48("5409", "5410", "5411"), u.pathname.startsWith(stryMutAct_9fa48("5412") ? "" : (stryCov_9fa48("5412"), '/api/')))) return json(res, 404, stryMutAct_9fa48("5413") ? {} : (stryCov_9fa48("5413"), {
          error: (stryMutAct_9fa48("5414") ? "" : (stryCov_9fa48("5414"), 'no such endpoint: ')) + key
        }));
        // dashboard: served at / and /dashboard (Caddy strips the /dashboard prefix)
        let rel = u.pathname;
        if (stryMutAct_9fa48("5417") ? rel.endsWith('/dashboard') : stryMutAct_9fa48("5416") ? false : stryMutAct_9fa48("5415") ? true : (stryCov_9fa48("5415", "5416", "5417"), rel.startsWith(stryMutAct_9fa48("5418") ? "" : (stryCov_9fa48("5418"), '/dashboard')))) rel = stryMutAct_9fa48("5421") ? rel.slice('/dashboard'.length) && '/' : stryMutAct_9fa48("5420") ? false : stryMutAct_9fa48("5419") ? true : (stryCov_9fa48("5419", "5420", "5421"), (stryMutAct_9fa48("5422") ? rel : (stryCov_9fa48("5422"), rel.slice((stryMutAct_9fa48("5423") ? "" : (stryCov_9fa48("5423"), '/dashboard')).length))) || (stryMutAct_9fa48("5424") ? "" : (stryCov_9fa48("5424"), '/')));
        return serveStatic(req, res, rel);
      }
    } catch (e) {
      if (stryMutAct_9fa48("5425")) {
        {}
      } else {
        stryCov_9fa48("5425");
        S.event(stryMutAct_9fa48("5426") ? "" : (stryCov_9fa48("5426"), 'error'), stryMutAct_9fa48("5427") ? `` : (stryCov_9fa48("5427"), `${key}: ${e.message}`));
        // a rejected concurrent start is a guard, not a run failure
        if (stryMutAct_9fa48("5430") ? e.statusCode !== 409 : stryMutAct_9fa48("5429") ? false : stryMutAct_9fa48("5428") ? true : (stryCov_9fa48("5428", "5429", "5430"), e.statusCode === 409)) return json(res, 409, stryMutAct_9fa48("5431") ? {} : (stryCov_9fa48("5431"), {
          ok: stryMutAct_9fa48("5432") ? true : (stryCov_9fa48("5432"), false),
          error: e.message
        }));
        // a hard error aborts the n8n execution → the run is dead; reflect that
        if (stryMutAct_9fa48("5435") ? state.run && state.run.status === 'running' || req.method === 'POST' : stryMutAct_9fa48("5434") ? false : stryMutAct_9fa48("5433") ? true : (stryCov_9fa48("5433", "5434", "5435"), (stryMutAct_9fa48("5437") ? state.run || state.run.status === 'running' : stryMutAct_9fa48("5436") ? true : (stryCov_9fa48("5436", "5437"), state.run && (stryMutAct_9fa48("5439") ? state.run.status !== 'running' : stryMutAct_9fa48("5438") ? true : (stryCov_9fa48("5438", "5439"), state.run.status === (stryMutAct_9fa48("5440") ? "" : (stryCov_9fa48("5440"), 'running')))))) && (stryMutAct_9fa48("5442") ? req.method !== 'POST' : stryMutAct_9fa48("5441") ? true : (stryCov_9fa48("5441", "5442"), req.method === (stryMutAct_9fa48("5443") ? "" : (stryCov_9fa48("5443"), 'POST')))))) {
          if (stryMutAct_9fa48("5444")) {
            {}
          } else {
            stryCov_9fa48("5444");
            state.run.status = stryMutAct_9fa48("5445") ? "" : (stryCov_9fa48("5445"), 'failed');
            state.run.finishedAt = Math.floor(stryMutAct_9fa48("5446") ? Date.now() * 1000 : (stryCov_9fa48("5446"), Date.now() / 1000));
            S.setStage(stryMutAct_9fa48("5447") ? "" : (stryCov_9fa48("5447"), 'failed'), stryMutAct_9fa48("5448") ? e.message : (stryCov_9fa48("5448"), e.message.slice(0, 200)));
          }
        }
        return json(res, 500, stryMutAct_9fa48("5449") ? {} : (stryCov_9fa48("5449"), {
          ok: stryMutAct_9fa48("5450") ? true : (stryCov_9fa48("5450"), false),
          error: require('./util').redact(e.message)
        }));
      }
    }
  }
});

// Importable: tests drive the route table in-process (with the OS-touching
// modules faked) instead of only ever exercising it through a live container.
if (stryMutAct_9fa48("5453") ? require.main !== module : stryMutAct_9fa48("5452") ? false : stryMutAct_9fa48("5451") ? true : (stryCov_9fa48("5451", "5452", "5453"), require.main === module)) {
  if (stryMutAct_9fa48("5454")) {
    {}
  } else {
    stryCov_9fa48("5454");
    S.load();
    server.listen(PORT, stryMutAct_9fa48("5455") ? () => undefined : (stryCov_9fa48("5455"), () => console.log(stryMutAct_9fa48("5456") ? `` : (stryCov_9fa48("5456"), `sidecar listening on :${PORT}`))));
  }
}
module.exports = stryMutAct_9fa48("5457") ? {} : (stryCov_9fa48("5457"), {
  routes,
  server
});