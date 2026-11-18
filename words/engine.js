// 깨비샘의 낱말 뚝딱 · 타일 규칙과 깨비샘(컴퓨터) 생각
// 타일 16종: 자음 13종(ㄴ은 ㄱ을 돌려서 씀) + 모음 3종(ㅏ를 돌리면 ㅗ·ㅓ·ㅜ, ㅑ는 ㅛ·ㅕ·ㅠ, ㅣ는 ㅡ)
// 손패·단어는 16칸짜리 개수 배열로 다뤄요.
(function (root) {
  'use strict';
  const TILES = ['ㄱ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ', 'ㅏ', 'ㅑ', 'ㅣ'];
  const NT = TILES.length, NC = 13;
  // 상자 속 타일 수 (순서는 TILES와 같음)
  const BOX = [7, 4, 4, 3, 4, 4, 5, 3, 2, 2, 2, 2, 3, 18, 6, 12];   // 실물 상자를 센 개수: 자음 45, 모음 36
  const DEAL_C = 11, DEAL_V = 9;
  const T = {}; TILES.forEach((t, i) => T[t] = i);
  const G = T['ㄱ'], A = T['ㅏ'], YA = T['ㅑ'], I = T['ㅣ'];

  // 낱자 → 타일
  const CONS = { 'ㄱ': [G], 'ㄲ': [G, G], 'ㄴ': [G], 'ㄷ': [T['ㄷ']], 'ㄸ': [T['ㄷ'], T['ㄷ']], 'ㄹ': [T['ㄹ']], 'ㅁ': [T['ㅁ']], 'ㅂ': [T['ㅂ']], 'ㅃ': [T['ㅂ'], T['ㅂ']],
    'ㅅ': [T['ㅅ']], 'ㅆ': [T['ㅅ'], T['ㅅ']], 'ㅇ': [T['ㅇ']], 'ㅈ': [T['ㅈ']], 'ㅉ': [T['ㅈ'], T['ㅈ']], 'ㅊ': [T['ㅊ']], 'ㅋ': [T['ㅋ']], 'ㅌ': [T['ㅌ']], 'ㅍ': [T['ㅍ']], 'ㅎ': [T['ㅎ']] };
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'.split('');
  const JUNG = [[A], [A, I], [YA], [YA, I], [A], [A, I], [YA], [YA, I], [A], [A, A], [A, A, I], [A, I], [YA], [A], [A, A], [A, A, I], [A, I], [YA], [I], [I, I], [I]];
  const JONG = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

  const zero = () => new Array(NT).fill(0);
  const isWord = w => typeof w === 'string' && /^[가-힣]+$/.test(w);
  // 단어에 드는 타일 개수 (한글 완성 글자만, 아니면 null)
  function cost(w) {
    if (!isWord(w)) return null;
    const v = zero();
    for (const ch of w) {
      const c = ch.charCodeAt(0) - 0xAC00;
      const cho = (c / 588) | 0, jung = ((c % 588) / 28) | 0, jong = c % 28;
      CONS[CHO[cho]].forEach(t => v[t]++);
      JUNG[jung].forEach(t => v[t]++);
      for (const j of JONG[jong]) CONS[j].forEach(t => v[t]++);
    }
    return v;
  }
  const sum = v => v.reduce((a, b) => a + b, 0);
  const add = (a, b) => a.map((x, i) => x + b[i]);
  const sub = (a, b) => a.map((x, i) => x - b[i]);
  const fits = (need, have) => need.every((x, i) => x <= have[i]);
  const nonNeg = v => v.every(x => x >= 0);

  // 타일 나눠 주기: 자음 11장, 모음 9장씩
  function deal(players, rnd = Math.random) {
    const cons = [], vow = [];
    BOX.forEach((n, t) => { for (let k = 0; k < n; k++) (t < NC ? cons : vow).push(t); });
    const shuf = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    shuf(cons); shuf(vow);
    const hands = [];
    for (let p = 0; p < players; p++) {
      const h = zero();
      cons.splice(0, DEAL_C).forEach(t => h[t]++);
      vow.splice(0, DEAL_V).forEach(t => h[t]++);
      hands.push(h);
    }
    return hands;
  }

  // 한 차례 판정
  // hand: 내 타일, center: 가운데 단어 목록(문자열), pick: 부술 단어 번호들, words: 새로 만들 단어들
  // first: 첫 차례(내 타일로만 한 단어), used: 이미 만든 단어들, dict: 단어 확인 함수
  // 돌려줌 { ok, msg, own(내 타일에서 나가는 개수 배열) }
  function check({ hand, center, pick, words, first, used, dict }) {
    words = (words || []).filter(Boolean);
    pick = pick || [];
    if (!words.length) return { ok: false, msg: '만들 낱말을 적어 주세요' };
    const seen = new Set();
    let need = zero();
    for (const w of words) {
      const c = cost(w);
      if (!c) return { ok: false, msg: `'${w}'에 한글 낱말만 적어 주세요` };
      if (seen.has(w)) return { ok: false, msg: `'${w}'를 두 번 적었어요` };
      seen.add(w);
      if (used && used.includes(w)) return { ok: false, msg: `'${w}'는 이미 만든 낱말이에요` };
      need = add(need, c);
    }
    const centerOpen = center.length > 0;
    if (first || !centerOpen) {
      if (pick.length) return { ok: false, msg: first ? '첫 차례에는 내 타일로만 만들어요' : '가운데 낱말이 없어요' };
      if (first && words.length > 1) return { ok: false, msg: '첫 차례에는 낱말을 하나만 만들어요' };
    } else if (!pick.length) return { ok: false, msg: '부술 가운데 낱말을 골라 주세요' };
    let broke = zero();
    for (const k of pick) broke = add(broke, cost(center[k]));
    const own = sub(need, broke);
    const left = own.map((x, i) => x < 0 ? -x : 0);
    if (sum(left) > 0) return { ok: false, msg: '부순 낱말의 ' + listTiles(left) + ' 타일을 모두 써야 해요', own, left };
    const lack = own.map((x, i) => Math.max(0, x - hand[i]));
    if (sum(lack) > 0) return { ok: false, msg: '내 타일에 ' + listTiles(lack) + '이(가) 모자라요', own, lack };
    if (sum(own) === 0) return { ok: false, msg: '내 타일을 하나 이상 써야 해요', own };
    // 원래 낱말을 그대로 다시 만드는 것은 안 돼요 (이미 만든 낱말에 들어 있음)
    if (dict) for (const w of words) if (!dict(w)) return { ok: false, msg: `'${w}'는 사전에 없는 낱말이에요`, own, bad: w };
    return { ok: true, msg: '', own };
  }
  function listTiles(v) {
    const out = [];
    v.forEach((n, t) => { if (n > 0) out.push(TILES[t] + (n > 1 ? '×' + n : '')); });
    return out.join(' ');
  }

  // ---------------- 깨비샘 (컴퓨터) ----------------
  // list: [{ w, c(타일 배열), n(타일 수), lv(1 쉬움 2 보통 3 어려움 낱말) }]
  let LIST = null;
  function setList(words, levels) {
    LIST = [];
    words.forEach((w, i) => { const c = cost(w); if (c) LIST.push({ w, c, n: sum(c), lv: levels ? (levels[i] || 3) : 1 }); });
    return LIST.length;
  }
  // 손에서 만들 수 있는 낱말 하나 (가장 타일 많이)
  function bestFrom(have, used, maxLv, skip, rnd) {
    let best = null, bs = -1;
    for (const e of LIST) {
      if (e.lv > maxLv || !fits(e.c, have) || used.has(e.w) || (skip && skip.has(e.w))) continue;
      const s = e.n + rnd() * 0.9;
      if (s > bs) { bs = s; best = e; }
    }
    return best;
  }
  // 돌려줌 { pick:[], words:[] } 또는 null (못 찾음)
  function aiMove({ hand, center, first, used, level, rnd = Math.random }) {
    if (!LIST) return null;
    const usedS = new Set(used || []);
    const maxLv = level >= 3 ? 3 : level === 2 ? 2 : 1;
    // 쉬움은 가끔 놓쳐요
    if (level === 1 && rnd() < 0.18) return null;
    if (first || !center.length) {
      const e = bestFrom(hand, usedS, maxLv, null, rnd);
      return e ? { pick: [], words: [e.w] } : null;
    }
    const cc = center.map(cost);
    const tries = [];
    center.forEach((_, i) => tries.push([i]));
    if (level >= 3) for (let i = 0; i < center.length; i++) for (let j = i + 1; j < center.length; j++) tries.push([i, j]);
    let best = null, bs = -1;
    for (const pick of tries) {
      let broke = zero(); pick.forEach(k => broke = add(broke, cc[k]));
      const pool = add(hand, broke);
      for (const e of LIST) {
        if (e.lv > maxLv || usedS.has(e.w) || !fits(broke, e.c) || !fits(e.c, pool)) continue;
        const own = sub(e.c, broke), n = sum(own);
        if (n <= 0) continue;
        let words = [e.w], tot = n;
        // 보통 이상: 남은 내 타일로 낱말 하나 더
        if (level >= 2) {
          const rest = sub(hand, own);
          const extra = bestFrom(rest, usedS, maxLv, new Set([e.w]), rnd);
          if (extra) { words.push(extra.w); tot += extra.n; }
        }
        const s = tot + rnd() * (level >= 3 ? 0.5 : 2.5);
        if (s > bs) { bs = s; best = { pick, words }; }
      }
    }
    return best;
  }

  root.WordRule = { TILES, BOX, NC, cost, sum, add, sub, fits, nonNeg, zero, deal, check, listTiles, setList, aiMove };
})(typeof window !== 'undefined' ? window : globalThis);
