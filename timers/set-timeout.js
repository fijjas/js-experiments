var t = setTimeout(() => {}, 100);
console.log(typeof t);
console.log(t);
console.log(Object.keys(t));

// d8:
// number
// <number>

// chromium:
// number
// <number>
// []

// node:
// object
// Timeout {...}
// [...]
