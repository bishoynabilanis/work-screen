/* Idea 48 test. Run: node tests/a2hs-test.js   (A2HS_BAD=1 node tests/a2hs-test.js must FAIL: deliberate-failure check)
   Checks: hint only on iPhone/iPad when not opened from the home screen and not dismissed; manifest icons exist with the right pixel sizes; apple-touch-icon points to a real PNG; no network words in the block. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var root = path.join(__dirname, '..');
var app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
var m = app.match(/\/\* IDEA48-BEGIN[\s\S]*?IDEA48-END \*\//);
if (!m) { console.error('FAIL: IDEA48 block not found in app.js'); process.exit(1); }
var code = m[0];
if (process.env.A2HS_BAD) { code = code.replace('if (env.standalone || env.navStandalone) { return false; }', ''); }
var ctx = {}; vm.createContext(ctx); vm.runInContext(code + '\nthis.__n = a2hsNeeded;', ctx);
var need = ctx.__n, bad = [], n = 0;
function chk(ok, t) { n++; if (!ok) { bad.push(t); } }
var IP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
var AN = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
chk(need({ ua: IP, platform: 'iPhone', touch: 5 }) === true, 'iPhone in Safari should see the hint');
chk(need({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', platform: 'MacIntel', touch: 5 }) === true, 'iPadOS (Mac UA with touch) should see the hint');
chk(need({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', touch: 0 }) === false, 'a real Mac should not see it');
chk(need({ ua: AN, platform: 'Linux armv8l', touch: 5 }) === false, 'Android should not see it');
chk(need({ ua: IP, platform: 'iPhone', touch: 5, standalone: true }) === false, 'display-mode standalone should hide it');
chk(need({ ua: IP, platform: 'iPhone', touch: 5, navStandalone: true }) === false, 'navigator.standalone should hide it');
chk(need({ ua: IP, platform: 'iPhone', touch: 5, seen: true }) === false, 'dismissed hint should stay hidden');
chk(!/fetch\(|XMLHttpRequest|sendBeacon|https?:\/\//.test(code), 'hint block must have no network calls or links');
chk(code.indexOf('شارك ← إضافة للشاشة الرئيسية') > 0, 'exact hint text missing');
var mf = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
chk(Array.isArray(mf.icons) && mf.icons.length >= 3, 'manifest has no icons');
function png(f) { var b = fs.readFileSync(path.join(root, f)); if (b.slice(1, 4).toString() !== 'PNG') { return null; } return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); }
var purposes = {};
(mf.icons || []).forEach(function (i) { var sz = ''; try { sz = png(i.src); } catch (e) { sz = 'missing'; } chk(sz === i.sizes, 'manifest icon ' + i.src + ' is ' + sz + ', manifest says ' + i.sizes); purposes[i.sizes + i.purpose] = 1; });
chk(purposes['192x192any'] && purposes['512x512any'] && purposes['512x512maskable'], 'need 192 any, 512 any, 512 maskable');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var at = html.match(/rel="apple-touch-icon" href="([^"]+)"/);
chk(!!at, 'apple-touch-icon link missing'); if (at) { chk(png(at[1]) === '180x180', 'apple-touch-icon is not a 180x180 PNG'); }
if (bad.length) { console.error('FAILED ' + bad.length + ' of ' + n + ':\n' + bad.join('\n')); process.exit(1); }
console.log('a2hs ok: ' + n + ' of ' + n + ' checks');
