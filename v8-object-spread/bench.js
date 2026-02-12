#!/usr/bin/env node
/**
 * V8 object spread: {…obj} vs Object.assign vs manual copy
 *
 * Myth: "spread is expensive, use Object.assign"
 * Reality: let's measure.
 *
 * Tests:
 * 1. Shallow copy: spread vs Object.assign vs manual
 * 2. Merge two objects
 * 3. Add/override properties
 * 4. Scaling with object size
 * 5. Nested spread (not deep copy)
 */

const N = 2_000_000;

function bench(label, fn) {
  for (let i = 0; i < 500; i++) fn();
  const start = performance.now();
  let result = 0;
  for (let i = 0; i < N; i++) result += fn();
  const ms = performance.now() - start;
  const opsPerSec = (N / (ms / 1000)).toExponential(2);
  console.log(`  ${label.padEnd(55)} ${ms.toFixed(0).padStart(6)}ms  (${opsPerSec} ops/sec)`);
  return result;
}

console.log(`\n=== V8 object spread (N=${N.toLocaleString()}) ===\n`);

// --- Test 1: shallow copy (5 props) ---
console.log('--- Test 1: shallow copy (5 properties) ---');

const small = { a: 1, b: 2, c: 3, d: 4, e: 5 };

bench('{...obj} spread', () => {
  const copy = { ...small };
  return copy.a;
});

bench('Object.assign({}, obj)', () => {
  const copy = Object.assign({}, small);
  return copy.a;
});

bench('manual property copy', () => {
  const copy = { a: small.a, b: small.b, c: small.c, d: small.d, e: small.e };
  return copy.a;
});

bench('JSON parse/stringify (deep)', () => {
  const copy = JSON.parse(JSON.stringify(small));
  return copy.a;
});

// --- Test 2: merge two objects ---
console.log('\n--- Test 2: merge two objects ---');

const base = { a: 1, b: 2, c: 3 };
const extra = { d: 4, e: 5 };

bench('{...base, ...extra}', () => {
  const merged = { ...base, ...extra };
  return merged.a + merged.d;
});

bench('Object.assign({}, base, extra)', () => {
  const merged = Object.assign({}, base, extra);
  return merged.a + merged.d;
});

bench('Object.assign(spread, extra)', () => {
  const merged = Object.assign({ ...base }, extra);
  return merged.a + merged.d;
});

// --- Test 3: add/override properties ---
console.log('\n--- Test 3: override one property ---');

bench('{...obj, b: 10} spread override', () => {
  const updated = { ...small, b: 10 };
  return updated.b;
});

bench('Object.assign({}, obj, {b: 10})', () => {
  const updated = Object.assign({}, small, { b: 10 });
  return updated.b;
});

bench('manual copy + override', () => {
  const updated = { a: small.a, b: 10, c: small.c, d: small.d, e: small.e };
  return updated.b;
});

// --- Test 4: scaling ---
console.log('\n--- Test 4: scaling with object size ---');

const medium = {};
for (let i = 0; i < 20; i++) medium[`k${i}`] = i;

bench('{...obj} spread (20 props)', () => {
  const copy = { ...medium };
  return copy.k0;
});

bench('Object.assign({}, obj) (20 props)', () => {
  const copy = Object.assign({}, medium);
  return copy.k0;
});

const large = {};
for (let i = 0; i < 100; i++) large[`k${i}`] = i;

const N2 = 500_000;
function benchLarge(label, fn) {
  for (let i = 0; i < 200; i++) fn();
  const start = performance.now();
  let result = 0;
  for (let i = 0; i < N2; i++) result += fn();
  const ms = performance.now() - start;
  const opsPerSec = (N2 / (ms / 1000)).toExponential(2);
  console.log(`  ${label.padEnd(55)} ${ms.toFixed(0).padStart(6)}ms  (${opsPerSec} ops/sec)`);
  return result;
}

benchLarge('{...obj} spread (100 props)', () => {
  const copy = { ...large };
  return copy.k0;
});

benchLarge('Object.assign({}, obj) (100 props)', () => {
  const copy = Object.assign({}, large);
  return copy.k0;
});

// --- Test 5: spread into existing vs new ---
console.log('\n--- Test 5: target object matters ---');

bench('spread into new: {...obj}', () => {
  const copy = { ...small };
  return copy.a;
});

bench('assign into existing: Object.assign(target, obj)', () => {
  const target = {};
  Object.assign(target, small);
  return target.a;
});

bench('assign mutates: Object.assign(obj, {b:10})', () => {
  const obj = { a: 1, b: 2, c: 3, d: 4, e: 5 };
  Object.assign(obj, { b: 10 });
  return obj.b;
});
