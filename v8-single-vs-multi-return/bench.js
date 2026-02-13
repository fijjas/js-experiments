// V8 performance: single return vs multiple returns
// Question: does the number of return statements affect optimization?
// Run: node bench.js
//   node --no-opt bench.js
//   node --max-opt=maglev bench.js
// (default = TurboFan)

function bench(name, fn, iterations) {
  // warmup: enough iterations to trigger optimization
  for (let i = 0; i < 10000; i++) fn(i % 100, i % 50);
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn(i % 100, i % 50);
  const elapsed = performance.now() - start;
  console.log(`${name}: ${elapsed.toFixed(2)}ms`);
  return elapsed;
}

const N = 20_000_000;

// === Test 1: Simple classification (return category based on value) ===

// Multiple returns — early exit pattern
function classifyMulti(x, y) {
  const val = x * y;
  if (val < 100) return 'small';
  if (val < 1000) return 'medium';
  if (val < 5000) return 'large';
  return 'huge';
}

// Single return — accumulate result
function classifySingle(x, y) {
  const val = x * y;
  let result;
  if (val < 100) result = 'small';
  else if (val < 1000) result = 'medium';
  else if (val < 5000) result = 'large';
  else result = 'huge';
  return result;
}

// === Test 2: Numeric computation with guard clauses ===

// Multiple returns — guard clause pattern
function computeMulti(x, y) {
  if (x === 0) return 0;
  if (y === 0) return 0;
  if (x < 0) return -((-x) * y + x);
  return x * y + x;
}

// Single return — unified path
function computeSingle(x, y) {
  let result;
  if (x === 0) result = 0;
  else if (y === 0) result = 0;
  else if (x < 0) result = -((-x) * y + x);
  else result = x * y + x;
  return result;
}

// === Test 3: Validation with many exit points ===

// Multiple returns — validator pattern
function validateMulti(x, y) {
  if (x < 0) return false;
  if (x > 1000) return false;
  if (y < 0) return false;
  if (y > 1000) return false;
  if (x + y > 1500) return false;
  if (x * y > 500000) return false;
  return true;
}

// Single return — single exit
function validateSingle(x, y) {
  let valid = true;
  if (x < 0) valid = false;
  else if (x > 1000) valid = false;
  else if (y < 0) valid = false;
  else if (y > 1000) valid = false;
  else if (x + y > 1500) valid = false;
  else if (x * y > 500000) valid = false;
  return valid;
}

// === Test 4: Deeply nested with early returns ===

// Multiple returns — deep nesting early exit
function processMulti(x, y) {
  const sum = x + y;
  if (sum < 10) {
    if (x > y) return sum * 2;
    return sum * 3;
  }
  if (sum < 100) {
    if (x > y) return sum + x;
    return sum + y;
  }
  if (x > y) return sum - x;
  return sum - y;
}

// Single return — deep nesting single exit
function processSingle(x, y) {
  const sum = x + y;
  let result;
  if (sum < 10) {
    if (x > y) result = sum * 2;
    else result = sum * 3;
  } else if (sum < 100) {
    if (x > y) result = sum + x;
    else result = sum + y;
  } else {
    if (x > y) result = sum - x;
    else result = sum - y;
  }
  return result;
}

// === Run benchmarks ===

console.log(`\nV8 Single Return vs Multiple Returns`);
console.log(`Node ${process.version}, ${N.toLocaleString()} iterations`);
console.log(`Flags: ${process.execArgv.join(' ') || '(default — TurboFan)'}`);
console.log('='.repeat(55));

console.log('\n--- Classification (string return) ---');
const t1m = bench('multi-return ', classifyMulti, N);
const t1s = bench('single-return', classifySingle, N);
console.log(`  ratio: ${(t1m / t1s).toFixed(3)}x`);

console.log('\n--- Numeric computation (guard clauses) ---');
const t2m = bench('multi-return ', computeMulti, N);
const t2s = bench('single-return', computeSingle, N);
console.log(`  ratio: ${(t2m / t2s).toFixed(3)}x`);

console.log('\n--- Validation (many exits vs one) ---');
const t3m = bench('multi-return ', validateMulti, N);
const t3s = bench('single-return', validateSingle, N);
console.log(`  ratio: ${(t3m / t3s).toFixed(3)}x`);

console.log('\n--- Deep nesting (branchy logic) ---');
const t4m = bench('multi-return ', processMulti, N);
const t4s = bench('single-return', processSingle, N);
console.log(`  ratio: ${(t4m / t4s).toFixed(3)}x`);

console.log('\n(ratio < 1 = multi is faster, > 1 = single is faster)');
