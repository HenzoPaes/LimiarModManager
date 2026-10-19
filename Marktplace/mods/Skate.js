(function () {
  var g = (typeof api !== 'undefined' && api.game) ? api.game : null;
  if (!g) { console.error('[Skate] api.game indisponível — atualize o Limiar Mod Manager.'); return; }

  var S = { enabled: true };
  var st = { ready: false, item: null, veh: null, spawned: false };

  api.register({
    id: 'skate',
    name: 'Skate',
    version: '1.0.0',
    depends: ['HotbarAPI', 'VeicAPI'],
    description: 'Um skate pras ruas do jogo! Feito com a VeicAPI e colocando um item na HotbarAPI: selecione o item do skate e use (clique nos numero/toque USAR) para soltar o skate no chão. Chegue perto, aperte E ou toque PILOTAR para subir. Dirija com WASD/botões, carveie, e ouça as rodinhas chiando. Solte outro quando quiser.',
    settings: [
      { id: 'enabled', label: 'Skate disponível', type: 'toggle', default: true }
    ],
    onChange: function (v) {
      S.enabled = v.enabled !== false;
      setupRegistration();
    }
  });

  function toast(msg) { if (typeof g.toast === 'function') g.toast(msg); }

  function setupRegistration() {
    if (!st.ready) return;
    if (S.enabled && !st.item) {
      st.item = (window.LimiarHotbar || {}).register ? window.LimiarHotbar.register({
        id: 'skate',
        icon: '🛹',
        label: 'Skate',
        color: '#6ac1ff',
        onSelect: function () { toast('Usa o item (clique de novo ou USAR) para soltar o skate no chão.'); },
        onUse: toggleSkate
      }) : null;
    } else if (!S.enabled && st.item !== null) {
      try { st.item.remove(); } catch (e) {}
      st.item = null;
    }
  }

  function hookMods(attempts) {
    attempts = attempts || 0;
    var timer = setInterval(function () {
      attempts++;
      var hb = typeof window.LimiarHotbar !== 'undefined' && window.LimiarHotbar.register;
      var ve = typeof window.LimiarVehicles !== 'undefined' && window.LimiarVehicles.create;
      if (hb && ve) {
        clearInterval(timer);
        st.ready = true;
        setupRegistration();
      } else if (attempts > 60) {
        clearInterval(timer);
        console.error('[Skate] HotbarAPI/VeicAPI ausentes — ative esses mods antes.');
        toast('Skate precisa dos mods HotbarAPI e VeicAPI ativados antes.');
      }
    }, 250);
  }

  function buildSkate(T) {
    var grp = new T.Group();
    var deck = new T.MeshLambertMaterial({ color: 0xff9ab3 });
    var metal = new T.MeshLambertMaterial({ color: 0x555a63 });
    var moldura = new T.MeshLambertMaterial({ color: 0xf5d06f });

    var board = new T.Mesh(new T.BoxGeometry(0.34, 0.035, 1.02), deck);
    board.position.y = 0.185;
    grp.add(board);

    var nose = new T.Mesh(new T.CylinderGeometry(0.175, 0.175, 0.035, 12, 1, false, 0, Math.PI));
    nose.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
    nose.position.set(0, 0.185, 0.56);
    grp.add(nose);
    var tail = new T.Mesh(new T.CylinderGeometry(0.155, 0.155, 0.035, 12, 1, false, 0, Math.PI));
    tail.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
    tail.position.set(0, 0.185, -0.52);
    grp.add(tail);

    var wheels = [];
    for (var i = 0; i < 2; i++) {
      var truck = new T.Mesh(new T.BoxGeometry(0.2, 0.03, 0.07), metal);
      truck.position.set(0, 0.135, i === 0 ? 0.56 : -0.56);
      grp.add(truck);
    }
    var wg = new T.CylinderGeometry(0.075, 0.075, 0.06, 14);
    wg.rotateZ(Math.PI / 2);
    for (var j = 0; j < 4; j++) {
      var wheel = new T.Mesh(wg, moldura);
      wheel.position.set(j % 2 === 0 ? -0.19 : 0.19, 0.075, j < 2 ? 0.56 : -0.56);
      grp.add(wheel);
      wheels.push(wheel);
    }

    var stripes = new T.Mesh(new T.BoxGeometry(0.3, 0.004, 0.9), itBand(T));
    stripes.position.y = 0.205;
    grp.add(stripes);

    function itBand(T) {
      return new T.MeshLambertMaterial({ color: 0x2f6dd0 });
    }

    grp.visible = false;
    return { group: grp, wheels: wheels };
  }

  function toggleSkate() {
    if (!st.ready) return;
    if (st.veh && st.spawned) {
      try { st.veh.despawn(); } catch (e) {}
      st.veh = null;
      st.spawned = false;
      toast('Skate guardado no invisível.');
      return;
    }
    spawnSkate();
  }

  function spawnSkate() {
    if (!st.ready || typeof window.LimiarVehicles === 'undefined' || !window.LimiarVehicles.create) return;
    var T = window.THREE;
    if (!T) return;
    var P = g.P;
    var dir = new T.Vector3(0, 0, -1).applyQuaternion(g.Gfx.camera.quaternion);
    var x = P.x + dir.x * 1.4;
    var z = P.z + dir.z * 1.4;
    var gy = g.World.col.ground(x, z, P.y + 1.0, 0.5);
    var y = (gy > -Infinity && Math.abs(gy - P.y) < 2.5) ? gy : P.y;
    st.veh = window.LimiarVehicles.create({
      id: 'skate',
      name: 'Skate',
      build: buildSkate,
      maxSpeed: 8.2,
      accel: 4.2,
      turnRate: 3.0,
      radius: 0.45,
      seat: { x: 0, y: 0.22, z: 0 },
      eyeOffset: 0.25,
      rollSound: 'roll',
      hornTone: 660
    });
    if (st.veh) {
      st.veh.placeAt(x, y, z, Math.atan2(dir.x, dir.z));
      st.spawned = true;
      toast('Skate no chão! Chegue perto e aperte E (ou toque PILOTAR).');
      try { api.fx.sound.tone({ freq: 520, freq2: 780, dur: 0.2, gain: 0.12, type: 'triangle' }); } catch (e) {}
      try { api.fx.sound.noise({ freq: 900, dur: 0.25, gain: 0.1 }); } catch (e) {}
    }
  }

  function setup() {
    if (st.ready) return;
    var fx = g.Gfx;
    if (!fx || !fx.renderer || !fx.scene || !fx.camera || !window.THREE || !g.G || !g.World || !g.World.col) return;
    hookMods();
  }

  var poll = setInterval(function () {
    var fx = g.Gfx;
    if (!fx || !fx.renderer || !fx.scene || !fx.camera || !window.THREE || !g.G || !g.World || !g.World.col) return;
    clearInterval(poll);
    poll = null;
    try { setup(); }
    catch (err) { console.error('[Skate] falha ao inicializar: ' + (err && err.message ? err.message : err)); }
  }, 250);
})();
