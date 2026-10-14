"use strict";
/* Cube 3D tab: interactive Speffz cube via three.js (pinned CDN, lazy-loaded on
   first open — no build step). Letters come from the LIVE scheme through
   window.BLD3 (stock Speffz + Settings overrides), buffers get a gold border.
   Verify mapping by eye: UFR corner must read C (up) / J (front) / M (right). */

(function () {
  const $ = (id) => document.getElementById(id);

  let THREE = null, OrbitControls = null;
  let renderer, scene, camera, controls, raycaster, planeGeo;
  let stickerGroup = null;
  let stickerMeshes = [];
  let ready = false, failed = "";
  let mode = "explore", showPieces = "both";
  let findTarget = null, findAsked = 0, findCorrect = 0;
  const revealed = new Set();
  const texCache = new Map();

  const FACE_COLOR = { U: "#ffffff", D: "#ffd500", F: "#009b48", B: "#0046ad", R: "#b71234", L: "#ff5800" };
  const BLACK_GLYPH = new Set(["U", "D", "F", "L"]);
  const AXIS = { U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0] };
  const HOME_POS = [4.4, 3.6, 5.4];

  function glyphTexture(face, glyph, buffer) {
    const key = face + "|" + glyph + "|" + (buffer ? 1 : 0);
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = FACE_COLOR[face];
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = "rgba(0,0,0,0.25)";
    g.lineWidth = 6;
    g.strokeRect(3, 3, 122, 122);
    if (buffer) {
      g.strokeStyle = "#ffd166";
      g.lineWidth = 12;
      g.strokeRect(8, 8, 112, 112);
    }
    if (glyph) {
      g.fillStyle = BLACK_GLYPH.has(face) ? "#111111" : "#ffffff";
      g.font = "bold 68px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(glyph, 64, 70);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    texCache.set(key, tex);
    return tex;
  }

  // "UBL" -> (-1, +1, -1): each letter in the piece name picks its axis sign.
  function pieceCoord(piece) {
    const v = new THREE.Vector3(0, 0, 0);
    if (piece.includes("U")) v.y = 1;
    if (piece.includes("D")) v.y = -1;
    if (piece.includes("F")) v.z = 1;
    if (piece.includes("B")) v.z = -1;
    if (piece.includes("R")) v.x = 1;
    if (piece.includes("L")) v.x = -1;
    return v;
  }

  function pool() {
    const out = [];
    if (showPieces !== "corners") out.push(...window.BLD3.effEdges().map((s) => ({ ...s, type: "Edge" })));
    if (showPieces !== "edges") out.push(...window.BLD3.effCorners().map((s) => ({ ...s, type: "Corner" })));
    return out;
  }

  function addSticker(coord, face, glyph, userData, buffer) {
    const n = new THREE.Vector3(...AXIS[face]);
    const mesh = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: glyphTexture(face, glyph, buffer) }));
    mesh.position.copy(coord).addScaledVector(n, 0.481);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    mesh.userData = userData;
    stickerGroup.add(mesh);
    stickerMeshes.push(mesh);
  }

  function rebuild() {
    if (stickerGroup) {
      stickerGroup.traverse((o) => {
        if (o.isMesh) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      });
      scene.remove(stickerGroup);
    }
    stickerMeshes = [];
    revealed.clear();
    stickerGroup = new THREE.Group();
    const bufs = window.BLD3.buffers();
    for (const s of pool()) {
      const isBuf = (s.type === "Edge" ? bufs.edge : bufs.corner) === s.piece;
      addSticker(
        pieceCoord(s.piece),
        s.face,
        mode === "flash" ? "?" : s.letter,
        { key: s.piece + "|" + s.face, piece: s.piece, face: s.face, letter: s.letter, type: s.type, buffer: isBuf },
        isBuf
      );
    }
    // Blank center stickers so the cube reads as a cube.
    for (const face of Object.keys(AXIS)) {
      addSticker(new THREE.Vector3(0, 0, 0), face, "", { center: true }, false);
    }
    scene.add(stickerGroup);
  }

  function stickerLabel(u) {
    return `${u.type} · ${u.face} sticker of ${u.piece}`;
  }

  function updateScore() {
    $("cube-score").textContent = findAsked ? `Find ${findCorrect}/${findAsked}` : "";
  }

  function newFindPrompt() {
    const list = pool();
    if (!list.length) {
      findTarget = null;
      $("cube-prompt").textContent = "—";
      return;
    }
    findTarget = list[Math.floor(Math.random() * list.length)];
    $("cube-prompt").textContent = `Find ${findTarget.type} “${findTarget.letter}”`;
    updateScore();
  }

  function refreshPrompt() {
    if (mode === "find") {
      newFindPrompt();
    } else {
      findTarget = null;
      $("cube-prompt").textContent = mode === "flash" ? "Tap stickers to reveal." : "Tap any sticker to name it.";
      $("cube-score").textContent = "";
    }
  }

  function handleSticker(mesh) {
    const u = mesh.userData;
    const readout = $("cube-readout");
    if (mode === "explore") {
      readout.textContent = `${stickerLabel(u)} → ${u.letter}`;
      readout.className = "feedback good";
    } else if (mode === "flash") {
      if (!revealed.has(u.key)) {
        revealed.add(u.key);
        mesh.material.map = glyphTexture(u.face, u.letter, u.buffer);
        mesh.material.needsUpdate = true;
      }
      readout.textContent = `${stickerLabel(u)} → ${u.letter}`;
      readout.className = "feedback good";
    } else {
      if (!findTarget) return;
      findAsked++;
      if (u.letter === findTarget.letter && u.type === findTarget.type) {
        findCorrect++;
        readout.textContent = `Correct ✓ — ${stickerLabel(u)} is ${u.letter}`;
        readout.className = "feedback good";
        updateScore();
        setTimeout(() => { if (mode === "find") newFindPrompt(); }, 800);
      } else {
        readout.textContent = `That is ${u.letter} (${stickerLabel(u)}). Keep looking for ${findTarget.type} ${findTarget.letter}.`;
        readout.className = "feedback bad";
        updateScore();
      }
    }
  }

  let downX = 0, downY = 0;
  function onPointerDown(e) {
    downX = e.clientX;
    downY = e.clientY;
  }
  function onPointerUp(e) {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return; // was a drag
    const rect = renderer.domElement.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const py = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(px, py), camera);
    const hits = raycaster.intersectObjects(stickerMeshes.filter((m) => m.visible), false);
    if (!hits.length) return;
    const u = hits[0].object.userData;
    if (u.center) return;
    handleSticker(hits[0].object);
  }

  function fit() {
    if (!ready) return;
    const wrap = $("cube-wrap");
    const w = wrap.clientWidth || 300;
    const h = wrap.clientHeight || 420;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function fail(msg) {
    failed = msg;
    $("cube-readout").textContent = msg;
    $("cube-readout").className = "feedback bad";
    return false;
  }

  async function init() {
    if (ready) return true;
    if (failed) return false;
    if (!window.BLD3) return fail("Trainer core did not load — reload the page.");
    try {
      THREE = await import("three");
      ({ OrbitControls } = await import("three/addons/controls/OrbitControls.js"));
    } catch (err) {
      return fail("Could not load three.js from the CDN — check your connection, then reopen this tab.");
    }
    let gl;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      gl = renderer.getContext();
    } catch (err) {
      gl = null;
    }
    if (!gl) return fail("WebGL is unavailable in this browser.");
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    $("cube-wrap").appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(...HOME_POS);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 14;

    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(4, 6, 5);
    scene.add(dir);

    const cubieGeo = new THREE.BoxGeometry(0.95, 0.95, 0.95);
    const cubieMat = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.6, metalness: 0.1 });
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (!x && !y && !z) continue;
          const c = new THREE.Mesh(cubieGeo, cubieMat);
          c.position.set(x, y, z);
          scene.add(c);
        }
      }
    }
    planeGeo = new THREE.PlaneGeometry(0.8, 0.8);
    raycaster = new THREE.Raycaster();
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    mode = $("cube-mode").value;
    showPieces = $("cube-pieces").value;
    rebuild();
    refreshPrompt();
    fit();
    ready = true;
    const loop = () => {
      requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();
    return true;
  }

  // Open tab -> lazy init, then fit once the panel is laid out.
  document.querySelectorAll(".tabs button").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.dataset.tab !== "cube") return;
      await init();
      requestAnimationFrame(fit);
    });
  });
  window.addEventListener("resize", fit);
  document.addEventListener("bld3-update", () => {
    if (ready) {
      rebuild();
      refreshPrompt();
    }
  });
  $("cube-pieces").addEventListener("change", (e) => {
    showPieces = e.target.value;
    findTarget = null;
    findAsked = findCorrect = 0;
    if (ready) {
      rebuild();
      refreshPrompt();
    }
  });
  $("cube-mode").addEventListener("change", (e) => {
    mode = e.target.value;
    findTarget = null;
    findAsked = findCorrect = 0;
    if (ready) {
      rebuild();
      refreshPrompt();
    }
  });
  $("cube-new").addEventListener("click", async () => {
    if (!(await init())) return;
    if (mode === "explore") {
      camera.position.set(...HOME_POS);
      controls.target.set(0, 0, 0);
      $("cube-readout").textContent = "Camera reset.";
      $("cube-readout").className = "feedback";
    } else if (mode === "flash") {
      rebuild();
      refreshPrompt();
      $("cube-readout").textContent = "Hidden again — tap to reveal.";
      $("cube-readout").className = "feedback";
    } else {
      if (findTarget) findAsked++; // skipping counts as a miss
      newFindPrompt();
    }
  });
})();
