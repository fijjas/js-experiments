#!/bin/bash

set -e
echo "Node.js Version:"
node -v
echo ""

echo "=== Run JS with Node.js (default) ==="
/usr/bin/time -p node fibonacci-js.js
echo ""

echo "=== Run JS with Node.js max-opt=0 (Ignition only) ==="
time node --max-opt=0 fibonacci-js.js
echo ""

echo "=== Run JS with Node.js max-opt=1 (Ignition + Sparkplug) ==="
time node --max-opt=1 fibonacci-js.js
echo ""

echo "=== Run JS with Node.js max-opt=2 (Ignition + Sparkplug + Maglev) ==="
time node --max-opt=2 fibonacci-js.js
echo ""

echo "=== Run JS with Node.js max-opt=3 (Ignition + Sparkplug + Maglev + TurboFan) ==="
time node --max-opt=3 fibonacci-js.js
echo ""

echo "=== Run WASM with Node.js (default) ==="
/usr/bin/time -p node fibonacci-wasm.js
echo ""
