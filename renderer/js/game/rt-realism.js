/* Vextra game runtime – Realism: hyper-realistic 3D look.
 *   VXRT.realismMaterial(T, o, base, sh, env)  physically based material (clear-coat, sheen, micro-surface detail) for the “Realism” 3D shader
 *   VXRT.realismDetail(T, env)                 procedural micro-surface normal + roughness maps (no image files needed)
 *   VXRT.realism.enable(g, on)                 filmic tone mapping, soft shadows, image-based sky lighting, tuned lights for the whole scene */
(function () {
  const VXRT = window.VXRT, U = VXRT.util;

  /* ---------- procedural micro-surface (value-noise fbm → normal map + roughness map) ---------- */
  function fbmField(N) {
    const hs = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; };
    const out = new Float32Array(N * N);
    for (let o = 0, f = 4, a = 0.5; o < 5; o++, f *= 2, a *= 0.5) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const fx = (x / N) * f, fy = (y / N) * f, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const g = (i, j) => hs((x0 + i) % f, (y0 + j) % f, o); // wraps, so the map tiles
        out[y * N + x] += a * ((g(0, 0) * (1 - sx) + g(1, 0) * sx) * (1 - sy) + (g(0, 1) * (1 - sx) + g(1, 1) * sx) * sy);
      }
    }
    return out;
  }
  VXRT.realismDetail = function (T, env) {
    if (env.__vxDetail) return env.__vxDetail; const N = 256, h = fbmField(N);
    const nc = document.createElement('canvas'), rc = document.createElement('canvas'); nc.width = nc.height = rc.width = rc.height = N; const nx = nc.getContext('2d'), rx = rc.getContext('2d'); const ni = nx.createImageData(N, N), ri = rx.createImageData(N, N);
    const H = (x, y) => h[((y + N) % N) * N + ((x + N) % N)];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (H(x - 1, y) - H(x + 1, y)) * 5, dy = (H(x, y - 1) - H(x, y + 1)) * 5, l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
      ni.data[i] = (dx / l * 0.5 + 0.5) * 255; ni.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; ni.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[i + 3] = 255;
      const r = 195 + H(x, y) * 60; ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = r; ri.data[i + 3] = 255;
    }
    nx.putImageData(ni, 0, 0); rx.putImageData(ri, 0, 0);
    const mk = (cv) => { const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(3, 3); t.anisotropy = 8; return t; };
    return (env.__vxDetail = { normal: mk(nc), rough: mk(rc) });
  };
  /** put the realism properties of a material asset (or shader settings) onto a MeshPhysicalMaterial */
  VXRT.realismApply = function (T, m, r, env) {
    const k = (v, d) => (v === undefined || v === null || v === '' ? d : +v);
    m.clearcoat = k(r.clearcoat, 0.25); m.clearcoatRoughness = k(r.clearcoatRoughness, 0.15); m.sheen = k(r.sheen, 0); m.sheenRoughness = 0.5; m.sheenColor = new T.Color(r.sheenColor || '#ffffff');
    m.transmission = k(r.transmission, 0); m.ior = U.clamp(k(r.ior, 1.45), 1, 2.4); m.thickness = k(r.thickness, 0); m.iridescence = k(r.iridescence, 0); m.specularIntensity = 1; m.envMapIntensity = k(r.envIntensity, 1.2);
    const d = k(r.detail, 0.5); if (d > 0 && env) { const dt = VXRT.realismDetail(T, env); m.normalMap = dt.normal; m.normalScale.set(d * 0.8, d * 0.8); m.roughnessMap = dt.rough; }
    m.needsUpdate = true; return m;
  };
  VXRT.realismMaterial = function (T, o, base, sh, env) {
    const s = U.clamp(U.num(sh.amount, 1), 0, 1) || 1; const mat = (base && base.isMeshStandardMaterial) ? base : null;
    const m = new T.MeshPhysicalMaterial({ color: (mat && mat.color) ? mat.color.clone() : new T.Color(o.color || '#cccccc'), map: (mat && mat.map) || null, vertexColors: !!(mat && mat.vertexColors), metalness: mat ? mat.metalness : 0.1, roughness: mat ? Math.min(1, mat.roughness) : 0.55, emissive: mat ? mat.emissive.clone() : new T.Color('#000000'), emissiveIntensity: mat ? mat.emissiveIntensity : 1, transparent: !!(mat && mat.transparent), opacity: mat ? mat.opacity : 1 });
    return VXRT.realismApply(T, m, { clearcoat: 0.3 * s, clearcoatRoughness: 0.15, sheen: 0.15 * s, detail: 0.55 * s, envIntensity: 1.25 }, env);
  };

  /* ---------- scene: filmic tone mapping, soft shadows, sky lighting ---------- */
  function skyEnv(T, renderer) {
    if (renderer.__vxRealEnv) return renderer.__vxRealEnv; const W = 1024, Hh = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const x = cv.getContext('2d');
    let g = x.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, '#4f86d6'); g.addColorStop(0.34, '#a9c9ee'); g.addColorStop(0.5, '#f3f1ea'); g.addColorStop(0.52, '#7a7468'); g.addColorStop(1, '#2b2926'); x.fillStyle = g; x.fillRect(0, 0, W, Hh);
    const sun = x.createRadialGradient(W * 0.28, Hh * 0.2, 2, W * 0.28, Hh * 0.2, 110); sun.addColorStop(0, '#fffbe8'); sun.addColorStop(0.18, '#fff4d0'); sun.addColorStop(1, 'rgba(255,244,208,0)'); x.fillStyle = sun; x.fillRect(0, 0, W, Hh);
    x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(W * 0.62, Hh * 0.14, 150, 38); x.fillRect(W * 0.8, Hh * 0.3, 90, 24); // soft-box reflections
    const eq = new T.CanvasTexture(cv); eq.mapping = T.EquirectangularReflectionMapping; eq.colorSpace = T.SRGBColorSpace; const pm = new T.PMREMGenerator(renderer); const tex = pm.fromEquirectangular(eq).texture; pm.dispose(); eq.dispose(); return (renderer.__vxRealEnv = tex);
  }
  VXRT.realism = {
    tuneLight(L) { try { if (L.isDirectionalLight || L.isSpotLight || L.isPointLight) { if (L.shadow) { L.shadow.mapSize.set(2048, 2048); L.shadow.bias = -0.0004; L.shadow.normalBias = 0.03; L.shadow.radius = 3; } } } catch { /* ignore */ } },
    /** (re)apply to the current 3D scene – called when the effect switches on and when a scene loads */
    apply(g) {
      const T = g.THREE, r = g.renderer3d; if (!T || !r || !g.scene3d) return; const o = g.realismOpts || {};
      r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = U.num(o.exposure, 1); r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap; r.setPixelRatio(Math.min(2, Math.max(1.5, window.devicePixelRatio || 1)));
      try { g.scene3d.environment = skyEnv(T, r); if ('environmentIntensity' in g.scene3d) g.scene3d.environmentIntensity = 1; } catch { /* PMREM unavailable */ }
      g.scene3d.traverse((n) => { if (n.isLight) this.tuneLight(n); if (n.isMesh && n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => { m.needsUpdate = true; }); });
    },
    enable(g, on, opts) {
      if (g.dim !== '3d' || !g.renderer3d) return; const T = g.THREE; g.realismOn = !!on; g.realismOpts = opts || g.realismOpts || {};
      if (on) { if (!g.__realBefore) g.__realBefore = { tm: g.renderer3d.toneMapping, ex: g.renderer3d.toneMappingExposure, st: g.renderer3d.shadowMap.type }; this.apply(g); }
      else if (g.__realBefore) { const b = g.__realBefore; g.renderer3d.toneMapping = b.tm; g.renderer3d.toneMappingExposure = b.ex; g.renderer3d.shadowMap.type = b.st; VXRT.studioEnv && VXRT.studioEnv(T, g.renderer3d, g.scene3d); g.__realBefore = null; g.scene3d.traverse((n) => { if (n.isMesh && n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => { m.needsUpdate = true; }); }); }
    },
  };
})();
