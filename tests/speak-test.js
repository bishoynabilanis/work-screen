/* Idea 47 test. Run: node tests/speak-test.js   (SPEAK_BAD=1 node tests/speak-test.js must FAIL: deliberate-failure check)
   Runs the IDEA46 and IDEA47 blocks from app.js with a fake speechSynthesis and a secret job name. Checks: spoken text is numbers and fixed words only, voice choice ar-EG then ar-SA, auto-read only when switched on and only on a NEW alert, with a 2 minute pause. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
var m6 = app.match(/\/\* IDEA46-BEGIN[\s\S]*?IDEA46-END \*\//), m7 = app.match(/\/\* IDEA47-BEGIN[\s\S]*?IDEA47-END \*\//);
if (!m6 || !m7) { console.error('FAIL: IDEA46/IDEA47 block not found in app.js'); process.exit(1); }
var code7 = m7[0];
if (process.env.SPEAK_BAD) { code7 = code7.replace("var t = 'ملخص الشغل. '", "var t = 'ملخص الشغل ' + (typeof SECRET_JOB === 'string' ? SECRET_JOB : '') + '. '"); }
var bad = [], spoken = [], store = {}, voices = [];
var NOW = new Date(2026, 10, 28, 15, 0, 0).getTime();
var ctx = {
  Date: Date, Math: Math, SECRET_JOB: 'اسم شغلانة سري ٩٩',
  document: { getElementById: function () { return null; } },
  localStorage: { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } }
};
ctx.window = ctx; ctx.speechSynthesis = { getVoices: function () { return voices; }, cancel: function () {}, speak: function (u) { spoken.push(u); } };
ctx.SpeechSynthesisUtterance = function (t) { this.text = t; };
ctx.baseFeed = { staff: [{ id: 'a', dept: 'content' }, { id: 'b', dept: 'qa' }] };
ctx.deptOf = function (id) { var s = ctx.baseFeed.staff.filter(function (p) { return p.id === id; })[0]; return s ? s.dept : 'all'; };
ctx.statusLines = [{ id: 'a', state: 'done', ms: NOW - 3600000, job: 'اسم شغلانة سري ٩٩', text: 'نص سري' }, { id: 'b', state: 'done', ms: NOW - 7200000, job: 'اسم شغلانة سري ٩٩' }];
vm.createContext(ctx);
vm.runInContext(m6[0] + '\n' + code7 + '\nthis.__api = { speakText: speakText, speakLang: speakLang, speakNow: speakNow, speakAlertCheck: speakAlertCheck, mixCounts: mixCounts, setSum: function (s) { lastSum = s; }, setAt: function (t) { speakAt = t; } };', ctx);
var api = ctx.__api;
var mix = api.mixCounts(NOW);
var text = api.speakText({ working: 2, done: 3, late: 1, stuck: 1 }, mix);
if (/سري|اسم شغلانة|نص سري/.test(text)) { bad.push('spoken text contains a job name or free text: ' + text); }
if (/[\u0660-\u0669]/.test(text)) { bad.push('spoken text has Arabic-Indic digits: ' + text); }
if (text.indexOf('2 شغالين') < 0 || text.indexOf('3 خلصوا') < 0 || text.indexOf('1 ممكن يتأخروا') < 0 || text.indexOf('محتوى 1') < 0) { bad.push('spoken text missing fixed counts: ' + text); }
var l = api.speakLang(); if (l.lang !== 'ar-SA' || l.voice) { bad.push('no voices should give ar-SA and no voice object'); }
voices = [{ lang: 'ar_SA', name: 'S' }, { lang: 'ar-EG', name: 'E' }]; l = api.speakLang(); if (l.lang !== 'ar-EG') { bad.push('ar-EG voice should win, got ' + l.lang); }
voices = [{ lang: 'ar_SA', name: 'S' }]; l = api.speakLang(); if (l.lang !== 'ar-SA' || !l.voice) { bad.push('ar-SA fallback voice expected'); }
api.setSum({ working: 1, done: 1, late: 0, stuck: 0 });
api.speakNow(); if (spoken.length !== 1 || spoken[0].lang !== 'ar-SA') { bad.push('speak should be called once with ar-SA'); }
store.ws_speak_auto = '0'; api.setAt(0);
api.speakAlertCheck({ late: 0, stuck: 0 }, NOW);
if (api.speakAlertCheck({ late: 1, stuck: 0 }, NOW)) { bad.push('auto read must stay silent when switched off'); }
store.ws_speak_auto = '1';
if (!api.speakAlertCheck({ late: 2, stuck: 0 }, NOW)) { bad.push('auto read should fire on a new late alert when switched on'); }
if (api.speakAlertCheck({ late: 2, stuck: 0 }, NOW + 1000)) { bad.push('same alert must not read twice'); }
api.setAt(NOW);
if (api.speakAlertCheck({ late: 2, stuck: 1 }, NOW + 60000)) { bad.push('must wait 2 minutes between auto reads'); }
if (!api.speakAlertCheck({ late: 2, stuck: 2 }, NOW + 130000)) { bad.push('after 2 minutes a new alert should read'); }
if (bad.length) { console.error('SPEAK TEST FAILED:\n' + bad.join('\n')); process.exit(1); }
console.log('speak test ok: numbers and fixed words only, ar-EG then ar-SA, auto read only on new alert');
