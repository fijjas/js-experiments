// Performance test: SMI vs HeapNumber, type-stable vs type-changing
// Run: node perf-test.js

function bench(name, fn, iterations) {
  for (var i = 0; i < 1000; i++) fn(); // warmup
  var start = performance.now();
  for (var i = 0; i < iterations; i++) fn();
  var elapsed = performance.now() - start;
  console.log(`${name}: ${elapsed.toFixed(2)}ms (${iterations} iters)`);
}

var N = 10000000;

// Case 1: SMI arithmetic (all values in SMI range)
bench('SMI arithmetic  ', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum += i;
  return sum;
}, N);

// Case 2: HeapNumber arithmetic (overflow to double)
bench('HeapNumber arith ', function() {
  var sum = 2147483647;
  for (var i = 0; i < 100; i++) sum += 0.1;
  return sum;
}, N);

// Case 3: SMI that overflows mid-loop
bench('SMI→Heap overflow', function() {
  var sum = 2147483600;
  for (var i = 0; i < 100; i++) sum += i;
  return sum;
}, N);

// Case 4: Type-stable function (always number)
function addStable(a, b) { return a + b; }
bench('type-stable add ', function() {
  var sum = 0;
  for (var i = 0; i < 100; i++) sum = addStable(sum, i);
  return sum;
}, N);

// Case 5: Type-unstable function (number then string)
function addUnstable(a, b) { return a + b; }
bench('type-unstable add', function() {
  var sum = 0;
  for (var i = 0; i < 50; i++) sum = addUnstable(sum, i);
  sum = addUnstable("x", sum); // type pollution
  return sum;
}, N);

// Case 6: [] vs new Array()
bench('[] empty        ', function() {
  var a = [];
  a.push(1); a.push(2); a.push(3);
  return a;
}, N);

bench('new Array() empty', function() {
  var a = new Array();
  a.push(1); a.push(2); a.push(3);
  return a;
}, N);

// Case 7: Pre-sized Array(n) vs growing []
bench('Array(100) pre  ', function() {
  var a = new Array(100);
  for (var i = 0; i < 100; i++) a[i] = i;
  return a;
}, N / 10);

bench('[] growing to 100', function() {
  var a = [];
  for (var i = 0; i < 100; i++) a.push(i);
  return a;
}, N / 10);
