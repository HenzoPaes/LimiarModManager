(function () {
  var g = (typeof api !== 'undefined' && api.game) ? api.game : null;
  if (!g) { console.error('[Terror 10x] api.game indisponível — atualize o Limiar Mod Manager.'); return; }

  var S = { enabled: true, creature: true, darkness: true, whispers: true };

  var st = {
    ready: false, shell: null, vignette: null, monster: null, eyeL: null, eyeR: null,
    mode: 'off', next: 0, until: 0, cool: 0, ang: 0,
    nextWhisper: 0, nextDrone: 0, nextSpike: 0, spikeUntil: 0, lastT: 0,
    beatAt: 0, flash: null
  };

  api.register({
    id: 'terror10x',
    name: 'Terror 10x',
    version: '1.0.0',
    description: 'Deixa o terror do jogo 10x pior: escuridão sufocante que falha e treme, vinheta opressiva e SONOS NOVOS (coração distante, sussurros ao seu lado, respiros e gritos). Uma criatura alta de olhos brancos espreita qualquer lugar — e no campo da árvore ela caça você de verdade: corre junto, fica perto e se tocar, susto total com grito. Móvel incluído.',
    settings: [
      { id: 'enabled', label: 'Terror 10x ativo', type: 'toggle', default: true },
      { id: 'creature', label: 'A criatura espreita (e caça no campo)', type: 'toggle', default: true },
      { id: 'darkness', label: 'Escuridão pesada com falhas', type: 'toggle', default: true },
      { id: 'whispers', label: 'Sussurros, coração e sons do pesadelo', type: 'toggle', default: true },
      { id: 'invocar', label: 'Invocar o pesadelo agora', type: 'button' }
    ],
    onChange: function (v) {
      S.enabled = v.enabled !== false;
      S.creature = v.creature !== false;
      S.darkness = v.darkness !== false;
      S.whispers = v.whispers !== false;
      applyToggles();
    },
    onAction: function (a) {
      if (a === 'invocar') { invoke(); toast('Você não deveria ter feito isso.'); }
    }
  });

  function toast(msg) { if (typeof g.toast === 'function') g.toast(msg); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function sndTone(o) { try { if (api.fx && api.fx.sound && api.fx.sound.tone) api.fx.sound.tone(o); } catch (e) {} }
  function sndNoise(o) { try { if (api.fx && api.fx.sound && api.fx.sound.noise) api.fx.sound.noise(o); } catch (e) {} }

  function heart(gain) {
    sndTone({ freq: 54, freq2: 40, dur: 0.1, gain: gain, type: 'sine' });
    setTimeout(function () { sndTone({ freq: 48, freq2: 34, dur: 0.12, gain: gain * 0.8, type: 'sine' }); }, 170);
  }
  function whisper() {
    sndNoise({ freq: 1700, dur: rnd(0.3, 0.7), gain: rnd(0.04, 0.09) });
    if (Math.random() < 0.4) sndTone({ freq: rnd(200, 300), freq2: 160, dur: 0.5, gain: 0.03, type: 'sine' });
  }
  function breath(close) {
    sndNoise({ freq: 480, dur: 0.5, gain: close ? rnd(0.1, 0.16) : rnd(0.04, 0.07) });
  }
  function scream() {
    sndNoise({ freq: 3200, dur: 0.75, gain: 0.5 });
    sndTone({ freq: 780, freq2: 230, dur: 0.8, gain: 0.3, type: 'sawtooth' });
    sndTone({ freq: 1150, freq2: 300, dur: 0.65, gain: 0.18, type: 'square' });
  }
  function knock() {
    sndTone({ freq: 86, freq2: 70, dur: 0.2, gain: 0.2, type: 'sine' });
  }
  function drone() {
    sndTone({ freq: 46, freq2: 41, dur: 3.2, gain: 0.05, type: 'triangle' });
  }

  function playing() { return g.Game.state === 'playing'; }

  function groundAt(x, z, yNow) {
    var gy = -Infinity;
    try { gy = g.World.col.ground(x, z, (yNow === undefined ? g.P.y : yNow) + 0.8, 0.4); } catch (e) { gy = -Infinity; }
    return gy > -Infinity ? gy : (yNow === undefined ? g.P.y : yNow);
  }

  function buildMonster(T) {
    var skin = new T.MeshBasicMaterial({ color: 0x07070a });
    var grp = new T.Group();

    var legs = new T.Mesh(new T.CylinderGeometry(0.045, 0.055, 0.95, 8), skin);
    legs.position.set(-0.09, 0.475, 0);
    grp.add(legs);
    var legs2 = new T.Mesh(new T.CylinderGeometry(0.045, 0.055, 0.95, 8), skin);
    legs2.position.set(0.09, 0.475, 0);
    grp.add(legs2);

    var torso = new T.Mesh(new T.CylinderGeometry(0.15, 0.24, 1.05, 10), skin);
    torso.position.y = 1.42;
    grp.add(torso);

    var armL = new T.Mesh(new T.CylinderGeometry(0.03, 0.038, 1.15, 8), skin);
    armL.position.set(-0.3, 1.32, 0);
    grp.add(armL);
    var armR = new T.Mesh(new T.CylinderGeometry(0.03, 0.038, 1.15, 8), skin);
    armR.position.set(0.3, 1.32, 0);
    grp.add(armR);

    var neck = new T.Mesh(new T.CylinderGeometry(0.035, 0.05, 0.14, 8), skin);
    neck.position.y = 2.0;
    grp.add(neck);

    var head = new T.Mesh(new T.SphereGeometry(0.155, 14, 12), skin);
    head.position.y = 2.16;
    grp.add(head);

    var eyeMat = new T.MeshBasicMaterial({ color: 0xdfe9ff });
    st.eyeL = new T.Mesh(new T.SphereGeometry(0.021, 8, 6), eyeMat);
    st.eyeL.position.set(-0.058, 2.19, 0.13);
    grp.add(st.eyeL);
    st.eyeR = new T.Mesh(new T.SphereGeometry(0.021, 8, 6), eyeMat);
    st.eyeR.position.set(0.058, 2.19, 0.13);
    grp.add(st.eyeR);

    grp.scale.setScalar(1.08);
    grp.visible = false;
    grp.frustumCulled = false;
    if (api.fx && api.fx.add) api.fx.add(grp);
    if (api.fx && api.fx.exclude) api.fx.exclude(grp);
    st.monster = grp;
  }

  function buildVisuals(T) {
    if (api.fx && api.fx.attachToCamera) {
      var shellGeo = new T.SphereGeometry(0.62, 20, 14);
      var shellMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.0, depthTest: false, depthWrite: false, side: T.BackSide });
      var shell = new T.Mesh(shellGeo, shellMat);
      shell.renderOrder = 9997;
      shell.frustumCulled = false;
      api.fx.attachToCamera(shell);
      st.shell = shell;
    }
    if (api.fx && api.fx.hud && api.fx.hud.create) {
      st.vignette = api.fx.hud.create({
        id: 'limiar-terror-vignette',
        style: 'left:0;top:0;width:100%;height:100%;background:radial-gradient(ellipse at center, rgba(0,0,0,0) 38%, rgba(0,0,0,0.82) 100%);z-index:9290;'
      });
    }
    buildMonster(T);
    st.next = performance.now() / 1000 + rnd(4, 9);
    st.nextWhisper = st.next;
    st.nextDrone = st.next;
    st.nextSpike = st.next + rnd(6, 13);
  }

  function applyToggles() {
    if (!st.ready) return;
    var vis = S.enabled && playing();
    if (st.shell) { st.shell.visible = vis && S.darkness; st.shell.material.opacity = st.shell.visible ? 0.4 : 0; }
    if (st.vignette) st.vignette.style.display = (vis && S.darkness) ? '' : 'none';
    if (st.monster) {
      st.monster.visible = vis && S.creature && (st.mode === 'lurk' || st.mode === 'stalk');
      if (!vis || !S.creature) { st.mode = 'off'; st.monster.visible = false; }
    }
  }

  function lookAtPlayer() {
    var P = g.P;
    st.monster.rotation.y = Math.atan2(P.x - st.monster.position.x, P.z - st.monster.position.z);
  }

  function placeMonster(P, dist, fromYaw) {
    var ang = fromYaw === undefined ? Math.random() * Math.PI * 2 : fromYaw;
    var x = P.x + Math.sin(ang) * dist;
    var z = P.z + Math.cos(ang) * dist;
    st.monster.position.set(x, groundAt(x, z, P.y) + 0.02, z);
    st.monster.visible = true;
    lookAtPlayer();
    st.ang = ang;
  }

  function invoke() {
    if (!st.ready || !S.enabled || !S.creature || !playing()) return;
    var T = window.THREE;
    var fx = g.Gfx;
    var P = g.P;
    var dir = new T.Vector3(0, 0, -1).applyQuaternion(fx.camera.quaternion);
    var dist = g.Game.zone === 9 ? 6 : 9;
    var x = P.x + dir.x * dist, z = P.z + dir.z * dist;
    st.monster.position.set(x, groundAt(x, z, P.y) + 0.02, z);
    st.monster.visible = true;
    lookAtPlayer();
    if (g.Game.zone === 9) { st.mode = 'stalk'; st.cool = 0; } else { st.mode = 'lurk'; st.until = now() + rnd(7, 12); st.cool = st.until + 12; }
    whisper(); breath(true);
  }

  function now() { return performance.now() / 1000; }

  function jumpscare() {
    var P = g.P;
    scream(); knock();
    st.monster.visible = false;
    st.mode = 'off';
    st.cool = now() + rnd(14, 22);
    if (api.fx && api.fx.hud && api.fx.hud.create) {
      var flash = api.fx.hud.create({
        id: 'limiar-terror-flash',
        style: 'left:0;top:0;width:100%;height:100%;background:#ffffff;z-index:9295;'
      });
      setTimeout(function () { flash.style.background = '#7a0a0a'; }, 90);
      setTimeout(function () { api.fx.hud.remove(flash); }, 640);
    }
    try {
      if (api.teleportZone) { api.teleportZone(9); }
      else {
        var s = g.World.zones[9];
        if (s) {
          var sp = zoneSpawnSafe(9);
          g.P.x = sp.x; g.P.y = sp.y; g.P.z = sp.z; g.P.eyeY = sp.y + 1.62; g.P.vx = 0; g.P.vz = 0; g.P.vy = 0;
        }
      }
    } catch (e) {}
  }

  function zoneSpawnSafe(zi) {
    var z = g.World.zones[zi];
    if (!z || !z.W || !z.spawn) return { x: g.P.x, y: g.P.y, z: g.P.z };
    var w = z.W(z.spawn.x, z.spawn.y, z.spawn.z);
    return { x: w[0], y: w[1], z: w[2] };
  }

  function frameHook() {
    if (!st.ready) return;
    var T = window.THREE, fx = g.Gfx, P = g.P, Game = g.Game, World = g.World;
    var nt = now();
    var dt = st.lastT ? Math.min(0.05, nt - st.lastT) : 0.016;
    st.lastT = nt;
    if (!playing()) { if (st.monster) st.monster.visible = false; if (st.shell) st.shell.material.opacity = 0; return; }

    var inCampo = Game.zone === 9;
    var terror = S.enabled;

    if (!terror) { if (st.monster) st.monster.visible = false; if (st.shell) st.shell.material.opacity = 0; if (st.vignette) st.vignette.style.display = 'none'; return; }

    if (st.vignette) st.vignette.style.display = S.darkness ? '' : 'none';

    if (st.shell && S.darkness) {
      st.shell.visible = true;
      var base = inCampo ? 0.5 : 0.4;
      var extra = (nt < st.spikeUntil) ? 0.24 : 0;
      var flick = 0.03 * Math.sin(nt * 19.0) + 0.015 * Math.sin(nt * 7.3);
      st.shell.material.opacity = Math.max(0.12, Math.min(0.85, base + extra + flick));
    } else if (st.shell) {
      st.shell.visible = false;
    }

    if (S.whispers) {
      if (nt > st.nextSpike) { st.nextSpike = nt + rnd(7, 15); st.spikeUntil = nt + rnd(0.5, 1.1); knock(); }
      if (nt > st.nextWhisper) { st.nextWhisper = nt + (inCampo ? rnd(3.5, 8) : rnd(8, 16)); whisper(); }
      if (nt > st.nextDrone) { st.nextDrone = nt + rnd(18, 34); drone(); }
    }

    if (!S.creature || !st.monster) return;

    if (inCampo) {
      if (st.cool > 0 && nt < st.cool) { st.monster.visible = false; st.mode = 'off'; return; }
      if (st.mode !== 'stalk') {
        st.mode = 'stalk';
        st.cool = 0;
        placeMonster(P, rnd(14, 20));
        whisper(); breath(true);
      }
      var dx = P.x - st.monster.position.x, dz = P.z - st.monster.position.z;
      var d = Math.sqrt(dx * dx + dz * dz) || 1;
      st.ang = Math.atan2(dx, dz);
      st.ang += dt * (1.9 / Math.max(3.5, d));
      var wantDist = 7.2 + 2.2 * Math.sin(nt * 0.13);
      var nx = P.x + Math.sin(st.ang) * wantDist;
      var nz = P.z + Math.cos(st.ang) * wantDist;
      var mix = 1 - Math.exp(-3.2 * dt);
      st.monster.position.x += (nx - st.monster.position.x) * mix;
      st.monster.position.z += (nz - st.monster.position.z) * mix;
      st.monster.position.y = groundAt(st.monster.position.x, st.monster.position.z, P.y) + 0.02 + Math.sin(nt * 1.4) * 0.012;
      lookAtPlayer();
      if (d < 6 && nt > st.beatAt) { st.beatAt = nt + Math.max(0.34, d * 0.16); heart(Math.min(0.3, 0.055 + (7 - d) * 0.033)); }
      if (d < 3.2 && Math.random() < dt * 2.2) breath(true);
      if (d < 2.7) jumpscare();
    } else {
      if (st.mode === 'off' || st.mode === 'stalk') {
        st.mode = 'off';
        st.monster.visible = false;
        if ((st.cool === 0 || nt > st.cool) && nt > st.next) { st.mode = 'lurk'; st.until = nt + rnd(6, 11); placeMonster(P, rnd(16, 27)); whisper(); }
        else if (nt > st.next) { st.next = nt + rnd(9, 18); }
      } else {
        lookAtPlayer();
        st.monster.position.y = groundAt(st.monster.position.x, st.monster.position.z, P.y) + 0.02 + Math.sin(nt * 1.1) * 0.014;
        if (st.eyeL) st.eyeL.scale.setScalar(1 + 0.5 * Math.sin(nt * 2.2));
        if (st.eyeR) st.eyeR.scale.setScalar(1 + 0.5 * Math.sin(nt * 2.2 + 0.9));
        if (nt > st.until) {
          st.monster.visible = false;
          st.mode = 'off';
          st.cool = nt + rnd(9, 17);
          st.next = st.cool + rnd(6, 14);
          breath(false);
        }
      }
    }
  }

  function setup() {
    if (st.ready) return;
    var T = window.THREE;
    if (!T) return;
    if (!fxOK()) { console.error('[Terror 10x] api.fx indisponível — atualize o Limiar Mod Manager.'); return; }
    st.ready = true;
    buildVisuals(T);
    g.onRender(frameHook);
  }

  function fxOK() { return typeof api.fx === 'object' && api.fx && api.fx.add && api.fx.hud && api.fx.sound; }

  function hitMonster(point) {
    if (!st.ready || !S.enabled || !S.creature || !st.monster || !st.monster.visible) return false;
    if (point) {
      var dx = point.x - st.monster.position.x;
      var dy = (point.y === undefined ? g.P.eyeY : point.y) - (st.monster.position.y + 1.2);
      var dz = point.z - st.monster.position.z;
      var inside = dx * dx + dy * dy * 0.6 + dz * dz;
      if (inside > 1.2) return false;
    }
    st.monster.visible = false;
    st.mode = 'off';
    st.cool = now() + rnd(16, 26);
    st.next = st.cool + rnd(8, 15);
    scream(); knock();
    return true;
  }

  window.LimiarTerror = { hit: hitMonster, version: 1 };

  var poll = setInterval(function () {
    var fx = g.Gfx;
    if (!fx || !fx.renderer || !fx.scene || !fx.camera || !window.THREE || !g.G || !g.World || !g.World.col) return;
    clearInterval(poll);
    poll = null;
    try { setup(); }
    catch (err) { console.error('[Terror 10x] falha ao inicializar: ' + (err && err.message ? err.message : err)); }
  }, 250);
})();
