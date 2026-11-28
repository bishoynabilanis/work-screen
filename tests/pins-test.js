/* Idea 52 test. Run: node tests/pins-test.js   (PINS_BAD=1 node tests/pins-test.js must FAIL)
   Runs the IDEA52 block from org.js. Checks: only known worker ids are kept; text, objects, numbers, long or odd ids and repeats are dropped; at most 8 pins; toggle adds and removes; nothing but ids is written to storage; no network or innerHTML in the block and in the wiring; the CSS keeps pin buttons at 44px and 14px. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var d = path.join(__dirname, '..');
var js = fs.readFileSync(path.join(d, 'org.js'), 'utf8'), css = fs.readFileSync(path.join(d, 'org.css'), 'utf8');
var m = js.match(/\/\* IDEA52-BEGIN[\s\S]*?IDEA52-END \*\//); if (!m) { console.error('FAIL: IDEA52 block missing'); process.exit(1); }
var code = m[0];
if (process.env.PINS_BAD) { code = code.replace("allowed[x] === true && ", "").replace("cur.length < PIN_MAX", "true"); js = js.replace('pinBar.scrollLeft = keepL', ''); css = css.replace('min-height: 44px; min-width: 44px', 'min-height: 30px; min-width: 30px'); }
var bad = [], n = 0; function chk(ok, t) { n++; if (!ok) { bad.push(t); } }
var ctx = { Array: Array, JSON: JSON }; vm.createContext(ctx); vm.runInContext(code + '\nthis.clean = pinClean; this.tog = pinToggle;', ctx);
var allowed = {}; ['yasser', 'ibrahim', 'hany', 'kamel', 'saif', 'muse', 'ideas', 'salwa', 'karim', 'noha', 'rasha'].forEach(function (i) { allowed[i] = true; });
var clean = ctx.clean, tog = ctx.tog;
chk(JSON.stringify(clean(['yasser', 'ibrahim'], allowed)) === '["yasser","ibrahim"]', 'known ids kept in order');
chk(JSON.stringify(clean(['yasser', 'yasser', 'saif'], allowed)) === '["yasser","saif"]', 'repeats dropped');
chk(JSON.stringify(clean(['nobody', '<b>x</b>', 'ya sser', '', 5, null, { a: 1 }, ['yasser']], allowed)) === '[]', 'unknown ids, text, numbers, objects, arrays dropped');
chk(JSON.stringify(clean('yasser', allowed)) === '[]' && JSON.stringify(clean(null, allowed)) === '[]' && JSON.stringify(clean(undefined, allowed)) === '[]', 'non-lists give an empty list');
chk(JSON.stringify(clean(['constructor', '__proto__', 'toString'], allowed)) === '[]', 'prototype names dropped');
var ids9 = Object.keys(allowed).slice(0, 9); chk(clean(ids9, allowed).length === 8, 'at most 8 pins');
chk(JSON.stringify(tog([], 'yasser', allowed)) === '["yasser"]', 'toggle adds');
chk(JSON.stringify(tog(['yasser', 'saif'], 'yasser', allowed)) === '["saif"]', 'toggle removes');
chk(JSON.stringify(tog(['yasser'], 'nobody', allowed)) === '["yasser"]', 'toggle ignores unknown id');
chk(tog(ids9.slice(0, 8), ids9[8], allowed).length === 8, 'toggle does not pass 8');
var s = JSON.stringify(tog(['yasser'], 'ibrahim', allowed)); chk(/^\["[A-Za-z0-9-]+"(,"[A-Za-z0-9-]+")*\]$/.test(s), 'stored value is a plain list of ids');
var wiring = js.slice(js.indexOf('/* IDEA52 wiring */'), js.indexOf('function staleLabel') > js.indexOf('/* IDEA52 wiring */') ? undefined : js.indexOf('function buildPerson'));
var all = code + js.slice(js.indexOf('/* IDEA52 wiring */'), js.indexOf('/* IDEA52 wiring */') + 4200);
chk(!/fetch\(|XMLHttpRequest|sendBeacon|https?:\/\/|innerHTML|eval\(|cookie|sessionStorage/.test(all), 'pins code has no network, innerHTML, cookie');
chk(/localStorage\.setItem\(PIN_KEY, JSON\.stringify\(pins\)\)/.test(js) && (js.match(/localStorage\.setItem/g) || []).length === 1, 'only the id list is stored');
chk(/\.op-pin \{[^}]*min-height: 44px; min-width: 44px/.test(css) && /\.pin-item \{[^}]*min-height: 44px/.test(css) && /\.pin-item \{[^}]*font-size: 14px/.test(css) && /\.op-pin \{[^}]*font-size: 14px/.test(css), 'pin buttons are 44px tall and 14px text');
chk(/\.pin-bar \{[^}]*position: sticky/.test(css) && !/\.pin-bar \{[^}]*position: fixed/.test(css), 'bar is sticky, not fixed over the content');
var wl = js.slice(js.indexOf('function paintPins'), js.indexOf('function pinMake'));
chk(/keepL = pinBar\.scrollLeft/.test(wl) && wl.indexOf('keepL = pinBar.scrollLeft') < wl.indexOf("pinBar.textContent = ''"), 'scroll position is read before the bar is emptied');
chk(/pinBar\.scrollLeft = keepL/.test(wl) && wl.indexOf("pinBar.textContent = ''") < wl.indexOf('pinBar.scrollLeft = keepL'), 'scroll position is put back after the rebuild');
chk(/keepId = ae\.getAttribute\('data-pin'\)/.test(wl) && /keepId === id\) \{ try \{ it\.focus\(\)/.test(wl), 'the focused pin is remembered and focused again');
if (bad.length) { console.error('FAIL ' + bad.length + ' of ' + n + ':\n- ' + bad.join('\n- ')); process.exit(1); }
console.log('pins ok: ' + n + ' of ' + n + ' checks');
