// 깨비샘의 도깨비 야시장 · 꼬치 규칙
// 꼬치 조각: 재료 한 글자 + (감싼 토핑 한 글자). 예) 'm' 메밀묵, 'tk' 김으로 감싼 가래떡
// 같은 토핑이 붙은 이웃 재료 2개는 띠 하나로 함께 감싼 것. 예) 'mk,tk' 김 한 장이 메밀묵과 가래떡을 같이 감쌈
// 재료: m 메밀묵, t 가래떡, j 대추, e 은행   토핑: k 김, y 달걀지단
// 카드: '3|m,tk' (점수|꼬치), 'B' 도깨비 대장 행차, 'C' 꼬끼오(닭이 울면 장사 끝)
(function (root) {
  'use strict';
  const ING = ['m', 't', 'j', 'e'], WRAP = ['k', 'y'];
  const ING_NAME = { m: '메밀묵', t: '가래떡', j: '대추', e: '은행' };
  const WRAP_NAME = { k: '김', y: '달걀지단' };

  const enc = s => s.join(',');
  const dec = str => str ? str.split(',') : [];
  // 막대는 위아래가 없어서 거꾸로 꽂아도 같은 꼬치
  function same(a, b) {
    if (a.length !== b.length) return false;
    const x = enc(a);
    return x === enc(b) || x === enc(b.slice().reverse());
  }
  function shuffle(a, rnd = Math.random) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  // 점수별 꼬치 모양
  //  3점: 재료 1~2개
  //  4점: 재료 3~4개, 또는 재료 1~2개 + 토핑 1개
  //  5점: 재료 3개 + 토핑 1개, 또는 재료 2개 + 토핑 2개
  //  6점: 재료 4개 + 토핑 1~2개, 또는 재료 3개 + 토핑 2개
  const SHAPES = {
    3: [[1, 0], [2, 0], [2, 0]],
    4: [[3, 0], [4, 0], [1, 1], [2, 1], [2, 1]],
    5: [[3, 1], [3, 1], [2, 2]],
    6: [[4, 1], [4, 2], [3, 2]]
  };
  function makeOrder(value, rnd = Math.random) {
    const sh = SHAPES[value][Math.floor(rnd() * SHAPES[value].length)];
    const ings = shuffle(ING.slice(), rnd).slice(0, sh[0]);
    const tag = ings.map(() => '');
    // 토핑은 재료 1개, 또는 붙어 있는 재료 2개를 한 번에 감싸요
    shuffle(WRAP.slice(), rnd).slice(0, sh[1]).forEach(w => {
      const opts = [];
      for (let i = 0; i < ings.length; i++) {
        if (!tag[i]) opts.push([i, 1]);
        if (i + 1 < ings.length && !tag[i] && !tag[i + 1]) opts.push([i, 2], [i, 2]);
      }
      // 두 토핑을 모두 쓸 때는 다른 토핑 자리를 남겨 둬요
      const pick = opts.filter(([i, n]) => tag.filter(t => !t).length - n >= (sh[1] - tag.filter(t => t).length > 0 && !tag.some(t => t) ? 1 : 0) || sh[1] === 1);
      const [i, n] = (pick.length ? pick : opts)[Math.floor(rnd() * (pick.length ? pick : opts).length)];
      for (let k = 0; k < n; k++) tag[i + k] = w;
    });
    return ings.map((g, i) => g + tag[i]);
  }
  const key = s => { const a = enc(s), b = enc(s.slice().reverse()); return a < b ? a : b; };
  // 주문 카드 27장: 원작 카드 그대로, 재료만 바꿈
  // (스테이크→메밀묵 m, 새우→가래떡 t, 토마토→대추 j, 피망→은행 e, 베이컨→김 k, 치즈→달걀지단 y)
  const ORDERS = [
    '3|t,j', '3|j', '3|m', '3|e', '3|e,m', '3|t',
    '4|my,ty', '4|my', '4|jy,ey', '4|ty', '4|jk', '4|t,e,m,j', '4|my,j', '4|t,e,j', '4|t,ek', '4|ek',
    '5|t,m,ey', '5|j,mk,tk,e', '5|m,jy,t,e', '5|my,ek', '5|jy,mk', '5|j,tk,e', '5|tk,jk,m',
    '6|ty,e,jk', '6|ty,ey,mk,jk', '6|m,jk,ey,t', '6|ty,jy,mk,ek'
  ];
  // + 대장 행차 2장 + 꼬끼오 1장
  function makeDeck(rnd = Math.random) {
    const cards = shuffle(ORDERS.concat('B', 'B'), rnd);
    // 꼬끼오 카드는 5장과 섞어서 맨 아래에 둬요
    const tail = cards.splice(cards.length - 5, 5);
    tail.push('C'); shuffle(tail, rnd);
    return cards.concat(tail);
  }
  function randomOrder(min = 3, rnd = Math.random) { const list = ORDERS.filter(c => +c[0] >= min); return list[Math.floor(rnd() * list.length)]; }
  const isOrder = c => typeof c === 'string' && c.indexOf('|') > 0;
  const cardValue = c => isOrder(c) ? +c.split('|')[0] : 0;
  const cardSkewer = c => isOrder(c) ? dec(c.split('|')[1]) : [];
  const steps = s => s.reduce((n, p) => n + p.length, 0);   // 누르는 횟수
  const total = pile => (pile || []).reduce((n, c) => n + cardValue(c), 0);

  // 꼬치 만들기 상태: { sk: 꼬치, open: 감싸는 중인 토핑, n: 그 토핑 안에 꽂은 재료 수 }
  // 토핑 버튼을 누르면 띠가 열리고, 재료를 1~2개 꽂은 뒤 다시 누르면 닫혀요. (2개를 꽂으면 저절로 닫혀요)
  const fresh = () => ({ sk: [], open: '', n: 0 });
  const wrapUsed = (b, w) => b.open !== w && b.sk.some(p => p[1] === w);
  function step(b, part) {
    const x = { sk: b.sk.slice(), open: b.open, n: b.n };
    if (ING.includes(part)) {
      if (x.sk.some(p => p[0] === part)) return { err: 'used' };
      if (x.open && x.n >= 2) { x.open = ''; x.n = 0; }
      x.sk.push(part + x.open);
      if (x.open) { x.n++; if (x.n >= 2) { x.open = ''; x.n = 0; } }
      return { b: x, kind: 'stick' };
    }
    if (x.open === part) { x.open = ''; x.n = 0; return { b: x, kind: b.n ? 'close' : 'cancel' }; }
    if (wrapUsed(x, part)) return { err: 'used' };
    x.open = part; x.n = 0;
    return { b: x, kind: 'open' };
  }
  // 예전 방식 이름도 남겨 둬요 (깨비샘 꼬치 그리기용)
  function canAdd(sk, part) { return ING.includes(part) && sk.some(p => p[0] === part) ? 'used' : ''; }
  function add(sk, part) { return ING.includes(part) ? sk.concat(part) : sk; }
  // 깨비샘이 누르는 순서: 토핑 열기 → 재료 → 토핑 닫기
  function buildPlan(target) {
    const plan = []; let cur = '', n = 0;
    target.forEach(p => {
      const w = p[1] || '';
      if (cur && (w !== cur || n >= 2)) { if (n < 2) plan.push(cur); cur = ''; n = 0; }
      if (w && !cur) { plan.push(w); cur = w; n = 0; }
      plan.push(p[0]); if (cur) n++;
    });
    if (cur && n < 2) plan.push(cur);
    return plan;
  }
  function play(plan) { let b = fresh(); plan.forEach(p => { const r = step(b, p); if (r.b) b = r.b; }); return b.sk; }
  // 실수로 틀린 꼬치 (가까운 모양)
  function mistake(target, rnd = Math.random) {
    const s = target.slice();
    if (s.length >= 2) { const i = Math.floor(rnd() * (s.length - 1)); [s[i], s[i + 1]] = [s[i + 1], s[i]]; if (!same(s, target)) return s; }
    const free = ING.filter(g => !s.some(p => p[0] === g));
    if (free.length) { s[0] = free[0] + (s[0][1] || ''); return s; }
    return s.slice(1);
  }

  root.MarketRule = { ING, WRAP, ING_NAME, WRAP_NAME, enc, dec, same, shuffle, makeOrder, makeDeck, isOrder, cardValue, cardSkewer, steps, total, canAdd, add, buildPlan, mistake, key, fresh, step, play, ORDERS, randomOrder };
})(typeof window !== 'undefined' ? window : globalThis);
