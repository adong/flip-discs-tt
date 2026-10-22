/* 中文 for TT Flip Discs: the words on the page, the toasts, the canvas word bursts and the ? panel (Kit.lang, from
   kit/lang.js). Simple words: Tommy is 5. The kids' and Foxy's names and the game's own name stay English. */
(function () {
  const L = Kit.lang;
  L.keep(['TT Flip Discs', 'TT', 'Flip Discs', 'TEDDY', 'TOMMY', 'FOXY', 'Teddy', 'Tommy', 'Foxy', 'Esc', 'Enter', 'Space']);

  L.add({
    // the menu
    'TRAP THEM TO FLIP THEM!': '黑白棋：夹住对方的棋子，就能翻转！',
    LITTLE: '小棋盘', BIG: '大棋盘',
    'Little board, 6 by 6': '小棋盘，6 × 6', 'Big board, 8 by 8': '大棋盘，8 × 8',
    '1 PLAYER': '1 人玩', '2 PLAYERS': '2 人玩', 'Players': '几个人玩', 'Who are you?': '你是谁？', 'Level': '难度',
    UNDO: '悔棋', 'Undo button on or off (U)': '悔棋按钮 开 / 关 (U)', 'Undo button on or off': '悔棋按钮 开 / 关',
    DOTS: '小圆点', 'Dots on the squares you can go to (D)': '在能下的格子上显示小圆点 (D)', 'Dots on the squares you can go to': '在能下的格子上显示小圆点',
    // while playing
    'Pause': '暂停', 'Pause (P)': '暂停 (P)', 'Undo': '悔棋', 'Undo (U)': '悔棋 (U)', 'Sound (M)': '声音 (M)', 'Sound on or off': '声音 开 / 关',
    'Call your brother': '叫兄弟来帮忙', 'High five!': '击掌！', 'High five! (T)': '击掌！(T)', 'HIGH FIVE! 🙌': '击掌！🙌',
    'YOUR TURN!': '轮到你啦！', 'DRAW!': '平局！', '↩️ UNDO!': '↩️ 悔棋！',
    // game over, pause
    'Home': '主页', 'Play again': '再玩一次', 'PLAY AGAIN': '再玩一次', 'Keep playing': '继续玩', 'New game': '新的一局',
    // canvas word bursts over the board (js/fx.js draws them through Kit.lang.t)
    'NICE!': '好棋！', 'CORNER!': '占到角啦！', 'SUPER FLIP!': '超级翻转！', 'PASS!': '跳过！',
    // the ? panel (js/keys.js)
    'move round the board · put your disc there': '在棋盘上移动 · 在这里下棋',
    'undo': '悔棋',
    'call your brother (2 players: high five)': '叫兄弟来帮忙（2 人玩：击掌）',
    'new game': '新的一局',
    'menu: LITTLE 6 × 6 · BIG 8 × 8': '菜单：小棋盘 6 × 6 · 大棋盘 8 × 8',
    'menu: Teddy or Tommy · 1 or 2 players · level': '菜单：Teddy 还是 Tommy · 1 人或 2 人 · 难度',
    'menu: undo button on or off · dots on or off': '菜单：悔棋按钮 开 / 关 · 小圆点 开 / 关',
    'Put your disc down so it traps the other colour in a line, at both ends: across, up and down, or corner to corner. Every trapped disc flips over to your colour! No square that traps any? Then you pass. When nobody can go, the most discs wins. Teddy is dark blue 🏀, Tommy is cream ✌️.':
      '下一颗棋子，把对方的棋子夹在中间：横着、竖着、斜着都行。被夹住的棋子都会翻转成你的颜色！没有能夹住的格子？那就跳过一次。两边都不能下了，谁的棋子多谁就赢。Teddy 是深蓝色 🏀，Tommy 是奶油色 ✌️。',
    "Press a square to see your disc and what it would flip, slide to another, let go to put it down. The dots show where you can go. Tap your brother's face (bottom right) to call him.":
      '按住一个格子，就能看到你的棋子和会翻转哪些棋子，滑动可以换格子，松手就下棋。小圆点告诉你哪里能下。点右下角兄弟的头像，叫他来帮忙。',
  });

  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.rule(/^Call (\S+) \(T\)$/, '叫 $1 (T)');
  L.rule(/^Call (\S+)$/, '叫 $1');
  L.rule(/^(\S+)'S HERE!$/, '$1 来啦！');
  L.rule(/^(\S+) SAYS: HERE!$/, '$1 说：下这里！');
  L.rule(/^(\S+) SAYS: WIN HERE!$/, '$1 说：下这里就赢啦！');
  L.rule(/^(\S+) SAYS: GRAB THE CORNER!$/, '$1 说：快占这个角！');
  L.rule(/^(\S+) SAYS: ONLY HERE!$/, '$1 说：只能下这里！');
  L.rule(/^(\S+) IS THINKING…$/, '$1 在想…');
  L.rule(/^(\S+)'S TURN!$/, '轮到 $1！');
  L.rule(/^(\S+) WINS!$/, '$1 赢啦！');
  L.rule(/^(\S+) CAN'T GO!$/, '$1 没地方下！');
  L.rule(/^(\S+) CAN'T GO: PASS!$/, '$1 没地方下：跳过一次！');
  L.rule(/^🏆(\d+)$/, '🏆$1');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (\S+)!$/, (m, emoji, item, who) => `${emoji} ${who} 给你${TREAT[item]}！`);
})();
