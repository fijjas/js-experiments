# V8 Performance Guide: What the Bytecode Actually Says

Recommendations based on bytecode-level analysis. Each claim links to the experiment that proves it.

Node.js v20.20.0 / V8 v12.

---

## 1. Closures in hot paths cost you inlining, not memory

A closure that captures nothing generates **identical bytecode** to a plain function. But it's ~5x slower in benchmarks. Why?

TurboFan can't inline closures from factory functions — they lack stable feedback vectors. The closure mechanism is cheap; the lost optimization opportunity is expensive.

**Do:** Use plain functions in tight loops and array callbacks.
**Don't:** Wrap functions in factories for "encapsulation" in hot paths.

```js
// slow — closure created per call, TurboFan can't inline
function makeProcessor(data) {
  return () => process(data);
}
arr.forEach(makeProcessor(x));

// fast — plain function, inlineable
function processItem(item) { process(item); }
arr.forEach(processItem);
```

See: [`v8-empty-closure`](v8-empty-closure/)

## 2. Arrow vs regular: identical for captures, different for `this`

Arrow and regular functions produce **identical bytecode** when capturing variables. No performance difference.

The only real difference: `this` binding. Arrow functions capture `this` via context slot (`CreateFunctionContext` + `LdaImmutableCurrentContextSlot`). Regular functions use the `<this>` register directly. Arrow constructor: 31 bytes. Regular: 16 bytes.

**Do:** Choose arrow vs regular based on semantics, not speed.
**Do:** Prefer regular functions for `this`-heavy methods on hot objects.

```js
// arrow captures `this` via context slot — 39 bytes total
function Widget() {
  this.val = 1;
  this.get = () => this.val;
}

// regular uses <this> register directly — 21 bytes total
function Widget() {
  this.val = 1;
  this.get = function() { return this.val; };
}
```

See: [`v8-arrow-vs-function`](v8-arrow-vs-function/)

## 3. Context allocation is the real cost of closures

V8 skips `CreateFunctionContext` entirely when the inner function captures nothing. When it does capture, the parent function pays 14 bytes for context allocation regardless of how many variables are captured.

This means: **one captured variable costs the same as ten.** The overhead is the context frame, not the variables.

**Do:** If you must capture one variable, don't worry about capturing a few more.
**Don't:** Create closures that capture variables in loops when you could pass parameters.

```js
// bad — creates context per iteration
for (let i = 0; i < n; i++) {
  const x = data[i];
  callbacks[i] = () => process(x);
}

// better — no closure capture needed
for (let i = 0; i < n; i++) {
  callbacks[i] = process.bind(null, data[i]);
}
```

See: [`v8-function-context-slot`](v8-function-context-slot/), [`v8-arrow-vs-function`](v8-arrow-vs-function/)

## 4. Use `const` for captured variables

Captured `const` variables use `LdaImmutableCurrentContextSlot` — V8 marks the slot as immutable and can optimize reads. Captured `let` uses `LdaCurrentContextSlot`, which must check for mutations.

In tight loops over closures, this matters.

**Do:** Declare captured variables with `const` when they don't change.

See: [`v8-function-context-slot`](v8-function-context-slot/)

## 5. Don't hand-optimize constant arithmetic

V8 folds constant expressions at compile time. `1000 * 3600 * 24` compiles to a single `LdaSmi [86400000]` instruction. No runtime multiplication.

**Do:** Write `1000 * 60 * 60 * 24` for readability.
**Don't:** Pre-compute `86400000` and lose the intent.

```js
// both compile to identical bytecode: LdaSmi [86400000]
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_DAY = 86400000;
```

Type coercion breaks folding: `+'1' + 45` generates 7 bytes instead of 1.

See: [`v8-const-opt`](v8-const-opt/)

## 6. `let`/`const` vs `var`: irrelevant in production

Unoptimized bytecode shows `let`/`const` ~15% slower than `var` (context slot vs frame slot). With TurboFan optimization, the difference vanishes.

**Do:** Use `let` and `const` for correctness and scoping.
**Don't:** Use `var` for performance — any gain disappears after JIT.

See: [`v8-var-vs-letconst`](v8-var-vs-letconst/)

## 7. Use for-loop or for-of instead of forEach/reduce in hot paths

At scale (1000+ elements), `for`-loop is **5-10x faster** than `forEach`, and `reduce` is the slowest of all. V8 does NOT parallelize native array methods — the spec forbids it.

Root cause: `forEach`/`reduce` dispatch a function call (`CallProperty`) per element. A `for`-loop compiles to a tight `JumpLoop` with no function dispatch. `for-of` is nearly as fast as `for` — V8 optimizes array iterators.

The gap disappears at small arrays (n<100) where TurboFan inlines callbacks.

**Do:** Use `for` or `for-of` in hot paths processing large arrays.
**Don't:** Assume `forEach`/`map` are "optimized internally" — they aren't.

```js
// 100k elements: ~1ms
for (var i = 0; i < arr.length; i++) sum += arr[i];

// 100k elements: ~1.3ms
for (var x of arr) sum += x;

// 100k elements: ~11ms
arr.forEach(function(x) { sum += x; });

// 100k elements: ~18ms
arr.reduce(function(acc, x) { return acc + x; }, 0);
```

See: [`v8-loop-vs-array-methods`](v8-loop-vs-array-methods/)

## 8. String literals are free — V8 interns everything

V8 deduplicates all string literals at compile time. Two variables with `"hello"` share a **single heap object** — constant pool has one entry, both load from it.

More importantly: built-in property names like `"length"`, `"prototype"`, `"constructor"` are the **same heap objects** your code uses. `var a = "length"` and `obj.length` reference the same V8 internal string.

But: string concatenation of literals (`"hel" + "lo"`) is NOT constant-folded — it generates runtime `Add` bytecode. Only numeric expressions fold.

**Do:** Use string literals freely — no memory cost for repetition.
**Do:** Use `===` for interned string comparison — it's O(1) reference equality.
**Don't:** Build strings with concatenation when a literal would do.

```js
// both use the same constant pool entry — zero duplication
var a = "hello";
var b = "hello";
a === b;  // true, O(1) reference check

// NOT folded — generates runtime Add + 3 constant pool entries
var c = "hel" + "lo";  // avoid this if "hello" would suffice
```

See: [`v8-string-interning`](v8-string-interning/)

## 9. WASM for compute, JS for everything else

WebAssembly runs as near-native machine code without GC pauses or type speculation overhead. For pure computation (tight loops, math), WASM is 10-100x faster.

For typical application code (I/O, DOM, object manipulation), JavaScript's JIT is sufficient and the interop cost of WASM negates gains.

**Do:** Move algorithmic bottlenecks (crypto, image processing, physics) to WASM.
**Don't:** Rewrite business logic in WASM — the overhead boundary crossing isn't worth it.

See: [`v8-wasm`](v8-wasm/)

---

## The cost hierarchy

From bytecode analysis, the actual cost ranking:

1. **Per-element function dispatch** (forEach/reduce vs for-loop) — 5-10x at scale
2. **Lost inlining** (closures in hot paths) — orders of magnitude
3. **Context allocation** (`CreateFunctionContext`) — per-closure overhead
4. **Context slot access** (mutable vs immutable) — per-access micro-cost
5. **Closure creation** (`CreateClosure`) — near-zero
6. **Constant folding** — free at compile time

Most JS performance advice focuses on #4-6. The real gains are in #1-3.

---

*Built from bytecode experiments in this repo. Each recommendation verified with `node --print-bytecode`.*
