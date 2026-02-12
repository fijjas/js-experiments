/**
 * TDZ check elimination test.
 *
 * Hypothesis: V8's ThrowReferenceErrorIfHole checks appear in bytecode
 * when `let` is accessed from a closure (function reading outer scope).
 * When `let` is local, V8 can prove it's initialized and skip TDZ checks.
 *
 * Three tests:
 * 1. var in outer scope (closure) — baseline, no TDZ checks
 * 2. let in outer scope (closure) — has TDZ checks (from previous experiment)
 * 3. let local to function — hypothesis: no TDZ checks, same speed as var
 *
 * Run: node --no-opt tdz-closure-test.js
 * Run: node tdz-closure-test.js  (with TurboFan)
 * Bytecode: node --print-bytecode --print-bytecode-filter="testVarClosure|testLetClosure|testLetLocal" tdz-closure-test.js
 */
(function () {
  var runs = 500_000_000;

  // --- Test 1: var in outer scope (closure access) ---
  var varOuter = 0;
  function testVarClosure() {
    var i, a;
    for (i = 0; i < runs; i++) {
      varOuter++;
      a = varOuter;
    }
  }

  // --- Test 2: let in outer scope (closure access) ---
  let letOuter = 0;
  function testLetClosure() {
    var i, b;
    for (i = 0; i < runs; i++) {
      letOuter++;
      b = letOuter;
    }
  }

  // --- Test 3: let local to function (no closure) ---
  function testLetLocal() {
    let letInner = 0;
    var i, c;
    for (i = 0; i < runs; i++) {
      letInner++;
      c = letInner;
    }
  }

  function measure(name, fn) {
    var start = performance.now();
    fn();
    var end = performance.now();
    console.log(`${name}: ${(end - start).toFixed(3)} ms`);
  }

  // Warmup
  measure("warmup (ignore)", testVarClosure);

  console.log("---");
  measure("var outer (closure)", testVarClosure);
  measure("let outer (closure)", testLetClosure);
  measure("let local (no closure)", testLetLocal);
  console.log("---");
  measure("var outer (closure)", testVarClosure);
  measure("let outer (closure)", testLetClosure);
  measure("let local (no closure)", testLetLocal);
})();
