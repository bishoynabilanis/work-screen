/* IDEA49-BEGIN. Battery and heat saving. (1) While the tab is hidden or the screen is locked, every repeating timer is stopped; when the tab is visible again each one runs once straight away (this is the one immediate refresh) and then resumes. (2) If the device reports a battery under 20% and not charging, low-power mode switches on by itself (low 3D quality, about 30 frames a second, CSS animations off) and switches off when charging or above 20%. getBattery is missing on iPhone: ignored silently. No network, no storage, no tracking. */
(function (win, doc, nav) {
  'use strict';
  var BAD = !!win.__WSPOWER_BAD;
  var realSet = win.setInterval.bind(win), realClear = win.clearInterval.bind(win);
  var reg = {}, nextId = 1000000, hidden = !!doc.hidden;
  function arm(id) { var t = reg[id]; if (!t || t.real != null) { return; } t.real = realSet(function () { try { t.fn.apply(win, t.args); } catch (e) { /* keep the other timers alive */ } }, t.ms); }
  win.setInterval = function (fn, ms) {
    if (typeof fn !== 'function') { return realSet.apply(win, arguments); }
    var id = nextId++; reg[id] = { fn: fn, ms: ms, args: Array.prototype.slice.call(arguments, 2), real: null };
    if (!hidden) { arm(id); }
    return id;
  };
  win.clearInterval = function (id) {
    var t = reg[id];
    if (!t) { return realClear(id); }
    if (t.real != null) { realClear(t.real); }
    delete reg[id];
  };
  function onVis() {
    var h = !!doc.hidden;
    if (h === hidden) { return; }
    hidden = h;
    win.WSPower.paused = h;
    Object.keys(reg).forEach(function (k) {
      var t = reg[k]; if (!t) { return; }
      if (h) { if (!BAD && t.real != null) { realClear(t.real); t.real = null; } }
      else { if (t.real == null) { arm(k); } try { t.fn.apply(win, t.args); } catch (e) { /* optional */ } }
    });
  }
  var lowStyle = null;
  function setLow(on) {
    on = !!on; if (win.WSPower.low === on) { return; }
    win.WSPower.low = on;
    try { doc.documentElement.classList.toggle('ws-lowpower', on); } catch (e) { /* optional */ }
    if (on && !lowStyle && doc.head) { lowStyle = doc.createElement('style'); lowStyle.textContent = 'html.ws-lowpower *,html.ws-lowpower *::before,html.ws-lowpower *::after{animation:none !important;transition:none !important}'; doc.head.appendChild(lowStyle); }
    if (win.Office3D && typeof win.Office3D.setLowPower === 'function') { try { win.Office3D.setLowPower(on); } catch (e) { /* optional */ } }
  }
  win.WSPower = { low: false, paused: hidden, count: function () { return Object.keys(reg).length; } };
  doc.addEventListener('visibilitychange', onVis);
  try {
    if (nav && typeof nav.getBattery === 'function') {
      nav.getBattery().then(function (b) {
        function chk() { setLow(typeof b.level === 'number' && b.level < 0.2 && b.charging === false); }
        chk(); b.addEventListener('levelchange', chk); b.addEventListener('chargingchange', chk);
      }).catch(function () { /* ignore silently */ });
    }
  } catch (e) { /* ignore silently */ }
})(window, document, navigator);
/* IDEA49-END */
/* IDEA50-BEGIN. Deep-link view state. The page reads ?focus=&theme=&view= once on load and applies only values from fixed whitelists (focus: all, manager or a department id; theme: blue, gold, light; view: office, list, org, handoffs). Anything else is ignored and never written to the page. When the user changes focus, theme or view the address bar is updated with history.replaceState (no reload, no new history entry). A "copy this view link" button puts the current link on the clipboard. Local only: no network, no storage, no tracking. */
(function (win, doc, nav) {
  'use strict';
  var BAD = !!win.__WSDL_BAD;
  var FOCUS = ['all', 'manager', 'content', 'trend', 'video', 'jessica', 'seo', 'tools', 'mail', 'qa'];
  var THEMES = ['blue', 'gold', 'light'];
  var VIEWS = ['office', 'list', 'org', 'handoffs'];
  var LISTS = { focus: FOCUS, theme: THEMES, view: VIEWS };
  var KEYS = ['focus', 'theme', 'view'];
  function okVal(k, v) { return typeof v === 'string' && LISTS[k].indexOf(v) >= 0; }
  function parse(search) {
    var out = {}, q;
    try { q = new win.URLSearchParams(search); } catch (e) { return out; }
    KEYS.forEach(function (k) { var v = q.get(k); if (BAD ? v : okVal(k, v)) { out[k] = v; } });
    return out;
  }
  function build(st) {
    var p = [];
    KEYS.forEach(function (k) { if (st && okVal(k, st[k])) { p.push(k + '=' + st[k]); } });
    return p.length ? '?' + p.join('&') : '';
  }
  win.__dl = { parse: parse, build: build, FOCUS: FOCUS, THEMES: THEMES, VIEWS: VIEWS };
  if (!doc || !doc.addEventListener || !win.location) { return; }
  var state = {};
  function push() {
    try { if (win.history && win.history.replaceState) { win.history.replaceState(null, '', win.location.pathname + build(state) + (win.location.hash || '')); } } catch (e) { /* ignore */ }
  }
  function note(k, v) { if (okVal(k, v)) { state[k] = v; push(); } }
  win.__dlNote = note;
  function lv() { return doc.getElementById('listView'); }
  function linkNow() {
    var l = lv(), th = 'blue';
    try { if (win.__wsTheme) { th = win.__wsTheme.get(); } } catch (e) { /* ignore */ }
    var st = { focus: state.focus, theme: th, view: state.view || (l && l.open ? 'list' : 'office') };
    return win.location.origin + win.location.pathname + build(st);
  }
  function copy(t, done) {
    function fb() { var ok = false; try { var ta = doc.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0;top:0;font-size:16px'; doc.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, 9999); ok = doc.execCommand('copy'); ta.remove(); } catch (e) { ok = false; } done(ok); }
    try { if (nav && nav.clipboard && nav.clipboard.writeText) { nav.clipboard.writeText(t).then(function () { done(true); }, fb); } else { fb(); } } catch (e) { fb(); }
  }
  function scrollTo(id) { var el = doc.getElementById(id); if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'start' }); } }
  function applyView(v) {
    var l = lv();
    if (v === 'office') { if (l) { l.open = false; } } else if (v === 'list') { if (l) { l.open = true; } setTimeout(function () { scrollTo('listView'); }, 600); }
    else if (v === 'org') { var n = 0, t = setInterval(function () { n++; if (doc.getElementById('orgView') || n > 20) { clearInterval(t); scrollTo('orgView'); } }, 400); }
    else if (v === 'handoffs') { setTimeout(function () { scrollTo('handoffsHeading'); }, 1200); }
  }
  function applyFocus(id) {
    var n = 0, t = setInterval(function () {
      n++;
      var ok = false; try { ok = !!(win.__o3Focus && win.__o3Focus(id)); } catch (e) { ok = false; }
      if (ok || n > 100) { clearInterval(t); }
      if (ok) { setTimeout(function () { try { win.__o3Focus(id); } catch (e) { /* ignore */ } }, 3500); }
    }, 600);
  }
  doc.addEventListener('DOMContentLoaded', function () {
    var host = doc.querySelector('.topbar-inner');
    if (host && !doc.getElementById('ws-link-btn')) {
      var b = doc.createElement('button');
      b.type = 'button'; b.id = 'ws-link-btn'; b.textContent = 'انسخ لينك العرض';
      b.setAttribute('aria-label', 'انسخ لينك العرض الحالي');
      var m = doc.createElement('span'); m.id = 'ws-link-msg'; m.setAttribute('role', 'status'); m.setAttribute('aria-live', 'polite');
      var tm = 0;
      b.addEventListener('click', function () {
        copy(linkNow(), function (ok) {
          m.textContent = ok ? '✓ اللينك اتنسخ' : 'مقدرتش أنسخ، انسخ اللينك من شريط العنوان';
          m.setAttribute('data-ok', ok ? '1' : '0');
          clearTimeout(tm); tm = setTimeout(function () { m.textContent = ''; m.removeAttribute('data-ok'); }, 3000);
        });
      });
      host.appendChild(b); host.appendChild(m);
    }
    var l = lv();
    if (l) { l.addEventListener('toggle', function () { note('view', l.open ? 'list' : 'office'); }); }
    var st = parse(win.location.search);
    if (st.theme) { state.theme = st.theme; }
    if (st.view) { state.view = st.view; }
    if (st.focus) { state.focus = st.focus; }
    if (st.theme && win.__wsTheme) { try { win.__wsTheme.set(st.theme); } catch (e) { /* ignore */ } }
    if (st.view) { applyView(st.view); }
    if (st.focus) { applyFocus(st.focus); }
  });
})(window, document, navigator);
/* IDEA50-END */
(function () {
  'use strict';

  var FEED_URL = 'feed.json';
  var POLL_MS = 10000;
  var TICK_MS = 5000;
  var REQUEST_TIMEOUT_MS = 8000;
  var HANDOFF_WINDOW_MS = 3 * 60 * 1000;
  var PLAYED_STORAGE_KEY = 'office-played-handoffs-v1';
  var MANAGER_ID = '__manager__';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var STATE_LABEL = {
    running: 'شغّال',
    waiting: 'مستني',
    done: 'خلص',
    blocked: 'متعطل',
    unknown: 'غير معروف'
  };

  var ROOM_ACCENTS = ['#f4511e', '#e8893a', '#d9a441', '#c46b8a', '#8a7bd8', '#35c6b4'];
  var QA_ACCENT = '#35c6b4';

  var els = {};
  var currentFeed = null;
  var staffById = new Map();
  var deptNameById = new Map();
  var deskByStaff = new Map();
  var roomByDept = new Map();
  var managerDesk = null;
  var sceneSignature = '';
  var lastHandoffs = [];
  var lastFeedUpdated = null;
  var lastSuccessAt = 0;
  var networkFailed = false;
  var refreshing = false;
  var openSheetId = null;
  var lastFocused = null;
  var sheetCloseTimer = 0;

  var played = loadPlayed();
  var queued = new Set();
  var handoffQueue = [];
  var handoffBusy = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function isObj(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function make(tag, cls) {
    var node = document.createElement(tag);
    if (cls) {
      node.className = cls;
    }
    return node;
  }

  function clear(node) {
    if (!node) {
      return;
    }
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function safeText(value, fallback) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
    return fallback;
  }

  function toDate(value) {
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      return null;
    }
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  function cacheBusted(url) {
    var u = new URL(url, window.location.href);
    u.searchParams.set('t', String(Date.now()));
    return u.href;
  }

  function normalizeState(raw) {
    if (typeof raw !== 'string') {
      return 'unknown';
    }
    var s = raw.trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(STATE_LABEL, s)) {
      return s;
    }
    if (!s) {
      return 'unknown';
    }
    if (/شغ|بتشتغل|بتعمل|running|working|busy|active/.test(s)) {
      return 'running';
    }
    if (/مستن|منتظر|waiting|idle|pending/.test(s)) {
      return 'waiting';
    }
    if (/خلص|تم|done|complete|finish/.test(s)) {
      return 'done';
    }
    if (/متعطل|مشكل|blocked|error|stuck|fail/.test(s)) {
      return 'blocked';
    }
    return 'unknown';
  }

  function stateLabel(raw) {
    var key = normalizeState(raw);
    if (key !== 'unknown') {
      return STATE_LABEL[key];
    }
    return typeof raw === 'string' && raw.trim() ? raw : STATE_LABEL.unknown;
  }

  function arN(n, a) { return n === 1 ? a[0] : (n === 2 ? a[1] : n + ' ' + (n <= 10 ? a[2] : a[3])); }  /* Arabic counted nouns (Rule 110) */
  var A_TASK = ['مهمة', 'مهمتين', 'مهام', 'مهمة'], A_UPD = ['تحديث', 'تحديثين', 'تحديثات', 'تحديث'], A_EMP = ['موظف واحد', 'موظفين', 'موظفين', 'موظف'], A_JOB = ['شغلانة', 'شغلانتين', 'شغلانات', 'شغلانة'], A_MIN = ['دقيقة', 'دقيقتين', 'دقايق', 'دقيقة'];
  function minutesLabel(m) {
    if (m === 1) {
      return 'من دقيقة';
    }
    if (m === 2) {
      return 'من دقيقتين';
    }
    if (m <= 10) {
      return 'من ' + m + ' دقايق';
    }
    return 'من ' + m + ' دقيقة';
  }

  function hoursLabel(h) {
    if (h === 1) {
      return 'من ساعة';
    }
    if (h === 2) {
      return 'من ساعتين';
    }
    if (h <= 10) {
      return 'من ' + h + ' ساعات';
    }
    return 'من ' + h + ' ساعة';
  }

  function daysLabel(d) {
    if (d === 1) {
      return 'من يوم';
    }
    if (d === 2) {
      return 'من يومين';
    }
    if (d <= 10) {
      return 'من ' + d + ' أيام';
    }
    return 'من ' + d + ' يوم';
  }

  function monthsLabel(m) {
    if (m === 1) {
      return 'من شهر';
    }
    if (m === 2) {
      return 'من شهرين';
    }
    if (m <= 10) {
      return 'من ' + m + ' شهور';
    }
    return 'من ' + m + ' شهر';
  }

  function yearsLabel(y) {
    if (y === 1) {
      return 'من سنة';
    }
    if (y === 2) {
      return 'من سنتين';
    }
    if (y <= 10) {
      return 'من ' + y + ' سنين';
    }
    return 'من ' + y + ' سنة';
  }

  function relativeArabic(value) {
    var date = toDate(value);
    if (!date) {
      return '';
    }
    var diff = Date.now() - date.getTime();
    if (diff < 120000) {
      return 'اتسلّم دلوقتي';
    }
    var fmt = function (o) { try { return new Intl.DateTimeFormat('ar-EG', o).format(date); } catch (e) { return ''; } };
    var tz = 'Asia/Dubai';
    var clock = fmt({ hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz });
    var dayNow = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    var dayThen = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(date);
    if (dayNow === dayThen) { return 'الساعة ' + clock; }
    return fmt({ day: 'numeric', month: 'short', timeZone: tz }) + ' ' + clock;
  }

  function formatAbsolute(value) {
    var date = toDate(value);
    if (!date) {
      return '—';
    }
    var now = new Date();
    var sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    var options = sameDay
      ? { hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    try {
      return new Intl.DateTimeFormat('ar-EG-u-nu-latn', options).format(date);
    } catch (err) {
      return date.toLocaleString('ar-EG');
    }
  }

  var ROLE_MAP = {
    'مستكشف الأدوات المجانية': 'كشّاف الأدوات',
    'تنسيق الأدوات': 'منسّق الأدوات',
    'تقارير القنوات': 'محلل الأداء',
    'إعادة القياس': 'محلل الأداء (إعادة قياس)',
    'SEO': 'خبير السيو',
    'المونتاج والتصدير': 'منتج الفيديو',
    'فيديو الغسالة': 'منتج الفيديو (الغسالة)',
    'تيك توك': 'منتج فيديو تيك توك',
    'بناء الشورتس': 'صانع الشورتس',
    'رصد الترندات': 'صائد الترندات',
    'رفع الشورتس': 'ناشر الشورتس',
    'جدول النشر': 'منسّق النشر',
    'مسودات فيسبوك': 'كاتب فيسبوك',
    'مقالات بلوجر': 'كاتبة بلوجر',
    'ردود تعليقات يوتيوب': 'مسؤول التعليقات',
    'العناوين والأوصاف': 'كاتب العناوين',
    'تجهيز الموافقات': 'مجهّز الموافقات',
    'فحص الصحة': 'فاحص الصحة',
    'الفهرسة': 'مسؤول الفهرسة',
    'تلخيص التحديثات': 'ملخّص الأخبار'
  };
  function roleOf(t) { return ROLE_MAP[t] || t; }
  window.__roleOf = roleOf;

  function normalizeStaff(staff) {
    return {
      id: String(staff.id),
      name: typeof staff.name === 'string' ? staff.name : '',
      title: typeof staff.title === 'string' ? roleOf(staff.title) : '',
      dept: staff.dept === undefined || staff.dept === null ? '' : String(staff.dept),
      level: staff.level === 'lead' ? 'lead' : 'specialist',
      state: staff.state,
      step: typeof staff.step === 'string' ? staff.step : '',
      last: typeof staff.last === 'string' ? staff.last : '',
      time: staff.time
    };
  }

  function svgNode(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        node.setAttribute(key, attrs[key]);
      });
    }
    return node;
  }

  var SHIRTS = ['#3b5b7a', '#6b3f4f', '#2f6b5b', '#7a5a2f', '#4b4a7a', '#7d828c', '#a3472f', '#2e3a4b', '#556b3a', '#8a4b6b'];
  var SKINS = ['#e3b08a', '#d29a72', '#c58b62', '#edc29d', '#b97d57'];
  var HAIRS = ['#1c1a19', '#2a1d16', '#3a2a20', '#161616', '#4a3526'];
  var clipCounter = 0;

  function hashStr(str) {
    var h = 7;
    for (var i = 0; i < str.length; i += 1) {
      h = (h * 31 + str.charCodeAt(i)) % 100003;
    }
    return h;
  }

  function faceId(id) {
    return id === MANAGER_ID ? 'mgr' : String(id).replace(/[^a-z0-9_-]/gi, '');
  }

  function addFace(parent, id, cx, cy, r) {
    var skin = SKINS[hashStr(id + 'k') % SKINS.length];
    var hair = HAIRS[hashStr(id + 'h') % HAIRS.length];
    parent.appendChild(svgNode('circle', { cx: cx, cy: cy, r: r, style: 'fill:' + skin }));
    parent.appendChild(svgNode('path', { d: 'M' + (cx - r) + ' ' + cy + 'a' + r + ' ' + r + ' 0 0 1 ' + (2 * r) + ' 0c-2-' + (r * 0.55) + '-' + (r * 0.5) + '-' + (r * 0.85) + '-' + r + '-' + (r * 0.85) + 's-' + (r * 0.98) + ' ' + (r * 0.3) + '-' + r + ' ' + (r * 0.85) + 'z', style: 'fill:' + hair }));
    var clipId = 'fc' + (clipCounter += 1);
    var clip = svgNode('clipPath', { id: clipId });
    clip.appendChild(svgNode('circle', { cx: cx, cy: cy, r: r }));
    parent.appendChild(clip);
    var img = svgNode('image', {
      x: cx - r, y: cy - r, width: 2 * r, height: 2 * r,
      'clip-path': 'url(#' + clipId + ')', preserveAspectRatio: 'xMidYMid slice'
    });
    img.style.opacity = '0';
    img.addEventListener('load', function () { img.style.opacity = '1'; });
    img.setAttribute('href', 'faces/' + faceId(id) + '.jpg');
    parent.appendChild(img);
    parent.appendChild(svgNode('circle', { cx: cx, cy: cy, r: r, style: 'fill:none;stroke:rgba(255,255,255,0.18);stroke-width:1' }));
  }

  function buildCharacter(person) {
    var pid = person && person.id ? String(person.id) : 'x';
    var h = hashStr(pid);
    var shirt = SHIRTS[h % SHIRTS.length];
    var svg = svgNode('svg', { viewBox: '0 0 120 120', class: 'character', 'aria-hidden': 'true', focusable: 'false' });

    var defs = svgNode('defs');
    var gid = 'sg' + (clipCounter += 1);
    var grad = svgNode('linearGradient', { id: gid, x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.appendChild(svgNode('stop', { offset: '0', 'stop-color': shirt }));
    grad.appendChild(svgNode('stop', { offset: '1', 'stop-color': '#14161a' }));
    defs.appendChild(grad);
    var wid = 'wd' + (clipCounter += 1);
    var wood = svgNode('linearGradient', { id: wid, x1: '0', y1: '0', x2: '0', y2: '1' });
    wood.appendChild(svgNode('stop', { offset: '0', 'stop-color': '#b98a5e' }));
    wood.appendChild(svgNode('stop', { offset: '1', 'stop-color': '#7a5638' }));
    defs.appendChild(wood);
    svg.appendChild(defs);

    svg.appendChild(svgNode('ellipse', { class: 'char-shadow', cx: '60', cy: '113', rx: '40', ry: '5' }));
    svg.appendChild(svgNode('rect', { x: '37', y: '44', width: '46', height: '58', rx: '14', style: 'fill:#1b1d22;stroke:rgba(255,255,255,0.08);stroke-width:1' }));

    var body = svgNode('g', { class: 'char-body' });
    body.appendChild(svgNode('path', { d: 'M34 100 L34 80 Q34 66 50 63 L70 63 Q86 66 86 80 L86 100 Z', style: 'fill:url(#' + gid + ')' }));
    body.appendChild(svgNode('path', { d: 'M52 63 L60 75 L68 63 Z', style: 'fill:rgba(255,255,255,0.78)' }));
    body.appendChild(svgNode('rect', { x: '55', y: '55', width: '10', height: '11', rx: '4', style: 'fill:' + SKINS[hashStr(pid + 'k') % SKINS.length] }));
    var head = svgNode('g', { class: 'char-head' });
    addFace(head, pid, 60, 40, 18);
    body.appendChild(head);

    var armL = svgNode('g', { class: 'char-arm char-arm-left' });
    armL.appendChild(svgNode('rect', { x: '35', y: '74', width: '10', height: '19', rx: '5', style: 'fill:' + shirt }));
    armL.appendChild(svgNode('circle', { cx: '42', cy: '93', r: '4.2', style: 'fill:' + SKINS[hashStr(pid + 'k') % SKINS.length] }));
    body.appendChild(armL);
    var armR = svgNode('g', { class: 'char-arm char-arm-right' });
    armR.appendChild(svgNode('rect', { x: '75', y: '74', width: '10', height: '19', rx: '5', style: 'fill:' + shirt }));
    armR.appendChild(svgNode('circle', { cx: '78', cy: '93', r: '4.2', style: 'fill:' + SKINS[hashStr(pid + 'k') % SKINS.length] }));
    body.appendChild(armR);
    svg.appendChild(body);

    // desk, monitor, keyboard, props
    svg.appendChild(svgNode('rect', { x: '10', y: '92', width: '100', height: '9', rx: '3', style: 'fill:url(#' + wid + ');stroke:rgba(0,0,0,0.35);stroke-width:1' }));
    svg.appendChild(svgNode('rect', { x: '14', y: '101', width: '92', height: '13', rx: '3', style: 'fill:#5b3f29;stroke:rgba(0,0,0,0.35);stroke-width:1' }));
    svg.appendChild(svgNode('rect', { x: '56', y: '104', width: '8', height: '3', rx: '1.5', style: 'fill:#2c1f14' }));
    svg.appendChild(svgNode('rect', { x: '55', y: '89', width: '10', height: '4', rx: '1', style: 'fill:#2a2d33' }));
    svg.appendChild(svgNode('rect', { x: '43', y: '70', width: '34', height: '21', rx: '2.5', style: 'fill:#0f1115;stroke:#3a3e46;stroke-width:1.2' }));
    svg.appendChild(svgNode('rect', { class: 'char-screen', x: '45.5', y: '72.5', width: '29', height: '16', rx: '1.5' }));
    svg.appendChild(svgNode('rect', { class: 'char-lines', x: '48', y: '76', width: '16', height: '1.6', rx: '0.8' }));
    svg.appendChild(svgNode('rect', { class: 'char-lines', x: '48', y: '80', width: '22', height: '1.6', rx: '0.8' }));
    svg.appendChild(svgNode('rect', { class: 'char-lines', x: '48', y: '84', width: '12', height: '1.6', rx: '0.8' }));
    svg.appendChild(svgNode('rect', { x: '44', y: '95.5', width: '32', height: '3.2', rx: '1.2', style: 'fill:#2a2d33' }));
    if (h % 2 === 0) {
      svg.appendChild(svgNode('rect', { x: '93', y: '84', width: '8', height: '8', rx: '1.8', style: 'fill:#e8e4dc' }));
      svg.appendChild(svgNode('rect', { x: '100', y: '86', width: '3', height: '4', rx: '1.5', style: 'fill:none;stroke:#e8e4dc;stroke-width:1.2' }));
    } else {
      svg.appendChild(svgNode('rect', { x: '15', y: '85', width: '9', height: '7', rx: '2', style: 'fill:#9b5a3c' }));
      svg.appendChild(svgNode('path', { d: 'M19.5 85 Q12 77 14 72 Q19 76 19.5 85 Q21 75 27 73 Q26 80 19.5 85', style: 'fill:#4f9a5b' }));
    }
    return svg;
  }

  function buildWalker(person) {
    var pid = person && person.id ? String(person.id) : 'x';
    var shirt = SHIRTS[hashStr(pid) % SHIRTS.length];
    var skin = SKINS[hashStr(pid + 'k') % SKINS.length];
    var svg = svgNode('svg', { viewBox: '0 0 60 110', class: 'walker-fig', 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(svgNode('ellipse', { cx: '30', cy: '106', rx: '16', ry: '3.5', style: 'fill:rgba(0,0,0,0.4)' }));
    var legL = svgNode('g', { class: 'leg leg-a' });
    legL.appendChild(svgNode('rect', { x: '20', y: '66', width: '9', height: '32', rx: '4', style: 'fill:#252a34' }));
    legL.appendChild(svgNode('rect', { x: '18', y: '96', width: '13', height: '6', rx: '3', style: 'fill:#15161a' }));
    var legR = svgNode('g', { class: 'leg leg-b' });
    legR.appendChild(svgNode('rect', { x: '31', y: '66', width: '9', height: '32', rx: '4', style: 'fill:#2d333f' }));
    legR.appendChild(svgNode('rect', { x: '29', y: '96', width: '13', height: '6', rx: '3', style: 'fill:#15161a' }));
    svg.appendChild(legL);
    svg.appendChild(legR);
    var armA = svgNode('g', { class: 'arm arm-a' });
    armA.appendChild(svgNode('rect', { x: '10', y: '38', width: '8', height: '28', rx: '4', style: 'fill:' + shirt }));
    armA.appendChild(svgNode('circle', { cx: '14', cy: '67', r: '4', style: 'fill:' + skin }));
    svg.appendChild(armA);
    svg.appendChild(svgNode('rect', { x: '16', y: '36', width: '28', height: '36', rx: '10', style: 'fill:' + shirt }));
    svg.appendChild(svgNode('path', { d: 'M25 36 L30 45 L35 36 Z', style: 'fill:rgba(255,255,255,0.78)' }));
    var armB = svgNode('g', { class: 'arm arm-b' });
    armB.appendChild(svgNode('rect', { x: '42', y: '38', width: '8', height: '28', rx: '4', style: 'fill:' + shirt }));
    armB.appendChild(svgNode('circle', { cx: '46', cy: '67', r: '4', style: 'fill:' + skin }));
    svg.appendChild(armB);
    svg.appendChild(svgNode('rect', { x: '26', y: '29', width: '8', height: '9', rx: '3', style: 'fill:' + skin }));
    var head = svgNode('g', { class: 'walker-head' });
    addFace(head, pid, 30, 18, 15);
    svg.appendChild(head);
    return svg;
  }

  function buildStateBadge() {
    var badge = make('span', 'state-badge');
    badge.setAttribute('aria-hidden', 'true');

    var running = make('span', 'badge-icon badge-running');
    for (var i = 0; i < 3; i += 1) {
      running.appendChild(make('i', ''));
    }
    badge.appendChild(running);

    var waiting = make('span', 'badge-icon badge-waiting');
    var clock = make('span', 'clock-face');
    clock.appendChild(make('span', 'clock-hand clock-hour'));
    clock.appendChild(make('span', 'clock-hand clock-minute'));
    waiting.appendChild(clock);
    badge.appendChild(waiting);

    var done = make('span', 'badge-icon badge-done');
    badge.appendChild(done);

    var blocked = make('span', 'badge-icon badge-blocked');
    blocked.textContent = '!';
    badge.appendChild(blocked);

    return badge;
  }

  function createDesk(person, deptName, isManager) {
    var btn = make('button', 'desk');
    btn.type = 'button';
    btn.dataset.personId = person.id;
    btn.setAttribute('aria-haspopup', 'dialog');
    if (isManager) {
      btn.classList.add('is-manager');
    }

    var figure = make('span', 'desk-figure');
    figure.appendChild(buildCharacter(person));
    figure.appendChild(buildStateBadge());
    btn.appendChild(figure);

    var name = make('span', 'desk-name');
    var title = make('span', 'desk-title');
    btn.appendChild(name);
    btn.appendChild(title);
    var stepEl = make('span', 'desk-step');
    btn.appendChild(stepEl);
    btn.__step = stepEl;

    var doing = null;
    if (isManager) {
      doing = make('span', 'desk-doing');
      btn.appendChild(doing);
    }

    btn.__fig = figure;
    btn.__name = name;
    btn.__title = title;
    btn.__doing = doing;

    btn.addEventListener('click', function () {
      openSheet(person.id);
    });

    return btn;
  }

  function applyDesk(btn, person, deptName, isManager) {
    if (!btn) {
      return;
    }
    var key = normalizeState(person.state);
    btn.classList.remove('state-running', 'state-waiting', 'state-done', 'state-blocked', 'state-unknown');
    btn.classList.add('state-' + key);
    if (!isManager) {
      btn.classList.toggle('is-lead', person.level === 'lead');
    }

    var label = stateLabel(person.state);
    btn.__name.textContent = safeText(person.name, '—');
    btn.__title.textContent = safeText(person.title, '');
    if (btn.__step) { btn.__step.textContent = isManager ? '' : safeText(person.step, ''); }

    if (isManager && btn.__doing) {
      btn.__doing.textContent = safeText(person.doing, '');
    }

    var parts = [safeText(person.name, '—')];
    if (person.title) {
      parts.push(person.title);
    }
    if (deptName) {
      parts.push(deptName);
    }
    parts.push('الحالة: ' + label);
    btn.setAttribute('aria-label', parts.filter(Boolean).join(' · '));
  }

  function createRoom(dept, index) {
    var room = make('article', 'room');
    room.dataset.dept = dept.id;
    var accent = dept.id === 'qa' ? QA_ACCENT : ROOM_ACCENTS[index % ROOM_ACCENTS.length];
    room.style.setProperty('--room-accent', accent);
    room.style.setProperty('--char-shirt', accent);
    if (dept.id === 'qa') {
      room.classList.add('is-qa');
    }

    var head = make('div', 'room-head');
    var name = make('h2', 'room-name');
    name.textContent = safeText(dept.name, dept.id);
    head.appendChild(name);
    var roles = make('p', 'room-roles');
    head.appendChild(roles);
    room.__roles = roles;

    var tags = make('div', 'room-tags');
    var count = make('span', 'room-count');
    count.textContent = '0';
    tags.appendChild(count);
    if (dept.id === 'qa') {
      var qaTag = make('span', 'room-tag');
      qaTag.textContent = 'Review / QA';
      tags.appendChild(qaTag);
    }
    head.appendChild(tags);
    room.appendChild(head);

    var floor = make('div', 'room-floor');
    var leadRow = make('div', 'lead-row');
    var specRow = make('div', 'spec-row');
    floor.appendChild(leadRow);
    floor.appendChild(specRow);
    room.appendChild(floor);

    room.__leadRow = leadRow;
    room.__specRow = specRow;
    room.__count = count;

    return room;
  }

  function buildScene(feed) {
    var departments = Array.isArray(feed.departments) ? feed.departments : [];
    var staff = Array.isArray(feed.staff) ? feed.staff : [];

    clear(els.managerDeskSlot);
    var assistant = isObj(feed.assistant) ? feed.assistant : {};
    managerDesk = createDesk(
      {
        id: MANAGER_ID,
        name: assistant.name,
        title: assistant.title,
        state: assistant.state,
        doing: assistant.doing,
        level: 'lead'
      },
      'الإدارة',
      true
    );
    applyDesk(
      managerDesk,
      {
        name: assistant.name,
        title: assistant.title,
        state: assistant.state,
        doing: assistant.doing,
        level: 'lead'
      },
      'الإدارة',
      true
    );
    els.managerDeskSlot.appendChild(managerDesk);

    clear(els.departments);
    deskByStaff = new Map();
    roomByDept = new Map();

    departments.forEach(function (dept, index) {
      if (!isObj(dept) || dept.id === undefined || dept.id === null) {
        return;
      }
      var deptId = String(dept.id);
      var deptName = deptNameById.get(deptId) || deptId;
      var room = createRoom({ id: deptId, name: deptName }, index);
      var leadRow = room.__leadRow;
      var specRow = room.__specRow;
      var count = 0;

      staff.forEach(function (raw) {
        if (!isObj(raw) || raw.id === undefined || raw.id === null) {
          return;
        }
        if (raw.dept === undefined || raw.dept === null || String(raw.dept) !== deptId) {
          return;
        }
        var person = normalizeStaff(raw);
        var desk = createDesk(person, deptName, false);
        applyDesk(desk, person, deptName, false);
        deskByStaff.set(person.id, desk);
        if (person.level === 'lead') {
          leadRow.appendChild(desk);
        } else {
          specRow.appendChild(desk);
        }
        count += 1;
      });

      if (!leadRow.children.length) {
        leadRow.hidden = true;
      }
      if (!specRow.children.length) {
        specRow.hidden = true;
      }
      room.__count.textContent = String(count);
      if (room.__roles) {
        var tl = staff.filter(function (r) { return isObj(r) && String(r.dept) === deptId && r.title; }).map(function (r) { return roleOf(r.title); });
        room.__roles.textContent = tl.length ? 'الأدوار: ' + tl.join(' · ') : '';
      }
      roomByDept.set(deptId, room);
      els.departments.appendChild(room);
    });

    sceneSignature = computeSignature(feed);
  }

  function updateScene(feed) {
    var assistant = isObj(feed.assistant) ? feed.assistant : {};
    applyDesk(
      managerDesk,
      {
        name: assistant.name,
        title: assistant.title,
        state: assistant.state,
        doing: assistant.doing,
        level: 'lead'
      },
      'الإدارة',
      true
    );

    var staff = Array.isArray(feed.staff) ? feed.staff : [];
    staff.forEach(function (raw) {
      if (!isObj(raw) || raw.id === undefined || raw.id === null) {
        return;
      }
      var person = normalizeStaff(raw);
      var desk = deskByStaff.get(person.id);
      if (desk) {
        applyDesk(desk, person, deptNameById.get(person.dept), false);
      }
    });
  }

  function computeSignature(feed) {
    var parts = [];
    var departments = Array.isArray(feed.departments) ? feed.departments : [];
    departments.forEach(function (dept) {
      if (isObj(dept) && dept.id !== undefined && dept.id !== null) {
        parts.push('d:' + String(dept.id) + ':' + (typeof dept.name === 'string' ? dept.name : ''));
      }
    });
    var staff = Array.isArray(feed.staff) ? feed.staff : [];
    staff.forEach(function (person) {
      if (isObj(person) && person.id !== undefined && person.id !== null) {
        parts.push(
          's:' +
            String(person.id) +
            ':' +
            (person.dept === undefined || person.dept === null ? '' : String(person.dept)) +
            ':' +
            (person.level === 'lead' ? 'lead' : 'specialist')
        );
      }
    });
    return parts.join('|');
  }

  var liveClockFmt = null, pageStart = Date.now();
  function fmtDubai(d) {
    try { if (!liveClockFmt) { liveClockFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Dubai' }); } return liveClockFmt.format(d); } catch (e) { return d.toLocaleTimeString('en-GB'); }
  }
  function renderLastUpdated() {
    var now = Date.now(), st = window.__o3Stream, rx = window.__o3RxAt || 0, nw = window.__o3Newest || 0;
    var feedOld = nw > 0 && (now - nw) >= 1800000;
    var down = !!(st && st.down && now - st.since > 10000);
    var noStream = !st && (typeof EventSource === 'undefined' || now - pageStart > 20000);
    var offline = navigator.onLine === false || networkFailed;
    var mode = offline ? 'offline' : feedOld ? 'old' : (down ? 'down' : (noStream ? 'nostream' : 'live'));
    var lab = els.lastUpdated.parentNode && els.lastUpdated.parentNode.querySelector('.updated-label');
    var box = els.lastUpdated.parentNode;
    if (mode === 'live') { els.lastUpdated.textContent = fmtDubai(new Date()); }
    else if (mode === 'old') { var oa = Math.floor((now - nw) / 60000); els.lastUpdated.textContent = fmtDubai(new Date(nw)) + (oa > 60 ? ' (من ' + ageWords(oa) + ')' : ''); }
    else {
      var dt = nw > 0 ? nw : rx;  /* data time first (cache load time is not data age) */
      var dage = dt ? Math.floor((now - dt) / 60000) : 0;
      els.lastUpdated.textContent = dt ? fmtDubai(new Date(dt)) + (dage > 60 ? ' (من ' + ageWords(dage) + ')' : '') : '—';
    }
    var txt = mode === 'live' ? 'مباشر' : (mode === 'old' ? 'بيانات قديمة، آخرها' : (mode === 'offline' ? 'بدون اتصال، آخر بيانات' : mode === 'down' ? 'متقطّع، آخر بيانات' : 'بدون تيار، آخر بيانات'));
    if (lab && lab.textContent !== txt) { lab.textContent = txt; }
    if (box) { box.classList.toggle('is-live', mode === 'live'); box.classList.toggle('is-stale', mode !== 'live'); }
  }
  function flashLive() {
    var box = els.lastUpdated && els.lastUpdated.parentNode;
    if (!box) { return; }
    box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
  }

  function renderHandoffList() {
    if (!els.handoffList) {
      return;
    }
    clear(els.handoffList);

    var items = lastHandoffs
      .filter(isObj)
      .slice()
      .sort(function (a, b) {
        var ta = toDate(a.time);
        var tb = toDate(b.time);
        return (tb ? tb.getTime() : 0) - (ta ? ta.getTime() : 0);
      })
      .slice(0, 5);

    items.forEach(function (handoff) {
      var fromPerson = staffById.get(String(handoff.from));
      var toPerson = staffById.get(String(handoff.to));
      var fromName = fromPerson
        ? fromPerson.name
        : typeof handoff.from === 'string'
        ? handoff.from
        : '—';
      var toName = toPerson ? toPerson.name : typeof handoff.to === 'string' ? handoff.to : '—';

      var li = make('li', 'handoff-item');
      var paper = make('span', 'handoff-paper');
      paper.setAttribute('aria-hidden', 'true');
      var route = make('span', 'handoff-route');
      route.textContent = fromName + ' ← ' + toName;
      var label = make('span', 'handoff-label');
      label.textContent = safeText(handoff.label, 'تسليم');
      var time = make('span', 'handoff-time');
      time.textContent = handoff.time ? relativeArabic(handoff.time) : '';

      li.appendChild(paper);
      li.appendChild(route);
      li.appendChild(label);
      li.appendChild(time);
      els.handoffList.appendChild(li);
    });

    els.handoffEmpty.hidden = items.length > 0;
  }

  function sheetDataFor(id) {
    if (id === MANAGER_ID) {
      var assistant = currentFeed && isObj(currentFeed.assistant) ? currentFeed.assistant : {};
      return {
        name: assistant.name,
        title: assistant.title,
        dept: 'الإدارة',
        step: assistant.doing,
        last: '',
        time: currentFeed ? currentFeed.updated : '',
        state: assistant.state
      };
    }
    var person = staffById.get(id);
    if (!person) {
      return null;
    }
    return {
      name: person.name,
      title: person.title,
      dept: deptNameById.get(person.dept) || '—',
      step: person.step,
      last: person.last,
      time: person.time,
      state: person.state
    };
  }

  function fillSheet(data) {
    els.sheetName.textContent = safeText(data.name, '—');
    els.sheetTitle.textContent = safeText(data.title, '');
    els.sheetDeptValue.textContent = safeText(data.dept, '—');
    els.sheetStep.textContent = safeText(data.step, '—');
    els.sheetLast.textContent = safeText(data.last, '—');
    els.sheetTime.textContent = data.time ? relativeArabic(data.time) : '—';
    els.sheetTime.title = data.time ? formatAbsolute(data.time) : '';

    var key = normalizeState(data.state);
    var label = stateLabel(data.state);
    els.sheetState.textContent = label;
    els.sheetState.dataset.state = key;
    els.sheetStateValue.textContent = label;
  }

  function isSheetOpen() {
    return !!els.sheet && !els.sheet.hidden && els.sheet.classList.contains('is-open');
  }

  function openSheet(id) {
    var data = sheetDataFor(id);
    if (!data) {
      return;
    }
    openSheetId = id;
    fillSheet(data);

    lastFocused = document.activeElement;
    window.clearTimeout(sheetCloseTimer);
    els.sheet.hidden = false;
    els.sheetBackdrop.hidden = false;
    void els.sheet.offsetWidth;
    els.sheet.classList.add('is-open');
    els.sheetBackdrop.classList.add('is-open');
    document.body.classList.add('sheet-open');
    els.sheet.focus();
  }

  function closeSheet() {
    if (!els.sheet || els.sheet.hidden) {
      return;
    }
    els.sheet.classList.remove('is-open');
    els.sheetBackdrop.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
    openSheetId = null;
    window.clearTimeout(sheetCloseTimer);
    sheetCloseTimer = window.setTimeout(function () {
      els.sheet.hidden = true;
      els.sheetBackdrop.hidden = true;
    }, 340);
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try {
        lastFocused.focus();
      } catch (err) {
        return;
      }
    }
  }

  function refreshSheet() {
    if (!openSheetId || !isSheetOpen()) {
      return;
    }
    var data = sheetDataFor(openSheetId);
    if (data) {
      fillSheet(data);
    }
  }

  function loadPlayed() {
    var set = new Set();
    try {
      var raw = window.localStorage.getItem(PLAYED_STORAGE_KEY);
      if (raw) {
        var list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach(function (key) {
            if (typeof key === 'string') {
              set.add(key);
            }
          });
        }
      }
    } catch (err) {
      return set;
    }
    return set;
  }

  function savePlayed() {
    try {
      var list = Array.from(played);
      if (list.length > 200) {
        list = list.slice(list.length - 200);
      }
      window.localStorage.setItem(PLAYED_STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      return;
    }
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function walkHandoff(item) {
    if (window.Office3D && window.Office3D.ready) {
      return window.Office3D.walk(item).catch(function () { return null; });
    }
    return new Promise(function (resolve) {
      var fromDesk = deskByStaff.get(item.from);
      var toDesk = deskByStaff.get(item.to);
      if (!fromDesk || !toDesk || !els.walkerLayer) {
        resolve();
        return;
      }
      var fromFig = fromDesk.__fig;
      var toFig = toDesk.__fig;
      if (!fromFig || !toFig) {
        resolve();
        return;
      }

      var officeRect = els.office.getBoundingClientRect();
      var fromRect = fromFig.getBoundingClientRect();
      var toRect = toFig.getBoundingClientRect();
      if (!fromRect.width || !toRect.width) {
        resolve();
        return;
      }

      var size = 48;
      var fromX = fromRect.left - officeRect.left + fromRect.width / 2;
      var fromY = fromRect.top - officeRect.top + fromRect.height / 2;
      var toX = toRect.left - officeRect.left + toRect.width / 2;
      var toY = toRect.top - officeRect.top + toRect.height * 0.72;
      var dx = toX - fromX;
      var dy = toY - fromY;

      var walker = make('div', 'walker');
      walker.style.left = fromX - size / 2 + 'px';
      walker.style.top = fromY - 36 + 'px';
      walker.classList.add(dx < 0 ? 'face-left' : 'face-right');
      walker.appendChild(buildWalker({ id: item.from }));
      toFig.classList.add('is-expecting');
      var paper = make('span', 'paper');
      paper.setAttribute('aria-hidden', 'true');
      walker.appendChild(paper);
      var bubble = make('span', 'walker-bubble');
      bubble.textContent = safeText(item.label, 'تسليم');
      walker.appendChild(bubble);

      els.walkerLayer.appendChild(walker);
      fromFig.classList.add('is-away');

      void walker.offsetWidth;
      walker.classList.add('is-walking');
      walker.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';

      wait(2500)
        .then(function () {
          walker.classList.remove('is-walking');
          walker.classList.add('is-pausing');
          toFig.classList.add('is-received');
          return wait(1100);
        })
        .then(function () {
          walker.classList.remove('is-pausing');
          walker.classList.add('is-walking');
          toFig.classList.remove('is-received');
          walker.classList.add(dx < 0 ? 'face-right' : 'face-left');
          walker.classList.remove(dx < 0 ? 'face-left' : 'face-right');
          walker.style.transform = 'translate(0px,0px)';
          return wait(2500);
        })
        .then(function () {
          if (walker.parentNode) {
            walker.parentNode.removeChild(walker);
          }
          fromFig.classList.remove('is-away');
          toFig.classList.remove('is-expecting');
          resolve();
        });
    });
  }

  function processHandoffQueue() {
    if (handoffBusy) {
      return;
    }
    var item = handoffQueue.shift();
    if (!item) {
      return;
    }
    handoffBusy = true;
    queued.delete(item.key);
    played.add(item.key);
    savePlayed();

    walkHandoff(item)
      .then(function () {
        handoffBusy = false;
        window.setTimeout(processHandoffQueue, 240);
      })
      .catch(function () {
        handoffBusy = false;
        window.setTimeout(processHandoffQueue, 240);
      });
  }

  function queueHandoffs(feed) {
    var updated = toDate(feed.updated);
    if (!updated) {
      return;
    }
    var handoffs = Array.isArray(feed.handoffs) ? feed.handoffs.slice() : [];
    handoffs.sort(function (a, b) {
      var ta = toDate(a && a.time);
      var tb = toDate(b && b.time);
      return (ta ? ta.getTime() : 0) - (tb ? tb.getTime() : 0);
    });

    handoffs.forEach(function (handoff) {
      if (!isObj(handoff)) {
        return;
      }
      if (handoff.from === undefined || handoff.from === null || handoff.to === undefined || handoff.to === null) {
        return;
      }
      var fromId = String(handoff.from);
      var toId = String(handoff.to);
      if (!staffById.has(fromId) || !staffById.has(toId)) {
        return;
      }
      var time = toDate(handoff.time);
      if (!time) {
        return;
      }
      if (Math.abs(updated.getTime() - time.getTime()) > HANDOFF_WINDOW_MS) {
        return;
      }
      var key = fromId + '|' + toId + '|' + String(handoff.time);
      if (played.has(key) || queued.has(key)) {
        return;
      }
      queued.add(key);
      handoffQueue.push({
        from: fromId,
        to: toId,
        label: typeof handoff.label === 'string' ? handoff.label : '',
        time: handoff.time,
        key: key
      });
    });

    processHandoffQueue();
  }

  function applyFeed(data) {
    if (!isObj(data)) {
      return;
    }
    scrubFeed(data); window.__o3RxAt = Date.now();
    (function () { var nw = isFinite(Date.parse(data.updated)) ? Date.parse(data.updated) : 0; (Array.isArray(data.staff) ? data.staff : []).forEach(function (s) { var t = s && s.time ? Date.parse(s.time) : NaN; if (isFinite(t) && t > nw) { nw = t; } }); window.__o3Newest = nw; })();
    if (window.Office3D && window.Office3D.ready) {
      try { window.Office3D.update(data); } catch (e) { /* keep 2D */ }
    }
    currentFeed = data;

    staffById = new Map();
    (Array.isArray(data.staff) ? data.staff : []).forEach(function (raw) {
      if (isObj(raw) && raw.id !== undefined && raw.id !== null) {
        staffById.set(String(raw.id), normalizeStaff(raw));
      }
    });

    deptNameById = new Map();
    (Array.isArray(data.departments) ? data.departments : []).forEach(function (dept) {
      if (isObj(dept) && dept.id !== undefined && dept.id !== null) {
        deptNameById.set(String(dept.id), safeText(dept.name, String(dept.id)));
      }
    });

    lastHandoffs = Array.isArray(data.handoffs) ? data.handoffs.filter(isObj) : [];
    lastFeedUpdated = typeof data.updated === 'string' ? data.updated : null;

    var signature = computeSignature(data);
    if (signature !== sceneSignature || !managerDesk) {
      buildScene(data);
    } else {
      updateScene(data);
    }

    renderLastUpdated();
    flashLive();
    renderHandoffList();
    queueHandoffs(data);
    refreshSheet();
  }

  function updateOffline() {
    var show = networkFailed || navigator.onLine === false;
    els.offlineBanner.hidden = !show;
    document.body.classList.toggle('is-offline', show);
  }

  function tick() {
    renderHandoffList();
    refreshSheet();
  }


  // ---- Live layer: free realtime events over ntfy.sh (plain-language statuses only) ----
  var LIVE_TOPIC = 'ws-bishoy-20c71950930763d94e43b329297e34fe';
  var LIVE_BASE = 'https://ntfy.sh/' + LIVE_TOPIC;
  var liveEvents = [];
  var liveSeen = {};
  var baseFeed = null;
  var liveSource = null;
  var liveLastId = '';

  // ---- Live status lines (ntfy topic, JSON: id, name, text, state start|done). Untrusted: text only, never HTML. ----
  var STATUS_BASE = 'https://ntfy.sh/wsfeed-bishoy-0284a9cccdca36e35f4d30fb';
  var statusLines = [], statusSeen = {}, statusSince = '12h';
  var TL_KEY = 'ws-timeline-v1';
  function saveTL() { try { localStorage.setItem(TL_KEY, JSON.stringify(statusLines.slice(0, 500).map(function (e) { return { mid: e.mid, id: e.id, name: e.name, text: e.text, state: e.state, job: e.job, ms: e.ms, ask: e.ask || '', options: e.options || [], done: e.done, pending: e.pending, ver: (e.ver === true || e.ver === false) ? e.ver : undefined }; }))); } catch (e) { /* storage full or blocked */ } }
  function restoreTL() { try { var a = JSON.parse(localStorage.getItem(TL_KEY) || '[]'); if (Array.isArray(a)) { a.slice(0, 500).forEach(function (e) { if (e && e.mid && e.ms && e.text) { statusSeen[e.mid] = true; statusSince = e.mid; statusLines.push({ mid: String(e.mid), id: cleanText(e.id, 40), name: cleanText(e.name, 40), text: FREE_TEXT_OK ? (publicText(cleanText(e.text, 160)) || NOJOB) : (jobSafe(e.job, 40) || NOJOB), state: e.state === 'done' ? 'done' : (e.state === 'blocked' ? 'blocked' : 'start'), next: '', ver: (e.ver === true ? true : (e.ver === false ? false : null)), done: (isFinite(+e.done) && +e.done >= 0 ? Math.min(9999, Math.floor(+e.done)) : -1), pending: (isFinite(+e.pending) && +e.pending >= 0 ? Math.min(9999, Math.floor(+e.pending)) : -1), job: jobSafe(e.job, 40), result: '', ms: +e.ms, ask: (cleanText(e.ask, 140) === PRIV_PH ? '' : (FREE_TEXT_OK ? cleanText(e.ask, 140) : (cleanText(e.ask, 140) ? 'في قرار مستني' : ''))), options: FREE_TEXT_OK ? cleanOpts(e.options) : [] }); } }); statusLines.sort(function (x, y) { return y.ms - x.ms; }); } } catch (e) { console.warn('restoreTL', String(e)); statusLines = []; } }
  var PRIV_PH = 'نشاط على حساب، التفاصيل مخفية';
  function cleanOpts(a) { var o = []; if (Array.isArray(a)) { a.slice(0, 3).forEach(function (x) { var t = cleanText(typeof x === 'string' ? x : '', 50); if (t && t !== PRIV_PH) { o.push(t); } }); } return o; }
  function pollStatus() {
    fetch(STATUS_BASE + '/json?poll=1&since=' + encodeURIComponent(statusSince), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (txt) {
        var changed = false;
        String(txt || '').split('\n').forEach(function (ln) {
          if (!ln) { return; }
          var m; try { m = JSON.parse(ln); } catch (e) { return; }
          if (!m || m.event !== 'message' || !m.id || statusSeen[m.id]) { return; }
          statusSeen[m.id] = true; statusSince = m.id;
          var b = null; try { b = JSON.parse(m.message); } catch (e) { b = null; }
          var nm = '', tx = '', stt = '', aid = '', nx = '', dn = -1, pd = -1, jb = '', rs = '', ak = '', op = [], vf = null;
          if (b && typeof b === 'object') { nm = cleanText(b.name, 40); tx = (FREE_TEXT_OK && publicText(b.text)) || jobSafe(b.job, 40) || NOJOB; stt = b.state === 'done' ? 'done' : (b.state === 'blocked' || b.state === 'error' ? 'blocked' : 'start'); aid = cleanText(b.id, 40); jb = jobSafe(b.job, 40); rs = (b.result === 'got' || b.result === 'none' || b.result === 'pending') ? b.result : ''; vf = (b.verified === true || b.verified === 'yes') ? true : ((b.verified === false || b.verified === 'no') ? false : null); nx = FREE_TEXT_OK ? publicText(b.next) : ''; ak = cleanText(b.ask, 140); if (ak === PRIV_PH) { ak = ''; } if (ak && !FREE_TEXT_OK) { ak = 'في قرار مستني'; } op = ak && FREE_TEXT_OK ? cleanOpts(b.options) : []; dn = isFinite(+b.done) && b.done !== null && b.done !== '' ? Math.max(0, Math.min(9999, Math.floor(+b.done))) : -1; pd = isFinite(+b.pending) && b.pending !== null && b.pending !== '' ? Math.max(0, Math.min(9999, Math.floor(+b.pending))) : -1; }
          else { tx = (FREE_TEXT_OK && publicText(cleanText(m.message, 160))) || NOJOB; nm = cleanText(m.title, 40); stt = 'start'; }
          if (!tx) { return; }
          statusLines.push({ mid: m.id, id: aid, name: nm, text: tx, state: stt, ver: vf, next: nx, done: dn, pending: pd, job: jb, result: rs, ms: (m.time || 0) * 1000, ask: ak, options: op });
          changed = true;
        });
        if (changed) { statusLines.sort(function (a, b) { return b.ms - a.ms; }); statusLines = statusLines.slice(0, 500); saveTL(); try { learnAvg(); } catch (e) {} try { renderLog(); renderCard(); } catch (e) {} try { if (baseFeed) { applyMerged(); } } catch (e) {} try { renderSummary(); } catch (e) {} try { renderDecisions(); } catch (e) {} try { updateBadge(); } catch (e) {} try { publishLoad(); } catch (e) {} try { if (window.OrgView && window.OrgView.update) { window.OrgView.update(statusLines); } } catch (e) {} }
      })
      .catch(function () {});
  }
  pollStatus(); setInterval(pollStatus, 5000);

  // ---- Per-agent card: now / next / progress, from the live status stream (text only) ----
  function agentLive(id, name) {
    var AL = { 'scout': 't5', 'jessica-dev': 'j2', 'security': 'q14', 'yt-replies': 'c4', 'tiktok': 'v1' };
    var i; for (i = 0; i < statusLines.length; i++) { var e = statusLines[i], cid = AL[e.id] || e.id; if ((id && cid && cid === id) || (name && e.name && e.name === name)) { return e; } }
    return null;
  }
  var cardEl = null, cardFor = null;
  function closeCard() { if (cardEl) { cardEl.remove(); cardEl = null; cardFor = null; } } window.__closeCard = closeCard; document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { closeCard(); } });
  /* IDEA53-BEGIN. Swipe between workers on the open worker card. One finger: sideways moves to the previous or next worker, down closes the card, touch-action none on the card, small dots under the card show where you are. Order = manager first, then the feed staff list. In a right-to-left page the next worker is to the left, so swiping right (content moves right) shows the next one; in left-to-right swiping left does. 40px minimum, and the move must be mostly sideways or mostly down, so scrolling and taps are not stolen. Only worker ids are used, nothing is stored, no text, no network. */
  var SWIPE_MIN = 40, DOTS_MAX = 7;
  function swipeDir(dx, dy, rtl) {
    dx = Number(dx); dy = Number(dy);
    if (!isFinite(dx) || !isFinite(dy)) { return ''; }
    var ax = Math.abs(dx), ay = Math.abs(dy);
    if (ay >= SWIPE_MIN && ay > ax) { return dy > 0 ? 'close' : ''; }
    if (ax >= SWIPE_MIN && ax > ay) { return (dx > 0) === !!rtl ? 'next' : 'prev'; }
    return '';
  }
  function swipeTarget(order, cur, dir) {
    var i = order.indexOf(cur);
    if (i < 0) { return cur; }
    if (dir === 'next') { return order[Math.min(order.length - 1, i + 1)]; }
    if (dir === 'prev') { return order[Math.max(0, i - 1)]; }
    return cur;
  }
  function dotWindow(n, i) {
    n = Math.max(0, Math.floor(n)); i = Math.max(0, Math.min(n - 1, Math.floor(i)));
    var count = Math.min(n, DOTS_MAX), start = Math.max(0, Math.min(n - count, i - Math.floor(count / 2)));
    return { start: start, count: count, active: i - start };
  }
  /* IDEA53-END */
  /* IDEA45-BEGIN. Early warning "may be late". Local numbers only, keyed by department id. Never stores job names or text. */
  var LATE_KEY = 'ws_avg_v1', LATE_T_KEY = 'ws_avg_t', LATE_PEND_MIN = 45, LATE_X = 1.5, LATE_MINN = 3, lateAvg = {}, lateT = 0;
  function deptOf(id) { var s = (baseFeed && baseFeed.staff || []).filter(function (p) { return String(p.id) === String(id); })[0], d = s && s.dept; return (typeof d === 'string' && /^[a-z0-9_-]{1,20}$/i.test(d)) ? d : 'all'; }
  function loadAvg() {
    lateAvg = {}; lateT = 0;
    try {
      var o = JSON.parse(localStorage.getItem(LATE_KEY) || '{}'); if (!o || typeof o !== 'object') { o = {}; }
      Object.keys(o).forEach(function (k) { var v = o[k]; if (/^[a-z0-9_-]{1,20}$/i.test(k) && Array.isArray(v) && isFinite(+v[0]) && isFinite(+v[1]) && +v[0] >= 0 && +v[1] > 0 && +v[1] <= 720) { lateAvg[k] = [Math.min(20, Math.floor(+v[0])), Math.round(+v[1] * 10) / 10]; } });
      var t = +localStorage.getItem(LATE_T_KEY); lateT = isFinite(t) && t > 0 ? t : 0;
    } catch (e) { lateAvg = {}; lateT = 0; }
  }
  function saveAvg() { try { localStorage.setItem(LATE_KEY, JSON.stringify(lateAvg)); localStorage.setItem(LATE_T_KEY, String(lateT)); } catch (e) { /* storage full or blocked */ } }
  function lateKeyOf(e) { return e.id || e.name || '?'; }
  /* Learn: each finished task (a start line, then a done line of the same worker) adds its minutes to that department's average. */
  function learnAvg() {
    if (!(baseFeed && baseFeed.staff && baseFeed.staff.length)) { return; }  /* departments are unknown until the feed has loaded */
    var by = {}, ch = false, i;
    for (i = statusLines.length - 1; i >= 0; i--) { var e = statusLines[i], k = lateKeyOf(e); (by[k] = by[k] || []).push(e); }
    Object.keys(by).forEach(function (k) {
      var st = 0;
      by[k].forEach(function (e) {
        if (e.state === 'start') { if (!st) { st = e.ms; } return; }
        if (e.state === 'done' && st && e.ms > st && e.ms > lateT) {
          var dur = (e.ms - st) / 60000;
          if (dur >= 1 && dur <= 720) { var d = deptOf(k), a = lateAvg[d] || [0, dur], n = Math.min(20, a[0] + 1); lateAvg[d] = [n, Math.round((a[1] + (dur - a[1]) / n) * 10) / 10]; ch = true; }
        }
        if (e.state === 'done' && e.ms > lateT) { lateT = e.ms; ch = true; }
        st = 0;
      });
    });
    if (ch) { saveAvg(); }
  }
  /* Late: the worker's latest line is a running one, it has run longer than 1.5x the department average (3+ finished tasks known), or longer than 45 minutes. */
  function isLate(k, deptId, now) {
    var run = 0, i, e;
    for (i = 0; i < statusLines.length; i++) { e = statusLines[i]; if (lateKeyOf(e) !== k) { continue; } if (e.state !== 'start') { break; } run = e.ms; }
    if (!run) { return false; }
    var el = ((now || Date.now()) - run) / 60000, a = lateAvg[deptId];
    if (el > 120 || el < 1) { return false; } /* only start lines newer than 2 hours count */
    return !!((a && a[0] >= LATE_MINN && el >= 5 && el > LATE_X * a[1]) || el > LATE_PEND_MIN);
  }
  function lateCount(now) { try { learnAvg(); } catch (e) { /* optional */ } var seen = {}, n = 0; statusLines.forEach(function (e) { var k = lateKeyOf(e); if (seen[k]) { return; } seen[k] = 1; if (isLate(k, deptOf(k), now)) { n++; } }); return n; }
  loadAvg();
  /* IDEA45-END */
  function renderCard() {
    if (!cardEl || !cardFor) { return; }
    var id = cardFor, sf = (baseFeed && baseFeed.staff || []).filter(function (p) { return String(p.id) === id; })[0];
    var nm = id === '__manager__' ? ((baseFeed && baseFeed.assistant && baseFeed.assistant.name) || 'ريم') : (sf ? sf.name : id);
    var title = id === '__manager__' ? 'المديرة' : (sf && sf.title || '');
    var lv = agentLive(id, nm);
    cardEl.textContent = '';
    var st = function (css) { return css; };
    var h = make('div', ''); h.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px';
    var t = make('b', ''); t.textContent = nm + (title ? ' · ' + title : ''); h.appendChild(t);
    var x = make('button', ''); x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label', 'إغلاق كارت الموظف'); x.style.cssText = 'background:none;border:0;color:#fff;font-size:16px;cursor:pointer;min-width:44px;min-height:44px;margin:-12px;display:flex;align-items:center;justify-content:center;flex:none'; x.addEventListener('click', closeCard); h.appendChild(x);
    cardEl.appendChild(h);
    function row(label, val) { var r = make('div', ''); r.style.cssText = 'font-size:14px;line-height:1.6'; var l = make('span', ''); l.textContent = label + ': '; l.style.color = '#8aa3bf'; var v = make('span', ''); v.textContent = val; r.appendChild(l); r.appendChild(v); cardEl.appendChild(r); }
    var now = lv ? (!lv.text || lv.text === NOJOB ? NOJOB : (lv.state === 'done' ? 'خلّص: ' : 'بيشتغل على: ') + lv.text) : (sf && sf.step ? sf.step + ' (من الداتا القديمة)' : 'مفيش حالة حية');
    row('دلوقتي', now);
    if (lv && isLate(lateKeyOf(lv), deptOf(id))) { var lb = make('div', ''); lb.className = 'o3-latebadge'; lb.style.cssText = 'display:inline-block;margin:4px 0;padding:4px 10px;border-radius:999px;background:#fbbf24;color:#1f1300;font-size:14px;font-weight:800;border:2px solid #fff'; lb.textContent = '\u26A0 ممكن يتأخر'; cardEl.appendChild(lb); }
    if (FREE_TEXT_OK) { row('الجاي', lv && lv.next && publicText(lv.next) ? publicText(lv.next) : 'لسه ما بعتش'); }
    var LD = window.__o3Load || {}, LDM = window.__o3LoadMs || {};
    if (typeof LD[id] === 'number') { var ldAge = Date.now() - (LDM[id] || 0); row('معلّق', LD[id] + (ldAge > 3600000 ? ' (من ' + ageWords(Math.floor(ldAge / 60000)) + ')' : '')); }
    if (lv && lv.done >= 0 && lv.pending >= 0) {
      var tot = lv.done + lv.pending, pc = tot ? Math.round(lv.done * 100 / tot) : 0;
      row('اتعمل / فاضل', lv.done + ' / ' + lv.pending);
      var bar = make('div', ''); bar.style.cssText = 'height:8px;border-radius:6px;background:rgba(255,255,255,.12);margin-top:6px;overflow:hidden';
      var fill = make('div', ''); fill.style.cssText = 'height:100%;background:#2bb0a0;width:' + pc + '%'; bar.appendChild(fill); cardEl.appendChild(bar);
      var pt = make('div', ''); pt.style.cssText = 'font-size:14px;color:#b9cce2;margin-top:3px'; pt.textContent = pc + '% خلص النهاردة'; cardEl.appendChild(pt);
    } else { row('اتعمل / فاضل', 'لسه ما بعتش الأرقام'); }
    if (lv && lv.ms) { var tt = make('div', ''); tt.style.cssText = 'font-size:14px;color:#b9cce2;margin-top:6px'; try { tt.textContent = 'آخر تحديث ' + new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Dubai' }).format(new Date(lv.ms)); } catch (e) {} cardEl.appendChild(tt); }
    try { swipeDots(); } catch (e) { /* optional */ }
  }
  /* IDEA53 wiring */
  function swipeOrder() { var o = ['__manager__']; ((baseFeed && baseFeed.staff) || []).forEach(function (p) { var id = String(p.id); if (o.indexOf(id) < 0) { o.push(id); } }); return o; }
  function swipeDots() {
    if (!cardEl || !cardFor) { return; }
    var o = swipeOrder(), i = o.indexOf(cardFor); if (i < 0) { return; }
    var w = dotWindow(o.length, i), row = make('div', ''); row.setAttribute('data-swipe-dots', '1'); row.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:6px;margin-top:10px;font-size:14px;color:#b9cce2';
    var k, d; for (k = 0; k < w.count; k++) { d = make('span', ''); d.setAttribute('aria-hidden', 'true'); d.style.cssText = 'width:' + (k === w.active ? 10 : 7) + 'px;height:' + (k === w.active ? 10 : 7) + 'px;border-radius:50%;background:' + (k === w.active ? '#22d3ee' : 'rgba(255,255,255,.35)'); row.appendChild(d); }
    var cnt = make('span', ''); cnt.textContent = (i + 1) + ' / ' + o.length; cnt.setAttribute('dir', 'ltr'); cnt.style.marginInlineStart = '8px'; row.appendChild(cnt);
    cardEl.appendChild(row);
  }
  function swipeGo(dir) {
    var o = swipeOrder(), nx = swipeTarget(o, cardFor, dir); if (nx === cardFor) { return; }
    cardFor = nx; renderCard();
    var reduce = false; try { reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { reduce = false; }
    if (reduce || !cardEl) { return; }
    var rtl = false; try { rtl = getComputedStyle(cardEl).direction === 'rtl'; } catch (e) { rtl = false; }
    var from = ((dir === 'next') === rtl) ? -36 : 36; /* the new card slides in from the side it came from */
    cardEl.style.transition = 'none'; cardEl.style.transform = 'translateX(' + from + 'px)'; cardEl.style.opacity = '0.4';
    void cardEl.offsetWidth;
    cardEl.style.transition = 'transform 200ms ease, opacity 200ms ease'; cardEl.style.transform = ''; cardEl.style.opacity = '';
  }
  function swipeBind(el) {
    el.style.touchAction = 'none'; /* the card handles every drag itself: with pan-y the browser takes over a vertical drag and cancels the pointer before 40px, so swipe-down could never be read (checked in Chrome). The card is small; the rest of the page still scrolls. */
    var sx = 0, sy = 0, down = false;
    el.addEventListener('pointerdown', function (ev) { if (ev.target && ev.target.closest && ev.target.closest('button')) { down = false; return; } down = true; sx = ev.clientX; sy = ev.clientY; try { ev.stopPropagation(); el.setPointerCapture(ev.pointerId); } catch (e) { /* optional */ } }); /* keep the 3D scene from taking the drag */
    el.addEventListener('pointercancel', function () { down = false; });
    el.addEventListener('pointerup', function (ev) {
      if (!down) { return; } down = false;
      var rtl = false; try { rtl = getComputedStyle(el).direction === 'rtl'; } catch (e) { rtl = false; }
      var dir = swipeDir(ev.clientX - sx, ev.clientY - sy, rtl);
      if (dir === 'close') { closeCard(); } else if (dir) { swipeGo(dir); }
    });
  }
  function showCard(id) {
    var host = document.getElementById('office3d'); if (!host) { return false; }
    if (!cardEl) { cardEl = make('div', 'o3-agentcard'); cardEl.style.cssText = 'position:absolute;z-index:30;top:160px;inset-inline-start:12px;width:min(300px,86%);padding:12px 14px;border-radius:14px;background:rgba(8,14,30,.92);color:#fff;border:1px solid rgba(80,200,230,.45);backdrop-filter:blur(8px);box-shadow:0 8px 28px rgba(0,0,0,.5)'; host.appendChild(cardEl); try { swipeBind(cardEl); } catch (e) { /* optional */ } }
    cardFor = String(id); renderCard(); return true;
  }

  var SECRET_RX = [
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
    /(?:\+|00)?\d[\d\s().-]{8,}\d/,
    /\b(?:sk|pk|ghp|gho|ghs|xox[abp]|AKIA|AIza|eyJ|tk|glpat)[-_A-Za-z0-9]{8,}/i,
    /\b[A-Za-z0-9_\-+/=]{28,}\b/,
    /(?:password|passwd|pwd|token|secret|api[-_ ]?key|bearer|cookie|otp|cvv|iban|كلمة\s*(?:السر|المرور)|باسورد|توكن|مفتاح)\s*[:=]/i,
    /https?:\/\/[^\s]*[?&](?:token|key|sig|auth|code)=/i,
    /(?:اسم العميل|رقم الحساب|رقم الكارت|رقم الموبايل)/
  ];
  var ACCOUNT_RX = /(ستوديو|جلسة\s*جوجل|جلسه\s*جوجل|log[\s-]?in|sign[\s-]?in|signed in|studio|2fa|two[\s-]?factor|otp|verification code|captcha|session|cookie|تسجيل\s*(?:ال)?دخول|طلب\s*(?:ال)?دخول|دخول مؤقت|رمز\s*(?:ال)?تحقق|تحقق بخطوتين|كلمة\s*(?:ال)?(?:سر|مرور)|كلمه\s*(?:ال)?(?:سر|مرور)|حظر\s*(?:ال)?حساب|اتحظر|تعليق\s*(?:ال)?حساب)/i;
  function looksPrivate(t) {
    for (var i = 0; i < SECRET_RX.length; i++) { if (SECRET_RX[i].test(t)) { return true; } }
    return false;
  }
  /* Idea 41 (rules 122/123): the public screen shows job names and results only. Free text stays off unless FREE_TEXT_OK is set to true. */ /* PRODUCTION GUARD: this flag must stay false in production. tests/guard-free-text.js fails the build if it is switched on. */ var FREE_TEXT_OK = false; var NOJOB = 'لسه ما بعتش'; function normDigits(s) { return String(s).replace(/[\u0660-\u0669]/g, function (c) { return String(c.charCodeAt(0) - 1632); }).replace(/[\u06F0-\u06F9]/g, function (c) { return String(c.charCodeAt(0) - 1776); }); } function suspicious(t) { var s = normDigits(t); var j = s.replace(/(\d)[\s().\-\u2010-\u2015]+(?=\d)/g, '$1'); return looksPrivate(s) || /\d{5,}/.test(j) || /اسم\s*(?:ال)?عميل/.test(s) || /(?:\+|\b00)\s?\d{2,}/.test(s) || /[A-Za-z0-9._%+-]+\s*(?:@|\[\s*at\s*\]|\(\s*at\s*\)|\sat\s)\s*[A-Za-z0-9-]+\s*(?:\.|\[\s*dot\s*\]|\(\s*dot\s*\)|\sdot\s)\s*[A-Za-z]{2,}/i.test(s) || /(?:https?:\/\/|www\.)/i.test(s) || /\b[A-Za-z0-9-]+\.(?:com|net|org|io|co|app|dev|me|ai|xyz|ly|sh|tv)\b/i.test(s) || /\b[A-Fa-f0-9]{20,}\b/.test(s) || /[A-Za-z0-9_-]{24,}/.test(s) || /(?:كلمة\s*(?:ال)?(?:سر|مرور)|باسورد|رمز\s*(?:ال)?تحقق|كود\s*(?:ال)?تحقق|\botp\b|token|توكن|api[\s_-]*key|تسجيل\s*(?:ال)?دخول|log[\s-]?in|sign[\s-]?in|cookie|كوكي|password|secret)/i.test(s); } function jobSafe(t, n) { if (typeof t !== 'string') { return ''; } var s = t.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim(); if (!s) { return ''; } return (s.length > 60 || suspicious(s)) ? 'شغلانة' : s; } function publicText(t) { if (typeof t !== 'string') { return ''; } var s = t.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim(); if (!s) { return ''; } return (s.length > 100 || suspicious(s)) ? 'شغلانة' : s; } function freeOnly(t, n) { return FREE_TEXT_OK ? cleanText(t, n) : ''; } function scrubFeed(d) { if (!d || typeof d !== 'object') { return d; } (Array.isArray(d.staff) ? d.staff : []).forEach(function (s) { if (s && typeof s === 'object') { s.step = FREE_TEXT_OK ? publicText(s.step) : ''; s.last = FREE_TEXT_OK ? publicText(s.last) : ''; } }); if (d.assistant && typeof d.assistant === 'object') { d.assistant.doing = FREE_TEXT_OK ? publicText(d.assistant.doing) : ''; d.assistant.last = FREE_TEXT_OK ? publicText(d.assistant.last) : ''; } (Array.isArray(d.handoffs) ? d.handoffs : []).forEach(function (h) { if (h && typeof h === 'object') { h.label = jobSafe(h.label, 40); } }); return d; } function cleanText(v, n) {
    if (typeof v !== 'string') { return ''; }
    var t = v.replace(/[\u0000-\u001f]/g, ' ').slice(0, n || 200);
    if (looksPrivate(t)) { return ''; }
    return ACCOUNT_RX.test(t) ? 'نشاط على حساب، التفاصيل مخفية' : t;
  }

  function ingestLive(msg) {
    if (!msg || msg.event !== 'message' || !msg.id || liveSeen[msg.id]) {
      return false;
    }
    liveSeen[msg.id] = true;
    liveLastId = msg.id;
    var body;
    try {
      body = JSON.parse(msg.message);
    } catch (e) {
      return false;
    }
    if (!isObj(body)) {
      return false;
    }
    var iso = new Date((msg.time || Math.floor(Date.now() / 1000)) * 1000).toISOString();
    if (body.t === 'h') {
      var hm = null;
      if (!FREE_TEXT_OK) { hm = null; } else if (typeof body.msg === 'string') { hm = { text: cleanText(body.msg, 200) }; }
      else if (isObj(body.msg)) { hm = { done: cleanText(body.msg.done, 140), missing: cleanText(body.msg.missing, 140), next: cleanText(body.msg.next, 140) }; }
      liveEvents.push({ t: 'h', from: cleanText(body.from, 40), to: cleanText(body.to, 40), label: jobSafe(body.label, 40), job: jobSafe(body.job, 40), jt: jobSafe(body.jt, 40), step: freeOnly(body.step, 40), msg: hm, time: iso });
      return true;
    }
    if (body.t === 'r') {
      liveEvents.push({ t: 'r', job: jobSafe(body.job, 40), jt: jobSafe(body.jt, 40), time: iso });
      return true;
    }
    if (body.t === 'p') {
      var pe = { t: 'p', id: cleanText(body.id, 40), name: cleanText(body.name, 40), title: cleanText(body.title, 60), dept: cleanText(body.dept, 40), time: iso };
      ['state', 'step', 'last'].forEach(function (k) { if (typeof body[k] === 'string') { pe[k] = (k === 'state' || FREE_TEXT_OK) ? cleanText(body[k], k === 'state' ? 20 : 120) : ''; } });
      if (!pe.id || !pe.name) { return false; }
      liveEvents.push(pe);
      return true;
    }
    if (body.t === 's') {
      var ev = { t: 's', id: cleanText(body.id, 40), time: iso };
      ['state', 'step', 'last', 'doing'].forEach(function (k) {
        if (typeof body[k] === 'string') {
          ev[k] = (k === 'state' || FREE_TEXT_OK) ? cleanText(body[k], k === 'state' ? 20 : 120) : '';
        }
      });
      liveEvents.push(ev);
      return true;
    }
    return false;
  }

  function mergedFeed() {
    if (!baseFeed) {
      return null;
    }
    var f = JSON.parse(JSON.stringify(baseFeed));
    var baseMs = Date.parse(f.updated) || 0;
    var newest = baseMs;
    var staff = Array.isArray(f.staff) ? f.staff : [];
    f.handoffs = Array.isArray(f.handoffs) ? f.handoffs : [];
    liveEvents.forEach(function (ev) {
      var ms = Date.parse(ev.time) || 0;
      if (ev.t === 'p') {
        var known = staff.some(function (x) { return x.id === ev.id; });
        if (!known) {
          var dpt = ev.dept || 'tools';
          if (!(f.departments || []).some(function (d) { return d.id === dpt; })) { dpt = 'tools'; }
          staff.push({ id: ev.id, name: ev.name, title: ev.title || '', dept: dpt, level: 'member', state: ev.state || 'waiting', step: ev.step || '', last: ev.last || '', time: ev.time });
        }
        return;
      }
      if (ms <= baseMs) {
        return;
      }
      if (ms > newest) {
        newest = ms;
      }
      if (ev.t === 'r') { return; }
      if (ev.t === 'h') {
        f.handoffs.push({ from: ev.from, to: ev.to, label: ev.label, time: ev.time });
        return;
      }
      if (ev.id === 'mgr') {
        f.assistant = f.assistant || {};
        if (ev.state) { f.assistant.state = ev.state; }
        if (ev.doing) { f.assistant.doing = ev.doing; }
        return;
      }
      for (var i = 0; i < staff.length; i++) {
        if (staff[i].id === ev.id) {
          ['state', 'step', 'last'].forEach(function (k) {
            if (ev[k]) { staff[i][k] = ev[k]; }
          });
          staff[i].time = ev.time;
        }
      }
    });
    // Real activity from the status stream (ntfy): the freshest line counts as activity, and the person's latest line sets their state.
    var AL2 = { 'scout': 't5', 'jessica-dev': 'j2', 'security': 'q14', 'yt-replies': 'c4', 'tiktok': 'v1' };
    var sNow = Date.now();
    var byStaff = {};
    statusLines.forEach(function (e) {
      if (!e || !e.ms || e.ms > sNow + 300000) { return; }
      if (e.ms > newest) { newest = e.ms; }
      var cid = AL2[e.id] || e.id;
      for (var j = 0; j < staff.length; j++) {
        var sj = staff[j];
        if (!isObj(sj) || byStaff[j]) { continue; }
        if ((cid && String(sj.id) === String(cid)) || (e.name && sj.name === e.name)) { byStaff[j] = e; }
      }
    });
    Object.keys(byStaff).forEach(function (j) {
      var e = byStaff[j], sj = staff[j], tt = Date.parse(sj.time);
      if (isFinite(tt) && tt >= e.ms) { return; }
      sj.state = e.state === 'done' ? 'done' : (e.state === 'blocked' ? 'blocked' : 'running');
      sj.step = publicText(e.text) || 'شغلانة';
      sj.time = new Date(e.ms).toISOString();
    });
    f.updated = new Date(newest).toISOString();
    return f;
  }

  function applyMerged() {
    var m = mergedFeed();
    if (m) {
      applyFeed(m);
    }
    try { renderLog(); } catch (e) { /* ok */ }
  }

  // ---- Job pipeline + first-person conversation log (built from live handoff events) ----
  var logPanel = null;
  function nameOf(id) {
    if (id === 'mgr') { return (baseFeed && baseFeed.assistant && baseFeed.assistant.name) || 'ريم'; }
    var p = staffById.get(String(id)); return p && p.name ? p.name : String(id || '—');
  }
  function roleOfId(id) {
    if (id === 'mgr') { return 'المديرة'; }
    var p = staffById.get(String(id)); return p && p.title ? p.title : '';
  }
  function hhmm(iso) {
    try { return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Dubai' }).format(new Date(iso)); } catch (e) { return ''; }
  }
  function ensureLogPanel() {
    if (logPanel) { return logPanel; }
    var host = document.getElementById('office3d'); if (!host) { return null; }
    logPanel = make('aside', 'o3-log');
    logPanel.innerHTML = '<div class="o3-log-head"><b>سجل الشغل</b><span>بصيغة كل واحد بنفسه</span></div><div class="o3-jobtog" style="display:flex;gap:6px;margin:6px 0"></div><div class="o3-pipes"></div><ul class="o3-lines"></ul>';
    (function () { var tg = logPanel.querySelector('.o3-jobtog'); [['السجل', false], ['الشغلانات', true]].forEach(function (a) { var bt = make('button', ''); bt.type = 'button'; bt.textContent = a[0]; bt.style.cssText = 'flex:1;padding:6px;border-radius:10px;border:1px solid rgba(80,200,230,.4);background:rgba(255,255,255,.06);color:#fff;font-size:12px;cursor:pointer'; bt.addEventListener('click', function () { jobsMode = a[1]; renderLog(); Array.prototype.forEach.call(tg.children, function (c, i) { c.style.background = (i === 1) === jobsMode ? 'rgba(43,176,160,.45)' : 'rgba(255,255,255,.06)'; }); }); tg.appendChild(bt); }); tg.children[0].style.background = 'rgba(43,176,160,.45)'; })();
    host.appendChild(logPanel);
    return logPanel;
  }

  var jobsMode = false;
  function renderJobs(lines, pipes) {
    var latest = {}, order = [];
    statusLines.forEach(function (e) { var k = (e.id || e.name || '?') + '|' + (e.job || ''); if (!latest[k]) { latest[k] = e; order.push(k); } });
    var jobs = {}, jo = [];
    order.forEach(function (k) { var e = latest[k], jn = e.job || 'من غير شغلانة محددة'; if (!jobs[jn]) { jobs[jn] = []; jo.push(jn); } jobs[jn].push(e); });
    if (!jo.length) { var em = make('li', 'o3-empty'); em.textContent = 'مفيش شغلانات وصلت من الموظفين لسه (الحقل job).'; lines.appendChild(em); return; }
    jo.forEach(function (jn) {
      var ag = jobs[jn], dn = 0, pd = 0, hasNum = false, fin = true, res = '';
      ag.forEach(function (e) { if (e.done >= 0 && e.pending >= 0) { dn += e.done; pd += e.pending; hasNum = true; } if (e.state !== 'done') { fin = false; } if (e.result === 'got') { res = 'got'; } else if (e.result === 'pending' && res !== 'got') { res = 'pending'; } else if (e.result === 'none' && !res) { res = 'none'; } });
      if (hasNum && pd > 0) { fin = false; }
      var li = make('li', 'o3-line'); li.style.marginBottom = '8px';
      var t = make('div', ''); t.style.cssText = 'font-weight:800;font-size:13px'; t.textContent = jn + '، ' + arN(ag.length, A_EMP) + '، ' + (fin ? '✓ خلصت' : '● لسه شغالة'); li.appendChild(t);
      var rl = make('div', ''); rl.style.cssText = 'font-size:14px;color:#b9cce2'; rl.textContent = 'النتيجة: ' + (res === 'got' ? 'طلعت نتيجة' : res === 'none' ? 'مفيش نتيجة' : res === 'pending' ? 'لسه مستنية' : 'لسه ما اتبعتش'); li.appendChild(rl);
      if (hasNum) { var tot = dn + pd, pc = tot ? Math.round(dn * 100 / tot) : 0; var bar = make('div', ''); bar.style.cssText = 'height:7px;border-radius:6px;background:rgba(255,255,255,.12);margin:5px 0;overflow:hidden'; var f = make('div', ''); f.style.cssText = 'height:100%;background:#2bb0a0;width:' + pc + '%'; bar.appendChild(f); li.appendChild(bar); var pl = make('div', ''); pl.style.cssText = 'font-size:11px;color:#8aa3bf'; pl.textContent = dn + ' اتعمل / ' + pd + ' فاضل (' + pc + '%)'; li.appendChild(pl); }
      ag.forEach(function (e) { var d = make('div', ''); d.style.cssText = 'font-size:14px;margin-top:3px'; d.textContent = (e.name || e.id || '؟') + ': ' + (e.state === 'done' ? '✓ ' : e.state === 'blocked' ? '■ واقف ' : '● ') + e.text + (e.next ? ' ← الجاي: ' + e.next : ''); li.appendChild(d); });
      lines.appendChild(li);
    });
  }

  /* IDEA46-BEGIN. Task mix donut. Fixed categories only. The ONE mapping table from department id to category is MIX_CAT_OF. Counts and percentages only, no job names or text. */
  var MIX_CAT_OF = { content: 'content', trend: 'research', seo: 'research', video: 'publishing', mail: 'publishing', jessica: 'development', tools: 'development', qa: 'maintenance' };
  var MIX_CATS = [['content', 'محتوى', '#f4511e'], ['development', 'تطوير', '#22d3ee'], ['research', 'بحث', '#8b5cf6'], ['publishing', 'نشر', '#fbbf24'], ['maintenance', 'صيانة', '#9aa8bd']];
  function mixCounts(now) {
    var d0 = new Date(now || Date.now()); d0.setHours(0, 0, 0, 0);
    var out = { content: 0, development: 0, research: 0, publishing: 0, maintenance: 0 }, total = 0;
    statusLines.forEach(function (e) {
      if (e.state !== 'done' || !(e.ms >= d0.getTime())) { return; }
      var c = MIX_CAT_OF[deptOf(e.id || e.name || '?')];
      if (c) { out[c]++; total++; }
    });
    return { n: out, total: total };
  }
  function renderMix() {
    var host = document.getElementById('o3-summary'); if (!host) { return; }
    var box = document.getElementById('o3-mix'), m = mixCounts();
    if (!m.total) { if (box) { box.remove(); } return; }
    if (!box) {
      box = document.createElement('div'); box.id = 'o3-mix';
      box.style.cssText = 'display:flex;align-items:center;gap:12px;padding:8px 14px;margin:6px auto;width:fit-content;max-width:calc(100vw - 16px);box-sizing:border-box;justify-content:center;border-radius:18px;background:rgba(7,13,24,.82);border:1px solid rgba(139,92,246,.55);color:#fff;font-size:14px;font-weight:700;line-height:1.5;direction:rtl;flex-wrap:wrap';
      host.parentNode.insertBefore(box, host.nextSibling);
    }
    box.textContent = '';
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), off = 0, info = [];
    svg.setAttribute('viewBox', '0 0 36 36'); svg.setAttribute('width', '64'); svg.setAttribute('height', '64'); svg.setAttribute('role', 'img');
    var ring = document.createElementNS(NS, 'circle'); ring.setAttribute('cx', '18'); ring.setAttribute('cy', '18'); ring.setAttribute('r', '15.9155'); ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#1b2a44'); ring.setAttribute('stroke-width', '5'); svg.appendChild(ring);
    MIX_CATS.forEach(function (c) {
      var n = m.n[c[0]]; if (!n) { return; }
      var pct = Math.round(n * 100 / m.total), len = n * 100 / m.total;
      var cir = document.createElementNS(NS, 'circle'); cir.setAttribute('cx', '18'); cir.setAttribute('cy', '18'); cir.setAttribute('r', '15.9155'); cir.setAttribute('fill', 'none'); cir.setAttribute('stroke', c[2]); cir.setAttribute('stroke-width', '5');
      cir.setAttribute('stroke-dasharray', Math.max(0, len - 1.2) + ' ' + (100 - Math.max(0, len - 1.2))); cir.setAttribute('stroke-dashoffset', String(-off)); cir.setAttribute('transform', 'rotate(-90 18 18)');
      svg.appendChild(cir); off += len; info.push([c[1], n, pct, c[2]]);
    });
    svg.setAttribute('aria-label', 'توزيع الشغل النهارده: ' + info.map(function (i) { return i[0] + ' ' + i[1]; }).join('، '));
    box.appendChild(svg);
    var txt = document.createElement('div'); var h = document.createElement('div'); h.textContent = 'خلص النهارده: ' + m.total; txt.appendChild(h);
    info.forEach(function (i) { var r = document.createElement('div'); r.className = 'o3-mixrow'; var dot = document.createElement('span'); dot.textContent = '\u25CF '; dot.style.color = i[3]; var t = document.createElement('span'); t.textContent = i[0] + ' ' + i[1] + ' (' + i[2] + '%)'; r.appendChild(dot); r.appendChild(t); txt.appendChild(r); });
    box.appendChild(txt);
  }
  /* IDEA46-END */
  /* IDEA47-BEGIN. Read the summary aloud with the device voice (speechSynthesis, ar-EG then ar-SA). Free, no keys, nothing leaves the device. The spoken text is built only from numbers and fixed words and categories, never job names or text. */
  var lastSum = null, speakPrev = null, speakAt = 0;
  function speakOk() { return typeof window !== 'undefined' && window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function'; }
  function speakText(sm, mix) {
    var t = 'ملخص الشغل. ' + sm.working + ' شغالين. ' + sm.done + ' خلصوا. ';
    if (sm.late) { t += sm.late + ' ممكن يتأخروا. '; }
    if (sm.stuck) { t += sm.stuck + ' واقفين. '; }
    if (mix && mix.total) {
      t += 'خلص النهارده ' + mix.total + '. ';
      MIX_CATS.forEach(function (c) { if (mix.n[c[0]]) { t += c[1] + ' ' + mix.n[c[0]] + '. '; } });
    }
    return t;
  }
  function speakLang() {
    var vs = [], pick = null;
    try { vs = window.speechSynthesis.getVoices() || []; } catch (e) { vs = []; }
    function norm(v) { return String(v.lang || '').replace('_', '-').toLowerCase(); }
    vs.forEach(function (v) { if (!pick && norm(v) === 'ar-eg') { pick = { lang: 'ar-EG', voice: v }; } });
    if (!pick) { vs.forEach(function (v) { if (!pick && norm(v) === 'ar-sa') { pick = { lang: 'ar-SA', voice: v }; } }); }
    return pick || { lang: 'ar-SA', voice: null };
  }
  function speakNow() {
    if (!speakOk() || !lastSum) { return false; }
    var u = new window.SpeechSynthesisUtterance(speakText(lastSum, mixCounts())), l = speakLang();
    u.lang = l.lang; if (l.voice) { u.voice = l.voice; }
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); speakAt = Date.now();
    return true;
  }
  function speakAuto() { try { return localStorage.getItem('ws_speak_auto') === '1'; } catch (e) { return false; } }
  function speakAlertCheck(sm, now) {
    var go = false;
    if (speakPrev && speakAuto() && ((sm.late > speakPrev.late) || (sm.stuck > speakPrev.stuck)) && ((now || Date.now()) - speakAt > 120000)) { go = true; }
    speakPrev = { late: sm.late, stuck: sm.stuck };
    return go;
  }
  function renderSpeak() {
    var host = document.getElementById('o3-summary'); if (!host || !speakOk()) { return; }
    var row = document.getElementById('o3-speak');
    if (!row) {
      row = document.createElement('div'); row.id = 'o3-speak';
      row.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:6px auto;max-width:calc(100vw - 16px);direction:rtl';
      var st = 'min-height:44px;min-width:44px;padding:6px 14px;border-radius:999px;border:1px solid #22d3ee;background:#070d18;color:#fff;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer';
      var b1 = document.createElement('button'); b1.type = 'button'; b1.id = 'o3-speak-now'; b1.style.cssText = st; b1.textContent = '\uD83D\uDD0A اقرأ الملخص';
      b1.addEventListener('click', function () { speakNow(); });
      var b2 = document.createElement('button'); b2.type = 'button'; b2.id = 'o3-speak-auto'; b2.style.cssText = st;
      function lab() { var on = speakAuto(); b2.textContent = on ? 'قراءة التنبيه: شغالة' : 'قراءة التنبيه: مقفولة'; b2.setAttribute('aria-pressed', on ? 'true' : 'false'); }
      b2.addEventListener('click', function () { try { localStorage.setItem('ws_speak_auto', speakAuto() ? '0' : '1'); } catch (e) { /* optional */ } lab(); });
      lab(); row.appendChild(b1); row.appendChild(b2);
      host.parentNode.insertBefore(row, host.nextSibling);
    }
    if (lastSum && speakAlertCheck(lastSum)) { speakNow(); }
  }
  /* IDEA47-END */
  /* IDEA48-BEGIN. One-time "add to home screen" hint, only on iPhone/iPad Safari when the page is not already opened from the home screen. Dismissal is remembered on this device only (ws_a2hs_seen). No network, no tracking. */
  function a2hsNeeded(env) {
    var ios = /iPhone|iPad|iPod/.test(env.ua || '') || (env.platform === 'MacIntel' && env.touch > 1);
    if (!ios) { return false; }
    if (env.standalone || env.navStandalone) { return false; }
    if (env.seen) { return false; }
    return true;
  }
  function a2hsEnv() {
    var mq = false, ns = false, seen = false;
    try { mq = !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); } catch (e) { mq = false; }
    try { ns = navigator.standalone === true; } catch (e) { ns = false; }
    try { seen = localStorage.getItem('ws_a2hs_seen') === '1'; } catch (e) { seen = false; }
    return { ua: navigator.userAgent, platform: navigator.platform, touch: navigator.maxTouchPoints || 0, standalone: mq, navStandalone: ns, seen: seen };
  }
  function renderA2hs() {
    if (document.getElementById('o3-a2hs') || !a2hsNeeded(a2hsEnv())) { return; }
    var row = document.createElement('div'); row.id = 'o3-a2hs'; row.setAttribute('role', 'note');
    row.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin:6px auto;padding:6px 12px;width:fit-content;max-width:calc(100vw - 16px);box-sizing:border-box;border-radius:18px;background:#070d18;border:1px solid #22d3ee;color:#fff;font-size:14px;font-weight:700;line-height:1.5;direction:rtl';
    var t = document.createElement('span'); t.textContent = 'شارك ← إضافة للشاشة الرئيسية';
    var b = document.createElement('button'); b.type = 'button'; b.id = 'o3-a2hs-x'; b.textContent = 'تمام';
    b.style.cssText = 'min-height:44px;min-width:44px;padding:6px 14px;border-radius:999px;border:1px solid #22d3ee;background:#070d18;color:#fff;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer';
    b.addEventListener('click', function () { try { localStorage.setItem('ws_a2hs_seen', '1'); } catch (e) { /* optional */ } if (row.parentNode) { row.parentNode.removeChild(row); } });
    row.appendChild(t); row.appendChild(b);
    document.body.insertBefore(row, document.body.firstChild);
  }
  /* IDEA48-END */
  function renderSummary() {
    var bar = document.getElementById('o3-summary');
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'o3-summary';
      bar.style.cssText = 'position:static;display:flex;gap:8px;padding:6px 12px;margin:6px auto;width:fit-content;max-width:calc(100vw - 16px);box-sizing:border-box;justify-content:center;border-radius:999px;background:rgba(7,13,24,.82);border:1px solid rgba(244,81,30,.55);color:#fff;font-size:15px;font-weight:700;white-space:nowrap;direction:rtl';
      var hd = document.querySelector('header.topbar') || document.querySelector('header');
      if (hd && hd.parentNode) { hd.parentNode.insertBefore(bar, hd.nextSibling); } else { document.body.insertBefore(bar, document.body.firstChild); }
    }
    var cutoff = Date.now() - 30 * 60000, latest = {}, k;
    statusLines.forEach(function (e) { k = e.id || e.name || '?'; if (!latest[k]) { latest[k] = e; } });
    var working = 0, done = 0, stuck = 0, jobs = {}, pend = 0, vOk = 0, vNo = 0, lateN = 0;
    Object.keys(latest).forEach(function (id) { var e = latest[id]; if (e.ms < cutoff) { return; } if (e.state === 'done') { done++; if (e.ver === true) { vOk++; } else if (e.ver === false) { vNo++; } } else if (e.state === 'blocked') { stuck++; } else { working++; } if (e.job) { jobs[e.job] = 1; } if (e.pending > 0) { pend += e.pending; } });
    try { lateN = lateCount(); } catch (e) { lateN = 0; }
    var nj = Object.keys(jobs).length;
    lastSum = { working: working, done: done, stuck: stuck, late: lateN };
    function build(short) {
      var parts = [['\u25CF ' + working + (short || working === 1 ? ' شغال' : ' شغالين'), '#f4511e'], ['\u2713 ' + done + (short || done === 1 ? ' خلص' : ' خلصوا'), '#22d3ee']];
      if (vOk) { parts.push(['\u2611 ' + vOk + (vOk === 1 ? ' اتراجع' : ' اتراجعوا'), '#22d3ee']); }
      if (vNo) { parts.push(['\u25D4 ' + vNo + ' مستني مراجعة', '#fbbf24']); }
      if (lateN) { parts.push(['\u26A0 ' + lateN + (short || lateN === 1 ? ' ممكن يتأخر' : ' ممكن يتأخروا'), '#fbbf24']); }
      if (stuck) { parts.push(['\u25A0 ' + stuck + (stuck === 1 ? ' واقف' : ' واقفين'), '#f87171']); }
      parts.push([(nj === 1 ? '1 شغلانة' : arN(nj, A_JOB)), '#8b5cf6']);
      if (pend && !short) { parts.push([pend + ' معلّق', '#9aa8bd']); }
      parts.push(['(آخر 30 دقيقة)', '#b9cce2']);
      bar.textContent = '';
      parts.forEach(function (p) { var sp = document.createElement('span'); sp.textContent = p[0]; sp.style.color = p[1]; bar.appendChild(sp); });
      bar.title = pend ? ('معلّق: ' + pend) : '';
    }
    bar.style.flexWrap = 'nowrap'; bar.style.borderRadius = '999px'; bar.style.gap = '8px';
    build(false);
    var lim = (document.documentElement.clientWidth || window.innerWidth || 360) - 28;
    function tooWide() { return bar.scrollWidth > bar.clientWidth + 1 || bar.getBoundingClientRect().width > lim; }
    if (tooWide()) { build(true); }
    if (tooWide()) { bar.style.flexWrap = 'wrap'; bar.style.whiteSpace = 'normal'; bar.style.borderRadius = '18px'; bar.style.gap = '4px 10px'; }
    try { renderMix(); } catch (e) { /* optional */ }
    try { renderSpeak(); } catch (e) { /* optional */ }
    try { renderA2hs(); } catch (e) { /* optional */ }
  }


  // ---- Idea 20: "محتاج قرارك" read-only decision card. Display only: the answer goes to Reem outside the screen. ----
  var decOpen = false, decPick = {}, decFocus = '', decCopied = {};
  function ageWords(m) {
    if (m < 60) { return arN(Math.max(1, m), A_MIN); }
    var d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), r = m % 60;
    function hw(h) { return h === 1 ? 'ساعة' : (h === 2 ? 'ساعتين' : (h <= 10 ? h + ' ساعات' : h + ' ساعة')); }
    if (d >= 1) { var dw = d === 1 ? 'يوم' : (d === 2 ? 'يومين' : (d <= 10 ? d + ' أيام' : d + ' يوم')); return hh ? dw + ' و' + hw(hh) : dw; }
    return r ? hw(hh) + ' و' + arN(r, A_MIN) : hw(hh);
  }
  function decAge(ms) { return 'من ' + ageWords(Math.max(0, Math.floor((Date.now() - ms) / 60000))); }
  /* Idea 22: pending count per staff member from the latest status line that carries real numbers. Missing = no data (never zero). */
  function publishLoad() {
    var AL3 = { 'scout': 't5', 'jessica-dev': 'j2', 'security': 'q14', 'yt-replies': 'c4', 'tiktok': 'v1' }, L = {}, LM = {}, seen = {}, staff = (baseFeed && baseFeed.staff) || [], cut = Date.now() - 2 * 3600000;
    statusLines.forEach(function (e) {
      if (!e || e.ms < cut) { return; }
      var cid = AL3[e.id] || e.id, k = e.id || e.name;
      if (seen[k]) { return; } seen[k] = 1;
      if (e.pending < 0) { return; }  /* the latest line decides: a newer line without numbers cancels the old number */
      for (var i = 0; i < staff.length; i++) { var sj = staff[i]; if (isObj(sj) && ((cid && String(sj.id) === String(cid)) || (e.name && sj.name === e.name))) { L[String(sj.id)] = e.pending; LM[String(sj.id)] = e.ms; break; } }
    });
    window.__o3Load = L; window.__o3LoadMs = LM; renderLegend(Object.keys(L).length > 0);
  }
  function renderLegend(show) {
    var sum = document.getElementById('o3-summary'), lg = document.getElementById('o3-heatlg');
    if (!show || !sum) { if (lg) { lg.remove(); } return; }
    if (!lg) {
      lg = document.createElement('div'); lg.id = 'o3-heatlg'; lg.setAttribute('dir', 'rtl');
      lg.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;margin:2px auto 4px;font-size:14px;color:#b9cce2';
      var a = document.createElement('span'); a.textContent = 'معلّق: 0'; var b = document.createElement('span'); b.style.cssText = 'display:inline-block;width:90px;height:8px;border-radius:6px;background:linear-gradient(to left,#22d3ee,#8b5cf6,#f4511e)'; var c = document.createElement('span'); c.textContent = '8 فأكتر (حجم القرص ولونه)';
      lg.appendChild(a); lg.appendChild(b); lg.appendChild(c); sum.parentNode.insertBefore(lg, sum.nextSibling);
    }
  }
  /* Idea 23: search box + state filters. Display only; the 3D side does the dimming. */
  var SF = [['all', 'الكل'], ['running', 'شغال'], ['waiting', 'مستني'], ['done', 'خلّص'], ['late', 'متأخر']], sFilter = 'all', sBtns = {}, sInput = null, sCount = null;
  var sBox = null, sClear = null;
  function clearSearch() { sInput.value = ''; sFilter = 'all'; runSearch(false); if (document.activeElement === sInput) { sInput.blur(); } }
  function runSearch(fly) {
    if (!window.Office3D || !window.Office3D.search || !sInput) { return; }
    var r = null; try { r = window.Office3D.search(sInput.value, sFilter, fly); } catch (e) { r = null; }
    Object.keys(sBtns).forEach(function (k) { var on = k === sFilter; sBtns[k].setAttribute('aria-pressed', on ? 'true' : 'false'); sBtns[k].style.background = on ? '#c2410c' : '#070d18'; sBtns[k].style.color = '#fff'; });
    showSearchRes(r);
  }
  function showSearchRes(r) {
    if (!sCount) { return; }
    if (sClear) { sClear.style.display = (r && r.on) ? '' : 'none'; }
    if (!r || !r.on) { sCount.textContent = ''; return; }
    var t = r.n ? ('النتيجة: ' + r.n + ' من ' + r.total + ' مكتب') : (r.feedOld ? 'الفيد كله قديم، مفيش بيانات حديثة تتفلتر' : 'مفيش نتيجة');
    if (sFilter !== 'all') { t += ' (حسب المكاتب في المشهد، مش أرقام الملخص)'; }
    if (r.outBlocked) { t += '، وفيه ' + r.outBlocked + ' محتاج تدخل برّه النتيجة'; }
    if (sCount.textContent !== t) { sCount.textContent = t; }
  }
  window.__o3SearchCb = showSearchRes;
  function ensureSearch() {
    var sum = document.getElementById('o3-summary'); if (!sum || document.getElementById('o3-search')) { return; }
    var stl = document.createElement('style'); stl.textContent = '#o3-search input::placeholder{color:#b9cce2;opacity:1}'; document.head.appendChild(stl);
    var box = document.createElement('div'); box.id = 'o3-search'; box.setAttribute('dir', 'rtl'); box.setAttribute('role', 'search');
    box.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;margin:4px auto;width:min(640px,calc(100vw - 16px));box-sizing:border-box';
    sInput = document.createElement('input'); sInput.type = 'search'; sInput.placeholder = 'دوّر باسم أو مهمة'; sInput.title = 'Alt + / للبحث'; sInput.setAttribute('aria-label', 'بحث في الموظفين'); sInput.autocomplete = 'off';
    sInput.style.cssText = 'flex:1 1 160px;min-width:140px;min-height:44px;box-sizing:border-box;padding:6px 14px;border-radius:999px;background:#070d18;border:1px solid #22d3ee;color:#fff;font:600 16px "Noto Kufi Arabic",sans-serif';
    sInput.addEventListener('input', function () { runSearch(false); });
    sInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { runSearch(true); sInput.blur(); } });
    box.appendChild(sInput);
    SF.forEach(function (f, i) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = f[1]; b.title = f[1] + ' (Alt + ' + (i + 1) + ')';
      b.style.cssText = 'min-height:44px;min-width:44px;padding:6px 12px;border-radius:999px;border:1px solid #f4511e;cursor:pointer;font:700 14px "Noto Kufi Arabic",sans-serif';
      b.addEventListener('click', function () { sFilter = f[0]; runSearch(true); });
      sBtns[f[0]] = b; box.appendChild(b);
    });
    sClear = document.createElement('button'); sClear.type = 'button'; sClear.textContent = 'مسح'; sClear.style.cssText = 'display:none;min-height:44px;min-width:44px;padding:6px 14px;border-radius:999px;border:1px solid #22d3ee;background:#070d18;color:#fff;cursor:pointer;font:700 14px "Noto Kufi Arabic",sans-serif';
    sClear.title = 'مسح البحث والفلتر (Esc)'; sClear.addEventListener('click', function () { clearSearch(); sInput.focus(); });
    box.insertBefore(sClear, sInput.nextSibling); sBox = box;
    sCount = document.createElement('span'); sCount.setAttribute('role', 'status'); sCount.setAttribute('aria-live', 'polite'); sCount.style.cssText = 'flex:1 0 100%;text-align:center;font-size:14px;color:#b9cce2;min-height:18px';
    box.appendChild(sCount);
    sum.parentNode.insertBefore(box, sum.nextSibling);
    runSearch(false);
  }
  /* WCAG 2.1.4: no single-key shortcuts. Alt+/ and Alt+1..5 work anywhere; Esc only clears while the search box has focus. */
  document.addEventListener('keydown', function (e) {
    if (!sInput || e.ctrlKey || e.metaKey) { return; }
    if (e.key === 'Escape' && sBox && sBox.contains(e.target)) { clearSearch(); return; }
    if (!e.altKey) { return; }
    if (e.code === 'Slash') { e.preventDefault(); sInput.focus(); }
    else if (/^Digit[1-5]$/.test(e.code)) { e.preventDefault(); sFilter = SF[+e.code.slice(5) - 1][0]; runSearch(true); }
  });
  /* Idea 24: "ملخص اليوم". All numbers come from the stored status lines (what this browser has seen), Dubai day. No upload; the PNG is saved on the device. */
  var sumOpen = false;
  function dubaiHour(ms) { return new Date(ms + 4 * 3600000).getUTCHours(); }  /* Dubai is UTC+4 all year (no DST), so this never depends on the device zone */
  function dubaiMidnight(now) { var d = new Date(now + 4 * 3600000); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 4 * 3600000; }
  function hhmm(ms) { try { return fmtDubai(new Date(ms)).slice(0, 5); } catch (e) { return ''; } }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function dubaiParts(ms) { var d = new Date(ms + 4 * 3600000); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() }; }
  window.__o3Day = { hour: dubaiHour, midnight: dubaiMidnight };
  /* A "task" = one employee + one job (distinct). An "update" = one status line. Three updates on the same job = 1 task, 3 updates. */
  function dayStats() {
    var now = Date.now(), t0 = dubaiMidnight(now), ev = statusLines.filter(function (e) { return e && e.ms >= t0 && e.ms <= now + 60000; }).sort(function (a, b) { return a.ms - b.ms; });
    var hours = []; for (var h = 0; h < 24; h++) { hours.push(0); }
    var tasks = {}, last = {}, wait = null;
    ev.forEach(function (e) {
      hours[dubaiHour(e.ms)]++;
      var who = e.name || e.id || '؟', tk = who + '|' + (e.job || '(بدون شغلانة)');
      tasks[tk] = { who: who, state: e.state };
      var k = e.id || e.name || '?';
      if (last[k] && last[k].state === 'blocked') { var d = e.ms - last[k].ms; if (!wait || d > wait.ms) { wait = { ms: d, who: who, open: false }; } }
      last[k] = e;
    });
    Object.keys(last).forEach(function (k) { var e = last[k]; if (e.state === 'blocked') { var d = now - e.ms; if (!wait || d > wait.ms) { wait = { ms: d, who: e.name || e.id || '؟', open: true }; } } });
    var tk = Object.keys(tasks), doneBy = {}, doneT = 0;
    tk.forEach(function (k) { if (tasks[k].state === 'done') { doneT++; doneBy[tasks[k].who] = (doneBy[tasks[k].who] || 0) + 1; } });
    var rank = Object.keys(doneBy).map(function (k) { return [k, doneBy[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    if (rank.length > 5) { var cut5 = rank[4][1]; rank = rank.filter(function (r, i) { return i < 5 || r[1] === cut5; }); }
    var bm = 0; hours.forEach(function (v) { if (v > bm) { bm = v; } });
    var busy = []; if (bm > 0) { hours.forEach(function (v, i) { if (v === bm) { busy.push(i); } }); }
    return { ev: ev, hours: hours, rank: rank, total: tk.length, done: doneT, busy: busy, busiestN: bm, wait: wait, first: ev.length ? ev[0].ms : 0, now: now, capped: statusLines.length >= 500 };
  }
  function hrRange(h) { return p2(h) + ':00 إلى ' + p2(h) + ':59'; }
  function drawHours(cv, hours) {
    var W = 320, H = 126, dpr = Math.min(3, window.devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr; cv.style.width = '100%'; cv.style.maxWidth = W + 'px'; cv.style.height = 'auto';
    var c = cv.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, W, H);
    var mx = Math.max(1, Math.max.apply(null, hours)), bw = W / 24, top = 20, base = H - 20;
    c.fillStyle = '#22d3ee'; c.font = '14px "Noto Sans Mono",monospace'; c.textAlign = 'center';
    hours.forEach(function (v, i) { var bh = Math.round((base - top) * v / mx); if (v) { c.fillRect(i * bw + 2, base - bh, bw - 4, bh); } });
    /* One label per run of adjacent max bars (centred over the run); a label is skipped if it would touch the previous one (Rule 105). */
    var lastR = -1e9, i2 = 0;
    while (i2 < 24) {
      if (hours[i2] === mx && mx > 0) {
        var j2 = i2; while (j2 + 1 < 24 && hours[j2 + 1] === mx) { j2++; }
        var cx = (i2 + j2 + 1) * bw / 2, tw = c.measureText(String(mx)).width;
        if (cx - tw / 2 > lastR + 4) { c.fillStyle = '#ffffff'; c.fillText(String(mx), cx, top - 6); c.fillStyle = '#22d3ee'; lastR = cx + tw / 2; }
        i2 = j2 + 1;
      } else { i2++; }
    }
    c.fillStyle = '#b9cce2';
    [0, 6, 12, 18, 23].forEach(function (i) { c.fillText(String(i), i * bw + bw / 2, H - 2); });
    c.fillStyle = '#f4511e'; c.fillRect(0, base + 1, W, 1);
  }
  function renderDaySummary() {
    var sum = document.getElementById('o3-summary'); if (!sum) { return; }
    var btn = document.getElementById('o3-daybtn'), pan = document.getElementById('o3-daypan');
    if (!btn) {
      btn = document.createElement('button'); btn.id = 'o3-daybtn'; btn.type = 'button'; btn.textContent = 'ملخص اليوم'; btn.setAttribute('aria-expanded', 'false');
      btn.style.cssText = 'display:block;margin:4px auto;padding:6px 18px;min-height:44px;border-radius:999px;background:#070d18;border:1px solid #22d3ee;color:#fff;font:700 15px "Noto Kufi Arabic",sans-serif;cursor:pointer';
      btn.addEventListener('click', function () { sumOpen = !sumOpen; renderDaySummary(); });
      var anchor = document.getElementById('o3-search') || sum; anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    }
    btn.setAttribute('aria-expanded', sumOpen ? 'true' : 'false'); btn.textContent = sumOpen ? 'ملخص اليوم ▴' : 'ملخص اليوم ▾';
    if (!sumOpen) { if (pan) { pan.remove(); } return; }
    var st = dayStats(), sig = st.ev.length + ':' + (st.ev.length ? st.ev[st.ev.length - 1].ms : 0) + ':' + Math.floor(st.now / 60000);
    if (pan && pan.__sig === sig) { return; }
    if (!pan) { pan = document.createElement('div'); pan.id = 'o3-daypan'; pan.setAttribute('dir', 'rtl'); pan.setAttribute('role', 'region'); pan.setAttribute('aria-label', 'ملخص اليوم'); pan.style.cssText = 'margin:4px auto 8px;width:min(560px,calc(100vw - 20px));box-sizing:border-box;padding:12px 14px;border-radius:18px;background:rgba(7,13,24,.88);border:1px solid rgba(34,211,238,.45);color:#fff;font-size:14px;line-height:1.8;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)'; btn.parentNode.insertBefore(pan, btn.nextSibling); }
    pan.__sig = sig; pan.textContent = '';
    function row(t, strong) { var d = document.createElement('div'); d.textContent = t; if (strong) { d.style.fontWeight = '700'; } pan.appendChild(d); return d; }
    if (!st.ev.length) { row('مفيش بيانات النهارده اتخزنت على الجهاز ده لسه.', true); }
    else {
      row('عدد المهام النهارده: ' + arN(st.total, A_TASK) + ' (المهمة = موظف وشغلانة مختلفة)، خلص منها ' + arN(st.done, A_TASK), true);
      row('عدد التحديثات النهارده: ' + arN(st.ev.length, A_UPD) + ' (كل سطر حالة يتعدّ مرة)');
      row('أكتر ناس خلّصت مهام:');
      if (st.rank.length) { var shown = st.rank.slice(0, 5), more = st.rank.length - shown.length, tie = shown.length > 1 && shown[0][1] === shown[shown.length - 1][1]; shown.forEach(function (r, i) { row((i + 1) + '. ' + r[0] + ': خلّص ' + arN(r[1], A_TASK) + (tie ? ' (تعادل)' : '')).style.paddingInlineStart = '12px'; }); if (more > 0) { row('و' + arN(more, A_EMP) + ' كمان بنفس العدد (' + arN(shown[4][1], A_TASK) + ')').style.paddingInlineStart = '12px'; } } else { row('لسه محدش خلّص مهمة').style.paddingInlineStart = '12px'; }
      row(st.busy.length ? ('أزحم ' + (st.busy.length > 1 ? 'ساعات (تعادل): ' : 'ساعة: ') + st.busy.slice(0, 3).map(hrRange).join('، ') + (st.busy.length > 3 ? ' وغيرها' : '') + ' بتوقيت دبي، ' + arN(st.busiestN, A_UPD) + ' في الساعة') : 'أزحم ساعة: مفيش بيانات');
      row(st.wait ? ('أطول وقفة: ' + st.wait.who + '، ' + ageWords(Math.max(1, Math.floor(st.wait.ms / 60000))) + (st.wait.open ? ' ولسه واقف' : '')) : 'أطول وقفة: مفيش وقفات النهارده');
      var cv = document.createElement('canvas'); cv.setAttribute('role', 'img');
      cv.setAttribute('aria-label', 'رسم أعمدة لعدد التحديثات في كل ساعة بتوقيت دبي. ' + (st.busy.length ? 'أعلى ساعة ' + hrRange(st.busy[0]) + ' بـ ' + arN(st.busiestN, A_UPD) + '.' : 'مفيش تحديثات.'));
      cv.style.cssText = 'display:block;margin:8px auto 2px;direction:ltr'; pan.appendChild(cv); drawHours(cv, st.hours);
      row('عدد التحديثات في كل ساعة بتوقيت دبي (الساعات من 0 لـ23، الرقم الأبيض هو أعلى عمود)').style.color = '#b9cce2';
      row('الأرقام من اللي الجهاز ده شافه وخزّنه: أقدم سطر محتفظ بيه النهارده الساعة ' + hhmm(st.first) + ' بتوقيت دبي، والوقت دلوقتي ' + hhmm(st.now) + (st.capped ? '. الجهاز بيحتفظ بآخر 500 سطر بس، فالأقدم ممكن يكون اتشال.' : '. لو الصفحة اتفتحت متأخر ممكن يكون فيه تحديثات أقدم ما اتخزنتش.')).style.color = '#b9cce2';
    }
    var sb = document.createElement('button'); sb.type = 'button'; sb.textContent = 'لقطة'; sb.title = 'حفظ صورة للمشهد على جهازك';
    sb.style.cssText = 'margin-top:8px;min-height:44px;min-width:44px;padding:6px 18px;border-radius:999px;border:1px solid #f4511e;background:#c2410c;color:#fff;cursor:pointer;font:700 14px "Noto Kufi Arabic",sans-serif';
    var msg = document.createElement('span'); msg.setAttribute('role', 'status'); msg.style.cssText = 'margin-inline-start:10px;color:#b9cce2';
    sb.addEventListener('click', function () {
      var u = ''; try { u = window.Office3D && window.Office3D.snapshot ? window.Office3D.snapshot() : ''; } catch (e) { u = ''; }
      if (!u || u.length < 5000) { msg.textContent = 'مقدرتش آخد اللقطة دلوقتي.'; return; }
      var img = new Image();
      img.onload = function () {
        try {
          var W = img.width, bar = Math.max(44, Math.round(W / 22)), fs = Math.max(14, Math.round(bar * 0.45)), cvs = document.createElement('canvas'); cvs.width = W; cvs.height = img.height + bar;
          var c = cvs.getContext('2d'), P = dubaiParts(Date.now()), stamp = P.y + '-' + p2(P.m) + '-' + p2(P.d) + ' ' + p2(P.h) + ':' + p2(P.mi);
          c.fillStyle = '#070d18'; c.fillRect(0, 0, W, bar); c.drawImage(img, 0, bar);
          c.fillStyle = '#f4511e'; c.fillRect(0, bar - 3, W, 3);
          c.fillStyle = '#ffffff'; c.font = '700 ' + fs + 'px "Noto Kufi Arabic",sans-serif'; c.direction = 'rtl'; c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText('مكتب الشغل', W - Math.round(fs * 0.8) - Math.round(fs * 1.6), bar / 2 - 1); c.fillStyle = '#f4511e'; var isz = Math.round(fs * 1.1); c.beginPath(); if (c.roundRect) { c.roundRect(W - Math.round(fs * 0.8) - isz, bar / 2 - isz / 2, isz, isz, Math.round(isz / 4)); } else { c.rect(W - Math.round(fs * 0.8) - isz, bar / 2 - isz / 2, isz, isz); } c.fill();
          c.fillStyle = '#b9cce2'; c.direction = 'rtl'; c.textAlign = 'left'; c.font = '600 ' + fs + 'px "Noto Kufi Arabic",sans-serif'; var tzw = c.measureText('توقيت دبي').width; c.fillText('توقيت دبي', Math.round(fs * 0.8), bar / 2 - 1); c.direction = 'ltr'; c.font = '600 ' + fs + 'px "Noto Sans Mono",monospace'; c.fillText(stamp, Math.round(fs * 0.8) + tzw + Math.round(fs * 0.6), bar / 2 - 1);
          var fn = 'work-screen-' + P.y + p2(P.m) + p2(P.d) + '-' + p2(P.h) + p2(P.mi) + '.png';
          var done = function (href) { var a = document.createElement('a'); a.href = href; a.download = fn; document.body.appendChild(a); a.click(); a.remove(); msg.textContent = 'اتحفظت على جهازك باسم ' + fn + ' (من غير رفع). اللقطة للمشهد ثلاثي الأبعاد: الشخصيات بتظهر لو كانت اتحمّلت وقت اللقطة، واللابلز والأزرار مش داخلة.'; };
          if (cvs.toBlob) { cvs.toBlob(function (b) { if (b) { var url = URL.createObjectURL(b); done(url); setTimeout(function () { URL.revokeObjectURL(url); }, 20000); } else { msg.textContent = 'مقدرتش آخد اللقطة دلوقتي.'; } }, 'image/png'); } else { done(cvs.toDataURL('image/png')); }
        } catch (e) { msg.textContent = 'مقدرتش آخد اللقطة دلوقتي.'; }
      };
      img.onerror = function () { msg.textContent = 'مقدرتش آخد اللقطة دلوقتي.'; };
      img.src = u;
    });
    pan.appendChild(sb); pan.appendChild(msg);
  }
  /* Idea 25: 4-step first-visit tour. Static card in the page flow (never over the scene or alerts); remembered in localStorage. */
  var TOUR = [
    'ده مكتب الشغل. كل مكتب فيه موظف، ولون الحلقة وشكلها واللابل بيقولوا حالته: شغال أو مستني أو خلّص أو واقف.',
    'اضغط على أي موظف أو مكتب تشوف شغله الحالي. واضغط مرتين بسرعة على المشهد أو اضغط زر المنظر العام عشان ترجع للمنظر الكامل.',
    'زر الخريطة فوق المشهد بيفتح خريطة صغيرة بتوديك لأي مكان، والبحث بيدوّر باسم أو مهمة ويفلتر بالحالة.',
    'زر ملخص اليوم بيجمع أرقام اليوم، وفيه لقطة بتتحفظ على جهازك. تقدر ترجع للجولة من زر الجولة جنب زر الخريطة.'
  ], tourStep = -1, TOUR_KEY = 'o3-tour-done';
  function tourDone() { try { return localStorage.getItem(TOUR_KEY) === '1'; } catch (e) { return false; } }
  function renderTour() {
    var card = document.getElementById('o3-tour');
    if (tourStep < 0) { if (card) { card.remove(); } return; }
    var anchor = document.getElementById('o3-search') || document.getElementById('o3-summary'); if (!anchor) { return; }
    if (!card) {
      card = document.createElement('div'); card.id = 'o3-tour'; card.setAttribute('dir', 'rtl'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'جولة سريعة'); card.setAttribute('aria-modal', 'false');
      card.style.cssText = 'margin:6px auto;width:min(560px,calc(100vw - 20px));box-sizing:border-box;padding:12px 14px;border-radius:18px;background:rgba(7,13,24,.92);border:1px solid #f4511e;color:#fff;font-size:15px;line-height:1.8';
      anchor.parentNode.insertBefore(card, anchor);
      card.addEventListener('keydown', function (e) { if (e.key === 'Escape') { endTour(); } });
    }
    card.textContent = '';
    var t = document.createElement('div'); t.textContent = 'خطوة ' + (tourStep + 1) + ' من ' + TOUR.length; t.style.cssText = 'color:#b9cce2;font-size:14px'; card.appendChild(t);
    var m = document.createElement('div'); m.setAttribute('role', 'status'); m.textContent = TOUR[tourStep]; card.appendChild(m);
    var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;margin-top:8px;flex-wrap:wrap';
    function mk(txt, fn, primary) { var b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.style.cssText = 'min-height:44px;min-width:44px;padding:6px 18px;border-radius:999px;border:1px solid ' + (primary ? '#c2410c' : '#22d3ee') + ';background:' + (primary ? '#c2410c' : '#070d18') + ';color:#fff;cursor:pointer;font:700 14px "Noto Kufi Arabic",sans-serif'; b.addEventListener('click', fn); row.appendChild(b); return b; }
    var nx = mk(tourStep < TOUR.length - 1 ? 'التالي' : 'تمام', function () { if (tourStep < TOUR.length - 1) { tourStep++; renderTour(); } else { endTour(); } }, true);
    mk('تخطّي', endTour, false);
    card.appendChild(row);
    try { nx.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function endTour() { tourStep = -1; try { localStorage.setItem(TOUR_KEY, '1'); } catch (e) { /* ignore */ } var f = document.getElementById('o3-tourbtn'); renderTour(); if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }
  window.__o3StartTour = function () { tourStep = 0; renderTour(); };
  (function () { var tries = 0, iv = setInterval(function () { tries++; try { if (tourDone() || tries > 90) { clearInterval(iv); return; } if (window.Office3D && window.Office3D.ready && document.getElementById('o3-search')) { clearInterval(iv); window.__o3StartTour(); } } catch (e) { clearInterval(iv); } }, 1000); })();
  setInterval(function () { try { if (sumOpen) { renderDaySummary(); } else if (!document.getElementById('o3-daybtn')) { renderDaySummary(); } } catch (e) {} }, 5000);
  setTimeout(function () { try { renderDaySummary(); } catch (e) {} }, 2500);
  setInterval(function () { try { ensureSearch(); } catch (e) {} }, 2000);
  setInterval(function () { try { publishLoad(); } catch (e) {} }, 5000); setTimeout(function () { try { publishLoad(); } catch (e) {} }, 1800);
  function pendingDecisions() {
    var latest = {}, out = [], cut = Date.now() - 86400000;
    statusLines.forEach(function (e) { var k = e.id || e.name || '?'; if (!latest[k]) { latest[k] = e; } });
    Object.keys(latest).forEach(function (k) { var e = latest[k]; if (e.ask && e.ms >= cut) { out.push(e); } });
    return out.sort(function (a, b) { return b.ms - a.ms; });
  }
  function copyText(t, done) {
    function fb() { try { var ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0;top:0;font-size:16px'; document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, 9999); var ok = document.execCommand('copy'); ta.remove(); done(ok); } catch (e) { done(false); } }
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(function () { done(true); }, fb); } else { fb(); } } catch (e) { fb(); }
  }
  function renderDecisions() {
    var sum = document.getElementById('o3-summary'); if (!sum) { return; }
    var list = pendingDecisions();
    var btn = document.getElementById('o3-dec'), pan = document.getElementById('o3-decpanel');
    if (!list.length) { if (btn) { btn.remove(); } if (pan) { pan.remove(); } decOpen = false; return; }
    if (!btn) {
      btn = document.createElement('button'); btn.id = 'o3-dec'; btn.type = 'button'; btn.setAttribute('dir', 'rtl');
      btn.style.cssText = 'display:block;margin:4px auto;padding:6px 14px;min-height:44px;border-radius:999px;background:#070d18;border:1px solid #f4511e;color:#fff;font:700 15px "Noto Kufi Arabic",sans-serif;cursor:pointer';
      btn.addEventListener('click', function () { decOpen = !decOpen; renderDecisions(); });
      sum.parentNode.insertBefore(btn, sum.nextSibling);
    }
    btn.textContent = 'قرارات مستنية: ' + list.length + (decOpen ? ' ▴' : ' ▾');
    btn.setAttribute('aria-expanded', decOpen ? 'true' : 'false');
    if (!decOpen) { if (pan) { pan.remove(); } return; }
    if (!pan) { pan = document.createElement('div'); pan.id = 'o3-decpanel'; pan.setAttribute('dir', 'rtl'); pan.style.cssText = 'margin:4px auto 8px;width:min(560px,calc(100vw - 20px));box-sizing:border-box;padding:10px 12px;border-radius:14px;background:rgba(7,13,24,.96);border:1px solid rgba(244,81,30,.6);color:#fff;font-size:15px;line-height:1.7'; btn.parentNode.insertBefore(pan, btn.nextSibling); }
    pan.textContent = '';
    list.forEach(function (e, li) {
      var key = e.id + '|' + e.mid, box = document.createElement('div'); box.style.cssText = 'padding:6px 0;' + (li ? 'border-top:1px solid rgba(255,255,255,.12)' : '');
      var q = document.createElement('div'); q.style.fontWeight = '700'; q.textContent = (e.name || e.id || 'موظف') + ': ' + e.ask + ' (' + decAge(e.ms) + ')'; box.appendChild(q);
      if (!e.options.length) { var no = document.createElement('div'); no.style.cssText = 'font-size:14px;color:#b9cce2'; no.textContent = FREE_TEXT_OK ? 'مفيش خيارات' : 'التفاصيل مخفية على الشاشة العامة'; box.appendChild(no); }
      e.options.forEach(function (o, i) {
        var b = document.createElement('button'); b.type = 'button'; b.setAttribute('dir', 'rtl');
        b.style.cssText = 'display:block;width:100%;text-align:start;margin:4px 0;padding:8px 10px;min-height:44px;border-radius:10px;background:' + (decPick[key] === i ? '#1f2a44' : '#0d1626') + ';border:1px solid ' + (decPick[key] === i ? '#22d3ee' : 'rgba(255,255,255,.25)') + ';color:#fff;font:15px "Noto Kufi Arabic",sans-serif;cursor:pointer';
        b.textContent = (i + 1) + '. ' + o; b.setAttribute('data-dk', key + '#' + i);
        b.addEventListener('click', function () { decPick[key] = i; decFocus = key + '#' + i; renderDecisions(); });
        box.appendChild(b);
      });
      if (decPick[key] !== undefined && e.options[decPick[key]] !== undefined) {
        var txt = 'قول لريم: قرار ' + (e.name || e.id || 'موظف') + '، خيار ' + (decPick[key] + 1) + ': ' + e.options[decPick[key]].slice(0, 50);
        var r = document.createElement('div'); r.style.cssText = 'margin-top:6px;padding:8px 10px;border-radius:10px;background:#111b30;border:1px dashed #22d3ee'; r.setAttribute('dir', 'rtl');
        var tt = document.createElement('div'); tt.textContent = txt; tt.style.cssText = 'user-select:all;-webkit-user-select:all;font-weight:700'; r.appendChild(tt);
        var cb = document.createElement('button'); cb.type = 'button'; cb.textContent = 'انسخ'; cb.style.cssText = 'margin-top:6px;padding:6px 14px;min-height:44px;min-width:44px;border-radius:999px;background:#f4511e;border:0;color:#fff;font:700 15px "Noto Kufi Arabic",sans-serif;cursor:pointer';
        if (decCopied[key + '#' + decPick[key]]) { cb.textContent = decCopied[key + '#' + decPick[key]]; }
        cb.addEventListener('click', function () { copyText(txt, function (ok) { cb.textContent = ok ? 'اتنسخ ✓' : 'انسخ الجملة بإيدك'; decCopied[key + '#' + decPick[key]] = cb.textContent; }); });
        r.appendChild(cb);
        var nt = document.createElement('div'); nt.style.cssText = 'font-size:14px;color:#b9cce2;margin-top:4px'; nt.textContent = 'الشاشة للعرض بس. ابعت الجملة لريم على واتساب.'; r.appendChild(nt);
        box.appendChild(r);
      }
      pan.appendChild(box);
    });
    if (decFocus) { var fb2 = null; try { fb2 = pan.querySelector('[data-dk="' + decFocus.replace(/["\\\]\[]/g, '') + '"]'); } catch (e) { fb2 = null; } decFocus = ''; if (fb2) { try { fb2.focus(); } catch (e) {} } }
  }
  setInterval(function () { try { renderDecisions(); } catch (e) {} try { updateBadge(); } catch (e) {} }, 60000);
  /* IDEA51-BEGIN. App badge, tab title and tab icon. The number is the count that already exists on screen: decisions waiting for him (pendingDecisions) plus jobs that may be late (lateCount). Numbers only: no job names, no text from the feed. navigator.setAppBadge / clearAppBadge are used when the browser has them and ignored when it does not (iPhone Safari outside the home-screen app, desktop Firefox). The tab title becomes "(n) المكتب" and the icon turns red while n is above 0; with n = 0 the title and icon go back to the normal ones. No network, no storage, no tracking. */
  var BADGE_TITLE0 = 'مكتب الشغل', BADGE_ICON_ALERT = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20rx%3D%2214%22%20fill%3D%22%23070d18%22%2F%3E%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2220%22%20fill%3D%22%23dc2626%22%2F%3E%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%227%22%20fill%3D%22%23ffffff%22%2F%3E%3C%2Fsvg%3E', badgeIcon0 = null, badgeLast = -1;
  function badgeNum(n) { n = Math.floor(Number(n)); return (isFinite(n) && n > 0) ? Math.min(n, 99) : 0; }
  function badgeSpec(n) { n = badgeNum(n); return { n: n, title: n > 0 ? '(' + n + ') المكتب' : BADGE_TITLE0, alert: n > 0 }; }
  function badgeCount() { var a = 0, b = 0; try { a = pendingDecisions().length; } catch (e) { a = 0; } try { b = lateCount(); } catch (e) { b = 0; } return badgeNum(a + b); }
  function updateBadge() {
    var n = badgeCount(); if (n === badgeLast) { return; } badgeLast = n;
    var sp = badgeSpec(n);
    try { document.title = sp.title; } catch (e) { /* ignore */ }
    try {
      var ln = document.querySelector('link[rel="icon"]');
      if (ln) { if (badgeIcon0 === null) { badgeIcon0 = { href: ln.getAttribute('href'), type: ln.getAttribute('type'), sizes: ln.getAttribute('sizes') }; }
        if (sp.alert) { ln.setAttribute('type', 'image/svg+xml'); ln.removeAttribute('sizes'); ln.setAttribute('href', BADGE_ICON_ALERT); }
        else { ln.setAttribute('href', badgeIcon0.href); if (badgeIcon0.type) { ln.setAttribute('type', badgeIcon0.type); } if (badgeIcon0.sizes) { ln.setAttribute('sizes', badgeIcon0.sizes); } } }
    } catch (e) { /* ignore */ }
    try {
      if (sp.alert) { if (typeof navigator.setAppBadge === 'function') { var p = navigator.setAppBadge(sp.n); if (p && p.catch) { p.catch(function () { /* ignore */ }); } } }
      else if (typeof navigator.clearAppBadge === 'function') { var q = navigator.clearAppBadge(); if (q && q.catch) { q.catch(function () { /* ignore */ }); } }
    } catch (e) { /* ignore */ }
  }
  /* IDEA51-END */

  var BADGE_COLORS = ['#ff8a65', '#4dd0e1', '#b39ddb', '#81c784', '#ffd54f', '#f48fb1', '#64b5f6', '#a1887f', '#aed581', '#ba68c8', '#4db6ac', '#e57373'];
  function badgeColor(key) { var h = 0, t = String(key || '?'), i; for (i = 0; i < t.length; i++) { h = (h * 31 + t.charCodeAt(i)) >>> 0; } return BADGE_COLORS[h % BADGE_COLORS.length]; }

  /* Idea 16: two-hour timeline, one row per employee, click a point to replay from there at x4 */
  var tlEl = null, replayTimer = null, tlOpen = (window.innerWidth || 1000) >= 700;
  function renderTimeline() {
    var panel = ensureLogPanel(); if (!panel) { return; }
    if (!tlEl) { tlEl = make('div', 'o3-timeline'); tlEl.style.cssText = 'margin:6px 0 8px;padding:8px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(34,211,238,.25)'; var ul = panel.querySelector('.o3-pipes'); ul.parentNode.insertBefore(tlEl, ul); }
    var NS = 'http://www.w3.org/2000/svg', now = Date.now(), span = 2 * 3600 * 1000, t0 = now - span;
    var evs = statusLines.filter(function (e) { return e.ms >= t0; });
    tlEl.textContent = '';
    var hd = make('button', ''); hd.type = 'button'; hd.setAttribute('aria-expanded', tlOpen ? 'true' : 'false');
    hd.style.cssText = 'display:flex;justify-content:space-between;width:100%;background:none;border:0;color:#fff;font:inherit;font-size:14px;font-weight:800;padding:2px 0;cursor:pointer;text-align:start';
    var ht = make('span', ''); ht.textContent = 'الخط الزمني (آخر ساعتين)'; var hc = make('span', ''); hc.textContent = tlOpen ? '▾ اقفل' : '◂ افتح'; hc.style.color = '#b9cce2';
    hd.appendChild(ht); hd.appendChild(hc); hd.addEventListener('click', function () { tlOpen = !tlOpen; renderTimeline(); }); tlEl.appendChild(hd);
    if (!tlOpen) { return; }
    if (!evs.length) { var em = make('div', ''); em.style.cssText = 'font-size:14px;color:#b9cce2'; em.textContent = 'مفيش حركة في آخر ساعتين.'; tlEl.appendChild(em); return; }
    var rows = [], seen = {};
    evs.forEach(function (e) { var k = e.id || e.name || '?'; if (!seen[k]) { seen[k] = { key: k, name: e.name || k, ev: [] }; rows.push(seen[k]); } seen[k].ev.push(e); });
    rows = rows.slice(0, 12);
    var W = Math.max(260, (tlEl.clientWidth || 300) - 16), LW = 96, RH = 34, AX = 22, H = rows.length * RH + AX + 4;
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H); svg.style.direction = 'ltr'; svg.style.display = 'block'; svg.style.maxWidth = '100%';
    function txt(x, y, str, anchor, fill, wt) { var t = document.createElementNS(NS, 'text'); t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('text-anchor', anchor); t.setAttribute('fill', fill); t.setAttribute('font-size', '14'); t.setAttribute('font-weight', wt || '600'); t.textContent = str; return t; }
    var X0 = LW, X1 = W - 8;
    rows.forEach(function (r, i) {
      var y = i * RH + RH / 2 + 2, bc = badgeColor(r.key);
      var ln = document.createElementNS(NS, 'line'); ln.setAttribute('x1', X0); ln.setAttribute('x2', X1); ln.setAttribute('y1', y); ln.setAttribute('y2', y); ln.setAttribute('stroke', 'rgba(255,255,255,.18)'); svg.appendChild(ln);
      var nm = r.name.length > 9 ? r.name.slice(0, 8) + '…' : r.name;
      var nt = txt(LW - 8, y + 5, nm, 'end', bc, '700'); var ntt = document.createElementNS(NS, 'title'); ntt.textContent = r.name; nt.appendChild(ntt); svg.appendChild(nt);
      var lastX = -99, flip = 1;
      r.ev.slice().sort(function (p, q) { return p.ms - q.ms; }).forEach(function (e) {
        var x = X0 + (e.ms - t0) / span * (X1 - X0), dy = 0;
        if (x - lastX < 11) { dy = 8 * flip; flip = -flip; } else { flip = 1; } lastX = x;
        var cy = y + dy, stuck = e.state === 'blocked';
        var g = document.createElementNS(NS, 'g'); g.style.cursor = 'pointer';
        var hit = document.createElementNS(NS, 'circle'); hit.setAttribute('cx', x.toFixed(1)); hit.setAttribute('cy', cy); hit.setAttribute('r', 12); hit.setAttribute('fill', 'transparent'); g.appendChild(hit);
        var m;
        if (stuck) { m = document.createElementNS(NS, 'rect'); m.setAttribute('x', (x - 5).toFixed(1)); m.setAttribute('y', cy - 5); m.setAttribute('width', 10); m.setAttribute('height', 10); m.setAttribute('fill', '#b91c1c'); m.setAttribute('stroke', '#fff'); m.setAttribute('stroke-width', 1.5); }
        else { m = document.createElementNS(NS, 'circle'); m.setAttribute('cx', x.toFixed(1)); m.setAttribute('cy', cy); m.setAttribute('r', 5); m.setAttribute('fill', e.state === 'done' ? '#22d3ee' : '#f4511e'); }
        g.appendChild(m);
        var tt = document.createElementNS(NS, 'title'); tt.textContent = (stuck ? 'واقف: ' : '') + e.text; g.appendChild(tt);
        g.addEventListener('click', function () { replayFrom(e.ms); });
        svg.appendChild(g);
      });
    });
    var ay = rows.length * RH + 16;
    svg.appendChild(txt(X0, ay, 'قبل ساعتين', 'start', '#b9cce2')); svg.appendChild(txt(X1, ay, 'دلوقتي', 'end', '#b9cce2'));
    tlEl.appendChild(svg);
    var lg = make('div', ''); lg.style.cssText = 'font-size:14px;color:#b9cce2;margin-top:2px'; lg.textContent = '● برتقالي شغال · ● سماوي خلّص · ■ أحمر غامق واقف. اضغط علامة وهتتعاد الأحداث بسرعة x4.'; tlEl.appendChild(lg);
    var rp = make('div', 'o3-replay'); rp.style.cssText = 'font-size:14px;margin-top:6px;min-height:20px;color:#fff'; tlEl.appendChild(rp);
  }
  function replayFrom(ms) {
    if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
    var rp = tlEl && tlEl.querySelector('.o3-replay'); if (!rp) { return; }
    var list = statusLines.filter(function (e) { return e.ms >= ms; }).sort(function (a, b) { return a.ms - b.ms; });
    var i = 0;
    function step() {
      if (i >= list.length) { rp.textContent = 'خلصت الإعادة.'; replayTimer = null; return; }
      var e = list[i++], t = ''; try { t = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Dubai' }).format(new Date(e.ms)); } catch (x) { t = ''; }
      rp.textContent = '▶ x4 · ' + t + ' · ' + (e.name || '') + ': ' + e.text;
      var gap = i < list.length ? Math.min(2000, Math.max(300, (list[i].ms - e.ms) / 4)) : 400;
      replayTimer = setTimeout(step, gap);
    }
    step();
  }
  function renderLog() {
    var panel = ensureLogPanel(); if (!panel) { return; }
    var evs = liveEvents.filter(function (e) { return e.t === 'h' || e.t === 'r'; });
    var lines = panel.querySelector('.o3-lines'), pipes = panel.querySelector('.o3-pipes');
    lines.textContent = ''; pipes.textContent = '';
    try { if (!replayTimer) { renderTimeline(); } } catch (e) { /* timeline is optional */ }
    if (jobsMode) { renderJobs(lines, pipes); return; }
    if (statusLines.length) {
      var sh = make('li', 'o3-empty'); sh.textContent = 'شغل حي دلوقتي (الأحدث فوق):'; lines.appendChild(sh);
      statusLines.slice(0, 25).forEach(function (e) {
        var li = make('li', 'o3-line'); var d = new Date(e.ms), ss = '';
        try { ss = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Dubai' }).format(d); } catch (x) { ss = ''; }
        var bc = badgeColor(e.id || e.name);
        li.style.borderInlineStart = '4px solid ' + bc; li.style.paddingInlineStart = '8px';
        li.appendChild(document.createTextNode(ss + ' · '));
        if (e.name) { var nsp = document.createElement('strong'); nsp.textContent = e.name; nsp.style.color = bc; li.appendChild(nsp); li.appendChild(document.createTextNode(': ')); }
        li.appendChild(document.createTextNode(e.text === NOJOB ? '● لسه ما بعتش' : (e.state === 'done' ? '✓ خلّص ' : e.state === 'blocked' ? '■ واقف ' : '● بيشتغل ') + (publicText(e.text) || 'شغلانة')));
        lines.appendChild(li);
      });
    }
    if (!evs.length && statusLines.length) { return; }
    if (!evs.length) {
      var stf = (baseFeed && baseFeed.staff) || [];
      var ago = function (iso) { var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); if (!(m >= 0)) { return ''; } if (m < 2) { return 'دلوقتي'; } if (m < 60) { return minutesLabel(m); } if (m < 1440) { return hoursLabel(Math.round(m / 60)); } var dd = Math.round(m / 1440); return dd === 1 ? 'من يوم' : (dd === 2 ? 'من يومين' : 'من ' + dd + (dd <= 10 ? ' أيام' : ' يوم')); };
      var stl = { running: 'شغّال', waiting: 'مستني', done: 'خلّص', idle: 'فاضي' };
      var upd = baseFeed && baseFeed.updated ? ago(baseFeed.updated) : '';
      var em = make('li', 'o3-empty'); em.textContent = 'مفيش تسليمات النهاردة. دي آخر حالات الموظفين من الداتا' + (upd ? ' (آخر تحديث ' + upd + ')' : '') + ':'; lines.appendChild(em);
      stf.slice().sort(function (a, b) { return String(b.time || '').localeCompare(String(a.time || '')); }).slice(0, 14).forEach(function (p) {
        if (!p.step) { return; }
        var li = make('li', 'o3-line'); li.textContent = (p.time ? hhmm(p.time) + ' · ' : '') + p.name + (p.title ? ' (' + p.title + ')' : '') + ' ' + (stl[p.state] || '') + ': ' + p.step + (p.time ? ' · ' + ago(p.time) : '');
        lines.appendChild(li);
      });
      return;
    }
    // pipelines
    var jobs = {}, order = [];
    evs.forEach(function (e) {
      var k = e.job || (e.t === 'h' ? 'j-' + e.label : ''); if (!k) { return; }
      if (!jobs[k]) { jobs[k] = { id: k, title: '', chain: [], reported: false }; order.push(k); }
      var j = jobs[k];
      if (e.t === 'r') { j.reported = true; return; }
      if (e.jt) { j.title = e.jt; } else if (!j.title && e.label) { j.title = e.label; }
      if (!j.chain.length) { j.chain.push(e.from); }
      j.chain.push(e.to);
    });
    order.slice(-4).reverse().forEach(function (k) {
      var j = jobs[k], row = make('div', 'o3-pipe');
      var t = make('div', 'o3-pipe-title'); t.textContent = j.title || 'شغلانة'; row.appendChild(t);
      var st = make('div', 'o3-stages');
      var chain = j.chain.slice(); var last = chain.length - 1;
      var atMgr = chain[last] === 'mgr';
      chain.forEach(function (pid, i) {
        var s = make('span', 'o3-stage-chip');
        var done = i < last || (atMgr && i === last && j.reported) || j.reported;
        s.classList.add(done ? 'is-done' : 'is-now');
        s.textContent = (done ? '✓ ' : '● ') + nameOf(pid) + (roleOfId(pid) ? ' · ' + roleOfId(pid) : '');
        st.appendChild(s);
      });
      var fin = make('span', 'o3-stage-chip'); fin.classList.add(j.reported ? 'is-done' : 'is-todo');
      fin.textContent = (j.reported ? '✓ ' : '○ ') + 'اتبلّغ لبيشو'; st.appendChild(fin);
      row.appendChild(st); pipes.appendChild(row);
    });
    // first-person lines, newest first
    evs.slice(-14).reverse().forEach(function (e) {
      var li = make('li', 'o3-line'); var who, txt;
      if (e.t === 'r') { who = 'mgr'; txt = 'أنا بلّغت بيشو بنتيجة: ' + (e.jt || 'الشغلانة') + '.'; }
      else {
        who = e.from;
        var parts = ['أنا خلّصت ' + (e.label || e.jt || 'اللي عليا') + ' وسلّمته لـ' + nameOf(e.to) + '.'];
        if (e.msg) {
          if (e.msg.text) { parts.push(e.msg.text); }
          if (e.msg.done) { parts.push('خلّصت: ' + e.msg.done + '.'); }
          if (e.msg.missing) { parts.push('ناقص: ' + e.msg.missing + '.'); }
          if (e.msg.next) { parts.push('المطلوب منك: ' + e.msg.next + '.'); }
        }
        txt = parts.join(' ');
      }
      var h = make('div', 'o3-line-head'); h.textContent = nameOf(who) + ' · ' + hhmm(e.time); li.appendChild(h);
      var b = make('div', 'o3-line-body'); b.textContent = txt; li.appendChild(b);
      lines.appendChild(li);
      if (e.t === 'h') {
        var li2 = make('li', 'o3-line is-recv'); var h2 = make('div', 'o3-line-head'); h2.textContent = nameOf(e.to) + ' · ' + hhmm(e.time); li2.appendChild(h2);
        var b2 = make('div', 'o3-line-body'); b2.textContent = e.to === 'mgr' ? 'استلمت النتيجة من ' + nameOf(e.from) + ' وهبلّغ بيشو.' : 'استلمت من ' + nameOf(e.from) + ' وبدأت شغلي.'; li2.appendChild(b2);
        lines.appendChild(li2);
      }
    });
  }

  window.__o3Live = function (b) { if (ingestLive({ event: 'message', id: 'dbg' + Math.random(), time: Math.floor(Date.now() / 1000), message: JSON.stringify(b) })) { applyMerged(); } };
  function startLive() {
    if (typeof EventSource === 'undefined') {
      return;
    }
    fetch(LIVE_BASE + '/json?poll=1&since=12h', { cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        txt.split('\n').forEach(function (line) {
          if (line.trim()) {
            try { ingestLive(JSON.parse(line)); } catch (e) { /* skip */ }
          }
        });
        applyMerged();
      })
      .catch(function () { return null; })
      .then(function () {
        liveSource = new EventSource(LIVE_BASE + '/sse' + (liveLastId ? '?since=' + liveLastId : ''));
        liveSource.onopen = function () { window.__o3Stream = { down: false, since: Date.now() }; };
        liveSource.onerror = function () { if (!window.__o3Stream || !window.__o3Stream.down) { window.__o3Stream = { down: true, since: Date.now() }; } };
        liveSource.onmessage = function (e) {
          try {
            if (ingestLive(JSON.parse(e.data))) {
              applyMerged();
            }
          } catch (err) { /* skip */ }
        };
      });
  }

  function refresh() {
    if (refreshing) {
      return;
    }
    refreshing = true;

    var controller = null;
    var timer = 0;

    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      timer = window.setTimeout(function () {
        controller.abort();
      }, REQUEST_TIMEOUT_MS);
    }

    fetch(cacheBusted(FEED_URL), {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        var servedFromCache = res.headers.get('X-Feed-Cache') === 'hit';
        return res.json().then(function (data) {
          return { data: data, servedFromCache: servedFromCache };
        });
      })
      .then(function (result) {
        scrubFeed(result.data); baseFeed = result.data; try { learnAvg(); renderSummary(); renderCard(); } catch (e) { /* optional */ }
        applyMerged();
        lastSuccessAt = Date.now();
        networkFailed = result.servedFromCache;
        updateOffline();
      })
      .catch(function () {
        networkFailed = true;
        updateOffline();
      })
      .then(function () {
        if (timer) {
          window.clearTimeout(timer);
        }
        refreshing = false;
      });
  }

  function handleOnline() {
    networkFailed = false;
    updateOffline();
    refresh();
  }

  function handleOffline() {
    networkFailed = true;
    updateOffline();
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      return;
    }
    var hadController = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (hadController && !reloaded) { reloaded = true; window.location.reload(); }
    });
    navigator.serviceWorker.register('sw.js').catch(function () {
      return null;
    });
  }

  function init() {
    window.__openSheet = function (id) { if (!showCard(id)) { openSheet(id); } };
    window.__openSheetFull = openSheet;
    els.offlineBanner = byId('offlineBanner');
    els.lastUpdated = byId('lastUpdated');
    els.office = byId('office');
    els.managerDeskSlot = byId('managerDeskSlot');
    els.departments = byId('departments');
    els.walkerLayer = byId('walkerLayer');
    els.handoffList = byId('handoffList');
    els.handoffEmpty = byId('handoffEmpty');
    els.sheet = byId('sheet');
    els.sheetBackdrop = byId('sheetBackdrop');
    els.sheetName = byId('sheetName');
    els.sheetTitle = byId('sheetTitle');
    els.sheetDeptValue = byId('sheetDeptValue');
    els.sheetState = byId('sheetState');
    els.sheetStateValue = byId('sheetStateValue');
    els.sheetStep = byId('sheetStep');
    els.sheetLast = byId('sheetLast');
    els.sheetTime = byId('sheetTime');
    els.sheetClose = byId('sheetClose');

    els.sheetClose.addEventListener('click', closeSheet);
    els.sheetBackdrop.addEventListener('click', closeSheet);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeSheet();
      }
    });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        refresh();
      }
    });
    window.addEventListener('pageshow', function () { refresh(); });
    window.addEventListener('focus', function () { refresh(); });
    window.addEventListener('load', registerServiceWorker);

    updateOffline();
    refresh();
    startLive();
    window.setInterval(refresh, POLL_MS);
    window.setInterval(tick, TICK_MS);
    renderLastUpdated();
    window.setInterval(renderLastUpdated, 1000);
  }

  // ---- Org view (org.js/org.css/org.json): additive module; loaded after app boot ----
  function bootOrgView() {
    try {
      var main = document.querySelector('main.wrap');
      if (!main) { return; }
      var sec = make('section', 'org-view');
      sec.id = 'orgView';
      sec.setAttribute('aria-labelledby', 'orgHeading');
      var head = make('div', 'section-head');
      var h2 = make('h2');
      h2.id = 'orgHeading';
      h2.textContent = '\u0627\u0644\u0647\u064a\u0643\u0644 \u0627\u0644\u062a\u0646\u0638\u064a\u0645\u064a';
      var note = make('span', 'section-note');
      note.textContent = '\u0645\u064a\u0646 \u0628\u064a\u0634\u062a\u063a\u0644 \u062a\u062d\u062a \u0645\u064a\u0646 \u00b7 \u0645\u0628\u0627\u0634\u0631';
      head.appendChild(h2);
      head.appendChild(note);
      var body = make('div', 'org-body');
      body.id = 'orgBody';
      sec.appendChild(head);
      sec.appendChild(body);
      var anchor = main.querySelector('.handoffs');
      main.insertBefore(sec, anchor || null);
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'org.css?v=4';
      document.head.appendChild(css);
      window.__orgStatusLines = function () { return statusLines; };
      var sc = document.createElement('script');
      sc.src = 'org.js?v=4';
      sc.defer = true;
      document.body.appendChild(sc);
    } catch (e) {}
  }

  bootOrgView();
  restoreTL();
  init();
  setTimeout(function () { try { renderLog(); renderSummary(); renderDecisions(); } catch (e) { /* optional */ } try { updateBadge(); } catch (e) { /* optional */ } }, 1500);
  setInterval(function () { try { renderSummary(); renderCard(); } catch (e) { /* optional */ } }, 60000);
})();
