const PIECES = ["wk", "wq", "wr", "wb", "wn", "wp", "bk", "bq", "br", "bb", "bn", "bp"];

const toggle = document.getElementById("toggle");
const skinsContainer = document.getElementById("skins-container");
const effectPreviewImages = document.querySelectorAll(".effect-preview");
const targetButtons = document.querySelectorAll(".target-button");
const cracksButton = document.querySelector(".cracks-button");
const glowIntensitySlider = document.getElementById("glow-intensity");
const intensityValue = document.querySelector(".intensity-value");
const boardButtons = document.querySelectorAll(".board-button");
const featureButtons = document.querySelectorAll(".feature-button");
const importButton = document.querySelector(".import-button");
const exportButton = document.querySelector(".export-button");

let currentActiveSkin = null;
let currentActiveEffect = null;
let currentTarget = "all";
let cracksEnabled = false;
let loadedSkins = [];
let currentBoardStyle = "default";
let enabledFeatures = {
  animation: false,
  particles: false,
  tournament: false
};

// Кэширование селекторов для производительности
let cachedSelectors = {
  skinSets: null,
  effectKings: null
};

function getSkinSets() {
  if (!cachedSelectors.skinSets) {
    cachedSelectors.skinSets = document.querySelectorAll('.set[data-type="skin"]');
  }
  return cachedSelectors.skinSets;
}

function getEffectKings() {
  if (!cachedSelectors.effectKings) {
    cachedSelectors.effectKings = document.querySelectorAll(".effect-king");
  }
  return cachedSelectors.effectKings;
}

function clearSelectorCache() {
  cachedSelectors.skinSets = null;
  cachedSelectors.effectKings = null;
}

// Загрузка конфига скинов
async function loadSkinsConfig() {
  try {
    const url = chrome.runtime.getURL("assets/skins.json");
    const response = await fetch(url);
    const config = await response.json();
    
    if (config.skins && Array.isArray(config.skins)) {
      loadedSkins = config.skins;
      renderSkinsUI();
    }
  } catch (error) {
    console.error("[ChesscomSkins Popup] Ошибка загрузки конфига:", error);
  }
}

// Генерация HTML для скина
function createSkinElement(skin) {
  const darkThemes = ["set2"];
  const isDark = darkThemes.includes(skin.id);
  const previewClass = isDark ? "dark" : "light";
  
  const skinDiv = document.createElement("div");
  skinDiv.className = "set disabled";
  skinDiv.dataset.set = skin.id;
  skinDiv.dataset.type = "skin";
  
  const button = document.createElement("button");
  button.className = "set-toggle";
  button.textContent = skin.name;
  skinDiv.appendChild(button);
  
  const preview = document.createElement("div");
  preview.className = `preview ${previewClass}`;
  preview.dataset.label = skin.name;
  
  // Добавляем все фигуры
  PIECES.forEach(piece => {
    const img = document.createElement("img");
    img.src = `../assets/${skin.folder}/${piece}.png`;
    img.alt = piece;
    preview.appendChild(img);
  });
  
  skinDiv.appendChild(preview);
  return skinDiv;
}

// Рендеринг всех скинов
function renderSkinsUI() {
  skinsContainer.innerHTML = "";
  loadedSkins.forEach(skin => {
    skinsContainer.appendChild(createSkinElement(skin));
  });
  
  // Очищаем кэш и переинициализируем обработчики
  clearSelectorCache();
  initSkinHandlers();
}

// Инициализация обработчиков для скинов
function initSkinHandlers() {
  const skinSets = getSkinSets();
  
  skinSets.forEach(set => {
    const setName = set.dataset.set;
    if (!setName) return;
    const button = set.querySelector("button");
    if (!button) return;

    button.addEventListener("click", () => {
      if (!toggle.checked) return;

      const isSame = currentActiveSkin === setName;
      const nextSkin = isSame ? "none" : setName;
      const nextSet = isSame ? "none" : setName;

      chrome.storage.sync.set({ activeSet: nextSet, activeSkin: nextSkin }, () => {
        currentActiveSkin = isSame ? null : setName;
        setActiveSkinUI(currentActiveSkin);
        updateEffectPreviews(currentActiveSkin || loadedSkins[0]?.id || "set2");
      });
    });
  });
}

function updateEffectPreviews(activeSkin) {
  const skin = loadedSkins.find(s => s.id === activeSkin) || loadedSkins[0];
  if (!skin) return;
  
  const src = `../assets/${skin.folder}/${skin.previewPiece || "wk"}.png`;
  effectPreviewImages.forEach((img) => {
    img.src = src;
  });
}

// Инициализация обработчиков эффектов
function initEffectHandlers() {
  const effectKings = getEffectKings();
  
  effectKings.forEach((king) => {
    const effectName = king.dataset.effect;
    if (!effectName) return;

    king.addEventListener("click", () => {
      if (!toggle.checked) return;

      const isSame = currentActiveEffect === effectName;
      const nextEffect = isSame ? "none" : effectName;

      chrome.storage.sync.set({ activeEffect: nextEffect }, () => {
        currentActiveEffect = isSame ? null : effectName;
        setActiveEffectUI(currentActiveEffect);
      });
    });
  });
}

chrome.storage.sync.get(
  ["enabled", "activeSet", "activeSkin", "activeEffect", "activeTarget", "cracksEnabled", "glowIntensity", "boardStyle", "enabledFeatures"],
  data => {
  toggle.checked = !!data.enabled;
  
  const activeSet = data.activeSet && data.activeSet !== "none" ? data.activeSet : null;
  const activeSkin = data.activeSkin && data.activeSkin !== "none" ? data.activeSkin : null;
  const activeEffect = data.activeEffect && data.activeEffect !== "none" ? data.activeEffect : null;

  currentActiveSkin = activeSkin || (activeSet && loadedSkins.length ? activeSet : null);
  currentActiveEffect = activeEffect;
  currentTarget = data.activeTarget || "all";
  cracksEnabled = !!data.cracksEnabled;
  currentBoardStyle = data.boardStyle || "default";
  enabledFeatures = data.enabledFeatures || enabledFeatures;
  
  // Устанавливаем интенсивность
  if (glowIntensitySlider && data.glowIntensity) {
    glowIntensitySlider.value = data.glowIntensity;
    intensityValue.textContent = Math.round(data.glowIntensity * 100) + "%";
  }
  
  // Устанавливаем активный стиль доски
  boardButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.board === currentBoardStyle);
  });
  
  // Устанавливаем активные фичи
  featureButtons.forEach(btn => {
    btn.classList.toggle("active", enabledFeatures[btn.dataset.feature]);
  });
  
  setActiveSkinUI(currentActiveSkin);
  setActiveEffectUI(currentActiveEffect);
  setActiveTargetUI(currentTarget);
  setCracksUI(cracksEnabled);
  updateEffectPreviews(currentActiveSkin || loadedSkins[0]?.id || "set2");
  updateUI(toggle.checked);
});

toggle.addEventListener("change", () => {
  if (!toggle.checked) {
    chrome.storage.sync.set({ enabled: false });
    updateUI(false);
  } else {
    chrome.storage.sync.get(
      ["activeSet", "activeSkin", "activeEffect", "activeTarget", "cracksEnabled"],
      (data) => {
      chrome.storage.sync.set({ enabled: true });
      updateUI(true);
      const activeSet = data.activeSet && data.activeSet !== "none" ? data.activeSet : null;
      const activeSkin = data.activeSkin && data.activeSkin !== "none" ? data.activeSkin : null;
      const activeEffect = data.activeEffect && data.activeEffect !== "none" ? data.activeEffect : null;
      currentActiveSkin = activeSkin || (activeSet && loadedSkins.length ? activeSet : null);
      currentActiveEffect = activeEffect;
      currentTarget = data.activeTarget || "all";
      cracksEnabled = !!data.cracksEnabled;
      setActiveSkinUI(currentActiveSkin);
      setActiveEffectUI(currentActiveEffect);
      setActiveTargetUI(currentTarget);
      setCracksUI(cracksEnabled);
      updateEffectPreviews(currentActiveSkin || loadedSkins[0]?.id || "set2");
    });
  }
});

targetButtons.forEach((button) => {
  const target = button.dataset.target;
  if (!target) return;

  button.addEventListener("click", () => {
    if (!toggle.checked) return;
    currentTarget = target;
    chrome.storage.sync.set({ activeTarget: target }, () => {
      setActiveTargetUI(currentTarget);
    });
  });
});

if (cracksButton) {
  cracksButton.addEventListener("click", () => {
    if (!toggle.checked) return;
    cracksEnabled = !cracksEnabled;
    chrome.storage.sync.set({ cracksEnabled }, () => {
      setCracksUI(cracksEnabled);
    });
  });
}

function updateUI(enabled) {
  getSkinSets().forEach(set => {
    set.classList.toggle("disabled", !enabled);
  });
  const effectContainer = document.querySelector('.set[data-type="effect"]');
  if (effectContainer) {
    effectContainer.classList.toggle("disabled", !enabled);
  }
  const targetToggle = document.querySelector(".target-toggle");
  if (targetToggle) {
    targetToggle.classList.toggle("disabled", !enabled);
  }
  if (cracksButton) {
    const cracksContainer = cracksButton.closest(".cracks-toggle");
    if (cracksContainer) {
      cracksContainer.classList.toggle("disabled", !enabled);
    }
  }
}

function setActiveSkinUI(activeID) {
  getSkinSets().forEach(set => {
    set.classList.toggle("active", activeID && set.dataset.set === activeID);
  });
}

function setActiveEffectUI(activeID) {
  getEffectKings().forEach((king) => {
    king.classList.toggle("active", activeID && king.dataset.effect === activeID);
  });
}

function setActiveTargetUI(activeID) {
  targetButtons.forEach((button) => {
    button.classList.toggle("active", activeID && button.dataset.target === activeID);
  });
}

// ========== НОВЫЕ ОБРАБОТЧИКИ ==========

// Бегунок интенсивности свечения
if (glowIntensitySlider) {
  glowIntensitySlider.addEventListener("input", (e) => {
    const intensity = parseFloat(e.target.value);
    const percent = Math.round(intensity * 100);
    intensityValue.textContent = percent + "%";
    
    chrome.storage.sync.set({ glowIntensity: intensity });
    
    // Отправляем сообщение в content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: "setGlowIntensity",
          intensity: intensity
        }).catch(() => {});
      });
    });
  });
}

// Стили доски
boardButtons.forEach(button => {
  button.addEventListener("click", () => {
    if (!toggle.checked) return;
    
    const boardStyle = button.dataset.board;
    currentBoardStyle = boardStyle;
    
    chrome.storage.sync.set({ boardStyle });
    
    // Обновляем UI
    boardButtons.forEach(b => {
      b.classList.toggle("active", b.dataset.board === boardStyle);
    });
    
    // Отправляем в content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: "setBoardStyle",
          style: boardStyle
        }).catch(() => {});
      });
    });
  });
});

// Фичи (анимация, частицы, турнамент)
featureButtons.forEach(button => {
  button.addEventListener("click", () => {
    if (!toggle.checked) return;
    
    const feature = button.dataset.feature;
    enabledFeatures[feature] = !enabledFeatures[feature];
    
    button.classList.toggle("active", enabledFeatures[feature]);
    
    chrome.storage.sync.set({
      enabledFeatures
    });
    
    // Отправляем в content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: "setFeature",
          feature,
          enabled: enabledFeatures[feature]
        }).catch(() => {});
      });
    });
  });
});

// Импорт скина
if (importButton) {
  importButton.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip";
    input.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      // Базовая проверка
      if (!file.name.endsWith(".zip")) {
        alert("Please select a .zip file");
        return;
      }
      
      alert("Skin import feature will be available soon. Please manually add skin files to assets/ folder and update assets/skins.json");
    });
    input.click();
  });
}

// Экспорт скина
if (exportButton) {
  exportButton.disabled = true; // На данный момент отключена
}

// Функция установки UI для трещин
function setCracksUI(enabled) {
  if (!cracksButton) return;
  cracksButton.classList.toggle("active", enabled);
  cracksButton.textContent = enabled ? "Disable cracks" : "Enable cracks";
}

// Инициализация
loadSkinsConfig();
initEffectHandlers();
