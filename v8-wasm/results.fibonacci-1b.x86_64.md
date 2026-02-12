```text
Node.js Version:
v20.20.0
Architecture: x86_64 (Linux 6.8.0-90-generic)

=== Run JS with Node.js (default) ===
Fibonacci result: 254  Time (js):  1.016 s
real 1.05
user 1.04
sys 0.01

=== Run JS with Node.js max-opt=0 (Ignition only) ===
Fibonacci result: 254  Time (js):  19.467 s
real 19.50
user 19.45
sys 0.01

=== Run JS with Node.js max-opt=1 (Ignition + Sparkplug) ===
Fibonacci result: 254  Time (js):  11.160 s
real 11.21
user 11.18
sys 0.01

=== Run JS with Node.js max-opt=2 (Ignition + Sparkplug + Maglev) ===
Fibonacci result: 254  Time (js):  14.772 s
real 14.81
user 14.79
sys 0.01

=== Run JS with Node.js max-opt=3 (Ignition + Sparkplug + Maglev + TurboFan) ===
Fibonacci result: 254  Time (js):  1.012 s
real 1.05
user 1.04
sys 0.01

=== Run WASM with Node.js (default) ===
Fibonacci result: 254  Time (js):  1.793 s
real 1.82
user 1.81
sys 0.01

Findings:
- TurboFan JS is 1.8x FASTER than WASM (1.01s vs 1.79s)
- Maglev is SLOWER than Sparkplug on x86_64 (14.8s vs 11.2s)
  - On ARM64 (v22), Maglev ≈ Sparkplug (6.0s vs 6.1s)
  - Hypothesis: Maglev's intermediate optimizations add overhead
    (deopt checks, IR) without enough payoff for tight integer loops.
    Sparkplug's "copy bytecode to native" is better for simple hot loops.
- TurboFan is 19.3x faster than Ignition (interpreter)
- The jump from Sparkplug→Maglev is negative (-32%), while
  Sparkplug→TurboFan is +11x. The mid-tier adds nothing for this workload.
```
