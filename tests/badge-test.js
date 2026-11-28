/* Idea 51 test. Run: node tests/badge-test.js   (BADGE_BAD=1 node tests/badge-test.js must FAIL: deliberate-failure check)
   Runs the IDEA51 block from app.js with fake counters, a fake document and a fake navigator. Checks: the number is decisions + late jobs and only a whole number from 0 to 99; the tab title is "(n) المكتب" above 0 and the normal title at 0; the tab icon turns red above 0 and goes back to the original file at 0; setAppBadge gets the number, clearAppBadge runs at 0; a browser without the badge API, or one whose badge call is refused, causes no error; the block has no network, storage, tracking or innerHTML. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
var m = app.match(/\/\* IDEA51-BEGIN[\s\S]*?IDEA51-END \*\//);
if (!m) { console.error('FAIL: IDEA51 block not found in app.js'); process.exit(1); }
var code = m[0];
if (process.env.BADGE_BAD) { code = code.replace("else if (typeof navigator.clearAppBadge === 'function')", "else if (false)").replace("ln.setAttribute('href', badgeIcon0.href);", ""); }
var bad = [], n = 0;
function chk(ok, t) { n++; if (!ok) { bad.push(t); } }
chk(!/fetch\(|XMLHttpRequest|sendBeacon|https?:\/\/|localStorage|sessionStorage|cookie|innerHTML|eval\(/.test(code), 'badge block must have no network, storage, tracking or innerHTML');
function world(o) {
  o = o || {};
  var link = { a: { href: '2-icon-192.png', type: 'image/png', sizes: '192x192' }, getAttribute: function (k) { return k in this.a ? this.a[k] : null; }, setAttribute: function (k, v) { this.a[k] = v; }, removeAttribute: function (k) { delete this.a[k]; } };
  var doc = { title: 'مكتب الشغل', querySelector: function (q) { return q === 'link[rel="icon"]' ? link : null; } };
  var calls = { set: [], clear: 0 };
  var nav = {};
  if (!o.noApi) {
    nav.setAppBadge = function (v) { calls.set.push(v); return o.refuse ? Promise.reject(new Error('no')) : Promise.resolve(); };
    nav.clearAppBadge = function () { calls.clear++; return o.refuse ? Promise.reject(new Error('no')) : Promise.resolve(); };
  }
  var st = { dec: o.dec || 0, late: o.late || 0 };
  var ctx = { document: doc, navigator: nav, Math: Math, Number: Number, isFinite: isFinite, Promise: Promise, pendingDecisions: function () { return new Array(st.dec); }, lateCount: function () { return st.late; } };
  vm.createContext(ctx); vm.runInContext(code + '\nthis.__u = updateBadge; this.__b = badgeNum; this.__s = badgeSpec; this.__c = badgeCount;', ctx);
  return { ctx: ctx, doc: doc, link: link, calls: calls, st: st, upd: ctx.__u };
}
var w = world(); var bn = w.ctx.__b, bs = w.ctx.__s;
chk(bn(3) === 3 && bn(0) === 0 && bn(99) === 99, 'plain numbers pass');
chk(bn(-4) === 0 && bn(NaN) === 0 && bn(undefined) === 0 && bn(null) === 0, 'negative, NaN, undefined, null become 0');
chk(bn('7') === 7 && bn('abc') === 0 && bn('<b>') === 0, 'text never becomes a number except plain digits');
chk(bn(2.9) === 2 && bn(1000) === 99 && bn(Infinity) === 0, 'fractions drop, big numbers stop at 99, Infinity is 0');
chk(bs(3).title === '(3) المكتب' && bs(12).title === '(12) المكتب', 'title above 0 is exactly "(n) المكتب"');
chk(bs(0).title === 'مكتب الشغل' && bs(0).alert === false && bs(1).alert === true, 'title at 0 is the normal one');
var a = world({ dec: 2, late: 1 }); chk(a.ctx.__c() === 3, 'count is decisions + late jobs');
a.upd();
chk(a.doc.title === '(3) المكتب', 'document title set to (3) المكتب');
chk(a.calls.set.length === 1 && a.calls.set[0] === 3, 'setAppBadge called once with 3');
chk(/^data:image\/svg\+xml,/.test(a.link.a.href) && a.link.a.href.indexOf('%23dc2626') > 0 && a.link.a.type === 'image/svg+xml' && !('sizes' in a.link.a), 'icon swapped to the red svg data url');
a.upd(); chk(a.calls.set.length === 1, 'same number does nothing twice');
a.st.dec = 0; a.st.late = 0; a.upd();
chk(a.doc.title === 'مكتب الشغل', 'title goes back at 0');
chk(a.link.a.href === '2-icon-192.png' && a.link.a.type === 'image/png' && a.link.a.sizes === '192x192', 'icon goes back to the original file at 0');
chk(a.calls.clear === 1, 'clearAppBadge called at 0');
var u = world({ noApi: true, dec: 1 }); var threw = false; try { u.upd(); } catch (e) { threw = true; }
chk(!threw && u.doc.title === '(1) المكتب', 'no badge API: no error, title still works');
var r = world({ refuse: true, dec: 5 }); threw = false; try { r.upd(); } catch (e) { threw = true; }
chk(!threw, 'refused badge call causes no error');
process.on('unhandledRejection', function () { bad.push('refused badge call left an unhandled rejection'); });
var big = world({ dec: 80, late: 70 }); big.upd(); chk(big.calls.set[0] === 99 && big.doc.title === '(99) المكتب', 'huge count stops at 99');
setTimeout(function () {
  if (bad.length) { console.error('FAIL ' + bad.length + ' of ' + n + ':\n- ' + bad.join('\n- ')); process.exit(1); }
  console.log('OK ' + n + '/' + n);
}, 50);
