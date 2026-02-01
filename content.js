// ============================================
// ChesscomSkins - Content Script (Main)
// Простая и надёжная реализация
// ============================================

const PIECES = ["wk","wq","wr","wb","wn","wp","bk","bq","br","bb","bn","bp"];

// Состояние
let skinsEnabled = false;
let currentSkin = null;
let currentEffect = null;
let currentBoardStyle = null;
let glowIntensity = 1.0;
let glowTarget = "all"; // "all" или "royal"
let animationsEnabled = false;

// DOM элементы для стилей
let skinStyleTag = null;
let effectStyleTag = null;
let boardStyleTag = null;
let animationStyleTag = null;

// Конфиги
let SKINS = {};
let BOARD_STYLES = {};

// ============================================
// Загрузка конфигов
// ============================================

async function loadConfigs() {
  try {
    // Загружаем скины
    const skinsUrl = chrome.runtime.getURL("assets/skins.json");
    const skinsResp = await fetch(skinsUrl);
    const skinsData = await skinsResp.json();
    
    if (skinsData.skins) {
      skinsData.skins.forEach(skin => {
        SKINS[skin.id] = {
          name: skin.name,
          folder: skin.folder,
          path: `assets/${skin.folder}`
        };
      });
    }
    
    // Загружаем стили доски
    const configUrl = chrome.runtime.getURL("assets/config.json");
    const configResp = await fetch(configUrl);
    const configData = await configResp.json();
    
    if (configData.boardStyles) {
      configData.boardStyles.forEach(style => {
        BOARD_STYLES[style.id] = style;
      });
    }
    
    console.log("[ChesscomSkins] Configs loaded:", Object.keys(SKINS), Object.keys(BOARD_STYLES));
  } catch (e) {
    console.error("[ChesscomSkins] Failed to load configs:", e);
  }
}

// ============================================
// Применение скина фигур
// ============================================

function applySkin(skinId) {
  // Удаляем старый стиль
  if (skinStyleTag) {
    skinStyleTag.remove();
    skinStyleTag = null;
  }
  
  currentSkin = skinId;
  
  if (!skinId || skinId === "none" || !SKINS[skinId]) {
    console.log("[ChesscomSkins] Skin disabled");
    return;
  }
  
  const skin = SKINS[skinId];
  const basePath = skin.path;
  
  let css = "";
  PIECES.forEach(piece => {
    const url = chrome.runtime.getURL(`${basePath}/${piece}.png`);
    css += `
      .piece.${piece} {
        background-image: url("${url}") !important;
      }
    `;
  });
  
  skinStyleTag = document.createElement("style");
  skinStyleTag.id = "chesscom-skins-pieces";
  skinStyleTag.textContent = css;
  document.head.appendChild(skinStyleTag);
  
  console.log("[ChesscomSkins] Skin applied:", skinId);
}

// ============================================
// Применение эффекта свечения
// ============================================

function applyEffect(effectId) {
  // Удаляем старый стиль
  if (effectStyleTag) {
    effectStyleTag.remove();
    effectStyleTag = null;
  }
  
  currentEffect = effectId;
  
  if (!effectId || effectId === "none") {
    console.log("[ChesscomSkins] Effect disabled");
    return;
  }
  
  // Определяем параметры эффекта
  const effects = {
    "native-ember": {
      filter: "hue-rotate(-12deg) saturate(1.2) brightness(1.02)",
      glowColor: "rgba(255, 120, 60, 0.8)",
      glowSize: 8
    },
    "native-frost": {
      filter: "hue-rotate(185deg) saturate(1.2) brightness(1.05)",
      glowColor: "rgba(110, 190, 255, 0.8)",
      glowSize: 8
    },
    "native-neon": {
      filter: "hue-rotate(270deg) saturate(1.3) brightness(1.05)",
      glowColor: "rgba(210, 120, 255, 0.8)",
      glowSize: 10
    },
    "legendary-ember": {
      filter: "saturate(1.3) brightness(1.08)",
      glowColor: "rgba(255, 180, 60, 0.9)",
      glowSize: 12
    },
    "minimal": {
      filter: "saturate(1.02) brightness(1.01)",
      glowColor: "rgba(255, 255, 255, 0.6)",
      glowSize: 4
    }
  };
  
  const effect = effects[effectId];
  if (!effect) {
    console.log("[ChesscomSkins] Unknown effect:", effectId);
    return;
  }
  
  // Вычисляем размер свечения с учётом интенсивности
  const actualGlowSize = Math.round(effect.glowSize * glowIntensity);
  
  // Селектор зависит от target
  let pieceSelector = ".piece";
  if (glowTarget === "royal") {
    pieceSelector = ".piece.wk, .piece.bk, .piece.wq, .piece.bq";
  }
  
  const css = `
    ${pieceSelector} {
      filter: ${effect.filter} drop-shadow(0 0 ${actualGlowSize}px ${effect.glowColor}) !important;
      transition: filter 0.2s ease;
    }
    
    /* Убираем эффекты для захваченных фигур */
    .captured-pieces .piece,
    [class*="captured"] .piece {
      filter: none !important;
    }
  `;
  
  effectStyleTag = document.createElement("style");
  effectStyleTag.id = "chesscom-skins-effect";
  effectStyleTag.textContent = css;
  document.head.appendChild(effectStyleTag);
  
  console.log("[ChesscomSkins] Effect applied:", effectId, "intensity:", glowIntensity);
}

// ============================================
// Применение стиля доски
// ============================================

function applyBoardStyle(styleId) {
  // Удаляем старый стиль
  if (boardStyleTag) {
    boardStyleTag.remove();
    boardStyleTag = null;
  }
  
  currentBoardStyle = styleId;
  
  if (!styleId || styleId === "default") {
    console.log("[ChesscomSkins] Board style reset to default");
    return;
  }
  
  const style = BOARD_STYLES[styleId];
  if (!style) {
    console.log("[ChesscomSkins] Unknown board style:", styleId);
    return;
  }
  
  // Chess.com использует wc-chess-board с SVG внутри
  // Основной способ - переопределение CSS custom properties и fill для SVG
  
  let css = `
    /* Переопределяем CSS переменные chess.com */
    :root {
      --theme-board-style-light: ${style.lightColor} !important;
      --theme-board-style-dark: ${style.darkColor} !important;
    }
    
    /* Стили для SVG rect элементов внутри wc-chess-board */
    wc-chess-board svg rect.light-square,
    wc-chess-board svg .light {
      fill: ${style.lightColor} !important;
    }
    
    wc-chess-board svg rect.dark-square,
    wc-chess-board svg .dark {
      fill: ${style.darkColor} !important;
    }
    
    /* Fallback для canvas-based доски через filter */
    wc-chess-board {
      --cb-light: ${style.lightColor} !important;
      --cb-dark: ${style.darkColor} !important;
    }
    
    /* Старый способ через классы */
    .board .square-light,
    .board .light {
      background-color: ${style.lightColor} !important;
    }
    
    .board .square-dark,
    .board .dark {
      background-color: ${style.darkColor} !important;
    }
  `;
  
  // Для neon стиля добавляем свечение на контейнер доски
  if (style.glowColor) {
    css += `
      wc-chess-board,
      .board-layout-main {
        box-shadow: 0 0 40px ${style.glowColor} !important;
        border-radius: 4px;
      }
    `;
  }
  
  boardStyleTag = document.createElement("style");
  boardStyleTag.id = "chesscom-skins-board";
  boardStyleTag.textContent = css;
  document.head.appendChild(boardStyleTag);
  
  console.log("[ChesscomSkins] Board style applied:", styleId);
}

// ============================================
// Установка интенсивности свечения
// ============================================

function setGlowIntensity(value) {
  glowIntensity = Math.max(0.1, Math.min(1.5, parseFloat(value) || 1.0));
  console.log("[ChesscomSkins] Glow intensity set to:", glowIntensity);
  
  // Перепрменяем эффект с новой интенсивностью
  if (currentEffect && currentEffect !== "none") {
    applyEffect(currentEffect);
  }
}

// ============================================
// Анимации (визуальные эффекты при ходах)
// ============================================

function enableAnimations(enabled) {
  animationsEnabled = enabled;
  
  if (animationStyleTag) {
    animationStyleTag.remove();
    animationStyleTag = null;
  }
  
  if (!enabled) {
    console.log("[ChesscomSkins] Animations disabled");
    return;
  }
  
  // Добавляем CSS для анимаций
  animationStyleTag = document.createElement("style");
  animationStyleTag.id = "chesscom-skins-animations";
  animationStyleTag.textContent = `
    /* Эффект при перемещении фигуры */
    .piece {
      transition: transform 0.15s ease-out, filter 0.2s ease !important;
    }
    
    /* Подсветка последнего хода */
    .highlight {
      animation: highlightPulse 0.5s ease-out;
    }
    
    @keyframes highlightPulse {
      0% { box-shadow: inset 0 0 20px rgba(255, 200, 100, 0.8); }
      100% { box-shadow: none; }
    }
  `;
  document.head.appendChild(animationStyleTag);
  
  console.log("[ChesscomSkins] Animations enabled");
}

// ============================================
// Отключение всего
// ============================================

function disableAll() {
  if (skinStyleTag) {
    skinStyleTag.remove();
    skinStyleTag = null;
  }
  if (effectStyleTag) {
    effectStyleTag.remove();
    effectStyleTag = null;
  }
  if (boardStyleTag) {
    boardStyleTag.remove();
    boardStyleTag = null;
  }
  if (animationStyleTag) {
    animationStyleTag.remove();
    animationStyleTag = null;
  }
  
  currentSkin = null;
  currentEffect = null;
  currentBoardStyle = null;
  skinsEnabled = false;
  animationsEnabled = false;
  
  console.log("[ChesscomSkins] All disabled");
}

// ============================================
// Инициализация из storage
// ============================================

async function initialize() {
  await loadConfigs();
  
  chrome.storage.sync.get([
    "enabled",
    "activeSkin",
    "activeEffect",
    "boardStyle",
    "glowIntensity",
    "glowTarget",
    "animationsEnabled"
  ], (data) => {
    console.log("[ChesscomSkins] Storage data:", data);
    
    skinsEnabled = !!data.enabled;
    glowIntensity = parseFloat(data.glowIntensity) || 1.0;
    glowTarget = data.glowTarget || "all";
    
    if (skinsEnabled) {
      if (data.activeSkin && data.activeSkin !== "none") {
        applySkin(data.activeSkin);
      }
      if (data.activeEffect && data.activeEffect !== "none") {
        applyEffect(data.activeEffect);
      }
      if (data.boardStyle && data.boardStyle !== "default") {
        applyBoardStyle(data.boardStyle);
      }
      if (data.animationsEnabled) {
        enableAnimations(true);
      }
    }
  });
}

// ============================================
// Слушатель изменений storage
// ============================================

chrome.storage.onChanged.addListener((changes) => {
  console.log("[ChesscomSkins] Storage changed:", changes);
  
  // Включение/выключение
  if (changes.enabled) {
    skinsEnabled = !!changes.enabled.newValue;
    if (!skinsEnabled) {
      disableAll();
    } else {
      // При включении применяем сохранённые настройки
      chrome.storage.sync.get(["activeSkin", "activeEffect", "boardStyle", "glowIntensity", "glowTarget", "animationsEnabled"], (data) => {
        glowIntensity = parseFloat(data.glowIntensity) || 1.0;
        glowTarget = data.glowTarget || "all";
        if (data.activeSkin) applySkin(data.activeSkin);
        if (data.activeEffect) applyEffect(data.activeEffect);
        if (data.boardStyle) applyBoardStyle(data.boardStyle);
        if (data.animationsEnabled) enableAnimations(true);
      });
    }
    return;
  }
  
  if (!skinsEnabled) return;
  
  // Изменение скина
  if (changes.activeSkin) {
    applySkin(changes.activeSkin.newValue);
  }
  
  // Изменение эффекта
  if (changes.activeEffect) {
    applyEffect(changes.activeEffect.newValue);
  }
  
  // Изменение стиля доски
  if (changes.boardStyle) {
    applyBoardStyle(changes.boardStyle.newValue);
  }
  
  // Изменение интенсивности
  if (changes.glowIntensity) {
    setGlowIntensity(changes.glowIntensity.newValue);
  }
  
  // Изменение target свечения
  if (changes.glowTarget) {
    glowTarget = changes.glowTarget.newValue || "all";
    // Перепрменяем эффект с новым target
    if (currentEffect && currentEffect !== "none") {
      applyEffect(currentEffect);
    }
  }
  
  // Анимации
  if (changes.animationsEnabled) {
    enableAnimations(!!changes.animationsEnabled.newValue);
  }
});

// ============================================
// Обработчик сообщений от popup
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[ChesscomSkins] Message received:", request);
  
  if (request.action === "setGlowIntensity") {
    setGlowIntensity(request.intensity);
    sendResponse({ success: true });
  }
  
  return true;
});

// ============================================
// Запуск
// ============================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
