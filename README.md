# TT Flip Discs

[![TT Flip Discs title screen](docs/screenshot.jpg)](https://adong.github.io/flip-discs-tt/)

Press **?** any time (or tap the round **?** button on the left edge) to see the keys. The game waits while you look.
Tap the language button under it (the A文 icon) to switch between English and 中文; the dashboard and every game remember the choice.

Put a disc down so it traps the other colour in a line, and every trapped disc flips over to yours. Teddy's dark blue discs against Tommy's cream ones, or against 🦊 Foxy, on a little 6×6 board or the big 8×8 one. The most discs wins. 1 or 2 players.

**中文：** 花园里的黑白棋：下一颗棋子，把对方的棋子夹在中间，被夹住的棋子就会翻转成你的颜色！Teddy 是深蓝色，Tommy 是奶油色，也可以和狐狸 Foxy 🦊 比。有 6×6 的小棋盘和 8×8 的大棋盘，最后谁的棋子多谁就赢。单人或双人。

A flip-the-discs board game starring Teddy and Tommy, built with Claude Code from plain JavaScript and Three.js on the shared Claude Games kit. The board stands on short legs on a straw mat in the garden (the garden from TT Gomoku): a wooden frame with green squares, a tray of discs beside each player. Every disc has two faces, a 🏀 on Teddy's side and a ✌️ on Tommy's, and turns over with a little hop when it's flipped. There are no image, model or audio files: the boys are the kit's blocky characters, Foxy is an emoji on a podium, every texture is painted on a canvas, and every sound is synthesised.

The name is a working title. It lives in one constant, `FLP_TITLE` in `js/title.js`, and the page title, the logo and the ? panel read it from there.

## Play

- **Double-click `index.html`.** It works offline because Three.js and the kit are copied into `kit/`. Without internet the title font falls back to Arial Black.
- **Send one file:** `dist/flip-discs-tt.html` is the whole game in one page. AirDrop or email it, then open it in a browser.
- Rebuild that file after any edit: `python3 kit/tools/bundle.py . --name flip-discs-tt`

## Rules

- **The start:** four discs in the middle, two of each colour, corner to corner. **Teddy is always dark blue** (a 🏀 on that face) and **Tommy is always cream** (a ✌️). Foxy plays the other colour, with a 🦊 on her face of the discs.
- **Your turn:** put a disc on an empty square so that one or more of the other colour's discs are trapped in a straight line between your new disc and another of yours: across, up and down, or corner to corner. Every trapped disc in every direction flips over to your colour, the nearest first. A square that traps nothing isn't a move.
- **No move? Pass.** If you can't trap anything anywhere, the game says so ("TEDDY CAN'T GO: PASS!"), you shrug, and the other side goes again.
- **The end:** when neither side can move (usually a full board), **the most discs wins** and the same number is a draw (平局). The winner's discs bounce in a wave, the winner does his signature move beside the board (Teddy's boxing combo or his 🏀 jump shot, in turn; Tommy's Y with peace fingers ✌️; Foxy spins), the loser does a silly shrug, and when a kid wins there's confetti. Then **PLAY AGAIN**.
- **The boards:** **LITTLE**, 6 × 6 (the default, for Tommy, with big squares), and **BIG**, the classic 8 × 8.
- **The score:** the scoreboard counts each side's discs, flip by flip. The games won keep running for the same two players on the same board (a 🏆 under each face, and on the game-over card) until the page is closed. **Who goes first swaps every game**; you go first in the first game (Teddy, in 2 players).
- **Helpers:**
  - **Dots** show every square you can go to (**DOTS** on the menu switches them off).
  - **Pressing shows before it plays:** while your finger (or the mouse button) is down on a square you can go to, a see-through disc sits there and the discs it would flip lift up and glow. Slide to another square, let go to play.
  - **↩️ Undo** (top left, or **U**) takes back your last disc. Against Foxy it also takes back her answer (and any passes), so it's your turn again. It works as often as you like until the game ends. **UNDO** on the menu switches the button off.
  - **A soft gold ring** shows the last disc played.
  - **Good moves get a cheer:** NICE! for flipping 4 or more, SUPER FLIP! for 6 or more, CORNER! for taking a corner (corners can never be flipped back).

### Who you play

- **1 player:** you pick Teddy or Tommy and play 🦊 **Foxy**.
  - **🐣 EASY** (the default, for Tommy, 5): Foxy grabs a corner she can see half the time (`EASY.corner`), plays the move that flips the most some of the time (`EASY.greedy`), and otherwise goes anywhere she can.
  - **🔥 NORMAL** (for Teddy, 8): Foxy searches ahead with alpha-beta: 3 moves on the little board and 2 on the big one (`NORMAL.depth`), scoring the squares (corners high, the squares next to an empty corner low), how many moves each side has, and the corners. With 8 or fewer empty squares left she plays the rest of the game perfectly. Between moves that score almost the same she picks at random, so games differ. A move takes her a few milliseconds.
- **2 players:** Teddy and Tommy take turns on one device.

## Controls

| | Keys | Touch |
|---|---|---|
| move round the board · put your disc there | ← ↑ → ↓ · Enter or Space | press a square, slide, let go |
| undo | U | ↩️ (top left) |
| call your brother (2 players: high five) | T | his face, bottom right (🙌 in 2 players) |
| new game | R | 🔄 on the pause screen |
| pause · sound | P or Esc · M | ⏸️ · 🔊 |
| menu: LITTLE 6 × 6 · BIG 8 × 8 | 1 · 2 | the two big tiles |
| menu: Teddy or Tommy · 1 or 2 players · level | ← → · ↑ ↓ · L | the buttons under the tiles |
| menu: undo button · dots | U · D | UNDO · DOTS |

- **The keyboard cursor** (a yellow square) starts on a square you can go to; Enter plays it.
- **The disc that bobs over a player's head** shows whose turn it is.
- **Square sizes** (one square to the next across the middle of the board, measured, LITTLE / BIG): iPad landscape 1024×768 91 / 68 px, iPad portrait 768×1024 88 / 66 px, phone upright 390×844 44 / 33 px, phone on its side 740×360 52 / 39 px. LITTLE is the phone board. On a tall screen the players stand behind the board and the round ? and language buttons move to the bottom left corner during a game; on a phone on its side the score moves to a column on the right.

## Call your brother (companion mode)

**1 player:** Foxy is the CPU, so your brother is free to help. Call him with **T** or by tapping his face (bottom right), **any time and as often as you like** (`Kit.roster.buddyFor`: Tommy for Teddy, Teddy for Tommy).

- **He pops in** beside the board in a puff of stars, at his roster `buddyScale`, with his name tag.
- **He says hi** with his signature move (Tommy's Y with peace fingers, Teddy's boxing combo) and **tosses you a treat** (🍦 💧 🧃 🍪 🍉 🍌) that arcs into your hand: "🧃 JUICE BOX FROM TOMMY!"
- **The best move glows:** he turns and points, the square lights up gold with a bouncing 👇 and a see-through disc, and the discs it would flip lift and glow. "TOMMY SAYS: GRAB THE CORNER!", "TOMMY SAYS: WIN HERE!" (near the end, when he has worked out that it wins), "TOMMY SAYS: ONLY HERE!" when there's just one square, otherwise "TOMMY SAYS: HERE!". His tip comes from a deeper search than Foxy's NORMAL (`HINT` in `js/rules.js`, with no randomness). If it's Foxy's turn when he arrives, he waits for yours.
- **Once you've played**, he does his goodbye move and pops out. Call him again while he's there and he says hi again, brings another treat and points again. After an undo he looks again.
- **When Foxy leaves a corner free for you**, his button wiggles (and a soft "ding ding" plays): a good time to call him.

**2 players:** both brothers are already at the board, so **T** (or 🙌) is a **high five**: they run together behind the board, slap hands (💥) and run back. It doesn't change the game.

## Make it yours

- `js/title.js`: the game's name.
- `js/rules.js`, near the top: `EASY` (how often Foxy takes a corner, how often she flips the most), `NORMAL` (search depth per board, when she starts playing the end perfectly, the node budget, the random margin) and `HINT` (the same for your brother's tip). The square weights are in `geom()`.
- `js/stage.js`: the garden, the board, the disc colours (`COL`) and emblems (`EMBLEM`), the flip timing (`FLIP`).

## How it works, and how it's tested

- `js/rules.js` has no Three.js and no page in it: the board, the moves and flips, passing and the end, both CPU levels, your brother's tip and the "good move" judge. The same file runs the game and the headless checks.
- Console hooks (`window.game`):

```js
game.start({ size: 8, players: 1, who: 'tommy', level: 'easy', undo: true, dots: true })   // straight into a game
game.tapRC(2, 3)         // put a disc on row 2, column 3 for the kid whose turn it is (game.tap(cell) with cell = row * size + col)
game.stage('0000…', 1)   // set up a board (0 empty, 1 dark, 2 light) with that colour to move
game.undo()              // the undo button
game.call()              // call your brother (2 players: high five)
game.step(2)             // advance 2 s and draw (when the browser tab's animation is throttled)
game.hold(true)          // freeze the live loop, so only game.step() moves time
game.auto(true, 'hint')  // a test bot plays the kid's side too ('easy', 'normal' or 'hint')
game.check()             // the headless checks below (game.rates() for the win rates)
game.info()              // state, the rules' board and the board as drawn, counts, score, the brother, the size of a square
```

The same checks run from a terminal with Node:

```bash
node tools/check.js 24
```

```bash
node tools/check.js 12 --sabotage nodiag
```

```bash
node tools/check.js 12 --sabotage nopass
```

```bash
node tools/check.js 12 --sabotage noend
```

```bash
node tools/check.js 12 --sabotage weak
```

```bash
node tools/check.js rates 200
```

On both boards:

- **moves:** move generation and flips on known positions: the start (exactly the four usual squares for each colour, each flipping one disc, the right one); a disc that flips three ways at once (across, up and corner to corner) while two other lines that don't close stay as they are; a light disc at the end of a row and a dark one at the start of the next must not count as a line (no wrapping round); a square with nothing to close the line is no move. Then hundreds of random games where, after every disc, the rules' moves and flips agree with a separate plain version written with rows and columns, and the disc counts are always right.
- **passes:** a made-up position where dark's move leaves light with nothing to trap, so light passes and dark goes again; undo puts it all back, pass included. In the random games every pass is a side with no move while the other has one, and passes do turn up.
- **ends:** a game ends exactly when neither side can move: that made-up game ends in a wipe-out (dark 6, light 0) before the board is full; random games end on full boards and early ones; an even full board is a draw and one disc more wins; no disc goes down after the end.
- **sharp:** with 5 to 7 empty squares left, 🔥 NORMAL always gets the best result there is, checked against a full search of every way the game can end (done with the plain version).
- **strong:** 🔥 NORMAL beats 🐣 EASY in at least 85% of games, and every CPU move is legal.
- **It can fail:** `--sabotage nodiag` makes flips skip the diagonals, `nopass` ends the game instead of passing, `noend` never ends it, `weak` makes NORMAL play like EASY. Each makes the check fail (see below), and `game.check({ sabotage: 'nodiag' })` fails in the page too.

- **At the last check** (`node tools/check.js 24`, under a second), 6×6 / 8×8: 8 / 8 known positions right; 288 random games each (9,199 / 17,276 discs) with every move and flip agreeing with the plain version, 151 / 122 passes all right, every game ended (275 / 284 full boards, 13 / 4 early, 13 / 14 draws); 6 / 6 made-up pass and end positions right; NORMAL got the best end 24 / 24 times; NORMAL beat EASY 24 / 24 and 23 / 24.
- **The sabotages** (`node tools/check.js 12 --sabotage …`), each fails: `nodiag` gets the three-way flip wrong, disagrees with the plain version on over 500 moves per board and leaves games stuck; `nopass` never passes, ends 42 to 46 games per board while a side could still move, and fails every made-up pass position; `noend` leaves every game stuck and a full board not over; `weak` misses the best end in about half the positions and beats EASY in only 3 / 12 and 6 / 12 games.
- **Win rates with bots** (`node tools/check.js rates 200`: 200 games each, the bot first and second in turn). Not a pass or fail check; it's how the levels were tuned. "little" plays like a 5-year-old (any square the dots show, sometimes the one that flips the most, a corner now and then); "kid" like an 8-year-old (always takes a corner, keeps off the squares next to an empty corner, likes flipping lots); "+tips" also calls his brother on a third of his turns.
  - 🐣 EASY: "little" wins 45% on 6×6 and 38% on 8×8 on his own, 65% / 67% with his brother's tips; "kid" wins 92% / 94%.
  - 🔥 NORMAL: "kid" wins 6% on 6×6 and 8% on 8×8 on his own, 16% / 12% with tips.
- **The browser** (muted): whole games on both boards and both levels through the real renderer (`game.auto`) to PLAY AGAIN and the next game, calling the brother every few seconds, with the board as drawn matching the rules' board and the scoreboard matching the counts, and no console errors; his treat, glow and toast; a pass ("FOXY CAN'T GO: PASS!") and a wipe-out end; undo in 1 player (your disc and Foxy's answer) and 2 players; the high five; arrows, Enter, U, P, Esc, M, R and ?; a synthetic touch press (the preview lifts the disc it would flip) and release. 中文: every screen visited (home in 1 and 2 players, the ? panel, games with each kind of tip, a pass, undo, pause, a win and a draw, 2 players and the high five), and `Kit.lang.untranslated()` stayed `[]` (a planted string was caught). English: no Chinese anywhere except the kit's language-button tooltip. Layouts by headless-Chrome screenshot at 390×844, 740×360, 1024×768 and 768×1024.
- **Offline:** `index.html` and `dist/flip-discs-tt.html` boot from `file://` in headless Chrome (`tools/shoot.js` with `tools/boot.json`), play a disc and Foxy's answer, and pass `game.check()`, with no page errors.

## Files

```
index.html               page, HUD, menus, panels (CSS inline)
js/title.js              the game's name (one constant)
js/rules.js              the rules, both CPU levels, your brother's tip, the good-move judge (no Three.js)
js/check.js              the headless checks, the test bots and the win-rate report (game.check, game.rates, tools/check.js)
js/stage.js              the garden, the board, the two-faced discs and their flips, the dots, the glows, the camera fit, picking
js/actor.js              a boy beside the board: poses, reactions, treats; 🦊 Foxy on her podium (from TT Four in a Row)
js/buddy.js              your brother's visit and tip, and the 2-player high five
js/fx.js                 emoji flyers, word bursts and confetti
js/sfx.js                the game's own synth sounds (on Kit.sound)
js/game.js               the menu, the games, passing, undo, the HUD, input, the loop and window.game
js/keys.js               the ? panel's keys (Kit.help)
js/zh.js                 the 中文 words (Kit.lang)
kit/                     the shared kit, copied by ../kit/tools/sync.py (don't edit here)
tools/check.js           the headless checks from a terminal (node)
tools/shoot.js           screenshots with headless Chrome (docs/screenshot.jpg: node tools/shoot.js tools/shots.json docs 1200 750)
tools/boot.json          the offline boot test for tools/shoot.js; tools/layouts.json the phone and iPad screenshots
dist/flip-discs-tt.html  the whole game in one page
```

## Not verified

- Sound: every test ran muted, so nothing was heard; the sounds were only checked in code.
- Real touch devices: touch was tested with synthetic pointer events and the layouts by screenshot, not on a real iPad or phone.
- How hard it really is for the boys: the win rates come from test bots, not from Teddy and Tommy. 🔥 NORMAL will beat Teddy most of the time without his brother's tips.
- Double-click from Finder, and the iPad home-screen icon.
