#!/usr/bin/env node
/**
 * Bytecode comparison: delete vs alternatives
 * Run: node --print-bytecode --print-bytecode-filter="*" bytecode.js 2>&1 | less
 */

// Baseline: create and access
function baseline() {
  const obj = { a: 1, b: 2, c: 3 };
  return obj.a + obj.c;
}

// delete then access
function withDelete() {
  const obj = { a: 1, b: 2, c: 3 };
  delete obj.b;
  return obj.a + obj.c;
}

// set undefined then access
function withUndefined() {
  const obj = { a: 1, b: 2, c: 3 };
  obj.b = undefined;
  return obj.a + obj.c;
}

// destructure rest
function withRest() {
  const obj = { a: 1, b: 2, c: 3 };
  const { b, ...rest } = obj;
  return rest.a + rest.c;
}

// Force compilation
baseline();
withDelete();
withUndefined();
withRest();
