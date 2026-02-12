// V8 WeakRef and FinalizationRegistry: what's the real cost?
// Myth: "WeakRef is just a regular reference with extra GC magic"
// Reality: WeakRef creates GC-visible tracking objects. FinalizationRegistry
//          adds callback scheduling on collection. Both have real overhead.

const N = 1_000_000;

// --- Test 1: WeakRef creation cost vs regular reference ---
function test1_creation_cost() {
  console.log('\n=== Test 1: WeakRef creation cost ===');

  // Regular object references
  let start = performance.now();
  const refs = [];
  for (let i = 0; i < N; i++) {
    refs.push({ value: i });
  }
  const regularTime = performance.now() - start;
  console.log(`regular refs:     ${regularTime.toFixed(1)}ms`);

  // WeakRef wrapping
  start = performance.now();
  const weakRefs = [];
  for (let i = 0; i < N; i++) {
    weakRefs.push(new WeakRef({ value: i }));
  }
  const weakTime = performance.now() - start;
  console.log(`WeakRef creation: ${weakTime.toFixed(1)}ms`);

  console.log(`Ratio: ${(weakTime/regularTime).toFixed(1)}x`);

  return { refs, weakRefs }; // prevent GC
}

// --- Test 2: WeakRef.deref() cost vs direct access ---
function test2_deref_cost() {
  console.log('\n=== Test 2: WeakRef.deref() cost ===');

  const obj = { value: 42 };
  const weak = new WeakRef(obj);

  // Direct access
  let start = performance.now();
  let sum = 0;
  for (let i = 0; i < N; i++) {
    sum += obj.value;
  }
  const directTime = performance.now() - start;
  console.log(`direct access:    ${directTime.toFixed(1)}ms (sum=${sum})`);

  // WeakRef.deref()
  start = performance.now();
  sum = 0;
  for (let i = 0; i < N; i++) {
    const target = weak.deref();
    if (target) sum += target.value;
  }
  const derefTime = performance.now() - start;
  console.log(`weak.deref():     ${derefTime.toFixed(1)}ms (sum=${sum})`);

  console.log(`Ratio: ${(derefTime/directTime).toFixed(1)}x`);
}

// --- Test 3: FinalizationRegistry overhead ---
function test3_finalization_registry() {
  console.log('\n=== Test 3: FinalizationRegistry registration cost ===');
  const ITER = 100_000;

  // Without registry — retain objects so GC doesn't skew results
  const kept1 = [];
  let start = performance.now();
  for (let i = 0; i < ITER; i++) {
    kept1.push({ value: i });
  }
  const noRegTime = performance.now() - start;
  console.log(`no registry:      ${noRegTime.toFixed(1)}ms`);

  // With FinalizationRegistry (register each object)
  const registry = new FinalizationRegistry((held) => {});
  const kept2 = [];

  start = performance.now();
  for (let i = 0; i < ITER; i++) {
    const obj = { value: i };
    registry.register(obj, i);
    kept2.push(obj);
  }
  const regTime = performance.now() - start;
  console.log(`with registry:    ${regTime.toFixed(1)}ms`);

  console.log(`Ratio: ${(regTime/noRegTime).toFixed(1)}x`);
  return { kept1, kept2 };
}

// --- Test 4: WeakMap vs WeakRef for caching ---
function test4_weakmap_vs_weakref() {
  console.log('\n=== Test 4: WeakMap vs WeakRef for caching ===');
  const ITER = 500_000;

  // Pre-create keys
  const keys = [];
  for (let i = 0; i < 1000; i++) keys.push({ id: i });

  // WeakMap set/get
  const wm = new WeakMap();
  let start = performance.now();
  for (let i = 0; i < ITER; i++) {
    const key = keys[i % 1000];
    if (!wm.has(key)) wm.set(key, { data: i });
    wm.get(key);
  }
  const wmTime = performance.now() - start;
  console.log(`WeakMap get/set:  ${wmTime.toFixed(1)}ms`);

  // Map set/get (for comparison)
  const m = new Map();
  start = performance.now();
  for (let i = 0; i < ITER; i++) {
    const key = keys[i % 1000];
    if (!m.has(key)) m.set(key, { data: i });
    m.get(key);
  }
  const mTime = performance.now() - start;
  console.log(`Map get/set:      ${mTime.toFixed(1)}ms`);

  // WeakRef-based cache (manual)
  const cache = new Map();
  start = performance.now();
  for (let i = 0; i < ITER; i++) {
    const key = keys[i % 1000].id;
    let ref = cache.get(key);
    let val = ref?.deref();
    if (!val) {
      val = { data: i };
      cache.set(key, new WeakRef(val));
    }
  }
  const wrTime = performance.now() - start;
  console.log(`WeakRef cache:    ${wrTime.toFixed(1)}ms`);

  console.log(`Ratios: WeakMap/Map=${(wmTime/mTime).toFixed(2)}x, WeakRef/Map=${(wrTime/mTime).toFixed(2)}x`);
}

// --- Test 5: WeakRef survival across GC ---
async function test5_gc_behavior() {
  console.log('\n=== Test 5: WeakRef survival across GC ===');

  // Create objects and WeakRefs
  let obj1 = { name: 'held' };
  let obj2 = { name: 'released' };
  const weak1 = new WeakRef(obj1);
  const weak2 = new WeakRef(obj2);

  console.log(`Before GC: weak1=${weak1.deref()?.name}, weak2=${weak2.deref()?.name}`);

  // Release one reference
  obj2 = null;

  // Force GC if available
  if (global.gc) {
    global.gc();
    // WeakRef targets are not cleared immediately — need microtask checkpoint
    await new Promise(r => setTimeout(r, 0));
    global.gc();
    console.log(`After GC:  weak1=${weak1.deref()?.name}, weak2=${weak2.deref()?.name ?? 'COLLECTED'}`);
  } else {
    console.log('(run with --expose-gc to test GC behavior)');
  }
}

// --- Test 6: WeakSet vs Set ---
function test6_weakset_vs_set() {
  console.log('\n=== Test 6: WeakSet vs Set ===');
  const ITER = 500_000;

  const objects = [];
  for (let i = 0; i < 1000; i++) objects.push({ id: i });

  // Set
  const s = new Set();
  let start = performance.now();
  for (let i = 0; i < ITER; i++) {
    const obj = objects[i % 1000];
    s.add(obj);
    s.has(obj);
  }
  const setTime = performance.now() - start;
  console.log(`Set add/has:      ${setTime.toFixed(1)}ms`);

  // WeakSet
  const ws = new WeakSet();
  start = performance.now();
  for (let i = 0; i < ITER; i++) {
    const obj = objects[i % 1000];
    ws.add(obj);
    ws.has(obj);
  }
  const wsTime = performance.now() - start;
  console.log(`WeakSet add/has:  ${wsTime.toFixed(1)}ms`);

  console.log(`Ratio: ${(wsTime/setTime).toFixed(2)}x`);
}

// --- Test 7: FinalizationRegistry callback timing ---
async function test7_callback_timing() {
  console.log('\n=== Test 7: FinalizationRegistry callback timing ===');

  let collected = 0;
  const registry = new FinalizationRegistry((held) => {
    collected++;
  });

  // Create and immediately discard objects
  for (let i = 0; i < 100; i++) {
    let obj = { value: i };
    registry.register(obj, i);
    obj = null;
  }

  console.log(`Registered: 100 objects`);
  console.log(`Collected before GC: ${collected}`);

  if (global.gc) {
    global.gc();
    console.log(`Collected after GC (sync): ${collected}`);

    // Callbacks are scheduled as microtasks after GC
    await new Promise(r => setTimeout(r, 100));
    console.log(`Collected after GC + await: ${collected}`);

    // Another GC pass
    global.gc();
    await new Promise(r => setTimeout(r, 100));
    console.log(`Collected after 2nd GC + await: ${collected}`);
  } else {
    console.log('(run with --expose-gc to test callback timing)');
  }
}

async function main() {
  console.log(`Node ${process.version}`);
  console.log(`Iterations: ${N.toLocaleString()}`);

  const kept = test1_creation_cost();
  test2_deref_cost();
  test3_finalization_registry();
  test4_weakmap_vs_weakref();
  await test5_gc_behavior();
  test6_weakset_vs_set();
  await test7_callback_timing();
}

main().catch(console.error);
