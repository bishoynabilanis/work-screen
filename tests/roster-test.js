/* Idea 52 test. Run: node tests/roster-test.js   (ROSTER_BAD=1 node tests/roster-test.js must FAIL)
   Checks org.json: every worker the owner named has a card, and each card listens to the id that worker posts with; no id is used by two people; Yasser is a head; org.js shows "لسه ما بلّغش" when a worker never posted and "ساكت من N ساعة" after 2 hours without an update. */
var fs = require('fs'), path = require('path');
var d = path.join(__dirname, '..');
var org = JSON.parse(fs.readFileSync(path.join(d, 'org.json'), 'utf8'));
var js = fs.readFileSync(path.join(d, 'org.js'), 'utf8');
if (process.env.ROSTER_BAD) { org.levels.forEach(function (l) { (l.people || []).forEach(function (p) { if (p.name === 'ياسر') { p.live = ['x']; } }); }); js = js.replace("'ساكت من '", "''").replace('لسه ما بلّغش', 'مستني'); org.side.people.forEach(function (p) { p.live = p.live.filter(function (x) { return x !== 'ibrahim'; }); }); }
var all = [], n = 0, bad = [];
function chk(ok, t) { n++; if (!ok) { bad.push(t); } }
org.levels.forEach(function (l) { (l.people || []).forEach(function (p) { all.push(p); }); (l.groups || []).forEach(function (g) { g.people.forEach(function (p) { all.push(p); }); }); });
org.side.people.forEach(function (p) { all.push(p); });
var need = { ياسر: 'yasser', إبراهيم: 'ibrahim', ياسمين: 'yasmin', هاني: 'hany', كامل: 'kamel', محمود: 'mahmoud', رشا: 'rasha', كريم: 'karim', نهى: 'noha', طارق: 'tarek', سمر: 'samar', شهد: 'shahd', عادل: 'adel', مصطفى: 'mostafa', سيف: 'saif', عمر: 'omar', شريف: 'sherif', ماجد: 'majed', دينا: 'dina', وليد: 'walid', سلوى: 'salwa', ميوز: 'muse', 'وكيل الأفكار': 'ideas' };
Object.keys(need).forEach(function (nm) { var p = all.filter(function (x) { return x.name === nm; })[0]; chk(p && p.live.indexOf(need[nm]) >= 0, nm + ' has a card listening to ' + need[nm]); });
var tk = all.filter(function (x) { return x.live.indexOf('tiktok') >= 0; }); chk(tk.length === 1, 'TikTok id belongs to exactly one card');
var seen = {}, dup = [];
all.forEach(function (p) { p.live.forEach(function (i) { if (seen[i] && seen[i] !== p) { dup.push(i); } seen[i] = p; }); });
chk(dup.length === 0, 'no id shared by two people: ' + dup.join(','));
var heads = org.levels.filter(function (l) { return l.id === 'heads'; })[0].people.map(function (p) { return p.name; });
chk(heads[0] === 'ياسر', 'Yasser is first in the heads row');
chk(js.indexOf('لسه ما بلّغش') > 0 && js.indexOf("'ساكت من '") > 0 && js.indexOf('staleH >= 2') > 0, 'org.js has the never-reported label and the 2-hour stale label');
chk(js.indexOf('مستني') < 0, 'old "waiting" label for never-reported is gone');
if (bad.length) { console.error('FAIL ' + bad.length + ' of ' + n + ':\n- ' + bad.join('\n- ')); process.exit(1); }
console.log('roster ok: ' + n + ' of ' + n + ' checks');
