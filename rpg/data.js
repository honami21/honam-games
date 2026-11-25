// 깨비샘의 도깨비 대모험 · 게임 데이터 (디자인 문서: 전투 수치·장비·몬스터·드롭률)
'use strict';
const CELL = 56;   // 한 칸 크기 (월드 픽셀)

// 무기: 기본 데미지, 한 대 간격(초), 종류. 방망이는 양손이라 방패를 못 들어요.
const WEAPONS = {
  dagger1: { name: '대나무 칼',     dmg: 3,  spd: 0.4, type: 'dagger', tier: 1, price: 60 },
  sword1:  { name: '나무 검',       dmg: 5,  spd: 0.6, type: 'sword',  tier: 1, price: 80 },
  club1:   { name: '나무 방망이',   dmg: 8,  spd: 0.9, type: 'club',   tier: 1, price: 120, two: true },
  dagger2: { name: '무쇠 단도',     dmg: 5,  spd: 0.4, type: 'dagger', tier: 2 },
  sword2:  { name: '무쇠 검',       dmg: 8,  spd: 0.6, type: 'sword',  tier: 2 },
  club2:   { name: '무쇠 방망이',   dmg: 12, spd: 0.9, type: 'club',   tier: 2, two: true },
};
const WTYPE = { dagger: '단검', sword: '검', club: '방망이(양손)' };

// 방어구: 칸, 방어도(AC를 낮춤)
const ARMORS = {
  armor1:  { name: '무명 저고리',     slot: 'armor',  ac: 3, tier: 1, price: 60 },
  helm1:   { name: '짚 삿갓',         slot: 'helm',   ac: 1, tier: 1, price: 30 },
  cloak1:  { name: '낡은 천 망토',    slot: 'cloak',  ac: 1, tier: 1, price: 30 },
  glove1:  { name: '무명 장갑',       slot: 'glove',  ac: 1, tier: 1, price: 30 },
  boots1:  { name: '낡은 고무신',     slot: 'boots',  ac: 1, tier: 1, price: 30 },
  shield1: { name: '나무 방패',       slot: 'shield', ac: 1, tier: 1, price: 40 },
  armor2:  { name: '대나무 갑옷',     slot: 'armor',  ac: 4, tier: 2 },
  helm2:   { name: '가죽 투구',       slot: 'helm',   ac: 2, tier: 2 },
  cloak2:  { name: '대나무 무늬 망토', slot: 'cloak', ac: 1, tier: 2 },
  glove2:  { name: '가죽 장갑',       slot: 'glove',  ac: 1, tier: 2 },
  boots2:  { name: '남색 고무신',     slot: 'boots',  ac: 1, tier: 2 },
  shield2: { name: '대나무 방패',     slot: 'shield', ac: 2, tier: 2 },
};
const SLOTS = ['weapon', 'helm', 'armor', 'cloak', 'glove', 'boots', 'shield'];
const SLOT_NAME = { weapon: '무기', helm: '투구', armor: '갑옷', cloak: '망토', glove: '장갑', boots: '고무신', shield: '방패' };

// 쌓이는 아이템
const ITEMS = {
  potion:  { name: '빨간 물약',       img: 'i-potion',  price: 15, sell: 3, heal: 40 },
  wscroll: { name: '무기 강화 부적',   img: 'i-wscroll', sell: 20 },
  ascroll: { name: '방어구 강화 부적', img: 'i-ascroll', sell: 15 },
};

// 강화 규칙 (확정): 무기 안전 +6·최대 +10, 방어구 안전 +4·최대 +7, 안전선을 넘으면 매 단계 25%, 실패하면 사라짐
const ENCH = { w: { safe: 6, max: 10 }, a: { safe: 4, max: 7 }, rate: 0.25 };

// 몬스터 (디자인 문서 4장 표). h=화면 키, aggro=먼저 덤비는지, step=한 칸 걷는 시간
const MONS = {
  dust:    { name: '먼지 꼬마',     lv: 1,  hp: 15,   ac: 10, dmg: [1, 3],   exp: 3,    h: 40,  aggro: 0, step: .5 },
  rat:     { name: '들쥐',          lv: 3,  hp: 25,   ac: 8,  dmg: [2, 4],   exp: 5,    h: 44,  aggro: 0, step: .42 },
  acorn:   { name: '도토리 요정',   lv: 5,  hp: 35,   ac: 6,  dmg: [3, 5],   exp: 7,    h: 58,  aggro: 0, step: .45 },
  scare:   { name: '허수아비',      lv: 8,  hp: 55,   ac: 4,  dmg: [4, 7],   exp: 10,   h: 84,  aggro: 1, step: .5 },
  kscare:  { name: '왕 허수아비',   lv: 12, hp: 600,  ac: 0,  dmg: [8, 12],  exp: 300,  h: 140, aggro: 1, step: .55, boss: 1 },
  shoot:   { name: '죽순 꼬마',     lv: 10, hp: 70,   ac: 2,  dmg: [5, 8],   exp: 14,   h: 54,  aggro: 0, step: .48 },
  tanuki:  { name: '너구리',        lv: 13, hp: 90,   ac: 0,  dmg: [6, 10],  exp: 18,   h: 60,  aggro: 1, step: .42 },
  bghost:  { name: '대나무 귀신',   lv: 16, hp: 120,  ac: -2, dmg: [8, 12],  exp: 24,   h: 78,  aggro: 1, step: .5 },
  broom:   { name: '몽당빗자루',    lv: 19, hp: 150,  ac: -4, dmg: [9, 14],  exp: 30,   h: 74,  aggro: 1, step: .45 },
  general: { name: '대나무 장군',   lv: 22, hp: 2500, ac: -6, dmg: [15, 22], exp: 1500, h: 146, aggro: 1, step: .55, boss: 1 },
};

// 한 장으로 이어진 넓은 세계 (서쪽 마을 → 동쪽으로 들판 → 대나무 숲). 아직 안 연 3~5지역은 길이 막혀 있어요.
const WORLD = { w: 168, h: 60 };
// x0~x1: 지역이 차지하는 가로 칸, spawn: 리스폰 지점(길 안내 도사가 서 있는 곳)
const ZONES = [
  { id: 'town', name: '도깨비 마을', lv: '', x0: 0, x1: 36, tile: 'tile-town', town: true, spawn: [17, 30] },
  { id: 'field', name: '마을 앞 들판', lv: '1~10', x0: 36, x1: 102, tile: 'tile-field', tier: 1, spawn: [41, 30], count: 70, boss: 'kscare',
    // [몬스터, 지역 서쪽에서 떨어진 정도(0 가까움 ~ 1 멂) 범위, 비율]
    mons: [['dust', 0, .45, 3], ['rat', .1, .65, 3], ['acorn', .35, .9, 3], ['scare', .55, 1, 3]],
    drop: { w: .002, a: .004, gear: .005, coin: [1, 3] } },
  { id: 'bamboo', name: '대나무 숲', lv: '10~20', x0: 102, x1: 168, tile: 'tile-bamboo', tier: 2, spawn: [107, 30], count: 72, boss: 'general',
    mons: [['shoot', 0, .45, 3], ['tanuki', .1, .7, 3], ['bghost', .35, .95, 3], ['broom', .55, 1, 3]],
    drop: { w: .005, a: .01, gear: .005, coin: [3, 8] } },
];
const ZONE = Object.fromEntries(ZONES.map(z => [z.id, z]));
// 길 안내 도사 목록 (아직 안 연 지역은 준비 중)
const REGIONS = [
  { id: 'town', name: '도깨비 마을', lv: '', open: true },
  { id: 'field', name: '마을 앞 들판', lv: '1~10', open: true },
  { id: 'bamboo', name: '대나무 숲', lv: '10~20', open: true },
  { id: 'forest', name: '도깨비 숲', lv: '20~30' },
  { id: 'moon', name: '달빛 고개', lv: '30~40' },
  { id: 'cave', name: '이무기 동굴', lv: '40~50' },
];
const BOSS_FIRST = 180, BOSS_AGAIN = 300;   // 사냥터에서 3분 뒤 첫 우두머리, 쓰러뜨리면 5분 뒤 다시
const HUNT_MS = 10 * 60 * 1000;              // 1포인트 = 사냥 10분

// 장식물: 그림, 화면 너비, 막는 칸(밑동 기준 가로×세로)
const PROPS = {
  't-house1': { w: 210, fw: 4, fh: 2 }, 't-house2': { w: 220, fw: 4, fh: 2 }, 't-stall': { w: 150, fw: 3, fh: 1 },
  't-well': { w: 96, fw: 2, fh: 1 }, 't-jars': { w: 96, fw: 2, fh: 1 }, 't-fence': { w: 96, fw: 2, fh: 1 },
  't-jangseung': { w: 96, fw: 2, fh: 1 }, 't-portal': { w: 120, fw: 2, fh: 1 },
  'f-tree1': { w: 170, fw: 2, fh: 1 }, 'f-tree2': { w: 110, fw: 1, fh: 1 }, 'f-bush': { w: 80, fw: 1, fh: 1 },
  'f-rock1': { w: 110, fw: 2, fh: 1 }, 'f-rocks': { w: 80, fw: 1, fh: 1 }, 'f-hay': { w: 76, fw: 1, fh: 1 },
  'f-sign': { w: 72, fw: 1, fh: 1 }, 'f-flowers': { w: 78, fw: 0, fh: 0 },
  'b-bamboo1': { w: 120, fw: 2, fh: 1 }, 'b-bamboo2': { w: 92, fw: 1, fh: 1 }, 'b-rock': { w: 110, fw: 2, fh: 1 },
  'b-fallen': { w: 110, fw: 2, fh: 1 }, 'b-tower': { w: 70, fw: 1, fh: 1 }, 'b-sasa': { w: 84, fw: 1, fh: 1 },
  'b-pond': { w: 150, fw: 3, fh: 2 }, 'b-lantern': { w: 72, fw: 1, fh: 1 },
};

// 레벨업에 필요한 경험치 (레벨³, 처음 두 단계는 10)
const needExp = lv => Math.max(10, lv * lv * lv);
const MAX_LV = 50;
