#!/usr/bin/env node
/**
 * V8 Proxy performance
 *
 * Myth: "Proxy is slow, avoid it"
 * Reality: how slow exactly? And for which traps?
 *
 * Tests:
 * 1. Property read: direct vs Proxy get trap
 * 2. Property write: direct vs Proxy set trap
 * 3. Function call: direct vs Proxy apply trap
 * 4. Empty proxy (no traps) — does the indirection alone cost?
 * 5. Nested proxy (proxy of proxy)
 * 6. has trap (in operator)
 * 7. Proxy vs getter
 */

const N = 5_000_000;

function bench(label, fn) {
  for (let i = 0; i < 1000; i++) fn();
  const start = performance.now();
  let result = 0;
  for (let i = 0; i < N; i++) result += fn();
  const ms = performance.now() - start;
  const opsPerSec = (N / (ms / 1000)).toExponential(2);
  console.log(`  ${label.padEnd(55)} ${ms.toFixed(0).padStart(6)}ms  (${opsPerSec} ops/sec)`);
  return result;
}

console.log(`\n=== V8 Proxy performance (N=${N.toLocaleString()}) ===\n`);

// --- Test 1: property read ---
console.log('--- Test 1: property read ---');

const obj = { a: 1, b: 2, c: 3 };

const emptyProxy = new Proxy(obj, {});

const getProxy = new Proxy(obj, {
  get(target, prop) {
    return target[prop];
  }
});

const getProxyComputed = new Proxy(obj, {
  get(target, prop) {
    return target[prop] * 2;
  }
});

bench('direct obj.a', () => obj.a);
bench('empty Proxy (no traps) .a', () => emptyProxy.a);
bench('Proxy with get trap .a', () => getProxy.a);
bench('Proxy with get trap (computed)', () => getProxyComputed.a);

// --- Test 2: property write ---
console.log('\n--- Test 2: property write ---');

const writeObj = { x: 0 };
const writeProxy = new Proxy(writeObj, {
  set(target, prop, value) {
    target[prop] = value;
    return true;
  }
});
const emptyWriteProxy = new Proxy({ x: 0 }, {});

bench('direct obj.x = i', () => { writeObj.x = 1; return writeObj.x; });
bench('empty Proxy .x = i', () => { emptyWriteProxy.x = 1; return emptyWriteProxy.x; });
bench('Proxy with set trap .x = i', () => { writeProxy.x = 1; return writeProxy.x; });

// --- Test 3: function call ---
console.log('\n--- Test 3: function call ---');

function add(a, b) { return a + b; }

const applyProxy = new Proxy(add, {
  apply(target, thisArg, args) {
    return target.apply(thisArg, args);
  }
});

const emptyFnProxy = new Proxy(add, {});

bench('direct call add(1, 2)', () => add(1, 2));
bench('empty Proxy call', () => emptyFnProxy(1, 2));
bench('Proxy with apply trap', () => applyProxy(1, 2));

// --- Test 4: has trap (in operator) ---
console.log('\n--- Test 4: has trap (in operator) ---');

const hasProxy = new Proxy(obj, {
  has(target, prop) {
    return prop in target;
  }
});

bench('direct "a" in obj', () => ('a' in obj) ? 1 : 0);
bench('empty Proxy "a" in proxy', () => ('a' in emptyProxy) ? 1 : 0);
bench('Proxy with has trap', () => ('a' in hasProxy) ? 1 : 0);

// --- Test 5: nested proxy ---
console.log('\n--- Test 5: nested proxy (proxy of proxy) ---');

const proxy1 = new Proxy(obj, {
  get(t, p) { return t[p]; }
});
const proxy2 = new Proxy(proxy1, {
  get(t, p) { return t[p]; }
});
const proxy3 = new Proxy(proxy2, {
  get(t, p) { return t[p]; }
});

bench('1 level proxy .a', () => proxy1.a);
bench('2 level proxy .a', () => proxy2.a);
bench('3 level proxy .a', () => proxy3.a);

// --- Test 6: Proxy vs getter ---
console.log('\n--- Test 6: Proxy vs getter ---');

const withGetter = {
  _a: 1,
  get a() { return this._a; }
};

const withGetterProxy = new Proxy({ a: 1 }, {
  get(target, prop) { return target[prop]; }
});

bench('getter: obj.a', () => withGetter.a);
bench('Proxy get trap: proxy.a', () => withGetterProxy.a);
bench('direct: obj.a', () => obj.a);

// --- Test 7: Reflect vs direct in trap ---
console.log('\n--- Test 7: Reflect.get vs direct access in trap ---');

const reflectProxy = new Proxy(obj, {
  get(target, prop, receiver) {
    return Reflect.get(target, prop, receiver);
  }
});

const directProxy = new Proxy(obj, {
  get(target, prop) {
    return target[prop];
  }
});

bench('Proxy + Reflect.get', () => reflectProxy.a);
bench('Proxy + target[prop]', () => directProxy.a);
