/**
 * 고전 테트리스 게임
 * - 7가지 테트로미노 (I, O, T, S, Z, J, L)
 * - 라인 클리어 시 위 블록들이 아래로 낙하
 * - 라인 클리어 시 화면 임팩트 효과
 * - 고전 8비트 스타일 BGM
 */

// ============ 게임 상수 ============
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = 30;
const COLORS = {
  I: '#00f0f0',  // 시안
  O: '#f0f000',  // 노랑
  T: '#a000f0',  // 보라
  S: '#00f000',  // 초록
  Z: '#f00000',  // 빨강
  J: '#0000f0',  // 파랑
  L: '#f0a000',  // 주황
};

// 테트로미노 모양 정의 (4x4 그리드, 1 = 블록 존재)
const TETROMINO_SHAPES = {
  I: [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]],
  O: [[1,1], [1,1]],
  T: [[0,1,0], [1,1,1], [0,0,0]],
  S: [[0,1,1], [1,1,0], [0,0,0]],
  Z: [[1,1,0], [0,1,1], [0,0,0]],
  J: [[1,0,0], [1,1,1], [0,0,0]],
  L: [[0,0,1], [1,1,1], [0,0,0]],
};

// ============ 게임 상태 ============
let gameBoard = [];
let currentPiece = null;
let nextPiece = null;
let gameScore = 0;
let gameLevel = 1;
let clearedLinesCount = 0;
let isGameRunning = false;
let gameLoopId = null;
let dropInterval = 1000;
let lastDropTime = 0;
let isLineClearing = false;

// ============ DOM 요소 ============
const gameCanvas = document.getElementById('gameCanvas');
const nextPieceCanvas = document.getElementById('nextPieceCanvas');
const scoreDisplay = document.getElementById('scoreDisplay');
const levelDisplay = document.getElementById('levelDisplay');
const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');
const musicToggle = document.getElementById('musicToggle');
const lineClearOverlay = document.getElementById('lineClearOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const gameOverScoreDisplay = document.getElementById('gameOverScoreDisplay');
const retryBtn = document.getElementById('retryBtn');
const myBestScoreDisplay = document.getElementById('myBestScoreDisplay');
const myBestRankDisplay = document.getElementById('myBestRankDisplay');
const leaderboardList = document.getElementById('leaderboardList');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const nameInputOverlay = document.getElementById('nameInputOverlay');
const nameInputField = document.getElementById('nameInputField');
const nameInputConfirmBtn = document.getElementById('nameInputConfirmBtn');
const chatbotWindow = document.getElementById('chatbotWindow');
const chatbotToggleBtn = document.getElementById('chatbotToggleBtn');
const chatbotCloseBtn = document.getElementById('chatbotCloseBtn');
const chatbotMessages = document.getElementById('chatbotMessages');
const chatbotInput = document.getElementById('chatbotInput');
const chatbotSendBtn = document.getElementById('chatbotSendBtn');
const keyboardModeIndicator = document.getElementById('keyboardModeIndicator');

// ============ 로컬 스토리지 키 ============
const STORAGE_KEYS = {
  LEADERBOARD: 'tetris_leaderboard',
  MY_NICKNAME: 'tetris_nickname',
  CHAT_MESSAGES: 'tetris_chat_messages',
};

const gameContext = gameCanvas.getContext('2d');
const nextPieceContext = nextPieceCanvas.getContext('2d');

// ============ 보드 초기화 ============
function initializeEmptyBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array.from({ length: BOARD_WIDTH }, () => null)
  );
}

// ============ 테트로미노 생성 ============
function createTetromino(type = null) {
  const tetrominoTypes = Object.keys(TETROMINO_SHAPES);
  const selectedType = type || tetrominoTypes[Math.floor(Math.random() * tetrominoTypes.length)];
  const shape = TETROMINO_SHAPES[selectedType].map(row => [...row]);
  const color = COLORS[selectedType];
  
  return {
    type: selectedType,
    shape,
    color,
    positionX: Math.floor((BOARD_WIDTH - shape[0].length) / 2),
    positionY: 0,
  };
}

// ============ 회전 로직 ============
function rotateTetrominoShape(shape) {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotatedShape = Array.from({ length: cols }, (_, colIndex) =>
    Array.from({ length: rows }, (_, rowIndex) => shape[rows - 1 - rowIndex][colIndex])
  );
  return rotatedShape;
}

// ============ 충돌 감지 ============
function checkCollision({ shape, positionX, positionY }, offsetX = 0, offsetY = 0) {
  const newX = positionX + offsetX;
  const newY = positionY + offsetY;

  for (let rowIndex = 0; rowIndex < shape.length; rowIndex++) {
    for (let colIndex = 0; colIndex < shape[rowIndex].length; colIndex++) {
      if (shape[rowIndex][colIndex]) {
        const boardY = newY + rowIndex;
        const boardX = newX + colIndex;

        if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) {
          return true;
        }
        if (boardY >= 0 && gameBoard[boardY][boardX]) {
          return true;
        }
      }
    }
  }
  return false;
}

// ============ 블록을 보드에 고정 ============
function lockPieceToBoard() {
  const { shape, color, positionX, positionY } = currentPiece;

  for (let rowIndex = 0; rowIndex < shape.length; rowIndex++) {
    for (let colIndex = 0; colIndex < shape[rowIndex].length; colIndex++) {
      if (shape[rowIndex][colIndex]) {
        const boardY = positionY + rowIndex;
        const boardX = positionX + colIndex;
        if (boardY >= 0) {
          gameBoard[boardY][boardX] = color;
        }
      }
    }
  }
}

// ============ 완성된 라인 찾기 ============
function findCompletedLines() {
  const completedLineIndices = [];

  for (let rowIndex = 0; rowIndex < BOARD_HEIGHT; rowIndex++) {
    const isLineFull = gameBoard[rowIndex].every(cell => cell !== null);
    if (isLineFull) {
      completedLineIndices.push(rowIndex);
    }
  }

  return completedLineIndices;
}

function getEmptyLineClearResult() {
  return { count: 0, lineIndices: [] };
}

// ============ 라인 클리어 및 블록 낙하 ============
function removeCompletedLinesAndDropBlocks() {
  const completedLineIndices = findCompletedLines();

  if (completedLineIndices.length === 0) {
    return getEmptyLineClearResult();
  }

  // 완성된 라인 제거 후 위 블록들이 아래로 떨어지도록 처리
  const linesToRemove = new Set(completedLineIndices);
  const newBoard = initializeEmptyBoard();
  let newBoardWriteRow = BOARD_HEIGHT - 1;

  for (let readRow = BOARD_HEIGHT - 1; readRow >= 0; readRow--) {
    if (!linesToRemove.has(readRow)) {
      newBoard[newBoardWriteRow] = [...gameBoard[readRow]];
      newBoardWriteRow--;
    }
  }

  gameBoard = newBoard;
  return { count: completedLineIndices.length, lineIndices: completedLineIndices };
}

// ============ 점수 계산 ============
const SCORE_PER_LINE = [0, 100, 300, 500, 800];

function addScoreForClearedLines(linesClearedThisTurn) {
  const lineBonus = SCORE_PER_LINE[linesClearedThisTurn] || 800;
  const levelBonus = lineBonus * gameLevel;
  gameScore += levelBonus;
  clearedLinesCount += linesClearedThisTurn;
  updateLevelFromClearedLines();
}

function updateLevelFromClearedLines() {
  const newLevel = Math.floor(clearedLinesCount / 10) + 1;
  if (newLevel > gameLevel) {
    gameLevel = newLevel;
    dropInterval = Math.max(100, 1000 - (gameLevel - 1) * 100);
  }
}

// ============ 라인 클리어 임팩트 효과 ============
function triggerLineClearImpact({ count: linesClearedCount, lineIndices }) {
  // 화면 플래시 효과 (더 강하게)
  const flashElement = document.createElement('div');
  flashElement.className = 'flash-effect';
  lineClearOverlay.appendChild(flashElement);
  setTimeout(() => flashElement.remove(), 200);

  const canvasRect = gameCanvas.getBoundingClientRect();
  const centerX = canvasRect.left + canvasRect.width / 2;
  const centerY = canvasRect.top + canvasRect.height / 2;

  // 중앙에서 대형 폭발
  const centerParticleCount = 25 + linesClearedCount * 15;
  for (let i = 0; i < centerParticleCount; i++) {
    createExplosionParticle(centerX, centerY, 12, 200);
  }

  // 클리어된 라인 위치에서 블록마다 펑펑! 터지는 효과
  for (const rowIndex of lineIndices) {
    const lineY = canvasRect.top + (rowIndex + 0.5) * BLOCK_SIZE;
    for (let blockIndex = 0; blockIndex < BOARD_WIDTH; blockIndex++) {
      const blockX = canvasRect.left + (blockIndex + 0.5) * BLOCK_SIZE;
      createExplosionParticle(blockX, lineY, 8, 120);
    }
  }

  // 화면 흔들림 효과 (더 강하고 오래)
  triggerScreenShake(linesClearedCount);
}

function createExplosionParticle(originX, originY, maxSize = 10, maxVelocity = 150) {
  const particle = document.createElement('div');
  particle.className = 'particle';
  const size = 4 + Math.random() * maxSize;
  particle.style.width = `${size}px`;
  particle.style.height = `${size}px`;
  particle.style.left = `${originX - size / 2}px`;
  particle.style.top = `${originY - size / 2}px`;
  const particleColor = COLORS[Object.keys(COLORS)[Math.floor(Math.random() * 7)]];
  particle.style.background = particleColor;
  particle.style.boxShadow = `0 0 ${size}px ${particleColor}`;

  const angle = (Math.PI * 2 * Math.random());
  const velocity = 30 + Math.random() * maxVelocity;
  const endX = Math.cos(angle) * velocity;
  const endY = Math.sin(angle) * velocity;

  particle.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${endX}px, ${endY}px) scale(0)`, opacity: 0 }
    ],
    { duration: 400 + Math.random() * 200, easing: 'ease-out' }
  ).onfinish = () => particle.remove();

  lineClearOverlay.appendChild(particle);
}

function triggerScreenShake(linesClearedCount) {
  const shakeIntensity = 4 + linesClearedCount * 3;
  const shakeDuration = 0.35 + linesClearedCount * 0.05;

  const shakeStyle = document.getElementById('shakeKeyframes') || (() => {
    const style = document.createElement('style');
    style.id = 'shakeKeyframes';
    document.head.appendChild(style);
    return style;
  })();

  shakeStyle.textContent = `
    @keyframes screenShake {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      10% { transform: translate(-${shakeIntensity}px, -${shakeIntensity}px) rotate(-0.5deg); }
      20% { transform: translate(${shakeIntensity}px, ${shakeIntensity}px) rotate(0.5deg); }
      30% { transform: translate(-${shakeIntensity * 0.8}px, ${shakeIntensity}px) rotate(-0.3deg); }
      40% { transform: translate(${shakeIntensity * 0.8}px, -${shakeIntensity}px) rotate(0.3deg); }
      50% { transform: translate(-${shakeIntensity * 0.5}px, -${shakeIntensity * 0.5}px) rotate(-0.2deg); }
      60% { transform: translate(${shakeIntensity * 0.5}px, ${shakeIntensity * 0.5}px) rotate(0.2deg); }
      70% { transform: translate(-${shakeIntensity * 0.3}px, ${shakeIntensity * 0.3}px) rotate(-0.1deg); }
      80% { transform: translate(${shakeIntensity * 0.3}px, -${shakeIntensity * 0.3}px) rotate(0.1deg); }
      90% { transform: translate(-${shakeIntensity * 0.2}px, -${shakeIntensity * 0.2}px) rotate(0deg); }
    }
  `;

  const gameContainer = document.querySelector('.game-container');
  if (gameContainer) {
    gameContainer.style.animation = 'none';
    gameContainer.offsetHeight;
    gameContainer.style.animation = `screenShake ${shakeDuration}s ease-out`;
    setTimeout(() => {
      gameContainer.style.animation = '';
    }, shakeDuration * 1000);
  }
}

// ============ 새 블록 스폰 ============
function spawnNewPiece() {
  currentPiece = nextPiece || createTetromino();
  nextPiece = createTetromino();

  if (checkCollision(currentPiece)) {
    endGame();
    return;
  }

  drawNextPiece();
}

// ============ 블록 이동 ============
function movePiece(directionX, directionY) {
  if (!currentPiece || isLineClearing) return;

  if (!checkCollision(currentPiece, directionX, directionY)) {
    currentPiece.positionX += directionX;
    currentPiece.positionY += directionY;
    if (directionY > 0) {
      gameScore += 1;
    }
    return true;
  }
  return false;
}

// ============ 블록 회전 ============
function rotateCurrentPiece() {
  if (!currentPiece || isLineClearing) return;

  const rotatedShape = rotateTetrominoShape(currentPiece.shape);
  const originalShape = currentPiece.shape;

  currentPiece.shape = rotatedShape;

  if (checkCollision(currentPiece)) {
    currentPiece.shape = originalShape;
  }
}

// ============ 하드 드롭 (즉시 낙하) ============
function hardDropPiece() {
  if (!currentPiece || isLineClearing) return;

  while (movePiece(0, 1)) {}
  lockPieceAndProcessLines();
}

// ============ 블록 고정 및 라인 처리 ============
function lockPieceAndProcessLines() {
  lockPieceToBoard();
  const lineClearResult = removeCompletedLinesAndDropBlocks();

  currentPiece = null;

  if (lineClearResult.count > 0) {
    isLineClearing = true;
    addScoreForClearedLines(lineClearResult.count);
    triggerLineClearImpact(lineClearResult);
    playLineClearSound(lineClearResult.count);
    setTimeout(() => {
      isLineClearing = false;
      spawnNewPiece();
    }, 400);
  } else {
    spawnNewPiece();
  }
}

// ============ 렌더링 ============
function drawBlock(context, x, y, color, size = BLOCK_SIZE) {
  const padding = 1;
  const innerSize = size - padding * 2;

  context.fillStyle = color;
  context.fillRect(x * size + padding, y * size + padding, innerSize, innerSize);

  context.strokeStyle = 'rgba(255,255,255,0.3)';
  context.lineWidth = 1;
  context.strokeRect(x * size + padding, y * size + padding, innerSize, innerSize);
}

function drawBoard() {
  gameContext.fillStyle = '#0d0d0d';
  gameContext.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

  // 고전 테트리스 스타일 그리드 라인
  gameContext.strokeStyle = 'rgba(0, 255, 136, 0.08)';
  gameContext.lineWidth = 1;
  for (let col = 0; col <= BOARD_WIDTH; col++) {
    gameContext.beginPath();
    gameContext.moveTo(col * BLOCK_SIZE, 0);
    gameContext.lineTo(col * BLOCK_SIZE, gameCanvas.height);
    gameContext.stroke();
  }
  for (let row = 0; row <= BOARD_HEIGHT; row++) {
    gameContext.beginPath();
    gameContext.moveTo(0, row * BLOCK_SIZE);
    gameContext.lineTo(gameCanvas.width, row * BLOCK_SIZE);
    gameContext.stroke();
  }

  for (let rowIndex = 0; rowIndex < BOARD_HEIGHT; rowIndex++) {
    for (let colIndex = 0; colIndex < BOARD_WIDTH; colIndex++) {
      const cellColor = gameBoard[rowIndex][colIndex];
      if (cellColor) {
        drawBlock(gameContext, colIndex, rowIndex, cellColor);
      }
    }
  }

  if (currentPiece && !isLineClearing) {
    const { shape, color, positionX, positionY } = currentPiece;
    for (let rowIndex = 0; rowIndex < shape.length; rowIndex++) {
      for (let colIndex = 0; colIndex < shape[rowIndex].length; colIndex++) {
        if (shape[rowIndex][colIndex]) {
          drawBlock(gameContext, positionX + colIndex, positionY + rowIndex, color);
        }
      }
    }
  }
}

function drawNextPiece() {
  nextPieceContext.fillStyle = '#0d0d0d';
  nextPieceContext.fillRect(0, 0, nextPieceCanvas.width, nextPieceCanvas.height);

  if (!nextPiece) return;

  const { shape, color } = nextPiece;
  const previewBlockSize = 24;
  const offsetCol = (4 - shape[0].length) / 2;
  const offsetRow = (4 - shape.length) / 2;

  for (let rowIndex = 0; rowIndex < shape.length; rowIndex++) {
    for (let colIndex = 0; colIndex < shape[rowIndex].length; colIndex++) {
      if (shape[rowIndex][colIndex]) {
        const drawX = offsetCol + colIndex;
        const drawY = offsetRow + rowIndex;
        nextPieceContext.fillStyle = color;
        nextPieceContext.fillRect(
          drawX * previewBlockSize + 12,
          drawY * previewBlockSize + 12,
          previewBlockSize - 2,
          previewBlockSize - 2
        );
        nextPieceContext.strokeStyle = 'rgba(255,255,255,0.3)';
        nextPieceContext.strokeRect(
          drawX * previewBlockSize + 12,
          drawY * previewBlockSize + 12,
          previewBlockSize - 2,
          previewBlockSize - 2
        );
      }
    }
  }
}

function updateDisplay() {
  scoreDisplay.textContent = gameScore;
  levelDisplay.textContent = gameLevel;
}

// ============ 게임 루프 ============
function gameLoop(timestamp) {
  if (!isGameRunning) return;

  if (timestamp - lastDropTime > dropInterval && !isLineClearing) {
    const didMove = movePiece(0, 1);
    lastDropTime = timestamp;

    if (!didMove) {
      lockPieceAndProcessLines();
    }
  }

  drawBoard();
  updateDisplay();
  gameLoopId = requestAnimationFrame(gameLoop);
}

// ============ 입력 처리 ============
function shouldIgnoreGameKeys() {
  const activeElement = document.activeElement;
  const inputTagNames = ['INPUT', 'TEXTAREA'];
  return activeElement && inputTagNames.includes(activeElement.tagName);
}

function setKeyboardModeToGame() {
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
    activeEl.blur();
  }
  if (keyboardModeIndicator) {
    keyboardModeIndicator.textContent = '🎮 게임 조작';
    keyboardModeIndicator.classList.remove('chat-mode');
  }
}

function setKeyboardModeToChat() {
  if (keyboardModeIndicator) {
    keyboardModeIndicator.textContent = '💬 채팅 입력';
    keyboardModeIndicator.classList.add('chat-mode');
  }
}

function updateKeyboardModeIndicator() {
  if (shouldIgnoreGameKeys()) {
    setKeyboardModeToChat();
  } else {
    setKeyboardModeToGame();
  }
}

function handleKeyDown(event) {
  if (!isGameRunning || isLineClearing) return;
  if (shouldIgnoreGameKeys()) return;

  switch (event.code) {
    case 'ArrowLeft':
      event.preventDefault();
      movePiece(-1, 0);
      break;
    case 'ArrowRight':
      event.preventDefault();
      movePiece(1, 0);
      break;
    case 'ArrowDown':
      event.preventDefault();
      movePiece(0, 1);
      gameScore += 1;
      break;
    case 'ArrowUp':
      event.preventDefault();
      rotateCurrentPiece();
      break;
    case 'Space':
      event.preventDefault();
      hardDropPiece();
      break;
  }
}

// ============ BGM - 고전 8비트 스타일 ============
let audioContext = null;
let bgmOscillator = null;
let bgmGainNode = null;
let isBgmPlaying = false;
let bgmIntervalId = null;

// 고전 테트리스 BGM - 코로베이니키(Korobeiniki) 멜로디
const KOROBEINIKI_MELODY = [
  { note: 659, duration: 0.25 }, { note: 494, duration: 0.125 }, { note: 523, duration: 0.125 },
  { note: 587, duration: 0.125 }, { note: 523, duration: 0.125 }, { note: 494, duration: 0.125 },
  { note: 440, duration: 0.25 }, { note: 440, duration: 0.125 }, { note: 523, duration: 0.125 },
  { note: 659, duration: 0.25 }, { note: 587, duration: 0.125 }, { note: 523, duration: 0.125 },
  { note: 494, duration: 0.375 }, { note: 523, duration: 0.125 }, { note: 587, duration: 0.25 },
  { note: 659, duration: 0.25 }, { note: 523, duration: 0.25 }, { note: 440, duration: 0.25 },
  { note: 440, duration: 0.25 }, { note: 0, duration: 0.25 }, { note: 0, duration: 0.25 },
  { note: 587, duration: 0.25 }, { note: 698, duration: 0.125 }, { note: 880, duration: 0.25 },
  { note: 784, duration: 0.125 }, { note: 698, duration: 0.125 }, { note: 659, duration: 0.375 },
  { note: 523, duration: 0.125 }, { note: 659, duration: 0.25 }, { note: 587, duration: 0.125 },
  { note: 523, duration: 0.125 }, { note: 494, duration: 0.125 }, { note: 494, duration: 0.125 },
  { note: 523, duration: 0.125 }, { note: 587, duration: 0.25 }, { note: 659, duration: 0.25 },
  { note: 523, duration: 0.25 }, { note: 440, duration: 0.25 }, { note: 440, duration: 0.25 },
  { note: 0, duration: 0.5 },
];

function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    bgmGainNode = audioContext.createGain();
    bgmGainNode.gain.value = 0.12;
    bgmGainNode.connect(audioContext.destination);
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

function playBgmNote(frequency, duration) {
  if (!audioContext || frequency === 0) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.type = 'square';
  oscillator.frequency.value = frequency;
  oscillator.connect(gainNode);
  gainNode.connect(bgmGainNode);
  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

function clearBgmInterval() {
  if (bgmIntervalId) {
    clearInterval(bgmIntervalId);
    bgmIntervalId = null;
  }
}

function playBgm() {
  if (!isGameRunning || !isBgmPlaying) return;

  clearBgmInterval();
  initAudioContext();
  let melodyIndex = 0;

  function playNextNote() {
    if (!isBgmPlaying || !isGameRunning) return;
    const noteData = KOROBEINIKI_MELODY[melodyIndex % KOROBEINIKI_MELODY.length];
    playBgmNote(noteData.note, noteData.duration * 0.15);
    melodyIndex++;
  }

  const noteInterval = 150;
  bgmIntervalId = setInterval(playNextNote, noteInterval);
}

function stopBgm() {
  isBgmPlaying = false;
  clearBgmInterval();
}

function playLineClearSound(linesClearedCount = 1) {
  if (!audioContext) initAudioContext();
  if (!audioContext) return;

  // 펑펑! 폭발 사운드 - 클리어된 라인 수만큼 연속 폭발음
  for (let burstIndex = 0; burstIndex < linesClearedCount; burstIndex++) {
    setTimeout(() => {
      playExplosionSound();
    }, burstIndex * 120);
  }

  // 상승하는 멜로디 (기존 효과음)
  setTimeout(() => {
    const frequencies = [523, 659, 784, 1047];
    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        playBgmNote(freq, 0.12);
      }, index * 70);
    });
  }, linesClearedCount * 100);
}

function playExplosionSound() {
  if (!audioContext) return;

  // 펑! - 노이즈 버스트 + 저음으로 폭발감 연출
  const bufferSize = audioContext.sampleRate * 0.15;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
  }

  const noiseSource = audioContext.createBufferSource();
  noiseSource.buffer = buffer;

  const noiseGain = audioContext.createGain();
  noiseGain.gain.setValueAtTime(0.4, audioContext.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.12);

  const lowPass = audioContext.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 800;

  noiseSource.connect(lowPass);
  lowPass.connect(noiseGain);
  noiseGain.connect(audioContext.destination);
  noiseSource.start(audioContext.currentTime);
  noiseSource.stop(audioContext.currentTime + 0.15);

  // 저음 펑! 보강
  playBgmNote(80, 0.08);
  setTimeout(() => playBgmNote(60, 0.1), 40);
}

// ============ 게임 시작/종료 ============
function startGame() {
  gameBoard = initializeEmptyBoard();
  gameScore = 0;
  gameLevel = 1;
  clearedLinesCount = 0;
  dropInterval = 1000;
  isGameRunning = true;
  isLineClearing = false;

  startScreen.classList.add('hidden');
  nextPiece = createTetromino();
  spawnNewPiece();
  lastDropTime = performance.now();

  document.addEventListener('keydown', handleKeyDown);
  gameLoopId = requestAnimationFrame(gameLoop);

  if (isBgmPlaying) {
    playBgm();
  }
}

function endGame() {
  isGameRunning = false;
  stopBgm();
  if (gameLoopId) {
    cancelAnimationFrame(gameLoopId);
  }
  document.removeEventListener('keydown', handleKeyDown);

  const isScoreInTop10 = checkIfScoreEntersTop10(gameScore);

  if (isScoreInTop10) {
    showNameInputModal(gameScore);
  } else {
    saveScoreToLeaderboard(gameScore);
    updateLeaderboardDisplay();
    showGameOverOverlay(gameScore);
  }
}

function checkIfScoreEntersTop10(score) {
  const leaderboard = getLeaderboardData();
  const entriesWithoutCurrentUser = leaderboard.filter(entry => !entry.isCurrentUser);
  const sortedScores = [...entriesWithoutCurrentUser].sort((a, b) => b.score - a.score);
  const tenthPlaceScore = sortedScores[9]?.score ?? 0;
  return score > tenthPlaceScore || sortedScores.length < 10;
}

function showNameInputModal(finalScore) {
  const savedNickname = localStorage.getItem(STORAGE_KEYS.MY_NICKNAME) || '';
  nameInputField.value = savedNickname;
  nameInputField.placeholder = savedNickname ? `${savedNickname} (수정 가능)` : '이름 입력 (최대 10자)';
  nameInputOverlay.classList.add('visible');
  nameInputField.focus();

  const confirmWithName = () => {
    const playerName = nameInputField.value.trim() || '플레이어';
    const nameToSave = playerName.slice(0, 10);
    localStorage.setItem(STORAGE_KEYS.MY_NICKNAME, nameToSave);
    nameInputOverlay.classList.remove('visible');
    saveScoreToLeaderboard(gameScore, nameToSave);
    updateLeaderboardDisplay();
    showGameOverOverlay(gameScore);
    nameInputConfirmBtn.removeEventListener('click', confirmWithName);
    nameInputField.removeEventListener('keypress', handleNameInputKeypress);
  };

  const handleNameInputKeypress = (event) => {
    if (event.key === 'Enter') confirmWithName();
  };

  nameInputConfirmBtn.addEventListener('click', confirmWithName);
  nameInputField.addEventListener('keypress', handleNameInputKeypress);
}

function showGameOverOverlay(finalScore) {
  gameOverScoreDisplay.textContent = `점수: ${finalScore}`;
  gameOverOverlay.classList.add('visible');
}

function hideGameOverOverlay() {
  gameOverOverlay.classList.remove('visible');
}

// ============ 기록판 ============
function getLeaderboardData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LEADERBOARD);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('기록 불러오기 실패:', error);
  }
  return getDefaultLeaderboard();
}

function getDefaultLeaderboard() {
  return [
    { playerName: '테트리스마스터', score: 125000, isCurrentUser: false },
    { playerName: '블록왕', score: 98000, isCurrentUser: false },
    { playerName: '라인클리어', score: 75600, isCurrentUser: false },
    { playerName: '고수플레이어', score: 52300, isCurrentUser: false },
    { playerName: '초보탈출', score: 31200, isCurrentUser: false },
  ];
}

function saveScoreToLeaderboard(score, playerName = null) {
  const leaderboard = getLeaderboardData();
  const nicknameToUse = playerName || localStorage.getItem(STORAGE_KEYS.MY_NICKNAME) || '나';

  const myNewEntry = {
    playerName: nicknameToUse,
    score,
    isCurrentUser: true,
    timestamp: Date.now(),
  };

  const entriesWithoutMyOld = leaderboard.filter(entry => !entry.isCurrentUser);
  entriesWithoutMyOld.push(myNewEntry);
  entriesWithoutMyOld.sort((a, b) => b.score - a.score);

  const topTen = entriesWithoutMyOld.slice(0, 10);
  localStorage.setItem(STORAGE_KEYS.LEADERBOARD, JSON.stringify(topTen));
}

function getMyBestScore() {
  const leaderboard = getLeaderboardData();
  const myEntries = leaderboard.filter(entry => entry.isCurrentUser);
  if (myEntries.length === 0) return 0;
  return Math.max(...myEntries.map(entry => entry.score));
}

function getMyRank() {
  const leaderboard = getLeaderboardData();
  const sortedByScore = [...leaderboard].sort((a, b) => b.score - a.score);
  const myBestScore = getMyBestScore();
  if (myBestScore === 0) return null;
  const rankIndex = sortedByScore.findIndex(entry => entry.score <= myBestScore);
  return rankIndex === -1 ? sortedByScore.length : rankIndex + 1;
}

function updateLeaderboardDisplay() {
  const leaderboard = getLeaderboardData();
  const sortedLeaderboard = [...leaderboard].sort((a, b) => b.score - a.score);

  myBestScoreDisplay.textContent = getMyBestScore().toLocaleString();
  const myRank = getMyRank();
  myBestRankDisplay.textContent = myRank ? `${myRank} 위` : '- 위';

  leaderboardList.innerHTML = sortedLeaderboard.slice(0, 10).map((entry, index) => `
    <li class="leaderboard-item ${entry.isCurrentUser ? 'my-score' : ''}">
      <span class="leaderboard-rank">${index + 1}</span>
      <span class="leaderboard-name">${escapeHtml(entry.playerName)}</span>
      <span class="leaderboard-score">${entry.score.toLocaleString()}</span>
    </li>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============ 대화창 ============
function getChatMessages() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('채팅 불러오기 실패:', error);
  }
  return getDefaultChatMessages();
}

function getDefaultChatMessages() {
  return [
    { sender: '테트리스팬', message: '재밌다! 화이팅!', isCurrentUser: false, timestamp: Date.now() - 3600000 },
    { sender: '블록러', message: '라인 4개 한번에 클리어했어 ㅎㅎ', isCurrentUser: false, timestamp: Date.now() - 1800000 },
    { sender: '고수', message: '레벨 10까지 갔는데 어려워...', isCurrentUser: false, timestamp: Date.now() - 600000 },
  ];
}

function saveChatMessage(sender, message, isCurrentUser) {
  const messages = getChatMessages();
  messages.push({
    sender,
    message,
    isCurrentUser,
    timestamp: Date.now(),
  });
  const recentMessages = messages.slice(-50);
  localStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(recentMessages));
  return recentMessages;
}

function renderChatMessages(messages = null) {
  const messagesToRender = messages || getChatMessages();
  chatMessages.innerHTML = messagesToRender.map(msg => `
    <div class="chat-message ${msg.isCurrentUser ? 'mine' : 'other'}">
      <div class="chat-sender">${escapeHtml(msg.sender)}</div>
      <div>${escapeHtml(msg.message)}</div>
    </div>
  `).join('');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendChatMessage() {
  const messageText = chatInput.value.trim();
  if (!messageText) return;

  const myNickname = localStorage.getItem(STORAGE_KEYS.MY_NICKNAME) || '나';
  saveChatMessage(myNickname, messageText, true);
  chatInput.value = '';
  renderChatMessages();
}

// ============ 챗봇 ============
const CHATBOT_GREETING = '안녕하세요! 테트리스 도우미예요. 조작법, 점수, 팁 등 궁금한 걸 물어보세요!';

function openChatbot() {
  chatbotWindow.classList.add('open');
  chatbotToggleBtn.style.display = 'none';
  if (chatbotMessages.children.length === 0) {
    appendChatbotMessage('bot', CHATBOT_GREETING);
  }
  chatbotInput.focus();
}

function closeChatbot() {
  chatbotWindow.classList.remove('open');
  chatbotToggleBtn.style.display = 'flex';
}

function appendChatbotMessage(senderType, text) {
  const msgEl = document.createElement('div');
  msgEl.className = `chatbot-msg ${senderType}`;
  msgEl.textContent = text;
  chatbotMessages.appendChild(msgEl);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function getChatbotResponse(userMessage) {
  const normalizedInput = userMessage.trim().toLowerCase().replace(/\s+/g, ' ');

  const responsePatterns = [
    { patterns: ['안녕', '하이', '헬로', '반가워'], response: '안녕하세요! 테트리스 즐기고 계세요? 화이팅! 💪' },
    { patterns: ['조작', '키', '키보드', '방향키', '이동', '회전'], response: '← → : 좌우 이동\n↑ : 블록 회전\n↓ : 빠르게 내리기\nSPACE : 즉시 낙하!' },
    { patterns: ['점수', '스코어', '점수계산'], response: '라인 클리어 시 점수가 올라가요. 1줄: 100, 2줄: 300, 3줄: 500, 4줄: 800! 레벨이 올라가면 배율이 적용돼요.' },
    { patterns: ['레벨', '난이도'], response: '10줄 클리어할 때마다 레벨이 올라가요. 레벨이 높을수록 블록이 빨리 떨어지고 점수 배율도 올라갑니다!' },
    { patterns: ['팁', '꿀팁', '방법', '어떻게'], response: '한 줄씩 채우기보다 4줄 한번에(테트리스) 클리어하면 점수가 훨씬 높아요! I블록을 모아두는 게 좋아요.' },
    { patterns: ['도움', 'help', '뭐할수'], response: '조작법, 점수, 레벨, 팁 등 물어보세요! "조작"이라고 하면 키 설명을 해줄게요.' },
    { patterns: ['감사', '고마워', '고맙'], response: '천만에요! 즐거운 테트리스 되세요~ 🎮' },
    { patterns: ['재밌', '재미', '좋아'], response: '기쁘네요! 탑10에 도전해보세요. 화이팅! 🏆' },
    { patterns: ['어려워', '힘들어', '막혀'], response: '천천히 익숙해지면 됩니다. ↓ 키로 빠르게 내리고 SPACE로 즉시 낙하하면 편해요!' },
    { patterns: ['기록', '순위', '랭킹'], response: '탑10에 들면 이름을 입력할 수 있어요. "전체 기록 보기"에서 공유 링크로 친구에게 자랑하세요!' },
    { patterns: ['블록', '도형', '피스'], response: 'I, O, T, S, Z, J, L 7가지 블록이 있어요. I블록은 4줄 한번에 클리어할 때 유용해요!' },
    { patterns: ['bgm', '음악', '소리'], response: 'BGM 켜기 버튼을 누르면 고전 테트리스 코로베이니키 멜로디가 재생돼요. 라인 클리어 시 효과음도 있어요!' },
  ];

  for (const { patterns, response } of responsePatterns) {
    if (patterns.some(pattern => normalizedInput.includes(pattern))) {
      return response;
    }
  }

  const defaultResponses = [
    '그건 잘 모르겠어요. "조작", "점수", "팁" 같은 키워드로 물어보세요!',
    '테트리스 관련 질문이면 답해드릴게요. 조작법이나 점수 궁금하세요?',
    '음... "도움"이라고 하면 제가 뭘 알려줄 수 있는지 볼 수 있어요!',
  ];
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

function sendChatbotMessage() {
  const userText = chatbotInput.value.trim();
  if (!userText) return;

  appendChatbotMessage('user', userText);
  chatbotInput.value = '';

  const botResponse = getChatbotResponse(userText);
  setTimeout(() => {
    appendChatbotMessage('bot', botResponse);
  }, 300);
}

// ============ 이벤트 리스너 ============
startBtn.addEventListener('click', () => {
  initAudioContext();
  startGame();
});

retryBtn.addEventListener('click', () => {
  hideGameOverOverlay();
  initAudioContext();
  startGame();
});

musicToggle.addEventListener('click', () => {
  isBgmPlaying = !isBgmPlaying;
  musicToggle.textContent = isBgmPlaying ? '🔇 BGM 끄기' : '🔊 BGM 켜기';
  
  if (isBgmPlaying && isGameRunning) {
    playBgm();
  } else if (!isBgmPlaying) {
    stopBgm();
  }
});

chatSendBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') sendChatMessage();
});

chatbotToggleBtn.addEventListener('click', openChatbot);
chatbotCloseBtn.addEventListener('click', () => {
  closeChatbot();
  setKeyboardModeToGame();
});
chatbotSendBtn.addEventListener('click', sendChatbotMessage);
chatbotInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') sendChatbotMessage();
});
chatbotInput.addEventListener('focus', setKeyboardModeToChat);
chatbotInput.addEventListener('blur', () => {
  if (!chatbotWindow.classList.contains('open')) return;
  setKeyboardModeToGame();
});

chatInput.addEventListener('focus', setKeyboardModeToChat);
chatInput.addEventListener('blur', setKeyboardModeToGame);

document.addEventListener('click', (event) => {
  const isGameArea = event.target.closest('.game-container, .main-area, .game-board-wrapper, .side-panel, .leaderboard-panel, #gameCanvas');
  const isChatInputArea = event.target.closest('.chatbot-input-area, .chat-input-area') || event.target.matches('input, textarea');
  if (isGameArea && !isChatInputArea) {
    setKeyboardModeToGame();
  }
});

document.addEventListener('focusin', () => {
  setTimeout(updateKeyboardModeIndicator, 0);
});

// ============ 초기화 ============
document.addEventListener('DOMContentLoaded', () => {
  updateLeaderboardDisplay();
  renderChatMessages();
});
