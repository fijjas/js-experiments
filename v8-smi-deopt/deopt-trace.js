// Deoptimization trace: type-stable vs type-changing
// Run: node --trace-deopt deopt-trace.js

// Type-stable function — should stay optimized
function stableAdd(a, b) {
  return a + b;
}

// Warm up with numbers only → TurboFan optimizes for number+number
for (var i = 0; i < 100000; i++) stableAdd(i, i + 1);

// Now call with string → should trigger deoptimization
console.log("=== Calling stableAdd with string (should deopt) ===");
stableAdd("hello", " world");

// SMI overflow test
function increment(x) {
  return x + 1;
}

// Warm up with SMI values
for (var i = 0; i < 100000; i++) increment(i % 1000);

// Now call with value near SMI boundary
console.log("=== Calling increment near SMI boundary ===");
console.log(increment(2147483646)); // 2^31 - 2, result = 2^31 - 1 (max SMI)
console.log(increment(2147483647)); // 2^31 - 1, result = 2^31 (overflow!)
