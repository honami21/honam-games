// 깨비샘의 GGAEBI 카드 게임: 화면, AI, 방 코드 대결
(() => {
'use strict';
const $ = id => document.getElementById(id);
const { COLORS, CNAME, isWild, colOf, valOf, canPlay, nxt } = GG;
const PLAYING = ['play', 'drawn', 'pick', 'challenge'];
const clone = o => JSON.parse(JSON.stringify(o));
const rnd = (a, b) => a + Math.random() * (b - a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
function sstore(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { return null; } }

let myId = store('cards-id');
if (!myId) { myId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); store('cards-id', myId); }
$('nameInput').value = store('cards-name') || '';

// ---------- 고르기 버튼 ----------
function seg(id, key, def, allowed) {
  let v = +(store(key) ?? def); if (!allowed.includes(v)) v = def;
  const upd = () => document.querySelectorAll(`#${id} button`).forEach(b => b.classList.toggle('on', +b.dataset.v === v));
  $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; v = +b.dataset.v; store(key, v); upd(); tagsAll(); });
  upd();
  return () => v;
}
const getTarget = seg('tgSeg', 'cards-target', 0, [0, 200, 500]);
const getSec = seg('secSeg', 'cards-sec', 30, [0, 20, 30, 60]);
const getAiN = seg('aiNSeg', 'cards-ain', 2, [1, 2, 3, 4, 5]);
const tgText = t => t ? `${t}점 먼저` : '한 판만';
function tagsAll() {
  $('cpuTags').innerHTML = `<span class="tag">${tgText(getTarget())}</span>`;
  $('localTags').innerHTML = `<span class="tag">${tgText(getTarget())}</span>`;
  $('createTags').innerHTML = `<span class="tag">${tgText(getTarget())}</span>`;
}
tagsAll();

// ---------- 소리 ----------
const SVG_SND_ON = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const SVG_SND_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
const SVG_MUSIC = '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>';
let soundOn = store('cards-sound') !== 'off';
let actx = null, noiseBuf = null;
function updSnd() { $('sndToggle').innerHTML = soundOn ? SVG_SND_ON : SVG_SND_OFF; $('sndToggle').classList.toggle('muted', !soundOn); }
updSnd();
$('sndToggle').onclick = () => { soundOn = !soundOn; store('cards-sound', soundOn ? 'on' : 'off'); updSnd(); $('sndToggle').blur(); };
function beep(kind) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime;
    const tone = (f, s, d, type = 'sine', v = .25, f2) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t + s); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + s + d);
      g.gain.setValueAtTime(v, t + s); g.gain.exponentialRampToValueAtTime(.001, t + s + d);
      o.connect(g); g.connect(actx.destination); o.start(t + s); o.stop(t + s + d + .02);
    };
    const noise = (s, d, v, hp) => {
      if (!noiseBuf) { noiseBuf = actx.createBuffer(1, actx.sampleRate * .4, actx.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
      const src = actx.createBufferSource(), g = actx.createGain(), f = actx.createBiquadFilter();
      src.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = hp || 2000; f.Q.value = .8;
      g.gain.setValueAtTime(v, t + s); g.gain.exponentialRampToValueAtTime(.001, t + s + d);
      src.connect(f); f.connect(g); g.connect(actx.destination); src.start(t + s); src.stop(t + s + d + .02);
    };
    if (kind === 'card') { noise(0, .09, .5, 1800); tone(180, 0, .08, 'sine', .25); }
    else if (kind === 'draw') { noise(0, .14, .25, 3500); }
    else if (kind === 'deal') { noise(0, .05, .18, 3000); }
    else if (kind === 'gg') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .07, .22, 'triangle', .22)); }
    else if (kind === 'catch') { tone(300, 0, .25, 'square', .12, 900); tone(900, .2, .25, 'triangle', .2, 400); }
    else if (kind === 'skip') { tone(700, 0, .08, 'triangle', .2); tone(500, .08, .12, 'triangle', .2); }
    else if (kind === 'turn') { tone(880, 0, .12, 'triangle', .18); tone(1320, .1, .18, 'triangle', .15); }
    else if (kind === 'bad') { tone(180, 0, .18, 'sawtooth', .12); }
    else if (kind === 'win') { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * .11, .32, 'triangle', .22)); }
    else if (kind === 'lose') { [392, 330, 262].forEach((f, i) => tone(f, i * .16, .35, 'sine', .2)); }
    else if (kind === 'join') { tone(660, 0, .15, 'triangle'); tone(880, .12, .2, 'triangle'); }
    else if (kind === 'shuffle') { for (let i = 0; i < 6; i++) noise(i * .05, .05, .2, 2500); }
  } catch (e) {}
}
window.addEventListener('pointerdown', () => { if (actx && actx.state === 'suspended') actx.resume(); }, { passive: true });

// 배경 음악 (지금은 체스 음악을 빌려 써요. cards/audio에 새 곡이 오면 바꿔요)
const MUSIC = { lobby: '../chess/audio/bgm-lobby.mp3', play: '../chess/audio/bgm-play.mp3', tense: '../chess/audio/bgm-tense.mp3' };
KBGM.init({ key: 'cards', tracks: MUSIC, start: 'lobby' });
KBGM.button({ after: $('sndToggle'), icon: SVG_MUSIC });

// ---------- 그림 (있으면 쓰고, 없으면 그려서 보여요) ----------
const ART = {};
['logo', 'card-back', 'text-ggaebi', 'text-catch', 'text-challenge'].forEach(n => {
  const i = new Image();
  i.onload = () => {
    ART[n] = true;
    if (n === 'logo') $('logoBox').innerHTML = '<img class="logo" src="img/logo.png" alt="깨비샘의 GGAEBI">';
    if (n === 'card-back' && g) render();
  };
  i.src = `img/${n}.${n === 'card-back' ? 'jpg' : 'png'}`;
});
['ggaebi-win', 'ggaebi-lose', 'ggaebi-think', 'ggaebi-hello', 'ggaebi-wait'].forEach(n => { const i = new Image(); i.src = `img/${n}.png`; });

// ---------- 카드 그리기 ----------
const SVG_SKIP = '<svg viewBox="0 0 40 40"><g fill="#fff" stroke="#2c2950" stroke-width="3" stroke-linejoin="round"><path d="M4 8 L17 20 L4 32 Z"/><path d="M17 8 L30 20 L17 32 Z"/><rect x="31" y="8" width="6" height="24" rx="2"/></g></svg>';
const SVG_REV = '<svg viewBox="0 0 40 40"><g fill="#fff" stroke="#2c2950" stroke-width="3" stroke-linejoin="round"><path d="M3 12 L15 2 V8 H33 V16 H15 V22 Z"/><path d="M37 28 L25 18 V24 H7 V32 H25 V38 Z"/></g></svg>';
const PETAL = 'M20 20 C19 11 23 4 31 3 C32 11 28 18 20 20Z';
const SVG_PIN = cls => `<svg class="pin ${cls}" viewBox="0 0 40 40"><g stroke="#2c2950" stroke-width="2.2" stroke-linejoin="round">` +
  ['--cr', '--cy', '--cg', '--cb'].map((v, i) => `<path d="${PETAL}" style="fill:var(${v})" transform="rotate(${i * 90} 20 20)"/>`).join('') +
  '<circle cx="20" cy="20" r="3.6" fill="#fff"/></g></svg>';
function cardHTML(c, cls = '') {
  if (c === 'back') return `<div class="cd back ${ART['card-back'] ? 'art' : ''} ${cls}"><div class="in"><span class="bt">GGAEBI</span></div></div>`;
  if (isWild(c)) {
    return c === 'F'
      ? `<div class="cd c-w ${cls}" data-c="F"><div class="in">${SVG_PIN('small')}<span class="plus4">+4</span></div><span class="k tl">+4</span><span class="k br">+4</span></div>`
      : `<div class="cd c-w ${cls}" data-c="W"><div class="in">${SVG_PIN('')}</div></div>`;
  }
  const col = c[0], v = valOf(c);
  let center, corner;
  if (v === 'S') { center = SVG_SKIP.replace('<svg', '<svg class="ico"'); corner = SVG_SKIP; }
  else if (v === 'R') { center = SVG_REV.replace('<svg', '<svg class="ico"'); corner = SVG_REV; }
  else if (v === 'D') { center = '<span class="big sm">+2</span>'; corner = '+2'; }
  else { center = `<span class="big ${v === '6' || v === '9' ? 'u' : ''}">${v}</span>`; corner = v; }
  return `<div class="cd c-${col} ${cls}" data-c="${c}"><div class="in">${center}</div><span class="k tl">${corner}</span><span class="k br">${corner}</span></div>`;
}
const CARD_NAME = c => {
  if (c === 'W') return '색 바꾸기';
  if (c === 'F') return '색 바꾸기 +4';
  const v = valOf(c), cn = CNAME[c[0]];
  return cn + ' ' + (v === 'S' ? '건너뛰기' : v === 'R' ? '방향 바꾸기' : v === 'D' ? '+2' : v);
};
const COLHEX = { r: 'var(--cr)', y: 'var(--cy)', g: 'var(--cg)', b: 'var(--cb)' };

// ---------- 상태 ----------
let mode = null;            // 'cpu' | 'local' | 'online'
let g = null;               // 화면에 보이는 게임 상태
let pendingG = null, animating = false;
let viewer = -1;            // 한 화면 모드: 지금 카드를 보는 사람
let level = 2;
let room = null, code = '', ref = null, role = '', unsub = null;
let FB = null, busy = false;
const AI_NAMES = ['깨비샘', '깨순이', '깨돌이', '깨롱이', '깨미'];
const AI_AV = ['avatar-ggaebisaem', 'avatar-ggaesun', 'avatar-ggaedol', 'avatar-ggaerong', 'avatar-ggaemi'];
const PAL = ['#ee5a6f', '#3a83e8', '#38b468', '#f39c32', '#8e6be0', '#e05aa8'];
const latest = () => pendingG || g;

function meIdx(st = g) {
  if (!st) return -1;
  if (mode === 'cpu') return 0;
  if (mode === 'local') return viewer;
  return st.players.findIndex(p => p.id === myId && !p.out);
}
const nm = (i, st = g) => i === meIdx(st) && mode !== 'local' ? '나' : (st.players[i] ? st.players[i].name : '?');
const nmS = (i, st = g) => i === meIdx(st) && mode !== 'local' ? '내가' : (st.players[i] ? st.players[i].name + '님이' : '');

let toastT = 0;
function toast(t, ms = 1800) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms); }
function bigPop(kind, sub) {
  const el = $('big');
  let h;
  if (kind === 'ggobi') h = ART['text-ggaebi'] ? '<img src="img/text-ggaebi.png" alt="GGAEBI!">' : '<div class="tx red">GGAEBI!</div>';
  else if (kind === 'catch') h = ART['text-catch'] ? '<img src="img/text-catch.png" alt="잡았다!">' : '<div class="tx">잡았다!</div>';
  else if (kind === 'chal') h = ART['text-challenge'] ? '<img src="img/text-challenge.png" alt="도전!">' : '<div class="tx mint">도전!</div>';
  else h = `<div class="tx">${esc(kind)}</div>`;
  el.innerHTML = h + (sub ? `<div class="sub">${esc(sub)}</div>` : '');
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
}

function show(id) {
  ['startScreen', 'waitScreen', 'game'].forEach(s => $(s).classList.toggle('hidden', s !== id));
  $('sideRoom').classList.toggle('hidden', !(id === 'game' && mode === 'online'));
  if (id !== 'game') { KBGM.track('lobby'); KBGM.calm(); }
  else { KBGM.track('play'); KBGM.full(); }
}
function hideModals() { ['colorModal', 'chalModal', 'revealModal', 'resultModal', 'confirmModal', 'stkTray', 'cover'].forEach(id => $(id).classList.add('hidden')); }
function getName() {
  const n = $('nameInput').value.trim().replace(/\s+/g, ' ').slice(0, 8);
  if (!n) { $('startMsg').textContent = '먼저 내 이름을 적어 주세요.'; $('nameInput').focus(); return null; }
  store('cards-name', n); return n;
}

// ============================================================
//  상태 받기 → 움직임 보여 주기 → 그리기
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
      if (!old || old.gid !== ng.gid) { g = ng; resetView(); render(); $('pileWrap').innerHTML = ''; $('hand').classList.add('dealing'); await animate(null, ng); $('hand').classList.remove('dealing'); }
      else { await animate(old, ng); g = ng; }
    } catch (e) { console.error(e); g = ng; }
    render();
  }
  animating = false;
  after();
}
function resetView() {
  viewer = -1; shownResult = ''; catchKey = ''; lastTurnKey = ''; clearTimeout(aiT); catchTimers.forEach(clearTimeout); catchTimers = [];
  hideModals();
}

// ---------- 날아가는 카드 ----------
function rectOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; }
function pileRect() { return rectOf($('pileWrap')); }
function deckRect() { return rectOf($('deckWrap')); }
function seatRect(i) {
  if (i === meIdx() && !$('hand').classList.contains('watch')) { const r = rectOf($('hand')); return { x: r.x, y: r.y + 10, w: 0, mine: true }; }
  const s = document.querySelector(`.seat[data-i="${i}"]`);
  return s ? rectOf(s) : { x: innerWidth / 2, y: 60, w: 0 };
}
function fly(html, from, to, opt = {}) {
  return new Promise(res => {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'fly'; el.innerHTML = html;
      document.body.appendChild(el);
      const c = el.firstElementChild, w = c.offsetWidth, h = c.offsetHeight;
      const s0 = opt.s0 ?? (from.w ? Math.min(1, Math.max(.3, from.w / w * .5)) : .5), s1 = opt.s1 ?? 1;
      el.style.transitionDuration = '0ms';
      el.style.transform = `translate(${from.x - w / 2}px,${from.y - h / 2}px) scale(${s0}) rotate(${opt.r0 || 0}deg)`;
      void el.offsetWidth;
      const d = opt.dur || 380;
      el.style.transitionDuration = d + 'ms';
      el.style.transform = `translate(${to.x - w / 2}px,${to.y - h / 2}px) scale(${s1}) rotate(${opt.r1 || 0}deg)`;
      setTimeout(() => { el.remove(); res(); }, d + 30);
    }, opt.delay || 0);
  });
}
function bubble(i, text) {
  let host = null;
  if (i === meIdx() && mode !== 'local') host = $('meBar');
  else if (mode === 'local' && i === viewer) host = $('meBar');
  else host = document.querySelector(`.seat[data-i="${i}"]`);
  if (!host) return;
  const b = document.createElement('span');
  b.className = 'bubble' + (host.id === 'meBar' ? ' up' : ''); b.textContent = text;
  host.appendChild(b); setTimeout(() => b.remove(), 1900);
}
function pileOnly(c, col) {   // 날아간 카드가 도착하면 버린 카드 더미만 먼저 바꿔요
  const w = $('pileWrap');
  const n = w.children.length;
  w.insertAdjacentHTML('beforeend', cardHTML(c));
  const el = w.lastElementChild; el.style.transform = `rotate(${(n * 37 % 17) - 8}deg)`;
  while (w.children.length > 3) w.firstElementChild.remove();
  w.style.setProperty('--cur', COLHEX[col] || 'transparent');
}

async function animate(old, ng) {
  const me = meIdx(ng);
  const fast = document.hidden;
  let chalEv = null;
  for (const e of ng.evs || []) {
    if (fast) continue;
    if (e.t === 'deal') {
      beep('shuffle');
      const ps = ng.players.map((p, i) => i).filter(i => !ng.players[i].out);
      const jobs = [];
      let k = 0;
      for (let r = 0; r < 7; r++) for (const i of ps) {
        jobs.push(fly(cardHTML('back'), deckRect(), seatRect(i), { s0: 1, s1: .35, dur: 300, delay: k * 28 }).then(() => { if (Math.random() < .3) beep('deal'); }));
        k++;
      }
      await Promise.all(jobs);
    } else if (e.t === 'flip') {
      await fly(cardHTML(e.c), deckRect(), pileRect(), { s0: 1, s1: 1, dur: 360, r0: -10 });
      beep('card'); pileOnly(e.c, ng.color);
    } else if (e.t === 'play') {
      let from = seatRect(e.p);
      if (e.p === me && !$('hand').classList.contains('watch')) {
        const el = [...$('hand').querySelectorAll('.cd')].find(x => x.dataset.c === e.c);
        if (el) { from = rectOf(el); from.w = el.offsetWidth * 1.12; el.style.visibility = 'hidden'; }
      }
      await fly(cardHTML(e.c), from, pileRect(), { s1: 1, dur: 380, r0: rnd(-25, 25), r1: rnd(-8, 8) });
      beep('card'); pileOnly(e.c, e.col);
      if (isWild(e.c)) bubble(e.p, CNAME[e.col] + '!');
    } else if (e.t === 'draw') {
      beep('draw');
      const jobs = [];
      for (let k = 0; k < Math.min(e.k, 8); k++) jobs.push(fly(cardHTML('back'), deckRect(), seatRect(e.p), { s0: 1, s1: e.p === me ? 1 : .35, dur: 340, delay: k * 110 }));
      await Promise.all(jobs);
      if (e.k >= 2) bubble(e.p, `+${e.k}장`);
    } else if (e.t === 'gg') {
      beep('gg'); bigPop('ggobi', e.early ? '' : `${nm(e.p, ng)} 휴, 안전!`); bubble(e.p, 'GGAEBI!');
      await sleep(e.early ? 350 : 600);
    } else if (e.t === 'catch') {
      beep('catch');
      const by = e.by >= 0 ? nm(e.by, ng) : '누군가';
      bigPop('catch', `${by} → ${nm(e.p, ng)} 2장!`);
      await sleep(700);
    } else if (e.t === 'skip') { beep('skip'); bubble(e.p, '쉬어요'); await sleep(250); }
    else if (e.t === 'rev') { beep('skip'); toast('방향이 바뀌었어요!', 1200); }
    else if (e.t === 'pick') { beep('card'); bubble(e.p, CNAME[e.col] + '!'); $('pileWrap').style.setProperty('--cur', COLHEX[e.col]); }
    else if (e.t === 'pass') { bubble(e.p, '통과'); }
    else if (e.t === 'late') { bubble(e.p, '시간 끝!'); }
    else if (e.t === 'shuffle') { beep('shuffle'); toast('카드 더미가 떨어져서 버린 카드를 섞었어요', 1800); await sleep(300); }
    else if (e.t === 'empty') { toast('더미에 남은 카드가 없어요', 1500); }
    else if (e.t === 'chal') { beep('catch'); bigPop('chal'); await sleep(900); chalEv = e; }
    else if (e.t === 'leave') { toast(`${ng.players[e.p].name}님이 나갔어요`, 2000); }
  }
  if (chalEv) showReveal(chalEv, ng);
}

// ============================================================
//  화면 그리기
// ============================================================
function avatarHTML(i, st) {
  const p = st.players[i];
  if (p.ai) return `<div class="av ai"><img src="img/${AI_AV[(p.ai - 1) % AI_AV.length]}.png" alt=""></div>`;
  return `<div class="av" style="background:${PAL[i % PAL.length]}">${esc((p.name || '?').slice(0, 1))}</div>`;
}
function render() {
  if (!g) return;
  const P = g.players, me = meIdx(), t = g.turn, playing = PLAYING.includes(g.phase);
  // 다른 사람 자리
  let order = [];
  if (me >= 0) for (let k = 1; k < P.length; k++) order.push((me + k) % P.length);
  else order = P.map((p, i) => i);
  $('opps').innerHTML = order.map(i => {
    const p = P[i], n = p.hand.length;
    let badge = '';
    if (!p.out && playing && n === 1) badge = g.exposed === i ? '<span class="badge">1장!</span>' : '<span class="badge safe">GGAEBI!</span>';
    if (p.out) badge = '<span class="badge" style="background:#999">나감</span>';
    return `<div class="seat ${playing && t === i ? 'turn' : ''} ${p.out ? 'out' : ''}" data-i="${i}">${avatarHTML(i, g)}
      <div class="si"><div class="nm">${esc(p.name)}</div><div class="ct">${cardHTML('back')}<b>${n}</b>장${g.target ? ` <span class="sc">${p.score}점</span>` : ''}</div></div>
      ${badge}${playing && t === i && g.sec && mode === 'online' ? '<div class="tbar"></div>' : ''}</div>`;
  }).join('');
  // 가운데
  const dn = g.deck.length;
  $('deckStack').innerHTML = dn ? cardHTML('back') + (dn > 1 ? cardHTML('back') : '') + (dn > 2 ? cardHTML('back') : '') : '';
  $('deckN').textContent = `더미 ${dn}장`;
  const pw = $('pileWrap');
  const showN = Math.min(3, g.pile.length);
  pw.innerHTML = g.pile.slice(-showN).map((c, k) => cardHTML(c)).join('');
  [...pw.children].forEach((el, k) => { const n = g.pile.length - showN + k; el.style.transform = `rotate(${(n * 37 % 17) - 8}deg)`; });
  const curCol = g.phase === 'pick' ? null : g.color;
  pw.style.setProperty('--cur', curCol ? COLHEX[curCol] : 'transparent');
  document.querySelector('.colchip i').style.setProperty('--cur', curCol ? COLHEX[curCol] : '#ddd');
  $('colName').textContent = curCol ? `지금 색: ${CNAME[curCol]}` : '색 고르는 중';
  $('dirIco').classList.toggle('ccw', g.dir < 0);
  $('roundTag').textContent = g.target ? `${g.round}번째 판 · ${g.target}점 먼저` : '한 판 승부';
  // 내 카드
  const myTurn = playing && me >= 0 && t === me;
  const canAct = myTurn && (g.phase === 'play' || g.phase === 'drawn');
  $('deckWrap').classList.toggle('can', myTurn && g.phase === 'play');
  const hand = $('hand');
  hand.classList.toggle('my', canAct);
  if (me >= 0) {
    hand.classList.remove('watch');
    const h = P[me].hand;
    let drawnMarked = false;
    hand.innerHTML = h.map(c => {
      let cls = '';
      if (canAct) {
        let ok;
        if (g.phase === 'drawn') { ok = c === g.drawn && !drawnMarked; if (ok) drawnMarked = true; }
        else ok = canPlay(g, c);
        cls = ok ? 'ok' : 'no';
      }
      return cardHTML(c, cls);
    }).join('');
    layoutHand();
    const p = P[me];
    $('meBar').innerHTML = `${mode === 'local' ? `<b>${esc(p.name)}</b>의 카드` : '내 카드'} · <b>${h.length}</b>장${g.target ? ` · ${p.score}점` : ''}<span id="myTime"></span>`;
  } else {
    hand.classList.add('watch');
    hand.innerHTML = mode === 'local' ? '' : '<div class="watchmsg">구경하는 중이에요</div>';
    $('meBar').innerHTML = '';
  }
  renderStatus();
  renderActions();
  updTimer();
  // 긴장되는 음악: 누군가 한 장 남았을 때
  if (playing) KBGM.track(P.some(p => !p.out && p.hand.length === 1) ? 'tense' : 'play');
}
function layoutHand() {
  const hand = $('hand'), cards = hand.querySelectorAll('.cd');
  const n = cards.length; if (!n) return;
  const cw = cards[0].offsetWidth, avail = hand.clientWidth - 20;
  let ov = 0;
  if (n * (cw + 4) > avail) ov = (avail - cw) / (n - 1) - cw;
  else ov = 4;
  hand.style.setProperty('--ov', ov + 'px');
}
window.addEventListener('resize', () => { if (g) layoutHand(); });

function renderStatus() {
  const me = meIdx(), t = g.turn, P = g.players;
  let s = '';
  if (g.phase === 'roundEnd' || g.phase === 'gameEnd') s = g.winner >= 0 || g.res ? `<b>${esc(nm(g.res ? g.res.w : g.winner))}</b> 카드를 다 냈어요!` : '';
  else if (g.phase === 'pick') s = t === me ? '첫 카드가 <b>색 바꾸기</b>예요. 시작할 색을 골라요!' : `<b>${esc(nm(t))}</b> 첫 색을 고르는 중`;
  else if (g.phase === 'challenge') s = t === me ? '<b>+4</b>를 받았어요. 도전할까요?' : `<b>${esc(nm(t))}</b> +4 도전을 고민하는 중`;
  else if (t === me) {
    if (g.phase === 'drawn') s = `가져온 <b>${CARD_NAME(g.drawn)}</b> 카드를 낼 수 있어요!`;
    else {
      const any = P[me].hand.some(c => canPlay(g, c));
      s = any ? '<b>내 차례</b>! 같은 색이나 같은 숫자를 내요' : '<b>내 차례</b>! 낼 카드가 없어요. 더미에서 가져와요';
    }
  } else if (mode === 'local' && me < 0) s = `<b>${esc(P[t].name)}</b> 차례예요`;
  else s = `<b>${esc(nm(t))}</b> 차례예요`;
  $('status').innerHTML = s;
}

function renderActions() {
  const me = meIdx(), t = g.turn, P = g.players, playing = PLAYING.includes(g.phase);
  let h = '';
  if (playing && me >= 0 && t === me) {
    if (g.phase === 'play') h += '<button class="game-btn btn-info" id="aDraw">카드 가져오기</button>';
    if (g.phase === 'drawn') h += '<button class="game-btn btn-secondary" id="aKeep">안 내고 넘기기</button>';
  }
  if (playing && me >= 0 && !P[me].out) {
    if (g.exposed === me) h += '<button class="ggbtn urgent" id="aGg">GGAEBI!</button>';
    else if (t === me && P[me].hand.length === 2 && (g.phase === 'play' || g.phase === 'drawn')) h += P[me].gg ? '<button class="ggbtn armed" disabled>GGAEBI! 외쳤어요</button>' : '<button class="ggbtn" id="aGg">GGAEBI!</button>';
  }
  if (playing && g.exposed >= 0 && g.exposed !== me && (me >= 0 || mode === 'local')) h += `<button class="catchbtn" id="aCatch">잡았다! ${esc(P[g.exposed].name)} 1장</button>`;
  if (mode === 'online') h += '<button class="game-btn btn-sky" id="aStk">응원</button>';
  h += `<button class="game-btn btn-secondary" id="aLeave">${mode === 'online' && role === 'watch' ? '구경 그만' : '그만하기'}</button>`;
  $('actions').innerHTML = h;
  const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
  on('aDraw', () => { if (!animating) doMine({ t: 'draw' }); });
  on('aKeep', () => { if (!animating) doMine({ t: 'keep' }); });
  on('aGg', () => doMine({ t: 'gg' }));
  on('aCatch', () => doCatch());
  on('aStk', toggleTray);
  on('aLeave', askLeave);
}
$('deckWrap').onclick = () => {
  const me = meIdx();
  if (!g || animating || me < 0 || g.turn !== me || g.phase !== 'play') return;
  doMine({ t: 'draw' });
};
$('hand').addEventListener('click', e => {
  const el = e.target.closest('.cd'); if (!el || !g) return;
  const me = meIdx(); if (me < 0) return;
  if (animating) return;
  const c = el.dataset.c;
  if (g.turn !== me || !(g.phase === 'play' || g.phase === 'drawn')) { toast(g.phase === 'challenge' || g.phase === 'pick' ? '먼저 위의 창에서 골라요' : '아직 내 차례가 아니에요', 1300); return; }
  if (!el.classList.contains('ok')) {
    beep('bad');
    toast(g.phase === 'drawn' ? '방금 가져온 카드만 낼 수 있어요' : `${CNAME[g.color]} 카드나 같은 숫자를 내야 해요`, 1500);
    return;
  }
  if (isWild(c)) { openColor(c); return; }
  doMine({ t: 'play', c });
});
// 키보드: G 키로 GGAEBI!
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || !g || $('game').classList.contains('hidden')) return;
  if (e.key === 'g' || e.key === 'G' || e.key === 'ㅎ') { const b = $('aGg'); if (b) b.click(); }
});

// ---------- 색 고르기 ----------
let colorFor = null;   // 낼 카드 (첫 카드 색 고르기는 'pick')
function openColor(c) {
  colorFor = c;
  const me = meIdx(), h = g.players[me].hand;
  const cnt = col => h.filter(x => x !== c && colOf(x) === col).length;
  $('colorTitle').textContent = c === 'pick' ? '시작할 색을 골라요' : '무슨 색으로 할까요?';
  let txt = '';
  if (c === 'F' && h.some(x => colOf(x) === g.color)) txt = `지금 색(${CNAME[g.color]}) 카드가 있는데 +4를 내면, 다음 사람이 도전해서 내가 4장을 가져갈 수 있어요!`;
  $('colorText').textContent = txt;
  $('colorBtns').innerHTML = COLORS.map(col => `<button class="${col}" data-col="${col}">${CNAME[col]}<small>내 카드 ${cnt(col)}장</small></button>`).join('');
  $('colorCancelRow').classList.toggle('hidden', c === 'pick');
  $('colorModal').classList.remove('hidden');
}
$('colorBtns').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  $('colorModal').classList.add('hidden');
  if (colorFor === 'pick') doMine({ t: 'pick', col: b.dataset.col });
  else doMine({ t: 'play', c: colorFor, col: b.dataset.col });
  colorFor = null;
};
$('colorCancel').onclick = () => { $('colorModal').classList.add('hidden'); colorFor = null; };

// ---------- +4 도전 ----------
function showChal() {
  const pd = g.pend4; if (!pd) return;
  const by = g.players[pd.by].name;
  $('chalText').innerHTML = `<b>${esc(by)}</b>님이 색 바꾸기 +4를 냈어요.<br>그 전 색은 <b>${CNAME[pd.prev]}</b>이었어요.<br>${esc(by)}님에게 ${CNAME[pd.prev]} 카드가 있었을까요?`;
  $('chalModal').classList.remove('hidden');
}
$('chalYes').onclick = () => { $('chalModal').classList.add('hidden'); doMine({ t: 'challenge' }); };
$('chalNo').onclick = () => { $('chalModal').classList.add('hidden'); doMine({ t: 'accept' }); };
let revT = 0;
function showReveal(e, st) {
  const me = meIdx(st);
  const who = st.players[e.p].name, by = st.players[e.by].name;
  const mine = mode === 'local' || me === e.p || me === e.by;
  if (!mine) {   // 내가 상관없는 도전은 짧게 알려요
    toast(e.ok ? `${who}님 도전 성공! ${by}님이 4장을 가져가요` : `${who}님 도전 실패! ${who}님이 6장을 가져가요`, 2600);
    return;
  }
  $('revTitle').textContent = e.ok ? '도전 성공!' : '도전 실패!';
  $('revText').innerHTML = e.ok
    ? `${esc(by)}님에게 ${CNAME[e.prev]} 카드가 있었어요.<br><b>${esc(by)}</b>님이 4장을 가져가요.`
    : `${esc(by)}님에게 ${CNAME[e.prev]} 카드가 없었어요.<br><b>${esc(who)}</b>님이 6장을 가져가요.`;
  $('revCards').innerHTML = mine ? e.hand.map(c => cardHTML(c, colOf(c) === e.prev ? '' : '')).join('') : '<p class="note">카드는 도전한 사람만 볼 수 있어요.</p>';
  if (mine) [...$('revCards').children].forEach((el, k) => { if (colOf(e.hand[k]) !== e.prev) el.style.opacity = '.45'; });
  $('revealModal').classList.remove('hidden');
  clearTimeout(revT);
  revT = setTimeout(() => { $('revealModal').classList.add('hidden'); after(); }, mine ? 6000 : 3500);
}
$('revOk').onclick = () => { clearTimeout(revT); $('revealModal').classList.add('hidden'); after(); };

// ============================================================
//  행동 보내기
// ============================================================
async function doMine(a) {
  const st = latest(); if (!st) return;
  let who = meIdx(st);
  if (mode === 'local' && a.t === 'gg' && st.exposed >= 0) who = st.exposed;
  if (who < 0) return;
  const err = await doAct(who, a);
  if (err && a.t === 'gg') toast('지금은 외칠 때가 아니에요', 1200);
}
function doCatch() {
  const st = latest(); if (!st) return;
  doAct(mode === 'local' ? -2 : meIdx(st), { t: 'catch' });
}
async function doAct(who, a) {
  if (mode === 'online') return onlineAct(a);
  const base = clone(latest());
  const err = GG.act(base, who, a, Date.now());
  if (err) return err;
  receive(base);
  return null;
}

// ============================================================
//  게임 진행 뒤에 할 일 (AI, 한 화면 가리기, 결과)
// ============================================================
let aiBusy = false;
let aiT = 0, catchTimers = [], catchKey = '', lastTurnKey = '', shownResult = '';
function after() {
  if (!g || animating) return;
  const playing = PLAYING.includes(g.phase), me = meIdx();
  // 한 화면 모드: 차례가 바뀌면 화면을 가려요
  if (mode === 'local' && playing && viewer !== g.turn) { viewer = -1; render(); showCover(); }
  else $('cover').classList.add('hidden');
  if (mode === 'local' && !playing) viewer = -1;
  // 내 차례 알림
  const tk = `${g.gid}-${g.seq}-${g.turn}`;
  if (playing && me >= 0 && g.turn === me && lastTurnKey.split('|')[0] !== `${g.gid}-${g.turn}-${g.round}-${g.pile.length}`) {
    if (mode !== 'local') beep('turn');
  }
  lastTurnKey = `${g.gid}-${g.turn}-${g.round}-${g.pile.length}|${tk}`;
  // 창
  const revOpen = !$('revealModal').classList.contains('hidden');
  if (playing && me >= 0 && g.turn === me && !revOpen) {
    if (g.phase === 'pick' && $('colorModal').classList.contains('hidden')) openColor('pick');
    if (g.phase === 'challenge') showChal(); else $('chalModal').classList.add('hidden');
  } else { $('chalModal').classList.add('hidden'); if (colorFor === 'pick') { $('colorModal').classList.add('hidden'); colorFor = null; } }
  if (g.phase === 'roundEnd' || g.phase === 'gameEnd') showResult();
  else $('resultModal').classList.add('hidden');
  aiTick();
}

// ---------- 한 화면 모드 가리기 ----------
function showCover() {
  const t = g.turn, P = g.players;
  $('coverTitle').textContent = `${P[t].name} 차례예요`;
  let txt = '다른 친구들은 화면을 보지 말아요.';
  if (g.phase === 'challenge') txt = `${P[g.pend4.by].name}님이 +4를 냈어요! ` + txt;
  $('coverText').textContent = txt;
  let h = `<button class="game-btn btn-primary" id="cvShow" style="min-width:220px">내 카드 보기</button>`;
  if (g.exposed >= 0) {
    h += `<button class="ggbtn urgent" id="cvGg">${esc(P[g.exposed].name)} GGAEBI!</button>`;
    h += `<button class="catchbtn" id="cvCatch">잡았다! ${esc(P[g.exposed].name)} 1장</button>`;
  }
  $('coverBtns').innerHTML = h;
  $('cvShow').onclick = () => { viewer = g.turn; $('cover').classList.add('hidden'); render(); after(); };
  if ($('cvGg')) $('cvGg').onclick = () => doAct(g.exposed, { t: 'gg' });
  if ($('cvCatch')) $('cvCatch').onclick = () => doAct(-2, { t: 'catch' });
  $('cover').classList.remove('hidden');
}

// ---------- AI ----------
const LV = {
  1: { forget: .4, notice: .5, catchMs: [2800, 4200], save: .25, chal: 0 },
  2: { forget: .15, notice: .85, catchMs: [1700, 2600], save: .45, chal: .25 },
  3: { forget: .03, notice: 1, catchMs: [900, 1450], save: .8, chal: .4 }
};
function aiTick() {
  clearTimeout(aiT);
  if (mode !== 'cpu' || !g || animating || aiBusy || !PLAYING.includes(g.phase)) return;
  if (!$('revealModal').classList.contains('hidden')) return;
  const L = LV[level];
  // 잡았다! / 스스로 GGAEBI!
  const ck = g.exposed >= 0 ? `${g.gid}-${g.round}-${g.exposed}-${g.pile.length}` : '';
  if (ck !== catchKey) {
    catchKey = ck; catchTimers.forEach(clearTimeout); catchTimers = [];
    if (ck) {
      const x = g.exposed;
      if (g.players[x].ai) {
        if (Math.random() < L.save) catchTimers.push(setTimeout(() => doAct(x, { t: 'gg' }), rnd(900, 1900)));
      } else {
        g.players.forEach((p, i) => {
          if (!p.ai || p.out || i === x) return;
          if (Math.random() < L.notice) catchTimers.push(setTimeout(() => doAct(i, { t: 'catch' }), rnd(...L.catchMs)));
        });
      }
    }
  }
  const t = g.turn, p = g.players[t];
  if (!p.ai) return;
  const wait = rnd(850, 1400) + (g.exposed >= 0 ? 1600 : 0) + (g.phase === 'challenge' ? 600 : 0);
  aiT = setTimeout(async () => {
    if (!g || animating || g.turn !== t) { aiTick(); return; }
    const a = aiDecide(g, t);
    aiBusy = true;
    try {
      if (a.gg) { await doAct(t, { t: 'gg' }); await sleep(500); while (animating) await sleep(80); }
      delete a.gg;
      const err = await doAct(t, a);
      if (err) { console.warn('ai', err, a); if (latest().phase === 'play' && latest().turn === t) await doAct(t, { t: 'draw' }); }
    } finally { aiBusy = false; }
    if (!animating) after();
  }, wait);
}
function bestColor(h) {
  const n = { r: 0, y: 0, g: 0, b: 0 };
  h.forEach(c => { if (!isWild(c)) n[c[0]] += 1 + (GG.points(c) >= 20 ? .5 : 0); });
  const best = Math.max(...Object.values(n));
  const list = COLORS.filter(c => n[c] === best);
  return list[Math.floor(Math.random() * list.length)];
}
function aiDecide(st, i) {
  const L = LV[level], P = st.players, h = P[i].hand;
  if (st.phase === 'pick') return { t: 'pick', col: level === 1 ? COLORS[Math.floor(Math.random() * 4)] : bestColor(h) };
  if (st.phase === 'challenge') {
    let pr = L.chal;
    if (level === 3) pr = P[st.pend4.by].hand.length >= 5 ? .55 : P[st.pend4.by].hand.length >= 3 ? .35 : .2;
    return { t: Math.random() < pr ? 'challenge' : 'accept' };
  }
  const wantGg = h.length === 2 && Math.random() >= L.forget;
  if (st.phase === 'drawn') {
    const rest = h.slice(); rest.splice(rest.indexOf(st.drawn), 1);
    return { t: 'play', c: st.drawn, col: bestColor(rest.length ? rest : h), gg: wantGg };
  }
  const ok = h.filter(c => canPlay(st, c));
  if (!ok.length) return { t: 'draw' };
  const nx = nxt(st, i), danger = P[nx].hand.length <= 2;
  const hasCol = h.some(c => colOf(c) === st.color);
  let pick;
  if (level === 1) {
    const plain = ok.filter(c => !isWild(c));
    const pool = plain.length && Math.random() < .8 ? plain : ok;
    pick = pool[Math.floor(Math.random() * pool.length)];
  } else {
    const cnt = {}; h.forEach(c => { if (!isWild(c)) cnt[c[0]] = (cnt[c[0]] || 0) + 1; });
    const leader = P.some((p, k) => k !== i && !p.out && p.hand.length <= 2);
    const score = c => {
      let s = 0;
      if (c === 'W') s = h.length <= 2 ? 30 : 2;
      else if (c === 'F') s = (hasCol ? -8 : 3) + (danger && level === 3 ? 30 : 0) + (h.length <= 2 ? 25 : 0);
      else {
        const v = valOf(c);
        s = 10 + (cnt[c[0]] || 0) * (level === 3 ? 3 : 1.5) + GG.points(c) / (leader ? 2 : 6);
        if (colOf(c) !== st.color) s -= 1;
        if ('SRD'.includes(v)) s += danger ? (level === 3 ? 25 : 10) : (level === 3 ? -2 : 2);
      }
      return s + Math.random() * (level === 3 ? 1 : 4);
    };
    pick = ok.slice().sort((a, b) => score(b) - score(a))[0];
    if (pick === 'F' && hasCol && Math.random() < (level === 3 ? .7 : .85)) {   // 같은 색이 있으면 웬만하면 정직하게
      const alt = ok.filter(c => c !== 'F'); if (alt.length) pick = alt.sort((a, b) => score(b) - score(a))[0];
    }
  }
  const rest = h.slice(); rest.splice(rest.indexOf(pick), 1);
  return { t: 'play', c: pick, col: isWild(pick) ? (level === 1 ? COLORS[Math.floor(Math.random() * 4)] : bestColor(rest.length ? rest : h)) : undefined, gg: wantGg };
}

// ---------- 결과 ----------
function showResult() {
  const key = `${g.gid}-${g.round}-${g.phase}-${mode === 'online' ? (room && room.hostId) + role : ''}`;
  if (shownResult === key) return;
  const first = !shownResult.startsWith(`${g.gid}-${g.round}-`);
  shownResult = key;
  const P = g.players, me = meIdx(), w = g.res ? g.res.w : g.winner, end = g.phase === 'gameEnd';
  let title, text = '', img = 'ggaebi-win';
  if (!g.res) { title = `${P[w] ? P[w].name : ''} 우승!`; text = '다른 친구들이 모두 나갔어요.'; }
  else if (mode === 'local' || me < 0) { title = `${P[w].name} ${end ? '우승' : '승리'}!`; text = `${P[w].name}님이 카드를 다 내서 ${g.res.pts}점을 얻었어요.`; }
  else if (w === me) { title = end ? (mode === 'cpu' ? '깨비샘 친구들을 이겼어요!' : '우승이에요!') : '이번 판 승리!'; text = `카드를 다 내서 ${g.res.pts}점을 얻었어요.`; }
  else { title = end ? '아쉽게 졌어요' : `${P[w].name} 승리`; text = `${P[w].name}님이 카드를 먼저 다 냈어요. 다음엔 꼭 이겨요!`; img = 'ggaebi-lose'; }
  if (end && g.target) text += ` ${g.target}점에 먼저 도착했어요!`;
  if (!end) text += ` 아직 ${g.target}점에 아무도 못 갔어요. 다음 판을 해요.`;
  if (first) {
    if (w === me || mode === 'local') { beep('win'); if (end) KBGM.jingle(); } else if (me >= 0) beep('lose');
  }
  $('resImg').src = `img/${img}.png`; $('resTitle').textContent = title; $('resText').textContent = text;
  // 점수표
  let tb = `<tr><th>이름</th><th>남은 카드</th>${g.target ? '<th>총점</th>' : '<th>점수</th>'}</tr>`;
  const rows = P.map((p, i) => i).sort((a, b) => (g.target ? P[b].score - P[a].score : (a === w ? -1 : b === w ? 1 : 0)));
  rows.forEach(i => {
    const p = P[i], hand = g.res ? g.res.hands[i] : [];
    const left = p.out ? '나감' : hand.length ? `<span class="mini">${hand.slice(0, 14).map(c => cardHTML(c)).join('')}${hand.length > 14 ? ' …' : ''}</span>` : '다 냈어요!';
    tb += `<tr class="${i === w ? 'win' : ''}"><td>${esc(p.name)}${i === me && mode !== 'local' ? ' (나)' : ''}</td><td>${left}</td><td>${g.target ? p.score : (i === w && g.res ? '+' + g.res.pts : '-')}</td></tr>`;
  });
  $('resTable').innerHTML = tb;
  // 버튼
  let b = '<button class="game-btn btn-secondary" id="rSee">카드 보기</button>';
  if (!end) {
    if (mode !== 'online' || me >= 0) b += '<button class="game-btn btn-primary" id="rNext">다음 판</button>';
  } else if (mode === 'online') {
    if (role === 'host') b += '<button class="game-btn btn-primary" id="rLobby">한 판 더 (대기실로)</button>';
    else b += '<button class="game-btn btn-info" disabled>방장을 기다려요</button>';
  } else b += '<button class="game-btn btn-primary" id="rAgain">한 판 더</button>';
  if (mode === 'online') b += '<button class="game-btn btn-sky" id="rStk">응원</button>';
  b += `<button class="game-btn btn-secondary" id="rQuit">${mode === 'online' ? '나가기' : '그만하기'}</button>`;
  $('resBtns').innerHTML = b;
  const on = (id, fn) => { const x = $(id); if (x) x.onclick = fn; };
  on('rSee', () => $('resultModal').classList.add('hidden'));
  on('rNext', () => { $('resultModal').classList.add('hidden'); doAct(mode === 'local' ? 0 : me, { t: 'next' }); });
  on('rAgain', () => { $('resultModal').classList.add('hidden'); restartSolo(); });
  on('rLobby', backToLobby);
  on('rStk', toggleTray);
  on('rQuit', () => { if (mode === 'online') leaveOnline(); else leaveLocal(); });
  $('resultModal').classList.remove('hidden');
}
// 결과 창을 닫았다가 다시 보려면
$('status').addEventListener('click', () => { if (g && (g.phase === 'roundEnd' || g.phase === 'gameEnd')) { shownResult = ''; showResult(); } });

// ============================================================
//  깨비샘과 하기 / 한 화면에서 여럿이
// ============================================================
let soloPlayers = null;
function startSolo(players) {
  soloPlayers = players;
  const ng = GG.newGame(players, { target: getTarget(), sec: 0 }, Date.now());
  ng.gid = Math.random().toString(36).slice(2, 9);
  g = null; pendingG = null;
  show('game');
  receive(ng);
}
function restartSolo() { if (soloPlayers) startSolo(soloPlayers); }
$('cpuBtn').onclick = () => { $('startMsg').textContent = ''; tagsAll(); $('cpuModal').classList.remove('hidden'); };
$('cpuCancel').onclick = () => $('cpuModal').classList.add('hidden');
document.querySelectorAll('#cpuModal .lv').forEach(b => b.onclick = () => {
  level = +b.dataset.lv; store('cards-level', level);
  $('cpuModal').classList.add('hidden');
  mode = 'cpu';
  const n = ($('nameInput').value.trim() || '나').slice(0, 8);
  const ps = [{ id: 'ME', name: n, ai: 0 }];
  for (let k = 0; k < getAiN(); k++) ps.push({ id: 'AI' + k, name: AI_NAMES[k], ai: k + 1 });
  startSolo(ps);
});
function localRows(n) {
  const box = $('localNames'), cur = [...box.querySelectorAll('input')].map(i => i.value);
  if (!cur.length) { const me = $('nameInput').value.trim(); if (me) cur[0] = me; }
  box.innerHTML = Array.from({ length: n }, (_, i) => `<div class="field"><span style="background:${PAL[i]}">${i + 1}</span><input maxlength="8" placeholder="${i + 1}번 사람 이름" value="${esc(cur[i] || '')}" autocomplete="off"></div>`).join('');
}
$('localBtn').onclick = () => { $('startMsg').textContent = ''; tagsAll(); if (!$('localNames').children.length) localRows(3); $('localModal').classList.remove('hidden'); };
$('lnPlus').onclick = () => { const n = $('localNames').children.length; if (n < 6) localRows(n + 1); };
$('lnMinus').onclick = () => { const n = $('localNames').children.length; if (n > 2) localRows(n - 1); };
$('lnCancel').onclick = () => $('localModal').classList.add('hidden');
$('lnStart').onclick = () => {
  const names = [...$('localNames').querySelectorAll('input')].map((i, k) => i.value.trim().slice(0, 8) || `${k + 1}번`);
  $('localModal').classList.add('hidden');
  mode = 'local';
  startSolo(names.map((n, k) => ({ id: 'L' + k, name: n, ai: 0 })));
};
function leaveLocal() {
  clearTimeout(aiT); catchTimers.forEach(clearTimeout); catchTimers = [];
  if (unsub) unsub(); unsub = null;
  sstore('cards-room', null);
  g = null; pendingG = null; mode = null; room = null; ref = null; code = ''; role = '';
  hideModals();
  show('startScreen');
}
function confirmBox(title, text, yes, fn) {
  $('cfTitle').textContent = title; $('cfText').textContent = text; $('cfYes').textContent = yes;
  $('confirmModal').classList.remove('hidden');
  $('cfYes').onclick = () => { $('confirmModal').classList.add('hidden'); fn(); };
  $('cfNo').onclick = () => $('confirmModal').classList.add('hidden');
}
function askLeave() {
  if (mode === 'online') {
    if (role === 'watch') { leaveOnline(); return; }
    confirmBox('정말 나갈까요?', '지금 나가면 내 카드는 더미로 돌아가고 다시 들어올 수 없어요.', '나갈래요', leaveOnline);
    return;
  }
  confirmBox('그만할까요?', '처음 화면으로 돌아가요.', '그만하기', leaveLocal);
}

// ============================================================
//  방 코드 대결 (Firebase)
// ============================================================
const ROOMS = 'cards-rooms';
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
  if (String(c).includes('permission')) return '방 기능 설정이 아직 안 되어 있어요. 선생님께 알려 주세요.';
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
$('createBtn').onclick = () => { if (!getName()) return; $('startMsg').textContent = ''; tagsAll(); $('createModal').classList.remove('hidden'); };
$('createCancel').onclick = () => $('createModal').classList.add('hidden');
$('createGo').onclick = async () => {
  const name = getName(); if (!name || busy) return;
  busy = true; $('createGo').disabled = true;
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
        tx.set(r, { code: c, status: 'waiting', hostId: myId, members: [{ id: myId, name }], target: getTarget(), sec: getSec(), g: null, stk: null,
          createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp() });
        return c;
      });
    }
    if (!made) throw new Error('full');
    $('createModal').classList.add('hidden');
    await enterRoom(made);
    cleanupOld();
  } catch (e) { console.error(e); $('createModal').classList.add('hidden'); $('startMsg').textContent = '방을 만들지 못했어요. ' + errText(e); }
  busy = false; $('createGo').disabled = false;
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
async function joinRoom(c, name) {   // 대기실이면 참가, 게임 중이면 구경
  const F = await fb(), r = F.doc(F.db, ROOMS, c);
  return F.runTransaction(F.db, async tx => {
    const s = await tx.get(r);
    if (!s.exists()) throw new Error('none');
    const d = s.data(), age = Date.now() - (d.updatedAt ? d.updatedAt.toMillis() : 0);
    if (d.status === 'closed' || age > STALE_MS) throw new Error('closed');
    const ms = d.members || [];
    const at = ms.findIndex(m => m.id === myId);
    if (at >= 0) { if (name && ms[at].name !== name && d.status === 'waiting') { ms[at].name = name; tx.update(r, { members: ms, updatedAt: F.serverTimestamp() }); } return 'player'; }
    if (d.status === 'waiting' && ms.length < 6 && name) { ms.push({ id: myId, name }); tx.update(r, { members: ms, updatedAt: F.serverTimestamp() }); return 'player'; }
    return 'watch';
  });
}
async function enterRoom(c) {
  const F = await fb();
  mode = 'online'; code = c; ref = F.doc(F.db, ROOMS, c);
  sstore('cards-room', c);
  g = null; pendingG = null; lastStk = null; room = null;
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
  // 응원 스티커
  const st = room.stk;
  if (st && st.id !== (lastStk && lastStk.id) && lastStk !== null) showSticker(st);
  lastStk = st || { id: '' };
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
  $('waitTags').innerHTML = `<span class="tag">${tgText(room.target)}</span><span class="tag">${room.sec ? `차례 ${room.sec}초` : '시간 제한 없음'}</span><span class="tag">${ms.length}/6명</span>`;
  let lead, b = '';
  if (role === 'host') {
    lead = ms.length < 2 ? '친구에게 이 번호를 알려 주세요.<br><span class="dots">친구를 기다리는 중</span>' : '모두 모이면 시작을 눌러요!';
    b = `<button class="game-btn btn-secondary" id="wClose">방 없애기</button><button class="game-btn btn-primary" id="wStart" ${ms.length < 2 ? 'disabled' : ''}>시작! (${ms.length}명)</button>`;
  } else if (role === 'player') {
    lead = '방장이 시작하길 기다려요<span class="dots"></span>';
    b = '<button class="game-btn btn-secondary" id="wLeave">나가기</button>';
  } else {
    lead = ms.length < 6 ? '함께하려면 참가하기를 눌러요.' : '자리가 꽉 찼어요. 구경할 수 있어요.';
    b = '<button class="game-btn btn-secondary" id="wLeave">나가기</button>' + (ms.length < 6 ? '<button class="game-btn btn-primary" id="wJoin">참가하기</button>' : '');
  }
  $('waitLead').innerHTML = lead;
  $('waitBtns').innerHTML = b;
  const on = (id, fn) => { const x = $(id); if (x) x.onclick = fn; };
  on('wClose', async () => { try { const F = await fb(); await F.updateDoc(ref, { status: 'closed', updatedAt: F.serverTimestamp() }); } catch (e) {} leaveLocal(); });
  on('wStart', startOnline);
  on('wLeave', leaveOnline);
  on('wJoin', async () => { const n = store('cards-name') || $('nameInput').value.trim().slice(0, 8) || '친구'; try { await joinRoom(code, n); } catch (e) { toast('참가하지 못했어요. ' + errText(e), 2500); } });
}
async function startOnline() {
  try {
    const F = await fb();
    await F.runTransaction(F.db, async tx => {
      const s = await tx.get(ref); const d = s.data();
      if (!d || d.status !== 'waiting' || d.hostId !== myId || (d.members || []).length < 2) return;
      const ng = GG.newGame(d.members.map(m => ({ id: m.id, name: m.name, ai: 0 })), { target: d.target || 0, sec: d.sec || 0 }, Date.now());
      ng.gid = Math.random().toString(36).slice(2, 9);
      tx.update(ref, { status: 'playing', g: ng, updatedAt: F.serverTimestamp() });
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
      const who = a.t === 'timeout' ? -3 : ng.players.findIndex(p => p.id === myId);
      err = GG.act(ng, who, a, Date.now());
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
      if (ms.length === (d.members || []).length) return;   // 구경꾼
      const up = { members: ms, updatedAt: F.serverTimestamp() };
      if (d.hostId === me) { if (ms.length) up.hostId = ms[0].id; else up.status = 'closed'; }
      if (d.g) {
        const ng = d.g, i = ng.players.findIndex(p => p.id === me);
        if (i >= 0 && !GG.act(ng, i, { t: 'leave' }, Date.now())) up.g = ng;
      }
      tx.update(rf, up);
    });
  } catch (e) {}
}

// 차례 시간 (방 코드 대결)
let toKey = '';
function updTimer() {
  if (!g || mode !== 'online' || !g.sec || !PLAYING.includes(g.phase)) { if ($('myTime')) $('myTime').textContent = ''; return; }
  const left = g.turnAt + g.sec * 1000 - Date.now();
  const frac = Math.max(0, Math.min(1, left / (g.sec * 1000)));
  const bar = document.querySelector('.seat.turn .tbar'); if (bar) bar.style.transform = `scaleX(${frac})`;
  const mt = $('myTime');
  if (mt) mt.textContent = g.turn === meIdx() ? ` · 남은 시간 ${Math.max(0, Math.ceil(left / 1000))}초` : '';
  if (left < -2500 && meIdx() >= 0 && !animating) {
    const k = `${g.gid}-${g.seq}`;
    if (toKey !== k) { toKey = k; onlineAct({ t: 'timeout' }); }
  }
}
setInterval(updTimer, 500);

// ---------- 응원 스티커 ----------
const STICKERS = ['best', 'nice', 'cheer', 'wow', 'clap', 'hmm', 'oops', 'nervous', 'laugh', 'gg', 'again', 'wait', 'heart'];
let lastStk = null, stkCoolUntil = 0, stkHideT = 0;
$('stkTray').innerHTML = '<div class="tt">응원 스티커를 골라요</div>' + STICKERS.map(n => `<button data-s="${n}"><img src="img/sticker-${n}.png" alt=""></button>`).join('');
$('stkTray').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('stkTray').classList.add('hidden'); sendSticker(b.dataset.s); });
document.addEventListener('pointerdown', e => {
  if (!$('stkTray').classList.contains('hidden') && !e.target.closest('#stkTray') && !e.target.closest('#aStk') && !e.target.closest('#rStk')) $('stkTray').classList.add('hidden');
});
function toggleTray() {
  const t = $('stkTray');
  t.classList.toggle('hidden');
  t.classList.toggle('cool', Date.now() < stkCoolUntil);
  if (Date.now() < stkCoolUntil) setTimeout(() => t.classList.remove('cool'), stkCoolUntil - Date.now());
}
async function sendSticker(n) {
  if (!ref || Date.now() < stkCoolUntil) return;
  stkCoolUntil = Date.now() + 4000;
  const myName = store('cards-name') || '친구';
  try { const F = await fb(); await F.updateDoc(ref, { stk: { id: Math.random().toString(36).slice(2, 9), s: n, by: myName, w: role === 'watch' ? 1 : 0 } }); }
  catch (e) { console.error(e); toast('스티커를 보내지 못했어요', 2000); }
}
function showSticker(st) {
  if (!STICKERS.includes(st.s)) return;
  const el = $('stkShow');
  $('stkImg').src = `img/sticker-${st.s}.png`;
  $('stkWho').textContent = (st.w ? '구경꾼 ' : '') + (st.by || '');
  el.classList.remove('hidden', 'on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(stkHideT); stkHideT = setTimeout(() => el.classList.add('hidden'), 2700);
  beep('join');
}

// ---------- 규칙 ----------
const HELP = [
  ['r7', '<b>같은 색</b>이나 <b>같은 숫자</b> 카드를 한 장 내요. 낼 카드가 없으면 더미에서 한 장 가져와요. 가져온 카드를 낼 수 있으면 바로 내도 돼요.'],
  ['b7', '낼 카드가 있어도 안 내고 한 장 가져올 수 있어요. 그때는 <b>방금 가져온 카드만</b> 낼 수 있어요.'],
  ['gS', '<b>건너뛰기</b> · 다음 사람은 차례를 쉬어요.'],
  ['yR', '<b>방향 바꾸기</b> · 도는 방향이 반대로 바뀌어요. 둘이 할 때는 건너뛰기와 같아요.'],
  ['rD', '<b>+2</b> · 다음 사람이 2장을 가져가고 차례를 쉬어요.'],
  ['W', '<b>색 바꾸기</b> · 언제든 낼 수 있어요. 다음 색을 내가 정해요.'],
  ['F', '<b>색 바꾸기 +4</b> · 지금 색과 같은 색 카드가 없을 때만 낼 수 있어요. 다음 사람은 4장을 가져가고 쉬어요. 의심되면 <b>도전!</b> 맞으면 낸 사람이 4장, 틀리면 도전한 사람이 6장을 가져가요.'],
  ['back', '카드가 2장일 때 한 장을 내면서 <b>GGAEBI!</b> 버튼을 눌러요. 깜빡했는데 다음 사람이 움직이기 전에 누가 <b>잡았다!</b>를 누르면 2장을 가져가요. (컴퓨터에서는 G 키도 돼요)'],
  ['y9', '먼저 카드를 다 낸 사람이 이겨요. 다른 사람 손에 남은 카드가 내 점수가 돼요. 숫자는 그 숫자만큼, 건너뛰기·방향 바꾸기·+2는 20점, 색 바꾸기는 50점이에요.']
];
$('helpList').innerHTML = HELP.map(([c, t]) => `<div>${cardHTML(c)}<span>${t}</span></div>`).join('');
$('helpBtn').onclick = () => $('helpModal').classList.remove('hidden');
$('helpClose').onclick = () => $('helpModal').classList.add('hidden');

// ---------- 새로 고침해도 방으로 돌아오기 ----------
(async () => {
  const c = sstore('cards-room');
  if (!c) return;
  try { await joinRoom(c, store('cards-name') || ''); await enterRoom(c); }
  catch (e) { sstore('cards-room', null); }
})();
})();
