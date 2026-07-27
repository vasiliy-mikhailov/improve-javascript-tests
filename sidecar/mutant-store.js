'use strict';
// The mutant queue: every survivor of every file, on disk, with the name of the test
// that would kill it and what has happened to it.
//
// It exists because the survivor list used to live inside state.json capped at 100
// entries. On a file with a thousand mutants that discarded nine hundred of them at
// every measurement, and nothing durable remembered which sites had already been tried
// — so a restart re-derived the same work and a large file could never be finished.
//
// Work is taken from here a group at a time. That is not only a memory concern: it is
// what keeps a thousand mutants from ever reaching a prompt at once, and what makes the
// "is there already a test with this name?" filter answerable before any tokens are
// spent.
//
// One JSON Lines file per source file. No database, because the sidecar ships with no
// dependencies and this is a queue with two writers and one reader.
const fs = require('node:fs');
const path = require('node:path');
const { state, DATA_DIR } = require('./state');
const { slugify, fileSlug } = require('./util');
const { mutantKey, testNameFor, groupByTestName } = require('./mutants');

const cache = new Map();

function queuePath(file) {
  const repo = slugify(state.run?.config?.repoUrl || 'no-repo');
  return path.join(DATA_DIR, 'mutants', repo, fileSlug(file) + '.jsonl');
}

function load(file) {
  const p = queuePath(file);
  if (cache.has(p)) return cache.get(p);
  const rows = [];
  try {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      if (line.trim()) rows.push(JSON.parse(line));
    }
  } catch { /* no queue yet */ }
  cache.set(p, rows);
  return rows;
}

function flush(file) {
  const p = queuePath(file);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, (cache.get(p) || []).map((r) => JSON.stringify(r)).join('\n') + '\n');
}

/**
 * Take a fresh survivor list from a mutation run. What is gone has been killed; what
 * remains keeps whatever we already know about it — above all whether a test has been
 * written for its site, because that is what stops the loop retrying it for ever.
 */
function replace(file, survivors) {
  const known = new Map(load(file).map((r) => [r.key, r]));
  const rows = survivors.map((m) => {
    const key = mutantKey(m);
    const prev = known.get(key);
    return {
      key,
      name: testNameFor(m),
      mutator: m.mutator, line: m.line, column: m.column ?? 0,
      replacement: m.replacement, status: m.status,
      written: prev?.written || false,
    };
  });
  cache.set(queuePath(file), rows);
  flush(file);
  return rows.length;
}

const all = (file) => load(file);
const alive = (file) => load(file);
const pending = (file) => load(file).filter((r) => !r.written);

/** The next N sites worth writing a test for, busiest first, never one already written. */
function nextGroups(file, n = 12) {
  return groupByTestName(pending(file)).slice(0, n);
}

/** These sites now have a test, whatever it turns out to be worth. */
function markWritten(file, names) {
  const set = new Set(names);
  const rows = load(file);
  for (const r of rows) if (set.has(r.name)) r.written = true;
  flush(file);
}

/** What the single mutation run proved dead leaves the queue entirely. */
function recordOutcome(file, { killed = [] } = {}) {
  const dead = new Set(killed.map((m) => mutantKey(m)));
  const p = queuePath(file);
  cache.set(p, load(file).filter((r) => !dead.has(r.key)));
  flush(file);
}

/** Drop the in-memory copy — the next read comes from disk. */
function forget() { cache.clear(); }

module.exports = { replace, all, alive, pending, nextGroups, markWritten, recordOutcome, forget, queuePath };
