/* TT Flip Discs: the rules and the CPU. No Three.js and no page in here, so the headless check (js/check.js,
   tools/check.js) runs the very same file in Node.
   The board is n × n squares (8 × 8, or 6 × 6 for Tommy), cell = row * n + col, 0 empty, 1 dark, 2 light.
   Teddy is always dark (blue, 🏀), Tommy always light (cream, ✌️); 🦊 Foxy plays the other colour.
     newGame(n, { first })      the four discs in the middle, `first` to move
     flips(st, cell, color)     the discs a disc there would turn over ([] = you can't go there)
     moves(st, color)           every square `color` can play
     play(st, cell)             put a disc down and flip. Returns { cell, color, flips, pass, over }: `pass` is the
                                colour that has no move and must pass (the other side goes again), `over` when nobody
                                can move (the most discs wins, the same number is a draw)
     undo(st)                   take the last disc back (and un-flip); returns that move
     cpuMove(st, level)         Foxy's square: 'easy' or 'normal' (alpha-beta), -1 if she has none
     hint(st)                   your brother's tip: the best square (a deeper search than NORMAL's), and what kind it is
     judge(st, cell)            a word for a good move ('corner', 'super', 'nice') before it's played
   FLP.sabotage switches (nodiag, nopass, noend, weak) break one thing each, so the check can prove it fails. */
(function () {
  'use strict';
  const FLP = (globalThis.FLP = globalThis.FLP || {});
  const D = 1, L = 2;
  const other = (c) => 3 - c;
  const sabotage = { nodiag: false, nopass: false, noend: false, weak: false };

  // 🐣 EASY, for Tommy (5): grabs a corner she can see half the time, sometimes the move that flips the most,
  // otherwise anywhere she can go.
  const EASY = { corner: 0.5, greedy: 0.3 };
  // 🔥 NORMAL, for Teddy (8): looks `depth` moves ahead (alpha-beta, iterative deepening while the node budget
  // lasts), plays the last `exact` empty squares perfectly, and picks at random between moves within `margin` points.
  const NORMAL = { depth: { 6: 3, 8: 2 }, exact: { 6: 8, 8: 8 }, budget: 60000, margin: 8 };
  // your brother's tip looks further than NORMAL does, with no randomness
  const HINT = { depth: { 6: 6, 8: 4 }, exact: { 6: 12, 8: 10 }, budget: 90000 };

  // ---------------------------------------------------------------- the board's lines

  // For each board size: every square's eight rays (the squares going out from it in each direction), the
  // square weights NORMAL likes (corners high, the squares next to a corner low) and the corners.
  const geoms = {};
  const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  function geom(n) {
    if (geoms[n]) return geoms[n];
    const rays = [], weight = new Int16Array(n * n), corners = [0, n - 1, n * (n - 1), n * n - 1];
    const xsq = {}; // the diagonal square next to each corner -> its corner
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const list = [];
        for (const [dr, dc] of DIRS) {
          const ray = [];
          for (let rr = r + dr, cc = c + dc; rr >= 0 && rr < n && cc >= 0 && cc < n; rr += dr, cc += dc) ray.push(rr * n + cc);
          if (ray.length >= 2) list.push({ ray, diag: dr !== 0 && dc !== 0 });
        }
        rays.push(list);
        const er = Math.min(r, n - 1 - r), ec = Math.min(c, n - 1 - c);
        let w;
        if (er === 0 && ec === 0) w = 100;
        else if (er === 1 && ec === 1) w = -40;
        else if ((er === 0 && ec === 1) || (er === 1 && ec === 0)) w = -15;
        else if (er === 0 || ec === 0) w = ec === 2 || er === 2 ? 10 : 5;
        else if (er === 1 || ec === 1) w = -3;
        else w = -1;
        weight[r * n + c] = w;
      }
    }
    xsq[n + 1] = 0;
    xsq[2 * n - 2] = n - 1;
    xsq[n * (n - 2) + 1] = n * (n - 1);
    xsq[n * (n - 1) - 2] = n * n - 1;
    // the order NORMAL tries moves in: the best squares first
    const order = [...Array(n * n).keys()].sort((a, b) => weight[b] - weight[a]);
    return (geoms[n] = { n, rays, weight, corners, xsq, order });
  }

  // the discs `color` would flip with a disc on `cell` (none = it can't go there)
  function flipsOn(b, g, cell, color) {
    if (b[cell]) return [];
    const out = [], foe = other(color);
    for (const { ray, diag } of g.rays[cell]) {
      if (diag && sabotage.nodiag) continue;
      if (b[ray[0]] !== foe) continue;
      let k = 1;
      while (k < ray.length && b[ray[k]] === foe) k++;
      if (k < ray.length && b[ray[k]] === color) for (let j = 0; j < k; j++) out.push(ray[j]);
    }
    return out;
  }
  function canFlip(b, g, cell, color) {
    if (b[cell]) return false;
    const foe = other(color);
    for (const { ray, diag } of g.rays[cell]) {
      if (diag && sabotage.nodiag) continue;
      if (b[ray[0]] !== foe) continue;
      let k = 1;
      while (k < ray.length && b[ray[k]] === foe) k++;
      if (k < ray.length && b[ray[k]] === color) return true;
    }
    return false;
  }
  function movesOn(b, g, color) {
    const out = [];
    for (const i of g.order) if (canFlip(b, g, i, color)) out.push(i);
    return out;
  }
  function anyMove(b, g, color) {
    for (let i = 0; i < b.length; i++) if (canFlip(b, g, i, color)) return true;
    return false;
  }

  // ---------------------------------------------------------------- a game

  function newGame(n = 8, opts = {}) {
    const board = new Array(n * n).fill(0);
    const m = n / 2;
    board[(m - 1) * n + m - 1] = L;
    board[(m - 1) * n + m] = D;
    board[m * n + m - 1] = D;
    board[m * n + m] = L;
    const st = { n, board, turn: opts.first || D, hist: [], over: false, winner: 0, count: { [D]: 2, [L]: 2 }, passes: 0 };
    return st;
  }

  const flips = (st, cell, color = st.turn) => flipsOn(st.board, geom(st.n), cell, color);
  const moves = (st, color = st.turn) => movesOn(st.board, geom(st.n), color);
  const isLegal = (st, cell) => !st.over && cell >= 0 && cell < st.board.length && canFlip(st.board, geom(st.n), cell, st.turn);
  const empties = (st) => st.board.length - st.count[D] - st.count[L];

  function recount(st) {
    st.count = { [D]: 0, [L]: 0 };
    for (const v of st.board) if (v) st.count[v]++;
  }

  // After a move (or a board set up by hand): whose turn now, a pass, or the end.
  // Returns the colour that had to pass, or 0.
  function settle(st, mover) {
    const g = geom(st.n), next = other(mover);
    st.over = false;
    st.winner = 0;
    if (anyMove(st.board, g, next)) {
      st.turn = next;
      return 0;
    }
    if (!sabotage.nopass && anyMove(st.board, g, mover)) {
      st.turn = mover; // `next` can't go anywhere: a pass, and the same side goes again
      st.passes++;
      return next;
    }
    if (sabotage.noend) {
      st.turn = next;
      return 0;
    }
    st.over = true;
    st.winner = st.count[D] > st.count[L] ? D : st.count[L] > st.count[D] ? L : 0;
    return 0;
  }
  // a board set up by hand: recount and find whose turn it is (`turn` if it can move)
  function refresh(st, turn = st.turn) {
    recount(st);
    st.hist = [];
    return settle(st, other(turn));
  }

  function play(st, cell) {
    if (st.over) throw new Error('the game is over');
    const color = st.turn;
    const f = flips(st, cell, color);
    if (!f.length) throw new Error(`square ${cell} isn't a move for ${color}`);
    st.board[cell] = color;
    for (const i of f) st.board[i] = color;
    st.count[color] += 1 + f.length;
    st.count[other(color)] -= f.length;
    const pass = settle(st, color);
    st.hist.push({ cell, color, flips: f, pass });
    return { cell, color, flips: f, pass, over: st.over, winner: st.winner };
  }

  function undo(st) {
    const m = st.hist.pop();
    if (!m) return null;
    st.board[m.cell] = 0;
    for (const i of m.flips) st.board[i] = other(m.color);
    st.count[m.color] -= 1 + m.flips.length;
    st.count[other(m.color)] += m.flips.length;
    if (m.pass) st.passes--;
    st.turn = m.color;
    st.over = false;
    st.winner = 0;
    return m;
  }

  // ---------------------------------------------------------------- the search (NORMAL and the hint)

  const WIN = 100000;
  let nodes = 0, budget = Infinity;
  class Abort {}

  // the score for `me` on board b (higher is better): square weights, how many moves each side has, and the
  // corners; near the end just the disc count
  function evaluate(b, g, me) {
    const foe = other(me);
    let s = 0;
    const w = g.weight;
    for (let i = 0; i < b.length; i++) {
      const v = b[i];
      if (!v) continue;
      let wi = w[i];
      // once a corner is taken, the squares next to it are no longer dangerous
      if (wi < 0 && g.xsq[i] !== undefined && b[g.xsq[i]]) wi = 2;
      s += v === me ? wi : -wi;
    }
    let mm = 0, fm = 0;
    for (let i = 0; i < b.length; i++) {
      if (b[i]) continue;
      if (canFlip(b, g, i, me)) mm++;
      if (canFlip(b, g, i, foe)) fm++;
    }
    s += 6 * (mm - fm);
    return s;
  }
  function discDiff(b, me) {
    let s = 0;
    for (let i = 0; i < b.length; i++) if (b[i]) s += b[i] === me ? 1 : -1;
    return s;
  }

  // negamax with alpha-beta; `exact` = play it out to the end and score the discs
  function search(b, g, me, depth, alpha, beta, exact, passed) {
    if (++nodes > budget) throw new Abort();
    if (!exact && depth <= 0) return evaluate(b, g, me);
    const ms = movesOn(b, g, me);
    if (!ms.length) {
      if (passed) {
        const d = discDiff(b, me);
        return d > 0 ? WIN + d : d < 0 ? -WIN + d : 0;
      }
      return -search(b, g, other(me), depth - 1, -beta, -alpha, exact, true);
    }
    let best = -Infinity;
    for (const m of ms) {
      const f = flipsOn(b, g, m, me);
      b[m] = me;
      for (const i of f) b[i] = me;
      const v = -search(b, g, other(me), depth - 1, -beta, -alpha, exact, false);
      b[m] = 0;
      const foe = other(me);
      for (const i of f) b[i] = foe;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }

  // Every root move's score at the deepest depth finished within the budget. Moves more than `margin` below the
  // best may come back as just "worse" (the window cuts them off).
  function rootScores(st, depthMax, margin, exactAt, nodeBudget) {
    const g = geom(st.n), me = st.turn;
    let b = Int8Array.from(st.board);
    const ms = movesOn(b, g, me);
    if (ms.length <= 1) return ms.map((m) => ({ m, v: 0 }));
    const left = b.length - st.count[D] - st.count[L];
    let result = null;
    const run = (depth, exact) => {
      const out = [];
      let best = -Infinity;
      // try the last depth's best first, so the window is tight early
      const order = result ? result.slice().sort((x, y) => y.v - x.v).map((r) => r.m) : ms;
      for (const m of order) {
        const f = flipsOn(b, g, m, me);
        b[m] = me;
        for (const i of f) b[i] = me;
        const lo = best === -Infinity ? -Infinity : best - margin - 1;
        const v = -search(b, g, other(me), depth - 1, -Infinity, -lo, exact, false);
        b[m] = 0;
        for (const i of f) b[i] = other(me);
        out.push({ m, v });
        if (v > best) best = v;
      }
      return out;
    };
    // a search cut off by the budget leaves the board half changed: start again from the real one
    const attempt = (fn) => {
      nodes = 0;
      budget = nodeBudget;
      try {
        fn();
      } catch (e) {
        if (!(e instanceof Abort)) throw e;
        b = Int8Array.from(st.board);
      }
      budget = Infinity;
    };
    // near the end: play it out perfectly, if that fits in the budget
    if (left <= exactAt) attempt(() => (result = run(left, true)));
    if (!result) attempt(() => {
      for (let d = 1; d <= depthMax; d++) result = run(d, false);
    });
    if (!result) result = run(1, false); // not even one depth fitted: a quick one-move look
    return result;
  }

  function normalMove(st, rnd, margin = NORMAL.margin) {
    if (empties(st) <= (NORMAL.exact[st.n] || 10)) margin = 0; // the last few squares: perfect play, no randomness
    const scores = rootScores(st, NORMAL.depth[st.n] || 4, margin, NORMAL.exact[st.n] || 10, NORMAL.budget);
    if (!scores.length) return -1;
    const best = Math.max(...scores.map((s) => s.v));
    const near = scores.filter((s) => s.v >= best - margin);
    return near[Math.floor(rnd() * near.length)].m;
  }

  function easyMove(st, rnd) {
    const ms = moves(st);
    if (!ms.length) return -1;
    const g = geom(st.n);
    const corners = ms.filter((m) => g.corners.includes(m));
    if (corners.length && rnd() < EASY.corner) return corners[Math.floor(rnd() * corners.length)];
    if (rnd() < EASY.greedy) {
      let most = 0, pick = [];
      for (const m of ms) {
        const k = flips(st, m).length;
        if (k > most) {
          most = k;
          pick = [m];
        } else if (k === most) pick.push(m);
      }
      return pick[Math.floor(rnd() * pick.length)];
    }
    return ms[Math.floor(rnd() * ms.length)];
  }

  function cpuMove(st, level = 'normal', rnd = Math.random) {
    if (st.over) return -1;
    if (level === 'easy' || (level === 'normal' && sabotage.weak)) return easyMove(st, rnd);
    return normalMove(st, rnd);
  }

  // Your brother's tip: the best square a deeper search than NORMAL's finds, no randomness. kind: 'win' (he's worked out
  // the end and this wins it), 'corner', 'only' (the one square you can go), or 'best'.
  function hint(st) {
    if (st.over) return null;
    const ms = moves(st);
    if (!ms.length) return null;
    if (ms.length === 1) return { cell: ms[0], kind: 'only', flips: flips(st, ms[0]).length };
    const scores = rootScores(st, HINT.depth[st.n] || 4, 0, HINT.exact[st.n] || 10, HINT.budget);
    let top = scores[0];
    for (const s of scores) if (s.v > top.v || (s.v === top.v && geom(st.n).weight[s.m] > geom(st.n).weight[top.m])) top = s;
    const g = geom(st.n);
    const kind = top.v > WIN / 2 ? 'win' : g.corners.includes(top.m) ? 'corner' : 'best';
    return { cell: top.m, kind, flips: flips(st, top.m).length };
  }

  // a cheer for a move, before it's played
  function judge(st, cell) {
    if (!isLegal(st, cell)) return null;
    const g = geom(st.n);
    if (g.corners.includes(cell)) return 'corner';
    const k = flips(st, cell).length;
    if (k >= 6) return 'super';
    if (k >= 4) return 'nice';
    return null;
  }

  // can `color` take a corner right now? (your brother's button wiggles: a good time to call him)
  function cornerFor(st, color) {
    const g = geom(st.n);
    return g.corners.some((c) => canFlip(st.board, g, c, color));
  }

  FLP.rules = {
    D, L, other, EASY, NORMAL, HINT, newGame, flips, moves, isLegal, empties, play, undo, refresh, recount, cpuMove, easyMove,
    normalMove, rootScores, hint, judge, cornerFor, geom,
    get nodes() { return nodes; },
  };
  FLP.sabotage = sabotage;
})();
