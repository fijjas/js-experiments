#!/usr/bin/env node
/**
 * V8 object iteration: for...in vs Object.keys vs Object.entries
 *
 * Myths:
 * - "for...in is slow because it walks the prototype chain"
 * - "Object.keys is always better than for...in"
 * - "Object.entries is free abstraction"
 *
 * Tests:
 * 1. for...in vs Object.keys forEach vs Object.entries
 * 2. With prototype chain (inherited properties)
 * 3. for...in with hasOwnProperty check
 * 4. Object size scaling (5, 50, 500 properties)
 * 5. for...of Object.keys vs for...in
 * 6. Object.values
 */

const N = 2_000_000;

function bench(label, fn) {
  for (let i = 0; i < 500; i++) fn();

  const start = performance.now();
  let result = 0;
  for (let i = 0; i < N; i++) {
    result += fn();
  }
  const ms = performance.now() - start;
  const opsPerSec = (N / (ms / 1000)).toExponential(2);
  console.log(`  ${label.padEnd(58)} ${ms.toFixed(0).padStart(6)}ms  (${opsPerSec} ops/sec)`);
  return result;
}

console.log(`\n=== V8 object iteration (N=${N.toLocaleString()}) ===\n`);

// --- Test 1: basic iteration (5 properties) ---
console.log('--- Test 1: iterate 5 properties ---');

const small = { a: 1, b: 2, c: 3, d: 4, e: 5 };

bench('for...in', () => {
  let sum = 0;
  for (const k in small) sum += small[k];
  return sum;
});

bench('Object.keys + for loop', () => {
  let sum = 0;
  const keys = Object.keys(small);
  for (let i = 0; i < keys.length; i++) sum += small[keys[i]];
  return sum;
});

bench('Object.keys + forEach', () => {
  let sum = 0;
  Object.keys(small).forEach(k => { sum += small[k]; });
  return sum;
});

bench('Object.entries + for-of', () => {
  let sum = 0;
  for (const [k, v] of Object.entries(small)) sum += v;
  return sum;
});

bench('Object.values + for-of', () => {
  let sum = 0;
  for (const v of Object.values(small)) sum += v;
  return sum;
});

bench('for-of Object.keys', () => {
  let sum = 0;
  for (const k of Object.keys(small)) sum += small[k];
  return sum;
});

// --- Test 2: with prototype chain ---
console.log('\n--- Test 2: prototype chain (own + inherited) ---');

function Parent() { this.x = 10; this.y = 20; }
Parent.prototype.z = 30;
Parent.prototype.w = 40;
const child = new Parent();
child.a = 1;
child.b = 2;

bench('for...in (walks prototype, 6 props)', () => {
  let sum = 0;
  for (const k in child) sum += child[k];
  return sum;
});

bench('for...in + hasOwnProperty (4 own props)', () => {
  let sum = 0;
  for (const k in child) {
    if (child.hasOwnProperty(k)) sum += child[k];
  }
  return sum;
});

bench('Object.keys (own only, 4 props)', () => {
  let sum = 0;
  const keys = Object.keys(child);
  for (let i = 0; i < keys.length; i++) sum += child[keys[i]];
  return sum;
});

bench('for...in + Object.hasOwn (4 own props)', () => {
  let sum = 0;
  for (const k in child) {
    if (Object.hasOwn(child, k)) sum += child[k];
  }
  return sum;
});

// --- Test 3: medium object (50 props) ---
console.log('\n--- Test 3: 50 properties ---');

const medium = {};
for (let i = 0; i < 50; i++) medium[`k${i}`] = i;

bench('for...in (50 props)', () => {
  let sum = 0;
  for (const k in medium) sum += medium[k];
  return sum;
});

bench('Object.keys + for loop (50 props)', () => {
  let sum = 0;
  const keys = Object.keys(medium);
  for (let i = 0; i < keys.length; i++) sum += medium[keys[i]];
  return sum;
});

bench('Object.entries + for-of (50 props)', () => {
  let sum = 0;
  for (const [k, v] of Object.entries(medium)) sum += v;
  return sum;
});

bench('Object.values + for-of (50 props)', () => {
  let sum = 0;
  for (const v of Object.values(medium)) sum += v;
  return sum;
});

// --- Test 4: large object (500 props) ---
console.log('\n--- Test 4: 500 properties ---');

const N2 = 200_000;
const large = {};
for (let i = 0; i < 500; i++) large[`k${i}`] = i;

function benchLarge(label, fn) {
  for (let i = 0; i < 100; i++) fn();
  const start = performance.now();
  let result = 0;
  for (let i = 0; i < N2; i++) result += fn();
  const ms = performance.now() - start;
  const opsPerSec = (N2 / (ms / 1000)).toExponential(2);
  console.log(`  ${label.padEnd(58)} ${ms.toFixed(0).padStart(6)}ms  (${opsPerSec} ops/sec)`);
  return result;
}

benchLarge('for...in (500 props)', () => {
  let sum = 0;
  for (const k in large) sum += large[k];
  return sum;
});

benchLarge('Object.keys + for loop (500 props)', () => {
  let sum = 0;
  const keys = Object.keys(large);
  for (let i = 0; i < keys.length; i++) sum += large[keys[i]];
  return sum;
});

benchLarge('Object.entries + for-of (500 props)', () => {
  let sum = 0;
  for (const [k, v] of Object.entries(large)) sum += v;
  return sum;
});

benchLarge('Object.values + for-of (500 props)', () => {
  let sum = 0;
  for (const v of Object.values(large)) sum += v;
  return sum;
});

// --- Test 5: key collection cost (no iteration body) ---
console.log('\n--- Test 5: key collection cost alone ---');

bench('Object.keys(small).length', () => Object.keys(small).length);
bench('Object.entries(small).length', () => Object.entries(small).length);
bench('Object.values(small).length', () => Object.values(small).length);

bench('Object.keys(medium).length', () => Object.keys(medium).length);
bench('Object.entries(medium).length', () => Object.entries(medium).length);
