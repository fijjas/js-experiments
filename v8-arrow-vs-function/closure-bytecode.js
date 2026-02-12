// V8 bytecode comparison: arrow function vs regular function in closure context
// Question: do they generate different bytecode for variable capture?
// Node.js v20.20.0 / V8 v12
// Run: node --print-bytecode v8-arrow-vs-function/closure-bytecode.js 2>&1 | grep -A15 'parentFunc\|parentArrow\|childFunc\|NoCapture'

// Case 1: Regular function capturing parent variable
function parentFunc(a) {
  return function childFunc(b) { return a + b; };
}
parentFunc(5)(2);

/* parentFunc bytecode (14 bytes):
  CreateFunctionContext [0], [1]    // allocate context for 'a'
  PushContext r0
  Ldar a0
  StaCurrentContextSlot [2]        // store 'a' in context slot 2
  CreateClosure [1], [0], #2       // create childFunc closure
  Return
*/

/* childFunc bytecode (9 bytes):
  LdaImmutableCurrentContextSlot [2]  // load 'a' from parent context
  Star0
  Ldar a0                             // load 'b' from argument
  Add r0, [0]
  Return
*/

// Case 2: Arrow function capturing parent variable
function parentArrow(a) {
  return (b) => a + b;
}
parentArrow(5)(2);

/* parentArrow bytecode (14 bytes) — IDENTICAL to parentFunc:
  CreateFunctionContext [0], [1]
  PushContext r0
  Ldar a0
  StaCurrentContextSlot [2]
  CreateClosure [1], [0], #2
  Return
*/

/* Arrow inner bytecode (9 bytes) — IDENTICAL to childFunc:
  LdaImmutableCurrentContextSlot [2]
  Star0
  Ldar a0
  Add r0, [0]
  Return
*/

// === FINDING 1: Arrow and regular functions produce IDENTICAL bytecode
// === for closure variable capture. No optimization difference.

// Case 3: Arrow function NOT capturing anything
function parentArrowNoCapture() {
  const x = 10;
  return (b) => b * 2;
}
parentArrowNoCapture()(3);

/* parentArrowNoCapture bytecode (8 bytes):
  LdaSmi [10]              // const x = 10 (dead code, kept)
  Star0
  CreateClosure [0], [0], #2   // NO CreateFunctionContext — nothing captured
  Return
*/

// Case 4: Regular function NOT capturing anything
function parentRegularNoCapture() {
  const x = 10;
  return function childNoCapture(b) { return b * 2; };
}
parentRegularNoCapture()(3);

/* parentRegularNoCapture bytecode (8 bytes) — IDENTICAL to Case 3:
  LdaSmi [10]
  Star0
  CreateClosure [0], [0], #2
  Return
*/

// === FINDING 2: V8 skips CreateFunctionContext when child doesn't capture.
// === Context allocation is the real overhead, not closure creation itself.
// === This explains why empty closures still have SOME overhead (CreateClosure)
// === but not the full context chain overhead.

// Case 5: Arrow function with `this` (arrow inherits this, regular doesn't)
function parentThis() {
  this.val = 42;
  const getArrow = () => this.val;
  const getRegular = function() { return this.val; };
  return { getArrow, getRegular };
}
new parentThis();

// === FINDING 3 (VERIFIED in this-binding-bytecode.js): Arrow `this` uses context slot
// === (receiver stored in parent context), while regular function
// === uses its own receiver. Different bytecode paths for `this`.
// === Arrow: 31 bytes constructor + 8 bytes inner. Regular: 16 + 5 bytes.

// SUMMARY:
// - Arrow vs regular: IDENTICAL bytecode for captured variables
// - No capture: V8 skips context allocation (8 bytes vs 14 bytes parent)
// - The cost hierarchy: CreateFunctionContext > CreateClosure > LdaSmi
// - Arrow `this` binding is the only bytecode difference (context vs receiver)
