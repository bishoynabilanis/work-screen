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
  var sun = new THREE.DirectionalLight(0xfff3dc, 1.9);
  sun.position.set(1.5, 24, 22.5);
  sun.target.position.set(11.5, 0, 8.5); scene.add(sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(lowGpu ? 1024 : 2048, lowGpu ? 1024 : 2048);
  sun.shadow.camera.left = -26; sun.shadow.camera.right = 26; sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -26;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 90; sun.shadow.bias = -0.0006; sun.shadow.radius = 3;
  scene.add(sun);

  var camOrtho = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  var camPersp = new THREE.PerspectiveCamera(34, 1, 0.5, 260);
  var camera = camOrtho, perspMode = false;
  try { var pv = localStorage.getItem('o3-persp'); perspMode = true; void pv; } catch (e) { perspMode = false; }
  var target = new THREE.Vector3(9.5, 0, 10.5);
  var zoom = 1.55;
  var desiredTarget = target.clone();
  var desiredZoom = 1.55;
  var baseSpan = 30, initZoomDone = false;
  var floorSel = 0, deptObjs = {}, mgrWalls = [], camMode = 'free', followId = '', followT = 0, camBtns = {}, az = 0, azU = 0, azUT = 0, elU = 0.8, elUT = 0.8, camDir = { x: 0.7071, z: 0.7071 }, cine = null, cineHome = null, cineDepth = 0, cineTimer = 0, lastTouch = -1e9, firstFeedDone = false;

  function placeCamera() {
    var w = canvasWrap.clientWidth || 360, h = canvasWrap.clientHeight || 520;
    var aspect = w / h;
    var span = baseSpan / zoom;
    var th = Math.PI / 4 + az + azU, sT = Math.sin(th), cT = Math.cos(th);
    camDir.x = sT; camDir.z = cT;
    if (perspMode) {
      camera = camPersp; camera.aspect = aspect;
      var dd = 40 / zoom, ce = Math.cos(elU), se = Math.sin(elU);
      camera.position.set(target.x + sT * ce * dd, target.y + se * dd, target.z + cT * ce * dd);
    } else {
      camera = camOrtho;
      camera.left = -span * aspect / 2; camera.right = span * aspect / 2;
      camera.top = span / 2; camera.bottom = -span / 2;
      camera.position.set(target.x + 33.9 * sT, target.y + 22, target.z + 33.9 * cT);
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
    if (!initZoomDone && aspect < 0.85) { initZoomDone = true; desiredZoom = zoom = (w < 500 ? 0.95 : 0.66); }
    placeCamera();
  }

  // ---------- environment ----------
  function mat(color, extra) { var m = new THREE.MeshLambertMaterial({ color: color }); if (extra) { Object.assign(m, extra); } return m; }
  function box(w, h, d, color) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); return m; }

  var floor = new THREE.Mesh(new THREE.BoxGeometry(34, 0.4, 32), mat(0xf4f1ea));
  floor.position.set(11.5, -0.2, 8.5);
  scene.add(floor);
  var tileTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 256; var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, '#d9dde3'); g.addColorStop(1, '#c4cad3'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(70,80,95,0.35)'; x.lineWidth = 3; x.strokeRect(0, 0, 256, 256);
    x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(6, 6, 244, 60);
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(11, 10.5); t.anisotropy = 4; return t;
  })();
  var carpet = new THREE.Mesh(new THREE.BoxGeometry(33, 0.05, 31), new THREE.MeshStandardMaterial({ color: 0xffffff, map: tileTex, roughness: 0.22, metalness: 0.12 }));
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

  var swayers = [], steams = [], ambStamp = -1;
  function ambientLife(t) {
    for (var i = 0; i < swayers.length; i++) { var s = swayers[i]; s.m.position.x = s.bx + Math.sin(t * 1.3 + s.ph) * 0.035; s.m.position.z = s.bz + Math.cos(t * 1.1 + s.ph) * 0.03; s.m.rotation.z = Math.sin(t * 1.3 + s.ph) * 0.08; }
    for (var j = 0; j < steams.length; j++) { var st = steams[j], p = ((t * 0.35 + st.ph) % 1); st.m.position.y = st.y0 + p * 0.55; st.m.position.x = st.x0 + Math.sin(t * 2 + st.ph * 9) * 0.05 * p; st.m.material.opacity = Math.sin(p * Math.PI) * 0.35; var sc = 0.18 + p * 0.28; st.m.scale.set(sc, sc, 1); }
  }
  function plant(x, z) {
    var g = new THREE.Group();
    var pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.45, 8), mat(0xb0643c)); pot.position.y = 0.22; g.add(pot);
    for (var i = 0; i < 4; i++) {
      var leaf = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 5), mat(i % 2 ? 0x3f8f4f : 0x57a863));
      leaf.position.set(Math.cos(i * 1.6) * 0.18, 0.7 + i * 0.12, Math.sin(i * 1.6) * 0.18); g.add(leaf);
      swayers.push({ m: leaf, bx: leaf.position.x, bz: leaf.position.z, ph: x * 0.7 + z * 0.4 + i * 0.9 });
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
    (function () {
      var H = 2.7, ac = ACCENT[id] || 0xcccccc;
      var gm = new THREE.MeshPhysicalMaterial({ color: 0xcfeeff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
      var fm = mat(ac);
      function pane(px, pz, pw, pd) { var m = new THREE.Mesh(new THREE.BoxGeometry(pw, H, pd), gm); m.position.set(px, H / 2 + 0.05, pz); m.renderOrder = 5; scene.add(m); }
      function rail(px, pz, pw, pd) { var r = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.1, pd), fm); r.position.set(px, H + 0.1, pz); scene.add(r); var r2 = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.08, pd), fm); r2.position.set(px, 0.1, pz); scene.add(r2); }
      var x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, gap = 0.9;
      pane(cx, z0, w, 0.06); rail(cx, z0, w, 0.12);
      pane(x0, cz, 0.06, d); rail(x0, cz, 0.12, d);
      pane(x1, cz, 0.06, d); rail(x1, cz, 0.12, d);
      pane((x0 + cx - gap) / 2, z1, (cx - gap) - x0, 0.06); pane((x1 + cx + gap) / 2, z1, x1 - (cx + gap), 0.06);
      rail((x0 + cx - gap) / 2, z1, (cx - gap) - x0, 0.12); rail((x1 + cx + gap) / 2, z1, x1 - (cx + gap), 0.12);
      [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [cx - gap, z1], [cx + gap, z1]].forEach(function (p) { var po = new THREE.Mesh(new THREE.BoxGeometry(0.14, H + 0.2, 0.14), fm); po.position.set(p[0], (H + 0.2) / 2, p[1]); scene.add(po); });
    })();
    (function () {
      var c = document.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d');
      var gr = x.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,236,200,0.55)'); gr.addColorStop(1, 'rgba(255,236,200,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      var pool = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.25, d * 1.25), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(cx, 0.09, cz); scene.add(pool);
    })();
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
    var top = box(1.7, 0.1, 0.95, 0xc08f62); top.position.y = 0.78; d.add(top);
    var side1 = box(0.08, 0.76, 0.9, 0x39414d); side1.position.set(-0.8, 0.38, 0); d.add(side1);
    var side2 = box(0.08, 0.76, 0.9, 0x39414d); side2.position.set(0.8, 0.38, 0); d.add(side2);
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
    if (!window.__o3NoChars) { p.group.visible = false; setTimeout(function () { p.group.visible = true; }, 90000); }
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
      var n0 = scene.children.length;
      try { buildZone(id, list.length, names[id] || id); } catch (e) { noteErr(e, 'zone ' + id); }
      list.forEach(function (s, i) { try { makePersonAt(String(s.id), slotFor(id, i), id, false); } catch (e) { noteErr(e, 'p ' + s.id); } });
      tagDept(id, n0);
    });
    if (!people['mgr']) {
      var nm0 = scene.children.length;
      var mp = makePersonAt('mgr', { x: 11.5, z: -3.6 }, 'mgr', true);
      var tile = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.06, 3.6), mat(ACCENT.mgr)); tile.material.transparent = true; tile.material.opacity = 0.22;
      tile.position.set(11.5, 0.04, -3.9); scene.add(tile);
      zoneInfo.mgr = { cx: 11.5, cz: -3.9, w: 5.2, d: 3.6, name: 'المديرة' };
      var ml = document.createElement('button'); ml.type = 'button'; ml.className = 'o3-zone'; ml.textContent = 'مكتب المديرة'; ml.addEventListener('click', function () { flyTo(new THREE.Vector3(11.5, 0, -3.6), 3.2); }); labelLayer.appendChild(ml); zoneInfo.mgr.el = ml;
      plant(8.9, -2.2); plant(14.1, -2.2);
      tile.visible = false;
      // separate closed office for the manager (solid walls, door, own furniture; near walls fade when the camera looks through them)
      function buildOffice(X0, X1, kind) {
        var Z0 = -7.0, Z1 = -1.5, cxm = 11.5, czm = (Z0 + Z1) / 2, H = 3.7, T = 0.22;
        var fl = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0, 0.12, Z1 - Z0), mat(0x8a5a3c)); fl.position.set(cxm, 0.06, czm); fl.receiveShadow = true; scene.add(fl);
        var rug = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.03, 3.2), mat(0x2f3e5c)); rug.position.set(cxm, 0.14, -3.9); rug.receiveShadow = true; scene.add(rug);
        var rug2 = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.035, 2.5), mat(0xd9b77a)); rug2.position.set(cxm, 0.15, -3.9); scene.add(rug2);
        if (kind === 'mgr') { mgrWalls = []; }
        function wallM(nx, nz) { var m = new THREE.MeshLambertMaterial({ color: 0xcfeeff, transparent: true, opacity: 0.17, side: THREE.DoubleSide, depthWrite: false }); mgrWalls.push({ m: m, nx: nx, nz: nz }); return m; }
        function wall(cx, cz, w, d, nx, nz, h, y0) {
          var wm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallM(nx, nz)); wm.position.set(cx, (y0 || 0) + h / 2, cz); wm.castShadow = false; scene.add(wm);
          return wm;
        }
        var trimM = mat(0x5b3a26), accentM = mat(0xf4511e);
        // side walls and front wall with a door gap (door gap 1.3 wide at cxm)
        wall(X0, czm, T, Z1 - Z0, -1, 0, H); wall(X1, czm, T, Z1 - Z0, 1, 0, H);
        var gx0 = cxm - 0.75, gx1 = cxm + 0.75;
        wall((X0 + gx0) / 2, Z1, gx0 - X0, T, 0, 1, H); wall((X1 + gx1) / 2, Z1, X1 - gx1, T, 0, 1, H);
        wall(cxm, Z1, gx1 - gx0, T, 0, 1, H - 2.7, 2.7);
        // baseboards, solid and always visible, so the room outline reads even when walls fade
        [[X0, czm, 0.3, Z1 - Z0], [X1, czm, 0.3, Z1 - Z0], [(X0 + gx0) / 2, Z1, gx0 - X0, 0.3], [(X1 + gx1) / 2, Z1, X1 - gx1, 0.3]].forEach(function (b) {
          var bb = new THREE.Mesh(new THREE.BoxGeometry(b[2], 0.4, b[3]), trimM); bb.position.set(b[0], 0.32, b[1]); scene.add(bb);
        });
        // door frame and open door leaf
        var f1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.75, 0.3), trimM); f1.position.set(gx0, 1.45, Z1); scene.add(f1);
        var f2 = f1.clone(); f2.position.x = gx1; scene.add(f2);
        var lin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.12, 0.3), trimM); lin.position.set(cxm, 2.82, Z1); scene.add(lin);
        var leaf = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.6, 0.07), mat(0xb8845a)); leaf.geometry.translate(0.675, 0, 0);
        leaf.position.set(gx0 + 0.05, 1.4, Z1 + 0.05); leaf.rotation.y = -1.15; leaf.castShadow = true; scene.add(leaf);
        var knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0xe8c15a)); knob.position.set(1.2, 0, 0.06); leaf.add(knob);
        var sign = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.42, 0.06), accentM); sign.position.set(cxm, 3.3, Z1 + 0.16); scene.add(sign);
        // furniture: bookshelf (left wall), sofa + coffee table (right side), credenza, wall art, floor lamp
        var shelf = new THREE.Group(); if (kind === 'meet') { shelf.visible = false; } var shBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 3.2), mat(0x6b4a30)); shBody.position.set(0, 1.3, 0); shelf.add(shBody);
        var bc = [0xd04a3a, 0x3a7bd0, 0xe0b040, 0x3fa070, 0x8a5ac0, 0xf2f2ec];
        for (var r = 0; r < 4; r++) { for (var k = 0; k < 11; k++) { var bk = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.46, 0.2), mat(bc[(r * 3 + k) % bc.length])); bk.position.set(0.12, 0.45 + r * 0.6, -1.4 + k * 0.28); shelf.add(bk); } }
        shelf.position.set(X0 + 0.45, 0, -4.9); scene.add(shelf);
        var sofa = new THREE.Group(), sm = mat(0x4a5a78);
        var sb = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.0), sm); sb.position.y = 0.4; sofa.add(sb);
        var sk = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 0.28), sm); sk.position.set(0, 0.8, 0.4); sofa.add(sk);
        [-1.3, 1.3].forEach(function (x) { var ar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 1.0), sm); ar.position.set(x, 0.55, 0); sofa.add(ar); });
        sofa.position.set(X1 - 0.9, 0, -5.6); sofa.rotation.y = -Math.PI / 2; scene.add(sofa); if (kind === 'meet') { sofa.visible = false; }
        var ctab = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 20), mat(0xe9dfcf)); ctab.position.set(X1 - 2.5, 0.5, -5.6); scene.add(ctab);
        (function () {
          var mug = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.12, 10), mat(0xf4511e)); mug.position.set(X1 - 2.5, 0.62, -5.6); scene.add(mug);
          var c = document.createElement('canvas'); c.width = c.height = 64; var x2 = c.getContext('2d'); var gr = x2.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x2.fillStyle = gr; x2.fillRect(0, 0, 64, 64);
          var tex = new THREE.CanvasTexture(c);
          for (var q = 0; q < 3; q++) { var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false })); sp.position.set(X1 - 2.5, 0.7, -5.6); scene.add(sp); steams.push({ m: sp, ph: q / 3, y0: 0.7, x0: X1 - 2.5 }); }
        })();
        var cleg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), trimM); cleg.position.set(X1 - 2.5, 0.25, -5.6); scene.add(cleg);
        var cred = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.9, 0.5), mat(0x6b4a30)); cred.position.set(cxm + 0.3, 0.45, Z0 + 0.5); scene.add(cred);
        var art = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 0.06), mat(0xf4511e)); art.position.set(cxm + 0.3, 2.3, Z0 + 0.35); scene.add(art);
        var art2 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 0.08), mat(0xffe9d2)); art2.position.set(cxm + 0.3, 2.3, Z0 + 0.33); scene.add(art2);
        var lampP = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 6), mat(0x333333)); lampP.position.set(X1 - 0.6, 1.0, -2.4); scene.add(lampP);
        var lampH = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.4, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe0a8, side: THREE.DoubleSide })); lampH.position.set(X1 - 0.6, 2.1, -2.4); scene.add(lampH);
        var mt = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 28), mat(0xf3ede2)); mt.position.set((X0 + 1.1), 0.85, -2.4); scene.add(mt);
        var mtl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 0.75, 10), mat(0x2b2b30)); mtl.position.set((X0 + 1.1), 0.45, -2.4); scene.add(mtl);
        [1.4, 2.4].forEach(function (an) { var ch = new THREE.Group(); var cs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.55), mat(0x2f3e5c)); cs.position.y = 0.55; ch.add(cs); var cb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.1), mat(0x2f3e5c)); cb.position.set(0, 0.9, -0.25); ch.add(cb); var cl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), mat(0x222226)); cl.position.y = 0.28; ch.add(cl); ch.position.set((X0 + 1.1) + Math.cos(an) * 1.05, 0, -2.4 + Math.sin(an) * 1.05); ch.rotation.y = -an - Math.PI / 2; scene.add(ch); });
        var tvS = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 0.08), mat(0x111418)); tvS.position.set((X0 + 1.3), 2.0, Z0 + 0.3); scene.add(tvS);
        var tvG = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 0.02), new THREE.MeshBasicMaterial({ color: 0x3a7bd0 })); tvG.position.set((X0 + 1.3), 2.0, Z0 + 0.36); scene.add(tvG);
        var exd = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.3), mat(0x5b3a26)); exd.position.set(cxm, 0.9, -3.15); scene.add(exd); if (kind === 'meet') { exd.visible = false; }
        [-1.05, 1.05].forEach(function (x) { var dl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 1.2), mat(0x4a2f1e)); dl.position.set(cxm + x, 0.45, -3.15); scene.add(dl); if (kind === 'meet') { dl.visible = false; } });
        if (kind === 'owner') { var och = new THREE.Group(); var oc1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), mat(0x1f2430)); oc1.position.y = 0.6; och.add(oc1); var oc2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 0.12), mat(0x1f2430)); oc2.position.set(0, 1.1, -0.34); och.add(oc2); och.position.set(cxm, 0, -3.95); scene.add(och); var omon = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.05), mat(0x111418)); omon.position.set(cxm, 1.3, -3.4); scene.add(omon); var oscr = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.02), new THREE.MeshBasicMaterial({ color: 0x3a7bd0 })); oscr.position.set(cxm, 1.3, -3.36); scene.add(oscr); }
        var zl2 = document.createElement('button'); zl2.type = 'button'; zl2.className = 'o3-zone'; zl2.textContent = kind === 'meet' ? 'غرفة الاجتماعات' : (kind === 'owner' ? 'مكتب المالك' : 'مكتب المديرة'); if (kind !== 'mgr') { labelLayer.appendChild(zl2); zoneInfo[kind] = { cx: (X0 + X1) / 2, cz: czm, w: X1 - X0, d: Z1 - Z0, name: zl2.textContent, el: zl2 }; zl2.addEventListener('click', function () { flyTo(new THREE.Vector3((X0 + X1) / 2, 0, -3.6), 3.0); }); }
        plant(X0 + 0.8, -2.4);
        if (kind === 'meet') { var lt = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 1.5), mat(0xf3ede2)); lt.position.set(cxm, 0.9, -4.2); scene.add(lt); [-1.4, 1.4].forEach(function (x) { var lg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.85, 1.2), mat(0x2b2b30)); lg.position.set(cxm + x, 0.45, -4.2); scene.add(lg); }); for (var ci = 0; ci < 6; ci++) { var chm = new THREE.Group(); var c1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.55), mat(0x2f3e5c)); c1.position.y = 0.55; chm.add(c1); var c2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.1), mat(0x2f3e5c)); c2.position.set(0, 0.9, ci < 3 ? -0.25 : 0.25); chm.add(c2); chm.position.set(cxm - 1.3 + (ci % 3) * 1.3, 0, ci < 3 ? -5.2 : -3.2); scene.add(chm); } }
        var pl = new THREE.PointLight(0xffd9a8, 0.8, 9); pl.position.set(cxm, 3.2, czm); scene.add(pl);
      }
      buildOffice(8.3, 14.7, 'mgr'); buildOffice(14.7, 19.5, 'meet'); buildOffice(19.5, 25.9, 'owner');
    }
    if (nm0 !== undefined) { tagDept('mgr', nm0); }
    try { groupFloors(); } catch (e) { noteErr(e, 'floors'); }
    built = true;
    if (floorSel) { applyFloor(); }
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
    chip('الكل', function () { setFloor(0, true); flyTo(new THREE.Vector3(12.5, 0, 9), 1); });
    chip('المديرة', function () { if (floorSel && floorSel !== 4) { setFloor(4, true); } flyTo(new THREE.Vector3(11.5, 0, -3.6), 3.2); });
    depts.forEach(function (d) {
      if (!BLOCKS[d.id]) { return; }
      chip(String(d.name || d.id).replace(/^قسم /, ''), function () {
        if (floorSel && FLOOR[d.id] && floorSel !== FLOOR[d.id]) { setFloor(FLOOR[d.id], true); }
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

  // ---------- floors ----------
  var FLOOR = { mgr: 4, owner: 4, meet: 4, trend: 1, video: 1, content: 2, jessica: 2, seo: 3, tools: 3, mail: 3, qa: 3 };
  var FLOOR_VIEW = { 1: [18, 0, -1, 1.3], 2: [4, 0, 6, 1.2], 3: [12, 0, 14, 1.0], 4: [11.5, 0, -3.9, 2.3] };
  function tagDept(id, n0) {
    var arr = deptObjs[id] = deptObjs[id] || [];
    for (var i = n0; i < scene.children.length; i++) { arr.push(scene.children[i]); }
  }
  function deptVisible(id) { return !floorSel || !FLOOR[id] || FLOOR[id] === floorSel; }
  function applyFloor() {
    Object.keys(deptObjs).forEach(function (id) { var v = deptVisible(id); deptObjs[id].forEach(function (ob) { ob.visible = v; }); });
    Object.keys(people).forEach(function (pid) { var r = people[pid]; r.hidden = !deptVisible(r.dept); });
    Object.keys(zoneInfo).forEach(function (zid) { zoneInfo[zid].hidden = !deptVisible(zid); });
  }
  var FLOOR_DY = { 1: 0, 2: 6.5, 3: 13, 4: 19.5 }, floorGroups = {}, buildOn = false, glassObjs = [];
  function groupFloors() {
    [1, 2, 3, 4].forEach(function (f) {
      var g = floorGroups[f] = new THREE.Group(); scene.add(g);
      var slab = new THREE.Mesh(new THREE.BoxGeometry(33, 0.1, 31), new THREE.MeshStandardMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.3, depthWrite: false }));
      slab.position.set(11.5, -0.04, 8.5); g.add(slab);
      var shell = new THREE.Mesh(new THREE.BoxGeometry(33, 4.4, 31), new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.07, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide }));
      shell.position.set(11.5, 2.2, 8.5); g.add(shell);
      var edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(33, 4.4, 31)), new THREE.LineBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.8 }));
      edges.position.set(11.5, 2.2, 8.5); g.add(edges);
      g.userData.glass = [slab, shell, edges]; glassObjs.push(slab, shell, edges);
      slab.visible = shell.visible = edges.visible = false;
    });
    Object.keys(deptObjs).forEach(function (id) {
      var f = FLOOR[id]; var g = floorGroups[f]; if (!g) { return; }
      deptObjs[id].forEach(function (ob) { if (ob.parent === scene) { scene.remove(ob); g.add(ob); } });
    });
  }
  function setBuilding(on) {
    if (buildOn === on || !floorGroups[1]) { buildOn = on; return; }
    buildOn = on;
    [1, 2, 3, 4].forEach(function (f) { var g = floorGroups[f]; g.position.y = on ? FLOOR_DY[f] : 0; g.userData.glass.forEach(function (o) { o.visible = on; }); });
    if (typeof carpet !== 'undefined') { carpet.visible = !on; }
    if (typeof floor !== 'undefined') { floor.visible = !on; }
    wallBack.visible = !on; wallLeft.visible = !on;
  }
  function floorOff(dept) { return buildOn ? (FLOOR_DY[FLOOR[dept]] || 0) : 0; }
  function setFloor(f, noFly) {
    if (f === 5) { floorSel = 0; applyFloor(); setBuilding(true); Object.keys(floorBtns).forEach(function (k) { floorBtns[k].classList.toggle('on', +k === 5); }); if (!noFly) { flyTo(new THREE.Vector3(11.5, 10.5, 8.5), 0.46); } return; }
    setBuilding(false);
    floorSel = f; applyFloor();
    Object.keys(floorBtns).forEach(function (k) { floorBtns[k].classList.toggle('on', +k === f); });
    if (!noFly) { if (f === 4) { elUT = 1.0; } else if (f === 0) { elUT = 0.8; } var v = FLOOR_VIEW[f] || [12.5, 0, 9, 1]; flyTo(new THREE.Vector3(v[0], v[1], v[2]), v[3]); }
  }
  var floorBtns = {};
  // ---------- camera controls ----------
  var drag = null, pinch = null, moved = false;
  var el = renderer.domElement;
  el.style.touchAction = 'none';
  var pointers = {};
  function ptCount() { return Object.keys(pointers).length; }
  el.addEventListener('pointerdown', function (e) {
    userTouch(); setCamMode('free');
    el.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    moved = false;
    if (ptCount() === 1) { drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, pan: e.button === 2 || e.shiftKey || e.button === 1 }; }
    if (ptCount() === 2) { var k = Object.keys(pointers); var a = pointers[k[0]], b = pointers[k[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: desiredZoom }; }
  });
  function panBy(dx, dy) {
    var unit = (baseSpan / zoom) / (canvasWrap.clientHeight || 520);
    var fx = -camDir.x, fz = -camDir.z, rx = -fz, rz = fx;
    desiredTarget.x += -rx * dx * unit + fx * dy * unit * 1.1;
    desiredTarget.z += -rz * dx * unit + fz * dy * unit * 1.1;
    desiredTarget.x = Math.min(27, Math.max(-4, desiredTarget.x));
    desiredTarget.z = Math.min(24, Math.max(-8, desiredTarget.z));
    target.lerp(desiredTarget, 0.5);
  }
  function clampZ(z) { return Math.min(5, Math.max(0.6, z)); }
  el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  el.addEventListener('pointermove', function (e) {
    var prev = pointers[e.pointerId];
    if (!prev) { return; }
    var np = { x: e.clientX, y: e.clientY };
    if (ptCount() === 2 && pinch) {
      var k = Object.keys(pointers); var a = pointers[k[0]], b = pointers[k[1]];
      var cx0 = (a.x + b.x) / 2, cy0 = (a.y + b.y) / 2;
      pointers[e.pointerId] = np;
      a = pointers[k[0]]; b = pointers[k[1]];
      var d = Math.hypot(a.x - b.x, a.y - b.y);
      desiredZoom = clampZ(pinch.z * d / pinch.d);
      panBy((a.x + b.x) / 2 - cx0, (a.y + b.y) / 2 - cy0);
      moved = true; return;
    }
    pointers[e.pointerId] = np;
    if (drag && ptCount() === 1) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 6) { moved = true; }
      drag.x = e.clientX; drag.y = e.clientY;
      if (!moved) { return; }
      if (drag.pan) { panBy(dx, dy); }
      else {
        azUT += dx * 0.006; elUT = Math.min(1.35, Math.max(0.12, elUT + dy * 0.004));
        if (perspMode === false) { elUT = 0.8; }
      }
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
    e.preventDefault(); userTouch(); setCamMode('free');
    var dy = Math.max(-120, Math.min(120, e.deltaY)); if (e.deltaMode === 1) { dy *= 16; } desiredZoom = clampZ(desiredZoom * Math.exp(-dy * 0.0009));
  }, { passive: false });

  el.addEventListener('dblclick', function () { userTouch(); azUT = 0; elUT = 0.8; desiredTarget.set(12.5, 0, 9); desiredZoom = (canvasWrap.clientWidth || 1) / (canvasWrap.clientHeight || 1) < 0.85 ? 0.66 : 1; });
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(cx, cy) {
    var r = el.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    var hits = ray.intersectObjects(pickables, false).filter(function (h) { var pr0 = people[h.object.userData.id]; return !(pr0 && pr0.hidden); });
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
  applyTime(); setInterval(applyTime, 15000);

  var walkRing = null, walkFor = null;
  function walk(item) {
    var from = people[String(item.from)], to = people[String(item.to)];
    if (from && to && from !== to) { sendEnvelope(from, to); }
    if (!from || !to || from === to || from.away) { return Promise.resolve(); }
    from.away = true; walkFor = from;
    if (!walkRing) { walkRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.78, 40), new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false })); walkRing.rotation.x = -Math.PI / 2; walkRing.renderOrder = 50; scene.add(walkRing); }
    var g = from.person.group;
    standPose(from);
    g.position.set(from.seat.x, 0, from.seat.z);
    var pts = routeTo(from, to);
    bubbleFor = from; bubbleEl.textContent = 'خلّصت ' + String(item.label || 'الشغل') + '، رايح أسلّمها لـ' + (to.nameText || 'زميلي'); bubbleEl.hidden = false;
    from.carry = true;
    var cineOn = cineGo(new THREE.Vector3((from.seat.x + to.seat.x) / 2, 0, (from.seat.z + to.seat.z) / 2), Math.max(1.5, Math.min(2.2, 40 / (from.seat.distanceTo(to.seat) + 8))));
    return followPath(from, pts, 3.4)
      .then(function () {
        g.rotation.y = Math.atan2(0, -1);
        var pa = from.person.parts; pa.legL.rotation.x = 0; pa.legR.rotation.x = 0; pa.armL.rotation.x = -1.2; pa.armR.rotation.x = -1.2;
        to.received = 1;
        bubbleEl.textContent = 'اتفضل يا ' + (to.nameText || 'زميلي'); return wait(900).then(function () { bubbleFor = to; bubbleEl.textContent = 'استلمت منك يا ' + (from.nameText || 'زميلي') + '، تمام'; return wait(1100); });
      })
      .then(function () {
        to.received = 0; bubbleFor = from; bubbleEl.textContent = 'تمام، راجع شغلي';
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
      zoom += (desiredZoom - zoom) * Math.min(1, dt * 7);
    }
    if (camMode !== 'free' && !cine && ptCount() === 0) {
      var ct = clock.elapsedTime;
      if (camMode === 'orbit') {
        azUT += dt * 0.28; elUT = 0.5; desiredZoom = 1.15; desiredTarget.set(12.5, 0, 8);
      } else if (camMode === 'fly') {
        desiredTarget.set(12 + 10.5 * Math.sin(ct * 0.11), 0, 8 + 9 * Math.sin(ct * 0.07 + 1.2));
        desiredZoom = 1.3; elUT = 0.3; azUT = 0.55 * Math.sin(ct * 0.09);
      } else if (camMode === 'follow') {
        if (ct - followT > 9 || !followId || !people[followId]) {
          var run = Object.keys(people).filter(function (k) { return people[k].state === 'running' && k !== followId; });
          if (!run.length) { run = Object.keys(people).filter(function (k) { return people[k].state === 'running'; }); }
          if (run.length) { followId = run[Math.floor(Math.random() * run.length)]; followT = ct; }
        }
        var fp = people[followId];
        if (fp) { var pp = fp.away ? fp.person.group.position : fp.seat; desiredTarget.set(pp.x, 0, pp.z); desiredZoom = 2.6; elUT = 0.4; azUT += (0.9 - azUT) * dt * 0.3; }
      }
    }
    mgrWalls.forEach(function (w) { var v = (camDir.x * w.nx + camDir.z * w.nz) > 0.12 ? 0.04 : 0.17; w.m.opacity += (v - w.m.opacity) * Math.min(1, dt * 6); w.m.depthWrite = false; });
    azU += (azUT - azU) * Math.min(1, dt * 9); elU += (elUT - elU) * Math.min(1, dt * 9);
    // slow orbit when idle in the wide view
    var idle = !cine && !cineHome && ptCount() === 0 && performance.now() - lastTouch > 20000 && zoom < 2.2;
    var azT = idle ? Math.sin(clock.elapsedTime * 0.07) * 0.4 : 0;
    az += (azT - az) * (idle ? 0.012 : 0.05);
    placeCamera();
    var portrait = (canvasWrap.clientWidth || 1) / (canvasWrap.clientHeight || 1) < 0.85;
    var showRole = zoom > (portrait ? 3.4 : 2.4);
    var showNames = zoom > (portrait ? 2.6 : 1.7);
    if (host.classList.contains('o3-portrait') !== portrait) { host.classList.toggle('o3-portrait', portrait); }
    var zRects = [];
    Object.keys(zoneInfo).forEach(function (zid) {
      var zi = zoneInfo[zid]; if (!zi.el) { return; }
      project({ x: zi.cx, z: zi.cz - zi.d / 2 + 0.6 }, 0.6 + floorOff(zid), pt);
      var zhw = (zi.el.offsetWidth || 0) / 2 + 6, zW = canvasWrap.clientWidth || 0, zx = zW > zhw * 2 ? Math.min(zW - zhw - (pt.y < 130 ? 58 : 0), Math.max(zhw, pt.x)) : pt.x;
      var zhh = (zi.el.offsetHeight || 24) / 2 + 3, zy = pt.y;
      for (var zr = 0; zr < zRects.length; zr++) { var q = zRects[zr]; if (Math.abs(zx - q.x) < zhw + q.w && Math.abs(zy - q.y) < zhh + q.h) { zy = q.y + q.h + zhh + 1; } }
      if (pt.vis && !zi.hidden) { zRects.push({ x: zx, y: zy, w: zhw, h: zhh }); }
      zi.el.style.transform = 'translate(' + zx.toFixed(1) + 'px,' + zy.toFixed(1) + 'px) translate(-50%,-50%)';
      zi.el.style.display = (!showNames && pt.vis && !zi.hidden && !buildOn) ? '' : 'none';
      zi.rx = pt.x; zi.ry = pt.y; zi.rw = zi.el.offsetWidth || 90; zi.rh = zi.el.offsetHeight || 22; zi.rv = !showNames && pt.vis && !zi.hidden && !buildOn;
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
      if (ambStamp !== time) { ambStamp = time; ambientLife(time); }
      updateChar(r, dt, tt);
      if (r.received) { r.desk.group.position.y = Math.abs(Math.sin(time * 8)) * 0.05; } else { r.desk.group.position.y = 0; }
      // label
      var headPos = r.away ? r.person.group.position : r.seat;
      var fo = floorOff(r.dept); if (fo) { headPos = new THREE.Vector3(headPos.x, headPos.y + fo, headPos.z); }
      project(headPos, 3.0 + fo, pt);
      var lb = r.label;
      lb.style.transform = 'translate(' + pt.x.toFixed(1) + 'px,' + pt.y.toFixed(1) + 'px) translate(-50%,-100%)';
      lb.style.display = (pt.vis && !r.hidden && (showNames || r.away)) ? '' : 'none';
      lb.classList.toggle('show-role', showRole);
      lb.classList.toggle('is-away', !!r.away);
      var sb = lb.__s;
      var showSt = pt.vis && !r.hidden && !r.away && (r.state === 'running' || r.state === 'blocked' || showNames);
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
      project(bubbleFor.person.group.position, 2.45, pt);
      if (walkRing) { walkRing.visible = !!(walkFor && walkFor.away); if (walkFor) { walkRing.position.set(walkFor.person.group.position.x, 0.06, walkFor.person.group.position.z); walkRing.rotation.z += dt * 2; } }
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
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    var gn = ctx.createGain(); gn.gain.value = 0.0; gn.gain.linearRampToValueAtTime(0.022, ctx.currentTime + 3);
    src.connect(lp); lp.connect(gn); gn.connect(ctx.destination); src.start();
    ambient.nodes = { src: src, gn: gn };
    var nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate), nd = nb.getChannelData(0);
    for (var j = 0; j < nd.length; j++) { nd[j] = (Math.random() * 2 - 1) * Math.exp(-j / (nd.length * 0.18)); }
    (function click() {
      if (!ambient.on) { return; }
      var s2 = ctx.createBufferSource(); s2.buffer = nb; var hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 1400 + Math.random() * 900; hp.Q.value = 1.2;
      var g2 = ctx.createGain(); g2.gain.value = 0.006 + Math.random() * 0.008; s2.connect(hp); hp.connect(g2); g2.connect(ctx.destination); s2.start();
      ambient.timer = setTimeout(click, 500 + Math.random() * 2200);
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
  var CHAR_KEYS = ['businessman', 'woman', 'man', 'scientist', 'doctor', 'nurse', 'teen', 'athlete'];
  var FEMALE = ' سلمى ليلى دعاء آية دينا هالة نهى رشا مروة شهد هدى سلوى ياسمين سمر جيهان منى رنا هبة كوثر إيمان سارة لبنى نيرة ريم ';
  var charTpl = {}, charLoader = null, CHAR_SCALE = 0.62;
  var CHAR_SIT = { y: -0.02, z: 0.0 };
  function loadScriptTag(src, ok, bad) {
    var sc = document.createElement('script'); sc.src = src; sc.async = true;
    sc.onload = ok; sc.onerror = function () { if (bad) { bad(); } };
    document.head.appendChild(sc);
  }
  function loadParts(key, n, ok, bad) {
    if (n >= ({businessman: 5, woman: 5, man: 5, scientist: 4, doctor: 5, nurse: 6, teen: 3, athlete: 3}[key])) { ok(); return; }
    loadScriptTag('o3g_' + key + '_' + n + '.js?v=6', function () { loadParts(key, n + 1, ok, bad); }, bad);
  }
  function charKeyFor(id) {
    var rec = people[id], nm = rec && rec.nameText ? rec.nameText.trim() : '';
    var fem = id === 'mgr' || (nm && FEMALE.indexOf(' ' + nm + ' ') >= 0);
    var hh = hashStr(id + 'c');
    if (!nm && id !== 'mgr') { return CHAR_KEYS[hh % 8]; }
    var FP = ['woman','scientist','nurse','athlete','woman'], MP = ['man','businessman','doctor','teen','man'];
    return fem ? (id === 'mgr' ? 'woman' : FP[hh % 5]) : MP[hh % 5];
  }
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
              var bb = new THREE.Box3().setFromObject(gltf.scene); charTpl[key] = { scene: gltf.scene, clips: gltf.animations, h: bb.max.y - bb.min.y, minY: bb.min.y };
              Object.keys(people).forEach(function (pid) { upgradePerson(people[pid]); });
              next();
            }, function (e) { noteErr(e, 'glb ' + key); next(); });
          } catch (e) { noteErr(e, 'char ' + key); next(); }
        }, next);
      })();
    });
  }
  var G_H = 1.45;
  function upgradePerson(rec) {
    if (rec.char) { return; }
    var key = charKeyFor(rec.id), tpl = charTpl[key]; if (!tpl) { return; }
    var L = window.O3Loaders, inst = L.SkeletonUtils.clone(tpl.scene);
    inst.traverse(function (o) { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = false; } });
    var h = hashStr(rec.id), wrap = new THREE.Group(); wrap.add(inst);
    var sc = G_H / tpl.h * (0.96 + (h % 9) * 0.01); inst.scale.setScalar(sc);
    var bones = {}; inst.traverse(function (o) { if (o.isBone) { bones[o.name] = o; o.userData.bp = o.position.clone(); o.userData.br = o.rotation.clone(); } });
    var g = rec.person.group;
    g.children.forEach(function (c) { c.visible = false; });
    g.add(wrap); g.visible = true;
    var mixer = new THREE.AnimationMixer(inst), acts = {};
    tpl.clips.forEach(function (cl) { acts[cl.name] = mixer.clipAction(cl); });
    rec.char = wrap; rec.inst = inst; rec.bones = bones; rec.mixer = mixer; rec.acts = acts; rec.cMode = ''; rec.lastPos = g.position.clone();
    rec.gh = tpl.h * sc; rec.minY = tpl.minY * sc;
    setCharMode(rec, 'sit', true);
  }
  function resetBones(r) { Object.keys(r.bones).forEach(function (k) { var b = r.bones[k]; b.position.copy(b.userData.bp); b.rotation.copy(b.userData.br); }); }
  function seatPose(r) {
    resetBones(r); var b = r.bones; if (!b.Hips) { return; }
    b.Hips.position.y *= 0.60;
    ['Left', 'Right'].forEach(function (sd, i) {
      var sg = i === 0 ? 1 : -1;
      if (b[sd + 'UpLeg']) { b[sd + 'UpLeg'].rotation.x += -1.45; } if (b[sd + 'Leg']) { b[sd + 'Leg'].rotation.x += 1.5; } if (b[sd + 'Foot']) { b[sd + 'Foot'].rotation.x += -0.1; }
      if (b[sd + 'Arm']) { b[sd + 'Arm'].rotation.z += sg * -0.5; b[sd + 'Arm'].rotation.x += 0.6; }
      if (b[sd + 'ForeArm']) { b[sd + 'ForeArm'].rotation.x += 0.9; }
    });
    if (b.Spine) { b.Spine.rotation.x += 0.08; }
  }
  function setCharMode(r, mode, instant) {
    if (r.cMode === mode || !r.acts) { return; }
    var walking = mode === 'walk' || mode === 'walkc';
    r.mixer.stopAllAction();
    if (walking && r.acts.walk) { resetBones(r); r.acts.walk.reset().fadeIn(instant ? 0 : 0.2).play(); r.char.position.set(0, -r.minY, 0); }
    else if (mode === 'sit') { seatPose(r); r.char.position.set(0, 0, 0); r.person.group.updateMatrixWorld(true); if (r.bones.Hips) { var hw = new THREE.Vector3(), gw = new THREE.Vector3(); r.bones.Hips.getWorldPosition(hw); r.person.group.getWorldPosition(gw); r.char.position.set(-(hw.x - gw.x), 0.67 - (hw.y - gw.y), -(hw.z - gw.z) + CHAR_SIT.z); } r.sitBase = true; }
    else { resetBones(r); r.char.position.set(0, -r.minY, 0); }
    r.cMode = mode;
  }
  function updateChar(r, dt, tt) {
    if (!r.char) { return; }
    var g = r.person.group;
    var moved = g.position.distanceToSquared(r.lastPos) > 1e-6; r.lastPos.copy(g.position);
    var mode = r.away ? (moved ? (r.carry ? 'walkc' : 'walk') : 'idle') : 'sit';
    setCharMode(r, mode);
    if (mode === 'walk' || mode === 'walkc') { r.mixer.update(dt); r.char.rotation.y = 0; return; }
    if (mode === 'sit') {
      var b = r.bones, run = r.state === 'running';
      ['Left', 'Right'].forEach(function (sd, i) {
        var fa = b[sd + 'ForeArm']; if (!fa) { return; }
        fa.rotation.x = fa.userData.br.x + 1.1 + (run ? Math.sin(tt * 11 + i * 1.7) * 0.07 : 0);
      });
      if (b.Head) { b.Head.rotation.y = r.state === 'waiting' ? Math.sin(tt * 0.8) * 0.3 : (run ? Math.sin(tt * 1.1) * 0.06 : 0); }
      if (b.Spine) { b.Spine.rotation.x = 0.08 + Math.sin(tt * 1.6 + (r.fidPh || 0)) * 0.012; }
      // idle fidget every 8-20s: look around, nod, sip, lean back
      var now = performance.now() / 1000;
      if (!r.fidNext) { r.fidNext = now + 4 + Math.random() * 14; r.fidPh = Math.random() * 6; }
      if (now > r.fidNext && !r.fid) { r.fid = { k: ['look', 'nod', 'sip', 'lean'][Math.floor(Math.random() * 4)], t0: now, d: 1.8 + Math.random() * 0.8, s: Math.random() < 0.5 ? 1 : -1 }; }
      if (r.fid) {
        var pr = (now - r.fid.t0) / r.fid.d;
        if (pr >= 1) { r.fid = null; r.fidNext = now + 8 + Math.random() * 12; }
        else {
          var e = Math.sin(pr * Math.PI), k = r.fid.k;
          if (k === 'look' && b.Head) { b.Head.rotation.y += r.fid.s * 0.55 * e; }
          else if (k === 'nod' && b.Head) { b.Head.rotation.x += Math.sin(pr * Math.PI * 4) * 0.12 * e; }
          else if (k === 'sip' && b.RightForeArm) { b.RightForeArm.rotation.x += 0.9 * e; if (b.RightArm) { b.RightArm.rotation.x += 0.35 * e; } if (b.Head) { b.Head.rotation.x -= 0.1 * e; } }
          else if (k === 'lean' && b.Spine) { b.Spine.rotation.x -= 0.14 * e; if (b.Head) { b.Head.rotation.x -= 0.05 * e; } }
        }
      }
    }
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
  var viewBtn = document.createElement('button'); viewBtn.type = 'button'; viewBtn.className = 'o3-sound o3-view'; viewBtn.style.display = 'none'; viewBtn.textContent = '🎥'; viewBtn.setAttribute('aria-label', 'تبديل زاوية الكاميرا');
  function syncViewBtn() { viewBtn.classList.toggle('on', perspMode); }
  viewBtn.addEventListener('click', function () {
    perspMode = !perspMode; try { localStorage.setItem('o3-persp', perspMode ? '1' : '0'); } catch (e) { /* ok */ }
    syncViewBtn();
  });
  var camBar = document.createElement('div'); camBar.className = 'o3-cams';
  function setCamMode(m) {
    camMode = m;
    Object.keys(camBtns).forEach(function (k) { camBtns[k].classList.toggle('on', k === m); });
    if (m !== 'free') { cine = null; cineHome = null; cineDepth = 0; clearTimeout(cineTimer); followT = -99; if (m === 'orbit') { elUT = 0.5; } }
  }
  [['free', 'حرّ'], ['fly', 'طيران'], ['orbit', 'دوران'], ['follow', 'متابعة']].forEach(function (p) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = p[1]; b.addEventListener('click', function () { userTouch(); setCamMode(p[0]); });
    camBtns[p[0]] = b; camBar.appendChild(b);
  });
  var fsBtn = document.createElement('button'); fsBtn.type = 'button'; fsBtn.className = 'o3-fs-btn'; fsBtn.textContent = 'ملء الشاشة'; fsBtn.setAttribute('aria-label', 'ملء الشاشة');
  function isFs() { return document.documentElement.classList.contains('o3-fs'); }
  function setFs(on) {
    var de = document.documentElement;
    de.classList.toggle('o3-fs', on); fsBtn.textContent = on ? 'خروج' : 'ملء الشاشة';
    try {
      if (on) { var rq = de.requestFullscreen || de.webkitRequestFullscreen; if (rq && !document.fullscreenElement && !document.webkitFullscreenElement) { var pr = rq.call(de); if (pr && pr.catch) { pr.catch(function () { /* ok */ }); } } }
      else { var ex = document.exitFullscreen || document.webkitExitFullscreen; if ((document.fullscreenElement || document.webkitFullscreenElement) && ex) { var p2 = ex.call(document); if (p2 && p2.catch) { p2.catch(function () { /* ok */ }); } } }
    } catch (e) { /* ok */ }
    window.scrollTo(0, 0);
    setTimeout(function () { window.dispatchEvent(new Event('resize')); resize(); }, 120);
  }
  fsBtn.addEventListener('click', function () { setFs(!isFs()); });
  document.addEventListener('fullscreenchange', function () { if (!document.fullscreenElement && isFs()) { setFs(false); } });
  (host.querySelector('.o3-stage') || host).appendChild(fsBtn);
  var floorBar = document.createElement('div'); floorBar.className = 'o3-floors';
  [[0, 'كل الأدوار'], [1, 'الدور 1'], [2, 'الدور 2'], [3, 'الدور 3'], [4, 'مكتب المديرة'], [5, 'المبنى الزجاجي']].forEach(function (p) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = p[1];
    b.title = p[0] === 5 ? 'كل الأدوار فوق بعض في مبنى زجاجي' : p[0] === 4 ? 'مكتب المديرة لوحدها، معزول عن الموظفين' : p[0] === 1 ? 'الترند، الفيديو' : p[0] === 2 ? 'المحتوى، جيسيكا' : p[0] === 3 ? 'السيو، الأدوات، الإيميل، المراجعة' : 'كل الأقسام';
    b.addEventListener('click', function () { userTouch(); setCamMode('free'); setFloor(p[0]); floorCap.textContent = p[0] ? b.title : ''; });
    floorBtns[p[0]] = b; floorBar.appendChild(b);
  });
  // ---------- live roster panel ----------
  var rosterBtn = document.createElement('button'); rosterBtn.type = 'button'; rosterBtn.className = 'o3-sound'; rosterBtn.textContent = '👥'; rosterBtn.setAttribute('aria-label', 'مين شغال دلوقتي'); rosterBtn.style.cssText = 'position:absolute;top:60px;left:12px;z-index:6;';
  var rosterPanel = document.createElement('div'); rosterPanel.style.cssText = 'position:absolute;top:100px;left:12px;z-index:7;width:230px;max-height:55%;overflow:auto;background:rgba(14,20,34,.92);color:#fff;border-radius:12px;padding:8px;font-size:12px;direction:rtl;display:none;box-shadow:0 6px 24px rgba(0,0,0,.4)';
  var STAT = { running: ['شغال', '#3aa0ff'], waiting: ['مستني', '#f6c453'], done: ['خلّص', '#4ade80'], blocked: ['واقف', '#f87171'], unknown: ['مش شغال', '#9aa0aa'] };
  function renderRoster() {
    var ids = Object.keys(people).filter(function (i) { return people[i].nameText; });
    var cnt = { running: 0, waiting: 0, done: 0, blocked: 0, unknown: 0 };
    var rows = ids.map(function (i) { var r = people[i], st = STAT[r.state] ? r.state : 'unknown'; cnt[st]++; return { st: st, n: r.nameText, role: r.roleText || '' }; });
    var ord = { running: 0, waiting: 1, blocked: 2, done: 3, unknown: 4 };
    rows.sort(function (a, b) { return ord[a.st] - ord[b.st]; });
    var h = '<div style="font-weight:700;margin-bottom:6px">شغال ' + cnt.running + ' · مستني ' + cnt.waiting + ' · مش شغال ' + (cnt.unknown + cnt.done) + '</div>';
    rows.forEach(function (x) { h += '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-top:1px solid rgba(255,255,255,.08)"><span style="width:8px;height:8px;border-radius:50%;background:' + STAT[x.st][1] + ';flex:none"></span><b>' + x.n.replace(/</g, '') + '</b><span style="opacity:.65;flex:1">' + x.role.replace(/</g, '') + '</span><span style="color:' + STAT[x.st][1] + '">' + STAT[x.st][0] + '</span></div>'; });
    rosterPanel.innerHTML = h;
  }
  var rosterTimer = 0;
  rosterBtn.addEventListener('click', function () { var on = rosterPanel.style.display === 'none'; rosterPanel.style.display = on ? 'block' : 'none'; clearInterval(rosterTimer); if (on) { renderRoster(); rosterTimer = setInterval(renderRoster, 1500); } });
  (host.querySelector('.o3-stage') || host).appendChild(rosterBtn); (host.querySelector('.o3-stage') || host).appendChild(rosterPanel);
  window.__o3Roster = function () { rosterBtn.click(); };
  var floorCap = document.createElement('span'); floorCap.className = 'o3-floor-cap'; floorBar.appendChild(floorCap);
  floorBtns[0].classList.add('on');
  (host.querySelector('.o3-stage') || host).appendChild(floorBar);
  var floorTog = document.createElement('button'); floorTog.type = 'button'; floorTog.className = 'o3-floors-toggle'; floorTog.textContent = 'الأدوار ▾'; floorTog.setAttribute('aria-expanded', 'false');
  (host.querySelector('.o3-stage') || host).appendChild(floorTog);
  var phoneMQ = window.matchMedia ? window.matchMedia('(max-width: 600px)') : { matches: false };
  function syncFloorMenu(open) { var closed = phoneMQ.matches && !open; floorBar.classList.toggle('is-closed', closed); floorTog.setAttribute('aria-expanded', open ? 'true' : 'false'); floorTog.textContent = open ? 'الأدوار ▴' : 'الأدوار ▾'; }
  floorTog.addEventListener('click', function () { syncFloorMenu(floorBar.classList.contains('is-closed')); });
  floorBar.addEventListener('click', function (e) { if (phoneMQ.matches && e.target && e.target.tagName === 'BUTTON') { setTimeout(function () { syncFloorMenu(false); }, 60); } });
  syncFloorMenu(false);
  camBtns.free.classList.add('on');
  (host.querySelector('.o3-stage') || host).appendChild(camBar);
  syncViewBtn();
  (host.querySelector('.o3-stage') || host).appendChild(viewBtn);

  window.__o3dbg = { people: people, charTpl: charTpl };
  initCharacters();
  window.Office3D = { ready: true, setFloor: setFloor, update: safeUpdate, walk: walk, flyTo: flyTo, focus: function (id) { var z = zoneInfo[id]; if (z) { flyTo(new THREE.Vector3(z.cx, 0, z.cz), id === 'qa' ? 1.7 : 2.4); } } };
  if (hint) { hint.hidden = false; }
})();
