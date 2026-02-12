#!/usr/bin/env node
/**
 * V8 Closure Scope Chain Experiment
 *
 * Question: How does accessing a variable from an outer closure
 * compare to accessing a local variable? Does scope chain depth
 * matter after TurboFan optimization?
 *
 * Tested patterns:
 *   1. Local variable access (depth 0)
 *   2. One closure level (depth 1)
 *   3. Deep closures (depth 2, 4, 8)
 *   4. Mixed: some vars local, some from closure
 *
 * Run: node --allow-natives-syntax scope-chain.js
 */

'use strict';

const ITERATIONS = 1e7;
const WARMUP = 1e5;

function measure(label, fn) {
  // Warmup
  for (let i = 0; i < WARMUP; i++) fn();

  // Extra warmup to ensure optimization
  for (let i = 0; i < WARMUP; i++) fn();

  const start = process.hrtime.bigint();
  for (let i = 0; i < ITERATIONS; i++) fn();
  const end = process.hrtime.bigint();

  const ns = Number(end - start);
  const perOp = (ns / ITERATIONS).toFixed(1);
  console.log(`  ${label}: ${perOp} ns/op`);
  return parseFloat(perOp);
}

console.log(`\n=== V8 Closure Scope Chain ===`);
console.log(`Iterations: ${ITERATIONS.toExponential()}\n`);

// --- Test 1: Local variable ---
console.log('--- Depth 0: Local variable ---');
const t0 = measure('local var', function() {
  let x = 42;
  return x + 1;
});

// --- Test 2: One closure level ---
console.log('\n--- Depth 1: One closure ---');
const t1 = measure('closure depth 1', (function() {
  let x = 42;
  return function() {
    return x + 1;
  };
})());

// --- Test 3: Two closure levels ---
console.log('\n--- Depth 2: Two closures ---');
const t2 = measure('closure depth 2', (function() {
  let x = 42;
  return (function() {
    return function() {
      return x + 1;
    };
  })();
})());

// --- Test 4: Four closure levels ---
console.log('\n--- Depth 4: Four closures ---');
const t4 = measure('closure depth 4', (function() {
  let x = 42;
  return (function() {
    return (function() {
      return (function() {
        return function() {
          return x + 1;
        };
      })();
    })();
  })();
})());

// --- Test 5: Eight closure levels ---
console.log('\n--- Depth 8: Eight closures ---');
const t8 = measure('closure depth 8', (function() {
  let x = 42;
  return (function() {
    return (function() {
      return (function() {
        return (function() {
          return (function() {
            return (function() {
              return (function() {
                return function() {
                  return x + 1;
                };
              })();
            })();
          })();
        })();
      })();
    })();
  })();
})());

// --- Test 6: Each level captures its own variable ---
console.log('\n--- Depth 4, each level captures ---');
const t4_capture = measure('depth 4 + captures', (function() {
  let a = 10;
  return (function() {
    let b = 20;
    return (function() {
      let c = 30;
      return (function() {
        let d = 40;
        return function() {
          return a + b + c + d;
        };
      })();
    })();
  })();
})());

// --- Test 7: Local vs closure in same function ---
console.log('\n--- Mixed: local + closure depth 4 ---');
const t_mixed = measure('mixed local+closure', (function() {
  let outer = 42;
  return (function() {
    return (function() {
      return (function() {
        return function() {
          let local = 10;
          return local + outer;
        };
      })();
    })();
  })();
})());

// --- Test 8: Eval defeats scope optimization ---
console.log('\n--- With eval (scope de-optimization) ---');
const t_eval = measure('eval in chain', (function() {
  let x = 42;
  return (function() {
    // eval() forces V8 to keep the full scope chain alive
    // even if we don't use eval for accessing x
    eval('');
    return function() {
      return x + 1;
    };
  })();
})());

// --- Summary ---
console.log('\n=== Summary ===');
console.log(`  Local (depth 0):      ${t0} ns/op (baseline)`);
console.log(`  Closure depth 1:      ${t1} ns/op (${(t1/t0).toFixed(2)}x)`);
console.log(`  Closure depth 2:      ${t2} ns/op (${(t2/t0).toFixed(2)}x)`);
console.log(`  Closure depth 4:      ${t4} ns/op (${(t4/t0).toFixed(2)}x)`);
console.log(`  Closure depth 8:      ${t8} ns/op (${(t8/t0).toFixed(2)}x)`);
console.log(`  Depth 4 + captures:   ${t4_capture} ns/op (${(t4_capture/t0).toFixed(2)}x)`);
console.log(`  Mixed local+closure:  ${t_mixed} ns/op (${(t_mixed/t0).toFixed(2)}x)`);
console.log(`  Eval in chain:        ${t_eval} ns/op (${(t_eval/t0).toFixed(2)}x)`);
