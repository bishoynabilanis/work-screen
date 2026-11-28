/* Idea 58 test. Run: node tests/metrics-test.js   (METRICS_BAD=1 node tests/metrics-test.js must FAIL)
   Runs the IDEA58 block from app.js. Checks: only whole numbers 0..99999 are accepted (text, negative, fraction, NaN, huge, missing = "غير متاح"); unknown keys are never read; trend only when both numbers are valid; trend is a word plus a sign; three fixed cards (shop, content, Jessica) with fixed titles; a missing metrics object gives all "غير متاح", never a made-up number; feed.json, if it has "metrics", holds only the fixed keys with whole numbers (no names, ids, text); text is 14px+; no network, storage or innerHTML. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
var m = app.match(/\/\* IDEA58-BEGIN[\s\S]*?IDEA58-END \*\//); if (!m) { console.error('FAIL: IDEA58 block missing'); process.exit(1); }
var code = m[0];
if (process.env.METRICS_BAD) { code = code.replace('return asOf === metricDay(now)', 'return true').replace('v >= 0 && ', '').replace('v <= 99999 && ', '').replace('Math.floor(v) === v', 'true').replace("(a === null || b === null) ? null", "(a === null && b === null) ? null").replace("(a > b ? 'up' : (a < b ? 'down' : 'same'))", "(a > b ? 'down' : (a < b ? 'up' : 'same'))").replace("(it.n === null ? 'غير متاح' :", "(it.n === null ? '0' :"); }
var bad = [], n = 0; function chk(ok, t) { n++; if (!ok) { bad.push(t); } }
var ctx = { Object: Object, isFinite: isFinite, Math: Math, Date: Date, Intl: Intl, document: {}, baseFeed: null }; vm.createContext(ctx);
vm.runInContext(code + '\nthis.mi = metricInt; this.mr0 = metricRows; this.mf = metricFresh; this.md = metricDay; this.defs = METRIC_DEFS;', ctx);
var NOW = Date.UTC(2026, 10, 28, 8, 0, 0), TODAY = '2026-11-28';
var mi = ctx.mi, mr = function (x) { if (x && typeof x === 'object' && !Array.isArray(x) && !('asOf' in x)) { x = Object.assign({ asOf: TODAY }, x); } return ctx.mr0(x, NOW); };
chk(mi(0) === 0 && mi(7) === 7 && mi(99999) === 99999, 'whole numbers 0..99999 pass');
chk(mi(-1) === null && mi(1.5) === null && mi(100000) === null && mi('5') === null && mi(NaN) === null && mi(Infinity) === null && mi(null) === null && mi(undefined) === null && mi({}) === null, 'negative, fraction, huge, text, NaN, Infinity, null, object are dropped');
var rows = mr({ shop: { orders: { n: 5, prev: 3 }, secret: { n: 9, prev: 1 } }, content: { posts: { n: 2, prev: 2 }, videos: { n: 1 } }, jessica: { done: { n: 'x', prev: 4 } }, other: { a: { n: 1, prev: 1 } } });
chk(rows.length === 3 && rows.map(function (r) { return r.key; }).join() === 'shop,content,jessica', 'three fixed cards: shop, content, jessica');
chk(rows[0].items.length === 1 && rows[0].items[0].trend === 'up' && rows[0].items[0].n === 5 && rows[0].items[0].prev === 3, 'shop orders 5 vs 3 = up; unknown key "secret" is never read');
chk(rows[1].items[0].trend === 'same' && rows[1].items[1].n === 1 && rows[1].items[1].prev === null && rows[1].items[1].trend === null, 'same = same; one number missing = no trend');
chk(rows[2].items[0].n === null && rows[2].items[0].trend === null, 'a text value is dropped (unavailable)');
var none = mr(null).concat(mr('x'), mr([]));
chk(none.every(function (c) { return c.items.every(function (i) { return i.n === null && i.prev === null && i.trend === null; }); }), 'no metrics object: everything unavailable, nothing invented');
var raw = { shop: { orders: { n: 5, prev: 3 } } };
function allNone(r) { return r.every(function (c) { return c.items.every(function (i) { return i.n === null && i.prev === null && i.trend === null; }); }); }
chk(ctx.md(Date.UTC(2026, 10, 28, 21, 0, 0)) === '2026-11-29' && ctx.md(Date.UTC(2026, 10, 28, 19, 59, 0)) === '2026-11-28', 'the day is the Dubai day (UTC+4): 20:00 UTC is already the next day');
chk(mr(Object.assign({ asOf: TODAY }, raw))[0].items[0].n === 5, 'asOf is today: numbers show');
chk(allNone(ctx.mr0(raw, NOW)), 'asOf missing: everything unavailable');
chk(allNone(ctx.mr0(Object.assign({ asOf: '2026-11-27' }, raw), NOW)) && allNone(ctx.mr0(Object.assign({ asOf: '2026-11-29' }, raw), NOW)), 'asOf yesterday or tomorrow: everything unavailable (no stale "today" number)');
chk(['2026-13-01', '2026-11-28T00:00', ' 2026-11-28', '20261128', 20261128, null, {}, '2026-11-28 '].every(function (b) { return allNone(ctx.mr0(Object.assign({ asOf: b }, raw), NOW)); }), 'asOf badly formed (wrong month, extra text, spaces, number, null, object): everything unavailable');
chk(allNone(ctx.mr0(Object.assign({ asOf: TODAY }, raw), Date.UTC(2026, 10, 28, 21, 0, 0))), 'after midnight in Dubai the same asOf is old: unavailable');
chk(mr({ shop: { orders: { n: 1, prev: 4 } } })[0].items[0].trend === 'down', 'down when less');
chk(/' ▲ أكتر'/.test(code) && /' ▼ أقل'/.test(code) && /' = زي أمس'/.test(code) && /'غير متاح'/.test(code), 'trend is a word and a sign; unavailable is a word');
chk(/المتجر/.test(code) && /المحتوى/.test(code) && /جيسيكا/.test(code), 'fixed card titles');
chk(/font-size:14px/.test(code) && !/font-size:1[0-3]px/.test(code), '14px text');
var feed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'feed.json'), 'utf8')), ok = true;
if (process.env.METRICS_BAD) { feed.metrics = { shop: { orders: { n: 'x', prev: 1.5, name: 'a' } } }; }
if ('metrics' in feed) { var mm = feed.metrics, allowed = { shop: ['orders'], content: ['posts', 'videos'], jessica: ['done'] }; Object.keys(mm).forEach(function (g) { if (g === 'asOf') { if (!/^\d{4}-\d{2}-\d{2}$/.test(mm.asOf)) { ok = false; } return; } if (!allowed[g]) { ok = false; return; } Object.keys(mm[g]).forEach(function (k) { if (allowed[g].indexOf(k) < 0) { ok = false; return; } Object.keys(mm[g][k]).forEach(function (f) { if (f !== 'n' && f !== 'prev') { ok = false; } if (typeof mm[g][k][f] !== 'number' || !isFinite(mm[g][k][f]) || mm[g][k][f] < 0 || Math.floor(mm[g][k][f]) !== mm[g][k][f]) { ok = false; } }); }); }); }
chk(ok, 'feed.json metrics (if present) holds only the fixed keys with whole numbers');
chk((app.match(/renderMetrics\(\)/g) || []).length >= 2, 'the page calls it with the summary render');
chk(!/fetch|XMLHttpRequest|localStorage|sessionStorage|innerHTML|WebSocket/.test(code.replace(/Nothing sent or saved\./, '')), 'no network, storage or innerHTML');
if (bad.length) { console.error('FAIL ' + bad.length + ' of ' + n + ':\n- ' + bad.join('\n- ')); process.exit(1); }
console.log('metrics ok: ' + n + ' of ' + n + ' checks');
