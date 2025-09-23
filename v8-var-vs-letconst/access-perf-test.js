(function () {
  var runs = 500_000_000;

  var varVar = 0;
  let letVar = 0;

  function testVar() {
    var i, a;
    for (i = 0; i < runs; i++) {
      varVar++;
      a = varVar;
    }
  }

  function testLetConst() {
    var i, b;
    for (i = 0; i < runs; i++) {
      letVar++;
      b = letVar;
    }
  }

  function measure(name, fn) {
    var start = performance.now();
    fn();
    var end = performance.now();
    console.log(`${name} time: ${(end - start).toFixed(3)} ms`);
  }

  measure("let/const access", testLetConst);
  measure("var access", testVar);
})();

/*
% node --no-opt access-perf-test.js
let/const access time: 3615.846 ms
var access time: 3140.721 ms

% node --no-opt access-perf-test.js
let/const access time: 3624.219 ms
var access time: 3139.686 ms

% node --no-opt access-perf-test.js
let/const access time: 3624.604 ms
var access time: 3140.013 ms

% node --no-opt access-perf-test.js
let/const access time: 3625.581 ms
var access time: 3138.919 ms

------------------------------------------

% d8 --no-opt access-perf-test.js
let/const access time: 867.167 ms
var access time: 783.334 ms

% d8 --no-opt access-perf-test.js
let/const access time: 878.583 ms
var access time: 783.709 ms

% d8 --no-opt access-perf-test.js
let/const access time: 878.541 ms
var access time: 782.958 ms

% d8 --no-opt access-perf-test.js
let/const access time: 879.084 ms
var access time: 788.625 ms
 */
