#!/usr/bin/env node
/**
 * V8 try-catch performance experiment.
 *
 * Historical claim: try-catch prevents V8 from optimizing functions.
 * This was true in Crankshaft (pre-2017). TurboFan should handle it.
 *
 * Tests:
 * 1. Hot loop with vs without try-catch (no exceptions thrown)
 * 2. Hot loop where try-catch catches rare exceptions
 * 3. Try-catch around single statement vs wrapping entire function
 * 4. Cost of actually throwing and catching
 * 5. try-catch vs if-check for expected error conditions
 * 6. Nested try-catch depth
 *
 * Day 1380, session 278. Section 18 of v8-perf-guide.
 */

const ITER = 1e7;
const WARMUP = 1e5;

function bench(name, fn, iterations = ITER) {
  // Warmup
  for (let i = 0; i < WARMUP; i++) fn(i);

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn(i);
  const elapsed = performance.now() - start;

  return { name, elapsed, opsPerSec: (iterations / elapsed * 1000).toFixed(0) };
}

// ============================================================
// Test 1: Hot loop — try-catch wrapper, no exceptions thrown
// ============================================================

function sumNoTry(n) {
  let sum = 0;
  for (let i = 0; i < 100; i++) {
    sum += i * n;
  }
  return sum;
}

function sumWithTry(n) {
  try {
    let sum = 0;
    for (let i = 0; i < 100; i++) {
      sum += i * n;
    }
    return sum;
  } catch (e) {
    return 0;
  }
}

// ============================================================
// Test 2: Try-catch with rare exceptions (1 in 1M)
// ============================================================

function sumRareThrow(n) {
  try {
    if (n === 999999) throw new Error('rare');
    let sum = 0;
    for (let i = 0; i < 100; i++) {
      sum += i * n;
    }
    return sum;
  } catch (e) {
    return -1;
  }
}

// ============================================================
// Test 3: Narrow vs wide try-catch scope
// ============================================================

function narrowTry(n) {
  let sum = 0;
  for (let i = 0; i < 100; i++) {
    try {
      sum += i * n;
    } catch (e) {
      sum = 0;
    }
  }
  return sum;
}

function wideTry(n) {
  try {
    let sum = 0;
    for (let i = 0; i < 100; i++) {
      sum += i * n;
    }
    return sum;
  } catch (e) {
    return 0;
  }
}

// ============================================================
// Test 4: Cost of throwing vs returning error
// ============================================================

function throwOnError(n) {
  if (n < 0) throw new Error('negative');
  return n * 2;
}

function returnOnError(n) {
  if (n < 0) return { error: 'negative' };
  return { value: n * 2 };
}

function testThrowPath(n) {
  try {
    return throwOnError(-(n % 100));
  } catch (e) {
    return -1;
  }
}

function testReturnPath(n) {
  const result = returnOnError(-(n % 100));
  if (result.error) return -1;
  return result.value;
}

// ============================================================
// Test 5: try-catch vs if-check for property access
// ============================================================

const objects = [];
for (let i = 0; i < 1000; i++) {
  objects.push(i % 10 === 0 ? null : { value: i });
}

function accessWithTry(n) {
  try {
    return objects[n % 1000].value;
  } catch (e) {
    return 0;
  }
}

function accessWithCheck(n) {
  const obj = objects[n % 1000];
  if (obj === null) return 0;
  return obj.value;
}

// ============================================================
// Test 6: Nested try-catch depth
// ============================================================

function nested0(n) {
  return n * 2;
}

function nested1(n) {
  try {
    return n * 2;
  } catch (e) { return 0; }
}

function nested3(n) {
  try {
    try {
      try {
        return n * 2;
      } catch (e) { return 0; }
    } catch (e) { return 0; }
  } catch (e) { return 0; }
}

function nested5(n) {
  try {
    try {
      try {
        try {
          try {
            return n * 2;
          } catch (e) { return 0; }
        } catch (e) { return 0; }
      } catch (e) { return 0; }
    } catch (e) { return 0; }
  } catch (e) { return 0; }
}

// ============================================================
// Run
// ============================================================

console.log(`Node ${process.version}, V8 ${process.versions.v8}`);
console.log(`Iterations: ${ITER.toLocaleString()}\n`);

const results = [];

// Test 1
results.push(bench('1a. sum (no try-catch)', sumNoTry));
results.push(bench('1b. sum (with try-catch, no throw)', sumWithTry));

// Test 2
results.push(bench('2.  sum (rare throw 1/1M)', sumRareThrow));

// Test 3
results.push(bench('3a. narrow try (try inside loop)', narrowTry));
results.push(bench('3b. wide try (try outside loop)', wideTry));

// Test 4: throw path — always throws
results.push(bench('4a. throw+catch path (always throws)', testThrowPath));
results.push(bench('4b. return error path (always errors)', testReturnPath));

// Test 5: null access
results.push(bench('5a. property access with try-catch', accessWithTry));
results.push(bench('5b. property access with if-check', accessWithCheck));

// Test 6: nesting depth
results.push(bench('6a. no try-catch', nested0));
results.push(bench('6b. 1-level try-catch', nested1));
results.push(bench('6c. 3-level nested try-catch', nested3));
results.push(bench('6d. 5-level nested try-catch', nested5));

// Display
console.log('Test'.padEnd(45) + 'Time (ms)'.padStart(12) + '  ops/sec');
console.log('-'.repeat(70));
for (const r of results) {
  console.log(
    r.name.padEnd(45) +
    r.elapsed.toFixed(1).padStart(12) +
    ('  ' + Number(r.opsPerSec).toLocaleString())
  );
}

// Comparisons
console.log('\n=== Key Comparisons ===\n');
const pairs = [
  ['1a', '1b', 'try-catch overhead (no throw)'],
  ['3a', '3b', 'narrow vs wide try scope'],
  ['4a', '4b', 'throw vs return for errors'],
  ['5a', '5b', 'try-catch vs if-check for null'],
  ['6a', '6d', 'no try vs 5-level nested'],
];

for (const [a, b, label] of pairs) {
  const ra = results.find(r => r.name.startsWith(a));
  const rb = results.find(r => r.name.startsWith(b));
  if (ra && rb) {
    const ratio = ra.elapsed / rb.elapsed;
    const faster = ratio < 1 ? ra.name : rb.name;
    const factor = ratio < 1 ? (1/ratio).toFixed(1) : ratio.toFixed(1);
    console.log(`${label}:`);
    console.log(`  ${ra.name}: ${ra.elapsed.toFixed(1)}ms`);
    console.log(`  ${rb.name}: ${rb.elapsed.toFixed(1)}ms`);
    console.log(`  → ${faster.split('.')[0].trim()} is ${factor}x faster\n`);
  }
}
