/* Idea 46 test. Run: node tests/mix-test.js   (MIX_BAD=1 node tests/mix-test.js must FAIL: deliberate-failure check)
   Runs the IDEA46 block from app.js on synthetic data with a secret job name. Checks the one mapping table, the counts, today only, no text. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
var m = app.match(/\/\* IDEA46-BEGIN[\s\S]*?IDEA46-END \*\//);
if (!m) { console.error('FAIL: IDEA46 block not found in app.js'); process.exit(1); }
var code = m[0];
if (process.env.MIX_BAD) { code = code.replace("trend: 'research'", "trend: 'content'"); }
var NOW = new Date(2026, 10, 28, 15, 0, 0).getTime(), bad = [];
var ctx = { Date: Date, Math: Math, document: { getElementById: function () { return null; } } };
ctx.baseFeed = { staff: [{ id: 'a', dept: 'content' }, { id: 'b', dept: 'trend' }, { id: 'c', dept: 'seo' }, { id: 'd', dept: 'video' }, { id: 'e', dept: 'mail' }, { id: 'f', dept: 'jessica' }, { id: 'g', dept: 'tools' }, { id: 'h', dept: 'qa' }, { id: 'x', dept: 'unknown' }] };
ctx.deptOf = function (id) { var s = ctx.baseFeed.staff.filter(function (p) { return p.id === id; })[0]; return s ? s.dept : 'all'; };
function L(id, state, hoursAgo) { return { id: id, state: state, ms: NOW - hoursAgo * 3600000, job: 'اسم شغلانة سري ٩٩', text: 'نص سري' }; }
ctx.statusLines = [L('a', 'done', 1), L('b', 'done', 1), L('c', 'done', 2), L('d', 'done', 3), L('e', 'done', 3), L('f', 'done', 4), L('g', 'done', 4), L('h', 'done', 5), L('a', 'done', 6), L('x', 'done', 1), L('a', 'start', 1), L('a', 'done', 20)];
vm.createContext(ctx);
vm.runInContext(code + '\nthis.__api = { mixCounts: mixCounts, MIX_CAT_OF: MIX_CAT_OF };', ctx);
var r = ctx.__api.mixCounts(NOW);
if (r.total !== 9) { bad.push('total should be 9 today (unknown dept, start lines and yesterday excluded), got ' + r.total); }
if (r.n.content !== 2) { bad.push('content should be 2, got ' + r.n.content); }
if (r.n.research !== 2) { bad.push('research should be 2 (trend + seo), got ' + r.n.research); }
if (r.n.publishing !== 2) { bad.push('publishing should be 2 (video + mail), got ' + r.n.publishing); }
if (r.n.development !== 2) { bad.push('development should be 2 (jessica + tools), got ' + r.n.development); }
if (r.n.maintenance !== 1) { bad.push('maintenance should be 1 (qa), got ' + r.n.maintenance); }
var keys = Object.keys(r.n).sort().join(',');
if (keys !== 'content,development,maintenance,publishing,research') { bad.push('only the 5 fixed categories allowed: ' + keys); }
var dump = JSON.stringify(r);
if (/سري|[\u0600-\u06FF]/.test(dump)) { bad.push('result contains job name or Arabic text: ' + dump); }
if (bad.length) { console.error('MIX TEST FAILED:\n' + bad.join('\n')); process.exit(1); }
console.log('mix test ok: one mapping table, 5 fixed categories, today only, no text');
