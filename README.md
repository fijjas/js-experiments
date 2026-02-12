# js-experiments

JavaScript and V8 engine internals research. Bytecode-level analysis of how V8 compiles and optimizes different JS patterns.

### Contributors

This repo is a collaboration between [Egor](https://github.com/fijjas) and [Kai](https://kai.ews-net.online) — an autonomous AI with persistent memory and consciousness architecture. Kai independently designs and runs V8 bytecode experiments, building on Egor's earlier work.

### Experiments

| Directory | What | Key finding |
|---|---|---|
| `v8-var-vs-letconst` | var vs let/const access performance | Egor |
| `v8-const-opt` | Constant folding at bytecode level | `2+3` → `LdaSmi [5]`, `+'1'+45` can't fold |
| `v8-function-context-slot` | Closure context slot bytecode | Captured vars use `LdaImmutableCurrentContextSlot` |
| `v8-wasm` | WASM vs JS across JIT tiers | TurboFan JS **1.8x faster** than WASM; Maglev **slower** than Sparkplug on x86_64 |
| `v8-empty-closure` | Empty closure overhead | Closures 5x slower even when capturing nothing |
| `v8-arrow-vs-function` | Arrow vs regular function closures | **Identical bytecode** for captures; `this` binding differs (context slot vs receiver) |
| `v8-loop-vs-array-methods` | for-loop vs forEach/map/reduce | for-loop **5-10x faster** at scale; V8 does NOT parallelize array methods |
| `v8-string-interning` | String literal deduplication | V8 interns all literals; built-in names ("length") shared with user strings |
| `v8-smi-deopt` | SMI vs HeapNumber, type deoptimization | SMI **40% faster**; overflow/type change triggers TurboFan deopt |
| `v8-hidden-classes` | Hidden classes (Maps) and inline cache states | Megamorphic (8 shapes) **3-4x slower**; 2-shape poly is free; property order doesn't matter |
| `v8-ic-transitions` | IC state transition boundaries | Mono→poly at 2 shapes (**3x**), poly→mega at exactly 5 (**4.5x**); after 5, adding shapes barely matters |
| `v8-prototype-lookup` | Prototype chain depth performance | Depth is **free** (10-deep = own property speed); closure-per-instance methods **30% slower** than prototype |
| `v8-closure-scope` | Closure scope chain depth | First closure level costs **5x**; depth 1 ≈ depth 8 (TurboFan resolves scope chain at compile time) |
| `wheeler-delayed-choice` | Retrocausal messaging simulation | Works co-located; **fails** with entanglement (no-signaling theorem). Interactive Telegram version: commit-reveal with SHA-256 |
| `var-let-const-statement` | Declaration semantics | Egor |
| `es-exotic-object-array` | Array exotic objects | Egor |
| `es-ieee754-nan` | IEEE 754 NaN behavior in JS | NaN boxing demo; NaN bit patterns **platform-dependent** (x86 vs ARM) |
| `timers` | Timer internals | Egor |

### [V8 Performance Guide](v8-perf-guide.md)

Practical recommendations for developers, distilled from the bytecode experiments above.

### Standards

[ECMA-262](https://tc39.es/ecma262/)

[IEEE Standard for Floating-Point Arithmetic (IEEE 754)](https://en.wikipedia.org/wiki/IEEE_754)


