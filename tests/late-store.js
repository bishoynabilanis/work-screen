/* Idea 45 test. Run: node tests/late-store.js   (LATE_BAD=1 node tests/late-store.js must FAIL: deliberate-failure check)
   Runs the early-warning block from app.js on synthetic data and checks: numbers only in storage, no job names or text, the late rule works. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
var m = app.match(/\/\* IDEA45-BEGIN[\s\S]*?IDEA45-END \*\//);
if (!m) { console.error('FAIL: IDEA45 block not found in app.js'); process.exit(1); }
var code = m[0];
if (process.env.LATE_BAD2) { code = code.replace('el > 120', 'el > 720'); }
if (process.env.LATE_BAD) { code = code.replace("lateAvg[d] = [n,", "lateAvg[d + ' ' + e.text] = [n,"); }
var store = {}, bad = [];
var NOW = 1800000000000, MIN = 60000;
var ctx = { localStorage: { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } }, Date: Date, Math: Math, JSON: JSON, isFinite: isFinite, Object: Object, Array: Array, String: String, console: console };
ctx.baseFeed = { staff: [{ id: 'w1', dept: 'content' }, { id: 'w2', dept: 'content' }, { id: 'w3', dept: 'seo' }] };
var SECRET_JOB = 'اسم شغلانة سري ٩٩';
function L(id, state, minAgo, extra) { var o = { id: id, name: 'اسم ' + id, text: SECRET_JOB, job: SECRET_JOB, state: state, ms: NOW - minAgo * MIN }; return o; }
ctx.statusLines = [];
vm.createContext(ctx);
vm.runInContext(code + '\nthis.__api = { learnAvg: learnAvg, isLate: isLate, lateCount: lateCount, getAvg: function () { return lateAvg; } };', ctx);
var api = ctx.__api;
/* 3 finished tasks of 20 minutes in department content (w1) */
var lines = [];
[300, 200, 100].forEach(function (t) { lines.push(L('w1', 'start', t + 20)); lines.push(L('w1', 'done', t)); });
ctx.statusLines = lines.slice().sort(function (a, b) { return b.ms - a.ms; });
api.learnAvg();
var raw = store['ws_avg_v1'] || '';
if (!/^\{("[a-z0-9_-]+":\[\d+,\d+(\.\d+)?\],?)*\}$/.test(raw)) { bad.push('stored average is not numbers only: ' + raw); }
if (raw.indexOf(SECRET_JOB) >= 0 || raw.indexOf('w1') >= 0 || /[\u0600-\u06FF]/.test(raw)) { bad.push('stored average contains a name or text'); }
if (!/^\d+$/.test(store['ws_avg_t'] || '')) { bad.push('time marker is not a number'); }
var av = api.getAvg().content;
if (!av || av[0] !== 3 || Math.abs(av[1] - 20) > 0.2) { bad.push('average wrong: ' + JSON.stringify(av)); }
/* learning twice does not double count */
api.learnAvg(); if ((api.getAvg().content || [])[0] !== 3) { bad.push('double counting after second learn'); }
/* late rule */
function late(id, dept, startMin) { ctx.statusLines = [L(id, 'start', startMin)]; return api.isLate(id, dept, NOW); }
if (late('w2', 'content', 25)) { bad.push('25 min against 20 avg should not be late (limit 30)'); }
if (!late('w2', 'content', 35)) { bad.push('35 min against 20 avg should be late (over 1.5x)'); }
if (late('w3', 'seo', 30)) { bad.push('30 min with no average should not be late (limit 45)'); }
if (!late('w3', 'seo', 50)) { bad.push('50 min should be late (over 45)'); }
if (late('w3', 'seo', 800)) { bad.push('stale line over 12h must not count'); }
if (late('w3', 'seo', 130)) { bad.push('start line older than 2h must not count as late'); }
if (!late('w3', 'seo', 110)) { bad.push('start line 110 min old should still be late'); }
ctx.statusLines = [L('w2', 'done', 1), L('w2', 'start', 90)]; if (api.isLate('w2', 'content', NOW)) { bad.push('finished worker must not be late'); }
ctx.statusLines = [L('w2', 'start', 40), L('w3', 'start', 60), L('w1', 'done', 2)]; if (api.lateCount(NOW) !== 2) { bad.push('late count should be 2, got ' + api.lateCount(NOW)); }
/* storage written after the late checks still has no text */
if (/[\u0600-\u06FF]/.test(store['ws_avg_v1'] || '')) { bad.push('storage has Arabic text'); }
if (bad.length) { console.error('LATE TEST FAILED:\n' + bad.join('\n')); process.exit(1); }
console.log('late test ok: numbers only, rule works, no double count');
