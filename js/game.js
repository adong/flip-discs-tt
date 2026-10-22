/* TT Flip Discs: the menu, the games, the HUD, input and the main loop.
   Screens: home (pick the board, 1 or 2 players, who you are, the level, undo on or off, the dots), play, game over,
   pause. Each game is one game of flip discs, and the score of games won keeps running for the same two players
   (until the page is closed). Who goes first swaps every game; you (or Teddy, in 2 players) start.
   In 1 player you're Teddy (dark) or Tommy (light) against 🦊 Foxy, who plays the other colour with a 🦊 on her
   side of the discs. Your brother isn't the CPU: he's the one you call for help (js/buddy.js).
   A side with no move passes by itself (a toast says so) and the other side goes again; when nobody can move the
   game ends and the most discs wins.
   window.game is a test hook: see the README. */
(function () {
  'use strict';
  const FLP = window.FLP;
  const R = FLP.rules;
  const ST = FLP.stage;
  const S = Kit.sound;
  const { D, L } = R;
  const $ = (id) => document.getElementById(id);
  const { rand } = Kit.gfx;

  const KEY = 'flipDiscsTT.v1';
  const THINK = { easy: [0.75, 1.15], normal: [0.6, 1.0] }; // how long Foxy "thinks" (s)

  const prefs = Object.assign({ players: 1, who: 'teddy', level: 'easy', size: 6, undo: true, dots: true }, load());
  const G = {
    state: 'boot', players: 1, level: 'easy', size: 6, undo: true, dots: true, sides: null, game: null, starter: D,
    cpuT: -1, waitT: -1, passPending: 0, ready: false, turnId: 0, endT: -1, panelT: -1, cursor: -1, hover: -1, press: null,
    held: false, last: 0, auto: false, autoLevel: 'normal', demo: null, nudge: false, scores: {}, key: '', undos: 0,
    games: 0, passes: 0, disp: { [D]: 2, [L]: 2 }, flipK: 0, dotsFor: -1, dotList: [], previewKey: '',
  };
  const actors = [FLP.makeActor(), FLP.makeActor()];
  const foxes = {};
  const badges = [];
  let ui = null, flyers = null, bursts = null, spots = null, art = null;

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch (e) { /* private mode */ }
  }

  // ---------------------------------------------------------------- who's at the board

  const nameOf = (id) => (id === 'foxy' ? 'FOXY' : Kit.roster.get(id).name);
  const colourOf = (id) => (id === 'tommy' ? L : D);
  const emblemOf = (id) => (id === 'foxy' ? '🦊' : id === 'tommy' ? '✌️' : '🏀');
  // sides[0] is on the left (you, or Teddy in 2 players), sides[1] on the right
  function makeSides(players, who) {
    if (players === 2) return [{ id: 'teddy', color: D, human: true }, { id: 'tommy', color: L, human: true }];
    const mine = colourOf(who);
    return [{ id: who, color: mine, human: true }, { id: 'foxy', color: R.other(mine), human: false }];
  }
  const sideOf = (color) => G.sides.find((s) => s.color === color);
  const current = () => (G.game ? sideOf(G.game.turn) : null);
  const kid = () => G.sides[0];
  const score = () => (G.scores[G.key] = G.scores[G.key] || { [D]: 0, [L]: 0 });

  function fox(color) {
    if (!foxes[color]) {
      foxes[color] = FLP.makePilot('foxy', '🦊', 'FOXY', color === D ? '#3d5fc4' : '#ffe2a8');
      foxes[color].attach(ST.scene, flyers);
    }
    return foxes[color];
  }

  function setActors() {
    actors.forEach((a) => (a.visible = false));
    Object.values(foxes).forEach((f) => (f.visible = false));
    G.sides.forEach((s, k) => {
      let a;
      if (s.id === 'foxy') a = fox(s.color);
      else {
        a = actors[k];
        if (!a.entry || a.entry.id !== s.id) a.set(s.id, 1);
      }
      s.actor = a;
      a.visible = true;
      ST.emblem(s.color, emblemOf(s.id));
      setBadge(k, s);
    });
    ST.trays(G.sides.map((s) => s.color));
    FLP.buddy.setFor(kid().id);
  }

  // the disc that bobs over the head of whoever's turn it is
  function discTexture(color, emblem) {
    const [c, g] = Kit.gfx.makeCanvas(128, 128);
    const grad = g.createRadialGradient(46, 40, 6, 64, 64, 60);
    grad.addColorStop(0, color === D ? '#5a7fe0' : '#ffffff');
    grad.addColorStop(0.6, ST.COL[color]);
    grad.addColorStop(1, color === D ? '#0f1f4d' : '#e3cfa2');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(64, 64, 56, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 7;
    g.strokeStyle = '#14121f';
    g.stroke();
    g.font = `52px ${Kit.gfx.EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emblem, 64, 68);
    return Kit.gfx.toTexture(c);
  }
  const discTex = {};
  function setBadge(k, s) {
    if (!badges[k]) {
      badges[k] = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
      badges[k].renderOrder = 23;
      badges[k].scale.setScalar(0.62);
      ST.scene.add(badges[k]);
    }
    const key = s.color + emblemOf(s.id);
    discTex[key] = discTex[key] || discTexture(s.color, emblemOf(s.id));
    badges[k].material.map = discTex[key];
    badges[k].material.needsUpdate = true;
  }

  // a picture of an emoji (Foxy's face on the menu and the scoreboard)
  function emojiArt(e, size = 160) {
    const [c, g] = Kit.gfx.makeCanvas(size, size);
    g.font = `${Math.round(size * 0.78)}px ${Kit.gfx.EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(e, size / 2, size * 0.54);
    try {
      return c.toDataURL('image/png');
    } catch (err) {
      return '';
    }
  }

  // ---------------------------------------------------------------- layout

  // Where everyone stands, for this screen shape. Wide: the two players either side of the board. Tall: behind it.
  function makeSpots(wide) {
    const H2 = ST.HALF;
    if (wide) {
      return {
        wide,
        sides: [{ x: -(H2 + 0.8), z: -0.35, face: Math.PI + 0.45 }, { x: H2 + 0.8, z: -0.35, face: Math.PI - 0.45 }],
        trays: [{ x: -(H2 + 0.95), z: -(H2 - 0.45) }, { x: H2 + 0.95, z: -(H2 - 0.45) }],
        buddy: { x: -(H2 + 0.75), z: H2 - 0.7, face: Math.PI + 0.6 },
        meet: [{ x: -0.8, z: -(H2 + 0.8) }, { x: 0.8, z: -(H2 + 0.8) }],
      };
    }
    return {
      wide,
      sides: [{ x: -1.7, z: -(H2 + 0.85), face: Math.PI + 0.12 }, { x: 1.7, z: -(H2 + 0.85), face: Math.PI - 0.12 }],
      trays: [{ x: -2.9, z: -(H2 + 0.55) }, { x: 2.9, z: -(H2 + 0.55) }],
      buddy: { x: 0, z: -(H2 + 1.45), face: Math.PI },
      meet: [{ x: -0.7, z: -(H2 + 0.85) }, { x: 0.7, z: -(H2 + 0.85) }],
    };
  }

  function layout() {
    ST.resize();
    FLP.fx.overlay.resize();
    const Wd = ST.W, Ht = ST.H;
    if (Wd < 2 || Ht < 2) return;
    const wide = Wd / Ht >= 1.15;
    spots = makeSpots(wide);
    const V = THREE.Vector3, h = ST.HALF, pts = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push(new V(sx * h, sz > 0 ? ST.TOP * 0.45 : ST.TOP, sz * h), new V(sx * h, ST.TOP, sz * h));
    const foxScale = wide ? 0.7 : 0.62;
    const people = spots.sides.map((sp, k) => {
      const pilot = G.sides && G.sides[k] && G.sides[k].actor && G.sides[k].actor.isPilot;
      return { s: sp, hw: pilot ? 1.35 * foxScale + 0.2 : 0.55, top: pilot ? 3.4 * foxScale : 2.9 };
    });
    for (const t of spots.trays) people.push({ s: t, hw: 0.75, top: 0.5 });
    if (G.state !== 'home') people.push({ s: spots.buddy, hw: 0.55, top: 2.2 });
    for (const { s, hw, top } of people) pts.push(new V(s.x - hw, 0, s.z), new V(s.x + hw, 0, s.z), new V(s.x, top, s.z));
    // the kit's round ? and language buttons sit on the left edge: keep the board and the boys clear of them
    const m = { l: 62, r: 14, t: 14, b: 14 };
    if (!wide && G.state !== 'home') m.l = m.r = 8; // in a game on a tall screen they're down in the bottom left corner
    if (G.state === 'home') {
      if (wide) m.r = Wd * 0.56 + 10;
      else {
        m.b = Ht * 0.64 + 6;
        m.t = 8;
      }
    } else {
      const top = ui.hudtop.getBoundingClientRect(), mid = ui.hudmid.getBoundingClientRect();
      m.t = top.bottom + 8;
      if (getComputedStyle(ui.hudmid).position === 'fixed') {
        // a phone on its side: the score is a column on the right, the buttons a column on the left
        m.t = 8;
        m.r = Wd - mid.left + 6;
      }
      if (!wide) m.b = Math.min(Ht * 0.13, 120);
    }
    ST.fit(pts, 1.2, m);
    spots.trays.forEach((t, k) => ST.tray(k, t.x, t.z));
    G.sides && G.sides.forEach((s, k) => {
      const sp = spots.sides[k];
      s.actor.faceDefault = sp.face;
      if (s.actor.isPilot) s.actor.setScale(foxScale);
      if (!FLP.highFive.on) s.actor.place(sp.x, 0, sp.z);
    });
  }

  // ---------------------------------------------------------------- the games

  function startMatch(opts = {}) {
    gesture();
    for (const k of ['players', 'level', 'size', 'undo', 'dots', 'who']) if (opts[k] !== undefined) prefs[k] = opts[k];
    save();
    Object.assign(G, { players: prefs.players, level: prefs.level, size: prefs.size, undo: prefs.undo, dots: prefs.dots });
    G.sides = makeSides(G.players, prefs.who);
    G.key = G.sides.map((s) => s.id).join('|') + '|' + G.size;
    G.demo = null;
    setActors();
    G.starter = kid().color;
    show(ui.home, false);
    show(ui.hud, true);
    show(ui.callBtn, true);
    show(ui.over, false);
    document.body.dataset.screen = 'play';
    G.state = 'play';
    FLP.highFive.cancel();
    setupHud();
    layout();
    S.music('title');
    startGame();
  }

  function startGame() {
    G.game = R.newGame(G.size, { first: G.starter });
    Object.assign(G, { endT: -1, cpuT: -1, waitT: -1, passPending: 0, ready: false, nudge: false, panelT: -1, cursor: -1, hover: -1, press: null, dotsFor: -1 });
    ST.setSize(G.size);
    ST.set(G.game.board);
    ST.hint(-1);
    ST.last(-1);
    ST.hover(-1);
    ST.cursor(-1);
    ST.dots([]);
    ST.preview([]);
    FLP.buddy.reset();
    FLP.fx.overlay.clear();
    flyers.clear();
    bursts.clear();
    clearToasts();
    G.sides.forEach((s) => {
      s.actor.react('idle');
      s.actor.drop();
    });
    G.state = 'play';
    show(ui.over, false);
    show(ui.pause, false);
    syncDisp();
    renderScore();
    beginTurn();
  }

  function beginTurn() {
    G.turnId++;
    const s = current();
    G.ready = true;
    if (!s.human) {
      const [a, b] = THINK[G.level] || THINK.easy;
      G.cpuT = rand(a, b);
      s.actor.act('think', G.cpuT + 0.2, 0, true);
      FLP.sfx.think();
      const p = s.actor.root.position;
      flyers.add('🤔', p.x, 2.5, p.z, 0, 0.3, 0.6, G.cpuT, 0, 0);
    } else if (G.auto) G.cpuT = 0.3;
    updateTurnText();
    updateUndo();
  }

  // A square was chosen for the side to move. Returns false if a disc can't go there.
  function move(i, byKid) {
    const st = G.game;
    if (!st || st.over || G.state !== 'play' || !G.ready) return false;
    if (!R.isLegal(st, i)) {
      if (byKid) FLP.sfx.nope();
      return false;
    }
    const s = current();
    const kind = R.judge(st, i);
    const ev = R.play(st, i);
    G.ready = false;
    G.cpuT = -1;
    G.flipK = 0;
    const dur = ST.place(i, ev.color, ev.flips);
    ST.last(i);
    G.disp[ev.color]++;
    renderScore();
    setTimeout(() => G.game === st && FLP.sfx.place(ev.color), 180);
    if (s.human) {
      ST.hint(-1);
      FLP.buddy.moved();
      G.nudge = false;
    }
    if (s.actor.mode !== 'signature') s.actor.act('give', 0.45, 0, true);
    react(kind, ev, s);
    if (ev.over) G.endT = dur + 0.6;
    else {
      G.waitT = dur + 0.25;
      G.passPending = ev.pass;
      // Foxy just moved and a corner is free for you: your brother's button wiggles ("call me!")
      const next = ev.pass ? ev.color : R.other(ev.color);
      if (!s.human && G.players === 1 && next === kid().color && R.cornerFor(st, kid().color)) {
        G.nudge = true;
        setTimeout(() => G.state === 'play' && G.nudge && FLP.sfx.chance(), dur * 1000 + 300);
      }
    }
    updateTurnText();
    updateUndo();
    return true;
  }

  const WORDS = { corner: 'CORNER!', super: 'SUPER FLIP!', nice: 'NICE!' };
  function react(kind, ev, s) {
    if (!kind) return;
    if (kind !== 'corner' && !s.human) return; // big flips come often: only the kids get a cheer for one
    const p = ST.cellPos(ev.cell);
    bursts.add(WORDS[kind], p.x, ST.TOP + 0.9, p.z, 1.5, kind === 'corner' ? '#b8f5ff' : '#ffd400', kind === 'corner' ? '#2f7cf0' : '#e8372c');
    const foe = G.sides.find((o) => o !== s);
    setTimeout(() => {
      if (kind === 'corner') FLP.sfx.corner();
      else FLP.sfx.nice();
      s.actor.react('cheer');
      if (kind === 'corner') foe.actor.react('oops');
    }, 300);
  }

  // nobody's move for `color`: say so, a shrug, and the other side goes again
  function showPass(color) {
    const s = sideOf(color);
    G.passes++;
    toast(`${nameOf(s.id)} CAN'T GO: PASS!`, 'pass');
    s.actor.react('shrug');
    FLP.sfx.pass();
    const p = s.actor.root.position;
    bursts.add('PASS!', p.x, 3.1, p.z, 1.3, '#ffe0ec', '#ff3d7f');
  }

  function endGame() {
    const st = G.game;
    G.starter = R.other(G.starter);
    G.games++;
    const sc = score();
    const win = st.winner ? sideOf(st.winner) : null, lose = win ? G.sides.find((s) => s !== win) : null;
    syncDisp();
    if (win) {
      sc[st.winner]++;
      ST.win(st.winner);
      win.actor.react('signature'); // Teddy's boxing or jump shot (in turn), Tommy's Y with ✌️; Foxy spins
      setTimeout(() => lose.actor.react('shrug'), 250);
      const a = ST.toScreen(ST.cellPos(((G.size / 2) | 0) * (G.size + 1)));
      if (win.human) {
        FLP.sfx.win();
        FLP.fx.overlay.burst(a.x, a.y, 80, ['⭐', '🎉', win.color === D ? '💙' : '🤍'], 1.2);
        FLP.fx.overlay.rain(120);
      } else FLP.sfx.lose();
      bumpScore(win === G.sides[0] ? ui.scoreL : ui.scoreR);
    } else {
      FLP.sfx.draw();
      G.sides.forEach((s) => s.actor.react('shrug'));
      const p = ST.cellPos(((G.size / 2) | 0) * (G.size + 1));
      for (let i = 0; i < 6; i++) flyers.add('🤝', p.x, ST.TOP + 1, p.z, rand(-2, 2), rand(2, 3.5), 0.6, 1.2, rand(-2, 2), 4);
    }
    G.state = 'ended';
    G.endT = -1;
    G.nudge = false;
    ST.dots([]);
    renderScore();
    updateTurnText();
    updateUndo();
    G.panelT = 2.8;
  }

  const chip = (s) => `<i class="chip ${s.color === D ? 'd' : 'l'}" data-e="${emblemOf(s.id)}"></i>`;
  function showPanel() {
    const st = G.game;
    const win = st.winner ? sideOf(st.winner) : null;
    ui.oFace.innerHTML = win ? `<img alt="" src="${art[win.id]}"><span class="big">🏆</span>` : '<span class="big">🤝</span>';
    ui.oTitle.textContent = win ? `${nameOf(win.id)} WINS!` : 'DRAW!';
    const [a, b] = G.sides, sc = score();
    ui.oScore.innerHTML = `<img alt="" src="${art[a.id]}">${chip(a)}<span>${st.count[a.color]}</span><span class="dash">–</span><span>${st.count[b.color]}</span>${chip(b)}<img alt="" src="${art[b.id]}">`;
    ui.oGames.innerHTML = `<span>🏆</span><span>${sc[a.color]}</span><span>–</span><span>${sc[b.color]}</span>`;
    G.state = 'over';
    show(ui.over, true);
    if (win) {
      win.actor.react('over');
      G.sides.find((s) => s !== win).actor.react('sulk');
    }
  }

  function next() {
    gesture();
    if (G.state === 'over' || G.state === 'ended') startGame();
  }

  // R / 🔄: a new game. A game not finished yet doesn't count (and the same side starts again).
  function restartGame() {
    if (!['play', 'paused', 'ended', 'over'].includes(G.state)) return;
    show(ui.pause, false);
    startGame();
    toast('🔄', 'hint');
  }

  // ---------------------------------------------------------------- undo

  // How many discs the undo button takes back now: in 1 player back to (and including) your last disc, so it's your
  // turn again (Foxy's answers go too, and any passes); in 2 players the last disc. 0 = nothing to undo.
  function undoCount() {
    const st = G.game;
    if (!G.undo || G.state !== 'play' || !st || st.over || !st.hist.length) return 0;
    if (G.players === 2) return 1;
    let k = st.hist.length - 1;
    while (k >= 0 && st.hist[k].color !== kid().color) k--;
    return k < 0 ? 0 : st.hist.length - k;
  }

  function undoMove() {
    gesture();
    const count = undoCount();
    if (!count || G.endT > 0) {
      if (G.state === 'play') FLP.sfx.nope();
      return false;
    }
    const st = G.game;
    for (let k = 0; k < count; k++) {
      const m = R.undo(st);
      ST.unplace(m.cell, m.flips);
    }
    ST.last(st.hist.length ? st.hist[st.hist.length - 1].cell : -1);
    ST.hint(-1);
    Object.assign(G, { cpuT: -1, waitT: -1, passPending: 0, nudge: false });
    G.undos++;
    syncDisp();
    renderScore();
    FLP.sfx.undo();
    FLP.buddy.repoint();
    current().actor.react('hop');
    toast('↩️ UNDO!', 'hint');
    beginTurn();
    return true;
  }

  function updateUndo() {
    if (!ui) return;
    ui.undoBtn.style.display = G.undo ? '' : 'none';
    ui.undoBtn.classList.toggle('off', !undoCount());
  }

  // ---------------------------------------------------------------- home

  function goHome() {
    G.state = 'home';
    document.body.dataset.screen = 'home';
    show(ui.hud, false);
    show(ui.callBtn, false);
    show(ui.over, false);
    show(ui.pause, false);
    show(ui.home, true);
    FLP.buddy.reset();
    FLP.highFive.cancel();
    ST.hint(-1);
    ST.cursor(-1);
    ST.hover(-1);
    ST.dots([]);
    ST.preview([]);
    clearToasts();
    FLP.fx.overlay.clear();
    G.sides = [{ id: 'teddy', color: D, human: false }, { id: 'tommy', color: L, human: false }];
    setActors();
    layout();
    G.sides.forEach((s) => s.actor.react('hello'));
    refreshHome();
    demoStart();
    S.music('title');
  }

  // the boys play a slow game behind the menu, on the board you played last
  function demoStart() {
    G.demo = { st: R.newGame(prefs.size, { first: Math.random() < 0.5 ? D : L }), t: 1.2, end: -1 };
    ST.setSize(prefs.size);
    ST.set(G.demo.st.board);
    ST.last(-1);
  }
  function demoUpdate(dt) {
    const d = G.demo;
    if (!d) return;
    d.t -= dt;
    if (d.end >= 0) {
      d.end -= dt;
      if (d.end < 0) demoStart();
      return;
    }
    if (d.t > 0) return;
    const st = d.st;
    const i = R.cpuMove(st, Math.random() < 0.6 ? 'normal' : 'easy');
    if (i < 0) {
      d.end = 2;
      return;
    }
    const ev = R.play(st, i);
    const dur = ST.place(i, ev.color, ev.flips);
    ST.last(i);
    setTimeout(() => G.state === 'home' && G.demo === d && FLP.sfx.place(ev.color), 180);
    sideOf(ev.color).actor.act('give', 0.45, 0, true);
    d.t = Math.max(1.1, dur + 0.6);
    if (ev.pass) setTimeout(() => G.state === 'home' && G.demo === d && sideOf(ev.pass).actor.react('shrug'), dur * 1000);
    if (st.over) {
      d.end = dur + 4;
      if (st.winner) {
        setTimeout(() => {
          if (G.state !== 'home' || G.demo !== d) return;
          ST.win(st.winner);
          sideOf(st.winner).actor.react('signature');
          sideOf(R.other(st.winner)).actor.react('shrug');
        }, dur * 1000 + 400);
      }
    }
  }

  function refreshHome() {
    const seg = (el, v) => {
      for (const b of el.children) {
        const on = b.dataset.v === String(v);
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on);
        b.setAttribute('role', 'radio');
      }
    };
    seg(ui.segPlayers, prefs.players);
    seg(ui.segWho, prefs.who);
    seg(ui.segLevel, prefs.level);
    ui.segWho.style.display = ui.segLevel.style.display = prefs.players === 1 ? '' : 'none';
    ui.duo.style.display = prefs.players === 2 ? '' : 'none';
    for (const [el, on] of [[ui.togUndo, prefs.undo], [ui.togDots, prefs.dots]]) {
      el.classList.toggle('on', !!on);
      el.setAttribute('aria-pressed', !!on);
    }
    for (const t of ui.tiles.children) t.classList.toggle('last', +t.dataset.n === prefs.size);
  }

  function setPref(k, v) {
    gesture();
    prefs[k] = v;
    save();
    refreshHome();
    FLP.sfx.kit('click');
    if (k === 'who') {
      const s = G.sides && G.sides.find((x) => x.id === v);
      if (s && G.state === 'home') s.actor.react('hello');
    }
  }

  // ---------------------------------------------------------------- HUD

  function setupHud() {
    const [a, b] = G.sides;
    ui.faceL.src = art[a.id];
    ui.faceR.src = art[b.id];
    ui.chipL.outerHTML = chip(a).replace('<i ', '<i id="chipL" ');
    ui.chipR.outerHTML = chip(b).replace('<i ', '<i id="chipR" ');
    ui.chipL = $('chipL');
    ui.chipR = $('chipR');
    if (G.players === 1) {
      const bud = FLP.buddy.entry;
      ui.callBtn.innerHTML = `<img alt="" src="${art[bud.id]}"><kbd>T</kbd>`;
      const nice = bud.name[0] + bud.name.slice(1).toLowerCase();
      ui.callBtn.title = `Call ${nice} (T)`;
      ui.callBtn.setAttribute('aria-label', `Call ${nice}`);
    } else {
      ui.callBtn.innerHTML = '🙌<kbd>T</kbd>';
      ui.callBtn.title = 'High five! (T)';
      ui.callBtn.setAttribute('aria-label', 'High five!');
    }
    updateUndo();
  }

  // the disc counts on the scoreboard follow the discs as they flip over (stage onFlip), then match the rules
  function syncDisp() {
    if (G.game) G.disp = { [D]: G.game.count[D], [L]: G.game.count[L] };
  }
  function renderScore() {
    if (!G.sides || !G.game) return;
    const [a, b] = G.sides, sc = score();
    setText(ui.scoreL, 'sl', String(G.disp[a.color]));
    setText(ui.scoreR, 'sr', String(G.disp[b.color]));
    setText(ui.wonL, 'wl', sc[a.color] ? `🏆${sc[a.color]}` : '');
    setText(ui.wonR, 'wr', sc[b.color] ? `🏆${sc[b.color]}` : '');
  }
  function bumpScore(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  const cache = {};
  function setText(el, key, v) {
    if (cache[key] !== v) {
      cache[key] = v;
      el.textContent = v;
    }
  }

  function updateTurnText() {
    if (!G.game || !ui) return;
    const s = current(), st = G.game;
    let text = '', mine = false;
    if (G.state === 'ended' || G.state === 'over' || st.over) text = st.winner ? `${nameOf(sideOf(st.winner).id)} WINS!` : 'DRAW!';
    else if (G.passPending) text = `${nameOf(sideOf(G.passPending).id)} CAN'T GO!`;
    else if (!s.human) text = `${nameOf(s.id)} IS THINKING…`;
    else if (G.players === 1) {
      text = 'YOUR TURN!';
      mine = true;
    } else {
      text = `${nameOf(s.id)}'S TURN!`;
      mine = true;
    }
    setText(ui.turn, 'turn', text);
    ui.turn.classList.toggle('mine', mine);
    const on = (k) => !st.over && !G.passPending && G.sides[k].color === st.turn;
    ui.sideL.classList.toggle('now', on(0));
    ui.sideR.classList.toggle('now', on(1));
  }

  function toast(text, cls) {
    const el = document.createElement('div');
    el.className = 'toast' + (cls ? ' ' + cls : '');
    el.textContent = text;
    ui.toasts.appendChild(el);
    setTimeout(() => el.remove(), cls === 'save' ? 2450 : cls === 'pass' ? 2250 : 1950);
    while (ui.toasts.children.length > 3) ui.toasts.firstChild.remove();
  }
  function clearToasts() {
    if (ui) ui.toasts.innerHTML = '';
  }

  function show(el, on) {
    el.classList.toggle('hidden', !on);
  }

  // ---------------------------------------------------------------- your brother and the high five

  function call() {
    gesture();
    if (!G.sides || !['play', 'ended', 'over'].includes(G.state)) return 'none';
    if (G.players === 2) return FLP.highFive.start();
    G.nudge = false;
    return FLP.buddy.call();
  }

  const buddyApi = {
    toast: (t, c) => toast(t, c),
    player: () => kid().actor,
    spot: () => spots.buddy,
    turnId: () => G.turnId,
    canHint: () => G.state === 'play' && G.game && !G.game.over && current() === kid() && G.ready,
    roundOver: () => G.state !== 'play' || (G.game && G.game.over),
    showHint() {
      const h = R.hint(G.game);
      if (!h) return null;
      ST.hint(h.cell, kid().color);
      return h;
    },
    clearHint: () => ST.hint(-1),
    players: () => [G.sides[0].actor, G.sides[1].actor],
    meet: () => spots.meet,
    homes: () => spots.sides,
    get flyers() { return flyers; },
  };

  // ---------------------------------------------------------------- input

  let audioReady = false;
  function gesture() {
    if (!audioReady) {
      audioReady = true;
      S.init();
      S.music('title');
    } else S.init();
  }

  const kidsTurn = () => G.state === 'play' && G.game && !G.game.over && G.ready && current() && current().human && !G.auto;
  // can the kid whose turn it is play square i?
  const canPlay = (i) => kidsTurn() && i >= 0 && R.isLegal(G.game, i);

  function humanTap(i) {
    if (!canPlay(i)) {
      if (G.state === 'play' && i >= 0 && current() && current().human) FLP.sfx.nope();
      return false;
    }
    return move(i, true);
  }

  function moveCursor(dx, dy) {
    if (G.state !== 'play') return;
    const n = G.size;
    let c = G.cursor;
    if (c < 0) {
      // start on a square you can go to (the nearest the middle), else the last disc
      const ms = kidsTurn() ? R.moves(G.game) : [];
      const mid = (n - 1) / 2;
      ms.sort((a, b) => Math.hypot(Math.floor(a / n) - mid, (a % n) - mid) - Math.hypot(Math.floor(b / n) - mid, (b % n) - mid));
      c = ms.length ? ms[0] : ST.lastCell >= 0 ? ST.lastCell : (n / 2) * n + n / 2;
    } else {
      const col = Math.min(n - 1, Math.max(0, (c % n) + dx)), row = Math.min(n - 1, Math.max(0, Math.floor(c / n) + dy));
      c = row * n + col;
    }
    G.cursor = c;
    G.hover = -1;
    FLP.sfx.tick();
  }

  function bindInput() {
    // a press shows where the disc would go and what it would flip (slide to move it); letting go plays it
    ui.canvas.addEventListener('pointerdown', (e) => {
      gesture();
      if (G.state !== 'play') return;
      const i = ST.pick(e.clientX, e.clientY);
      G.press = { id: e.pointerId };
      G.hover = i;
      G.cursor = -1;
      try {
        ui.canvas.setPointerCapture(e.pointerId);
      } catch (err) { /* old browsers */ }
    });
    ui.canvas.addEventListener('pointermove', (e) => {
      const pressed = G.press && e.pointerId === G.press.id;
      if (!pressed && e.pointerType !== 'mouse') return;
      const i = G.state === 'play' ? ST.pick(e.clientX, e.clientY) : -1;
      if (i !== G.hover && canPlay(i)) FLP.sfx.tick();
      G.hover = i;
      ui.canvas.style.cursor = canPlay(i) ? 'pointer' : '';
    });
    ui.canvas.addEventListener('pointerup', (e) => {
      if (!G.press || e.pointerId !== G.press.id) return;
      G.press = null;
      const i = ST.pick(e.clientX, e.clientY);
      if (e.pointerType !== 'mouse') G.hover = -1;
      if (i >= 0 && G.state === 'play') humanTap(i);
    });
    ui.canvas.addEventListener('pointercancel', () => {
      G.press = null;
      G.hover = -1;
    });
    ui.canvas.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !G.press) G.hover = -1;
    });
    const tap = (el, fn) => el.addEventListener('click', (e) => {
      e.stopPropagation();
      gesture();
      fn();
    });
    for (const t of ui.tiles.children) tap(t, () => startMatch({ size: +t.dataset.n }));
    for (const b of ui.segPlayers.children) tap(b, () => setPref('players', +b.dataset.v));
    for (const b of ui.segWho.children) tap(b, () => setPref('who', b.dataset.v));
    for (const b of ui.segLevel.children) tap(b, () => setPref('level', b.dataset.v));
    tap(ui.togUndo, () => setPref('undo', !prefs.undo));
    tap(ui.togDots, () => setPref('dots', !prefs.dots));
    ui.callBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      call();
    });
    tap(ui.pauseBtn, () => pause(true));
    tap(ui.undoBtn, undoMove);
    tap(ui.pResume, () => pause(false));
    tap(ui.pRestart, restartGame);
    tap(ui.pHome, goHome);
    tap(ui.oAgain, next);
    tap(ui.oHome, goHome);
    tap(ui.muteBtn, toggleMute);
    addEventListener('keydown', (e) => {
      if (e.repeat && !e.key.startsWith('Arrow')) return;
      gesture();
      const k = e.key.toLowerCase();
      if (k === 'm') return toggleMute();
      if (G.state === 'home') {
        const size = { 1: 6, 2: 8 }[e.key];
        if (size) startMatch({ size });
        else if (k === 'arrowleft' || k === 'arrowright') setPref('who', prefs.who === 'teddy' ? 'tommy' : 'teddy');
        else if (k === 'arrowup' || k === 'arrowdown') setPref('players', prefs.players === 1 ? 2 : 1);
        else if (k === 'l') setPref('level', prefs.level === 'easy' ? 'normal' : 'easy');
        else if (k === 'u') setPref('undo', !prefs.undo);
        else if (k === 'd') setPref('dots', !prefs.dots);
        else if (k === 'enter' || k === ' ') startMatch({});
        if (k.startsWith('arrow') || k === ' ') e.preventDefault();
        return;
      }
      if (k === 't') return call();
      if (G.state === 'paused') {
        if (k === 'escape' || k === 'p' || k === 'enter' || k === ' ') pause(false);
        else if (k === 'r') restartGame();
        return;
      }
      if (G.state === 'over') {
        if (k === 'enter' || k === ' ' || k === 'r') next();
        else if (k === 'escape') goHome();
        e.preventDefault();
        return;
      }
      if (k === 'escape' || k === 'p') return pause(true);
      if (k === 'r') return restartGame();
      if (G.state !== 'play') return;
      if (k === 'u') undoMove();
      else if (k === 'arrowleft') moveCursor(-1, 0);
      else if (k === 'arrowright') moveCursor(1, 0);
      else if (k === 'arrowup') moveCursor(0, -1);
      else if (k === 'arrowdown') moveCursor(0, 1);
      else if (k === 'enter' || k === ' ') {
        if (G.cursor < 0) moveCursor(0, 0);
        else humanTap(G.cursor);
      }
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
    });
    addEventListener('resize', layout);
    document.addEventListener('visibilitychange', () => (document.hidden ? S.suspend() : S.resume()));
  }

  function pause(on) {
    if (on && (G.state === 'play' || G.state === 'ended')) {
      G.pausedFrom = G.state;
      G.state = 'paused';
      show(ui.pause, true);
      S.music('pause');
    } else if (!on && G.state === 'paused') {
      G.state = G.pausedFrom || 'play';
      show(ui.pause, false);
      S.music('title');
    }
  }

  function toggleMute() {
    const muted = S.toggleMute();
    ui.muteBtn.textContent = muted ? '🔇' : '🔊';
  }

  // ---------------------------------------------------------------- the loop

  const tmp = new THREE.Vector3();
  function step(dt) {
    dt = Math.min(dt, 0.1);
    // the window can start at 0 x 0 (a hidden tab) and resize without an event reaching us: re-fit when it changes
    if ((innerWidth || 1) !== ST.W || (innerHeight || 1) !== ST.H) layout();
    const running = G.state !== 'paused' && G.state !== 'boot';
    if (running) {
      if (G.state === 'home') demoUpdate(dt);
      if (G.state === 'play') {
        if (G.waitT > 0) {
          G.waitT -= dt;
          if (G.waitT <= 0 && !G.game.over) {
            if (G.passPending) {
              // the flips have landed: now say who has to pass, then the same side goes again
              showPass(G.passPending);
              G.passPending = 0;
              G.waitT = 1.4;
              updateTurnText();
            } else beginTurn();
          }
        } else if (G.cpuT > 0) {
          G.cpuT -= dt;
          if (G.cpuT <= 0) {
            const s = current();
            // the test bot (game.auto) plays the kid's side
            const lv = s.human ? G.autoLevel : G.level;
            const mv = lv === 'hint' ? (R.hint(G.game) || { cell: -1 }).cell : R.cpuMove(G.game, lv);
            move(mv, false);
          }
        }
        if (G.endT > 0) {
          G.endT -= dt;
          if (G.endT <= 0) endGame();
        }
      }
      if (G.state === 'ended' && G.panelT > 0) {
        G.panelT -= dt;
        if (G.panelT <= 0) showPanel();
      }
      ST.update(dt);
      flyers.update(dt);
      bursts.update(dt);
      if (G.sides) G.sides.forEach((s) => s.actor.update(dt));
      FLP.buddy.update(dt);
      FLP.highFive.update(dt);
    }
    // the turn badge over whoever is to move
    const st = G.state === 'home' ? (G.demo && G.demo.st) : G.game;
    if (G.sides) {
      G.sides.forEach((s, k) => {
        const on = st && !st.over && st.turn === s.color && G.state !== 'home' && !G.passPending;
        const bdg = badges[k];
        bdg.visible = !!on;
        if (on) {
          s.actor.root.getWorldPosition(tmp);
          const head = s.actor.isPilot ? 2.95 * s.actor.scale : 2.75;
          bdg.position.set(tmp.x, head + Math.abs(Math.sin(performance.now() / 260)) * 0.18, tmp.z);
        }
      });
    }
    // the dots where you can go, the ring and see-through disc where you'd play, and what it would flip
    const mine = kidsTurn();
    const col = G.game ? G.game.turn : D;
    if (mine && G.dots) {
      if (G.dotsFor !== G.turnId) {
        G.dotsFor = G.turnId;
        G.dotList = R.moves(G.game);
      }
      ST.dots(G.dotList, col);
    } else ST.dots([]);
    const hov = mine && G.hover >= 0 && R.isLegal(G.game, G.hover) ? G.hover : -1;
    ST.hover(hov, col);
    ST.cursor(mine ? G.cursor : -1, col);
    const target = hov >= 0 ? hov : mine && G.cursor >= 0 && R.isLegal(G.game, G.cursor) ? G.cursor : mine ? ST.hintCell : -1;
    const pk = G.turnId + ':' + target;
    if (pk !== G.previewKey) {
      G.previewKey = pk;
      ST.preview(target >= 0 && G.game ? R.flips(G.game, target) : []);
    }
    FLP.fx.overlay.update(dt);
    ui.callBtn.classList.toggle('here', FLP.buddy.on || FLP.highFive.on);
    ui.callBtn.classList.toggle('nudge', G.nudge && !FLP.buddy.on && G.state === 'play');
    ST.render();
  }

  function frame(now) {
    const dt = G.last ? (now - G.last) / 1000 : 0.016;
    G.last = now;
    if (!G.held) step(dt);
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- boot

  // the little boards on the menu tiles
  const MINI = {
    6: ['......', '...x..', '..xxl.', '..lx..', '...l..', '......'],
    8: ['........', '........', '...x....', '...xxl..', '..lxl...', '....l...', '........', '........'],
  };

  function boot() {
    ui = {
      canvas: $('game'), home: $('home'), hud: $('hud'), hudtop: document.querySelector('.hudtop'), hudmid: document.querySelector('.hudmid'), logo: $('logo'), tiles: $('tiles'),
      segPlayers: $('segPlayers'), segWho: $('segWho'), segLevel: $('segLevel'), duo: $('duo'), duoA: $('duoA'), duoB: $('duoB'),
      togUndo: $('togUndo'), togDots: $('togDots'), pauseBtn: $('pauseBtn'), undoBtn: $('undoBtn'), muteBtn: $('muteBtn'),
      sideL: $('sideL'), sideR: $('sideR'), faceL: $('faceL'), faceR: $('faceR'), chipL: $('chipL'), chipR: $('chipR'),
      scoreL: $('scoreL'), scoreR: $('scoreR'), wonL: $('wonL'), wonR: $('wonR'), turn: $('turn'), callBtn: $('callBtn'), toasts: $('toasts'),
      over: $('over'), oFace: $('oFace'), oTitle: $('oTitle'), oScore: $('oScore'), oGames: $('oGames'), oAgain: $('oAgain'), oHome: $('oHome'),
      pause: $('pause'), pResume: $('pResume'), pRestart: $('pRestart'), pHome: $('pHome'),
    };
    // the logo: the first word small on top, the rest big ("TT" / "Flip Discs"); a one-word name is all big
    const words = window.FLP_TITLE.split(' ');
    ui.logo.querySelector('small').textContent = words.length > 1 ? words[0] : '';
    ui.logo.querySelector('big').textContent = words.length > 1 ? words.slice(1).join(' ') : words[0];
    for (const t of ui.tiles.children) {
      const n = +t.dataset.n, m = t.querySelector('.mini');
      m.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
      for (const ch of MINI[n].join('')) {
        const i = document.createElement('i');
        if (ch !== '.') i.className = ch === 'x' ? 'd' : 'l';
        m.appendChild(i);
      }
    }
    ui.muteBtn.textContent = S.isMuted() ? '🔇' : '🔊';
    ST.init(ui.canvas);
    // each disc as it turns over: a flick, and the scoreboard counts it across
    ST.onFlip = (cell, color) => {
      if (G.state === 'play' || G.state === 'ended') {
        FLP.sfx.flip(G.flipK++);
        G.disp[color]++;
        G.disp[R.other(color)]--;
        renderScore();
      } else if (G.state === 'home' && Math.random() < 0.5) FLP.sfx.flip(0);
    };
    FLP.fx.overlay.init($('fx'));
    flyers = FLP.fx.flyers(ST.scene, 60);
    bursts = FLP.fx.bursts(ST.scene, 6);
    actors.forEach((a) => a.attach(ST.scene, flyers));
    art = Kit.portraits(['teddy', 'tommy'].map((id) => Kit.roster.get(id)), { size: 160 });
    art.foxy = emojiArt('🦊');
    ui.segWho.children[0].querySelector('img').src = art.teddy;
    ui.segWho.children[1].querySelector('img').src = art.tommy;
    for (const b of ui.segLevel.children) b.querySelector('img').src = art.foxy;
    ui.duoA.src = art.teddy;
    ui.duoB.src = art.tommy;
    FLP.buddy.init(buddyApi);
    bindInput();
    goHome();
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- test hook

  const toCell = (r, c) => r * G.size + c;
  window.game = {
    // advance `secs` of game time in 1/60 s steps, rendering once at the end (works while the pane is hidden)
    step(secs = 0.1) {
      const n = Math.max(1, Math.round(secs * 60));
      for (let i = 0; i < n; i++) step(1 / 60);
      return game.info();
    },
    hold(on = true) { G.held = on; },
    // start({ size: 6 | 8, players: 1 | 2, who: 'teddy' | 'tommy', level: 'easy' | 'normal', undo, dots })
    start(opts = {}) {
      startMatch(opts);
      return game.info();
    },
    home: () => goHome(),
    tap: (i) => humanTap(i),            // play square i (row * size + col) for the kid whose turn it is
    tapRC: (r, c) => humanTap(toCell(r, c)),
    key: (k) => dispatchEvent(new KeyboardEvent('keydown', { key: k })),
    call: () => call(),
    undo: () => undoMove(),
    pause: (on = true) => pause(on),
    next: () => next(),
    restart: () => restartGame(),
    // let a test bot play the kid's side too ('normal', 'easy', or 'hint' = your brother's tip every time)
    auto(on = true, level = 'normal') {
      G.auto = on;
      G.autoLevel = level;
      if (on && G.state === 'play' && current() && current().human && G.ready && G.cpuT < 0 && G.waitT <= 0) G.cpuT = 0.3;
    },
    // set the board straight away (for tests and screenshots): `board` is size*size numbers or a string of digits
    // (0 empty, 1 dark, 2 light), `turn` the colour to move (if it can; else the other, or the game is over)
    stage(board, turn) {
      const b = typeof board === 'string' ? board.split('').map(Number) : board.slice();
      const st = G.game;
      st.board = b;
      R.refresh(st, turn || st.turn);
      ST.set(st.board);
      Object.assign(G, { cpuT: -1, waitT: -1, passPending: 0, endT: st.over ? 0.3 : -1 });
      syncDisp();
      renderScore();
      if (!st.over) beginTurn();
      return game.info();
    },
    check: (opts) => FLP.check(opts),
    rates: (n, sizes) => FLP.rates(n, sizes),
    info() {
      const st = G.game;
      return {
        state: G.state, players: G.players, level: G.level, size: G.size, undo: G.undo, dots: G.dots,
        sides: G.sides && G.sides.map((s) => ({ id: s.id, color: s.color, human: s.human, pose: s.actor.pose })),
        board: st && st.board.join(''), shown: ST.shown(), turn: st && st.turn, discs: st && st.hist.length, over: st && st.over,
        winner: st && st.winner, count: st && Object.assign({}, st.count), disp: Object.assign({}, G.disp), score: G.sides ? Object.assign({}, score()) : null,
        games: G.games, undos: G.undos, passes: G.passes, canUndo: undoCount(), ready: G.ready, nudge: G.nudge,
        moves: st && !st.over ? R.moves(st).length : 0, buddy: FLP.buddy.info(), hint: ST.hintCell, last: ST.lastCell,
        dots: ST.dotCount, preview: ST.previewCount, busy: ST.busy(),
        panel: !ui.over.classList.contains('hidden') ? 'over' : null, step: ST.stepPx(),
      };
    },
    get G() { return G; },
    get rules() { return R; },
  };

  let booted = false;
  const go = () => {
    if (booted) return;
    booted = true;
    boot();
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go);
  setTimeout(go, 1500);
})();
