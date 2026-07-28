// @ts-nocheck
'use strict';

// Per-stage team rules. Rule text comes from env/run config; application = LLM
// interpretation with mechanical guardrails; results recorded in state.decisions.
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
  state,
  event
} = require('./state');
const {
  readFileSafe
} = require('./repo');
const {
  chat
} = require('./llm');
function rules() {
  if (stryMutAct_9fa48("2837")) {
    {}
  } else {
    stryCov_9fa48("2837");
    return stryMutAct_9fa48("2840") ? state.run?.config?.rules && {} : stryMutAct_9fa48("2839") ? false : stryMutAct_9fa48("2838") ? true : (stryCov_9fa48("2838", "2839", "2840"), (stryMutAct_9fa48("2842") ? state.run.config?.rules : stryMutAct_9fa48("2841") ? state.run?.config.rules : (stryCov_9fa48("2841", "2842"), state.run?.config?.rules)) || {});
  }
}
function repoContextHead() {
  if (stryMutAct_9fa48("2843")) {
    {}
  } else {
    stryCov_9fa48("2843");
    const parts = stryMutAct_9fa48("2844") ? ["Stryker was here"] : (stryCov_9fa48("2844"), []);
    for (const f of stryMutAct_9fa48("2845") ? [] : (stryCov_9fa48("2845"), [stryMutAct_9fa48("2846") ? "" : (stryCov_9fa48("2846"), 'AGENTS.md'), stryMutAct_9fa48("2847") ? "" : (stryCov_9fa48("2847"), 'CONTRIBUTING.md'), stryMutAct_9fa48("2848") ? "" : (stryCov_9fa48("2848"), 'README.md')])) {
      if (stryMutAct_9fa48("2849")) {
        {}
      } else {
        stryCov_9fa48("2849");
        const c = readFileSafe(f, 4000);
        if (stryMutAct_9fa48("2851") ? false : stryMutAct_9fa48("2850") ? true : (stryCov_9fa48("2850", "2851"), c)) parts.push(stryMutAct_9fa48("2852") ? `` : (stryCov_9fa48("2852"), `--- ${f} (head) ---\n${c}`));
      }
    }
    return stryMutAct_9fa48("2855") ? parts.join('\n\n') && '(no AGENTS.md / CONTRIBUTING.md / README.md found)' : stryMutAct_9fa48("2854") ? false : stryMutAct_9fa48("2853") ? true : (stryCov_9fa48("2853", "2854", "2855"), parts.join(stryMutAct_9fa48("2856") ? "" : (stryCov_9fa48("2856"), '\n\n')) || (stryMutAct_9fa48("2857") ? "" : (stryCov_9fa48("2857"), '(no AGENTS.md / CONTRIBUTING.md / README.md found)')));
  }
}

/** Free-text guidance assembled for test-writing prompts. */
function testWritingConstraints() {
  if (stryMutAct_9fa48("2858")) {
    {}
  } else {
    stryCov_9fa48("2858");
    const out = stryMutAct_9fa48("2859") ? ["Stryker was here"] : (stryCov_9fa48("2859"), []);
    const d = stryMutAct_9fa48("2862") ? state.decisions && {} : stryMutAct_9fa48("2861") ? false : stryMutAct_9fa48("2860") ? true : (stryCov_9fa48("2860", "2861", "2862"), state.decisions || {});
    // apply() stores every stage as { rule, result, ts }, so the constraints the
    // post-clone stage extracted live under .result. Reading .constraints directly
    // always found undefined, which meant everything a team's AGENTS.md said —
    // conventions, forbidden helpers, house style — was silently dropped before the
    // test-writing prompt ever saw it. (The pre-`result` shape is still accepted so a
    // state.json written by an older build keeps working.)
    const postClone = stryMutAct_9fa48("2865") ? d.post_clone?.result?.constraints && d.post_clone?.constraints : stryMutAct_9fa48("2864") ? false : stryMutAct_9fa48("2863") ? true : (stryCov_9fa48("2863", "2864", "2865"), (stryMutAct_9fa48("2867") ? d.post_clone.result?.constraints : stryMutAct_9fa48("2866") ? d.post_clone?.result.constraints : (stryCov_9fa48("2866", "2867"), d.post_clone?.result?.constraints)) || (stryMutAct_9fa48("2868") ? d.post_clone.constraints : (stryCov_9fa48("2868"), d.post_clone?.constraints)));
    if (stryMutAct_9fa48("2871") ? postClone.length : stryMutAct_9fa48("2870") ? false : stryMutAct_9fa48("2869") ? true : (stryCov_9fa48("2869", "2870", "2871"), postClone?.length)) out.push(...postClone);
    if (stryMutAct_9fa48("2873") ? false : stryMutAct_9fa48("2872") ? true : (stryCov_9fa48("2872", "2873"), rules().write_test)) out.push(rules().write_test);
    return out;
  }
}
async function apply(stage, context = {}) {
  if (stryMutAct_9fa48("2874")) {
    {}
  } else {
    stryCov_9fa48("2874");
    const ruleText = stryMutAct_9fa48("2877") ? rules()[stage] && '' : stryMutAct_9fa48("2876") ? false : stryMutAct_9fa48("2875") ? true : (stryCov_9fa48("2875", "2876", "2877"), rules()[stage] || (stryMutAct_9fa48("2878") ? "Stryker was here!" : (stryCov_9fa48("2878"), '')));
    let result;
    switch (stage) {
      case stryMutAct_9fa48("2880") ? "" : (stryCov_9fa48("2880"), 'post_clone'):
        if (stryMutAct_9fa48("2879")) {} else {
          stryCov_9fa48("2879");
          result = await applyPostClone(ruleText);
          break;
        }
      case stryMutAct_9fa48("2882") ? "" : (stryCov_9fa48("2882"), 'pre_pick'):
        if (stryMutAct_9fa48("2881")) {} else {
          stryCov_9fa48("2881");
          result = await applyPrePick(ruleText);
          break;
        }
      case stryMutAct_9fa48("2884") ? "" : (stryCov_9fa48("2884"), 'pick_file'):
        if (stryMutAct_9fa48("2883")) {} else {
          stryCov_9fa48("2883");
          result = await applyPickFile(ruleText, context);
          break;
        }
      case stryMutAct_9fa48("2886") ? "" : (stryCov_9fa48("2886"), 'write_test'):
        if (stryMutAct_9fa48("2885")) {} else {
          stryCov_9fa48("2885");
          result = stryMutAct_9fa48("2887") ? {} : (stryCov_9fa48("2887"), {
            constraints: testWritingConstraints()
          });
          break;
        }
      case stryMutAct_9fa48("2889") ? "" : (stryCov_9fa48("2889"), 'check_changes'):
        if (stryMutAct_9fa48("2888")) {} else {
          stryCov_9fa48("2888");
          result = await applyCheckChanges(ruleText, context);
          break;
        }
      case stryMutAct_9fa48("2891") ? "" : (stryCov_9fa48("2891"), 'make_pr'):
        if (stryMutAct_9fa48("2890")) {} else {
          stryCov_9fa48("2890");
          result = await applyMakePr(ruleText, context);
          break;
        }
      default:
        if (stryMutAct_9fa48("2892")) {} else {
          stryCov_9fa48("2892");
          throw new Error((stryMutAct_9fa48("2893") ? "" : (stryCov_9fa48("2893"), 'unknown rule stage: ')) + stage);
        }
    }
    state.decisions[stage] = stryMutAct_9fa48("2894") ? {} : (stryCov_9fa48("2894"), {
      rule: ruleText,
      result,
      ts: Date.now()
    });
    event(stryMutAct_9fa48("2895") ? "" : (stryCov_9fa48("2895"), 'rules'), stryMutAct_9fa48("2896") ? `` : (stryCov_9fa48("2896"), `applied ${stage} rules: ${stryMutAct_9fa48("2897") ? JSON.stringify(result) : (stryCov_9fa48("2897"), JSON.stringify(result).slice(0, 240))}`));
    return result;
  }
}
async function applyPostClone(ruleText) {
  if (stryMutAct_9fa48("2898")) {
    {}
  } else {
    stryCov_9fa48("2898");
    if (stryMutAct_9fa48("2901") ? false : stryMutAct_9fa48("2900") ? true : stryMutAct_9fa48("2899") ? ruleText : (stryCov_9fa48("2899", "2900", "2901"), !ruleText)) return stryMutAct_9fa48("2902") ? {} : (stryCov_9fa48("2902"), {
      constraints: stryMutAct_9fa48("2903") ? ["Stryker was here"] : (stryCov_9fa48("2903"), []),
      notes: stryMutAct_9fa48("2904") ? "" : (stryCov_9fa48("2904"), 'no post-clone rules configured')
    });
    const r = await chat(stryMutAct_9fa48("2905") ? {} : (stryCov_9fa48("2905"), {
      system: stryMutAct_9fa48("2906") ? "" : (stryCov_9fa48("2906"), 'You are configuring an automated test-improvement pipeline. Extract actionable constraints from the team rule and repo docs. Reply ONLY with JSON: {"constraints": ["short imperative constraint", ...], "notes": "one line"}. Constraints are things the pipeline must honor when writing tests, naming branches, or making PRs.'),
      prompt: stryMutAct_9fa48("2907") ? `` : (stryCov_9fa48("2907"), `TEAM RULE (post-clone): ${ruleText}\n\nREPO DOCS:\n${repoContextHead()}`),
      json: stryMutAct_9fa48("2908") ? false : (stryCov_9fa48("2908"), true),
      decision: stryMutAct_9fa48("2909") ? false : (stryCov_9fa48("2909"), true),
      maxTokens: 1200
    }));
    return stryMutAct_9fa48("2912") ? r.json && {
      constraints: [ruleText],
      notes: 'LLM parse failed, using raw rule text'
    } : stryMutAct_9fa48("2911") ? false : stryMutAct_9fa48("2910") ? true : (stryCov_9fa48("2910", "2911", "2912"), r.json || (stryMutAct_9fa48("2913") ? {} : (stryCov_9fa48("2913"), {
      constraints: stryMutAct_9fa48("2914") ? [] : (stryCov_9fa48("2914"), [ruleText]),
      notes: stryMutAct_9fa48("2915") ? "" : (stryCov_9fa48("2915"), 'LLM parse failed, using raw rule text')
    })));
  }
}
async function applyPrePick(ruleText) {
  if (stryMutAct_9fa48("2916")) {
    {}
  } else {
    stryCov_9fa48("2916");
    const dflt = stryMutAct_9fa48("2917") ? {} : (stryCov_9fa48("2917"), {
      branchTemplate: stryMutAct_9fa48("2918") ? "" : (stryCov_9fa48("2918"), 'tests/improve-{file}'),
      notes: stryMutAct_9fa48("2919") ? "" : (stryCov_9fa48("2919"), 'default branch naming')
    });
    if (stryMutAct_9fa48("2922") ? false : stryMutAct_9fa48("2921") ? true : stryMutAct_9fa48("2920") ? ruleText : (stryCov_9fa48("2920", "2921", "2922"), !ruleText)) return dflt;
    const r = await chat(stryMutAct_9fa48("2923") ? {} : (stryCov_9fa48("2923"), {
      system: stryMutAct_9fa48("2924") ? "" : (stryCov_9fa48("2924"), 'You configure branching for an automated test-improvement pipeline. From the team rule, produce JSON only: {"branchTemplate": "template containing {file} placeholder", "notes": "one line"}. The template must be a valid git branch name pattern; {file} will be replaced by a slug of the source file.'),
      prompt: stryMutAct_9fa48("2925") ? `` : (stryCov_9fa48("2925"), `TEAM RULE (before picking a file): ${ruleText}\n\nREPO DOCS:\n${repoContextHead()}`),
      json: stryMutAct_9fa48("2926") ? false : (stryCov_9fa48("2926"), true),
      decision: stryMutAct_9fa48("2927") ? false : (stryCov_9fa48("2927"), true),
      maxTokens: 800
    }));
    const j = r.json;
    if (stryMutAct_9fa48("2930") ? !j?.branchTemplate && !j.branchTemplate.includes('{file}') : stryMutAct_9fa48("2929") ? false : stryMutAct_9fa48("2928") ? true : (stryCov_9fa48("2928", "2929", "2930"), (stryMutAct_9fa48("2931") ? j?.branchTemplate : (stryCov_9fa48("2931"), !(stryMutAct_9fa48("2932") ? j.branchTemplate : (stryCov_9fa48("2932"), j?.branchTemplate)))) || (stryMutAct_9fa48("2933") ? j.branchTemplate.includes('{file}') : (stryCov_9fa48("2933"), !j.branchTemplate.includes(stryMutAct_9fa48("2934") ? "" : (stryCov_9fa48("2934"), '{file}')))))) return stryMutAct_9fa48("2935") ? {} : (stryCov_9fa48("2935"), {
      ...dflt,
      notes: stryMutAct_9fa48("2936") ? "" : (stryCov_9fa48("2936"), 'rule did not yield a usable template')
    });
    j.branchTemplate = j.branchTemplate.replace(stryMutAct_9fa48("2938") ? /[a-zA-Z0-9/_{}.-]+/g : stryMutAct_9fa48("2937") ? /[^a-zA-Z0-9/_{}.-]/g : (stryCov_9fa48("2937", "2938"), /[^a-zA-Z0-9/_{}.-]+/g), stryMutAct_9fa48("2939") ? "" : (stryCov_9fa48("2939"), '-'));
    return j;
  }
}
async function applyPickFile(ruleText, {
  candidates = stryMutAct_9fa48("2940") ? ["Stryker was here"] : (stryCov_9fa48("2940"), [])
}) {
  if (stryMutAct_9fa48("2941")) {
    {}
  } else {
    stryCov_9fa48("2941");
    if (stryMutAct_9fa48("2944") ? false : stryMutAct_9fa48("2943") ? true : stryMutAct_9fa48("2942") ? candidates.length : (stryCov_9fa48("2942", "2943", "2944"), !candidates.length)) return stryMutAct_9fa48("2945") ? {} : (stryCov_9fa48("2945"), {
      file: null,
      reason: stryMutAct_9fa48("2946") ? "" : (stryCov_9fa48("2946"), 'no candidates')
    });
    // Mechanical default: lowest MAC (nulls treated as 0 → weakest tested first).
    const scored = stryMutAct_9fa48("2948") ? candidates.sort((a, b) => (a.mac ?? (a.coverage ?? 0) * 0.01 * (a.mutation ?? 0)) - (b.mac ?? (b.coverage ?? 0) * 0.01 * (b.mutation ?? 0)) || (a.coverage ?? 0) - (b.coverage ?? 0)) : stryMutAct_9fa48("2947") ? candidates.slice() : (stryCov_9fa48("2947", "2948"), candidates.slice().sort(stryMutAct_9fa48("2949") ? () => undefined : (stryCov_9fa48("2949"), (a, b) => stryMutAct_9fa48("2952") ? (a.mac ?? (a.coverage ?? 0) * 0.01 * (a.mutation ?? 0)) - (b.mac ?? (b.coverage ?? 0) * 0.01 * (b.mutation ?? 0)) && (a.coverage ?? 0) - (b.coverage ?? 0) : stryMutAct_9fa48("2951") ? false : stryMutAct_9fa48("2950") ? true : (stryCov_9fa48("2950", "2951", "2952"), (stryMutAct_9fa48("2953") ? (a.mac ?? (a.coverage ?? 0) * 0.01 * (a.mutation ?? 0)) + (b.mac ?? (b.coverage ?? 0) * 0.01 * (b.mutation ?? 0)) : (stryCov_9fa48("2953"), (stryMutAct_9fa48("2954") ? a.mac && (a.coverage ?? 0) * 0.01 * (a.mutation ?? 0) : (stryCov_9fa48("2954"), a.mac ?? (stryMutAct_9fa48("2955") ? (a.coverage ?? 0) * 0.01 / (a.mutation ?? 0) : (stryCov_9fa48("2955"), (stryMutAct_9fa48("2956") ? (a.coverage ?? 0) / 0.01 : (stryCov_9fa48("2956"), (stryMutAct_9fa48("2957") ? a.coverage && 0 : (stryCov_9fa48("2957"), a.coverage ?? 0)) * 0.01)) * (stryMutAct_9fa48("2958") ? a.mutation && 0 : (stryCov_9fa48("2958"), a.mutation ?? 0)))))) - (stryMutAct_9fa48("2959") ? b.mac && (b.coverage ?? 0) * 0.01 * (b.mutation ?? 0) : (stryCov_9fa48("2959"), b.mac ?? (stryMutAct_9fa48("2960") ? (b.coverage ?? 0) * 0.01 / (b.mutation ?? 0) : (stryCov_9fa48("2960"), (stryMutAct_9fa48("2961") ? (b.coverage ?? 0) / 0.01 : (stryCov_9fa48("2961"), (stryMutAct_9fa48("2962") ? b.coverage && 0 : (stryCov_9fa48("2962"), b.coverage ?? 0)) * 0.01)) * (stryMutAct_9fa48("2963") ? b.mutation && 0 : (stryCov_9fa48("2963"), b.mutation ?? 0)))))))) || (stryMutAct_9fa48("2964") ? (a.coverage ?? 0) + (b.coverage ?? 0) : (stryCov_9fa48("2964"), (stryMutAct_9fa48("2965") ? a.coverage && 0 : (stryCov_9fa48("2965"), a.coverage ?? 0)) - (stryMutAct_9fa48("2966") ? b.coverage && 0 : (stryCov_9fa48("2966"), b.coverage ?? 0))))))));
    const fallback = stryMutAct_9fa48("2967") ? {} : (stryCov_9fa48("2967"), {
      file: scored[0].path,
      reason: stryMutAct_9fa48("2968") ? "" : (stryCov_9fa48("2968"), 'lowest MAC (mechanical pick)')
    });
    if (stryMutAct_9fa48("2971") ? false : stryMutAct_9fa48("2970") ? true : stryMutAct_9fa48("2969") ? ruleText : (stryCov_9fa48("2969", "2970", "2971"), !ruleText)) return fallback;
    const table = stryMutAct_9fa48("2972") ? candidates.map(c => `${c.path} | coverage=${c.coverage ?? '?'}% mutation=${c.mutation ?? '?'}% mac=${c.mac ?? '?'} attempts=${c.attempts}`).join('\n') : (stryCov_9fa48("2972"), candidates.slice(0, 80).map(stryMutAct_9fa48("2973") ? () => undefined : (stryCov_9fa48("2973"), c => stryMutAct_9fa48("2974") ? `` : (stryCov_9fa48("2974"), `${c.path} | coverage=${stryMutAct_9fa48("2975") ? c.coverage && '?' : (stryCov_9fa48("2975"), c.coverage ?? (stryMutAct_9fa48("2976") ? "" : (stryCov_9fa48("2976"), '?')))}% mutation=${stryMutAct_9fa48("2977") ? c.mutation && '?' : (stryCov_9fa48("2977"), c.mutation ?? (stryMutAct_9fa48("2978") ? "" : (stryCov_9fa48("2978"), '?')))}% mac=${stryMutAct_9fa48("2979") ? c.mac && '?' : (stryCov_9fa48("2979"), c.mac ?? (stryMutAct_9fa48("2980") ? "" : (stryCov_9fa48("2980"), '?')))} attempts=${c.attempts}`))).join(stryMutAct_9fa48("2981") ? "" : (stryCov_9fa48("2981"), '\n')));
    const r = await chat(stryMutAct_9fa48("2982") ? {} : (stryCov_9fa48("2982"), {
      system: stryMutAct_9fa48("2983") ? "" : (stryCov_9fa48("2983"), 'You pick ONE source file for automated test improvement (coverage AND mutation testing). Honor the team rule strictly (e.g. exclusions). Prefer files with the lowest MAC (weakest tests). IMPORTANT: "mutation=?" or "mac=?" means the mutation score has NOT been measured yet — even a 100%-coverage file may have weak assertions and surviving mutants, so such files are VALID candidates; high coverage is NOT a reason to skip a file. Reply ONLY with JSON: {"file": "<path exactly as listed>", "reason": "one line"}. Reply {"file": null, "reason": "..."} ONLY if the team rule excludes every candidate.'),
      prompt: stryMutAct_9fa48("2984") ? `` : (stryCov_9fa48("2984"), `TEAM RULE (how to pick a file): ${ruleText}\n\nCANDIDATES (path | metrics):\n${table}`),
      json: stryMutAct_9fa48("2985") ? false : (stryCov_9fa48("2985"), true),
      decision: stryMutAct_9fa48("2986") ? false : (stryCov_9fa48("2986"), true),
      maxTokens: 800
    }));
    const j = r.json;
    if (stryMutAct_9fa48("2989") ? j || j.file === null : stryMutAct_9fa48("2988") ? false : stryMutAct_9fa48("2987") ? true : (stryCov_9fa48("2987", "2988", "2989"), j && (stryMutAct_9fa48("2991") ? j.file !== null : stryMutAct_9fa48("2990") ? true : (stryCov_9fa48("2990", "2991"), j.file === null)))) {
      if (stryMutAct_9fa48("2992")) {
        {}
      } else {
        stryCov_9fa48("2992");
        // the rule itself excludes everything — terminal, no point retrying
        state.pickFailures = 0;
        return stryMutAct_9fa48("2993") ? {} : (stryCov_9fa48("2993"), {
          file: null,
          retry: stryMutAct_9fa48("2994") ? true : (stryCov_9fa48("2994"), false),
          reason: stryMutAct_9fa48("2997") ? j.reason && 'all candidates excluded by rule' : stryMutAct_9fa48("2996") ? false : stryMutAct_9fa48("2995") ? true : (stryCov_9fa48("2995", "2996", "2997"), j.reason || (stryMutAct_9fa48("2998") ? "" : (stryCov_9fa48("2998"), 'all candidates excluded by rule')))
        });
      }
    }
    if (stryMutAct_9fa48("3001") ? j?.file || candidates.some(c => c.path === j.file) : stryMutAct_9fa48("3000") ? false : stryMutAct_9fa48("2999") ? true : (stryCov_9fa48("2999", "3000", "3001"), (stryMutAct_9fa48("3002") ? j.file : (stryCov_9fa48("3002"), j?.file)) && (stryMutAct_9fa48("3003") ? candidates.every(c => c.path === j.file) : (stryCov_9fa48("3003"), candidates.some(stryMutAct_9fa48("3004") ? () => undefined : (stryCov_9fa48("3004"), c => stryMutAct_9fa48("3007") ? c.path !== j.file : stryMutAct_9fa48("3006") ? false : stryMutAct_9fa48("3005") ? true : (stryCov_9fa48("3005", "3006", "3007"), c.path === j.file))))))) {
      if (stryMutAct_9fa48("3008")) {
        {}
      } else {
        stryCov_9fa48("3008");
        state.pickFailures = 0;
        return stryMutAct_9fa48("3009") ? {} : (stryCov_9fa48("3009"), {
          file: j.file,
          reason: stryMutAct_9fa48("3012") ? j.reason && 'LLM pick' : stryMutAct_9fa48("3011") ? false : stryMutAct_9fa48("3010") ? true : (stryCov_9fa48("3010", "3011", "3012"), j.reason || (stryMutAct_9fa48("3013") ? "" : (stryCov_9fa48("3013"), 'LLM pick')))
        });
      }
    }
    // A team rule exists but the LLM pick is unusable: refuse a blind mechanical
    // pick (it could select a file the rule excludes, e.g. "don't touch ui").
    // This is usually a transient model hiccup, so ask the workflow to retry —
    // but give up after a few consecutive failures instead of spinning.
    state.pickFailures = stryMutAct_9fa48("3014") ? (state.pickFailures || 0) - 1 : (stryCov_9fa48("3014"), (stryMutAct_9fa48("3017") ? state.pickFailures && 0 : stryMutAct_9fa48("3016") ? false : stryMutAct_9fa48("3015") ? true : (stryCov_9fa48("3015", "3016", "3017"), state.pickFailures || 0)) + 1);
    const retry = stryMutAct_9fa48("3021") ? state.pickFailures >= 3 : stryMutAct_9fa48("3020") ? state.pickFailures <= 3 : stryMutAct_9fa48("3019") ? false : stryMutAct_9fa48("3018") ? true : (stryCov_9fa48("3018", "3019", "3020", "3021"), state.pickFailures < 3);
    event(stryMutAct_9fa48("3022") ? "" : (stryCov_9fa48("3022"), 'picking_file'), (stryMutAct_9fa48("3023") ? `` : (stryCov_9fa48("3023"), `pick rule could not be applied (invalid LLM output, ${state.pickFailures}/3) — `)) + (retry ? stryMutAct_9fa48("3024") ? "" : (stryCov_9fa48("3024"), 'retrying with a fresh pick') : stryMutAct_9fa48("3025") ? "" : (stryCov_9fa48("3025"), 'giving up on this batch')));
    return stryMutAct_9fa48("3026") ? {} : (stryCov_9fa48("3026"), {
      file: null,
      retry,
      reason: stryMutAct_9fa48("3027") ? "" : (stryCov_9fa48("3027"), 'pick rule could not be applied reliably; refusing a mechanical pick that might violate team rules')
    });
  }
}
async function applyCheckChanges(ruleText, ctx) {
  if (stryMutAct_9fa48("3028")) {
    {}
  } else {
    stryCov_9fa48("3028");
    // Mechanical gate first: tests must be green and MAC must strictly improve.
    const mech = stryMutAct_9fa48("3029") ? {} : (stryCov_9fa48("3029"), {
      testsGreen: stryMutAct_9fa48("3030") ? !ctx.testsGreen : (stryCov_9fa48("3030"), !(stryMutAct_9fa48("3031") ? ctx.testsGreen : (stryCov_9fa48("3031"), !ctx.testsGreen))),
      macImproved: stryMutAct_9fa48("3035") ? (ctx.macAfter ?? 0) <= (ctx.macBefore ?? 0) : stryMutAct_9fa48("3034") ? (ctx.macAfter ?? 0) >= (ctx.macBefore ?? 0) : stryMutAct_9fa48("3033") ? false : stryMutAct_9fa48("3032") ? true : (stryCov_9fa48("3032", "3033", "3034", "3035"), (stryMutAct_9fa48("3036") ? ctx.macAfter && 0 : (stryCov_9fa48("3036"), ctx.macAfter ?? 0)) > (stryMutAct_9fa48("3037") ? ctx.macBefore && 0 : (stryCov_9fa48("3037"), ctx.macBefore ?? 0)))
    });
    if (stryMutAct_9fa48("3040") ? !mech.testsGreen && !mech.macImproved : stryMutAct_9fa48("3039") ? false : stryMutAct_9fa48("3038") ? true : (stryCov_9fa48("3038", "3039", "3040"), (stryMutAct_9fa48("3041") ? mech.testsGreen : (stryCov_9fa48("3041"), !mech.testsGreen)) || (stryMutAct_9fa48("3042") ? mech.macImproved : (stryCov_9fa48("3042"), !mech.macImproved)))) {
      if (stryMutAct_9fa48("3043")) {
        {}
      } else {
        stryCov_9fa48("3043");
        return stryMutAct_9fa48("3044") ? {} : (stryCov_9fa48("3044"), {
          approved: stryMutAct_9fa48("3045") ? true : (stryCov_9fa48("3045"), false),
          reason: (stryMutAct_9fa48("3046") ? mech.testsGreen : (stryCov_9fa48("3046"), !mech.testsGreen)) ? stryMutAct_9fa48("3047") ? "" : (stryCov_9fa48("3047"), 'test suite is red') : stryMutAct_9fa48("3048") ? `` : (stryCov_9fa48("3048"), `MAC did not improve (${ctx.macBefore} → ${ctx.macAfter})`),
          mechanical: mech
        });
      }
    }
    if (stryMutAct_9fa48("3051") ? false : stryMutAct_9fa48("3050") ? true : stryMutAct_9fa48("3049") ? ruleText : (stryCov_9fa48("3049", "3050", "3051"), !ruleText)) return stryMutAct_9fa48("3052") ? {} : (stryCov_9fa48("3052"), {
      approved: stryMutAct_9fa48("3053") ? false : (stryCov_9fa48("3053"), true),
      reason: stryMutAct_9fa48("3054") ? `` : (stryCov_9fa48("3054"), `MAC ${ctx.macBefore} → ${ctx.macAfter}, suite green`),
      mechanical: mech
    });
    const r = await chat(stryMutAct_9fa48("3055") ? {} : (stryCov_9fa48("3055"), {
      system: stryMutAct_9fa48("3056") ? "" : (stryCov_9fa48("3056"), 'You review automated test changes against a team rule. Mechanical checks already passed (suite green, MAC improved). Judge ONLY the team rule. Reply ONLY with JSON: {"approved": true/false, "reason": "one line"}.'),
      prompt: stryMutAct_9fa48("3057") ? `` : (stryCov_9fa48("3057"), `TEAM RULE (how to check changes are good): ${ruleText}\n\nFILE: ${ctx.file}\nMAC: ${ctx.macBefore} → ${ctx.macAfter} (coverage ${ctx.coverageBefore} → ${ctx.coverageAfter}, mutation ${ctx.mutationBefore} → ${ctx.mutationAfter})\n\nDIFF OF CHANGES:\n${stryMutAct_9fa48("3058") ? String(ctx.diff || '') : (stryCov_9fa48("3058"), String(stryMutAct_9fa48("3061") ? ctx.diff && '' : stryMutAct_9fa48("3060") ? false : stryMutAct_9fa48("3059") ? true : (stryCov_9fa48("3059", "3060", "3061"), ctx.diff || (stryMutAct_9fa48("3062") ? "Stryker was here!" : (stryCov_9fa48("3062"), '')))).slice(0, 12000))}`),
      json: stryMutAct_9fa48("3063") ? false : (stryCov_9fa48("3063"), true),
      decision: stryMutAct_9fa48("3064") ? false : (stryCov_9fa48("3064"), true),
      maxTokens: 800
    }));
    const j = stryMutAct_9fa48("3067") ? r.json && {
      approved: true,
      reason: 'LLM verdict unparseable — mechanical checks passed'
    } : stryMutAct_9fa48("3066") ? false : stryMutAct_9fa48("3065") ? true : (stryCov_9fa48("3065", "3066", "3067"), r.json || (stryMutAct_9fa48("3068") ? {} : (stryCov_9fa48("3068"), {
      approved: stryMutAct_9fa48("3069") ? false : (stryCov_9fa48("3069"), true),
      reason: stryMutAct_9fa48("3070") ? "" : (stryCov_9fa48("3070"), 'LLM verdict unparseable — mechanical checks passed')
    })));
    j.mechanical = mech;
    return j;
  }
}
async function applyMakePr(ruleText, ctx) {
  if (stryMutAct_9fa48("3071")) {
    {}
  } else {
    stryCov_9fa48("3071");
    const dfltTitle = stryMutAct_9fa48("3072") ? `` : (stryCov_9fa48("3072"), `test: improve mutation-adjusted coverage of ${ctx.file}`);
    const dfltBody = stryMutAct_9fa48("3073") ? [`## Test improvements for \`${ctx.file}\``, '', `| metric | before | after |`, `|---|---|---|`, `| line coverage | ${ctx.coverageBefore}% | ${ctx.coverageAfter}% |`, `| mutation score | ${ctx.mutationBefore}% | ${ctx.mutationAfter}% |`, `| **MAC** | **${ctx.macBefore}** | **${ctx.macAfter}** |`, '', ctx.tokens ? `Cost: ${ctx.tokens.in} input / ${ctx.tokens.out} output tokens over ${ctx.tokens.calls} model call(s).` : '', 'Generated by the improve-javascript-tests pipeline.'].join('\n') : (stryCov_9fa48("3073"), (stryMutAct_9fa48("3074") ? [] : (stryCov_9fa48("3074"), [stryMutAct_9fa48("3075") ? `` : (stryCov_9fa48("3075"), `## Test improvements for \`${ctx.file}\``), stryMutAct_9fa48("3076") ? "Stryker was here!" : (stryCov_9fa48("3076"), ''), stryMutAct_9fa48("3077") ? `` : (stryCov_9fa48("3077"), `| metric | before | after |`), stryMutAct_9fa48("3078") ? `` : (stryCov_9fa48("3078"), `|---|---|---|`), stryMutAct_9fa48("3079") ? `` : (stryCov_9fa48("3079"), `| line coverage | ${ctx.coverageBefore}% | ${ctx.coverageAfter}% |`), stryMutAct_9fa48("3080") ? `` : (stryCov_9fa48("3080"), `| mutation score | ${ctx.mutationBefore}% | ${ctx.mutationAfter}% |`), stryMutAct_9fa48("3081") ? `` : (stryCov_9fa48("3081"), `| **MAC** | **${ctx.macBefore}** | **${ctx.macAfter}** |`), stryMutAct_9fa48("3082") ? "Stryker was here!" : (stryCov_9fa48("3082"), ''), ctx.tokens ? stryMutAct_9fa48("3083") ? `` : (stryCov_9fa48("3083"), `Cost: ${ctx.tokens.in} input / ${ctx.tokens.out} output tokens over ${ctx.tokens.calls} model call(s).`) : stryMutAct_9fa48("3084") ? "Stryker was here!" : (stryCov_9fa48("3084"), ''), stryMutAct_9fa48("3085") ? "" : (stryCov_9fa48("3085"), 'Generated by the improve-javascript-tests pipeline.')])).filter(Boolean).join(stryMutAct_9fa48("3086") ? "" : (stryCov_9fa48("3086"), '\n')));
    const dflt = stryMutAct_9fa48("3087") ? {} : (stryCov_9fa48("3087"), {
      title: dfltTitle,
      body: dfltBody,
      labels: stryMutAct_9fa48("3088") ? ["Stryker was here"] : (stryCov_9fa48("3088"), [])
    });
    if (stryMutAct_9fa48("3091") ? false : stryMutAct_9fa48("3090") ? true : stryMutAct_9fa48("3089") ? ruleText : (stryCov_9fa48("3089", "3090", "3091"), !ruleText)) return dflt;
    const r = await chat(stryMutAct_9fa48("3092") ? {} : (stryCov_9fa48("3092"), {
      system: stryMutAct_9fa48("3093") ? "" : (stryCov_9fa48("3093"), 'You prepare a GitHub pull request for automated test improvements, following the team rule for PR style. Reply ONLY with JSON: {"title": "...", "body": "markdown", "labels": ["..."]}. Include the before/after metrics table in the body.'),
      prompt: stryMutAct_9fa48("3094") ? `` : (stryCov_9fa48("3094"), `TEAM RULE (how to make a PR): ${ruleText}\n\nREPO DOCS:\n${repoContextHead()}\n\nFILE: ${ctx.file}\nBRANCH: ${ctx.branch}\nMETRICS: coverage ${ctx.coverageBefore}%→${ctx.coverageAfter}%, mutation ${ctx.mutationBefore}%→${ctx.mutationAfter}%, MAC ${ctx.macBefore}→${ctx.macAfter}\nCHANGED TEST FILES: ${(stryMutAct_9fa48("3097") ? ctx.changedFiles && [] : stryMutAct_9fa48("3096") ? false : stryMutAct_9fa48("3095") ? true : (stryCov_9fa48("3095", "3096", "3097"), ctx.changedFiles || (stryMutAct_9fa48("3098") ? ["Stryker was here"] : (stryCov_9fa48("3098"), [])))).join(stryMutAct_9fa48("3099") ? "" : (stryCov_9fa48("3099"), ', '))}`),
      json: stryMutAct_9fa48("3100") ? false : (stryCov_9fa48("3100"), true),
      decision: stryMutAct_9fa48("3101") ? false : (stryCov_9fa48("3101"), true),
      maxTokens: 2000
    }));
    const j = r.json;
    if (stryMutAct_9fa48("3104") ? !j?.title && !j?.body : stryMutAct_9fa48("3103") ? false : stryMutAct_9fa48("3102") ? true : (stryCov_9fa48("3102", "3103", "3104"), (stryMutAct_9fa48("3105") ? j?.title : (stryCov_9fa48("3105"), !(stryMutAct_9fa48("3106") ? j.title : (stryCov_9fa48("3106"), j?.title)))) || (stryMutAct_9fa48("3107") ? j?.body : (stryCov_9fa48("3107"), !(stryMutAct_9fa48("3108") ? j.body : (stryCov_9fa48("3108"), j?.body)))))) return dflt;
    if (stryMutAct_9fa48("3111") ? false : stryMutAct_9fa48("3110") ? true : stryMutAct_9fa48("3109") ? Array.isArray(j.labels) : (stryCov_9fa48("3109", "3110", "3111"), !Array.isArray(j.labels))) j.labels = stryMutAct_9fa48("3112") ? ["Stryker was here"] : (stryCov_9fa48("3112"), []);
    return j;
  }
}
module.exports = stryMutAct_9fa48("3113") ? {} : (stryCov_9fa48("3113"), {
  apply,
  testWritingConstraints,
  rules
});