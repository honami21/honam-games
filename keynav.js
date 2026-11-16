// 꼬비샘과 쉬는 시간 · 메뉴 화면 키보드 조작 (모든 게임 공용)
// 방향키로 버튼을 고르고, 엔터나 스페이스로 눌러요.
// 첫 화면·설정 창·결과 창처럼 메뉴가 보일 때만 움직이고, 게임 중에는 아무것도 하지 않아요.
(() => {
  const SCOPES = '[data-keynav], .screen, .modal, #overlay, .ov, #title';
  const ITEMS = 'button, a[href], [role="button"], label:has(input[type="checkbox"]), label:has(input[type="radio"]), input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea';
  const css = document.createElement('style');
  css.textContent = '.kn-focus{outline:3px solid #ff5f6d !important;outline-offset:3px !important;position:relative;z-index:1}';
  document.head.appendChild(css);

  const shown = el => {
    if (!el || !el.isConnected) return false;
    if (el.checkVisibility) { if (!el.checkVisibility({ checkOpacity:true, checkVisibilityCSS:true })) return false; }
    else { for (let e = el; e && e !== document; e = e.parentNode) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false; } }
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  };
  function scope() {   // 지금 보이는 메뉴 중 맨 위에 있는 것 (창이 메뉴보다 먼저)
    if ([...document.querySelectorAll('[data-keynav="off"]')].some(shown)) return null;   // 자기 단축키가 있는 창이 열려 있으면 그 창에 맡겨요
    const list = [...document.querySelectorAll(SCOPES)].filter(el => el.dataset.keynav !== 'off' && !el.closest('[data-keynav="off"]') && shown(el));
    if (!list.length) return null;
    const modals = list.filter(el => el.classList.contains('modal') || el.dataset.keynav === 'modal');
    return (modals.length ? modals : list).pop();
  }
  const items = sc => [...sc.querySelectorAll(ITEMS)].filter(el => !el.disabled && !el.closest('[data-keynav="off"]') && shown(el));
  let cur = null;
  const fixed = el => { for (let e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return true; return false; };
  const mid = r => ({ x:r.left + r.width / 2, y:r.top + r.height / 2 });
  function pick(list, dir) {
    if (!cur || !list.includes(cur)) return list.find(el => !fixed(el)) || list[0];   // 처음엔 화면 위 고정 버튼(음악 등)이 아닌 것부터
    const a = mid(cur.getBoundingClientRect());
    let best = null, bs = Infinity;
    for (const el of list) {
      if (el === cur) continue;
      const b = mid(el.getBoundingClientRect()), dx = b.x - a.x, dy = b.y - a.y;
      const main = dir === 'down' ? dy : dir === 'up' ? -dy : dir === 'right' ? dx : -dx, side = dir === 'down' || dir === 'up' ? Math.abs(dx) : Math.abs(dy);
      if (main <= 4) continue;
      const s = main + side * 2.5;
      if (s < bs) { bs = s; best = el; }
    }
    if (best) return best;
    const i = list.indexOf(cur), j = dir === 'down' || dir === 'right' ? i + 1 : i - 1;   // 그 방향에 없으면 순서대로
    return list[j] || cur;
  }
  function mark(el) {
    if (cur) cur.classList.remove('kn-focus');
    cur = el; if (!el) return;
    el.classList.add('kn-focus');
    if (el.matches('input, select, textarea')) el.focus({ preventScroll:true });
    else if (document.activeElement && document.activeElement.matches && document.activeElement.matches('input, select, textarea')) document.activeElement.blur();
    el.scrollIntoView({ block:'nearest', inline:'nearest' });
  }
  const DIRS = { arrowdown:'down', arrowup:'up', arrowright:'right', arrowleft:'left' };
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase(), dir = DIRS[k];
    if (!dir && k !== 'enter' && k !== ' ') return;
    const sc = scope(); if (!sc) { if (cur) mark(null); return; }
    const t = e.target, typing = t && t.matches && t.matches('input:not([type="checkbox"]):not([type="radio"]), textarea, select');
    if (typing && (dir === 'left' || dir === 'right' || k === ' ' || k === 'enter')) return;   // 글자 입력 칸 안에서는 원래대로
    const list = items(sc); if (!list.length) return;
    if (dir) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat && !cur) return;
      mark(pick(list, dir)); return;
    }
    if (!cur || !list.includes(cur) || e.repeat) return;   // 방향키로 고른 게 없으면 게임의 원래 엔터·스페이스 그대로
    e.preventDefault(); e.stopImmediatePropagation();
    const el = cur; el.click();
    setTimeout(() => { if (cur === el && !shown(el)) mark(null); }, 0);
  }, true);
  addEventListener('pointerdown', () => { if (cur) mark(null); }, true);   // 마우스나 손가락을 쓰면 표시를 지워요
})();
