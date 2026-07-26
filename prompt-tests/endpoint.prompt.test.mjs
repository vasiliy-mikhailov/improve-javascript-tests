// PROMPT TESTS — ordinary node:test tests that call the REAL model.
//
// Unit-sized: one prompt, one criterion, one assertion. Not unit tests in character:
// non-hermetic, seconds to minutes, probabilistic. Hence a separate command
// (`npm run test:prompts`) and a skip when the endpoint is not configured.
//
// These pin the assumptions sidecar/llm.js is built on. When the deployment changes,
// they go red here instead of mid-run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ask, skipUnlessLive } from './helpers/ask.mjs';

test('chat_template_kwargs.enable_thinking is honoured by this deployment',
  { skip: skipUnlessLive, timeout: 300000 }, async () => {
    const on = await ask({ prompt: 'Reply {"ok":true}. JSON only.', thinking: true, maxTokens: 2000 });
    const off = await ask({ prompt: 'Reply {"ok":true}. JSON only.', thinking: false, maxTokens: 2000 });
    console.log(`      reasoning: on=${on.reasoning.length}ch (${on.secs.toFixed(0)}s), off=${off.reasoning.length}ch (${off.secs.toFixed(0)}s)`);
    assert.ok(on.reasoning.length > 0, 'thinking:true must produce a reasoning channel');
    assert.equal(off.reasoning.length, 0, 'thinking:false must suppress it — llm.js relies on this to skip the headroom');
  });

test('json_object composes with thinking — the client sends both on a generation call',
  { skip: skipUnlessLive, timeout: 300000 }, async () => {
    const r = await ask({ prompt: 'Reply {"ok":true}. JSON only.', thinking: true, json: true, maxTokens: 3000 });
    console.log(`      status=${r.status} finish=${r.finishReason} content=${r.content.length}ch reasoning=${r.reasoning.length}ch`);
    assert.equal(r.status, 200);
    assert.doesNotThrow(() => JSON.parse(r.content), 'an earlier comment claimed these were exclusive; they are not');
  });

test('a reasoning phase can exhaust the budget and return NO content at all',
  { skip: skipUnlessLive, timeout: 600000 }, async () => {
    // The failure that broke two rounds of a live run, reproduced on demand: give the
    // model a real task and too small a budget, and `content` comes back empty with
    // the answer stranded in `reasoning`. llm.js exists in its current shape because
    // of this, so it is worth a test that would notice if the behaviour changed.
    const r = await ask({
      system: 'You are a test engineer. Reply ONLY with JSON: {"tests":[{"path":"a.test.ts","content":"..."}]}.',
      prompt: 'Write a thorough vitest suite for a function that prices an order with tiered discounts, '
        + 'coupons, express shipping and a cap. Cover every branch and boundary.',
      thinking: true, json: true, maxTokens: 600,
    });
    console.log(`      finish=${r.finishReason} content=${r.content.length}ch reasoning=${r.reasoning.length}ch`);
    assert.equal(r.finishReason, 'length');
    assert.equal(r.content.length, 0, 'this is the shape llm.js salvages from and retries');
    assert.ok(r.reasoning.length > 0);
  });
