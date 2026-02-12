#!/usr/bin/env node
/**
 * V8 delete operator: what actually happens
 *
 * Myth: "delete is slow, never use it"
 * Reality: delete itself is fast. What's slow is everything AFTER.
 *
 * Tests:
 * 1. delete vs set-to-undefined vs Object.assign-without-key
 * 2. Property access AFTER delete (IC transition to slow mode)
 * 3. delete on array (creates hole) vs splice
 * 4. delete frequency: one delete vs many deletes
 * 5. Workaround: { ...obj } spread without the key
 */

const N = 5_000_000;

function bench(label, fn) {
  // Warmup
  for (let i = 0; i < 1000; i++) fn();

  const start = performance.now();
  let result = 0;
  for (let i = 0; i < N; i++) {
    result += fn();
  }
  const ms = performance.now() - start;
  const opsPerSec = (N / (ms / 1000)).toExponential(2);
  console.log(`  ${label.padEnd(55)} ${ms.toFixed(0).padStart(6)}ms  (${opsPerSec} ops/sec)`);
  return result;
}

console.log(`\n=== V8 delete operator (N=${N.toLocaleString()}) ===\n`);

// --- Test 1: delete vs alternatives ---
console.log('--- Test 1: removing a property ---');

bench('delete obj.key', () => {
  const obj = { a: 1, b: 2, c: 3 };
  delete obj.b;
  return obj.a;
});

bench('obj.key = undefined', () => {
  const obj = { a: 1, b: 2, c: 3 };
  obj.b = undefined;
  return obj.a;
});

bench('destructure + rest: const {b, ...rest} = obj', () => {
  const obj = { a: 1, b: 2, c: 3 };
  const { b, ...rest } = obj;
  return rest.a;
});

// --- Test 2: property access AFTER delete ---
console.log('\n--- Test 2: access pattern after deletion ---');

// Monomorphic: all objects same shape
bench('access after: no delete (monomorphic)', () => {
  const obj = { a: 1, b: 2, c: 3 };
  return obj.a + obj.b + obj.c;
});

bench('access after: set undefined (shape preserved)', () => {
  const obj = { a: 1, b: 2, c: 3 };
  obj.b = undefined;
  return obj.a + (obj.b || 0) + obj.c;
});

bench('access after: delete (shape changed)', () => {
  const obj = { a: 1, b: 2, c: 3 };
  delete obj.b;
  return obj.a + (obj.b || 0) + obj.c;
});

// --- Test 3: delete effect on OTHER objects with same shape ---
console.log('\n--- Test 3: delete pollutes IC for same-shape objects ---');

function accessProps(obj) {
  return obj.a + obj.b + obj.c;
}

// First: warm up with consistent shape
bench('shared IC: all same shape', () => {
  const o1 = { a: 1, b: 2, c: 3 };
  const o2 = { a: 4, b: 5, c: 6 };
  return accessProps(o1) + accessProps(o2);
});

// Now: introduce deleted shape into the mix
bench('shared IC: one deleted, one intact', () => {
  const o1 = { a: 1, b: 2, c: 3 };
  delete o1.b;
  const o2 = { a: 4, b: 5, c: 6 };
  return (o1.a + (o1.b || 0) + o1.c) + accessProps(o2);
});

// --- Test 4: delete on arrays ---
console.log('\n--- Test 4: delete on arrays (creates holes) ---');

bench('array: delete arr[i] (creates hole)', () => {
  const arr = [1, 2, 3, 4, 5];
  delete arr[2];
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += (arr[i] || 0);
  return sum;
});

bench('array: splice (no hole)', () => {
  const arr = [1, 2, 3, 4, 5];
  arr.splice(2, 1);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum;
});

bench('array: set undefined (no hole, keeps length)', () => {
  const arr = [1, 2, 3, 4, 5];
  arr[2] = undefined;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += (arr[i] || 0);
  return sum;
});

// --- Test 5: repeated delete ---
console.log('\n--- Test 5: cumulative damage ---');

bench('create + read (no delete)', () => {
  const obj = { a: 1, b: 2, c: 3, d: 4, e: 5 };
  return obj.a + obj.b + obj.c + obj.d + obj.e;
});

bench('create + delete 1 + read', () => {
  const obj = { a: 1, b: 2, c: 3, d: 4, e: 5 };
  delete obj.c;
  return obj.a + obj.b + (obj.c || 0) + obj.d + obj.e;
});

bench('create + delete 3 + read', () => {
  const obj = { a: 1, b: 2, c: 3, d: 4, e: 5 };
  delete obj.b;
  delete obj.c;
  delete obj.d;
  return obj.a + (obj.b || 0) + (obj.c || 0) + (obj.d || 0) + obj.e;
});

// --- Test 6: persistent object (realistic scenario) ---
console.log('\n--- Test 6: persistent object (reused across iterations) ---');

const N2 = 1_000_000;

function benchPersist(label, setup, fn) {
  const obj = setup();
  // warmup
  for (let i = 0; i < 1000; i++) fn(obj);

  const start = performance.now();
  let result = 0;
  for (let i = 0; i < N2; i++) {
    result += fn(obj);
  }
  const ms = performance.now() - start;
  const opsPerSec = (N2 / (ms / 1000)).toExponential(2);
  console.log(`  ${label.padEnd(55)} ${ms.toFixed(0).padStart(6)}ms  (${opsPerSec} ops/sec)`);
  return result;
}

benchPersist(
  'persistent: intact object',
  () => ({ a: 1, b: 2, c: 3, d: 4, e: 5 }),
  (obj) => obj.a + obj.b + obj.c + obj.d + obj.e
);

benchPersist(
  'persistent: after 1 delete',
  () => { const o = { a: 1, b: 2, c: 3, d: 4, e: 5 }; delete o.c; return o; },
  (obj) => obj.a + obj.b + (obj.c || 0) + obj.d + obj.e
);

benchPersist(
  'persistent: after 3 deletes',
  () => { const o = { a: 1, b: 2, c: 3, d: 4, e: 5 }; delete o.b; delete o.c; delete o.d; return o; },
  (obj) => obj.a + (obj.b || 0) + (obj.c || 0) + (obj.d || 0) + obj.e
);
