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
    var mode = feedOld ? 'old' : (down ? 'down' : (noStream ? 'nostream' : 'live'));
    var lab = els.lastUpdated.parentNode && els.lastUpdated.parentNode.querySelector('.updated-label');
    var box = els.lastUpdated.parentNode;
    if (mode === 'live') { els.lastUpdated.textContent = fmtDubai(new Date()); }
    else if (mode === 'old') { els.lastUpdated.textContent = fmtDubai(new Date(nw)); }
    else { els.lastUpdated.textContent = rx ? fmtDubai(new Date(rx)) : '—'; }
    var txt = mode === 'live' ? 'مباشر' : (mode === 'old' ? 'بيانات قديمة، آخرها' : (mode === 'down' ? 'متقطّع، آخر بيانات' : 'بدون تيار، آخر بيانات'));
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
    window.__o3RxAt = Date.now();
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
  function saveTL() { try { localStorage.setItem(TL_KEY, JSON.stringify(statusLines.slice(0, 500).map(function (e) { return { mid: e.mid, id: e.id, name: e.name, text: e.text, state: e.state, job: e.job, ms: e.ms }; }))); } catch (e) { /* storage full or blocked */ } }
  function restoreTL() { try { var a = JSON.parse(localStorage.getItem(TL_KEY) || '[]'); if (Array.isArray(a)) { a.forEach(function (e) { if (e && e.mid && e.ms && e.text) { statusSeen[e.mid] = true; statusSince = e.mid; statusLines.push({ mid: String(e.mid), id: cleanText(e.id, 40), name: cleanText(e.name, 40), text: cleanText(e.text, 160), state: e.state === 'done' ? 'done' : (e.state === 'blocked' ? 'blocked' : 'start'), next: '', done: -1, pending: -1, job: cleanText(e.job, 60), result: '', ms: +e.ms }); } }); statusLines.sort(function (x, y) { return y.ms - x.ms; }); } } catch (e) { console.warn('restoreTL', String(e)); statusLines = []; } }
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
          var nm = '', tx = '', stt = '', aid = '', nx = '', dn = -1, pd = -1, jb = '', rs = '';
          if (b && typeof b === 'object') { nm = cleanText(b.name, 40); tx = cleanText(b.text, 160); stt = b.state === 'done' ? 'done' : (b.state === 'blocked' || b.state === 'error' ? 'blocked' : 'start'); aid = cleanText(b.id, 40); jb = cleanText(b.job, 60); rs = (b.result === 'got' || b.result === 'none' || b.result === 'pending') ? b.result : ''; nx = cleanText(b.next, 120); dn = isFinite(+b.done) && b.done !== null && b.done !== '' ? Math.max(0, Math.min(9999, Math.floor(+b.done))) : -1; pd = isFinite(+b.pending) && b.pending !== null && b.pending !== '' ? Math.max(0, Math.min(9999, Math.floor(+b.pending))) : -1; }
          else { tx = cleanText(m.message, 160); nm = cleanText(m.title, 40); stt = 'start'; }
          if (!tx) { return; }
          statusLines.push({ mid: m.id, id: aid, name: nm, text: tx, state: stt, next: nx, done: dn, pending: pd, job: jb, result: rs, ms: (m.time || 0) * 1000 });
          changed = true;
        });
        if (changed) { statusLines.sort(function (a, b) { return b.ms - a.ms; }); statusLines = statusLines.slice(0, 500); saveTL(); try { renderLog(); renderCard(); } catch (e) {} try { renderSummary(); } catch (e) {} try { if (window.OrgView && window.OrgView.update) { window.OrgView.update(statusLines); } } catch (e) {} }
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
  function closeCard() { if (cardEl) { cardEl.remove(); cardEl = null; cardFor = null; } }
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
    var x = make('button', ''); x.type = 'button'; x.textContent = '✕'; x.style.cssText = 'background:none;border:0;color:#fff;font-size:16px;cursor:pointer'; x.addEventListener('click', closeCard); h.appendChild(x);
    cardEl.appendChild(h);
    function row(label, val) { var r = make('div', ''); r.style.cssText = 'font-size:14px;line-height:1.6'; var l = make('span', ''); l.textContent = label + ': '; l.style.color = '#8aa3bf'; var v = make('span', ''); v.textContent = val; r.appendChild(l); r.appendChild(v); cardEl.appendChild(r); }
    var now = lv ? (lv.state === 'done' ? 'خلّص: ' : 'بيشتغل على: ') + lv.text : (sf && sf.step ? sf.step + ' (من الداتا القديمة)' : 'مفيش حالة حية');
    row('دلوقتي', now);
    row('الجاي', lv && lv.next ? lv.next : 'لسه ما بعتش');
    if (lv && lv.done >= 0 && lv.pending >= 0) {
      var tot = lv.done + lv.pending, pc = tot ? Math.round(lv.done * 100 / tot) : 0;
      row('اتعمل / فاضل', lv.done + ' / ' + lv.pending);
      var bar = make('div', ''); bar.style.cssText = 'height:8px;border-radius:6px;background:rgba(255,255,255,.12);margin-top:6px;overflow:hidden';
      var fill = make('div', ''); fill.style.cssText = 'height:100%;background:#2bb0a0;width:' + pc + '%'; bar.appendChild(fill); cardEl.appendChild(bar);
      var pt = make('div', ''); pt.style.cssText = 'font-size:14px;color:#b9cce2;margin-top:3px'; pt.textContent = pc + '% خلص النهاردة'; cardEl.appendChild(pt);
    } else { row('اتعمل / فاضل', 'لسه ما بعتش الأرقام'); }
    if (lv && lv.ms) { var tt = make('div', ''); tt.style.cssText = 'font-size:14px;color:#b9cce2;margin-top:6px'; try { tt.textContent = 'آخر تحديث ' + new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Dubai' }).format(new Date(lv.ms)); } catch (e) {} cardEl.appendChild(tt); }
  }
  function showCard(id) {
    var host = document.getElementById('office3d'); if (!host) { return false; }
    if (!cardEl) { cardEl = make('div', 'o3-agentcard'); cardEl.style.cssText = 'position:absolute;z-index:30;top:160px;inset-inline-start:12px;width:min(300px,86%);padding:12px 14px;border-radius:14px;background:rgba(8,14,30,.92);color:#fff;border:1px solid rgba(80,200,230,.45);backdrop-filter:blur(8px);box-shadow:0 8px 28px rgba(0,0,0,.5)'; host.appendChild(cardEl); }
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
  function cleanText(v, n) {
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
      if (typeof body.msg === 'string') { hm = { text: cleanText(body.msg, 200) }; }
      else if (isObj(body.msg)) { hm = { done: cleanText(body.msg.done, 140), missing: cleanText(body.msg.missing, 140), next: cleanText(body.msg.next, 140) }; }
      liveEvents.push({ t: 'h', from: cleanText(body.from, 40), to: cleanText(body.to, 40), label: cleanText(body.label, 80), job: cleanText(body.job, 40), jt: cleanText(body.jt, 80), step: cleanText(body.step, 40), msg: hm, time: iso });
      return true;
    }
    if (body.t === 'r') {
      liveEvents.push({ t: 'r', job: cleanText(body.job, 40), jt: cleanText(body.jt, 80), time: iso });
      return true;
    }
    if (body.t === 'p') {
      var pe = { t: 'p', id: cleanText(body.id, 40), name: cleanText(body.name, 40), title: cleanText(body.title, 60), dept: cleanText(body.dept, 40), time: iso };
      ['state', 'step', 'last'].forEach(function (k) { if (typeof body[k] === 'string') { pe[k] = cleanText(body[k], k === 'state' ? 20 : 120); } });
      if (!pe.id || !pe.name) { return false; }
      liveEvents.push(pe);
      return true;
    }
    if (body.t === 's') {
      var ev = { t: 's', id: cleanText(body.id, 40), time: iso };
      ['state', 'step', 'last', 'doing'].forEach(function (k) {
        if (typeof body[k] === 'string') {
          ev[k] = cleanText(body[k], k === 'state' ? 20 : 120);
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
      var t = make('div', ''); t.style.cssText = 'font-weight:800;font-size:13px'; t.textContent = jn + ' · ' + ag.length + ' موظف · ' + (fin ? '✓ خلصت' : '● لسه شغالة'); li.appendChild(t);
      var rl = make('div', ''); rl.style.cssText = 'font-size:14px;color:#b9cce2'; rl.textContent = 'النتيجة: ' + (res === 'got' ? 'طلعت نتيجة' : res === 'none' ? 'مفيش نتيجة' : res === 'pending' ? 'لسه مستنية' : 'لسه ما اتبعتش'); li.appendChild(rl);
      if (hasNum) { var tot = dn + pd, pc = tot ? Math.round(dn * 100 / tot) : 0; var bar = make('div', ''); bar.style.cssText = 'height:7px;border-radius:6px;background:rgba(255,255,255,.12);margin:5px 0;overflow:hidden'; var f = make('div', ''); f.style.cssText = 'height:100%;background:#2bb0a0;width:' + pc + '%'; bar.appendChild(f); li.appendChild(bar); var pl = make('div', ''); pl.style.cssText = 'font-size:11px;color:#8aa3bf'; pl.textContent = dn + ' اتعمل / ' + pd + ' فاضل (' + pc + '%)'; li.appendChild(pl); }
      ag.forEach(function (e) { var d = make('div', ''); d.style.cssText = 'font-size:14px;margin-top:3px'; d.textContent = (e.name || e.id || '؟') + ': ' + (e.state === 'done' ? '✓ ' : e.state === 'blocked' ? '■ واقف ' : '● ') + e.text + (e.next ? ' ← الجاي: ' + e.next : ''); li.appendChild(d); });
      lines.appendChild(li);
    });
  }

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
    var working = 0, done = 0, stuck = 0, jobs = {}, pend = 0;
    Object.keys(latest).forEach(function (id) { var e = latest[id]; if (e.ms < cutoff) { return; } if (e.state === 'done') { done++; } else if (e.state === 'blocked') { stuck++; } else { working++; } if (e.job) { jobs[e.job] = 1; } if (e.pending > 0) { pend += e.pending; } });
    var nj = Object.keys(jobs).length;
    function build(short) {
      var parts = [['\u25CF ' + working + (short ? ' شغال' : ' شغالين'), '#f4511e'], ['\u2713 ' + done + (short ? ' خلص' : ' خلصوا'), '#22d3ee']];
      if (stuck) { parts.push(['\u25A0 ' + stuck + ' واقف', '#f87171']); }
      parts.push([nj + (short ? ' شغلانة' : ' شغلانات'), '#8b5cf6']);
      if (pend && !short) { parts.push([pend + ' معلّق', '#9aa8bd']); }
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
  }

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
        li.appendChild(document.createTextNode((e.state === 'done' ? '✓ خلّص ' : e.state === 'blocked' ? '■ واقف ' : '● بيشتغل ') + e.text));
        lines.appendChild(li);
      });
    }
    if (!evs.length && statusLines.length) { return; }
    if (!evs.length) {
      var stf = (baseFeed && baseFeed.staff) || [];
      var ago = function (iso) { var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); if (!(m >= 0)) { return ''; } if (m < 2) { return 'دلوقتي'; } if (m < 60) { return 'من ' + m + ' دقيقة'; } if (m < 1440) { return 'من ' + Math.round(m / 60) + ' ساعة'; } return 'من ' + Math.round(m / 1440) + ' يوم'; };
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
        baseFeed = result.data;
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
      css.href = 'org.css?v=2';
      document.head.appendChild(css);
      window.__orgStatusLines = function () { return statusLines; };
      var sc = document.createElement('script');
      sc.src = 'org.js?v=2';
      sc.defer = true;
      document.body.appendChild(sc);
    } catch (e) {}
  }

  bootOrgView();
  restoreTL();
  init();
  setTimeout(function () { try { renderLog(); renderSummary(); } catch (e) { /* optional */ } }, 1500);
})();
