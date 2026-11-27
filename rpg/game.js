// 깨비샘의 도깨비 대모험 · 게임 엔진
// 칸 이동(한 칸에 한 명, 바디 블로킹) + 길찾기, 클릭·누르기·드래그 자동 공격, 리니지식 명중·AC·강화 계산, 타격감 연출
'use strict';
const $ = id => document.getElementById(id);
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
// 받침에 따라 조사 고르기: josa('허수아비','이가') → '허수아비가'
const josa = (w, p) => { const c = w.charCodeAt(w.length - 1) - 0xac00; const has = c >= 0 && c <= 11171 && c % 28 !== 0; return w + (has ? p[0] : p[1]); };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ================= 그림 ================= */
const IMG = {}, WHITE = {};
const IMG_LIST = ['t-board', 't-forge', 'npc-smith', 'i-return', 'i-teleport', 'fence-panel', 'fence-v-post', 'fence-v-weave', 'emblem-1', 'emblem-2', 'emblem-3', 'emblem-4', 'a-walk-0', 'a-walk-1', 'a-walk-2', 'a-walk-3', 'a-walk-4', 'a-walk-5', 'a-idle', 'a-walk1', 'a-walk2', 'a-wind', 'a-swing', 'a-hurt', 'a-dead', 'a-win', 'arrow', 'fence-h', 'fence-post', 'fence-corner', 'gate-front', 'gate-side', 'gate-side-l', 'fence-side', 'fence-lamp', 'p-idle', 'p-walk-0', 'p-walk-1', 'p-walk-2', 'p-walk-3', 'p-walk-4', 'p-walk-5', 'p-wind', 'p-swing', 'p-hurt', 'p-dead', 'p-win', 'npc-shop', 'npc-guide', 'npc-storage',
  ...Object.keys(MONS).flatMap(k => ['m-' + k + '-0', 'm-' + k + '-1']),
  ...Object.keys(WEAPONS).map(k => 'w-' + k), ...Object.keys(ARMORS).map(k => 'a-' + k), ...Object.keys(ACCS).map(k => 'c-' + k),
  'i-potion', 'i-haste', 'i-wscroll', 'i-ascroll', 'i-coin', 'i-coins', 'i-box', ...Object.keys(PROPS)];
function loadImages() {
  const jobs = IMG_LIST.map(n => new Promise(res => { const im = new Image(); im.onload = () => { IMG[n] = im; res(); }; im.onerror = res; im.src = 'img/' + n + '.png?v=1'; }));
  ['tile-town', 'tile-field', 'tile-bamboo', 'tile-sand', 'tile-paddy', 'tile-deep', 'tile-marsh', 'tile-rock', 'tile-sea', 'world-map'].forEach(n => jobs.push(new Promise(res => { const im = new Image(); im.onload = () => { IMG[n] = im; res(); }; im.onerror = res; im.src = 'img/' + n + '.jpg?v=2'; })));
  return Promise.all(jobs);
}
const GOLD = {};
function gold(n) {   // 황금 몬스터: 금빛으로 물든 그림
  if (GOLD[n]) return GOLD[n];
  const im = IMG[n]; if (!im) return null;
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,196,30,.55)'; g.fillRect(0, 0, c.width, c.height);
  return (GOLD[n] = c);
}
function white(n) {   // 맞았을 때 하얗게 번쩍이는 그림
  if (WHITE[n]) return WHITE[n];
  const im = IMG[n]; if (!im) return null;
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  return (WHITE[n] = c);
}
const gearImg = it => it.g === 'w' ? 'w-' + it.k : it.g === 'a' ? 'a-' + it.k : it.g === 'c' ? (IMG['c-' + it.k] ? 'c-' + it.k : 'i-box') : ITEMS[it.i].img;
const GDEF = it => (it.g === 'w' ? WEAPONS : it.g === 'c' ? ACCS : ARMORS)[it.k];

// 캐릭터·몬스터·NPC 크기 (1 = 처음 크기, 2026-11-25 절반으로 줄임)
const UK = .5;
/* ================= 배경 음악 (지역마다 바뀜) ================= */
KBGM.init({ key: 'rpg', start: 'title', tracks: { title: 'audio/bgm-title.mp3', town: 'audio/bgm-town.mp3', field: 'audio/bgm-field.mp3', bamboo: 'audio/bgm-bamboo.mp3', boss: 'audio/bgm-boss.mp3' } });
KBGM.full();
const ZONE_BGM = { town: 'town', bamboo: 'bamboo', deep: 'bamboo', marsh: 'bamboo' };
let bgmT = 0;
function updateMusic(dt) {
  if ((bgmT -= dt) > 0) return; bgmT = .5;
  if (!curZone || !player) return;
  // 우두머리가 가까이(12칸) 있으면 전투 음악
  const b = units.find(u => u.kind === 'mon' && u.d.boss && !u.dying && Math.abs(u.x - player.x) + Math.abs(u.y - player.y) < 12);
  KBGM.track(b ? 'boss' : (ZONE_BGM[curZone.id] || 'field'));
}

/* ================= 소리 (코드로 만든 효과음) ================= */
const SND = (() => {
  let ac = null, on = true, master = null, noiseBuf = null;
  try { on = localStorage.getItem('rpg-sfx') !== 'off'; } catch (e) {}
  function ctx() {
    if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); master = ac.createGain(); master.gain.value = .55; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  function tone(type, f0, f1, dur, vol, delay = 0) {
    if (!on) return; const c = ctx(); if (!c) return; const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, .005, vol, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
  }
  function noise(dur, vol, type, f0, f1, q = 1, delay = 0) {
    if (!on) return; const c = ctx(); if (!c) return; const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = noiseBuf; const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); env(g, t, .004, vol, dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random() * .5); s.stop(t + dur + .02);
  }
  return {
    get on() { return on; }, set on(v) { on = v; try { localStorage.setItem('rpg-sfx', v ? 'on' : 'off'); } catch (e) {} if (!v && ac && ac.state === 'running') ac.suspend(); },
    unlock() { if (on) ctx(); },
    sleep() { if (ac && ac.state === 'running') ac.suspend(); },   // 효과음을 끄거나 창을 내리면 소리 장치를 놓아줘요 (다른 앱 음악이 끊기지 않게)
    hit(type, crit) {
      if (type === 'club') { tone('sine', 150, 45, .22, .9); noise(.16, .7, 'lowpass', 900, 200); }
      else if (type === 'dagger') { noise(.07, .55, 'highpass', 2500, 5000); tone('triangle', 420, 180, .07, .35); }
      else { noise(.1, .6, 'bandpass', 1800, 700, .8); tone('sine', 230, 80, .13, .6); }
      if (crit) { tone('square', 880, 1320, .12, .22, .02); tone('sine', 1760, 1760, .25, .18, .04); noise(.12, .5, 'lowpass', 1200, 300); }
    },
    miss() { noise(.18, .35, 'bandpass', 600, 2400, 2); },
    block() { tone('sine', 620, 600, .3, .4); tone('sine', 1490, 1450, .2, .18); tone('triangle', 2300, 2200, .12, .1); },
    hurt() { tone('sawtooth', 200, 90, .16, .28); noise(.1, .4, 'lowpass', 700, 200); },
    kill() { tone('sine', 300, 60, .3, .6); noise(.25, .4, 'lowpass', 1200, 150); },
    coin() { tone('square', 1320, 1320, .05, .12); tone('square', 1760, 1760, .08, .12, .05); },
    pick() { tone('triangle', 660, 990, .12, .3); },
    level() { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, .22, .35, i * .09)); },
    shoot() { tone('triangle', 520, 1400, .1, .2); noise(.12, .18, 'bandpass', 2500, 900, 2); },
    potion() { tone('sine', 400, 900, .25, .3); noise(.2, .15, 'bandpass', 1500, 3000, 3); },
    ok() { [784, 1046, 1318, 1568].forEach((f, i) => tone('sine', f, f, .4, .3, i * .06)); noise(.5, .15, 'highpass', 4000, 8000); },
    fail() { noise(.6, .8, 'highpass', 3000, 600); tone('sawtooth', 300, 60, .5, .35); [1800, 2400, 3100].forEach((f, i) => tone('triangle', f, f * .9, .08, .12, .05 + i * .07)); },
    charge(d) { tone('sine', 220, 880, d, .2); noise(d, .12, 'bandpass', 400, 3000, 4); },
    tick() { tone('square', 900, 900, .03, .08); },
    die() { [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f, .3, .3, i * .14)); },
    boss() { tone('sawtooth', 110, 110, .6, .3); tone('sawtooth', 165, 165, .6, .22, .02); noise(.6, .3, 'lowpass', 300, 100); },
    warp() { tone('sine', 300, 1200, .4, .3); noise(.4, .2, 'bandpass', 800, 4000, 3); },
    ui() { tone('triangle', 700, 700, .04, .15); },
  };
})();

/* ================= 저장 ================= */
const SAVE_KEY = 'rpg-save';
let P = null;   // 저장되는 캐릭터 정보
function newChar(str, dex, con, cls, name) {
  return { v: 1, name: name || '', cls: cls === 'bow' ? 'bow' : 'sword', lv: 1, exp: 0, hp: 30, str, dex, con, pts: 0, coins: 50, hunt: 0,
    inv: [{ i: 'potion', n: 5 }, { i: 'ret', n: 3 }, { i: 'tele', n: 3 }], eq: { weapon: { g: 'w', k: cls === 'bow' ? 'bow1' : 'sword1', en: 0 }, armor: { g: 'a', k: 'armor1', en: 0 } },
    kills: 0, deaths: 0, t: Date.now() };
}
// 저장: 캐릭터 여러 명 { v: 2, chars: [캐릭터...], t } (예전 한 명 저장 v1도 읽어요)
const MAX_CHARS = 4;
let slot = 0;
// 예전 장신구(우두머리별)는 직업별 장신구로 바꿔요
function fixAcc(it, cls) { if (it && it.g === 'c' && !ACCS[it.k]) it.k = (/^ring/.test(it.k) ? 'ring_' : 'neck_') + (CLS_NAME[cls] ? cls : 'sword'); return it; }
function fixAccs(d) {
  for (const c of d.chars) { if (!c) continue; for (const k in c.eq || {}) fixAcc(c.eq[k], c.cls); (c.inv || []).forEach(it => fixAcc(it, c.cls)); }
  if (d.store && d.store.items) d.store.items.forEach(it => fixAcc(it, 'sword'));
  return d;
}
function normAll(d) {
  if (d && d.v === 1) return fixAccs({ v: 2, chars: [d], t: d.t || 0 });
  if (d && d.v === 2 && Array.isArray(d.chars)) return fixAccs(d);
  return { v: 2, chars: [], t: 0 };
}
function loadAll() { try { return normAll(JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')); } catch (e) { return normAll(null); } }
let saveT = 0, cloudAt = 0, cloudT = 0, stale = false;   // cloudT: 인터넷 저장 칸에 마지막으로 있던 기록 시각 (내가 올렸거나 받아 온 것)
// 다른 기기가 그 뒤에 저장했는지 확인해요. 그랬으면 그 기록을 받고 다시 시작해요
async function checkCloud() {
  const c = cloudCode(); if (!c || !window.RPG_CLOUD || stale) return stale;
  let d = null; try { d = await window.RPG_CLOUD.get(c); } catch (e) { return false; }
  if (!d || !d.s) return false;
  const t = +d.t || 0;
  if (!cloudT) { cloudT = t; return false; }
  if (t === cloudT) return false;
  stale = true; clearTimeout(saveT);
  try { localStorage.setItem(SAVE_KEY, d.s); } catch (e) {}
  $('syncbox').classList.remove('hidden');
  return true;
}
function cloudPut(c, s, t) { cloudT = t; return window.RPG_CLOUD.put(c, { s, t }); }
function save(now) {
  if (!P || stale) return; P.t = Date.now();
  if (player && units.includes(player)) { P.pos = dead ? null : [player.x, player.y]; P.mapv = MAPV; }   // 끈 자리에서 다시 시작해요
  const all = loadAll(); all.chars[slot] = P; all.t = P.t; if (STORE) all.store = STORE;
  const s = JSON.stringify(all);
  try { localStorage.setItem(SAVE_KEY, s); } catch (e) {}
  // 인터넷 저장은 아껴서: 마을로 올 때·창을 닫을 때(now)나 2분에 한 번만
  if (window.RPG_CLOUD && cloudCode() && (now || Date.now() - cloudAt > 120000)) {
    cloudAt = Date.now(); clearTimeout(saveT);
    const up = () => cloudPut(cloudCode(), s, all.t).catch(e => console.warn('저장 올리기 실패', e));
    if (document.hidden) up(); else saveT = setTimeout(async () => { if (!(await checkCloud())) up(); }, 300);   // 올리기 전에 다른 기기 기록부터 확인   // 창을 닫을 때는 기다리지 않고 바로 올려요
  }
}
/* ================= 창고: 한 계정(이어하기 코드)의 캐릭터들이 함께 써요 ================= */
const STORE_MAX = 40;
let STORE = null;
function loadStore() { const a = loadAll(); STORE = a.store && Array.isArray(a.store.items) ? a.store : { items: [], coins: 0 }; }
function toStore(ix) {
  const it = P.inv[ix]; if (!it) return;
  const same = it.i && STORE.items.find(x => x.i === it.i);
  if (!same && STORE.items.length >= STORE_MAX) { log('창고가 가득 찼어요', 'warn'); return; }
  P.inv.splice(ix, 1);
  if (same) same.n += it.n || 1; else STORE.items.push(it);
  SND.ui(); save(true); renderStore(); renderInv(); updateHUD(); renderQuick();
}
function fromStore(ix) {
  const it = STORE.items[ix]; if (!it) return;
  if (!giveItem({ ...it })) { log('가방이 가득 찼어요', 'warn'); return; }
  STORE.items.splice(ix, 1);
  SND.ui(); save(true); renderStore(); renderInv(); updateHUD(); renderQuick();
}
function storeCoins(dir) {
  const v = Math.floor(+$('store-amt').value || 0), have = dir > 0 ? P.coins : STORE.coins;
  const n = v > 0 ? Math.min(v, have) : have;
  if (n <= 0) return;
  if (dir > 0) { P.coins -= n; STORE.coins += n; log(`엽전 ${n.toLocaleString()}냥을 맡겼어요`, 'sys'); }
  else { STORE.coins -= n; P.coins += n; log(`엽전 ${n.toLocaleString()}냥을 찾았어요`, 'sys'); }
  $('store-amt').value = ''; SND.coin(); save(true); renderStore(); renderInv(); updateHUD();
}
function renderStore() {
  if (!STORE || !wins.includes('store')) return;
  let h = ''; for (let i = 0; i < STORE_MAX; i++) h += slotHTML(STORE.items[i], `data-st="${i}"`);
  $('store-grid').innerHTML = h;
  $('store-coins').textContent = STORE.coins.toLocaleString();
  $('store-count').textContent = `${STORE.items.length} / ${STORE_MAX}`;
}
function cloudCode() { try { return localStorage.getItem('rpg-save-code') || ''; } catch (e) { return ''; } }

// 큰 수 줄여 쓰기: 9,999까지 그대로, 그 위는 1.2만 · 3억
function shortNum(n) { if (n < 10000) return n.toLocaleString(); if (n < 1e8) return (n / 1e4).toFixed(n < 1e5 ? 1 : 0).replace(/\.0$/, '') + '만'; return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '억'; }
/* ================= 능력치 계산 ================= */
const W_OF = () => P.eq.weapon ? WEAPONS[P.eq.weapon.k] : null;
const isBow = () => !!P && P.cls === 'bow';
const reach = () => { const w = W_OF(); return w && w.range || 1; };
const HERO = () => isBow() ? '깨순이' : '깨비샘';
// 장신구가 더해 주는 능력치
function accBonus(k) { let v = 0; for (const s of ['neck', 'ring']) { const it = P.eq[s]; if (it && it.g === 'c') v += ACCS[it.k][k] || 0; } return v; }
const ST = k => P[k] + accBonus(k);
function maxHP() { return 30 + (P.lv - 1) * 8 + (ST('con') - 10) * (P.lv + 2) + accBonus('hp'); }
function playerAC() {
  let ac = 10;
  for (const s of SLOTS) { const it = P.eq[s]; if (it && it.g === 'a') ac -= ARMORS[it.k].ac + it.en; else if (it && it.g === 'c') ac -= ACCS[it.k].ac || 0; }
  return ac - Math.floor((ST('dex') - 10) / 3);
}
const strBonus = () => Math.floor((ST('str') - 10) / 2) + accBonus('dmg');
const hitBonus = () => (ST('dex') - 10) * 2 + accBonus('hit');
const critRate = () => 5 + Math.floor((ST('dex') - 10) / 2) + accBonus('crit');
function weaponRange(it) {   // 무기 데미지 범위 (힘 보너스 제외)
  if (!it) return [1, 2];
  const base = WEAPONS[it.k].dmg + it.en;
  return [base, base + (it.en >= 7 ? 2 * (it.en - 6) : 0)];
}
function regenAmt() { return accBonus('regen') + 1 + Math.floor(P.lv / 5) + Math.max(0, Math.floor((ST('con') - 10) / 2)); }

// 한 대의 결과: 명중 → 데미지 굴림 → 치명타 → AC 감소 → 0이면 막음
function rollAttack(att, def) {
  const hit = clamp(60 + def.ac * 3 + (att.lv - def.lv) * 2 + (att.hit || 0), 5, 95);
  if (Math.random() * 100 >= hit) return { miss: true, dmg: 0 };
  let dmg = rnd(att.dmg[0], att.dmg[1]) + (att.plus || 0);
  const crit = att.crit > 0 && Math.random() * 100 < att.crit;
  if (crit) dmg = Math.floor(dmg * 1.5);
  if (def.ac < 0) { const n = -def.ac; dmg -= Math.ceil(n / 2) + rnd(0, Math.floor(n / 2)); }
  dmg = Math.max(0, dmg);
  return { dmg, crit, block: dmg === 0 };
}
function playerAttacker() {
  return { lv: P.lv, dmg: weaponRange(P.eq.weapon), plus: strBonus(), hit: hitBonus(), crit: critRate() };
}

/* ================= 월드 (도깨비섬) ================= */
let M = null;          // 세계 (막힌 칸, 유닛 자리, 장식)
let units = [];        // 캐릭터·몬스터·NPC
let drops = [], fx = [], nums = [];
let player = null, uid = 0;
let cam = { x: 0, y: 0 }, zoom = 1, shake = { a: 0, t: 0 }, freeze = 0;
const cv = $('cv'), g = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
const ACTIVE_R = 24;   // 이 거리 안의 몬스터만 움직여요 (멀리 있는 몬스터는 잠들어 있어 렉이 없어요)

function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function idx(x, y) { return y * M.w + x; }
function inMap(x, y) { return x >= 0 && y >= 0 && x < M.w && y < M.h; }
function blocked(x, y) { return !inMap(x, y) || M.block[idx(x, y)] === 1; }
function free(x, y) { return !blocked(x, y) && !M.occ[idx(x, y)]; }
const ZI = Object.fromEntries(ZONES.map((z, i) => [z.id, i + 1]));   // 칸마다 지역 번호 (0 = 물)
function zoneAt(x, y) { const v = inMap(x, y) ? M.zid[idx(x, y)] : 0; return v ? ZONES[v - 1] : (curZone || ZONES[0]); }
const inTown = () => zoneAt(player.x, player.y).town;

function placeProp(name, cx, cy, force) {   // cx,cy = 밑동 가운데 칸
  const d = PROPS[name]; if (!d) return false;
  const fw = Math.max(1, d.fw), fh = Math.max(1, d.fh);
  const x0 = cx - Math.floor(fw / 2), y0 = cy - fh + 1;
  if (!force) {
    for (let y = y0 - 1; y <= cy + 1; y++) for (let x = x0 - 1; x <= x0 + fw; x++) {
      if (!inMap(x, y)) return false;
      const i = idx(x, y); if (M.block[i] || M.keep[i] || M.water[i]) return false;
    }
  }
  if (d.fw) for (let y = y0; y <= cy; y++) for (let x = x0; x < x0 + d.fw; x++) if (inMap(x, y)) M.block[idx(x, y)] = 1;
  const im = IMG[name]; const h = im ? d.w * im.height / im.width : d.w;
  const p = { kind: 'prop', name, x: (x0 + fw / 2) * CELL, y: (cy + 1) * CELL - 6, w: d.w, h, fade: 1 };
  if (d.flat) { p.y = (cy + .5) * CELL + h / 2; M.flats.push(p); } else M.props.push(p);
  return true;
}
// 마을 울타리 (네모, 동서남북에 문)
const TOWN_HX = 10, TOWN_HY = 7;
// 마을 건물 그림 (정면 그림이 오면 이름만 바꿔요)
const TOWN_ART = { shop: 't-shop', store: 't-storage', keeper: 'npc-storage' };   // 한 화면에 들어오는 작은 마을
function buildTownWall(cx, cy) {
  const FS = .167, GS = 56 / 250, top = cy - TOWN_HY, bot = cy + TOWN_HY, lef = cx - TOWN_HX, rig = cx + TOWN_HX;
  const add = (name, x, y, sc) => { const im = IMG[name]; if (!im) return; M.props.push({ kind: 'prop', name, x, y, w: im.width * sc, h: im.height * sc, fade: 1 }); };
  const shut = (x, y) => { if (inMap(x, y)) { const i = idx(x, y); M.block[i] = 1; M.keep[i] = 1; } };
  const gate = (x, y) => (x === cx && (y === top || y === bot)) || (y === cy && (x === lef || x === rig));
  for (let x = lef; x <= rig; x++) for (const y of [top, bot]) if (!gate(x, y)) shut(x, y);
  for (let y = top; y <= bot; y++) for (const x of [lef, rig]) if (!gate(x, y)) shut(x, y);
  const X = c => (c + .5) * CELL, Y = r => (r + .5) * CELL + 10;
  // 가로 울타리: 기둥은 한 칸마다 하나씩, 기둥 사이는 엮음 판 한 장으로 채워요 (겹치지 않게)
  const GH = CELL;   // GH = 정문 기둥까지 거리
  const panel = (x, y, wid) => { const im = IMG['fence-panel']; if (!im) return; M.props.push({ kind: 'prop', name: 'fence-panel', x, y: y - .5, w: wid, h: im.height * FS, fade: 1 }); };
  const hRun = (x0, x1, row) => {
    const n = Math.max(1, Math.round((x1 - x0) / CELL)), st = (x1 - x0) / n;
    for (let k = 0; k < n; k++) panel(x0 + st * (k + .5), Y(row), st + 6);
    for (let k = 0; k <= n; k++) add('fence-post', x0 + st * k, Y(row), FS);
  };
  for (const row of [top, bot]) { hRun(X(lef), X(cx) - GH, row); hRun(X(cx) + GH, X(rig), row); add('gate-front', X(cx), Y(row) + 2, GS); }
  // 세로 울타리: 옆에서 본 싸리 엮음 + 한 칸마다 통나무 기둥 (동서 문 자리는 비움)
  for (const col of [lef, rig]) {
    // 기둥은 한 칸마다, 기둥 사이 가운데에 옆에서 본 엮음 판 하나 (겹쳐 쌓지 않아요)
    // 엮음은 두 기둥 사이에 한 장, 위아래 끝이 기둥 뒤로 숨도록 두 기둥보다 먼저 그려요 (z)
    const VS = .0634, post = r => r > top && r < bot && Math.abs(r - cy) > 1, corner = r => r === top || r === bot;
    // 문 바로 위아래 칸(cy-1, cy+2)도 이어서 기둥과 문 사이 빈틈을 메워요
    const end = r => post(r) || corner(r) || r === cy - 1 || r === cy + 1;
    for (let r = top + 1; r <= bot; r++) if (end(r - 1) && end(r) && r !== cy && r !== cy + 1) {
      const im = IMG['fence-v-weave']; if (im) M.props.push({ kind: 'prop', name: 'fence-v-weave', x: X(col), y: Y(r) - 532 * VS, z: Y(r - 1) - 1, w: im.width * VS, h: im.height * VS, fade: 1 });
    }
    for (let r = top + 1; r < bot; r++) if (post(r)) add('fence-v-post', X(col), Y(r), VS);
    // 동서 문: 옆에서 본 기와 대문 (문짝이 마을 안쪽으로 열려요)
    add(col === lef ? 'gate-side-l' : 'gate-side', X(col), Y(cy + 1) + 4, GS);
  }
  for (const [c, r] of [[lef, top], [rig, top], [lef, bot], [rig, bot]]) add('fence-corner', X(c), Y(r) + 2, .17);
  // 문 안쪽 등불, 문 바깥 장승
  for (const [c, r] of [[cx + 2, top + 1], [cx - 2, bot - 1], [lef + 1, cy - 2], [rig - 1, cy + 2]]) { add('fence-lamp', X(c), Y(r), .19); shut(c, r); }
  for (const [c, r] of [[cx - 3, top - 2], [cx + 4, top - 2], [cx - 3, bot + 3], [cx + 4, bot + 3], [lef - 2, cy - 3], [lef - 2, cy + 4], [rig + 3, cy - 3], [rig + 3, cy + 4]]) placeProp('t-jangseung', c, r, 1);
  for (let x = cx - 1; x <= cx + 1; x++) for (const y of [top - 1, top + 1, bot - 1, bot + 1]) if (inMap(x, y)) M.keep[idx(x, y)] = 1;
}
function keepClear(x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inMap(x, y)) M.keep[idx(x, y)] = 1; }

// 지역별 장식 (개수는 넓이 2500칸 기준)
const DECO = {
  town: [['f-tree2', 5], ['f-bush', 8], ['f-flowers', 14]],
  near: [['f-tree1', 9], ['f-tree2', 13], ['f-bush', 15], ['f-rock1', 6], ['f-rocks', 10], ['f-flowers', 22], ['l-pine', 4], ['l-pavilion', 1]],
  paddy: [['f-hay', 18], ['l-wall', 12], ['f-tree2', 7], ['f-rocks', 8], ['l-reed', 8], ['f-bush', 6], ['f-flowers', 6]],
  bamboo: [['b-bamboo1', 22], ['b-bamboo2', 22], ['b-rock', 8], ['b-fallen', 8], ['b-sasa', 16], ['b-pond', 3], ['b-tower', 5], ['l-cliff', 4]],
  deep: [['b-bamboo1', 30], ['b-bamboo2', 22], ['b-lantern', 8], ['b-tower', 6], ['b-rock', 8], ['l-cliff', 6], ['b-sasa', 12]],
  beach: [['c-pine', 16], ['c-shells', 18], ['c-drift', 8], ['f-rocks', 5], ['l-reed', 4]],
  mtn: [['f-rock1', 10], ['f-rocks', 14], ['l-pine', 8], ['f-bush', 4]],
  marsh: [['b-pond', 10], ['l-reed', 30], ['f-bush', 8], ['b-fallen', 6], ['c-drift', 4], ['b-sasa', 8]],
};

function buildWorld() {
  const { w: W, h: H } = WORLD, N = W * H, cx = Math.round(WORLD.town[0] * W), cy = Math.round(WORLD.town[1] * H);
  M = { w: W, h: H, block: new Uint8Array(N), occ: new Int32Array(N), keep: new Uint8Array(N), water: new Uint8Array(N), zid: new Uint8Array(N), road: new Uint8Array(N),
    props: [], flats: [], npcs: [], zcells: {}, stream: new Uint8Array(N) };
  const R = seeded(33), F = ([u, v]) => [u * W, v * H];
  // 1) 섬 모양·강: 전체 지도 그림을 칸 크기로 줄여서 바다색이면 물. 바다와 이어지지 않은 물은 강(개울)
  { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    if (IMG[WORLD.map]) x.drawImage(IMG[WORLD.map], 0, 0, W, H); else { x.fillStyle = '#0aa'; x.fillRect(0, 0, W, H); x.fillStyle = '#6a3'; x.beginPath(); x.ellipse(W / 2, H / 2, W * .4, H * .38, 0, 0, 7); x.fill(); }
    const d = x.getImageData(0, 0, W, H).data; M.rgb = d;
    for (let i = 0; i < N; i++) { const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2]; if (b > 140 && r < 130 && b - r > 60 && gg > 110) M.water[i] = 1; }
    // 바닥 띠 한 칸짜리 구멍·섬 정리
    const w2 = M.water.slice(); for (let y = 1; y < H - 1; y++) for (let x2 = 1; x2 < W - 1; x2++) { const i = idx(x2, y); let n = 0; for (const j of [i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1, i + W - 1, i + W + 1]) n += w2[j]; if (n >= 7) M.water[i] = 1; else if (n <= 1) M.water[i] = 0; }
    const sea = new Uint8Array(N), st = []; for (let x2 = 0; x2 < W; x2++) for (const y of [0, H - 1]) { const i = idx(x2, y); if (M.water[i]) { sea[i] = 1; st.push(i); } } for (let y = 0; y < H; y++) for (const x2 of [0, W - 1]) { const i = idx(x2, y); if (M.water[i] && !sea[i]) { sea[i] = 1; st.push(i); } }
    while (st.length) { const i = st.pop(), x2 = i % W, y = (i - x2) / W; for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x2 + ax, ny = y + ay; if (!inMap(nx, ny)) continue; const j = idx(nx, ny); if (M.water[j] && !sea[j]) { sea[j] = 1; st.push(j); } } }
    for (let i = 0; i < N; i++) if (M.water[i] && !sea[i]) M.stream[i] = 1;
  }
  // 2) 지역: 씨앗에서 가장 가까운 곳 (경계는 구불구불)
  const seeds = []; for (const z of ZONES) for (const s2 of z.seeds || []) seeds.push([s2[0] * W, s2[1] * H, z.id]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y); if (M.water[i]) continue;
    const wx = x + Math.sin(y * .09) * 7 + Math.sin(y * .23 + x * .05) * 3, wy = y + Math.cos(x * .08) * 7;
    let b = 1e9, id = 'near'; for (const [sx, sy, zid] of seeds) { const d = (wx - sx) ** 2 + (wy - sy) ** 2; if (d < b) { b = d; id = zid; } }
    M.zid[i] = ZI[id];
  }
  // 2-1) 산맥 동쪽(대나무 골·깊은 대숲·안개 늪)은 전체 지도 그림의 색으로 나눠요: 밝은 초록=대나무, 짙은 초록=대숲, 잿빛 푸른색=늪
  if (IMG[WORLD.map] && M.rgb) {
    const E = new Set([ZI.bamboo, ZI.deep, ZI.marsh]), ch = [0, 1, 2].map(c => { const f = new Float32Array(N); for (let i = 0; i < N; i++) f[i] = M.rgb[i * 4 + c]; return boxBlur(f, 4); });
    const REF = [[ZI.bamboo, 105, 166, 35], [ZI.deep, 37, 108, 63], [ZI.marsh, 142, 175, 172]];
    const nz = M.zid.slice();
    for (let i = 0; i < N; i++) if (E.has(M.zid[i])) { let b = 1e9; for (const [z, r0, g0, b0] of REF) { if (z === ZI.marsh && (i / W) < H * .6) continue; const dd = (ch[0][i] - r0) ** 2 + (ch[1][i] - g0) ** 2 + (ch[2][i] - b0) ** 2; if (dd < b) { b = dd; nz[i] = z; } } }
    // 자잘한 얼룩 없애기 (둘레에서 가장 많은 지역으로)
    for (let pass = 0; pass < 3; pass++) { const src = nz.slice(); for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) { const i = idx(x, y); if (!E.has(src[i])) continue; const c = {}; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const v = src[i + dy * W + dx]; if (E.has(v)) c[v] = (c[v] || 0) + 1; } let bv = src[i], bn = 0; for (const k in c) if (c[k] > bn) { bn = c[k]; bv = +k; } nz[i] = bv; } }
    M.zid = nz;
  }
  // 3) 산맥: 등줄기 가까이는 못 지나가고(고갯길만 열림), 그 둘레는 바위 땅
  const segD = (x, y, pts) => { let b = 1e9; for (let k = 1; k < pts.length; k++) { const [ax, ay] = pts[k - 1], [bx, by] = pts[k], dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1); b = Math.min(b, Math.hypot(x - ax - dx * t, y - ay - dy * t)); } return b; };
  const ridge = ISLE.ridge.map(F), [pX, pY] = F(ISLE.pass), mtnCore = new Uint8Array(N); M.ridge = ridge; M.mtnCore = mtnCore;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y); if (M.water[i]) continue;
    const d = segD(x, y, ridge) + 1.6 * Math.sin(y * .21) + Math.sin(x * .37 + y * .11), inPass = Math.hypot(x - pX, y - pY) < 7.5;
    if (d < 17) M.zid[i] = ZI.mtn;
    if (d < 11 && !inPass) mtnCore[i] = 1;
  }
  // 4) 바닷가: 물에서 3칸까지는 모래사장. 큰 섬과 이어지지 않은 작은 섬은 바닷가로만
  const dist = new Int16Array(N).fill(99), q = [];
  for (let i = 0; i < N; i++) if (M.water[i]) { dist[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i - x) / W; for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ax, ny = y + ay; if (!inMap(nx, ny)) continue; const j = idx(nx, ny); if (dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; q.push(j); } } }
  { const main = new Uint8Array(N), st = [idx(cx, cy)]; main[st[0]] = 1;
    while (st.length) { const i = st.pop(), x = i % W, y = (i - x) / W; for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ax, ny = y + ay; if (!inMap(nx, ny)) continue; const j = idx(nx, ny); if (!main[j] && !M.water[j]) { main[j] = 1; st.push(j); } } }
    for (let i = 0; i < N; i++) if (!M.water[i] && (!main[i] || dist[i] <= 3) && M.zid[i] !== ZI.mtn) M.zid[i] = ZI.beach; }
  // 5) 마을 자리
  for (let y = cy - TOWN_HY; y <= cy + TOWN_HY; y++) for (let x = cx - TOWN_HX; x <= cx + TOWN_HX; x++) M.zid[idx(x, y)] = ZI.town;
  // 6) 길: 마을 동서남북 문에서 나가요
  M.roadLines = []; const cross = [];
  const line = (pts, wd = 1.25) => {
    M.roadLines.push(pts);
    for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = pts[k - 1], [bx, by] = pts[k], L = Math.hypot(bx - ax, by - ay);
      for (let t = 0; t <= L; t += .5) { const px = ax + (bx - ax) * t / L, py = ay + (by - ay) * t / L;
        for (let y = Math.floor(py - wd); y <= Math.ceil(py + wd); y++) for (let x = Math.floor(px - wd); x <= Math.ceil(px + wd); x++)
          if (inMap(x, y) && (x + .5 - px) ** 2 + (y + .5 - py) ** 2 <= wd * wd) { const i = idx(x, y); if (M.stream[i]) { if (!cross.includes(i)) cross.push(i); } else if (!M.water[i]) { M.road[i] = 1; M.keep[i] = 1; } } }
    }
  };
  const L2 = (...pts) => pts.map(p => p.length === 2 && p[0] <= 1 && p[1] <= 1 && !Number.isInteger(p[0]) ? F(p) : p);
  line(L2([cx, cy], [cx, cy - TOWN_HY - 6], [.33, .32], [.41, .29], [.46, .275], ISLE.pass, [.56, .255], [.62, .25], [.67, .27], [.71, .32], [.73, .42], [.74, .52], [.72, .64], [.7, .74], [.69, .8]));
  line(L2([cx, cy], [cx, cy + TOWN_HY + 6], [.26, .55], [.21, .6], [.24, .7], [.28, .78]));
  line(L2([cx, cy], [cx + TOWN_HX + 6, cy], [.38, .45], [.42, .452], [.46, .452], [.47, .5], [.47, .58], [.49, .68]));   // 강이 좁은 곳(약 4칸)에서 다리로 건너요
  const dockRoad = L2([cx, cy], [cx - TOWN_HX - 6, cy], [.16, .42], [.1, .42], [.04, .42]); line(dockRoad);
  // 산맥 막기 (길이 지나는 고갯길은 열려 있어요)
  for (let i = 0; i < N; i++) if (mtnCore[i] && !M.road[i]) M.block[i] = 1;
  // 7) 강은 지나갈 수 없어요. 길과 만나는 곳은 징검다리 (가운데 한 줄만 밟고 건너요)
  for (let i = 0; i < N; i++) if (M.water[i]) M.block[i] = 1;
  { const cs = cross.map(i => [i % W, Math.floor(i / W)]), groups = [];
    for (const c of cs) { const gq = groups.find(gq => gq.some(o => Math.abs(o[0] - c[0]) <= 2 && Math.abs(o[1] - c[1]) <= 2)); if (gq) gq.push(c); else groups.push([c]); }
    for (const gq of groups) {
      const by0 = Math.round(gq.reduce((t, b) => t + b[1], 0) / gq.length), by = by0 - 1; let row = gq.filter(c => c[1] === by0).map(c => [c[0], by]);   // 한 칸 위 줄로 건너요 (다리 기둥이 강 안에 서도록)
      // 강 폭 전체를 가로질러 한 줄 (양쪽 땅까지)
      let x0 = Math.min(...row.map(c => c[0])), x1 = Math.max(...row.map(c => c[0]));
      while (x0 > 0 && M.stream[idx(x0 - 1, by)]) x0--; while (x1 < W - 1 && M.stream[idx(x1 + 1, by)]) x1++;
      row = []; for (let x = x0; x <= x1; x++) { const i = idx(x, by); M.block[i] = 0; M.keep[i] = 1; row.push([x, by]); }
      // 나무 다리 한 장을 강 폭(양쪽 땅 한 칸씩 포함)에 맞춰 놓아요
      const mx = (x0 + x1) / 2; placeProp('l-bridge2', Math.round(mx), by, 1); const f = M.flats[M.flats.length - 1];
      if (f) { const k = (x1 - x0 + 2) * CELL / f.w; f.w *= k; f.h *= k; f.x = (mx + .5) * CELL; f.y = (by + .5) * CELL + f.h * .5 - 6; }
    }
    // 강가 갈대
    const R2 = seeded(9); for (let k = 0, t = 0; k < 60 && t < 4000; t++) { const i = Math.floor(R2() * N); if (M.water[i] || M.keep[i]) continue; if (M.stream[i + 1] || M.stream[i - 1] || M.stream[i + 2] || M.stream[i - 2]) { if (placeProp('l-reed', i % W, Math.floor(i / W))) k++; } }
  }
  // 8) 산: 큰 봉우리·작은 봉우리를 등줄기 따라 빽빽하게, 고갯길 그림, 던전 입구(준비 중)
  { const [qx, qy] = [Math.round(pX), Math.round(pY)];
    // 고갯길 그림은 넣지 않아요 (산을 빈틈없이 채운 뒤로 혼자 떠 보여서)
    const [dx0, dy0] = F(ISLE.dungeon); let ddx = Math.round(dx0), ddy = Math.round(dy0); while (ddx > 0 && mtnCore[idx(ddx - 1, ddy)]) ddx--;   // 산 서쪽 비탈
    placeProp('mt-dungeon', ddx + 1, ddy, 1); M.dungeon = [ddx - 1, ddy + 1]; keepClear(ddx - 3, ddy - 1, ddx + 1, ddy + 3);
    const spots = []; for (let y = 1, ry = 0; y < H - 1; y += 3, ry++) for (let x = 1 + (ry % 2) * 2; x < W - 1; x += 4) { const i = idx(x, y); if (mtnCore[i] && !M.road[i] && !M.water[i] && !M.keep[i]) spots.push([x + Math.round((R() - .5) * 2), y]); }
    for (const [x, y] of spots) { const e = segD(x, y, ridge); placeProp(e < 7 ? (R() < .55 ? 'mt-peak1' : 'mt-peak2') : (R() < .5 ? 'mt-peak2' : 'mt-cliff'), x, y, 1); }
    // 못 지나가는 산 칸은 모두 산 그림으로 덮여야 해요 (빈 땅처럼 보이는데 막힌 곳이 없게)
    const mts = M.props.filter(q => q.name.startsWith('mt-') && q.name !== 'mt-pass');
    const covered = (cx2, cy2) => { const px = (cx2 + .5) * CELL, py = (cy2 + .5) * CELL; return mts.some(q => Math.abs(q.x - px) < q.w * .36 && py <= q.y + 4 && py >= q.y - q.h * .62); };
    for (let y = H - 2; y > 0; y--) for (let x = 1; x < W - 1; x++) {
      const i = idx(x, y); if (!M.block[i] || !mtnCore[i] || M.water[i] || covered(x, y)) continue;
      const nm = segD(x, y, ridge) < 7 ? 'mt-peak1' : (R() < .6 ? 'mt-peak2' : 'mt-cliff');
      if (placeProp(nm, x, y + 1, 1)) mts.push(M.props[M.props.length - 1]);
    }
  }
  // 9) 선착장: 서쪽 바닷가에서 바다로 (나중에 배를 타고 새 섬으로)
  { let [px, py] = dockRoad[dockRoad.length - 2]; const [qx, qy] = dockRoad[dockRoad.length - 3]; const L = Math.hypot(px - qx, py - qy), ux = (px - qx) / L, uy = (py - qy) / L;
    for (let t = 0; t < 80 && !M.water[idx(Math.round(px), Math.round(py))]; t++) { px += ux; py += uy; }
    const dk = []; for (let k = 0; k < 3; k++) { const x = Math.round(px + ux * k), y = Math.round(py + uy * k); for (const [ax, ay] of [[0, 0], [0, 1], [1, 0]]) dk.push([x + ax, y + ay]); }
    for (const [x, y] of dk) if (inMap(x, y)) { const i = idx(x, y); M.block[i] = 0; M.keep[i] = 1; }
    placeProp('c-dock', Math.round(px + ux), Math.round(py + uy), 1);
    placeProp('c-boat', Math.round(px + ux * 2), Math.round(py + uy * 2) + 2, 1);
    M.dock = [Math.round(px + ux), Math.round(py + uy)];
  }
  // 7) 지역 칸 목록, 리스폰 지점
  for (const z of ZONES) M.zcells[z.id] = [];
  for (let i = 0; i < N; i++) if (M.zid[i] && !M.block[i]) M.zcells[ZONES[M.zid[i] - 1].id].push(i);
  ZONE.town.spawn = [cx, cy + 3];
  for (const z of ZONES) if (z.at) z.spawn = [Math.round(z.at[0] * W), Math.round(z.at[1] * H)];
  for (const z of ZONES) if (z.spawn) keepClear(z.spawn[0] - 3, z.spawn[1] - 3, z.spawn[0] + 3, z.spawn[1] + 3);
  // 8) 마을
  // 정돈된 마을: 북쪽 줄(잡화점·게시판·순간이동 문·대장간), 남쪽 줄(창고·우물·장독·집), 가운데 십자 길은 비워요
  keepClear(cx - 9, cy - 6, cx + 9, cy + 6);   // 마을 안에는 나무·바위가 저절로 생기지 않게
  const RN = cy - 3, RS = cy + 5;   // 건물 밑동 줄
  placeProp(TOWN_ART.shop, cx - 6, RN, 1);
  M.npcs.push({ kind: 'npc', role: 'shop', name: '꽃분 할머니', job: '잡화', img: 'npc-shop', x: cx - 6, y: RN + 1, h: 112 * UK });
  placeProp('t-board', cx - 3, RN - 1, 1);
  M.npcs.push({ kind: 'npc', role: 'board', name: '마을 게시판', hide: 1, x: cx - 3, y: RN - 1, h: 80, prop: M.props[M.props.length - 1] });
  placeProp('t-portal', cx + 3, RN - 1, 1);
  M.npcs.push({ kind: 'npc', role: 'guide', name: '순간이동 문', hide: 1, x: cx + 3, y: RN - 1, h: 120, prop: M.props[M.props.length - 1] });
  placeProp('t-forge', cx + 6, RN, 1);
  M.npcs.push({ kind: 'npc', role: 'smith', name: '쇠돌 아저씨', job: '대장간', img: 'npc-smith', x: cx + 7, y: RN + 1, h: 135 * UK, flip: 1 });
  placeProp(TOWN_ART.store, cx - 6, RS, 1);
  M.npcs.push({ kind: 'npc', role: 'store', name: '복덩 할아버지', job: '창고', img: TOWN_ART.keeper, x: cx - 3, y: RS - 1, h: 130 * UK });
  placeProp('t-well-f', cx + 6, RS, 1); placeProp('t-jars-f', cx - 8, cy + 2, 1); placeProp('t-jars-f', cx + 8, cy + 2, 1);
  // 마을 문 장승 (길이 마을 밖으로 나가는 곳 양옆)
  buildTownWall(cx, cy);
  // 9) 사냥터 우두머리 + 갈림길 이정표 (마을로 돌아올 땐 마을 귀환 주문서)
  for (const z of ZONES) if (z.at && z.boss) { z.bossTimer = BOSS_FIRST; z.bossAlive = false; }
  // 12) 지역마다 장식
  for (const z of ZONES) {
    const cells = M.zcells[z.id], sc = cells.length / 2500;
    for (const [n, c] of DECO[z.id] || []) for (let i = 0, tries = 0; i < Math.round(c * sc) && tries < 800; tries++) {
      const ci = cells[Math.floor(R() * cells.length)], x = ci % W, y = (ci - x) / W;
      if (placeProp(n, x, y)) i++;
    }
  }
  for (const z of ZONES) M.zcells[z.id] = M.zcells[z.id].filter(i => !M.block[i]);
  M.patterns = {};
  for (const t of new Set([...ZONES.map(z => z.tile), 'tile-sea'])) if (IMG[t]) M.patterns[t] = g.createPattern(IMG[t], 'repeat');
  buildGroundMasks(); buildMini();
}

function addUnit(u) { u.id = ++uid; u.px = u.x * CELL + CELL / 2; u.py = u.y * CELL + CELL / 2; u.face = 1; M.occ[idx(u.x, u.y)] = u.id; units.push(u); return u; }
function removeUnit(u) { if (M.occ[idx(u.x, u.y)] === u.id) M.occ[idx(u.x, u.y)] = 0; units = units.filter(v => v !== u); }
function findFree(cx, cy, maxR = 8) {
  for (let r = 0; r <= maxR; r++) for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++)
    if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) === r && free(x, y)) return [x, y];
  return null;
}

let curZone = null;
const MAPV = 2;   // 맵 모양이 바뀌면 올려요 (예전 자리는 무시하고 마을에서 시작)
function enterWorld() {
  units = []; shots = []; drops = []; fx = []; nums = []; chunkCache.clear(); chunkJob = null; curZone = null;
  buildWorld();
  const back = P.pos && P.mapv === MAPV && inMap(P.pos[0], P.pos[1]) && findFree(P.pos[0], P.pos[1], 4);   // 맵이 바뀌었으면 마을에서
  const [ex, ey] = back || findFree(...ZONE.town.spawn);
  player = addUnit({ kind: 'player', x: ex, y: ey, step: .36 });
  for (const n of M.npcs) addUnit(Object.assign(n, { step: 1 }));
  for (const z of ZONES) if (z.count) for (let i = 0; i < z.count; i++) spawnMonster(z);
  cam.x = player.px; cam.y = player.py;
  resetControl(); setZone(zoneAt(player.x, player.y), true);
}
function resetControl() { tq = []; tgt = null; moveGoal = null; moveGoalPt = null; held = false; auto = false; pending = 0; player.path = null; player.glide = null; player.moving = false; }
// 지역(리스폰 지점)으로 순간 이동
function teleport(id) {
  const z = ZONE[id], spot = findFree(...z.spawn); if (!spot) return;
  warpTo(spot[0], spot[1]); setZone(z);
}
function warpTo(x, y) {
  const spot = [x, y];
  M.occ[idx(player.x, player.y)] = 0;
  player.x = spot[0]; player.y = spot[1]; player.mv = null; player.glide = null;
  player.px = player.x * CELL + CELL / 2; player.py = player.y * CELL + CELL / 2; player.ox = player.oy = 0;
  M.occ[idx(player.x, player.y)] = player.id;
  cam.x = player.px; cam.y = player.py;
  resetControl();
}
function setZone(z, quiet) {
  if (curZone === z) return;
  curZone = z;
  $('mapname').textContent = z.name;
  document.body.classList.toggle('in-town', !!z.town);
  if (!quiet) banner(z.name + (z.lv ? `<small>권장 Lv ${z.lv}</small>` : ''), 1.5);
  updateHUD();
}
function pickMonType(z) {
  const list = z.mons, tot = list.reduce((t, m) => t + m[1], 0);
  let r = Math.random() * tot; for (const m of list) { r -= m[1]; if (r < 0) return m[0]; } return list[0][0];
}
function spawnMonster(z, type) {
  if (typeof z === 'string') { type = z; z = ZONES.find(q => q.boss === type) || ZONES.find(q => q.mons && q.mons.some(m => m[0] === type)) || curZone; }
  if (!type) type = pickMonType(z);
  const cells = M.zcells[z.id]; if (!cells || !cells.length) return null;
  for (let tries = 0; tries < 80; tries++) {
    const c = cells[Math.floor(Math.random() * cells.length)], x = c % M.w, y = (c - x) / M.w;
    if (!free(x, y) || M.road[c] && Math.random() < .7) continue;
    if (z.spawn && cheb(x, y, z.spawn[0], z.spawn[1]) < 6) continue;
    if (player && cheb(x, y, player.x, player.y) < 9) continue;
    let d = MONS[type];
    // 가끔 황금 몬스터: 안 덤비고, 튼튼하고, 엽전·부적을 훨씬 많이 떨어뜨려요
    if (!d.boss && Math.random() < RARE.chance) d = { ...d, name: '황금 ' + d.name, hp: d.hp * RARE.hp, exp: d.exp * RARE.exp, aggro: 0, rare: 1 };
    return addUnit({ kind: 'mon', type, d, zone: z, x, y, hp: d.hp, step: d.step * 1.35, home: [x, y], atkT: 0, wander: Math.random() * 3, flash: 0, kx: 0, ky: 0, sq: 0, dmgShow: 0 });
  }
  return null;
}

/* ================= 땅 그리기 (조각으로 나눠 한 번 그려 두고 다시 써요) ================= */
// 땅 무늬 크기 (캐릭터를 절반으로 줄이면서 .62 → .36)
const TS = .36;
const CH = 12, chunkCache = new Map(), chunkTmp = document.createElement('canvas');
function boxBlur(src, r) {
  const W = M.w, H = M.h, a = new Float32Array(W * H), b = new Float32Array(W * H), n = 2 * r + 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let k = -r; k <= r; k++) s += src[y * W + clamp(x + k, 0, W - 1)]; a[y * W + x] = s / n; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let k = -r; k <= r; k++) s += a[clamp(y + k, 0, H - 1) * W + x]; b[y * W + x] = s / n; }
  return b;
}
function buildGroundMasks() {
  const W = M.w, H = M.h, N = W * H;
  // 바다 기준으로 물가를 부드럽게, 개울은 또렷하게
  const landI = new Float32Array(N); for (let i = 0; i < N; i++) landI[i] = M.water[i] && !M.stream[i] ? 0 : 1;
  const land1 = boxBlur(landI, 1); for (let i = 0; i < N; i++) if (M.stream[i]) land1[i] = 0;
  const L = [];
  const foam = boxBlur(landI, 2); for (let i = 0; i < N; i++) foam[i] = M.stream[i] ? 0 : Math.min(1, foam[i] * 1.7);
  L.push({ fill: 'rgba(225,246,255,.55)', m: foam }, { tile: 'tile-sand', m: land1 });
  for (const t of ['tile-field', 'tile-paddy', 'tile-bamboo', 'tile-deep', 'tile-marsh', 'tile-rock', 'tile-town']) {
    const ind = new Float32Array(N); let any = 0;
    for (let i = 0; i < N; i++) { const z = M.zid[i] && ZONES[M.zid[i] - 1]; if (z && z.tile === t && z.id !== 'beach') { ind[i] = 1; any = 1; } }
    if (!any) continue;
    const m = boxBlur(ind, 2); for (let i = 0; i < N; i++) m[i] *= land1[i];
    L.push({ tile: t, m });
  }
  const road = new Float32Array(N); for (let i = 0; i < N; i++) road[i] = M.road[i] && !M.water[i] ? 1 : 0;
  const rm = boxBlur(road, 1); for (let i = 0; i < N; i++) rm[i] = Math.min(1, rm[i] * 1.5) * land1[i];
  L.push({ tile: 'tile-town', m: rm, alpha: .9 });
  const NX = Math.ceil(W / CH), NY = Math.ceil(H / CH);
  for (const l of L) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), im = x.createImageData(W, H);
    l.has = new Uint8Array(NX * NY);
    for (let i = 0; i < N; i++) { const v = l.m[i]; im.data[i * 4 + 3] = Math.round(v * 255); if (v > .01) { const px = i % W, py = (i - px) / W; l.has[Math.floor(py / CH) * NX + Math.floor(px / CH)] = 1; } }
    // 조각 경계 한 칸 바깥까지 있다고 표시 (번짐이 잘리지 않게)
    const h2 = l.has.slice(); for (let y = 0; y < NY; y++) for (let x2 = 0; x2 < NX; x2++) if (h2[y * NX + x2]) for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const nx = x2 + ax, ny = y + ay; if (nx >= 0 && ny >= 0 && nx < NX && ny < NY) l.has[ny * NX + nx] = 1; }
    x.putImageData(im, 0, 0); l.cv = c; delete l.m;
  }
  M.layers = L; M.nx = NX;
}
// 땅 조각: 화면에 필요한 조각은 바로 만들고, 곧 보일 둘레 조각은 한 프레임에 한 겹씩 미리 만들어 둬요 (걸을 때 버벅임 방지)
let chunkJob = null;
function chunkStep(job) {   // 한 겹 그리기. 다 그리면 true
  const { ix, iy, c } = job, S = CH * CELL, x = c.getContext('2d'), t = chunkTmp; if (t.width !== S) { t.width = t.height = S; }
  const tc = t.getContext('2d');
  while (job.li < M.layers.length) {
    const l = M.layers[job.li++];
    if (!l.has[iy * M.nx + ix]) continue;
    tc.setTransform(1, 0, 0, 1, 0, 0); tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, S, S);
    const pat = l.tile && M.patterns[l.tile];
    if (pat) { tc.save(); tc.translate(-ix * S, -iy * S); tc.scale(TS, TS); tc.fillStyle = pat; tc.fillRect(ix * S / TS, iy * S / TS, S / TS + 2, S / TS + 2); tc.restore(); }
    else { tc.fillStyle = l.fill || '#6a8f3a'; tc.fillRect(0, 0, S, S); }
    tc.globalCompositeOperation = 'destination-in'; tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high';
    tc.drawImage(l.cv, ix * CH - 1, iy * CH - 1, CH + 2, CH + 2, -CELL, -CELL, (CH + 2) * CELL, (CH + 2) * CELL);
    x.globalAlpha = l.alpha || 1; x.drawImage(t, 0, 0); x.globalAlpha = 1;
    return job.li >= M.layers.length;
  }
  return true;
}
function newJob(ix, iy) { const c = document.createElement('canvas'); c.width = c.height = CH * CELL; return { ix, iy, c, li: 0, key: ix + ',' + iy }; }
function storeChunk(key, c) { chunkCache.set(key, c); while (chunkCache.size > 40) chunkCache.delete(chunkCache.keys().next().value); }
function getChunk(ix, iy) {
  const key = ix + ',' + iy; let c = chunkCache.get(key);
  if (c) { chunkCache.delete(key); chunkCache.set(key, c); return c; }
  // 미리 만들던 조각이면 이어서 끝내기
  const job = chunkJob && chunkJob.key === key ? chunkJob : newJob(ix, iy); if (job === chunkJob) chunkJob = null;
  while (!chunkStep(job));
  storeChunk(key, job.c);
  return job.c;
}
function prefetchChunks(ix0, ix1, iy0, iy1) {
  if (!chunkJob) {
    const NY = Math.ceil(M.h / CH);
    for (let iy = Math.max(0, iy0 - 1); iy <= Math.min(NY - 1, iy1 + 1) && !chunkJob; iy++)
      for (let ix = Math.max(0, ix0 - 1); ix <= Math.min(M.nx - 1, ix1 + 1); ix++)
        if (!chunkCache.has(ix + ',' + iy)) { chunkJob = newJob(ix, iy); break; }
  }
  if (chunkJob && chunkStep(chunkJob)) { storeChunk(chunkJob.key, chunkJob.c); chunkJob = null; }
}
const hash2 = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0);
function drawSea(vx0, vx1, vy0, vy1) {
  const t = performance.now() / 1000, pat = M.patterns['tile-sea'];
  if (pat) { const ox = Math.sin(t * .4) * 10 + t * 6, oy = Math.cos(t * .3) * 6; g.save(); g.translate(ox, oy); g.scale(TS, TS); g.fillStyle = pat; g.fillRect((vx0 - ox) / TS - 2, (vy0 - oy) / TS - 2, (vx1 - vx0) / TS + 4, (vy1 - vy0) / TS + 4); g.restore(); }
  else { g.fillStyle = '#3a98c2'; g.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0); }
  // 반짝이는 물결
  g.strokeStyle = '#ffffff'; g.lineWidth = 2.5; g.lineCap = 'round';
  const x0 = Math.max(0, Math.floor(vx0 / CELL)), x1 = Math.min(M.w - 1, Math.ceil(vx1 / CELL)), y0 = Math.max(0, Math.floor(vy0 / CELL)), y1 = Math.min(M.h - 1, Math.ceil(vy1 / CELL));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const h = hash2(x, y); if (h % 4 || !M.water[idx(x, y)]) continue;
    const ph = (h >> 8) % 628 / 100, a = Math.sin(t * 1.3 + ph); if (a < 0) continue;
    g.globalAlpha = a * .45; const px = (x + .5) * CELL + Math.sin(t * .8 + ph) * 8, py = (y + .5) * CELL;
    g.beginPath(); g.moveTo(px - 10, py); g.quadraticCurveTo(px, py - 6, px + 10, py); g.stroke();
  }
  g.globalAlpha = 1;
}
function drawGround(vx0, vx1, vy0, vy1) {
  drawSea(vx0, vx1, vy0, vy1);
  const S = CH * CELL, T = g.getTransform();
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);   // 조각끼리 딱 붙게 화면 픽셀에 맞춰 그려요
  for (let iy = Math.max(0, Math.floor(vy0 / S)); iy <= Math.min(Math.ceil(M.h / CH) - 1, Math.floor(vy1 / S)); iy++)
    for (let ix = Math.max(0, Math.floor(vx0 / S)); ix <= Math.min(M.nx - 1, Math.floor(vx1 / S)); ix++)
      { const x0 = Math.round(ix * S * T.a + T.e), x1 = Math.round((ix + 1) * S * T.a + T.e), y0 = Math.round(iy * S * T.d + T.f), y1 = Math.round((iy + 1) * S * T.d + T.f);
        g.drawImage(getChunk(ix, iy), x0, y0, x1 - x0, y1 - y0); }
  g.restore();
  prefetchChunks(Math.floor(vx0 / S), Math.floor(vx1 / S), Math.floor(vy0 / S), Math.floor(vy1 / S));
  for (const p of M.flats) if (p.x + p.w / 2 > vx0 && p.x - p.w / 2 < vx1 && p.y > vy0 && p.y - p.h < vy1) drawProp(p);
}

/* ================= 길찾기 (A*, 우선순위 큐) ================= */
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function heapPush(h, f, v) { h.push([f, v]); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } }
function heapPop(h) {
  const top = h[0], last = h.pop();
  if (h.length) { h[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < h.length && h[l][0] < h[m][0]) m = l; if (r < h.length && h[r][0] < h[m][0]) m = r; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } }
  return top;
}
function findPath(sx, sy, tx, ty, adj, self, limit = 3000) {
  // adj: 목표 옆 칸(공격 거리)까지만 / 가까운 유닛은 피해 감
  const W = M.w, start = sy * W + sx;
  const goal = (x, y) => adj ? (cheb(x, y, tx, ty) <= 1 && !(x === tx && y === ty)) : (x === tx && y === ty);
  if (goal(sx, sy)) return [];
  const gS = new Map([[start, 0]]), from = new Map(), open = [], closed = new Set();
  heapPush(open, cheb(sx, sy, tx, ty), start);
  let best = start, bestH = 1e9, n = 0;
  while (open.length && n++ < limit) {
    const cur = heapPop(open)[1];
    if (closed.has(cur)) continue; closed.add(cur);
    const cx = cur % W, cy = (cur - cx) / W;
    if (goal(cx, cy)) { best = cur; bestH = 0; break; }
    const h = cheb(cx, cy, tx, ty); if (h < bestH) { bestH = h; best = cur; }
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (blocked(nx, ny)) continue;
      if (dx && dy && (blocked(cx + dx, cy) || blocked(cx, cy + dy))) continue;   // 모서리 끼기 막기
      const o = M.occ[ny * W + nx];
      const near = cheb(nx, ny, sx, sy) <= 2;
      if (o && o !== self && near && !(nx === tx && ny === ty && !adj)) continue;
      const ni = ny * W + nx, ng = gS.get(cur) + (dx && dy ? 1.42 : 1) + (o && o !== self ? 3 : 0);
      if (ng < (gS.has(ni) ? gS.get(ni) : 1e9)) { gS.set(ni, ng); from.set(ni, cur); heapPush(open, ng + cheb(nx, ny, tx, ty) * 1.01, ni); }
    }
  }
  if (best === start) return null;
  const path = []; let c = best; while (c !== start) { path.push([c % W, Math.floor(c / W)]); c = from.get(c); }
  return path.reverse();
}
function stepTo(u, nx, ny) {
  if (!free(nx, ny)) return false;
  const dx = nx - u.x, dy = ny - u.y;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return false;
  if (dx && dy && (blocked(u.x + dx, u.y) || blocked(u.x, u.y + dy))) return false;
  if (u === player ? !gateOK(nx, ny) : (u.kind === 'mon' && zoneAt(nx, ny).town)) return false;
  M.occ[idx(u.x, u.y)] = 0; M.occ[idx(nx, ny)] = u.id;
  u.mv = { fx: u.px, fy: u.py, t: 0, dur: u.step * (dx && dy ? 1.3 : 1) };
  u.x = nx; u.y = ny; u.mdx = dx; u.mdy = dy; if (dx) u.face = dx > 0 ? 1 : -1; u.walk = (u.walk || 0) + 1;
  return true;
}
function stepToward(u, tx, ty, adj) {
  const path = findPath(u.x, u.y, tx, ty, adj, u.id, u === player ? 3000 : 500);
  if (!path || !path.length) return false;
  return stepTo(u, path[0][0], path[0][1]);
}
// 먼 곳까지 걸어갈 때는 길을 한 번 찾아 두고 따라가요 (막히면 다시 찾기)
function walkTo(tx, ty) {
  const p = player;
  if (!p.path || !p.path.length || p.pathGoal !== tx + ',' + ty) { p.path = findPath(p.x, p.y, tx, ty, false, p.id, 40000); p.pathGoal = tx + ',' + ty; if (!p.path || !p.path.length) return false; }
  const [nx, ny] = p.path[0];
  if (stepTo(p, nx, ny)) { p.path.shift(); return true; }
  p.path = null;   // 길이 막혔으면 다음에 다시 찾아요
  return stepToward(p, tx, ty, false);
}
// 360도 걷기: 칸 길찾기 결과를 곧은 선으로 펴서 어느 방향으로든 미끄러지듯 걸어요 (칸 막기는 그대로)
function losClear(u, ax, ay, bx, by) {   // 픽셀 좌표 두 점 사이를 몸 폭만큼 지나갈 수 있는지
  const L = Math.hypot(bx - ax, by - ay); if (L < 1) return true;
  const n = Math.ceil(L / (CELL * .34)), ox = -(by - ay) / L, oy = (bx - ax) / L, mon = u.kind === 'mon';
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    for (const o of [-.26, 0, .26]) {
      const cx = Math.floor((ax + (bx - ax) * t + ox * o * CELL) / CELL), cy = Math.floor((ay + (by - ay) * t + oy * o * CELL) / CELL);
      if (blocked(cx, cy) || (mon && zoneAt(cx, cy).town)) return false;
      const oc = M.occ[idx(cx, cy)]; if (oc && oc !== u.id && cheb(cx, cy, u.x, u.y) <= 3) return false;
    }
  }
  return true;
}
function planGlide(u, tx, ty, adj, goalPt) {
  const end = goalPt || [tx * CELL + CELL / 2, ty * CELL + CELL / 2];
  if (!adj && losClear(u, u.px, u.py, end[0], end[1])) { u.glide = [end]; return true; }
  const path = findPath(u.x, u.y, tx, ty, adj, u.id, u === player ? 40000 : 600);
  if (!path || !path.length) { u.glide = null; return false; }
  const pts = path.map(([x, y]) => [x * CELL + CELL / 2, y * CELL + CELL / 2]);
  if (!adj && goalPt) { const [lx, ly] = path[path.length - 1]; if (lx === tx && ly === ty) pts[pts.length - 1] = goalPt; }
  const out = []; let cx = u.px, cy = u.py, i = 0;
  // 내 칸 가장자리에 서 있어서 첫 칸으로 바로 못 가면, 먼저 내 칸 가운데로 갔다가 출발해요
  if (!losClear(u, cx, cy, pts[0][0], pts[0][1])) { cx = u.x * CELL + CELL / 2; cy = u.y * CELL + CELL / 2; out.push([cx, cy]); }
  while (i < pts.length) {
    let j = Math.min(pts.length - 1, i + 30);
    while (j > i && !losClear(u, cx, cy, pts[j][0], pts[j][1])) j--;
    out.push(pts[j]); [cx, cy] = pts[j]; i = j + 1;
  }
  u.glide = out; return true;
}
// 캐릭터·몬스터 모두 어느 방향으로든 미끄러지듯 걸어요 (한 칸에는 한 명만)
function glideUpdate(u, dt) {
  if (!u.glide || !u.glide.length || (u === player && dead)) { u.moving = false; return; }
  let budget = CELL / u.step * dt;
  while (budget > 0 && u.glide && u.glide.length) {
    const [tx, ty] = u.glide[0], dx = tx - u.px, dy = ty - u.py, d = Math.hypot(dx, dy);
    if (d < .5) { u.glide.shift(); continue; }
    const st = Math.min(d, budget), nx = u.px + dx / d * st, ny = u.py + dy / d * st;
    const cx = Math.floor(nx / CELL), cy = Math.floor(ny / CELL);
    if (cx !== u.x || cy !== u.y) {
      const oc = inMap(cx, cy) ? M.occ[idx(cx, cy)] : 1;
      const ok = !blocked(cx, cy) && !(oc && oc !== u.id) && (u === player ? gateOK(cx, cy) : !zoneAt(cx, cy).town);
      if (!ok) {
        // 지금 서 있는 점이 내 칸 밖이면 내 칸 안으로 되돌려요 (막힌 칸에 걸려 꼼짝 못 하는 것 방지)
        const ix = Math.floor(u.px / CELL), iy = Math.floor(u.py / CELL);
        if (ix !== u.x || iy !== u.y) { u.px = clamp(u.px, u.x * CELL + 2, (u.x + 1) * CELL - 2); u.py = clamp(u.py, u.y * CELL + 2, (u.y + 1) * CELL - 2); }
        u.glide = null; if (u === player) planT = .2; else u.planT = .2; break;
      }
      M.occ[idx(u.x, u.y)] = 0; M.occ[idx(cx, cy)] = u.id; u.x = cx; u.y = cy;
      if (u === player) pickupAt(cx, cy);
    }
    if (Math.abs(dx) > 3) u.face = dx > 0 ? 1 : -1;
    u.px = nx; u.py = ny; u.dist = (u.dist || 0) + st; budget -= st;
    if (st >= d) u.glide.shift();
  }
  u.moving = !!(u.glide && u.glide.length);
  u.walk = Math.floor((u.dist || 0) / (CELL * .55));
}
// 마을 문: 사냥 시간이 없으면 1포인트를 써야 나갈 수 있어요
let gateAsked = 0;
function gateOK(nx, ny) {
  if (!zoneAt(player.x, player.y).town || zoneAt(nx, ny).town || P.hunt > 0 || isAdmin()) return true;
  if (performance.now() - gateAsked > 800) { gateAsked = performance.now(); openWin('gate'); }
  moveGoal = null; moveGoalPt = null; player.path = null; player.glide = null;
  return false;
}

/* ================= 플레이어 조작 ================= */
let tq = [], goalTry = 0, tgt = null, moveGoal = null, moveGoalPt = null, goalKey = '', planT = 0, held = false, auto = false, pending = 0, pointer = { x: 0, y: 0, down: false, onMon: null, drag: false };
// 관리자 모드: 이 기기에서 포인트 없이 사냥 시간 무한
function isAdmin() { try { return localStorage.getItem('rpg-admin') === '1'; } catch (e) { return false; } }
// 초록 물약: 걷기 1.33배, 공격 1.33배 빠르게
const HASTE = 1 / 1.33;
function hasted() { return P && P.haste > 0; }
let atkCD = 0, atkAnim = null, hurtT = 0, winT = 0, idleT = 0, regenT = 0, dead = false;

function screenToWorld(sx, sy) { return [(sx - VW / 2) / zoom + cam.x, (sy - VH / 2) / zoom + cam.y]; }
function unitAt(wx, wy, kinds) {
  let best = null;
  for (const u of units) {
    if (!kinds.includes(u.kind) || u.dying) continue;
    if (u.prop) { const p = u.prop; if (wx > p.x - p.w / 2 && wx < p.x + p.w / 2 && wy > p.y - p.h && wy < p.y) if (!best || u.py > best.py) best = u; continue; }
    const mon = u.kind === 'mon', h = mon ? u.d.h : u.h || 88 * UK, pad = mon ? 14 : 0, w = Math.max(h * .8, 30) + pad * 2;
    const ux = u.px + (u.ox || 0), uy = u.py + (u.oy || 0);
    if (wx > ux - w / 2 && wx < ux + w / 2 && wy > uy + CELL * .3 - Math.max(h, 36) - pad && wy < uy + CELL * .35 + pad / 2) if (!best || u.py > best.py) best = u;
  }
  if (best || !kinds.includes('mon')) return best;
  // 몬스터를 살짝 빗나가게 눌러도 가까이 있는 몬스터를 골라줘요 (움직이는 몬스터 누르기 쉽게)
  let bd = 1e9;
  for (const u of units) {
    if (u.kind !== 'mon' || u.dying) continue;
    const h = Math.max(u.d.h, 36), cx = u.px + (u.ox || 0), cy = u.py + (u.oy || 0) + CELL * .3 - h / 2;
    const d = Math.hypot(wx - cx, wy - cy), lim = h * .4 + 28;
    if (d < lim && d < bd) { bd = d; best = u; }
  }
  return best;
}
function onDown(e) {
  if (e.button !== undefined && e.button !== 0) return;
  SND.unlock();
  if (!P || dead || !M) return;
  const [wx, wy] = screenToWorld(e.clientX, e.clientY);
  pointer.down = true; pointer.x = e.clientX; pointer.y = e.clientY;
  if (enchantPick) { cancelEnchant(); }
  const npc = unitAt(wx, wy, ['npc']);
  if (npc) { tgt = npc; moveGoal = null; held = false; auto = false; pending = 0; pointer.onMon = null; return; }
  const m = unitAt(wx, wy, ['mon']);
  // 몬스터를 한 번 누르면 쓰러질 때까지 자동으로 공격해요 (컴퓨터·휴대폰 같음)
  // 싸우는 중에 쉬프트+클릭: 지금 몬스터를 잡은 뒤 차례로 잡을 몬스터 예약 (최대 3마리, 다시 누르면 취소)
  const fighting = m && tgt && tgt.kind === 'mon' && auto && m !== tgt;
  if (fighting && e.shiftKey) { pointer.down = false; toggleQueue(m); return; }
  // 휴대폰: 싸우는 중 다른 몬스터를 꾹 누르면 예약, 톡 누르면 그 몬스터로 바꾸기
  if (fighting && e.pointerType === 'touch') {
    const sx = e.clientX, sy = e.clientY;
    lp = { m, sx, sy, t: setTimeout(() => { if (!lp) return; lp = null; pointer.down = false; toggleQueue(m); try { navigator.vibrate && navigator.vibrate(30); } catch (er) {} }, 450) };
    return;
  }
  tq = [];
  if (m) { tgt = m; moveGoal = null; held = false; auto = true; pending = 0; pointer.onMon = m; return; }
  // 땅: 그쪽으로 걸어가기 (누르고 있으면 계속 따라감)
  tgt = null; auto = false; held = false; pending = 0; pointer.onMon = null;
  setGoal(wx, wy);
}
let lp = null;   // 꾹 누르기 기다리는 중
function toggleQueue(m) {
  const i = tq.indexOf(m);
  if (i >= 0) { tq.splice(i, 1); log(`<b>${josa(m.d.name, '을를')}</b> 예약에서 뺐어요`, 'sys'); }
  else { tq.push(m); log(`다음에 <b>${josa(m.d.name, '을를')}</b> 잡아요 <span class="dim">(예약 ${tq.length}마리)</span>`, 'sys'); }   // 예약은 제한 없어요
}
function setGoal(wx, wy) {
  const cx = clamp(Math.floor(wx / CELL), 0, M.w - 1), cy = clamp(Math.floor(wy / CELL), 0, M.h - 1);
  moveGoal = [cx, cy]; moveGoalPt = blocked(cx, cy) ? null : [wx, wy];
}
function onMove(e) {
  pointer.x = e.clientX; pointer.y = e.clientY;
  if (lp && Math.hypot(e.clientX - lp.sx, e.clientY - lp.sy) > 14) { clearTimeout(lp.t); lp = null; }   // 끌면 꾹 누르기 취소
  if (!M) return;
  if (pointer.drag) { $('bar').classList.toggle('drop', overBar(e.clientX, e.clientY)); return; }
  if (pointer.down && !tgt) { const [wx, wy] = screenToWorld(e.clientX, e.clientY); setGoal(wx, wy); }
  const [wx, wy] = screenToWorld(e.clientX, e.clientY);
  const hov = unitAt(wx, wy, ['mon', 'npc']);
  cv.style.cursor = hov ? (hov.kind === 'mon' ? SWORD_CURSOR : 'pointer') : 'default';
}
function overBar(x, y) { const r = $('bar').getBoundingClientRect(); return y >= r.top - 6 && x >= r.left && x <= r.right; }
function onUp(e) {
  if (lp) { const m = lp.m; clearTimeout(lp.t); lp = null; tq = []; if (!m.dying && units.includes(m)) { tgt = m; moveGoal = null; held = false; auto = true; pending = 0; } pointer.down = false; return; }   // 짧게 톡: 그 몬스터로 바꾸기
  if (!pointer.down) return;
  pointer.down = false;
  if (pointer.drag) {
    pointer.drag = false; $('bar').classList.remove('drop');
    if (tgt && tgt.kind === 'mon' && overBar(e.clientX, e.clientY)) { auto = true; log(`<b>${josa(tgt.d.name, '을를')}</b> 자동으로 공격해요`, 'sys'); }
  }
  held = false;
}
function talk(npc) {
  tgt = null;
  if (npc.role === 'shop' || npc.role === 'smith') { if (wins.includes('shop') && shopWho !== npc.role) { shopWho = npc.role; closeBuy(); renderShop(); focusWin('shop'); } else { shopWho = npc.role; openWin('shop'); } }
  else if (npc.role === 'store') { if (!wins.includes('store')) openWin('store'); if (!wins.includes('inv')) openWin('inv'); renderStore(); }
  else if (npc.role === 'board') openWin('board');
  else openWin('guide');
  const w = npc.role === 'shop' || npc.role === 'smith' ? 'shop' : npc.role === 'store' ? 'store' : npc.role === 'board' ? 'board' : 'guide';
  winNpc = wins.includes(w) ? { npc, w } : null;
}
// NPC 창(상점 등)은 그 NPC에게서 멀어지면 저절로 닫혀요
let winNpc = null;
function checkNpcWin() {
  if (!winNpc) return;
  if (!wins.includes(winNpc.w)) { winNpc = null; return; }
  const n = winNpc.npc, nx = n.prop ? n.prop.x : (n.x + .5) * CELL, ny = n.prop ? n.prop.y : (n.y + .5) * CELL;
  if (dead || Math.hypot(player.px - nx, player.py - ny) > CELL * 4.5) closeWin(winNpc.w);
}

function playerThink(dt) {
  if (dead) return;
  const p = player;
  planT -= dt;
  if (tgt && (tgt.dead || tgt.dying || !units.includes(tgt))) {
    const was = tgt.kind === 'mon' && auto; tq = tq.filter(u => !u.dead && !u.dying && units.includes(u));
    if (was && tq.length) { tgt = tq.shift(); auto = true; held = false; pending = 0; }   // 예약한 다음 몬스터로
    else { tgt = null; auto = false; held = false; pending = 0; tq = []; }
  }
  const settle = () => { const c = [p.x * CELL + CELL / 2, p.y * CELL + CELL / 2]; if (Math.hypot(c[0] - p.px, c[1] - p.py) > 1) { p.glide = [c]; return false; } p.glide = null; return true; };
  if (tgt && tgt.kind === 'npc') {
    if (cheb(p.x, p.y, tgt.x, tgt.y) <= 1) { if (settle()) { faceTo(p, tgt); talk(tgt); } return; }
    if (planT <= 0 || !p.moving) { planT = .3; planGlide(p, tgt.x, tgt.y, true); }
    return;
  }
  if (tgt) {
    const want = held || auto || pending > 0;
    if (!want) { tgt = null; return; }
    if (cheb(p.x, p.y, tgt.x, tgt.y) <= reach()) {
      if (settle()) { faceTo(p, tgt); if (atkCD <= 0 && !atkAnim) startAttack(tgt); }
    } else if (planT <= 0 || !p.moving) { planT = .25; planGlide(p, tgt.x, tgt.y, true); }
    return;
  }
  if (moveGoal) {
    const key = moveGoal + '|' + moveGoalPt;
    if (key !== goalKey && planT <= 0) { goalKey = key; goalTry = 0; planT = .1; if (!planGlide(p, moveGoal[0], moveGoal[1], false, moveGoalPt) && !pointer.down) moveGoal = null; return; }
    if (!p.moving && key === goalKey) {
      const end = moveGoalPt || [moveGoal[0] * CELL + CELL / 2, moveGoal[1] * CELL + CELL / 2];
      if (Math.hypot(end[0] - p.px, end[1] - p.py) < 3 || (p.x === moveGoal[0] && p.y === moveGoal[1] && !moveGoalPt)) { if (!pointer.down) moveGoal = null; return; }
      if (planT <= 0) { planT = .3; if ((++goalTry > 3 || !planGlide(p, moveGoal[0], moveGoal[1], false, moveGoalPt)) && !pointer.down) { moveGoal = null; goalTry = 0; } }   // 더 못 가면 그만
    }
  } else if (p.moving && !atkAnim) { /* 목표가 없어지면 그 자리에 멈춰요 */ p.glide = null; p.moving = false; }
}
function faceTo(u, t) { if (t.x !== u.x) u.face = t.x > u.x ? 1 : -1; }

// 공격: 휘두르기 준비 → 때리는 순간 판정 → 마무리
function startAttack(m) {
  const w = W_OF(); const spd = (w ? w.spd : .7) * (hasted() ? HASTE : 1);
  atkCD = spd; atkAnim = { t: 0, hit: false, m, type: w ? w.type : 'sword', wind: w && w.type === 'bow' ? Math.min(.28, spd * .4) : Math.min(.09, spd * .25) };
  if (pending > 0) pending--;
}
// 화살: 활 시위를 놓으면 날아가서 닿을 때 맞아요
let shots = [];
function shoot(m) {
  const x = player.px + player.face * 16, y = player.py + CELL * .32 - 92 * UK * .42;   // 활을 든 손 높이에서 나가요
  const tx = m.px, ty = m.py + CELL * .32 - m.d.h * .45;
  shots.push({ m, x0: x, y0: y, tx, ty, t: 0, d: Math.max(.08, Math.hypot(tx - x, ty - y) / 900) });
  SND.shoot();
}
function updateShots(dt) {
  for (const s of shots) {
    s.t += dt;
    if (!s.m.dying && units.includes(s.m)) { s.tx = s.m.px; s.ty = s.m.py + CELL * .32 - s.m.d.h * .45; }
    if (s.t >= s.d) { s.done = true; if (!s.m.dying && units.includes(s.m)) doHit(s.m, 'dagger'); }
  }
  shots = shots.filter(s => !s.done);
}
function drawShot(s) {
  const k = Math.min(1, s.t / s.d), x = s.x0 + (s.tx - s.x0) * k, y = s.y0 + (s.ty - s.y0) * k - Math.sin(k * Math.PI) * 10;
  const im = IMG['arrow']; if (!im) return;
  const w = 46 * UK * 1.4, hh = w * im.height / im.width;
  g.save(); g.translate(x, y); g.rotate(Math.atan2(s.ty - s.y0, s.tx - s.x0)); g.drawImage(im, -w / 2, -hh / 2, w, hh); g.restore();
}
function doHit(m, type) {
  const r = rollAttack(playerAttacker(), { ac: m.d.ac, lv: m.d.lv });
  const mx = m.px + (m.ox || 0), my = m.py + (m.oy || 0) - m.d.h * .45;
  const dir = Math.sign(m.px - player.px) || player.face;
  if (r.miss) { addNum(mx, my - 10, '빗나감', 'miss'); SND.miss(); fx.push({ k: 'whiff', x: mx - dir * 10, y: my, dir, t: 0, d: .18 }); return; }
  if (r.block) { addNum(mx, my - 10, '막음', 'block'); SND.block(); fx.push({ k: 'spark', x: mx - dir * 14, y: my, t: 0, d: .2, n: 5, col: '#bfe6ff' }); m.flash = .05; freeze = Math.max(freeze, .03); return; }
  m.hp -= r.dmg;
  const kill = m.hp <= 0;
  // 타격감: 히트 스톱 + 흔들림 + 번쩍임 + 밀림 + 찌그러짐 + 이펙트 + 숫자 + 소리
  freeze = Math.max(freeze, kill ? .15 : r.crit ? .12 : .06);
  const amp = { dagger: 2, sword: 3, club: 5 }[type] * (r.crit ? 2 : 1) + (kill ? 2 : 0);
  shake.a = Math.max(shake.a, amp); shake.t = r.crit ? .25 : .14;
  m.flash = .08; m.kx = dir * (type === 'club' ? 12 : 7); m.ky = 0; m.sq = 1;
  fx.push({ k: type, x: mx, y: my, dir, t: 0, d: type === 'club' ? .24 : type === 'sword' ? .16 : .12, crit: r.crit });
  fx.push({ k: 'spark', x: mx, y: my, t: 0, d: .3, n: r.crit ? 14 : 8, col: r.crit ? '#ffd23e' : '#fff6d0' });
  addNum(mx, my - 14, String(r.dmg), r.crit ? 'crit' : 'hit');
  SND.hit(type, r.crit);
  m.dmgShow = 4; m.angry = true;
  if (kill) killMonster(m);
}
function killMonster(m) {
  m.dying = 0.0001; m.hp = 0; M.occ[idx(m.x, m.y)] = 0;
  SND.kill();
  if (tgt === m) { if (!auto) tgt = null; }
  P.kills++;
  gainExp(m.d.exp);
  log(`<b>${josa(m.d.name, '을를')}</b> 쓰러뜨렸어요 <span class="dim">경험치 +${m.d.exp}</span>`);
  dropLoot(m);
  const z = m.zone;
  if (m.d.rare) { banner(`${josa(m.d.name, '을를')} 잡았어요!`); SND.coin(); }
  if (m.d.boss) { z.bossAlive = false; z.bossTimer = BOSS_AGAIN; banner(`${josa(m.d.name, '을를')} 물리쳤어요!`); }
  else { const w = M; setTimeout(() => { if (M === w && units.filter(u => u.kind === 'mon' && u.zone === z && !u.d.boss && !u.dying).length < z.count) spawnMonster(z); }, 5000 + Math.random() * 4000); }
}
function dropLoot(m) {
  const dr = m.zone.drop, bag = [];
  const c = m.d.boss ? rnd(dr.coin[0] * 20, dr.coin[1] * 20) : m.d.rare ? rnd(dr.coin[0] * RARE.coin, dr.coin[1] * RARE.coin) : (Math.random() < .7 ? rnd(dr.coin[0], dr.coin[1]) : 0);
  const rm = m.d.rare ? RARE.drop : 1;   // 황금 몬스터는 부적·방어구 확률이 크게 올라가요
  if (c) bag.push({ coin: c });
  const tier = m.zone.tier;
  const gearOf = () => { const pool = [...Object.keys(ARMORS).filter(k => ARMORS[k].tier === tier).map(k => ({ g: 'a', k }))]; const it = pool[rnd(0, pool.length - 1)]; return { item: { g: it.g, k: it.k, en: 0 }, rare: 1 }; };
  if (m.d.boss) {
    bag.push(gearOf());
    if (Math.random() < ACC_DROP) { const pool = Object.keys(ACCS); if (pool.length) bag.push({ item: { g: 'c', k: pool[rnd(0, pool.length - 1)], en: 0 }, rare: 1 }); }
    const n = rnd(3, 5); for (let i = 0; i < n; i++) bag.push({ item: { i: Math.random() < 1 / 3 ? 'wscroll' : 'ascroll', n: 1 }, rare: 1 });
  } else {
    if (Math.random() < dr.w * rm) bag.push({ item: { i: 'wscroll', n: 1 }, rare: 1 });
    if (Math.random() < dr.a * rm) bag.push({ item: { i: 'ascroll', n: 1 }, rare: 1 });
    if (Math.random() < dr.gear * rm) bag.push(gearOf());
    if (Math.random() < .03) bag.push({ item: { i: 'potion', n: 1 } });
    if (Math.random() < (m.d.rare ? .3 : .015)) bag.push({ item: { i: 'haste', n: 1 }, rare: 1 });
    if (Math.random() < .02) bag.push({ item: { i: 'ret', n: 1 } });
    if (Math.random() < .02) bag.push({ item: { i: 'tele', n: 1 } });
  }
  bag.forEach((b, i) => {
    const spot = i === 0 ? [m.x, m.y] : (findDropSpot(m.x, m.y) || [m.x, m.y]);
    drops.push(Object.assign(b, { x: spot[0], y: spot[1], t: 0, life: 90, fx: m.px, fy: m.py - 20 }));
    if (b.rare) fx.push({ k: 'pillar', x: spot[0] * CELL + CELL / 2, y: spot[1] * CELL + CELL / 2, t: 0, d: 3.5 });
  });
}
function findDropSpot(cx, cy) {
  for (let r = 1; r < 3; r++) for (let i = 0; i < 12; i++) { const x = cx + rnd(-r, r), y = cy + rnd(-r, r); if (!blocked(x, y) && !drops.some(d => d.x === x && d.y === y)) return [x, y]; }
  return null;
}
// 떨어진 물건은 잠깐 뒤 저절로 날아와 가방에 들어가요 (가방이 가득 차면 땅에 남아요)
const FLY_AT = d => d.rare ? 1.1 : .6, FLY_T = .28;
function autoLoot() {
  for (const d of drops.slice()) {
    if (d.stay || d.t < FLY_AT(d) + FLY_T) continue;
    if (!takeDrop(d)) { d.stay = 1; continue; }
  }
}
function takeDrop(d) {
  if (d.coin) { P.coins += d.coin; SND.coin(); addNum(player.px, player.py - 40, '+' + d.coin + ' 엽전', 'coin'); }
  else { if (!giveItem(d.item)) { if (!d.warned) { log('가방이 가득 찼어요', 'warn'); d.warned = 1; } return false; } SND.pick(); log(`<b>${josa(itemName(d.item), '을를')}</b> 주웠어요`, 'item'); }
  drops.splice(drops.indexOf(d), 1); dirty = true; updateHUD(); return true;
}
function pickupAt(x, y) {
  for (const d of drops.slice()) {
    if (d.x !== x || d.y !== y || d.t < .45) continue;
    if (d.coin) { P.coins += d.coin; SND.coin(); addNum(player.px, player.py - 40, '+' + d.coin + ' 엽전', 'coin'); }
    else { if (!giveItem(d.item)) { if (!d.warned) { log('가방이 가득 찼어요', 'warn'); d.warned = 1; } continue; } SND.pick(); log(`<b>${josa(itemName(d.item), '을를')}</b> 주웠어요`, 'item'); }
    drops.splice(drops.indexOf(d), 1); dirty = true; updateHUD();
  }
}

/* ================= 경험치·레벨 ================= */
function gainExp(n) {
  if (P.lv >= MAX_LV) return;
  P.exp += n;
  while (P.lv < MAX_LV && P.exp >= needExp(P.lv)) {
    P.exp -= needExp(P.lv); P.lv++;
    if (P.lv % 5 === 0) P.pts++;
    P.hp = maxHP(); winT = .9;
    SND.level(); banner(`레벨 업! Lv ${P.lv}` + (P.lv % 5 === 0 ? '<small>보너스 능력치 1점을 받았어요</small>' : ''));
    fx.push({ k: 'lvup', x: player.px, y: player.py, t: 0, d: 1 });
    if (P.lv % 5 === 0) $('b-char').classList.add('alert');
  }
  dirty = true; updateHUD();
}

/* ================= 몬스터 ================= */
function monThink(m, dt) {
  if (m.dying) return;
  const d = m.d;
  m.atkT -= dt;
  const dist = cheb(m.x, m.y, player.x, player.y);
  if (dist > ACTIVE_R) { m.angry = false; return; }   // 멀리 있는 몬스터는 쉬어요
  m.planT = (m.planT || 0) - dt;
  if (!dead && !curZone.town && (m.angry || (d.aggro && dist <= 4))) {
    m.angry = true;
    if (dist > 12) { m.angry = false; m.glide = null; }   // 싸움이 붙으면 구역을 넘어서라도 쫓아오고, 12칸 넘게 떨어져야 포기해요
    else if (dist <= 1) {
      m.glide = null;
      if (m.atkT <= 0) { faceTo(m, player); monAttack(m); m.atkT = d.boss ? 1.5 : 1.3; }
    } else if (m.planT <= 0 || !m.moving) { m.planT = .35 + Math.random() * .2; planGlide(m, player.x, player.y, true); }
    return;
  }
  m.wander -= dt;
  if (!m.moving && cheb(m.x, m.y, m.home[0], m.home[1]) > 5) { if (m.wander <= 0) { m.wander = .6; planGlide(m, m.home[0], m.home[1], false); } return; }
  if (m.wander <= 0 && !m.moving) {
    m.wander = 1.5 + Math.random() * 3.5;
    const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 2.5;
    const tx = m.px + Math.cos(a) * r * CELL, ty = m.py + Math.sin(a) * r * CELL, cx = Math.floor(tx / CELL), cy = Math.floor(ty / CELL);
    if (cheb(cx, cy, m.home[0], m.home[1]) <= 5 && losClear(m, m.px, m.py, tx, ty)) m.glide = [[tx, ty]];
  }
}
function monAttack(m) {
  m.lunge = .2;
  setTimeout(() => {
    if (dead || m.dying || !units.includes(m) || cheb(m.x, m.y, player.x, player.y) > 1) return;
    const r = rollAttack({ lv: m.d.lv, dmg: m.d.dmg, crit: 0 }, { ac: playerAC(), lv: P.lv });
    const px = player.px, py = player.py - 36;
    if (r.miss) { addNum(px, py, '빗나감', 'miss'); return; }
    if (r.block) { addNum(px, py, '막음', 'block'); SND.block(); return; }
    P.hp -= r.dmg; hurtT = .18; idleT = 0;
    addNum(px, py, String(r.dmg), 'hurt'); SND.hurt();
    shake.a = Math.max(shake.a, m.d.boss ? 6 : 2.5); shake.t = .15;
    $('hurtv').classList.remove('on'); void $('hurtv').offsetWidth; $('hurtv').classList.add('on');
    if (P.hp <= 0) die();
    updateHUD();
  }, 120);
}

/* ================= 죽음 ================= */
function die() {
  P.hp = 0; dead = true; P.deaths++;
  const loss = Math.floor(needExp(P.lv) * .05);
  P.exp = Math.max(0, P.exp - loss);
  tgt = null; auto = false; moveGoal = null;
  SND.die();
  banner(`쓰러졌어요...<small>경험치 ${loss.toLocaleString()}만큼 잃었어요. 마을에서 깨어나요</small>`, 2.6);
  setTimeout(() => { dead = false; P.hp = maxHP(); teleport('town'); dirty = true; save(true); }, 2600);
}

/* ================= 효과·숫자 ================= */
function addNum(x, y, text, kind) { nums.push({ x: x + rnd(-6, 6), y, text, kind, t: 0 }); }
let bannerT = 0;
function banner(html, sec = 1.8) { const b = $('banner'); b.innerHTML = html; b.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), sec * 1000); }
function log(html, cls = '') {
  const box = $('log'); const d = document.createElement('div'); d.className = 'ln ' + cls; d.innerHTML = html; box.appendChild(d);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => d.classList.add('old'), 4000); setTimeout(() => d.remove(), 5200);
  // 컴퓨터 아래 정보창의 알림 기록 (최근 40줄, 맨 아래가 최신)
  const pl = $('plog'); const e = document.createElement('div'); e.className = 'ln ' + cls; e.innerHTML = html; pl.appendChild(e);
  while (pl.children.length > 40) pl.firstChild.remove(); pl.scrollTop = pl.scrollHeight;
}

/* ================= 가방·장비 ================= */
const INV_MAX = 30;
function itemName(it) {
  if (it.i) return ITEMS[it.i].name + (it.n > 1 ? ' ' + it.n + '개' : '');
  const d = GDEF(it);
  return (it.en ? '+' + it.en + ' ' : '') + d.name;
}
function giveItem(it) {
  if (it.i) { const s = P.inv.find(x => x.i === it.i); if (s) { s.n += it.n || 1; return true; } }
  if (P.inv.length >= INV_MAX) return false;
  P.inv.push(it.i ? { i: it.i, n: it.n || 1 } : { g: it.g, k: it.k, en: it.en || 0 });
  if (wins.includes('inv')) renderInv();
  return true;
}
function useItem(ix) {
  const it = P.inv[ix]; if (!it) return;
  if (it.i === 'potion') return drinkPotion();
  if (it.i === 'haste') return drinkHaste();
  if (it.i === 'ret') return readReturn();
  if (it.i === 'tele') return readTele();
  if (it.i === 'wscroll' || it.i === 'ascroll') { startEnchantPick(it.i); return; }
  if (it.g) equip(ix);
}
function equip(ix) {
  const it = P.inv[ix]; if (!it || !it.g) return;
  if (it.g === 'w') { log(`${HERO()}는 자기 무기만 쓸 수 있어요`, 'warn'); return; }
  const slot = it.g === 'w' ? 'weapon' : GDEF(it).slot;
  if (slot === 'shield' && P.eq.weapon && WEAPONS[P.eq.weapon.k].two) { log(`${WTYPE[WEAPONS[P.eq.weapon.k].type]}${WEAPONS[P.eq.weapon.k].type === 'bow' ? '은' : '는'} 양손 무기라 방패를 들 수 없어요`, 'warn'); return; }
  P.inv.splice(ix, 1);
  if (it.g === 'w' && WEAPONS[it.k].two && P.eq.shield) { P.inv.push(P.eq.shield); P.eq.shield = null; log('양손 무기를 들어서 방패를 가방에 넣었어요', 'sys'); }
  if (P.eq[slot]) P.inv.push(P.eq[slot]);
  P.eq[slot] = it; SND.ui(); P.hp = Math.min(P.hp, maxHP());
  dirty = true; renderInv(); updateHUD();
}
function unequip(slot) {
  if (!P.eq[slot] || slot === 'weapon') return;   // 검은 뺄 수 없어요
  if (P.inv.length >= INV_MAX) { log('가방이 가득 찼어요', 'warn'); return; }
  P.inv.push(P.eq[slot]); P.eq[slot] = null; SND.ui(); P.hp = Math.min(P.hp, maxHP()); dirty = true; renderInv(); updateHUD();
}
let hasteShow = 0;
function drinkHaste() {
  const s = P.inv.find(x => x.i === 'haste');
  if (!s || dead) { log('초록 물약이 없어요', 'warn'); return; }
  s.n--; if (s.n <= 0) P.inv.splice(P.inv.indexOf(s), 1);
  P.haste = ITEMS.haste.sec * 1000;
  SND.potion(); addNum(player.px, player.py - 40, '빨라졌어요!', 'heal');
  fx.push({ k: 'heal', x: player.px, y: player.py, t: 0, d: .6 });
  log('초록 물약을 마셨어요. 5분 동안 걷기와 공격이 빨라져요', 'sys');
  dirty = true; updateHUD(); if (wins.includes('inv')) renderInv();
}
// 단축키 1~4: 가방에서 아이템을 골라 넣어요 (리니지처럼 아이템 위에서 숫자 누르기, 또는 칸을 누르고 아이템 고르기)
const QUSE = ['potion', 'haste', 'ret', 'tele', 'wscroll', 'ascroll'];
const qkeys = () => (P.keys && P.keys.length === 4) ? P.keys : (P.keys = ['potion', 'haste', 'ret', 'tele']);
function setQuick(k, id) {
  if (!QUSE.includes(id)) { log('물약과 주문서, 부적만 단축키에 넣을 수 있어요', 'warn'); return; }
  const ks = qkeys(); const was = ks.indexOf(id); if (was >= 0) ks[was] = ks[k] === id ? null : ks[k];
  ks[k] = id; dirty = true; SND.ui();
  log(`<b>${ITEMS[id].name}</b>을(를) 단축키 ${k + 1}에 넣었어요`, 'sys');
  updateHUD(); if (wins.includes('inv')) renderInv();
}
const sDrag = { from: null, ix: -1, x: 0, y: 0, on: false, done: false, it: null };
const qDrag = { id: null, from: -1, x: 0, y: 0, on: false, done: false };
function useQuick(k) {
  const id = qkeys()[k];
  if (!id) { if (!wins.includes('inv')) openWin('inv'); return; }
  const ix = P.inv.findIndex(x => x.i === id);
  if (ix < 0) { log(`${ITEMS[id].name}이(가) 없어요`, 'warn'); return; }
  useItem(ix);
}
function renderQuick() {
  if (!P) return;
  const ks = qkeys();
  document.querySelectorAll('.bbtn.qs').forEach(b => {
    const k = +b.dataset.k, id = ks[k], s = id && P.inv.find(x => x.i === id), n = s ? s.n : 0;
    b.classList.toggle('empty', !id); b.classList.toggle('zero', !!id && !n);
    const im = b.querySelector('img'), src = id ? `img/${ITEMS[id].img}.png` : '';
    if (im.getAttribute('src') !== src) { if (src) im.setAttribute('src', src); else im.removeAttribute('src'); }
    b.querySelector('.n').textContent = id ? n : '';
    b.title = id ? `${ITEMS[id].name} (${k + 1})` : `빈 칸 (${k + 1}) · 눌러서 아이템 넣기`;
    const on = id === 'haste' && hasted(); b.classList.toggle('on', on); b.querySelector('.bt').textContent = '';   // 남은 시간은 왼쪽 위 버프 아이콘에만
  });
}
// 받은 버프: 상태창 왼쪽 위에 그림과 남은 시간 (새 버프는 BUFFS에 한 줄 추가)
const BUFFS = [{ id: 'haste', img: 'i-haste', left: () => P.haste, max: () => ITEMS.haste.sec * 1000 }];
function renderBuffs() {
  const box = $('buffs'); if (!box) return;
  const on = BUFFS.filter(b => b.left() > 0);
  const key = on.map(b => b.id).join();
  if (box.dataset.k !== key) { box.dataset.k = key; box.innerHTML = on.map(b => `<div class="bf" data-b="${b.id}"><img src="img/${b.img}.png" alt=""><span></span></div>`).join(''); }
  for (const b of on) { const el = box.querySelector(`[data-b="${b.id}"]`), t = b.left(); el.querySelector('span').textContent = fmtTime(t); el.style.setProperty('--p', (360 * clamp(1 - t / b.max(), 0, 1)).toFixed(1) + 'deg'); el.classList.toggle('end', t < 10000); }
}
function updateHaste() { renderQuick(); renderBuffs(); }
// 마을 귀환 주문서 (3) · 순간이동 주문서 (4)
function useOne(id) { const s = P.inv.find(x => x.i === id); if (!s) return false; s.n--; if (s.n <= 0) P.inv.splice(P.inv.indexOf(s), 1); dirty = true; if (wins.includes('inv')) renderInv(); updateHUD(); return true; }
function readReturn() {
  if (dead) return;
  if (inTown()) { log('여기는 이미 마을이에요', 'warn'); return; }
  if (!P.inv.some(x => x.i === 'ret')) { log('마을 귀환 주문서가 없어요', 'warn'); return; }
  useOne('ret'); SND.warp(); log('마을 귀환 주문서를 읽었어요', 'sys'); goTown();
}
function readTele() {
  if (dead) return;
  if (inTown()) { log('마을에서는 순간이동 주문서를 쓸 수 없어요', 'warn'); return; }
  if (!P.inv.some(x => x.i === 'tele')) { log('순간이동 주문서가 없어요', 'warn'); return; }
  const cells = M.zcells[curZone && curZone.id] || [];
  let spot = null;
  for (let k = 0; k < 40 && !spot; k++) { const i = cells[Math.floor(Math.random() * cells.length)]; if (i != null && free(i % M.w, Math.floor(i / M.w))) spot = [i % M.w, Math.floor(i / M.w)]; }
  if (!spot) { log('지금은 순간이동할 곳이 없어요', 'warn'); return; }
  useOne('tele'); SND.warp();
  warpFade(() => { warpTo(spot[0], spot[1]); });
}
function drinkPotion() {
  const s = P.inv.find(x => x.i === 'potion');
  if (!s || dead) { log('물약이 없어요', 'warn'); return; }
  if (P.hp >= maxHP()) return;
  s.n--; if (s.n <= 0) P.inv.splice(P.inv.indexOf(s), 1);
  P.hp = Math.min(maxHP(), P.hp + ITEMS.potion.heal);
  SND.potion(); addNum(player.px, player.py - 40, '+' + ITEMS.potion.heal, 'heal');
  fx.push({ k: 'heal', x: player.px, y: player.py, t: 0, d: .6 });
  dirty = true; updateHUD(); if (wins.includes('inv')) renderInv();
}

/* ================= 강화 ================= */
let enchantPick = null, enchanting = false;
function startEnchantPick(scroll) {
  enchantPick = scroll;
  if (!wins.includes('inv')) openWin('inv'); else renderInv();
  $('inv-hint').textContent = scroll === 'wscroll' ? '강화할 무기를 고르세요' : '강화할 방어구를 고르세요';
  document.body.classList.add('picking');
}
function cancelEnchant() { enchantPick = null; document.body.classList.remove('picking'); $('inv-hint').textContent = ''; }
function enchantTarget(ref) {   // ref: {eq:slot} 또는 {inv:index}
  const it = ref.eq ? P.eq[ref.eq] : P.inv[ref.inv];
  const scroll = enchantPick; cancelEnchant();
  if (!it || !it.g) return;
  const kind = scroll === 'wscroll' ? 'w' : 'a';
  if (it.g === 'c') { log('장신구는 강화할 수 없어요', 'warn'); return; }
  if (it.g !== kind) { log(kind === 'w' ? '무기 강화 부적은 무기에만 쓸 수 있어요' : '방어구 강화 부적은 방어구에만 쓸 수 있어요', 'warn'); return; }
  const rule = ENCH[kind];
  if (it.en >= rule.max) { log(`+${rule.max}이 가장 높은 강화예요`, 'warn'); return; }
  const s = P.inv.find(x => x.i === scroll); if (!s) return;
  s.n--; if (s.n <= 0) P.inv.splice(P.inv.indexOf(s), 1);
  const risky = it.en >= rule.safe;
  const ok = !risky || Math.random() < ENCH.rate;
  dirty = true;
  playEnchant(it, risky, ok, () => {
    if (ok) { it.en++; log(`<b>${itemName(it)}</b> 강화 성공!`, 'item'); }
    else {
      log(`<b>${josa(itemName(it), '이가')}</b> 산산조각 났어요`, 'warn');
      if (ref.eq) P.eq[ref.eq] = null; else { const i = P.inv.indexOf(it); if (i >= 0) P.inv.splice(i, 1); }
    }
    save(); renderInv(); updateHUD();
  });
}
function playEnchant(it, risky, ok, done) {
  enchanting = true;
  const ov = $('ench'), img = $('ench-img'), txt = $('ench-txt');
  img.src = 'img/' + gearImg(it) + '.png';
  txt.innerHTML = esc(itemName(it)) + (risky ? '<small>성공 확률 25%</small>' : '');
  ov.className = 'on ' + (risky ? 'risky' : 'safe');
  const wait = risky ? 1500 : 350;
  if (risky) { SND.charge(1.4); let k = 0; const tk = setInterval(() => { SND.tick(); if (++k > 8) clearInterval(tk); }, 150); }
  setTimeout(() => {
    ov.classList.add(ok ? 'ok' : 'fail');
    if (ok) { SND.ok(); txt.innerHTML = '<b class="good">+' + (it.en + 1) + ' 강화 성공!</b>'; }
    else { SND.fail(); txt.innerHTML = '<b class="bad">산산조각...</b>'; shake.a = 8; shake.t = .3; }
    done();
    setTimeout(() => { ov.className = ''; enchanting = false; }, ok ? (risky ? 1300 : 700) : 1700);
  }, wait);
}

/* ================= 창 ================= */
let wins = [], winZ = 30;   // 열린 창들 (마지막이 맨 위)
// 창 제목을 잡고 끌어서 옮겨요 (자리는 이 기기에 기억)
let winPos = {}; try { winPos = JSON.parse(localStorage.getItem('rpg-winpos') || '{}'); } catch (e) {}
function placeWin(el) {
  const r = el.getBoundingClientRect();
  let p = winPos[el.id];
  if (!p) {   // 처음 여는 창: 이미 열린 창 옆(왼쪽)에 나란히
    const others = wins.map(n => $('w-' + n)).filter(o => o !== el).map(o => o.getBoundingClientRect());
    let x = innerWidth - r.width - 16, y = r.top;
    while (others.some(o => x < o.right && x + r.width > o.left && Math.abs(o.top - y) < 40)) x -= r.width + 12;
    if (x < 0) { x = innerWidth - r.width - 16 - 30 * others.length; y += 30 * others.length; }
    p = { x, y };
  }
  el.style.right = 'auto';
  el.style.left = clamp(p.x, 0, Math.max(0, innerWidth - r.width)) + 'px';
  el.style.top = clamp(p.y, 0, Math.max(0, innerHeight - 60)) + 'px';
}
document.querySelectorAll('.win').forEach(el => {
  const h = el.querySelector('h3'); if (!h) return;
  h.classList.add('grab');
  h.addEventListener('pointerdown', e => {
    if (e.button || e.target.closest('button')) return;
    const r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
    h.setPointerCapture(e.pointerId); e.preventDefault();
    const mv = ev => { winPos[el.id] = { x: ev.clientX - ox, y: ev.clientY - oy }; placeWin(el); };
    const up = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); try { localStorage.setItem('rpg-winpos', JSON.stringify(winPos)); } catch (e) {} };
    h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
  });
});
function focusWin(w) { const el = $('w-' + w); el.style.zIndex = ++winZ; wins = wins.filter(n => n !== w); wins.push(w); }
function openWin(w) {
  if (wins.includes(w)) { closeWin(w); return; }
  const el = $('w-' + w); el.classList.remove('hidden'); focusWin(w); placeWin(el); SND.ui();
  if (w === 'inv') renderInv(); if (w === 'char') renderChar(); if (w === 'shop') { closeBuy(); renderShop(); } if (w === 'guide') renderGuide(); if (w === 'store') renderStore(); if (w === 'gate') renderGate();
  document.body.classList.add('win-open');
}
// closeWin(): 맨 위 창 닫기 · closeWin('shop'): 그 창 닫기 · closeWin(true): 맨 위 창 조용히 닫기
function closeWin(w, quiet) {
  if (w === true) { quiet = true; w = undefined; }
  if (w === undefined) w = wins[wins.length - 1];
  if (!w || !wins.includes(w)) return;
  $('w-' + w).classList.add('hidden'); wins = wins.filter(n => n !== w);
  if (winNpc && winNpc.w === w) winNpc = null;
  if (!wins.length) document.body.classList.remove('win-open');
  if (w === 'inv') cancelEnchant();
  hideTip(); if (!quiet) SND.ui();
}
function closeAllWins() { while (wins.length) closeWin(true); }

function gearInfo(it) {
  if (it.i) { const d = ITEMS[it.i]; return `<b>${d.name}</b>` + (it.i === 'potion' ? `<br>HP ${d.heal} 회복` : it.i === 'haste' ? '<br>5분 동안 걷기와 공격이 빨라져요' : it.i === 'ret' ? '<br>읽으면 마을로 돌아가요' : it.i === 'tele' ? '<br>지금 사냥터 안 아무 곳으로 순간이동해요' : `<br>${it.i === 'wscroll' ? '무기' : '방어구'}를 한 단계 강화해요`); }
  if (it.g === 'w') {
    const d = WEAPONS[it.k], [a, b] = weaponRange(it);
    return `<b>${itemName(it)}</b><br>${WTYPE[d.type]} · ${d.tier}단계<br>데미지 ${a === b ? a : a + '~' + b} · 한 대 ${d.spd}초` +
      `<br><span class="dim">안전 강화 +${ENCH.w.safe}까지 · 최대 +${ENCH.w.max}</span>`;
  }
  if (it.g === 'c') {
    const c = ACCS[it.k], parts = [c.hp && `최대 HP +${c.hp}`, c.str && `힘 +${c.str}`, c.dex && `민첩 +${c.dex}`, c.con && `체력 +${c.con}`, c.hit && `명중 +${c.hit}%`, c.crit && `치명타 +${c.crit}%`, c.dmg && `데미지 +${c.dmg}`, c.regen && `회복 +${c.regen}`, c.ac && `방어도 ${c.ac}`].filter(Boolean);
    return `<b>${itemName(it)}</b><br>${CLS_NAME[c.cls] ? CLS_NAME[c.cls] + '용 ' : ''}${SLOT_NAME[c.slot]}<br>${parts.join(' · ')}<br><span class="dim">강화할 수 없어요 · 우두머리가 가끔 떨어뜨려요</span>`;
  }
  const d = ARMORS[it.k];
  return `<b>${itemName(it)}</b><br>${SLOT_NAME[d.slot]} · ${d.tier}단계<br>방어도 ${d.ac + it.en}${it.en ? ` (기본 ${d.ac} +${it.en})` : ''}<br><span class="dim">안전 강화 +${ENCH.a.safe}까지 · 최대 +${ENCH.a.max}</span>`;
}
function slotHTML(it, attrs) {
  if (!it) return `<div class="slot empty" ${attrs}></div>`;
  return `<div class="slot ${it.en >= 7 || (it.g === 'a' && it.en >= 5) ? 'hot' : ''}" ${attrs}><img src="img/${gearImg(it)}.png" alt="">` +
    (it.en ? `<i class="en">+${it.en}</i>` : '') + (it.n > 1 ? `<i class="cnt">${it.n}</i>` : '') + `</div>`;
}
function renderInv() {
  $('inv-hint').innerHTML = '<span class="dim">물약·주문서를 아래 1~4 칸으로 끌어다 놓으면 단축키가 돼요</span>';
  $('eq-grid').innerHTML = SLOTS.map(s => `<div class="eqc"><span>${SLOT_NAME[s]}</span>${slotHTML(P.eq[s], `data-eq="${s}"`)}</div>`).join('');
  let h = ''; for (let i = 0; i < INV_MAX; i++) h += slotHTML(P.inv[i], `data-inv="${i}"`);
  $('inv-grid').innerHTML = h;
  $('inv-coins').textContent = P.coins.toLocaleString();
}
function renderChar() {
  const [a, b] = weaponRange(P.eq.weapon), sb = strBonus();
  const row = (k, n, d) => `<div class="st"><span>${n}</span><b>${P[k]}${accBonus(k) ? `<small> +${accBonus(k)}</small>` : ''}</b>${P.pts > 0 ? `<button class="plus" data-st="${k}">+</button>` : ''}<em>${d}</em></div>`;
  $('char-body').innerHTML =
    `${P.name ? `<div class="nmline"><i class="nm" style="color:${nameColor(P.lv)}">${esc(P.name)}</i></div>` : ''}<div class="lvline">Lv ${P.lv} <span>${P.lv >= MAX_LV ? '최고 레벨' : `경험치 ${P.exp.toLocaleString()} / ${needExp(P.lv).toLocaleString()} (${(P.exp / needExp(P.lv) * 100).toFixed(1)}%)`}</span></div>` +
    row('str', '힘', `데미지 ${sb >= 0 ? '+' : ''}${sb}`) + row('dex', '민첩', `명중 +${hitBonus()}% · 치명타 ${critRate()}%`) + row('con', '체력', `최대 HP ${maxHP()}`) +
    (P.pts > 0 ? `<div class="ptsline">보너스 능력치 <b>${P.pts}</b>점을 찍을 수 있어요</div>` : '') +
    `<div class="sum"><div><span>공격</span><b>${a + sb === b + sb ? a + sb : (a + sb) + '~' + (b + sb)}</b></div><div><span>AC</span><b>${playerAC()}</b></div><div><span>HP</span><b>${Math.max(0, Math.ceil(P.hp))}/${maxHP()}</b></div></div>` +
    `<div class="dim small">잡은 몬스터 ${P.kills.toLocaleString()} · 쓰러진 횟수 ${P.deaths}</div>`;
  $('b-char').classList.toggle('alert', P.pts > 0);
}
// 할머니: 물약·주문서, 대장장이: 방어구 (무기는 캐릭터마다 하나라 강화만 해요)
const SHOPS = { shop: { name: '꽃분 할머니 · 잡화', list: [{ i: 'potion' }, { i: 'haste' }, { i: 'ret' }, { i: 'tele' }] },
  smith: { name: '쇠돌 아저씨 · 대장간', list: Object.keys(ARMORS).filter(k => ARMORS[k].price).map(k => ({ g: 'a', k })) } };
let shopWho = 'shop', SHOP_LIST = SHOPS.shop.list;
let shopTab = 'buy';
function priceOf(it) { return it.i ? ITEMS[it.i].price : GDEF(it).price; }
function sellOf(it) {
  if (it.i) return ITEMS[it.i].sell;
  const d = GDEF(it);
  if (it.g === 'c') return d.tier === 1 ? 150 : 400;
  return Math.round((d.tier === 1 ? 12 : 70) * (1 + it.en * .5) * (it.g === 'w' ? 1.5 : 1));
}
function renderShop() {
  SHOP_LIST = SHOPS[shopWho].list; $('shop-name').textContent = SHOPS[shopWho].name;
  $('shop-coins').textContent = P.coins.toLocaleString();
  document.querySelectorAll('#w-shop .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === shopTab));
  if (shopTab === 'buy') {
    $('shop-list').innerHTML = SHOP_LIST.map((it, i) => `<button class="shop-it" data-buy="${i}" ${P.coins < priceOf(it) ? 'disabled' : ''}><img src="img/${gearImg(it)}.png" alt=""><span>${esc(it.i ? ITEMS[it.i].name : GDEF(it).name)}</span><b>${priceOf(it)}</b></button>`).join('');
  } else {
    const list = P.inv.map((it, i) => [it, i]);
    $('shop-list').innerHTML = list.length ? list.map(([it, i]) => `<button class="shop-it" data-sell="${i}"><img src="img/${gearImg(it)}.png" alt=""><span>${esc(itemName(it))}</span><b>${sellOf(it)}${it.n > 1 ? ' /개' : ''}</b></button>`).join('') : '<p class="dim">팔 물건이 없어요</p>';
  }
}
let sellArm = -1, buyIx = -1, buyN = 1;
function buyMax(it) {
  const byCoin = Math.floor(P.coins / priceOf(it));
  const free = INV_MAX - P.inv.length;
  const room = it.i ? (P.inv.some(x => x.i === it.i) || free > 0 ? 999 : 0) : free;
  return Math.max(0, Math.min(byCoin, room, 99));
}
function openBuy(i) { buyIx = i; buyN = 1; $('buyq').classList.remove('hidden'); renderBuy(); }
function closeBuy() { buyIx = -1; $('buyq').classList.add('hidden'); }
function renderBuy() {
  const it = SHOP_LIST[buyIx]; if (!it) return closeBuy();
  const mx = buyMax(it); buyN = clamp(buyN, mx ? 1 : 0, mx);
  const name = it.i ? ITEMS[it.i].name : GDEF(it).name;
  $('bq-img').src = `img/${gearImg(it)}.png`; $('bq-name').textContent = name;
  $('bq-n').textContent = buyN; $('bq-sum').textContent = (buyN * priceOf(it)).toLocaleString();
  $('bq-ok').disabled = buyN < 1; $('bq-msg').textContent = mx ? `최대 ${mx}개` : (P.coins < priceOf(it) ? '엽전이 모자라요' : '가방이 가득 찼어요');
}
function doBuy() {
  const it = SHOP_LIST[buyIx]; if (!it || buyN < 1) return;
  let got = 0;
  if (it.i) { if (giveItem({ i: it.i, n: buyN })) got = buyN; }
  else for (let k = 0; k < buyN; k++) { if (!giveItem({ g: it.g, k: it.k, en: 0 })) break; got++; }
  if (!got) { log('가방이 가득 찼어요', 'warn'); return; }
  P.coins -= got * priceOf(it); SND.coin();
  log(`<b>${esc(it.i ? ITEMS[it.i].name : GDEF(it).name)}</b> ${got}개를 샀어요`, 'item');
  closeBuy(); dirty = true; renderShop(); updateHUD();
}
function renderGuide() {
  const k = window.KPOINT ? KPOINT.info() : null;
  const left = P.hunt;
  $('guide-admin').innerHTML = isAdmin() ? '<span class="dim">관리자 모드 · 사냥 시간 무한</span> <button class="lnk" id="adm-off" type="button">끄기</button>' : '<button class="lnk" id="adm-open" type="button">관리자</button>';
  if (isAdmin()) { $('guide-time').innerHTML = '사냥 시간 <b>무한</b>'; } else
  $('guide-time').innerHTML = left > 0 ? `남은 사냥 시간 <b>${fmtTime(left)}</b>` : `사냥 시간이 없어요 · 1포인트 = 10분` + (k ? ` <span class="dim">(내 포인트 ${k.pts}점)</span>` : '');
  $('guide-list').innerHTML = REGIONS.map(r => `<button class="reg ${r.open ? '' : 'lock'}" data-reg="${r.id}" ${r.open ? '' : 'disabled'}><b>${r.name}</b><span>${!r.open ? '준비 중' : r.lv ? '권장 Lv ' + r.lv : '상점·쉬는 곳'}</span></button>`).join('');
}
function fmtTime(ms) { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function goRegion(id) {
  if (!ZONE[id]) return;
  if (!ZONE[id].town && P.hunt <= 0 && !isAdmin()) {
    if (window.KPOINT && !KPOINT.spend(KPOINT.COST || 1)) { $('guide-time').innerHTML = '<span class="bad">포인트가 모자라요.</span> <span class="dim">+1 포인트 게임을 끝까지 하면 모여요</span>'; return; }
    P.hunt = HUNT_MS; log('1포인트를 써서 사냥 시간 10분을 받았어요', 'sys');
  }
  closeWin('guide', true); SND.warp();
  warpFade(() => { curZone = null; teleport(id); save(true); });
}
function warpFade(fn) { const f = $('fade'); f.classList.add('on'); setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 60); }, 260); }
function goTown(msg) { if (inTown()) return; warpFade(() => { teleport('town'); if (msg) banner(msg, 2); save(true); }); }
// 마을 문: 사냥 시간이 없을 때 1포인트 쓰고 나가기
function renderGate() { const k = window.KPOINT ? KPOINT.info() : null; $('gate-pts').textContent = k ? `내 포인트 ${k.pts}점` : ''; $('gate-msg').innerHTML = ''; }
function payGate() {
  if (window.KPOINT && !KPOINT.spend(KPOINT.COST || 1)) { $('gate-msg').innerHTML = '<span class="bad">포인트가 모자라요.</span> <span class="dim">+1 포인트 게임을 끝까지 하면 모여요</span>'; return; }
  P.hunt = HUNT_MS; dirty = true; log('1포인트를 써서 사냥 시간 10분을 받았어요', 'sys'); SND.coin(); closeWin('gate', true); save(true);
}

/* ================= 화면 정보 ================= */
let dirty = false;
function updateHUD() {
  if (!P) return;
  renderBuffs();
  const mh = maxHP();
  $('hpfill').style.width = clamp(P.hp / mh * 100, 0, 100) + '%';
  $('hptxt').textContent = Math.max(0, Math.ceil(P.hp)) + ' / ' + mh;
  { const sp = $('spfill'), c = P.cls || 'sword'; if (sp.dataset.c !== c) { sp.dataset.c = c; sp.className = c; $('spname').textContent = ({ sword: '용기', bow: '집중', mage: '정신력', tank: '분노' })[c] || '용기'; } $('sptxt').textContent = (P.sp || 0) + ' / ' + (P.spMax || 0); }   // 직업 게이지 (스킬이 생기면 채워져요)
  $('xpfill').style.width = (P.lv >= MAX_LV ? 100 : P.exp / needExp(P.lv) * 100) + '%';
  $('xptxt').textContent = P.lv >= MAX_LV ? '최고 레벨' : (P.exp / needExp(P.lv) * 100).toFixed(1) + '%';
  $('lv').textContent = P.lv;
  $('coins').textContent = shortNum(P.coins); $('coins').parentNode.title = P.coins.toLocaleString() + '냥';
  renderQuick();
  $('acv').textContent = playerAC();

  if (wins.includes('char')) renderChar();
  if (wins.includes('shop')) renderShop();
}

/* ================= 그리기 ================= */
function resize() {
  VW = innerWidth; { const b = document.getElementById('bar'); if (b) document.documentElement.style.setProperty('--barh', b.offsetHeight + 'px'); }
  VH = innerHeight - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock')) || 0);   // 컴퓨터는 아래 정보창만큼 뺀 높이
  // 큰 화면에선 그리는 점 수를 약 220만 개로 제한해요 (모니터가 커도 부드럽게)
  DPR = Math.min(2, window.devicePixelRatio || 1, Math.sqrt(2.2e6 / (VW * VH)));
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  zoom = clamp(Math.min(VW / (CELL * 17), VH / (CELL * 10.2)), .65, 1.6);
}
const PSCALE = 92 / 300 * UK;   // 깨비샘 그림 크기
// 프레임마다 몸 가운데 위치(그림 너비 비율): 검이 한쪽으로 뻗어도 몸이 흔들리지 않게
const PANCHOR = { 'p-walk-0': .486, 'p-walk-1': .488, 'p-walk-2': .485, 'p-walk-3': .481, 'p-walk-4': .483, 'p-walk-5': .478, 'p-idle': .49, 'p-walk1': .534, 'p-walk2': .539, 'p-wind': .64, 'p-swing': .385, 'p-hurt': .515, 'p-dead': .5, 'p-win': .542,
  'a-walk-0': .479, 'a-walk-1': .489, 'a-walk-2': .494, 'a-walk-3': .477, 'a-walk-4': .472, 'a-walk-5': .482, 'a-idle': .49, 'a-walk1': .485, 'a-walk2': .484, 'a-wind': .407, 'a-swing': .451, 'a-hurt': .506, 'a-dead': .442, 'a-win': .493 };
function drawSprite(name, x, y, h, flip, opts = {}) {
  let im = IMG[name]; if (!im) return;
  if (opts.gold) im = gold(name) || im;
  const s = h / im.height * (opts.scale || 1), w = im.width * s, hh = im.height * s;
  g.save(); g.translate(x, y);
  if (opts.rot) g.rotate(opts.rot);
  g.scale((flip ? -1 : 1) * (opts.sx || 1), opts.sy || 1);
  if (opts.alpha != null) g.globalAlpha = opts.alpha;
  g.drawImage(im, -w / 2, -hh, w, hh);
  if (opts.flash > 0) { const wi = white(name); if (wi) { g.globalAlpha = clamp(opts.flash / .08, 0, 1) * .95; g.drawImage(wi, -w / 2, -hh, w, hh); } }
  g.restore();
}
function shadow(x, y, r) { g.fillStyle = 'rgba(20,30,10,.28)'; g.beginPath(); g.ellipse(x, y, r, r * .38, 0, 0, Math.PI * 2); g.fill(); }

// 걷기 6장: 한 걸음 주기 (걸은 거리에 맞춰 넘겨요)
const WALK = ['p-walk-0', 'p-walk-1', 'p-walk-2', 'p-walk-3', 'p-walk-4', 'p-walk-5'];
const AWALK = ['a-walk-0', 'a-walk-1', 'a-walk-2', 'a-walk-3', 'a-walk-4', 'a-walk-5'];
function playerFrame() {
  if (isBow()) {
    if (dead) return 'a-dead';
    if (hurtT > 0 && !atkAnim) return 'a-hurt';
    if (atkAnim) return atkAnim.t < atkAnim.wind ? 'a-wind' : 'a-swing';
    if (player.moving) return AWALK[Math.floor((player.dist || 0) / (CELL * .16)) % 6];
    if (winT > 0) return 'a-win';
    return 'a-idle';
  }
  if (dead) return 'p-dead';
  if (hurtT > 0 && !atkAnim) return 'p-hurt';
  if (atkAnim) return atkAnim.t < atkAnim.wind ? 'p-wind' : 'p-swing';
  if (player.moving) return WALK[Math.floor((player.dist || 0) / (CELL * .16)) % 6];
  if (winT > 0) return 'p-win';
  return 'p-idle';
}
// 캐릭터 아이디: Lv1~9 흰색 → 10~29 점점 파랗게 → 30 완전 파랑, 35·40·45·50에 문장(동·은·금·빛나는 금)
const NAME_BLUE = [47, 107, 255];
function nameColor(lv) {
  if (lv < 10) return '#ffffff';
  const t = Math.min(1, (lv - 9) / 21), a = [215, 236, 255];
  const c = a.map((v, i) => Math.round(v + (NAME_BLUE[i] - v) * t));
  return `rgb(${c.join(',')})`;
}
function emblemTier(lv) { return lv >= 50 ? 4 : lv >= 45 ? 3 : lv >= 40 ? 2 : lv >= 35 ? 1 : 0; }
const EMBLEM_COL = [null, ['#c98a4b', '#7a4a1f'], ['#e4e9f0', '#7c8796'], ['#ffd84a', '#a8740c'], ['#ffe98a', '#c08a10']];
function drawEmblem(tier, x, y, s) {
  const im = IMG['emblem-' + tier];
  if (tier === 4) { g.save(); g.shadowColor = '#ffe27a'; g.shadowBlur = 8 + Math.sin(performance.now() / 300) * 4; }
  if (im) g.drawImage(im, x - s / 2, y - s / 2, s, s);
  else {   // 그림이 오기 전: 작은 방패 모양
    const [f, l] = EMBLEM_COL[tier];
    g.beginPath(); g.moveTo(x - s * .4, y - s * .42); g.lineTo(x + s * .4, y - s * .42); g.lineTo(x + s * .4, y + s * .05); g.quadraticCurveTo(x + s * .3, y + s * .38, x, y + s * .5); g.quadraticCurveTo(x - s * .3, y + s * .38, x - s * .4, y + s * .05); g.closePath();
    g.fillStyle = f; g.fill(); g.lineWidth = 1.6; g.strokeStyle = l; g.stroke();
  }
  if (tier === 4) g.restore();
}
function drawPlayerName(x, y) {
  if (!P.name) return;
  g.font = '13px "Do Hyeon", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const tier = emblemTier(P.lv), tw = g.measureText(P.name).width, es = 16, gap = tier ? es + 3 : 0;
  const tx = x + gap / 2;
  g.lineJoin = 'round'; g.lineWidth = 3.5; g.strokeStyle = 'rgba(15,12,35,.9)'; g.strokeText(P.name, tx, y);
  g.fillStyle = nameColor(P.lv); g.fillText(P.name, tx, y);
  if (tier) drawEmblem(tier, tx - tw / 2 - es / 2 - 3, y - 4.5, es);
}
// 아이디 규칙: 2~8글자, 한글·영어·숫자만, 나쁜 말 막기 (같은 아이디는 다른 학생도 쓸 수 있어요)
const BAD_WORDS = ['시발', '씨발', '씨바', '시바', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '븅신', '개새', '개색', '새끼', '지랄', 'ㅈㄹ', '존나', '졸라', '좆', '니미', '느금', '엠창', '미친', '닥쳐', '꺼져', '섹스', '야동', 'fuck', 'shit', 'bitch', 'sex', 'damn'];
function nameError(n) {
  if (!n) return '아이디를 넣어 주세요';
  if (!/^[가-힣a-zA-Z0-9]+$/.test(n)) return '한글, 영어, 숫자만 쓸 수 있어요';
  if (n.length < 2 || n.length > 8) return '2~8글자로 만들어 주세요';
  const low = n.toLowerCase();
  if (BAD_WORDS.some(w => low.includes(w))) return '쓸 수 없는 말이 들어 있어요';
  return '';
}
function drawPlayer() {
  const x = player.px + (player.ox || 0), y = player.py + (player.oy || 0) + CELL * .32;
  shadow(x, y, 22 * UK);
  const fr = playerFrame(), im = IMG[fr]; if (!im) return;
  const s = PSCALE, w = im.width * s, h = im.height * s, flip = player.face < 0;
  const ax = (PANCHOR[fr] || .5) * w, it = P.eq.weapon;
  g.save(); g.translate(x, y); if (flip) g.scale(-1, 1);
  if (player.moving && !atkAnim && !dead) g.rotate(.03);   // 걸을 때 살짝 앞으로 기울어요
  if (it && it.en >= 7 && !dead) { g.shadowColor = it.en >= 9 ? '#ff6ad5' : '#7fd8ff'; g.shadowBlur = 8 + (it.en - 7) * 4; }   // 높게 강화한 검은 빛나요
  g.drawImage(im, -ax, -h, w, h);
  g.shadowBlur = 0;
  // 휘두르는 잔상
  if (atkAnim && fr === 'p-swing' && atkAnim.t - atkAnim.wind < .1) {
    const a = 1 - (atkAnim.t - atkAnim.wind) / .1;
    g.globalAlpha = a * .7; g.strokeStyle = '#fff'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.arc(2, -h * .45, 52 * UK, -2.1, .9); g.stroke(); g.globalAlpha = 1;
  }
  g.restore();
  if (!dead) drawPlayerName(x, y - 92 * UK - 4);
}
function drawMon(m) {
  const d = m.d; let x = m.px + m.kx + (m.ox || 0), y = m.py + CELL * .32 + m.ky + (m.oy || 0);
  if (m.lunge > 0) x += m.face * 5 * Math.sin((1 - m.lunge / .2) * Math.PI);
  shadow(x, y, d.h * .3);
  const fr = 'm-' + m.type + '-' + ((m.moving ? m.walk : Math.floor(performance.now() / 600 + m.id)) % 2);
  const bob = m.moving ? 0 : Math.sin(performance.now() / 300 + m.id) * 1.5;
  const sq = m.sq;
  const opts = { flash: m.flash, sx: 1 + .14 * sq, sy: 1 - .12 * sq, gold: d.rare };
  if (d.rare && !m.dying) { const t = performance.now() / 400 + m.id; g.save(); g.globalAlpha = .5 + .25 * Math.sin(t); g.fillStyle = '#ffd84a'; g.beginPath(); g.ellipse(x, y, d.h * .55, d.h * .2, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  if (m.dying) { const k = m.dying / .55; opts.rot = m.face * -1.4 * Math.min(1, k * 1.6); opts.alpha = k > .5 ? (Math.floor(k * 14) % 2 ? .25 : .9) : 1; }
  drawSprite(fr, x, y + bob, d.h, m.face < 0, opts);
  if (!m.dying && (m === tgt || m.dmgShow > 0 || d.boss || d.rare) && m.hp < d.hp) {
    const bw = d.boss ? 64 : 34, bx = x - bw / 2, by = y - d.h - 12;
    g.fillStyle = 'rgba(20,14,30,.75)'; g.fillRect(bx - 2, by - 2, bw + 4, 9);
    g.fillStyle = d.boss ? '#ff5d7a' : '#ff6b5b'; g.fillRect(bx, by, bw * Math.max(0, m.hp) / d.hp, 5);
  }
  const qi = tq.indexOf(m);
  if (!m.dying && (m === tgt || d.boss || d.rare || m === hoverMon || qi >= 0)) nameTag(d.name + ' Lv ' + d.lv + (m === tgt && auto ? ' · 자동' : qi >= 0 ? ' · 다음 ' + (qi + 1) : ''), x, y + 24, qi >= 0 ? '#9fd8ff' : d.boss || d.rare ? '#ffcf5a' : m === tgt && auto ? '#ffcf3e' : '#fff');
}
function jobTag(t, x, y) {
  g.font = '12px "Do Hyeon", sans-serif'; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = 'rgba(20,14,40,.85)'; g.strokeText(t, x, y); g.fillStyle = '#fff'; g.fillText(t, x, y);
}
function nameTag(t, x, y, col) {
  g.font = '15px "Do Hyeon", sans-serif'; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = 'rgba(20,14,40,.85)'; g.strokeText(t, x, y); g.fillStyle = col; g.fillText(t, x, y);
}
let hoverMon = null;
// 몬스터 위에 올리면 칼 모양 마우스 (칼끝이 누르는 자리)
const SWORD_CURSOR = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><g stroke='%233a2412' stroke-width='1.6' stroke-linejoin='round' stroke-linecap='round'><path d='M2 2 L7 3 L21 17 L17 21 L3 7 Z' fill='%23eef3f8'/><path d='M5 5 L19 19' stroke='%23b8c4d0' stroke-width='1.2'/><path d='M15 23 L23 15 L25 17 L17 25 Z' fill='%23e0a43a'/><path d='M21 21 L28 28' stroke='%23a0612a' stroke-width='4'/><circle cx='29' cy='29' r='2.2' fill='%23e0a43a'/></g></svg>\") 2 2, crosshair";
function drawNpc(n) {
  if (n.hide) { const p = n.prop; if (p) nameTag(n.name, p.x, p.y - p.h - 6, '#ffe58a'); return; }
  const x = n.px, y = n.py + CELL * .32;
  shadow(x, y, 26 * UK);
  drawSprite(n.img, x, y + Math.sin(performance.now() / 500) * 1.2, n.h, !!n.flip);
  if (n.job) { nameTag(n.name, x, y - n.h - 22, '#ffe58a'); jobTag(n.job, x, y - n.h - 7); }
  else nameTag(n.name, x, y - n.h - 8, '#ffe58a');
}
function drawProp(p) {
  drawSprite(p.name, p.x, p.y, p.h, false, { alpha: p.fade, sx: PROPS[p.name]?.sx });   // sx: 좌우로 날씬하게
}
function drawDrop(d) {
  const x = d.x * CELL + CELL / 2, y = d.y * CELL + CELL / 2 + 8;
  let px = x, py = y;
  if (d.t < .45) { const k = d.t / .45; px = d.fx + (x - d.fx) * k; py = d.fy + (y - d.fy) * k - Math.sin(k * Math.PI) * 40; }
  else if (!d.stay && d.t > FLY_AT(d)) { const k = Math.min(1, (d.t - FLY_AT(d)) / FLY_T), e = k * k; px = x + (player.px - x) * e; py = y + (player.py - 24 - y) * e - Math.sin(k * Math.PI) * 30; }
  const name = d.coin ? (d.coin >= 10 ? 'i-coins' : 'i-coin') : gearImg(d.item);
  const blink = d.life - d.t < 10 && Math.floor(d.t * 6) % 2;
  if (!blink) drawSprite(name, px, py + 6, d.coin ? 22 : 30, false);
}
function drawFx(f) {
  const k = f.t / f.d;
  g.save();
  switch (f.k) {
    case 'dagger': {   // 빠른 베기 선 두 줄
      g.strokeStyle = f.crit ? '#ffe46b' : '#fff'; g.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        const kk = clamp(k * 1.6 - i * .3, 0, 1); if (kk <= 0) continue;
        g.globalAlpha = 1 - kk; g.lineWidth = (f.crit ? 7 : 5) * (1 - kk * .6);
        const L = f.crit ? 46 : 34, a = i ? .7 : -.6;
        g.beginPath(); g.moveTo(f.x - Math.cos(a) * L * kk, f.y - Math.sin(a) * L * kk); g.lineTo(f.x + Math.cos(a) * L * kk, f.y + Math.sin(a) * L * kk); g.stroke();
      }
      break;
    }
    case 'sword': {   // 반달 모양 호
      g.globalAlpha = 1 - k; g.strokeStyle = f.crit ? '#ffe46b' : '#fff'; g.lineWidth = (f.crit ? 12 : 8) * (1 - k * .5); g.lineCap = 'round';
      const r = (f.crit ? 40 : 30) + k * 10;
      g.beginPath(); g.arc(f.x - f.dir * 8, f.y, r, f.dir > 0 ? -1.3 : Math.PI - 1.3 + .3, f.dir > 0 ? 1.0 : Math.PI + 1.0 + .3); g.stroke();
      break;
    }
    case 'club': {   // 둥근 충격파
      g.globalAlpha = 1 - k; g.strokeStyle = f.crit ? '#ffd23e' : '#fff7e0'; g.lineWidth = 7 * (1 - k);
      g.beginPath(); g.ellipse(f.x, f.y + 18, 10 + k * (f.crit ? 70 : 48), (10 + k * (f.crit ? 70 : 48)) * .45, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(255,250,230,' + (.5 * (1 - k)) + ')'; g.beginPath(); g.arc(f.x, f.y, 18 * (1 - k) + 4, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'spark': {
      if (!f.p) f.p = Array.from({ length: f.n }, () => { const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 220; return [Math.cos(a) * v, Math.sin(a) * v - 60]; });
      g.fillStyle = f.col; g.globalAlpha = 1 - k;
      for (const [vx, vy] of f.p) { const t = f.t; g.fillRect(f.x + vx * t - 2, f.y + vy * t + 300 * t * t - 2, 4, 4); }
      break;
    }
    case 'whiff': {
      g.globalAlpha = (1 - k) * .6; g.strokeStyle = '#dfe8ff'; g.lineWidth = 3;
      g.beginPath(); g.arc(f.x, f.y, 24 + k * 10, -1.2, 1.2); g.stroke(); break;
    }
    case 'pillar': {
      const a = k < .1 ? k / .1 : 1 - (k - .1) / .9;
      const gr = g.createLinearGradient(0, f.y - 160, 0, f.y);
      gr.addColorStop(0, 'rgba(255,240,150,0)'); gr.addColorStop(1, 'rgba(255,235,140,' + (.55 * a) + ')');
      g.fillStyle = gr; g.fillRect(f.x - 12 - 6 * Math.sin(f.t * 6), f.y - 160, 24 + 12 * Math.sin(f.t * 6), 160);
      break;
    }
    case 'lvup': {
      g.globalAlpha = 1 - k; g.strokeStyle = '#ffe46b'; g.lineWidth = 5;
      for (let i = 0; i < 3; i++) { const r = 20 + (k * 90 + i * 18); g.beginPath(); g.ellipse(f.x, f.y + 16, r, r * .4, 0, 0, Math.PI * 2); g.stroke(); }
      break;
    }
    case 'heal': {
      g.globalAlpha = 1 - k; g.fillStyle = '#ff8fa0';
      for (let i = 0; i < 6; i++) g.fillRect(f.x - 20 + i * 8, f.y - 20 - k * 60 - (i % 3) * 12, 4, 4);
      break;
    }
  }
  g.restore();
}
const NUMSTYLE = { hit: ['#ffffff', 30], crit: ['#ffd23e', 46], miss: ['#c9c9d6', 20], block: ['#7fd0ff', 24], hurt: ['#ff5d5d', 28], coin: ['#ffe27a', 20], heal: ['#7dff9a', 24] };
function drawNum(n) {
  const [col, size] = NUMSTYLE[n.kind] || NUMSTYLE.hit;
  const pop = n.t < .08 ? 1.6 - n.t / .08 * .6 : 1;
  const y = n.y - (n.kind === 'crit' ? 30 : 40) * Math.min(1, n.t / .7) - (n.t < .15 ? 0 : 0);
  g.save(); g.globalAlpha = n.t > .55 ? 1 - (n.t - .55) / .35 : 1;
  g.translate(n.x, y); g.scale(pop, pop);
  g.font = (n.kind === 'hit' || n.kind === 'crit' || n.kind === 'hurt' ? '700 ' : '') + size + 'px Fredoka, "Do Hyeon", sans-serif';
  g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = size > 30 ? 7 : 5; g.strokeStyle = n.kind === 'crit' ? '#7a2a00' : 'rgba(20,14,40,.9)';
  g.strokeText(n.text, 0, 0); g.fillStyle = col; g.fillText(n.text, 0, 0);
  if (n.kind === 'crit') { g.font = '15px "Do Hyeon", sans-serif'; g.lineWidth = 4; g.strokeText('치명타!', 0, -size * .8); g.fillStyle = '#fff3b0'; g.fillText('치명타!', 0, -size * .8); }
  g.restore();
}

function render() {
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.fillStyle = '#1d2a1a'; g.fillRect(0, 0, VW, VH);
  if (!M) return;
  let sx = 0, sy = 0;
  if (shake.t > 0) { sx = (Math.random() * 2 - 1) * shake.a; sy = (Math.random() * 2 - 1) * shake.a; }
  g.setTransform(DPR * zoom, 0, 0, DPR * zoom, DPR * (VW / 2 - (cam.x + sx) * zoom), DPR * (VH / 2 - (cam.y + sy) * zoom));
  // 땅
  const vx0 = cam.x - VW / 2 / zoom - 20, vx1 = cam.x + VW / 2 / zoom + 20, vy0 = cam.y - VH / 2 / zoom - 20, vy1 = cam.y + VH / 2 / zoom + 20;
  drawGround(vx0, vx1, vy0, vy1);
  // 맵 밖은 어둡게
  g.fillStyle = 'rgba(10,18,8,.55)'; g.fillRect(0, 0, M.w * CELL, CELL * .5); g.fillRect(0, M.h * CELL - CELL * .5, M.w * CELL, CELL * .5);
  // 이동 목표 표시
  if (moveGoal && !tgt) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.beginPath(); g.ellipse(moveGoal[0] * CELL + CELL / 2, moveGoal[1] * CELL + CELL * .8, 14, 6, 0, 0, Math.PI * 2); g.stroke(); }
  for (const d of drops) if (Math.abs(d.x * CELL - cam.x) < VW / zoom) drawDrop(d);
  // 공격 대상 표시
  if (tgt && tgt.kind === 'mon' && !tgt.dying) {
    const x = tgt.px + (tgt.ox || 0), y = tgt.py + (tgt.oy || 0) + CELL * .32, r = tgt.d.h * .34 + 6;
    g.strokeStyle = auto ? '#ffcf3e' : '#ff6b5b'; g.lineWidth = 3; g.setLineDash([8, 6]); g.lineDashOffset = -performance.now() / 40;
    g.beginPath(); g.ellipse(x, y, r, r * .4, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  }
  // 앞뒤 순서대로 (위쪽 먼저)
  const list = [];
  for (const p of M.props) if (p.x + p.w / 2 > vx0 && p.x - p.w / 2 < vx1 && p.y > vy0 && p.y - p.h < vy1) list.push([p.z ?? p.y, p]);
  for (const u of units) if (u.px > vx0 - 120 && u.px < vx1 + 120 && u.py > vy0 - 40 && u.py < vy1 + 200) list.push([u.py + CELL * .32, u]);
  list.sort((a, b) => a[0] - b[0]);
  for (const [, o] of list) {
    if (o.kind === 'prop') drawProp(o);
    else if (o.kind === 'player') drawPlayer();
    else if (o.kind === 'mon') drawMon(o);
    else if (o.kind === 'npc') drawNpc(o);
  }
  for (const s of shots) drawShot(s);
  for (const f of fx) drawFx(f);
  for (const n of nums) drawNum(n);
  // 드래그 중: 몬스터에서 커서까지 줄
  if (pointer.drag && tgt && tgt.kind === 'mon') {
    const [wx, wy] = screenToWorld(pointer.x, pointer.y);
    g.strokeStyle = 'rgba(255,207,62,.8)'; g.lineWidth = 3; g.setLineDash([6, 6]);
    g.beginPath(); g.moveTo(tgt.px, tgt.py - tgt.d.h * .4); g.lineTo(wx, wy); g.stroke(); g.setLineDash([]);
  }
  // 화면 밖 우두머리 화살표
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const boss = units.find(u => u.kind === 'mon' && u.d.boss && !u.dying && u.zone === curZone);
  if (boss) {
    const bx = (boss.px - cam.x) * zoom + VW / 2, by = (boss.py - cam.y) * zoom + VH / 2;
    if (bx < 0 || by < 0 || bx > VW || by > VH - 90) {
      const ang = Math.atan2(by - VH / 2, bx - VW / 2), r = Math.min(VW, VH) * .42;
      const ax = VW / 2 + Math.cos(ang) * r, ay = VH / 2 + Math.sin(ang) * r;
      g.save(); g.translate(ax, ay); g.rotate(ang); g.fillStyle = '#ffcf3e'; g.strokeStyle = '#3a2b33'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(18, 0); g.lineTo(-10, -12); g.lineTo(-4, 0); g.lineTo(-10, 12); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
  }
}

/* ================= 미니맵 ================= */
// 섬 전체를 작은 그림 지도로 한 번 그려 두고(바닥 무늬+건물·나무), 둥근 미니맵에는 내 둘레만 잘라 보여줘요
const MINI_S = 6;   // 그림 지도 한 칸 = 6픽셀
const MINI_R = [12, 18, 28];   // 미니맵 반지름(칸): 크게·보통·작게
let miniBase = null, miniT = 0, miniZ = 1; try { const v = localStorage.getItem('rpg-miniz'); if (v !== null) miniZ = clamp(+v || 0, 0, 2); } catch (e) {}
function buildMini() {
  const S = MINI_S, W = M.w * S, H = M.h * S, f = S / CELL, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), t = document.createElement('canvas'); t.width = W; t.height = H; const tc = t.getContext('2d');
  const fillPat = (ctx, name, fb) => { const pat = M.patterns[name]; if (pat) { ctx.save(); ctx.scale(TS * f * 2.2, TS * f * 2.2); ctx.fillStyle = pat; ctx.fillRect(0, 0, W / (TS * f * 2.2) + 2, H / (TS * f * 2.2) + 2); ctx.restore(); } else { ctx.fillStyle = fb; ctx.fillRect(0, 0, W, H); } };
  fillPat(x, 'tile-sea', '#3a98c2');
  x.imageSmoothingEnabled = tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high';
  for (const l of M.layers) {
    tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, W, H);
    if (l.tile) fillPat(tc, l.tile, '#6a8f3a'); else { tc.fillStyle = l.fill; tc.fillRect(0, 0, W, H); }
    tc.globalCompositeOperation = 'destination-in'; tc.drawImage(l.cv, 0, 0, W, H);
    x.globalAlpha = l.alpha || 1; x.drawImage(t, 0, 0); x.globalAlpha = 1;
  }
  // 바닥 그림(징검다리 등) → 건물·나무 (아래쪽부터)
  const put = p => { const im = IMG[p.name]; if (!im) return; const h = p.h * f * 1.25, w = h * im.width / im.height * (PROPS[p.name]?.sx || 1); x.drawImage(im, p.x * f - w / 2, p.y * f - h, w, h); };
  for (const p of M.flats) { const im = IMG[p.name]; if (im) { const h = p.h * f, w = p.w * f; x.drawImage(im, p.x * f - w / 2, p.y * f - h / 2, w, h); } }
  for (const p of [...M.props].sort((a, b) => a.y - b.y)) put(p);
  // 살짝 어둡게 테두리 (바다 끝)
  const gr = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .62); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,20,50,.35)');
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  miniBase = c; bigBase = null;
}
function miniDots(x, sc, ox, oy, big, meOnly) {   // sc: 칸 → 화면 픽셀, ox/oy: 칸 0,0 의 화면 위치
  const P2 = (cx, cy) => [ox + (cx + .5) * sc, oy + (cy + .5) * sc], r0 = big ? 1.4 : 1;
  if (!meOnly) for (const u of units) {
    if (u.kind === 'mon' && !u.dying) {
      const [px, py] = P2(u.x, u.y);
      if (u.d.boss) { x.fillStyle = '#ff3b3b'; x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.arc(px, py, 6 * r0, 0, 7); x.fill(); x.stroke(); }
      else if (u.d.rare) { x.fillStyle = '#ffd84a'; x.strokeStyle = '#3a2b10'; x.lineWidth = 1.5; x.beginPath(); x.arc(px, py, 4.5 * r0, 0, 7); x.fill(); x.stroke(); }
      else if (!big && cheb(u.x, u.y, player.x, player.y) < 32) { x.fillStyle = '#ff5a4a'; x.strokeStyle = 'rgba(60,0,0,.8)'; x.lineWidth = 1.2; x.beginPath(); x.arc(px, py, 3.2, 0, 7); x.fill(); x.stroke(); }
    } else if (u.kind === 'npc' && !u.hide) {
      const [px, py] = P2(u.x, u.y); x.fillStyle = u.role === 'shop' ? '#7fe0ff' : '#ffd23e'; x.strokeStyle = '#2a1d10'; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(px, py - 6 * r0); x.lineTo(px + 6 * r0, py); x.lineTo(px, py + 6 * r0); x.lineTo(px - 6 * r0, py); x.closePath(); x.fill(); x.stroke();
    }
  }
  // 목적지 원은 그리지 않아요 (내 위치 화살표와 헷갈려서)
  // 나 = 금색 화살표 (걷는 쪽을 가리켜요). 섬 지도에서는 빨간 핀으로 따로
  if (big) return;
  const px = ox + player.px / CELL * sc, py = oy + player.py / CELL * sc, ang = Math.atan2(player.mdy || 0, player.mdx ?? player.face), k = 1.25 * r0;
  x.save(); x.translate(px, py); x.rotate(ang); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 4;
  x.fillStyle = '#ffd23e'; x.strokeStyle = '#4a2c00'; x.lineWidth = 1.6;
  x.beginPath(); x.moveTo(9 * k, 0); x.lineTo(-6 * k, -6.5 * k); x.lineTo(-2.5 * k, 0); x.lineTo(-6 * k, 6.5 * k); x.closePath(); x.fill(); x.stroke(); x.restore();
}
function drawMini(dt) {
  miniT -= dt; if (miniT > 0 || !miniBase) return; miniT = 1 / 20;
  const mc = $('mini'), dpr = Math.min(2, devicePixelRatio || 1), D = Math.round(mc.clientWidth * dpr), Dh = Math.round(mc.clientHeight * dpr); if (!D || !Dh) return;
  if (mc.width !== D || mc.height !== Dh) { mc.width = D; mc.height = Dh; }
  if (D !== Dh) {   // 컴퓨터: 아래 정보창에 꼭 맞는 네모 미니맵 (리니지식)
    const x = mc.getContext('2d'), R = MINI_R[miniZ], sc = Dh / 2 / R, Rx = D / 2 / sc;
    const pcx = player.px / CELL - .5, pcy = player.py / CELL - .5;
    x.fillStyle = '#2b6f96'; x.fillRect(0, 0, D, Dh);
    const s0x = (pcx + .5 - Rx) * MINI_S, s0y = (pcy + .5 - R) * MINI_S, sw = Rx * 2 * MINI_S, sh = R * 2 * MINI_S, k = D / sw;
    const ax = Math.max(0, s0x), ay = Math.max(0, s0y), bx = Math.min(miniBase.width, s0x + sw), by = Math.min(miniBase.height, s0y + sh);
    if (bx > ax && by > ay) x.drawImage(miniBase, ax, ay, bx - ax, by - ay, (ax - s0x) * k, (ay - s0y) * k, (bx - ax) * k, (by - ay) * k);
    miniDots(x, sc, D / 2 - (pcx + .5) * sc, Dh / 2 - (pcy + .5) * sc, false);
    if (!$('bigmap').classList.contains('hidden')) drawBig();
    return;
  }
  const x = mc.getContext('2d'), R = MINI_R[miniZ], ring = D * .05, rad = D / 2 - ring * 2.1, sc = rad / R;   // 동서남북 표시가 잘리지 않게 안쪽으로
  const pcx = player.px / CELL - .5, pcy = player.py / CELL - .5;   // 부드럽게 따라가도록 픽셀 위치 기준
  x.clearRect(0, 0, D, D);
  x.save(); x.beginPath(); x.arc(D / 2, D / 2, rad, 0, 7); x.clip();
  x.fillStyle = '#2b6f96'; x.fillRect(0, 0, D, D);
  const s0x = (pcx + .5 - R) * MINI_S, s0y = (pcy + .5 - R) * MINI_S;
  { // 지도 밖으로 나간 부분은 잘라서 그려요 (사파리는 밖을 가리키면 아예 안 그림)
    const sw = R * 2 * MINI_S, k = rad * 2 / sw, ax = Math.max(0, s0x), ay = Math.max(0, s0y), bx = Math.min(miniBase.width, s0x + sw), by = Math.min(miniBase.height, s0y + sw);
    if (bx > ax && by > ay) x.drawImage(miniBase, ax, ay, bx - ax, by - ay, D / 2 - rad + (ax - s0x) * k, D / 2 - rad + (ay - s0y) * k, (bx - ax) * k, (by - ay) * k); }
  miniDots(x, sc, D / 2 - (pcx + .5) * sc, D / 2 - (pcy + .5) * sc, false);
  // 안쪽 그림자
  const ig = x.createRadialGradient(D / 2, D / 2, rad * .7, D / 2, D / 2, rad); ig.addColorStop(0, 'rgba(0,0,0,0)'); ig.addColorStop(1, 'rgba(0,0,0,.38)');
  x.fillStyle = ig; x.fillRect(0, 0, D, D); x.restore();
  // 금테 + 동서남북 마름모
  const gg = x.createLinearGradient(0, 0, D, D); gg.addColorStop(0, '#fff0b0'); gg.addColorStop(.35, '#d9a83c'); gg.addColorStop(.7, '#8a5a17'); gg.addColorStop(1, '#e8c264');
  x.lineWidth = ring * 1.15; x.strokeStyle = '#2a1a08'; x.beginPath(); x.arc(D / 2, D / 2, rad + ring * .45, 0, 7); x.stroke();
  x.lineWidth = ring * .8; x.strokeStyle = gg; x.beginPath(); x.arc(D / 2, D / 2, rad + ring * .45, 0, 7); x.stroke();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 - Math.PI / 2, cx = D / 2 + Math.cos(a) * (rad + ring * .45), cy = D / 2 + Math.sin(a) * (rad + ring * .45), q = ring * 1.15;
    x.save(); x.translate(cx, cy); x.rotate(a); x.fillStyle = gg; x.strokeStyle = '#2a1a08'; x.lineWidth = ring * .22;
    x.beginPath(); x.moveTo(q * 1.3, 0); x.lineTo(0, -q * .8); x.lineTo(-q * .9, 0); x.lineTo(0, q * .8); x.closePath(); x.fill(); x.stroke(); x.restore();
  }
  if (!$('bigmap').classList.contains('hidden')) drawBig();
}
// 섬 전체 지도: 자세한 그림 대신 단순한 색면 + 굵은 해안선 + 물결 + 산·나무 그림 (애니메이션풍)
let bigBase = null;
const BIG_COL = { town: '#e9cf86', near: '#a9d46f', paddy: '#bcd56a', bamboo: '#7fbf68', deep: '#4f9a5e', marsh: '#86ad95', mtn: '#b8a38c', beach: '#a9d46f' };
function buildBig() {
  const S = 4, W = M.w * S, H = M.h * S, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), R = seeded(5);
  // 칸 단위 그림 (땅 = 지역 색, 물 = 투명) → 크게 늘려 부드럽게
  const sm = document.createElement('canvas'); sm.width = M.w; sm.height = M.h; const sx = sm.getContext('2d'), im = sx.createImageData(M.w, M.h);
  const mk = document.createElement('canvas'); mk.width = M.w; mk.height = M.h; const mx = mk.getContext('2d'), mm = mx.createImageData(M.w, M.h);
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  for (let i = 0; i < M.w * M.h; i++) { if (M.water[i]) continue; const z = ZONES[M.zid[i] - 1], [r, g2, b] = hex(BIG_COL[z?.id] || '#a9d46f'); im.data.set([r, g2, b, 255], i * 4); mm.data.set([0, 0, 0, 255], i * 4); }
  sx.putImageData(im, 0, 0); mx.putImageData(mm, 0, 0);
  const tint = (col, grow) => { const t = document.createElement('canvas'); t.width = W; t.height = H; const tc = t.getContext('2d'); tc.imageSmoothingEnabled = true; tc.filter = `blur(${grow}px)`; tc.drawImage(mk, 0, 0, W, H); tc.filter = 'none';
    const d = tc.getImageData(0, 0, W, H), dd = d.data, [r, g2, b] = hex(col); for (let i = 0; i < dd.length; i += 4) { const a = dd[i + 3] > 40 ? 255 : 0; dd[i] = r; dd[i + 1] = g2; dd[i + 2] = b; dd[i + 3] = a; } tc.putImageData(d, 0, 0); return t; };
  // 바다
  const sg = x.createRadialGradient(W / 2, H / 2, W * .1, W / 2, H / 2, W * .7); sg.addColorStop(0, '#5cc4d8'); sg.addColorStop(1, '#2a7fae'); x.fillStyle = sg; x.fillRect(0, 0, W, H);
  x.save(); x.filter = 'blur(18px)'; x.globalAlpha = .8; x.drawImage(tint('#aef0f0', 10), 0, 0); x.restore();
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2.5; x.lineCap = 'round';
  for (let k = 0; k < 140; k++) { const px = R() * W, py = R() * H, ci = idx(Math.floor(px / S), Math.floor(py / S)); let near = false; for (let d = -6; d <= 6 && !near; d += 3) for (let e = -6; e <= 6 && !near; e += 3) { const xx = Math.floor(px / S) + d, yy = Math.floor(py / S) + e; if (inMap(xx, yy) && !M.water[idx(xx, yy)]) near = true; } if (near || !M.water[ci]) continue;
    x.beginPath(); x.moveTo(px - 14, py); x.quadraticCurveTo(px - 7, py - 7, px, py); x.quadraticCurveTo(px + 7, py - 7, px + 14, py); x.stroke(); }
  // 해안선(진한 갈색) → 모래 → 땅
  x.drawImage(tint('#5a3e25', 3.2), 0, 0); x.drawImage(tint('#f1dfae', 2.2), 0, 0);
  { const t = document.createElement('canvas'); t.width = W; t.height = H; const tc = t.getContext('2d'); tc.imageSmoothingEnabled = true; tc.filter = 'blur(2px)'; tc.drawImage(sm, 0, 0, W, H); tc.filter = 'none'; tc.globalCompositeOperation = 'destination-in'; tc.filter = 'blur(.6px)'; tc.drawImage(tint('#000', 1.2), 0, 0); x.drawImage(t, 0, 0); }
  // 강 (개울 칸을 다시 파랗게)
  for (let i = 0; i < M.w * M.h; i++) if (M.stream[i]) { const cx = i % M.w, cy = (i - cx) / M.w; x.fillStyle = '#5a3e25'; x.beginPath(); x.arc((cx + .5) * S, (cy + .5) * S, S * 1.1, 0, 7); x.fill(); }
  for (let i = 0; i < M.w * M.h; i++) if (M.stream[i]) { const cx = i % M.w, cy = (i - cx) / M.w; x.fillStyle = '#62c6dc'; x.beginPath(); x.arc((cx + .5) * S, (cy + .5) * S, S * .75, 0, 7); x.fill(); }
  // 나무·논두렁·늪
  const items = []; for (let k = 0; k < 9000; k++) { const cx = Math.floor(R() * M.w), cy = Math.floor(R() * M.h), i = idx(cx, cy); if (M.water[i] || M.road[i]) continue; items.push([cx * S + R() * S, cy * S + R() * S, ZONES[M.zid[i] - 1]?.id]); }
  items.sort((a, b) => a[1] - b[1]);
  for (const [px, py, z] of items) {
    if ((z === 'deep' || z === 'bamboo') && R() < .5) { const r = z === 'deep' ? 7 : 5.5; x.fillStyle = z === 'deep' ? '#2c6b45' : '#4f9a55'; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.fillStyle = z === 'deep' ? '#3f8a5a' : '#79c070'; x.beginPath(); x.arc(px - 1.5, py - 2, r * .6, 0, 7); x.fill(); }
    else if (z === 'near' && R() < .05) { x.fillStyle = '#6fa64a'; x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill(); x.fillStyle = '#8cc45d'; x.beginPath(); x.arc(px - 1, py - 1.5, 3, 0, 7); x.fill(); }
    else if (z === 'paddy' && R() < .04) { x.strokeStyle = 'rgba(130,140,50,.55)'; x.lineWidth = 1.5; x.strokeRect(px - 9, py - 6, 18, 12); }
    else if (z === 'marsh' && R() < .06) { x.fillStyle = 'rgba(90,160,170,.75)'; x.beginPath(); x.ellipse(px, py, 9, 4, 0, 0, 7); x.fill(); }
  }
  // 산 (등줄기를 따라 봉우리)
  const peaks = []; for (let y = 0; y < M.h; y += 3) for (let xx = 0; xx < M.w; xx += 3) if (M.mtnCore[idx(xx, y)] && R() < .5) peaks.push([xx * S + R() * 8, y * S + R() * 8]);
  peaks.sort((a, b) => a[1] - b[1]);
  for (const [px, py] of peaks) { const h = 24 + R() * 18, w = h * .9;
    x.fillStyle = '#8c735c'; x.beginPath(); x.moveTo(px - w, py); x.lineTo(px, py - h); x.lineTo(px + w, py); x.closePath(); x.fill();
    x.fillStyle = '#b59c82'; x.beginPath(); x.moveTo(px - w, py); x.lineTo(px, py - h); x.lineTo(px - w * .15, py); x.closePath(); x.fill();
    x.fillStyle = '#f5efe6'; x.beginPath(); x.moveTo(px - w * .28, py - h * .72); x.lineTo(px, py - h); x.lineTo(px + w * .28, py - h * .72); x.lineTo(px + w * .08, py - h * .64); x.closePath(); x.fill();
    x.strokeStyle = '#4a3622'; x.lineWidth = 2; x.beginPath(); x.moveTo(px - w, py); x.lineTo(px, py - h); x.lineTo(px + w, py); x.stroke(); }
  // 길 (점선)
  x.setLineDash([9, 8]); x.strokeStyle = '#8a5a2b'; x.lineWidth = 4; x.lineCap = 'round';
  for (const l of M.roadLines) { x.beginPath(); l.forEach(([a, b], k) => k ? x.lineTo(a * S, b * S) : x.moveTo(a * S, b * S)); x.stroke(); }
  x.setLineDash([]);
  // 마을
  { const [tx, ty] = ZONE.town.spawn, px = tx * S, py = (ty - 3) * S; x.fillStyle = '#fff3c8'; x.strokeStyle = '#5a3e25'; x.lineWidth = 3.5; x.beginPath(); x.arc(px, py, 20, 0, 7); x.fill(); x.stroke();
    x.fillStyle = '#4a3f7a'; x.beginPath(); x.moveTo(px - 15, py + 2); x.lineTo(px, py - 13); x.lineTo(px + 15, py + 2); x.closePath(); x.fill(); x.fillStyle = '#c0563a'; x.fillRect(px - 9, py + 2, 18, 10); }
  bigBase = c;
}
function drawBig() {
  const bc = $('bigcv'), W = Math.round(bc.clientWidth * Math.min(2, devicePixelRatio || 1)); if (!W) return;
  const H = Math.round(W * M.h / M.w); if (bc.width !== W) { bc.width = W; bc.height = H; }
  const art = IMG[WORLD.map]; if (!art && !bigBase) buildBig();
  const x = bc.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(art || bigBase, 0, 0, W, H);
  const sc = W / M.w;
  miniDots(x, sc, 0, 0, true);   // 점을 먼저, 이름 띠를 위에 (글씨가 가려지지 않게)
  // 지역 이름
  x.font = `600 ${Math.round(W / 46)}px "Gowun Dodum",sans-serif`; x.textAlign = 'center'; x.lineWidth = 4; x.lineJoin = 'round';
  for (const z of ZONES) {
    if (z.id === 'beach') continue; const cs = M.zcells[z.id]; if (!cs || !cs.length) continue;
    let sx = 0, sy = 0; for (const i of cs) { sx += i % M.w; sy += Math.floor(i / M.w); }
    let lx = sx / cs.length, ly = sy / cs.length; if (z.at) [lx, ly] = [z.at[0] * M.w, z.at[1] * M.h - 6]; if (z.town) ly -= 10;
    const nm = z.name.replace('도깨비섬 ', ''), fs = Math.round(W / 46), tw = x.measureText(nm).width, bx = lx * sc - tw / 2 - fs * .5, by = ly * sc - fs * 1.05, bw = tw + fs, bh = fs * 1.45;
    x.fillStyle = 'rgba(30,20,40,.72)'; x.beginPath(); x.roundRect(bx, by, bw, bh, bh / 2); x.fill(); x.strokeStyle = 'rgba(232,194,100,.9)'; x.lineWidth = 1.5; x.stroke();
    x.fillStyle = '#fff6d8'; x.fillText(nm, lx * sc, ly * sc);
  }
  // 내 위치: 퍼지는 고리 + 빨간 핀 + '나' (맨 위에)
  { const px = player.px / CELL * sc, py = player.py / CELL * sc, k = W / 900, t = (performance.now() / 1200) % 1;
    x.strokeStyle = `rgba(255,70,60,${1 - t})`; x.lineWidth = 4 * k; x.beginPath(); x.arc(px, py, (10 + 34 * t) * k, 0, 7); x.stroke();
    x.save(); x.translate(px, py); x.scale(k * .62, k * .62); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 6;
    x.fillStyle = '#ff3d3d'; x.strokeStyle = '#fff'; x.lineWidth = 3.5;
    x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(-6, -12, -15, -20, -15, -31); x.arc(0, -31, 15, Math.PI, 0); x.bezierCurveTo(15, -20, 6, -12, 0, 0); x.closePath(); x.fill(); x.stroke();
    x.shadowBlur = 0; x.fillStyle = '#fff'; x.beginPath(); x.arc(0, -31, 6, 0, 7); x.fill(); x.restore(); }
}
function setMiniZ(d) { miniZ = clamp(miniZ + d, 0, MINI_R.length - 1); try { localStorage.setItem('rpg-miniz', miniZ); } catch (e) {} miniT = 0; SND.ui(); }
function toggleBig(on) { const b = $('bigmap'); b.classList.toggle('hidden', on === undefined ? !b.classList.contains('hidden') : !on); miniT = 0; }
function walkToCell(cx, cy) {
  cx = clamp(cx, 1, M.w - 2); cy = clamp(cy, 1, M.h - 2);
  if (blocked(cx, cy)) { let best = null; for (let rr = 1; rr < 6 && !best; rr++) for (let y = cy - rr; y <= cy + rr; y++) for (let x = cx - rr; x <= cx + rr; x++) if (!best && !blocked(x, y)) best = [x, y]; if (!best) return; [cx, cy] = best; }
  tgt = null; auto = false; held = false; pending = 0; moveGoal = [cx, cy]; moveGoalPt = null; player.path = null; SND.ui();
}
// 미니맵을 누르면 그곳으로 걸어가요
function miniClick(e) {
  if (!P || dead || !M) return;
  e.stopPropagation();
  const r = $('mini').getBoundingClientRect(), D = r.width;
  if (Math.abs(r.width - r.height) > 2) { const sc = r.height / 2 / MINI_R[miniZ]; walkToCell(Math.floor(player.px / CELL + (e.clientX - r.left - D / 2) / sc), Math.floor(player.py / CELL + (e.clientY - r.top - r.height / 2) / sc)); return; }
  const rad = D / 2 - D * .05 * 2.1, R = MINI_R[miniZ];
  const dx = e.clientX - r.left - D / 2, dy = e.clientY - r.top - D / 2; if (Math.hypot(dx, dy) > rad) return;
  walkToCell(Math.floor(player.px / CELL + dx / rad * R), Math.floor(player.py / CELL + dy / rad * R));
}
function bigClick(e) { e.stopPropagation(); toggleBig(false); }   // 섬 지도는 보기만 (누르면 닫혀요)

/* ================= 한 프레임 ================= */
let last = performance.now(), saveClock = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let rdt = Math.min(.05, (now - last) / 1000); last = now;
  if (shake.t > 0) { shake.t -= rdt; if (shake.t <= 0) shake.a = 0; }
  if (!M || !P || paused) { render(); return; }
  let dt = rdt;
  if (freeze > 0) { freeze -= rdt; dt = 0; }   // 히트 스톱: 세상이 아주 잠깐 멈춰요
  if (dt > 0) update(dt);
  // 카메라
  cam.x += (player.px - cam.x) * Math.min(1, rdt * 8); cam.y += (player.py - 20 - cam.y) * Math.min(1, rdt * 8);
  const hw = VW / 2 / zoom, hh = VH / 2 / zoom;
  cam.x = M.w * CELL < hw * 2 ? M.w * CELL / 2 : clamp(cam.x, hw, M.w * CELL - hw);
  cam.y = M.h * CELL < hh * 2 ? M.h * CELL / 2 : clamp(cam.y, hh, M.h * CELL - hh + 70 / zoom);
  render();
  if (M && P) drawMini(rdt);
}
// 싸울 때 서로 조금 다가붙어 보이게 (칸은 그대로, 그림만 가까이)
function closeIn(dt) {
  const k = Math.min(1, dt * 10);
  for (const u of units) {
    let o = null;
    if (u === player) { if (tgt && tgt.kind === 'mon' && !tgt.dying && !u.moving && !isBow() && cheb(u.x, u.y, tgt.x, tgt.y) <= 1) o = tgt; }
    // 싸움이 끝나면 그 자리에 그대로 서 있다가, 걷기 시작할 때 거기서부터 걸어가요 (제자리로 휙 돌아가지 않게)
    if (u === player && !o) {
      if (u.moving && (u.ox || u.oy)) {
        // 몬스터 쪽으로 다가붙었던 만큼을 실제 자리로 옮기되, 내 칸 밖(옆 몬스터 칸)으로는 넘어가지 않게 (넘어가면 그 칸에 막혀 못 움직여요)
        u.px = clamp(u.px + u.ox, u.x * CELL + 2, (u.x + 1) * CELL - 2); u.py = clamp(u.py + u.oy, u.y * CELL + 2, (u.y + 1) * CELL - 2); u.ox = u.oy = 0;
      }
      continue;
    }
    else if (u.kind === 'mon' && u.angry && !u.dying && !u.moving && !dead && cheb(u.x, u.y, player.x, player.y) <= 1) o = player;
    const kk = u === player ? .5 : .25, gx = o ? (o.px - u.px) * kk : 0, gy = o ? (o.py - u.py) * kk : 0;   // 서로 다가가서 거의 붙어서 때려요
    u.ox = (u.ox || 0) + (gx - (u.ox || 0)) * k; u.oy = (u.oy || 0) + (gy - (u.oy || 0)) * k;
  }
}
function update(dt) {
  updateMusic(dt);
  if (player) closeIn(dt);
  // 이동 보간
  for (const u of units) {
    if (u.mv) {
      u.mv.t += dt; const k = Math.min(1, u.mv.t / u.mv.dur);
      const tx = u.x * CELL + CELL / 2, ty = u.y * CELL + CELL / 2;
      u.px = u.mv.fx + (tx - u.mv.fx) * k; u.py = u.mv.fy + (ty - u.mv.fy) * k;
      if (k >= 1) { u.mv = null; if (u === player) { pickupAt(u.x, u.y); idleT = 0; } }
    }
    if (u.kind === 'mon') {
      u.flash = Math.max(0, u.flash - dt); u.kx *= Math.pow(.0005, dt); u.ky *= Math.pow(.0005, dt); u.sq = Math.max(0, u.sq - dt / .15);
      if (u.lunge > 0) u.lunge -= dt; u.dmgShow -= dt;
      if (u.dying) { u.dying += dt; if (u.dying > .55) removeUnit(u); }
      else { monThink(u, dt); glideUpdate(u, dt); }
    }
  }
  // 플레이어
  atkCD -= dt; hurtT -= dt; winT -= dt;
  if (atkAnim) {
    atkAnim.t += dt;
    if (!atkAnim.hit && atkAnim.t >= atkAnim.wind) { atkAnim.hit = true; const m = atkAnim.m; if (!m.dying && units.includes(m) && cheb(player.x, player.y, m.x, m.y) <= reach() + 1) { if (atkAnim.type === 'bow') shoot(m); else doHit(m, atkAnim.type); } }
    if (atkAnim && atkAnim.type === 'bow' && atkAnim.t > atkAnim.wind + .22) atkAnim = null;
    if (atkAnim.t > atkAnim.wind + .16) atkAnim = null;
  }
  glideUpdate(player, dt);
  playerThink(dt);
  // 회복: 가만히 있으면 더 빨리
  idleT += dt; regenT += dt;
  if (regenT >= 2 && !dead) { regenT = 0; const mh = maxHP(); if (P.hp < mh) { P.hp = Math.min(mh, P.hp + regenAmt() * (idleT > 3 && !atkAnim ? 3 : 1)); updateHUD(); } }
  if (atkAnim || player.moving) idleT = 0;
  // 효과
  updateShots(dt);
  for (const f of fx) f.t += dt; fx = fx.filter(f => f.t < f.d);
  for (const n of nums) n.t += dt; nums = nums.filter(n => n.t < .9);
  for (const d of drops) d.t += dt; drops = drops.filter(d => d.t < d.life); autoLoot();
  // 마우스 아래 몬스터
  { const [wx, wy] = screenToWorld(pointer.x, pointer.y); hoverMon = unitAt(wx, wy, ['mon']); }
  // 캐릭터를 가리는 장식은 반투명하게
  for (const p of M.props) {
    if (Math.abs(p.x - player.px) > 400 && p.fade === 1) continue;
    const cover = p.y > player.py + CELL * .32 && Math.abs(p.x - player.px) < p.w * .42 && player.py + CELL * .32 > p.y - p.h * .95 && player.py < p.y;
    p.fade += ((cover ? .5 : 1) - p.fade) * Math.min(1, dt * 10);
  }
  // 초록 물약 시간
  if (P.haste > 0 && !dead) {
    P.haste -= dt * 1000;
    if (P.haste <= 0) { P.haste = 0; log('초록 물약 효과가 끝났어요', 'sys'); renderBuffs(); }
    hasteShow -= dt; if (hasteShow <= 0) { hasteShow = .5; updateHaste(); }
  }
  player.step = hasted() ? .36 * HASTE : .36;
  checkNpcWin();
  // 사냥 시간·우두머리
  if (!dead) setZone(zoneAt(player.x, player.y));
  const Z = curZone;
  if (!Z.town && !dead) {
    if (isAdmin()) P.hunt = Math.max(P.hunt, HUNT_MS);
    else P.hunt -= dt * 1000;
    if (P.hunt <= 0) { P.hunt = 0; tgt = null; auto = false; goTown('사냥 시간이 끝났어요<small>마을 순간이동 문에서 다시 사냥할 수 있어요</small>'); }
    if (Z.boss && !Z.bossAlive) {
      Z.bossTimer -= dt;
      if (Z.bossTimer <= 0) { const b = spawnMonster(Z, Z.boss); if (b) { Z.bossAlive = true; b.angry = false; SND.boss(); banner(`${josa(b.d.name, '이가')} 나타났어요!`, 2.2); log(`<b>${josa(b.d.name, '이가')}</b> 나타났어요! 화살표를 따라가 보세요`, 'boss'); } else Z.bossTimer = 10; }
    }
    $('htime').textContent = isAdmin() ? '무한' : fmtTime(P.hunt);
    $('htime').classList.toggle('low', P.hunt < 60000);
  }
  saveClock += dt;
  if (saveClock > 5) { saveClock = 0; if (dirty || !curZone.town) { dirty = false; save(); } }
}
let paused = false;

/* ================= 시작 ================= */
let createPts = 5, cStats = { str: 10, dex: 10, con: 10 }, cCls = 'sword';
let nameSlot = -1;
function openSelect() { $('select').classList.remove('hidden'); renderSelect(); }
function renderSelect() {
  const all = loadAll(), out = [];
  for (let i = 0; i < MAX_CHARS; i++) {
    const c = all.chars[i];
    if (c) { const bow = c.cls === 'bow'; out.push(`<div class="cslotw"><button class="cslot" data-slot="${i}" type="button"><img src="img/${bow ? 'a' : 'p'}-idle.png" alt=""><b>${c.name ? `<i class="nm" style="color:${nameColor(c.lv)}">${esc(c.name)}</i>` : (bow ? '깨순이' : '깨비샘')}</b><span>${bow ? '깨순이' : '깨비샘'} · Lv ${c.lv}</span></button><button class="sdel" data-del="${i}" type="button">지우기</button></div>`); }
    else if (i === all.chars.length) out.push(`<div class="cslotw"><button class="cslot empty" data-new type="button"><i>+</i><b>새 캐릭터</b></button></div>`);
    else out.push(`<div class="cslotw"><div class="cslot none"></div></div>`);
  }
  $('sel-list').innerHTML = out.join('');
}
function renderCreate() {
  $('c-left').textContent = createPts;
  for (const k of ['str', 'dex', 'con']) $('c-' + k).textContent = cStats[k];
  const err = nameError($('c-name').value.trim());
  $('c-name-msg').textContent = $('c-name').value ? err : '';
  $('c-go').disabled = createPts > 0 || !!err;
}
// 예전 저장: 다른 무기는 엽전으로 바꾸고, 낀 무기 강화 단계는 깨비샘의 검으로 옮겨요
function migrateWeapons() {
  const w = P.eq.weapon;
  const want = isBow() ? 'bow1' : 'sword1';
  if (!w || w.k !== want) P.eq.weapon = { g: 'w', k: want, en: w ? w.en : 0 };
  let c = 0; P.inv = P.inv.filter(it => { if (it.g === 'w') { c += sellOf(it); return false; } return true; });
  if (c) { P.coins += c; log(`이제 ${HERO()}는 자기 무기만 써요. 가방의 다른 무기는 엽전 ${c}냥으로 바꿨어요`, 'sys'); }
  if (WEAPONS[P.eq.weapon.k].two && P.eq.shield) { P.inv.push(P.eq.shield); P.eq.shield = null; log('활은 양손 무기라 방패를 가방에 넣었어요', 'sys'); }
}
function startGame() {
  loadStore();
  migrateWeapons();
  $('title').classList.add('hidden'); $('create').classList.add('hidden'); $('select').classList.add('hidden');
  document.body.classList.add('playing');
  $('hud').classList.remove('hidden');
  enterWorld();
  updateHUD();
  log('깨비샘의 도깨비 대모험에 온 걸 환영해요!', 'sys');
  if (P.hunt > 0) log(`남은 사냥 시간 ${fmtTime(P.hunt)} · 마을 순간이동 문을 눌러 사냥터로 가요`, 'sys');
}

function bindUI() {
  cv.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(() => document.documentElement.style.setProperty('--barh', $('bar').offsetHeight + 'px')).observe($('bar'));
  addEventListener('keydown', e => {
    if (!P || !document.body.classList.contains('playing')) return;
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= '4') {
      e.preventDefault();
      // 가방이 열려 있고 아이템 위에 마우스가 있으면 그 아이템을 그 번호에 넣어요
      const hov = wins.includes('inv') && document.querySelector('#inv-grid .slot:hover');
      const it = hov && P.inv[+hov.dataset.inv];
      if (it && it.i) setQuick(+k - 1, it.i); else useQuick(+k - 1);
    }
    else if (k === 'i' || k === 'ㅑ') openWin('inv');
    else if (k === 'c' || k === 'ㅊ') openWin('char');
    else if (k === 'm' || k === 'ㅡ') toggleBig();
    else if (k === 'escape') { if (!$('bigmap').classList.contains('hidden')) toggleBig(false); else if (enchantPick) cancelEnchant(); else closeWin(); }
  });
  addEventListener('pagehide', () => save(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); else checkCloud(); });   // 다시 보면 다른 기기 기록부터 확인
  $('sync-go').addEventListener('click', () => location.reload());
  document.querySelectorAll('.bbtn.qs').forEach(b => b.addEventListener('click', () => { if (qDrag.done) return; useQuick(+b.dataset.k); }));
  // 단축키 끌어다 놓기: 가방 아이템 → 1~4 칸에 넣기, 칸 → 다른 칸으로 옮기기, 칸 → 바깥(맵)에 놓으면 빼기
  const qGhost = $('qghost');
  const qsAt = (x, y) => { const el = document.elementFromPoint(x, y); const b = el && el.closest('.bbtn.qs'); return b ? +b.dataset.k : -1; };
  const qStart = (e, id, from) => { if (e.button) return; qDrag.id = id; qDrag.from = from; qDrag.x = e.clientX; qDrag.y = e.clientY; qDrag.on = false; qDrag.done = false; };
  $('inv-grid').addEventListener('pointerdown', e => { const s = e.target.closest('.slot'); const it = s && P.inv[+s.dataset.inv]; if (it && QUSE.includes(it.i)) qStart(e, it.i, -1); });
  document.querySelectorAll('.bbtn.qs').forEach(b => b.addEventListener('pointerdown', e => { const id = qkeys()[+b.dataset.k]; if (id) qStart(e, id, +b.dataset.k); }));
  addEventListener('pointermove', e => {
    if (!qDrag.id) return;
    if (!qDrag.on && Math.hypot(e.clientX - qDrag.x, e.clientY - qDrag.y) > 8) { qDrag.on = true; qGhost.src = `img/${ITEMS[qDrag.id].img}.png`; qGhost.classList.remove('hidden'); document.body.classList.add('qdrag'); hideTip(); }
    if (qDrag.on) { qGhost.style.left = e.clientX + 'px'; qGhost.style.top = e.clientY + 'px'; const k = qsAt(e.clientX, e.clientY); document.querySelectorAll('.bbtn.qs').forEach(b => b.classList.toggle('over', +b.dataset.k === k)); }
  });
  addEventListener('pointerup', e => {
    if (!qDrag.id) return;
    if (qDrag.on) {
      const k = qsAt(e.clientX, e.clientY), ks = qkeys();
      if (k >= 0) { if (k !== qDrag.from) setQuick(k, qDrag.id); }
      else if (qDrag.from >= 0) { ks[qDrag.from] = null; dirty = true; SND.ui(); log(`단축키 ${qDrag.from + 1}을 비웠어요`, 'sys'); renderQuick(); }
      qDrag.done = true; setTimeout(() => { qDrag.done = false; }, 50);
      qGhost.classList.add('hidden'); document.body.classList.remove('qdrag'); document.querySelectorAll('.bbtn.qs.over').forEach(b => b.classList.remove('over'));
    }
    qDrag.id = null; qDrag.on = false;
  }, true);
  $('buyq').addEventListener('click', e => {
    const b = e.target.closest('[data-q]'); if (b) { const q = b.dataset.q; buyN = q === 'max' ? 999 : buyN + (+q); SND.ui(); renderBuy(); return; }
    if (e.target.id === 'bq-ok') doBuy(); if (e.target.id === 'bq-no') closeBuy();
  });

  $('b-switch').addEventListener('click', () => { save(true); $('b-switch').disabled = true; setTimeout(() => location.reload(), 700); });
  $('w-guide').addEventListener('click', e => {
    if (e.target.id === 'adm-open') { $('adm-row').classList.remove('hidden'); $('adm-code').value = ''; $('adm-msg').textContent = ''; $('adm-code').focus(); }
    if (e.target.id === 'adm-off') { try { localStorage.removeItem('rpg-admin'); } catch (er) {} P.hunt = 0; log('관리자 모드를 껐어요', 'sys'); renderGuide(); }
  });
  const admGo = async () => {
    const code = $('adm-code').value.trim(); if (!code) return;
    $('adm-msg').textContent = '확인하는 중...';
    let ok = false; try { ok = window.RPG_CLOUD && await RPG_CLOUD.admin(code); } catch (er) { ok = false; }
    if (!ok) { $('adm-msg').textContent = '코드가 맞지 않아요'; return; }
    try { localStorage.setItem('rpg-admin', '1'); } catch (er) {}
    $('adm-row').classList.add('hidden'); log('관리자 모드: 포인트 없이 사냥할 수 있어요', 'sys'); SND.coin(); renderGuide();
  };
  $('adm-go').addEventListener('click', admGo);
  $('adm-code').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') admGo(); });
  $('b-inv').addEventListener('click', () => openWin('inv'));
  $('b-char').addEventListener('click', () => openWin('char'));

  $('mini').addEventListener('pointerdown', miniClick);
  $('bigcv').addEventListener('pointerdown', bigClick);
  $('bigmap').addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target.id === 'bigmap') toggleBig(false); });
  $('m-in').addEventListener('click', e => { e.stopPropagation(); setMiniZ(-1); });
  $('m-out').addEventListener('click', e => { e.stopPropagation(); setMiniZ(1); });
  $('m-big').addEventListener('click', e => { e.stopPropagation(); toggleBig(); });
  $('bm-x').addEventListener('click', e => { e.stopPropagation(); toggleBig(false); });
  ['m-in', 'm-out', 'm-big', 'bm-x'].forEach(id => $(id).addEventListener('pointerdown', e => e.stopPropagation()));
  $('gate-pay').addEventListener('click', payGate);
  // 휴대폰: 배경음악을 끄면 다른 앱(유튜브 등) 소리와 섞여서 나게 (아이폰은 이때 무음 모드면 효과음도 안 나요)
  const audioMode = () => { try { if (navigator.audioSession) navigator.audioSession.type = (KBGM.on && KBGM.vol > 0) ? 'auto' : 'ambient'; } catch (e) {} };
  $('b-snd').addEventListener('click', e => { e.stopPropagation(); SND.on = !SND.on; $('b-snd').classList.toggle('off', !SND.on); if (SND.on) SND.unlock(); SND.ui(); });
  ['pointerdown', 'touchstart'].forEach(t => $('b-snd').addEventListener(t, e => e.stopPropagation()));
  document.addEventListener('visibilitychange', () => { if (document.hidden) SND.sleep(); });
  $('b-snd').classList.toggle('off', !SND.on);
  KBGM.button({ after: $('b-snd'), icon: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>음악' });
  document.querySelectorAll('.kbgm-btn').forEach(b => b.addEventListener('click', () => setTimeout(audioMode, 0))); audioMode();
  document.querySelectorAll('.win .x').forEach(b => b.addEventListener('click', () => closeWin(b.closest('.win').id.slice(2))));
document.querySelectorAll('.win').forEach(el => el.addEventListener('pointerdown', () => { const n = el.id.slice(2); if (wins.includes(n) && wins[wins.length - 1] !== n) focusWin(n); }, true));
  // 가방
  const tip = $('tip');
  function showTip(el, html) { tip.innerHTML = html; tip.classList.remove('hidden'); const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    if (r.left - tw - 8 >= 6) { tip.style.left = (r.left - tw - 8) + 'px'; tip.style.top = clamp(r.top, 6, innerHeight - th - 6) + 'px'; }   // 칸 왼쪽에
    else { tip.style.left = clamp(r.left + r.width / 2 - tw / 2, 6, innerWidth - tw - 6) + 'px'; tip.style.top = (r.top - th - 8 >= 6 ? r.top - th - 8 : Math.min(innerHeight - th - 6, r.bottom + 8)) + 'px'; } }   // 자리가 없으면 칸 위에
  window.hideTip = () => tip.classList.add('hidden');
  ['eq-grid', 'inv-grid'].forEach(id => {
    const box = $(id);
    box.addEventListener('mouseover', e => { const s = e.target.closest('.slot'); if (!s) return; const it = s.dataset.eq ? P.eq[s.dataset.eq] : P.inv[+s.dataset.inv]; if (it) showTip(s, gearInfo(it)); else hideTip(); });
    box.addEventListener('mouseleave', hideTip);
    box.addEventListener('click', e => {
      const s = e.target.closest('.slot'); if (!s || enchanting) return;
      if (enchantPick) { enchantTarget(s.dataset.eq ? { eq: s.dataset.eq } : { inv: +s.dataset.inv }); hideTip(); return; }
      if (qDrag.done) return;
      if (s.dataset.eq) unequip(s.dataset.eq); else if (wins.includes('store')) toStore(+s.dataset.inv); else useItem(+s.dataset.inv);
      hideTip();
    });
  });
  // 창고
  $('store-grid').addEventListener('click', e => { const s = e.target.closest('.slot'); if (!s || sDrag.done) return; fromStore(+s.dataset.st); hideTip(); });
  $('store-grid').addEventListener('mouseover', e => { const s = e.target.closest('.slot'); const it = s && STORE.items[+s.dataset.st]; if (it) showTip(s, gearInfo(it)); else hideTip(); });
  $('store-grid').addEventListener('mouseleave', hideTip);
  // 휴대폰: 칸을 꾹 누르면(0.45초) 아이템 설명이 떠요. 손을 떼도 잠깐 남고, 그때의 '누름'은 사용으로 치지 않아요
  let lpT = 0, lpX = 0, lpY = 0, lpEat = false, lpHide = 0;
  const longTip = (box, sel, info) => {
    box.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return; const s = e.target.closest(sel); if (!s) return;
      clearTimeout(lpT); lpX = e.clientX; lpY = e.clientY; lpEat = false;
      lpT = setTimeout(() => { const h = info(s); if (!h) return; showTip(s, h); lpEat = true; clearTimeout(lpHide); lpHide = setTimeout(hideTip, 3000); }, 450);
    });
    box.addEventListener('pointermove', e => { if (Math.hypot(e.clientX - lpX, e.clientY - lpY) > 10) clearTimeout(lpT); });
    ['pointerup', 'pointercancel'].forEach(t => box.addEventListener(t, () => clearTimeout(lpT)));
    box.addEventListener('click', e => { if (lpEat) { lpEat = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    box.addEventListener('contextmenu', e => e.preventDefault());
  };
  longTip($('eq-grid'), '.slot', s => { const it = P.eq[s.dataset.eq]; return it && gearInfo(it); });
  longTip($('inv-grid'), '.slot', s => { const it = P.inv[+s.dataset.inv]; return it && gearInfo(it); });
  longTip($('store-grid'), '.slot', s => { const it = STORE.items[+s.dataset.st]; return it && gearInfo(it); });
  longTip($('bar'), '.bbtn.qs', s => { const id = qkeys()[+s.dataset.k]; return id && ITEMS[id] && gearInfo({ i: id, n: 1 }); });
  $('store-in').addEventListener('click', () => storeCoins(1));
  $('store-out').addEventListener('click', () => storeCoins(-1));
  // 가방 ↔ 창고 끌어서 옮기기
  const sGhost = $('qghost');
  const sStart = (e, from, ix, it) => { if (e.button || !it) return; Object.assign(sDrag, { from, ix, x: e.clientX, y: e.clientY, on: false, it }); };
  $('store-grid').addEventListener('pointerdown', e => { const s = e.target.closest('.slot'); if (s) sStart(e, 'store', +s.dataset.st, STORE.items[+s.dataset.st]); });
  $('inv-grid').addEventListener('pointerdown', e => { const s = e.target.closest('.slot'); if (s && wins.includes('store')) sStart(e, 'inv', +s.dataset.inv, P.inv[+s.dataset.inv]); });
  window.addEventListener('pointermove', e => {
    if (!sDrag.from) return;
    if (!sDrag.on && Math.hypot(e.clientX - sDrag.x, e.clientY - sDrag.y) > 8) { sDrag.on = true; sGhost.src = `img/${gearImg(sDrag.it)}.png`; sGhost.classList.remove('hidden'); hideTip(); }
    if (sDrag.on) { sGhost.style.left = e.clientX + 'px'; sGhost.style.top = e.clientY + 'px'; }
  }, true);
  window.addEventListener('pointerup', e => {
    if (!sDrag.from) return;
    if (sDrag.on) {
      sGhost.classList.add('hidden');
      const over = document.elementFromPoint(e.clientX, e.clientY);
      if (sDrag.from === 'inv' && over && over.closest('#w-store')) toStore(sDrag.ix);
      else if (sDrag.from === 'store' && over && over.closest('#w-inv')) fromStore(sDrag.ix);
      sDrag.done = true; setTimeout(() => { sDrag.done = false; }, 50);
    }
    sDrag.from = null; sDrag.on = false;
  }, true);
  // 능력치
  $('char-body').addEventListener('click', e => {
    const b = e.target.closest('.plus'); if (!b || P.pts <= 0) return;
    const before = maxHP(); P[b.dataset.st]++; P.pts--; if (b.dataset.st === 'con') P.hp += maxHP() - before;
    SND.ui(); dirty = true; renderChar(); updateHUD();
  });
  // 상점
  document.querySelectorAll('#w-shop .tab').forEach(b => b.addEventListener('click', () => { shopTab = b.dataset.tab; sellArm = -1; renderShop(); }));
  $('shop-list').addEventListener('click', e => {
    const b = e.target.closest('.shop-it'); if (!b) return;
    if (b.dataset.buy != null) {
      openBuy(+b.dataset.buy); return;
    } else {
      const i = +b.dataset.sell, it = P.inv[i]; if (!it) return;
      if (it.g && it.en >= 1 && sellArm !== i) { sellArm = i; b.querySelector('b').textContent = '한 번 더'; return; }
      sellArm = -1;
      P.coins += sellOf(it); SND.coin();
      if (it.i && it.n > 1) it.n--; else P.inv.splice(i, 1);
    }
    dirty = true; renderShop(); updateHUD();
  });
  // 길 안내
  $('guide-list').addEventListener('click', e => { const b = e.target.closest('.reg'); if (b && !b.disabled) goRegion(b.dataset.reg); });
  // 시작 화면
  $('t-new').addEventListener('click', () => { SND.unlock(); $('title').classList.add('hidden'); openSelect(); });
  $('s-back').addEventListener('click', () => { $('select').classList.add('hidden'); $('title').classList.remove('hidden'); });
  let delArm = -1, delWho = '';
  // 캐릭터 지우기: 아이디를 똑같이 써야 지워져요
  $('db-name').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('db-ok').click(); });
  $('db-name').addEventListener('input', () => { $('db-ok').disabled = $('db-name').value.trim() !== delWho; });
  $('db-no').addEventListener('click', () => { delArm = -1; $('delbox').classList.add('hidden'); });
  $('db-ok').addEventListener('click', () => {
    if (delArm < 0 || $('db-name').value.trim() !== delWho) return;
    const all = loadAll(), c = all.chars[delArm]; if (!c || (c.name || (c.cls === 'bow' ? '깨순이' : '깨비샘')) !== delWho) return;
    all.chars.splice(delArm, 1); all.t = Date.now(); delArm = -1;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(all)); } catch (er) {}
    if (window.RPG_CLOUD && cloudCode()) cloudPut(cloudCode(), JSON.stringify(all), all.t).catch(() => {});
    $('delbox').classList.add('hidden'); SND.ui(); renderSelect();
  });
  $('sel-list').addEventListener('click', e => {
    const del = e.target.closest('[data-del]');
    if (del) {
      const i = +del.dataset.del, c = loadAll().chars[i]; if (!c) return;
      delArm = i; delWho = c.name || (c.cls === 'bow' ? '깨순이' : '깨비샘');
      $('db-who').textContent = delWho; $('db-name').value = ''; $('db-name').placeholder = delWho; $('db-ok').disabled = true;
      $('delbox').classList.remove('hidden'); $('db-name').focus(); SND.ui(); return;
    }
    const b = e.target.closest('.cslot'); if (!b) return;
    if (b.dataset.new != null) { $('select').classList.add('hidden'); $('create').classList.remove('hidden'); createPts = 5; cStats = { str: 10, dex: 10, con: 10 }; $('c-name').value = ''; renderCreate(); return; }
    const all = loadAll(), si = +b.dataset.slot; if (!all.chars[si]) return;
    if (!all.chars[si].name) { nameSlot = si; $('nb-name').value = ''; $('nb-msg').textContent = ''; $('namebox').classList.remove('hidden'); $('nb-name').focus(); return; }
    slot = si; P = all.chars[slot];
    if (P.hp <= 0) P.hp = maxHP(); startGame();
  });
  $('create').addEventListener('click', e => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    const [k, d] = b.dataset.c.split(':');
    if (d === '+' && createPts > 0) { cStats[k]++; createPts--; }
    if (d === '-' && cStats[k] > 10) { cStats[k]--; createPts++; }
    SND.ui(); renderCreate();
  });
  $('c-back').addEventListener('click', () => { $('create').classList.add('hidden'); openSelect(); });
  $('c-name').addEventListener('input', renderCreate);
  $('c-name').addEventListener('keydown', e => e.stopPropagation());
  $('nb-name').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('nb-ok').click(); });
  $('nb-name').addEventListener('input', () => { $('nb-msg').textContent = nameError($('nb-name').value.trim()); });
  $('nb-ok').addEventListener('click', () => {
    const nm = $('nb-name').value.trim(), err = nameError(nm); if (err) { $('nb-msg').textContent = err; return; }
    const all = loadAll(); if (!all.chars[nameSlot]) return;
    all.chars[nameSlot].name = nm; all.t = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(all)); } catch (er) {}
    $('namebox').classList.add('hidden'); slot = nameSlot; P = all.chars[slot]; if (P.hp <= 0) P.hp = maxHP(); startGame(); save(true);
  });
  $('nb-no').addEventListener('click', () => $('namebox').classList.add('hidden'));
  $('c-cls').addEventListener('click', e => { const b = e.target.closest('.cls'); if (!b) return; cCls = b.dataset.cls; document.querySelectorAll('.cls').forEach(x => x.classList.toggle('on', x === b)); SND.ui(); });
  $('c-go').addEventListener('click', () => { const all = loadAll(); if (all.chars.length >= MAX_CHARS) return; slot = all.chars.length; const nm = $('c-name').value.trim(); if (nameError(nm)) return; P = newChar(cStats.str, cStats.dex, cStats.con, cCls, nm); P.hp = maxHP(); save(true); SND.unlock(); startGame(); });
  bindCode();
}

/* ================= 이어하기 코드 (6글자, 다른 기기에서 불러오기) ================= */
const CODE_ABC = '0123456789ABCDEFGHJKMNPQRSTUVWXYZ';
function bindCode() {
  const msg = (t, err) => { $('code-msg').textContent = t || ''; $('code-msg').classList.toggle('bad', !!err); };
  const fmt = c => c.slice(0, 3) + ' ' + c.slice(3);
  let arm = null;
  $('t-code').addEventListener('click', async () => {
    $('codebox').classList.remove('hidden'); msg(''); $('code-input').value = ''; arm = null; $('code-load').textContent = '불러오기';
    let c = cloudCode();
    if (c) { $('code-show').textContent = fmt(c); return; }
    const local = loadAll();
    if (!local.chars.length) { $('code-show').textContent = '------'; msg('캐릭터를 만들면 코드가 생겨요'); return; }
    $('code-show').textContent = '만드는 중...';
    try {
      for (let i = 0; i < 5 && !c; i++) { let t = ''; for (let j = 0; j < 6; j++) t += CODE_ABC[1 + Math.floor(Math.random() * (CODE_ABC.length - 1))]; if (!(await window.RPG_CLOUD.get(t))) c = t; }
      if (!c) throw new Error('no code');
      await cloudPut(c, JSON.stringify(local), local.t || Date.now());
      try { localStorage.setItem('rpg-save-code', c); } catch (e) {}
      $('code-show').textContent = fmt(c);
    } catch (e) { console.warn(e); $('code-show').textContent = '------'; msg('코드를 만들지 못했어요. 인터넷 연결을 확인해 주세요.', true); }
  });
  $('code-close').addEventListener('click', () => $('codebox').classList.add('hidden'));
  $('code-input').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('code-load').click(); });
  $('code-load').addEventListener('click', async () => {
    const t = $('code-input').value.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
    if (t.length !== 6) { msg('6글자 코드를 넣어 주세요', true); return; }
    if (t === cloudCode()) { msg('이 기기의 코드예요'); return; }
    let d = null; msg('찾는 중...');
    try { d = await window.RPG_CLOUD.get(t); } catch (e) { msg('불러오지 못했어요. 인터넷 연결을 확인해 주세요.', true); return; }
    let data = null; try { data = d && JSON.parse(d.s); } catch (e) {}
    const dall = data && normAll(data);
    if (!dall || !dall.chars.length) { msg('코드가 맞지 않아요', true); return; }
    if (arm !== t) { arm = t; $('code-load').textContent = '한 번 더 누르면 불러와요'; msg(`캐릭터 ${dall.chars.length}명 (${dall.chars.map(c => 'Lv ' + c.lv).join(', ')})이에요. 이 기기의 캐릭터가 바뀌어요.`); return; }
    try { localStorage.setItem(SAVE_KEY, d.s); localStorage.setItem('rpg-save-code', t); } catch (e) {}
    cloudT = +d.t || 0;
    msg('불러왔어요!'); $('code-show').textContent = fmt(t);
  });
}
async function pullCloud() {   // 다른 기기에서 더 나중에 저장한 게 있으면 받아 와요
  const c = cloudCode(); if (!c || !window.RPG_CLOUD) return;
  try {
    const d = await window.RPG_CLOUD.get(c); const local = loadAll();
    if (d && !stale) cloudT = +d.t || 0;
    if (d && d.s && (!local.chars.length || (+d.t || 0) > (local.t || 0))) { localStorage.setItem(SAVE_KEY, d.s); if (!$('select').classList.contains('hidden')) renderSelect(); }
  } catch (e) { console.warn('저장 받아 오기 실패', e); }
}

/* ================= 처음 ================= */
resize();
bindUI();
loadImages().then(() => { document.body.classList.add('ready'); });
setTimeout(pullCloud, 600);
requestAnimationFrame(frame);
window.__rpg = { screenPos() { return [(player.px - cam.x) * zoom + VW / 2, (player.py - cam.y) * zoom + VH / 2]; }, get P() { return P; }, get M() { return M; }, get units() { return units; }, get player() { return player; }, get zone() { return curZone; }, enterWorld, teleport, talk, warpTo, goRegion, spawnMonster, gainExp, giveItem, rollAttack, playerAttacker, playerAC, set tgt(v) { tgt = v; }, set auto(v) { auto = v; } };
