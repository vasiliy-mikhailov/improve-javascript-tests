# Agent rules for this repository

- After cloning: work only under `src/`; never modify files in `src/ui/` — UI is off limits.
- Branch naming: every automated change lives on its own branch named `tests/improve-{file}`.
- Tests: put new tests in `test/`, files named `<module>.something.test.js`. No introspection
  of function sources, no snapshot tests.
- A change is good only if the test suite is green and mutation-adjusted coverage improved.
- PRs: title must start with `test:`; body must contain a before/after metrics table.
