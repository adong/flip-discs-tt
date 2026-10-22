/* TT Flip Discs: the game's own sounds, built on Kit.sound.tone / hiss (all synthesised, no files).
   FLP.sfx.kit(name, ...args) plays a kit effect; the rest are ours. Every call is a silent no-op until
   Kit.sound.init() has run from the first tap. */
(function () {
  'use strict';
  const FLP = (window.FLP = window.FLP || {});
  const S = Kit.sound;
  const tone = (o) => S.tone(o);
  const hiss = (o) => S.hiss(o);

  const sfx = {
    kit(name, ...args) {
      if (S[name]) S[name](...args);
    },
    // a disc lands on the felt: a soft clack
    place(color) {
      const f = color === 1 ? 1250 : 1100;
      tone({ type: 'triangle', f, to: f * 0.55, dur: 0.05, vol: 0.16 });
      tone({ type: 'sine', f: 330, to: 230, dur: 0.09, vol: 0.12 });
      hiss({ filter: 'bandpass', f: 2600, q: 1.4, dur: 0.04, vol: 0.1 });
    },
    // one disc turns over: a little flick, a step higher for every disc in the same move
    flip(k = 0) {
      const f = 660 * Math.pow(2, Math.min(k, 12) / 12);
      tone({ type: 'triangle', f, to: f * 1.5, dur: 0.07, vol: 0.07 });
      hiss({ filter: 'bandpass', f: 4200, q: 2, dur: 0.03, vol: 0.05 });
    },
    // a disc taken back: a quick whoop up
    undo() {
      hiss({ f: 900, to: 3600, dur: 0.22, vol: 0.06, q: 1.2 });
      tone({ type: 'triangle', f: 330, to: 880, dur: 0.22, vol: 0.07 });
    },
    // the cursor or the square under the mouse moves
    tick() { tone({ type: 'square', f: 1200, dur: 0.025, vol: 0.02, lp: 3000 }); },
    // can't go there
    nope() {
      tone({ f: 220, dur: 0.08, vol: 0.08 });
      tone({ f: 180, dur: 0.1, vol: 0.08, at: 0.09 });
    },
    // Foxy is thinking: a soft hum
    think() { tone({ type: 'triangle', f: 247, to: 294, dur: 0.35, vol: 0.05 }); },
    // nowhere to go: a boing down
    pass() {
      tone({ type: 'triangle', f: 520, to: 260, dur: 0.28, vol: 0.09 });
      tone({ type: 'triangle', f: 390, to: 196, dur: 0.3, vol: 0.06, at: 0.12 });
    },
    // a good move: a little rising chime
    nice() { [784, 988, 1319].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.06, dur: 0.18, vol: 0.1 })); },
    // a corner: a bright fanfare
    corner() {
      [659, 880, 1109, 1319].forEach((f, i) => tone({ type: 'square', f, at: i * 0.07, dur: 0.12, vol: 0.05, lp: 3500 }));
      hiss({ filter: 'highpass', f: 6000, at: 0.25, dur: 0.25, vol: 0.04 });
    },
    // a corner is free for you: a soft "ding ding" (call your brother!)
    chance() {
      tone({ type: 'triangle', f: 988, dur: 0.12, vol: 0.07 });
      tone({ type: 'triangle', f: 1319, dur: 0.18, vol: 0.07, at: 0.13 });
    },
    // the most discs
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'square', f, at: i * 0.11, dur: 0.16, vol: 0.05, lp: 3000 }));
      [523, 659, 784].forEach((f) => tone({ type: 'triangle', f: f * 2, at: 0.46, dur: 0.6, vol: 0.08 }));
      hiss({ filter: 'highpass', f: 6000, at: 0.46, dur: 0.5, vol: 0.06 });
      [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'triangle', f, at: 0.9 + i * 0.09, dur: 0.3, vol: 0.08 }));
    },
    // Foxy won: a soft wah-wah, never harsh
    lose() {
      [392, 370, 349, 311].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.22, dur: i === 3 ? 0.5 : 0.22, vol: 0.09 }));
    },
    draw() {
      tone({ type: 'triangle', f: 523, dur: 0.14, vol: 0.09 });
      tone({ type: 'triangle', f: 523, dur: 0.22, vol: 0.09, at: 0.16 });
    },
    // your brother pops in (and out)
    pop() {
      tone({ f: 300, to: 900, dur: 0.12, vol: 0.1 });
      hiss({ f: 2000, to: 6000, dur: 0.15, vol: 0.05 });
    },
    // the high five: a clap
    clap() {
      hiss({ filter: 'bandpass', f: 1500, q: 0.8, dur: 0.09, vol: 0.22 });
      hiss({ filter: 'highpass', f: 3000, dur: 0.05, vol: 0.1, at: 0.01 });
    },
  };

  FLP.sfx = sfx;
})();
