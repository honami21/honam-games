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
const IMG_LIST = ['p-idle', 'p-walk1', 'p-walk2', 'p-wind', 'p-swing', 'p-hurt', 'p-dead', 'p-win', 'npc-shop', 'npc-guide',
  ...Object.keys(MONS).flatMap(k => ['m-' + k + '-0', 'm-' + k + '-1']),
  ...Object.keys(WEAPONS).map(k => 'w-' + k), ...Object.keys(ARMORS).map(k => 'a-' + k),
  'i-potion', 'i-wscroll', 'i-ascroll', 'i-coin', 'i-coins', 'i-box', ...Object.keys(PROPS)];
function loadImages() {
  const jobs = IMG_LIST.map(n => new Promise(res => { const im = new Image(); im.onload = () => { IMG[n] = im; res(); }; im.onerror = res; im.src = 'img/' + n + '.png?v=1'; }));
  ['tile-town', 'tile-field', 'tile-bamboo'].forEach(n => jobs.push(new Promise(res => { const im = new Image(); im.onload = () => { IMG[n] = im; res(); }; im.onerror = res; im.src = 'img/' + n + '.jpg?v=1'; })));
  return Promise.all(jobs);
}
function white(n) {   // 맞았을 때 하얗게 번쩍이는 그림
  if (WHITE[n]) return WHITE[n];
  const im = IMG[n]; if (!im) return null;
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  return (WHITE[n] = c);
}
const gearImg = it => it.g === 'w' ? 'w-' + it.k : it.g === 'a' ? 'a-' + it.k : ITEMS[it.i].img;

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
    const c = ctx(); if (!c || !on) return; const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, .005, vol, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
  }
  function noise(dur, vol, type, f0, f1, q = 1, delay = 0) {
    const c = ctx(); if (!c || !on) return; const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = noiseBuf; const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); env(g, t, .004, vol, dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random() * .5); s.stop(t + dur + .02);
  }
  return {
    get on() { return on; }, set on(v) { on = v; try { localStorage.setItem('rpg-sfx', v ? 'on' : 'off'); } catch (e) {} },
    unlock() { ctx(); },
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
function newChar(str, dex, con) {
  return { v: 1, lv: 1, exp: 0, hp: 30, str, dex, con, pts: 0, coins: 50, hunt: 0,
    inv: [{ i: 'potion', n: 5 }], eq: { weapon: { g: 'w', k: 'sword1', en: 0 }, armor: { g: 'a', k: 'armor1', en: 0 } },
    kills: 0, deaths: 0, t: Date.now() };
}
function loadSave() { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return d && d.v === 1 ? d : null; } catch (e) { return null; } }
let saveT = 0, cloudAt = 0;
function save(now) {
  if (!P) return; P.t = Date.now();
  const s = JSON.stringify(P);
  try { localStorage.setItem(SAVE_KEY, s); } catch (e) {}
  // 인터넷 저장은 아껴서: 마을로 올 때·창을 닫을 때(now)나 2분에 한 번만
  if (window.RPG_CLOUD && cloudCode() && (now || Date.now() - cloudAt > 120000)) {
    cloudAt = Date.now(); clearTimeout(saveT);
    saveT = setTimeout(() => window.RPG_CLOUD.put(cloudCode(), { s: JSON.stringify(P), t: P.t }).catch(e => console.warn('저장 올리기 실패', e)), 300);
  }
}
function cloudCode() { try { return localStorage.getItem('rpg-save-code') || ''; } catch (e) { return ''; } }

/* ================= 능력치 계산 ================= */
const W_OF = () => P.eq.weapon ? WEAPONS[P.eq.weapon.k] : null;
function maxHP() { return 30 + (P.lv - 1) * 8 + (P.con - 10) * (P.lv + 2); }
function playerAC() {
  let ac = 10;
  for (const s of SLOTS) { const it = P.eq[s]; if (it && it.g === 'a') ac -= ARMORS[it.k].ac + it.en; }
  return ac - Math.floor((P.dex - 10) / 3);
}
const strBonus = () => Math.floor((P.str - 10) / 2);
const hitBonus = () => (P.dex - 10) * 2;
const critRate = () => 5 + Math.floor((P.dex - 10) / 2);
function weaponRange(it) {   // 무기 데미지 범위 (힘 보너스 제외)
  if (!it) return [1, 2];
  const base = WEAPONS[it.k].dmg + it.en;
  return [base, base + (it.en >= 7 ? 2 * (it.en - 6) : 0)];
}
function regenAmt() { return 1 + Math.floor(P.lv / 5) + Math.max(0, Math.floor((P.con - 10) / 2)); }

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

/* ================= 월드 (한 장으로 이어진 넓은 세계) ================= */
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
function zoneAt(x) { for (const z of ZONES) if (x < z.x1) return z; return ZONES[ZONES.length - 1]; }
const inTown = () => zoneAt(player.x).town;

function placeProp(name, cx, cy, force) {   // cx,cy = 밑동 가운데 칸
  const d = PROPS[name]; if (!d) return false;
  const x0 = cx - Math.floor(d.fw / 2), y0 = cy - d.fh + 1;
  if (!force) {
    for (let y = y0 - 1; y <= cy + 1; y++) for (let x = x0 - 1; x <= x0 + d.fw; x++) {
      if (!inMap(x, y)) return false;
      if (M.block[idx(x, y)] || M.keep[idx(x, y)]) return false;
    }
  }
  for (let y = y0; y <= cy; y++) for (let x = x0; x < x0 + d.fw; x++) if (inMap(x, y)) M.block[idx(x, y)] = 1;
  const im = IMG[name]; const h = im ? d.w * im.height / im.width : d.w;
  M.props.push({ kind: 'prop', name, x: (x0 + d.fw / 2) * CELL, y: (cy + 1) * CELL - 6, w: d.w, h, fade: 1 });
  return true;
}
function keepClear(x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inMap(x, y)) M.keep[idx(x, y)] = 1; }

const TALL = { town: ['f-tree1', 'f-tree2'], field: ['f-tree1', 'f-tree2'], bamboo: ['b-bamboo1', 'b-bamboo2'] };
const DECO = {
  town: [['f-tree2', 8], ['f-bush', 10], ['f-flowers', 14], ['f-rocks', 4]],
  field: [['f-tree1', 13], ['f-tree2', 18], ['f-bush', 18], ['f-rock1', 9], ['f-rocks', 12], ['f-hay', 8], ['f-flowers', 22]],
  bamboo: [['b-bamboo1', 22], ['b-bamboo2', 22], ['b-rock', 9], ['b-fallen', 8], ['b-tower', 7], ['b-sasa', 18], ['b-pond', 4], ['b-lantern', 6]],
};
function buildWorld() {
  const W = WORLD.w, H = WORLD.h;
  M = { w: W, h: H, block: new Uint8Array(W * H), occ: new Int32Array(W * H), keep: new Uint8Array(W * H), props: [], npcs: [] };
  const R = seeded(17);
  for (let x = 0; x < W; x++) { M.block[idx(x, 0)] = M.block[idx(x, H - 1)] = 1; }
  for (let y = 0; y < H; y++) { M.block[idx(0, y)] = M.block[idx(W - 1, y)] = 1; }
  // 리스폰 지점과 마을 문 앞 길은 비워 둬요
  for (const z of ZONES) keepClear(z.spawn[0] - 4, z.spawn[1] - 4, z.spawn[0] + 4, z.spawn[1] + 4);
  keepClear(28, 27, 46, 33);
  // 마을: 집·가게·우물, 동쪽 울타리와 문(장승)
  const T = ZONE.town;
  placeProp('t-stall', 10, 29, 1); placeProp('t-jars', 6, 31, 1); placeProp('t-well', 23, 36, 1);
  for (const [n, x, y] of [['t-house2', 8, 21], ['t-house1', 17, 20], ['t-house2', 27, 21], ['t-house1', 8, 42], ['t-house2', 18, 43], ['t-house1', 27, 42], ['t-house1', 5, 13], ['t-house2', 25, 13], ['t-house1', 12, 51], ['t-house2', 25, 51]]) placeProp(n, x, y, 1);
  for (let y = 2; y < H - 1; y += 2) if (y < 26 || y > 34) placeProp('t-fence', 35, y, 1);
  placeProp('t-jangseung', 35, 25, 1); placeProp('t-jangseung', 35, 35, 1);
  placeProp('t-portal', T.spawn[0] + 3, T.spawn[1] - 2, 1);
  M.npcs.push({ kind: 'npc', role: 'shop', name: '상점 할머니', img: 'npc-shop', x: 10, y: 31, h: 92 });
  // 지역마다 가장자리 숲 + 장식 (경계 근처는 옆 지역 장식과 섞여요)
  for (const z of ZONES) {
    const tall = TALL[z.id];
    for (let x = z.x0 + 1; x < z.x1; x += 2) { placeProp(tall[(x >> 1) % 2], x, 1, 1); placeProp(tall[((x >> 1) % 2) ^ 1], x, H - 2, 1); }
    const area = (z.x1 - z.x0) * H, scale = area / (64 * 48);
    const prev = ZONES[ZONES.indexOf(z) - 1];
    for (const [n, c] of DECO[z.id]) for (let i = 0, tries = 0; i < Math.round(c * scale) && tries < 600; tries++) {
      let x = z.x0 + 2 + Math.floor(R() * (z.x1 - z.x0 - 3)), y = 3 + Math.floor(R() * (H - 6)), name = n;
      if (prev && x - z.x0 < 7 && R() < .5) { const pd = DECO[prev.id]; name = pd[Math.floor(R() * pd.length)][0]; }
      if (placeProp(name, x, y)) i++;
    }
    if (!z.town) {
      M.npcs.push({ kind: 'npc', role: 'guide', name: '길 안내 부엉이 도사', img: 'npc-guide', x: z.spawn[0] + 1, y: z.spawn[1] - 1, h: 96 });
      z.bossTimer = BOSS_FIRST; z.bossAlive = false;
    }
  }
  M.npcs.push({ kind: 'npc', role: 'guide', name: '길 안내 부엉이 도사', img: 'npc-guide', x: T.spawn[0] + 2, y: T.spawn[1] + 1, h: 96 });
  // 동쪽 끝: 아직 안 연 지역으로 가는 길은 막혀 있어요
  for (let y = 3; y < H - 2; y += 2) placeProp('b-bamboo1', W - 2, y, 1);
  placeProp('f-sign', W - 5, 30, 1);
  M.patterns = {}; for (const z of ZONES) if (IMG[z.tile]) M.patterns[z.id] = g.createPattern(IMG[z.tile], 'repeat');
  buildMini();
}

function addUnit(u) { u.id = ++uid; u.px = u.x * CELL + CELL / 2; u.py = u.y * CELL + CELL / 2; u.face = 1; M.occ[idx(u.x, u.y)] = u.id; units.push(u); return u; }
function removeUnit(u) { if (M.occ[idx(u.x, u.y)] === u.id) M.occ[idx(u.x, u.y)] = 0; units = units.filter(v => v !== u); }
function findFree(cx, cy, maxR = 8) {
  for (let r = 0; r <= maxR; r++) for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++)
    if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) === r && free(x, y)) return [x, y];
  return null;
}

let curZone = null;
function enterWorld() {
  units = []; drops = []; fx = []; nums = [];
  buildWorld();
  const [ex, ey] = findFree(...ZONE.town.spawn);
  player = addUnit({ kind: 'player', x: ex, y: ey, step: .26 });
  for (const n of M.npcs) addUnit(Object.assign(n, { step: 1 }));
  for (const z of ZONES) if (!z.town) for (let i = 0; i < z.count; i++) spawnMonster(z);
  cam.x = player.px; cam.y = player.py;
  resetControl(); setZone(zoneAt(player.x), true);
}
function resetControl() { tgt = null; moveGoal = null; held = false; auto = false; pending = 0; player.path = null; }
// 지역(리스폰 지점)으로 순간 이동
function teleport(id) {
  const z = ZONE[id], spot = findFree(...z.spawn); if (!spot) return;
  M.occ[idx(player.x, player.y)] = 0;
  player.x = spot[0]; player.y = spot[1]; player.mv = null;
  player.px = player.x * CELL + CELL / 2; player.py = player.y * CELL + CELL / 2;
  M.occ[idx(player.x, player.y)] = player.id;
  cam.x = player.px; cam.y = player.py;
  resetControl(); setZone(z);
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
  const list = z.mons, tot = list.reduce((t, m) => t + m[3], 0);
  let r = Math.random() * tot; for (const m of list) { r -= m[3]; if (r < 0) return m; } return list[0];
}
function spawnMonster(z, type) {
  if (typeof z === 'string') { type = z; z = ZONES.find(q => q.mons && q.mons.some(m => m[0] === type) || q.boss === type) || zoneAt(player.x); }
  const m = type ? [type, type === z.boss ? .55 : 0, 1] : pickMonType(z);
  const span = z.x1 - z.x0 - 10;
  for (let tries = 0; tries < 80; tries++) {
    const k = m[1] + Math.random() * (m[2] - m[1]);
    const x = clamp(Math.round(z.x0 + 5 + k * span + rnd(-3, 3)), z.x0 + 2, z.x1 - 3), y = rnd(3, M.h - 4);
    if (!free(x, y)) continue;
    if (cheb(x, y, z.spawn[0], z.spawn[1]) < 6) continue;
    if (player && cheb(x, y, player.x, player.y) < 9) continue;
    const d = MONS[m[0]];
    return addUnit({ kind: 'mon', type: m[0], d, zone: z, x, y, hp: d.hp, step: d.step, home: [x, y], atkT: 0, wander: Math.random() * 3, flash: 0, kx: 0, ky: 0, sq: 0, dmgShow: 0 });
  }
  return null;
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
  if (u === player ? !gateOK(nx) : (u.kind === 'mon' && zoneAt(nx).town)) return false;
  M.occ[idx(u.x, u.y)] = 0; M.occ[idx(nx, ny)] = u.id;
  u.mv = { fx: u.px, fy: u.py, t: 0, dur: u.step * (dx && dy ? 1.3 : 1) };
  u.x = nx; u.y = ny; if (dx) u.face = dx > 0 ? 1 : -1; u.walk = (u.walk || 0) + 1;
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
  if (!p.path || !p.path.length || p.pathGoal !== tx + ',' + ty) { p.path = findPath(p.x, p.y, tx, ty, false, p.id, 14000); p.pathGoal = tx + ',' + ty; if (!p.path || !p.path.length) return false; }
  const [nx, ny] = p.path[0];
  if (stepTo(p, nx, ny)) { p.path.shift(); return true; }
  p.path = null;   // 길이 막혔으면 다음에 다시 찾아요
  return stepToward(p, tx, ty, false);
}
// 마을 문: 사냥 시간이 없으면 1포인트를 써야 나갈 수 있어요
let gateAsked = 0;
function gateOK(nx) {
  if (!zoneAt(player.x).town || zoneAt(nx).town || P.hunt > 0) return true;
  if (performance.now() - gateAsked > 800) { gateAsked = performance.now(); openWin('gate'); }
  moveGoal = null; player.path = null;
  return false;
}

/* ================= 플레이어 조작 ================= */
let tgt = null, moveGoal = null, held = false, auto = false, pending = 0, pointer = { x: 0, y: 0, down: false, onMon: null, drag: false };
let atkCD = 0, atkAnim = null, hurtT = 0, winT = 0, idleT = 0, regenT = 0, dead = false;

function screenToWorld(sx, sy) { return [(sx - VW / 2) / zoom + cam.x, (sy - VH / 2) / zoom + cam.y]; }
function unitAt(wx, wy, kinds) {
  let best = null;
  for (const u of units) {
    if (!kinds.includes(u.kind) || u.dying) continue;
    const h = u.kind === 'mon' ? u.d.h : u.h || 88, w = h * .8;
    if (wx > u.px - w / 2 && wx < u.px + w / 2 && wy > u.py + CELL * .3 - h && wy < u.py + CELL * .35) if (!best || u.py > best.py) best = u;
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
  if (m) { tgt = m; moveGoal = null; held = true; auto = false; pending = 1; pointer.onMon = m; pointer.drag = true; return; }
  // 땅: 그쪽으로 걸어가기 (누르고 있으면 계속 따라감)
  tgt = null; auto = false; held = false; pending = 0; pointer.onMon = null;
  setGoal(wx, wy);
}
function setGoal(wx, wy) {
  const cx = clamp(Math.floor(wx / CELL), 0, M.w - 1), cy = clamp(Math.floor(wy / CELL), 0, M.h - 1);
  moveGoal = [cx, cy];
}
function onMove(e) {
  pointer.x = e.clientX; pointer.y = e.clientY;
  if (!M) return;
  if (pointer.drag) { $('bar').classList.toggle('drop', overBar(e.clientX, e.clientY)); return; }
  if (pointer.down && !tgt) { const [wx, wy] = screenToWorld(e.clientX, e.clientY); setGoal(wx, wy); }
  const [wx, wy] = screenToWorld(e.clientX, e.clientY);
  const hov = unitAt(wx, wy, ['mon', 'npc']);
  cv.style.cursor = hov ? (hov.kind === 'mon' ? 'crosshair' : 'pointer') : 'default';
}
function overBar(x, y) { const r = $('bar').getBoundingClientRect(); return y >= r.top - 6 && x >= r.left && x <= r.right; }
function onUp(e) {
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
  if (npc.role === 'shop') openWin('shop'); else openWin('guide');
}

function playerThink() {
  if (dead) return;
  if (tgt && (tgt.dead || tgt.dying || !units.includes(tgt))) { tgt = null; auto = false; held = false; pending = 0; }
  if (tgt && tgt.kind === 'npc') {
    if (cheb(player.x, player.y, tgt.x, tgt.y) <= 1) { faceTo(player, tgt); const n = tgt; talk(n); return; }
    if (!player.mv) stepToward(player, tgt.x, tgt.y, true);
    return;
  }
  if (tgt) {
    const want = held || auto || pending > 0;
    if (!want) { tgt = null; return; }
    if (cheb(player.x, player.y, tgt.x, tgt.y) <= 1) {
      if (!player.mv) { faceTo(player, tgt); if (atkCD <= 0 && !atkAnim) startAttack(tgt); }
    } else if (!player.mv) {
      if (!stepToward(player, tgt.x, tgt.y, true)) { /* 막혀 있으면 잠깐 기다려요 */ }
    }
    return;
  }
  if (moveGoal && !player.mv) {
    if (player.x === moveGoal[0] && player.y === moveGoal[1]) { if (!pointer.down) moveGoal = null; return; }
    if (!walkTo(moveGoal[0], moveGoal[1])) { if (!pointer.down) moveGoal = null; }
  }
}
function faceTo(u, t) { if (t.x !== u.x) u.face = t.x > u.x ? 1 : -1; }

// 공격: 휘두르기 준비 → 때리는 순간 판정 → 마무리
function startAttack(m) {
  const w = W_OF(); const spd = w ? w.spd : .7;
  atkCD = spd; atkAnim = { t: 0, hit: false, m, type: w ? w.type : 'sword', wind: Math.min(.09, spd * .25) };
  if (pending > 0) pending--;
}
function doHit(m, type) {
  const r = rollAttack(playerAttacker(), { ac: m.d.ac, lv: m.d.lv });
  const mx = m.px, my = m.py - m.d.h * .45;
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
  if (m.d.boss) { z.bossAlive = false; z.bossTimer = BOSS_AGAIN; banner(`${josa(m.d.name, '을를')} 물리쳤어요!`); }
  else { const w = M; setTimeout(() => { if (M === w && units.filter(u => u.kind === 'mon' && u.zone === z && !u.d.boss && !u.dying).length < z.count) spawnMonster(z); }, 8000 + Math.random() * 6000); }
}
function dropLoot(m) {
  const dr = m.zone.drop, bag = [];
  const c = m.d.boss ? rnd(dr.coin[0] * 20, dr.coin[1] * 20) : (Math.random() < .7 ? rnd(dr.coin[0], dr.coin[1]) : 0);
  if (c) bag.push({ coin: c });
  const tier = m.zone.tier;
  const gearOf = () => { const pool = [...Object.keys(WEAPONS).filter(k => WEAPONS[k].tier === tier).map(k => ({ g: 'w', k })), ...Object.keys(ARMORS).filter(k => ARMORS[k].tier === tier).map(k => ({ g: 'a', k }))]; const it = pool[rnd(0, pool.length - 1)]; return { item: { g: it.g, k: it.k, en: 0 }, rare: 1 }; };
  if (m.d.boss) {
    bag.push(gearOf());
    const n = rnd(3, 5); for (let i = 0; i < n; i++) bag.push({ item: { i: Math.random() < 1 / 3 ? 'wscroll' : 'ascroll', n: 1 }, rare: 1 });
  } else {
    if (Math.random() < dr.w) bag.push({ item: { i: 'wscroll', n: 1 }, rare: 1 });
    if (Math.random() < dr.a) bag.push({ item: { i: 'ascroll', n: 1 }, rare: 1 });
    if (Math.random() < dr.gear) bag.push(gearOf());
    if (Math.random() < .03) bag.push({ item: { i: 'potion', n: 1 } });
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
function pickupAt(x, y) {
  for (const d of drops.slice()) {
    if (d.x !== x || d.y !== y || d.t < .45) continue;
    if (d.coin) { P.coins += d.coin; SND.coin(); addNum(player.px, player.py - 70, '+' + d.coin + ' 엽전', 'coin'); }
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
  if (!dead && !curZone.town && (m.angry || (d.aggro && dist <= 4))) {
    m.angry = true;
    if (cheb(m.x, m.y, m.home[0], m.home[1]) > 14 && dist > 3) { m.angry = false; }
    else if (dist <= 1) {
      if (!m.mv && m.atkT <= 0) { faceTo(m, player); monAttack(m); m.atkT = d.boss ? 1.5 : 1.3; }
      return;
    } else if (!m.mv && m.atkT <= .4) { stepToward(m, player.x, player.y, true); return; }
    return;
  }
  m.wander -= dt;
  if (!m.mv && cheb(m.x, m.y, m.home[0], m.home[1]) > 5) { if (m.wander <= 0) { m.wander = .3; stepToward(m, m.home[0], m.home[1], false); } return; }
  if (m.wander <= 0 && !m.mv) {
    m.wander = 1.5 + Math.random() * 3.5;
    const [dx, dy] = DIRS[rnd(0, 7)];
    const nx = m.x + dx, ny = m.y + dy;
    if (cheb(nx, ny, m.home[0], m.home[1]) <= 5) stepTo(m, nx, ny);
  }
}
function monAttack(m) {
  m.lunge = .2;
  setTimeout(() => {
    if (dead || m.dying || !units.includes(m) || cheb(m.x, m.y, player.x, player.y) > 1) return;
    const r = rollAttack({ lv: m.d.lv, dmg: m.d.dmg, crit: 0 }, { ac: playerAC(), lv: P.lv });
    const px = player.px, py = player.py - 60;
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
  while (box.children.length > 6) box.firstChild.remove();
  setTimeout(() => d.classList.add('old'), 7000);
}

/* ================= 가방·장비 ================= */
const INV_MAX = 30;
function itemName(it) {
  if (it.i) return ITEMS[it.i].name + (it.n > 1 ? ' ' + it.n + '개' : '');
  const d = it.g === 'w' ? WEAPONS[it.k] : ARMORS[it.k];
  return (it.en ? '+' + it.en + ' ' : '') + d.name;
}
function giveItem(it) {
  if (it.i) { const s = P.inv.find(x => x.i === it.i); if (s) { s.n += it.n || 1; return true; } }
  if (P.inv.length >= INV_MAX) return false;
  P.inv.push(it.i ? { i: it.i, n: it.n || 1 } : { g: it.g, k: it.k, en: it.en || 0 });
  if (winOpen === 'inv') renderInv();
  return true;
}
function useItem(ix) {
  const it = P.inv[ix]; if (!it) return;
  if (it.i === 'potion') return drinkPotion();
  if (it.i === 'wscroll' || it.i === 'ascroll') { startEnchantPick(it.i); return; }
  if (it.g) equip(ix);
}
function equip(ix) {
  const it = P.inv[ix]; if (!it || !it.g) return;
  const slot = it.g === 'w' ? 'weapon' : ARMORS[it.k].slot;
  if (slot === 'shield' && P.eq.weapon && WEAPONS[P.eq.weapon.k].two) { log('방망이는 양손 무기라 방패를 들 수 없어요', 'warn'); return; }
  P.inv.splice(ix, 1);
  if (it.g === 'w' && WEAPONS[it.k].two && P.eq.shield) { P.inv.push(P.eq.shield); P.eq.shield = null; log('양손 방망이를 들어서 방패를 가방에 넣었어요', 'sys'); }
  if (P.eq[slot]) P.inv.push(P.eq[slot]);
  P.eq[slot] = it; SND.ui();
  dirty = true; renderInv(); updateHUD();
}
function unequip(slot) {
  if (!P.eq[slot]) return;
  if (P.inv.length >= INV_MAX) { log('가방이 가득 찼어요', 'warn'); return; }
  P.inv.push(P.eq[slot]); P.eq[slot] = null; SND.ui(); dirty = true; renderInv(); updateHUD();
}
function drinkPotion() {
  const s = P.inv.find(x => x.i === 'potion');
  if (!s || dead) { log('물약이 없어요', 'warn'); return; }
  if (P.hp >= maxHP()) return;
  s.n--; if (s.n <= 0) P.inv.splice(P.inv.indexOf(s), 1);
  P.hp = Math.min(maxHP(), P.hp + ITEMS.potion.heal);
  SND.potion(); addNum(player.px, player.py - 70, '+' + ITEMS.potion.heal, 'heal');
  fx.push({ k: 'heal', x: player.px, y: player.py, t: 0, d: .6 });
  dirty = true; updateHUD(); if (winOpen === 'inv') renderInv();
}

/* ================= 강화 ================= */
let enchantPick = null, enchanting = false;
function startEnchantPick(scroll) {
  enchantPick = scroll;
  if (winOpen !== 'inv') openWin('inv'); else renderInv();
  $('inv-hint').textContent = scroll === 'wscroll' ? '강화할 무기를 고르세요' : '강화할 방어구를 고르세요';
  document.body.classList.add('picking');
}
function cancelEnchant() { enchantPick = null; document.body.classList.remove('picking'); $('inv-hint').textContent = ''; }
function enchantTarget(ref) {   // ref: {eq:slot} 또는 {inv:index}
  const it = ref.eq ? P.eq[ref.eq] : P.inv[ref.inv];
  const scroll = enchantPick; cancelEnchant();
  if (!it || !it.g) return;
  const kind = scroll === 'wscroll' ? 'w' : 'a';
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
let winOpen = null;
function openWin(w) {
  if (winOpen === w) { closeWin(); return; }
  closeWin(true);
  winOpen = w; $('w-' + w).classList.remove('hidden'); SND.ui();
  if (w === 'inv') renderInv(); if (w === 'char') renderChar(); if (w === 'shop') renderShop(); if (w === 'guide') renderGuide(); if (w === 'gate') renderGate();
  document.body.classList.add('win-open');
}
function closeWin(quiet) { if (!winOpen) return; $('w-' + winOpen).classList.add('hidden'); winOpen = null; document.body.classList.remove('win-open'); cancelEnchant(); hideTip(); if (!quiet) SND.ui(); }

function gearInfo(it) {
  if (it.i) { const d = ITEMS[it.i]; return `<b>${d.name}</b>` + (it.i === 'potion' ? `<br>HP ${d.heal} 회복 (단축키 1)` : `<br>${it.i === 'wscroll' ? '무기' : '방어구'}를 한 단계 강화해요`); }
  if (it.g === 'w') {
    const d = WEAPONS[it.k], [a, b] = weaponRange(it);
    return `<b>${itemName(it)}</b><br>${WTYPE[d.type]} · ${d.tier}단계<br>데미지 ${a === b ? a : a + '~' + b} · 한 대 ${d.spd}초` +
      `<br><span class="dim">안전 강화 +${ENCH.w.safe}까지 · 최대 +${ENCH.w.max}</span>`;
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
  $('eq-grid').innerHTML = SLOTS.map(s => `<div class="eqc"><span>${SLOT_NAME[s]}</span>${slotHTML(P.eq[s], `data-eq="${s}"`)}</div>`).join('');
  let h = ''; for (let i = 0; i < INV_MAX; i++) h += slotHTML(P.inv[i], `data-inv="${i}"`);
  $('inv-grid').innerHTML = h;
  $('inv-coins').textContent = P.coins.toLocaleString();
}
function renderChar() {
  const [a, b] = weaponRange(P.eq.weapon), sb = strBonus();
  const row = (k, n, d) => `<div class="st"><span>${n}</span><b>${P[k]}</b>${P.pts > 0 ? `<button class="plus" data-st="${k}">+</button>` : ''}<em>${d}</em></div>`;
  $('char-body').innerHTML =
    `<div class="lvline">Lv ${P.lv} <span>${P.lv >= MAX_LV ? '최고 레벨' : `경험치 ${P.exp.toLocaleString()} / ${needExp(P.lv).toLocaleString()}`}</span></div>` +
    row('str', '힘', `데미지 ${sb >= 0 ? '+' : ''}${sb}`) + row('dex', '민첩', `명중 +${hitBonus()}% · 치명타 ${critRate()}%`) + row('con', '체력', `최대 HP ${maxHP()}`) +
    (P.pts > 0 ? `<div class="ptsline">보너스 능력치 <b>${P.pts}</b>점을 찍을 수 있어요</div>` : '') +
    `<div class="sum"><div><span>공격</span><b>${a + sb === b + sb ? a + sb : (a + sb) + '~' + (b + sb)}</b></div><div><span>AC</span><b>${playerAC()}</b></div><div><span>HP</span><b>${Math.max(0, Math.ceil(P.hp))}/${maxHP()}</b></div></div>` +
    `<div class="dim small">잡은 몬스터 ${P.kills.toLocaleString()} · 쓰러진 횟수 ${P.deaths}</div>`;
  $('b-char').classList.toggle('alert', P.pts > 0);
}
const SHOP_LIST = [{ i: 'potion' }, ...Object.keys(WEAPONS).filter(k => WEAPONS[k].price).map(k => ({ g: 'w', k })), ...Object.keys(ARMORS).filter(k => ARMORS[k].price).map(k => ({ g: 'a', k }))];
let shopTab = 'buy';
function priceOf(it) { return it.i ? ITEMS[it.i].price : (it.g === 'w' ? WEAPONS : ARMORS)[it.k].price; }
function sellOf(it) {
  if (it.i) return ITEMS[it.i].sell;
  const d = (it.g === 'w' ? WEAPONS : ARMORS)[it.k];
  return Math.round((d.tier === 1 ? 12 : 70) * (1 + it.en * .5) * (it.g === 'w' ? 1.5 : 1));
}
function renderShop() {
  $('shop-coins').textContent = P.coins.toLocaleString();
  document.querySelectorAll('#w-shop .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === shopTab));
  if (shopTab === 'buy') {
    $('shop-list').innerHTML = SHOP_LIST.map((it, i) => `<button class="shop-it" data-buy="${i}" ${P.coins < priceOf(it) ? 'disabled' : ''}><img src="img/${gearImg(it)}.png" alt=""><span>${esc(it.i ? ITEMS[it.i].name : (it.g === 'w' ? WEAPONS : ARMORS)[it.k].name)}</span><b>${priceOf(it)}</b></button>`).join('');
  } else {
    const list = P.inv.map((it, i) => [it, i]);
    $('shop-list').innerHTML = list.length ? list.map(([it, i]) => `<button class="shop-it" data-sell="${i}"><img src="img/${gearImg(it)}.png" alt=""><span>${esc(itemName(it))}</span><b>${sellOf(it)}${it.n > 1 ? ' /개' : ''}</b></button>`).join('') : '<p class="dim">팔 물건이 없어요</p>';
  }
}
let sellArm = -1;
function renderGuide() {
  const k = window.KPOINT ? KPOINT.info() : null;
  const left = P.hunt;
  $('guide-time').innerHTML = left > 0 ? `남은 사냥 시간 <b>${fmtTime(left)}</b>` : `사냥 시간이 없어요 · 1포인트 = 10분` + (k ? ` <span class="dim">(내 포인트 ${k.pts}점)</span>` : '');
  $('guide-list').innerHTML = REGIONS.map(r => `<button class="reg ${r.open ? '' : 'lock'}" data-reg="${r.id}" ${r.open ? '' : 'disabled'}><b>${r.name}</b><span>${!r.open ? '준비 중' : r.lv ? '권장 Lv ' + r.lv : '상점·쉬는 곳'}</span></button>`).join('');
}
function fmtTime(ms) { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function goRegion(id) {
  if (!ZONE[id]) return;
  if (!ZONE[id].town && P.hunt <= 0) {
    if (window.KPOINT && !KPOINT.spend(KPOINT.COST || 1)) { $('guide-time').innerHTML = '<span class="bad">포인트가 모자라요.</span> <span class="dim">+1 포인트 게임을 끝까지 하면 모여요</span>'; return; }
    P.hunt = HUNT_MS; log('1포인트를 써서 사냥 시간 10분을 받았어요', 'sys');
  }
  closeWin(true); SND.warp();
  warpFade(() => { curZone = null; teleport(id); save(true); });
}
function warpFade(fn) { const f = $('fade'); f.classList.add('on'); setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 60); }, 260); }
function goTown(msg) { if (inTown()) return; warpFade(() => { teleport('town'); if (msg) banner(msg, 2); save(true); }); }
// 마을 문: 사냥 시간이 없을 때 1포인트 쓰고 나가기
function renderGate() { const k = window.KPOINT ? KPOINT.info() : null; $('gate-pts').textContent = k ? `내 포인트 ${k.pts}점` : ''; $('gate-msg').innerHTML = ''; }
function payGate() {
  if (window.KPOINT && !KPOINT.spend(KPOINT.COST || 1)) { $('gate-msg').innerHTML = '<span class="bad">포인트가 모자라요.</span> <span class="dim">+1 포인트 게임을 끝까지 하면 모여요</span>'; return; }
  P.hunt = HUNT_MS; dirty = true; log('1포인트를 써서 사냥 시간 10분을 받았어요', 'sys'); SND.coin(); closeWin(true); save(true);
}

/* ================= 화면 정보 ================= */
let dirty = false;
function updateHUD() {
  if (!P) return;
  const mh = maxHP();
  $('hpfill').style.width = clamp(P.hp / mh * 100, 0, 100) + '%';
  $('hptxt').textContent = Math.max(0, Math.ceil(P.hp)) + ' / ' + mh;
  $('xpfill').style.width = (P.lv >= MAX_LV ? 100 : P.exp / needExp(P.lv) * 100) + '%';
  $('xptxt').textContent = P.lv >= MAX_LV ? '최고 레벨' : (P.exp / needExp(P.lv) * 100).toFixed(1) + '%';
  $('lv').textContent = P.lv;
  $('coins').textContent = P.coins.toLocaleString();
  const pot = P.inv.find(x => x.i === 'potion'); $('potn').textContent = pot ? pot.n : 0;
  $('acv').textContent = playerAC();
  $('b-town').classList.toggle('hidden', !curZone || !!curZone.town);
  if (winOpen === 'char') renderChar();
  if (winOpen === 'shop') renderShop();
}

/* ================= 그리기 ================= */
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  VW = innerWidth; VH = innerHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  zoom = clamp(Math.min(VW / (CELL * 17), VH / (CELL * 10.2)), .65, 1.6);
}
const PSCALE = 90 / 239;   // 깨비샘 그림 크기
// 프레임마다 손 위치(그림 비율)와 무기 각도
const HAND = {
  'p-idle': [.74, .7, .35], 'p-walk1': [.8, .63, .4], 'p-walk2': [.8, .63, .4], 'p-wind': [.2, .5, -1.3],
  'p-swing': [.93, .57, 1.35], 'p-hurt': [.72, .62, -.2], 'p-win': [.82, .52, -.25],
};
const WLEN = { dagger: 34, sword: 52, club: 54 };
function drawSprite(name, x, y, h, flip, opts = {}) {
  const im = IMG[name]; if (!im) return;
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

function playerFrame() {
  if (dead) return 'p-dead';
  if (hurtT > 0 && !atkAnim) return 'p-hurt';
  if (atkAnim) return atkAnim.t < atkAnim.wind ? 'p-wind' : 'p-swing';
  if (player.mv) return player.walk % 2 ? 'p-walk1' : 'p-walk2';
  if (winT > 0) return 'p-win';
  return 'p-idle';
}
function drawPlayer() {
  const x = player.px, y = player.py + CELL * .32;
  shadow(x, y, 22);
  const fr = playerFrame(), im = IMG[fr]; if (!im) return;
  const s = PSCALE, w = im.width * s, h = im.height * s, flip = player.face < 0;
  g.save(); g.translate(x, y); if (flip) g.scale(-1, 1);
  if (dead) { g.drawImage(im, -w / 2, -h, w, h); g.restore(); return; }
  g.drawImage(im, -w / 2, -h, w, h);
  // 무기
  const it = P.eq.weapon;
  if (it && HAND[fr]) {
    const wi = IMG['w-' + it.k]; const wd = WEAPONS[it.k];
    if (wi) {
      let [hx, hy, rot] = HAND[fr];
      if (atkAnim && fr === 'p-swing') { const k = clamp((atkAnim.t - atkAnim.wind) / .07, 0, 1); rot = -1.3 + (1.35 + 1.3) * (1 - Math.pow(1 - k, 3)); }
      const L = WLEN[wd.type], sc = L / Math.hypot(wi.width, wi.height) * 1.25;
      g.save(); g.translate(-w / 2 + hx * w, -h + hy * h); g.rotate(rot);
      if (it.en >= 7) { g.shadowColor = it.en >= 9 ? '#ff6ad5' : '#7fd8ff'; g.shadowBlur = 10 + (it.en - 7) * 4; }
      g.drawImage(wi, -wi.width * sc * .2, -wi.height * sc * .8, wi.width * sc, wi.height * sc);
      g.restore();
      // 휘두르는 잔상
      if (atkAnim && fr === 'p-swing' && atkAnim.t - atkAnim.wind < .1) {
        const a = 1 - (atkAnim.t - atkAnim.wind) / .1;
        g.save(); g.translate(-w / 2 + .5 * w, -h + .55 * h); g.globalAlpha = a * .7; g.strokeStyle = '#fff'; g.lineWidth = wd.type === 'club' ? 9 : 6; g.lineCap = 'round';
        g.beginPath(); g.arc(0, 0, L * 1.1, -2.1, .9); g.stroke(); g.restore();
      }
    }
  }
  g.restore();
}
function drawMon(m) {
  const d = m.d; let x = m.px + m.kx, y = m.py + CELL * .32 + m.ky;
  if (m.lunge > 0) x += m.face * 8 * Math.sin((1 - m.lunge / .2) * Math.PI);
  shadow(x, y, d.h * .3);
  const fr = 'm-' + m.type + '-' + ((m.mv ? m.walk : Math.floor(performance.now() / 600 + m.id)) % 2);
  const bob = m.mv ? 0 : Math.sin(performance.now() / 300 + m.id) * 1.5;
  const sq = m.sq;
  const opts = { flash: m.flash, sx: 1 + .14 * sq, sy: 1 - .12 * sq };
  if (m.dying) { const k = m.dying / .55; opts.rot = m.face * -1.4 * Math.min(1, k * 1.6); opts.alpha = k > .5 ? (Math.floor(k * 14) % 2 ? .25 : .9) : 1; }
  drawSprite(fr, x, y + bob, d.h, m.face < 0, opts);
  if (!m.dying && (m === tgt || m.dmgShow > 0 || d.boss) && m.hp < d.hp) {
    const bw = d.boss ? 90 : 46, bx = x - bw / 2, by = y - d.h - 12;
    g.fillStyle = 'rgba(20,14,30,.75)'; g.fillRect(bx - 2, by - 2, bw + 4, 9);
    g.fillStyle = d.boss ? '#ff5d7a' : '#ff6b5b'; g.fillRect(bx, by, bw * Math.max(0, m.hp) / d.hp, 5);
  }
  if (!m.dying && (m === tgt || d.boss || m === hoverMon)) nameTag(d.name + ' Lv ' + d.lv + (m === tgt && auto ? ' · 자동' : ''), x, y + 24, d.boss ? '#ffcf5a' : m === tgt && auto ? '#ffcf3e' : '#fff');
}
function nameTag(t, x, y, col) {
  g.font = '15px Jua, sans-serif'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(20,14,40,.85)'; g.strokeText(t, x, y); g.fillStyle = col; g.fillText(t, x, y);
}
let hoverMon = null;
function drawNpc(n) {
  const x = n.px, y = n.py + CELL * .32;
  shadow(x, y, 26);
  drawSprite(n.img, x, y + Math.sin(performance.now() / 500) * 1.2, n.h, false);
  nameTag(n.name, x, y - n.h - 8, '#ffe58a');
}
function drawProp(p) {
  drawSprite(p.name, p.x, p.y, p.h, false, { alpha: p.fade });
}
function drawDrop(d) {
  const x = d.x * CELL + CELL / 2, y = d.y * CELL + CELL / 2 + 8;
  let px = x, py = y;
  if (d.t < .45) { const k = d.t / .45; px = d.fx + (x - d.fx) * k; py = d.fy + (y - d.fy) * k - Math.sin(k * Math.PI) * 40; }
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
  g.font = (n.kind === 'hit' || n.kind === 'crit' || n.kind === 'hurt' ? '700 ' : '') + size + 'px Fredoka, Jua, sans-serif';
  g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = size > 30 ? 7 : 5; g.strokeStyle = n.kind === 'crit' ? '#7a2a00' : 'rgba(20,14,40,.9)';
  g.strokeText(n.text, 0, 0); g.fillStyle = col; g.fillText(n.text, 0, 0);
  if (n.kind === 'crit') { g.font = '15px Jua, sans-serif'; g.lineWidth = 4; g.strokeText('치명타!', 0, -size * .8); g.fillStyle = '#fff3b0'; g.fillText('치명타!', 0, -size * .8); }
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
    const x = tgt.px, y = tgt.py + CELL * .32, r = tgt.d.h * .34 + 6;
    g.strokeStyle = auto ? '#ffcf3e' : '#ff6b5b'; g.lineWidth = 3; g.setLineDash([8, 6]); g.lineDashOffset = -performance.now() / 40;
    g.beginPath(); g.ellipse(x, y, r, r * .4, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  }
  // 앞뒤 순서대로 (위쪽 먼저)
  const list = [];
  for (const p of M.props) if (p.x + p.w / 2 > vx0 && p.x - p.w / 2 < vx1 && p.y > vy0 && p.y - p.h < vy1) list.push([p.y, p]);
  for (const u of units) if (u.px > vx0 - 120 && u.px < vx1 + 120 && u.py > vy0 - 40 && u.py < vy1 + 200) list.push([u.py + CELL * .32, u]);
  list.sort((a, b) => a[0] - b[0]);
  for (const [, o] of list) {
    if (o.kind === 'prop') drawProp(o);
    else if (o.kind === 'player') drawPlayer();
    else if (o.kind === 'mon') drawMon(o);
    else if (o.kind === 'npc') drawNpc(o);
  }
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

// 땅: 지역마다 바닥 무늬, 경계는 몇 칸에 걸쳐 서서히 섞여요
const BLEND = CELL * 6;
function fillPat(id, x0, x1, y0, y1, a) {
  const pat = M.patterns[id]; if (x1 <= x0) return;
  g.globalAlpha = a;
  if (pat) { g.save(); g.scale(.62, .62); g.fillStyle = pat; g.fillRect(x0 / .62, y0 / .62, (x1 - x0) / .62 + 1, (y1 - y0) / .62); g.restore(); }
  else { g.fillStyle = '#6a8f3a'; g.fillRect(x0, y0, x1 - x0 + 1, y1 - y0); }
  g.globalAlpha = 1;
}
const blendCv = document.createElement('canvas'), blendG = blendCv.getContext('2d');
function drawGround(vx0, vx1, vy0, vy1) {
  const y0 = Math.max(0, vy0), y1 = Math.min(M.h * CELL, vy1);
  for (const z of ZONES) fillPat(z.id, Math.max(vx0, z.x0 * CELL), Math.min(vx1, z.x1 * CELL + 4), y0, y1, 1);   // 살짝 겹쳐 틈이 안 보이게
  // 경계 왼쪽 5칸에 오른쪽 지역 바닥을 서서히 겹쳐 그려요
  for (let i = 1; i < ZONES.length; i++) {
    const B = ZONES[i], bx = B.x0 * CELL, pat = M.patterns[B.id];
    if (!pat || bx < vx0 || bx - BLEND > vx1) continue;
    const w = BLEND, h = Math.ceil(y1 - y0);
    if (blendCv.width !== w || blendCv.height < h) { blendCv.width = w; blendCv.height = Math.max(h, blendCv.height); }
    const x = blendG; x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, w, blendCv.height);
    x.save(); x.translate(-(bx - w), -y0); x.scale(.62, .62); x.fillStyle = pat; x.fillRect((bx - w) / .62, y0 / .62, w / .62, h / .62); x.restore();
    const gr = x.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-in'; x.fillStyle = gr; x.fillRect(0, 0, w, h);
    g.drawImage(blendCv, 0, 0, w, h, bx - w, y0, w, h);
  }
}

/* ================= 미니맵 ================= */
const MINI_S = 2;   // 미니맵 한 칸 = 2픽셀 (캔버스 기준)
let miniBase = null, miniT = 0;
function avgColor(im, fb) {
  if (!im) return fb;
  try { const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 8, 8); const d = x.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; return [r / n, gg / n, b / n]; } catch (e) { return fb; }
}
function buildMini() {
  const W = M.w, H = M.h, c = document.createElement('canvas'); c.width = W * MINI_S; c.height = H * MINI_S;
  const x = c.getContext('2d'), img = x.createImageData(W * MINI_S, H * MINI_S);
  const col = ZONES.map(z => avgColor(IMG[z.tile], [106, 143, 58]));
  for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
    const zi = ZONES.indexOf(zoneAt(cx)); let [r, gg, b] = col[zi];
    if (zi > 0 && cx - ZONES[zi].x0 < 5) { const t = (cx - ZONES[zi].x0 + .5) / 10 + .5, o = col[zi - 1]; r = r * t + o[0] * (1 - t); gg = gg * t + o[1] * (1 - t); b = b * t + o[2] * (1 - t); }
    if (zi < ZONES.length - 1 && ZONES[zi].x1 - cx <= 5) { const t = (ZONES[zi].x1 - cx - .5) / 10 + .5, o = col[zi + 1]; r = r * t + o[0] * (1 - t); gg = gg * t + o[1] * (1 - t); b = b * t + o[2] * (1 - t); }
    if (M.block[idx(cx, cy)]) { r *= .45; gg *= .45; b *= .45; }
    for (let j = 0; j < MINI_S; j++) for (let i = 0; i < MINI_S; i++) { const p = ((cy * MINI_S + j) * W * MINI_S + cx * MINI_S + i) * 4; img.data[p] = r; img.data[p + 1] = gg; img.data[p + 2] = b; img.data[p + 3] = 255; }
  }
  x.putImageData(img, 0, 0);
  // 지역 경계선과 이름
  x.font = '600 13px "Gowun Dodum",sans-serif'; x.textAlign = 'center'; x.lineWidth = 3;
  for (const z of ZONES) { x.strokeStyle = 'rgba(0,0,0,.6)'; x.fillStyle = '#fff'; x.strokeText(z.name, (z.x0 + z.x1) / 2 * MINI_S, 16); x.fillText(z.name, (z.x0 + z.x1) / 2 * MINI_S, 16); }
  miniBase = c;
  const mc = $('mini'); mc.width = c.width; mc.height = c.height;
}
function drawMini(dt) {
  miniT -= dt; if (miniT > 0 || !miniBase) return; miniT = .2;
  const mc = $('mini'), x = mc.getContext('2d'), S = MINI_S;
  x.drawImage(miniBase, 0, 0);
  for (const u of units) {
    if (u.kind === 'mon' && !u.dying) {
      if (u.d.boss) { x.fillStyle = '#ff3b3b'; x.beginPath(); x.arc((u.x + .5) * S, (u.y + .5) * S, 5, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.stroke(); }
      else if (cheb(u.x, u.y, player.x, player.y) < 30) { x.fillStyle = 'rgba(255,110,90,.9)'; x.fillRect(u.x * S, u.y * S, S, S); }
    } else if (u.kind === 'npc') { x.fillStyle = u.role === 'shop' ? '#7fe0ff' : '#ffd23e'; x.fillRect(u.x * S - 2, u.y * S - 2, S + 4, S + 4); }
  }
  // 지금 보이는 화면
  const hw = VW / 2 / zoom, hh = VH / 2 / zoom;
  x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 1.5;
  x.strokeRect((cam.x - hw) / CELL * S, (cam.y - hh) / CELL * S, hw * 2 / CELL * S, hh * 2 / CELL * S);
  if (moveGoal) { x.strokeStyle = '#fff'; x.beginPath(); x.arc((moveGoal[0] + .5) * S, (moveGoal[1] + .5) * S, 4, 0, 7); x.stroke(); }
  x.fillStyle = '#fff'; x.beginPath(); x.arc((player.x + .5) * S, (player.y + .5) * S, 4.5, 0, 7); x.fill();
  x.fillStyle = '#3d7bff'; x.beginPath(); x.arc((player.x + .5) * S, (player.y + .5) * S, 3, 0, 7); x.fill();
}
// 미니맵을 누르면 그곳으로 걸어가요
function miniClick(e) {
  if (!P || dead || !M) return;
  const r = $('mini').getBoundingClientRect();
  let cx = Math.floor((e.clientX - r.left) / r.width * M.w), cy = Math.floor((e.clientY - r.top) / r.height * M.h);
  cx = clamp(cx, 1, M.w - 2); cy = clamp(cy, 1, M.h - 2);
  if (blocked(cx, cy)) { let best = null; for (let rr = 1; rr < 6 && !best; rr++) for (let y = cy - rr; y <= cy + rr; y++) for (let x = cx - rr; x <= cx + rr; x++) if (!best && !blocked(x, y)) best = [x, y]; if (!best) return; [cx, cy] = best; }
  tgt = null; auto = false; held = false; pending = 0; moveGoal = [cx, cy]; player.path = null; SND.ui();
  e.stopPropagation();
}

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
function update(dt) {
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
      else monThink(u, dt);
    }
  }
  // 플레이어
  atkCD -= dt; hurtT -= dt; winT -= dt;
  if (atkAnim) {
    atkAnim.t += dt;
    if (!atkAnim.hit && atkAnim.t >= atkAnim.wind) { atkAnim.hit = true; const m = atkAnim.m; if (!m.dying && units.includes(m) && cheb(player.x, player.y, m.x, m.y) <= 1) doHit(m, atkAnim.type); }
    if (atkAnim.t > atkAnim.wind + .16) atkAnim = null;
  }
  playerThink();
  // 회복: 가만히 있으면 더 빨리
  idleT += dt; regenT += dt;
  if (regenT >= 2 && !dead) { regenT = 0; const mh = maxHP(); if (P.hp < mh) { P.hp = Math.min(mh, P.hp + regenAmt() * (idleT > 3 && !atkAnim ? 3 : 1)); updateHUD(); } }
  if (atkAnim || player.mv) idleT = 0;
  // 효과
  for (const f of fx) f.t += dt; fx = fx.filter(f => f.t < f.d);
  for (const n of nums) n.t += dt; nums = nums.filter(n => n.t < .9);
  for (const d of drops) d.t += dt; drops = drops.filter(d => d.t < d.life);
  // 마우스 아래 몬스터
  { const [wx, wy] = screenToWorld(pointer.x, pointer.y); hoverMon = unitAt(wx, wy, ['mon']); }
  // 캐릭터를 가리는 장식은 반투명하게
  for (const p of M.props) {
    if (Math.abs(p.x - player.px) > 400 && p.fade === 1) continue;
    const cover = p.y > player.py + CELL * .32 && Math.abs(p.x - player.px) < p.w * .42 && player.py + CELL * .32 > p.y - p.h * .95 && player.py < p.y;
    p.fade += ((cover ? .5 : 1) - p.fade) * Math.min(1, dt * 10);
  }
  // 사냥 시간·우두머리
  if (!dead) setZone(zoneAt(player.x));
  const Z = curZone;
  if (!Z.town && !dead) {
    P.hunt -= dt * 1000;
    if (P.hunt <= 0) { P.hunt = 0; tgt = null; auto = false; goTown('사냥 시간이 끝났어요<small>길 안내 도사에게 가면 다시 사냥할 수 있어요</small>'); }
    if (!Z.bossAlive) {
      Z.bossTimer -= dt;
      if (Z.bossTimer <= 0) { const b = spawnMonster(Z, Z.boss); if (b) { Z.bossAlive = true; b.angry = false; SND.boss(); banner(`${josa(b.d.name, '이가')} 나타났어요!`, 2.2); log(`<b>${josa(b.d.name, '이가')}</b> 나타났어요! 화살표를 따라가 보세요`, 'boss'); } else Z.bossTimer = 10; }
    }
    $('htime').textContent = fmtTime(P.hunt);
    $('htime').classList.toggle('low', P.hunt < 60000);
  }
  saveClock += dt;
  if (saveClock > 5) { saveClock = 0; if (dirty || !curZone.town) { dirty = false; save(); } }
}
let paused = false;

/* ================= 시작 ================= */
let createPts = 5, cStats = { str: 10, dex: 10, con: 10 };
function renderCreate() {
  $('c-left').textContent = createPts;
  for (const k of ['str', 'dex', 'con']) $('c-' + k).textContent = cStats[k];
  $('c-go').disabled = createPts > 0;
}
function startGame() {
  $('title').classList.add('hidden'); $('create').classList.add('hidden');
  document.body.classList.add('playing');
  $('hud').classList.remove('hidden');
  enterWorld();
  updateHUD();
  log('깨비샘의 도깨비 대모험에 온 걸 환영해요!', 'sys');
  if (P.hunt > 0) log(`남은 사냥 시간 ${fmtTime(P.hunt)} · 길 안내 도사에게 말을 걸어요`, 'sys');
}

function bindUI() {
  cv.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  addEventListener('resize', resize);
  addEventListener('keydown', e => {
    if (!P || !document.body.classList.contains('playing')) return;
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === '1') { drinkPotion(); e.preventDefault(); }
    else if (k === 'i' || k === 'ㅑ') openWin('inv');
    else if (k === 'c' || k === 'ㅊ') openWin('char');
    else if (k === 'escape') { if (enchantPick) cancelEnchant(); else closeWin(); }
  });
  addEventListener('pagehide', () => save(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });
  $('b-pot').addEventListener('click', drinkPotion);
  $('b-inv').addEventListener('click', () => openWin('inv'));
  $('b-char').addEventListener('click', () => openWin('char'));
  $('b-town').addEventListener('click', () => { if (!dead) goTown(); });
  $('mini').addEventListener('pointerdown', miniClick);
  $('gate-pay').addEventListener('click', payGate);
  $('b-snd').addEventListener('click', () => { SND.on = !SND.on; $('b-snd').classList.toggle('off', !SND.on); });
  $('b-snd').classList.toggle('off', !SND.on);
  document.querySelectorAll('.win .x').forEach(b => b.addEventListener('click', () => closeWin()));
  // 가방
  const tip = $('tip');
  function showTip(el, html) { tip.innerHTML = html; tip.classList.remove('hidden'); const r = el.getBoundingClientRect(); tip.style.left = clamp(r.left - tip.offsetWidth - 8, 6, innerWidth - tip.offsetWidth - 6) + 'px'; tip.style.top = clamp(r.top, 6, innerHeight - tip.offsetHeight - 6) + 'px'; }
  window.hideTip = () => tip.classList.add('hidden');
  ['eq-grid', 'inv-grid'].forEach(id => {
    const box = $(id);
    box.addEventListener('mouseover', e => { const s = e.target.closest('.slot'); if (!s) return; const it = s.dataset.eq ? P.eq[s.dataset.eq] : P.inv[+s.dataset.inv]; if (it) showTip(s, gearInfo(it)); else hideTip(); });
    box.addEventListener('mouseleave', hideTip);
    box.addEventListener('click', e => {
      const s = e.target.closest('.slot'); if (!s || enchanting) return;
      if (enchantPick) { enchantTarget(s.dataset.eq ? { eq: s.dataset.eq } : { inv: +s.dataset.inv }); hideTip(); return; }
      if (s.dataset.eq) unequip(s.dataset.eq); else useItem(+s.dataset.inv);
      hideTip();
    });
  });
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
      const it = SHOP_LIST[+b.dataset.buy], p = priceOf(it);
      if (P.coins < p) return;
      if (!giveItem(it.i ? { i: it.i, n: 1 } : { g: it.g, k: it.k, en: 0 })) { log('가방이 가득 찼어요', 'warn'); return; }
      P.coins -= p; SND.coin(); log(`<b>${josa(esc(it.i ? ITEMS[it.i].name : (it.g === 'w' ? WEAPONS : ARMORS)[it.k].name), '을를')}</b> 샀어요`, 'item');
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
  const saved = loadSave();
  $('t-continue').classList.toggle('hidden', !saved);
  $('t-new').textContent = saved ? '새로 시작' : '시작하기';
  let newArm = false;
  $('t-new').addEventListener('click', () => {
    if (loadSave() && !newArm) { newArm = true; $('t-new').textContent = '한 번 더 누르면 처음부터'; return; }
    $('title').classList.add('hidden'); $('create').classList.remove('hidden'); createPts = 5; cStats = { str: 10, dex: 10, con: 10 }; renderCreate();
  });
  $('t-continue').addEventListener('click', () => { P = loadSave(); if (!P) return; if (P.hp <= 0) P.hp = maxHP(); SND.unlock(); startGame(); });
  $('create').addEventListener('click', e => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    const [k, d] = b.dataset.c.split(':');
    if (d === '+' && createPts > 0) { cStats[k]++; createPts--; }
    if (d === '-' && cStats[k] > 10) { cStats[k]--; createPts++; }
    SND.ui(); renderCreate();
  });
  $('c-back').addEventListener('click', () => { $('create').classList.add('hidden'); $('title').classList.remove('hidden'); });
  $('c-go').addEventListener('click', () => { P = newChar(cStats.str, cStats.dex, cStats.con); P.hp = maxHP(); save(); SND.unlock(); startGame(); });
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
    const local = loadSave();
    if (!local) { $('code-show').textContent = '------'; msg('캐릭터를 만들면 코드가 생겨요'); return; }
    $('code-show').textContent = '만드는 중...';
    try {
      for (let i = 0; i < 5 && !c; i++) { let t = ''; for (let j = 0; j < 6; j++) t += CODE_ABC[1 + Math.floor(Math.random() * (CODE_ABC.length - 1))]; if (!(await window.RPG_CLOUD.get(t))) c = t; }
      if (!c) throw new Error('no code');
      await window.RPG_CLOUD.put(c, { s: JSON.stringify(local), t: local.t || Date.now() });
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
    if (!data || data.v !== 1) { msg('코드가 맞지 않아요', true); return; }
    if (arm !== t) { arm = t; $('code-load').textContent = '한 번 더 누르면 불러와요'; msg(`Lv ${data.lv} 캐릭터예요. 이 기기의 캐릭터가 바뀌어요.`); return; }
    try { localStorage.setItem(SAVE_KEY, d.s); localStorage.setItem('rpg-save-code', t); } catch (e) {}
    msg('불러왔어요!'); $('code-show').textContent = fmt(t);
    $('t-continue').classList.remove('hidden'); $('t-new').textContent = '새로 시작';
  });
}
async function pullCloud() {   // 다른 기기에서 더 나중에 저장한 게 있으면 받아 와요
  const c = cloudCode(); if (!c || !window.RPG_CLOUD) return;
  try {
    const d = await window.RPG_CLOUD.get(c); const local = loadSave();
    if (d && d.s && (!local || (+d.t || 0) > (local.t || 0))) { localStorage.setItem(SAVE_KEY, d.s); $('t-continue').classList.remove('hidden'); $('t-new').textContent = '새로 시작'; }
  } catch (e) { console.warn('저장 받아 오기 실패', e); }
}

/* ================= 처음 ================= */
resize();
bindUI();
loadImages().then(() => { document.body.classList.add('ready'); });
setTimeout(pullCloud, 600);
requestAnimationFrame(frame);
window.__rpg = { screenPos() { return [(player.px - cam.x) * zoom + VW / 2, (player.py - cam.y) * zoom + VH / 2]; }, get P() { return P; }, get M() { return M; }, get units() { return units; }, get player() { return player; }, get zone() { return curZone; }, enterWorld, teleport, goRegion, spawnMonster, gainExp, giveItem, rollAttack, playerAttacker, playerAC, set tgt(v) { tgt = v; }, set auto(v) { auto = v; } };
