// 깨비샘과 쉬는 시간 · 저작권 표시 (모든 게임 공용)
// 메뉴가 보이면 맨 아래 가운데에, 게임 중에는 버튼·보드와 겹치지 않는 빈자리(쉬는 시간 버튼 옆, 아래 가운데, 아래 양쪽 끝, 위 가운데 순)를 찾아 작게 보여요.
// 메뉴가 길어서 스크롤되면 화면에 고정하지 않고 메뉴 맨 끝에 붙여요. 밝은 안내 화면에는 data-credit="light"를 붙이면 글자색이 어두워져요.
(() => {
  const me = document.currentScript;
  const SCOPES = '[data-keynav], .screen, .modal, #overlay, .ov, #title, [data-credit="light"]';
  const css = document.createElement('style');
  css.textContent = '#kcredit{position:fixed;left:0;right:0;bottom:calc(3px + env(safe-area-inset-bottom,0px));z-index:2147483000;text-align:center;font:600 14px/1.2 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;letter-spacing:.02em;color:rgba(255,248,232,.72);text-shadow:0 1px 2px rgba(10,8,40,.85);pointer-events:none;user-select:none;display:none}'
    + '#kcredit.on{display:block}#kcredit.inline{position:static;flex:none;width:100%;align-self:stretch;padding:14px 0 calc(6px + env(safe-area-inset-bottom,0px));margin:0}'
    + '#kcredit.play{right:auto;bottom:auto;text-align:left;white-space:nowrap;font-size:10px;color:rgba(255,248,232,.6)}#kcredit.light{color:rgba(60,50,90,.55);text-shadow:none}@media print{#kcredit{display:none!important}}';
  document.head.appendChild(css);
  const el = document.createElement('div');
  el.id = 'kcredit'; el.setAttribute('aria-hidden', 'true'); el.textContent = '© 깨비샘';
  const shown = n => {
    if (n.checkVisibility) { if (!n.checkVisibility({ checkOpacity:true, checkVisibilityCSS:true })) return false; }
    else if (getComputedStyle(n).display === 'none') return false;
    const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  };
  const scrolls = n => { const o = getComputedStyle(n).overflowY; return (o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight + 2; };
  const tick = () => {
    const list = [...document.querySelectorAll(SCOPES)].filter(n => n !== el && n.dataset.credit !== 'off' && shown(n));
    const top = list.find(n => n.dataset.credit === 'light') || list.filter(n => n.classList.contains('modal')).pop() || list[list.length - 1];
    if (!top) { play(); return; }
    mode = '';
    let host = document.body;
    const scroller = list.find(scrolls);
    if (scroller && top.dataset.credit !== 'light') {    // 스크롤되는 메뉴: 화면에 고정하지 않고 메뉴 맨 끝에 붙임 (그 위에 작은 창이 떠도 그대로)
      host = scroller;
      const kids = [...scroller.children].filter(n => n !== el && shown(n));
      if (getComputedStyle(scroller).display.includes('flex') && getComputedStyle(scroller).flexDirection.startsWith('row') && kids.length === 1) host = kids[0];
    }
    if (el.parentNode !== host) host.appendChild(el);
    el.style.left = el.style.top = el.style.visibility = '';
    el.className = 'on' + (host !== document.body ? ' inline' : '') + (top.dataset.credit === 'light' ? ' light' : '');
  };
  // 게임 중: 빈자리 찾기
  let mode = '', spot = -1, lastW = 0, lastH = 0, lastCheck = 0;
  const bgLike = n => { const r = n.getBoundingClientRect(); return r.width >= innerWidth * .85 && r.height >= innerHeight * .85; };
  const visual = n => {                                    // 눈에 보이는 무언가가 있는 요소인지
    let op = 1; for (let a = n; a && a.nodeType === 1; a = a.parentElement) op *= +getComputedStyle(a).opacity;
    if (op < .3) return false;                             // 아주 흐린 배경 장식은 괜찮음
    const c = getComputedStyle(n);
    if (/^(IMG|CANVAS|SVG|VIDEO|BUTTON|INPUT|SELECT|TEXTAREA|svg)$/.test(n.tagName)) return true;
    if (c.backgroundImage !== 'none' || !/rgba\(.*,\s*0\)|transparent/.test(c.backgroundColor) || c.boxShadow !== 'none') return true;
    if (parseFloat(c.borderTopWidth) || parseFloat(c.borderBottomWidth) || parseFloat(c.borderLeftWidth)) return true;
    return [...n.childNodes].some(t => t.nodeType === 3 && t.textContent.trim());
  };
  const free = () => {
    const r = el.getBoundingClientRect();
    if (r.left < 2 || r.top < 0 || r.right > innerWidth - 2 || r.bottom > innerHeight) return false;
    pe.disabled = false;                                   // 클릭이 안 되는 글자 상자도 겹침으로 셈
    try { return hit(r); } finally { pe.disabled = true; }
  };
  const pe = document.createElement('style'); pe.textContent = 'body *:not(#kcredit){pointer-events:auto !important}';
  document.head.appendChild(pe); pe.disabled = true;
  const hit = r => {
    const pts = [[r.left + 1, r.top + 1], [r.right - 1, r.top + 1], [r.left + 1, r.bottom - 1], [r.right - 1, r.bottom - 1], [(r.left + r.right) / 2, (r.top + r.bottom) / 2]];
    for (const [x, y] of pts) for (const n of document.elementsFromPoint(x, y)) {
      if (n === el || n === document.body || n === document.documentElement) continue;
      if (bgLike(n) || !visual(n)) continue;              // 화면 전체 배경이나 투명한 묶음 상자는 괜찮음
      return false;
    }
    return true;
  };
  // 화면 전체가 그림판(canvas)인 게임은 그 안의 글자를 알 수 없으니 <script src="../credit.js" data-spots="top bottom">처럼 자리 순서를 정해 줘요.
  const ORDER = { home:0, bottom:1, left:2, right:3, top:4, q1:5, q3:6 };
  const want = ((me && me.dataset.spots) || 'home bottom left right top').split(/\s+/).map(k => ORDER[k]).filter(i => i >= 0);
  const SPOTS = [
    () => { const b = document.getElementById('home-link'); if (!b || !shown(b)) return null; const r = b.getBoundingClientRect(); return { left:r.right + 8, top:r.top + r.height / 2 - el.offsetHeight / 2 }; },
    () => ({ left:innerWidth / 2 - el.offsetWidth / 2, top:innerHeight - el.offsetHeight - 3 }),
    () => ({ left:8, top:innerHeight - el.offsetHeight - 3 }),
    () => ({ left:innerWidth - el.offsetWidth - 8, top:innerHeight - el.offsetHeight - 3 }),
    () => ({ left:innerWidth / 2 - el.offsetWidth / 2, top:3 }),
    () => ({ left:innerWidth * .3 - el.offsetWidth / 2, top:innerHeight - el.offsetHeight - 3 }),
    () => ({ left:innerWidth * .7 - el.offsetWidth / 2, top:innerHeight - el.offsetHeight - 3 }),
  ];
  const put = p => { el.style.left = Math.round(p.left) + 'px'; el.style.top = Math.round(p.top) + 'px'; };
  function play() {
    if (el.parentNode !== document.body) document.body.appendChild(el);
    if (mode !== 'play') { el.className = 'on play'; el.style.visibility = 'hidden'; mode = 'play'; spot = -1; }
    const now = Date.now();
    if (spot >= 0 && innerWidth === lastW && innerHeight === lastH && now - lastCheck < 3000) return;
    lastW = innerWidth; lastH = innerHeight; lastCheck = now;
    if (spot >= 0) { const p = SPOTS[spot](); if (p) { put(p); if (free()) return; } }   // 지금 자리가 그대로 비어 있으면 유지
    el.style.visibility = 'hidden';
    for (const i of want) { const p = SPOTS[i](); if (!p) continue; put(p); if (free()) { spot = i; el.style.visibility = ''; return; } }
    spot = -1;                                             // 빈자리가 없으면 숨김
  }
  const start = () => { tick(); setInterval(tick, 500); };
  if (document.body) start(); else addEventListener('DOMContentLoaded', start);
})();
