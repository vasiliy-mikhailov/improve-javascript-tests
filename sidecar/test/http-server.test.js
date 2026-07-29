'use strict';
// UNIT TESTS for the HTTP layer itself — the part every other test skips.
//
// Every other sidecar test calls the route table directly, which is fast and right for
// route behaviour, and it means the createServer handler has no coverage at all. That
// handler is where the /dashboard prefix is resolved, and it was resolved in the wrong
// order: the route table was consulted with the raw pathname, so /dashboard/api/metrics
// matched nothing, missed the `/api/` 404 branch, fell through to the static server and
// 404'd. Caddy hid it in the deployed shape by stripping the prefix first
// (`handle_path /dashboard/*`); with docker-compose.standalone.yml there is no proxy,
// so the dashboard was dead at the exact URL the README hands a new user — banner stuck
// on "offline — sidecar unreachable" while the run behind it was fine.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, sidecar } = require('./helpers/env');
const { server } = sidecar;

/** Start the real server on an ephemeral port for the duration of one test. */
async function withServer(fn) {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { return await fn(base); } finally { await new Promise((r) => server.close(r)); }
}

const get = async (base, p) => {
  const res = await fetch(base + p);
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch { }
  return { status: res.status, body, text };
};

test('an api call under the /dashboard prefix reaches the same route as without it',
  () => withSandbox(async (sb) => {
    await sb.start();
    await withServer(async (base) => {
      const direct = await get(base, '/api/metrics');
      // this is what the browser actually requests: the dashboard's app.js fetches
      // relative urls, so a page served at /dashboard/ asks for /dashboard/api/metrics
      const prefixed = await get(base, '/dashboard/api/metrics');
      assert.equal(direct.status, 200);
      assert.equal(prefixed.status, 200, 'the dashboard cannot reach its own API');
      assert.deepEqual(Object.keys(prefixed.body).sort(), Object.keys(direct.body).sort());
    });
  }));

test('an unknown endpoint under the prefix is a json 404, not a static-file miss',
  () => withSandbox(async (sb) => {
    await sb.start();
    await withServer(async (base) => {
      const r = await get(base, '/dashboard/api/nope');
      assert.equal(r.status, 404);
      assert.match(r.body?.error || '', /no such endpoint/);
    });
  }));

test('the dashboard page itself is served at both / and /dashboard/',
  () => withSandbox(async (sb) => {
    await sb.start();
    await withServer(async (base) => {
      for (const p of ['/', '/dashboard/']) {
        const r = await get(base, p);
        assert.equal(r.status, 200, `${p} did not serve the dashboard`);
        assert.match(r.text, /<html|<!doctype/i);
      }
    });
  }));

test('a POST route works through the real server, body and all', () => withSandbox(async (sb) => {
  await sb.start();
  await withServer(async (base) => {
    const res = await fetch(base + '/api/rules/apply', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stage: 'post_clone', context: {} }),
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
  });
}));
