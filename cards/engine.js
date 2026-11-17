// 깨비샘의 GGAEBI 카드 게임 규칙 (화면과 상관없는 부분)
// 색 카드 = 색(r 빨강, y 노랑, g 초록, b 파랑) + 값
//   0~9 숫자 (뒤에 ^가 붙으면 스피드 업 카드), S 건너뛰기, R 방향 바꾸기, D +2
//   [리버스 확장] Q 방향 바꾸기 +2, K 방향 바꾸기 건너뛰기
//   [스왑 확장]   X 한 장 바꾸기, H 손패 교체
//   [스택 확장]   A 스택 +1, B 스택 +2
// 와일드 카드 (한 글자): W 색 바꾸기, F 색 바꾸기 +4, U 모두 섞기
//   [리버스] P 파워 방향 바꾸기, N 나 말고 너   [스왑] E 강제 교환, T 손패 넘기기
//   [스택]   Z 스택 +3, M 스택 +?              [스피드] V 더블 스피드 업
(function (root) {
  'use strict';
  var COLORS = ['r', 'y', 'g', 'b'];
  var CNAME = { r: '빨강', y: '노랑', g: '초록', b: '파랑' };
  var VORDER = '0123456789SRDQKXHAB';
  var WORDER = 'WFUPNETZMV';
  var EXTS = ['rev', 'swp', 'spd', 'stk'];
  var DRAWAMT = { D: 2, Q: 2, A: 1, B: 2, F: 4, Z: 3 };
  var SPEEDNUM = { y: [1, 2, 3], r: [3, 4, 5], b: [5, 6, 7], g: [6, 7, 8] };

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function makeDeck(ext) {   // 기본 109장 + 확장팩마다 16장
    ext = ext || {};
    var d = [], i;
    COLORS.forEach(function (c) {
      d.push(c + '0');
      for (var v = 1; v <= 9; v++) d.push(c + v, c + v);
      'SRD'.split('').forEach(function (s) { d.push(c + s, c + s); });
      if (ext.rev) d.push(c + 'Q', c + 'K');
      if (ext.swp) d.push(c + 'X', c + 'H');
      if (ext.stk) d.push(c + 'A', c + 'B');
      if (ext.spd) SPEEDNUM[c].forEach(function (n) { d.push(c + n + '^'); });
    });
    for (i = 0; i < 4; i++) {
      d.push('W', 'F');
      if (ext.rev) d.push('P', 'N');
      if (ext.swp) d.push('E', 'T');
      if (ext.stk) d.push('Z', 'M');
      if (ext.spd) d.push('V');
    }
    d.push('U');
    return shuffle(d);
  }
  var isWild = function (c) { return c.length === 1; };
  var colOf = function (c) { return isWild(c) ? null : c[0]; };
  var valOf = function (c) { return isWild(c) ? c : c.slice(1).replace('^', ''); };
  var isNum = function (c) { return !isWild(c) && /^\d$/.test(valOf(c)); };
  var speedUp = function (c) { return c === 'V' ? 2 : c[c.length - 1] === '^' ? 1 : 0; };
  var isDraw = function (c) { return valOf(c) in DRAWAMT || c === 'M'; };
  function points(c) { if (isWild(c)) return 50; return isNum(c) ? +valOf(c) : 20; }
  function sortKey(c) { return isWild(c) ? 400 + WORDER.indexOf(c) : COLORS.indexOf(c[0]) * 100 + VORDER.indexOf(valOf(c)) * 2 + (speedUp(c) ? 1 : 0); }
  function sortHand(h) { h.sort(function (a, b) { return sortKey(a) - sortKey(b); }); }
  function top(g) { return g.pile[g.pile.length - 1]; }
  var REVS = 'RQKPN';
  function canPlay(g, c) {   // 보통 차례에 낼 수 있나요?
    if (isWild(c)) return true;
    var t = top(g), v = valOf(c), tv = valOf(t);
    if (colOf(c) === g.color) return true;
    if (!isWild(t) && v === tv) return true;
    if (v === 'Q' && (REVS.indexOf(tv) >= 0 || tv === 'D')) return true;
    if (v === 'K' && (REVS.indexOf(tv) >= 0 || tv === 'S')) return true;
    return false;
  }
  function penMode(g) { return !!(g.ext && (g.ext.stk || g.ext.rev)); }
  function canRespond(g, c) {   // 벌칙을 받아야 할 때 쌓거나 넘길 수 있나요?
    if (!penMode(g)) return false;
    var v = valOf(c);
    if (v === 'A' || v === 'B') { var t = top(g); return colOf(c) === g.color || (!isWild(t) && valOf(t) === v); }
    return c === 'Z' || c === 'M' || c === 'N';
  }
  // 지금 이 사람이 이 카드를 낼 수 있나요? (화면과 AI가 같이 써요)
  function playable(g, who, c) {
    if (g.turn !== who) return false;
    if (g.phase === 'play') return canPlay(g, c);
    if (g.phase === 'drawn') return c === g.drawn;
    if (g.phase === 'pen' || g.phase === 'challenge') return canRespond(g, c);
    if (g.phase === 'give') return true;
    return false;
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
  function refill(g) {   // 더미가 비면 버린 카드를 섞어요
    if (g.deck.length) return true;
    if (g.pile.length <= 1) return false;
    var t = g.pile.pop();
    g.deck = shuffle(g.pile);
    g.pile = [t];
    ev(g, { t: 'shuffle' });
    return true;
  }
  function drawN(g, p, k) {
    var got = [];
    for (var i = 0; i < k; i++) { if (!refill(g)) break; got.push(g.deck.pop()); }
    var P = g.players[p];
    P.hand = P.hand.concat(got); sortHand(P.hand);
    if (got.length) { P.gg = false; ev(g, { t: 'draw', p: p, k: got.length }); }
    return got;
  }
  function flipNum(g) {   // 스택 +?: 숫자 카드가 나올 때까지 뒤집어요
    var cs = [], n = 0;
    while (refill(g)) {
      var c = g.deck.pop(); cs.push(c);
      if (isNum(c)) { n = +valOf(c); break; }
      if (cs.length > 60) break;
    }
    g.pile = cs.concat(g.pile);   // 뒤집은 카드는 버린 카드 맨 밑으로
    ev(g, { t: 'flipn', cs: cs, n: n });
    return n;
  }
  function oneCheck(g, list) {   // 손패가 바뀌어 1장이 된 사람은 GGAEBI!를 외쳐야 해요
    g.exposed = -1;
    list.forEach(function (i) { var p = g.players[i]; p.gg = false; if (g.exposed < 0 && !p.out && p.hand.length === 1) g.exposed = i; });
  }

  // 새 게임: players = [{id, name, ai}], opts = {target, sec, ext:{rev,swp,spd,stk}}
  function newGame(players, opts, now) {
    var ext = {};
    EXTS.forEach(function (k) { ext[k] = !!(opts.ext && opts.ext[k]); });
    var g = {
      players: players.map(function (p) { return { id: p.id, name: p.name, ai: p.ai || 0, hand: [], score: 0, gg: false, out: false }; }),
      deck: [], pile: [], color: 'r', dir: 1, turn: 0, round: 0, phase: 'play',
      dealer: Math.floor(Math.random() * players.length),
      drawn: null, exposed: -1, pend4: null, pen: null, tg: null, res: null, winner: -1,
      speed: 1, left: 1, spAdd: 0, tplayed: 0, ext: ext,
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
    var deck = makeDeck(g.ext);
    g.players.forEach(function (p) { p.hand = []; p.gg = false; });
    for (var k = 0; k < 7; k++) g.players.forEach(function (p) { if (!p.out) p.hand.push(deck.pop()); });
    g.players.forEach(function (p) { sortHand(p.hand); });
    var t;
    for (;;) {   // 첫 카드가 특수 카드면 더미에 되돌리고 숫자 카드가 나올 때까지 펼쳐요
      t = deck.pop();
      if (!isNum(t)) { deck.splice(Math.floor(Math.random() * deck.length), 0, t); continue; }
      break;
    }
    g.deck = deck; g.pile = [t]; g.color = colOf(t);
    g.exposed = -1; g.pend4 = null; g.pen = null; g.tg = null; g.drawn = null; g.res = null; g.winner = -1;
    g.speed = 1; g.spAdd = 0;
    ev(g, { t: 'deal' }); ev(g, { t: 'flip', c: t });
    g.phase = 'play';
    startTurn(g, nxtFrom(g, g.dealer), now);
  }
  function nxtFrom(g, i) { var d = g.dir; g.dir = 1; var r = nxt(g, i); g.dir = d; return r; }
  function startTurn(g, i, now) { g.players.forEach(function (p) { p.gg = false; }); g.turn = i; g.turnAt = now || 0; g.left = g.ext && g.ext.spd ? g.speed : 1; g.tplayed = 0; }
  function endTurn(g) {   // 차례가 끝날 때 스피드 업이 쌓였으면 다음 사람부터 빨라져요
    if (g.spAdd) { g.speed += g.spAdd; g.spAdd = 0; ev(g, { t: 'speed', n: g.speed }); }
  }

  function endRound(g, w) {
    var pts = 0;
    g.players.forEach(function (p, i) { if (i !== w) p.hand.forEach(function (c) { pts += points(c); }); });
    g.players[w].score += pts;
    g.res = { w: w, pts: pts, hands: {} };
    g.players.forEach(function (p, i) { g.res.hands[i] = p.hand.slice(); });   // Firebase는 배열 안의 배열을 못 담아서 칸 이름으로
    ev(g, { t: 'win', p: w, pts: pts });
    g.exposed = -1; g.pend4 = null; g.pen = null; g.tg = null; g.drawn = null;
    if (!g.target || g.players[w].score >= g.target) { g.phase = 'gameEnd'; g.winner = w; }
    else g.phase = 'roundEnd';
  }

  // 벌칙 카드: 받을 사람이 쌓거나 넘길 카드가 있으면 고를 기회를 주고, 없으면 바로 가져가요
  function penalize(g, by, t, n, now) {
    if (penMode(g) && g.players[t].hand.some(function (c) { return canRespond(g, c); })) {
      g.pen = { n: n, by: by }; g.phase = 'pen';
      startTurn(g, t, now);
      ev(g, { t: 'pen', p: t, n: n });
    } else {
      g.pen = null; g.phase = 'play';
      drawN(g, t, n); ev(g, { t: 'skip', p: t });
      startTurn(g, nxt(g, t), now);
    }
  }

  // 행동 하나를 처리해요. 잘못된 행동이면 이유(글자)를 돌려주고 아무것도 바꾸지 않아요.
  // who: 행동한 사람 번호 (-2: 한 화면 모드에서 "누군가", -3: 시간 초과 처리)
  function act(g, who, a, now) {
    var P = g.players, me = P[who];
    var playing = PLAYING.indexOf(g.phase) >= 0;
    var begin = function () {
      g.evs = []; g.seq++;
      if (g.exposed >= 0 && g.exposed !== who && a.t !== 'catch' && a.t !== 'gg') g.exposed = -1;   // 다음 사람이 움직이면 잡을 기회가 끝나요
    };
    var finish = function () { g.phase = 'play'; g.tg = null; endTurn(g); startTurn(g, nxt(g, who), now); };
    switch (a.t) {
      case 'play': {
        if (!playing || g.turn !== who || !me) return 'turn';
        var resp = g.phase === 'pen' || g.phase === 'challenge';
        if (g.phase !== 'play' && g.phase !== 'drawn' && !resp) return 'phase';
        var c = a.c, at = me.hand.indexOf(c);
        if (at < 0) return 'nocard';
        if (!playable(g, who, c)) return g.phase === 'drawn' ? 'drawnonly' : 'cannot';
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
          me.gg = false;
        }
        var v = valOf(c), n2 = active(g) === 2;

        // ---- 벌칙을 쌓거나 넘기기 ----
        if (resp) {
          var pen = g.pen || { n: 4, by: g.pend4 ? g.pend4.by : who };
          g.pend4 = null;
          var tgt;
          if (c === 'N') {   // 나 말고 너: 방향이 바뀌고, 벌칙 카드를 낸 사람이 대신 받아요
            g.dir = -g.dir; ev(g, { t: 'rev' });
            tgt = pen.by;
          } else {
            pen.n += c === 'M' ? flipNum(g) : DRAWAMT[v];
            tgt = nxt(g, who);
          }
          if (!me.hand.length) { drawN(g, tgt, pen.n); endRound(g, who); return null; }
          penalize(g, who, tgt, pen.n, now);
          return null;
        }

        // ---- 보통으로 내기 ----
        g.spAdd += speedUp(c);
        g.tplayed++; g.left--;
        if (!me.hand.length) {   // 마지막 카드
          if (v === 'Q' && !n2) g.dir = -g.dir;
          var t1 = nxt(g, who);
          if (c === 'M') drawN(g, t1, flipNum(g));
          else if (DRAWAMT[v]) drawN(g, t1, DRAWAMT[v]);
          endRound(g, who);
          return null;
        }
        g.phase = 'play';
        if (g.left > 0) { g.turnAt = now || 0; ev(g, { t: 'more', p: who, k: g.left }); return null; }   // 스피드: 아직 더 내야 해요
        endTurn(g);
        if (v === 'S') { ev(g, { t: 'skip', p: nxt(g, who) }); startTurn(g, nxt(g, who, 2), now); }
        else if (v === 'R') {
          if (n2) { ev(g, { t: 'skip', p: nxt(g, who) }); startTurn(g, who, now); }
          else { g.dir = -g.dir; ev(g, { t: 'rev' }); startTurn(g, nxt(g, who), now); }
        }
        else if (v === 'K') { g.dir = -g.dir; ev(g, { t: 'rev' }); ev(g, { t: 'skip', p: nxt(g, who) }); startTurn(g, nxt(g, who, 2), now); }
        else if (v === 'Q') { g.dir = -g.dir; ev(g, { t: 'rev' }); penalize(g, who, nxt(g, who), 2, now); }
        else if (v === 'D' || v === 'A' || v === 'B' || c === 'Z') penalize(g, who, nxt(g, who), DRAWAMT[v], now);
        else if (c === 'M') penalize(g, who, nxt(g, who), flipNum(g), now);
        else if (c === 'F') {
          var guilty = me.hand.some(function (h) { return colOf(h) === prev || (isWild(h) && h !== 'F'); });
          g.pend4 = { by: who, guilty: guilty, prev: prev };
          g.pen = { n: 4, by: who };
          g.phase = 'challenge';
          startTurn(g, nxt(g, who), now);
        }
        else if (c === 'P') { g.dir = -g.dir; ev(g, { t: 'rev' }); ev(g, { t: 'again', p: who }); startTurn(g, who, now); }
        else if (c === 'N') { g.dir = -g.dir; ev(g, { t: 'rev' }); startTurn(g, nxt(g, who), now); }
        else if (c === 'U') {   // 모두 섞기: 모두의 카드를 모아 섞고 다음 사람부터 한 장씩 나눠요
          var all = [], ids = [];
          P.forEach(function (p, i) { if (!p.out) { all = all.concat(p.hand); p.hand = []; ids.push(i); } });
          shuffle(all);
          var k = nxt(g, who);
          while (all.length) { P[k].hand.push(all.pop()); k = nxt(g, k); }
          P.forEach(function (p) { sortHand(p.hand); });
          ev(g, { t: 'shufhands', p: who });
          oneCheck(g, ids);
          startTurn(g, nxt(g, who), now);
        }
        else if (c === 'T') {   // 손패 넘기기: 모두 다음 사람에게 손패를 통째로 넘겨요
          var ids2 = [], hands = {};
          P.forEach(function (p, i) { if (!p.out) { ids2.push(i); hands[i] = p.hand; } });
          ids2.forEach(function (i) { P[nxt(g, i)].hand = hands[i]; });
          P.forEach(function (p) { sortHand(p.hand); });
          ev(g, { t: 'passhands', p: who, dir: g.dir });
          oneCheck(g, ids2);
          startTurn(g, nxt(g, who), now);
        }
        else if (v === 'H') {   // 손패 교체: 내 카드를 모두 버린 카드 맨 밑에 넣고 그만큼 새로 가져와요
          var n = me.hand.length;
          g.pile = me.hand.concat(g.pile); me.hand = [];
          ev(g, { t: 'refresh', p: who, k: n });
          drawN(g, who, n);
          oneCheck(g, [who]);
          startTurn(g, nxt(g, who), now);
        }
        else if (v === 'X' || c === 'E') {   // 누구와 바꿀지 골라요
          g.tg = { k: v === 'X' ? 'X' : 'E' };
          g.phase = 'target'; g.turnAt = now || 0;
        }
        else startTurn(g, nxt(g, who), now);
        return null;
      }
      case 'target': {
        if (g.phase !== 'target' || g.turn !== who) return 'turn';
        var okp = function (i) { return i >= 0 && i < P.length && !P[i].out; };
        if (g.tg.k === 'X') {
          var j = a.p;
          if (!okp(j) || j === who || !P[j].hand.length) return 'target';
          begin();
          var took = P[j].hand.splice(Math.floor(Math.random() * P[j].hand.length), 1)[0];
          me.hand.push(took); sortHand(me.hand);
          ev(g, { t: 'take', p: who, from: j });
          g.tg = { k: 'give', to: j, got: took };
          g.phase = 'give'; g.turnAt = now || 0;
          return null;
        }
        var x = a.p, y = a.q;
        if (!okp(x) || !okp(y) || x === y) return 'target';
        begin();
        var hx = P[x].hand; P[x].hand = P[y].hand; P[y].hand = hx;
        ev(g, { t: 'xchg', p: who, a: x, b: y });
        oneCheck(g, [x, y]);
        finish();
        return null;
      }
      case 'give': {
        if (g.phase !== 'give' || g.turn !== who) return 'turn';
        var gi = me.hand.indexOf(a.c);
        if (gi < 0) return 'nocard';
        begin();
        var to = g.tg.to;
        me.hand.splice(gi, 1);
        P[to].hand.push(a.c); sortHand(P[to].hand);
        ev(g, { t: 'give', p: who, to: to });
        oneCheck(g, [who, to]);
        finish();
        return null;
      }
      case 'draw': {
        if (g.phase !== 'play' || g.turn !== who) return 'turn';
        begin();
        if (g.ext.spd && (g.speed > 1 || g.tplayed > 0)) {   // 스피드: 다 못 내면 스피드만큼 가져가고 1로 돌아가요
          var sp = g.speed;
          drawN(g, who, sp);
          g.speed = 1; g.spAdd = 0;
          ev(g, { t: 'speedreset', p: who, k: sp });
          startTurn(g, nxt(g, who), now);
          return null;
        }
        var got = drawN(g, who, 1);
        if (got.length && canPlay(g, got[0])) { g.phase = 'drawn'; g.drawn = got[0]; g.turnAt = now || 0; }
        else { if (!got.length) ev(g, { t: 'empty', p: who }); ev(g, { t: 'pass', p: who }); endTurn(g); startTurn(g, nxt(g, who), now); }
        return null;
      }
      case 'keep': {
        if (g.phase !== 'drawn' || g.turn !== who) return 'turn';
        begin();
        g.phase = 'play'; g.drawn = null;
        ev(g, { t: 'pass', p: who });
        endTurn(g);
        startTurn(g, nxt(g, who), now);
        return null;
      }
      case 'accept': {
        if ((g.phase !== 'challenge' && g.phase !== 'pen') || g.turn !== who) return 'turn';
        begin();
        var pn = g.pen ? g.pen.n : 4;
        drawN(g, who, pn); ev(g, { t: 'skip', p: who });
        g.phase = 'play'; g.pend4 = null; g.pen = null;
        startTurn(g, nxt(g, who), now);
        return null;
      }
      case 'challenge': {
        if (g.phase !== 'challenge' || g.turn !== who) return 'turn';
        begin();
        var pd = g.pend4, off = P[pd.by];
        ev(g, { t: 'chal', p: who, by: pd.by, ok: pd.guilty ? 1 : 0, hand: off.hand.slice(), prev: pd.prev });
        g.phase = 'play'; g.pend4 = null; g.pen = null;
        if (pd.guilty && !off.out) { drawN(g, pd.by, 4); startTurn(g, who, now); }   // 도전 성공: 낸 사람이 4장, 나는 그대로 내 차례
        else { drawN(g, who, 6); ev(g, { t: 'skip', p: who }); startTurn(g, nxt(g, who), now); }
        return null;
      }
      case 'gg': {
        if (!me || me.out || !playing) return 'no';
        if (g.exposed === who && me.hand.length === 1) {
          begin(); g.exposed = -1; ev(g, { t: 'gg', p: who }); return null;
        }
        var L = me.hand.length;
        if (g.turn === who && L >= 2 && L <= (g.left || 1) + 1 && !me.gg && (g.phase === 'play' || g.phase === 'drawn')) {
          begin(); me.gg = true; ev(g, { t: 'gg', p: who, early: 1 }); return null;
        }
        return 'no';
      }
      case 'catch': {
        if (!playing || g.exposed < 0 || g.exposed === who) return 'no';
        if (who >= 0 && (!me || me.out)) return 'no';
        var xx = g.exposed;
        begin();
        g.exposed = -1;
        ev(g, { t: 'catch', p: xx, by: who });
        drawN(g, xx, 2);
        return null;
      }
      case 'timeout': {
        if (!playing || !g.sec || (now || 0) < g.turnAt + g.sec * 1000) return 'early';
        var t = g.turn, T = P[t], r;
        if (g.phase === 'play') {
          r = act(g, t, { t: 'draw' }, now);
          if (!r && g.phase === 'drawn') { g.phase = 'play'; g.drawn = null; ev(g, { t: 'pass', p: t }); endTurn(g); startTurn(g, nxt(g, t), now); }
        }
        else if (g.phase === 'drawn') r = act(g, t, { t: 'keep' }, now);
        else if (g.phase === 'pick') r = act(g, t, { t: 'pick', col: COLORS[Math.floor(Math.random() * 4)] }, now);
        else if (g.phase === 'challenge' || g.phase === 'pen') r = act(g, t, { t: 'accept' }, now);
        else if (g.phase === 'target') {
          var others = P.map(function (p, i) { return i; }).filter(function (i) { return i !== t && !P[i].out && P[i].hand.length; });
          var o = others[Math.floor(Math.random() * others.length)];
          r = g.tg.k === 'X' ? act(g, t, { t: 'target', p: o }, now) : act(g, t, { t: 'target', p: t, q: o }, now);
        }
        else if (g.phase === 'give') r = act(g, t, { t: 'give', c: T.hand.indexOf(g.tg.got) >= 0 ? g.tg.got : T.hand[0] }, now);
        else return 'no';
        if (!r) ev(g, { t: 'late', p: t });
        return r;
      }
      case 'pick': {   // 예전 게임 상태와 맞추려고 남겨 둬요
        if (g.phase !== 'pick' || g.turn !== who) return 'turn';
        if (COLORS.indexOf(a.col) < 0) return 'color';
        begin();
        g.color = a.col; g.phase = 'play'; g.turnAt = now || 0;
        ev(g, { t: 'pick', p: who, col: a.col });
        return null;
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
          g.phase = 'gameEnd'; g.winner = w; g.res = null; g.exposed = -1; g.pend4 = null; g.pen = null; g.tg = null; g.drawn = null;
          ev(g, { t: 'alone', p: w });
          return null;
        }
        if (g.pend4 && g.pend4.by === who) g.pend4.guilty = false;
        if (g.dealer === who) g.dealer = nxt(g, who);
        if (g.turn === who) {
          g.drawn = null; g.tg = null;
          if (g.phase !== 'pick') { g.phase = 'play'; g.pend4 = null; g.pen = null; }
          startTurn(g, nxt(g, who), now);
        } else if (g.phase === 'give' && g.tg && g.tg.to === who) {
          g.phase = 'play'; g.tg = null; startTurn(g, nxt(g, g.turn), now);
        }
        return null;
      }
    }
    return 'unknown';
  }
  var PLAYING = ['play', 'drawn', 'pick', 'challenge', 'pen', 'target', 'give'];

  root.GG = {
    COLORS: COLORS, CNAME: CNAME, EXTS: EXTS, PLAYING: PLAYING, makeDeck: makeDeck, shuffle: shuffle,
    isWild: isWild, colOf: colOf, valOf: valOf, isNum: isNum, speedUp: speedUp, isDraw: isDraw,
    points: points, sortHand: sortHand, top: top, canPlay: canPlay, canRespond: canRespond, playable: playable,
    nxt: nxt, active: active, newGame: newGame, act: act
  };
})(typeof window !== 'undefined' ? window : globalThis);
