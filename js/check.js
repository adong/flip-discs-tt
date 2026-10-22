/* TT Flip Discs: the headless check of the rules and the CPU (window.game.check() in the page, or
   node tools/check.js in a terminal). On both boards (6 × 6 and 8 × 8) it checks:
     moves   move generation and flips on known positions (the start, a move that flips three ways at once, a row
             that must not wrap round to the next one, a square with nothing to close the line), and in hundreds of
             random games the rules' moves and flips agree with a separate, plain row-and-column version after
             every disc, with the disc counts always right
     passes  a made-up position where one side has no move and must pass (the other goes again); in the random
             games every pass is a side with no move while the other has one, and passes do turn up
     ends    a game ends exactly when neither side can move: a wipe-out (one colour left) ends early, a full board
             ends, the most discs wins, an even split is a draw, and no disc can go down after the end
     sharp   with 5 to 7 squares left, NORMAL always finds the best result (checked against a full search of
             every way the game can end, done with the plain version)
     strong  NORMAL beats EASY (at least 85% of the games on each board)
   opts.sabotage turns on one of FLP.sabotage's switches for the run, to prove the check can fail:
     nodiag (flips skip the diagonals), nopass (no passing: the game just ends), noend (the game never ends), weak
     (NORMAL plays like EASY). */
(function () {
  'use strict';
  const FLP = (globalThis.FLP = globalThis.FLP || {});
  const R = FLP.rules;
  const { D, L } = R;

  // a small seeded random, so a run can be repeated
  function mulberry(a) {
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- the plain version
  // The same rules written the slow, obvious way (rows and columns, bounds checked every step), to check the fast one.

  function plainFlips(b, n, cell, color) {
    if (b[cell]) return [];
    const r0 = Math.floor(cell / n), c0 = cell % n, out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const line = [];
        let r = r0 + dr, c = c0 + dc;
        while (r >= 0 && r < n && c >= 0 && c < n && b[r * n + c] === 3 - color) {
          line.push(r * n + c);
          r += dr;
          c += dc;
        }
        if (line.length && r >= 0 && r < n && c >= 0 && c < n && b[r * n + c] === color) out.push(...line);
      }
    }
    return out.sort((x, y) => x - y);
  }
  function plainMoves(b, n, color) {
    const out = [];
    for (let i = 0; i < n * n; i++) if (plainFlips(b, n, i, color).length) out.push(i);
    return out;
  }
  // the best disc difference `color` (to move) can get from here with perfect play on both sides
  function plainSolve(b, n, color, passed) {
    const ms = plainMoves(b, n, color);
    if (!ms.length) {
      if (passed) {
        let d = 0;
        for (const v of b) if (v) d += v === color ? 1 : -1;
        return d;
      }
      return -plainSolve(b, n, 3 - color, true);
    }
    let best = -Infinity;
    for (const m of ms) {
      const f = plainFlips(b, n, m, color);
      const nb = b.slice();
      nb[m] = color;
      for (const i of f) nb[i] = color;
      best = Math.max(best, -plainSolve(nb, n, 3 - color, false));
    }
    return best;
  }

  // ---------------------------------------------------------------- helpers

  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  const sorted = (a) => a.slice().sort((x, y) => x - y);
  // a board from rows of text: . empty, x dark, o light
  function board(rows) {
    const n = rows.length, b = [];
    for (const row of rows) for (const ch of row.replace(/ /g, '')) b.push(ch === 'x' ? D : ch === 'o' ? L : 0);
    if (b.length !== n * n) throw new Error('bad test board');
    return b;
  }
  function stateOf(rows, turn) {
    const b = board(rows), st = R.newGame(rows.length);
    st.board = b;
    st.turn = turn;
    R.refresh(st, turn);
    return st;
  }
  const at = (n, r, c) => r * n + c;

  // ---------------------------------------------------------------- the checks

  function check(opts = {}) {
    const games = opts.games || 24, seed = opts.seed === undefined ? 20261021 : opts.seed;
    const rnd = mulberry(seed);
    const sab = opts.sabotage;
    const out = { ok: true, sabotage: sab || null, seed, problems: [] };
    const bad = (msg) => {
      out.ok = false;
      if (out.problems.length < 12) out.problems.push(msg);
    };
    if (sab && !(sab in FLP.sabotage)) throw new Error('unknown sabotage: ' + sab);
    if (sab) FLP.sabotage[sab] = true;
    try {
      for (const n of [6, 8]) out['b' + n] = checkBoard(n, games, rnd, bad);
    } finally {
      if (sab) FLP.sabotage[sab] = false;
    }
    return out;
  }

  function checkBoard(n, games, rnd, bad) {
    const res = {};
    const tag = `${n}×${n}`;
    const m = n / 2;

    // ---- moves: known positions
    {
      const known = [];
      // the start: dark has exactly the four usual squares, each flipping one disc; light the same
      const st = R.newGame(n, { first: D });
      const dark = sorted([at(n, m - 2, m - 1), at(n, m - 1, m - 2), at(n, m, m + 1), at(n, m + 1, m)]);
      const light = sorted([at(n, m - 2, m), at(n, m - 1, m + 1), at(n, m, m - 2), at(n, m + 1, m - 1)]);
      known.push(['start, dark', same(sorted(R.moves(st, D)), dark)]);
      known.push(['start, light', same(sorted(R.moves(st, L)), light)]);
      known.push(['start, one flip each', dark.every((c) => R.flips(st, c, D).length === 1) && light.every((c) => R.flips(st, c, L).length === 1)]);
      // dark at the top middle of the start flips the light disc under it
      known.push(['start, the right disc flips', same(R.flips(st, at(n, m - 2, m - 1), D), [at(n, m - 1, m - 1)])]);
      // three ways at once: across (2 discs), up (1), corner to corner (2); and lines that don't close don't flip
      const rows = Array.from({ length: n }, () => '.'.repeat(n).split(''));
      const put = (r, c, ch) => (rows[r][c] = ch);
      const r0 = 3, c0 = 1;
      put(r0, c0 + 1, 'o'); put(r0, c0 + 2, 'o'); put(r0, c0 + 3, 'x'); // across
      put(r0 - 1, c0, 'o'); put(r0 - 2, c0, 'x'); // up
      put(r0 + 1, c0 + 1, 'o'); put(r0 + 2, c0 + 2, 'x'); // corner to corner, down-right
      if (n >= 8) { put(r0 + 2, c0 + 2, 'o'); put(r0 + 3, c0 + 3, 'x'); }
      put(r0 + 1, c0 - 1, 'o'); // down-left: runs off the board, so it doesn't flip
      put(r0 - 1, c0 + 1, 'o'); // up-right: light then empty, nothing to close it
      const st3 = stateOf(rows.map((r) => r.join('')), D);
      const flip3 = sorted(R.flips(st3, at(n, r0, c0), D));
      const expect3 = sorted([at(n, r0, c0 + 1), at(n, r0, c0 + 2), at(n, r0 - 1, c0), at(n, r0 + 1, c0 + 1)].concat(n >= 8 ? [at(n, r0 + 2, c0 + 2)] : []));
      known.push(['three ways at once', same(flip3, expect3)]);
      // playing it really turns those over, and the counts follow
      const before = { ...st3.count };
      const ev = R.play(st3, at(n, r0, c0));
      known.push(['the flips land', same(sorted(ev.flips), expect3) && expect3.every((c) => st3.board[c] === D) && st3.count[D] === before[D] + 1 + expect3.length && st3.count[L] === before[L] - expect3.length]);
      // a row must not wrap round: light at the end of a row, dark at the start of the next
      const wrap = Array.from({ length: n }, () => '.'.repeat(n));
      wrap[2] = '.'.repeat(n - 1) + 'o';
      wrap[3] = 'x' + '.'.repeat(n - 1);
      wrap[5] = 'xo' + '.'.repeat(n - 2); // so dark has some move and the game isn't over
      const stw = stateOf(wrap, D);
      known.push(['no wrapping round a row', !R.flips(stw, at(n, 2, n - 2), D).length && !R.isLegal(stw, at(n, 2, n - 2))]);
      // an empty corner with nothing to close the line is no move
      known.push(['nothing to close the line', !R.isLegal(st, 0) && !R.flips(st, at(n, m - 1, m - 1), D).length]);
      const failed = known.filter(([, ok]) => !ok).map(([name]) => name);
      res.known = `${known.length - failed.length}/${known.length}`;
      for (const f of failed) bad(`${tag} moves: ${f}`);
    }

    // ---- moves, passes and ends in random games, against the plain version
    {
      let discs = 0, passes = 0, wrong = 0, wrongPass = 0, wrongEnd = 0, stuck = 0, ended = 0, full = 0, early = 0, draws = 0, wipe = 0, afterEnd = 0;
      const runs = games * 12;
      for (let g = 0; g < runs; g++) {
        const st = R.newGame(n, { first: g % 2 ? L : D });
        let guard = 0;
        while (!st.over && guard++ < n * n * 2) {
          const me = st.turn;
          const pm = plainMoves(st.board, n, me), fm = sorted(R.moves(st, me));
          if (!same(pm, fm)) {
            wrong++;
            if (!pm.length) break;
          }
          if (!pm.length) {
            // the rules say it's my turn but I can't go: a pass that never happened, or an end that never came
            stuck++;
            break;
          }
          const cell = pm[Math.floor(rnd() * pm.length)];
          const pf = plainFlips(st.board, n, cell, me);
          let ev;
          try {
            ev = R.play(st, cell);
          } catch (e) {
            wrong++;
            break;
          }
          discs++;
          if (!same(sorted(ev.flips), pf)) wrong++;
          let cd = 0, cl = 0;
          for (const v of st.board) if (v === D) cd++; else if (v === L) cl++;
          if (cd !== st.count[D] || cl !== st.count[L]) wrong++;
          const nextHas = plainMoves(st.board, n, 3 - me).length > 0, meHas = plainMoves(st.board, n, me).length > 0;
          if (ev.pass) {
            passes++;
            if (ev.pass !== 3 - me || nextHas || !meHas || st.turn !== me) wrongPass++;
          } else if (!st.over) {
            if (!nextHas || st.turn !== 3 - me) wrongPass++;
          }
          if (st.over && (nextHas || meHas)) wrongEnd++;
          if (!st.over && !nextHas && !meHas) wrongEnd++;
        }
        if (!st.over) {
          stuck++;
          continue;
        }
        ended++;
        const cd = st.count[D], cl = st.count[L];
        if (cd + cl === n * n) full++;
        else early++;
        if (!cd || !cl) wipe++;
        const want = cd > cl ? D : cl > cd ? L : 0;
        if (st.winner !== want) wrongEnd++;
        if (!want) draws++;
        // nothing goes down after the end
        let refused = false;
        try {
          R.play(st, st.board.indexOf(0) >= 0 ? st.board.indexOf(0) : 0);
        } catch (e) {
          refused = true;
        }
        if (!refused) afterEnd++;
      }
      res.random = { games: runs, discs, passes, ended, full, early, wipeouts: wipe, draws };
      if (wrong) bad(`${tag} moves: ${wrong} moves or flips disagree with the plain version`);
      if (wrongPass) bad(`${tag} passes: ${wrongPass} turns went to the wrong side`);
      if (!passes) bad(`${tag} passes: no pass in ${runs} random games`);
      if (wrongEnd) bad(`${tag} ends: ${wrongEnd} games ended wrong (or not when they should)`);
      if (stuck) bad(`${tag} ends: ${stuck} games got stuck`);
      if (afterEnd) bad(`${tag} ends: ${afterEnd} games took a disc after the end`);
    }

    // ---- passes and ends: made-up positions
    {
      const ok = [];
      // dark takes the top row's light disc: light has nothing left it can do, so light passes and dark goes again;
      // then dark takes the last light disc: none left, the end, dark wins 6 - 0
      const rows = Array.from({ length: n }, () => '.'.repeat(n));
      rows[0] = 'xo' + '.'.repeat(n - 2);
      rows[n - 1] = '.'.repeat(n - 2) + 'ox';
      const st = stateOf(rows, D);
      let e1 = null, e2 = null;
      try {
        e1 = R.play(st, at(n, 0, 2));
        if (!st.over) e2 = R.play(st, at(n, n - 1, n - 3));
      } catch (e) { /* counted below */ }
      ok.push(['light must pass', !!e1 && e1.pass === L && st.hist.length >= 1 && st.hist[0].pass === L]);
      ok.push(['dark goes again', !!e1 && !e1.over && !!e2]);
      ok.push(['wipe-out ends the game', !!e2 && e2.over && st.over && st.winner === D && st.count[D] === 6 && st.count[L] === 0]);
      // undo puts it all back, pass included
      if (e2) {
        R.undo(st);
        R.undo(st);
      }
      ok.push(['undo puts it back', same(st.board, board(rows)) && st.turn === D && !st.over && st.count[D] === 2 && st.count[L] === 2]);
      // a full board split evenly is a draw; one disc more is a win
      const half = n * n / 2;
      const fullRows = [];
      for (let r = 0; r < n; r++) fullRows.push(r < n / 2 ? 'x'.repeat(n) : 'o'.repeat(n));
      const sd = stateOf(fullRows, D);
      ok.push(['even full board is a draw', sd.over && sd.winner === 0 && sd.count[D] === half]);
      fullRows[n - 1] = 'x' + 'o'.repeat(n - 1);
      const sw = stateOf(fullRows, L);
      ok.push(['one more disc wins', sw.over && sw.winner === D]);
      const failed = ok.filter(([, v]) => !v).map(([k]) => k);
      res.made = `${ok.length - failed.length}/${ok.length}`;
      for (const f of failed) bad(`${tag} passes / ends: ${f}`);
    }

    // ---- sharp: NORMAL plays the end perfectly
    {
      let tried = 0, right = 0;
      const want = Math.max(4, games);
      for (let g = 0; g < want * 3 && tried < want; g++) {
        const st = R.newGame(n, { first: g % 2 ? L : D });
        const stopAt = 5 + (g % 3); // 5 to 7 empty squares left
        while (!st.over && R.empties(st) > stopAt) R.play(st, R.cpuMove(st, 'easy', rnd));
        if (st.over || R.moves(st).length < 2) continue;
        tried++;
        const best = plainSolve(st.board.slice(), n, st.turn, false);
        const mv = R.cpuMove(st, 'normal', rnd);
        const b = st.board.slice(), f = plainFlips(b, n, mv, st.turn);
        if (!f.length) continue;
        b[mv] = st.turn;
        for (const i of f) b[i] = st.turn;
        const got = -plainSolve(b, n, 3 - st.turn, false);
        if (got === best) right++;
      }
      res.sharp = `${right}/${tried}`;
      if (right < tried) bad(`${tag} sharp: NORMAL missed the best end in ${tried - right} of ${tried} positions`);
    }

    // ---- strong: NORMAL against EASY, and every CPU move legal
    {
      let wins = 0, draws = 0, illegal = 0;
      for (let g = 0; g < games; g++) {
        const normal = g % 2 ? D : L;
        const st = R.newGame(n, { first: g % 4 < 2 ? D : L });
        let guard = 0;
        while (!st.over && guard++ < n * n * 2) {
          const mv = R.cpuMove(st, st.turn === normal ? 'normal' : 'easy', rnd);
          if (!R.isLegal(st, mv)) {
            illegal++;
            break;
          }
          R.play(st, mv);
        }
        if (st.winner === normal) wins++;
        else if (st.over && !st.winner) draws++;
      }
      res.strong = { games, normalWins: wins, draws, rate: +(wins / games).toFixed(2) };
      if (illegal) bad(`${tag} strong: ${illegal} illegal CPU moves`);
      if (wins / games < 0.85) bad(`${tag} strong: NORMAL beat EASY in only ${wins} of ${games} games`);
    }
    return res;
  }

  // ---------------------------------------------------------------- win rates (how EASY was tuned)

  // test bots that play a bit like the boys: "little" (5) taps any square his brother's dots show, sometimes the
  // one that flips the most, and takes a corner now and then; "kid" (8) always takes a corner, keeps off the squares
  // next to an empty corner when he can, and likes flipping lots; "+tips" also calls his brother now and then
  function botMove(st, kind, rnd) {
    const ms = R.moves(st);
    if (!ms.length) return -1;
    // "+tips": calls his brother on a third of his turns and plays the glowing square
    if (kind.endsWith('+tips')) {
      if (rnd() < 1 / 3) return R.hint(st).cell;
      kind = kind.slice(0, -5);
    }
    const g = R.geom(st.n);
    const pickOf = (a) => a[Math.floor(rnd() * a.length)];
    const most = (a) => {
      let top = -1, best = [];
      for (const m of a) {
        const k = R.flips(st, m).length;
        if (k > top) {
          top = k;
          best = [m];
        } else if (k === top) best.push(m);
      }
      return pickOf(best);
    };
    const corners = ms.filter((m) => g.corners.includes(m));
    if (kind === 'little') {
      if (corners.length && rnd() < 0.3) return pickOf(corners);
      return rnd() < 0.25 ? most(ms) : pickOf(ms);
    }
    if (corners.length) return pickOf(corners);
    const risky = (m) => {
      const r = Math.floor(m / st.n), c = m % st.n, n = st.n;
      const near = (a, b) => Math.min(a, n - 1 - a) <= 1 && Math.min(b, n - 1 - b) <= 1;
      if (!near(r, c)) return false;
      const cr = r < n / 2 ? 0 : n - 1, cc = c < n / 2 ? 0 : n - 1;
      return !st.board[cr * n + cc];
    };
    const safe = ms.filter((m) => !risky(m));
    const pool = safe.length ? safe : ms;
    return rnd() < 0.5 ? most(pool) : pickOf(pool);
  }

  function rates(games = 100, sizes = [6, 8]) {
    const rnd = mulberry(7);
    const out = {};
    for (const n of sizes) {
      for (const [bot, level] of [['little', 'easy'], ['little+tips', 'easy'], ['kid', 'easy'], ['kid', 'normal'], ['kid+tips', 'normal']]) {
        let w = 0, d = 0;
        for (let g = 0; g < games; g++) {
          const me = g % 2 ? D : L;
          const st = R.newGame(n, { first: g % 4 < 2 ? D : L });
          while (!st.over) R.play(st, st.turn === me ? botMove(st, bot, rnd) : R.cpuMove(st, level, rnd));
          if (st.winner === me) w++;
          else if (!st.winner) d++;
        }
        out[`${n}x${n} ${bot} vs ${level}`] = `${Math.round((100 * w) / games)}% wins, ${Math.round((100 * d) / games)}% draws`;
      }
    }
    return out;
  }

  FLP.check = check;
  FLP.rates = rates;
  FLP.botMove = botMove;
})();
