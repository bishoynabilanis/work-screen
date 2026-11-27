/* Build guard (rule 122/123). Run: node tests/guard-free-text.js
   Fails if free text is switched on in app.js, or if feed.json carries free-text fields. */
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..');
var app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
var bad = [];
if (/FREE_TEXT_OK\s*=\s*true/.test(app)) { bad.push('FREE_TEXT_OK is switched on in app.js'); }
if (!/var FREE_TEXT_OK = false;/.test(app)) { bad.push('FREE_TEXT_OK default line is missing from app.js'); }
var feed = JSON.parse(fs.readFileSync(path.join(root, 'feed.json'), 'utf8'));
var banned = ['text', 'step', 'last', 'doing', 'next', 'msg', 'ask', 'options'];
(feed.staff || []).forEach(function (s) { banned.forEach(function (k) { if (k in s) { bad.push('feed.json staff ' + s.id + ' has field ' + k); } }); });
banned.forEach(function (k) { if (feed.assistant && k in feed.assistant) { bad.push('feed.json assistant has field ' + k); } });
var sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
if (/SHELL\s*=\s*\[[^\]]*feed\.json/.test(sw)) { bad.push('sw.js pre-caches feed.json'); }
if (/cache\.put\(key, copy\)/.test(sw)) { bad.push('sw.js stores feed.json responses'); }
if (bad.length) { console.error('GUARD FAILED:\n' + bad.join('\n')); process.exit(1); }
console.log('guard ok: free text off, feed.json clean, service worker does not store feed.json');
