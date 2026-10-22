/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: window.FLP_TITLE, // the name lives in js/title.js
  button: { top: 'var(--kh-top)' }, // index.html moves it (and the language button) to the bottom left on tall screens
  keys: [
    ['move round the board · put your disc there', '← ↑ → ↓ · Enter or Space'],
    ['undo', 'U'],
    ['call your brother (2 players: high five)', 'T'],
    ['new game', 'R'],
    ['pause · sound', 'P or Esc · M'],
    ['menu: LITTLE 6 × 6 · BIG 8 × 8', '1 · 2'],
    ['menu: Teddy or Tommy · 1 or 2 players · level', '← → · ↑ ↓ · L'],
    ['menu: undo button on or off · dots on or off', 'U · D'],
  ],
  note: 'Put your disc down so it traps the other colour in a line, at both ends: across, up and down, or corner to corner. Every trapped disc flips over to your colour! No square that traps any? Then you pass. When nobody can go, the most discs wins. Teddy is dark blue 🏀, Tommy is cream ✌️.',
  touch: 'Press a square to see your disc and what it would flip, slide to another, let go to put it down. The dots show where you can go. Tap your brother\'s face (bottom right) to call him.',
});
Kit.lang.setup({ button: { top: 'var(--kl-top)' } });
