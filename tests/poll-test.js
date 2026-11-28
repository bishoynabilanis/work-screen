/* Idea 58 test. Run: node tests/poll-test.js   (POLL_BAD=1 node tests/poll-test.js must FAIL)
   Runs the POLL58 block from app.js with a fake clock. Checks: waits are 5 s with news, 10, 20, 30 s when quiet, 15, 30, 60 s after failures; news or a good answer after a failure resets; only one request at a time (the next wait starts after the answer); a kick (news, online, tab visible) runs at once and resets the wait, and a kick during a request causes exactly one follow-up, never two at once; nothing is scheduled while hidden and a visible kick resumes; a request that never answers is counted as a failure after 30 s and the loop goes on; a second done() is ignored. Also reads app.js and sw.js: the feed request sends If-None-Match, a 304 is accepted, a failed conditional request is retried without it, the old setInterval loops are gone, and the service worker lets a 304 through. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
var m = app.match(/\/\* POLL58-BEGIN[\s\S]*?POLL58-END \*\//); var bad = [], n = 0; function chk(ok, t) { n++; if (!ok) { bad.push(t); } }
chk(!!m, 'POLL58 block found'); if (!m) { console.error('FAIL: block not found'); process.exit(1); }
var code = m[0];
if (process.env.POLL_BAD) { code = code.replace('POLL_QUIET = [5000, 10000, 20000, 30000]', 'POLL_QUIET = [5000, 5000, 5000, 5000]').replace('if (busy) { again = true; return; } go();', 'go();').replace('if (busy || hid()) { return; }', 'if (hid()) { return; }').replace('POLL_WATCHDOG_MS = 30000', 'POLL_WATCHDOG_MS = 3000000'); app = app.replace('ctl.abort()', 'void 0').replace('If-None-Match', 'X-None').replace("res.status === 304", 'false'); sw = sw.replace('response.status !== 304', 'false'); }
var now = 0, q = [], seq = 0, hidden = false;
function setT(f, ms) { var id = ++seq; q.push({ id: id, at: now + ms, f: f }); return id; } function clrT(id) { q = q.filter(function (t) { return t.id !== id; }); }
function advance(ms) { var end = now + ms; for (;;) { q.sort(function (a, b) { return a.at - b.at; }); var t = q[0]; if (!t || t.at > end) { break; } q.shift(); now = t.at; t.f(); } now = end; }
var calls = [], pending = [], mode = 'quiet';
var ctx = { window: { setTimeout: setT, clearTimeout: clrT }, document: { get hidden() { return hidden; } }, refresh: function (d) { calls.push({ k: 'feed', t: now }); pending.push(d); if (mode !== 'hang') { var o = mode; mode = o; d(o); } }, pollStatus: function () {} };
vm.createContext(ctx); vm.runInContext(code + '\nthis.P = makePoller; this.E = POLL_ENV; this.D = pollDelay;', ctx);
var D = ctx.D; chk([0, 1, 2, 3, 9].map(function (i) { return D(i, 0); }).join() === '5000,10000,20000,30000,30000', 'quiet waits are 5, 10, 20, 30, 30 s');
chk([1, 2, 3, 8].map(function (i) { return D(0, i); }).join() === '15000,30000,60000,60000', 'failure waits are 15, 30, 60, 60 s');
// a run driven by a script of outcomes
function mk(outcomes) { var log = [], i = 0, p = ctx.P(function (done) { log.push(now); var o = outcomes[Math.min(i++, outcomes.length - 1)]; if (o !== 'hang') { done(o); } else { log.hang = done; } }, ctx.E); p.log = log; return p; }
var p = mk(['news', 'quiet', 'quiet', 'quiet', 'quiet']); p.start(); chk(p.log.length === 1 && p.log[0] === 0, 'start runs at once');
advance(4999); chk(p.log.length === 1, 'nothing before 5 s after news'); advance(1); chk(p.log.length === 2, 'second run at 5 s');
advance(9999); chk(p.log.length === 2, 'quiet: not before 10 s'); advance(1); chk(p.log.length === 3, 'quiet: third run at +10 s');
advance(20000); chk(p.log.length === 4, 'quiet: fourth run at +20 s'); advance(30000); chk(p.log.length === 5, 'quiet: fifth run at +30 s'); advance(29999); chk(p.log.length === 5, 'quiet stays at 30 s, not shorter');
var pf = mk(['fail', 'fail', 'fail', 'fail', 'news', 'quiet']); q = []; now = 0; pf.start(); advance(14999); chk(pf.log.length === 1, 'fail: not before 15 s'); advance(1); chk(pf.log.length === 2, 'fail: 15 s'); advance(30000); chk(pf.log.length === 3, 'fail: 30 s'); advance(60000); chk(pf.log.length === 4, 'fail: 60 s'); advance(59999); chk(pf.log.length === 4, 'fail: stays 60 s'); advance(1); chk(pf.log.length === 5, 'fail: fifth run'); advance(5000); chk(pf.log.length === 6, 'news after failures goes back to 5 s');
// kick resets at once
q = []; now = 0; var pk = mk(['quiet']); pk.start(); advance(5000); advance(10000); advance(5000); var before = pk.log.length; pk.kick(); chk(pk.log.length === before + 1, 'kick runs at once'); advance(9999); chk(pk.log.length === before + 1, 'after a kick and a quiet answer the wait is 10 s, not the long one'); advance(1); chk(pk.log.length === before + 2, 'then it goes on');
// one at a time
q = []; now = 0; var ph = mk(['hang', 'quiet']); ph.start(); chk(ph.log.length === 1 && ph.state().busy, 'request in flight'); advance(20000); chk(ph.log.length === 1, 'no second request while the first has not answered'); ph.kick(); chk(ph.log.length === 1, 'a kick during a request does not start a second one');
var hd = ph.log.hang; hd('quiet'); chk(ph.log.length === 2, 'after the answer, exactly one follow-up runs'); hd('news'); chk(ph.log.length === 2, 'a second done() is ignored');
// watchdog
q = []; now = 0; var pw = mk(['hang', 'quiet']); pw.start(); advance(29999); chk(pw.log.length === 1 && pw.state().busy, 'still waiting before 30 s'); advance(1); chk(pw.state().fail === 1 && !pw.state().busy, 'a request with no answer after 30 s counts as a failure'); advance(15000); chk(pw.log.length === 2, 'the loop goes on after the watchdog');
// hidden
q = []; now = 0; hidden = false; var px = mk(['quiet']); px.start(); hidden = true; advance(60000); chk(px.log.length === 1, 'hidden: nothing runs'); chk(q.length === 0, 'hidden: no timer left'); hidden = false; px.kick(); chk(px.log.length === 2, 'visible again: runs at once');
hidden = true; q = []; now = 0; var py = mk(['quiet']); py.start(); chk(py.log.length === 0, 'start while hidden does nothing'); hidden = false;
// source checks
chk(!/setInterval\(refresh|setInterval\(pollStatus|setInterval\(\s*function\s*\(\)\s*\{\s*refresh/.test(app), 'the old setInterval loops for the feed and the status line are gone');
chk(!/setInterval/.test(code), 'no setInterval in the poll block');
chk(/h\['If-None-Match'\] = feedEtag/.test(app) && /res\.status === 304/.test(app), 'the feed request sends If-None-Match and accepts a 304');
chk(/if \(cond\) \{ feedEtag = ''; return get\(false\); \}/.test(app), 'a failed conditional request is retried without it (old service worker case)');
chk(/ctl\.abort\(\)\s*\}, 25000\)/.test(app) && /signal: ctl \? ctl\.signal/.test(app), 'the status request is aborted after 25 s (before the 30 s watchdog), so a hung request cannot overlap the next one');
chk(/response\.status !== 304/.test(sw), 'the service worker lets a 304 through');
chk(/online[\s\S]{0,80}kickAll\(\)|updateOffline\(\);\s*kickAll\(\);/.test(app) && /document\.hidden\) \{\s*kickAll\(\)/.test(app), 'going online and the tab becoming visible reset both polls');
if (bad.length) { console.error('FAIL ' + bad.length + ' of ' + n + ':\n- ' + bad.join('\n- ')); process.exit(1); }
console.log('poll ok: ' + n + ' of ' + n + ' checks');
