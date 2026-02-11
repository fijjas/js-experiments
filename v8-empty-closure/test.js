// Does V8 optimize closures that capture nothing?
//
// Hypothesis: a closure that captures zero variables from its enclosing
// scope should be equivalent to a plain function — no context allocation,
// no scope chain traversal. But does V8 actually recognize this?
//
// Three cases:
//   1. Plain function (baseline)
//   2. Closure capturing nothing (should be same as #1?)
//   3. Closure capturing one variable (real closure)
//
// V8 v12 / node v20
// Run: node --print-bytecode --print-bytecode-filter='plain|emptyClose|realClose|make' v8-empty-closure/test.js

// Case 1: plain function
function plain(x) {
  return x * 2;
}

// Case 2: closure that captures nothing
function makeEmptyClosure() {
  return function emptyClose(x) {
    return x * 2;
  };
}

// Case 3: closure that captures a variable
function makeRealClosure(factor) {
  return function realClose(x) {
    return x * factor;
  };
}

// Force compilation
const f1 = plain;
const f2 = makeEmptyClosure();
const f3 = makeRealClosure(2);

// Warmup — trigger TurboFan
for (let i = 0; i < 100000; i++) {
  f1(i);
  f2(i);
  f3(i);
}

// Benchmark
function bench(name, fn, iterations) {
  const start = performance.now();
  let sum = 0;
  for (let i = 0; i < iterations; i++) {
    sum += fn(i);
  }
  const elapsed = performance.now() - start;
  console.log(`${name}: ${elapsed.toFixed(2)}ms (sum=${sum})`);
  return elapsed;
}

const N = 50_000_000;
const t1 = bench('plain      ', f1, N);
const t2 = bench('emptyClosure', f2, N);
const t3 = bench('realClosure ', f3, N);

console.log(`\nemptyClosure vs plain: ${((t2/t1 - 1) * 100).toFixed(1)}%`);
console.log(`realClosure  vs plain: ${((t3/t1 - 1) * 100).toFixed(1)}%`);

// === RESULTS (node v20.20.0, Linux x86_64) ===
//
// plain      :  53ms  (sum=2499999950000000)
// emptyClosure: 322ms  (sum=2499999950000000)
// realClosure : 331ms  (sum=2499999950000000)
//
// emptyClosure vs plain: ~500%
// realClosure  vs plain: ~520%
//
// === BYTECODE ===
//
// plain and emptyClose generate IDENTICAL bytecode:
//   Ldar a0, MulSmi [2], Return  (6 bytes)
//
// makeEmptyClosure:
//   CreateClosure [0], [0], #2   (5 bytes — no FunctionContext)
//   Return
//
// makeRealClosure:
//   CreateFunctionContext [0], [1]  (14 bytes — context for captured var)
//   PushContext r0
//   Ldar a0
//   StaCurrentContextSlot [2]
//   CreateClosure [1], [0], #2
//   Return
//
// === WHY 5x SLOWER? ===
//
// --trace-turbo-inlining reveals:
//
//   plain:      "Inlining plain into bench" ✓
//   emptyClose: "Cannot consider for inlining (no feedback vector)" ✗
//   realClose:  "Cannot consider for inlining (no feedback vector)" ✗
//
// The 5x difference is 100% from INLINING, not closure overhead.
// V8 uses feedback vectors to track type info at call sites.
// Closures from factory functions don't have feedback vectors
// available at the bench() call site — so TurboFan can't inline them.
//
// V8 doesn't distinguish empty vs real closures for inlining.
// Both are penalized equally: the decision is about feedback vector
// availability, not about what the closure captures.
//
// Practical implication: if hot-path performance matters, prefer
// plain functions over closures — even if the closure captures nothing.
// The cost isn't in the closure mechanism, it's in missed TurboFan inlining.
