"use strict";
/* Piece 3D tab: single cubie, highlight one sticker, stickerless body.
   Lazy loads three.js like cube3d.js. API: window.BLD3.piece.show(q) */

(function () {
  const $ = (id) => document.getElementById(id);
  let THREE = null, OrbitControls = null;
  let renderer, scene, camera, controls, cubie, stickerGroup;
  let ready = false, failed = "";
  const texCache = new Map();

  const FACE_COLOR = { U: "#ffffff", D: "#ffd500", F: "#009b48", B: "#0046ad", R: "#b71234", L: "#ff5800" };
  const BLACK_GLYPH = new Set(["U", "D", "F", "L"]);
  const AXIS = { U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0] };

  function glyphTexture(face, glyph, opts = {}) {
    const hl = opts.highlight ? 1 : 0;
    const showLetter = opts.showLetter !== false;
    const key = face + "|" + glyph + "|" + hl + "|" + (showLetter ? 1 : 0);
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    // sticker background = face color
    g.fillStyle = FACE_COLOR[face];
    g.fillRect(0, 0, 256, 256);
    // thin inner stroke
    g.strokeStyle = "rgba(0,0,0,0.22)";
    g.lineWidth = 8;
    g.strokeRect(6, 6, 244, 244);
    if (hl) {
      // glowing highlight border
      g.strokeStyle = "#ffd166";
      g.lineWidth = 20;
      g.strokeRect(14, 14, 228, 228);
      // second outer glow
      g.shadowColor = "#ffd166";
      g.shadowBlur = 22;
      g.strokeStyle = "#ffec99";
      g.lineWidth = 6;
      g.strokeRect(20, 20, 216, 216);
      g.shadowBlur = 0;
    }
    if (showLetter && glyph) {
      g.fillStyle = BLACK_GLYPH.has(face) ? "#111111" : "#ffffff";
      g.font = "bold 120px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(glyph, 128, 140);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    texCache.set(key, tex);
    return tex;
  }

  function cubieMats() {
    if (!THREE) return [];
    const col = (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.45, metalness: 0.05 });
    // at origin, all 6 faces are exterior for single cubie view; we color all.
    // Order: +x, -x, +y, -y, +z, -z = R, L, U, D, F, B
    return [
      col(FACE_COLOR.R), col(FACE_COLOR.L),
      col(FACE_COLOR.U), col(FACE_COLOR.D),
      col(FACE_COLOR.F), col(FACE_COLOR.B),
    ];
  }

  function disposeMaterial(m) {
    if (!m) return;
    if (Array.isArray(m)) m.forEach((mm) => { if (mm.map) mm.map.dispose(); mm.dispose(); });
    else { if (m.map) m.map.dispose(); m.dispose(); }
  }

  function clearStickers() {
    if (!stickerGroup) return;
    stickerGroup.traverse((o) => {
      if (o.isMesh) disposeMaterial(o.material);
    });
    scene.remove(stickerGroup);
    stickerGroup = null;
  }

  // q = { pieceName, stickers:[{face,letter}], highlight:{face,letter}, type }
  function showPiece(q, opts) {
    if (!ready) return;
    const showOther = opts && opts.showOther !== undefined ? opts.showOther : true;

    clearStickers();

    // recreate cubie with face-colored mats
    if (cubie) { scene.remove(cubie); disposeMaterial(cubie.material); }
    const geo = new THREE.BoxGeometry(0.99, 0.99, 0.99);
    cubie = new THREE.Mesh(geo, cubieMats());
    scene.add(cubie);

    stickerGroup = new THREE.Group();
    const planeGeo = new THREE.PlaneGeometry(0.82, 0.82);

    for (const st of q.stickers) {
      const isHL = st.face === q.highlight.face;
      if (!isHL && !showOther) continue; // only highlight visible
      const axis = AXIS[st.face];
      const n = new THREE.Vector3(...axis);
      const mat = new THREE.MeshBasicMaterial({
        map: glyphTexture(st.face, st.letter, { highlight: isHL, showLetter: !isHL }),
      });
      const mesh = new THREE.Mesh(planeGeo, mat);
      // Slightly outside cubie surface
      mesh.position.copy(n).multiplyScalar(0.505);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      if (isHL) mesh.scale.set(1.06, 1.06, 1.06); // pop highlighted
      stickerGroup.add(mesh);
    }
    // Highlight sticker separately with letter visible but halo already
    // Add text-less glow plane behind? No, texture handles it.

    // Extra: big highlight letter plane slightly floating for readability? Keep hidden until reveal.
    scene.add(stickerGroup);

    // Camera: point towards highlight + average of other faces so piece looks 3D
    const hlAxis = new THREE.Vector3(...AXIS[q.highlight.face]);
    let avg = new THREE.Vector3(0, 0, 0);
    for (const s of q.stickers) avg.add(new THREE.Vector3(...AXIS[s.face]));
    avg.normalize();
    // bias 70% highlight, 30% avg, plus small camera jitter
    const camDir = new THREE.Vector3().copy(hlAxis).multiplyScalar(0.72).add(avg.multiplyScalar(0.28)).normalize();
    // If piece is e.g., UBL, avg would be (-0.57,0.57,-0.57)
    const dist = 2.4;
    camera.position.copy(camDir).multiplyScalar(dist);
    // keep up roughly world up, but avoid gimbal when looking from top/bottom
    controls.target.set(0, 0, 0);
    controls.update();
  }

  function revealHighlightLetter(letter) {
    if (!stickerGroup) return;
    // replace highlight mesh map with one that shows letter
    stickerGroup.children.forEach((m) => {
      // highlighted is scaled larger
      if (m.scale.x > 1.02) {
        // extract face from its quaternion? We stored? Instead use position sign.
        // We can just set map to glyph with showLetter true.
        const pos = m.position;
        let face = "U";
        if (pos.x > 0.4) face = "R"; else if (pos.x < -0.4) face = "L";
        else if (pos.y > 0.4) face = "U"; else if (pos.y < -0.4) face = "D";
        else if (pos.z > 0.4) face = "F"; else face = "B";
        m.material.map = glyphTexture(face, letter, { highlight: true, showLetter: true });
        m.material.needsUpdate = true;
      }
    });
  }

  function fit() {
    if (!ready) return;
    const wrap = $("piece-wrap");
    if (!wrap) return;
    const w = wrap.clientWidth || 300;
    const h = wrap.clientHeight || 360;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  async function init() {
    if (ready) return true;
    if (failed) return false;
    if (!window.BLD3) {
      const el = $("piece-feedback");
      if (el) { el.textContent = "Trainer core not loaded."; el.className = "feedback bad"; }
      return false;
    }
    try {
      THREE = await import("three");
      ({ OrbitControls } = await import("three/addons/controls/OrbitControls.js"));
    } catch (e) {
      failed = "Could not load three.js CDN";
      return false;
    }
    try {
      const wrap = $("piece-wrap");
      if (!wrap) return false;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      wrap.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
      camera.position.set(1.2, 1.2, 1.8);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.enablePan = false;
      controls.minDistance = 1.2;
      controls.maxDistance = 6;
      controls.target.set(0, 0, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.95));
      const dir = new THREE.DirectionalLight(0xffffff, 0.9);
      dir.position.set(3, 5, 4);
      scene.add(dir);

      ready = true;
      fit();
      const loop = () => { requestAnimationFrame(loop); if (!ready) return; controls.update(); renderer.render(scene, camera); };
      loop();
      return true;
    } catch (e) {
      failed = "WebGL unavailable";
      return false;
    }
  }

  // attach to global BLD3
  function ensureApi() {
    if (!window.BLD3) window.BLD3 = {};
    window.BLD3.piece = { init, show: showPiece, reveal: revealHighlightLetter, fit };
  }
  ensureApi();
  document.querySelectorAll(".tabs button").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.dataset.tab !== "piece") return;
      ensureApi();
      await init();
      requestAnimationFrame(fit);
    });
  });
  window.addEventListener("resize", fit);
  document.addEventListener("bld3-update", async () => {
    // scheme changed -> next question will refresh, but clear cache
    texCache.clear();
  });
})();
