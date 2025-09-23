/*
IEEE 754

Demo: Using NaN to store numbers

Float64 NaN:
Sign                  - 1 bit
NaN bits              - 11 bit
Quiet/Signaling flag  - 1 bit
Unused space          - 51 bit

Default NaN:
1        111 11111111    0      000 00000000 00000000 0000000 00000000 00000000 00000000
sign      NaN bit       q/s             Payload (51bit)
*/

class NaN_Value {
  constructor(num) {
    this.buf = new ArrayBuffer(8);
    // Float64 accessor
    this.float64 = new Float64Array(this.buf);
    // Int64 accessor
    this.int64 = new BigInt64Array(this.buf);
    // "zero" value (111111111111000000000000000000000000000000000000000000000000000)
    this.float64[0] = NaN;
    // add the value to the "zero"
    this.int64[0] |= BigInt(num);
  }

  valueOf() {
    return this.float64[0];
  }

  toString() {
    return this.int64[0].toString(2);
  }

  decode() {
    // extract
    return Number(this.int64[0] & 0x0007FFFFn);
  }

  static fromNaN(val) {
    var nv = new NaN_Value(0);
    nv.float64[0] = val;
    return nv;
  }
}

class NaN_Math {
  static add(a, b) {
    return new NaN_Value(a.decode() + b.decode());
  }

  static subtract(a, b) {
    return new NaN_Value(a.decode() - b.decode());
  }

  static divide(a, b) {
    return new NaN_Value(Math.round(a.decode() / b.decode()));
  }

  static multiply(a, b) {
    return new NaN_Value(a.decode() * b.decode());
  }

  static pow(a, p) {
    return new NaN_Value(Math.pow(a.decode(), p));
  }
}

(
  () => {
    var input = 555;
    console.log('input: ', input);
    var nv = new NaN_Value(input);
    console.log('string: ' + nv.toString());

    var NaNWithHiddenValue = nv.valueOf();

    console.log('container: ', NaNWithHiddenValue);
    console.log('decoded: ', nv.decode());

    console.log('\n--- math test ---');

    var logNv = (expr, val, pad = 6) => {
      console.log(expr.padStart(pad, ' ') + ': ' + val.valueOf() + ' ' + val.toString() +' (' + val.decode() + ')');
    };

    var zero = new NaN_Value(0);
    var a = new NaN_Value(5);
    var b = new NaN_Value(1242010);
    var c = new NaN_Value(2);
    logNv('zero', zero);
    logNv('a', a);
    logNv('b', b);
    logNv('c', c);

    var aPlusB = NaN_Math.add(a, b);
    logNv('a+b', aPlusB);

    var bMunusC = NaN_Math.subtract(b, c);
    logNv('b-c', bMunusC);

    var aMultiplyB = NaN_Math.multiply(a, b);
    logNv('a*b', aMultiplyB);

    var aPow4 = NaN_Math.pow(a, 4);
    logNv('a^4', aPow4);

    var bDivideA = NaN_Math.divide(b, a);
    logNv('b/a', bDivideA);

    console.log('\n--- From NaN: ---');
    logNv('NaN', NaN_Value.fromNaN(NaN), 20);
    logNv('Math.sqrt(-1)', NaN_Value.fromNaN(Math.sqrt(-1)), 20);
    logNv('parseInt("abc")', NaN_Value.fromNaN(parseInt('abc')), 20);
    logNv('1*undefined', NaN_Value.fromNaN(1 * undefined), 20);
    logNv('0*Infinity', NaN_Value.fromNaN(0 * Infinity), 20);
    logNv('Infinity/Infinity', NaN_Value.fromNaN(Infinity / Infinity), 20);
    logNv('Infinity-Infinity', NaN_Value.fromNaN(Infinity - Infinity), 20);
  }
)();
