// 깨비샘의 보물 공방 - 규칙과 컴퓨터(깨비샘) 두기
// 보물 색: 0 흰 진주, 1 파란 구슬, 2 초록 옥, 3 빨간 산호, 4 검은 흑요석, 5 금덩이(아무 보물 대신)
(function () {
  const C = ['w', 'u', 'g', 'r', 'k', 'x'];
  const NAMES = ['진주', '구슬', '옥', '산호', '흑요석', '금덩이'];
  const GOAL = 15, MAX_TOK = 10, MAX_RES = 3;

  // ---------- 카드 (우리 게임만의 구성) ----------
  // 비용은 "보너스 색에서 몇 칸 떨어진 색" 기준: [자기, +1, +2, +3, +4]
  const T = {
    1: [[0, [0, 1, 1, 1, 1]], [0, [0, 1, 2, 0, 1]], [0, [0, 0, 2, 1, 0]], [0, [0, 2, 0, 0, 2]],
        [0, [0, 0, 0, 3, 0]], [0, [0, 1, 0, 2, 1]], [0, [1, 0, 1, 0, 2]], [1, [0, 0, 4, 0, 0]]],
    2: [[1, [0, 2, 0, 2, 3]], [1, [2, 0, 3, 0, 2]], [2, [0, 4, 0, 2, 1]], [2, [0, 0, 0, 0, 5]],
        [2, [0, 3, 5, 0, 0]], [3, [6, 0, 0, 0, 0]]],
    3: [[3, [0, 5, 3, 3, 3]], [4, [0, 0, 0, 7, 0]], [4, [3, 0, 3, 6, 0]], [5, [3, 0, 0, 7, 0]]]
  };
  const CARDS = [];
  [1, 2, 3].forEach(lv => {
    for (let c = 0; c < 5; c++) T[lv].forEach(([p, off]) => {
      const cost = [0, 0, 0, 0, 0];
      off.forEach((n, k) => { cost[(c + k) % 5] += n; });
      CARDS.push({ id: CARDS.length, lv, c, p, cost });
    });
  });
  // 손님 10명 (모두 3점): 한 칸 건너 두 색 4장씩 / 세 색 3장씩
  const GUESTS = [];
  for (let c = 0; c < 5; c++) { const n = [0, 0, 0, 0, 0]; n[c] = 4; n[(c + 2) % 5] = 4; GUESTS.push({ id: GUESTS.length, need: n }); }
  for (let c = 0; c < 5; c++) { const n = [0, 0, 0, 0, 0]; n[c] = 3; n[(c + 1) % 5] = 3; n[(c + 3) % 5] = 3; GUESTS.push({ id: GUESTS.length, need: n }); }
  const GUEST_NAMES = ['산신령', '선녀', '호랑이', '혹부리 영감', '해님 달님', '토끼', '별주부', '흥부', '까치', '금두꺼비'];

  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const sum = a => a.reduce((s, x) => s + x, 0);
  const clone = o => JSON.parse(JSON.stringify(o));

  function newPlayer() { return { tok: [0, 0, 0, 0, 0, 0], cards: [], res: [], guests: [] }; }
  function deal(nPlayers) {
    const per = nPlayers === 2 ? 4 : nPlayers === 3 ? 5 : 7;
    const s = { bank: [per, per, per, per, per, 5] };
    [1, 2, 3].forEach(lv => {
      const d = shuffle(CARDS.filter(x => x.lv === lv).map(x => x.id));
      s['b' + lv] = d.slice(0, 4); s['d' + lv] = d.slice(4);
    });
    s.guests = shuffle(GUESTS.map(g => g.id)).slice(0, nPlayers + 1);
    s.p = []; for (let i = 0; i < nPlayers; i++) s.p.push(newPlayer());
    return s;
  }
  function bonus(pl) { const b = [0, 0, 0, 0, 0]; pl.cards.forEach(id => b[CARDS[id].c]++); return b; }
  function score(pl) { return pl.cards.reduce((s, id) => s + CARDS[id].p, 0) + pl.guests.length * 3; }
  // 낼 보물 (모자라면 금덩이로) - 못 사면 null
  function payFor(pl, id) {
    const b = bonus(pl), cost = CARDS[id].cost, pay = [0, 0, 0, 0, 0, 0];
    let gold = 0;
    for (let i = 0; i < 5; i++) {
      const need = Math.max(0, cost[i] - b[i]);
      pay[i] = Math.min(need, pl.tok[i]); gold += need - pay[i];
    }
    if (gold > pl.tok[5]) return null;
    pay[5] = gold; return pay;
  }
  function missing(pl, id) { // 금덩이 생각 안 하고 색별로 모자란 수
    const b = bonus(pl), cost = CARDS[id].cost;
    return cost.map((n, i) => Math.max(0, n - b[i] - pl.tok[i]));
  }

  // 보물 가져오기가 맞는지: 서로 다른 색 3개(남은 색이 적으면 그만큼) 또는 같은 색 2개(4개 이상 남았을 때)
  function takeOk(bank, g) {
    const n = sum(g);
    if (g.some((x, i) => x < 0 || x > bank[i])) return '남은 보물보다 많이 골랐어요';
    if (g.some(x => x === 2)) {
      if (n !== 2) return '같은 색 2개를 가져올 때는 그 2개만 가져와요';
      const i = g.indexOf(2);
      if (bank[i] < 4) return `${NAMES[i]}이(가) 4개 이상 남아 있을 때만 같은 색 2개를 가져올 수 있어요`;
      return '';
    }
    if (g.some(x => x > 2)) return '같은 색은 2개까지만 가져와요';
    const avail = bank.slice(0, 5).filter(x => x > 0).length;
    if (n === 0) return '가져올 보물을 골라요';
    if (n > 3) return '서로 다른 색은 3개까지 가져와요';
    if (n < Math.min(3, avail)) return '서로 다른 색 3개를 골라요';
    return '';
  }

  // 한 수 두기: 성공하면 바뀐 상태, 실패하면 { err }
  // move: {t:'take', g:[5], back:[6]} | {t:'res', lv, i(-1 = 더미), back:[6]} | {t:'buy', lv, i} | {t:'buy', r: 손에 든 카드 번호} | {t:'pass'}
  function apply(state, by, mv) {
    const s = clone(state), pl = s.p[by];
    const last = { by, t: mv.t };
    if (mv.t === 'take') {
      const e = takeOk(s.bank, mv.g); if (e) return { err: e };
      for (let i = 0; i < 5; i++) { s.bank[i] -= mv.g[i]; pl.tok[i] += mv.g[i]; }
      last.g = mv.g.slice();
    } else if (mv.t === 'res') {
      if (pl.res.length >= MAX_RES) return { err: '손에는 3장까지만 찜할 수 있어요' };
      let id;
      if (mv.i < 0) { const d = s['d' + mv.lv]; if (!d.length) return { err: '더미가 비었어요' }; id = d.shift(); last.blind = 1; }
      else { id = s['b' + mv.lv][mv.i]; if (id == null || id < 0) return { err: '빈자리예요' }; s['b' + mv.lv][mv.i] = refill(s, mv.lv); }
      pl.res.push(id); last.card = id; last.lv = mv.lv;
      if (s.bank[5] > 0) { s.bank[5]--; pl.tok[5]++; last.gold = 1; }
    } else if (mv.t === 'buy') {
      let id;
      if (mv.r != null) { id = pl.res[mv.r]; if (id == null) return { err: '그 카드가 없어요' }; }
      else { id = s['b' + mv.lv][mv.i]; if (id == null || id < 0) return { err: '빈자리예요' }; }
      const pay = payFor(pl, id); if (!pay) return { err: '보물이 모자라요' };
      for (let i = 0; i < 6; i++) { pl.tok[i] -= pay[i]; s.bank[i] += pay[i]; }
      if (mv.r != null) pl.res.splice(mv.r, 1); else s['b' + mv.lv][mv.i] = refill(s, mv.lv);
      pl.cards.push(id); last.card = id; last.pay = pay; last.fromRes = mv.r != null ? 1 : 0;
    } else if (mv.t === 'pass') {
      if (anyMove(state, by)) return { err: '할 수 있는 일이 있어요' };
    } else return { err: '알 수 없는 수예요' };
    // 10개 넘으면 돌려놓기
    const over = sum(pl.tok) - MAX_TOK;
    if (over > 0) {
      const back = mv.back || [0, 0, 0, 0, 0, 0];
      if (sum(back) !== over || back.some((x, i) => x < 0 || x > pl.tok[i])) return { err: `보물을 ${over}개 돌려놓아야 해요`, over };
      for (let i = 0; i < 6; i++) { pl.tok[i] -= back[i]; s.bank[i] += back[i]; }
      last.back = back.slice();
    }
    // 손님 방문 (차례 끝에 한 명)
    const b = bonus(pl);
    const k = s.guests.findIndex(gid => GUESTS[gid].need.every((n, i) => b[i] >= n));
    if (k >= 0) { const gid = s.guests.splice(k, 1)[0]; pl.guests.push(gid); last.guest = gid; }
    s.last = last;
    return s;
  }
  function refill(s, lv) { const d = s['d' + lv]; return d.length ? d.shift() : -1; }
  function anyMove(s, by) {
    const pl = s.p[by];
    if (s.bank.slice(0, 5).some(x => x > 0)) return true;
    if (pl.res.length < MAX_RES && [1, 2, 3].some(lv => s['d' + lv].length || s['b' + lv].some(x => x >= 0))) return true;
    if (pl.res.some(id => payFor(pl, id))) return true;
    return [1, 2, 3].some(lv => s['b' + lv].some(id => id >= 0 && payFor(pl, id)));
  }
  // 이긴 사람 (자리 번호) - 점수가 같으면 카드를 적게 산 사람, 그래도 같으면 'draw'
  function result(s) {
    let best = [];
    s.p.forEach((pl, i) => {
      if (!best.length) { best = [i]; return; }
      const a = s.p[best[0]], d = score(pl) - score(a) || a.cards.length - pl.cards.length;
      if (d > 0) best = [i]; else if (d === 0) best.push(i);
    });
    return best.length === 1 ? best[0] : 'draw';
  }

  // ---------- 깨비샘 (컴퓨터) ----------
  function boardCards(s) { const r = []; [1, 2, 3].forEach(lv => s['b' + lv].forEach((id, i) => { if (id >= 0) r.push({ id, lv, i }); })); return r; }
  // 돌려놓을 보물: 목표에 덜 필요한 것부터
  function pickBack(tok, over, want) {
    const back = [0, 0, 0, 0, 0, 0], t = tok.slice();
    while (over > 0) {
      let best = -1, bv = 1e9;
      for (let i = 0; i < 5; i++) if (t[i] > 0) { const v = (want[i] || 0) * 10 - t[i]; if (v < bv) { bv = v; best = i; } }
      if (best < 0) best = 5;
      t[best]--; back[best]++; over--;
    }
    return back;
  }
  function allMoves(s, by) {
    const pl = s.p[by], mv = [], av = [0, 1, 2, 3, 4].filter(i => s.bank[i] > 0);
    const k = Math.min(3, av.length);
    const comb = (st, pick) => { if (pick.length === k) { const g = [0, 0, 0, 0, 0]; pick.forEach(i => { g[i] = 1; }); mv.push({ t: 'take', g }); return; } for (let j = st; j < av.length; j++) comb(j + 1, pick.concat(av[j])); };
    if (k) comb(0, []);
    for (let i = 0; i < 5; i++) if (s.bank[i] >= 4) { const g = [0, 0, 0, 0, 0]; g[i] = 2; mv.push({ t: 'take', g }); }
    boardCards(s).forEach(x => { if (payFor(pl, x.id)) mv.push({ t: 'buy', lv: x.lv, i: x.i }); if (pl.res.length < MAX_RES) mv.push({ t: 'res', lv: x.lv, i: x.i }); });
    pl.res.forEach((id, r) => { if (payFor(pl, id)) mv.push({ t: 'buy', r }); });
    if (pl.res.length < MAX_RES) [1, 2, 3].forEach(lv => { if (s['d' + lv].length) mv.push({ t: 'res', lv, i: -1 }); });
    return mv;
  }
  function aiMove(s, by, level) {
    // 쉬움: 가끔 아무 수나 둬요
    if (level === 1 && Math.random() < 0.35) {
      const ms = allMoves(s, by).filter(m => m.t !== 'res' || Math.random() < 0.3);
      if (ms.length) { const want = [0, 0, 0, 0, 0]; return finish(s, by, ms[Math.floor(Math.random() * ms.length)], want); }
    }
    const pl = s.p[by];
    const opps = s.p.filter((_, i) => i !== by);
    const op = opps.reduce((a, x) => score(x) > score(a) ? x : a, opps[0]);
    const b = bonus(pl), myScore = score(pl), opScore = score(op);
    const cands = boardCards(s).map(x => Object.assign(x, { r: null })).concat(pl.res.map((id, r) => ({ id, r, lv: CARDS[id].lv })));
    // 카드 가치: 점수 + 손님에 도움 + 앞으로 자주 쓰일 색
    const guestNeed = [0, 0, 0, 0, 0];
    s.guests.forEach(gid => GUESTS[gid].need.forEach((n, i) => { if (n > b[i]) guestNeed[i] += 1 / (1 + sum(GUESTS[gid].need.map((m, j) => Math.max(0, m - b[j])))); }));
    const colorUse = [0, 0, 0, 0, 0];
    boardCards(s).forEach(x => CARDS[x.id].cost.forEach((n, i) => { colorUse[i] += n; }));
    const value = id => {
      const c = CARDS[id];
      const late = myScore >= 9 || opScore >= 10;
      return c.p * (late ? 4 : 2.6) + (late ? 0.4 : 1.4) + guestNeed[c.c] * 6 + colorUse[c.c] * 0.04;
    };
    const rnd = level === 1 ? 2.5 : level === 2 ? 1.5 : 0.15;
    const noise = () => Math.random() * rnd;
    // 1) 살 수 있는 카드
    const buyable = cands.filter(x => payFor(pl, x.id));
    if (buyable.length) {
      buyable.forEach(x => { const pay = payFor(pl, x.id); x.v = value(x.id) - pay[5] * 0.6 - sum(pay) * 0.05 + (x.r != null ? 0.5 : 0) + noise(); });
      buyable.sort((a, c) => c.v - a.v);
      const top = buyable[0];
      // 쉬움은 가끔 사지 않고 보물을 모아요
      if (!(level === 1 && Math.random() < 0.25 && top.v < 3)) {
        const mv = top.r != null ? { t: 'buy', r: top.r } : { t: 'buy', lv: top.lv, i: top.i };
        // 이기는 수 (어려움): 15점 넘기는 카드 먼저
        return finish(s, by, mv, [0, 0, 0, 0, 0]);
      }
    }
    // 2) 목표 카드 고르기: 가치 ÷ (모자란 보물 수 + 1)
    const targets = cands.map(x => {
      const m = missing(pl, x.id), need = Math.max(0, sum(m) - pl.tok[5]);
      return Object.assign(x, { m, need, v: value(x.id) / (need + 1.2) + noise() });
    }).sort((a, c) => c.v - a.v);
    const want = [0, 0, 0, 0, 0];
    targets.slice(0, 3).forEach((x, k) => x.m.forEach((n, i) => { want[i] += n * (k === 0 ? 3 : 1); }));
    // 어려움: 상대가 다음 차례에 이길 카드를 사면 찜해서 막기
    if (level === 3 && pl.res.length < MAX_RES) {
      const danger = boardCards(s).find(x => opps.some(o => payFor(o, x.id) && score(o) + CARDS[x.id].p >= GOAL));
      if (danger) return finish(s, by, { t: 'res', lv: danger.lv, i: danger.i }, want);
    }
    // 3) 보물 가져오기
    const g = [0, 0, 0, 0, 0];
    const top = targets[0];
    const order = [0, 1, 2, 3, 4].filter(i => s.bank[i] > 0).sort((a, c) => (want[c] + colorUse[c] * 0.02 + noise() * 0.3) - (want[a] + colorUse[a] * 0.02 + noise() * 0.3));
    const two = top && [0, 1, 2, 3, 4].find(i => top.m[i] >= 2 && s.bank[i] >= 4 && top.m.filter(n => n > 0).length === 1);
    if (two != null && two !== undefined) g[two] = 2;
    else order.slice(0, 3).forEach(i => { g[i] = 1; });
    const useful = sum(g.map((n, i) => n * (want[i] > 0 ? 1 : 0)));
    // 쓸모없는 보물만 가져오게 되면 찜하기 (금덩이도 받음)
    if ((useful === 0 || sum(g) === 0) && pl.res.length < MAX_RES && top && top.r == null && s.bank[5] > 0) {
      return finish(s, by, { t: 'res', lv: top.lv, i: top.i }, want);
    }
    if (sum(g) > 0 && !takeOk(s.bank, g)) return finish(s, by, { t: 'take', g }, want);
    if (pl.res.length < MAX_RES) {
      const x = boardCards(s)[0]; if (x) return finish(s, by, { t: 'res', lv: x.lv, i: x.i }, want);
      const lv = [3, 2, 1].find(l => s['d' + l].length); if (lv) return finish(s, by, { t: 'res', lv, i: -1 }, want);
    }
    return { t: 'pass' };
  }
  function finish(s, by, mv, want) {
    const r = apply(s, by, mv);
    if (r.err && r.over) { const pl = clone(s.p[by]); if (mv.t === 'take') mv.g.forEach((n, i) => { pl.tok[i] += n; }); if (mv.t === 'res' && s.bank[5] > 0) pl.tok[5]++; mv.back = pickBack(pl.tok, r.over, want); }
    return mv;
  }

  window.Gem = { C, NAMES, GOAL, MAX_TOK, MAX_RES, CARDS, GUESTS, GUEST_NAMES, deal, bonus, score, payFor, takeOk, apply, anyMove, result, aiMove, sum };
})();
