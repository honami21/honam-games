// 깨비의 꽃들의 전쟁: 섯다 (두 장 승부, 깨비 둘과 셋이)
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
// 족보 이름 글자 그림 (img/sd-*.webp 가 있으면 그림으로)
const JBN = { '38광땡': '38gwang', '18광땡': '18gwang', '13광땡': '13gwang', '장땡': 'jangddang', '삥땡': 'bbingddang', '알리': 'ali', '독사': 'doksa', '구삥': 'gubbing', '장삥': 'jangbbing', '장사': 'jangsa', '세륙': 'seryuk', '갑오': 'gabo', '망통': 'mangtong', '땡잡이': 'ddangjabi', '암행어사': 'amhaeng', '구사': 'gusa', '멍텅구리 구사': 'mgusa' };
const JBC = n => 'sd-' + (JBN[n] || (/^(\d)땡$/.test(n) ? 'ddang' + n[0] : /^(\d)끗$/.test(n) ? 'kkut' + n[0] : 'x'));
const JBA = {};
const JBI = n => { const c = JBC(n); return JBA[c] ? `img/${c}.webp` : ''; };
let SDWIN = false; { const im = new Image(); im.onload = () => { SDWIN = true; }; im.src = 'img/ggaebi-sdwin.webp'; }   // 섯다용 깨비 승리 그림 (스톱 글자 없는 것)
[...Object.values(JBN), ...[2, 3, 4, 5, 6, 7, 8, 9].map(k => 'ddang' + k), ...[1, 2, 3, 4, 5, 6, 7, 8].map(k => 'kkut' + k), ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(k => 'm' + k), 'draw'].forEach(c => { const im = new Image(); im.onload = () => { JBA['sd-' + c] = true; }; im.src = `img/sd-${c}.webp`; });
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
// 판돈 나누기: 이긴 사람(w)은 자기가 건 만큼까지만 각자에게서 받아요.
// 그보다 더 건 돈은 낸 사람에게 그대로 돌려줘요 (엽전이 모자라 다 건 사람이 이겼을 때).
// list: [{ i, c(이번 판에 넣은 돈) }] → 사람마다 받는 돈
function splitPot(list, w) {
  const pay = {}; list.forEach(x => { pay[x.i] = 0; });
  const cw = (list.find(x => x.i === w) || { c: 0 }).c;
  list.forEach(x => { pay[w] += Math.min(x.c, cw); pay[x.i] += Math.max(0, x.c - cw); });
  return pay;
}
// 깨비가 보는 패의 힘 (0~1)
function power(e) {
  if (e.s >= 1000) return 1; if (e.s >= 890) return .97; if (e.s === 810) return .95;
  if (e.s > 800) return .78 + (e.s - 800) * .018;
  if (e.s >= 701) return .62 + (e.s - 701) * .02;
  if (e.tj) return .5; if (e.ah) return .45; if (e.gs) return .46;
  const k = e.s - 500; return .08 + k * .055;
}

// 한 장만 보고 매기는 힘 (첫 번째 베팅)
function power1(id) {
  const m = MON(id);
  if (isG(id)) return m === 3 ? .7 : .64;
  if (m === 10) return .6; if (m === 1) return .55;
  return .2 + m * .035 + (isY(id) ? .04 : 0);
}
// 땡값: 땡으로 이기면 나머지가 기본 판돈의 몇 배를 더 내요
const ttMul = s => s >= 1000 ? 5 : s >= 890 ? 3 : s === 810 ? 2 : s >= 801 ? 1 : 0;

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
  OL = null;
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
    st.hand++; if (st.lastWin != null) st.dealer = st.lastWin; st.pot = 0; st.ante = H.stake * 10; st.start = H.coin;
    st.players.forEach(p => { p.fold = false; p.out = false; p.paid = 0; p.tt = 0; });
  }
  st.players.forEach(p => { p.cards = []; p.bet = 0; p.acted = false; p.last = ''; p.peeled = !!p.ai; p.e = null; p.tag = ''; p.won = false; p.open = false; });
  H.setTrack('play'); if (regame) beep('tense');
  st.maxBet = 0; st.raises = 0; st.phase = 'deal'; st.turn = -1; st.res = null; st.regame = regame; st.round = 1; st.sun = null;
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
  // 패 나누기: 한 장씩 받고 걸고, 한 장 더 받고 또 걸어요
  st.deck = shuffle(DECK.slice());
  await dealRound(my, 0);
}
async function dealRound(my, round) {
  const st = S;
  st.phase = 'deal'; st.turn = -1; st.round = round + 1;
  if (round) setStatus('<b>두 번째 패</b>를 받아요');
  const order = [1, 2, 0].map(k => (st.dealer + k) % 3).filter(i => !st.players[i].fold);
  for (const i of order) {
    st.players[i].cards.push(st.deck.pop());
    render(); dealFx(i, round);
    await sleep(190); if (my !== token) return;
  }
  st.players.forEach(p => { if (p.cards.length === 2) p.e = evalH(p.cards[0], p.cards[1]); });
  // 걸기는 선부터 (선이 다이했으면 선 다음 사람)
  st.players.forEach(p => { p.bet = 0; p.acted = false; });
  st.maxBet = 0; st.raises = 0;
  st.sun = [0, 1, 2].map(k => (st.dealer + k) % 3).find(i => !st.players[i].fold);
  st.phase = 'bet';
  st.turn = (st.sun + 2) % 3;
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
    // 체크·삥은 선만 할 수 있어요. 선이 체크하면 다른 사람도 체크로 따라갈 수 있어요.
    o.push({ t: 'check', label: '체크', amt: 0 });
    if (canRaise) { if (i === st.sun) add('ppying', '삥', st.maxBet + roundU(st.ante)); add('half', '하프', st.maxBet + roundU(st.pot / 2)); }
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
    if (p.bet > st.maxBet) { st.maxBet = p.bet; st.raises++; if (st.raises === 2) beep('tense'); st.players.forEach((q, k) => { if (k !== i) q.acted = false; }); }
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
  // 모두 맞췄으면 첫 번째 걸기 뒤엔 한 장 더, 두 번째 걸기 뒤엔 패를 열어요
  st.turn = -1;
  if (st.round === 1) { st.phase = 'deal'; render(); const my = token; setTimeout(() => { if (my === token && S === st) dealRound(my, 1); }, 600); return; }
  st.phase = 'show'; render();
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
  let r = (st.round === 1 || !p.e ? power1(p.cards[0]) : power(p.e)) + rnd(-noise, noise);
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
    bigPop(by.e.n + '!', 'red', '재경기예요', JBI(by.e.n)); beep('shake'); flash('mint');
    await sleep(1800); if (my !== token) return;
    startHand(true); return;
  }
  if (res.win.length > 1) {   // 비기면 판돈은 그대로, 비긴 사람끼리 다시 해요
    st.players.forEach((p, k) => { if (!p.fold && !res.win.includes(k)) { p.fold = true; p.out = true; } });
    setStatus('');
    bigPop('무승부!', 'mint', '비긴 사람끼리 재경기예요', JBA['sd-draw'] ? 'img/sd-draw.webp' : ''); beep('shake'); flash('mint');
    await sleep(1800); if (my !== token) return;
    startHand(true); return;
  }
  st.phase = 'end'; st.res = res; st.lastWin = res.win[0];
  const wins = res.win;
  const pay = splitPot(st.players.map((p, i) => ({ i, c: p.paid })), wins[0]);
  const wName = wins.map(k => k === ME ? '내' : st.players[k].name).join(', ');
  const wp = st.players[wins[0]];
  // 땡값: 땡으로 이기면 다른 사람 모두(다이한 사람도)에게 기본 판돈의 몇 배를 더 받아요
  const w = wins[0], mul = !solo && !res.special ? ttMul(wp.e.s) : 0;
  let ttSum = 0;
  if (mul) {
    st.players.forEach((p, k) => {
      if (k === w) return;
      let a = st.ante * mul;
      if (k === ME) { a = Math.min(a, H.coin); H.setCoin(H.coin - a); }
      p.tt -= a; ttSum += a;
    });
    wp.tt += ttSum;
    if (w === ME) H.setCoin(H.coin + ttSum);
  }
  if (!solo) {
    const tx = res.special || wp.e.n;
    bigPop(tx + '!', 'red', `${w === ME ? '내가' : wName + '이(가)'} 이겼어요${mul ? ` · 땡값 ${fmt(ttSum)}냥` : ''}`, JBI(tx));
    beep('stop'); flash('gold');
  }
  wins.forEach(k => { st.players[k].won = true; });
  render();
  await sleep(solo ? 200 : 900); if (my !== token) return;
  st.players.forEach((p, k) => { if (pay[k] > 0) flyCoins($('sdPile'), seatEl(k), k === w ? 12 : 6, 55); });
  if (mul) st.players.forEach((p, k) => { if (k !== w) flyCoins(seatEl(k), seatEl(w), 5, 60); });
  if (pay[ME]) H.setCoin(H.coin + pay[ME]);
  st.pot = 0; bumpPot();
  setTimeout(() => { beep('coin'); }, 700);
  st.net = H.coin - st.start;
  st.players.forEach((p, k) => { p.net += pay[k] - p.paid + p.tt; });
  if (wins.includes(ME)) beep('win'); else beep('lose');   // 판 끝 깨비 그림은 뺐어요
  H.setTrack('play');
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
  return `<span class="av" style="background:${PAL[S.online ? i % PAL.length : 0]}">${esc((p.name || '?').slice(0, 1))}</span>`;
}
function render() {
  const st = S; if (!st) return;
  // 상대
  $('sdOpps').innerHTML = [1, 2].filter(i => st.players[i]).map(i => {
    const p = st.players[i];
    const cards = p.cards.map(id => p.open ? cardH(id) : backH()).join('');
    return `<div class="seat ${st.turn === i ? 'turn' : ''} ${p.fold ? 'fold' : ''}" data-i="${i}">
      <div class="top">${avatar(i)}<span class="nm">${esc(p.name)}</span>${(st.sun ?? st.dealer) === i ? '<span class="pt sun">선</span>' : ''}${p.fold ? `<span class="pt">${p.out ? '구경' : '다이'}</span>` : ''}<span class="sd-bet" style="margin-left:auto">${p.paid ? `건 돈 ${fmt(p.paid)}냥` : ''}</span></div>
      <div class="sd-cards">${cards}</div>${p.tag ? `<span class="sd-tag ${p.won ? 'win' : ''}">${esc(p.tag)}</span>` : ''}</div>`;
  }).join('');
  // 나
  const m = meP();
  $('sdMe').classList.toggle('turn', st.turn === ME);
  $('sdMe').classList.toggle('fold', !!m.fold);
  $('sdMeAv').outerHTML = `<span class="av" id="sdMeAv" style="background:${PAL[0]}">${esc((m.name || '?').slice(0, 1))}</span>`;
  $('sdMeName').innerHTML = esc(m.name) + ((st.sun ?? st.dealer) === ME ? ' <span class="pt sun">선</span>' : '');
  $('sdMeBet').textContent = m.paid ? `건 돈 ${fmt(m.paid)}냥` : '';
  if (!counting) $('sdCoin').innerHTML = `${YP}${fmt(H.coin)}냥`;
  const hand = $('sdHand');
  const want = m.cards.map((id, k) => `${id}:${k === 1 && !m.peeled ? 'p' : 'o'}`).join(',');
  if (hand.dataset.k !== want) {
    hand.dataset.k = want;
    hand.innerHTML = st.watch ? m.cards.map(() => backH()).join('') : m.cards.map((id, k) => k === 1 && !m.peeled
      ? `<div class="peel ht-wrap hint" id="sdPeel" style="--w:var(--pw)">${cardH(id)}<div class="cover"></div><span class="peel-tip">밀어 올려 쪼기</span></div>`
      : cardH(id)).join('');
    const pe = $('sdPeel'); if (pe) setupPeel(pe);
    sizePeel();
  }
  const hn = $('sdHName');
  if (m.cards.length === 2 && m.peeled && m.e) { const c = JBC(m.e.n); if (JBA[c]) hn.innerHTML = `<img src="img/${c}.webp" alt="${esc(m.e.n)}">`; else hn.textContent = m.e.n; hn.classList.toggle('top', m.e.s >= 701 || m.e.tj || m.e.ah); }
  else if (m.cards.length) { const mo = MON(m.cards[0]); if (JBA['sd-m' + mo]) hn.innerHTML = `<img src="img/sd-m${mo}.webp" alt="${mo}월">`; else hn.textContent = `${mo}월`; hn.classList.remove('top'); }
  else hn.textContent = '';
  if (m.won && st.phase === 'end') hn.classList.add('top');
  // 버튼
  let h = '';
  if (st.phase === 'bet' && st.turn === ME) {
    if (!m.peeled && m.cards.length === 2) { h = ''; setStatus('<b>내 차례</b> · 먼저 두 번째 패를 쪼아 봐요'); }
    else {
      const o = OL ? SE.options(OL.g, OL.me) : options(ME);
      const cls = { check: 'btn-sky', ppying: 'btn-mint', call: 'btn-sky', half: 'btn-info', ddadang: 'btn-primary', die: 'btn-secondary' };
      h = o.map((x, k) => `<button class="game-btn ${cls[x.t]}" data-t="${x.t}"><span>${x.label}</span><small>${x.amt ? fmt(x.amt) + '냥' : x.t === 'die' ? '포기' : '그냥 넘기기'}</small><span class="kn">${k + 1}</span></button>`).join('');
      setStatus(`<b>내 차례</b>${st.round === 1 ? ' · 한 장 보고 걸기' : ''}${st.maxBet - m.bet > 0 ? ` · 따라가려면 ${fmt(st.maxBet - m.bet)}냥` : ''}`);
    }
  } else if (st.phase === 'bet') {
    if (st.turn >= 0) setStatus(`${esc(st.players[st.turn].name)} 차례<span class="dots"></span>`);
  } else if (st.phase === 'end') {
    const net = st.net;
    if (net != null) setStatus(net >= 0 ? `<b>+${fmt(net)}냥</b> 땄어요` : `<b>${fmt(-net)}냥</b> 잃었어요`);
    const broke = H.coin <= 0, canRefill = broke && H.store('hwatu-refill') !== H.today();
    if (OL) {   // 방 대결: 다음 판은 방장이 열어요
      const host = H.online.role === 'host';
      if (OL.g.res && OL.g.res.none) setStatus('함께할 사람이 모자라요. 엽전이 있는 사람이 둘 이상이어야 해요.');
      h = '<button class="game-btn btn-secondary" data-t="quit">나가기</button>' + (host ? '<button class="game-btn btn-secondary" data-t="lobby">대기실로</button><button class="game-btn btn-primary" data-t="next">다음 판</button>' : '');
      if (!host && !(OL.g.res && OL.g.res.none)) setStatus(`${net != null ? (net >= 0 ? `<b>+${fmt(net)}냥</b> 땄어요` : `<b>${fmt(-net)}냥</b> 잃었어요`) + ' · ' : ''}방장이 다음 판을 열어요<span class="dots"></span>`);
      $('sdActs').innerHTML = h; return;
    }
    h = '<button class="game-btn btn-secondary" data-t="quit">그만하기</button>' +
      (!broke ? '<button class="game-btn btn-primary" data-t="next">다음 판</button>' : canRefill ? `<button class="game-btn btn-primary" data-t="refill">엽전 ${fmt(H.REFILL)}냥 받고 다음 판</button>` : '');
    if (broke && !canRefill) setStatus('엽전이 다 떨어졌어요. 내일 다시 받을 수 있어요.');
  }
  if (st.phase !== 'end' && !(st.phase === 'bet' && st.turn === ME)) h = h || `<button class="game-btn btn-secondary" data-t="quit">${OL ? '나가기' : '그만하기'}</button>`;
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
  if (OL) {
    if (t === 'quit') { H.online.ask(); return; }
    if (t === 'lobby') { H.online.lobby(); return; }
    if (t === 'next') { olDo(ng => SE.nextHand(ng)); return; }
    olDo(ng => SE.act(ng, OL.me, { t })); return;
  }
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
      m.peeled = true; if (OL) OL.peeled = olKey();
      beep('flip');
      const at = centerOf(pe);
      if (m.e && (m.e.s >= 800)) { bigPop(m.e.n + '!', 'red', '', JBI(m.e.n)); flash('gold'); sparkle(at, 12); beep('ttadak'); }
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

// ============================================================
//  방 대결 (Firebase 방 하나를 맞고·고스톱과 같이 써요)
//  판 상태 g 하나에 모든 것이 들어 있고, 같은 g와 같은 행동이면 누가 계산해도 같은 결과예요.
//  행동 하나마다 g.seq가 1씩 올라가요 (Firestore 규칙이 이걸 확인해요).
// ============================================================
const SE = {};
SE.newGame = (members, stake) => {
  const g = { kind: 'sutda', v: 1, gid: Math.random().toString(36).slice(2, 9), seq: 0, stake, ante: stake * 10, hand: 0, rg: 0,
    dealer: Math.random() * Math.min(3, members.length) | 0, lastWin: null, evs: [],
    players: members.slice(0, 3).map(m => ({ id: m.id, name: m.name, bank: Math.max(0, Math.round(+m.coin || 0)) })) };
  seStart(g, false);
  return g;
};
function seStart(g, regame) {
  const n = g.players.length;
  if (!regame) {
    g.hand++; g.rg = 0; g.res = null; g.pot = 0;
    if (g.lastWin != null) g.dealer = g.lastWin;
    g.players.forEach(p => { p.fold = !!p.left || p.bank <= 0; p.out = p.fold; p.paid = 0; p.tt = 0; p.delta = 0; });
    if (g.players.filter(p => !p.fold).length < 2) { g.phase = 'end'; g.turn = -1; g.res = { none: true }; g.players.forEach(p => { p.cards = []; p.bet = 0; p.last = ''; }); return; }
    g.players.forEach(p => { if (p.fold) return; const a = Math.min(g.ante, p.bank); p.bank -= a; p.paid += a; g.pot += a; });
    g.evs.push({ t: 'ante' });
  } else g.rg++;
  g.players.forEach(p => { p.cards = []; p.bet = 0; p.acted = false; p.last = ''; });
  g.deck = shuffle(DECK.slice()); g.round = 0; g.phase = 'bet';
  seDeal(g);
}
function seDeal(g) {
  const n = g.players.length; g.round++;
  for (let k = 1; k <= n; k++) { const i = (g.dealer + k) % n; if (!g.players[i].fold) g.players[i].cards.push(g.deck.pop()); }
  g.players.forEach(p => { p.bet = 0; p.acted = false; });
  g.maxBet = 0; g.raises = 0;
  for (let k = 0; k < n; k++) { const i = (g.dealer + k) % n; if (!g.players[i].fold) { g.sun = i; break; } }
  g.turn = g.sun;
  if (!sePending(g, g.turn)) seAdvance(g);
}
function sePending(g, k) { const p = g.players[k]; return !p.fold && !(p.acted && (p.bet === g.maxBet || p.bank <= 0)); }
SE.options = (g, i) => {
  const p = g.players[i]; if (!p) return [];
  const toCall = g.maxBet - p.bet, cap = p.bet + p.bank, o = [], canRaise = g.raises < 5;
  const U = Math.max(10, g.stake), rU = v => Math.max(U, Math.round(v / U) * U);
  const add = (t, label, total) => { total = Math.min(total, cap); if (total <= g.maxBet) return; o.push({ t, label, amt: total - p.bet }); };
  if (toCall <= 0) {
    o.push({ t: 'check', label: '체크', amt: 0 });
    if (canRaise) { if (i === g.sun) add('ppying', '삥', g.maxBet + rU(g.ante)); add('half', '하프', g.maxBet + rU(g.pot / 2)); }
  } else {
    o.push({ t: 'call', label: '콜', amt: Math.min(toCall, p.bank) });
    if (canRaise) { add('half', '하프', g.maxBet + rU((g.pot + toCall) / 2)); add('ddadang', '따당', g.maxBet * 2); }
  }
  o.push({ t: 'die', label: '다이', amt: 0 });
  return o;
};
SE.act = (g, who, a) => {
  const p = g.players[who]; if (!p) return 'who';
  g.evs = [];
  if (a.t === 'leave') {
    if (p.left) return 'left';
    p.left = true; g.evs.push({ t: 'leave', who });
    if (g.phase === 'bet' && !p.fold) { p.fold = true; p.last = '나감'; if (g.players.filter(q => !q.fold).length <= 1) seFinish(g, true); else if (g.turn === who) seAdvance(g); }
    g.seq++; return null;
  }
  if (g.phase !== 'bet' || g.turn !== who) return 'turn';
  const op = SE.options(g, who).find(x => x.t === a.t); if (!op) return 'bad';
  p.last = op.label;
  if (a.t === 'die') p.fold = true;
  else if (op.amt > 0) {
    p.bank -= op.amt; p.paid += op.amt; p.bet += op.amt; g.pot += op.amt;
    if (p.bet > g.maxBet) { g.maxBet = p.bet; g.raises++; g.players.forEach((q, k) => { if (k !== who) q.acted = false; }); }
  }
  p.acted = true;
  g.evs.push({ t: 'act', who, k: a.t, label: op.label, amt: op.amt, raises: g.raises });
  seAdvance(g);
  g.seq++; return null;
};
SE.nextHand = g => { if (g.phase !== 'end') return 'phase'; g.evs = []; seStart(g, false); g.seq++; return null; };
function seAdvance(g) {
  const n = g.players.length;
  if (g.players.filter(p => !p.fold).length <= 1) { seFinish(g, true); return; }
  for (let d = 1; d <= n; d++) { const k = (g.turn + d) % n; if (sePending(g, k)) { g.turn = k; return; } }
  if (g.round === 1) { g.evs.push({ t: 'deal2' }); seDeal(g); return; }
  seShow(g);
}
function seShow(g) {
  const lv = g.players.map((p, i) => ({ p, i, e: evalH(p.cards[0], p.cards[1]) })).filter(x => !x.p.fold);
  const res = judge(lv.map(x => ({ i: x.i, e: x.e })));
  const reveal = lv.map(x => ({ i: x.i, c: x.p.cards.slice(), n: x.e.n }));
  if (res.regame || res.win.length > 1) {
    const by = res.regame ? lv.find(x => x.i === res.by).e.n : '';
    if (!res.regame) g.players.forEach((p, k) => { if (!p.fold && !res.win.includes(k)) { p.fold = true; p.out = true; } });
    g.evs.push({ t: 'regame', by, reveal });
    seStart(g, true); return;
  }
  seFinish(g, false, res, reveal);
}
function seFinish(g, solo, res, reveal) {
  const w = solo ? g.players.findIndex(p => !p.fold) : res.win[0], wp = g.players[w];
  const special = (!solo && res.special) || '';
  const e = solo ? null : evalH(wp.cards[0], wp.cards[1]);
  const pot = g.pot;   // 판돈 먼저 나누고(더 건 돈은 돌려주기), 그다음 땡값
  const pay = splitPot(g.players.map((p, i) => ({ i, c: p.paid })), w);
  g.players.forEach((p, k) => { p.bank += pay[k]; });
  let mul = 0, tt = 0;
  if (!solo && !special) {
    mul = ttMul(e.s);
    if (mul) { g.players.forEach((p, k) => { if (k === w || p.left) return; const a = Math.min(g.ante * mul, p.bank); p.bank -= a; p.tt -= a; tt += a; }); wp.tt += tt; wp.bank += tt; }
  }
  g.players.forEach((p, k) => { p.delta = pay[k] - p.paid + p.tt; });
  g.res = { w, solo, special, name: solo ? '' : (special || e.n), mul, tt, pot, reveal: reveal || [] };
  g.pot = 0; g.phase = 'end'; g.turn = -1; g.lastWin = w;
  g.evs.push({ t: 'end' });
}

// ---------- 방 대결 화면 ----------
let OL = null;   // { g, me, peeled, pend, busy }
const olKey = () => OL && OL.g ? `${OL.g.gid}-${OL.g.hand}-${OL.g.rg}` : '';
const olLatest = () => OL && (OL.pend || OL.g);
function olView(g) {
  const n = g.players.length, me = OL.me >= 0 ? OL.me : 0, real = k => (k + me) % n, vi = i => i < 0 ? -1 : (i - me + n) % n;
  const end = g.phase === 'end' && g.res && !g.res.none && !g.res.solo;
  const players = [];
  for (let k = 0; k < n; k++) {
    const i = real(k), p = g.players[i], isMe = k === 0 && OL.me >= 0;
    const shown = end && !p.fold && p.cards.length === 2;
    const e = p.cards.length === 2 && (isMe || shown) ? evalH(p.cards[0], p.cards[1]) : null;
    players.push({ name: p.name + (p.left ? ' (나감)' : ''), ai: 0, net: 0, cards: p.cards.slice(), fold: !!p.fold, out: !!p.out, paid: p.paid || 0, bet: p.bet || 0, acted: !!p.acted, last: p.last || '',
      peeled: isMe ? (p.cards.length < 2 || OL.peeled === olKey() || g.phase === 'end') : true, e, tag: shown && e ? e.n : '', won: g.phase === 'end' && g.res && g.res.w === i, open: shown || isMe });
  }
  const mp = OL.me >= 0 ? g.players[OL.me] : null;
  return { online: true, watch: OL.me < 0, players, pot: g.pot || 0, dealer: vi(g.dealer), sun: g.phase === 'end' ? vi(g.lastWin ?? g.dealer) : vi(g.sun), turn: g.phase === 'bet' ? vi(g.turn) : -1,
    phase: g.phase, round: g.round, maxBet: g.maxBet || 0, ante: g.ante, raises: g.raises, hand: g.hand, regame: g.rg > 0,
    net: g.phase === 'end' && mp && g.res && !g.res.none ? mp.delta : null, start: mp ? mp.bank - (mp.delta || 0) + (mp.paid || 0) : 0 };
}
function olSetCoin(g) { if (OL.me >= 0) { const b = g.players[OL.me].bank; if (b !== H.coin) H.setCoin(b); } }
function olReceive(ng) {
  if (!ng) return;
  const cur = olLatest();
  if (cur && cur.gid === ng.gid && ng.seq <= cur.seq) return;
  OL.pend = ng;
  if (!OL.busy) olRun();
}
async function olRun() {
  OL.busy = true;
  const my = token;
  while (OL && OL.pend) {
    const ng = OL.pend; OL.pend = null;
    try { await olApply(OL.g, ng, my); } catch (e) { console.error(e); OL.g = ng; S = olView(ng); render(); }
    if (my !== token || !OL) return;
  }
  if (OL) { OL.busy = false; S = olView(OL.g); render(); }
}
const vIdx = i => (i - (OL.me >= 0 ? OL.me : 0) + OL.g.players.length) % OL.g.players.length;
async function olApply(old, ng, my) {
  const sameGame = old && old.gid === ng.gid;
  const evs = sameGame && ng.seq === old.seq + 1 ? (ng.evs || []) : [];
  OL.g = ng;
  // 행동 말풍선·소리
  for (const e of evs) {
    if (e.t === 'act') {
      const k = vIdx(e.who);
      if (e.k === 'die') beep('ppuk'); else if (e.k === 'half' || e.k === 'ddadang') { beep('go'); if (e.k === 'ddadang') flash('red'); } else if (e.amt) beep('coin'); else beep('flip');
      if (e.raises === 2 && (e.k === 'half' || e.k === 'ddadang' || e.k === 'ppying')) beep('tense');
      setTimeout(() => bubbleAt(k, e.label + (e.amt ? ` ${fmt(e.amt)}냥` : '')), 30);
      if (e.amt && old) setTimeout(() => flyCoins(seatEl(k), $('sdPile'), Math.min(10, 3 + Math.round(Math.log10(Math.max(10, e.amt)))), 45), 30);
    }
    if (e.t === 'leave') H.toast(`${esc(ng.players[e.who].name)} 님이 나갔어요`, 1800);
    if (e.t === 'regame') {
      // 잠깐 모두의 패를 열어 보여 주고 재경기
      const v = olView(old && old.gid === ng.gid ? old : ng);
      e.reveal.forEach(r => { const p = v.players[vIdx(r.i)]; if (p) { p.cards = r.c; p.open = true; p.tag = r.n; p.peeled = true; p.e = evalH(r.c[0], r.c[1]); } });
      v.phase = 'show'; v.turn = -1; S = v; render(); setStatus('<b>패를 엽니다!</b>');
      await sleep(900); if (my !== token) return;
      setStatus('');
      if (e.by) bigPop(e.by + '!', 'red', '재경기예요', JBI(e.by)); else bigPop('무승부!', 'mint', '비긴 사람끼리 재경기예요', JBA['sd-draw'] ? 'img/sd-draw.webp' : '');
      beep('shake'); flash('mint');
      await sleep(1800); if (my !== token) return;
      beep('tense');
    }
  }
  const prevView = S;
  olSetCoin(ng);
  S = olView(ng); render();
  // 새 판이면 판돈 엽전
  if (!sameGame || !old || old.hand !== ng.hand) {
    if (ng.phase === 'bet') { S.players.forEach((p, k) => { if (p.paid) flyCoins(seatEl(k), $('sdPile'), 4, 40); }); beep('coin'); }
    bumpPot();
  } else if (old.pot !== ng.pot) bumpPot();
  // 새로 받은 패
  const oldN = k => (sameGame && old && old.hand === ng.hand && old.rg === ng.rg) ? ((old.players[(k + (OL.me >= 0 ? OL.me : 0)) % ng.players.length] || {}).cards || []).length : 0;
  for (let round = 0; round < 2; round++) {
    let any = false;
    for (let k = 0; k < S.players.length; k++) if (S.players[k].cards.length > round && oldN(k) <= round) { dealFx(k, round); any = true; await sleep(150); if (my !== token) return; }
    if (any) await sleep(100);
  }
  // 판 끝
  if (ng.phase === 'end' && ng.res && !ng.res.none && (!old || old.phase !== 'end' || old.hand !== ng.hand)) {
    const r = ng.res, wk = vIdx(r.w), meWin = OL.me === r.w;
    if (!r.solo) {
      setStatus('<b>패를 엽니다!</b>');
      for (const x of r.reveal) {
        const k = vIdx(x.i), c = seatEl(k) && seatEl(k).querySelector('.sd-cards, .sd-hand');
        const s0 = evalH(x.c[0], x.c[1]).s;
        if (c) { const at = centerOf(c); slam(at, s0 >= 800 ? 1.6 : 1, $('sdMid')); if (s0 >= 800) sparkle(at, 10); }
        beep(s0 >= 800 ? 'match' : 'tak');
        await sleep(500); if (my !== token) return;
      }
      bigPop(r.name + '!', 'red', `${meWin ? '내가' : esc(ng.players[r.w].name) + ' 님이'} 이겼어요${r.mul ? ` · 땡값 ${fmt(r.tt)}냥` : ''}`, JBI(r.name));
      beep('stop'); flash('gold');
      await sleep(900); if (my !== token) return;
    }
    ng.players.forEach((p, i) => { if (p.delta + p.paid - p.tt > 0) flyCoins($('sdPile'), seatEl(vIdx(i)), i === r.w ? 12 : 6, 55); });
    setTimeout(() => beep('coin'), 700);
    if (OL.me >= 0) { if (meWin) beep('win'); else beep('lose'); }
    S = olView(ng); render();
    if (OL.me >= 0) coinCount();
  }
}
async function olDo(fn) {
  if (!OL || OL.me < 0) return;
  const ng = JSON.parse(JSON.stringify(olLatest()));
  const err = fn(ng);
  if (err) { S = olView(OL.g); render(); return; }
  olReceive(ng);
  H.online.push(ng);
}
const SD = window.SD = {
  newGame: SE.newGame,
  act: (g, i, a) => SE.act(g, i, a),
  onRoom(room) {
    const g = room.g, me = g.players.findIndex(p => p.id === H.online.myId);
    if (!OL || OL.gid !== g.gid) {
      token++; clearTimeout(aiT);
      OL = { g: null, gid: g.gid, me, peeled: '', pend: null, busy: false };
      H.hideModals(); show('sutda');
      $('sdHand').dataset.k = '';
    }
    if ($('sutda').classList.contains('hidden')) show('sutda');
    OL.me = me;
    olReceive(g);
  },
  force(g) { if (!OL) return; OL.pend = null; OL.g = g; olSetCoin(g); S = olView(g); render(); },
  reset() { if (OL) { token++; OL = null; S = null; } },
};

window.__sd = { get S() { return S; }, get OL() { return OL; }, evalH, judge, act, newTable, showdown, SE };
})();
