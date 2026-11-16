// 꼬비샘과 쉬는 시간: 게임 공용 배경 음악
// 사용법: KBGM.init({ key:'tetris', tracks:{ play:'audio/bgm-play.mp3' } })
//   KBGM.full()   게임 중 (원래 크기)
//   KBGM.calm()   시작 화면, 일시정지, 결과 화면 (작게)
//   KBGM.track(n) 다른 곡으로 바꾸기 (천천히 넘어감)
//   KBGM.jingle() 게임이 끝났을 때 짧은 축하 음악
//   KBGM.button({ after: 원래 소리 버튼, long: true/false })  누르면 음악 켜기/끄기
(function () {
  'use strict';
  var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var put = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var here = (document.currentScript && document.currentScript.src) || '/audio/bgm.js';
  var JINGLE = here.replace(/bgm\.js(\?.*)?$/, 'jingle-win.mp3');

  var B = window.KBGM = {
    key: 'kbgm', tracks: {}, els: {}, cur: null, vol: 0.35, on: true,
    duck: 0.5, duckGoal: 0.5, calmLevel: 0.5, jingleEl: null, jingleOn: false,
    unlocked: false, buttons: []
  };

  B.init = function (o) {
    B.key = o.key || 'kbgm';
    B.tracks = o.tracks || {};
    B.cur = o.start || Object.keys(B.tracks)[0] || null;
    B.calmLevel = o.calm != null ? o.calm : 0.5;
    B.duck = B.duckGoal = B.calmLevel;
    var v = get(B.key + '-music'), on = get(B.key + '-music-on');
    B.vol = v !== null && !isNaN(+v) ? clamp(+v, 0, 1) : (o.vol != null ? o.vol : 0.35);
    B.on = on === null ? o.defaultOn !== false : on === 'on';
    var unlock = function () { B.unlocked = true; B.kick(); };
    ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(function (t) { window.addEventListener(t, unlock, true); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { for (var k in B.els) B.els[k].pause(); if (B.jingleEl) B.jingleEl.pause(); }
      else B.kick();
    });
    setInterval(tick, 50);
    return B;
  };

  function el(name) {
    var a = B.els[name];
    if (!a && B.tracks[name]) {
      a = B.els[name] = new Audio(B.tracks[name]);
      a.loop = true; a.preload = 'auto'; a.volume = 0; a._g = 0;
    }
    return a;
  }
  B.allow = function () { return true; };
  function audible() { return B.on && B.vol > 0 && !document.hidden && B.unlocked && B.allow(); }

  // 지금 들려야 하는 곡을 재생 (브라우저가 막으면 다음 클릭 때 다시)
  B.kick = function () {
    if (!audible()) return;
    if (B.jingleOn && B.jingleEl && B.jingleEl.paused) { var pj = B.jingleEl.play(); if (pj && pj.catch) pj.catch(function () {}); }
    var a = B.cur && el(B.cur);
    if (a && a.paused) { var p = a.play(); if (p && p.catch) p.catch(function () {}); }
  };

  var last = performance.now();
  function tick() {
    var now = performance.now(), dt = Math.min(0.2, (now - last) / 1000); last = now;
    var on = audible();
    B.duck += clamp(B.duckGoal - B.duck, -dt * 1.2, dt * 1.2);
    var hush = B.jingleOn ? 0 : 1;
    for (var k in B.els) {
      var a = B.els[k], goal = (on && k === B.cur) ? hush : 0;
      a._g = clamp(a._g + (goal > a._g ? 1 : -1) * dt * (goal > a._g ? 0.8 : 1.6), 0, 1);
      a.volume = clamp(a._g * B.vol * B.duck, 0, 1);
      if (a._g === 0 && !a.paused) a.pause();
    }
    if (B.jingleEl) {
      var j = B.jingleEl;
      if (!B.jingleOn || !on) { j._g = clamp(j._g - dt * 1.5, 0, 1); if (j._g === 0 && !j.paused) { j.pause(); if (!B.jingleOn) j.currentTime = 0; } }
      j.volume = clamp(j._g * B.vol * 0.9, 0, 1);
    }
    if (on && B.cur && !B.jingleOn) { var c = el(B.cur); if (c && c.paused) B.kick(); }
  }

  B.full = function () { B.duckGoal = 1; B.stopJingle(); B.kick(); };
  B.calm = function () { B.duckGoal = B.calmLevel; B.kick(); };
  B.track = function (name, restart) {
    if (!B.tracks[name]) return;
    if (name !== B.cur) {
      var a = el(name);
      if (restart !== false && a._g === 0) { try { a.currentTime = 0; } catch (e) {} }
      B.cur = name;
    }
    B.kick();
  };
  B.jingle = function () {
    B.duckGoal = B.calmLevel;
    if (!audible()) return;
    var j = B.jingleEl;
    if (!j) {
      j = B.jingleEl = new Audio(JINGLE); j.preload = 'auto'; j._g = 1;
      j.addEventListener('ended', function () { B.jingleOn = false; });
    }
    try { j.currentTime = 0; } catch (e) {}
    j._g = 1; j.volume = clamp(B.vol * 0.9, 0, 1);
    B.jingleOn = true;
    var p = j.play(); if (p && p.catch) p.catch(function () { B.jingleOn = false; });
  };
  B.stopJingle = function () { B.jingleOn = false; };

  function save() { put(B.key + '-music', B.vol); put(B.key + '-music-on', B.on ? 'on' : 'off'); }
  B.setOn = function (v) { B.on = !!v; if (B.on && B.vol <= 0) B.vol = 0.35; save(); refresh(); B.kick(); };
  B.setVol = function (v) { B.vol = clamp(v, 0, 1); B.on = B.vol > 0; save(); refresh(); B.kick(); };

  // ── 음악 버튼: 누를 때마다 켜기/끄기 ──
  var css = document.createElement('style');
  css.textContent =
    '.kbgm-btn.muted{opacity:.6}' +
    '@media (max-width:760px),(pointer:coarse){.kbgm-l{display:none}}';
  document.head.appendChild(css);

  function refresh() {
    var shown = B.on && B.vol > 0;
    B.buttons.forEach(function (b) {
      if (b.long) b.el.innerHTML = '🎵<span class="kbgm-l">' + (shown ? ' 음악 ON' : ' 음악 OFF') + '</span>';
      else b.el.textContent = '🎵';
      b.el.classList.toggle('muted', !shown);
      b.el.title = shown ? '배경 음악 켜짐 (누르면 꺼요)' : '배경 음악 꺼짐 (누르면 켜요)';
      b.el.setAttribute('aria-pressed', shown ? 'true' : 'false');
    });
  }
  B.button = function (o) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = (o.className != null ? o.className : (o.after ? o.after.className.replace(/\bmuted\b/g, '') : '')) + ' kbgm-btn';
    b.setAttribute('aria-label', '배경 음악 켜기/끄기');
    if (o.id) b.id = o.id;
    if (o.after) o.after.parentNode.insertBefore(b, o.after.nextSibling);
    else if (o.parent) o.parent.appendChild(b);
    B.buttons.push({ el: b, long: !!o.long });
    ['pointerdown', 'mousedown', 'touchstart'].forEach(function (t) { b.addEventListener(t, function (e) { e.stopPropagation(); }); });
    b.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault();
      B.setOn(!(B.on && B.vol > 0));
      b.blur();
    });
    refresh();
    return b;
  };
})();
