/* Idea 39: theme toggle. Saved locally (localStorage), no network. Alt+T cycles. */
(function () {
  var KEY = 'ws-theme', ORDER = ['blue', 'gold', 'light'];
  var NAMES = { blue: 'أزرق مستقبلي', gold: 'ذهبي دافي', light: 'فاتح هادي' };
  function get() { try { var v = localStorage.getItem(KEY); return ORDER.indexOf(v) >= 0 ? v : 'blue'; } catch (e) { return 'blue'; } }
  function apply(t) {
    if (t === 'blue') { document.documentElement.removeAttribute('data-theme'); } else { document.documentElement.setAttribute('data-theme', t); }
    var b = document.getElementById('ws-theme-btn');
    if (b) { b.textContent = 'الثيم: ' + NAMES[t]; b.setAttribute('aria-label', 'تغيير الثيم. الحالي: ' + NAMES[t]); }
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) { m.setAttribute('content', { blue: '#070d18', gold: '#130d06', light: '#f8f2e7' }[t]); }
  }
  function next() {
    var t = ORDER[(ORDER.indexOf(get()) + 1) % ORDER.length];
    try { localStorage.setItem(KEY, t); } catch (e) {}
    apply(t);
  }
  apply(get());
  document.addEventListener('DOMContentLoaded', function () {
    var host = document.querySelector('.topbar-inner');
    if (host && !document.getElementById('ws-theme-btn')) {
      var b = document.createElement('button');
      b.type = 'button'; b.id = 'ws-theme-btn'; b.addEventListener('click', next); host.appendChild(b);
    }
    apply(get());
  });
  document.addEventListener('keydown', function (e) { if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 't' || e.key === 'T')) { e.preventDefault(); next(); } });
  window.__wsTheme = { get: get, set: function (t) { if (ORDER.indexOf(t) >= 0) { try { localStorage.setItem(KEY, t); } catch (e) {} apply(t); } } };
})();
