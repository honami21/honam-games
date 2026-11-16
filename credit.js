// 꼬비샘과 쉬는 시간 · 저작권 표시 (모든 게임 공용)
// 첫 화면·설정 창·결과 창처럼 메뉴가 보일 때만 맨 아래에 작게 보여요. 게임 중에는 숨겨서 버튼과 겹치지 않아요.
// 메뉴가 길어서 스크롤되면 화면에 고정하지 않고 메뉴 맨 끝에 붙여요. 밝은 안내 화면에는 data-credit="light"를 붙이면 글자색이 어두워져요.
(() => {
  const SCOPES = '[data-keynav], .screen, .modal, #overlay, .ov, #title, [data-credit="light"]';
  const css = document.createElement('style');
  css.textContent = '#kcredit{position:fixed;left:0;right:0;bottom:calc(3px + env(safe-area-inset-bottom,0px));z-index:2147483000;text-align:center;font:600 11px/1.2 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;letter-spacing:.02em;color:rgba(255,248,232,.72);text-shadow:0 1px 2px rgba(10,8,40,.85);pointer-events:none;user-select:none;display:none}'
    + '#kcredit.on{display:block}#kcredit.inline{position:static;flex:none;width:100%;align-self:stretch;padding:14px 0 calc(6px + env(safe-area-inset-bottom,0px));margin:0}'
    + '#kcredit.light{color:rgba(60,50,90,.55);text-shadow:none}@media print{#kcredit{display:none!important}}';
  document.head.appendChild(css);
  const el = document.createElement('div');
  el.id = 'kcredit'; el.setAttribute('aria-hidden', 'true'); el.textContent = '© 꼬비샘';
  const shown = n => {
    if (n.checkVisibility) { if (!n.checkVisibility({ checkOpacity:true, checkVisibilityCSS:true })) return false; }
    else if (getComputedStyle(n).display === 'none') return false;
    const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  };
  const scrolls = n => { const o = getComputedStyle(n).overflowY; return (o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight + 2; };
  const tick = () => {
    const list = [...document.querySelectorAll(SCOPES)].filter(n => n !== el && n.dataset.credit !== 'off' && shown(n));
    const top = list.find(n => n.dataset.credit === 'light') || list.filter(n => n.classList.contains('modal')).pop() || list[list.length - 1];
    if (!top) { el.className = ''; return; }
    let host = document.body;
    const scroller = list.find(scrolls);
    if (scroller && top.dataset.credit !== 'light') {    // 스크롤되는 메뉴: 화면에 고정하지 않고 메뉴 맨 끝에 붙임 (그 위에 작은 창이 떠도 그대로)
      host = scroller;
      const kids = [...scroller.children].filter(n => n !== el && shown(n));
      if (getComputedStyle(scroller).display.includes('flex') && getComputedStyle(scroller).flexDirection.startsWith('row') && kids.length === 1) host = kids[0];
    }
    if (el.parentNode !== host) host.appendChild(el);
    el.className = 'on' + (host !== document.body ? ' inline' : '') + (top.dataset.credit === 'light' ? ' light' : '');
  };
  const start = () => { tick(); setInterval(tick, 500); };
  if (document.body) start(); else addEventListener('DOMContentLoaded', start);
})();
