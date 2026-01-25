
const PIECES = [
  "wk","wq","wr","wb","wn","wp",
  "bk","bq","br","bb","bn","bp"
];

let styleTag = null;

function applySet(setName) {
  if (styleTag) styleTag.remove();

  styleTag = document.createElement("style");
  let css = "";

  PIECES.forEach(piece => {
    const url = chrome.runtime.getURL(`assets/${setName}/${piece}.png`);
    css += `
      .piece.${piece},
      .promotion-piece.${piece} {
        background-image: url("${url}") !important;
        background-size: contain !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
      }
    `;
  });

  styleTag.textContent = css;
  document.head.appendChild(styleTag);
}

function disableSkins() {
  if (styleTag) {
    styleTag.remove();
    styleTag = null;
  }
}

chrome.storage.sync.get(["enabled", "activeSet"], (data) => {
  if (data.enabled && data.activeSet) {
    applySet(data.activeSet);
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled && changes.enabled.newValue === false) {
    disableSkins();
  }

  if (changes.activeSet && changes.activeSet.newValue) {
    chrome.storage.sync.get("enabled", (data) => {
      if (data.enabled) {
        applySet(changes.activeSet.newValue);
      }
    });
  }
});
