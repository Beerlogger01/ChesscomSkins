const PIECES = [
  "wk","wq","wr","wb","wn","wp",
  "bk","bq","br","bb","bn","bp"
];

const SKIN_DEFINITIONS = {
  "set2": {
    type: "image",
    path: "assets/Set2"
  },
  "none": {
    type: "none"
  }
};

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
let crackStyleTag = null;
let cracksEnabled = false;
let crackObserver = null;
const crackTimers = new Map();
const CRACK_DURATION_MS = 3200;

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
  capturedObserver = new MutationObserver(() => updateCapturedImages());
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
  const glowTargetSelector = glowTargets.join(", ");
  const glowTargetSelected = glowTargets.map((target) => `.selected ${target}`).join(", ");
  const glowTargetSelectedSelf = glowTargets.map((target) => `${target}.selected`).join(", ");
  const glowTargetLastMove = glowTargets.map((target) => `.last-move ${target}`).join(", ");
  const glowTargetMove = glowTargets.map((target) => `.move ${target}`).join(", ");
  const glowTargetHint = glowTargets.map((target) => `.hint ${target}`).join(", ");
  const glowTargetHighlight = glowTargets.map((target) => `.highlight ${target}`).join(", ");
  const glowTargetCheck = glowTargets.map((target) => `.check ${target}`).join(", ");
  const glowTargetCheckmate = glowTargets.map((target) => `.checkmate ${target}`).join(", ");
  const glowTargetMate = glowTargets.map((target) => `.mate ${target}`).join(", ");
  const glowTargetCapture = glowTargets.map((target) => `.capture ${target}`).join(", ");

  let css = `
    .piece,
    .promotion-piece {
      position: relative;
      will-change: transform, filter;
      filter: var(--piece-filter, none);
    }

    ${glowTargetSelector} {
      filter: var(--piece-filter, none);
      transition: filter 0.2s ease;
      animation: glowPulse 3s ease-in-out infinite;
    }

    .captured .piece,
    .captured-piece,
    .captured-pieces .piece,
    [class*="captured"] .piece {
      animation: none !important;
      filter: var(--piece-filter, none) !important;
    }

    @keyframes glowPulse {
      0% {
        filter: var(--piece-filter, none) drop-shadow(0 0 4px var(--ring-color, rgba(255,120,60,0.85)));
      }
      70% {
        filter: var(--piece-filter, none)
          drop-shadow(0 0 10px var(--ring-color, rgba(255,120,60,0.85)))
          drop-shadow(0 0 18px var(--ring-color, rgba(255,120,60,0.6)));
      }
      100% {
        filter: var(--piece-filter, none) drop-shadow(0 0 6px var(--ring-color, rgba(255,120,60,0.85)));
      }
    }

    @keyframes glowShimmer {
      0% {
        filter: var(--piece-filter, none) drop-shadow(0 0 5px var(--ring-color, rgba(255,120,60,0.75)));
      }
      50% {
        filter: var(--piece-filter, none)
          drop-shadow(0 0 12px var(--ring-color, rgba(255,120,60,0.95)))
          drop-shadow(0 0 22px var(--ring-color, rgba(255,120,60,0.7)));
      }
      100% {
        filter: var(--piece-filter, none) drop-shadow(0 0 6px var(--ring-color, rgba(255,120,60,0.8)));
      }
    }

    @keyframes ringPulse {
      0% {
        filter: var(--piece-filter, none) drop-shadow(0 0 4px var(--ring-color, rgba(255,120,60,0.8)));
      }
      70% {
        filter: var(--piece-filter, none)
          drop-shadow(0 0 10px var(--ring-color, rgba(255,120,60,0.9)))
          drop-shadow(0 0 16px var(--ring-color, rgba(255,120,60,0.6)));
      }
      100% {
        filter: var(--piece-filter, none) drop-shadow(0 0 6px var(--ring-color, rgba(255,120,60,0.8)));
      }
    }

    @keyframes ringSoft {
      0% {
        filter: var(--piece-filter, none) drop-shadow(0 0 3px var(--ring-color, rgba(255,255,255,0.7)));
      }
      100% {
        filter: var(--piece-filter, none) drop-shadow(0 0 7px var(--ring-color, rgba(255,255,255,0.85)));
      }
    }

    @keyframes fireworks {
      0% {
        transform: scale(0.96);
        filter: var(--piece-filter, none) drop-shadow(0 0 6px rgba(255,210,80,0.7));
      }
      40% {
        transform: scale(1.08);
        filter: var(--piece-filter, none)
          drop-shadow(0 0 14px rgba(255,210,80,0.95))
          drop-shadow(0 0 24px rgba(255,120,80,0.8));
      }
      100% {
        transform: scale(1.02);
        filter: var(--piece-filter, none) drop-shadow(0 0 8px rgba(255,210,80,0.8));
      }
    }

    @keyframes checkPulse {
      0% {
        transform: scale(0.98);
        filter: var(--piece-filter, none) drop-shadow(0 0 6px rgba(255,70,70,0.8));
      }
      50% {
        transform: scale(1.08);
        filter: var(--piece-filter, none)
          drop-shadow(0 0 14px rgba(255,70,70,0.95))
          drop-shadow(0 0 22px rgba(255,70,70,0.7));
      }
      100% {
        transform: scale(1);
        filter: var(--piece-filter, none) drop-shadow(0 0 8px rgba(255,70,70,0.85));
      }
    }

    @keyframes mateFlare {
      0% {
        transform: scale(0.92) rotate(0deg);
        filter: var(--piece-filter, none) drop-shadow(0 0 8px rgba(255,200,60,0.9));
      }
      50% {
        transform: scale(1.15) rotate(6deg);
        filter: var(--piece-filter, none)
          drop-shadow(0 0 20px rgba(255,200,60,1))
          drop-shadow(0 0 28px rgba(255,140,80,0.85));
      }
      100% {
        transform: scale(1) rotate(0deg);
        filter: var(--piece-filter, none) drop-shadow(0 0 12px rgba(255,200,60,0.9));
      }
    }

    @keyframes captureBurst {
      0% {
        transform: scale(0.6);
        opacity: 0;
        filter: var(--piece-filter, none) drop-shadow(0 0 0 rgba(255,120,60,0.7));
      }
      40% {
        transform: scale(1.05);
        opacity: 1;
        filter: var(--piece-filter, none) drop-shadow(0 0 16px rgba(255,120,60,0.85));
      }
      100% {
        transform: scale(1.2);
        opacity: 0;
        filter: var(--piece-filter, none) drop-shadow(0 0 28px rgba(255,120,60,0));
      }
    }

    @keyframes queenCapture {
      0% {
        transform: scale(1);
        filter: var(--piece-filter, none) drop-shadow(0 0 4px rgba(255,190,90,0.7));
      }
      50% {
        transform: scale(1.08);
        filter: var(--piece-filter, none) drop-shadow(0 0 12px rgba(255,190,90,1));
      }
      100% {
        transform: scale(1);
        filter: var(--piece-filter, none) drop-shadow(0 0 6px rgba(255,190,90,0.8));
      }
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

  css += `
    ${glowTargetSelected},
    ${glowTargetSelectedSelf},
    ${glowTargetLastMove},
    ${glowTargetMove},
    ${glowTargetHint},
    ${glowTargetHighlight} {
      animation: ${ringAnimation}, glowShimmer 3.2s ease-in-out infinite;
    }

    ${glowTargetCheck} {
      animation: checkPulse 1s ease-in-out infinite, glowShimmer 2.4s ease-in-out infinite;
      --ring-color: rgba(255,70,70,0.9);
    }

    ${glowTargetCheckmate},
    ${glowTargetMate} {
      animation: mateFlare 1.4s ease-in-out infinite, fireworks 1.2s ease-out infinite;
      --ring-color: rgba(255,200,60,0.95);
    }

    ${glowTargetCapture} {
      animation: captureBurst 0.9s ease-out;
    }

    .captured-pieces .piece.wq,
    .captured-pieces .piece.bq {
      animation: queenCapture 1.4s ease-in-out 1;
    }
  `;

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

function applyCracks(enabled) {
  cracksEnabled = enabled;
  if (!enabled) {
    removeCrackStyles();
    removeCrackObservers();
    clearCrackTimers();
    return;
  }
  ensureCrackStyles();
  ensureCrackObserver();
  applyCracksToLastMove();
}

function ensureCrackStyles() {
  if (crackStyleTag) return;
  const crackSvg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <path d="M12 40 L35 32 L48 46 L62 38 L76 52 L95 44" stroke="rgba(40,25,15,0.75)" stroke-width="2.4" fill="none"/>
      <path d="M20 78 L38 70 L52 82 L70 74 L88 90" stroke="rgba(50,30,18,0.7)" stroke-width="2.2" fill="none"/>
      <path d="M58 18 L62 34 L54 46 L64 64 L58 82" stroke="rgba(35,20,12,0.6)" stroke-width="2" fill="none"/>
      <path d="M90 18 L76 32 L80 46 L70 58 L78 76" stroke="rgba(35,20,12,0.55)" stroke-width="1.8" fill="none"/>
    </svg>`
  );
  crackStyleTag = document.createElement("style");
  crackStyleTag.textContent = `
    .cracked-square {
      position: relative;
      overflow: hidden;
    }

    .cracked-square::after {
      content: "";
      position: absolute;
      inset: 4%;
      pointer-events: none;
      background-image:
        url("data:image/svg+xml,${crackSvg}"),
        radial-gradient(circle at 30% 35%, rgba(70,45,25,0.35) 0%, transparent 55%),
        radial-gradient(circle at 70% 70%, rgba(60,35,20,0.3) 0%, transparent 55%);
      background-size: 100% 100%;
      background-repeat: no-repeat;
      mix-blend-mode: multiply;
      opacity: 0;
      transform: scale(0.9);
      animation: crackFade 3.2s ease-out forwards;
    }

    @keyframes crackFade {
      0% { opacity: 0; transform: scale(0.9); }
      15% { opacity: 1; transform: scale(1); }
      65% { opacity: 0.75; }
      100% { opacity: 0; transform: scale(1.04); }
    }
  `;
  document.head.appendChild(crackStyleTag);
}

function removeCrackStyles() {
  if (crackStyleTag) crackStyleTag.remove();
  crackStyleTag = null;
}

function ensureCrackObserver() {
  if (crackObserver) return;
  crackObserver = new MutationObserver(() => applyCracksToLastMove());
  crackObserver.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });
}

function removeCrackObservers() {
  if (crackObserver) {
    crackObserver.disconnect();
    crackObserver = null;
  }
}

function applyCracksToLastMove() {
  if (!cracksEnabled) return;
  const squares = document.querySelectorAll(".last-move");
  squares.forEach((square) => {
    if (square.classList.contains("cracked-square")) return;
    square.classList.add("cracked-square");
    const timer = setTimeout(() => {
      square.classList.remove("cracked-square");
      crackTimers.delete(square);
    }, CRACK_DURATION_MS);
    crackTimers.set(square, timer);
  });
}

function clearCrackTimers() {
  crackTimers.forEach((timerId) => clearTimeout(timerId));
  crackTimers.clear();
  document.querySelectorAll(".cracked-square").forEach((square) => {
    square.classList.remove("cracked-square");
  });
}

chrome.storage.sync.get(
  ["enabled", "activeSkin", "activeEffect", "activeTarget", "activeSkinPath", "activeSet", "cracksEnabled"],
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
  applyCracks(!!data.cracksEnabled);
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled && changes.enabled.newValue === false) {
    skinsEnabled = false;
    disableSkins();
    applyCracks(false);
  }

  if (changes.enabled && changes.enabled.newValue === true) {
    skinsEnabled = true;
    chrome.storage.sync.get(
      ["activeSkin", "activeEffect", "activeTarget", "activeSkinPath", "cracksEnabled"],
      (data) => {
      applySkin(data.activeSkin || "set2", data.activeSkinPath || null);
      applyEffect(data.activeEffect || "native-ember", data.activeTarget || "all");
      applyCracks(!!data.cracksEnabled);
    });
  }

  if (changes.activeSkin && changes.activeSkin.newValue) {
    chrome.storage.sync.get("enabled", (data) => {
      if (data.enabled) {
        chrome.storage.sync.get("activeSkinPath", (stored) => {
          applySkin(changes.activeSkin.newValue, stored.activeSkinPath || null);
        });
      }
    });
  }

  if (changes.activeEffect && changes.activeEffect.newValue) {
    chrome.storage.sync.get("enabled", (data) => {
      if (data.enabled) {
        chrome.storage.sync.get("activeTarget", (stored) => {
          applyEffect(changes.activeEffect.newValue, stored.activeTarget || "all");
        });
      }
    });
  }

  if (changes.activeSkinPath && changes.activeSkinPath.newValue) {
    chrome.storage.sync.get(["enabled", "activeSkin"], (data) => {
      if (data.enabled) {
        applySkin(data.activeSkin || "set2", changes.activeSkinPath.newValue || null);
      }
    });
  }

  if (changes.activeTarget && changes.activeTarget.newValue) {
    chrome.storage.sync.get("enabled", (data) => {
      if (data.enabled) {
        chrome.storage.sync.get("activeEffect", (stored) => {
          applyEffect(stored.activeEffect || "native-ember", changes.activeTarget.newValue);
        });
      }
    });
  }

  if (changes.cracksEnabled) {
    chrome.storage.sync.get("enabled", (data) => {
      if (data.enabled) {
        applyCracks(!!changes.cracksEnabled.newValue);
      } else {
        applyCracks(false);
      }
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", watchForGameStart);
} else {
  watchForGameStart();
}
