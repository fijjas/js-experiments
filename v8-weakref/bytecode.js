// Bytecode comparison: WeakRef.deref vs direct access

function directAccess(obj) {
  return obj.value;
}

function weakDeref(weak) {
  const target = weak.deref();
  if (target) return target.value;
  return undefined;
}

function weakMapGet(wm, key) {
  return wm.get(key);
}

function mapGet(m, key) {
  return m.get(key);
}

// Force compilation
const obj = { value: 42 };
const weak = new WeakRef(obj);
const wm = new WeakMap([[obj, 1]]);
const m = new Map([[obj, 1]]);

directAccess(obj);
weakDeref(weak);
weakMapGet(wm, obj);
mapGet(m, obj);
