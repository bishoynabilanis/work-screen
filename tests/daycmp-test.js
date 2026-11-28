/* Idea 57 test. Run: node tests/daycmp-test.js   (DAY_BAD=1 node tests/daycmp-test.js must FAIL)
   Runs the IDEA57 block from app.js. Checks: counts only finished jobs, today vs yesterday by calendar day; more / less / same give the right trend; when the saved lines do not reach back to the start of yesterday the yesterday number is unknown (null, no arrow, never "less"); groups with 0 and 0 are left out; future lines ignored; strip text is fixed words, numbers, a word AND a sign for the trend; hidden when empty; the keyboard-focus fix in the "Waiting" shelf (focus returns to the button when the panel closes, stays on the same row after a refresh); no network, storage or innerHTML. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
var m = app.match(/\/\* IDEA57-BEGIN[\s\S]*?IDEA57-END \*\//); if (!m) { console.error('FAIL: IDEA57 block missing'); process.exit(1); }
var code = m[0], wait = app.match(/\/\* IDEA56-BEGIN[\s\S]*?IDEA56-END \*\//)[0];
if (process.env.DAY_BAD) { code = code.replace("e.state !== 'done' || ", '').replace('var known = oldest <= y0', 'var known = true').replace("(a > b ? 'up' : (a < b ? 'down' : 'same'))", "(a > b ? 'down' : (a < b ? 'up' : 'same'))").replace("if (!a && !b) { return; }", ''); wait = wait.replace('btn.focus();', '').replace('pan.children[Math.min(fIdx, pan.children.length - 1)].focus();', ''); }
var bad = [], n = 0; function chk(ok, t) { n++; if (!ok) { bad.push(t); } }
var ctx = { Date: Date, Infinity: Infinity, Object: Object, Math: Math, document: {}, statusLines: [], MIX_CAT_OF: {}, MIX_CATS: [], deptOf: function () { return ''; } }; vm.createContext(ctx);
vm.runInContext(code + '\nthis.dc = dayCompare;', ctx);
var CATS = [['content', 'محتوى'], ['research', 'بحث'], ['maintenance', 'صيانة']], map = { a: 'content', b: 'research', c: 'maintenance' }, f = function (k) { return map[k]; };
var now = new Date(2026, 10, 28, 15, 0, 0).getTime(), D = 86400000, t0 = new Date(2026, 10, 28).getTime();
function L(id, st, ms) { return { id: id, state: st, ms: ms }; }
var lines = [L('a', 'done', t0 + 3600000), L('a', 'done', t0 + 7200000), L('a', 'done', t0 - 3600000), L('b', 'done', t0 + 1000), L('b', 'done', t0 - 1000), L('b', 'done', t0 - 2000), L('a', 'start', t0 + 5000), L('z', 'done', t0 + 6000), L('c', 'done', now + 5 * D), L('x', 'done', t0 - 2 * D)];
var r = ctx.dc(lines, now, f, CATS), by = {}; r.forEach(function (x) { by[x.key] = x; });
chk(by.content && by.content.today === 2 && by.content.yest === 1 && by.content.trend === 'up', 'content 2 today, 1 yesterday = up (only finished jobs count, "start" lines do not)');
chk(by.research && by.research.today === 1 && by.research.yest === 2 && by.research.trend === 'down', 'research 1 vs 2 = down');
chk(!by.maintenance, 'a group with 0 and 0 is left out (future line and unknown worker ignored)');
var same = ctx.dc([L('a', 'done', t0 + 5), L('a', 'done', t0 - 5), L('b', 'done', t0 - 2 * D)], now, f, CATS);
chk(same[0] && same[0].trend === 'same', 'same number = same');
var unk = ctx.dc([L('a', 'done', t0 + 5), L('a', 'done', t0 - 5 * 3600000 + 1)], now, f, CATS);
chk(unk[0] && unk[0].yest === null && unk[0].trend === null, 'lines do not reach back to yesterday start: yesterday is unknown, no arrow');
chk(ctx.dc([], now, f, CATS).length === 0 && ctx.dc(null, now, f, CATS).length === 0, 'empty is empty');
chk(/' ▲ أكتر'/.test(code) && /' ▼ أقل'/.test(code) && /' = زي أمس'/.test(code) && /لسه مفيش/.test(code), 'the trend is a word and a sign');
chk(/if \(!list\.length\) \{ if \(box\) \{ box\.remove\(\); \} return; \}/.test(code), 'hidden when nothing to show');
chk(/font-size:14px/.test(code) && !/font-size:1[0-3]px/.test(code), '14px text');
chk(/btn\.focus\(\);/.test(wait) && /children\[Math\.min\(fIdx, pan\.children\.length - 1\)\]\.focus\(\)/.test(wait), 'waiting shelf: focus returns to the button on close and stays on the same row after a refresh');
chk(!/fetch|XMLHttpRequest|localStorage|sessionStorage|innerHTML|WebSocket/.test(code.replace(/Nothing sent or saved\./, '')), 'no network, storage or innerHTML');
if (bad.length) { console.error('FAIL ' + bad.length + ' of ' + n + ':\n- ' + bad.join('\n- ')); process.exit(1); }
console.log('daycmp ok: ' + n + ' of ' + n + ' checks');
