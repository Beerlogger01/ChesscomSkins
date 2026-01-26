
const toggle = document.getElementById("toggle");
const sets = document.querySelectorAll(".set");
const effectPreviewImages = document.querySelectorAll(".effect-preview");
let currentActiveSet = null;

const SKIN_PREVIEW_SOURCES = {
  set2: "../assets/Set2/wk.png"
};

function updateEffectPreviews(activeSkin) {
  const src = SKIN_PREVIEW_SOURCES[activeSkin] || SKIN_PREVIEW_SOURCES.set2;
  effectPreviewImages.forEach((img) => {
    img.src = src;
  });
}

chrome.storage.sync.get(["enabled", "activeSet", "activeSkin", "activeEffect"], data => {
  toggle.checked = !!data.enabled;
  updateUI(toggle.checked);

  const activeSet = data.activeSet && data.activeSet !== "none" ? data.activeSet : null;
  const activeSkin = data.activeSkin && data.activeSkin !== "none" ? data.activeSkin : null;
  const activeEffect = data.activeEffect && data.activeEffect !== "none" ? data.activeEffect : null;

  currentActiveSet = activeSet || activeEffect || activeSkin || null;
  setActiveUI(currentActiveSet);
  updateEffectPreviews(activeSkin || "set2");
});

toggle.addEventListener("change", () => {
  if (!toggle.checked) {
    chrome.storage.sync.set({ enabled: false });
    updateUI(false);
  } else {
    chrome.storage.sync.get(["activeSet", "activeSkin", "activeEffect"], (data) => {
      chrome.storage.sync.set({ enabled: true });
      updateUI(true);
      const activeSet = data.activeSet && data.activeSet !== "none" ? data.activeSet : null;
      const activeSkin = data.activeSkin && data.activeSkin !== "none" ? data.activeSkin : null;
      const activeEffect = data.activeEffect && data.activeEffect !== "none" ? data.activeEffect : null;
      currentActiveSet = activeSet || activeEffect || activeSkin || null;
      setActiveUI(currentActiveSet);
      updateEffectPreviews(activeSkin || "set2");
    });
  }
});

sets.forEach(set => {
  const setName = set.dataset.set;
  const setType = set.dataset.type;

  set.querySelector("button").addEventListener("click", () => {
    if (!toggle.checked) return;

    const isSame = currentActiveSet === setName;
    const nextSet = isSame ? "none" : setName;

    const storageUpdate = { activeSet: nextSet };
    if (setType === "skin") {
      storageUpdate.activeSkin = isSame ? "none" : setName;
    }
    if (setType === "effect") {
      storageUpdate.activeEffect = isSame ? "none" : setName;
    }

    chrome.storage.sync.set(storageUpdate, () => {
      currentActiveSet = isSame ? null : setName;
      setActiveUI(currentActiveSet);
      if (setType === "skin") {
        updateEffectPreviews(isSame ? "set2" : setName);
      }
    });
  });
});

function updateUI(enabled) {
  sets.forEach(set => {
    set.classList.toggle("disabled", !enabled);
  });
}

function setActiveUI(activeID) {
  sets.forEach(set => {
    set.classList.toggle("active", activeID && set.dataset.set === activeID);
  });
}
