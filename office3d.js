/* 3D office scene (three.js). Plain-language statuses only. Data comes from app.js via Office3D.update(feed). */
(function () {
  'use strict';
  var host = document.getElementById('office3d');
  if (!host) { return; }
  function plainFallback(msg) {
    host.classList.remove('o3-active'); document.documentElement.classList.remove('o3-on');
    host.classList.add('o3-failed');
    var lv = document.getElementById('listView'); if (lv) { lv.open = true; }
    var h = host.querySelector('.o3-hint'); if (h) { h.hidden = false; h.textContent = msg; }
  }
  if (typeof THREE === 'undefined') { plainFallback('المشهد ثلاثي الأبعاد مش متاح دلوقتي، عرضنا القائمة بدله.'); return; }

  var CELL = 2.4, ROW = 3.0;
  var BLOCKS = {
    content: { x: 0, z: 0, cols: 3 },
    trend: { x: 9.6, z: 0, cols: 3 },
    video: { x: 19.2, z: 0, cols: 3 },
    jessica: { x: 0, z: 8, cols: 3 },
    seo: { x: 9.6, z: 8, cols: 3 },
    tools: { x: 19.2, z: 8, cols: 3 },
    mail: { x: 0, z: 16, cols: 3 },
    qa: { x: 9.6, z: 16, cols: 5 }
  };
  var ACCENT = { content: 0xf4511e, trend: 0x8e6bd8, video: 0xe0508b, jessica: 0x2bb0a0, seo: 0xe8a53a, tools: 0x4a8fe8, mail: 0x55b36a, qa: 0x35c6b4, mgr: 0xf4511e };
  var STATE_COLOR = { running: 0x3aa0ff, waiting: 0xf6c453, done: 0x4ade80, blocked: 0xf87171, unknown: 0x9aa0aa };
  var SHIRTS = [0x3b5b7a, 0x6b3f4f, 0x2f6b5b, 0x7a5a2f, 0x4b4a7a, 0x7d828c, 0xa3472f, 0x2e3a4b, 0x556b3a, 0x8a4b6b];
  var SKINS = [0xe3b08a, 0xd29a72, 0xc58b62, 0xedc29d, 0xb97d57];
  var HAIRS = [0x1c1a19, 0x2a1d16, 0x3a2a20, 0x161616, 0x4a3526];

  function hashStr(s) { var h = 7; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) % 100003; } return h; }

  var canvasWrap = host.querySelector('.o3-canvas');
  var labelLayer = host.querySelector('.o3-labels');
  var chipsEl = host.querySelector('.o3-chips');
  var hint = host.querySelector('.o3-hint');

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch (e) { plainFallback('المشهد ثلاثي الأبعاد مش شغال على جهازك، عرضنا القائمة بدله.'); return; }
  host.classList.add('o3-active'); document.documentElement.classList.add('o3-on');
  function setHH() { var hd = document.querySelector('header'); document.documentElement.style.setProperty('--hh', (hd ? hd.offsetHeight : 64) + 'px'); }
  setHH(); window.addEventListener('resize', setHH);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xdfeaf5, 1);
  canvasWrap.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xdfeaf5, 60, 120);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c4d0, 0.95));
  var sun = new THREE.DirectionalLight(0xfff3dc, 0.75);
  sun.position.set(-10, 24, 14);
  scene.add(sun);

  var camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  var target = new THREE.Vector3(12.5, 0, 9);
  var zoom = 1;
  var desiredTarget = target.clone();
  var desiredZoom = 1;
  var baseSpan = 30;

  function placeCamera() {
    var w = canvasWrap.clientWidth || 360, h = canvasWrap.clientHeight || 520;
    var aspect = w / h;
    var span = baseSpan / zoom;
    camera.left = -span * aspect / 2; camera.right = span * aspect / 2;
    camera.top = span / 2; camera.bottom = -span / 2;
    camera.position.set(target.x + 24, target.y + 22, target.z + 24);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }

  function resize() {
    var w = canvasWrap.clientWidth || 360, h = canvasWrap.clientHeight || 520;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    var aspect = w / h;
    baseSpan = Math.max(34, 44 / aspect);
    placeCamera();
  }

  // ---------- environment ----------
  function mat(color, extra) { var m = new THREE.MeshLambertMaterial({ color: color }); if (extra) { Object.assign(m, extra); } return m; }
  function box(w, h, d, color) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); return m; }

  var floor = new THREE.Mesh(new THREE.BoxGeometry(34, 0.4, 32), mat(0xf4f1ea));
  floor.position.set(11.5, -0.2, 8.5);
  scene.add(floor);
  var carpet = new THREE.Mesh(new THREE.BoxGeometry(33, 0.05, 31), mat(0xe9e5dc));
  carpet.position.set(11.5, 0.01, 8.5);
  scene.add(carpet);

  // back walls with windows
  function wallWithWindows(len, axis) {
    var g = new THREE.Group();
    var wall = box(len, 5.2, 0.4, 0xf8f8f6);
    g.add(wall);
    var n = Math.floor(len / 4.2);
    for (var i = 0; i < n; i++) {
      var win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.2), new THREE.MeshBasicMaterial({ color: 0xbfe3ff }));
      win.position.set(-len / 2 + 2.4 + i * 4.2, 0.2, 0.22);
      g.add(win);
      var frame = box(2.8, 3.4, 0.08, 0xffffff);
      frame.position.set(win.position.x, 0.2, 0.17);
      g.add(frame);
      var bar = box(0.07, 3.2, 0.1, 0xffffff); bar.position.set(win.position.x, 0.2, 0.24); g.add(bar);
      var bar2 = box(2.6, 0.07, 0.1, 0xffffff); bar2.position.set(win.position.x, 0.2, 0.24); g.add(bar2);
    }
    return g;
  }
  var wallBack = wallWithWindows(34, 'x');
  wallBack.position.set(11.5, 2.6, -7.3);
  scene.add(wallBack);
  var wallLeft = wallWithWindows(32, 'z');
  wallLeft.rotation.y = Math.PI / 2;
  wallLeft.position.set(-5.6, 2.6, 8.5);
  scene.add(wallLeft);

  function plant(x, z) {
    var g = new THREE.Group();
    var pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.45, 8), mat(0xb0643c)); pot.position.y = 0.22; g.add(pot);
    for (var i = 0; i < 4; i++) {
      var leaf = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 5), mat(i % 2 ? 0x3f8f4f : 0x57a863));
      leaf.position.set(Math.cos(i * 1.6) * 0.18, 0.7 + i * 0.12, Math.sin(i * 1.6) * 0.18); g.add(leaf);
    }
    g.position.set(x, 0, z); scene.add(g);
  }

  // zone floors + partitions
  var zoneInfo = {};
  function buildZone(id, count, name) {
    var b = BLOCKS[id]; if (!b) { return; }
    var cols = b.cols, rows = Math.ceil(count / cols);
    var w = cols * CELL + 0.8, d = rows * ROW + 0.6;
    var cx = b.x + (cols - 1) * CELL / 2, cz = b.z - 1.0 + (rows * ROW - 0.4) / 2 - 0.1;
    var tile = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), mat(ACCENT[id] || 0xcccccc));
    tile.material.transparent = true; tile.material.opacity = 0.22;
    tile.position.set(cx, 0.04, cz);
    scene.add(tile);
    var edge = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.12), mat(ACCENT[id] || 0xcccccc));
    edge.position.set(cx, 0.06, cz + d / 2); scene.add(edge);
    var edge2 = edge.clone(); edge2.position.set(cx, 0.06, cz - d / 2); scene.add(edge2);
    zoneInfo[id] = { cx: cx, cz: cz, w: w, d: d, name: name };
    var zl = document.createElement('button');
    zl.type = 'button'; zl.className = 'o3-zone'; zl.textContent = String(name).replace(/^قسم /, '');
    zl.style.borderColor = '#' + ('000000' + (ACCENT[id] || 0xcccccc).toString(16)).slice(-6);
    zl.addEventListener('click', function () { flyTo(new THREE.Vector3(cx, 0, cz), id === 'qa' ? 1.7 : 2.4); });
    labelLayer.appendChild(zl);
    zoneInfo[id].el = zl;
    plant(b.x - 1.35, b.z + rows * ROW - 1.8);
  }

  // ---------- people ----------
  var people = {}; // id -> {id, group, deskPos, chairPos, parts, state, label, ...}
  var texLoader = new THREE.TextureLoader();
  texLoader.setCrossOrigin('anonymous');

  function makeLabel(p) {
    var el = document.createElement('div');
    el.className = 'o3-label';
    var n = document.createElement('b'); var r = document.createElement('span');
    el.appendChild(n); el.appendChild(r);
    el.__n = n; el.__r = r;
    labelLayer.appendChild(el);
    return el;
  }

  function buildPerson(id) {
    var h = hashStr(id);
    var shirt = SHIRTS[h % SHIRTS.length], skin = SKINS[hashStr(id + 'k') % SKINS.length], hair = HAIRS[hashStr(id + 'h') % HAIRS.length];
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.8, 10), mat(shirt)); body.position.y = 0.95; g.add(body);
    var armL = new THREE.Group(), armR = new THREE.Group();
    [armL, armR].forEach(function (a, i) {
      var up = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.55, 6), mat(shirt));
      up.position.y = -0.27; a.add(up);
      var hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), mat(skin)); hand.position.y = -0.57; a.add(hand);
      a.position.set(i ? 0.42 : -0.42, 1.25, 0); g.add(a);
    });
    var legL = new THREE.Group(), legR = new THREE.Group();
    [legL, legR].forEach(function (l, i) {
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.6, 6), mat(0x2b3140)); leg.position.y = -0.3; l.add(leg);
      var shoe = box(0.2, 0.1, 0.3, 0x15161a); shoe.position.set(0, -0.62, 0.05); l.add(shoe);
      l.position.set(i ? 0.16 : -0.16, 0.6, 0); g.add(l);
    });
    var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 6), mat(skin)); neck.position.y = 1.4; g.add(neck);
    var headGroup = new THREE.Group(); headGroup.position.y = 1.78; g.add(headGroup);
    var sph = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), mat(skin)); headGroup.add(sph);
    var cap = new THREE.Mesh(new THREE.SphereGeometry(0.335, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(hair)); cap.position.y = 0.02; headGroup.add(cap);
    var disc = null;
    var parts = { body: body, armL: armL, armR: armR, legL: legL, legR: legR, head: headGroup, sph: sph, cap: cap };
    texLoader.load('faces/' + id + '.jpg', function (tex) {
      var m = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      disc = m;
      headGroup.add(m);
      sph.visible = false; cap.visible = false;
      parts.disc = m;
    }, undefined, function () { /* keep the plain head */ });
    return { group: g, parts: parts };
  }

  function buildDesk(color) {
    var d = new THREE.Group();
    var top = box(1.7, 0.1, 0.95, 0xffffff); top.position.y = 0.78; d.add(top);
    var side1 = box(0.08, 0.76, 0.9, 0xe9ecef); side1.position.set(-0.8, 0.38, 0); d.add(side1);
    var side2 = box(0.08, 0.76, 0.9, 0xe9ecef); side2.position.set(0.8, 0.38, 0); d.add(side2);
    var mon = box(0.78, 0.5, 0.05, 0x1b1e24); mon.position.set(0, 1.12, 0.05); d.add(mon);
    var scr = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.42), new THREE.MeshBasicMaterial({ color: 0x3aa0ff, side: THREE.DoubleSide }));
    scr.position.set(0, 1.12, 0.08); d.add(scr);
    var scr2 = scr.clone(); scr2.position.z = 0.02; scr2.rotation.y = Math.PI; d.add(scr2);
    var stand = box(0.08, 0.28, 0.08, 0x2a2d33); stand.position.set(0, 0.93, 0.05); d.add(stand);
    var kb = box(0.55, 0.03, 0.2, 0xdadde2); kb.position.set(0, 0.85, 0.3); d.add(kb);
    var mug = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8), mat(0xf4511e)); mug.position.set(0.65, 0.89, 0.2); d.add(mug);
    return { group: d, screens: [scr, scr2], monitor: mon };
  }

  function buildChair() {
    var c = new THREE.Group();
    var seat = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 10), mat(0x2a2d35)); seat.position.y = 0.5; c.add(seat);
    var back = box(0.62, 0.62, 0.1, 0x2a2d35); back.position.set(0, 0.92, -0.32); c.add(back);
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), mat(0x555a66)); stem.position.y = 0.25; c.add(stem);
    var base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 8), mat(0x3a3e48)); base.position.y = 0.03; c.add(base);
    return c;
  }

  var pickables = [];

  function slotFor(deptId, idx) {
    var b = BLOCKS[deptId]; if (!b) { return null; }
    var r = Math.floor(idx / b.cols), c = idx % b.cols;
    return { x: b.x + c * CELL, z: b.z + r * ROW };
  }

  function makePersonAt(id, pos, deptId, isMgr) {
    var d = buildDesk();
    d.group.position.set(pos.x, 0, pos.z);
    scene.add(d.group);
    var chair = buildChair();
    chair.position.set(pos.x, 0, pos.z - 0.95);
    scene.add(chair);
    var p = buildPerson(id);
    var seat = new THREE.Vector3(pos.x, 0.12, pos.z - 0.95);
    p.group.position.copy(seat);
    p.group.position.y = 0.0;
    scene.add(p.group);
    p.group.scale.setScalar(1);
    // stand/sit: lift body to seat, tuck legs
    var ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(pos.x, 0.09, pos.z - 0.95); scene.add(ring);
    var rec = {
      id: id, dept: deptId, desk: d, chair: chair, person: p, ring: ring, seat: seat, front: new THREE.Vector3(pos.x, 0, pos.z + 0.95),
      state: 'unknown', label: makeLabel(), away: false, time: Math.random() * 6, nameText: '', roleText: ''
    };
    // hit area
    var hit = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.8, 2.4), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(pos.x, 1.3, pos.z - 0.4); hit.userData.id = id; scene.add(hit); pickables.push(hit);
    rec.hit = hit;
    sitPose(rec);
    people[id] = rec;
    return rec;
  }

  function sitPose(rec) {
    var pa = rec.person.parts;
    pa.body.position.y = 0.95 - 0.12; pa.legL.rotation.x = -1.35; pa.legR.rotation.x = -1.35;
    pa.legL.position.set(-0.16, 0.5, 0.1); pa.legR.position.set(0.16, 0.5, 0.1);
    pa.armL.rotation.x = -0.9; pa.armR.rotation.x = -0.9;
  }
  function standPose(rec) {
    var pa = rec.person.parts;
    pa.body.position.y = 0.95; pa.legL.rotation.x = 0; pa.legR.rotation.x = 0;
    pa.legL.position.set(-0.16, 0.6, 0); pa.legR.position.set(0.16, 0.6, 0);
    pa.armL.rotation.x = 0; pa.armR.rotation.x = 0;
  }

  // ---------- build from feed ----------
  var gotFeed = false;
  var built = false, deptsBuilt = {};
  var errs = [];
  function noteErr(e, where) { errs.push(where + ': ' + (e && e.message ? e.message : e)); window.__o3err = errs.slice(0, 3).join(' | '); }
  var chipSig = '';

  function stateKey(s) {
    s = String(s || '').toLowerCase();
    if (s === 'running' || s === 'waiting' || s === 'done' || s === 'blocked') { return s; }
    return 'unknown';
  }

  function build(feed) {
    var staff = Array.isArray(feed.staff) ? feed.staff : [];
    var byDept = {};
    staff.forEach(function (s) { if (s && s.id && s.dept && BLOCKS[s.dept]) { (byDept[s.dept] = byDept[s.dept] || []).push(s); } });
    var depts = Array.isArray(feed.departments) ? feed.departments : [];
    var names = {}; depts.forEach(function (d) { if (d && d.id) { names[d.id] = d.name; } });
    Object.keys(byDept).forEach(function (id) {
      if (deptsBuilt[id]) { return; }
      var list = byDept[id].slice().sort(function (a, b) { return (a.level === 'lead' ? 0 : 1) - (b.level === 'lead' ? 0 : 1); });
      deptsBuilt[id] = list.length;
      try { buildZone(id, list.length, names[id] || id); } catch (e) { noteErr(e, 'zone ' + id); }
      list.forEach(function (s, i) { try { makePersonAt(String(s.id), slotFor(id, i), id, false); } catch (e) { noteErr(e, 'p ' + s.id); } });
    });
    if (!people['mgr']) {
      var mp = makePersonAt('mgr', { x: 11.5, z: -3.6 }, 'mgr', true);
      var tile = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.06, 3.6), mat(ACCENT.mgr)); tile.material.transparent = true; tile.material.opacity = 0.22;
      tile.position.set(11.5, 0.04, -3.9); scene.add(tile);
      zoneInfo.mgr = { cx: 11.5, cz: -3.9, w: 5.2, d: 3.6, name: 'المديرة' };
      var ml = document.createElement('button'); ml.type = 'button'; ml.className = 'o3-zone'; ml.textContent = 'المديرة'; ml.addEventListener('click', function () { flyTo(new THREE.Vector3(11.5, 0, -3.6), 3.2); }); labelLayer.appendChild(ml); zoneInfo.mgr.el = ml;
      plant(8.6, -3.4); plant(14.4, -3.4);
    }
    built = true;
  }

  function update(feed) {
    gotFeed = true;
    if (!feed || typeof feed !== 'object') { return; }
    if (!built || Object.keys(deptsBuilt).length === 0) { build(feed); }
    var staff = Array.isArray(feed.staff) ? feed.staff : [];
    staff.forEach(function (s) {
      if (s && s.id && !people[String(s.id)] && BLOCKS[s.dept] && deptsBuilt[s.dept]) {
        try { makePersonAt(String(s.id), slotFor(s.dept, deptsBuilt[s.dept]), s.dept, false); deptsBuilt[s.dept] += 1; } catch (e) { noteErr(e, 'new ' + s.id); }
      }
    });
    staff.forEach(function (s) {
      var rec = people[String(s.id)]; if (!rec) { return; }
      rec.state = stateKey(s.state);
      rec.nameText = String(s.name || ''); rec.roleText = String(s.title || '');
      rec.step = String(s.step || '');
    });
    var mg = people['mgr'];
    if (mg && feed.assistant) {
      mg.state = /شغ|run/i.test(String(feed.assistant.state || '')) ? 'running' : 'waiting';
      mg.nameText = String(feed.assistant.name || 'ريم'); mg.roleText = String(feed.assistant.title || 'المديرة');
    }
    Object.keys(people).forEach(function (id) {
      var r = people[id];
      r.label.__n.textContent = r.nameText; r.label.__r.textContent = r.roleText;
      var col = STATE_COLOR[r.state] || STATE_COLOR.unknown;
      r.ring.material.color.setHex(col);
      r.desk.screens.forEach(function (sc) { sc.material.color.setHex(col); });
      r.label.dataset.state = r.state;
    });
    buildChips(feed);
  }

  function buildChips(feed) {
    var depts = Array.isArray(feed.departments) ? feed.departments : [];
    var sig = depts.map(function (d) { return d.id; }).join(',');
    if (sig === chipSig || !chipsEl) { return; }
    chipSig = sig;
    while (chipsEl.firstChild) { chipsEl.removeChild(chipsEl.firstChild); }
    function chip(label, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = 'o3-chip'; b.textContent = label; b.addEventListener('click', fn); chipsEl.appendChild(b); }
    chip('آخر التسليمات', function () { var h = document.getElementById('handoffsHeading'); if (h) { h.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
    chip('الكل', function () { flyTo(new THREE.Vector3(12.5, 0, 9), 1); });
    chip('المديرة', function () { flyTo(new THREE.Vector3(11.5, 0, -3.6), 3.2); });
    depts.forEach(function (d) {
      if (!BLOCKS[d.id]) { return; }
      chip(String(d.name || d.id).replace(/^قسم /, ''), function () {
        var z = zoneInfo[d.id]; if (z) { flyTo(new THREE.Vector3(z.cx, 0, z.cz), d.id === 'qa' ? 1.7 : 2.4); }
      });
    });
  }

  function flyTo(t, z) { desiredTarget.copy(t); desiredZoom = z; }

  // ---------- camera controls ----------
  var drag = null, pinch = null, moved = false;
  var el = renderer.domElement;
  el.style.touchAction = 'none';
  var pointers = {};
  function ptCount() { return Object.keys(pointers).length; }
  el.addEventListener('pointerdown', function (e) {
    el.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    moved = false;
    if (ptCount() === 1) { drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }; }
    if (ptCount() === 2) { var k = Object.keys(pointers); var a = pointers[k[0]], b = pointers[k[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: desiredZoom }; }
  });
  el.addEventListener('pointermove', function (e) {
    if (!pointers[e.pointerId]) { return; }
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (ptCount() === 2 && pinch) {
      var k = Object.keys(pointers); var a = pointers[k[0]], b = pointers[k[1]];
      var d = Math.hypot(a.x - b.x, a.y - b.y);
      desiredZoom = Math.min(5, Math.max(0.6, pinch.z * d / pinch.d)); zoom = desiredZoom; moved = true; return;
    }
    if (drag && ptCount() === 1) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 6) { moved = true; }
      drag.x = e.clientX; drag.y = e.clientY;
      var span = baseSpan / zoom, h = canvasWrap.clientHeight || 520;
      var unit = span / h;
      // screen drag -> world pan on the ground plane (camera is 45deg diagonal)
      var rx = (-dx * unit) * 0.7071 * 1.0, rz = (-dx * unit) * -0.7071;
      var fx = (dy * unit) * 1.2 * 0.7071 * -1, fz = (dy * unit) * 1.2 * 0.7071 * -1;
      desiredTarget.x += rx + fx; desiredTarget.z += rz + fz;
      target.copy(desiredTarget);
    }
  });
  function endPointer(e) {
    var had = pointers[e.pointerId];
    delete pointers[e.pointerId];
    if (ptCount() < 2) { pinch = null; }
    if (ptCount() === 0) {
      if (had && !moved) { pick(e.clientX, e.clientY); }
      drag = null;
    }
  }
  el.addEventListener('pointerup', endPointer);
  el.addEventListener('pointercancel', function (e) { delete pointers[e.pointerId]; pinch = null; drag = null; });
  el.addEventListener('wheel', function (e) {
    e.preventDefault();
    desiredZoom = Math.min(5, Math.max(0.6, desiredZoom * (e.deltaY < 0 ? 1.12 : 0.89))); zoom = desiredZoom;
  }, { passive: false });

  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(cx, cy) {
    var r = el.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    var hits = ray.intersectObjects(pickables, false);
    if (hits.length && typeof window.__openSheet === 'function') {
      var id = hits[0].object.userData.id;
      window.__openSheet(id === 'mgr' ? '__manager__' : id);
    }
  }

  // ---------- walking handoff ----------
  var walkers = 0;
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function routeTo(from, to) {
    var a = from.seat, bfront = to.front;
    var ax = a.x + 1.2, ay = a.z;
    var corrA = from.front.z + 0.3;
    var corrB = to.front.z + 0.3;
    var pts = [
      new THREE.Vector3(a.x, 0, a.z),
      new THREE.Vector3(a.x + 1.2, 0, a.z),
      new THREE.Vector3(a.x + 1.2, 0, corrA)
    ];
    var xa = to.seat.x + 1.2;
    pts.push(new THREE.Vector3(xa, 0, corrA));
    pts.push(new THREE.Vector3(xa, 0, corrB));
    pts.push(new THREE.Vector3(to.seat.x + 0.6, 0, corrB));
    pts.push(new THREE.Vector3(to.seat.x + 0.6, 0, to.desk.group.position.z + 0.75));
    return pts;
  }

  function followPath(rec, pts, speed) {
    return new Promise(function (resolve) {
      var seg = 0, t = 0, lastT = performance.now();
      var g = rec.person.group;
      function step() {
        var nowT = performance.now(); var dt = Math.min(0.1, (nowT - lastT) / 1000); lastT = nowT;
        if (seg >= pts.length - 1) { resolve(); return; }
        var a = pts[seg], b = pts[seg + 1];
        var len = a.distanceTo(b) || 0.0001;
        t += (speed * dt) / len;
        if (t >= 1) { t = 0; seg++; g.position.set(b.x, 0, b.z); }
        else { g.position.set(a.x + (b.x - a.x) * t, 0, a.z + (b.z - a.z) * t); }
        // face direction (camera sees +x/+z side): rotate group about y
        var dx = b.x - a.x, dz = b.z - a.z;
        g.rotation.y = Math.atan2(dx, dz);
        walkPhase += 0.22;
        var sw = Math.sin(walkPhase) * 0.7;
        var pa = rec.person.parts;
        pa.legL.rotation.x = sw; pa.legR.rotation.x = -sw;
        pa.armL.rotation.x = -sw * 0.8; pa.armR.rotation.x = sw * 0.8;
        pa.head.position.y = 1.78 + Math.abs(Math.sin(walkPhase)) * 0.04;
        requestAnimationFrame(step);
      }
      step();
    });
  }
  var walkPhase = 0;

  var bubbleEl = document.createElement('div');
  bubbleEl.className = 'o3-bubble'; bubbleEl.hidden = true;
  labelLayer.appendChild(bubbleEl);
  var bubbleFor = null;

  function walk(item) {
    var from = people[String(item.from)], to = people[String(item.to)];
    if (!from || !to || from === to || from.away) { return Promise.resolve(); }
    from.away = true;
    var g = from.person.group;
    standPose(from);
    g.position.set(from.seat.x, 0, from.seat.z);
    var pts = routeTo(from, to);
    bubbleFor = from; bubbleEl.textContent = String(item.label || 'تسليم'); bubbleEl.hidden = false;
    from.carry = true;
    flyTo(new THREE.Vector3((from.seat.x + to.seat.x) / 2, 0, (from.seat.z + to.seat.z) / 2), Math.max(1.5, Math.min(2.2, 40 / (from.seat.distanceTo(to.seat) + 8))));
    return followPath(from, pts, 3.4)
      .then(function () {
        g.rotation.y = Math.atan2(0, -1);
        var pa = from.person.parts; pa.legL.rotation.x = 0; pa.legR.rotation.x = 0; pa.armL.rotation.x = -1.2; pa.armR.rotation.x = -1.2;
        to.received = 1;
        return wait(1300);
      })
      .then(function () {
        to.received = 0;
        from.carry = false;
        return followPath(from, pts.slice().reverse(), 3.4);
      })
      .then(function () {
        g.position.set(from.seat.x, 0, from.seat.z);
        g.rotation.y = 0;
        sitPose(from);
        from.away = false; bubbleEl.hidden = true; bubbleFor = null;
      });
  }

  // ---------- render loop ----------
  var vec = new THREE.Vector3();
  function project(obj3, yOff, out) {
    vec.set(obj3.x, yOff, obj3.z);
    vec.project(camera);
    var w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
    out.x = (vec.x * 0.5 + 0.5) * w; out.y = (-vec.y * 0.5 + 0.5) * h; out.vis = vec.z < 1;
  }
  var pt = { x: 0, y: 0, vis: true };
  var clock = new THREE.Clock();

  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
    // camera easing
    target.lerp(desiredTarget, 0.08);
    zoom += (desiredZoom - zoom) * 0.08;
    placeCamera();
    var showRole = zoom > 1.9;
    var showNames = zoom > 1.35;
    Object.keys(zoneInfo).forEach(function (zid) {
      var zi = zoneInfo[zid]; if (!zi.el) { return; }
      project({ x: zi.cx, z: zi.cz - zi.d / 2 + 0.6 }, 0.6, pt);
      zi.el.style.transform = 'translate(' + pt.x.toFixed(1) + 'px,' + pt.y.toFixed(1) + 'px) translate(-50%,-50%)';
      zi.el.style.display = (!showNames && pt.vis) ? '' : 'none';
    });
    Object.keys(people).forEach(function (id) {
      var r = people[id], pa = r.person.parts;
      if (!r.away) {
        var tt = time + r.time;
        if (r.state === 'running') {
          pa.armL.rotation.x = -0.95 + Math.sin(tt * 9) * 0.18; pa.armR.rotation.x = -0.95 + Math.sin(tt * 9 + 1.6) * 0.18;
          pa.head.rotation.x = Math.sin(tt * 1.6) * 0.05;
        } else if (r.state === 'waiting') {
          pa.armL.rotation.x = -0.5; pa.armR.rotation.x = -0.5;
          pa.head.rotation.y = Math.sin(tt * 0.8) * 0.35; pa.head.rotation.x = 0;
        } else if (r.state === 'done') {
          pa.head.rotation.x = Math.max(0, Math.sin(tt * 1.4)) * 0.18; pa.head.rotation.y = 0;
        } else if (r.state === 'blocked') {
          pa.head.rotation.z = Math.sin(tt * 3) * 0.12;
        }
        r.ring.material.opacity = r.state === 'running' ? 0.55 + Math.sin(tt * 4) * 0.35 : 0.9;
      } else {
        r.ring.material.opacity = 0.25;
      }
      if (r.received) { r.desk.group.position.y = Math.abs(Math.sin(time * 8)) * 0.05; } else { r.desk.group.position.y = 0; }
      // label
      var headPos = r.away ? r.person.group.position : r.seat;
      project(headPos, 2.6, pt);
      var lb = r.label;
      lb.style.transform = 'translate(' + pt.x.toFixed(1) + 'px,' + pt.y.toFixed(1) + 'px) translate(-50%,-100%)';
      lb.style.display = (pt.vis && (showNames || r.away)) ? '' : 'none';
      lb.classList.toggle('show-role', showRole);
      lb.classList.toggle('is-away', !!r.away);
    });
    if (bubbleFor) {
      project(bubbleFor.person.group.position, 3.6, pt);
      bubbleEl.style.transform = 'translate(' + pt.x.toFixed(1) + 'px,' + pt.y.toFixed(1) + 'px) translate(-50%,-100%)';
    }
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', resize);
  if (typeof ResizeObserver !== 'undefined') { new ResizeObserver(resize).observe(canvasWrap); }
  resize();
  frame();

  function safeUpdate(feed) {
    try { update(feed); } catch (e) { noteErr(e, 'update'); }
    if (Object.keys(people).length < 5) { failScene(); }
  }
  function failScene() {
    host.classList.remove('o3-active'); document.documentElement.classList.remove('o3-on');
    host.classList.add('o3-failed');
    var lv = document.getElementById('listView'); if (lv) { lv.open = true; }
    if (hint) { hint.hidden = false; hint.textContent = 'المشهد ثلاثي الأبعاد مش شغال على جهازك، عرضنا القائمة بدله.' + (window.__o3err ? ' (' + window.__o3err.slice(0, 90) + ')' : ''); }
    window.Office3D.ready = false;
  }
  setTimeout(function () {
    if (!gotFeed) {
      fetch('feed.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (f) { safeUpdate(f); }).catch(function () { failScene(); });
    }
  }, 3500);
  window.Office3D = { ready: true, update: safeUpdate, walk: walk, flyTo: flyTo, focus: function (id) { var z = zoneInfo[id]; if (z) { flyTo(new THREE.Vector3(z.cx, 0, z.cz), id === 'qa' ? 1.7 : 2.4); } } };
  if (hint) { hint.hidden = false; }
})();
