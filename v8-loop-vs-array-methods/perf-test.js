// Performance benchmark: for-loop vs Array.prototype methods
// Complements bytecode analysis in loop-bytecode.js
// Tests with varying array sizes to see scaling behavior

function bench(name, fn, iterations) {
  // warmup
  for (var i = 0; i < 100; i++) fn();

  var start = performance.now();
  for (var i = 0; i < iterations; i++) fn();
  var elapsed = performance.now() - start;
  console.log(`${name}: ${elapsed.toFixed(2)}ms (${iterations} iterations)`);
  return elapsed;
}

var sizes = [10, 1000, 100000];

for (var size of sizes) {
  var arr = Array.from({length: size}, (_, i) => i);
  var iterations = Math.max(1, Math.floor(1000000 / size));

  console.log(`\n=== Array size: ${size}, iterations: ${iterations} ===`);

  // Case 1: for-loop (no capture)
  bench('for-loop', function() {
    var sum = 0;
    for (var i = 0; i < arr.length; i++) sum += arr[i];
    return sum;
  }, iterations);

  // Case 2: forEach
  bench('forEach ', function() {
    var sum = 0;
    arr.forEach(function(x) { sum += x; });
    return sum;
  }, iterations);

  // Case 3: reduce
  bench('reduce  ', function() {
    return arr.reduce(function(acc, x) { return acc + x; }, 0);
  }, iterations);

  // Case 4: for-of
  bench('for-of  ', function() {
    var sum = 0;
    for (var x of arr) sum += x;
    return sum;
  }, iterations);

  // Case 5: forEach with capture
  bench('forEach+capture', function() {
    var multiplier = 3;
    var sum = 0;
    arr.forEach(function(x) { sum += x * multiplier; });
    return sum;
  }, iterations);

  // Case 6: for-loop with same work
  bench('for+capture    ', function() {
    var multiplier = 3;
    var sum = 0;
    for (var i = 0; i < arr.length; i++) sum += arr[i] * multiplier;
    return sum;
  }, iterations);
}
