(function () {
  var g = (typeof api !== 'undefined' && api.game) ? api.game : null;
  if (!g) { console.error('[HotbarAPI] api.game indisponível — atualize o Limiar Mod Manager.'); return; }

  var S = { enabled: true };
  var st = { ready: false, bar: null, useBtn: null, items: [], active: null, activeId: null, unsubs: [] };

  api.register({
    id: 'hotbarapi',
    name: 'HotbarAPI',
    version: '1.0.0',
    description: 'API para outros mods criarem ITENS na barra rápida embaixo da tela (hotbar). Teclas 1-8 ou toque selecionam; aperte a MESMA tecla ou toque no MESMO slot de novo para desequipar (soltar a arma, por exemplo). Clique esquerdo ou botão USAR aciona o item selecionado. Mods usam window.LimiarHotbar.register(...).',
    settings: [
      { id: 'enabled', label: 'Mostrar hotbar na tela', type: 'toggle', default: true }
    ],
    onChange: function (v) {
      S.enabled = v.enabled !== false;
      applyVisible();
    }
  });

  window.LimiarHotbar = {
    version: 1,
    items: st.items,
    register: function (spec) {
      if (!spec || !spec.id || st.items.some(function (x) { return x.id === spec.id; })) return null;
      var item = {
        id: String(spec.id),
        icon: spec.icon === undefined ? '?' : String(spec.icon),
        label: spec.label === undefined ? String(spec.id) : String(spec.label),
        color: spec.color === undefined ? '#4a5560' : String(spec.color),
        onUse: typeof spec.onUse === 'function' ? spec.onUse : null,
        onSelect: typeof spec.onSelect === 'function' ? spec.onSelect : null,
        onDeselect: typeof spec.onDeselect === 'function' ? spec.onDeselect : null
      };
      st.items.push(item);
      refresh();
      return { remove: function () { clearItem(item); } };
    },
    select: function (id) { selectById(String(id)); },
    active: function () { return st.activeId ? st.activeId : null; },
    clear: function () {
      deselect();
      st.items.length = 0;
      refresh();
    }
  };

  function clearItem(item) {
    var i = st.items.indexOf(item);
    if (i < 0) return;
    if (st.active === item) deselect();
    st.items.splice(i, 1);
    refresh();
  }

  function deselect() {
    if (st.active && typeof st.active.onDeselect === 'function') { try { st.active.onDeselect(); } catch (e) { console.error('[HotbarAPI] onDeselect:', e); } }
    st.active = null;
    st.activeId = null;
    refresh();
  }

  function selectItem(item) {
    if (st.active === item) return;
    if (st.active && typeof st.active.onDeselect === 'function') { try { st.active.onDeselect(); } catch (e) { console.error('[HotbarAPI] onDeselect:', e); } }
    st.active = item;
    st.activeId = item.id;
    if (typeof item.onSelect === 'function') { try { item.onSelect(); } catch (e) { console.error('[HotbarAPI] onSelect:', e); } }
    refresh();
  }

  function selectById(id) {
    var i = st.items.findIndex(function (x) { return x.id === id; });
    if (i < 0) return;
    if (st.active === st.items[i]) deselect();
    else selectItem(st.items[i]);
  }

  function useActive() {
    if (!st.active || typeof st.active.onUse !== 'function') return;
    if (g.Game.state !== 'playing') return;
    try { st.active.onUse(); } catch (e) { console.error('[HotbarAPI] onUse:', e); }
  }

  function applyVisible() {
    if (st.bar) st.bar.style.display = S.enabled ? 'flex' : 'none';
  }

  function refresh() {
    if (!st.bar) return;
    var bar = st.bar;
    bar.textContent = '';
    for (var i = 0; i < st.items.length; i++) {
      var item = st.items[i];
      var slot = document.createElement('div');
      slot.className = 'limiar-slot' + (st.active === item ? ' on' : '');
      slot.innerHTML = '<b>' + (i + 1) + '</b>' + escapeHtml(item.icon);
      if (item.color) slot.style.borderColor = item.color;
      slot.title = item.label;
      (function (it, sl) {
        sl.addEventListener('pointerdown', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          var idx = st.items.indexOf(it);
          if (idx < 0) return;
          if (st.active === it) deselect();
          else selectItem(it);
        });
      })(item, slot);
      bar.appendChild(slot);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function setup() {
    if (st.ready) return;
    if (typeof api.fx !== 'object' || !api.fx || !api.fx.hud || !api.fx.onKey || !api.fx.onClick) return;
    st.ready = true;

    var css = '.limiar-hotbar{position:fixed;left:50%;bottom:calc(10px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9280;display:flex;gap:10px;pointer-events:none}' +
      '.limiar-slot{pointer-events:auto;width:56px;height:56px;border-radius:12px;background:rgba(16,18,22,.82);border:2px solid #4a5560;color:#fff;font:26px/50px sans-serif;text-align:center;user-select:none;-webkit-user-select:none;touch-action:manipulation;cursor:pointer;position:relative;box-shadow:0 4px 12px rgba(0,0,0,.5)}' +
      '.limiar-slot b{position:absolute;top:2px;left:5px;font:600 10px sans-serif;opacity:.7}' +
      '.limiar-slot.on{background:rgba(60,140,255,.35);border-color:#9adcff;box-shadow:0 0 14px rgba(90,170,255,.6)}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.className = 'limiar-hotbar';
    document.body.appendChild(bar);
    st.bar = bar;

    if (api.fx.hud.touchButton) {
      st.useBtn = api.fx.hud.touchButton({
        label: 'USAR',
        light: '#ffe6a8',
        base: '#8a6b1e',
        hidden: true,
        onTap: useActive
      });
    }

    for (var n = 1; n <= 8; n++) {
      (function (num) {
        st.unsubs.push(api.fx.onKey('Digit' + num, function () {
          var item = st.items[num - 1];
          if (!item) return;
          if (st.active === item) deselect();
          else selectItem(item);
        }));
      })(n);
    }
    st.unsubs.push(api.fx.onClick(function (ev) {
      if (ev.isTouch) return;
      useActive();
    }));

    g.onRender(function () {
      var playing = g.Game.state === 'playing';
      var needUse = playing && st.active && typeof st.active.onUse === 'function';
      if (st.useBtn) { if (needUse) st.useBtn.show(); else st.useBtn.hide(); }
    });

    applyVisible();
    refresh();
  }

  var poll = setInterval(function () {
    var fx = g.Gfx;
    if (!fx || !fx.renderer || !fx.scene || !fx.camera || !window.THREE || !g.G || !g.World || !g.World.col) return;
    clearInterval(poll);
    poll = null;
    try { setup(); }
    catch (err) { console.error('[HotbarAPI] falha ao inicializar: ' + (err && err.message ? err.message : err)); }
  }, 250);
})();
