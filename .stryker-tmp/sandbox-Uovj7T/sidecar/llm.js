// @ts-nocheck
'use strict';

// OpenAI-compatible chat client for the vLLM endpoint (qwen), zero-dep via global fetch.
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
  extractJson,
  extractLastJsonObject
} = require('./util');
const {
  event,
  recordTokens,
  recordDialog
} = require('./state');
const BASE = (stryMutAct_9fa48("1103") ? process.env.LLM_BASE_URL && '' : stryMutAct_9fa48("1102") ? false : stryMutAct_9fa48("1101") ? true : (stryCov_9fa48("1101", "1102", "1103"), process.env.LLM_BASE_URL || (stryMutAct_9fa48("1104") ? "Stryker was here!" : (stryCov_9fa48("1104"), '')))).replace(stryMutAct_9fa48("1105") ? /\// : (stryCov_9fa48("1105"), /\/$/), stryMutAct_9fa48("1106") ? "Stryker was here!" : (stryCov_9fa48("1106"), ''));
const KEY = stryMutAct_9fa48("1109") ? process.env.LLM_API_KEY && '' : stryMutAct_9fa48("1108") ? false : stryMutAct_9fa48("1107") ? true : (stryCov_9fa48("1107", "1108", "1109"), process.env.LLM_API_KEY || (stryMutAct_9fa48("1110") ? "Stryker was here!" : (stryCov_9fa48("1110"), '')));
const MODEL = stryMutAct_9fa48("1113") ? process.env.LLM_MODEL && 'qwen-3.6-27b-fp8' : stryMutAct_9fa48("1112") ? false : stryMutAct_9fa48("1111") ? true : (stryCov_9fa48("1111", "1112", "1113"), process.env.LLM_MODEL || (stryMutAct_9fa48("1114") ? "" : (stryCov_9fa48("1114"), 'qwen-3.6-27b-fp8')));
const ENABLE_THINKING = stryMutAct_9fa48("1117") ? String(process.env.LLM_ENABLE_THINKING || 'false') !== 'true' : stryMutAct_9fa48("1116") ? false : stryMutAct_9fa48("1115") ? true : (stryCov_9fa48("1115", "1116", "1117"), String(stryMutAct_9fa48("1120") ? process.env.LLM_ENABLE_THINKING && 'false' : stryMutAct_9fa48("1119") ? false : stryMutAct_9fa48("1118") ? true : (stryCov_9fa48("1118", "1119", "1120"), process.env.LLM_ENABLE_THINKING || (stryMutAct_9fa48("1121") ? "" : (stryCov_9fa48("1121"), 'false')))) === (stryMutAct_9fa48("1122") ? "" : (stryCov_9fa48("1122"), 'true')));
// thinking consumes completion tokens before any visible output — give it headroom
const THINKING_EXTRA = ENABLE_THINKING ? parseInt(stryMutAct_9fa48("1125") ? process.env.LLM_THINKING_BUDGET && '3000' : stryMutAct_9fa48("1124") ? false : stryMutAct_9fa48("1123") ? true : (stryCov_9fa48("1123", "1124", "1125"), process.env.LLM_THINKING_BUDGET || (stryMutAct_9fa48("1126") ? "" : (stryCov_9fa48("1126"), '3000'))), 10) : 0;

/**
 * chat({system, prompt, messages, maxTokens, temperature, json})
 * json=true → returns parsed object (retries once with a repair nudge).
 */
async function chat(opts) {
  if (stryMutAct_9fa48("1127")) {
    {}
  } else {
    stryCov_9fa48("1127");
    const messages = (stryMutAct_9fa48("1130") ? opts.messages || opts.messages.length : stryMutAct_9fa48("1129") ? false : stryMutAct_9fa48("1128") ? true : (stryCov_9fa48("1128", "1129", "1130"), opts.messages && opts.messages.length)) ? stryMutAct_9fa48("1131") ? opts.messages : (stryCov_9fa48("1131"), opts.messages.slice()) : stryMutAct_9fa48("1132") ? ["Stryker was here"] : (stryCov_9fa48("1132"), []);
    if (stryMutAct_9fa48("1135") ? false : stryMutAct_9fa48("1134") ? true : stryMutAct_9fa48("1133") ? messages.length : (stryCov_9fa48("1133", "1134", "1135"), !messages.length)) {
      if (stryMutAct_9fa48("1136")) {
        {}
      } else {
        stryCov_9fa48("1136");
        if (stryMutAct_9fa48("1138") ? false : stryMutAct_9fa48("1137") ? true : (stryCov_9fa48("1137", "1138"), opts.system)) messages.push(stryMutAct_9fa48("1139") ? {} : (stryCov_9fa48("1139"), {
          role: stryMutAct_9fa48("1140") ? "" : (stryCov_9fa48("1140"), 'system'),
          content: opts.system
        }));
        messages.push(stryMutAct_9fa48("1141") ? {} : (stryCov_9fa48("1141"), {
          role: stryMutAct_9fa48("1142") ? "" : (stryCov_9fa48("1142"), 'user'),
          content: stryMutAct_9fa48("1145") ? opts.prompt && '' : stryMutAct_9fa48("1144") ? false : stryMutAct_9fa48("1143") ? true : (stryCov_9fa48("1143", "1144", "1145"), opts.prompt || (stryMutAct_9fa48("1146") ? "Stryker was here!" : (stryCov_9fa48("1146"), '')))
        }));
      }
    }
    // Measured against this endpoint rather than assumed (A/B, 2026-07-26):
    //   json_object + thinking ON  → 200, content 60ch, reasoning 929ch, finish=stop
    //   json_object + thinking OFF → 200, content 37ch, reasoning 0ch, 15 tokens, 1s
    //   no chat_template_kwargs    → reasoning 754ch — thinking is the DEFAULT here
    // So JSON mode and thinking are NOT mutually exclusive. An earlier comment here
    // claimed they were; what actually happens is that a long reasoning phase can
    // exhaust max_tokens before any content is emitted, which has nothing to do with
    // response_format and happens just as readily without it.
    //
    // What each kind of call gets, and why:
    //   every JSON call → response_format. Constraining the output removes the whole
    //     parse-failure class, and it costs nothing.
    //   decision calls  → no thinking. Measured: a pick answers in 1s and 15 tokens
    //     without it and 7s with it, and the model still reasons inside the `reason`
    //     field. Paying 7x for a shortlist ordering is not worth it.
    //   generation calls → thinking. That channel is what keeps chain-of-thought out
    //     of committed tests (D11).
    const wantsJson = stryMutAct_9fa48("1149") ? !!opts.json || jsonModeSupported : stryMutAct_9fa48("1148") ? false : stryMutAct_9fa48("1147") ? true : (stryCov_9fa48("1147", "1148", "1149"), (stryMutAct_9fa48("1150") ? !opts.json : (stryCov_9fa48("1150"), !(stryMutAct_9fa48("1151") ? opts.json : (stryCov_9fa48("1151"), !opts.json)))) && jsonModeSupported);
    // opts.thinking is an explicit override: the mutant loop tries a kill test WITHOUT
    // reasoning first (measured 21-28s against 112-186s for the same prompt) and only
    // escalates when that attempt fails to kill anything.
    const thinking = (stryMutAct_9fa48("1154") ? opts.thinking == null : stryMutAct_9fa48("1153") ? false : stryMutAct_9fa48("1152") ? true : (stryCov_9fa48("1152", "1153", "1154"), opts.thinking != null)) ? stryMutAct_9fa48("1155") ? !opts.thinking : (stryCov_9fa48("1155"), !(stryMutAct_9fa48("1156") ? opts.thinking : (stryCov_9fa48("1156"), !opts.thinking))) : stryMutAct_9fa48("1159") ? ENABLE_THINKING || !opts.decision : stryMutAct_9fa48("1158") ? false : stryMutAct_9fa48("1157") ? true : (stryCov_9fa48("1157", "1158", "1159"), ENABLE_THINKING && (stryMutAct_9fa48("1160") ? opts.decision : (stryCov_9fa48("1160"), !opts.decision)));
    const body = stryMutAct_9fa48("1161") ? {} : (stryCov_9fa48("1161"), {
      model: MODEL,
      messages,
      max_tokens: stryMutAct_9fa48("1162") ? (opts.maxTokens || 4096) - (thinking ? THINKING_EXTRA : 0) : (stryCov_9fa48("1162"), (stryMutAct_9fa48("1165") ? opts.maxTokens && 4096 : stryMutAct_9fa48("1164") ? false : stryMutAct_9fa48("1163") ? true : (stryCov_9fa48("1163", "1164", "1165"), opts.maxTokens || 4096)) + (thinking ? THINKING_EXTRA : 0)),
      temperature: stryMutAct_9fa48("1166") ? opts.temperature && 0.3 : (stryCov_9fa48("1166"), opts.temperature ?? 0.3),
      chat_template_kwargs: stryMutAct_9fa48("1167") ? {} : (stryCov_9fa48("1167"), {
        enable_thinking: thinking
      })
    });
    if (stryMutAct_9fa48("1169") ? false : stryMutAct_9fa48("1168") ? true : (stryCov_9fa48("1168", "1169"), wantsJson)) body.response_format = stryMutAct_9fa48("1170") ? {} : (stryCov_9fa48("1170"), {
      type: stryMutAct_9fa48("1171") ? "" : (stryCov_9fa48("1171"), 'json_object')
    });
    const structured = stryMutAct_9fa48("1174") ? wantsJson || !!opts.decision : stryMutAct_9fa48("1173") ? false : stryMutAct_9fa48("1172") ? true : (stryCov_9fa48("1172", "1173", "1174"), wantsJson && (stryMutAct_9fa48("1175") ? !opts.decision : (stryCov_9fa48("1175"), !(stryMutAct_9fa48("1176") ? opts.decision : (stryCov_9fa48("1176"), !opts.decision)))));
    const startedAt = Date.now();
    const first = await post(body);
    const text = first.content;
    recordDialog(stryMutAct_9fa48("1177") ? {} : (stryCov_9fa48("1177"), {
      kind: structured ? stryMutAct_9fa48("1178") ? "" : (stryCov_9fa48("1178"), 'decision') : stryMutAct_9fa48("1179") ? "" : (stryCov_9fa48("1179"), 'generation'),
      thinking,
      model: MODEL,
      system: stryMutAct_9fa48("1182") ? messages.find(m => m.role === 'system')?.content && '' : stryMutAct_9fa48("1181") ? false : stryMutAct_9fa48("1180") ? true : (stryCov_9fa48("1180", "1181", "1182"), (stryMutAct_9fa48("1183") ? messages.find(m => m.role === 'system').content : (stryCov_9fa48("1183"), messages.find(stryMutAct_9fa48("1184") ? () => undefined : (stryCov_9fa48("1184"), m => stryMutAct_9fa48("1187") ? m.role !== 'system' : stryMutAct_9fa48("1186") ? false : stryMutAct_9fa48("1185") ? true : (stryCov_9fa48("1185", "1186", "1187"), m.role === (stryMutAct_9fa48("1188") ? "" : (stryCov_9fa48("1188"), 'system')))))?.content)) || (stryMutAct_9fa48("1189") ? "Stryker was here!" : (stryCov_9fa48("1189"), ''))),
      prompt: stryMutAct_9fa48("1190") ? messages.map(m => m.content).join('\n---\n') : (stryCov_9fa48("1190"), messages.filter(stryMutAct_9fa48("1191") ? () => undefined : (stryCov_9fa48("1191"), m => stryMutAct_9fa48("1194") ? m.role !== 'user' : stryMutAct_9fa48("1193") ? false : stryMutAct_9fa48("1192") ? true : (stryCov_9fa48("1192", "1193", "1194"), m.role === (stryMutAct_9fa48("1195") ? "" : (stryCov_9fa48("1195"), 'user'))))).map(stryMutAct_9fa48("1196") ? () => undefined : (stryCov_9fa48("1196"), m => m.content)).join(stryMutAct_9fa48("1197") ? "" : (stryCov_9fa48("1197"), '\n---\n'))),
      response: text,
      durationMs: stryMutAct_9fa48("1198") ? Date.now() + startedAt : (stryCov_9fa48("1198"), Date.now() - startedAt),
      maxTokens: body.max_tokens,
      finishReason: first.finishReason,
      reasoningChars: first.reasoning.length
    }));
    if (stryMutAct_9fa48("1201") ? false : stryMutAct_9fa48("1200") ? true : stryMutAct_9fa48("1199") ? opts.json : (stryCov_9fa48("1199", "1200", "1201"), !opts.json)) return stryMutAct_9fa48("1202") ? {} : (stryCov_9fa48("1202"), {
      text
    });
    let parsed = extractJson(text);
    // The model drafts its answer inside the reasoning channel and then repeats it as
    // content. When the budget runs out in between, the finished answer is sitting in
    // `reasoning` and we have already paid for it — re-asking costs another ~200s for
    // something we hold. Only a COMPLETE object is taken: half a test file would be
    // written to disk and fail to parse as JavaScript.
    if (stryMutAct_9fa48("1205") ? parsed == null || first.reasoning : stryMutAct_9fa48("1204") ? false : stryMutAct_9fa48("1203") ? true : (stryCov_9fa48("1203", "1204", "1205"), (stryMutAct_9fa48("1207") ? parsed != null : stryMutAct_9fa48("1206") ? true : (stryCov_9fa48("1206", "1207"), parsed == null)) && first.reasoning)) {
      if (stryMutAct_9fa48("1208")) {
        {}
      } else {
        stryCov_9fa48("1208");
        const salvaged = extractLastJsonObject(first.reasoning);
        if (stryMutAct_9fa48("1211") ? salvaged == null : stryMutAct_9fa48("1210") ? false : stryMutAct_9fa48("1209") ? true : (stryCov_9fa48("1209", "1210", "1211"), salvaged != null)) {
          if (stryMutAct_9fa48("1212")) {
            {}
          } else {
            stryCov_9fa48("1212");
            event(stryMutAct_9fa48("1213") ? "" : (stryCov_9fa48("1213"), 'llm'), stryMutAct_9fa48("1214") ? `` : (stryCov_9fa48("1214"), `model emitted no content (finish_reason=${first.finishReason}) but a complete answer was in its reasoning — salvaged, no retry`));
            return stryMutAct_9fa48("1215") ? {} : (stryCov_9fa48("1215"), {
              text: first.reasoning,
              json: salvaged
            });
          }
        }
      }
    }
    if (stryMutAct_9fa48("1218") ? parsed != null : stryMutAct_9fa48("1217") ? false : stryMutAct_9fa48("1216") ? true : (stryCov_9fa48("1216", "1217", "1218"), parsed == null)) {
      if (stryMutAct_9fa48("1219")) {
        {}
      } else {
        stryCov_9fa48("1219");
        // The recorded failures are not verbose answers, they are EMPTY ones: the
        // reasoning channel spends the completion budget before any visible output, so
        // `content` arrives blank or cut off mid-token — after ~158 seconds. Re-running
        // that same configuration is a long gamble on the same dice. The repair turn
        // therefore thinks NOT AT ALL: it has the previous attempt and an explicit
        // instruction, which is what the reasoning was for.
        // Two different failures need two different things said. "Your previous answer
        // was not valid JSON" is simply untrue when there was no answer, and a model
        // asked to reconcile a false statement wastes the retry doing it.
        const ranOut = stryMutAct_9fa48("1222") ? text.length !== 0 : stryMutAct_9fa48("1221") ? false : stryMutAct_9fa48("1220") ? true : (stryCov_9fa48("1220", "1221", "1222"), text.length === 0);
        event(stryMutAct_9fa48("1223") ? "" : (stryCov_9fa48("1223"), 'llm'), ranOut ? (stryMutAct_9fa48("1224") ? `` : (stryCov_9fa48("1224"), `model returned NO CONTENT (finish_reason=${first.finishReason}, ${first.reasoning.length} chars of reasoning, `)) + (stryMutAct_9fa48("1225") ? `` : (stryCov_9fa48("1225"), `${body.max_tokens} token budget) — the answer never left the reasoning channel; retrying without thinking`)) : stryMutAct_9fa48("1226") ? `` : (stryCov_9fa48("1226"), `JSON parse failed (${text.length} chars returned, finish_reason=${first.finishReason}), retrying without thinking`));
        // Hand back the work it already did. Its reasoning is where the answer was being
        // written, so resuming from it beats an apology and a blank page.
        const carry = stryMutAct_9fa48("1229") ? text.slice(0, 4000) && (first.reasoning ? `My reasoning so far (cut off):\n${first.reasoning.slice(-3000)}` : '(no answer)') : stryMutAct_9fa48("1228") ? false : stryMutAct_9fa48("1227") ? true : (stryCov_9fa48("1227", "1228", "1229"), (stryMutAct_9fa48("1230") ? text : (stryCov_9fa48("1230"), text.slice(0, 4000))) || (first.reasoning ? stryMutAct_9fa48("1231") ? `` : (stryCov_9fa48("1231"), `My reasoning so far (cut off):\n${stryMutAct_9fa48("1232") ? first.reasoning : (stryCov_9fa48("1232"), first.reasoning.slice(stryMutAct_9fa48("1233") ? +3000 : (stryCov_9fa48("1233"), -3000)))}`) : stryMutAct_9fa48("1234") ? "" : (stryCov_9fa48("1234"), '(no answer)')));
        messages.push(stryMutAct_9fa48("1235") ? {} : (stryCov_9fa48("1235"), {
          role: stryMutAct_9fa48("1236") ? "" : (stryCov_9fa48("1236"), 'assistant'),
          content: carry
        }));
        messages.push(stryMutAct_9fa48("1237") ? {} : (stryCov_9fa48("1237"), {
          role: stryMutAct_9fa48("1238") ? "" : (stryCov_9fa48("1238"), 'user'),
          content: ranOut ? (stryMutAct_9fa48("1239") ? "" : (stryCov_9fa48("1239"), 'You ran out of tokens while thinking and never produced the answer. Keep your remaining ')) + (stryMutAct_9fa48("1240") ? "" : (stryCov_9fa48("1240"), 'reasoning short — you have already done the analysis above — and reply with ONLY the JSON, ')) + (stryMutAct_9fa48("1241") ? "" : (stryCov_9fa48("1241"), 'no prose, no markdown fences.')) : stryMutAct_9fa48("1242") ? "" : (stryCov_9fa48("1242"), 'Your previous answer was not valid JSON. Reply again with ONLY the JSON, no prose, no markdown fences.')
        }));
        const t0 = Date.now();
        // KEEP thinking for generation. The calls that exhaust the budget are, by
        // selection, the hard ones: a mutant that survived everything else, whose kill
        // test has to hit an edge case nobody has asserted yet. Answering that without
        // reasoning buys a cheap answer to the question we most needed answered well.
        // What failed was the BUDGET, so the budget is what changes. (Decision calls
        // never had thinking, so this leaves them exactly as they were.)
        // If the first attempt deliberately did not think, thinking is exactly what the
        // retry has left to offer; otherwise keep it and give it room to finish.
        const retryRes = await post(stryMutAct_9fa48("1243") ? {} : (stryCov_9fa48("1243"), {
          ...body,
          messages,
          temperature: 0.1,
          max_tokens: stryMutAct_9fa48("1244") ? Math.max(Math.max(body.max_tokens, opts.maxTokens || 4096) * 2, 24000) : (stryCov_9fa48("1244"), Math.min(stryMutAct_9fa48("1245") ? Math.max(body.max_tokens, opts.maxTokens || 4096) / 2 : (stryCov_9fa48("1245"), (stryMutAct_9fa48("1246") ? Math.min(body.max_tokens, opts.maxTokens || 4096) : (stryCov_9fa48("1246"), Math.max(body.max_tokens, stryMutAct_9fa48("1249") ? opts.maxTokens && 4096 : stryMutAct_9fa48("1248") ? false : stryMutAct_9fa48("1247") ? true : (stryCov_9fa48("1247", "1248", "1249"), opts.maxTokens || 4096)))) * 2), 24000)),
          chat_template_kwargs: stryMutAct_9fa48("1250") ? {} : (stryCov_9fa48("1250"), {
            enable_thinking: stryMutAct_9fa48("1251") ? false : (stryCov_9fa48("1251"), true)
          })
        }));
        const retry = retryRes.content;
        recordDialog(stryMutAct_9fa48("1252") ? {} : (stryCov_9fa48("1252"), {
          kind: stryMutAct_9fa48("1253") ? "" : (stryCov_9fa48("1253"), 'json-repair'),
          thinking: stryMutAct_9fa48("1254") ? true : (stryCov_9fa48("1254"), false),
          model: MODEL,
          system: stryMutAct_9fa48("1255") ? "" : (stryCov_9fa48("1255"), '(repair nudge — the previous answer was not valid JSON)'),
          prompt: stryMutAct_9fa48("1256") ? "" : (stryCov_9fa48("1256"), 'Reply again with ONLY the JSON.'),
          response: retry,
          durationMs: stryMutAct_9fa48("1257") ? Date.now() + t0 : (stryCov_9fa48("1257"), Date.now() - t0),
          maxTokens: stryMutAct_9fa48("1260") ? opts.maxTokens && 4096 : stryMutAct_9fa48("1259") ? false : stryMutAct_9fa48("1258") ? true : (stryCov_9fa48("1258", "1259", "1260"), opts.maxTokens || 4096)
        }));
        parsed = extractJson(retry);
      }
    }
    return stryMutAct_9fa48("1261") ? {} : (stryCov_9fa48("1261"), {
      text,
      json: parsed
    });
  }
}

// Flipped to false the first time the endpoint refuses response_format, so a
// backend without JSON mode degrades to the old free-form + repair path instead
// of failing every call.
let jsonModeSupported = stryMutAct_9fa48("1264") ? String(process.env.LLM_JSON_MODE || 'auto') === 'off' : stryMutAct_9fa48("1263") ? false : stryMutAct_9fa48("1262") ? true : (stryCov_9fa48("1262", "1263", "1264"), String(stryMutAct_9fa48("1267") ? process.env.LLM_JSON_MODE && 'auto' : stryMutAct_9fa48("1266") ? false : stryMutAct_9fa48("1265") ? true : (stryCov_9fa48("1265", "1266", "1267"), process.env.LLM_JSON_MODE || (stryMutAct_9fa48("1268") ? "" : (stryCov_9fa48("1268"), 'auto')))) !== (stryMutAct_9fa48("1269") ? "" : (stryCov_9fa48("1269"), 'off')));

/**
 * How long a call may take before we give up on it. Reasoning legitimately runs long —
 * measured 112-186s median and past 280s at the tail — so a single ceiling turned the
 * slowest and therefore HARDEST calls into guaranteed failures.
 */
function timeoutFor(thinking) {
  if (stryMutAct_9fa48("1270")) {
    {}
  } else {
    stryCov_9fa48("1270");
    return thinking ? 900000 : 300000;
  }
}
async function post(body, attempt = 0) {
  if (stryMutAct_9fa48("1271")) {
    {}
  } else {
    stryCov_9fa48("1271");
    const ctrl = new AbortController();
    const timer = setTimeout(stryMutAct_9fa48("1272") ? () => undefined : (stryCov_9fa48("1272"), () => ctrl.abort()), timeoutFor(stryMutAct_9fa48("1273") ? body.chat_template_kwargs.enable_thinking : (stryCov_9fa48("1273"), body.chat_template_kwargs?.enable_thinking)));
    try {
      if (stryMutAct_9fa48("1274")) {
        {}
      } else {
        stryCov_9fa48("1274");
        const res = await fetch(BASE + (stryMutAct_9fa48("1275") ? "" : (stryCov_9fa48("1275"), '/chat/completions')), stryMutAct_9fa48("1276") ? {} : (stryCov_9fa48("1276"), {
          method: stryMutAct_9fa48("1277") ? "" : (stryCov_9fa48("1277"), 'POST'),
          headers: stryMutAct_9fa48("1278") ? {} : (stryCov_9fa48("1278"), {
            'Content-Type': stryMutAct_9fa48("1279") ? "" : (stryCov_9fa48("1279"), 'application/json'),
            Authorization: (stryMutAct_9fa48("1280") ? "" : (stryCov_9fa48("1280"), 'Bearer ')) + KEY
          }),
          body: JSON.stringify(body),
          signal: ctrl.signal
        }));
        if (stryMutAct_9fa48("1283") ? false : stryMutAct_9fa48("1282") ? true : stryMutAct_9fa48("1281") ? res.ok : (stryCov_9fa48("1281", "1282", "1283"), !res.ok)) {
          if (stryMutAct_9fa48("1284")) {
            {}
          } else {
            stryCov_9fa48("1284");
            const errText = stryMutAct_9fa48("1285") ? await res.text() : (stryCov_9fa48("1285"), (await res.text()).slice(0, 300));
            // endpoint does not know response_format → drop it permanently and retry once
            if (stryMutAct_9fa48("1288") ? jsonModeSupported && body.response_format || /response_format|guided|json_object|unrecognized|unexpected/i.test(errText) : stryMutAct_9fa48("1287") ? false : stryMutAct_9fa48("1286") ? true : (stryCov_9fa48("1286", "1287", "1288"), (stryMutAct_9fa48("1290") ? jsonModeSupported || body.response_format : stryMutAct_9fa48("1289") ? true : (stryCov_9fa48("1289", "1290"), jsonModeSupported && body.response_format)) && /response_format|guided|json_object|unrecognized|unexpected/i.test(errText))) {
              if (stryMutAct_9fa48("1291")) {
                {}
              } else {
                stryCov_9fa48("1291");
                jsonModeSupported = stryMutAct_9fa48("1292") ? true : (stryCov_9fa48("1292"), false);
                event(stryMutAct_9fa48("1293") ? "" : (stryCov_9fa48("1293"), 'llm'), stryMutAct_9fa48("1294") ? "" : (stryCov_9fa48("1294"), 'endpoint rejected JSON mode — falling back to free-form output with repair retries'));
                const {
                  response_format,
                  ...plain
                } = body;
                return post(plain, attempt);
              }
            }
            if (stryMutAct_9fa48("1297") ? attempt < 2 || res.status === 429 || res.status >= 500 : stryMutAct_9fa48("1296") ? false : stryMutAct_9fa48("1295") ? true : (stryCov_9fa48("1295", "1296", "1297"), (stryMutAct_9fa48("1300") ? attempt >= 2 : stryMutAct_9fa48("1299") ? attempt <= 2 : stryMutAct_9fa48("1298") ? true : (stryCov_9fa48("1298", "1299", "1300"), attempt < 2)) && (stryMutAct_9fa48("1302") ? res.status === 429 && res.status >= 500 : stryMutAct_9fa48("1301") ? true : (stryCov_9fa48("1301", "1302"), (stryMutAct_9fa48("1304") ? res.status !== 429 : stryMutAct_9fa48("1303") ? false : (stryCov_9fa48("1303", "1304"), res.status === 429)) || (stryMutAct_9fa48("1307") ? res.status < 500 : stryMutAct_9fa48("1306") ? res.status > 500 : stryMutAct_9fa48("1305") ? false : (stryCov_9fa48("1305", "1306", "1307"), res.status >= 500)))))) {
              if (stryMutAct_9fa48("1308")) {
                {}
              } else {
                stryCov_9fa48("1308");
                await new Promise(stryMutAct_9fa48("1309") ? () => undefined : (stryCov_9fa48("1309"), r => setTimeout(r, stryMutAct_9fa48("1310") ? 3000 / (attempt + 1) : (stryCov_9fa48("1310"), 3000 * (stryMutAct_9fa48("1311") ? attempt - 1 : (stryCov_9fa48("1311"), attempt + 1))))));
                return post(body, stryMutAct_9fa48("1312") ? attempt - 1 : (stryCov_9fa48("1312"), attempt + 1));
              }
            }
            throw new Error(stryMutAct_9fa48("1313") ? `` : (stryCov_9fa48("1313"), `LLM HTTP ${res.status}: ${errText}`));
          }
        }
        const data = await res.json();
        // every call is counted, including the JSON-repair retry below: that is real
        // spend, and hiding it would understate the cost of a flaky response
        recordTokens(data.usage);
        const choice = stryMutAct_9fa48("1316") ? data.choices?.[0] && {} : stryMutAct_9fa48("1315") ? false : stryMutAct_9fa48("1314") ? true : (stryCov_9fa48("1314", "1315", "1316"), (stryMutAct_9fa48("1317") ? data.choices[0] : (stryCov_9fa48("1317"), data.choices?.[0])) || {});
        // finish_reason and the reasoning channel are the whole diagnosis when content
        // comes back empty, and both used to be discarded here — leaving "JSON parse
        // failed" as the only symptom of a model that never emitted an answer at all.
        return stryMutAct_9fa48("1318") ? {} : (stryCov_9fa48("1318"), {
          content: stryMutAct_9fa48("1321") ? choice.message?.content && '' : stryMutAct_9fa48("1320") ? false : stryMutAct_9fa48("1319") ? true : (stryCov_9fa48("1319", "1320", "1321"), (stryMutAct_9fa48("1322") ? choice.message.content : (stryCov_9fa48("1322"), choice.message?.content)) || (stryMutAct_9fa48("1323") ? "Stryker was here!" : (stryCov_9fa48("1323"), ''))),
          finishReason: stryMutAct_9fa48("1326") ? choice.finish_reason && '' : stryMutAct_9fa48("1325") ? false : stryMutAct_9fa48("1324") ? true : (stryCov_9fa48("1324", "1325", "1326"), choice.finish_reason || (stryMutAct_9fa48("1327") ? "Stryker was here!" : (stryCov_9fa48("1327"), ''))),
          reasoning: stryMutAct_9fa48("1330") ? (choice.message?.reasoning || choice.message?.reasoning_content) && '' : stryMutAct_9fa48("1329") ? false : stryMutAct_9fa48("1328") ? true : (stryCov_9fa48("1328", "1329", "1330"), (stryMutAct_9fa48("1332") ? choice.message?.reasoning && choice.message?.reasoning_content : stryMutAct_9fa48("1331") ? false : (stryCov_9fa48("1331", "1332"), (stryMutAct_9fa48("1333") ? choice.message.reasoning : (stryCov_9fa48("1333"), choice.message?.reasoning)) || (stryMutAct_9fa48("1334") ? choice.message.reasoning_content : (stryCov_9fa48("1334"), choice.message?.reasoning_content)))) || (stryMutAct_9fa48("1335") ? "Stryker was here!" : (stryCov_9fa48("1335"), '')))
        });
      }
    } catch (e) {
      if (stryMutAct_9fa48("1336")) {
        {}
      } else {
        stryCov_9fa48("1336");
        // Never retry an abort WE caused: the same request takes the same time and hits the
        // same ceiling. Live, that turned two slow escalations into 631s and 447s of
        // nothing — three attempts each, all identical, all aborted. Transport failures are
        // different and still worth a second go.
        const ours = stryMutAct_9fa48("1339") ? e.name === 'AbortError' && /operation was aborted/i.test(String(e.message)) : stryMutAct_9fa48("1338") ? false : stryMutAct_9fa48("1337") ? true : (stryCov_9fa48("1337", "1338", "1339"), (stryMutAct_9fa48("1341") ? e.name !== 'AbortError' : stryMutAct_9fa48("1340") ? false : (stryCov_9fa48("1340", "1341"), e.name === (stryMutAct_9fa48("1342") ? "" : (stryCov_9fa48("1342"), 'AbortError')))) || /operation was aborted/i.test(String(e.message)));
        if (stryMutAct_9fa48("1345") ? !ours && attempt < 2 || /network|fetch failed|ECONN|socket/i.test(String(e.message)) : stryMutAct_9fa48("1344") ? false : stryMutAct_9fa48("1343") ? true : (stryCov_9fa48("1343", "1344", "1345"), (stryMutAct_9fa48("1347") ? !ours || attempt < 2 : stryMutAct_9fa48("1346") ? true : (stryCov_9fa48("1346", "1347"), (stryMutAct_9fa48("1348") ? ours : (stryCov_9fa48("1348"), !ours)) && (stryMutAct_9fa48("1351") ? attempt >= 2 : stryMutAct_9fa48("1350") ? attempt <= 2 : stryMutAct_9fa48("1349") ? true : (stryCov_9fa48("1349", "1350", "1351"), attempt < 2)))) && /network|fetch failed|ECONN|socket/i.test(String(e.message)))) {
          if (stryMutAct_9fa48("1352")) {
            {}
          } else {
            stryCov_9fa48("1352");
            await new Promise(stryMutAct_9fa48("1353") ? () => undefined : (stryCov_9fa48("1353"), r => setTimeout(r, stryMutAct_9fa48("1354") ? 3000 / (attempt + 1) : (stryCov_9fa48("1354"), 3000 * (stryMutAct_9fa48("1355") ? attempt - 1 : (stryCov_9fa48("1355"), attempt + 1))))));
            return post(body, stryMutAct_9fa48("1356") ? attempt - 1 : (stryCov_9fa48("1356"), attempt + 1));
          }
        }
        throw e;
      }
    } finally {
      if (stryMutAct_9fa48("1357")) {
        {}
      } else {
        stryCov_9fa48("1357");
        clearTimeout(timer);
      }
    }
  }
}
module.exports = stryMutAct_9fa48("1358") ? {} : (stryCov_9fa48("1358"), {
  chat,
  timeoutFor
});