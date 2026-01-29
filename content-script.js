const DEBUG = true;
const LOG_PREFIX = "[ChesscomSkins]";

const MAX_ACTIVE_CRACKS = 4;
const activeCracks = [];

let overlaysEnabled = false;
let cracksEnabled = false;
let overlayRoot = null;
let overlayBoard = null;
let overlayOrientation = "white";
let lastBoardSnapshot = new Map();
let lastMoveSignature = "";
let lastKnownDestination = null;
let lastTriggerKey = "";
let boardObserver = null;
let moveListObserver = null;
let statusObserver = null;
let resizeBound = false;

function log(...args) {
  if (DEBUG) console.log(LOG_PREFIX, ...args);
}

function warn(...args) {
  if (DEBUG) console.warn(LOG_PREFIX, ...args);
}

function getBoardElement() {
  return document.querySelector(
    ".board, chess-board, .board-area, .board-container, .board-wrapper"
  );
}

function getBoardOrientation(board) {
  if (!board) return "white";
  const classList = board.className || "";
  if (classList.includes("flipped") || classList.includes("orientation-black")) {
    return "black";
  }
  const orientationAttr = board.getAttribute("data-orientation");
  if (orientationAttr === "black") return "black";
  return "white";
}

function ensureOverlay(board) {
  if (!board) return null;
  if (overlayRoot && overlayBoard === board) return overlayRoot;

  overlayBoard = board;
  overlayOrientation = getBoardOrientation(board);

  if (overlayRoot) overlayRoot.remove();

  const overlay = document.createElement("div");
  overlay.className = "chesscom-skins-overlay";
  const parent = board.parentElement || board;
  if (getComputedStyle(parent).position === "static") {
    parent.style.position = "relative";
  }
  parent.appendChild(overlay);
  overlayRoot = overlay;
  resizeOverlay();
  return overlayRoot;
}

function resizeOverlay() {
  if (!overlayRoot || !overlayBoard) return;
  const rect = overlayBoard.getBoundingClientRect();
  const parentRect = overlayRoot.parentElement.getBoundingClientRect();
  overlayRoot.style.width = `${rect.width}px`;
  overlayRoot.style.height = `${rect.height}px`;
  overlayRoot.style.left = `${rect.left - parentRect.left}px`;
  overlayRoot.style.top = `${rect.top - parentRect.top}px`;
}

function squareFromClass(classList) {
  if (!classList) return null;
  for (const cls of Array.from(classList)) {
    const match = cls.match(/square-([a-h])([1-8])/i);
    if (match) return `${match[1].toLowerCase()}${match[2]}`;
    const numeric = cls.match(/square-(\d)(\d)/);
    if (numeric) {
      const file = String.fromCharCode(96 + Number(numeric[1]));
      return `${file}${numeric[2]}`;
    }
  }
  return null;
}

function squareFromTransform(el, boardRect, orientation) {
  const transform = el.style.transform || "";
  const match = transform.match(/translate(?:3d)?\(([-\d.]+)px,\s*([-\d.]+)px/);
  if (!match) return null;
  const x = parseFloat(match[1]);
  const y = parseFloat(match[2]);
  const size = Math.min(boardRect.width, boardRect.height) / 8;
  if (!size) return null;
  const fileIndex = Math.floor(x / size);
  const rankIndex = Math.floor(y / size);
  if (fileIndex < 0 || fileIndex > 7 || rankIndex < 0 || rankIndex > 7) return null;
  let file;
  let rank;
  if (orientation === "white") {
    file = String.fromCharCode(97 + fileIndex);
    rank = 8 - rankIndex;
  } else {
    file = String.fromCharCode(97 + (7 - fileIndex));
    rank = rankIndex + 1;
  }
  return `${file}${rank}`;
}

function parseBoardState() {
  const board = getBoardElement();
  if (!board) return new Map();
  const rect = board.getBoundingClientRect();
  const orientation = getBoardOrientation(board);
  const pieces = new Map();
  const pieceNodes = board.querySelectorAll(".piece, [data-piece]");

  pieceNodes.forEach((piece) => {
    const dataPiece = piece.dataset?.piece;
    const pieceClass = Array.from(piece.classList).find((cls) => /[bw][kqrbnp]/.test(cls));
    const pieceCode = dataPiece || pieceClass;
    if (!pieceCode) return;

    let square = piece.dataset?.square || squareFromClass(piece.classList);
    if (!square && rect.width) {
      square = squareFromTransform(piece, rect, orientation);
    }
    if (!square) return;
    pieces.set(square, pieceCode);
  });

  return pieces;
}

function findLastMoveSquares() {
  const board = getBoardElement();
  if (!board) return [];
  const candidates = board.querySelectorAll(".last-move, [class*='last-move']");
  const squares = [];
  candidates.forEach((el) => {
    const square = el.dataset?.square || squareFromClass(el.classList);
    if (square) squares.push(square);
  });
  return squares;
}

function findMoveList() {
  return document.querySelector(
    ".vertical-move-list, .move-list, [data-cy='move-list'], [role='log']"
  );
}

function extractLatestSAN() {
  const moveList = findMoveList();
  if (!moveList) return "";
  const text = moveList.textContent || "";
  const tokens = text.trim().split(/\s+/);
  return tokens[tokens.length - 1] || "";
}

function parseSANForCapture(san) {
  return san.includes("x");
}

function parseSANForSquare(san) {
  const matches = san.match(/([a-h][1-8])/gi);
  if (!matches || matches.length === 0) return null;
  return matches[matches.length - 1].toLowerCase();
}

function detectMoveByDiff(prevMap, nextMap) {
  const fromSquares = [];
  const toSquares = [];
  const captures = [];

  prevMap.forEach((piece, square) => {
    if (!nextMap.has(square)) {
      fromSquares.push({ square, piece });
    }
  });

  nextMap.forEach((piece, square) => {
    if (!prevMap.has(square)) {
      toSquares.push({ square, piece });
    } else if (prevMap.get(square) !== piece) {
      toSquares.push({ square, piece });
      captures.push(square);
    }
  });

  if (fromSquares.length === 1 && toSquares.length === 1) {
    return {
      from: fromSquares[0].square,
      to: toSquares[0].square,
      capture: captures.length > 0
    };
  }

  if (fromSquares.length === 2 && toSquares.length === 2) {
    const kingMove = toSquares.find((item) => item.piece.endsWith("k"));
    if (kingMove) {
      return {
        from: fromSquares.find((item) => item.piece.endsWith("k"))?.square || fromSquares[0].square,
        to: kingMove.square,
        capture: false
      };
    }
  }

  if (fromSquares.length === 1 && toSquares.length === 1) {
    const movedPiece = toSquares[0].piece;
    if (movedPiece.endsWith("p")) {
      const fromFile = fromSquares[0].square[0];
      const toFile = toSquares[0].square[0];
      return {
        from: fromSquares[0].square,
        to: toSquares[0].square,
        capture: fromFile !== toFile
      };
    }
  }

  return null;
}

function squareToPosition(square, board, orientation) {
  if (!square || !board) return null;
  const rect = board.getBoundingClientRect();
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1], 10) - 1;
  const size = Math.min(rect.width, rect.height) / 8;
  if (!size) return null;

  let fileIndex = file;
  let rankIndex = rank;
  if (orientation === "white") {
    rankIndex = 7 - rank;
  } else {
    fileIndex = 7 - file;
  }

  const x = fileIndex * size;
  const y = rankIndex * size;
  return { x, y, size };
}

function spawnCrackEffect(square, isCapture, fallbackCenter = false) {
  if (!overlayRoot || !overlayBoard) return;
  resizeOverlay();
  const orientation = overlayOrientation;
  let position = null;

  if (square && !fallbackCenter) {
    position = squareToPosition(square, overlayBoard, orientation);
  }

  if (!position) {
    const rect = overlayBoard.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height) / 8;
    position = { x: rect.width / 2 - size / 2, y: rect.height / 2 - size / 2, size };
  }

  const slot = document.createElement("div");
  slot.className = "chesscom-crack-slot";
  slot.style.left = `${position.x}px`;
  slot.style.top = `${position.y}px`;
  slot.style.width = `${position.size}px`;
  slot.style.height = `${position.size}px`;
  slot.style.borderRadius = `${Math.max(position.size * 0.08, 4)}px`;

  const crack = document.createElement("div");
  crack.className = "chesscom-crack";
  if (isCapture) crack.classList.add("capture");
  slot.appendChild(crack);
  overlayRoot.appendChild(slot);

  activeCracks.push(slot);
  if (activeCracks.length > MAX_ACTIVE_CRACKS) {
    const oldest = activeCracks.shift();
    if (oldest) oldest.remove();
  }

  crack.addEventListener("animationend", () => {
    slot.remove();
    const index = activeCracks.indexOf(slot);
    if (index !== -1) activeCracks.splice(index, 1);
  });

  log("Crack spawn", { square, capture: isCapture });
}

function handleMoveEvent(reason) {
  if (!cracksEnabled) return;
  const board = getBoardElement();
  if (!board) return;
  ensureOverlay(board);
  if (!overlayRoot) {
    warn("Overlay missing; cannot spawn cracks");
    return;
  }

  const san = extractLatestSAN();
  const lastMoveSquares = findLastMoveSquares();
  let destination = lastMoveSquares[lastMoveSquares.length - 1] || null;
  const captureFromSan = san ? parseSANForCapture(san) : false;
  const destFromSan = san ? parseSANForSquare(san) : null;

  if (!destination && destFromSan) {
    destination = destFromSan;
  }

  const nextSnapshot = parseBoardState();
  const diff = detectMoveByDiff(lastBoardSnapshot, nextSnapshot);
  lastBoardSnapshot = nextSnapshot;

  let capture = captureFromSan;
  if (diff) {
    destination = diff.to || destination;
    capture = diff.capture || capture;
    lastKnownDestination = destination;
  }

  if (!destination && lastKnownDestination) {
    destination = lastKnownDestination;
  }

  const triggerKey = `${destination || "center"}-${capture}-${san || ""}-${lastMoveSquares.join(",")}`;
  if (triggerKey === lastTriggerKey) return;
  lastTriggerKey = triggerKey;

  log("Move event", reason, { destination, capture, san, lastMoveSquares });
  spawnCrackEffect(destination, capture, !destination);
}

function updateMoveSignature() {
  const moveList = findMoveList();
  const signature = moveList ? moveList.textContent?.trim() : "";
  if (signature && signature !== lastMoveSignature) {
    lastMoveSignature = signature;
    handleMoveEvent("move-list");
  }
}

function observeBoard() {
  const board = getBoardElement();
  if (!board) return;
  if (boardObserver && overlayBoard === board) return;
  if (boardObserver) boardObserver.disconnect();

  boardObserver = new MutationObserver(() => {
    handleMoveEvent("board-highlight");
  });
  boardObserver.observe(board, { subtree: true, attributes: true, childList: true });
  overlayBoard = board;
}

function observeMoveList() {
  const moveList = findMoveList();
  if (!moveList) return;
  if (moveListObserver) moveListObserver.disconnect();

  moveListObserver = new MutationObserver(() => {
    updateMoveSignature();
  });
  moveListObserver.observe(moveList, { childList: true, subtree: true, characterData: true });
}

function detectEndState(text) {
  const lowered = text.toLowerCase();
  const patterns = [
    { key: "win", regex: /(you won|victory|checkmate)/ },
    { key: "lose", regex: /(you lost|defeat|resigned|time|timeout)/ },
    { key: "draw", regex: /(draw|stalemate)/ }
  ];
  for (const pattern of patterns) {
    if (pattern.regex.test(lowered)) return pattern.key;
  }
  return null;
}

function showEndScreen(type, message) {
  if (!overlayRoot || !overlayBoard) return;
  const endScreen = document.createElement("div");
  endScreen.className = `chesscom-end-screen ${type}`;
  endScreen.textContent = message;
  overlayRoot.appendChild(endScreen);

  endScreen.addEventListener("animationend", () => {
    endScreen.remove();
  });
}

function observeStatus() {
  if (statusObserver) statusObserver.disconnect();
  statusObserver = new MutationObserver((mutations) => {
    const text = mutations.map((m) => m.target.textContent || "").join(" ");
    const type = detectEndState(text);
    if (!type) return;
    const board = getBoardElement();
    if (!board) return;
    ensureOverlay(board);
    showEndScreen(type, text.trim());
  });
  statusObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function initObservers() {
  observeBoard();
  observeMoveList();
  observeStatus();
  if (!resizeBound) {
    window.addEventListener("resize", resizeOverlay);
    resizeBound = true;
  }
}

function bootstrap() {
  const board = getBoardElement();
  if (board) {
    ensureOverlay(board);
    overlayOrientation = getBoardOrientation(board);
    lastBoardSnapshot = parseBoardState();
  }
  initObservers();
}

function stopObservers() {
  if (boardObserver) {
    boardObserver.disconnect();
    boardObserver = null;
  }
  if (moveListObserver) {
    moveListObserver.disconnect();
    moveListObserver = null;
  }
  if (statusObserver) {
    statusObserver.disconnect();
    statusObserver = null;
  }
  if (overlayRoot) {
    overlayRoot.remove();
    overlayRoot = null;
    overlayBoard = null;
  }
}

chrome.storage.sync.get(["enabled", "cracksEnabled"], (data) => {
  overlaysEnabled = !!data.enabled;
  cracksEnabled = !!data.cracksEnabled;
  if (overlaysEnabled) bootstrap();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    overlaysEnabled = !!changes.enabled.newValue;
    if (overlaysEnabled) {
      bootstrap();
    } else {
      stopObservers();
    }
  }
  if (changes.cracksEnabled) {
    cracksEnabled = !!changes.cracksEnabled.newValue;
    if (cracksEnabled && overlaysEnabled && !boardObserver) {
      bootstrap();
    }
  }
});

const readyObserver = new MutationObserver(() => {
  const board = getBoardElement();
  if (board && overlaysEnabled && overlayBoard !== board) {
    bootstrap();
  }
});
readyObserver.observe(document.body, { childList: true, subtree: true });
