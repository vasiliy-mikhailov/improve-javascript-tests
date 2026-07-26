// Inlines a node function's SOURCE into an n8n Code node body.
//
// A Code node cannot import anything, so the logic has to be copied in — but it is
// copied from the one real module that also gets unit-tested, never re-typed. The
// only thing the generator still owns is the binding line: which graph value feeds
// which argument.
//
//   emit(killBuildPrompt, [], '$json')
//     → "function killBuildPrompt(t) { ... }\nreturn [{ json: killBuildPrompt($json) }];"
//
// `deps` are the shared helper functions the node calls (uiGuidance, commonTestRules);
// their source is inlined ahead of the node function so the call resolves.
export function emit(fn, deps = [], ...argExprs) {
  return `${deps.map(d => d.toString()).join('\n')}\n${fn.toString()}\nreturn [{ json: ${fn.name}(${argExprs.join(', ')}) }];`;
}
