/* Idea 55 test. Run: node tests/sr-test.js   (SR_BAD=1 node tests/sr-test.js must FAIL)
   Runs the IDEA55 block from app.js with a fake page. Checks: the announcement text is worker, comma, position "3 من 47"; one hidden polite live region is made once and reused; it sits off screen (not visible text); nothing is announced with no card; swipe and arrow moves call it; no network, storage or innerHTML. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
var m = app.match(/\/\* IDEA55-BEGIN[\s\S]*?IDEA55-END \*\//); if (!m) { console.error('FAIL: IDEA55 block missing'); process.exit(1); }
var code = m[0], go = app.slice(app.indexOf('function swipeGo'), app.indexOf('function swipeBind'));
if (process.env.SR_BAD) { code = code.replace("'aria-live', 'polite'", "'aria-live', 'off'").replace("(i + 1) + ' من '", "i + ' من '").replace('clip:rect(0,0,0,0);', '').replace('if (!srEl) {', 'if (true) {'); go = go.replace('announce();', ''); }
var bad = [], n = 0; function chk(ok, t) { n++; if (!ok) { bad.push(t); } }
var made = [];
function mk() { var el = { attrs: {}, style: {}, textContent: '', setAttribute: function (k, v) { this.attrs[k] = v; } }; made.push(el); return el; }
var ctx = { cardEl: { querySelector: function () { return { textContent: 'يوسف · مسودات فيسبوك' }; } }, cardFor: 'c3', swipeOrder: function () { var a = []; for (var k = 0; k < 47; k++) { a.push('c' + k); } return a; }, String: String,
  document: { createElement: mk, body: { appendChild: function () {} } } };
vm.createContext(ctx); vm.runInContext(code + '\nthis.t = srText; this.a = announce;', ctx);
chk(ctx.t('يوسف', 2, 47) === 'يوسف، 3 من 47', 'text reads worker, then position 3 من 47');
ctx.a(); ctx.a();
chk(made.length === 1, 'one live region, made once and reused');
var el = made[0] || { attrs: {}, style: {} };
chk(el.attrs['aria-live'] === 'polite' && el.attrs.role === 'status' && el.attrs['aria-atomic'] === 'true', 'polite status region');
chk(/clip:rect\(0,0,0,0\)/.test(el.style.cssText || '') && /position:absolute/.test(el.style.cssText || ''), 'region is off screen (not visible text)');
chk(el.textContent === 'يوسف · مسودات فيسبوك، 4 من 47', 'announces the open card and its position');
ctx.cardEl = null; el.textContent = 'x'; ctx.a(); chk(el.textContent === 'x', 'no card: nothing announced');
chk(/announce\(\)/.test(go), 'swipe and arrow moves (swipeGo) call the announcement');
chk(!/fetch|XMLHttpRequest|localStorage|sessionStorage|innerHTML|WebSocket/.test(code), 'no network, storage or innerHTML');
if (bad.length) { console.error('FAIL ' + bad.length + ' of ' + n + ':\n- ' + bad.join('\n- ')); process.exit(1); }
console.log('sr ok: ' + n + ' of ' + n + ' checks');
