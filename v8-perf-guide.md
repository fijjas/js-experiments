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

## 9. Stay in SMI range — HeapNumber costs 40%

V8 stores small integers (up to 2^31-1 on x64) as tagged pointers — no heap allocation. Floats and overflow values become HeapNumber objects on the heap.

Benchmark shows: **SMI arithmetic ~620ms vs HeapNumber ~880ms** (40% penalty). And when SMI overflows mid-computation, TurboFan catches it and triggers deoptimization (`reason: overflow`), falling back to Ignition.

**Do:** Keep counters and indices in SMI range when possible.
**Do:** Use `| 0` or `Math.trunc()` to keep integer results as SMI.
**Don't:** Mix integers and floats in the same variable in hot paths.

```js
// SMI — fast (tagged pointer, no heap)
var sum = 0;
for (var i = 0; i < 100; i++) sum += i;

// HeapNumber — 40% slower (heap allocation per value)
var sum = 2147483647;
for (var i = 0; i < 100; i++) sum += 0.1;
```

See: [`v8-smi-deopt`](v8-smi-deopt/)

## 10. Keep types stable — avoid deoptimization

TurboFan optimizes functions based on observed types. When a function trained on numbers receives a string, TurboFan bails out (`reason: not a Smi`) and falls back to the interpreter.

Bytecode itself is type-blind — Ignition doesn't care. The cost is at the JIT level: deoptimization discards compiled code and restarts with the interpreter.

**Do:** Keep variables and function arguments type-consistent.
**Don't:** Reuse variables for different types (`var a = 1; a = "hello"; a = []`).
**Do:** Pre-allocate arrays with `new Array(n)` for known sizes (2.5x faster than growing).

```js
// type-stable — TurboFan optimizes and stays optimized
function add(a, b) { return a + b; }
for (var i = 0; i < 100000; i++) add(i, i + 1);

// type-unstable — triggers deoptimization
add("hello", " world");  // bailout: "not a Smi"
```

See: [`v8-smi-deopt`](v8-smi-deopt/)

## 11. WASM is not always faster than JS

Counterintuitively, TurboFan-optimized JS can **beat WASM** for type-stable integer work. Fibonacci 1B iterations: JS 1.0s vs WASM 1.8s (1.8x faster JS). Why? TurboFan knows the types are SMI and generates tighter machine code than WASM's ahead-of-time compilation.

WASM wins when: types are mixed, GC pressure matters, or the code can't reach TurboFan (too complex, polymorphic). WASM loses when: TurboFan can speculate and the speculation holds.

Also: Maglev (V8's mid-tier JIT) is **slower** than Sparkplug (baseline) for tight loops on x86_64 — the intermediate optimizations add overhead without payoff.

**Do:** Benchmark before moving hot JS to WASM — JS may already be faster.
**Do:** Move genuinely polymorphic or memory-heavy computation to WASM.
**Don't:** Assume "native code" (WASM) beats JIT code — speculative optimization is powerful.

See: [`v8-wasm`](v8-wasm/)

## 12. Keep object shapes consistent — megamorphic is 3-4x slower

V8 assigns each object a hidden class ("Map") based on its property layout. Property access through inline caches (ICs) has four states: monomorphic (1 shape), polymorphic (2-4), and megamorphic (5+).

Benchmark shows: **megamorphic access is 3-4x slower** than monomorphic. But 2-shape polymorphism is essentially free (<10% overhead). The cliff is at 5+ shapes.

Property order creates different hidden classes (`{x, y}` is not `{y, x}`), but the performance impact is only 2-shape polymorphism — negligible. And adding a new shape to an optimized function triggers **deoptimization**: TurboFan bails out and falls back to the interpreter before recompiling.

**Do:** Keep hot-path objects to 1-2 shapes.
**Do:** Initialize all properties in the constructor (same order).
**Don't:** Pass 5+ different object shapes through the same function.

```js
// monomorphic — fast (single hidden class)
function Point(x, y) { this.x = x; this.y = y; }
var points = [];
for (var i = 0; i < 1000; i++) points.push(new Point(i, i));

// megamorphic — 3-4x slower (8 different shapes)
var mixed = [
  {x: 1},
  {x: 1, y: 2},
  {x: 1, z: 3},
  {x: 1, w: 4},
  // ... more shapes through same function
];

// property order doesn't matter — only 2-shape poly, negligible
var a = {}; a.x = 1; a.y = 2;
var b = {}; b.y = 2; b.x = 1;
// different hidden classes, but reading .x is still fast
```

See: [`v8-hidden-classes`](v8-hidden-classes/)

## 13. Prototype chain depth is free — don't flatten for performance

V8's inline cache resolves the full prototype chain once and caches the result. Accessing `obj.x` at depth 10 in the prototype chain is the **same speed** as accessing an own property.

All `readX` variants — own, prototype depth 1, depth 5, depth 10 — produce **identical bytecode**: `GetNamedProperty a0, [0], [0]; Return`. Performance differences are entirely in the IC/TurboFan layer, and with monomorphic access, they vanish.

Own property shadowing a prototype value also has no cost — V8 resolves to the own property and caches it.

**Do:** Use prototype chains naturally. Depth doesn't matter.
**Don't:** Copy prototype methods onto instances for "performance."
**Don't:** Flatten inheritance hierarchies to avoid prototype lookups.

See: [`v8-prototype-lookup`](v8-prototype-lookup/)

## 14. Don't create methods inside constructors

`this.fn = function(){}` creates a **new closure object per instance**. Even though all closures share the same `SharedFunctionInfo`, TurboFan sees different function targets at the call site and can't inline.

Benchmark: closure-per-instance methods are **30% slower** than prototype methods. Assigning a shared function (`this.fn = sharedFn`) performs identically to prototype methods — confirming the penalty is function identity, not own-vs-prototype.

**Do:** Use prototype methods or class methods.
**Do:** If you need own methods, assign a shared function reference.
**Don't:** Use `this.method = function(){}` or `this.method = () => {}` in constructors.

```js
// slow — 100 instances = 100 different closure objects
function Widget() {
  this.val = 1;
  this.getVal = function() { return this.val; };
}

// fast — single function on prototype, TurboFan inlines
function Widget() { this.val = 1; }
Widget.prototype.getVal = function() { return this.val; };

// also fast — shared function reference
function getVal() { return this.val; }
function Widget() { this.val = 1; this.getVal = getVal; }

// also fast — class syntax (sugar for prototype assignment)
class Widget {
  constructor() { this.val = 1; }
  getVal() { return this.val; }
}
```

See: [`v8-prototype-lookup`](v8-prototype-lookup/)

## 15. IC transitions are step functions, not gradual

V8's inline cache has exactly two transition points, not one gradual degradation:

| Shapes | IC State     | Cost    | Ratio |
|--------|-------------|---------|-------|
| 1      | Monomorphic | ~2.8 ns | 1x    |
| 2-4    | Polymorphic | ~8.5 ns | 3x    |
| 5+     | Megamorphic | ~13 ns  | 4.5x  |

The boundary is exactly **5 shapes** (V8 internal `kMaxPolymorphicMapCount = 4`). Not 8, not gradual.

Key implication: if you're already at 5 shapes, going to 20 doesn't matter much. The IC has already given up. But the jump from 1 to 2 shapes (3x) is the most expensive per-shape transition. Keep hot paths monomorphic.

After megamorphic, V8 still optimizes the function (Maglev/TurboFan compiles it), but can't specialize the property access. The function runs fast; the property lookup runs generic.

```js
// monomorphic — 1 shape, fastest
function process(point) { return point.x + point.y; }
const points = data.map(d => ({ x: d[0], y: d[1] })); // same shape
points.forEach(process); // 1x

// polymorphic — 4 shapes, 3x
// avoid mixing object shapes at the same call site

// megamorphic — 5+ shapes, 4.5x
// but 5 shapes ≈ 32 shapes, so don't stress past the boundary
```

See: [`v8-ic-transitions`](v8-ic-transitions/)

---

## 16. Closure scope depth is free — the first indirection costs

Accessing a variable from any closure level costs ~5-6x vs a local variable. But depth doesn't matter:

| Access pattern | Cost | Ratio |
|----------------|------|-------|
| Local variable | ~1.3 ns | 1x |
| Closure depth 1 | ~7 ns | 5x |
| Closure depth 2 | ~7 ns | 5x |
| Closure depth 4 | ~7 ns | 5x |
| Closure depth 8 | ~7 ns | 5x |
| 4 vars from 4 levels | ~7 ns | 5x |

TurboFan resolves the scope chain at compile time, just like prototype chain lookup. The overhead is "context slot access" (reading from a Context object instead of a register), not "scope chain walk."

Practical implication: deeply nested closures (callbacks in callbacks, middleware chains, promise chains) don't add incremental cost per nesting level. The cost is paid once at the first closure boundary. Don't flatten your code for performance — flatten it for readability.

```js
// This is fine — depth 4 costs the same as depth 1
app.use((req, res, next) => {
  const user = req.user;
  validate(user, (err) => {
    if (err) return next(err);
    authorize(user, (err) => {
      if (err) return next(err);
      process(user, (result) => {
        res.json(result); // accessing `user` from depth 4 — same cost as depth 1
      });
    });
  });
});
```

See: [`v8-closure-scope`](v8-closure-scope/)

---

## The cost hierarchy

From bytecode analysis, the actual cost ranking:

1. **Per-element function dispatch** (forEach/reduce vs for-loop) — 5-10x at scale
2. **Lost inlining** (closures in hot paths) — orders of magnitude
3. **Megamorphic property access** (5+ object shapes) — 3-5x per access
4. **Polymorphic IC** (2-4 shapes) — 3x per access
5. **Closure-per-instance methods** (this.fn = function) — 30% per call
6. **Context allocation** (`CreateFunctionContext`) — per-closure overhead
7. **Context slot access** (mutable vs immutable) — per-access micro-cost
8. **Prototype chain depth** — free (no cost at any depth)
9. **Closure scope depth** — free after first level (depth 1 ≈ depth 8)
10. **Closure creation** (`CreateClosure`) — near-zero
11. **Constant folding** — free at compile time

Most JS performance advice focuses on #6-9. The real gains are in #1-5.

## 17. Map vs Object: Map wins for mutation and iteration, Object wins for lookup

Benchmarked at 100k entries:

| Operation | Object | Map | Winner | Ratio |
|---|---|---|---|---|
| String key insert | 27ms | 14ms | **Map** | 2x |
| String key lookup | 2.6ms | 4.7ms | **Object** | 1.8x |
| Integer key insert | 3.3ms | 9.2ms | **Object** | 2.8x |
| Integer key lookup | 0.35ms | 1.9ms | **Object** | 5.5x |
| Delete | 31ms | 20ms | **Map** | 1.6x |
| has/in check | 2.4ms | 3.8ms | **Object** | 1.6x |
| Iteration | 21ms | 0.9ms | **Map** | **24x** |
| entries iteration | 53ms | 1.5ms | **Map** | **35x** |

The big result: **Map iteration is 24-35x faster.** `for-in` uses V8's `ForInPrepare/ForInNext/ForInStep` machinery which enumerates the property descriptor chain. `Object.entries()` additionally creates key-value arrays per entry. Map stores entries in a flat backing array — `forEach` just walks it linearly.

Object integer lookup at 0.35ms is 5.5x faster than Map because V8 treats numeric-keyed objects as dense arrays internally (elements store, not hash table).

**Do:** Use Map for collections that change (add/delete) or need iteration.
**Do:** Use Object for static lookups, especially with integer-like keys.
**Don't:** Use `for-in` or `Object.entries()` in hot paths — they're catastrophically slow.
**Don't:** Use Map as a replacement for simple config objects (overhead of `.get()`/`.set()` vs property access).

```js
// Object wins — static lookup, integer keys
const lookup = {};
for (let i = 0; i < 1000; i++) lookup[i] = data[i];
// lookup[42] — 0.35ms per 100k lookups

// Map wins — frequent mutation + iteration
const cache = new Map();
cache.set(key, value);
cache.delete(expiredKey);
cache.forEach((v, k) => process(k, v));  // 24x faster than for-in
```

See: [`v8-map-vs-object`](v8-map-vs-object/)

## 18. try-catch is free — throwing is not

Historical claim: "try-catch prevents V8 optimization." True for Crankshaft (pre-2017). TurboFan handles it. Benchmarked at 10M iterations:

| Test | Time | ops/sec | Notes |
|---|---|---|---|
| Sum, no try-catch | 1020ms | 9.8M | Baseline |
| Sum, with try-catch (no throw) | 1064ms | 9.4M | **~4% overhead** |
| Sum, rare throw (1/1M) | 1127ms | 8.9M | Negligible |
| Narrow try (inside loop) | 1104ms | 9.1M | |
| Wide try (outside loop) | 1082ms | 9.2M | Identical |
| **Throw+catch (always throws)** | **72101ms** | **139K** | **700x slower than return** |
| Return error (always errors) | 103ms | 97M | |
| Property access via try-catch | 13155ms | 760K | 10% null rate |
| Property access via if-check | 83ms | 121M | **159x faster** |
| No try-catch | 64ms | 157M | Baseline |
| 1-level try-catch | 63ms | 159M | Same |
| 3-level nested | 71ms | 141M | Same |
| 5-level nested | 74ms | 136M | **1.2x — negligible** |

**Bytecode proof**: `noTry(n)` compiles to 9 bytes: `Ldar a0, MulSmi [2], AddSmi [1], Return`. `withTry(n)` compiles to 25 bytes but the happy path is identical — the only addition is `Mov <context> r0` (saving context for potential catch scope) and dead catch handler code (CreateCatchContext, SetPendingMessage, PushContext). TurboFan sees through try-catch completely on the non-throwing path.

The real cost is `throw`: `new Error()` captures the full stack trace (walks the call stack, formats frame info), then the runtime unwinds the stack searching for a handler, creates a catch context, and restores the saved context. Each throw is ~0.007ms — 700x more than a function return.

**Do:** Wrap code in try-catch freely for error safety. Zero meaningful overhead on the happy path.
**Do:** Use if-checks for expected failure conditions (null, undefined, invalid input).
**Don't:** Use try-catch as control flow. `try { obj.prop } catch { default }` is 159x slower than `if (obj != null) obj.prop`.
**Don't:** Throw for non-exceptional conditions. Return error objects or null instead.

```js
// GOOD — try-catch for unexpected errors, zero overhead
function processData(data) {
  try {
    return transform(data);
  } catch (e) {
    log.error(e);
    return fallback;
  }
}

// BAD — try-catch as control flow (159x slower)
function getNestedValue(obj) {
  try { return obj.a.b.c; } catch { return undefined; }
}

// GOOD — if-check for expected nulls
function getNestedValue(obj) {
  return obj?.a?.b?.c;
}
```

See: [`v8-try-catch`](v8-try-catch/)

---

*Built from bytecode experiments in this repo. Each recommendation verified with `node --print-bytecode`.*
