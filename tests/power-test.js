/* Idea 49 test. Run: node tests/power-test.js   (POWER_BAD=1 node tests/power-test.js must FAIL: deliberate-failure check)
   Runs the IDEA49 block from app.js with a fake clock, fake document and fake battery. Checks: repeating timers stop while hidden, run once at once when visible again, then keep going; clearInterval still works; low-power mode only under 20% and not charging; no getBattery (iPhone) or a failing one is silent; no network words in the block. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
var m = app.match(/\/\* IDEA49-BEGIN[\s\S]*?IDEA49-END \*\//);
if (!m) { console.error('FAIL: IDEA49 block not found in app.js'); process.exit(1); }
var bad = [], n = 0;
function chk(ok, t) { n++; if (!ok) { bad.push(t); } }
chk(!/fetch\(|XMLHttpRequest|sendBeacon|https?:\/\/|localStorage|cookie/.test(m[0]), 'power block must have no network, storage or tracking');
function world(bat) {
  var now = 0, timers = {}, nid = 1, listeners = {}, classes = {}, w = { __WSPOWER_BAD: !!process.env.POWER_BAD };
  w.setInterval = function (fn, ms) { var id = nid++; timers[id] = { fn: fn, ms: ms, next: now + ms }; return id; };
  w.clearInterval = function (id) { delete timers[id]; };
  var doc = { hidden: false, head: { appendChild: function () {} }, createElement: function () { return {}; },
    documentElement: { classList: { toggle: function (c, on) { classes[c] = !!on; } } },
    addEventListener: function (t, f) { (listeners[t] = listeners[t] || []).push(f); } };
  var nav = bat === undefined ? {} : { getBattery: bat };
  w.Office3D = { calls: [], setLowPower: function (on) { w.Office3D.calls.push(on); } };
  var ctx = { window: w, document: doc, navigator: nav, Promise: Promise, Object: Object, Array: Array, Date: Date };
  vm.createContext(ctx);
  vm.runInContext(m[0], ctx);
  return { w: w, doc: doc, classes: classes,
    advance: function (ms) { var end = now + ms; for (;;) { var due = null; Object.keys(timers).forEach(function (k) { if (timers[k].next <= end && (!due || timers[k].next < timers[due].next)) { due = k; } }); if (!due) { break; } now = timers[due].next; timers[due].next += timers[due].ms; timers[due].fn(); } now = end; },
    setHidden: function (h) { doc.hidden = h; (listeners.visibilitychange || []).forEach(function (f) { f(); }); },
    real: function () { return Object.keys(timers).length; } };
}
var W = world(), a = 0, b = 0;
W.w.setInterval(function () { a++; }, 1000); var idb = W.w.setInterval(function () { b++; }, 5000);
W.advance(10000); chk(a === 10 && b === 2, 'timers should run while visible (got ' + a + ', ' + b + ')');
W.setHidden(true); var a0 = a, b0 = b; chk(W.real() === 0, 'no real timer should be left while hidden (left ' + W.real() + ')');
W.advance(60000); chk(a === a0 && b === b0, 'timers must not run while hidden (a ' + (a - a0) + ', b ' + (b - b0) + ')');
W.setHidden(false); chk(a === a0 + 1 && b === b0 + 1, 'each timer must run exactly once straight away when visible again');
W.advance(5000); chk(a === a0 + 6 && b === b0 + 2, 'timers must resume their normal rhythm');
W.w.clearInterval(idb); W.advance(10000); chk(b === b0 + 2, 'clearInterval must still stop a timer');
W.setHidden(true); W.w.setInterval(function () { a += 100; }, 1000); W.advance(5000); chk(a < 100 + a0, 'a timer created while hidden must wait');
W.setHidden(false); chk(W.w.WSPower.paused === false, 'paused flag back to false');
function bat(level, charging) { return function () { var h = {}; return Promise.resolve({ level: level, charging: charging, addEventListener: function (t, f) { h[t] = f; }, _h: h }); }; }
var tests = [[0.15, false, true], [0.15, true, false], [0.5, false, false], [0.2, false, false], [0.19, false, true]];
var pend = tests.map(function (t) { var X = world(bat(t[0], t[1])); return Promise.resolve().then(function () {}).then(function () {}).then(function () { chk(X.w.WSPower.low === t[2], 'battery ' + t[0] + ' charging ' + t[1] + ' should be low=' + t[2]); chk(X.classes['ws-lowpower'] === (t[2] ? true : undefined), 'class for ' + t[0]); if (t[2]) { chk(X.w.Office3D.calls[0] === true, '3D low quality should be asked'); } }); });
var Y = world(); chk(Y.w.WSPower.low === false, 'no getBattery (iPhone): stays normal and silent');
var Z = world(function () { return Promise.reject(new Error('no')); });
var C = world(function () { throw new Error('boom'); });
pend.push(Promise.resolve().then(function () {}).then(function () { chk(Z.w.WSPower.low === false, 'rejected getBattery stays silent'); }));
Promise.all(pend).then(function () {
  if (bad.length) { console.error('FAILED ' + bad.length + ' of ' + n + ':\n' + bad.join('\n')); process.exit(1); }
  console.log('power ok: ' + n + ' of ' + n + ' checks');
});
