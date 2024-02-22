// V8 v12
// node.js v20

function getSum() {
  return (2 + 3);
}
getSum();

/* d8 --print-bytecode v8-const-opt/math.js --print-bytecode-filter='getSum'
0x290200002194 @    0 : 0d 05             LdaSmi [5]
0x290200002196 @    2 : ab                Return
 */

/* node --print-bytecode --print-bytecode-filter='getSum' v8-const-opt/math.js
179 S> 0x2f2b4f11d596 @    0 : 0d 05             LdaSmi [5]
194 S> 0x2f2b4f11d598 @    2 : a9                Return
 */


function getTtlMs() {
  return (1000 * 3600 * 24);
}
getTtlMs();

/* d8 --print-bytecode --print-bytecode-filter='getTtlMs' v8-const-opt/math.js
0x2902000021c0 @    0 : 01 0d 00 5c 26 05 LdaSmi.ExtraWide [86400000]
0x2902000021c6 @    6 : ab                Return
 */

/* node --print-bytecode --print-bytecode-filter='getTtlMs' v8-const-opt/math.js
639 S> 0x3a9be8e1d636 @    0 : 01 0d 00 5c 26 05 LdaSmi.ExtraWide [86400000]
665 S> 0x3a9be8e1d63c @    6 : a9                Return
 */


function noOpt() {
  return +'1' + 45;
}
noOpt();

/* d8 --print-bytecode --print-bytecode-filter='noOpt' v8-const-opt/math.js
0x7be000021f8 @    0 : 13 00             LdaConstant [0]
0x7be000021fa @    2 : 75 01             ToNumber [1]
0x7be000021fc @    4 : 44 2d 00          AddSmi [45], [0]
0x7be000021ff @    7 : ab                Return
 */

/* node --print-bytecode --print-bytecode-filter='noOpt' v8-const-opt/math.js
  975 S> 0x11370c75d78e @    0 : 13 00             LdaConstant [0]
  982 E> 0x11370c75d790 @    2 : 74 01             ToNumber [1]
  987 E> 0x11370c75d792 @    4 : 44 2d 00          AddSmi [45], [0]
  992 S> 0x11370c75d795 @    7 : a9                Return
Constant pool (size = 1)
0x11370c75d741: [FixedArray] in OldSpace
 - map: 0x276818e00211 <Map(FIXED_ARRAY_TYPE)>
 - length: 1
           0: 0x276818e03211 <String[1]: #1>
 */
