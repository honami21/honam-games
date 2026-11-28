// 깨비샘의 도깨비 대모험 · 게임 데이터 (디자인 문서: 전투 수치·장비·몬스터·드롭률)
'use strict';
const CELL = 56;   // 한 칸 크기 (월드 픽셀)

// 무기: 캐릭터마다 자기 무기 하나만 써요 (깨비샘 = 검). 무기는 바꿀 수 없고 강화만 해요.
// 나머지는 예전 저장 호환용으로만 남겨 둬요.
const WEAPONS = {
  dagger1: { name: '대나무 칼',     dmg: 3,  spd: 0.4, type: 'dagger', tier: 1 },
  sword1:  { name: '나무 대검',     dmg: 5,  spd: 0.6, type: 'sword',  tier: 1, two: true },   // 검사는 양손검이라 방패를 못 들어요
  bow1:    { name: '나무 활',       dmg: 4,  spd: 0.75, type: 'bow',  tier: 1, range: 8, two: true },   // 8칸 떨어져서 쏴요
  club1:   { name: '나무 방망이',   dmg: 8,  spd: 0.9, type: 'club',   tier: 1, two: true },
  dagger2: { name: '무쇠 단도',     dmg: 5,  spd: 0.4, type: 'dagger', tier: 2 },
  sword2:  { name: '무쇠 검',       dmg: 8,  spd: 0.6, type: 'sword',  tier: 2, two: true },
  club2:   { name: '무쇠 방망이',   dmg: 12, spd: 0.9, type: 'club',   tier: 2, two: true },
  sword3:  { name: '저승 대검',     dmg: 11, spd: 0.6, type: 'sword',  tier: 3, two: true, set: 'jeo' },   // 안개 늪: 저승사자 15%, 일반 몬스터 0.1%
  bow3:    { name: '망령 활',       dmg: 7,  spd: 0.75, type: 'bow',   tier: 3, range: 8, two: true, set: 'jeo' },
};
const WTYPE = { bow: '활', dagger: '단검', sword: '양손검', club: '방망이(양손)' };

// 방어구: 칸, 방어도(AC를 낮춤)
const ARMORS = {
  armor1:  { name: '무명 저고리',     slot: 'armor',  ac: 3, tier: 1, price: 60 },
  helm1:   { name: '짚 삿갓',         slot: 'helm',   ac: 1, tier: 1, price: 30 },
  cloak1:  { name: '낡은 천 망토',    slot: 'cloak',  ac: 1, tier: 1, price: 30 },
  glove1:  { name: '무명 장갑',       slot: 'glove',  ac: 1, tier: 1, price: 30 },
  boots1:  { name: '낡은 고무신',     slot: 'boots',  ac: 1, tier: 1, price: 30 },
  shield1: { name: '나무 방패',       slot: 'shield', ac: 1, tier: 1, price: 40, blk: 10 },   // blk: 전사가 들면 공격을 막을 확률(%)
  armor2:  { name: '대나무 갑옷',     slot: 'armor',  ac: 4, tier: 2 },
  helm2:   { name: '가죽 투구',       slot: 'helm',   ac: 2, tier: 2 },
  cloak2:  { name: '대나무 무늬 망토', slot: 'cloak', ac: 1, tier: 2 },
  glove2:  { name: '가죽 장갑',       slot: 'glove',  ac: 1, tier: 2 },
  boots2:  { name: '남색 고무신',     slot: 'boots',  ac: 1, tier: 2 },
  shield2: { name: '대나무 방패',     slot: 'shield', ac: 2, tier: 2, blk: 15 },
  helm3:   { name: '해골 투구',       slot: 'helm',   ac: 3, tier: 3, set: 'jeo' },   // 저승 세트 (안개 늪)
  armor3:  { name: '해골 갑옷',       slot: 'armor',  ac: 6, tier: 3, set: 'jeo' },
  cloak3:  { name: '저승 망토',       slot: 'cloak',  ac: 2, tier: 3, set: 'jeo' },
  glove3:  { name: '뼈마디 장갑',     slot: 'glove',  ac: 2, tier: 3, set: 'jeo' },
  boots3:  { name: '저승 짚신',       slot: 'boots',  ac: 2, tier: 3, set: 'jeo' },
  shield3: { name: '해골 방패',       slot: 'shield', ac: 3, tier: 3, blk: 20 },   // 세트에는 안 들어가요
};
// 장신구: 직업마다 목걸이·반지 하나씩 (모두 8개). 강화할 수 없고, 어느 우두머리든 적은 확률로 떨어뜨려요 (창고로 다른 캐릭터에게 줄 수 있어요)
// 능력: str·dex·con, hit(명중 %), crit(치명타 %), dmg(데미지 +), regen(회복 +), ac(방어도)
const ACCS = {
  neck_sword: { name: '용맹의 목걸이',   slot: 'neck', cls: 'sword', tier: 2, str: 1, dmg: 1 },
  ring_sword: { name: '검사의 반지',     slot: 'ring', cls: 'sword', tier: 2, crit: 4, hit: 3 },
  neck_bow:   { name: '매눈 목걸이',     slot: 'neck', cls: 'bow',   tier: 2, hit: 8 },
  ring_bow:   { name: '궁수의 반지',     slot: 'ring', cls: 'bow',   tier: 2, dex: 1, crit: 3 },
  neck_mage:  { name: '별빛 목걸이',     slot: 'neck', cls: 'mage',  tier: 2, dmg: 2 },
  ring_mage:  { name: '지혜의 반지',     slot: 'ring', cls: 'mage',  tier: 2, hit: 5, regen: 2 },
  neck_tank:  { name: '든든 목걸이',     slot: 'neck', cls: 'tank',  tier: 2, ac: 2 },
  ring_tank:  { name: '분노의 반지',     slot: 'ring', cls: 'tank',  tier: 2, con: 1, regen: 3 },
};
const CLS_NAME = { sword: '검사', bow: '궁수', mage: '마법사', tank: '전사' };
// 검사 스킬 (용기 사용, 레벨이 되면 하나씩 열려요). 용기: 때리면 +5, 치명타 +10, 맞으면 +3, 싸움이 끝나면 1초에 3씩 줄어요
const COURAGE = { max: 100, hit: 5, crit: 10, hurt: 3, decay: 3 };
const SKILLS = { sword: [
  { k: 'q', name: '힘껏 베기', img: 'sk-sword-1', lv: 10, cost: 20, cd: 3, mult: 2, txt: '앞의 몬스터를 한 번 세게 베어요 (데미지 2배)' },
  { k: 'w', name: '돌려 베기', img: 'sk-sword-2', lv: 20, cost: 40, cd: 5, mult: 1.2, area: 1, txt: '둘레 한 칸의 몬스터를 모두 베어요 (데미지 1.2배)' },
  { k: 'e', name: '기합', img: 'sk-sword-3', lv: 30, cost: 30, cd: 30, rush: 10, txt: '10초 동안 공격이 빨라져요' },
  { k: 'r', name: '용기 폭발', img: 'sk-sword-4', lv: 40, cost: 100, cd: 20, mult: 4, txt: '용기를 모두 모아 큰 한 방 (데미지 4배)' },
],
  bow: [
  { k: 'q', name: '바람 화살', img: 'sk-bow-1', lv: 10, cost: 20, cd: 3, mult: 1.5, push: 1, txt: '세찬 바람 화살로 몬스터를 활이 닿는 끝까지 밀어내요 (데미지 1.5배, 우두머리는 안 밀려요)' },
  { k: 'w', name: '화살비', img: 'sk-bow-2', lv: 20, cost: 40, cd: 5, mult: 1.5, rain: 3, txt: '활이 닿는 둘레 몬스터 최대 3마리에게 하늘에서 화살이 쏟아져요 (데미지 1.5배)' },
  { k: 'e', name: '매의 눈', img: 'sk-bow-3', lv: 30, cost: 30, cd: 30, hawk: 10, crit: 20, txt: '10초 동안 치명타 확률 +20%' },
  { k: 'r', name: '천둥 화살', img: 'sk-bow-4', lv: 40, cost: 100, cd: 20, mult: 4, splash: 1, txt: '집중을 모두 모은 천둥 화살 (데미지 4배), 맞은 몬스터 둘레 한 칸도 절반 피해' },
] };
// 궁수 집중: 맞히면 +5, 치명타 +10, 가만히 서서 쏘면 두 배. 싸움이 끝나면 천천히 줄어요
const FOCUS = { hit: 5, crit: 10, still: 2 };
// 세트 효과: 같은 세트를 많이 입을수록 효과가 늘어요 (무기 포함 6개)
const SETS = { jeo: { name: '저승 세트', n: 6, fx: [[2, 'AC 1 좋아짐'], [4, '명중 +5%'], [6, '준 데미지의 10% 흡혈 + 푸른 안개']] } };
const ACC_DROP = 0.1;   // 우두머리를 잡으면 10% 확률로 8개 중 하나
const SLOTS = ['weapon', 'helm', 'armor', 'cloak', 'glove', 'boots', 'shield', 'neck', 'ring'];
const SLOT_NAME = { weapon: '무기', helm: '투구', armor: '갑옷', cloak: '망토', glove: '장갑', boots: '신발', shield: '방패', neck: '목걸이', ring: '반지' };

// 쌓이는 아이템
const ITEMS = {
  potion:  { name: '빨간 물약',       img: 'i-potion',  price: 15, sell: 3, heal: 40 },
  haste:   { name: '초록 물약',       img: 'i-haste',   price: 40, sell: 8, sec: 300 },   // 5분 동안 걷기·공격이 빨라져요
  ret:     { name: '마을 귀환 주문서', img: 'i-return',  price: 12, sell: 2 },              // 읽으면 마을로 돌아가요 (단축키 3)
  tele:    { name: '순간이동 주문서', img: 'i-teleport', price: 8, sell: 1 },              // 지금 있는 사냥터 안 아무 곳으로 (단축키 4)
  wscroll: { name: '무기 강화 부적',   img: 'i-wscroll', sell: 20 },
  ascroll: { name: '방어구 강화 부적', img: 'i-ascroll', sell: 15 },
};

// 강화 규칙: 무기 안전 +6·최대 +10, 방어구 안전 +4·최대 +7. 안전선을 넘으면 단계마다 성공 확률이 달라요(2026-11-28), 실패하면 사라짐
// rates[n] = +n으로 올라갈 확률. 무기는 +7부터 단계마다 명중 +3% (hitPer)
const ENCH = { w: { safe: 6, max: 10, rates: { 7: .4, 8: .25, 9: .15, 10: .1 }, hitPer: 3 }, a: { safe: 4, max: 7, rates: { 5: .4, 6: .3, 7: .25 } } };
const enchRate = (kind, en) => ENCH[kind].rates[en + 1] || 0;

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
  kdust:   { name: '먼지 대왕',     lv: 6,  hp: 250,  ac: 6,  dmg: [4, 7],   exp: 120,  h: 58, aggro: 1, step: .5, boss: 1 },
  tanuki2: { name: '둔갑 너구리',   lv: 17, hp: 1400, ac: -3, dmg: [11, 16], exp: 750,  h: 68, aggro: 1, step: .5, boss: 1 },
  bonepup: { name: '뼈다귀 강아지', lv: 20, hp: 170,  ac: -4, dmg: [10, 15], exp: 34,   h: 30,  aggro: 1, step: .4 },
  mongdal: { name: '몽달귀신',      lv: 22, hp: 200,  ac: -5, dmg: [11, 17], exp: 40,   h: 42,  aggro: 1, step: .5 },
  skel:    { name: '해골 병사',     lv: 24, hp: 240,  ac: -7, dmg: [13, 19], exp: 48,   h: 42,  aggro: 1, step: .5 },
  reaper:  { name: '저승사자',      lv: 28, hp: 4000, ac: -9, dmg: [20, 28], exp: 2500, h: 80, aggro: 1, step: .55, boss: 1 },
  general: { name: '대나무 장군',   lv: 22, hp: 2500, ac: -6, dmg: [15, 22], exp: 1500, h: 73, aggro: 1, step: .55, boss: 1 },
};

// 도깨비섬 (C안): 큰 섬 하나 + 가운데 남북 산맥. 서쪽에 마을·들판·논밭, 산맥 북쪽 고갯길을 넘으면 동쪽 대나무 골·깊은 대숲·안개 늪
// 좌표는 0~1 비율 (가로 w, 세로 h 칸). 바닥은 초록 계열로 통일하고 지역은 장식으로 구분해요
const WORLD = { w: 360, h: 270, town: [.28, .42], map: 'world-map' };   // 섬 모양·강은 전체 지도 그림(world-map)에서 읽어요
// tile: 바닥 그림, mons: [몬스터, 비율], count: 몬스터 수, at: 리스폰 지점(비율), seeds: 지역 씨앗(비율)
const ZONES = [
  { id: 'town', name: '도깨비 마을', lv: '', tile: 'tile-town', town: true, color: '#c99b5e' },
  { id: 'near', name: '마을 앞 들판', lv: '1~5', tile: 'tile-field', tier: 1, at: [.3, .27], seeds: [[.26, .22], [.4, .26]], count: 300, boss: 'kdust',
    mons: [['dust', 5], ['rat', 4]], drop: { w: .002, a: .004, gear: .004, coin: [1, 2] } },
  { id: 'paddy', name: '허수아비 논밭', lv: '5~10', tile: 'tile-field', tier: 1, at: [.24, .6], seeds: [[.18, .6], [.38, .74], [.42, .52]], count: 495, boss: 'kscare',
    mons: [['rat', 3], ['acorn', 6], ['scare', 3]], drop: { w: .003, a: .006, gear: .006, coin: [2, 4] } },
  { id: 'bamboo', name: '대나무 골', lv: '10~15', tile: 'tile-bamboo', tier: 2, at: [.7, .3], seeds: [[.76, .26], [.6, .18]], count: 340, boss: 'tanuki2',
    mons: [['shoot', 7], ['tanuki', 2]], drop: { w: .004, a: .008, gear: .004, coin: [3, 6] } },
  { id: 'deep', name: '깊은 대숲', lv: '15~20', tile: 'tile-deep', tier: 2, at: [.78, .52], seeds: [[.8, .54], [.64, .44]], count: 265, boss: 'general',
    mons: [['tanuki', 1], ['bghost', 4], ['broom', 4]], drop: { w: .006, a: .012, gear: .006, coin: [5, 9] } },
  { id: 'marsh', name: '안개 늪', lv: '20~25', tile: 'tile-marsh', tier: 3, at: [.66, .8], seeds: [[.68, .82]], count: 240, boss: 'reaper',
    mons: [['bonepup', 4], ['mongdal', 4], ['skel', 3]], drop: { w: .007, a: .014, gear: .007, wpn: .001, bossWpn: .15, coin: [6, 11] } },
  { id: 'mtn', name: '뿔바위 산맥', lv: '', tile: 'tile-rock', tier: 2 },
  { id: 'beach', name: '도깨비섬 바닷가', lv: '', tile: 'tile-sand', tier: 1 },
];
const ZONE = Object.fromEntries(ZONES.map(z => [z.id, z]));
// 산맥 등줄기, 고갯길, 던전 입구 (비율)
const ISLE = {
  ridge: [[.44, .08], [.46, .2], [.5, .3], [.52, .4], [.54, .5], [.555, .6], [.565, .72]],
  pass: [.5, .265],
  dungeon: [.5, .52],
};
// 마을 순간이동 문 목록 (아직 안 연 곳은 준비 중)
const REGIONS = [
  { id: 'town', name: '도깨비 마을', lv: '', open: true },
  { id: 'near', name: '마을 앞 들판', lv: '1~5', open: true },
  { id: 'paddy', name: '허수아비 논밭', lv: '5~10', open: true },
  { id: 'bamboo', name: '대나무 골', lv: '10~15', open: true },
  { id: 'deep', name: '깊은 대숲', lv: '15~20', open: true },
  { id: 'marsh', name: '안개 늪', lv: '20~25', open: true },
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
  'l-bridge': { w: 250, fw: 0, fh: 0, flat: 1 }, 'l-bridge2': { w: 300, fw: 0, fh: 0, flat: 1 }, 'mt-peak1': { w: 300, fw: 4, fh: 2 }, 'mt-peak2': { w: 300, fw: 4, fh: 1 }, 'mt-cliff': { w: 250, fw: 4, fh: 1 }, 'mt-pass': { w: 330, fw: 0, fh: 0 }, 'mt-dungeon': { w: 250, fw: 4, fh: 2 }, 'l-cliff': { w: 170, fw: 3, fh: 1 }, 'l-wall': { w: 84, fw: 2, fh: 1 },
  'l-sign': { w: 44, fw: 1, fh: 1 }, 'l-stones': { w: 215, fw: 0, fh: 0, flat: 1 }, 'l-pine': { w: 170, fw: 2, fh: 1, sx: 0.82 },
  'l-pavilion': { w: 200, fw: 3, fh: 2 }, 'l-reed': { w: 58, fw: 1, fh: 1, sx: 0.7 },
};

// 레벨업에 필요한 경험치 (레벨³, 처음 두 단계는 10)
const needExp = lv => Math.max(10, lv * lv * lv);
const MAX_LV = 50;
