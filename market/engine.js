// 깨비샘의 도깨비 야시장 · 꼬치 규칙
// 꼬치 조각: 재료 한 글자 + (감싼 토핑 한 글자). 예) 'm' 메밀묵, 'tk' 김으로 감싼 가래떡
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
    const pos = shuffle(ings.map((_, i) => i), rnd).slice(0, sh[1]);
    const wraps = shuffle(WRAP.slice(), rnd);
    return ings.map((g, i) => { const w = pos.indexOf(i); return w >= 0 ? g + wraps[w] : g; });
  }
  const key = s => { const a = enc(s), b = enc(s.slice().reverse()); return a < b ? a : b; };
  // 주문 카드 27장 (3점 6, 4점 10, 5점 7, 6점 4) + 대장 행차 2 + 꼬끼오 1
  function makeDeck(rnd = Math.random) {
    const seen = new Set(), cards = [];
    [[3, 6], [4, 10], [5, 7], [6, 4]].forEach(([v, n]) => {
      for (let i = 0, tries = 0; i < n; tries++) {
        const s = makeOrder(v, rnd), k = key(s);
        if (seen.has(k) && tries < 200) continue;
        seen.add(k); cards.push(v + '|' + enc(s)); i++;
      }
    });
    cards.push('B', 'B');
    shuffle(cards, rnd);
    // 꼬끼오 카드는 마지막 5장 사이에 섞어요
    const tail = cards.splice(cards.length - 5, 5);
    tail.push('C'); shuffle(tail, rnd);
    return cards.concat(tail);
  }
  const isOrder = c => typeof c === 'string' && c.indexOf('|') > 0;
  const cardValue = c => isOrder(c) ? +c.split('|')[0] : 0;
  const cardSkewer = c => isOrder(c) ? dec(c.split('|')[1]) : [];
  const steps = s => s.reduce((n, p) => n + p.length, 0);   // 누르는 횟수
  const total = pile => (pile || []).reduce((n, c) => n + cardValue(c), 0);

  // 꼬치에 재료·토핑 더하기. 안 되면 이유를 돌려줌
  function canAdd(sk, part) {
    if (ING.includes(part)) return sk.some(p => p[0] === part) ? 'used' : '';
    if (!sk.length) return 'empty';
    if (sk.some(p => p[1] === part)) return 'used';
    if (sk[sk.length - 1].length > 1) return 'wrapped';
    return '';
  }
  function add(sk, part) {
    const s = sk.slice();
    if (ING.includes(part)) s.push(part); else s[s.length - 1] = s[s.length - 1][0] + part;
    return s;
  }
  // 깨비샘이 만드는 순서 (재료 꽂고 바로 감싸기)
  function buildPlan(target) {
    const plan = [];
    target.forEach(p => { plan.push(p[0]); if (p[1]) plan.push(p[1]); });
    return plan;
  }
  // 실수로 틀린 꼬치 (가까운 모양)
  function mistake(target, rnd = Math.random) {
    const s = target.slice();
    if (s.length >= 2) { const i = Math.floor(rnd() * (s.length - 1)); [s[i], s[i + 1]] = [s[i + 1], s[i]]; if (!same(s, target)) return s; }
    const free = ING.filter(g => !s.some(p => p[0] === g));
    if (free.length) { s[0] = free[0] + (s[0][1] || ''); return s; }
    return s.slice(1);
  }

  root.MarketRule = { ING, WRAP, ING_NAME, WRAP_NAME, enc, dec, same, shuffle, makeOrder, makeDeck, isOrder, cardValue, cardSkewer, steps, total, canAdd, add, buildPlan, mistake, key };
})(typeof window !== 'undefined' ? window : globalThis);
