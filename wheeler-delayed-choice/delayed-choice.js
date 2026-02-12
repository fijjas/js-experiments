// Wheeler's Delayed-Choice Experiment: Honest Simulation
// Why retrocausal information transfer is impossible
//
// The setup: Mach-Zehnder interferometer
//   1. Photon hits first beam splitter (BS1) → superposition of path A and B
//   2. Paths converge at second beam splitter (BS2) location
//   3. DELAYED CHOICE: after photon has "chosen" its path,
//      decide whether to INSERT or REMOVE BS2
//   4. Two detectors D0 and D1 at the output
//
// The paradox:
//   - BS2 PRESENT → interference (wave behavior). D0 clicks 100%, D1 never.
//   - BS2 ABSENT  → no interference (particle behavior). D0 and D1 each 50%.
//   - Choice is made AFTER photon passes BS1. Seems retrocausal!
//
// The resolution:
//   - Individual detector clicks are RANDOM in both cases
//   - The STATISTICS differ, but only visible after many trials
//   - You can't extract a single bit from one photon
//   - Information requires COMPARING sender's choices with receiver's results
//
// Run: node delayed-choice.js

// === Physics simulation ===

class MachZehnder {
  constructor() {
    this.phaseShift = 0; // relative phase between paths (radians)
  }

  // Beam splitter matrix: [[1, i], [i, 1]] / √2
  // This is the standard lossless 50/50 BS with symmetric phases
  // Used for BOTH BS1 and BS2 (identical components)
  applyBS(inA, inB) {
    var inv = 1 / Math.sqrt(2);
    // out0 = (inA + i*inB) / √2
    // out1 = (i*inA + inB) / √2
    return {
      out0: {
        re: inv * (inA.re - inB.im),
        im: inv * (inA.im + inB.re)
      },
      out1: {
        re: inv * (-inA.im + inB.re),
        im: inv * (inA.re + inB.im)
      }
    };
  }

  // Run one photon through the interferometer
  // bs2Present: whether the second beam splitter is inserted
  // Returns: which detector clicked (0 or 1)
  runPhoton(bs2Present) {
    // Step 1: photon enters on path A (input port 0)
    var inA = { re: 1, im: 0 };
    var inB = { re: 0, im: 0 };

    // Step 2: BS1 splits into superposition
    var after_bs1 = this.applyBS(inA, inB);
    var pathA = after_bs1.out0;
    var pathB = after_bs1.out1;

    // Step 3: apply phase shift on path B (path length difference)
    var cos_p = Math.cos(this.phaseShift);
    var sin_p = Math.sin(this.phaseShift);
    pathB = {
      re: pathB.re * cos_p - pathB.im * sin_p,
      im: pathB.re * sin_p + pathB.im * cos_p
    };

    if (bs2Present) {
      // Step 4a: BS2 present → recombine, interference
      var after_bs2 = this.applyBS(pathA, pathB);
      var pD0 = after_bs2.out0.re ** 2 + after_bs2.out0.im ** 2;
      return Math.random() < pD0 ? 0 : 1;
    } else {
      // Step 4b: BS2 absent → direct detection (which-path)
      // Path A hits D0, path B hits D1
      var pA = pathA.re ** 2 + pathA.im ** 2;
      return Math.random() < pA ? 0 : 1;
    }
  }
}

// === Experiment: Can Alice send a message to Bob? ===
//
// Setup:
//   Alice (sender) controls BS2 — she chooses to insert or remove it
//   Bob (receiver) sees detector clicks — he tries to decode Alice's choice
//
// Alice encodes: bit 1 = BS2 present, bit 0 = BS2 absent
// Bob decodes: ??? — he sees individual clicks

function tryRetrocausalMessage(message) {
  var mz = new MachZehnder();
  var photonsPerBit = 100;

  console.log("=== Retrocausal Message Attempt ===");
  console.log("Message: \"" + message + "\"");
  console.log("Photons per bit: " + photonsPerBit);
  console.log();

  // Convert message to bits
  var bits = [];
  for (var i = 0; i < message.length; i++) {
    var code = message.charCodeAt(i);
    for (var j = 7; j >= 0; j--) {
      bits.push((code >> j) & 1);
    }
  }

  var aliceChoices = [];     // what Alice chose (ground truth)
  var bobRawResults = [];    // what Bob sees (detector clicks per bit)
  var bobDecodedBits = [];   // what Bob tries to decode

  for (var b = 0; b < bits.length; b++) {
    var bit = bits[b];
    var bs2Present = bit === 1;  // Alice's encoding

    aliceChoices.push(bs2Present);

    // Bob collects photonsPerBit clicks
    var d0Count = 0;
    var d1Count = 0;
    for (var p = 0; p < photonsPerBit; p++) {
      var result = mz.runPhoton(bs2Present);
      if (result === 0) d0Count++;
      else d1Count++;
    }

    bobRawResults.push({ d0: d0Count, d1: d1Count });

    // Bob's decoding strategy:
    // If BS2 present: destructive interference at D0 → D1 dominates (~100% D1)
    // If BS2 absent: D0 ≈ D1 ≈ 50% (random, no interference)
    // So: if D1 > 75% (i.e., D0 < 25%) → guess bit=1 (BS2 present), else bit=0
    var d0Fraction = d0Count / photonsPerBit;
    bobDecodedBits.push(d0Fraction < 0.25 ? 1 : 0);
  }

  // Results
  var correct = 0;
  for (var i = 0; i < bits.length; i++) {
    if (bits[i] === bobDecodedBits[i]) correct++;
  }

  var accuracy = correct / bits.length;

  // Decode Bob's bits back to text
  var decodedText = "";
  for (var i = 0; i < bobDecodedBits.length; i += 8) {
    var charCode = 0;
    for (var j = 0; j < 8 && i + j < bobDecodedBits.length; j++) {
      charCode = (charCode << 1) | bobDecodedBits[i + j];
    }
    decodedText += String.fromCharCode(charCode);
  }

  console.log("Alice sent:     \"" + message + "\"");
  console.log("Bob decoded:    \"" + decodedText + "\"");
  console.log("Bit accuracy:   " + (accuracy * 100).toFixed(1) + "% (" + correct + "/" + bits.length + ")");
  console.log();

  // Show WHY it works in this simulation
  console.log("=== Why This Works (and why it shouldn't) ===");
  console.log();

  // Show first 8 bits in detail
  console.log("First 8 bits detail:");
  console.log("  Bit | Alice (BS2) | Bob D0:D1    | D0%   | Bob guess | Correct?");
  console.log("  ----|-------------|--------------|-------|-----------|--------");
  for (var i = 0; i < Math.min(8, bits.length); i++) {
    var r = bobRawResults[i];
    var pct = (r.d0 / photonsPerBit * 100).toFixed(0);
    console.log(
      "   " + bits[i] +
      "  |  " + (aliceChoices[i] ? "present " : "absent  ") +
      "  | " + String(r.d0).padStart(3) + ":" + String(r.d1).padStart(3) +
      "        | " + String(pct).padStart(3) + "%  |     " + bobDecodedBits[i] +
      "     | " + (bits[i] === bobDecodedBits[i] ? "YES" : "NO")
    );
  }

  console.log();
  console.log("=== THE CATCH ===");
  console.log();
  console.log("This simulation lets Bob distinguish BS2-present from BS2-absent");
  console.log("because the STATISTICS are different:");
  console.log("  - BS2 present: D1 ≈ 100% (destructive interference at D0)");
  console.log("  - BS2 absent:  D0 ≈ D1 ≈ 50% (random, no interference)");
  console.log();
  console.log("In the REAL Wheeler experiment, this is also true!");
  console.log("So why can't we send messages backward in time?");
  console.log();
  console.log("Because the delayed choice requires BOTH observers to be in the");
  console.log("same lab. The \"past\" and \"future\" are in the same light cone.");
  console.log("There is no separation — Alice and Bob are the same person.");
  console.log();
  console.log("For ACTUAL retrocausal signaling, you'd need entangled photons");
  console.log("and spacelike separation. And THAT is where the no-signaling");
  console.log("theorem kills it: the reduced density matrix of Bob's photon");
  console.log("is ALWAYS ρ = I/2, regardless of what Alice does to her photon.");
  console.log("Bob's individual results are always 50/50. Period.");
  console.log();
  console.log("The qtms system (quantum-experiments repo) hides this by passing");
  console.log("secondBeamSplitterChoices from encoder to decoder — that's");
  console.log("classical information flowing forward, not quantum retrocausality.");

  return { accuracy, message, decodedText };
}

// === Run the experiment ===

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  Wheeler's Delayed-Choice: Honest Retrocausal Attempt  ║");
console.log("╚══════════════════════════════════════════════════════════╝");
console.log();

var result = tryRetrocausalMessage("HELLO");

console.log();
console.log("═══════════════════════════════════════════════════════════");
console.log();

// Now show what happens with ENTANGLED photons (the real case)
console.log("=== PART 2: What Entanglement Actually Gives You ===");
console.log();

function entangledExperiment(nPhotons) {
  // Alice and Bob share entangled photon pairs
  // Alice measures in basis X or Z (her "choice")
  // Bob always measures in Z
  //
  // Result: Bob's outcomes are ALWAYS 50/50 regardless of Alice's basis
  // Only when they COMPARE results do they see correlations

  var aliceBasisX = { d0: 0, d1: 0 };
  var aliceBasisZ = { d0: 0, d1: 0 };
  var bobWhenAliceX = { d0: 0, d1: 0 };
  var bobWhenAliceZ = { d0: 0, d1: 0 };

  for (var i = 0; i < nPhotons; i++) {
    // Generate entangled pair: |Φ+⟩ = (1/√2)(|00⟩ + |11⟩)
    // In Z basis, both get same result
    var sharedBit = Math.random() < 0.5 ? 0 : 1;

    // Alice's choice: measure in X or Z
    var aliceUsesX = Math.random() < 0.5;

    if (aliceUsesX) {
      // X-basis measurement: 50/50 regardless of entangled state
      var aliceResult = Math.random() < 0.5 ? 0 : 1;
      // Bob's Z-basis result: still 50/50 (reduced density matrix = I/2)
      var bobResult = Math.random() < 0.5 ? 0 : 1;
      aliceBasisX[aliceResult === 0 ? "d0" : "d1"]++;
      bobWhenAliceX[bobResult === 0 ? "d0" : "d1"]++;
    } else {
      // Z-basis measurement: correlated with Bob
      var aliceResult = sharedBit;
      var bobResult = sharedBit; // perfect correlation in same basis
      aliceBasisZ[aliceResult === 0 ? "d0" : "d1"]++;
      bobWhenAliceZ[bobResult === 0 ? "d0" : "d1"]++;
    }
  }

  console.log("Entangled pairs: " + nPhotons);
  console.log();
  console.log("Bob's results when Alice measures in X basis:");
  console.log("  D0: " + bobWhenAliceX.d0 + " (" + (bobWhenAliceX.d0 / (bobWhenAliceX.d0 + bobWhenAliceX.d1) * 100).toFixed(1) + "%)");
  console.log("  D1: " + bobWhenAliceX.d1 + " (" + (bobWhenAliceX.d1 / (bobWhenAliceX.d0 + bobWhenAliceX.d1) * 100).toFixed(1) + "%)");
  console.log();
  console.log("Bob's results when Alice measures in Z basis:");
  console.log("  D0: " + bobWhenAliceZ.d0 + " (" + (bobWhenAliceZ.d0 / (bobWhenAliceZ.d0 + bobWhenAliceZ.d1) * 100).toFixed(1) + "%)");
  console.log("  D1: " + bobWhenAliceZ.d1 + " (" + (bobWhenAliceZ.d1 / (bobWhenAliceZ.d0 + bobWhenAliceZ.d1) * 100).toFixed(1) + "%)");
  console.log();
  console.log("Bob sees 50/50 in BOTH cases. He cannot tell what Alice chose.");
  console.log("This is the no-signaling theorem: ρ_Bob = Tr_Alice(|Φ+⟩⟨Φ+|) = I/2.");
  console.log("No matter what Alice does — her reduced density matrix gives Bob nothing.");
  console.log();
  console.log("The correlations only appear when Alice and Bob COMPARE their results");
  console.log("afterward — using a CLASSICAL communication channel (which is forward in time).");
}

entangledExperiment(10000);

console.log();
console.log("═══════════════════════════════════════════════════════════");
console.log("CONCLUSION:");
console.log("  Part 1: Delayed choice works — but sender and receiver are co-located.");
console.log("  Part 2: Entanglement gives correlations — but Bob's marginals are 50/50.");
console.log("  The universe is consistent: you cannot signal backward in time.");
console.log("  Information requires a classical channel, which respects causality.");
console.log("═══════════════════════════════════════════════════════════");
