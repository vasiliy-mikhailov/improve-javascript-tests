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
export function uiGuidance(file, gaps) {
  const ui = gaps.ui;
  // The guidance below names ui.framework and ui.testingLibrary, so the file has to
  // use THAT framework: firing on a vue import in a react-first repo would tell the
  // model to render a vue module with @testing-library/react. react and preact are
  // the one pair that answer for each other — preact/compat aliases the "react"
  // specifier, so a preact repo's own components import it under that name.
  const fw = String((ui && ui.framework) || '').trim().toLowerCase();
  // sanitised, because `framework` arrives as JSON and is spliced into a RegExp
  const pkgs = (fw === 'react' || fw === 'preact') ? 'react|preact' : fw.replace(/[^a-z]/g, '');

  const importsFramework = () => {
    if (!pkgs) return false;
    // The WHOLE file, not a window. The old 2000-character limit missed every
    // component whose import sat behind a licence header or a block of type
    // declarations — i.e. exactly the files a company actually ships. The ceiling
    // here only bounds a caller that hands us a bundle: the sidecar reads at most
    // 24 000 characters into `source` (repo.readFileSafe), so it never binds.
    const src = (typeof gaps.source === 'string' ? gaps.source : '').slice(0, 200000);

    // Comments come out before matching. A file that merely MENTIONS the framework —
    // a note, a commented-out import, a JSDoc `@type {import('react').FC}` — does not
    // use it, and dressing it up as a component sends the model looking for a DOM
    // that will never exist. Strings need no scanner: the shapes below require a
    // statement boundary, and a specifier quoted inside someone else's string sits in
    // the middle of an expression, never at one.
    const lines = [];
    let inBlock = false;
    for (let raw of src.split('\n')) {
      if (inBlock) {
        const close = raw.indexOf('*/');
        if (close < 0) continue;
        inBlock = false;
        raw = raw.slice(close + 2);
      }
      // `//` ends the line — unless it is the `//` of a URL, which would cut real code
      const slashes = raw.match(/(^|[^:])\/\//);
      if (slashes) raw = raw.slice(0, slashes.index + slashes[1].length);
      const open = raw.indexOf('/*');
      if (open >= 0) {
        const close = raw.indexOf('*/', open + 2);
        if (close >= 0) raw = raw.slice(0, open) + ' ' + raw.slice(close + 2);
        // Only a block comment that OPENS a line is followed across lines. A `/*`
        // appearing mid-line may be inside a string literal, and treating that as a
        // comment would swallow the rest of the file — a silent miss, the very bug
        // this rewrite exists to remove. Erring towards detection is the safe side.
        else if (!raw.slice(0, open).trim()) { inBlock = true; continue; }
      }
      if (raw.trim().charAt(0) === '*') continue; // JSDoc continuation line
      lines.push(raw);
    }
    const code = lines.join('\n');

    const spec = "['\"](?:" + pkgs + ")['\"]";
    // `import <clause> from 'react'`. The clause may contain neither a quote, a
    // backtick nor a semicolon, so one match can never run across the neighbouring
    // statement — which is what makes the type-only verdict below trustworthy.
    // The {0,2000} bound is not cosmetic: an unbounded lazy run turns this quadratic
    // (measured 1.2 s on 200 000 characters of quote-free `import` lines) because
    // every candidate start rescans to the end of the file. No real import clause is
    // anywhere near 2000 characters — react's entire public API is ~40 names.
    const esm = new RegExp("(?:^|[;\\n])[ \\t]*import\\s+([^'\"`;]{0,2000}?)from\\s*" + spec, 'g');
    // Type imports are erased at compile time: such a file borrows the framework's
    // SIGNATURES (a props interface, a ReactNode parameter) and renders nothing.
    const typeOnly = (clause) => {
      const c = clause.trim();
      if (/^type\b/.test(c)) return true;
      const named = c.match(/^\{([\s\S]*)\}$/);
      if (!named) return false; // a default or namespace binding is a value
      const parts = named[1].split(',').map((s) => s.trim()).filter(Boolean);
      return parts.length > 0 && parts.every((p) => /^type\s/.test(p));
    };
    // every match, not the first: a type-only import must not mask a real one below it
    let m;
    while ((m = esm.exec(code))) if (!typeOnly(m[1])) return true;
    // Side-effect import, CommonJS and dynamic import: all three are value imports by
    // construction and have no clause to inspect. `require` was the reported miss —
    // a CommonJS component used to be handed logic-test guidance, and the model then
    // wrote assertions about internals instead of about rendered output.
    if (new RegExp("(?:^|[;\\n])\\s*import\\s*" + spec).test(code)) return true;
    if (new RegExp("\\brequire\\(\\s*" + spec + "\\s*\\)").test(code)) return true;
    if (new RegExp("\\bimport\\(\\s*" + spec + "\\s*\\)").test(code)) return true;
    return false;
  };

  // extension first: a .tsx file never pays for the scan
  const isComponent = /\.[jt]sx$/.test(String(file || '')) || importsFramework();
  return (ui && isComponent) ? '\nThis file is a UI COMPONENT (' + ui.framework + '). Component-testing rules:'
    + '\n- Render it with ' + (ui.testingLibrary || "the repo's established component-testing approach") + ' and assert on VISIBLE behavior: roles, accessible names, text, attributes — never on implementation internals or state.'
    + '\n- Prefer accessible queries (getByRole, getByLabelText, getByText) over test ids.'
    + (ui.userEvent ? "\n- Simulate clicks/typing with @testing-library/user-event and assert the resulting DOM and callback invocations." : '')
    + (ui.jestDom ? '\n- jest-dom matchers (toBeInTheDocument, toBeDisabled, toHaveAttribute, ...) are available.' : '')
    + '\n- Cover props/variants, conditional rendering branches, and event-handler callbacks (pass vi/jest mocks as handlers).'
    + '\n- Do not snapshot; do not shallow-render; do not reach into component internals.'
    : '';
}
