/* Idea 53 test. Run: node tests/swipe-test.js   (SWIPE_BAD=1 node tests/swipe-test.js must FAIL)
   Runs the IDEA53 block from app.js. Checks: 40px minimum; sideways swipe picks next or previous by page direction (right-to-left: swipe right = next, left-to-right: swipe left = next); a mostly-down swipe closes, a swipe up does nothing; mostly-diagonal and tiny moves do nothing; the list stops at both ends; the dots show at most 7, the active one stays inside, and the window follows the position; code has no network, innerHTML or storage; the card sets touch-action none (not pan-y, which makes Chrome cancel a vertical drag) and the 200ms slide is skipped for reduced motion. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
var m = app.match(/\/\* IDEA53-BEGIN[\s\S]*?IDEA53-END \*\//); if (!m) { console.error('FAIL: IDEA53 block missing'); process.exit(1); }
var code = m[0], wire = app.slice(app.indexOf('/* IDEA53 wiring */'), app.indexOf('function showCard'));
if (process.env.SWIPE_BAD) { code = code.replace('SWIPE_MIN = 40', 'SWIPE_MIN = 10').replace("(dx > 0) === !!rtl", "(dx > 0) !== !!rtl").replace('Math.min(n, DOTS_MAX)', 'n'); wire = wire.replace("cnt.setAttribute('dir', 'ltr')", 'void 0').replace('ev.stopPropagation(); el.setPointerCapture(ev.pointerId)', 'void 0').replace("touchAction = 'none'", "touchAction = 'pan-y'").replace("=== 'close') { down = false; closeCard()", "=== 'close') { tdown = false; closeCard()", "=== 'x') { tdown = false; closeCard()").replace('prefers-reduced-motion', 'x'); }
var bad = [], n = 0; function chk(ok, t) { n++; if (!ok) { bad.push(t); } }
var ctx = { Math: Math, Number: Number, isFinite: isFinite }; vm.createContext(ctx);
vm.runInContext(code + '\nthis.sd = swipeDir; this.st = swipeTarget; this.dw = dotWindow;', ctx);
var sd = ctx.sd, st = ctx.st, dw = ctx.dw;
chk(sd(-60, 5, true) === 'prev' && sd(60, 5, true) === 'next', 'right-to-left: swipe right = next, swipe left = previous');
chk(sd(-60, 5, false) === 'next' && sd(60, 5, false) === 'prev', 'left-to-right: swipe left = next, swipe right = previous');
chk(sd(0, 60, true) === 'close' && sd(10, 80, false) === 'close', 'swipe down closes');
chk(sd(0, -80, true) === '', 'swipe up does nothing');
chk(sd(39, 0, true) === '' && sd(0, 39, true) === '' && sd(-39, 0, false) === '', 'under 40px does nothing');
chk(sd(40, 0, true) === 'next' && sd(0, 40, true) === 'close', 'exactly 40px counts');
chk(sd(50, 50, true) === '' && sd(-45, 45, false) === '', 'a diagonal move does nothing');
chk(sd(NaN, 5, true) === '' && sd(undefined, 60, true) === '' && sd('x', 'y', true) === '', 'bad numbers do nothing');
var o = ['a', 'b', 'c'];
chk(st(o, 'b', 'next') === 'c' && st(o, 'b', 'prev') === 'a', 'next and previous move one step');
chk(st(o, 'c', 'next') === 'c' && st(o, 'a', 'prev') === 'a', 'the list stops at both ends');
chk(st(o, 'zzz', 'next') === 'zzz' && st(o, 'b', '') === 'b' && st(o, 'b', 'close') === 'b', 'unknown id, empty or close move nothing');
var w = dw(47, 0); chk(w.count === 7 && w.start === 0 && w.active === 0, 'dots at the start');
w = dw(47, 46); chk(w.count === 7 && w.start === 40 && w.active === 6, 'dots at the end');
w = dw(47, 20); chk(w.count === 7 && w.start === 17 && w.active === 3, 'dots in the middle follow the position');
w = dw(3, 1); chk(w.count === 3 && w.active === 1, 'few workers show all dots');
w = dw(0, 0); chk(w.count === 0, 'no workers, no dots');
var ok = true; for (var i = 0; i < 47; i++) { var x = dw(47, i); if (x.active < 0 || x.active >= x.count || x.start + x.count > 47) { ok = false; } } chk(ok, 'the active dot is always inside the window');
var all = code + wire;
chk(!/fetch\(|XMLHttpRequest|sendBeacon|https?:\/\/|innerHTML|eval\(|localStorage|sessionStorage|cookie/.test(all), 'no network, innerHTML or storage');
chk(/touchAction = 'none'/.test(wire) && !/touchAction = 'pan-y'/.test(wire), 'the card takes all drags itself (touch-action none), so swipe-down is never cancelled by the browser');
chk(/prefers-reduced-motion: reduce/.test(wire) && /if \(reduce \|\| !cardEl\) \{ return; \}/.test(wire) && /transform 200ms ease/.test(wire), '200ms slide, skipped for reduced motion');
chk(/ev\.target\.closest\('button'\)/.test(wire), 'taps on the close button are not swipes');
chk(/ev\.stopPropagation\(\); el\.setPointerCapture\(ev\.pointerId\)/.test(wire), 'the card keeps the pointer (the 3D scene must not take the drag)');
chk(/cnt\.setAttribute\('dir', 'ltr'\)/.test(wire), 'the position count reads 3 / 47 in a right-to-left page, not 47 / 3');
if (bad.length) { console.error('FAIL ' + bad.length + ' of ' + n + ':\n- ' + bad.join('\n- ')); process.exit(1); }
console.log('swipe ok: ' + n + ' of ' + n + ' checks');
