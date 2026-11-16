// GGOBI 카드 게임 규칙 (화면과 상관없는 부분)
// 카드 글자: 색(r 빨강, y 노랑, g 초록, b 파랑) + 값(0~9, S 건너뛰기, R 방향 바꾸기, D +2)
//           W 색 바꾸기(와일드), F 색 바꾸기 +4
(function (root) {
  'use strict';
  var COLORS = ['r', 'y', 'g', 'b'];
  var CNAME = { r: '빨강', y: '노랑', g: '초록', b: '파랑' };
  var VORDER = '0123456789SRD';

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function makeDeck() {   // 108장
    var d = [];
    COLORS.forEach(function (c) {
      d.push(c + '0');
      for (var v = 1; v <= 9; v++) d.push(c + v, c + v);
      'SRD'.split('').forEach(function (s) { d.push(c + s, c + s); });
    });
    for (var i = 0; i < 4; i++) d.push('W', 'F');
    return shuffle(d);
  }
  var isWild = function (c) { return c === 'W' || c === 'F'; };
  var colOf = function (c) { return isWild(c) ? null : c[0]; };
  var valOf = function (c) { return isWild(c) ? c : c.slice(1); };
  function points(c) { if (isWild(c)) return 50; var v = valOf(c); return 'SRD'.indexOf(v) >= 0 ? 20 : +v; }
  function sortKey(c) { return isWild(c) ? 400 + (c === 'F' ? 1 : 0) : COLORS.indexOf(c[0]) * 100 + VORDER.indexOf(valOf(c)); }
  function sortHand(h) { h.sort(function (a, b) { return sortKey(a) - sortKey(b); }); }
  function top(g) { return g.pile[g.pile.length - 1]; }
  function canPlay(g, c) {
    if (isWild(c)) return true;
    var t = top(g);
    return colOf(c) === g.color || (!isWild(t) && valOf(c) === valOf(t));
  }
  function active(g) { return g.players.filter(function (p) { return !p.out; }).length; }
  function nxt(g, i, k) {
    var N = g.players.length, j = i;
    for (var s = 0; s < (k || 1); s++) {
      var guard = 0;
      do { j = ((j + g.dir) % N + N) % N; guard++; } while (g.players[j].out && guard <= N);
    }
    return j;
  }
  function ev(g, e) { g.evs.push(e); }
  function drawN(g, p, k) {
    var got = [];
    for (var i = 0; i < k; i++) {
      if (!g.deck.length) {
        if (g.pile.length <= 1) break;
        var t = g.pile.pop();
        g.deck = shuffle(g.pile);
        g.pile = [t];
        ev(g, { t: 'shuffle' });
      }
      got.push(g.deck.pop());
    }
    var P = g.players[p];
    P.hand = P.hand.concat(got); sortHand(P.hand);
    if (got.length) { P.gg = false; ev(g, { t: 'draw', p: p, k: got.length }); }
    return got;
  }

  // 새 게임: players = [{id, name, ai}]
  function newGame(players, opts, now) {
    var g = {
      players: players.map(function (p) { return { id: p.id, name: p.name, ai: p.ai || 0, hand: [], score: 0, gg: false, out: false }; }),
      deck: [], pile: [], color: 'r', dir: 1, turn: 0, round: 0, phase: 'play',
      dealer: Math.floor(Math.random() * players.length),
      drawn: null, exposed: -1, pend4: null, res: null, winner: -1,
      target: opts.target || 0, sec: opts.sec || 0, turnAt: now || 0, seq: 0, evs: []
    };
    startRound(g, now, true);
    return g;
  }
  function startRound(g, now, first) {
    g.evs = []; g.seq++;
    g.round++;
    if (!first) g.dealer = nxtFrom(g, g.dealer);
    g.dir = 1;
    var deck = makeDeck();
    g.players.forEach(function (p) { p.hand = []; p.gg = false; });
    for (var k = 0; k < 7; k++) g.players.forEach(function (p) { if (!p.out) p.hand.push(deck.pop()); });
    g.players.forEach(function (p) { sortHand(p.hand); });
    var t;
    for (;;) {   // 첫 카드가 +4이면 더미에 되돌리고 다른 카드를 펼쳐요
      t = deck.pop();
      if (t === 'F') { deck.splice(Math.floor(Math.random() * deck.length), 0, t); continue; }
      break;
    }
    g.deck = deck; g.pile = [t]; g.color = colOf(t);
    g.exposed = -1; g.pend4 = null; g.drawn = null; g.res = null; g.winner = -1;
    ev(g, { t: 'deal' }); ev(g, { t: 'flip', c: t });
    var f = nxtFrom(g, g.dealer);
    g.phase = 'play';
    var v = valOf(t);
    if (v === 'W') { g.phase = 'pick'; g.turn = f; }
    else if (v === 'D') { drawN(g, f, 2); g.turn = nxt(g, f); ev(g, { t: 'skip', p: f }); }
    else if (v === 'S') { g.turn = nxt(g, f); ev(g, { t: 'skip', p: f }); }
    else if (v === 'R') { g.dir = -1; g.turn = g.dealer; ev(g, { t: 'rev' }); }
    else g.turn = f;
    g.turnAt = now || 0;
  }
  function nxtFrom(g, i) { var d = g.dir; g.dir = 1; var r = nxt(g, i); g.dir = d; return r; }

  function endRound(g, w) {
    var pts = 0;
    g.players.forEach(function (p, i) { if (i !== w) p.hand.forEach(function (c) { pts += points(c); }); });
    g.players[w].score += pts;
    g.res = { w: w, pts: pts, hands: {} };
    g.players.forEach(function (p, i) { g.res.hands[i] = p.hand.slice(); });   // Firebase는 배열 안의 배열을 못 담아서 칸 이름으로
    ev(g, { t: 'win', p: w, pts: pts });
    g.exposed = -1; g.pend4 = null; g.drawn = null;
    if (!g.target || g.players[w].score >= g.target) { g.phase = 'gameEnd'; g.winner = w; }
    else g.phase = 'roundEnd';
  }

  // 행동 하나를 처리해요. 잘못된 행동이면 이유(글자)를 돌려주고 아무것도 바꾸지 않아요.
  // who: 행동한 사람 번호 (-2: 한 화면 모드에서 "누군가", -3: 시간 초과 처리)
  function act(g, who, a, now) {
    var P = g.players, me = P[who];
    var playing = g.phase === 'play' || g.phase === 'drawn' || g.phase === 'pick' || g.phase === 'challenge';
    var begin = function () {
      g.evs = []; g.seq++;
      if (g.exposed >= 0 && g.exposed !== who && a.t !== 'catch' && a.t !== 'gg') g.exposed = -1;   // 다음 사람이 움직이면 잡을 기회가 끝나요
    };
    var turnTo = function (i) { g.turn = i; g.turnAt = now || 0; };
    switch (a.t) {
      case 'play': {
        if (!playing || g.turn !== who || !me) return 'turn';
        if (g.phase !== 'play' && g.phase !== 'drawn') return 'phase';
        var c = a.c, at = me.hand.indexOf(c);
        if (at < 0) return 'nocard';
        if (g.phase === 'drawn' && c !== g.drawn) return 'drawnonly';
        if (!canPlay(g, c)) return 'cannot';
        if (isWild(c) && COLORS.indexOf(a.col) < 0) return 'color';
        begin();
        var prev = g.color;
        me.hand.splice(at, 1);
        g.pile.push(c);
        g.color = isWild(c) ? a.col : colOf(c);
        g.drawn = null;
        ev(g, { t: 'play', p: who, c: c, col: g.color });
        if (me.hand.length === 1) {
          if (me.gg) ev(g, { t: 'gg', p: who, early: 1 });
          else g.exposed = who;
        }
        me.gg = false;
        var v = valOf(c), n2 = active(g) === 2;
        if (!me.hand.length) {   // 마지막 카드
          if (v === 'D') drawN(g, nxt(g, who), 2);
          if (v === 'F') drawN(g, nxt(g, who), 4);
          endRound(g, who);
          return null;
        }
        g.phase = 'play';
        if (v === 'S') { ev(g, { t: 'skip', p: nxt(g, who) }); turnTo(nxt(g, who, 2)); }
        else if (v === 'R') {
          if (n2) { ev(g, { t: 'skip', p: nxt(g, who) }); turnTo(who); }
          else { g.dir = -g.dir; ev(g, { t: 'rev' }); turnTo(nxt(g, who)); }
        }
        else if (v === 'D') { var t2 = nxt(g, who); drawN(g, t2, 2); ev(g, { t: 'skip', p: t2 }); turnTo(nxt(g, who, 2)); }
        else if (v === 'F') {
          var guilty = me.hand.some(function (h) { return colOf(h) === prev; });
          g.pend4 = { by: who, guilty: guilty, prev: prev };
          g.phase = 'challenge';
          turnTo(nxt(g, who));
        }
        else turnTo(nxt(g, who));
        return null;
      }
      case 'draw': {
        if (g.phase !== 'play' || g.turn !== who) return 'turn';
        begin();
        var got = drawN(g, who, 1);
        if (got.length && canPlay(g, got[0])) { g.phase = 'drawn'; g.drawn = got[0]; g.turnAt = now || 0; }
        else { if (!got.length) ev(g, { t: 'empty', p: who }); ev(g, { t: 'pass', p: who }); turnTo(nxt(g, who)); }
        return null;
      }
      case 'keep': {
        if (g.phase !== 'drawn' || g.turn !== who) return 'turn';
        begin();
        g.phase = 'play'; g.drawn = null;
        ev(g, { t: 'pass', p: who });
        turnTo(nxt(g, who));
        return null;
      }
      case 'pick': {
        if (g.phase !== 'pick' || g.turn !== who) return 'turn';
        if (COLORS.indexOf(a.col) < 0) return 'color';
        begin();
        g.color = a.col; g.phase = 'play'; g.turnAt = now || 0;
        ev(g, { t: 'pick', p: who, col: a.col });
        return null;
      }
      case 'accept': {
        if (g.phase !== 'challenge' || g.turn !== who) return 'turn';
        begin();
        drawN(g, who, 4); ev(g, { t: 'skip', p: who });
        g.phase = 'play'; g.pend4 = null;
        turnTo(nxt(g, who));
        return null;
      }
      case 'challenge': {
        if (g.phase !== 'challenge' || g.turn !== who) return 'turn';
        begin();
        var pd = g.pend4, off = P[pd.by];
        ev(g, { t: 'chal', p: who, by: pd.by, ok: pd.guilty ? 1 : 0, hand: off.hand.slice(), prev: pd.prev });
        g.phase = 'play'; g.pend4 = null;
        if (pd.guilty && !off.out) { drawN(g, pd.by, 4); g.turnAt = now || 0; }   // 도전 성공: 낸 사람이 4장, 나는 그대로 내 차례
        else { drawN(g, who, 6); ev(g, { t: 'skip', p: who }); turnTo(nxt(g, who)); }
        return null;
      }
      case 'gg': {
        if (!me || me.out || !playing) return 'no';
        if (g.exposed === who && me.hand.length === 1) {
          begin(); g.exposed = -1; ev(g, { t: 'gg', p: who }); return null;
        }
        if (g.turn === who && me.hand.length === 2 && !me.gg && (g.phase === 'play' || g.phase === 'drawn')) {
          begin(); me.gg = true; ev(g, { t: 'gg', p: who, early: 1 }); return null;
        }
        return 'no';
      }
      case 'catch': {
        if (!playing || g.exposed < 0 || g.exposed === who) return 'no';
        if (who >= 0 && (!me || me.out)) return 'no';
        var x = g.exposed;
        begin();
        g.exposed = -1;
        ev(g, { t: 'catch', p: x, by: who });
        drawN(g, x, 2);
        return null;
      }
      case 'timeout': {
        if (!playing || !g.sec || (now || 0) < g.turnAt + g.sec * 1000) return 'early';
        var t = g.turn;
        if (g.phase === 'play') {
          var r = act(g, t, { t: 'draw' }, now);
          if (!r && g.phase === 'drawn') { g.phase = 'play'; g.drawn = null; ev(g, { t: 'pass', p: t }); turnTo(nxt(g, t)); }
          if (!r) ev(g, { t: 'late', p: t });
          return r;
        }
        if (g.phase === 'drawn') { var r2 = act(g, t, { t: 'keep' }, now); if (!r2) ev(g, { t: 'late', p: t }); return r2; }
        if (g.phase === 'pick') return act(g, t, { t: 'pick', col: COLORS[Math.floor(Math.random() * 4)] }, now);
        if (g.phase === 'challenge') return act(g, t, { t: 'accept' }, now);
        return 'no';
      }
      case 'next': {
        if (g.phase !== 'roundEnd') return 'no';
        startRound(g, now, false);
        return null;
      }
      case 'leave': {
        if (!me || me.out) return 'no';
        g.evs = []; g.seq++;
        me.out = true;
        g.deck = me.hand.concat(g.deck); me.hand = []; me.gg = false;
        ev(g, { t: 'leave', p: who });
        if (g.exposed === who) g.exposed = -1;
        if (!playing) return null;
        if (active(g) < 2) {
          var w = P.findIndex(function (p) { return !p.out; });
          g.phase = 'gameEnd'; g.winner = w; g.res = null; g.exposed = -1; g.pend4 = null; g.drawn = null;
          ev(g, { t: 'alone', p: w });
          return null;
        }
        if (g.pend4 && g.pend4.by === who) g.pend4.guilty = false;
        if (g.dealer === who) g.dealer = nxt(g, who);
        if (g.turn === who) { g.drawn = null; if (g.phase !== 'pick') { g.phase = 'play'; g.pend4 = null; } turnTo(nxt(g, who)); }
        return null;
      }
    }
    return 'unknown';
  }

  root.GG = {
    COLORS: COLORS, CNAME: CNAME, makeDeck: makeDeck, shuffle: shuffle, isWild: isWild, colOf: colOf, valOf: valOf,
    points: points, sortHand: sortHand, top: top, canPlay: canPlay, nxt: nxt, active: active, newGame: newGame, act: act
  };
})(typeof window !== 'undefined' ? window : globalThis);
