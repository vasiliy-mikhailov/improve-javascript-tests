// A node's identity is its NAME. Deriving the id from the name instead of calling
// randomUUID() makes regeneration idempotent: an unchanged workflow regenerates
// byte-for-byte, so `npm run workflow` followed by `git status` is a real drift
// detector, and re-importing hands n8n the same identity for the same node.
//
// FNV-1a over four salted passes gives 128 bits without a crypto import, which the
// generator does not need and n8n never sees — the id only has to be stable, unique
// per name and uuid-shaped.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function nodeId(name) {
  const hex = [0, 1, 2, 3].map((salt) => fnv1a(`ijst:${salt}:${name}`).toString(16).padStart(8, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
}
