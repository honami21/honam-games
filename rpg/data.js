// 깨비샘의 도깨비 대모험 · 게임 데이터 (디자인 문서: 전투 수치·장비·몬스터·드롭률)
'use strict';
const CELL = 56;   // 한 칸 크기 (월드 픽셀)

// 무기: 캐릭터마다 자기 무기 하나만 써요 (깨비샘 = 검). 무기는 바꿀 수 없고 강화만 해요.
// 나머지는 예전 저장 호환용으로만 남겨 둬요.
const WEAPONS = {
  dagger1: { name: '대나무 칼',     dmg: 3,  spd: 0.4, type: 'dagger', tier: 1 },
  sword1:  { name: '깨비샘의 검',   dmg: 5,  spd: 0.6, type: 'sword',  tier: 1 },
  bow1:    { name: '깨순이의 활',   dmg: 4,  spd: 0.75, type: 'bow',  tier: 1, range: 8, two: true },   // 8칸 떨어져서 쏴요
  club1:   { name: '나무 방망이',   dmg: 8,  spd: 0.9, type: 'club',   tier: 1, two: true },
  dagger2: { name: '무쇠 단도',     dmg: 5,  spd: 0.4, type: 'dagger', tier: 2 },
  sword2:  { name: '무쇠 검',       dmg: 8,  spd: 0.6, type: 'sword',  tier: 2 },
  club2:   { name: '무쇠 방망이',   dmg: 12, spd: 0.9, type: 'club',   tier: 2, two: true },
};
const WTYPE = { bow: '활', dagger: '단검', sword: '검', club: '방망이(양손)' };

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
// 장신구: 목걸이·반지. 강화할 수 없고 우두머리만 떨어뜨려요 (boss: 떨어뜨리는 우두머리)
const ACCS = {
  neck1: { name: '허수아비 짚 목걸이', slot: 'neck', tier: 1, boss: 'kscare', hp: 15 },
  ring1: { name: '허수아비 반지',      slot: 'ring', tier: 1, boss: 'kscare', str: 1 },
  neck2: { name: '대나무 장군 목걸이', slot: 'neck', tier: 2, boss: 'general', hp: 30, ac: 1 },
  ring2: { name: '대나무 장군 반지',   slot: 'ring', tier: 2, boss: 'general', str: 1, dex: 1 },
};
const ACC_DROP = 0.25;   // 우두머리를 잡으면 25% 확률로 장신구 하나
const SLOTS = ['weapon', 'helm', 'armor', 'cloak', 'glove', 'boots', 'shield', 'neck', 'ring'];
const SLOT_NAME = { weapon: '무기', helm: '투구', armor: '갑옷', cloak: '망토', glove: '장갑', boots: '고무신', shield: '방패', neck: '목걸이', ring: '반지' };

// 쌓이는 아이템
const ITEMS = {
  potion:  { name: '빨간 물약',       img: 'i-potion',  price: 15, sell: 3, heal: 40 },
  haste:   { name: '초록 물약',       img: 'i-haste',   price: 40, sell: 8, sec: 300 },   // 5분 동안 걷기·공격이 빨라져요
  ret:     { name: '마을 귀환 주문서', img: 'i-return',  price: 12, sell: 2 },              // 읽으면 마을로 돌아가요 (단축키 3)
  tele:    { name: '순간이동 주문서', img: 'i-teleport', price: 8, sell: 1 },              // 지금 있는 사냥터 안 아무 곳으로 (단축키 4)
  wscroll: { name: '무기 강화 부적',   img: 'i-wscroll', sell: 20 },
  ascroll: { name: '방어구 강화 부적', img: 'i-ascroll', sell: 15 },
};

// 강화 규칙 (확정): 무기 안전 +6·최대 +10, 방어구 안전 +4·최대 +7, 안전선을 넘으면 매 단계 25%, 실패하면 사라짐
const ENCH = { w: { safe: 6, max: 10 }, a: { safe: 4, max: 7 }, rate: 0.25 };

// 몬스터 (디자인 문서 4장 표). h=화면 키, aggro=먼저 덤비는지, step=한 칸 걷는 시간
const MONS = {
  dust:    { name: '먼지 꼬마',     lv: 1,  hp: 15,   ac: 10, dmg: [1, 3],   exp: 3,    h: 20,  aggro: 0, step: .5 },
  rat:     { name: '들쥐',          lv: 3,  hp: 25,   ac: 8,  dmg: [2, 4],   exp: 5,    h: 22,  aggro: 0, step: .42 },
  acorn:   { name: '도토리 요정',   lv: 5,  hp: 35,   ac: 6,  dmg: [3, 5],   exp: 7,    h: 29,  aggro: 0, step: .45 },
  scare:   { name: '허수아비',      lv: 8,  hp: 55,   ac: 4,  dmg: [4, 7],   exp: 10,   h: 42,  aggro: 1, step: .5 },
  kscare:  { name: '왕 허수아비',   lv: 12, hp: 600,  ac: 0,  dmg: [8, 12],  exp: 300,  h: 70, aggro: 1, step: .55, boss: 1 },
  shoot:   { name: '죽순 꼬마',     lv: 10, hp: 70,   ac: 2,  dmg: [5, 8],   exp: 14,   h: 27,  aggro: 0, step: .48 },
  tanuki:  { name: '너구리',        lv: 13, hp: 90,   ac: 0,  dmg: [6, 10],  exp: 18,   h: 30,  aggro: 1, step: .42 },
  bghost:  { name: '대나무 귀신',   lv: 16, hp: 120,  ac: -2, dmg: [8, 12],  exp: 24,   h: 39,  aggro: 1, step: .5 },
  broom:   { name: '몽당빗자루',    lv: 19, hp: 150,  ac: -4, dmg: [9, 14],  exp: 30,   h: 37,  aggro: 1, step: .45 },
  general: { name: '대나무 장군',   lv: 22, hp: 2500, ac: -6, dmg: [15, 22], exp: 1500, h: 73, aggro: 1, step: .55, boss: 1 },
};

// 도깨비섬 (C안): 큰 섬 하나 + 가운데 남북 산맥. 서쪽에 마을·들판·논밭, 산맥 북쪽 고갯길을 넘으면 동쪽 대나무 골·깊은 대숲·안개 늪
// 좌표는 0~1 비율 (가로 w, 세로 h 칸). 바닥은 초록 계열로 통일하고 지역은 장식으로 구분해요
const WORLD = { w: 360, h: 280, town: [.3, .45] };
// tile: 바닥 그림, mons: [몬스터, 비율], count: 몬스터 수, at: 리스폰 지점(비율), seeds: 지역 씨앗(비율)
const ZONES = [
  { id: 'town', name: '도깨비 마을', lv: '', tile: 'tile-town', town: true, color: '#c99b5e' },
  { id: 'near', name: '마을 앞 들판', lv: '1~5', tile: 'tile-field', tier: 1, at: [.3, .3], seeds: [[.28, .27], [.37, .74]], count: 260,
    mons: [['dust', 5], ['rat', 4]], drop: { w: .002, a: .004, gear: .004, coin: [1, 2] } },
  { id: 'paddy', name: '허수아비 논밭', lv: '5~10', tile: 'tile-field', tier: 1, at: [.2, .64], seeds: [[.19, .62]], count: 190, boss: 'kscare',
    mons: [['rat', 3], ['acorn', 6], ['scare', 3]], drop: { w: .003, a: .006, gear: .006, coin: [2, 4] } },
  { id: 'bamboo', name: '대나무 골', lv: '10~15', tile: 'tile-bamboo', tier: 2, at: [.68, .3], seeds: [[.73, .27]], count: 190,
    mons: [['shoot', 7], ['tanuki', 2]], drop: { w: .004, a: .008, gear: .004, coin: [3, 6] } },
  { id: 'deep', name: '깊은 대숲', lv: '15~20', tile: 'tile-deep', tier: 2, at: [.8, .52], seeds: [[.8, .55]], count: 150, boss: 'general',
    mons: [['tanuki', 1], ['bghost', 4], ['broom', 4]], drop: { w: .006, a: .012, gear: .006, coin: [5, 9] } },
  { id: 'marsh', name: '안개 늪', lv: '', tile: 'tile-deep', tier: 2, seeds: [[.68, .8]] },
  { id: 'mtn', name: '뿔바위 산맥', lv: '', tile: 'tile-rock', tier: 2 },
  { id: 'beach', name: '도깨비섬 바닷가', lv: '', tile: 'tile-sand', tier: 1 },
];
const ZONE = Object.fromEntries(ZONES.map(z => [z.id, z]));
// 섬 모양(해안선 꼭짓점), 작은 섬, 산맥 등줄기, 고갯길, 강
const ISLE = {
  coast: [[.14, .3], [.26, .14], [.44, .12], [.56, .2], [.7, .1], [.86, .18], [.92, .36], [.86, .5], [.92, .68], [.8, .86], [.6, .88], [.5, .78], [.38, .9], [.2, .84], [.1, .66], [.16, .52], [.08, .42]],
  islets: [[[.02, .86], [.08, .84], [.1, .92], [.04, .94]], [[.94, .88], [.98, .86], [.99, .93], [.95, .94]], [[.62, .02], [.68, .01], [.69, .06], [.63, .07]]],
  ridge: [[.43, .06], [.46, .2], [.5, .34], [.52, .46], [.55, .58], [.56, .7], [.53, .8], [.5, .9]],
  pass: [.465, .235],
  river: [[.49, .4], [.43, .5], [.44, .62], [.47, .74], [.47, .95]],
};
// 마을 순간이동 문 목록 (아직 안 연 곳은 준비 중)
const REGIONS = [
  { id: 'town', name: '도깨비 마을', lv: '', open: true },
  { id: 'near', name: '마을 앞 들판', lv: '1~5', open: true },
  { id: 'paddy', name: '허수아비 논밭', lv: '5~10', open: true },
  { id: 'bamboo', name: '대나무 골', lv: '10~15', open: true },
  { id: 'deep', name: '깊은 대숲', lv: '15~20', open: true },
  { id: 'marsh', name: '안개 늪', lv: '20~25' },
  { id: 'cave', name: '뿔바위 산맥 던전', lv: '25~30' },
  { id: 'ship', name: '배 타고 새 섬으로', lv: '30~' },
];
// 황금 몬스터: 일반 몬스터가 나올 때 1.5% 확률. HP 4배, 경험치 5배, 엽전 30배, 부적·방어구 확률 15배, 초록 물약 30%
const RARE = { chance: .015, hp: 4, exp: 5, coin: 30, drop: 15 };
const BOSS_FIRST = 180, BOSS_AGAIN = 300;   // 사냥터에서 3분 뒤 첫 우두머리, 쓰러뜨리면 5분 뒤 다시
const HUNT_MS = 10 * 60 * 1000;              // 1포인트 = 사냥 10분

// 장식물: 그림, 화면 너비, 막는 칸(밑동 기준 가로×세로)
const PROPS = {
  't-house1': { w: 210, fw: 4, fh: 2 }, 't-house2': { w: 220, fw: 4, fh: 2 }, 't-stall': { w: 150, fw: 3, fh: 1 },
  't-well': { w: 80, fw: 2, fh: 1 }, 't-jars': { w: 52, fw: 1, fh: 1 }, 't-fence': { w: 96, fw: 2, fh: 1 },
  't-jangseung': { w: 96, fw: 2, fh: 1, sx: 0.7 }, 't-portal': { w: 120, fw: 2, fh: 1 },
  't-board': { w: 110, fw: 2, fh: 1 }, 't-forge': { w: 170, fw: 3, fh: 1 },
  't-shop': { w: 165, fw: 3, fh: 1 }, 't-storage': { w: 165, fw: 3, fh: 1 }, 't-well-f': { w: 86, fw: 2, fh: 1 }, 't-jars-f': { w: 72, fw: 2, fh: 1 },
  'f-tree1': { w: 170, fw: 2, fh: 1, sx: 0.82 }, 'f-tree2': { w: 110, fw: 1, fh: 1, sx: 0.82 }, 'f-bush': { w: 50, fw: 1, fh: 1 },
  'f-rock1': { w: 80, fw: 2, fh: 1 }, 'f-rocks': { w: 48, fw: 1, fh: 1 }, 'f-hay': { w: 46, fw: 1, fh: 1 },
  'f-sign': { w: 42, fw: 1, fh: 1 }, 'f-flowers': { w: 54, fw: 0, fh: 0, flat: 1 },
  'b-bamboo1': { w: 120, fw: 2, fh: 1, sx: 0.65 }, 'b-bamboo2': { w: 92, fw: 1, fh: 1, sx: 0.65 }, 'b-rock': { w: 80, fw: 2, fh: 1 },
  'b-fallen': { w: 84, fw: 2, fh: 1 }, 'b-tower': { w: 56, fw: 1, fh: 1 }, 'b-sasa': { w: 56, fw: 1, fh: 1 },
  'b-pond': { w: 150, fw: 3, fh: 2 }, 'b-lantern': { w: 44, fw: 1, fh: 1 },
  // 바닷가·섬 안쪽 (flat: 땅에 붙은 그림이라 캐릭터가 위로 지나가요)
  'c-pine': { w: 150, fw: 1, fh: 1, sx: 0.82 }, 'c-rock': { w: 90, fw: 2, fh: 1 }, 'c-shells': { w: 46, fw: 0, fh: 0, flat: 1 },
  'c-dock': { w: 190, fw: 0, fh: 0, flat: 1 }, 'c-boat': { w: 150, fw: 2, fh: 1 }, 'c-lighthouse': { w: 130, fw: 2, fh: 1 },
  'c-cave': { w: 190, fw: 3, fh: 1 }, 'c-drift': { w: 72, fw: 2, fh: 1 },
  'l-bridge': { w: 250, fw: 0, fh: 0, flat: 1 }, 'l-cliff': { w: 170, fw: 3, fh: 1 }, 'l-wall': { w: 84, fw: 2, fh: 1 },
  'l-sign': { w: 44, fw: 1, fh: 1 }, 'l-stones': { w: 215, fw: 0, fh: 0, flat: 1 }, 'l-pine': { w: 170, fw: 2, fh: 1, sx: 0.82 },
  'l-pavilion': { w: 200, fw: 3, fh: 2 }, 'l-reed': { w: 58, fw: 1, fh: 1, sx: 0.7 },
};

// 레벨업에 필요한 경험치 (레벨³, 처음 두 단계는 10)
const needExp = lv => Math.max(10, lv * lv * lv);
const MAX_LV = 50;
