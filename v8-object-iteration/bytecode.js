#!/usr/bin/env node
/**
 * Bytecode comparison: iteration patterns
 * Run: node --print-bytecode --print-bytecode-filter="*" bytecode.js 2>&1 | less
 */

function withForIn(obj) {
  let sum = 0;
  for (const k in obj) sum += obj[k];
  return sum;
}

function withObjectKeys(obj) {
  let sum = 0;
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) sum += obj[keys[i]];
  return sum;
}

function withEntries(obj) {
  let sum = 0;
  for (const [k, v] of Object.entries(obj)) sum += v;
  return sum;
}

const o = { a: 1, b: 2, c: 3 };
withForIn(o);
withObjectKeys(o);
withEntries(o);
