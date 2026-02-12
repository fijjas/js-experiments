#!/usr/bin/env node
/**
 * V8 generators: state machine overhead
 *
 * Myth: "generators are slow, avoid them"
 * Reality: let's measure the suspension/resumption cost.
 *
 * Tests:
 * 1. Generator yield vs return vs callback
 * 2. Generator iteration vs array iteration
 * 3. Infinite generator vs manual counter
 * 4. Generator pipeline (composed generators)
 * 5. for-of generator vs manually calling .next()
 * 6. Yield delegation (yield*)
 */

const N = 2_000_000;

function bench(label, fn) {
  for (let i = 0; i < 500; i++) fn();
  const start = performance.now();
  let result = 0;
  for (let i = 0; i < N; i++) result += fn();
  const ms = performance.now() - start;
  const opsPerSec = (N / (ms / 1000)).toExponential(2);
  console.log(`  ${label.padEnd(58)} ${ms.toFixed(0).padStart(6)}ms  (${opsPerSec} ops/sec)`);
  return result;
}

console.log(`\n=== V8 generators (N=${N.toLocaleString()}) ===\n`);

// --- Test 1: yield vs alternatives ---
console.log('--- Test 1: producing 5 values ---');

function* fiveValues() {
  yield 1; yield 2; yield 3; yield 4; yield 5;
}

function fiveArray() {
  return [1, 2, 3, 4, 5];
}

function fiveCallback(cb) {
  cb(1); cb(2); cb(3); cb(4); cb(5);
}

bench('generator: for-of 5 yields', () => {
  let sum = 0;
  for (const v of fiveValues()) sum += v;
  return sum;
});

bench('array: for-of [1,2,3,4,5]', () => {
  let sum = 0;
  for (const v of fiveArray()) sum += v;
  return sum;
});

bench('callback pattern', () => {
  let sum = 0;
  fiveCallback(v => { sum += v; });
  return sum;
});

bench('manual .next() calls', () => {
  const g = fiveValues();
  let sum = 0;
  let r;
  while (!(r = g.next()).done) sum += r.value;
  return sum;
});

// --- Test 2: infinite generator vs counter ---
console.log('\n--- Test 2: take 10 from infinite source ---');

function* naturals() {
  let n = 0;
  while (true) yield n++;
}

bench('generator: take 10 from infinite', () => {
  let sum = 0;
  let count = 0;
  for (const v of naturals()) {
    sum += v;
    if (++count >= 10) break;
  }
  return sum;
});

bench('for-loop: 10 iterations', () => {
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += i;
  return sum;
});

// --- Test 3: generator pipeline ---
console.log('\n--- Test 3: generator pipeline (map + filter) ---');

function* range(n) {
  for (let i = 0; i < n; i++) yield i;
}

function* map(gen, fn) {
  for (const v of gen) yield fn(v);
}

function* filter(gen, fn) {
  for (const v of gen) if (fn(v)) yield v;
}

bench('generator pipeline: range→map→filter (20)', () => {
  let sum = 0;
  for (const v of filter(map(range(20), x => x * 2), x => x % 3 === 0)) {
    sum += v;
  }
  return sum;
});

bench('array pipeline: array.map.filter (20)', () => {
  let sum = 0;
  const arr = Array.from({ length: 20 }, (_, i) => i);
  for (const v of arr.map(x => x * 2).filter(x => x % 3 === 0)) {
    sum += v;
  }
  return sum;
});

bench('for-loop imperative (20)', () => {
  let sum = 0;
  for (let i = 0; i < 20; i++) {
    const v = i * 2;
    if (v % 3 === 0) sum += v;
  }
  return sum;
});

// --- Test 4: yield* delegation ---
console.log('\n--- Test 4: yield* delegation ---');

function* inner() {
  yield 1; yield 2; yield 3;
}

function* outerDirect() {
  yield 1; yield 2; yield 3;
  yield 4; yield 5; yield 6;
}

function* outerDelegated() {
  yield* inner();
  yield 4; yield 5; yield 6;
}

bench('direct yields (6 values)', () => {
  let sum = 0;
  for (const v of outerDirect()) sum += v;
  return sum;
});

bench('yield* delegation (3+3 values)', () => {
  let sum = 0;
  for (const v of outerDelegated()) sum += v;
  return sum;
});

// --- Test 5: generator object allocation ---
console.log('\n--- Test 5: generator creation cost ---');

function* emptyGen() {}
function emptyFn() {}

bench('create generator object (no iteration)', () => {
  const g = emptyGen();
  return 1;
});

bench('create regular function call', () => {
  emptyFn();
  return 1;
});

bench('create generator + exhaust', () => {
  const g = emptyGen();
  g.next();
  return 1;
});
