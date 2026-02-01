// ============================================
// ChesscomSkins - Content Script (Animations)
// Трещины и частицы для ходов
// ============================================

let cracksEnabled = false;
let particlesEnabled = false;
let boardElement = null;
let animationCanvas = null;
let animationCtx = null;
let particles = [];
let cracks = [];
let animationFrame = null;

// ============================================
// Поиск доски
// ============================================

function findBoard() {
  // Ищем разные варианты контейнера доски
  const selectors = [
    "wc-chess-board",
    ".board",
    "[class*='board-layout']",
    "chess-board"
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
  }
  return null;
}

// ============================================
// Создание canvas для эффектов
// ============================================

function createCanvas() {
  if (animationCanvas) return animationCanvas;
  
  boardElement = findBoard();
  if (!boardElement) {
    console.log("[ChesscomSkins:Animations] Board not found");
    return null;
  }
  
  // Получаем размеры доски
  const rect = boardElement.getBoundingClientRect();
  
  animationCanvas = document.createElement("canvas");
  animationCanvas.id = "chesscom-skins-animation-canvas";
  animationCanvas.width = rect.width;
  animationCanvas.height = rect.height;
  animationCanvas.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1000;
  `;
  
  // Добавляем относительное позиционирование родителю если нет
  const computedStyle = window.getComputedStyle(boardElement);
  if (computedStyle.position === "static") {
    boardElement.style.position = "relative";
  }
  
  boardElement.appendChild(animationCanvas);
  animationCtx = animationCanvas.getContext("2d");
  
  console.log("[ChesscomSkins:Animations] Canvas created:", rect.width, "x", rect.height);
  
  return animationCanvas;
}

// ============================================
// Класс частицы
// ============================================

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = (Math.random() - 0.5) * 8;
    this.vy = (Math.random() - 0.5) * 8;
    this.life = 1.0;
    this.decay = 0.02 + Math.random() * 0.02;
    this.size = 2 + Math.random() * 4;
  }
  
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.15; // гравитация
    this.vx *= 0.98; // трение
    this.life -= this.decay;
    this.size *= 0.97;
  }
  
  draw(ctx) {
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  isDead() {
    return this.life <= 0 || this.size < 0.5;
  }
}

// ============================================
// Класс трещины
// ============================================

class Crack {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.segments = [];
    this.life = 1.0;
    this.decay = 0.008;
    
    // Генерируем сегменты трещины
    this.generateSegments();
  }
  
  generateSegments() {
    const numBranches = 3 + Math.floor(Math.random() * 3);
    
    for (let b = 0; b < numBranches; b++) {
      const angle = (Math.PI * 2 / numBranches) * b + (Math.random() - 0.5) * 0.5;
      const length = 30 + Math.random() * 40;
      const segments = [];
      
      let cx = this.x;
      let cy = this.y;
      let currentAngle = angle;
      
      const numSegs = 3 + Math.floor(Math.random() * 3);
      for (let s = 0; s < numSegs; s++) {
        const segLen = length / numSegs;
        const nx = cx + Math.cos(currentAngle) * segLen;
        const ny = cy + Math.sin(currentAngle) * segLen;
        segments.push({ x1: cx, y1: cy, x2: nx, y2: ny });
        cx = nx;
        cy = ny;
        currentAngle += (Math.random() - 0.5) * 0.8;
      }
      
      this.segments.push(segments);
    }
  }
  
  update() {
    this.life -= this.decay;
  }
  
  draw(ctx) {
    ctx.globalAlpha = this.life;
    ctx.strokeStyle = "rgba(50, 50, 50, 0.8)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    
    this.segments.forEach(branch => {
      ctx.beginPath();
      branch.forEach((seg, i) => {
        if (i === 0) {
          ctx.moveTo(seg.x1, seg.y1);
        }
        ctx.lineTo(seg.x2, seg.y2);
      });
      ctx.stroke();
    });
    
    // Внутренняя светлая линия
    ctx.strokeStyle = "rgba(200, 200, 200, 0.5)";
    ctx.lineWidth = 1;
    
    this.segments.forEach(branch => {
      ctx.beginPath();
      branch.forEach((seg, i) => {
        if (i === 0) {
          ctx.moveTo(seg.x1, seg.y1);
        }
        ctx.lineTo(seg.x2, seg.y2);
      });
      ctx.stroke();
    });
  }
  
  isDead() {
    return this.life <= 0;
  }
}

// ============================================
// Создание эффекта в точке
// ============================================

function createEffectAt(x, y) {
  if (!animationCanvas) {
    if (!createCanvas()) return;
  }
  
  const colors = ["#ff6b35", "#ff9f1c", "#ffbe0b", "#ffffff"];
  
  // Создаём частицы
  if (particlesEnabled) {
    for (let i = 0; i < 15; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      particles.push(new Particle(x, y, color));
    }
  }
  
  // Создаём трещину
  if (cracksEnabled) {
    cracks.push(new Crack(x, y));
  }
  
  // Запускаем анимацию если не запущена
  if (!animationFrame) {
    animate();
  }
}

// ============================================
// Анимационный цикл
// ============================================

function animate() {
  if (!animationCtx || !animationCanvas) {
    animationFrame = null;
    return;
  }
  
  animationCtx.clearRect(0, 0, animationCanvas.width, animationCanvas.height);
  
  // Обновляем и рисуем частицы
  particles = particles.filter(p => {
    p.update();
    if (!p.isDead()) {
      p.draw(animationCtx);
      return true;
    }
    return false;
  });
  
  // Обновляем и рисуем трещины
  cracks = cracks.filter(c => {
    c.update();
    if (!c.isDead()) {
      c.draw(animationCtx);
      return true;
    }
    return false;
  });
  
  // Сбрасываем альфу
  animationCtx.globalAlpha = 1.0;
  
  // Продолжаем анимацию если есть что анимировать
  if (particles.length > 0 || cracks.length > 0) {
    animationFrame = requestAnimationFrame(animate);
  } else {
    animationFrame = null;
  }
}

// ============================================
// Отслеживание ходов
// ============================================

let moveObserver = null;
let lastMoveSquare = null;
let lastPiecePositions = new Map();

function startMoveObserver() {
  if (moveObserver) return;
  
  const board = findBoard();
  if (!board) {
    console.log("[ChesscomSkins:Animations] Cannot start observer - no board");
    // Попробуем позже
    setTimeout(startMoveObserver, 2000);
    return;
  }
  
  // Сохраняем начальные позиции фигур
  updatePiecePositions(board);
  
  moveObserver = new MutationObserver((mutations) => {
    let shouldCheckPieces = false;
    
    for (const mutation of mutations) {
      // Проверяем изменения атрибутов (например, style или class)
      if (mutation.type === "attributes") {
        const target = mutation.target;
        
        // Если это фигура и изменился её стиль (позиция)
        if (target.classList && target.classList.contains("piece")) {
          shouldCheckPieces = true;
        }
        
        // Подсветка хода (highlight)
        if (target.classList && (
          target.classList.contains("highlight") ||
          target.classList.contains("hint") ||
          target.classList.contains("last-move")
        )) {
          triggerEffectOnElement(target, board);
        }
      }
      
      // Проверяем добавление новых элементов
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element
            // Подсветка
            if (node.classList && (
              node.classList.contains("highlight") ||
              node.classList.contains("last-move")
            )) {
              triggerEffectOnElement(node, board);
            }
            
            // Новая фигура = ход
            if (node.classList && node.classList.contains("piece")) {
              shouldCheckPieces = true;
            }
          }
        });
      }
    }
    
    // Проверяем изменились ли позиции фигур
    if (shouldCheckPieces) {
      checkForMoves(board);
    }
  });
  
  moveObserver.observe(board, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "transform"]
  });
  
  console.log("[ChesscomSkins:Animations] Move observer started on", board.tagName);
}

function updatePiecePositions(board) {
  const pieces = board.querySelectorAll(".piece");
  lastPiecePositions.clear();
  
  pieces.forEach((piece, index) => {
    const rect = piece.getBoundingClientRect();
    lastPiecePositions.set(index, { x: rect.left, y: rect.top });
  });
}

function checkForMoves(board) {
  const pieces = board.querySelectorAll(".piece");
  const boardRect = board.getBoundingClientRect();
  
  pieces.forEach((piece, index) => {
    const rect = piece.getBoundingClientRect();
    const lastPos = lastPiecePositions.get(index);
    
    if (lastPos) {
      const dx = Math.abs(rect.left - lastPos.x);
      const dy = Math.abs(rect.top - lastPos.y);
      
      // Если фигура переместилась более чем на 20px - это ход
      if (dx > 20 || dy > 20) {
        const x = rect.left - boardRect.left + rect.width / 2;
        const y = rect.top - boardRect.top + rect.height / 2;
        
        console.log("[ChesscomSkins:Animations] Move detected at", x, y);
        createEffectAt(x, y);
      }
    }
    
    // Обновляем позицию
    lastPiecePositions.set(index, { x: rect.left, y: rect.top });
  });
}

function triggerEffectOnElement(element, board) {
  const rect = element.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();
  
  const x = rect.left - boardRect.left + rect.width / 2;
  const y = rect.top - boardRect.top + rect.height / 2;
  
  // Проверяем что это новая позиция
  const squareKey = `${Math.round(x)}-${Math.round(y)}`;
  if (squareKey !== lastMoveSquare) {
    lastMoveSquare = squareKey;
    console.log("[ChesscomSkins:Animations] Effect triggered at", x, y);
    createEffectAt(x, y);
  }
}

function stopMoveObserver() {
  if (moveObserver) {
    moveObserver.disconnect();
    moveObserver = null;
    console.log("[ChesscomSkins:Animations] Move observer stopped");
  }
}

// ============================================
// Очистка
// ============================================

function cleanup() {
  stopMoveObserver();
  
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
  
  if (animationCanvas) {
    animationCanvas.remove();
    animationCanvas = null;
    animationCtx = null;
  }
  
  particles = [];
  cracks = [];
}

// ============================================
// Включение/выключение эффектов
// ============================================

function updateEffectsState() {
  if (cracksEnabled || particlesEnabled) {
    createCanvas();
    startMoveObserver();
  } else {
    cleanup();
  }
}

// ============================================
// Инициализация
// ============================================

function initialize() {
  chrome.storage.sync.get(["cracksEnabled", "particlesEnabled", "enabled"], (data) => {
    console.log("[ChesscomSkins:Animations] Storage:", data);
    
    // Проверяем общее включение
    if (!data.enabled) {
      cleanup();
      return;
    }
    
    cracksEnabled = !!data.cracksEnabled;
    particlesEnabled = !!data.particlesEnabled;
    
    updateEffectsState();
  });
}

// ============================================
// Слушатель storage
// ============================================

chrome.storage.onChanged.addListener((changes) => {
  console.log("[ChesscomSkins:Animations] Storage changed:", changes);
  
  if (changes.enabled) {
    if (!changes.enabled.newValue) {
      cleanup();
      cracksEnabled = false;
      particlesEnabled = false;
      return;
    }
  }
  
  if (changes.cracksEnabled !== undefined) {
    cracksEnabled = !!changes.cracksEnabled.newValue;
  }
  
  if (changes.particlesEnabled !== undefined) {
    particlesEnabled = !!changes.particlesEnabled.newValue;
  }
  
  updateEffectsState();
});

// ============================================
// Запуск
// ============================================

// Ждём загрузки страницы
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(initialize, 1000); // Даём chess.com время создать доску
  });
} else {
  setTimeout(initialize, 1000);
}

console.log("[ChesscomSkins:Animations] Script loaded");
