# V8: Single Return vs Multiple Returns

**Node v20.20.0** (V8 v11.3), 20M iterations per test, Linux x86_64.

## Question

Does the number of `return` statements in a function affect V8 optimization?

## Method

Four test pairs — each pair has identical logic, one version using multiple early returns, the other accumulating into a single return. Tests run across three optimization tiers:

1. **No optimization** (`--no-opt`) — Ignition interpreter only
2. **Maglev** (`--no-turbofan`) — mid-tier JIT, no TurboFan
3. **TurboFan** (default) — full optimizing compiler

## Results

### TurboFan (default)

| Test | Multi (ms) | Single (ms) | Ratio | Winner |
|------|-----------|-------------|-------|--------|
| Classification (string) | 53.68 | 195.97 | 0.274x | **multi 3.6x faster** |
| Numeric (guard clauses) | 171.40 | 155.33 | 1.103x | ~tied |
| Validation (many exits) | 163.79 | 167.83 | 0.976x | ~tied |
| Deep nesting (branchy) | 156.32 | 156.47 | 0.999x | ~tied |

### Maglev only (--no-turbofan)

| Test | Multi (ms) | Single (ms) | Ratio |
|------|-----------|-------------|-------|
| Classification | 856.67 | 872.77 | 0.982x |
| Numeric | 929.28 | 957.47 | 0.971x |
| Validation | 1346.56 | 1294.23 | 1.040x |
| Deep nesting | 954.58 | 933.70 | 1.022x |

All within noise. No meaningful difference.

### No optimization (--no-opt)

| Test | Multi (ms) | Single (ms) | Ratio |
|------|-----------|-------------|-------|
| Classification | 832.49 | 867.51 | 0.960x |
| Numeric | 951.08 | 1009.31 | 0.942x |
| Validation | 1405.28 | 1328.47 | 1.058x |
| Deep nesting | 962.08 | 983.76 | 0.978x |

All within noise. No meaningful difference.

## The anomaly: classification under TurboFan

Only one test shows a dramatic difference: `classifyMulti` vs `classifySingle` under TurboFan. Multi-return is **3.6x faster** — consistently (tested 5+ runs, always 47-54ms vs 163-196ms).

The other three tests are tied across all tiers. The effect is TurboFan-specific — it disappears entirely under Maglev and interpreter.

### Why?

The classification functions return string literals (`'small'`, `'medium'`, `'large'`, `'huge'`). The other functions return numbers or booleans.

Multi-return version:
```js
if (val < 100) return 'small';
if (val < 1000) return 'medium';
if (val < 5000) return 'large';
return 'huge';
```

Single-return version:
```js
let result;
if (val < 100) result = 'small';
else if (val < 1000) result = 'medium';
else if (val < 5000) result = 'large';
else result = 'huge';
return result;
```

The likely cause is TurboFan's type inference and variable tracking. In the multi-return version, each return path produces a known constant string — TurboFan can optimize each exit independently with no phi-node merging.

In the single-return version, `result` is initially `undefined`, then assigned one of four strings. TurboFan must track `result` through the if/else chain and merge the types at the single return point. The `let result` declaration with deferred assignment creates a phi node at the return — the optimizer must prove that `result` is always a string (never `undefined`). This merge point may prevent some optimizations or force a more conservative code path.

The numeric tests don't show this because numbers already have a single representation in V8's optimized code — there's no type ambiguity to resolve.

## Conclusion

**For most code: no meaningful difference.** The number of return statements does not affect V8 optimization in typical numeric or boolean logic.

**Exception: string-returning functions with branchy control flow.** TurboFan optimizes early-return patterns significantly better than single-return with deferred assignment — likely due to phi-node elimination and constant propagation at each exit point.

**Practical advice:** Write whatever style is clearest. The only case where multiple returns win measurably is string classification with many branches under TurboFan — and even then, the absolute difference is ~150ms over 20 million calls (~7.5ns per call). Unless you're in a hot loop doing string classification millions of times, it doesn't matter.
