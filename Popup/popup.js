
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
    chrome.storage.sync.set({ enabled: false, activeSet: null });
    updateUI(false);
    setActiveUI(null);
  } else {
    chrome.storage.sync.set({ enabled: true, activeSet: null });
    updateUI(true);
    setActiveUI(null);
  }
});

sets.forEach(set => {
  set.querySelector("button").addEventListener("click", () => {
    if (!toggle.checked) return;

    chrome.storage.sync.set({ activeSet: set.id }, () => {
      setActiveUI(set.id);
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
    set.classList.toggle("active", activeID && set.id === activeID);
  });
}