/* TT Flip Discs: the renderer, the garden and the board.
   The board is a wooden frame with a green top on four short legs, on a straw mat on the lawn (the garden from TT
   Gomoku). The top is painted with 6 × 6 or 8 × 8 squares. Every disc has two faces: Teddy's dark one (blue, 🏀)
   and Tommy's light one (cream, ✌️); 🦊 Foxy's face takes the place of the colour she plays (emblem()). A flip turns
   the disc over with a little hop, the discs nearest the new one first. A tray of discs stands beside each player.
     setSize(n)            a new board, cleared;  set(board) show a board straight away
     place(i, color, flips) a disc drops in with a bounce, then `flips` turn over one after another (returns how long
                           that takes);  unplace(i, flips) takes it back (undo): it hops away and the flips turn back
     last(i)               the soft glow round the last disc; -1 hides it
     dots(cells, color)    the little dots on the squares the player to move can go to
     preview(cells)        the discs a move would flip: they lift a little and glow
     hint(i, color)        the square glows gold, with a see-through disc and a bouncing 👇 (your brother's tip)
     cursor(i, color), hover(i, color)   the ring and the see-through disc for where you'd play
     win(color)            the winner's discs bounce in a wave
     trays(colors), tray(k, x, z)   the trays' colours and where player k's tray stands
     pick(x, y)            the square under a screen point, or -1
   fit(points, elev, margins) aims the camera so world points fill the screen minus margins (in pixels). */
(function () {
  'use strict';
  const T = THREE;
  const FLP = (window.FLP = window.FLP || {});
  const { makeCanvas, toTexture, std, rand, pick: pickOne, radialTexture, emojiTexture } = Kit.gfx;

  const HALF = 2.75; // half the board's width
  const EDGE = 0.3; // from the outer squares to the board's edge
  const SPAN = 2 * (HALF - EDGE); // the squares, edge to edge
  const LEG_H = 0.22, BLOCK_H = 0.42;
  const TOP = LEG_H + BLOCK_H; // height of the board's top
  const COL = { 1: '#1d3a8a', 2: '#fff1d2' }; // dark (blue) and light (cream)
  const EMBLEM = { 1: '🏀', 2: '✌️' };
  const FLIP = { delay: 0.2, step: 0.075, dur: 0.34 }; // when the first flip starts, the gap per square, one flip

  let renderer = null, W = 1, H = 1, n = 8, pitch = SPAN / 8;
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(36, 1, 0.1, 300);
  const fx = { hint: -1, hintC: 1, hintT: 0, cursor: -1, cursorC: 1, hover: -1, hoverC: 1, last: -1, t: 0, win: 0, winT: 0 };
  const camBase = new T.Vector3();
  const discs = new Map(); // square -> { g, flip, color, anim, flipAnim, peek }
  let top = null, glowMesh = null, finger = null, ring = null, lastGlow = null;
  const ghosts = {}, faceMat = {}, emblemMat = {}, trays = [], dotPool = [], peekPool = [];
  const halfTop = new T.CylinderGeometry(1, 1, 1, 36);
  halfTop.translate(0, 0.5, 0);
  const halfBot = new T.CylinderGeometry(1, 1, 1, 36);
  halfBot.translate(0, -0.5, 0);
  const embUp = new T.CircleGeometry(1, 32);
  embUp.rotateX(-Math.PI / 2);
  const embDown = new T.CircleGeometry(1, 32);
  embDown.rotateX(Math.PI / 2);
  const tmp = new T.Vector3(), tmpQ = new T.Quaternion(), axis = new T.Vector3();
  const UP = new T.Quaternion(), DOWN = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI);
  let onFlip = null;

  function init(canvas) {
    renderer = new T.WebGLRenderer({ canvas, antialias: true });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    for (const c of [1, 2]) {
      faceMat[c] = std(COL[c], c === 1 ? { roughness: 0.3, metalness: 0.12 } : { roughness: 0.38, metalness: 0.02 });
      emblemMat[c] = new T.MeshBasicMaterial({ map: emojiTexture(EMBLEM[c]), transparent: true, depthWrite: false, opacity: 0.95 });
    }
    buildGarden();
    buildBoard();
    setSize(8);
    resize();
  }

  // the emoji on colour c's face of every disc (🏀 / ✌️ for the boys, 🦊 when Foxy plays that colour)
  function emblem(c, emoji) {
    if (emblemMat[c].userData.emoji === emoji) return;
    emblemMat[c].map = emojiTexture(emoji);
    emblemMat[c].userData.emoji = emoji;
    emblemMat[c].needsUpdate = true;
    ghosts[c].children[1].material.map = emblemMat[c].map;
    ghosts[c].children[1].material.needsUpdate = true;
  }

  function resize() {
    W = Math.max(1, innerWidth || 1);
    H = Math.max(1, innerHeight || 1);
    if (renderer) renderer.setSize(W, H, false);
    cam.aspect = W / H;
    cam.updateProjectionMatrix();
  }

  // A rounded rectangle slab, w wide (x) and d deep (z), h tall, centred on the origin, flat on y.
  function slab(w, d, h, r, bevel = 0.04) {
    const s = new T.Shape();
    const x = -w / 2 + bevel, y = -d / 2 + bevel, ww = w - 2 * bevel, dd = d - 2 * bevel, rr = Math.max(0.01, r - bevel);
    s.moveTo(x + rr, y);
    s.lineTo(x + ww - rr, y);
    s.quadraticCurveTo(x + ww, y, x + ww, y + rr);
    s.lineTo(x + ww, y + dd - rr);
    s.quadraticCurveTo(x + ww, y + dd, x + ww - rr, y + dd);
    s.lineTo(x + rr, y + dd);
    s.quadraticCurveTo(x, y + dd, x, y + dd - rr);
    s.lineTo(x, y + rr);
    s.quadraticCurveTo(x, y, x + rr, y);
    const g = new T.ExtrudeGeometry(s, { depth: h - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -(h - 2 * bevel) / 2, 0);
    return g;
  }

  // ---------------------------------------------------------------- the garden

  function lawnTexture() {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = '#7fd35c';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#74c851';
    for (let i = 0; i < 4; i++) g.fillRect(0, i * 64, 256, 32);
    for (let i = 0; i < 1100; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(30,90,10,0.08)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 5);
    }
    return toTexture(c, true);
  }

  // a woven straw mat under the board
  function matTexture() {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = '#e9cf8a';
    g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 8) {
      g.fillStyle = (y / 8) % 2 ? 'rgba(160,120,50,0.22)' : 'rgba(255,255,255,0.18)';
      g.fillRect(0, y, 256, 4);
    }
    g.fillStyle = 'rgba(214,72,72,0.85)';
    g.fillRect(0, 0, 256, 14);
    g.fillRect(0, 242, 256, 14);
    return toTexture(c, true);
  }

  function buildGarden() {
    scene.background = new T.Color('#9fdcff');
    scene.add(new T.HemisphereLight('#ffffff', '#5a8a3a', 0.85));
    const sun = new T.DirectionalLight('#fff3dc', 1.0);
    sun.position.set(-5, 12, 8);
    scene.add(sun);

    const tex = lawnTexture();
    tex.repeat.set(30, 30);
    const ground = new T.Mesh(new T.PlaneGeometry(120, 120), std('#ffffff', { map: tex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const mt = matTexture();
    const mat = new T.Mesh(new T.PlaneGeometry(HALF * 2 + 2.2, HALF * 2 + 1.6), std('#ffffff', { map: mt, roughness: 1 }));
    mat.rotation.x = -Math.PI / 2;
    mat.position.y = 0.01;
    scene.add(mat);

    // a white picket fence along the back, then hedges and trees
    const white = std('#ffffff', { roughness: 0.6 });
    const postGeo = new T.BoxGeometry(0.22, 1.3, 0.1), tipGeo = new T.ConeGeometry(0.16, 0.22, 4);
    const fenceZ = -10.5;
    for (let x = -26; x <= 26; x += 0.55) {
      const post = new T.Mesh(postGeo, white);
      post.position.set(x, 0.65, fenceZ);
      scene.add(post);
      const tip = new T.Mesh(tipGeo, white);
      tip.position.set(x, 1.4, fenceZ);
      tip.rotation.y = Math.PI / 4;
      scene.add(tip);
    }
    for (const y of [0.35, 1.0]) {
      const rail = new T.Mesh(new T.BoxGeometry(53, 0.14, 0.08), white);
      rail.position.set(0, y, fenceZ + 0.08);
      scene.add(rail);
    }
    const leaf = [std('#3f9e3a'), std('#4cb244'), std('#378c33')];
    const bush = (x, z, s) => {
      for (let i = 0; i < 3; i++) {
        const b = new T.Mesh(new T.SphereGeometry(0.7 * s, 14, 10), leaf[i]);
        b.position.set(x + (i - 1) * 0.6 * s, 0.45 * s + (i === 1 ? 0.25 * s : 0), z + (i % 2) * 0.2);
        scene.add(b);
      }
    };
    const tree = (x, z, s) => {
      const trunk = new T.Mesh(new T.CylinderGeometry(0.22 * s, 0.3 * s, 2.2 * s, 8), std('#8a5a32'));
      trunk.position.set(x, 1.1 * s, z);
      scene.add(trunk);
      for (const [dx, dy, r] of [[0, 2.8, 1.3], [-0.8, 2.3, 0.9], [0.8, 2.4, 0.95]]) {
        const crown = new T.Mesh(new T.SphereGeometry(r * s, 16, 12), leaf[dx > 0 ? 1 : 0]);
        crown.position.set(x + dx * s, dy * s, z);
        scene.add(crown);
      }
    };
    for (const x of [-13, -8, 8, 13]) bush(x, -9.6, 1.3);
    bush(-12, -2, 1.4);
    bush(12, -2, 1.4);
    bush(-12.5, 5, 1.5);
    bush(12.5, 5, 1.5);
    tree(-17, -13, 1.6);
    tree(17, -13, 1.6);
    tree(-3, -14, 1.3);
    tree(5, -15, 1.5);

    // flowers, kept clear of the mat and the spots where the boys stand
    const petals = ['#ff6f91', '#ffd23f', '#ffffff', '#a77bff', '#ff8a1f'];
    const stem = std('#2f8a2a'), centre = std('#ffcc00');
    for (let i = 0; i < 110; i++) {
      const x = rand(-15, 15), z = rand(-9.8, 9.5);
      if (Math.abs(x) < HALF + 3.4 && z > -HALF - 3.8 && z < HALF + 1.8) continue;
      const f = new T.Group();
      const s = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.35, 5), stem);
      s.position.y = 0.17;
      f.add(s);
      const head = new T.Mesh(new T.SphereGeometry(0.11, 8, 6), std(pickOne(petals)));
      head.position.y = 0.38;
      head.scale.y = 0.6;
      f.add(head);
      const dot = new T.Mesh(new T.SphereGeometry(0.05, 6, 4), centre);
      dot.position.y = 0.43;
      f.add(dot);
      f.position.set(x, 0, z);
      scene.add(f);
    }
  }

  // ---------------------------------------------------------------- the board

  function woodTexture(base, dark, size = 256) {
    const [c, g] = makeCanvas(size, size);
    g.fillStyle = base;
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < 46; i++) {
      g.strokeStyle = dark;
      g.globalAlpha = rand(0.05, 0.14);
      g.lineWidth = rand(1, 3) * (size / 256);
      g.beginPath();
      const y = rand(0, size);
      g.moveTo(0, y);
      g.bezierCurveTo(size * 0.3, y + rand(-8, 8), size * 0.66, y + rand(-8, 8), size, y + rand(-6, 6));
      g.stroke();
    }
    g.globalAlpha = 1;
    return [c, g];
  }

  // the top: the wooden rim, the green squares (a soft checker so each square shows) and the four little dots
  const TEX = 1024, P = HALF - 0.04; // the top plane's half width
  const toPx = (v) => ((v + P) / (2 * P)) * TEX;
  function topTexture(size) {
    const [c, g] = woodTexture('#d9a35a', '#7a4a20', TEX);
    const step = SPAN / size, x0 = -SPAN / 2;
    const a = toPx(x0), b = toPx(-x0), px = (b - a) / size;
    g.fillStyle = '#2f9e57';
    g.fillRect(a, a, b - a, b - a);
    for (let r = 0; r < size; r++) {
      for (let k = 0; k < size; k++) {
        g.fillStyle = (r + k) % 2 ? '#2b9450' : '#33a65d';
        g.fillRect(a + k * px, a + r * px, px, px);
      }
    }
    // a soft felt speckle
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,40,10,0.06)';
      g.fillRect(a + Math.random() * (b - a), a + Math.random() * (b - a), 3, 3);
    }
    g.strokeStyle = 'rgba(12, 52, 26, 0.9)';
    g.lineCap = 'square';
    for (let k = 0; k <= size; k++) {
      const v = toPx(x0 + k * step);
      g.lineWidth = k === 0 || k === size ? 7 : 4;
      g.beginPath();
      g.moveTo(a, v);
      g.lineTo(b, v);
      g.stroke();
      g.beginPath();
      g.moveTo(v, a);
      g.lineTo(v, b);
      g.stroke();
    }
    g.fillStyle = 'rgba(12, 52, 26, 0.95)';
    const marks = size === 8 ? [2, 6] : []; // the big board's four little dots, where the lines cross
    for (const r of marks) {
      for (const k of marks) {
        g.beginPath();
        g.arc(toPx(x0 + k * step), toPx(x0 + r * step), 11, 0, Math.PI * 2);
        g.fill();
      }
    }
    const t = toTexture(c);
    if (renderer) t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  function buildBoard() {
    const board = new T.Group();
    scene.add(board);
    const [wc] = woodTexture('#c98d45', '#6a3c18');
    const side = std('#ffffff', { map: toTexture(wc), roughness: 0.6 });
    const block = new T.Mesh(slab(HALF * 2, HALF * 2, BLOCK_H, 0.16, 0.05), [std('#d29a50', { roughness: 0.6 }), side]);
    block.position.y = LEG_H + BLOCK_H / 2;
    board.add(block);
    const legMat = std('#a8692f', { roughness: 0.7 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new T.Mesh(new T.CylinderGeometry(0.32, 0.26, LEG_H + 0.02, 12), legMat);
        leg.position.set(sx * (HALF - 0.55), LEG_H / 2, sz * (HALF - 0.55));
        board.add(leg);
      }
    }
    top = new T.Mesh(new T.PlaneGeometry(P * 2, P * 2), std('#ffffff', { roughness: 0.75 }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = TOP + 0.003;
    board.add(top);

    // a wooden tray with a stack of discs beside each player
    for (let k = 0; k < 2; k++) {
      const g = new T.Group();
      const wood = std('#9a5f2c', { roughness: 0.5 });
      const base = new T.Mesh(slab(1.5, 1.1, 0.16, 0.16, 0.03), wood);
      base.position.y = 0.08;
      g.add(base);
      const stack = new T.Group();
      for (let j = 0; j < 7; j++) {
        const d = makeDiscMesh();
        d.scale.setScalar(0.34);
        d.position.set((j % 2 ? 0.32 : -0.3) + rand(-0.04, 0.04), 0.2 + Math.floor(j / 2) * 0.115, rand(-0.06, 0.06));
        d.rotation.y = rand(0, 6);
        stack.add(d);
      }
      g.add(stack);
      g.userData.stack = stack;
      scene.add(g);
      trays.push(g);
    }

    // the see-through discs for where you'd play
    for (const c of [1, 2]) {
      const g = new T.Group();
      g.add(new T.Mesh(halfTop, new T.MeshBasicMaterial({ color: COL[c], transparent: true, opacity: 0.55, depthWrite: false })));
      const e = new T.Mesh(embUp, new T.MeshBasicMaterial({ map: emblemMat[c].map, transparent: true, opacity: 0.5, depthWrite: false }));
      e.position.y = 1.05;
      e.scale.set(0.66, 1, 0.66);
      g.add(e);
      g.visible = false;
      g.renderOrder = 7;
      scene.add(g);
      ghosts[c] = g;
    }
    // the dots on the squares you can go to
    // a round dot with a dark rim, tinted the colour of the player to move
    const [dc, dg] = makeCanvas(64, 64);
    dg.fillStyle = 'rgba(12,52,26,0.7)';
    dg.beginPath();
    dg.arc(32, 32, 30, 0, Math.PI * 2);
    dg.fill();
    dg.fillStyle = '#ffffff';
    dg.beginPath();
    dg.arc(32, 32, 23, 0, Math.PI * 2);
    dg.fill();
    const dotTex = toTexture(dc);
    for (let i = 0; i < 40; i++) {
      const d = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: dotTex, transparent: true, depthWrite: false, color: '#ffffff' }));
      d.rotation.x = -Math.PI / 2;
      d.visible = false;
      d.renderOrder = 3;
      scene.add(d);
      dotPool.push(d);
    }
    // the glow on the discs a move would flip
    const peekTex = radialTexture(128, [[0, 'rgba(255,240,140,0)'], [0.48, 'rgba(255,236,120,0.1)'], [0.62, 'rgba(255,226,90,0.95)'], [0.8, 'rgba(255,200,40,0.4)'], [1, 'rgba(255,190,0,0)']]);
    for (let i = 0; i < 24; i++) {
      const p = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: peekTex, transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending }));
      p.rotation.x = -Math.PI / 2;
      p.visible = false;
      p.renderOrder = 9;
      scene.add(p);
      peekPool.push(p);
    }
    // the hint glow and finger, the cursor ring, the last-move glow
    const glowTex = radialTexture(128, [[0, 'rgba(255,230,90,1)'], [0.45, 'rgba(255,200,40,0.65)'], [1, 'rgba(255,190,0,0)']]);
    glowMesh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    glowMesh.rotation.x = -Math.PI / 2;
    glowMesh.visible = false;
    glowMesh.renderOrder = 5;
    scene.add(glowMesh);
    finger = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture('👇'), depthTest: false, transparent: true, opacity: 0.9 }));
    finger.visible = false;
    finger.renderOrder = 25;
    scene.add(finger);
    const [rc, rg] = makeCanvas(128, 128);
    rg.strokeStyle = '#14121f';
    rg.lineWidth = 14;
    rg.strokeRect(10, 10, 108, 108);
    rg.strokeStyle = '#ffd400';
    rg.lineWidth = 8;
    rg.strokeRect(10, 10, 108, 108);
    ring = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: toTexture(rc), transparent: true, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    ring.renderOrder = 6;
    scene.add(ring);
    const lastTex = radialTexture(128, [[0, 'rgba(255,240,160,0)'], [0.5, 'rgba(255,236,120,0)'], [0.66, 'rgba(255,226,90,0.95)'], [0.82, 'rgba(255,200,40,0.45)'], [1, 'rgba(255,190,0,0)']]);
    lastGlow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: lastTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    lastGlow.rotation.x = -Math.PI / 2;
    lastGlow.visible = false;
    lastGlow.renderOrder = 3;
    scene.add(lastGlow);
  }

  // One disc, radius 1 and 0.3 thick, centred on y = 0: the dark face up, the light face down, an emoji on each.
  const THICK = 0.3;
  function makeDiscMesh() {
    const flip = new T.Group();
    const up = new T.Mesh(halfTop, faceMat[1]);
    up.scale.set(1, THICK / 2, 1);
    const down = new T.Mesh(halfBot, faceMat[2]);
    down.scale.set(1, THICK / 2, 1);
    const eu = new T.Mesh(embUp, emblemMat[1]);
    eu.scale.setScalar(0.66);
    eu.position.y = THICK / 2 + 0.01;
    eu.renderOrder = 2;
    const ed = new T.Mesh(embDown, emblemMat[2]);
    ed.scale.setScalar(0.66);
    ed.position.y = -THICK / 2 - 0.01;
    ed.renderOrder = 2;
    flip.add(up, down, eu, ed);
    return flip;
  }

  // A new board of size × size squares; the discs all go.
  function setSize(size) {
    if (top.material.map && n === size) {
      set(null);
      return;
    }
    n = size;
    pitch = SPAN / n;
    if (top.material.map) top.material.map.dispose();
    top.material.map = topTexture(n);
    top.material.needsUpdate = true;
    const r = discR();
    for (const c of [1, 2]) ghosts[c].scale.set(r, r * THICK * 0.5, r);
    glowMesh.scale.setScalar(pitch * 1.6);
    ring.scale.setScalar(pitch * 1.04);
    lastGlow.scale.setScalar(pitch * 1.25);
    for (const d of dotPool) d.scale.setScalar(pitch * 0.3);
    for (const p of peekPool) p.scale.setScalar(pitch * 1.15);
    finger.scale.setScalar(Math.max(0.55, Math.min(0.85, pitch * 1.2)));
    set(null);
  }
  const discR = () => pitch * 0.41;
  const restY = () => TOP + discR() * THICK * 0.5 + 0.005;

  const cellPos = (i, out = new T.Vector3()) => out.set(-SPAN / 2 + ((i % n) + 0.5) * pitch, TOP, -SPAN / 2 + (Math.floor(i / n) + 0.5) * pitch);

  function makeDisc(i, color) {
    const g = new T.Group();
    const flip = makeDiscMesh();
    g.add(flip);
    g.scale.setScalar(discR());
    flip.quaternion.copy(color === 1 ? UP : DOWN);
    tmpQ.setFromAxisAngle(new T.Vector3(0, 1, 0), rand(-0.5, 0.5));
    flip.quaternion.premultiply(tmpQ);
    cellPos(i, g.position);
    g.position.y = restY();
    scene.add(g);
    const d = { g, flip, color, anim: null, flipAnim: null, bounce: -1, peek: 0, baseY: g.position.y };
    discs.set(i, d);
    return d;
  }
  function drop(i) {
    const d = discs.get(i);
    if (!d) return;
    scene.remove(d.g);
    discs.delete(i);
  }

  function set(board) {
    for (const i of [...discs.keys()]) drop(i);
    for (const d of leaving) scene.remove(d.g);
    leaving.length = 0;
    fx.win = 0;
    if (board) board.forEach((v, i) => v && makeDisc(i, v));
    fx.last = -1;
  }

  // Turn disc i over to `color`, `wait` seconds from now, tipping away from square `from`.
  function flipTo(i, color, wait, from, quiet = false) {
    const d = discs.get(i);
    if (!d) return;
    if (d.flipAnim) {
      // still turning from the last flip (a quick undo): finish that one first
      tmpQ.setFromAxisAngle(d.flipAnim.axis, Math.PI);
      d.flip.quaternion.multiplyQuaternions(tmpQ, d.flipAnim.q0);
    }
    const a = cellPos(from), b = cellPos(i);
    // the axis lies flat, across the line from the new disc, so it tips over away from it
    axis.set(b.z - a.z, 0, -(b.x - a.x));
    if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
    axis.normalize();
    d.color = color;
    d.flipAnim = { t: -wait, dur: FLIP.dur, axis: axis.clone(), q0: d.flip.quaternion.clone(), started: false, quiet };
  }

  // the order and timing of the flips: the nearest first
  function flipPlan(i, flips) {
    const r0 = Math.floor(i / n), c0 = i % n;
    return flips.map((f) => ({ f, k: Math.max(Math.abs(Math.floor(f / n) - r0), Math.abs((f % n) - c0)) }));
  }

  // A disc drops onto square i; then `flips` turn over to its colour. Returns the seconds until the last one lands.
  function place(i, color, flips = []) {
    drop(i);
    const d = makeDisc(i, color);
    d.anim = { kind: 'drop', t: 0, dur: 0.3 };
    d.g.position.y = d.baseY + 1.4;
    let last = 0;
    for (const { f, k } of flipPlan(i, flips)) {
      const wait = FLIP.delay + (k - 1) * FLIP.step;
      flipTo(f, color, wait, i);
      last = Math.max(last, wait + FLIP.dur);
    }
    return last;
  }
  // Undo: the disc on i hops away and `flips` turn back to the other colour.
  function unplace(i, flips = []) {
    const d = discs.get(i);
    if (d) {
      discs.delete(i);
      d.anim = { kind: 'lift', t: 0, dur: 0.35 };
      leaving.push(d);
    }
    const back = d ? 3 - d.color : 0;
    for (const { f, k } of flipPlan(i, flips)) {
      const was = discs.get(f);
      flipTo(f, back || 3 - was.color, 0.05 + (k - 1) * 0.05, i, true);
    }
  }
  const leaving = [];

  function win(color) {
    fx.win = color;
    fx.winT = 0;
  }

  function hint(i, color = 1) {
    if (fx.hint !== i) fx.hintT = 0;
    fx.hint = i;
    fx.hintC = color;
  }
  function cursor(i, color = 1) {
    fx.cursor = i;
    fx.cursorC = color;
  }
  function hover(i, color = 1) {
    fx.hover = i;
    fx.hoverC = color;
  }
  function last(i) { fx.last = i; }

  let dotList = [], dotC = 1;
  function dots(cells, color = 1) {
    dotList = cells || [];
    dotC = color;
  }
  let peekList = [];
  function preview(cells) {
    peekList = cells || [];
  }

  function trayColors(colors) {
    trays.forEach((t, k) => t.userData.stack.children.forEach((d) => d.quaternion.copy(colors[k] === 1 ? UP : DOWN).premultiply(tmpQ.setFromAxisAngle(new T.Vector3(0, 1, 0), d.userData.yaw || (d.userData.yaw = rand(0, 6))))));
  }
  function tray(k, x, z) {
    trays[k].position.set(x, 0, z);
  }

  // ---------------------------------------------------------------- every frame

  function update(dt) {
    fx.t += dt;
    if (fx.win) fx.winT += dt;
    const peekSet = new Set(peekList);
    const wr = Math.floor(n / 2), wc = Math.floor(n / 2);
    for (const [i, d] of discs) {
      let y = d.baseY;
      const a = d.anim;
      if (a) {
        a.t += dt;
        const u = Math.min(1, a.t / a.dur);
        if (u < 0.6) {
          const k = u / 0.6;
          y = d.baseY + 1.4 * (1 - k * k);
        } else {
          const k = (u - 0.6) / 0.4;
          const sq = Math.sin(k * Math.PI) * 0.28 * (1 - k);
          d.g.scale.set(discR() * (1 + sq), discR() * (1 - sq * 1.4), discR() * (1 + sq));
        }
        if (u >= 1) {
          d.anim = null;
          d.g.scale.setScalar(discR());
        }
      }
      const f = d.flipAnim;
      if (f) {
        f.t += dt;
        if (f.t >= 0) {
          if (!f.started) {
            f.started = true;
            if (onFlip && !f.quiet) onFlip(i, d.color);
          }
          const u = Math.min(1, f.t / f.dur);
          const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
          tmpQ.setFromAxisAngle(f.axis, Math.PI * e);
          d.flip.quaternion.multiplyQuaternions(tmpQ, f.q0);
          y += Math.sin(u * Math.PI) * pitch * 0.55;
          if (u >= 1) d.flipAnim = null;
        }
      }
      // the discs a move would flip lift a little, wobbling
      const peekOn = peekSet.has(i) && !f;
      d.peek += ((peekOn ? 1 : 0) - d.peek) * Math.min(1, dt * 14);
      if (d.peek > 0.01) y += d.peek * (pitch * 0.12 + Math.sin(fx.t * 9 + i) * pitch * 0.03);
      // the winner's discs bounce in a wave out from the middle
      if (fx.win && d.color === fx.win && !f) {
        const k = Math.max(Math.abs(Math.floor(i / n) - wr + 0.5), Math.abs((i % n) - wc + 0.5));
        const u = fx.winT - k * 0.09;
        if (u > 0) y += Math.abs(Math.sin(u * 6)) * pitch * 0.35 * Math.max(0.3, Math.exp(-u * 0.25));
      }
      d.g.position.y = y;
    }
    for (let k = leaving.length - 1; k >= 0; k--) {
      const d = leaving[k];
      d.anim.t += dt;
      const u = Math.min(1, d.anim.t / d.anim.dur);
      d.g.position.y = d.baseY + u * 1.2;
      d.g.rotation.y = u * 6;
      d.g.scale.setScalar(Math.max(0.001, discR() * (1 - u)));
      if (u >= 1) {
        scene.remove(d.g);
        leaving.splice(k, 1);
      }
    }
    // the dots, gently breathing
    dotPool.forEach((m, k) => {
      const i = dotList[k];
      m.visible = i !== undefined && !discs.has(i) && i !== fx.hint;
      if (!m.visible) return;
      cellPos(i, tmp);
      m.position.set(tmp.x, TOP + 0.007, tmp.z);
      m.material.color.set(dotC === 1 ? '#7f9cf0' : '#fff3d6');
      m.material.opacity = 0.85 + Math.sin(fx.t * 3 + k) * 0.12;
      m.scale.setScalar(pitch * (0.3 + Math.sin(fx.t * 3 + k) * 0.03));
    });
    peekPool.forEach((m, k) => {
      const i = peekList[k];
      const d = i !== undefined && discs.get(i);
      m.visible = !!d;
      if (!d) return;
      m.position.set(d.g.position.x, d.g.position.y + discR() * THICK * 0.5 + 0.02, d.g.position.z);
      m.material.opacity = 0.75 + Math.sin(fx.t * 7) * 0.25;
    });
    // the last move's glow, breathing softly
    const ls = fx.last >= 0 && discs.get(fx.last);
    lastGlow.visible = !!ls && !ls.anim;
    if (lastGlow.visible) {
      cellPos(fx.last, tmp);
      lastGlow.position.set(tmp.x, TOP + 0.006, tmp.z);
      lastGlow.material.opacity = 0.75 + Math.sin(fx.t * 3.2) * 0.25;
    }
    // the hint: glow and a bouncing finger
    const h = fx.hint;
    glowMesh.visible = finger.visible = h >= 0;
    if (h >= 0) {
      fx.hintT += dt;
      cellPos(h, tmp);
      glowMesh.position.set(tmp.x, TOP + 0.008, tmp.z);
      glowMesh.scale.setScalar(pitch * 1.7 * (1 + Math.sin(fx.t * 6) * 0.12) * Math.min(1, fx.hintT * 4));
      finger.position.set(tmp.x, TOP + 0.1 + finger.scale.x * 1.15 + Math.abs(Math.sin(fx.t * 5)) * 0.22, tmp.z);
    }
    // the cursor (keyboard) or the square under the mouse or finger: a ring and a see-through disc
    const gi = fx.hover >= 0 ? fx.hover : fx.cursor >= 0 ? fx.cursor : fx.hint;
    const gc = fx.hover >= 0 ? fx.hoverC : fx.cursor >= 0 ? fx.cursorC : fx.hintC;
    const pointing = fx.hover >= 0 ? fx.hover : fx.cursor;
    ring.visible = pointing >= 0;
    if (pointing >= 0) {
      cellPos(pointing, tmp);
      ring.position.set(tmp.x, TOP + 0.012, tmp.z);
      ring.scale.setScalar(pitch * 1.02 * (1 + Math.sin(fx.t * 7) * 0.03));
    }
    ghosts[1].visible = ghosts[2].visible = false;
    if (gi >= 0 && !discs.has(gi)) {
      const g = ghosts[gc];
      cellPos(gi, tmp);
      g.visible = true;
      g.position.set(tmp.x, TOP + 0.03 + Math.sin(fx.t * 4) * 0.02, tmp.z);
    }
    if (!cam.position.equals(camBase) && camBase.lengthSq()) {
      cam.position.copy(camBase);
      cam.updateMatrixWorld(true);
    }
  }

  // ---------------------------------------------------------------- camera

  // Aim the camera down at `elev` radians from the front so the world points `pts` fill the screen minus margins
  // { l, r, t, b } in pixels. It fits them in a box of that size in the middle of the picture, then slides the
  // picture (the camera's view offset) so the box sits over the free part of the screen. Returns the point it looks at.
  const right = new T.Vector3(), up = new T.Vector3();
  function fit(pts, elev, m) {
    cam.clearViewOffset();
    const dir = new T.Vector3(0, Math.sin(elev), Math.cos(elev));
    const center = new T.Vector3();
    pts.forEach((p) => center.add(p));
    center.multiplyScalar(1 / pts.length);
    const hw = Math.max(0.1, (W - m.l - m.r) / W), hh = Math.max(0.1, (H - m.t - m.b) / H);
    const box = { x0: -hw, x1: hw, y0: -hh, y1: hh };
    const place = (d) => {
      cam.position.copy(center).addScaledVector(dir, d);
      cam.lookAt(center);
      cam.updateMatrixWorld(true);
    };
    const bounds = () => {
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (const p of pts) {
        tmp.copy(p).project(cam);
        x0 = Math.min(x0, tmp.x);
        x1 = Math.max(x1, tmp.x);
        y0 = Math.min(y0, tmp.y);
        y1 = Math.max(y1, tmp.y);
      }
      return { x0, x1, y0, y1 };
    };
    for (let iter = 0; iter < 4; iter++) {
      let lo = 2, hi = 300;
      for (let i = 0; i < 32; i++) {
        const mid = (lo + hi) / 2;
        place(mid);
        const b = bounds();
        if (b.x0 >= box.x0 && b.x1 <= box.x1 && b.y0 >= box.y0 && b.y1 <= box.y1) hi = mid;
        else lo = mid;
      }
      place(hi);
      const b = bounds();
      const dx = (b.x0 + b.x1) / 2 - (box.x0 + box.x1) / 2;
      const dy = (b.y0 + b.y1) / 2 - (box.y0 + box.y1) / 2;
      const d = cam.position.distanceTo(center);
      const halfH = d * Math.tan((cam.fov * Math.PI) / 360), halfW = halfH * cam.aspect;
      right.setFromMatrixColumn(cam.matrixWorld, 0);
      up.setFromMatrixColumn(cam.matrixWorld, 1);
      center.addScaledVector(right, dx * halfW).addScaledVector(up, dy * halfH);
    }
    const bx = (m.l + W - m.r) / 2, by = (m.t + H - m.b) / 2;
    cam.setViewOffset(W, H, W / 2 - bx, H / 2 - by, W, H);
    cam.updateMatrixWorld(true);
    camBase.copy(cam.position);
    return center;
  }

  // The square under screen point (x, y), or -1 off the board.
  const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), -TOP), hit = new T.Vector3();
  function pick(x, y) {
    ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    const col = Math.floor((hit.x + SPAN / 2) / pitch), row = Math.floor((hit.z + SPAN / 2) / pitch);
    if (col < 0 || col >= n || row < 0 || row >= n) return -1;
    return row * n + col;
  }

  function toScreen(v, out = { x: 0, y: 0 }) {
    tmp.copy(v).project(cam);
    out.x = ((tmp.x + 1) / 2) * W;
    out.y = ((1 - tmp.y) / 2) * H;
    return out;
  }

  // how big one square is on screen, in pixels (across and front to back, near the middle)
  function stepPx() {
    const mid = ((n / 2) | 0) * n + ((n / 2) | 0);
    const a = toScreen(cellPos(mid)), b = toScreen(cellPos(mid + 1)), c = toScreen(cellPos(mid + n));
    return { across: +Math.hypot(b.x - a.x, b.y - a.y).toFixed(1), down: +Math.hypot(c.x - a.x, c.y - a.y).toFixed(1) };
  }

  function render() {
    if (renderer) renderer.render(scene, cam);
  }

  // the colour showing on top of each disc, as the board would read it (for the tests)
  function shown() {
    const out = new Array(n * n).fill(0);
    for (const [i, d] of discs) {
      tmp.set(0, 1, 0).applyQuaternion(d.flip.quaternion);
      out[i] = tmp.y > 0 ? 1 : 2;
    }
    return out.join('');
  }

  FLP.stage = {
    init, resize, render, update, fit, pick, toScreen, cellPos, setSize, set, place, unplace, last, win, hint, cursor, hover, dots, preview,
    trays: trayColors, tray, emblem, stepPx, shown, scene, cam, HALF, TOP, SPAN, COL, EMBLEM, FLIP,
    busy: () => leaving.length > 0 || [...discs.values()].some((d) => d.anim || d.flipAnim),
    set onFlip(fn) { onFlip = fn; },
    get W() { return W; },
    get H() { return H; },
    get n() { return n; },
    get pitch() { return pitch; },
    get renderer() { return renderer; },
    get hintCell() { return fx.hint; },
    get lastCell() { return fx.last; },
    get discCount() { return discs.size; },
    get dotCount() { return dotPool.filter((d) => d.visible).length; },
    get previewCount() { return peekList.length; },
  };
})();
