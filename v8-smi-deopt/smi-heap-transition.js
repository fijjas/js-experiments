// V8 SMI vs HeapNumber, type transitions, and deoptimization
// Question (Egor): does exceeding SMI range cause heap allocation + perf drop?
// Does runtime type conversion (var a=1; a='2'; a=[]) trigger deoptimization?
// Does Array() vs [] reserve different slots?
// Node.js v20.20.0 / V8 v12
//
// Run bytecode:    node --print-bytecode smi-heap-transition.js 2>&1 | grep -B2 -A25 'function: smiOp\|...'
// Run deopt trace: node --trace-deopt deopt-trace.js
// Run perf:        node perf-test.js

// === CASE 1: SMI vs HeapNumber ===

// Case 1a: Operations within SMI range
function smiOp() {
  var a = 42;
  var b = a + 100;
  var c = a * 3;
  return b + c;
}
smiOp();

/* smiOp bytecode (19 bytes):
  LdaSmi [42]         // loaded as Small Integer — tagged pointer, NOT heap
  Star0
  AddSmi [100]        // SMI-specific add instruction! No heap allocation
  Star1
  Ldar r0
  MulSmi [3]          // SMI-specific multiply
  Star2
  Add r1              // generic Add (both operands SMI → stays SMI)
  Return

  ALL SMI-specific instructions (AddSmi, MulSmi). No constant pool entries.
  Zero heap allocation for values.
*/

// Case 1b: Operations that overflow SMI → HeapNumber
function heapOp() {
  var a = 2147483647;       // 2^31 - 1, above SMI range on 64-bit!
  var b = a + 1;            // forces HeapNumber
  var c = 1.5;              // float → always HeapNumber
  return b + c;
}
heapOp();

/* heapOp bytecode (20 bytes):
  LdaSmi.ExtraWide [2147483647]  // 6 bytes! Special wide encoding for large SMI
  Star0
  AddSmi [1]                     // still uses AddSmi instruction
  Star1
  LdaConstant [0]                // 1.5 loaded from CONSTANT POOL (heap object!)
  Star2
  Add r1
  Return

  Constant pool:
    0: <HeapNumber 1.5>    ← float ALWAYS needs heap allocation

  NOTE: 2147483647 still uses LdaSmi (wide variant) — V8 uses 32-bit SMI on
  64-bit systems (31 data bits + tag bit = values up to 2^30-1... but V8
  actually uses Smi with 32-bit payload on x64, so 2^31-1 fits!).
  The overflow happens at RUNTIME when a+1 = 2^31 → HeapNumber.
*/

// === CASE 2: Type transitions ===

// Case 2a: Variable changes type at runtime
function typeChange() {
  var a = 1;      // SMI
  a = "hello";    // String — type change!
  a = [1, 2, 3];  // Array — another change!
  return a;
}
typeChange();

/* typeChange bytecode (12 bytes):
  LdaSmi [1]                  // a = 1 (SMI)
  Star0
  LdaConstant [0]             // a = "hello" (string from constant pool)
  Star0                       // OVERWRITES same register — no type check
  CreateArrayLiteral [1]      // a = [1,2,3] (new array, heap allocation)
  Star0
  Return

  At BYTECODE level: no type checking. Ignition doesn't care about types.
  The deoptimization happens at TURBOFAN level — when optimized code
  encounters a type it wasn't compiled for, it bails out.
*/

// === CASE 3: Array literal vs constructor ===

function arrayLiteral() {
  var a = [];
  return a;
}
arrayLiteral();

/* arrayLiteral bytecode (4 bytes!):
  CreateEmptyArrayLiteral [0]    // dedicated opcode for empty []
  Star0
  Return

  ONLY 4 BYTES. Specialized instruction, no constructor lookup.
*/

function arrayConstructor() {
  var a = new Array();
  return a;
}
arrayConstructor();

/* arrayConstructor bytecode (11 bytes):
  LdaGlobal [0]           // lookup "Array" in global scope
  Star1
  Construct r1, r0-r0     // call Array constructor
  Star0
  Return

  11 BYTES — global lookup + constructor call.
  Almost 3x more bytecode than [].
*/

// === DEOPTIMIZATION TRACE RESULTS (from deopt-trace.js) ===
//
// When running with --trace-deopt:
//
// 1. stableAdd(i, i+1) × 100k → TurboFan optimizes for number+number
//    Then stableAdd("hello", " world") →
//    BAILOUT: "reason: not a Smi" — deopt back to Ignition
//
// 2. increment(i) × 100k → TurboFan optimizes for SMI
//    Then increment(2147483647) →
//    BAILOUT: "reason: overflow" — SMI overflow caught, deopt
//
// 3. Insufficient type feedback triggers deopt when type assumptions break
//
// See deopt-trace.js for the exact trace.

// === PERFORMANCE RESULTS (from perf-test.js) ===
//
// SMI arithmetic:    ~620ms (10M iters)
// HeapNumber arith:  ~880ms (10M iters)  — 40% SLOWER
// SMI→Heap overflow: ~880ms (10M iters)  — same as HeapNumber
//
// [] empty:          ~250ms vs new Array() empty: ~115ms — Array() 2x FASTER!
// [] growing to 100: ~540ms vs Array(100) pre:    ~220ms — pre-sizing 2.5x FASTER!

// === FINDINGS ===
//
// FINDING 1: SMI arithmetic is ~40% faster than HeapNumber.
// SMI uses tagged pointer (no heap), HeapNumber allocates on heap.
// Bytecode shows: AddSmi/MulSmi for SMI, LdaConstant + heap for floats.
// Egor's theory CONFIRMED — exceeding SMI range costs performance.
//
// FINDING 2: SMI overflow triggers TurboFan deoptimization.
// --trace-deopt shows: "reason: overflow" when SMI arithmetic overflows.
// TurboFan bails out to Ignition interpreter, losing optimization.
// This is the REAL performance cliff Egor hypothesized.
//
// FINDING 3: Type changes trigger deoptimization.
// Calling a function optimized for numbers with a string →
// "reason: not a Smi" deoptimization. Egor's var a=1; a='2' theory
// CONFIRMED at the optimization level (not bytecode — bytecode is untyped).
//
// FINDING 4: [] vs new Array() — [] is simpler bytecode but Array() is FASTER.
// [] → CreateEmptyArrayLiteral (4 bytes)
// new Array() → LdaGlobal + Construct (11 bytes)
// PARADOX: despite more bytecode, new Array() benchmarks 2x faster.
// Likely cause: Array constructor pre-allocates with known initial capacity,
// while [] starts truly empty and needs reallocation on first push.
//
// FINDING 5: Pre-sized Array(100) is 2.5x faster than growing [].
// Avoiding reallocation during growth is a major win.
// For known-size arrays, always pre-allocate.
//
// FINDING 6: Bytecode is TYPE-BLIND. Types only matter at TurboFan level.
// typeChange() bytecode doesn't check types at all — just overwrites register.
// Deoptimization is a JIT concern, not an interpreter concern. This means:
// type instability costs nothing in Ignition, everything in TurboFan.
