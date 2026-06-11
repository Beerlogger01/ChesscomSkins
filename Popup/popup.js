// ============================================================
// Chess.com Custom Skins v3.0 — popup
// ============================================================

const PREVIEW_PIECES = ["wk", "wq", "wr", "wb", "wn", "wp"];

// Storage wrapper: real chrome.storage in the extension,
// localStorage shim for standalone preview/testing.
const isExt = typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync;
const store = {
  get(keys) {
    return new Promise(resolve => {
      if (isExt) chrome.storage.sync.get(keys, resolve);
      else resolve(JSON.parse(localStorage.getItem("ccs-state") || "{}"));
    });
  },
  set(obj) {
    if (isExt) {
      chrome.storage.sync.set(obj);
    } else {
      const cur = JSON.parse(localStorage.getItem("ccs-state") || "{}");
      localStorage.setItem("ccs-state", JSON.stringify(Object.assign(cur, obj)));
    }
  }
};

// ---------- State ----------
const state = {
  enabled: false,
  activeSkin: null,
  activeEffect: null,
  boardStyle: "default",
  glowIntensity: 1.0,
  glowTarget: "all",
  particlesEnabled: false,
  cracksEnabled: false,
  tournamentMode: false,
  perfMode: "auto"
};

let skins = [];
let boardStyles = [];

// ---------- Elements ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const toggle = $("#toggle");
const skinsContainer = $("#skins-container");
const boardGrid = $("#board-grid");
const glowSlider = $("#glow-intensity");
const intensityValue = $("#intensity-value");
const effectName = $("#effect-name");
const perfHint = $("#perf-hint");
const perfDesc = $("#perf-desc");
const toastEl = $("#toast");

const PERF_DESCRIPTIONS = {
  auto: "Detects your hardware and picks the best preset automatically.",
  low: "Minimal glow, few particles, no extras. Best for weak laptops.",
  medium: "Balanced glow and particle counts. Smooth on most machines.",
  high: "Maximum glow radius and particle density. For strong hardware."
};

const EFFECT_NAMES = {
  "native-ember": "EMBER",
  "native-frost": "FROST",
  "native-neon": "NEON",
  "legendary-ember": "LEGEND",
  "minimal": "HALO"
};

// ---------- Hardware detection ----------
// NOTE: must stay in sync with detectQuality() in content.js
function detectQuality() {
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 4;
  if (mem <= 4 || cores <= 4) return "low";
  if (mem <= 8 || cores <= 8) return "medium";
  return "high";
}

// ---------- Toast ----------
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3200);
}

// ---------- Config loading ----------
async function loadConfigs() {
  try {
    const [skinsResp, configResp] = await Promise.all([
      fetch("../assets/skins.json"),
      fetch("../assets/config.json")
    ]);
    const skinsData = await skinsResp.json();
    const configData = await configResp.json();
    skins = skinsData.skins || [];
    boardStyles = configData.boardStyles || [];
  } catch (e) {
    console.error("[Popup] Failed to load configs:", e);
  }
}

// ---------- Rendering ----------
function renderSkins() {
  skinsContainer.innerHTML = "";
  skins.forEach(skin => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "skin-tile";
    tile.dataset.skin = skin.id;
    tile.setAttribute("data-testid", `skin-tile-${skin.id}`);

    const head = document.createElement("div");
    head.className = "skin-tile-head";

    const name = document.createElement("span");
    name.className = "skin-name";
    name.textContent = skin.name;

    const check = document.createElement("span");
    check.className = "skin-check";
    check.innerHTML =
      '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    head.append(name, check);

    const pieces = document.createElement("div");
    pieces.className = "skin-pieces";
    PREVIEW_PIECES.forEach(p => {
      const img = document.createElement("img");
      img.src = `../assets/${skin.folder}/${p}.png`;
      img.alt = p;
      pieces.appendChild(img);
    });

    tile.append(head, pieces);
    skinsContainer.appendChild(tile);

    tile.addEventListener("click", () => {
      state.activeSkin = state.activeSkin === skin.id ? null : skin.id;
      store.set({ activeSkin: state.activeSkin || "none" });
      updateUI();
    });
  });
}

function renderBoards() {
  boardGrid.innerHTML = "";
  boardStyles.forEach(style => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "board-swatch";
    btn.dataset.board = style.id;
    btn.setAttribute("data-testid", `board-style-${style.id}`);

    const mini = document.createElement("div");
    mini.className = "board-mini";
    [style.lightColor, style.darkColor, style.darkColor, style.lightColor].forEach(c => {
      const sq = document.createElement("div");
      sq.style.background = c;
      mini.appendChild(sq);
    });
    if (style.glowColor) mini.style.boxShadow = `0 0 8px ${style.glowColor}`;

    const label = document.createElement("span");
    label.textContent = style.name;

    btn.append(mini, label);
    boardGrid.appendChild(btn);

    btn.addEventListener("click", () => {
      state.boardStyle = style.id;
      store.set({ boardStyle: style.id });
      updateUI();
    });
  });
}

// ---------- UI sync ----------
function updatePerfHint() {
  if (state.perfMode === "auto") {
    const detected = detectQuality();
    perfHint.textContent = `AUTO \u2192 ${detected.toUpperCase()}`;
    // Ask the live page — it may have downgraded itself via the FPS probe
    if (isExt && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (!tabs[0]) return;
        chrome.tabs.sendMessage(tabs[0].id, { action: "getState" }, resp => {
          if (chrome.runtime.lastError || !resp) return;
          if (resp.perfMode === "auto" && resp.resolvedQuality) {
            perfHint.textContent = `AUTO \u2192 ${resp.resolvedQuality.toUpperCase()}`;
          }
        });
      });
    }
  } else {
    perfHint.textContent = state.perfMode.toUpperCase();
  }
  perfDesc.textContent = PERF_DESCRIPTIONS[state.perfMode] || PERF_DESCRIPTIONS.auto;
}

function updateUI() {
  // Gate cards on the master toggle
  $$(".card.gated").forEach(el => el.classList.toggle("disabled", !state.enabled));

  // Performance segments
  $$("[data-mode]").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.mode === state.perfMode));
  updatePerfHint();

  // Skins
  $$(".skin-tile").forEach(el =>
    el.classList.toggle("active", el.dataset.skin === state.activeSkin));

  // Effects
  $$(".effect-chip").forEach(el =>
    el.classList.toggle("active", el.dataset.effect === state.activeEffect));
  effectName.textContent = EFFECT_NAMES[state.activeEffect] || "OFF";

  // Glow target
  $$("[data-target]").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.target === state.glowTarget));

  // Boards
  $$(".board-swatch").forEach(el =>
    el.classList.toggle("active", el.dataset.board === state.boardStyle));

  // FX & extras
  $("#btn-particles").classList.toggle("active", state.particlesEnabled);
  $("#btn-cracks").classList.toggle("active", state.cracksEnabled);
  $("#btn-tournament").classList.toggle("active", state.tournamentMode);

  // Slider
  glowSlider.value = state.glowIntensity;
  intensityValue.textContent = Math.round(state.glowIntensity * 100) + "%";
}

// ---------- Storage init ----------
async function initFromStorage() {
  const data = await store.get([
    "enabled", "activeSkin", "activeEffect", "boardStyle", "glowIntensity",
    "glowTarget", "particlesEnabled", "cracksEnabled", "tournamentMode", "perfMode"
  ]);
  state.enabled = !!data.enabled;
  state.activeSkin = (data.activeSkin && data.activeSkin !== "none") ? data.activeSkin : null;
  state.activeEffect = (data.activeEffect && data.activeEffect !== "none") ? data.activeEffect : null;
  state.boardStyle = data.boardStyle || "default";
  state.glowIntensity = parseFloat(data.glowIntensity) || 1.0;
  state.glowTarget = data.glowTarget || "all";
  state.particlesEnabled = !!data.particlesEnabled;
  state.cracksEnabled = !!data.cracksEnabled;
  state.tournamentMode = !!data.tournamentMode;
  state.perfMode = data.perfMode || "auto";

  toggle.checked = state.enabled;
  updateUI();
}

// ---------- Event handlers ----------
toggle.addEventListener("change", () => {
  state.enabled = toggle.checked;
  if (state.enabled && !state.activeSkin && skins.length > 0) {
    state.activeSkin = skins[0].id;
  }
  store.set({
    enabled: state.enabled,
    activeSkin: state.activeSkin || "none"
  });
  updateUI();
});

$$("[data-mode]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.perfMode = btn.dataset.mode;
    store.set({ perfMode: state.perfMode });
    updateUI();
  });
});

$$(".effect-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const effect = chip.dataset.effect;
    state.activeEffect = state.activeEffect === effect ? null : effect;
    store.set({ activeEffect: state.activeEffect || "none" });
    updateUI();
  });
});

glowSlider.addEventListener("input", e => {
  const val = parseFloat(e.target.value);
  state.glowIntensity = val;
  intensityValue.textContent = Math.round(val * 100) + "%";
  store.set({ glowIntensity: val });
  // Live update without waiting for storage propagation
  if (isExt && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "setGlowIntensity", intensity: val }, () => {
          void chrome.runtime.lastError;
        });
      }
    });
  }
});

$$("[data-target]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.glowTarget = btn.dataset.target;
    store.set({ glowTarget: state.glowTarget });
    updateUI();
  });
});

$("#btn-particles").addEventListener("click", () => {
  state.particlesEnabled = !state.particlesEnabled;
  store.set({ particlesEnabled: state.particlesEnabled });
  updateUI();
});

$("#btn-cracks").addEventListener("click", () => {
  state.cracksEnabled = !state.cracksEnabled;
  store.set({ cracksEnabled: state.cracksEnabled });
  updateUI();
});

$("#btn-tournament").addEventListener("click", () => {
  state.tournamentMode = !state.tournamentMode;
  store.set({ tournamentMode: state.tournamentMode });
  updateUI();
  if (state.tournamentMode) {
    toast("Tournament mode ON — a random skin is picked every new game.");
  }
});

$("#btn-import").addEventListener("click", () => {
  toast("ZIP import is on the roadmap. For now: drop a folder with 12 PNGs into assets/ and register it in assets/skins.json.");
});

// ---------- Boot ----------
(async function init() {
  await loadConfigs();
  renderSkins();
  renderBoards();
  await initFromStorage();
})();
