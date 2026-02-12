// V8 bytecode comparison: for-loop vs Array.prototype methods
// Question (Egor): does V8 parallelize native array methods internally?
// Hypothesis: No — ECMAScript spec requires sequential callback invocation.
// But: the bytecode overhead of method calls vs raw loops might differ.
// Node.js v20.20.0 / V8 v12
// Run: node --print-bytecode loop-bytecode.js 2>&1 | grep -B2 -A35 'function: forLoop\b\|function: forEachClean\b\|...'

var arr = [1, 2, 3, 4, 5];
var result;

// === CASE 1: No captures — pure iteration ===

// Case 1a: for-loop, no capture
function forLoop(a) {
  var sum = 0;
  for (var i = 0; i < a.length; i++) {
    sum += a[i];
  }
  return sum;
}
result = forLoop(arr);

/* forLoop bytecode (37 bytes):
  LdaZero / Star0                        // sum = 0
  LdaZero / Star1                        // i = 0
  GetNamedProperty a0, [length]          // a.length
  TestLessThan r1                        // i < a.length
  JumpIfFalse → return
  Ldar r1 / GetKeyedProperty a0          // a[i]
  Add r0 / Star0                         // sum += a[i]
  Inc / Star1 / JumpLoop                 // i++
  Ldar r0 / Return
  ALL INLINE — no function calls, no context allocation.
*/

// Case 1b: forEach, no capture
function forEachClean(a) {
  var sum = 0;
  a.forEach(function(x) { sum += x; });
  return sum;
}
result = forEachClean(arr);

/* forEachClean bytecode (26 bytes + 12 bytes callback):
  CreateFunctionContext [0], [1]     // context needed because callback mutates sum
  PushContext r0
  StaCurrentContextSlot [2]         // sum in context (mutable!)
  GetNamedProperty a0, [forEach]    // lookup .forEach
  CreateClosure [2], [0], #2        // create callback closure
  CallProperty1 r1, a0, r3          // a.forEach(callback)
  LdaCurrentContextSlot [2]         // load sum from context
  Return

  Callback (12 bytes):
  LdaCurrentContextSlot [2]         // load sum (MUTABLE — not immutable!)
  Star0 / Ldar a0 / Add r0          // sum + x
  StaCurrentContextSlot [2]         // store back
  Return
*/

// Case 1c: map, no capture (just to see overhead)
function mapClean(a) {
  return a.map(function(x) { return x * 2; });
}
result = mapClean(arr);

/* mapClean bytecode (16 bytes + 6 bytes callback):
  GetNamedProperty a0, [map]        // lookup .map
  CreateClosure [1], [0], #2        // create callback
  CallProperty1 r0, a0, r2          // a.map(callback)
  Return

  Callback (6 bytes) — no context needed, pure function:
  Ldar a0 / MulSmi [2] / Return
*/

// === CASE 2: Callback captures external variable ===

// Case 2a: forEach with external capture
function forEachCapture(a) {
  var multiplier = 3;
  var sum = 0;
  a.forEach(function(x) { sum += x * multiplier; });
  return sum;
}
result = forEachCapture(arr);

/* forEachCapture bytecode (30 bytes + 15 bytes callback):
  CreateFunctionContext [0], [2]     // context for multiplier + sum
  StaCurrentContextSlot [2]         // multiplier
  StaCurrentContextSlot [3]         // sum
  ... same pattern as forEachClean but 2 context slots

  Callback (15 bytes):
  LdaCurrentContextSlot [3]         // load sum (mutable)
  LdaImmutableCurrentContextSlot[2] // load multiplier (IMMUTABLE — V8 notices!)
  Mul a0 / Add / StaCurrentContextSlot [3]
*/

// Case 2b: map with external capture
function mapCapture(a) {
  var multiplier = 3;
  return a.map(function(x) { return x * multiplier; });
}
result = mapCapture(arr);

/* mapCapture bytecode (25 bytes + 6 bytes callback):
  CreateFunctionContext [0], [1]     // context for multiplier only
  StaCurrentContextSlot [2]         // multiplier

  Callback (6 bytes):
  LdaImmutableCurrentContextSlot[2] // multiplier (immutable)
  Mul a0 / Return
*/

// === CASE 3: Accumulation — reduce vs for ===

// Case 3a: for-loop accumulator
function forAccum(a) {
  var sum = 0;
  for (var i = 0; i < a.length; i++) {
    sum += a[i];
  }
  return sum;
}
result = forAccum(arr);

/* forAccum: IDENTICAL to forLoop (37 bytes). Same inline loop. */

// Case 3b: reduce
function reduceAccum(a) {
  return a.reduce(function(acc, x) { return acc + x; }, 0);
}
result = reduceAccum(arr);

/* reduceAccum bytecode (19 bytes + 6 bytes callback):
  GetNamedProperty a0, [reduce]     // lookup .reduce
  CreateClosure [1], [0], #2        // create callback
  LdaZero / Star3                   // initial value 0
  CallProperty2 r0, a0, r2, r3     // a.reduce(callback, 0)
  Return

  Callback (6 bytes) — pure, no context:
  Ldar a1 / Add a0 / Return        // acc + x
*/

// === FINDINGS ===
//
// FINDING 1: V8 does NOT parallelize Array.prototype methods.
// forEach/map/reduce call the callback function sequentially per element.
// Bytecode confirms: CallProperty1/CallProperty2 — standard JS function dispatch.
// The ECMAScript spec mandates sequential invocation.
//
// FINDING 2: for-loop is 5-10x faster than forEach/reduce at scale.
// Performance at 100k elements: for-loop ~1ms, for-of ~1.3ms, forEach ~11ms, reduce ~18ms
// Root cause: per-element function call overhead. for-loop inlines everything
// as JumpLoop; forEach/reduce dispatch a callback via CallProperty per element.
//
// FINDING 3: The performance gap DISAPPEARS at small arrays (n=10).
// With small arrays, TurboFan inlines callback calls. At n=10 all methods
// are within 30% of each other. The overhead only manifests at scale.
//
// FINDING 4: for-of is nearly as fast as for-loop (within 10-30%).
// Despite using iterators, V8 optimizes for-of on arrays to near-loop speed.
//
// FINDING 5: Variable capture doesn't significantly affect method call performance.
// forEach with capture (~11ms) vs without (~11ms) at 100k elements — same.
// The context allocation cost is fixed per parent invocation, not per callback call.
// But for-loop capture IS slightly slower (~2ms vs ~1ms) due to context slot access.
//
// FINDING 6: V8 correctly distinguishes mutable vs immutable captures.
// In forEachCapture: sum uses LdaCurrentContextSlot (mutable — modified in callback).
// multiplier uses LdaImmutableCurrentContextSlot (immutable — only read).
// This is an optimization — immutable slots are cheaper to access.
//
// FINDING 7: reduce's callback is pure (no context) but reduce is STILL the slowest.
// reduce callback: 6 bytes, no CreateFunctionContext. Yet reduce is 50-70% slower than
// forEach. Likely cause: CallProperty2 (3 args: receiver, acc, x) vs CallProperty1 (2 args).
// Each extra argument adds dispatch overhead per element.
//
// SUMMARY: Choose for-loop or for-of in hot paths. forEach/map/reduce are fine
// for small arrays or non-hot code. The bottleneck is per-element function dispatch,
// not parallelization or capture overhead.
//
// See perf-test.js for benchmark numbers.
