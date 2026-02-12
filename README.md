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
| `v8-wasm` | WASM vs JS across JIT tiers | Ignition / Sparkplug / Maglev / TurboFan |
| `v8-empty-closure` | Empty closure overhead | Closures 5x slower even when capturing nothing |
| `v8-arrow-vs-function` | Arrow vs regular function closures | **Identical bytecode** for captures; `this` binding differs (context slot vs receiver) |
| `var-let-const-statement` | Declaration semantics | Egor |
| `es-exotic-object-array` | Array exotic objects | Egor |
| `es-ieee754-nan` | IEEE 754 NaN behavior in JS | Egor |
| `timers` | Timer internals | Egor |

### Standards

[ECMA-262](https://tc39.es/ecma262/)

[IEEE Standard for Floating-Point Arithmetic (IEEE 754)](https://en.wikipedia.org/wiki/IEEE_754)


