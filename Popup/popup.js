const toggle = document.getElementById("toggle");
const skinSets = document.querySelectorAll('.set[data-type="skin"]');
const effectKings = document.querySelectorAll(".effect-king");
const effectPreviewImages = document.querySelectorAll(".effect-preview");
const targetButtons = document.querySelectorAll(".target-button");
let currentActiveSkin = null;
let currentActiveEffect = null;
let currentTarget = "all";

const SKIN_PREVIEW_SOURCES = {
  set2: "../assets/Set2/wk.png"
};

function updateEffectPreviews(activeSkin) {
  const src = SKIN_PREVIEW_SOURCES[activeSkin] || SKIN_PREVIEW_SOURCES.set2;
  effectPreviewImages.forEach((img) => {
    img.src = src;
  });
}

chrome.storage.sync.get(["enabled", "activeSet", "activeSkin", "activeEffect", "activeTarget"], data => {
  toggle.checked = !!data.enabled;
  updateUI(toggle.checked);

  const activeSet = data.activeSet && data.activeSet !== "none" ? data.activeSet : null;
  const activeSkin = data.activeSkin && data.activeSkin !== "none" ? data.activeSkin : null;
  const activeEffect = data.activeEffect && data.activeEffect !== "none" ? data.activeEffect : null;

  currentActiveSkin = activeSkin || (activeSet && skinSets.length ? activeSet : null);
  currentActiveEffect = activeEffect;
  currentTarget = data.activeTarget || "all";
  setActiveSkinUI(currentActiveSkin);
  setActiveEffectUI(currentActiveEffect);
  setActiveTargetUI(currentTarget);
  updateEffectPreviews(currentActiveSkin || "set2");
});

toggle.addEventListener("change", () => {
  if (!toggle.checked) {
    chrome.storage.sync.set({ enabled: false });
    updateUI(false);
  } else {
    chrome.storage.sync.get(["activeSet", "activeSkin", "activeEffect", "activeTarget"], (data) => {
      chrome.storage.sync.set({ enabled: true });
      updateUI(true);
      const activeSet = data.activeSet && data.activeSet !== "none" ? data.activeSet : null;
      const activeSkin = data.activeSkin && data.activeSkin !== "none" ? data.activeSkin : null;
      const activeEffect = data.activeEffect && data.activeEffect !== "none" ? data.activeEffect : null;
      currentActiveSkin = activeSkin || (activeSet && skinSets.length ? activeSet : null);
      currentActiveEffect = activeEffect;
      currentTarget = data.activeTarget || "all";
      setActiveSkinUI(currentActiveSkin);
      setActiveEffectUI(currentActiveEffect);
      setActiveTargetUI(currentTarget);
      updateEffectPreviews(currentActiveSkin || "set2");
    });
  }
});

skinSets.forEach(set => {
  const setName = set.dataset.set;
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
      updateEffectPreviews(currentActiveSkin || "set2");
    });
  });
});

effectKings.forEach((king) => {
  const effectName = king.dataset.effect;
  if (!effectName) return;

  king.addEventListener("click", () => {
    if (!toggle.checked) return;

    const isSame = currentActiveEffect === effectName;
    const nextEffect = isSame ? "none" : effectName;

    chrome.storage.sync.set({ activeSet: nextEffect, activeEffect: nextEffect }, () => {
      currentActiveEffect = isSame ? null : effectName;
      setActiveEffectUI(currentActiveEffect);
    });
  });
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

function updateUI(enabled) {
  skinSets.forEach(set => {
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
}

function setActiveSkinUI(activeID) {
  skinSets.forEach(set => {
    set.classList.toggle("active", activeID && set.dataset.set === activeID);
  });
}

function setActiveEffectUI(activeID) {
  effectKings.forEach((king) => {
    king.classList.toggle("active", activeID && king.dataset.effect === activeID);
  });
}

function setActiveTargetUI(activeID) {
  targetButtons.forEach((button) => {
    button.classList.toggle("active", activeID && button.dataset.target === activeID);
  });
}
