// V8 bytecode comparison: arrow vs regular function `this` binding
// Follow-up to closure-bytecode.js Finding 3 (unverified → now verified)
// Hypothesis: arrow `this` uses context slot, regular uses receiver
// Node.js v20.20.0 / V8 v12
// Run: node --print-bytecode this-binding-bytecode.js 2>&1 | grep -B2 -A25 'SharedFunctionInfo.*\(ArrowThis\|RegularThis\|MethodThis\)'

// Case 1: Arrow function accessing `this` (captures via context)
function ArrowThis() {
  this.val = 42;
  this.get = () => this.val;
}
var a = new ArrowThis();
a.get();

/* ArrowThis constructor bytecode (31 bytes):
  CreateFunctionContext [0], [1]       // allocate context for `this`
  PushContext r0
  Ldar <this>
  StaCurrentContextSlot [2]           // store `this` in context slot 2
  LdaImmutableCurrentContextSlot [2]  // load `this` from context
  Star1
  LdaSmi [42]
  SetNamedProperty r1, [val], [0]     // this.val = 42
  LdaImmutableCurrentContextSlot [2]  // load `this` from context again
  Star1
  CreateClosure [2], [0], #1          // create arrow closure
  SetNamedProperty r1, [get], [2]     // this.get = arrow
  LdaUndefined
  Return
*/

/* ArrowThis.get bytecode (8 bytes):
  LdaImmutableCurrentContextSlot [2]  // load parent's `this` from context
  Star0
  GetNamedProperty r0, [val], [0]     // .val
  Return
*/

// Case 2: Regular function accessing `this` (uses own receiver)
function RegularThis() {
  this.val = 42;
  this.get = function() { return this.val; };
}
var b = new RegularThis();
b.get();

/* RegularThis constructor bytecode (16 bytes):
  LdaSmi [42]
  SetNamedProperty <this>, [val], [0]   // this.val = 42 — uses <this> directly
  CreateClosure [1], [0], #1
  SetNamedProperty <this>, [get], [2]   // this.get = function — uses <this> directly
  LdaUndefined
  Return
*/

/* RegularThis.get bytecode (5 bytes):
  GetNamedProperty <this>, [val], [0]   // accesses its OWN receiver's .val
  Return
*/

// Case 3: Method on prototype (same as regular function)
function MethodThis() {
  this.val = 42;
}
MethodThis.prototype.get = function() { return this.val; };
var c = new MethodThis();
c.get();

/* MethodThis constructor bytecode (8 bytes):
  LdaSmi [42]
  SetNamedProperty <this>, [val], [0]
  LdaUndefined
  Return
*/

/* MethodThis.get bytecode (5 bytes) — IDENTICAL to RegularThis.get:
  GetNamedProperty <this>, [val], [0]
  Return
*/

// === FINDING 3 VERIFIED: Arrow and regular functions use DIFFERENT bytecode for `this`
//
// Arrow function `this`:
//   Constructor: CreateFunctionContext + StaCurrentContextSlot (stores `this` in context)
//   Inner:       LdaImmutableCurrentContextSlot (loads `this` from parent context)
//   Cost: 31 bytes constructor, 8 bytes inner
//
// Regular function `this`:
//   Constructor: uses <this> register directly (no context allocation needed)
//   Inner:       uses <this> register directly (its own receiver)
//   Cost: 16 bytes constructor, 5 bytes inner
//
// IMPLICATIONS:
// 1. Arrow `this` binding has REAL bytecode overhead: context allocation + slot access
// 2. Regular function avoids CreateFunctionContext entirely when only `this` is used
// 3. The arrow function's `this` is just a captured variable — V8 treats it identically
//    to any other closure capture (same as `a` in closure-bytecode.js)
// 4. Regular function and prototype method produce IDENTICAL inner bytecode
// 5. This is the ONLY bytecode difference between arrow and regular functions.
//    For captured variables: identical (Finding 1). For `this`: different mechanisms.
