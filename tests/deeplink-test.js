/* Idea 50 test. Run: node tests/deeplink-test.js   (DL_BAD=1 node tests/deeplink-test.js must FAIL: deliberate-failure check)
   Runs the IDEA50 block from app.js with a fake window and document. Checks: only whitelisted focus/theme/view values are read; unknown values, unknown keys, markup, script URLs, long strings, case tricks and repeated keys are ignored; the address-bar link is rebuilt only from whitelisted values; the copy button puts the current link on the clipboard and falls back when the clipboard is missing; no network, storage or tracking in the block. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
var m = app.match(/\/\* IDEA50-BEGIN[\s\S]*?IDEA50-END \*\//);
if (!m) { console.error('FAIL: IDEA50 block not found in app.js'); process.exit(1); }
var bad = [], n = 0;
function chk(ok, t) { n++; if (!ok) { bad.push(t); } }
chk(!/fetch\(|XMLHttpRequest|sendBeacon|https?:\/\/|localStorage|sessionStorage|cookie|innerHTML|eval\(|document\.write/.test(m[0]), 'deep-link block must have no network, storage, tracking, innerHTML or eval');
function el(tag) { var e = { tag: tag, children: [], attrs: {}, listeners: {}, style: {}, textContent: '', remove: function () {}, appendChild: function (c) { e.children.push(c); return c; },
  setAttribute: function (k, v) { e.attrs[k] = v; }, getAttribute: function (k) { return e.attrs[k]; }, addEventListener: function (t, f) { e.listeners[t] = f; },
  focus: function () {}, select: function () {}, setSelectionRange: function () {}, removeAttribute: function (k) { delete e.attrs[k]; }, click: function () { if (e.listeners.click) { e.listeners.click(); } } }; return e; }
function world(search, opts) {
  opts = opts || {};
  var calls = { replace: [], themeSet: [], focus: [], copied: [], exec: 0, timers: [] }, elems = {}, dcl = [];
  var host = el('div'), list = el('details'); list.open = true; elems.listView = list;
  var doc = { body: el('body'), createElement: el, getElementById: function (id) { return elems[id] || null; },
    querySelector: function (q) { return q === '.topbar-inner' ? host : null; }, addEventListener: function (t, f) { if (t === 'DOMContentLoaded') { dcl.push(f); } },
    execCommand: function () { calls.exec++; return !opts.noFallbackOk; } };
  var w = { __WSDL_BAD: !!process.env.DL_BAD, URLSearchParams: URLSearchParams, location: { search: search, pathname: '/work-screen/', origin: 'https://example.test', hash: '' },
    history: { replaceState: function (a, b, u) { calls.replace.push(u); } },
    __wsTheme: { get: function () { return opts.theme || 'blue'; }, set: function (t) { calls.themeSet.push(t); if (w.__dlNote) { w.__dlNote('theme', t); } } },
    __o3Focus: function (id) { calls.focus.push(id); return true; } };
  var nav = opts.noClip ? {} : { clipboard: { writeText: function (t) { calls.copied.push(t); return Promise.resolve(); } } };
  var ctx = { window: w, document: doc, navigator: nav, URLSearchParams: URLSearchParams, Promise: Promise, Object: Object, Array: Array, Date: Date, setTimeout: function (f) { calls.timers.push(f); return calls.timers.length; }, clearTimeout: function () {},
    setInterval: function (f) { f(); return 1; }, clearInterval: function () {} };
  w.setTimeout = ctx.setTimeout; w.setInterval = ctx.setInterval; w.clearInterval = ctx.clearInterval;
  vm.createContext(ctx); vm.runInContext(m[0], ctx);
  dcl.forEach(function (f) { f(); });
  return { w: w, calls: calls, host: host, list: list, elems: elems };
}
var P = world('').w.__dl.parse, B = world('').w.__dl.build;
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
chk(eq(P('?focus=trend&theme=gold&view=list'), { focus: 'trend', theme: 'gold', view: 'list' }), 'valid values should all be read');
chk(eq(P('?focus=all'), { focus: 'all' }) && eq(P('?focus=manager'), { focus: 'manager' }), 'all and manager focus should work');
chk(eq(P('?focus=nobody&theme=pink&view=3d'), {}), 'unknown values must be ignored');
chk(eq(P('?focus=<script>alert(1)</script>&theme=javascript:alert(1)&view="><img src=x onerror=1>'), {}), 'markup and script text must be ignored');
chk(eq(P('?focus=TREND&theme=Gold&view=LIST'), {}), 'case tricks must be ignored');
chk(eq(P('?focus=trend%00&theme=gold%20&view=list%0a'), {}), 'null bytes and spaces must be ignored');
chk(eq(P('?focus=' + 'a'.repeat(5000)), {}), 'very long values must be ignored');
chk(eq(P('?focus=__proto__&theme=constructor&view=toString'), {}), 'prototype names must be ignored');
chk(eq(P('?foo=bar&focus=qa'), { focus: 'qa' }), 'unknown keys must be dropped but valid ones kept');
chk(eq(P('?focus=nobody&focus=trend'), {}), 'only the first repeated key counts, and it is invalid');
chk(eq(P('?focus=trend&focus=<b>'), { focus: 'trend' }), 'first valid repeated key is kept, later ones ignored');
chk(B({ focus: 'trend', theme: 'gold', view: 'org' }) === '?focus=trend&theme=gold&view=org', 'link must be built from valid values in a fixed order');
chk(B({ focus: '<x>', theme: 'blue' }) === '?theme=blue', 'invalid values must never reach the link');
chk(B({}) === '' && B(null) === '', 'empty state gives an empty query');
var dept = ['content', 'trend', 'video', 'jessica', 'seo', 'tools', 'mail', 'qa'];
chk(dept.every(function (d) { return P('?focus=' + d).focus === d; }), 'every department id should be allowed');
var w1 = world('?focus=video&theme=light&view=office');
chk(w1.calls.themeSet[0] === 'light', 'theme from the link should be applied');
chk(w1.calls.focus[0] === 'video', 'focus from the link should be applied once the 3D scene is ready');
chk(w1.list.open === false, 'view=office should close the list');
var w1b = world('?focus=video&theme=light&view=office');
chk(w1b.calls.themeSet[0] === 'light' && w1b.calls.replace.length >= 1 && w1b.calls.replace.every(function (u) { return u === '/work-screen/?focus=video&theme=light&view=office'; }), 'applying a link must not drop its other values from the address bar');
var w2 = world('?focus=bad&theme=bad&view=bad');
chk(w2.calls.themeSet.length === 0 && w2.calls.focus.length === 0 && w2.list.open === true, 'invalid link must change nothing');
var w3 = world('?view=list'); w3.w.__dlNote('focus', 'trend'); w3.w.__dlNote('theme', 'gold');
chk(w3.calls.replace[w3.calls.replace.length - 1] === '/work-screen/?focus=trend&theme=gold&view=list', 'address bar should follow the state through replaceState');
w3.w.__dlNote('focus', '<bad>'); chk(w3.calls.replace.length === 2, 'invalid change must not touch the address bar');
var w4 = world('', { theme: 'gold' }); var btn = w4.host.children[0], msg = w4.host.children[1];
chk(btn && btn.id === 'ws-link-btn' && btn.textContent === 'انسخ لينك العرض', 'copy button text');
btn.click();
chk(w4.calls.copied[0] === 'https://example.test/work-screen/?theme=gold&view=list', 'copied link should hold the current theme and view');
var w5 = world('?focus=qa&view=org'); w5.host.children[0].click();
chk(w5.calls.copied[0] === 'https://example.test/work-screen/?focus=qa&theme=blue&view=org', 'copied link should keep focus and view from the opened link');
var w6 = world('', { noClip: true }); w6.host.children[0].click();
chk(w6.calls.exec === 1, 'fallback copy should run when the clipboard is missing');
var w7 = world('', { noClip: true, noFallbackOk: true }); w7.host.children[0].click();
chk(w7.host.children[1].textContent.indexOf('مقدرتش') === 0, 'a failed copy should say so');
var w8 = world('', { noClip: true, noFallbackOk: true }); w8.host.children[0].click();
chk(w8.host.children[1].attrs['data-ok'] === '0', 'failed copy marks the message');
w8.calls.timers.forEach(function (f) { f(); });
chk(w8.host.children[1].textContent === '' && w8.host.children[1].attrs['data-ok'] === undefined, 'after 3 seconds the message text AND its data-ok mark are both gone (no lone "!" left)');
if (bad.length) { console.error('FAIL ' + bad.length + ' of ' + n + ':\n- ' + bad.join('\n- ')); process.exit(1); }
console.log('OK ' + n + '/' + n);
