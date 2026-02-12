#!/usr/bin/env node
/**
 * V8 arguments object vs rest parameters
 *
 * Myth: "arguments is slow, always use rest params"
 * Reality: let's measure.
 *
 * Tests:
 * 1. arguments.length vs ...args.length
 * 2. arguments[i] access vs args[i]
 * 3. Arguments leak (passing arguments to another function)
 * 4. Array.from(arguments) vs rest spread
 * 5. Mixed: some named params + arguments vs named + ...rest
 * 6. arguments in strict mode vs sloppy mode
 */

const N = 10_000_000;

function bench(label, fn) {
  // Warmup
  for (let i = 0; i < 1000; i++) fn(i, i+1, i+2);

  const start = performance.now();
  let result = 0;
  for (let i = 0; i < N; i++) {
    result += fn(i, i+1, i+2);
  }
  const ms = performance.now() - start;
  const opsPerSec = (N / (ms / 1000)).toExponential(2);
  console.log(`  ${label.padEnd(45)} ${ms.toFixed(0).padStart(6)}ms  (${opsPerSec} ops/sec)`);
  return result;
}

console.log(`\n=== V8 arguments vs rest params (N=${N.toLocaleString()}) ===\n`);

// --- Test 1: .length access ---
console.log('--- Test 1: .length ---');

function argsLength() {
  return arguments.length;
}

function restLength(...args) {
  return args.length;
}

bench('arguments.length', argsLength);
bench('...args.length', restLength);

// --- Test 2: indexed access ---
console.log('\n--- Test 2: indexed access ---');

function argsIndex() {
  return arguments[0] + arguments[1] + arguments[2];
}

function restIndex(...args) {
  return args[0] + args[1] + args[2];
}

function namedParams(a, b, c) {
  return a + b + c;
}

bench('arguments[i]', argsIndex);
bench('...args[i]', restIndex);
bench('named params (a, b, c)', namedParams);

// --- Test 3: arguments leak (passing to another function) ---
console.log('\n--- Test 3: arguments leak ---');

function sink(x) { return x.length; }

function argsLeak() {
  return sink(arguments);
}

function restLeak(...args) {
  return sink(args);
}

bench('arguments leak (pass to fn)', argsLeak);
bench('...args leak (pass to fn)', restLeak);

// --- Test 4: converting to array ---
console.log('\n--- Test 4: convert to array ---');

function argsToArray() {
  const arr = Array.from(arguments);
  return arr[0] + arr[1] + arr[2];
}

function argsSlice() {
  const arr = Array.prototype.slice.call(arguments);
  return arr[0] + arr[1] + arr[2];
}

function restAlreadyArray(...args) {
  return args[0] + args[1] + args[2];
}

bench('Array.from(arguments)', argsToArray);
bench('Array.prototype.slice.call(arguments)', argsSlice);
bench('...rest (already array)', restAlreadyArray);

// --- Test 5: mixed named + extra args ---
console.log('\n--- Test 5: named + extra ---');

function namedPlusArguments(a, b) {
  return a + b + arguments[2];
}

function namedPlusRest(a, b, ...rest) {
  return a + b + rest[0];
}

function allNamed(a, b, c) {
  return a + b + c;
}

bench('named(a,b) + arguments[2]', namedPlusArguments);
bench('named(a,b, ...rest) + rest[0]', namedPlusRest);
bench('all named (a, b, c)', allNamed);

// --- Test 6: strict mode ---
console.log('\n--- Test 6: strict mode effect ---');

function argsStrict() {
  'use strict';
  return arguments[0] + arguments[1] + arguments[2];
}

// argsIndex above is sloppy mode
bench('arguments[i] (sloppy mode)', argsIndex);
bench('arguments[i] (strict mode)', argsStrict);

// --- Test 7: arguments with many args ---
console.log('\n--- Test 7: many args (10) ---');

function bench10(label, fn) {
  for (let i = 0; i < 1000; i++) fn(1,2,3,4,5,6,7,8,9,10);

  const start = performance.now();
  let result = 0;
  for (let i = 0; i < N; i++) {
    result += fn(1,2,3,4,5,6,7,8,9,10);
  }
  const ms = performance.now() - start;
  const opsPerSec = (N / (ms / 1000)).toExponential(2);
  console.log(`  ${label.padEnd(45)} ${ms.toFixed(0).padStart(6)}ms  (${opsPerSec} ops/sec)`);
  return result;
}

function args10Sum() {
  let sum = 0;
  for (let i = 0; i < arguments.length; i++) sum += arguments[i];
  return sum;
}

function rest10Sum(...args) {
  let sum = 0;
  for (let i = 0; i < args.length; i++) sum += args[i];
  return sum;
}

function rest10Reduce(...args) {
  return args.reduce((a, b) => a + b, 0);
}

bench10('arguments loop (10 args)', args10Sum);
bench10('...rest loop (10 args)', rest10Sum);
bench10('...rest.reduce (10 args)', rest10Reduce);
