"use strict";
/* 3BLD Trainer — static single-page app, no build step, no server.
   Data lives in localStorage under KEY. */

/* ---------- Speffz data (community standard; verify against README tables) ---------- */
// Each sticker: the piece it belongs to + the face the sticker sits on + its letter.
// Edges and corners each reuse A–X in separate namespaces.
const EDGES = [
  { piece: "UB", face: "U", letter: "A" }, { piece: "UR", face: "U", letter: "B" },
  { piece: "UF", face: "U", letter: "C" }, { piece: "UL", face: "U", letter: "D" },
  { piece: "UL", face: "L", letter: "E" }, { piece: "FL", face: "L", letter: "F" },
  { piece: "DL", face: "L", letter: "G" }, { piece: "BL", face: "L", letter: "H" },
  { piece: "UF", face: "F", letter: "I" }, { piece: "FR", face: "F", letter: "J" },
  { piece: "DF", face: "F", letter: "K" }, { piece: "FL", face: "F", letter: "L" },
  { piece: "UR", face: "R", letter: "M" }, { piece: "BR", face: "R", letter: "N" },
  { piece: "DR", face: "R", letter: "O" }, { piece: "FR", face: "R", letter: "P" },
  { piece: "UB", face: "B", letter: "Q" }, { piece: "BL", face: "B", letter: "R" },
  { piece: "DB", face: "B", letter: "S" }, { piece: "BR", face: "B", letter: "T" },
  { piece: "DF", face: "D", letter: "U" }, { piece: "DR", face: "D", letter: "V" },
  { piece: "DB", face: "D", letter: "W" }, { piece: "DL", face: "D", letter: "X" },
];
const CORNERS = [
  { piece: "UBL", face: "U", letter: "A" }, { piece: "UBR", face: "U", letter: "B" },
  { piece: "UFR", face: "U", letter: "C" }, { piece: "UFL", face: "U", letter: "D" },
  { piece: "UBL", face: "L", letter: "E" }, { piece: "UFL", face: "L", letter: "F" },
  { piece: "DFL", face: "L", letter: "G" }, { piece: "DBL", face: "L", letter: "H" },
  { piece: "UFL", face: "F", letter: "I" }, { piece: "UFR", face: "F", letter: "J" },
  { piece: "DFR", face: "F", letter: "K" }, { piece: "DFL", face: "F", letter: "L" },
  { piece: "UFR", face: "R", letter: "M" }, { piece: "UBR", face: "R", letter: "N" },
  { piece: "DBR", face: "R", letter: "O" }, { piece: "DFR", face: "R", letter: "P" },
  { piece: "UBR", face: "B", letter: "Q" }, { piece: "UBL", face: "B", letter: "R" },
  { piece: "DBL", face: "B", letter: "S" }, { piece: "DBR", face: "B", letter: "T" },
  { piece: "DFL", face: "D", letter: "U" }, { piece: "DFR", face: "D", letter: "V" },
  { piece: "DBR", face: "D", letter: "W" }, { piece: "DBL", face: "D", letter: "X" },
];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWX".split(""); // A–X, no Y/Z
const EDGE_PIECES = ["UB","UR","UF","UL","FR","FL","BR","BL","DF","DR","DB","DL"];
const CORNER_PIECES = ["UBL","UBR","UFR","UFL","DFL","DFR","DBR","DBL"];

// Active lettering = stock Speffz + user overrides (Settings → Letter scheme).
const stickerKey = (s) => s.piece + "|" + s.face;
function effStickers(base, over) {
  return base.map((s) => ({ ...s, letter: (over && over[stickerKey(s)]) || s.letter }));
}
const effEdges = () => effStickers(EDGES, store.scheme && store.scheme.edges);
const effCorners = () => effStickers(CORNERS, store.scheme && store.scheme.corners);

/* ---------- Store ---------- */
const KEY = "bld3.trainer.v1";
const DEFAULTS = {
  pairs: {},
  settings: {
    edgeBuffer: "DF", cornerBuffer: "UFR",
    drillPieces: "both", drillDir: "s2l", drillMode: "choice", noBuffer: true,
    memoLen: 6, memoMode: "letters", memoPeek: 0, theme: "dark",
  },
  times: [],
  drill: { asked: 0, correct: 0, streak: 0, best: 0 },
  scheme: null, // {edges:{key:letter},corners:{...}} overrides, or null = stock Speffz
};
let store;
function loadStore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const s = JSON.parse(raw);
    return {
      pairs: s.pairs || {},
      settings: Object.assign({}, DEFAULTS.settings, s.settings || {}),
      times: Array.isArray(s.times) ? s.times : [],
      drill: Object.assign({}, DEFAULTS.drill, s.drill || {}),
      scheme: s.scheme || null,
    };
  } catch { return structuredClone(DEFAULTS); }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {} }
store = loadStore();

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];
function sample(arr, n) {
  const c = arr.slice();
  for (let i = c.length - 1; i > 0; i--) { const j = rand(i + 1); [c[i], c[j]] = [c[j], c[i]]; }
  return c.slice(0, n);
}
const stickerLabel = (s) => `${s.face} sticker of ${s.piece}`;
function fmtTime(ms) {
  if (ms == null || !isFinite(ms)) return "DNF";
  const total = Math.round(ms / 10) / 100; // centiseconds
  const m = Math.floor(total / 60), sec = (total % 60);
  return (m > 0 ? m + ":" + sec.toFixed(2).padStart(5, "0") : sec.toFixed(2));
}
function effectiveMs(t) {
  if (t.penalty === "DNF") return Infinity;
  return t.ms + (t.penalty === "+2" ? 2000 : 0);
}
function averageOf(list, n) {
  const last = list.slice(-n);
  if (last.length < n) return null;
  const eff = last.map(effectiveMs).sort((a, b) => a - b);
  const inner = n >= 5 ? eff.slice(1, -1) : eff; // drop best+worst for ao5/ao12
  if (inner.some((v) => !isFinite(v))) return Infinity;
  return inner.reduce((a, b) => a + b, 0) / inner.length;
}

/* ---------- Tabs ---------- */
document.querySelectorAll(".tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $("tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "timer") stopTimerRaf(); // reset display state
  });
});

/* ---------- Theme ---------- */
function applyTheme() { document.documentElement.dataset.theme = store.settings.theme || "dark"; }

/* ---------- Learn ---------- */
let learnType = "edges";
let learnCards = false; // flashcard mode: tap a sticker to reveal its letter
const learnRevealed = new Set();
function renderLearn() {
  const data = learnType === "edges" ? effEdges() : effCorners();
  const buffer = learnType === "edges" ? store.settings.edgeBuffer : store.settings.cornerBuffer;
  const grid = $("learn-grid");
  grid.innerHTML = "";
  for (const face of ["U", "L", "F", "R", "B", "D"]) {
    const block = document.createElement("div");
    block.className = "face-block";
    const h = document.createElement("h3");
    h.textContent = face + " face";
    block.appendChild(h);
    for (const s of data.filter((s) => s.face === face)) {
      const d = document.createElement("div");
      d.className = "sticker" + (s.piece === buffer ? " buffer" : "");
      const left = document.createElement("span");
      left.textContent = s.piece;
      const right = document.createElement("span");
      right.className = "letter";
      const key = stickerKey(s);
      if (learnCards && !learnRevealed.has(key)) {
        right.textContent = "?";
        d.classList.add("cardback");
        d.title = "Tap to reveal";
        d.addEventListener("click", () => { learnRevealed.add(key); renderLearn(); });
      } else {
        right.textContent = s.letter;
      }
      d.appendChild(left); d.appendChild(right);
      block.appendChild(d);
    }
    grid.appendChild(block);
  }
  $("learn-edges-btn").classList.toggle("active", learnType === "edges");
  $("learn-corners-btn").classList.toggle("active", learnType === "corners");
}
$("learn-edges-btn").addEventListener("click", () => { learnType = "edges"; renderLearn(); });
$("learn-corners-btn").addEventListener("click", () => { learnType = "corners"; renderLearn(); });
$("learn-cards-btn").addEventListener("click", () => {
  learnCards = !learnCards;
  learnRevealed.clear();
  $("learn-cards-btn").classList.toggle("active", learnCards);
  renderLearn();
});

/* ---------- Drill ---------- */
let drillQ = null, drillLock = false;
function drillPool() {
  const pieces = $("drill-pieces").value;
  let pool = [];
  if (pieces === "both" || pieces === "edges") pool = pool.concat(effEdges().map((s) => ({ ...s, type: "Edge" })));
  if (pieces === "both" || pieces === "corners") pool = pool.concat(effCorners().map((s) => ({ ...s, type: "Corner" })));
  if ($("drill-nobuffer").checked) {
    pool = pool.filter((s) => s.piece !== store.settings.edgeBuffer && s.piece !== store.settings.cornerBuffer);
  }
  return pool;
}
function drillDir() {
  const d = $("drill-dir").value;
  return d === "mixed" ? (Math.random() < 0.5 ? "s2l" : "l2s") : d;
}
function renderDrillStats() {
  $("drill-correct").textContent = store.drill.correct;
  $("drill-asked").textContent = store.drill.asked;
  $("drill-streak").textContent = store.drill.streak;
  $("drill-best").textContent = store.drill.best;
}
function setFeedback(msg, cls) {
  const f = $("drill-feedback");
  f.textContent = msg;
  f.className = "feedback" + (cls ? " " + cls : "");
}
function nextDrill() {
  const pool = drillPool();
  if (!pool.length) { setFeedback("Pool is empty — uncheck “Skip buffers” or widen pieces.", "bad"); return; }
  const dir = drillDir();
  const answer = pick(pool);
  const mode = $("drill-mode").value;
  drillQ = { answer, dir };
  drillLock = false;
  setFeedback("", "");
  $("drill-opts").innerHTML = "";
  if (dir === "s2l") {
    $("drill-q").textContent = `${answer.type}: ${stickerLabel(answer)} = ?`;
    if (mode === "choice") {
      $("drill-type").classList.add("hidden");
      const distract = sample(pool.filter((s) => s.letter !== answer.letter), 3);
      const opts = sample([answer, ...distract], Math.min(4, distract.length + 1));
      for (const o of opts) {
        const b = document.createElement("button");
        b.textContent = o.letter + (o.type !== answer.type ? ` (${o.type})` : "");
        b.addEventListener("click", () => gradeDrill(o.letter === answer.letter, b));
        $("drill-opts").appendChild(b);
      }
    } else {
      $("drill-type").classList.remove("hidden");
      $("drill-input").value = "";
      setTimeout(() => $("drill-input").focus(), 0);
    }
  } else {
    $("drill-q").textContent = `${answer.type} letter “${answer.letter}” = which sticker?`;
    $("drill-type").classList.add("hidden");
    const distract = sample(pool.filter((s) => !(s.piece === answer.piece && s.face === answer.face)), 3);
    const opts = sample([answer, ...distract], Math.min(4, distract.length + 1));
    for (const o of opts) {
      const b = document.createElement("button");
      b.textContent = stickerLabel(o);
      b.addEventListener("click", () => gradeDrill(o.piece === answer.piece && o.face === answer.face, b));
      $("drill-opts").appendChild(b);
    }
  }
}
function gradeDrill(ok, btn) {
  if (drillLock || !drillQ) return;
  drillLock = true;
  store.drill.asked++;
  if (ok) {
    store.drill.correct++;
    store.drill.streak++;
    store.drill.best = Math.max(store.drill.best, store.drill.streak);
    setFeedback("Correct ✓", "good");
    if (btn) btn.classList.add("right");
  } else {
    store.drill.streak = 0;
    const a = drillQ.answer;
    const truth = drillQ.dir === "s2l" ? a.letter : stickerLabel(a);
    setFeedback(`Not quite — answer: ${truth}`, "bad");
    if (btn) btn.classList.add("wrong");
  }
  save(); renderDrillStats();
  setTimeout(() => { if (drillLock) nextDrill(); }, ok ? 700 : 1600);
}
function buildLetterPad() {
  const pad = $("letterpad");
  pad.innerHTML = "";
  for (const L of LETTERS) {
    const b = document.createElement("button");
    b.textContent = L;
    b.addEventListener("click", () => { $("drill-input").value = L; gradeDrillType(); });
    pad.appendChild(b);
  }
}
function gradeDrillType() {
  if (drillLock || !drillQ) return;
  const v = $("drill-input").value.trim().toUpperCase();
  if (!v) return;
  gradeDrill(v === drillQ.answer.letter, null);
}
$("drill-next").addEventListener("click", nextDrill);
$("drill-reveal").addEventListener("click", () => gradeDrill(false, null));
$("drill-submit").addEventListener("click", gradeDrillType);
$("drill-input").addEventListener("keydown", (e) => { if (e.key === "Enter") gradeDrillType(); });
$("drill-reset").addEventListener("click", () => {
  store.drill = { asked: 0, correct: 0, streak: 0, best: 0 };
  save(); renderDrillStats(); setFeedback("", "");
});
for (const id of ["drill-pieces", "drill-dir", "drill-mode", "drill-nobuffer"]) {
  $(id).addEventListener("change", () => {
    store.settings.drillPieces = $("drill-pieces").value;
    store.settings.drillDir = $("drill-dir").value;
    store.settings.drillMode = $("drill-mode").value;
    store.settings.noBuffer = $("drill-nobuffer").checked;
    save(); nextDrill();
  });
}

/* ---------- Pairs ---------- */
const normPair = (s) => s.trim().toUpperCase().replace(/[^A-X]/g, "").slice(0, 2);
function renderPairs() {
  const keys = Object.keys(store.pairs).sort();
  $("pairs-count").textContent = keys.length ? `${keys.length} pair${keys.length === 1 ? "" : "s"} saved.` : "No pairs yet — add your first two above.";
  const ul = $("pairs-list");
  ul.innerHTML = "";
  for (const k of keys) {
    const li = document.createElement("li");
    const pk = document.createElement("span"); pk.className = "pk"; pk.textContent = k;
    const pw = document.createElement("span"); pw.className = "pw"; pw.textContent = store.pairs[k];
    const del = document.createElement("button"); del.className = "ghost"; del.textContent = "Delete";
    del.addEventListener("click", () => { delete store.pairs[k]; save(); renderPairs(); });
    li.append(pk, pw, del);
    ul.appendChild(li);
  }
}
$("pair-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const k = normPair($("pair-key").value);
  const w = $("pair-word").value.trim();
  if (k.length !== 2) { alert("Pair must be two letters A–X."); return; }
  if (!w) { alert("Give the pair a word or image."); return; }
  store.pairs[k] = w;
  save(); renderPairs();
  $("pair-key").value = ""; $("pair-word").value = "";
  $("pair-key").focus();
});
$("pairs-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(store.pairs, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "letter-pairs.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
$("pairs-import-btn").addEventListener("click", () => $("pairs-import-file").click());
$("pairs-import-file").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const obj = JSON.parse(r.result);
      let n = 0;
      for (const [k, v] of Object.entries(obj)) {
        const nk = normPair(k);
        if (nk.length === 2 && typeof v === "string" && v.trim()) { store.pairs[nk] = v.trim(); n++; }
      }
      save(); renderPairs();
      alert(`Imported ${n} pairs.`);
    } catch { alert("That file is not valid JSON."); }
  };
  r.readAsText(f);
  e.target.value = "";
});
// Pairs quiz (self-graded flashcards)
let pqCurrent = null, pqGot = 0, pqTotal = 0;
function pqNext() {
  const keys = Object.keys(store.pairs);
  if (!keys.length) { alert("Save some pairs first."); return; }
  pqCurrent = pick(keys);
  $("pairs-quiz").classList.remove("hidden");
  $("pq-pair").textContent = pqCurrent;
  $("pq-word").textContent = "";
  $("pq-reveal").classList.remove("hidden");
  $("pq-got").classList.add("hidden");
  $("pq-missed").classList.add("hidden");
  $("pq-score").textContent = pqTotal ? `${pqGot}/${pqTotal}` : "";
}
$("pairs-quiz-btn").addEventListener("click", pqNext);
$("pq-reveal").addEventListener("click", () => {
  if (!pqCurrent) return;
  $("pq-word").textContent = store.pairs[pqCurrent];
  $("pq-reveal").classList.add("hidden");
  $("pq-got").classList.remove("hidden");
  $("pq-missed").classList.remove("hidden");
});
function pqGrade(ok) {
  pqTotal++;
  if (ok) pqGot++;
  $("pq-score").textContent = `${pqGot}/${pqTotal}`;
  pqNext();
}
$("pq-got").addEventListener("click", () => pqGrade(true));
$("pq-missed").addEventListener("click", () => pqGrade(false));

/* ---------- Memo ---------- */
let memoTarget = "", memoCountdown = null;
function memoGen() {
  let len = Math.max(2, Math.min(24, parseInt($("memo-len").value, 10) || 6));
  if ($("memo-mode").value === "pairs" && len % 2 === 1) len++;
  memoTarget = Array.from({ length: len }, () => pick(LETTERS)).join("");
  const grouped = memoTarget.replace(/(..)/g, "$1 ").trim();
  $("memo-seq").textContent = grouped;
  $("memo-seq").classList.remove("muted");
  const hints = $("memo-hints");
  hints.innerHTML = "";
  for (let i = 0; i < memoTarget.length; i += 2) {
    const p = memoTarget.slice(i, i + 2);
    if (p.length < 2) continue;
    const s = document.createElement("span");
    s.textContent = store.pairs[p] ? `${p} → ${store.pairs[p]}` : `${p} → (no word yet)`;
    hints.appendChild(s);
  }
  $("memo-result").textContent = "";
  $("memo-result").className = "feedback";
  $("memo-input").value = "";
  clearInterval(memoCountdown);
  const peek = Math.max(0, Math.min(120, parseInt($("memo-peek").value, 10) || 0));
  if (peek > 0) {
    let left = peek;
    $("memo-timer").textContent = `hiding in ${left}s…`;
    memoCountdown = setInterval(() => {
      left--;
      if (left <= 0) { clearInterval(memoCountdown); memoHide(); $("memo-timer").textContent = "hidden — recall!"; }
      else $("memo-timer").textContent = `hiding in ${left}s…`;
    }, 1000);
  } else {
    $("memo-timer").textContent = "manual — press Hide when memorised.";
  }
}
function memoHide() { $("memo-seq").textContent = "•••••"; $("memo-seq").classList.add("muted"); }
function memoShow() {
  if (!memoTarget) return;
  $("memo-seq").textContent = memoTarget.replace(/(..)/g, "$1 ").trim();
  $("memo-seq").classList.remove("muted");
}
function memoCheck() {
  if (!memoTarget) return;
  clearInterval(memoCountdown);
  const typed = $("memo-input").value.toUpperCase().replace(/[^A-X]/g, "");
  const box = $("memo-result");
  box.innerHTML = "";
  let ok = 0;
  for (let i = 0; i < memoTarget.length; i++) {
    const c = document.createElement("span");
    c.className = "char " + (typed[i] === memoTarget[i] ? "ok" : "miss");
    c.textContent = memoTarget[i];
    if (typed[i] === memoTarget[i]) ok++;
    box.appendChild(c);
  }
  const verdict = document.createElement("div");
  verdict.textContent = ok === memoTarget.length
    ? `Perfect — ${ok}/${memoTarget.length} ✓`
    : `${ok}/${memoTarget.length} — you typed “${typed || "—"}”.`;
  verdict.style.marginTop = "8px";
  box.appendChild(verdict);
  box.classList.add(ok === memoTarget.length ? "good" : "bad");
}
$("memo-new").addEventListener("click", memoGen);
$("memo-hide").addEventListener("click", () => { clearInterval(memoCountdown); $("memo-timer").textContent = ""; memoHide(); });
$("memo-show").addEventListener("click", memoShow);
$("memo-check").addEventListener("click", memoCheck);
$("memo-input").addEventListener("keydown", (e) => { if (e.key === "Enter") memoCheck(); });

/* ---------- Scramble ---------- */
function genScramble(len = 20) {
  const faces = ["U", "D", "F", "B", "L", "R"];
  const mods = ["", "'", "2"];
  let out = [], prev = "";
  while (out.length < len) {
    const f = pick(faces);
    if (f === prev) continue;
    prev = f;
    out.push(f + pick(mods));
  }
  return out.join(" ");
}

/* ---------- Timer ---------- */
let timerState = "idle"; // idle | holding | ready | running
let holdTimer = null, runStart = 0, rafId = 0, currentScramble = "";
function newScramble() {
  currentScramble = genScramble();
  $("scramble").textContent = currentScramble;
}
function stopTimerRaf() {
  cancelAnimationFrame(rafId);
  if (timerState === "running") { timerState = "idle"; }
  $("time-display").textContent = "0.00";
  $("time-display").className = "time-display";
  $("timer-pad").classList.remove("armed");
}
function tick() {
  $("time-display").textContent = fmtTime(performance.now() - runStart);
  if (timerState === "running") rafId = requestAnimationFrame(tick);
}
function armStart(e) {
  if (e && e.repeat) return;
  if (timerState === "running") { stopTimer(); return; }
  if (timerState !== "idle") return;
  timerState = "holding";
  holdTimer = setTimeout(() => {
    timerState = "ready";
    $("time-display").classList.add("armed");
    $("timer-pad").classList.add("armed");
    $("timer-pad").textContent = "RELEASE";
  }, 350);
}
function armRelease() {
  if (timerState === "holding") {
    clearTimeout(holdTimer);
    timerState = "idle";
  } else if (timerState === "ready") {
    timerState = "running";
    $("time-display").classList.remove("armed");
    $("time-display").classList.add("running");
    $("timer-pad").classList.remove("armed");
    $("timer-pad").textContent = "HOLD";
    runStart = performance.now();
    rafId = requestAnimationFrame(tick);
  }
}
function stopTimer() {
  if (timerState !== "running") return;
  const ms = performance.now() - runStart;
  cancelAnimationFrame(rafId);
  timerState = "idle";
  $("time-display").classList.remove("running");
  $("time-display").textContent = fmtTime(ms);
  store.times.push({ ms: Math.round(ms), penalty: "OK", scramble: currentScramble, at: Date.now() });
  save(); renderTimes(); newScramble();
}
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  const tag = (document.activeElement && document.activeElement.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (!$("tab-timer").classList.contains("active")) return;
  e.preventDefault();
  armStart(e);
});
document.addEventListener("keyup", (e) => {
  if (e.code !== "Space") return;
  if (!$("tab-timer").classList.contains("active")) return;
  e.preventDefault();
  armRelease();
});
$("timer-pad").addEventListener("pointerdown", (e) => { e.preventDefault(); armStart(); });
$("timer-pad").addEventListener("pointerup", (e) => { e.preventDefault(); armRelease(); });
$("timer-pad").addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); armStart(); }
});
$("timer-pad").addEventListener("keyup", (e) => {
  if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); armRelease(); }
});
$("time-new-scramble").addEventListener("click", newScramble);
$("time-clear").addEventListener("click", () => {
  if (!store.times.length || confirm("Clear all times in this session?")) {
    store.times = []; save(); renderTimes();
  }
});
$("time-manual-add").addEventListener("click", () => {
  const v = prompt("Time in seconds (e.g. 89.42):");
  if (v == null) return;
  const ms = Math.round(parseFloat(v) * 1000);
  if (!isFinite(ms) || ms <= 0) { alert("Not a valid time."); return; }
  store.times.push({ ms, penalty: "OK", scramble: currentScramble, at: Date.now() });
  save(); renderTimes(); newScramble();
});
function renderTimes() {
  const list = $("times-list");
  list.innerHTML = "";
  store.times.forEach((t, i) => {
    const li = document.createElement("li");
    li.textContent = `#${i + 1} ${fmtTime(effectiveMs(t) === Infinity ? Infinity : effectiveMs(t))}` +
      (t.penalty !== "OK" ? ` (${t.penalty})` : "") + ` — ${t.scramble}`;
    li.title = "Click to cycle OK → +2 → DNF";
    li.addEventListener("click", () => {
      t.penalty = t.penalty === "OK" ? "+2" : t.penalty === "+2" ? "DNF" : "OK";
      save(); renderTimes();
    });
    list.appendChild(li);
  });
  $("st-count").textContent = store.times.length;
  const best = store.times.length ? Math.min(...store.times.map(effectiveMs)) : null;
  $("st-best").textContent = best == null ? "—" : fmtTime(best);
  const ao5 = store.times.length >= 5 ? averageOf(store.times, 5) : null;
  const ao12 = store.times.length >= 12 ? averageOf(store.times, 12) : null;
  $("st-ao5").textContent = ao5 == null ? "—" : fmtTime(ao5);
  $("st-ao12").textContent = ao12 == null ? "—" : fmtTime(ao12);
}

/* ---------- Settings ---------- */
function fillBufferSelects() {
  const eb = $("set-edge-buffer"), cb = $("set-corner-buffer");
  eb.innerHTML = ""; cb.innerHTML = "";
  for (const p of EDGE_PIECES) {
    const o = document.createElement("option");
    o.value = p; o.textContent = p;
    if (p === store.settings.edgeBuffer) o.selected = true;
    eb.appendChild(o);
  }
  for (const p of CORNER_PIECES) {
    const o = document.createElement("option");
    o.value = p; o.textContent = p;
    if (p === store.settings.cornerBuffer) o.selected = true;
    cb.appendChild(o);
  }
}
$("set-edge-buffer").addEventListener("change", (e) => { store.settings.edgeBuffer = e.target.value; save(); renderLearn(); });
$("set-corner-buffer").addEventListener("change", (e) => { store.settings.cornerBuffer = e.target.value; save(); renderLearn(); });
$("set-theme").addEventListener("change", (e) => { store.settings.theme = e.target.value; save(); applyTheme(); });
$("data-export").addEventListener("click", () => { $("data-box").value = JSON.stringify(store, null, 2); });
$("data-import-btn").addEventListener("click", () => {
  const fromBox = $("data-box").value.trim();
  if (fromBox) {
    try {
      store = Object.assign(structuredClone(DEFAULTS), JSON.parse(fromBox));
      save(); boot(false); alert("Data imported from the text box.");
    } catch { alert("Text box is not valid JSON."); }
    return;
  }
  $("data-import-file").click();
});
$("data-import-file").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      store = Object.assign(structuredClone(DEFAULTS), JSON.parse(r.result));
      save(); boot(false); alert("Data imported from file.");
    } catch { alert("That file is not valid JSON."); }
  };
  r.readAsText(f);
  e.target.value = "";
});
$("data-wipe").addEventListener("click", () => {
  if (confirm("Wipe ALL trainer data (pairs, times, stats, settings)?")) {
    store = structuredClone(DEFAULTS);
    save(); boot(false);
  }
});

/* ---------- Custom scheme ---------- */
function stockSchemeMap() {
  const m = { edges: {}, corners: {} };
  for (const s of EDGES) m.edges[stickerKey(s)] = s.letter;
  for (const s of CORNERS) m.corners[stickerKey(s)] = s.letter;
  return m;
}
function currentSchemeMap() {
  const m = stockSchemeMap();
  if (store.scheme) {
    Object.assign(m.edges, store.scheme.edges || {});
    Object.assign(m.corners, store.scheme.corners || {});
  }
  return m;
}
function renderSchemeEditor() {
  const m = currentSchemeMap();
  for (const [kind, list] of [["edges", EDGES], ["corners", CORNERS]]) {
    const box = $("scheme-" + kind);
    box.innerHTML = "";
    for (const face of ["U", "L", "F", "R", "B", "D"]) {
      const grp = document.createElement("div");
      grp.className = "scheme-face";
      const h = document.createElement("h4");
      h.textContent = face + " face";
      grp.appendChild(h);
      for (const s of list.filter((x) => x.face === face)) {
        const lab = document.createElement("label");
        lab.textContent = s.piece + " ";
        const inp = document.createElement("input");
        inp.maxLength = 1;
        inp.value = m[kind][stickerKey(s)];
        inp.dataset.kind = kind;
        inp.dataset.key = stickerKey(s);
        inp.setAttribute("aria-label", kind + " " + stickerLabel(s));
        lab.appendChild(inp);
        grp.appendChild(lab);
      }
      box.appendChild(grp);
    }
  }
  $("scheme-status").textContent = store.scheme ? "Custom scheme active." : "Stock Speffz active.";
}
function saveSchemeEditor() {
  const over = { edges: {}, corners: {} };
  let bad = 0;
  document.querySelectorAll("#scheme-editor input").forEach((inp) => {
    const v = inp.value.trim().toUpperCase();
    if (!/^[A-X]$/.test(v)) { bad++; return; }
    over[inp.dataset.kind][inp.dataset.key] = v;
  });
  if (bad) { alert(bad + " box(es) are not single letters A–X; fix them first."); return; }
  const stock = stockSchemeMap();
  const same = ["edges", "corners"].every((k) =>
    Object.keys(over[k]).every((key) => over[k][key] === stock[k][key]));
  store.scheme = same ? null : over;
  save(); renderLearn(); renderSchemeEditor();
}
$("scheme-save").addEventListener("click", saveSchemeEditor);
$("scheme-reset").addEventListener("click", () => {
  store.scheme = null; save(); renderLearn(); renderSchemeEditor();
});

/* ---------- Boot ---------- */
function boot(first) {
  applyTheme();
  // sync controls from settings
  $("drill-pieces").value = store.settings.drillPieces;
  $("drill-dir").value = store.settings.drillDir;
  $("drill-mode").value = store.settings.drillMode;
  $("drill-nobuffer").checked = store.settings.noBuffer !== false;
  $("memo-len").value = store.settings.memoLen;
  $("memo-mode").value = store.settings.memoMode;
  $("memo-peek").value = store.settings.memoPeek;
  $("set-theme").value = store.settings.theme;
  fillBufferSelects();
  renderLearn(); renderDrillStats(); buildLetterPad(); renderPairs(); renderTimes();
  renderSchemeEditor();
  if (first) newScramble();
  for (const [id, key] of [["drill-pieces", "drillPieces"], ["drill-dir", "drillDir"], ["drill-mode", "drillMode"]]) {
    if (![...$(id).options].some((o) => o.value === store.settings[key])) $(id).selectedIndex = 0;
  }
}
for (const [id, key] of [["memo-len", "memoLen"], ["memo-mode", "memoMode"], ["memo-peek", "memoPeek"]]) {
  $(id).addEventListener("change", () => {
    const v = $(id).value;
    store.settings[key] = id === "memo-len" || id === "memo-peek" ? (parseInt(v, 10) || 0) : v;
    save();
  });
}
boot(true);
