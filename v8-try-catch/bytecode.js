// Minimal functions for bytecode comparison
function noTry(n) {
  return n * 2 + 1;
}

function withTry(n) {
  try {
    return n * 2 + 1;
  } catch (e) {
    return 0;
  }
}

function withCheck(n) {
  const obj = n > 0 ? { v: n } : null;
  if (obj === null) return 0;
  return obj.v;
}

function withTryCatch(n) {
  const obj = n > 0 ? { v: n } : null;
  try {
    return obj.v;
  } catch (e) {
    return 0;
  }
}

// Force compilation
noTry(1); withTry(1); withCheck(1); withTryCatch(1);
