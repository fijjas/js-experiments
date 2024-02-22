let a;

function f1() {
  return a;
}

a = 2;

f1();

// d8 --print-bytecode --print-bytecode-filter='f1' var-let-const-statement/v8-hole-check.js
// node --print-bytecode --print-bytecode-filter='f1' var-let-const-statement/v8-hole-check.js

/*
LdaCurrentContextSlot [2]
ThrowReferenceErrorIfHole [0]
Return
 */

function f2() {
  let b = 2;
  return b;
}

f2();

// d8 --print-bytecode --print-bytecode-filter='f2' var-let-const-statement/v8-hole-check.js
// node --print-bytecode --print-bytecode-filter='f2' var-let-const-statement/v8-hole-check.js

/*
LdaSmi [2]
Star0
Return
 */


