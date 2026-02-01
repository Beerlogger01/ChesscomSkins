// ============================================
// ChesscomSkins - Popup Script
// Простая и понятная реализация
// ============================================

const PIECES = ["wk", "wq", "wr", "wb", "wn", "wp", "bk", "bq", "br", "bb", "bn", "bp"];

// DOM элементы
const toggle = document.getElementById("toggle");
const skinsContainer = document.getElementById("skins-container");
const effectKings = document.querySelectorAll(".effect-king");
const effectPreviews = document.querySelectorAll(".effect-preview");
const glowSlider = document.getElementById("glow-intensity");
const intensityValue = document.querySelector(".intensity-value");
const targetButtons = document.querySelectorAll(".target-button");
const boardButtons = document.querySelectorAll(".board-button");
const animationButtons = document.querySelectorAll(".animation-button");
const extrasButtons = document.querySelectorAll(".extras-button");

// Состояние
let loadedSkins = [];
let state = {
  enabled: false,
  activeSkin: null,
  activeEffect: null,
  boardStyle: "default",
  glowIntensity: 1.0,
  glowTarget: "all",
  particlesEnabled: false,
  cracksEnabled: false,
  tournamentMode: false
};

// ============================================
// Загрузка конфига скинов
// ============================================

async function loadSkinsConfig() {
  try {
    const url = chrome.runtime.getURL("assets/skins.json");
    const response = await fetch(url);
    const config = await response.json();
    
    if (config.skins && Array.isArray(config.skins)) {
      loadedSkins = config.skins;
      renderSkins();
    }
    
    console.log("[Popup] Skins loaded:", loadedSkins);
  } catch (error) {
    console.error("[Popup] Failed to load skins:", error);
  }
}

// ============================================
// Рендер скинов
// ============================================

function renderSkins() {
  skinsContainer.innerHTML = "";
  
  loadedSkins.forEach(skin => {
    const skinDiv = document.createElement("div");
    skinDiv.className = "set disabled";
    skinDiv.dataset.skin = skin.id;
    
    // Тёмные темы
    const darkThemes = ["set2"];
    if (darkThemes.includes(skin.id)) {
      skinDiv.classList.add("festive");
    }
    
    // Кнопка
    const button = document.createElement("button");
    button.className = "set-toggle";
    button.textContent = skin.name;
    skinDiv.appendChild(button);
    
    // Превью фигур
    const preview = document.createElement("div");
    preview.className = darkThemes.includes(skin.id) ? "preview dark" : "preview light";
    preview.dataset.label = skin.name;
    
    PIECES.forEach(piece => {
      const img = document.createElement("img");
      img.src = `../assets/${skin.folder}/${piece}.png`;
      img.alt = piece;
      preview.appendChild(img);
    });
    
    skinDiv.appendChild(preview);
    skinsContainer.appendChild(skinDiv);
    
    // Обработчик клика
    button.addEventListener("click", () => {
      if (!state.enabled) return;
      
      const newSkin = state.activeSkin === skin.id ? null : skin.id;
      state.activeSkin = newSkin;
      
      chrome.storage.sync.set({ activeSkin: newSkin || "none" });
      updateSkinUI();
      updateEffectPreviews();
    });
  });
}

// ============================================
// Обновление UI
// ============================================

function updateUI() {
  const enabled = state.enabled;
  
  // Скины
  document.querySelectorAll(".set").forEach(el => {
    el.classList.toggle("disabled", !enabled);
  });
  
  // Все контролы
  document.querySelectorAll(".glow-intensity-control, .target-toggle, .board-styles-control, .animations-control, .extras-control").forEach(el => {
    el.classList.toggle("disabled", !enabled);
  });
  
  updateSkinUI();
  updateEffectUI();
  updateTargetUI();
  updateBoardUI();
  updateAnimationsUI();
  updateExtrasUI();
}

function updateSkinUI() {
  document.querySelectorAll(".set").forEach(el => {
    el.classList.toggle("active", el.dataset.skin === state.activeSkin);
  });
}

function updateEffectUI() {
  effectKings.forEach(king => {
    king.classList.toggle("active", king.dataset.effect === state.activeEffect);
  });
}

function updateTargetUI() {
  targetButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.target === state.glowTarget);
  });
}

function updateBoardUI() {
  boardButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.board === state.boardStyle);
  });
}

function updateAnimationsUI() {
  animationButtons.forEach(btn => {
    const anim = btn.dataset.anim;
    let isActive = false;
    
    if (anim === "particles") isActive = state.particlesEnabled;
    else if (anim === "cracks") isActive = state.cracksEnabled;
    
    btn.classList.toggle("active", isActive);
  });
}

function updateExtrasUI() {
  extrasButtons.forEach(btn => {
    if (btn.dataset.extra === "tournament") {
      btn.classList.toggle("active", state.tournamentMode);
    }
  });
}

function updateEffectPreviews() {
  const skin = loadedSkins.find(s => s.id === state.activeSkin) || loadedSkins[0];
  if (!skin) return;
  
  const src = `../assets/${skin.folder}/${skin.previewPiece || "wk"}.png`;
  effectPreviews.forEach(img => {
    img.src = src;
  });
}

// ============================================
// Инициализация из storage
// ============================================

async function initFromStorage() {
  return new Promise(resolve => {
    chrome.storage.sync.get([
      "enabled",
      "activeSkin",
      "activeEffect",
      "boardStyle",
      "glowIntensity",
      "glowTarget",
      "particlesEnabled",
      "cracksEnabled",
      "tournamentMode"
    ], data => {
      console.log("[Popup] Storage data:", data);
      
      state.enabled = !!data.enabled;
      state.activeSkin = (data.activeSkin && data.activeSkin !== "none") ? data.activeSkin : null;
      state.activeEffect = (data.activeEffect && data.activeEffect !== "none") ? data.activeEffect : null;
      state.boardStyle = data.boardStyle || "default";
      state.glowIntensity = parseFloat(data.glowIntensity) || 1.0;
      state.glowTarget = data.glowTarget || "all";
      state.particlesEnabled = !!data.particlesEnabled;
      state.cracksEnabled = !!data.cracksEnabled;
      state.tournamentMode = !!data.tournamentMode;
      
      // Обновляем UI элементы
      toggle.checked = state.enabled;
      
      if (glowSlider) {
        glowSlider.value = state.glowIntensity;
        intensityValue.textContent = Math.round(state.glowIntensity * 100) + "%";
      }
      
      updateUI();
      updateEffectPreviews();
      
      resolve();
    });
  });
}

// ============================================
// Обработчики событий
// ============================================

// Главный переключатель
toggle.addEventListener("change", () => {
  state.enabled = toggle.checked;
  
  if (state.enabled) {
    // При включении устанавливаем дефолтный скин если не выбран
    if (!state.activeSkin && loadedSkins.length > 0) {
      state.activeSkin = loadedSkins[0].id;
    }
    
    chrome.storage.sync.set({
      enabled: true,
      activeSkin: state.activeSkin || "none",
      activeEffect: state.activeEffect || "none",
      boardStyle: state.boardStyle,
      glowIntensity: state.glowIntensity,
      glowTarget: state.glowTarget,
      particlesEnabled: state.particlesEnabled,
      cracksEnabled: state.cracksEnabled
    });
  } else {
    chrome.storage.sync.set({ enabled: false });
  }
  
  updateUI();
});

// Эффекты свечения
effectKings.forEach(king => {
  king.addEventListener("click", () => {
    if (!state.enabled) return;
    
    const effect = king.dataset.effect;
    const newEffect = state.activeEffect === effect ? null : effect;
    state.activeEffect = newEffect;
    
    chrome.storage.sync.set({ activeEffect: newEffect || "none" });
    updateEffectUI();
  });
});

// Слайдер интенсивности
if (glowSlider) {
  glowSlider.addEventListener("input", e => {
    const val = parseFloat(e.target.value);
    state.glowIntensity = val;
    intensityValue.textContent = Math.round(val * 100) + "%";
    
    chrome.storage.sync.set({ glowIntensity: val });
    
    // Отправляем сообщение в content script для мгновенного обновления
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "setGlowIntensity",
          intensity: val
        }).catch(() => {});
      }
    });
  });
}

// Стили доски
boardButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (!state.enabled) return;
    
    state.boardStyle = btn.dataset.board;
    chrome.storage.sync.set({ boardStyle: state.boardStyle });
    updateBoardUI();
  });
});

// Target для свечения (All / Royal)
targetButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (!state.enabled) return;
    
    state.glowTarget = btn.dataset.target;
    chrome.storage.sync.set({ glowTarget: state.glowTarget });
    updateTargetUI();
  });
});

// Анимации (частицы, трещины)
animationButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (!state.enabled) return;
    
    const anim = btn.dataset.anim;
    
    if (anim === "particles") {
      state.particlesEnabled = !state.particlesEnabled;
      chrome.storage.sync.set({ particlesEnabled: state.particlesEnabled });
    } else if (anim === "cracks") {
      state.cracksEnabled = !state.cracksEnabled;
      chrome.storage.sync.set({ cracksEnabled: state.cracksEnabled });
    }
    
    updateAnimationsUI();
  });
});

// Extras (турнамент, импорт, экспорт)
extrasButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.classList.contains("import-btn")) {
      // Импорт скина
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".zip";
      input.addEventListener("change", e => {
        const file = e.target.files?.[0];
        if (file) {
          alert("Функция импорта скинов будет добавлена позже.\n\nПока добавляйте скины вручную в папку assets/ и обновляйте assets/skins.json");
        }
      });
      input.click();
      return;
    }
    
    if (btn.classList.contains("export-btn")) {
      alert("Функция экспорта будет добавлена позже.");
      return;
    }
    
    if (btn.dataset.extra === "tournament") {
      if (!state.enabled) return;
      
      state.tournamentMode = !state.tournamentMode;
      chrome.storage.sync.set({ tournamentMode: state.tournamentMode });
      updateExtrasUI();
    }
  });
});

// ============================================
// Запуск
// ============================================

async function init() {
  await loadSkinsConfig();
  await initFromStorage();
}

init();
