#!/usr/bin/env node
/**
 * Bytecode comparison: arguments vs rest params
 * Run: node --print-bytecode --print-bytecode-filter="*" bytecode.js 2>&1 | less
 *
 * Minimal functions for clear bytecode comparison.
 */

// arguments access
function withArgs() {
  return arguments[0] + arguments[1];
}

// rest params
function withRest(...args) {
  return args[0] + args[1];
}

// named params
function withNamed(a, b) {
  return a + b;
}

// named + arguments[2]
function namedPlusArgs(a, b) {
  return a + b + arguments[2];
}

// named + ...rest
function namedPlusRest(a, b, ...rest) {
  return a + b + rest[0];
}

// .length
function argsLength() {
  return arguments.length;
}

function restLength(...args) {
  return args.length;
}

// Force compilation
withArgs(1, 2);
withRest(1, 2);
withNamed(1, 2);
namedPlusArgs(1, 2, 3);
namedPlusRest(1, 2, 3);
argsLength(1, 2, 3);
restLength(1, 2, 3);
