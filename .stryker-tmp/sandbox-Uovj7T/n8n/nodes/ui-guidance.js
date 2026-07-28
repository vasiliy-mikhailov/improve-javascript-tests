// @ts-nocheck
// Component-testing guidance appended to a prompt when the picked file is a UI
// component. Shared by BOTH prompt builders, so it lives in one file and is passed
// to `emit` as a dep — the generator inlines this source next to whichever builder
// needs it, which is why it may not reference anything outside its own arguments.
// Every helper below is therefore declared INSIDE the function, like the djb2 hash
// in kill-build-prompt.js: an n8n Code node has no require() and no imports.
//
// `gaps` is whatever the caller knows about the file: { ui, source, ... }. The
// coverage phase passes the /api/files/gaps response; the mutant loop builds an
// equivalent shape out of the /api/mutant/next response.
//
// TWO SIGNALS, and they are not equally strong:
//   1. a .jsx/.tsx extension — JSX compiles nowhere else, so the path settles it;
//   2. a VALUE import of the framework the repo itself uses, found anywhere in the
//      source with comments removed.
// Deliberately NOT signals, because text alone cannot tell them apart from noise:
// JSX-in-.js (a `<` is a comparison as often as a tag), a framework specifier that
// only exists inside a template literal holding generated code, and a subpath like
// `svelte/store` (observable state, not a component).
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
export function uiGuidance(file, gaps) {
  if (stryMutAct_9fa48("653")) {
    {}
  } else {
    stryCov_9fa48("653");
    const ui = gaps.ui;
    // The guidance below names ui.framework and ui.testingLibrary, so the file has to
    // use THAT framework: firing on a vue import in a react-first repo would tell the
    // model to render a vue module with @testing-library/react. react and preact are
    // the one pair that answer for each other — preact/compat aliases the "react"
    // specifier, so a preact repo's own components import it under that name.
    const fw = stryMutAct_9fa48("655") ? String(ui && ui.framework || '').toLowerCase() : stryMutAct_9fa48("654") ? String(ui && ui.framework || '').trim().toUpperCase() : (stryCov_9fa48("654", "655"), String(stryMutAct_9fa48("658") ? ui && ui.framework && '' : stryMutAct_9fa48("657") ? false : stryMutAct_9fa48("656") ? true : (stryCov_9fa48("656", "657", "658"), (stryMutAct_9fa48("660") ? ui || ui.framework : stryMutAct_9fa48("659") ? false : (stryCov_9fa48("659", "660"), ui && ui.framework)) || (stryMutAct_9fa48("661") ? "Stryker was here!" : (stryCov_9fa48("661"), '')))).trim().toLowerCase());
    // sanitised, because `framework` arrives as JSON and is spliced into a RegExp
    const pkgs = (stryMutAct_9fa48("664") ? fw === 'react' && fw === 'preact' : stryMutAct_9fa48("663") ? false : stryMutAct_9fa48("662") ? true : (stryCov_9fa48("662", "663", "664"), (stryMutAct_9fa48("666") ? fw !== 'react' : stryMutAct_9fa48("665") ? false : (stryCov_9fa48("665", "666"), fw === (stryMutAct_9fa48("667") ? "" : (stryCov_9fa48("667"), 'react')))) || (stryMutAct_9fa48("669") ? fw !== 'preact' : stryMutAct_9fa48("668") ? false : (stryCov_9fa48("668", "669"), fw === (stryMutAct_9fa48("670") ? "" : (stryCov_9fa48("670"), 'preact')))))) ? stryMutAct_9fa48("671") ? "" : (stryCov_9fa48("671"), 'react|preact') : fw.replace(stryMutAct_9fa48("672") ? /[a-z]/g : (stryCov_9fa48("672"), /[^a-z]/g), stryMutAct_9fa48("673") ? "Stryker was here!" : (stryCov_9fa48("673"), ''));
    const importsFramework = () => {
      if (stryMutAct_9fa48("674")) {
        {}
      } else {
        stryCov_9fa48("674");
        if (stryMutAct_9fa48("677") ? false : stryMutAct_9fa48("676") ? true : stryMutAct_9fa48("675") ? pkgs : (stryCov_9fa48("675", "676", "677"), !pkgs)) return stryMutAct_9fa48("678") ? true : (stryCov_9fa48("678"), false);
        // The WHOLE file, not a window. The old 2000-character limit missed every
        // component whose import sat behind a licence header or a block of type
        // declarations — i.e. exactly the files a company actually ships. The ceiling
        // here only bounds a caller that hands us a bundle: the sidecar reads at most
        // 24 000 characters into `source` (repo.readFileSafe), so it never binds.
        const src = stryMutAct_9fa48("679") ? typeof gaps.source === 'string' ? gaps.source : '' : (stryCov_9fa48("679"), ((stryMutAct_9fa48("682") ? typeof gaps.source !== 'string' : stryMutAct_9fa48("681") ? false : stryMutAct_9fa48("680") ? true : (stryCov_9fa48("680", "681", "682"), typeof gaps.source === (stryMutAct_9fa48("683") ? "" : (stryCov_9fa48("683"), 'string')))) ? gaps.source : stryMutAct_9fa48("684") ? "Stryker was here!" : (stryCov_9fa48("684"), '')).slice(0, 200000));

        // Comments come out before matching. A file that merely MENTIONS the framework —
        // a note, a commented-out import, a JSDoc `@type {import('react').FC}` — does not
        // use it, and dressing it up as a component sends the model looking for a DOM
        // that will never exist. Strings need no scanner: the shapes below require a
        // statement boundary, and a specifier quoted inside someone else's string sits in
        // the middle of an expression, never at one.
        const lines = stryMutAct_9fa48("685") ? ["Stryker was here"] : (stryCov_9fa48("685"), []);
        let inBlock = stryMutAct_9fa48("686") ? true : (stryCov_9fa48("686"), false);
        for (let raw of src.split(stryMutAct_9fa48("687") ? "" : (stryCov_9fa48("687"), '\n'))) {
          if (stryMutAct_9fa48("688")) {
            {}
          } else {
            stryCov_9fa48("688");
            if (stryMutAct_9fa48("690") ? false : stryMutAct_9fa48("689") ? true : (stryCov_9fa48("689", "690"), inBlock)) {
              if (stryMutAct_9fa48("691")) {
                {}
              } else {
                stryCov_9fa48("691");
                const close = raw.indexOf(stryMutAct_9fa48("692") ? "" : (stryCov_9fa48("692"), '*/'));
                if (stryMutAct_9fa48("696") ? close >= 0 : stryMutAct_9fa48("695") ? close <= 0 : stryMutAct_9fa48("694") ? false : stryMutAct_9fa48("693") ? true : (stryCov_9fa48("693", "694", "695", "696"), close < 0)) continue;
                inBlock = stryMutAct_9fa48("697") ? true : (stryCov_9fa48("697"), false);
                raw = stryMutAct_9fa48("698") ? raw : (stryCov_9fa48("698"), raw.slice(stryMutAct_9fa48("699") ? close - 2 : (stryCov_9fa48("699"), close + 2)));
              }
            }
            // `//` ends the line — unless it is the `//` of a URL, which would cut real code
            const slashes = raw.match(stryMutAct_9fa48("701") ? /(^|[:])\/\// : stryMutAct_9fa48("700") ? /([^:])\/\// : (stryCov_9fa48("700", "701"), /(^|[^:])\/\//));
            if (stryMutAct_9fa48("703") ? false : stryMutAct_9fa48("702") ? true : (stryCov_9fa48("702", "703"), slashes)) raw = stryMutAct_9fa48("704") ? raw : (stryCov_9fa48("704"), raw.slice(0, stryMutAct_9fa48("705") ? slashes.index - slashes[1].length : (stryCov_9fa48("705"), slashes.index + slashes[1].length)));
            const open = raw.indexOf(stryMutAct_9fa48("706") ? "" : (stryCov_9fa48("706"), '/*'));
            if (stryMutAct_9fa48("710") ? open < 0 : stryMutAct_9fa48("709") ? open > 0 : stryMutAct_9fa48("708") ? false : stryMutAct_9fa48("707") ? true : (stryCov_9fa48("707", "708", "709", "710"), open >= 0)) {
              if (stryMutAct_9fa48("711")) {
                {}
              } else {
                stryCov_9fa48("711");
                const close = raw.indexOf(stryMutAct_9fa48("712") ? "" : (stryCov_9fa48("712"), '*/'), stryMutAct_9fa48("713") ? open - 2 : (stryCov_9fa48("713"), open + 2));
                if (stryMutAct_9fa48("717") ? close < 0 : stryMutAct_9fa48("716") ? close > 0 : stryMutAct_9fa48("715") ? false : stryMutAct_9fa48("714") ? true : (stryCov_9fa48("714", "715", "716", "717"), close >= 0)) raw = (stryMutAct_9fa48("718") ? raw : (stryCov_9fa48("718"), raw.slice(0, open))) + (stryMutAct_9fa48("719") ? "" : (stryCov_9fa48("719"), ' ')) + (stryMutAct_9fa48("720") ? raw : (stryCov_9fa48("720"), raw.slice(stryMutAct_9fa48("721") ? close - 2 : (stryCov_9fa48("721"), close + 2))));
                // Only a block comment that OPENS a line is followed across lines. A `/*`
                // appearing mid-line may be inside a string literal, and treating that as a
                // comment would swallow the rest of the file — a silent miss, the very bug
                // this rewrite exists to remove. Erring towards detection is the safe side.
                else if (stryMutAct_9fa48("724") ? false : stryMutAct_9fa48("723") ? true : stryMutAct_9fa48("722") ? raw.slice(0, open).trim() : (stryCov_9fa48("722", "723", "724"), !(stryMutAct_9fa48("726") ? raw.trim() : stryMutAct_9fa48("725") ? raw.slice(0, open) : (stryCov_9fa48("725", "726"), raw.slice(0, open).trim())))) {
                  if (stryMutAct_9fa48("727")) {
                    {}
                  } else {
                    stryCov_9fa48("727");
                    inBlock = stryMutAct_9fa48("728") ? false : (stryCov_9fa48("728"), true);
                    continue;
                  }
                }
              }
            }
            if (stryMutAct_9fa48("731") ? raw.trim().charAt(0) !== '*' : stryMutAct_9fa48("730") ? false : stryMutAct_9fa48("729") ? true : (stryCov_9fa48("729", "730", "731"), (stryMutAct_9fa48("733") ? raw.charAt(0) : stryMutAct_9fa48("732") ? raw.trim() : (stryCov_9fa48("732", "733"), raw.trim().charAt(0))) === (stryMutAct_9fa48("734") ? "" : (stryCov_9fa48("734"), '*')))) continue; // JSDoc continuation line
            lines.push(raw);
          }
        }
        const code = lines.join(stryMutAct_9fa48("735") ? "" : (stryCov_9fa48("735"), '\n'));
        const spec = (stryMutAct_9fa48("736") ? "" : (stryCov_9fa48("736"), "['\"](?:")) + pkgs + (stryMutAct_9fa48("737") ? "" : (stryCov_9fa48("737"), ")['\"]"));
        // `import <clause> from 'react'`. The clause may contain neither a quote, a
        // backtick nor a semicolon, so one match can never run across the neighbouring
        // statement — which is what makes the type-only verdict below trustworthy.
        // The {0,2000} bound is not cosmetic: an unbounded lazy run turns this quadratic
        // (measured 1.2 s on 200 000 characters of quote-free `import` lines) because
        // every candidate start rescans to the end of the file. No real import clause is
        // anywhere near 2000 characters — react's entire public API is ~40 names.
        const esm = new RegExp((stryMutAct_9fa48("738") ? "" : (stryCov_9fa48("738"), "(?:^|[;\\n])[ \\t]*import\\s+([^'\"`;]{0,2000}?)from\\s*")) + spec, stryMutAct_9fa48("739") ? "" : (stryCov_9fa48("739"), 'g'));
        // Type imports are erased at compile time: such a file borrows the framework's
        // SIGNATURES (a props interface, a ReactNode parameter) and renders nothing.
        const typeOnly = clause => {
          if (stryMutAct_9fa48("740")) {
            {}
          } else {
            stryCov_9fa48("740");
            const c = stryMutAct_9fa48("741") ? clause : (stryCov_9fa48("741"), clause.trim());
            if (stryMutAct_9fa48("743") ? false : stryMutAct_9fa48("742") ? true : (stryCov_9fa48("742", "743"), (stryMutAct_9fa48("744") ? /type\b/ : (stryCov_9fa48("744"), /^type\b/)).test(c))) return stryMutAct_9fa48("745") ? false : (stryCov_9fa48("745"), true);
            const named = c.match(stryMutAct_9fa48("751") ? /^\{([\s\s]*)\}$/ : stryMutAct_9fa48("750") ? /^\{([\S\S]*)\}$/ : stryMutAct_9fa48("749") ? /^\{([^\s\S]*)\}$/ : stryMutAct_9fa48("748") ? /^\{([\s\S])\}$/ : stryMutAct_9fa48("747") ? /^\{([\s\S]*)\}/ : stryMutAct_9fa48("746") ? /\{([\s\S]*)\}$/ : (stryCov_9fa48("746", "747", "748", "749", "750", "751"), /^\{([\s\S]*)\}$/));
            if (stryMutAct_9fa48("754") ? false : stryMutAct_9fa48("753") ? true : stryMutAct_9fa48("752") ? named : (stryCov_9fa48("752", "753", "754"), !named)) return stryMutAct_9fa48("755") ? true : (stryCov_9fa48("755"), false); // a default or namespace binding is a value
            const parts = stryMutAct_9fa48("756") ? named[1].split(',').map(s => s.trim()) : (stryCov_9fa48("756"), named[1].split(stryMutAct_9fa48("757") ? "" : (stryCov_9fa48("757"), ',')).map(stryMutAct_9fa48("758") ? () => undefined : (stryCov_9fa48("758"), s => stryMutAct_9fa48("759") ? s : (stryCov_9fa48("759"), s.trim()))).filter(Boolean));
            return stryMutAct_9fa48("762") ? parts.length > 0 || parts.every(p => /^type\s/.test(p)) : stryMutAct_9fa48("761") ? false : stryMutAct_9fa48("760") ? true : (stryCov_9fa48("760", "761", "762"), (stryMutAct_9fa48("765") ? parts.length <= 0 : stryMutAct_9fa48("764") ? parts.length >= 0 : stryMutAct_9fa48("763") ? true : (stryCov_9fa48("763", "764", "765"), parts.length > 0)) && (stryMutAct_9fa48("766") ? parts.some(p => /^type\s/.test(p)) : (stryCov_9fa48("766"), parts.every(stryMutAct_9fa48("767") ? () => undefined : (stryCov_9fa48("767"), p => (stryMutAct_9fa48("769") ? /^type\S/ : stryMutAct_9fa48("768") ? /type\s/ : (stryCov_9fa48("768", "769"), /^type\s/)).test(p))))));
          }
        };
        // every match, not the first: a type-only import must not mask a real one below it
        let m;
        while (stryMutAct_9fa48("770") ? false : (stryCov_9fa48("770"), m = esm.exec(code))) if (stryMutAct_9fa48("773") ? false : stryMutAct_9fa48("772") ? true : stryMutAct_9fa48("771") ? typeOnly(m[1]) : (stryCov_9fa48("771", "772", "773"), !typeOnly(m[1]))) return stryMutAct_9fa48("774") ? false : (stryCov_9fa48("774"), true);
        // Side-effect import, CommonJS and dynamic import: all three are value imports by
        // construction and have no clause to inspect. `require` was the reported miss —
        // a CommonJS component used to be handed logic-test guidance, and the model then
        // wrote assertions about internals instead of about rendered output.
        if (stryMutAct_9fa48("776") ? false : stryMutAct_9fa48("775") ? true : (stryCov_9fa48("775", "776"), new RegExp((stryMutAct_9fa48("777") ? "" : (stryCov_9fa48("777"), "(?:^|[;\\n])\\s*import\\s*")) + spec).test(code))) return stryMutAct_9fa48("778") ? false : (stryCov_9fa48("778"), true);
        if (stryMutAct_9fa48("780") ? false : stryMutAct_9fa48("779") ? true : (stryCov_9fa48("779", "780"), new RegExp((stryMutAct_9fa48("781") ? "" : (stryCov_9fa48("781"), "\\brequire\\(\\s*")) + spec + (stryMutAct_9fa48("782") ? "" : (stryCov_9fa48("782"), "\\s*\\)"))).test(code))) return stryMutAct_9fa48("783") ? false : (stryCov_9fa48("783"), true);
        if (stryMutAct_9fa48("785") ? false : stryMutAct_9fa48("784") ? true : (stryCov_9fa48("784", "785"), new RegExp((stryMutAct_9fa48("786") ? "" : (stryCov_9fa48("786"), "\\bimport\\(\\s*")) + spec + (stryMutAct_9fa48("787") ? "" : (stryCov_9fa48("787"), "\\s*\\)"))).test(code))) return stryMutAct_9fa48("788") ? false : (stryCov_9fa48("788"), true);
        return stryMutAct_9fa48("789") ? true : (stryCov_9fa48("789"), false);
      }
    };

    // extension first: a .tsx file never pays for the scan
    const isComponent = stryMutAct_9fa48("792") ? /\.[jt]sx$/.test(String(file || '')) && importsFramework() : stryMutAct_9fa48("791") ? false : stryMutAct_9fa48("790") ? true : (stryCov_9fa48("790", "791", "792"), (stryMutAct_9fa48("794") ? /\.[^jt]sx$/ : stryMutAct_9fa48("793") ? /\.[jt]sx/ : (stryCov_9fa48("793", "794"), /\.[jt]sx$/)).test(String(stryMutAct_9fa48("797") ? file && '' : stryMutAct_9fa48("796") ? false : stryMutAct_9fa48("795") ? true : (stryCov_9fa48("795", "796", "797"), file || (stryMutAct_9fa48("798") ? "Stryker was here!" : (stryCov_9fa48("798"), ''))))) || importsFramework());
    return (stryMutAct_9fa48("801") ? ui || isComponent : stryMutAct_9fa48("800") ? false : stryMutAct_9fa48("799") ? true : (stryCov_9fa48("799", "800", "801"), ui && isComponent)) ? (stryMutAct_9fa48("802") ? '\nThis file is a UI COMPONENT (' + ui.framework + '). Component-testing rules:' + '\n- Render it with ' + (ui.testingLibrary || "the repo's established component-testing approach") + ' and assert on VISIBLE behavior: roles, accessible names, text, attributes — never on implementation internals or state.' + '\n- Prefer accessible queries (getByRole, getByLabelText, getByText) over test ids.' + (ui.userEvent ? "\n- Simulate clicks/typing with @testing-library/user-event and assert the resulting DOM and callback invocations." : '') - (ui.jestDom ? '\n- jest-dom matchers (toBeInTheDocument, toBeDisabled, toHaveAttribute, ...) are available.' : '') : (stryCov_9fa48("802"), (stryMutAct_9fa48("803") ? "" : (stryCov_9fa48("803"), '\nThis file is a UI COMPONENT (')) + ui.framework + (stryMutAct_9fa48("804") ? "" : (stryCov_9fa48("804"), '). Component-testing rules:')) + (stryMutAct_9fa48("805") ? "" : (stryCov_9fa48("805"), '\n- Render it with ')) + (stryMutAct_9fa48("808") ? ui.testingLibrary && "the repo's established component-testing approach" : stryMutAct_9fa48("807") ? false : stryMutAct_9fa48("806") ? true : (stryCov_9fa48("806", "807", "808"), ui.testingLibrary || (stryMutAct_9fa48("809") ? "" : (stryCov_9fa48("809"), "the repo's established component-testing approach")))) + (stryMutAct_9fa48("810") ? "" : (stryCov_9fa48("810"), ' and assert on VISIBLE behavior: roles, accessible names, text, attributes — never on implementation internals or state.')) + (stryMutAct_9fa48("811") ? "" : (stryCov_9fa48("811"), '\n- Prefer accessible queries (getByRole, getByLabelText, getByText) over test ids.')) + (ui.userEvent ? stryMutAct_9fa48("812") ? "" : (stryCov_9fa48("812"), "\n- Simulate clicks/typing with @testing-library/user-event and assert the resulting DOM and callback invocations.") : stryMutAct_9fa48("813") ? "Stryker was here!" : (stryCov_9fa48("813"), '')) + (ui.jestDom ? stryMutAct_9fa48("814") ? "" : (stryCov_9fa48("814"), '\n- jest-dom matchers (toBeInTheDocument, toBeDisabled, toHaveAttribute, ...) are available.') : stryMutAct_9fa48("815") ? "Stryker was here!" : (stryCov_9fa48("815"), '')))) + (stryMutAct_9fa48("816") ? "" : (stryCov_9fa48("816"), '\n- Cover props/variants, conditional rendering branches, and event-handler callbacks (pass vi/jest mocks as handlers).')) + (stryMutAct_9fa48("817") ? "" : (stryCov_9fa48("817"), '\n- Do not snapshot; do not shallow-render; do not reach into component internals.')) : stryMutAct_9fa48("818") ? "Stryker was here!" : (stryCov_9fa48("818"), '');
  }
}