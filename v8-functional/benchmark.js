// V8 Functional Patterns Benchmark
// Currying, partial application, pipe, compose — what's the real cost?

const N = 1_000_000;

function time(label, fn) {
  const runs = [];
  // Warmup
  for (let i = 0; i < 3; i++) fn();
  // Measure
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    fn();
    runs.push(performance.now() - start);
  }
  runs.sort((a, b) => a - b);
  const median = runs[2];
  return { label, median: Math.round(median * 10) / 10 };
}

// =============================================================
// 1. Currying
// =============================================================

// Direct call (baseline)
function addDirect(a, b, c) { return a + b + c; }

// Manual curry
function addCurried(a) {
  return function(b) {
    return function(c) {
      return a + b + c;
    };
  };
}

// Generic curry (what lodash/ramda do)
function curry(fn) {
  const arity = fn.length;
  return function curried(...args) {
    if (args.length >= arity) return fn(...args);
    return (...more) => curried(...args, ...more);
  };
}
const addGenericCurry = curry(addDirect);

// Arrow curry (most common in modern JS)
const addArrow = a => b => c => a + b + c;

console.log('=== CURRYING ===');

const r1 = time('direct call', () => {
  let s = 0;
  for (let i = 0; i < N; i++) s += addDirect(1, 2, 3);
  return s;
});

const r2 = time('manual curry (3 calls)', () => {
  let s = 0;
  for (let i = 0; i < N; i++) s += addCurried(1)(2)(3);
  return s;
});

const r3 = time('generic curry (3 calls)', () => {
  let s = 0;
  for (let i = 0; i < N; i++) s += addGenericCurry(1)(2)(3);
  return s;
});

const r4 = time('arrow curry (3 calls)', () => {
  let s = 0;
  for (let i = 0; i < N; i++) s += addArrow(1)(2)(3);
  return s;
});

// Partial application via curry (common pattern: reuse first arg)
const add1 = addCurried(1);
const r5 = time('partial (pre-bound first arg)', () => {
  let s = 0;
  for (let i = 0; i < N; i++) s += add1(2)(3);
  return s;
});

console.log(`${r1.label}: ${r1.median}ms`);
console.log(`${r2.label}: ${r2.median}ms (${(r2.median/r1.median).toFixed(1)}x)`);
console.log(`${r3.label}: ${r3.median}ms (${(r3.median/r1.median).toFixed(1)}x)`);
console.log(`${r4.label}: ${r4.median}ms (${(r4.median/r1.median).toFixed(1)}x)`);
console.log(`${r5.label}: ${r5.median}ms (${(r5.median/r1.median).toFixed(1)}x)`);

// =============================================================
// 2. Partial Application
// =============================================================

console.log('\n=== PARTIAL APPLICATION ===');

function multiply(a, b) { return a * b; }

// bind
const double_bind = multiply.bind(null, 2);

// closure
const double_closure = b => multiply(2, b);

// generic partial
function partial(fn, ...preset) {
  return (...later) => fn(...preset, ...later);
}
const double_partial = partial(multiply, 2);

const p1 = time('direct multiply(2, x)', () => {
  let s = 0;
  for (let i = 0; i < N; i++) s += multiply(2, i);
  return s;
});

const p2 = time('bind partial', () => {
  let s = 0;
  for (let i = 0; i < N; i++) s += double_bind(i);
  return s;
});

const p3 = time('closure partial', () => {
  let s = 0;
  for (let i = 0; i < N; i++) s += double_closure(i);
  return s;
});

const p4 = time('generic partial(...)', () => {
  let s = 0;
  for (let i = 0; i < N; i++) s += double_partial(i);
  return s;
});

console.log(`${p1.label}: ${p1.median}ms`);
console.log(`${p2.label}: ${p2.median}ms (${(p2.median/p1.median).toFixed(1)}x)`);
console.log(`${p3.label}: ${p3.median}ms (${(p3.median/p1.median).toFixed(1)}x)`);
console.log(`${p4.label}: ${p4.median}ms (${(p4.median/p1.median).toFixed(1)}x)`);

// =============================================================
// 3. Pipe / Compose
// =============================================================

console.log('\n=== PIPE / COMPOSE ===');

const inc = x => x + 1;
const dbl = x => x * 2;
const sqr = x => x * x;
const neg = x => -x;

// Direct chain (baseline)
const c1 = time('direct chain: neg(sqr(dbl(inc(x))))', () => {
  let s = 0;
  for (let i = 0; i < N; i++) s += neg(sqr(dbl(inc(i))));
  return s;
});

// reduce-based pipe (standard implementation)
function pipe(...fns) {
  return x => fns.reduce((v, f) => f(v), x);
}
const piped = pipe(inc, dbl, sqr, neg);

const c2 = time('pipe (reduce)', () => {
  let s = 0;
  for (let i = 0; i < N; i++) s += piped(i);
  return s;
});

// Manual unrolled pipe (what you'd write by hand)
const pipedManual = x => neg(sqr(dbl(inc(x))));
const c3 = time('manual pipe (arrow fn)', () => {
  let s = 0;
  for (let i = 0; i < N; i++) s += pipedManual(i);
  return s;
});

// Compose (right-to-left)
function compose(...fns) {
  return x => fns.reduceRight((v, f) => f(v), x);
}
const composed = compose(neg, sqr, dbl, inc);

const c4 = time('compose (reduceRight)', () => {
  let s = 0;
  for (let i = 0; i < N; i++) s += composed(i);
  return s;
});

// For-loop pipe (avoid array method overhead?)
function pipeLoop(...fns) {
  return x => {
    let v = x;
    for (let i = 0; i < fns.length; i++) v = fns[i](v);
    return v;
  };
}
const pipedLoop = pipeLoop(inc, dbl, sqr, neg);

const c5 = time('pipe (for-loop)', () => {
  let s = 0;
  for (let i = 0; i < N; i++) s += pipedLoop(i);
  return s;
});

console.log(`${c1.label}: ${c1.median}ms`);
console.log(`${c2.label}: ${c2.median}ms (${(c2.median/c1.median).toFixed(1)}x)`);
console.log(`${c3.label}: ${c3.median}ms (${(c3.median/c1.median).toFixed(1)}x)`);
console.log(`${c4.label}: ${c4.median}ms (${(c4.median/c1.median).toFixed(1)}x)`);
console.log(`${c5.label}: ${c5.median}ms (${(c5.median/c1.median).toFixed(1)}x)`);

// =============================================================
// 4. Map/Filter/Reduce vs for-loop
// =============================================================

console.log('\n=== MAP/FILTER/REDUCE vs FOR ===');

const arr = Array.from({length: 100_000}, (_, i) => i);

const m1 = time('for-loop (filter+map+sum)', () => {
  let s = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] % 2 === 0) s += arr[i] * 2;
  }
  return s;
});

const m2 = time('chain: filter().map().reduce()', () => {
  return arr.filter(x => x % 2 === 0).map(x => x * 2).reduce((a, b) => a + b, 0);
});

// Single reduce
const m3 = time('single reduce', () => {
  return arr.reduce((s, x) => x % 2 === 0 ? s + x * 2 : s, 0);
});

console.log(`${m1.label}: ${m1.median}ms`);
console.log(`${m2.label}: ${m2.median}ms (${(m2.median/m1.median).toFixed(1)}x)`);
console.log(`${m3.label}: ${m3.median}ms (${(m3.median/m1.median).toFixed(1)}x)`);

// =============================================================
// 5. Immutable update patterns
// =============================================================

console.log('\n=== IMMUTABLE UPDATE ===');

const obj = { a: 1, b: 2, c: 3, d: 4, e: 5 };

const u1 = time('direct mutation', () => {
  const o = { a: 1, b: 2, c: 3, d: 4, e: 5 };
  for (let i = 0; i < N; i++) o.a = i;
  return o.a;
});

const u2 = time('spread update', () => {
  let o = obj;
  for (let i = 0; i < N; i++) o = { ...o, a: i };
  return o.a;
});

const u3 = time('Object.assign update', () => {
  let o = obj;
  for (let i = 0; i < N; i++) o = Object.assign({}, o, { a: i });
  return o.a;
});

console.log(`${u1.label}: ${u1.median}ms`);
console.log(`${u2.label}: ${u2.median}ms (${(u2.median/u1.median).toFixed(1)}x)`);
console.log(`${u3.label}: ${u3.median}ms (${(u3.median/u1.median).toFixed(1)}x)`);

console.log('\n=== SUMMARY ===');
console.log('Currying: manual and arrow curry are cheap. Generic curry has spread overhead.');
console.log('Partial: bind and closure are nearly free. Generic partial = spread tax.');
console.log('Pipe: reduce-based pipe has overhead per function in chain. Manual pipe = free.');
console.log('Array methods: chain creates intermediate arrays. Single reduce is closest to for-loop.');
console.log('Immutable: spread is the cheapest copy-on-write. Still much more than mutation.');
