// @ts-nocheck
'use strict';

// Zero-dependency helpers shared by the sidecar.

/**
 * Split a comma-separated glob list WITHOUT breaking brace groups:
 * `src/**\/*.{js,ts},lib/*.ts` → ['src/**\/*.{js,ts}', 'lib/*.ts'].
 * (A naive split on ',' shreds `{js,ts}` into separate globs that match nothing.)
 */
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
function splitGlobList(globCsv) {
  if (stryMutAct_9fa48("6097")) {
    {}
  } else {
    stryCov_9fa48("6097");
    const out = stryMutAct_9fa48("6098") ? ["Stryker was here"] : (stryCov_9fa48("6098"), []);
    let cur = stryMutAct_9fa48("6099") ? "Stryker was here!" : (stryCov_9fa48("6099"), ''),
      depth = 0;
    for (const ch of String(stryMutAct_9fa48("6102") ? globCsv && '**/*' : stryMutAct_9fa48("6101") ? false : stryMutAct_9fa48("6100") ? true : (stryCov_9fa48("6100", "6101", "6102"), globCsv || (stryMutAct_9fa48("6103") ? "" : (stryCov_9fa48("6103"), '**/*'))))) {
      if (stryMutAct_9fa48("6104")) {
        {}
      } else {
        stryCov_9fa48("6104");
        if (stryMutAct_9fa48("6107") ? ch !== '{' : stryMutAct_9fa48("6106") ? false : stryMutAct_9fa48("6105") ? true : (stryCov_9fa48("6105", "6106", "6107"), ch === (stryMutAct_9fa48("6108") ? "" : (stryCov_9fa48("6108"), '{')))) stryMutAct_9fa48("6109") ? depth -= 1 : (stryCov_9fa48("6109"), depth += 1);else if (stryMutAct_9fa48("6112") ? ch !== '}' : stryMutAct_9fa48("6111") ? false : stryMutAct_9fa48("6110") ? true : (stryCov_9fa48("6110", "6111", "6112"), ch === (stryMutAct_9fa48("6113") ? "" : (stryCov_9fa48("6113"), '}')))) depth = stryMutAct_9fa48("6114") ? Math.min(0, depth - 1) : (stryCov_9fa48("6114"), Math.max(0, stryMutAct_9fa48("6115") ? depth + 1 : (stryCov_9fa48("6115"), depth - 1)));
        if (stryMutAct_9fa48("6118") ? ch === ',' || depth === 0 : stryMutAct_9fa48("6117") ? false : stryMutAct_9fa48("6116") ? true : (stryCov_9fa48("6116", "6117", "6118"), (stryMutAct_9fa48("6120") ? ch !== ',' : stryMutAct_9fa48("6119") ? true : (stryCov_9fa48("6119", "6120"), ch === (stryMutAct_9fa48("6121") ? "" : (stryCov_9fa48("6121"), ',')))) && (stryMutAct_9fa48("6123") ? depth !== 0 : stryMutAct_9fa48("6122") ? true : (stryCov_9fa48("6122", "6123"), depth === 0)))) {
          if (stryMutAct_9fa48("6124")) {
            {}
          } else {
            stryCov_9fa48("6124");
            out.push(cur);
            cur = stryMutAct_9fa48("6125") ? "Stryker was here!" : (stryCov_9fa48("6125"), '');
            continue;
          }
        }
        stryMutAct_9fa48("6126") ? cur -= ch : (stryCov_9fa48("6126"), cur += ch);
      }
    }
    out.push(cur);
    return stryMutAct_9fa48("6127") ? out.map(g => g.trim()) : (stryCov_9fa48("6127"), out.map(stryMutAct_9fa48("6128") ? () => undefined : (stryCov_9fa48("6128"), g => stryMutAct_9fa48("6129") ? g : (stryCov_9fa48("6129"), g.trim()))).filter(Boolean));
  }
}

/** Convert a comma-separated glob list to a matcher fn for repo-relative paths. */
function globsToMatcher(globCsv) {
  if (stryMutAct_9fa48("6130")) {
    {}
  } else {
    stryCov_9fa48("6130");
    const regs = splitGlobList(globCsv).map(globToRegExp);
    return stryMutAct_9fa48("6131") ? () => undefined : (stryCov_9fa48("6131"), p => stryMutAct_9fa48("6132") ? regs.every(r => r.test(p)) : (stryCov_9fa48("6132"), regs.some(stryMutAct_9fa48("6133") ? () => undefined : (stryCov_9fa48("6133"), r => r.test(p)))));
  }
}
function globToRegExp(glob) {
  if (stryMutAct_9fa48("6134")) {
    {}
  } else {
    stryCov_9fa48("6134");
    let re = stryMutAct_9fa48("6135") ? "Stryker was here!" : (stryCov_9fa48("6135"), '');
    let i = 0;
    while (stryMutAct_9fa48("6138") ? i >= glob.length : stryMutAct_9fa48("6137") ? i <= glob.length : stryMutAct_9fa48("6136") ? false : (stryCov_9fa48("6136", "6137", "6138"), i < glob.length)) {
      if (stryMutAct_9fa48("6139")) {
        {}
      } else {
        stryCov_9fa48("6139");
        const c = glob[i];
        if (stryMutAct_9fa48("6142") ? c !== '*' : stryMutAct_9fa48("6141") ? false : stryMutAct_9fa48("6140") ? true : (stryCov_9fa48("6140", "6141", "6142"), c === (stryMutAct_9fa48("6143") ? "" : (stryCov_9fa48("6143"), '*')))) {
          if (stryMutAct_9fa48("6144")) {
            {}
          } else {
            stryCov_9fa48("6144");
            if (stryMutAct_9fa48("6147") ? glob[i + 1] !== '*' : stryMutAct_9fa48("6146") ? false : stryMutAct_9fa48("6145") ? true : (stryCov_9fa48("6145", "6146", "6147"), glob[stryMutAct_9fa48("6148") ? i - 1 : (stryCov_9fa48("6148"), i + 1)] === (stryMutAct_9fa48("6149") ? "" : (stryCov_9fa48("6149"), '*')))) {
              if (stryMutAct_9fa48("6150")) {
                {}
              } else {
                stryCov_9fa48("6150");
                // '**/' or '**'
                if (stryMutAct_9fa48("6153") ? glob[i + 2] !== '/' : stryMutAct_9fa48("6152") ? false : stryMutAct_9fa48("6151") ? true : (stryCov_9fa48("6151", "6152", "6153"), glob[stryMutAct_9fa48("6154") ? i - 2 : (stryCov_9fa48("6154"), i + 2)] === (stryMutAct_9fa48("6155") ? "" : (stryCov_9fa48("6155"), '/')))) {
                  if (stryMutAct_9fa48("6156")) {
                    {}
                  } else {
                    stryCov_9fa48("6156");
                    re += stryMutAct_9fa48("6157") ? "" : (stryCov_9fa48("6157"), '(?:.*/)?');
                    stryMutAct_9fa48("6158") ? i -= 3 : (stryCov_9fa48("6158"), i += 3);
                  }
                } else {
                  if (stryMutAct_9fa48("6159")) {
                    {}
                  } else {
                    stryCov_9fa48("6159");
                    re += stryMutAct_9fa48("6160") ? "" : (stryCov_9fa48("6160"), '.*');
                    stryMutAct_9fa48("6161") ? i -= 2 : (stryCov_9fa48("6161"), i += 2);
                  }
                }
              }
            } else {
              if (stryMutAct_9fa48("6162")) {
                {}
              } else {
                stryCov_9fa48("6162");
                re += stryMutAct_9fa48("6163") ? "" : (stryCov_9fa48("6163"), '[^/]*');
                stryMutAct_9fa48("6164") ? i -= 1 : (stryCov_9fa48("6164"), i += 1);
              }
            }
          }
        } else if (stryMutAct_9fa48("6167") ? c !== '?' : stryMutAct_9fa48("6166") ? false : stryMutAct_9fa48("6165") ? true : (stryCov_9fa48("6165", "6166", "6167"), c === (stryMutAct_9fa48("6168") ? "" : (stryCov_9fa48("6168"), '?')))) {
          if (stryMutAct_9fa48("6169")) {
            {}
          } else {
            stryCov_9fa48("6169");
            re += stryMutAct_9fa48("6170") ? "" : (stryCov_9fa48("6170"), '[^/]');
            stryMutAct_9fa48("6171") ? i -= 1 : (stryCov_9fa48("6171"), i += 1);
          }
        } else if (stryMutAct_9fa48("6174") ? c !== '{' : stryMutAct_9fa48("6173") ? false : stryMutAct_9fa48("6172") ? true : (stryCov_9fa48("6172", "6173", "6174"), c === (stryMutAct_9fa48("6175") ? "" : (stryCov_9fa48("6175"), '{')))) {
          if (stryMutAct_9fa48("6176")) {
            {}
          } else {
            stryCov_9fa48("6176");
            const end = glob.indexOf(stryMutAct_9fa48("6177") ? "" : (stryCov_9fa48("6177"), '}'), i);
            if (stryMutAct_9fa48("6180") ? end !== -1 : stryMutAct_9fa48("6179") ? false : stryMutAct_9fa48("6178") ? true : (stryCov_9fa48("6178", "6179", "6180"), end === (stryMutAct_9fa48("6181") ? +1 : (stryCov_9fa48("6181"), -1)))) {
              if (stryMutAct_9fa48("6182")) {
                {}
              } else {
                stryCov_9fa48("6182");
                re += stryMutAct_9fa48("6183") ? "" : (stryCov_9fa48("6183"), '\\{');
                stryMutAct_9fa48("6184") ? i -= 1 : (stryCov_9fa48("6184"), i += 1);
              }
            } else {
              if (stryMutAct_9fa48("6185")) {
                {}
              } else {
                stryCov_9fa48("6185");
                const alts = stryMutAct_9fa48("6186") ? glob.split(',').map(escapeRe) : (stryCov_9fa48("6186"), glob.slice(stryMutAct_9fa48("6187") ? i - 1 : (stryCov_9fa48("6187"), i + 1), end).split(stryMutAct_9fa48("6188") ? "" : (stryCov_9fa48("6188"), ',')).map(escapeRe));
                stryMutAct_9fa48("6189") ? re -= '(?:' + alts.join('|') + ')' : (stryCov_9fa48("6189"), re += (stryMutAct_9fa48("6190") ? "" : (stryCov_9fa48("6190"), '(?:')) + alts.join(stryMutAct_9fa48("6191") ? "" : (stryCov_9fa48("6191"), '|')) + (stryMutAct_9fa48("6192") ? "" : (stryCov_9fa48("6192"), ')')));
                i = stryMutAct_9fa48("6193") ? end - 1 : (stryCov_9fa48("6193"), end + 1);
              }
            }
          }
        } else {
          if (stryMutAct_9fa48("6194")) {
            {}
          } else {
            stryCov_9fa48("6194");
            stryMutAct_9fa48("6195") ? re -= escapeRe(c) : (stryCov_9fa48("6195"), re += escapeRe(c));
            stryMutAct_9fa48("6196") ? i -= 1 : (stryCov_9fa48("6196"), i += 1);
          }
        }
      }
    }
    return new RegExp((stryMutAct_9fa48("6197") ? "" : (stryCov_9fa48("6197"), '^')) + re + (stryMutAct_9fa48("6198") ? "" : (stryCov_9fa48("6198"), '$')));
  }
}
function escapeRe(s) {
  if (stryMutAct_9fa48("6199")) {
    {}
  } else {
    stryCov_9fa48("6199");
    return s.replace(stryMutAct_9fa48("6200") ? /[^.+^$()|[\]\\]/g : (stryCov_9fa48("6200"), /[.+^$()|[\]\\]/g), stryMutAct_9fa48("6201") ? "" : (stryCov_9fa48("6201"), '\\$&'));
  }
}
function slugify(s) {
  if (stryMutAct_9fa48("6202")) {
    {}
  } else {
    stryCov_9fa48("6202");
    return stryMutAct_9fa48("6204") ? String(s).toUpperCase().replace(/^https?:\/\//, '').replace(/\.git$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) : stryMutAct_9fa48("6203") ? String(s).toLowerCase().replace(/^https?:\/\//, '').replace(/\.git$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : (stryCov_9fa48("6203", "6204"), String(s).toLowerCase().replace(stryMutAct_9fa48("6206") ? /^https:\/\// : stryMutAct_9fa48("6205") ? /https?:\/\// : (stryCov_9fa48("6205", "6206"), /^https?:\/\//), stryMutAct_9fa48("6207") ? "Stryker was here!" : (stryCov_9fa48("6207"), '')).replace(stryMutAct_9fa48("6208") ? /\.git/ : (stryCov_9fa48("6208"), /\.git$/), stryMutAct_9fa48("6209") ? "Stryker was here!" : (stryCov_9fa48("6209"), '')).replace(stryMutAct_9fa48("6211") ? /[a-z0-9]+/g : stryMutAct_9fa48("6210") ? /[^a-z0-9]/g : (stryCov_9fa48("6210", "6211"), /[^a-z0-9]+/g), stryMutAct_9fa48("6212") ? "" : (stryCov_9fa48("6212"), '-')).replace(stryMutAct_9fa48("6216") ? /^-+|-$/g : stryMutAct_9fa48("6215") ? /^-+|-+/g : stryMutAct_9fa48("6214") ? /^-|-+$/g : stryMutAct_9fa48("6213") ? /-+|-+$/g : (stryCov_9fa48("6213", "6214", "6215", "6216"), /^-+|-+$/g), stryMutAct_9fa48("6217") ? "Stryker was here!" : (stryCov_9fa48("6217"), '')).slice(0, 80));
  }
}
function fileSlug(p) {
  if (stryMutAct_9fa48("6218")) {
    {}
  } else {
    stryCov_9fa48("6218");
    return stryMutAct_9fa48("6220") ? String(p).replace(/\.[jt]sx?$/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase().slice(0, 60) : stryMutAct_9fa48("6219") ? String(p).replace(/\.[jt]sx?$/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() : (stryCov_9fa48("6219", "6220"), String(p).replace(stryMutAct_9fa48("6223") ? /\.[jt]sx$/ : stryMutAct_9fa48("6222") ? /\.[^jt]sx?$/ : stryMutAct_9fa48("6221") ? /\.[jt]sx?/ : (stryCov_9fa48("6221", "6222", "6223"), /\.[jt]sx?$/), stryMutAct_9fa48("6224") ? "Stryker was here!" : (stryCov_9fa48("6224"), '')).replace(stryMutAct_9fa48("6226") ? /[a-zA-Z0-9]+/g : stryMutAct_9fa48("6225") ? /[^a-zA-Z0-9]/g : (stryCov_9fa48("6225", "6226"), /[^a-zA-Z0-9]+/g), stryMutAct_9fa48("6227") ? "" : (stryCov_9fa48("6227"), '-')).replace(stryMutAct_9fa48("6231") ? /^-+|-$/g : stryMutAct_9fa48("6230") ? /^-+|-+/g : stryMutAct_9fa48("6229") ? /^-|-+$/g : stryMutAct_9fa48("6228") ? /-+|-+$/g : (stryCov_9fa48("6228", "6229", "6230", "6231"), /^-+|-+$/g), stryMutAct_9fa48("6232") ? "Stryker was here!" : (stryCov_9fa48("6232"), '')).toLowerCase().slice(0, 60));
  }
}
function nowSec() {
  if (stryMutAct_9fa48("6233")) {
    {}
  } else {
    stryCov_9fa48("6233");
    return Math.floor(stryMutAct_9fa48("6234") ? Date.now() * 1000 : (stryCov_9fa48("6234"), Date.now() / 1000));
  }
}
function round2(x) {
  if (stryMutAct_9fa48("6235")) {
    {}
  } else {
    stryCov_9fa48("6235");
    return stryMutAct_9fa48("6236") ? Math.round(x * 100) * 100 : (stryCov_9fa48("6236"), Math.round(stryMutAct_9fa48("6237") ? x / 100 : (stryCov_9fa48("6237"), x * 100)) / 100);
  }
}

/** MAC = coverage% × mutation% / 100, both in [0,100]. */
function mac(coveragePct, mutationPct) {
  if (stryMutAct_9fa48("6238")) {
    {}
  } else {
    stryCov_9fa48("6238");
    if (stryMutAct_9fa48("6241") ? coveragePct == null && mutationPct == null : stryMutAct_9fa48("6240") ? false : stryMutAct_9fa48("6239") ? true : (stryCov_9fa48("6239", "6240", "6241"), (stryMutAct_9fa48("6243") ? coveragePct != null : stryMutAct_9fa48("6242") ? false : (stryCov_9fa48("6242", "6243"), coveragePct == null)) || (stryMutAct_9fa48("6245") ? mutationPct != null : stryMutAct_9fa48("6244") ? false : (stryCov_9fa48("6244", "6245"), mutationPct == null)))) return null;
    return round2(stryMutAct_9fa48("6246") ? coveragePct * mutationPct * 100 : (stryCov_9fa48("6246"), (stryMutAct_9fa48("6247") ? coveragePct / mutationPct : (stryCov_9fa48("6247"), coveragePct * mutationPct)) / 100));
  }
}

/** Extract the first balanced JSON object or array from LLM output. */
/**
 * Find the LAST complete JSON OBJECT in a block of prose. Used to salvage an answer
 * the model wrote inside its reasoning channel and then had cut off before it could
 * repeat it as content.
 *
 * Stricter than extractJson on purpose. Reasoning text quotes the prompt, so the
 * first JSON-looking thing in it is routinely something else — in the reply that
 * prompted this function, an array of uncovered line numbers copied out of the
 * prompt. Accepting that would report a successful parse of an object the caller
 * cannot use, and skip the retry that would have produced a real answer.
 */
function extractLastJsonObject(text) {
  if (stryMutAct_9fa48("6248")) {
    {}
  } else {
    stryCov_9fa48("6248");
    if (stryMutAct_9fa48("6251") ? false : stryMutAct_9fa48("6250") ? true : stryMutAct_9fa48("6249") ? text : (stryCov_9fa48("6249", "6250", "6251"), !text)) return null;
    const s = String(text).replace(stryMutAct_9fa48("6252") ? /```(?:json)/g : (stryCov_9fa48("6252"), /```(?:json)?/g), stryMutAct_9fa48("6253") ? "Stryker was here!" : (stryCov_9fa48("6253"), ''));
    let best = null;
    for (let i = 0; stryMutAct_9fa48("6256") ? i >= s.length : stryMutAct_9fa48("6255") ? i <= s.length : stryMutAct_9fa48("6254") ? false : (stryCov_9fa48("6254", "6255", "6256"), i < s.length); stryMutAct_9fa48("6257") ? i-- : (stryCov_9fa48("6257"), i++)) {
      if (stryMutAct_9fa48("6258")) {
        {}
      } else {
        stryCov_9fa48("6258");
        if (stryMutAct_9fa48("6261") ? s[i] === '{' : stryMutAct_9fa48("6260") ? false : stryMutAct_9fa48("6259") ? true : (stryCov_9fa48("6259", "6260", "6261"), s[i] !== (stryMutAct_9fa48("6262") ? "" : (stryCov_9fa48("6262"), '{')))) continue;
        let depth = 0,
          inStr = stryMutAct_9fa48("6263") ? true : (stryCov_9fa48("6263"), false),
          esc = stryMutAct_9fa48("6264") ? true : (stryCov_9fa48("6264"), false);
        for (let j = i; stryMutAct_9fa48("6267") ? j >= s.length : stryMutAct_9fa48("6266") ? j <= s.length : stryMutAct_9fa48("6265") ? false : (stryCov_9fa48("6265", "6266", "6267"), j < s.length); stryMutAct_9fa48("6268") ? j-- : (stryCov_9fa48("6268"), j++)) {
          if (stryMutAct_9fa48("6269")) {
            {}
          } else {
            stryCov_9fa48("6269");
            const c = s[j];
            if (stryMutAct_9fa48("6271") ? false : stryMutAct_9fa48("6270") ? true : (stryCov_9fa48("6270", "6271"), esc)) {
              if (stryMutAct_9fa48("6272")) {
                {}
              } else {
                stryCov_9fa48("6272");
                esc = stryMutAct_9fa48("6273") ? true : (stryCov_9fa48("6273"), false);
                continue;
              }
            }
            if (stryMutAct_9fa48("6276") ? c !== '\\' : stryMutAct_9fa48("6275") ? false : stryMutAct_9fa48("6274") ? true : (stryCov_9fa48("6274", "6275", "6276"), c === (stryMutAct_9fa48("6277") ? "" : (stryCov_9fa48("6277"), '\\')))) {
              if (stryMutAct_9fa48("6278")) {
                {}
              } else {
                stryCov_9fa48("6278");
                esc = stryMutAct_9fa48("6279") ? false : (stryCov_9fa48("6279"), true);
                continue;
              }
            }
            if (stryMutAct_9fa48("6282") ? c !== '"' : stryMutAct_9fa48("6281") ? false : stryMutAct_9fa48("6280") ? true : (stryCov_9fa48("6280", "6281", "6282"), c === (stryMutAct_9fa48("6283") ? "" : (stryCov_9fa48("6283"), '"')))) {
              if (stryMutAct_9fa48("6284")) {
                {}
              } else {
                stryCov_9fa48("6284");
                inStr = stryMutAct_9fa48("6285") ? inStr : (stryCov_9fa48("6285"), !inStr);
                continue;
              }
            }
            if (stryMutAct_9fa48("6287") ? false : stryMutAct_9fa48("6286") ? true : (stryCov_9fa48("6286", "6287"), inStr)) continue;
            if (stryMutAct_9fa48("6290") ? c !== '{' : stryMutAct_9fa48("6289") ? false : stryMutAct_9fa48("6288") ? true : (stryCov_9fa48("6288", "6289", "6290"), c === (stryMutAct_9fa48("6291") ? "" : (stryCov_9fa48("6291"), '{')))) stryMutAct_9fa48("6292") ? depth-- : (stryCov_9fa48("6292"), depth++);else if (stryMutAct_9fa48("6295") ? c !== '}' : stryMutAct_9fa48("6294") ? false : stryMutAct_9fa48("6293") ? true : (stryCov_9fa48("6293", "6294", "6295"), c === (stryMutAct_9fa48("6296") ? "" : (stryCov_9fa48("6296"), '}')))) {
              if (stryMutAct_9fa48("6297")) {
                {}
              } else {
                stryCov_9fa48("6297");
                stryMutAct_9fa48("6298") ? depth++ : (stryCov_9fa48("6298"), depth--);
                if (stryMutAct_9fa48("6301") ? depth !== 0 : stryMutAct_9fa48("6300") ? false : stryMutAct_9fa48("6299") ? true : (stryCov_9fa48("6299", "6300", "6301"), depth === 0)) {
                  if (stryMutAct_9fa48("6302")) {
                    {}
                  } else {
                    stryCov_9fa48("6302");
                    try {
                      if (stryMutAct_9fa48("6303")) {
                        {}
                      } else {
                        stryCov_9fa48("6303");
                        const v = JSON.parse(stryMutAct_9fa48("6304") ? s : (stryCov_9fa48("6304"), s.slice(i, stryMutAct_9fa48("6305") ? j - 1 : (stryCov_9fa48("6305"), j + 1))));
                        // an empty object is not an answer, and neither is an array — the
                        // reasoning quotes the prompt, so arrays in it are usually its input
                        if (stryMutAct_9fa48("6308") ? v && typeof v === 'object' && !Array.isArray(v) || Object.keys(v).length : stryMutAct_9fa48("6307") ? false : stryMutAct_9fa48("6306") ? true : (stryCov_9fa48("6306", "6307", "6308"), (stryMutAct_9fa48("6310") ? v && typeof v === 'object' || !Array.isArray(v) : stryMutAct_9fa48("6309") ? true : (stryCov_9fa48("6309", "6310"), (stryMutAct_9fa48("6312") ? v || typeof v === 'object' : stryMutAct_9fa48("6311") ? true : (stryCov_9fa48("6311", "6312"), v && (stryMutAct_9fa48("6314") ? typeof v !== 'object' : stryMutAct_9fa48("6313") ? true : (stryCov_9fa48("6313", "6314"), typeof v === (stryMutAct_9fa48("6315") ? "" : (stryCov_9fa48("6315"), 'object')))))) && (stryMutAct_9fa48("6316") ? Array.isArray(v) : (stryCov_9fa48("6316"), !Array.isArray(v))))) && Object.keys(v).length)) {
                          if (stryMutAct_9fa48("6317")) {
                            {}
                          } else {
                            stryCov_9fa48("6317");
                            best = v;
                            i = j; // skip past it: braces INSIDE it are not candidates
                          }
                        }
                      }
                    } catch {}
                    break;
                  }
                }
              }
            }
          }
        }
      }
    }
    return best;
  }
}
function extractJson(text) {
  if (stryMutAct_9fa48("6318")) {
    {}
  } else {
    stryCov_9fa48("6318");
    if (stryMutAct_9fa48("6321") ? false : stryMutAct_9fa48("6320") ? true : stryMutAct_9fa48("6319") ? text : (stryCov_9fa48("6319", "6320", "6321"), !text)) return null;
    const s = String(text).replace(stryMutAct_9fa48("6326") ? /^[\s\s]*?<\/think>/ : stryMutAct_9fa48("6325") ? /^[\S\S]*?<\/think>/ : stryMutAct_9fa48("6324") ? /^[^\s\S]*?<\/think>/ : stryMutAct_9fa48("6323") ? /^[\s\S]<\/think>/ : stryMutAct_9fa48("6322") ? /[\s\S]*?<\/think>/ : (stryCov_9fa48("6322", "6323", "6324", "6325", "6326"), /^[\s\S]*?<\/think>/), stryMutAct_9fa48("6327") ? "Stryker was here!" : (stryCov_9fa48("6327"), '')) // drop thinking block if present
    .replace(stryMutAct_9fa48("6328") ? /```(?:json)/g : (stryCov_9fa48("6328"), /```(?:json)?/g), stryMutAct_9fa48("6329") ? "Stryker was here!" : (stryCov_9fa48("6329"), ''));
    // try whichever bracket opens FIRST — otherwise a top-level array response
    // ("[{...}]") yields its first element instead of the array
    const openers = stryMutAct_9fa48("6331") ? [['{', s.indexOf('{')], ['[', s.indexOf('[')]].sort((a, b) => a[1] - b[1]).map(([c]) => c) : stryMutAct_9fa48("6330") ? [['{', s.indexOf('{')], ['[', s.indexOf('[')]].filter(([, i]) => i !== -1).map(([c]) => c) : (stryCov_9fa48("6330", "6331"), (stryMutAct_9fa48("6332") ? [] : (stryCov_9fa48("6332"), [stryMutAct_9fa48("6333") ? [] : (stryCov_9fa48("6333"), [stryMutAct_9fa48("6334") ? "" : (stryCov_9fa48("6334"), '{'), s.indexOf(stryMutAct_9fa48("6335") ? "" : (stryCov_9fa48("6335"), '{'))]), stryMutAct_9fa48("6336") ? [] : (stryCov_9fa48("6336"), [stryMutAct_9fa48("6337") ? "" : (stryCov_9fa48("6337"), '['), s.indexOf(stryMutAct_9fa48("6338") ? "" : (stryCov_9fa48("6338"), '['))])])).filter(stryMutAct_9fa48("6339") ? () => undefined : (stryCov_9fa48("6339"), ([, i]) => stryMutAct_9fa48("6342") ? i === -1 : stryMutAct_9fa48("6341") ? false : stryMutAct_9fa48("6340") ? true : (stryCov_9fa48("6340", "6341", "6342"), i !== (stryMutAct_9fa48("6343") ? +1 : (stryCov_9fa48("6343"), -1))))).sort(stryMutAct_9fa48("6344") ? () => undefined : (stryCov_9fa48("6344"), (a, b) => stryMutAct_9fa48("6345") ? a[1] + b[1] : (stryCov_9fa48("6345"), a[1] - b[1]))).map(stryMutAct_9fa48("6346") ? () => undefined : (stryCov_9fa48("6346"), ([c]) => c)));
    for (const opener of openers) {
      if (stryMutAct_9fa48("6347")) {
        {}
      } else {
        stryCov_9fa48("6347");
        const start = s.indexOf(opener);
        const closer = (stryMutAct_9fa48("6350") ? opener !== '{' : stryMutAct_9fa48("6349") ? false : stryMutAct_9fa48("6348") ? true : (stryCov_9fa48("6348", "6349", "6350"), opener === (stryMutAct_9fa48("6351") ? "" : (stryCov_9fa48("6351"), '{')))) ? stryMutAct_9fa48("6352") ? "" : (stryCov_9fa48("6352"), '}') : stryMutAct_9fa48("6353") ? "" : (stryCov_9fa48("6353"), ']');
        let depth = 0,
          inStr = stryMutAct_9fa48("6354") ? true : (stryCov_9fa48("6354"), false),
          esc = stryMutAct_9fa48("6355") ? true : (stryCov_9fa48("6355"), false);
        for (let i = start; stryMutAct_9fa48("6358") ? i >= s.length : stryMutAct_9fa48("6357") ? i <= s.length : stryMutAct_9fa48("6356") ? false : (stryCov_9fa48("6356", "6357", "6358"), i < s.length); stryMutAct_9fa48("6359") ? i-- : (stryCov_9fa48("6359"), i++)) {
          if (stryMutAct_9fa48("6360")) {
            {}
          } else {
            stryCov_9fa48("6360");
            const c = s[i];
            if (stryMutAct_9fa48("6362") ? false : stryMutAct_9fa48("6361") ? true : (stryCov_9fa48("6361", "6362"), esc)) {
              if (stryMutAct_9fa48("6363")) {
                {}
              } else {
                stryCov_9fa48("6363");
                esc = stryMutAct_9fa48("6364") ? true : (stryCov_9fa48("6364"), false);
                continue;
              }
            }
            if (stryMutAct_9fa48("6367") ? c !== '\\' : stryMutAct_9fa48("6366") ? false : stryMutAct_9fa48("6365") ? true : (stryCov_9fa48("6365", "6366", "6367"), c === (stryMutAct_9fa48("6368") ? "" : (stryCov_9fa48("6368"), '\\')))) {
              if (stryMutAct_9fa48("6369")) {
                {}
              } else {
                stryCov_9fa48("6369");
                esc = stryMutAct_9fa48("6370") ? false : (stryCov_9fa48("6370"), true);
                continue;
              }
            }
            if (stryMutAct_9fa48("6373") ? c !== '"' : stryMutAct_9fa48("6372") ? false : stryMutAct_9fa48("6371") ? true : (stryCov_9fa48("6371", "6372", "6373"), c === (stryMutAct_9fa48("6374") ? "" : (stryCov_9fa48("6374"), '"')))) {
              if (stryMutAct_9fa48("6375")) {
                {}
              } else {
                stryCov_9fa48("6375");
                inStr = stryMutAct_9fa48("6376") ? inStr : (stryCov_9fa48("6376"), !inStr);
                continue;
              }
            }
            if (stryMutAct_9fa48("6378") ? false : stryMutAct_9fa48("6377") ? true : (stryCov_9fa48("6377", "6378"), inStr)) continue;
            if (stryMutAct_9fa48("6381") ? c !== opener : stryMutAct_9fa48("6380") ? false : stryMutAct_9fa48("6379") ? true : (stryCov_9fa48("6379", "6380", "6381"), c === opener)) stryMutAct_9fa48("6382") ? depth-- : (stryCov_9fa48("6382"), depth++);else if (stryMutAct_9fa48("6385") ? c !== closer : stryMutAct_9fa48("6384") ? false : stryMutAct_9fa48("6383") ? true : (stryCov_9fa48("6383", "6384", "6385"), c === closer)) {
              if (stryMutAct_9fa48("6386")) {
                {}
              } else {
                stryCov_9fa48("6386");
                stryMutAct_9fa48("6387") ? depth++ : (stryCov_9fa48("6387"), depth--);
                if (stryMutAct_9fa48("6390") ? depth !== 0 : stryMutAct_9fa48("6389") ? false : stryMutAct_9fa48("6388") ? true : (stryCov_9fa48("6388", "6389", "6390"), depth === 0)) {
                  if (stryMutAct_9fa48("6391")) {
                    {}
                  } else {
                    stryCov_9fa48("6391");
                    try {
                      if (stryMutAct_9fa48("6392")) {
                        {}
                      } else {
                        stryCov_9fa48("6392");
                        return JSON.parse(stryMutAct_9fa48("6393") ? s : (stryCov_9fa48("6393"), s.slice(start, stryMutAct_9fa48("6394") ? i - 1 : (stryCov_9fa48("6394"), i + 1))));
                      }
                    } catch {
                      if (stryMutAct_9fa48("6395")) {
                        {}
                      } else {
                        stryCov_9fa48("6395");
                        break;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    return null;
  }
}
function clamp(x, lo, hi) {
  if (stryMutAct_9fa48("6396")) {
    {}
  } else {
    stryCov_9fa48("6396");
    return stryMutAct_9fa48("6397") ? Math.min(lo, Math.min(hi, x)) : (stryCov_9fa48("6397"), Math.max(lo, stryMutAct_9fa48("6398") ? Math.max(hi, x) : (stryCov_9fa48("6398"), Math.min(hi, x))));
  }
}

/**
 * Strip secrets from anything that reaches the event log, the dashboard or an
 * HTTP response. Tool output (git, npm, gh) can echo credentials we passed in.
 */
function redact(text) {
  if (stryMutAct_9fa48("6399")) {
    {}
  } else {
    stryCov_9fa48("6399");
    let s = String(stryMutAct_9fa48("6400") ? text && '' : (stryCov_9fa48("6400"), text ?? (stryMutAct_9fa48("6401") ? "Stryker was here!" : (stryCov_9fa48("6401"), ''))));
    for (const secret of stryMutAct_9fa48("6402") ? [] : (stryCov_9fa48("6402"), [process.env.GH_TOKEN, process.env.LLM_API_KEY])) {
      if (stryMutAct_9fa48("6403")) {
        {}
      } else {
        stryCov_9fa48("6403");
        if (stryMutAct_9fa48("6406") ? secret || secret.length >= 8 : stryMutAct_9fa48("6405") ? false : stryMutAct_9fa48("6404") ? true : (stryCov_9fa48("6404", "6405", "6406"), secret && (stryMutAct_9fa48("6409") ? secret.length < 8 : stryMutAct_9fa48("6408") ? secret.length > 8 : stryMutAct_9fa48("6407") ? true : (stryCov_9fa48("6407", "6408", "6409"), secret.length >= 8)))) s = s.split(secret).join(stryMutAct_9fa48("6410") ? "" : (stryCov_9fa48("6410"), '«redacted»'));
      }
    }
    return s.replace(stryMutAct_9fa48("6413") ? /\b(gh[pousr]_[^A-Za-z0-9]{16,})/g : stryMutAct_9fa48("6412") ? /\b(gh[pousr]_[A-Za-z0-9])/g : stryMutAct_9fa48("6411") ? /\b(gh[^pousr]_[A-Za-z0-9]{16,})/g : (stryCov_9fa48("6411", "6412", "6413"), /\b(gh[pousr]_[A-Za-z0-9]{16,})/g), stryMutAct_9fa48("6414") ? "" : (stryCov_9fa48("6414"), '«redacted-gh-token»')).replace(stryMutAct_9fa48("6416") ? /\b(github_pat_[^A-Za-z0-9_]{20,})/g : stryMutAct_9fa48("6415") ? /\b(github_pat_[A-Za-z0-9_])/g : (stryCov_9fa48("6415", "6416"), /\b(github_pat_[A-Za-z0-9_]{20,})/g), stryMutAct_9fa48("6417") ? "" : (stryCov_9fa48("6417"), '«redacted-gh-token»')).replace(stryMutAct_9fa48("6419") ? /\bsk-[^A-Za-z0-9-]{16,}/g : stryMutAct_9fa48("6418") ? /\bsk-[A-Za-z0-9-]/g : (stryCov_9fa48("6418", "6419"), /\bsk-[A-Za-z0-9-]{16,}/g), stryMutAct_9fa48("6420") ? "" : (stryCov_9fa48("6420"), '«redacted-api-key»')).replace(stryMutAct_9fa48("6427") ? /(https?:\/\/)[^/@\s:]+:[^/@\S]+@/g : stryMutAct_9fa48("6426") ? /(https?:\/\/)[^/@\s:]+:[/@\s]+@/g : stryMutAct_9fa48("6425") ? /(https?:\/\/)[^/@\s:]+:[^/@\s]@/g : stryMutAct_9fa48("6424") ? /(https?:\/\/)[^/@\S:]+:[^/@\s]+@/g : stryMutAct_9fa48("6423") ? /(https?:\/\/)[/@\s:]+:[^/@\s]+@/g : stryMutAct_9fa48("6422") ? /(https?:\/\/)[^/@\s:]:[^/@\s]+@/g : stryMutAct_9fa48("6421") ? /(https:\/\/)[^/@\s:]+:[^/@\s]+@/g : (stryCov_9fa48("6421", "6422", "6423", "6424", "6425", "6426", "6427"), /(https?:\/\/)[^/@\s:]+:[^/@\s]+@/g), stryMutAct_9fa48("6428") ? "" : (stryCov_9fa48("6428"), '$1«redacted»@'));
  }
}
module.exports = stryMutAct_9fa48("6429") ? {} : (stryCov_9fa48("6429"), {
  extractLastJsonObject,
  globsToMatcher,
  globToRegExp,
  splitGlobList,
  slugify,
  fileSlug,
  nowSec,
  round2,
  mac,
  extractJson,
  clamp,
  redact
});