(function () {
  var g = (typeof api !== 'undefined' && api.game) ? api.game : null;
  if (!g) { console.error('[Portal Gun] api.game indisponível — atualize o Limiar Mod Manager.'); return; }

  var S = { enabled: true, solid: true, view: true };
  var PW = 1.5, PH = 2.3, HALF_W = 0.75, HALF_H = 1.15, OUT_MIN = 0.3, WRAP = Math.PI * 2;
  var YS = PH / PW;

  var VERT = 'varying vec3 vWorld; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }';
  var FRAG = 'precision mediump float; varying vec3 vWorld; uniform sampler2D tView; uniform mat4 uHProj; void main(){ vec4 h = uHProj * vec4(vWorld, 1.0); vec2 tUV = h.xy / max(0.0001, h.w) * 0.5 + 0.5; vec3 col = texture2D(tView, clamp(tUV, 0.02, 0.98)).rgb; gl_FragColor = vec4(col, 1.0); }';

  var st = {
    ready: false, gun: null, core: null, coreLast: 0,
    portals: null, discs: null, mats: null, paint: null, meta: null, rts: null, cams: null,
    prev: { blue: null, orange: null }, cool: 0, frame: 0, linked: false,
    btnWrap: null, btnBlue: null, btnOrange: null, btnB: null, btnO: null, apiButtons: false,
    ac: null, last: 'blue', recoil: 0, lastT: 0, spawn: null, skip: null,
    tv: null, tn: null, tt: null, tq: null, ts: null, tM: null, tM2: null, tFlip: null, tPlane: null, tRoot: null
  };

  api.register({
    id: 'portalGun',
    name: 'Portal Gun',
    version: '2.0.0',
    description: 'Arma de portais 3D: dispare um projétil de energia e um portal de verdade (objeto 3D colorido) abre onde ele acertar a parede, com visão em tempo real através dos portais. PC: clique esquerdo atira o portal azul, direito o laranja (mira travada). Celular: botões redondos AZUL e LARANJA na lateral direita. Atravesse um portal para sair pelo outro.',
    settings: [
      { id: 'enabled', label: 'Arma e portais ativos', type: 'toggle', default: false },
      { id: 'solid', label: 'Teleporte ao atravessar um portal', type: 'toggle', default: true },
      { id: 'view', label: 'Visão em tempo real através dos portais', type: 'toggle', default: true },
      { id: 'collapse', label: 'Fechar os dois portais', type: 'button' }
    ],
    onChange: function (v) {
      S.enabled = v.enabled !== false;
      S.solid = v.solid !== false;
      S.view = v.view !== false;
      if (!S.enabled) collapse();
    },
    onAction: function (a) { if (a === 'collapse') collapse(); }
  });

  function collapse() {
    st.prev.blue = null; st.prev.orange = null;
    if (st.portals) {
      if (st.portals.blue) st.portals.blue.visible = false;
      if (st.portals.orange) st.portals.orange.visible = false;
    }
  }

  function toast(msg) { if (typeof g.toast === 'function') g.toast(msg); }

  function dot(a, x, y, z) { return a.x * x + a.y * y + a.z * z; }

  function colorOf(name) { return name === 'blue' ? 0x3fa9ff : 0xff9a3c; }

  var poll = null;

  function setup() {
    if (st.ready) return;
    var T = window.THREE;
    if (!T) return;
    st.T = T;
    var fx = g.Gfx;
    st.skip = [];

    st.tRoot = new T.Matrix4(); st.tM = new T.Matrix4(); st.tM2 = new T.Matrix4();
    st.tFlip = new T.Matrix4().makeRotationY(Math.PI); st.tPlane = new T.Plane();
    st.tv = new T.Vector3(); st.tn = new T.Vector3(); st.tt = new T.Vector3();
    st.tq = new T.Quaternion(); st.ts = new T.Vector3(1, 1, 1);

    st.portals = { blue: null, orange: null };
    st.discs = { blue: null, orange: null };
    st.mats = { blue: null, orange: null };
    st.paint = { blue: null, orange: null };
    st.meta = { blue: null, orange: null };
    st.rts = { blue: makeRT(), orange: makeRT() };
    st.cams = { blue: new T.PerspectiveCamera(70, 1, 0.12, 2600), orange: new T.PerspectiveCamera(70, 1, 0.12, 2600) };

    ['blue', 'orange'].forEach(function (name) {
      var color = colorOf(name);
      st.mats[name] = new T.ShaderMaterial({
        uniforms: {
          tView: { value: st.rts[name].texture },
          uHProj: { value: new T.Matrix4() }
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: false, side: T.FrontSide, depthWrite: true
      });
      st.paint[name] = new T.MeshBasicMaterial({ map: swirlTexture(color), side: T.DoubleSide });
      var ringMat = new T.MeshBasicMaterial({ color: color, side: T.DoubleSide });
      var ring = new T.Mesh(new T.RingGeometry(0.70, 0.86, 48), ringMat);
      ring.scale.set(1, YS, 1);
      ring.position.z = 0.006;
      var disc = new T.Mesh(new T.CircleGeometry(0.75, 40), st.paint[name]);
      disc.scale.set(1, YS, 1);
      var grp = new T.Group();
      grp.add(disc);
      grp.add(ring);
      grp.visible = false;
      grp.frustumCulled = false;
      st.portals[name] = grp;
      st.discs[name] = disc;
      fx.scene.add(grp);
      if (api.fx && api.fx.exclude) api.fx.exclude(grp);
      st.skip.push(grp);
    });

    buildGun(T);
    if (api.fx && api.fx.exclude) api.fx.exclude(st.gun);
    wireInput(T);
    buildTouchUI();
    st.spawn = { blue: 0, orange: 0 };
    st.ready = true;
    g.onRender(frameHook);
    g.onPhysics(physicsTick);
  }

  function makeRT() {
    var fx = g.Gfx, T = window.THREE;
    var tw = Math.max(160, Math.floor((fx.width || 960) * 0.5));
    var th = Math.max(120, Math.floor((fx.height || 540) * 0.5));
    if (g.G.touch && tw > 640) { th = Math.floor(th * 640 / tw); tw = 640; }
    return new T.WebGLRenderTarget(tw, th, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, type: T.UnsignedByteType, depthBuffer: true, stencilBuffer: false });
  }

  function cssColor(color, a) {
    var T = st.T;
    var c = new T.Color(color);
    var r = Math.round(Math.max(0, Math.min(1, c.r)) * 255);
    var gg = Math.round(Math.max(0, Math.min(1, c.g)) * 255);
    var b = Math.round(Math.max(0, Math.min(1, c.b)) * 255);
    return 'rgba(' + r + ',' + gg + ',' + b + ',' + a + ')';
  }

  function swirlTexture(color) {
    var T = st.T;
    var canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 384;
    var ctx = canvas.getContext('2d');
    var cx = 128, cy = 192;
    var grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 175);
    grad.addColorStop(0, 'rgba(255,255,255,0.30)');
    grad.addColorStop(0.42, cssColor(color, 0.34));
    grad.addColorStop(1, cssColor(color, 0.02));
    ctx.fillStyle = 'rgb(8, 10, 15)';
    ctx.fillRect(0, 0, 256, 384);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 384);
    ctx.strokeStyle = cssColor(color, 0.5);
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    var s;
    for (s = 0; s < 5; s++) {
      ctx.beginPath();
      var r0 = 26 + s * 34;
      ctx.arc(cx, cy, r0, s * 1.3, s * 1.3 + Math.PI * 1.35);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 200, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb(8, 10, 15)';
    ctx.arc(cx, cy, 172, 0, Math.PI * 2, true);
    ctx.fill();
    return new T.CanvasTexture(canvas);
  }

  function buildGun(T) {
    var fx = g.Gfx;
    var grp = new T.Group();
    var white = new T.MeshLambertMaterial({ color: 0xd9d4c8 });
    var dark = new T.MeshLambertMaterial({ color: 0x24272d });
    var glowMat = new T.MeshBasicMaterial({ color: 0x3fa9ff });

    var body = new T.Mesh(new T.CylinderGeometry(0.07, 0.095, 0.55, 18), white);
    body.rotation.x = -Math.PI / 2;
    body.position.z = -0.08;
    grp.add(body);

    var rear = new T.Mesh(new T.SphereGeometry(0.11, 16, 12), dark);
    rear.position.z = 0.16;
    grp.add(rear);

    var grip = new T.Mesh(new T.BoxGeometry(0.075, 0.22, 0.1), dark);
    grip.position.set(0, -0.17, 0.05);
    grip.rotation.x = 0.35;
    grp.add(grip);

    var ring = new T.Mesh(new T.TorusGeometry(0.082, 0.017, 8, 20), white);
    ring.position.z = -0.3;
    grp.add(ring);

    var core = new T.Mesh(new T.SphereGeometry(0.05, 12, 10), glowMat);
    core.position.z = -0.14;
    grp.add(core);
    st.core = core;

    for (var i = 0; i < 3; i++) {
      var holder = new T.Group();
      var prong = new T.Mesh(new T.CylinderGeometry(0.009, 0.011, 0.42, 8), dark);
      prong.rotation.x = -Math.PI / 2;
      holder.add(prong);
      holder.position.y = 0.085;
      holder.rotation.z = (i / 3) * Math.PI * 2;
      holder.position.z = -0.28;
      grp.add(holder);
    }

    grp.position.set(0.3, -0.27, -0.5);
    grp.rotation.y = -0.07;
    grp.scale.setScalar(0.9);
    grp.visible = false;
    fx.camera.add(grp);
    st.gun = grp;
    st.skip.push(grp);
  }

  function shoot(name) {
    if (!st.ready || !S.enabled || g.Game.state !== 'playing') return;
    var color = colorOf(name);
    st.last = name;
    st.recoil = 1;
    blip(name);
    if (typeof api.fx === 'object' && api.fx && api.fx.spawnProjectile) {
      var T = window.THREE, fx = g.Gfx, P = g.P;
      var dir = new T.Vector3(0, 0, -1).applyQuaternion(fx.camera.quaternion);
      var origin = new T.Vector3(P.x, P.eyeY, P.z).add(dir.clone().multiplyScalar(0.55));
      api.fx.spawnProjectile({
        mesh: buildBullet(color),
        position: { x: origin.x, y: origin.y, z: origin.z },
        dir: { x: dir.x, y: dir.y, z: dir.z },
        speed: 25,
        gravity: 3,
        ttl: 1.7,
        onHit: function (hit) {
          if (!hit || !hit.normal || Math.abs(hit.normal.y) > 0.55 || !st.meta) return;
          placePortal(name, { point: hit.point, n: hit.normal });
          toneHit();
        }
      });
      return;
    }
    var hit = findSurface();
    if (hit) { placePortal(name, hit); toneHit(); }
    else toast('Sem superfície válida próxima para abrir o portal.');
  }

  function buildBullet(color) {
    var T = window.THREE;
    var grp = new T.Group();
    var core = new T.Mesh(new T.SphereGeometry(0.075, 12, 10), new T.MeshBasicMaterial({ color: color }));
    grp.add(core);
    var halo = new T.Mesh(new T.SphereGeometry(0.16, 12, 10), new T.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.28, depthWrite: false }));
    grp.add(halo);
    if (!g.G.touch) grp.add(new T.PointLight(color, 1.4, 8, 2));
    return grp;
  }

  function toneHit() {
    if (typeof api.fx === 'object' && api.fx.sound && api.fx.sound.tone) api.fx.sound.tone({ freq: 300, freq2: 560, dur: 0.1, gain: 0.1, type: 'sine' });
    else blipLow();
  }

  function findSurface() {
    var T = window.THREE, fx = g.Gfx, P = g.P;
    if (!fx.camera) return null;
    var origin = new T.Vector3(P.x, P.eyeY, P.z);
    var dir = new T.Vector3(0, 0, -1).applyQuaternion(fx.camera.quaternion);
    var ray = new T.Raycaster(origin, dir, 0.05, 60);
    var hits = ray.intersectObjects(fx.scene.children, true);
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i], o = h.object;
      if (!o.visible || !o.isMesh || !o.geometry) continue;
      if (st.skip.indexOf(o) !== -1) continue;
      if (!h.face) continue;
      var nm = new T.Matrix3().getNormalMatrix(o.matrixWorld);
      var n = h.face.normal.clone().applyMatrix3(nm).normalize();
      if (Math.abs(n.y) > 0.55) continue;
      return { point: h.point, n: n };
    }
    return null;
  }

  function placePortal(name, hit) {
    var T = window.THREE, P = g.P;
    var n = hit.n, up = new T.Vector3(0, 1, 0);
    var tRaw = new T.Vector3().crossVectors(up, n);
    if (!isFinite(tRaw.x) || tRaw.lengthSq() < 0.25) { toast('Superfície inválida para portais.'); return; }
    var t = tRaw.normalize();
    var ground = g.World.col.ground(hit.point.x, hit.point.z, hit.point.y + 1.0, 0.2);
    var cy = ground > -Infinity ? Math.min(hit.point.y, ground + HALF_H) : hit.point.y;
    if (ground > -Infinity && cy - HALF_H < ground - 0.05) cy = ground + HALF_H;
    var c = new T.Vector3(hit.point.x + n.x * 0.05, cy, hit.point.z + n.z * 0.05);
    var basis = new T.Matrix4().makeBasis(t, up, n);
    var q = new T.Quaternion().setFromRotationMatrix(basis);
    var grp = st.portals[name];
    grp.position.copy(c);
    grp.quaternion.copy(q);
    grp.visible = true;
    st.meta[name] = { basis: basis.clone(), c: c.clone(), n: n.clone(), t: t.clone(), alpha: Math.atan2(n.x, n.z) };
    st.spawn[name] = 0;
    st.prev[name] = null;
  }

  function frameHook() {
    if (!st.ready) return;
    var G = g.G, fx = g.Gfx, P = g.P, Game = g.Game;
    var now = performance.now() / 1000;
    var dt = st.lastT ? Math.min(0.1, now - st.lastT) : 0.016;
    st.lastT = now;

    var visible = S.enabled && (Game.state === 'playing' || Game.state === 'paused');
    if (st.gun) {
      st.gun.visible = visible;
      if (visible) {
        var bob = Math.min(1, (P.speed || 0) / 2.35);
        st.recoil = Math.max(0, st.recoil - dt * 5);
        var rec = st.recoil * st.recoil;
        st.gun.position.set(0.3, -0.27 + Math.sin(now * 8.5) * 0.014 * (0.3 + 0.7 * bob) + rec * 0.06, -0.5 + rec * 0.09);
        st.gun.rotation.x = -(bob * (P.grounded ? Math.sin(now * 17) : 0) * 0.02) - rec * 0.18;
        var pulse = 1 + 0.14 * Math.sin(now * 6) + st.recoil * 0.25;
        if (st.core) {
          st.core.scale.setScalar(pulse);
          var c = colorOf(st.last);
          if (st.coreLast !== c) { st.core.material.color.setHex(c); st.coreLast = c; }
        }
      }
    }

    updateTouch();

    var both = st.portals && st.portals.blue && st.portals.blue.visible && st.portals.orange && st.portals.orange.visible;
    var linked = S.enabled && S.view && both && (Game.state === 'playing' || Game.state === 'paused');
    st.linked = linked;

    if (st.portals) {
      ['blue', 'orange'].forEach(function (name) {
        var grp = st.portals[name];
        if (!grp || !grp.visible) return;
        st.discs[name].material = linked ? st.mats[name] : st.paint[name];
        st.spawn[name] = Math.min(1, st.spawn[name] + dt * 7);
        var s = 0.2 + 0.8 * (1 - Math.pow(1 - st.spawn[name], 3));
        grp.scale.setScalar(s);
      });
    }

    if (linked) renderPortalViews();
  }

  function renderPortalViews() {
    var T = window.THREE, fx = g.Gfx, r = fx.renderer, C = fx.camera;
    if (!r || !C) return;
    st.frame++;
    if (g.G.touch && (st.frame % 2 === 1)) return;

    drawView('blue', 'orange');
    drawView('orange', 'blue');
  }

  function drawView(srcName, dstName) {
    var T = window.THREE, fx = g.Gfx, r = fx.renderer, C = fx.camera;
    var srcGrp = st.portals[srcName], dstGrp = st.portals[dstName];
    var src = st.meta[srcName], dst = st.meta[dstName];
    if (!src || !dst) return;
    srcGrp.updateMatrixWorld(true);

    var mt = srcGrp.matrixWorld.clone().invert();
    st.tM.copy(dst.basis).multiply(st.tFlip).multiply(mt);
    st.tRoot.copy(C.matrixWorld).multiply(st.tM);
    st.tRoot.decompose(st.tv, st.tq, st.ts);

    var vcam = st.cams[srcName];
    vcam.position.copy(st.tv);
    vcam.quaternion.copy(st.tq);
    vcam.updateMatrixWorld(true);
    vcam.matrixWorldInverse.copy(vcam.matrixWorld).invert();
    vcam.projectionMatrix.copy(C.projectionMatrix);

    st.tPlane.setFromNormalAndCoplanarPoint(dst.n, st.tv.set(dst.c.x + dst.n.x * 0.02, dst.c.y + dst.n.y * 0.02, dst.c.z + dst.n.z * 0.02));
    obliqueClip(vcam, st.tPlane);

    r.shadowMap.autoUpdate = false;
    dstGrp.visible = false;
    r.setRenderTarget(st.rts[srcName]);
    r.render(fx.scene, vcam);
    r.setRenderTarget(null);
    dstGrp.visible = true;
    r.shadowMap.autoUpdate = true;

    st.mats[srcName].uniforms.uHProj.value.copy(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse);
  }

  function obliqueClip(cam, plane) {
    var T = window.THREE;
    var cp = st.tPlane.clone();
    cp.applyMatrix4(cam.matrixWorldInverse);
    var v4 = new T.Vector4(cp.normal.x, cp.normal.y, cp.normal.z, cp.constant);
    var m = cam.projectionMatrix;
    var q = new T.Vector4();
    q.x = (Math.sign(v4.x) + m.elements[8]) / m.elements[0];
    q.y = (Math.sign(v4.y) + m.elements[9]) / m.elements[5];
    q.z = -1.0;
    q.w = (1.0 + m.elements[10]) / m.elements[14];
    var d = v4.x * q.x + v4.y * q.y + v4.z * q.z + v4.w * q.w;
    if (Math.abs(d) > 1e-8) v4.multiplyScalar(2.0 / d);
    m.elements[2] = v4.x;
    m.elements[6] = v4.y;
    m.elements[10] = v4.z + 1.0;
    m.elements[14] = v4.w;
  }

  function physicsTick(h) {
    if (st.cool > 0) { st.cool -= h; return; }
    if (!st.ready || !S.enabled || !S.solid) { st.prev.blue = null; st.prev.orange = null; return; }
    if (g.Game.state !== 'playing') { st.prev.blue = null; st.prev.orange = null; return; }
    var P = g.P;
    if (!st.portals || !st.portals.blue.visible || !st.portals.orange.visible || !st.meta || !st.meta.blue || !st.meta.orange) {
      st.prev.blue = null; st.prev.orange = null; return;
    }
    travel('blue');
    travel('orange');
  }

  function travel(name) {
    var P = g.P, m = st.meta[name];
    var ex = P.x, ey = P.eyeY, ez = P.z;
    var dx = ex - m.c.x, dy = ey - m.c.y, dz = ez - m.c.z;
    var d = dot(m.n, dx, dy, dz);
    var lat = dot(m.t, dx, dy, dz);
    var ver = dy;
    var prev = st.prev[name];
    st.prev[name] = { d: d };
    if (!prev) return;
    var lateralOK = Math.abs(lat) < HALF_W - 0.18;
    var verticalOK = ver > -HALF_H + 0.1 && ver < HALF_H - 0.05;
    if (prev.d > 0.001 && d <= 0.001 && lateralOK && verticalOK) {
      var other = st.meta[name === 'blue' ? 'orange' : 'blue'];
      crossInto(m, other);
      st.cool = 0.35;
      st.prev.blue = null; st.prev.orange = null;
      blipLow();
    }
  }

  function crossInto(p, q) {
    var P = g.P;
    var ex = P.x, ey = P.eyeY, ez = P.z;
    var dx = ex - p.c.x, dy = ey - p.c.y, dz = ez - p.c.z;
    var dIn = dot(p.n, dx, dy, dz);
    if (dIn < -1) return;
    var lat = dot(p.t, dx, dy, dz);
    var ver = dy;
    lat = Math.max(-0.55, Math.min(0.55, lat));
    ver = Math.max(-1.05, Math.min(1.05, ver));
    var out = Math.max(Math.abs(dIn) * 0.5 + 0.12, OUT_MIN);
    var eyeX = q.c.x + q.n.x * out + q.t.x * (-lat);
    var eyeY = q.c.y + ver;
    var eyeZ = q.c.z + q.n.z * out + q.t.z * (-lat);
    var relH = ey - P.y;
    P.x = eyeX; P.z = eyeZ; P.y = eyeY - relH;
    var delta = (q.alpha + Math.PI) - p.alpha;
    P.yaw += delta;
    if (Math.abs(P.yaw) > 64) P.yaw -= Math.floor(P.yaw / WRAP) * WRAP;
    var cosd = Math.cos(delta), sind = Math.sin(delta);
    var vx = P.vx, vz = P.vz;
    P.vx = vx * cosd + vz * sind;
    P.vz = -vx * sind + vz * cosd;
    var ground = g.World.col.ground(P.x, P.z, P.y, 0.32);
    if (ground > -Infinity && P.y <= ground) { P.y = ground; P.vy = 0; P.grounded = true; }
    else P.grounded = false;
    P.speed = Math.hypot(P.vx, P.vz);
    P.eyeY = P.y + relH;
    P.safe = { x: P.x, y: P.y, z: P.z }; P.safeT = 0;
  }

  function blip(name) {
    try {
      st.ac = st.ac || new (window.AudioContext || window.webkitAudioContext)();
      var o = st.ac.createOscillator(), v = st.ac.createGain(), now = st.ac.currentTime;
      o.type = 'sine';
      o.frequency.setValueAtTime(name === 'blue' ? 620 : 460, now);
      o.frequency.exponentialRampToValueAtTime(name === 'blue' ? 980 : 740, now + 0.09);
      v.gain.setValueAtTime(0.14, now);
      v.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      o.connect(v); v.connect(st.ac.destination);
      o.start(now); o.stop(now + 0.17);
    } catch (e) {}
  }

  function blipLow() {
    try {
      st.ac = st.ac || new (window.AudioContext || window.webkitAudioContext)();
      var o = st.ac.createOscillator(), v = st.ac.createGain(), now = st.ac.currentTime;
      o.type = 'triangle';
      o.frequency.setValueAtTime(330, now);
      o.frequency.exponentialRampToValueAtTime(180, now + 0.12);
      v.gain.setValueAtTime(0.09, now);
      v.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      o.connect(v); v.connect(st.ac.destination);
      o.start(now); o.stop(now + 0.19);
    } catch (e) {}
  }

  function wireInput(T) {
    document.addEventListener('mousedown', function (e) {
      if (!st.ready || !S.enabled) return;
      if (g.Game.state !== 'playing') return;
      if (!g.IN.locked && !g.IN.drag) return;
      if (e.button === 2) { e.preventDefault(); shoot('orange'); }
      else if (e.button === 0) { shoot('blue'); }
    }, true);
    document.addEventListener('contextmenu', function (e) {
      if (st.ready && S.enabled && g.Game.state === 'playing' && (g.IN.locked || g.IN.drag)) e.preventDefault();
    });
  }

  function buildTouchUI() {
    if (typeof api.fx === 'object' && api.fx && api.fx.hud && api.fx.hud.touchButton) {
      st.apiButtons = true;
      st.btnB = api.fx.hud.touchButton({ label: 'AZUL', light: '#9adcff', base: '#1e6bd8', onTap: function () { shoot('blue'); } });
      st.btnO = api.fx.hud.touchButton({ label: 'LARANJA', light: '#ffd29a', base: '#d86a1e', onTap: function () { shoot('orange'); } });
      return;
    }
    legacyTouchUI();
  }

  function legacyTouchUI() {
    if (st.btnWrap) return;
    var css = '.pg-touch{position:fixed;right:12px;top:34%;z-index:9210;display:none;flex-direction:column;gap:14px;pointer-events:none}' +
      '.pg-touch.show{display:flex}' +
      '.pg-btn{pointer-events:auto;width:66px;height:66px;border-radius:50%;border:2px solid rgba(255,255,255,.75);color:#fff;font:bold 11px/64px sans-serif;text-align:center;opacity:.9;box-shadow:0 4px 14px rgba(0,0,0,.5);user-select:none;-webkit-user-select:none;touch-action:manipulation;cursor:pointer}' +
      '.pg-btn.blue{background:radial-gradient(circle at 32% 30%, #9adcff, #1e6bd8 70%)}' +
      '.pg-btn.orange{background:radial-gradient(circle at 32% 30%, #ffd29a, #d86a1e 70%)}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var wrap = document.createElement('div');
    wrap.className = 'pg-touch';
    var b1 = document.createElement('div');
    b1.className = 'pg-btn blue';
    b1.textContent = 'AZUL';
    var b2 = document.createElement('div');
    b2.className = 'pg-btn orange';
    b2.textContent = 'LARANJA';
    b1.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); shoot('blue'); });
    b2.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); shoot('orange'); });
    wrap.appendChild(b1); wrap.appendChild(b2);
    document.body.appendChild(wrap);
    st.btnWrap = wrap; st.btnBlue = b1; st.btnOrange = b2;
  }

  function updateTouch() {
    var show = S.enabled && g.G.touch && g.Game.state === 'playing';
    if (st.apiButtons) {
      if (st.btnB) { if (show) st.btnB.show(); else st.btnB.hide(); }
      if (st.btnO) { if (show) st.btnO.show(); else st.btnO.hide(); }
      return;
    }
    if (st.btnWrap) st.btnWrap.classList.toggle('show', show);
  }

  poll = setInterval(function () {
    var fx = g.Gfx;
    if (!fx || !fx.renderer || !fx.scene || !fx.camera || !window.THREE || !g.G || !g.World || !g.World.col) return;
    clearInterval(poll);
    poll = null;
    try { setup(); }
    catch (err) { console.error('[Portal Gun] falha ao inicializar: ' + (err && err.message ? err.message : err)); }
  }, 250);
})();
