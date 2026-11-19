// 깨비의 꽃들의 전쟁: 화면, 깨비(컴퓨터), 방 코드 대결
(() => {
'use strict';
const $ = id => document.getElementById(id);
const { MON, kind, worth, scoreOf, canShake, canBomb, fMatch, bestOf, GODORI, HONG, CHEONG, CHO, GWANG } = HT;
const clone = o => JSON.parse(JSON.stringify(o));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
function sstore(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { return null; } }

let myId = store('hwatu-id');
if (!myId) { myId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); store('hwatu-id', myId); }
$('nameInput').value = store('hwatu-name') || store('cards-name') || '';

// 그림 파일이 있으면 씀 (로고, 배경)
const ART = {};
function probe(name, src, fn) { const im = new Image(); im.onload = () => { ART[name] = true; fn && fn(); }; im.src = src; }
probe('logo', 'img/logo.webp', () => { $('logoBox').innerHTML = '<img class="logo" src="img/logo.webp" alt="깨비의 꽃들의 전쟁">'; });
probe('bg', 'img/bg.jpg', () => document.body.classList.add('art'));
const TXT = ['jjok', 'ppuk', 'ttadak', 'sweep', 'go', 'stop', 'shake', 'bomb', 'chongtong', 'nagari', 'pibak'];
TXT.forEach(n => probe('text-' + n, `img/text-${n}.webp`));
['fx-slam', 'fx-sparkle', 'fx-wisp'].forEach(n => probe(n, `img/${n}.webp`));

// ---------- 고르기 ----------
let level = +(store('hwatu-lv') || 2); if (![1, 2, 3].includes(level)) level = 2;
const updLv = () => document.querySelectorAll('#lvSeg button').forEach(b => b.classList.toggle('on', +b.dataset.v === level));
$('lvSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; level = +b.dataset.v; store('hwatu-lv', level); updLv(); });
updLv();

// ---------- 엽전 (기기에 저장, 진짜 돈 아님) ----------
const START_COIN = 10000, REFILL = 5000;
const STAKES = [{ v: 10, min: 0 }, { v: 100, min: 3000 }, { v: 1000, min: 30000 }];
const fmt = n => Math.round(n).toLocaleString('ko-KR');
const YP = '<i class="yp"></i>';
let coin = store('hwatu-coin'); coin = coin == null || isNaN(+coin) ? START_COIN : Math.max(0, +coin);
let stake = +(store('hwatu-stake') || 10); if (!STAKES.some(x => x.v === stake)) stake = 10;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function setCoin(v) { coin = Math.max(0, Math.round(v)); store('hwatu-coin', coin); }
function okStake(v) { const x = STAKES.find(t => t.v === v); return x && coin >= x.min && coin > 0; }
function updStake() {
  if (!okStake(stake)) { const ok = STAKES.filter(t => okStake(t.v)); stake = ok.length ? ok[ok.length - 1].v : 10; }
  $('walletStart').innerHTML = `${YP}${fmt(coin)}냥`;
  $('stakeSeg').innerHTML = STAKES.map(t => `<button data-v="${t.v}" class="${t.v === stake ? 'on' : ''}" ${okStake(t.v) ? '' : 'disabled'}>점당 ${fmt(t.v)}냥<small>${t.min ? fmt(t.min) + '냥부터' : '누구나'}</small></button>`).join('');
  const broke = coin <= 0;
  $('refillBox').classList.toggle('hidden', !broke);
  if (broke) { const used = store('hwatu-refill') === today(); $('refillBtn').disabled = used; $('refillNote').textContent = used ? '오늘은 이미 받았어요. 내일 다시 받을 수 있어요.' : `엽전이 다 떨어졌어요. 하루 한 번 ${fmt(REFILL)}냥을 받을 수 있어요.`; }
  ['cpu2Btn', 'cpu3Btn', 'createBtn', 'joinBtn'].forEach(id => { $(id).disabled = broke; });
}
$('stakeSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; stake = +b.dataset.v; store('hwatu-stake', stake); updStake(); });
function refill() { if (coin > 0 || store('hwatu-refill') === today()) return false; store('hwatu-refill', today()); setCoin(REFILL); beep('steal'); return true; }
$('refillBtn').onclick = () => { if (refill()) updStake(); };
updStake();

// ---------- 소리 ----------
const SVG_SND_ON = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const SVG_SND_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
const SVG_MUSIC = '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>';
let soundOn = store('hwatu-sound') !== 'off';
let actx = null, noiseBuf = null;
function updSnd() { $('sndToggle').innerHTML = soundOn ? SVG_SND_ON : SVG_SND_OFF; $('sndToggle').classList.toggle('muted', !soundOn); }
updSnd();
$('sndToggle').onclick = () => { soundOn = !soundOn; store('hwatu-sound', soundOn ? 'on' : 'off'); updSnd(); $('sndToggle').blur(); };
function beep(k) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime;
    const tone = (f, s, d, type = 'sine', v = .25, f2) => {
      const o = actx.createOscillator(), gn = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t + s); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + s + d);
      gn.gain.setValueAtTime(v, t + s); gn.gain.exponentialRampToValueAtTime(.001, t + s + d);
      o.connect(gn); gn.connect(actx.destination); o.start(t + s); o.stop(t + s + d + .02);
    };
    const noise = (s, d, v, hp) => {
      if (!noiseBuf) { noiseBuf = actx.createBuffer(1, actx.sampleRate * .4, actx.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
      const src = actx.createBufferSource(), gn = actx.createGain(), f = actx.createBiquadFilter();
      src.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = hp || 2000; f.Q.value = .8;
      gn.gain.setValueAtTime(v, t + s); gn.gain.exponentialRampToValueAtTime(.001, t + s + d);
      src.connect(f); f.connect(gn); gn.connect(actx.destination); src.start(t + s); src.stop(t + s + d + .02);
    };
    if (k === 'tak') { noise(0, .045, .9, 1100); noise(0, .02, .5, 4200); tone(95, 0, .12, 'sine', .55, 55); }      // 탁! 내려치기
    else if (k === 'match') { noise(0, .04, .9, 1300); tone(110, 0, .1, 'sine', .5, 60); noise(.075, .04, .8, 1700); tone(1568, .075, .12, 'triangle', .12); }  // 짝!
    else if (k === 'swoosh') { noise(0, .16, .18, 900); noise(.03, .12, .12, 2600); }
    else if (k === 'flip') { noise(0, .06, .35, 3600); tone(520, 0, .05, 'triangle', .08, 760); }
    else if (k === 'take') { [0, .05, .1].forEach((d, i) => noise(d, .035, .35, 2200 + i * 500)); tone(1047, .12, .14, 'triangle', .1); }
    else if (k === 'big') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .07, .22, 'triangle', .22)); }
    else if (k === 'jjok') { tone(500, 0, .12, 'sine', .3, 1400); noise(0, .03, .4, 3000); [1047, 1319].forEach((f, i) => tone(f, .12 + i * .08, .18, 'triangle', .18)); }
    else if (k === 'ttadak') { noise(0, .03, 1, 1500); tone(100, 0, .1, 'sine', .5, 55); noise(.09, .03, 1, 1900); tone(120, .09, .1, 'sine', .5, 60); [784, 988, 1175].forEach((f, i) => tone(f, .2 + i * .06, .18, 'triangle', .18)); }
    else if (k === 'sweep') { noise(0, .35, .35, 700); noise(.1, .3, .25, 2400); [659, 784, 988, 1319].forEach((f, i) => tone(f, .25 + i * .07, .22, 'triangle', .18)); }
    else if (k === 'bomb') { tone(80, 0, .5, 'sine', .7, 30); noise(0, .4, .9, 300); noise(0, .15, .5, 1200); }
    else if (k === 'shake') { [0, .08, .16, .24].forEach(d => noise(d, .05, .3, 2800)); tone(660, .3, .2, 'triangle', .15, 880); }
    else if (k === 'stop') { tone(90, 0, .25, 'sine', .7, 50); noise(0, .06, .8, 900); [1047, 1319, 1568].forEach((f, i) => tone(f, .12 + i * .05, .3, 'triangle', .14)); }
    else if (k === 'steal') { tone(880, 0, .08, 'square', .08, 1320); tone(1320, .08, .1, 'square', .06, 660); }
    else if (k === 'ppuk') { tone(330, 0, .16, 'square', .12, 160); tone(160, .14, .3, 'sawtooth', .08, 70); noise(.1, .2, .25, 500); }
    else if (k === 'turn') { tone(880, 0, .12, 'triangle', .18); tone(1320, .1, .18, 'triangle', .15); }
    else if (k === 'go') { noise(0, .05, .8, 1100); tone(392, 0, .14, 'sawtooth', .12); tone(523, .1, .14, 'sawtooth', .12); tone(784, .2, .3, 'sawtooth', .14); tone(784, .2, .3, 'triangle', .2); }
    else if (k === 'win') { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * .11, .32, 'triangle', .22)); }
    else if (k === 'lose') { [392, 330, 262].forEach((f, i) => tone(f, i * .16, .35, 'sine', .2)); }
    else if (k === 'coin') { const f = 2200 + Math.random() * 900; tone(f, 0, .09, 'triangle', .07); tone(f * 1.5, .02, .12, 'sine', .05); }   // 엽전 짤랑
    else if (k === 'tick') { tone(1800 + Math.random() * 300, 0, .03, 'square', .025); }
    else if (k === 'join') { tone(660, 0, .1, 'triangle', .2); tone(880, .1, .14, 'triangle', .2); }
  } catch (e) {}
}
const MUSIC = { lobby: 'audio/bgm-lobby.mp3', play: 'audio/bgm-play.mp3', tense: 'audio/bgm-tense.mp3' };
let curTrack = '';
function setTrack(n) { if (curTrack === n) return; curTrack = n; KBGM.track(n); }
KBGM.init({ key: 'hwatu', tracks: MUSIC, start: 'lobby' });
KBGM.button({ after: $('sndToggle'), icon: SVG_MUSIC });

// ---------- 상태 ----------
let mode = null;              // 'cpu' | 'online'
let g = null, pendingG = null, animating = false;
let room = null, code = '', ref = null, role = '', unsub = null, FB = null, busy = false;
let shownCoin = null;
let sel = -1, aiT = 0, shownRes = '', shownGs = '', ghostSet = new Set();
const AI = [{ name: '깨비', av: 'avatar-ggaebisaem' }, { name: '깨순이', av: 'avatar-ggaesun' }];
const PAL = ['#ee5a6f', '#3a83e8', '#38b468'];
const latest = () => pendingG || g;
function meIdx(st = g) { if (!st) return -1; if (mode === 'cpu') return 0; return st.players.findIndex(p => p.id === myId); }
const nm = (i, st = g) => i === meIdx(st) ? '나' : st.players[i].name;
const nmS = (i, st = g) => i === meIdx(st) ? '내가' : st.players[i].name + (st.players[i].ai ? '이' : '님이');

const IMG = id => `img/m${String(MON(id)).padStart(2, '0')}-${(id & 3) + 1}.webp`;
const cardH = (id, cls = '') => `<i class="ht ${cls}" data-id="${id}" style="background-image:url(${IMG(id)})"></i>`;
const backH = (cls = '') => `<i class="ht back ${cls}"></i>`;
function avatarHTML(i, st) {
  const p = st.players[i];
  if (p.ai) return `<span class="av ai"><img src="../cards/img/${p.av}.png" alt=""></span>`;
  return `<span class="av" style="background:${PAL[i % 3]}">${esc((p.name || '?').slice(0, 1))}</span>`;
}

let toastT = 0;
function toast(t, ms = 1800) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms); }
function bigPop(text, cls = '', sub = '', img = '') {
  const el = $('big');
  const main = img && ART['text-' + img] ? `<img src="img/text-${img}.webp" alt="${esc(text)}">` : `<div class="tx ${cls}">${esc(text)}</div>`;
  el.innerHTML = main + (sub ? `<div class="sub">${esc(sub)}</div>` : '');
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
}
function show(id) {
  ['startScreen', 'waitScreen', 'game', 'sutda'].forEach(s => $(s).classList.toggle('hidden', s !== id));
  $('sideRoom').classList.toggle('hidden', !(id === 'game' && mode === 'online'));
  if (id === 'startScreen') updStake();
  if (id !== 'game' && id !== 'sutda') { setTrack('lobby'); KBGM.calm(); } else { setTrack('play'); KBGM.full(); }
}
function hideModals() { ['askModal', 'gsModal', 'pickModal', 'resultModal', 'confirmModal'].forEach(id => $(id).classList.add('hidden')); }
function getName() {
  const n = $('nameInput').value.trim().replace(/\s+/g, ' ').slice(0, 8);
  if (!n) { $('startMsg').textContent = '먼저 내 이름을 적어 주세요.'; $('nameInput').focus(); return null; }
  store('hwatu-name', n); return n;
}

// ============================================================
//  크기 맞추기
// ============================================================
function layout() {
  const w = innerWidth, h = innerHeight, rs = document.documentElement.style;
  const st = g, n = st ? st.n : 2;
  const handMax = n === 2 ? 10 : 7;
  const phone = w < 640;
  const rows = phone && handMax > 6 ? 2 : 1;
  const perRow = Math.ceil(handMax / rows);
  let hw = Math.min(84, (w - 40) / (perRow * 1.1), h * (rows === 2 ? .085 : .13));
  let fw = Math.min(86, w / (phone ? 9.5 : 14), h / (phone ? 12 : 9));
  let cw = Math.min(42, w / (phone ? 16 : 32), h / 20);
  rs.setProperty('--hw', Math.floor(hw) + 'px');
  rs.setProperty('--fw', Math.floor(fw) + 'px');
  rs.setProperty('--cw', Math.floor(cw) + 'px');
  document.querySelectorAll('.seat').forEach(s => s.style.setProperty('--cw', Math.floor(cw * (n === 3 || phone ? .78 : .9)) + 'px'));
}
addEventListener('resize', layout);

// ============================================================
//  그리기
// ============================================================
function capsHTML(caps, got) {
  const gr = { g: [], a: [], r: [], p: [] };
  caps.forEach(id => gr[kind(id)].push(id));
  const s = scoreOf(caps);
  const lab = { g: s.gN, a: s.aN, r: s.rN, p: s.pN };
  return ['g', 'a', 'r', 'p'].map(k => {
    if (!gr[k].length) return '';
    const ids = gr[k].slice().sort((x, y) => x - y);
    return `<span class="grp ${k}">${ids.map(id => cardH(id, ghostSet.has(id) ? 'ghost' : got && got.has(id) ? 'got' : '')).join('')}<b><img class="gi" src="img/icon-${k}.webp" alt="">${lab[k]}</b></span>`;
  }).join('');
}
function goTag(p) { return p.go ? `<span class="gochip"><img class="gi" src="img/icon-go.webp" alt="">${p.go}고</span>` : ''; }
function shakeTag(p) { const n = (p.shake || 0) + (p.bomb || 0); return n ? `<span class="gochip" style="background:var(--sky)"><img class="gi" src="img/icon-shake.webp" alt="">흔들기 ${n}</span>` : ''; }

// view: { floor: 화면에 보일 바닥, fresh: 새로 놓인 카드, hide: 손에서 뺄 카드, got: 방금 먹은 카드, deckN }
function render(view) {
  const st = g; if (!st) return;
  layout();
  const me = meIdx(st), watch = me < 0;
  const pd = st.pend;
  const v = view || {};
  ghostSet = new Set(v.ghost || []);
  // 상대 자리
  const order = []; for (let k = 1; k <= st.n; k++) { const i = (Math.max(me, 0) + k) % st.n; if (i !== me) order.push(i); }
  if (watch) { order.length = 0; for (let i = 0; i < st.n; i++) order.push(i); }
  $('opps').innerHTML = order.map(i => {
    const p = st.players[i];
    const s = scoreOf(p.caps).total;
    return `<div class="seat ${st.turn === i && st.phase !== 'end' ? 'turn' : ''}" data-i="${i}">
      <div class="top">${avatarHTML(i, st)}<span class="nm">${esc(p.name)}</span>${goTag(p)}${shakeTag(p)}<span class="pt ${s >= st.goal ? 'hot' : ''}">${s}점</span>
      <span class="hn">${backH()}<b>${p.hand.length}</b></span></div>
      <div class="caps">${capsHTML(p.caps, v.got && v.who === i ? v.got : null)}</div></div>`;
  }).join('');
  // 바닥
  let floor = v.floor || st.floor.slice();
  const fresh = new Set(v.fresh || []);
  if (!v.floor && pd) { if (pd.hc != null) { floor.push(pd.hc); } if (pd.f != null) floor.push(pd.f); }
  const groups = {};
  floor.forEach(id => { (groups[MON(id)] = groups[MON(id)] || []).push(id); });
  const pickSet = new Set(st.phase === 'pick' && pd && st.turn === me ? (pd.need === 'h' ? pd.hm : pd.fm) : []);
  const hlM = sel >= 0 ? MON(sel) : -1;
  const meP0 = me >= 0 ? st.players[me] : null;
  const myTurnF = meP0 && st.turn === me && st.phase === 'play' && !animating && !v.floor;
  const handM = new Set(myTurnF ? meP0.hand.map(MON) : []);
  $('floor').innerHTML = Object.keys(groups).sort((a, b) => a - b).map(m =>
    `<span class="fg ${+m === hlM ? 'hl' : ''}" data-m="${m}">${groups[m].map(id => cardH(id, (ghostSet.has(id) ? 'ghost ' : fresh.has(id) ? 'new ' : '') + (pickSet.has(id) ? 'pickable' : '') + (handM.has(+m) ? ' eat' : ''))).join('')}</span>`).join('');
  const dn = v.deckN != null ? v.deckN : st.deck.length;
  $('deckStack').innerHTML = dn ? backH() + (dn > 1 ? backH() : '') + (dn > 2 ? backH() : '') : '';
  $('deckN').textContent = dn ? `${dn}장` : '';
  const myP = me >= 0 ? st.players[me] : null;
  const canFlip = myP && st.turn === me && st.phase === 'play' && myP.dummy > 0 && !animating && !v.floor;
  $('deckWrap').classList.toggle('can', !!canFlip);
  // 나
  if (myP) {
    $('me').classList.remove('hidden');
    $('me').classList.toggle('turn', st.turn === me && st.phase !== 'end');
    $('meAv').outerHTML = `<span class="av" id="meAv" style="background:${PAL[me % 3]}">${esc((myP.name || '?').slice(0, 1))}</span>`;
    $('meName').textContent = myP.name;
    const s = scoreOf(myP.caps).total;
    $('meSp').innerHTML = `${goTag(myP)}${shakeTag(myP)}<span class="pt ${s >= st.goal ? 'hot' : ''}">${s}점</span><span class="coinchip" id="meCoin">${YP}${fmt(shownCoin != null ? shownCoin : coin)}냥</span>`;
    $('meCaps').innerHTML = capsHTML(myP.caps, v.got && v.who === me ? v.got : null);
    const hide = new Set(v.hide || []);
    const myTurn = st.turn === me && st.phase === 'play' && !animating && !v.floor;
    $('hand').classList.toggle('dim', myTurn);
    $('hand').innerHTML = myP.hand.filter(id => !hide.has(id)).map((id, k) => {
      const m = MON(id), has = st.floor.some(x => MON(x) === m);
      let mk = '';
      if (myTurn && canBomb(st, myP, m)) mk = '<span class="mk">폭탄</span>';
      else if (myTurn && canShake(st, myP, id)) mk = '<span class="mk">흔들기</span>';
      return `<i class="ht ${has && myTurn ? 'can' : ''} ${myTurn && !has ? '' : ''} ${id === sel ? 'sel' : ''}" data-id="${id}" style="background-image:url(${IMG(id)})">${myTurn && k < 10 ? `<span class="kn">${(k + 1) % 10}</span>` : ''}${mk}</i>`;
    }).join('');
    $('hand').classList.remove('watch');
  } else { $('me').classList.add('hidden'); }
  renderStatus(v);
  renderActions(v);
}
function renderStatus(v) {
  const st = g, me = meIdx(st);
  let t = '';
  if (st.phase === 'end') t = '판이 끝났어요';
  else if (v && v.floor) t = `${esc(nm(st.turn) === '나' ? '내' : st.players[st.turn].name)} 차례`;
  else if (st.turn === me) {
    if (st.phase === 'pick') t = '<b>어느 카드를 가져갈까요?</b> 반짝이는 카드를 눌러요';
    else if (st.phase === 'gostop') t = '<b>고</b> 할까요, <b>스톱</b> 할까요?';
    else t = '<b>내 차례</b> · 낼 카드를 골라요';
  } else t = `${esc(st.players[st.turn].name)} 차례<span class="dots"></span>`;
  $('status').innerHTML = t;
}
function renderActions(v) {
  const st = g, me = meIdx(st), p = me >= 0 ? st.players[me] : null;
  let h = '';
  if (p && st.turn === me && st.phase === 'play' && p.dummy > 0 && !animating && !(v && v.floor)) h += `<button class="game-btn btn-info" id="aFlip">더미 뒤집기 (${p.dummy}번)</button>`;
  if (mode === 'cpu' || role !== 'watch') h += `<button class="game-btn btn-secondary" id="aQuit">그만하기</button>`;
  else h += `<button class="game-btn btn-secondary" id="aQuit">나가기</button>`;
  $('actions').innerHTML = h;
  if ($('aFlip')) $('aFlip').onclick = () => doMine({ t: 'flip' });
  $('aQuit').onclick = askLeave;
}

// ============================================================
//  상태 받기 → 움직임 → 그리기
// ============================================================
function receive(ng) {
  if (!ng) return;
  const cur = latest();
  if (cur && cur.gid === ng.gid && ng.seq <= cur.seq) return;
  pendingG = ng;
  if (!animating) runPending();
}
async function runPending() {
  animating = true;
  while (pendingG) {
    const ng = pendingG; pendingG = null;
    const old = g;
    try {
      if (!old || old.gid !== ng.gid) { g = ng; sel = -1; shownRes = ''; shownGs = ''; hideModals(); render(); beep('flip'); }
      else await animate(old, ng);
    } catch (e) { console.error(e); g = ng; render(); }
  }
  animating = false;
  render();
  after();
}
const evKey = e => e ? JSON.stringify([e.who, e.hc, e.f, e.caps, e.tags, e.bomb]) : '';
// ---------- 날아가는 카드 ----------
const rectOf = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; };
const qCard = (root, id) => root.querySelector(`.ht[data-id="${id}"]`);
function srcRect(who, id) {
  if (who === meIdx()) { const c = qCard($('hand'), id); if (c) return rectOf(c); }
  const s = document.querySelector(`.seat[data-i="${who}"] .hn`);
  return s ? rectOf(s) : { x: innerWidth / 2, y: 60, w: 20 };
}
function fly(id, from, to, opt = {}) {
  return new Promise(res => {
    const el = document.createElement('i');
    el.className = 'ht flyc' + (opt.back ? ' back' : '');
    if (!opt.back) el.style.backgroundImage = `url(${IMG(id)})`;
    const w = to.w, h = w * 1.3333;
    el.style.cssText += `;--w:${w}px;left:0;top:0;`;
    document.body.appendChild(el);
    const sx = from.w / w || .3;
    const dur = opt.dur || 340;
    const lift = opt.arc != null ? opt.arc : -Math.min(60, Math.abs(to.y - from.y) * .25 + 20);
    const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2 + lift;
    const rot = opt.rot != null ? opt.rot : (Math.random() * 16 - 8);
    const k = [
      { transform: `translate(${from.x - w / 2}px,${from.y - h / 2}px) scale(${sx}) rotate(0deg)`, opacity: opt.fade ? 0 : 1 },
      { transform: `translate(${mx - w / 2}px,${my - h / 2}px) scale(${(sx + 1) / 2 * (opt.big ? 1.25 : 1.1)}) rotate(${rot}deg)`, opacity: 1, offset: .55 },
      { transform: `translate(${to.x - w / 2}px,${to.y - h / 2}px) scale(1) rotate(0deg)`, opacity: 1 }
    ];
    if (opt.flipAt) {   // 더미에서 뒤집으며 날아와요
      setTimeout(() => { el.classList.remove('back'); el.style.backgroundImage = `url(${IMG(id)})`; }, dur * opt.flipAt);
      k[1].transform += ' scaleX(.05)';
    }
    const an = el.animate(k, { duration: dur, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
    an.onfinish = () => { res(el); if (!opt.keep) el.remove(); };
  });
}
function slam(at, power = 1, shakeEl) {
  // 탁! 내려치는 순간: 충격 고리, 화면 울림
  const fx = document.createElement('div');
  fx.className = 'fx-ring' + (ART['fx-slam'] ? ' art' : '');
  const sz = at.w * (1.9 + power * .5);
  fx.style.cssText = `left:${at.x - sz / 2}px;top:${at.y - sz / 2}px;width:${sz}px;height:${sz}px`;
  document.body.appendChild(fx); setTimeout(() => fx.remove(), 500);
  const m = shakeEl || $('mid'); m.classList.remove('shake', 'shake2'); void m.offsetWidth; m.classList.add(power > 1.5 ? 'shake2' : 'shake');
}
function sparkle(at, n = 8) {
  if (ART['fx-sparkle']) { const fx = document.createElement('div'); fx.className = 'fx-spk'; const sz = at.w * 2.4; fx.style.cssText = `left:${at.x - sz / 2}px;top:${at.y - sz / 2}px;width:${sz}px;height:${sz}px`; document.body.appendChild(fx); setTimeout(() => fx.remove(), 650); return; }
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i'); d.className = 'spk';
    const ang = (i / n) * Math.PI * 2 + Math.random() * .5, dist = at.w * (.6 + Math.random() * .5);
    d.style.cssText = `left:${at.x}px;top:${at.y}px;--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist}px`;
    document.body.appendChild(d); setTimeout(() => d.remove(), 650);
  }
}
function charPop(name) {
  const el = $('charPop'); if (!el) return;
  el.innerHTML = `<img src="img/${name}.webp" alt="">`;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
}
function flash(cls) { const f = $('flash'); f.className = ''; void f.offsetWidth; f.className = 'on ' + (cls || ''); }
const isMatch = (floorIds, id) => floorIds.some(x => x !== id && MON(x) === MON(id));

async function animate(old, ng) {
  const ev = ng.last;
  const newEv = ev && evKey(ev) !== evKey(old.last);
  const toPick = ng.phase === 'pick' && old.phase !== 'pick';
  if (toPick) {
    // 카드를 냈는데 고를 게 생겼어요 → 낸 카드(와 뒤집은 카드)를 바닥으로 날려 보여 줘요
    const pd = ng.pend, who = ng.turn;
    const from = pd.hc != null ? srcRect(who, pd.hc) : null;
    g = ng; sel = -1;
    const ids = [pd.hc, pd.f].filter(x => x != null);
    render({ ghost: ids });
    if (pd.hc != null) {
      const tgt = qCard($('floor'), pd.hc);
      if (tgt && from) { beep('swoosh'); await fly(pd.hc, from, rectOf(tgt)); tgt.classList.remove('ghost'); beep('match'); slam(rectOf(tgt)); }
    }
    if (pd.f != null) {
      await sleep(200);
      const tgt = qCard($('floor'), pd.f);
      if (tgt) { beep('flip'); await fly(pd.f, rectOf($('deckWrap')), rectOf(tgt), { back: true, flipAt: .5, dur: 420 }); tgt.classList.remove('ghost'); beep('match'); slam(rectOf(tgt)); }
    }
    render();
    return;
  }
  if (!newEv) { g = ng; render(); return; }
  const who = ev.who;
  // 흔들기 알림
  if (ev.shake) { bigPop('흔들기!', 'sky', `${nmS(who, ng)} 흔들었어요`, 'shake'); beep('shake'); bubble(who, '흔들기!'); await sleep(950); }
  let floor = old.floor.slice();
  if (old.pend) { if (old.pend.hc != null) floor.push(old.pend.hc); if (old.pend.f != null) floor.push(old.pend.f); }
  let deckN = old.deck.length;
  const played = ev.bomb ? ev.bombIds : (ev.hc != null && !(old.pend && old.pend.hc === ev.hc) ? [ev.hc] : []);
  const hide = ev.bomb ? ev.bombIds : (ev.hc != null ? [ev.hc] : []);
  g = old;
  // 1) 손에서 낸 카드가 바닥으로 날아가 탁!
  if (played.length) {
    const froms = played.map(id => srcRect(who, id));
    const matched = isMatch(floor, played[0]);
    floor = floor.concat(played);
    render({ floor, ghost: played, hide, deckN });
    beep('swoosh');
    await Promise.all(played.map((id, k) => sleep(k * 70).then(() => { const t = qCard($('floor'), id); return t ? fly(id, froms[k], rectOf(t), { big: true }).then(() => t.classList.remove('ghost')) : null; })));
    const at = qCard($('floor'), played[played.length - 1]);
    if (ev.bomb) { beep('bomb'); flash('red'); if (at) slam(rectOf(at), 2.2); bigPop('폭탄!', 'red', '', 'bomb'); await sleep(850); }
    else { beep(matched ? 'match' : 'tak'); if (at) { slam(rectOf(at), matched ? 1.2 : 1); if (matched) sparkle(rectOf(at), 6); } await sleep(260); }
  }
  // 2) 더미에서 뒤집은 카드
  if (ev.f != null && !(old.pend && old.pend.f === ev.f)) {
    const matched = isMatch(floor, ev.f);
    floor = floor.concat([ev.f]); deckN = Math.max(0, deckN - 1);
    const from = rectOf($('deckWrap'));
    render({ floor, ghost: [ev.f], hide, deckN });
    beep('flip');
    const t = qCard($('floor'), ev.f);
    if (t) { await fly(ev.f, from, rectOf(t), { back: true, flipAt: .45, dur: 430, rot: 0, arc: -30 }); t.classList.remove('ghost'); }
    beep(matched ? 'match' : 'tak'); if (t) { slam(rectOf(t), matched ? 1.2 : .8); if (matched) sparkle(rectOf(t), 6); }
    await sleep(330);
  }
  // 3) 큰 글자 (먹기 전에)
  const TAG = { jjok: ['쪽!', '', 'jjok'], ppuk: ['뻑!', 'red', 'ppuk'], ttadak: ['따닥!', '', 'ttadak'], sweep: ['싹쓸이!', 'mint', 'sweep'], ppukeat: ['뻑 먹기!', 'mint', ''] };
  const tags = ev.tags.filter(t => TAG[t]);
  for (const t of tags) {
    bigPop(TAG[t][0], TAG[t][1], t === 'ppuk' ? '' : (ev.stole.length ? '피를 한 장씩 가져와요' : ''), TAG[t][2]);
    beep(t === 'ppuk' ? 'ppuk' : t === 'jjok' ? 'jjok' : t === 'ttadak' ? 'ttadak' : t === 'sweep' ? 'sweep' : 'big');
    if (t !== 'ppuk') flash(t === 'sweep' ? 'mint' : 'gold'); else { const m = $('mid'); m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake'); }
    await sleep(900);
  }
  // 4) 먹은 카드가 내 앞(먹은 카드 칸)으로 모여요
  const fromR = {};
  ev.caps.forEach(id => { const c = qCard($('floor'), id); if (c) fromR[id] = rectOf(c); });
  ev.stole.forEach(s0 => { const sc = document.querySelector(`.seat[data-i="${s0.from}"] .ht[data-id="${s0.id}"]`) || (s0.from === meIdx() ? qCard($('meCaps'), s0.id) : null); if (sc) fromR[s0.id] = rectOf(sc); });
  g = ng;
  const moving = ev.caps.concat(ev.stole.map(x => x.id)).filter(id => fromR[id]);
  render({ ghost: moving, who });
  if (moving.length) {
    beep('take');
    const capRoot = who === meIdx() ? $('meCaps') : document.querySelector(`.seat[data-i="${who}"] .caps`);
    await Promise.all(moving.map((id, k) => sleep(k * 55).then(() => {
      const t = capRoot && qCard(capRoot, id);
      if (!t) return null;
      return fly(id, fromR[id], rectOf(t), { dur: 360, rot: 0 }).then(() => { t.classList.remove('ghost'); t.classList.add('got'); });
    })));
    if (ev.stole.length) { beep('steal'); if (!tags.length && !ev.bomb) toast('피를 한 장씩 가져와요', 1200); }
    const last = capRoot && qCard(capRoot, moving[moving.length - 1]);
    if (last && who === meIdx()) sparkle(rectOf(last), 8);
  }
  ghostSet = new Set();
  await sleep(moving.length ? 220 : 300);
}

function after() {
  const st = g; if (!st) return;
  const me = meIdx(st);
  // 고 알림
  const lg = st.log[st.log.length - 1];
  if (lg && lg.t === 'go') {
    const k = `${st.gid}-${st.seq}-go`;
    if (shownGs !== k) { shownGs = k; bigPop(`${lg.n}고!`, 'red', `${nmS(lg.who, st)} ${lg.n}고를 외쳤어요`, lg.n === 1 ? 'go' : ''); beep('go'); flash('red'); bubble(lg.who, `${lg.n}고!`); if (st.players[lg.who].ai) charPop('ggaebi-go'); }
  }
  // 긴장될 때 음악: 2고 넘었거나 누가 거의 다 났을 때
  const hot = st.phase !== 'end' && st.players.some(q => q.go >= 2 || scoreOf(q.caps).total >= st.goal - 1);
  setTrack(hot ? 'tense' : 'play');
  if (st.phase === 'end') { showResult(); return; }
  if (st.phase === 'gostop' && st.turn === me) showGs(); else $('gsModal').classList.add('hidden');
  if (st.phase === 'pick' && st.turn === me) showPick(); else $('pickModal').classList.add('hidden');
  if (st.turn === me && st.phase === 'play') beepTurn();
  if (mode === 'cpu') aiTick();
}
let lastTurnKey = '';
function beepTurn() { const k = `${g.gid}-${g.seq}`; if (lastTurnKey !== k) { lastTurnKey = k; beep('turn'); } }
function bubble(i, text) {
  const s = document.querySelector(`.seat[data-i="${i}"]`) || (i === meIdx() ? $('me') : null);
  if (!s) return;
  const b = document.createElement('div'); b.className = 'bubble' + (s.id === 'me' ? ' up' : ''); b.textContent = text;
  s.appendChild(b); setTimeout(() => b.remove(), 1900);
}

// ============================================================
//  내 행동
// ============================================================
const isTouch = () => matchMedia('(hover: none)').matches;
$('hand').addEventListener('click', e => {
  const c = e.target.closest('.ht'); if (!c) return;
  const st = g, me = meIdx(st);
  if (!st || animating || st.turn !== me || st.phase !== 'play') return;
  const id = +c.dataset.id;
  if (isTouch() && sel !== id) { sel = id; render(); return; }
  tryPlay(id);
});
$('floor').addEventListener('click', e => {
  const c = e.target.closest('.ht'); const st = g; if (!c || !st || animating) return;
  const me = meIdx(st), id = +c.dataset.id;
  if (st.phase === 'pick' && st.turn === me) { const pd = st.pend; const opts = pd.need === 'h' ? pd.hm : pd.fm; if (opts.includes(id)) doMine({ t: 'pick', id }); return; }
  // 고른 카드와 같은 달 바닥 카드를 누르면 그 카드를 내요
  if (st.phase === 'play' && st.turn === me && sel >= 0 && MON(sel) === MON(id)) tryPlay(sel);
});
$('deckWrap').addEventListener('click', () => { const st = g; if (!st || animating) return; const me = meIdx(st); if (st.turn === me && st.phase === 'play' && st.players[me].dummy > 0) doMine({ t: 'flip' }); });
function tryPlay(id) {
  const st = g, me = meIdx(st), p = st.players[me], m = MON(id);
  if (canBomb(st, p, m)) {
    const ids = p.hand.filter(x => MON(x) === m);
    ask('폭탄!', `${m}월 카드 석 장을 한꺼번에 내고 바닥의 한 장까지 다 가져와요. 점수가 두 배가 되고, 다음 두 번은 더미만 뒤집어요.`, ids,
      [['폭탄 하기', 'btn-primary', () => doMine({ t: 'bomb', m })], ['한 장만 내기', 'btn-sky', () => doMine({ t: 'play', id })], ['취소', 'btn-secondary', null]]);
    return;
  }
  if (canShake(st, p, id)) {
    const ids = p.hand.filter(x => MON(x) === m);
    ask('흔들까요?', `${m}월 카드 석 장을 모두에게 보여 주면, 이번 판에 이겼을 때 점수가 두 배예요.`, ids,
      [['흔들기', 'btn-primary', () => doMine({ t: 'play', id, shake: true })], ['그냥 내기', 'btn-sky', () => doMine({ t: 'play', id })], ['취소', 'btn-secondary', null]]);
    return;
  }
  doMine({ t: 'play', id });
}
function ask(title, text, ids, btns) {
  $('askTitle').textContent = title; $('askText').textContent = text;
  $('askCards').innerHTML = ids.map(id => cardH(id)).join('');
  $('askBtns').innerHTML = btns.map((b, i) => `<button class="game-btn ${b[1]}" data-k="${i}">${b[0]}</button>`).join('');
  $('askBtns').onclick = e => { const b = e.target.closest('button'); if (!b) return; $('askModal').classList.add('hidden'); const fn = btns[+b.dataset.k][2]; if (fn) fn(); };
  $('askModal').classList.remove('hidden');
}
let shownPick = '';
function showPick() {
  const st = g, pd = st.pend, opts = pd.need === 'h' ? pd.hm : pd.fm;
  const k = `${st.gid}-${st.seq}-${pd.need}`;
  if (!$('pickModal').classList.contains('hidden') && shownPick === k) return;
  shownPick = k;
  $('pickCards').innerHTML = opts.map((id, i) => `<button data-id="${id}">${cardH(id)}<span>${i + 1}번</span></button>`).join('');
  $('pickModal').classList.remove('hidden');
  beep('flip');
}
$('pickCards').onclick = e => { const b = e.target.closest('button'); if (!b) return; choosePick(+b.dataset.id); };
function choosePick(id) {
  const st = g, me = meIdx(st);
  if (!st || st.phase !== 'pick' || st.turn !== me || animating) return;
  const pd = st.pend, opts = pd.need === 'h' ? pd.hm : pd.fm;
  if (!opts.includes(id)) return;
  $('pickModal').classList.add('hidden');
  doMine({ t: 'pick', id });
}

// 키보드: 숫자로 바로 내기, 좌우 방향키로 고르고 엔터·스페이스로 내기
const anyModal = () => [...document.querySelectorAll('.modal, .screen')].some(el => getComputedStyle(el).display !== 'none');
addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const st = g; if (!st || animating) return;
  const me = meIdx(st); if (me < 0 || st.turn !== me) return;
  const t = e.target; if (t && t.matches && t.matches('input, textarea, select')) return;
  if (st.phase === 'pick' && !$('pickModal').classList.contains('hidden')) {
    if (/^[1-9]$/.test(e.key)) { const pd = st.pend, opts = pd.need === 'h' ? pd.hm : pd.fm, id = opts[+e.key - 1]; if (id != null) { e.preventDefault(); choosePick(id); } }
    return;
  }
  if (st.phase !== 'play' || anyModal()) return;
  const hand = st.players[me].hand;
  if (/^[0-9]$/.test(e.key)) {
    const i = e.key === '0' ? 9 : +e.key - 1;
    if (hand[i] != null) { e.preventDefault(); tryPlay(hand[i]); }
    return;
  }
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
    e.preventDefault(); if (!hand.length) return;
    let i = hand.indexOf(sel);
    if (i < 0) { const c = hand.findIndex(id => st.floor.some(x => MON(x) === MON(id))); i = c >= 0 ? c : 0; }
    else i = (i + (k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 1) + hand.length) % hand.length;
    sel = hand[i]; render(); return;
  }
  if (k === 'Enter' || k === ' ') {
    e.preventDefault();
    if (sel >= 0 && hand.includes(sel)) tryPlay(sel);
    else if (st.players[me].dummy > 0) doMine({ t: 'flip' });
    else if (hand.length) { sel = hand[0]; render(); }
  }
});

function showGs() {
  const st = g, me = meIdx(st), p = st.players[me];
  const k = `${st.gid}-${st.seq}`;
  if (!$('gsModal').classList.contains('hidden') && shownGs === k + 'm') return;
  shownGs = k + 'm';
  $('gsTitle').textContent = `${p.score}점 났어요!`;
  let won = 0; try { const t = clone(st); if (!HT.act(t, me, { t: 'stop' }, Date.now()) && t.res) won = t.res.sum * (st.stake || 10); } catch (e) {}
  $('gsText').innerHTML = `지금 스톱하면 <b class="gs-won">${YP}+${fmt(won)}냥</b><br>고 하면 더 크게 노려요. 대신 상대가 먼저 나면 <b style="color:var(--coral-d);font-weight:normal">고박</b>이에요.`;
  $('goBtn').textContent = `${p.go + 1}고!`;
  $('gsModal').classList.remove('hidden');
}
$('goBtn').onclick = () => { $('gsModal').classList.add('hidden'); doMine({ t: 'go' }); };
$('stopBtn').onclick = () => { $('gsModal').classList.add('hidden'); doMine({ t: 'stop' }); };

async function doMine(a) {
  sel = -1;
  if (mode === 'cpu') { doLocal(0, a); return; }
  if (mode === 'online') { busy = true; const err = await onlineAct(a); busy = false; if (err && err !== 'net') { render(); } }
}
function doLocal(who, a) {
  const ng = clone(latest());
  const err = HT.act(ng, who, a, Date.now());
  if (err) { console.warn('act', err, a); render(); return; }
  receive(ng);
}

// ============================================================
//  깨비 (컴퓨터)
// ============================================================
function aiTick() {
  clearTimeout(aiT);
  const st = g; if (!st || st.phase === 'end' || animating) return;
  const p = st.players[st.turn]; if (!p.ai) return;
  const i = st.turn, k = `${st.gid}-${st.seq}`;
  aiT = setTimeout(() => {
    if (!g || `${g.gid}-${g.seq}` !== k || animating) return;
    const a = aiDecide(clone(g), i);
    if (a.t === 'go') bubble(i, `${p.go + 1}고!`); else if (a.t === 'stop') bubble(i, '스톱!');
    doLocal(i, a);
  }, st.phase === 'gostop' ? rnd(900, 1400) : st.phase === 'pick' ? rnd(500, 800) : rnd(650, 1100));
}
const SETS = [GODORI, HONG, CHEONG, CHO];
function setBonus(caps, id) {
  let b = 0;
  for (const s of SETS) if (s.includes(id)) { const have = s.filter(x => caps.includes(x)).length; b += have === 2 ? 6 : have === 1 ? 2 : .5; }
  if (GWANG.includes(id)) { const gn = caps.filter(x => GWANG.includes(x)).length; b += gn >= 2 ? 5 : gn; }
  return b;
}
function capValue(st, i, ids) {
  const p = st.players[i];
  let v = 0;
  for (const id of ids) {
    v += worth(id) + setBonus(p.caps, id) * .8;
    // 막기: 상대가 노리는 카드
    st.players.forEach((q, j) => { if (j !== i) v += setBonus(q.caps, id) * .5; });
  }
  return v;
}
function aiDecide(st, i) {
  const p = st.players[i], lv = level;
  const opp = st.players.filter((q, j) => j !== i);
  const oppMax = Math.max(...opp.map(q => scoreOf(q.caps).total));
  if (st.phase === 'gostop') {
    const left = p.hand.length + p.dummy;
    if (lv === 1) return { t: Math.random() < .25 && left >= 3 ? 'go' : 'stop' };
    const safe = lv === 2 ? oppMax <= st.goal - 4 && left >= 3 && p.go < 2 : oppMax <= st.goal - 3 && left >= 2 && p.go < 3;
    return { t: safe ? 'go' : 'stop' };
  }
  if (st.phase === 'pick') {
    const pd = st.pend, opts = pd.need === 'h' ? pd.hm : pd.fm;
    if (lv === 1 && Math.random() < .5) return { t: 'pick', id: opts[Math.random() * opts.length | 0] };
    return { t: 'pick', id: opts.slice().sort((a, b) => capValue(st, i, [b]) - capValue(st, i, [a]))[0] };
  }
  // 폭탄
  const ms = [...new Set(p.hand.map(MON))];
  const bm = ms.find(m => canBomb(st, p, m));
  if (bm && (lv >= 2 || Math.random() < .5)) return { t: 'bomb', m: bm };
  if (!p.hand.length) return { t: 'flip' };
  const opts = p.hand.map(id => {
    const fm = fMatch(st, MON(id));
    let v;
    if (fm.length === 0) {
      v = -worth(id) * .6 - setBonus(p.caps, id) * .5;
      const inHand = p.hand.filter(x => MON(x) === MON(id)).length;
      if (inHand >= 2) v -= 2;                      // 같은 달을 들고 있으면 아껴요
      opp.forEach(q => { v -= setBonus(q.caps, id) * .6; });
    } else if (fm.length === 1) v = 2 + capValue(st, i, [id, fm[0]]);
    else if (fm.length === 2) v = 2 + capValue(st, i, [id, bestOf(fm)]);
    else v = 8 + capValue(st, i, [id, ...fm]);
    if (lv === 1) v += rnd(-6, 6);
    else if (lv === 2) v += rnd(-1.5, 1.5);
    return { id, v };
  }).sort((a, b) => b.v - a.v);
  if (p.dummy > 0 && (opts[0].v < 2 || lv === 1 && Math.random() < .5)) return { t: 'flip' };
  const id = opts[0].id;
  return { t: 'play', id, shake: lv >= 2 && canShake(st, p, id) };
}

// ============================================================
//  결과
// ============================================================
const KNAME = { g: '광', a: '열끗', r: '띠', p: '피' };
function seatOf(i) { return i === meIdx() ? $('me') : document.querySelector(`.seat[data-i="${i}"]`); }
function coinShow(before, after, w, r) {
  // 진 사람 자리에서 이긴 사람 자리로 엽전이 날아가요
  const to = seatOf(w); if (!to) return;
  const payers = [...new Set(r.rows.map(x => x.payer != null ? x.payer : x.i))];
  const tr = to.getBoundingClientRect();
  let n = 0;
  payers.forEach(pi => {
    const fe = seatOf(pi); if (!fe) return;
    const fr = fe.getBoundingClientRect();
    const cnt = Math.min(14, 5 + Math.round(Math.log10(Math.max(10, r.sum * ((g && g.stake) || 10)))) * 2);
    for (let k = 0; k < cnt; k++) {
      const c = document.createElement('i'); c.className = 'flycoin'; c.innerHTML = YP;
      const x0 = fr.left + fr.width * (.3 + Math.random() * .4), y0 = fr.top + fr.height * (.3 + Math.random() * .4);
      const x1 = tr.left + tr.width * (.35 + Math.random() * .3), y1 = tr.top + tr.height * (.3 + Math.random() * .4);
      c.style.left = x0 + 'px'; c.style.top = y0 + 'px';
      document.body.appendChild(c);
      const mx = (x0 + x1) / 2 + rnd(-80, 80), my = Math.min(y0, y1) - rnd(40, 120);
      const d = 650 + k * 45;
      c.animate([{ transform: 'translate(0,0) scale(.6)', opacity: 0 }, { offset: .15, opacity: 1, transform: `translate(${(mx - x0) * .3}px,${(my - y0) * .5}px) scale(1.1)` }, { offset: .6, transform: `translate(${mx - x0}px,${my - y0}px) scale(1)` }, { transform: `translate(${x1 - x0}px,${y1 - y0}px) scale(.7)`, opacity: .9 }],
        { duration: d, delay: 300 + k * 55, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'both' }).onfinish = () => { c.remove(); beep('coin'); };
      n++;
    }
  });
  // 내 엽전 칸 숫자가 올라가거나 내려가요
  shownCoin = before;
  setTimeout(() => {
    const chip = $('meCoin'); if (!chip) { shownCoin = null; return; }
    chip.classList.add(after >= before ? 'up' : 'down');
    const t0 = performance.now(), D = 900;
    const step = t => { const q = Math.min(1, (t - t0) / D), v = before + (after - before) * (1 - Math.pow(1 - q, 3)); const c2 = $('meCoin'); if (c2) c2.innerHTML = `${YP}${fmt(v)}냥`; if (q < 1) requestAnimationFrame(step); else shownCoin = null; };
    requestAnimationFrame(step);
  }, 700);
}
function countUp() {
  const rc = $('resCoin'); if (rc.classList.contains('hidden')) return;
  const to = +rc.dataset.to || 0, sp = rc.querySelector('span'), t0 = performance.now(), D = Math.min(1400, 500 + Math.abs(to) / 20);
  rc.classList.remove('pop'); void rc.offsetWidth;
  let lastB = 0;
  const step = t => {
    const q = Math.min(1, (t - t0) / D), v = to * (1 - Math.pow(1 - q, 3));
    sp.textContent = (to >= 0 ? '+' : '-') + fmt(Math.abs(v));
    if (t - lastB > 70 && q < 1) { lastB = t; beep('tick'); }
    if (q < 1) requestAnimationFrame(step); else { rc.classList.add('pop'); if (to > 0) { beep('coin'); flash('gold'); } }
  };
  requestAnimationFrame(step);
}
function showResult() {
  const st = g, r = st.res; if (!r) return;
  const k = `${st.gid}-res`;
  if (shownRes === k) return;
  shownRes = k;
  clearTimeout(aiT);
  const me = meIdx(st);
  const w = r.winner;
  let title, text = '', img = 'ggaebi-win';
  if (r.why === 'left') { title = '판이 멈췄어요'; text = `${esc(st.players[r.left] ? st.players[r.left].name : '친구')}님이 나갔어요.`; img = 'ggaebi-think'; }
  else if (r.nagari) { bigPop('나가리', '', '', 'nagari'); beep('ppuk'); title = '나가리!'; text = '아무도 나지 못했어요. 다음 판은 점수가 두 배예요.'; img = 'ggaebi-think'; }
  else {
    title = w === me ? '내가 이겼어요!' : `${esc(st.players[w].name)} 승리!`;
    if (w !== me) img = me >= 0 ? 'ggaebi-win' : 'ggaebi-win';
    if (r.why === 'chongtong') text = `${r.chong}월 카드 넉 장! <b style="color:var(--coral-d);font-weight:normal">총통</b>으로 바로 이겨요.`;
    else text = `${r.sum}점을 얻었어요.`;
  }
  if (r.why !== 'left' && !r.nagari) {
    if (w === me) { beep('win'); KBGM.jingle(); } else if (me >= 0) { beep('lose'); img = 'ggaebi-win'; }
    bigPop(r.why === 'chongtong' ? '총통!' : '스톱!', 'red', '', r.why === 'chongtong' ? 'chongtong' : 'stop'); beep('stop'); flash('gold');
    if (r.rows.some(x => x.bak.includes('피박'))) setTimeout(() => { bigPop('피박!', 'red', '', 'pibak'); beep('ppuk'); }, 1100);
  }
  $('resImg').src = `img/${w === me && mode === 'cpu' ? 'ggaebi-lose' : img}.webp`;
  $('resTitle').textContent = title.replace(/&[^;]+;/g, '');
  $('resTitle').innerHTML = title;
  $('resText').innerHTML = text;
  // 점수 내용
  let lines = '';
  if (r.ws) {
    const s = r.ws;
    if (s.g) lines += `<div><span>광 ${s.gN}장</span><span>${s.g}점</span></div>`;
    if (s.a) lines += `<div><span>열끗 ${s.aN}장${s.godori ? ' · 고도리' : ''}</span><span>${s.a}점</span></div>`;
    if (s.r) lines += `<div><span>띠 ${s.rN}장${s.hong ? ' · 홍단' : ''}${s.cheong ? ' · 청단' : ''}${s.cho ? ' · 초단' : ''}</span><span>${s.r}점</span></div>`;
    if (s.p) lines += `<div><span>피 ${s.pN}장</span><span>${s.p}점</span></div>`;
  }
  (r.detail || []).forEach(d => { if (!/^총통/.test(d)) lines += `<div><span>${esc(d.replace(/ [+×].*$/, ''))}</span><span>${esc(d.match(/[+×].*$/) ? d.match(/[+×].*$/)[0] : '')}</span></div>`; });
  $('resLines').innerHTML = lines;
  // 엽전 정산
  const stk = st.stake || 10, played = r.why !== 'left' && !r.nagari;
  const payOf = i => r.rows.filter(x => (x.payer != null ? x.payer : x.i) === i).reduce((a, x) => a + x.pay, 0);
  const dl = st.players.map((p, i) => !played ? 0 : (i === w ? r.sum : -payOf(i)) * stk);
  let myD = 0;
  if (me >= 0 && played) {
    myD = dl[me] < 0 ? -Math.min(coin, -dl[me]) : dl[me];
    if (store('hwatu-paid') !== st.gid) { store('hwatu-paid', st.gid); const before = coin; setCoin(coin + myD); coinShow(before, coin, w, r); }
  }
  const rc = $('resCoin');
  rc.classList.toggle('hidden', !(me >= 0 && played));
  rc.className = 'res-coin ' + (myD >= 0 ? 'plus' : 'minus') + (me >= 0 && played ? '' : ' hidden');
  rc.innerHTML = `${YP}<span>${myD >= 0 ? '+' : '-'}0</span>냥`;
  rc.dataset.to = myD;
  $('resWallet').innerHTML = me >= 0 ? (coin <= 0 ? '<div class="broke">엽전이 다 떨어졌어요!</div>' : `내 엽전 ${fmt(coin)}냥 · 점당 ${fmt(stk)}냥 판`) : '';
  // 사람별
  let tb = '<tr><th>이름</th><th>이번 판</th><th>엽전</th></tr>';
  st.players.forEach((p, i) => {
    let now = '';
    if (r.why !== 'left' && !r.nagari) {
      if (i === w) now = `+${r.sum}`;
      else {
        const row = r.rows.find(x => x.i === i);
        const pays = r.rows.filter(x => (x.payer != null ? x.payer : x.i) === i).reduce((a, x) => a + x.pay, 0);
        now = (pays ? `-${pays}` : '0') + (row ? row.bak.map(b => `<span class="bak">${b}</span>`).join('') : '') + (r.gobak === i ? '<span class="bak">고박</span>' : '');
      }
    }
    tb += `<tr class="${i === w ? 'win' : ''}"><td>${esc(i === me ? p.name + ' (나)' : p.name)}</td><td>${now}</td><td>${played ? (dl[i] > 0 ? '+' : '') + fmt(i === me ? myD : dl[i]) : '-'}</td></tr>`;
  });
  $('resTable').innerHTML = tb;
  let b = '';
  const broke = me >= 0 && coin <= 0, canRefill = broke && store('hwatu-refill') !== today();
  if (mode === 'cpu') b = '<button class="game-btn btn-secondary" id="rQuit">그만하기</button>' + (!broke ? '<button class="game-btn btn-primary" id="rNext">한 판 더</button>' : canRefill ? `<button class="game-btn btn-primary" id="rRefill">엽전 ${fmt(REFILL)}냥 받고 한 판 더</button>` : '<p class="note" style="width:100%">오늘 받을 엽전을 다 썼어요. 내일 다시 놀아요.</p>');
  else if (role === 'host') b = '<button class="game-btn btn-secondary" id="rLobby">대기실로</button>' + (r.why === 'left' ? '' : '<button class="game-btn btn-primary" id="rNext">한 판 더</button>');
  else b = `<button class="game-btn btn-secondary" id="rQuit">나가기</button><p class="note" style="width:100%">방장이 다음 판을 시작하길 기다려요<span class="dots"></span></p>`;
  $('resBtns').innerHTML = b;
  const on = (id, fn) => { const x = $(id); if (x) x.onclick = fn; };
  on('rQuit', () => { if (mode === 'online') leaveOnline(); else leaveLocal(); });
  on('rNext', () => { $('resultModal').classList.add('hidden'); if (mode === 'cpu') receive(HT.nextRound(g, Date.now())); else nextOnline(); });
  on('rLobby', backToLobby);
  on('rRefill', () => { if (refill()) { $('resultModal').classList.add('hidden'); receive(HT.nextRound(g, Date.now())); } });
  setTimeout(() => { if (g && g.phase === 'end' && `${g.gid}-res` === k) { $('resultModal').classList.remove('hidden'); countUp(); } }, r.why === 'left' ? 0 : r.rows && r.rows.some(x => x.bak.includes('피박')) ? 2300 : 1300);
}

// ============================================================
//  시작, 그만하기
// ============================================================
function startCpu(n) {
  const name = getName(); if (!name) return;
  mode = 'cpu'; role = 'host';
  const ps = [{ id: myId, name }];
  for (let k = 0; k < n - 1; k++) ps.push({ id: 'ai' + k, name: AI[k].name, ai: level, av: AI[k].av });
  g = null; pendingG = null;
  show('game');
  receive(HT.newGame(ps, { stake }, Date.now()));
}
$('cpu2Btn').onclick = () => startCpu(2);
$('cpu3Btn').onclick = () => startCpu(3);
function leaveLocal() {
  clearTimeout(aiT);
  if (unsub) { unsub(); unsub = null; }
  mode = null; g = null; pendingG = null; room = null; ref = null; code = ''; sstore('hwatu-room', null);
  hideModals(); show('startScreen');
}
function confirmBox(title, text, yes, fn) {
  $('cfTitle').textContent = title; $('cfText').textContent = text; $('cfYes').textContent = yes;
  $('cfYes').onclick = () => { $('confirmModal').classList.add('hidden'); fn(); };
  $('cfNo').onclick = () => $('confirmModal').classList.add('hidden');
  $('confirmModal').classList.remove('hidden');
}
function askLeave() {
  if (mode === 'online') { confirmBox('방에서 나갈까요?', role === 'watch' ? '구경을 그만해요.' : '지금 판은 멈춰요.', '나가기', leaveOnline); return; }
  confirmBox('그만할까요?', '처음 화면으로 돌아가요.', '그만하기', leaveLocal);
}

// ============================================================
//  방 코드 대결 (Firebase)
// ============================================================
const ROOMS = 'hwatu-rooms';
const STALE_MS = 3 * 60 * 60 * 1000;
async function fb() {
  if (FB) return FB;
  const [A, F] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js')
  ]);
  const app = A.initializeApp({
    apiKey: 'AIzaSyDw2EvTh7PVBrPnkii2F1kPGcqbzcIo41s',
    authDomain: 'honamsaem-class-games.firebaseapp.com',
    projectId: 'honamsaem-class-games',
    storageBucket: 'honamsaem-class-games.firebasestorage.app',
    messagingSenderId: '251087835017',
    appId: '1:251087835017:web:ef601265c56affe8ca1b58'
  });
  FB = Object.assign({ db: F.getFirestore(app) }, F);
  return FB;
}
function errText(e) {
  const c = (e && (e.code || e.message)) || '';
  if (String(c).includes('permission')) return '방 기능을 아직 쓸 수 없어요. 잠시 뒤에 다시 해 주세요.';
  if (String(c).includes('unavailable') || !navigator.onLine) return '인터넷 연결을 확인해 주세요.';
  return '잠시 후 다시 해 주세요.';
}
async function cleanupOld() {
  try {
    const F = await fb();
    const q = F.query(F.collection(F.db, ROOMS), F.where('updatedAt', '<', F.Timestamp.fromMillis(Date.now() - STALE_MS)), F.limit(20));
    (await F.getDocs(q)).forEach(d => F.deleteDoc(d.ref).catch(() => {}));
  } catch (e) {}
}
$('createBtn').onclick = async () => {
  const name = getName(); if (!name || busy) return;
  busy = true; $('createBtn').disabled = true; $('startMsg').textContent = '';
  try {
    const F = await fb();
    let made = null;
    for (let i = 0; i < 12 && !made; i++) {
      const c = String(1000 + Math.floor(Math.random() * 9000));
      const r = F.doc(F.db, ROOMS, c);
      made = await F.runTransaction(F.db, async tx => {
        const s = await tx.get(r);
        if (s.exists()) {
          const d = s.data(), age = Date.now() - (d.updatedAt ? d.updatedAt.toMillis() : 0);
          if (d.status !== 'closed' && age < STALE_MS) return null;
        }
        tx.set(r, { code: c, status: 'waiting', hostId: myId, members: [{ id: myId, name }], g: null, createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp() });
        return c;
      });
    }
    if (!made) throw new Error('full');
    await enterRoom(made);
    cleanupOld();
  } catch (e) { console.error(e); $('startMsg').textContent = '방을 만들지 못했어요. ' + errText(e); }
  busy = false; $('createBtn').disabled = false;
};
$('codeInput').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
$('codeInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('joinBtn').click(); });
$('joinBtn').onclick = async () => {
  const name = getName(); if (!name || busy) return;
  const c = $('codeInput').value;
  if (!/^\d{4}$/.test(c)) { $('startMsg').textContent = '방 코드 숫자 4개를 적어 주세요.'; return; }
  busy = true; $('joinBtn').disabled = true; $('startMsg').textContent = '';
  try { await joinRoom(c, name); await enterRoom(c); }
  catch (e) {
    console.error(e);
    $('startMsg').textContent = e.message === 'none' ? `${c}번 방이 없어요. 번호를 다시 확인해 주세요.`
      : e.message === 'closed' ? `${c}번 방은 이미 닫혔어요.` : '들어가지 못했어요. ' + errText(e);
  }
  busy = false; $('joinBtn').disabled = false;
};
async function joinRoom(c, name) {
  const F = await fb(), r = F.doc(F.db, ROOMS, c);
  return F.runTransaction(F.db, async tx => {
    const s = await tx.get(r);
    if (!s.exists()) throw new Error('none');
    const d = s.data(), age = Date.now() - (d.updatedAt ? d.updatedAt.toMillis() : 0);
    if (d.status === 'closed' || age > STALE_MS) throw new Error('closed');
    const ms = d.members || [];
    const at = ms.findIndex(m => m.id === myId);
    if (at >= 0) { if (name && ms[at].name !== name && d.status === 'waiting') { ms[at].name = name; tx.update(r, { members: ms, updatedAt: F.serverTimestamp() }); } return 'player'; }
    if (d.status === 'waiting' && ms.length < 3 && name) { ms.push({ id: myId, name }); tx.update(r, { members: ms, updatedAt: F.serverTimestamp() }); return 'player'; }
    return 'watch';
  });
}
async function enterRoom(c) {
  const F = await fb();
  mode = 'online'; code = c; ref = F.doc(F.db, ROOMS, c);
  sstore('hwatu-room', c);
  g = null; pendingG = null; room = null;
  if (unsub) unsub();
  unsub = F.onSnapshot(ref, onRoom, e => { console.error(e); toast('연결이 끊겼어요. ' + errText(e), 3000); });
  $('sideCode').textContent = c;
}
function onRoom(snap) {
  if (!snap.exists()) { toast('방이 사라졌어요.', 2500); leaveLocal(); return; }
  const prev = room;
  room = snap.data();
  if (room.status === 'closed') { toast('방이 닫혔어요.', 2500); leaveLocal(); return; }
  const ms = room.members || [];
  role = room.hostId === myId ? 'host' : ms.some(m => m.id === myId) ? 'player' : 'watch';
  if (room.status === 'waiting') {
    if (prev && prev.members && ms.length > prev.members.length) beep('join');
    g = null; pendingG = null; hideModals(); showWait(); return;
  }
  if ($('game').classList.contains('hidden')) show('game');
  if (room.g) {
    const cur = latest();
    if (cur && cur.gid === room.g.gid && room.g.seq <= cur.seq) { if (!animating) { render(); after(); } }
    else receive(room.g);
  }
}
function showWait() {
  show('waitScreen');
  $('codeBig').innerHTML = code.split('').map(ch => `<span>${ch}</span>`).join('');
  const ms = room.members || [];
  $('memberList').innerHTML = ms.map(m => `<span class="${m.id === myId ? 'me' : ''}">${esc(m.name)}${m.id === room.hostId ? '<small>방장</small>' : ''}</span>`).join('');
  $('waitTags').innerHTML = `<span class="tag">${ms.length === 3 ? '고스톱 (3명)' : '맞고 (2명)'}</span><span class="tag">${ms.length}/3명</span>`;
  let lead, b = '';
  if (role === 'host') {
    lead = ms.length < 2 ? '친구에게 이 번호를 알려 주세요.<br><span class="dots">친구를 기다리는 중</span>' : ms.length === 2 ? '둘이면 맞고, 한 명 더 오면 고스톱이에요.' : '모두 모였어요!';
    b = `<button class="game-btn btn-secondary" id="wClose">방 없애기</button><button class="game-btn btn-primary" id="wStart" ${ms.length < 2 ? 'disabled' : ''}>시작! (${ms.length}명)</button>`;
  } else if (role === 'player') {
    lead = '방장이 시작하길 기다려요<span class="dots"></span>';
    b = '<button class="game-btn btn-secondary" id="wLeave">나가기</button>';
  } else {
    lead = ms.length < 3 ? '함께하려면 참가하기를 눌러요.' : '자리가 꽉 찼어요. 구경할 수 있어요.';
    b = '<button class="game-btn btn-secondary" id="wLeave">나가기</button>' + (ms.length < 3 ? '<button class="game-btn btn-primary" id="wJoin">참가하기</button>' : '');
  }
  $('waitLead').innerHTML = lead;
  $('waitBtns').innerHTML = b;
  const on = (id, fn) => { const x = $(id); if (x) x.onclick = fn; };
  on('wClose', async () => { try { const F = await fb(); await F.updateDoc(ref, { status: 'closed', updatedAt: F.serverTimestamp() }); } catch (e) {} leaveLocal(); });
  on('wStart', startOnline);
  on('wLeave', leaveOnline);
  on('wJoin', async () => { const n = store('hwatu-name') || $('nameInput').value.trim().slice(0, 8) || '친구'; try { await joinRoom(code, n); } catch (e) { toast('참가하지 못했어요. ' + errText(e), 2500); } });
}
async function startOnline() {
  try {
    const F = await fb();
    await F.runTransaction(F.db, async tx => {
      const s = await tx.get(ref); const d = s.data();
      if (!d || d.status !== 'waiting' || d.hostId !== myId || (d.members || []).length < 2) return;
      const ng = HT.newGame(d.members.slice(0, 3).map(m => ({ id: m.id, name: m.name })), { stake }, Date.now());
      tx.update(ref, { status: 'playing', g: ng, updatedAt: F.serverTimestamp() });
    });
  } catch (e) { console.error(e); toast('시작하지 못했어요. ' + errText(e), 2500); }
}
async function nextOnline() {
  try {
    const F = await fb();
    await F.runTransaction(F.db, async tx => {
      const s = await tx.get(ref); const d = s.data();
      if (!d || !d.g || d.g.phase !== 'end' || d.hostId !== myId) return;
      tx.update(ref, { g: HT.nextRound(d.g, Date.now()), updatedAt: F.serverTimestamp() });
    });
  } catch (e) { console.error(e); toast('시작하지 못했어요. ' + errText(e), 2500); }
}
async function backToLobby() {
  try {
    const F = await fb();
    await F.runTransaction(F.db, async tx => {
      const s = await tx.get(ref); const d = s.data();
      if (!d || d.hostId !== myId) return;
      tx.update(ref, { status: 'waiting', g: null, updatedAt: F.serverTimestamp() });
    });
  } catch (e) { console.error(e); toast('잠시 후 다시 해 주세요.', 2000); }
}
async function onlineAct(a) {
  try {
    const F = await fb();
    let err = null;
    await F.runTransaction(F.db, async tx => {
      const s = await tx.get(ref); const d = s.data();
      if (!d || !d.g) { err = 'nog'; return; }
      const ng = d.g;
      const who = ng.players.findIndex(p => p.id === myId);
      err = HT.act(ng, who, a, Date.now());
      if (err) return;
      tx.update(ref, { g: ng, updatedAt: F.serverTimestamp() });
    });
    return err;
  } catch (e) { console.error(e); toast('보내지 못했어요. ' + errText(e), 2000); return 'net'; }
}
async function leaveOnline() {
  const rf = ref, me = myId;
  leaveLocal();
  if (!rf) return;
  try {
    const F = await fb();
    await F.runTransaction(F.db, async tx => {
      const s = await tx.get(rf); const d = s.data(); if (!d) return;
      const ms = (d.members || []).filter(m => m.id !== me);
      if (ms.length === (d.members || []).length) return;
      const up = { members: ms, updatedAt: F.serverTimestamp() };
      if (d.hostId === me) { if (ms.length) up.hostId = ms[0].id; else up.status = 'closed'; }
      if (d.g) {
        const ng = d.g, i = ng.players.findIndex(p => p.id === me);
        if (i >= 0 && !HT.act(ng, i, { t: 'leave' }, Date.now())) up.g = ng;
      }
      tx.update(rf, up);
    });
  } catch (e) {}
}

// ============================================================
//  규칙
// ============================================================
const row = ids => `<div class="row">${ids.map(id => cardH(id)).join('')}</div>`;
const HELP = {
  matgo: `
<h3>어떻게 해요?</h3>
  <p>내 차례에 손에 든 카드를 한 장 내요. 바닥에 <b>같은 달</b> 카드가 있으면 짝을 맞춰 가져와요. 그다음 더미에서 한 장을 뒤집어서, 같은 달이 있으면 그것도 가져와요.</p>
    <p><b>깨비와 둘이</b> 해요. 손에 10장, 바닥에 8장으로 시작하고, <b>7점</b>이 나면 고나 스톱을 고를 수 있어요.</p>
<h3>점수</h3>
  <p><b>광</b> 3장 3점 (비광이 끼면 2점), 4장 4점, 5장 15점</p>${row(GWANG)}
  <p><b>열끗</b> 5장 1점, 한 장 더할 때마다 1점. <b>고도리</b>(새 세 마리) 5점</p>${row(GODORI)}
  <p><b>띠</b> 5장 1점, 한 장 더할 때마다 1점. <b>홍단 · 청단 · 초단</b> 3장씩 모으면 3점</p>${row(HONG)}${row(CHEONG)}${row(CHO)}
  <p><b>피</b> 10장 1점, 한 장 더할 때마다 1점. 쌍피는 두 장으로 쳐요. 9월 술잔은 열끗이나 쌍피 중 점수가 좋은 쪽으로 쳐요.</p>${row([HT.C(11, 2), HT.C(12, 4), HT.C(9, 1)])}
  <h3>고 · 스톱</h3>
  <p>점수가 나면 <b>고</b>(계속해서 점수 더 내기)나 <b>스톱</b>(여기서 이기기)을 골라요. 1고 +1점, 2고 +2점, 3고부터는 점수가 두 배씩 커져요.</p>
  
  <p>고를 했는데 상대가 먼저 나면 <b>고박</b>이라 두 배를 물어요.</p>
<h3>특별한 일</h3>
  <p><b>쪽</b> · 낸 카드와 뒤집은 카드가 짝이 되면 가져오고, 모두에게 피를 한 장씩 받아요.</p>
  <p><b>뻑</b> · 짝을 맞췄는데 뒤집은 카드도 같은 달이면 석 장이 바닥에 남아요. 나중에 남은 한 장으로 넉 장을 다 가져오면 피를 한 장씩 받아요.</p>
  <p><b>따닥</b> · 바닥의 두 장과 내 카드, 뒤집은 카드가 모두 같은 달이면 넉 장을 다 가져오고 피를 한 장씩 받아요.</p>
  <p><b>싹쓸이</b> · 바닥 카드를 모두 가져오면 피를 한 장씩 받아요.</p>
  <p><b>흔들기</b> · 같은 달 석 장을 들고 있고 바닥에 그 달이 없을 때, 보여 주고 내면 이겼을 때 점수가 두 배예요.</p>
  <p><b>폭탄</b> · 같은 달 석 장을 들고 바닥에 한 장이 있으면 넉 장을 한꺼번에 가져와요. 점수가 두 배, 피도 한 장씩 받고, 다음 두 번은 더미만 뒤집어요.</p>
  <p><b>총통</b> · 처음 받은 카드에 같은 달 넉 장이 있으면 바로 이겨요 (10점).</p>
  <p><b>나가리</b> · 아무도 나지 못하면 다음 판 점수가 두 배예요.</p>
  <h3>박</h3>
  <p>이긴 사람이 피로 점수를 냈는데 진 사람 피가 7장 이하면 <b>피박</b>, 광으로 점수를 냈는데 진 사람 광이 없으면 <b>광박</b>, 이긴 사람 열끗이 7장 이상이면 <b>멍박</b>. 하나마다 두 배예요.</p>
    <h3>엽전</h3>
  <p>처음에 1만 냥을 들고 시작해요. 진 사람은 <b>점수 × 점당 판돈</b>만큼 이긴 사람에게 엽전을 줘요. 점당 100냥 판은 3천 냥, 1,000냥 판은 3만 냥이 있어야 들어갈 수 있어요. 엽전이 다 떨어지면 깨비가 하루 한 번 5천 냥을 줘요. 엽전은 이 기기에만 저장되고, 진짜 돈이 아니에요.</p>`,
  gostop: `
<h3>어떻게 해요?</h3>
  <p>내 차례에 손에 든 카드를 한 장 내요. 바닥에 <b>같은 달</b> 카드가 있으면 짝을 맞춰 가져와요. 그다음 더미에서 한 장을 뒤집어서, 같은 달이 있으면 그것도 가져와요.</p>
    <p><b>깨비 둘과 셋이</b> 해요. 손에 7장, 바닥에 6장으로 시작하고, <b>3점</b>이 나면 고나 스톱을 고를 수 있어요.</p>
<h3>점수</h3>
  <p><b>광</b> 3장 3점 (비광이 끼면 2점), 4장 4점, 5장 15점</p>${row(GWANG)}
  <p><b>열끗</b> 5장 1점, 한 장 더할 때마다 1점. <b>고도리</b>(새 세 마리) 5점</p>${row(GODORI)}
  <p><b>띠</b> 5장 1점, 한 장 더할 때마다 1점. <b>홍단 · 청단 · 초단</b> 3장씩 모으면 3점</p>${row(HONG)}${row(CHEONG)}${row(CHO)}
  <p><b>피</b> 10장 1점, 한 장 더할 때마다 1점. 쌍피는 두 장으로 쳐요. 9월 술잔은 열끗이나 쌍피 중 점수가 좋은 쪽으로 쳐요.</p>${row([HT.C(11, 2), HT.C(12, 4), HT.C(9, 1)])}
  <h3>고 · 스톱</h3>
  <p>점수가 나면 <b>고</b>(계속해서 점수 더 내기)나 <b>스톱</b>(여기서 이기기)을 골라요. 1고 +1점, 2고 +2점, 3고부터는 점수가 두 배씩 커져요.</p>
  
  <p>고를 했는데 다른 사람이 먼저 나면 <b>고박</b>이에요. 고를 외친 사람이 진 사람 몫까지 혼자 다 물어 줘요.</p>
<h3>특별한 일</h3>
  <p><b>쪽</b> · 낸 카드와 뒤집은 카드가 짝이 되면 가져오고, 모두에게 피를 한 장씩 받아요.</p>
  <p><b>뻑</b> · 짝을 맞췄는데 뒤집은 카드도 같은 달이면 석 장이 바닥에 남아요. 나중에 남은 한 장으로 넉 장을 다 가져오면 피를 한 장씩 받아요.</p>
  <p><b>따닥</b> · 바닥의 두 장과 내 카드, 뒤집은 카드가 모두 같은 달이면 넉 장을 다 가져오고 피를 한 장씩 받아요.</p>
  <p><b>싹쓸이</b> · 바닥 카드를 모두 가져오면 피를 한 장씩 받아요.</p>
  <p><b>흔들기</b> · 같은 달 석 장을 들고 있고 바닥에 그 달이 없을 때, 보여 주고 내면 이겼을 때 점수가 두 배예요.</p>
  <p><b>폭탄</b> · 같은 달 석 장을 들고 바닥에 한 장이 있으면 넉 장을 한꺼번에 가져와요. 점수가 두 배, 피도 한 장씩 받고, 다음 두 번은 더미만 뒤집어요.</p>
  <p><b>총통</b> · 처음 받은 카드에 같은 달 넉 장이 있으면 바로 이겨요 (10점).</p>
  <p><b>나가리</b> · 아무도 나지 못하면 다음 판 점수가 두 배예요.</p>
  <h3>박</h3>
  <p>이긴 사람이 피로 점수를 냈는데 진 사람 피가 7장 이하면 <b>피박</b>, 광으로 점수를 냈는데 진 사람 광이 없으면 <b>광박</b>, 이긴 사람 열끗이 7장 이상이면 <b>멍박</b>. 하나마다 두 배예요.</p>
    <h3>엽전</h3>
  <p>처음에 1만 냥을 들고 시작해요. 진 사람은 <b>점수 × 점당 판돈</b>만큼 이긴 사람에게 엽전을 줘요. 점당 100냥 판은 3천 냥, 1,000냥 판은 3만 냥이 있어야 들어갈 수 있어요. 엽전이 다 떨어지면 깨비가 하루 한 번 5천 냥을 줘요. 엽전은 이 기기에만 저장되고, 진짜 돈이 아니에요.</p>`,
  sutda: `
  <h3>어떻게 해요?</h3>
  <p>1월부터 10월까지 20장으로 두 장씩 받아요. 두 번째 패는 손가락으로 밀어 올려 <b>쪼아</b> 봐요. 차례대로 <b>체크</b>, <b>삥</b>, <b>콜</b>, <b>하프</b>(판돈 절반 더), <b>따당</b>(앞 사람의 두 배), <b>다이</b>(포기) 중에 골라요.</p>
  <h3>족보</h3>
  <p> 38광땡 &gt; 18·13광땡 &gt; 장땡 &gt; 9땡 … 삥땡 &gt; 알리(1·2) &gt; 독사(1·4) &gt; 구삥(1·9) &gt; 장삥(1·10) &gt; 장사(10·4) &gt; 세륙(4·6) &gt; 갑오(9끗) … 망통(0끗).</p>
  <h3>특별한 패</h3>
  <p><b>땡잡이</b>(3광·7열끗)는 1~9땡을, <b>암행어사</b>(4·7 열끗)는 18·13광땡을 잡아요. <b>구사</b>(4·9)는 상대가 알리 이하면, <b>멍텅구리 구사</b>(4·9 열끗)는 9땡 이하면 다시 해요.</p>
  <h3>엽전</h3>
  <p>처음에 1만 냥을 들고 시작해요. 한 판마다 <b>점당 판돈의 10배</b>를 먼저 걸고, 이긴 사람이 판에 모인 엽전을 모두 가져가요. 엽전이 다 떨어지면 깨비가 하루 한 번 5천 냥을 줘요. 엽전은 이 기기에만 저장되고, 진짜 돈이 아니에요.</p>`,
};
function helpTab(k) {
  $('helpList').innerHTML = HELP[k];
  document.querySelectorAll('#helpTabs button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  $('helpList').scrollTop = 0;
}
document.querySelectorAll('#helpTabs button').forEach(b => b.onclick = () => helpTab(b.dataset.k));
helpTab('matgo');
$('helpBtn').onclick = () => $('helpModal').classList.remove('hidden');
$('helpClose').onclick = () => $('helpModal').classList.add('hidden');

// 새로 고침해도 방으로 돌아오기
(async () => {
  const c = sstore('hwatu-room');
  if (!c) return;
  try { await joinRoom(c, store('hwatu-name') || ''); await enterRoom(c); }
  catch (e) { sstore('hwatu-room', null); }
})();

// 시험용
window.__ht = { get g() { return g; }, startCpu, doMine };
// 섯다(sutda.js)와 나눠 쓰는 것들
window.HW = { $, esc, setTrack, charPop, rnd, sleep, store, beep, bigPop, flash, sparkle, slam, toast, show, getName, confirmBox, cardH, backH, IMG, YP, fmt, AI, PAL, REFILL, today, refill, updStake,
  get coin() { return coin; }, setCoin, get stake() { return stake; }, get level() { return level; }, hideModals };
})();
