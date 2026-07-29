'use strict';
// ASSERTIONS ON WHAT rules.js ACTUALLY EMITS.
//
// rules.test.js drives every stage and checks the decision that comes back. What it
// never looks at is the two things this module really produces: the exact request it
// builds for the model, and the exact text it hands to git and GitHub. Both are pure
// string assembly, so every literal in the file can rot without a single test going
// red — a dropped `--- AGENTS.md (head) ---` header, a `\n\n` that became `\n`, a
// metrics table whose MAC row lost its bold, a `{file}` placeholder check that
// stopped checking, a 12k diff clip that stopped clipping. The pipeline keeps
// running and quietly stops honouring the team rule, or blows the context window.
//
// The other half is the mechanical pick order in applyPickFile. Its sort key is
// `mac ?? coverage * 0.01 * mutation`, with a coverage tiebreak behind a `||`, and
// every operator in it has a neighbour that still returns a plausible-looking file.
// Each ordering test below sits on a boundary where exactly one of those swaps
// changes WHICH file the pipeline spends an hour of model time on.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { withSandbox, S, rules } = require('./helpers/env');   // FIRST, always
const { installFakes } = require('./helpers/fakes');

/** Put a doc where repoContextHead() goes looking for it. */
function doc(sb, name, body) { fs.writeFileSync(path.join(sb.repoDir, name), body); }

const CANDIDATES = [
  { path: 'src/ui/Button.tsx', coverage: 10, mutation: 10, mac: 1, attempts: 0 },
  { path: 'src/lib/parse.ts', coverage: 90, mutation: 20, mac: 18, attempts: 0 },
];

const NO_DOCS = '(no AGENTS.md / CONTRIBUTING.md / README.md found)';

// ── rules(): read before there is anything to read ─────────────────────────

test('the rule table is empty before a run exists, rather than throwing', () => withSandbox(async () => {
  // The dashboard renders the configured rules before anyone presses start, when
  // state.run is still null. Reaching through it unguarded turns that page into a 500.
  assert.deepEqual(rules.rules(), {});
}));

test('a run record with no config block still reports no rules', () => withSandbox(async () => {
  // state lives in a JSON file that survives restarts, so a record written by an
  // older build — or half-written by a crash — can carry `run` without `config`.
  S.state.run = { id: 'run-legacy', status: 'running' };
  assert.deepEqual(rules.rules(), {});
}));

// ── repoContextHead(): the repo's own docs, as the model sees them ─────────

test('the post-clone prompt quotes all three repo docs, each under its own header',
  () => withSandbox(async (sb) => {
    const w = installFakes(sb);
    await sb.start({ rules: { post_clone: 'follow AGENTS.md' } });
    doc(sb, 'AGENTS.md', 'run tests with pnpm');
    doc(sb, 'CONTRIBUTING.md', 'sign your commits');
    doc(sb, 'README.md', 'a demo app');
    w.llm.replyJson({ constraints: ['run tests with pnpm'], notes: 'from AGENTS.md' });

    const r = await rules.apply('post_clone');

    assert.equal(w.llm.calls[0].prompt,
      'TEAM RULE (post-clone): follow AGENTS.md\n\nREPO DOCS:\n'
      + '--- AGENTS.md (head) ---\nrun tests with pnpm\n\n'
      + '--- CONTRIBUTING.md (head) ---\nsign your commits\n\n'
      + '--- README.md (head) ---\na demo app');
    assert.match(w.llm.calls[0].system, /Reply ONLY with JSON: \{"constraints"/);
    // json:true is what makes chat() parse the answer at all — without it every
    // extracted constraint is dropped and the raw rule text is used instead.
    assert.deepEqual(r, { constraints: ['run tests with pnpm'], notes: 'from AGENTS.md' });
    // a decision call runs with extended thinking OFF; flipping it makes each of the
    // six rule stages wait on a reasoning pass it has no use for
    assert.equal(w.llm.calls[0].decision, true);
  }));

test('a repo with only a README quotes only the README', () => withSandbox(async (sb) => {
  // readFileSafe answers null for a file that is not there. Quoting it anyway sends
  // the model `--- AGENTS.md (head) ---` followed by the word "null".
  const w = installFakes(sb);
  await sb.start({ rules: { post_clone: 'follow the docs' } });
  doc(sb, 'README.md', 'a demo app');
  w.llm.replyJson({ constraints: [], notes: 'nothing to add' });

  await rules.apply('post_clone');

  assert.equal(w.llm.calls[0].prompt,
    'TEAM RULE (post-clone): follow the docs\n\nREPO DOCS:\n--- README.md (head) ---\na demo app');
}));

test('a repo with no docs at all says so in words the model can act on', () => withSandbox(async (sb) => {
  const w = installFakes(sb);
  await sb.start({ rules: { post_clone: 'follow the docs' } });
  w.llm.replyJson({ constraints: [], notes: 'nothing to add' });

  await rules.apply('post_clone');

  assert.equal(w.llm.calls[0].prompt,
    'TEAM RULE (post-clone): follow the docs\n\nREPO DOCS:\n' + NO_DOCS);
}));

test('post_clone with no rule configured is a fixed empty answer', () => withSandbox(async (sb) => {
  const w = installFakes(sb);
  await sb.start();

  assert.deepEqual(await rules.apply('post_clone'),
    { constraints: [], notes: 'no post-clone rules configured' });
  assert.equal(w.llm.calls.length, 0);
}));

test('an unparseable post-clone answer keeps the rule itself as the constraint',
  () => withSandbox(async (sb) => {
    // Dropping the list would silently un-configure the team. The raw rule text is a
    // blunter constraint than an extracted one, but it is still the team's rule.
    const w = installFakes(sb);
    await sb.start({ rules: { post_clone: 'never delete an existing test' } });
    w.llm.reply({ text: 'I am afraid I cannot help with that.' });

    assert.deepEqual(await rules.apply('post_clone'), {
      constraints: ['never delete an existing test'],
      notes: 'LLM parse failed, using raw rule text',
    });
  }));

// ── apply(): the record it leaves behind ───────────────────────────────────

test('the applied-rules event is filed under "rules" and clipped at 240 characters of payload',
  () => withSandbox(async (sb) => {
    // Events are capped at 400 in state and mirrored to disk. A whole constraint list
    // per stage would push the rest of the run out of that window.
    installFakes(sb);
    await sb.start({ rules: { write_test: 'no snapshots' } });
    S.state.decisions.post_clone = { result: { constraints: ['A'.repeat(400)] } };

    await rules.apply('write_test');

    assert.deepEqual(sb.events('rules'),
      ['applied write_test rules: {"constraints":["' + 'A'.repeat(223)]);
  }));

// ── testWritingConstraints(): what the test-writing prompt inherits ────────

test('write_test with nothing learned at clone time is just the team rule',
  () => withSandbox(async (sb) => {
    // There is no post_clone decision here at all, which is the normal state on a
    // repo with no post-clone rule — reaching into it unguarded throws mid-run.
    installFakes(sb);
    await sb.start({ rules: { write_test: 'no snapshots' } });

    assert.deepEqual((await rules.apply('write_test')).constraints, ['no snapshots']);
  }));

test('write_test with no team rule is only what the clone stage found',
  () => withSandbox(async (sb) => {
    installFakes(sb);
    await sb.start();
    S.state.decisions.post_clone = { result: { constraints: ['use the repo test helper'] } };

    assert.deepEqual((await rules.apply('write_test')).constraints, ['use the repo test helper'],
      'a bare undefined in this list reaches the prompt as the word "undefined"');
  }));

test('constraints stored in the pre-result shape are still honoured', () => withSandbox(async (sb) => {
  // apply() has not always wrapped stage output in `.result`. A state.json written by
  // an older build keeps its constraints one level up, and losing them there silently
  // drops everything the team's AGENTS.md said.
  installFakes(sb);
  await sb.start({ rules: { write_test: 'no snapshots' } });
  S.state.decisions.post_clone = { constraints: ['keep tests colocated'] };

  assert.deepEqual((await rules.apply('write_test')).constraints,
    ['keep tests colocated', 'no snapshots']);
}));

test('a state record with no decisions block at all still yields the team rule',
  () => withSandbox(async (sb) => {
    // Same reason as above: `decisions` is a field of a JSON file on disk, and a
    // record from before it existed must not take the write_test stage down.
    installFakes(sb);
    await sb.start({ rules: { write_test: 'no snapshots' } });
    delete S.state.decisions;

    assert.deepEqual(rules.testWritingConstraints(), ['no snapshots']);
  }));

// ── applyPrePick(): the branch name template ───────────────────────────────

test('pre_pick with no rule is the pipeline\'s own branch naming', () => withSandbox(async (sb) => {
  installFakes(sb);
  await sb.start();

  assert.deepEqual(await rules.apply('pre_pick'),
    { branchTemplate: 'tests/improve-{file}', notes: 'default branch naming' });
}));

test('a template with no {file} placeholder is refused — every file would land on one branch',
  () => withSandbox(async (sb) => {
    const w = installFakes(sb);
    await sb.start({ rules: { pre_pick: 'branch off chore/' } });
    w.llm.replyJson({ branchTemplate: 'chore/tests', notes: 'one branch for all of it' });

    assert.deepEqual(await rules.apply('pre_pick'),
      { branchTemplate: 'tests/improve-{file}', notes: 'rule did not yield a usable template' });
    assert.equal(w.llm.calls[0].prompt,
      'TEAM RULE (before picking a file): branch off chore/\n\nREPO DOCS:\n' + NO_DOCS);
    assert.match(w.llm.calls[0].system, /\{file\} will be replaced by a slug/);
    assert.equal(w.llm.calls[0].json, true);
    assert.equal(w.llm.calls[0].decision, true);
  }));

test('an answer with no template at all falls back the same way', () => withSandbox(async (sb) => {
  const w = installFakes(sb);
  await sb.start({ rules: { pre_pick: 'branch off chore/' } });
  w.llm.replyJson({ notes: 'I have no opinion' });

  assert.deepEqual(await rules.apply('pre_pick'),
    { branchTemplate: 'tests/improve-{file}', notes: 'rule did not yield a usable template' });
}));

test('a pre_pick answer that is not JSON at all falls back instead of throwing',
  () => withSandbox(async (sb) => {
    const w = installFakes(sb);
    await sb.start({ rules: { pre_pick: 'branch off chore/' } });
    w.llm.reply({ text: 'branch names are a matter of taste' });

    assert.deepEqual(await rules.apply('pre_pick'),
      { branchTemplate: 'tests/improve-{file}', notes: 'rule did not yield a usable template' });
  }));

test('a usable template is scrubbed to characters git accepts in a branch name',
  () => withSandbox(async (sb) => {
    // `git checkout -B` rejects spaces and most punctuation, so an accepted template
    // that still holds them turns every branch creation in the run into a hard error.
    // Each run of rejected characters collapses to ONE dash — replacing them one by
    // one would give `improve-{file}---v2` where the team asked for `-v2`.
    const w = installFakes(sb);
    await sb.start({ rules: { pre_pick: 'use our naming scheme' } });
    w.llm.replyJson({ branchTemplate: 'Tests / improve {file}!! v2.0_final-x', notes: 'team scheme' });

    assert.deepEqual(await rules.apply('pre_pick'),
      { branchTemplate: 'Tests-/-improve-{file}-v2.0_final-x', notes: 'team scheme' });
  }));

// ── applyPickFile(): the mechanical order ──────────────────────────────────

test('pick_file with no candidates answers no file, without asking anyone',
  () => withSandbox(async (sb) => {
    const w = installFakes(sb);
    await sb.start({ rules: { pick_file: 'library code only' } });

    // no context object at all — the scope walk turned nothing up this iteration
    assert.deepEqual(await rules.apply('pick_file'), { file: null, reason: 'no candidates' });
    assert.deepEqual(await rules.apply('pick_file', { candidates: [] }),
      { file: null, reason: 'no candidates' });
    assert.equal(w.llm.calls.length, 0);
  }));

test('an unmeasured file is scored coverage times mutation, so a shallow one wins',
  () => withSandbox(async (sb) => {
    // 10% covered at 10% mutation scores 1, below the measured MAC of 5 next to it.
    installFakes(sb);
    await sb.start();

    assert.deepEqual(await rules.apply('pick_file', {
      candidates: [
        { path: 'src/measured.ts', coverage: 5, mutation: 60, mac: 5, attempts: 0 },
        { path: 'src/unmeasured.ts', coverage: 10, mutation: 10, attempts: 0 },
      ],
    }), { file: 'src/unmeasured.ts', reason: 'lowest MAC (mechanical pick)' });
  }));

test('a measured file with a genuinely lower MAC beats an unmeasured one',
  () => withSandbox(async (sb) => {
    // The mirror of the case above: 20% covered at 100% mutation scores 20, ABOVE the
    // measured MAC of 5, so the measured file is still the weakest thing here.
    installFakes(sb);
    await sb.start();

    assert.deepEqual(await rules.apply('pick_file', {
      candidates: [
        { path: 'src/measured.ts', coverage: 5, mutation: 90, mac: 5, attempts: 0 },
        { path: 'src/unmeasured.ts', coverage: 20, mutation: 100, attempts: 0 },
      ],
    }), { file: 'src/measured.ts', reason: 'lowest MAC (mechanical pick)' });
  }));

test('the unmeasured file wins from the front of the list too', () => withSandbox(async (sb) => {
  // The same comparison with the candidates the other way round. The sort key is
  // built separately for each side, and one pair only ever exercises one of them.
  installFakes(sb);
  await sb.start();

  assert.deepEqual(await rules.apply('pick_file', {
    candidates: [
      { path: 'src/unmeasured.ts', coverage: 10, mutation: 20, attempts: 0 },
      { path: 'src/measured.ts', coverage: 60, mutation: 90, mac: 6, attempts: 0 },
    ],
  }), { file: 'src/unmeasured.ts', reason: 'lowest MAC (mechanical pick)' });
}));

test('the measured file wins from the back of the list too', () => withSandbox(async (sb) => {
  installFakes(sb);
  await sb.start();

  assert.deepEqual(await rules.apply('pick_file', {
    candidates: [
      { path: 'src/unmeasured.ts', coverage: 50, mutation: 80, attempts: 0 },
      { path: 'src/measured.ts', coverage: 60, mutation: 10, mac: 6, attempts: 0 },
    ],
  }), { file: 'src/measured.ts', reason: 'lowest MAC (mechanical pick)' });
}));

test('files on an equal MAC are ordered by coverage, weakest first', () => withSandbox(async (sb) => {
  // The tiebreak is the whole reason there is a second comparator: three files at
  // MAC 4 are equally weak by the primary key, and the least-covered one is where
  // new tests have the most ground to reach.
  installFakes(sb);
  await sb.start();

  const r = await rules.apply('pick_file', {
    candidates: [
      { path: 'src/high.ts', coverage: 60, mutation: 10, mac: 4, attempts: 0 },
      { path: 'src/low.ts', coverage: 20, mutation: 10, mac: 4, attempts: 0 },
      { path: 'src/mid.ts', coverage: 40, mutation: 10, mac: 4, attempts: 0 },
    ],
  });

  assert.equal(r.file, 'src/low.ts');
}));

test('picking does not reorder the caller\'s candidate list', () => withSandbox(async (sb) => {
  // The loop holds this array across iterations; sorting it in place would re-rank
  // its own queue behind its back every time a file is picked.
  installFakes(sb);
  await sb.start();
  const candidates = [
    { path: 'src/z.ts', coverage: 90, mutation: 90, mac: 81, attempts: 0 },
    { path: 'src/a.ts', coverage: 10, mutation: 10, mac: 1, attempts: 0 },
  ];

  const r = await rules.apply('pick_file', { candidates });

  assert.equal(r.file, 'src/a.ts');
  assert.deepEqual(candidates.map((c) => c.path), ['src/z.ts', 'src/a.ts']);
}));

test('the candidate table is one line per file, capped at 80, unmeasured metrics shown as ?',
  () => withSandbox(async (sb) => {
    // This table is the model's entire view of the repo. Ninety files of it is most of
    // a context window, and a null printed raw reads exactly like a measured zero.
    const w = installFakes(sb);
    await sb.start({ rules: { pick_file: 'library code only' } });
    const candidates = Array.from({ length: 90 }, (_, i) => ({
      path: `src/f${i}.ts`, coverage: 30, mutation: 40, mac: 12, attempts: 2,
    }));
    candidates[0] = { path: 'src/fresh.ts', coverage: null, mutation: null, mac: null, attempts: 0 };
    w.llm.replyJson({ file: 'src/f1.ts', reason: 'weakest assertions' });

    const r = await rules.apply('pick_file', { candidates });

    const [head, table] = w.llm.calls[0].prompt.split('\n\nCANDIDATES (path | metrics):\n');
    assert.equal(head, 'TEAM RULE (how to pick a file): library code only');
    const lines = table.split('\n');
    assert.equal(lines.length, 80, 'the 81st candidate onward never leaves the machine');
    assert.equal(lines[0], 'src/fresh.ts | coverage=?% mutation=?% mac=? attempts=0');
    assert.equal(lines[1], 'src/f1.ts | coverage=30% mutation=40% mac=12 attempts=2');
    assert.equal(lines[79], 'src/f79.ts | coverage=30% mutation=40% mac=12 attempts=2');
    assert.match(w.llm.calls[0].system, /Reply ONLY with JSON: \{"file"/);
    assert.equal(w.llm.calls[0].json, true);
    assert.equal(w.llm.calls[0].decision, true);
    assert.deepEqual(r, { file: 'src/f1.ts', reason: 'weakest assertions' });
  }));

test('a pick answer that is not JSON at all is a failed pick, not a crash',
  () => withSandbox(async (sb) => {
    // There is no object here to read `.file` off. Reaching in unguarded throws inside
    // the loop's pick step and takes the whole batch down over one bad reply.
    const w = installFakes(sb);
    await sb.start({ rules: { pick_file: 'library code only' } });
    w.llm.reply({ text: 'there is no good answer' });

    assert.deepEqual(await rules.apply('pick_file', { candidates: CANDIDATES }), {
      file: null,
      retry: true,
      reason: 'pick rule could not be applied reliably; refusing a mechanical pick that might violate team rules',
    });
  }));

test('the dashboard is told each time a pick is refused, and when it stops trying',
  () => withSandbox(async (sb) => {
    const w = installFakes(sb);
    await sb.start({ rules: { pick_file: 'library code only' } });
    w.llm.replyJson({ nope: 1 });
    w.llm.replyJson({ nope: 2 });
    w.llm.replyJson({ nope: 3 });

    for (let i = 0; i < 3; i++) await rules.apply('pick_file', { candidates: CANDIDATES });

    assert.deepEqual(sb.events('picking_file'), [
      'pick rule could not be applied (invalid LLM output, 1/3) — retrying with a fresh pick',
      'pick rule could not be applied (invalid LLM output, 2/3) — retrying with a fresh pick',
      'pick rule could not be applied (invalid LLM output, 3/3) — giving up on this batch',
    ]);
  }));

test('a rule that excludes every candidate clears the failure counter and names the reason',
  () => withSandbox(async (sb) => {
    const w = installFakes(sb);
    await sb.start({ rules: { pick_file: 'only touch src/payments' } });
    w.llm.replyJson({ nope: 1 });
    w.llm.replyJson({ file: null });

    await rules.apply('pick_file', { candidates: CANDIDATES });
    assert.equal(S.state.pickFailures, 1);
    const r = await rules.apply('pick_file', { candidates: CANDIDATES });

    assert.deepEqual(r, { file: null, retry: false, reason: 'all candidates excluded by rule' });
    assert.equal(S.state.pickFailures, 0, 'a terminal answer is not a failure to count');
  }));

test('a pick that came with no reason still carries one', () => withSandbox(async (sb) => {
  // The reason is what the dashboard and the PR body show for why this file was
  // chosen; an undefined there is printed to the user as the word "undefined".
  const w = installFakes(sb);
  await sb.start({ rules: { pick_file: 'library code only' } });
  w.llm.replyJson({ file: 'src/lib/parse.ts' });

  assert.deepEqual(await rules.apply('pick_file', { candidates: CANDIDATES }),
    { file: 'src/lib/parse.ts', reason: 'LLM pick' });
}));

// ── applyCheckChanges(): the gate ──────────────────────────────────────────

test('check_changes with no rule approves on the measurement alone, and says which numbers',
  () => withSandbox(async (sb) => {
    const w = installFakes(sb);
    await sb.start();

    assert.deepEqual(
      await rules.apply('check_changes', { testsGreen: true, macBefore: 12.5, macAfter: 40 }),
      {
        approved: true,
        reason: 'MAC 12.5 → 40, suite green',
        mechanical: { testsGreen: true, macImproved: true },
      });
    assert.equal(w.llm.calls.length, 0);
  }));

test('the review prompt carries the file, the metrics and at most 12000 characters of diff',
  () => withSandbox(async (sb) => {
    // A round of generated tests runs to tens of thousands of characters; sending all
    // of it costs the review its context window on exactly the big files that need it.
    const w = installFakes(sb);
    await sb.start({ rules: { check_changes: 'no snapshot tests' } });
    w.llm.replyJson({ approved: true, reason: 'no snapshots in the diff' });

    await rules.apply('check_changes', {
      testsGreen: true, file: 'src/lib/parse.ts',
      macBefore: 7.4, macAfter: 68, coverageBefore: 61, coverageAfter: 92,
      mutationBefore: 12, mutationAfter: 74,
      diff: '+' + 'x'.repeat(13000),
    });

    assert.equal(w.llm.calls[0].prompt,
      'TEAM RULE (how to check changes are good): no snapshot tests\n\n'
      + 'FILE: src/lib/parse.ts\n'
      + 'MAC: 7.4 → 68 (coverage 61 → 92, mutation 12 → 74)\n\n'
      + 'DIFF OF CHANGES:\n+' + 'x'.repeat(11999));
    assert.match(w.llm.calls[0].system, /Judge ONLY the team rule/);
    assert.equal(w.llm.calls[0].json, true);
    assert.equal(w.llm.calls[0].decision, true);
  }));

test('a review with no diff to show sends an empty one, not the word undefined',
  () => withSandbox(async (sb) => {
    const w = installFakes(sb);
    await sb.start({ rules: { check_changes: 'no snapshot tests' } });
    w.llm.replyJson({ approved: true, reason: 'fine' });

    await rules.apply('check_changes', { testsGreen: true, macBefore: 1, macAfter: 2 });

    const { prompt } = w.llm.calls[0];
    assert.equal(prompt.slice(prompt.indexOf('DIFF OF CHANGES:')), 'DIFF OF CHANGES:\n');
  }));

test('an unparseable verdict keeps the verified mechanical result', () => withSandbox(async (sb) => {
  // The suite really is green and MAC really did rise; throwing that away because the
  // model stuttered would discard work that has already been measured.
  const w = installFakes(sb);
  await sb.start({ rules: { check_changes: 'no snapshot tests' } });
  w.llm.reply({ text: 'looks fine to me' });

  assert.deepEqual(
    await rules.apply('check_changes', { testsGreen: true, macBefore: 1, macAfter: 2 }),
    {
      approved: true,
      reason: 'LLM verdict unparseable — mechanical checks passed',
      mechanical: { testsGreen: true, macImproved: true },
    });
}));

// ── applyMakePr(): the pull request ────────────────────────────────────────

test('with no PR rule the pull request is the metrics table itself', () => withSandbox(async (sb) => {
  // This body is the only report a reviewer gets. Every row of it is a literal, and
  // the blank spacers are swept up by the same filter(Boolean) that drops an absent
  // cost line — so the whole thing is one exact string, or it is wrong.
  installFakes(sb);
  await sb.start();

  assert.deepEqual(await rules.apply('make_pr', {
    file: 'src/lib/parse.ts',
    coverageBefore: 61.5, coverageAfter: 92, mutationBefore: 12, mutationAfter: 74,
    macBefore: 7.38, macAfter: 68.08,
  }), {
    title: 'test: improve mutation-adjusted coverage of src/lib/parse.ts',
    body: [
      '## Test improvements for `src/lib/parse.ts`',
      '| metric | before | after |',
      '|---|---|---|',
      '| line coverage | 61.5% | 92% |',
      '| mutation score | 12% | 74% |',
      '| **MAC** | **7.38** | **68.08** |',
      'Generated by the improve-javascript-tests pipeline.',
    ].join('\n'),
    labels: [],
  });
}));

test('a PR that cost tokens says so, just above the signature', () => withSandbox(async (sb) => {
  // The spend line is how a team sees what an automated PR cost them. It is the one
  // conditional row, and it disappears in silence if the ternary flips.
  installFakes(sb);
  await sb.start();

  const r = await rules.apply('make_pr', {
    file: 'src/a.ts',
    coverageBefore: 0, coverageAfter: 50, mutationBefore: 0, mutationAfter: 20,
    macBefore: 0, macAfter: 10,
    tokens: { in: 12000, out: 3400, calls: 7 },
  });

  const lines = r.body.split('\n');
  assert.equal(lines[lines.length - 2], 'Cost: 12000 input / 3400 output tokens over 7 model call(s).');
  assert.equal(lines[lines.length - 1], 'Generated by the improve-javascript-tests pipeline.');
}));

test('the PR prompt names the branch, the metrics and the test files that changed',
  () => withSandbox(async (sb) => {
    const w = installFakes(sb);
    await sb.start({ rules: { make_pr: 'title must start with [tests]' } });
    w.llm.replyJson({ title: '[tests] parse', body: '# body', labels: ['tests', 'automated'] });

    const r = await rules.apply('make_pr', {
      file: 'src/lib/parse.ts', branch: 'tests/improve-src-lib-parse',
      coverageBefore: 61, coverageAfter: 92, mutationBefore: 12, mutationAfter: 74,
      macBefore: 7, macAfter: 68,
      changedFiles: ['test/parse.test.ts', 'test/parse.edge.test.ts'],
    });

    assert.equal(w.llm.calls[0].prompt,
      'TEAM RULE (how to make a PR): title must start with [tests]\n\n'
      + 'REPO DOCS:\n' + NO_DOCS + '\n\n'
      + 'FILE: src/lib/parse.ts\n'
      + 'BRANCH: tests/improve-src-lib-parse\n'
      + 'METRICS: coverage 61%→92%, mutation 12%→74%, MAC 7→68\n'
      + 'CHANGED TEST FILES: test/parse.test.ts, test/parse.edge.test.ts');
    assert.match(w.llm.calls[0].system, /Include the before\/after metrics table/);
    assert.equal(w.llm.calls[0].json, true);
    assert.equal(w.llm.calls[0].decision, true);
    // a usable answer is passed through untouched, labels and all
    assert.deepEqual(r, { title: '[tests] parse', body: '# body', labels: ['tests', 'automated'] });
  }));

test('a PR prompt with no changed-file list is still a prompt', () => withSandbox(async (sb) => {
  const w = installFakes(sb);
  await sb.start({ rules: { make_pr: 'be brief' } });
  w.llm.replyJson({ title: 't', body: 'b' });

  await rules.apply('make_pr', { file: 'src/a.ts' });

  const { prompt } = w.llm.calls[0];
  assert.equal(prompt.slice(prompt.indexOf('CHANGED TEST FILES:')), 'CHANGED TEST FILES: ');
}));

test('an answer with a body but no title is discarded whole', () => withSandbox(async (sb) => {
  // Half an answer is not an answer: a PR carrying the model's body and the
  // pipeline's title reads as if the team rule was followed when half of it was.
  const w = installFakes(sb);
  await sb.start({ rules: { make_pr: 'be brief' } });
  w.llm.replyJson({ body: '# just a body', labels: ['tests'] });

  const r = await rules.apply('make_pr', { file: 'src/a.ts' });

  assert.equal(r.title, 'test: improve mutation-adjusted coverage of src/a.ts');
  assert.equal(r.body.split('\n')[0], '## Test improvements for `src/a.ts`');
  assert.deepEqual(r.labels, []);
}));

test('a PR answer that is not JSON at all falls back to the default PR', () => withSandbox(async (sb) => {
  // By this point the tests are written, green and committed. Throwing here loses the
  // pull request for work that is already done.
  const w = installFakes(sb);
  await sb.start({ rules: { make_pr: 'be brief' } });
  w.llm.reply({ text: 'PRs are hard' });

  const r = await rules.apply('make_pr', { file: 'src/a.ts' });

  assert.equal(r.title, 'test: improve mutation-adjusted coverage of src/a.ts');
}));
