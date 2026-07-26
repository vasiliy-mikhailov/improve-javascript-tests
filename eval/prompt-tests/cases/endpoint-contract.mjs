// The assumptions the client is built on. If the deployment changes, these go red
// here rather than mid-run.
export const cases = [
  {
    name: 'chat_template_kwargs.enable_thinking is honoured',
    samples: 2,
    async run(ask) {
      const on = await ask({ prompt: 'Reply {"ok":true}. JSON only.', thinking: true, maxTokens: 800 });
      const off = await ask({ prompt: 'Reply {"ok":true}. JSON only.', thinking: false, maxTokens: 800 });
      const ok = on.reasoning.length > 0 && off.reasoning.length === 0;
      return { ok, secs: on.secs + off.secs, note: `reasoning on=${on.reasoning.length}ch off=${off.reasoning.length}ch` };
    },
  },
  {
    name: 'json_object composes with thinking (the client sends both)',
    samples: 2,
    async run(ask) {
      const r = await ask({ prompt: 'Reply {"ok":true}. JSON only.', thinking: true, json: true, maxTokens: 2000 });
      let parsed = null; try { parsed = JSON.parse(r.content); } catch { }
      return { ok: r.status === 200 && parsed !== null, secs: r.secs,
        note: `status=${r.status} finish=${r.finishReason} content=${r.content.length}ch` };
    },
  },
];
