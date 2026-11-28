/* Idea 54 test. Run: node tests/keys-test.js   (KEYS_BAD=1 node tests/keys-test.js must FAIL)
   Runs the IDEA54 block from app.js with a fake page. Checks: in a right-to-left page ArrowRight = next and ArrowLeft = previous (same as the swipe), left-to-right is the reverse, other keys do nothing, nothing happens with no card open, while typing in a field, or with Ctrl/Alt/Meta/Shift held, and the block uses no network, storage or innerHTML. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
var m = app.match(/\/\* IDEA54-BEGIN[\s\S]*?IDEA54-END \*\//); if (!m) { console.error('FAIL: IDEA54 block missing'); process.exit(1); }
var code = m[0];
if (process.env.KEYS_BAD) { code = code.replace("return rtl ? 'next' : 'prev'", "return rtl ? 'prev' : 'next'").replace("ev.shiftKey || ", '').replace("tag === 'input' || ", '').replace('!cardEl || !cardFor || ', ''); }
var bad = [], n = 0; function chk(ok, t) { n++; if (!ok) { bad.push(t); } }
var handler = null, moves = [], dirRtl = true;
var ctx = { cardEl: {}, cardFor: 'c1', getComputedStyle: function () { return { direction: dirRtl ? 'rtl' : 'ltr' }; }, swipeGo: function (d) { moves.push(d); }, String: String,
  document: { addEventListener: function (t, f) { if (t === 'keydown') { handler = f; } } } };
vm.createContext(ctx); vm.runInContext(code + '\nthis.kd = keyDir;', ctx);
function press(key, o, rtl, card) { moves.length = 0; dirRtl = rtl !== false; ctx.cardEl = card === false ? null : {}; var ev = Object.assign({ key: key, target: { tagName: 'DIV' }, preventDefault: function () {} }, o || {}); handler(ev); return moves.join(','); }
chk(ctx.kd('ArrowRight', true) === 'next' && ctx.kd('ArrowLeft', true) === 'prev', 'right-to-left: ArrowRight = next, ArrowLeft = previous');
chk(ctx.kd('ArrowRight', false) === 'prev' && ctx.kd('ArrowLeft', false) === 'next', 'left-to-right is the reverse');
chk(ctx.kd('ArrowUp', true) === null && ctx.kd('a', true) === null, 'other keys do nothing');
chk(press('ArrowRight') === 'next' && press('ArrowLeft') === 'prev', 'the key handler moves the card');
chk(press('ArrowRight', null, true, false) === '', 'no card open: nothing');
chk(press('ArrowRight', { target: { tagName: 'INPUT' } }) === '', 'typing in a field: nothing');
chk(press('ArrowRight', { shiftKey: true }) === '' && press('ArrowRight', { ctrlKey: true }) === '', 'modifier keys held: nothing');
chk(!/fetch|XMLHttpRequest|localStorage|sessionStorage|innerHTML|WebSocket/.test(code), 'no network, storage or innerHTML');
if (bad.length) { console.error('FAIL ' + bad.length + ' of ' + n + ':\n- ' + bad.join('\n- ')); process.exit(1); }
console.log('keys ok: ' + n + ' of ' + n + ' checks');
