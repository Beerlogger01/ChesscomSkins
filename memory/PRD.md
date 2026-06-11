# PRD — Chess.com Custom Skins (Chrome Extension)

## Original Problem Statement
"смотри в гитхабе это расширение для браузера chrome которое должно менять скины. но есть несколько ограничений с которыми я столкнулся. если слишком много свечения то ноутбук банально не вывозит. сделай из расширения конфетку. прочитай обязательно все файлы и особенно readme."

User choices: both performance AND beautiful UI; performance modes (Low/Med/High) + auto hardware detection + lighter effects; features at agent's discretion; full carte blanche.

## Product
Chrome MV3 extension that themes chess.com: custom piece skins, board themes, glow effects, move particles/cracks, tournament mode. NO backend, NO React — vanilla HTML/CSS/JS.

## User Personas
- Chess.com player on a weak laptop who wants visual personalization without FPS drops.

## Architecture
- `manifest.json` — MV3, single content script `content.js`, storage permission, icons in `icons/`.
- `content.js` — unified effects engine (skins via CSS background-image, glow via quality-aware drop-shadow, board themes, canvas FX engine, FPS guard, tournament mode).
- `Popup/` — dark "Command Center" popup (Outfit + JetBrains Mono, cyan accent), vanilla JS with localStorage shim for standalone preview at `Popup/popup.html`.
- `assets/` — skins (Set2) + config.json (board styles) + skins.json.

## Implemented (June 2026 — v3.0 rewrite)
- Performance modes: Auto / Low / Medium / High (QUALITY presets cap glow px, particle counts, crack counts, canvas DPR).
- Auto-detect: navigator.deviceMemory + hardwareConcurrency; FPS probe (3s) auto-downgrades in Auto mode if <40fps.
- Perf fixes: `.piece.dragging` glow removal; square-XY class-based move detection (zero getBoundingClientRect in MutationObserver); rAF-batched observer; particle pooling/caps; tab-hidden pause; DPR-capped canvas; removed piece transform transitions (conflicted with chess.com drag).
- Merged content-script.js into content.js; deleted dead files (style.css, styles.css, extension.zip, stale docs).
- Tournament mode actually implemented (random session skin per page load).
- New popup UI (bento dark theme) with all controls + toasts + data-testids; live glow intensity via rAF-throttled message.
- Generated extension icons (16/48/128, cyan knight).
- Rewrote README.md + QUICK_START.md.
- Testing: iteration_1 — 35/35 popup UI assertions passed, content.js/manifest static review clean.

## Backlog
- P1: Real ZIP skin import (JSZip + chrome.storage.local data URLs) — currently informational toast.
- P2: Skin export; custom board color picker; per-game tournament re-roll via game-start detection (currently per page load); options page for Chrome Web Store readiness.
- P2: More bundled skins.

## Notes
- User asked to commit & push to main → user must use the platform "Save to GitHub" feature (agent cannot push).
- Popup preview/testing: `cd /app && python3 -m http.server 8888` → http://localhost:8888/Popup/popup.html (chrome APIs shimmed).
