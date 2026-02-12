#!/usr/bin/env node
/**
 * Bytecode comparison: optional chaining vs manual checks
 * Run: node --print-bytecode --print-bytecode-filter="*" bytecode.js 2>&1 | less
 */

// Direct access
function direct(obj) {
  return obj.a;
}

// Optional chaining
function optional(obj) {
  return obj?.a;
}

// Manual check
function manual(obj) {
  return obj && obj.a;
}

// Nested direct
function nestedDirect(obj) {
  return obj.b.c;
}

// Nested optional
function nestedOptional(obj) {
  return obj?.b?.c;
}

// Nested manual
function nestedManual(obj) {
  return obj && obj.b && obj.b.c;
}

// Force compilation
const o = { a: 1, b: { c: 2 } };
direct(o);
optional(o);
manual(o);
nestedDirect(o);
nestedOptional(o);
nestedManual(o);
