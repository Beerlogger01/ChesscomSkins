
const PIECES = [
  "wk","wq","wr","wb","wn","wp",
  "bk","bq","br","bb","bn","bp"
];

const SET_DEFINITIONS = {
  "set2": {
    type: "image",
    path: "assets/Set2",
    ringColor: "rgba(255,110,60,0.9)"
  },
  "native-ember": {
    type: "filter",
    filter: "hue-rotate(-18deg) saturate(1.4) brightness(1.05)",
    ringColor: "rgba(255,100,40,0.9)"
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
    ringColor: "rgba(255,130,70,0.9)",
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
    ringColor: "rgba(255,255,255,0.65)",
    ringOpacity: 0.45,
    ringBorder: "1px",
    ringInset: "14%",
    ringAnimation: "ringSoft 1.6s ease-in-out infinite",
    ringGlow: "0 0 8px rgba(255,255,255,0.35)"
  }
};

let styleTag = null;

function applySet(setName) {
  if (styleTag) styleTag.remove();

  styleTag = document.createElement("style");
  const definition = SET_DEFINITIONS[setName];
  if (!definition) return;

  const ringInset = definition.ringInset || "8%";
  const ringBorder = definition.ringBorder || "2px";
  const ringOpacity = typeof definition.ringOpacity === "number" ? definition.ringOpacity : 1;
  const ringGlow = definition.ringGlow || "0 0 22px rgba(0,0,0,0.25)";
  const ringAnimation = definition.ringAnimation || "ringPulse 1.2s ease-in-out infinite";

  let css = `
    .piece,
    .promotion-piece {
      position: relative;
    }

    .piece::after,
    .promotion-piece::after {
      content: "";
      position: absolute;
      inset: ${ringInset};
      border-radius: 50%;
      opacity: 0;
      pointer-events: none;
      border: ${ringBorder} solid var(--ring-color, rgba(255,120,60,0.85));
      box-shadow:
        0 0 10px var(--ring-color, rgba(255,120,60,0.85)),
        ${ringGlow};
      animation: ${ringAnimation};
    }

    @keyframes ringPulse {
      0% {
        transform: scale(0.9);
        box-shadow: 0 0 6px var(--ring-color, rgba(255,120,60,0.85));
      }
      70% {
        transform: scale(1.08);
        box-shadow: 0 0 14px var(--ring-color, rgba(255,120,60,0.85));
      }
      100% {
        transform: scale(1);
        box-shadow: 0 0 10px var(--ring-color, rgba(255,120,60,0.85));
      }
    }

    @keyframes ringSoft {
      0% {
        transform: scale(0.98);
        box-shadow: 0 0 4px var(--ring-color, rgba(255,255,255,0.65));
      }
      100% {
        transform: scale(1.03);
        box-shadow: 0 0 8px var(--ring-color, rgba(255,255,255,0.65));
      }
    }
  `;

  if (definition.type === "image") {
    PIECES.forEach(piece => {
      const url = chrome.runtime.getURL(`${definition.path}/${piece}.png`);
      css += `
        .piece.${piece},
        .promotion-piece.${piece} {
          background-image: url("${url}") !important;
          background-size: contain !important;
          background-repeat: no-repeat !important;
          background-position: center !important;
          --ring-color: ${definition.ringColor};
          --ring-opacity: ${ringOpacity};
        }
      `;
    });
  }

  if (definition.type === "filter") {
    css += `
      .piece,
      .promotion-piece {
        filter: ${definition.filter} !important;
        --ring-color: ${definition.ringColor};
        --ring-opacity: ${ringOpacity};
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

  css += `
    .selected .piece::after,
    .selected .promotion-piece::after,
    .piece.selected::after,
    .promotion-piece.selected::after,
    .last-move .piece::after,
    .last-move .promotion-piece::after,
    .move .piece::after,
    .move .promotion-piece::after,
    .highlight .piece::after,
    .highlight .promotion-piece::after {
      opacity: var(--ring-opacity, 1);
    }
  `;

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

  if (changes.enabled && changes.enabled.newValue === true) {
    chrome.storage.sync.get("activeSet", (data) => {
      if (data.activeSet) {
        applySet(data.activeSet);
      }
    });
  }

  if (changes.activeSet && changes.activeSet.newValue) {
    chrome.storage.sync.get("enabled", (data) => {
      if (data.enabled) {
        applySet(changes.activeSet.newValue);
      }
    });
  }
});
