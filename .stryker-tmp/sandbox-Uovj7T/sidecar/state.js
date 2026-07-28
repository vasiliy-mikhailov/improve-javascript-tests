// @ts-nocheck
'use strict';

// JSON-file-backed state store. Single-process, in-memory with debounced flush.
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
  nowSec,
  redact,
  slugify
} = require('./util');
const {
  addUsage
} = require('./tokens');
const DATA_DIR = stryMutAct_9fa48("5460") ? process.env.DATA_DIR && '/data' : stryMutAct_9fa48("5459") ? false : stryMutAct_9fa48("5458") ? true : (stryCov_9fa48("5458", "5459", "5460"), process.env.DATA_DIR || (stryMutAct_9fa48("5461") ? "" : (stryCov_9fa48("5461"), '/data')));
const STATE_FILE = path.join(DATA_DIR, stryMutAct_9fa48("5462") ? "" : (stryCov_9fa48("5462"), 'state.json'));
const EVENTS_FILE = path.join(DATA_DIR, stryMutAct_9fa48("5463") ? "" : (stryCov_9fa48("5463"), 'events.jsonl'));
const MAX_EVENTS_IN_STATE = 400;
function envConfig() {
  if (stryMutAct_9fa48("5464")) {
    {}
  } else {
    stryCov_9fa48("5464");
    const e = process.env;
    return stryMutAct_9fa48("5465") ? {} : (stryCov_9fa48("5465"), {
      repoUrl: stryMutAct_9fa48("5468") ? e.REPO_URL && '' : stryMutAct_9fa48("5467") ? false : stryMutAct_9fa48("5466") ? true : (stryCov_9fa48("5466", "5467", "5468"), e.REPO_URL || (stryMutAct_9fa48("5469") ? "Stryker was here!" : (stryCov_9fa48("5469"), ''))),
      repoBranch: stryMutAct_9fa48("5472") ? e.REPO_BRANCH && 'main' : stryMutAct_9fa48("5471") ? false : stryMutAct_9fa48("5470") ? true : (stryCov_9fa48("5470", "5471", "5472"), e.REPO_BRANCH || (stryMutAct_9fa48("5473") ? "" : (stryCov_9fa48("5473"), 'main'))),
      scopeGlob: stryMutAct_9fa48("5476") ? e.SCOPE_GLOB && '**/*.{js,ts,jsx,tsx}' : stryMutAct_9fa48("5475") ? false : stryMutAct_9fa48("5474") ? true : (stryCov_9fa48("5474", "5475", "5476"), e.SCOPE_GLOB || (stryMutAct_9fa48("5477") ? "" : (stryCov_9fa48("5477"), '**/*.{js,ts,jsx,tsx}'))),
      scopeLimit: parseInt(stryMutAct_9fa48("5480") ? e.SCOPE_LIMIT && '0' : stryMutAct_9fa48("5479") ? false : stryMutAct_9fa48("5478") ? true : (stryCov_9fa48("5478", "5479", "5480"), e.SCOPE_LIMIT || (stryMutAct_9fa48("5481") ? "" : (stryCov_9fa48("5481"), '0'))), 10),
      maxIterations: parseInt(stryMutAct_9fa48("5484") ? e.MAX_ITERATIONS && '0' : stryMutAct_9fa48("5483") ? false : stryMutAct_9fa48("5482") ? true : (stryCov_9fa48("5482", "5483", "5484"), e.MAX_ITERATIONS || (stryMutAct_9fa48("5485") ? "" : (stryCov_9fa48("5485"), '0'))), 10),
      // 0 = unlimited
      maxMutantsPerFile: parseInt(stryMutAct_9fa48("5488") ? e.MAX_MUTANTS_PER_FILE && '5' : stryMutAct_9fa48("5487") ? false : stryMutAct_9fa48("5486") ? true : (stryCov_9fa48("5486", "5487", "5488"), e.MAX_MUTANTS_PER_FILE || (stryMutAct_9fa48("5489") ? "" : (stryCov_9fa48("5489"), '5'))), 10),
      maxAttemptsPerFile: parseInt(stryMutAct_9fa48("5492") ? e.MAX_ATTEMPTS_PER_FILE && '3' : stryMutAct_9fa48("5491") ? false : stryMutAct_9fa48("5490") ? true : (stryCov_9fa48("5490", "5491", "5492"), e.MAX_ATTEMPTS_PER_FILE || (stryMutAct_9fa48("5493") ? "" : (stryCov_9fa48("5493"), '3'))), 10),
      prMode: stryMutAct_9fa48("5496") ? e.PR_MODE && 'github' : stryMutAct_9fa48("5495") ? false : stryMutAct_9fa48("5494") ? true : (stryCov_9fa48("5494", "5495", "5496"), e.PR_MODE || (stryMutAct_9fa48("5497") ? "" : (stryCov_9fa48("5497"), 'github'))),
      // github | local
      prBase: stryMutAct_9fa48("5500") ? e.PR_BASE && '' : stryMutAct_9fa48("5499") ? false : stryMutAct_9fa48("5498") ? true : (stryCov_9fa48("5498", "5499", "5500"), e.PR_BASE || (stryMutAct_9fa48("5501") ? "Stryker was here!" : (stryCov_9fa48("5501"), ''))),
      // defaults to repoBranch
      setupScript: stryMutAct_9fa48("5504") ? e.SETUP_SCRIPT && '' : stryMutAct_9fa48("5503") ? false : stryMutAct_9fa48("5502") ? true : (stryCov_9fa48("5502", "5503", "5504"), e.SETUP_SCRIPT || (stryMutAct_9fa48("5505") ? "Stryker was here!" : (stryCov_9fa48("5505"), ''))),
      // npm script to run after install (e.g. a build)
      dryRun: stryMutAct_9fa48("5508") ? String(e.DRY_RUN || 'false') !== 'true' : stryMutAct_9fa48("5507") ? false : stryMutAct_9fa48("5506") ? true : (stryCov_9fa48("5506", "5507", "5508"), String(stryMutAct_9fa48("5511") ? e.DRY_RUN && 'false' : stryMutAct_9fa48("5510") ? false : stryMutAct_9fa48("5509") ? true : (stryCov_9fa48("5509", "5510", "5511"), e.DRY_RUN || (stryMutAct_9fa48("5512") ? "" : (stryCov_9fa48("5512"), 'false')))) === (stryMutAct_9fa48("5513") ? "" : (stryCov_9fa48("5513"), 'true'))),
      rules: stryMutAct_9fa48("5514") ? {} : (stryCov_9fa48("5514"), {
        post_clone: stryMutAct_9fa48("5517") ? e.RULES_POST_CLONE && '' : stryMutAct_9fa48("5516") ? false : stryMutAct_9fa48("5515") ? true : (stryCov_9fa48("5515", "5516", "5517"), e.RULES_POST_CLONE || (stryMutAct_9fa48("5518") ? "Stryker was here!" : (stryCov_9fa48("5518"), ''))),
        pre_pick: stryMutAct_9fa48("5521") ? e.RULES_PRE_PICK && '' : stryMutAct_9fa48("5520") ? false : stryMutAct_9fa48("5519") ? true : (stryCov_9fa48("5519", "5520", "5521"), e.RULES_PRE_PICK || (stryMutAct_9fa48("5522") ? "Stryker was here!" : (stryCov_9fa48("5522"), ''))),
        pick_file: stryMutAct_9fa48("5525") ? e.RULES_PICK_FILE && '' : stryMutAct_9fa48("5524") ? false : stryMutAct_9fa48("5523") ? true : (stryCov_9fa48("5523", "5524", "5525"), e.RULES_PICK_FILE || (stryMutAct_9fa48("5526") ? "Stryker was here!" : (stryCov_9fa48("5526"), ''))),
        write_test: stryMutAct_9fa48("5529") ? e.RULES_WRITE_TEST && '' : stryMutAct_9fa48("5528") ? false : stryMutAct_9fa48("5527") ? true : (stryCov_9fa48("5527", "5528", "5529"), e.RULES_WRITE_TEST || (stryMutAct_9fa48("5530") ? "Stryker was here!" : (stryCov_9fa48("5530"), ''))),
        check_changes: stryMutAct_9fa48("5533") ? e.RULES_CHECK_CHANGES && '' : stryMutAct_9fa48("5532") ? false : stryMutAct_9fa48("5531") ? true : (stryCov_9fa48("5531", "5532", "5533"), e.RULES_CHECK_CHANGES || (stryMutAct_9fa48("5534") ? "Stryker was here!" : (stryCov_9fa48("5534"), ''))),
        make_pr: stryMutAct_9fa48("5537") ? e.RULES_MAKE_PR && '' : stryMutAct_9fa48("5536") ? false : stryMutAct_9fa48("5535") ? true : (stryCov_9fa48("5535", "5536", "5537"), e.RULES_MAKE_PR || (stryMutAct_9fa48("5538") ? "Stryker was here!" : (stryCov_9fa48("5538"), '')))
      })
    });
  }
}
function freshRun(overrides = {}) {
  if (stryMutAct_9fa48("5539")) {
    {}
  } else {
    stryCov_9fa48("5539");
    const cfg = envConfig();
    const o = (stryMutAct_9fa48("5542") ? overrides || typeof overrides === 'object' : stryMutAct_9fa48("5541") ? false : stryMutAct_9fa48("5540") ? true : (stryCov_9fa48("5540", "5541", "5542"), overrides && (stryMutAct_9fa48("5544") ? typeof overrides !== 'object' : stryMutAct_9fa48("5543") ? true : (stryCov_9fa48("5543", "5544"), typeof overrides === (stryMutAct_9fa48("5545") ? "" : (stryCov_9fa48("5545"), 'object')))))) ? overrides : {};
    for (const k of stryMutAct_9fa48("5546") ? [] : (stryCov_9fa48("5546"), [stryMutAct_9fa48("5547") ? "" : (stryCov_9fa48("5547"), 'repoUrl'), stryMutAct_9fa48("5548") ? "" : (stryCov_9fa48("5548"), 'repoBranch'), stryMutAct_9fa48("5549") ? "" : (stryCov_9fa48("5549"), 'scopeGlob'), stryMutAct_9fa48("5550") ? "" : (stryCov_9fa48("5550"), 'scopeLimit'), stryMutAct_9fa48("5551") ? "" : (stryCov_9fa48("5551"), 'maxIterations'), stryMutAct_9fa48("5552") ? "" : (stryCov_9fa48("5552"), 'maxMutantsPerFile'), stryMutAct_9fa48("5553") ? "" : (stryCov_9fa48("5553"), 'maxAttemptsPerFile'), stryMutAct_9fa48("5554") ? "" : (stryCov_9fa48("5554"), 'prMode'), stryMutAct_9fa48("5555") ? "" : (stryCov_9fa48("5555"), 'prBase'), stryMutAct_9fa48("5556") ? "" : (stryCov_9fa48("5556"), 'dryRun'), stryMutAct_9fa48("5557") ? "" : (stryCov_9fa48("5557"), 'setupScript')])) {
      if (stryMutAct_9fa48("5558")) {
        {}
      } else {
        stryCov_9fa48("5558");
        if (stryMutAct_9fa48("5561") ? o[k] !== undefined && o[k] !== null || o[k] !== '' : stryMutAct_9fa48("5560") ? false : stryMutAct_9fa48("5559") ? true : (stryCov_9fa48("5559", "5560", "5561"), (stryMutAct_9fa48("5563") ? o[k] !== undefined || o[k] !== null : stryMutAct_9fa48("5562") ? true : (stryCov_9fa48("5562", "5563"), (stryMutAct_9fa48("5565") ? o[k] === undefined : stryMutAct_9fa48("5564") ? true : (stryCov_9fa48("5564", "5565"), o[k] !== undefined)) && (stryMutAct_9fa48("5567") ? o[k] === null : stryMutAct_9fa48("5566") ? true : (stryCov_9fa48("5566", "5567"), o[k] !== null)))) && (stryMutAct_9fa48("5569") ? o[k] === '' : stryMutAct_9fa48("5568") ? true : (stryCov_9fa48("5568", "5569"), o[k] !== (stryMutAct_9fa48("5570") ? "Stryker was here!" : (stryCov_9fa48("5570"), '')))))) cfg[k] = o[k];
      }
    }
    if (stryMutAct_9fa48("5573") ? o.rules || typeof o.rules === 'object' : stryMutAct_9fa48("5572") ? false : stryMutAct_9fa48("5571") ? true : (stryCov_9fa48("5571", "5572", "5573"), o.rules && (stryMutAct_9fa48("5575") ? typeof o.rules !== 'object' : stryMutAct_9fa48("5574") ? true : (stryCov_9fa48("5574", "5575"), typeof o.rules === (stryMutAct_9fa48("5576") ? "" : (stryCov_9fa48("5576"), 'object')))))) {
      if (stryMutAct_9fa48("5577")) {
        {}
      } else {
        stryCov_9fa48("5577");
        for (const k of Object.keys(cfg.rules)) if (stryMutAct_9fa48("5580") ? o.rules[k] === undefined : stryMutAct_9fa48("5579") ? false : stryMutAct_9fa48("5578") ? true : (stryCov_9fa48("5578", "5579", "5580"), o.rules[k] !== undefined)) cfg.rules[k] = o.rules[k];
      }
    }
    cfg.scopeLimit = stryMutAct_9fa48("5583") ? parseInt(cfg.scopeLimit, 10) && 0 : stryMutAct_9fa48("5582") ? false : stryMutAct_9fa48("5581") ? true : (stryCov_9fa48("5581", "5582", "5583"), parseInt(cfg.scopeLimit, 10) || 0);
    cfg.maxIterations = stryMutAct_9fa48("5584") ? Math.min(0, parseInt(cfg.maxIterations, 10) || 0) : (stryCov_9fa48("5584"), Math.max(0, stryMutAct_9fa48("5587") ? parseInt(cfg.maxIterations, 10) && 0 : stryMutAct_9fa48("5586") ? false : stryMutAct_9fa48("5585") ? true : (stryCov_9fa48("5585", "5586", "5587"), parseInt(cfg.maxIterations, 10) || 0))); // 0 = unlimited
    cfg.maxMutantsPerFile = stryMutAct_9fa48("5590") ? parseInt(cfg.maxMutantsPerFile, 10) && 5 : stryMutAct_9fa48("5589") ? false : stryMutAct_9fa48("5588") ? true : (stryCov_9fa48("5588", "5589", "5590"), parseInt(cfg.maxMutantsPerFile, 10) || 5);
    cfg.maxAttemptsPerFile = stryMutAct_9fa48("5593") ? parseInt(cfg.maxAttemptsPerFile, 10) && 3 : stryMutAct_9fa48("5592") ? false : stryMutAct_9fa48("5591") ? true : (stryCov_9fa48("5591", "5592", "5593"), parseInt(cfg.maxAttemptsPerFile, 10) || 3);
    if (stryMutAct_9fa48("5596") ? false : stryMutAct_9fa48("5595") ? true : stryMutAct_9fa48("5594") ? cfg.prBase : (stryCov_9fa48("5594", "5595", "5596"), !cfg.prBase)) cfg.prBase = cfg.repoBranch;
    return stryMutAct_9fa48("5597") ? {} : (stryCov_9fa48("5597"), {
      id: (stryMutAct_9fa48("5598") ? "" : (stryCov_9fa48("5598"), 'run-')) + Date.now(),
      startedAt: nowSec(),
      finishedAt: null,
      status: stryMutAct_9fa48("5599") ? "" : (stryCov_9fa48("5599"), 'running'),
      config: cfg,
      iteration: 0,
      baseline: stryMutAct_9fa48("5600") ? {} : (stryCov_9fa48("5600"), {
        coveragePct: null,
        mutationPct: null,
        mac: null
      }),
      result: stryMutAct_9fa48("5601") ? {} : (stryCov_9fa48("5601"), {
        coveragePct: null,
        mutationPct: null,
        mac: null
      })
    });
  }
}
const state = stryMutAct_9fa48("5602") ? {} : (stryCov_9fa48("5602"), {
  run: null,
  stage: stryMutAct_9fa48("5603") ? {} : (stryCov_9fa48("5603"), {
    name: stryMutAct_9fa48("5604") ? "" : (stryCov_9fa48("5604"), 'idle'),
    detail: stryMutAct_9fa48("5605") ? "Stryker was here!" : (stryCov_9fa48("5605"), ''),
    since: nowSec(),
    progress: null
  }),
  runner: null,
  // { pm, testRunner, hasStrykerConfig }
  files: {},
  // path -> file record
  decisions: {},
  // ruleStage -> last application result
  prs: stryMutAct_9fa48("5606") ? ["Stryker was here"] : (stryCov_9fa48("5606"), []),
  events: stryMutAct_9fa48("5607") ? ["Stryker was here"] : (stryCov_9fa48("5607"), []),
  seq: 0,
  // per-repo ledger of final file dispositions, SURVIVES run/start — enables
  // batched full-repo runs and crash-restart without redoing finished files.
  // { [repoSlug]: { [path]: {state: 'improved'|'exhausted'|'failed', prUrl?, ts} } }
  improvedLedger: {},
  // per-repo cumulative clone/install/baseline seconds, so the FTE ratio counts
  // run overhead and not just per-file work
  overheadLedger: {},
  // per-repo measurements for EVERY file we ever measured, improved or not:
  // baseline coverage/mutation/MAC plus what the best attempt reached. Kept
  // separate from improvedLedger because these entries say nothing about
  // whether a file is settled — they exist so the numbers survive batches.
  // { [repoSlug]: { [path]: {coverageBefore, mutationBefore, macBefore,
  //                          attemptCoverage, attemptMutation, attemptMac, ts} } }
  measureLedger: {},
  // per-repo cumulative LLM spend { in, out, calls }, survives run/start
  tokenLedger: {},
  // rolling transcript of model exchanges, newest last (full text goes to
  // /data/dialog.jsonl; this buffer is what the dashboard streams)
  dialog: stryMutAct_9fa48("5608") ? ["Stryker was here"] : (stryCov_9fa48("5608"), []),
  dialogSeq: 0
});
const MAX_DIALOG_IN_STATE = 40;
const DIALOG_FILE = path.join(DATA_DIR, stryMutAct_9fa48("5609") ? "" : (stryCov_9fa48("5609"), 'dialog.jsonl'));

/** Record one model exchange so it can be watched live. */
function recordDialog(entry) {
  if (stryMutAct_9fa48("5610")) {
    {}
  } else {
    stryCov_9fa48("5610");
    stryMutAct_9fa48("5611") ? state.dialogSeq -= 1 : (stryCov_9fa48("5611"), state.dialogSeq += 1);
    const picked = Object.values(state.files).find(stryMutAct_9fa48("5612") ? () => undefined : (stryCov_9fa48("5612"), f => stryMutAct_9fa48("5615") ? f.status !== 'picked' : stryMutAct_9fa48("5614") ? false : stryMutAct_9fa48("5613") ? true : (stryCov_9fa48("5613", "5614", "5615"), f.status === (stryMutAct_9fa48("5616") ? "" : (stryCov_9fa48("5616"), 'picked')))));
    const full = stryMutAct_9fa48("5617") ? {} : (stryCov_9fa48("5617"), {
      seq: state.dialogSeq,
      ts: nowSec(),
      stage: stryMutAct_9fa48("5620") ? state.stage?.name && 'idle' : stryMutAct_9fa48("5619") ? false : stryMutAct_9fa48("5618") ? true : (stryCov_9fa48("5618", "5619", "5620"), (stryMutAct_9fa48("5621") ? state.stage.name : (stryCov_9fa48("5621"), state.stage?.name)) || (stryMutAct_9fa48("5622") ? "" : (stryCov_9fa48("5622"), 'idle'))),
      detail: stryMutAct_9fa48("5625") ? state.stage?.detail && '' : stryMutAct_9fa48("5624") ? false : stryMutAct_9fa48("5623") ? true : (stryCov_9fa48("5623", "5624", "5625"), (stryMutAct_9fa48("5626") ? state.stage.detail : (stryCov_9fa48("5626"), state.stage?.detail)) || (stryMutAct_9fa48("5627") ? "Stryker was here!" : (stryCov_9fa48("5627"), ''))),
      file: stryMutAct_9fa48("5630") ? picked?.path && null : stryMutAct_9fa48("5629") ? false : stryMutAct_9fa48("5628") ? true : (stryCov_9fa48("5628", "5629", "5630"), (stryMutAct_9fa48("5631") ? picked.path : (stryCov_9fa48("5631"), picked?.path)) || null),
      ...entry
    });
    try {
      if (stryMutAct_9fa48("5632")) {
        {}
      } else {
        stryCov_9fa48("5632");
        fs.appendFileSync(DIALOG_FILE, JSON.stringify(full) + (stryMutAct_9fa48("5633") ? "" : (stryCov_9fa48("5633"), '\n')));
      }
    } catch {}
    // the in-memory copy is trimmed: prompts run to tens of thousands of characters
    const clip = (s, n) => {
      if (stryMutAct_9fa48("5634")) {
        {}
      } else {
        stryCov_9fa48("5634");
        const t = redact(stryMutAct_9fa48("5637") ? s && '' : stryMutAct_9fa48("5636") ? false : stryMutAct_9fa48("5635") ? true : (stryCov_9fa48("5635", "5636", "5637"), s || (stryMutAct_9fa48("5638") ? "Stryker was here!" : (stryCov_9fa48("5638"), ''))));
        return (stryMutAct_9fa48("5642") ? t.length <= n : stryMutAct_9fa48("5641") ? t.length >= n : stryMutAct_9fa48("5640") ? false : stryMutAct_9fa48("5639") ? true : (stryCov_9fa48("5639", "5640", "5641", "5642"), t.length > n)) ? (stryMutAct_9fa48("5643") ? t : (stryCov_9fa48("5643"), t.slice(0, n))) + (stryMutAct_9fa48("5644") ? `` : (stryCov_9fa48("5644"), `\n… [${stryMutAct_9fa48("5645") ? t.length + n : (stryCov_9fa48("5645"), t.length - n)} more chars]`)) : t;
      }
    };
    state.dialog.push(stryMutAct_9fa48("5646") ? {} : (stryCov_9fa48("5646"), {
      ...full,
      system: clip(full.system, 1500),
      prompt: clip(full.prompt, 4000),
      response: clip(full.response, 4000)
    }));
    if (stryMutAct_9fa48("5650") ? state.dialog.length <= MAX_DIALOG_IN_STATE : stryMutAct_9fa48("5649") ? state.dialog.length >= MAX_DIALOG_IN_STATE : stryMutAct_9fa48("5648") ? false : stryMutAct_9fa48("5647") ? true : (stryCov_9fa48("5647", "5648", "5649", "5650"), state.dialog.length > MAX_DIALOG_IN_STATE)) {
      if (stryMutAct_9fa48("5651")) {
        {}
      } else {
        stryCov_9fa48("5651");
        state.dialog.splice(0, stryMutAct_9fa48("5652") ? state.dialog.length + MAX_DIALOG_IN_STATE : (stryCov_9fa48("5652"), state.dialog.length - MAX_DIALOG_IN_STATE));
      }
    }
    save();
  }
}

/**
 * Count one model response. Attributed three ways: to the file currently being
 * worked on (so a PR can say what it cost), to the run, and to a per-repo
 * accumulator that outlives batches.
 */
function recordTokens(usage) {
  if (stryMutAct_9fa48("5653")) {
    {}
  } else {
    stryCov_9fa48("5653");
    const slug = slugify(stryMutAct_9fa48("5656") ? state.run?.config?.repoUrl && '' : stryMutAct_9fa48("5655") ? false : stryMutAct_9fa48("5654") ? true : (stryCov_9fa48("5654", "5655", "5656"), (stryMutAct_9fa48("5658") ? state.run.config?.repoUrl : stryMutAct_9fa48("5657") ? state.run?.config.repoUrl : (stryCov_9fa48("5657", "5658"), state.run?.config?.repoUrl)) || (stryMutAct_9fa48("5659") ? "Stryker was here!" : (stryCov_9fa48("5659"), ''))));
    state.tokenLedger[slug] = addUsage(state.tokenLedger[slug], usage);
    if (stryMutAct_9fa48("5661") ? false : stryMutAct_9fa48("5660") ? true : (stryCov_9fa48("5660", "5661"), state.run)) state.run.tokens = addUsage(state.run.tokens, usage);
    const picked = Object.values(state.files).find(stryMutAct_9fa48("5662") ? () => undefined : (stryCov_9fa48("5662"), f => stryMutAct_9fa48("5665") ? f.status !== 'picked' : stryMutAct_9fa48("5664") ? false : stryMutAct_9fa48("5663") ? true : (stryCov_9fa48("5663", "5664", "5665"), f.status === (stryMutAct_9fa48("5666") ? "" : (stryCov_9fa48("5666"), 'picked')))));
    if (stryMutAct_9fa48("5668") ? false : stryMutAct_9fa48("5667") ? true : (stryCov_9fa48("5667", "5668"), picked)) picked.tokens = addUsage(picked.tokens, usage);
    save();
  }
}
function load() {
  if (stryMutAct_9fa48("5669")) {
    {}
  } else {
    stryCov_9fa48("5669");
    try {
      if (stryMutAct_9fa48("5670")) {
        {}
      } else {
        stryCov_9fa48("5670");
        const raw = JSON.parse(fs.readFileSync(STATE_FILE, stryMutAct_9fa48("5671") ? "" : (stryCov_9fa48("5671"), 'utf8')));
        Object.assign(state, raw);
        if (stryMutAct_9fa48("5674") ? state.run || state.run.status === 'running' : stryMutAct_9fa48("5673") ? false : stryMutAct_9fa48("5672") ? true : (stryCov_9fa48("5672", "5673", "5674"), state.run && (stryMutAct_9fa48("5676") ? state.run.status !== 'running' : stryMutAct_9fa48("5675") ? true : (stryCov_9fa48("5675", "5676"), state.run.status === (stryMutAct_9fa48("5677") ? "" : (stryCov_9fa48("5677"), 'running')))))) {
          if (stryMutAct_9fa48("5678")) {
            {}
          } else {
            stryCov_9fa48("5678");
            // process restarted mid-run
            state.stage = stryMutAct_9fa48("5679") ? {} : (stryCov_9fa48("5679"), {
              name: stryMutAct_9fa48("5680") ? "" : (stryCov_9fa48("5680"), 'interrupted'),
              detail: stryMutAct_9fa48("5681") ? "" : (stryCov_9fa48("5681"), 'sidecar restarted'),
              since: nowSec(),
              progress: null
            });
          }
        }
      }
    } catch {/* first boot */}
  }
}
let flushTimer = null;
function save() {
  if (stryMutAct_9fa48("5682")) {
    {}
  } else {
    stryCov_9fa48("5682");
    if (stryMutAct_9fa48("5684") ? false : stryMutAct_9fa48("5683") ? true : (stryCov_9fa48("5683", "5684"), flushTimer)) return;
    flushTimer = setTimeout(() => {
      if (stryMutAct_9fa48("5685")) {
        {}
      } else {
        stryCov_9fa48("5685");
        flushTimer = null;
        try {
          if (stryMutAct_9fa48("5686")) {
            {}
          } else {
            stryCov_9fa48("5686");
            fs.mkdirSync(DATA_DIR, stryMutAct_9fa48("5687") ? {} : (stryCov_9fa48("5687"), {
              recursive: stryMutAct_9fa48("5688") ? false : (stryCov_9fa48("5688"), true)
            }));
            const tmp = STATE_FILE + (stryMutAct_9fa48("5689") ? "" : (stryCov_9fa48("5689"), '.tmp'));
            fs.writeFileSync(tmp, JSON.stringify(state));
            fs.renameSync(tmp, STATE_FILE);
          }
        } catch (e) {
          if (stryMutAct_9fa48("5690")) {
            {}
          } else {
            stryCov_9fa48("5690");
            console.error(stryMutAct_9fa48("5691") ? "" : (stryCov_9fa48("5691"), 'state save failed:'), e.message);
          }
        }
      }
    }, 150);
  }
}
function event(stage, msg) {
  if (stryMutAct_9fa48("5692")) {
    {}
  } else {
    stryCov_9fa48("5692");
    stryMutAct_9fa48("5693") ? state.seq -= 1 : (stryCov_9fa48("5693"), state.seq += 1);
    const entry = stryMutAct_9fa48("5694") ? {} : (stryCov_9fa48("5694"), {
      seq: state.seq,
      ts: nowSec(),
      stage,
      msg: stryMutAct_9fa48("5695") ? redact(msg) : (stryCov_9fa48("5695"), redact(msg).slice(0, 500))
    });
    state.events.push(entry);
    if (stryMutAct_9fa48("5699") ? state.events.length <= MAX_EVENTS_IN_STATE : stryMutAct_9fa48("5698") ? state.events.length >= MAX_EVENTS_IN_STATE : stryMutAct_9fa48("5697") ? false : stryMutAct_9fa48("5696") ? true : (stryCov_9fa48("5696", "5697", "5698", "5699"), state.events.length > MAX_EVENTS_IN_STATE)) state.events.splice(0, stryMutAct_9fa48("5700") ? state.events.length + MAX_EVENTS_IN_STATE : (stryCov_9fa48("5700"), state.events.length - MAX_EVENTS_IN_STATE));
    try {
      if (stryMutAct_9fa48("5701")) {
        {}
      } else {
        stryCov_9fa48("5701");
        fs.appendFileSync(EVENTS_FILE, JSON.stringify(entry) + (stryMutAct_9fa48("5702") ? "" : (stryCov_9fa48("5702"), '\n')));
      }
    } catch {}
    save();
    console.log(stryMutAct_9fa48("5703") ? `` : (stryCov_9fa48("5703"), `[${stage}] ${msg}`));
  }
}
function setStage(name, rawDetail = stryMutAct_9fa48("5704") ? "Stryker was here!" : (stryCov_9fa48("5704"), '')) {
  if (stryMutAct_9fa48("5705")) {
    {}
  } else {
    stryCov_9fa48("5705");
    const detail = redact(rawDetail);
    if (stryMutAct_9fa48("5708") ? state.stage.name !== name && state.stage.detail !== detail : stryMutAct_9fa48("5707") ? false : stryMutAct_9fa48("5706") ? true : (stryCov_9fa48("5706", "5707", "5708"), (stryMutAct_9fa48("5710") ? state.stage.name === name : stryMutAct_9fa48("5709") ? false : (stryCov_9fa48("5709", "5710"), state.stage.name !== name)) || (stryMutAct_9fa48("5712") ? state.stage.detail === detail : stryMutAct_9fa48("5711") ? false : (stryCov_9fa48("5711", "5712"), state.stage.detail !== detail)))) {
      if (stryMutAct_9fa48("5713")) {
        {}
      } else {
        stryCov_9fa48("5713");
        state.stage = stryMutAct_9fa48("5714") ? {} : (stryCov_9fa48("5714"), {
          name,
          detail,
          since: nowSec(),
          progress: null
        });
        event(name, stryMutAct_9fa48("5717") ? detail && name : stryMutAct_9fa48("5716") ? false : stryMutAct_9fa48("5715") ? true : (stryCov_9fa48("5715", "5716", "5717"), detail || name));
      }
    }
    save();
  }
}
function setProgress(line, elapsed) {
  if (stryMutAct_9fa48("5718")) {
    {}
  } else {
    stryCov_9fa48("5718");
    // child-process output: may echo credentials we passed in
    state.stage.progress = stryMutAct_9fa48("5719") ? {} : (stryCov_9fa48("5719"), {
      line: stryMutAct_9fa48("5720") ? redact(line) : (stryCov_9fa48("5720"), redact(line).slice(0, 200)),
      elapsed,
      ts: nowSec()
    });
    save();
  }
}
function upsertFile(p, patch) {
  if (stryMutAct_9fa48("5721")) {
    {}
  } else {
    stryCov_9fa48("5721");
    const f = stryMutAct_9fa48("5724") ? state.files[p] && {
      path: p,
      coverage: null,
      mutation: null,
      mac: null,
      macBefore: null,
      macAfter: null,
      status: 'candidate',
      attempts: 0,
      branch: null,
      prUrl: null,
      prPatch: null,
      updatedAt: nowSec()
    } : stryMutAct_9fa48("5723") ? false : stryMutAct_9fa48("5722") ? true : (stryCov_9fa48("5722", "5723", "5724"), state.files[p] || (stryMutAct_9fa48("5725") ? {} : (stryCov_9fa48("5725"), {
      path: p,
      coverage: null,
      mutation: null,
      mac: null,
      macBefore: null,
      macAfter: null,
      status: stryMutAct_9fa48("5726") ? "" : (stryCov_9fa48("5726"), 'candidate'),
      attempts: 0,
      branch: null,
      prUrl: null,
      prPatch: null,
      updatedAt: nowSec()
    })));
    Object.assign(f, patch, stryMutAct_9fa48("5727") ? {} : (stryCov_9fa48("5727"), {
      updatedAt: nowSec()
    }));
    state.files[p] = f;
    save();
    return f;
  }
}
module.exports = stryMutAct_9fa48("5728") ? {} : (stryCov_9fa48("5728"), {
  state,
  load,
  save,
  event,
  setStage,
  setProgress,
  upsertFile,
  recordTokens,
  recordDialog,
  freshRun,
  envConfig,
  DATA_DIR
});