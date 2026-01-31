const PIECES = [
  "wk","wq","wr","wb","wn","wp",
  "bk","bq","br","bb","bn","bp"
];

let SKIN_DEFINITIONS = {
  "none": {
    type: "none"
  }
};

let BOARD_STYLES = {};

// Переменные для новых функций
let glowIntensity = 1;
let boardStyleTag = null;
let particleStyleTag = null;
let animationStyleTag = null;
let tournamentMode = false;
let currentTournamentSkin = null;

// Загрузка доступных скинов из конфига
async function loadSkinsConfig() {
  try {
    const url = chrome.runtime.getURL("assets/skins.json");
    const response = await fetch(url);
    const config = await response.json();
    
    if (config.skins && Array.isArray(config.skins)) {
      config.skins.forEach(skin => {
        SKIN_DEFINITIONS[skin.id] = {
          type: "image",
          path: `assets/${skin.folder}`,
          name: skin.name,
          description: skin.description
        };
      });
    }
  } catch (error) {
    console.warn("[ChesscomSkins] Не удалось загрузить конфиг скинов:", error);
  }
}

// Загрузка конфига (доска и стили)
async function loadFullConfig() {
  try {
    const url = chrome.runtime.getURL("assets/config.json");
    const response = await fetch(url);
    const config = await response.json();
    
    if (config.boardStyles && Array.isArray(config.boardStyles)) {
      config.boardStyles.forEach(style => {
        BOARD_STYLES[style.id] = style;
      });
    }
  } catch (error) {
    console.warn("[ChesscomSkins] Не удалось загрузить полный конфиг:", error);
  }
}

// Инициализация конфигов при загрузке
loadSkinsConfig();
loadFullConfig();

const EFFECT_DEFINITIONS = {
  "native-ember": {
    type: "filter",
    filter: "hue-rotate(-18deg) saturate(1.4) brightness(1.05)",
    ringColor: "rgba(255,120,60,0.9)"
  },
  "native-frost": {
    type: "filter",
    filter: "hue-rotate(190deg) saturate(1.35) brightness(1.1)",
    ringColor: "rgba(110,190,255,0.9)"
  },
  "native-neon": {
    type: "filter",
    filter: "hue-rotate(280deg) saturate(1.6) brightness(1.1)",
    ringColor: "rgba(210,120,255,0.9)"
  },
  "legendary-ember": {
    type: "filter",
    filter: "saturate(1.1) brightness(1.02)",
    ringColor: "rgba(255,130,70,0.95)",
    ringGlow: "0 0 18px rgba(255,120,60,0.7)",
    ringColorOverrides: {
      wk: "rgba(255,210,120,0.95)",
      wq: "rgba(255,160,80,0.95)",
      bk: "rgba(120,180,255,0.95)",
      bq: "rgba(150,120,255,0.95)"
    }
  },
  "minimal": {
    type: "filter",
    filter: "saturate(1.02)",
    ringColor: "rgba(255,255,255,0.9)",
    ringOpacity: 0.75,
    ringBorder: "2px",
    ringInset: "12%",
    ringAnimation: "ringSoft 1.6s ease-in-out infinite",
    ringGlow: "0 0 12px rgba(255,255,255,0.55)"
  },
  "none": {
    type: "none"
  }
};

let skinStyleTag = null;
let effectStyleTag = null;
let lastAppliedSkin = null;
let lastAppliedEffect = null;
let lastAppliedTarget = null;
let overlayStyleTag = null;
let skinsEnabled = false;
let activeSkinPath = null;
let capturedObserver = null;

function applySkin(skinName, skinPath) {
  if (lastAppliedSkin === skinName && activeSkinPath === skinPath) return;
  lastAppliedSkin = skinName;

  if (skinStyleTag) skinStyleTag.remove();
  if (!skinName || skinName === "none") {
    activeSkinPath = null;
    return;
  }

  skinStyleTag = document.createElement("style");
  const definition = SKIN_DEFINITIONS[skinName];
  if ((!definition || definition.type === "none") && !skinPath) return;

  let css = "";
  const resolvedPath = skinPath || definition.path;
  if (resolvedPath) {
    activeSkinPath = resolvedPath;
    PIECES.forEach(piece => {
      const url = chrome.runtime.getURL(`${resolvedPath}/${piece}.png`);
      css += `
        .piece.${piece},
        .promotion-piece.${piece},
        .captured-pieces .piece.${piece},
        .captured-piece.${piece},
        .captured-piece .piece.${piece},
        .captured .piece.${piece},
        [class*="captured"] .piece.${piece},
        .captured-pieces [data-piece="${piece}"],
        .captured-pieces [class*="piece"][data-piece="${piece}"],
        [class*="captured"] [data-piece="${piece}"],
        .captured-piece[data-piece="${piece}"] {
          background-image: url("${url}") !important;
          background-size: contain !important;
          background-repeat: no-repeat !important;
          background-position: center !important;
        }
      `;
    });
  }

  skinStyleTag.textContent = css;
  document.head.appendChild(skinStyleTag);
  updateCapturedImages();
  ensureCapturedObserver();
}

function ensureCapturedObserver() {
  if (capturedObserver) return;
  
  let updateScheduled = false;
  const debouncedUpdate = () => {
    if (updateScheduled) return;
    updateScheduled = true;
    requestAnimationFrame(() => {
      updateCapturedImages();
      updateScheduled = false;
    });
  };
  
  capturedObserver = new MutationObserver(debouncedUpdate);
  capturedObserver.observe(document.body, { childList: true, subtree: true });
}

function updateCapturedImages() {
  if (!activeSkinPath) return;
  const elements = document.querySelectorAll(
    ".captured-pieces [data-piece], [class*=\"captured\"] [data-piece], .captured-pieces .piece, [class*=\"captured\"] .piece"
  );
  elements.forEach((el) => {
    let piece = el.dataset?.piece;
    if (!piece) {
      const classMatch = PIECES.find((code) => el.classList.contains(code));
      piece = classMatch || null;
    }
    if (!piece) return;
    const url = chrome.runtime.getURL(`${activeSkinPath}/${piece}.png`);
    if (el.tagName === "IMG") {
      if (el.src !== url) el.src = url;
    } else {
      el.style.backgroundImage = `url("${url}")`;
      el.style.backgroundSize = "contain";
      el.style.backgroundRepeat = "no-repeat";
      el.style.backgroundPosition = "center";
    }
  });
}

function applyEffect(effectName, targetName) {
  if (lastAppliedEffect === effectName && lastAppliedTarget === targetName) return;
  lastAppliedEffect = effectName;
  lastAppliedTarget = targetName;

  if (effectStyleTag) effectStyleTag.remove();
  if (!effectName || effectName === "none") return;

  effectStyleTag = document.createElement("style");
  const definition = EFFECT_DEFINITIONS[effectName];
  if (!definition || definition.type === "none") return;

  const ringAnimation = definition.ringAnimation || "ringPulse 1.2s ease-in-out infinite";

  const glowTargets = targetName === "royal"
    ? [".piece.wk", ".piece.wq", ".piece.bk", ".piece.bq"]
    : [".piece", ".promotion-piece"];
  
  // Оптимизация: используем более специфичные селекторы для основных состояний
  const glowTargetSelector = glowTargets.join(", ");
  const glowTargetActive = glowTargets.map((target) => `${target}.selected, .selected ${target}, ${target}.last-move, .last-move ${target}, ${target}.move, .move ${target}`).join(", ");
  const glowTargetCheck = glowTargets.map((target) => `${target}.check, .check ${target}`).join(", ");
  const glowTargetCheckmate = glowTargets.map((target) => `${target}.checkmate, .checkmate ${target}, ${target}.mate, .mate ${target}`).join(", ");
  const glowTargetCapture = glowTargets.map((target) => `${target}.capture, .capture ${target}`).join(", ");

  let css = `
    .piece,
    .promotion-piece {
      position: relative;
      contain: paint;
      transform: translateZ(0);
      --glow-intensity: ${glowIntensity};
    }

    /* Базовый фильтр (не анимируется) */
    ${glowTargetSelector} {
      filter: var(--piece-filter, none);
      transition: filter 0.15s ease;
    }

    /* Отключаем эффекты для захватанных фигур */
    .captured .piece,
    .captured-piece,
    .captured-pieces .piece,
    [class*="captured"] .piece {
      animation: none !important;
      filter: var(--piece-filter, none) !important;
    }

    /* Оптимизированные анимации с учётом интенсивности */
    @keyframes glowPulse {
      0% {
        text-shadow: 0 0 4px var(--ring-color, rgba(255,120,60,0.85)),
                     0 0 8px var(--ring-color, rgba(255,120,60,0.5));
        filter: var(--piece-filter, none) drop-shadow(0 0 3px var(--ring-color, rgba(255,120,60,${0.6 * glowIntensity})));
      }
      50% {
        text-shadow: 0 0 10px var(--ring-color, rgba(255,120,60,0.95)),
                     0 0 16px var(--ring-color, rgba(255,120,60,0.7));
        filter: var(--piece-filter, none) drop-shadow(0 0 6px var(--ring-color, rgba(255,120,60,0.85)));
      }
      100% {
        text-shadow: 0 0 4px var(--ring-color, rgba(255,120,60,0.85)),
                     0 0 8px var(--ring-color, rgba(255,120,60,0.5));
        filter: var(--piece-filter, none) drop-shadow(0 0 3px var(--ring-color, rgba(255,120,60,0.6)));
      }
    }

    @keyframes glowShimmer {
      0%, 100% {
        filter: var(--piece-filter, none) drop-shadow(0 0 3px var(--ring-color, rgba(255,120,60,0.5)));
      }
      50% {
        filter: var(--piece-filter, none) drop-shadow(0 0 8px var(--ring-color, rgba(255,120,60,0.9)));
      }
    }

    @keyframes ringPulse {
      0%, 100% {
        filter: var(--piece-filter, none) drop-shadow(0 0 3px var(--ring-color, rgba(255,120,60,0.6)));
      }
      50% {
        filter: var(--piece-filter, none) drop-shadow(0 0 8px var(--ring-color, rgba(255,120,60,0.85)));
      }
    }

    @keyframes ringSoft {
      0%, 100% {
        filter: var(--piece-filter, none) drop-shadow(0 0 2px var(--ring-color, rgba(255,255,255,0.5)));
      }
      50% {
        filter: var(--piece-filter, none) drop-shadow(0 0 5px var(--ring-color, rgba(255,255,255,0.8)));
      }
    }

    @keyframes fireworks {
      0%, 100% {
        transform: scale(1) translateZ(0);
        filter: var(--piece-filter, none) drop-shadow(0 0 4px rgba(255,210,80,0.5));
      }
      50% {
        transform: scale(1.05) translateZ(0);
        filter: var(--piece-filter, none) drop-shadow(0 0 10px rgba(255,210,80,0.85));
      }
    }

    @keyframes checkPulse {
      0%, 100% {
        transform: scale(1) translateZ(0);
        filter: var(--piece-filter, none) drop-shadow(0 0 4px rgba(255,70,70,0.6));
      }
      50% {
        transform: scale(1.06) translateZ(0);
        filter: var(--piece-filter, none) drop-shadow(0 0 10px rgba(255,70,70,0.9));
      }
    }

    @keyframes mateFlare {
      0%, 100% {
        transform: scale(1) rotate(0deg) translateZ(0);
        filter: var(--piece-filter, none) drop-shadow(0 0 5px rgba(255,200,60,0.7));
      }
      50% {
        transform: scale(1.1) rotate(3deg) translateZ(0);
        filter: var(--piece-filter, none) drop-shadow(0 0 12px rgba(255,200,60,0.95));
      }
    }

    @keyframes captureBurst {
      0% {
        transform: scale(0.8) translateZ(0);
        opacity: 0;
        filter: var(--piece-filter, none) drop-shadow(0 0 2px rgba(255,120,60,0.5));
      }
      50% {
        transform: scale(1.02) translateZ(0);
        opacity: 1;
        filter: var(--piece-filter, none) drop-shadow(0 0 12px rgba(255,120,60,0.85));
      }
      100% {
        transform: scale(1.15) translateZ(0);
        opacity: 0;
        filter: var(--piece-filter, none) drop-shadow(0 0 1px rgba(255,120,60,0));
      }
    }

    @keyframes queenCapture {
      0%, 100% {
        transform: scale(1) translateZ(0);
        filter: var(--piece-filter, none) drop-shadow(0 0 3px rgba(255,190,90,0.6));
      }
      50% {
        transform: scale(1.06) translateZ(0);
        filter: var(--piece-filter, none) drop-shadow(0 0 9px rgba(255,190,90,0.9));
      }
    }

    /* Применяем анимации только к активным фигурам */
    ${glowTargetActive} {
      animation: ${ringAnimation}, glowShimmer 3.2s ease-in-out infinite;
      will-change: filter, transform;
    }

    ${glowTargetCheck} {
      animation: checkPulse 1s ease-in-out infinite;
      will-change: filter, transform;
      --ring-color: rgba(255,70,70,0.9);
    }

    ${glowTargetCheckmate},
    ${glowTargets.map((target) => `${target}.mate`).join(", ")} {
      animation: mateFlare 1.4s ease-in-out infinite;
      will-change: filter, transform;
      --ring-color: rgba(255,200,60,0.95);
    }

    ${glowTargetCapture} {
      animation: captureBurst 0.9s ease-out;
      will-change: transform, opacity;
    }

    .captured-pieces .piece.wq,
    .captured-pieces .piece.bq {
      animation: queenCapture 1.4s ease-in-out 1;
      will-change: filter, transform;
    }
  `;

  if (definition.type === "filter") {
    css += `
      .piece,
      .promotion-piece {
        --piece-filter: ${definition.filter};
        --ring-color: ${definition.ringColor};
      }
    `;

    if (definition.ringColorOverrides) {
      Object.entries(definition.ringColorOverrides).forEach(([piece, color]) => {
        css += `
          .piece.${piece},
          .promotion-piece.${piece} {
            --ring-color: ${color};
          }
        `;
      });
    }
  }

  effectStyleTag.textContent = css;
  document.head.appendChild(effectStyleTag);
}

function disableSkins() {
  if (skinStyleTag) skinStyleTag.remove();
  if (effectStyleTag) effectStyleTag.remove();
  skinStyleTag = null;
  effectStyleTag = null;
  lastAppliedSkin = null;
  lastAppliedEffect = null;
  lastAppliedTarget = null;
}

chrome.storage.sync.get(
  ["enabled", "activeSkin", "activeEffect", "activeTarget", "activeSkinPath", "activeSet"],
  (data) => {
  skinsEnabled = !!data.enabled;
  if (!skinsEnabled) return;

  let activeSkin = data.activeSkin;
  let activeEffect = data.activeEffect;
  const activeTarget = data.activeTarget || "all";
  const skinPath = data.activeSkinPath;

  if (data.activeSet && !activeSkin && !activeEffect) {
    if (SKIN_DEFINITIONS[data.activeSet]) {
      activeSkin = data.activeSet;
    } else if (EFFECT_DEFINITIONS[data.activeSet]) {
      activeEffect = data.activeSet;
    }
  }

  applySkin(activeSkin || "set2", skinPath || null);
  applyEffect(activeEffect || "native-ember", activeTarget);
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled && changes.enabled.newValue === false) {
    skinsEnabled = false;
    disableSkins();
    return;
  }

  if (changes.enabled && changes.enabled.newValue === true) {
    skinsEnabled = true;
    chrome.storage.sync.get(
      ["activeSkin", "activeEffect", "activeTarget", "activeSkinPath"],
      (data) => {
      applySkin(data.activeSkin || "set2", data.activeSkinPath || null);
      applyEffect(data.activeEffect || "native-ember", data.activeTarget || "all");
    });
    return;
  }

  if (!skinsEnabled) return;

  if (changes.activeSkin && changes.activeSkin.newValue) {
    chrome.storage.sync.get("activeSkinPath", (stored) => {
      applySkin(changes.activeSkin.newValue, stored.activeSkinPath || null);
    });
  }

  if (changes.activeEffect && changes.activeEffect.newValue) {
    chrome.storage.sync.get("activeTarget", (stored) => {
      applyEffect(changes.activeEffect.newValue, stored.activeTarget || "all");
    });
  }

  if (changes.activeSkinPath && changes.activeSkinPath.newValue) {
    chrome.storage.sync.get("activeSkin", (data) => {
      applySkin(data.activeSkin || "set2", changes.activeSkinPath.newValue || null);
    });
  }

  if (changes.activeTarget && changes.activeTarget.newValue) {
    chrome.storage.sync.get("activeEffect", (stored) => {
      applyEffect(stored.activeEffect || "native-ember", changes.activeTarget.newValue);
    });
  }

});

let lastOverlayAt = 0;
let hasShownGoodLuck = false;
let goodLuckObserver = null;

function ensureOverlayStyles() {
  if (overlayStyleTag) return;
  overlayStyleTag = document.createElement("style");
  overlayStyleTag.textContent = `
    .good-luck-overlay {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      pointer-events: none;
      font-family: "Inter", sans-serif;
      font-size: clamp(32px, 6vw, 72px);
      font-weight: 700;
      color: rgba(255, 240, 210, 0.95);
      text-shadow: 0 0 20px rgba(255, 170, 80, 0.85);
      animation: goodLuckFade 3.2s ease-out forwards;
      background: radial-gradient(circle, rgba(20,10,0,0.35) 0%, rgba(0,0,0,0) 70%);
    }

    @keyframes goodLuckFade {
      0% { opacity: 0; transform: translateY(20px) scale(0.98); }
      20% { opacity: 1; transform: translateY(0) scale(1); }
      70% { opacity: 1; }
      100% { opacity: 0; transform: translateY(-10px) scale(1.02); }
    }
  `;
  document.head.appendChild(overlayStyleTag);
}

function showGoodLuckOverlay() {
  if (!skinsEnabled) return;
  if (hasShownGoodLuck) return;
  const now = Date.now();
  if (now - lastOverlayAt < 5000) return;
  lastOverlayAt = now;
  ensureOverlayStyles();

  const overlay = document.createElement("div");
  overlay.className = "good-luck-overlay";
  overlay.textContent = "Good luck";
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 3400);
  hasShownGoodLuck = true;
  if (goodLuckObserver) {
    goodLuckObserver.disconnect();
    goodLuckObserver = null;
  }
}

function watchForGameStart() {
  if (window.location.pathname.includes("/analysis")) return;
  const maybeShow = () => {
    const board = document.querySelector(".board, .board-area, .board-container, chess-board");
    if (board) showGoodLuckOverlay();
  };

  maybeShow();
  if (!goodLuckObserver) {
    goodLuckObserver = new MutationObserver(() => maybeShow());
    goodLuckObserver.observe(document.body, { childList: true, subtree: true });
  }
}

// ========== НОВЫЕ ФУНКЦИИ ==========

function applyBoardStyle(styleId) {
  if (boardStyleTag) boardStyleTag.remove();
  if (!styleId || styleId === "default" || !BOARD_STYLES[styleId]) {
    BOARD_STYLES[styleId]?.id === styleId || loadDefaultBoardStyle();
    return;
  }

  const style = BOARD_STYLES[styleId];
  boardStyleTag = document.createElement("style");
  
  let css = `
    .board-square-light {
      background-color: ${style.lightColor} !important;
    }
    
    .board-square-dark {
      background-color: ${style.darkColor} !important;
    }
  `;
  
  // Для neon стиля добавляем свечение
  if (styleId === "neon" && style.glowColor) {
    css += `
      .board-square-light {
        box-shadow: inset 0 0 10px ${style.glowColor} !important;
      }
      .board-square-dark {
        box-shadow: inset 0 0 15px ${style.glowColor} !important;
      }
    `;
  }
  
  boardStyleTag.textContent = css;
  document.head.appendChild(boardStyleTag);
}

function loadDefaultBoardStyle() {
  if (boardStyleTag) boardStyleTag.remove();
  boardStyleTag = document.createElement("style");
  
  const defaultStyle = BOARD_STYLES["default"] || {
    lightColor: "#f0d9b5",
    darkColor: "#b58863"
  };
  
  boardStyleTag.textContent = `
    .board-square-light { background-color: ${defaultStyle.lightColor} !important; }
    .board-square-dark { background-color: ${defaultStyle.darkColor} !important; }
  `;
  document.head.appendChild(boardStyleTag);
}

// Интенсивность свечения (умножитель на opacity эффектов)
function setGlowIntensity(intensity) {
  glowIntensity = Math.max(0.1, Math.min(1, intensity));
  // Пересоздаём эффект с новой интенсивностью
  const currentEffect = chrome.storage.sync.get("activeEffect", (data) => {
    if (data.activeEffect) {
      chrome.storage.sync.get("activeTarget", (targetData) => {
        applyEffect(data.activeEffect, targetData.activeTarget || "all");
      });
    }
  });
}

// Анимации фигур (дыхание)
function enablePieceAnimation(enabled) {
  if (animationStyleTag) animationStyleTag.remove();
  if (!enabled) return;
  
  animationStyleTag = document.createElement("style");
  animationStyleTag.textContent = `
    .piece, .promotion-piece {
      animation: pieceBreathe 3s ease-in-out infinite;
    }
    
    @keyframes pieceBreathe {
      0%, 100% {
        transform: scale(1) translateZ(0);
      }
      50% {
        transform: scale(1.02) translateZ(0);
      }
    }
  `;
  document.head.appendChild(animationStyleTag);
}

// Оптимизированные частицы при ходах
function spawnParticles(x, y, type = "normal") {
  const container = document.querySelector(".chesscom-skins-overlay") || overlayRoot;
  if (!container) return;
  
  const particleCount = type === "capture" ? 8 : 4;
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    particle.style.left = x + "px";
    particle.style.top = y + "px";
    
    const angle = (Math.PI * 2 * i) / particleCount;
    const velocity = 2 + Math.random() * 3;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;
    
    particle.style.setProperty("--vx", vx);
    particle.style.setProperty("--vy", vy);
    
    const duration = 600 + Math.random() * 400;
    particle.style.animation = `particleFloat ${duration}ms ease-out forwards`;
    
    container.appendChild(particle);
    
    setTimeout(() => particle.remove(), duration);
  }
}

// Режим турнамента (случайный скин каждую новую игру)
function enableTournamentMode(enabled) {
  tournamentMode = enabled;
  if (enabled) {
    selectRandomSkin();
  }
}

function selectRandomSkin() {
  const skins = Object.keys(SKIN_DEFINITIONS).filter(id => id !== "none");
  if (skins.length === 0) return;
  
  const randomSkin = skins[Math.floor(Math.random() * skins.length)];
  currentTournamentSkin = randomSkin;
  
  chrome.storage.sync.set({
    activeSkin: randomSkin,
    activeSet: randomSkin
  });
  
  console.log("[ChesscomSkins Tournament] Selected: " + randomSkin);
}

// Добавляем слушатель на новые игры в режиме турнамента
if (tournamentMode) {
  window.addEventListener("beforeunload", () => {
    if (tournamentMode) {
      selectRandomSkin();
    }
  });
}

// ========== ОБРАБОТЧИК СООБЩЕНИЙ ОТ POPUP ==========
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setGlowIntensity") {
    setGlowIntensity(request.intensity);
    sendResponse({success: true});
  } else if (request.action === "setBoardStyle") {
    applyBoardStyle(request.style);
    sendResponse({success: true});
  } else if (request.action === "setFeature") {
    const feature = request.feature;
    const enabled = request.enabled;
    
    if (feature === "animation") {
      enablePieceAnimation(enabled);
    } else if (feature === "particles") {
      // Частицы уже применяются автоматически в spawnCrackEffect
    } else if (feature === "tournament") {
      enableTournamentMode(enabled);
    }
    sendResponse({success: true});
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", watchForGameStart);
} else {
  watchForGameStart();
}
