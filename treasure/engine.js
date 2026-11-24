// 깨비샘의 보물 공방 - 규칙과 컴퓨터(깨비샘) 두기
// 보물 색: 0 흰 진주, 1 파란 구슬, 2 초록 옥, 3 빨간 산호, 4 검은 흑요석, 5 금덩이(아무 보물 대신)
// 확장 (한 판에 하나): city 도깨비 장터 · post 고갯길 주막 · bat 도깨비 방망이 · sea 용궁 보물
(function () {
  const C = ['w', 'u', 'g', 'r', 'k', 'x'];
  const NAMES = ['진주', '구슬', '옥', '산호', '흑요석', '금덩이'];
  const GOAL = 15, MAX_TOK = 10, MAX_RES = 3, MAX_BAT = 3;
  const EX = { '': '기본', city: '도깨비 장터', post: '고갯길 주막', bat: '도깨비 방망이', sea: '용궁 보물' };

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
  const mkCost = (c, off) => { const cost = [0, 0, 0, 0, 0]; off.forEach((n, k) => { cost[(c + k) % 5] += n; }); return cost; };
  [1, 2, 3].forEach(lv => {
    for (let c = 0; c < 5; c++) T[lv].forEach(([p, off]) => CARDS.push({ id: CARDS.length, lv, c, p, cost: mkCost(c, off), k: '' }));
  });
  const BASE_N = CARDS.length; // 90
  // 용궁 보물 카드 30장 (k: 종류)
  //  gold2 금덩이 2개처럼 한 번 쓰기 · joker 내 카드에 겹쳐 그 색 보너스 · guest 손님 맡아 두기
  //  dbl 보너스 2개 · joker1 겹치기 + 1단계 공짜 · free2 2단계 공짜 · disc 카드 2장 버리고 사기
  const sea = (lv, c, p, k, cost, extra) => CARDS.push(Object.assign({ id: CARDS.length, lv, c, p, cost, k, sea: 1 }, extra || {}));
  for (let c = 0; c < 5; c++) sea(1, -1, 0, 'gold2', mkCost(c, [3, 0, 0, 0, 0]));
  for (let c = 0; c < 5; c++) sea(1, -1, 0, 'joker', mkCost(c, [3, 0, 2, 0, 0]));
  [1, 3, 4].forEach(c => sea(2, c, 1, 'guest', mkCost(c, [0, 2, 2, 2, 2])));
  for (let c = 0; c < 5; c++) sea(2, c, 0, 'dbl', mkCost(c, [0, 4, 0, 3, 0]));
  sea(2, -1, 0, 'joker1', [1, 4, 0, 3, 0]); sea(2, -1, 0, 'joker1', [0, 1, 3, 4, 0]);
  for (let c = 0; c < 5; c++) sea(3, c, 0, 'free2', mkCost(c, [1, 0, 6, 0, 3]));
  for (let c = 0; c < 5; c++) sea(3, c, 3, 'disc', [0, 0, 0, 0, 0], { dc: (c + 2) % 5 });

  // 손님 10명 (모두 3점): 한 칸 건너 두 색 4장씩 / 세 색 3장씩
  const GUESTS = [];
  for (let c = 0; c < 5; c++) { const n = [0, 0, 0, 0, 0]; n[c] = 4; n[(c + 2) % 5] = 4; GUESTS.push({ id: GUESTS.length, need: n }); }
  for (let c = 0; c < 5; c++) { const n = [0, 0, 0, 0, 0]; n[c] = 3; n[(c + 1) % 5] = 3; n[(c + 3) % 5] = 3; GUESTS.push({ id: GUESTS.length, need: n }); }
  const GUEST_NAMES = ['산신령', '선녀', '호랑이', '혹부리 영감', '해님 달님', '토끼', '별주부', '흥부', '까치', '금두꺼비'];

  // 도깨비 장터 7곳 (앞뒷면 = 14가지): p 점 이상 + need 보너스 + any(아무 한 색 N개, need에 없는 색)
  const CITY = [];
  const city = (t, p, need, any) => CITY.push({ id: CITY.length, t, p, need: need || [0, 0, 0, 0, 0], any: any || 0 });
  city(0, 17); city(0, 16, [1, 1, 1, 1, 1]);
  city(1, 14, [0, 4, 0, 0, 0], 4); city(1, 13, [0, 4, 0, 3, 0]);
  city(2, 13, [4, 0, 3, 0, 0]); city(2, 13, [0, 3, 0, 0, 4]);
  city(3, 13, [2, 2, 2, 2, 2]); city(3, 14, [1, 2, 2, 1, 2]);
  city(4, 11, [0, 3, 3, 3, 3]); city(4, 11, [3, 3, 3, 0, 3]);
  city(5, 12, null, 6); city(5, 15, null, 5);
  city(6, 13, [0, 0, 3, 4, 0]); city(6, 13, [0, 0, 4, 0, 3]);
  const CITY_NAMES = ['큰 장터', '구름 장터', '바닷가 장터', '산골 장터', '달빛 장터', '도깨비불 장터', '강나루 장터'];

  // 고갯길 주막 5곳: need 보너스 (+ 손님 1명)
  const POSTS = [
    { need: [0, 1, 0, 3, 0], txt: '카드를 사면 보물 1개 더' },
    { need: [0, 0, 2, 0, 0], txt: '같은 색 2개 가져올 때 다른 색 1개 더' },
    { need: [1, 0, 0, 0, 3], txt: '금덩이 1개 = 같은 색 보물 2개' },
    { need: [5, 0, 0, 0, 0], guest: 1, txt: '5점 더' },
    { need: [0, 3, 0, 0, 0], txt: '내 깃발 1개마다 1점' }
  ];
  const POST_NAMES = ['첫째 주막', '둘째 주막', '셋째 주막', '넷째 주막', '다섯째 주막'];

  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const sum = a => a.reduce((s, x) => s + x, 0);
  const clone = o => JSON.parse(JSON.stringify(o));

  function newPlayer(ex) {
    const p = { tok: [0, 0, 0, 0, 0, 0], cards: [], res: [], guests: [] };
    if (ex === 'city') p.city = [];
    if (ex === 'post') p.post = [0, 0, 0, 0, 0];
    if (ex === 'sea') { p.gc = []; p.jc = {}; p.rg = []; }
    return p;
  }
  function deal(nPlayers, ex) {
    ex = EX[ex] && ex ? ex : '';
    const per = nPlayers === 2 ? 4 : nPlayers === 3 ? 5 : 7;
    const s = { ex, bank: [per, per, per, per, per, 5] };
    [1, 2, 3].forEach(lv => {
      const d = shuffle(CARDS.filter(x => x.lv === lv && !x.sea).map(x => x.id));
      s['b' + lv] = d.slice(0, 4); s['d' + lv] = d.slice(4);
      if (ex === 'sea') { const e = shuffle(CARDS.filter(x => x.lv === lv && x.sea).map(x => x.id)); s['s' + lv] = e.slice(0, 2); s['e' + lv] = e.slice(2); }
    });
    if (ex === 'city') { s.guests = []; s.cities = shuffle([0, 1, 2, 3, 4, 5, 6]).slice(0, 3).map(t => t * 2 + (Math.random() < 0.5 ? 0 : 1)); }
    else s.guests = shuffle(GUESTS.map(g => g.id)).slice(0, nPlayers + 1);
    if (ex === 'bat') s.bat = {};
    s.p = []; for (let i = 0; i < nPlayers; i++) s.p.push(newPlayer(ex));
    return s;
  }
  // 카드 한 장이 주는 보너스 색 (-1 없음)
  function colorOf(pl, id) { const c = CARDS[id]; if (c.k === 'joker' || c.k === 'joker1') return pl.jc && pl.jc[id] != null ? pl.jc[id] : -1; return c.c; }
  function bonus(pl) {
    const b = [0, 0, 0, 0, 0];
    pl.cards.forEach(id => { const c = colorOf(pl, id); if (c >= 0) b[c] += CARDS[id].k === 'dbl' ? 2 : 1; });
    return b;
  }
  function score(pl) {
    let s = pl.cards.reduce((a, id) => a + CARDS[id].p, 0) + pl.guests.length * 3;
    if (pl.post) { if (pl.post[3]) s += 5; if (pl.post[4]) s += sum(pl.post); }
    return s;
  }
  // 낼 보물 [진주..흑요석, 금덩이, 쓴 금덩이 카드 수] - 못 사면 null
  function payFor(pl, id) {
    const c = CARDS[id];
    if (c.k === 'disc') return discFor(pl, id) ? [0, 0, 0, 0, 0, 0, 0] : null;
    if ((c.k === 'joker' || c.k === 'joker1') && !pl.cards.some(x => colorOf(pl, x) >= 0)) return null;
    const b = bonus(pl), pay = [0, 0, 0, 0, 0, 0, 0];
    let gold = 0;
    const dbl = pl.post && pl.post[2];
    for (let i = 0; i < 5; i++) {
      const need = Math.max(0, c.cost[i] - b[i]);
      pay[i] = Math.min(need, pl.tok[i]);
      gold += dbl ? Math.ceil((need - pay[i]) / 2) : need - pay[i];
    }
    const gc = (pl.gc || []).length;
    let cards = Math.min(gc, Math.floor(gold / 2)), rest = gold - cards * 2;
    if (rest > pl.tok[5] && cards < gc) { cards++; rest = Math.max(0, rest - 2); }
    if (rest > pl.tok[5]) return null;
    pay[5] = rest; pay[6] = cards; return pay;
  }
  // 카드 버리고 사기: 버릴 카드 목록 (겹친 카드 먼저) - 못 사면 null
  function discFor(pl, id) {
    const x = CARDS[id].dc, out = [];
    let need = 2;
    pl.cards.filter(c => (CARDS[c].k === 'joker' || CARDS[c].k === 'joker1') && colorOf(pl, c) === x).forEach(c => { if (need > 0) { out.push(c); need--; } });
    if (need > 0) {
      const one = pl.cards.filter(c => !CARDS[c].k.startsWith('joker') && CARDS[c].k !== 'dbl' && colorOf(pl, c) === x).sort((a, c) => CARDS[a].p - CARDS[c].p);
      const two = pl.cards.filter(c => CARDS[c].k === 'dbl' && CARDS[c].c === x);
      if (need === 2 && two.length && (one.length < 2 || CARDS[one[0]].p + CARDS[one[1]].p > 0)) out.push(two[0]);
      else if (one.length >= need) out.push(...one.slice(0, need));
      else if (two.length) out.push(two[0]);
      else return null;
    }
    return out;
  }
  function missing(pl, id) { // 금덩이 생각 안 하고 색별로 모자란 수
    const b = bonus(pl), cost = CARDS[id].cost;
    return cost.map((n, i) => Math.max(0, n - b[i] - pl.tok[i]));
  }

  // 보물 가져오기가 맞는지: 서로 다른 색 3개(남은 색이 적으면 그만큼) 또는 같은 색 2개(4개 이상 남았을 때)
  // plus: 둘째 주막 - 같은 색 2개에 다른 색 1개 더
  function takeOk(bank, g, plus) {
    const n = sum(g);
    if (g.some((x, i) => x < 0 || x > bank[i])) return '남은 보물보다 많이 골랐어요';
    if (g.some(x => x === 2)) {
      const i = g.indexOf(2);
      if (bank[i] < 4) return `${NAMES[i]}이(가) 4개 이상 남아 있을 때만 같은 색 2개를 가져올 수 있어요`;
      if (n === 2) return '';
      if (plus && n === 3 && g.filter(x => x === 1).length === 1) return '';
      return plus ? '같은 색 2개에 다른 색은 1개만 더 가져와요' : '같은 색 2개를 가져올 때는 그 2개만 가져와요';
    }
    if (g.some(x => x > 2)) return '같은 색은 2개까지만 가져와요';
    const avail = bank.slice(0, 5).filter(x => x > 0).length;
    if (n === 0) return '가져올 보물을 골라요';
    if (n > 3) return '서로 다른 색은 3개까지 가져와요';
    if (n < Math.min(3, avail)) return '서로 다른 색 3개를 골라요';
    return '';
  }

  // 방망이: 다른 사람 방망이가 있는 카드는 못 사고 못 찜해요
  const blocked = (s, by, id) => !!(s.bat && s.bat[id] && s.bat[id].o !== by);
  const batsUsed = (s, by) => s.bat ? Object.values(s.bat).reduce((a, x) => a + (x.o === by ? x.n : 0), 0) : 0;
  function batBack(s, id) { if (s.bat && s.bat[id]) delete s.bat[id]; }
  function onBoard(s) { const r = []; [1, 2, 3].forEach(lv => ['b', 's'].forEach(k => (s[k + lv] || []).forEach(id => { if (id >= 0) r.push(id); }))); return r; }
  // 방망이 놓기(A)·치우기(B)로 할 수 있는 것들
  function batOpts(s, by, skip) {
    const o = [], free = MAX_BAT - batsUsed(s, by);
    const mine = Object.keys(s.bat).map(Number).filter(id => s.bat[id].o === by);
    onBoard(s).forEach(id => {
      if (id === skip) return;
      const b = s.bat[id];
      if (b && b.o !== by) { o.push({ t: 'b', id }); return; }
      if (b && b.n >= MAX_BAT) return;
      if (free > 0) o.push({ t: 'a', id });
      mine.forEach(f => { if (f !== id) o.push({ t: 'a', id, from: f }); });
    });
    return o;
  }
  function doBat(s, by, bt) {
    const opts = batOpts(s, by);
    if (!opts.length) return '';
    if (!bt) return '방망이를 놓거나 치워야 해요';
    const ok = opts.some(x => x.t === bt.t && x.id === bt.id && (x.from == null ? bt.from == null : x.from === bt.from));
    if (!ok) return '거기에는 방망이를 놓을 수 없어요';
    if (bt.t === 'b') { const b = s.bat[bt.id]; b.n--; if (!b.n) delete s.bat[bt.id]; return ''; }
    if (bt.from != null) { const f = s.bat[bt.from]; f.n--; if (!f.n) delete s.bat[bt.from]; }
    if (s.bat[bt.id]) s.bat[bt.id].n++; else s.bat[bt.id] = { o: by, n: 1 };
    return '';
  }

  // 펼친 카드 집기: src {lv, i, sea}
  function takeFromBoard(s, src) {
    const row = s[(src.sea ? 's' : 'b') + src.lv];
    if (!row) return null;
    const id = row[src.i];
    if (id == null || id < 0) return null;
    return id;
  }
  function refillAt(s, src) { const row = s[(src.sea ? 's' : 'b') + src.lv], d = s[(src.sea ? 'e' : 'd') + src.lv]; row[src.i] = d.length ? d.shift() : -1; }

  // 산 카드를 내 것으로 (용궁 보물 효과 포함) - x: {on, g, free:{lv,i,sea,x}}
  function gain(s, by, id, x, last, depth) {
    const pl = s.p[by], c = CARDS[id];
    x = x || {};
    if (c.k === 'gold2') { pl.gc.push(id); return ''; }
    if (c.k === 'joker' || c.k === 'joker1') {
      let on = x.on;
      if (on == null || !pl.cards.includes(on) || colorOf(pl, on) < 0) on = pl.cards.find(q => colorOf(pl, q) >= 0);
      if (on == null) return '겹칠 카드가 없어요';
      pl.jc[id] = colorOf(pl, on); pl.cards.push(id);
      (last.on = last.on || []).push({ c: id, on });
    } else pl.cards.push(id);
    if (c.k === 'guest' && s.guests.length) {
      const g = s.guests.includes(x.g) ? x.g : s.guests[0];
      s.guests.splice(s.guests.indexOf(g), 1); pl.rg.push(g); last.rg = g;
    }
    if ((c.k === 'joker1' || c.k === 'free2') && depth < 3) {
      const lv = c.k === 'joker1' ? 1 : 2, f = x.free;
      const any = ['b', 's'].some(k => (s[k + lv] || []).some(q => q >= 0));
      if (any) {
        if (!f || f.lv !== lv) return `공짜로 가져올 ${lv}단계 카드를 골라요`;
        const fid = takeFromBoard(s, f);
        if (fid == null) return '빈자리예요';
        refillAt(s, f);
        (last.free = last.free || []).push(fid);
        const e = gain(s, by, fid, f.x, last, depth + 1); if (e) return e;
      }
    }
    return '';
  }

  // 한 수 두기: 성공하면 바뀐 상태, 실패하면 { err }
  // move: {t:'take', g:[5]} | {t:'res', lv, i(-1 = 더미), sea} | {t:'buy', lv, i, sea} | {t:'buy', r} | {t:'pass'}
  //  + back:[6] (10개 넘을 때) · x (용궁 효과) · pt (첫째 주막 보물 색) · bt (방망이) · dom {lv,i,bt,x,pt} (방망이 3개 카드 바로 사기)
  function apply(state, by, mv) {
    const s = clone(state), pl = s.p[by];
    const last = { by, t: mv.t };
    let e = '';
    if (mv.t === 'take') {
      e = takeOk(s.bank, mv.g, pl.post && pl.post[1]); if (e) return { err: e };
      for (let i = 0; i < 5; i++) { s.bank[i] -= mv.g[i]; pl.tok[i] += mv.g[i]; }
      last.g = mv.g.slice();
    } else if (mv.t === 'res') {
      if (pl.res.length >= MAX_RES) return { err: '손에는 3장까지만 찜할 수 있어요' };
      let id;
      if (mv.i < 0) { const d = s['d' + mv.lv]; if (!d.length) return { err: '더미가 비었어요' }; id = d.shift(); last.blind = 1; }
      else {
        id = takeFromBoard(s, mv); if (id == null) return { err: '빈자리예요' };
        if (blocked(s, by, id)) return { err: '다른 사람 방망이가 있는 카드예요' };
        batBack(s, id); refillAt(s, mv);
      }
      pl.res.push(id); last.card = id; last.lv = mv.lv;
      if (s.bank[5] > 0) { s.bank[5]--; pl.tok[5]++; last.gold = 1; }
    } else if (mv.t === 'buy') {
      e = buy(s, by, mv, last); if (e) return { err: e };
    } else if (mv.t === 'pass') {
      if (anyMove(state, by)) return { err: '할 수 있는 일이 있어요' };
    } else return { err: '알 수 없는 수예요' };
    // 방망이 3개 놓은 카드 바로 사기
    if (mv.dom && s.ex === 'bat') {
      const id = takeFromBoard(s, mv.dom);
      if (id == null || !s.bat[id] || s.bat[id].o !== by || s.bat[id].n < MAX_BAT) return { err: '방망이 3개를 놓은 카드만 바로 살 수 있어요' };
      const l2 = { t: 'buy' };
      e = buy(s, by, Object.assign({ t: 'buy' }, mv.dom), l2); if (e) return { err: e };
      last.dom = l2.card; last.domPay = l2.pay; last.domBt = l2.bt;
    }
    // 10개 넘으면 돌려놓기
    const over = sum(pl.tok) - MAX_TOK;
    if (over > 0 && !mv.preview) {
      const back = mv.back || [0, 0, 0, 0, 0, 0];
      if (sum(back) !== over || back.some((x, i) => x < 0 || x > pl.tok[i])) return { err: `보물을 ${over}개 돌려놓아야 해요`, over, tok: pl.tok.slice() };
      for (let i = 0; i < 6; i++) { pl.tok[i] -= back[i]; s.bank[i] += back[i]; }
      last.back = back.slice();
    }
    // 손님 방문 (차례 끝에 한 명) - 맡아 둔 손님 포함
    const b = bonus(pl);
    const meets = gid => GUESTS[gid].need.every((n, i) => b[i] >= n);
    const kr = (pl.rg || []).findIndex(meets);
    if (kr >= 0) { const gid = pl.rg.splice(kr, 1)[0]; pl.guests.push(gid); last.guest = gid; }
    else {
      const k = s.guests.findIndex(meets);
      if (k >= 0) { const gid = s.guests.splice(k, 1)[0]; pl.guests.push(gid); last.guest = gid; }
    }
    // 장터 (차례 끝에 한 곳)
    if (s.ex === 'city') {
      const sc = score(pl);
      const k = s.cities.findIndex(cid => cityOk(CITY[cid], b, sc));
      if (k >= 0) { const cid = s.cities.splice(k, 1)[0]; pl.city.push(cid); last.city = cid; }
    }
    // 주막 (차례 끝에 한 곳)
    if (s.ex === 'post') {
      const k = POSTS.findIndex((P, i) => !pl.post[i] && P.need.every((n, j) => b[j] >= n) && (!P.guest || pl.guests.length));
      if (k >= 0) { pl.post[k] = 1; last.post = k; }
    }
    s.last = last;
    return s;
  }
  function buy(s, by, mv, last) {
    const pl = s.p[by];
    let id, src = null;
    if (mv.r != null) { id = pl.res[mv.r]; if (id == null) return '그 카드가 없어요'; }
    else { src = { lv: mv.lv, i: mv.i, sea: mv.sea ? 1 : 0 }; id = takeFromBoard(s, src); if (id == null) return '빈자리예요'; if (blocked(s, by, id)) return '다른 사람 방망이가 있는 카드예요'; }
    const c = CARDS[id];
    const pay = payFor(pl, id); if (!pay) return c.k === 'disc' ? `${NAMES[c.dc]} 보너스 2개만큼 카드가 있어야 해요` : (c.k.startsWith('joker') && !pl.cards.some(q => colorOf(pl, q) >= 0)) ? '겹칠 보너스 카드가 있어야 해요' : '보물이 모자라요';
    if (c.k === 'disc') {
      const out = discFor(pl, id);
      out.forEach(q => { pl.cards.splice(pl.cards.indexOf(q), 1); if (pl.jc) delete pl.jc[q]; });
      last.disc = out;
    } else {
      for (let i = 0; i < 6; i++) { pl.tok[i] -= pay[i]; s.bank[i] += pay[i]; }
      if (pay[6]) { last.gcUsed = pl.gc.splice(0, pay[6]); }
    }
    if (mv.r != null) pl.res.splice(mv.r, 1);
    else { batBack(s, id); s[(src.sea ? 's' : 'b') + src.lv][src.i] = -2; }
    last.card = id; last.pay = pay.slice(0, 6); last.fromRes = mv.r != null ? 1 : 0;
    // 방망이: 빈자리 채우기 전에 놓거나 치우기
    if (s.ex === 'bat') { const e = doBat(s, by, mv.bt); if (e) return e; last.bt = mv.bt || null; }
    if (src) refillAt(s, src);
    const e = gain(s, by, id, mv.x, last, 0); if (e) return e;
    // 첫째 주막: 산 뒤 보물 1개
    if (pl.post && pl.post[0]) {
      const k = mv.pt != null && s.bank[mv.pt] > 0 && mv.pt < 5 ? mv.pt : [0, 1, 2, 3, 4].find(i => s.bank[i] > 0);
      if (k != null) { s.bank[k]--; pl.tok[k]++; last.pt = k; }
    }
    return '';
  }
  function cityOk(ct, b, sc) {
    if (sc < ct.p) return false;
    if (!ct.need.every((n, i) => b[i] >= n)) return false;
    if (ct.any && ![0, 1, 2, 3, 4].some(i => !ct.need[i] && b[i] >= ct.any)) return false;
    return true;
  }
  function anyMove(s, by) {
    const pl = s.p[by];
    if (s.bank.slice(0, 5).some(x => x > 0)) return true;
    if (pl.res.length < MAX_RES && [1, 2, 3].some(lv => s['d' + lv].length || onBoard(s).some(id => !blocked(s, by, id)))) return true;
    if (pl.res.some(id => payFor(pl, id))) return true;
    return boardCards(s, by).some(x => payFor(pl, x.id));
  }
  // 이번 바퀴가 끝나면 게임이 끝나는지
  function over(s) { return s.ex === 'city' ? s.p.some(pl => pl.city.length) : s.p.some(pl => score(pl) >= GOAL); }
  // 이긴 사람 (자리 번호) - 점수가 같으면 카드를 적게 산 사람, 그래도 같으면 'draw'
  // 장터: 장터를 얻은 사람들 가운데에서
  function result(s) {
    let best = [];
    const cand = s.ex === 'city' && s.p.some(pl => pl.city.length) ? s.p.map((pl, i) => i).filter(i => s.p[i].city.length) : s.p.map((pl, i) => i);
    cand.forEach(i => {
      const pl = s.p[i];
      if (!best.length) { best = [i]; return; }
      const a = s.p[best[0]], d = score(pl) - score(a) || a.cards.length - pl.cards.length;
      if (d > 0) best = [i]; else if (d === 0) best.push(i);
    });
    return best.length === 1 ? best[0] : 'draw';
  }

  // ---------- 깨비샘 (컴퓨터) ----------
  function boardCards(s, by) {
    const r = [];
    [1, 2, 3].forEach(lv => ['b', 's'].forEach(k => (s[k + lv] || []).forEach((id, i) => { if (id >= 0 && (by == null || !blocked(s, by, id))) r.push({ id, lv, i, sea: k === 's' ? 1 : 0 }); })));
    return r;
  }
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
    boardCards(s, by).forEach(x => { if (payFor(pl, x.id)) mv.push({ t: 'buy', lv: x.lv, i: x.i, sea: x.sea }); if (pl.res.length < MAX_RES) mv.push({ t: 'res', lv: x.lv, i: x.i, sea: x.sea }); });
    pl.res.forEach((id, r) => { if (payFor(pl, id)) mv.push({ t: 'buy', r }); });
    if (pl.res.length < MAX_RES) [1, 2, 3].forEach(lv => { if (s['d' + lv].length) mv.push({ t: 'res', lv, i: -1 }); });
    return mv;
  }
  // 컴퓨터 생각에 쓰는 값들
  function ctxOf(s, by) {
    const pl = s.p[by];
    const opps = s.p.filter((_, i) => i !== by);
    const op = opps.reduce((a, x) => score(x) > score(a) ? x : a, opps[0]);
    const b = bonus(pl), myScore = score(pl), opScore = score(op);
    const guestNeed = [0, 0, 0, 0, 0];
    s.guests.concat(pl.rg || []).forEach(gid => GUESTS[gid].need.forEach((n, i) => { if (n > b[i]) guestNeed[i] += 1 / (1 + sum(GUESTS[gid].need.map((m, j) => Math.max(0, m - b[j])))); }));
    if (s.ex === 'city') s.cities.forEach(cid => { const ct = CITY[cid]; ct.need.forEach((n, i) => { if (n > b[i]) guestNeed[i] += 0.5; }); if (ct.any) { const m = Math.max(...b); guestNeed[b.indexOf(m)] += 0.4; } });
    if (s.ex === 'post') POSTS.forEach((P, k) => { if (!pl.post[k]) P.need.forEach((n, i) => { if (n > b[i]) guestNeed[i] += 0.35 / (1 + sum(P.need.map((m, j) => Math.max(0, m - b[j])))) * 3; }); });
    const colorUse = [0, 0, 0, 0, 0];
    boardCards(s).forEach(x => CARDS[x.id].cost.forEach((n, i) => { colorUse[i] += n; }));
    const late = s.ex === 'city' ? myScore >= 8 : (myScore >= 9 || opScore >= 10);
    return { pl, opps, op, b, myScore, opScore, guestNeed, colorUse, late };
  }
  function cardValue(s, by, ctx, id, depth) {
    const c = CARDS[id], { guestNeed, colorUse, late } = ctx;
    const bv = col => (late ? 0.4 : 1.4) + guestNeed[col] * 6 + colorUse[col] * 0.04;
    const bestCol = () => { let m = 0; for (let i = 1; i < 5; i++) if (guestNeed[i] > guestNeed[m]) m = i; return m; };
    let v = c.p * (late ? 4 : 2.6);
    if (c.k === 'gold2') v += late ? 0.6 : 1.6;
    else if (c.k === 'joker') v += bv(bestCol());
    else if (c.k === 'joker1') v += bv(bestCol()) + (depth < 2 ? bestFree(s, by, ctx, 1, depth).v * 0.9 : 0);
    else if (c.k === 'free2') v += bv(c.c) + (depth < 2 ? bestFree(s, by, ctx, 2, depth).v * 0.9 : 0);
    else if (c.k === 'dbl') v += bv(c.c) * 2;
    else if (c.k === 'guest') v += bv(c.c) + (s.guests.length ? 2.2 : 0);
    else if (c.k === 'disc') v += bv(c.c) - 2 * bv(c.dc) * 0.6;
    else v += bv(c.c);
    return v;
  }
  function bestFree(s, by, ctx, lv, depth) {
    let best = { v: 0, src: null };
    ['b', 's'].forEach(k => (s[k + lv] || []).forEach((id, i) => {
      if (id < 0 || CARDS[id].k === 'disc') return;
      const v = cardValue(s, by, ctx, id, depth + 1);
      if (!best.src || v > best.v) best = { v, src: { lv, i, sea: k === 's' ? 1 : 0 }, id };
    }));
    return best;
  }
  // 용궁 효과 고르기
  function chooseX(s, by, ctx, id, depth) {
    const c = CARDS[id], pl = s.p[by], x = {};
    if (c.k === 'joker' || c.k === 'joker1') {
      let best = null, bv = -1;
      pl.cards.forEach(q => { const col = colorOf(pl, q); if (col >= 0 && ctx.guestNeed[col] + Math.random() * 0.01 > bv) { bv = ctx.guestNeed[col]; best = q; } });
      if (best != null) x.on = best;
    }
    if (c.k === 'guest' && s.guests.length) {
      const b = ctx.b;
      x.g = s.guests.slice().sort((a, q) => sum(GUESTS[a].need.map((n, i) => Math.max(0, n - b[i]))) - sum(GUESTS[q].need.map((n, i) => Math.max(0, n - b[i]))))[0];
    }
    if ((c.k === 'joker1' || c.k === 'free2') && depth < 3) {
      const f = bestFree(s, by, ctx, c.k === 'joker1' ? 1 : 2, depth);
      if (f.src) x.free = Object.assign({}, f.src, { x: chooseX(s, by, ctx, f.id, depth + 1) });
    }
    return x;
  }
  function aiMove(s, by, level) {
    // 쉬움: 가끔 아무 수나 둬요
    if (level === 1 && Math.random() < 0.35) {
      const ms = allMoves(s, by).filter(m => m.t !== 'res' || Math.random() < 0.3);
      if (ms.length) return finish(s, by, ms[Math.floor(Math.random() * ms.length)], [0, 0, 0, 0, 0], level);
    }
    const ctx = ctxOf(s, by), pl = ctx.pl, opps = ctx.opps;
    const cands = boardCards(s, by).map(x => Object.assign(x, { r: null })).concat(pl.res.map((id, r) => ({ id, r, lv: CARDS[id].lv })));
    const value = id => cardValue(s, by, ctx, id, 0);
    const rnd = level === 1 ? 2.5 : level === 2 ? 1.5 : 0.15;
    const noise = () => Math.random() * rnd;
    // 1) 살 수 있는 카드
    const buyable = cands.filter(x => payFor(pl, x.id));
    if (buyable.length) {
      buyable.forEach(x => { const pay = payFor(pl, x.id); x.v = value(x.id) - pay[5] * 0.6 - pay[6] * 0.9 - sum(pay.slice(0, 6)) * 0.05 + (x.r != null ? 0.5 : 0) + noise(); });
      buyable.sort((a, c) => c.v - a.v);
      const top = buyable[0];
      // 쉬움은 가끔 사지 않고 보물을 모아요
      if (!(level === 1 && Math.random() < 0.25 && top.v < 3)) {
        const mv = top.r != null ? { t: 'buy', r: top.r } : { t: 'buy', lv: top.lv, i: top.i, sea: top.sea };
        return finish(s, by, mv, [0, 0, 0, 0, 0], level);
      }
    }
    // 2) 목표 카드 고르기: 가치 ÷ (모자란 보물 수 + 1)
    const targets = cands.filter(x => CARDS[x.id].k !== 'disc').map(x => {
      const m = missing(pl, x.id), need = Math.max(0, sum(m) - pl.tok[5] - 2 * (pl.gc || []).length);
      return Object.assign(x, { m, need, v: value(x.id) / (need + 1.2) + noise() });
    }).sort((a, c) => c.v - a.v);
    const want = [0, 0, 0, 0, 0];
    targets.slice(0, 3).forEach((x, k) => x.m.forEach((n, i) => { want[i] += n * (k === 0 ? 3 : 1); }));
    // 어려움: 상대가 다음 차례에 이길 카드를 사면 찜해서 막기
    if (level === 3 && pl.res.length < MAX_RES && s.ex !== 'city') {
      const danger = boardCards(s, by).find(x => opps.some(o => payFor(o, x.id) && score(o) + CARDS[x.id].p >= GOAL));
      if (danger) return finish(s, by, { t: 'res', lv: danger.lv, i: danger.i, sea: danger.sea }, want, level);
    }
    // 3) 보물 가져오기
    const g = [0, 0, 0, 0, 0];
    const top = targets[0];
    const order = [0, 1, 2, 3, 4].filter(i => s.bank[i] > 0).sort((a, c) => (want[c] + ctx.colorUse[c] * 0.02 + noise() * 0.3) - (want[a] + ctx.colorUse[a] * 0.02 + noise() * 0.3));
    const two = top && [0, 1, 2, 3, 4].find(i => top.m[i] >= 2 && s.bank[i] >= 4 && (top.m.filter(n => n > 0).length === 1 || (pl.post && pl.post[1])));
    if (two != null) {
      g[two] = 2;
      if (pl.post && pl.post[1]) { const o = order.find(i => i !== two); if (o != null) g[o] = 1; }
    } else order.slice(0, 3).forEach(i => { g[i] = 1; });
    const useful = sum(g.map((n, i) => n * (want[i] > 0 ? 1 : 0)));
    // 쓸모없는 보물만 가져오게 되면 찜하기 (금덩이도 받음)
    if ((useful === 0 || sum(g) === 0) && pl.res.length < MAX_RES && top && top.r == null && s.bank[5] > 0) {
      return finish(s, by, { t: 'res', lv: top.lv, i: top.i, sea: top.sea }, want, level);
    }
    if (sum(g) > 0 && !takeOk(s.bank, g, pl.post && pl.post[1])) return finish(s, by, { t: 'take', g }, want, level);
    if (pl.res.length < MAX_RES) {
      const x = boardCards(s, by)[0]; if (x) return finish(s, by, { t: 'res', lv: x.lv, i: x.i, sea: x.sea }, want, level);
      const lv = [3, 2, 1].find(l => s['d' + l].length); if (lv) return finish(s, by, { t: 'res', lv, i: -1 }, want, level);
    }
    return { t: 'pass' };
  }
  // 방망이 고르기: 가장 갖고 싶은 카드에 놓거나, 상대가 많이 놓은 카드에서 치우기
  function chooseBat(s, by, ctx, skipId) {
    const opts = batOpts(s, by, skipId);
    if (!opts.length) return null;
    const pl = s.p[by];
    const val = id => cardValue(s, by, ctx, id, 1) + (payFor(pl, id) ? 1 : 0);
    let best = null, bv = -1e9;
    opts.forEach(o => {
      let v;
      if (o.t === 'b') { const b = s.bat[o.id]; v = b.n * 1.5 + (b.n >= 2 ? 2 : 0) + val(o.id) * 0.3; }
      else { const b = s.bat[o.id]; v = val(o.id) + (b ? b.n * 1.2 : 0) - (o.from != null ? val(o.from) * 0.8 + 0.5 : 0); }
      v += Math.random() * 0.3;
      if (v > bv) { bv = v; best = o; }
    });
    return best;
  }
  // 수 마무리: 효과 고르기, 방망이, 바로 사기, 10개 넘으면 돌려놓기
  function finish(s, by, mv, want, level) {
    const ctx = ctxOf(s, by), pl = s.p[by];
    const fill = (m) => {
      if (m.t !== 'buy') return;
      const id = m.r != null ? pl.res[m.r] : takeFromBoard(s, m);
      if (id == null) return;
      if (s.ex === 'sea') m.x = chooseX(s, by, ctx, id, 0);
      if (pl.post && pl.post[0]) { const k = [0, 1, 2, 3, 4].filter(i => s.bank[i] > 0).sort((a, c) => (want[c] || 0) - (want[a] || 0))[0]; if (k != null) m.pt = k; }
    };
    fill(mv);
    if (s.ex === 'bat' && mv.t === 'buy') {
      // 방망이는 산 카드를 치운 뒤에 고르므로, 그 자리를 비운 상태로 생각
      const t = clone(s); const id = mv.r != null ? null : takeFromBoard(t, mv);
      if (id != null) { batBack(t, id); t[(mv.sea ? 's' : 'b') + mv.lv][mv.i] = -2; }
      mv.bt = chooseBat(t, by, ctx);
    }
    let r = apply(s, by, mv);
    // 방망이 3개 놓은 카드가 있으면 바로 사기
    if (s.ex === 'bat' && !r.err) {
      const dom = boardCards(r, by).find(x => r.bat[x.id] && r.bat[x.id].o === by && r.bat[x.id].n >= MAX_BAT && payFor(r.p[by], x.id));
      if (dom) {
        const t = clone(r); batBack(t, dom.id); t['b' + dom.lv][dom.i] = -2;
        mv.dom = { lv: dom.lv, i: dom.i, bt: chooseBat(t, by, ctx) };
        r = apply(s, by, mv);
      }
    }
    if (r.err && r.over) { mv.back = pickBack(r.tok, r.over, want); r = apply(s, by, mv); }
    if (r.err) { delete mv.dom; r = apply(s, by, mv); if (r.err && r.over) mv.back = pickBack(r.tok, r.over, want); }
    return mv;
  }

  window.Gem = { C, NAMES, GOAL, MAX_TOK, MAX_RES, MAX_BAT, EX, CARDS, BASE_N, GUESTS, GUEST_NAMES, CITY, CITY_NAMES, POSTS, POST_NAMES,
    deal, bonus, colorOf, score, payFor, discFor, takeOk, apply, anyMove, over, result, aiMove, sum, blocked, batOpts, batsUsed, cityOk, boardCards, takeFromBoard };
})();
