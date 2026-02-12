// V8 hidden classes (Maps) and inline cache states
// Question: how much does property access slow down when objects have different shapes?
//
// V8 uses "Maps" (hidden classes) to track object shapes.
// Property access goes through inline caches (ICs) with 4 states:
//   1. Uninitialized — never accessed
//   2. Monomorphic — always same shape → fastest (direct offset access)
//   3. Polymorphic — 2-4 shapes → lookup from small cache
//   4. Megamorphic — 5+ shapes → hash table lookup (slowest)
//
// Node.js v20.20.0 / V8 v12
// Run: node v8-hidden-classes/shape-transition.js
// Bytecode: node --print-bytecode --print-bytecode-filter='readX' v8-hidden-classes/shape-transition.js

// === Test function: reads .x from whatever object is passed ===

function readX(obj) {
  return obj.x;
}

// === Helpers ===

function bench(name, fn, iterations) {
  // warmup
  for (var i = 0; i < 1000; i++) fn();

  var start = performance.now();
  for (var i = 0; i < iterations; i++) fn();
  var elapsed = performance.now() - start;
  console.log(`${name}: ${elapsed.toFixed(2)}ms`);
  return elapsed;
}

var N = 10_000_000;

// === Case 1: Monomorphic — all objects same shape ===
console.log('=== Case 1: Monomorphic (1 shape) ===');

function Shape1() { this.x = 1; }
var mono = [];
for (var i = 0; i < 100; i++) mono.push(new Shape1());

// Dedicated function for monomorphic test
function readXMono(obj) { return obj.x; }
for (var i = 0; i < 100000; i++) readXMono(mono[i % 100]); // warmup

var tMono = bench('mono', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum += readXMono(mono[i]);
  return sum;
}, N / 100);


// === Case 2: Polymorphic — 2 shapes ===
console.log('\n=== Case 2: Polymorphic (2 shapes) ===');

function ShapeA() { this.x = 1; }
function ShapeB() { this.x = 1; this.y = 2; }
var poly2 = [];
for (var i = 0; i < 100; i++) {
  poly2.push(i % 2 === 0 ? new ShapeA() : new ShapeB());
}

function readXPoly2(obj) { return obj.x; }
for (var i = 0; i < 100000; i++) readXPoly2(poly2[i % 100]);

var tPoly2 = bench('poly2', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum += readXPoly2(poly2[i]);
  return sum;
}, N / 100);


// === Case 3: Polymorphic — 4 shapes ===
console.log('\n=== Case 3: Polymorphic (4 shapes) ===');

function ShapeC1() { this.x = 1; }
function ShapeC2() { this.x = 1; this.y = 2; }
function ShapeC3() { this.x = 1; this.z = 3; }
function ShapeC4() { this.x = 1; this.w = 4; }
var poly4 = [];
for (var i = 0; i < 100; i++) {
  var mod = i % 4;
  if (mod === 0) poly4.push(new ShapeC1());
  else if (mod === 1) poly4.push(new ShapeC2());
  else if (mod === 2) poly4.push(new ShapeC3());
  else poly4.push(new ShapeC4());
}

function readXPoly4(obj) { return obj.x; }
for (var i = 0; i < 100000; i++) readXPoly4(poly4[i % 100]);

var tPoly4 = bench('poly4', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum += readXPoly4(poly4[i]);
  return sum;
}, N / 100);


// === Case 4: Megamorphic — 8 shapes ===
console.log('\n=== Case 4: Megamorphic (8 shapes) ===');

function ShapeM1() { this.x = 1; }
function ShapeM2() { this.x = 1; this.a = 2; }
function ShapeM3() { this.x = 1; this.b = 3; }
function ShapeM4() { this.x = 1; this.c = 4; }
function ShapeM5() { this.x = 1; this.d = 5; }
function ShapeM6() { this.x = 1; this.e = 6; }
function ShapeM7() { this.x = 1; this.f = 7; }
function ShapeM8() { this.x = 1; this.g = 8; }
var mega = [];
var megas = [ShapeM1, ShapeM2, ShapeM3, ShapeM4, ShapeM5, ShapeM6, ShapeM7, ShapeM8];
for (var i = 0; i < 100; i++) {
  mega.push(new megas[i % 8]());
}

function readXMega(obj) { return obj.x; }
for (var i = 0; i < 100000; i++) readXMega(mega[i % 100]);

var tMega = bench('mega', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum += readXMega(mega[i]);
  return sum;
}, N / 100);


// === Case 5: Same shape but properties added in different order ===
console.log('\n=== Case 5: Same properties, different order ===');

var diffOrder = [];
for (var i = 0; i < 100; i++) {
  var obj;
  if (i % 2 === 0) {
    obj = {};
    obj.x = 1;
    obj.y = 2;
  } else {
    obj = {};
    obj.y = 2;
    obj.x = 1;
  }
  diffOrder.push(obj);
}

function readXDiffOrder(obj) { return obj.x; }
for (var i = 0; i < 100000; i++) readXDiffOrder(diffOrder[i % 100]);

var tDiffOrder = bench('diffOrder', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum += readXDiffOrder(diffOrder[i]);
  return sum;
}, N / 100);


// === Case 6: Object literal vs constructor ===
console.log('\n=== Case 6: Object literal (same shape) ===');

var literals = [];
for (var i = 0; i < 100; i++) {
  literals.push({ x: i, y: i * 2 });
}

function readXLiteral(obj) { return obj.x; }
for (var i = 0; i < 100000; i++) readXLiteral(literals[i % 100]);

var tLiteral = bench('literal', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum += readXLiteral(literals[i]);
  return sum;
}, N / 100);


// === Summary ===
console.log('\n=== Summary ===');
console.log(`mono:      ${tMono.toFixed(2)}ms (baseline)`);
console.log(`poly2:     ${tPoly2.toFixed(2)}ms (${((tPoly2/tMono - 1) * 100).toFixed(0)}%)`);
console.log(`poly4:     ${tPoly4.toFixed(2)}ms (${((tPoly4/tMono - 1) * 100).toFixed(0)}%)`);
console.log(`mega:      ${tMega.toFixed(2)}ms (${((tMega/tMono - 1) * 100).toFixed(0)}%)`);
console.log(`diffOrder: ${tDiffOrder.toFixed(2)}ms (${((tDiffOrder/tMono - 1) * 100).toFixed(0)}%)`);
console.log(`literal:   ${tLiteral.toFixed(2)}ms (${((tLiteral/tMono - 1) * 100).toFixed(0)}%)`);

// === RESULTS (node v20.20.0, Linux x86_64) ===
//
// mono:      ~15ms (baseline)
// poly2:     ~15ms (0-8% — negligible)
// poly4:     ~20ms (24-38%)
// mega:      ~55ms (3-4x slower — stable across runs)
// diffOrder: ~14ms (0% — same as mono despite different maps!)
// literal:   ~13ms (same as mono)
//
// === BYTECODE ===
//
// readX bytecode (5 bytes):
//   GetNamedProperty a0, [0], [0]   // feedback slot [0]
//   Return
//
// All readX variants produce IDENTICAL bytecode. The performance difference
// is entirely in TurboFan's speculative optimization based on IC state.
//
// === DEOPTIMIZATION TEST ===
//
// Using %GetOptimizationStatus with --allow-natives-syntax:
//
//   After mono warmup + optimize: status 81 (Optimized)
//   After 2nd shape:              status 1  (Deoptimized!)
//   After 4th shape:              status 32769 (TopmostInterpreted)
//   After 5th+ shapes:            status 32769
//
// Adding a new shape to an already-optimized function TRIGGERS DEOPTIMIZATION.
// V8 falls back to interpreter, then re-optimizes with broader type info.
//
// === KEY FINDINGS ===
//
// FINDING 1: Megamorphic access (8+ shapes) is 3-4x slower than monomorphic.
// This is the biggest hidden performance cliff in JS — an innocent-looking
// obj.x becomes 3-4x slower when the function has seen too many object shapes.
//
// FINDING 2: 2-shape polymorphism is essentially FREE (<10% overhead).
// V8's IC handles 2 shapes nearly as fast as 1. Don't worry about having
// two variants of an object (e.g. with/without optional field).
//
// FINDING 3: 4-shape polymorphism costs ~30%. This is the transition zone
// where V8 starts scanning a small handler cache instead of direct lookup.
//
// FINDING 4: Property order creates different hidden classes ({x,y} != {y,x})
// but the performance impact is only 2-shape polymorphism — negligible.
// Confirmed with %HaveSameMap: returns false. But the IC sees 2 shapes
// and handles them efficiently.
//
// FINDING 5: Object literals share maps. {x: 1, y: 2} created in a loop
// all get the same hidden class. Same performance as constructor-created objects.
//
// FINDING 6: Shape transitions trigger one-time deoptimization. When a function
// optimized for N shapes encounters shape N+1, TurboFan bails out and the
// function falls back to interpreter. It re-optimizes later with broader types.
// The cost is the deopt + recompile, not a permanent slowdown.
//
// PRACTICAL IMPLICATIONS:
// - Keep hot-path objects to 1-2 shapes — it's free
// - Avoid mixing 5+ shapes through the same function (megamorphic = 3-4x penalty)
// - Property order doesn't matter for performance (2-shape poly is free)
// - Constructor vs literal doesn't matter — both create stable shapes
// - The deopt cliff matters: first encounter with a new shape has a spike cost
