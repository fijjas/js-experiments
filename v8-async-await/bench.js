// V8 async/await: what's the real overhead?
// Myth: "async/await has negligible overhead"
// Reality: each await creates a microtask, allocates a PromiseReaction,
//          and suspends/resumes the generator-like state machine.

const N = 1_000_000;

function syncAdd(a, b) { return a + b; }
async function asyncAdd(a, b) { return a + b; }
async function asyncAwaitAdd(a, b) { return await Promise.resolve(a + b); }

// --- Test 1: sync vs async function call overhead ---
async function test1_call_overhead() {
  console.log('\n=== Test 1: Call overhead (sync vs async) ===');

  // Sync
  let start = performance.now();
  let sum = 0;
  for (let i = 0; i < N; i++) {
    sum += syncAdd(i, 1);
  }
  const syncTime = performance.now() - start;
  console.log(`sync call:        ${syncTime.toFixed(1)}ms (sum=${sum})`);

  // Async (no await at call site — just creates promise)
  start = performance.now();
  sum = 0;
  const promises = [];
  for (let i = 0; i < N; i++) {
    promises.push(asyncAdd(i, 1));
  }
  // Must await all to get values
  const results = await Promise.all(promises);
  for (const r of results) sum += r;
  const asyncNoAwaitTime = performance.now() - start;
  console.log(`async (batch):    ${asyncNoAwaitTime.toFixed(1)}ms (sum=${sum})`);

  // Async with sequential await
  start = performance.now();
  sum = 0;
  for (let i = 0; i < N; i++) {
    sum += await asyncAdd(i, 1);
  }
  const asyncAwaitTime = performance.now() - start;
  console.log(`async (seq await): ${asyncAwaitTime.toFixed(1)}ms (sum=${sum})`);

  console.log(`Ratios: batch=${(asyncNoAwaitTime/syncTime).toFixed(1)}x, seq=${(asyncAwaitTime/syncTime).toFixed(1)}x`);
}

// --- Test 2: Promise.resolve vs new Promise ---
async function test2_promise_creation() {
  console.log('\n=== Test 2: Promise creation cost ===');

  let start = performance.now();
  for (let i = 0; i < N; i++) {
    await Promise.resolve(i);
  }
  const resolveTime = performance.now() - start;
  console.log(`Promise.resolve:  ${resolveTime.toFixed(1)}ms`);

  start = performance.now();
  for (let i = 0; i < N; i++) {
    await new Promise(r => r(i));
  }
  const newPromiseTime = performance.now() - start;
  console.log(`new Promise:      ${newPromiseTime.toFixed(1)}ms`);

  // Already resolved promise (cached)
  const cached = Promise.resolve(42);
  start = performance.now();
  for (let i = 0; i < N; i++) {
    await cached;
  }
  const cachedTime = performance.now() - start;
  console.log(`cached resolve:   ${cachedTime.toFixed(1)}ms`);

  console.log(`new/resolve ratio: ${(newPromiseTime/resolveTime).toFixed(2)}x`);
}

// --- Test 3: await chain depth ---
async function test3_chain_depth() {
  console.log('\n=== Test 3: Await chain depth ===');
  const ITER = 100_000;

  async function depth1(x) { return x + 1; }
  async function depth2(x) { return await depth1(x) + 1; }
  async function depth3(x) { return await depth2(x) + 1; }
  async function depth5(x) {
    let v = x;
    v = await depth1(v);
    v = await depth1(v);
    v = await depth1(v);
    v = await depth1(v);
    return v + 1;
  }

  for (const [name, fn] of [['depth1', depth1], ['depth2', depth2], ['depth3', depth3], ['depth5', depth5]]) {
    const start = performance.now();
    for (let i = 0; i < ITER; i++) {
      await fn(i);
    }
    const t = performance.now() - start;
    console.log(`${name}: ${t.toFixed(1)}ms (${(t/ITER*1000).toFixed(1)}us/call)`);
  }
}

// --- Test 4: Promise.all vs sequential await ---
async function test4_parallel_vs_sequential() {
  console.log('\n=== Test 4: Promise.all vs sequential ===');
  const ITER = 100_000;

  async function work(x) { return x * 2; }

  // Sequential
  let start = performance.now();
  for (let i = 0; i < ITER; i++) {
    const a = await work(i);
    const b = await work(i + 1);
    const c = await work(i + 2);
  }
  const seqTime = performance.now() - start;
  console.log(`sequential (3x):  ${seqTime.toFixed(1)}ms`);

  // Promise.all
  start = performance.now();
  for (let i = 0; i < ITER; i++) {
    const [a, b, c] = await Promise.all([work(i), work(i+1), work(i+2)]);
  }
  const allTime = performance.now() - start;
  console.log(`Promise.all (3x): ${allTime.toFixed(1)}ms`);

  console.log(`Ratio: ${(seqTime/allTime).toFixed(2)}x`);
}

// --- Test 5: async overhead in tight compute loop ---
async function test5_compute_overhead() {
  console.log('\n=== Test 5: Async in compute-heavy code ===');

  // Pure sync compute
  function syncCompute(n) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Math.sqrt(i);
    return sum;
  }

  // Same but async (no await inside)
  async function asyncCompute(n) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Math.sqrt(i);
    return sum;
  }

  // Async with periodic yield
  async function asyncYieldCompute(n) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += Math.sqrt(i);
      if (i % 10000 === 0) await Promise.resolve();
    }
    return sum;
  }

  const WORK = 1_000_000;

  let start = performance.now();
  for (let i = 0; i < 10; i++) syncCompute(WORK);
  const syncTime = performance.now() - start;
  console.log(`sync compute:     ${syncTime.toFixed(1)}ms`);

  start = performance.now();
  for (let i = 0; i < 10; i++) await asyncCompute(WORK);
  const asyncTime = performance.now() - start;
  console.log(`async (no yield):  ${asyncTime.toFixed(1)}ms`);

  start = performance.now();
  for (let i = 0; i < 10; i++) await asyncYieldCompute(WORK);
  const yieldTime = performance.now() - start;
  console.log(`async (yield/10k): ${yieldTime.toFixed(1)}ms`);

  console.log(`Ratios: async=${(asyncTime/syncTime).toFixed(2)}x, yield=${(yieldTime/syncTime).toFixed(2)}x`);
}

// --- Test 6: .then() chain vs async/await ---
async function test6_then_vs_await() {
  console.log('\n=== Test 6: .then() chain vs await ===');
  const ITER = 100_000;

  // .then chain
  let start = performance.now();
  let chain = Promise.resolve(0);
  for (let i = 0; i < ITER; i++) {
    chain = chain.then(v => v + 1);
  }
  const result1 = await chain;
  const thenTime = performance.now() - start;
  console.log(`.then() chain:    ${thenTime.toFixed(1)}ms (result=${result1})`);

  // async/await sequential
  start = performance.now();
  let val = 0;
  for (let i = 0; i < ITER; i++) {
    val = await Promise.resolve(val + 1);
  }
  const awaitTime = performance.now() - start;
  console.log(`await sequential: ${awaitTime.toFixed(1)}ms (result=${val})`);

  console.log(`Ratio: ${(thenTime/awaitTime).toFixed(2)}x`);
}

// --- Test 7: async generator vs sync generator ---
async function test7_async_generator() {
  console.log('\n=== Test 7: Async generator vs sync generator ===');
  const ITER = 100_000;

  function* syncGen(n) {
    for (let i = 0; i < n; i++) yield i;
  }

  async function* asyncGen(n) {
    for (let i = 0; i < n; i++) yield i;
  }

  // sync
  let start = performance.now();
  let sum = 0;
  for (const v of syncGen(ITER)) sum += v;
  const syncTime = performance.now() - start;
  console.log(`sync generator:   ${syncTime.toFixed(1)}ms (sum=${sum})`);

  // async
  start = performance.now();
  sum = 0;
  for await (const v of asyncGen(ITER)) sum += v;
  const asyncTime = performance.now() - start;
  console.log(`async generator:  ${asyncTime.toFixed(1)}ms (sum=${sum})`);

  console.log(`Ratio: ${(asyncTime/syncTime).toFixed(1)}x`);
}

async function main() {
  console.log(`Node ${process.version}`);
  console.log(`Iterations: ${N.toLocaleString()}`);

  await test1_call_overhead();
  await test2_promise_creation();
  await test3_chain_depth();
  await test4_parallel_vs_sequential();
  await test5_compute_overhead();
  await test6_then_vs_await();
  await test7_async_generator();
}

main().catch(console.error);
