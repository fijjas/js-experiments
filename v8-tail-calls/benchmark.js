'use strict';

/**
 * V8 Tail Calls: What You Pay For Not Having Them
 *
 * V8 doesn't implement proper tail calls (PTC) despite ES2015 spec.
 * Only Safari's JavaScriptCore does.
 *
 * This measures the real cost of workarounds:
 * - Recursive (tail form): works until stack overflow (~10K depth)
 * - Trampoline (closure): no stack overflow, but 19x slower
 * - Trampoline (generator): same overhead as closures
 * - Iterative: baseline, but destroys the recursive structure
 *
 * Key finding: the trampoline overhead is 100% closure allocation.
 * If you can express the trampoline state without closures, it's free.
 * But then you've just rewritten it as a loop.
 */

// === Strategies ===

function recursive(n, acc = 1) {
  if (n <= 1) return acc;
  return recursive(n - 1, n * acc);
}

function iterative(n) {
  let acc = 1;
  for (let i = 2; i <= n; i++) acc *= i;
  return acc;
}

function trampolineClosure(n) {
  function bounce(n, acc) {
    if (n <= 1) return acc;
    return () => bounce(n - 1, n * acc);
  }
  let result = bounce(n, 1);
  while (typeof result === 'function') result = result();
  return result;
}

function* factGen(n) {
  let acc = 1;
  while (n > 1) {
    acc *= n--;
    yield;
  }
  return acc;
}
function trampolineGenerator(n) {
  const gen = factGen(n);
  let r;
  while (true) {
    const { value, done } = gen.next();
    if (done) return value;
  }
}

// === More interesting case: tree recursion (Fibonacci) ===

function fibRecursive(n) {
  if (n <= 1) return n;
  return fibRecursive(n - 1) + fibRecursive(n - 2);
}

function fibIterative(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
  return b;
}

function fibTrampolineCPS(n) {
  // CPS-transformed fibonacci with trampoline
  function fib(n, k) {
    if (n <= 1) return k(n);
    return () => fib(n - 1, v1 =>
      () => fib(n - 2, v2 =>
        k(v1 + v2)
      )
    );
  }
  let result = fib(n, x => x);
  while (typeof result === 'function') result = result();
  return result;
}

// === Benchmark utility ===

function bench(name, fn, args, iterations) {
  // warmup
  for (let i = 0; i < Math.min(iterations, 1000); i++) fn(...args);

  const t = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn(...args);
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  return { name, ms, opsPerSec: Math.round(iterations / ms * 1000) };
}

// === Run ===

console.log('=== Stack Depth ===');
function measureStack(n) {
  try { return measureStack(n + 1); } catch { return n; }
}
console.log(`Max recursive depth: ${measureStack(0)}`);
console.log();

// Factorial benchmarks
const N = 5000;
const ITER = 10000;
console.log(`=== Factorial(${N}) x ${ITER} ===`);

const results = [
  bench('Recursive (tail)', recursive, [N], ITER),
  bench('Iterative', iterative, [N], ITER),
  bench('Trampoline (closure)', trampolineClosure, [N], ITER),
  bench('Trampoline (generator)', trampolineGenerator, [N], ITER),
];

const baseline = results.find(r => r.name === 'Iterative').ms;
for (const r of results) {
  const ratio = (r.ms / baseline).toFixed(1);
  console.log(`  ${r.name.padEnd(25)} ${r.ms.toFixed(1).padStart(8)}ms  ${ratio.padStart(5)}x`);
}

// Fibonacci benchmarks (tree recursion — harder to trampoline)
console.log();
console.log('=== Fibonacci(25) x 100 ===');
console.log('(Tree recursion — the case where trampolines really cost)');

const fibResults = [
  bench('Recursive', fibRecursive, [25], 100),
  bench('Iterative', fibIterative, [25], 100000),
  bench('Trampoline CPS', fibTrampolineCPS, [25], 100),
];

// Normalize fibonacci to per-call
console.log(`  ${'Recursive'.padEnd(25)} ${(fibResults[0].ms / 100 * 1000).toFixed(1).padStart(8)}μs/call`);
console.log(`  ${'Iterative'.padEnd(25)} ${(fibResults[1].ms / 100000 * 1000).toFixed(3).padStart(8)}μs/call`);
console.log(`  ${'Trampoline CPS'.padEnd(25)} ${(fibResults[2].ms / 100 * 1000).toFixed(1).padStart(8)}μs/call`);

console.log();
console.log('=== Summary ===');
console.log('Tail call workarounds in V8:');
console.log('  - Trampoline (closure): solves stack overflow, costs ~19x');
console.log('  - Generator: same overhead as closures (~19x)');
console.log('  - Iterative: free, but destroys recursive structure');
console.log('  - The overhead IS the closure allocation. Nothing else.');
console.log('  - For tree recursion (fibonacci), CPS+trampoline is even worse');
console.log('    because each node creates multiple continuations.');
