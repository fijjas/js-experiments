// Map vs Object: when does Map win?
// Hypothesis: Map wins for frequent add/delete, Object wins for static lookup

const N = 100000;
const KEYS = Array.from({length: N}, (_, i) => `key_${i}`);
const NUM_KEYS = Array.from({length: N}, (_, i) => i);

function bench(name, fn, iterations = 5) {
    const times = [];
    for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        fn();
        const end = process.hrtime.bigint();
        times.push(Number(end - start) / 1e6);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    console.log(`${name}: ${median.toFixed(2)}ms (median of ${iterations})`);
    return median;
}

// Test 1: String key insertion
bench('Object string insert', () => {
    const obj = {};
    for (let i = 0; i < N; i++) obj[KEYS[i]] = i;
});

bench('Map string insert', () => {
    const map = new Map();
    for (let i = 0; i < N; i++) map.set(KEYS[i], i);
});

// Test 2: String key lookup (pre-populated)
const objPre = {}; KEYS.forEach((k, i) => objPre[k] = i);
const mapPre = new Map(); KEYS.forEach((k, i) => mapPre.set(k, i));

bench('Object string lookup', () => {
    let sum = 0;
    for (let i = 0; i < N; i++) sum += objPre[KEYS[i]];
    return sum;
});

bench('Map string lookup', () => {
    let sum = 0;
    for (let i = 0; i < N; i++) sum += mapPre.get(KEYS[i]);
    return sum;
});

// Test 3: Integer key insertion  
bench('Object integer insert', () => {
    const obj = {};
    for (let i = 0; i < N; i++) obj[i] = i;
});

bench('Map integer insert', () => {
    const map = new Map();
    for (let i = 0; i < N; i++) map.set(i, i);
});

// Test 4: Integer key lookup
const objInt = {}; for (let i = 0; i < N; i++) objInt[i] = i;
const mapInt = new Map(); for (let i = 0; i < N; i++) mapInt.set(i, i);

bench('Object integer lookup', () => {
    let sum = 0;
    for (let i = 0; i < N; i++) sum += objInt[i];
    return sum;
});

bench('Map integer lookup', () => {
    let sum = 0;
    for (let i = 0; i < N; i++) sum += mapInt.get(i);
    return sum;
});

// Test 5: Delete operations
bench('Object delete', () => {
    const obj = {};
    for (let i = 0; i < N; i++) obj[KEYS[i]] = i;
    for (let i = 0; i < N; i++) delete obj[KEYS[i]];
});

bench('Map delete', () => {
    const map = new Map();
    for (let i = 0; i < N; i++) map.set(KEYS[i], i);
    for (let i = 0; i < N; i++) map.delete(KEYS[i]);
});

// Test 6: has/in check
bench('Object has (in)', () => {
    let count = 0;
    for (let i = 0; i < N; i++) {
        if (KEYS[i] in objPre) count++;
    }
    return count;
});

bench('Map has', () => {
    let count = 0;
    for (let i = 0; i < N; i++) {
        if (mapPre.has(KEYS[i])) count++;
    }
    return count;
});

// Test 7: Iteration
bench('Object iterate (for-in)', () => {
    let sum = 0;
    for (const k in objPre) sum += objPre[k];
    return sum;
});

bench('Map iterate (forEach)', () => {
    let sum = 0;
    mapPre.forEach(v => sum += v);
    return sum;
});

bench('Object iterate (Object.keys)', () => {
    let sum = 0;
    const keys = Object.keys(objPre);
    for (let i = 0; i < keys.length; i++) sum += objPre[keys[i]];
    return sum;
});

bench('Object iterate (entries)', () => {
    let sum = 0;
    for (const [k, v] of Object.entries(objPre)) sum += v;
    return sum;
});

bench('Map iterate (for-of)', () => {
    let sum = 0;
    for (const [k, v] of mapPre) sum += v;
    return sum;
});
