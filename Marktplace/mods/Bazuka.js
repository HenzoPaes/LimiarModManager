(function () {
  var g = (typeof api !== 'undefined' && api.game) ? api.game : null;
  if (!g) { console.error('[Bazuka] api.game indisponível — atualize o Limiar Mod Manager.'); return; }

  var S = { enabled: true, breakWalls: true, radius: 3.2, cooldown: 0.9 };
  var st = {
    ready: false, gun: null, muzzle: null, flash: null, flashLight: null, cdLight: null,
    item: null, selected: false, cd: 0, pinged: false,
    recoil: 0, lastT: 0, rocket: null, wakeAcc: 0, efx: [], samples: [],
    fallback: false, fallbackWait: 0
  };
  function clampv(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  api.register({
    id: 'bazuka',
    name: 'Bazuka',
    version: '1.0.0',
    depends: ['HotbarAPI'],
    description: 'Bazuka DESTRUTORA: dispara um foguete ultrarrápido que ABRE BURACOS REAIS nas paredes (remove a colisão e afunda a geometria do mundo), solta destroços voando, flash, bola de fogo, onda de choque, fumaça, faíscas e boom pesado. Item da HotbarAPI: teclas 1-8/toque selecionam, clique esquerdo (mira travada) ou botão USAR dispara.',
    settings: [
      { id: 'enabled', label: 'Bazuka disponível', type: 'toggle', default: true },
      { id: 'breakWalls', label: 'Rompimento real: abrir buraco nas paredes e jogar destroços', type: 'toggle', default: true },
      { id: 'radius', label: 'Raio do rompimento (m)', type: 'number', default: 3.2, min: 1.2, max: 8, step: 0.1 },
      { id: 'cooldown', label: 'Intervalo entre tiros (s)', type: 'number', default: 0.9, min: 0.15, max: 4, step: 0.05 }
    ],
    onChange: function (v) {
      S.enabled = v.enabled !== false;
      S.breakWalls = v.breakWalls !== false;
      S.radius = clampv(Number(v.radius) || 3.2, 1.2, 8);
      S.cooldown = clampv(Number(v.cooldown) || 0.9, 0.15, 4);
      if (!S.enabled && st.fallback) { st.selected = false; if (st.gun) st.gun.visible = false; }
      else if (S.enabled && st.fallback) { st.selected = true; if (st.gun) st.gun.visible = true; }
    }
  });

  function toast(msg) { if (typeof g.toast === 'function') g.toast(msg); }
  function fx() { return (typeof api.fx === 'object' && api.fx) ? api.fx : null; }
  function snd(fn) { var s = fx() && fx().sound; if (!s) return; try { fn.call(s); } catch (e) {} }

  function setupHotbarRegistration() {
    if (!st.ready) return;
    if (S.enabled && !st.item) {
      st.item = (window.LimiarHotbar || {}).register ? window.LimiarHotbar.register({
        id: 'bazuka',
        icon: '🚀',
        label: 'Bazuka',
        color: '#c7742a',
        onSelect: function () {
          st.selected = true;
          if (st.fallback) st.fallback = false;
          if (st.gun) st.gun.visible = true;
          var n = slotNumber();
          toast('Bazuka no ombro' + (n ? ' (tecla ' + n + ')' : '') + '. Clique esquerdo ou USAR para DEMOLIR.');
        },
        onDeselect: function () { st.selected = false; if (st.gun) st.gun.visible = false; },
        onUse: shoot
      }) : null;
      if (st.item && st.fallback) st.fallback = false;
    } else if (!S.enabled && st.item !== null) {
      try { st.item.remove(); } catch (e) {}
      st.item = null;
      st.selected = false;
      if (st.gun) st.gun.visible = false;
    }
  }

  function slotNumber() {
    try {
      var items = window.LimiarHotbar && window.LimiarHotbar.items;
      if (!items) return 0;
      var i = 0;
      while (i < items.length && items[i].id !== 'bazuka') i++;
      return items[i] ? i + 1 : 0;
    } catch (e) { return 0; }
  }

  function fallbackFire(ev) {
    if (!st.fallback) return;
    if (ev.button !== 0) return;
    if (!st.ready || !S.enabled || g.Game.state !== 'playing') return;
    ev.preventDefault();
    ev.stopPropagation();
    shoot();
  }

  function hookHotbar() {
    var timer = setInterval(function () {
      if (typeof window.LimiarHotbar !== 'undefined' && window.LimiarHotbar.register) {
        clearInterval(timer);
        st.ready = true;
        setupHotbarRegistration();
        return;
      }
      if (st.fallback) return;
      st.fallbackWait++;
      if (st.fallbackWait > 60) {
        st.fallback = true;
        st.ready = true;
        st.selected = true;
        if (st.gun) st.gun.visible = true;
        document.addEventListener('mousedown', fallbackFire, true);
        console.warn('[Bazuka] HotbarAPI não encontrada — modo direto: clique esquerdo dispara.');
        toast('HotbarAPI não está ativa: Bazuka AUTO-equipada. Clique esquerdo dispara.');
      }
    }, 250);
  }

  function buildLauncher(T) {
    var grp = new T.Group();
    var shell = new T.MeshLambertMaterial({ color: 0x4b5738 });
    var shell2 = new T.MeshLambertMaterial({ color: 0x3b442c });
    var metal = new T.MeshLambertMaterial({ color: 0x23262b });
    var red = new T.MeshLambertMaterial({ color: 0x8a2f22 });

    var tube = new T.Mesh(new T.CylinderGeometry(0.085, 0.085, 0.95, 14), shell);
    tube.rotation.x = Math.PI / 2;
    tube.position.z = -0.12;
    grp.add(tube);

    var bell = new T.Mesh(new T.CylinderGeometry(0.105, 0.09, 0.16, 14), shell2);
    bell.rotation.x = Math.PI / 2;
    bell.position.z = -0.6;
    grp.add(bell);

    var mouth = new T.Mesh(new T.CylinderGeometry(0.085, 0.085, 0.05, 12), metal);
    mouth.rotation.x = Math.PI / 2;
    mouth.position.z = -0.68;
    grp.add(mouth);

    var exhaust = new T.Mesh(new T.CylinderGeometry(0.07, 0.1, 0.18, 12), shell2);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.z = 0.42;
    grp.add(exhaust);

    var stripe = new T.Mesh(new T.TorusGeometry(0.087, 0.011, 6, 16), red);
    stripe.position.z = -0.34;
    grp.add(stripe);

    var grip = new T.Mesh(new T.BoxGeometry(0.05, 0.2, 0.07), shell2);
    grip.position.set(0, -0.15, -0.14);
    grip.rotation.x = 0.3;
    grp.add(grip);

    var guard = new T.Mesh(new T.TorusGeometry(0.04, 0.011, 6, 12), metal);
    guard.position.set(0, -0.2, -0.05);
    guard.rotation.x = Math.PI / 2;
    grp.add(guard);

    var pad = new T.Mesh(new T.BoxGeometry(0.08, 0.22, 0.08), shell2);
    pad.position.set(0, -0.06, 0.3);
    grp.add(pad);

    var sight = new T.Mesh(new T.BoxGeometry(0.035, 0.09, 0.14), metal);
    sight.position.set(0, 0.12, -0.1);
    grp.add(sight);

    var lens = new T.Mesh(new T.TorusGeometry(0.028, 0.008, 6, 14), metal);
    lens.position.set(0, 0.175, -0.17);
    grp.add(lens);

    st.cdLight = new T.Mesh(new T.SphereGeometry(0.022, 8, 6), new T.MeshBasicMaterial({ color: 0x74ff6e }));
    st.cdLight.position.set(0.09, 0.06, 0.2);
    grp.add(st.cdLight);

    st.flash = new T.Mesh(new T.SphereGeometry(0.16, 10, 8), new T.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0, depthWrite: false }));
    st.flash.position.set(0, 0, -0.74);
    grp.add(st.flash);
    if (!g.G.touch) {
      st.flashLight = new T.PointLight(0xffcf8a, 0, 7, 2);
      st.flashLight.position.set(0, 0.05, -0.7);
      grp.add(st.flashLight);
    } else st.flashLight = null;

    st.muzzle = new T.Object3D();
    st.muzzle.position.set(0, 0, -0.72);
    grp.add(st.muzzle);

    grp.position.set(0.37, -0.31, -0.58);
    grp.rotation.y = -0.05;
    grp.scale.setScalar(0.95);
    grp.visible = false;
    return grp;
  }

  function buildRocket(T) {
    var grp = new T.Group();
    var metal = new T.MeshLambertMaterial({ color: 0x3a3f33 });
    var tip = new T.MeshLambertMaterial({ color: 0x7a2a1e });
    var fire = new T.MeshBasicMaterial({ color: 0xffb254, transparent: true, opacity: 0.9, depthWrite: false });

    var body = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.3, 10), metal);
    body.rotation.x = -Math.PI / 2;
    grp.add(body);

    var head = new T.Mesh(new T.ConeGeometry(0.055, 0.14, 10), tip);
    head.rotation.x = -Math.PI / 2;
    head.position.z = -0.2;
    grp.add(head);

    for (var i = 0; i < 3; i++) {
      var holder = new T.Group();
      holder.rotation.z = (i / 3) * Math.PI * 2;
      var fin = new T.Mesh(new T.BoxGeometry(0.012, 0.07, 0.09), tip);
      fin.position.y = 0.07;
      holder.add(fin);
      holder.position.z = 0.14;
      grp.add(holder);
    }

    var glow = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), fire);
    glow.position.z = 0.24;
    grp.add(glow);
    if (!g.G.touch) grp.add(new T.PointLight(0xff9a3c, 0.9, 5, 2));

    return grp;
  }

  function shoot() {
    try { shootInner(); } catch (e) { console.error('[Bazuka] shoot err:', e && (e.stack || e.message || e)); }
  }
  function shootInner() {
    var F = fx();
    if (!st.ready || !S.enabled || !st.selected || g.Game.state !== 'playing' || !F || !F.spawnProjectile) return;
    if (st.cd > 0) return;
    var T = window.THREE, P = g.P;
    st.cd = S.cooldown;
    st.pinged = false;
    st.recoil = 1;

    if (st.flash) st.flash.material.opacity = 0.95;
    if (st.flashLight) st.flashLight.intensity = 2.6;
    setTimeout(function () {
      if (st.flash) st.flash.material.opacity = 0;
      if (st.flashLight) st.flashLight.intensity = 0;
    }, 90);

    snd(function () { this.noise({ freq: 1800, dur: 0.35, gain: 0.4 }); });
    snd(function () { this.tone({ freq: 220, freq2: 60, dur: 0.3, gain: 0.35, type: 'square' }); });

    muzzleSmoke();
    var dir = new T.Vector3(0, 0, -1).applyQuaternion(g.Gfx.camera.quaternion);
    P.vx -= dir.x * 1.7; P.vz -= dir.z * 1.7;

    var origin = new T.Vector3(P.x, P.eyeY - 0.05, P.z).add(dir.clone().multiplyScalar(0.85));
    st.rocket = { mesh: buildRocket(T), handle: null, alive: true, custom: null };

    var BC = (typeof window.LimiarBetterCollisions === 'object' && window.LimiarBetterCollisions) || (typeof window.BetterCollisionsAPI === 'object' && window.BetterCollisionsAPI) || null;
    if (BC && BC.cast && g.World && g.World.col) {
      var r = null;
      try { r = BC.cast(origin, dir, 350, { stepLen: 0.8 }); } catch (e) { r = null; }
      if (r && r.hit) {
        var tgt = new T.Vector3(r.point.x, r.point.y, r.point.z);
        st.rocket.custom = {
          dir: dir.clone().normalize(),
          vel: dir.clone().normalize().multiplyScalar(120),
          target: tgt,
          maxD: origin.distanceTo(tgt),
          traveled: 0,
          castRes: r
        };
      }
    }

    if (st.rocket.custom) {
      st.rocket.custom.ttl = Math.max(3, (st.rocket.custom.maxD / 120) + 1.2);
      g.Gfx.scene.add(st.rocket.mesh);
      st.rocket.mesh.position.copy(origin);
      return;
    }

    st.rocket.handle = F.spawnProjectile({
      mesh: st.rocket.mesh,
      position: { x: origin.x, y: origin.y, z: origin.z },
      dir: { x: dir.x, y: dir.y, z: dir.z },
      speed: 120,
      gravity: 0.2,
      ttl: 2.2,
      onHit: onRocketHit,
      onExpire: onRocketExpire
    });
  }

  function onRocketHit(hit) {
    if (st.rocket) st.rocket.alive = false;
    boomAt(hit);
  }

  function onRocketExpire() {
    if (!st.rocket || !st.rocket.alive) return;
    st.rocket.alive = false;
    var T = window.THREE;
    if (!T || !st.rocket.mesh) return;
    var p = st.rocket.mesh.position.clone();
    var d = st.rocket.handle && st.rocket.handle.dir ? new T.Vector3(st.rocket.handle.dir.x, st.rocket.handle.dir.y, st.rocket.handle.dir.z) : new T.Vector3(0, 0, 1);
    boomAt({ point: p, normal: d.negate() });
  }

  function boomAt(hit) {
    var T = window.THREE, F = fx();
    if (!T || !F) { tryCreatures(hit); return; }
    var pt = hit.point, n = hit.normal.clone().normalize();
    var effR = Math.max(1.8, Math.min(6, S.radius));
    var touch = g.G.touch;
    var cap = st.efx.length < (touch ? 170 : 340);
    st.samples = [];

    breakWalls(hit);

    snd(function () { this.noise({ freq: 240, dur: 1.0, gain: 0.5 }); });
    snd(function () { this.tone({ freq: 90, freq2: 24, dur: 1.3, gain: 0.42, type: 'sawtooth' }); });
    snd(function () { this.tone({ freq: 46, dur: 1.7, gain: 0.3, type: 'sine' }); });
    setTimeout(function () { snd(function () { this.noise({ freq: 420, dur: 0.7, gain: 0.2 }); }); }, 300);
    setTimeout(function () { snd(function () { this.noise({ freq: 900, dur: 0.22, gain: 0.09 }); }); }, 460);

    if (cap) {
      var flash = F.sphere({
        r: effR * 0.42, segs: touch ? 8 : 12, color: 0xfff2cf, emissive: 0xffe9b0,
        position: { x: pt.x + n.x * 0.3, y: pt.y + n.y * 0.3, z: pt.z + n.z * 0.3 },
        opacity: 0.95
      });
      if (flash) {
        flash.material.depthWrite = false;
        F.exclude(flash);
        st.efx.push({ mesh: flash, kind: 'flash', t: 0, dur: 0.24, r0: effR * 0.42, o0: 0.95 });
      }

      var wave = F.torus({ r: effR * 0.25, tube: 0.09, segs: 22, color: 0xffd9a0, position: { x: pt.x, y: pt.y, z: pt.z }, opacity: 0.55 });
      if (wave) {
        wave.material.depthWrite = false;
        wave.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), n);
        F.exclude(wave);
        st.efx.push({ mesh: wave, kind: 'wave', t: 0, dur: 0.5, o0: 0.55 });
      }

      var fires = touch ? 4 : 6;
      for (var i = 0; i < fires; i++) {
        var c = [0xffc14d, 0xff8c2e, 0xd4471f, 0x7a2a12][i % 4];
        var fs = F.sphere({
          r: rand(0.32, 0.6) * (effR / 2.4), segs: touch ? 6 : 9, color: c, emissive: c,
          position: { x: pt.x + rand(-0.5, 0.5), y: pt.y + rand(-0.4, 0.5), z: pt.z + rand(-0.5, 0.5) },
          opacity: 0.85
        });
        if (fs) {
          fs.material.depthWrite = false;
          F.exclude(fs);
          st.efx.push({ mesh: fs, kind: 'fire', t: 0, dur: rand(0.45, 0.9), r0: fs.scale.x, rise: rand(0.7, 1.7), o0: 0.85 });
        }
      }

      var smokes = touch ? 6 : 9;
      for (var j = 0; j < smokes; j++) {
        var gcol = [0x565b60, 0x6b7075, 0x44484d, 0x808589][j % 4];
        var sm = F.sphere({
          r: rand(0.5, 0.95) * (effR / 2.4), segs: touch ? 6 : 9, color: gcol,
          position: { x: pt.x + rand(-0.7, 0.7), y: pt.y + rand(-0.3, 0.8), z: pt.z + rand(-0.7, 0.7) },
          opacity: 0.42
        });
        if (sm) {
          sm.material.depthWrite = false;
          F.exclude(sm);
          st.efx.push({ mesh: sm, kind: 'smoke', t: 0, dur: rand(1.5, 2.6), r0: sm.scale.x, rise: rand(0.4, 1.2), drift: { x: rand(-0.4, 0.4), z: rand(-0.4, 0.4) }, o0: 0.42 });
        }
      }

      var sparks = touch ? 12 : 20;
      for (var s = 0; s < sparks; s++) {
        var sk = F.sphere({ r: 0.06, segs: 5, color: 0xffd977, emissive: 0xffd977, position: { x: pt.x + n.x * 0.2, y: pt.y + n.y * 0.2, z: pt.z + n.z * 0.2 }, opacity: 0.95 });
        if (sk) {
          sk.material.depthWrite = false;
          var sv = new T.Vector3(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(rand(5, 13)).add(n.clone().multiplyScalar(rand(4, 8)));
          F.exclude(sk);
          st.efx.push({ mesh: sk, kind: 'spark', t: 0, dur: rand(0.35, 0.8), vel: sv, o0: 0.95 });
        }
      }

      if (!touch && F.light) {
        var lgt = F.light({ color: 0xffcf8a, intensity: 3.2, distance: effR * 4.5, position: { x: pt.x + n.x * 0.5, y: pt.y + n.y * 0.5, z: pt.z + n.z * 0.5 } });
        setTimeout(function () { if (lgt) F.remove(lgt); }, 170);
      }
    }

    debrisSplash(pt, n, effR);
    tryCreatures(hit);
  }

  function tryCreatures(hit) {
    var pt = { x: hit.point.x, y: hit.point.y, z: hit.point.z };
    if (typeof window.LimiarTerror !== 'undefined' && window.LimiarTerror.hit) {
      try {
        if (window.LimiarTerror.hit(pt)) {
          toast('A criatura do terror virou poeira. Volta em uns minutos.');
          return;
        }
      } catch (e) {}
    }
    if (typeof api.strikeCreature === 'function') {
      for (var i = 0; i < 3; i++) {
        var res = null;
        try { res = api.strikeCreature(); } catch (e) {}
        if (!res || !res.hit) break;
        if (res.killed) { toast('Direto no alvo! A criatura desvaneceu — volta em uns 40s.'); break; }
      }
    }
  }

  function breakWalls(hit) {
    if (!S.breakWalls) return;
    if (hit.ground || !hit.normal || Math.abs(hit.normal.y) > 0.6) return;
    var R = clampv(S.radius, 1.2, 8);
    try { removeColliders(hit.point, R); } catch (e) { console.error('[Bazuka] colisão:', e && e.message ? e.message : e); }
    try { dentWorldMesh(hit.object, hit.point, hit.normal, R, clampv(R * 0.55, 0.5, 2.2)); } catch (e) { console.error('[Bazuka] deformação:', e && e.message ? e.message : e); }
  }

  function removeColliders(p, R) {
    var col = g.World.col;
    if (!col || !col.all) return;
    var R2 = R * R, rm = [], i, b;
    for (i = 0; i < col.all.length; i++) {
      b = col.all[i];
      if (!b || b.ramp) continue;
      var qx = clampv(p.x, b.x0, b.x1) - p.x, qy = clampv(p.y, b.y0, b.y1) - p.y, qz = clampv(p.z, b.z0, b.z1) - p.z;
      if (qx * qx + qy * qy + qz * qz > R2) continue;
      if (isFloorLike(b)) continue;
      rm.push(b);
    }
    if (!rm.length) return;
    var set = new Set(rm);
    var kept = [];
    for (i = 0; i < col.all.length; i++) if (!set.has(col.all[i])) kept.push(col.all[i]);
    col.all = kept;
    var keptL = [];
    for (i = 0; i < col.large.length; i++) if (!set.has(col.large[i])) keptL.push(col.large[i]);
    col.large = keptL;
    col.grid.forEach(function (list) {
      var w = 0, k;
      for (k = 0; k < list.length; k++) if (!set.has(list[k])) list[w++] = list[k];
      list.length = w;
    });
  }

  function isFloorLike(b) {
    var dy = b.y1 - b.y0, dx = b.x1 - b.x0, dz = b.z1 - b.z0;
    return dy <= 1.05 && dx > 3 && dz > 3;
  }

  function dentWorldMesh(mesh, pWorld, nWorld, R, sink) {
    var T = window.THREE;
    if (!T || !mesh || !mesh.isMesh || !mesh.geometry || !mesh.geometry.attributes) return;
    if (mesh.userData.fxMade) return;
    var geo = mesh.geometry, pos = geo.attributes.position, colA = geo.attributes.color, nor = geo.attributes.normal;
    if (!pos || !pos.array) return;
    var now = performance.now();
    if (mesh.userData.__bzLast && now - mesh.userData.__bzLast < 300) return;
    mesh.userData.__bzLast = now;

    var inv = new T.Matrix4().copy(mesh.matrixWorld).invert();
    var lp = pWorld.clone().applyMatrix4(inv);
    var nm = new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
    var ln = nWorld.clone().applyMatrix3(nm).normalize();
    var side = Math.abs(ln.y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0);
    var pad = new T.Vector3().crossVectors(ln, side).normalize().multiplyScalar(R * 0.72);
    var exR = R * 1.08, exR2 = exR * exR;
    var arr = pos.array, cnt = pos.count;
    var carr = colA ? colA.array : null;
    var narr = nor ? nor.array : null;
    for (var i = 0; i < cnt; i++) {
      var i3 = i * 3;
      var vx = arr[i3], vy = arr[i3 + 1], vz = arr[i3 + 2];
      var dx = vx - lp.x, dy = vy - lp.y, dz = vz - lp.z;
      var d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > exR2) continue;
      var d = Math.sqrt(d2), f = 1 - d / exR;
      if (f <= 0) continue;
      var f2 = f * f;
      var depth = sink * f2 * rand(0.65, 1.25) + 0.05;
      var wobble = 0.09 * R * (1 - f);
      arr[i3] = vx - ln.x * depth + pad.x * (1 - f) * rand(-wobble, wobble) + rand(-0.03, 0.03);
      arr[i3 + 1] = vy - ln.y * depth + pad.y * (1 - f) * rand(-wobble, wobble) + rand(-0.03, 0.03);
      arr[i3 + 2] = vz - ln.z * depth + pad.z * (1 - f) * rand(-wobble, wobble) + rand(-0.03, 0.03);
      if (narr) {
        narr[i3] = ln.x + rand(-0.35, 0.35);
        narr[i3 + 1] = ln.y + rand(-0.35, 0.35);
        narr[i3 + 2] = ln.z + rand(-0.35, 0.35);
      }
      if (carr) {
        var dark = 0.22 + 0.78 * ((d / exR) * (d / exR));
        carr[i3] *= dark; carr[i3 + 1] *= dark * 0.92; carr[i3 + 2] *= dark * 0.85;
        if (st.samples.length < 6 && Math.random() < 0.25) st.samples.push([carr[i3], carr[i3 + 1], carr[i3 + 2]]);
      }
    }
    pos.needsUpdate = true;
    if (colA) colA.needsUpdate = true;
    if (narr) nor.needsUpdate = true;
    try { geo.computeBoundingSphere(); geo.computeBoundingBox(); } catch (e) {}
  }

  function debrisSplash(pt, n, effR) {
    var T = window.THREE, F = fx();
    if (!T || !F) return;
    var nD = g.G.touch ? 7 : 12;
    for (var i = 0; i < nD; i++) {
      var s = st.samples.length ? st.samples[(Math.random() * st.samples.length) | 0] : [0.55, 0.54, 0.5];
      var jit = rand(0.75, 1.15);
      var col = new T.Color(Math.min(1, s[0] * jit), Math.min(1, s[1] * jit), Math.min(1, s[2] * jit));
      var size = rand(0.16, 0.42) * (effR / 2.8);
      var off = new T.Vector3(rand(-1, 1), rand(-0.6, 0.6), rand(-1, 1)).multiplyScalar(rand(-effR, effR) * 0.4).add(n.clone().multiplyScalar(0.25));
      var dmg = F.box({
        w: size, h: size * rand(0.5, 1.4), d: size, color: col,
        position: { x: pt.x + off.x, y: pt.y + off.y, z: pt.z + off.z },
        rotation: { x: rand(0, 3.1), y: rand(0, 3.1), z: rand(0, 3.1) },
        opacity: 0.99
      });
      if (!dmg) continue;
      F.exclude(dmg);
      var dv = n.clone().multiplyScalar(rand(3.5, 9)).add(new T.Vector3(rand(-1, 1), rand(0.2, 1.4), rand(-1, 1)).multiplyScalar(rand(2.5, 7)));
      st.efx.push({
        mesh: dmg, kind: 'debris', t: 0, dur: rand(1.6, 2.6),
        vel: dv, spin: { x: rand(-4, 4), y: rand(-4, 4), z: rand(-4, 4) },
        o0: 1
      });
    }
  }

  function muzzleSmoke() {
    var T = window.THREE, F = fx();
    if (!T || !F || !st.muzzle) return;
    var wp = new T.Vector3();
    st.muzzle.getWorldPosition(wp);
    var n = g.G.touch ? 3 : 5;
    for (var i = 0; i < n; i++) {
      var m = F.sphere({
        r: rand(0.14, 0.3), segs: 6, color: 0x8d9196,
        position: { x: wp.x + rand(-0.15, 0.15), y: wp.y + rand(-0.15, 0.15), z: wp.z + rand(-0.15, 0.15) },
        opacity: 0.4
      });
      if (m) {
        m.material.depthWrite = false;
        F.exclude(m);
        st.efx.push({ mesh: m, kind: 'smoke', t: 0, dur: rand(0.5, 0.9), r0: m.scale.x, rise: rand(0.4, 1), drift: { x: rand(-0.3, 0.3), z: rand(-0.3, 0.3) }, o0: 0.4 });
      }
      var f = F.sphere({
        r: rand(0.08, 0.18), segs: 5, color: 0xffb24d, emissive: 0xffa030,
        position: { x: wp.x, y: wp.y, z: wp.z },
        opacity: 0.8
      });
      if (f) {
        f.material.depthWrite = false;
        F.exclude(f);
        st.efx.push({ mesh: f, kind: 'fire', t: 0, dur: rand(0.15, 0.3), r0: f.scale.x, rise: rand(0.4, 1), o0: 0.8 });
      }
    }
  }

  function spawnRocketWake() {
    var F = fx(), T = window.THREE;
    if (!F || !T || !st.rocket || !st.rocket.alive || !st.rocket.mesh) return;
    var p = st.rocket.mesh.position;
    var m = F.sphere({ r: rand(0.12, 0.22), segs: 6, color: 0x767b80, position: { x: p.x, y: p.y, z: p.z }, opacity: 0.32 });
    if (m) {
      m.material.depthWrite = false;
      F.exclude(m);
      st.efx.push({ mesh: m, kind: 'smoke', t: 0, dur: rand(0.7, 1.1), r0: m.scale.x, rise: 0.25, drift: { x: rand(-0.2, 0.2), z: rand(-0.2, 0.2) }, o0: 0.32 });
    }
    var f = F.sphere({ r: 0.09, segs: 5, color: 0xffb254, emissive: 0xff8c2e, position: { x: p.x, y: p.y, z: p.z }, opacity: 0.75 });
    if (f) {
      f.material.depthWrite = false;
      F.exclude(f);
      st.efx.push({ mesh: f, kind: 'spark', t: 0, dur: rand(0.08, 0.16), vel: new T.Vector3(0, 0.4, 0), o0: 0.75 });
    }
  }

  function frameTick() {
    var now = performance.now() / 1000;
    var dt = st.lastT ? Math.min(0.1, now - st.lastT) : 0.016;
    st.lastT = now;
    var T = window.THREE;

    if (st.cd > 0) {
      st.cd -= dt;
      if (st.cd <= 0) {
        st.cd = 0;
        if (st.cdLight) st.cdLight.material.color.setHex(0x74ff6e);
        if (!st.pinged) {
          st.pinged = true;
          snd(function () { this.tone({ freq: 620, dur: 0.06, gain: 0.06, type: 'sine' }); });
        }
      } else if (st.cdLight) st.cdLight.material.color.setHex(st.cd < S.cooldown * 0.5 ? 0xff5a3c : 0xffc14d);
    }

    if (st.gun && st.selected) {
      st.recoil = Math.max(0, st.recoil - dt * 4.2);
      var rec = st.recoil * st.recoil;
      var bob = Math.min(1, (g.P.speed || 0) / 2.35);
      var hang = g.P.grounded ? 0 : Math.sin(now * 12) * 0.008;
      st.gun.position.set(0.37, -0.31 + Math.sin(now * 8.2) * 0.012 * (0.3 + 0.7 * bob) + hang, -0.58 + rec * 0.15);
      st.gun.rotation.x = -(bob * (g.P.grounded ? Math.sin(now * 16) : 0) * 0.018) - rec * 0.3;
      st.gun.rotation.z = -rec * 0.09;
    }

    if (st.rocket && st.rocket.alive && st.rocket.mesh && T && st.rocket.handle) {
      var d = st.rocket.handle.dir;
      st.rocket.mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 0, -1), new T.Vector3(d.x, d.y, d.z).normalize());
      st.wakeAcc += dt;
      var step = 0.026;
      while (st.wakeAcc >= step) {
        st.wakeAcc -= step;
        spawnRocketWake();
      }
    }

    if (st.rocket && st.rocket.alive && st.rocket.mesh && T && st.rocket.custom && st.rocket.custom.target) {
      var c = st.rocket.custom;
      c.ttl -= dt;
      c.vel.y -= 0.2 * dt;
      var before = st.rocket.mesh.position.clone();
      st.rocket.mesh.position.addScaledVector(c.vel, dt);
      c.traveled += before.distanceTo(st.rocket.mesh.position);
      st.rocket.mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 0, -1), c.vel.clone().normalize());
      st.wakeAcc += dt;
      var wstep = 0.026;
      while (st.wakeAcc >= wstep) {
        st.wakeAcc -= wstep;
        spawnRocketWake();
      }
      var done = c.traveled >= c.maxD - 0.25 || c.ttl <= 0;
      if (done) {
        var cr = c.castRes;
        var bpt = new T.Vector3(c.target.x, c.target.y, c.target.z);
        var bn = cr && cr.normal ? new T.Vector3(cr.normal.x || 0, cr.normal.y || 0.5, cr.normal.z || 0).normalize() : c.dir.clone().negate();
        st.rocket.alive = false;
        g.Gfx.scene.remove(st.rocket.mesh);
        st.rocket.mesh = null;
        boomAt({ point: bpt, normal: bn, object: cr ? cr.mesh : (cr ? cr.object : null), ground: !!(cr && cr.type === 'ground') });
      }
    }

    tickEffects(dt, T);
  }

  function tickEffects(dt, T) {
    if (!st.efx.length) return;
    var F = fx(), W = g.World;
    for (var i = st.efx.length - 1; i >= 0; i--) {
      var e = st.efx[i], m = e.mesh;
      if (!m || !m.parent) { st.efx.splice(i, 1); continue; }
      e.t += dt;
      var k = e.t / e.dur;
      if (k >= 1) { F.remove(m); st.efx.splice(i, 1); continue; }
      var fade = 1 - k;
      if (m.material) m.material.opacity = (e.o0 !== undefined ? e.o0 : 1) * (e.kind === 'debris' ? 1 : fade);
      if (e.kind === 'flash') {
        m.scale.setScalar(Math.max(0.01, e.r0 * (1 + 3.6 * k)));
      } else if (e.kind === 'fire') {
        m.scale.setScalar(Math.max(0.01, e.r0 * (1 + 1.4 * k)));
        m.position.y += (e.rise || 1) * dt;
      } else if (e.kind === 'wave') {
        m.scale.setScalar(Math.max(0.01, 1 + 9 * k));
      } else if (e.kind === 'smoke') {
        m.scale.setScalar(Math.max(0.01, e.r0 * (1 + 1.7 * k)));
        m.position.y += (e.rise || 0.6) * dt;
        if (e.drift) { m.position.x += e.drift.x * dt; m.position.z += e.drift.z * dt; }
      } else if (e.kind === 'spark') {
        if (e.vel) {
          e.vel.y -= 24 * dt;
          m.position.set(m.position.x + e.vel.x * dt, m.position.y + e.vel.y * dt, m.position.z + e.vel.z * dt);
        }
        m.scale.setScalar(Math.max(0.01, 1 - k * 0.8));
      } else if (e.kind === 'debris') {
        e.vel.y -= 26 * dt;
        m.position.set(m.position.x + e.vel.x * dt, m.position.y + e.vel.y * dt, m.position.z + e.vel.z * dt);
        m.rotation.x += e.spin.x * dt; m.rotation.y += e.spin.y * dt; m.rotation.z += e.spin.z * dt;
        try {
          var gr = W.col.ground(m.position.x, m.position.z, m.position.y + 0.8, 0.3);
          if (gr > -Infinity && m.position.y < gr + 0.1) {
            m.position.y = gr + 0.1;
            if (e.vel.y < -2) { e.vel.y = -e.vel.y * 0.32; e.vel.x *= 0.55; e.vel.z *= 0.55; }
            else { e.vel.y = 0; e.vel.x *= 0.4; e.vel.z *= 0.4; e.spin.x *= 0.3; e.spin.y *= 0.3; e.spin.z *= 0.3; }
          }
        } catch (err) {}
        if (k > 0.75) {
          var sk2 = (1 - k) / 0.25;
          m.scale.setScalar(Math.max(0.01, sk2));
          if (m.material) m.material.opacity = sk2;
        }
      }
    }
  }

  function setup() {
    if (st.ready) return;
    var T = window.THREE;
    if (!T) return;
    var F = fx();
    if (!F || !F.spawnProjectile || !F.sphere || !F.box || !F.torus) return;
    st.gun = buildLauncher(T);
    F.attachToCamera(st.gun);
    F.exclude(st.gun);
    hookHotbar();
    g.onRender(frameTick);
  }

  var poll = setInterval(function () {
    var fxo = g.Gfx;
    if (!fxo || !fxo.renderer || !fxo.scene || !fxo.camera || !window.THREE || !g.G || !g.World || !g.World.col) return;
    clearInterval(poll);
    poll = null;
    try { setup(); }
    catch (err) { console.error('[Bazuka] falha ao inicializar: ' + (err && err.message ? err.message : err)); }
  }, 250);
})();
