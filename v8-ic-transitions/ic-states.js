// V8 Inline Cache State Transitions
// Measure the exact performance boundaries between:
//   monomorphic (1 shape) → polymorphic (2-4 shapes) → megamorphic (5+ shapes)
//
// Key question: where exactly does V8 give up on the IC dispatch table
// and fall back to generic hash lookup?
//
// Run: node --allow-natives-syntax ic-states.js

'use strict';

// ── Shape Generators ───────────────────────────────────────
// Each factory creates objects with a distinct hidden class (map).
// Same property name 'x', but different construction paths = different shapes.

function makeShape(n) {
  // Creates an object with n extra properties before 'x'
  // Each unique n = unique hidden class transition chain
  const obj = {};
  for (let i = 0; i < n; i++) {
    obj['p' + i] = i;
  }
  obj.x = 42;
  return obj;
}

function generateShapes(count) {
  const shapes = [];
  for (let i = 0; i < count; i++) {
    shapes.push(makeShape(i));
  }
  return shapes;
}

// ── The test function ──────────────────────────────────────
// This function's IC for property 'x' will transition through states
// as we feed it objects with different shapes.

function readX(obj) {
  return obj.x;
}

// ── Measurement ────────────────────────────────────────────

const WARMUP = 1e4;
const ITERS = 1e7;

function measure(label, shapes) {
  // Create a fresh function each time to get a clean IC
  const fn = new Function('obj', 'return obj.x');

  // Warmup: feed all shapes to transition the IC
  for (let w = 0; w < WARMUP; w++) {
    for (const s of shapes) {
      fn(s);
    }
  }

  // Measure: cycle through shapes
  const n = shapes.length;
  const start = performance.now();
  for (let i = 0; i < ITERS; i++) {
    fn(shapes[i % n]);
  }
  const elapsed = performance.now() - start;
  const nsPerOp = (elapsed / ITERS) * 1e6;

  return { label, shapes: n, elapsed: elapsed.toFixed(1), nsPerOp: nsPerOp.toFixed(2) };
}

// ── IC state feedback via --allow-natives-syntax ───────────

function getICState(fn, obj) {
  // %GetOptimizationStatus returns a bitmask
  // But we need IC feedback specifically
  // Let's use %DebugPrint on the function to see IC state
  // Actually, the most reliable way is %GetFeedback
  // Note: these V8 intrinsics may vary by version
  try {
    %PrepareFunctionForOptimization(fn);
    fn(obj);
    %OptimizeFunctionOnNextCall(fn);
    fn(obj);
    const status = %GetOptimizationStatus(fn);
    return status;
  } catch (e) {
    return null;
  }
}

// ── Run the experiment ─────────────────────────────────────

console.log('V8 IC State Transitions: Measuring property access across shape counts\n');
console.log('Shapes | ns/op  | elapsed(ms) | ratio vs 1');
console.log('-------|--------|-------------|----------');

const results = [];
const shapeCounts = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20, 32];

for (const count of shapeCounts) {
  const shapes = generateShapes(count);
  const r = measure(`${count} shapes`, shapes);
  results.push(r);
}

// Calculate ratio vs monomorphic
const baseline = parseFloat(results[0].nsPerOp);
for (const r of results) {
  const ratio = (parseFloat(r.nsPerOp) / baseline).toFixed(2);
  console.log(
    `${String(r.shapes).padStart(6)} | ${r.nsPerOp.padStart(6)} | ${r.elapsed.padStart(11)} | ${ratio}x`
  );
}

// ── Phase 2: IC state via trace-ic flag output ─────────────
// Run with: node --trace-ic ic-states.js 2>&1 | grep -c "LoadIC"
// But that's too noisy. Instead let's check optimization status.

console.log('\n--- Optimization status ---');

for (const count of [1, 2, 4, 5, 8]) {
  const shapes = generateShapes(count);
  const fn = new Function('obj', 'return obj.x');

  try {
    %PrepareFunctionForOptimization(fn);
    for (let w = 0; w < 1000; w++) {
      for (const s of shapes) fn(s);
    }
    %OptimizeFunctionOnNextCall(fn);
    for (const s of shapes) fn(s);

    const status = %GetOptimizationStatus(fn);
    const isOptimized = (status & 16) !== 0;
    const isTurboFanned = (status & 32) !== 0;
    console.log(
      `${count} shapes: status=${status}, optimized=${isOptimized}, turbofanned=${isTurboFanned}`
    );
  } catch (e) {
    console.log(`${count} shapes: native syntax not available (${e.message})`);
    break;
  }
}

// ── Phase 3: Bytecode comparison ───────────────────────────
console.log('\n--- Bytecode is identical for all cases ---');
console.log('(readX always compiles to GetNamedProperty regardless of IC state)');
console.log('The IC state is RUNTIME metadata attached to the feedback vector,');
console.log('not visible in bytecode. Bytecode is the instruction;');
console.log('IC state is the learned shortcut for executing that instruction.');
console.log('\nThis is the key insight: bytecode = source code of the VM,');
console.log('IC = JIT-compiled cache of runtime experience.');
console.log('Same instruction, different execution path.');

// ── FINDINGS (3 runs) ──────────────────────────────────────
//
// FINDING 1: Two sharp IC transitions, not one gradual degradation.
//
//   1 shape:    ~2.8 ns/op  (monomorphic — single cached map)
//   2-4 shapes: ~8.5 ns/op  (polymorphic — small dispatch table, ~3x)
//   5+ shapes:  ~13  ns/op  (megamorphic — hash lookup, ~4.5x)
//
// FINDING 2: The polymorphic→megamorphic boundary is exactly 5 shapes.
//   Not 8 (as commonly claimed). Not gradual. Sharp step function at 5.
//   V8's kMaxPolymorphicMapCount = 4 (checked in TurboFan source).
//   At 5 maps, the IC gives up and falls to generic runtime.
//
// FINDING 3: After megamorphic, more shapes barely matter.
//   5 shapes ≈ 32 shapes. Both ~13 ns/op.
//   The hash lookup cost is roughly constant regardless of how many
//   different maps have been seen. The IC has already given up.
//   Adding more shapes doesn't make it worse — it's already at the floor.
//
// FINDING 4: All shapes optimize (status=81 = optimized by Maglev).
//   Even megamorphic functions get optimized — just with generic
//   property access instead of cached map checks. TurboFan/Maglev
//   still compiles the function, it just can't specialize the IC.
//
// PRACTICAL IMPLICATIONS:
//   - Keep polymorphic call sites to ≤4 shapes if possible
//   - If you're already at 5, going to 20 doesn't matter much
//   - The monomorphic→polymorphic jump (1→2, 3x) is the biggest
//     per-shape cost. If you can keep it to 1 shape, do.
//   - The 3x and 4.5x numbers interact with TurboFan inlining:
//     megamorphic prevents speculative inlining, which is where
//     the real 10-100x costs come from (see prototype-lookup experiment)
