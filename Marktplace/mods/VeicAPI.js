(function () {
  var g = (typeof api !== 'undefined' && api.game) ? api.game : null;
  if (!g) { console.error('[VeicAPI] api.game indisponível — atualize o Limiar Mod Manager.'); return; }

  var st = {
    ready: false, vehicles: [], riding: null, prompt: null,
    btnRide: null, btnExit: null, btnHorn: null,
    nextRollT: 0, pending: []
  };

  api.register({
    id: 'veicapi',
    name: 'VeicAPI',
    version: '1.0.0',
    description: 'API para outros mods criarem VEICULOS dirigiveis (motos, carros, skates...). Perto do veiculo: toque PILOTAR ou aperte E. Dirija com WASD/botao lateral; buzina com H. Mods usam window.LimiarVehicles.create(...).',
    settings: [
      { id: 'enabled', label: 'Pilotagem de veiculos ativa', type: 'toggle', default: true }
    ],
    onChange: function (v) {
      if (v.enabled === false && st.riding) dismount(true);
    }
  });

  window.LimiarVehicles = {
    version: 1,
    vehicles: st.vehicles,
    create: function (spec) {
      if (!spec || !spec.id) return null;
      spec = {
        id: String(spec.id),
        name: spec.name === undefined ? String(spec.id) : String(spec.name),
        build: typeof spec.build === 'function' ? spec.build : null,
        maxSpeed: Math.max(0.5, spec.maxSpeed === undefined ? 8 : spec.maxSpeed),
        accel: Math.max(0.5, spec.accel === undefined ? 5 : spec.accel),
        turnRate: Math.max(0.2, spec.turnRate === undefined ? 2.4 : spec.turnRate),
        radius: Math.max(0.2, spec.radius === undefined ? 0.8 : spec.radius),
        seat: spec.seat === undefined ? { x: 0, y: 0.5, z: 0 } : spec.seat,
        eyeOffset: spec.eyeOffset === undefined ? 0 : Math.max(0, spec.eyeOffset),
        rollSound: spec.rollSound === undefined ? 'car' : String(spec.rollSound),
        hornTone: spec.hornTone === undefined ? 330 : spec.hornTone
      };
      return makeVehicle(spec);
    },
    despawnAll: function () {
      for (var i = st.vehicles.length - 1; i >= 0; i--) destroyVehicle(st.vehicles[i]);
    }
  };

  function makeVehicle(spec) {
    var veh = {
      spec: spec, group: null, wheels: [], yaw: 0, speed: 0, vy: 0,
      placed: false, ok: st.ready, gone: false
    };
    if (st.ready) buildVehicle(veh);
    st.vehicles.push(veh);
    return {
      placeAt: function (x, y, z, yawIn) {
        veh.yaw = yawIn === undefined ? veh.yaw : yawIn;
        veh.posX = x; veh.posY = y; veh.posZ = z;
        veh.placed = true; veh.gone = false;
        parkAtGround(veh);
      },
      near: function () { return Math.hypot(g.P.x - veh.group.position.x, g.P.z - veh.group.position.z); },
      despawn: function () { destroyVehicle(veh); }
    };
  }

  function buildVehicle(veh) {
    var T = window.THREE;
    if (!vespec(veh).build || !T) { veh.noBuild = true; return; }
    var parts = vespec(veh).build(T, api.fx);
    if (!parts || !parts.group) { veh.noBuild = true; return; }
    veh.group = parts.group;
    veh.wheels = Array.isArray(parts.wheels) ? parts.wheels : [];
    veh.posX = veh.posX || g.P.x;
    veh.posY = veh.posY || g.P.y;
    veh.posZ = veh.posZ || g.P.z;
    veh.group.position.set(veh.posX, veh.posY, veh.posZ);
    veh.group.rotation.y = veh.yaw;
    api.fx.add(veh.group);
    api.fx.exclude(veh.group);
    veh.placed = veh.placed === undefined ? false : veh.placed;
    veh.group.visible = !!veh.placed;
  }

  function vespec(veh) { return veh.spec; }

  function parkAtGround(veh) {
    if (!veh.group) return;
    var P = g.P;
    try {
      var gy = g.World.col.ground(veh.posX, veh.posZ, P.y + 1.5, 1.0);
      if (gy > -Infinity && Math.abs(gy - veh.posY) < 3.5) veh.posY = gy;
    } catch (e) {}
    veh.group.position.set(veh.posX, veh.posY, veh.posZ);
    veh.group.rotation.y = veh.yaw;
    veh.group.visible = true;
  }

  function destroyVehicle(veh) {
    if (st.riding === veh) dismount(true);
    veh.gone = true;
    var i = st.vehicles.indexOf(veh);
    if (i >= 0) st.vehicles.splice(i, 1);
    try { if (veh.group) api.fx.remove(veh.group); } catch (e) {}
  }

  function seatWorld(veh) {
    var s = veh.spec.seat;
    var sy = Math.sin(veh.yaw), cy = Math.cos(veh.yaw);
    var lx = s.x || 0, lz = s.z || 0;
    return {
      x: veh.group.position.x + lx * cy + lz * sy,
      y: veh.group.position.y + (s.y || 0),
      z: veh.group.position.z - lx * sy + lz * cy
    };
  }

  function enter(veh) {
    st.riding = veh;
    veh.speed = 0;
    toast('Pilotando ' + veh.spec.name + '. Sair: E ou bota DESCER.');
    blip(520, 700);
  }

  function dismount(silent) {
    var veh = st.riding;
    st.riding = null;
    if (!veh) return;
    var P = g.P;
    var sy = Math.sin(veh.yaw), cy = Math.cos(veh.yaw);
    P.x = veh.group.position.x + cy * 0.9 + sy * 0.5;
    P.z = veh.group.position.z - sy * 0.9 + cy * 0.5;
    P.y = groundNear(P.x, P.z, P.y);
    P.eyeY = P.y + 1.62;
    P.vx = 0; P.vz = 0; P.vy = 0;
    veh.speed = 0;
    if (!silent) blip(300, 200);
  }

  function groundNear(x, z, yNow) {
    var gy = -Infinity;
    try { gy = g.World.col.ground(x, z, yNow + 1.2, 0.6); } catch (e) {}
    return gy > -Infinity ? gy : yNow;
  }

  function tickVehicle(veh, h) {
    var P = g.P, keys = g.IN.keys;
    var s = veh.spec;
    var fwdIn = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    var turnIn = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    if (g.IN.joyX && Math.abs(g.IN.joyX) > 0.25) turnIn = -g.IN.joyX;
    if (g.IN.joyY && Math.abs(g.IN.joyY) > 0.25) fwdIn = -g.IN.joyY;
    veh.speed += (fwdIn * s.maxSpeed - veh.speed) * Math.min(1, h * s.accel);
    if (fwdIn === 0) veh.speed *= Math.pow(0.5, h);
    veh.yaw += turnIn * s.turnRate * h * (veh.speed < -0.2 ? -1 : 1);
    var nx = veh.group.position.x + Math.sin(veh.yaw) * veh.speed * h;
    var nz = veh.group.position.z + Math.cos(veh.yaw) * veh.speed * h;
    var probe = { x: nx, z: nz };
    var blocked = false;
    try { blocked = g.World.col.resolve(probe, veh.group.position.y, s.radius, 1.7); } catch (e) {}
    if (blocked) veh.speed *= 0.35;
    var gy = groundNear(probe.x, probe.z, veh.group.position.y);
    var dyG = gy - veh.group.position.y;
    var ny;
    if (dyG <= 0.55) {
      if (dyG >= -0.55) ny = gy;
      else { ny = veh.group.position.y - 8 * h; if (ny < gy) ny = gy; }
      veh.vy = 0;
    } else {
      veh.vy -= 18 * h;
      ny = veh.group.position.y + veh.vy * h;
      if (ny <= gy) { ny = gy; veh.vy = 0; }
    }
    veh.group.position.set(probe.x, ny, probe.z);
    veh.group.rotation.y = veh.yaw;
    if (veh.wheels.length && Math.abs(veh.speed) > 0.05) {
      var spin = veh.speed * h / 0.08;
      for (var i = 0; i < veh.wheels.length; i++) veh.wheels[i].rotation.x += spin;
    }
    movePlayerToSeat(veh, h);
    if (Math.abs(veh.speed) > 1.2 && performance.now() > st.nextRollT) {
      st.nextRollT = performance.now() + (s.rollSound === 'roll' ? 130 : 210);
      rollSound(s, Math.abs(veh.speed));
    }
  }

  function movePlayerToSeat(veh, h) {
    var P = g.P;
    var seat = seatWorld(veh);
    P.x = seat.x; P.z = seat.z;
    P.y = seat.y; P.eyeY = seat.y + 1.5 + veh.spec.eyeOffset;
    P.vx = 0; P.vz = 0; P.vy = 0;
    P.yaw = veh.yaw;
    P.speed = Math.abs(veh.speed);
    P.grounded = true;
  }

  function rollSound(s, speed) {
    if (typeof api.fx !== 'object' || !api.fx || !api.fx.sound) return;
    var k = Math.min(1, speed / s.maxSpeed);
    if (s.rollSound === 'roll') api.fx.sound.noise({ freq: 600 + k * 700, dur: 0.14, gain: 0.03 + k * 0.05 });
    else {
      api.fx.sound.noise({ freq: 160 + k * 380, dur: 0.12, gain: 0.04 + k * 0.06 });
      api.fx.sound.tone({ freq: 70 + k * 60, freq2: 60, dur: 0.1, gain: 0.05 + k * 0.05, type: 'sawtooth' });
    }
  }

  function horn() {
    if (!st.riding) return;
    var f = st.riding.spec.hornTone;
    api.fx.sound.tone({ freq: f, dur: 0.35, gain: 0.18, type: 'square' });
    api.fx.sound.tone({ freq: f * 1.26, dur: 0.35, gain: 0.14, type: 'square' });
  }

  function nearest() {
    var best = null, bestD = 3.2;
    for (var i = 0; i < st.vehicles.length; i++) {
      var v = st.vehicles[i];
      if (!v.group || !v.group.visible || v.noBuild) continue;
      var d = Math.hypot(g.P.x - v.group.position.x, g.P.z - v.group.position.z);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  function toast(msg) { if (typeof g.toast === 'function') g.toast(msg); }
  function blip(a, b) { try { api.fx.sound.tone({ freq: a, freq2: b, dur: 0.16, gain: 0.1, type: 'triangle' }); } catch (e) {} }

  function setup() {
    if (st.ready) return;
    if (typeof api.fx !== 'object' || !api.fx || !api.fx.add || !api.fx.exclude || !api.fx.hud || !api.fx.hud.create || !api.fx.onKey) return;
    st.ready = true;

    st.prompt = api.fx.hud.create({
      id: 'limiar-veh-prompt',
      text: '',
      style: 'left:50%;bottom:86px;transform:translateX(-50%);background:rgba(16,18,22,.8);padding:8px 14px;border-radius:10px;border:1px solid #4a5560;z-index:9281;'
    });

    if (api.fx.hud.touchButton) {
      st.btnRide = api.fx.hud.touchButton({ label: 'PILOTAR', light: '#c9ffd9', base: '#1e7a3a', hidden: true, onTap: function () { onTouchRide(); } });
      st.btnExit = api.fx.hud.touchButton({ label: 'DESCER', light: '#ffc9c9', base: '#7a1e1e', hidden: true, onTap: function () { dismount(); } });
      st.btnHorn = api.fx.hud.touchButton({ label: 'BUZINA', light: '#fdffb3', base: '#5f6b1e', hidden: true, onTap: horn });
    }

    api.fx.onKey('KeyE', function () {
      if (st.riding) dismount();
      else { var v = nearest(); if (v) enter(v); }
    });
    api.fx.onKey('KeyH', function () { horn(); });

    g.onPhysics(function roll(h) { tickWrap(h); });
    g.onRender(frameTick);
    for (var i = 0; i < st.pending.length; i++) {
      try {
        buildVehicle(st.pending[i]);
        if (st.pending[i].placed) parkAtGround(st.pending[i]);
        st.vehicles.push(st.pending[i]);
      } catch (e) {}
    }
    st.pending.length = 0;
  }

  function tickWrap(h) {
    if (!g.Game || g.Game.state !== 'playing') return;
    if (st.riding) {
      if (st.riding.gone) { dismount(true); return; }
      tickVehicle(st.riding, h);
    }
  }

  function onTouchRide() {
    if (st.riding) return;
    var v = nearest();
    if (v) enter(v);
  }

  function frameTick() {
    var playing = g.Game.state === 'playing';
    var v = st.riding ? null : nearest();
    if (st.prompt) {
      var txt = '';
      if (st.riding) txt = 'WASD dirige · E ou DESCER sai · H buzina';
      else if (v && playing) txt = 'Perto de ' + v.spec.name + ' — E para pilotar';
      st.prompt.textContent = txt;
      st.prompt.style.display = txt ? '' : 'none';
    }
    if (st.btnRide) { if (playing && !st.riding && v) st.btnRide.show(); else st.btnRide.hide(); }
    if (st.btnExit) { if (playing && st.riding) st.btnExit.show(); else st.btnExit.hide(); }
    if (st.btnHorn) { if (playing && st.riding) st.btnHorn.show(); else st.btnHorn.hide(); }
  }

  function ensureOk() { return g.G && g.World && g.World.col; }

  var poll = setInterval(function () {
    if (!ensureOk() || !window.THREE) return;
    clearInterval(poll);
    poll = null;
    try { setup(); }
    catch (err) { console.error('[VeicAPI] falha ao inicializar: ' + (err && err.message ? err.message : err)); }
  }, 250);
})();
