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
    // Measured on what this pipeline shipped: in the one Prisma-backed file among five
    // PRs, 11 of 28 tests asserted ONLY on toHaveBeenCalledWith/mock.calls and never
    // looked at what the function returned — and every table was mocked to [], which is
    // what made the output meaningless in the first place. On a clean fixture the model
    // does the right thing unprompted (3/3), so this ranks a preference rather than
    // fixing a defect: assert on the code, fall back to the collaborator only when the
    // mutation is genuinely invisible in the output.
    + '\n- Assert on what the module DOES: its return value, what it throws, what it renders.'
    + '\n- Assert on how a collaborator was CALLED (toHaveBeenCalledWith, mock.calls) only when the'
    + ' mutation cannot be observed in the output at all. A test that only checks a mock was called'
    + ' passes mutation testing while proving nothing about behaviour.'
    + '\n- When you must mock, return REALISTIC data. Mocking a source to [] or {} switches off the'
    + ' logic under test, and then the query is the only thing left to assert on.'
    + '\n- The tests MUST pass against the CURRENT implementation of the source file.'
    + (maxFiles === 1 ? '\n- Output EXACTLY ONE test file.' : '\n- Output at most ' + maxFiles + ' test files.');
}
