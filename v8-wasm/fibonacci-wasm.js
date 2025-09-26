var fs = require('node:fs/promises');

(async () => {
  var wasmBuffer = await fs.readFile('./fibonacci.wasm');
  var wasmModule = await WebAssembly.compile(wasmBuffer);
  var instance = await WebAssembly.instantiate(wasmModule);
  var fibonacci = instance.exports.fibonacci;

  var start = Date.now();
  var maxIterations = 1_000_000_000;
  var result = fibonacci(maxIterations);
  var end = Date.now();
  console.log('Fibonacci result:', result, ' Time (js): ', ((end-start)/1_000).toFixed(3), 's');
})();
