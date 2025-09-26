```text
Node.js Version:
v22.14.0

=== Run JS with Node.js (default) ===
Fibonacci result: 254  Time (js):  0.755 s
real 0.79
user 0.77
sys 0.01

=== Run JS with Node.js max-opt=0 (Ignition only) ===
Fibonacci result: 254  Time (js):  13.011 s

real    0m13.037s
user    0m12.948s
sys     0m0.031s

=== Run JS with Node.js max-opt=1 (Ignition + Sparkplug) ===
Fibonacci result: 254  Time (js):  6.115 s

real    0m6.143s
user    0m6.059s
sys     0m0.021s

=== Run JS with Node.js max-opt=2 (Ignition + Sparkplug + Maglev) ===
Fibonacci result: 254  Time (js):  5.989 s

real    0m6.014s
user    0m5.988s
sys     0m0.012s

=== Run JS with Node.js max-opt=3 (Ignition + Sparkplug + Maglev + TurboFan) ===
Fibonacci result: 254  Time (js):  0.742 s

real    0m0.767s
user    0m0.759s
sys     0m0.007s

=== Run WASM with Node.js (default) ===
Fibonacci result: 254  Time (js):  2.057 s
real 2.07
user 2.06
sys 0.00

```
