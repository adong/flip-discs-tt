#!/usr/bin/env node
/* Run the headless checks from a terminal, with the same rules and CPU files the page loads (js/rules.js, js/check.js).
     node tools/check.js                     the checks (24 games per board for the strength check, 12x that at random)
     node tools/check.js 60                  the same with 60
     node tools/check.js --sabotage nodiag   proves the moves check can fail: flips skip the diagonals
     node tools/check.js --sabotage nopass   proves the passes check can fail: no passing, the game just ends
     node tools/check.js --sabotage noend    proves the ends check can fail: the game never ends
     node tools/check.js --sabotage weak     proves the strength check can fail: NORMAL plays like EASY
     node tools/check.js rates [games]       win rates of the kids' test bots against both levels (how they were tuned)
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Number, JSON, Object, Array, Map, Set, Error, Infinity, Int8Array, Int16Array };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['js/rules.js', 'js/check.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
}
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : undefined;
};
const t0 = Date.now();
if (args[0] === 'rates') {
  console.log(JSON.stringify(ctx.FLP.rates(+(args[1] || 100)), null, 1));
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  process.exit(0);
}
const out = ctx.FLP.check({
  games: +(args.find((a) => /^\d+$/.test(a)) || 24),
  sabotage: opt('sabotage'),
  seed: opt('seed') ? +opt('seed') : undefined,
});
out.seconds = +((Date.now() - t0) / 1000).toFixed(1);
console.log(JSON.stringify(out, null, 1));
console.log(out.ok ? 'CHECK PASSED' : 'CHECK FAILED');
process.exitCode = out.ok ? 0 : 1;
