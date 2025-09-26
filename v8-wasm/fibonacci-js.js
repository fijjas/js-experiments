function fibonacci(maxIterations) {
  var a = 0;
  var b = 1;
  var c = 0;
  for (var i = 0; i < maxIterations; i++) {
    c = (a + b) ^ 0xFF; // avoid de-optimizing because of reaching max Smi (2_147_483_647 (64bit))
    a = b;
    b = c;
  }
  return c;
}

(() => {
  var start = Date.now();
  var maxIterations = 1_000_000_000;
  var result = fibonacci(maxIterations);
  var end = Date.now();
  console.log('Fibonacci result:', result, ' Time (js): ', ((end-start)/1_000).toFixed(3), 's');
})();
