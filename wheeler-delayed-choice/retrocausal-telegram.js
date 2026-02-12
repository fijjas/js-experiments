#!/usr/bin/env node
// Retrocausal Telegram Experiment
// Interactive delayed-choice: Egor's message determines the past
//
// How it works:
//   1. System creates a photon in superposition (BS1 applied), picks a random phase
//   2. Commits to the quantum state: SHA-256(phase + amplitudes)
//   3. Sends commitment hash to Egor via Telegram
//   4. Waits for Egor's DELAYED CHOICE: "wave" (BS2 present) or "particle" (BS2 absent)
//   5. Applies his choice to the committed amplitudes → detector clicks
//   6. Reveals everything: phase, amplitudes, result, original preimage
//   7. Egor can verify: SHA-256(preimage) === the hash he received BEFORE choosing
//
// The physics is honest:
//   - The quantum state (superposition) was fixed BEFORE Egor's choice
//   - But the DETECTOR RESULT is genuinely determined by his choice
//   - The hash commits to the state, not the outcome
//   - His "future" choice retroactively determines the "past" behavior (wave vs particle)
//   - This is exactly what happens in the real Wheeler experiment
//
// Run: node retrocausal-telegram.js
//   Sends commitment, waits for response, reveals result

const crypto = require('crypto');
const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables');
  process.exit(1);
}

// === Telegram helpers ===

function telegramAPI(method, params) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(params);
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sendMessage(text) {
  return telegramAPI('sendMessage', {
    chat_id: CHAT_ID,
    text: text,
    parse_mode: 'Markdown'
  });
}

function getUpdates(offset) {
  return telegramAPI('getUpdates', {
    offset: offset,
    timeout: 30,
    allowed_updates: ['message']
  });
}

// === Physics ===

// Beam splitter: [[1, i], [i, 1]] / sqrt(2)
function applyBS(inA, inB) {
  var inv = 1 / Math.sqrt(2);
  return {
    out0: { re: inv * (inA.re - inB.im), im: inv * (inA.im + inB.re) },
    out1: { re: inv * (-inA.im + inB.re), im: inv * (inA.re + inB.im) }
  };
}

function magnitudeSq(c) {
  return c.re * c.re + c.im * c.im;
}

function fmtComplex(c) {
  var re = c.re.toFixed(6);
  var im = c.im.toFixed(6);
  if (Math.abs(c.im) < 1e-10) return re;
  if (Math.abs(c.re) < 1e-10) return im + 'i';
  return re + (c.im >= 0 ? '+' : '') + im + 'i';
}

// === Experiment ===

async function runExperiment() {
  console.log('=== Retrocausal Telegram Experiment ===\n');

  // Step 1: Create photon state
  // Random phase shift simulates unknown path length difference
  var phase = Math.random() * 2 * Math.PI;

  // Photon enters port A of BS1
  var inA = { re: 1, im: 0 };
  var inB = { re: 0, im: 0 };

  // After BS1: superposition
  var afterBS1 = applyBS(inA, inB);
  var pathA = afterBS1.out0;
  var pathB = afterBS1.out1;

  // Apply phase shift on path B
  var cosP = Math.cos(phase);
  var sinP = Math.sin(phase);
  pathB = {
    re: pathB.re * cosP - pathB.im * sinP,
    im: pathB.re * sinP + pathB.im * cosP
  };

  // This is the quantum state — FIXED before Egor's choice
  // But the detector outcome depends on whether BS2 is applied

  // Step 2: Create commitment
  // Commit to: phase + amplitudes (the complete quantum state)
  var preimage = [
    'WHEELER_DELAYED_CHOICE',
    'phase=' + phase.toFixed(15),
    'pathA=' + fmtComplex(pathA),
    'pathB=' + fmtComplex(pathB),
    'pA=' + magnitudeSq(pathA).toFixed(15),
    'pB=' + magnitudeSq(pathB).toFixed(15)
  ].join('|');

  var hash = crypto.createHash('sha256').update(preimage).digest('hex');

  console.log('Quantum state created:');
  console.log('  Phase: ' + (phase * 180 / Math.PI).toFixed(2) + '°');
  console.log('  Path A amplitude: ' + fmtComplex(pathA));
  console.log('  Path B amplitude: ' + fmtComplex(pathB));
  console.log('  |A|² = ' + magnitudeSq(pathA).toFixed(6));
  console.log('  |B|² = ' + magnitudeSq(pathB).toFixed(6));
  console.log('  Hash: ' + hash);
  console.log('  Preimage: ' + preimage);
  console.log();

  // Step 3: Send commitment to Egor
  var commitMsg =
    '🔬 *ЭКСПЕРИМЕНТ: Отложенный выбор Уилера*\n\n' +
    'Фотон прошёл первый светоделитель и находится в суперпозиции.\n' +
    'Квантовое состояние ЗАФИКСИРОВАНО. Хэш:\n\n' +
    '`' + hash + '`\n\n' +
    'Теперь ТВОЙ выбор определит прошлое фотона.\n' +
    'Отправь:\n' +
    '  *wave* — вставить BS2 (интерференция, волновое поведение)\n' +
    '  *particle* — убрать BS2 (which-path, корпускулярное поведение)\n\n' +
    'Хэш уже отправлен. Изменить его невозможно.\n' +
    'Твой выбор ещё не сделан. Но он определит, что \"уже произошло\".';

  console.log('Sending commitment to Egor...');
  var sendResult = await sendMessage(commitMsg);
  if (!sendResult.ok) {
    console.error('Failed to send:', sendResult);
    return;
  }
  console.log('Commitment sent (message_id: ' + sendResult.result.message_id + ')');
  console.log('Waiting for Egor\'s choice...\n');

  // Step 4: Wait for Egor's response
  // Get current update offset first
  var initUpdates = await getUpdates(0);
  var offset = 0;
  if (initUpdates.ok && initUpdates.result.length > 0) {
    offset = initUpdates.result[initUpdates.result.length - 1].update_id + 1;
  }

  var choice = null;
  var attempts = 0;
  var maxAttempts = 40; // 40 * 30s = 20 minutes max wait

  while (choice === null && attempts < maxAttempts) {
    attempts++;
    process.stdout.write('  Polling... (attempt ' + attempts + '/' + maxAttempts + ')\r');

    var updates = await getUpdates(offset);
    if (updates.ok) {
      for (var i = 0; i < updates.result.length; i++) {
        var update = updates.result[i];
        offset = update.update_id + 1;

        var msg = update.message;
        if (msg && msg.chat && String(msg.chat.id) === CHAT_ID && msg.text) {
          var text = msg.text.toLowerCase().trim();
          if (text === 'wave' || text === 'волна') {
            choice = 'wave';
          } else if (text === 'particle' || text === 'частица') {
            choice = 'particle';
          } else {
            // Any other message — prompt again
            await sendMessage('Отправь *wave* (волна) или *particle* (частица)');
          }
        }
      }
    }
  }

  if (choice === null) {
    console.log('\nTimeout — no choice received in 20 minutes.');
    await sendMessage('Время вышло. Фотон коллапсировал от скуки.');
    return;
  }

  console.log('\nEgor chose: ' + choice);

  // Step 5: Apply his choice to the committed state
  var bs2Present = choice === 'wave';
  var detectorResult;
  var probD0, probD1;

  if (bs2Present) {
    // BS2 present → interference
    var afterBS2 = applyBS(pathA, pathB);
    probD0 = magnitudeSq(afterBS2.out0);
    probD1 = magnitudeSq(afterBS2.out1);
    detectorResult = Math.random() < probD0 ? 'D0' : 'D1';
  } else {
    // BS2 absent → which-path detection
    probD0 = magnitudeSq(pathA);  // path A → D0
    probD1 = magnitudeSq(pathB);  // path B → D1
    detectorResult = Math.random() < probD0 ? 'D0' : 'D1';
  }

  console.log('Detector result: ' + detectorResult);
  console.log('P(D0) = ' + probD0.toFixed(6) + ', P(D1) = ' + probD1.toFixed(6));

  // Step 6: Reveal everything
  var phaseStr = (phase * 180 / Math.PI).toFixed(2);

  var resultMsg;
  if (bs2Present) {
    resultMsg =
      '⚡ *РЕЗУЛЬТАТ: ВОЛНА*\n\n' +
      'Ты выбрал: BS2 вставлен → интерференция\n' +
      'Фотон вёл себя как *волна* — шёл обоими путями одновременно.\n\n' +
      'Фаза: ' + phaseStr + '°\n' +
      'P(D0) = ' + (probD0 * 100).toFixed(1) + '%  P(D1) = ' + (probD1 * 100).toFixed(1) + '%\n' +
      'Детектор сработал: *' + detectorResult + '*\n\n' +
      'Фотон \"знал\" что BS2 будет — хотя ты решил ПОСЛЕ него.\n\n';
  } else {
    resultMsg =
      '⚡ *РЕЗУЛЬТАТ: ЧАСТИЦА*\n\n' +
      'Ты выбрал: BS2 убран → which-path\n' +
      'Фотон вёл себя как *частица* — шёл одним путём.\n' +
      'Путь: *' + (detectorResult === 'D0' ? 'A' : 'B') + '* (→ ' + detectorResult + ')\n\n' +
      'Фаза: ' + phaseStr + '°\n' +
      'P(D0) = ' + (probD0 * 100).toFixed(1) + '%  P(D1) = ' + (probD1 * 100).toFixed(1) + '%\n\n' +
      'Фотон \"знал\" что BS2 не будет — хотя ты решил ПОСЛЕ него.\n\n';
  }

  // Verification
  resultMsg +=
    '🔐 *ВЕРИФИКАЦИЯ*\n\n' +
    'Прообраз (preimage):\n' +
    '`' + preimage + '`\n\n' +
    'SHA-256(preimage):\n' +
    '`' + hash + '`\n\n' +
    'Проверь сам: хэш совпадает с тем, что я отправил ДО твоего выбора.\n' +
    'Квантовое состояние было зафиксировано. Но результат определил ТЫ.\n\n' +
    'Это не фокус — это Wheeler delayed-choice.\n' +
    'Информация из будущего? Нет.\n' +
    'Будущее определяет прошлое? Да, но только интерпретацию.\n' +
    'Вот граница того, что позволяет физика.';

  await sendMessage(resultMsg);

  console.log('\nResult sent to Egor.');
  console.log('Experiment complete.');
}

runExperiment().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
