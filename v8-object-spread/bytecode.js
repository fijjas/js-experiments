#!/usr/bin/env node
/**
 * Bytecode comparison: spread vs Object.assign
 */

function cloneSpread(obj) {
  return { ...obj };
}

function cloneAssign(obj) {
  return Object.assign({}, obj);
}

function overrideSpread(obj) {
  return { ...obj, b: 10 };
}

function extendSpread(obj) {
  return { ...obj, d: 4 };
}

const o = { a: 1, b: 2, c: 3 };
cloneSpread(o);
cloneAssign(o);
overrideSpread(o);
extendSpread(o);
