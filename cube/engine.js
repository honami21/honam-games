// 깨비샘의 밀당 큐브 · 규칙과 깨비샘(컴퓨터) 생각
// 판: 25글자 문자열. '.' 빈 큐브, 'b' 동그라미(먼저 하는 쪽), 'w' 가위표. 칸 번호 = y*5 + x
(function (root) {
  'use strict';
  const N = 5, EMPTY = '.'.repeat(N * N);
  const other = c => c === 'b' ? 'w' : 'b';
  const isEdge = i => { const x = i % N, y = (i / N) | 0; return x === 0 || y === 0 || x === N - 1 || y === N - 1; };
  const EDGES = []; for (let i = 0; i < N * N; i++) if (isEdge(i)) EDGES.push(i);

  // 가로 5, 세로 5, 대각선 2
  const LINES = [];
  for (let y = 0; y < N; y++) LINES.push([0, 1, 2, 3, 4].map(x => y * N + x));
  for (let x = 0; x < N; x++) LINES.push([0, 1, 2, 3, 4].map(y => y * N + x));
  LINES.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);

  // 집을 수 있는 큐브: 가장자리의 빈 큐브나 내 모양 큐브
  const canPick = (bd, i, me) => isEdge(i) && (bd[i] === '.' || bd[i] === me);

  // 집은 자리(from)에서 밀어 넣을 수 있는 자리(to): 같은 줄의 반대쪽 끝 (제자리 빼고)
  function dests(from) {
    const x = from % N, y = (from / N) | 0, out = [];
    if (x !== 0) out.push(y * N);
    if (x !== N - 1) out.push(y * N + N - 1);
    if (y !== 0) out.push(x);
    if (y !== N - 1) out.push((N - 1) * N + x);
    return out;
  }
  // to에서 밀어 넣으면 from 쪽으로 한 칸씩 밀림. 새 판(배열) 돌려줌
  function push(bdIn, from, to, me) {
    const bd = Array.isArray(bdIn) ? bdIn.slice() : bdIn.split('');
    const fx = from % N, fy = (from / N) | 0, tx = to % N, ty = (to / N) | 0;
    if (fy === ty && fx !== tx) {           // 가로로 밀기
      const s = tx < fx ? -1 : 1;
      for (let k = fx; k !== tx; k += s) bd[fy * N + k] = bd[fy * N + k + s];
    } else {                                // 세로로 밀기
      const s = ty < fy ? -1 : 1;
      for (let k = fy; k !== ty; k += s) bd[k * N + fx] = bd[(k + s) * N + fx];
    }
    bd[to] = me;
    return bd;
  }
  // 밀린 큐브들: [이전 칸, 새 칸] 목록 (그림 움직임용)
  function shifted(from, to) {
    const fx = from % N, fy = (from / N) | 0, tx = to % N, ty = (to / N) | 0, out = [];
    if (fy === ty && fx !== tx) { const s = tx < fx ? -1 : 1; for (let k = fx; k !== tx; k += s) out.push([fy * N + k + s, fy * N + k]); }
    else { const s = ty < fy ? -1 : 1; for (let k = fy; k !== ty; k += s) out.push([(k + s) * N + fx, k * N + fx]); }
    return out;
  }
  function isLegal(bd, from, to, me) { return canPick(bd, from, me) && dests(from).includes(to); }
  function moves(bd, me) {
    const out = [];
    for (const f of EDGES) if (bd[f] === '.' || bd[f] === me) for (const t of dests(f)) out.push([f, t]);
    return out;
  }
  // 다섯 줄 찾기: { b: [줄...], w: [줄...] }
  function fives(bd) {
    const r = { b: [], w: [] };
    for (const L of LINES) { const c = bd[L[0]]; if (c !== '.' && L.every(i => bd[i] === c)) r[c].push(L); }
    return r;
  }
  // 민 사람(mover) 기준 결과: 상대 줄이 생기면 민 사람 패배
  function judge(bd, mover) {
    const f = fives(bd), opp = other(mover);
    if (f[opp].length) return { winner: opp, line: [].concat(...f[opp]), reason: 'gift' };
    if (f[mover].length) return { winner: mover, line: [].concat(...f[mover]), reason: 'five' };
    return null;
  }

  // ---------- 깨비샘 생각 ----------
  const W = [0, 1, 6, 30, 200, 0];
  const POS = [];
  for (let i = 0; i < N * N; i++) { const x = i % N, y = (i / N) | 0; POS.push((x === y || x + y === N - 1 ? 2 : 0) + (isEdge(i) ? 0 : 1)); }
  function evaluate(bd, me) {
    const opp = other(me); let s = 0;
    for (const L of LINES) {
      let m = 0, o = 0;
      for (const i of L) { if (bd[i] === me) m++; else if (bd[i] === opp) o++; }
      s += W[m] * (o ? .5 : 1) - W[o] * (m ? .5 : 1) * 1.15;
    }
    for (let i = 0; i < N * N; i++) { if (bd[i] === me) s += POS[i]; else if (bd[i] === opp) s -= POS[i]; }
    return s;
  }
  const WIN = 1e6;
  function negamax(bd, me, depth, a, b, budget) {
    if (depth === 0 || budget.n <= 0) return evaluate(bd, me);
    const ms = moves(bd, me);
    if (!ms.length) return -negamax(bd, other(me), depth - 1, -b, -a, budget);
    let best = -Infinity;
    for (const [f, t] of ms) {
      budget.n--;
      const nb = push(bd, f, t, me), j = judge(nb, me);
      let v;
      if (j) v = j.winner === me ? WIN + depth : -WIN - depth;
      else v = -negamax(nb, other(me), depth - 1, -b, -a, budget);
      if (v > best) best = v;
      if (best > a) a = best;
      if (a >= b) break;
    }
    return best;
  }
  // level 1 쉬움, 2 보통, 3 어려움
  function aiMove(bdStr, me, level) {
    const bd = bdStr.split(''), ms = moves(bd, me);
    if (!ms.length) return null;
    const depth = level === 1 ? 1 : level === 2 ? 2 : 4;
    const budget = { n: level === 3 ? 260000 : 1e9 };
    const scored = ms.map(m => {
      const nb = push(bd, m[0], m[1], me), j = judge(nb, me);
      let v;
      if (j) v = j.winner === me ? WIN + 9 : -WIN - 9;
      else v = -negamax(nb, other(me), depth - 1, -Infinity, Infinity, budget);
      return { m, v: v + Math.random() * (level === 1 ? 30 : level === 2 ? 4 : .5) };
    }).sort((p, q) => q.v - p.v);
    if (level === 1) {
      if (scored[0].v >= WIN) return scored[0].m;
      const safe = scored.filter(s => s.v > -WIN);
      const pool = (safe.length ? safe : scored).slice(0, Math.random() < .4 ? 10 : 4);
      return pool[(Math.random() * pool.length) | 0].m;
    }
    return scored[0].m;
  }

  const api = { N, EMPTY, other, isEdge, EDGES, LINES, canPick, dests, push, shifted, isLegal, moves, fives, judge, aiMove, evaluate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CubeRule = api;
})(this);
