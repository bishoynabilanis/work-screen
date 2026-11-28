/* Sharpness test (scene resolution on phones). Run: node tests/sharp-test.js   (SHARP_BAD=1 node tests/sharp-test.js must FAIL)
   Reads office3d.js. Checks: a touch device or iPhone with device pixel ratio 2 or more starts at "high" (native pixels, up to 3x); a low-ratio phone still starts at "med"; a desktop starts at "high"; the forced ?q= levels still win; the automatic downgrade is still there (two windows under 28 fps drop one level and cap it), so a slow phone protects itself; the climb back takes 20 s of 55+ fps, not 60 s; the office map canvas uses up to 3x; the "ultra" level still needs the ultraOk() check. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var src = fs.readFileSync(path.join(__dirname, '..', 'office3d.js'), 'utf8');
if (process.env.SHARP_BAD) { src = src.replace("(lowGpu || (COARSE && (window.devicePixelRatio || 1) < 2)) ? 'med' : 'high')", "(COARSE && (window.devicePixelRatio || 1) < 2) ? 'med' : 'high')").replace('(COARSE && i >= 2) ? 40 : 28', '28').replace('>= 20000', '>= 60000').replace('Math.min(3, window.devicePixelRatio || 1); cv.width', 'Math.min(2, window.devicePixelRatio || 1); cv.width').replace('Q.fps < ((COARSE && i >= 2) ? 40 : 28) && i > 0', 'false'); }
var bad = [], n = 0; function chk(ok, t) { n++; if (!ok) { bad.push(t); } }
var a0 = src.indexOf('var Q = { level: '), a1 = src.indexOf(', locked:', a0), m = a0 >= 0 && a1 > a0 ? [0, src.slice(a0 + 'var Q = { level: '.length, a1)] : null;
chk(!!m, 'the start-level expression is found');
function startLevel(o) {
  var ctx = { location: { search: o.q || '' }, window: { devicePixelRatio: o.dpr }, lowGpu: !!o.low, COARSE: !!o.coarse, RegExp: RegExp }; vm.createContext(ctx);
  return vm.runInContext('(' + m[1].replace('RegExp.$1', "(location.search.match(/[?&]q=(low|med|high|ultra)/) || [])[1]") + ')', ctx);
}
if (m) {
  chk(startLevel({ dpr: 3, coarse: true, low: true }) === 'med', 'a low-GPU phone (iPhone or ratio above 2) still starts at med whatever its ratio');
  chk(startLevel({ dpr: 3, coarse: false, low: true }) === 'med', 'a low-GPU device without touch still starts at med');
  chk(startLevel({ dpr: 2, coarse: true, low: false }) === 'high', 'phone or tablet with ratio 2 (not low-GPU) starts at high');
  chk(startLevel({ dpr: 1, coarse: true, low: true }) === 'med', 'phone with ratio 1 still starts at med');
  chk(startLevel({ dpr: 1, coarse: false, low: false }) === 'high' && startLevel({ dpr: 2, coarse: false, low: false }) === 'high', 'desktop starts at high');
  chk(startLevel({ dpr: 3, coarse: true, low: true, q: '?q=low' }) === 'low', 'a forced ?q= level still wins');
}
chk(/Q\.fps < \(\(COARSE && i >= 2\) \? 40 : 28\) && i > 0/.test(src) && /Q\.lowWin >= 2\) \{ Q\.level = order\[i - 1\]; Q\.cap = i - 1;/.test(src), 'automatic downgrade is still there: two slow windows drop a level and cap it');
chk(/Q\.fps < \(\(COARSE && i >= 2\) \? 40 : 28\) && i > 0/.test(src), 'on touch devices at high or above the downgrade threshold is 40 fps, so a phone locked near 30 fps falls back to med; elsewhere it stays 28');
chk(/now - Q\.okSince >= 20000/.test(src) && !/now - Q\.okSince >= 60000/.test(src), 'climb back after 20 s of 55+ fps');
chk(/Math\.min\(3, window\.devicePixelRatio \|\| 1\); cv\.width = W \* dpr/.test(src), 'office map canvas uses up to 3x');
chk(/if \(Q\.level === 'ultra' && !ultraOk\(\)\) \{ Q\.level = 'high'; \}/.test(src), 'ultra still needs the ultraOk() check');
chk(/if \(COARSE\) \{ pr = Math\.min\(dpr, cfg\[2\]\); \}/.test(src), 'on phones the ratio never goes above the device own ratio');
if (bad.length) { console.error('FAIL ' + bad.length + ' of ' + n + ':\n- ' + bad.join('\n- ')); process.exit(1); }
console.log('sharp ok: ' + n + ' of ' + n + ' checks');
