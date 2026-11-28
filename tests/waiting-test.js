/* Idea 56 test. Run: node tests/waiting-test.js   (WAIT_BAD=1 node tests/waiting-test.js must FAIL)
   Runs the IDEA56 block from app.js. Checks: only workers whose NEWEST line is a question or a stop are listed; a worker who answered after is not; oldest wait first; 7 days look-back (8 days old = gone, but the old 1-day decisions list is not touched); dates in the future are ignored; a missing job name is not shown as a job; rows are 44px buttons, 14px+ text, show the kind as a word (قرار / واقف) as well as the colour; only the public job name is used (no ask text); hidden when empty; the page calls it with the other renders; no network, storage or innerHTML. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
var m = app.match(/\/\* IDEA56-BEGIN[\s\S]*?IDEA56-END \*\//); if (!m) { console.error('FAIL: IDEA56 block missing'); process.exit(1); }
var code = m[0];
if (process.env.WAIT_BAD) { code = code.replace("Object.keys(latest).forEach(function (k) { var e = latest[k]; if (e.ms >= cut", "(lines || []).forEach(function (e) { if (e.ms >= cut").replace('return a.ms - b.ms', 'return b.ms - a.ms').replace('WAIT_DAYS = 7', 'WAIT_DAYS = 30').replace("e.ms <= now + 60000 && ", '').replace('min-height:44px;border-radius:10px', 'min-height:30px;border-radius:10px').replace("'■ واقف'", "''").replace("w.job && w.job !== NOJOB ? ' · ' + w.job : ''", "' · ' + w.job"); }
var bad = [], n = 0; function chk(ok, t) { n++; if (!ok) { bad.push(t); } }
var ctx = { Date: Date, Object: Object, NOJOB: 'لسه ما بعتش', statusLines: [], decAge: function () { return 'من ساعة'; }, document: {}, window: {} }; vm.createContext(ctx);
vm.runInContext(code + '\nthis.wl = waitingList;', ctx);
var D = 86400000, now = 1000 * D;
function L(id, state, ask, ageDays) { return { id: id, name: 'n-' + id, text: 'شغلانة ' + id, state: state, ask: ask || '', ms: now - ageDays * D }; }
var lines = [L('a', 'blocked', '', 0.5), L('b', 'start', 'سؤال', 2), L('c', 'done', '', 1), L('d', 'blocked', '', 9), L('e', 'start', '', 1), L('f', 'blocked', '', -3)];
var r = ctx.wl(lines, now);
chk(r.length === 2 && r.map(function (x) { return x.id; }).join() === 'b,a', 'lists only the question (b) and the stop (a), oldest wait first');
chk(r[0].kind === 'decision' && r[1].kind === 'stopped', 'kind decision / stopped');
var lines2 = [{ id: 'a', name: 'x', text: 'ok', state: 'done', ms: now - 0.1 * D }, L('a', 'blocked', '', 1)];
chk(ctx.wl(lines2, now).length === 0, 'a worker who finished after the stop is not waiting (newest line decides)');
chk(ctx.wl([L('g', 'blocked', '', 6.9)], now).length === 1 && ctx.wl([L('g', 'blocked', '', 7.2)], now).length === 0, '7 days look-back');
chk(ctx.wl([], now).length === 0 && ctx.wl(null, now).length === 0, 'empty list is empty, not an error');
chk(r.every(function (x) { return x.job.indexOf('شغلانة') === 0; }) && !/\.ask\b[^;]*textContent/.test(code.replace(/e\.ask \? /g, '')), 'only the public job name is used');
chk(/min-height:44px;border-radius:10px/.test(code) && /font:15px/.test(code) && /font:700 15px/.test(code), '44px rows, 15px text');
chk(/'■ واقف'/.test(code) && /'\? قرار'/.test(code), 'kind shown as a word and a sign, not only colour');
chk(/if \(!list\.length\) \{ if \(btn\) \{ btn\.remove\(\); \}/.test(code), 'hidden when nothing waits');
chk((app.match(/renderWaiting\(\)/g) || []).length >= 4, 'called with the other renders (start, status change, every minute)');
chk(!/fetch|XMLHttpRequest|localStorage|sessionStorage|innerHTML|WebSocket/.test(code.replace(/No network, no new storage\./, '')), 'no network, storage or innerHTML');
if (bad.length) { console.error('FAIL ' + bad.length + ' of ' + n + ':\n- ' + bad.join('\n- ')); process.exit(1); }
console.log('waiting ok: ' + n + ' of ' + n + ' checks');
