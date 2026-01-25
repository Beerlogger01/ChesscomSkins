
const toggle = document.getElementById("toggle");
const sets = document.querySelectorAll(".set");

chrome.storage.sync.get(["enabled", "activeSet"], data => {
  toggle.checked = !!data.enabled;
  updateUI(toggle.checked);

  if (data.activeSet) {
    setActiveUI(data.activeSet);
  }
});

toggle.addEventListener("change", () => {
  if (!toggle.checked) {
    chrome.storage.sync.set({ enabled: false });
    updateUI(false);
  } else {
    chrome.storage.sync.get("activeSet", (data) => {
      chrome.storage.sync.set({ enabled: true });
      updateUI(true);
      setActiveUI(data.activeSet || null);
    });
  }
});

sets.forEach(set => {
  const setName = set.dataset.set;

  set.querySelector("button").addEventListener("click", () => {
    if (!toggle.checked) return;

    chrome.storage.sync.set({ activeSet: setName }, () => {
      setActiveUI(setName);
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
