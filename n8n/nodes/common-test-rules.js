// The rules every generated test must obey, regardless of which phase asked for it.
// A function rather than a constant because `emit` inlines deps by SOURCE, and a
// function declaration is the only form that survives Function.prototype.toString().
//
// The leading newline is deliberate: callers concatenate this straight after the
// word "Rules:" in their system prompt.
//
// maxFiles is a parameter because the phases genuinely differ: the coverage bootstrap
// may write two files, the mutant loop keeps exactly one (killParseTest slices to 1).
// A shared constant saying "at most 2" contradicted the kill prompt's "EXACTLY ONE",
// so the model paid for a second file that was then thrown away.
export function commonTestRules(maxFiles = 2) {
  return '\n- Tests must be deterministic (no timing races, no network, no randomness without seeding).'
    + '\n- Code must satisfy strict linters: no `any` types, no unused imports or variables, no non-null assertions.'
    + '\n- Import the module under test via its public path exactly as existing tests do.'
    + '\n- Never inspect function source code (no fn.toString() introspection).'
    + '\n- No snapshot tests. Prefer precise value assertions.'
    + '\n- The tests MUST pass against the CURRENT implementation of the source file.'
    + (maxFiles === 1 ? '\n- Output EXACTLY ONE test file.' : '\n- Output at most ' + maxFiles + ' test files.');
}
