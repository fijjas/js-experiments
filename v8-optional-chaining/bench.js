#!/usr/bin/env node
/**
 * V8 optional chaining (?.) performance
 *
 * Myth: "optional chaining is slow, use manual checks"
 * Reality: let's measure.
 *
 * Tests:
 * 1. obj?.prop vs obj && obj.prop vs obj.prop (when obj exists)
 * 2. Nested: obj?.a?.b?.c vs manual chain
 * 3. Optional method call: obj?.method() vs manual check
 * 4. Nullish coalescing: obj?.prop ?? default vs ternary
 * 5. With undefined (short-circuit case)
 * 6. Array access: arr?.[i] vs manual
 */

const N = 10_000_000;

function bench(label, fn) {
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

console.log(`\n=== V8 optional chaining (N=${N.toLocaleString()}) ===\n`);

// --- Test 1: simple property access ---
console.log('--- Test 1: simple property access (obj exists) ---');

const obj = { a: 1, b: { c: 2, d: { e: 3 } } };

bench('obj.a (direct)', () => obj.a);
bench('obj?.a (optional)', () => obj?.a);
bench('obj && obj.a (manual check)', () => obj && obj.a);

// --- Test 2: nested access ---
console.log('\n--- Test 2: nested access (all exist) ---');

bench('obj.b.c (direct)', () => obj.b.c);
bench('obj?.b?.c (optional chain)', () => obj?.b?.c);
bench('obj && obj.b && obj.b.c (manual)', () => obj && obj.b && obj.b.c);

// --- Test 3: deep nesting ---
console.log('\n--- Test 3: 3 levels deep ---');

bench('obj.b.d.e (direct)', () => obj.b.d.e);
bench('obj?.b?.d?.e (optional)', () => obj?.b?.d?.e);
bench('obj && obj.b && obj.b.d && obj.b.d.e', () => obj && obj.b && obj.b.d && obj.b.d.e);

// --- Test 4: short-circuit (null/undefined) ---
console.log('\n--- Test 4: short-circuit (obj is null) ---');

const nil = null;
const undef = undefined;

bench('nil?.a (null short-circuit)', () => nil?.a || 0);
bench('nil && nil.a (manual null check)', () => (nil && nil.a) || 0);
bench('undef?.a (undefined short-circuit)', () => undef?.a || 0);

// --- Test 5: optional method call ---
console.log('\n--- Test 5: optional method call ---');

const withMethod = { calc: () => 42 };
const withoutMethod = {};

bench('obj.calc() (direct)', () => withMethod.calc());
bench('obj?.calc() (optional, exists)', () => withMethod?.calc());
bench('obj?.calc() (optional, missing)', () => withoutMethod?.calc?.() || 0);
bench('obj.calc && obj.calc() (manual)', () => (withoutMethod.calc && withoutMethod.calc()) || 0);

// --- Test 6: array access ---
console.log('\n--- Test 6: array access ---');

const arr = [10, 20, 30];
const emptyArr = null;

bench('arr[1] (direct)', () => arr[1]);
bench('arr?.[1] (optional, exists)', () => arr?.[1]);
bench('emptyArr?.[1] (optional, null)', () => emptyArr?.[1] || 0);

// --- Test 7: nullish coalescing ---
console.log('\n--- Test 7: with nullish coalescing ---');

const config = { timeout: 0, name: 'test' };

bench('config.timeout ?? 30 (nullish)', () => config.timeout ?? 30);
bench('config.timeout || 30 (logical or)', () => config.timeout || 30);
bench('config.missing ?? 30 (nullish, missing)', () => config.missing ?? 30);
bench('config?.timeout ?? 30 (chain + nullish)', () => config?.timeout ?? 30);
