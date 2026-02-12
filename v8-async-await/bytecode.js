// Bytecode comparison: sync vs async vs .then

function syncAdd(a, b) { return a + b; }
async function asyncAdd(a, b) { return a + b; }
async function asyncAwaitAdd(a, b) { return await Promise.resolve(a + b); }
function thenAdd(a, b) { return Promise.resolve(a + b).then(x => x); }

async function sequential() {
  const a = await Promise.resolve(1);
  const b = await Promise.resolve(2);
  return a + b;
}

async function parallel() {
  const [a, b] = await Promise.all([
    Promise.resolve(1),
    Promise.resolve(2)
  ]);
  return a + b;
}

// Force compilation
syncAdd(1, 2);
asyncAdd(1, 2);
asyncAwaitAdd(1, 2);
thenAdd(1, 2);
sequential();
parallel();
