/* Idea 57 test. Run: node tests/legend-test.js   (LEGEND_BAD=1 node tests/legend-test.js must FAIL)
   Runs the LEGEND block from office3d.js with a tiny fake page. Checks: the button exists with an Arabic label; clicking it opens one sheet with role=dialog, aria-modal and an Arabic aria-label; the sheet has the colour words (blue, yellow, green, red, grey), the badge words (may be late, needs intervention, old data, needs your decision) and the numbers and touch words; every colour dot has a word next to it; ESC, the close button and a tap outside each close it and give focus back to the button; a second click does not open two sheets; no font under 14px; buttons at least 44px; the block has no network, storage, innerHTML, eval or tracking. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var src = fs.readFileSync(path.join(__dirname, '..', 'office3d.js'), 'utf8');
var m = src.match(/\/\* LEGEND-BEGIN[\s\S]*?LEGEND-END \*\//); var appSrc = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'); if (process.env.LEGEND_BAD) { appSrc = appSrc.replace("blocked: 'واقف'", "blocked: 'متعطل'"); }
var bad = [], n = 0; function chk(ok, t) { n++; if (!ok) { bad.push(t); } }
chk(!!m, 'LEGEND block found'); if (!m) { console.error('FAIL: block not found'); process.exit(1); }
var code = m[0];
if (process.env.LEGEND_BAD) { code = code.replace("e.key === 'Escape'", "e.key === 'Nothing'").replace("'أحمر = واقف، ومعاه علامة محتاج تدخل'", "'أحمر = متعطل'").replace("e.key === 'Tab'", "e.key === 'Nope'").replace("'dialog'", "'region'").replace('min-height:48px', 'min-height:30px'); }
function el(tag) { var e = { tag: tag, children: [], attrs: {}, style: {}, listeners: {}, parentNode: null, focused: false, textContent: '', type: '' };
  e.setAttribute = function (k, v) { e.attrs[k] = v; }; e.addEventListener = function (k, f) { (e.listeners[k] = e.listeners[k] || []).push(f); };
  e.appendChild = function (c) { c.parentNode = e; e.children.push(c); return c; }; e.removeChild = function (c) { e.children = e.children.filter(function (x) { return x !== c; }); c.parentNode = null; };
  e.focus = function () { doc.active = e; }; return e; }
var doc = { body: el('body'), active: null, createElement: el };
var ctx = { document: doc, window: {}, console: console }; vm.createContext(ctx);
vm.runInContext(code + '\nthis.__mk = makeLegendBtn; this.__rows = LEGEND_ROWS;', ctx);
var btn = ctx.__mk('min-height:48px;min-width:48px'); doc.body.appendChild(btn);
chk(btn.id === 'o3-legendbtn' && /[\u0600-\u06FF]/.test(btn.textContent) && /[\u0600-\u06FF]/.test(btn.attrs['aria-label']), 'button has an Arabic label');
function all(e, out) { out = out || []; out.push(e); e.children.forEach(function (c) { all(c, out); }); return out; }
function text(e) { return all(e).map(function (x) { return x.textContent; }).join(' | '); }
function open() { btn.listeners.click[0](); var sh = doc.body.children.filter(function (c) { return c.id === 'o3-legend'; }); return sh; }
var sh = open(); chk(sh.length === 1, 'click opens one sheet');
if (sh.length) { var s = sh[0], t = text(s);
  chk(s.attrs.role === 'dialog' && s.attrs['aria-modal'] === 'true' && /[\u0600-\u06FF]/.test(s.attrs['aria-label']), 'sheet is a dialog with an Arabic aria-label');
  ['أزرق', 'أصفر', 'أخضر', 'أحمر', 'رمادي'].forEach(function (w) { chk(t.indexOf(w) >= 0, 'colour word ' + w); });
  ['ممكن يتأخر', 'محتاج تدخل', 'بيانات قديمة', 'محتاج قرارك', 'ملخص اليوم', 'ثبّت', 'اسحب بإصبع تدوّر المشهد', 'أحمر = واقف', 'ماحدّثش من أكتر من 30 دقيقة', 'كل الحالات قديمة', 'ما عدا الأحمر', 'مالوش سجل لأمس لسه، مش إن أمس كان صفر'].forEach(function (w) { chk(t.indexOf(w) >= 0, 'word ' + w); });
  chk(t.indexOf('متعطل') < 0, 'the word متعطل is not used (the screen says واقف)');
  var tabEv = { key: 'Tab', prevented: false, preventDefault: function () { this.prevented = true; } }; doc.active = null; s.listeners.keydown[0](tabEv); chk(tabEv.prevented && doc.active && doc.active.textContent === 'تمام', 'Tab keeps focus inside the sheet (on the close button)');
  var dots = all(s).filter(function (x) { return x.attrs['aria-hidden'] === 'true'; }); chk(dots.length === 5, 'five colour dots'); chk(dots.every(function (d) { var sib = d.parentNode.children; return sib.length > 1 && sib[1].textContent.length > 3; }), 'every colour dot has a word next to it');
  chk(doc.active && doc.active.textContent === 'تمام', 'focus moves to the close button');
  btn.listeners.click[0](); chk(doc.body.children.filter(function (c) { return c.id === 'o3-legend'; }).length === 1, 'a second click does not open a second sheet');
  s.listeners.keydown[0]({ key: 'Enter' }); chk(doc.body.children.some(function (c) { return c.id === 'o3-legend'; }), 'other keys do not close it');
  s.listeners.keydown[0]({ key: 'Escape' }); chk(!doc.body.children.some(function (c) { return c.id === 'o3-legend'; }) && doc.body.children.length === 1, 'ESC closes it and removes the backdrop'); chk(doc.active === btn, 'focus goes back to the button after ESC');
  sh = open(); var cb = all(sh[0]).filter(function (x) { return x.tag === 'button'; })[0]; cb.listeners.click[0](); chk(doc.body.children.length === 1 && doc.active === btn, 'the close button closes it');
  sh = open(); var back = doc.body.children.filter(function (c) { return c.id !== 'o3-legend' && c !== btn; })[0]; back.listeners.click[0](); chk(doc.body.children.length === 1, 'a tap outside closes it');
}
chk(/blocked: 'واقف'/.test(appSrc) && !/blocked: 'متعطل'/.test(appSrc), 'the org card label for a stopped person is واقف, same as the sheet and the scene');
var sizes = (code.match(/font-size:\s*(\d+)px|font:[^;"']*?(\d+)px/g) || []).map(function (x) { return +x.match(/(\d+)px/)[1]; }); chk(sizes.length > 0 && Math.min.apply(null, sizes) >= 14, 'no font under 14px');
chk(/min-height:48px/.test(code), 'close button is at least 44px');
chk(!/fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|innerHTML|eval\(|new Function|WebSocket|\.src\s*=/.test(code), 'no network, storage, innerHTML or eval in the block');
if (bad.length) { console.error('FAIL ' + bad.length + ' of ' + n + ':\n- ' + bad.join('\n- ')); process.exit(1); }
console.log('legend ok: ' + n + ' of ' + n + ' checks');
