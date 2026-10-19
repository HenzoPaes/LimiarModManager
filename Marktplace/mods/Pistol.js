(function () {
  var g = (typeof api !== 'undefined' && api.game) ? api.game : null;
  if (!g) { console.error('[Pistol] api.game indisponível — atualize o Limiar Mod Manager.'); return; }

  var S = { enabled: true };
  var st = {
    ready: false, gun: null, flash: null, flashLight: null, item: null,
    btnShoot: null, selected: false, recoil: 0, slideBack: 0, lastT: 0
  };

  api.register({
    id: 'pistol',
    name: 'Pistol',
    version: '1.0.0',
    depends: ['HotbarAPI'],
    description: 'Dá uma pistola para o jogador matar os monstros! Aparece como item na HotbarAPI: teclas 1-8/toque selecionam, clique esquerdo (mira travada) ou botão ATIRAR dispara. Na criatura do jogo e na do Terror 10x: 3 tiros derrubam ela por um bom tempo.',
    settings: [
      { id: 'enabled', label: 'Pistola disponível', type: 'toggle', default: true }
    ],
    onChange: function (v) {
      S.enabled = v.enabled !== false;
      setupHotbarRegistration();
    }
  });

  function toast(msg) { if (typeof g.toast === 'function') g.toast(msg); }

  function setupHotbarRegistration() {
    if (!st.ready) return;
    if (S.enabled && !st.item) {
      st.item = (window.LimiarHotbar || {}).register ? window.LimiarHotbar.register({
        id: 'pistola',
        icon: '🔫',
        label: 'Pistola',
        color: '#c9a44a',
        onSelect: selectGun,
        onDeselect: deselectGun,
        onUse: shoot
      }) : null;
    } else if (!S.enabled && st.item !== null) {
      try { st.item.remove(); } catch (e) {}
      st.item = null;
      st.selected = false;
      if (st.gun) st.gun.visible = false;
    }
  }

  function hookHotbar() {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts++;
      if (typeof window.LimiarHotbar !== 'undefined' && window.LimiarHotbar.register) {
        clearInterval(timer);
        st.ready = true;
        setupHotbarRegistration();
      } else if (attempts > 60) {
        clearInterval(timer);
        console.error('[Pistol] HotbarAPI não encontrada — ative o mod HotbarAPI antes.');
        toast('Pistol precisa do mod HotbarAPI ativado antes.');
      }
    }, 250);
  }

  function buildGun(T) {
    var grp = new T.Group();
    var metal = new T.MeshLambertMaterial({ color: 0x35383f });
    var slide = new T.MeshLambertMaterial({ color: 0x4a4d55 });
    var wood = new T.MeshLambertMaterial({ color: 0x6b4a2a });

    var body = new T.Mesh(new T.BoxGeometry(0.075, 0.16, 0.5), metal);
    body.position.set(0, -0.02, -0.08);
    grp.add(body);

    var top = new T.Mesh(new T.BoxGeometry(0.08, 0.09, 0.44), slide);
    top.position.set(0, 0.095, -0.05);
    grp.add(top);
    st.slide = top;

    var barrel = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.1, 10), metal);
    barrel.rotation.x = -Math.PI / 2;
    barrel.position.set(0, 0.02, -0.36);
    grp.add(barrel);
    st.muzzle = new T.Object3D();
    st.muzzle.position.set(0, 0.02, -0.42);
    grp.add(st.muzzle);

    var grip = new T.Mesh(new T.BoxGeometry(0.07, 0.24, 0.11), wood);
    grip.position.set(0, -0.19, 0.07);
    grip.rotation.x = 0.28;
    grp.add(grip);

    var guard = new T.Mesh(new T.TorusGeometry(0.045, 0.012, 6, 14), metal);
    guard.position.set(0, -0.08, -0.02);
    guard.rotation.x = Math.PI / 2;
    grp.add(guard);

    st.flash = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), new T.MeshBasicMaterial({ color: 0xffd977, transparent: true, opacity: 0 }));
    st.flash.position.set(0, 0.02, -0.46);
    grp.add(st.flash);
    if (!g.G.touch) {
      st.flashLight = new T.PointLight(0xffc46a, 0, 6, 2);
      st.flashLight.position.set(0, 0.05, -0.45);
      grp.add(st.flashLight);
    } else {
      st.flashLight = null;
    }

    grp.position.set(0.26, -0.24, -0.42);
    grp.rotation.y = -0.06;
    grp.scale.setScalar(0.85);
    grp.visible = false;
    if (typeof api.fx === 'object' && api.fx) {
      if (api.fx.attachToCamera) api.fx.attachToCamera(grp);
      if (api.fx.exclude) api.fx.exclude(grp);
    } else {
      g.Gfx.camera.add(grp);
    }
    return grp;
  }

  function selectGun() {
    st.selected = true;
    if (st.gun) { st.gun.visible = true; }
    toast('Pistola na mão. Clique esquerdo ou ATIRAR para acertar os monstros.');
  }

  function deselectGun() {
    st.selected = false;
    if (st.gun) st.gun.visible = false;
  }

  function shoot() {
    if (!st.ready || !S.enabled || !st.selected || g.Game.state !== 'playing') return;
    if (typeof api.fx !== 'object' || !api.fx || !api.fx.spawnProjectile) return;
    var T = window.THREE, P = g.P;
    st.recoil = 1;
    st.slideBack = 1;

    if (st.flash) st.flash.material.opacity = 0.9;
    if (st.flashLight) st.flashLight.intensity = 2.2;
    setTimeout(function () {
      if (st.flash) st.flash.material.opacity = 0;
      if (st.flashLight) st.flashLight.intensity = 0;
    }, 70);

    try { api.fx.sound.noise({ freq: 2400, dur: 0.18, gain: 0.28 }); } catch (e) {}
    try { api.fx.sound.tone({ freq: 190, freq2: 55, dur: 0.14, gain: 0.25, type: 'square' }); } catch (e) {}

    var dir = new T.Vector3(0, 0, -1).applyQuaternion(g.Gfx.camera.quaternion);
    var origin = new T.Vector3(P.x, P.eyeY - 0.12, P.z).add(dir.clone().multiplyScalar(0.5));
    var bullet = new T.Mesh(
      new T.SphereGeometry(0.045, 8, 6),
      new T.MeshBasicMaterial({ color: 0xffe9a8 })
    );
    api.fx.spawnProjectile({
      mesh: bullet,
      position: { x: origin.x, y: origin.y, z: origin.z },
      dir: { x: dir.x, y: dir.y, z: dir.z },
      speed: 70,
      gravity: 0.8,
      ttl: 1.4,
      onHit: onBulletHit
    });
  }

  function onBulletHit(hit) {
    markerSound();
    spark(hit.point.x, hit.point.y, hit.point.z);

    if (typeof window.LimiarTerror !== 'undefined' && window.LimiarTerror.hit) {
      try {
        if (window.LimiarTerror.hit({ x: hit.point.x, y: hit.point.y, z: hit.point.z })) {
          toast('A criatura do terror foi de F! Volta em uns minutos.');
          screamFar();
          return;
        }
      } catch (e) {}
    }

    if (typeof api.strikeCreature === 'function') {
      var res = api.strikeCreature();
      if (res && res.hit) {
        if (res.killed) {
          try { api.fx.sound.noise({ freq: 800, dur: 0.4, gain: 0.3 }); } catch (e) {}
          try { api.fx.sound.tone({ freq: 420, freq2: 90, dur: 0.5, gain: 0.3, type: 'sawtooth' }); } catch (e) {}
          toast('Tiro fatal! A criatura desvaneceu. Ela volta em uns 40s.');
        } else {
          try { api.fx.sound.tone({ freq: 140, freq2: 110, dur: 0.15, gain: 0.2, type: 'sine' }); } catch (e) {}
        }
      }
    }
  }

  function markerSound() {
    try { api.fx.sound.tone({ freq: 900, freq2: 700, dur: 0.07, gain: 0.08, type: 'square' }); } catch (e) {}
  }

  function screamFar() {
    try { api.fx.sound.noise({ freq: 2600, dur: 0.7, gain: 0.35 }); } catch (e) {}
    try { api.fx.sound.tone({ freq: 950, freq2: 180, dur: 0.8, gain: 0.25, type: 'sawtooth' }); } catch (e) {}
  }

  function spark(x, y, z) {
    var T = window.THREE;
    if (!T || !api.fx || !api.fx.sphere) return;
    var s = api.fx.sphere({
      r: 0.09, segs: 6,
      color: 0xffeeb0,
      position: { x: x, y: y, z: z },
      opacity: 0.85
    });
    setTimeout(function () { if (s) api.fx.remove(s); }, 150);
  }

  function setup() {
    if (st.ready) return;
    var T = window.THREE;
    if (!T) return;
    if (typeof api.fx !== 'object' || !api.fx || !api.fx.spawnProjectile) return;
    st.gun = buildGun(T);
    st.btnShoot = typeof api.fx.hud === 'object' && api.fx.hud.touchButton ? api.fx.hud.touchButton({
      label: 'ATIRAR',
      light: '#ffd9a8',
      base: '#8a5a1e',
      hidden: true,
      onTap: shoot
    }) : null;

    api.fx.onClick(function (ev) {
      if (ev.isTouch) return;
      shoot();
    });

    g.onRender(function () {
      var now = performance.now() / 1000;
      var dt = st.lastT ? Math.min(0.05, now - st.lastT) : 0.016;
      st.lastT = now;
      if (st.gun && st.selected) {
        st.recoil = Math.max(0, st.recoil - dt * 6);
        var rec = st.recoil * st.recoil;
        st.slideBack = Math.max(0, st.slideBack - dt * 9);
        if (st.slide) st.slide.position.set(0, 0.095 + st.slideBack * 0.028, -0.05 + st.slideBack * 0.03);
        st.gun.rotation.x = -rec * 0.22;
        st.gun.position.z = -0.42 + rec * 0.035;
      }
      if (st.btnShoot) {
        if (st.selected && S.enabled && g.Game.state === 'playing' && g.G.touch) st.btnShoot.show();
        else st.btnShoot.hide();
      }
    });

    hookHotbar();
  }

  var poll = setInterval(function () {
    var fx = g.Gfx;
    if (!fx || !fx.renderer || !fx.scene || !fx.camera || !window.THREE || !g.G || !g.World || !g.World.col) return;
    clearInterval(poll);
    poll = null;
    try { setup(); }
    catch (err) { console.error('[Pistol] falha ao inicializar: ' + (err && err.message ? err.message : err)); }
  }, 250);
})();
