// 깨비샘의 꽃들의 전쟁: 섯다 (두 장 승부, 깨비샘 둘과 셋이)
// 엽전은 진짜 돈이 아니에요. 기기에만 저장돼요.
(() => {
'use strict';
const H = window.HW; if (!H) return;
const { $, esc, rnd, sleep, beep, bigPop, flash, sparkle, slam, show, cardH, backH, YP, fmt, AI, PAL } = H;
const MON = id => (id >> 2) + 1;
const K = id => id & 3;                                  // 0 = 그 달 첫 장(광·열끗), 1 = 둘째 장
const isG = id => K(id) === 0 && [1, 3, 8].includes(MON(id));
const isY = id => K(id) === 0 && [4, 7, 9].includes(MON(id));
const DECK = []; for (let m = 1; m <= 10; m++) DECK.push((m - 1) * 4, (m - 1) * 4 + 1);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- 족보 ----------
const SPECIAL = { '1-2': [706, '알리'], '1-4': [705, '독사'], '1-9': [704, '구삥'], '1-10': [703, '장삥'], '4-10': [702, '장사'], '4-6': [701, '세륙'] };
function evalH(a, b) {
  const ma = MON(a), mb = MON(b), lo = Math.min(ma, mb), hi = Math.max(ma, mb);
  const r = { s: 0, n: '', tj: false, ah: false, gs: '' };
  if (isG(a) && isG(b)) {
    if (lo === 3 && hi === 8) return { ...r, s: 1000, n: '38광땡' };
    if (lo === 1 && hi === 8) return { ...r, s: 900, n: '18광땡' };
    return { ...r, s: 890, n: '13광땡' };
  }
  if (ma === mb) return { ...r, s: 800 + ma, n: ma === 10 ? '장땡' : ma === 1 ? '삥땡' : `${ma}땡` };
  const sp = SPECIAL[`${lo}-${hi}`];
  if (sp) return { ...r, s: sp[0], n: sp[1] };
  const k = (ma + mb) % 10;
  r.s = 500 + k; r.n = k === 9 ? '갑오' : k === 0 ? '망통' : `${k}끗`;
  const has = (m, f) => [a, b].some(id => MON(id) === m && f(id));
  if (lo === 3 && hi === 7 && has(3, isG) && has(7, isY)) { r.tj = true; r.n = '땡잡이'; }
  if (lo === 4 && hi === 7 && has(4, isY) && has(7, isY)) { r.ah = true; r.n = '암행어사'; }
  if (lo === 4 && hi === 9) { r.gs = isY(a) && isY(b) ? 'mg' : 'gs'; r.n = r.gs === 'mg' ? '멍텅구리 구사' : '구사'; }
  return r;
}
// 이긴 사람 찾기: { win: [i...], regame: bool }
function judge(list) {   // list: [{i, e}]
  const best = Math.max(...list.map(x => x.e.s));
  for (const x of list) {
    if (!x.e.gs) continue;
    const others = Math.max(...list.filter(y => y !== x).map(y => y.e.s));
    if ((x.e.gs === 'gs' && others <= 706) || (x.e.gs === 'mg' && others <= 809)) return { regame: true, by: x.i, best };
  }
  if (best >= 801 && best <= 809) { const t = list.filter(x => x.e.tj); if (t.length) return { win: t.map(x => x.i), special: '땡잡이' }; }
  if (best === 890 || best === 900) { const t = list.filter(x => x.e.ah); if (t.length) return { win: t.map(x => x.i), special: '암행어사' }; }
  return { win: list.filter(x => x.e.s === best).map(x => x.i) };
}
// 깨비샘이 보는 패의 힘 (0~1)
function power(e) {
  if (e.s >= 1000) return 1; if (e.s >= 890) return .97; if (e.s === 810) return .95;
  if (e.s > 800) return .78 + (e.s - 800) * .018;
  if (e.s >= 701) return .62 + (e.s - 701) * .02;
  if (e.tj) return .5; if (e.ah) return .45; if (e.gs) return .46;
  const k = e.s - 500; return .08 + k * .055;
}

// ---------- 상태 ----------
let S = null, busy = false, aiT = 0, token = 0;
const ME = 0;
const meP = () => S && S.players[ME];
const live = () => S.players.filter(p => !p.fold);
const capTotal = () => { const m = meP(); return m.fold ? Infinity : m.bet + H.coin; };
const unit = () => Math.max(10, H.stake);
const roundU = v => Math.max(unit(), Math.round(v / unit()) * unit());

function newTable() {
  const name = H.getName(); if (!name) return;
  if (H.coin <= 0) { H.toast('엽전이 없어요. 처음 화면에서 엽전을 받아요.', 2200); return; }
  S = { players: [{ name, ai: 0, net: 0 }, { name: AI[0].name, ai: H.level, av: AI[0].av, net: 0 }, { name: AI[1].name, ai: H.level, av: AI[1].av, net: 0 }], dealer: Math.random() * 3 | 0, pot: 0, hand: 0 };
  show('sutda');
  startHand(false);
}
$('sutdaBtn').onclick = newTable;

async function startHand(regame) {
  const my = ++token;
  clearTimeout(aiT);
  const st = S;
  if (!regame) {
    st.hand++; st.dealer = (st.dealer + 1) % 3; st.pot = 0; st.ante = H.stake * 10; st.start = H.coin;
    st.players.forEach(p => { p.fold = false; p.paid = 0; });
  }
  st.players.forEach(p => { p.cards = []; p.bet = 0; p.acted = false; p.last = ''; p.peeled = !!p.ai; p.e = null; p.tag = ''; p.won = false; p.open = false; });
  st.maxBet = 0; st.raises = 0; st.phase = 'deal'; st.turn = -1; st.res = null; st.regame = regame;
  render();
  setStatus(regame ? '<b>재경기!</b> 판돈은 그대로, 패를 다시 받아요' : '판돈을 걸어요');
  // 기본 판돈
  if (!regame) {
    for (let i = 0; i < 3; i++) {
      const p = st.players[i];
      const a = i === ME ? Math.min(st.ante, H.coin) : st.ante;
      pay(i, a, false);
      flyCoins(seatEl(i), $('sdPile'), 4, 40);
      await sleep(160); if (my !== token) return;
    }
    beep('coin');
    await sleep(450); if (my !== token) return;
  }
  // 패 나누기
  const deck = shuffle(DECK.slice());
  const order = [1, 2, 0].map(k => (st.dealer + k) % 3).filter(i => !st.players[i].fold);
  for (let round = 0; round < 2; round++) {
    for (const i of order) {
      st.players[i].cards.push(deck.pop());
      render(); dealFx(i, round);
      await sleep(170); if (my !== token) return;
    }
  }
  st.players.forEach(p => { if (p.cards.length === 2) p.e = evalH(p.cards[0], p.cards[1]); });
  st.phase = 'bet';
  st.turn = (order[0] + 2) % 3;
  render();
  next();
}
function pay(i, a, fx = true) {
  const p = S.players[i];
  a = Math.max(0, Math.round(a));
  if (i === ME) { a = Math.min(a, H.coin); H.setCoin(H.coin - a); }
  p.paid += a; S.pot += a;
  if (fx) flyCoins(seatEl(i), $('sdPile'), Math.min(10, 3 + Math.round(Math.log10(Math.max(10, a)))), 45);
  bumpPot();
  return a;
}

// ---------- 걸기 ----------
function options(i) {
  const st = S, p = st.players[i], toCall = st.maxBet - p.bet, cap = i === ME ? p.bet + H.coin : capTotal();
  const o = [];
  const canRaise = st.raises < 5;
  const add = (t, label, total) => { total = Math.min(total, cap); if (total <= st.maxBet && t !== 'call' && t !== 'check') return; o.push({ t, label, amt: Math.max(0, total - p.bet) }); };
  if (toCall <= 0) {
    o.push({ t: 'check', label: '체크', amt: 0 });
    if (canRaise) { add('ppying', '삥', st.maxBet + roundU(st.ante)); add('half', '하프', st.maxBet + roundU(st.pot / 2)); }
  } else {
    o.push({ t: 'call', label: '콜', amt: Math.min(toCall, cap - p.bet) });
    if (canRaise) { add('half', '하프', st.maxBet + roundU((st.pot + toCall) / 2)); add('ddadang', '따당', st.maxBet * 2); }
  }
  o.push({ t: 'die', label: '다이', amt: 0 });
  return o;
}
async function act(i, t) {
  const st = S; if (!st || st.phase !== 'bet' || st.turn !== i) return;
  const op = options(i).find(x => x.t === t); if (!op) return;
  const p = st.players[i];
  p.last = op.label;
  if (t === 'die') { p.fold = true; beep('ppuk'); }
  else if (op.amt > 0) {
    pay(i, op.amt); p.bet += op.amt;
    if (p.bet > st.maxBet) { st.maxBet = p.bet; st.raises++; st.players.forEach((q, k) => { if (k !== i) q.acted = false; }); }
    if (t === 'ddadang') { beep('go'); flash('red'); slam(centerOf($('sdPot')), 1.6, $('sdMid')); }
    else if (t === 'half') { beep('go'); slam(centerOf($('sdPot')), 1, $('sdMid')); }
    else beep('coin');
  } else beep('flip');
  p.acted = true;
  bubbleAt(i, op.label + (op.amt ? ` ${fmt(op.amt)}냥` : ''));
  render();
  next();
}
function next() {
  const st = S;
  const lv = live();
  if (lv.length === 1) { st.phase = 'show'; render(); setTimeout(() => showdown(true), 700); return; }
  const pending = k => !st.players[k].fold && !(st.players[k].acted && st.players[k].bet === st.maxBet) && !(k === ME && H.coin <= 0 && st.players[k].bet < st.maxBet && st.players[k].acted);
  for (let d = 1; d <= 3; d++) {
    const k = (st.turn + d) % 3;
    if (d === 3 && !pending(k)) break;
    if (pending(k)) { st.turn = k; render(); if (st.players[k].ai) aiTurn(k); return; }
  }
  // 모두 맞췄으면 패를 열어요
  st.phase = 'show'; st.turn = -1; render();
  setTimeout(() => showdown(false), 600);
}
function aiTurn(i) {
  const my = token;
  clearTimeout(aiT);
  aiT = setTimeout(() => {
    if (my !== token || !S || S.turn !== i || S.phase !== 'bet') return;
    act(i, aiDecide(i));
  }, rnd(800, 1500));
}
function aiDecide(i) {
  const st = S, p = st.players[i], o = options(i), has = t => o.some(x => x.t === t);
  const lv = p.ai || 2, noise = lv === 1 ? .28 : lv === 2 ? .16 : .08;
  let r = power(p.e) + rnd(-noise, noise);
  if (Math.random() < (lv === 3 ? .1 : .07)) r += .3;            // 가끔 허세
  const toCall = st.maxBet - p.bet;
  if (toCall <= 0) {
    if (r > .86 && has('half')) return 'half';
    if (r > .62 && has('ppying')) return 'ppying';
    return 'check';
  }
  const odds = toCall / (st.pot + toCall);
  if (r < odds * .9 + .18) return 'die';
  if (r > .9 && has('ddadang') && Math.random() < .55) return 'ddadang';
  if (r > .78 && has('half')) return 'half';
  return 'call';
}

// ---------- 패 열기 ----------
async function showdown(solo) {
  const my = token, st = S;
  const lv = st.players.map((p, i) => ({ p, i })).filter(x => !x.p.fold);
  if (!solo) {
    setStatus('<b>패를 엽니다!</b>');
    for (const x of lv) {
      if (x.i === ME) { x.p.peeled = true; }
      x.p.open = true; x.p.tag = x.p.e.n;
      render();
      const c = seatEl(x.i).querySelector('.sd-cards, .sd-hand');
      if (c) { const at = centerOf(c); slam(at, x.p.e.s >= 800 ? 1.6 : 1, $('sdMid')); if (x.p.e.s >= 800) sparkle(at, 10); }
      beep(x.p.e.s >= 800 ? 'match' : 'tak');
      await sleep(850); if (my !== token) return;
    }
  }
  let res = solo ? { win: [lv[0].i] } : judge(lv.map(x => ({ i: x.i, e: x.p.e })));
  if (res.regame) {
    const by = st.players[res.by];
    bigPop(by.e.n + '!', 'red', '재경기예요'); beep('shake'); flash('mint');
    await sleep(1800); if (my !== token) return;
    startHand(true); return;
  }
  st.phase = 'end'; st.res = res;
  const wins = res.win, share = Math.floor(st.pot / wins.length);
  const wName = wins.map(k => k === ME ? '내' : st.players[k].name).join(', ');
  const wp = st.players[wins[0]];
  if (!solo) {
    const tx = res.special || wp.e.n;
    bigPop(tx + '!', 'red', `${wins.includes(ME) && wins.length === 1 ? '내가' : wName + (wins.length > 1 ? ' 함께' : '이(가)')} 이겼어요`);
    beep('stop'); flash('gold');
  }
  wins.forEach(k => { st.players[k].won = true; });
  render();
  await sleep(solo ? 200 : 900); if (my !== token) return;
  wins.forEach(k => flyCoins($('sdPile'), seatEl(k), 12, 55));
  if (wins.includes(ME)) H.setCoin(H.coin + share);
  st.pot = 0; bumpPot();
  setTimeout(() => { beep('coin'); }, 700);
  st.net = H.coin - st.start;
  st.players.forEach((p, k) => { p.net += (wins.includes(k) ? share : 0) - p.paid; });
  if (wins.includes(ME)) { try { KBGM.jingle(); } catch (e) {} beep('win'); } else beep('lose');
  await sleep(900); if (my !== token) return;
  coinCount();
  render();
}

// ---------- 화면 ----------
function seatEl(i) { return i === ME ? $('sdMe') : document.querySelector(`#sdOpps .seat[data-i="${i}"]`); }
function centerOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.min(r.width, 120) }; }
function setStatus(h) { $('sdStatus').innerHTML = h; }
let potShown = 0;
function bumpPot() {
  const n = $('sdPotN'); n.textContent = `${fmt(S.pot)}냥`;
  n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump');
  // 엽전 더미
  const want = Math.min(30, Math.ceil(Math.log2(1 + S.pot / unit()) * 3));
  const pile = $('sdPile');
  while (pile.children.length < want) { const c = document.createElement('i'); c.className = 'yp'; const k = pile.children.length; c.style.left = `${50 + Math.cos(k * 2.4) * (8 + k * 1.6)}%`; c.style.top = `${60 - (k % 6) * 6 + Math.sin(k * 1.7) * 10}%`; c.style.transform = 'translate(-50%,-50%)'; pile.appendChild(c); }
  while (pile.children.length > want) pile.lastChild.remove();
  potShown = S.pot;
}
function flyCoins(fromEl, toEl, n, step) {
  if (!fromEl || !toEl) return;
  const fr = fromEl.getBoundingClientRect(), tr = toEl.getBoundingClientRect();
  for (let k = 0; k < n; k++) {
    const c = document.createElement('i'); c.className = 'flycoin'; c.innerHTML = YP;
    const x0 = fr.left + fr.width * (.3 + Math.random() * .4), y0 = fr.top + fr.height * (.3 + Math.random() * .4);
    const x1 = tr.left + tr.width * (.3 + Math.random() * .4), y1 = tr.top + tr.height * (.3 + Math.random() * .4);
    c.style.left = x0 + 'px'; c.style.top = y0 + 'px'; document.body.appendChild(c);
    const mx = (x0 + x1) / 2 + rnd(-60, 60), my = Math.min(y0, y1) - rnd(30, 90);
    c.animate([{ transform: 'translate(0,0) scale(.6)', opacity: 0 }, { offset: .2, opacity: 1 }, { offset: .6, transform: `translate(${mx - x0}px,${my - y0}px) scale(1)` }, { transform: `translate(${x1 - x0}px,${y1 - y0}px) scale(.7)`, opacity: .9 }],
      { duration: 600, delay: k * step, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'both' }).onfinish = () => { c.remove(); if (k % 3 === 0) beep('coin'); };
  }
}
function dealFx(i, round) {
  const el = seatEl(i); if (!el) return;
  const cards = el.querySelectorAll('.sd-cards .ht, .sd-hand > *');
  const c = cards[round]; if (!c) return;
  const pr = $('sdPot').getBoundingClientRect(), cr = c.getBoundingClientRect();
  c.animate([{ transform: `translate(${pr.left + pr.width / 2 - cr.left - cr.width / 2}px,${pr.top - cr.top}px) scale(.5) rotate(-20deg)`, opacity: .3 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.3,.7,.4,1)' });
  beep('swoosh');
}
function bubbleAt(i, text) {
  const s = seatEl(i); if (!s) return;
  const b = document.createElement('div'); b.className = 'bubble' + (i === ME ? ' up' : ''); b.textContent = text;
  s.appendChild(b); setTimeout(() => b.remove(), 1900);
}
function avatar(i) {
  const p = S.players[i];
  if (p.ai) return `<span class="av ai"><img src="../cards/img/${p.av}.png" alt=""></span>`;
  return `<span class="av" style="background:${PAL[0]}">${esc((p.name || '?').slice(0, 1))}</span>`;
}
function render() {
  const st = S; if (!st) return;
  // 상대
  $('sdOpps').innerHTML = [1, 2].map(i => {
    const p = st.players[i];
    const cards = p.cards.map(id => p.open ? cardH(id) : backH()).join('');
    return `<div class="seat ${st.turn === i ? 'turn' : ''} ${p.fold ? 'fold' : ''}" data-i="${i}">
      <div class="top">${avatar(i)}<span class="nm">${esc(p.name)}</span>${p.fold ? '<span class="pt">다이</span>' : ''}<span class="sd-bet" style="margin-left:auto">${p.paid ? `건 돈 ${fmt(p.paid)}냥` : ''}</span></div>
      <div class="sd-cards">${cards}</div>${p.tag ? `<span class="sd-tag ${p.won ? 'win' : ''}">${esc(p.tag)}</span>` : ''}</div>`;
  }).join('');
  // 나
  const m = meP();
  $('sdMe').classList.toggle('turn', st.turn === ME);
  $('sdMe').classList.toggle('fold', !!m.fold);
  $('sdMeAv').outerHTML = `<span class="av" id="sdMeAv" style="background:${PAL[0]}">${esc((m.name || '?').slice(0, 1))}</span>`;
  $('sdMeName').textContent = m.name;
  $('sdMeBet').textContent = m.paid ? `건 돈 ${fmt(m.paid)}냥` : '';
  if (!counting) $('sdCoin').innerHTML = `${YP}${fmt(H.coin)}냥`;
  const hand = $('sdHand');
  const want = m.cards.map((id, k) => `${id}:${k === 1 && !m.peeled ? 'p' : 'o'}`).join(',');
  if (hand.dataset.k !== want) {
    hand.dataset.k = want;
    hand.innerHTML = m.cards.map((id, k) => k === 1 && !m.peeled
      ? `<div class="peel ht-wrap hint" id="sdPeel" style="--w:var(--pw)">${cardH(id)}<div class="cover"></div><span class="peel-tip">밀어 올려 쪼기</span></div>`
      : cardH(id)).join('');
    const pe = $('sdPeel'); if (pe) setupPeel(pe);
    sizePeel();
  }
  const hn = $('sdHName');
  if (m.cards.length === 2 && m.peeled && m.e) { hn.textContent = m.e.n; hn.classList.toggle('top', m.e.s >= 701 || m.e.tj || m.e.ah); }
  else if (m.cards.length) { hn.textContent = `${MON(m.cards[0])}월`; hn.classList.remove('top'); }
  else hn.textContent = '';
  if (m.won && st.phase === 'end') hn.classList.add('top');
  // 버튼
  let h = '';
  if (st.phase === 'bet' && st.turn === ME) {
    if (!m.peeled) { h = ''; setStatus('<b>내 차례</b> · 먼저 두 번째 패를 쪼아 봐요'); }
    else {
      const o = options(ME);
      const cls = { check: 'btn-sky', ppying: 'btn-mint', call: 'btn-sky', half: 'btn-info', ddadang: 'btn-primary', die: 'btn-secondary' };
      h = o.map((x, k) => `<button class="game-btn ${cls[x.t]}" data-t="${x.t}"><span>${x.label}</span><small>${x.amt ? fmt(x.amt) + '냥' : x.t === 'die' ? '포기' : '그냥 넘기기'}</small><span class="kn">${k + 1}</span></button>`).join('');
      setStatus(`<b>내 차례</b>${st.maxBet - m.bet > 0 ? ` · 따라가려면 ${fmt(st.maxBet - m.bet)}냥` : ''}`);
    }
  } else if (st.phase === 'bet') {
    if (st.turn >= 0) setStatus(`${esc(st.players[st.turn].name)} 차례<span class="dots"></span>`);
  } else if (st.phase === 'end') {
    const net = st.net;
    if (net != null) setStatus(net >= 0 ? `<b>+${fmt(net)}냥</b> 땄어요` : `<b>${fmt(-net)}냥</b> 잃었어요`);
    const broke = H.coin <= 0, canRefill = broke && H.store('hwatu-refill') !== H.today();
    h = '<button class="game-btn btn-secondary" data-t="quit">그만하기</button>' +
      (!broke ? '<button class="game-btn btn-primary" data-t="next">다음 판</button>' : canRefill ? `<button class="game-btn btn-primary" data-t="refill">엽전 ${fmt(H.REFILL)}냥 받고 다음 판</button>` : '');
    if (broke && !canRefill) setStatus('엽전이 다 떨어졌어요. 내일 다시 받을 수 있어요.');
  }
  if (st.phase !== 'end' && !(st.phase === 'bet' && st.turn === ME)) h = h || '<button class="game-btn btn-secondary" data-t="quit">그만하기</button>';
  $('sdActs').innerHTML = h;
}
function sizePeel() {
  const c = $('sdHand').querySelector('.ht:not(.peel .ht)') || $('sdHand').querySelector('.ht');
  const pe = $('sdPeel'); if (!pe || !c) return;
  const w = c.getBoundingClientRect().width || 100;
  pe.style.width = w + 'px'; pe.style.height = w * 1.3333 + 'px';
  const inner = pe.querySelector('.ht'); inner.style.setProperty('--w', w + 'px');
}
addEventListener('resize', () => { if (S) sizePeel(); });
$('sdActs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const t = b.dataset.t;
  if (t === 'quit') { H.confirmBox('그만할까요?', S && S.phase === 'bet' && !meP().fold ? '지금 판은 다이로 끝나요.' : '처음 화면으로 돌아가요.', '그만하기', quit); return; }
  if (t === 'next') { startHand(false); return; }
  if (t === 'refill') { if (H.refill()) startHand(false); return; }
  act(ME, t);
});
function quit() { token++; clearTimeout(aiT); S = null; H.hideModals(); show('startScreen'); }

// ---------- 쪼기 ----------
let counting = false;
function setupPeel(pe) {
  const cover = pe.querySelector('.cover');
  let y0 = null, p = 0, lastStep = 0, done = false, moved = false;
  const setP = v => {
    p = Math.max(0, Math.min(1, v));
    cover.style.transform = `translateY(${-p * 100}%) rotate(${-p * 7}deg)`;
    const stp = Math.floor(p * 10); if (stp > lastStep) { lastStep = stp; beep('tick'); }
    if (p > .58 && !done) finish();
  };
  const finish = () => {
    done = true; pe.classList.remove('hint');
    cover.animate([{ transform: cover.style.transform }, { transform: 'translateY(-115%) rotate(-12deg)' }], { duration: 220, fill: 'forwards' }).onfinish = () => {
      const m = meP(); if (!m) return;
      m.peeled = true;
      beep('flip');
      const at = centerOf(pe);
      if (m.e && (m.e.s >= 800)) { bigPop(m.e.n + '!', 'red', '', ''); flash('gold'); sparkle(at, 12); beep('ttadak'); }
      else if (m.e && (m.e.s >= 701 || m.e.tj || m.e.ah)) { sparkle(at, 8); beep('jjok'); }
      else if (m.e && m.e.s === 500) beep('ppuk');
      render();
    };
  };
  pe.addEventListener('pointerdown', e => { if (done) return; y0 = e.clientY; moved = false; pe.setPointerCapture(e.pointerId); pe.classList.remove('hint'); });
  pe.addEventListener('pointermove', e => { if (y0 == null || done) return; const h = pe.getBoundingClientRect().height; const v = (y0 - e.clientY) / h; if (Math.abs(v) > .03) moved = true; setP(v); });
  const up = () => {
    if (y0 == null || done) return; y0 = null;
    if (!moved) { auto(); return; }
    const from = p; cover.animate([{ transform: cover.style.transform }, { transform: 'translateY(0) rotate(0)' }], { duration: 260, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    setP(0); lastStep = 0; if (from > .1) beep('swoosh');
  };
  pe.addEventListener('pointerup', up); pe.addEventListener('pointercancel', up);
  // 누르기만 하면 천천히 스윽 올라가요
  let autoing = false;
  const auto = () => {
    if (autoing || done) return; autoing = true;
    const steps = [[.18, 380], [.3, 520], [.42, 700], [.62, 520]];
    let k = 0;
    const go = () => {
      if (done) return;
      const [to, d] = steps[k++]; const fromP = p, t0 = performance.now();
      const f = t => { const q = Math.min(1, (t - t0) / d); setP(fromP + (to - fromP) * q); if (q < 1 && !done) requestAnimationFrame(f); else if (!done && k < steps.length) setTimeout(go, 160); };
      requestAnimationFrame(f);
    };
    go();
  };
  pe._auto = auto;
}
function coinCount() {
  const el = $('sdCoin'), m = S; if (!el || !m) return;
  const to = H.coin, from = m.start - meP().paid;
  counting = true; el.classList.remove('up', 'down'); void el.offsetWidth; el.classList.add(to >= from ? 'up' : 'down');
  const t0 = performance.now(), D = 800;
  const f = t => { const q = Math.min(1, (t - t0) / D); el.innerHTML = `${YP}${fmt(from + (to - from) * (1 - Math.pow(1 - q, 3)))}냥`; if (q < 1) requestAnimationFrame(f); else counting = false; };
  requestAnimationFrame(f);
}

// ---------- 키보드 ----------
addEventListener('keydown', e => {
  if (!S || $('sutda').classList.contains('hidden')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if ([...document.querySelectorAll('.modal')].some(m => !m.classList.contains('hidden'))) return;
  const m = meP();
  if ((e.key === ' ' || e.key === 'Enter') && m && !m.peeled && m.cards.length === 2) { e.preventDefault(); const pe = $('sdPeel'); if (pe && pe._auto) pe._auto(); return; }
  const btns = [...$('sdActs').querySelectorAll('button')];
  if (/^[1-9]$/.test(e.key) && S.phase === 'bet' && S.turn === ME) { const b = btns[+e.key - 1]; if (b) { e.preventDefault(); b.click(); } return; }
  if (e.key === 'Enter' && S.phase === 'end') { const b = btns.find(x => x.dataset.t === 'next' || x.dataset.t === 'refill'); if (b) { e.preventDefault(); b.click(); } }
});

window.__sd = { get S() { return S; }, evalH, judge, act, newTable };
})();
