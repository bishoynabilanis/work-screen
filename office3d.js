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
  var lowGpu = (window.devicePixelRatio || 1) > 2 || /iPhone|iPod/.test(navigator.userAgent || '');
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasWrap.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xdfeaf5, 60, 120);
  var hemi = new THREE.HemisphereLight(0xffffff, 0xb8c4d0, 0.95);
  scene.add(hemi);
  var winMats = [], cityLights = [], lampGlows = [];
  var sun = new THREE.DirectionalLight(0xfff3dc, 0.75);
  sun.position.set(1.5, 24, 22.5);
  sun.target.position.set(11.5, 0, 8.5); scene.add(sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(lowGpu ? 1024 : 2048, lowGpu ? 1024 : 2048);
  sun.shadow.camera.left = -26; sun.shadow.camera.right = 26; sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -26;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 90; sun.shadow.bias = -0.0006; sun.shadow.radius = 3;
  scene.add(sun);

  var camOrtho = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  var camPersp = new THREE.PerspectiveCamera(34, 1, 0.5, 260);
  var camera = camOrtho, perspMode = false;
  try { var pv = localStorage.getItem('o3-persp'); perspMode = pv === null ? (window.innerWidth / window.innerHeight >= 0.85) : pv === '1'; } catch (e) { perspMode = false; }
  var target = new THREE.Vector3(12.5, 0, 9);
  var zoom = 1;
  var desiredTarget = target.clone();
  var desiredZoom = 1;
  var baseSpan = 30, initZoomDone = false;
  var az = 0, cine = null, cineHome = null, cineDepth = 0, cineTimer = 0, lastTouch = -1e9, firstFeedDone = false;

  function placeCamera() {
    var w = canvasWrap.clientWidth || 360, h = canvasWrap.clientHeight || 520;
    var aspect = w / h;
    var span = baseSpan / zoom;
    var ca = Math.cos(az), sa = Math.sin(az);
    if (perspMode) {
      camera = camPersp; camera.aspect = aspect;
      var dd = 40 / zoom, ex = 24, ey = 12.5, ez = 24, el = Math.sqrt(ex * ex + ey * ey + ez * ez);
      var ox = (ex * ca + ez * sa) / el * dd, oz = (-ex * sa + ez * ca) / el * dd;
      camera.position.set(target.x + ox, target.y + ey / el * dd, target.z + oz);
    } else {
      camera = camOrtho;
      camera.left = -span * aspect / 2; camera.right = span * aspect / 2;
      camera.top = span / 2; camera.bottom = -span / 2;
      camera.position.set(target.x + 24 * ca + 24 * sa, target.y + 22, target.z - 24 * sa + 24 * ca);
    }
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
    if (!initZoomDone && aspect < 0.85) { initZoomDone = true; desiredZoom = zoom = 1.7; }
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
  function wallWithWindows(len, axis, skip) {
    var g = new THREE.Group();
    var wall = box(len, 5.2, 0.4, 0xf8f8f6);
    g.add(wall);
    var n = Math.floor(len / 4.2);
    for (var i = 0; i < n; i++) {
      if (skip && skip.indexOf(i) >= 0) { continue; }
      var win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.2), new THREE.MeshBasicMaterial({ color: 0xbfe3ff }));
      win.position.set(-len / 2 + 2.4 + i * 4.2, 0.2, 0.22);
      g.add(win); winMats.push(win.material);
      for (var cl = 0; cl < 7; cl++) {
        var bld = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3 + ((cl * 37 + i * 11) % 9) * 0.1), new THREE.MeshBasicMaterial({ color: 0xffd98a }));
        bld.position.set(win.position.x - 1.0 + cl * 0.33, -1.35 + 0.15 + ((cl * 37 + i * 11) % 9) * 0.05, 0.23);
        bld.visible = false; bld.userData.seed = (cl * 7 + i * 3) % 5; g.add(bld); cityLights.push(bld);
      }
      var frame = box(2.8, 3.4, 0.08, 0xffffff);
      frame.position.set(win.position.x, 0.2, 0.17);
      g.add(frame);
      var bar = box(0.07, 3.2, 0.1, 0xffffff); bar.position.set(win.position.x, 0.2, 0.24); g.add(bar);
      var bar2 = box(2.6, 0.07, 0.1, 0xffffff); bar2.position.set(win.position.x, 0.2, 0.24); g.add(bar2);
    }
    return g;
  }
  var wallBack = wallWithWindows(34, 'x', [1, 2, 3]);
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
    var st = document.createElement('div'); st.className = 'o3-status';
    var dots = document.createElement('i'); dots.className = 'o3-dots'; dots.innerHTML = '<u></u><u></u><u></u>';
    var tx = document.createElement('span'); tx.className = 'o3-st-text';
    st.appendChild(dots); st.appendChild(tx); labelLayer.appendChild(st);
    el.__s = st; el.__st = tx;
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
    var lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.03, 8), mat(0x2a2d33)); lampBase.position.set(-0.62, 0.85, 0.15); d.add(lampBase);
    var lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.32, 5), mat(0x2a2d33)); lampArm.position.set(-0.62, 1.0, 0.15); d.add(lampArm);
    var lampHead = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.12, 8), new THREE.MeshBasicMaterial({ color: 0x777c86 })); lampHead.position.set(-0.62, 1.17, 0.15); d.add(lampHead);
    var lampPool = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.0, depthWrite: false }));
    lampPool.rotation.x = -Math.PI / 2; lampPool.position.set(-0.55, 0.845, 0.25); d.add(lampPool);
    lampGlows.push({ head: lampHead, pool: lampPool });
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
      var prevSt = rec.state; rec.state = stateKey(s.state);
      if (firstFeedDone && prevSt && prevSt !== 'done' && rec.state === 'done' && !rec.away && cineDepth === 0) {
        if (cineGo(new THREE.Vector3(rec.seat.x, 0, rec.seat.z), (host.classList.contains('o3-portrait') ? 2.6 : 2.4))) { cineEnd(2500); }
      }
      rec.nameText = String(s.name || ''); rec.roleText = String(window.__roleOf ? window.__roleOf(s.title || '') : (s.title || ''));
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
      var stTxt = r.step || '';
      if (stTxt.length > 34) { stTxt = stTxt.slice(0, 33) + '…'; }
      r.label.__st.textContent = stTxt;
      r.label.__s.dataset.state = r.state;
      var col = STATE_COLOR[r.state] || STATE_COLOR.unknown;
      r.ring.material.color.setHex(col);
      r.desk.screens.forEach(function (sc) { sc.material.color.setHex(col); });
      r.label.dataset.state = r.state;
    });
    try { updateBoard(feed); } catch (e) { noteErr(e, 'board'); }
    try { applyShadows(); } catch (e) { noteErr(e, 'shadow'); }
    buildChips(feed);
    firstFeedDone = true;
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

  function smooth(k) { return k * k * (3 - 2 * k); }
  function startTween(t, z, ms) {
    cine = { t0: performance.now(), dur: ms, fT: target.clone(), fZ: zoom, tT: t.clone(), tZ: z };
    desiredTarget.copy(t); desiredZoom = z;
  }
  function flyTo(t, z) { cineHome = null; startTween(t, z, 1200); }
  function userTouch() { lastTouch = performance.now(); cine = null; cineHome = null; cineDepth = 0; clearTimeout(cineTimer); }
  // cinematic: slide/zoom to an event (3s, smoothstep), hold, then slide back to the wide view
  function cineGo(t, z) {
    if (performance.now() - lastTouch < 15000) { return false; }
    clearTimeout(cineTimer);
    if (!cineHome) { cineHome = { t: desiredTarget.clone(), z: desiredZoom }; }
    cineDepth++;
    startTween(t, z, 3000);
    return true;
  }
  function cineEnd(holdMs) {
    if (!cineHome) { return; }
    cineDepth = Math.max(0, cineDepth - 1);
    if (cineDepth > 0) { return; }
    clearTimeout(cineTimer);
    cineTimer = setTimeout(function () {
      if (cineHome && cineDepth === 0) { var h = cineHome; cineHome = null; startTween(h.t, h.z, 3000); }
    }, holdMs || 1200);
  }

  // ---------- camera controls ----------
  var drag = null, pinch = null, moved = false;
  var el = renderer.domElement;
  el.style.touchAction = 'none';
  var pointers = {};
  function ptCount() { return Object.keys(pointers).length; }
  el.addEventListener('pointerdown', function (e) {
    userTouch();
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
    e.preventDefault(); userTouch();
    desiredZoom = Math.min(5, Math.max(0.6, desiredZoom * (e.deltaY < 0 ? 1.12 : 0.89))); zoom = desiredZoom;
  }, { passive: false });

  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(cx, cy) {
    var r = el.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    var hits = ray.intersectObjects(pickables, false);
    var bh = ray.intersectObject(boardMesh, false);
    if (bh.length && (!hits.length || bh[0].distance < hits[0].distance)) {
      var pr = (canvasWrap.clientWidth || 1) / (canvasWrap.clientHeight || 1) < 0.85;
      flyTo(new THREE.Vector3(2.46, 0, -9.9), pr ? 1.9 : 2.7);
      return;
    }
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

  // ---------- envelope that travels along a curve ----------
  var envelopes = [];
  function makeEnvelope() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.42), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    g.add(body);
    var flap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.2, 3), new THREE.MeshBasicMaterial({ color: 0xffd9c9 }));
    flap.rotation.x = Math.PI / 2; flap.rotation.z = Math.PI; flap.position.set(0, 0.04, -0.1); flap.scale.set(1.1, 1, 0.9);
    g.add(flap);
    var seal = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), new THREE.MeshBasicMaterial({ color: 0xf4511e, side: THREE.DoubleSide }));
    seal.rotation.x = -Math.PI / 2; seal.position.set(0, 0.075, 0.03); g.add(seal);
    var glow = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 20), new THREE.MeshBasicMaterial({ color: 0xf4511e, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = -0.02; g.add(glow);
    g.scale.setScalar(2.4);
    return g;
  }
  function sendEnvelope(from, to) {
    var a = new THREE.Vector3(from.seat.x, 1.3, from.seat.z + 0.9);
    var b = new THREE.Vector3(to.seat.x, 1.3, to.seat.z + 0.9);
    var mid = a.clone().add(b).multiplyScalar(0.5); mid.y = 4.8 + a.distanceTo(b) * 0.12;
    var curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    var m = makeEnvelope(); m.position.copy(a); scene.add(m);
    var dur = Math.max(1600, Math.min(3200, 900 + a.distanceTo(b) * 90));
    return new Promise(function (resolve) {
      envelopes.push({ mesh: m, curve: curve, t0: performance.now(), dur: dur, done: function () { to.received = true; setTimeout(function () { to.received = false; }, 1200); resolve(); } });
    });
  }
  function stepEnvelopes() {
    if (!envelopes.length) { return; }
    var now = performance.now();
    envelopes = envelopes.filter(function (e) {
      var k = (now - e.t0) / e.dur;
      if (k >= 1) { scene.remove(e.mesh); e.done(); return false; }
      var ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      var pt = e.curve.getPoint(ease);
      e.mesh.position.copy(pt);
      var tg = e.curve.getTangent(ease);
      e.mesh.rotation.y = Math.atan2(tg.x, tg.z) + Math.PI / 2;
      e.mesh.rotation.z = Math.sin(k * Math.PI * 2) * 0.25;
      var sc = 2.4 * (k < 0.08 ? k / 0.08 : (k > 0.92 ? (1 - k) / 0.08 : 1));
      e.mesh.scale.setScalar(Math.max(0.01, sc));
      return true;
    });
  }

  // ---------- day / night by real Dubai time ----------
  var sunDisc = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false }));
  sunDisc.position.set(-14, 16, -22); sunDisc.lookAt(camera.position.x, camera.position.y, camera.position.z); scene.add(sunDisc);
  var clockEl = document.createElement('div'); clockEl.className = 'o3-clock'; (host.querySelector('.o3-stage') || host).appendChild(clockEl);
  function dubaiHour() {
    var m = /[?&]hour=([0-9.]+)/.exec(location.search); if (m) { return parseFloat(m[1]) % 24; }
    var d = new Date(Date.now() + 4 * 3600 * 1000); return d.getUTCHours() + d.getUTCMinutes() / 60;
  }
  function lerpC(a, b, k) { return new THREE.Color(a).lerp(new THREE.Color(b), k); }
  function applyTime() {
    var h = dubaiHour();
    // daylight 0..1: dark before 5:30, ramps to full by 7:30, falls from 17:00 to 19:00
    var day = h < 5.5 ? 0 : h < 7.5 ? (h - 5.5) / 2 : h < 17 ? 1 : h < 19 ? 1 - (h - 17) / 2 : 0;
    var warm = (h > 5.5 && h < 8) ? 1 - Math.abs(h - 6.7) / 1.3 : (h > 16.5 && h < 19.3) ? 1 - Math.abs(h - 17.9) / 1.4 : 0; warm = Math.max(0, Math.min(1, warm));
    var night = 1 - day;
    var sky = lerpC(0x0c1428, 0xdfeaf5, day); if (warm > 0) { sky.lerp(new THREE.Color(0xf0a878), warm * 0.55); }
    renderer.setClearColor(sky, 1); scene.fog.color.copy(sky);
    hemi.intensity = 0.42 + 0.53 * day; hemi.color.set(lerpC(0xb8c6ff, 0xffffff, day));
    sun.intensity = 0.1 + 0.65 * day; sun.color.set(lerpC(0xfff3dc, 0xffb070, warm));
    var glass = lerpC(0x0b1738, 0xbfe3ff, day); if (warm > 0) { glass.lerp(new THREE.Color(0xffc99a), warm * 0.6); }
    winMats.forEach(function (m) { m.color.copy(glass); });
    cityLights.forEach(function (b) { b.visible = night > 0.35 && ((b.userData.seed + Math.floor(h * 2)) % 5 !== 0); });
    lampGlows.forEach(function (l) { l.pool.material.opacity = 0.5 * night; l.head.material.color.set(night > 0.4 ? 0xffd27a : 0x777c86); });
    // sun by day, moon by night
    var isDay = h >= 6 && h < 18;
    var prog = isDay ? (h - 6) / 12 : ((h + 6) % 24) / 12;
    sunDisc.material.color.set(isDay ? lerpC(0xfff2b0, 0xffb070, warm) : 0xdfe6ff);
    sunDisc.position.set(-22 + prog * 26, 8 + Math.sin(prog * Math.PI) * 14, -22);
    sunDisc.lookAt(camera.position);
    var hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    clockEl.textContent = (isDay ? '☀ ' : '☾ ') + 'دبي ' + (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
    clockEl.className = 'o3-clock' + (night > 0.5 ? ' is-night' : '');
  }
  applyTime(); setInterval(applyTime, 60000);

  function walk(item) {
    var from = people[String(item.from)], to = people[String(item.to)];
    if (from && to && from !== to) { sendEnvelope(from, to); }
    if (!from || !to || from === to || from.away) { return Promise.resolve(); }
    from.away = true;
    var g = from.person.group;
    standPose(from);
    g.position.set(from.seat.x, 0, from.seat.z);
    var pts = routeTo(from, to);
    bubbleFor = from; bubbleEl.textContent = String(item.label || 'تسليم'); bubbleEl.hidden = false;
    from.carry = true;
    var cineOn = cineGo(new THREE.Vector3((from.seat.x + to.seat.x) / 2, 0, (from.seat.z + to.seat.z) / 2), Math.max(1.5, Math.min(2.2, 40 / (from.seat.distanceTo(to.seat) + 8))));
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
        if (cineOn) { cineEnd(1500); }
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
    if (cine) {
      var k = Math.min(1, (performance.now() - cine.t0) / cine.dur), sm = smooth(k);
      target.copy(cine.fT).lerp(cine.tT, sm); zoom = cine.fZ + (cine.tZ - cine.fZ) * sm;
      if (k >= 1) { cine = null; }
    } else {
      target.lerp(desiredTarget, 0.08);
      zoom += (desiredZoom - zoom) * 0.08;
    }
    // slow orbit when idle in the wide view
    var idle = !cine && !cineHome && ptCount() === 0 && performance.now() - lastTouch > 20000 && zoom < 2.2;
    var azT = idle ? Math.sin(clock.elapsedTime * 0.07) * 0.4 : 0;
    az += (azT - az) * (idle ? 0.012 : 0.05);
    placeCamera();
    var portrait = (canvasWrap.clientWidth || 1) / (canvasWrap.clientHeight || 1) < 0.85;
    var showRole = zoom > (portrait ? 3.4 : 1.9);
    var showNames = zoom > (portrait ? 2.4 : 1.35);
    if (host.classList.contains('o3-portrait') !== portrait) { host.classList.toggle('o3-portrait', portrait); }
    Object.keys(zoneInfo).forEach(function (zid) {
      var zi = zoneInfo[zid]; if (!zi.el) { return; }
      project({ x: zi.cx, z: zi.cz - zi.d / 2 + 0.6 }, 0.6, pt);
      zi.el.style.transform = 'translate(' + pt.x.toFixed(1) + 'px,' + pt.y.toFixed(1) + 'px) translate(-50%,-50%)';
      zi.el.style.display = (!showNames && pt.vis) ? '' : 'none';
      zi.rx = pt.x; zi.ry = pt.y; zi.rw = zi.el.offsetWidth || 90; zi.rh = zi.el.offsetHeight || 22; zi.rv = !showNames && pt.vis;
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
      updateChar(r, dt, tt);
      if (r.received) { r.desk.group.position.y = Math.abs(Math.sin(time * 8)) * 0.05; } else { r.desk.group.position.y = 0; }
      // label
      var headPos = r.away ? r.person.group.position : r.seat;
      project(headPos, 2.6, pt);
      var lb = r.label;
      lb.style.transform = 'translate(' + pt.x.toFixed(1) + 'px,' + pt.y.toFixed(1) + 'px) translate(-50%,-100%)';
      lb.style.display = (pt.vis && (showNames || r.away)) ? '' : 'none';
      lb.classList.toggle('show-role', showRole);
      lb.classList.toggle('is-away', !!r.away);
      var sb = lb.__s;
      var showSt = pt.vis && !r.away && (r.state === 'running' || r.state === 'blocked' || showNames);
      if (showSt && !showNames) {
        var bx = pt.x, by = pt.y - 4 - 6;
        for (var zk in zoneInfo) { var zz = zoneInfo[zk];
          if (zz.rv && Math.abs(bx - zz.rx) < zz.rw / 2 + 16 && Math.abs(by - zz.ry) < zz.rh / 2 + 10) { showSt = false; break; } }
      }
      sb.style.display = showSt ? 'flex' : 'none';
      if (showSt) {
        sb.classList.toggle('full', showNames);
        var lift = showNames ? (showRole ? 36 : 24) : 4;
        sb.style.transform = 'translate(' + pt.x.toFixed(1) + 'px,' + (pt.y - lift).toFixed(1) + 'px) translate(-50%,-100%)';
      }
    });
    if (bubbleFor) {
      project(bubbleFor.person.group.position, 3.6, pt);
      bubbleEl.style.transform = 'translate(' + pt.x.toFixed(1) + 'px,' + pt.y.toFixed(1) + 'px) translate(-50%,-100%)';
    }
    stepEnvelopes();
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
  // ---------- achievements board on the back wall ----------
  var boardCanvas = document.createElement('canvas'); boardCanvas.width = 1480; boardCanvas.height = 720;
  var boardTex = new THREE.CanvasTexture(boardCanvas);
  if (THREE.sRGBEncoding) { boardTex.encoding = THREE.sRGBEncoding; }
  var boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(9.3, 4.52), new THREE.MeshBasicMaterial({ map: boardTex }));
  boardMesh.position.set(5.3, 2.6, -7.04); scene.add(boardMesh);
  var boardFrame = box(9.6, 4.8, 0.1, 0x2b2f38); boardFrame.position.set(5.3, 2.6, -7.1); scene.add(boardFrame);
  var boardSig = '';
  function dubaiDay(d) { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(d); } catch (e) { return d.toDateString(); } }
  function toArNum(n) { try { return new Intl.NumberFormat('ar-EG').format(n); } catch (e) { return String(n); } }
  function updateBoard(feed) {
    var today = dubaiDay(new Date());
    var staff = Array.isArray(feed.staff) ? feed.staff : [];
    var doneToday = 0;
    staff.forEach(function (st) {
      if (stateKey(st.state) === 'done') { var d = st.time ? new Date(st.time) : null; if (d && !isNaN(d) && dubaiDay(d) === today) { doneToday++; } }
    });
    var hs = (Array.isArray(feed.handoffs) ? feed.handoffs : []).filter(function (h) { var d = h && h.time ? new Date(h.time) : null; return d && !isNaN(d); });
    hs.sort(function (a, b) { return new Date(b.time) - new Date(a.time); });
    var hsToday = hs.filter(function (h) { return dubaiDay(new Date(h.time)) === today; });
    var cnt = {}, best = null;
    hsToday.forEach(function (h) { [String(h.from), String(h.to)].forEach(function (id) { cnt[id] = (cnt[id] || 0) + 1; }); });
    Object.keys(cnt).forEach(function (id) { if (people[id] && (!best || cnt[id] > cnt[best])) { best = id; } });
    var busiest = null;
    if (best) { busiest = { name: people[best].nameText, role: people[best].roleText, note: toArNum(cnt[best]) + ' تسليمات النهاردة' }; }
    else {
      var run = staff.filter(function (st) { return stateKey(st.state) === 'running' && st.time; });
      run.sort(function (a, b) { return new Date(b.time) - new Date(a.time); });
      if (run[0]) { busiest = { name: String(run[0].name || ''), role: String(run[0].title || ''), note: 'شغال دلوقتي' }; }
    }
    var last3 = hs.slice(0, 3).map(function (h) {
      var a = people[String(h.from)], b = people[String(h.to)];
      return (a ? a.nameText : '؟') + '  ←  ' + (b ? b.nameText : '؟') + (h.label ? '  ·  ' + String(h.label).slice(0, 22) : '');
    });
    var sig = [doneToday, hsToday.length, busiest ? busiest.name + busiest.note : '', last3.join('|'), today].join('#');
    if (sig === boardSig) { return; }
    boardSig = sig;
    drawBoard(doneToday, hsToday.length, busiest, last3);
  }
  function drawBoard(done, hsN, busiest, last3) {
    var c = boardCanvas.getContext('2d'), W = 1480, H = 720;
    c.clearRect(0, 0, W, H);
    var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1f2a3a'); g.addColorStop(1, '#141b27');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#f4511e'; c.lineWidth = 8; c.strokeRect(8, 8, W - 16, H - 16);
    c.direction = 'rtl'; c.textAlign = 'right'; c.textBaseline = 'alphabetic';
    var F = 'system-ui, "Segoe UI", Tahoma, Arial, sans-serif';
    c.fillStyle = '#ffd98a'; c.font = '800 54px ' + F; c.fillText('🏆 لوحة الإنجازات', W - 50, 90);
    c.fillStyle = '#4ade80'; c.beginPath(); c.arc(60, 68, 10, 0, 7); c.fill();
    c.textAlign = 'left'; c.direction = 'ltr'; c.fillStyle = '#8fa0b5'; c.font = '700 26px ' + F; c.fillText('LIVE', 82, 77);
    c.textAlign = 'right'; c.direction = 'rtl';
    function card(x, w, title) { c.fillStyle = 'rgba(255,255,255,0.07)'; c.beginPath(); if (c.roundRect) { c.roundRect(x, 125, w, 555, 22); } else { c.rect(x, 125, w, 555); } c.fill(); c.fillStyle = '#9fb3c8'; c.font = '700 32px ' + F; c.fillText(title, x + w - 26, 175); }
    // right card: done today
    card(790, 650, 'مهام خلصت النهاردة');
    c.fillStyle = '#4ade80'; c.font = '900 210px ' + F; c.textAlign = 'center'; c.fillText(toArNum(done), 1115, 400);
    c.fillStyle = '#cfe0f2'; c.font = '700 34px ' + F; c.fillText('تسليمات النهاردة: ' + toArNum(hsN), 1115, 480);
    c.textAlign = 'right';
    c.fillStyle = '#9fb3c8'; c.font = '700 30px ' + F; c.fillText('أنشط موظف', 1414, 560);
    c.fillStyle = '#ffd98a'; c.font = '800 44px ' + F; c.fillText(busiest ? busiest.name : '—', 1414, 618);
    c.fillStyle = '#cfe0f2'; c.font = '600 28px ' + F; c.fillText(busiest ? (busiest.role + ' · ' + busiest.note) : 'لسه محدش اتحرك', 1414, 660);
    // left card: last 3 handoffs
    card(40, 720, 'آخر 3 تسليمات');
    c.font = '700 34px ' + F;
    if (!last3.length) { c.fillStyle = '#7d8da1'; c.fillText('مفيش تسليمات لسه', 720, 300); }
    last3.forEach(function (t, i) {
      var y = 250 + i * 130;
      c.fillStyle = 'rgba(58,160,255,0.16)'; c.fillRect(70, y - 52, 660, 100);
      c.fillStyle = '#58b0ff'; c.font = '900 40px ' + F; c.fillText(toArNum(i + 1), 712, y + 10);
      c.fillStyle = '#ffffff'; c.font = '700 33px ' + F; c.fillText(t, 650, y + 10);
    });
    boardTex.needsUpdate = true;
  }
  drawBoard(0, 0, null, []);

  // ---------- optional ambient office sound (synthesized in the browser, no audio files) ----------
  var ambient = { ctx: null, on: false, nodes: null, timer: 0 };
  function startAmbient() {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) { return false; }
    if (!ambient.ctx) { ambient.ctx = new AC(); }
    var ctx = ambient.ctx; if (ctx.state === 'suspended') { ctx.resume(); }
    var len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    var gn = ctx.createGain(); gn.gain.value = 0.0; gn.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 1.5);
    src.connect(lp); lp.connect(gn); gn.connect(ctx.destination); src.start();
    ambient.nodes = { src: src, gn: gn };
    var nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate), nd = nb.getChannelData(0);
    for (var j = 0; j < nd.length; j++) { nd[j] = (Math.random() * 2 - 1) * Math.exp(-j / (nd.length * 0.18)); }
    (function click() {
      if (!ambient.on) { return; }
      var s2 = ctx.createBufferSource(); s2.buffer = nb; var hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 1800 + Math.random() * 1800; hp.Q.value = 1.2;
      var g2 = ctx.createGain(); g2.gain.value = 0.05 + Math.random() * 0.06; s2.connect(hp); hp.connect(g2); g2.connect(ctx.destination); s2.start();
      ambient.timer = setTimeout(click, 60 + Math.random() * (Math.random() < 0.25 ? 900 : 260));
    })();
    return true;
  }
  function stopAmbient() {
    clearTimeout(ambient.timer);
    if (ambient.nodes) { var n = ambient.nodes; ambient.nodes = null; try { n.gn.gain.linearRampToValueAtTime(0, ambient.ctx.currentTime + 0.4); setTimeout(function () { try { n.src.stop(); } catch (e) { /* ok */ } }, 500); } catch (e) { /* ok */ } }
  }
  var soundBtn = document.createElement('button'); soundBtn.type = 'button'; soundBtn.className = 'o3-sound'; soundBtn.textContent = '🔇'; soundBtn.setAttribute('aria-label', 'صوت المكتب');
  soundBtn.addEventListener('click', function () {
    if (!ambient.on) { ambient.on = true; if (startAmbient()) { soundBtn.textContent = '🔊'; soundBtn.classList.add('on'); } else { ambient.on = false; } }
    else { ambient.on = false; stopAmbient(); soundBtn.textContent = '🔇'; soundBtn.classList.remove('on'); }
  });
  (host.querySelector('.o3-stage') || host).appendChild(soundBtn);


  // ---------- CC0 characters (Quaternius, Ultimate Animated Character Pack) ----------
  var CHAR_KEYS = ['Suit_Male', 'Suit_Female', 'Casual_Male', 'Casual_Female'];
  var charTpl = {}, charLoader = null, CHAR_SCALE = 0.62;
  var CHAR_SIT = { y: -0.02, z: 0.0 };
  function loadScriptTag(src, ok, bad) {
    var sc = document.createElement('script'); sc.src = src; sc.async = true;
    sc.onload = ok; sc.onerror = function () { if (bad) { bad(); } };
    document.head.appendChild(sc);
  }
  function loadParts(key, n, ok, bad) {
    if (n >= 3) { ok(); return; }
    loadScriptTag('o3p_' + key + '_' + n + '.js?v=1', function () { loadParts(key, n + 1, ok, bad); }, bad);
  }
  function charKeyFor(id) { return id === 'mgr' ? 'Suit_Female' : CHAR_KEYS[hashStr(id + 'c') % CHAR_KEYS.length]; }
  function initCharacters() {
    if (window.__o3NoChars) { return; }
    loadScriptTag('o3loaders.js?v=1', function () {
      var L = window.O3Loaders; if (!L) { return; }
      charLoader = new L.GLTFLoader(); charLoader.setMeshoptDecoder(L.MeshoptDecoder);
      var i = 0;
      (function next() {
        if (i >= CHAR_KEYS.length) { return; }
        var key = CHAR_KEYS[i++];
        loadParts(key, 0, function () {
          try {
            var b64 = (window.O3Models || {})[key]; if (!b64) { next(); return; }
            var bin = atob(b64), u = new Uint8Array(bin.length);
            for (var k = 0; k < bin.length; k++) { u[k] = bin.charCodeAt(k); }
            delete window.O3Models[key];
            charLoader.parse(u.buffer, '', function (gltf) {
              charTpl[key] = { scene: gltf.scene, clips: gltf.animations };
              Object.keys(people).forEach(function (pid) { upgradePerson(people[pid]); });
              next();
            }, function (e) { noteErr(e, 'glb ' + key); next(); });
          } catch (e) { noteErr(e, 'char ' + key); next(); }
        }, next);
      })();
    });
  }
  function upgradePerson(rec) {
    if (rec.char) { return; }
    var key = charKeyFor(rec.id), tpl = charTpl[key]; if (!tpl) { return; }
    var L = window.O3Loaders, inst = L.SkeletonUtils.clone(tpl.scene);
    var h = hashStr(rec.id);
    var cols = { Shirt: SHIRTS[h % SHIRTS.length], Skin: SKINS[hashStr(rec.id + 'k') % SKINS.length], Hair: HAIRS[hashStr(rec.id + 'h') % HAIRS.length] };
    inst.traverse(function (o) {
      if (!o.isMesh) { return; }
      o.frustumCulled = false; o.castShadow = true; o.receiveShadow = false;
      var arr = Array.isArray(o.material), ms = arr ? o.material : [o.material];
      var nm = ms.map(function (m) {
        var c = new THREE.MeshLambertMaterial({ color: m.color.clone() }); c.name = m.name; if (cols[m.name] !== undefined) { c.color.setHex(cols[m.name]); } return c;
      });
      o.material = arr ? nm : nm[0];
    });
    inst.scale.setScalar(CHAR_SCALE);
    var g = rec.person.group;
    g.children.forEach(function (c) { c.visible = false; });
    g.add(inst);
    var mixer = new THREE.AnimationMixer(inst), acts = {};
    tpl.clips.forEach(function (cl) { acts[cl.name] = mixer.clipAction(cl); });
    rec.char = inst; rec.mixer = mixer; rec.acts = acts; rec.cMode = ''; rec.fadeT = 0; rec.lastPos = g.position.clone();
    setCharMode(rec, 'sit', true);
  }
  function setCharMode(r, mode, instant) {
    if (r.cMode === mode || !r.acts) { return; }
    var name = mode === 'sit' ? 'SitDown' : mode === 'walk' ? 'Walk' : mode === 'walkc' ? 'Walk_Carry' : 'Idle';
    var a = r.acts[name]; if (!a) { return; }
    var prev = r.cMode && r.acts[r.cMode === 'sit' ? 'SitDown' : r.cMode === 'walk' ? 'Walk' : r.cMode === 'walkc' ? 'Walk_Carry' : 'Idle'];
    if (prev && prev !== a) { prev.fadeOut(0.25); }
    a.reset();
    if (mode === 'sit') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); a.time = a.getClip().duration; }
    else { a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false; a.fadeIn(instant ? 0 : 0.25).play(); }
    r.cMode = mode; r.fadeT = 0.3;
    if (mode === 'sit') { r.char.position.set(0, CHAR_SIT.y, CHAR_SIT.z); r.mixer.update(0.0001); } else { r.char.position.set(0, 0, 0); }
  }
  function updateChar(r, dt, tt) {
    if (!r.char) { return; }
    var g = r.person.group;
    var moved = g.position.distanceToSquared(r.lastPos) > 1e-6; r.lastPos.copy(g.position);
    var mode = r.away ? (moved ? (r.carry ? 'walkc' : 'walk') : 'idle') : 'sit';
    setCharMode(r, mode);
    if (mode !== 'sit' || r.fadeT > 0) { r.mixer.update(dt); r.fadeT = Math.max(0, r.fadeT - dt); }
    if (mode === 'sit') {
      if (r.state === 'running') { r.char.rotation.y = Math.sin(tt * 3.1) * 0.03; r.char.position.y = CHAR_SIT.y + Math.abs(Math.sin(tt * 8)) * 0.006; }
      else if (r.state === 'waiting') { r.char.rotation.y = Math.sin(tt * 0.8) * 0.12; r.char.position.y = CHAR_SIT.y; }
      else { r.char.rotation.y = 0; r.char.position.y = CHAR_SIT.y; }
    } else { r.char.rotation.y = 0; }
  }

  var shadowCount = -1;
  function applyShadows() {
    var n = Object.keys(people).length; if (n === shadowCount) { return; } shadowCount = n;
    scene.traverse(function (o) {
      if (!o.isMesh || !o.material) { return; }
      if (o.material.isMeshBasicMaterial) { return; }
      var g = o.geometry && o.geometry.type;
      if (g === 'PlaneGeometry') { return; }
      o.castShadow = true; o.receiveShadow = true;
    });
    floor.castShadow = false; carpet.castShadow = false; carpet.receiveShadow = true; floor.receiveShadow = true;
  }
  var viewBtn = document.createElement('button'); viewBtn.type = 'button'; viewBtn.className = 'o3-sound o3-view'; viewBtn.textContent = '🎥'; viewBtn.setAttribute('aria-label', 'تبديل زاوية الكاميرا');
  function syncViewBtn() { viewBtn.classList.toggle('on', perspMode); }
  viewBtn.addEventListener('click', function () {
    perspMode = !perspMode; try { localStorage.setItem('o3-persp', perspMode ? '1' : '0'); } catch (e) { /* ok */ }
    syncViewBtn();
  });
  syncViewBtn();
  (host.querySelector('.o3-stage') || host).appendChild(viewBtn);

  window.__o3dbg = { people: people, charTpl: charTpl };
  initCharacters();
  window.Office3D = { ready: true, update: safeUpdate, walk: walk, flyTo: flyTo, focus: function (id) { var z = zoneInfo[id]; if (z) { flyTo(new THREE.Vector3(z.cx, 0, z.cz), id === 'qa' ? 1.7 : 2.4); } } };
  if (hint) { hint.hidden = false; }
})();
