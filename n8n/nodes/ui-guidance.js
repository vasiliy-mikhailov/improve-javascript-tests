// Component-testing guidance appended to a prompt when the picked file is a UI
// component. Shared by BOTH prompt builders, so it lives in one file and is passed
// to `emit` as a dep — the generator inlines this source next to whichever builder
// needs it, which is why it may not reference anything outside its own arguments.
//
// `gaps` is whatever the caller knows about the file: { ui, source, ... }. The
// coverage phase passes the /api/files/gaps response; the mutant loop builds an
// equivalent shape out of the /api/mutant/next response.
export function uiGuidance(file, gaps) {
  const isComponent = /\.[jt]sx$/.test(file) || (gaps.ui && /from\s+["'](react|vue|svelte|preact)["']/.test(String(gaps.source || '').slice(0, 2000)));
  return (gaps.ui && isComponent) ? '\nThis file is a UI COMPONENT (' + gaps.ui.framework + '). Component-testing rules:'
    + '\n- Render it with ' + (gaps.ui.testingLibrary || "the repo's established component-testing approach") + ' and assert on VISIBLE behavior: roles, accessible names, text, attributes — never on implementation internals or state.'
    + '\n- Prefer accessible queries (getByRole, getByLabelText, getByText) over test ids.'
    + (gaps.ui.userEvent ? "\n- Simulate clicks/typing with @testing-library/user-event and assert the resulting DOM and callback invocations." : '')
    + (gaps.ui.jestDom ? '\n- jest-dom matchers (toBeInTheDocument, toBeDisabled, toHaveAttribute, ...) are available.' : '')
    + '\n- Cover props/variants, conditional rendering branches, and event-handler callbacks (pass vi/jest mocks as handlers).'
    + '\n- Do not snapshot; do not shallow-render; do not reach into component internals.'
    : '';
}
