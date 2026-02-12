// V8 prototype chain lookup performance
// Question: how does prototype depth affect property access speed?
//
// V8 uses hidden classes (Maps) that encode the full prototype chain.
// When you access obj.x, V8 checks the inline cache (IC):
//   - Monomorphic: single Map → direct access (fast)
//   - But where is .x? Own property vs prototype vs prototype's prototype?
//
// This experiment measures:
//   1. Own property access (depth 0)
//   2. Prototype access (depth 1, 2, 5, 10)
//   3. Own property shadowing prototype
//   4. Method calls: own closure vs shared fn vs prototype vs class
//   5. ES6 class syntax vs manual prototype
//
// Node.js v20.20.0 / V8 v12
// Run: node v8-prototype-lookup/prototype-depth.js
// Bytecode: node --print-bytecode --print-bytecode-filter='readX' v8-prototype-lookup/prototype-depth.js

// === Helpers ===

function bench(name, fn, iterations) {
  // warmup
  for (var i = 0; i < 1000; i++) fn();

  var start = performance.now();
  for (var i = 0; i < iterations; i++) fn();
  var elapsed = performance.now() - start;
  console.log(name + ': ' + elapsed.toFixed(2) + 'ms');
  return elapsed;
}

var N = 10_000_000;

// === Case 1: Own property (depth 0) ===
console.log('=== Case 1: Own property (depth 0) ===');

function OwnProp() { this.x = 1; }
var ownObjs = [];
for (var i = 0; i < 100; i++) ownObjs.push(new OwnProp());

function readXOwn(obj) { return obj.x; }
for (var i = 0; i < 100000; i++) readXOwn(ownObjs[i % 100]);

var tOwn = bench('own', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum += readXOwn(ownObjs[i]);
  return sum;
}, N / 100);


// === Case 2: Prototype property (depth 1) ===
console.log('\n=== Case 2: Prototype property (depth 1) ===');

function Proto1() {}
Proto1.prototype.x = 1;
var proto1Objs = [];
for (var i = 0; i < 100; i++) proto1Objs.push(new Proto1());

function readXProto1(obj) { return obj.x; }
for (var i = 0; i < 100000; i++) readXProto1(proto1Objs[i % 100]);

var tProto1 = bench('proto1', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum += readXProto1(proto1Objs[i]);
  return sum;
}, N / 100);


// === Case 3: Prototype depth 2 ===
console.log('\n=== Case 3: Prototype depth 2 ===');

function GrandParent() {}
GrandParent.prototype.x = 1;
function Parent2() {}
Parent2.prototype = Object.create(GrandParent.prototype);
Parent2.prototype.constructor = Parent2;

var proto2Objs = [];
for (var i = 0; i < 100; i++) proto2Objs.push(new Parent2());

function readXProto2(obj) { return obj.x; }
for (var i = 0; i < 100000; i++) readXProto2(proto2Objs[i % 100]);

var tProto2 = bench('proto2', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum += readXProto2(proto2Objs[i]);
  return sum;
}, N / 100);


// === Case 4: Prototype depth 5 ===
console.log('\n=== Case 4: Prototype depth 5 ===');

function makeChain(depth) {
  function Base() {}
  Base.prototype.x = 1;
  var current = Base;
  for (var d = 0; d < depth - 1; d++) {
    var Next = function() {};
    Next.prototype = Object.create(current.prototype);
    Next.prototype.constructor = Next;
    current = Next;
  }
  return current;
}

var Chain5 = makeChain(5);
var proto5Objs = [];
for (var i = 0; i < 100; i++) proto5Objs.push(new Chain5());

function readXProto5(obj) { return obj.x; }
for (var i = 0; i < 100000; i++) readXProto5(proto5Objs[i % 100]);

var tProto5 = bench('proto5', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum += readXProto5(proto5Objs[i]);
  return sum;
}, N / 100);


// === Case 5: Prototype depth 10 ===
console.log('\n=== Case 5: Prototype depth 10 ===');

var Chain10 = makeChain(10);
var proto10Objs = [];
for (var i = 0; i < 100; i++) proto10Objs.push(new Chain10());

function readXProto10(obj) { return obj.x; }
for (var i = 0; i < 100000; i++) readXProto10(proto10Objs[i % 100]);

var tProto10 = bench('proto10', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum += readXProto10(proto10Objs[i]);
  return sum;
}, N / 100);


// === Case 6: Own property shadowing prototype ===
console.log('\n=== Case 6: Own property shadowing prototype (depth 1) ===');

function ShadowProto() {}
ShadowProto.prototype.x = 999;
var shadowObjs = [];
for (var i = 0; i < 100; i++) {
  var obj = new ShadowProto();
  obj.x = 1; // shadow the prototype
  shadowObjs.push(obj);
}

function readXShadow(obj) { return obj.x; }
for (var i = 0; i < 100000; i++) readXShadow(shadowObjs[i % 100]);

var tShadow = bench('shadow', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum += readXShadow(shadowObjs[i]);
  return sum;
}, N / 100);


// === Case 7: Method call — own vs prototype ===
console.log('\n=== Case 7: Method on prototype vs own ===');

function MethodOwn() {
  this.val = 1;
  this.getVal = function() { return this.val; };
}
var methOwnObjs = [];
for (var i = 0; i < 100; i++) methOwnObjs.push(new MethodOwn());

function callMethodOwn(obj) { return obj.getVal(); }
for (var i = 0; i < 100000; i++) callMethodOwn(methOwnObjs[i % 100]);

var tMethOwn = bench('method-own', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum += callMethodOwn(methOwnObjs[i]);
  return sum;
}, N / 100);


function MethodProto() { this.val = 1; }
MethodProto.prototype.getVal = function() { return this.val; };
var methProtoObjs = [];
for (var i = 0; i < 100; i++) methProtoObjs.push(new MethodProto());

function callMethodProto(obj) { return obj.getVal(); }
for (var i = 0; i < 100000; i++) callMethodProto(methProtoObjs[i % 100]);

var tMethProto = bench('method-proto', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum += callMethodProto(methProtoObjs[i]);
  return sum;
}, N / 100);


// === Case 7b: Own method — shared function (control) ===
console.log('\n=== Case 7b: Own method — shared function ===');

function sharedGetVal() { return this.val; }
function MethodOwnShared() {
  this.val = 1;
  this.getVal = sharedGetVal; // same function object on every instance
}
var methSharedObjs = [];
for (var i = 0; i < 100; i++) methSharedObjs.push(new MethodOwnShared());

function callMethodShared(obj) { return obj.getVal(); }
for (var i = 0; i < 100000; i++) callMethodShared(methSharedObjs[i % 100]);

var tMethShared = bench('method-own-shared', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum += callMethodShared(methSharedObjs[i]);
  return sum;
}, N / 100);


// === Case 8: class syntax vs manual prototype ===
console.log('\n=== Case 8: ES6 class vs manual prototype ===');

class ClassProto {
  constructor() { this.val = 1; }
  getVal() { return this.val; }
}
// Class x getter is on prototype too — but does the class syntax optimize?
ClassProto.prototype.x = 1;

var classObjs = [];
for (var i = 0; i < 100; i++) classObjs.push(new ClassProto());

function readXClass(obj) { return obj.x; }
for (var i = 0; i < 100000; i++) readXClass(classObjs[i % 100]);

var tClass = bench('class-proto', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum += readXClass(classObjs[i]);
  return sum;
}, N / 100);

function callMethodClass(obj) { return obj.getVal(); }
for (var i = 0; i < 100000; i++) callMethodClass(classObjs[i % 100]);

var tClassMeth = bench('class-method', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum += callMethodClass(classObjs[i]);
  return sum;
}, N / 100);


// === Summary ===
console.log('\n=== Summary ===');
console.log('Property access by prototype depth:');
console.log('  own (depth 0):    ' + tOwn.toFixed(2) + 'ms (baseline)');
console.log('  proto (depth 1):  ' + tProto1.toFixed(2) + 'ms (' + ((tProto1/tOwn - 1) * 100).toFixed(0) + '%)');
console.log('  proto (depth 2):  ' + tProto2.toFixed(2) + 'ms (' + ((tProto2/tOwn - 1) * 100).toFixed(0) + '%)');
console.log('  proto (depth 5):  ' + tProto5.toFixed(2) + 'ms (' + ((tProto5/tOwn - 1) * 100).toFixed(0) + '%)');
console.log('  proto (depth 10): ' + tProto10.toFixed(2) + 'ms (' + ((tProto10/tOwn - 1) * 100).toFixed(0) + '%)');
console.log('  shadow (own+proto): ' + tShadow.toFixed(2) + 'ms (' + ((tShadow/tOwn - 1) * 100).toFixed(0) + '%)');
console.log();
console.log('Method calls:');
console.log('  own method (closure/instance): ' + tMethOwn.toFixed(2) + 'ms');
console.log('  own method (shared fn):        ' + tMethShared.toFixed(2) + 'ms (' + ((tMethShared/tMethOwn - 1) * 100).toFixed(0) + '%)');
console.log('  proto method:                  ' + tMethProto.toFixed(2) + 'ms (' + ((tMethProto/tMethOwn - 1) * 100).toFixed(0) + '%)');
console.log('  class method:                  ' + tClassMeth.toFixed(2) + 'ms (' + ((tClassMeth/tMethOwn - 1) * 100).toFixed(0) + '%)');
console.log();
console.log('Class syntax:');
console.log('  class proto .x: ' + tClass.toFixed(2) + 'ms (' + ((tClass/tOwn - 1) * 100).toFixed(0) + '%)');

// === RESULTS (node v20.20.0, Linux x86_64) ===
//
// Property access — prototype depth is FREE:
//   own (depth 0):     ~14-18ms (baseline)
//   proto (depth 1):   ~14-17ms (within noise)
//   proto (depth 2):   ~13-15ms (within noise)
//   proto (depth 5):   ~13-16ms (within noise)
//   proto (depth 10):  ~13-14ms (within noise)
//   shadow (own+proto): ~13-15ms (within noise)
//
// V8 caches the resolved property location in the IC feedback slot.
// Once TurboFan compiles, it emits a direct load from the cached offset.
// Chain depth doesn't matter — the IC resolves once, then it's a direct access.
//
// Method calls — closure-per-instance is the real penalty:
//   own method (closure/instance): ~20-23ms (SLOWEST)
//   own method (shared fn):        ~14-15ms (-30%)
//   proto method:                  ~13-15ms (-33%)
//   class method:                  ~13-16ms (-33%)
//
// The 30% overhead of closure-per-instance comes from:
//   1. Each instance has a different closure object for getVal
//   2. The IC sees same Map but different function targets
//   3. TurboFan can't inline: which function to inline when each call
//      goes to a different closure? (Same SharedFunctionInfo, different Context)
//   4. With shared function or prototype method: single function target,
//      TurboFan inlines confidently
//
// === BYTECODE ===
//
// All readX variants (own, proto1, proto2, ...) produce IDENTICAL bytecode:
//   GetNamedProperty a0, [0], [0]   // feedback slot [0]
//   Return
//
// All callMethod variants produce IDENTICAL bytecode:
//   GetNamedProperty a0, [0], [0]   // load .getVal
//   Star0
//   CallProperty0 r0, a0, [2]       // call with this=obj
//   Return
//
// Performance differences are entirely in the IC/TurboFan layer.
//
// === KEY FINDINGS ===
//
// FINDING 1: Prototype chain depth is FREE. Accessing obj.x at depth 10
// is the same speed as own property access. V8's IC resolves the full chain
// once and caches the result. Don't flatten prototype chains for "performance."
//
// FINDING 2: Closure-per-instance methods are 30% slower than prototype methods.
// `this.fn = function(){}` in constructors creates N function objects for N instances.
// Even though all share SharedFunctionInfo, TurboFan can't inline through
// varying closure targets. Use prototype methods or class methods instead.
//
// FINDING 3: Class methods = prototype methods = shared function on own property.
// All are equivalent in performance. ES6 class syntax is not special — it's just
// syntactic sugar for prototype assignment. No V8 magic for classes.
//
// FINDING 4: Own property shadowing a prototype value has no performance cost.
// V8 resolves to the own property and caches that — the shadowed prototype
// value doesn't cause overhead.
//
// PRACTICAL IMPLICATIONS:
// - Never flatten prototype chains for performance — depth is free
// - Always use prototype/class methods instead of this.fn = function(){}
// - If you must use own methods, assign a shared function, not a new closure
// - Class syntax offers no performance advantage — just ergonomics
// - The real performance axis is shapes (hidden classes experiment), not depth
