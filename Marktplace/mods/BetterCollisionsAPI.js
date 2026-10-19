/* BetterCollisionsAPI v1.0.0
   API pública e robusta de colisão para mods do Limiar.
   window.LimiarBetterCollisions.cast(from, dir, maxDist, opts)
   Retorna o primeiro hit integrando: colliders de box (World.col.all/large),
   raycast real de meshes visíveis e chão (World.col.ground).
   opts: { stepLen=1.2, ground=true, mesh=true }
*/
(function () {
  var g = (typeof api !== 'undefined' && api.game) ? api.game : null;
  if (!g) { console.error('[BetterCollisionsAPI] api.game indisponível — atualize o Limiar Mod Manager.'); return; }

  var T = (typeof window.THREE !== 'undefined') ? window.THREE : null;
  var st = { count: 0, ready: false, px: 0, py: 0, pz: 0, dx: 0, dy: 0, dz: 0, maxT: 0, hits: null };

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // Segmento vs AABB (slab). Retorna {t, axis, sign} ou null.
  function segAABB(px, py, pz, dx, dy, dz, b, maxT) {
    var t0 = 0, t1 = maxT, ax = -1, sg = 1;
    if (Math.abs(dx) < 1e-9) { if (px < b.x0 || px > b.x1) return null; }
    else {
      var inv = 1 / dx, ta = (b.x0 - px) * inv, tb = (b.x1 - px) * inv;
      if (ta > tb) { var tm = ta; ta = tb; tb = tm; }
      if (ta > t0) { t0 = ta; ax = 0; sg = dx > 0 ? -1 : 1; }
      if (tb < t1) t1 = tb;
      if (t0 > t1) return null;
    }
    if (Math.abs(dy) < 1e-9) { if (py < b.y0 || py > b.y1) return null; }
    else {
      var invy = 1 / dy, tya = (b.y0 - py) * invy, tyb = (b.y1 - py) * invy;
      if (tya > tyb) { var tym = tya; tya = tyb; tyb = tym; }
      if (tya > t0) { t0 = tya; ax = 1; sg = dy > 0 ? -1 : 1; }
      if (tyb < t1) t1 = tyb;
      if (t0 > t1) return null;
    }
    if (Math.abs(dz) < 1e-9) { if (pz < b.z0 || pz > b.z1) return null; }
    else {
      var invz = 1 / dz, tza = (b.z0 - pz) * invz, tzb = (b.z1 - pz) * invz;
      if (tza > tzb) { var tzm = tza; tza = tzb; tzb = tzm; }
      if (tza > t0) { t0 = tza; ax = 2; sg = dz > 0 ? -1 : 1; }
      if (tzb < t1) t1 = tzb;
      if (t0 > t1) return null;
    }
    return { t: t0, axis: ax, sign: sg };
  }

  function rampHeight(b, x, z) {
    if (typeof b.heightAt === 'function') { try { return b.heightAt(x, z); } catch (e) {} }
    var t;
    if ((b.x1 - b.x0) >= (b.z1 - b.z0)) t = clamp((x - b.x0) / Math.max(1e-6, b.x1 - b.x0), 0, 1);
    else t = clamp((z - b.z0) / Math.max(1e-6, b.z1 - b.z0), 0, 1);
    return b.y0 + (b.y1 - b.y0) * t;
  }

  function testBoxSeq(b) {
    if (b.ramp) {
      var steps = 6;
      for (var i = 1; i <= steps; i++) {
        var tt = i / steps;
        var x = st.px + st.dx * st.maxT * tt, z = st.pz + st.dz * st.maxT * tt, y = st.py + st.dy * st.maxT * tt;
        if (x >= b.x0 - 0.3 && x <= b.x1 + 0.3 && z >= b.z0 - 0.3 && z <= b.z1 + 0.3) {
          var h = rampHeight(b, x, z);
          if (y <= h) { st.hits.push({ t: st.maxT * tt, box: b, ramp: true, axis: 1, sign: 1 }); return; }
        }
      }
      return;
    }
    var r = segAABB(st.px, st.py, st.pz, st.dx, st.dy, st.dz, b, st.maxT);
    if (r) st.hits.push({ t: r.t + 0.001, box: b, axis: r.axis, sign: r.sign });
  }

  function makeResult(hit) {
    var point = { x: st.px + st.dx * hit.t, y: st.py + st.dy * hit.t, z: st.pz + st.dz * hit.t };
    var normal = { x: 0, y: 1, z: 0 };
    if (!hit.ground) {
      if (hit.axis === 0) normal = { x: hit.sign, y: 0, z: 0 };
      else if (hit.axis === 1) normal = { x: 0, y: hit.sign, z: 0 };
      else if (hit.axis === 2) normal = { x: 0, y: 0, z: hit.sign };
    } else {
      normal = { x: 0, y: 1, z: 0 };
    }
    if (hit.mesh && hit.face) {
      try { normal = { x: hit.face.normal.x, y: hit.face.normal.y, z: hit.face.normal.z }; } catch (e) {}
    }
    return {
      hit: true,
      dist: hit.t,
      point: point,
      normal: normal,
      type: hit.box ? 'collider' : (hit.ground ? 'ground' : 'mesh'),
      box: hit.box || null,
      mesh: hit.mesh || null,
      object: hit.mesh || null,
      seq: ++st.count
    };
  }

  var API = {
    version: '1.0.0',
    get ready() { return st.ready; },

    /* cast(from, dir, maxDist, opts) → { hit, dist, point, normal, type, box, mesh } */
    cast: function (from, dir, maxDist, opts) {
      opts = opts || {};
      var stepLen = opts.stepLen || 1.2;
      var useGround = opts.ground !== false;
      var useMesh = opts.mesh !== false;
      st.maxT = Math.max(0.01, maxDist);
      st.px = from.x; st.py = from.y; st.pz = from.z;
      var dl = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z) || 1;
      st.dx = dir.x / dl; st.dy = dir.y / dl; st.dz = dir.z / dl;
      st.hits = [];

      // 1) colliders
      try {
        var col = g.World && g.World.col;
        if (col && col.all) {
          for (var i = 0; i < col.all.length; i++) {
            var b = col.all[i];
            if (b.x0 > -1e9) testBoxSeq(b);
          }
        }
      } catch (e) {}

      var best = null;
      for (var c = 0; c < st.hits.length; c++) {
        if (best === null || st.hits[c].t < best.t) best = st.hits[c];
      }

      // 2) ground amostrado
      if (useGround && g.World && g.World.col && typeof g.World.col.ground === 'function') {
        var gsteps = Math.min(64, Math.ceil(st.maxT / stepLen));
        for (var s = 1; s <= gsteps; s++) {
          var gt = (s / gsteps) * st.maxT;
          var gx = st.px + st.dx * gt, gy = st.py + st.dy * gt, gz = st.pz + st.dz * gt;
          try {
            var gy2 = g.World.col.ground(gx, gz, gy, 0.6);
            if (gy2 !== null && gy2 !== undefined && gy <= gy2 && (gy2 - gy) < 1.2) {
              var gh = { t: gt, ground: true };
              if (best === null || gh.t < best.t) best = gh;
              break;
            }
          } catch (e) {}
        }
      }

      // 3) mesh raycast até o hit atual (visual) — também guardamos o primeiro mesh válido mesmo se o box ganhou
      var visibleMesh = null;
      if (useMesh && T && g.Gfx && g.Gfx.scene) {
        try {
          var rc = new T.Raycaster(
            new T.Vector3(st.px, st.py, st.pz),
            new T.Vector3(st.dx, st.dy, st.dz),
            0.01,
            best ? (best.t + 0.25) : st.maxT
          );
          var hits = rc.intersectObjects(g.Gfx.scene.children, true);
          for (var h2 = 0; h2 < hits.length; h2++) {
            var o = hits[h2].object;
            if (!o || !o.visible) continue;
            var skip = (o.userData && (o.userData.fxExclude || o.userData.fxProjectile));
            if (!skip && o.parent) {
              var p = o.parent, guard = 0;
              while (p && guard++ < 5) { if (p.userData && p.userData.fxExclude) { skip = true; break; } p = p.parent; }
            }
            if (skip) continue;
            var mh = { t: hits[h2].distance + 0.0005, mesh: o, face: hits[h2].face };
            if (!visibleMesh) visibleMesh = mh;
            if (best === null || mh.t < best.t) best = mh;
            break;
          }
        } catch (e) {}
      }

      if (best === null) {
        return { hit: false, dist: st.maxT, point: null, normal: null, type: 'none', box: null, mesh: null, object: null, seq: ++st.count };
      }
      var res = makeResult(best);
      if (best.box && !res.mesh && visibleMesh && Math.abs(visibleMesh.t - res.dist) < 2.5) {
        res.mesh = visibleMesh.mesh; res.object = visibleMesh.mesh; res.meshT = visibleMesh.t;
      }
      return res;
    },

    // Conveniência: ponto 3D do primeiro impacto (ou null)
    castPoint: function (from, dir, maxDist, fallback) {
      var r = API.cast(from, dir, maxDist);
      return r.hit ? { x: r.point.x, y: r.point.y, z: r.point.z } : (fallback || null);
    },

    lastCast: function () { return st.hits && st.hits.length ? st.hits : null; }
  };

  api.register({
    id: 'bettercollisionsapi',
    name: 'BetterCollisionsAPI',
    version: '1.0.0',
    description: 'API de colisão robusta para mods: cast por segmento (Raycaster + boxes World.col + ground). window.LimiarBetterCollisions',
    settings: [],
    onChange: function () {}
  });

  st.ready = true;
  try { window.LimiarBetterCollisions = API; window.BetterCollisionsAPI = API; } catch (e) {}
  try { if (typeof g.toast === 'function') g.toast('BetterCollisionsAPI v1.0 pronta'); } catch (e) {}
})();
