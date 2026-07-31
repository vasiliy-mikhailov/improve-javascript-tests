'use strict';
// Prompt + code + test + outcome + human feedback, stored in the TARGET repo's root.
//
// This is the corpus a prompt optimiser (GEPA) reflects on. Reflection needs the whole
// triple: the exact prompt that was sent, what came back, how well it scored, and what
// a human thought of it. A verdict on its own — "too many mocks in these tests" — cannot
// improve anything, because nothing ties it to the instructions that produced the mocks.
//
// It lives in the repo it describes (improve-tests.json at the root), not in our data
// dir, for three reasons: it is versioned with the code it judges, it is reviewable in a
// pull request, and it survives a fresh clone — which is exactly when a run would
// otherwise repeat a mistake the team has already objected to once.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { repoDir } = require('./repo');

const FILE = 'improve-tests.json';
// Enough examples to evolve a prompt against, few enough that a human can still open
// the file. Judged records are exempt: a human verdict is the scarce input here.
const MAX_UNJUDGED = 200;
// Prompts and tests are the payload, but a repo file should stay readable.
const CAP = { prompt: 20000, source: 20000, test: 20000 };

const filePath = () => path.join(repoDir(), FILE);
const clip = (s, n) => (typeof s === 'string' ? (s.length > n ? s.slice(0, n) + `\n… [${s.length - n} more chars]` : s) : '');

/** Never throw at a caller mid-run: a hand-edited file is a normal thing to find. */
function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath(), 'utf8'));
    if (!raw || !Array.isArray(raw.records)) return { version: 1, records: [] };
    return { version: raw.version || 1, ...raw };
  } catch { return { version: 1, records: [] }; }
}

function save(doc) {
  const judged = doc.records.filter((r) => r.feedback && r.feedback.length);
  const rest = doc.records.filter((r) => !(r.feedback && r.feedback.length)).slice(-MAX_UNJUDGED);
  const out = { ...doc, version: 1, updated: new Date(doc.updatedAtMs || Date.now()).toISOString(), records: [...judged, ...rest] };
  delete out.updatedAtMs;
  fs.mkdirSync(path.dirname(filePath()), { recursive: true });
  fs.writeFileSync(filePath(), JSON.stringify(out, null, 2) + '\n');
  return out;
}

/** Mock-heaviness, measured — so "too many mocks" can be scored rather than argued. */
function signalsFor(test) {
  const t = String(test || '');
  const count = (re) => (t.match(re) || []).length;
  const mockAssertions = count(/toHaveBeenCalled|toHaveBeenCalledWith|toHaveBeenCalledTimes|toHaveReturned/g);
  return {
    lines: t.split('\n').length,
    cases: count(/\b(it|test)\s*\(\s*['"`]/g),
    mockSetup: count(/\b(vi|jest)\.(mock|fn|spyOn)\s*\(|mockReturnValue|mockResolvedValue|mockImplementation/g),
    mockAssertions,
    realAssertions: Math.max(0, count(/\bexpect\s*\(/g) - mockAssertions),
  };
}

/**
 * Record one generation. Returns the id feedback attaches to.
 * @param {{file, testPath, generator, prompt:{system,user,model,thinking}, source, test, outcome}} g
 */
function recordGeneration(g) {
  const doc = load();
  const id = 'gen_' + crypto.createHash('sha1')
    .update(`${g.file}|${g.testPath}|${Date.now()}|${doc.records.length}`).digest('hex').slice(0, 12);
  doc.records.push({
    id,
    ts: Date.now(),
    file: g.file,
    testPath: g.testPath,
    generator: g.generator || null,
    prompt: {
      system: clip(g.prompt?.system, CAP.prompt),
      user: clip(g.prompt?.user, CAP.prompt),
      model: g.prompt?.model || null,
      thinking: g.prompt?.thinking ?? null,
    },
    source: clip(g.source, CAP.source),
    test: clip(g.test, CAP.test),
    outcome: g.outcome || {},
    signals: signalsFor(g.test),
    feedback: [],
  });
  save(doc);
  return id;
}

/**
 * Attach a human judgement. Address it by id, or by testPath/file — which is what a
 * person reading a diff actually has in front of them.
 * @returns {number} how many records it landed on
 */
function addFeedback({ id, testPath, file, text, author = null, labels = [] }) {
  if (!text || !String(text).trim()) throw new Error('feedback needs text — that is the whole content of it');
  const doc = load();
  const match = (r) => (id ? r.id === id : (testPath ? r.testPath === testPath : (file ? r.file === file : false)));
  const hits = doc.records.filter(match);
  for (const r of hits) {
    r.feedback = r.feedback || [];
    r.feedback.push({ ts: Date.now(), author, text: String(text).slice(0, 4000), labels });
  }
  if (hits.length) save(doc);
  return hits.length;
}

/**
 * The team rules for this repo: what improve-tests.json says, falling back per stage to
 * the container defaults from .env. Rules ARE prompts, so their home is the repo they
 * describe — otherwise the tests a repo gets depend on whose container ran, and nobody
 * reading the repo can see what was asked for.
 */
function rulesFor(defaults = {}) {
  const own = load().rules || {};
  const out = { ...defaults };
  for (const [stage, text] of Object.entries(own)) {
    if (typeof text === 'string' && text.trim()) out[stage] = text;
  }
  return out;
}

/** Everything a human has judged, newest first — the corpus worth reflecting on. */
function judged() {
  return load().records.filter((r) => r.feedback && r.feedback.length).sort((a, b) => b.ts - a.ts);
}

module.exports = { load, save, recordGeneration, addFeedback, judged, rulesFor, signalsFor, filePath, FILE, MAX_UNJUDGED };
