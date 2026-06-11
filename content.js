// ============================================================
// Chess.com Custom Skins v3.0 — unified content script
// Quality-aware effects engine: piece skins, glow, board themes,
// move particles & cracks. Built to stay smooth on weak laptops.
//
// Key performance principles:
//  - No getBoundingClientRect() inside MutationObserver callbacks
//    (piece positions are derived from chess.com square-XY classes)
//  - drop-shadow is removed from a piece while it is dragged
//  - All effects scale with a quality preset (auto / low / med / high)
//  - Canvas pauses completely when the tab is hidden
// ============================================================

(() => {
"use strict";

const TAG = "[ChesscomSkins]";
const PIECES = ["wk","wq","wr","wb","wn","wp","bk","bq","br","bb","bn","bp"];
const ROYAL_SELECTOR = ".piece.wk, .piece.bk, .piece.wq, .piece.bq";

// ------------------------------------------------------------
// Quality presets
// ------------------------------------------------------------
const QUALITY = {
  low: {
    glowMax: 5,  glowScale: 0.5,  glowAlpha: 0.55, filterTransition: false,
    particlesPerMove: 5,  maxParticles: 40,  maxCracks: 1, crackBranches: 3,
    dprCap: 1,   boardGlow: 14, highlightPulse: false
  },
  medium: {
    glowMax: 9,  glowScale: 0.75, glowAlpha: 0.7,  filterTransition: false,
    particlesPerMove: 10, maxParticles: 90,  maxCracks: 2, crackBranches: 4,
    dprCap: 1.5, boardGlow: 26, highlightPulse: true
  },
  high: {
    glowMax: 14, glowScale: 1.0,  glowAlpha: 0.8,  filterTransition: true,
    particlesPerMove: 16, maxParticles: 160, maxCracks: 3, crackBranches: 5,
    dprCap: 2,   boardGlow: 40, highlightPulse: true
  }
};

const EFFECTS = {
  "native-ember":   { tint: "hue-rotate(-12deg) saturate(1.2) brightness(1.02)", glow: "255,120,60",  base: 8 },
  "native-frost":   { tint: "hue-rotate(185deg) saturate(1.2) brightness(1.05)", glow: "110,190,255", base: 8 },
  "native-neon":    { tint: "hue-rotate(270deg) saturate(1.3) brightness(1.05)", glow: "210,120,255", base: 10 },
  "legendary-ember":{ tint: "saturate(1.3) brightness(1.08)",                    glow: "255,180,60",  base: 12 },
  "minimal":        { tint: "",                                                  glow: "255,255,255", base: 4 }
};

// ------------------------------------------------------------
// State
// ------------------------------------------------------------
const STORAGE_KEYS = [
  "enabled","activeSkin","activeEffect","boardStyle","glowIntensity",
  "glowTarget","particlesEnabled","cracksEnabled","tournamentMode","perfMode"
];

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

let SKINS = {};
let BOARD_STYLES = {};
let resolvedQuality = "medium";
let sessionSkin = null;      // tournament pick for this page load
let fpsProbeDone = false;
let glowRafPending = false;

const styleTags = {};        // key -> <style> element

// ------------------------------------------------------------
// Quality resolution
// ------------------------------------------------------------
function detectQuality() {
  const mem = navigator.deviceMemory || 8;          // GB (Chrome only)
  const cores = navigator.hardwareConcurrency || 4;
  if (mem <= 4 || cores <= 4) return "low";
  if (mem <= 8 || cores <= 8) return "medium";
  return "high";
}

function resolveQuality() {
  resolvedQuality = state.perfMode === "auto"
    ? detectQuality()
    : (QUALITY[state.perfMode] ? state.perfMode : "medium");
}

function q() { return QUALITY[resolvedQuality]; }

// ------------------------------------------------------------
// Style tag helper
// ------------------------------------------------------------
function setStyle(key, css) {
  if (styleTags[key]) {
    styleTags[key].remove();
    delete styleTags[key];
  }
  if (!css) return;
  const tag = document.createElement("style");
  tag.id = `chesscom-skins-${key}`;
  tag.textContent = css;
  (document.head || document.documentElement).appendChild(tag);
  styleTags[key] = tag;
}

// ------------------------------------------------------------
// Configs
// ------------------------------------------------------------
async function loadConfigs() {
  try {
    const [skinsResp, configResp] = await Promise.all([
      fetch(chrome.runtime.getURL("assets/skins.json")),
      fetch(chrome.runtime.getURL("assets/config.json"))
    ]);
    const skinsData = await skinsResp.json();
    const configData = await configResp.json();

    (skinsData.skins || []).forEach(s => {
      SKINS[s.id] = { name: s.name, path: `assets/${s.folder}` };
    });
    (configData.boardStyles || []).forEach(s => { BOARD_STYLES[s.id] = s; });
  } catch (e) {
    console.error(TAG, "Failed to load configs:", e);
  }
}

// ------------------------------------------------------------
// Piece skins
// ------------------------------------------------------------
function applySkin() {
  const skinId = sessionSkin || state.activeSkin;
  if (!state.enabled || !skinId || skinId === "none" || !SKINS[skinId]) {
    setStyle("skin", null);
    return;
  }
  const base = SKINS[skinId].path;
  const css = PIECES.map(p => {
    const url = chrome.runtime.getURL(`${base}/${p}.png`);
    return `.piece.${p}{background-image:url("${url}") !important;}`;
  }).join("\n");
  setStyle("skin", css);
}

// ------------------------------------------------------------
// Glow effect (quality-aware)
// ------------------------------------------------------------
function applyEffect() {
  const eff = EFFECTS[state.activeEffect];
  if (!state.enabled || !eff) {
    setStyle("effect", null);
    return;
  }
  const Q = q();
  const size = Math.min(Q.glowMax, Math.round(eff.base * state.glowIntensity * Q.glowScale));
  const selector = state.glowTarget === "royal" ? ROYAL_SELECTOR : ".piece";
  const tint = eff.tint ? eff.tint + " " : "";
  const shadow = size > 0 ? `drop-shadow(0 0 ${size}px rgba(${eff.glow},${Q.glowAlpha}))` : "";
  const filterValue = (tint + shadow).trim() || "none";

  let css = `
    ${selector} {
      filter: ${filterValue} !important;
      ${Q.filterTransition ? "transition: filter .2s ease;" : ""}
    }
    /* Critical perf fix: no blur while a piece is being dragged */
    .piece.dragging {
      filter: ${tint.trim() || "none"} !important;
      transition: none !important;
    }
    /* Never glow captured-piece trays */
    .captured-pieces .piece,
    [class*="captured"] .piece {
      filter: none !important;
    }
  `;

  if (Q.highlightPulse) {
    css += `
      .highlight { animation: ccsHighlightPulse .5s ease-out; }
      @keyframes ccsHighlightPulse {
        0%   { box-shadow: inset 0 0 18px rgba(${eff.glow}, .55); }
        100% { box-shadow: none; }
      }
    `;
  }

  setStyle("effect", css);
}

// ------------------------------------------------------------
// Board theme
// ------------------------------------------------------------
function applyBoard() {
  const style = BOARD_STYLES[state.boardStyle];
  if (!state.enabled || !style || state.boardStyle === "default") {
    setStyle("board", null);
    return;
  }
  let css = `
    :root {
      --theme-board-style-light: ${style.lightColor} !important;
      --theme-board-style-dark: ${style.darkColor} !important;
    }
    wc-chess-board svg rect.light-square, wc-chess-board svg .light { fill: ${style.lightColor} !important; }
    wc-chess-board svg rect.dark-square,  wc-chess-board svg .dark  { fill: ${style.darkColor} !important; }
    wc-chess-board { --cb-light: ${style.lightColor} !important; --cb-dark: ${style.darkColor} !important; }
    .board .square-light, .board .light { background-color: ${style.lightColor} !important; }
    .board .square-dark,  .board .dark  { background-color: ${style.darkColor} !important; }
  `;
  if (style.glowColor) {
    css += `
      wc-chess-board {
        box-shadow: 0 0 ${q().boardGlow}px ${style.glowColor} !important;
        border-radius: 4px;
      }
    `;
  }
  setStyle("board", css);
}

// ------------------------------------------------------------
// FX engine — move particles & cracks (single canvas, square-class
// based move detection, zero layout reads in the observer)
// ------------------------------------------------------------
const fx = {
  active: false,
  board: null,
  canvas: null,
  ctx: null,
  w: 0, h: 0, dpr: 1,
  particles: [],
  cracks: [],
  raf: null,
  lastT: 0,
  observer: null,
  resizeObs: null,
  squares: new Map(),      // piece element -> square string ("45")
  checkScheduled: false,
  firstScanDone: false,
  pollTimer: null
};

function fxFindBoard() {
  return document.querySelector("wc-chess-board") ||
         document.querySelector("chess-board") ||
         document.querySelector(".board");
}

function fxSquareOf(el) {
  for (const c of el.classList) {
    if (c.startsWith("square-")) return c.slice(7);
  }
  return null;
}

function fxSquareToXY(sq) {
  const file = +sq[0], rank = +sq[1];
  if (!file || !rank) return null;
  const flipped = fx.board && fx.board.classList.contains("flipped");
  const x = ((flipped ? 9 - file : file) - 0.5) / 8 * fx.w;
  const y = ((flipped ? rank : 9 - rank) - 0.5) / 8 * fx.h;
  return { x, y };
}

function fxResize(w, h) {
  if (!fx.canvas) return;
  fx.w = w; fx.h = h;
  fx.dpr = Math.min(window.devicePixelRatio || 1, q().dprCap);
  fx.canvas.width = Math.max(1, Math.round(w * fx.dpr));
  fx.canvas.height = Math.max(1, Math.round(h * fx.dpr));
  if (fx.ctx) fx.ctx.setTransform(fx.dpr, 0, 0, fx.dpr, 0, 0);
}

function fxAttach() {
  const board = fxFindBoard();
  if (!board) return false;
  if (fx.board === board && fx.canvas && fx.canvas.isConnected) return true;

  fxDetach();
  fx.board = board;

  fx.canvas = document.createElement("canvas");
  fx.canvas.id = "chesscom-skins-fx";
  fx.canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1000;";
  if (getComputedStyle(board).position === "static") {
    board.style.position = "relative";
  }
  board.appendChild(fx.canvas);
  fx.ctx = fx.canvas.getContext("2d");

  // Size via ResizeObserver — the only place where layout is read
  fx.resizeObs = new ResizeObserver(entries => {
    const r = entries[0].contentRect;
    fxResize(r.width, r.height);
  });
  fx.resizeObs.observe(board);
  const rect = board.getBoundingClientRect();
  fxResize(rect.width, rect.height);

  // Move detection: class changes only, batched to one rAF check
  fx.squares = new Map();
  fx.firstScanDone = false;
  fx.observer = new MutationObserver(() => {
    if (fx.checkScheduled) return;
    fx.checkScheduled = true;
    requestAnimationFrame(fxCheckMoves);
  });
  fx.observer.observe(board, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });
  fxScanPieces();
  fx.firstScanDone = true;
  return true;
}

function fxScanPieces() {
  fx.squares = new Map();
  fx.board.querySelectorAll(".piece").forEach(el => {
    const sq = fxSquareOf(el);
    if (sq) fx.squares.set(el, sq);
  });
}

function fxCheckMoves() {
  fx.checkScheduled = false;
  if (!fx.board || !fx.board.isConnected) return;

  const next = new Map();
  const pieces = fx.board.querySelectorAll(".piece");
  pieces.forEach(el => {
    const sq = fxSquareOf(el);
    if (sq) next.set(el, sq);
  });

  if (fx.firstScanDone && fx.squares.size > 0) {
    const captured = next.size < fx.squares.size;
    let spawned = 0;
    for (const [el, sq] of next) {
      if (spawned >= 2) break;
      const prev = fx.squares.get(el);
      if (prev && prev !== sq) {
        const pos = fxSquareToXY(sq);
        if (pos) { fxSpawn(pos.x, pos.y, captured); spawned++; }
      }
    }
  }
  fx.squares = next;
}

// --- Particles ---
function fxSpawn(x, y, capture) {
  const Q = q();
  if (state.particlesEnabled) {
    const n = Math.round(Q.particlesPerMove * (capture ? 1.5 : 1));
    const colors = capture
      ? ["#ff4d4d", "#ff9f1c", "#ffd166", "#ffffff"]
      : ["#ff6b35", "#ff9f1c", "#ffbe0b", "#ffffff"];
    for (let i = 0; i < n; i++) {
      if (fx.particles.length >= Q.maxParticles) fx.particles.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 4;
      fx.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1.5,
        life: 1,
        decay: 0.025 + Math.random() * 0.02,
        size: 2 + Math.random() * 3,
        color: colors[(Math.random() * colors.length) | 0]
      });
    }
  }
  if (state.cracksEnabled) {
    if (fx.cracks.length >= Q.maxCracks) fx.cracks.shift();
    fx.cracks.push(fxMakeCrack(x, y, Q.crackBranches));
  }
  if (!fx.raf && !document.hidden) {
    fx.lastT = performance.now();
    fx.raf = requestAnimationFrame(fxLoop);
  }
}

function fxMakeCrack(x, y, branches) {
  const segs = [];
  for (let b = 0; b < branches; b++) {
    const angle = (Math.PI * 2 / branches) * b + (Math.random() - 0.5) * 0.5;
    const length = 26 + Math.random() * 34;
    const branch = [];
    let cx = x, cy = y, a = angle;
    const n = 3 + (Math.random() * 2 | 0);
    for (let s = 0; s < n; s++) {
      const nx = cx + Math.cos(a) * (length / n);
      const ny = cy + Math.sin(a) * (length / n);
      branch.push(cx, cy, nx, ny);
      cx = nx; cy = ny;
      a += (Math.random() - 0.5) * 0.8;
    }
    segs.push(branch);
  }
  return { segs, life: 1, decay: 0.012 };
}

function fxLoop(t) {
  if (!fx.ctx || !fx.canvas) { fx.raf = null; return; }
  const dt = Math.min((t - fx.lastT) / 16.67, 3) || 1;
  fx.lastT = t;
  const ctx = fx.ctx;
  ctx.clearRect(0, 0, fx.w, fx.h);

  // particles
  let alive = 0;
  for (let i = 0; i < fx.particles.length; i++) {
    const p = fx.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.15 * dt;
    p.vx *= Math.pow(0.98, dt);
    p.life -= p.decay * dt;
    p.size *= Math.pow(0.975, dt);
    if (p.life <= 0 || p.size < 0.5) continue;
    fx.particles[alive++] = p;
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, 6.2832);
    ctx.fill();
  }
  fx.particles.length = alive;

  // cracks
  let aliveC = 0;
  for (let i = 0; i < fx.cracks.length; i++) {
    const c = fx.cracks[i];
    c.life -= c.decay * dt;
    if (c.life <= 0) continue;
    fx.cracks[aliveC++] = c;
    ctx.globalAlpha = c.life;
    ctx.lineCap = "round";
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? "rgba(40,40,40,.85)" : "rgba(210,210,210,.5)";
      ctx.lineWidth = pass === 0 ? 2 : 1;
      for (const br of c.segs) {
        ctx.beginPath();
        ctx.moveTo(br[0], br[1]);
        for (let s = 0; s < br.length; s += 4) ctx.lineTo(br[s + 2], br[s + 3]);
        ctx.stroke();
      }
    }
  }
  fx.cracks.length = aliveC;
  ctx.globalAlpha = 1;

  fx.raf = (alive > 0 || aliveC > 0) ? requestAnimationFrame(fxLoop) : null;
}

function fxDetach() {
  if (fx.observer) { fx.observer.disconnect(); fx.observer = null; }
  if (fx.resizeObs) { fx.resizeObs.disconnect(); fx.resizeObs = null; }
  if (fx.raf) { cancelAnimationFrame(fx.raf); fx.raf = null; }
  if (fx.canvas) { fx.canvas.remove(); fx.canvas = null; fx.ctx = null; }
  fx.board = null;
  fx.particles = [];
  fx.cracks = [];
  fx.squares = new Map();
}

function fxSync() {
  const wanted = state.enabled && (state.particlesEnabled || state.cracksEnabled);
  if (wanted && !fx.active) {
    fx.active = true;
    fxAttach();
    // chess.com is a SPA — keep a light watcher for board (re)creation
    fx.pollTimer = setInterval(() => {
      if (!fx.board || !fx.board.isConnected || !fx.canvas || !fx.canvas.isConnected) {
        fxAttach();
      }
    }, 2000);
  } else if (!wanted && fx.active) {
    fx.active = false;
    clearInterval(fx.pollTimer);
    fx.pollTimer = null;
    fxDetach();
  }
}

// Pause everything when the tab is hidden
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (fx.raf) { cancelAnimationFrame(fx.raf); fx.raf = null; }
    fx.particles = [];
    fx.cracks = [];
    if (fx.ctx) fx.ctx.clearRect(0, 0, fx.w, fx.h);
  }
});

// ------------------------------------------------------------
// FPS guard — auto mode only, runs once. If the page can't hold
// ~40fps with effects on, step the quality down one level.
// ------------------------------------------------------------
function maybeProbeFps() {
  if (fpsProbeDone || state.perfMode !== "auto" || !state.enabled) return;
  if (!state.activeEffect && !state.particlesEnabled && !state.cracksEnabled) return;
  if (resolvedQuality === "low") return;
  fpsProbeDone = true;

  setTimeout(() => {
    if (document.hidden) { fpsProbeDone = false; return; }
    let frames = 0;
    const start = performance.now();
    const count = () => {
      frames++;
      if (performance.now() - start < 3000) {
        requestAnimationFrame(count);
      } else {
        const fps = frames / 3;
        if (fps < 40) {
          resolvedQuality = resolvedQuality === "high" ? "medium" : "low";
          console.log(TAG, `FPS probe: ${fps.toFixed(0)}fps — auto-downgraded to "${resolvedQuality}"`);
          applyEffect();
          applyBoard();
        }
      }
    };
    requestAnimationFrame(count);
  }, 2000);
}

// ------------------------------------------------------------
// Apply / refresh everything
// ------------------------------------------------------------
function refreshAll() {
  resolveQuality();
  if (!state.enabled) {
    setStyle("skin", null);
    setStyle("effect", null);
    setStyle("board", null);
  } else {
    applySkin();
    applyEffect();
    applyBoard();
  }
  fxSync();
  maybeProbeFps();
}

// ------------------------------------------------------------
// Storage wiring
// ------------------------------------------------------------
function readState(data) {
  state.enabled = !!data.enabled;
  state.activeSkin = (data.activeSkin && data.activeSkin !== "none") ? data.activeSkin : null;
  state.activeEffect = (data.activeEffect && data.activeEffect !== "none") ? data.activeEffect : null;
  state.boardStyle = data.boardStyle || "default";
  state.glowIntensity = Math.max(0.1, Math.min(1.5, parseFloat(data.glowIntensity) || 1));
  state.glowTarget = data.glowTarget || "all";
  state.particlesEnabled = !!data.particlesEnabled;
  state.cracksEnabled = !!data.cracksEnabled;
  state.tournamentMode = !!data.tournamentMode;
  state.perfMode = data.perfMode || "auto";
}

async function initialize() {
  await loadConfigs();
  chrome.storage.sync.get(STORAGE_KEYS, data => {
    readState(data);

    // Tournament mode: random skin for this page session
    if (state.enabled && state.tournamentMode) {
      const ids = Object.keys(SKINS);
      if (ids.length > 0) {
        sessionSkin = ids[(Math.random() * ids.length) | 0];
        console.log(TAG, "Tournament mode — session skin:", sessionSkin);
      }
    }

    refreshAll();
    console.log(TAG, `v3.0 ready — quality: ${resolvedQuality} (${state.perfMode})`);
  });
}

chrome.storage.onChanged.addListener(changes => {
  let dirty = false;
  for (const key of STORAGE_KEYS) {
    if (key in changes) {
      dirty = true;
      const v = changes[key].newValue;
      switch (key) {
        case "enabled":          state.enabled = !!v; break;
        case "activeSkin":       state.activeSkin = (v && v !== "none") ? v : null; sessionSkin = null; break;
        case "activeEffect":     state.activeEffect = (v && v !== "none") ? v : null; break;
        case "boardStyle":       state.boardStyle = v || "default"; break;
        case "glowIntensity":    state.glowIntensity = Math.max(0.1, Math.min(1.5, parseFloat(v) || 1)); break;
        case "glowTarget":       state.glowTarget = v || "all"; break;
        case "particlesEnabled": state.particlesEnabled = !!v; break;
        case "cracksEnabled":    state.cracksEnabled = !!v; break;
        case "tournamentMode":   state.tournamentMode = !!v; if (!v) sessionSkin = null; break;
        case "perfMode":         state.perfMode = v || "auto"; fpsProbeDone = false; break;
      }
    }
  }
  if (dirty) refreshAll();
});

// ------------------------------------------------------------
// Popup messages
// ------------------------------------------------------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getState") {
    sendResponse({ resolvedQuality, perfMode: state.perfMode, enabled: state.enabled });
  } else if (request.action === "setGlowIntensity") {
    state.glowIntensity = Math.max(0.1, Math.min(1.5, parseFloat(request.intensity) || 1));
    // rAF-throttle: the popup slider can fire dozens of times per second
    if (!glowRafPending) {
      glowRafPending = true;
      requestAnimationFrame(() => { glowRafPending = false; applyEffect(); });
    }
    sendResponse({ success: true });
  }
  return true;
});

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

})();
