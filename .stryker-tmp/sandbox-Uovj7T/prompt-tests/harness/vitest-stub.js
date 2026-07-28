// @ts-nocheck
// Minimal stand-in for the vitest API, enough to execute a generated test file and
// decide pass/fail exactly. Any matcher it lacks is reported rather than swallowed.
const state = { failures: [], ran: 0 };
export function describe(_name, fn) { fn(); }
export function it(name, fn) {
  state.ran += 1;
  try { const r = fn(); if (r && typeof r.then === 'function') throw new Error('async test unsupported in this harness'); }
  catch (e) { state.failures.push(`${name}: ${e.message}`); }
}
export const test = it;
export function expect(actual) {
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const api = {
    toBe: (e) => { if (!Object.is(actual, e)) throw new Error(`expected ${JSON.stringify(e)}, got ${JSON.stringify(actual)}`); },
    toEqual: (e) => { if (!eq(actual, e)) throw new Error(`expected ${JSON.stringify(e)}, got ${JSON.stringify(actual)}`); },
    toStrictEqual: (e) => api.toEqual(e),
    toBeCloseTo: (e, p = 2) => { if (Math.abs(actual - e) > Math.pow(10, -p) / 2) throw new Error(`expected ~${e}, got ${actual}`); },
    toBeDefined: () => { if (actual === undefined) throw new Error('expected defined'); },
    toBeUndefined: () => { if (actual !== undefined) throw new Error('expected undefined'); },
    toBeNull: () => { if (actual !== null) throw new Error('expected null'); },
    toBeTruthy: () => { if (!actual) throw new Error('expected truthy'); },
    toBeFalsy: () => { if (actual) throw new Error('expected falsy'); },
    toBeGreaterThan: (e) => { if (!(actual > e)) throw new Error(`expected > ${e}, got ${actual}`); },
    toBeLessThan: (e) => { if (!(actual < e)) throw new Error(`expected < ${e}, got ${actual}`); },
    toThrow: () => { let threw = false; try { actual(); } catch { threw = true; } if (!threw) throw new Error('expected throw'); },
    get not() {
      return new Proxy({}, { get: (_t, k) => (...args) => {
        let failed = false;
        try { api[k](...args); } catch { failed = true; }
        if (!failed) throw new Error(`expected NOT ${String(k)}`);
      } });
    },
  };
  return new Proxy(api, {
    get: (t, k) => (k in t ? t[k] : () => { throw new Error(`UNSUPPORTED_MATCHER:${String(k)}`); }),
  });
}
export function report() { return state; }
