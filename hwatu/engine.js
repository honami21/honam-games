// 깨비의 꽃들의 전쟁: 고스톱 규칙 (2명 맞고, 3명 고스톱)
// 카드 번호 0~47: 달 = floor(id/4)+1, 그 달의 몇 번째 = id%4+1 (그림 m01-1.png …)
(function (root) {
'use strict';

const MON = id => (id >> 2) + 1;
const IDX = id => (id & 3) + 1;
const C = (m, k) => (m - 1) * 4 + (k - 1);
const GWANG = [C(1, 1), C(3, 1), C(8, 1), C(11, 1), C(12, 1)];
const BIGWANG = C(12, 1);
const ANIMAL = [C(2, 1), C(4, 1), C(5, 1), C(6, 1), C(7, 1), C(8, 2), C(9, 1), C(10, 1), C(12, 2)];
const GODORI = [C(2, 1), C(4, 1), C(8, 2)];
const GUKJIN = C(9, 1);              // 9월 술잔: 열끗 또는 쌍피 (점수가 더 좋은 쪽으로 자동)
const RIBBON = [C(1, 2), C(2, 2), C(3, 2), C(4, 2), C(5, 2), C(6, 2), C(7, 2), C(9, 2), C(10, 2), C(12, 3)];
const HONG = [C(1, 2), C(2, 2), C(3, 2)];
const CHEONG = [C(6, 2), C(9, 2), C(10, 2)];
const CHO = [C(4, 2), C(5, 2), C(7, 2)];
const SSANG = [C(11, 2), C(12, 4)];

function kind(id) {
  if (GWANG.includes(id)) return 'g';
  if (ANIMAL.includes(id)) return 'a';
  if (RIBBON.includes(id)) return 'r';
  return 'p';
}
const piVal = id => SSANG.includes(id) ? 2 : (kind(id) === 'p' ? 1 : 0);
// 카드 가치 (컴퓨터가 고를 때, 같은 달 두 장 중 고를 때)
function worth(id) {
  const k = kind(id);
  if (k === 'g') return id === BIGWANG ? 8 : 10;
  if (GODORI.includes(id)) return 7;
  if (id === GUKJIN) return 6;
  if (k === 'a') return 5;
  if (k === 'r') return HONG.includes(id) || CHEONG.includes(id) || CHO.includes(id) ? 5 : 4;
  return SSANG.includes(id) ? 4 : 1;
}
const same = (a, b) => kind(a) === kind(b) && piVal(a) === piVal(b) && worth(a) === worth(b);

// ---------- 점수 ----------
function scoreOf(caps, opt) {
  const best = { total: -1 };
  const tries = caps.includes(GUKJIN) ? [false, true] : [false];
  for (const kjPi of tries) {
    const s = { g: 0, a: 0, r: 0, p: 0, gN: 0, aN: 0, rN: 0, pN: 0, godori: false, hong: false, cheong: false, cho: false, kjPi };
    for (const id of caps) {
      const k = id === GUKJIN && kjPi ? 'p' : kind(id);
      if (k === 'g') s.gN++;
      else if (k === 'a') s.aN++;
      else if (k === 'r') s.rN++;
      else s.pN += id === GUKJIN ? 2 : piVal(id);
    }
    if (s.gN >= 5) s.g = 15; else if (s.gN === 4) s.g = 4; else if (s.gN === 3) s.g = caps.includes(BIGWANG) ? 2 : 3;
    if (s.aN >= 5) s.a = s.aN - 4;
    if (GODORI.every(x => caps.includes(x))) { s.godori = true; s.a += 5; }
    if (s.rN >= 5) s.r = s.rN - 4;
    if (HONG.every(x => caps.includes(x))) { s.hong = true; s.r += 3; }
    if (CHEONG.every(x => caps.includes(x))) { s.cheong = true; s.r += 3; }
    if (CHO.every(x => caps.includes(x))) { s.cho = true; s.r += 3; }
    if (s.pN >= 10) s.p = s.pN - 9;
    s.total = s.g + s.a + s.r + s.p;
    if (s.total > best.total) Object.assign(best, s);
  }
  return best;
}

// ---------- 새 판 ----------
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function newGame(players, opt, now) {
  const g = {
    v: 1, seq: 0, gid: Math.random().toString(36).slice(2, 9),
    n: players.length, goal: players.length === 2 ? 7 : 3,
    players: players.map(p => ({ id: p.id, name: p.name, ai: p.ai || 0, av: p.av || '', total: p.total || 0 })),
    round: (opt && opt.round) || 1, starter: (opt && opt.starter) || 0, bonus: (opt && opt.bonus) || 1, stake: (opt && opt.stake) || 10
  };
  deal(g, now);
  return g;
}
function deal(g, now) {
  const handN = g.n === 2 ? 10 : 7, floorN = g.n === 2 ? 8 : 6;
  let deck, floor;
  for (;;) {
    deck = shuffle([...Array(48).keys()]);
    floor = deck.splice(0, floorN);
    const cnt = {}; floor.forEach(id => { cnt[MON(id)] = (cnt[MON(id)] || 0) + 1; });
    if (!Object.values(cnt).some(v => v >= 4)) break;    // 바닥에 같은 달 4장이면 다시 나눠요
  }
  g.players.forEach(p => {
    p.hand = deck.splice(0, handN).sort((a, b) => a - b);
    p.caps = []; p.go = 0; p.goAt = 0; p.shake = 0; p.bomb = 0; p.dummy = 0; p.ppuk = 0; p.score = 0; p.shown = [];
  });
  g.floor = floor; g.deck = deck; g.ppukBy = {};
  g.turn = g.starter % g.n; g.phase = 'play'; g.pend = null; g.last = null; g.res = null; g.turnAt = now || 0;
  g.log = [];
  // 총통: 손에 같은 달 4장
  for (let i = 0; i < g.n; i++) {
    const p = g.players[i], cnt = {};
    p.hand.forEach(id => { cnt[MON(id)] = (cnt[MON(id)] || 0) + 1; });
    const m = Object.keys(cnt).find(k => cnt[k] === 4);
    if (m) { finish(g, i, 'chongtong', +m); return; }
  }
}
function nextRound(g, now) {
  const r = g.res || {};
  const winner = r.winner >= 0 ? r.winner : g.starter;
  const ng = newGame(g.players, { round: g.round + 1, starter: winner, bonus: r.nagari ? Math.min(8, g.bonus * 2) : 1, stake: g.stake || 10 }, now);
  ng.gid = Math.random().toString(36).slice(2, 9);
  return ng;
}

// ---------- 돕기 ----------
const fMatch = (g, m) => g.floor.filter(id => MON(id) === m);
const handCount = (p, m) => p.hand.filter(id => MON(id) === m).length;
function canShake(g, p, id) { const m = MON(id); return handCount(p, m) === 3 && fMatch(g, m).length === 0 && !p.shown.includes(m); }
function canBomb(g, p, m) { return handCount(p, m) === 3 && fMatch(g, m).length === 1; }
function needPick(cards) { return cards.length === 2 && !same(cards[0], cards[1]); }
function bestOf(cards) { return cards.slice().sort((a, b) => worth(b) - worth(a))[0]; }

function steal(g, to, ev) {
  const me = g.players[to];
  g.players.forEach((p, i) => {
    if (i === to) return;
    const singles = p.caps.filter(id => kind(id) === 'p' && !SSANG.includes(id));
    const dbl = p.caps.filter(id => SSANG.includes(id));
    const pick = singles[0] != null ? singles[0] : dbl[0];
    if (pick == null) return;
    p.caps.splice(p.caps.indexOf(pick), 1);
    me.caps.push(pick);
    ev.stole.push({ from: i, id: pick });
  });
}
function take(g, i, ids) {
  ids.forEach(id => { const k = g.floor.indexOf(id); if (k >= 0) g.floor.splice(k, 1); });
  g.players[i].caps.push(...ids);
}

// ---------- 한 차례 진행 ----------
// a = { t:'play', id, shake } | { t:'bomb', m } | { t:'flip' } | { t:'pick', id } | { t:'go' } | { t:'stop' } | { t:'leave' } | { t:'next' }
function act(g, who, a, now) {
  if (!a || !g) return 'bad';
  if (a.t === 'leave') {
    if (g.phase === 'end') return 'end';
    finish(g, -1, 'left', who); g.seq++; return null;
  }
  if (g.phase === 'end') return 'end';
  if (who !== g.turn) return 'turn';
  const p = g.players[who];
  if (g.phase === 'play') {
    if (a.t === 'play') {
      const id = a.id;
      if (!p.hand.includes(id)) return 'nocard';
      const m = MON(id);
      const shake = !!a.shake && canShake(g, p, id);
      p.hand.splice(p.hand.indexOf(id), 1);
      const ev = newEv(who, id);
      if (shake) { p.shake++; p.shown.push(m); ev.shake = m; ev.showIds = g.players[who].hand.filter(x => MON(x) === m).concat(id); }
      const fm = fMatch(g, m);
      g.pend = { ev, hc: id, hm: fm.slice(), hPick: null, f: null, fm: null, fPick: null };
      if (needPick(fm)) { g.phase = 'pick'; g.pend.need = 'h'; g.seq++; return null; }
      if (fm.length === 2) g.pend.hPick = fm[0];
      return flip(g, now);
    }
    if (a.t === 'bomb') {
      const m = +a.m;
      if (!canBomb(g, p, m)) return 'nobomb';
      const ids = p.hand.filter(id => MON(id) === m);
      ids.forEach(id => p.hand.splice(p.hand.indexOf(id), 1));
      const ev = newEv(who, ids[0]); ev.bomb = m; ev.bombIds = ids;
      p.bomb++; p.dummy += 2; p.shown.push(m);
      const fl = fMatch(g, m);
      take(g, who, ids.concat(fl)); ev.caps.push(...ids, ...fl);
      g.pend = { ev, hc: null, hm: [], f: null, fm: null, fPick: null, bombDone: true };
      steal(g, who, ev);
      return flip(g, now);
    }
    if (a.t === 'flip') {
      if (p.dummy <= 0) return 'nodummy';
      p.dummy--;
      const ev = newEv(who, null); ev.dummy = true;
      g.pend = { ev, hc: null, hm: [], f: null, fm: null, fPick: null };
      return flip(g, now);
    }
    return 'bad';
  }
  if (g.phase === 'pick') {
    if (a.t !== 'pick') return 'bad';
    const pd = g.pend;
    if (pd.need === 'h') { if (!pd.hm.includes(a.id)) return 'bad'; pd.hPick = a.id; pd.need = null; g.phase = 'play'; return flip(g, now); }
    if (pd.need === 'f') { if (!pd.fm.includes(a.id)) return 'bad'; pd.fPick = a.id; pd.need = null; g.phase = 'play'; return resolve(g, now); }
    return 'bad';
  }
  if (g.phase === 'gostop') {
    if (a.t === 'go') {
      p.go++; p.goAt = p.score;
      g.last.go = p.go;
      g.log.push({ who, t: 'go', n: p.go });
      advance(g, now); g.seq++; return null;
    }
    if (a.t === 'stop') { finish(g, who, 'stop'); g.seq++; return null; }
    return 'bad';
  }
  return 'bad';
}
function newEv(who, hc) { return { who, hc, f: null, caps: [], stole: [], tags: [], shake: 0, bomb: 0 }; }

function flip(g, now) {
  const pd = g.pend;
  if (pd.f == null) {
    if (!g.deck.length) return resolve(g, now);
    pd.f = g.deck.shift();
    pd.ev.f = pd.f;
  }
  const fmon = MON(pd.f);
  const hm = pd.hc != null ? MON(pd.hc) : -1;
  if (fmon !== hm) {
    let fm = fMatch(g, fmon);
    pd.fm = fm.slice();
    if (needPick(fm)) { g.phase = 'pick'; pd.need = 'f'; g.seq++; return null; }
    if (fm.length === 2) pd.fPick = fm[0];
  }
  return resolve(g, now);
}

function resolve(g, now) {
  const pd = g.pend, ev = pd.ev, who = g.turn, p = g.players[who];
  let doSteal = 0;
  // 뻑 먹기: 내가 싼 뻑을 내가 먹으면 자뻑 (피 두 장씩)
  const eatPpuk = m => { const by = g.ppukBy && g.ppukBy[m]; if (g.ppukBy) delete g.ppukBy[m]; if (by === who) { ev.tags.push('jappuk'); doSteal += 2; } else { ev.tags.push('ppukeat'); doSteal++; } };
  const hc = pd.hc, f = pd.f;
  const hm = hc != null ? MON(hc) : -1;
  const hk = pd.hm.length;
  if (hc != null && f != null && MON(f) === hm) {
    if (hk === 0) { take(g, who, []); p.caps.push(hc, f); ev.caps.push(hc, f); ev.tags.push('jjok'); doSteal++; }
    else if (hk === 1) { g.floor.push(hc, f); ev.tags.push('ppuk'); p.ppuk++; ev.ppuk = hm; (g.ppukBy = g.ppukBy || {})[hm] = who; }
    else if (hk === 2) { take(g, who, pd.hm); p.caps.push(hc, f); ev.caps.push(...pd.hm, hc, f); ev.tags.push('ttadak'); doSteal++; }
  } else {
    if (hc != null) {
      if (hk === 0) g.floor.push(hc);
      else if (hk === 1) { take(g, who, pd.hm); p.caps.push(hc); ev.caps.push(pd.hm[0], hc); }
      else if (hk === 2) { take(g, who, [pd.hPick]); p.caps.push(hc); ev.caps.push(pd.hPick, hc); }
      else { take(g, who, pd.hm); p.caps.push(hc); ev.caps.push(...pd.hm, hc); eatPpuk(hm); }
    }
    if (f != null) {
      const fm = pd.fm || [];
      if (fm.length === 0) g.floor.push(f);
      else if (fm.length === 1) { take(g, who, fm); p.caps.push(f); ev.caps.push(fm[0], f); }
      else if (fm.length === 2) { take(g, who, [pd.fPick]); p.caps.push(f); ev.caps.push(pd.fPick, f); }
      else { take(g, who, fm); p.caps.push(f); ev.caps.push(...fm, f); eatPpuk(MON(f)); }
    }
  }
  if (pd.bombDone) ev.tags.unshift('bomb');
  if (!g.floor.length && (ev.caps.length || pd.bombDone) && (g.deck.length || g.players.some(q => q.hand.length))) { ev.tags.push('sweep'); doSteal++; }
  for (let k = 0; k < doSteal; k++) steal(g, who, ev);
  g.pend = null; g.phase = 'play';
  g.last = ev; g.log.push(ev);
  if (g.log.length > 12) g.log.shift();
  // 점수 확인
  p.score = scoreOf(p.caps).total;
  const left = g.players.some(q => q.hand.length || q.dummy) && g.deck.length;
  if (p.score >= g.goal && p.score > p.goAt) {
    const mine = p.hand.length + p.dummy;
    if (!left || !mine) { finish(g, who, 'stop'); g.seq++; return null; }
    g.phase = 'gostop'; g.turnAt = now || 0; g.seq++; return null;
  }
  if (!left && !g.players.some(q => q.hand.length)) { finish(g, -1, 'nagari'); g.seq++; return null; }
  advance(g, now); g.seq++; return null;
}
function advance(g, now) {
  g.phase = 'play';
  for (let k = 1; k <= g.n; k++) {
    const i = (g.turn + k) % g.n, q = g.players[i];
    if (q.hand.length || q.dummy) { g.turn = i; g.turnAt = now || 0; return; }
  }
  finish(g, -1, 'nagari');
}

// ---------- 끝내기, 점수 계산 ----------
function finish(g, winner, why, extra) {
  g.phase = 'end';
  const res = { winner, why, rows: [], nagari: false };
  if (why === 'nagari' || why === 'left') {
    res.nagari = why === 'nagari'; res.left = why === 'left' ? extra : -1;
    g.res = res; return;
  }
  const w = g.players[winner];
  let base, detail = [];
  if (why === 'chongtong') { base = 10; res.chong = extra; detail.push('총통 10점'); }
  else {
    const s = scoreOf(w.caps);
    base = s.total;
    res.ws = s;
    if (w.go) {
      base += w.go; detail.push(`${w.go}고 +${w.go}`);
    }
  }
  let mult = 1;
  if (w.go >= 3) { mult *= Math.pow(2, w.go - 2); detail.push(`${w.go}고 ×${Math.pow(2, w.go - 2)}`); }
  const sh = w.shake + w.bomb;
  if (sh) { mult *= Math.pow(2, sh); detail.push(`흔들기·폭탄 ×${Math.pow(2, sh)}`); }
  if (g.bonus > 1) { mult *= g.bonus; detail.push(`나가리 다음 판 ×${g.bonus}`); }
  res.base = base; res.detail = detail;
  const ws = res.ws;
  let sum = 0;
  const goer = g.players.findIndex((q, i) => i !== winner && q.go > 0);
  g.players.forEach((q, i) => {
    if (i === winner) return;
    let m = mult; const bak = [];
    if (ws) {
      const qs = scoreOf(q.caps);
      if (ws.p > 0 && qs.pN > 0 && qs.pN <= 7) { m *= 2; bak.push('피박'); }
      if (ws.g > 0 && qs.gN === 0) { m *= 2; bak.push('광박'); }
      if (ws.aN >= 7) { m *= 2; bak.push('멍박'); }
      if (g.n === 2 && q.go > 0) { m *= 2; bak.push('고박'); }
    }
    const pay = base * m;
    res.rows.push({ i, pay, bak });
    sum += pay;
  });
  // 3명일 때 고박: 고를 외친 사람이 모두 물어 줘요
  if (g.n === 3 && goer >= 0 && ws) {
    res.rows.forEach(r => { r.payer = goer; });
    res.gobak = goer;
  }
  res.sum = sum;
  // 누적 점수
  w.total += sum;
  res.rows.forEach(r => { g.players[r.payer != null ? r.payer : r.i].total -= r.pay; });
  g.res = res;
}

const api = { MON, IDX, C, kind, piVal, worth, same, scoreOf, newGame, nextRound, act, canShake, canBomb, handCount, fMatch, needPick, bestOf,
  GWANG, ANIMAL, RIBBON, SSANG, GODORI, HONG, CHEONG, CHO, GUKJIN, BIGWANG };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.HT = api;
})(typeof window !== 'undefined' ? window : globalThis);
