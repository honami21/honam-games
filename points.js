/* 포인트 공용 도우미 (로그인 없이 이 기기에만 저장)
   - 포인트 주는 게임(EARN: 맞춤법, 영어 타자, 국기, 블록 쌓기)을 끝까지 해서 끝나면 1점 (2026-11-25 사용자 결정)
   - 하루에 모을 수 있는 포인트는 4점까지, 한 번 받으면 1분 뒤에 다시 받을 수 있음
   - 한 게임에서는 하루에 1점만 (게임 폴더 이름으로 구분)
   - 한국 시간 자정이 지나면 0점으로 돌아감
   - 도깨비숲 생존기 한 판에 COST점을 씀 (생존기 엽전과는 따로)
   - 관리자 모드에서 이 기기에 포인트를 줄 수 있음 (give) */
(function () {
  var KEY = 'kpoint', CAP = 4, GAP = 60 * 1000;
  var base = (function () {
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/points\.js(\?.*)?$/, '') : '/';
  })();
  var seen = {};
  var EARN = ['spelling', 'typing', 'flags', 'tetris'];   // 포인트를 주는 게임 폴더

  // 한국 시간 기준 날짜 (예: 2026-11-24)
  function today() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); }
  function load() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!d || d.d !== today()) d = { d: today(), p: 0, e: 0, t: 0, g: [] };
    if (!d.g) d.g = [];
    if (d.t > Date.now()) d.t = 0;   // 기기 시계가 되돌아간 경우
    return d;
  }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }

  function info() {
    var d = load();
    return { pts: d.p, earned: d.e, cap: CAP, wait: Math.max(0, d.t + GAP - Date.now()) };
  }

  // 화면 아래 가운데에 잠깐 뜨는 알림
  var box = null, timer = 0;
  function toast(html) {
    if (!box) {
      var st = document.createElement('style');
      st.textContent = '.kpt-toast{position:fixed;left:50%;bottom:22px;z-index:9999;transform:translate(-50%,30px);opacity:0;transition:transform .3s,opacity .3s;pointer-events:none;' +
        'display:flex;align-items:center;gap:10px;max-width:calc(100% - 32px);font-family:Jua,sans-serif;font-size:20px;color:#2c2950;background:#fff6e4;border:3px solid #3a2b33;border-radius:999px;padding:8px 22px 6px 10px;' +
        'box-shadow:0 10px 24px rgba(10,8,40,.4);word-break:keep-all;text-align:left;line-height:1.3}' +
        '.kpt-toast.on{transform:translate(-50%,0);opacity:1}' +
        '.kpt-toast img{width:40px;height:40px;flex:none}' +
        '.kpt-toast b{font-weight:normal;color:#e0523f}' +
        '@media (max-width:760px),(max-height:500px){.kpt-toast{font-size:15px;bottom:12px;padding:6px 16px 4px 8px}.kpt-toast img{width:30px;height:30px}}';
      document.head.appendChild(st);
      box = document.createElement('div'); box.className = 'kpt-toast'; box.setAttribute('role', 'status');
      document.body.appendChild(box);
    }
    box.innerHTML = '<img src="' + base + 'img/point.png" alt="" onerror="this.remove()"><span>' + html + '</span>';
    clearTimeout(timer);
    requestAnimationFrame(function () { box.classList.add('on'); });
    timer = setTimeout(function () { box.classList.remove('on'); }, 4000);
  }

  window.KPOINT = {
    CAP: CAP,
    COST: 1,   // 도깨비숲 생존기 한 판에 쓰는 포인트 (다른 게임 1판 = 생존기 1판)
    info: info,
    // 게임 한 판이 끝까지 끝났을 때 부름. key는 같은 판이 두 번 세지지 않게 하는 이름.
    earn: function (key) {
      var game = (location.pathname.match(/([^\/]+)\/(index\.html)?$/) || [])[1] || 'home';
      if (EARN.indexOf(game) < 0) return 'off';
      if (key) { if (seen[key]) return 'dup'; seen[key] = 1; }
      var d = load(), now = Date.now();
      if (d.e >= CAP) { toast('오늘 모을 수 있는 포인트 ' + CAP + '점을 다 모았어요'); return 'cap'; }
      if (d.g.indexOf(game) >= 0) { toast('이 게임은 오늘 포인트를 받았어요. +1 포인트 표시가 있는 다른 게임을 끝까지 해 보세요'); return 'game'; }
      if (now - d.t < GAP) {
        var s = Math.ceil((d.t + GAP - now) / 1000);
        toast('포인트는 <b>' + s + '초</b> 뒤에 끝난 게임부터 다시 받아요');
        return 'wait';
      }
      d.p += 1; d.e += 1; d.t = now; d.g.push(game); save(d);
      toast('<b>+1 포인트!</b> 내 포인트 ' + d.p + '점 (오늘 ' + d.e + '/' + CAP + ')');
      return 'ok';
    },
    // 포인트 쓰기. 모자라면 false
    spend: function (n) {
      var d = load();
      if (d.p < n) return false;
      d.p -= n; save(d); return true;
    },
    // 관리자가 이 기기에 포인트 주기(빼기는 음수). 하루 상한(오늘 모은 점수)에는 세지 않음
    give: function (n) {
      var d = load(); d.p = Math.max(0, d.p + (n | 0)); save(d); return d.p;
    },
    toast: toast
  };
})();
